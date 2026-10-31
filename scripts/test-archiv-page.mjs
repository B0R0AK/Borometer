// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die Aufnahme des Log-Archivs an der gebauten Seite (Spezifikation
// docs/superpowers/specs/2026-10-16-log-archiv-design.md, Abschnitte 3, 4, 6;
// Plan Aufgabe 6, Schritte 1, 3 und 7; #264): ein Kampf an einem Boss der
// Tabelle geht genau einmal an POST /api/archiv/aufnehmen, Trash, der
// Beispielkampf und ein ausgeschaltetes Archiv nie; dieselbe Datei noch
// einmal sendet nichts, eine gewachsene Datei sendet den groesseren Stand;
// im Datei-Modus geschieht nichts und nichts bricht. Abnahme: das gesendete
// Stueck, wieder als Log gelesen, ergibt denselben Kampf (DPS, Schaden, Dauer).
// Dazu das Sichtbare (Plan Aufgabe 6, Schritte 4 bis 6): der einmalige Hinweis
// auf Start (archivHinweis 0: kein POST, bis "Verstanden" ihn quittiert), der
// Abschnitt Archiv in den Einstellungen (Schalter archivAn, "Archivordner
// oeffnen", im Browser der Satz statt der Bedienung), Deutsch und Englisch,
// Tastatur, 560 px und 2000 x 1480.
//
// Kein Server: die Seite kommt vom gestellten Helfer (page.route). Die Routen
// /api/archiv/* gehen durch den echten Speicher (src/main/archiv.ts, gebuendelt
// mit einem gestellten electron wie in test-weeklies-page.mjs); er prueft das
// Schema jedes gesendeten Eintrags. Namen und Zahlen sind erfunden, die Bosse
// stehen in der Tabelle (06-blocks-and-places.ts).
//
// Gewartet wird auf Zustand, nie auf Zeit (#224): auf gesendete Anfragen und
// auf body[data-archiv-geprueft], die Zahl der Kaempfe, ueber die die Seite
// entschieden hat (gesendet, uebersprungen, verworfen).
//
// Run:  npm run test:archiv-page     (baut die Seite zuerst)

import * as esbuild from "esbuild";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 900))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const DATEI = "file:///" + join(root, "dist", "renderer", "index.html").replace(/\\/g, "/").replace(/^\/+/, "");

/* Der echte Speicher (archiv.ts), ohne Electron: paths.ts haengt an electron. */
const ordner = mkdtempSync(join(tmpdir(), "boro-arpage-"));
process.env.APPDATA = ordner;
const electron = { name: "electron", setup(b) {
  b.onResolve({ filter: /^electron$/ }, () => ({ path: "electron", namespace: "gestellt" }));
  b.onLoad({ filter: /.*/, namespace: "gestellt" }, () => ({ loader: "js",
    contents: "export const app = { isPackaged: false, getAppPath: () => process.env.APPDATA, getPath: () => process.env.APPDATA };" }));
} };
const bundle = async (entry, plugins = []) => {
  const b = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root)), ...plugins] });
  return import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));
};
const ar = await bundle("src/main/archiv.ts", [electron]);
/* Live: /api/state und /api/latest aus den echten Funktionen von logs.ts auf einer wachsenden Datei (wie test-live-page.mjs) */
const logs = await bundle("src/main/logs.ts");
mkdirSync(join(ordner, "Borometer"), { recursive: true });
ar.createArchiv();

/* ---------- erfundene Logs ----------
   Ein Kampf: Treffer alle 500 ms ueber dur Sekunden, Schaden wachsend; die Uhr
   ist die des Logs (Datum und Uhrzeit, wie das Spiel sie schreibt). */
const SPIELER = "Probe7";
const zwei = (n, l = 2) => String(n).padStart(l, "0");
const stempel = (ms) => { const d = new Date(ms); return d.getUTCFullYear() + zwei(d.getUTCMonth() + 1) + zwei(d.getUTCDate()) + "-" +
  zwei(d.getUTCHours()) + ":" + zwei(d.getUTCMinutes()) + ":" + zwei(d.getUTCSeconds()) + ":" + zwei(d.getUTCMilliseconds(), 3); };
const kampf = (boss, at, dur, basis = 1000) => {
  const z = [];
  for (let i = 0; i <= dur * 2; i++) z.push(`${stempel(at + i * 500)},DamageDone,Brutal Arrow,999000002,${basis + i},0,0,kNormalHit,${SPIELER},${boss}`);
  return z;
};
const T0 = Date.UTC(2026, 8, 20, 19, 0, 0);   // 20.09.2026 19:00 (Uhr des Logs)
const MIN = 60000;
const work = mkdtempSync(join(tmpdir(), "boro-arlogs-"));
const logDatei = (unter, name, zeilen) => {
  mkdirSync(join(work, unter), { recursive: true });
  const p = join(work, unter, name);
  writeFileSync(p, ["CombatLogVersion,4", ...zeilen].join("\n") + "\n");
  return p;
};
const TRASH = "Molting Grave Wolf";
const L_TRASH = logDatei("a", "archiv-trash.txt", kampf(TRASH, T0, 20));
const L_BOSS = logDatei("a", "archiv-morokai.txt", [...kampf(TRASH, T0, 20), ...kampf("Morokai", T0 + 5 * MIN, 60, 2000)]);
/* dieselbe Datei, gewachsen: derselbe Kampf an Morokai dauert laenger (gleicher Beginn, mehr Zeilen) */
const L_GROSS = logDatei("b", "archiv-morokai.txt", [...kampf(TRASH, T0, 20), ...kampf("Morokai", T0 + 5 * MIN, 80, 2000)]);
const L_CHERNO = logDatei("a", "archiv-chernobog.txt", kampf("Chernobog", T0 + 60 * MIN, 40, 3000));
const L_PUPPE = logDatei("a", "archiv-puppe.txt", kampf("Practice Dummy", T0 + 90 * MIN, 62, 1500));
/* fuer Hinweis und Schalter: Kaempfe, die der Speicher noch nicht hat */
const L_NEU1 = logDatei("e", "archiv-neu1.txt", kampf("Morokai", T0 + 150 * MIN, 30, 2500));
const L_NEU2 = logDatei("e", "archiv-neu2.txt", kampf("Chernobog", T0 + 180 * MIN, 30, 2600));
const L_NEU3 = logDatei("e", "archiv-neu3.txt", kampf("Morokai", T0 + 210 * MIN, 30, 2700));

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Der gestellte Helfer: /api/archiv/* wie server.ts (409, wenn archivAn false; sonst der echte Speicher). */
/* verzeichnis: ein gestelltes Verzeichnis statt des echten Speichers fuer GET /api/archiv/liste (der Bereich Archiv);
   texte: die Zeilen je Schluessel fuer GET /api/archiv/kampf?k= (fehlt einer: 404);
   app: eigenes Fenster (?win=1), zwei: dazu Kompakt als eigenes Fenster mit offenem Streifen;
   logStoer: je Logname ein Status fuer GET /api/log statt der Datei (404, 500) oder "halt": die Antwort wartet auf s.tor */
async function oeffne({ config = {}, datei = false, weeklies = null, live = null, rekorde = null, lang = "de", viewport = { width: 1280, height: 860 },
  verzeichnis = null, texte = {}, zwei = false, app = false, logStoer = {} } = {}) {
  const page = await browser.newPage({ viewport });
  /* stoer: gestellte Antworten des Helfers (liste, post: ein Status statt des echten Speichers);
     logsFragen: jede Anfrage an /api/logs (mit Suche), logArt: Methode und Name jeder Anfrage an /api/log und /api/logs */
  const s = { page, fehler: [], posts: [], antworten: [], listen: 0, fremd: [], latest: 0, config: [], ordner: [], stoer: {}, kampf: [], win: [], logGet: [],
    logsFragen: [], logArt: [], tor: null, loesen: [], loeschen: [], sicherungen: [], loeschAntwort: null };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  page.on("request", (r) => { const u = r.url(); if (!u.startsWith("http://boro.test/") && !u.startsWith("file:") && !u.startsWith("data:")) s.fremd.push(u); });
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  if (datei) {
    await page.goto(DATEI);
    await page.waitForFunction(() => !!document.querySelector("#fileInput"));
    return s;
  }
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/archiv/liste" && req.method() === "GET") {
      s.listen++;
      if (s.stoer.liste === 0) return route.abort().catch(() => {});
      if (s.stoer.liste) return json({ ok: false }, s.stoer.liste);
      if (verzeichnis) return json({ ok: true, data: { v: 1, kaempfe: verzeichnis } });
      const a = ar.loadArchiv();
      return a ? json({ ok: true, data: a }) : json({ ok: false }, 503);
    }
    if (path === "/api/archiv/aufnehmen" && req.method() === "POST") {
      const b = JSON.parse(req.postData() || "{}");
      s.posts.push(b);
      if (s.stoer.post === 0) { s.antworten.push(0); return route.abort().catch(() => {}); }
      if (s.stoer.post) { s.antworten.push(s.stoer.post); return json({ ok: false }, s.stoer.post); }
      if (config.archivAn === false) { s.antworten.push(409); return json({ ok: false }, 409); }
      const r = ar.archiviere(b);
      const status = r === "saved" ? 200 : r === "refused" ? 400 : 503;
      s.antworten.push(status);
      return json({ ok: r === "saved" }, status);
    }
    if (path === "/api/archiv/ordner" && req.method() === "POST") {
      s.ordner.push({ typ: req.headers()["content-type"] || "", body: req.postData() || "" });
      return json({ ok: true });
    }
    if (path === "/api/archiv/kampf" && req.method() === "GET") {
      // die rohe Anfrage: der Schluessel muss kodiert ankommen
      const roh = req.url().slice(req.url().indexOf("?"));
      s.kampf.push(roh);
      const k = new URL(req.url()).searchParams.get("k");
      if (s.kampfTor && s.kampfTor.k === k) await s.kampfTor.warte;
      return Object.hasOwn(texte, k) ? route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: texte[k] }) : route.fulfill({ status: 404, body: "" });
    }
    /* Loesen, endgueltig Loeschen, Sicherungsordner (#264 Teil 4): mit gestelltem Verzeichnis spielt der Helfer den Speicher
       an ihm nach (er aendert es, das naechste GET liest den neuen Stand); ohne Verzeichnis geht es durch den echten Speicher.
       s.loeschAntwort: [Status, Koerper] statt des Nachspielens (die Ablehnungen). */
    if (path === "/api/archiv/loesen" && req.method() === "POST") {
      const b = JSON.parse(req.postData() || "{}");
      s.loesen.push({ body: b, typ: req.headers()["content-type"] || "" });
      if (s.loesenTor) await s.loesenTor.warte;
      if (s.stoer.loesen) return json({ ok: false, grund: "unavailable" }, s.stoer.loesen);
      if (!verzeichnis) { const r = ar.loeseArchiv(b); return json(r, r.ok ? 200 : r.grund === "unavailable" ? 503 : 400); }
      const ergebnis = {};
      for (const k of b.ks) {
        const e = verzeichnis.find((x) => x.k === k);
        if (!e) ergebnis[k] = "unbekannt";
        else if (!!e.geloest === b.geloest) ergebnis[k] = "schon";
        else { if (b.geloest) e.geloest = true; else delete e.geloest; ergebnis[k] = "ok"; }
      }
      return json({ ok: true, ergebnis });
    }
    if (path === "/api/archiv/loeschen" && req.method() === "POST") {
      const b = JSON.parse(req.postData() || "{}");
      s.loeschen.push({ body: b, typ: req.headers()["content-type"] || "" });
      if (s.loeschAntwort) return json(s.loeschAntwort[1], s.loeschAntwort[0]);
      if (!verzeichnis) { const r = ar.loescheArchivGeloest(b); return json(r, r.ok ? 200 : r.grund === "abgelehnt" ? 400 : r.grund === "unavailable" ? 503 : 200); }
      const weg = b.ks.map((k) => verzeichnis.find((x) => x.k === k));
      if (weg.some((e) => !e || !e.geloest)) return json({ ok: false, grund: "nicht-geloest", kaempfe: b.ks.filter((k, i) => !weg[i]?.geloest) });
      const soll = weg.length === 1 ? weg[0].boss + " " + logTag(weg[0].at) : String(weg.length);
      if (b.bestaetigung.trim().toLowerCase() !== soll.toLowerCase()) return json({ ok: false, grund: "bestaetigung" });
      for (const e of weg) verzeichnis.splice(verzeichnis.indexOf(e), 1);
      return json({ ok: true, sicherung: "archiv-vor-loeschen-2026-10-26", ergebnis: Object.fromEntries(b.ks.map((k) => [k, "geloescht"])) });
    }
    if (path === "/api/archiv/sicherungen" && req.method() === "POST") {
      s.sicherungen.push({ typ: req.headers()["content-type"] || "", body: req.postData() || "" });
      return json({ ok: true });
    }
    if (path.startsWith("/api/archiv/")) return json({ ok: false }, 404);
    // zwei: Kompakt als eigenes Fenster, der Streifen ist offen; die Vollansicht meldet ihren Stand an /api/win
    if (path === "/api/win" && req.method() === "POST") { s.win.push(JSON.parse(req.postData() || "{}")); return json({ ok: true, offen: true }); }
    if (path === "/api/log") s.logGet.push(req.url());
    if (path === "/api/log" || path === "/api/logs") s.logArt.push(req.method() + " " + path + " " + (new URL(req.url()).searchParams.get("name") ?? ""));
    if (path === "/api/logs") s.logsFragen.push(new URL(req.url()).search);
    /* wie server.ts: ?alle=1 listet bis LIST_ALLE_MAX (Alte Logs einlesen), sonst bis LIST_MAX */
    if (path === "/api/logs" && rekorde) {
      const alle = new URL(req.url()).searchParams.get("alle") === "1";
      return json({ ok: true, files: logs.listLogs(rekorde, alle ? logs.LIST_ALLE_MAX : logs.LIST_MAX).map((f) => ({ name: f.name, size: f.size, mtime: f.mtime })) });
    }
    if (path === "/api/log" && rekorde) {
      const u = new URL(req.url()), name = u.searchParams.get("name");
      const st = Object.hasOwn(logStoer, name) ? logStoer[name] : null;
      if (st === "halt" && s.tor) await s.tor.warte;
      else if (typeof st === "number") return json({ ok: false }, st);
      const a = logs.logAnswer(rekorde, name, u.searchParams.get("from"));
      return json(a.body, a.status);
    }
    if (path === "/api/state" && live) {
      const f = logs.newestLog(live);
      return json({ dir: live, file: f?.name ?? "", size: f?.size ?? 0, mtime: f?.mtime ?? 0 });
    }
    if (path === "/api/latest" && live) {
      const f = logs.newestLog(live), u = new URL(req.url());
      s.latest++;
      if (!f) return route.fulfill({ status: 404, body: "" });
      if (!u.searchParams.has("from")) return route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: logs.readLog(f) });
      const a = logs.latestAnswer(f, u.searchParams.get("file"), u.searchParams.get("from"));
      return json(a.body, a.status);
    }
    if (path === "/api/state") return json({ dir: "", file: "", nativeFrame: false, material: false, stayOnTop: false, ...(zwei ? { kompaktFenster: true, kompakt: { offen: true } } : {}) });
    if (path === "/api/config" && req.method() === "GET") return json({ archivAn: config.archivAn !== false, archivHinweis: 1, ...config });
    if (path === "/api/config" && req.method() === "POST") { s.config.push(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
    if (path === "/api/weeklies" && req.method() === "GET") return weeklies ? json({ ok: true, data: weeklies }) : json({ ok: false }, 404);
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: {} }); }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html" + (zwei || app ? "?win=1" : ""));
  await page.waitForFunction(() => !!document.body.dataset.bereit);
  return s;
}
/* das Datum eines Kampfs als TT.MM.JJJJ, wie die Liste es zeigt (UTC-Felder: at ist die Wanduhr des Logs); so prueft der
   Hauptprozess die Bestaetigung (logDatum in src/main/archiv.ts, Entscheidung 26.10.2026) */
function logTag(at) { return new Date(at).toISOString().slice(0, 10).split("-").reverse().join("."); }
/* auf einen Zustand warten, nie auf eine feste Zeit */
async function bis(fn, ms = 8000) {
  const ende = performance.now() + ms;
  while (performance.now() < ende) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
  return !!(await fn());
}
/* sichtbar: gezeichnet (nicht hidden, kein verborgener Vorfahr) */
const sichtbar = (page, sel) => page.evaluate((x) => { const e = document.querySelector(x); return !!e && e.getClientRects().length > 0; }, sel);
const geprueft = (s) => s.page.evaluate(() => Number(document.body.dataset.archivGeprueft || 0));
async function lade(s, datei) {
  const vorher = await geprueft(s);
  await s.page.setInputFiles("#fileInput", datei);
  return vorher;
}
const nachPost = (s, n, ms) => bis(() => s.posts.length >= n, ms);
const nachGeprueft = (s, n) => bis(async () => (await geprueft(s)) >= n);

/* Ein gesendeter Eintrag nach dem Schema (archiv.ts eintragOf), mit zeilen passend zum Text. */
const SCHLUESSEL = ["k", "platz", "boss", "at", "dps", "dmg", "dur", "c", "ch", "datei", "zeilen"];
function schemaFehler(b) {
  const f = [];
  if (!b) return ["kein POST"];
  if (Object.keys(b).sort().join() !== "eintrag,text") f.push("Schluessel " + Object.keys(b).join());
  const e = b.eintrag || {}, t = b.text;
  if (typeof t !== "string" || !t.length || t.length > 8 * 1024 * 1024) f.push("text");
  for (const k of Object.keys(e)) if (!SCHLUESSEL.includes(k)) f.push("fremder Schluessel " + k);
  if ("geloest" in e) f.push("geloest");
  if (typeof t === "string" && e.zeilen !== t.split("\n").length) f.push("zeilen " + e.zeilen + " statt " + t.split("\n").length);
  if (e.k !== e.datei + "|" + e.at) f.push("k " + e.k);
  for (const k of ["at", "dps", "dmg", "dur"]) if (typeof e[k] !== "number" || !Number.isFinite(e[k])) f.push(k);
  if (e.ch !== undefined && !/^w[0-9a-z]{9}$/.test(e.ch)) f.push("ch " + e.ch);
  return f;
}
const ohneText = (b) => ({ ...b?.eintrag });

try {
  /* ---------- 1. Aufnahme: Trash, Beispiel, Boss, Wiederholung, Wachstum ---------- */
  {
    const s = await oeffne();
    const v0 = await lade(s, L_TRASH);
    await s.page.waitForFunction((n) => (document.querySelector("#hName")?.textContent || "").includes(n), TRASH);
    await s.page.evaluate(() => document.querySelector("#btnSample")?.click());
    await lade(s, L_BOSS);
    assert(await nachPost(s, 1), "Boss: nach dem Laden kommt ein POST /api/archiv/aufnehmen", { posts: s.posts.length });
    // ein zweiter Bosskampf in einer anderen Datei als Wache: was vorher gesendet worden waere, stuende jetzt davor
    await lade(s, L_CHERNO);
    assert(await nachPost(s, 2), "Wache: Chernobog wird gesendet", { posts: s.posts.map(ohneText) });
    const boss = s.posts.map((p) => p.eintrag?.boss);
    assert(boss.join() === "Morokai,Chernobog", "genau ein POST je Bosskampf; Trash und Beispielkampf senden nichts", boss);
    const LEER = { eintrag: {}, text: "" };
    const m = s.posts[0] || LEER;
    assert(!schemaFehler(m).length, "der Eintrag folgt dem Schema, zeilen = Zeilen des gesendeten Texts", { f: schemaFehler(m), e: ohneText(m) });
    assert(s.antworten[0] === 200 && s.antworten[1] === 200, "der echte Speicher nimmt beide an", s.antworten);
    const e = m.eintrag;
    assert(e.platz === "feld:morokai" && e.boss === "Morokai" && e.datei === "archiv-morokai.txt" && e.at === T0 + 5 * MIN && e.dur === 60 && e.c === undefined,
      "Platz, Boss, Datei, Beginn und Dauer des Morokai-Kampfs", e);
    const sum = Array.from({ length: 121 }, (_, i) => 2000 + i).reduce((a, b) => a + b, 0);
    assert(e.dmg === sum, "Schaden: die Summe der Treffer", { dmg: e.dmg, sum });
    assert(!m.text.includes(TRASH) && m.text.startsWith("CombatLogVersion,4\n") && m.text.split("\n").length === 1 + 121,
      "der Text ist der Kopf und nur die Zeilen des Kampfs (der Trash fuenf Minuten vorher fehlt)", { n: m.text.split("\n").length });
    assert(!m.text.endsWith("\n"), "zeilen zaehlt ohne leere letzte Zeile (der Text endet nicht mit einem Zeilenende)");
    assert((s.posts[1] || LEER).eintrag.platz === "feld:chernobog" && !schemaFehler(s.posts[1]).length, "Chernobog: Platz und Schema", ohneText(s.posts[1]));

    // dieselbe Datei noch einmal: nichts Neues; die Puppe als Wache danach
    const v1 = await lade(s, L_BOSS);
    assert(await nachGeprueft(s, v1 + 1), "dieselbe Datei noch einmal: die Seite hat entschieden", { v1, jetzt: await geprueft(s) });
    await lade(s, L_PUPPE);
    assert(await nachPost(s, 3), "Wache: die Uebungspuppe wird gesendet", { posts: s.posts.map(ohneText) });
    assert(s.posts.length === 3 && (s.posts[2] || LEER).eintrag.boss === "Practice Dummy", "dieselbe Datei noch einmal sendet nichts erneut", s.posts.map(ohneText));
    const p = (s.posts[2] || LEER).eintrag;
    assert(p.platz === "puppe:60" && p.c === 60 && !schemaFehler(s.posts[2]).length, "Puppe: Platz puppe:60 mit Laengenklasse 60", p);
    assert(s.listen === 1, "unveraenderter Kampf bei gefuelltem Stand: kein Schnitt, kein POST, keine weitere Frage nach dem Verzeichnis", { listen: s.listen });

    // gewachsen: derselbe Schluessel, mehr Zeilen -> ein POST mehr
    await lade(s, L_GROSS);
    assert(await nachPost(s, 4), "gewachsene Datei: ein POST mehr", { posts: s.posts.map(ohneText) });
    const g = s.posts[3] || LEER;
    assert(g.eintrag.k === e.k && g.eintrag.zeilen > e.zeilen && g.eintrag.dur === 80 && !schemaFehler(g).length && s.antworten[3] === 200,
      "gewachsen: gleicher Schluessel, mehr Zeilen, der Speicher nimmt es", { alt: e.zeilen, neu: ohneText(g) });
    const liste = ar.loadArchiv();
    assert(liste.kaempfe.length === 3 && liste.kaempfe.find((x) => x.k === e.k)?.zeilen === g.eintrag.zeilen,
      "im Verzeichnis: drei Kaempfe, Morokai mit dem gewachsenen Stand", liste.kaempfe);
    assert(!s.fehler.length, "keine Seitenfehler", s.fehler);
    assert(!s.fremd.length, "keine Anfrage ausser an den Helfer", s.fremd);

    /* ---------- 7. Abnahme: das Stueck wieder als Log gelesen ergibt denselben Kampf ---------- */
    const wieder = logDatei("c", "archiv-wieder.txt", m.text.split("\n").slice(1));
    const w = await oeffne();
    await lade(w, wieder);
    assert(await nachPost(w, 1), "Abnahme: das wieder gelesene Stueck wird gesendet");
    const we = w.posts[0]?.eintrag || {};
    assert(typeof we.at === "number" && we.at === e.at && we.dps === e.dps && we.dmg === e.dmg && we.dur === e.dur && we.platz === e.platz && we.boss === e.boss,
      "Abnahme: das Stueck ergibt denselben Kampf (Beginn, DPS, Schaden, Dauer, Platz)", { vorher: e, nachher: we });
    assert(w.posts[0]?.text === m.text, "Abnahme: der Schnitt des Stuecks ist das Stueck selbst");
    assert(!w.fehler.length, "Abnahme: keine Seitenfehler", w.fehler);
    await w.page.close();
    await s.page.close();
  }

  /* ---------- Charakter: die Kennung aus den Weeklies, nie der Name ---------- */
  {
    const weeklies = { v: 1, profile: [{ id: "wprobe0001", name: "Erfunden", log: SPIELER, zaehler: {}, aus: [], namen: {}, eigene: [] }] };
    const s = await oeffne({ weeklies });
    await s.page.click('#bereiche [data-tab="weeklies"]');
    await s.page.waitForFunction(() => document.querySelector("#wkBody")?.dataset.lage === "da");
    await lade(s, logDatei("d", "archiv-ch.txt", kampf("Chernobog", T0 + 120 * MIN, 30)));
    assert(await nachPost(s, 1), "Charakter: der Kampf wird gesendet");
    const e = s.posts[0]?.eintrag || {};
    assert(e.ch === "wprobe0001" && !JSON.stringify(e).includes(SPIELER) && !schemaFehler(s.posts[0]).length,
      "Charakter: ch ist die Kennung, kein Name im Eintrag", e);
    await s.page.close();
  }

  /* ---------- Live: ein laufender Boss wartet, auch wenn ein aelterer Kampf gewaehlt ist (I2),
     und wird nach dem Ende des Kampfs gesendet, waehrend Live weiterlaeuft, ohne weiteren Anstoss (M1) ---------- */
  {
    const lo = join(work, "live");
    mkdirSync(lo, { recursive: true });
    const LDATEI = join(lo, "archiv-live.txt"), MSTART = T0 + 5 * MIN;
    // Chernobog ist vorbei; Morokai laeuft (die ersten 10 s), danach waechst er um je 2 s
    writeFileSync(LDATEI, ["CombatLogVersion,4", ...kampf("Chernobog", T0, 40, 3000), ...kampf("Morokai", MSTART, 10, 2000)].join("\n") + "\n");
    const s = await oeffne({ live: lo });
    await s.page.evaluate(() => document.querySelector("#btnWatch").click());
    assert(await bis(() => s.posts.some((p) => p.eintrag?.boss === "Chernobog"), 15000), "Live: der beendete Kampf (Chernobog) wird gesendet", s.posts.map(ohneText));
    // den aelteren Kampf waehlen: der laufende bleibt der neueste
    await s.page.evaluate(() => [...document.querySelectorAll("#fightList .fight")].pop()?.click());
    await s.page.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Chernobog"));
    let ende = 10;
    for (let n = 0; n < 4; n++) {
      const z = s.latest;
      const neu = [];
      for (let i = 1; i <= 4; i++) neu.push(`${stempel(MSTART + (ende * 2 + i) * 500)},DamageDone,Brutal Arrow,999000002,${2100 + n * 4 + i},0,0,kNormalHit,${SPIELER},Morokai`);
      appendFileSync(LDATEI, neu.join("\n") + "\n");
      ende += 2;
      await bis(() => s.latest > z + 1, 15000);   // zwei Abrufe: das Wachstum ist gelesen
    }
    const waehrend = s.posts.filter((p) => p.eintrag?.boss === "Morokai").length;
    const gewaehlt = await s.page.evaluate(() => document.querySelector("#hName")?.textContent || "");
    assert(waehrend === 0 && /Chernobog/.test(gewaehlt), "Live mit gewaehltem aelterem Kampf: der laufende Boss wird nicht bei jedem Wachstum gesendet", { waehrend, gewaehlt });
    // nichts waechst mehr: nach der Kampftrennung kommt er von selbst, Live laeuft weiter
    assert(await bis(() => s.posts.some((p) => p.eintrag?.boss === "Morokai"), 25000), "Live: nach dem Ende des Kampfs wird der Boss ohne weiteren Anstoss gesendet", s.posts.map(ohneText));
    const mo = s.posts.filter((p) => p.eintrag?.boss === "Morokai");
    const an = await s.page.evaluate(() => document.querySelector("#btnWatch")?.classList.contains("on"));
    assert(mo.length === 1 && mo[0].eintrag.dur === ende && mo[0].eintrag.at === MSTART && !schemaFehler(mo[0]).length && an,
      "Live: genau ein POST mit dem ganzen Kampf, Live ist noch an", { mo: mo.map(ohneText), ende, an });
    assert(!s.fehler.length, "Live: keine Seitenfehler", s.fehler);
    await s.page.close();
  }

  /* ---------- Archiv aus: nichts wird gesendet ---------- */
  {
    const s = await oeffne({ config: { archivAn: false } });
    const v = await lade(s, L_BOSS);
    assert(await nachGeprueft(s, v + 1), "archivAn false: die Seite hat ueber den Kampf entschieden", { jetzt: await geprueft(s) });
    assert(!s.posts.length && !s.listen, "archivAn false: kein POST, nicht einmal das Verzeichnis", { posts: s.posts.length, listen: s.listen });
    assert(!s.fehler.length, "archivAn false: keine Seitenfehler", s.fehler);
    // ausgeschaltet zeigt Start keinen Hinweis, auch wenn er nie quittiert wurde
    const h = await oeffne({ config: { archivAn: false, archivHinweis: 0 } });
    await h.page.waitForFunction(() => document.querySelector("#eArchiv")?.getAttribute("aria-checked") === "false");
    assert(!(await sichtbar(h.page, "#landArchiv")), "archivAn false: kein Hinweis auf Start");
    await h.page.close();
    await s.page.close();
  }

  /* ---------- Erster Start: der Hinweis, und erst nach "Verstanden" nimmt das Archiv auf (Spezifikation 6) ---------- */
  {
    const s = await oeffne({ config: { archivHinweis: 0 } });
    await s.page.waitForFunction(() => { const e = document.querySelector("#landArchiv"); return !!e && !e.hidden; });
    const h = await s.page.evaluate(() => { const e = document.querySelector("#landArchiv");
      return { text: e.textContent.replace(/\s+/g, " ").trim(), in: !!e.closest("#land"), ok: document.querySelector("#landArchivOk")?.textContent.trim(),
        einst: document.querySelector("#landArchivEinst")?.textContent.trim(), name: e.getAttribute("aria-labelledby") && document.getElementById(e.getAttribute("aria-labelledby"))?.textContent.trim() }; });
    assert(h.in && /Bosskämpfe/.test(h.text) && /nur auf diesem PC/.test(h.text) && /links im Bereich „Archiv“/.test(h.text) && /Einstellungen/.test(h.text) && h.ok === "Verstanden" && h.einst === "Einstellungen" && h.name,
      "archivHinweis 0: auf Start steht der Hinweis (mit dem Weg zum Bereich Archiv) mit „Verstanden“ und „Einstellungen“, als benannter Abschnitt", h);
    assert(!/\bBau\b/.test(h.text), "Hinweis: kein „Bau“", h.text);
    // Vorleser: „Verstanden“ nennt den Satz, den es quittiert (aria-describedby)
    const bs = await s.page.evaluate(() => { const b = document.querySelector("#landArchivOk"); const id = b?.getAttribute("aria-describedby");
      return { id, text: id ? (document.getElementById(id)?.textContent || "").replace(/\s+/g, " ").trim() : "" }; });
    assert(bs.id === "landArchivSatz" && /nur auf diesem PC/.test(bs.text), "Start: „Verstanden“ ist mit dem Satz des Archivs beschrieben", bs);
    const v = await lade(s, L_BOSS);
    assert(await nachGeprueft(s, v + 1), "archivHinweis 0: die Seite hat ueber den Kampf entschieden", { jetzt: await geprueft(s) });
    assert(!s.posts.length && !s.listen, "archivHinweis 0: kein POST, nicht einmal das Verzeichnis", { posts: s.posts.length, listen: s.listen });
    assert(!s.fehler.length, "archivHinweis 0: keine Seitenfehler", s.fehler);
    await s.page.close();
    // meldet der Hauptprozess archivHinweis nicht (er kennt kein Archiv): kein Hinweis und keine Aufnahme
    const o = await oeffne({ config: { archivHinweis: undefined } });
    // die Entscheidung ueber den Kampf faellt erst nach den Einstellungen (konfigGelesen): dann steht auch Start
    const vo = await lade(o, L_BOSS);
    assert(await nachGeprueft(o, vo + 1) && !o.posts.length && !o.listen && await o.page.evaluate(() => document.querySelector("#landArchiv")?.hidden === true),
      "ohne archivHinweis in /api/config: kein Hinweis, kein POST", { posts: o.posts.length, listen: o.listen });
    await o.page.close();
  }
  {
    // mit der Tastatur: Tab bis "Verstanden", Leertaste; danach nimmt das Archiv auf
    const s = await oeffne({ config: { archivHinweis: 0 } });
    await s.page.waitForFunction(() => { const e = document.querySelector("#landArchiv"); return !!e && !e.hidden; });
    let n = 0;
    while (n++ < 80 && !(await s.page.evaluate(() => document.activeElement?.id === "landArchivOk"))) await s.page.keyboard.press("Tab");
    assert(await s.page.evaluate(() => document.activeElement?.id === "landArchivOk"), "Tastatur: „Verstanden“ ist mit Tab erreichbar", n);
    await s.page.keyboard.press("Space");
    assert(await bis(() => s.config.some((b) => b.archivHinweis === 1)), "„Verstanden“ schreibt archivHinweis 1", s.config);
    assert(s.config.every((b) => JSON.stringify(b) === '{"archivHinweis":1}'), "„Verstanden“ schreibt nur archivHinweis", s.config);
    await s.page.waitForFunction(() => document.querySelector("#landArchiv")?.hidden === true);
    const fokus = await s.page.evaluate(() => document.activeElement && document.activeElement !== document.body && !!document.activeElement.closest("#land"));
    assert(fokus, "nach „Verstanden“ bleibt der Fokus auf Start, nicht auf body");
    await lade(s, L_NEU1);   // ein Kampf, den der Speicher noch nicht hat (Morokai und Chernobog liegen schon dort)
    assert(await nachPost(s, 1), "nach „Verstanden“ nimmt das Archiv auf", { posts: s.posts.length });
    assert(!s.fehler.length, "Verstanden: keine Seitenfehler", s.fehler);
    await s.page.close();
  }

  /* ---------- Erster Start im eigenen Fenster: eine Karte, nicht zwei (#265 #rgFrageZusatz) ----------
     Fragt Start nach dem Rundgang (63, #rgFrage), steht der Satz des Archivs in dieser Frage, mit eigenem
     "Verstanden"; der Hinweis auf Start wartet. Die Knoepfe der Frage quittieren das Archiv nicht. */
  const ERST = { lang: "de", archivHinweis: 0, firstStart: true, rundgangGesehen: false, logIndex: {}, bereichHinweise: false };
  const frageStand = (s) => s.page.evaluate(() => {
    const sicht = (e) => !!e && e.getClientRects().length > 0;
    const z = document.querySelector("#rgFrageZusatz");
    const saetze = [...document.querySelectorAll("#landArchiv, #rgFrageZusatz")].filter(sicht).length;
    return { band: sicht(document.querySelector("#rgFrage")), land: sicht(document.querySelector("#landArchiv")), zusatz: sicht(z),
      text: z ? z.textContent.replace(/\s+/g, " ").trim() : "", ok: document.querySelector("#rgFrageArchivOk")?.textContent.trim() || "",
      knoepfe: [...document.querySelectorAll("#rgFrage button")].filter(sicht).map((b) => b.id), saetze,
      von: document.querySelector("#rundgang")?.dataset.vonSelbst || "" };
  });
  {
    const s = await oeffne({ app: true, config: ERST });
    await s.page.waitForFunction(() => { const b = document.querySelector("#rgFrage"); return !!b && !b.hidden && !!document.querySelector("#rgFrageArchivOk"); });
    const a = await frageStand(s);
    assert(a.band && a.von === "ja" && a.zusatz && !a.land && a.saetze === 1,
      "erster Start: der Satz des Archivs steht in der Frage, der Hinweis auf Start nicht - eine Karte", a);
    assert(/Bosskämpfe/.test(a.text) && /nur auf diesem PC/.test(a.text) && /links im Bereich „Archiv“/.test(a.text) && /Einstellungen/.test(a.text) && a.ok === "Verstanden" && !/\bBau\b/.test(a.text),
      "erster Start: der Satz in der Frage sagt Bosskaempfe, nur auf diesem PC, den Bereich Archiv, Einstellungen, mit „Verstanden“", a);
    assert(JSON.stringify(a.knoepfe) === '["rgFrageArchivOk","rgFrageNein","rgFrageSpaeter","rgFrageJa"]',
      "erster Start: „Verstanden“ des Archivs kommt vor den drei Knoepfen der Frage", a.knoepfe);
    // Vorleser: „Verstanden“ in der Karte „Rundgang“ quittiert hoerbar das Archiv, nicht den Rundgang
    const bf = await s.page.evaluate(() => { const b = document.querySelector("#rgFrageArchivOk"); const id = b?.getAttribute("aria-describedby");
      return { id, text: id ? (document.getElementById(id)?.textContent || "").replace(/\s+/g, " ").trim() : "" }; });
    assert(bf.id === "rgFrageArchivSatz" && /nur auf diesem PC/.test(bf.text), "erster Start: „Verstanden“ in der Frage ist mit dem Satz des Archivs beschrieben", bf);
    // vor "Verstanden" nimmt das Archiv nichts auf, auch in der Frage nicht
    await s.page.focus("#rgFrageArchivOk");
    await s.page.keyboard.press("Space");
    assert(await bis(() => s.config.some((b) => b.archivHinweis === 1)), "„Verstanden“ in der Frage schreibt archivHinweis 1", s.config);
    assert(s.config.every((b) => JSON.stringify(b) === '{"archivHinweis":1}'), "„Verstanden“ in der Frage schreibt nur archivHinweis", s.config);
    await s.page.waitForFunction(() => document.querySelector("#rgFrageZusatz")?.hidden === true);
    const b = await frageStand(s);
    assert(b.band && !b.zusatz && !b.text && !b.land && b.saetze === 0 && JSON.stringify(b.knoepfe) === '["rgFrageNein","rgFrageSpaeter","rgFrageJa"]',
      "nach „Verstanden“: die Frage nach dem Rundgang bleibt, ihr Zusatz ist leer, auf Start kein Hinweis", b);
    assert(await s.page.evaluate(() => document.activeElement?.id === "rgFrageNein"), "nach „Verstanden“ in der Frage geht der Fokus auf ihren ersten Knopf");
    await lade(s, L_NEU3);   // ein Kampf, den der Speicher noch nicht hat
    assert(await nachPost(s, 1), "nach „Verstanden“ in der Frage nimmt das Archiv auf", { posts: s.posts.length });
    assert(!s.fehler.length, "Frage mit Archiv: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  {
    // "Nein, danke" ohne "Verstanden": die Frage geht, der Hinweis steht danach auf Start, und es wird nichts aufgenommen
    const s = await oeffne({ app: true, config: ERST });
    await s.page.waitForFunction(() => !!document.querySelector("#rgFrageArchivOk"));
    await s.page.click("#rgFrageNein");
    await s.page.waitForFunction(() => { const e = document.querySelector("#landArchiv"); return !!e && !e.hidden; });
    const a = await frageStand(s);
    assert(!a.band && a.land && !a.zusatz && a.saetze === 1, "„Nein, danke“ quittiert das Archiv nicht: danach steht sein Hinweis auf Start", a);
    assert(!s.config.some((b) => "archivHinweis" in b), "„Nein, danke“ schreibt kein archivHinweis", s.config);
    const v = await lade(s, L_BOSS);
    assert(await nachGeprueft(s, v + 1) && !s.posts.length && !s.listen, "ohne „Verstanden“: kein POST", { posts: s.posts.length, listen: s.listen });
    await s.page.click('#bereiche [data-tab="start"]');
    await s.page.click("#landArchivOk");
    assert(await bis(() => s.config.some((b) => b.archivHinweis === 1)), "danach quittiert „Verstanden“ auf Start", s.config);
    assert(!s.fehler.length, "Nein ohne Verstanden: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  {
    // "Rundgang zeigen" ohne "Verstanden": ebenso - der Hinweis kommt auf Start, unter der Karte des Rundgangs
    const s = await oeffne({ app: true, config: ERST });
    await s.page.waitForFunction(() => !!document.querySelector("#rgFrageArchivOk"));
    await s.page.click("#rgFrageJa");
    await s.page.waitForFunction(() => { const e = document.querySelector("#landArchiv"); return !!e && !e.hidden; });
    const a = await frageStand(s);
    assert(!a.band && a.land && a.saetze === 1 && !s.config.some((b) => "archivHinweis" in b), "„Rundgang zeigen“ quittiert das Archiv nicht", { a, config: s.config });
    await s.page.close();
  }
  {
    // ohne Frage (Bestand, kein erster Start) bleibt es beim Hinweis auf Start, auch im eigenen Fenster; quittiert: nirgends
    const s = await oeffne({ app: true, config: { archivHinweis: 0, firstStart: false, bereichHinweise: false } });
    await s.page.waitForFunction(() => { const e = document.querySelector("#landArchiv"); return !!e && !e.hidden; });
    const a = await frageStand(s);
    assert(!a.band && a.von === "nein" && a.land && !a.zusatz && !a.text && a.saetze === 1, "Bestand im eigenen Fenster: keine Frage, der Hinweis auf Start", a);
    await s.page.close();
    const q = await oeffne({ app: true, config: { ...ERST, archivHinweis: 1 } });
    await q.page.waitForFunction(() => { const b = document.querySelector("#rgFrage"); return !!b && !b.hidden; });
    const b = await frageStand(q);
    assert(b.band && !b.zusatz && !b.text && !b.land && b.saetze === 0, "erster Start, Archiv schon quittiert: die Frage ohne Zusatz", b);
    await q.page.close();
    const e = await oeffne({ app: true, lang: "en", config: { ...ERST, lang: "en" } });
    await e.page.waitForFunction(() => !!document.querySelector("#rgFrageArchivOk"));
    const c = await frageStand(e);
    assert(/boss fights/.test(c.text) && /only on this PC/.test(c.text) && /Archive area on the left/.test(c.text) && c.ok === "Got it" && !/[äöüß]/.test(c.text) && !c.land, "EN: der Satz in der Frage englisch", c);
    assert(!e.fehler.length, "EN Frage: keine Seitenfehler", e.fehler);
    await e.page.close();
  }
  {
    // "Einstellungen" im Hinweis fuehrt zum Abschnitt Archiv; der Schalter dort quittiert den Hinweis mit
    const s = await oeffne({ config: { archivHinweis: 0 } });
    await s.page.waitForFunction(() => { const e = document.querySelector("#landArchiv"); return !!e && !e.hidden; });
    await s.page.click("#landArchivEinst");
    await s.page.waitForFunction(() => document.activeElement?.id === "egh-archiv" && !document.querySelector("#einst").hidden);
    assert(!s.config.length, "„Einstellungen“ quittiert nichts", s.config);
    await s.page.click("#eArchiv");
    assert(await bis(() => s.config.some((b) => b.archivAn === false) && s.config.some((b) => b.archivHinweis === 1)),
      "der Schalter schreibt archivAn false und quittiert den Hinweis", s.config);
    await s.page.click('#bereiche [data-tab="start"]');
    await s.page.waitForFunction(() => !document.querySelector("#land").hidden);
    assert(!(await sichtbar(s.page, "#landArchiv")), "nach dem Schalter steht der Hinweis nicht mehr auf Start");
    await s.page.close();
  }

  /* ---------- Einstellungen: Abschnitt Archiv mit Schalter und Archivordner ---------- */
  {
    const s = await oeffne();
    await s.page.click('#bereiche [data-tab="settings"]');
    await s.page.click('#einstNav button[data-gruppe="archiv"]');
    await s.page.waitForFunction(() => document.activeElement?.id === "egh-archiv");
    const z = await s.page.evaluate(() => {
      const sw = document.querySelector("#eArchiv"), g = document.querySelector("#eg-archiv");
      const seh = (sel) => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; };
      return { h: document.querySelector("#egh-archiv")?.textContent.trim(), an: sw?.getAttribute("aria-checked"), rolle: sw?.getAttribute("role"),
        wort: sw?.querySelector(".esw-w")?.textContent.trim(), satz: document.querySelector("#eArchivSatz")?.textContent.trim(),
        browser: seh("#eArchivBrowser"), knopf: seh("#eArchivOrdner"), knopfText: document.querySelector("#eArchivOrdner")?.textContent.trim(),
        lab: sw && document.getElementById(sw.getAttribute("aria-labelledby"))?.textContent.trim(), text: g?.textContent.replace(/\s+/g, " ") || "" };
    });
    assert(z.h === "Archiv" && z.rolle === "switch" && z.an === "true" && z.wort === "An" && z.lab && /nur auf diesem PC/.test(z.satz || "") && /bleibt/.test(z.satz || ""),
      "Abschnitt Archiv: Schalter an (Standard), benannt, der Satz sagt, was er tut und dass Vorhandenes bleibt", z);
    assert(!z.browser && z.knopf && z.knopfText === "Archivordner öffnen", "in der App: „Archivordner öffnen“, kein Satz zum Browser", z);
    assert(!/\bBau\b/.test(z.text), "kein „Bau“", z.text);
    // Info › „Nur gelesen“: die Zeile „Schreibt“ nennt den Archivordner mit (die Aufzaehlung der eigenen Ordner bleibt wahr)
    const schreibt = await s.page.evaluate(() => document.querySelector('[data-i18n-html="einst.sichSchreibtSatz"]')?.textContent.replace(/\s+/g, " ").trim() || "");
    assert(/Logs/.test(schreibt) && /Bug-Reports/.test(schreibt) && /\barchiv\b/.test(schreibt) && /Archiv an ist/.test(schreibt),
      "Info: „Schreibt“ nennt den Ordner archiv, solange das Archiv an ist", schreibt);
    // Schalter aus: archivAn false, danach nimmt das Archiv nichts auf
    await s.page.click("#eArchiv");
    assert(await bis(() => s.config.some((b) => b.archivAn === false)), "Schalter: Klick schreibt archivAn false", s.config);
    assert(await s.page.evaluate(() => document.querySelector("#eArchiv").getAttribute("aria-checked") === "false" && document.querySelector("#eArchiv .esw-w").textContent.trim() === "Aus"),
      "Schalter: steht auf Aus");
    const v = await lade(s, L_BOSS);
    assert(await nachGeprueft(s, v + 1) && !s.posts.length, "ausgeschaltet: kein POST", { posts: s.posts.length });
    // zurueck und mit der Leertaste wieder an
    await s.page.click('#bereiche [data-tab="settings"]');
    await s.page.click('#einstNav button[data-gruppe="archiv"]');
    await s.page.focus("#eArchiv");
    await s.page.keyboard.press("Space");
    assert(await bis(() => s.config.some((b) => b.archivAn === true)), "Schalter: Leertaste schreibt archivAn true", s.config);
    // der Verlauf schreibt logIndex; was der Abschnitt schreibt, nennt das Archiv und nur das
    const archivPosts = s.config.filter((b) => Object.keys(b).some((k) => k.startsWith("archiv")));
    assert(archivPosts.length === 2 && archivPosts.every((b) => Object.keys(b).every((k) => k === "archivAn" || k === "archivHinweis")),
      "der Abschnitt schreibt nur archivAn (und archivHinweis)", s.config);
    await lade(s, L_NEU2);
    assert(await nachPost(s, 1), "wieder an: der naechste Bosskampf wird gesendet", { posts: s.posts.length });
    // Archivordner oeffnen: ein POST mit JSON an /api/archiv/ordner, mit der Tastatur
    await s.page.click('#bereiche [data-tab="settings"]');
    await s.page.click('#einstNav button[data-gruppe="archiv"]');
    await s.page.focus("#eArchivOrdner");
    await s.page.keyboard.press("Enter");
    assert(await bis(() => s.ordner.length === 1), "„Archivordner öffnen“ sendet POST /api/archiv/ordner", s.ordner);
    assert(/application\/json/.test(s.ordner[0]?.typ || "") && !/[\\/:]/.test(s.ordner[0]?.body || ""), "mit JSON, ohne Pfad", s.ordner);
    assert(!s.fehler.length, "Einstellungen: keine Seitenfehler", s.fehler);
    await s.page.close();
  }

  /* ---------- Englisch ---------- */
  {
    const s = await oeffne({ lang: "en", config: { archivHinweis: 0 } });
    await s.page.waitForFunction(() => { const e = document.querySelector("#landArchiv"); return !!e && !e.hidden; });
    const h = await s.page.evaluate(() => ({ text: document.querySelector("#landArchiv").textContent.replace(/\s+/g, " ").trim(),
      ok: document.querySelector("#landArchivOk").textContent.trim(), einst: document.querySelector("#landArchivEinst").textContent.trim() }));
    assert(/boss fights/.test(h.text) && /only on this PC/.test(h.text) && /Archive area on the left/.test(h.text) && h.ok === "Got it" && h.einst === "Settings" && !/[äöüß]/.test(h.text), "EN: der Hinweis englisch", h);
    await s.page.click('#bereiche [data-tab="settings"]');
    const z = await s.page.evaluate(() => ({ h: document.querySelector("#egh-archiv").textContent.trim(), satz: document.querySelector("#eArchivSatz").textContent.trim(),
      knopf: document.querySelector("#eArchivOrdner").textContent.trim(), nav: document.querySelector('#einstNav button[data-gruppe="archiv"]').textContent.trim(),
      wort: document.querySelector("#eArchiv .esw-w").textContent.trim(),
      schreibt: document.querySelector('[data-i18n-html="einst.sichSchreibtSatz"]')?.textContent.replace(/\s+/g, " ").trim() || "" }));
    assert(/\barchiv\b/.test(z.schreibt) && /archive is on/.test(z.schreibt), "EN: Info „Writes“ names the folder archiv while the archive is on", z.schreibt);
    assert(z.h === "Archive" && z.nav === "Archive" && /only on this PC/.test(z.satz) && z.knopf === "Open archive folder" && z.wort === "On", "EN: der Abschnitt englisch", z);
    assert(!s.fehler.length, "EN: keine Seitenfehler", s.fehler);
    await s.page.close();
  }

  /* ---------- 560 px und 2000 x 1480: nichts rollt quer, nichts streckt sich ---------- */
  for (const viewport of [{ width: 560, height: 900 }, { width: 2000, height: 1480 }]) {
    const s = await oeffne({ config: { archivHinweis: 0 }, viewport });
    await s.page.waitForFunction(() => { const e = document.querySelector("#landArchiv"); return !!e && !e.hidden; });
    const quer = () => s.page.evaluate(() => document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth
      && [...document.querySelectorAll("#land, #einst")].every((e) => e.hidden || e.scrollWidth <= e.clientWidth + 1));
    const breit = (sel) => s.page.evaluate((x) => Math.round(document.querySelector(x).getBoundingClientRect().width), sel);
    assert(await quer(), `${viewport.width} px: Start mit Hinweis rollt nicht quer`);
    const hb = await breit("#landArchiv");
    assert(hb <= 640 && hb > 200, `${viewport.width} px: der Hinweis bleibt in der Spalte (hoechstens 640 Punkt)`, hb);
    await s.page.click('#bereiche [data-tab="settings"]');
    await s.page.click('#einstNav button[data-gruppe="archiv"]');
    await s.page.waitForFunction(() => document.activeElement?.id === "egh-archiv");
    assert(await quer(), `${viewport.width} px: Einstellungen mit Archiv rollen nicht quer`);
    const gb = await breit("#eg-archiv");
    assert(gb <= 790, `${viewport.width} px: der Abschnitt Archiv bleibt in der Breite der Einstellungen`, gb);
    // die Zeile „Alte Logs einlesen“ (hier aus: der Hinweis ist offen) steht ganz in der Spalte, Knopf und Satz sichtbar
    const al = await s.page.evaluate(() => { const z = document.querySelector("#eAlteLogsZeile"), b = document.querySelector("#eAlteLogs"), g = document.querySelector("#eg-archiv");
      const r = z?.getBoundingClientRect(), br = b?.getBoundingClientRect(), gr = g?.getBoundingClientRect();
      return { da: !!r && r.height > 0, h: Math.round(r?.height ?? 0), drin: !!br && !!gr && br.right <= gr.right + 1 && br.left >= gr.left - 1,
        grund: (document.querySelector("#eAlteLogsGrund")?.getClientRects().length ?? 0) > 0 }; });
    assert(al.da && al.drin && al.grund && al.h <= 200, `${viewport.width} px: die Zeile „Alte Logs einlesen“ steht in der Spalte, mit Knopf und Satz`, al);
    assert(!s.fehler.length, `${viewport.width} px: keine Seitenfehler`, s.fehler);
    await s.page.close();
  }

  /* ---------- Gruppensumme ("alle" bei mehreren Angreifern): nie ins Archiv ---------- */
  {
    const s = await oeffne();
    const zwei = [...kampf("Morokai", T0 + 200 * MIN, 30, 2000), ...kampf("Morokai", T0 + 200 * MIN + 250, 30, 1000).map((z) => z.replace(SPIELER, "Probe8"))].sort();
    await lade(s, logDatei("g", "archiv-gruppe.txt", zwei));
    await s.page.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Morokai"));
    const spieler = await s.page.evaluate(() => [...document.querySelectorAll("#fightList .fight")].length);
    await lade(s, logDatei("g", "archiv-wache.txt", kampf("Chernobog", T0 + 230 * MIN, 30, 3000)));
    assert(await nachPost(s, 1), "Gruppe: die Wache wird gesendet", s.posts.map(ohneText));
    assert(s.posts.length === 1 && s.posts[0].eintrag.boss === "Chernobog", "Gruppensumme unter „alle“: kein POST (nie dein bester Pull)", { posts: s.posts.map(ohneText), spieler });
    assert(!s.fehler.length, "Gruppe: keine Seitenfehler", s.fehler);
    await s.page.close();
  }

  /* ---------- Mehrere Logs zusammen: der lange Name ("a + b + c") wird archiviert ---------- */
  {
    const s = await oeffne();
    const n = (x) => "TL_CombatLog_2026-09-20_lang_" + x + ".txt";
    const f1 = logDatei("m", n("eins"), kampf("Morokai", T0 + 240 * MIN, 30, 2000));
    const f2 = logDatei("m", n("zwei"), kampf("Chernobog", T0 + 250 * MIN, 30, 2000));
    const f3 = logDatei("m", n("drei"), kampf(TRASH, T0 + 260 * MIN, 20));
    await s.page.setInputFiles("#fileInput", [f1, f2, f3]);
    assert(await nachPost(s, 2), "drei Logs zusammen: beide Bosskaempfe werden gesendet", s.posts.map(ohneText));
    const d = s.posts[0]?.eintrag?.datei || "";
    assert(d.length > 80 && d.split(" + ").length === 3 && s.antworten.every((x) => x === 200) && s.posts.every((b) => !schemaFehler(b).length),
      "drei Logs zusammen: datei mit drei Namen (" + d.length + " Zeichen), der Speicher nimmt es", { d, antworten: s.antworten });
    await s.page.close();
  }

  /* ---------- Das Archiv kann nicht schreiben (503): ein ruhiger Satz in den Einstellungen, nach Erfolg weg ---------- */
  {
    const s = await oeffne();
    const satz = () => s.page.evaluate(() => { const e = document.querySelector("#eArchivFehler"); return e && e.getClientRects().length > 0 ? e.textContent.trim() : ""; });
    s.stoer.liste = 503;
    let v = await lade(s, logDatei("f", "archiv-f1.txt", kampf("Morokai", T0 + 300 * MIN, 30, 2000)));
    assert(await nachGeprueft(s, v + 1) && !s.posts.length, "Verzeichnis 503: kein POST");
    await s.page.click('#bereiche [data-tab="settings"]');
    await s.page.click('#einstNav button[data-gruppe="archiv"]');
    assert(await bis(async () => /nicht schreiben/.test(await satz())), "Verzeichnis 503: der Satz steht im Abschnitt Archiv", await satz());
    const toast = await s.page.evaluate(() => [...document.querySelectorAll("#toast.on")].map((e) => e.textContent).join(" "));
    assert(!/Archiv/.test(toast), "kein Toast", toast);
    // jetzt geht das Verzeichnis, aber das Schreiben nicht
    s.stoer.liste = null; s.stoer.post = 503;
    v = await lade(s, logDatei("f", "archiv-f2.txt", kampf("Chernobog", T0 + 310 * MIN, 30, 2000)));
    assert(await nachPost(s, 1) && await nachGeprueft(s, v + 1), "POST 503: gesendet und abgelehnt");
    await s.page.click('#bereiche [data-tab="settings"]');
    await s.page.click('#einstNav button[data-gruppe="archiv"]');
    assert(/nicht schreiben/.test(await satz()), "POST 503: der Satz steht weiter", await satz());
    // wieder gut: der naechste Kampf geht durch, der Satz ist weg
    s.stoer.post = null;
    await lade(s, logDatei("f", "archiv-f3.txt", kampf("Morokai", T0 + 320 * MIN, 30, 2100)));
    assert(await bis(() => s.antworten.includes(200)), "danach: ein POST geht durch", s.antworten);
    await s.page.click('#bereiche [data-tab="settings"]');
    await s.page.click('#einstNav button[data-gruppe="archiv"]');
    assert(await bis(async () => (await satz()) === ""), "nach dem Erfolg ist der Satz weg", await satz());
    assert(!s.fehler.length, "503: keine Seitenfehler", s.fehler);
    await s.page.close();
    // Englisch
    const e = await oeffne({ lang: "en" });
    e.stoer.liste = 503;
    const ve = await lade(e, logDatei("f", "archiv-f4.txt", kampf("Morokai", T0 + 330 * MIN, 30, 2000)));
    await nachGeprueft(e, ve + 1);
    await e.page.click('#bereiche [data-tab="settings"]');
    await e.page.click('#einstNav button[data-gruppe="archiv"]');
    const en = await e.page.evaluate(() => document.querySelector("#eArchivFehler")?.textContent.trim() || "");
    assert(/can.t write/i.test(en) && !/[äöüß]/.test(en), "EN: der Satz englisch", en);
    await e.page.close();
  }

  /* ---------- Rekorde lesen nur das neue Ende (ab > 0): der erste Kampf darin kann angeschnitten sein und bleibt draussen ---------- */
  {
    const ro = join(work, "rekorde");
    mkdirSync(ro, { recursive: true });
    const name = "archiv-rk.txt";
    const vorn = ["CombatLogVersion,4", ...kampf("Chernobog", T0 + 400 * MIN, 40, 3000)];
    // die Grenze der letzten Lesung liegt mitten im Chernobog-Kampf
    const bisher = vorn.slice(0, 40).join("\n") + "\n";
    const ganz = [...vorn, ...kampf("Morokai", T0 + 410 * MIN, 30, 2000)].join("\n") + "\n";
    writeFileSync(join(ro, name), ganz);
    const bytes = Buffer.byteLength(bisher);
    const logIndex = { [name]: { size: bisher.length, bytes, nach: true, fights: [{ name: "Chernobog", dps: 1, dmg: 1, dur: 1, at: T0 + 400 * MIN, top: 1, topSid: "" }] } };
    const s = await oeffne({ rekorde: ro, config: { logIndex } });
    await s.page.click('#bereiche [data-tab="rekorde"]');
    assert(await nachPost(s, 1, 15000), "Rekorde (neues Ende): der ganze Kampf danach wird gesendet", s.posts.map(ohneText));
    const v = await geprueft(s);
    await lade(s, logDatei("r", "archiv-rk-wache.txt", kampf("Morokai", T0 + 500 * MIN, 30, 2000)));
    assert(await nachPost(s, 2), "Rekorde: die Wache wird gesendet", { v });
    const bosse = s.posts.map((p) => p.eintrag?.boss + "@" + p.eintrag?.datei);
    assert(bosse.join() === "Morokai@archiv-rk.txt,Morokai@archiv-rk-wache.txt",
      "Rekorde (neues Ende): der angeschnittene erste Kampf kommt nicht ins Archiv", bosse);
    assert(!s.fehler.length, "Rekorde: keine Seitenfehler", s.fehler);
    await s.page.close();
  }

  /* ==================== Die Suche: der Bereich Archiv (Spezifikation 7, Aufbau B; Plan Aufgabe 8) ====================
     Ein gestelltes Verzeichnis mit erfundenen Kaempfen: Morokai dreimal (einer mit Charakter), Chernobog nur geloest,
     die Puppe in der Klasse 60, Lyxara (Dungeon "Hoehle der Untoten Koenigin"). Nur der Morokai-Kampf M1 hat Zeilen. */
  const CH = "wprobe0001";
  const TAG = 24 * 60 * MIN;
  const DA = "archiv-such-a.txt", DB = "archiv-such-b.txt", DC = "archiv-such-c.txt";
  const M1 = T0 + 600 * MIN, M2 = T0 + 2 * TAG, M3 = T0 - TAG;
  const eintrag = (platz, boss, datei, at, dps, dur, mehr = {}) => ({ k: datei + "|" + at, platz, boss, at, dps, dmg: dps * dur, dur, datei, zeilen: 2 * dur + 2, ...mehr });
  const VERZ = [
    eintrag("feld:morokai", "Morokai", DA, M1, 301000, 60, { ch: CH }),
    eintrag("feld:morokai", "Morokai", DB, M2, 466812, 95),
    eintrag("feld:morokai", "Morokai", DC, M3, 250000, 42),
    eintrag("feld:chernobog", "Chernobog", DA, M1 + 30 * MIN, 999999, 40, { geloest: true }),
    eintrag("puppe:60", "Practice Dummy", DA, M1 + 60 * MIN, 12345, 61, { c: 60 }),
    eintrag("dungeon:lyxara", "Lyxara", DB, M2 + 60 * MIN, 98765, 300),
  ];
  const TEXTE = { [VERZ[0].k]: ["CombatLogVersion,4", ...kampf("Morokai", M1, 60, 2000)].join("\n") };
  const WK = { v: 1, profile: [{ id: CH, name: "Erfunden", log: SPIELER, zaehler: {}, aus: [], namen: {}, eigene: [] }] };
  const archivOffen = (s) => s.page.waitForFunction(() => { const a = document.querySelector("#archiv"); return !!a && !a.hidden && document.querySelectorAll("#arBosse [role=option]").length > 0; });
  const zeile = (s, ort) => s.page.evaluate((o) => { const e = document.querySelector('#arBosse [role=option][data-ort="' + o + '"]');
    return e ? { text: e.textContent.replace(/\s+/g, " ").trim(), leer: e.classList.contains("leer"), gewaehlt: e.getAttribute("aria-selected"), h: Math.round(e.getBoundingClientRect().height) } : null; }, ort);
  const kaempfeText = (s) => s.page.evaluate(() => [...document.querySelectorAll("#arKaempfe [role=option]")].map((e) => [...e.children].map((c) => c.textContent.trim())));
  const suche = async (s, q) => { await s.page.fill("#arSuche", q); await s.page.waitForFunction((x) => document.querySelector("#arBosse")?.dataset.frage === x, q); };
  const ansage = (s) => s.page.evaluate(() => document.querySelector("#arAnsage")?.textContent.trim() || "");
  const satzAr = (s) => s.page.evaluate(() => { const e = document.querySelector("#arSatz"); return e && e.getClientRects().length ? e.textContent.replace(/\s+/g, " ").trim() : ""; });

  {
    const s = await oeffne({ verzeichnis: VERZ, texte: TEXTE, weeklies: WK });
    /* der Knopf: in der Leiste neben den Rekorden, mit Namen fuer den Vorleser und Blase, mit der Tastatur erreichbar */
    const k = await s.page.evaluate(() => {
      const b = document.querySelector('#bereiche [data-tab="archiv"]');
      const folge = [...document.querySelectorAll("#bereiche .tab")].map((x) => x.dataset.tab);
      return b ? { vh: b.querySelector(".vh")?.textContent.trim(), tip: b.querySelector(".btip")?.textContent.trim(), svg: b.querySelector("svg")?.getAttribute("stroke"),
        aria: b.querySelector("svg")?.getAttribute("aria-hidden"), nach: folge[folge.indexOf("archiv") - 1], vor: folge[folge.indexOf("archiv") + 1], typ: b.type, an: !b.disabled } : null; });
    assert(k && k.vh === "Archiv" && k.tip === "Archiv" && k.svg === "currentColor" && k.aria === "true" && k.nach === "rekorde" && k.vor === "start" && k.typ === "button" && k.an,
      "Archiv: der Knopf steht in der Leiste nach den Rekorden, mit Namen, Blase und Liniensymbol, ohne Log nutzbar", k);
    assert(await s.page.getByRole("button", { name: "Archiv", exact: true }).count() === 1, "Archiv: der Vorleser findet genau einen Knopf „Archiv“");
    // Tastatur: der Tabstopp der Leiste ist Start; Pfeil hoch fuehrt zum Archiv und oeffnet es
    await s.page.focus('#bereiche .tab[tabindex="0"]');
    await s.page.keyboard.press("ArrowUp");
    assert(await s.page.evaluate(() => document.activeElement?.dataset?.tab === "archiv"), "Tastatur: von Start mit Pfeil hoch auf das Archiv");
    await archivOffen(s);
    const o = await s.page.evaluate(() => ({ app: document.querySelector("#app").hidden, land: document.querySelector("#land").hidden,
      cur: document.querySelector('#bereiche [aria-current="page"]')?.dataset.tab, h2: document.querySelector("#arTitel")?.textContent.trim(), h2t: document.querySelector("#arTitel")?.tabIndex,
      lb: document.querySelector("#arBosse")?.getAttribute("role"), such: document.querySelector("#arSuche")?.getAttribute("aria-label") || document.querySelector("#arSuche")?.labels?.[0]?.textContent }));
    assert(o.app && o.land && o.cur === "archiv" && o.h2 === "Archiv" && o.h2t === -1 && o.lb === "listbox" && !!o.such,
      "Archiv: der Bereich steht ohne geladenes Log, die Liste ist eine listbox, das Suchfeld ist benannt", o);
    /* alle Bosse der Tabelle, auch ohne Kampf: so viele wie Plaetze im Album der Rekorde */
    const n = await s.page.evaluate(() => document.querySelectorAll("#arBosse [role=option]").length);
    await s.page.click('#bereiche [data-tab="rekorde"]');
    await s.page.waitForFunction(() => document.querySelectorAll("#rkInhalt .rkmed").length > 0);
    const album = await s.page.evaluate(() => document.querySelectorAll("#rkInhalt .rkmed").length);
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    assert(n > 50 && n === album, "Archiv: jeder Platz der Tabelle steht in der Liste (so viele wie Medaillons im Album)", { n, album });
    const gruppen = await s.page.evaluate(() => [...document.querySelectorAll("#arBosse [role=group]")].map((g) => document.getElementById(g.getAttribute("aria-labelledby"))?.textContent.trim()));
    assert(gruppen.slice(0, 5).join("|") === "Raid|Übungspuppe|Feldbosse|Erzbosse|Kolosse" && gruppen.some((g) => /Dungeons.*Vier Sterne/.test(g)) && gruppen.some((g) => /Halle der Illusionen/.test(g)),
      "Archiv: gegliedert wie das Album (Raid, Übungspuppe, Feldbosse, Erzbosse, Kolosse, Dungeons nach Sternen …)", gruppen);
    const puppen = await s.page.evaluate(() => [...document.querySelectorAll('#arBosse [role=option][data-ort^="puppe:"]')].map((e) => e.querySelector(".arn")?.textContent.trim()));
    assert(puppen.join("|") === "Übungspuppe · 60 s|Übungspuppe · 120 s|Übungspuppe · 180 s", "Archiv: die Übungspuppe je Längenklasse einmal", puppen);
    const mo = await zeile(s, "feld:morokai"), ch = await zeile(s, "feld:chernobog"), pu = await zeile(s, "puppe:60"), ve = await zeile(s, "dungeon:velentra");
    assert(mo && !mo.leer && /3 Kämpfe/.test(mo.text) && /466\.8k/.test(mo.text), "Morokai: Zahl der Kämpfe und bester DPS als Kurzzahl", mo);
    assert(ch && ch.leer && /noch kein Kampf/.test(ch.text) && ve && ve.leer && /noch kein Kampf/.test(ve.text), "ohne Kampf (auch nur gelöst): gedämpft, „noch kein Kampf“", { ch, ve });
    assert(pu && !pu.leer && /1 Kampf\b/.test(pu.text) && /12\.3k/.test(pu.text), "Puppe 60: ein Kampf, bester DPS", pu);
    const lyx = await zeile(s, "dungeon:lyxara");
    assert(lyx && /Höhle der Untoten Königin/.test(lyx.text), "Dungeonboss: der Dungeon steht in der Zeile", lyx);
    assert(mo.h <= 260, "Bosskarte nicht gestreckt: höchstens 260 Punkt hoch (seit #288 eine Karte)", mo.h);
    /* Tippen filtert: Name, englisch und deutsch, Raid- und Dungeonname; nichts: "Nichts gefunden." */
    const orte = () => s.page.evaluate(() => [...document.querySelectorAll("#arBosse [role=option]")].map((e) => e.dataset.ort));
    await suche(s, "lyxara");
    assert((await orte()).join() === "dungeon:lyxara", "Filter: der Name", await orte());
    await suche(s, "Untoten Königin");
    assert((await orte()).includes("dungeon:lyxara"), "Filter: der deutsche Name des Dungeons findet seinen Boss", await orte());
    await suche(s, "Deathless");
    assert((await orte()).includes("dungeon:lyxara"), "Filter: der englische Name des Dungeons", await orte());
    await suche(s, "Zitadelle");
    assert((await orte()).includes("raid:dragaryle"), "Filter: der Name des Raid-Flügels findet seinen Boss", await orte());
    await suche(s, "Sintflutbringerin");
    assert((await orte()).join() === "feld:deluzhnoa", "Filter: der deutsche Name (Deluzhnoa)", await orte());
    await suche(s, "xqzv");
    const nix = await s.page.evaluate(() => ({ n: document.querySelectorAll("#arBosse [role=option]").length, t: document.querySelector("#arLeer")?.textContent.trim(), sicht: !!document.querySelector("#arLeer")?.getClientRects().length }));
    assert(nix.n === 0 && nix.t === "Nichts gefunden." && nix.sicht, "Filter ohne Treffer: „Nichts gefunden.“", nix);
    await suche(s, "moro");
    /* Klick auf den Boss: rechts die Kaempfe, neueste zuerst, Datum, Charakter, DPS, Dauer */
    await s.page.click('#arBosse [role=option][data-ort="feld:morokai"]');
    await s.page.waitForFunction(() => document.querySelectorAll("#arKaempfe [role=option]").length === 3);
    await s.page.waitForFunction(() => /Erfunden/.test(document.querySelector("#arKaempfe")?.textContent || ""));
    const kf = await kaempfeText(s);
    assert(kf.length === 3 && kf[0][0] === "22.09.2026 19:00" && kf[1][0] === "21.09.2026 05:00" && kf[2][0] === "19.09.2026 19:00",
      "Kämpfe: neueste zuerst, mit Datum und Uhrzeit des Logs", kf);
    assert(kf[1][1] === "Erfunden" && kf[0][1] === "–" && kf[0][2] === "466.8k" && kf[1][2] === "301.0k" && kf[0][3] === "1m 35s" && kf[1][3] === "1m 0s",
      "Kämpfe: Charakter (sonst –), DPS als Kurzzahl, Dauer", kf);
    assert(!JSON.stringify(kf).includes(SPIELER), "Kämpfe: kein Logname eines Spielers", kf);
    assert((await zeile(s, "feld:morokai")).gewaehlt === "true", "der gewählte Boss trägt aria-selected");
    // der Satz kommt im naechsten Bild (erst leeren, dann setzen): auf ihn warten
    assert(await bis(async () => /Morokai/.test(await ansage(s)) && /3 Kämpfe/.test(await ansage(s))), "die Auswahl steht im aria-live-Satz", await ansage(s));
    const kz = await s.page.evaluate(() => [...document.querySelectorAll("#arKaempfe [role=option]")].map((e) => Math.round(e.getBoundingClientRect().height)));
    assert(kz.every((h) => h <= 44), "Kampfzeilen höchstens 44 Punkt hoch", kz);
    /* Tastatur: in den Kaempfen Esc -> zurueck zur Bossliste; dort Pfeile und Enter */
    await s.page.focus("#arKaempfe");
    await s.page.keyboard.press("Escape");
    assert(await s.page.evaluate(() => document.activeElement?.id === "arBosse"), "Esc in den Kämpfen: der Fokus geht zur Bossliste");
    const aktiv = () => s.page.evaluate(() => { const l = document.querySelector("#arBosse"); return document.getElementById(l.getAttribute("aria-activedescendant") || "")?.dataset.ort || ""; });
    assert(await aktiv() === "feld:morokai", "die Bossliste steht auf dem gewählten Boss", await aktiv());
    await s.page.keyboard.press("Escape");
    assert(await s.page.evaluate(() => document.activeElement?.id === "arSuche" && document.querySelector("#arSuche").value === "moro"), "Esc in der Bossliste: zurück ins Suchfeld, die Suche bleibt");
    await suche(s, "");
    await s.page.focus("#arBosse");
    await s.page.keyboard.press("Home");
    const erst = await aktiv();
    await s.page.keyboard.press("ArrowDown");
    const zweit = await aktiv();
    assert(erst === "raid:dragaryle" && zweit && zweit !== erst, "Pfeile bewegen in der Liste (Pos1: der erste Boss)", { erst, zweit });
    await suche(s, "Morokai");
    await s.page.focus("#arBosse");
    await s.page.keyboard.press("Home");
    await s.page.keyboard.press("Enter");
    await s.page.waitForFunction(() => document.activeElement?.id === "arKaempfe");
    assert(await s.page.evaluate(() => document.querySelectorAll("#arKaempfe [role=option]").length === 3), "Enter wählt den Boss, der Fokus geht in seine Kämpfe");
    /* Enter auf dem zweiten Kampf (M1, der einzige mit Zeilen) oeffnet ihn: der Schluessel kodiert, das Log im Meter, der Kopf nennt das Archiv */
    await s.page.keyboard.press("ArrowDown");
    await s.page.keyboard.press("Enter");
    await s.page.waitForFunction(() => !document.querySelector("#app").hidden && /Morokai/.test(document.querySelector("#hName")?.textContent || ""));
    assert(s.kampf.length === 1 && s.kampf[0] === "?k=" + encodeURIComponent(VERZ[0].k), "Kampf öffnen: GET /api/archiv/kampf mit kodiertem Schlüssel", s.kampf);
    const m = await s.page.evaluate(() => ({ meta: document.querySelector("#hMeta")?.textContent || "", cur: document.querySelector('#bereiche [aria-current="page"]')?.dataset.tab,
      archiv: document.querySelector("#archiv").hidden, kw: document.querySelector("#kwTag")?.textContent || "", toast: [...document.querySelectorAll("#toast.on")].map((e) => e.textContent).join(" ") }));
    assert(/aus dem Archiv/.test(m.meta) && m.cur === "timeline" && m.archiv && /Archiv/.test(m.kw), "der Kampf steht im Meter, der Kopf sagt „aus dem Archiv“", m);
    // die Wache: ein frisch geladenes Log wird gesendet; davor darf nichts aus dem Archiv neu gesendet worden sein
    await lade(s, logDatei("s", "archiv-such-wache.txt", kampf("Chernobog", T0 + 700 * MIN, 30, 3000)));
    assert(await nachPost(s, 1), "Wache: das frisch geladene Log wird aufgenommen", s.posts.map(ohneText));
    assert(s.posts.length === 1 && s.posts[0].eintrag.boss === "Chernobog", "der Kampf aus dem Archiv wird nicht noch einmal aufgenommen", s.posts.map(ohneText));
    const lix = s.config.filter((b) => b.logIndex).flatMap((b) => Object.keys(b.logIndex));
    assert(!lix.some((x) => x.startsWith("archiv-such-a")), "der Kampf aus dem Archiv schreibt nichts in den Verlauf", lix);
    /* zurueck ins Archiv: Suche und Auswahl stehen noch */
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    const zu = await s.page.evaluate(() => ({ q: document.querySelector("#arSuche").value, sel: document.querySelector('#arBosse [aria-selected="true"]')?.dataset.ort,
      n: document.querySelectorAll("#arKaempfe [role=option]").length }));
    assert(zu.q === "Morokai" && zu.sel === "feld:morokai" && zu.n === 3, "zurück im Archiv: Suche und Auswahl stehen", zu);
    /* ein Kampf ohne Zeilen (404): ein ruhiger Satz im Bereich, kein Toast */
    const listenVor404 = s.listen;
    await s.page.click('#arKaempfe [role=option]:nth-child(3)');
    assert(await bis(async () => /Datei fehlt im Archivordner/.test(await satzAr(s))), "404: ein ruhiger Satz im Bereich", await satzAr(s));
    assert(!/zeigt, was noch da ist/.test(await satzAr(s)), "404: der Satz behauptet nicht, die Liste zeige nur, was noch da ist", await satzAr(s));
    const t404 = await s.page.evaluate(() => ({ archiv: !document.querySelector("#archiv").hidden, toast: [...document.querySelectorAll("#toast.on")].map((e) => e.textContent).join(" ") }));
    assert(t404.archiv && !/Archiv/.test(t404.toast), "404: der Bereich bleibt, kein Toast", t404);
    // das Verzeichnis wird neu gefragt: ob der Kampf danach noch steht, sagt es (hier steht er noch, die Datei fehlt)
    assert(await bis(() => s.listen > listenVor404), "404: das Verzeichnis wird neu gelesen", { vor: listenVor404, jetzt: s.listen });
    await s.page.waitForFunction(() => document.querySelector("#arBosse")?.dataset.stand === "da");
    // ein anderer Boss: der Satz ist weg
    await suche(s, "");
    await s.page.click('#arBosse [role=option][data-ort="dungeon:lyxara"]');
    assert(await bis(async () => (await satzAr(s)) === ""), "404: nach dem Wechsel des Bosses ist der Satz weg", await satzAr(s));
    // noch einmal 404, dann den Bereich verlassen und wiederkommen: der Satz ist weg
    await s.page.click('#arBosse [role=option][data-ort="feld:morokai"]');
    await s.page.click('#arKaempfe [role=option]:nth-child(3)');
    assert(await bis(async () => /Datei fehlt/.test(await satzAr(s))), "404 ein zweites Mal: der Satz");
    await s.page.click('#bereiche [data-tab="rekorde"]');
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    assert(await bis(async () => (await satzAr(s)) === ""), "404: nach Verlassen und Wiederkommen ist der Satz weg", await satzAr(s));
    assert(!/\bBau\b/.test(await s.page.evaluate(() => document.querySelector("#archiv").textContent)), "Archiv: kein „Bau“");
    assert(!s.fehler.length, "Archiv: keine Seitenfehler", s.fehler);
    assert(!s.fremd.length, "Archiv: keine Anfrage außer an den Helfer", s.fremd);
    await s.page.close();
  }
  /* Archiv neu (#288): Karten, Filterchips, Seitenflaeche, Kurve */
  {
    const s = await oeffne({ verzeichnis: VERZ, texte: TEXTE, weeklies: WK });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    await s.page.waitForFunction(() => document.querySelector("#arBosse")?.dataset.stand === "da");
    const orteJetzt = () => s.page.evaluate(() => [...document.querySelectorAll("#arBosse [role=option]")].map((e) => e.dataset.ort));
    const anzahl = () => s.page.evaluate(() => ({ t: document.querySelector("#arAnzahl")?.textContent.trim() || "", live: document.querySelector("#arAnzahl")?.getAttribute("aria-live") }));
    const chipAn = (k) => s.page.waitForFunction((x) => document.querySelector('#arChips [data-kat="' + x + '"]')?.getAttribute("aria-pressed") === "true", k);
    /* Chips: Alle, Raid, Dungeon, Feldboss, Uebungspuppe und der Umschalter; genau ein Chip ist gewaehlt */
    const chips = await s.page.evaluate(() => ({ namen: [...document.querySelectorAll("#arChips .archip")].map((b) => b.textContent.trim()),
      an: [...document.querySelectorAll("#arChips .archip")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.kat),
      nur: document.querySelector("#arNur")?.getAttribute("aria-pressed"), nurText: document.querySelector("#arNur")?.textContent.trim() }));
    assert(chips.namen.join("|") === "Alle|Raid|Dungeon|Feldboss|Übungspuppe" && chips.an.join() === "alle" && chips.nur === "false" && chips.nurText === "Nur mit Kämpfen",
      "Archiv neu: Filterchips Alle, Raid, Dungeon, Feldboss, Übungspuppe, dazu „Nur mit Kämpfen“; anfangs Alle", chips);
    const alleN = (await orteJetzt()).length;
    assert((await anzahl()).t === alleN + " Bosse gefunden" && (await anzahl()).live === "polite", "Archiv neu: die Trefferzahl steht in einer aria-live-Zeile", await anzahl());
    await s.page.click('#arChips [data-kat="feld"]');
    await chipAn("feld");
    const feld = await orteJetzt();
    assert(feld.length > 10 && feld.every((o) => o.startsWith("feld:")) && feld.includes("feld:morokai") && (await anzahl()).t === feld.length + " Bosse gefunden",
      "Chip Feldboss: nur Feldbosse, die Zahl folgt", { n: feld.length, a: await anzahl() });
    await s.page.click('#arChips [data-kat="raid"]');
    await chipAn("raid");
    assert((await orteJetzt()).every((o) => o.startsWith("raid:")) && (await orteJetzt()).length >= 3, "Chip Raid: nur Raidbosse", await orteJetzt());
    await s.page.click('#arChips [data-kat="puppe"]');
    await chipAn("puppe");
    assert((await orteJetzt()).join() === "puppe:60,puppe:120,puppe:180", "Chip Übungspuppe: die drei Längenklassen", await orteJetzt());
    await s.page.click('#arChips [data-kat="dungeon"]');
    await chipAn("dungeon");
    assert((await orteJetzt()).every((o) => o.startsWith("dungeon:")) && (await orteJetzt()).includes("dungeon:lyxara"), "Chip Dungeon: nur Dungeonbosse", (await orteJetzt()).slice(0, 5));
    // Chip und Suchtext wirken zusammen; der Umschalter zeigt nur Bosse mit Kaempfen (geloeste zaehlen nicht)
    await s.page.click('#arChips [data-kat="alle"]');
    await chipAn("alle");
    await s.page.click("#arNur");
    await s.page.waitForFunction(() => document.querySelector("#arNur")?.getAttribute("aria-pressed") === "true");
    assert([...(await orteJetzt())].sort().join() === ["dungeon:lyxara", "feld:morokai", "puppe:60"].sort().join(),
      "Nur mit Kämpfen: Morokai, Puppe 60, Lyxara (Chernobog nur gelöst: nicht)", await orteJetzt());
    await suche(s, "moro");
    assert((await orteJetzt()).join() === "feld:morokai", "Suchtext und Umschalter zusammen", await orteJetzt());
    await s.page.click('#arChips [data-kat="raid"]');
    await chipAn("raid");
    assert((await orteJetzt()).length === 0 && /Nichts gefunden/.test(await s.page.evaluate(() => document.querySelector("#arLeer").textContent)), "Chip Raid zu „moro“: nichts gefunden", await orteJetzt());
    await s.page.click('#arChips [data-kat="alle"]');
    await chipAn("alle");
    await s.page.click("#arNur");
    await suche(s, "");
    /* Karten: Bild (Spielbild oder eigene Marke), der beste DPS gross, Kurve ab zwei Kaempfen */
    const karte = (ort) => s.page.evaluate((o) => { const e = document.querySelector('#arBosse [data-ort="' + o + '"]'); if(!e) return null;
      const z = e.querySelector(".arzb"), k = e.querySelector("svg.arkurve"), b = e.querySelector("img.arbild"), r = e.getBoundingClientRect();
      return { bild: !!b && b.src.startsWith("data:image/") && b.getAttribute("aria-hidden") === "true", zb: z ? z.textContent.replace(/\s+/g, " ").trim() : "", zbFont: z ? getComputedStyle(z.querySelector("b") || z).fontSize : "",
        kurve: !!k, punkte: k ? k.querySelectorAll("circle").length : 0, kurveName: k?.getAttribute("aria-label") || "", w: Math.round(r.width), h: Math.round(r.height) }; }, ort);
    const mk = await karte("feld:morokai"), pk = await karte("puppe:60"), ck = await karte("feld:chernobog");
    assert(mk.bild && /466\.8k/.test(mk.zb) && parseFloat(mk.zbFont) >= 17 && mk.kurve && mk.punkte === 3 && !!mk.kurveName, "Karte Morokai: Bild, bester DPS groß, Kurve mit drei Punkten und Namen", mk);
    assert(pk.bild && /12\.3k/.test(pk.zb) && !pk.kurve, "Karte Puppe 60: ein Kampf, keine Kurve", pk);
    assert(ck.bild && ck.zb === "" && !ck.kurve, "Karte ohne Kampf: Bild, keine Zahl, keine Kurve", ck);
    assert(mk.w <= 340 && mk.h <= 260 && ck.h <= 260, "Karten nicht gestreckt (höchstens 340 breit, 260 hoch)", { mk, ck });
    /* Gruppenueberschriften: gross, mit Zaehler ausserhalb des Namens der Gruppe */
    const kopf = await s.page.evaluate(() => { const g = document.querySelector("#arBosse [role=group]"); const h = g.querySelector(".arghead"), z = g.querySelector(".argz");
      return { name: h.textContent.trim(), px: parseFloat(getComputedStyle(h).fontSize), fam: getComputedStyle(h).fontFamily, zahl: z?.textContent.trim() || "", id: h.id === g.getAttribute("aria-labelledby") }; });
    assert(kopf.name === "Raid" && kopf.px >= 17 && /Anton/.test(kopf.fam) && /^\d+ Bosse · \d+ mit Kämpfen$/.test(kopf.zahl) && kopf.id, "Gruppenüberschrift: groß, Anzeigeschrift, Zähler außerhalb des Gruppennamens", kopf);
    const fz = await s.page.evaluate(() => [...document.querySelectorAll("#arBosse [role=group]")].map((g) => [g.querySelector(".arghead").textContent.trim(), g.querySelector(".argz")?.textContent.trim(), g.querySelectorAll("[role=option]").length, g.querySelectorAll("[role=option]:not(.leer)").length]));
    const f1 = fz.find((x) => x[0] === "Feldbosse");
    assert(f1 && f1[1] === f1[2] + " Bosse · " + f1[3] + " mit Kämpfen" && f1[3] === 1, "Zähler der Gruppe: Zahl der Bosse und der mit Kämpfen", fz);
    /* Seitenflaeche: ohne Auswahl keine, danach Kopf mit Bild, Name, Zahlen und Kurve */
    assert(await s.page.evaluate(() => !document.querySelector("#arRechts").getClientRects().length), "Seitenfläche: ohne Auswahl steht sie nicht, die Karten haben die Breite");
    const breiteOhne = await s.page.evaluate(() => Math.round(document.querySelector("#arBosse").getBoundingClientRect().width));
    await s.page.click('#arBosse [role=option][data-ort="feld:morokai"]');
    await s.page.waitForFunction(() => document.querySelectorAll("#arKaempfe [role=option]").length === 3);
    const sf = await s.page.evaluate(() => { const r = document.querySelector("#arRechts").getBoundingClientRect(), l = document.querySelector("#arBosse").getBoundingClientRect(), st = (w) => document.querySelector('#arStat [data-w="' + w + '"]')?.textContent.replace(/\s+/g, " ").trim();
      return { sicht: r.width > 0, rechts: r.left >= l.right - 1, breite: Math.round(l.width), bild: !!document.querySelector("#arRechts img.arbild"), n: st("n"), bester: st("bester"), median: st("median"),
        kurve: !!document.querySelector("#arRechts svg.histplot"), punkte: document.querySelectorAll("#arRechts svg.histplot circle.hp").length, name: document.querySelector("#arBossName").textContent.trim() }; });
    assert(sf.sicht && sf.rechts && sf.bild && sf.name === "Morokai" && /3\b/.test(sf.n) && /466\.8k/.test(sf.bester) && /301\.0k/.test(sf.median), "Seitenfläche: Bild, Name, Zahl der Kämpfe, bester DPS und Median", sf);
    assert(sf.kurve && sf.punkte === 3 && sf.breite < breiteOhne, "Seitenfläche: Grafik des Verlaufs über die drei Kämpfe; die Karten werden schmaler", { sf, breiteOhne });
    // der beste Kampf traegt den Goldpunkt, die Tabelle zeigt ihn in der DPS-Spalte mit einem Marker
    const best = await s.page.evaluate(() => ({ svg: document.querySelectorAll("#arRechts svg.histplot circle.hpspitze").length, tab: document.querySelectorAll("#arKaempfe .arw .punkt").length,
      tabText: [...document.querySelectorAll("#arKaempfe .arw .punkt")].map((e) => e.closest(".arkampf").querySelector(".arw").textContent.trim()) }));
    assert(best.svg === 1 && best.tab === 1 && /466\.8k/.test(best.tabText[0]), "Der beste Kampf: ein Goldpunkt in der Grafik und ein Marker in der Tabelle", best);
    /* Tastatur in den Karten: Rechts/Links einer, Ab/Auf eine Reihe */
    await s.page.focus("#arBosse");
    await s.page.keyboard.press("Home");
    const pos = () => s.page.evaluate(() => { const e = document.getElementById(document.querySelector("#arBosse").getAttribute("aria-activedescendant") || ""); const r = e?.getBoundingClientRect(); return e ? { o: e.dataset.ort, x: Math.round(r.left), y: Math.round(r.top) } : null; });
    const p0 = await pos();
    await s.page.keyboard.press("ArrowRight");
    const p1 = await pos();
    assert(p0 && p1 && p1.o !== p0.o && p1.x > p0.x && p1.y === p0.y, "Pfeil rechts: die nächste Karte in derselben Reihe", { p0, p1 });
    await s.page.keyboard.press("ArrowLeft");
    assert((await pos()).o === p0.o, "Pfeil links: zurück auf die vorige Karte");
    await s.page.keyboard.press("ArrowDown");
    const p2 = await pos();
    assert(p2.y > p0.y, "Pfeil runter: eine Reihe tiefer", { p0, p2 });
    await s.page.keyboard.press("ArrowUp");
    assert((await pos()).o === p0.o, "Pfeil hoch: eine Reihe höher, zurück auf die erste Karte");
    // kein Text unter 11 Punkt im Bereich
    const klein = await s.page.evaluate(() => [...document.querySelectorAll("#archiv *")].filter((e) => e.getClientRects().length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => e.className + ":" + getComputedStyle(e).fontSize));
    assert(klein.length === 0, "Archiv neu: kein sichtbarer Text unter 11 Punkt", klein);
    // vier Themen: nichts rollt quer, die Gruppenueberschrift ist lesbar (Kontrast zur Flaeche mindestens 4,5)
    for (const th of ["dark", "light", "tnl", "glas"]) {
      await s.page.evaluate((t) => { document.documentElement.dataset.theme = t; }, th);
      const t = await s.page.evaluate(() => { const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
        const h = document.querySelector(".arghead"); let bg = h, grund = "rgba(0, 0, 0, 0)"; while (bg && /rgba\(0, 0, 0, 0\)|transparent/.test(grund)) { grund = getComputedStyle(bg).backgroundColor; bg = bg.parentElement; }
        const a = lum(getComputedStyle(h).color), b = lum(grund); return { k: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), quer: document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth }; });
      assert(t.k >= 4.5 && t.quer, "Thema " + th + ": Gruppenüberschrift mit Kontrast ab 4,5, nichts rollt quer", t);
    }
    assert(!s.fehler.length && !s.fremd.length, "Archiv neu: keine Seitenfehler, keine fremde Anfrage", { f: s.fehler, r: s.fremd });
    await s.page.close();
  }
  /* Bossseite: die Verlaufsansicht (#292): Grafik, Zeitraum, Kaempfe aus Verlauf und Archiv mit Markierung */
  {
    const VI = { "verl-a.txt": { size: 1, bytes: 1, fights: [
      { name: "Morokai", dps: 466812, dmg: 1, dur: 95, at: M2, top: 1, topSid: "" },               // derselbe Kampf wie im Archiv
      { name: "Morokai", dps: 280000, dmg: 1, dur: 80, at: M2 + TAG, top: 1, topSid: "" },        // nur im Verlauf
      { name: "Morokai", dps: 350000, dmg: 1, dur: 70, at: M2 + 40 * TAG, top: 1, topSid: "" }] } }; // nur im Verlauf, fern
    mkdirSync(join(work, "leer"), { recursive: true });
    const s = await oeffne({ verzeichnis: VERZ, texte: TEXTE, weeklies: WK, config: { logIndex: VI }, rekorde: join(work, "leer") });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    await s.page.waitForFunction(() => document.querySelector("#arBosse")?.dataset.stand === "da");
    await s.page.click('#arBosse [role=option][data-ort="feld:morokai"]');
    await s.page.waitForFunction(() => document.querySelectorAll("#arKaempfe [role=option]").length === 5);
    const zeitAn = () => s.page.evaluate(() => [...document.querySelectorAll("#arZeit button")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.z).join());
    const bossVerl = () => s.page.evaluate(() => ({ svg: !!document.querySelector("#arVerlauf svg.histplot"), punkte: document.querySelectorAll("#arVerlauf svg.histplot circle.hp").length,
      gold: [...document.querySelectorAll("#arVerlauf svg.histplot circle.hpspitze")].map((c) => c.getAttribute("data-dps")), median: document.querySelectorAll("#arVerlauf svg.histplot .hpmed").length,
      name: document.querySelector("#arVerlauf svg.histplot")?.getAttribute("aria-label") || "", leg: document.querySelector("#arLeg")?.textContent.replace(/\s+/g, " ").trim() || "",
      zeilen: document.querySelectorAll("#arKaempfe [role=option]").length }));
    const sv = await bossVerl();
    assert(sv.svg && sv.punkte === 5 && sv.gold.join() === "466812" && sv.median === 1 && /Morokai/.test(sv.name) && /Median/.test(sv.leg), "Bossseite: die Grafik des Verlaufs mit fünf Punkten, Gold am besten Kampf, Median und Legende", sv);
    assert(await s.page.evaluate(() => !document.querySelector("#arVerlauf svg.arkurve")), "Bossseite: statt der kleinen Kurve die Grafik des Verlaufs");
    assert(await zeitAn() === "alles" && await s.page.evaluate(() => [...document.querySelectorAll("#arZeit button")].map((b) => b.textContent.trim()).join("|")) === "Woche|Monat|Alles",
      "Bossseite: Zeitraum Woche | Monat | Alles, vorbelegt Alles (das Archiv versteckt nichts)");
    // die Zeilen: neueste zuerst, aus Verlauf und Archiv; die Markierung nennt, wo der Kampf liegt
    const zl = await s.page.evaluate(() => [...document.querySelectorAll("#arKaempfe [role=option]")].map((e) => ({ ja: !!e.querySelector(".arim.ja"), nein: !!e.querySelector(".arim.nein"),
      dps: e.querySelector(".arw")?.textContent.trim(), label: e.getAttribute("aria-label") || "", k: e.dataset.k || "" })));
    assert(zl.map((x) => x.dps).join("|") === "350.0k|280.0k|466.8k|301.0k|250.0k", "Bossseite: fünf Kämpfe aus Verlauf und Archiv, neueste zuerst, der gemeinsame nur einmal", zl.map((x) => x.dps));
    assert(zl.map((x) => x.ja ? "A" : x.nein ? "V" : "?").join("") === "VVAAA" && zl.every((x) => x.ja !== x.nein), "Bossseite: jede Zeile trägt die Markierung „im Archiv“ oder „nur im Verlauf“", zl);
    assert(/im Archiv/.test(zl[2].label) && /nur im Verlauf/.test(zl[0].label) && !/nur im Verlauf/.test(zl[2].label), "Bossseite: der Vorleser hört die Markierung in der Zeile", [zl[0].label, zl[2].label]);
    const st = await s.page.evaluate(() => [...document.querySelectorAll("#arStat [data-w]")].map((e) => e.dataset.w + ":" + e.textContent.replace(/\s+/g, " ").trim()));
    assert(/^n:5\b/.test(st[0]) && /466\.8k/.test(st[1]) && /301\.0k/.test(st[2]) && /^archiv:3 im Archiv/.test(st[3] || ""), "Bossseite: Kopf zählt Verlauf und Archiv zusammen (5 Kämpfe, bester, Median) und nennt, wie viele im Archiv liegen (3)", st);
    // der Zeitraum endet mit dem Tag des neuesten Kampfs; Grafik und Liste zeigen dieselben Kaempfe
    await s.page.click('#arZeit [data-z="woche"]');
    await s.page.waitForFunction(() => document.querySelectorAll("#arKaempfe [role=option]").length === 1);
    const wo = await bossVerl();
    assert(await zeitAn() === "woche" && wo.punkte === 1 && wo.zeilen === 1, "Zeitraum Woche: nur der neueste Tag, in Grafik und Liste", wo);
    await s.page.click('#arZeit [data-z="monat"]');
    await s.page.waitForFunction(() => document.querySelector('#arZeit [data-z="monat"]')?.getAttribute("aria-pressed") === "true");
    assert((await bossVerl()).zeilen === 1, "Zeitraum Monat: 30 Tage ab dem neuesten Kampf");
    await s.page.click('#arZeit [data-z="alles"]');
    await s.page.waitForFunction(() => document.querySelectorAll("#arKaempfe [role=option]").length === 5);
    // der Verlauf bleibt, wie er ist: der Zeitraum des Archivs ist ein eigener
    assert(await s.page.evaluate(() => document.querySelector("#verlaufZeit button[aria-pressed=true]")?.dataset.z) !== "woche", "Der Zeitraum des Archivs ändert den des Verlaufs nicht");
    // ohne geladenen Kampf keine Einordnung
    assert(await s.page.evaluate(() => !document.querySelector("#arRechts .veinord")), "Bossseite: ohne geladenen Kampf an diesem Boss keine Einordnung");
    // ein Kampf nur im Verlauf: "Log oeffnen" wie in den Rekorden; die Datei fehlt im Ordner, im Archiv liegt er nicht: der Satz der Datei
    await s.page.click('#arKaempfe [role=option]:nth-child(2)');
    assert(await bis(() => s.page.evaluate(() => /verl-a\.txt/.test([...document.querySelectorAll("#toast.on")].map((e) => e.textContent).join(" ")))), "Kampf nur im Verlauf: „Log öffnen“, fehlt die Datei, sagt der Toast es", await s.page.evaluate(() => document.querySelector("#toast")?.textContent));
    assert(await s.page.evaluate(() => !document.querySelector("#archiv").hidden) && s.kampf.length === 0, "Kampf nur im Verlauf: der Bereich bleibt, nichts kommt aus dem Archiv", s.kampf);
    // ein Kampf im Archiv: kommt von dort, auch wenn er im Verlauf steht
    await s.page.click('#arKaempfe [role=option]:nth-child(4)');
    await s.page.waitForFunction(() => !document.querySelector("#app").hidden && /Morokai/.test(document.querySelector("#hName")?.textContent || ""));
    assert(s.kampf.length === 1 && s.kampf[0] === "?k=" + encodeURIComponent(VERZ[0].k), "Kampf im Archiv: kommt von dort (GET /api/archiv/kampf)", s.kampf);
    // ein Kampf aus dem Archiv ist geladen und von diesem Boss: wieder im Archiv steht die Grafik mit dem Ring der Auswahl
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    assert((await bossVerl()).punkte === 5, "Zurück im Archiv: Auswahl und Grafik stehen noch");
    assert(!s.fehler.length && !s.fremd.length, "Bossseite Verlauf: keine Seitenfehler, keine fremde Anfrage", { f: s.fehler, r: s.fremd });
    await s.page.close();
  }
  /* Bossseite der Uebungspuppe: nur die Kaempfe des Archivs, dieselbe Grafik; Englisch; 560 px */
  {
    const s = await oeffne({ verzeichnis: VERZ, texte: TEXTE, lang: "en", viewport: { width: 560, height: 900 } });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    await s.page.waitForFunction(() => document.querySelector("#arBosse")?.dataset.stand === "da");
    await s.page.click('#arBosse [role=option][data-ort="puppe:60"]');
    await s.page.waitForFunction(() => document.querySelectorAll("#arKaempfe [role=option]").length === 1);
    const p = await s.page.evaluate(() => ({ svg: !!document.querySelector("#arVerlauf svg.histplot"), punkte: document.querySelectorAll("#arVerlauf svg.histplot circle.hp").length,
      zeit: [...document.querySelectorAll("#arZeit button")].map((b) => b.textContent.trim()).join("|"), label: document.querySelector("#arKaempfe [role=option]")?.getAttribute("aria-label") || "",
      quer: document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth, breit: Math.round(document.querySelector("#arVerlauf").getBoundingClientRect().width),
      hoch: Math.round(document.querySelector("#arVerlauf").getBoundingClientRect().height) }));
    assert(p.svg && p.punkte === 1 && p.zeit === "Week|Month|All" && /in the archive/.test(p.label), "Puppe, Englisch: Grafik aus dem Archiv, Zeitraum und Markierung englisch", p);
    assert(p.quer && p.breit > 200 && p.breit <= 560 && p.hoch >= 150, "560 px: die Grafik steht in der Spalte, nichts rollt quer", p);
    assert(!s.fehler.length, "Puppe: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  /* Archiv neu, Englisch: Chips und Zaehler */
  {
    const s = await oeffne({ verzeichnis: VERZ, texte: TEXTE, lang: "en" });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    const e = await s.page.evaluate(() => ({ chips: [...document.querySelectorAll("#arChips .archip")].map((b) => b.textContent.trim()), nur: document.querySelector("#arNur")?.textContent.trim(),
      z: document.querySelector("#arBosse .argz")?.textContent.trim(), a: document.querySelector("#arAnzahl")?.textContent.trim() }));
    assert(e.chips.join("|") === "All|Raid|Dungeon|Field boss|Practice dummy" && e.nur === "Only with fights" && /^\d+ bosses · \d+ with fights$/.test(e.z) && /^\d+ bosses found$/.test(e.a), "EN: Chips, Zähler und Trefferzahl englisch", e);
    await s.page.close();
  }
  /* Archiv neu, 560 px: Chips brechen um, die Karten stehen in einer oder zwei Spalten, nichts rollt quer */
  {
    const s = await oeffne({ verzeichnis: VERZ, texte: TEXTE, viewport: { width: 560, height: 900 } });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    const g = await s.page.evaluate(() => ({ quer: document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth && document.querySelector("#archiv").scrollWidth <= document.querySelector("#archiv").clientWidth + 1,
      chips: [...document.querySelectorAll("#arChips .archip, #arNur")].every((b) => b.getBoundingClientRect().right <= innerWidth), karten: new Set([...document.querySelectorAll("#arBosse [role=option]")].slice(0, 6).map((e) => Math.round(e.getBoundingClientRect().left))).size }));
    assert(g.quer && g.chips && g.karten >= 1 && g.karten <= 2, "560 px: Chips und Karten ohne Querrollen, höchstens zwei Spalten", g);
    await s.page.close();
  }
  /* Englisch */
  {
    const s = await oeffne({ verzeichnis: VERZ, texte: TEXTE, lang: "en" });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    const e = await s.page.evaluate(() => ({ h2: document.querySelector("#arTitel").textContent.trim(), tip: document.querySelector('#bereiche [data-tab="archiv"] .btip').textContent.trim(),
      such: document.querySelector("#arSuche").getAttribute("placeholder") || "", gruppen: [...document.querySelectorAll("#arBosse [role=group]")].map((g) => document.getElementById(g.getAttribute("aria-labelledby"))?.textContent.trim()),
      leer: document.querySelector('#arBosse [data-ort="feld:chernobog"]')?.textContent || "", mo: document.querySelector('#arBosse [data-ort="feld:morokai"]')?.textContent || "" }));
    assert(e.h2 === "Archive" && e.tip === "Archive" && /boss/i.test(e.such) && e.gruppen.slice(0, 3).join("|") === "Raid|Practice dummy|Field bosses" && /no fight yet/.test(e.leer) && /3 fights/.test(e.mo),
      "EN: Bereich, Gruppen und Zeilen englisch", e);
    await suche(s, "Frozen nothing");
    assert(await s.page.evaluate(() => document.querySelector("#arLeer")?.textContent.trim()) === "Nothing found.", "EN: „Nothing found.“");
    await suche(s, "Morokai");
    await s.page.click('#arBosse [role=option][data-ort="feld:morokai"]');
    await s.page.waitForFunction(() => document.querySelectorAll("#arKaempfe [role=option]").length === 3);
    assert((await kaempfeText(s))[0][0] === "22/09/2026 19:00", "EN: das Datum", await kaempfeText(s));
    await s.page.click("#arKaempfe [role=option]:nth-child(2)");
    await s.page.waitForFunction(() => /from the archive/.test(document.querySelector("#hMeta")?.textContent || ""));
    await s.page.click('#bereiche [data-tab="archiv"]');
    await s.page.click("#arKaempfe [role=option]:nth-child(3)");
    assert(await bis(async () => /file is missing from the archive folder/.test(await satzAr(s))), "EN: 404-Satz", await satzAr(s));
    assert(!s.fehler.length, "EN Archiv: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  /* ausgeschaltet: was da ist, steht; ein ruhiger Satz */
  {
    const s = await oeffne({ verzeichnis: VERZ, config: { archivAn: false } });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    await s.page.waitForFunction(() => /3 Kämpfe/.test(document.querySelector('#arBosse [data-ort="feld:morokai"]')?.textContent || ""));
    assert(/ausgeschaltet/.test(await satzAr(s)) && /bleibt/.test(await satzAr(s)), "ausgeschaltet: ein ruhiger Satz, Vorhandenes bleibt", await satzAr(s));
    await s.page.close();
    // leeres Archiv: jede Zeile ohne Kampf, ein Satz zum leeren Archiv
    const l = await oeffne({ verzeichnis: [] });
    await l.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(l);
    await l.page.waitForFunction(() => document.querySelector("#arBosse")?.dataset.stand === "da");
    const leer = await l.page.evaluate(() => [...document.querySelectorAll("#arBosse [role=option]")].every((e) => e.classList.contains("leer")));
    assert(leer && /noch kein Kampf/i.test(await satzAr(l)), "leeres Archiv: alle Zeilen gedämpft, ein Satz", await satzAr(l));
    await l.page.close();
  }
  /* Kompakt als eigenes Fenster: ein Kampf aus dem Archiv steht nur in der Vollansicht - der Stand nennt den Grund
     "archiv" ohne Datei, und niemand holt die Logdatei aus dem Log-Ordner */
  {
    const s = await oeffne({ verzeichnis: VERZ, texte: TEXTE, zwei: true });
    await s.page.waitForFunction(() => document.querySelector("#btnCompact")?.getAttribute("aria-pressed") === "true");
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    await s.page.click('#arBosse [role=option][data-ort="feld:morokai"]');
    await s.page.click("#arKaempfe [role=option]:nth-child(2)");
    await s.page.waitForFunction(() => /Morokai/.test(document.querySelector("#hName")?.textContent || ""));
    const staende = () => s.win.filter((b) => b.do === "stand");
    assert(await bis(() => staende().at(-1)?.grund === "archiv"), "Kompakt: die Vollansicht meldet den Grund archiv", staende());
    const st = staende().at(-1) || {};
    assert(st.datei === "" && st.kampf === null, "Kompakt: ohne Dateinamen und ohne Kampf", st);
    assert(!s.logGet.length, "Kompakt: keine Logdatei wird geholt", s.logGet);
    assert(!s.fehler.length, "Kompakt: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  /* ein Platz, den die Tabelle nicht mehr kennt (umbenannt): der Name im Log findet den Boss neu (Spezifikation 13) */
  {
    const s = await oeffne({ verzeichnis: [eintrag("feld:alter-name", "Morokai", DA, M1, 301000, 60), eintrag("feld:nirgends", "Erfundener Riese", DA, M2, 1000, 30)] });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    assert(await bis(async () => /1 Kampf\b/.test((await zeile(s, "feld:morokai"))?.text || "")), "umbenannter Platz: der Kampf steht beim Boss seines Namens", await zeile(s, "feld:morokai"));
    assert(!s.fehler.length, "umbenannter Platz: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  /* 560 px: eine Spalte, Klick zeigt die Kaempfe, Zurueck kommt zur Liste; nichts rollt quer */
  {
    const s = await oeffne({ verzeichnis: VERZ, texte: TEXTE, viewport: { width: 560, height: 900 } });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    const quer = () => s.page.evaluate(() => document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth && document.querySelector("#archiv").scrollWidth <= document.querySelector("#archiv").clientWidth + 1);
    assert(await quer(), "560 px: die Bossliste rollt nicht quer");
    // ein Boss weiter unten, die Liste noch ohne Fokus: der Klick trifft ihn (der Fokus rollt die Liste nicht nach oben)
    await s.page.click('#arBosse [role=option][data-ort="dungeon:lyxara"]');
    assert(await bis(() => s.page.evaluate(() => document.querySelector('#arBosse [aria-selected="true"]')?.dataset.ort === "dungeon:lyxara"
      && document.querySelectorAll("#arKaempfe [role=option]").length === 1)), "560 px: der Klick auf einen Boss weiter unten wählt ihn");
    await s.page.click("#arZurueck");
    await s.page.click('#arBosse [role=option][data-ort="feld:morokai"]');
    await s.page.waitForFunction(() => document.querySelectorAll("#arKaempfe [role=option]").length === 3);
    const v = await s.page.evaluate(() => ({ liste: !!document.querySelector("#arBosse").getClientRects().length, zurueck: !!document.querySelector("#arZurueck")?.getClientRects().length,
      kampf: !!document.querySelector("#arKaempfe").getClientRects().length }));
    assert(!v.liste && v.zurueck && v.kampf, "560 px: ein Klick zeigt die Kämpfe statt der Liste, mit Zurück", v);
    assert(await quer(), "560 px: die Kämpfe rollen nicht quer");
    await s.page.click("#arZurueck");
    await s.page.waitForFunction(() => !!document.querySelector("#arBosse").getClientRects().length);
    assert(await s.page.evaluate(() => document.activeElement?.id === "arBosse" && document.querySelector('#arBosse [aria-selected="true"]')?.dataset.ort === "feld:morokai"),
      "560 px: Zurück führt zur Liste, der Boss bleibt gewählt, der Fokus in der Liste");
    await s.page.click('#arBosse [role=option][data-ort="feld:morokai"]');
    await s.page.focus("#arKaempfe");
    await s.page.keyboard.press("Escape");
    assert(await s.page.evaluate(() => !!document.querySelector("#arBosse").getClientRects().length && document.activeElement?.id === "arBosse"), "560 px: Esc in den Kämpfen führt zur Liste");
    assert(!s.fehler.length, "560 px: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  /* 2000 x 1480: zwei Spalten, mehr Zeilen, nichts gestreckt */
  {
    const s = await oeffne({ verzeichnis: VERZ, texte: TEXTE, viewport: { width: 2000, height: 1480 } });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    await s.page.click('#arBosse [role=option][data-ort="feld:morokai"]');
    await s.page.waitForFunction(() => document.querySelectorAll("#arKaempfe [role=option]").length === 3);
    const g = await s.page.evaluate(() => {
      const r = (x) => document.querySelector(x).getBoundingClientRect();
      const z = [...document.querySelectorAll("#arBosse [role=option]")].map((e) => e.getBoundingClientRect());
      const k = [...document.querySelectorAll("#arKaempfe [role=option]")].map((e) => e.getBoundingClientRect());
      return { links: r("#arBosse").right, rechts: r("#arKaempfe").left, zurueck: !!document.querySelector("#arZurueck")?.getClientRects().length,
        bossH: Math.max(...z.map((x) => x.height)), bossW: Math.max(...z.map((x) => x.width)), kampfH: Math.max(...k.map((x) => x.height)), kampfW: Math.max(...k.map((x) => x.width)),
        sichtbar: z.filter((x) => x.bottom <= innerHeight && x.top >= 0).length, quer: document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth };
    });
    assert(g.links <= g.rechts && !g.zurueck, "2000 x 1480: Karten und Kämpfe nebeneinander, ohne Zurück", g);
    assert(g.bossH <= 260 && g.bossW <= 340 && g.kampfH <= 44 && g.kampfW <= 800 && g.quer, "2000 x 1480: Karten und Zeilen nicht gestreckt (Karten höchstens 340 x 260, Kampfzeilen 44 Punkt hoch)", g);
    assert(g.sichtbar >= 25, "2000 x 1480: mehr Karten auf einen Blick", g.sichtbar);
    assert(!s.fehler.length, "2000 x 1480: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  /* Browser ohne App: Knopf und Liste stehen, jede Zeile ohne Kampf, der Satz */
  {
    const s = await oeffne({ datei: true });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    const b = await s.page.evaluate(() => ({ alle: [...document.querySelectorAll("#arBosse [role=option]")].every((e) => e.classList.contains("leer")),
      n: document.querySelectorAll("#arBosse [role=option]").length }));
    assert(b.n > 50 && b.alle && (await satzAr(s)) === "Das Archiv gibt es nur in der App.", "Browser: die Liste steht ohne Kämpfe, der Satz", { b, satz: await satzAr(s) });
    await suche(s, "Lyxara");
    assert(await s.page.evaluate(() => document.querySelectorAll("#arBosse [role=option]").length === 1), "Browser: die Suche filtert auch hier");
    // Loesen und Loeschen (#264 Teil 4) gibt es nur in der App: keine Leiste, kein Chip, kein Knopf in einer Zeile
    await suche(s, "Morokai");
    await s.page.click('#arBosse [role=option][data-ort="feld:morokai"]');
    const lo = await s.page.evaluate(() => ({ leiste: !!document.querySelector("#arWahl")?.getClientRects().length, chip: !!document.querySelector("#arGChip")?.getClientRects().length,
      loes: document.querySelectorAll(".arloes").length, gl: !!document.querySelector("#arGeloeste")?.getClientRects().length, da: !!document.querySelector("#arWahl") && !!document.querySelector("#arGChip") }));
    assert(lo.da && !lo.leiste && !lo.chip && !lo.loes && !lo.gl, "Browser: keine Auswahl, kein Lösen, keine Liste der Gelösten", lo);
    assert(!s.fehler.length && !s.fremd.length, "Browser: keine Seitenfehler, keine Anfrage", { f: s.fehler, r: s.fremd });
    await s.page.close();
  }

  /* ==================== Loesen und endgueltig Loeschen (Spezifikation 2026-10-26-archiv-loeschen-design.md 5 und 8, Aufbau B; #264 Teil 4) ====================
     Ein gestelltes Verzeichnis (je Seite eine frische Kopie, der Helfer aendert es beim Loesen und Loeschen): Morokai dreimal,
     Chernobog geloest, die Puppe, Lyxara. Gewartet wird auf Zustand: Anfragen, Zeilen, Zahlen. */
  const frisch = () => VERZ.map((e) => ({ ...e }));
  const [MK1, MK2, MK3] = [VERZ[0].k, VERZ[1].k, VERZ[2].k];
  const CHK = VERZ[3].k;
  const zeilenK = (s) => s.page.evaluate(() => [...document.querySelectorAll("#arKaempfe [role=option]")].map((e) => e.dataset.k));
  const statN = (s) => s.page.evaluate(() => [...document.querySelectorAll("#arStat .arstat")].map((e) => e.textContent.replace(/\s+/g, " ").trim()).join(" | "));
  const toastText = (s) => s.page.evaluate(() => { const t = document.querySelector("#toast.on"); return t ? [...t.childNodes].map((n) => n.textContent.replace(/\s+/g, " ").trim()).filter(Boolean).join(" ") : ""; });
  const chipText = (s) => s.page.evaluate(() => { const c = document.querySelector("#arGChip"); return c && c.getClientRects().length ? c.textContent.trim() : ""; });
  const bossseite = async (s, ort, n) => {
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    await s.page.waitForFunction(() => document.querySelector("#arBosse")?.dataset.stand === "da");
    await s.page.click('#arBosse [role=option][data-ort="' + ort + '"]');
    await s.page.waitForFunction((x) => document.querySelectorAll("#arKaempfe [role=option]").length === x, n);
  };
  const dlgOffen = (s) => s.page.evaluate(() => !!document.querySelector("#arDlgBg.on") && !!document.querySelector("#arDlg")?.getClientRects().length);
  const imDialog = (s) => s.page.evaluate(() => !!document.activeElement && !!document.querySelector("#arDlg")?.contains(document.activeElement));
  const quer = (s) => s.page.evaluate(() => document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth && document.querySelector("#archiv").scrollWidth <= document.querySelector("#archiv").clientWidth + 1);
  const gruppenG = (s) => s.page.evaluate(() => [...document.querySelectorAll("#arGeloeste .arggruppe")].map((g) => [g.querySelector(".argname")?.textContent.trim(), [...g.querySelectorAll(".argcb")].map((c) => c.dataset.k)]));
  const gZahl = (s) => s.page.evaluate(() => document.querySelector("#arGWZahl")?.textContent.replace(/\s+/g, " ").trim() || "");
  {
    const v = frisch();
    const s = await oeffne({ verzeichnis: v, texte: TEXTE, weeklies: WK });
    await bossseite(s, "feld:morokai", 3);
    const k0 = await s.page.evaluate(() => ({ leiste: !!document.querySelector("#arWahl")?.getClientRects().length, rolle: document.querySelector("#arWahl")?.getAttribute("role"),
      label: document.querySelector("#arWahl")?.getAttribute("aria-label"), modus: document.querySelector("#arWModus")?.textContent.trim(),
      loes: document.querySelectorAll("#arKaempfe .arloes").length, chip: document.querySelector("#arGChip")?.textContent.trim(), exp: document.querySelector("#arGChip")?.getAttribute("aria-expanded"),
      taste: document.querySelector("#arKaempfe")?.getAttribute("aria-keyshortcuts") }));
    assert(k0.leiste && k0.rolle === "group" && !!k0.label && k0.modus === "Auswählen" && k0.loes === 3 && k0.chip === "Gelöste (1)" && k0.exp === "false" && k0.taste === "Delete",
      "Lösen: Leiste mit „Auswählen“, je Zeile „Lösen“, im Kopf „Gelöste (1)“, die Taste Entf ist genannt", k0);
    assert((await statN(s)).startsWith("3 Kämpfe | 466.8k bester"), "vorher: 3 Kämpfe, bester 466.8k", await statN(s));
    // der Knopf nimmt der Tabelle keine Spalte: der Charakter behaelt seinen Platz, auch im Auswahlmodus (unten)
    const spalte = () => s.page.evaluate(() => Math.min(...[...document.querySelectorAll("#arKaempfe .arc")].map((e) => e.getBoundingClientRect().width)));
    assert(await spalte() >= 36, "Lösen: der Knopf nimmt der Tabelle keine Spalte, der Charakter behält seine Breite", await spalte());
    /* eine Zeile mit der Maus: der Knopf an ihr loest genau diesen Kampf */
    await s.page.hover('#arKaempfe [role=option][data-k="' + MK2 + '"]');
    await s.page.click('#arKaempfe [role=option][data-k="' + MK2 + '"] .arloes');
    assert(await bis(() => s.loesen.length === 1), "Zeile: ein POST /api/archiv/loesen", s.loesen);
    assert(JSON.stringify(s.loesen[0]?.body) === JSON.stringify({ ks: [MK2], geloest: true }) && /application\/json/.test(s.loesen[0]?.typ), "Zeile: genau {ks, geloest: true}", s.loesen[0]);
    assert(await bis(async () => (await zeilenK(s)).length === 2), "Zeile: der Kampf verschwindet sofort aus der Bossseite", await zeilenK(s));
    assert(!(await zeilenK(s)).includes(MK2) && !s.kampf.length, "Zeile: der gelöste ist weg, geöffnet wurde nichts", { z: await zeilenK(s), k: s.kampf });
    const nach = await statN(s);
    assert(nach.startsWith("2 Kämpfe | 301.0k bester"), "Zeile: Zahl, bester DPS und Median ziehen nach", nach);
    assert(await s.page.evaluate(() => document.querySelectorAll("#arVerlauf svg.histplot circle.hp").length) === 2, "Zeile: die Grafik zeigt zwei Kämpfe");
    const karte = (await zeile(s, "feld:morokai"))?.text || "";
    assert(/2 Kämpfe/.test(karte) && /301\.0k/.test(karte), "Zeile: die Karte des Bosses zieht nach", karte);
    assert(/^4 Kämpfe gegen 3 Bosse$/.test(await s.page.evaluate(() => document.querySelector("#arQuelle").textContent.trim())), "Zeile: die Zahl oben zieht nach",
      await s.page.evaluate(() => document.querySelector("#arQuelle").textContent));
    assert((await chipText(s)) === "Gelöste (2)", "Zeile: der Chip zählt mit", await chipText(s));
    assert(await bis(async () => /^1 Kampf gelöst Rückgängig$/.test(await toastText(s))), "Zeile: Meldung „1 Kampf gelöst · Rückgängig“", await toastText(s));
    assert(await bis(async () => /1 Kampf gelöst/.test(await ansage(s))), "Zeile: der Vorleser hört es", await ansage(s));
    /* Rueckgaengig: derselbe Aufruf mit geloest false */
    await s.page.click("#toast .tact");
    assert(await bis(() => s.loesen.length === 2), "Rückgängig: ein zweiter POST", s.loesen);
    assert(JSON.stringify(s.loesen[1]?.body) === JSON.stringify({ ks: [MK2], geloest: false }), "Rückgängig: {ks, geloest: false}", s.loesen[1]);
    assert(await bis(async () => (await zeilenK(s)).length === 3 && (await chipText(s)) === "Gelöste (1)"), "Rückgängig: der Kampf ist zurück, der Chip zählt zurück", { z: await zeilenK(s), c: await chipText(s) });
    assert((await statN(s)).startsWith("3 Kämpfe | 466.8k bester"), "Rückgängig: die Zahlen stehen wie vorher", await statN(s));
    /* die Tastatur: Entf loest die Zeile, auf der die Tastatur steht; der Hinweis steht, solange die Liste den Fokus hat */
    await s.page.focus("#arKaempfe");
    await s.page.keyboard.press("Home");
    const tipp = await s.page.evaluate(() => { const e = document.querySelector("#arWTipp"); return e ? { t: e.textContent.trim(), sicht: getComputedStyle(e).visibility === "visible" && !!e.getClientRects().length,
      desc: (document.querySelector("#arKaempfe").getAttribute("aria-describedby") || "").split(" ").includes("arWTipp") } : null; });
    assert(tipp && /Entf/.test(tipp.t) && tipp.sicht && tipp.desc, "Tastatur: der Hinweis „Entf“ steht sichtbar und beschreibt die Liste", tipp);
    const erste = (await zeilenK(s))[0];
    await s.page.keyboard.press("Delete");
    assert(await bis(() => s.loesen.length === 3), "Entf: ein POST", s.loesen);
    assert(JSON.stringify(s.loesen[2]?.body) === JSON.stringify({ ks: [erste], geloest: true }), "Entf: genau die Zeile der Tastatur", { b: s.loesen[2]?.body, erste });
    assert(await bis(async () => (await zeilenK(s)).length === 2) && await s.page.evaluate(() => document.activeElement?.id === "arKaempfe"), "Entf: die Zeile ist weg, der Fokus bleibt in der Liste");
    await s.page.click("#toast .tact");
    assert(await bis(async () => (await zeilenK(s)).length === 3), "Entf, Rückgängig: wieder drei");
    /* Auswaehlen: Leertaste und Klick schalten, die Zahl im aria-live-Satz, Loesen loest genau die Auswahl */
    await s.page.click("#arWModus");
    const m0 = await s.page.evaluate(() => ({ multi: document.querySelector("#arKaempfe").getAttribute("aria-multiselectable"), zahl: document.querySelector("#arWZahl")?.textContent.trim(),
      loesen: document.querySelector("#arWLoesen")?.disabled, fertig: !!document.querySelector("#arWFertig")?.getClientRects().length,
      kaestchen: document.querySelectorAll("#arKaempfe .arwbox").length, knopf: [...document.querySelectorAll("#arKaempfe .arloes")].filter((b) => b.getClientRects().length).length,
      sel: [...document.querySelectorAll("#arKaempfe [role=option]")].map((e) => e.getAttribute("aria-selected")).join() }));
    assert(m0.multi === "true" && m0.zahl === "0 gewählt" && m0.loesen === true && m0.fertig && m0.kaestchen === 3 && m0.knopf === 0 && m0.sel === "false,false,false",
      "Auswählen: Kästchen je Zeile, „0 gewählt“, Lösen erst mit Auswahl, „Fertig“", m0);
    assert(await spalte() >= 30, "Auswählen: auch mit Kästchen bleibt Platz für den Charakter", await spalte());
    assert(await bis(async () => /0 Kämpfe gewählt/.test(await ansage(s))) && await s.page.evaluate(() => document.activeElement?.id === "arKaempfe"),
      "Auswählen: der aria-live-Satz sagt die Zahl, der Fokus steht in der Kampfliste", await ansage(s));
    await s.page.focus("#arKaempfe");
    await s.page.keyboard.press("Home");
    await s.page.keyboard.press(" ");
    await s.page.keyboard.press("ArrowDown");
    await s.page.keyboard.press("Enter");
    const m1 = await s.page.evaluate(() => ({ zahl: document.querySelector("#arWZahl")?.textContent.trim(), sel: [...document.querySelectorAll("#arKaempfe [role=option]")].map((e) => e.getAttribute("aria-selected")).join(),
      an: document.querySelectorAll("#arKaempfe .arwbox.an").length, loesen: document.querySelector("#arWLoesen")?.disabled }));
    assert(m1.zahl === "2 gewählt" && m1.sel === "true,true,false" && m1.an === 2 && m1.loesen === false && !s.kampf.length, "Auswählen: Leertaste und Enter schalten die Zeile, nichts öffnet sich", m1);
    assert(await bis(async () => /2 Kämpfe gewählt/.test(await ansage(s))), "Auswählen: der Vorleser hört die Zahl", await ansage(s));
    await s.page.click('#arKaempfe [role=option]:nth-child(3)');
    assert(await bis(() => s.page.evaluate(() => document.querySelector("#arWZahl")?.textContent.trim() === "3 gewählt")) && !s.kampf.length, "Auswählen: ein Klick schaltet, öffnet nichts");
    await s.page.click("#arWKeine");
    assert(await s.page.evaluate(() => document.querySelector("#arWZahl")?.textContent.trim() === "0 gewählt"), "Keine: nichts gewählt");
    await s.page.click("#arWAlle");
    assert(await s.page.evaluate(() => document.querySelector("#arWZahl")?.textContent.trim() === "3 gewählt"), "Alle: alle drei");
    await s.page.click('#arKaempfe [role=option]:nth-child(1)');
    const gewaehlt = await s.page.evaluate(() => [...document.querySelectorAll('#arKaempfe [role=option][aria-selected="true"]')].map((e) => e.dataset.k));
    await s.page.click("#arWLoesen");
    assert(await bis(() => s.loesen.length === 5), "Auswahl lösen: ein POST", s.loesen.length);
    assert(JSON.stringify(s.loesen[4]?.body) === JSON.stringify({ ks: gewaehlt, geloest: true }) && gewaehlt.length === 2, "Auswahl lösen: genau die Auswahl", { b: s.loesen[4]?.body, gewaehlt });
    assert(await bis(async () => (await zeilenK(s)).length === 1 && /^2 Kämpfe gelöst Rückgängig$/.test(await toastText(s))), "Auswahl lösen: zwei weg, „2 Kämpfe gelöst · Rückgängig“", await toastText(s));
    assert(await s.page.evaluate(() => document.querySelector("#arWZahl")?.textContent.trim() === "0 gewählt" && !!document.activeElement && document.querySelector("#arRechts").contains(document.activeElement)),
      "Auswahl lösen: die Auswahl ist leer, der Fokus bleibt auf der Bossseite");
    // Esc beendet den Auswahlmodus (statt eine Ebene hoch zu gehen)
    await s.page.focus("#arKaempfe");
    await s.page.keyboard.press("Escape");
    assert(await s.page.evaluate(() => !!document.querySelector("#arWModus")?.getClientRects().length && !document.querySelector("#arWFertig")?.getClientRects().length
      && document.querySelector("#arKaempfe").getAttribute("aria-multiselectable") !== "true" && !!document.querySelector("#arKaempfe").getClientRects().length), "Esc: der Auswahlmodus endet, die Bossseite bleibt");
    /* die Liste der Geloesten: im Kopf, ueber alle Bosse, je Boss gegliedert, neueste zuerst */
    assert((await chipText(s)) === "Gelöste (3)", "Chip: Gelöste (3)", await chipText(s));
    await s.page.click("#arGChip");
    await s.page.waitForFunction(() => !!document.querySelector("#arGeloeste")?.getClientRects().length);
    const g0 = await s.page.evaluate(() => ({ zwei: !!document.querySelector("#arZwei").getClientRects().length, exp: document.querySelector("#arGChip").getAttribute("aria-expanded"),
      fokus: document.activeElement?.id, titel: document.querySelector("#arGTitel")?.textContent.trim(), zahl: document.querySelector("#arGZahl")?.textContent.trim(),
      satz: document.querySelector("#arGeloeste .argsatz")?.textContent.trim() }));
    assert(!g0.zwei && g0.exp === "true" && g0.fokus === "arGTitel" && g0.titel === "Gelöste Kämpfe" && g0.zahl === "3" && /wiederherstellen/.test(g0.satz) && /Verlauf/.test(g0.satz),
      "Gelöste: die Liste steht statt der Karten, der Fokus auf ihrer Überschrift", g0);
    const gr = await gruppenG(s);
    const morokaiG = [...gewaehlt].sort((a, b) => v.find((x) => x.k === b).at - v.find((x) => x.k === a).at);
    const erwartetG = [["Morokai", morokaiG], ["Chernobog", [CHK]]].sort((a, b) => v.find((x) => x.k === b[1][0]).at - v.find((x) => x.k === a[1][0]).at);
    assert(JSON.stringify(gr) === JSON.stringify(erwartetG), "Gelöste: je Boss gegliedert, der Boss mit dem neuesten gelösten Kampf zuerst, darin neueste zuerst", { gr, erwartetG });
    const gz = await s.page.evaluate(() => [...document.querySelectorAll("#arGeloeste .argcb")].map((c) => ({ label: c.getAttribute("aria-label") || "", typ: c.type })));
    assert(gz.every((x) => x.typ === "checkbox" && /DPS/.test(x.label)), "Gelöste: je Kampf ein Kästchen mit Namen für den Vorleser", gz);
    const gText = await s.page.evaluate(() => document.querySelector("#arGeloeste").textContent);
    assert(!gText.includes(SPIELER) && !/\bBau\b/.test(gText), "Gelöste: kein Spielername, kein „Bau“");
    assert(await s.page.evaluate(() => document.querySelector("#arGWieder").disabled && document.querySelector("#arGLoeschen").disabled), "Gelöste: ohne Auswahl ist nichts zu tun");
    /* Wiederherstellen */
    const zurueckK = morokaiG[1];
    await s.page.check('#arGeloeste .argcb[data-k="' + zurueckK + '"]');
    assert((await gZahl(s)) === "1 gewählt", "Gelöste: 1 gewählt", await gZahl(s));
    assert(await s.page.evaluate(() => document.activeElement?.classList.contains("argcb")), "Gelöste: der Fokus bleibt am Kästchen");
    await s.page.click("#arGWieder");
    assert(await bis(() => s.loesen.length === 6), "Wiederherstellen: ein POST", s.loesen.length);
    assert(JSON.stringify(s.loesen[5]?.body) === JSON.stringify({ ks: [zurueckK], geloest: false }), "Wiederherstellen: {ks, geloest: false}", s.loesen[5]?.body);
    assert(await bis(async () => (await chipText(s)) === "Gelöste (2)" && (await gruppenG(s)).flatMap((x) => x[1]).length === 2), "Wiederherstellen: aus der Liste, der Chip zählt mit", await gruppenG(s));
    /* der Loeschdialog fuer einen Kampf: der Satz zum Abtippen, Knopf erst bei stimmendem Text; Esc und Abbrechen tun nichts */
    await s.page.check('#arGeloeste .argcb[data-k="' + CHK + '"]');
    await s.page.click("#arGLoeschen");
    assert(await bis(() => dlgOffen(s)), "Dialog: offen");
    const soll = "Chernobog " + logTag(VERZ[3].at);
    const d0 = await s.page.evaluate(() => { const d = document.querySelector("#arDlg"); return { role: d.getAttribute("role"), modal: d.getAttribute("aria-modal"),
      titel: document.getElementById(d.getAttribute("aria-labelledby"))?.textContent.trim(), satz: document.getElementById(d.getAttribute("aria-describedby"))?.textContent.replace(/\s+/g, " ").trim(),
      soll: document.querySelector("#arDlgSoll")?.textContent.trim(), tipp: document.querySelector("#arDlgTipp")?.textContent.trim(), ja: document.querySelector("#arDlgJa").disabled,
      jaText: document.querySelector("#arDlgJa").textContent.trim(), nein: document.querySelector("#arDlgNein").textContent.trim(), fokus: document.activeElement?.id,
      feldName: document.querySelector("#arDlgFeld").getAttribute("aria-labelledby") }; });
    assert(d0.role === "dialog" && d0.modal === "true" && d0.titel === "Endgültig löschen" && d0.fokus === "arDlgFeld", "Dialog: role=dialog, aria-modal, Titel, der Fokus im Feld", d0);
    assert(/^Der Kampf .*Chernobog.* wird endgültig gelöscht\. Vorher legt Borometer eine Sicherung im Ordner sicherungen an, die es nie löscht\.$/.test(d0.satz), "Dialog: der Satz sagt, was geschieht", d0.satz);
    assert(d0.soll === soll && /Bossnamen, wie das Log ihn schreibt/.test(d0.tipp) && /Datum des Kampfs, wie die Liste es zeigt/.test(d0.tipp) && d0.ja === true && d0.jaText === "Löschen" && d0.nein === "Abbrechen",
      "Dialog: einzeln „Boss TT.MM.JJJJ“ zum Abtippen, „Löschen“ noch aus", { d0, soll });
    await s.page.fill("#arDlgFeld", "Chernobog 01.01.2020");
    assert(await s.page.evaluate(() => document.querySelector("#arDlgJa").disabled), "Dialog: falscher Text, der Knopf bleibt aus");
    await s.page.keyboard.press("Enter");
    assert(await dlgOffen(s) && !s.loeschen.length, "Dialog: Enter mit falschem Text sendet nichts");
    for (let i = 0; i < 6; i++) { await s.page.keyboard.press("Tab"); if (!(await imDialog(s))) break; }
    assert(await imDialog(s), "Dialog: Tab bleibt im Dialog");
    for (let i = 0; i < 6; i++) { await s.page.keyboard.press("Shift+Tab"); if (!(await imDialog(s))) break; }
    assert(await imDialog(s), "Dialog: Umschalt+Tab bleibt im Dialog");
    await s.page.keyboard.press("Escape");
    assert(await bis(async () => !(await dlgOffen(s))) && !s.loeschen.length, "Esc: der Dialog schließt, nichts gesendet", s.loeschen);
    assert(await s.page.evaluate(() => document.activeElement?.id === "arGLoeschen") && !!(await s.page.evaluate(() => document.querySelector("#arGeloeste")?.getClientRects().length)),
      "Esc: der Fokus kehrt zum Knopf zurück, die Liste bleibt offen");
    await s.page.keyboard.press("Enter");
    assert(await bis(() => dlgOffen(s)), "Enter auf dem Knopf öffnet den Dialog wieder");
    await s.page.fill("#arDlgFeld", soll);
    await s.page.click("#arDlgNein");
    assert(await bis(async () => !(await dlgOffen(s))) && !s.loeschen.length && await s.page.evaluate(() => document.activeElement?.id === "arGLoeschen"),
      "Abbrechen: schließt, nichts gesendet, der Fokus zurück", s.loeschen);
    await s.page.click("#arGLoeschen");
    await bis(() => dlgOffen(s));
    assert(await s.page.evaluate(() => document.querySelector("#arDlgFeld").value === "" && document.querySelector("#arDlgJa").disabled), "Dialog: jedes Öffnen beginnt leer");
    await s.page.fill("#arDlgFeld", "  " + soll.toLowerCase() + " ");
    assert(await s.page.evaluate(() => !document.querySelector("#arDlgJa").disabled), "Dialog: der Text stimmt (Groß-/Kleinschreibung und Leerzeichen am Rand egal), der Knopf geht");
    const listenVor = s.listen;
    await s.page.keyboard.press("Enter");
    assert(await bis(() => s.loeschen.length === 1), "Löschen: ein POST /api/archiv/loeschen", s.loeschen);
    assert(JSON.stringify(s.loeschen[0]?.body) === JSON.stringify({ ks: [CHK], bestaetigung: "  " + soll.toLowerCase() + " " }) && /application\/json/.test(s.loeschen[0]?.typ),
      "Löschen: genau {ks, bestaetigung}", s.loeschen[0]);
    assert(await bis(() => s.page.evaluate(() => !document.querySelector("#arDlgErg").hidden)), "Löschen: das Ergebnis steht");
    const e0 = await s.page.evaluate(() => ({ titel: document.querySelector("#arDlgT").textContent.trim(), satz: document.querySelector("#arDlgS").textContent.replace(/\s+/g, " ").trim(),
      li: [...document.querySelectorAll("#arDlgListe li")].map((l) => l.textContent.replace(/\s+/g, " ").trim()), liste: document.querySelector("#arDlgListe")?.tagName,
      ordner: document.querySelector("#arDlgOrdner")?.textContent.trim(), fokus: document.activeElement?.id, form: !document.querySelector("#arDlgForm").getClientRects().length }));
    assert(e0.titel === "1 Kampf gelöscht" && /archiv-vor-loeschen-2026-10-26/.test(e0.satz) && /sicherungen/.test(e0.satz) && e0.liste === "UL" && e0.li.length === 1 && /Chernobog/.test(e0.li[0]) && /gelöscht/.test(e0.li[0])
      && e0.ordner === "Sicherungsordner öffnen" && e0.fokus === "arDlgT" && e0.form, "Ergebnis: je Kampf als Liste, der Name des Sicherungsordners, der Knopf zum Ordner", e0);
    assert(await bis(async () => /1 Kampf gelöscht/.test(await ansage(s))), "Ergebnis: der Vorleser hört es", await ansage(s));
    assert(await bis(() => s.listen > listenVor), "Ergebnis: das Verzeichnis wird neu gelesen", { vor: listenVor, jetzt: s.listen });
    assert(await bis(async () => (await chipText(s)) === "Gelöste (1)"), "Ergebnis: der Chip zählt nach dem neuen Lesen", await chipText(s));
    await s.page.click("#arDlgOrdner");
    assert(await bis(() => s.sicherungen.length === 1), "Sicherungsordner öffnen: ein POST", s.sicherungen);
    assert(s.sicherungen[0]?.body === "{}" && s.loeschen.length === 1, "Sicherungsordner öffnen: ohne Pfad, Körper {}", s.sicherungen);
    assert(await bis(async () => /sicherungen/.test(await s.page.evaluate(() => document.querySelector("#arDlgMeld")?.textContent || ""))), "Sicherungsordner öffnen: ein ruhiger Satz");
    await s.page.keyboard.press("Escape");
    assert(await bis(async () => !(await dlgOffen(s))) && await s.page.evaluate(() => !!document.activeElement && document.querySelector("#archiv").contains(document.activeElement)),
      "Ergebnis: Esc schließt, der Fokus bleibt im Bereich");
    /* Zurueck: die Karten stehen wieder, der Fokus auf dem Chip */
    await s.page.click("#arGZu");
    assert(await s.page.evaluate(() => !!document.querySelector("#arZwei").getClientRects().length && !document.querySelector("#arGeloeste").getClientRects().length
      && document.activeElement?.id === "arGChip"), "Zurück: die Karten stehen wieder, der Fokus auf dem Chip");
    assert(!s.fehler.length && !s.fremd.length, "Lösen und Löschen: keine Seitenfehler, keine fremde Anfrage", { f: s.fehler, r: s.fremd });
    await s.page.close();
  }
  /* Mehrere: die Anzahl zum Abtippen; die Ablehnungen des Hauptprozesses je in einem ruhigen Satz; keine Antwort */
  {
    const v = [...frisch(), eintrag("feld:morokai", "Morokai", DC, M3 + 60 * MIN, 1000, 30, { geloest: true }), eintrag("feld:cornelius", "Cornelius", DC, M3 + 90 * MIN, 2000, 30, { geloest: true })];
    for (const e of v) if (e.platz === "feld:morokai") e.geloest = true;
    const s = await oeffne({ verzeichnis: v, texte: TEXTE });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    await s.page.waitForFunction(() => document.querySelector("#arBosse")?.dataset.stand === "da");
    assert((await chipText(s)) === "Gelöste (6)", "mehrere: Gelöste (6)", await chipText(s));
    await s.page.click("#arGChip");
    await s.page.waitForFunction(() => document.querySelectorAll("#arGeloeste .argcb").length === 6);
    // das Kaestchen eines Bosses waehlt seine Kaempfe; Alle und Keine
    await s.page.check('#arGeloeste .arggcb[data-platz="feld:morokai"]');
    assert((await gZahl(s)) === "4 gewählt", "Boss-Kästchen: alle Kämpfe des Bosses", await gZahl(s));
    await s.page.click("#arGKeine");
    assert((await gZahl(s)) === "0 gewählt", "Keine", await gZahl(s));
    await s.page.click("#arGAlle");
    assert((await gZahl(s)) === "6 gewählt", "Alle", await gZahl(s));
    const oeffneDlg = async () => {
      await s.page.click("#arGLoeschen");
      await bis(() => dlgOffen(s));
      await s.page.fill("#arDlgFeld", "6");
      await s.page.click("#arDlgJa");
    };
    await s.page.click("#arGLoeschen");
    await bis(() => dlgOffen(s));
    const d1 = await s.page.evaluate(() => ({ satz: document.querySelector("#arDlgS").textContent.replace(/\s+/g, " ").trim(), soll: document.querySelector("#arDlgSoll").textContent.trim(),
      tipp: document.querySelector("#arDlgTipp").textContent.trim(), liste: document.querySelectorAll("#arDlgS li, #arDlg .ardliste li").length }));
    assert(/^6 Kämpfe werden endgültig gelöscht\. Vorher legt Borometer eine Sicherung im Ordner sicherungen an, die es nie löscht\./.test(d1.satz) && d1.soll === "6" && /Anzahl/.test(d1.tipp),
      "mehrere: der Satz mit der Zahl, die Anzahl zum Abtippen", d1);
    await s.page.fill("#arDlgFeld", "06");
    assert(await s.page.evaluate(() => document.querySelector("#arDlgJa").disabled), "mehrere: „06“ zählt nicht");
    await s.page.fill("#arDlgFeld", " 6 ");
    assert(await s.page.evaluate(() => !document.querySelector("#arDlgJa").disabled), "mehrere: „ 6 “ zählt");
    await s.page.click("#arDlgNein");
    const ablehnung = async (antwort, n, muster, name) => {
      s.loeschAntwort = antwort;
      await oeffneDlg();
      assert(await bis(() => s.loeschen.length === n), name + ": ein POST", s.loeschen.length);
      assert(await bis(() => s.page.evaluate(() => !document.querySelector("#arDlgErg").hidden)), name + ": die Antwort steht");
      const a = await s.page.evaluate(() => ({ titel: document.querySelector("#arDlgT").textContent.trim(), satz: document.querySelector("#arDlgS").textContent.replace(/\s+/g, " ").trim(),
        li: [...document.querySelectorAll("#arDlgListe li")].map((l) => l.textContent.replace(/\s+/g, " ").trim()), ordner: !!document.querySelector("#arDlgOrdner")?.getClientRects().length }));
      assert(a.titel === "Nichts gelöscht" && muster.test(a.satz) && a.li.length === 6, name + ": „Nichts gelöscht“, der Grund in einem Satz, je Kampf eine Zeile", a);
      await s.page.click("#arDlgZu");
      await bis(async () => !(await dlgOffen(s)));
      return a;
    };
    const a1 = await ablehnung([200, { ok: false, grund: "bestaetigung" }], 1, /Bestätigung stimmte nicht/, "bestaetigung");
    assert(!a1.ordner && a1.li.every((l) => /nicht gelöscht/.test(l)), "bestaetigung: kein Ordner, jeder Kampf „nicht gelöscht“", a1);
    const a2 = await ablehnung([200, { ok: false, grund: "sicherung", sicherung: "archiv-vor-loeschen-2026-10-26-2" }], 2, /Sicherung ließ sich nicht vollständig anlegen.*archiv-vor-loeschen-2026-10-26-2/, "sicherung");
    assert(a2.ordner, "sicherung: der Knopf zum Ordner steht", a2);
    const a3 = await ablehnung([200, { ok: false, grund: "nicht-geloest", kaempfe: [MK1] }], 3, /nicht mehr gelöst/, "nicht-geloest");
    assert(a3.li.filter((l) => /nicht mehr gelöst/.test(l)).length === 1 && a3.li.filter((l) => /nicht gelöscht/.test(l)).length === 5, "nicht-geloest: welcher Kampf, steht an ihm", a3);
    await ablehnung([503, { ok: false, grund: "unavailable" }], 4, /lässt sich gerade nicht lesen oder schreiben/, "unavailable");
    await ablehnung([400, { ok: false, grund: "abgelehnt" }], 5, /nicht angenommen/, "abgelehnt");
    assert(await bis(async () => (await chipText(s)) === "Gelöste (6)"), "nach den Ablehnungen: nichts ist weg", await chipText(s));
    // Erfolg mit einer Datei, die bleibt: der Titel zaehlt nur, was wirklich geloescht ist (geloescht, ohne-datei)
    {
      const ks = v.filter((x) => x.geloest).map((x) => x.k);
      s.loeschAntwort = [200, { ok: true, sicherung: "archiv-vor-loeschen-2026-10-26", ergebnis: Object.fromEntries(ks.map((k, i) => [k, i === 0 ? "datei-bleibt" : i === 1 ? "ohne-datei" : "geloescht"])) }];
      await oeffneDlg();
      assert(await bis(() => s.page.evaluate(() => !document.querySelector("#arDlgErg").hidden)), "datei-bleibt: das Ergebnis steht");
      const t = await s.page.evaluate(() => ({ titel: document.querySelector("#arDlgT").textContent.trim(), li: [...document.querySelectorAll("#arDlgListe li")].map((l) => l.textContent.replace(/\s+/g, " ").trim()) }));
      assert(t.titel === "5 Kämpfe gelöscht" && t.li.filter((l) => /Datei ließ sich nicht löschen/.test(l)).length === 1, "datei-bleibt: der Titel zählt 5 gelöschte, die bleibende Datei steht an ihrem Kampf", t);
      await s.page.click("#arDlgZu");
    }
    assert(!s.fehler.length && !s.fremd.length, "mehrere: keine Seitenfehler, keine fremde Anfrage", { f: s.fehler, r: s.fremd });
    await s.page.close();
  }
  /* Fix-Runde 1 der Seite: der Dialog haelt Strg+K zurueck (state.modalOpen); Rueckgaengig waehrend eines Loesens wartet;
     wer den Bereich verlaesst, laesst Auswahl und Liste der Geloesten zurueck; ein 503 beim Loeschen nennt den Schreibfehler */
  {
    const v = frisch();
    const s = await oeffne({ verzeichnis: v, texte: TEXTE });
    await bossseite(s, "feld:morokai", 3);
    // Rueckgaengig, waehrend ein anderes Loesen laeuft: es wartet und geht danach
    await s.page.hover('#arKaempfe [role=option][data-k="' + MK2 + '"]');
    await s.page.click('#arKaempfe [role=option][data-k="' + MK2 + '"] .arloes');
    assert(await bis(async () => (await zeilenK(s)).length === 2 && /Rückgängig/.test(await toastText(s))), "Warteschlange: erstes Lösen fertig, Rückgängig steht");
    let auf; s.loesenTor = { warte: new Promise((r) => { auf = r; }) };
    await s.page.hover('#arKaempfe [role=option][data-k="' + MK1 + '"]');
    await s.page.click('#arKaempfe [role=option][data-k="' + MK1 + '"] .arloes');
    assert(await bis(() => s.loesen.length === 2), "Warteschlange: das zweite Lösen läuft", s.loesen.length);
    await s.page.click("#toast .tact");
    s.loesenTor = null; auf();
    assert(await bis(() => s.loesen.length === 3), "Warteschlange: das Rückgängig wird nach dem laufenden Lösen gesendet", s.loesen.map((x) => x.body));
    assert(JSON.stringify(s.loesen.map((x) => x.body)) === JSON.stringify([{ ks: [MK2], geloest: true }, { ks: [MK1], geloest: true }, { ks: [MK2], geloest: false }]),
      "Warteschlange: Lösen, Lösen, dann Rückgängig des ersten", s.loesen.map((x) => x.body));
    assert(await bis(async () => (await zeilenK(s)).length === 2 && (await zeilenK(s)).includes(MK2) && !(await zeilenK(s)).includes(MK1)), "Warteschlange: der erste ist zurück, der zweite gelöst", await zeilenK(s));
    // Auswahl und Liste der Geloesten bleiben nicht stehen, wenn man den Bereich verlaesst
    await s.page.click("#arWModus");
    await s.page.click("#arWAlle");
    await s.page.click("#arGChip");
    await s.page.waitForFunction(() => document.querySelectorAll("#arGeloeste .argcb").length === 2);
    await s.page.click("#arGAlle");
    await s.page.click('#bereiche [data-tab="rekorde"]');
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    const r = await s.page.evaluate(() => ({ gl: !!document.querySelector("#arGeloeste").getClientRects().length, zwei: !!document.querySelector("#arZwei").getClientRects().length,
      exp: document.querySelector("#arGChip").getAttribute("aria-expanded"), modus: !!document.querySelector("#arWModus")?.getClientRects().length,
      multi: document.querySelector("#arKaempfe").getAttribute("aria-multiselectable") }));
    assert(!r.gl && r.zwei && r.exp === "false" && r.modus && r.multi !== "true", "Verlassen: der Auswahlmodus und die Liste der Gelösten sind zurückgesetzt", r);
    await s.page.click("#arGChip");
    await s.page.waitForFunction(() => document.querySelectorAll("#arGeloeste .argcb").length === 2);
    assert(await s.page.evaluate(() => !document.querySelectorAll("#arGeloeste .argcb:checked").length && document.querySelector("#arGWZahl").textContent.trim() === "0 gewählt"),
      "Verlassen: in der Liste der Gelösten ist nichts mehr gewählt");
    // der offene Dialog haelt Strg+K zurueck; nach dem Schliessen geht es wieder
    await s.page.check("#arGeloeste .argcb >> nth=0");
    await s.page.click("#arGLoeschen");
    await bis(() => dlgOffen(s));
    await s.page.keyboard.press("Control+k");
    assert(await s.page.evaluate(() => document.querySelector("#kampfwahl").hidden) && await dlgOffen(s), "Dialog offen: Strg+K öffnet die Kampfwahl nicht");
    // ein 503 beim Loeschen: der Satz zum Schreibfehler steht in den Einstellungen
    s.loeschAntwort = [503, { ok: false, grund: "unavailable" }];
    await s.page.fill("#arDlgFeld", await s.page.evaluate(() => document.querySelector("#arDlgSoll").textContent.trim()));
    await s.page.click("#arDlgJa");
    assert(await bis(() => s.page.evaluate(() => !document.querySelector("#arDlgErg").hidden)), "503: die Antwort steht");
    await s.page.click("#arDlgZu");
    assert(await bis(async () => !(await dlgOffen(s))), "503: der Dialog ist zu");
    await s.page.keyboard.press("Control+k");
    assert(await bis(() => s.page.evaluate(() => !document.querySelector("#kampfwahl").hidden)), "Dialog zu: Strg+K öffnet die Kampfwahl wieder");
    await s.page.keyboard.press("Escape");
    await s.page.click('#bereiche [data-tab="settings"]');
    await s.page.click('#einstNav button[data-gruppe="archiv"]');
    const satz = () => s.page.evaluate(() => { const e = document.querySelector("#eArchivFehler"); return e && e.getClientRects().length > 0 ? e.textContent.trim() : ""; });
    assert(await bis(async () => /nicht schreiben/.test(await satz())), "503 beim Löschen: der Satz zum Schreibfehler steht im Abschnitt Archiv", await satz());
    assert(!s.fehler.length, "Fix-Runde 1: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  /* Grenze: hoechstens 500 Kaempfe auf einmal, ruhig gesagt */
  {
    const v = [];
    for (let i = 0; i < 501; i++) v.push(eintrag("feld:cornelius", "Cornelius", "grenze.txt", M1 + i * MIN, 1000 + i, 30));
    for (let i = 0; i < 501; i++) v.push(eintrag("feld:malakar", "Malakar", "grenze.txt", M2 + i * MIN, 1000 + i, 30, { geloest: true }));
    const s = await oeffne({ verzeichnis: v });
    await bossseite(s, "feld:cornelius", 501);
    await s.page.click("#arWModus");
    await s.page.click("#arWAlle");
    const g = await s.page.evaluate(() => ({ zahl: document.querySelector("#arWZahl").textContent.replace(/\s+/g, " ").trim(), aus: document.querySelector("#arWLoesen").disabled }));
    assert(/^501 gewählt · höchstens 500 auf einmal$/.test(g.zahl) && g.aus, "Grenze: 501 gewählt, Lösen aus, der Satz sagt es", g);
    await s.page.click('#arKaempfe [role=option]:nth-child(1)');
    assert(await s.page.evaluate(() => !document.querySelector("#arWLoesen").disabled && document.querySelector("#arWZahl").textContent.trim() === "500 gewählt"), "Grenze: 500 gehen");
    await s.page.click("#arGChip");
    await s.page.waitForFunction(() => document.querySelectorAll("#arGeloeste .argcb").length === 501);
    await s.page.click("#arGAlle");
    const h = await s.page.evaluate(() => ({ zahl: document.querySelector("#arGWZahl").textContent.replace(/\s+/g, " ").trim(), w: document.querySelector("#arGWieder").disabled, l: document.querySelector("#arGLoeschen").disabled }));
    assert(/^501 gewählt · höchstens 500 auf einmal$/.test(h.zahl) && h.w && h.l, "Grenze: in den Gelösten ebenso", h);
    assert(!s.loesen.length && !s.loeschen.length && !s.fehler.length, "Grenze: nichts gesendet, keine Seitenfehler", { l: s.loesen.length, f: s.fehler });
    await s.page.close();
  }
  /* Archiv ausgeschaltet: Loesen ist eine Handlung des Nutzers und geht trotzdem; das Loesen scheitert: nichts aendert sich */
  {
    const s = await oeffne({ verzeichnis: frisch(), config: { archivAn: false } });
    await bossseite(s, "feld:morokai", 3);
    await s.page.hover("#arKaempfe [role=option]:nth-child(1)");
    await s.page.click("#arKaempfe [role=option]:nth-child(1) .arloes");
    assert(await bis(async () => s.loesen.length === 1 && (await zeilenK(s)).length === 2), "ausgeschaltet: Lösen geht", s.loesen);
    s.stoer.loesen = 503;
    await s.page.hover("#arKaempfe [role=option]:nth-child(1)");
    await s.page.click("#arKaempfe [role=option]:nth-child(1) .arloes");
    assert(await bis(async () => s.loesen.length === 2 && /nicht geklappt/.test(await toastText(s))), "Lösen scheitert (503): ein Satz sagt es", await toastText(s));
    assert((await zeilenK(s)).length === 2 && (await chipText(s)) === "Gelöste (2)", "Lösen scheitert: nichts ändert sich", { z: await zeilenK(s), c: await chipText(s) });
    assert(!s.fehler.length, "ausgeschaltet: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  /* Englisch, 560 px: Texte, nichts rollt quer, die Meldung deckt die Leiste der Geloesten nicht */
  {
    const s = await oeffne({ verzeichnis: frisch(), texte: TEXTE, lang: "en", viewport: { width: 560, height: 900 } });
    await bossseite(s, "feld:morokai", 3);
    const e = await s.page.evaluate(() => ({ modus: document.querySelector("#arWModus").textContent.trim(), loes: document.querySelector("#arKaempfe .arloes")?.textContent.trim(),
      chip: document.querySelector("#arGChip").textContent.trim(), tipp: document.querySelector("#arWTipp")?.textContent.trim() }));
    assert(e.modus === "Select" && e.loes === "Detach" && e.chip === "Detached (1)" && /Del/.test(e.tipp), "EN: Auswählen, Lösen, Gelöste, Hinweis", e);
    assert(await quer(s), "560 px: die Bossseite mit Leiste rollt nicht quer");
    await s.page.click("#arWModus");
    assert(await quer(s), "560 px: im Auswahlmodus rollt nichts quer");
    await s.page.click("#arWAlle");
    await s.page.click("#arWLoesen");
    assert(await bis(async () => /^3 fights detached Undo$/.test(await toastText(s))), "EN: „3 fights detached · Undo“", await toastText(s));
    await s.page.click("#arZurueck");
    await s.page.click("#arGChip");
    await s.page.waitForFunction(() => document.querySelectorAll("#arGeloeste .argcb").length === 4);
    await s.page.check("#arGeloeste .argcb >> nth=0");
    await s.page.click("#arGWieder");
    assert(await bis(async () => /^1 fight restored$/.test(await toastText(s))), "EN: „1 fight restored“", await toastText(s));
    const lage = await s.page.evaluate(() => { const a = document.querySelector("#arGAkt").getBoundingClientRect(), t = document.querySelector("#toast").getBoundingClientRect();
      return { deckt: !(t.right <= a.left || t.left >= a.right || t.bottom <= a.top || t.top >= a.bottom), a: [a.top, a.bottom], t: [t.top, t.bottom] }; });
    assert(!lage.deckt, "560 px: die Meldung deckt die Leiste der Gelösten nicht", lage);
    const ge = await s.page.evaluate(() => ({ titel: document.querySelector("#arGTitel").textContent.trim(), w: document.querySelector("#arGWieder").textContent.trim(), l: document.querySelector("#arGLoeschen").textContent.trim() }));
    assert(ge.titel === "Detached fights" && ge.w === "Restore" && /^Delete for good/.test(ge.l), "EN: die Liste der Gelösten", ge);
    assert(await quer(s), "560 px: die Liste der Gelösten rollt nicht quer");
    await s.page.check("#arGeloeste .argcb >> nth=0");
    await s.page.click("#arGLoeschen");
    await bis(() => dlgOffen(s));
    const d = await s.page.evaluate(() => ({ titel: document.querySelector("#arDlgT").textContent.trim(), satz: document.querySelector("#arDlgS").textContent.replace(/\s+/g, " ").trim(),
      ja: document.querySelector("#arDlgJa").textContent.trim(), nein: document.querySelector("#arDlgNein").textContent.trim(), tipp: document.querySelector("#arDlgTipp").textContent.trim(),
      breit: document.querySelector("#arDlg").getBoundingClientRect().right <= innerWidth }));
    assert(d.titel === "Delete for good" && /will be deleted for good\. First Borometer saves a backup in the folder sicherungen, which it never deletes\./.test(d.satz) && d.ja === "Delete" && d.nein === "Cancel"
      && /boss name as the log writes it/.test(d.tipp) && /date of the fight as the list shows it/.test(d.tipp) && d.breit, "EN: der Dialog, 560 px ohne Querrollen", d);
    assert(await quer(s), "560 px: mit Dialog rollt nichts quer");
    assert(!s.fehler.length, "EN 560: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  /* 2000 x 1480: die Gelösten in mehreren Spalten, Zeilen nicht gestreckt */
  {
    const v = frisch();
    for (let i = 0; i < 6; i++) v.push(eintrag(["feld:cornelius", "feld:malakar", "feld:chernobog"][i % 3], ["Cornelius", "Malakar", "Chernobog"][i % 3], DC, M2 + i * 90 * MIN, 1000 + i, 30, { geloest: true }));
    const s = await oeffne({ verzeichnis: v, viewport: { width: 2000, height: 1480 } });
    await s.page.click('#bereiche [data-tab="archiv"]');
    await archivOffen(s);
    await s.page.waitForFunction(() => document.querySelector("#arBosse")?.dataset.stand === "da");
    await s.page.click("#arGChip");
    await s.page.waitForFunction(() => document.querySelectorAll("#arGeloeste .argcb").length === 7);
    const g = await s.page.evaluate(() => {
      const gr = [...document.querySelectorAll("#arGeloeste .arggruppe")].map((x) => x.getBoundingClientRect());
      const z = [...document.querySelectorAll("#arGeloeste .argzeile")].map((x) => x.getBoundingClientRect());
      return { spalten: new Set(gr.map((x) => Math.round(x.left))).size, zeileH: Math.max(...z.map((x) => x.height)), zeileW: Math.max(...z.map((x) => x.width)), quer: document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth };
    });
    assert(g.spalten >= 3 && g.zeileH <= 44 && g.zeileW <= 640 && g.quer, "2000 x 1480: die Gelösten in mehreren Spalten, Zeilen nicht gestreckt", g);
    assert(!s.fehler.length, "2000: keine Seitenfehler", s.fehler);
    await s.page.close();
  }

  /* ---------- Datei-Modus (ohne App): nichts bricht, nichts wird gesendet ---------- */
  {
    const s = await oeffne({ datei: true });
    await s.page.setInputFiles("#fileInput", L_BOSS);
    await s.page.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Morokai"));
    const ds = await s.page.evaluate(() => document.body.dataset.archivGeprueft ?? null);
    assert(ds === null, "Datei-Modus: das Archiv tut nichts", ds);
    assert(await s.page.evaluate(() => document.querySelector("#landArchiv")?.hidden === true), "Datei-Modus: kein Hinweis auf Start");
    await s.page.click('#bereiche [data-tab="settings"]');
    await s.page.waitForFunction(() => !document.querySelector("#einst").hidden);
    const z = await s.page.evaluate(() => ({ g: !document.querySelector("#eg-archiv").hidden,
      satz: document.querySelector("#eArchivBrowser")?.getClientRects().length ? document.querySelector("#eArchivBrowser").textContent.trim() : "",
      schalter: document.querySelector("#eArchiv").getClientRects().length, knopf: document.querySelector("#eArchivOrdner").getClientRects().length }));
    assert(z.g && z.satz === "Das Archiv gibt es nur in der App." && !z.schalter && !z.knopf, "Datei-Modus: der Abschnitt steht mit dem Satz, ohne Schalter und Knopf", z);
    // Alte Logs einlesen braucht die App: ohne sie keine Zeile und kein Knopf, der Satz darueber sagt es
    const al = await s.page.evaluate(() => ({ zeile: document.querySelector("#eAlteLogsZeile")?.getClientRects().length ?? -1,
      knopf: document.querySelector("#eAlteLogs")?.getClientRects().length ?? -1, da: !!document.querySelector("#eAlteLogs") }));
    assert(al.da && al.zeile === 0 && al.knopf === 0, "Datei-Modus: „Alte Logs einlesen“ steht nicht (der Satz sagt, das Archiv gibt es nur in der App)", al);
    assert(!s.fehler.length, "Datei-Modus: keine Seitenfehler", s.fehler);
    assert(!s.fremd.length, "Datei-Modus: keine Anfrage", s.fremd);
    await s.page.close();
  }

  /* ==================== Alte Logs einlesen (Spezifikation 8; Plan Aufgabe 10) ====================
     Ein gestellter Log-Ordner mit erfundenen Logs, die Zeiten der Dateien gesetzt (die erste die aelteste).
     Gelesen wird die Liste der Reihe nach (die neueste zuerst), jede Datei in Stuecken ueber GET /api/log. */
  const A0 = T0 + 3000 * MIN;
  const ordnerMit = (name, dateien) => {
    const d = join(work, name);
    mkdirSync(d, { recursive: true });
    dateien.forEach(([n, zeilen], i) => {
      const p = join(d, n);
      writeFileSync(p, ["CombatLogVersion,4", ...zeilen].join("\n") + "\n");
      const zeit = new Date(A0 + i * 60 * MIN);
      utimesSync(p, zeit, zeit);
    });
    return d;
  };
  const einst = async (s) => {
    await s.page.click('#bereiche [data-tab="settings"]');
    await s.page.click('#einstNav button[data-gruppe="archiv"]');
    await s.page.waitForFunction(() => document.activeElement?.id === "egh-archiv");
  };
  const alteStand = (s) => s.page.evaluate(() => document.querySelector("#eAlteLogsStand")?.textContent.replace(/\s+/g, " ").trim() || "");
  const tor = (s) => { let auf; const warte = new Promise((r) => { auf = r; }); s.tor = { warte, auf }; return s.tor; };
  const indexNamen = (s) => s.config.filter((b) => b.logIndex).flatMap((b) => Object.keys(b.logIndex));
  const gelesenVon = (s) => s.logArt.filter((a) => a.startsWith("GET /api/log ")).map((a) => a.split(" ")[2]);
  /* ==================== „Log öffnen“ fällt auf das Archiv zurück (Spezifikation 8; Plan Aufgabe 9) ====================
     Rekorde: fünf Kaempfe im Verlauf. weg.txt fehlt im Ordner, liegt im Archiv; da-404.txt steht in der Liste, der
     Helfer antwortet 404, liegt im Archiv; da-nichts.txt 404 und nicht im Archiv; da-500.txt ein Lesefehler (500), liegt im
     Archiv; weg-nichts.txt weder im Ordner noch im Archiv. */
  {
    const R0 = T0 + 4000 * MIN;
    const W1 = R0, W2 = R0 + 60 * MIN, W3 = R0 + 120 * MIN, W4 = R0 + 180 * MIN, W5 = R0 + 240 * MIN;
    const d = ordnerMit("rueck", [
      ["da-404.txt", kampf("Chernobog", W2, 30, 3000)],
      ["da-nichts.txt", kampf("Talus", W3, 30, 3000)],
      ["da-500.txt", kampf("Malakar", W4, 30, 3000)],
    ]);
    const f = (name, at) => ({ name, dps: 5000, dmg: 150000, dur: 30, at });
    const logIndex = { "weg.txt": { size: 1, fights: [f("Morokai", W1)] }, "da-404.txt": { size: 1, fights: [f("Chernobog", W2)] },
      "da-nichts.txt": { size: 1, fights: [f("Talus", W3)] }, "da-500.txt": { size: 1, fights: [f("Malakar", W4)] },
      "weg-nichts.txt": { size: 1, fights: [f("Cornelius", W5)] } };
    const verz = [eintrag("feld:morokai", "Morokai", "weg.txt", W1, 5000, 30), eintrag("feld:chernobog", "Chernobog", "da-404.txt", W2, 5000, 30),
      eintrag("feld:malakar", "Malakar", "da-500.txt", W4, 5000, 30)];
    const stueck = (boss, at) => ["CombatLogVersion,4", ...kampf(boss, at, 30, 3000)].join("\n");
    const texte = { ["weg.txt|" + W1]: stueck("Morokai", W1), ["da-404.txt|" + W2]: stueck("Chernobog", W2), ["da-500.txt|" + W4]: stueck("Malakar", W4) };
    const s = await oeffne({ rekorde: d, config: { logIndex }, verzeichnis: verz, texte, logStoer: { "da-404.txt": 404, "da-nichts.txt": 404, "da-500.txt": 500 } });
    const rekordeAuf = async () => {
      await s.page.click('#bereiche [data-tab="rekorde"]');
      await s.page.waitForFunction(() => document.querySelectorAll("#rkInhalt .rkmed").length > 0);
    };
    const knopf = (datei) => s.page.evaluate((x) => !!document.querySelector('#rkInhalt .rkknopf[data-datei="' + x + '"]'), datei);
    const klick = (datei) => s.page.evaluate((x) => {
      document.querySelectorAll("#toast").forEach((e) => e.classList.remove("on"));
      document.querySelector('#rkInhalt .rkknopf[data-datei="' + x + '"]')?.click();
    }, datei);
    const toastText = () => s.page.evaluate(() => [...document.querySelectorAll("#toast.on")].map((e) => e.textContent).join(" "));
    const kopf = () => s.page.evaluate(() => ({ app: !document.querySelector("#app").hidden, name: document.querySelector("#hName")?.textContent || "",
      meta: document.querySelector("#hMeta")?.textContent || "", fokus: document.activeElement?.id || "" }));
    await rekordeAuf();
    assert(await bis(() => knopf("weg.txt")), "Rückfall: das Medaillon des Kampfs aus weg.txt ist ein Knopf");
    await klick("weg.txt");
    assert(await bis(() => s.kampf.includes("?k=" + encodeURIComponent("weg.txt|" + W1))), "Rückfall: die Datei fehlt im Ordner, der Kampf kommt aus dem Archiv (GET /api/archiv/kampf)", s.kampf);
    assert(await bis(async () => { const k = await kopf(); return k.app && /Morokai/.test(k.name) && /aus dem Archiv/.test(k.meta); }), "Rückfall: der Kampf steht im Meter, der Kopf sagt „aus dem Archiv“", await kopf());
    assert(!/liegt nicht mehr/.test(await toastText()), "Rückfall: kein Satz „liegt nicht mehr im Log-Ordner“", await toastText());
    assert((await kopf()).fokus === "kwKnopf", "Rückfall: der Fokus steht auf der Kampfwahl", await kopf());
    // die Liste des Ordners ist jetzt bekannt: weg.txt bleibt ein Knopf (Archiv), weg-nichts.txt (weder noch) keiner, wie bisher
    await rekordeAuf();
    assert(await bis(async () => (await knopf("weg.txt")) && !(await knopf("weg-nichts.txt"))), "Rückfall: mit bekannter Liste bleibt der Kampf im Archiv ein Knopf, einer ohne Datei und ohne Archiv nicht",
      { weg: await knopf("weg.txt"), nichts: await knopf("weg-nichts.txt") });
    // in der Liste, aber der Helfer antwortet 404: aus dem Archiv
    await klick("da-404.txt");
    assert(await bis(() => s.kampf.includes("?k=" + encodeURIComponent("da-404.txt|" + W2))), "Rückfall (404 von /api/log): der Kampf kommt aus dem Archiv", s.kampf);
    assert(await bis(async () => { const k = await kopf(); return k.app && /Chernobog/.test(k.name) && /aus dem Archiv/.test(k.meta); }), "Rückfall (404): Chernobog aus dem Archiv im Meter", await kopf());
    // 404 und nicht im Archiv: der bisherige Satz
    const vorKampf = s.kampf.length;
    await rekordeAuf();
    await klick("da-nichts.txt");
    assert(await bis(async () => /ließen sich nicht lesen/.test(await toastText())), "404 und nicht im Archiv: der bisherige Satz bleibt", await toastText());
    assert(s.kampf.length === vorKampf, "404 und nicht im Archiv: keine Anfrage nach einem Kampf", s.kampf);
    // ein Lesefehler (500) faellt nicht still auf das Archiv zurueck, auch wenn der Kampf dort liegt
    await rekordeAuf();
    await klick("da-500.txt");
    assert(await bis(async () => /ließen sich nicht lesen/.test(await toastText())), "Lesefehler (500): der bisherige Satz", await toastText());
    assert(s.kampf.length === vorKampf && gelesenVon(s).includes("da-500.txt"), "Lesefehler (500): kein Rückfall auf das Archiv", { kampf: s.kampf, gelesen: gelesenVon(s) });
    /* Zwei Klicks: der erste (da-404, Chernobog) wartet auf das Archiv, der zweite (weg.txt, Morokai) kommt an;
       kommt die Antwort des ersten danach, oeffnet sie nichts mehr (der neueste Klick gewinnt) */
    const fertig = () => s.page.evaluate(() => Number(document.body.dataset.archivKampf || 0));
    let auf; s.kampfTor = { k: "da-404.txt|" + W2, warte: new Promise((r) => { auf = r; }) };
    const k404 = "?k=" + encodeURIComponent("da-404.txt|" + W2), vor404 = s.kampf.filter((x) => x === k404).length;
    await rekordeAuf();
    await klick("da-404.txt");
    assert(await bis(() => s.kampf.filter((x) => x === k404).length > vor404), "zwei Klicks: der erste fragt das Archiv");
    const f0 = await fertig();
    await rekordeAuf();
    await klick("weg.txt");
    assert(await bis(async () => { const k = await kopf(); return k.app && /Morokai/.test(k.name) && /aus dem Archiv/.test(k.meta); }), "zwei Klicks: der zweite steht im Meter", await kopf());
    auf();
    assert(await bis(async () => (await fertig()) >= f0 + 2), "zwei Klicks: beide Antworten sind entschieden", { f0, jetzt: await fertig() });
    const k2 = await kopf();
    assert(/Morokai/.test(k2.name) && !/ließen sich nicht lesen|liegt nicht mehr/.test(await toastText()), "zwei Klicks: die späte Antwort des ersten öffnet nichts und sagt nichts", { k2, toast: await toastText() });
    s.kampfTor = null;
    assert(!s.fehler.length, "Rückfall: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  const ALT = ordnerMit("alt", [
    ["alt-1.txt", [...kampf(TRASH, A0, 20), ...kampf("Morokai", A0 + 5 * MIN, 40, 2000)]],
    ["alt-2.txt", kampf("Chernobog", A0 + 60 * MIN, 30, 3000)],
    ["alt-3.txt", kampf("Practice Dummy", A0 + 120 * MIN, 62, 1500)],
  ]);
  {
    const s = await oeffne({ rekorde: ALT, weeklies: WK, logStoer: { "alt-1.txt": "halt" } });
    await s.page.click('#bereiche [data-tab="weeklies"]');
    await s.page.waitForFunction(() => document.querySelector("#wkBody")?.dataset.lage === "da");
    // alt-2 hat die App schon gesehen (geoeffnet): die Aufnahme hat ihn, unter demselben Schluessel wie beim Einlesen
    await lade(s, join(ALT, "alt-2.txt"));
    assert(await nachPost(s, 1), "Einlesen: alt-2 kam über das Öffnen ins Archiv", s.posts.map(ohneText));
    const vorPosts = s.posts.length, vorFragen = s.logsFragen.length;
    await einst(s);
    const z = await s.page.evaluate(() => { const b = document.querySelector("#eAlteLogs"); return { text: b?.textContent.trim(), an: !!b && !b.disabled && b.getClientRects().length > 0,
      satz: document.querySelector("#eAlteLogsSatz")?.textContent.trim(), besch: b?.getAttribute("aria-describedby") || "",
      ab: document.querySelector("#eAlteLogsAb")?.getClientRects().length ?? -1, name: document.querySelector("#eAlteLogsName")?.textContent.trim() }; });
    assert(z.text === "Alte Logs einlesen" && z.an && /Logs im Ordner des Spiels/.test(z.satz || "") && /Nichts wird verändert oder gelöscht\./.test(z.satz || "")
      && z.besch.split(" ").includes("eAlteLogsSatz") && z.ab === 0 && !!z.name,
      "Einlesen: Knopf „Alte Logs einlesen“ im Abschnitt Archiv, der Satz sagt, was er tut; „Abbrechen“ erst beim Lesen", z);
    assert(s.logsFragen.length === vorFragen && !s.logsFragen.some((q) => q.includes("alle")), "Einlesen: nichts von allein, vor dem Klick keine Frage nach dem ganzen Ordner", s.logsFragen);
    tor(s);
    await s.page.focus("#eAlteLogs");
    await s.page.keyboard.press("Enter");
    assert(await bis(async () => /\b2 von 3\b/.test(await alteStand(s))), "Einlesen: Fortschritt „2 von 3“, während die dritte Datei kommt", await alteStand(s));
    const lauf = await s.page.evaluate(() => ({ ab: (document.querySelector("#eAlteLogsAb")?.getClientRects().length ?? 0) > 0, rolle: document.querySelector("#eAlteLogsStand")?.getAttribute("role"),
      belegt: document.querySelector("#eAlteLogs")?.getAttribute("aria-disabled"), abText: document.querySelector("#eAlteLogsAb")?.textContent.trim() }));
    assert(lauf.ab && lauf.abText === "Abbrechen" && lauf.rolle === "status" && lauf.belegt === "true", "Einlesen: beim Lesen „Abbrechen“, der Stand als status, der Knopf belegt", lauf);
    s.tor.auf();
    assert(await bis(async () => /2 neue Kämpfe aufgenommen, 1 schon im Archiv\./.test(await alteStand(s))), "Einlesen: „2 neue Kämpfe aufgenommen, 1 schon im Archiv.“", await alteStand(s));
    const neu = s.posts.slice(vorPosts);
    assert(neu.map((p) => p.eintrag?.boss).join() === "Practice Dummy,Morokai", "Einlesen: nur Bosskämpfe, die neueste Datei zuerst; kein Trash, der bekannte nicht noch einmal", neu.map(ohneText));
    assert(neu.length === 2 && neu.every((p) => !schemaFehler(p).length && p.eintrag.ch === CH && !JSON.stringify(p.eintrag).includes(SPIELER)),
      "Einlesen: jeder Eintrag nach dem Schema, der Charakter als Kennung, nie als Name", neu.map((p) => [schemaFehler(p), ohneText(p)]));
    assert(neu[0]?.eintrag.platz === "puppe:60" && neu[0]?.eintrag.datei === "alt-3.txt" && neu[1]?.eintrag.platz === "feld:morokai" && neu[1]?.eintrag.k === "alt-1.txt|" + (A0 + 5 * MIN),
      "Einlesen: Platz, Datei und Schlüssel wie bei der Aufnahme", neu.map(ohneText));
    assert(!!neu[1] && !neu[1].text.includes(TRASH) && neu[1].text.startsWith("CombatLogVersion,4\n"), "Einlesen: der Text ist der Kopf und nur das Stück des Kampfs");
    assert(s.antworten.slice(vorPosts).every((a) => a === 200), "Einlesen: der echte Speicher nimmt beide an", s.antworten);
    assert(!indexNamen(s).some((n) => n === "alt-1.txt" || n === "alt-3.txt"), "Einlesen: kein Eintrag im Verlauf (der Verlauf bleibt, was die App gesehen hat)", indexNamen(s));
    assert(s.logsFragen.filter((q) => q === "?alle=1").length === 1 && s.logArt.every((a) => a.startsWith("GET ")), "Einlesen: einmal GET /api/logs?alle=1, am Log-Ordner nur GET", { f: s.logsFragen, a: s.logArt });
    assert(gelesenVon(s).join() === "alt-3.txt,alt-2.txt,alt-1.txt", "Einlesen: eine Datei nach der anderen", gelesenVon(s));
    assert(await s.page.evaluate(() => document.activeElement?.id === "eAlteLogs" && document.querySelector("#eAlteLogsAb")?.getClientRects().length === 0
      && document.querySelector("#eAlteLogs")?.getAttribute("aria-disabled") !== "true"), "Einlesen: danach steht der Fokus auf dem Knopf, „Abbrechen“ ist weg");
    // noch einmal: alles ist schon da, nichts wird gesendet
    s.tor = null;
    await s.page.click("#eAlteLogs");
    assert(await bis(async () => /0 neue Kämpfe aufgenommen, 3 schon im Archiv\./.test(await alteStand(s))), "noch einmal: „0 neue Kämpfe aufgenommen, 3 schon im Archiv.“", await alteStand(s));
    assert(s.posts.length === vorPosts + 2, "noch einmal: kein POST", s.posts.map(ohneText));
    assert(!s.fehler.length, "Einlesen: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  /* Abbrechen haelt an: die zweite Datei wartet, waehrenddessen "Abbrechen"; die dritte wird nie gelesen */
  {
    const d = ordnerMit("alt-ab", [
      ["ab-1.txt", kampf("Morokai", A0 + 300 * MIN, 30, 2000)],
      ["ab-2.txt", kampf("Chernobog", A0 + 360 * MIN, 30, 3000)],
      ["ab-3.txt", kampf("Morokai", A0 + 420 * MIN, 30, 2100)],
    ]);
    const s = await oeffne({ rekorde: d, logStoer: { "ab-2.txt": "halt" } });
    await einst(s);
    tor(s);
    await s.page.click("#eAlteLogs");
    assert(await bis(async () => /\b1 von 3\b/.test(await alteStand(s))), "Abbrechen: der Fortschritt steht bei „1 von 3“", await alteStand(s));
    await s.page.focus("#eAlteLogsAb");
    await s.page.keyboard.press("Enter");
    s.tor.auf();
    assert(await bis(async () => /Abgebrochen/.test(await alteStand(s))), "Abbrechen: der Stand sagt es", await alteStand(s));
    assert(/1 neuer Kampf aufgenommen, 0 schon im Archiv\./.test(await alteStand(s)), "Abbrechen: was bis dahin kam, steht im Ergebnis", await alteStand(s));
    assert(!gelesenVon(s).includes("ab-1.txt") && s.posts.length === 1 && s.posts[0].eintrag.datei === "ab-3.txt",
      "Abbrechen hält an: die älteste Datei wird nicht mehr gelesen, nur der Kampf der ersten gesendet", { gelesen: gelesenVon(s), posts: s.posts.map(ohneText) });
    assert(await s.page.evaluate(() => document.activeElement?.id === "eAlteLogs" && document.querySelector("#eAlteLogsAb")?.getClientRects().length === 0),
      "Abbrechen: der Fokus geht auf „Alte Logs einlesen“, „Abbrechen“ ist weg");
    assert(!s.fehler.length, "Abbrechen: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  /* Eine Datei laesst sich nicht lesen (500): sie zaehlt, die anderen gehen weiter; englisch */
  {
    const d = ordnerMit("alt-fehl", [
      ["fehl-1.txt", kampf("Morokai", A0 + 500 * MIN, 30, 2000)],
      ["fehl-2.txt", kampf("Chernobog", A0 + 560 * MIN, 30, 3000)],
    ]);
    const s = await oeffne({ rekorde: d, lang: "en", logStoer: { "fehl-1.txt": 500 } });
    await einst(s);
    const k = await s.page.evaluate(() => ({ text: document.querySelector("#eAlteLogs")?.textContent.trim(), satz: document.querySelector("#eAlteLogsSatz")?.textContent.trim() }));
    assert(k.text === "Read old logs" && /Nothing is changed or deleted\./.test(k.satz || ""), "englisch: Knopf und Satz", k);
    await s.page.click("#eAlteLogs");
    assert(await bis(async () => /added/.test(await alteStand(s))), "unlesbar: das Ergebnis steht", await alteStand(s));
    const st = await alteStand(s);
    assert(/1 new fight added, 0 already in the archive\./.test(st) && /1 log could not be read\./.test(st), "unlesbar: gezählt, die anderen gehen weiter (englisch)", st);
    assert(s.posts.length === 1 && s.posts[0].eintrag.datei === "fehl-2.txt", "unlesbar: der Kampf der lesbaren Datei wird gesendet", s.posts.map(ohneText));
    assert(!s.fehler.length, "unlesbar: keine Seitenfehler", s.fehler);
    await s.page.close();
  }
  /* Archiv aus oder Hinweis nicht quittiert: der Knopf ist aus, ein ehrlicher Satz sagt warum, nichts wird gelesen oder gesendet */
  for (const [config, grund, was] of [[{ archivAn: false }, /ausgeschaltet/, "Archiv aus"], [{ archivHinweis: 0 }, /Verstanden/, "Hinweis offen"]]) {
    const s = await oeffne({ rekorde: ALT, config });
    await einst(s);
    const z = await s.page.evaluate(() => { const b = document.querySelector("#eAlteLogs"), g = document.querySelector("#eAlteLogsGrund");
      return { aus: !!b?.disabled, grund: g && g.getClientRects().length ? g.textContent.trim() : "", besch: b?.getAttribute("aria-describedby") || "" }; });
    assert(z.aus && grund.test(z.grund) && z.besch.split(" ").includes("eAlteLogsGrund"), `${was}: der Knopf ist aus, der Satz sagt warum`, z);
    await s.page.evaluate(() => document.querySelector("#eAlteLogs")?.click());
    // Wache: ein geladener Bosskampf, ueber den die Seite entscheidet (aus bzw. vor "Verstanden": kein POST)
    const v = await lade(s, L_NEU1);
    assert(await nachGeprueft(s, v + 1), `${was}: die Wache ist entschieden`);
    assert(!s.logsFragen.some((q) => q.includes("alle")) && !s.posts.length && !gelesenVon(s).length, `${was}: nichts gelesen, nichts gesendet`, { f: s.logsFragen, p: s.posts.length });
    assert(!s.fehler.length, `${was}: keine Seitenfehler`, s.fehler);
    await s.page.close();
  }

  /* Das Einlesen haelt an, weil das Archiv nicht antwortet (500, keine Antwort) oder aus ist (409): ein ehrlicher Satz,
     nicht der Erfolgssatz. Ein POST ohne Antwort zaehlt als nicht gesendet. */
  for (const [was, stoer, dateien, erwartet] of [
    ["Verzeichnis 500", { liste: 500 }, 3, /^Das Archiv antwortet nicht\. Abgebrochen nach 0 von 3 Logs\.$/],
    ["Verzeichnis ohne Antwort", { liste: 0 }, 3, /^Das Archiv antwortet nicht\. Abgebrochen nach 0 von 3 Logs\.$/],
    ["POST 409", { post: 409 }, 1, /^Das Archiv nimmt gerade nichts auf, es ist ausgeschaltet\. Abgebrochen nach 0 von 1 Logs\.$/],
    ["POST 503", { post: 503 }, 1, /^Das Archiv kann gerade nicht schreiben\. Abgebrochen nach 0 von 1 Logs\.$/],
  ]) {
    const d = dateien === 3 ? ALT : ordnerMit("halt-" + was.replace(/\W+/g, "-"), [["halt-" + was.replace(/\W+/g, "-") + ".txt", kampf("Morokai", A0 + 900 * MIN, 30, 2000)]]);
    const s = await oeffne({ rekorde: d });
    await einst(s);
    s.stoer = stoer;
    await s.page.click("#eAlteLogs");
    assert(await bis(async () => /Abgebrochen|aufgenommen/.test(await alteStand(s))), `${was}: das Einlesen endet`, await alteStand(s));
    const st = await alteStand(s);
    assert(erwartet.test(st) && !/neue Kämpfe aufgenommen/.test(st), `${was}: der Satz sagt, dass abgebrochen wurde und warum, nicht „0 neue Kämpfe aufgenommen“`, st);
    assert(!s.fehler.length, `${was}: keine Seitenfehler`, s.fehler);
    await s.page.close();
  }
  {
    const d = ordnerMit("post-null", [["pn-1.txt", kampf("Morokai", A0 + 950 * MIN, 30, 2000)], ["pn-2.txt", kampf("Chernobog", A0 + 990 * MIN, 30, 3000)]]);
    const s = await oeffne({ rekorde: d });
    await einst(s);
    s.stoer = { post: 0 };
    await s.page.click("#eAlteLogs");
    assert(await bis(async () => /aufgenommen/.test(await alteStand(s))), "POST ohne Antwort: das Ergebnis steht", await alteStand(s));
    const st = await alteStand(s);
    assert(/^0 neue Kämpfe aufgenommen, 0 schon im Archiv\. 2 Kämpfe ließen sich nicht senden\.$/.test(st) && s.antworten.filter((a) => a === 0).length === 2,
      "POST ohne Antwort: beide Kämpfe zählen als nicht gesendet, das Lesen geht weiter", { st, a: s.antworten });
    assert(!s.fehler.length, "POST ohne Antwort: keine Seitenfehler", s.fehler);
    await s.page.close();
  }

  /* ==================== Loesen und Loeschen durch den echten Speicher (#264 Teil 4) ====================
     Der Satz, den der Dialog zum Abtippen zeigt, ist genau der, den der Hauptprozess prueft (bestaetigt in archiv.ts):
     ein Kampf um 23:30 auf der Uhr des Logs ist in Berlin schon der naechste Tag. Ganz am Ende, weil es das Archiv aendert. */
  {
    const E1 = Date.UTC(2026, 9, 10, 23, 30), E2 = Date.UTC(2026, 9, 12, 12, 0);
    const neu = (datei, at, dps) => {
      const text = ["CombatLogVersion,4", ...kampf("Aridus", at, 30, dps)].join("\n");
      return { eintrag: { k: datei + "|" + at, platz: "feld:aridus", boss: "Aridus", at, dps, dmg: dps * 30, dur: 30, datei, zeilen: text.split("\n").length }, text };
    };
    const n1 = neu("echt-loeschen-1.txt", E1, 7000), n2 = neu("echt-loeschen-2.txt", E2, 8000);
    assert(ar.archiviere(n1) === "saved" && ar.archiviere(n2) === "saved", "echter Speicher: zwei Kämpfe liegen im Archiv");
    const s = await oeffne();
    await bossseite(s, "feld:aridus", 2);
    await s.page.hover('#arKaempfe [role=option][data-k="' + n1.eintrag.k + '"]');
    await s.page.click('#arKaempfe [role=option][data-k="' + n1.eintrag.k + '"] .arloes');
    assert(await bis(() => s.loesen.length === 1 && (ar.loadArchiv()?.kaempfe.find((x) => x.k === n1.eintrag.k)?.geloest === true)), "echter Speicher: gelöst", s.loesen);
    await s.page.click("#arGChip");
    await s.page.waitForFunction(() => document.querySelectorAll("#arGeloeste .argcb").length === 1);
    await s.page.check("#arGeloeste .argcb");
    await s.page.click("#arGLoeschen");
    await bis(() => dlgOffen(s));
    const soll = await s.page.evaluate(() => document.querySelector("#arDlgSoll").textContent.trim());
    const zeigt = await s.page.evaluate(() => document.querySelector("#arGeloeste .argzeile .ard")?.textContent.trim() || "");
    assert(soll === "Aridus 10.10.2026" && zeigt.startsWith("10.10.2026 "), "echter Speicher: zum Abtippen „Aridus 10.10.2026“, das Datum, das die Liste zeigt (auch um 23:30 Logzeit)", { soll, zeigt });
    await s.page.fill("#arDlgFeld", soll);
    await s.page.click("#arDlgJa");
    assert(await bis(() => s.page.evaluate(() => !document.querySelector("#arDlgErg").hidden && document.querySelector("#arDlgT").textContent.trim() === "1 Kampf gelöscht")),
      "echter Speicher: der Hauptprozess nimmt die Bestätigung an", await s.page.evaluate(() => document.querySelector("#arDlg").textContent.replace(/\s+/g, " ")));
    const nachher = ar.loadArchiv()?.kaempfe || [];
    assert(!nachher.some((x) => x.k === n1.eintrag.k) && nachher.some((x) => x.k === n2.eintrag.k), "echter Speicher: nur der gelöste Kampf ist weg", nachher.map((x) => x.k));
    const satz = await s.page.evaluate(() => document.querySelector("#arDlgS").textContent);
    assert(/archiv-vor-loeschen-\d{4}-\d{2}-\d{2}/.test(satz), "echter Speicher: der Name des Sicherungsordners steht im Ergebnis", satz);
    assert(!s.fehler.length && !s.fremd.length, "echter Speicher: keine Seitenfehler, keine fremde Anfrage", { f: s.fehler, r: s.fremd });
    await s.page.close();
  }

} finally {
  await browser.close();
  rmSync(ordner, { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
}

console.log();
if (failed) { console.log(`ARCHIV PAGE FAILED - ${failed}`); process.exit(1); }
console.log("ARCHIV PAGE PASSED");
