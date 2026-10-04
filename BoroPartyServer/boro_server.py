"""
Boro Party Server — a small always-on server for Boro Meter's live party
board. Runs independently of any clan member's PC, so the party code always
works, whether or not the person who created it is still online.

What it knows, and nothing more: a party code, a character name, and the
damage-meter numbers Boro already shows on screen (dps, hits, crit rate,
skill names, which target you're fighting, and which two weapons the
build uses). It never reads a combat log
itself, never touches the game, and never talks to any machine except the
Boro Meter clients that choose to push data to it.

Run directly:   python3 boro_server.py
As a service:   see boro-party.service in this same folder.
"""

import http.server
import json
import sys
import os
import random
import socketserver
import threading
import time
import urllib.parse

HOST = "0.0.0.0"
PORT = int(os.environ.get("BORO_PARTY_PORT", "8732"))

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # no 0/O, no 1/I
CODE_LEN = 4
# How long a room with nobody reporting is kept before it is dropped. Every
# connected client posts to /party/push every three seconds whether or not it
# has a fight to send, so "nobody reporting" means nobody has the party open —
# not that nobody is fighting. A room in use is therefore never at risk, and
# this only decides how long an abandoned one holds its code.
#
# It was three hours, measured from when the room was CREATED rather than from
# the last sign of life: a room opened and abandoned inside a minute still sat
# there for two hours and fifty-nine. Thirty minutes is a generous window for
# people to trickle in after the host reads out the code, which is the only
# thing this number has to cover.
EMPTY_ROOM_GRACE = 30 * 60
REPORT_TTL = 300             # a player's report older than this drops off the board
SWEEP_EVERY = 300
# How long a removed name is refused. Every client re-posts every three
# seconds, so without a pause a removal lasts exactly until the next push and
# looks like nothing happened. Twenty seconds is the whole job: long enough
# that the removal visibly takes and the person is told, short enough that
# coming straight back is a click. Removing someone is mostly how you
# un-stick them, not how you keep them out — a party that needs somebody kept
# out changes its code, which takes one button.
KICK_PAUSE = 20

ROOMS = {}                   # code -> {"created": ts, "owner": name,
                             #          "members": {name: {"payload":…, "ts":…}},
                             #          "kicked": {name: ts}}
LOCK = threading.Lock()


def make_code(owner=""):
    with LOCK:
        for _ in range(50):
            code = "".join(random.choice(CODE_ALPHABET) for _ in range(CODE_LEN))
            if code not in ROOMS:
                # the creator's name is the only claim to being the host this
                # server has — rooms are otherwise anonymous, and a removal
                # anyone could perform would be worse than none at all
                ROOMS[code] = {"created": time.time(), "owner": owner,
                               "members": {}, "kicked": {}}
                return code
    raise RuntimeError("could not allocate a free party code")


def build_board(code):
    now = time.time()
    with LOCK:
        room = ROOMS.get(code)
        if room is None:
            return None, ""
        rows = [(n, e) for n, e in room["members"].items() if now - e["ts"] < REPORT_TTL]

    if not rows:
        return [], ""

    # pick the target most people are actually fighting, ignoring anyone who
    # has not sent a fight yet — this decides what the headline total means,
    # not who gets shown. Two clients segment their own local log
    # independently, so it is normal for one player's "target" to lag or
    # lead another's by a couple of seconds even mid-fight; a small party
    # can flip the majority on a single report, and a member used to be
    # dropped from the board entirely the moment that happened — the whole
    # point of a party meter is seeing everyone, so nobody is excluded here
    # anymore, only left out of the on-target total.
    counts = {}
    for _, e in rows:
        if not e["payload"]:
            continue
        target = (e["payload"] or {}).get("target", "")
        counts[target] = counts.get(target, 0) + 1
    target = max(counts, key=counts.get) if counts else ""

    keep = rows   # everyone stays visible; waiting members still show as waiting
    # Share is against everyone reporting, not only those whose target string
    # matches the majority's. People are rarely on the same pull at the same
    # instant, so that test handed most of a raid a share of zero: measured on
    # a real one, four rows of six at 0.0%, and the three counted rows sharing
    # 100% between them. onTarget below still says who is somewhere else; it
    # no longer decides who counts.
    reporting_total = sum(
        (e["payload"] or {}).get("damage", 0) for _, e in keep if e["payload"]
    ) or 1

    board = []
    for name, e in keep:
        p = e["payload"] or {}
        is_on_target = bool(p) and p.get("target", "") == target
        board.append({
            "name": name,
            "waiting": not e["payload"],
            "damage": p.get("damage", 0), "dps": p.get("dps", 0), "hits": p.get("hits", 0),
            "crit": p.get("crit", 0), "heavy": p.get("heavy", 0), "seconds": p.get("seconds", 0),
            "max": p.get("max", 0),
            # Twelve, as many as a member's curve has lanes: whatever is
            # cut here lands in the reader's pooled "everything else" lane.
            "skills": (p.get("skills") or [])[:12],
            # Only whether there is a curve to look at, never the curve
            # itself. A finished fight's curve is around 13 kB, and every
            # push hands the whole board back to whoever pushed: measured
            # on this server, six members at the end of a fight downloaded
            # 81.7 kB each time, twelve members 174.9 kB — for data almost
            # nobody was reading. Whoever actually opens someone else's
            # timeline asks /party/curve once, for that one member.
            "hasCurve": bool((p.get("curve") or {}).get("T")),
            "share": (p.get("damage", 0) / reporting_total) if p else 0,
            "onTarget": is_on_target,
            # what this member is actually fighting, so a board can say so
            # rather than only that it is not what everyone else is on
            "target": p.get("target", ""),
            # which language their skill names are in — the board is where the
            # same id turns up under two spellings, and that pair is what lets
            # a client learn a translation instead of guessing one
            "lang": p.get("lang", ""),
            # the two weapon keys the client sent, relayed untouched. The
            # server never names a build: the pair means the same thing in
            # every language and each reader turns it into their own, the
            # same division of labour as "lang" above.
            "weapons": e.get("weapons") or [],
            # whether this member plays Eye of Ventius, which turns a Seeker
            # from healer into dps. Relayed untouched, like the weapons: the
            # server names no build and judges no role.
            "ventius": bool(e.get("ventius")),
            "age": int(now - e["ts"]),
        })
    board.sort(key=lambda r: -r["damage"])
    return board, target


def sweeper():
    while True:
        time.sleep(SWEEP_EVERY)
        now = time.time()
        with LOCK:
            # A room goes when nobody is reporting into it any more. The age
            # test is only a floor for the empty case: a code that has just
            # been read out has no members yet, and all() over no members is
            # true, so without it a fresh room would be swept before anyone
            # could type the code in.
            dead = [code for code, room in ROOMS.items()
                    if now - room["created"] > EMPTY_ROOM_GRACE
                    and all(now - e["ts"] > REPORT_TTL for e in room["members"].values())]
            for code in dead:
                del ROOMS[code]


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "BoroPartyServer/1"

    def log_message(self, *args):
        pass  # keep the service log to real errors only

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    # ---------------------------------------------------------------- GET
    def do_GET(self):
        parts = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(parts.query)

        if parts.path == "/health":
            with LOCK:
                n = len(ROOMS)
            self._json({"ok": True, "rooms": n})
            return

        code = (q.get("code", [""])[0] or "").strip().upper()
        with LOCK:
            exists = code in ROOMS

        if parts.path == "/party/ping":
            if not exists:
                self._json({"ok": False, "error": "unknown code"}, 404)
                return
            name = (q.get("name", [""])[0] or "").strip()[:40]
            if name:
                with LOCK:
                    room = ROOMS.get(code)
                    if room is not None and name not in room["members"]:
                        room["members"][name] = {"payload": None, "ts": time.time()}
            self._json({"ok": True})
            return

        if parts.path == "/party/board":
            if not exists:
                self._json({"ok": False, "error": "unknown code"}, 404)
                return
            board, target = build_board(code)
            self._json({"ok": True, "board": board, "target": target})
            return

        if parts.path == "/party/curve":
            # One member's curve and casts, asked for by name, when somebody
            # actually looks at their timeline. Relayed untouched like every
            # other part of a report — the server still does not read it.
            if not exists:
                self._json({"ok": False, "error": "unknown code"}, 404)
                return
            who = (q.get("name", [""])[0] or "").strip()[:40]
            with LOCK:
                room = ROOMS.get(code) or {}
                entry = (room.get("members") or {}).get(who) or {}
            p = entry.get("payload") or {}
            if not (p.get("curve") or {}).get("T"):
                self._json({"ok": False, "error": "no curve"}, 404)
                return
            self._json({"ok": True, "name": who, "curve": p.get("curve"),
                        "casts": p.get("casts")})
            return

        self._json({"ok": False}, 404)

    # --------------------------------------------------------------- POST
    def do_POST(self):
        parts = urllib.parse.urlparse(self.path)
        try:
            length = int(self.headers.get("Content-Length", 0))
            sent = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except Exception:
            self._json({"ok": False, "error": "bad request"}, 400)
            return

        if parts.path == "/party/create":
            name = (sent.get("name") or "").strip()[:40] or "Host"
            code = make_code(name)
            self._json({"ok": True, "code": code})
            return

        code = (sent.get("code") or "").strip().upper()
        with LOCK:
            room_exists = code in ROOMS
        if not room_exists:
            self._json({"ok": False, "error": "unknown code"}, 404)
            return

        if parts.path == "/party/push":
            name = (sent.get("name") or "").strip()[:40]
            if not name:
                self._json({"ok": False, "error": "no name"}, 400)
                return
            now = time.time()
            with LOCK:
                room = ROOMS[code]
                until = (room.get("kicked") or {}).get(name, 0)
                if now < until:
                    # answered rather than ignored, so the client can say what
                    # happened instead of quietly showing an empty board
                    self._json({"ok": False, "error": "removed", "kicked": True}, 403)
                    return
                # weapons ride beside the payload, not inside it: a member
                # who has not finished a pull yet has no payload at all,
                # and a party wants to see who tanks and who heals BEFORE
                # the pull. A client too old to send them leaves the field
                # absent and its row simply has no build.
                room["members"][name] = {"ventius": bool(sent.get("ventius")),
                                         "payload": sent.get("payload"),
                                         "weapons": sent.get("weapons"),
                                         "ts": now}
            board, target = build_board(code)
            self._json({"ok": True, "board": board, "target": target})
            return

        if parts.path == "/party/rename":
            # Jemand hat den Charakter gewechselt. Die Zeile zieht um, statt
            # dass eine zweite daneben auftaucht - und wenn der Umziehende
            # den Raum angelegt hat, zieht der Besitz mit. Sonst gehoerte der
            # Raum einem Namen, unter dem niemand mehr postet, und sein
            # Gastgeber koennte aus seinem eigenen Raum niemanden entfernen.
            old = (sent.get("name") or "").strip()[:40]
            new = (sent.get("to") or "").strip()[:40]
            if not old or not new:
                self._json({"ok": False, "error": "no name"}, 400)
                return
            with LOCK:
                room = ROOMS[code]
                if new != old and new in room["members"]:
                    self._json({"ok": False, "error": "name taken"}, 409)
                    return
                entry = room["members"].pop(old, None)
                if entry is not None:
                    room["members"][new] = entry
                if (room.get("owner") or "") == old:
                    room["owner"] = new
            board, target = build_board(code)
            self._json({"ok": True, "board": board, "target": target})
            return

        if parts.path == "/party/kick":
            asker = (sent.get("name") or "").strip()[:40]
            who = (sent.get("who") or "").strip()[:40]
            if not asker or not who:
                self._json({"ok": False, "error": "no name"}, 400)
                return
            with LOCK:
                room = ROOMS[code]
                owner = room.get("owner") or ""
                # only whoever created the room, and never themselves: a host
                # removing the host leaves a room nobody can manage
                if owner and asker != owner:
                    self._json({"ok": False, "error": "not the host"}, 403)
                    return
                if who == asker:
                    self._json({"ok": False, "error": "cannot remove yourself"}, 400)
                    return
                room["members"].pop(who, None)
                room.setdefault("kicked", {})[who] = time.time() + KICK_PAUSE
            board, target = build_board(code)
            self._json({"ok": True, "board": board, "target": target})
            return

        self._json({"ok": False}, 404)


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        # A client closing its connection mid-request — the app was closed,
        # the network blipped, the machine went to sleep — is normal and
        # happens constantly on a public party server. It is not a bug, so
        # it should not spam the journal with a full traceback every time.
        # Anything else still gets logged in full, so real problems stay
        # visible.
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionResetError, BrokenPipeError,
                            ConnectionAbortedError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def main():
    threading.Thread(target=sweeper, daemon=True).start()
    srv = Server((HOST, PORT), Handler)
    print("Boro Party Server listening on %s:%d" % (HOST, PORT))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
