// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Gruppenserver (BoroPartyServer/boro_server.py, Issue #149): startet ihn
// mit python3 auf einem freien Port von 127.0.0.1 und spricht ihn ueber
// rohe Sockets an - nur so laesst sich ein falscher Content-Length-Kopf oder
// ein stockender Absender stellen. Geprueft: die Obergrenze fuer den Rumpf
// (413 ohne zu lesen), fehlendes/negatives/nicht numerisches Content-Length,
// das Zeitlimit am Handler, die Hoechstzahl an Mitgliedern je Raum - und dass
// eine echte Meldung samt Kurve weiter durchgeht. Keine Anfrage verlaesst
// den Rechner.
//
// Run:  npm run test:partyserver-core

import { spawn, spawnSync } from "node:child_process";
import { createServer, connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "BoroPartyServer", "boro_server.py");

let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}

// python3 auf Linux (CI), unter Windows heisst er oft nur python
const python = ["python3", "python"].find((p) => spawnSync(p, ["--version"]).status === 0);
if (!python) { console.log("  FAIL  kein python3 gefunden"); process.exit(1); }

const port = await new Promise((resolve) => {
  const s = createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const proc = spawn(python, [script], { env: { ...process.env, BORO_PARTY_PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
let stderr = "";
proc.stderr.on("data", (d) => { stderr += d; });

/* Eine Anfrage als rohe Bytes. Liefert {status, body, closed, ms}: closed,
   wenn der Server die Verbindung von sich aus schliesst; nach `warte` ms
   ohne Antwort und ohne Schluss steht status 0 (der Server wartet noch). */
function roh(kopf, rumpf = "", { warte = 3000 } = {}) {
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
    const uhr = setTimeout(() => ende(false), warte);
    sock.on("data", (d) => {
      data = Buffer.concat([data, d]);
      // eine ganze Antwort ist da: nicht auf das Ende einer Keep-Alive-Verbindung warten
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
const post = (pfad, rumpf, extra = "") => {
  const b = Buffer.from(rumpf, "utf8");
  return roh(`POST ${pfad} HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${b.length}${extra}`, b);
};
const json = (r) => { try { return JSON.parse(r.body); } catch { return null; } };
async function gesund() {
  const r = await roh("GET /health HTTP/1.1\r\nHost: x\r\nConnection: close", "", { warte: 1000 });
  return r.status === 200 ? json(r) : null;
}

// auf den Server warten
for (let i = 0; i < 50 && !(await gesund().catch(() => null)); i++) await new Promise((r) => setTimeout(r, 100));

try {
  const rooms0 = (await gesund())?.rooms;
  assert(rooms0 === 0, "Server laeuft und meldet sich unter /health", { rooms0, stderr });

  // --- eine echte Meldung geht durch, die Kurve kommt zurueck
  const neu = json(await post("/party/create", JSON.stringify({ name: "Mitglied Eins" })));
  const code = neu?.code;
  assert(!!neu?.ok && /^[A-Z2-9]{4}$/.test(code || ""), "/party/create legt einen Raum an", neu);

  /* So gross wie die groesste echte Meldung (gemessen 04.10. ueber alle
     eigenen Logs: 40.0 kB, ein Kampf von 414 s; Kurve 16 kB, Einsaetze 20 kB) -
     nachgebaut mit Zahlen statt Namen. */
  const T = 414;
  const lanes = Array.from({ length: 12 }, (_, k) => ({ n: "Faehigkeit " + k, sid: String(900000000 + k), v: Array.from({ length: T }, (_, s) => (s * 7919 + k) % 12000) }));
  const casts = Array.from({ length: 12 }, (_, k) => ({ n: "Faehigkeit " + k, s: String(900000000 + k),
    c: Array.from({ length: 70 }, (_, i) => [i * 5900, i * 5900 + 400, 123456 + i, 3, 1]) }));
  const payload = { target: "Ziel", curve: { t0: 1, T, total: Array.from({ length: T }, (_, s) => s * 31), lanes }, casts,
    damage: 4000000, dps: 9600, hits: 900, crit: 0.4, heavy: 0.2, seconds: T, max: 90000, skills: [], lang: "de" };
  const echt = JSON.stringify({ code, name: "Mitglied Eins", payload, weapons: ["sword", "dagger"], ventius: false });
  assert(echt.length > 38000, "die nachgebaute Meldung ist so gross wie die groesste echte", echt.length);
  const p1 = await post("/party/push", echt);
  assert(p1.status === 200 && json(p1)?.board?.[0]?.hasCurve === true, "/party/push mit der groessten echten Meldung: 200, Kurve gemeldet", { status: p1.status, body: p1.body.slice(0, 200) });
  const kurve = await roh(`GET /party/curve?code=${code}&name=Mitglied%20Eins HTTP/1.1\r\nHost: x\r\nConnection: close`);
  assert(kurve.status === 200 && json(kurve)?.curve?.T === T, "/party/curve liefert die Kurve dieses Mitglieds", { status: kurve.status });

  // --- Obergrenze: knapp darunter geht, darueber 413 ohne zu lesen
  const MAX = 256 * 1024;
  const fuell = (n) => {
    const kern = JSON.stringify({ code, name: "Mitglied Eins", payload: { target: "Ziel", damage: 1 }, weapons: null, ventius: false });
    return kern.slice(0, -1) + "," + JSON.stringify("pad") + ":" + JSON.stringify("x".repeat(n - kern.length - 9)) + "}";
  };
  const genau = fuell(MAX);
  assert(Buffer.byteLength(genau) === MAX, "Rumpf von genau 256 kB gebaut", Buffer.byteLength(genau));
  const p2 = await post("/party/push", genau);
  assert(p2.status === 200, "Rumpf von genau 256 kB: angenommen", p2.status);

  const zuViel = await roh(`POST /party/push HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${MAX + 1}`);
  assert(zuViel.status === 413 && zuViel.ms < 2000, "Content-Length 256 kB + 1 ohne Rumpf: sofort 413, der Server wartet nicht auf den Rumpf", { status: zuViel.status, ms: zuViel.ms });
  assert(zuViel.closed && /connection: close/i.test(zuViel.head), "nach 413 schliesst der Server die Verbindung (Connection: close)", zuViel.head);
  const riesig = await roh("POST /party/create HTTP/1.1\r\nHost: x\r\nContent-Length: 999999999999");
  assert(riesig.status === 413, "Content-Length 999999999999: 413", riesig.status);

  // --- Content-Length fehlt, ist negativ oder keine Zahl
  const vorher = (await gesund())?.rooms;
  const ohne = await roh("POST /party/create HTTP/1.1\r\nHost: x\r\nContent-Type: application/json");
  assert(ohne.status === 411, "POST ohne Content-Length: 411", { status: ohne.status, ms: ohne.ms });
  const negativ = await roh("POST /party/create HTTP/1.1\r\nHost: x\r\nContent-Length: -1");
  assert(negativ.status === 400 && negativ.ms < 2000, "Content-Length -1: sofort 400", { status: negativ.status, ms: negativ.ms });
  const wort = await roh("POST /party/create HTTP/1.1\r\nHost: x\r\nContent-Length: zwoelf");
  assert(wort.status === 400, "Content-Length keine Zahl: 400", wort.status);
  const plus = await roh("POST /party/create HTTP/1.1\r\nHost: x\r\nContent-Length: +5", "{}   ");
  assert(plus.status === 400, "Content-Length +5: 400 (nur Ziffern)", plus.status);
  assert((await gesund())?.rooms === vorher, "keine dieser Anfragen hat einen Raum angelegt", { vorher });

  // --- Hoechstzahl an Mitgliedern je Raum
  const MAX_MEMBERS = 40;
  const raum = json(await post("/party/create", JSON.stringify({ name: "Gast 0" })))?.code;
  let alle = true;
  for (let i = 0; i < MAX_MEMBERS; i++) {
    const r = await post("/party/push", JSON.stringify({ code: raum, name: "Gast " + i, payload: null }));
    if (r.status !== 200) { alle = false; break; }
  }
  assert(alle, `${MAX_MEMBERS} Mitglieder passen in einen Raum`);
  const voll = await post("/party/push", JSON.stringify({ code: raum, name: "Gast " + MAX_MEMBERS, payload: null }));
  assert(voll.status === 409 && json(voll)?.error === "room full", `Mitglied ${MAX_MEMBERS + 1}: 409 room full`, { status: voll.status, body: voll.body });
  const wieder = await post("/party/push", JSON.stringify({ code: raum, name: "Gast 7", payload: null }));
  assert(wieder.status === 200 && json(wieder)?.board?.length === MAX_MEMBERS, "wer schon drin ist, meldet weiter", { status: wieder.status, n: json(wieder)?.board?.length });
  await roh(`GET /party/ping?code=${raum}&name=Gast%2099 HTTP/1.1\r\nHost: x\r\nConnection: close`);
  const tafel = json(await roh(`GET /party/board?code=${raum} HTTP/1.1\r\nHost: x\r\nConnection: close`));
  assert(tafel?.board?.length === MAX_MEMBERS, "auch /party/ping fuegt einem vollen Raum niemanden hinzu", tafel?.board?.length);
  const raus = await post("/party/kick", JSON.stringify({ code: raum, name: "Gast 0", who: "Gast 3" }));
  const nach = await post("/party/push", JSON.stringify({ code: raum, name: "Gast " + MAX_MEMBERS, payload: null }));
  assert(raus.status === 200 && nach.status === 200, "nach einer Entfernung ist wieder Platz", { raus: raus.status, nach: nach.status });

  // --- Zeitlimit: ein stockender Absender haelt keinen Thread fest
  const stockt = await roh(`POST /party/push HTTP/1.1\r\nHost: x\r\nContent-Length: 100`, "{\"code\":", { warte: 15000 });
  assert(stockt.closed && stockt.ms < 13000, "Absender sendet 8 von 100 Bytes und stockt: der Server gibt nach dem Zeitlimit auf", { closed: stockt.closed, ms: stockt.ms });
  assert((await gesund())?.ok === true, "der Server antwortet danach weiter");
} finally {
  proc.kill();
}

if (failed) { console.log(`\n${failed} fehlgeschlagen`); process.exit(1); }
console.log("\nalles gruen");
