// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Bereich Gilde an der gebauten Seite (Spezifikation
// docs/superpowers/specs/2026-10-06-gilde-design.md, 5; Plan Aufgabe 5 mit dem
// Nachtrag nach Entwurf 2): Leistenknopf zwischen Weeklies und Rekorden, der
// Datenschutz-Satz, Gilde anlegen, die vier Reiter, Suche und Rollenfilter,
// der Reiter Mitglieder mit Waffenpaar, Rolle, Loesen und Rueckgaengig (die
// Uebernahme aus der Gruppe entfiel am 11.10.2026), Tastatur, Fokusring, die Groessen 2000 x 1480, 1280 x
// 860 und 560 in vier Themen, das Woerterbuch und der Satz im Browser ohne App.
//
// Kein Server: die Seite kommt vom gestellten Helfer (page.route); /api/gilde
// beantwortet der echte Speicher src/main/gilde.ts (gebuendelt mit gestelltem
// electron, Temp-Ordner als APPDATA, wie test-gilde-store.mjs). Alle Namen sind
// erfunden.
//
// Run:  npm run test:gilde-page     (baut die Seite zuerst)
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import * as esbuild from "esbuild";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "boro-gilde-page-"));
// vor dem Buendeln: GILDE_PATH steht beim Laden des Moduls fest
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
const { klasseVon, WAFFEN } = await bundle('export { klasseVon, WAFFEN } from "./src/renderer/klassen-core";');
const pkern = await bundle('export { rangliste, punkteText, tabelleEinlesen } from "./src/renderer/gilde-punkte-core";');
const kern = await bundle('export { auswerten, textAusgabe, filtern, icsAlle } from "./src/renderer/gilde-core";');
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const DATEI = "file:///" + join(root, "dist", "renderer", "index.html").replace(/\\/g, "/").replace(/^\/+/, "");
const GILDE = join(work, "Borometer", "boro-gilde.json");
const datei = () => speicher.loadGilde();
const dateiSetzen = (gilde) => writeFileSync(GILDE, JSON.stringify({ v: 1, gilde }), "utf8");

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Der gestellte Helfer. ohneGilde: /api/gilde antwortet 404 (ein Helfer ohne die Route); posts: jeder
   gesendete Stand in der Reihenfolge, mit der Antwort des Speichers. */
/* tor: ein Versprechen, auf das GET /api/gilde wartet (das erste Lesen laesst sich so aufhalten). */
/* stoer: { get, post } - so viele Anfragen beantwortet der Helfer zuerst mit 503. */
/* uhr: die Uhr der Seite (page.clock), etwa "2026-10-06T10:00:00"; die Uhrzeit steht dort fest, die Zeitgeber laufen weiter. */
/* init: ein Skript, das vor der Seite laeuft (etwa die gestellte Zwischenablage). */
async function oeffne({ lang = "de", breite = 1280, hoehe = 860, thema = null, ohneGilde = false, tor = null, uhr = null, init = null, stoer = null } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const s = { page, fehler: [], posts: [], gets: 0 };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  if (uhr) { await page.clock.install({ time: new Date(uhr) }); await page.clock.setFixedTime(new Date(uhr)); }
  if (init) await page.addInitScript(init);
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/gilde") {
      if (ohneGilde) return route.fulfill({ status: 404, body: "" }).catch(() => {});
      if (req.method() === "GET") {
        s.gets++;
        if (stoer?.get > 0) { stoer.get--; return json(503, { ok: false }); }
        if (tor) await tor;
        const g = speicher.loadGilde();
        return g ? json(200, { ok: true, data: g }) : json(503, { ok: false });
      }
      if (stoer?.post > 0) { stoer.post--; s.posts.push({ data: null, put: "503" }); return json(503, { ok: false }); }
      const sent = JSON.parse(req.postData() || "{}");
      const put = speicher.putGilde(sent.data);
      s.posts.push({ data: sent.data, put });
      return json(put === "saved" ? 200 : put === "refused" ? 400 : 503, { ok: put === "saved" });
    }
    if (path === "/api/gilde-loeschen" && req.method() === "POST") {
      const gone = speicher.loescheGeloest(JSON.parse(req.postData() || "{}"));
      return json(gone.ok ? 200 : gone.grund === "unavailable" ? 503 : 400, gone);
    }
    if (path === "/api/state") return json(200, { dir: "", file: "", size: 0, mtime: 0 });
    if (path === "/api/config" && req.method() === "POST") return json(200, { ok: true });
    if (path === "/api/config") return json(200, { logIndex: {}, ...(thema ? { theme: thema } : {}) });
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json(200, { ok: true, registered: true, counts: {} }); }
    if (path === "/api/builds" && req.method() === "GET") return json(200, { ok: true, builds: {} });
    if (path === "/api/best" && req.method() === "GET") return json(200, { ok: true, best: {} });
    if (path === "/api/plans" && req.method() === "GET") return json(200, { ok: true, plans: {} });
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
const warte = (p, fn, arg, ms = 8000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
async function bis(fn, ms = 8000) {
  const ende = performance.now() + ms;
  while (performance.now() < ende) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
  return !!(await fn());
}
const gildeAuf = async (p) => {
  await p.click('#bereiche [data-tab="gilde"]');
  await p.waitForFunction(() => !document.querySelector("#gilde").hidden);
};
const reiter = async (p, k) => {
  await p.click(`#gildeTabs [data-gtab="${k}"]`);
  await p.waitForFunction((x) => document.querySelector(`#gildeTabs [data-gtab="${x}"]`)?.getAttribute("aria-selected") === "true", k);
};
const txt = (s) => (s || "").replace(/[ \t\n\r]+/g, " ").trim();
const blick = (p) => p.evaluate(() => {
  const q = (x, r = document) => r.querySelector(x), qa = (x, r = document) => [...r.querySelectorAll(x)];
  const t = (e) => (e?.textContent || "").replace(/[ \t\n\r]+/g, " ").trim();
  return {
    offen: !q("#gilde").hidden, aktuell: q('#bereiche [data-tab="gilde"]')?.getAttribute("aria-current") || "",
    status: t(q("#gildeStatus")), datenschutz: t(q("#gildeDatenschutz")), flaeche: t(q("#gildeFlaeche")),
    tabs: qa('#gildeTabs [role="tab"]').map((b) => ({ k: b.dataset.gtab, sel: b.getAttribute("aria-selected"), ti: b.tabIndex })),
    filter: !!q("#gildeFilter") && !q("#gildeFilter").hidden, treffer: t(q("#gildeTreffer")),
    spalten: qa("#gildeFlaeche .gl-spalte").map((s) => ({ titel: t(q("h3", s)), namen: qa(".gl-kachel .gl-name", s).map(t) })),
    kacheln: qa("#gildeFlaeche .gl-kachel").map((k) => ({ id: k.dataset.mId, name: t(q(".gl-name", k)), klasse: t(q(".gl-klasse", k)) })),
    leer: t(q("#gildeFlaeche .gl-leer")), undo: t(q("#gildeUndo")), edit: !!q("#gildeEdit"),
    rolleFeld: !!q("#gildeERolle"), ergebnis: t(q("#gildeEdit .gl-ergebnis")),
  };
});
const mitglied = (name) => (datei()?.gilde?.mitglieder || []).find((m) => m.name === name);
/* erfundene Mitglieder: 8 Tank, 10 Heiler, 32 Schaden, je mit einem Waffenpaar der Rolle (Entscheidung 07.10.2026: bis zu 50) */
function fuenfzig() {
  const paare = { tank: [], heal: [], dps: [] };
  for (let i = 0; i < WAFFEN.length; i++) for (let j = i + 1; j < WAFFEN.length; j++) {
    const k = klasseVon([WAFFEN[i], WAFFEN[j]]);
    if (k) paare[k.role].push([WAFFEN[i], WAFFEN[j]]);
  }
  const viele = [];
  for (const [rolle, n] of [["tank", 8], ["heal", 10], ["dps", 32]]) for (let i = 0; i < n; i++)
    viele.push({ id: "m" + rolle.slice(0, 1) + String(i).padStart(8, "0"), name: "Testperson " + rolle.toUpperCase() + " " + (i + 1), rolle: "",
      waffen: paare[rolle][i % paare[rolle].length], notiz: i % 5 ? "" : "Notiz " + i });
  return viele;
}
/* Termine: die Uhr der Seite steht auf Di 06.10.2026 10:00 (Plan Aufgabe 6) */
const UHR = "2026-10-06T10:00:00";
/* GILDE_FOTO=<Ordner>: die Probe legt dort zwei Bilder der Anwesenheit ab (nur auf Wunsch) */
const FOTO = process.env.GILDE_FOTO || "";
const reiheIn = (titel) => (datei()?.gilde?.reihen || []).find((r) => r.titel === titel);
const terme = (p) => p.evaluate(() => [...document.querySelectorAll("#gildeFlaeche .gl-term")].map((b) => ({
  d: b.dataset.datum, stand: b.querySelector(".stand")?.textContent || "", aus: b.classList.contains("aus"), cur: b.getAttribute("aria-current") === "true",
  strich: getComputedStyle(b.querySelector(".wann")).textDecorationLine, text: b.textContent.replace(/\s+/g, " ").trim(), hoch: Math.round(b.getBoundingClientRect().height) })));
const gruppen = (p) => p.evaluate(() => [...document.querySelectorAll('#gildeFlaeche .gl-marken[role="radiogroup"]')].map((g) => ({
  id: g.dataset.mId, label: g.getAttribute("aria-label"),
  radios: [...g.querySelectorAll('[role="radio"]')].map((r) => ({ k: r.dataset.marke, an: r.getAttribute("aria-checked"), ti: r.tabIndex,
    text: r.textContent.trim(), aria: r.getAttribute("aria-label") || "", title: r.title, svg: !!r.querySelector("svg") })) })));
/* Rot oder Gruen als Farbton (0-20 Grad oder 90-150 Grad); fast graue Farben haben keinen Farbton */
function rotGruen(farbe) {
  const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(farbe) || /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(farbe);
  if (!m) return true;
  let [r, g, b] = m.slice(1, 4).map(Number);
  if (farbe.startsWith("color(")) [r, g, b] = [r * 255, g * 255, b * 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min;
  if (c < 24) return false;
  const h = ((max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4) * 60 + 360) % 360;
  return h <= 20 || h >= 340 || (h >= 90 && h <= 150);
}

try {
  dateiSetzen(null);
  // ------------------------------------------------------------ 1. Leiste, 2. Datenschutz, 3. Anlegen, 4. Reiter
  {
    const s = await oeffne();
    const p = s.page;
    const lage = await p.evaluate(() => {
      const g = document.querySelector('#bereiche [data-tab="gilde"]');
      return { da: !!g, vor: g?.previousElementSibling?.dataset.tab, nach: g?.nextElementSibling?.dataset.tab,
        svg: !!g?.querySelector("svg"), name: g?.querySelector(".vh")?.textContent };
    });
    assert(lage.da && lage.vor === "weeklies" && lage.nach === "rekorde" && lage.svg && lage.name === "Gilde",
      "1: der Leistenknopf steht direkt nach Weeklies und vor Rekorde, mit Symbol und Namen", lage);
    assert(s.posts.length === 0, "vor dem ersten Laden schreibt die Seite nichts", s.posts.length);
    await gildeAuf(p);
    const sicht = await p.evaluate(() => ["#land", "#app", "#weeklies", "#rekorde", "#einst"].map((x) => document.querySelector(x).hidden));
    const b0 = await blick(p);
    assert(b0.offen && b0.aktuell === "page" && sicht.every(Boolean), "1: Klick zeigt #gilde und versteckt Start, Kampf, Weeklies, Rekorde, Einstellungen", { b0, sicht });
    assert(b0.datenschutz.includes("boro-gilde.json") && /nur auf diesem PC/.test(b0.datenschutz), "2: der Datenschutz-Satz (DE) nennt boro-gilde.json", b0.datenschutz);
    // 3. Leerer Zustand
    const leer = await p.evaluate(() => {
      const i = document.querySelector("#gildeNeuName"), l = i && document.querySelector(`label[for="${i.id}"]`);
      return { feld: !!i, label: l?.textContent.trim(), knopf: document.querySelector("#gildeNeu button[type=submit]")?.textContent.trim(),
        tabs: !!document.querySelector("#gildeTabs:not([hidden])"), filter: !!document.querySelector("#gildeFilter:not([hidden])") };
    });
    assert(leer.feld && leer.label === "Name der Gilde" && leer.knopf === "Gilde anlegen" && !leer.tabs && !leer.filter,
      "3: ohne Gilde ein Feld \"Name der Gilde\" und \"Gilde anlegen\", keine Reiter", leer);
    await p.focus("#gildeNeuName");
    await p.keyboard.type("Testgilde");
    await p.keyboard.press("Enter");
    assert(await bis(() => datei()?.gilde?.name === "Testgilde"), "3: Enter legt an, die Datei traegt den Namen", datei());
    const g0 = datei()?.gilde;
    assert(/^g[0-9a-z]{9}$/.test(g0?.id || "") && Array.isArray(g0?.mitglieder) && !g0.mitglieder.length, "3: neue Gilde mit Kennung g + 9 Zeichen, leer", g0);
    // 4. Reiter
    const b1 = await blick(p);
    assert(b1.tabs.length === 4 && b1.tabs.map((x) => x.k).join() === "termine,mitglieder,auswertung,punkte" && b1.tabs[0].sel === "true"
      && b1.tabs.filter((x) => x.ti === 0).length === 1, "4: vier Reiter, Termine gewaehlt, ein Tabstopp", b1.tabs);
    assert(await p.evaluate(() => document.querySelector("#gildeTabs").getAttribute("role") === "tablist"
      && document.querySelector("#gildeFlaeche").getAttribute("role") === "tabpanel"), "4: tablist und tabpanel");
    await p.focus('#gildeTabs [data-gtab="termine"]');
    await p.keyboard.press("ArrowRight");
    const b2 = await blick(p);
    const fokus = await p.evaluate(() => document.activeElement?.dataset.gtab);
    assert(b2.tabs[1].sel === "true" && b2.tabs[0].sel === "false" && fokus === "mitglieder", "4: Pfeil rechts waehlt Mitglieder, der Fokus folgt", { tabs: b2.tabs, fokus });
    await p.keyboard.press("End");
    assert((await blick(p)).tabs[3].sel === "true", "4: Ende waehlt den letzten Reiter (Punkte)");
    await p.keyboard.press("Home");
    assert((await blick(p)).tabs[0].sel === "true", "4: Pos1 waehlt den ersten Reiter");
    assert(!s.fehler.length, "1-4: keine Seitenfehler", s.fehler);
    await p.close();
  }
  // ------------------------------------------------------------ 5. Mitglieder, Waffen, Suche; 6. Loesen; 7. Tastatur
  {
    const s = await oeffne();
    const p = s.page;
    await gildeAuf(p);
    await reiter(p, "mitglieder");
    const b0 = await blick(p);
    assert(/Noch keine Mitglieder/.test(b0.flaeche), "5: ohne Mitglieder ein Satz", b0.flaeche);
    assert(await p.evaluate(() => !document.querySelector("#gildeAusGruppe") && !document.querySelector("#gildeAusGruppeSatz")), "5: es gibt keine \"Aus der Gruppe uebernehmen\" mehr");
    await p.click("#gildeMNeu");
    assert(await warte(p, () => document.activeElement?.id === "gildeEName"), "5: \"+ Mitglied\" oeffnet das Feld, der Fokus steht im Namen");
    assert(!mitglied(""), "5: ein Mitglied ohne Namen wird nie gespeichert");
    await p.keyboard.type("Testperson A");
    await p.selectOption("#gildeERolle", "tank");
    await p.waitForTimeout(600);
    assert(await bis(() => mitglied("Testperson A")?.rolle === "tank"), "5: nach 600 ms steht Testperson A mit Rolle tank in der Datei", datei()?.gilde?.mitglieder);
    const a = mitglied("Testperson A");
    assert(/^m[0-9a-z]{9}$/.test(a?.id || "") && Array.isArray(a?.waffen) && !a.waffen.length && a.notiz === "", "5: Kennung m + 9, keine Waffen, leere Notiz", a);
    let b = await blick(p);
    assert(b.spalten.find((x) => /Tank/.test(x.titel))?.namen.includes("Testperson A"), "5: die Kachel steht in der Spalte Tank", b.spalten);
    // Notiz
    await p.fill("#gildeENotiz", "Ersatz-Tank");
    assert(await bis(() => mitglied("Testperson A")?.notiz === "Ersatz-Tank"), "5: die Notiz wird gespeichert");
    // Waffenpaar
    await p.click('#gildeEdit .gl-wb[data-nr="1"] button[data-w="Greatsword"]');
    await p.click('#gildeEdit .gl-wb[data-nr="2"] button[data-w="Sword and Shield"]');
    assert(await bis(() => JSON.stringify(mitglied("Testperson A")?.waffen) === JSON.stringify(["Greatsword", "Sword and Shield"])),
      "5: das Waffenpaar steht in der Datei", mitglied("Testperson A"));
    const k = klasseVon(["Greatsword", "Sword and Shield"]);
    b = await blick(p);
    assert(!b.rolleFeld && b.ergebnis.includes(k.de) && b.kacheln[0]?.klasse.includes(k.de), "5: mit zwei Waffen folgt die Klasse, kein Rollenfeld", { b, k });
    const knoepfe = await p.evaluate(() => ({
      gedrueckt1: [...document.querySelectorAll('#gildeEdit .gl-wb[data-nr="1"] button[aria-pressed="true"]')].map((x) => x.dataset.w),
      gesperrt2: [...document.querySelectorAll('#gildeEdit .gl-wb[data-nr="2"] button:disabled')].map((x) => x.dataset.w),
      namen: [...document.querySelectorAll('#gildeEdit .gl-wb[data-nr="1"] button')].map((x) => x.getAttribute("aria-label") + "|" + x.title),
      marke: !!document.querySelector('#gildeEdit .gl-wb button[data-w="Greatsword"] .wic') }));
    assert(knoepfe.gedrueckt1.join() === "Greatsword" && knoepfe.gesperrt2.join() === "Greatsword" && knoepfe.marke
      && knoepfe.namen.length === 10 && knoepfe.namen.includes("Gro\u00dfschwert|Gro\u00dfschwert"),
      "5: zehn runde Waffenknoepfe mit Marke, Name als aria-label und title, dieselbe Waffe nicht zweimal", knoepfe);
    // eine Waffe weg: wieder Rollenfeld, die Rolle bleibt
    await p.click('#gildeEdit .gl-wb[data-nr="2"] button[data-w="Sword and Shield"]');
    assert(await bis(() => mitglied("Testperson A")?.waffen.length === 0) && (await blick(p)).rolleFeld,
      "5: nur eine Waffe: gespeichert ohne Waffen, das Rollenfeld ist wieder da", mitglied("Testperson A"));
    await p.click('#gildeEdit .gl-wb[data-nr="2"] button[data-w="Sword and Shield"]');
    await bis(() => mitglied("Testperson A")?.waffen.length === 2);
    await p.click('#gildeEdit [data-g="fertig"]');
    assert(!(await blick(p)).edit, "5: Fertig schliesst das Feld");
    // zweites Mitglied
    await p.click("#gildeMNeu");
    await p.keyboard.type("Testperson B");
    await p.selectOption("#gildeERolle", "heal");
    await p.focus("#gildeEName");
    await p.keyboard.press("Enter");
    assert(await bis(() => mitglied("Testperson B")?.rolle === "heal") && !(await blick(p)).edit, "5: Enter im Namen schliesst, Testperson B als Heiler gespeichert");
    // Suche und Filter
    b = await blick(p);
    assert(b.filter && b.treffer === "2 von 2 Mitgliedern", "Filter: \"2 von 2 Mitgliedern\"", b.treffer);
    const chips = await p.evaluate(() => [...document.querySelectorAll('#gildeFilter [role="radio"]')].map((x) => x.textContent.replace(/\s+/g, " ").trim() + "|" + x.getAttribute("aria-checked")));
    assert(chips.length === 4 && chips[0] === "Alle 2|true" && chips[1] === "Tank 1|false" && chips[2] === "Heiler 1|false" && chips[3] === "Schaden 0|false",
      "Filter: Alle/Tank/Heiler/Schaden mit Anzahl", chips);
    await p.fill("#gildeSuche", "person b");
    b = await blick(p);
    assert(b.treffer === "1 von 2 Mitgliedern" && b.kacheln.length === 1 && b.kacheln[0].name === "Testperson B" && b.spalten.length === 1,
      "Filter: Suche nach Namen, Spalten ohne Treffer entfallen", b);
    await p.fill("#gildeSuche", "schwert");
    b = await blick(p);
    assert(b.kacheln.length === 1 && b.kacheln[0].name === "Testperson A", "Filter: Suche nach Waffe (deutsch)", b.kacheln);
    await p.fill("#gildeSuche", "zzz");
    b = await blick(p);
    assert(b.treffer === "0 von 2 Mitgliedern" && /Kein Mitglied passt/.test(b.leer) && !b.kacheln.length, "Filter: ohne Treffer ein Satz", b);
    await p.fill("#gildeSuche", "");
    await p.click('#gildeFilter [role="radio"][data-rolle="heal"]');
    b = await blick(p);
    assert(b.kacheln.length === 1 && b.kacheln[0].name === "Testperson B" && b.treffer === "1 von 2 Mitgliedern", "Filter: Rolle Heiler", b);
    await p.focus('#gildeFilter [role="radio"][data-rolle="heal"]');
    await p.keyboard.press("ArrowLeft");
    const rg = await p.evaluate(() => ({ an: document.querySelector('#gildeFilter [aria-checked="true"]')?.dataset.rolle, f: document.activeElement?.dataset.rolle }));
    assert(rg.an === "tank" && rg.f === "tank", "Filter: Pfeiltasten in der Rollengruppe", rg);
    await p.click('#gildeFilter [role="radio"][data-rolle=""]');
    // 6. Loesen und Rueckgaengig
    const idA = mitglied("Testperson A").id;
    const vorPosts = s.posts.length;
    // Loesen steht nur im Feld: die Kachel oeffnet es, dort "Loesen"
    await p.click(`#gildeFlaeche .gl-kachel[data-m-id="${idA}"]`);
    await p.click('#gildeEdit [data-g="loesen"]');
    await p.click('#gildeEdit [data-g="austrJa"]');
    b = await blick(p);
    assert(!b.kacheln.some((x) => x.id === idA) && /Testperson A/.test(b.undo) && /R\u00fcckg\u00e4ngig/.test(b.undo), "6: Loesen nimmt die Kachel weg, ein Satz mit Rueckgaengig", b);
    assert(await p.evaluate(() => document.activeElement?.dataset.g) === "undo", "6: der Fokus steht auf Rueckgaengig");
    assert(await bis(() => mitglied("Testperson A")?.geloest === true), "6: in der Datei geloest: true", mitglied("Testperson A"));
    assert((await blick(p)).treffer === "1 von 1 Mitgliedern", "6: der Filter zaehlt Geloeste nicht");
    await p.click('#gildeUndo [data-g="undo"]');
    b = await blick(p);
    assert(b.kacheln.some((x) => x.id === idA) && !b.undo, "6: Rueckgaengig holt die Kachel zurueck", b);
    assert(await bis(() => { const m = mitglied("Testperson A"); return !!m && !("geloest" in m); }), "6: geloest ist weg", mitglied("Testperson A"));
    const seit = s.posts.slice(vorPosts);
    assert(seit.length >= 2 && seit.every((x) => x.put === "saved" && x.data.gilde.mitglieder.some((m) => m.id === idA)),
      "6: in keinem gesendeten Stand fehlt das Mitglied", seit.map((x) => x.put));
    // Loesen aus dem Feld
    await p.click(`#gildeFlaeche .gl-kachel[data-m-id="${idA}"]`);
    assert(await p.evaluate(() => document.querySelector("#gildeEName")?.value) === "Testperson A", "6: Bearbeiten oeffnet das Feld mit dem Namen");
    await p.click('#gildeEdit [data-g="loesen"]');
    await p.click('#gildeEdit [data-g="austrJa"]');
    b = await blick(p);
    assert(!b.edit && /Testperson A/.test(b.undo), "6: Loesen im Feld schliesst es und zeigt Rueckgaengig", b);
    await p.click('#gildeUndo [data-g="undo"]');
    await bis(() => { const m = mitglied("Testperson A"); return !!m && !("geloest" in m); });
    // 7. Tastatur und Fokusring
    await p.click(`#gildeFlaeche .gl-kachel[data-m-id="${idA}"]`);
    await p.focus("#gildeSuche");
    const erreicht = [];
    for (let i = 0; i < 40; i++) {
      await p.keyboard.press("Tab");
      erreicht.push(await p.evaluate(() => { const a = document.activeElement;
        return a?.id || (a?.dataset.gtab ? "tab:" + a.dataset.gtab : a?.dataset.rolle !== undefined ? "rolle" : a?.dataset.g ? "g:" + a.dataset.g : a?.dataset.w ? "w:" + a.closest(".gl-wb")?.dataset.nr : a?.tagName); }));
    }
    const brauch = ["rolle", "gildeMNeu", "g:bearbeiten", "g:loesen", "gildeEName", "gildeENotiz", "w:1", "w:2", "g:fertig"];
    assert(brauch.every((x) => erreicht.includes(x)), "7: Tab erreicht Filter, Knoepfe, Kacheln und jedes Feld", { erreicht, fehlt: brauch.filter((x) => !erreicht.includes(x)) });
    // eine Runde: vom Suchfeld bis es wieder dran ist
    const runde = erreicht.slice(0, erreicht.indexOf("gildeSuche"));
    assert(runde.filter((x) => x === "w:1").length === 1 && runde.filter((x) => x === "rolle").length === 1,
      "7: je Waffengruppe und Rollengruppe ein Tabstopp", runde);
    await p.focus("#gildeSuche");
    await p.keyboard.press("Shift+Tab");
    await p.keyboard.press("Tab");
    const ring = await p.evaluate(() => { const a = document.activeElement; return { id: a?.id, o: getComputedStyle(a).outlineStyle, w: getComputedStyle(a).outlineWidth }; });
    assert(ring.id === "gildeSuche" && ring.o !== "none" && parseFloat(ring.w) > 0, "7: der Fokusring ist sichtbar (:focus-visible)", ring);
    // Pfeiltasten in einer Waffengruppe
    await p.focus('#gildeEdit .gl-wb[data-nr="1"] button[aria-pressed="true"]');
    await p.keyboard.press("ArrowRight");
    const pf = await p.evaluate(() => document.activeElement?.dataset.w);
    // Schwert und Schild ist in Waffe 1 gesperrt (es ist Waffe 2): der Fokus springt darueber
    assert(pf === "Dagger", "7: Pfeil rechts wandert in der Waffengruppe, ueber die gesperrte Waffe hinweg", pf);
    // Status nach einem abgelehnten Speichern (die Datei gehoert jetzt einer anderen Gilde)
    const fremd = { ...datei().gilde, id: "gfremd0001" };
    dateiSetzen(fremd);
    await p.fill("#gildeENotiz", "x");
    assert(await warte(p, () => /nicht gespeichert.*F5/i.test(document.querySelector("#gildeStatus").textContent)), "Status: ein abgelehnter Stand sagt es in einem Satz, mit Neuladen (F5)",
      (await blick(p)).status);
    // zurueck: die Datei traegt wieder den Stand der Seite
    dateiSetzen(s.posts.at(-1).data.gilde);
    assert(!s.fehler.length, "5-7: keine Seitenfehler", s.fehler);
    await p.close();
  }
  // ------------------------------------------------------------ Keine Uebernahme aus der Gruppe (entfallen am 11.10.2026)
  {
    const vorher = datei().gilde;
    const s = await oeffne();
    const p = s.page;
    const reihe = (name, dps) => ({ name, dps, damage: dps * 60, seconds: 60, waiting: false, target: "Fellinex" });
    const gl = { boroPartyLog: 1, when: new Date(Date.UTC(2026, 9, 4, 20)).toISOString(), code: "RAID", target: "Fellinex", history: [],
      board: [reihe("Testperson C", 40000), reihe("Testperson A", 30000), reihe("Testperson D", 20000)] };
    const glPfad = join(work, "gruppe.json");
    writeFileSync(glPfad, JSON.stringify(gl));
    await p.setInputFiles("#partyLogInput", glPfad);
    await p.waitForTimeout(300);
    await gildeAuf(p);
    await reiter(p, "mitglieder");
    assert(await p.evaluate(() => !document.querySelector("#gildeAusGruppe") && !document.querySelector("#gildeUebernahme")), "Gruppe: auch mit Gruppe gibt es keine Uebernahme, die Namen kommen nie von selbst in die Gilde");
    assert(!mitglied("Testperson C") && !mitglied("Testperson D"), "Gruppe: kein Name der Gruppe steht in der Datei", datei()?.gilde?.mitglieder);
    assert(!s.fehler.length, "Gruppe: keine Seitenfehler", s.fehler);
    await p.close();
  }
  // ------------------------------------------------------------ Punkte: der Reiter (Spezifikation Gilde-Punkte 4)
  {
    const vorher = datei().gilde;
    const ARTEN = [{ id: "aboss00001", name: "Gildenboss", punkte: 1, proPunkt: 7 }, { id: "anorm00001", name: "Raid Normal", punkte: 1, proPunkt: 1 },
      { id: "aschw00001", name: "Raid Schwer", punkte: 1, proPunkt: 1 }, { id: "aalpt00001", name: "Raid Alptraum", punkte: 1, proPunkt: 1 }];
    const pk = (zus, mehr = {}) => ({ seit: "2026-10-06", pausen: [], start: {}, ansehen: { start: 0, eintraege: [] }, zusatz: [{ punkte: zus, notiz: "Test" }], ...mehr });
    const mp = (id, name, punkte, mehr = {}) => ({ id, name, rolle: "dps", waffen: [], notiz: "", ...mehr, punkte });
    const gp = (mehr = {}, regeln = {}) => ({ id: "gpunkt0001", name: "Testgilde", reihen: [], anwesend: {},
      mitglieder: [mp("mpunkt0001", "Testperson A", pk(10)), mp("mpunkt0002", "Testperson B", pk(10)), mp("mpunkt0003", "Testperson C", pk(5)),
        mp("mpunkt0004", "Testperson D", pk(99, { pausen: [{ von: "2026-10-01" }] }))],
      punkte: { an: true, rang: false, gruppen: false, schwellen: [8, 6], monat: 1, teiler: 100000, stichtag: "2026-10-01", arten: ARTEN, ...regeln }, ...mehr });
    const lies = (p) => p.evaluate(() => {
      const q = (x, r = document) => r.querySelector(x), qa = (x, r = document) => [...r.querySelectorAll(x)];
      const t = (e) => (e?.textContent || "").replace(/[ \t\n\r]+/g, " ").trim();
      const sw = q("#gildePSchalter");
      return { tabs: qa('#gildeTabs [role="tab"]').map((b) => b.dataset.gtab), tabSel: q('#gildeTabs [data-gtab="punkte"]')?.getAttribute("aria-selected"),
        filterOben: !!q("#gildeFilter") && !q("#gildeFilter").hidden, schalter: sw ? sw.getAttribute("aria-checked") : null, schalterRolle: sw?.getAttribute("role") || "",
        text: t(q("#gildeFlaeche")), liste: qa("#gildePListe [data-p-id]").map((b) => ({ id: b.dataset.pId, name: t(q(".gl-name", b)), summe: t(q(".gl-p-sm", b)), sel: b.getAttribute("aria-selected"), vorlesen: b.getAttribute("aria-label") })),
        konto: { name: t(q("#gildePKonto .gl-p-name")), summe: t(q("#gildePKonto .gl-p-gross")), satz: t(q("#gildePKonto .gl-p-satz")) },
        filter: qa('#gildePFilter [role="radio"]').map((b) => b.dataset.pf + ":" + b.getAttribute("aria-checked") + ":" + t(q("em", b))),
        inaktivBlock: q('[data-g="pInaktiv"]') ? q('[data-g="pInaktiv"]').getAttribute("aria-expanded") + ":" + t(q('[data-g="pInaktiv"] em')) : null,
        inaktivListe: qa("#gildePInaktiv [data-p-id]").map((b) => t(q(".gl-name", b))), quer: document.documentElement.scrollWidth > innerWidth };
    });
    // 1. Ab Werk aus: der Reiter steht da, ein Satz erklaert ihn, der Schalter ist aus
    dateiSetzen({ ...gp(), punkte: undefined });
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "punkte");
      const a = await lies(p);
      assert(a.tabs.join() === "termine,mitglieder,auswertung,punkte" && a.tabSel === "true", "P1: vier Reiter, der vierte heisst Punkte", a.tabs);
      assert(a.schalterRolle === "switch" && a.schalter === "false" && a.liste.length === 0 && /Punktesystem/.test(a.text) && !a.filterOben,
        "P1: ab Werk aus: ein Schalter, ein Satz, keine Liste, Suche und Rollenfilter oben sind weg", a);
      // Pfeiltasten wandern auch auf den vierten Reiter
      await p.focus('#gildeTabs [data-gtab="auswertung"]');
      await p.keyboard.press("ArrowRight");
      assert(await warte(p, () => document.querySelector('#gildeTabs [data-gtab="punkte"]')?.getAttribute("aria-selected") === "true"), "P1: Pfeil rechts waehlt Punkte");
      // einschalten: die Datei bekommt die Regeln mit dem heutigen Tag als Stichtag und die vier Standardarten
      await p.click("#gildePSchalter");
      assert(await bis(() => datei().gilde.punkte?.an === true), "P1: der Schalter schreibt punkte.an in die Datei", datei().gilde.punkte);
      const pr = datei().gilde.punkte;
      assert(pr.stichtag === "2026-10-06" && pr.rang === false && pr.gruppen === false && pr.monat === 1 && pr.teiler === 100000 && JSON.stringify(pr.schwellen) === "[80,60]"
        && pr.arten.map((x) => x.id + ":" + x.proPunkt).join() === "aboss00001:7,anorm00001:1,aschw00001:1,aalpt00001:1",
        "P1: Stichtag ist der Tag des ersten Einschaltens, Standardregeln und Standardarten", pr);
      assert(await warte(p, () => document.querySelector("#gildePSchalter")?.getAttribute("aria-checked") === "true"), "P1: der Schalter steht auf an");
      // alle Mitglieder (noch ohne Punkte-Feld) stehen in der Liste
      assert(!s.fehler.length, "P1: keine Seitenfehler", s.fehler);
      await p.close();
    }
    // 2. Liste, Konto, Filter, Inaktive
    dateiSetzen(gp());
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "punkte");
      let a = await lies(p);
      assert(a.schalter === "true" && a.liste.map((x) => x.name + ":" + x.summe).join() === "Testperson A:10,Testperson B:10,Testperson C:5",
        "P2: Aktive nach Summe (gleiche Summe nach Name), ohne Inaktive in der Liste", a.liste);
      assert(a.konto.name === "Testperson A" && a.konto.summe === "10" && a.liste[0].sel === "true", "P2: das Konto zeigt das erste Mitglied mit grosser Summe", a.konto);
      assert(/Zusatz/.test(a.konto.satz), "P2: ein Satz nennt die groesste Quelle", a.konto.satz);
      assert(a.liste.every((x) => /Punkte/.test(x.vorlesen || "") && !/Platz|Spitze|Mitte|Ende/.test(x.vorlesen || "")), "P2: je Zeile ein Satz fuer den Vorleser, ohne Rang und Gruppe ab Werk", a.liste.map((x) => x.vorlesen));
      assert(a.filter.join() === "alle:true:4,aktiv:false:3,inaktiv:false:1", "P2: Filter Alle, Aktiv, Inaktiv mit Zahlen", a.filter);
      assert(a.inaktivBlock === "false:1" && a.inaktivListe.length === 0, "P2: bei Alle steht der Block Inaktiv getrennt unten, zu", a.inaktivBlock);
      await p.click('[data-g="pInaktiv"]');
      a = await lies(p);
      assert(a.inaktivBlock === "true:1" && a.inaktivListe.join() === "Testperson D", "P2: der Block klappt auf und zeigt die Inaktiven", a);
      await p.click('#gildePInaktiv [data-p-id="mpunkt0004"]');
      a = await lies(p);
      assert(a.konto.name === "Testperson D" && a.konto.summe === "99" && a.inaktivBlock?.startsWith("true"), "P2: wer unter den Inaktiven gewaehlt ist, bleibt sichtbar (Block bleibt offen)", a.konto);
      await p.click('#gildePFilter [data-pf="aktiv"]');
      a = await lies(p);
      assert(a.liste.length === 3 && a.inaktivBlock === null && a.konto.name !== "Testperson D", "P2: Filter Aktiv zeigt nur die Aktiven, ohne Block", a);
      await p.click('#gildePFilter [data-pf="inaktiv"]');
      a = await lies(p);
      assert(a.liste.map((x) => x.name).join() === "Testperson D" && a.konto.name === "Testperson D", "P2: Filter Inaktiv zeigt nur die Inaktiven", a.liste);
      assert(!s.fehler.length && s.posts.length === 0, "P2: keine Seitenfehler, und Ansehen schreibt nichts", { fehler: s.fehler, posts: s.posts.length });
      await p.close();
    }
    // 3. Tastatur im Filter, 560 px und 2000 x 1480 in vier Themen: kein waagerechtes Rollen
    dateiSetzen(gp());
    for (const [breite, hoehe] of [[2000, 1480], [560, 900]]) {
      for (const thema of ["dark", "light", "tnl", "glas"]) {
        const s = await oeffne({ uhr: UHR, breite, hoehe, thema });
        const p = s.page;
        await gildeAuf(p);
        await reiter(p, "punkte");
        const a = await lies(p);
        assert(!a.quer && a.liste.length === 3, `P3: ${breite} x ${hoehe}, ${thema}: Punkte ohne waagerechtes Rollen`, a.quer);
        assert(!s.fehler.length, `P3: ${breite}, ${thema}: keine Seitenfehler`, s.fehler);
        await p.close();
      }
    }
    // 4. Das Konto bearbeiten: jede Eingabe steht in der Datei, die Summe rechnet mit, Lösen und Rückgängig, nie ein Element entfernen
    const zeilenWert = (p, wort) => p.evaluate((w) => { const z = [...document.querySelectorAll("#gildePKonto .gl-p-kz")].find((x) => new RegExp(w).test(x.querySelector(".gl-p-kn b")?.textContent || ""));
      return z ? z.querySelector(".gl-p-kp b").textContent.trim() : null; }, wort);
    const summeVon = (p) => p.evaluate(() => document.querySelector("#gildePKonto .gl-p-gross")?.textContent.trim());
    const aendere = async (p, sel, wert) => { await p.fill(sel, String(wert)); await p.locator(sel).blur(); };
    const A = "mpunkt0001", B = "mpunkt0002", C = "mpunkt0003", D = "mpunkt0004";
    const aus = (id) => datei().gilde.mitglieder.find((m) => m.id === id);
    dateiSetzen(gp());
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "punkte");
      // Mitglied seit: sechs Monatstage bis heute (06.05. bis 06.10.2026) plus zehn Punkte Zusatz
      await aendere(p, "#gildePSeit", "2026-04-06");
      assert(await bis(() => aus(A).punkte.seit === "2026-04-06"), "P4: Mitglied seit steht in der Datei", aus(A).punkte);
      assert(await warte(p, () => document.querySelector("#gildePKonto .gl-p-gross")?.textContent.trim() === "16"), "P4: sechs aktive Monate, die Summe rechnet mit (16)", await summeVon(p));
      assert(await zeilenWert(p, "^Aktive Monate") === "6", "P4: die Zeile Aktive Monate nennt 6", await zeilenWert(p, "^Aktive Monate"));
      // frueher inaktive Monate gehen ab
      await aendere(p, "#gildePAbzug", 2);
      assert(await bis(() => aus(A).punkte.abzugMonate === 2) && await zeilenWert(p, "^Aktive Monate") === "4" && await summeVon(p) === "14", "P4: 2 Monate frueher inaktiv: 4 Monate, Summe 14", { z: await zeilenWert(p, "^Aktive Monate"), s: await summeVon(p) });
      await aendere(p, "#gildePAbzug", 99);
      assert(await bis(() => aus(A).punkte.abzugMonate === 99) && await zeilenWert(p, "^Aktive Monate") === "0", "P4: ein zu grosser Abzug macht nie weniger als 0 Monate", await zeilenWert(p, "^Aktive Monate"));
      // Startstaende je Art in Teilnahmen: 14 Bosse sind 2 Punkte, 3 Raids 3 Punkte
      await aendere(p, "#gildePStart-aboss00001", 14);
      assert(await bis(() => aus(A).punkte.start.aboss00001 === 14) && await zeilenWert(p, "^Gildenboss") === "2" && await summeVon(p) === "12", "P4: Startstand 14 beim Gildenboss: 2 Punkte, Summe 12", { z: await zeilenWert(p, "^Gildenboss"), s: await summeVon(p) });
      await aendere(p, "#gildePStart-anorm00001", 3);
      assert(await bis(() => aus(A).punkte.start.anorm00001 === 3) && await summeVon(p) === "15", "P4: Startstand 3 bei Raid Normal: Summe 15", await summeVon(p));
      await aendere(p, "#gildePStart-anorm00001", -5);
      assert(await bis(() => aus(A).punkte.start.anorm00001 === 0), "P4: ein negativer Startstand wird 0", aus(A).punkte.start);
      // Gildenansehen: Startstand, Eintrag mit Datum, Loesen und Rueckgaengig
      await aendere(p, "#gildePAnsStart", 150000);
      assert(await bis(() => aus(A).punkte.ansehen.start === 150000) && await zeilenWert(p, "^Gildenansehen") === "1,5", "P4: Ansehen 150000 sind 1,5 Punkte (de)", await zeilenWert(p, "^Gildenansehen"));
      await p.fill("#gildePAnsDatum", "2026-10-04");
      await p.fill("#gildePAnsBetrag", "30000");
      await p.click('[data-g="pAnsAdd"]');
      assert(await bis(() => aus(A).punkte.ansehen.eintraege.length === 1) && aus(A).punkte.ansehen.eintraege[0].datum === "2026-10-04" && aus(A).punkte.ansehen.eintraege[0].betrag === 30000
        && await zeilenWert(p, "^Gildenansehen") === "1,8", "P4: ein Eintrag (04.10., 30000) bringt 1,8 Punkte", { e: aus(A).punkte.ansehen.eintraege, z: await zeilenWert(p, "^Gildenansehen") });
      await p.click('[data-g="pAnsLoesen"][data-i="0"]');
      assert(await bis(() => aus(A).punkte.ansehen.eintraege[0]?.geloest === true) && aus(A).punkte.ansehen.eintraege.length === 1 && await zeilenWert(p, "^Gildenansehen") === "1,5",
        "P4: Loesen setzt geloest, der Eintrag bleibt in der Datei, die Punkte gehen zurueck", aus(A).punkte.ansehen.eintraege);
      await p.click('[data-g="pUndo"]');
      assert(await bis(() => aus(A).punkte.ansehen.eintraege[0]?.geloest !== true) && await zeilenWert(p, "^Gildenansehen") === "1,8", "P4: Rueckgaengig holt den Eintrag zurueck", aus(A).punkte.ansehen.eintraege);
      await p.fill("#gildePAnsBetrag", "");
      await p.click('[data-g="pAnsAdd"]');
      assert(/Datum und Betrag/.test(await p.evaluate(() => document.querySelector("#gildeFlaeche .gl-meldung")?.textContent || "")) && aus(A).punkte.ansehen.eintraege.length === 1, "P4: ein Eintrag ohne Betrag wird nicht angelegt, ein Satz sagt warum");
      // Zusatz von Hand mit Notiz
      await p.fill("#gildePZusPunkte", "2.5");
      await p.fill("#gildePZusNotiz", "Gildenvertrag");
      await p.click('[data-g="pZusAdd"]');
      assert(await bis(() => aus(A).punkte.zusatz.length === 2) && aus(A).punkte.zusatz[1].punkte === 2.5 && aus(A).punkte.zusatz[1].notiz === "Gildenvertrag" && await zeilenWert(p, "^Zusatz") === "12,5",
        "P4: ein Zusatz mit Notiz bringt 2,5 Punkte (10 + 2,5)", { z: aus(A).punkte.zusatz, w: await zeilenWert(p, "^Zusatz") });
      await p.click('[data-g="pZusLoesen"][data-i="1"]');
      assert(await bis(() => aus(A).punkte.zusatz[1].geloest === true) && aus(A).punkte.zusatz.length === 2 && await zeilenWert(p, "^Zusatz") === "10", "P4: Zusatz loesen: bleibt in der Datei, die Punkte gehen zurueck", aus(A).punkte.zusatz);
      await p.click('[data-g="pUndo"]');
      assert(await bis(() => aus(A).punkte.zusatz[1].geloest !== true) && await zeilenWert(p, "^Zusatz") === "12,5", "P4: Rueckgaengig holt den Zusatz zurueck");
      await p.fill("#gildePZusPunkte", "3");
      await p.click('[data-g="pZusAdd"]');
      assert(/Punkte und eine Notiz/.test(await p.evaluate(() => document.querySelector("#gildeFlaeche .gl-meldung")?.textContent || "")) && aus(A).punkte.zusatz.length === 2, "P4: ein Zusatz ohne Notiz wird nicht angelegt");
      assert(s.posts.every((x) => x.put === "saved"), "P4: alles, was die Seite sendet, nimmt die Datei an", s.posts.map((x) => x.put));
      assert(!s.fehler.length, "P4: keine Seitenfehler", s.fehler);
      await p.close();
    }
    // 5. Inaktiv setzen und wieder aktiv: Zeitraeume, nie geloescht
    dateiSetzen(gp());
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "punkte");
      await p.click(`#gildePListe [data-p-id="${C}"]`);
      await p.click('[data-g="pInaktivSetzen"]');
      assert(await bis(() => aus(C).punkte.pausen.length === 1 && aus(C).punkte.pausen[0].von === "2026-10-06" && aus(C).punkte.pausen[0].bis === undefined), "P5: Auf inaktiv setzen beginnt heute eine offene Pause", aus(C).punkte);
      let a = await lies(p);
      assert(a.filter.join() === "alle:true:4,aktiv:false:2,inaktiv:false:2" && a.liste.map((x) => x.name).join() === "Testperson A,Testperson B", "P5: Testperson C steht jetzt bei den Inaktiven", a);
      assert(/ab heute inaktiv/.test(await p.evaluate(() => document.querySelector("#gildeFlaeche .gl-meldung")?.textContent || "")), "P5: ein Satz sagt es");
      await p.click('[data-g="pUndo"]');
      assert(await bis(() => aus(C).punkte.pausen.length === 1 && aus(C).punkte.pausen[0].bis === "2026-10-06"), "P5: Rueckgaengig beendet die Pause am selben Tag, sie bleibt in der Datei", aus(C).punkte.pausen);
      a = await lies(p);
      assert(a.filter[1] === "aktiv:false:3", "P5: nach Rueckgaengig ist C wieder aktiv", a.filter);
      // wieder aktiv: Testperson D, inaktiv seit 01.10.
      await p.click('[data-g="pInaktiv"]');
      await p.click(`#gildePInaktiv [data-p-id="${D}"]`);
      await p.click('[data-g="pAktiv"]');
      assert(await bis(() => aus(D).punkte.pausen.length === 1 && aus(D).punkte.pausen[0].bis === "2026-10-06" && aus(D).punkte.pausen[0].von === "2026-10-01"), "P5: Wieder aktiv beendet die offene Pause heute, der Beginn bleibt", aus(D).punkte.pausen);
      await p.click('[data-g="pUndo"]');
      assert(await bis(() => aus(D).punkte.pausen[0].bis === undefined), "P5: Rueckgaengig macht die Pause wieder offen", aus(D).punkte.pausen);
      assert(s.posts.every((x) => x.put === "saved") && !s.fehler.length, "P5: die Datei nimmt alles an, keine Seitenfehler", { puts: s.posts.map((x) => x.put), fehler: s.fehler });
      await p.close();
    }
    // 6. Sonntagsrunde: ein Feld je Mitglied, leere bleiben, Enter springt weiter, Rückgängig löst die Einträge
    dateiSetzen(gp());
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "punkte");
      await p.click('[data-g="pSonntag"]');
      const so = await p.evaluate(() => ({ datum: document.querySelector("#gildePSonnDatum")?.value, felder: [...document.querySelectorAll("[data-p-sonn]")].map((x) => x.dataset.pSonn) }));
      assert(so.datum === "2026-10-04" && so.felder.length === 4, "P6: Datum ist der letzte Sonntag (04.10.2026), ein Feld je Mitglied", so);
      await p.fill(`[data-p-sonn="${A}"]`, "12000");
      await p.press(`[data-p-sonn="${A}"]`, "Enter");
      assert(await p.evaluate(() => document.activeElement?.dataset.pSonn) === so.felder[1], "P6: Enter springt zum naechsten Feld", await p.evaluate(() => document.activeElement?.dataset.pSonn));
      await p.fill(`[data-p-sonn="${B}"]`, "8000");
      await p.click('[data-g="pSonnAdd"]');
      assert(await bis(() => aus(A).punkte.ansehen.eintraege.length === 1 && aus(B).punkte.ansehen.eintraege.length === 1 && aus(C).punkte.ansehen.eintraege.length === 0), "P6: nur die gefuellten Felder werden Eintraege", [aus(A).punkte.ansehen, aus(B).punkte.ansehen]);
      assert(aus(A).punkte.ansehen.eintraege[0].datum === "2026-10-04" && aus(A).punkte.ansehen.eintraege[0].betrag === 12000 && aus(B).punkte.ansehen.eintraege[0].betrag === 8000, "P6: Datum und Betrag stimmen", aus(A).punkte.ansehen.eintraege);
      assert(/2 Eintr/.test(await p.evaluate(() => document.querySelector("#gildeFlaeche .gl-meldung")?.textContent || "")) && !(await p.evaluate(() => !!document.querySelector("#gildePSonntag"))), "P6: ein Satz nennt 2 Eintraege, das Feld schliesst sich");
      await p.click('[data-g="pUndo"]');
      assert(await bis(() => aus(A).punkte.ansehen.eintraege[0].geloest === true && aus(B).punkte.ansehen.eintraege[0].geloest === true) && aus(A).punkte.ansehen.eintraege.length === 1, "P6: Rueckgaengig loest beide Eintraege, sie bleiben in der Datei", [aus(A).punkte.ansehen, aus(B).punkte.ansehen]);
      assert(s.posts.every((x) => x.put === "saved") && !s.fehler.length, "P6: die Datei nimmt alles an, keine Seitenfehler", { puts: s.posts.map((x) => x.put), fehler: s.fehler });
      await p.close();
    }
    // 7. Regeln: Punkte je Monat, Teiler, Arten (eigene dazu, loesen, zurueck), Event zu Art, Rang und Gruppen mit Schwellen, Stichtag, Standard
    const raidEvent = { id: "rpunkt0001", titel: "Raid", start: "2026-09-30T20:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 120, erinnerungMin: 0, ausnahmen: {} };
    const NORM = "anorm00001";
    dateiSetzen(gp({ reihen: [raidEvent], anwesend: { "rpunkt0001|2026-09-30": { [A]: "da" } } }, { rang: false, gruppen: false, stichtag: "2026-09-01" }));
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "punkte");
      await p.click('[data-g="pRegeln"]');
      assert(await p.evaluate(() => !!document.querySelector("#gildePRegeln") && document.querySelector('[data-g="pRegeln"]').getAttribute("aria-expanded") === "true"), "P7: Regeln klappt auf");
      await aendere(p, "#gildePRMonat", 2);
      assert(await bis(() => datei().gilde.punkte.monat === 2), "P7: Punkte je Monat stehen in der Datei", datei().gilde.punkte);
      await aendere(p, "#gildePRTeiler", 50000);
      assert(await bis(() => datei().gilde.punkte.teiler === 50000), "P7: der Teiler beim Gildenansehen ist einstellbar");
      await aendere(p, "#gildePRTeiler", 0);
      assert(await bis(() => datei().gilde.punkte.teiler === 1), "P7: ein Teiler unter 1 wird 1", datei().gilde.punkte.teiler);
      // eine eigene Art
      await p.fill("#gildePNeuArt", "PvP-Event");
      await p.click('[data-g="pArtNeu"]');
      assert(await bis(() => datei().gilde.punkte.arten.length === 5), "P7: eine neue Art kommt dazu", datei().gilde.punkte.arten);
      const neu = datei().gilde.punkte.arten[4];
      assert(neu.name === "PvP-Event" && /^a[0-9a-z]{9}$/.test(neu.id) && neu.punkte === 1 && neu.proPunkt === 1, "P7: die neue Art hat Namen, eine ID mit a und 1 Punkt je Teilnahme", neu);
      await aendere(p, "#gildePArtPunkte-" + neu.id, 2);
      await aendere(p, "#gildePArtPro-" + neu.id, 3);
      assert(await bis(() => datei().gilde.punkte.arten[4].punkte === 2 && datei().gilde.punkte.arten[4].proPunkt === 3), "P7: Punkte und Teilnahmen je Satz der Art sind einstellbar", datei().gilde.punkte.arten[4]);
      await aendere(p, "#gildePArtPro-" + neu.id, 0);
      assert(await bis(() => datei().gilde.punkte.arten[4].proPunkt === 1), "P7: Teilnahmen je Satz unter 1 werden 1");
      await aendere(p, "#gildePArtName-" + neu.id, "Gildenevent");
      assert(await bis(() => datei().gilde.punkte.arten[4].name === "Gildenevent"), "P7: die Art laesst sich umbenennen");
      // Event zu Art: der Raid zaehlt als Raid Normal, Testperson A war am 30.09. da
      await p.selectOption("#gildePEvent-rpunkt0001", NORM);
      assert(await bis(() => datei().gilde.reihen[0].art === NORM) && await zeilenWert(p, "^Raid Normal") === "1", "P7: ein Event zaehlt fuer genau eine Art, der Raid bringt einen Punkt", { art: datei().gilde.reihen[0].art, z: await zeilenWert(p, "^Raid Normal") });
      await p.selectOption("#gildePEvent-rpunkt0001", "");
      assert(await bis(() => datei().gilde.reihen[0].art === undefined) && await zeilenWert(p, "^Raid Normal") === "0", "P7: zaehlt nicht: das Event bringt keine Punkte, die Art ist aus der Reihe", datei().gilde.reihen[0]);
      await p.selectOption("#gildePEvent-rpunkt0001", NORM);
      await bis(() => datei().gilde.reihen[0].art === NORM);
      // Art loesen: bleibt in der Datei, Rueckgaengig, Zurueck
      await p.click(`[data-g="pArtLoesen"][data-id="${NORM}"]`);
      assert(await bis(() => datei().gilde.punkte.arten.find((x) => x.id === NORM).geloest === true) && datei().gilde.punkte.arten.length === 5 && await zeilenWert(p, "^Raid Normal") === null,
        "P7: eine geloeste Art bleibt in der Datei und steht nicht mehr im Konto", datei().gilde.punkte.arten);
      await p.click('[data-g="pUndo"]');
      assert(await bis(() => datei().gilde.punkte.arten.find((x) => x.id === NORM).geloest !== true) && await zeilenWert(p, "^Raid Normal") === "1", "P7: Rueckgaengig holt die Art zurueck");
      await p.click(`[data-g="pArtLoesen"][data-id="${NORM}"]`);
      await p.click(`[data-g="pArtZurueck"][data-id="${NORM}"]`);
      assert(await bis(() => datei().gilde.punkte.arten.find((x) => x.id === NORM).geloest !== true), "P7: unter Geloest holt Zurueck die Art wieder");
      // Rang und Gruppen gibt es in der Oberflaeche nicht mehr: keine Schalter, keine Rang- und Gruppenzeichen
      assert(!(await p.$("#gildePRang")) && !(await p.$("#gildePGruppen")) && !(await p.$("#gildePRSpitze")), "P7: keine Schalter fuer Rang und Gruppen mehr");
      assert(await p.evaluate(() => !document.querySelector("#gildePListe .gl-p-rang, #gildePListe .gl-p-gruppe")), "P7: in der Liste weder Rang noch Gruppe");
      // Stichtag
      await aendere(p, "#gildePRStichtag", "2026-09-15");
      assert(await bis(() => datei().gilde.punkte.stichtag === "2026-09-15"), "P7: der Stichtag ist einstellbar", datei().gilde.punkte.stichtag);
      // Standard wiederherstellen: Monat, Teiler, Schwellen, die vier Standardarten; eigene Arten bleiben
      await p.click('[data-g="pStandard"]');
      assert(await bis(() => { const r = datei().gilde.punkte; return r.monat === 1 && r.teiler === 100000 && r.schwellen.join() === "80,60" && r.arten.length === 5 && r.arten[0].proPunkt === 7 && r.arten[0].geloest !== true; }), "P7: Standard wiederherstellen setzt Regeln und Standardarten zurueck, eigene Arten bleiben", datei().gilde.punkte);
      assert(s.posts.every((x) => x.put === "saved") && !s.fehler.length, "P7: die Datei nimmt alles an, keine Seitenfehler", { puts: s.posts.map((x) => x.put), fehler: s.fehler });
      await p.close();
    }
    // 8. Aus einer Tabelle einlesen: Startstaende, seit, offene Pause; Rueckgaengig
    dateiSetzen(gp());
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "punkte");
      await p.click('[data-g="pEinlesen"]');
      await p.fill("#gildePEinlesenText", ["Testperson A\t01.02.2026\t\t14\t3\t2\t1\t250000", "Unbekannt\t\t\t1", "Testperson B\t15.03.2026\tja\t7\t0\t0\t0\t5", "", "kaputt"].join("\n"));
      await p.click('[data-g="pUebernehmen"]');
      assert(await bis(() => aus(A).punkte.seit === "2026-02-01" && aus(A).punkte.start.aboss00001 === 98), "P8: Startstaende und seit stehen in der Datei (14 Bosse-Punkte sind 98 Teilnahmen)", aus(A).punkte);
      const pa = aus(A).punkte;
      assert(pa.start.anorm00001 === 3 && pa.start.aschw00001 === 2 && pa.start.aalpt00001 === 1 && pa.ansehen.start === 250000, "P8: Raids und Ansehen uebernommen", pa);
      assert(aus(B).punkte.seit === "2026-03-15" && aus(B).punkte.pausen.some((x) => x.bis === undefined), "P8: ja in der Spalte Pause setzt eine offene Pause", aus(B).punkte);
      assert(/2 von 4 Zeilen/.test(await p.evaluate(() => document.querySelector("#gildePEinlesenSatz")?.textContent || "")) && /2 Namen nicht/.test(await p.evaluate(() => document.querySelector("#gildePEinlesenSatz")?.textContent || "")),
        "P8: ein Satz nennt die uebernommenen Zeilen und die unbekannten Namen", await p.evaluate(() => document.querySelector("#gildePEinlesenSatz")?.textContent));
      await p.click('[data-g="pUndo"]');
      assert(await bis(() => aus(A).punkte.seit === "2026-10-06" && (aus(A).punkte.start.aboss00001 ?? 0) === 0 && aus(A).punkte.ansehen.start === 0 && aus(B).punkte.pausen.every((x) => x.bis !== undefined)),
        "P8: Rueckgaengig stellt seit, Startstaende und Pause wieder her, nichts wird entfernt", { a: aus(A).punkte, b: aus(B).punkte });
      assert(s.posts.every((x) => x.put === "saved") && !s.fehler.length, "P8: die Datei nimmt alles an, keine Seitenfehler", { puts: s.posts.map((x) => x.put), fehler: s.fehler });
      await p.close();
    }
    // 9. Als Text kopieren: genau punkteText in der Seitensprache
    dateiSetzen(gp({}, { rang: true, gruppen: true }));
    {
      const KLIP = () => { window.__text = null; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (x) => { window.__text = x; } } }); };
      const s = await oeffne({ uhr: UHR, init: KLIP });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "punkte");
      await p.click('[data-g="pText"]');
      const g = datei().gilde;
      const soll = pkern.punkteText(pkern.rangliste(g, "2026-10-06T10:00"), g, { kopf: I18N.de["gilde.punkte.textKopf"], inaktiv: I18N.de["gilde.punkte.inaktivKurz"],
        zahl: (n) => String(n).replace(".", ","), gruppe: (x) => I18N.de["gilde.punkte.gruppe." + x] });
      assert(await bis(() => p.evaluate(() => window.__text !== null)) && await p.evaluate(() => window.__text) === soll, "P9: Als Text kopieren gibt genau punkteText (Rang, Gruppe, Inaktive am Ende)", { text: await p.evaluate(() => window.__text), soll });
      assert(/Kopiert/.test(await p.evaluate(() => document.querySelector("#gildeStatus").textContent)), "P9: #gildeStatus sagt Kopiert", await p.evaluate(() => document.querySelector("#gildeStatus").textContent));
      assert(!s.fehler.length, "P9: keine Seitenfehler", s.fehler);
      await p.close();
    }
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ Termine: Zaehler, Inaktive, Events aufklappbar, Datumssuche, kompakte Zeilen (Spezifikation Gilde-Punkte 4)
  {
    const vorher = datei().gilde;
    const ARTEN = [{ id: "aboss00001", name: "Gildenboss", punkte: 1, proPunkt: 7 }, { id: "anorm00001", name: "Raid Normal", punkte: 1, proPunkt: 1 }];
    const Z = { A: "mzaehl0001", B: "mzaehl0002", C: "mzaehl0003", D: "mzaehl0004" }, RB = "rzaehl0001", RR = "rzaehl0002";
    const ev = (id, titel, start, art) => ({ id, titel, start, zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 120, erinnerungMin: 0, ausnahmen: {}, art });
    const mem = (id, name, punkte) => ({ id, name, rolle: "dps", waffen: [], notiz: "", ...(punkte ? { punkte } : {}) });
    const gz = (mehr = {}) => ({ id: "gzaehl0001", name: "Testgilde",
      mitglieder: [mem(Z.A, "Testperson A"), mem(Z.B, "Testperson B"), mem(Z.C, "Testperson C"),
        mem(Z.D, "Testperson D", { seit: "2026-03-01", pausen: [{ von: "2026-09-20" }], start: {}, ansehen: { start: 0, eintraege: [] }, zusatz: [] })],
      reihen: [ev(RB, "Gildenboss", "2026-03-04T20:00", "aboss00001"), ev(RR, "Raid", "2026-09-11T20:00", "anorm00001")], anwesend: {},
      punkte: { an: true, rang: false, gruppen: false, schwellen: [80, 60], monat: 1, teiler: 100000, stichtag: "2026-03-01", arten: ARTEN }, ...mehr });
    const oeffneTermin = async (p, rid, tag) => {
      if (await p.evaluate((r) => document.querySelector(`[data-g="reiheZu"][data-r-id="${r}"]`)?.getAttribute("aria-expanded") === "false", rid)) await p.click(`[data-g="reiheZu"][data-r-id="${rid}"]`);
      await p.click(`#gildeFlaeche .gl-term[data-termin="${rid}|${tag}"]`);
    };
    const namenIm = (p) => p.evaluate(() => [...document.querySelectorAll("#gildeTermin .gl-anw .gl-name")].map((x) => x.textContent.trim()));
    // 1. Zaehler statt Haken bei einem Event, dessen Art mehr als eine Teilnahme je Punkt hat
    dateiSetzen(gz());
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await oeffneTermin(p, RB, "2026-09-30");
      const a = await p.evaluate(() => ({ zaehler: [...document.querySelectorAll("#gildeTermin [data-z-id]")].filter((x) => x.tagName === "INPUT").map((x) => x.dataset.zId),
        marken: document.querySelectorAll("#gildeTermin .gl-marken").length, alleN: document.querySelector('#gildeTermin [data-g="alleN"]')?.textContent.trim() || "", alleDa: !!document.querySelector('#gildeTermin [data-g="alleDa"]'),
        von: document.querySelector("#gildeTermin .gl-zvon")?.textContent.trim() }));
      assert(a.zaehler.join() === `${Z.A},${Z.B},${Z.C}` && a.marken === 0 && a.alleDa === false && /7/.test(a.alleN) && a.von === "/7",
        "T8: der Gildenboss hat je Mitglied einen Zaehler 0 bis 7 statt der Marken, \"Alle 7\" statt \"Alle da\"; der Inaktive (seit 20.09.) fehlt", a);
      const feld = (id) => `#gildeTermin input[data-z-id="${id}"]`;
      await p.fill(feld(Z.A), "5");
      await p.press(feld(Z.A), "Enter");
      assert(await bis(() => datei().gilde.zaehler?.[`${RB}|2026-09-30`]?.[Z.A] === 5), "T8: der Zaehler steht in der Datei (5)", datei().gilde.zaehler);
      assert(await p.evaluate(() => document.activeElement?.dataset.zId) === Z.B, "T8: Enter springt zum Zaehler des naechsten Mitglieds", await p.evaluate(() => document.activeElement?.dataset.zId));
      await p.click(`#gildeTermin [data-g="zMinus"][data-z-id="${Z.A}"]`);
      assert(await bis(() => datei().gilde.zaehler[`${RB}|2026-09-30`][Z.A] === 4), "T8: Minus zaehlt einen herunter");
      await p.click(`#gildeTermin [data-g="zPlus"][data-z-id="${Z.A}"]`);
      assert(await bis(() => datei().gilde.zaehler[`${RB}|2026-09-30`][Z.A] === 5), "T8: Plus zaehlt einen hoch");
      await p.fill(feld(Z.A), "12"); await p.locator(feld(Z.A)).blur();
      assert(await bis(() => datei().gilde.zaehler[`${RB}|2026-09-30`][Z.A] === 7) && await p.inputValue(feld(Z.A)) === "7", "T8: ein Wert ueber 7 wird auf 7 gekuerzt");
      await p.fill(feld(Z.A), "5"); await p.locator(feld(Z.A)).blur();
      await bis(() => datei().gilde.zaehler[`${RB}|2026-09-30`][Z.A] === 5);
      await p.click('#gildeTermin [data-g="alleN"]');
      assert(await bis(() => { const z = datei().gilde.zaehler[`${RB}|2026-09-30`]; return z[Z.A] === 5 && z[Z.B] === 7 && z[Z.C] === 7 && !(Z.D in z); }), "T8: Alle 7 fuellt nur Mitglieder ohne Eintrag, ein gesetzter Zaehler bleibt, der Inaktive nicht", datei().gilde.zaehler);
      const stand = (await terme(p)).find((x) => x.d === "2026-09-30")?.stand;
      assert(/3\/3/.test(stand || ""), "T8: die Liste zaehlt die Zaehler als abgehakt (3/3)", stand);
      // der Kern rechnet damit: 5 Teilnahmen am Gildenboss
      const k = pkern.rangliste(datei().gilde, "2026-10-06T10:00").find((x) => x.m.id === Z.A);
      assert(k.zaehl.aboss00001 === 5 && Math.round(k.pkt.aboss00001 * 1e6) / 1e6 === 0.714286, "T8: die Punkte rechnen mit dem Zaehler (5 von 7 sind 0,714286)", k.zaehl);
      // ein Event mit einer Art ohne Mehrfachzaehlung behaelt die Marken
      await oeffneTermin(p, RR, "2026-10-02");
      const r = await gruppen(p);
      assert(r.length === 3 && r.every((x) => x.radios.map((y) => y.k).join() === "da,fehlt"), "T8: der Raid hat weiter die Marken da und nicht da", r.map((x) => x.radios.length));
      assert(s.posts.every((x) => x.put === "saved") && !s.fehler.length, "T8: die Datei nimmt alles an, keine Seitenfehler", { puts: s.posts.map((x) => x.put), fehler: s.fehler });
      await p.close();
    }
    // 2. Inaktive stehen ab dem Tag ihrer Pause nicht in der Liste; ihre Haken davor bleiben
    dateiSetzen(gz({ anwesend: { [`${RR}|2026-09-18`]: { [Z.A]: "da", [Z.D]: "da" } } }));
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await oeffneTermin(p, RR, "2026-09-18");
      assert((await namenIm(p)).sort().join() === "Testperson A,Testperson B,Testperson C,Testperson D", "T8: vor der Pause (18.09.) steht Testperson D noch in der Liste", await namenIm(p));
      await oeffneTermin(p, RR, "2026-10-02");
      assert((await namenIm(p)).sort().join() === "Testperson A,Testperson B,Testperson C", "T8: ab der Pause (02.10.) steht Testperson D nicht mehr in der Liste", await namenIm(p));
      assert(datei().gilde.anwesend[`${RR}|2026-09-18`][Z.D] === "da", "T8: ihr Haken vom 18.09. bleibt in der Datei");
      await p.close();
    }
    // 3. Events aufklappbar, mit eigenem Scroll; anfangs nur das Event des gewaehlten Termins offen
    dateiSetzen(gz());
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      const zu = () => p.evaluate(() => [...document.querySelectorAll('#gildeFlaeche [data-g="reiheZu"]')].map((b) => b.dataset.rId + ":" + b.getAttribute("aria-expanded") + ":" + (document.getElementById(b.getAttribute("aria-controls") || "") ? "liste" : "-")));
      assert((await zu()).join() === `${RB}:false:-,${RR}:true:liste`, "T8: anfangs ist nur das Event des gewaehlten Termins (Raid, 02.10.) offen, das andere hat keine Liste", await zu());
      await p.click(`[data-g="reiheZu"][data-r-id="${RB}"]`);
      assert((await zu()).join() === `${RB}:true:liste,${RR}:true:liste`, "T8: ein Klick klappt das Event auf", await zu());
      const m = await p.evaluate((r) => { const u = document.querySelector(`#gildeRL-${r}`); const c = getComputedStyle(u); return { oy: c.overflowY, h: u.clientHeight, sh: u.scrollHeight }; }, RB);
      assert(["auto", "scroll"].includes(m.oy) && m.h <= 340 && m.sh > m.h, "T8: die Termine rollen in einem eigenen Bereich (hoechstens 340 px hoch)", m);
      await p.focus(`[data-g="reiheZu"][data-r-id="${RB}"]`);
      await p.keyboard.press("Enter");
      assert((await zu())[0] === `${RB}:false:-`, "T8: Enter am Pfeil klappt es wieder zu (Tastatur)", await zu());
      assert(!s.fehler.length && s.posts.length === 0, "T8: keine Seitenfehler, nichts gesendet", { fehler: s.fehler, posts: s.posts.length });
      await p.close();
    }
    // 4. Datum suchen
    dateiSetzen(gz());
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      const sucheAus = () => p.evaluate(() => ({ satz: document.querySelector("#gildeDSatz")?.textContent.trim() || "", treffer: [...document.querySelectorAll(".gl-dtreffer li")].map((l) => l.textContent.replace(/\s+/g, " ").trim()),
        events: document.querySelectorAll("#gildeFlaeche .gl-reihe").length }));
      await p.fill("#gildeDSuche", "30.09.2026");
      let a = await sucheAus();
      assert(/Am 30\.09\.2026 fand 1 Event statt/.test(a.satz) && a.treffer.length === 1 && /Gildenboss/.test(a.treffer[0]) && /20:00/.test(a.treffer[0]), "T8: Datum suchen: ein Event am 30.09.2026, mit Uhrzeit", a);
      assert(a.events === 0, "T8: waehrend der Suche stehen nur die Treffer da", a.events);
      await p.fill("#gildeDSuche", "29.09.2026");
      a = await sucheAus();
      assert(/fand kein Event statt/.test(a.satz) && a.treffer.length === 0, "T8: ein Tag ohne Event sagt es", a);
      await p.fill("#gildeDSuche", "31.02.2026");
      a = await sucheAus();
      assert(/Tippe ein Datum/.test(a.satz) && a.events === 2, "T8: ein Datum, das es nicht gibt, sagt es und aendert nichts (beide Events stehen da)", a);
      await p.fill("#gildeDSuche", "2026-10-02");
      a = await sucheAus();
      assert(a.treffer.length === 1 && /Raid/.test(a.treffer[0]), "T8: auch JJJJ-MM-TT geht", a);
      await p.fill("#gildeDSuche", "07.10.");
      a = await sucheAus();
      assert(/findet 1 Event statt/.test(a.satz) && /Gildenboss/.test(a.treffer[0] || ""), "T8: ohne Jahr gilt das laufende; ein kommender Tag sagt findet statt", a);
      // oeffnen: auch weit zurueck (ueber die zwoelf Wochen der Liste hinaus)
      await p.fill("#gildeDSuche", "01.04.2026");
      await p.click(".gl-dtreffer [data-g=\"dOeffnen\"]");
      assert(await warte(p, () => /01\.04\.2026/.test(document.querySelector("#gildeTerminT")?.textContent || "") && /Gildenboss/.test(document.querySelector("#gildeTerminT")?.textContent || "")), "T8: Oeffnen waehlt einen Termin weit zurueck (01.04.2026)", await p.evaluate(() => document.querySelector("#gildeTerminT")?.textContent));
      assert(await p.inputValue("#gildeDSuche") === "" && (await p.evaluate(() => document.querySelectorAll("#gildeFlaeche .gl-reihe").length)) === 2, "T8: danach ist die Suche leer und die Events stehen wieder da");
      // und weit voraus
      await p.fill("#gildeDSuche", "2026-12-02");
      await p.click(".gl-dtreffer [data-g=\"dOeffnen\"]");
      assert(await warte(p, () => /02\.12\.2026/.test(document.querySelector("#gildeTerminT")?.textContent || "")), "T8: Oeffnen waehlt auch einen Termin weit voraus (02.12.2026)", await p.evaluate(() => document.querySelector("#gildeTerminT")?.textContent));
      await p.fill("#gildeDSuche", "30.09.2026");
      await p.click('[data-g="dNull"]');
      assert(await p.inputValue("#gildeDSuche") === "" && (await sucheAus()).events === 2, "T8: Zuruecksetzen leert die Suche");
      assert(!s.fehler.length && s.posts.length === 0, "T8: keine Seitenfehler, nichts gesendet", { fehler: s.fehler, posts: s.posts.length });
      await p.close();
    }
    // 5. Kompakte Zeilen: 50 Mitglieder, eine Zeile je Mitglied
    {
      const viele = fuenfzig();
      dateiSetzen({ id: "gzaehl0001", name: "Testgilde", mitglieder: viele, reihen: [ev(RR, "Raid", "2026-09-11T20:00", undefined)], anwesend: { [`${RR}|2026-10-02`]: Object.fromEntries(viele.map((x) => [x.id, "da"])) } });
      for (const [breite, hoehe] of [[2000, 1480], [560, 900]]) {
        const s = await oeffne({ uhr: UHR, breite, hoehe });
        const p = s.page;
        await gildeAuf(p);
        await p.click('#gildeFlaeche .gl-term[data-termin="' + RR + '|2026-10-02"]');
        const m = await p.evaluate(() => { const z = [...document.querySelectorAll("#gildeTermin .gl-anw")].map((x) => Math.round(x.getBoundingClientRect().height));
          const sp = document.querySelector("#gildeTermin .gl-spalten"); return { n: z.length, max: Math.max(...z), min: Math.min(...z), spalten: sp ? Math.round(sp.getBoundingClientRect().height) : 0, quer: document.documentElement.scrollWidth > innerWidth }; });
        assert(m.n === 50 && m.max <= 60 && m.min >= 30 && !m.quer, `T8: ${breite} px: 50 Mitglieder, jede Zeile hoechstens 60 px hoch, kein waagerechtes Rollen`, m);
        if (breite === 2000) assert(m.spalten < 1000, "T8: 2000 x 1480: alle 50 stehen in unter 1000 px Hoehe", m.spalten);
        assert(!s.fehler.length, `T8: ${breite}: keine Seitenfehler`, s.fehler);
        await p.close();
      }
    }
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ Mitglieder: Heiler als Schaden, Offspec, keine Rollen-Zeichen, Austritt und Ehemalige (Spezifikation Gilde-Punkte 4)
  {
    const vorher = datei().gilde;
    const M = { S: "mmitg00001", T: "mmitg00002", B: "mmitg00003", O: "mmitg00004" };
    const gm = () => ({ id: "gmitg00001", name: "Testgilde", reihen: [], anwesend: {}, mitglieder: [
      { id: M.S, name: "Testperson Sucher", rolle: "", waffen: ["Longbow", "Wand and Tome"], notiz: "" },
      { id: M.T, name: "Testperson Tank", rolle: "", waffen: ["Greatsword", "Sword and Shield"], notiz: "" },
      { id: M.B, name: "Testperson Beschwoerer", rolle: "", waffen: ["Staff", "Wand and Tome"], notiz: "" },
      { id: M.O, name: "Testperson Ohne", rolle: "dps", waffen: [], notiz: "" }] });
    const mm = (id) => datei().gilde.mitglieder.find((x) => x.id === id);
    const spaltenNamen = (p) => p.evaluate(() => Object.fromEntries([...document.querySelectorAll("#gildeFlaeche .gl-spalte")].map((s) => [s.querySelector("h3").textContent.replace(/[\d/]+$/, "").trim(), [...s.querySelectorAll(".gl-kachel .gl-name")].map((x) => x.textContent.trim())])));
    const kachel = (id) => `#gildeFlaeche .gl-kachel[data-m-id="${id}"]`;
    // 1. Heiler als Schaden: ein Haekchen bei jedem Heiler, nicht bei Tank oder ohne Paar
    dateiSetzen(gm());
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "mitglieder");
      let sp = await spaltenNamen(p);
      assert(sp.Heiler.includes("Testperson Sucher") && sp.Heiler.includes("Testperson Beschwoerer") && sp.Tank.join() === "Testperson Tank", "M1: ohne Haekchen stehen die Heiler bei den Heilern", sp);
      await p.click(kachel(M.T));
      assert(await p.evaluate(() => !document.querySelector("#gildeEAlsDps")), "M1: bei einem Tank gibt es kein Haekchen");
      await p.click(kachel(M.O));
      assert(await p.evaluate(() => !document.querySelector("#gildeEAlsDps")), "M1: ohne Waffenpaar gibt es kein Haekchen");
      await p.click(kachel(M.S));
      const hk = await p.evaluate(() => ({ da: !!document.querySelector("#gildeEAlsDps"), an: document.querySelector("#gildeEAlsDps")?.checked, text: document.querySelector("#gildeEAlsDps")?.closest("label")?.textContent.trim() }));
      assert(hk.da && hk.an === false && /Schaden/.test(hk.text) && !/Ventius/i.test(hk.text), "M1: bei einem Heiler steht \"Zaehlt auch als Schaden (DPS)\", ohne den Grund zu nennen", hk);
      await p.check("#gildeEAlsDps");
      assert(await bis(() => mm(M.S).alsDps === true), "M1: das Haekchen steht in der Datei", mm(M.S));
      sp = await spaltenNamen(p);
      assert(sp.Schaden.includes("Testperson Sucher") && !sp.Heiler.includes("Testperson Sucher"), "M1: mit Haekchen steht der Heiler in der Spalte Schaden", sp);
      const dps = await p.evaluate(() => document.querySelector('#gildeRollen [data-rolle="dps"] em')?.textContent.trim());
      assert(dps === "2", "M1: der Filter Schaden zaehlt ihn mit (2 mit dem ohne Paar)", dps);
      await p.uncheck("#gildeEAlsDps");
      assert(await bis(() => mm(M.S).alsDps === false), "M1: ohne Haekchen ist er wieder Heiler (die Datei haelt false)");
      sp = await spaltenNamen(p);
      assert(sp.Heiler.includes("Testperson Sucher"), "M1: wieder bei den Heilern", sp);
      await p.click(kachel(M.B));
      assert(await p.evaluate(() => !!document.querySelector("#gildeEAlsDps")), "M1: jeder Heiler hat das Haekchen, nicht nur der Sucher");
      assert(s.posts.every((x) => x.put === "saved") && !s.fehler.length, "M1: die Datei nimmt alles an, keine Seitenfehler", { puts: s.posts.map((x) => x.put), fehler: s.fehler });
      await p.close();
    }
    // 2. Offspec: ein zweites Waffenpaar, die Klasse als Wort, auf der Kachel, in der Suche
    dateiSetzen(gm());
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "mitglieder");
      await p.click(kachel(M.S));
      assert(await p.evaluate(() => !!document.querySelector("#gildeEOff")), "M2: das Feld Offspec ist da (aufklappbar)");
      await p.click("#gildeEOff summary");
      await p.click('#gildeEOff .gl-wb[data-nr="o1"] [data-w="Dagger"]');
      assert(!mm(M.S).offspec, "M2: mit einer Waffe allein wird nichts gespeichert");
      await p.click('#gildeEOff .gl-wb[data-nr="o2"] [data-w="Crossbow"]');
      assert(await bis(() => JSON.stringify(mm(M.S).offspec) === '["Dagger","Crossbow"]'), "M2: zwei Waffen sind der Offspec in der Datei", mm(M.S));
      const erg = await p.evaluate(() => document.querySelector("#gildeEOff .gl-ergebnis")?.textContent.replace(/\s+/g, " ").trim());
      assert(/Skorpion/.test(erg || "") && /Schaden/.test(erg || ""), "M2: darunter steht die Klasse des Offspecs (Skorpion, Schaden)", erg);
      const rolle = (await spaltenNamen(p)).Heiler.includes("Testperson Sucher");
      assert(rolle, "M2: der Offspec aendert die Rolle nicht (er bleibt Heiler)");
      await p.click('#gildeEdit [data-g="fertig"]');
      const tag = await p.evaluate((sel) => document.querySelector(sel + " .gl-offtag")?.textContent.trim(), kachel(M.S));
      assert(tag === "Offspec Skorpion", "M2: auf der Kachel steht Offspec Skorpion", tag);
      await p.fill("#gildeSuche", "skorpion");
      assert((await blick(p)).kacheln.map((k) => k.id).join() === M.S, "M2: die Suche findet den Offspec", (await blick(p)).kacheln);
      await p.fill("#gildeSuche", "");
      await p.click(kachel(M.S));
      await p.click('#gildeEOff [data-g="offAus"]');
      assert(await bis(() => mm(M.S).offspec === undefined), "M2: Offspec entfernen nimmt nur das Paar weg, das Mitglied bleibt", mm(M.S));
      assert(s.posts.every((x) => x.put === "saved") && !s.fehler.length, "M2: die Datei nimmt alles an, keine Seitenfehler", { puts: s.posts.map((x) => x.put), fehler: s.fehler });
      await p.close();
    }
    // 3. Keine Rollen-Zeichen bei den Klassennamen (Mitglieder, Termine, Auswertung), nur der Klassenname
    dateiSetzen({ ...gm(), reihen: [{ id: "rmitg00001", titel: "Raid", start: "2026-10-04T20:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 120, erinnerungMin: 0, ausnahmen: {} }],
      anwesend: { "rmitg00001|2026-10-04": { [M.S]: "da", [M.T]: "da" } } });
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await p.click('#gildeFlaeche .gl-term[data-datum="2026-10-04"]');
      const zeichenT = await p.evaluate(() => ({ svg: document.querySelectorAll("#gildeFlaeche .gl-klasse svg").length, n: document.querySelectorAll("#gildeFlaeche .gl-klasse").length, text: [...document.querySelectorAll("#gildeFlaeche .gl-anw .gl-klasse")].map((x) => x.textContent.trim()) }));
      assert(zeichenT.svg === 0 && zeichenT.n === 4 && zeichenT.text.includes("Kreuzritter"), "M3: Termine: bei den Klassennamen steht kein Rollen-Zeichen, nur der Klassenname", zeichenT);
      await reiter(p, "mitglieder");
      const zeichenM = await p.evaluate(() => ({ svg: document.querySelectorAll("#gildeFlaeche .gl-klasse svg").length, text: [...document.querySelectorAll("#gildeFlaeche .gl-kachel .gl-klasse")].map((x) => x.textContent.trim()) }));
      assert(zeichenM.svg === 0 && zeichenM.text.includes("Sucher") && zeichenM.text.includes("Schaden"), "M3: Mitglieder: kein Rollen-Zeichen; ohne Paar steht die Rolle als Wort", zeichenM);
      await reiter(p, "auswertung");
      const zeichenA = await p.evaluate(() => ({ svg: document.querySelectorAll("#gildeFlaeche .gl-klasse svg").length, n: document.querySelectorAll("#gildeFlaeche .gl-klasse").length }));
      assert(zeichenA.svg === 0 && zeichenA.n > 0, "M3: Auswertung: kein Rollen-Zeichen bei den Klassennamen", zeichenA);
      // die Spaltenueberschriften behalten ihre Zeichen
      await reiter(p, "mitglieder");
      assert(await p.evaluate(() => document.querySelectorAll("#gildeFlaeche .gl-spalte h3 svg").length) === 3, "M3: die Spaltenueberschriften Tank, Heiler, Schaden behalten ihr Zeichen");
      assert(!s.fehler.length, "M3: keine Seitenfehler", s.fehler);
      await p.close();
    }
    // 4. Austritt statt Loesen: erst die Frage, dann ausgetreten; Ehemalige mit Zurueckholen; nichts wird geloescht
    dateiSetzen(gm());
    {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "mitglieder");
      await p.click(kachel(M.T));
      await p.click('#gildeEdit [data-g="loesen"]');
      const f = await p.evaluate(() => ({ text: document.querySelector("#gildeEdit .gl-frage")?.textContent.replace(/\s+/g, " ").trim(), fokus: document.activeElement?.dataset.g }));
      assert(/Testperson Tank/.test(f.text || "") && /ausgetreten/.test(f.text || "") && f.fokus === "austrJa", "M4: Loesen fragt, ob das Mitglied ausgetreten ist; der Fokus steht auf der Antwort Ja", f);
      await p.click('#gildeEdit [data-g="austrNein"]');
      assert(await p.evaluate(() => !document.querySelector("#gildeEdit .gl-frage") && !!document.querySelector('#gildeEdit [data-g="loesen"]')) && !mm(M.T).geloest, "M4: Abbrechen aendert nichts und bringt die Knoepfe zurueck");
      await p.click('#gildeEdit [data-g="loesen"]');
      await p.click('#gildeEdit [data-g="austrJa"]');
      assert(await bis(() => mm(M.T).geloest === true && mm(M.T).ausgetreten === "2026-10-06"), "M4: Ja loest das Mitglied und schreibt das Austrittsdatum (06.10.2026)", mm(M.T));
      assert(await p.evaluate((sel) => !document.querySelector(sel), kachel(M.T)), "M4: es verschwindet aus der Liste");
      const eh = await p.evaluate(() => ({ summary: document.querySelector(".gl-ehem summary")?.textContent.replace(/\s+/g, " ").trim() }));
      assert(/Ehemalige 1/.test(eh.summary || ""), "M4: unter den Mitgliedern steht Ehemalige 1", eh);
      await p.click(".gl-ehem summary");
      const li = await p.evaluate(() => [...document.querySelectorAll(".gl-ehem li")].map((x) => x.textContent.replace(/\s+/g, " ").trim()));
      assert(li.length === 1 && /Testperson Tank/.test(li[0]) && /ausgetreten 06\.10\./.test(li[0]), "M4: die Ehemaligen stehen aufklappbar mit Namen und Datum", li);
      assert(mm(M.T).waffen.length === 2, "M4: nichts geht verloren, die Waffen stehen weiter in der Datei", mm(M.T));
      await p.click(`.gl-ehem [data-g="ehemZurueck"][data-m-id="${M.T}"]`);
      assert(await bis(() => mm(M.T).geloest === undefined && mm(M.T).ausgetreten === undefined), "M4: Zurueckholen nimmt geloest und ausgetreten weg", mm(M.T));
      assert(await p.evaluate((sel) => !!document.querySelector(sel), kachel(M.T)) && await p.evaluate(() => !document.querySelector(".gl-ehem")), "M4: das Mitglied steht wieder in der Liste, Ehemalige ist weg");
      // das Rueckgaengig der Seite holt es auch zurueck und nimmt das Austrittsdatum mit
      await p.click(kachel(M.B));
      await p.click('#gildeEdit [data-g="loesen"]');
      await p.click('#gildeEdit [data-g="austrJa"]');
      await bis(() => mm(M.B).geloest === true);
      await p.click('[data-g="undo"]');
      assert(await bis(() => mm(M.B).geloest === undefined && mm(M.B).ausgetreten === undefined), "M4: Rueckgaengig nach dem Austritt stellt das Mitglied her", mm(M.B));
      assert(s.posts.every((x) => x.put === "saved") && !s.fehler.length, "M4: die Datei nimmt alles an, keine Seitenfehler", { puts: s.posts.map((x) => x.put), fehler: s.fehler });
      await p.close();
    }
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ Vor dem ersten Lesen schreibt die Seite nie
  {
    let auf;
    const tor = new Promise((r) => { auf = r; });
    const s = await oeffne({ tor });
    const p = s.page;
    await gildeAuf(p);
    const vorher = await p.evaluate(() => ({ satz: document.querySelector("#gildeFlaeche").textContent.trim(),
      felder: document.querySelectorAll("#gildeFlaeche input, #gildeFlaeche button, #gildeFilter:not([hidden]) input").length }));
    // was die Hand vor dem Lesen versucht: Tasten im Bereich, ein Klick auf die Flaeche
    await p.click("#gildeFlaeche").catch(() => {});
    await p.keyboard.type("Testgilde");
    await p.keyboard.press("Enter");
    await p.waitForTimeout(700);
    const posts0 = s.posts.length;
    auf();
    assert(await warte(p, () => document.querySelectorAll("#gildeTabs [role=tab]").length === 4), "Laden: nach dem Lesen stehen die Reiter");
    await p.waitForTimeout(700);
    assert(/Lese die Gilde/.test(vorher.satz) && vorher.felder === 0 && posts0 === 0 && s.posts.length === 0,
      "Laden: vor dem ersten Lesen keine Felder und kein POST, auch nicht danach von selbst", { vorher, posts0, posts: s.posts.length });
    await p.close();
  }
  // ------------------------------------------------------------ 503 beim Lesen: gesperrt, kein Schreiben, ein zweiter Versuch nach 5 s
  {
    const s = await oeffne({ uhr: UHR, stoer: { get: 1, post: 0 } });
    const p = s.page;
    await gildeAuf(p);
    assert(await warte(p, () => /nicht lesbar/.test(document.querySelector("#gildeFlaeche").textContent)) && s.gets === 1 && !s.posts.length,
      "503 beim Lesen: der Satz \u201enicht lesbar\u201c, keine Felder, kein POST", { gets: s.gets, posts: s.posts.length });
    await p.clock.runFor(5100);
    assert(await bis(() => s.gets === 2) && await warte(p, () => document.querySelectorAll("#gildeTabs [role=tab]").length === 4) && !s.posts.length,
      "503 beim Lesen: nach 5 s liest die Seite noch einmal, dann stehen die Reiter, geschrieben wird nichts", { gets: s.gets, posts: s.posts.length });
    await p.close();
  }
  // ------------------------------------------------------------ 503 beim Schreiben: der Satz "spaeter", ein neuer Versuch nach 5 s
  {
    const s = await oeffne({ uhr: UHR, stoer: { get: 0, post: 1 } });
    const p = s.page;
    await gildeAuf(p);
    await reiter(p, "mitglieder");
    const id = datei().gilde.mitglieder.find((m) => !m.geloest).id;
    await p.click(`#gildeFlaeche .gl-kachel[data-m-id="${id}"]`);
    await p.fill("#gildeENotiz", "nach 503");
    assert(await bis(() => s.posts.length === 1) && await warte(p, () => /Gerade nicht gespeichert/.test(document.querySelector("#gildeStatus").textContent)),
      "503 beim Schreiben: der Satz \u201eGerade nicht gespeichert\u201c", { posts: s.posts.length });
    await p.clock.runFor(5100);
    assert(await bis(() => s.posts.length === 2 && datei().gilde.mitglieder.find((m) => m.id === id)?.notiz === "nach 503")
      && await warte(p, () => document.querySelector("#gildeStatus").textContent === ""),
      "503 beim Schreiben: nach 5 s ein neuer Versuch, der Stand liegt in der Datei, der Satz geht", { posts: s.posts.length });
    await p.close();
  }
  // ------------------------------------------------------------ Beim Schliessen: ein Stand ueber 64 KiB geht ohne keepalive (Chromium lehnt ihn sonst ab)
  {
    const vorher = datei().gilde;
    const viele = fuenfzig().map((m) => ({ ...m, notiz: "N".repeat(120) }));
    const rid = "rgross0001", anwesend = {};
    for (let i = 0; i < 70; i++) {
      const d = new Date(Date.UTC(2025, 0, 5) + i * 7 * 86400000).toISOString().slice(0, 10);
      anwesend[rid + "|" + d] = Object.fromEntries(viele.map((m) => [m.id, "entschuldigt"]));
    }
    dateiSetzen({ ...vorher, mitglieder: viele, reihen: [{ id: rid, titel: "Raid", start: "2025-01-05T20:00", zone: "Europe/Berlin",
      wdh: { art: "woche", tage: [] }, dauerMin: 60, erinnerungMin: 0, ausnahmen: {} }], anwesend });
    const groesse = Buffer.byteLength(JSON.stringify({ data: { v: 1, gilde: datei().gilde } }));
    // die Seite merkt sich, ob eine Anfrage an /api/gilde keepalive trug
    const HALTEN = () => { const f = window.fetch; window.__halten = [];
      window.fetch = (u, o) => { if (String(u) === "/api/gilde" && o?.method === "POST") window.__halten.push(!!o.keepalive); return f(u, o); }; };
    const s = await oeffne({ uhr: UHR, init: HALTEN });
    const p = s.page;
    await gildeAuf(p);
    await reiter(p, "mitglieder");
    await p.click(`#gildeFlaeche .gl-kachel[data-m-id="${viele[0].id}"]`);
    await p.fill("#gildeENotiz", "beim Schliessen");
    // sofort pagehide, bevor die 500 ms um sind: so sendet die Seite beim Schliessen
    await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    assert(groesse > 65536 && await bis(() => datei().gilde.mitglieder[0].notiz === "beim Schliessen")
      && JSON.stringify(await p.evaluate(() => window.__halten)) === "[false]",
      "Schliessen: ein Stand \u00fcber 64 KiB geht beim Verlassen ohne keepalive und wird gespeichert",
      { groesse, posts: s.posts.length, halten: await p.evaluate(() => window.__halten) });
    // ein kleiner Stand geht beim Verlassen mit keepalive
    dateiSetzen({ ...vorher });
    await p.reload();
    await p.waitForFunction(() => !!document.body.dataset.bereit);
    await gildeAuf(p);
    await reiter(p, "mitglieder");
    await p.click(`#gildeFlaeche .gl-kachel[data-m-id="${vorher.mitglieder.find((m) => !m.geloest).id}"]`);
    await p.fill("#gildeENotiz", "klein");
    await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    assert(await bis(() => datei().gilde.mitglieder.some((m) => m.notiz === "klein")) && JSON.stringify(await p.evaluate(() => window.__halten)) === "[true]",
      "Schliessen: ein kleiner Stand geht mit keepalive", await p.evaluate(() => window.__halten));
    await p.close();
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ Hoechstens 100 Mitglieder, auch ueber den Entwurf
  {
    const vorher = datei().gilde;
    const rest = Array.from({ length: 99 - vorher.mitglieder.length }, (_, i) =>
      ({ id: "mvoll" + String(i).padStart(5, "0"), name: "Fuellung " + i, rolle: "dps", waffen: [], notiz: "" }));
    dateiSetzen({ ...vorher, mitglieder: [...vorher.mitglieder, ...rest] });
    assert(datei().gilde.mitglieder.length === 99, "Grenze: 99 Mitglieder in der Datei");
    const s = await oeffne();
    const p = s.page;
    await gildeAuf(p);
    await reiter(p, "mitglieder");
    // ein Entwurf bei 99 wird mit seinem Namen das 100. Mitglied, danach ist "+ Mitglied" aus
    await p.click("#gildeMNeu");
    await p.fill("#gildeEName", "Testperson Z");
    assert(await bis(() => datei().gilde.mitglieder.length === 100 && !!mitglied("Testperson Z")), "Grenze: der Entwurf mit Namen ist das 100. Mitglied", datei().gilde.mitglieder.length);
    await p.click('#gildeEdit [data-g="fertig"]');
    await p.waitForTimeout(800);
    const b = await p.evaluate(() => ({ neu: document.querySelector("#gildeMNeu")?.disabled, satz: document.querySelector("#gildeMaxSatz")?.textContent || "" }));
    assert(datei().gilde.mitglieder.length === 100 && s.posts.every((x) => x.put === "saved")
      && s.posts.every((x) => x.data.gilde.mitglieder.length <= 100),
      "Grenze: kein gesendeter Stand ueber 100, keiner abgelehnt",
      { n: datei().gilde.mitglieder.length, puts: s.posts.map((x) => x.put + ":" + x.data.gilde.mitglieder.length) });
    assert(b.neu === true && /100/.test(b.satz), "Grenze: \"+ Mitglied\" ist aus, ein Satz nennt die Grenze", b);
    assert(!s.fehler.length, "Grenze: keine Seitenfehler", s.fehler);
    await p.close();
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ 50 Mitglieder (Entscheidung 07.10.2026): kleine Kacheln, Schaden doppelt breit
  {
    const vorher = datei().gilde;
    const viele = fuenfzig();
    dateiSetzen({ ...vorher, mitglieder: viele, anwesend: {} });
    for (const [breite, hoehe] of [[2000, 1480], [560, 900]]) {
      const s = await oeffne({ breite, hoehe });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "mitglieder");
      for (const thema of ["dark", "light", "tnl", "glas"]) {
        await p.evaluate((k) => document.querySelector(`#themeRow button[data-theme="${k}"]`)?.click(), thema);
        const m = await p.evaluate(() => {
          const r = document.querySelector("#gilde .wkrollt"), liste = document.querySelector("#gildeListe");
          const spalten = [...document.querySelectorAll("#gildeFlaeche .gl-spalte")].map((sp) => {
            const tops = [...sp.querySelectorAll(".gl-kachel")].map((k) => Math.round(k.getBoundingClientRect().top));
            return { titel: sp.querySelector("h3").textContent.replace(/\d+$/, "").trim(), n: tops.length, ersteReihe: tops.filter((t) => t === tops[0]).length,
              breit: Math.round(sp.getBoundingClientRect().width) };
          });
          const kacheln = [...document.querySelectorAll("#gildeFlaeche .gl-kachel")];
          return { thema: document.documentElement.dataset.theme, hoch: Math.round(liste.getBoundingClientRect().height), spalten,
            quer: document.documentElement.scrollWidth > innerWidth || r.scrollWidth > r.clientWidth,
            knoepfeInKachel: document.querySelectorAll("#gildeFlaeche .gl-kachel button, #gildeFlaeche .gl-kachel [data-g=loesen]").length,
            alleKnopf: kacheln.every((k) => k.tagName === "BUTTON" && k.type === "button"), notizAufKachel: document.querySelectorAll("#gildeFlaeche .gl-kachel .gl-note").length,
            namen: kacheln.slice(0, 1).map((k) => k.getAttribute("aria-label")) };
        });
        const sch = m.spalten.find((x) => x.titel === "Schaden"), tank = m.spalten.find((x) => x.titel === "Tank");
        if (breite === 2000) {
          assert(m.thema === thema && m.hoch < 1100 && sch?.n === 32 && sch.ersteReihe >= 3 && tank?.ersteReihe === 2 && sch.breit > 1.8 * tank.breit,
            `50 Mitglieder, 2000 x 1480, ${thema}: Kachelflaeche unter 1100, Schaden doppelt breit mit mindestens drei je Reihe, Tank zwei`, m);
        } else assert(m.thema === thema && !m.quer && m.spalten.length === 3 && new Set(m.spalten.map((x) => x.breit)).size === 1,
          `50 Mitglieder, 560, ${thema}: eine Spalte untereinander, kein waagerechtes Rollen`, m);
        assert(m.knoepfeInKachel === 0 && m.alleKnopf && m.notizAufKachel === 0, `50 Mitglieder, ${breite}, ${thema}: die Kachel ist der Knopf, keine Knoepfe und keine Notiz darauf`, m);
      }
      if (breite === 2000) {
        const a = await p.evaluate(() => document.querySelector("#gildeFlaeche .gl-kachel")?.getAttribute("aria-label") || "");
        const erstes = viele[0], k = klasseVon(erstes.waffen);
        assert(a.includes(erstes.name) && a.includes(k.de) && a.includes("Tank"), "Kachel: der Name fuer den Vorleser nennt Name, Klasse und Rolle", a);
        await p.focus('#gildeFlaeche .gl-kachel[data-m-id="' + erstes.id + '"]');
        await p.keyboard.press("Enter");
        assert(await warte(p, (n) => document.querySelector("#gildeEName")?.value === n, erstes.name), "Kachel: Enter oeffnet das Feld");
        await p.click('#gildeEdit [data-g="fertig"]');
        assert(await p.evaluate((id) => document.activeElement?.dataset.mId === id, erstes.id), "Kachel: Fertig gibt den Fokus an die Kachel zurueck");
        await p.keyboard.press(" ");
        assert(await warte(p, (n) => document.querySelector("#gildeEName")?.value === n, erstes.name), "Kachel: die Leertaste oeffnet das Feld");
        const notiz = await p.evaluate(() => document.querySelector("#gildeENotiz")?.value);
        assert(notiz === erstes.notiz, "Kachel: die Notiz steht im Feld", notiz);
        // Esc schliesst das Feld wie Fertig: von einem Waffenknopf aus, der Fokus geht an die Kachel
        await p.focus('#gildeEdit .gl-wb[data-nr="1"] button[tabindex="0"]');
        await p.keyboard.press("Escape");
        const esc1 = await p.evaluate(() => ({ feld: !!document.querySelector("#gildeEdit"), f: document.activeElement?.dataset.mId }));
        assert(!esc1.feld && esc1.f === erstes.id, "Kachel: Esc schliesst das Feld, der Fokus steht wieder auf der Kachel", esc1);
        // ein neuer Entwurf: Esc verwirft ihn, der Fokus geht an "+ Mitglied", nichts wird gespeichert
        const vorEsc = s.posts.length;
        await p.click("#gildeMNeu");
        await p.keyboard.press("Escape");
        await p.waitForTimeout(700);
        const esc2 = await p.evaluate(() => ({ feld: !!document.querySelector("#gildeEdit"), f: document.activeElement?.id }));
        assert(!esc2.feld && esc2.f === "gildeMNeu" && s.posts.length === vorEsc, "Entwurf: Esc schliesst, der Fokus steht auf \"+ Mitglied\", kein POST", esc2);
      }
      assert(!s.fehler.length, `50 Mitglieder, ${breite}: keine Seitenfehler`, s.fehler);
      await p.close();
    }
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ Termine und Anwesenheit (Plan Aufgabe 6), die Uhr auf Di 06.10.2026 10:00
  {
    const vorher = datei().gilde;
    const A = { id: "mtermin0a1", name: "Testperson A", rolle: "tank", waffen: [], notiz: "" };
    const B = { id: "mtermin0b1", name: "Testperson B", rolle: "heal", waffen: [], notiz: "" };
    const C = { id: "mtermin0c1", name: "Testperson C", rolle: "dps", waffen: [], notiz: "" };
    const D = { id: "mtermin0d1", name: "Testperson D", rolle: "dps", waffen: [], notiz: "", geloest: true };
    dateiSetzen({ id: vorher.id, name: vorher.name, mitglieder: [A, B, C, D], reihen: [], anwesend: {} });
    const s = await oeffne({ uhr: UHR });
    const p = s.page;
    await gildeAuf(p);
    assert((await blick(p)).tabs[0].sel === "true", "T: der Reiter Termine ist gewaehlt");
    // 1. + Reihe
    await p.click("#gildeRNeu");
    const form = await p.evaluate(() => { const q = (x) => document.querySelector(x);
      return { titel: !!q("#gildeRTitel"), start: q("#gildeRStart")?.type, dauer: !!q("#gildeRDauer"), wdh: [...(q("#gildeRWdh")?.options || [])].map((o) => o.value),
        bis: q("#gildeRBis")?.type, erin: !!q("#gildeRErin"), fokus: document.activeElement?.id,
        labels: ["gildeRTitel", "gildeRStart", "gildeRDauer", "gildeRWdh", "gildeRBis", "gildeRErin"].filter((id) => !q(`label[for="${id}"]`)) }; });
    assert(form.titel && form.start === "datetime-local" && form.dauer && form.wdh.join() === "einmal,woche,tage" && form.bis === "date" && form.erin
      && !form.labels.length && form.fokus === "gildeRTitel",
      "T1: \"+ Reihe\" oeffnet das Formular (Titel, Start als datetime-local, Dauer, Wiederholung, Ende, Erinnerung), der Fokus steht im Titel", form);
    await p.selectOption("#gildeRWdh", "tage");
    const tage = await p.evaluate(() => [...document.querySelectorAll("#gildeReihe .gl-tage button")].map((b) => b.dataset.tag + "|" + b.getAttribute("aria-pressed") + "|" + (b.getAttribute("aria-label") || "")));
    assert(tage.length === 7 && tage.every((x) => /^[0-6]\|(true|false)\|\S/.test(x)), "T1: \"an Wochentagen\" zeigt sieben Wochentagsknoepfe mit aria-pressed und Namen", tage);
    await p.click('#gildeReihe .gl-tage button[data-tag="3"]');
    assert(await p.evaluate(() => document.querySelector('#gildeReihe .gl-tage button[data-tag="3"]')?.getAttribute("aria-pressed")) === "true", "T1: ein Klick drueckt den Wochentag");
    await p.fill("#gildeRTitel", "Raid");
    await p.fill("#gildeRStart", "2026-10-04T20:00");
    await p.selectOption("#gildeRWdh", "woche");
    assert(await p.evaluate(() => !document.querySelector("#gildeReihe .gl-tage button") && document.querySelector("#gildeRTitel")?.value === "Raid"),
      "T1: \"jede Woche\" ohne Wochentagsknoepfe, der Titel bleibt stehen");
    // Jahresgrenzen (Fix 1): Beginn und Ende liegen zwischen heute vor 10 und in 2 Jahren
    for (const [feld, wert] of [["#gildeRStart", "2016-10-05T20:00"], ["#gildeRStart", "2028-10-07T20:00"], ["#gildeRStart", "0099-10-04T20:00"], ["#gildeRBis", "2029-01-01"]]) {
      if (feld === "#gildeRBis") await p.fill("#gildeRStart", "2026-10-04T20:00");
      await p.fill(feld, wert);
      await p.click('#gildeReihe [type="submit"]');
      const fe = await p.evaluate(() => document.querySelector("#gildeRFehler")?.textContent || "");
      assert(/2016/.test(fe) && /2028/.test(fe) && !reiheIn("Raid"), `T1: ${wert} wird mit einem Satz abgelehnt (Grenzen heute -10 und +2 Jahre)`, fe);
    }
    await p.fill("#gildeRBis", "");
    assert(!s.posts.length, "T1: vor dem Anlegen schreibt die Seite nichts", s.posts.length);
    await p.click('#gildeReihe [type="submit"]');
    const zone = await p.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    assert(await bis(() => !!reiheIn("Raid")), "T1: Anlegen schreibt die Reihe in die Datei", datei()?.gilde?.reihen);
    const r = reiheIn("Raid");
    assert(/^r[0-9a-z]{9}$/.test(r?.id || "") && r.start === "2026-10-04T20:00" && r.zone === zone && r.wdh.art === "woche" && r.dauerMin >= 15
      && JSON.stringify(r.ausnahmen) === "{}", "T1: die Reihe mit Kennung, Start, Zeitzone des PCs und wdh.art woche", { r, zone });
    // 2. Terminliste
    let tl = await terme(p);
    const d = tl.map((x) => x.d);
    const naechst = tl.find((x) => x.d === "2026-10-11");
    assert(d.includes("2026-10-11") && d.includes("2026-10-04") && !d.some((x) => x < "2026-10-04") && d.every((x, i) => !i || d[i - 1] > x),
      "T2: die Liste zeigt den naechsten Termin (11.10.) und den vergangenen (04.10.), neueste zuerst", d);
    assert(/5\u00a0d 10\u00a0h/.test(naechst?.stand || "") && /n\u00e4chster/.test(naechst?.text || ""),
      "T2: der naechste Termin mit Restzeit in Tagen und Stunden, geschuetztes Leerzeichen vor d und h", naechst);
    // 3. Anwesenheit
    await p.click('#gildeFlaeche .gl-term[data-datum="2026-10-04"]');
    let gr = await gruppen(p);
    const ga = gr.find((x) => x.id === A.id);
    assert(gr.length === 3 && ga?.label === "Testperson A, 04.10.2026" && gr.every((x) => x.radios.length === 2 && x.radios.map((y) => y.k).join() === "da,fehlt"),
      "T3: je Mitglied eine Radiogruppe mit zwei Marken (da, nicht da), beschriftet mit Name und Datum", gr);
    assert((await terme(p)).find((x) => x.d === "2026-10-04")?.cur, "T3: der gewaehlte Termin traegt aria-current");
    const key = r.id + "|2026-10-04";
    await p.click(`#gildeFlaeche .gl-marken[data-m-id="${A.id}"] [data-marke="da"]`);
    await p.waitForTimeout(600);
    assert(await bis(() => datei().gilde.anwesend[key]?.[A.id] === "da"), "T3: \"da\" steht nach 600 ms in der Datei", datei().gilde.anwesend);
    // 4. Tastatur
    gr = await gruppen(p);
    assert(gr.every((x) => x.radios.filter((y) => y.ti === 0).length === 1), "T4: ein Tabstopp je Gruppe", gr);
    assert(await p.evaluate((id) => document.activeElement?.closest(".gl-marken")?.dataset.mId === id && document.activeElement.dataset.marke === "da", A.id),
      "T4: nach dem Klick steht der Fokus auf der Marke");
    await p.keyboard.press("ArrowRight");
    let f = await p.evaluate(() => ({ k: document.activeElement?.dataset.marke, an: document.activeElement?.getAttribute("aria-checked") }));
    assert(f.k === "fehlt" && f.an === "true" && await bis(() => datei().gilde.anwesend[key]?.[A.id] === "fehlt"), "T4: Pfeil rechts setzt \"nicht da\" wie ein Radio", f);
    await p.keyboard.press("ArrowLeft");
    assert(await bis(() => datei().gilde.anwesend[key]?.[A.id] === "da"), "T4: Pfeil links zurueck auf \"da\"");
    await p.keyboard.press(" ");
    assert(await bis(() => datei().gilde.anwesend[key]?.[A.id] === "offen"), "T4: ein zweiter Druck auf dieselbe Marke setzt \"offen\", der Schluessel bleibt", datei().gilde.anwesend);
    assert(await p.evaluate(() => !document.querySelector('#gildeFlaeche .gl-marken [aria-checked="true"]')), "T4: offen: keine Marke gewaehlt");
    await p.keyboard.press("ArrowDown");
    f = await p.evaluate(() => ({ id: document.activeElement?.closest(".gl-marken")?.dataset.mId, an: document.querySelectorAll('#gildeFlaeche .gl-marken [role="radio"][aria-checked="true"]').length }));
    assert(f.id === B.id && f.an === 0, "T4: Pfeil ab wechselt zum naechsten Mitglied, ohne eine Marke zu setzen", f);
    await p.keyboard.press("ArrowUp");
    assert(await p.evaluate((id) => document.activeElement?.closest(".gl-marken")?.dataset.mId === id, A.id), "T4: Pfeil auf zurueck zum vorigen Mitglied");
    // 5. Alle da
    await p.click('#gildeFlaeche [data-g="alleDa"]');
    assert(await bis(() => [A, B, C].every((m) => datei().gilde.anwesend[key]?.[m.id] === "da") && !(D.id in datei().gilde.anwesend[key])),
      "T5: \"Alle da\" setzt alle offenen auf da, geloeste nicht", datei().gilde.anwesend);
    tl = await terme(p);
    assert(/3\/3/.test(tl.find((x) => x.d === "2026-10-04")?.stand || ""), "T5: die Liste zeigt 3/3 abgehakt", tl);
    // Fix 4: "Alle da" ueberschreibt nie "nicht da" und fuellt auch, was der Filter ausblendet
    await p.click('#gildeFlaeche .gl-term[data-datum="2026-10-18"]');
    const k18 = r.id + "|2026-10-18";
    await p.click(`#gildeFlaeche .gl-marken[data-m-id="${A.id}"] [data-marke="fehlt"]`);
    await p.click(`#gildeFlaeche .gl-marken[data-m-id="${B.id}"] [data-marke="fehlt"]`);
    await p.click('#gildeFilter [role="radio"][data-rolle="tank"]');
    await p.click('#gildeFlaeche [data-g="alleDa"]');
    assert(await bis(() => { const z = datei().gilde.anwesend[k18] || {}; return z[A.id] === "fehlt" && z[B.id] === "fehlt" && z[C.id] === "da" && !(D.id in z); }),
      "T5: Alle da fuellt nur offene (auch vom Filter ausgeblendete), nicht da bleibt, geloeste nie", datei().gilde.anwesend[k18]);
    await p.click('#gildeFilter [role="radio"][data-rolle=""]');
    // 6. Ausfall
    await p.click('#gildeFlaeche .gl-term[data-datum="2026-10-11"]');
    const k11 = r.id + "|2026-10-11";
    await p.click(`#gildeFlaeche .gl-marken[data-m-id="${A.id}"] [data-marke="da"]`);
    await bis(() => datei().gilde.anwesend[k11]?.[A.id] === "da");
    await p.click('#gildeFlaeche [data-g="ausfall"]');
    tl = await terme(p);
    const aus = tl.find((x) => x.d === "2026-10-11");
    assert(aus?.aus && /line-through/.test(aus.strich) && /f\u00e4llt aus/.test(aus.text), "T6: der Termin steht durchgestrichen mit \"faellt aus\"", aus);
    assert(await bis(() => reiheIn("Raid")?.ausnahmen["2026-10-11"]?.aus === true), "T6: in der Datei aus: true", reiheIn("Raid"));
    assert(await p.evaluate(() => document.activeElement?.dataset.g) === "zurueck", "T6: der Fokus steht auf Zuruecknehmen");
    await p.click('#gildeFlaeche [data-g="zurueck"]');
    assert(await bis(() => reiheIn("Raid")?.ausnahmen["2026-10-11"]?.aus === false), "T6: Zuruecknehmen setzt aus: false, der Schluessel bleibt", reiheIn("Raid"));
    assert(await bis(() => datei().gilde.anwesend[k11]?.[A.id] === "da")
      && await p.evaluate((id) => document.querySelector(`#gildeFlaeche .gl-marken[data-m-id="${id}"] [data-marke="da"]`)?.getAttribute("aria-checked") === "true", A.id),
      "T6: die Haken ueberstehen Ausfall und Zuruecknehmen", datei().gilde.anwesend[k11]);
    // 7. Verschieben, Esc
    await p.click('#gildeFlaeche [data-g="verschieben"]');
    assert(await p.evaluate(() => document.querySelector("#gildeVZeit")?.type === "time" && document.activeElement?.id === "gildeVZeit"),
      "T7: Verschieben oeffnet ein Feld mit der Uhrzeit, der Fokus steht darin");
    await p.keyboard.press("Escape");
    f = await p.evaluate(() => ({ feld: !!document.querySelector("#gildeVerschieben"), g: document.activeElement?.dataset.g }));
    assert(!f.feld && f.g === "verschieben", "T7: Esc schliesst das Feld, der Fokus steht wieder auf Verschieben", f);
    await p.click('#gildeFlaeche [data-g="verschieben"]');
    await p.fill("#gildeVZeit", "19:30");
    await p.click('#gildeVerschieben [type="submit"]');
    assert(await bis(() => reiheIn("Raid")?.ausnahmen["2026-10-11"]?.zeit === "19:30"), "T7: die neue Uhrzeit steht als Ausnahme in der Datei", reiheIn("Raid"));
    tl = await terme(p);
    assert(/19:30/.test(tl.find((x) => x.d === "2026-10-11")?.text || ""), "T7: die Liste zeigt 19:30", tl);
    await p.click(`#gildeFlaeche .gl-marken[data-m-id="${B.id}"] [data-marke="fehlt"]`);
    assert(await bis(() => datei().gilde.anwesend[r.id + "|2026-10-11"]?.[B.id] === "fehlt"),
      "T7: die Anwesenheit des verschobenen Termins steht unter dem urspruenglichen Datum", Object.keys(datei().gilde.anwesend));
    // 8. Reihe loesen und Rueckgaengig
    const vorPosts = s.posts.length;
    await p.click(`#gildeFlaeche [data-g="reiheAendern"][data-r-id="${r.id}"]`);
    assert(await p.evaluate(() => document.querySelector("#gildeRTitel")?.value === "Raid" && document.querySelector("#gildeRStart")?.value === "2026-10-04T20:00"),
      "T8: Aendern oeffnet das Formular mit der Reihe");
    await p.click('#gildeReihe [data-g="reiheLoesen"]');
    const b8 = await p.evaluate(() => ({ terme: document.querySelectorAll("#gildeFlaeche .gl-term").length, undo: document.querySelector("#gildeRUndo")?.textContent || "",
      f: document.activeElement?.dataset.g, form: !!document.querySelector("#gildeReihe") }));
    assert(!b8.terme && !b8.form && /Raid/.test(b8.undo) && b8.f === "reiheUndo", "T8: Loesen nimmt die Reihe aus der Liste, der Satz mit Rueckgaengig hat den Fokus", b8);
    assert(await bis(() => reiheIn("Raid")?.geloest === true), "T8: in der Datei geloest: true", reiheIn("Raid"));
    await p.click('#gildeRUndo [data-g="reiheUndo"]');
    assert(await bis(() => { const x = reiheIn("Raid"); return !!x && !("geloest" in x); }) && (await terme(p)).length > 0, "T8: Rueckgaengig bringt die Reihe zurueck");
    assert(s.posts.slice(vorPosts).every((x) => x.data.gilde.reihen.some((y) => y.id === r.id)), "T8: kein gesendeter Stand verliert die Reihe");
    // Esc im Formular schliesst es, der Fokus geht an "+ Reihe"
    await p.click("#gildeRNeu");
    await p.keyboard.press("Escape");
    f = await p.evaluate(() => ({ form: !!document.querySelector("#gildeReihe"), id: document.activeElement?.id }));
    assert(!f.form && f.id === "gildeRNeu", "T8: Esc schliesst das Formular, der Fokus steht auf \"+ Reihe\"", f);
    // Fix 3: eine Reihe mit Haken behaelt Beginn und Rhythmus; Titel, Dauer, Erinnerung aendern sich an Ort und Stelle, sonst "Ab jetzt anders"
    const reiheId = (id) => datei().gilde.reihen.find((x) => x.id === id);
    await p.click(`#gildeFlaeche [data-g="reiheAendern"][data-r-id="${r.id}"]`);
    let fe = await p.evaluate(() => { const q = (x) => document.querySelector(x);
      return { start: q("#gildeRStart")?.disabled, wdh: q("#gildeRWdh")?.disabled, bis: q("#gildeRBis")?.disabled, titel: q("#gildeRTitel")?.disabled,
        dauer: q("#gildeRDauer")?.disabled, ab: !!q('#gildeReihe [data-g="reiheNeuAb"]'), satz: q("#gildeReihe .gl-note.gebunden")?.textContent || "" }; });
    assert(fe.start && fe.wdh && fe.bis && !fe.titel && !fe.dauer && fe.ab && /Ab jetzt anders/.test(fe.satz),
      "T8a: mit Haken sind Beginn, Rhythmus und Ende fest, ein Satz nennt \"Ab jetzt anders\"", fe);
    await p.fill("#gildeRTitel", "Raid Nord");
    await p.selectOption("#gildeRDauer", "90");
    await p.click('#gildeReihe [type="submit"]');
    assert(await bis(() => { const x = reiheId(r.id); return x?.titel === "Raid Nord" && x.dauerMin === 90 && x.start === "2026-10-04T20:00" && x.wdh.art === "woche" && !x.wdh.bis; }),
      "T8a: Titel und Dauer aendern sich an Ort und Stelle, Beginn und Rhythmus bleiben", reiheId(r.id));
    await p.click(`#gildeFlaeche [data-g="reiheAendern"][data-r-id="${r.id}"]`);
    await p.click('#gildeReihe [data-g="reiheNeuAb"]');
    fe = await p.evaluate(() => ({ start: document.querySelector("#gildeRStart")?.disabled, wdh: document.querySelector("#gildeRWdh")?.disabled, f: document.activeElement?.id }));
    assert(fe.start === false && fe.wdh === false && fe.f === "gildeRStart", "T8a: \"Ab jetzt anders\" gibt Beginn und Rhythmus frei, der Fokus steht im Beginn", fe);
    const vorAb = datei().gilde.reihen.length;
    await p.fill("#gildeRStart", "2026-10-15T19:00");
    await p.click('#gildeReihe [type="submit"]');
    const feAb = await p.evaluate(() => document.querySelector("#gildeRFehler")?.textContent || "");
    assert(/18\.10\.2026/.test(feAb) && datei().gilde.reihen.length === vorAb, "T8a: der neue Beginn muss nach dem letzten Termin mit Haken liegen", feAb);
    await p.fill("#gildeRStart", "2026-10-21T19:00");
    await p.selectOption("#gildeRWdh", "tage");
    await p.click('#gildeReihe .gl-tage button[data-tag="6"]');
    await p.click('#gildeReihe [type="submit"]');
    assert(await bis(() => datei().gilde.reihen.length === vorAb + 1), "T8a: Ab jetzt anders legt eine neue Reihe an", datei().gilde.reihen);
    const neuR = datei().gilde.reihen.find((x) => x.id !== r.id && x.start === "2026-10-21T19:00");
    assert(reiheId(r.id)?.wdh.bis === "2026-10-20" && reiheId(r.id).start === "2026-10-04T20:00" && neuR?.titel === "Raid Nord" && neuR.wdh.art === "tage"
      && JSON.stringify(neuR.wdh.tage) === "[3,6]" && neuR.dauerMin === 90 && datei().gilde.anwesend[key]?.[A.id] === "da" && datei().gilde.anwesend[k18]?.[A.id] === "fehlt",
      "T8a: die alte Reihe endet am Tag davor, die neue beginnt mit dem neuen Rhythmus, die Haken bleiben", { alt: reiheId(r.id), neuR });
    tl = await terme(p);
    assert(tl.some((x) => x.d === "2026-10-04") && tl.some((x) => x.d === "2026-10-18") && tl.some((x) => x.d === "2026-10-21") && !tl.some((x) => x.d === "2026-10-25"),
      "T8a: die Liste zeigt die alten Termine bis zum 18.10. und die neuen ab dem 21.10.", tl.map((x) => x.d));
    assert(s.posts.length > 0 && s.posts.every((x) => x.put === "saved"), "T: jeder gesendete Stand wurde gespeichert", s.posts.map((x) => x.put));
    assert(!s.fehler.length, "T1-8: keine Seitenfehler", s.fehler);
    await p.close();
    // 9. Marken mit Symbol und Wort, kein Rot und kein Gruen; 10. 560 und 2000 x 1480 in vier Themen
    const hoehen = {};
    for (const [breite, hoehe] of [[2000, 1480], [560, 900]]) {
      const s2 = await oeffne({ breite, hoehe, uhr: UHR });
      const q = s2.page;
      await gildeAuf(q);
      await q.click('#gildeFlaeche .gl-term[data-datum="2026-10-04"]');
      for (const thema of ["dark", "light", "tnl", "glas"]) {
        await q.evaluate((k) => document.querySelector(`#themeRow button[data-theme="${k}"]`)?.click(), thema);
        const m = await q.evaluate(() => {
          const rr = document.querySelector("#gilde .wkrollt"), ag = document.querySelector("#gildeFlaeche .gl-agenda");
          const radios = [...document.querySelectorAll("#gildeFlaeche .gl-marken")][0]?.querySelectorAll('[role="radio"]') || [];
          const klein = [];
          for (const el of document.querySelectorAll("#gildeFlaeche *")) {
            if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
            if (!el.getClientRects().length || el.closest(".vh,[hidden]")) continue;
            const fs = parseFloat(getComputedStyle(el).fontSize);
            if (fs < 11) klein.push((el.className || el.tagName) + ":" + fs);
          }
          return { thema: document.documentElement.dataset.theme, quer: document.documentElement.scrollWidth > innerWidth || rr.scrollWidth > rr.clientWidth,
            agenda: Math.round(ag.getBoundingClientRect().width), zeile: Math.round(document.querySelector("#gildeFlaeche .gl-term").getBoundingClientRect().height),
            farben: [...radios].map((x) => getComputedStyle(x).color), plakette: getComputedStyle(document.querySelector("#gildeFlaeche .gl-plakette") || document.body).color,
            leer: [...document.querySelectorAll('#gildeFlaeche .gl-marken [role="radio"]')].filter((x) => !x.textContent.trim() || !x.querySelector("svg") || !x.getAttribute("aria-label") || !x.title).length,
            klein };
        });
        assert(m.thema === thema && !m.quer, `T10: ${breite}, ${thema}: kein waagerechtes Rollen`, m);
        assert(m.farben.length === 2 && !m.leer && ![...m.farben, m.plakette].some(rotGruen), `T9: ${breite}, ${thema}: jede Marke mit Symbol und Wort, keine in Rot oder Gruen`, m);
        if (thema === "dark") assert(!m.klein.length, `T10: ${breite}: kein Text unter 11 Punkt`, m.klein);
        hoehen[breite] = m.zeile;
        if (breite === 2000) assert(m.agenda <= 340, `T10: 2000 x 1480, ${thema}: die Terminliste bleibt schmal`, m.agenda);
      }
      assert(!s2.fehler.length, `T10: ${breite}: keine Seitenfehler`, s2.fehler);
      await q.close();
    }
    assert(hoehen[2000] === hoehen[560], "T10: die Zeilen der Terminliste sind bei 2000 x 1480 so hoch wie bei 560 (nie gestreckt)", hoehen);
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ Fix 5: der erste Haken heftet den gezeigten Termin an
  {
    const vorher = datei().gilde;
    const rid = "rpinn00001", M = { id: "mpinn00001", name: "Testperson A", rolle: "tank", waffen: [], notiz: "" };
    dateiSetzen({ id: vorher.id, name: vorher.name, mitglieder: [M], anwesend: {},
      reihen: [{ id: rid, titel: "Raid", start: "2026-09-27T20:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 120, erinnerungMin: 0, ausnahmen: {} }] });
    for (const haken of [false, true]) {
      const s = await oeffne({ uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      const tk = () => p.evaluate(() => document.querySelector("#gildeTermin")?.dataset.tk || "");
      const tk0 = await tk();
      if (haken) {
        await p.click(`#gildeFlaeche .gl-marken[data-m-id="${M.id}"] [data-marke="da"]`);
        await bis(() => datei().gilde.anwesend[rid + "|2026-10-04"]?.[M.id] === "da");
      }
      // eine Woche spaeter, der Minutentakt zeichnet neu
      await p.clock.setFixedTime(new Date("2026-10-12T10:00:00"));
      await p.clock.runFor(61000);
      const tk1 = await tk();
      assert(tk0 === rid + "|2026-10-04" && tk1 === rid + (haken ? "|2026-10-04" : "|2026-10-11"),
        haken ? "Fix 5: nach dem ersten Haken bleibt der Termin stehen, auch wenn der Minutentakt neu zeichnet" : "Fix 5: ohne Haken folgt die Wahl der Uhr (Gegenprobe)", { tk0, tk1 });
      assert(!s.fehler.length, "Fix 5: keine Seitenfehler", s.fehler);
      await p.close();
    }
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ Fix 7: bei 20 Reihen ist "+ Reihe" aus, ein Satz nennt die Grenze
  {
    const vorher = datei().gilde;
    const reihen = Array.from({ length: 20 }, (_, i) => ({ id: "rvoll" + String(i).padStart(5, "0"), titel: "Reihe " + (i + 1), start: "2026-10-04T20:00", zone: "Europe/Berlin",
      wdh: { art: "woche", tage: [] }, dauerMin: 60, erinnerungMin: 0, ausnahmen: {}, ...(i < 18 ? { geloest: true } : {}) }));
    dateiSetzen({ ...vorher, reihen, anwesend: {} });
    const s = await oeffne({ uhr: UHR });
    await gildeAuf(s.page);
    const b = await s.page.evaluate(() => { const k = document.querySelector("#gildeRNeu");
      return { aus: k?.disabled, satz: document.querySelector("#gildeRMax")?.textContent || "", desc: k?.getAttribute("aria-describedby"), reihen: document.querySelectorAll("#gildeFlaeche .gl-reihe").length }; });
    assert(b.aus === true && /20/.test(b.satz) && b.desc === "gildeRMax" && b.reihen === 2, "Fix 7: 20 Reihen (geloeste zaehlen mit): \"+ Reihe\" ist aus, mit Satz", b);
    await s.page.close();
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ Fix 2: die Datei fasst 2 MB; nahe daran ein Satz, darueber wird nicht gesendet
  {
    const vorher = datei().gilde;
    const rid = "rgross0001";
    const viele = Array.from({ length: 98 }, (_, i) => ({ id: "mgross" + String(i).padStart(4, "0"), name: "Testperson " + i, rolle: "dps", waffen: [], notiz: "x".repeat(120) }));
    const reihe = { id: rid, titel: "Raid", start: "2026-01-04T20:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 120, erinnerungMin: 0, ausnahmen: {} };
    const tag = (i) => new Date(Date.UTC(2020, 0, 1) + i * 86400000).toISOString().slice(0, 10);
    const gross = (n, rest = 0) => {
      const an = {};
      for (let i = 0; i < n; i++) an[rid + "|" + tag(i)] = Object.fromEntries(viele.map((m) => [m.id, "entschuldigt"]));
      if (rest) an[rid + "|" + tag(n)] = Object.fromEntries(viele.slice(0, rest).map((m) => [m.id, "entschuldigt"]));
      return { id: vorher.id, name: vorher.name, mitglieder: viele, reihen: [reihe], anwesend: an };
    };
    const len = (g) => JSON.stringify({ v: 1, gilde: g }).length;
    const n = Math.floor((2097152 - 700 - len(gross(0))) / (len(gross(2)) - len(gross(1))));
    const rest = Math.min(viele.length - 1, Math.floor((2097152 - 700 - len(gross(n))) / 28));
    const g = gross(n, rest);
    dateiSetzen(g);
    assert(len(g) > 2097152 - 900 && len(g) < 2097152 - 400 && !!datei(), "Fix 2: die Datei liegt knapp unter 2 MB", len(g));
    const s = await oeffne({ uhr: UHR });
    const p = s.page;
    await gildeAuf(p);
    const status = () => p.evaluate(() => document.querySelector("#gildeStatus")?.textContent || "");
    assert(/fast voll/.test(await status()), "Fix 2: schon beim Lesen sagt ein Satz, dass die Datei fast voll ist", await status());
    await p.click(`#gildeFlaeche .gl-marken[data-m-id="${viele[0].id}"] [data-marke="da"]`);
    assert(await bis(() => datei().gilde.anwesend[rid + "|2026-10-04"]?.[viele[0].id] === "da") && /fast voll/.test(await status()),
      "Fix 2: ein Haken passt noch hinein, der Satz bleibt", await status());
    const vor = s.posts.length;
    await p.click('#gildeFlaeche [data-g="alleDa"]');
    await p.waitForTimeout(900);
    const st = await status();
    assert(s.posts.length === vor && /nicht gespeichert/i.test(st) && /2\u00a0MB/.test(st) && /F5/.test(st) && Object.keys(datei().gilde.anwesend[rid + "|2026-10-04"]).length === 1,
      "Fix 2: ueber 2 MB sendet die Seite nicht und sagt, was zu tun ist", { st, posts: s.posts.length - vor });
    assert(!s.fehler.length, "Fix 2: keine Seitenfehler", s.fehler);
    await p.close();
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ Anwesenheit mit 50 Mitgliedern (Entscheidung 07.10.2026) und alte Termine
  {
    const vorher = datei().gilde;
    const viele = fuenfzig();
    const rid = "rtermin050";
    const reihe = { id: rid, titel: "Raid", start: "2026-01-04T20:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 120, erinnerungMin: 0,
      ausnahmen: { "2026-09-20": { aus: true } } };
    const marken = {};
    viele.forEach((m, i) => { marken[m.id] = ["da", "da", "fehlt", "da", "entschuldigt", "offen"][i % 6]; });
    dateiSetzen({ ...vorher, mitglieder: viele, reihen: [reihe], anwesend: { [rid + "|2026-10-04"]: marken } });
    for (const [breite, hoehe] of [[2000, 1480], [560, 900]]) {
      const s = await oeffne({ breite, hoehe, uhr: UHR });
      const p = s.page;
      await gildeAuf(p);
      await p.click('#gildeFlaeche .gl-term[data-datum="2026-10-04"]');
      for (const thema of ["dark", "light", "tnl", "glas"]) {
        await p.evaluate((k) => document.querySelector(`#themeRow button[data-theme="${k}"]`)?.click(), thema);
        const m = await p.evaluate(() => {
          const rr = document.querySelector("#gilde .wkrollt"), sp = document.querySelector("#gildeFlaeche .gl-spalten");
          const spalten = [...document.querySelectorAll("#gildeFlaeche .gl-spalte")].map((x) => {
            const tops = [...x.querySelectorAll(".gl-anw")].map((k) => Math.round(k.getBoundingClientRect().top));
            return { titel: x.querySelector("h3").textContent.replace(/[\d/]+$/, "").trim(), n: tops.length, ersteReihe: tops.filter((t) => t === tops[0]).length,
              breit: Math.round(x.getBoundingClientRect().width) };
          });
          return { thema: document.documentElement.dataset.theme, hoch: Math.round(sp?.getBoundingClientRect().height || 0), spalten,
            quer: document.documentElement.scrollWidth > innerWidth || rr.scrollWidth > rr.clientWidth, gruppen: document.querySelectorAll('#gildeFlaeche .gl-marken[role="radiogroup"]').length };
        });
        const sch = m.spalten.find((x) => x.titel === "Schaden");
        if (breite === 2000) {
          assert(m.thema === thema && m.gruppen === 50 && m.hoch > 0 && m.hoch < 1000 && sch?.n === 32 && sch.ersteReihe >= 2 && !m.quer,
            `Anwesenheit, 50 Mitglieder, 2000 x 1480, ${thema}: kompakte Zeilen, Flaeche unter 1000 (vorher Karten unter 1150), Schaden mindestens zwei Spalten`, m);
        } else assert(m.thema === thema && !m.quer && m.spalten.length === 3 && new Set(m.spalten.map((x) => x.breit)).size === 1,
          `Anwesenheit, 50 Mitglieder, 560, ${thema}: eine Spalte untereinander, kein waagerechtes Rollen`, m);
        if (FOTO && ((breite === 2000 && thema === "dark") || (breite === 560 && thema === "light"))) {
          // schmal steht die Anwesenheit unter der Liste
          if (breite === 560) await p.evaluate(() => document.querySelector("#gildeTermin")?.scrollIntoView());
          await p.screenshot({ path: join(FOTO, `task-6-termine-${thema}-${breite}.png`) });
        }
      }
      if (breite === 2000) {
        // alte Termine: zwoelf Wochen, dann "Aeltere zeigen" in Zwoelferschritten
        const vergangen = async () => (await terme(p)).filter((x) => x.d < "2026-10-06").length;
        const v0 = await vergangen();
        await p.click(`#gildeFlaeche [data-g="aelter"][data-r-id="${rid}"]`);
        const v1 = await vergangen();
        assert(v0 === 12 && v1 === 24, "Alte Termine: zwoelf Wochen, \"Aeltere zeigen\" bringt zwoelf mehr", { v0, v1 });
        assert(await p.evaluate(() => document.activeElement?.dataset.g) === "aelter", "Alte Termine: der Fokus bleibt auf \"Aeltere zeigen\"");
        const alt = (await terme(p)).find((x) => x.d === "2026-09-20");
        assert(alt?.aus && /f\u00e4llt aus/.test(alt.text), "Alte Termine: ein ausgefallener steht durchgestrichen dazwischen", alt);
        // ein alter Termin ist abhakbar wie ein neuer
        await p.click('#gildeFlaeche .gl-term[data-datum="2026-05-03"]');
        await p.click(`#gildeFlaeche .gl-marken[data-m-id="${viele[0].id}"] [data-marke="da"]`);
        assert(await bis(() => datei().gilde.anwesend[rid + "|2026-05-03"]?.[viele[0].id] === "da"), "Alte Termine: ein Termin im Mai ist abhakbar", Object.keys(datei().gilde.anwesend));
      }
      assert(!s.fehler.length, `Anwesenheit, 50 Mitglieder, ${breite}: keine Seitenfehler`, s.fehler);
      await p.close();
    }
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ Auswertung und Ausgabe (Plan Aufgabe 7), die Uhr auf Mo 26.10.2026 12:00
  {
    const vorher = datei().gilde;
    const A = { id: "mausw000a1", name: "Testperson A", rolle: "", waffen: ["Greatsword", "Sword and Shield"], notiz: "" };
    const B = { id: "mausw000b1", name: "Testperson B", rolle: "", waffen: ["Staff", "Wand and Tome"], notiz: "" };
    const C = { id: "mausw000c1", name: "Testperson C", rolle: "tank", waffen: [], notiz: "" };
    const raid = { id: "rausw00001", titel: "Raid", start: "2026-10-04T20:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 120, erinnerungMin: 15, ausnahmen: {} };
    const training = { id: "rausw00002", titel: "Training", start: "2026-10-07T19:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 60, erinnerungMin: 0, ausnahmen: {} };
    const k = (r, d) => r.id + "|" + d;
    /* die Marken wie im Kerntest, dazu die zweite Reihe "Training" mit eigenen */
    const anwesend = {
      [k(raid, "2026-10-04")]: { [A.id]: "da", [B.id]: "da" },
      [k(raid, "2026-10-11")]: { [A.id]: "da", [B.id]: "fehlt" },
      [k(raid, "2026-10-18")]: { [A.id]: "entschuldigt", [B.id]: "da" },
      [k(raid, "2026-10-25")]: { [A.id]: "da", [B.id]: "da" },
      [k(training, "2026-10-07")]: { [A.id]: "fehlt", [B.id]: "da" },
    };
    /* die Liste: B, C, A - so unterscheiden sich Liste, Name, Quote und Rolle */
    const g = { id: vorher.id, name: "Testgilde", mitglieder: [B, C, A], reihen: [raid, training], anwesend };
    dateiSetzen(g);
    const AUHR = "2026-10-26T12:00:00", JETZT = "2026-10-26T12:00";
    const STUB = () => {
      window.__text = null; window.__bild = null;
      class CI { constructor(d) { this.d = d; this.types = Object.keys(d); } async getType(t) { return await this.d[t]; } }
      window.ClipboardItem = CI;
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: async (x) => { window.__text = x; },
        write: async (items) => {
          const it = items[0], b = await it.getType("image/png"), bm = await createImageBitmap(b);
          window.__bild = { types: it.types, type: b.type, w: bm.width, h: bm.height };
        },
      } });
    };
    const OHNE = () => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }); window.ClipboardItem = undefined; };
    const karten = (p) => p.evaluate(() => [...document.querySelectorAll("#gildeFlaeche .gl-karte")].map((x) => {
      const t = (e) => (e?.textContent || "").replace(/\s+/g, " ").trim(), rf = x.querySelector(".gl-ring .rf");
      return { id: x.dataset.mId, quote: x.querySelector(".gl-ring b")?.textContent || "", zahlen: [...x.querySelectorAll(".gl-zahlen dd")].map(t),
        satz: t(x.querySelector(".vh")), cls: x.className, farbe: getComputedStyle(x).color, grund: getComputedStyle(x).backgroundColor,
        rahmen: getComputedStyle(x).boxShadow, ring: rf ? getComputedStyle(rf).stroke : null, text: t(x) };
    }));
    const erwartet = (reihen, ms = null) => kern.auswerten(g, reihen, JETZT).filter((z) => !ms || ms.includes(z.mitgliedId));
    const passt = (ks, zs) => zs.length === ks.length && zs.every((z, i) => {
      const x = ks[i];
      return x.id === z.mitgliedId && x.quote === (z.quote === null ? "\u2013" : Math.round(z.quote * 100) + "\u00a0%")
        && x.zahlen[0] === (z.da + z.fehlt ? z.da + "/" + (z.da + z.fehlt) : "\u2013") && x.zahlen.length === 2
        && !/Str\u00e4hne|entschuldigt/i.test(x.text);
    });
    {
      const s = await oeffne({ uhr: AUHR, init: STUB });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "auswertung");
      // 1. Je Mitglied Quote, Dabei, zuletzt; 2. Alle Reihen oder eine
      let ks = await karten(p);
      const wahl = await p.evaluate(() => ({ reihe: [...(document.querySelector("#gildeAReihe")?.options || [])].map((o) => o.value + "|" + o.textContent),
        sort: [...(document.querySelector("#gildeASort")?.options || [])].map((o) => o.value),
        labels: ["gildeAReihe", "gildeASort"].filter((id) => !document.querySelector(`label[for="${id}"]`)) }));
      assert(wahl.reihe.join() === "|Alle Events,rausw00001|Raid,rausw00002|Training" && wahl.sort.join() === "liste,name,quote,rolle" && !wahl.labels.length,
        "A2: Event (Alle Events, Raid, Training) und Reihenfolge (Liste, Name, Quote, Rolle) mit Label", wahl);
      assert(passt(ks, erwartet(null)), "A2: Alle Reihen: die Zahlen wie im Kern (beide Reihen)", { ks, z: erwartet(null) });
      await p.selectOption("#gildeAReihe", raid.id);
      ks = await karten(p);
      assert(passt(ks, erwartet([raid.id])), "A2: Raid: die Zahlen wie im Kern (nur Raid)", { ks, z: erwartet([raid.id]) });
      const a = ks.find((x) => x.id === A.id), b = ks.find((x) => x.id === B.id);
      assert(a?.quote === "75\u00a0%" && a.zahlen.join("|") === "3/4|25.10." && b?.quote === "75\u00a0%" && b.zahlen.join("|") === "3/4|25.10.",
        "A1: A 75 % (3/4, 25.10.; die alte Entschuldigung zaehlt als nicht da), B 75 % (3/4), gesch\u00fctztes Leerzeichen vor %", { a, b });
      // eine alte Marke "entschuldigt" aus der Datei zeigt sich bei den Terminen als "nicht da", die Seite bietet keine dritte Marke an
      await reiter(p, "termine");
      await p.click('#gildeFlaeche .gl-term[data-datum="2026-10-18"]');
      const alt = (await gruppen(p)).find((x) => x.id === A.id);
      assert(alt?.radios.map((y) => y.k + ":" + y.an).join() === "da:false,fehlt:true",
        "A1: eine alte Entschuldigung steht bei den Terminen als nicht da, ohne dritte Marke", alt);
      await reiter(p, "auswertung");
      await p.selectOption("#gildeAReihe", raid.id);
      // 9. Vorleser: je Karte ein Satz
      assert(b?.satz === "Testperson B: 75 Prozent, zuletzt 25.10.", "A9: die Karte liest sich als Satz", b?.satz);
      const liste = await p.evaluate(() => { const u = document.querySelector("#gildeFlaeche .gl-karten");
        return { tag: u?.tagName, label: u?.getAttribute("aria-label") || "", versteckt: [...document.querySelectorAll("#gildeFlaeche .gl-karte > [aria-hidden='true']")].length }; });
      assert(liste.tag === "UL" && liste.label && liste.versteckt === 3, "A9: eine benannte Liste, das Bild der Karte ist f\u00fcr den Vorleser still", liste);
      // 3. Reihenfolge
      const reihenfolge = async (wert) => { await p.selectOption("#gildeASort", wert); return (await karten(p)).map((x) => x.id); };
      await p.selectOption("#gildeAReihe", "");
      const r = { liste: await reihenfolge("liste"), name: await reihenfolge("name"), quote: await reihenfolge("quote"), rolle: await reihenfolge("rolle") };
      assert(r.liste.join() === [B.id, C.id, A.id].join() && r.name.join() === [A.id, B.id, C.id].join()
        && r.quote.join() === [B.id, A.id, C.id].join() && r.rolle.join() === [C.id, A.id, B.id].join(),
        "A3: Wie die Liste, Name, Quote (ohne Quote zuletzt), Rolle (Tank, Heiler, Schaden; sonst wie die Liste)", r);
      await p.selectOption("#gildeASort", "liste");
      // 4. Kein Urteil
      ks = await karten(p);
      const ringe = ks.map((x) => x.ring).filter(Boolean);
      assert(new Set(ks.map((x) => x.cls)).size === 1 && new Set(ks.map((x) => x.farbe)).size === 1 && new Set(ks.map((x) => x.grund)).size === 1
        && new Set(ks.map((x) => x.rahmen)).size === 1 && ringe.length === 2 && new Set(ringe).size === 1
        && !ks.some((x) => /[\u{1F947}-\u{1F949}\u{1F3C6}\u2605\u2606\u265b]|#\s?\d|\bRang\b|\bPlatz\b/u.test(x.text)),
        "A4: kein Urteil: gleiche Klasse, Farbe, Fl\u00e4che und Ringfarbe f\u00fcr alle, keine Medaille und kein Rang", ks.map((x) => [x.cls, x.farbe, x.ring]));
      // 5. Text kopieren: genau textAusgabe in der Seitensprache, mit Filter
      await p.selectOption("#gildeAReihe", raid.id);
      /* die Kopfzeile nennt die Reihe und bei aktivem Filter die Treffer; das Datum kurz wie auf den Karten */
      const worte = { kopf: I18N.de["gilde.ausgabe.bildKopf"], reihe: "Raid", treffer: "",
        zuletzt: I18N.de["gilde.ausw.text.zuletzt"], offen: "\u2013",
        datum: (d) => d.slice(8, 10) + "." + d.slice(5, 7) + "." };
      await p.click('#gildeFlaeche [data-g="text"]');
      const text1 = await bis(() => p.evaluate(() => window.__text)) && await p.evaluate(() => window.__text);
      assert(text1 === kern.textAusgabe(erwartet([raid.id]), g, worte), "A5: Text kopieren gibt genau textAusgabe (Raid, wie die Liste)", { text1, soll: kern.textAusgabe(erwartet([raid.id]), g, worte) });
      assert(/Kopiert/.test(await p.evaluate(() => document.querySelector("#gildeStatus").textContent)), "A5: #gildeStatus sagt \u201eKopiert\u201c",
        await p.evaluate(() => document.querySelector("#gildeStatus").textContent));
      await p.fill("#gildeSuche", "Testperson B");
      await p.evaluate(() => { window.__text = null; });
      await p.click('#gildeFlaeche [data-g="text"]');
      const text2 = await bis(() => p.evaluate(() => window.__text)) && await p.evaluate(() => window.__text);
      const worte2 = { ...worte, treffer: I18N.de["gilde.treffer"].replace("{n}", "1").replace("{m}", "3") };
      assert(text1.split("\n")[0] === "Testgilde \u00b7 Anwesenheit \u00b7 Raid" && text1.includes("zuletzt 25.10."),
        "Fix 4: der Text nennt die Reihe und schreibt das Datum kurz (25.10.)", text1);
      assert(text2 === kern.textAusgabe(erwartet([raid.id], [B.id]), g, worte2) && text2.split("\n")[0].endsWith("1 von 3 Mitgliedern") && (await karten(p)).length === 1, "A5: die Suche wirkt auf Karten und Text", text2);
      await p.fill("#gildeSuche", "");
      // 6. Bild kopieren
      await warte(p, () => !!document.querySelector("#gildeFlaeche .gl-bild canvas"));
      const vorschau = await p.evaluate(() => { const c = document.querySelector("#gildeFlaeche .gl-bild canvas"); return c ? { w: c.width, h: c.height, role: c.getAttribute("role"), label: c.getAttribute("aria-label") } : null; });
      assert(vorschau && vorschau.w >= 800 && vorschau.h > 0 && vorschau.role === "img" && vorschau.label, "A6: rechts die Bildvorschau als Leinwand mit Namen", vorschau);
      await p.click('#gildeFlaeche [data-g="bild"]');
      const bild = await bis(() => p.evaluate(() => window.__bild)) && await p.evaluate(() => window.__bild);
      assert(bild && bild.types.join() === "image/png" && bild.type === "image/png" && bild.w >= 400, "A6: Bild kopieren legt ein PNG (mindestens 400 px breit) in die Zwischenablage", bild);
      assert(/Kopiert/.test(await p.evaluate(() => document.querySelector("#gildeStatus").textContent)), "A6: #gildeStatus sagt \u201eKopiert\u201c");
      // 7. Kalenderdatei je Reihe
      const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }), p.click('#gildeFlaeche [data-g="ics"]')]);
      const icsText = readFileSync(await dl.path(), "utf8");
      assert(dl.suggestedFilename() === "raid.ics" && icsText.startsWith("BEGIN:VCALENDAR") && icsText.includes("RRULE:FREQ=WEEKLY;BYDAY=SU"),
        "A7: Kalenderdatei: raid.ics mit BEGIN:VCALENDAR und RRULE:FREQ=WEEKLY;BYDAY=SU", { name: dl.suggestedFilename(), kopf: icsText.slice(0, 120) });
      await p.selectOption("#gildeAReihe", "");
      // Entscheidung 07.10.2026: "Alle Reihen" mit zwei Reihen gibt eine Datei mit beiden, benannt nach der Gilde
      const knopfAlle = await p.evaluate(() => { const b = document.querySelector('#gildeFlaeche [data-g="ics"]');
        return { aus: !!b?.disabled, beschrieben: b?.getAttribute("aria-describedby") || "" }; });
      const [dl2] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }), p.click('#gildeFlaeche [data-g="ics"]')]);
      const icsBeide = readFileSync(await dl2.path(), "utf8"), zb = icsBeide.split("\r\n");
      assert(!knopfAlle.aus && !knopfAlle.beschrieben && dl2.suggestedFilename() === "testgilde.ics"
        && zb.filter((z) => z === "BEGIN:VCALENDAR").length === 1 && zb.filter((z) => z === "END:VCALENDAR").length === 1
        && zb.includes("UID:rausw00001@borometer.local") && zb.includes("UID:rausw00002@borometer.local")
        && zb.includes("RRULE:FREQ=WEEKLY;BYDAY=SU") && zb.includes("RRULE:FREQ=WEEKLY;BYDAY=WE")
        && icsBeide === kern.icsAlle(g, [raid.id, training.id], new Date(AUHR).getTime()),
        "A7: \u201eAlle Reihen\u201c (zwei Reihen): eine Datei testgilde.ics mit beiden Reihen, wie icsAlle im Kern",
        { knopfAlle, name: dl2.suggestedFilename(), text: icsBeide.slice(0, 400) });
      // Fix 2: die Vorschau wird nur neu gemalt, wenn sich ihr Inhalt aendert, und beim Verlassen losgelassen
      const leinwand = () => p.evaluate(() => { const c = document.querySelector("#gildeFlaeche .gl-bild canvas");
        return c ? { marke: c.dataset.probe || "", h: c.height, bild: c.toDataURL("image/png") } : null; });
      const markieren = () => p.evaluate(() => { const c = document.querySelector("#gildeFlaeche .gl-bild canvas"); if (c) c.dataset.probe = "alt"; });
      const neuGemalt = (alt) => bis(async () => { const c = await leinwand(); return !!c && c.marke !== "alt" && c.bild !== alt.bild; });
      await p.selectOption("#gildeAReihe", raid.id);
      await bis(async () => !!(await leinwand()));
      await markieren();
      await p.click('#gildeRollen [data-rolle=""]');            // zeichnet neu, der Inhalt bleibt gleich
      await p.evaluate(() => window.dispatchEvent(new Event("resize")));
      await new Promise((r) => setTimeout(r, 300));
      const gleich = await leinwand();
      assert(gleich?.marke === "alt", "Fix 2: ohne neuen Inhalt bleibt dieselbe Leinwand stehen (kein neues Malen)", gleich?.marke);
      // 5. das Bild folgt der Reihenfolge und dem Filter
      const vor = await leinwand();
      await p.selectOption("#gildeASort", "name");
      assert(await neuGemalt(vor), "Fix 5: eine andere Reihenfolge malt das Bild neu, mit anderem Inhalt");
      const sortiert = await leinwand();
      await markieren();
      await p.fill("#gildeSuche", "Testperson B");
      assert(await neuGemalt(sortiert) && (await leinwand()).h < sortiert.h, "Fix 5: die Suche malt das Bild neu, mit weniger Zeilen (niedriger)",
        { vorher: sortiert.h, nachher: (await leinwand())?.h });
      await p.fill("#gildeSuche", "");
      await p.selectOption("#gildeASort", "liste");
      // Fix 3: der Satz einer Ausgabe geht mit dem Reiterwechsel; Fix 2: beim Verlassen wird die Leinwand losgelassen
      await p.click('#gildeFlaeche [data-g="text"]');
      await bis(() => p.evaluate(() => /Kopiert/.test(document.querySelector("#gildeStatus").textContent)));
      await markieren();
      await reiter(p, "termine");
      const stat = await p.evaluate(() => document.querySelector("#gildeStatus").textContent);
      assert(stat === "", "Fix 3: \u201eKopiert.\u201c verschwindet beim Wechsel des Reiters", stat);
      await reiter(p, "auswertung");
      await bis(async () => !!(await leinwand()));
      assert((await leinwand())?.marke === "", "Fix 2: nach dem Verlassen des Reiters wird die Vorschau neu gemalt, die alte ist losgelassen");
      assert(!s.fehler.length && !s.posts.length, "A: keine Seitenfehler, und die Auswertung schreibt nichts", { f: s.fehler, posts: s.posts.length });
      await p.close();
    }
    {
      // Fix 6: der Dateiname der Kalenderdatei - nur a-z, 0-9 und Bindestrich, hoechstens 40 Zeichen, sonst der Ersatzname
      const titel = { ra: "Gro\u00dfer \u00dcbungsabend", rb: "\u00c4rger & S\u00f6ldner: T\u00fcr 2", rc: "!!! ??? ***",
        rd: "Ein sehr langer Titel fuer eine Reihe X am Abend" };
      const reihen = Object.entries(titel).map(([id, x]) => ({ ...raid, id: "rnamen" + id + "01", titel: x }));
      dateiSetzen({ ...g, reihen, anwesend: {} });
      const s = await oeffne({ uhr: AUHR });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "auswertung");
      const namen = [];
      for (const r of reihen) {
        await p.selectOption("#gildeAReihe", r.id);
        const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }), p.click('#gildeFlaeche [data-g="ics"]')]);
        namen.push(dl.suggestedFilename());
      }
      assert(namen.join() === "grosser-ubungsabend.ics,arger-soldner-tur-2.ics,termine.ics,ein-sehr-langer-titel-fuer-eine-reihe-x.ics",
        "Fix 6: Dateiname: \u00df wird ss, Umlaute ohne Punkte, nur Zeichen ergibt \u201etermine\u201c, lang wird auf 40 gek\u00fcrzt (ohne Bindestrich am Ende)", namen);
      assert(namen.every((n) => /^[a-z0-9-]{1,40}\.ics$/.test(n)), "Fix 6: jeder Name nur aus a-z, 0-9 und Bindestrich, h\u00f6chstens 40 Zeichen", namen);
      assert(!s.fehler.length, "Fix 6: keine Seitenfehler", s.fehler);
      await p.close();
      dateiSetzen(g);
    }
    {
      // 6. Ohne Zwischenablage: die Datei zum Speichern, mit Satz
      const s = await oeffne({ uhr: AUHR, init: OHNE });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "auswertung");
      const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }), p.click('#gildeFlaeche [data-g="bild"]')]);
      const png = readFileSync(await dl.path());
      const satz = await p.evaluate(() => document.querySelector("#gildeStatus").textContent);
      assert(dl.suggestedFilename() === "gilde-auswertung.png" && png.subarray(1, 4).toString() === "PNG" && /gilde-auswertung\.png/.test(satz),
        "A6: ohne Zwischenablage: gilde-auswertung.png zum Speichern, mit Satz", { name: dl.suggestedFilename(), satz });
      assert(!s.fehler.length, "A6: ohne Zwischenablage keine Seitenfehler", s.fehler);
      await p.close();
    }
    {
      // EN: kurzes Datum 10/25
      const s = await oeffne({ uhr: AUHR, lang: "en" });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "auswertung");
      await p.selectOption("#gildeAReihe", raid.id);
      const b = (await karten(p)).find((x) => x.id === B.id);
      assert(b?.zahlen[1] === "10/25" && b.satz.includes("10/25"), "A1: Englisch: zuletzt 10/25", b);
      await p.close();
    }
    {
      // 8. Leere Auswertung: ein Satz
      dateiSetzen({ ...g, anwesend: {} });
      const s = await oeffne({ uhr: AUHR });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "auswertung");
      const leer = await p.evaluate(() => ({ satz: (document.querySelector("#gildeFlaeche .gl-leer")?.textContent || "").trim(), karten: document.querySelectorAll("#gildeFlaeche .gl-karte").length }));
      assert(leer.satz === I18N.de["gilde.ausw.keine"] && !leer.karten, "A8: ohne abgehakte Termine ein Satz statt leerer Karten", leer);
      await p.close();
    }
    {
      // 50 Mitglieder (Entscheidung 07.10.2026): Karten im Raster, vier je Reihe, unter 1150 px; 560 ohne waagerechtes Rollen; vier Themen
      const viele = fuenfzig();
      const marken = {};
      for (const [j, d] of ["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25"].entries()) {
        marken[k(raid, d)] = {};
        viele.forEach((m, i) => { marken[k(raid, d)][m.id] = ["da", "da", "fehlt", "da", "entschuldigt", "offen", "da"][(i + j) % 7]; });
      }
      dateiSetzen({ ...g, mitglieder: viele, reihen: [raid], anwesend: marken });
      for (const [breite, hoehe] of [[2000, 1480], [560, 900]]) {
        const s = await oeffne({ breite, hoehe, uhr: AUHR });
        const p = s.page;
        await gildeAuf(p);
        await reiter(p, "auswertung");
        for (const thema of ["dark", "light", "tnl", "glas"]) {
          await p.evaluate((x) => document.querySelector(`#themeRow button[data-theme="${x}"]`)?.click(), thema);
          const m = await p.evaluate(() => {
            const rr = document.querySelector("#gilde .wkrollt"), ul = document.querySelector("#gildeFlaeche .gl-karten");
            const tops = [...document.querySelectorAll("#gildeFlaeche .gl-karte")].map((x) => Math.round(x.getBoundingClientRect().top));
            const klein = [];
            for (const el of document.querySelectorAll("#gildeFlaeche *")) {
              if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
              if (!el.getClientRects().length || el.closest(".vh,[hidden]")) continue;
              const fs = parseFloat(getComputedStyle(el).fontSize);
              if (fs < 11) klein.push((el.className || el.tagName) + ":" + fs);
            }
            return { thema: document.documentElement.dataset.theme, n: tops.length, ersteReihe: tops.filter((t) => t === tops[0]).length,
              hoch: Math.round(ul?.getBoundingClientRect().height || 0), quer: document.documentElement.scrollWidth > innerWidth || rr.scrollWidth > rr.clientWidth, klein };
          });
          if (breite === 2000) assert(m.thema === thema && m.n === 50 && m.ersteReihe >= 4 && m.hoch > 0 && m.hoch < 1150 && !m.quer && !m.klein.length,
            `A: 50 Mitglieder, 2000 x 1480, ${thema}: mindestens vier Karten je Reihe, Kartenfl\u00e4che unter 1150, kein Text unter 11 Punkt`, m);
          else assert(m.thema === thema && m.n === 50 && !m.quer, `A: 50 Mitglieder, 560, ${thema}: kein waagerechtes Rollen`, m);
          if (FOTO && ((breite === 2000 && thema === "dark") || (breite === 560 && thema === "light"))) {
            await warte(p, () => !!document.querySelector("#gildeFlaeche .gl-bild canvas"));
            await p.screenshot({ path: join(FOTO, `task-7-auswertung-${thema}-${breite}.png`) });
            if (breite === 2000) {
              const url = await p.evaluate(() => document.querySelector("#gildeFlaeche .gl-bild canvas")?.toDataURL("image/png") || "");
              if (url) writeFileSync(join(FOTO, "task-7-bild-dark.png"), Buffer.from(url.split(",")[1], "base64"));
            }
          }
        }
        assert(!s.fehler.length, `A: 50 Mitglieder, ${breite}: keine Seitenfehler`, s.fehler);
        await p.close();
      }
    }
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ "Aeltere zeigen" verschwindet an der Grenze von 3650 Tagen (Entscheidung 07.10.2026)
  {
    const vorher = datei().gilde;
    const rid = "raelter001";
    dateiSetzen({ ...vorher, reihen: [{ id: rid, titel: "Alt", start: "2016-10-06T20:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 60, erinnerungMin: 0, ausnahmen: {} }], anwesend: {} });
    const s = await oeffne({ uhr: UHR });
    const p = s.page;
    await gildeAuf(p);
    let klicks = 0;
    while (klicks < 60 && await p.$(`#gildeFlaeche [data-g="aelter"][data-r-id="${rid}"]`)) {
      await p.click(`#gildeFlaeche [data-g="aelter"][data-r-id="${rid}"]`);
      klicks++;
    }
    const aeltester = (await terme(p)).map((x) => x.d).sort()[0];
    assert(klicks < 60 && klicks >= 40 && aeltester >= "2016-10-06", "\u201e\u00c4ltere zeigen\u201c verschwindet, sobald die 3650-Tage-Grenze erreicht ist", { klicks, aeltester });
    assert(!s.fehler.length, "\u00c4ltere zeigen: keine Seitenfehler", s.fehler);
    await p.close();
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ 2. Englisch
  {
    const s = await oeffne({ lang: "en" });
    const p = s.page;
    await gildeAuf(p);
    const b = await blick(p);
    const en = txt(I18N.en["gilde.datenschutz"].replace(/<[^>]+>/g, ""));
    assert(b.datenschutz === en && b.datenschutz.includes("boro-gilde.json"), "2: der Datenschutz-Satz auf Englisch", { b: b.datenschutz, en });
    assert(b.tabs.map((x) => x.k).length === 4 && await p.evaluate(() => document.querySelector('#gildeTabs [data-gtab="mitglieder"]').textContent.trim()) === I18N.en["gilde.tab.mitglieder"],
      "2: die Reiter auf Englisch");
    await p.close();
  }
  // ------------------------------------------------------------ 8. Layout in drei Groessen und vier Themen
  for (const [breite, hoehe] of [[2000, 1480], [1280, 860], [560, 900]]) {
    const s = await oeffne({ breite, hoehe });
    const p = s.page;
    await gildeAuf(p);
    await reiter(p, "mitglieder");
    const idA = mitglied("Testperson A").id;
    await p.click(`#gildeFlaeche .gl-kachel[data-m-id="${idA}"]`);
    for (const thema of ["dark", "light", "tnl", "glas"]) {
      await p.evaluate((k) => document.querySelector(`#themeRow button[data-theme="${k}"]`)?.click(), thema);
      const m = await p.evaluate(() => {
        const r = document.querySelector("#gilde .wkrollt");
        const klein = [];
        for (const el of document.querySelectorAll("#gilde *")) {
          if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
          if (!el.getClientRects().length || el.closest(".vh,[hidden]")) continue;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs < 11) klein.push((el.className || el.tagName) + ":" + fs);
        }
        return { thema: document.documentElement.dataset.theme, quer: document.documentElement.scrollWidth > innerWidth || r.scrollWidth > r.clientWidth,
          sw: document.documentElement.scrollWidth, iw: innerWidth, klein };
      });
      assert(m.thema === thema && !m.quer, `8: ${breite} x ${hoehe}, ${thema}: kein waagerechtes Rollen`, m);
      if (thema === "dark") assert(!m.klein.length, `8: ${breite} x ${hoehe}: kein Text unter 11 Punkt`, m.klein);
    }
    if (breite === 2000) {
      const sp = await p.evaluate(() => [...document.querySelectorAll("#gildeFlaeche .gl-spalte")].map((x) => Math.round(x.getBoundingClientRect().top)));
      assert(sp.length >= 2 && new Set(sp).size === 1, "8: 2000 x 1480: die Rollenspalten stehen nebeneinander", sp);
    }
    assert(!s.fehler.length, `8: ${breite} x ${hoehe}: keine Seitenfehler`, s.fehler);
    await p.close();
  }
  // ------------------------------------------------------------ 9. Woerterbuch
  {
    const schluessel = (l) => Object.keys(I18N[l]).filter((k) => k === "tabs.gilde" || k.startsWith("gilde.")).sort();
    const de = schluessel("de"), en = schluessel("en");
    const brauch = ["tabs.gilde", "gilde.titel", "gilde.datenschutz", "gilde.tab.termine", "gilde.tab.mitglieder", "gilde.tab.auswertung", "gilde.anlegen",
      "gilde.name", "gilde.mitglied.neu", "gilde.mitglied.name", "gilde.mitglied.rolle", "gilde.mitglied.notiz", "gilde.mitglied.loesen",
      "gilde.mitglied.rueckgaengig", "gilde.rolle.tank", "gilde.rolle.heal", "gilde.rolle.dps", "gilde.rolle.keine",
      "gilde.fehler.speichern", "gilde.suche", "gilde.suche.platzhalter", "gilde.filter.alle", "gilde.filter.tank", "gilde.filter.heal",
      "gilde.filter.dps", "gilde.treffer", "gilde.keinTreffer", "gilde.waffe1", "gilde.waffe2", "gilde.klasseRolle", "gilde.rolleSelbst",
      // Aufgabe 6
      ...["neu", "titel", "start", "dauer", "wdh", "wdh.einmal", "wdh.woche", "wdh.tage", "bis", "erinnerung", "loesen", "aendern"].map((k) => "gilde.reihe." + k),
      ...["naechster", "vergangen", "ausfall", "verschieben", "zurueck", "alleDa"].map((k) => "gilde.termin." + k),
      ...["da", "fehlt", "offen"].map((k) => "gilde.marke." + k), ...[0, 1, 2, 3, 4, 5, 6].map((k) => "gilde.tag." + k),
      // Aufgabe 7
      ...["alle", "reihe", "quote", "dabei", "zuletzt", "keine", "sortierung.liste", "sortierung.name", "sortierung.quote",
        "sortierung.rolle"].map((k) => "gilde.ausw." + k), ...["text", "bild", "ics", "kopiert", "nichtKopiert", "bildKopf"].map((k) => "gilde.ausgabe." + k), "gilde.ics.name"];
    assert(JSON.stringify(de) === JSON.stringify(en) && brauch.every((k) => de.includes(k)), "9: alle Gilde-Schluessel in DE und EN",
      { nurDe: de.filter((k) => !en.includes(k)), nurEn: en.filter((k) => !de.includes(k)), fehlt: brauch.filter((k) => !de.includes(k)) });
    const probe = (v) => typeof v === "function" ? v({ n: 1, m: 2, name: "X", z: "1", wann: "W", titel: "T" }) : v;
    const bau = de.filter((k) => /\bBau\b/.test(probe(I18N.de[k])));
    assert(!bau.length, "9: kein \"Bau\" im deutschen Text", bau);
  }
  // ------------------------------------------------------------ 11. Neugestaltung: Tastenkuerzel, Streichen ueber Marken, Ziehen zur Ablage, Bewegung
  {
    const vorher = datei().gilde;
    const N = { A: "mneu000001", B: "mneu000002", C: "mneu000003" }, RN = "rneu000001";
    const mem = (id, name) => ({ id, name, rolle: "dps", waffen: [], notiz: "" });
    dateiSetzen({ id: "gneu000001", name: "Testgilde", mitglieder: [mem(N.A, "Testperson A"), mem(N.B, "Testperson B"), mem(N.C, "Testperson C")],
      reihen: [{ id: RN, titel: "Raid", start: "2026-09-11T20:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 120, erinnerungMin: 0, ausnahmen: {} }], anwesend: {} });
    const TK = `${RN}|2026-09-18`;
    const s = await oeffne({ uhr: UHR });
    const p = s.page;
    await gildeAuf(p);
    await p.click(`#gildeFlaeche .gl-term[data-termin="${TK}"]`);
    // D = da, N = nicht da, und der Fokus geht zum naechsten Mitglied
    await p.focus(`[data-f="a:${N.A}:da"]`);
    await p.keyboard.press("d");
    assert(await bis(() => datei().gilde.anwesend[TK]?.[N.A] === "da"), "11: D auf einer Marke setzt da", datei().gilde.anwesend);
    assert(await p.evaluate(() => (document.activeElement?.dataset.f || "").startsWith("a:mneu000002")), "11: der Fokus springt zum naechsten Mitglied", await p.evaluate(() => document.activeElement?.dataset.f));
    await p.keyboard.press("n");
    assert(await bis(() => datei().gilde.anwesend[TK]?.[N.B] === "fehlt"), "11: N auf einer Marke setzt nicht da", datei().gilde.anwesend);
    // Streichen: bei gedrueckter Maus ueber die Marken von A bis C setzt bei allen da
    const mitte = async (sel) => { const b = await p.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const a = await mitte(`[data-f="a:${N.B}:da"]`), c = await mitte(`[data-f="a:${N.C}:da"]`);
    await p.mouse.move(a.x, a.y);
    await p.mouse.down();
    await p.mouse.move(c.x, c.y, { steps: 6 });
    await p.mouse.up();
    assert(await bis(() => { const z = datei().gilde.anwesend[TK] || {}; return z[N.B] === "da" && z[N.C] === "da" && z[N.A] === "da"; }), "11: Streichen ueber Marken setzt bei allen dieselbe", datei().gilde.anwesend);
    // Filter nach Marke: wer da ist und wer nicht
    const zeilen = () => p.evaluate(() => [...document.querySelectorAll("#gildeTermin .gl-anw .gl-name")].map((x) => x.textContent.trim()));
    const zahlen = () => p.evaluate(() => [...document.querySelectorAll("#gildeAnwFilter [role=radio]")].map((b) => b.querySelector(".wort").textContent + ":" + b.querySelector("em").textContent).join());
    assert(await zahlen() === "Alle:3,Da:3,Nicht da:0,Offen:0", "11: der Filter nennt je Marke die Zahl", await zahlen());
    await p.click(`[data-f="a:${N.B}:fehlt"]`);
    assert(await bis(() => datei().gilde.anwesend[TK]?.[N.B] === "fehlt"), "11: B auf nicht da");
    await p.click('#gildeAnwFilter [data-af="fehlt"]');
    assert((await zeilen()).join() === "Testperson B", "11: Filter Nicht da zeigt nur B", await zeilen());
    await p.click('#gildeAnwFilter [data-af="da"]');
    assert((await zeilen()).join() === "Testperson A,Testperson C", "11: Filter Da zeigt A und C", await zeilen());
    await p.click('#gildeAnwFilter [data-af="offen"]');
    assert((await zeilen()).length === 0 && /Kein Treffer|Nichts|kein/i.test(await p.evaluate(() => document.querySelector("#gildeTermin .gl-leer")?.textContent || "")), "11: Filter Offen ohne Treffer sagt es", await zeilen());
    await p.click('#gildeAnwFilter [data-af="alle"]');
    assert((await zeilen()).length === 3, "11: Alle zeigt wieder alle drei");
    // Kuerzel ausserhalb von Eingaben: 2 = Mitglieder, / = Suche, 1 = Termine
    await p.evaluate(() => document.activeElement?.blur());
    await p.click("#gildeTerminT");
    await p.keyboard.press("2");
    assert(await warte(p, () => document.querySelector('#gildeTabs [data-gtab="mitglieder"]')?.getAttribute("aria-selected") === "true"), "11: Taste 2 waehlt Mitglieder");
    await p.keyboard.press("/");
    assert(await p.evaluate(() => document.activeElement?.id) === "gildeSuche", "11: Taste / springt in die Suche");
    await p.keyboard.type("2");
    assert(await p.inputValue("#gildeSuche") === "2" && await p.evaluate(() => document.querySelector('#gildeTabs [data-gtab="mitglieder"]').getAttribute("aria-selected")) === "true", "11: in der Suche ist 2 nur eine Eingabe");
    await p.fill("#gildeSuche", "");
    // Ziehen: die Ablage ist erst beim Ziehen da; ein Mitglied darauf fragt, ob es ausgetreten ist
    assert(await p.evaluate(() => document.getElementById("gildeAblage")?.hidden === true), "11: die Ablage ist anfangs verborgen");
    await p.evaluate((id) => {
      const dt = new DataTransfer();
      const k = document.querySelector(`.gl-kachel[data-m-id="${id}"]`);
      k.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
      const ab = document.getElementById("gildeAblage");
      ab.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
      ab.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    }, N.A);
    assert(await warte(p, () => !!document.querySelector('#gildeEdit [data-g="austrJa"]')), "11: ein Mitglied auf die Ablage fragt, ob es ausgetreten ist");
    assert(!datei().gilde.mitglieder.find((m) => m.id === "mneu000001").geloest, "11: gefragt, noch nichts gelost");
    await p.click('[data-g="austrJa"]');
    assert(await bis(() => datei().gilde.mitglieder.find((m) => m.id === "mneu000001").geloest === true), "11: nach Ja ist es geloest (die Datei behaelt es)");
    // das Ziehen innerhalb der Seite zeigt nicht die Ablage fuer Log-Dateien, eine Datei von aussen schon
    const ueber = (mitDatei) => p.evaluate((d) => {
      const dt = new DataTransfer();
      if (d) dt.items.add(new File(["x"], "a.txt"));
      else dt.setData("text/plain", "x");
      window.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
      const an = document.querySelector("#dropOverlay").classList.contains("on");
      window.dispatchEvent(new DragEvent("dragleave", { bubbles: true, cancelable: true, dataTransfer: dt }));
      return an;
    }, mitDatei);
    assert(await ueber(false) === false, "11: ein Ziehen innerhalb der Seite blendet \"Loslassen, um das Log zu lesen\" nicht ein");
    assert(await ueber(true) === true && await p.evaluate(() => !document.querySelector("#dropOverlay").classList.contains("on")), "11: eine Datei von aussen blendet es ein und beim Verlassen wieder aus");
    // Bewegung: ein Reiterwechsel baut sich einmal ein, bei reduzierter Bewegung nie
    await reiter(p, "termine");
    assert(!s.fehler.length, "11: keine Seitenfehler", s.fehler);
    await p.close();
    const r = await oeffne({ uhr: UHR, init: () => { window.__ruhig = true; } });
    await r.page.emulateMedia({ reducedMotion: "reduce" });
    await gildeAuf(r.page);
    await reiter(r.page, "mitglieder");
    assert(await r.page.evaluate(() => !document.getElementById("gildeFlaeche").classList.contains("gl-ein")), "11: bei reduzierter Bewegung baut sich nichts ein");
    await r.page.close();
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ 12. Gelöstes endgültig löschen (#240): Mitglieder und Arten, mit Namen und Sicherung
  {
    const vorher = datei().gilde;
    const SDIR = join(work, "Borometer", "sicherungen");
    const sich = () => (existsSync(SDIR) ? readdirSync(SDIR).sort() : []);
    const gl = () => ({ id: "gloesch001", name: "Loeschgilde", mitglieder: [
      { id: "mloe000001", name: "Testperson A", rolle: "tank", waffen: ["Greatsword", "Sword and Shield"], notiz: "" },
      { id: "mloe000002", name: "Testperson B", rolle: "", waffen: [], notiz: "", geloest: true, ausgetreten: "2026-10-05" }],
      reihen: [{ id: "rloe000001", titel: "Raid", start: "2026-10-04T20:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 120, erinnerungMin: 15, ausnahmen: {} }],
      anwesend: { "rloe000001|2026-10-04": { mloe000001: "da", mloe000002: "fehlt" } },
      punkte: { an: true, rang: false, gruppen: false, schwellen: [8, 6], monat: 1, teiler: 100000, stichtag: "2026-10-01",
        arten: [{ id: "aloe000001", name: "Gildenboss", punkte: 1, proPunkt: 7 }, { id: "aloe000002", name: "Alter Raid", punkte: 1, proPunkt: 1, geloest: true }] } });
    rmSync(SDIR, { recursive: true, force: true });
    dateiSetzen(gl());
    const s = await oeffne();
    const p = s.page;
    await gildeAuf(p);
    await reiter(p, "mitglieder");
    await p.click('[data-f="ehemsum"]');
    const knopf = '#gildeFlaeche .gl-ehem [data-g="loeschFrage"]';
    assert(await warte(p, (k) => !!document.querySelector(k), knopf), "12: bei den Ehemaligen steht neben Zurückholen Endgültig löschen…");
    assert(await p.evaluate(() => document.querySelectorAll('#gildeFlaeche [data-g="loeschFrage"]').length) === 1, "12: nur beim ehemaligen Mitglied, nicht beim aktiven");
    await p.click(knopf);
    const frage = await p.evaluate(() => document.querySelector("#gildeFlaeche .gl-l-frage")?.textContent.replace(/\s+/g, " ").trim() || "");
    assert(/„Testperson B“ wird endgültig gelöscht/.test(frage) && /Sicherungsdatei im Ordner sicherungen/.test(frage) && /nicht rückgängig/.test(frage), "12: die Frage nennt das Löschen, die Sicherung und dass es nicht rückgängig geht", frage);
    assert(await p.evaluate(() => document.activeElement?.id === "gildeLoeschName"), "12: der Fokus steht im Namensfeld");
    const ja = () => p.evaluate(() => document.querySelector('[data-g="loeschJa"]')?.disabled);
    assert((await ja()) === true, "12: Endgültig löschen ist gesperrt, bis der Name stimmt");
    await p.fill("#gildeLoeschName", "Testperson");
    assert((await ja()) === true, "12: ein halber Name entsperrt nicht");
    assert(await p.evaluate(() => document.activeElement?.id === "gildeLoeschName"), "12: beim Tippen bleibt der Fokus im Feld");
    await p.click('[data-g="loeschNein"]');
    assert(!(await p.$("#gildeLoeschName")) && datei().gilde.mitglieder.length === 2 && !sich().length, "12: Abbrechen schliesst die Frage, nichts ist gelöscht, keine Sicherung");
    await p.click(knopf);
    await p.fill("#gildeLoeschName", " testperson B ");
    assert((await ja()) === false, "12: mit dem Namen (Gross/Klein und Rand egal) ist der Knopf frei");
    await p.click('[data-g="loeschJa"]');
    assert(await bis(() => datei().gilde.mitglieder.length === 1), "12: das ehemalige Mitglied ist aus der Datei", datei());
    assert(JSON.stringify(Object.keys(datei().gilde.anwesend["rloe000001|2026-10-04"])) === '["mloe000001"]', "12: samt seiner Marken, die des aktiven bleibt");
    assert(sich().length === 1 && /^gilde-vor-loeschen-\d{4}-\d{2}-\d{2}\.json$/.test(sich()[0]), "12: die Sicherungsdatei liegt im Ordner sicherungen", sich());
    assert(JSON.parse(readFileSync(join(SDIR, sich()[0]), "utf8")).gilde.mitglieder.length === 2, "12: sie haelt den Stand davor, mit dem Mitglied");
    await warte(p, () => !!document.querySelector("#gildeFlaeche .gl-meldung"), null);
    const satz = await p.evaluate(() => document.querySelector("#gildeFlaeche .gl-meldung")?.textContent.replace(/\s+/g, " ").trim() || "");
    assert(/„Testperson B“ endgültig gelöscht\./.test(satz) && /gilde-vor-loeschen-/.test(satz), "12: der Satz nennt das Gelöschte und die Sicherungsdatei", satz);
    assert(/endgültig gelöscht/.test(await p.evaluate(() => document.getElementById("gildeAnsage")?.textContent || "")), "12: der Vorleser sagt es an");
    assert(await warte(p, () => !document.querySelector(".gl-ehem"), null), "12: die Liste der Ehemaligen ist leer und verschwindet");
    // die Seite hat neu gelesen: ein neues Mitglied bringt das gelöschte nicht zurück
    await p.click("#gildeMNeu");
    await p.keyboard.type("Testperson C");
    await p.focus("#gildeEName");
    await p.keyboard.press("Enter");
    assert(await bis(() => datei().gilde.mitglieder.map((m) => m.name).join() === "Testperson A,Testperson C"), "12: ein späterer Put bringt das Gelöschte nicht zurück", datei().gilde.mitglieder.map((m) => m.name));
    // Arten
    await reiter(p, "punkte");
    await p.click('#gildeFlaeche [data-g="pRegeln"]');
    await p.click('#gildeFlaeche [data-g="loeschFrage"][data-was="art"]');
    assert(/„Alter Raid“ wird endgültig gelöscht/.test(await p.evaluate(() => document.querySelector("#gildeFlaeche .gl-l-frage")?.textContent || "")), "12: bei den gelösten Arten gibt es dieselbe Frage");
    await p.fill("#gildeLoeschName", "Alter Raid");
    await p.click('[data-g="loeschJa"]');
    assert(await bis(() => datei().gilde.punkte.arten.length === 1 && datei().gilde.punkte.arten[0].id === "aloe000001"), "12: die gelöste Art ist weg, die aktive bleibt", datei().gilde.punkte.arten);
    assert(sich().length === 2, "12: eine zweite Sicherung, die erste bleibt", sich());
    assert(!s.fehler.length, "12: keine Seitenfehler", s.fehler);
    await p.close();
    // 560 px, vier Themen: die Frage passt, kein Rot und Grün
    for (const thema of ["dark", "light", "tnl", "glas"]) {
      dateiSetzen(gl());
      const r = await oeffne({ breite: 560, hoehe: 900, thema });
      await gildeAuf(r.page);
      await reiter(r.page, "mitglieder");
      await r.page.click('[data-f="ehemsum"]');
      await r.page.click('#gildeFlaeche .gl-ehem [data-g="loeschFrage"]');
      const m = await r.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        rg: [...document.querySelectorAll(".gl-l-frage *")].filter((e) => e.children.length === 0 && (e.textContent || "").trim()).map((e) => getComputedStyle(e).color) }));
      assert(m.sw <= m.cw, "12: " + thema + " 560 px: kein waagerechtes Rollen mit der Frage", m);
      assert(!m.rg.some((c) => rotGruen(c)), "12: " + thema + ": die Frage nutzt weder Rot noch Grün", m.rg);
      assert(!r.fehler.length, "12: " + thema + ": keine Seitenfehler", r.fehler);
      await r.page.close();
    }
    // Englisch und Woerterbuch
    dateiSetzen(gl());
    const e = await oeffne({ lang: "en" });
    await gildeAuf(e.page);
    await reiter(e.page, "mitglieder");
    await e.page.click('[data-f="ehemsum"]');
    await e.page.click('#gildeFlaeche .gl-ehem [data-g="loeschFrage"]');
    assert(/will be deleted for good/.test(await e.page.evaluate(() => document.querySelector("#gildeFlaeche .gl-l-frage")?.textContent || "")), "12: Englisch: die Frage ist übersetzt");
    await e.page.close();
    const de = Object.keys(I18N.de).filter((k) => k.startsWith("gilde.loeschen.")), en = Object.keys(I18N.en).filter((k) => k.startsWith("gilde.loeschen."));
    assert(de.length >= 11 && JSON.stringify(de.sort()) === JSON.stringify(en.sort()), "12: dieselben Schlüssel gilde.loeschen.* in Deutsch und Englisch", { de: de.length, en: en.length });
    dateiSetzen(vorher);
  }
  // ------------------------------------------------------------ 10. Ohne App
  {
    const s = await oeffne({ ohneGilde: true });
    await gildeAuf(s.page);
    const b = await blick(s.page);
    assert(/Nur in der App/.test(b.flaeche) && !(await s.page.$("#gildeNeuName")) && !b.filter, "10: Helfer ohne /api/gilde: \"Nur in der App\" statt der Felder", b);
    await s.page.close();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const fehler = [], netz = [];
    page.on("pageerror", (e) => fehler.push(String(e)));
    page.on("request", (r) => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:")) netz.push(r.url()); });
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* blockiert */ } });
    await page.goto(DATEI);
    await page.waitForFunction(() => !!document.querySelector('#bereiche [data-tab="gilde"]'));
    await gildeAuf(page);
    const f = await blick(page);
    assert(/Nur in der App/.test(f.flaeche) && !(await page.$("#gildeNeuName")), "10: Datei-Modus: \"Nur in der App\"", f.flaeche);
    assert(!netz.length && !fehler.length, "10: Datei-Modus: keine Anfrage, kein Fehler", { netz, fehler });
    await page.close();
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exitCode = failed ? 1 : 0;
