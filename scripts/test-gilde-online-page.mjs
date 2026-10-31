// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Gilde online an der gebauten Seite (Issue #229, Spezifikation
// docs/superpowers/specs/2026-10-12-gilde-online-design.md; Aufbau A mit dem Assistenten aus C, am 12.10.2026 gewaehlt):
// der Chip in der Kopfzeile ("Lokal" ab Werk), der Assistent beim Erststart (vier Schritte, nur https, Hinweis mit Haken), Gruenden und
// Beitreten, die Schublade des Leads (Zugang, Bearbeiter-Links, fruehere Staende, Sicherung), der Lesen-Zustand (Mitglied, Server nicht
// erreichbar, Link zurueckgezogen), das Speichern ueber den Server mit "veraltet", der ersetzte Datenschutz-Satz, Tastatur, die Groessen
// 2000 x 1480 und 560 in vier Themen, das Woerterbuch und dass die Seite nur mit 127.0.0.1/api/ spricht.
//
// Kein Server und kein Netz: die Seite kommt vom gestellten Helfer (page.route); /api/gilde beantwortet der echte Speicher
// src/main/gilde.ts, /api/gilde-online/* eine Attrappe des Hauptprozesses (die Wege dort pruefen test-gilde-online-store.mjs und
// test-gildeserver-core.mjs). Alle Namen sind erfunden.
//
// Run:  npm run test:gilde-online-page     (baut die Seite zuerst)
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import * as esbuild from "esbuild";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "boro-gilde-online-page-"));
process.env.APPDATA = work;
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 900))); }
}
const electron = { name: "electron", setup(b) {
  b.onResolve({ filter: /^electron$/ }, () => ({ path: "electron", namespace: "gestellt" }));
  b.onLoad({ filter: /.*/, namespace: "gestellt" }, () => ({ loader: "js",
    contents: "export const app = { isPackaged: false, getAppPath: () => process.env.APPDATA, getPath: () => process.env.APPDATA };" }));
} };
const bundle = async (contents) => {
  const b = await esbuild.build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, format: "esm", platform: "node",
    write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root)), electron], define: { __BORO_VERSION__: '"test"' } });
  return import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));
};
const speicher = await bundle('export * from "./src/main/gilde";');
const { I18N } = await bundle('export { I18N } from "./src/renderer/app/07-dictionary";');
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const GILDE = join(work, "Borometer", "boro-gilde.json");
const dateiSetzen = (gilde) => writeFileSync(GILDE, JSON.stringify({ v: 1, gilde }), "utf8");
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

const CODE = "K7HQ3MXP9WDF", KEY = "NPQRSTUVWXYZ23456789ABCDEF", ADRESSE = "https://gilde.example.org";
const meine = () => ({ id: "gtest00001", name: "Testgilde", mitglieder: [
  { id: "mtest00001", name: "Testperson A", rolle: "tank", waffen: ["Greatsword", "Sword and Shield"], notiz: "" },
  { id: "mtest00002", name: "Testperson B", rolle: "", waffen: [], notiz: "" }],
  reihen: [{ id: "rtest00001", titel: "Raid", start: "2026-10-04T20:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 120, erinnerungMin: 15, ausnahmen: {} }],
  anwesend: { "rtest00001|2026-10-04": { mtest00001: "da", mtest00002: "fehlt" } } });
const serverStand = () => ({ v: 1, gilde: { ...meine(), name: "Gilde auf dem Server" } });
const STAND_ZEIT = Date.parse("2026-10-12T14:02:00");
const LINKS = [{ id: "labc12345", label: "Testperson A", zeit: 1760000000, widerrufen: false }, { id: "ldef67890", label: "Testperson B", zeit: 1760100000, widerrufen: true }];
const STAENDE = [{ v: 3, zeit: 1760200000, von: "lead", marke: "" }, { v: 2, zeit: 1760100000, von: "labc12345", marke: "vor dem Umbau" }, { v: 1, zeit: 1760000000, von: "lead", marke: "" }];
const leerStatus = (extra = {}) => ({ an: false, adresse: "", adresseOk: false, verbunden: false, offline: false, beendete: [], ...extra });

/* Die Attrappe des Hauptprozesses. ol ist der Stand, den status() zeigt; optionen steuern die Antworten. */
async function oeffne({ lang = "de", breite = 1280, hoehe = 860, thema = null, status = leerStatus(), optionen = {} } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const s = { page, fehler: [], anfragen: [], online: [], configs: [], ol: { ...status }, optionen: { ...optionen } };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  page.on("request", (r) => { if (!r.url().startsWith("data:")) s.anfragen.push(r.method() + " " + r.url()); });
  await page.addInitScript((l) => {
    try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ }
    window.__kopie = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: (x) => { window.__kopie.push(x); return Promise.resolve(); } }, configurable: true });
  }, lang);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/gilde") {
      if (req.method() === "GET") { const g = speicher.loadGilde(); return g ? json(200, { ok: true, data: g }) : json(503, { ok: false }); }
      const sent = JSON.parse(req.postData() || "{}"); const put = speicher.putGilde(sent.data);
      return json(put === "saved" ? 200 : 400, { ok: put === "saved" });
    }
    if (path === "/api/gilde-loeschen" && req.method() === "POST") {
      const gone = speicher.loescheGeloest(JSON.parse(req.postData() || "{}"));
      return json(gone.ok ? 200 : gone.grund === "unavailable" ? 503 : 400, gone);
    }
    if (path.startsWith("/api/gilde-online/")) {
      const was = path.slice("/api/gilde-online/".length), body = req.method() === "POST" ? JSON.parse(req.postData() || "{}") : {};
      s.online.push({ was, body });
      const ol = s.ol, o = s.optionen;
      const antwort = (extra = {}) => json(200, { ok: true, ...extra, status: ol });
      const nein = (grund) => json(200, { ok: false, grund, status: ol });
      if (was === "status") return json(200, { ok: true, status: ol });
      if (was === "gruenden") {
        if (o.gruenden) return nein(o.gruenden);
        Object.assign(ol, { an: true, adresse: s.configs.at(-1)?.gildeServer ?? ADRESSE, adresseOk: true, verbunden: true, rolle: "lead", code: CODE, v: 1, stand: body.stand, standZeit: STAND_ZEIT, offline: false });
        return antwort({ code: CODE });
      }
      if (was === "beitreten") {
        if (o.beitreten) return nein(o.beitreten);
        Object.assign(ol, { an: true, adresse: s.configs.at(-1)?.gildeServer ?? ADRESSE, adresseOk: true, verbunden: true, rolle: body.key ? "bearbeiter" : "lesen", label: body.key ? "Testperson A" : undefined, code: body.code, v: 3, stand: serverStand(), standZeit: STAND_ZEIT, offline: false });
        return antwort({ rolle: ol.rolle });
      }
      if (was === "abrufen") { if (o.abruf) o.abruf(ol); return antwort(); }
      if (was === "schreiben") {
        if (o.schreiben === "veraltet") { ol.v += 1; ol.stand = { v: 1, gilde: { ...ol.stand.gilde, name: "Von jemand anderem" } }; return json(200, { ok: false, grund: "veraltet", status: ol }); }
        if (o.schreiben === "offline") { ol.offline = true; return json(200, { ok: false, grund: "offline", status: ol }); }
        ol.v += 1; ol.stand = body.stand; return antwort();
      }
      if (was === "links") return antwort({ links: LINKS });
      if (was === "staende") return antwort({ staende: o.staende ?? STAENDE, ...(o.gekuerzt ? { gekuerzt: o.gekuerzt } : {}) });
      if (was === "link") return antwort({ id: "lneu00001", code: CODE, schluessel: KEY });
      if (was === "link-widerruf") { LINKS[0].widerrufen = true; return antwort(); }
      if (was === "stand-nr") return antwort({ v: body.n, stand: serverStand() });
      if (was === "zurueck") { ol.v += 1; return antwort({ v: ol.v }); }
      if (was === "marke") return antwort();
      if (was === "sicherung") return antwort({ pfad: "C:\\Test\\sicherungen\\gilde-2026-10-12-v3.json", v: ol.v });
      if (was === "schliessen") { if (o.schliessen) return nein(o.schliessen); ol.verbunden = false; return antwort(); }
      if (was === "oeffnen") {
        if (o.oeffnen) return nein(o.oeffnen);
        Object.assign(ol, { verbunden: true, rolle: "lead", code: body.code, v: 3, stand: serverStand(), standZeit: STAND_ZEIT, offline: false, beendete: [], beendet: undefined });
        return antwort();
      }
      if (was === "loeschen") { if (o.loeschen) return nein(o.loeschen); ol.beendete = (ol.beendete || []).filter((x) => x.code !== body.code); return antwort({ pfad: "C:\Test\sicherungen\gilde-2026-10-12-v3.json" }); }
      if (was === "verlassen") { ol.verbunden = false; ol.an = false; return antwort(); }
      return json(404, { ok: false });
    }
    if (path === "/api/state") return json(200, { dir: "", file: "", size: 0, mtime: 0 });
    if (path === "/api/config" && req.method() === "POST") { s.configs.push(JSON.parse(req.postData() || "{}")); return json(200, { ok: true }); }
    if (path === "/api/config") return json(200, { logIndex: {}, ...(thema ? { theme: thema } : {}) });
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json(200, { ok: true, registered: true, counts: {} }); }
    if (path === "/api/weeklies" && req.method() === "GET") return json(200, { ok: true, data: { v: 1, profile: [] } });
    if (path === "/api/logs" && req.method() === "GET") return json(200, { ok: true, files: [] });
    if (path.startsWith("/api/")) return json(200, { ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html");
  await page.waitForFunction(() => !!document.body.dataset.bereit);
  if (thema) await page.evaluate((k) => document.querySelector(`#themeRow button[data-theme="${k}"]`)?.click(), thema);
  return s;
}
const gildeAuf = async (p) => { await p.click('#bereiche [data-tab="gilde"]'); await p.waitForFunction(() => !document.querySelector("#gilde").hidden); };
const txt = (x) => (x || "").replace(/[ \t\n\r\u00a0]+/g, " ").trim();
const huelle = (p) => p.evaluate(() => (document.querySelector("#gildeOnlineHuelle")?.textContent || "").replace(/[ \t\n\r\u00a0]+/g, " ").trim());
const chip = (p) => p.evaluate(() => (document.querySelector("#gildeOnlineChip")?.textContent || "").replace(/[ \t\n\r\u00a0]+/g, " ").trim());
const zeile = (p) => p.evaluate(() => (document.querySelector("#gildeOnlineZeile")?.textContent || "").replace(/[ \t\n\r\u00a0]+/g, " ").trim());
const warte = (p, fn, arg, ms = 6000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
async function bis(fn, ms = 6000) {
  const ende = performance.now() + ms;
  while (performance.now() < ende) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
  return !!(await fn());
}
const eingabe = async (p, id, wert) => { await p.fill("#" + id, wert); };
/* Lokal oeffnet der Chip die Schublade; von dort geht es mit Einrichten in den Assistenten (#237). */
const chipAssistent = async (p) => { await p.click("#gildeOnlineChip button"); await p.click('[data-ol="einrichten"]'); };
const onlineStatus = (extra = {}) => ({ an: true, adresse: ADRESSE, adresseOk: true, verbunden: true, rolle: "lead", code: CODE, v: 3, stand: serverStand(), standZeit: STAND_ZEIT, offline: false, ...extra });

try {
  dateiSetzen(meine());
  // ------------------------------------------------------------ 1. ab Werk lokal: der Chip, nichts geht hinaus
  {
    const s = await oeffne();
    const p = s.page;
    await gildeAuf(p);
    assert(await warte(p, () => document.querySelector("#gildeOnlineChip button"), null), "1: die Kopfzeile der Gilde hat den Chip");
    assert((await chip(p)) === "Lokal", "1: ab Werk steht im Chip \"Lokal\"", await chip(p));
    assert(/nur auf diesem PC/.test(txt(await p.textContent("#gildeDatenschutz"))), "1: der Datenschutz-Satz sagt weiter: nur auf diesem PC");
    assert(s.online.every((x) => x.was === "status"), "1: ab Werk fragt die Seite nur den Status (die Datei), nichts anderes", s.online.map((x) => x.was));
    assert(s.anfragen.every((a) => /^(GET|POST|OPTIONS) http:\/\/boro\.test\//.test(a)), "1: jede Anfrage der Seite geht an den lokalen Server", s.anfragen.filter((a) => !a.includes("//boro.test/")));
    assert(!s.fehler.length, "1: kein Skriptfehler", s.fehler);
    await p.close();
  }
  // ------------------------------------------------------------ 2. der Assistent: Schritte, https, Haken
  {
    const s = await oeffne();
    const p = s.page;
    await gildeAuf(p);
    await chipAssistent(p);
    assert(await warte(p, () => !!document.querySelector(".gl-o-fenster")), "2: der Chip oeffnet beim Erststart das Fenster des Assistenten");
    const t1 = await huelle(p);
    assert(/Wo soll die Gilde liegen\?/.test(t1) && /Auf diesem PC/.test(t1) && /Auf einem Server/.test(t1), "2: Schritt 1 fragt, wo die Gilde liegen soll", t1);
    assert((await p.evaluate(() => document.querySelectorAll(".gl-o-schritte li").length)) === 4, "2: vier Schritte stehen oben");
    await p.click('[data-ol="weiter"]');
    await eingabe(p, "gildeOAdr", "http://gilde.example.org");
    await p.click('[data-ol="pruefen"]');
    assert(/https:\/\/-Adresse/.test(await huelle(p)), "2: Schritt 2 lehnt http:// ab: \"Gilde online braucht eine https://-Adresse.\"");
    await eingabe(p, "gildeOAdr", "gilde.example.org");
    await p.click('[data-ol="pruefen"]');
    assert(/https:\/\/-Adresse/.test(await huelle(p)), "2: auch eine Adresse ohne Schema wird abgelehnt");
    await eingabe(p, "gildeOAdr", "https://u:p@gilde.example.org");
    await p.click('[data-ol="pruefen"]');
    assert(/Nur Rechner und Port/.test(await huelle(p)), "2: Zugangsdaten und Pfade in der Adresse werden abgelehnt");
    await eingabe(p, "gildeOAdr", "https://gilde.example.org/");
    await p.click('[data-ol="pruefen"]');
    assert(/Gilde auf dem Server anlegen/.test(await huelle(p)), "2: eine https-Adresse fuehrt zu Schritt 3");
    await p.click('[data-ol="gruenden"]');
    assert(/Bestätige zuerst den Hinweis/.test(await huelle(p)), "2: ohne das Haekchen beim Hinweis wird nicht gegruendet");
    assert(!s.online.some((x) => x.was === "gruenden") && !s.configs.length, "2: bis dahin ging nichts an den Hauptprozess und nichts in die Einstellungen", { online: s.online.map((x) => x.was), configs: s.configs });
    assert(/Du trägst die Namen deiner Mitglieder auf einem Server ein/.test(await huelle(p)), "2: der Hinweis des Leads steht da");
    await p.close();
  }
  // ------------------------------------------------------------ 3. Gruenden: neue Gilde, dann Schritt 4 und der Chip
  {
    const s = await oeffne();
    const p = s.page;
    await gildeAuf(p);
    await chipAssistent(p);
    await p.click('[data-ol="weiter"]');
    await eingabe(p, "gildeOAdr", ADRESSE);
    await p.click('[data-ol="pruefen"]');
    await eingabe(p, "gildeOName", "Neue Testgilde");
    await p.check("#gildeOHakenLead");
    await p.click('[data-ol="gruenden"]');
    assert(await warte(p, () => /Mitglieder einladen/.test(document.querySelector(".gl-o-fenster")?.textContent || "")), "3: nach dem Gruenden folgt Schritt 4 \"Mitglieder einladen\"");
    const g = s.online.find((x) => x.was === "gruenden");
    assert(g && g.body.stand.v === 1 && g.body.stand.gilde.name === "Neue Testgilde" && /^g[0-9a-z]{9}$/.test(g.body.stand.gilde.id) && g.body.stand.gilde.mitglieder.length === 0,
      "3: gesendet wird eine neue, leere Gilde mit Kennung und Namen", g?.body);
    assert(s.configs.length === 1 && s.configs[0].gildeOnline === true && s.configs[0].gildeServer === ADRESSE, "3: erst jetzt stellt die Seite \"Gilde online\" an und traegt die Adresse ein", s.configs);
    const t4 = await huelle(p);
    assert(t4.includes(ADRESSE) && t4.includes("K7HQ-3MXP-9WDF"), "3: Schritt 4 zeigt Server und Gildencode in Vierergruppen", t4);
    assert(!/Zurück auf lokal|Gilde verlassen/.test(t4), "3: im Assistenten steht kein \"Zurueck auf lokal\" (er laeuft gerade vorwaerts)");
    await p.click('[data-ol="kopieren"][data-was="einladung"]');
    assert((await p.evaluate(() => window.__kopie)).at(-1) === "boro-gilde:" + CODE, "3: \"Einladung zum Lesen kopieren\" legt boro-gilde:CODE ab, ohne Adresse", await p.evaluate(() => window.__kopie));
    await p.click('[data-ol="fertig"]');
    assert((await chip(p)) === "Online · Lead", "3: danach steht im Chip \"Online · Lead\"", await chip(p));
    const dh = txt(await p.textContent("#gildeDatenschutz"));
    assert(dh.includes(ADRESSE) && /kann sie lesen/.test(dh) && !/nur auf diesem PC/.test(dh), "3: der Datenschutz-Satz sagt jetzt, auf welchem Server die Namen liegen", dh);
    assert(await p.evaluate(() => document.querySelector("#gildeName").textContent) === "Neue Testgilde", "3: die Gilde der Seite ist jetzt die vom Server");
    assert(speicher.loadGilde().gilde.name === "Testgilde", "3: die lokale Datei ist unveraendert (nichts hochgeladen, nichts ersetzt)", speicher.loadGilde().gilde.name);
    assert(!s.fehler.length, "3: kein Skriptfehler", s.fehler);
    await p.close();
  }
  // ------------------------------------------------------------ 4. Hochladen der lokalen Gilde
  {
    const s = await oeffne();
    const p = s.page;
    await gildeAuf(p);
    await chipAssistent(p);
    await p.click('[data-ol="weiter"]');
    await eingabe(p, "gildeOAdr", ADRESSE);
    await p.click('[data-ol="pruefen"]');
    assert(/2 Mitglieder, 1 Reihen hochladen/.test(await huelle(p)), "4: Schritt 3 nennt die lokale Gilde mit Mitgliedern und Reihen", await huelle(p));
    await p.check("#gildeOHakenLead");
    await p.click('[data-ol="hochladen"]');
    await warte(p, () => /Mitglieder einladen/.test(document.querySelector(".gl-o-fenster")?.textContent || ""));
    const g = s.online.find((x) => x.was === "gruenden");
    assert(g?.body.stand.gilde.id === "gtest00001" && g.body.stand.gilde.mitglieder.length === 2 && g.body.stand.gilde.reihen.length === 1, "4: hochgeladen wird die ganze lokale Gilde", g?.body.stand.gilde.id);
    assert(speicher.loadGilde().gilde.mitglieder.length === 2, "4: die lokale Datei bleibt, wie sie ist");
    await p.close();
  }
  // ------------------------------------------------------------ 5. ein Fehler beim Gruenden nimmt den Schalter zurueck
  {
    const s = await oeffne({ optionen: { gruenden: "offline" } });
    const p = s.page;
    await gildeAuf(p);
    await chipAssistent(p);
    await p.click('[data-ol="weiter"]');
    await eingabe(p, "gildeOAdr", ADRESSE);
    await p.click('[data-ol="pruefen"]');
    await eingabe(p, "gildeOName", "Neue Testgilde");
    await p.check("#gildeOHakenLead");
    await p.click('[data-ol="gruenden"]');
    await warte(p, () => /nicht erreichbar/.test(document.querySelector(".gl-o-fenster")?.textContent || ""));
    assert(/Der Server ist nicht erreichbar/.test(await huelle(p)), "5: Server nicht erreichbar: ein Satz im Fenster, der Assistent bleibt auf Schritt 3", await huelle(p));
    assert(s.configs.length === 2 && s.configs[0].gildeOnline === true && s.configs[1].gildeOnline === false, "5: der Schalter geht wieder aus, damit nichts halb eingeschaltet bleibt", s.configs);
    await p.close();
  }
  // ------------------------------------------------------------ 6. Beitreten
  {
    const s = await oeffne();
    const p = s.page;
    await gildeAuf(p);
    await chipAssistent(p);
    await p.click('[data-ol="wegB"]');
    await eingabe(p, "gildeOEinl", "boro-gilde:" + CODE + "@evil.example");
    await eingabe(p, "gildeOAdr2", ADRESSE);
    await p.check("#gildeOHakenMit");
    await p.click('[data-ol="beitreten"]');
    assert(/Eine Adresse darf nicht darin stehen/.test(await huelle(p)), "6: ein Link mit Adresse wird abgelehnt");
    await eingabe(p, "gildeOEinl", "boro-gilde:" + CODE);
    await eingabe(p, "gildeOAdr2", "http://gilde.example.org");
    await p.click('[data-ol="beitreten"]');
    assert(/https:\/\/-Adresse/.test(await huelle(p)), "6: eine http-Adresse wird abgelehnt");
    await eingabe(p, "gildeOAdr2", ADRESSE);
    await p.uncheck("#gildeOHakenMit");
    await p.click('[data-ol="beitreten"]');
    assert(/Bestätige zuerst den Hinweis/.test(await huelle(p)), "6: ohne das Haekchen wird nicht beigetreten");
    assert(/Diese Gilde liegt auf dem Server https:\/\/gilde\.example\.org/.test(await huelle(p)), "6: der Satz fuer Mitglieder nennt die eingetragene Adresse", await huelle(p));
    assert(!s.online.some((x) => x.was === "beitreten"), "6: bis dahin ging nichts hinaus");
    await p.check("#gildeOHakenMit");
    await p.click('[data-ol="beitreten"]');
    await warte(p, () => document.querySelector("#gildeOnlineChip")?.textContent.includes("Mitglied"));
    const b = s.online.find((x) => x.was === "beitreten");
    assert(b?.body.code === CODE && b.body.key === undefined, "6: beigetreten wird mit dem Code, ohne Schluessel (nur Lesen)", b?.body);
    assert(s.configs[0]?.gildeServer === ADRESSE, "6: die Adresse kommt aus dem Feld, nicht aus dem Link", s.configs);
    assert((await chip(p)) === "Online · Mitglied", "6: der Chip nennt die Rolle \"Mitglied\"", await chip(p));
    assert(/Nur lesen\. Der Lead bearbeitet die Liste\./.test(await zeile(p)), "6: unter der Kopfzeile steht \"Nur lesen\"", await zeile(p));
    assert(await p.evaluate(() => document.querySelector("#gildeName").textContent) === "Gilde auf dem Server", "6: die Seite zeigt den Stand vom Server");
    await p.close();
  }
  // ------------------------------------------------------------ 7. Mitglied: nur lesen, nichts schreibt
  {
    const s = await oeffne({ status: onlineStatus({ rolle: "lesen", label: undefined }) });
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gilde").classList.contains("gl-nurlesen"));
    assert(await p.evaluate(() => document.querySelector("#gilde").classList.contains("gl-nurlesen")), "7: Mitglied: die Gilde traegt den Lesen-Zustand");
    await p.click('#gildeTabs [data-gtab="mitglieder"]');
    assert((await p.evaluate(() => getComputedStyle(document.querySelector('[data-g="neu"]')).display)) === "none", "7: \"+ Mitglied\" ist ausgeblendet");
    assert(s.online.every((x) => x.was !== "schreiben"), "7: nichts wurde geschrieben");
    await p.click('#gildeTabs [data-gtab="termine"]');
    const vorher = await p.evaluate(() => JSON.stringify([...document.querySelectorAll(".gl-marken [aria-checked=true]")].map((x) => x.dataset.marke)));
    await p.evaluate(() => document.querySelector('.gl-marken [data-marke="da"]')?.click());
    const nachher = await p.evaluate(() => JSON.stringify([...document.querySelectorAll(".gl-marken [aria-checked=true]")].map((x) => x.dataset.marke)));
    await p.waitForTimeout(700);
    assert(vorher === nachher && !s.online.some((x) => x.was === "schreiben"), "7: ein Klick auf eine Marke aendert nichts und schreibt nichts", { vorher, nachher });
    await p.click("#gildeOnlineChip button");
    const t = await huelle(p);
    assert(/Du siehst die Liste, der Lead bearbeitet sie\./.test(t) && /Zugang/.test(t) && !/Frühere Stände|Sicherung/.test(t), "7: die Schublade des Mitglieds zeigt Zugang und Rolle, keine Verwaltung", t);
    assert(!(await p.evaluate(() => !!document.querySelector('[data-ol="kopieren"][data-was="einladung"]'))), "7: Mitglieder bekommen keine Einladung zum Weitergeben");
    await p.click('[data-ol="verlassen"]');
    await warte(p, () => document.querySelector("#gildeOnlineChip")?.textContent.includes("Lokal"));
    assert((await chip(p)) === "Lokal" && s.configs.at(-1)?.gildeOnline === false, "7: Verlassen: der Chip steht wieder auf \"Lokal\", der Schalter ist aus", s.configs);
    assert(await p.evaluate(() => document.querySelector("#gildeName").textContent) === "Testgilde", "7: danach zeigt die Seite wieder die lokale Gilde");
    await p.close();
  }
  // ------------------------------------------------------------ 8. Server nicht erreichbar, Link zurueckgezogen
  {
    const s = await oeffne({ status: onlineStatus({ rolle: "bearbeiter", label: "Testperson A", offline: true }) });
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gilde").classList.contains("gl-nurlesen"));
    const z = await zeile(p);
    assert(/Nur lesen: Der Server ist nicht erreichbar\. Stand vom/.test(z), "8: ein Bearbeiter ohne Server sieht \"Nur lesen: Der Server ist nicht erreichbar. Stand vom ...\"", z);
    assert(/offline/.test(await chip(p)), "8: der Chip sagt \"offline\"", await chip(p));
    await p.close();
    const w = await oeffne({ status: onlineStatus({ rolle: "bearbeiter", label: "Testperson A", widerrufen: true }) });
    await gildeAuf(w.page);
    await warte(w.page, () => document.querySelector("#gilde").classList.contains("gl-nurlesen"));
    assert(/Dein Bearbeitungslink wurde zurückgezogen/.test(await zeile(w.page)), "8: ein zurueckgezogener Link: \"Dein Bearbeitungslink wurde zurueckgezogen\"", await zeile(w.page));
    assert((await chip(w.page)) === "Online · Mitglied", "8: der Chip fuehrt ihn danach als Mitglied", await chip(w.page));
    await w.page.close();
  }
  // ------------------------------------------------------------ 9. Lead: Schublade (Zugang, Links, Staende, Sicherung)
  {
    const s = await oeffne({ status: onlineStatus() });
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gildeOnlineChip")?.textContent.includes("Lead"));
    await p.click("#gildeOnlineChip button");
    assert(await warte(p, () => /Testperson A/.test(document.querySelector(".gl-o-schublade")?.textContent || "")), "9: die Schublade des Leads listet die Bearbeiter-Links");
    const t = await huelle(p);
    for (const w of ["Zugang", "Bearbeiter", "Frühere Stände", "Sicherung", "K7HQ-3MXP-9WDF", "widerrufen"]) assert(t.includes(w), "9: die Schublade nennt \"" + w + "\"");
    assert((await p.evaluate(() => document.querySelectorAll(".gl-o-zeile.aus").length)) === 1, "9: der widerrufene Link steht durchgestrichen da, der Eintrag bleibt");
    // Link erstellen
    await eingabe(p, "gildeOLink", "Testperson C");
    await p.click('[data-ol="linkNeu"]');
    await warte(p, () => document.querySelector(".gl-o-neu"));
    const l = s.online.find((x) => x.was === "link");
    assert(l?.body.label === "Testperson C", "9: der neue Link geht mit seinem Namen an den Hauptprozess", l?.body);
    assert((await p.textContent(".gl-o-einl")) === "boro-gilde:" + CODE + ":" + KEY, "9: die Einladung zeigt Code und Schluessel einmal, ohne Adresse", await p.textContent(".gl-o-einl"));
    await p.click('[data-ol="kopieren"][data-was="link"]');
    assert((await p.evaluate(() => window.__kopie)).at(-1) === "boro-gilde:" + CODE + ":" + KEY, "9: \"Kopieren\" legt die Einladung in die Zwischenablage");
    await p.click('[data-ol="linkFertig"]');
    assert(!(await p.evaluate(() => !!document.querySelector(".gl-o-neu"))), "9: \"Fertig\" nimmt den Schluessel wieder vom Bildschirm");
    // Widerruf mit Rueckfrage
    await p.click('[data-ol="widerruf"][data-id="labc12345"]');
    assert(/Link für Testperson A widerrufen\?/.test(await huelle(p)), "9: Widerrufen fragt zuerst nach");
    assert(!s.online.some((x) => x.was === "link-widerruf"), "9: bis zur Bestaetigung ist nichts widerrufen");
    await p.click('[data-ol="widerrufJa"]');
    await bis(() => s.online.some((x) => x.was === "link-widerruf"));
    assert(s.online.find((x) => x.was === "link-widerruf")?.body.id === "labc12345", "9: bestaetigt, geht der Widerruf an den Hauptprozess");
    // Staende
    await p.click('[data-ol="zurueck"][data-v="2"]');
    assert(/Stand v2 wird als neuer Stand v4 angelegt\. Nichts wird überschrieben\./.test(await huelle(p)), "9: Zurueckholen fragt nach und sagt: neuer Stand, nichts wird ueberschrieben", await huelle(p));
    await p.click('[data-ol="zurueckJa"]');
    await bis(() => s.online.some((x) => x.was === "zurueck"));
    assert(s.online.find((x) => x.was === "zurueck")?.body.n === 2, "9: bestaetigt, geht Stand 2 an den Hauptprozess");
    await p.click('[data-ol="benennen"][data-v="3"]');
    await eingabe(p, "gildeOMarke", "vor dem Raid");
    await p.click('[data-ol="markeSpeichern"]');
    await bis(() => s.online.some((x) => x.was === "marke"));
    assert(JSON.stringify(s.online.find((x) => x.was === "marke")?.body) === JSON.stringify({ n: 3, label: "vor dem Raid" }), "9: Benennen schickt Nummer und Namen");
    await p.click('[data-ol="ansehen"][data-v="1"]');
    await warte(p, () => /So sah|Stand v1 vom/.test(document.querySelector(".gl-o-schublade")?.textContent || ""));
    assert(/Stand v1 vom .*: 2 Mitglieder, 1 Reihen/.test(await huelle(p)), "9: Ansehen nennt Mitglieder und Reihen des alten Standes", await huelle(p));
    // Sicherung
    await p.click('[data-ol="sichern"]');
    await warte(p, () => /sicherungen/.test(document.querySelector(".gl-o-schublade")?.textContent || ""));
    assert(/Sicherung erstellt\./.test(await huelle(p)) && /gilde-2026-10-12-v3\.json/.test(await huelle(p)), "9: Sicherung erstellt: die Seite nennt den Pfad der Datei", await huelle(p));
    // Zurueck auf lokal
    await p.click('[data-ol="lokal"]');
    await warte(p, () => document.querySelector("#gildeOnlineChip")?.textContent.includes("Lokal"));
    assert(s.online.some((x) => x.was === "verlassen") && s.configs.at(-1)?.gildeOnline === false, "9: \"Zurueck auf lokal\" meldet es dem Hauptprozess und schaltet aus");
    // die lokale Datei wird nach dem Zurueckschalten erst gelesen (laden): darauf warten, nicht gleich lesen (#224)
    await warte(p, () => document.querySelector("#gildeName")?.textContent === "Testgilde", null);
    assert(await p.evaluate(() => document.querySelector("#gildeName").textContent) === "Testgilde", "9: danach liegt wieder die lokale Gilde vor");
    assert(!s.fehler.length, "9: kein Skriptfehler", s.fehler);
    await p.close();
  }
  // ------------------------------------------------------------ 10. Bearbeiten ueber den Server: speichern, veraltet, offline
  {
    const s = await oeffne({ status: onlineStatus() });
    const p = s.page;
    await gildeAuf(p);
    await p.click('#gildeTabs [data-gtab="mitglieder"]');
    await p.click('[data-g="neu"]');
    await p.fill("#gildeEName", "Testperson Neu");
    await bis(() => s.online.some((x) => x.was === "schreiben"));
    const w = s.online.find((x) => x.was === "schreiben");
    assert(w && w.body.stand.v === 1 && w.body.stand.gilde.mitglieder.some((m) => m.name === "Testperson Neu"), "10: eine Aenderung geht als ganzer Stand an den Server", { v: w?.body.stand?.v, namen: w?.body.stand?.gilde?.mitglieder?.map((m) => m.name), alle: s.online.map((x) => x.was) });
    assert(!s.anfragen.some((a) => a.startsWith("POST") && a.endsWith("/api/gilde")), "10: die lokale Datei wird dabei nicht beschrieben (kein POST /api/gilde)");
    assert(speicher.loadGilde().gilde.mitglieder.length === 2, "10: die lokale Datei hat weiter zwei Mitglieder", speicher.loadGilde().gilde.mitglieder.length);
    // veraltet: jemand war schneller
    s.optionen.schreiben = "veraltet";
    await p.fill("#gildeEName", "Testperson Zwei");
    await warte(p, () => /Jemand hat zwischenzeitlich geändert/.test(document.querySelector("#gildeOnlineZeile")?.textContent || ""), null, 4000);
    assert(/Jemand hat zwischenzeitlich geändert\. Die Liste ist neu geladen/.test(await zeile(p)), "10: bei \"veraltet\" sagt die Seite es und laedt die Liste neu", await zeile(p));
    assert(await p.evaluate(() => document.querySelector("#gildeName").textContent) === "Von jemand anderem", "10: die Liste zeigt den neuen Stand vom Server");
    // offline
    s.optionen.schreiben = "offline";
    await p.click('#gildeTabs [data-gtab="mitglieder"]');
    await p.click('[data-g="neu"]');
    await p.fill("#gildeEName", "Testperson Drei");
    await warte(p, () => /Nicht gespeichert: Der Server ist nicht erreichbar/.test(document.querySelector("#gildeOnlineZeile")?.textContent || ""), null, 4000);
    assert(/Nicht gespeichert: Der Server ist nicht erreichbar/.test(await zeile(p)), "10: ohne Server sagt die Seite \"Nicht gespeichert: Der Server ist nicht erreichbar\"", await zeile(p));
    assert(/offline/.test(await chip(p)), "10: der Chip sagt danach \"offline\"", await chip(p));
    await p.close();
  }
  // ------------------------------------------------------------ 11. ein Neuzeichnen ruft nicht noch einmal ab
  {
    const s = await oeffne({ status: onlineStatus() });
    const p = s.page;
    await gildeAuf(p);
    await bis(() => s.online.some((x) => x.was === "abrufen"));
    const n0 = s.online.filter((x) => x.was === "abrufen").length;
    await p.evaluate(() => document.querySelector("#btnLang").click());
    await p.evaluate(() => document.querySelector("#btnLang").click());
    await p.waitForTimeout(500);
    const n1 = s.online.filter((x) => x.was === "abrufen").length;
    assert(n0 === 1 && n1 === 1, "11: beim Oeffnen ein Abruf, und ein Neuzeichnen (Sprache) ruft nicht noch einmal ab", { n0, n1 });
    await p.click('#bereiche [data-tab="weeklies"]');
    await p.click('#bereiche [data-tab="gilde"]');
    await bis(() => s.online.filter((x) => x.was === "abrufen").length === 2);
    assert(s.online.filter((x) => x.was === "abrufen").length === 2, "11: wer den Bereich schliesst und wieder oeffnet, ruft einmal neu ab");
    await p.close();
  }
  // ------------------------------------------------------------ 11b. viele Staende: zehn, dann "Aeltere zeigen"
  {
    const viele = Array.from({ length: 25 }, (_, i) => ({ v: 25 - i, zeit: 1760000000 + (25 - i) * 60, von: "lead", marke: i === 24 ? "ganz am Anfang" : "" }));
    const s = await oeffne({ status: onlineStatus(), optionen: { staende: viele } });
    const p = s.page;
    await gildeAuf(p);
    await p.click("#gildeOnlineChip button");
    await warte(p, () => document.querySelectorAll(".gl-o-v").length > 0);
    const zeilen = () => p.evaluate(() => document.querySelectorAll(".gl-o-schublade .gl-o-v").length);
    const knopf = () => p.evaluate(() => document.querySelector('[data-ol="mehr"]')?.textContent.replace(/s+/g, " ").trim() ?? "");
    assert((await zeilen()) === 10 && /Ältere zeigen \(15\)/.test(await knopf()), "11b: bei 25 Staenden zeigt die Schublade die neuesten 10 und \"Aeltere zeigen (15)\"", { n: await zeilen(), knopf: await knopf() });
    assert((await p.evaluate(() => document.querySelector(".gl-o-schublade .gl-o-v").textContent)) === "v25", "11b: der neueste steht oben");
    await p.click('[data-ol="mehr"]');
    assert((await zeilen()) === 20 && /Ältere zeigen \(5\)/.test(await knopf()), "11b: ein Klick zeigt zehn weitere", { n: await zeilen(), knopf: await knopf() });
    await p.click('[data-ol="mehr"]');
    assert((await zeilen()) === 25 && (await knopf()) === "", "11b: dann sind alle da, und der Knopf verschwindet", { n: await zeilen(), knopf: await knopf() });
    assert(await p.evaluate(() => !document.querySelector('[data-ol="gekuerzt"]')), "11b: der Server hat nicht gekuerzt: kein Satz ueber aeltere Staende");
    await p.keyboard.press("Escape");
    await p.click("#gildeOnlineChip button");
    await warte(p, () => document.querySelectorAll(".gl-o-v").length > 0);
    assert((await zeilen()) === 10, "11b: nach dem Schliessen und Oeffnen sind es wieder zehn");
    await p.close();
  }
  // ------------------------------------------------------------ 11c. der Server hat die Liste gekuerzt (#229)
  {
    const wenige = Array.from({ length: 12 }, (_, i) => ({ v: 230 - i, zeit: 1760000000 + (230 - i) * 60, von: "lead", marke: "" }));
    const s = await oeffne({ status: onlineStatus(), optionen: { staende: wenige, gekuerzt: 230 } });
    const p = s.page;
    await gildeAuf(p);
    await p.click("#gildeOnlineChip button");
    await warte(p, () => document.querySelectorAll(".gl-o-v").length > 0);
    const satz = () => p.evaluate(() => document.querySelector('[data-ol="gekuerzt"]')?.textContent.replace(/\s+/g, " ").trim() ?? "");
    assert((await satz()) === "", "11c: solange noch Aeltere zu zeigen sind, steht der Satz noch nicht", await satz());
    await p.click('[data-ol="mehr"]');
    assert(await warte(p, () => !!document.querySelector('[data-ol="gekuerzt"]')), "11c: am Ende der Liste steht der Satz");
    assert((await satz()) === "Ältere Stände liegen auf dem Server, die Liste zeigt die neuesten 200 und alle benannten.", "11c: der Satz sagt, dass die Liste die neuesten 200 und alle benannten zeigt", await satz());
    await p.close();
  }
  // ------------------------------------------------------------ 12. Tastatur
  {
    const s = await oeffne({ status: onlineStatus() });
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gildeOnlineChip button"));
    await p.focus("#gildeOnlineChip button");
    await p.keyboard.press("Enter");
    assert(await warte(p, () => !!document.querySelector(".gl-o-schublade")), "12: Enter am Chip oeffnet die Schublade");
    assert(await p.evaluate(() => document.querySelector(".gl-o-schublade").contains(document.activeElement)), "12: der Fokus liegt in der Schublade");
    await p.keyboard.press("Escape");
    assert(!(await p.evaluate(() => !!document.querySelector(".gl-o-schublade"))), "12: Escape schliesst sie");
    assert(await p.evaluate(() => document.activeElement?.closest("#gildeOnlineChip") !== null), "12: der Fokus kehrt zum Chip zurueck");
    await p.keyboard.press("Enter");
    await warte(p, () => !!document.querySelector(".gl-o-schublade"));
    for (let i = 0; i < 80; i++) await p.keyboard.press("Tab");
    assert(await p.evaluate(() => document.querySelector(".gl-o-schublade").contains(document.activeElement)), "12: Tab bleibt in der Schublade");
    assert((await p.evaluate(() => document.querySelector(".gl-o-schublade").getAttribute("aria-modal"))) === "true", "12: die Schublade ist ein Dialog (aria-modal)");
    await p.close();
  }
  // ------------------------------------------------------------ 13. Groessen und Themen
  for (const [breite, hoehe] of [[2000, 1480], [560, 900]]) {
    for (const thema of ["dark", "light", "tnl", "glas"]) {
      const s = await oeffne({ breite, hoehe, thema, status: onlineStatus() });
      const p = s.page;
      await gildeAuf(p);
      await warte(p, () => document.querySelector("#gildeOnlineChip button"));
      await p.click("#gildeOnlineChip button");
      await warte(p, () => /Testperson A/.test(document.querySelector(".gl-o-schublade")?.textContent || ""));
      const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, r: document.querySelector(".gl-o-schublade").getBoundingClientRect().right,
        chipOk: !!document.querySelector("#gildeOnlineChip button"), font: getComputedStyle(document.querySelector(".gl-o-schublade h2")).fontFamily }));
      assert(m.sw <= m.iw && m.r <= m.iw + 1 && /Palatino|Palat|Book Antiqua|serif|Cinzel|Display/i.test(m.font + "serif"), `13: ${breite} px, ${thema}: die Schublade passt, kein waagerechtes Rollen`, m);
      await p.keyboard.press("Escape");
      // der Assistent als Fenster (lokal) in derselben Groesse
      await p.close();
      const l = await oeffne({ breite, hoehe, thema });
      await gildeAuf(l.page);
      await warte(l.page, () => document.querySelector("#gildeOnlineChip button"));
      await chipAssistent(l.page);
      const f = await l.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, r: document.querySelector(".gl-o-fenster").getBoundingClientRect().right, l: document.querySelector(".gl-o-fenster").getBoundingClientRect().left }));
      assert(f.sw <= f.iw && f.r <= f.iw + 1 && f.l >= -1, `13: ${breite} px, ${thema}: der Assistent passt, kein waagerechtes Rollen`, f);
      await l.page.close();
    }
  }
  // ------------------------------------------------------------ 14. Woerterbuch: beide Sprachen, dieselben Schluessel
  {
    const de = Object.keys(I18N.de).filter((k) => k.startsWith("gilde.on.")), en = Object.keys(I18N.en).filter((k) => k.startsWith("gilde.on."));
    assert(de.length > 100 && JSON.stringify(de.sort()) === JSON.stringify(en.sort()), "14: das Woerterbuch hat dieselben gilde.on.-Schluessel in Deutsch und Englisch", { de: de.length, en: en.length });
    const e = await oeffne({ lang: "en", status: onlineStatus() });
    await gildeAuf(e.page);
    await warte(e.page, () => document.querySelector("#gildeOnlineChip button"));
    assert((await chip(e.page)) === "Online · Lead", "14: Englisch: der Chip sagt \"Online · Lead\"", await chip(e.page));
    await e.page.click("#gildeOnlineChip button");
    assert(/Earlier states/.test(await huelle(e.page)) && /Backup/.test(await huelle(e.page)), "14: Englisch: die Schublade ist uebersetzt", await huelle(e.page));
    await e.page.close();
  }
  // ------------------------------------------------------------ 15. ohne den lokalen Helfer (Seite als Datei) gibt es den Chip nicht
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const fehler = [];
    page.on("pageerror", (e) => fehler.push(String(e)));
    await page.goto("file:///" + join(root, "dist", "renderer", "index.html").replace(/\\/g, "/").replace(/^\/+/, ""));
    await page.waitForFunction(() => !!document.querySelector('#bereiche [data-tab="gilde"]'));
    await page.click('#bereiche [data-tab="gilde"]');
    await page.waitForTimeout(600);
    const da =await page.evaluate(() => ({ chip: !!document.querySelector("#gildeOnlineChip"), huelle: !!document.querySelector("#gildeOnlineHuelle") }));
    assert(!da.chip && !da.huelle && !fehler.length, "15: im Browser ohne App gibt es weder Chip noch Fenster, und keinen Fehler", { da, fehler });
    await page.close();
  }
  // ------------------------------------------------------------ 16. Gilde loesen (lokal, #237): Schublade, Namensfrage, Rueckgaengig, Liste
  {
    const datei = () => speicher.loadGilde();
    const oeffneSchublade = async (p) => { await p.click("#gildeOnlineChip button"); await p.waitForFunction(() => !!document.querySelector(".gl-o-schublade")); };
    dateiSetzen(meine());
    const s = await oeffne();
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gildeOnlineChip button"), null);
    await oeffneSchublade(p);
    const t0 = await huelle(p);
    assert(/Diese Gilde/.test(t0) && /Testgilde/.test(t0) && /Gelöste Gilden/.test(t0) && /Gilde online/.test(t0), "16: lokal oeffnet der Chip die Schublade mit Diese Gilde, Gilde online und Gelöste Gilden", t0);
    assert(/Noch keine gelöste Gilde/.test(t0), "16: die Liste Gelöste Gilden ist leer und sagt es", t0);
    assert(!(await p.$(".gl-o-fenster")), "16: der Assistent ist nicht gleich offen");
    await p.click('[data-ol="loesen"]');
    assert(!!(await p.$("#gildeOLoesenName")) && /Tippe den Namen der Gilde/.test(await huelle(p)), "16: Gilde lösen fragt und verlangt den Namen", await huelle(p));
    const knopf = () => p.evaluate(() => document.querySelector('[data-ol="loesenJa"]')?.disabled);
    assert((await knopf()) === true, "16: der Knopf Gilde lösen ist gesperrt, solange der Name nicht passt");
    await p.fill("#gildeOLoesenName", "Falsch");
    assert((await knopf()) === true, "16: ein falscher Name entsperrt nicht");
    await p.fill("#gildeOLoesenName", "  testGILDE ");
    assert((await knopf()) === false, "16: Gross-/Kleinschreibung und Rand sind egal, dann ist der Knopf frei");
    await p.click('[data-ol="loesenNein"]');
    assert(!(await p.$("#gildeOLoesenName")) && datei().gilde?.name === "Testgilde", "16: Abbrechen schliesst die Frage, nichts ist geloest");
    await p.click('[data-ol="loesen"]');
    await p.fill("#gildeOLoesenName", "Testgilde");
    await p.keyboard.press("Enter");
    assert(await warte(p, () => !!document.querySelector("#gildeNeuName"), null), "16: Enter im Namensfeld loest, die Seite zeigt Gilde anlegen");
    assert(!(await p.$(".gl-o-schublade")), "16: die Schublade geht dabei zu");
    const toast = await p.evaluate(() => (document.querySelector("#gildeFlaeche .gl-meldung")?.textContent || "").replace(/\s+/g, " ").trim());
    assert(/„Testgilde“ gelöst\./.test(toast) && /Rückgängig/.test(toast), "16: der Satz nennt die Gilde und bietet Rückgängig", toast);
    const ansage = await p.evaluate(() => document.getElementById("gildeAnsage")?.textContent || "");
    assert(/gelöst/.test(ansage) && /Rückgängig/.test(ansage) && /Gelöste Gilden/.test(ansage), "16: der Vorleser sagt an, was gelöst wurde und wie man es zurückholt", ansage);
    assert(await bis(() => datei().gilde === null && datei().geloeste?.length === 1 && datei().geloeste[0].gilde.name === "Testgilde" && datei().geloeste[0].gilde.mitglieder.length === 2),
      "16: die Datei haelt die Gilde samt Mitgliedern unter geloeste, gilde ist null", datei());
    assert(await p.evaluate(() => document.activeElement?.getAttribute("data-f") === "gundo"), "16: der Fokus liegt auf Rückgängig");
    await p.click('[data-g="gildeUndo"]');
    assert(await warte(p, () => !document.querySelector("#gildeNeuName") && !!document.querySelector("#gildeTabs [data-gtab]"), null), "16: Rückgängig holt die Gilde zurück");
    assert(await bis(() => datei().gilde?.name === "Testgilde" && !(datei().geloeste || []).length), "16: die Datei hat sie wieder offen, geloeste ist leer", datei());
    // noch einmal loesen und die Liste benutzen
    await oeffneSchublade(p);
    await p.click('[data-ol="loesen"]');
    await p.fill("#gildeOLoesenName", "Testgilde");
    await p.click('[data-ol="loesenJa"]');
    await warte(p, () => !!document.querySelector("#gildeNeuName"), null);
    await bis(() => datei().geloeste?.length === 1);
    await oeffneSchublade(p);
    const t1 = await huelle(p);
    assert(/Gelöste Gilden/.test(t1) && /Testgilde/.test(t1) && /2 Mitglieder/.test(t1) && /Zurückholen/.test(t1) && /Nichts wird gelöscht/.test(t1), "16: die Liste zeigt Name, Datum, Mitglieder und Zurückholen, und dass nichts gelöscht wird", t1);
    await p.click('#gildeOnlineHuelle [data-ol="zu"]');
    // eine neue Gilde anlegen: Zurueckholen ist dann gesperrt, bis sie geloest ist
    await p.fill("#gildeNeuName", "Zweitgilde");
    await p.keyboard.press("Enter");
    await warte(p, () => !!document.querySelector("#gildeTabs [data-gtab]"), null);
    await bis(() => datei().gilde?.name === "Zweitgilde");
    assert(datei().geloeste?.length === 1, "16: das Anlegen laesst die gelöste Gilde in der Datei", datei());
    await oeffneSchublade(p);
    assert(await p.evaluate(() => document.querySelector('[data-ol="holen"]')?.disabled === true) && /Löse zuerst die jetzige Gilde/.test(await huelle(p)), "16: bei offener Gilde ist Zurückholen gesperrt und sagt warum", await huelle(p));
    await p.click('[data-ol="loesen"]');
    await p.fill("#gildeOLoesenName", "Zweitgilde");
    await p.click('[data-ol="loesenJa"]');
    await warte(p, () => !!document.querySelector("#gildeNeuName"), null);
    await bis(() => datei().geloeste?.length === 2);
    await oeffneSchublade(p);
    assert(await p.evaluate(() => document.querySelectorAll('[data-ol="holen"]').length === 2 && [...document.querySelectorAll('[data-ol="holen"]')].every((b) => !b.disabled)), "16: ohne offene Gilde sind beide Zurückholen frei");
    await p.click('[data-ol="holen"][data-id="gtest00001"]');
    assert(await warte(p, () => !!document.querySelector("#gildeTabs [data-gtab]"), null), "16: Zurückholen macht die Gilde wieder offen");
    assert(await bis(() => datei().gilde?.id === "gtest00001" && datei().geloeste?.length === 1 && datei().geloeste[0].gilde.name === "Zweitgilde"), "16: die Datei: Testgilde offen, Zweitgilde unter geloeste, nichts fehlt", datei());
    assert(!s.fehler.length, "16: keine Seitenfehler", s.fehler);
    assert(!s.online.some((x) => !["status", "abrufen"].includes(x.was)), "16: das Loesen und Zurückholen ruft den Hauptprozess fuer Gilde online nicht", s.online.map((x) => x.was));
    await p.close();
  }
  // 16b: 30 Sekunden, dann ist der Satz weg; die Liste bleibt
  {
    const datei = () => speicher.loadGilde();
    dateiSetzen(meine());
    const s = await oeffne();
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gildeOnlineChip button"), null);
    await p.clock.install();
    await p.click("#gildeOnlineChip button");
    await p.click('[data-ol="loesen"]');
    await p.fill("#gildeOLoesenName", "Testgilde");
    await p.click('[data-ol="loesenJa"]');
    await warte(p, () => !!document.querySelector("#gildeNeuName"), null);
    assert(!!(await p.$("#gildeFlaeche .gl-meldung")), "16b: der Satz steht nach dem Loesen");
    await p.clock.runFor(29000);
    assert(!!(await p.$("#gildeFlaeche .gl-meldung")), "16b: nach 29 Sekunden steht er noch");
    await p.clock.runFor(2000);
    assert(!(await p.$("#gildeFlaeche .gl-meldung")), "16b: nach 30 Sekunden ist der Satz weg");
    await p.clock.resume();
    assert(await bis(() => datei().geloeste?.length === 1), "16b: die Gilde liegt weiter in der Datei (unter geloeste)", datei());
    await p.click("#gildeOnlineChip button");
    assert(/Zurückholen/.test(await huelle(p)), "16b: die Liste bietet sie weiter an");
    await p.close();
  }
  // 16c: 560 px und die vier Themen, Englisch, Tastatur
  for (const thema of ["dark", "light", "tnl", "glas"]) {
    dateiSetzen(meine());
    const s = await oeffne({ breite: 560, hoehe: 900, thema });
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gildeOnlineChip button"), null);
    await p.click("#gildeOnlineChip button");
    await p.click('[data-ol="loesen"]');
    const rg = await p.evaluate(() => {
      const rot = (c) => { const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(c); if (!m) return false; const [r, g, b] = [+m[1], +m[2], +m[3]]; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 24) return false; const h = ((mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360; return h <= 20 || h >= 340 || (h >= 90 && h <= 150); };
      return [...document.querySelectorAll(".gl-o-schublade *")].filter((e) => e.children.length === 0 && (e.textContent || "").trim()).filter((e) => rot(getComputedStyle(e).color) || rot(getComputedStyle(e).backgroundColor)).map((e) => e.tagName);
    });
    assert(!rg.length, "16c: " + thema + ": die Frage zum Loesen nutzt weder Rot noch Gruen", rg);
    const breit = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sk: document.querySelector(".gl-o-scroll")?.scrollWidth, sc: document.querySelector(".gl-o-scroll")?.clientWidth }));
    assert(breit.sw <= breit.cw && breit.sk <= breit.sc, "16c: " + thema + " 560 px: kein waagerechtes Rollen", breit);
    assert(!s.fehler.length, "16c: " + thema + ": keine Seitenfehler", s.fehler);
    await p.close();
  }
  {
    dateiSetzen(meine());
    const s = await oeffne({ lang: "en" });
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gildeOnlineChip button"), null);
    await p.click("#gildeOnlineChip button");
    await p.click('[data-ol="loesen"]');
    assert(/Type the guild's name/.test(await huelle(p)) && /Dissolved guilds/.test(await huelle(p)), "16c: Englisch: Frage und Liste sind uebersetzt", await huelle(p));
    // Tastatur: Escape schliesst, der Fokus kehrt zum Chip zurueck
    await p.keyboard.press("Escape");
    assert(!(await p.$(".gl-o-schublade")) && (await p.evaluate(() => document.activeElement?.closest("#gildeOnlineChip") !== null)), "16c: Escape schliesst die Schublade, der Fokus kehrt zum Chip zurueck");
    await p.close();
  }
  // ------------------------------------------------------------ 17. Gilde beenden (Lead) und wieder oeffnen, Mitglieder sehen eine klare Meldung (#237)
  {
    const s = await oeffne({ status: onlineStatus({ beendete: [] }) });
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gildeOnlineChip")?.textContent.includes("Lead"));
    await p.click("#gildeOnlineChip button");
    await warte(p, () => /Diese Gilde/.test(document.querySelector(".gl-o-schublade")?.textContent || ""));
    const t0 = await huelle(p);
    assert(/Diese Gilde/.test(t0) && /Gilde beenden…/.test(t0) && /Zurück auf lokal/.test(t0), "17: der Lead sieht Diese Gilde mit Gilde beenden und weiter Zurück auf lokal", t0);
    await p.click('[data-ol="beenden"]');
    assert(/nimmt auf dem Server für alle Mitglieder keine Änderungen mehr an/.test(await huelle(p)) && /Alle Stände bleiben/.test(await huelle(p)), "17: die Frage nennt die Folgen", await huelle(p));
    const ja = () => p.evaluate(() => document.querySelector('[data-ol="beendenJa"]')?.disabled);
    assert((await ja()) === true, "17: Gilde beenden ist gesperrt, bis der Name stimmt");
    await p.fill("#gildeOLoesenName", "Gilde auf dem Server");
    assert((await ja()) === false, "17: mit dem Namen der Gilde vom Server ist der Knopf frei");
    s.ol.beendete = [{ code: CODE, name: "Gilde auf dem Server", am: "2026-10-14", mitglieder: 2 }];
    await p.click('[data-ol="beendenJa"]');
    assert(await bis(() => s.online.some((x) => x.was === "schliessen")), "17: der Klick ruft schliessen im Hauptprozess", s.online.map((x) => x.was));
    assert(await warte(p, () => document.querySelector("#gildeOnlineChip")?.textContent.includes("Lokal"), null), "17: danach steht der Chip wieder auf Lokal", await chip(p));
    const t1 = await huelle(p);
    assert(/„Gilde auf dem Server“ beendet\./.test(t1) && /Beendete Gilden/.test(t1) && /beendet am 14\.10\.2026 · 2 Mitglieder/.test(t1) && /Wieder öffnen/.test(t1), "17: die Schublade sagt es und listet die beendete Gilde", t1);
    assert(/Nichts wird gelöscht/.test(t1), "17: und dass nichts gelöscht wird");
    await p.click('[data-ol="oeffnen"]');
    assert(await bis(() => s.online.some((x) => x.was === "oeffnen" && x.body.code === CODE)), "17: Wieder öffnen ruft oeffnen mit dem Code", s.online.map((x) => x.was + JSON.stringify(x.body)));
    assert(await warte(p, () => document.querySelector("#gildeOnlineChip")?.textContent.includes("Lead"), null), "17: danach steht der Chip wieder auf Online · Lead", await chip(p));
    assert(!(await p.$(".gl-o-schublade")), "17: die Schublade geht dabei zu");
    assert(!s.fehler.length, "17: keine Seitenfehler", s.fehler);
    await p.close();
  }
  // 17b: ein alter Server kennt oeffnen nicht
  {
    const s = await oeffne({ status: leerStatus({ an: true, adresse: ADRESSE, adresseOk: true, beendete: [{ code: CODE, name: "Alte Gilde", am: "2026-10-01", mitglieder: 5 }] }), optionen: { oeffnen: "alt" } });
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gildeOnlineChip button"), null);
    await p.click("#gildeOnlineChip button");
    await p.click('[data-ol="oeffnen"]');
    assert(await warte(p, () => /Der Server kennt das noch nicht/.test(document.querySelector(".gl-o-schublade")?.textContent || ""), null), "17b: ein alter Server: Der Server kennt das noch nicht", await huelle(p));
    assert(!!(await p.$(".gl-o-schublade")), "17b: die Schublade bleibt offen, nichts ist verloren");
    await p.close();
  }
  // 17c: ein Mitglied: die Gilde ist beendet, klare Meldung, nur lesen, Verlassen geht weiter
  {
    const s = await oeffne({ status: onlineStatus({ rolle: "lesen", beendet: true }) });
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gildeOnlineChip")?.textContent.includes("Mitglied"));
    assert(await warte(p, () => /Der Lead hat diese Gilde beendet/.test(document.querySelector("#gildeOnlineZeile")?.textContent || ""), null), "17c: die Seite sagt: Der Lead hat diese Gilde beendet", await zeile(p));
    assert(await p.evaluate(() => document.getElementById("gilde").classList.contains("gl-nurlesen")), "17c: die Seite ist nur lesbar");
    assert(!(await p.$("#gildeOnlineZeile .gl-o-fehler")) && !/Fehler|abgelehnt/i.test(await zeile(p)), "17c: kein Fehler, sondern ein klarer Satz", await zeile(p));
    await p.click("#gildeOnlineChip button");
    assert(/Der Lead hat diese Gilde beendet\. Du siehst den letzten Stand/.test(await huelle(p)) && /Gilde verlassen/.test(await huelle(p)), "17c: die Schublade sagt es und bietet Verlassen", await huelle(p));
    assert(!/Gilde beenden/.test(await huelle(p)), "17c: ein Mitglied beendet nichts");
    await p.close();
  }
  // 17d: der Lead sieht eine beendete Gilde (anderswo beendet): Wieder öffnen statt Beenden; Englisch
  {
    const s = await oeffne({ lang: "en", status: onlineStatus({ beendet: true, beendete: [] }) });
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gildeOnlineChip button"), null);
    await p.click("#gildeOnlineChip button");
    assert(/The lead has ended this guild/.test(await huelle(p)) && /Open again/.test(await huelle(p)) && !/End guild…/.test(await huelle(p)), "17d: Englisch: eine beendete Lead-Gilde bietet Open again, nicht End guild", await huelle(p));
    await p.close();
    const e2 = await oeffne({ lang: "en", status: onlineStatus({ beendete: [] }) });
    await gildeAuf(e2.page);
    await warte(e2.page, () => document.querySelector("#gildeOnlineChip button"), null);
    await e2.page.click("#gildeOnlineChip button");
    await e2.page.click('[data-ol="beenden"]');
    assert(/takes no more changes on the server, for every member/.test(await huelle(e2.page)), "17d: Englisch: die Frage zum Beenden ist uebersetzt", await huelle(e2.page));
    await e2.page.close();
  }
  // 17e: das Woerterbuch hat fuer gilde.loesen, gilde.gel, gilde.beenden und gilde.beendet dieselben Schluessel in beiden Sprachen
  {
    const praefixe = ["gilde.loesen.", "gilde.gel.", "gilde.beenden.", "gilde.beendet."];
    const de = Object.keys(I18N.de).filter((k) => praefixe.some((x) => k.startsWith(x))), en = Object.keys(I18N.en).filter((k) => praefixe.some((x) => k.startsWith(x)));
    assert(de.length >= 30 && JSON.stringify(de.sort()) === JSON.stringify(en.sort()), "17e: dieselben Schluessel in Deutsch und Englisch", { de: de.length, en: en.length });
    assert(de.every((k) => !/Bau\b/.test(I18N.de[k])), "17e: im deutschen Text heisst es nie Bau");
  }
  // ------------------------------------------------------------ 18. Gelöste Gilde endgültig löschen (#240): Namen, Sicherung, nichts sonst
  {
    const SDIR = join(work, "Borometer", "sicherungen");
    const sich = () => (existsSync(SDIR) ? readdirSync(SDIR).sort() : []);
    const datei = () => speicher.loadGilde();
    const zwei = () => ({ ...meine(), id: "gtest00002", name: "Zweitgilde" });
    rmSync(SDIR, { recursive: true, force: true });
    writeFileSync(GILDE, JSON.stringify({ v: 1, gilde: meine(), geloeste: [{ am: "2026-10-02", gilde: zwei() }] }), "utf8");
    const s = await oeffne();
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gildeOnlineChip button"), null);
    await p.click("#gildeOnlineChip button");
    await p.waitForFunction(() => !!document.querySelector(".gl-o-schublade"));
    assert(await p.evaluate(() => document.querySelectorAll('[data-ol="loeschG"]').length) === 1, "18: bei der gelösten Gilde steht Endgültig löschen… neben Zurückholen");
    await p.click('[data-ol="loeschG"]');
    const fr = await p.evaluate(() => document.getElementById("gildeOLQ")?.textContent.replace(/\s+/g, " ").trim() || "");
    assert(/„Zweitgilde“ wird endgültig gelöscht/.test(fr) && /Sicherungsdatei im Ordner sicherungen/.test(fr), "18: die Frage nennt Gilde und Sicherung", fr);
    assert(await p.evaluate(() => document.activeElement?.id === "gildeOLoeschName"), "18: der Fokus steht im Namensfeld");
    const ja = () => p.evaluate(() => document.querySelector('[data-ol="loeschGJa"]')?.disabled);
    assert((await ja()) === true, "18: der Knopf ist gesperrt, bis der Name stimmt");
    await p.fill("#gildeOLoeschName", "Testgilde");
    assert((await ja()) === true, "18: der Name der offenen Gilde passt nicht zur gelösten");
    await p.click('[data-ol="loeschGNein"]');
    assert(!(await p.$("#gildeOLoeschName")) && datei().geloeste.length === 1 && !sich().length, "18: Abbrechen löscht nichts und legt keine Sicherung an");
    await p.click('[data-ol="loeschG"]');
    await p.fill("#gildeOLoeschName", " zweitGILDE");
    assert((await ja()) === false, "18: mit dem Namen ist der Knopf frei");
    await p.keyboard.press("Enter");
    assert(await bis(() => (datei().geloeste || []).length === 0), "18: Enter löscht: die Gilde ist aus der Datei", datei());
    assert(datei().gilde.id === "gtest00001", "18: die offene Gilde ist unberührt");
    assert(sich().length === 1 && /^gilde-vor-loeschen-/.test(sich()[0]), "18: die Sicherungsdatei liegt im Ordner sicherungen", sich());
    assert(JSON.parse(readFileSync(join(SDIR, sich()[0]), "utf8")).geloeste.length === 1, "18: sie haelt den Stand davor, mit der Gilde");
    // die Datei ist schon geschrieben, wenn die Antwort noch unterwegs ist: auf den Satz ("endgültig gelöscht.", nicht die Frage "wird endgültig gelöscht") warten, nicht gleich lesen (#224)
    await warte(p, () => /„Zweitgilde“ endgültig gelöscht\./.test(document.querySelector(".gl-o-schublade")?.textContent || ""), null);
    const t1 = await huelle(p);
    assert(/„Zweitgilde“ endgültig gelöscht\./.test(t1) && /gilde-vor-loeschen-/.test(t1) && /Noch keine gelöste Gilde/.test(t1), "18: die Schublade nennt das Gelöschte und die Sicherung, die Liste ist leer", t1);
    assert(!s.fehler.length, "18: keine Seitenfehler", s.fehler);
    await p.close();
    // 560 px, vier Themen, Englisch
    for (const thema of ["dark", "light", "tnl", "glas"]) {
      writeFileSync(GILDE, JSON.stringify({ v: 1, gilde: meine(), geloeste: [{ am: "2026-10-02", gilde: zwei() }] }), "utf8");
      const r = await oeffne({ breite: 560, hoehe: 900, thema });
      await gildeAuf(r.page);
      await warte(r.page, () => document.querySelector("#gildeOnlineChip button"), null);
      await r.page.click("#gildeOnlineChip button");
      await r.page.click('[data-ol="loeschG"]');
      const m = await r.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sk: document.querySelector(".gl-o-scroll")?.scrollWidth, sc: document.querySelector(".gl-o-scroll")?.clientWidth }));
      assert(m.sw <= m.cw && m.sk <= m.sc, "18: " + thema + " 560 px: kein waagerechtes Rollen mit der Frage", m);
      assert(!r.fehler.length, "18: " + thema + ": keine Seitenfehler", r.fehler);
      await r.page.close();
    }
    writeFileSync(GILDE, JSON.stringify({ v: 1, gilde: meine(), geloeste: [{ am: "2026-10-02", gilde: zwei() }] }), "utf8");
    const e = await oeffne({ lang: "en" });
    await gildeAuf(e.page);
    await warte(e.page, () => document.querySelector("#gildeOnlineChip button"), null);
    await e.page.click("#gildeOnlineChip button");
    await e.page.click('[data-ol="loeschG"]');
    assert(/will be deleted for good/.test(await huelle(e.page)), "18: Englisch: die Frage ist übersetzt", await huelle(e.page));
    await e.page.close();
    dateiSetzen(meine());
  }
  // ------------------------------------------------------------ 19. Beendete Gilde endgültig löschen (Lead) und was Mitglieder dann sehen (#240)
  {
    const beendet = { code: CODE, name: "Alte Gilde", am: "2026-10-01", mitglieder: 5 };
    const s = await oeffne({ status: leerStatus({ an: true, adresse: ADRESSE, adresseOk: true, beendete: [beendet] }) });
    const p = s.page;
    await gildeAuf(p);
    await warte(p, () => document.querySelector("#gildeOnlineChip button"), null);
    await p.click("#gildeOnlineChip button");
    assert(await p.evaluate(() => document.querySelectorAll('[data-ol="loeschB"]').length) === 1, "19: bei der beendeten Gilde steht Endgültig löschen…");
    await p.click('[data-ol="loeschB"]');
    const fr = await p.evaluate(() => document.getElementById("gildeOLB")?.textContent.replace(/\s+/g, " ").trim() || "");
    assert(/„Alte Gilde“ wird endgültig gelöscht, auch auf dem Server/.test(fr) && /Sicherungsdatei im Ordner sicherungen/.test(fr), "19: die Frage nennt Server und Sicherung", fr);
    const ja = () => p.evaluate(() => document.querySelector('[data-ol="loeschBJa"]')?.disabled);
    assert((await ja()) === true, "19: gesperrt, bis der Name stimmt");
    await p.fill("#gildeOLoeschBName", "Alte");
    assert((await ja()) === true, "19: ein halber Name entsperrt nicht");
    await p.click('[data-ol="loeschBNein"]');
    assert(!s.online.some((x) => x.was === "loeschen"), "19: Abbrechen ruft den Hauptprozess nicht");
    await p.click('[data-ol="loeschB"]');
    await p.fill("#gildeOLoeschBName", "alte gilde");
    assert((await ja()) === false, "19: mit dem Namen ist der Knopf frei");
    s.ol.beendete = [];
    await p.keyboard.press("Enter");
    assert(await bis(() => s.online.some((x) => x.was === "loeschen" && x.body.code === CODE)), "19: Enter ruft loeschen mit dem Code", s.online.map((x) => x.was));
    assert(await warte(p, () => /„Alte Gilde“ endgültig gelöscht\./.test(document.querySelector(".gl-o-schublade")?.textContent || ""), null), "19: die Schublade nennt das Gelöschte", await huelle(p));
    assert(/gilde-2026-10-12-v3.json/.test(await huelle(p)) && !/Beendete Gilden/.test(await huelle(p)), "19: sie nennt die Sicherungsdatei, die Liste Beendete Gilden ist weg", await huelle(p));
    assert(!s.fehler.length, "19: keine Seitenfehler", s.fehler);
    await p.close();
    // alter Server
    const a = await oeffne({ status: leerStatus({ an: true, adresse: ADRESSE, adresseOk: true, beendete: [beendet] }), optionen: { loeschen: "alt" } });
    await gildeAuf(a.page);
    await warte(a.page, () => document.querySelector("#gildeOnlineChip button"), null);
    await a.page.click("#gildeOnlineChip button");
    await a.page.click('[data-ol="loeschB"]');
    await a.page.fill("#gildeOLoeschBName", "Alte Gilde");
    await a.page.click('[data-ol="loeschBJa"]');
    assert(await warte(a.page, () => /Der Server kennt das noch nicht/.test(document.querySelector(".gl-o-schublade")?.textContent || ""), null), "19: ein alter Server: Der Server kennt das noch nicht", await huelle(a.page));
    await a.page.close();
    // Mitglied: die Gilde gibt es nicht mehr
    const m = await oeffne({ status: onlineStatus({ rolle: "lesen", entfernt: true }) });
    await gildeAuf(m.page);
    await warte(m.page, () => document.querySelector("#gildeOnlineChip")?.textContent.includes("Mitglied"));
    assert(await warte(m.page, () => /Diese Gilde gibt es nicht mehr/.test(document.querySelector("#gildeOnlineZeile")?.textContent || ""), null), "19: Mitglied: Diese Gilde gibt es nicht mehr, kein Fehler", await zeile(m.page));
    assert(await m.page.evaluate(() => document.getElementById("gilde").classList.contains("gl-nurlesen")), "19: Mitglied: nur lesbar");
    await m.page.click("#gildeOnlineChip button");
    assert(/Der Lead hat diese Gilde gelöscht/.test(await huelle(m.page)) && /Gilde verlassen/.test(await huelle(m.page)), "19: Mitglied: die Schublade sagt es und bietet Verlassen", await huelle(m.page));
    await m.page.close();
    // 560 px und Englisch
    for (const thema of ["dark", "light", "tnl", "glas"]) {
      const r = await oeffne({ breite: 560, hoehe: 900, thema, status: leerStatus({ an: true, adresse: ADRESSE, adresseOk: true, beendete: [beendet] }) });
      await gildeAuf(r.page);
      await warte(r.page, () => document.querySelector("#gildeOnlineChip button"), null);
      await r.page.click("#gildeOnlineChip button");
      await r.page.click('[data-ol="loeschB"]');
      const w = await r.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sk: document.querySelector(".gl-o-scroll")?.scrollWidth, sc: document.querySelector(".gl-o-scroll")?.clientWidth }));
      assert(w.sw <= w.cw && w.sk <= w.sc, "19: " + thema + " 560 px: kein waagerechtes Rollen", w);
      await r.page.close();
    }
    const e = await oeffne({ lang: "en", status: leerStatus({ an: true, adresse: ADRESSE, adresseOk: true, beendete: [beendet] }) });
    await gildeAuf(e.page);
    await warte(e.page, () => document.querySelector("#gildeOnlineChip button"), null);
    await e.page.click("#gildeOnlineChip button");
    await e.page.click('[data-ol="loeschB"]');
    assert(/on the server too/.test(await huelle(e.page)), "19: Englisch: die Frage ist übersetzt", await huelle(e.page));
    await e.page.close();
  }
} finally {
  await browser.close();
}
if (failed) { console.log(`\n${failed} fehlgeschlagen`); process.exit(1); }
console.log("\nalles gruen");
