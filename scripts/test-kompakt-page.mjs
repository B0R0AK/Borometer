// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Kompakt neu, Panel (Spezifikation docs/superpowers/specs/2026-10-21-kompakt-neu-design.md, Issue #287; davor
// 2026-10-14-kompakt-neu-design.md, #241): der Streifen als flaches Panel mit Zeilen (Name sichtbar), dem Knopf "+N weitere",
// der aufklappt, mit der Ansicht Weeklies, an der gebauten Seite, vom gestellten
// Helfer ausgeliefert (page.route) wie in test-glas-page.mjs. Bei jeder Zoomstufe (75 bis 200 %) und jeder Breite
// (300 Punkt Fenster, in Fenstergroesse gerechnet): nichts ueberlappt, kein Wort steht senkrecht, nichts ist
// abgeschnitten ohne Rollen (wie die Probe der Analyse, #236). Dazu: Abhaken zaehlt und schreibt, Tastatur und
// Ansage, der Punkt am Reiter, Durchklick, die Fenstergroesse. Nur erfundene Namen und Zahlen.
//
// Run:  npm run test:kompakt-page     (baut die Seite zuerst)
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 700))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Ein erfundener Stand der Weeklies: drei Charaktere, einige Zaehler, eine Erinnerung fuer Montag 18:00. */
const jetzt0 = new Date(2026, 9, 12, 18, 30);   // Montag 12.10.2026, 18:30 lokale Zeit
function stand0() {
  const z = (stand) => ({ stand, seit: jetzt0.getTime() });
  return { v: 1, profile: [
    { id: "c000000001", name: "Alpha", zaehler: { zitadelleNormal: z(1), illusionen: z(2), dimensionDungeons: z(4), goldeneKiste: z(5), phantomstein: z(1) }, aus: [], namen: {}, eigene: [] },
    { id: "c000000002", name: "Beta", zaehler: {}, aus: [], namen: {}, eigene: [] },
    { id: "c000000003", name: "Gamma mit einem sehr langen Namen", zaehler: {}, aus: [], namen: {}, eigene: [] },
  ], erinnerungen: [{ id: "e000000001", an: true, tage: [1], zeit: "18:00", text: "x", nurOffen: true }] };
}

/* Eine Seite im Kompakt. zoom: Prozent (uiZoom), lang, theme, weeklies: der Stand (null = die Datei fehlt: nur App),
   zeit: fester Zeitpunkt. Der Streifen bekommt die Groesse, die er selbst bestellt (POST /api/win, in Fensterpunkten:
   300 mal Zoom breit); gewartet wird, bis sie sich nicht mehr aendert. Mitgeschrieben: s.win, s.posts (Weeklies). */
async function oeffne({ zoom = 100, lang = "en", theme = "dark", weeklies = stand0(), zeit = jetzt0, ansicht = "kampf", config = {}, beispiel = true, bildschirm = null, adresse = "" } = {}) {
  const page = await browser.newPage({ viewport: { width: Math.round(300 * zoom / 100), height: 400 } });
  const s = { page, fehler: [], win: [], posts: [], stand: weeklies, handN: 0, evN: 0 };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  /* setViewportSize setzt screen auf die Fenstergroesse zurueck; der Bildschirm wird darum selbst gestellt */
  if (bildschirm) await page.addInitScript((b) => { for (const [k, v] of [["availWidth", b.width], ["availHeight", b.height], ["width", b.width], ["height", b.height]]) Object.defineProperty(screen, k, { get: () => v }); }, bildschirm);
  if (zeit) await page.clock.setFixedTime(zeit);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/state") return json({ dir: "", file: "", nativeFrame: false, material: false, stayOnTop: false });
    if (path === "/api/config" && req.method() === "GET") return json({ theme, uiZoom: zoom, ...config });
    if (path === "/api/config") return json({ ok: true });
    if (path === "/api/weeklies") {
      if (req.method() === "POST") { const d = JSON.parse(req.postData() || "{}").data; s.posts.push(d); s.stand = d; return json({ ok: true }); }
      return s.stand ? json({ ok: true, data: s.stand }) : json({ ok: false }, 404);
    }
    if (path === "/api/win") {
      const a = req.method() === "POST" ? JSON.parse(req.postData() || "{}") : {};
      if (a.do === "resize") s.win.push(a);
      return json({ ok: true, max: false, w: a.w || 300, h: a.h || 100, on_top: true });
    }
    if (path === "/api/events") { if (!url.searchParams.has("now")) await new Promise((r) => setTimeout(r, 1000)); s.evN++; return json({ ok: true, registered: true, counts: { kompakthand: s.handN } }); }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path === "/api/runs/list") return json({ folder: "saves", files: [] });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/" + adresse);
  await page.waitForFunction(() => document.body.dataset.bereit === "ohne");
  if (beispiel) {
    await page.evaluate(() => document.querySelector("#btnSample").click());
    await page.waitForFunction(() => !document.querySelector("#app").hidden);
  }
  await page.evaluate(() => document.querySelector("#btnCompact").click());
  await page.waitForFunction(() => document.body.classList.contains("compact"));
  if (ansicht === "weeklies") await page.evaluate(() => document.querySelector("#knTabW").click());
  await page.waitForTimeout(500);
  await passen(s, zoom);
  return s;
}
/* Das Fenster nimmt die bestellte Groesse an (der Helfer ist hier ein Stuck Browser): Viewport nachziehen, bis sie sich haelt. */
async function passen(s, zoom) {
  for (let i = 0; i < 4; i++) {
    const a = s.win[s.win.length - 1];
    if (!a) { await s.page.waitForTimeout(300); continue; }
    const vp = s.page.viewportSize();
    if (Math.abs(vp.width - a.w) <= 1 && Math.abs(vp.height - a.h) <= 1) break;
    await s.page.setViewportSize({ width: Math.round(a.w), height: Math.round(a.h) });
    await s.page.waitForTimeout(450);
  }
  s.groesse = s.win[s.win.length - 1];
}

/* Warten auf einen Zustand, nie auf eine feste Zeit (#224): bed laeuft im Browser, bis sie wahr ist. */
const warte = (page, bed, arg) => page.waitForFunction(bed, arg, { timeout: 8000 });
/* Warten, bis das Fenster eine Groesse bestellt hat, die bed erfuellt (s.win: was der Streifen beim Helfer bestellt). */
async function bisFenster(s, bed, name) {
  const ende = performance.now() + 8000;
  while (performance.now() < ende) {
    const a = s.win[s.win.length - 1];
    if (a && bed(a)) {
      // und bis der Streifen nichts Neues mehr bestellt (er misst sich ein zweites Mal nach): zwanzig Bilder lang gleich
      for (let still = 0, n = s.win.length; still < 20 && performance.now() < ende; ) {
        await s.page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
        if (s.win.length === n) still++; else { still = 0; n = s.win.length; }
      }
      return s.win[s.win.length - 1];
    }
    await s.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  throw new Error("Zeitablauf beim Warten auf: " + name + " (letzte Groesse " + JSON.stringify(s.win[s.win.length - 1]) + ")");
}

/* Die Messung im Browser: alle sichtbaren Bausteine des Streifens mit Kasten, Textbefunde und Ueberlappungen. */
async function messe(page) {
  return page.evaluate(() => {
    const sicht = (e) => { const cs = getComputedStyle(e); return cs.display !== "none" && cs.visibility !== "hidden" && e.getClientRects().length > 0; };
    const r4 = (e) => { const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height, r: q.right, b: q.bottom }; };
    const kaesten = [];
    const nimm = (sel, art) => document.querySelectorAll(sel).forEach((e, i) => { if (sicht(e) && !e.closest("[hidden]") && +getComputedStyle(e).opacity > 0) kaesten.push({ art, i, id: e.id || "", ...r4(e) }); });
    nimm(".kn-tabs", "tabs"); nimm("body:not(.kn-wk) .head", "kopf"); nimm("#kwk:not([hidden]) .kn-insel", "kopf");
    // Kampf (#328): die Liste rollt in sich; Zeilen ausserhalb ihres Kastens sind abgeschnitten und zaehlen nicht als Baustein
    const kb = document.querySelector("body:not(.kn-wk) #bars");
    document.querySelectorAll("body:not(.kn-wk) #bars .row:not(.sub):not(.kn-weg)").forEach((e, i) => {
      const q = e.getBoundingClientRect(), k = kb.getBoundingClientRect();
      if (sicht(e) && q.top >= k.top - 1 && q.bottom <= k.bottom + 1) kaesten.push({ art: "platte", i, id: "", ...r4(e) });
    });
    nimm("#kRest:not([hidden])", "rest"); nimm("#kwkRest", "rest");
    // Weeklies: wie im Kampf rollt die Liste in sich; Zeilen ausserhalb ihres Kastens sind abgeschnitten und zaehlen nicht
    const wb = document.querySelector("#kwkPlatten");
    document.querySelectorAll("#kwkPlatten .kn-wplatte").forEach((e, i) => {
      const q = e.getBoundingClientRect(), k = wb.getBoundingClientRect();
      if (sicht(e) && !e.closest("[hidden]") && q.top >= k.top - 1 && q.bottom <= k.bottom + 1) kaesten.push({ art: "wplatte", i, id: "", ...r4(e) });
    });
    nimm("body:not(.kn-wk) #bars", "kasten"); nimm("#kwkPlatten", "wkasten");
    // Textbefunde: jedes sichtbare Element mit eigenem Text im Streifen (ohne den nur fuer Vorleser da ist)
    const text = [];
    const feld = document.querySelector("#kwk:not([hidden])") ? "#kwk, .top" : ".head, #bars, #kRest, .top";
    document.querySelectorAll(feld.split(",").map((x) => x.trim() + " *").join(",")).forEach((e) => {
      const eigen = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!eigen || !sicht(e)) return;
      const q = e.getBoundingClientRect();
      if (q.width * q.height <= 4) return;
      if (e.closest(".kn-weg")) return;
      const cs = getComputedStyle(e);
      if (+cs.opacity === 0) return;
      // Zeilen des Textes: die Rechtecke der Textknoten
      const rg = document.createRange(); let zeilen = 0, hoch = false;
      for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) {
        rg.selectNodeContents(n);
        const ys = new Set([...rg.getClientRects()].map((c) => Math.round(c.top)));
        zeilen = Math.max(zeilen, ys.size);
        const t = n.textContent.trim();
        // senkrecht: viele Zeilen bei wenigen Zeichen je Zeile und ohne Leerzeichen
        if (ys.size >= 3 && !/\s/.test(t) && t.length / ys.size <= 1.6) hoch = true;
      }
      text.push({ sel: e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + "." + [...e.classList].slice(0, 2).join("."), t: e.textContent.trim().slice(0, 40),
        abgeschnitten: e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== "visible", ellipse: cs.textOverflow === "ellipsis", titel: !!(e.title || e.closest("[title]")),
        zeilen, hoch, rechts: q.right, unten: q.bottom, links: q.left });
    });
    return { kaesten, text, breite: innerWidth, hoehe: innerHeight, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight };
  });
}
/* Ueberlappungen: Paare der Kaesten, deren Schnitt mehr als 1 Punkt zum Quadrat hat (die Restplatte liegt absichtlich auf einer unsichtbaren Platte). */
function ueberlappen(k) {
  const aus = [];
  for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) {
    const a = k[i], b = k[j];
    const w = Math.min(a.r, b.r) - Math.max(a.x, b.x), h = Math.min(a.b, b.b) - Math.max(a.y, b.y);
    if (w > 1 && h > 1) aus.push(a.art + a.i + " x " + b.art + b.i);
  }
  return aus;
}
async function pruefeLage(s, name) {
  const m = await messe(s.page), tol = 1.5;
  const rand = m.kaesten.filter((k) => k.x < -tol || k.r > m.breite + tol);
  assert(m.scrollW <= m.breite + 1, name + ": kein waagerechtes Rollen (" + m.scrollW + " zu " + m.breite + ")");
  assert(rand.length === 0, name + ": jeder Baustein liegt in der Breite des Fensters", rand.map((k) => k.art + k.i + " " + Math.round(k.x) + ".." + Math.round(k.r)));
  // Kaesten, in denen gerollt wird, ueberlappen ihre Platten absichtlich nicht, enthalten sie aber: aus der Paarung nehmen
  const ue = ueberlappen(m.kaesten.filter((k) => k.art !== "kasten" && k.art !== "wkasten"));
  assert(ue.length === 0, name + ": nichts ueberlappt", ue.slice(0, 4));
  assert(!m.text.some((t) => t.hoch), name + ": kein Wort steht senkrecht", m.text.filter((t) => t.hoch).map((t) => t.sel + " " + t.t));
  const schnitt = m.text.filter((t) => t.abgeschnitten && !(t.ellipse && t.titel));
  assert(schnitt.length === 0, name + ": nichts ist abgeschnitten ohne Ellipse und title", schnitt.slice(0, 4).map((t) => t.sel + " '" + t.t + "'"));
  const platten = m.kaesten.filter((k) => k.art === "platte" || k.art === "wplatte" || k.art === "rest");
  // was gerollt wird, endet am Rand seines Kastens; der Kasten selbst endet im Fenster
  const tiefste = Math.max(0, ...m.kaesten.filter((k) => k.art !== "platte" && k.art !== "wplatte").map((k) => k.b));
  assert(tiefste <= m.hoehe + tol, name + ": nichts steht unter dem Fensterrand (" + Math.round(tiefste) + " zu " + m.hoehe + ")");
  const kasten = m.kaesten.find((k) => k.art === "kasten" || k.art === "wkasten");
  if (kasten) {
    const halb = m.kaesten.filter((k) => (k.art === "platte" || k.art === "wplatte") && k.y < kasten.b - 1 && k.b > kasten.b + 1);
    assert(halb.length === 0, name + ": keine halbe Platte am Rand des Kastens", halb.map((k) => k.art + k.i));
  }
  return { m, platten };
}

const ZOOM = [75, 100, 125, 150, 200];
// 1. die Lage: Zoom x Sprache im dunklen Thema, dazu die drei anderen Themen bei 100 und 200 %
const faelle = [];
for (const zoom of ZOOM) for (const lang of ["en", "de"]) faelle.push({ zoom, lang, theme: "dark" });
for (const theme of ["light", "tnl", "glas"]) for (const zoom of [100, 200]) faelle.push({ zoom, lang: "en", theme });
for (const f of faelle) {
  for (const ansicht of ["kampf", "weeklies"]) {
    const name = `${f.theme} ${f.zoom} % ${f.lang} ${ansicht}`;
    const s = await oeffne({ ...f, ansicht });
    const g = s.groesse;
    assert(g && Math.abs(g.w - 300 * f.zoom / 100) <= 1, name + ": das Fenster ist 300 Punkt breit, in Fenstergroesse " + 300 * f.zoom / 100, g);
    const { platten } = await pruefeLage(s, name);
    assert(platten.length >= 5, name + ": mindestens fuenf Zeilen stehen da", platten.length);
    const namen = await s.page.evaluate(() => [...document.querySelectorAll("#bars .row:not(.sub):not(.kn-weg) .nmt, .kn-wplatte .kn-wn")].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().width));
    assert(namen.length >= 4 && namen.every((w) => w >= 30), name + ": der Name steht in jeder Zeile sichtbar da (mindestens 30 Punkt breit)", namen);
    const ganz = await s.page.evaluate(() => [...document.querySelectorAll('#bars .row:not(.sub):not(.kn-weg) .v[data-k="share"], .kn-wplatte .kn-m')]
      .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden").filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
    assert(ganz.length === 0, name + ": Anteil und Zaehler stehen ganz in ihrer Zeile", ganz);
    assert(s.fehler.length === 0, name + ": keine Fehler auf der Seite", s.fehler);
    await s.page.close();
  }
}
// 2. die Fenstergroesse folgt dem Inhalt: Kopf, fuenf Zeilen und der Hinweis; Rollen aendert sie nicht (#328)
{
  const s = await oeffne({ zoom: 100 });
  const hK = s.groesse.h;
  assert(hK >= 200 && hK <= 350, "Kampf: Leiste (26), Kopf, fuenf Zeilen und der Hinweis, rund 220 Punkt hoch", hK);
  const n0 = s.win.length;
  await s.page.mouse.move(150, 200);
  await s.page.mouse.wheel(0, 400);
  await warte(s.page, () => document.querySelector("#bars").scrollTop > 0);
  await bisFenster(s, () => true, "nichts Neues bestellt");
  assert(s.win.length === n0 || Math.abs(s.win[s.win.length - 1].h - hK) <= 2, "Rollen aendert die Fensterhoehe nicht", [hK, s.win.slice(n0)]);
  assert(await s.page.evaluate(() => document.querySelector("#bars").clientHeight) === 130, "die Liste ist fuenf mal 26 Punkt (24 Zeile, 2 Abstand) hoch");
  await s.page.evaluate(() => document.querySelector("#knTabW").click());
  await warte(s.page, () => document.querySelectorAll("#kwkPlatten .kn-wplatte").length > 0);
  await bisFenster(s, (a) => a.h !== hK, "Fenster misst sich fuer die Weeklies neu");
  await passen(s, 100);
  assert(s.groesse.h >= 200 && s.groesse.h <= 380, "Weeklies: Kopf und fuenf Zeilen", s.groesse.h);
  assert(s.groesse.w === 300, "die Breite bleibt 300", s.groesse.w);
  await s.page.close();
}
// 3. Reiter, Tastatur, Ansage
{
  const s = await oeffne({ zoom: 100 });
  const p = s.page;
  const lies = () => p.evaluate(() => ({ k: document.querySelector("#knTabK").getAttribute("aria-selected"), w: document.querySelector("#knTabW").getAttribute("aria-selected"),
    app: !document.querySelector("#app").hidden, kwk: !document.querySelector("#kwk").hidden, ansage: document.querySelector("#kwkAnsage").textContent,
    tab: document.querySelector("#knTabs").getAttribute("role"), tabindex: [document.querySelector("#knTabK").tabIndex, document.querySelector("#knTabW").tabIndex] }));
  let z = await lies();
  assert(z.k === "true" && z.w === "false" && z.app && !z.kwk && z.tab === "tablist", "Start: der Reiter Kampf, die Liste da, die Weeklies zu", z);
  await p.focus("#knTabK");
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(150);
  z = await lies();
  assert(z.w === "true" && z.kwk && !z.app && z.ansage === "Weeklies", "Pfeil rechts: Weeklies, der Streifen zeigt nur sie und sagt es an", z);
  assert(z.tabindex[0] === -1 && z.tabindex[1] === 0, "ein Tabstopp, auf dem gewaehlten Reiter", z.tabindex);
  assert(await p.evaluate(() => document.activeElement.id) === "knTabW", "der Fokus geht mit");
  await p.keyboard.press("Control+Shift+W");
  await p.waitForTimeout(150);
  z = await lies();
  assert(z.k === "true" && z.app && !z.kwk && z.ansage === "Fight", "Strg+Umschalt+W wechselt zurueck zu Kampf, mit Ansage", z);
  await p.keyboard.press("Control+Shift+W");
  await p.waitForTimeout(150);
  z = await lies();
  assert(z.w === "true" && z.kwk, "Strg+Umschalt+W wechselt wieder zu Weeklies", z);
  await s.page.close();
}
// 4. Abhaken: zaehlt, schreibt, sagt an; zurueck mit Umschalt-Klick, Rechtsklick und Ruecktaste; im Durchklick nur lesen
{
  const s = await oeffne({ zoom: 100, ansicht: "weeklies" });
  const p = s.page;
  const plattenKeys = () => p.evaluate(() => [...document.querySelectorAll("#kwkPlatten .kn-wplatte")].map((b) => b.dataset.k));
  const zahl = () => p.evaluate(() => document.querySelector(".kn-wkopf .kn-offen").firstChild.textContent);
  const sichtbareKeys = () => p.evaluate(() => { const k = document.querySelector("#kwkPlatten").getBoundingClientRect(); return [...document.querySelectorAll("#kwkPlatten .kn-wplatte")].filter((b) => { const q = b.getBoundingClientRect(); return q.top >= k.top - 1 && q.bottom <= k.bottom + 1; }).map((b) => b.dataset.k); });
  assert((await sichtbareKeys()).length === 5, "Weeklies zu: fuenf Zeilen im Bild, der Rest rollt", await sichtbareKeys());
  assert(await p.evaluate(() => { const l = document.querySelector("#kwkPlatten"); return l.scrollHeight > l.clientHeight + 20 && getComputedStyle(l).overflowY === "auto"; }), "Weeklies zu: die Liste traegt mehr Zeilen als sichtbar und rollt");
  {
    const n = await p.evaluate(() => document.querySelectorAll("#kwkPlatten .kn-wplatte").length);
    assert(await p.evaluate(() => document.querySelector("#kwkPlatten").getAttribute("aria-label")) === "Weeklies, rows 1 to 5 of " + n, "Weeklies zu: die Liste traegt fuer Vorleser einen Namen mit ihrem Ausschnitt", await p.evaluate(() => document.querySelector("#kwkPlatten").getAttribute("aria-label")));
    await p.evaluate(() => { const l = document.querySelector("#kwkPlatten"); l.scrollTop = l.scrollHeight; });
    await warte(p, () => !/rows 1 to/.test(document.querySelector("#kwkPlatten").getAttribute("aria-label")));
    assert(/^Weeklies, rows \d+ to \d+ of \d+$/.test(await p.evaluate(() => document.querySelector("#kwkPlatten").getAttribute("aria-label"))), "Weeklies zu: der Name folgt dem Rollen");
    await p.evaluate(() => { document.querySelector("#kwkPlatten").scrollTop = 0; });
    await warte(p, () => /rows 1 to/.test(document.querySelector("#kwkPlatten").getAttribute("aria-label")));
  }
  const wr = () => p.evaluate(() => { const k = document.querySelector("#kwkRest"); return k && { text: k.querySelector(".krestn").textContent, auf: k.getAttribute("aria-expanded"), name: k.getAttribute("aria-label"), tag: k.tagName }; });
  let w0 = await wr();
  assert(w0 && /^\+\d+$/.test(w0.text) && w0.auf === "false" && w0.tag === "BUTTON" && /^Show \d+ more items$/.test(w0.name), "unter den Zeilen steht der Knopf +n, zu", w0);
  await p.focus("#kwkRest"); await p.keyboard.press("Enter");
  await warte(p, () => document.querySelector("#kwkRest")?.getAttribute("aria-expanded") === "true" && document.activeElement?.id === "kwkRest");
  w0 = await wr();
  assert((await plattenKeys()).length > 5 && w0.auf === "true" && w0.text === "−" && w0.name === "Show fewer" && await p.evaluate(() => document.activeElement.id) === "kwkRest", "Klick klappt auf: alle offenen Punkte, der Knopf heisst weniger, der Fokus bleibt", { ...w0, n: (await plattenKeys()).length, fokus: await p.evaluate(() => document.activeElement.id + "/" + document.activeElement.tagName) });
  // ARIA: in der Liste stehen nur listitems, der Knopf steht daneben (zu und auf)
  for (const zustand of ["auf", "zu"]) {
    if (zustand === "zu") { await p.focus("#kwkRest"); await p.keyboard.press("Enter"); await warte(p, () => document.querySelector("#kwkRest")?.getAttribute("aria-expanded") === "false"); }
    const aria = await p.evaluate(() => ({ kinder: [...document.querySelector("#kwkPlatten").children].map((c) => c.getAttribute("role")), knopfInListe: !!document.querySelector("#kwkRest")?.closest('[role="list"]'), n: document.querySelector("#kwkPlatten").children.length }));
    assert(aria.n > 0 && aria.kinder.every((r) => r === "listitem") && !aria.knopfInListe, "Weeklies " + zustand + ": die Kinder der Liste sind nur listitems, der Knopf steht nicht in ihr", aria);
    if (zustand === "zu") { await p.focus("#kwkRest"); await p.keyboard.press("Enter"); await warte(p, () => document.querySelector("#kwkRest")?.getAttribute("aria-expanded") === "true"); }
  }
  const keys = await plattenKeys();
  assert(keys[0] === "vertragNyx" || /^(phantomstein|vertragNyx)$/.test(keys[0]), "die taeglichen Punkte stehen zuerst", keys.slice(0, 3));
  assert(!keys.includes("phantomstein"), "erledigte Punkte stehen nicht in der Liste (Phantomstein ist erledigt)");
  const vorher = Number(await zahl());
  // ein Punkt mit Menge 1
  await p.click('#kwkPlatten [data-k="zitadelleSchwer"]');
  await p.waitForTimeout(500);
  assert(Number(await zahl()) === vorher - 1, "Klick auf einen Punkt mit Menge 1: er ist erledigt, die Zahl der offenen sinkt um 1", [vorher, await zahl()]);
  assert(!(await plattenKeys()).includes("zitadelleSchwer"), "und er verschwindet aus der Liste");
  assert(s.posts.length >= 1 && s.posts[s.posts.length - 1].profile[0].zaehler.zitadelleSchwer?.stand === 1, "der ganze Stand ist geschrieben, der Zaehler steht auf 1", s.posts[s.posts.length - 1]?.profile[0].zaehler.zitadelleSchwer);
  assert((await p.textContent("#kwkAnsage")).includes("done") || (await p.textContent("#kwkAnsage")).includes("3"), "die Ansage nennt den Punkt", await p.textContent("#kwkAnsage"));
  // ein Zaehler mit Menge 3 (Halle der Illusionen steht auf 2)
  await p.click('#kwkPlatten [data-k="illusionen"]');
  await p.waitForTimeout(300);
  const s3 = s.posts[s.posts.length - 1].profile[0].zaehler.illusionen?.stand;
  assert(s3 === 3, "Klick zaehlt von 2 auf 3 (voll)", s3);
  // Umschalt-Klick im Raster zurueck: der Punkt ist weg; ueber einen anderen testen: Dimensions-Dungeons 4 von 7
  await p.click('#kwkPlatten [data-k="dimensionDungeons"]', { modifiers: ["Shift"] });
  await p.waitForTimeout(300);
  assert(s.posts[s.posts.length - 1].profile[0].zaehler.dimensionDungeons?.stand === 3, "Umschalt-Klick zaehlt zurueck (4 auf 3)", s.posts[s.posts.length - 1].profile[0].zaehler.dimensionDungeons);
  await p.click('#kwkPlatten [data-k="dimensionDungeons"]', { button: "right" });
  await p.waitForTimeout(300);
  assert(s.posts[s.posts.length - 1].profile[0].zaehler.dimensionDungeons?.stand === 2, "Rechtsklick zaehlt zurueck (3 auf 2)");
  await p.focus('#kwkPlatten [data-k="dimensionDungeons"]');
  await p.keyboard.press("Backspace");
  await p.waitForTimeout(300);
  assert(s.posts[s.posts.length - 1].profile[0].zaehler.dimensionDungeons?.stand === 1, "Ruecktaste zaehlt zurueck (2 auf 1)");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(300);
  assert(s.posts[s.posts.length - 1].profile[0].zaehler.dimensionDungeons?.stand === 2, "Eingabetaste zaehlt hoch (1 auf 2), der Fokus bleibt auf dem Punkt", await p.evaluate(() => document.activeElement.dataset.k));
  // Pfeiltasten wandern, ein Tabstopp
  await p.keyboard.press("ArrowDown");
  const k2 = await p.evaluate(() => document.activeElement.dataset.k), tabs = await p.evaluate(() => [...document.querySelectorAll("#kwkPlatten .kn-wplatte")].filter((b) => b.tabIndex === 0).length);
  assert(k2 && k2 !== "dimensionDungeons" && tabs === 1, "Pfeil runter wandert zur naechsten Zeile, genau ein Tabstopp", [k2, tabs]);
  // der Name steht in der Zeile selbst, nicht mehr beim Zeigen darueber
  const wz = await p.evaluate(() => { const z = document.querySelector('#kwkPlatten [data-k="regionszertifikat"]'); return { name: z.querySelector(".kn-wn")?.textContent, label: z.getAttribute("aria-label"), m: z.querySelector(".kn-m")?.textContent }; });
  assert(wz.name && wz.label.startsWith(wz.name) && /\d+/.test(wz.m || ""), "die Zeile zeigt Name und Stand und traegt beides im Namen fuer Vorleser", wz);
  /* Aufbau B: die Zeile der Weeklies ist 24 Punkt hoch wie im Kampf, ihre Fuellung zeigt den Fortschritt n/Menge (--w), deckend in der Reihenfarbe */
  const wzeilen = await p.evaluate(() => [...document.querySelectorAll("#kwkPlatten .kn-wplatte")].map((b) => {
    const m = /^(\d+)\/(\d+)$/.exec(b.querySelector(".kn-m")?.textContent ?? ""), f = b.querySelector(".kn-fuell"), br = b.getBoundingClientRect();
    return { h: br.height, w: parseFloat(getComputedStyle(b).getPropertyValue("--w")), n: m ? +m[1] / +m[2] : null, fuell: f ? f.getBoundingClientRect().width / br.width : null,
      deckend: f ? !/rgba\([^)]*,\s*0?\.\d+\)/.test(getComputedStyle(f).backgroundColor) : false };
  }));
  assert(wzeilen.length > 0 && wzeilen.every((z) => Math.abs(z.h - 24) < 0.6 && z.fuell !== null && z.deckend && (z.n === null || (Math.abs(z.w - z.n) < 0.01 && Math.abs(z.fuell - z.n) < 0.02))),
    "Weeklies: Zeile 24 Punkt hoch, die Fuellung zeigt den Fortschritt n/Menge und ist deckend", wzeilen);
  // Charakter wechseln (die Lesezeile zeigt wieder ihren Grund, sobald der Fokus die Platte verlaesst)
  await p.evaluate(() => document.activeElement.blur());
  await p.click("#knVor");
  await p.waitForTimeout(250);
  const name = await p.evaluate(() => document.querySelector(".kn-wkopf .kn-wer b").textContent);
  assert(name === "Beta", "der Pfeil wechselt zum naechsten Charakter", name);
  // Durchklick: nur lesen
  await p.evaluate(() => document.body.classList.add("through"));
  const n0 = s.posts.length;
  await p.click('#kwkPlatten .kn-wplatte');
  await p.waitForTimeout(400);
  assert(s.posts.length === n0, "im Durchklick zaehlt nichts und es wird nichts geschrieben");
  assert(s.fehler.length === 0, "keine Fehler auf der Seite", s.fehler);
  await s.page.close();
}
// 5. der Punkt am Reiter: Erinnerung faellig, etwas offen, Ansicht nicht gesehen
{
  const s = await oeffne({ zoom: 100 });
  const p = s.page;
  const punkt = () => p.evaluate(() => ({ da: !document.querySelector("#knHinweis").hidden, label: document.querySelector("#knTabW").getAttribute("aria-label") }));
  let z = await punkt();
  assert(z.da && /reminder/.test(z.label), "Montag 18:30, Erinnerung 18:00, offen: der Punkt steht, der Reiter sagt es", z);
  await p.evaluate(() => document.querySelector("#knTabW").click());
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector("#knTabK").click());
  await p.waitForTimeout(200);
  z = await punkt();
  assert(!z.da && z.label === "Weeklies", "nach dem Ansehen der Weeklies ist er weg", z);
  await s.page.close();
  const t = await oeffne({ zoom: 100, zeit: new Date(2026, 9, 12, 17, 30) });
  assert(!(await t.page.evaluate(() => !document.querySelector("#knHinweis").hidden)), "vor der Erinnerung (17:30): kein Punkt");
  await t.page.close();
  const u = await oeffne({ zoom: 100, weeklies: null });
  assert(!(await u.page.evaluate(() => !document.querySelector("#knHinweis").hidden)), "ohne Datei (nur App): kein Punkt");
  await u.page.evaluate(() => document.querySelector("#knTabW").click());
  await u.page.waitForTimeout(250);
  const satz = await u.page.evaluate(() => document.querySelector("#kwkLese").textContent);
  assert(/only in the app/.test(satz), "ohne Datei sagt die Ansicht den Satz statt der Platten", satz);
  await u.page.close();
}
// 6. Kampf (#328): fuenf Zeilen, das Mausrad rollt um ganze Zeilen, der Hinweis zaehlt mit, Tastatur, Name der Liste, die Gestalt
{
  const s = await oeffne({ zoom: 100 });
  const p = s.page;
  const lies = () => p.evaluate(() => {
    const b = document.querySelector("#bars"), k = document.querySelector("#kRest"), br = b.getBoundingClientRect();
    const haupt = [...b.querySelectorAll(".row:not(.sub)")];
    return { alle: haupt.length, ganz: haupt.filter((z) => { const q = z.getBoundingClientRect(); return q.top >= br.top - 1 && q.bottom <= br.bottom + 1; }).length,
      oben: b.scrollTop, hoch: b.clientHeight, max: b.scrollHeight - b.clientHeight, name: b.getAttribute("aria-label"),
      hinweis: { da: !k.hidden && k.getClientRects().length > 0, chip: k.querySelector(".krestn").textContent, wort: k.querySelector(".krestw").textContent, p: k.querySelector(".krestp").textContent,
        tag: k.tagName, versteckt: k.getAttribute("aria-hidden") } };
  });
  let z = await lies();
  assert(z.alle > 6 && z.ganz === 5 && z.hoch === 130 && z.oben === 0, "oben: fuenf ganze Zeilen in einer Liste von 130 Punkt, die Liste hat mehr", z);
  const n = z.alle - 5;
  assert(z.hinweis.da && z.hinweis.chip === "\u2193" + n && z.hinweis.wort === "more" && z.hinweis.p === "" && z.hinweis.tag === "BUTTON" && z.hinweis.versteckt === null,
    "der Hinweis zeigt \u2193n, Wort, keinen Anteil; seit B (#348) ist er der Knopf zum Aufklappen, fuer den Vorleser da", z.hinweis);
  assert(z.name === `Skills, rows 1 to 5 of ${z.alle}`, "die Liste nennt ihren Ausschnitt", z.name);
  assert(!(await p.evaluate(() => document.body.classList.contains("kn-alle"))) && !(await p.evaluate(() => document.querySelector(".kn-weg"))), "zu Beginn ist nichts aufgeklappt und nichts versteckt");
  await p.mouse.move(150, 200);
  await p.mouse.wheel(0, 100);
  await warte(p, () => document.querySelector("#bars").scrollTop > 0);
  await warte(p, () => document.querySelector("#bars").scrollTop % 26 === 0 && document.querySelector("#kRest .krestn").textContent !== "");
  z = await lies();
  assert(z.oben > 0 && z.oben % 26 === 0 && z.ganz === 5 && z.hinweis.chip === "\u2193" + (n - z.oben / 26), "das Rad rollt um ganze Zeilen, der Hinweis zaehlt mit", z);
  assert(z.name === `Skills, rows ${z.oben / 26 + 1} to ${z.oben / 26 + 5} of ${z.alle}`, "der Name der Liste folgt dem Ausschnitt", z.name);
  await p.mouse.wheel(0, 5000);
  await warte(p, () => { const b = document.querySelector("#bars"); return b.scrollTop >= b.scrollHeight - b.clientHeight - 1; });
  z = await lies();
  assert(z.ganz === 5 && z.hinweis.chip === "\u2191" && z.hinweis.wort === "End" && z.hinweis.p === "" && z.name === `Skills, rows ${z.alle - 4} to ${z.alle} of ${z.alle}`, "am Ende: \u2191 Ende, die letzte Zeile ganz", z);
  // Tastatur: die Zeilen sind ein Tabstopp mit Pfeilen (24-table-keyboard); der Fokus rollt die Liste um ganze Zeilen mit
  const fokusZeile = () => p.evaluate(() => { const b = document.querySelector("#bars"), z = document.activeElement, br = b.getBoundingClientRect(), q = z.getBoundingClientRect();
    return { i: [...b.querySelectorAll(".row:not(.sub)")].indexOf(z), drin: q.top >= br.top - 1 && q.bottom <= br.bottom + 1, oben: b.scrollTop, chip: document.querySelector("#kRest .krestn").textContent }; });
  await p.evaluate(() => { document.querySelector("#bars").scrollTop = 0; document.querySelector("#bars .row:not(.sub)").focus(); });
  for (let k = 0; k < 6; k++) await p.keyboard.press("ArrowDown");
  await warte(p, () => document.activeElement.classList.contains("row") && [...document.querySelectorAll("#bars .row:not(.sub)")].indexOf(document.activeElement) === 6);
  await warte(p, () => { const b = document.querySelector("#bars"), t = b.scrollTop, n = b.querySelectorAll(".row:not(.sub)").length; return t % 26 === 0 && t >= 26 && document.querySelector("#kRest .krestn").textContent === "↓" + (n - 5 - t / 26); });
  let fz = await fokusZeile();
  assert(fz.i === 6 && fz.drin && fz.oben % 26 === 0 && fz.chip === "↓" +(z.alle - 5 - fz.oben / 26), "Pfeil runter ueber die fuenfte Zeile hinaus: die Zeile rollt ganz ins Bild, der Hinweis zaehlt mit", fz);
  await p.keyboard.press("End");
  await warte(p, () => { const b = document.querySelector("#bars"); return b.scrollTop >= b.scrollHeight - b.clientHeight - 1 && document.querySelector("#kRest .krestw").textContent === "End"; });
  assert((await fokusZeile()).drin && await p.evaluate(() => document.querySelector("#kRest .krestw").textContent) === "End", "Ende: die letzte Zeile ganz im Bild, der Hinweis sagt Ende");
  await p.keyboard.press("Home");
  await warte(p, () => document.querySelector("#bars").scrollTop === 0);
  assert((await fokusZeile()).i === 0, "Pos1: zurueck an den Anfang der Liste");
  const erste = await p.evaluate(() => { const z = document.querySelector("#bars .row:not(.sub)"); return { name: z.querySelector(".nmt").textContent, label: z.getAttribute("aria-label") }; });
  assert(erste.label && erste.label.includes(erste.name) && /DPS/.test(erste.label) && !/%/.test(erste.label) && !/%/.test(erste.label), "die Zeile traegt einen Namen fuer Vorleser: Name, Schaden, DPS, ohne Anteil", erste);
  const leseAlt = await p.evaluate(() => getComputedStyle(document.querySelector("#hCompact")).display);
  await p.hover("#bars .row:not(.sub)");
  assert(await p.evaluate(() => getComputedStyle(document.querySelector("#hCompact")).display) === leseAlt && !(await p.evaluate(() => document.querySelector("#knHover"))), "Zeigen ersetzt die Lesezeile nicht mehr (der Name steht in der Zeile)");
  assert(await p.evaluate(() => getComputedStyle(document.querySelector("#knTabs")).display !== "none"), "die Reiter stehen in der Leiste");
  const g = await p.evaluate(() => { const b = getComputedStyle(document.body, "::before"), z = getComputedStyle(document.querySelector("#hDps")), t = getComputedStyle(document.querySelector("#knTabK .kn-lab"));
    return { kante: b.content !== "none" && b.width, zahl: z.webkitTextStrokeWidth, zahlPx: parseFloat(z.fontSize), tab: t.textTransform, kontur: getComputedStyle(document.body).getPropertyValue("--kn-kontur").trim(), font: getComputedStyle(document.body).getPropertyValue("--kn-font-zahl").trim() }; });
  assert(g.kante === "3px", "die Akzentkante links ist 3 Punkt breit", g);
  assert(g.zahl === "3px" && Math.abs(g.zahlPx - 26) < 0.6, "die grosse Zahl ist 26 Punkt gross (Aufbau B, vorher 42) und hat 3 Punkt Kontur", g);
  assert(g.tab === "uppercase" && g.kontur && g.font, "die Reiter stehen in Grossbuchstaben, Kontur und Schrift der Zahl sind Variablen", g);
  assert(s.fehler.length === 0, "keine Fehler auf der Seite", s.fehler);
  await s.page.close();
}
// 6b. Griff und Toenung (#328): die ganze Leiste zieht das Fenster, jeder Knopf darin nicht; die Toenung geht von .50 bis .10
{
  const s = await oeffne({ zoom: 100 });
  const p = s.page;
  const leiste = await p.evaluate(() => {
    const top = document.querySelector(".top"), v = getComputedStyle(top, "::before"), tr = top.getBoundingClientRect();
    const knoepfe = [...top.querySelectorAll("button, a, input, select, label")].filter((e) => e.getClientRects().length);
    return { h: tr.height, drag: v.getPropertyValue("-webkit-app-region") || v.getPropertyValue("app-region"), b: parseFloat(v.width), breite: tr.width, hoch: parseFloat(v.height),
      pos: v.position, knoepfe: knoepfe.length, falsch: knoepfe.filter((e) => (getComputedStyle(e).getPropertyValue("-webkit-app-region") || getComputedStyle(e).getPropertyValue("app-region")) !== "no-drag").map((e) => e.id || e.tagName) };
  });
  assert(leiste.h === 26, "die Leiste ist 26 Punkt hoch (Aufbau B; vorher 34)", leiste);
  /* Aufbau B: der Kopf ist ein Panel (deckend auf --comb mit Haarfuge), links Boss und Schaden, rechts die DPS ueber beide Zeilen */
  const kopf = await p.evaluate(() => {
    const h = document.querySelector(".head"), cs = getComputedStyle(h), hr = h.getBoundingClientRect(), r = (q) => document.querySelector(q).getBoundingClientRect();
    const bg = cs.backgroundColor, sm = /color\(srgb [\d. ]+(?: \/ ([\d.]+))?\)/.exec(bg), a = sm ? (sm[1] === undefined ? 1 : +sm[1]) : /rgba\(.*,\s*([\d.]+)\)/.exec(bg) ? +/rgba\(.*,\s*([\d.]+)\)/.exec(bg)[1] : 1;
    return { alpha: a, schatten: cs.boxShadow !== "none", rund: parseFloat(cs.borderTopLeftRadius), h: hr.height, links: hr.left, rechts: hr.right,
      boss: r("#hName .hnt").toJSON(), dps: r("#hDps").toJSON(), meta: r("#hMeta").toJSON(), schadenKurz: document.querySelector('#hMeta [data-f="schaden"] .dmgk')?.textContent ?? "" };
  });
  assert(kopf.alpha === 1 && kopf.schatten && kopf.rund >= 6, "der Kopf ist ein deckendes Panel mit Haarfuge und Rundung", kopf);
  assert(kopf.dps.left > kopf.boss.right - 1 && kopf.dps.right <= kopf.rechts + 0.5 && kopf.meta.top >= kopf.boss.bottom - 1 && kopf.meta.right <= kopf.dps.left + 1 && kopf.schadenKurz !== "",
    "Kopf: Boss links, darunter Schaden, Uhrzeit und Dauer; die DPS rechts neben beiden", kopf);
  assert(kopf.h <= 80, "der Kopf ist kompakt (hoechstens 80 Punkt mit Lesezeile)", kopf.h);
  assert(leiste.drag === "drag" && leiste.pos === "absolute" && Math.abs(leiste.b - leiste.breite) <= 1 && Math.abs(leiste.hoch - leiste.h) <= 1, "die ganze Leiste ist Ziehflaeche (::before, volle Breite und Hoehe)", leiste);
  assert(leiste.knoepfe > 0 && leiste.falsch.length === 0, "jeder Knopf in der Leiste ist no-drag", leiste.falsch);
  await s.page.close();
}

// 7. gerollt bis zur letzten Zeile: jede Zeile ganz, nichts ragt hinaus, auch bei 200 %
for (const zoom of [100, 200]) {
  const s = await oeffne({ zoom });
  const p = s.page;
  await p.mouse.move(150 * zoom / 100, 200 * zoom / 100);
  await p.mouse.wheel(0, 9000);
  await warte(p, () => { const b = document.querySelector("#bars"); return b.scrollTop >= b.scrollHeight - b.clientHeight - 1 && b.scrollTop > 0; });
  const { m } = await pruefeLage(s, "gerollt " + zoom + " %");
  assert(m.kaesten.filter((k) => k.art === "platte").length === 5, "gerollt " + zoom + " %: fuenf ganze Zeilen stehen da", m.kaesten.filter((k) => k.art === "platte").length);
  await s.page.close();
}

// 8. der Main zuerst (Twinks Schritt 3): steht er in der Datei hinten, zeigt der Streifen ihn trotzdem zuerst
{
  const w = stand0();
  w.profile[2].main = true;
  const s = await oeffne({ zoom: 100, weeklies: w, ansicht: "weeklies" });
  const p = s.page;
  const wer = () => p.evaluate(() => document.querySelector(".kn-wkopf .kn-wer b")?.textContent);
  assert((await wer()) === "Gamma mit einem sehr langen Namen", "mit Main: der Streifen oeffnet auf dem Main", await wer());
  await p.click("#knVor");
  await p.waitForFunction(() => document.querySelector(".kn-wkopf .kn-wer b")?.textContent === "Alpha");
  assert(true, "Pfeil vor: vom Main zum ersten der anderen");
  await p.click("#knZurueck");
  await p.waitForFunction(() => document.querySelector(".kn-wkopf .kn-wer b")?.textContent === "Gamma mit einem sehr langen Namen");
  assert(true, "Pfeil zurueck: wieder der Main");
  assert(s.fehler.length === 0, "keine Fehler auf der Seite", s.fehler);
  await s.page.close();
}
// 9. ist das Fenster niedriger als die Liste, rollt sie in sich (Rad), der Hinweis bleibt im Bild; nichts laesst sich markieren
{
  const s = await oeffne({ zoom: 100 });
  const p = s.page;
  await p.setViewportSize({ width: 300, height: 330 });
  await warte(p, () => { const b = document.querySelector("#bars"); return b.scrollHeight > b.clientHeight + 20; });
  const vor = await p.evaluate(() => { const b = document.querySelector("#bars"), k = document.querySelector("#kRest").getBoundingClientRect(); return { auf: b.scrollTop, knopfUnten: k.bottom, h: innerHeight }; });
  assert(vor.knopfUnten <= vor.h + 0.5, "niedriges Fenster: der Hinweis bleibt im Bild, die Liste gibt nach", vor);
  await p.mouse.move(150, 200);
  await p.mouse.wheel(0, 200);
  await warte(p, () => document.querySelector("#bars").scrollTop > 0);
  assert(await p.evaluate(() => document.querySelector("#bars").scrollTop) > 0, "niedriges Fenster: die Liste rollt mit dem Rad");
  const sel = await p.evaluate(() => ["#hDps", "#bars .nmt", "#knTabK", "#kRest"].map((q) => getComputedStyle(document.querySelector(q)).userSelect));
  await p.keyboard.press("Control+A");
  const markiert = await p.evaluate(() => String(getSelection()));
  assert(sel.every((x) => x === "none") && markiert === "", "Kompakt: nichts laesst sich markieren (user-select none, Strg+A markiert nichts)", { sel, markiert });
  const w = await oeffne({ zoom: 100, ansicht: "weeklies" });
  await w.page.keyboard.press("Control+A");
  const wm = await w.page.evaluate(() => ({ s: String(getSelection()), u: getComputedStyle(document.querySelector("#kwkPlatten .kn-wplatte")).userSelect }));
  assert(wm.s === "" && wm.u === "none", "Weeklies im Kompakt: nichts laesst sich markieren", wm);
  await w.page.close();
  assert(s.fehler.length === 0, "keine Fehler auf der Seite", s.fehler);
  await s.page.close();
}

// 10. Mindestgroesse (#348): die Seite nennt dem Hauptprozess, wie klein der Streifen noch lesbar ist; der setzt sie als Boden
{
  for (const zoom of [100, 200]) {
    const z = zoom / 100;
    // Kampf: die Breite des Streifens (Leiste mit allen Knoepfen), die Hoehe bis zur ersten Zeile (der Knopf liegt ausserhalb des Flusses)
    const s = await oeffne({ zoom });
    const a = s.groesse;
    const m = await s.page.evaluate(() => ({ barsTop: document.querySelector("#bars").getBoundingClientRect().top, rest: document.querySelector("#kRest:not([hidden])")?.getBoundingClientRect().height ?? 0 }));
    assert(a.min && a.min.w === a.w, zoom + " %: Kampf: die Mindestbreite ist die Breite des Streifens, die Leiste mit allen Knoepfen passt hinein", { min: a.min, w: a.w });
    const erwartet = Math.round(m.barsTop + 24 * z + 2 * z) + 2;
    assert(a.min && Math.abs(a.min.h - erwartet) <= 2 && a.min.h < a.h, zoom + " %: Kampf: die Mindesthoehe reicht bis zur ersten Zeile (der Hinweis liegt nicht mehr im Fluss)", { min: a.min, erwartet, h: a.h });
    await s.page.close();
    // ohne Kampf: der Streifen ist schon der kleinste
    const r = await oeffne({ zoom, beispiel: false });
    assert(r.groesse.min && r.groesse.min.w === r.groesse.w && r.groesse.min.h === r.groesse.h, zoom + " %: ohne Kampf ist der Streifen selbst der Boden", r.groesse);
    await r.page.close();
    // Weeklies: Kopf und eine Zeile
    const w = await oeffne({ zoom, ansicht: "weeklies" });
    const g = w.groesse;
    const wm = await w.page.evaluate(() => ({ top: document.querySelector("#kwkPlatten").getBoundingClientRect().top, rest: document.querySelector("#kwkRest")?.getBoundingClientRect().height ?? 0 }));
    const we = Math.round(wm.top + 24 * z + 2 * z) + 2;
    assert(g.min && g.min.w === g.w && Math.abs(g.min.h - we) <= 2 && g.min.h < g.h, zoom + " %: Weeklies: Mindestbreite und Mindesthoehe (eine Zeile)", { min: g.min, we, h: g.h });
    await w.page.close();
  }
}
// 11. Weeklies ganz (#348): aufgeklappt wird das Fenster so hoch wie die Liste, hoechstens so hoch wie der Bildschirm
{
  const viele = (n) => { const d = stand0(); d.profile[0].eigene = Array.from({ length: n }, (_, i) => ({ schluessel: "eigen" + (i + 1).toString(36).padStart(2, "0"), name: "Punkt " + (i + 1), menge: 1, takt: "woche" })); return d; };
  const bildschirm = { width: 1920, height: 1080 }, hoch = { width: 1920, height: 2400 };
  const alle = (s) => s.page.evaluate(() => document.querySelector("#kwkRest")?.click());
  for (const [n, name] of [[16, "16 Punkte"]]) {
    const s = await oeffne({ weeklies: viele(n), ansicht: "weeklies", bildschirm: hoch });
    const zu = s.groesse.h;
    await alle(s);
    await warte(s.page, () => document.querySelector("#kwkRest")?.getAttribute("aria-expanded") === "true");
    await bisFenster(s, (a) => a.h > zu, "Fenster waechst mit der Liste");
    await passen(s, 100);
    const m = await s.page.evaluate(() => { const l = document.querySelector("#kwkPlatten"); return { n: l.children.length, sh: l.scrollHeight, ch: l.clientHeight, h: innerHeight }; });
    assert(m.n >= 16 && m.sh <= m.ch + 1, name + ": aufgeklappt stehen alle Zeilen da, die Liste rollt nicht", m);
    assert(m.h <= 2400 && m.h > 424 + 150, name + ": das Fenster ist hoeher als die zwoelf Zeilen von frueher", m);
    await s.page.close();
  }
  {
    const s = await oeffne({ weeklies: viele(60), ansicht: "weeklies", bildschirm });
    await alle(s);
    await warte(s.page, () => document.querySelector("#kwkRest")?.getAttribute("aria-expanded") === "true");
    await bisFenster(s, (a) => a.h > 500, "Fenster waechst bis an den Bildschirm");
    await passen(s, 100);
    const m = await s.page.evaluate(() => { const l = document.querySelector("#kwkPlatten"), k = document.querySelector("#kwkRest").getBoundingClientRect(); return { sh: l.scrollHeight, ch: l.clientHeight, h: innerHeight, restUnten: k.bottom }; });
    assert(m.h <= 1080 && m.h >= 1000, "60 Punkte: das Fenster wird so hoch wie der Bildschirm und nicht hoeher", m);
    assert(m.sh > m.ch && m.restUnten <= m.h + 0.5, "60 Punkte: darueber rollt die Liste in sich, der Knopf weniger bleibt im Bild", m);
    await s.page.close();
  }
}
// 12. Reiterwechsel (#348): hat eine Hand das Fenster gezogen, beginnt die neue Ansicht trotzdem mit ihrer eigenen Hoehe
//     (Weeklies aufgeklappt -> Kampf blieb sonst so hoch wie die Liste und liess leere Flaeche unter den Zeilen)
{
  const viele = (n) => { const d = stand0(); d.profile[0].eigene = Array.from({ length: n }, (_, i) => ({ schluessel: "eigen" + (i + 1).toString(36).padStart(2, "0"), name: "Punkt " + (i + 1), menge: 1, takt: "woche" })); return d; };
  const s = await oeffne({ weeklies: viele(16), ansicht: "weeklies", bildschirm: { width: 1920, height: 2400 }, adresse: "?win=1&kompakt=1" });
  await s.page.evaluate(() => document.querySelector("#kwkRest")?.click());
  await warte(s.page, () => document.querySelector("#kwkRest")?.getAttribute("aria-expanded") === "true");
  await bisFenster(s, (a) => a.h > 500, "Fenster waechst mit der Liste");
  const gross = s.win[s.win.length - 1].h;
  /* der Hauptprozess meldet eine Hand am Rand; gewartet wird, bis die Seite zwei Antworten danach gelesen hat */
  s.handN = 1;
  const e0 = s.evN;
  await warte(s.page, () => true);
  { const ende = performance.now() + 8000; while (s.evN < e0 + 2 && performance.now() < ende) await new Promise((r) => setTimeout(r, 50)); }
  const n0 = s.win.length;
  await s.page.evaluate(() => document.querySelector("#knTabK").click());
  await bisFenster(s, (a) => a.h < gross, "der Kampf misst sich neu");
  const nach = s.win.slice(n0);
  assert(nach.length > 0 && nach.every((a) => a.art !== "hand"), "nach dem Reiterwechsel bestellt die Seite ihre Hoehe, nicht die der Hand", nach);
  assert(nach[nach.length - 1].h < gross - 100, "das Fenster ist im Kampf nicht so hoch wie die Weeklies-Liste", { gross, h: nach[nach.length - 1].h });
  await s.page.close();
}
// 13. Kampf aufklappen (#348, Entscheidung B): der Hinweis "↓N more" ist ein Knopf; Klick zeigt alle Zeilen, das Fenster waechst mit,
//     "weniger" bringt es zurueck; Tastatur, aria-expanded, Fokus bleibt
{
  const s = await oeffne({ zoom: 100, bildschirm: { width: 1920, height: 2400 }, adresse: "?win=1&kompakt=1" });
  const p = s.page;
  const lies = () => p.evaluate(() => { const k = document.querySelector("#kRest"), b = document.querySelector("#bars");
    return { auf: k.getAttribute("aria-expanded"), name: k.getAttribute("aria-label"), chip: k.querySelector(".krestn").textContent, wort: k.querySelector(".krestw").textContent,
      alle: b.querySelectorAll(".row:not(.sub)").length, sh: b.scrollHeight, ch: b.clientHeight, fokus: document.activeElement?.id, hinweisDa: !k.hidden && k.getClientRects().length > 0, breit: document.documentElement.scrollWidth <= innerWidth + 1 }; });
  const z0 = await lies(), h0 = s.groesse.h;
  assert(z0.auf === "false" && z0.alle > 6 && z0.sh > z0.ch && z0.name === "Show all " + z0.alle + " rows", "zu: fuenf Zeilen, der Knopf nennt die Zahl aller Zeilen", z0);
  await p.focus("#kRest"); await p.keyboard.press("Enter");
  await warte(p, () => document.querySelector("#kRest")?.getAttribute("aria-expanded") === "true" && document.activeElement?.id === "kRest");
  await bisFenster(s, (a) => a.h > h0, "Fenster waechst mit der Liste");
  await passen(s, 100);
  const z1 = await lies();
  assert(z1.sh <= z1.ch + 1 && z1.chip === "−" && z1.wort === "fewer" && z1.name === "Show fewer" && z1.hinweisDa, "auf: alle Zeilen stehen, die Liste rollt nicht, der Knopf sagt weniger", z1);
  assert(s.groesse.h > h0 + 26 && z1.breit, "auf: das Fenster ist hoeher, nichts rollt waagerecht", { h0, h: s.groesse.h });
  await p.keyboard.press("Enter");
  await warte(p, () => document.querySelector("#kRest")?.getAttribute("aria-expanded") === "false");
  await bisFenster(s, (a) => a.h <= h0, "Fenster geht zurueck");
  await passen(s, 100);
  const z2 = await lies();
  assert(z2.ch === 130 && z2.fokus === "kRest" && s.groesse.h === h0, "zu per Eingabetaste: fuenf Zeilen, der Fokus bleibt auf dem Knopf, dieselbe Hoehe wie vorher", { z2, h0, h: s.groesse.h });
  await p.keyboard.press("Space");
  await warte(p, () => document.querySelector("#kRest")?.getAttribute("aria-expanded") === "true");
  /* ein Reiterwechsel klappt zu */
  await p.evaluate(() => document.querySelector("#knTabW").click());
  await p.evaluate(() => document.querySelector("#knTabK").click());
  await warte(p, () => !document.body.classList.contains("kn-alle") && document.querySelector("#kRest")?.getAttribute("aria-expanded") === "false");
  await s.page.close();
}
// 13. Von Hand hoeher gezogen: die Liste fuellt die Hoehe und zeigt mehr Zeilen, darunter bleibt kaum graue Flaeche
{
  const hand = async (s) => {
    s.handN = 1;
    const e0 = s.evN;
    { const ende = performance.now() + 8000; while (s.evN < e0 + 2 && performance.now() < ende) await new Promise((r) => setTimeout(r, 50)); }
  };
  const viele = (n) => { const d = stand0(); d.profile[0].eigene = Array.from({ length: n }, (_, i) => ({ schluessel: "eigen" + (i + 1).toString(36).padStart(2, "0"), name: "Punkt " + (i + 1), menge: 1, takt: "woche" })); return d; };
  const imBild = (sel) => (ziel) => ziel.evaluate((q) => { const k = document.querySelector(q.l).getBoundingClientRect(); return { n: [...document.querySelectorAll(q.z)].filter((b) => { const r = b.getBoundingClientRect(); return r.top >= k.top - 1 && r.bottom <= k.bottom + 1; }).length, unten: k.bottom, h: innerHeight }; }, sel);
  const luft = 14;
  {
    const s = await oeffne({ zoom: 100, adresse: "?win=1&kompakt=1" });
    const p = s.page;
    const vorher = await imBild({ l: "#bars", z: "#bars .row:not(.sub)" })(p);
    await hand(s);
    await p.setViewportSize({ width: 300, height: 700 });
    await warte(p, () => document.body.classList.contains("kn-hand"));
    await warte(p, () => document.querySelector("#bars").clientHeight > 5 * 26 + 10 || document.querySelector("#bars").scrollHeight <= document.querySelector("#bars").clientHeight + 1);
    const m = await imBild({ l: "#bars", z: "#bars .row:not(.sub)" })(p);
    assert(vorher.n === 5 && m.n > 5, "Kampf: hoeher gezogen zeigt die Liste mehr Zeilen als die fuenf", { vorher, m });
    assert(m.h - m.unten <= luft + 10, "Kampf: hoeher gezogen bleibt unter der Liste kaum graue Flaeche", m);
    await p.close();
  }
  {
    const s = await oeffne({ weeklies: viele(16), ansicht: "weeklies", bildschirm: { width: 1920, height: 2400 }, adresse: "?win=1&kompakt=1" });
    const p = s.page;
    await hand(s);
    await p.setViewportSize({ width: 300, height: 760 });
    await warte(p, () => document.body.classList.contains("kn-hand"));
    await warte(p, () => document.querySelector("#kwkPlatten").clientHeight > 5 * 26 + 10);
    const m = await imBild({ l: "#kwkPlatten", z: "#kwkPlatten .kn-wplatte" })(p);
    const rest = await p.evaluate(() => document.querySelector("#kwkRest")?.getBoundingClientRect().bottom ?? 0);
    assert(m.n > 5, "Weeklies: hoeher gezogen zeigt die Liste mehr Zeilen als die fuenf", m);
    assert(m.h - Math.max(m.unten, rest) <= luft + 10, "Weeklies: hoeher gezogen bleibt unter der Liste kaum graue Flaeche", { m, rest });
    await p.close();
  }
}
console.log();
await browser.close();
if (failed) { console.log(`KOMPAKT PAGE FAILED - ${failed}`); process.exit(1); }
console.log("KOMPAKT PAGE PASSED");
