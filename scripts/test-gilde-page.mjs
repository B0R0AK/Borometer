// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Bereich Gilde an der gebauten Seite (Spezifikation
// docs/superpowers/specs/2026-10-06-gilde-design.md, 5; Plan Aufgabe 5 mit dem
// Nachtrag nach Entwurf 2): Leistenknopf zwischen Weeklies und Rekorden, der
// Datenschutz-Satz, Gilde anlegen, die drei Reiter, Suche und Rollenfilter,
// der Reiter Mitglieder mit Waffenpaar, Rolle, Loesen und Rueckgaengig, "Aus der
// Gruppe uebernehmen", Tastatur, Fokusring, die Groessen 2000 x 1480, 1280 x
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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const ende = Date.now() + ms;
  while (Date.now() < ende) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
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
    assert(b1.tabs.length === 3 && b1.tabs.map((x) => x.k).join() === "termine,mitglieder,auswertung" && b1.tabs[0].sel === "true"
      && b1.tabs.filter((x) => x.ti === 0).length === 1, "4: drei Reiter, Termine gewaehlt, ein Tabstopp", b1.tabs);
    assert(await p.evaluate(() => document.querySelector("#gildeTabs").getAttribute("role") === "tablist"
      && document.querySelector("#gildeFlaeche").getAttribute("role") === "tabpanel"), "4: tablist und tabpanel");
    await p.focus('#gildeTabs [data-gtab="termine"]');
    await p.keyboard.press("ArrowRight");
    const b2 = await blick(p);
    const fokus = await p.evaluate(() => document.activeElement?.dataset.gtab);
    assert(b2.tabs[1].sel === "true" && b2.tabs[0].sel === "false" && fokus === "mitglieder", "4: Pfeil rechts waehlt Mitglieder, der Fokus folgt", { tabs: b2.tabs, fokus });
    await p.keyboard.press("End");
    assert((await blick(p)).tabs[2].sel === "true", "4: Ende waehlt den letzten Reiter");
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
    const aus0 = await p.evaluate(() => ({ aus: document.querySelector("#gildeAusGruppe")?.disabled,
      satz: document.querySelector("#gildeAusGruppeSatz")?.textContent.trim() }));
    assert(aus0.aus === true && /noch keine Gruppe/.test(aus0.satz || ""), "5: ohne Gruppe ist \"Aus der Gruppe uebernehmen\" aus, mit Satz", aus0);
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
  // ------------------------------------------------------------ Aus der Gruppe uebernehmen
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
    assert(await p.evaluate(() => document.querySelector("#gildeAusGruppe")?.disabled === false), "Gruppe: mit Gruppe ist der Knopf an");
    await p.click("#gildeAusGruppe");
    const wahl = await p.evaluate(() => [...document.querySelectorAll('#gildeUebernahme input[type="checkbox"]')].map((x) => x.dataset.name + "|" + x.checked));
    assert(JSON.stringify(wahl) === JSON.stringify(["Testperson C|false", "Testperson D|false"]),
      "Gruppe: nur Namen, die noch nicht in der Liste stehen, je mit eigenem Haken", wahl);
    await p.check('#gildeUebernahme input[data-name="Testperson C"]');
    await p.click('#gildeUebernahme [data-g="uebernehmen"]');
    assert(await bis(() => !!mitglied("Testperson C") && !mitglied("Testperson D")), "Gruppe: nur der bestaetigte Name kommt in die Datei", datei()?.gilde?.mitglieder);
    assert(vorher.mitglieder.every((m) => datei().gilde.mitglieder.some((n) => n.id === m.id)), "Gruppe: kein vorhandenes Mitglied fehlt danach");
    assert(!s.fehler.length, "Gruppe: keine Seitenfehler", s.fehler);
    await p.close();
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
    assert(await warte(p, () => document.querySelectorAll("#gildeTabs [role=tab]").length === 3), "Laden: nach dem Lesen stehen die Reiter");
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
    assert(await bis(() => s.gets === 2) && await warte(p, () => document.querySelectorAll("#gildeTabs [role=tab]").length === 3) && !s.posts.length,
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
  // ------------------------------------------------------------ Hoechstens 100 Mitglieder, auch ueber Entwurf und Gruppe
  {
    const vorher = datei().gilde;
    const rest = Array.from({ length: 99 - vorher.mitglieder.length }, (_, i) =>
      ({ id: "mvoll" + String(i).padStart(5, "0"), name: "Fuellung " + i, rolle: "dps", waffen: [], notiz: "" }));
    dateiSetzen({ ...vorher, mitglieder: [...vorher.mitglieder, ...rest] });
    assert(datei().gilde.mitglieder.length === 99, "Grenze: 99 Mitglieder in der Datei");
    const s = await oeffne();
    const p = s.page;
    const reihe = (name, dps) => ({ name, dps, damage: dps * 60, seconds: 60, waiting: false, target: "Fellinex" });
    const glPfad = join(work, "gruppe-voll.json");
    writeFileSync(glPfad, JSON.stringify({ boroPartyLog: 1, when: new Date(Date.UTC(2026, 9, 4, 20)).toISOString(), code: "RAID", target: "Fellinex", history: [],
      board: [reihe("Testperson X", 40000), reihe("Testperson Y", 30000)] }));
    await p.setInputFiles("#partyLogInput", glPfad);
    await p.waitForTimeout(300);
    await gildeAuf(p);
    await reiter(p, "mitglieder");
    // ein Entwurf bei 99, dann zwei aus der Gruppe angehakt: nur einer passt noch
    await p.click("#gildeMNeu");
    await p.click("#gildeAusGruppe");
    await p.check('#gildeUebernahme input[data-name="Testperson X"]');
    await p.check('#gildeUebernahme input[data-name="Testperson Y"]');
    await p.click('#gildeUebernahme [data-g="uebernehmen"]');
    assert(await bis(() => datei().gilde.mitglieder.length === 100), "Grenze: aus der Gruppe nur so viele, wie bis 100 passen", datei().gilde.mitglieder.length);
    // der offene Entwurf bekommt jetzt einen Namen: er darf nicht der 101. werden
    await p.fill("#gildeEName", "Testperson Z");
    await p.waitForTimeout(800);
    const b = await p.evaluate(() => ({ neu: document.querySelector("#gildeMNeu")?.disabled, satz: document.querySelector("#gildeMaxSatz")?.textContent || "" }));
    assert(datei().gilde.mitglieder.length === 100 && !mitglied("Testperson Z") && s.posts.every((x) => x.put === "saved")
      && s.posts.every((x) => x.data.gilde.mitglieder.length <= 100),
      "Grenze: der Entwurf wird bei 100 nicht angehaengt, kein gesendeter Stand ueber 100, keiner abgelehnt",
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
    assert(gr.length === 3 && ga?.label === "Testperson A, 04.10.2026" && gr.every((x) => x.radios.length === 3 && x.radios.map((y) => y.k).join() === "da,fehlt,entschuldigt"),
      "T3: je Mitglied eine Radiogruppe mit drei Marken (da, nicht da, entschuldigt), beschriftet mit Name und Datum", gr);
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
    f = await p.evaluate(() => ({ id: document.activeElement?.closest(".gl-marken")?.dataset.mId, an: document.querySelectorAll('#gildeFlaeche [role="radio"][aria-checked="true"]').length }));
    assert(f.id === B.id && f.an === 0, "T4: Pfeil ab wechselt zum naechsten Mitglied, ohne eine Marke zu setzen", f);
    await p.keyboard.press("ArrowUp");
    assert(await p.evaluate((id) => document.activeElement?.closest(".gl-marken")?.dataset.mId === id, A.id), "T4: Pfeil auf zurueck zum vorigen Mitglied");
    // 5. Alle da
    await p.click('#gildeFlaeche [data-g="alleDa"]');
    assert(await bis(() => [A, B, C].every((m) => datei().gilde.anwesend[key]?.[m.id] === "da") && !(D.id in datei().gilde.anwesend[key])),
      "T5: \"Alle da\" setzt alle offenen auf da, geloeste nicht", datei().gilde.anwesend);
    tl = await terme(p);
    assert(/3\/3/.test(tl.find((x) => x.d === "2026-10-04")?.stand || ""), "T5: die Liste zeigt 3/3 abgehakt", tl);
    // Fix 4: "Alle da" ueberschreibt nie "nicht da" oder "entschuldigt" und fuellt auch, was der Filter ausblendet
    await p.click('#gildeFlaeche .gl-term[data-datum="2026-10-18"]');
    const k18 = r.id + "|2026-10-18";
    await p.click(`#gildeFlaeche .gl-marken[data-m-id="${A.id}"] [data-marke="fehlt"]`);
    await p.click(`#gildeFlaeche .gl-marken[data-m-id="${B.id}"] [data-marke="entschuldigt"]`);
    await p.click('#gildeFilter [role="radio"][data-rolle="tank"]');
    await p.click('#gildeFlaeche [data-g="alleDa"]');
    assert(await bis(() => { const z = datei().gilde.anwesend[k18] || {}; return z[A.id] === "fehlt" && z[B.id] === "entschuldigt" && z[C.id] === "da" && !(D.id in z); }),
      "T5: Alle da fuellt nur offene (auch vom Filter ausgeblendete), nicht da und entschuldigt bleiben, geloeste nie", datei().gilde.anwesend[k18]);
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
    await p.click(`#gildeFlaeche .gl-marken[data-m-id="${B.id}"] [data-marke="entschuldigt"]`);
    assert(await bis(() => datei().gilde.anwesend[r.id + "|2026-10-11"]?.[B.id] === "entschuldigt"),
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
            leer: [...document.querySelectorAll('#gildeFlaeche [role="radio"]')].filter((x) => !x.textContent.trim() || !x.querySelector("svg") || !x.getAttribute("aria-label") || !x.title).length,
            klein };
        });
        assert(m.thema === thema && !m.quer, `T10: ${breite}, ${thema}: kein waagerechtes Rollen`, m);
        assert(m.farben.length === 3 && !m.leer && ![...m.farben, m.plakette].some(rotGruen), `T9: ${breite}, ${thema}: jede Marke mit Symbol und Wort, keine in Rot oder Gruen`, m);
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
            quer: document.documentElement.scrollWidth > innerWidth || rr.scrollWidth > rr.clientWidth, gruppen: document.querySelectorAll('#gildeFlaeche [role="radiogroup"]').length };
        });
        const sch = m.spalten.find((x) => x.titel === "Schaden");
        if (breite === 2000) {
          assert(m.thema === thema && m.gruppen === 50 && m.hoch > 0 && m.hoch < 1150 && sch?.n === 32 && sch.ersteReihe >= 3 && !m.quer,
            `Anwesenheit, 50 Mitglieder, 2000 x 1480, ${thema}: Kachelflaeche unter 1150, Schaden mindestens drei je Reihe`, m);
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
        && x.zahlen[0] === (z.da + z.fehlt ? z.da + "/" + (z.da + z.fehlt) : "\u2013") && x.zahlen[1] === String(z.straehne)
        && (!z.entschuldigt || x.text.includes(z.entschuldigt + " entschuldigt"));
    });
    {
      const s = await oeffne({ uhr: AUHR, init: STUB });
      const p = s.page;
      await gildeAuf(p);
      await reiter(p, "auswertung");
      // 1. Je Mitglied Quote, Dabei, Straehne, zuletzt; 2. Alle Reihen oder eine
      let ks = await karten(p);
      const wahl = await p.evaluate(() => ({ reihe: [...(document.querySelector("#gildeAReihe")?.options || [])].map((o) => o.value + "|" + o.textContent),
        sort: [...(document.querySelector("#gildeASort")?.options || [])].map((o) => o.value),
        labels: ["gildeAReihe", "gildeASort"].filter((id) => !document.querySelector(`label[for="${id}"]`)) }));
      assert(wahl.reihe.join() === "|Alle Reihen,rausw00001|Raid,rausw00002|Training" && wahl.sort.join() === "liste,name,quote,rolle" && !wahl.labels.length,
        "A2: Reihe (Alle Reihen, Raid, Training) und Reihenfolge (Liste, Name, Quote, Rolle) mit Label", wahl);
      assert(passt(ks, erwartet(null)), "A2: Alle Reihen: die Zahlen wie im Kern (beide Reihen)", { ks, z: erwartet(null) });
      await p.selectOption("#gildeAReihe", raid.id);
      ks = await karten(p);
      assert(passt(ks, erwartet([raid.id])), "A2: Raid: die Zahlen wie im Kern (nur Raid)", { ks, z: erwartet([raid.id]) });
      const a = ks.find((x) => x.id === A.id), b = ks.find((x) => x.id === B.id);
      assert(a?.quote === "100\u00a0%" && a.zahlen.join("|").startsWith("3/3|3|25.10.") && a.text.includes("1 entschuldigt")
        && b?.quote === "75\u00a0%" && b.zahlen.join("|") === "3/4|2|25.10.",
        "A1: A 100 % (3/3, Str\u00e4hne 3, 25.10., 1 entschuldigt), B 75 % (3/4, Str\u00e4hne 2), gesch\u00fctztes Leerzeichen vor %", { a, b });
      // 9. Vorleser: je Karte ein Satz
      assert(b?.satz === "Testperson B: 75 Prozent, Str\u00e4hne 2, zuletzt 25.10.", "A9: die Karte liest sich als Satz", b?.satz);
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
      const worte = { kopf: I18N.de["gilde.ausgabe.bildKopf"], reihe: "Raid", treffer: "", straehne: I18N.de["gilde.ausw.straehne"],
        zuletzt: I18N.de["gilde.ausw.text.zuletzt"], entschuldigt: I18N.de["gilde.ausw.text.entschuldigt"], offen: "\u2013",
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
      assert(b?.zahlen[2] === "10/25" && b.satz.includes("10/25"), "A1: Englisch: zuletzt 10/25", b);
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
    assert(b.tabs.map((x) => x.k).length === 3 && await p.evaluate(() => document.querySelector('#gildeTabs [data-gtab="mitglieder"]').textContent.trim()) === I18N.en["gilde.tab.mitglieder"],
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
      "gilde.mitglied.rueckgaengig", "gilde.mitglied.ausGruppe", "gilde.rolle.tank", "gilde.rolle.heal", "gilde.rolle.dps", "gilde.rolle.keine",
      "gilde.fehler.speichern", "gilde.suche", "gilde.suche.platzhalter", "gilde.filter.alle", "gilde.filter.tank", "gilde.filter.heal",
      "gilde.filter.dps", "gilde.treffer", "gilde.keinTreffer", "gilde.waffe1", "gilde.waffe2", "gilde.klasseRolle", "gilde.rolleSelbst",
      // Aufgabe 6
      ...["neu", "titel", "start", "dauer", "wdh", "wdh.einmal", "wdh.woche", "wdh.tage", "bis", "erinnerung", "loesen", "aendern"].map((k) => "gilde.reihe." + k),
      ...["naechster", "vergangen", "ausfall", "verschieben", "zurueck", "alleDa"].map((k) => "gilde.termin." + k),
      ...["da", "fehlt", "entschuldigt", "offen"].map((k) => "gilde.marke." + k), ...[0, 1, 2, 3, 4, 5, 6].map((k) => "gilde.tag." + k),
      // Aufgabe 7
      ...["alle", "reihe", "quote", "dabei", "straehne", "zuletzt", "entschuldigt", "keine", "sortierung.liste", "sortierung.name", "sortierung.quote",
        "sortierung.rolle"].map((k) => "gilde.ausw." + k), ...["text", "bild", "ics", "kopiert", "nichtKopiert", "bildKopf"].map((k) => "gilde.ausgabe." + k), "gilde.ics.name"];
    assert(JSON.stringify(de) === JSON.stringify(en) && brauch.every((k) => de.includes(k)), "9: alle Gilde-Schluessel in DE und EN",
      { nurDe: de.filter((k) => !en.includes(k)), nurEn: en.filter((k) => !de.includes(k)), fehlt: brauch.filter((k) => !de.includes(k)) });
    const probe = (v) => typeof v === "function" ? v({ n: 1, m: 2, name: "X", z: "1", wann: "W", titel: "T" }) : v;
    const bau = de.filter((k) => /\bBau\b/.test(probe(I18N.de[k])));
    assert(!bau.length, "9: kein \"Bau\" im deutschen Text", bau);
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
