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
import ipaddress
import json
import sys
import os
import random
import socketserver
import threading
import time
import urllib.parse

import boro_gilde



def _env_int(name, default):
    try:
        return int(os.environ.get(name, "") or default)
    except ValueError:
        return default


# Where it listens. A public instance behind a reverse proxy binds to 127.0.0.1
# so nobody can reach it around the proxy, which is also what makes the
# X-Forwarded-For header below trustworthy.
HOST = os.environ.get("BORO_PARTY_HOST", "0.0.0.0")
PORT = int(os.environ.get("BORO_PARTY_PORT", "8732"))
# Named in /health so a load test can refuse to run against anything else.
PROFIL = os.environ.get("BORO_PROFIL", "")
# Off on a public instance: it then serves no /gilde/ route and makes no folder.
GILDE_AN = os.environ.get("BORO_GILDE", "1") != "0"
# The limits below protect the server from one sender, and a public instance
# from anyone. The defaults are far above what a guild or a clan needs, so the
# instance that serves them behaves as before; a public instance sets lower
# values in its service file (docs/superpowers/specs/2026-10-26-oeffentlicher-
# party-server-design.md).
MAX_ROOMS = _env_int("BORO_MAX_ROOMS", 5000)                   # rooms at once
MAX_MEMBERS_TOTAL = _env_int("BORO_MAX_MEMBERS_TOTAL", 20000)  # names in all rooms
MAX_BYTES = _env_int("BORO_MAX_BYTES", 1024 * 1024 * 1024)     # stored reports, all rooms
RATE_IP = _env_int("BORO_RATE_IP", 600)                        # requests per sender per minute
CREATE_IP = _env_int("BORO_CREATE_IP", 50)                     # new rooms per sender per hour
MISS_IP = _env_int("BORO_MISS_IP", 60)                         # different unknown codes per sender per minute
MISS_PAUSE = _env_int("BORO_MISS_PAUSE", 300)                  # seconds a sender who guesses is refused
CONN_MAX = _env_int("BORO_CONN_MAX", 1000)                     # connections at once
CONN_IP = _env_int("BORO_CONN_IP", 200)                        # requests of one sender in progress at once
ROOM_MAX_AGE = _env_int("BORO_ROOM_MAX_AGE", 0)                # seconds; 0 = a room lives as long as it is used
LIMIT_TABLE_MAX = _env_int("BORO_LIMIT_TABLE_MAX", 50000)      # senders each counter table holds (memory bound)

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
SWEEP_EVERY = _env_int("BORO_SWEEP_EVERY", 300)
# How long a removed name is refused. Every client re-posts every three
# seconds, so without a pause a removal lasts exactly until the next push and
# looks like nothing happened. Twenty seconds is the whole job: long enough
# that the removal visibly takes and the person is told, short enough that
# coming straight back is a click. Removing someone is mostly how you
# un-stick them, not how you keep them out — a party that needs somebody kept
# out changes its code, which takes one button.
KICK_PAUSE = 20
# The largest request body accepted. Measured on 04.10.2026 over every fight in
# four weeks of real logs: the biggest push was 40.0 kB, a 414-second fight whose
# curve (16 kB) and casts (20 kB) are most of it; the densest fight came to about
# 150 bytes per second of fighting. 256 kB is six times the largest one and
# covers a fight of nearly half an hour at that density. Anything bigger is
# answered 413 before a byte of it is read: this server listens publicly, and
# reading whatever a sender announces would let anyone fill its memory.
MAX_BODY = 256 * 1024
# Seconds a connection may sit without sending anything before it is dropped.
# One thread serves one connection, so without this a sender that announces a
# body and never sends it holds a thread for good. Clients push every three
# seconds and give up on an answer after six, so ten never cuts off a real one.
REQUEST_TIMEOUT = 10
# How many names one room holds. A party is six and a raid a few parties; forty
# leaves room for a large alliance while keeping a room, and every board handed
# back on each push, bounded. A name already in the room always gets back in.
MAX_MEMBERS = 40

# The guild store (boro_gilde.py): everything of it is on disk, in this folder.
GILDEN = boro_gilde.GildenSpeicher(
    os.environ.get("BORO_GILDE_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "gilden"),
    test_uhr=os.environ.get("BORO_TEST_CLOCK") == "1") if GILDE_AN else None
# Only for the test of the error answer: a route that fails on purpose.
TEST_FEHLER = os.environ.get("BORO_TEST_FEHLER") == "1"
# Behind a reverse proxy (Caddy) the client address arrives in X-Forwarded-For;
# it is believed only from this address, otherwise the connection's own counts.
TRUSTED_PROXY = os.environ.get("BORO_TRUSTED_PROXY", "127.0.0.1")

ROOMS = {}                   # code -> {"created": ts, "owner": name,
                             #          "members": {name: {"payload":…, "ts":…}},
                             #          "kicked": {name: ts}}
LOCK = threading.Lock()
# What is stored, kept as running totals so a request never walks every room.
# Changed only with LOCK held, only through add_member/drop_member/drop_room.
STATS = {"members": 0, "bytes": 0}

# Per-sender counters. Memory only, keyed by the address Caddy reports, never
# written anywhere, and dropped by the sweeper once a window has passed. They
# use the monotonic clock: a wall clock that steps back must not lift a limit.
LIMIT_LOCK = threading.Lock()
RATES = {}                   # (kind, ip) -> [monotonic timestamps]
MISSES = {}                  # ip -> {unknown code: monotonic timestamp}
PAUSES = {}                  # ip -> monotonic time until which it is refused
INFLIGHT = {}                # ip -> requests in progress
CONNS = [0]                  # connections being served
CONN_LOCK = threading.Lock()


class ServerFull(Exception):
    """No room for another room, member or report."""


class TableFull(Exception):
    """A counter table is at its size limit and the sender is not in it."""


# How long a counter of each kind stays useful; the sweeper drops an entry
# once its own window has passed, not the longest window of any kind.
RATE_WINDOWS = {"req": 60, "create": 3600}
_last_prune = [0.0]


def sender_key(ip):
    """The key a sender is counted under. An IPv6 address is cut to its /64: one
    subscriber holds billions of addresses in it, and counting each would let
    one sender fill the tables. An IPv4-mapped address counts as its IPv4."""
    ip = (ip or "")[:64]
    if ":" not in ip:
        return ip
    try:
        addr = ipaddress.ip_address(ip.split("%")[0])
    except ValueError:
        return ip
    if addr.version == 6:
        if addr.ipv4_mapped is not None:
            return str(addr.ipv4_mapped)
        return str(ipaddress.ip_network((int(addr) >> 64 << 64, 64)))
    return str(addr)


def _room_in_table(table, key, now):
    """Whether `key` may be added to `table`. When the table is full, entries
    that have run out are dropped first (at most once a second, so a flood of
    new senders cannot make every request walk the table); a sender still not
    in it is refused: those already counted keep counting, and nobody gets in
    uncounted. Call with LIMIT_LOCK held."""
    if key in table or len(table) < LIMIT_TABLE_MAX:
        return True
    if now - _last_prune[0] >= 1.0:
        _prune(now)
    return len(table) < LIMIT_TABLE_MAX


def rate_ok(kind, ip, limit, window):
    """Counts one request of `ip`; False when it is over `limit` in `window` seconds.
    Raises TableFull for a new sender when the table is full."""
    now = time.monotonic()
    with LIMIT_LOCK:
        if not _room_in_table(RATES, (kind, ip), now):
            raise TableFull()
        lst = [t for t in RATES.get((kind, ip), ()) if now - t < window]
        ok = len(lst) < limit
        if ok:
            lst.append(now)
        RATES[(kind, ip)] = lst
        return ok


def is_paused(ip):
    with LIMIT_LOCK:
        until = PAUSES.get(ip)
        if until is None:
            return False
        if time.monotonic() < until:
            return True
        del PAUSES[ip]
        return False


def note_miss(ip, code):
    """Notes that `ip` asked for a well-formed code that does not exist; True
    once it has asked for more than MISS_IP different ones within a minute, and
    from then on it is refused for MISS_PAUSE seconds. The same dead code asked
    again does not count: a client whose room has run out asks every three
    seconds, and that is no guessing. Raises TableFull for a new sender when
    the table is full."""
    now = time.monotonic()
    with LIMIT_LOCK:
        if not _room_in_table(MISSES, ip, now):
            raise TableFull()
        seen = MISSES.setdefault(ip, {})
        for c in [c for c, t in seen.items() if now - t >= 60]:
            del seen[c]
        seen.setdefault(code, now)
        if len(seen) > MISS_IP:
            PAUSES[ip] = now + MISS_PAUSE
            seen.clear()
            return True
    return False


def _prune(now):
    """Drops every counter whose own window has passed. Call with LIMIT_LOCK held."""
    _last_prune[0] = now
    for key in [k for k, lst in RATES.items()
                if not lst or now - lst[-1] >= RATE_WINDOWS.get(k[0], 3600)]:
        del RATES[key]
    for ip in [ip for ip, seen in MISSES.items() if all(now - t >= 60 for t in seen.values())]:
        del MISSES[ip]
    for ip in [ip for ip, until in PAUSES.items() if now >= until]:
        del PAUSES[ip]


def prune_limits():
    with LIMIT_LOCK:
        _prune(time.monotonic())


def clean_name(v, n=40):
    """A name as the board shows it: text only, no control characters, at most n long."""
    if not isinstance(v, str):
        return ""
    return "".join(ch for ch in v if ch.isprintable()).strip()[:n].strip()


def clean_code(v):
    return v.strip().upper()[:8] if isinstance(v, str) else ""


def valid_code(code):
    return len(code) == CODE_LEN and all(ch in CODE_ALPHABET for ch in code)


def clean_weapons(w):
    """The two weapon keys, relayed untouched when they look like that; otherwise none."""
    if isinstance(w, list) and len(w) <= 2 and all(isinstance(x, str) and len(x) <= 32 for x in w):
        return list(w)
    return []


def num(v):
    """A number the board may add up; anything else counts as zero."""
    if isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf"):
        return v
    return 0


def text(v, n):
    return v[:n] if isinstance(v, str) else ""


def add_member(room, name, entry):
    """Stores `entry` as `name` in `room`, replacing a row. Call with LOCK held."""
    old = room["members"].get(name)
    if old is None:
        STATS["members"] += 1
    else:
        STATS["bytes"] -= old.get("size", 0)
    room["members"][name] = entry
    STATS["bytes"] += entry.get("size", 0)


def drop_member(room, name):
    """Removes `name` from `room`. Call with LOCK held."""
    old = room["members"].pop(name, None)
    if old is not None:
        STATS["members"] -= 1
        STATS["bytes"] -= old.get("size", 0)
    return old


def drop_room(code):
    """Removes a room and everything counted for it. Call with LOCK held."""
    room = ROOMS.pop(code, None)
    if room is not None:
        STATS["members"] -= len(room["members"])
        STATS["bytes"] -= sum(e.get("size", 0) for e in room["members"].values())


def make_code(owner=""):
    with LOCK:
        if len(ROOMS) >= MAX_ROOMS:
            raise ServerFull()
        for _ in range(50):
            code = "".join(random.choice(CODE_ALPHABET) for _ in range(CODE_LEN))
            if code not in ROOMS:
                # the creator's name is the only claim to being the host this
                # server has — rooms are otherwise anonymous, and a removal
                # anyone could perform would be worse than none at all
                ROOMS[code] = {"created": time.time(), "owner": owner,
                               "members": {}, "kicked": {}}
                return code
    raise ServerFull()


def has_seat(room, name, now):
    """Whether `name` may hold a row in `room`. Call with LOCK held."""
    members = room["members"]
    if name in members or len(members) < MAX_MEMBERS:
        return True
    # a full room first lets go of whoever has stopped reporting: they are
    # already off the board, and holding their seat would lock out the people
    # who are actually there
    for n in [n for n, e in members.items() if now - e["ts"] >= REPORT_TTL]:
        drop_member(room, n)
    return len(members) < MAX_MEMBERS


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
        target = text((e["payload"] or {}).get("target"), 200)
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
        num((e["payload"] or {}).get("damage")) for _, e in keep if e["payload"]
    ) or 1

    board = []
    for name, e in keep:
        p = e["payload"] or {}
        is_on_target = bool(p) and text(p.get("target"), 200) == target
        board.append({
            "name": name,
            "waiting": not e["payload"],
            "damage": num(p.get("damage")), "dps": num(p.get("dps")), "hits": num(p.get("hits")),
            "crit": num(p.get("crit")), "heavy": num(p.get("heavy")), "seconds": num(p.get("seconds")),
            "max": num(p.get("max")),
            # Twelve, as many as a member's curve has lanes: whatever is
            # cut here lands in the reader's pooled "everything else" lane.
            "skills": p["skills"][:12] if isinstance(p.get("skills"), list) else [],
            # Only whether there is a curve to look at, never the curve
            # itself. A finished fight's curve is around 13 kB, and every
            # push hands the whole board back to whoever pushed: measured
            # on this server, six members at the end of a fight downloaded
            # 81.7 kB each time, twelve members 174.9 kB — for data almost
            # nobody was reading. Whoever actually opens someone else's
            # timeline asks /party/curve once, for that one member.
            "hasCurve": isinstance(p.get("curve"), dict) and bool(p["curve"].get("T")),
            "share": (num(p.get("damage")) / reporting_total) if p else 0,
            "onTarget": is_on_target,
            # what this member is actually fighting, so a board can say so
            # rather than only that it is not what everyone else is on
            "target": text(p.get("target"), 200),
            # which language their skill names are in — the board is where the
            # same id turns up under two spellings, and that pair is what lets
            # a client learn a translation instead of guessing one
            "lang": text(p.get("lang"), 16),
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
        sweep_once()


def sweep_once():
    prune_limits()
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
        # a public instance also lets go of a room that has lived long
        # enough, however busy: a room kept alive for ever would hold its
        # memory for ever, and starting a new one is one button
        if ROOM_MAX_AGE:
            dead += [code for code, room in ROOMS.items()
                     if now - room["created"] > ROOM_MAX_AGE and code not in dead]
        for code in dead:
            drop_room(code)


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "BoroPartyServer/1"
    # socket timeout for every read and write on the connection (see
    # REQUEST_TIMEOUT); an idle keep-alive connection is closed by it too
    timeout = REQUEST_TIMEOUT

    def log_message(self, *args):
        pass  # keep the service log to real errors only

    def _json(self, obj, code=200, close=False, cors=True):
        self._answered = True
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        if cors:
            self.send_header("Access-Control-Allow-Origin", "*")
        if close:
            # whatever is left of the request body was never read, so this
            # connection cannot carry another request; send_header also sets
            # close_connection
            self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def _client_ip(self):
        ip = self.client_address[0]
        if ip == TRUSTED_PROXY:
            via = (self.headers.get("X-Forwarded-For") or "").split(",")[-1].strip()
            if via:
                return via
        return ip

    def _gilde(self, methode, parts, sent):
        # no CORS header on purpose: only Boro itself talks to the guild routes
        status, body = boro_gilde.behandle(GILDEN, methode, parts.path, urllib.parse.parse_qs(parts.query),
                                           self.headers, sent, self._client_ip())
        self._json(body, status, cors=False)

    def _sender(self):
        return sender_key(self._client_ip())

    def _unknown(self, code):
        """The answer for a code no room has. A well-formed code that is asked
        for among many different ones is somebody guessing: see note_miss."""
        try:
            guessing = valid_code(code) and note_miss(self._sender(), code)
        except TableFull:
            self._json({"ok": False, "error": "busy"}, 503)
            return
        if guessing:
            self._json({"ok": False, "error": "slow down"}, 429)
            return
        self._json({"ok": False, "error": "unknown code"}, 404)

    def _run(self, handle):
        """Admission, then the route. A failure inside a route is answered, not
        left as a dropped connection, and logged without anything a member sent."""
        self._answered = False
        ip = self._sender()
        party = self.path.startswith("/party/")
        admitted = False
        try:
            if party:
                # refused before anything of the body is read; a refusal ends the connection
                try:
                    refuse = is_paused(ip) or not rate_ok("req", ip, RATE_IP, 60)
                except TableFull:
                    self._json({"ok": False, "error": "busy"}, 503, close=True)
                    return
                if refuse:
                    self._json({"ok": False, "error": "slow down"}, 429, close=True)
                    return
                with LIMIT_LOCK:
                    if INFLIGHT.get(ip, 0) >= CONN_IP:
                        busy = True
                    else:
                        INFLIGHT[ip] = INFLIGHT.get(ip, 0) + 1
                        busy = False
                if busy:
                    self._json({"ok": False, "error": "busy"}, 503, close=True)
                    return
                admitted = True
            handle()
        except (ConnectionError, TimeoutError):
            self.close_connection = True
        except Exception as exc:
            tb = exc.__traceback__
            while tb is not None and tb.tb_next is not None:
                tb = tb.tb_next
            sys.stderr.write("handler error: %s at line %d\n" % (type(exc).__name__, tb.tb_lineno if tb else 0))
            self.close_connection = True
            if not self._answered:
                try:
                    self._json({"ok": False, "error": "internal"}, 500, close=True)
                except Exception:
                    pass
        finally:
            if admitted:
                with LIMIT_LOCK:
                    INFLIGHT[ip] = INFLIGHT.get(ip, 1) - 1
                    if INFLIGHT[ip] <= 0:
                        del INFLIGHT[ip]

    # ---------------------------------------------------------------- GET
    def do_GET(self):
        if TEST_FEHLER and self.path == "/party/_entkommt":
            raise ValueError("Geheim-Text " + self.client_address[0])   # escapes _run, ends in Server.handle_error
        self._run(self._get)

    def _get(self):
        parts = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(parts.query)

        if TEST_FEHLER and parts.path == "/party/_fehler":
            raise RuntimeError("Geheim-Text " + self.client_address[0])

        if parts.path.startswith("/gilde/"):
            if GILDEN is None:
                self._json({"ok": False}, 404, cors=False)
                return
            self._gilde("GET", parts, {})
            return

        if parts.path == "/health":
            with LOCK:
                out = {"ok": True, "rooms": len(ROOMS), "members": STATS["members"], "bytes": STATS["bytes"]}
            with LIMIT_LOCK:
                out["absender"] = len(RATES)
                out["anfragen"] = sum(INFLIGHT.values())
            out["verbindungen"] = CONNS[0]
            out["speicherKB"] = memory_kb()
            out["last1"] = load_1min()
            if PROFIL:
                out["profil"] = PROFIL
            self._json(out)
            return

        code = clean_code((q.get("code", [""])[0] or ""))
        with LOCK:
            exists = code in ROOMS

        if parts.path == "/party/ping":
            if not exists:
                self._unknown(code)
                return
            name = clean_name(q.get("name", [""])[0] or "")
            if name:
                with LOCK:
                    room = ROOMS.get(code)
                    now = time.time()
                    if (room is not None and name not in room["members"]
                            and STATS["members"] < MAX_MEMBERS_TOTAL
                            and has_seat(room, name, now)):
                        add_member(room, name, {"payload": None, "ts": now})
            self._json({"ok": True})
            return

        if parts.path == "/party/board":
            if not exists:
                self._unknown(code)
                return
            board, target = build_board(code)
            if board is None:
                self._unknown(code)
                return
            self._json({"ok": True, "board": board, "target": target})
            return

        if parts.path == "/party/curve":
            # One member's curve and casts, asked for by name, when somebody
            # actually looks at their timeline. Relayed untouched like every
            # other part of a report — the server still does not read it.
            if not exists:
                self._unknown(code)
                return
            who = clean_name(q.get("name", [""])[0] or "")
            with LOCK:
                room = ROOMS.get(code) or {}
                entry = (room.get("members") or {}).get(who) or {}
            p = entry.get("payload") or {}
            if not (isinstance(p.get("curve"), dict) and p["curve"].get("T")):
                self._json({"ok": False, "error": "no curve"}, 404)
                return
            self._json({"ok": True, "name": who, "curve": p.get("curve"),
                        "casts": p.get("casts")})
            return

        self._json({"ok": False}, 404)

    # --------------------------------------------------------------- POST
    def do_POST(self):
        self._run(self._post)

    def _post(self):
        parts = urllib.parse.urlparse(self.path)
        if TEST_FEHLER and parts.path == "/party/_fehler":
            raise RuntimeError("Geheim-Text " + self.client_address[0])
        if parts.path.startswith("/gilde/") and GILDEN is None:
            self._json({"ok": False}, 404, close=True, cors=False)
            return
        # The length is checked before anything is read. Plain ASCII digits
        # only: int() would also take "-1" (read to the end of the stream),
        # "+5", " 5" or other scripts' digits.
        raw = self.headers.get("Content-Length")
        if raw is None:
            self._json({"ok": False, "error": "length required"}, 411, close=True)
            return
        raw = raw.strip()
        if not raw or not raw.isascii() or not raw.isdigit():
            self._json({"ok": False, "error": "bad request"}, 400, close=True)
            return
        length = int(raw)
        if length > (boro_gilde.max_body(parts.path) if parts.path.startswith("/gilde/") else MAX_BODY):
            self._json({"ok": False, "error": "too large"}, 413, close=True)
            return
        try:
            data = self.rfile.read(length)
        except TimeoutError:
            # the sender stalled mid-body; nothing to answer, just let go
            self.close_connection = True
            return
        try:
            sent = json.loads(data.decode("utf-8") or "{}")
            if not isinstance(sent, dict):
                raise ValueError("not an object")
        except Exception:
            self._json({"ok": False, "error": "bad request"}, 400, close=len(data) < length)
            return

        if parts.path.startswith("/gilde/"):
            self._gilde("POST", parts, sent)
            return

        if parts.path == "/party/create":
            name = clean_name(sent.get("name")) or "Host"
            try:
                allowed = rate_ok("create", self._sender(), CREATE_IP, 3600)
            except TableFull:
                self._json({"ok": False, "error": "busy"}, 503)
                return
            if not allowed:
                self._json({"ok": False, "error": "too many rooms"}, 429)
                return
            try:
                code = make_code(name)
            except ServerFull:
                self._json({"ok": False, "error": "server full"}, 503)
                return
            self._json({"ok": True, "code": code})
            return

        code = clean_code(sent.get("code"))
        with LOCK:
            room_exists = code in ROOMS
        if not room_exists:
            self._unknown(code)
            return

        if parts.path == "/party/push":
            name = clean_name(sent.get("name"))
            if not name:
                self._json({"ok": False, "error": "no name"}, 400)
                return
            payload = sent.get("payload")
            if payload is not None and not isinstance(payload, dict):
                self._json({"ok": False, "error": "bad request"}, 400)
                return
            now = time.time()
            refused = None
            with LOCK:
                room = ROOMS.get(code)
                if room is None:
                    refused = (404, {"ok": False, "error": "unknown code"})
                else:
                    until = (room.get("kicked") or {}).get(name, 0)
                    old = room["members"].get(name)
                    if now < until:
                        # answered rather than ignored, so the client can say what
                        # happened instead of quietly showing an empty board
                        refused = (403, {"ok": False, "error": "removed", "kicked": True})
                    elif not has_seat(room, name, now):
                        refused = (409, {"ok": False, "error": "room full"})
                    elif ((old is None and STATS["members"] >= MAX_MEMBERS_TOTAL)
                          or STATS["bytes"] - (old or {}).get("size", 0) + self._body_len > MAX_BYTES):
                        refused = (503, {"ok": False, "error": "server full"})
                    else:
                        # weapons ride beside the payload, not inside it: a member
                        # who has not finished a pull yet has no payload at all,
                        # and a party wants to see who tanks and who heals BEFORE
                        # the pull. A client too old to send them leaves the field
                        # absent and its row simply has no build.
                        add_member(room, name, {"ventius": bool(sent.get("ventius")),
                                                "payload": payload,
                                                "weapons": clean_weapons(sent.get("weapons")),
                                                "size": self._body_len,
                                                "ts": now})
            if refused:
                self._json(refused[1], refused[0])
                return
            board, target = build_board(code)
            self._json({"ok": True, "board": board or [], "target": target})
            return

        if parts.path == "/party/rename":
            # Jemand hat den Charakter gewechselt. Die Zeile zieht um, statt
            # dass eine zweite daneben auftaucht - und wenn der Umziehende
            # den Raum angelegt hat, zieht der Besitz mit. Sonst gehoerte der
            # Raum einem Namen, unter dem niemand mehr postet, und sein
            # Gastgeber koennte aus seinem eigenen Raum niemanden entfernen.
            old = clean_name(sent.get("name"))
            new = clean_name(sent.get("to"))
            if not old or not new:
                self._json({"ok": False, "error": "no name"}, 400)
                return
            with LOCK:
                room = ROOMS.get(code)
                if room is None:
                    self._json({"ok": False, "error": "unknown code"}, 404)
                    return
                if new != old and new in room["members"]:
                    self._json({"ok": False, "error": "name taken"}, 409)
                    return
                entry = room["members"].get(old)
                if entry is not None and new != old:
                    # the row moves, so its size stays counted
                    del room["members"][old]
                    room["members"][new] = entry
                if (room.get("owner") or "") == old:
                    room["owner"] = new
            board, target = build_board(code)
            self._json({"ok": True, "board": board or [], "target": target})
            return

        if parts.path == "/party/kick":
            asker = clean_name(sent.get("name"))
            who = clean_name(sent.get("who"))
            if not asker or not who:
                self._json({"ok": False, "error": "no name"}, 400)
                return
            with LOCK:
                room = ROOMS.get(code)
                if room is None:
                    self._json({"ok": False, "error": "unknown code"}, 404)
                    return
                owner = room.get("owner") or ""
                # only whoever created the room, and never themselves: a host
                # removing the host leaves a room nobody can manage
                if owner and asker != owner:
                    self._json({"ok": False, "error": "not the host"}, 403)
                    return
                if who == asker:
                    self._json({"ok": False, "error": "cannot remove yourself"}, 400)
                    return
                drop_member(room, who)
                room.setdefault("kicked", {})[who] = time.time() + KICK_PAUSE
            board, target = build_board(code)
            self._json({"ok": True, "board": board or [], "target": target})
            return

        self._json({"ok": False}, 404)

    @property
    def _body_len(self):
        try:
            return int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return 0


def memory_kb():
    """The most resident memory this process has had, in kB; 0 where there is no resource module.
    The peak, not the current value: it never goes down, which suits a load test that must stop
    in time, and reading the current one would mean opening a file, which this server never does."""
    try:
        import resource
        kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return int(kb // 1024) if sys.platform == "darwin" else int(kb)
    except (ImportError, OSError, ValueError):
        return 0


def load_1min():
    try:
        return round(os.getloadavg()[0], 2)
    except (AttributeError, OSError):
        return 0.0


BUSY_BODY = b'{"ok": false, "error": "busy"}'
BUSY_ANSWER = (b"HTTP/1.1 503 Service Unavailable\r\nContent-Type: application/json\r\n"
               b"Content-Length: " + str(len(BUSY_BODY)).encode() + b"\r\nRetry-After: 5\r\nConnection: close\r\n\r\n" + BUSY_BODY)


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True

    def process_request(self, request, client_address):
        # Over the limit of connections at once: answered here, without a
        # thread, so a flood costs one short write each and not a thread each.
        with CONN_LOCK:
            full = CONNS[0] >= CONN_MAX
            if not full:
                CONNS[0] += 1
        if full:
            try:
                request.settimeout(1)
                request.sendall(BUSY_ANSWER)
            except OSError:
                pass
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            with CONN_LOCK:
                CONNS[0] -= 1
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            with CONN_LOCK:
                CONNS[0] -= 1

    def handle_error(self, request, client_address):
        # A client closing its connection mid-request — the app was closed,
        # the network blipped, the machine went to sleep — is normal and
        # happens constantly on a public party server. It is not a bug, so
        # it should not spam the journal with a full traceback every time.
        # Anything else is logged as the kind of error and the line it came
        # from, nothing more: the default writes the whole traceback and the
        # client's address, and an exception's text can carry what a sender
        # typed. This server keeps no names and no addresses in its log.
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionResetError, BrokenPipeError,
                            ConnectionAbortedError, TimeoutError)):
            return
        tb = exc.__traceback__ if exc is not None else None
        while tb is not None and tb.tb_next is not None:
            tb = tb.tb_next
        sys.stderr.write("server error: %s at line %d\n" % (type(exc).__name__, tb.tb_lineno if tb else 0))


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
