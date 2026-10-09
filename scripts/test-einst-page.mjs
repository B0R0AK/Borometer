// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Instrumententafel Stufe 3 (Spezifikation 27.09.2026, Abschnitt 5):
// der Bereich Einstellungen an der gebauten Seite, vom gestellten Helfer
// ausgeliefert (page.route) - als eigenes Fenster der App (?win=1,
// nativeFrame) und als Tab im Browser. Was die Seite an /api/config und
// /api/dir schickt, wird mitgeschrieben.
//
// Run:  npm run test:einst-page     (baut die Seite zuerst)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
// wie scripts/build-renderer.mjs: 1.6.0 steht als 1.6
const VERSION = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version.replace(/\.0$/, "");
/* Das ⋯-Menue im Kompakt (App, ohne Entwicklermodus) vor Stufe 3: was darin
   zu sehen war, bleibt, Eintrag fuer Eintrag. */
/* Overlay-Look (Entscheidung vom 29.09. (an Claude uebertragen), DECISION 11.4): der Geist zieht
   aus der Leiste des Streifens ins ⋯-Feld, als eigene Zeile nach der Durchsicht - sonst dieselben Eintraege. */
/* Folgt Nachtraege N4: nach der Randlos-Hilfe der Satz aus #57 (#fensterNote,
   "ein Fenster ueber dem Spiel, kein Overlay im Spiel"), nur in der App. */
const KOMPAKT_MENUE = JSON.stringify(["misep", "themeRow", "zoomRow", "seeRow", "ghostRow", "hotkeyNote", "randlosNote", "fensterNote", "misep", "misep", "seenote nurkompakt"]);
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Eine Seite am gestellten Helfer (wie test-rahmen-page.mjs). app: ?win=1
   und nativeFrame (das eigene Fenster der App), sonst ein Browser-Tab.
   config: was GET /api/config antwortet. helfer: {dir, file, text} - der
   Helfer beobachtet einen Ordner. Mitgeschrieben: POST /api/config in
   s.posts, POST /api/dir in s.dir, /api/win in s.win, /api/runs/* in s.runs,
   POST /api/bug/save in s.bug. */
/* update: was /api/state als update bringt (Update-Hinweis, Spezifikation 2.3); fehlt es, wie ein alter Helfer. */
async function oeffne({ app = false, lang = "en", config = {}, breite = 1280, hoehe = 860, helfer = null, update = undefined } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const s = { page, fehler: [], posts: [], dir: [], win: [], runs: [], bug: [], staende: 0 };
  let ordner = helfer ? helfer.dir : "";   // wie server.ts: POST /api/dir wechselt ihn
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.addInitScript(anfragenZaehlen);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/state") return json({ ...(helfer
      ? { dir: ordner, file: helfer.file, size: helfer.text.length, mtime: 1, nativeFrame: app, material: false, stayOnTop: false }
      : { dir: "", file: "", nativeFrame: app, material: false, stayOnTop: false }), ...(update === undefined ? {} : { update: typeof update === "function" ? update(++s.staende) : update }) });
    if (path === "/api/latest" && helfer) {
      const n = helfer.text.length;
      return json({ file: helfer.file, from: 0, to: n, size: n, head: helfer.text.split("\n").slice(0, 2).join("\n"), text: helfer.text });
    }
    if (path === "/api/config" && req.method() === "GET") return json(config);
    if (path === "/api/config") { s.posts.push(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
    // wie server.ts: der gewechselte Ordner kommt als dir zurueck
    if (path === "/api/dir") {
      const b = req.method() === "POST" ? JSON.parse(req.postData() || "{}") : { get: true };
      s.dir.push(b);
      if (b.path) ordner = b.path;
      return json(b.path ? { ok: true, dir: b.path } : { ok: true });
    }
    // wie server.ts: der Fehlerbericht landet in Bug-Reports
    if (path === "/api/bug/save") { const b = JSON.parse(req.postData() || "{}"); s.bug.push(b); return json({ ok: true, name: b.name + ".json", folder: "Bug-Reports" }); }
    if (path.startsWith("/api/runs/")) { s.runs.push(req.method() + " " + path); return json(path === "/api/runs/list" ? { folder: "saves", files: [] } : { ok: true, name: "x", folder: "saves" }); }
    if (path === "/api/win") {
      const b = JSON.parse(req.postData() || "{}"); s.win.push(b);
      return json({ ok: true, max: false, w: 400, h: 28, on_top: b.do === "pin" ? !!b.on : true });
    }
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: {} }); }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html" + (app ? "?win=1" : ""));
  // Seite fertig: body[data-bereit] statt #landStatus (Neugestaltung 28.09., Befund 2)
  await warte(page, (h) => document.body.dataset.bereit === (h ? "ordner" : "ohne"), !!helfer, 30000, "die Seite ist bereit (body[data-bereit])");
  // und die Einstellungen (/api/config) sind gelesen und angewandt
  await stille(page, "Start");
  return s;
}
/* Warten auf einen Zustand statt fester Pausen (Issue #167): laeuft die
   Frist ab, steht eine FAIL-Zeile mit dem, worauf gewartet wurde (ohne
   worauf: die Bedingung selbst), und es geht weiter - die Pruefungen danach
   sagen, was fehlt. */
async function warte(page, fn, arg, ms = 5000, worauf = String(fn).replace(/\s+/g, " ")) {
  try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; }
  catch (e) { assert(false, "Zeitablauf (" + ms + " ms) beim Warten auf: " + worauf, String(e).split("\n")[0]); return false; }
}
/* In der Seite (addInitScript): __offen zaehlt die Anfragen an den Helfer,
   die noch nicht fertig sind - unterwegs, oder beantwortet, aber der Text der
   Antwort ist noch nicht gelesen. Fertig ist eine erst eine Aufgabe nach dem
   Lesen: dann hat auch der Code, der auf die Antwort wartet, seinen Teil
   getan. /api/events zaehlt nicht, die Frage haelt der Helfer bewusst an. */
function anfragenZaehlen() {
  window.__offen = 0;
  const f = window.fetch;
  const ende = (r) => { if (!r.__fertig) { r.__fertig = true; window.__offen--; } };
  window.fetch = function (url) {
    if (String(url).startsWith("/api/events")) return f.apply(window, arguments);
    window.__offen++;
    return f.apply(window, arguments).then(
      (r) => { r.__zaehlt = true; setTimeout(() => { if (!r.__liest) ende(r); }, 0); return r; },
      (e) => { setTimeout(() => { window.__offen--; }, 0); throw e; });
  };
  for (const k of ["json", "text"]) {
    const o = Response.prototype[k];
    Response.prototype[k] = function () {
      const p = o.call(this);
      if (this.__zaehlt && !this.__fertig) {
        this.__liest = true;
        const fertig = () => setTimeout(() => ende(this), 0);
        p.then(fertig, fertig);
      }
      return p;
    };
  }
}
/* Ruhe: jede Anfrage der Seite ist beantwortet und verarbeitet - was sie
   an den Helfer schicken wollte, liegt jetzt in s.posts, s.dir, s.runs. */
const stille = (page, wann) => warte(page, () => (window.__offen ?? 0) === 0, undefined, 5000,
  "Ruhe, alle Anfragen der Seite beantwortet (" + wann + ")");
/* Die Seite steht nach einer Handlung: zwei Bilder sind gezeichnet (was die
   Seite im naechsten Bild misst, ist gemessen), kein CSS-Uebergang laeuft
   (Keyframe-Animationen wie der atmende Live-Punkt zaehlen nicht), keine
   Anfrage ist offen. Die Handler selbst laufen im Klick; was danach kommt,
   kommt ueber diese drei Wege. */
async function steht(page, wann) {
  const gezeichnet = await Promise.race([
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))),
    new Promise((r) => setTimeout(() => r(false), 5000)),   // Frist, keine Pause: ohne Bild nach 5 s eine FAIL-Zeile
  ]);
  if (!gezeichnet) assert(false, "Zeitablauf (5000 ms) beim Warten auf zwei gezeichnete Bilder (" + wann + ")");
  return warte(page, () => (window.__offen ?? 0) === 0 && document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== "running"), undefined, 5000,
    "die Seite steht: keine Anfrage offen, kein Uebergang (" + wann + ")");
}
// eine Flaeche (#einst, #app, #land) ist zu sehen, und die Seite steht
async function zeigt(page, sel, was) {
  await warte(page, (q) => { const e = document.querySelector(q); return !!e && e.getClientRects().length > 0; }, sel, 5000, sel + " sichtbar: " + was);
  await steht(page, was);
}
// Kompakt an oder aus (body.compact)
async function kompaktIst(page, an) {
  await warte(page, (x) => document.body.classList.contains("compact") === x, an, 5000, "Kompakt " + (an ? "an" : "aus"));
  await steht(page, "Kompakt " + (an ? "an" : "aus"));
}
/* Gesprungen zur Gruppe der Einstellungen: der Navigationsknopf traegt
   aria-current, der Fokus steht auf ihrer Ueberschrift. */
async function gruppeIst(page, g) {
  await warte(page, (x) => document.querySelector("#einstNav button[aria-current]")?.dataset.gruppe === x &&
    document.activeElement?.id === "egh-" + x, g, 5000, "Gruppe " + g + ": aria-current und Fokus auf der Ueberschrift");
  await steht(page, "Gruppe " + g);
}
// den Fokus hat der Bereich tab der Leiste
async function fokusTab(page, tab) {
  await warte(page, (x) => document.activeElement?.dataset?.tab === x, tab, 5000, "Fokus auf dem Bereich " + tab);
  await steht(page, "Fokus auf " + tab);
}
// den Fokus hat die Themenkachel th
async function fokusThema(page, th) {
  await warte(page, (x) => document.activeElement?.dataset?.theme === x, th, 5000, "Fokus auf der Kachel " + th);
  await steht(page, "Fokus auf " + th);
}
// das Thema th gilt (html data-theme)
async function themaIst(page, th) {
  await warte(page, (x) => document.documentElement.dataset.theme === x, th, 5000, "Thema " + th);
  await steht(page, "Thema " + th);
}
// die Groesse gilt (html style.zoom; "" ist 100 %)
async function zoomIst(page, z) {
  await warte(page, (x) => document.documentElement.style.zoom === x, z, 5000, "zoom " + JSON.stringify(z));
  await steht(page, "zoom " + z);
}
// die Sprache gilt (html lang)
async function spracheIst(page, l) {
  await warte(page, (x) => document.documentElement.lang === x, l, 5000, "Sprache " + l);
  await steht(page, "Sprache " + l);
}
// ein Dialog (Hintergrund mit Klasse on) ist offen oder zu
async function dialogAuf(page, sel, was) {
  await warte(page, (q) => document.querySelector(q)?.classList.contains("on"), sel, 5000, was + " offen (" + sel + ".on)");
  await steht(page, was);
}
async function dialogZu(page, sel, was) {
  await warte(page, (q) => !document.querySelector(q)?.classList.contains("on"), sel, 5000, was + " zu (" + sel + " ohne on)");
  await steht(page, was);
}
// die Meldung (#toast) zeigt einen Text, der text enthaelt
async function meldungDa(page, text, was) {
  await warte(page, (t) => (document.querySelector("#toast")?.textContent || "").includes(t), text, 5000, was + " (#toast enthaelt „" + text + "“)");
  await steht(page, was);
}
// das Fenster hat die neue Breite, und die Seite steht
async function breiteIst(page, w) {
  await warte(page, (x) => innerWidth === x, w, 5000, "Fensterbreite " + w);
  await steht(page, "Breite " + w);
}
/* Ein Log zum Trennen, nur Zielnamen und Zahlen: zwei Pulls am Kaefer mit
   12 s Pause, ein kurzer Kampf (2 s) an der Fledermaus, zwei Pulls am Wolf
   mit 25 s Pause. Phasen verbinden an: 2 Kaempfe; aus, Abstand 8: 4; Abstand
   15: 3 (die Kaefer-Pause verbindet); Mindestdauer 0: der kurze dazu. */
const two = (n, w = 2) => String(n).padStart(w, "0");
const stamp = (ms) => { const d = new Date(ms);
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-` +
    `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`; };
const at = (h, m, sek = 0) => Date.UTC(2026, 8, 20, h, m, sek);
const TRENN_LOG = (() => {
  const zeilen = ["CombatLogVersion,4"];
  for (const z of [{ ziel: "Stone Beetle", start: at(20, 0, 0), sek: 20 }, { ziel: "Stone Beetle", start: at(20, 0, 32), sek: 20 },
    { ziel: "Grave Bat", start: at(20, 5, 0), sek: 2 },
    { ziel: "Frost Wolf", start: at(20, 10, 0), sek: 20 }, { ziel: "Frost Wolf", start: at(20, 10, 45), sek: 20 }])
    for (let k = 0; k * 500 < z.sek * 1000; k++)
      zeilen.push(`${stamp(z.start + k * 500)},DamageDone,Quick Fire,964762401,${1000 + k},0,0,kNormalHit,Tester,${z.ziel}`);
  return zeilen.join("\n") + "\n";
})();
async function beispiel(p) {
  await p.evaluate(() => document.querySelector("#btnSample2").click());
  await zeigt(p, "#app", "der Beispielkampf");
}
/* Wo man steht: welche der drei Flaechen sichtbar ist, welcher Bereich
   gewaehlt, die Gruppen der Einstellungen. */
const ort = (p) => p.evaluate(() => {
  const sicht = (q) => { const e = document.querySelector(q); return !!e && e.getClientRects().length > 0; };
  return { einst: sicht("#einst"), land: sicht("#land"), app: sicht("#app"),
    aktuell: [...document.querySelectorAll("#bereiche .tab")].filter((b) => b.getAttribute("aria-current") === "page").map((b) => b.dataset.tab),
    fokus: document.activeElement?.id || document.activeElement?.dataset?.tab || "",
    mehr: sicht("#btnMore"), zahnrad: sicht("#btnEinst"), tafel: document.body.classList.contains("tafel") };
});

/* Der Weg in die Einstellungen: seit der Neugestaltung 28.09. (DECISION 0.14)
   nur das Zahnrad unten in der Symbolleiste. */
const ZAHNRAD = '#bereiche [data-tab="settings"]';

try {
  // --- 1. Ohne Log, App, deutsch: das Zahnrad unten, der Ort, acht Abschnitte
  // (folgt Entwurf, Neugestaltung Aufgabe 8, Luecken 10.2: statt fuenf Gruppen die acht Abschnitte des Entwurfs)
  {
    const s = await oeffne({ app: true, lang: "de" });
    const p = s.page;
    const l = await p.evaluate(() => {
      const k = [...document.querySelectorAll("#bereiche .tab")].filter((b) => b.getClientRects().length > 0);
      const r = (q) => document.querySelector(q)?.getBoundingClientRect().toJSON() || null;
      const z = document.querySelector('#bereiche [data-tab="settings"]');
      const svg = z && z.querySelector("svg"), sr = svg && svg.getBoundingClientRect();
      return { folge: k.map((b) => b.dataset.tab), start: r('#bereiche [data-tab="start"]'), zahnrad: r('#bereiche [data-tab="settings"]'),
        // Name fuer den Vorleser (.vh) und die Blase (.btip), eigenes Symbol 22 Punkt (Neugestaltung 28.09.)
        name: z ? [z.querySelector(".btip")?.textContent, z.querySelector(".vh")?.textContent] : null, gesperrt: z ? z.disabled : null,
        symbol: !!svg && svg.getAttribute("aria-hidden") === "true" && Math.round(sr.width) === 22 };
    });
    assert(l.folge.at(-1) === "settings" && l.folge.at(-2) === "start" && l.zahnrad && l.start && l.zahnrad.top >= l.start.bottom - 0.5,
      "ohne Log: das Zahnrad steht unten in der Bereichsleiste, nach Start", l);
    assert(l.gesperrt === false && l.symbol && l.name && l.name[0] === "Einstellungen" && l.name[1] === "Einstellungen",
      "das Zahnrad ist ohne Log nutzbar, gezeichnet (22 Punkt), Name und Blase „Einstellungen“", l);
    await p.click('#bereiche [data-tab="settings"]');
    await zeigt(p, "#einst", "die Einstellungen nach dem Zahnrad");
    const o = await ort(p);
    assert(o.einst && !o.land && !o.app && JSON.stringify(o.aktuell) === '["settings"]',
      "Klick: #einst sichtbar, Startseite und Kampf verborgen, aria-current auf dem Zahnrad", o);
    const g = await p.evaluate(() => {
      const e = document.querySelector("#einst");
      return { titel: e.querySelector("h2#einstTitel")?.textContent.trim(), kopf: e.querySelector(".einstkopf p")?.textContent.trim(),
        /* folgt Spezifikation Windows-Einbindung 9: der neunte Abschnitt "Windows" steht nur im eigenen Fenster unter
           Windows (GET /api/config bringt windows) - hier ohne windows verborgen; gezaehlt werden die sichtbaren, und
           verborgen sein duerfen genau er und sein Eintrag in der Sprungleiste */
        verborgen: [...e.querySelectorAll("section.egruppe[hidden], #einstNav button[hidden]")].map((x) => x.id),
        gruppen: [...e.querySelectorAll("section.egruppe:not([hidden])")].map((sec) => {
          const h = sec.querySelector("h3");
          return { id: sec.id, h: h?.textContent.trim(), hid: h?.id, lab: sec.getAttribute("aria-labelledby"), ti: h?.getAttribute("tabindex"),
            inhalt: sec.children.length > 1 };
        }),
        nav: [...e.querySelectorAll("#einstNav button:not([hidden])")].map((b) => [b.dataset.gruppe, b.textContent.trim()]),
        navName: e.querySelector("#einstNav")?.getAttribute("aria-label") || "",
        benach: /Benachrichtigung/i.test(e.textContent),
        ueber: e.querySelector("#eg-info")?.textContent.replace(/\s+/g, " ").trim() || "" };
    });
    assert(g.titel === "Einstellungen" && /Gilt sofort/.test(g.kopf || "") && /gespeichert in den Einstellungen von Borometer/.test(g.kopf || ""),
      "Kopf: „Einstellungen“, darunter „Gilt sofort“ und wo es gespeichert wird (ohne Pfad)", g);
    assert(JSON.stringify(g.gruppen.map((x) => x.h)) === JSON.stringify(["Darstellung", "Sprache", "Größe", "Overlay", "Log-Ordner", "Gruppe und Server", "Entwickler", "Info"]),
      "acht Abschnitte in dieser Reihenfolge: Darstellung, Sprache, Größe, Overlay, Log-Ordner, Gruppe und Server, Entwickler, Info", g.gruppen.map((x) => x.h));
    assert(JSON.stringify(g.verborgen) === JSON.stringify(["einstNavWin", "eg-win"]),
      "ohne windows aus /api/config: nur der Abschnitt Windows und sein Eintrag verborgen (Windows-Einbindung 9)", g.verborgen);
    const K = ["darst", "sprache", "groesse", "overlay", "logs", "gruppe", "dev", "info"];
    assert(g.gruppen.every((x, i) => x.id === "eg-" + K[i] && x.hid === "egh-" + K[i] && x.lab === x.hid && x.ti === "-1" && x.inhalt),
      "jeder Abschnitt ist eine section mit h3 (aria-labelledby, tabindex -1) und Inhalt darunter", g.gruppen);
    assert(JSON.stringify(g.nav.map((x) => x[0])) === JSON.stringify(K) && g.nav.every((x, i) => x[1] === g.gruppen[i].h) && g.navName,
      "Sprungleiste: ein Knopf je Abschnitt, gleiche Reihenfolge und Namen, die nav hat einen Namen", g.nav);
    assert(!g.benach, "keine Gruppe „Benachrichtigungen“ (die kommt erst mit #56)", g.benach);
    assert(g.ueber.includes("Borometer") && g.ueber.includes(VERSION), "Info: Borometer und die Version " + VERSION, g.ueber);
    assert(!s.fehler.length, "ohne Log: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 2. Mit Beispielkampf: das Zahnrad nur unten in der Symbolleiste, Verlassen
  // (Neugestaltung 28.09., DECISION 0.14: das Zahnrad der Titelleiste entfaellt;
  // jeder Weg in die Einstellungen geht jetzt ueber die Symbolleiste)
  {
    const s = await oeffne();
    const p = s.page;
    await beispiel(p);
    let o = await ort(p);
    const tb = await p.evaluate(() => { const b = document.querySelector('#bereiche [data-tab="settings"]');
      return b ? { name: b.querySelector(".vh")?.textContent, tip: b.querySelector(".btip")?.textContent, typ: b.type, sicht: b.getClientRects().length > 0 } : null; });
    assert(o.app && !o.zahnrad && tb && tb.sicht && tb.name === "Settings" && tb.tip === "Settings" && tb.typ === "button",
      "mit Kampf: kein Zahnrad in der Titelleiste, das der Symbolleiste heisst „Settings“", { o, tb });
    await p.click(ZAHNRAD);
    await zeigt(p, "#einst", "die Einstellungen nach dem Zahnrad");
    o = await ort(p);
    assert(o.einst && !o.app && !o.land && !o.tafel && JSON.stringify(o.aktuell) === '["settings"]',
      "Klick auf das Zahnrad: die Einstellungen, ohne Kampf-Tafel, das Zahnrad der Leiste gewaehlt", o);
    await p.click('#bereiche [data-tab="timeline"]');
    await zeigt(p, "#app", "der Kampf nach dem Bereich Kampf");
    o = await ort(p);
    assert(!o.einst && o.app && o.tafel && JSON.stringify(o.aktuell) === '["timeline"]',
      "Klick auf Kampf: die Einstellungen sind verlassen, die Tafel steht wieder", o);
    // Einstellungen, dann ein Kampf aus der Kampfwahl
    await p.click(ZAHNRAD);
    await zeigt(p, "#einst", "die Einstellungen nach dem Zahnrad");
    await p.click("#kwKnopf");
    await warte(p, () => !document.querySelector("#kampfwahl").hidden, undefined, 30000, "die Kampfwahl offen");
    const n = await p.evaluate(() => [...document.querySelectorAll("#fightList .fight")].filter((f) => !f.closest("[hidden]")).length);
    await p.evaluate(() => { const f = [...document.querySelectorAll("#fightList .fight")].filter((x) => !x.closest("[hidden]")); f[f.length - 1].click(); });
    await zeigt(p, "#app", "der Kampf aus der Kampfwahl");
    o = await ort(p);
    assert(n > 0 && !o.einst && o.app && JSON.stringify(o.aktuell) === '["timeline"]',
      "Einstellungen, dann ein Kampf aus der Kampfwahl: die Einstellungen sind verlassen", { n, o });
    // Laden einer Datei verlaesst die Einstellungen (wie Start)
    await p.click(ZAHNRAD);
    await zeigt(p, "#einst", "die Einstellungen nach dem Zahnrad");
    await p.evaluate(() => document.querySelector("#btnSample2").click());
    await zeigt(p, "#app", "der Kampf nach dem Laden des Beispiels");
    o = await ort(p);
    assert(!o.einst && o.app, "Einstellungen, dann eine Datei laden: die Einstellungen sind verlassen", o);

    // Kompakt: das ⋯ bleibt, kein Zahnrad, keine Einstellungen; zurueck steht wieder der Ort
    await p.click(ZAHNRAD);
    await zeigt(p, "#einst", "die Einstellungen nach dem Zahnrad");
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await kompaktIst(p, true);
    o = await ort(p);
    assert(o.mehr && !o.zahnrad && !o.einst, "Kompakt: ⋯ sichtbar, weder Zahnrad noch Einstellungen", o);
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await kompaktIst(p, false);
    o = await ort(p);
    assert(o.einst && !o.app && JSON.stringify(o.aktuell) === '["settings"]', "zurueck in der vollen Ansicht: wieder die Einstellungen", o);

    // Gruppennavigation: springt zur Gruppe, Fokus auf ihre Ueberschrift
    await p.click('#einstNav button[data-gruppe="logs"]');
    await gruppeIst(p, "logs");
    const nv = await p.evaluate(() => {
      const h = document.querySelector("#egh-logs"), r = h.getBoundingClientRect(), kopf = document.querySelector(".top").getBoundingClientRect();
      return { fokus: document.activeElement?.id, oben: r.top, unten: r.bottom, kopf: kopf.bottom, hoch: innerHeight,
        aktuell: [...document.querySelectorAll("#einstNav button")].filter((b) => b.hasAttribute("aria-current")).map((b) => b.dataset.gruppe) };
    });
    assert(nv.fokus === "egh-logs" && nv.oben >= nv.kopf - 0.5 && nv.unten <= nv.hoch,
      "Gruppennavigation „Logs“: Fokus auf der Ueberschrift, sie steht im Bild unter der Titelleiste", nv);
    assert(JSON.stringify(nv.aktuell) === '["logs"]', "aria-current nur auf dem gewaehlten Navigationsknopf", nv.aktuell);

    // Bereichsleiste per Tastatur: Pfeile erreichen das Zahnrad, Enter oeffnet
    await p.click('#bereiche [data-tab="timeline"]');
    await zeigt(p, "#app", "der Kampf nach dem Bereich Kampf");
    await p.focus('#bereiche [data-tab="timeline"]');
    await p.keyboard.press("ArrowUp");      // vom ersten Bereich rundherum ans Ende: das Zahnrad
    await fokusTab(p, "settings");
    o = await ort(p);
    assert(o.fokus === "settings" && o.einst, "↑ vom ersten Bereich: das Zahnrad hat den Fokus, die Einstellungen stehen", o);
    await p.keyboard.press("ArrowUp");
    await fokusTab(p, "start");
    o = await ort(p);
    assert(o.fokus === "start" && o.land && !o.einst, "↑ weiter: Start", o);
    await p.keyboard.press("ArrowDown");
    await fokusTab(p, "settings");
    await p.keyboard.press("Enter");
    await zeigt(p, "#einst", "die Einstellungen nach Enter auf dem Zahnrad");
    o = await ort(p);
    assert(o.fokus === "settings" && o.einst && JSON.stringify(o.aktuell) === '["settings"]', "↓ und Enter: das Zahnrad oeffnet die Einstellungen", o);
    const tab = await p.evaluate(() => [...document.querySelectorAll("#bereiche .tab")].filter((b) => b.tabIndex === 0).map((b) => b.dataset.tab));
    assert(JSON.stringify(tab) === '["settings"]', "ein Tabstopp in der Leiste: das Zahnrad", tab);

    // breit: die Navigation steht links neben den Gruppen
    const br = await p.evaluate(() => { const n = document.querySelector("#einstNav").getBoundingClientRect(), g = document.querySelector(".einstgruppen").getBoundingClientRect();
      return { navRechts: n.right, gLinks: g.left, quer: document.documentElement.scrollWidth > innerWidth }; });
    assert(br.navRechts <= br.gLinks + 0.5 && !br.quer, "1280 Punkt: die Navigation steht links neben den Gruppen", br);
    assert(!s.fehler.length, "mit Kampf: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 3. 560 Punkt: kein Querrollen, Navigation als Zeile ueber den Gruppen
  for (const lang of ["de", "en"]) {
    const s = await oeffne({ breite: 560, hoehe: 760, lang });
    const p = s.page;
    await beispiel(p);
    await p.click('#bereiche [data-tab="settings"]');
    await zeigt(p, "#einst", "die Einstellungen nach dem Zahnrad");
    const m = await p.evaluate(() => {
      const n = document.querySelector("#einstNav").getBoundingClientRect(), g = document.querySelector(".einstgruppen").getBoundingClientRect();
      const tops = [...document.querySelectorAll("#einstNav button")].map((b) => Math.round(b.getBoundingClientRect().top));
      const e = document.querySelector("#einst").getBoundingClientRect();
      return { quer: document.documentElement.scrollWidth > innerWidth, navUnten: n.bottom, gOben: g.top,
        zeile: new Set(tops).size < tops.length, einstRechts: e.right, breit: innerWidth };
    });
    assert(!m.quer && m.einstRechts <= m.breit + 0.5, "560 Punkt (" + lang + "): kein waagerechtes Rollen", m);
    assert(m.navUnten <= m.gOben + 0.5 && m.zeile, "560 Punkt (" + lang + "): die Navigation steht als Zeile ueber den Gruppen", m);
    assert(!s.fehler.length, "560 Punkt (" + lang + "): keine Fehler", s.fehler);
    await p.close();
  }

  // --- 4. Browser ohne App: ohne Log erreichbar
  {
    const s = await oeffne();
    const p = s.page;
    await p.click('#bereiche [data-tab="settings"]');
    await zeigt(p, "#einst", "die Einstellungen nach dem Zahnrad");
    const o = await ort(p);
    assert(o.einst && !o.land && !o.app, "Browser ohne Log: die Einstellungen sind erreichbar", o);
    assert(!s.fehler.length, "Browser: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 5. Darstellung und Fenster & Spiel (Aufgabe 2): jede Zeile ruft die
  // Setzfunktion, die auch das ⋯-Menue ruft, und schreibt denselben Schluessel
  {
    const s = await oeffne({ app: true, lang: "de" });
    const p = s.page;
    await beispiel(p);
    await p.click(ZAHNRAD);
    await zeigt(p, "#einst", "die Einstellungen nach dem Zahnrad");
    const posts = (k) => s.posts.filter((b) => k in b).map((b) => b[k]);
    /* Ein Regler wie unter der Hand: Wert setzen, input waehrend des
       Ziehens, change beim Loslassen (Playwright fuellt keine range). */
    const regler = (sel, v) => p.evaluate(([q, w]) => {
      const r = document.querySelector(q); r.value = String(w);
      r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true }));
    }, [sel, v]);
    const lies = () => p.evaluate(() => {
      const q = (x) => document.querySelector(x);
      const radios = [...document.querySelectorAll("#eg-darst [role=radiogroup] [role=radio]")];
      return {
        rg: !!q("#eg-darst [role=radiogroup]") && !!q("#eg-darst [role=radiogroup]").getAttribute("aria-labelledby"),
        themen: radios.map((b) => [b.dataset.theme, b.getAttribute("aria-checked"), b.tabIndex]),
        thema: document.documentElement.dataset.theme,
        menueThema: [...document.querySelectorAll("#themeRow button")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.theme),
        zoom: { min: q("#eZoom")?.min, max: q("#eZoom")?.max, v: q("#eZoom")?.value, out: q("#eZoom + output")?.textContent,
          name: q("#eZoom")?.labels?.length || !!q("#eZoom")?.getAttribute("aria-labelledby"), css: document.documentElement.style.zoom, menue: q("#zoomVal").textContent },
        sprache: [...document.querySelectorAll("#eg-sprache .seg[role=group] button[data-lang]")].map((b) => [b.dataset.lang, b.getAttribute("aria-pressed")]),
        see: { v: q("#eSee")?.value, out: q("#eSee + output")?.textContent, min: q("#eSee")?.min, max: q("#eSee")?.max, menue: q("#seeSlide").value },
        h1: q("#einstTitel").textContent.trim(),
      };
    });
    let z = await lies();
    assert(z.rg && JSON.stringify(z.themen.map((x) => x[0])) === '["dark","light","tnl","glas","auto"]',
      "Thema: eine radiogroup mit Namen und den fuenf Kacheln (dunkel, hell, TnL, Rauchglas, automatisch)", z.themen);
    assert(z.themen.filter((x) => x[1] === "true").length === 1 && z.themen.find((x) => x[1] === "true")[0] === "dark" &&
      z.themen.filter((x) => x[2] === 0).length === 1, "Thema: das gewaehlte (dunkel) traegt aria-checked, ein Tabstopp", z.themen);
    await p.click('#eg-darst [role=radio][data-theme="light"]');
    await themaIst(p, "light");
    z = await lies();
    assert(z.thema === "light" && posts("theme").at(-1) === "light", "Thema „Hell“: data-theme light, POST /api/config {theme:\"light\"}", { thema: z.thema, posts: s.posts });
    assert(z.themen.find((x) => x[1] === "true")?.[0] === "light" && JSON.stringify(z.menueThema) === '["light"]',
      "Thema „Hell“: aria-checked in den Einstellungen und aria-pressed im ⋯-Menue (ein Stand)", z);
    await p.click('#eg-darst [role=radio][data-theme="glas"]');
    await themaIst(p, "glas");
    z = await p.evaluate(() => ({ thema: document.documentElement.dataset.theme,
      menue: [...document.querySelectorAll("#themeRow button")].map((b) => b.dataset.theme) }));
    assert(z.thema === "glas" && posts("theme").at(-1) === "glas", "Thema „Rauchglas“: data-theme glas, POST /api/config {theme:\"glas\"}", { thema: z.thema, posts: s.posts });
    assert(JSON.stringify(z.menue) === '["dark","light","tnl","glas","auto"]', "Kompakt-Menue: dieselben Themen", z.menue);
    await p.focus('#eg-darst [role=radio][data-theme="glas"]');
    await p.keyboard.press("ArrowRight");
    await fokusThema(p, "auto");
    z = await p.evaluate(() => document.activeElement.dataset.theme);
    assert(z === "auto", "Pfeil rechts von Rauchglas: Auto", z);
    await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft");
    await fokusThema(p, "tnl");
    z = await p.evaluate(() => document.activeElement.dataset.theme);
    assert(z === "tnl", "Pfeil links ueber Rauchglas zu TnL", z);
    await p.focus('#eg-darst [role=radio][data-theme="light"]');
    await p.keyboard.press("ArrowRight");
    await themaIst(p, "tnl");
    z = await lies();
    const fk = await p.evaluate(() => document.activeElement?.dataset?.theme);
    assert(z.thema === "tnl" && fk === "tnl" && posts("theme").at(-1) === "tnl", "Thema per Pfeiltaste: → waehlt TnL und nimmt den Fokus mit", { thema: z.thema, fk });
    await p.click('#eg-darst [role=radio][data-theme="dark"]');
    await themaIst(p, "dark");

    // Groesse: die Grenzen von setUiZoom (10 bis 200)
    assert(z.zoom.min === "10" && z.zoom.max === "200" && z.zoom.name, "Größe: Regler von 10 bis 200 (die Grenzen von setUiZoom), mit Namen", z.zoom);
    await regler("#eZoom", 120);
    await zoomIst(p, "1.2");
    z = await lies();
    assert(z.zoom.css === "1.2" && posts("uiZoom").at(-1) === 120 && z.zoom.out === "120\u00a0%",
      "Größe 120: zoom 1.2, POST {uiZoom:120}, Ausgabe „120 %“ mit geschuetztem Leerzeichen", { zoom: z.zoom, posts: posts("uiZoom") });
    await p.evaluate(() => document.querySelector("#zoomVal").click());   // ⋯-Menue: zurueck auf 100
    await zoomIst(p, "");
    z = await lies();
    assert(z.zoom.v === "100" && z.zoom.out === "100\u00a0%" && z.zoom.css === "" && posts("uiZoom").at(-1) === 100,
      "Größe im ⋯-Menue auf 100: der Regler der Einstellungen zeigt 100 (ein Stand)", z.zoom);
    // Tastatur: → auf dem Regler setzt die Groesse sofort, genau ein POST je Schritt
    const vorher = posts("uiZoom").length;
    await p.focus("#eZoom");
    await p.keyboard.press("ArrowRight");
    await zoomIst(p, "1.01");
    z = await lies();
    assert(z.zoom.v === "101" && z.zoom.css === "1.01" && z.zoom.out === "101\u00a0%" &&
      posts("uiZoom").length === vorher + 1 && posts("uiZoom").at(-1) === 101,
      "Größe per → : zoom 1.01, Ausgabe „101 %“, genau ein POST {uiZoom:101}", { zoom: z.zoom, neu: posts("uiZoom").slice(vorher) });
    await p.evaluate(() => document.querySelector("#zoomVal").click());
    await zoomIst(p, "");
    /* Weggezogen und an den Ausgangswert zurueck: input, aber kein change.
       Nach dem Loslassen folgt der Regler wieder einer Groesse von anderswo. */
    await p.evaluate(() => {
      const r = document.querySelector("#eZoom");
      r.value = "150"; r.dispatchEvent(new Event("input", { bubbles: true }));
      r.value = "100"; r.dispatchEvent(new Event("input", { bubbles: true }));
      r.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });
    await steht(p, "Regler losgelassen");
    await p.evaluate(() => document.querySelector("#zoomIn").click());   // ⋯-Menue: eine Stufe groesser (110)
    await zoomIst(p, "1.1");
    z = await lies();
    assert(z.zoom.v === "110" && z.zoom.out === "110\u00a0%" && z.zoom.css === "1.1",
      "Regler weggezogen und zurueck, dann ⋯-Menue +: Regler und Ausgabe zeigen 110", z.zoom);
    await p.evaluate(() => document.querySelector("#zoomVal").click());
    await zoomIst(p, "");

    // Sprache
    assert(JSON.stringify(z.sprache) === '[["de","true"],["en","false"]]', "Sprache: Segment Deutsch | English, Deutsch gedrueckt", z.sprache);
    await p.click('#eg-sprache button[data-lang="en"]');
    await spracheIst(p, "en");
    z = await lies();
    const ls = await p.evaluate(() => localStorage.getItem("boroLang"));
    assert(ls === "en" && z.h1 === "Settings" && JSON.stringify(z.sprache) === '[["de","false"],["en","true"]]',
      "Sprache „English“: localStorage boroLang en, die Seite englisch, aria-pressed auf English", { ls, z: z.sprache, h1: z.h1 });
    await p.click('#eg-sprache button[data-lang="de"]');
    await spracheIst(p, "de");

    // Durchsicht: dieselbe Form wie applySeeThrough (compactAlpha = 1 - see/100)
    assert(z.see.min === "0" && z.see.max === "55", "Durchsicht: Regler 0 bis 55", z.see);
    await regler("#eSee", 30);
    await warte(p, () => document.querySelector("#seeSlide").value === "30", undefined, 5000, "#seeSlide folgt der Durchsicht 30"); await steht(p, "Durchsicht 30");
    z = await lies();
    assert(posts("compactAlpha").at(-1) === 0.7 && z.see.out === "30\u00a0%" && z.see.menue === "30",
      "Durchsicht 30: POST {compactAlpha:0.7}, Ausgabe „30 %“, #seeSlide steht auf 30", { see: z.see, posts: posts("compactAlpha") });
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await kompaktIst(p, true);
    const kompakt = await p.evaluate(() => document.querySelector("#seeSlide").value);
    assert(kompakt === "30", "im Kompakt steht #seeSlide auf 30", kompakt);
    await regler("#seeSlide", 12);
    await p.evaluate(() => document.querySelector('#themeRow button[data-theme="tnl"]').click());
    await themaIst(p, "tnl");
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await kompaktIst(p, false);
    z = await lies();
    assert(z.see.v === "12" && z.see.out === "12\u00a0%", "Durchsicht im Kompakt-⋯ auf 12: die Einstellungen zeigen 12", z.see);
    assert(z.thema === "tnl" && z.themen.find((x) => x[1] === "true")?.[0] === "tnl", "Thema im Kompakt-⋯ auf TnL: die Einstellungen zeigen es", z.themen);

    // Kuerzel und Randlos: in der App die Saetze des ⋯-Menues
    const f = await p.evaluate(() => {
      const q = (x) => document.querySelector(x);
      const sicht = (e) => !!e && e.getClientRects().length > 0;
      return { satz: q("#eKuerzelSatz")?.textContent.trim(), note: q("#hotkeyNote").textContent.trim(),
        keys: [...document.querySelectorAll("#eg-overlay kbd")].map((k) => k.textContent), randlos: q("#eRandlosSatz")?.textContent.trim(),
        randNote: q("#randlosNote").textContent.trim(), browser: sicht(q("#eFenstBrowser")), see: sicht(q("#eSee")) };
    });
    assert(f.satz && f.satz === f.note && JSON.stringify(f.keys) === '["Strg","Umschalt","D"]',
      "Tastenkürzel: der Satz von #hotkeyNote und das Kürzel als Tasten", f);
    assert(f.randlos && f.randlos === f.randNote && !f.browser && f.see, "Randlos: der Satz compact.randlos; kein Browser-Satz, der Regler steht", f);
    assert(!s.fehler.length, "Darstellung (App): keine Fehler", s.fehler);
    await p.close();
  }

  // --- 6. Overlay im Browser: ein Satz statt toter Bedienelemente (folgt Entwurf: vorher Fenster & Spiel)
  {
    const s = await oeffne({ lang: "de" });
    const p = s.page;
    await p.click('#bereiche [data-tab="settings"]');
    await zeigt(p, "#einst", "die Einstellungen nach dem Zahnrad");
    const f = await p.evaluate(() => {
      const g = document.querySelector("#eg-overlay");
      const sicht = (e) => !!e && e.getClientRects().length > 0;
      return { satz: sicht(document.querySelector("#eFenstBrowser")) ? document.querySelector("#eFenstBrowser").textContent : "",
        bedien: [...g.querySelectorAll("input,[role=switch],button,kbd")].filter(sicht).length,
        darst: [...document.querySelectorAll("#eg-darst [role=radio],#eg-groesse input")].filter(sicht).length };
    });
    assert(/betrifft das Fenster der App/.test(f.satz) && f.bedien === 0, "Browser: „betrifft das Fenster der App“, keine Regler oder Schalter im Overlay", f);
    assert(f.darst === 6, "Browser: Darstellung und Größe bleiben bedienbar (fuenf Themen, Größe)", f);
    assert(!s.fehler.length, "Overlay (Browser): keine Fehler", s.fehler);
    await p.close();
  }
  // --- 7. Logs in der App (Aufgabe 3): Ordner, Kaempfe trennen, Kampfdatei,
  // Entwicklermodus - dieselben Setzfunktionen und Schluessel wie das
  // Filterfeld der Kampfwahl und das ⋯-Menue
  {
    const s = await oeffne({ app: true, lang: "de", helfer: { dir: "C:\\TL\\CombatLogs", file: "TLCombatLog-20260920.txt", text: "" } });
    const p = s.page;
    await p.setInputFiles("#fileInput", { name: "TLCombatLog-20260920.txt", mimeType: "text/plain", buffer: Buffer.from(TRENN_LOG) });
    await warte(p, () => !document.querySelector("#app").hidden, undefined, 30000, "der Kampf aus dem geoeffneten Log");
    await steht(p, "Log geladen");
    await p.click(ZAHNRAD);
    await zeigt(p, "#einst", "die Einstellungen nach dem Zahnrad");
    const posts = (k) => s.posts.filter((b) => k in b).map((b) => b[k]);
    const lies = () => p.evaluate(() => {
      const q = (x) => document.querySelector(x);
      const sicht = (e) => !!e && e.getClientRects().length > 0;
      const g = q("#eg-logs");
      return {
        pfad: q("#eOrdner")?.textContent.trim(), mono: q("#eOrdner") ? getComputedStyle(q("#eOrdner")).fontFamily : "",
        aendern: sicht(q("#eOrdnerAendern")), browser: sicht(q("#eOrdnerBrowser")),
        gap: q("#eGap")?.value, min: q("#eMin")?.value, phasen: q("#ePhasen")?.getAttribute("aria-checked"),
        phasenRolle: q("#ePhasen")?.getAttribute("role"), phasenName: !!q("#ePhasen")?.getAttribute("aria-labelledby"),
        gapName: q("#eGap")?.labels?.length || 0, minName: q("#eMin")?.labels?.length || 0,
        inGap: q("#inGap").value, inMin: q("#inMin").value, inPhases: q("#inPhases").checked,
        anzahl: q("#fightCount").textContent,
        dev: q("#eDev")?.getAttribute("aria-checked"), devRolle: q("#eDev")?.getAttribute("role"), devName: !!q("#eDev")?.getAttribute("aria-labelledby"),
        csv: !q("#btnCsv").hidden, waffe: q("#segWeapon").hidden,
        beispiel: sicht(q("#eBeispiel")), zeilen: g ? g.querySelectorAll(".ezeile").length : 0,
      };
    });
    let z = await lies();
    // Ordner
    assert(z.pfad === "C:\\TL\\CombatLogs" && /Mono|monospace|Consolas/i.test(z.mono) && z.aendern && !z.browser,
      "Ordner: der Pfad aus /api/state in Mono, Knopf „Ändern“, kein Browser-Satz", z);
    await p.click("#eOrdnerAendern");
    await p.waitForSelector("#modalInput", { state: "visible" });
    await p.fill("#modalInput", "D:\\Spiele\\Logs");
    await p.click("#modalOk");
    await dialogZu(p, "#modalBg", "Ordner-Dialog nach OK");
    z = await lies();
    assert(JSON.stringify(s.dir.filter((b) => b.path)) === JSON.stringify([{ path: "D:\\Spiele\\Logs" }]) && z.pfad === "D:\\Spiele\\Logs",
      "Ordner „Ändern“: POST /api/dir {path}, der neue Pfad steht in der Zeile", { dir: s.dir, pfad: z.pfad });

    // Kaempfe trennen: Phasen verbinden ist an, die Liste zeigt zwei Kaempfe
    assert(z.phasen === "true" && z.phasenRolle === "switch" && z.phasenName && z.gap === "8" && z.min === "3" && z.gapName && z.minName,
      "Trennen: Abstand 8, Mindestdauer 3, Schalter „Bossphasen verbinden“ an (role=switch, mit Namen)", z);
    const anfang = z.anzahl;
    await p.click("#ePhasen");
    await steht(p, "Phasen umgeschaltet");
    z = await lies();
    assert(posts("mergePhases").at(-1) === false && z.phasen === "false" && z.inPhases === false && z.anzahl !== anfang && /4/.test(z.anzahl),
      "Phasen aus: POST {mergePhases:false}, die Liste schneidet neu (4 Kaempfe), der Haken im Filterfeld ist aus", { z, anfang, posts: posts("mergePhases") });
    await p.fill("#eGap", "15");
    await p.press("#eGap", "Enter");
    await steht(p, "Abstand 15");
    z = await lies();
    assert(posts("splitAfter").at(-1) === 15 && !posts("gap").length && z.inGap === "15" && /3/.test(z.anzahl),
      "Abstand 15: POST {splitAfter:15} (derselbe Schluessel wie das Filterfeld), 3 Kaempfe, #inGap zeigt 15", { z, posts: s.posts });
    await p.fill("#eMin", "0");
    await p.press("#eMin", "Enter");
    await steht(p, "Mindestdauer 0");
    z = await lies();
    assert(posts("minDur").at(-1) === 0 && z.inMin === "0" && /4/.test(z.anzahl),
      "Mindestdauer 0: POST {minDur:0}, der kurze Kampf erscheint (4), #inMin zeigt 0", { z, posts: posts("minDur") });
    await p.fill("#eGap", "500");
    await p.press("#eGap", "Enter");
    await steht(p, "Abstand 500");
    z = await lies();
    assert(z.gap === "120" && posts("splitAfter").at(-1) === 120 && z.inGap === "120", "Abstand 500 wird wie im Filterfeld auf 120 geklemmt", { z, posts: posts("splitAfter") });
    // umgekehrt: das Filterfeld aendert, die Einstellungen zeigen es
    const feld = (q, v) => p.evaluate(([a, b]) => { const e = document.querySelector(a);
      if (typeof b === "boolean") e.checked = b; else e.value = b;
      e.dispatchEvent(new Event("change", { bubbles: true })); }, [q, v]);
    await feld("#inGap", "8"); await feld("#inMin", "3"); await feld("#inPhases", true);
    await steht(p, "Filterfeld 8 / 3 / Phasen an");
    z = await lies();
    assert(z.gap === "8" && z.min === "3" && z.phasen === "true" && z.anzahl === anfang &&
      posts("splitAfter").at(-1) === 8 && posts("minDur").at(-1) === 3 && posts("mergePhases").at(-1) === true,
      "Filterfeld 8 / 3 / Phasen an: die Einstellungen zeigen 8, 3 und „An“, die Liste wie am Anfang", { z, anfang });

    // Kampfdatei: dieselben Wege wie #btnSaveRuns / #btnLoadRuns
    await p.click("#eLaden");
    await dialogAuf(p, "#modalBg", "Dialog Kampfdatei laden");
    const laden = await p.evaluate(() => document.querySelector("#modalTitle").textContent);
    assert(s.runs.includes("GET /api/runs/list") && laden === "Kampfdatei laden",
      "Kampfdatei laden: fragt den Helfer nach /api/runs/list, der Dialog „Kampfdatei laden“", { runs: s.runs, laden });
    await p.keyboard.press("Escape");
    await dialogZu(p, "#modalBg", "Dialog Kampfdatei laden nach Esc");
    await p.click("#eSpeichern");
    await meldungDa(p, "Noch keine gespeicherten", "Hinweis ohne gespeicherten Kampf");
    const leer = await p.evaluate(() => document.querySelector("#toast").textContent);
    assert(/Noch keine gespeicherten/.test(leer), "Kampfdatei speichern ohne gespeicherten Kampf: derselbe Hinweis wie im Filterfeld", leer);

    // Entwicklermodus: Schalter, derselbe Schluessel, dieselbe Wirkung wie frueher der Haken im ⋯-Menue
    assert(z.dev === "false" && z.devRolle === "switch" && z.devName && z.waffe && !z.beispiel,
      "Entwicklermodus: Schalter aus (role=switch, mit Namen), „Nach Waffe“ und Beispielgruppe verborgen", z);
    await p.click("#eDev");
    await steht(p, "Entwicklermodus an");
    z = await lies();
    assert(posts("devMode").at(-1) === true && z.dev === "true" && z.csv && !z.waffe && z.beispiel,
      "Entwicklermodus an: POST {devMode:true}, #segWeapon da, „CSV exportieren“ da, Zeile Beispielgruppe sichtbar", { z, posts: posts("devMode") });
    await p.click("#eBeispiel");
    await meldungDa(p, "Beispielgruppe mit", "Meldung der Beispielgruppe");
    const bg = await p.evaluate(() => document.querySelector("#toast").textContent);
    assert(/Beispielgruppe mit \d Mitgliedern/.test(bg), "Beispielgruppe: dieselbe Handlung wie im ⋯-Menue", bg);
    await p.click("#eDev");   // der Haken #miDev im ⋯-Menue ist weg (Aufgabe 5), derselbe Weg ueber den Schalter
    await steht(p, "Entwicklermodus aus");
    z = await lies();
    assert(posts("devMode").at(-1) === false && z.dev === "false" && z.waffe && !z.beispiel && !z.csv,
      "Entwicklermodus wieder aus: der Schalter zeigt „Aus“, Beispielgruppe und CSV verborgen", z);
    assert(!s.fehler.length, "Logs (App): keine Fehler", s.fehler);
    await p.close();
  }

  // --- 9. Sicherheit und Ueber (Aufgabe 4), das Bild im Kopf, das ⋯ nur im Kompakt
  // (folgt Entwurf, Neugestaltung Aufgabe 8, DECISION 10.12: Sicherheit steht in Info, Aenderungsprotokoll,
  // Fehlerbericht und Beispielkampf unter Entwickler)
  {
    const s = await oeffne({ app: true, lang: "de" });
    const p = s.page;
    p.setDefaultTimeout(5000);
    const sicht = (q) => p.evaluate((x) => { const e = document.querySelector(x); return !!e && e.getClientRects().length > 0; }, q);
    await p.click('#bereiche [data-tab="settings"]');
    await p.click('#einstNav button[data-gruppe="info"]');
    await gruppeIst(p, "info");
    const si = await p.evaluate(() => {
      const g = document.querySelector("#eg-info"), dl = g.querySelector("dl");
      return { dt: dl ? [...dl.querySelectorAll(":scope > div > dt")].map((d) => d.textContent.trim()) : [],
        dd: dl ? [...dl.querySelectorAll(":scope > div > dd")].map((d) => d.textContent.trim()) : [],
        bedien: [...g.querySelectorAll("button, input, select, [role=switch]")].map((b) => b.id),
        dlBedien: dl ? dl.querySelectorAll("button, input, select, [role=switch], a").length : -1,
        code: dl ? [...dl.querySelectorAll("code")].map((c) => c.textContent) : [] };
    });
    /* folgt Spezifikation Update-Hinweis 2.4 (Entscheidung 02.10.): die Sicherheit nennt das Netz als fuenften Eintrag;
       folgt Spezifikation Rundgang 02.10.2026, 2: in Info dazu der Knopf "Rundgang zeigen". Gleich streng:
       Eintraege genau, Bedienelemente genau (keines in der Liste, im Abschnitt nur der Schalter des
       Update-Hinweises unter der Version und "Rundgang zeigen", in dieser Reihenfolge) */
    assert(JSON.stringify(si.dt) === '["Liest","Schreibt","Lokaler Server","Netz","Spiel"]' && si.dd.length === 5 && si.dd.every((d) => d.length > 10),
      "Sicherheit: eine Liste mit fuenf Eintraegen - liest, schreibt, lokaler Server, Netz, Spiel", si);
    assert(si.dd[2]?.includes("127.0.0.1") && si.code.includes("127.0.0.1") && si.dlBedien === 0 && JSON.stringify(si.bedien) === '["eUpdatePruefen","eRundgang"]',
      "Sicherheit: 127.0.0.1 woertlich (als Code), keine Schalter und Knoepfe in der Liste; in Info nur der Schalter des Update-Hinweises und „Rundgang zeigen“", si);
    assert(/Gruppe/.test(si.dd[3] || "") && !/Questlog/.test(si.dd[3] || "") && /Update-Hinweis/.test(si.dd[3] || ""),
      "Sicherheit „Netz“: Gruppe und der Update-Hinweis; Questlog steht nicht mehr da (Abruf entfallen, #207)", si.dd[3]);
    assert(/Kampflog-Ordner/.test(si.dd[0] || "") && /nur lesend/.test(si.dd[0] || "") && /eigenen Dateien/.test(si.dd[0] || ""),
      "Sicherheit „Liest“: den Kampflog-Ordner, nur lesend, und die eigenen Dateien", si.dd[0]);
    // Ueber: Name und Version, drei Handlungen
    await p.click('#einstNav button[data-gruppe="dev"]');
    await gruppeIst(p, "dev");
    const ue = await p.evaluate(() => ({ ver: document.querySelector("#einstVer")?.textContent,
      knoepfe: [...document.querySelectorAll("#eg-dev button:not([role=switch])")].filter((b) => b.getClientRects().length > 0)
        .map((b) => [b.id, b.textContent.trim(), b.getAttribute("aria-label") || b.textContent.trim()]) }));
    assert(ue.ver === VERSION, "Info: Borometer und die Version (BORO_VERSION)", ue.ver);
    /* Fixrunde 1 (Pruefung Befund 5): der zugaengliche Name je Knopf genau einmal im Abschnitt - „Laden“
       allein sagte nicht, was geladen wird, darum traegt #eBeispielkampf seinen Namen im aria-label */
    /* folgt der Wahl vom 01.10.: der Fehlerbericht ist "Fehler melden" in der Statusleiste. Im Abschnitt
       Entwickler bleibt die Zeile mit einem Satz, der dorthin zeigt; gleich streng: jeder verbleibende Knopf
       genau einmal mit seinem Namen, "Fehler melden" genau einmal auf der Seite und nicht mehr hier. */
    const namen = {};
    for (const n of ["Beispielkampf laden", "Änderungsprotokoll"])
      namen[n] = await p.locator("#eg-dev").getByRole("button", { name: n, exact: true }).count();
    const fehlerHier = await p.locator("#eg-dev").getByRole("button", { name: /Fehler/ }).count();
    const fehlerSeite = await p.getByRole("button", { name: "Fehler melden", exact: true }).count();
    const fehlerSatz = await p.evaluate(() => document.querySelector("#eFehlerZeile")?.textContent.replace(/\s+/g, " ").trim() || "");
    assert(JSON.stringify(ue.knoepfe.map((k) => k[0])) === '["eBeispielkampf","eClog"]' && ue.knoepfe.every((k) => k[1]) &&
      Object.values(namen).every((x) => x === 1) && fehlerHier === 0 && fehlerSeite === 1,
      "Entwickler: Beispielkampf, Aenderungsprotokoll - jeder Knopf mit Wort und genau einmal mit seinem Namen; Fehler melden nur in der Statusleiste",
      { knoepfe: ue.knoepfe, namen, fehlerHier, fehlerSeite });
    assert(/^Fehlerbericht/.test(fehlerSatz) && /Statusleiste/.test(fehlerSatz) && /„Fehler melden“/.test(fehlerSatz) && /ohne das Kampflog/.test(fehlerSatz),
      "Entwickler: die Zeile Fehlerbericht sagt, wo er jetzt steht und was er enthaelt", fehlerSatz);
    // Aenderungsprotokoll: der vorhandene Dialog, Esc zurueck an den Knopf
    await p.click("#eClog").catch((e) => assert(false, "Zeitablauf beim Klick auf #eClog", String(e).split("\n")[0]));
    await dialogAuf(p, "#clogBg", "Aenderungsprotokoll");
    const cl = await p.evaluate(() => ({ an: document.querySelector("#clogBg").classList.contains("on"), fokus: document.activeElement?.id,
      text: (document.querySelector("#clog")?.textContent || "").length }));
    assert(cl.an && cl.fokus === "clogClose" && cl.text > 100, "Aenderungsprotokoll oeffnet #clog, der Fokus auf „Schliessen“", cl);
    await p.keyboard.press("Escape");
    await dialogZu(p, "#clogBg", "Aenderungsprotokoll nach Esc");
    assert(await p.evaluate(() => !document.querySelector("#clogBg").classList.contains("on") && document.activeElement?.id === "eClog"),
      "Esc schliesst das Protokoll, der Fokus geht an den Knopf zurueck");
    // Fehlerbericht: derselbe Weg wie #btnDebug - POST /api/bug/save, die Meldung (seit 01.10. ueber "Fehler melden" in der Statusleiste)
    await p.click("#sbFehler").catch((e) => assert(false, "Zeitablauf beim Klick auf #sbFehler", String(e).split("\n")[0]));
    await warte(p, () => /Fehlerbericht gespeichert/.test(document.querySelector("#toast")?.textContent || ""), undefined, 4000);
    const bug = { n: s.bug.length, name: s.bug[0]?.name || "", daten: !!s.bug[0]?.data && typeof s.bug[0].data === "object",
      toast: await p.evaluate(() => document.querySelector("#toast")?.textContent || "") };
    assert(bug.n === 1 && /^boro-bug-\d{8}-\d{4}$/.test(bug.name) && bug.daten && /Fehlerbericht gespeichert als boro-bug-/.test(bug.toast),
      "Fehler melden (Statusleiste): POST /api/bug/save wie #btnDebug, die Meldung nennt Datei und Ordner", bug);
    // Beispielkampf: laedt das Beispiel und verlaesst die Einstellungen
    await p.click("#eBeispielkampf").catch((e) => assert(false, "Zeitablauf beim Klick auf #eBeispielkampf", String(e).split("\n")[0]));
    await warte(p, () => !document.querySelector("#app").hidden, undefined, 4000);
    let o = await ort(p);
    const nk = await p.evaluate(() => document.querySelectorAll("#fightList .fight").length);
    assert(o.app && !o.einst && nk === 2, "Beispielkampf: das Beispiel ist geladen (zwei Kaempfe), die Einstellungen sind verlassen", { o, nk });
    if (!o.app) await beispiel(p);

    // das Bild im Kopf: Symbol und Wort, derselbe Dialog wie #miShare
    const bk = await p.evaluate(() => { const b = document.querySelector("#btnBild");
      if (!b) return null;
      const w = b.querySelector(".blabel");
      return { imKopf: !!b.closest(".headact"), svg: b.querySelector("svg")?.getAttribute("aria-hidden"), wort: w?.textContent,
        wortBreit: w ? w.getBoundingClientRect().width : 0, title: b.title, name: b.getAttribute("aria-label"), typ: b.type }; });
    /* Neugestaltung 28.09. (Luecke 2.6, Entwurf Bereich Kampf): Teilen ist ein leises Symbol;
       das Wort bleibt im Knopf fuer den Namen, sichtbar ist es nicht mehr. */
    assert(bk && bk.imKopf && bk.svg === "true" && bk.wort === "Als Bild" && bk.wortBreit <= 1 && bk.title === "Als Bild teilen"
      && bk.name === "Als Bild teilen" && bk.typ === "button", "#btnBild im Kopf: Symbol, das Wort „Als Bild“ nur fuer den Namen, Name und title „Als Bild teilen“", bk);
    await p.click("#btnBild").catch((e) => assert(false, "Zeitablauf beim Klick auf #btnBild", String(e).split("\n")[0]));
    await dialogAuf(p, "#shareBg", "Bild-Dialog");
    const bd = await p.evaluate(() => ({ an: document.querySelector("#shareBg").classList.contains("on"), fokus: document.activeElement?.id }));
    assert(bd.an && bd.fokus === "shareCopy", "#btnBild oeffnet den Bild-Dialog wie #miShare", bd);
    await p.keyboard.press("Escape");
    await dialogZu(p, "#shareBg", "Bild-Dialog nach Esc");
    assert(await p.evaluate(() => !document.querySelector("#shareBg").classList.contains("on") && document.activeElement?.id === "btnBild"),
      "Esc schliesst das Bild, der Fokus geht an #btnBild zurueck");

    // volle Ansicht: kein ⋯ und (Neugestaltung 28.09., DECISION 0.14) kein Zahnrad in der
    // Titelleiste; rechts aussen steht wie im Entwurf Anheften (eigenes Fenster)
    o = await ort(p);
    const rechts = await p.evaluate(() => {
      const k = [...document.querySelector(".top").querySelectorAll("button")].filter((b) => b.getClientRects().length > 0 && !b.closest(".wbtns"));
      k.sort((a, b) => a.getBoundingClientRect().right - b.getBoundingClientRect().right);
      return k.at(-1)?.id;
    });
    assert(!o.mehr && !o.zahnrad && rechts === "btnPin", "volle Ansicht: weder ⋯ noch Zahnrad in der Titelleiste, rechts aussen Anheften", { o, rechts });
    // Kompakt: das ⋯ wie heute, vollstaendig; kein Bild-Knopf
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await kompaktIst(p, true);
    o = await ort(p);
    assert(o.mehr && !o.zahnrad && !(await sicht("#btnBild")), "Kompakt: das ⋯ ist da, weder Zahnrad noch Bild-Knopf", o);
    await p.click("#btnMore");
    await warte(p, () => !document.querySelector("#morePanel").hidden, undefined, 5000, "das ⋯-Menue offen"); await steht(p, "⋯-Menue offen");
    const menue = await p.evaluate(() => [...document.querySelectorAll("#morePanel > *")].filter((e) => e.getClientRects().length > 0)
      .map((e) => e.id || e.className));
    assert(JSON.stringify(menue) === KOMPAKT_MENUE, "Kompakt: das ⋯-Menue zeigt dieselben Eintraege wie vor Stufe 3", menue);
    const tot = await p.evaluate(() => ["#miShare", "#btnDebug", "#miDev", "#btnChangelog", ".nurvoll"].filter((q) => document.querySelector(q)));
    assert(!tot.length, "die Eintraege, die nur die volle Ansicht zeigte, gibt es nicht mehr (die Einstellungen und #btnBild tragen sie)", tot);
    await p.keyboard.press("Escape");
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await kompaktIst(p, false);

    // 560 Punkt: das Wort nur im title
    await p.setViewportSize({ width: 560, height: 760 });
    await breiteIst(p, 560);
    const sm = await p.evaluate(() => { const b = document.querySelector("#btnBild"), w = b?.querySelector(".blabel");
      return b && w ? { wortBreit: w.getBoundingClientRect().width, title: b.title, sicht: b.getClientRects().length > 0,
        quer: document.documentElement.scrollWidth > innerWidth } : null; });
    assert(sm && sm.sicht && sm.wortBreit <= 1 && sm.title === "Als Bild teilen" && !sm.quer,
      "unter 640 Punkt: #btnBild nur als Symbol, das Wort im title, kein Querrollen", sm);

    // Zahlenfeld mit Fokus: ein Nachfuehren von anderswo (Strg+Plus) ueberschreibt die Eingabe nicht
    await p.setViewportSize({ width: 1280, height: 860 });
    await breiteIst(p, 1280);
    await p.click(ZAHNRAD);
    await p.click('#einstNav button[data-gruppe="logs"]');
    await gruppeIst(p, "logs");
    await p.click("#eGap", { clickCount: 3 });
    await p.keyboard.type("15");
    const z0 = s.posts.filter((b) => "uiZoom" in b).length;
    await p.keyboard.press("Control+Equal");
    await steht(p, "Strg+Plus");
    const fo = await p.evaluate(() => ({ wert: document.querySelector("#eGap").value, fokus: document.activeElement?.id }));
    assert(s.posts.filter((b) => "uiZoom" in b).length > z0 && fo.wert === "15" && fo.fokus === "eGap",
      "Zahlenfeld mit Fokus: Strg+Plus fuehrt nach, die Eingabe bleibt stehen", fo);
    await p.keyboard.press("Control+0");
    await p.keyboard.press("Enter");
    await steht(p, "Strg+0 und Enter");
    assert(await p.evaluate(() => document.querySelector("#eGap").value) === "15" && s.posts.some((b) => b.splitAfter === 15),
      "Enter: der Wert gilt und steht im Feld");
    /* Zurueckgetippt: waehrend des Tippens aendert das Filterfeld den
       Abstand (9), die Eingabe landet wieder bei 15 (kein change). Beim
       Verlassen folgt das Feld dem Stand. */
    await p.click("#eGap", { clickCount: 3 });
    await p.keyboard.type("2");
    await p.evaluate(() => { const e = document.querySelector("#inGap"); e.value = "9"; e.dispatchEvent(new Event("change", { bubbles: true })); });
    await steht(p, "Filterfeld 9");
    const mitten = await p.evaluate(() => document.querySelector("#eGap").value);
    await p.keyboard.press("Backspace");
    await p.keyboard.type("15");
    await p.keyboard.press("Tab");
    await steht(p, "Feld verlassen");
    const nachher = await p.evaluate(() => document.querySelector("#eGap").value);
    assert(mitten === "2" && nachher === "9", "auf den alten Wert zurueckgetippt und verlassen: das Feld zeigt wieder den Stand (9)", { mitten, nachher });
    assert(!s.fehler.length, "Sicherheit und Ueber: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 10. Querschnitt (Aufgabe 5): drei Themen x zwei Sprachen, Kontrast,
  // Zoom, Tastatur, Vorleser
  {
    /* Kontrast wie in test-rahmen-page.mjs (WCAG, relative Leuchtdichte).
       Der Grund ist der erste deckende Hintergrund darueber; halbdurchsichtige
       Schichten werden darauf gemischt. */
    const lum = (rgb) => { const [r, g, b] = rgb.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    /* Je sichtbarem Satz: Farbe des Textes und des Grunds als [r,g,b]. */
    const farben = (p, sel) => p.evaluate((q) => {
      const rgba = (c) => { const m = c.match(/[\d.]+/g) || ["0", "0", "0", "0"]; return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]]; };
      const misch = (oben, unten) => [0, 1, 2].map((i) => oben[i] * oben[3] + unten[i] * (1 - oben[3])).concat(1);
      const grund = (e) => {
        const schichten = [];
        for (let x = e; x; x = x.parentElement) {
          const c = rgba(getComputedStyle(x).backgroundColor);
          if (c[3] > 0) schichten.push(c);
          if (c[3] >= 1) break;
        }
        let g = [255, 255, 255, 1];
        for (const c of schichten.reverse()) g = misch(c, g);
        return g;
      };
      return [...document.querySelectorAll(q)].filter((e) => e.getClientRects().length > 0 && e.textContent.trim())
        .map((e) => { const g = grund(e); return { text: e.textContent.trim().slice(0, 30), farbe: misch(rgba(getComputedStyle(e).color), g), grund: g }; });
    }, sel);
    const quer = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 0.5);
    for (const thema of ["dark", "light", "tnl"]) {
      for (const lang of ["de", "en"]) {
        const s = await oeffne({ app: true, lang });
        const p = s.page;
        await beispiel(p);
        await p.click('#bereiche [data-tab="settings"]');
        await p.click(`#eThema [role=radio][data-theme="${thema}"]`);
        await themaIst(p, thema);
        const st = await p.evaluate(() => ({ thema: document.documentElement.dataset.theme, h: document.querySelector("#einstTitel").textContent.trim() }));
        assert(st.thema === thema && st.h === (lang === "de" ? "Einstellungen" : "Settings"), `${thema}/${lang}: Thema gesetzt, Kopf in der Sprache`, st);
        assert(!(await quer(p)), `${thema}/${lang}: kein waagerechtes Rollen bei 1280 Punkt`);
        // Fixrunde 1 (Pruefung Befund 6): dazu die Kacheln, die Anzeige "folgt Windows", die leisen Saetze, Hinweise und Info
        const saetze = await farben(p, "#einst .ezt > span, #einst .einstkopf p, #einst .esich dd, #einstNav button:not([aria-current]), #einst .esw-w, " +
          "#einst .thk .tn2 span, #einst .thk .tn2 small, #eBewegung, #einst .gleise, #einst .ehinweis, #eg-info p");
        const schwach = saetze.map((x) => ({ ...x, k: +kontrast(x.farbe, x.grund).toFixed(2) })).filter((x) => x.k < 4.5);
        assert(saetze.length >= 28 && !schwach.length, `${thema}/${lang}: Satzzeilen (.ezt span), Kopf, Sicherheit, Navigation, An/Aus, Kacheln, Anzeige, Hinweise und Info mindestens 4,5:1 (${saetze.length} geprueft)`, schwach);
        // Stand ohne Fehler auch schmal
        await p.setViewportSize({ width: 560, height: 800 });
        await breiteIst(p, 560);
        assert(!(await quer(p)), `${thema}/${lang}: kein waagerechtes Rollen bei 560 Punkt`);
        assert(!s.fehler.length, `${thema}/${lang}: keine Fehler auf der Seite`, s.fehler);
        await p.close();
      }
    }

    const s = await oeffne({ app: true, lang: "de" });
    const p = s.page;
    await beispiel(p);
    await p.click(ZAHNRAD);
    await zeigt(p, "#einst", "die Einstellungen nach dem Zahnrad");
    const posts = (k) => s.posts.filter((b) => k in b).map((b) => b[k]);

    // Vorleser: eine Ueberschrift h1 (die Wortmarke), die Einstellungen h2, jede Gruppe eine Region mit Namen (h3)
    const uk = await p.evaluate(() => ({ h1: [...document.querySelectorAll("h1")].map((h) => h.className || h.id),
      titel: document.querySelector("#einstTitel")?.tagName,
      /* folgt Spezifikation Windows-Einbindung 9: der Abschnitt "Windows" ist ohne windows aus /api/config verborgen -
         gezaehlt werden die sichtbaren; verborgen ist genau er */
      verborgen: [...document.querySelectorAll("#einst section.egruppe[hidden]")].map((g) => g.id),
      gruppen: [...document.querySelectorAll("#einst section.egruppe:not([hidden])")].map((g) => document.getElementById(g.getAttribute("aria-labelledby"))?.tagName) }));
    assert(uk.h1.length === 1 && uk.titel === "H2" && uk.gruppen.length === 8 && uk.gruppen.every((x) => x === "H3") && uk.verborgen.join() === "eg-win",
      "Ueberschriften: ein h1 im Dokument, „Einstellungen“ als h2, die acht Abschnitte als h3 (Windows verborgen)", uk);
    for (const name of ["Darstellung", "Sprache", "Größe", "Overlay", "Log-Ordner", "Gruppe und Server", "Entwickler", "Info"]) {
      const n = await p.getByRole("region", { name, exact: true }).count();
      assert(n === 1, `Vorleser: die Gruppe „${name}“ ist eine Region mit diesem Namen`, n);
    }

    // Tastatur: Tab von der Ueberschrift der ersten Gruppe erreicht jedes Bedienelement, in der Reihenfolge der Zeilen
    await p.click('#einstNav button[data-gruppe="darst"]');
    await gruppeIst(p, "darst");
    const erwartet = await p.evaluate(() => [...document.querySelectorAll(".einstgruppen button, .einstgruppen input, .einstgruppen [tabindex]")]
      .filter((e) => e.tabIndex >= 0 && !e.disabled && e.getClientRects().length > 0)
      .map((e) => e.id || e.dataset.theme || e.dataset.lang));
    const gegangen = [];
    for (let i = 0; i < erwartet.length; i++) {
      await p.keyboard.press("Tab");
      gegangen.push(await p.evaluate(() => { const e = document.activeElement; return e.id || e.dataset.theme || e.dataset.lang || e.tagName; }));
    }
    // folgt Entwurf (Aufgabe 8): die Reihenfolge der acht Abschnitte, dazu Ueber dem Spiel, Overlay ansehen, Live und der Gruppen-Server;
    // "Im Explorer zeigen" gleich nach "Ordner aendern" folgt der Spezifikation Nachtraege N1;
    // folgt Spezifikation Rekorde 3: "Rekorde neu einlesen" als letzte Zeile des Log-Ordners;
    // der Schalter des Update-Hinweises in Info folgt der Spezifikation Update-Hinweis 2.4
    const muss = ["dark", "de", "en", "eZoom", "eSee", "eOben", "eOverlay", "eOrdnerAendern", "eOrdnerExplorer", "eLive", "eGap", "eMin", "ePhasen", "eSpeichern", "eLaden",
      "eRekorde", "eServer", "eServerSave", "eServerCheck", "eDev", "eBeispielkampf", "eClog", "eUpdatePruefen",
      // folgt Spezifikation Rundgang 02.10.2026, 2: "Rundgang zeigen" in Info, nach dem Aenderungsprotokoll
      // und nach dem Schalter des Update-Hinweises, der unter der Version steht
      "eRundgang"];
    assert(JSON.stringify(erwartet) === JSON.stringify(muss) && JSON.stringify(gegangen) === JSON.stringify(muss),
      "Tab erreicht jedes Bedienelement der Einstellungen, in der Reihenfolge der Zeilen", { erwartet, gegangen });

    // Leertaste auf den Schaltern
    await p.focus("#ePhasen");
    await p.keyboard.press("Space");
    await steht(p, "Leertaste auf Phasen");
    let sw = await p.evaluate(() => document.querySelector("#ePhasen").getAttribute("aria-checked"));
    assert(sw === "false" && posts("mergePhases").at(-1) === false, "Leertaste auf „Bossphasen verbinden“: aus, POST {mergePhases:false}", { sw, posts: posts("mergePhases") });
    await p.keyboard.press("Space");
    await steht(p, "Leertaste auf Phasen");
    sw = await p.evaluate(() => document.querySelector("#ePhasen").getAttribute("aria-checked"));
    assert(sw === "true" && posts("mergePhases").at(-1) === true, "noch einmal Leertaste: wieder an", sw);
    await p.focus("#eDev");
    await p.keyboard.press("Space");
    await steht(p, "Leertaste auf Entwicklermodus");
    sw = await p.evaluate(() => ({ dev: document.querySelector("#eDev").getAttribute("aria-checked"), beispiel: document.querySelector("#eBeispiel").getClientRects().length > 0 }));
    assert(sw.dev === "true" && sw.beispiel && posts("devMode").at(-1) === true, "Leertaste auf „Entwicklermodus“: an, die Beispielgruppe erscheint", sw);
    await p.keyboard.press("Space");
    await steht(p, "Leertaste auf Entwicklermodus");

    // Pfeiltasten auf den Reglern
    await p.focus("#eSee");
    await p.keyboard.press("ArrowRight");
    await p.keyboard.press("ArrowRight");
    await steht(p, "Durchsicht → →");
    const see = await p.evaluate(() => ({ v: document.querySelector("#eSee").value, out: document.querySelector("#eSee + output").textContent }));
    assert(see.v === "2" && see.out === "2\u00a0%" && posts("compactAlpha").at(-1) === 0.98, "Durchsicht per → →: 2 %, POST {compactAlpha:0.98}", { see, posts: posts("compactAlpha") });
    await p.keyboard.press("ArrowLeft");
    await steht(p, "Durchsicht ←");
    assert(await p.evaluate(() => document.querySelector("#eSee").value) === "1" && posts("compactAlpha").at(-1) === 0.99, "Durchsicht per ←: 1 %");
    await p.focus("#eZoom");
    await p.keyboard.press("ArrowLeft");
    await zoomIst(p, "0.99");
    const zl = await p.evaluate(() => ({ v: document.querySelector("#eZoom").value, css: document.documentElement.style.zoom }));
    assert(zl.v === "99" && zl.css === "0.99" && posts("uiZoom").at(-1) === 99, "Größe per ←: 99 %, POST {uiZoom:99}", zl);

    // Zoom 50, 150, 200: die Einstellungen bleiben ohne Querrollen und ohne Fehler
    for (const z of [50, 150, 200]) {
      await p.evaluate((w) => { const r = document.querySelector("#eZoom"); r.value = String(w);
        r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); }, z);
      await zoomIst(p, String(z / 100));
      const zs = await p.evaluate(() => {
        const sicht = (q) => { const e = document.querySelector(q); return !!e && e.getClientRects().length > 0; };
        return { css: document.documentElement.style.zoom, quer: document.documentElement.scrollWidth > innerWidth + 0.5,
          nav: sicht("#einstNav"), gruppen: sicht(".einstgruppen"), out: document.querySelector("#eZoom + output").textContent };
      });
      assert(zs.css === String(z / 100) && !zs.quer && zs.nav && zs.gruppen && zs.out === z + "\u00a0%",
        `Größe ${z}\u00a0%: kein waagerechtes Rollen, Navigation und Gruppen stehen`, zs);
    }
    assert(!s.fehler.length, "Querschnitt: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 11. Update-Hinweis (Spezifikation 2026-10-02-update-hinweis-design.md, 2.3, 2.4 und 5): der Schalter in Info,
  //     der Hinweis in Statusleiste und Info. Kein Link wird geklickt: er fuehrte nach github.com, und dieser Test
  //     fragt nichts ausserhalb des gestellten Helfers.
  {
    const PRAEFIX = "https://github.com/B0R0AK/Borometer/releases/tag/";
    const bis = async (fn, was) => {
      for (let i = 0; i < 60; i++) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); }
      assert(false, "Zeitablauf (3000 ms) beim Warten auf: " + was);
      return false;
    };
    const stand = (p) => p.evaluate(() => {
      const q = (x) => document.querySelector(x);
      const sicht = (e) => !!e && e.getClientRects().length > 0;
      const sw = q("#eUpdatePruefen"), sb = q("#sbUpdate"), info = q("#eUpdate");
      return { an: sw?.getAttribute("aria-checked"), wort: sw?.querySelector(".esw-w")?.textContent, zeile: sicht(q("#eUpdateZeile")),
        sb: sicht(sb), sbText: sb?.textContent || "", sbHref: sb?.getAttribute("href"), sbZiel: sb?.getAttribute("target"), sbRel: sb?.getAttribute("rel"),
        info: sicht(info), infoText: info?.textContent || "", infoHref: info?.getAttribute("href"), infoZiel: info?.getAttribute("target"), infoRel: info?.getAttribute("rel"),
        infoTitel: info?.title || "" };
    });
    const zuInfo = async (p) => {
      await p.click(ZAHNRAD);
      await p.click('#einstNav button[data-gruppe="info"]');
      await warte(p, () => document.querySelector("#einstNav button[aria-current]")?.dataset.gruppe === "info", undefined, 30000, "Gruppe Info gewaehlt");
    };

    // a) Standard: ohne Schluessel aus; an und aus schreibt updatePruefen als Wahrheitswert; Tastatur und Vorleser
    {
      const s = await oeffne({ app: true, lang: "de" });
      const p = s.page;
      await zuInfo(p);
      const a = await stand(p);
      assert(a.zeile && a.an === "false" && a.wort === "Aus", "Update-Hinweis: der Schalter steht in Info und ist ohne Schluessel aus", a);
      assert(!a.sb && !a.info && a.sbHref === null && a.infoHref === null, "Update-Hinweis: ohne update in /api/state kein Hinweis und kein href", a);
      const name = await p.getByRole("switch", { name: "Beim Start nach neuer Version sehen", exact: true }).count();
      const satz = await p.evaluate(() => document.getElementById(document.querySelector("#eUpdatePruefen").getAttribute("aria-describedby"))?.textContent || "");
      assert(name === 1 && /einmal je Start bei GitHub/.test(satz) && /IP-Adresse und die Uhrzeit/.test(satz) && /Geladen oder installiert wird nichts/.test(satz),
        "Update-Hinweis: der Schalter hat seinen Namen fuer den Vorleser, der Satz sagt GitHub, IP-Adresse und dass nichts geladen wird", { name, satz });
      await p.click("#eUpdatePruefen");
      await bis(() => s.posts.some((b) => "updatePruefen" in b), "POST updatePruefen");
      const an = await stand(p);
      assert(JSON.stringify(s.posts.filter((b) => "updatePruefen" in b)) === '[{"updatePruefen":true}]' && an.an === "true" && an.wort === "An",
        "Update-Hinweis: Einschalten schreibt {updatePruefen:true} (Wahrheitswert, allein) und zeigt An", { posts: s.posts, an });
      assert(!an.sb && !an.info, "Update-Hinweis: Einschalten fragt nichts sofort - kein Hinweis vor dem naechsten Start", an);
      // Tastatur: Fokus auf den Schalter, Leertaste schaltet aus
      await p.focus("#eUpdatePruefen");
      await p.keyboard.press("Space");
      await bis(() => s.posts.filter((b) => "updatePruefen" in b).length === 2, "zweiten POST");
      const aus = await stand(p);
      assert(JSON.stringify(s.posts.filter((b) => "updatePruefen" in b).map((b) => b.updatePruefen)) === "[true,false]" && aus.an === "false",
        "Update-Hinweis: mit der Leertaste wieder aus, {updatePruefen:false}", { posts: s.posts, aus });
      assert(!s.fehler.length, "Update-Hinweis a): keine Fehler", s.fehler);
      await p.close();
    }
    // b) gespeichert an; nur true gilt als an
    for (const [wert, an] of [[true, "true"], ["true", "false"], [1, "false"], [false, "false"]]) {
      const s = await oeffne({ app: true, lang: "de", config: { updatePruefen: wert } });
      const p = s.page;
      await zuInfo(p);
      await warte(p, (x) => document.querySelector("#eUpdatePruefen").getAttribute("aria-checked") === x, an, 3000);
      const b = await stand(p);
      assert(b.an === an && !s.posts.some((x) => "updatePruefen" in x), `Update-Hinweis: gespeichert ${JSON.stringify(wert)} zeigt ${an === "true" ? "an" : "aus"}, ohne zu schreiben`, b);
      await p.close();
    }
    // c) der Hinweis: Statusleiste und Info, href genau die gepruefte Adresse, DE und EN
    {
      const url = PRAEFIX + "v1.9";
      const s = await oeffne({ app: true, lang: "de", update: { version: "1.9", url } });
      const p = s.page;
      await warte(p, () => !document.querySelector("#sbUpdate").hidden, undefined, 3000);
      await zuInfo(p);
      const c = await stand(p);
      assert(c.sb && c.sbText === "Version 1.9 ist da" && c.sbHref === url && c.sbZiel === "_blank" && /noopener/.test(c.sbRel || ""),
        "Update-Hinweis: Statusleiste „Version 1.9 ist da“, href genau die Release-Seite, im Browser (target _blank, noopener)", c);
      assert(c.info && c.infoText === "Version 1.9 ist da \u2013 Release-Seite \u00f6ffnen \u203a" && c.infoHref === url && c.infoZiel === "_blank"
        && /noopener/.test(c.infoRel || "") && /GitHub/.test(c.infoTitel),
        "Update-Hinweis: Info „Version 1.9 ist da \u2013 Release-Seite \u00f6ffnen \u203a“ mit derselben Adresse", c);
      // links neben der Version
      const lage = await p.evaluate(() => { const r = (q) => document.querySelector(q).getBoundingClientRect();
        return { up: r("#sbUpdate").right, ver: r("#sbVer").left, zoom: r("#sbZoom").right }; });
      assert(lage.up <= lage.ver && lage.up > lage.zoom, "Update-Hinweis: in der Statusleiste zwischen Groesse und Version", lage);
      // Vorleser und Tastatur: ein Link mit seinem Text, per Tab erreichbar
      const links = await p.getByRole("link", { name: "Version 1.9 ist da", exact: true }).count();
      const fokus = await p.evaluate(() => document.querySelector("#sbUpdate").tabIndex);
      assert(links === 1 && fokus === 0, "Update-Hinweis: der Link der Statusleiste ist fuer Vorleser und Tastatur ein Link mit Namen", { links, fokus });
      // Sprache wechseln
      await p.click('#eSprache button[data-lang="en"]');
      await warte(p, () => document.querySelector("#sbUpdate").textContent === "Version 1.9 is out", undefined, 3000);
      const e = await stand(p);
      assert(e.sbText === "Version 1.9 is out" && e.infoText === "Version 1.9 is out \u2013 open the release page \u203a" && e.sbHref === url && e.infoHref === url
        && e.wort === "Off" && /GitHub/.test(e.infoTitel),
        "Update-Hinweis EN: „Version 1.9 is out“ in Statusleiste und Info, gleiche Adresse", e);
      assert(!s.fehler.length, "Update-Hinweis c): keine Fehler", s.fehler);
      await p.close();
    }
    // c2) die Antwort von GitHub kommt erst nach dem ersten /api/state (Sicherheitspruefung M4): eingeschaltet fragt die
    //     Seite nach und zeigt den Hinweis im selben Lauf
    {
      const url = PRAEFIX + "v1.9";
      const s = await oeffne({ app: true, lang: "de", config: { updatePruefen: true }, update: (n) => (n >= 3 ? { version: "1.9", url } : null) });
      const p = s.page;
      await warte(p, () => !document.querySelector("#sbUpdate").hidden, undefined, 12000);
      const v = await stand(p);
      assert(v.sb && v.sbText === "Version 1.9 ist da" && v.sbHref === url && v.infoHref === url && s.staende >= 3,
        "Update-Hinweis: kommt die Antwort erst beim dritten /api/state, steht der Hinweis trotzdem im selben Lauf da", { v, staende: s.staende });
      assert(!s.fehler.length, "Update-Hinweis c2): keine Fehler", s.fehler);
      await p.close();
    }
    // d) kein Hinweis: null (gleich oder aelter - das entscheidet der Hauptprozess, test-update-core), fremde oder kaputte Angaben
    for (const [update, wie] of [[null, "update null (gleich oder aelter)"],
      [{ version: "1.9", url: "https://evil.example/B0R0AK/Borometer/releases/tag/v1.9" }, "fremdes Praefix"],
      [{ version: "1.9", url: "http://github.com/B0R0AK/Borometer/releases/tag/v1.9" }, "http:"],
      [{ version: "1.9", url: PRAEFIX + "v1.9/../../../evil" }, "Pfad hinter dem Tag"],
      [{ version: "1.9", url: PRAEFIX + "javascript:alert(1)" }, "kein Tag"],
      [{ version: "<b>1.9</b>", url: PRAEFIX + "v1.9" }, "Version mit Markup"],
      [{ url: PRAEFIX + "v1.9" }, "ohne Version"],
      ["v1.9", "Text statt Objekt"]]) {
      const s = await oeffne({ app: true, lang: "de", update });
      const p = s.page;
      await zuInfo(p);
      const d = await stand(p);
      assert(!d.sb && !d.info && d.sbHref === null && d.infoHref === null, "Update-Hinweis: " + wie + " - kein Hinweis, kein href", d);
      assert(!s.fehler.length, "Update-Hinweis " + wie + ": keine Fehler", s.fehler);
      await p.close();
    }
    // e) drei Themen: der Hinweis lesbar (mindestens 4,5:1), wie die Saetze in Nr. 10
    {
      const lum = (rgb) => { const [r, g, b] = rgb.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const s = await oeffne({ app: true, lang: "de", update: { version: "1.9", url: PRAEFIX + "v1.9" } });
      const p = s.page;
      await zuInfo(p);
      for (const thema of ["dark", "light", "tnl"]) {
        await p.click(`#eThema [role=radio][data-theme="${thema}"]`);
        await warte(p, (t) => document.documentElement.dataset.theme === t, thema, 30000, "Thema " + thema);
        const f = await p.evaluate(() => {
          const rgba = (c) => { const m = c.match(/[\d.]+/g) || ["0", "0", "0", "0"]; return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]]; };
          const misch = (oben, unten) => [0, 1, 2].map((i) => oben[i] * oben[3] + unten[i] * (1 - oben[3])).concat(1);
          const grund = (e) => { const sch = []; for (let x = e; x; x = x.parentElement) { const c = rgba(getComputedStyle(x).backgroundColor); if (c[3] > 0) sch.push(c); if (c[3] >= 1) break; }
            let g = [255, 255, 255, 1]; for (const c of sch.reverse()) g = misch(c, g); return g; };
          return ["#sbUpdate", "#eUpdate"].map((q) => { const e = document.querySelector(q), g = grund(e), st = getComputedStyle(e);
            return { q, farbe: misch(rgba(st.color), g), grund: g, px: parseFloat(st.fontSize), deko: st.textDecorationLine }; });
        });
        const k = f.map((x) => ({ q: x.q, k: +kontrast(x.farbe, x.grund).toFixed(2), px: x.px, deko: x.deko }));
        assert(k.every((x) => x.k >= 4.5 && x.px >= 11 && x.deko.includes("underline")),
          `Update-Hinweis ${thema}: Statusleiste und Info mindestens 4,5:1, Schrift ab 11 Punkt, als Link unterstrichen`, k);
      }
      await p.close();
    }
    // f) Fenstergroessen: nichts rollt waagerecht, Hinweis und Version ganz in der Statusleiste - auch unter 640 Punkt
    for (const [breite, hoehe] of [[1280, 860], [1920, 1080], [2000, 1480], [1000, 800], [760, 800], [560, 800]]) {
      for (const lang of ["de", "en"]) {
        const s = await oeffne({ app: true, lang, breite, hoehe, update: { version: "1.10.2", url: PRAEFIX + "v1.10.2" } });
        const p = s.page;
        await beispiel(p);
        await warte(p, () => !document.querySelector("#sbUpdate").hidden, undefined, 3000);
        const m = await p.evaluate(() => {
          const f = document.querySelector("#statusleiste").getBoundingClientRect();
          const drin = (q) => { const e = document.querySelector(q), r = e.getBoundingClientRect();
            return e.getClientRects().length > 0 && r.left >= f.left - 0.5 && r.right <= f.right + 0.5 && e.scrollWidth <= e.clientWidth + 1; };
          return { quer: document.documentElement.scrollWidth > innerWidth + 0.5, up: drin("#sbUpdate"), ver: drin("#sbVer"), live: drin("#sbLive"),
            hoehe: Math.round(document.querySelector("#sbUpdate").getBoundingClientRect().height) };
        });
        await zuInfo(p);
        const i = await p.evaluate(() => { const r = document.querySelector("#eUpdate").getBoundingClientRect(), z = document.querySelector("#eUpdateZeile").getBoundingClientRect();
          return { quer: document.documentElement.scrollWidth > innerWidth + 0.5, info: r.width > 0 && r.right <= innerWidth, zeile: Math.round(z.height) }; });
        assert(!m.quer && m.up && m.ver && m.live && m.hoehe <= 26 && !i.quer && i.info && i.zeile <= 200,
          `Update-Hinweis ${breite}×${hoehe} ${lang}: kein waagerechtes Rollen, Hinweis, Version und Live ganz in der Statusleiste, Info-Zeile ganz sichtbar`, { m, i });
        assert(!s.fehler.length, `Update-Hinweis ${breite}×${hoehe} ${lang}: keine Fehler`, s.fehler);
        await p.close();
      }
    }
  }


  // --- 8. Logs im Browser ohne Helfer (file://): ein Satz statt des Ordners,
  // die Kampfdatei als Download und Dateiauswahl
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const fehler = [];
    page.on("pageerror", (e) => fehler.push(String(e)));
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* blockiert */ } });
    await page.goto(pathToFileURL(join(root, "dist", "renderer", "index.html")).href);
    await warte(page, () => typeof document.querySelector("#btnSample2")?.onclick === "function", undefined, 30000, "die Seite ist eingerichtet (file://, #btnSample2 hat seinen Handler)");
    await beispiel(page);
    // einen Kampf speichern, damit die Kampfdatei etwas enthaelt
    await page.click("#btnSaveRun");
    await page.waitForSelector("#modalInput", { state: "visible" });
    await page.click("#modalOk");
    await dialogZu(page, "#modalBg", "Speichern-Dialog nach OK");
    await page.click(ZAHNRAD);
    await zeigt(page, "#einst", "die Einstellungen nach dem Zahnrad");
    const f = await page.evaluate(() => {
      const q = (x) => document.querySelector(x);
      const sicht = (e) => !!e && e.getClientRects().length > 0;
      return { satz: sicht(q("#eOrdnerBrowser")) ? q("#eOrdnerBrowser").textContent : "", aendern: sicht(q("#eOrdnerAendern")), pfad: sicht(q("#eOrdner")) };
    });
    assert(/einzelne Dateien/.test(f.satz) && !f.aendern && !f.pfad, "Browser: statt Ordner und „Ändern“ der Satz, dass der Browser einzelne Dateien öffnet", f);
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 3000 }).catch(() => null), page.click("#eSpeichern")]);
    assert(dl && dl.suggestedFilename() === "boro-runs.json", "Browser: Kampfdatei speichern laedt boro-runs.json herunter (wie #btnSaveRuns)", dl && dl.suggestedFilename());
    const [fc] = await Promise.all([page.waitForEvent("filechooser", { timeout: 3000 }).catch(() => null), page.click("#eLaden")]);
    const wahl = fc ? await fc.element().evaluate((n) => n.id) : null;
    assert(wahl === "runsInput", "Browser: Kampfdatei laden oeffnet die Dateiauswahl #runsInput (wie #btnLoadRuns)", wahl);
    // Der Fehlerbericht ohne Helfer ist ein Download wie an #btnDebug (seit 01.10. "Fehler melden" in der Statusleiste)
    await page.click('#einstNav button[data-gruppe="dev"]');
    const [bug] = await Promise.all([page.waitForEvent("download", { timeout: 3000 }).catch(() => null), page.click("#sbFehler", { timeout: 3000 }).catch(() => null)]);
    assert(bug && bug.suggestedFilename() === "boro-bug-report.json", "Browser: Fehler melden laedt boro-bug-report.json herunter (wie #btnDebug)", bug && bug.suggestedFilename());
    // Gruppe und Server ohne Helfer: ein Satz statt toter Bedienelemente (Aufgabe 8, DECISION 10.12)
    const gr = await page.evaluate(() => { const g = document.querySelector("#eg-gruppe"), sicht = (e) => !!e && e.getClientRects().length > 0;
      return { bedien: [...g.querySelectorAll("input,button")].filter(sicht).length, satz: [...g.querySelectorAll("p")].filter(sicht).map((x) => x.textContent.trim()).join(" ") }; });
    assert(gr.bedien === 0 && /nur in der Borometer-App/.test(gr.satz), "Browser ohne Helfer: Gruppe und Server sagen, dass Gruppen nur in der App gehen", gr);
    // Update-Hinweis ohne Helfer: kein Hauptprozess, der fragen koennte - keine tote Zeile, kein Hinweis
    const upOhne = await page.evaluate(() => { const sicht = (q) => { const e = document.querySelector(q); return !!e && e.getClientRects().length > 0; };
      return { schalter: sicht("#eUpdatePruefen"), zeile: sicht("#eUpdateZeile"), sb: sicht("#sbUpdate"), info: sicht("#eUpdate") }; });
    assert(!upOhne.schalter && !upOhne.zeile && !upOhne.sb && !upOhne.info, "Browser ohne Helfer: weder Schalter noch Hinweis des Update-Hinweises", upOhne);
    assert(!fehler.length, "Logs (Browser): keine Fehler", fehler);
    await page.close();
  }

} finally {
  await browser.close();
}

console.log();
if (failed) { console.log(`EINST PAGE FAILED - ${failed}`); process.exit(1); }
console.log("EINST PAGE PASSED");
