// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Gilde-Teil des Servers (BoroPartyServer/boro_gilde.py, Issue #229,
// Spezifikation 2026-10-12-gilde-online-design.md): startet boro_server.py mit
// einem Wegwerf-Ordner fuer die Gilden und spricht ihn ueber rohe Sockets an.
// Geprueft: Rollen (Code liest, Bearbeiter und Lead schreiben, nur der Lead
// verwaltet), Versionszaehlung mit 409, Links und Widerruf, Staende ansehen und
// zurueckholen (legt v+1 an, nichts wird veraendert), Marken, Schliessen, die
// Grenzen (413/411/400, Rate, Fehlversuche, Zahl der Gilden) und dass nach einem
// Neustart alles noch da ist. Die Uhr des Servers wird mit BORO_TEST_CLOCK
// gestellt; keine Anfrage verlaesst den Rechner. Namen sind erfunden.
//
// Run:  npm run test:gildeserver-core

import { spawn, spawnSync } from "node:child_process";
import { createServer, connect } from "node:net";
import { mkdtempSync, readdirSync, existsSync } from "node:fs";
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

const python = ["python3", "python"].find((p) => spawnSync(p, ["--version"]).status === 0);
if (!python) { console.log("  FAIL  kein python3 gefunden"); process.exit(1); }

const freierPort = () => new Promise((resolve) => {
  const s = createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
});

/* Ein Server mit eigenem Ordner; `roh` spricht ihn an. */
async function start(ordner, env = {}) {
  const port = await freierPort();
  const proc = spawn(python, [script], {
    env: { ...process.env, BORO_PARTY_PORT: String(port), BORO_GILDE_DIR: ordner, BORO_TEST_CLOCK: "1", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  proc.stderr.on("data", (d) => { stderr += d; });
  const roh = (kopf, rumpf = "", { warte = 3000 } = {}) => new Promise((resolve) => {
    const t0 = performance.now();
    const sock = connect(port, "127.0.0.1");
    let data = Buffer.alloc(0), fertig = false;
    const ende = (closed) => {
      if (fertig) return;
      fertig = true; clearTimeout(uhr); sock.destroy();
      const text = data.toString("utf8");
      const m = /^HTTP\/1\.[01] (\d{3})/.exec(text);
      const i = text.indexOf("\r\n\r\n");
      resolve({ status: m ? Number(m[1]) : 0, head: i >= 0 ? text.slice(0, i) : text, body: i >= 0 ? text.slice(i + 4) : "", closed, ms: Math.round(performance.now() - t0) });
    };
    const uhr = setTimeout(() => ende(false), warte);
    sock.on("data", (d) => {
      data = Buffer.concat([data, d]);
      const i = data.indexOf("\r\n\r\n"), n = /content-length: *(\d+)/i.exec(data.subarray(0, Math.max(i, 0)).toString());
      if (i >= 0 && n && data.length >= i + 4 + Number(n[1])) ende(/connection: *close/i.test(data.subarray(0, i).toString()));
    });
    sock.on("end", () => ende(true)); sock.on("close", () => ende(true)); sock.on("error", () => ende(true));
    sock.write(kopf + "\r\n\r\n");
    if (rumpf) sock.write(rumpf);
  });
  const json = (r) => { try { return JSON.parse(r.body); } catch { return null; } };
  /* Eine Gilde-Anfrage: Code und Schluessel nur in den Kopfzeilen. */
  const gilde = async (methode, pfad, { code, key, body, xff, warte } = {}) => {
    const kopf = [`${methode} ${pfad} HTTP/1.1`, "Host: x", "Content-Type: application/json"];
    if (code) kopf.push("X-Gilde-Code: " + code);
    if (key) kopf.push("Authorization: Bearer " + key);
    if (xff) kopf.push("X-Forwarded-For: " + xff);
    let rumpf = "";
    if (methode === "POST") { rumpf = JSON.stringify(body ?? {}); kopf.push("Content-Length: " + Buffer.byteLength(rumpf)); }
    else kopf.push("Connection: close");
    const r = await roh(kopf.join("\r\n"), rumpf, warte ? { warte } : undefined);
    return { status: r.status, json: json(r), raw: r };
  };
  for (let i = 0; i < 80; i++) {
    const r = await roh("GET /health HTTP/1.1\r\nHost: x\r\nConnection: close", "", { warte: 500 }).catch(() => null);
    if (r?.status === 200) break;
    await new Promise((res) => setTimeout(res, 100));
  }
  const uhrVor = (sekunden) => gilde("POST", "/gilde/_uhr", { body: { sekunden } });
  return { port, proc, roh, gilde, json, uhrVor, stderr: () => stderr, halt: () => new Promise((res) => { proc.once("exit", res); proc.kill(); }) };
}

const stand = (n) => ({ v: 1, gilde: { id: "g000000001", name: "Testgilde", zaehler: n } });
const ordner = mkdtempSync(join(tmpdir(), "boro-gilden-"));
let s = await start(ordner, { BORO_GILDE_MAX: "4" });

try {
  // --- anlegen und lesen
  const neu = await s.gilde("POST", "/gilde/neu", { body: { name: "Testgilde", stand: stand(1) } });
  const { code, leadKey } = neu.json ?? {};
  assert(neu.status === 200 && /^[A-HJ-NP-Z2-9]{12}$/.test(code ?? "") && /^[A-HJ-NP-Z2-9]{26}$/.test(leadKey ?? "") && neu.json.v === 1,
    "neu: Code mit 12 und Schluessel mit 26 Zeichen, Version 1", neu.json);
  const lesen = await s.gilde("GET", "/gilde/stand?seen=0", { code });
  assert(lesen.status === 200 && lesen.json.rolle === "lesen" && lesen.json.v === 1 && lesen.json.stand.gilde.zaehler === 1,
    "der Code allein liest den Stand, als Mitglied", lesen.json);
  const gleich = await s.gilde("GET", "/gilde/stand?seen=1", { code });
  assert(gleich.json?.unchanged === true && gleich.json.v === 1, "seen gleich der Version: unchanged, ohne Stand", gleich.json);
  const leadLiest = await s.gilde("GET", "/gilde/stand?seen=0", { code, key: leadKey });
  assert(leadLiest.json?.rolle === "lead", "mit dem Lead-Schluessel liest man als Lead", leadLiest.json);
  const keinCode = await s.gilde("GET", "/gilde/stand?seen=0");
  assert(keinCode.status === 404, "ohne Code: 404", keinCode.status);
  const inUrl = await s.gilde("GET", `/gilde/stand?seen=0&code=${code}`);
  assert(inUrl.status === 404, "ein Code in der URL zaehlt nicht: nur der Kopf", inUrl.status);

  // --- schreiben und Version
  const schreib = (base, key, st, c = code, warte) => s.gilde("POST", "/gilde/stand", { code: c, key, body: { base, stand: st }, warte });
  assert((await schreib(1, undefined, stand(9))).status === 403, "ohne Schluessel kein Schreiben: 403");
  const w1 = await schreib(1, leadKey, stand(2));
  assert(w1.status === 200 && w1.json.v === 2, "der Lead schreibt, Version 2", w1.json);
  const w2 = await schreib(1, leadKey, stand(3));
  assert(w2.status === 409 && w2.json.v === 2 && w2.json.stand.gilde.zaehler === 2, "veraltete Version: 409 mit dem aktuellen Stand", w2.json);
  assert((await schreib(2, leadKey, [1, 2])).status === 400, "ein Stand, der kein Objekt ist: 400");

  // --- Links
  const l1 = await s.gilde("POST", "/gilde/link", { code, key: leadKey, body: { label: "Testperson A" } });
  assert(l1.status === 200 && /^[A-HJ-NP-Z2-9]{26}$/.test(l1.json.key ?? "") && !!l1.json.id, "der Lead legt einen Bearbeitungslink an", l1.json);
  const edKey = l1.json.key;
  assert((await s.gilde("POST", "/gilde/link", { code, key: edKey, body: { label: "x" } })).status === 403, "ein Bearbeiter legt keinen Link an: 403");
  const ed = await schreib(2, edKey, stand(4));
  assert(ed.status === 200 && ed.json.v === 3, "der Bearbeiter schreibt, Version 3", ed.json);
  const edLiest = await s.gilde("GET", "/gilde/stand?seen=0", { code, key: edKey });
  assert(edLiest.json?.rolle === "bearbeiter" && edLiest.json.label === "Testperson A", "der Bearbeiter liest als Bearbeiter, mit dem Namen des Links", edLiest.json);
  for (const [m, p] of [["GET", "/gilde/links"], ["GET", "/gilde/staende"], ["GET", "/gilde/stand?v=1"]]) {
    assert((await s.gilde(m, p, { code, key: edKey })).status === 403, `Bearbeiter: ${m} ${p} ist Sache des Leads: 403`);
  }
  for (const p of ["/gilde/zurueck", "/gilde/marke", "/gilde/schliessen", "/gilde/link/widerruf"]) {
    assert((await s.gilde("POST", p, { code, key: edKey, body: { v: 1, id: l1.json.id, label: "x" } })).status === 403, `Bearbeiter: POST ${p} ist Sache des Leads: 403`);
  }
  const liste = await s.gilde("GET", "/gilde/links", { code, key: leadKey });
  assert(liste.status === 200 && liste.json.links.length === 1 && liste.json.links[0].label === "Testperson A" && !JSON.stringify(liste.json).includes(edKey),
    "die Link-Liste nennt den Namen und nie den Schluessel", liste.json);

  // --- Staende, Marke, Zurueckholen
  const st = await s.gilde("GET", "/gilde/staende", { code, key: leadKey });
  assert(st.json?.staende?.length === 3 && st.json.staende[2].von === l1.json.id && st.json.staende[0].von === "lead",
    "die Liste der Staende nennt, wer schrieb", st.json);
  const alt = await s.gilde("GET", "/gilde/stand?v=1", { code, key: leadKey });
  assert(alt.json?.stand?.gilde?.zaehler === 1 && alt.json.v === 1, "der Lead sieht den ersten Stand", alt.json);
  const mk = await s.gilde("POST", "/gilde/marke", { code, key: leadKey, body: { v: 1, label: "vor dem Umbau" } });
  assert(mk.status === 200, "der Lead benennt einen Stand", mk.json);
  const st2 = await s.gilde("GET", "/gilde/staende", { code, key: leadKey });
  assert(st2.json.staende[0].marke === "vor dem Umbau", "die Marke steht in der Liste", st2.json);
  const zur = await s.gilde("POST", "/gilde/zurueck", { code, key: leadKey, body: { v: 1 } });
  assert(zur.status === 200 && zur.json.v === 4, "Zurueckholen legt Version 4 an", zur.json);
  const nach = await s.gilde("GET", "/gilde/stand?seen=0", { code });
  assert(nach.json.v === 4 && nach.json.stand.gilde.zaehler === 1, "der aktuelle Stand ist der alte Inhalt", nach.json);
  const ersterNoch = await s.gilde("GET", "/gilde/stand?v=3", { code, key: leadKey });
  assert(ersterNoch.json?.stand?.gilde?.zaehler === 4, "die uebrigen Staende bleiben unveraendert", ersterNoch.json);
  assert(readdirSync(join(ordner, readdirSync(ordner)[0])).filter((f) => /^v\d{6}\.json$/.test(f)).length === 4, "auf der Platte liegen alle vier Staende");

  // --- Widerruf
  const wr = await s.gilde("POST", "/gilde/link/widerruf", { code, key: leadKey, body: { id: l1.json.id } });
  assert(wr.status === 200, "der Lead widerruft den Link", wr.json);
  assert((await schreib(4, edKey, stand(5))).status === 403, "ein widerrufener Link schreibt nicht mehr: 403");
  const liste2 = await s.gilde("GET", "/gilde/links", { code, key: leadKey });
  assert(liste2.json.links.length === 1 && liste2.json.links[0].widerrufen === true, "der Eintrag bleibt, als widerrufen", liste2.json);

  // --- Grenzen der Anfrage (wie boro_server.py)
  const kopf = (pfad, laenge) => `POST ${pfad} HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nX-Gilde-Code: ${code}\r\nAuthorization: Bearer ${leadKey}\r\nContent-Length: ${laenge}`;
  const zuGross = await s.roh(kopf("/gilde/stand", 2359296 + 1));
  assert(zuGross.status === 413 && zuGross.ms < 2000 && zuGross.closed, "Stand ueber 2,25 MiB: sofort 413 und Verbindung zu", { status: zuGross.status, ms: zuGross.ms });
  const zuGrossKlein = await s.roh(kopf("/gilde/marke", 4097));
  assert(zuGrossKlein.status === 413, "eine kleine Anfrage ueber 4 KiB: 413", zuGrossKlein.status);
  const ohneLaenge = await s.roh(`POST /gilde/marke HTTP/1.1\r\nHost: x\r\nX-Gilde-Code: ${code}`);
  assert(ohneLaenge.status === 411, "ohne Content-Length: 411", ohneLaenge.status);
  assert((await s.roh(kopf("/gilde/marke", "-1"))).status === 400, "Content-Length -1: 400");
  const kaputt = await s.roh(kopf("/gilde/marke", 5), "{kaput");
  assert(kaputt.status === 400, "ungueltiges JSON: 400", kaputt.status);
  const grossOk = JSON.stringify({ base: 4, stand: { v: 1, gilde: { pad: "x".repeat(2000000) } } });
  const gross = await s.gilde("POST", "/gilde/stand", { code, key: leadKey, body: JSON.parse(grossOk) });
  assert(gross.status === 200, "ein Stand von 2 MB geht durch", gross.status);

  // --- Neustart: alles bleibt auf der Platte
  await s.halt();
  s = await start(ordner, { BORO_GILDE_MAX: "4" });
  const neuStart = await s.gilde("GET", "/gilde/stand?seen=0", { code, key: leadKey });
  assert(neuStart.json?.v === 5 && neuStart.json.rolle === "lead", "nach dem Neustart ist die Gilde samt Schluessel da", neuStart.json);

  // --- schliessen und wieder oeffnen (#237): die Dateien bleiben, Mitglieder bekommen 410 closed statt eines Fehlers
  const g2 = await s.gilde("POST", "/gilde/neu", { body: { name: "Zweite", stand: stand(1) } });
  const c2 = g2.json.code, k2 = g2.json.leadKey;
  const l2 = await s.gilde("POST", "/gilde/link", { code: c2, key: k2, body: { label: "Offizier" } });
  const zu = await s.gilde("POST", "/gilde/schliessen", { code: c2, key: k2 });
  assert(zu.status === 200, "der Lead schliesst eine Gilde", zu.json);
  const zuLesen = await s.gilde("GET", "/gilde/stand?seen=0", { code: c2 });
  assert(zuLesen.status === 410 && zuLesen.json?.ok === false && zuLesen.json?.error === "closed", "eine geschlossene Gilde antwortet jedem mit 410 closed", [zuLesen.status, zuLesen.json]);
  assert((await s.gilde("GET", "/gilde/stand?seen=0", { code: c2, key: l2.json.key })).status === 410, "auch dem Bearbeiter: 410");
  assert((await s.gilde("POST", "/gilde/stand", { code: c2, key: k2, body: { base: 1, stand: stand(2) } })).status === 410, "auch der Lead schreibt in eine geschlossene Gilde nicht: 410");
  assert((await s.gilde("GET", "/gilde/links", { code: c2, key: k2 })).status === 410 && (await s.gilde("GET", "/gilde/staende", { code: c2, key: k2 })).status === 410,
    "Links und Staende sind geschlossen auch fuer den Lead: 410");
  let nur410 = true;
  for (let i = 0; i < 12; i++) if ((await s.gilde("GET", "/gilde/stand?seen=0", { code: c2 })).status !== 410) nur410 = false;
  assert(nur410, "oft nach einer geschlossenen Gilde fragen zaehlt nicht als Fehlversuch (nie 429)");
  assert((await s.gilde("GET", "/gilde/stand?seen=0", { code: "BBBBBBBBBBBB" })).status === 404, "ein Code, den es nicht gibt, bleibt 404");
  assert(readdirSync(ordner).length === 2, "geschlossen heisst nicht geloescht: beide Ordner liegen noch da", readdirSync(ordner));
  assert((await s.gilde("POST", "/gilde/schliessen", { code: c2, key: k2 })).status === 200, "nochmal schliessen geht und aendert nichts");
  // oeffnen: nur mit dem Lead-Schluessel
  assert((await s.gilde("POST", "/gilde/oeffnen", { code: c2 })).status === 403, "oeffnen ohne Schluessel: 403");
  assert((await s.gilde("POST", "/gilde/oeffnen", { code: c2, key: l2.json.key })).status === 403, "oeffnen mit dem Schluessel eines Bearbeiters: 403");
  assert((await s.gilde("POST", "/gilde/oeffnen", { code: c2, key: "ZZZZZZZZZZZZZZZZZZZZZZZZZZ" })).status === 403, "oeffnen mit einem falschen Schluessel: 403");
  assert((await s.gilde("GET", "/gilde/stand?seen=0", { code: c2 })).status === 410, "nach den abgelehnten Versuchen ist sie weiter geschlossen");
  const auf = await s.gilde("POST", "/gilde/oeffnen", { code: c2, key: k2 });
  assert(auf.status === 200 && auf.json?.ok === true, "der Lead oeffnet sie wieder", auf.json);
  const aufLesen = await s.gilde("GET", "/gilde/stand?seen=0", { code: c2 });
  assert(aufLesen.status === 200 && aufLesen.json?.v === 1, "danach liest jeder wieder, mit dem alten Stand (v1)", aufLesen.json);
  assert((await s.gilde("GET", "/gilde/stand?seen=0", { code: c2, key: l2.json.key })).json?.rolle === "bearbeiter", "der Link des Bearbeiters gilt wieder");
  assert((await s.gilde("POST", "/gilde/oeffnen", { code: c2, key: k2 })).status === 200, "oeffnen einer offenen Gilde geht und aendert nichts");
  assert((await s.gilde("POST", "/gilde/stand", { code: c2, key: k2, body: { base: 1, stand: stand(2) } })).status === 200, "der Lead schreibt wieder: v2");
  await s.gilde("POST", "/gilde/schliessen", { code: c2, key: k2 });

  // --- Gilden-Grenze (BORO_GILDE_MAX=4)
  assert((await s.gilde("POST", "/gilde/neu", { body: { stand: stand(1) } })).status === 200, "dritte Gilde");
  assert((await s.gilde("POST", "/gilde/neu", { body: { stand: stand(1) } })).status === 200, "vierte Gilde");
  const fuenfte = await s.gilde("POST", "/gilde/neu", { body: { stand: stand(1) } });
  assert(fuenfte.status === 429, "fuenfte Gilde bei Grenze 4: 429", fuenfte.status);

  // --- Fehlversuche: 10 je Minute, dann Pause
  let letzte;
  for (let i = 0; i < 12; i++) letzte = await s.gilde("GET", "/gilde/stand?seen=0", { code: "AAAAAAAAAAAA" });
  assert(letzte.status === 429, "viele Fehlversuche: 429", letzte.status);
  assert((await s.gilde("GET", "/gilde/stand?seen=0", { code })).status === 429, "waehrend der Pause bekommt auch der richtige Code 429");
  await s.uhrVor(301);
  assert((await s.gilde("GET", "/gilde/stand?seen=0", { code })).status === 200, "nach der Pause geht es wieder");
  // --- Liste der Staende begrenzen (#229): die neuesten 200 und alle benannten; nichts wird geloescht
  {
    assert(st.json.gekuerzt === undefined && st2.json.gekuerzt === undefined, "eine kurze Liste traegt kein Feld gekuerzt (alte und neue Clients lesen dasselbe)");
    assert((await s.gilde("POST", "/gilde/marke", { code, key: leadKey, body: { v: 2, label: "zweite Marke" } })).status === 200, "ein zweiter Stand wird benannt");
    // Je Stand fsynct der Server zweimal; auf einem ausgelasteten Runner kann ein Schreibvorgang
    // die 3 s der Voreinstellung reissen (Status 0). Die Schleife wartet daher 20 s je Anfrage und
    // nennt beim Abbruch Status, Dauer und Nummer des Schreibvorgangs (#224).
    let v = 5, ok = true, abbruch = null;
    for (let i = 0; i < 205; i++) {
      if (i % 15 === 0) {
        const u = await s.uhrVor(61);
        if (u.status !== 200) { ok = false; abbruch = { schreibvorgang: i, schritt: "uhrVor", status: u.status, ms: u.raw.ms }; break; }
      }
      const w = await schreib(v, leadKey, stand(100 + i), code, 20000);
      if (w.status !== 200 || w.json?.v !== v + 1) { ok = false; abbruch = { schreibvorgang: i, v, status: w.status, ms: w.raw.ms, geschlossen: w.raw.closed, antwort: w.json }; break; }
      v = w.json.v;
    }
    assert(ok && v === 210, "205 weitere Staende geschrieben (v210)", ok ? v : abbruch);
    await s.uhrVor(61);
    const lang = await s.gilde("GET", "/gilde/staende", { code, key: leadKey });
    const vs = (lang.json?.staende ?? []).map((x) => x.v);
    assert(lang.status === 200 && vs.length === 202, "die Antwort hat die neuesten 200 und die zwei benannten", vs.length);
    assert(lang.json.gekuerzt === 210, "gekuerzt nennt die Gesamtzahl", lang.json?.gekuerzt);
    assert(vs[0] === 1 && vs[1] === 2 && vs[2] === 11 && vs[201] === 210, "benannte bleiben, dazu v11 bis v210, aufsteigend wie bisher", vs.slice(0, 4));
    assert(lang.json.staende[0].marke === "vor dem Umbau" && lang.json.staende[1].marke === "zweite Marke" && lang.json.staende[2].marke === "", "die Marken stehen dabei");
    assert((await s.gilde("GET", "/gilde/stand?v=3", { code, key: leadKey })).json?.stand?.gilde?.zaehler === 4, "ein Stand, den die Liste nicht mehr nennt, ist weiter lesbar");
    const zurAlt = await s.gilde("POST", "/gilde/zurueck", { code, key: leadKey, body: { v: 3 } });
    assert(zurAlt.status === 200 && zurAlt.json.v === 211, "Zurueckholen geht auch fuer einen ungenannten Stand (legt v211 an)", zurAlt.json);
    const nochmal = await s.gilde("GET", "/gilde/staende", { code, key: leadKey });
    assert(nochmal.json.gekuerzt === 211 && nochmal.json.staende.length === 202, "die Liste bleibt bei 200 plus benannten", nochmal.json.gekuerzt);
  }
  // --- endgueltig loeschen (#240): nur eine beendete Gilde, nur mit dem Lead-Schluessel, danach ist sie weg
  {
    const vorher = readdirSync(ordner).length;
    const offene = await s.gilde("POST", "/gilde/loeschen", { code, key: leadKey });
    assert(offene.status === 409, "eine nicht beendete Gilde wird nicht geloescht: 409", offene.status);
    assert(readdirSync(ordner).length === vorher && (await s.gilde("GET", "/gilde/stand?seen=0", { code })).status === 200, "danach ist sie unveraendert da");
    assert((await s.gilde("POST", "/gilde/loeschen", { code: c2 })).status === 403, "ohne Schluessel: 403");
    assert((await s.gilde("POST", "/gilde/loeschen", { code: c2, key: l2.json.key })).status === 403, "mit dem Schluessel eines Bearbeiters: 403");
    assert((await s.gilde("POST", "/gilde/loeschen", { code: c2, key: "ZZZZZZZZZZZZZZZZZZZZZZZZZZ" })).status === 403, "mit einem falschen Schluessel: 403");
    assert(readdirSync(ordner).length === vorher && (await s.gilde("GET", "/gilde/stand?seen=0", { code: c2 })).status === 410, "nach den abgelehnten Versuchen liegt die beendete Gilde noch da");
    const weg = await s.gilde("POST", "/gilde/loeschen", { code: c2, key: k2 });
    assert(weg.status === 200 && weg.json?.ok === true, "der Lead loescht die beendete Gilde", weg.json);
    assert(readdirSync(ordner).length === vorher - 1, "ihr Ordner ist von der Platte, die anderen bleiben", readdirSync(ordner));
    assert((await s.gilde("GET", "/gilde/stand?seen=0", { code: c2 })).status === 404, "ihr Code ist danach unbekannt: 404");
    assert((await s.gilde("POST", "/gilde/oeffnen", { code: c2, key: k2 })).status === 404, "oeffnen geht nicht mehr: 404");
    assert((await s.gilde("GET", "/gilde/stand?seen=0", { code })).status === 200, "eine andere Gilde ist unberuehrt");
  }
  await s.halt();

  // --- Rate des Schreibens und der neuen Gilden (frischer Server, hohe Zahl der Gilden)
  const o2 = mkdtempSync(join(tmpdir(), "boro-gilden-"));
  s = await start(o2, { BORO_GILDE_MAX: "100" });
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push((await s.gilde("POST", "/gilde/neu", { body: { stand: stand(1) } })).json);
  const sechste = await s.gilde("POST", "/gilde/neu", { body: { stand: stand(1) } });
  assert(ids.every((x) => x?.code) && sechste.status === 429, "fuenf neue Gilden je Stunde, die sechste: 429", sechste.status);
  const g = ids[0];
  let v = 1, rateStatus = 200;
  for (let i = 0; i < 22 && rateStatus === 200; i++) {
    const r = await s.gilde("POST", "/gilde/stand", { code: g.code, key: g.leadKey, body: { base: v, stand: stand(i) }, warte: 20000 });
    rateStatus = r.status; if (r.status === 200) v = r.json.v;
  }
  assert(rateStatus === 429 && v === 21, "20 Schreibvorgaenge je Minute und Gilde, der naechste: 429", { rateStatus, v });
  await s.uhrVor(61);
  const wieder = await s.gilde("POST", "/gilde/stand", { code: g.code, key: g.leadKey, body: { base: v, stand: stand(99) } });
  assert(wieder.status === 200, "eine Minute spaeter geht Schreiben wieder", wieder.status);
  // der Weiterleitungs-Kopf zaehlt nur von der eingestellten Quelle: sonst gilt die Verbindung
  const ff = await s.gilde("GET", "/gilde/stand?seen=0", { code: "BBBBBBBBBBBB", xff: "203.0.113.9" });
  assert(ff.status === 404, "ein fremder X-Forwarded-For aendert die Antwort nicht");
  assert(existsSync(o2), "der Ordner liegt noch da");

  // --- Rate und Pause zaehlen nach der Monotonuhr, nicht nach der Wanduhr (#224): auf den Runnern (WSL)
  // springt time.time() alle paar Sekunden um rund 2,5 s zurueck, auf einem Server stellt NTP die Uhr.
  // Dann zaehlten Schreibvorgaenge der letzten Minute wieder mit (429 mitten in der Schleife oben).
  {
    const wand = (sekunden) => s.gilde("POST", "/gilde/_uhr", { body: { sekunden: 0, wand: sekunden } });
    const g2 = ids[1];
    await s.uhrVor(61);
    let v2 = 1, ok = true, abbruch = null;
    for (let i = 0; i < 30; i++) {
      if (i === 15) {
        await s.uhrVor(61);
        const u = await wand(-5);
        if (u.status !== 200) { ok = false; abbruch = { schritt: "wand", status: u.status }; break; }
      }
      const r = await s.gilde("POST", "/gilde/stand", { code: g2.code, key: g2.leadKey, body: { base: v2, stand: stand(i) }, warte: 20000 });
      if (r.status !== 200) { ok = false; abbruch = { schreibvorgang: i, status: r.status, antwort: r.json }; break; }
      v2 = r.json.v;
    }
    assert(ok && v2 === 31, "springt die Wanduhr 5 s zurueck, zaehlen die 15 Schreibvorgaenge der Minute davor nicht wieder mit", ok ? v2 : abbruch);
    // eine Pause endet nach 300 s, auch wenn die Wanduhr dazwischen eine Stunde zurueckgestellt wird
    let pause;
    for (let i = 0; i < 12; i++) pause = await s.gilde("GET", "/gilde/stand?seen=0", { code: "CCCCCCCCCCCC" });
    assert(pause.status === 429, "Fehlversuche: Pause (429)", pause.status);
    await wand(-3600);
    await s.uhrVor(301);
    const nachPause = await s.gilde("GET", "/gilde/stand?seen=0", { code: g2.code });
    assert(nachPause.status === 200, "nach 301 s ist die Pause vorbei, auch mit einer Stunde zurueckgestellter Wanduhr", nachPause.status);
    const zeit = (await s.gilde("GET", "/gilde/staende", { code: g2.code, key: g2.leadKey })).json?.staende?.at(-1)?.zeit;
    // der letzte Stand entstand bei Testuhr +183 s (dreimal 61) und Wanduhr -5 s
    const erwartet = Math.round(Date.now() / 1000 + 61 * 3 - 5);
    assert(typeof zeit === "number" && Math.abs(zeit - erwartet) < 60, "gespeicherte Zeiten bleiben Wanduhr, samt ihrem Sprung", { zeit, erwartet });
  }
} finally {
  await s.halt().catch(() => {});
}

if (failed) { console.log(`\n${failed} fehlgeschlagen`); process.exit(1); }
console.log("\nalles gruen");
