"""
Gilde store for the Boro Party Server (issue #229, spec
docs/superpowers/specs/2026-10-12-gilde-online-design.md).

A guild lives on disk: one folder per guild holding meta.json, one file per
accepted state (v000001.json, v000002.json, ...), marken.json (named states)
and archiv/. The server never reads a state beyond its size, its being a JSON
object and the version it is written against: what the Boro clients put in is
what the Boro clients get out. Keys are kept only as SHA-256 hashes and
compared in constant time, the guild code only as the name of its folder.

Nothing is ever deleted - with one exception (issue #240): the lead can delete a
guild that was closed for good (loeschen), and that is the only place anything is
removed (_entfernen). Restoring an old state writes it as a new one,
ageing moves files into archiv/, closing a guild and revoking a link only
set a flag. A closed guild answers everyone with 410 "closed" (the clients say
so in plain words instead of showing an error); only the lead key can open it
again, and nothing in it has changed meanwhile.

Roles: whoever has the guild code reads; a link key (one per person, made by
the lead) also writes the state; the lead key also manages links, looks at
and restores earlier states, names states and closes the guild.
"""

import hashlib
import hmac
import json
import os
import secrets
import threading
import time

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # no 0/O, no 1/I
CODE_LEN = 12
KEY_LEN = 26
# A state is at most 2 MiB of text (the client's own limit) plus the envelope.
MAX_STAND = 2359296
MAX_KLEIN = 4096
MAX_LINKS = 30                  # links that are not revoked
MAX_STAENDE_LISTE = 200         # states the list answer names (newest), plus every named one
MAX_STAENDE = 500              # states kept in the guild folder; older ones move to archiv/
ALTER_TAGE = 90
MAX_GILDEN = int(os.environ.get("BORO_GILDE_MAX", "50"))
SCHREIB_JE_GILDE = 20           # per minute
SCHREIB_JE_IP = 60              # per minute
LESEN_JE_IP_CODE = 60           # per minute
FEHL_JE_IP = 10                 # failed attempts per minute, then a pause
FEHL_PAUSE = 300
NEU_JE_IP = 5                   # new guilds per hour


class GildeFehler(Exception):
    def __init__(self, status, text):
        super().__init__(text)
        self.status = status
        self.text = text


def max_body(path):
    """The largest body a /gilde/ route accepts; checked before anything is read."""
    return MAX_STAND if path in ("/gilde/stand", "/gilde/neu") else MAX_KLEIN


def _hash(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _gleich(a, b):
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def _zufall(n):
    return "".join(secrets.choice(ALPHABET) for _ in range(n))


def _schreibe(pfad, daten):
    tmp = pfad + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(daten, f, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, pfad)


def _lies(pfad):
    with open(pfad, "r", encoding="utf-8") as f:
        return json.load(f)


def _entfernen(ordner):
    """The one place that removes files: the folder of one closed guild, after its lead asked for it (issue #240)."""
    for wurzel, unterordner, dateien in os.walk(ordner, topdown=False):
        for d in dateien:
            os.remove(os.path.join(wurzel, d))
        for o in unterordner:
            os.rmdir(os.path.join(wurzel, o))
    os.rmdir(ordner)


class GildenSpeicher:
    def __init__(self, ordner, test_uhr=False):
        self.dir = ordner
        os.makedirs(ordner, exist_ok=True)
        self.lock = threading.RLock()
        self.versatz = 0.0           # the clock offset only a test may move
        self.wand = 0.0              # a test may also step the wall clock alone (as NTP or WSL do)
        self.test_uhr = test_uhr
        self.raten = {}              # (art, key) -> [timestamps]
        self.pause_bis = {}          # ip -> time

    # ------------------------------------------------------------ helpers
    def jetzt(self):
        """Wall-clock time: only for what is stored (zeit, erstellt) and the age of states."""
        return time.time() + self.versatz + self.wand

    def takt(self):
        """Monotonic time for rate windows and pauses. The wall clock can step back (NTP on a
        server, WSL every few seconds); counted on it, calls of the last minute counted again
        and a pause could last hours (#224)."""
        return time.monotonic() + self.versatz

    def _uhr_vor(self, sekunden, wand=0):
        if not self.test_uhr:
            raise GildeFehler(404, "not found")
        self.versatz += float(sekunden)
        self.wand += float(wand)

    def _rate(self, art, schluessel, grenze, fenster, zaehlen=True):
        """True when the call is within `grenze` per `fenster` seconds."""
        jetzt = self.takt()
        liste = [t for t in self.raten.get((art, schluessel), []) if jetzt - t < fenster]
        if len(liste) >= grenze:
            self.raten[(art, schluessel)] = liste
            return False
        if zaehlen:
            liste.append(jetzt)
        self.raten[(art, schluessel)] = liste
        return True

    def _pause_pruefen(self, ip):
        if self.takt() < self.pause_bis.get(ip, float("-inf")):
            raise GildeFehler(429, "slow down")

    def _fehlversuch(self, ip):
        self._rate("fehl", ip, 10 ** 9, 60)
        if len(self.raten[("fehl", ip)]) >= FEHL_JE_IP:
            self.pause_bis[ip] = self.takt() + FEHL_PAUSE
            self.raten[("fehl", ip)] = []

    def _ordner(self, code):
        return os.path.join(self.dir, _hash(code)[:32])

    def _meta_pfad(self, ordner):
        return os.path.join(ordner, "meta.json")

    def _gilde(self, code, ip, geschlossen_ok=False):
        """Opens the guild for `code`, or counts a failed attempt and says 404.
        A closed guild says 410 (not a failed attempt: the code is right) unless the call may see it closed."""
        self._pause_pruefen(ip)
        code = (code or "").strip().upper()
        ordner = self._ordner(code) if len(code) == CODE_LEN and all(c in ALPHABET for c in code) else None
        if ordner is None or not os.path.isfile(self._meta_pfad(ordner)):
            self._fehlversuch(ip)
            raise GildeFehler(404, "unknown code")
        meta = _lies(self._meta_pfad(ordner))
        if meta.get("geschlossen") and not geschlossen_ok:
            raise GildeFehler(410, "closed")
        return code, ordner, meta

    def _rolle(self, meta, key, ip):
        """('lesen'|'bearbeiter'|'lead', link-or-None). A wrong key counts as a failed attempt."""
        if not key:
            return "lesen", None
        if _gleich(_hash(key), meta["lead"]):
            return "lead", None
        for lid, link in meta["links"].items():
            if _gleich(_hash(key), link["hash"]):
                if link.get("widerrufen"):
                    self._fehlversuch(ip)
                    raise GildeFehler(403, "revoked")
                return "bearbeiter", dict(link, id=lid)
        self._fehlversuch(ip)
        raise GildeFehler(403, "wrong key")

    def _nur(self, rolle, *erlaubt):
        if rolle not in erlaubt:
            raise GildeFehler(403, "not allowed")

    def _stand_pfad(self, ordner, n):
        name = "v%06d.json" % n
        p = os.path.join(ordner, name)
        if os.path.isfile(p):
            return p
        a = os.path.join(ordner, "archiv", name)
        return a if os.path.isfile(a) else None

    def _speichere_stand(self, ordner, meta, stand, von):
        n = meta["v"] + 1
        zeit = int(self.jetzt())
        _schreibe(os.path.join(ordner, "v%06d.json" % n), {"v": n, "zeit": zeit, "von": von, "stand": stand})
        meta["v"] = n
        meta["staende"].append({"v": n, "zeit": zeit, "von": von})
        _schreibe(self._meta_pfad(ordner), meta)
        self._altern(ordner, meta)
        return n

    def _marken(self, ordner):
        p = os.path.join(ordner, "marken.json")
        return _lies(p) if os.path.isfile(p) else {}

    def _altern(self, ordner, meta):
        """Moves old states into archiv/, never a named one and never the newest."""
        marken = self._marken(ordner)
        grenze = self.jetzt() - ALTER_TAGE * 86400
        offen = [s for s in meta["staende"] if os.path.isfile(os.path.join(ordner, "v%06d.json" % s["v"]))]
        zuviel = max(0, len(offen) - MAX_STAENDE)
        for i, s in enumerate(offen[:-1]):
            if str(s["v"]) in marken:
                continue
            if i < zuviel or s["zeit"] < grenze:
                os.makedirs(os.path.join(ordner, "archiv"), exist_ok=True)
                os.replace(os.path.join(ordner, "v%06d.json" % s["v"]), os.path.join(ordner, "archiv", "v%06d.json" % s["v"]))

    def _stand_ok(self, stand):
        if not isinstance(stand, dict):
            raise GildeFehler(400, "bad request")
        if len(json.dumps(stand, ensure_ascii=False).encode("utf-8")) > MAX_STAND:
            raise GildeFehler(413, "too large")

    # --------------------------------------------------------------- calls
    def neu(self, ip, name, stand):
        with self.lock:
            self._stand_ok(stand)
            name = (name or "")[:60] if isinstance(name, str) else ""
            if not self._rate("neu", ip, NEU_JE_IP, 3600):
                raise GildeFehler(429, "too many new guilds")
            if len([d for d in os.listdir(self.dir) if os.path.isfile(os.path.join(self.dir, d, "meta.json"))]) >= MAX_GILDEN:
                raise GildeFehler(429, "server full")
            code = lead = ordner = None
            for _ in range(50):
                code = _zufall(CODE_LEN)
                ordner = self._ordner(code)
                if not os.path.exists(ordner):
                    break
            else:
                raise GildeFehler(500, "no free code")
            lead = _zufall(KEY_LEN)
            os.makedirs(ordner)
            meta = {"name": name, "lead": _hash(lead), "links": {}, "v": 0, "staende": [],
                    "geschlossen": False, "erstellt": int(self.jetzt())}
            n = self._speichere_stand(ordner, meta, stand, "lead")
            return code, lead, n

    def lesen(self, code, key, ip, seen=None, v=None):
        with self.lock:
            code, ordner, meta = self._gilde(code, ip)
            if not self._rate("lesen", (ip, code), LESEN_JE_IP_CODE, 60):
                raise GildeFehler(429, "slow down")
            rolle, link = self._rolle(meta, key, ip)
            if v is not None:
                self._nur(rolle, "lead")
                p = self._stand_pfad(ordner, v)
                if p is None:
                    raise GildeFehler(404, "no such state")
                d = _lies(p)
                return {"v": d["v"], "stand": d["stand"], "zeit": d["zeit"], "von": d["von"]}
            antwort = {"v": meta["v"], "rolle": rolle}
            if link:
                antwort["label"] = link["label"]
            if seen is not None and seen == meta["v"]:
                antwort["unchanged"] = True
                return antwort
            d = _lies(self._stand_pfad(ordner, meta["v"]))
            antwort["stand"] = d["stand"]
            antwort["geschrieben"] = {"zeit": d["zeit"], "von": d["von"]}
            return antwort

    def schreiben(self, code, key, base, stand, ip):
        with self.lock:
            code, ordner, meta = self._gilde(code, ip)
            rolle, link = self._rolle(meta, key, ip)
            self._nur(rolle, "lead", "bearbeiter")
            if not self._rate("schreib-ip", ip, SCHREIB_JE_IP, 60) or not self._rate("schreib", code, SCHREIB_JE_GILDE, 60):
                raise GildeFehler(429, "slow down")
            self._stand_ok(stand)
            if not isinstance(base, int) or isinstance(base, bool):
                raise GildeFehler(400, "bad request")
            if base != meta["v"]:
                d = _lies(self._stand_pfad(ordner, meta["v"]))
                return ("konflikt", meta["v"], d["stand"])
            von = link["id"] if link else "lead"
            return ("ok", self._speichere_stand(ordner, meta, stand, von), None)

    def link_neu(self, code, key, label, ip):
        with self.lock:
            code, ordner, meta = self._gilde(code, ip)
            self._nur(self._rolle(meta, key, ip)[0], "lead")
            if not isinstance(label, str) or not 1 <= len(label.strip()) <= 40:
                raise GildeFehler(400, "bad request")
            if len([1 for l in meta["links"].values() if not l.get("widerrufen")]) >= MAX_LINKS:
                raise GildeFehler(409, "too many links")
            lid = "l" + _zufall(7)
            schluessel = _zufall(KEY_LEN)
            meta["links"][lid] = {"label": label.strip(), "hash": _hash(schluessel), "zeit": int(self.jetzt()), "widerrufen": False}
            _schreibe(self._meta_pfad(ordner), meta)
            return lid, schluessel

    def link_widerruf(self, code, key, lid, ip):
        with self.lock:
            code, ordner, meta = self._gilde(code, ip)
            self._nur(self._rolle(meta, key, ip)[0], "lead")
            if lid not in meta["links"]:
                raise GildeFehler(404, "no such link")
            meta["links"][lid]["widerrufen"] = True
            _schreibe(self._meta_pfad(ordner), meta)

    def links(self, code, key, ip):
        with self.lock:
            code, ordner, meta = self._gilde(code, ip)
            self._nur(self._rolle(meta, key, ip)[0], "lead")
            return [{"id": lid, "label": l["label"], "zeit": l["zeit"], "widerrufen": bool(l.get("widerrufen"))}
                    for lid, l in meta["links"].items()]

    def staende(self, code, key, ip):
        with self.lock:
            code, ordner, meta = self._gilde(code, ip)
            self._nur(self._rolle(meta, key, ip)[0], "lead")
            marken = self._marken(ordner)
            alle = meta["staende"]
            # Only the answer is cut: meta["staende"] and the state files stay untouched.
            neu = {s["v"] for s in alle[-MAX_STAENDE_LISTE:]}
            gezeigt = [s for s in alle if s["v"] in neu or str(s["v"]) in marken]
            liste = [dict(s, marke=marken.get(str(s["v"]), "")) for s in gezeigt]
            return liste, (len(alle) if len(gezeigt) < len(alle) else None)

    def zurueck(self, code, key, v, ip):
        with self.lock:
            code, ordner, meta = self._gilde(code, ip)
            self._nur(self._rolle(meta, key, ip)[0], "lead")
            if not self._rate("schreib", code, SCHREIB_JE_GILDE, 60):
                raise GildeFehler(429, "slow down")
            p = self._stand_pfad(ordner, v) if isinstance(v, int) and not isinstance(v, bool) else None
            if p is None:
                raise GildeFehler(404, "no such state")
            return self._speichere_stand(ordner, meta, _lies(p)["stand"], "lead")

    def marke(self, code, key, v, label, ip):
        with self.lock:
            code, ordner, meta = self._gilde(code, ip)
            self._nur(self._rolle(meta, key, ip)[0], "lead")
            if not isinstance(label, str) or not 1 <= len(label.strip()) <= 60 or not any(s["v"] == v for s in meta["staende"]):
                raise GildeFehler(400, "bad request")
            marken = self._marken(ordner)
            marken[str(v)] = label.strip()
            _schreibe(os.path.join(ordner, "marken.json"), marken)

    def schliessen(self, code, key, ip):
        with self.lock:
            code, ordner, meta = self._gilde(code, ip, geschlossen_ok=True)
            self._nur(self._rolle(meta, key, ip)[0], "lead")
            if not meta.get("geschlossen"):
                meta["geschlossen"] = True
                _schreibe(self._meta_pfad(ordner), meta)

    def loeschen(self, code, key, ip):
        """The lead deletes a guild that is closed: its states, links and names leave this disk. Nothing else is touched."""
        with self.lock:
            code, ordner, meta = self._gilde(code, ip, geschlossen_ok=True)
            self._nur(self._rolle(meta, key, ip)[0], "lead")
            if not meta.get("geschlossen"):
                raise GildeFehler(409, "not closed")
            if os.path.dirname(os.path.abspath(ordner)) != os.path.abspath(self.dir):
                raise GildeFehler(500, "bad folder")
            _entfernen(ordner)

    def oeffnen(self, code, key, ip):
        """The lead opens a closed guild again; states, links and names are as they were."""
        with self.lock:
            code, ordner, meta = self._gilde(code, ip, geschlossen_ok=True)
            self._nur(self._rolle(meta, key, ip)[0], "lead")
            if meta.get("geschlossen"):
                meta["geschlossen"] = False
                _schreibe(self._meta_pfad(ordner), meta)


def _kopf(headers):
    code = headers.get("X-Gilde-Code") or ""
    auth = headers.get("Authorization") or ""
    key = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    return code, key


def _zahl(text):
    try:
        return int(text)
    except (TypeError, ValueError):
        raise GildeFehler(400, "bad request")


def behandle(speicher, methode, pfad, query, headers, sent, ip):
    """One /gilde/ call -> (status, body). `sent` is the parsed JSON body (POST) or {}."""
    code, key = _kopf(headers)
    try:
        if methode == "GET" and pfad == "/gilde/stand":
            seen = _zahl(query["seen"][0]) if "seen" in query else None
            v = _zahl(query["v"][0]) if "v" in query else None
            return 200, dict(speicher.lesen(code, key, ip, seen=seen, v=v), ok=True)
        if methode == "GET" and pfad == "/gilde/links":
            return 200, {"ok": True, "links": speicher.links(code, key, ip)}
        if methode == "GET" and pfad == "/gilde/staende":
            liste, gesamt = speicher.staende(code, key, ip)
            antwort = {"ok": True, "staende": liste}
            if gesamt is not None:
                antwort["gekuerzt"] = gesamt   # total count; absent when nothing was cut
            return 200, antwort
        if methode != "POST":
            return 404, {"ok": False}
        if pfad == "/gilde/neu":
            c, k, n = speicher.neu(ip, sent.get("name"), sent.get("stand"))
            return 200, {"ok": True, "code": c, "leadKey": k, "v": n}
        if pfad == "/gilde/stand":
            r = speicher.schreiben(code, key, sent.get("base"), sent.get("stand"), ip)
            if r[0] == "konflikt":
                return 409, {"ok": False, "error": "stale", "v": r[1], "stand": r[2]}
            return 200, {"ok": True, "v": r[1]}
        if pfad == "/gilde/link":
            lid, k = speicher.link_neu(code, key, sent.get("label"), ip)
            return 200, {"ok": True, "id": lid, "key": k}
        if pfad == "/gilde/link/widerruf":
            speicher.link_widerruf(code, key, sent.get("id"), ip)
            return 200, {"ok": True}
        if pfad == "/gilde/zurueck":
            return 200, {"ok": True, "v": speicher.zurueck(code, key, sent.get("v"), ip)}
        if pfad == "/gilde/marke":
            speicher.marke(code, key, sent.get("v"), sent.get("label"), ip)
            return 200, {"ok": True}
        if pfad == "/gilde/schliessen":
            speicher.schliessen(code, key, ip)
            return 200, {"ok": True}
        if pfad == "/gilde/oeffnen":
            speicher.oeffnen(code, key, ip)
            return 200, {"ok": True}
        if pfad == "/gilde/loeschen":
            speicher.loeschen(code, key, ip)
            return 200, {"ok": True}
        if pfad == "/gilde/_uhr":
            speicher._uhr_vor(sent.get("sekunden", 0), sent.get("wand", 0))
            return 200, {"ok": True}
    except GildeFehler as e:
        return e.status, {"ok": False, "error": e.text}
    return 404, {"ok": False}
