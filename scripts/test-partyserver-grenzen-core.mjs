// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die Grenzen des Gruppenservers (BoroPartyServer/boro_server.py, Issue #310):
// Obergrenzen fuer Raeume, Mitglieder und gespeicherte Bytes, Ratenbegrenzung
// je Absender (mit dem Absender hinter einem Proxy), die Bremse gegen das
// Raten von Codes, Obergrenzen fuer Verbindungen, Formpruefung der Felder,
// ein Fehler im Handler, das Abschalten der Gilde-Pfade, das Hoechstalter
// eines Raums und die neuen Felder in /health. Jeder Fall startet den Server
// mit kleinen Grenzen ueber Umgebungsvariablen, auf einem freien Port von
// 127.0.0.1. Die Standardwerte sind so weit, dass test-partyserver-core.mjs
// unveraendert gruen bleibt. Keine Anfrage verlaesst den Rechner; Namen und
// Zahlen sind erfunden.
//
// Run:  npm run test:partyserver-grenzen-core

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { createServer, connect } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "BoroPartyServer", "boro_server.py");

let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
/* Wartet auf einen Zustand (nie auf eine feste Zeit) und liefert, ob er eintrat. */
const bis = async (bedingung, grenze = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < grenze) { if (await bedingung()) return true; await warte(50); } return false; };

const python = ["python3", "python"].find((p) => spawnSync(p, ["--version"]).status === 0);
if (!python) { console.log("  FAIL  kein python3 gefunden"); process.exit(1); }

/* Weite Standardgrenzen fuer alles, was ein Fall nicht selbst testet; so
   stoert keine Grenze die andere. */
const WEIT = { BORO_RATE_IP: "100000", BORO_CREATE_IP: "100000", BORO_MISS_IP: "100000",
  BORO_CONN_MAX: "1000", BORO_CONN_IP: "1000" };

async function freierPort() {
  return new Promise((resolve) => {
    const s = createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

/* Eine Anfrage als rohe Bytes. Liefert {status, head, body, closed, ms}. */
function roh(port, kopf, rumpf = "", { warteMs = 3000 } = {}) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const sock = connect(port, "127.0.0.1");
    let data = Buffer.alloc(0), fertig = false;
    const ende = (closed) => {
      if (fertig) return;
      fertig = true;
      clearTimeout(uhr);
      sock.destroy();
      const text = data.toString("utf8");
      const m = /^HTTP\/1\.[01] (\d{3})/.exec(text);
      const i = text.indexOf("\r\n\r\n");
      resolve({ status: m ? Number(m[1]) : 0, head: i >= 0 ? text.slice(0, i) : text, body: i >= 0 ? text.slice(i + 4) : "", closed, ms: Math.round(performance.now() - t0) });
    };
    const uhr = setTimeout(() => ende(false), warteMs);
    sock.on("data", (d) => {
      data = Buffer.concat([data, d]);
      const i = data.indexOf("\r\n\r\n"), n = /content-length: *(\d+)/i.exec(data.subarray(0, Math.max(i, 0)).toString());
      if (i >= 0 && n && data.length >= i + 4 + Number(n[1])) ende(/connection: *close/i.test(data.subarray(0, i).toString()));
    });
    sock.on("end", () => ende(true));
    sock.on("close", () => ende(true));
    sock.on("error", () => ende(true));
    sock.write(kopf + "\r\n\r\n");
    if (rumpf) sock.write(rumpf);
  });
}

/* Ein Server mit eigenen Grenzen; liefert die Helfer fuer diesen Port. */
async function starte(env = {}) {
  const port = await freierPort();
  const proc = spawn(python, [script], {
    env: { ...process.env, BORO_PARTY_PORT: String(port), BORO_PARTY_HOST: "127.0.0.1", ...WEIT, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  proc.stderr.on("data", (d) => { stderr += d; });
  const json = (r) => { try { return JSON.parse(r.body); } catch { return null; } };
  const kopfXff = (xff) => (xff ? `\r\nX-Forwarded-For: ${xff}` : "");
  const get = (pfad, xff) => roh(port, `GET ${pfad} HTTP/1.1\r\nHost: x\r\nConnection: close${kopfXff(xff)}`);
  const post = (pfad, objekt, xff) => {
    const b = Buffer.from(typeof objekt === "string" ? objekt : JSON.stringify(objekt), "utf8");
    return roh(port, `POST ${pfad} HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${b.length}${kopfXff(xff)}`, b);
  };
  const health = async () => json(await get("/health"));
  for (let i = 0; i < 60 && !(await health().catch(() => null)); i++) await warte(100);
  return { port, proc, get, post, json, health, stderr: () => stderr, stop: () => proc.kill() };
}

/* Eine Meldung mit einer Nutzlast von etwa `kb` Kilobyte. */
const meldung = (code, name, kb) => ({ code, name, payload: { target: "Ziel", damage: 1, pad: "x".repeat(kb * 1024) }, weapons: ["sword", "dagger"], ventius: false });
const neuerRaum = async (s, name = "Gast", xff) => s.json(await s.post("/party/create", { name }, xff))?.code;

// ------------------------------------------------------------------ Obergrenzen
{
  const s = await starte({ BORO_MAX_ROOMS: "3", BORO_MAX_MEMBERS_TOTAL: "6" });
  try {
    const gesund = await s.health();
    assert(gesund?.ok === true && gesund.rooms === 0, "Server laeuft", { gesund, err: s.stderr() });
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push(await neuerRaum(s, "Gast " + i));
    assert(codes.every((c) => /^[A-Z2-9]{4}$/.test(c || "")), "drei Raeume passen (MAX_ROOMS=3)", codes);
    const vierter = await s.post("/party/create", { name: "Gast 3" });
    assert(vierter.status === 503 && s.json(vierter)?.error === "server full", "der vierte Raum: 503 server full", { status: vierter.status, body: vierter.body });
    assert((await s.health())?.rooms === 3, "der abgewiesene Raum wurde nicht angelegt");

    for (let i = 0; i < 4; i++) await s.post("/party/push", { code: codes[0], name: "A" + i, payload: null });
    for (let i = 0; i < 2; i++) await s.post("/party/push", { code: codes[1], name: "B" + i, payload: null });
    assert((await s.health())?.members === 6, "/health zaehlt 6 Mitglieder", await s.health());
    const zuViel = await s.post("/party/push", { code: codes[2], name: "C0", payload: null });
    assert(zuViel.status === 503 && s.json(zuViel)?.error === "server full", "das 7. Mitglied im ganzen Server: 503 server full", { status: zuViel.status, body: zuViel.body });
    const bleibt = await s.post("/party/push", { code: codes[0], name: "A1", payload: null });
    assert(bleibt.status === 200, "wer schon drin ist, meldet weiter, auch wenn der Server voll ist", bleibt.status);
    const ping = await s.get(`/party/ping?code=${codes[2]}&name=C9`);
    assert(ping.status === 200 && (await s.health())?.members === 6, "/party/ping fuegt einem vollen Server niemanden hinzu");
    const frei = await s.post("/party/kick", { code: codes[0], name: "Gast 0", who: "A3" });
    const danach = await s.post("/party/push", { code: codes[2], name: "C0", payload: null });
    assert(frei.status === 200 && danach.status === 200, "nach einer Entfernung ist wieder Platz", { frei: frei.status, danach: danach.status });
    assert((await s.health())?.members === 6, "die Zaehlung stimmt nach Entfernen und Hinzufuegen", await s.health());
  } finally { s.stop(); }
}

{
  const s = await starte({ BORO_MAX_BYTES: String(100 * 1024) });
  try {
    const code = await neuerRaum(s);
    const eins = await s.post("/party/push", meldung(code, "M1", 30));
    const zwei = await s.post("/party/push", meldung(code, "M2", 30));
    const drei = await s.post("/party/push", meldung(code, "M3", 30));
    assert([eins, zwei, drei].every((r) => r.status === 200), "drei Meldungen zu je 30 kB passen unter 100 kB", [eins.status, zwei.status, drei.status]);
    const bytes = (await s.health())?.bytes;
    assert(bytes > 90 * 1024 && bytes < 100 * 1024, "/health zaehlt die gespeicherten Bytes", bytes);
    const vier = await s.post("/party/push", meldung(code, "M4", 30));
    assert(vier.status === 503 && s.json(vier)?.error === "server full", "die vierte: 503 server full", { status: vier.status, body: vier.body.slice(0, 100) });
    const kleiner = await s.post("/party/push", meldung(code, "M1", 1));
    assert(kleiner.status === 200, "wer schon drin ist, darf seine Meldung durch eine kleinere ersetzen", kleiner.status);
    assert((await s.health())?.bytes < bytes - 25 * 1024, "die Zaehlung folgt der Ersetzung", (await s.health())?.bytes);
    const jetzt = await s.post("/party/push", meldung(code, "M4", 30));
    assert(jetzt.status === 200, "danach passt die vierte", jetzt.status);
    const grosser = await s.post("/party/push", meldung(code, "M2", 60));
    assert(grosser.status === 503, "wer schon drin ist, darf nicht ueber die Grenze wachsen", grosser.status);
  } finally { s.stop(); }
}

// ------------------------------------------------------------------ Rate je Absender
{
  const s = await starte({ BORO_RATE_IP: "30", BORO_CREATE_IP: "3", BORO_MISS_IP: "5" });
  try {
    const code = await neuerRaum(s, "Gast", "10.0.0.1");
    let status = 0, n = 1;
    for (; n < 40 && status !== 429; n++) status = (await s.get(`/party/board?code=${code}`, "10.0.0.2")).status;
    assert(status === 429 && n === 32, "Absender A: ab der 31. Anfrage in einer Minute 429", { status, n });
    assert(s.json(await s.get(`/party/board?code=${code}`, "10.0.0.2"))?.error === "slow down", "die Antwort sagt slow down");
    assert((await s.get(`/party/board?code=${code}`, "10.0.0.3")).status === 200, "Absender B (anderer X-Forwarded-For) ist nicht betroffen");
    assert((await s.get("/health", "10.0.0.2")).status === 200, "/health bleibt auch dem gebremsten Absender offen");
    const post429 = await s.post("/party/push", { code, name: "X", payload: null }, "10.0.0.2");
    assert(post429.status === 429 && post429.closed, "eine gebremste POST-Anfrage wird beantwortet, ohne den Rumpf zu lesen (Verbindung zu)", { status: post429.status, closed: post429.closed });

    // Raeume je Stunde
    const erste = [];
    for (let i = 0; i < 4; i++) erste.push((await s.post("/party/create", { name: "G" }, "10.0.1.1")).status);
    assert(erste.join() === "200,200,200,429", "Absender legt 3 Raeume je Stunde an, der vierte: 429", erste);
    assert((await s.post("/party/create", { name: "G" }, "10.0.1.2")).status === 200, "ein anderer Absender legt weiter Raeume an");

    // Raten von Codes: viele verschiedene unbekannte Codes
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const unbekannt = (i) => "Z" + alphabet[i] + "22";
    const reihe = [];
    for (let i = 0; i < 6; i++) reihe.push((await s.get(`/party/board?code=${unbekannt(i)}`, "10.0.2.1")).status);
    assert(reihe.join() === "404,404,404,404,404,429", "6 verschiedene unbekannte Codes in einer Minute: erst 404, dann 429", reihe);
    const echt = await s.get(`/party/board?code=${code}`, "10.0.2.1");
    assert(echt.status === 429, "danach ist der Absender auch mit einem echten Code gebremst (Pause)", echt.status);
    assert((await s.get(`/party/board?code=${code}`, "10.0.2.2")).status === 200, "ein anderer Absender kommt mit dem echten Code weiter");
    // derselbe tote Code immer wieder (ein Raum ist verfallen, die App fragt alle 3 s): kein Raten, keine Pause
    let ok404 = true;
    for (let i = 0; i < 20; i++) if ((await s.get(`/party/board?code=${unbekannt(9)}`, "10.0.2.3")).status !== 404) { ok404 = false; break; }
    assert(ok404, "derselbe unbekannte Code 20 Mal: immer 404, keine Pause");
  } finally { s.stop(); }
}

{
  // ein Absender hinter einem Proxy, dem der Server nicht traut: ein gefaelschter Kopf zaehlt nicht
  const s = await starte({ BORO_RATE_IP: "10", BORO_TRUSTED_PROXY: "10.9.9.9" });
  try {
    const code = await neuerRaum(s);
    let status = 0, n = 1;
    for (; n < 30 && status !== 429; n++) status = (await s.get(`/party/board?code=${code}`, `10.1.0.${n}`)).status;
    assert(status === 429 && n <= 12, "wechselnde X-Forwarded-For von einer Verbindung, die nicht vom Proxy kommt: zaehlt als ein Absender", { status, n });
  } finally { s.stop(); }
}

// ------------------------------------------------------------------ Verbindungen
{
  // /health meldet, wie viele Anfragen und Verbindungen der Server gerade bedient; darauf wird gewartet, nie auf eine feste Zeit
  const s = await starte({ BORO_CONN_MAX: "7", BORO_CONN_IP: "2" });
  const offen = [];
  const halte = (kopf, rumpf = "", offenerKopf = false) => { const sock = connect(s.port, "127.0.0.1"); sock.on("error", () => {}); sock.write(offenerKopf ? kopf + "\r\n" : kopf + "\r\n\r\n"); if (rumpf) sock.write(rumpf); offen.push(sock); return sock; };
  try {
    const code = await neuerRaum(s);
    // zwei stockende POSTs desselben Absenders (Rumpf angekuendigt, nie fertig)
    const stock = `POST /party/push HTTP/1.1\r\nHost: x\r\nContent-Length: 100\r\nX-Forwarded-For: 10.5.0.1`;
    halte(stock, "{\"code\":"); halte(stock, "{\"code\":");
    assert(await bis(async () => (await s.health())?.anfragen === 2), "/health zaehlt die zwei laufenden Anfragen", await s.health());
    const dritte = await s.post("/party/push", { code, name: "X", payload: null }, "10.5.0.1");
    assert(dritte.status === 503 && s.json(dritte)?.error === "busy", "ein Absender mit 2 stockenden Anfragen: die dritte bekommt 503 busy", { status: dritte.status, body: dritte.body });
    assert((await s.post("/party/push", { code, name: "Y", payload: null }, "10.5.0.2")).status === 200, "ein anderer Absender wird bedient");
    assert((await s.get("/health", "10.5.0.1")).status === 200, "/health ist nie gesperrt");
    // der Server als Ganzes: 7 Verbindungen sind das Hoechste (2 stockende + 5 stille)
    for (let i = 0; i < 4; i++) halte("GET /health HTTP/1.1\r\nHost: x", "", true);   // Kopf unvollstaendig: Verbindung bleibt offen
    assert(await bis(async () => (await s.health())?.verbindungen === 7), "6 gehaltene Verbindungen und die der Abfrage: /health zaehlt 7", await s.health());
    // die Abfrage eben kann auf dem Server noch als Verbindung zaehlen, bis dessen Faden das Ende bemerkt: eine weitere stille Verbindung
    // wird dann abgewiesen und haelt nichts. Darum so lange eine hinzufuegen und abfragen, bis die Abfrage selbst abgewiesen wird.
    let letzte = null;
    assert(await bis(async () => { halte("GET /health HTTP/1.1\r\nHost: x", "", true); letzte = await roh(s.port, "GET /health HTTP/1.1\r\nHost: x\r\nConnection: close"); return letzte.status === 503; }), "bei 7 gehaltenen Verbindungen: die naechste bekommt 503", letzte);
    assert(letzte.ms < 2000, "sofort, ohne Thread und ohne zu warten", letzte.ms);
    assert(/retry-after/i.test(letzte.head), "mit Retry-After", letzte.head);
    offen.forEach((x) => x.destroy());
    assert(await bis(async () => (await s.get("/health")).status === 200), "nach dem Schliessen der Verbindungen antwortet der Server wieder");
    assert(await bis(async () => { const h = await s.health(); return h?.anfragen === 0 && h?.verbindungen === 1; }), "die Zaehler stehen wieder auf null (kein Leck nach Abbruechen)", await s.health());
  } finally { offen.forEach((x) => x.destroy()); s.stop(); }
}

// ------------------------------------------------------------------ Groesse der Zaehltabellen
{
  // der Server selbst, mit kleiner Tabelle: ein Angreifer mit vielen Quelladressen fuellt sie nicht ueber die Grenze
  const s = await starte({ BORO_LIMIT_TABLE_MAX: "40", BORO_RATE_IP: "5" });
  try {
    const code = await neuerRaum(s, "Gast", "10.7.0.1");
    for (let i = 0; i < 6; i++) await s.get(`/party/board?code=${code}`, "10.7.0.1");     // Absender A ist im Limit
    const a = await s.get(`/party/board?code=${code}`, "10.7.0.1");
    assert(a.status === 429, "Absender A ist ueber seinem Limit (429)", a.status);
    const stati = [];
    for (let i = 0; i < 120; i++) stati.push((await s.get(`/party/board?code=${code}`, `10.8.${i >> 8}.${i & 255}`)).status);
    const h = await s.health();
    assert(h.absender <= 40, "die Tabelle waechst nicht ueber die Grenze (BORO_LIMIT_TABLE_MAX=40)", h);
    assert(stati.includes(503) && stati.slice(0, 20).every((x) => x === 200 || x === 429), "neue Absender, wenn sie voll ist: 503 busy, vorher normal", stati.join(","));
    assert((await s.get(`/party/board?code=${code}`, "10.7.0.1")).status === 429, "Absender A wird weiter gezaehlt, nicht vergessen und nicht freigelassen");
    assert((await s.get("/health", "10.9.9.9")).status === 200, "/health bleibt auch bei voller Tabelle offen");
  } finally { s.stop(); }

  // die Funktionen selbst, mit 100000 verschiedenen Absendern
  const dir = join(mkdtempSync(join(tmpdir(), "boro-tabelle-")), "x");
  const py = `
import sys, time
sys.path.insert(0, ${JSON.stringify(join(root, "BoroPartyServer"))})
import boro_server as b
alt = "10.0.0.1"
for i in range(5): b.rate_ok("req", alt, 5, 60)
voll = 0
for i in range(100000):
    try:
        b.rate_ok("req", "198.51.%d.%d" % (i // 250, i % 250) if i < 60000 else "2001:db8:%x::1" % i, 5, 60)
    except b.TableFull:
        voll += 1
    try:
        b.note_miss("203.0.%d.%d" % (i // 250, i % 250), "ABCD")
    except b.TableFull:
        voll += 1
print(len(b.RATES), len(b.MISSES), voll, b.rate_ok("req", alt, 5, 60))
# IPv6: ein /64 ist ein Absender
print(b.sender_key("2001:db8:1:2::1") == b.sender_key("2001:db8:1:2:ffff:ffff:ffff:ffff"),
      b.sender_key("2001:db8:1:2::1") != b.sender_key("2001:db8:1:3::1"),
      b.sender_key("::ffff:192.0.2.7") == "192.0.2.7", b.sender_key("192.0.2.7"), b.sender_key("unsinn:"))
# abgelaufene Zaehler werden nach dem EIGENEN Fenster gefegt
b.RATES.clear(); b.RATES[("req", "a")] = [time.monotonic() - 100]; b.RATES[("create", "a")] = [time.monotonic() - 100]
b.prune_limits()
print(sorted(k[0] for k in b.RATES))
`;
  const r = spawnSync(python, ["-c", py], { env: { ...process.env, BORO_GILDE: "0", BORO_GILDE_DIR: dir, BORO_LIMIT_TABLE_MAX: "1000" }, encoding: "utf8" });
  const zeilen = (r.stdout || "").trim().split(/\r?\n/);
  const [rates, misses, voll, alt] = (zeilen[0] || "").split(" ");
  assert(r.status === 0 && Number(rates) <= 1000 && Number(misses) <= 1000, "100000 verschiedene Absender: jede Tabelle bleibt unter der Grenze", { out: r.stdout, err: r.stderr.slice(-300) });
  assert(Number(voll) > 100000, "die uebrigen Absender werden abgewiesen (TableFull), nicht ungezaehlt durchgelassen", voll);
  assert(alt === "False", "der Absender, der schon zaehlt, bleibt im Limit (Gegenprobe)", alt);
  assert(zeilen[1] === "True True True 192.0.2.7 unsinn:", "IPv6 zaehlt je /64, IPv4-mapped als IPv4", zeilen[1]);
  assert(zeilen[2] === "['create']", "ein abgelaufener req-Zaehler (60 s) ist weg, ein create-Zaehler (3600 s) bleibt", zeilen[2]);
}

// ------------------------------------------------------------------ Formen
{
  const s = await starte();
  try {
    const code = await neuerRaum(s);
    const ok = await s.post("/party/push", { code, name: "Gast\u0000 Eins\n", payload: null, weapons: ["sword", "dagger"] });
    const tafel = s.json(ok)?.board;
    assert(ok.status === 200 && tafel?.[0]?.name === "Gast Eins", "Steuerzeichen im Namen werden entfernt", tafel?.[0]?.name);
    assert(JSON.stringify(tafel?.[0]?.weapons) === '["sword","dagger"]', "zwei kurze Waffennamen gehen durch", tafel?.[0]?.weapons);
    const bunt = [["x".repeat(100), "dagger"], ["a", "b", "c"], "sword", [1, 2], { a: 1 }, null];
    for (const w of bunt) {
      const r = await s.post("/party/push", { code, name: "Waffen", payload: null, weapons: w });
      const reihe = s.json(r)?.board?.find((b) => b.name === "Waffen");
      assert(r.status === 200 && Array.isArray(reihe?.weapons) && reihe.weapons.length === 0, "weapons " + JSON.stringify(w).slice(0, 30) + ": als leere Liste gespeichert", { status: r.status, w: reihe?.weapons });
    }
    assert((await s.post("/party/push", { code, name: "P", payload: [1, 2] })).status === 400, "payload als Liste: 400");
    assert((await s.post("/party/push", { code, name: "P", payload: "text" })).status === 400, "payload als Text: 400");
    assert((await s.post("/party/push", { code: 1234, name: "P", payload: null })).status === 404, "code als Zahl: 404, kein Absturz");
    assert((await s.post("/party/push", { code, name: 5, payload: null })).status === 400, "name als Zahl: 400, kein Absturz");
    assert((await s.post("/party/push", { code: ["A"], name: "P", payload: null })).status === 404, "code als Liste: 404, kein Absturz");

    // ein vergiftetes Mitglied darf die Tafel der anderen nicht kaputtmachen
    const gift = [{ damage: "abc" }, { damage: [1] }, { target: ["x"], damage: 5 }, { skills: { a: 1 }, damage: 5 }, { curve: [1], damage: 5 }, { dps: {}, hits: "7", damage: 5 }];
    for (const [i, p] of gift.entries()) {
      const r = await s.post("/party/push", { code, name: "Gift", payload: p });
      const andere = await s.post("/party/push", { code, name: "Gast Eins", payload: { target: "Ziel", damage: 10 } });
      assert(r.status === 200 && andere.status === 200 && s.json(andere)?.board?.length >= 2, `Nutzlast ${i + 1} mit falschen Typen: Tafel bleibt heil`, { gift: r.status, andere: andere.status, body: andere.body.slice(0, 120) });
    }
    assert((await s.get(`/party/board?code=${code}`)).status === 200, "die Tafel antwortet danach weiter");
  } finally { s.stop(); }
}

// ------------------------------------------------------------------ Fehler im Handler
{
  const s = await starte({ BORO_TEST_FEHLER: "1" });
  try {
    const r = await s.get("/party/_fehler");
    assert(r.status === 500 && s.json(r)?.error === "internal", "ein Fehler im Handler: 500 internal", { status: r.status, body: r.body });
    assert(r.closed, "die Verbindung wird danach geschlossen");
    assert((await s.health())?.ok === true, "der Server antwortet danach weiter");
    const p = await s.post("/party/_fehler", {});
    assert(p.status === 500, "auch in POST", p.status);
    // ein Fehler, der aus dem Handler entkommt und beim Server landet (Server.handle_error)
    const e = await s.get("/party/_entkommt", "10.6.6.6");
    assert(e.status === 0 || e.closed, "ein Fehler, der aus dem Handler entkommt: die Verbindung endet", { status: e.status });
    assert((await s.health())?.ok === true, "der Server antwortet auch danach weiter");
    // Die Ausnahmetexte enthalten "Geheim-Text" und die Adresse der Verbindung. Das Protokoll wird NICHT vorher gefiltert.
    assert(await bis(async () => /server error: ValueError at line \d+/.test(s.stderr())), "das Protokoll nennt Fehlerart und Zeile des entkommenen Fehlers", s.stderr());
    const log = s.stderr();
    assert(/handler error: RuntimeError at line \d+/.test(log), "und die des Fehlers im Handler", log);
    assert(!/Geheim|127\.0\.0\.1|10\.6\.6\.6|Traceback|File "|Gast/.test(log), "im Protokoll steht weder der Ausnahmetext noch eine Adresse noch ein Traceback noch ein Name", log);
  } finally { s.stop(); }
}

// ------------------------------------------------------------------ Gilde aus
{
  const dir = join(mkdtempSync(join(tmpdir(), "boro-grenzen-")), "gilden-nie");
  const s = await starte({ BORO_GILDE: "0", BORO_GILDE_DIR: dir });
  try {
    const g = await s.get("/gilde/neu");
    assert(g.status === 404, "BORO_GILDE=0: /gilde/... antwortet 404", g.status);
    const t0 = performance.now();
    const p = await s.post("/gilde/neu", { name: "Eine Gilde" });
    assert(p.status === 404 && p.closed && performance.now() - t0 < 2000, "BORO_GILDE=0: POST /gilde/... 404, Verbindung zu", { status: p.status, closed: p.closed });
    assert(!existsSync(dir), "es wurde kein Gildenordner angelegt", dir);
    assert((await neuerRaum(s)) !== undefined, "die Gruppe laeuft trotzdem");
  } finally { s.stop(); }
}

// ------------------------------------------------------------------ Hoechstalter
{
  const s = await starte({ BORO_ROOM_MAX_AGE: "2", BORO_SWEEP_EVERY: "1" });
  try {
    const code = await neuerRaum(s);
    assert((await s.post("/party/push", { code, name: "Dauergast", payload: null })).status === 200, "der Raum nimmt eine Meldung an");
    let weg = false;
    for (let i = 0; i < 60 && !weg; i++) {
      await s.post("/party/push", { code, name: "Dauergast", payload: null });   // die Gruppe bleibt aktiv
      weg = (await s.get(`/party/board?code=${code}`)).status === 404;
      if (!weg) await warte(250);
    }
    assert(weg, "ein Raum verschwindet nach dem Hoechstalter, auch wenn er aktiv gehalten wird");
    const h = await s.health();
    assert(h?.rooms === 0 && h?.members === 0 && h?.bytes === 0, "die Zaehlung steht danach auf null", h);
  } finally { s.stop(); }
}

// ------------------------------------------------------------------ /health
{
  const s = await starte({ BORO_PROFIL: "oeffentlich" });
  try {
    const raw = await s.get("/health");
    const h = s.json(raw);
    assert(h?.ok === true && h.profil === "oeffentlich", "/health nennt das Profil", h);
    assert(["rooms", "members", "bytes", "speicherKB", "last1"].every((k) => typeof h?.[k] === "number"), "/health: rooms, members, bytes, speicherKB, last1 sind Zahlen", h);
    assert(raw.body.includes('"rooms": 0'), "die Form \"rooms\": 0 bleibt (die Update-Skripte suchen sie)", raw.body);
  } finally { s.stop(); }
  const t = await starte();
  try {
    assert((await t.health())?.profil === undefined, "ohne BORO_PROFIL meldet /health kein Profil");
  } finally { t.stop(); }
}

if (failed) { console.log(`\n${failed} fehlgeschlagen`); process.exit(1); }
console.log("\nalles gruen");
