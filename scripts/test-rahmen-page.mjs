// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Instrumententafel Stufe 1 (Spezifikation 27.09.2026, Abschnitte 3, 7 und 8):
// Titelleiste, Kampfwahl, Bereichsleiste und Statusleiste an der gebauten
// Seite, vom gestellten Helfer ausgeliefert (page.route) - als eigenes
// Fenster der App (?win=1, nativeFrame) und als Tab im Browser. Was die
// Seite an /api/win und /api/config schickt, wird mitgeschrieben.
//
// Run:  npm run test:rahmen-page     (baut die Seite zuerst)

import * as esbuild from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");

/* Jede id steht in der Seite nur einmal: eine doppelte id laesst querySelector
   und aria-Bezuege still das erste Element treffen (#ringHinweis stand im
   Ringfeld und in der Ringmitte). Gezaehlt wird das Markup; die eingebetteten
   Skripte bauen ids in Zweigen, die sich ausschliessen. */
{
  const zahl = new Map(), markup = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "");
  for (const m of markup.matchAll(/\sid="([^"]+)"/g)) zahl.set(m[1], (zahl.get(m[1]) || 0) + 1);
  const doppelt = [...zahl].filter(([, n]) => n > 1).map(([id, n]) => id + " x" + n);
  assert(zahl.size > 50 && !doppelt.length, "Seite: jede id steht nur einmal", doppelt);
}
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Ein Log in der Form, die das Spiel schreibt (wie test-best-page.mjs): alle
   0,5 s ein Treffer, vier Faehigkeiten im Wechsel. Nur Zielnamen und Zahlen,
   keine Spielernamen. Drei Laeufe (Bloecke trennen sich nach 60 s Ruhe):
   A um 20:00 mit Vulcanus zwischen zwei Trash-Gegnern, B um 20:30 mit
   Vulcanus und Trash, C um 21:30 nur Trash. Jeder Trash-Gegner heisst anders,
   damit "Phasen zusammenfuehren" nichts verbindet. LOG2 ist dieselbe Datei
   mit einem vierten Lauf (D, 22:00, Vulcanus) - der neue Kampf im Live. */
const SKILLS = [["Detonation Mark", 953174691], ["Quick Fire", 964762401],
                ["Strafing", 945674044], ["Decisive Sniping", 964581976]];
const two = (n, w = 2) => String(n).padStart(w, "0");
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-` +
         `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`;
};
function logText(pulls) {
  const lines = ["CombatLogVersion,4"];
  for (const p of pulls) {
    for (let k = 0; k * 500 < p.secs * 1000; k++) {
      const [skill, sid] = SKILLS[k % SKILLS.length];
      const dmg = Math.round(1000 * p.scale * (1 + (k % 5)));
      lines.push(`${stamp(p.start + k * 500)},DamageDone,${skill},${sid},${dmg},0,0,kNormalHit,Tester,${p.target}`);
    }
  }
  return lines.join("\n") + "\n";
}
const at = (h, m, s = 0) => Date.UTC(2026, 8, 20, h, m, s);
const PULLS = [
  { target: "Molting Grave Wolf", start: at(20, 0, 0), secs: 20, scale: 0.6 },
  { target: "Vulcanus", start: at(20, 0, 40), secs: 60, scale: 1.0 },
  { target: "Grave Bat", start: at(20, 2, 0), secs: 20, scale: 0.7 },
  { target: "Vulcanus", start: at(20, 30, 0), secs: 60, scale: 1.2 },
  { target: "Ash Crawler", start: at(20, 31, 20), secs: 20, scale: 0.8 },
  { target: "Frost Wolf", start: at(21, 30, 0), secs: 20, scale: 0.9 },
  { target: "Stone Beetle", start: at(21, 30, 40), secs: 20, scale: 1.0 },
];
const work = mkdtempSync(join(tmpdir(), "boro-rahmen-"));
const LOG = join(work, "TLCombatLog-20260920.txt");
writeFileSync(LOG, logText(PULLS));
mkdirSync(join(work, "live"));
const LOG2 = join(work, "live", "TLCombatLog-20260920.txt");
writeFileSync(LOG2, logText([...PULLS, { target: "Vulcanus", start: at(22, 0, 0), secs: 60, scale: 1.1 }]));
// LOG3: noch ein Pull danach (22:30) - der zweite Live-Takt, ohne Suchtext
mkdirSync(join(work, "live3"));
const LOG3 = join(work, "live3", "TLCombatLog-20260920.txt");
writeFileSync(LOG3, logText([...PULLS, { target: "Vulcanus", start: at(22, 0, 0), secs: 60, scale: 1.1 },
  { target: "Vulcanus", start: at(22, 30, 0), secs: 60, scale: 1.3 }]));

/* Eine Seite am gestellten Helfer. app: ?win=1 und nativeFrame (das eigene
   Fenster der App), sonst ein Browser-Tab auf 127.0.0.1. config: was GET
   /api/config antwortet. uhr: feste Uhrzeit (ms) fuer "heute"; zone: die
   Zeitzone der Seite (sonst die des Rechners). helfer: {dir, file, text} -
   der Helfer beobachtet einen Ordner, /api/state nennt ihn und die Datei,
   /api/latest liefert den Text am Stueck (Live wird per Klick gestartet). */
async function oeffne({ app = false, lang = "en", config = {}, breite = 1280, hoehe = 860, uhr = null, stayOnTop = false, zone = undefined, helfer = null } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe }, ...(zone ? { timezoneId: zone } : {}) });
  if (uhr !== null) await page.clock.setFixedTime(uhr);
  const s = { page, fehler: [], posts: [], win: [] };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/state") return json(helfer
      ? { dir: helfer.dir, file: helfer.file, size: helfer.text.length, mtime: 1, nativeFrame: app, material: false, stayOnTop }
      : { dir: "", file: "", nativeFrame: app, material: false, stayOnTop });
    if (path === "/api/latest" && helfer) {
      const n = helfer.text.length;
      return json({ file: helfer.file, from: 0, to: n, size: n, head: helfer.text.split("\n").slice(0, 2).join("\n"), text: helfer.text });
    }
    /* folgt Spezifikation Rundgang 02.10.2026: ein erster Start der App zeigt den
       Rundgang. Diese Proben gelten der App danach; den Rundgang selbst prueft
       test-rundgang-page.mjs. Eine eigene config kann es ueberschreiben. */
    if (path === "/api/config" && req.method() === "GET") return json({ rundgangGesehen: true, ...config });
    if (path === "/api/config") { s.posts.push(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
    if (path === "/api/win") {
      const b = JSON.parse(req.postData() || "{}"); s.win.push(b);
      // wie der Hauptprozess: pin antwortet mit dem Stand, den es gesetzt hat
      return json({ ok: true, max: false, w: 400, h: 28, on_top: b.do === "pin" ? !!b.on : true });
    }
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: {} }); }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html" + (app ? "?win=1" : ""));
  // Seite fertig: body[data-bereit] statt #landStatus (Neugestaltung 28.09., Befund 2)
  await page.waitForFunction((h) => document.body.dataset.bereit === (h ? "ordner" : "ohne"), !!helfer);
  await page.waitForTimeout(400);
  return s;
}
/* Wartet, bis die Liste der Kampfwahl ruht (#212): nach einem Groessenwechsel rechnet die Seite erst im naechsten
   Bild (ResizeObserver setzt --kwreste), und der Browser rastet die Liste nach jeder Layoutaenderung neu ein - aus
   Lage 0 wird die Raste der ersten Zeile (22). Wer davor End und Pos1 drueckt, misst gegen dieses Nachrasten.
   Ruhe heisst: Rollstelle, Rollhoehe, Feldhoehe und --kwreste bleiben ueber 8 Bilder und mindestens 120 ms gleich
   (monotone Uhr der Seite). Eine feste Pause gaebe unter Last das falsche Bild. */
async function ruhe(p) {
  await p.waitForFunction(() => {
    const l = document.querySelector("#kwListe");
    const jetzt = [l.scrollTop, l.scrollHeight, l.clientHeight, l.style.getPropertyValue("--kwreste")].join("/"), t = performance.now();
    const w = (window.__kwRuhe ??= { stand: "", seit: t, n: 0 });
    if (w.stand !== jetzt) { w.stand = jetzt; w.seit = t; w.n = 0; return false; }
    w.n++;
    return w.n >= 8 && t - w.seit >= 120;
  }, null, { polling: "raf", timeout: 15000 });
  await p.evaluate(() => { delete window.__kwRuhe; });
}
/* Mit Log: die Lage der Knoepfe in der Leiste wird mit geladenem Log
   gemessen. (Seit der Kritik vom 28.09. stehen Live und Oeffnen auch auf
   der Startseite oben - test-felder-page.mjs, Abschnitt 10.) */
async function mitLog(s, datei = LOG) {
  await s.page.setInputFiles("#fileInput", datei);
  await s.page.waitForFunction(() => !document.querySelector("#app").hidden);
  await s.page.waitForTimeout(200);
}
/* Stufe 3: das ⋯-Menue gibt es nur noch im Kompakt. Wer in der vollen
   Ansicht etwas einstellt, geht wie ein Spieler ueber die Einstellungen: das
   Zahnrad der Titelleiste (ohne Kampf das der Bereichsleiste), die Gruppe
   in der Navigation, dort die Zeile - und danach zurueck in den Bereich, in
   dem er war, wenn die Handlung ihn nicht schon hinausgefuehrt hat. */
async function einstellung(p, gruppe, tun) {
  const vorher = await p.evaluate(() => document.querySelector('#bereiche .tab[aria-current="page"]')?.dataset.tab || "");
  const oben = await p.evaluate(() => document.querySelector("#btnEinst").getClientRects().length > 0);
  await p.click(oben ? "#btnEinst" : '#bereiche [data-tab="settings"]');
  await p.click(`#einstNav button[data-gruppe="${gruppe}"]`);
  await tun();
  if (vorher && vorher !== "settings" && await p.evaluate(() => !document.querySelector("#einst").hidden))
    await p.click(`#bereiche [data-tab="${vorher}"]`);
}
/* Ein Regler wie unter der Hand: Wert, input beim Ziehen, change beim
   Loslassen (Playwright fuellt keine range; wie test-einst-page.mjs). */
const regler = (p, sel, v) => p.evaluate(([q, w]) => {
  const r = document.querySelector(q); r.value = String(w);
  r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true }));
}, [sel, v]);
const beispielLaden = (p) => einstellung(p, "dev", () => p.click("#eBeispielkampf"));
const sprache = (p, l) => einstellung(p, "sprache", () => p.click(`#eSprache button[data-lang="${l}"]`));
const themaWaehlen = (p, th) => einstellung(p, "darst", () => p.click(`#eThema [data-theme="${th}"]`));
const entwickler = (p) => einstellung(p, "dev", () => p.click("#eDev"));
const kopf = (p) => p.evaluate(() => {
  const top = document.querySelector(".top"), cs = getComputedStyle(top);
  const r = (q) => { const e = document.querySelector(q); return e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null; };
  const kinder = [...top.children].filter((e) => e.getClientRects().length > 0).map((e) => e.getBoundingClientRect());
  return { h: top.getBoundingClientRect().height, rechts: cs.paddingRight, ziehen: cs.getPropertyValue("app-region"),
    knopfZieht: getComputedStyle(document.querySelector("#btnOpen")).getPropertyValue("app-region"),
    // rechts aussen: im Kompakt das ⋯; in der vollen Ansicht seit der Neugestaltung 28.09.
    // (DECISION 0.14, Zahnrad nur unten in der Symbolleiste) Anheften, im Browser das Overlay
    mark: r(".mark"), live: r("#btnWatch"), mehr: r("#btnMore") || r("#btnPin") || r("#btnCompact"), pin: r("#btnPin"),
    wbtns: !!document.querySelector(".top .wbtns") && getComputedStyle(document.querySelector(".top .wbtns")).display !== "none",
    breit: innerWidth, quer: document.documentElement.scrollWidth > innerWidth,
    // rechts endet die Leiste vor ihrem Innenabstand - in der App ist das die Reserve der Systemknoepfe
    ausserhalb: kinder.filter((k) => k.left < -0.5 || k.right > innerWidth - parseFloat(cs.paddingRight) + 0.5).length };
});

try {
  // --- 1. Titelleiste (3.1): 36 Punkt seit der Neugestaltung 28.09. (Luecke 0.2, vorher 40), Ziehen und Reserve nur in der App
  {
    const s = await oeffne({ app: true });
    const start = await kopf(s.page);
    assert(Math.abs(start.h - 36) < 0.5 && start.ziehen === "drag", "App, Startseite: die Titelleiste ist 36 Punkt hoch und zieht", start);
    await mitLog(s);
    const l = await kopf(s.page);
    assert(Math.abs(l.h - 36) < 0.5, "App: die Titelleiste ist 36 Punkt hoch", l.h);
    assert(l.rechts === "138px", "App: rechts bleibt die Reserve der Systemknoepfe frei", l.rechts);
    assert(l.ziehen === "drag" && l.knopfZieht === "no-drag", "App: die ganze Leiste zieht das Fenster, die Knoepfe nicht", l);
    assert(l.mark && l.live && l.mehr && l.mark.right <= l.live.left && l.live.right <= l.mehr.left && l.mehr.right <= l.breit - 138 + 0.5,
      "App: Wortmarke links, Live bis Menue rechts vor der Reserve", l);
    assert(!!l.pin, "App: Anheften steht auch in der vollen Ansicht", l.pin);
    const chrome = s.win.filter((b) => b.do === "chrome");
    assert(chrome.length > 0 && chrome.every((b) => b.height === 36), "App: die Seite meldet 36 als Hoehe der Titelleiste", chrome);
    await s.page.click("#btnPin");
    await s.page.waitForTimeout(200);
    assert(s.win.some((b) => b.do === "pin" && b.on === true) && await s.page.getAttribute("#btnPin", "aria-pressed") === "true",
      "App: Anheften in der vollen Ansicht nutzt die vorhandene Aktion pin", s.win.filter((b) => b.do === "pin"));
    assert(s.win.filter((b) => b.do === "pin").every((b) => b.remember === false),
      "App: Anheften in der vollen Ansicht wird nicht fuer den naechsten Start gemerkt", s.win.filter((b) => b.do === "pin"));
    // Kompakt: der Streifen behaelt seine 26 Punkt, gezogen wird nur am Griff
    await s.page.evaluate(() => document.querySelector("#btnCompact").click());
    await s.page.waitForTimeout(400);
    const k = await kopf(s.page);
    assert(Math.abs(k.h - 26) < 0.5 && k.ziehen !== "drag", "Kompakt: der Streifen bleibt 26 Punkt, ohne Ziehen auf der ganzen Leiste", k);
    assert(!s.fehler.length, "App: keine Fehler auf der Seite", s.fehler);
    await s.page.close();
  }
  {
    /* Die letzte Sitzung endete angeheftet (stayOnTop). Wer schon in der
       vollen Ansicht anheftet und dann nach Kompakt wechselt, bleibt
       angeheftet - das gemerkte Anheften darf es nicht wieder loesen. */
    const s = await oeffne({ app: true, stayOnTop: true });
    await s.page.click("#btnPin");
    await s.page.waitForTimeout(200);
    const vorher = s.win.length;
    await s.page.evaluate(() => document.querySelector("#btnCompact").click());
    await s.page.waitForTimeout(400);
    const pins = s.win.slice(vorher).filter((b) => b.do === "pin");
    assert(await s.page.getAttribute("#btnPin", "aria-pressed") === "true" && !pins.some((b) => b.on === false),
      "App: gemerktes Anheften loest ein schon gesetztes Anheften beim Wechsel nach Kompakt nicht", pins);
    // im Kompakt angeheftet wird wie bisher gemerkt
    await s.page.click("#btnPin");   // loesen
    await s.page.click("#btnPin");   // wieder anheften
    await s.page.waitForTimeout(200);
    const kompakt = s.win.slice(vorher).filter((b) => b.do === "pin");
    assert(kompakt.length >= 2 && kompakt.every((b) => b.remember !== false),
      "Kompakt: Anheften wird wie bisher fuer den naechsten Start gemerkt", kompakt);
    assert(!s.fehler.length, "App, gemerktes Anheften: keine Fehler auf der Seite", s.fehler);
    await s.page.close();
  }
  {
    const s = await oeffne({ app: true, config: { uiZoom: 150 } });
    await s.page.waitForTimeout(300);
    const l = await kopf(s.page);
    const chrome = s.win.filter((b) => b.do === "chrome");
    assert(Math.abs(l.h - 54) < 1, "App, 150 %: die Titelleiste ist 54 Fensterpunkte hoch", l.h);
    assert(chrome.length > 0 && chrome[chrome.length - 1].height === 54, "App, 150 %: gemeldet werden 54", chrome);
    await s.page.close();
  }
  {
    const s = await oeffne({ app: false });
    const l = await kopf(s.page);
    assert(Math.abs(l.h - 36) < 0.5, "Browser: dieselbe Leiste, 36 Punkt", l.h);
    assert(l.rechts === "8px" && l.ziehen !== "drag", "Browser: keine Reserve rechts, kein Ziehen", l);
    assert(!l.pin && !l.wbtns, "Browser: kein Anheften, keine eigenen Fensterknoepfe", l);
    assert(!s.win.some((b) => b.do === "chrome"), "Browser: keine Hoehe an den Hauptprozess", s.win);
    await s.page.close();
  }
  // schmale Fenster: 36 Punkt, solange es reicht; darunter bricht die Leiste um, nie quer
  for (const [breite, app] of [[1040, true], [900, true], [760, true], [752, true], [700, false], [640, false], [560, false], [560, true]]) {
    const s = await oeffne({ app, breite });
    await mitLog(s);
    const l = await kopf(s.page);
    const eine = app ? breite > 752 : breite > 640;
    assert(!l.quer && l.ausserhalb === 0, `${app ? "App" : "Browser"} ${breite}: kein Querlauf, kein Bedienelement unter der Reserve oder ausserhalb`, l);
    if (eine) assert(Math.abs(l.h - 36) < 0.5, `${app ? "App" : "Browser"} ${breite}: eine Zeile, 36 Punkt`, l.h);
    else assert(l.h >= 36 && l.live && l.mehr, `${app ? "App" : "Browser"} ${breite}: umgebrochen, alle Knoepfe sind da`, l);
    await s.page.close();
  }

  // --- 2. Kampfwahl (3.2): Knopf, Strg+K, Suche, Tastatur, Loesen, Live, Kompakt
  {
    const s = await oeffne();
    const p = s.page;
    const zustand = () => p.evaluate(() => {
      const feld = document.querySelector("#kwSuche"), aktiv = feld.getAttribute("aria-activedescendant");
      const sicht = [...document.querySelectorAll("#fightList .fight")].filter((f) => !f.closest("[hidden]"));
      const a = aktiv ? document.getElementById(aktiv) : null;
      return { offen: !document.querySelector("#kampfwahl").hidden, fokus: document.activeElement?.id || "",
        expanded: document.querySelector("#kwKnopf").getAttribute("aria-expanded"),
        aktiv, aktivDa: !!a && !a.closest("[hidden]") && a.classList.contains("aktiv"),
        sicht: sicht.map((f) => f.getAttribute("aria-label").split(",")[0]), ids: sicht.map((f) => f.id),
        knopf: document.querySelector("#kwKnopf").textContent.replace(/\s+/g, " ").trim(), wert: feld.value,
        // die ganze Uhrzeit steht seit der Neugestaltung (0.4) im Namen, sichtbar "21:30 \u00b7 20 s"
        label: document.querySelector("#kwKnopf").getAttribute("aria-label") || "",
        status: document.querySelector("#kwStatus").textContent };
    });
    // was angewaehlt ist, an seinem Inhalt (Name, DPS, Uhrzeit), nicht an der id
    const anwahl = () => p.evaluate(() => {
      const id = document.querySelector("#kwSuche").getAttribute("aria-activedescendant");
      const e = id ? document.getElementById(id) : null;
      return e ? (e.getAttribute("aria-label") || e.textContent.trim()) : null;
    });
    // ohne Log
    let z = await zustand();
    // #155: ohne Log sagt die Pille, was fehlt, und oeffnet das Log
    const ohneLog = await p.evaluate(() => ({ name: document.querySelector("#kwKnopf").getAttribute("aria-label") }));
    assert(z.knopf === "No log \u00b7 Open log" && z.expanded === "false" && ohneLog.name === "No log loaded, open a log",
      "ohne Log: die Pille sagt No log \u00b7 Open log, der Name fuer den Vorleser ebenso", { knopf: z.knopf, ohneLog });
    await p.evaluate(() => { window.__offen = 0; document.querySelector("#miOpenCombat").addEventListener("click", () => window.__offen++); });
    await p.click("#kwKnopf");
    assert(await p.evaluate(() => window.__offen) === 1 && (await zustand()).offen === false,
      "ohne Log: ein Klick auf die Pille oeffnet das Log, nicht die Kampfwahl");
    await p.keyboard.press("Control+K");
    z = await zustand();
    const leer = await p.evaluate(() => ({ an: !document.querySelector("#kwLeer").hidden, text: document.querySelector("#kwLeer").innerText,
      hint: !document.querySelector("#fightHint").hidden }));
    assert(z.offen && z.fokus === "kwSuche" && z.expanded === "true", "Strg+K oeffnet das Feld, der Fokus steht in der Suche", z);
    assert(leer.an && leer.text.includes("No fight \u2013 open a log") && leer.text.includes("Open logs") && !leer.hint,
      "ohne Log: Kein Kampf - Log oeffnen, mit dem Oeffnen-Knopf", leer);
    const fuss = await p.evaluate(() => ({ tasten: document.querySelector("#kwTasten").hidden, laeufe: document.querySelector("#kwLaeufe").hidden,
      filter: document.querySelector("#filterBtn").hidden, zahl: document.querySelector("#fightCount").dataset.i18n }));
    assert(fuss.tasten && fuss.laeufe && fuss.filter && fuss.zahl === "rail.noneLoaded",
      "ohne Log: Tastenhinweise, Gespeichert und Filter sind verborgen; die Zahl traegt ihren Schluessel", fuss);
    await p.keyboard.press("Escape");
    z = await zustand();
    assert(!z.offen && z.fokus === "kwKnopf" && z.expanded === "false", "Esc schliesst, der Fokus ist wieder am Knopf", z);

    // mit Log: der Knopf nennt den Kampf und steht in der Mitte
    await p.setInputFiles("#fileInput", LOG);
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    await p.waitForTimeout(200);
    z = await zustand();
    const fussMit = await p.evaluate(() => ({ tasten: document.querySelector("#kwTasten").hidden, laeufe: document.querySelector("#kwLaeufe").hidden,
      filter: document.querySelector("#filterBtn").hidden }));
    assert(!fussMit.tasten && !fussMit.laeufe && !fussMit.filter, "mit Log: Tastenhinweise, Gespeichert und Filter sind wieder da", fussMit);
    const neueste = await p.evaluate(() => document.querySelector("#hName").textContent);
    assert(z.knopf.includes(neueste) && z.knopf.includes("21:30") && z.label.includes("21:30:40") && !z.knopf.includes("Choose a fight"),
      "mit Log: der Knopf nennt Boss und Uhrzeit des Kampfes, den man ansieht", { knopf: z.knopf, neueste });
    const lage = await p.evaluate(() => { const r = (q) => document.querySelector(q).getBoundingClientRect().toJSON();
      return { mark: r(".mark"), knopf: r("#kwKnopf"), live: r("#btnWatch"), top: r(".top") }; });
    assert(lage.mark.right <= lage.knopf.left && lage.knopf.right <= lage.live.left && Math.abs(lage.top.height - 36) < 0.5,
      "der Knopf steht in der Mitte der 36-Punkt-Leiste, zwischen Marke und Live", lage);

    // Rollen: combobox steuert listbox, Gruppen je Lauf, Kaempfe sind Optionen
    await p.keyboard.press("Control+K");
    // Rollen (#154): combobox steuert einen Baum; Koepfe sind Eintraege der Ebene 1 mit aria-expanded,
    // Kaempfe darunter Ebene 2 (Trash-Kaempfe 3); jede Ebene zaehlt ihre Geschwister
    const gruppen = await p.evaluate(() => [...document.querySelectorAll('#fightList .blockfold')].map((k) => k.textContent.trim()));
    const rollen = await p.evaluate(() => {
      const alle = [...document.querySelectorAll("#fightList .fight, #fightList .blockfold, #fightList .trashhead")];
      return { liste: document.querySelector("#fightList").getAttribute("role"),
        feld: document.querySelector("#kwSuche").getAttribute("role"), steuert: document.querySelector("#kwSuche").getAttribute("aria-controls"),
        eintraege: alle.every((f) => f.getAttribute("role") === "treeitem" && f.id && f.tabIndex === -1 && +f.getAttribute("aria-level") >= 1
          && +f.getAttribute("aria-posinset") >= 1 && +f.getAttribute("aria-posinset") <= +f.getAttribute("aria-setsize")),
        koepfe: [...document.querySelectorAll("#fightList .blockfold")].every((k) => k.getAttribute("aria-level") === "1"
          && ["true", "false"].includes(k.getAttribute("aria-expanded")) && !k.hasAttribute("aria-selected")
          && (k.getAttribute("aria-describedby") || "").split(" ").every((i) => !!document.getElementById(i))),
        unterKopf: [...document.querySelectorAll("#fightList .blockgroup .fight:not(.trash)")].every((f) => f.getAttribute("aria-level") === "2"),
        gewaehlt: [...document.querySelectorAll("#fightList .fight")].filter((f) => f.getAttribute("aria-selected") === "true").length,
        // Faktenzeile, Spanne und Regelsatz stehen nicht als lose Texte im Baum
        lose: [...document.querySelectorAll("#fightList .factline, #fightList .gz, #fightList .blockregel")].filter((e) => !e.closest('[aria-hidden="true"]')).length,
        ueberschriften: document.querySelectorAll('#fightList [role="heading"], #fightList [role="group"]').length,
        fxVerborgen: [...document.querySelectorAll("#fightList .fx")].every((x) => x.getAttribute("aria-hidden") === "true"),
        listeTab: document.querySelector("#kwListe").getAttribute("tabindex") };
    });
    assert(gruppen.length >= 2 && gruppen.every(Boolean), "die Liste ist nach Lauf gruppiert, jeder Kopf traegt seinen Namen", gruppen);
    assert(rollen.liste === "tree" && rollen.feld === "combobox" && rollen.steuert === "fightList" && rollen.eintraege && rollen.koepfe
      && rollen.unterKopf && rollen.gewaehlt === 1 && rollen.lose === 0 && rollen.ueberschriften === 0 && rollen.fxVerborgen && rollen.listeTab === "-1",
      "combobox steuert den Baum, Eintraege mit Ebene und Platz, Koepfe klappen, genau ein Kampf gewaehlt", rollen);
    z = await zustand();
    assert(z.aktivDa && z.aktiv === await p.evaluate(() => document.querySelector("#fightList .fight.on").id),
      "beim Oeffnen ist der gewaehlte Kampf angewaehlt", z);

    // Suche und Tastatur
    await p.keyboard.type("vulc");
    await p.waitForTimeout(100);
    z = await zustand();
    assert(z.sicht.length === 2 && z.sicht.every((n) => n === "Vulcanus") && z.status === "2 fights",
      "Suche vulc: nur die zwei Pulls an Vulcanus, der Vorleser hoert die Zahl", z);
    assert(z.aktiv === z.ids[0], "beim Tippen ist der erste Treffer angewaehlt", z);
    await p.keyboard.press("ArrowDown");
    z = await zustand();
    assert(z.aktiv === z.ids[1], "Pfeil ab: der naechste Treffer", z);
    await p.keyboard.press("Home");
    assert((await zustand()).aktiv === z.ids[0], "Pos1: der erste Treffer");
    await p.keyboard.press("End");
    z = await zustand();
    assert(z.aktiv === z.ids[1] && z.fokus === "kwSuche" && z.wert === "vulc", "Ende: der letzte, Fokus und Suchtext bleiben", z);
    await p.keyboard.press("Enter");
    await p.waitForTimeout(150);
    z = await zustand();
    const gewaehlt = await p.evaluate(() => document.querySelector("#hName").textContent);
    assert(!z.offen && z.fokus === "kwKnopf" && gewaehlt === "Vulcanus" && z.knopf.includes("Vulcanus"),
      "Enter oeffnet den Kampf, schliesst das Feld, der Fokus steht am Knopf", { z, gewaehlt });
    // #154: Pos1 nach Ende zeigt den ersten Kopf, die Liste steht oben
    await p.keyboard.press("Control+K");
    await ruhe(p);
    await p.keyboard.press("End");
    await p.keyboard.press("Home");
    const pos1 = await p.evaluate(() => {
      const l = document.querySelector("#kwListe"), id = document.querySelector("#kwSuche").getAttribute("aria-activedescendant");
      const e = document.getElementById(id), lr = l.getBoundingClientRect(), r = e.getBoundingClientRect();
      return { top: l.scrollTop, kopf: e.classList.contains("blockfold"), sichtbar: r.top >= lr.top - 0.5 && r.bottom <= lr.bottom + 0.5 };
    });
    assert(pos1.top === 0 && pos1.kopf && pos1.sichtbar, "#154 Pos1 nach Ende: die Liste rollt ganz nach oben, der erste Kopf ist zu sehen", pos1);
    await p.keyboard.press("Escape");
    await p.keyboard.press("Control+K");
    z = await zustand();
    assert(z.wert === "" && z.sicht.length > 2, "wieder geoeffnet: die Suche ist leer, alle Laeufe stehen da", z);
    await p.keyboard.type("zzz");
    const kein = await p.evaluate(() => ({ an: !document.querySelector("#kwKeinTreffer").hidden, text: document.querySelector("#kwKeinTreffer").textContent }));
    assert(kein.an && kein.text === "No fight matches \u201czzz\u201d", "kein Treffer: ein Satz sagt es", kein);
    await p.keyboard.press("Escape");

    // Loesen mit Rueckgaengig, aus dem offenen Feld
    await p.keyboard.press("Control+K");
    const vorher = await p.evaluate(() => document.querySelectorAll("#fightList .fight").length);
    const reihe = p.locator("#fightList .fightrow").first();
    await reihe.hover();
    assert(await reihe.locator(".fx").isVisible(), "Hover: das Zeichen zum Loesen erscheint an der Zeile");
    await reihe.locator(".fx").click();
    await p.waitForTimeout(200);
    const nach = await p.evaluate(() => ({ n: document.querySelectorAll("#fightList .fight").length,
      undo: document.querySelector("#toast.on .tact")?.textContent, offen: !document.querySelector("#kampfwahl").hidden,
      fokus: document.activeElement?.id }));
    assert(nach.n === vorher - 1 && nach.undo === "Undo" && nach.offen && nach.fokus === "kwSuche",
      "Loesen: die Zeile ist weg, Rueckgaengig steht bereit, das Feld bleibt offen", { vorher, nach });
    await p.click("#toast .tact");
    await p.waitForTimeout(200);
    const zurueck = await p.evaluate(() => ({ n: document.querySelectorAll("#fightList .fight").length, offen: !document.querySelector("#kampfwahl").hidden }));
    assert(zurueck.n === vorher && zurueck.offen, "Rueckgaengig: die Zeile ist wieder da, das Feld blieb offen", zurueck);
    assert(await p.evaluate(() => document.activeElement?.id) === "kwSuche", "Rueckgaengig: der Fokus steht wieder in der Suche");
    // ein Klick auf eine leere Stelle im Feld nimmt der Suche den Fokus nicht
    // (die Zahl steht seit der Neugestaltung 28.09. im Kopf des Feldes, 0.6).
    // Die Klickstelle ist verlegt (Nachtraege N3, Pruefung G3, auf das Wort des Controllers im Rahmen von
    // Auftrag vom 30.09.): Tag und Pfeile stehen jetzt zusammen links, die leere Flaeche rechts davon
    // ist .kwluft. Gleich streng: ein Klick auf eine leere Stelle im Kopf, derselbe Fokus, dasselbe Feld.
    await p.click("#kampfwahl .kwluft");
    assert(await p.evaluate(() => document.activeElement?.id) === "kwSuche" && (await zustand()).offen,
      "Klick auf eine leere Stelle im Feld: der Fokus bleibt in der Suche");
    // Bearbeiten: die Suche beschreibt den Weg mit Entf
    await p.click("#btnEditFights");
    const bes = await p.evaluate(() => { const ids = (document.querySelector("#kwSuche").getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
      return ids.map((i) => document.getElementById(i)?.textContent || "").join(" "); });
    assert(bes.includes("Delete"), "Bearbeiten: die Suche verweist auf die Entf-Taste (aria-describedby)", bes);
    await p.click("#btnEditFights");
    assert(!(await p.evaluate(() => document.querySelector("#kwSuche").getAttribute("aria-describedby"))), "Bearbeiten aus: kein Verweis mehr");
    // Esc wirkt auch, wenn der Fokus nirgends steht
    await p.evaluate(() => document.activeElement?.blur());
    await p.keyboard.press("Escape");
    z = await zustand();
    assert(!z.offen && z.fokus === "kwKnopf", "Esc mit Fokus auf der Seite: das Feld schliesst, der Fokus geht an den Knopf", z);
    await p.keyboard.press("Control+K");
    // ein echter Mausklick auf eine leere Stelle der Buehne, damit der Browser den Fokus setzt wie beim Menschen
    const st = await p.evaluate(() => document.querySelector("#stage").getBoundingClientRect().toJSON());
    await p.mouse.click(st.x + st.width - 20, st.y + st.height - 20);
    assert(await p.evaluate(() => document.querySelector("#kampfwahl").hidden), "ein Klick daneben schliesst das Feld");
    assert(await p.evaluate(() => document.activeElement?.id) === "kwKnopf", "#154 nach dem Klick daneben steht der Fokus am Knopf, nicht auf der Seite");
    // ein Klick auf ein anderes Bedienelement behaelt dessen Fokus
    await p.keyboard.press("Control+K");
    // (nicht #btnWatch: der Klick startet Live und stoert die folgenden Proben; der Knopf des gerade offenen Bereichs aendert nichts)
    const bereich = await p.evaluate(() => document.querySelector('#bereiche .tab[aria-current="page"]').dataset.tab);
    await p.click(`#bereiche [data-tab="${bereich}"]`);
    assert(await p.evaluate((t) => document.activeElement?.dataset.tab === t, bereich), "#154 Klick auf einen anderen Knopf: der Fokus bleibt dort", bereich);
    assert(await p.evaluate(() => document.querySelector("#kampfwahl").hidden), "#154 der Klick auf den anderen Knopf schliesst das Feld");
    // #154: eine Zeile mit rollendem tabindex (Schadenstafel) behaelt den Fokus nach dem Klick - er geht nicht an den Knopf
    await p.keyboard.press("Control+K");
    const zeile = await p.evaluate(() => {
      const z = [...document.querySelectorAll('#bars [role="row"][tabindex="-1"]')].find((r) => r.getClientRects().length);
      if (!z) return null; z.dataset.probe = "1"; const r = z.getBoundingClientRect(); return { x: r.x + 6, y: r.y + r.height / 2 };
    });
    assert(zeile, "#154 die Schadenstafel hat eine Zeile mit tabindex -1 zum Anklicken", zeile);
    if (zeile) {
      await p.mouse.click(zeile.x, zeile.y);
      assert(await p.evaluate(() => document.activeElement?.id !== "kwKnopf" && !!document.activeElement?.closest("#bars")),
        "#154 Klick auf eine Zeile der Schadenstafel: der Fokus bleibt auf der Seite, nicht am Knopf", await p.evaluate(() => document.activeElement?.tagName + "#" + document.activeElement?.id));
    }

    // Strg+K aus einem Eingabefeld, mit preventDefault
    await p.evaluate(() => { window.__kdp = null; addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "k") window.__kdp = e.defaultPrevented; }); });
    // folgt Aufgabe 10 (Nachtrag 29.09.): Von/bis steht mit dem Zeitverlauf im Bereich Rotation; der Knopf im Kampf fuehrt hin
    await p.evaluate(() => document.querySelector("#spurenAuf").click());
    await p.waitForFunction(() => !!document.querySelector("#p-rotation .vfrom")?.getClientRects().length, null, { timeout: 4000 }).catch(() => {});
    await p.focus("#p-rotation .vfrom");
    await p.keyboard.press("Control+K");
    z = await zustand();
    assert(z.offen && z.fokus === "kwSuche" && await p.evaluate(() => window.__kdp) === true,
      "Strg+K aus einem Eingabefeld: oeffnet die Kampfwahl, das Browserkuerzel ist abgefangen", z);

    // ein neuer Kampf kommt, waehrend gesucht wird (Live)
    await p.keyboard.type("vulc");
    await p.keyboard.press("ArrowDown");
    const vorLive = await anwahl();
    await p.setInputFiles("#fileInput", LOG2);
    await p.waitForTimeout(500);
    z = await zustand();
    const nachLive = await anwahl();
    assert(vorLive && nachLive === vorLive, "neuer Kampf mit Suchtext: die Anwahl bleibt auf demselben Kampf", { vorLive, nachLive });
    assert(z.offen && z.fokus === "kwSuche" && z.wert === "vulc", "neuer Kampf bei offener Kampfwahl: Feld, Suche und Fokus bleiben", z);
    assert(z.sicht.length === 3 && z.aktivDa, "der neue Pull steht in der gefilterten Liste, die Anwahl zeigt auf einen sichtbaren Eintrag", z);
    assert(z.knopf.includes("Vulcanus") && z.label.includes("22:00:00"), "der Knopf folgt dem neuesten Kampf", z.label);
    // und ohne Suchtext: noch ein Takt mit neuem Kampf
    await p.keyboard.press("Control+A");
    await p.keyboard.press("Backspace");
    for (let n = 0; n < 3; n++) await p.keyboard.press("ArrowDown");
    const vorLive2 = await anwahl();
    await p.setInputFiles("#fileInput", LOG3);
    await p.waitForTimeout(500);
    const nachLive2 = await anwahl();
    z = await zustand();
    assert(vorLive2 && nachLive2 === vorLive2 && z.offen && z.fokus === "kwSuche" && z.label.includes("22:30:00"),
      "neuer Kampf ohne Suchtext: die Anwahl bleibt auf demselben Kampf, der Knopf folgt dem neuesten", { vorLive2, nachLive2, knopf: z.label });

    // Kompakt bei offener Kampfwahl, und zurueck
    const vorKompakt = await p.evaluate(() => document.querySelector("#hName").textContent + "|" + document.querySelector("#kwKnopf").textContent);
    await p.evaluate(() => document.querySelector("#btnCompact").onclick());
    await p.waitForTimeout(300);
    const k = await p.evaluate(() => ({ offen: !document.querySelector("#kampfwahl").hidden,
      knopf: document.querySelector("#kwKnopf").getClientRects().length, fokus: document.activeElement?.id }));
    assert(!k.offen && k.knopf === 0 && k.fokus === "btnCompact", "Kompakt bei offener Kampfwahl: das Feld geht zu, kein Knopf, der Fokus faellt nicht ins Leere", k);
    await p.evaluate(() => { window.__kdp = null; });
    await p.keyboard.press("Control+K");
    assert(await p.evaluate(() => document.querySelector("#kampfwahl").hidden), "Kompakt: Strg+K oeffnet nichts");
    assert(await p.evaluate(() => window.__kdp) === true, "Kompakt: Strg+K bleibt trotzdem beim Browser abgefangen");
    await p.evaluate(() => document.querySelector("#btnCompact").onclick());
    await p.waitForTimeout(300);
    assert(await p.evaluate(() => document.querySelector("#hName").textContent + "|" + document.querySelector("#kwKnopf").textContent) === vorKompakt,
      "zurueck in der Vollansicht: derselbe Kampf im Knopf und im Kopf");

    // Laeufe im Fuss
    await p.keyboard.press("Control+K");
    const l0 = await p.evaluate(() => ({ text: document.querySelector("#kwLaeufe").textContent, auf: document.querySelector("#kwLaeufe").getAttribute("aria-expanded"), zu: document.querySelector("#kwRuns").hidden }));
    await p.click("#kwLaeufe");
    const l1 = await p.evaluate(() => ({ auf: document.querySelector("#kwLaeufe").getAttribute("aria-expanded"), zu: document.querySelector("#kwRuns").hidden, note: document.querySelector("#runNote").innerText }));
    assert(l0.text === "Saved" && l0.auf === "false" && l0.zu, "Laeufe: ohne gespeicherte Kaempfe zu", l0);
    assert(l1.auf === "true" && !l1.zu && l1.note.length > 0, "Laeufe: aufgeklappt steht der Abschnitt mit seinem Satz da", l1);

    // Filter im Fuss: der Dialog geht auf, die Kampfwahl zu, der Fokus kommt an den Knopf zurueck
    await p.click("#filterBtn");
    await p.waitForTimeout(150);
    const f = await p.evaluate(() => ({ filter: !document.querySelector("#filterPanel").hidden, kw: !document.querySelector("#kampfwahl").hidden }));
    assert(f.filter && !f.kw, "Filter im Fuss: der Filterdialog oeffnet, die Kampfwahl geht zu", f);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(100);
    assert(await p.evaluate(() => document.activeElement?.id) === "kwKnopf", "Filter zu: der Fokus steht wieder am Knopf der Kampfwahl");

    // geleert: ein Log ist da, die Liste leer
    await p.keyboard.press("Control+K");
    await p.click("#btnClearLog");
    await p.waitForTimeout(200);
    const g = await p.evaluate(() => ({ knopf: document.querySelector("#kwKnopf").textContent, leer: !document.querySelector("#kwLeer").hidden,
      hint: !document.querySelector("#fightHint").hidden, app: !document.querySelector("#app").hidden, offen: !document.querySelector("#kampfwahl").hidden }));
    assert(g.knopf.startsWith("Choose a fight") && !g.leer && g.hint && g.app && g.offen,
      "geleert: Knopf ohne Kampf, der Satz der Liste statt Log oeffnen, der Kampfbereich bleibt", g);
    await p.click("#toast .tact");
    await p.waitForTimeout(200);
    const gz = await p.evaluate(() => ({ offen: !document.querySelector("#kampfwahl").hidden, fokus: document.activeElement?.id,
      n: document.querySelectorAll("#fightList .fight").length }));
    assert(gz.offen && gz.fokus === "kwSuche" && gz.n > 0, "Leeren rueckgaengig: die Liste ist wieder da, der Fokus steht in der Suche", gz);
    await p.keyboard.press("Escape");
    assert(await p.evaluate(() => document.querySelector("#kampfwahl").hidden), "danach schliesst Esc das Feld");

    // Deutsch
    await sprache(p, "de");
    await p.keyboard.press("Control+K");
    const de = await p.evaluate(() => ({ ph: document.querySelector("#kwSuche").placeholder, name: document.querySelector("#kampfwahl").getAttribute("aria-label"),
      knopf: document.querySelector("#kwKnopf").getAttribute("aria-label") }));
    assert(de.ph === "Boss, Ort, Uhrzeit, DPS suchen" && de.name === "Kampf w\u00e4hlen" && de.knopf.startsWith("Kampf: ") && de.knopf.endsWith("Strg+K"),
      "Deutsch: Suche, Feld und Knopf", de);
    await p.keyboard.press("Escape");
    assert(!s.fehler.length, "Kampfwahl: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  {
    /* #155 mit Log-Ordner (Entscheidung 06.10.): ohne geladenes Log gibt es in der App trotzdem etwas
       zu waehlen - fruehere Tage aus dem Ordner. Die Pille bleibt "Choose a fight" und oeffnet die
       Kampfwahl, nicht den Datei-Dialog. */
    const s = await oeffne({ helfer: { dir: "C:\\Logs", file: "", text: "" } });
    const p = s.page;
    const vor = await p.evaluate(() => ({ knopf: document.querySelector("#kwKnopf").textContent.replace(/\s+/g, " ").trim(),
      name: document.querySelector("#kwKnopf").getAttribute("aria-label") }));
    await p.evaluate(() => { window.__offen = 0; document.querySelector("#miOpenCombat").addEventListener("click", () => window.__offen++); });
    await p.click("#kwKnopf");
    const nach = await p.evaluate(() => ({ offen: !document.querySelector("#kampfwahl").hidden, dialog: window.__offen,
      expanded: document.querySelector("#kwKnopf").getAttribute("aria-expanded"), fokus: document.activeElement?.id }));
    assert(vor.knopf.startsWith("Choose a fight \u00b7 Ctrl+K") && !/No log/.test(vor.name || ""),
      "#155 ohne Log mit Log-Ordner: die Pille sagt Choose a fight \u00b7 Ctrl+K", vor);
    assert(nach.offen && nach.dialog === 0 && nach.expanded === "true" && nach.fokus === "kwSuche",
      "#155 ohne Log mit Log-Ordner: ein Klick oeffnet die Kampfwahl (fruehere Tage), nicht den Datei-Dialog", nach);
    assert(!s.fehler.length, "#155 mit Log-Ordner: keine Fehler", s.fehler);
    await p.close();
  }
  {
    // Kampfwahl bei 150 %: direkt unter der Leiste, nicht mit den Massen von 100 %
    const s = await oeffne({ config: { uiZoom: 150 } });
    await s.page.setInputFiles("#fileInput", LOG);
    await s.page.waitForFunction(() => !document.querySelector("#app").hidden);
    await s.page.keyboard.press("Control+K");
    const r = await s.page.evaluate(() => ({ top: document.querySelector(".top").getBoundingClientRect().bottom,
      feld: document.querySelector("#kampfwahl").getBoundingClientRect().toJSON(), innen: innerHeight, quer: document.documentElement.scrollWidth > innerWidth }));
    assert(Math.abs(r.feld.top - (r.top + 6)) < 2 && r.feld.width <= 840 + 1 && r.feld.height <= r.innen * 0.7 + 1 && !r.quer,
      "150 %: das Feld haengt unter der Leiste, hoechstens 560 Punkt breit und 70 % hoch", r);
    await s.page.close();
  }

  // --- 2c. #152/#155: ein Kopf je Ort, Pull-Zeilen unter einem Boss, keine Spanne bei einem Kampf
  {
    /* Wipe-Abend: drei Pulls an Vulcanus (je 60 s Ruhe dazwischen, also drei Laeufe), dann der
       Korridor der Pein mit Zairos und danach Radeth (zwei Laeufe, zwei Bosse, ein Ort), zuletzt
       ein einzelner Trash-Lauf. */
    const W = [
      { target: "Vulcanus", start: at(19, 0, 0), secs: 60, scale: 1.0 },
      { target: "Vulcanus", start: at(19, 5, 0), secs: 120, scale: 1.0 },
      { target: "Vulcanus", start: at(19, 10, 0), secs: 90, scale: 1.0 },
      { target: "Zairos", start: at(19, 30, 0), secs: 60, scale: 1.0 },
      { target: "Radeth", start: at(19, 35, 0), secs: 60, scale: 1.0 },
      { target: "Stone Beetle", start: at(20, 0, 0), secs: 20, scale: 1.0 },
    ];
    const WLOG = join(work, "TLCombatLog-wipe.txt");
    writeFileSync(WLOG, logText(W));
    const s = await oeffne();
    const p = s.page;
    await mitLog(s, WLOG);
    await p.keyboard.press("Control+K");
    const bild = await p.evaluate(() => [...document.querySelectorAll("#fightList .blockgroup")].map((g) => ({
      kopf: g.querySelector(".blockfold b")?.textContent || "",
      gz: g.querySelector(".gz")?.textContent || "",
      zeilen: [...g.querySelectorAll(".fight")].map((f) => ({ name: f.querySelector(".a b")?.textContent, b: f.querySelector(".b")?.textContent,
        label: f.getAttribute("aria-label"), balken: !!f.querySelector(".lbar"), l: f.querySelector(".lbar")?.style.getPropertyValue("--l"),
        bild: !!f.querySelector(".bic"), ohnebild: f.classList.contains("ohnebild") })) })));
    const vul = bild.find((g) => g.kopf.endsWith("Vulcanus"));
    const kor = bild.find((g) => /Corridor of Anguish/.test(g.kopf));
    const tr = bild.find((g) => g.zeilen.some((z) => z.name === "Stone Beetle"));
    assert(vul && vul.kopf === "Frostbreath Cave · Vulcanus" && vul.zeilen.map((z) => z.name).join() === "Pull 3,Pull 2,Pull 1",
      "#152 ein Boss unter dem Kopf: Ort · Boss einmal im Kopf (Vulcanus steht in der Frostatemhoehle), die Zeilen heissen Pull 3, 2, 1 (neueste oben)", vul);
    assert(vul && vul.zeilen.every((z) => z.balken && /^\d+m|^\d+\u00a0?s/.test(z.b)) && vul.zeilen.find((z) => z.name === "Pull 2").l === "1",
      "#152 die Laenge steht vorn, mit Balken; der laengste Pull fuellt ihn ganz", vul?.zeilen);
    assert(vul && vul.zeilen.every((z) => /^Vulcanus, Pull \d, /.test(z.label)), "#152 der Vorleser hoert den ganzen Namen: Vulcanus, Pull N, …", vul?.zeilen.map((z) => z.label));
    assert(kor && kor.zeilen.map((z) => z.name).join() === "Radeth,Zairos" && kor.zeilen.every((z) => !z.balken),
      "#155 ein Ort, zwei Bosse: ein Kopf, die Zeilen tragen den Boss, kein Balken", kor);
    assert(tr && !/\d\d:\d\d/.test(tr.gz) && /^1 fight$/.test(tr.gz.trim()), "#155 ein Kampf unter dem Kopf: keine Zeitspanne", tr);
    assert(bild.every((g) => g.zeilen.every((z) => z.bild !== z.ohnebild)), "#152 ohne Bild keine leere Bildspalte", bild.map((g) => g.zeilen));
    const groesse = await p.evaluate(() => {
      const k = document.querySelector("#fightList .blockfold b"), t = document.querySelector("#fightList .trashhead");
      return { kopf: parseFloat(getComputedStyle(k).fontSize), trash: t ? parseFloat(getComputedStyle(t).fontSize) : 0 };
    });
    // der Trash-Kopf steht nur, wo ein Lauf Boss und Trash hat: dafuer das erste LOG
    await mitLog(s, LOG);
    await p.keyboard.press("Control+K");
    const g2 = await p.evaluate(() => {
      const k = document.querySelector("#fightList .blockfold b"), t = document.querySelector("#fightList .trashhead");
      return { kopf: parseFloat(getComputedStyle(k).fontSize), trash: t ? parseFloat(getComputedStyle(t).fontSize) : 0 };
    });
    assert(g2.trash > 0 && g2.trash <= g2.kopf, "#155 der Trash-Kopf ist nicht groesser als der Ortskopf", { groesse, g2 });
    // #154: von Hand gerollt liegt keine Zeile halb unter dem klebenden Kopf - in einer kurzen Liste (das
    // Standard-LOG, 5 Zeilen) und einer langen (14 Pulls), an jeder Rollstelle bis ganz ans Ende.
    const LANG = join(work, "TLCombatLog-lang.txt");
    writeFileSync(LANG, logText(Array.from({ length: 14 }, (_, k) => ({ target: "Vulcanus", start: at(18, k * 5, 0), secs: 30 + 7 * k, scale: 1.0 }))));
    for (const [name, datei] of [["kurze Liste", LOG], ["lange Liste", LANG]]) {
      await mitLog(s, datei);
      await p.keyboard.press("Control+K");
      await p.setViewportSize({ width: 1280, height: 520 });
      await ruhe(p);
      // Pos1 nach Ende: der erste Kopf klebt oben, die Gruppe darunter beginnt ganz oben - auch, wenn der Kopf beim
      // Rollen nie aus dem Blick war (der klebende Kopf taeuscht "sichtbar"; die Liste blieb weit unten)
      await p.keyboard.press("End");
      await p.keyboard.press("Home");
      const p1 = await p.evaluate(() => { const l = document.querySelector("#kwListe"); return { top: l.scrollTop, kopf: document.getElementById(document.querySelector("#kwSuche").getAttribute("aria-activedescendant"))?.classList.contains("blockfold") }; });
      assert(p1.top === 0 && p1.kopf, `#154 ${name}: Pos1 nach Ende rollt die Liste ganz nach oben`, p1);
      // Rollen von Hand: an jeder Stelle (auch am Ende) liegt keine Zeile halb unter dem klebenden Kopf; ab scrollTop > 0
      // muss der Kopf oben wirklich gefunden werden, sonst verglich die Probe nur gegen den Listenrand
      const rollen = async (beschr) => {
        await p.mouse.move(640, 300);
        for (const d of [37, 61, 23, 90, 11, 41, 700, -53, 700]) {
          await p.mouse.wheel(0, d);
          await ruhe(p);
          const halb = await p.evaluate(() => {
            const l = document.querySelector("#kwListe"), lr = l.getBoundingClientRect();
            const koepfe = [...document.querySelectorAll("#fightList .blockhead")].map((h) => h.getBoundingClientRect())
              .filter((r) => r.top <= lr.top + 1 && r.bottom > lr.top).map((r) => r.bottom);
            const kopf = koepfe[0] ?? lr.top;
            return { n: [...document.querySelectorAll("#fightList .fight")].filter((f) => f.getClientRects().length).map((f) => f.getBoundingClientRect())
              .filter((r) => r.top < kopf - 0.5 && r.bottom > kopf + 0.5).length, kopfDa: koepfe.length > 0, st: l.scrollTop, max: l.scrollHeight - l.clientHeight };
          });
          assert(halb.n === 0 && (halb.st === 0 || halb.kopfDa), `#154 ${beschr}, nach ${d} Punkt Rollen von Hand: keine Zeile halb unter dem Kopf (der Kopf oben gefunden)`, halb);
        }
      };
      await rollen(name);
      if (datei === LANG) {
        // #154: der Platz unter der letzten Zeile folgt dem Inhalt: Suche auf ein, zwei Zeilen - die Liste rollt nicht mehr;
        // Suche leeren - sie rollt wieder, bis ganz ans Ende ohne halbe Zeile
        await p.keyboard.type("19:05");
        await ruhe(p);
        const eng = await p.evaluate(() => { const l = document.querySelector("#kwListe");
          return { zeilen: [...document.querySelectorAll("#fightList .fight")].filter((f) => f.getClientRects().length).length, sh: l.scrollHeight, ch: l.clientHeight }; });
        assert(eng.zeilen >= 1 && eng.zeilen <= 2 && eng.sh <= eng.ch + 1, "#154 gefiltert auf wenige Zeilen: kein leerer Rollbereich", eng);
        await p.keyboard.press("Control+A");
        await p.keyboard.press("Backspace");
        await ruhe(p);
        const weit = await p.evaluate(() => { const l = document.querySelector("#kwListe"); return { sh: l.scrollHeight, ch: l.clientHeight }; });
        assert(weit.sh > weit.ch + 100, "#154 Suche geleert: die Liste rollt wieder", weit);
        await rollen("nach geleerter Suche");
      }
      await p.setViewportSize({ width: 1280, height: 860 });
      await p.keyboard.press("Escape");
    }
    // 560 Punkt: kein Querlauf
    await p.setViewportSize({ width: 560, height: 860 });
    await p.waitForTimeout(200);
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector("#kwListe").scrollWidth <= document.querySelector("#kwListe").clientWidth),
      "#152 bei 560 Punkt kein waagerechtes Rollen in der Kampfwahl");
    assert(!s.fehler.length, "#152/#155: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 3. Bereichsleiste (3.3): Reihenfolge, Symbole, aria-current, Tastatur, Start
  {
    const s = await oeffne();
    const p = s.page;
    const leiste = () => p.evaluate(() => {
      const nav = document.querySelector("#bereiche");
      const k = [...nav.querySelectorAll(".tab")].filter((b) => !b.hidden);
      return { breit: nav.getBoundingClientRect().width, tag: nav.tagName, name: nav.getAttribute("aria-label"),
        folge: k.map((b) => b.dataset.tab), aktuell: k.filter((b) => b.getAttribute("aria-current") === "page").map((b) => b.dataset.tab),
        stopps: k.filter((b) => b.tabIndex === 0).map((b) => b.dataset.tab), aus: k.filter((b) => b.disabled).map((b) => b.dataset.tab),
        // die eigenen Symbole in 22 Punkt (Neugestaltung 28.09., 0.16; vorher 20)
        symbole: k.every((b) => { const svg = b.querySelector("svg"), r = svg && svg.getBoundingClientRect();
          return !!svg && svg.getAttribute("aria-hidden") === "true" && Math.round(r.width) === 22 && Math.round(r.height) === 22; }),
        // der Name: fuer den Vorleser im Knopf (.vh), sichtbar als Blase (.btip, 0.19) statt title
        namen: k.map((b) => [b.querySelector(".btip")?.textContent || "", b.querySelector(".vh")?.textContent || "",
          b.querySelector(".btip")?.getAttribute("aria-hidden") === "true"]),
        reiterRollen: document.querySelectorAll('[role="tab"], [role="tablist"], [role="tabpanel"], .tab[aria-selected], #tabs').length,
        land: !document.querySelector("#land").hidden, app: !document.querySelector("#app").hidden,
        panel: document.querySelector(".panel.on")?.id || "" };
    });
    const eins = (x) => JSON.stringify(x);
    let l = await leiste();
    assert(l.tag === "NAV" && l.name === "Areas" && Math.round(l.breit) === 64, "eine nav mit Namen, 64 Punkt breit (Neugestaltung 28.09.)", l);
    // Stufe 3: unter Start das Zahnrad der Einstellungen (57-einstellungen.ts); seit der
    // Neugestaltung 28.09. (0.17) Weeklies ueber Start; der Builds-Reiter ist entfallen (#207)
    // folgt Spezifikation Rekorde 2a (02.10.2026): der Pokal steht unten nach den Weeklies, gleich streng
    // folgt Spezifikation Gilde 5 (06.10.2026): die Gilde zwischen Weeklies und Rekorden, gleich streng
    assert(eins(l.folge) === eins(["timeline", "rotation", "analysis", "compare", "history", "party", "weeklies", "gilde", "rekorde", "start", "settings"]),
      "Reihenfolge: Kampf, Rotation, Analyse, Vergleich, Verlauf, Gruppe, unten Weeklies, Gilde, Rekorde, Start und Einstellungen", l.folge);
    assert(l.symbole && l.namen.every(([tip, vh, versteckt]) => tip && tip === vh && versteckt), "gezeichnete Symbole (22 Punkt, aria-hidden), der Name als Blase und fuer den Vorleser", l.namen);
    assert(l.reiterRollen === 0, "keine Reiterrollen und keine Reiterleiste mehr", l.reiterRollen);
    assert(l.land && eins(l.aktuell) === '["start"]' && eins(l.stopps) === '["start"]', "ohne Log: Start ist gewaehlt und der eine Tabstopp", l);
    assert(eins(l.aus) === eins(["timeline", "rotation", "analysis", "compare", "history"]), "ohne Log: Bereiche ohne Kampf gesperrt, Gruppe, Weeklies und Start nicht", l.aus);

    await beispielLaden(p);
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    l = await leiste();
    assert(!l.land && l.app && eins(l.aktuell) === '["timeline"]' && eins(l.stopps) === '["timeline"]' && l.aus.length === 0,
      "mit Kampf: Kampf ist gewaehlt, alles offen", l);
    await p.focus('#bereiche [data-tab="timeline"]');
    await p.keyboard.press("ArrowDown");
    l = await leiste();
    assert(eins(l.aktuell) === '["rotation"]' && l.panel === "p-rotation" && eins(l.stopps) === '["rotation"]'
      && await p.evaluate(() => document.activeElement?.dataset.tab) === "rotation", "Pfeil ab: Rotation, Fokus und Tabstopp wandern mit", l);
    await p.keyboard.press("End");
    l = await leiste();
    assert(eins(l.aktuell) === '["settings"]' && !l.land && !l.app, "Ende: Einstellungen - der letzte Knopf der Leiste", l);
    await p.keyboard.press("ArrowUp");
    l = await leiste();
    assert(eins(l.aktuell) === '["start"]' && l.land && !l.app, "Pfeil auf vom Ende: Start - die Startseite, auch mit geladenem Log", l);
    await p.keyboard.press("Home");
    l = await leiste();
    assert(eins(l.aktuell) === '["timeline"]' && !l.land && l.app, "Pos1: zurueck zum Kampf", l);
    await p.keyboard.press("ArrowUp");
    assert(eins((await leiste()).aktuell) === '["settings"]', "Pfeil auf am Anfang: im Kreis zum letzten Knopf (Einstellungen)");
    await p.click('#bereiche [data-tab="history"]');
    l = await leiste();
    assert(eins(l.aktuell) === '["history"]' && l.app && l.panel === "p-history", "Klick auf Verlauf: der Bereich Verlauf", l);
    await p.click('#bereiche [data-tab="start"]');
    await p.keyboard.press("Control+K");
    await p.keyboard.press("Enter");
    await p.waitForTimeout(150);
    l = await leiste();
    assert(!l.land && eins(l.aktuell) === '["history"]', "auf Start einen Kampf waehlen: zurueck in den Bereich von vorher", l);

    // Kompakt: keine Leiste; zurueck derselbe Bereich - auch Start
    await p.evaluate(() => document.querySelector("#btnCompact").onclick());
    await p.waitForTimeout(200);
    const weg = await p.evaluate(() => document.querySelector("#bereiche").getClientRects().length);
    await p.evaluate(() => document.querySelector("#btnCompact").onclick());
    await p.waitForTimeout(200);
    assert(weg === 0 && eins((await leiste()).aktuell) === '["history"]', "Kompakt: keine Leiste; zurueck: derselbe Bereich", weg);
    await p.click('#bereiche [data-tab="start"]');
    await p.evaluate(() => document.querySelector("#btnCompact").onclick());
    await p.waitForTimeout(200);
    const ks = await p.evaluate(() => ({ land: !document.querySelector("#land").hidden, app: !document.querySelector("#app").hidden }));
    await p.evaluate(() => document.querySelector("#btnCompact").onclick());
    await p.waitForTimeout(200);
    l = await leiste();
    assert(!ks.land && ks.app && eins(l.aktuell) === '["start"]' && l.land, "Start und Kompakt: kompakt zeigt den Kampf, zurueck steht wieder Start", { ks, l });

    // Start und eine Datei: wer auf Start eine Datei oeffnet, will sie sehen (Bereich von vorher)
    await mitLog(s);
    l = await leiste();
    assert(!l.land && l.app && eins(l.aktuell) === '["history"]', "auf Start eine Datei laden: zurueck in den Bereich von vorher", l);

    // Waffen und Log-Einrichtung (Entwicklermodus): unter den anderen, ueber Start, mit Pfeilen erreichbar
    await entwickler(p);
    await p.waitForTimeout(150);
    l = await leiste();
    // DECISION 0.18: Waffen und Log-Einrichtung nach der Gruppe (vorher nach Builds)
    // folgt Spezifikation Rekorde 2a: Rekorde unten nach den Weeklies; Spezifikation Gilde 5: die Gilde dazwischen
    assert(eins(l.folge) === eins(["timeline", "rotation", "analysis", "compare", "history", "party", "weapons", "setup", "weeklies", "gilde", "rekorde", "start", "settings"]) && l.symbole,
      "Entwicklermodus: Waffen und Log-Einrichtung nach der Gruppe, Weeklies, Gilde, Rekorde, Start und Einstellungen bleiben unten", l.folge);
    await p.focus('#bereiche [data-tab="party"]');
    await p.keyboard.press("ArrowDown");
    assert(eins((await leiste()).aktuell) === '["weapons"]', "Pfeil ab von der Gruppe: Waffen");
    await p.keyboard.press("ArrowDown");
    l = await leiste();
    assert(eins(l.aktuell) === '["setup"]' && l.panel === "p-setup", "Pfeil ab: Log-Einrichtung", l);
    await entwickler(p);
    await p.waitForTimeout(150);
    l = await leiste();
    assert(l.folge.includes("setup") && !l.folge.includes("weapons") && eins(l.aktuell) === '["setup"]',
      "Entwicklermodus aus: die Einrichtung bleibt, solange man darauf steht (wie syncTabs), Waffen geht", l.folge);
    await p.click('#bereiche [data-tab="timeline"]');
    l = await leiste();
    assert(!l.folge.includes("setup") && eins(l.stopps) === '["timeline"]', "danach verschwindet die Einrichtung", l.folge);

    // Deutsch, und schmal
    await sprache(p, "de");
    const de = await p.evaluate(() => ({ titel: [...document.querySelectorAll("#bereiche .tab .btip")].map((b) => b.textContent),
      name: document.querySelector("#bereiche").getAttribute("aria-label") }));
    assert(["Kampf", "Rotation", "Analyse", "Vergleich", "Verlauf", "Gruppe", "Start"].every((n) => de.titel.includes(n)) && de.name === "Bereiche",
      "Deutsch: Kampf, Vergleich, Verlauf, Start; die Leiste heisst Bereiche", de);
    await p.setViewportSize({ width: 600, height: 860 });
    await p.waitForTimeout(300);
    l = await leiste();
    // wie im Entwurf bei jeder Breite 64 Punkt (Neugestaltung 28.09.; vorher 44 unter 640)
    assert(Math.round(l.breit) === 64 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "unter 640 Punkt: 64 Punkt breit, kein Querlauf", l.breit);
    assert(!s.fehler.length, "Bereichsleiste: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 3b. Bereichsleiste: gesperrt und gewaehlt (Nacharbeit)
  {
    const zustand = (p) => p.evaluate(() => {
      const k = [...document.querySelectorAll("#bereiche .tab")];
      const an = k.find((b) => b.getAttribute("aria-current") === "page");
      const a = document.activeElement;
      return { aktuell: an?.dataset.tab, anGesperrt: !!an?.disabled, anDeckung: an ? getComputedStyle(an).opacity : "",
        gedimmt: k.filter((b) => b.disabled).map((b) => getComputedStyle(b).opacity),
        fokus: a && a.closest && a.closest("#bereiche") ? a.dataset.tab : a?.tagName };
    });
    const nav = html.slice(html.indexOf('<nav class="bereiche"'), html.indexOf("</nav>", html.indexOf('<nav class="bereiche"')));
    assert(nav.length > 0 && !nav.includes("aria-disabled"), "Markup: disabled allein, kein aria-disabled daneben");

    const s = await oeffne();
    let z = await zustand(s.page);
    assert(z.gedimmt.length === 5 && z.gedimmt.every((o) => o === "0.35"), "ohne Log: gesperrte Knoepfe schon im ersten Bild gedimmt", z);

    // Leeren auf Verlauf: der Bereich bleibt nutzbar, der Fokus in der Leiste
    await mitLog(s);
    await s.page.click('#bereiche [data-tab="history"]');
    // der Fokus steht auf Rotation, das gleich gesperrt wird: er geht an den Tabstopp (Verlauf)
    await s.page.focus('#bereiche [data-tab="rotation"]');
    await s.page.evaluate(() => document.querySelector("#btnClearLog").click());
    await s.page.waitForTimeout(200);
    z = await zustand(s.page);
    assert(z.aktuell === "history" && !z.anGesperrt && z.anDeckung === "1" && z.fokus === "history",
      "Leeren auf Verlauf: gewaehlt, nutzbar, volle Deckung, Fokus bleibt in der Leiste", z);
    assert(!s.fehler.length, "Leeren: keine Fehler auf der Seite", s.fehler);
    await s.page.close();

    // Gruppe ohne Kampf: Beispielgruppe auf dem Bereich Kampf, dann die Liste leeren
    const g = await oeffne();
    await mitLog(g);
    await einstellung(g.page, "dev", async () => { await g.page.click("#eDev"); await g.page.click("#eBeispiel"); await g.page.click("#eDev"); });
    await g.page.waitForTimeout(300);
    await g.page.evaluate(() => document.querySelector("#btnClearLog").click());
    await g.page.waitForTimeout(300);
    z = await zustand(g.page);
    assert(await g.page.evaluate(() => !document.querySelector("#app").hidden) && z.aktuell && !z.anGesperrt && z.anDeckung === "1",
      "Gruppe ohne Kampf: der gewaehlte Bereich ist nutzbar und nicht gedimmt", z);
    assert(!g.fehler.length, "Gruppe ohne Kampf: keine Fehler auf der Seite", g.fehler);
    await g.page.close();
  }

  // --- 4. Statusleiste (3.4): Live, Datei, Anzahl, nur gelesen, Fehler melden, Zoom, Version
  {
    const s = await oeffne({ uhr: new Date(2026, 8, 9, 23, 0, 0).getTime() });
    const p = s.page;
    const sb = () => p.evaluate(() => {
      const f = document.querySelector("#statusleiste"), r = f.getBoundingClientRect();
      const sicht = (q) => { const e = f.querySelector(q); return !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().width > 0; };
      return { tag: f.tagName, h: r.height, unten: Math.abs(r.bottom - innerHeight) < 1,
        live: document.querySelector("#sbLiveText").textContent, datei: document.querySelector("#sbDatei").textContent,
        dateiTitel: document.querySelector("#sbDatei").title,
        mono: /Mono|Consolas|monospace/.test(getComputedStyle(document.querySelector("#sbDatei")).fontFamily),
        // die Zahl steht seit der Neugestaltung 28.09. (DECISION 0.24) nur noch im Kopf der Kampfwahl
        anzahl: document.querySelector("#fightCount").textContent, liste: document.querySelector("#fightCount").textContent,
        anzahlUnten: !!f.querySelector("#sbAnzahl, .sbanzahl"),
        nur: f.querySelector(".sbnur").textContent, zoom: document.querySelector("#sbZoom").textContent,
        zoomWert: document.querySelector("#zoomVal").textContent, zoomName: document.querySelector("#sbZoom").getAttribute("aria-label"),
        ver: document.querySelector("#sbVer").textContent, appVer: document.querySelector("#appVer").textContent,
        /* "Fehler melden" (Entscheidung 01.10.): aus den Einstellungen hierher, neben Groesse und Version.
           Unter 640 Punkt nur das Zeichen; der Name bleibt im aria-label. */
        fehler: (() => { const b = document.querySelector("#sbFehler"); if (!b) return null;
          const w = b.querySelector(".sbfw"), z = getComputedStyle(b, "::before"), r = b.getBoundingClientRect();
          return { tag: b.tagName, typ: b.type, text: w ? w.textContent : "", wortB: w ? w.getBoundingClientRect().width : 0, name: b.getAttribute("aria-label"),
            title: b.title, fs: parseFloat(getComputedStyle(b).fontSize), zeichen: z.content !== "none" && parseFloat(z.width) >= 10, b: r.width, h: r.height,
            farbe: getComputedStyle(b).color, leiste: getComputedStyle(f).color, rechtsVonDatei: r.left >= document.querySelector("#sbDatei").getBoundingClientRect().right }; })(),
        regionen: f.querySelectorAll('[role="status"], [aria-live]').length, liveRegion: document.querySelector("#live").getAttribute("role"),
        sicht: ["#sbRolle", "#sbLive", "#sbDatei", ".sbnur", "#sbFehler", "#sbZoom", "#sbVer"].filter(sicht),
        breit: document.documentElement.scrollWidth > innerWidth,
        farbe: getComputedStyle(f).color, grund: getComputedStyle(f).backgroundColor };
    });
    let z = await sb();
    assert(z.tag === "FOOTER" && Math.abs(z.h - 26) < 0.5 && z.unten, "eine Fusszeile, 26 Punkt (Neugestaltung 28.09.), am unteren Rand", z);
    assert(z.live === "Live off" && z.datei === "No log" && z.anzahl === "No fights yet" && !z.anzahlUnten, "ohne Log: Live aus, kein Log, keine Zahl", z);
    assert(z.nur === "Read only \u2013 nothing in the game" && z.zoom === "100\u00a0%" && z.ver === z.appVer && /^v\d/.test(z.ver),
      "nur gelesen, Zoom 100 % mit geschuetztem Leerzeichen, dieselbe Version wie die Marke", z);
    assert(z.regionen === 0 && z.liveRegion === "status", "kein Live-Bereich in der Leiste; den Zustand sagt weiter #live an", z);
    assert(z.fehler && z.fehler.tag === "BUTTON" && z.fehler.typ === "button" && z.fehler.text === "Report a bug" && z.fehler.name === "Report a bug"
      && /bug report/i.test(z.fehler.title) && z.fehler.fs >= 11 && z.fehler.zeichen && z.fehler.wortB > 20 && z.fehler.h <= 26 && z.fehler.rechtsVonDatei
      && z.fehler.farbe === z.fehler.leiste,
      "Fehler melden: ein Knopf in der Leiste rechts der Datei, Wort und Zeichen, mindestens 11 Punkt, in der Farbe der Leiste, der title sagt, was er tut", z.fehler);
    await beispielLaden(p);
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    z = await sb();
    assert(z.datei === "Sample fight" && z.anzahl === "2 fights today" && z.mono, "Beispiel (heute): Datei in Mono, 2 Kaempfe heute", z);
    await p.setInputFiles("#fileInput", LOG);
    await p.waitForFunction(() => document.querySelector("#sbDatei").textContent.startsWith("TLCombat"));
    z = await sb();
    assert(z.datei === "TLCombatLog-20260920.txt" && z.dateiTitel === "TLCombatLog-20260920.txt" && z.anzahl === z.liste && /loaded$/.test(z.anzahl),
      "eigene Datei von einem anderen Tag: der Name, die Zahl wie in der Liste", z);
    // Zoom: die Leiste zeigt die Groesse, ein Klick setzt 100 %
    await einstellung(p, "groesse", () => regler(p, "#eZoom", 150));
    await p.waitForTimeout(200);
    z = await sb();
    assert(z.zoom === z.zoomWert.replace("%", "\u00a0%") && z.zoom !== "100\u00a0%", "groesser gestellt: die Leiste zeigt dieselbe Zahl", z);
    assert(z.zoomName === "Size " + z.zoom + ", back to 100\u00a0%", "der Knopf sagt Groesse und Handlung", z.zoomName);
    await p.click("#sbZoom");
    await p.waitForTimeout(200);
    z = await sb();
    assert(z.zoom === "100\u00a0%" && s.posts.some((b) => b.uiZoom === 100), "Klick auf die Zahl: zurueck auf 100 %, gemerkt", { zoom: z.zoom, posts: s.posts });
    // Deutsch
    await sprache(p, "de");
    z = await sb();
    assert(z.live === "Live aus" && z.nur === "Nur gelesen \u2013 nichts im Spiel" && /geladen$/.test(z.anzahl) && z.anzahl === z.liste,
      "Deutsch: Live aus, Nur gelesen - nichts im Spiel, die Zahl", z);
    assert(z.zoomName === "Gr\u00f6\u00dfe 100\u00a0%, zur\u00fcck auf 100\u00a0%", "Deutsch: der Knopf sagt Groesse und Handlung", z.zoomName);
    assert(z.fehler.text === "Fehler melden" && z.fehler.name === "Fehler melden" && /Fehlerbericht/.test(z.fehler.title),
      "Deutsch: Fehler melden, der title nennt den Fehlerbericht", z.fehler);
    // schmal: nur Live, Datei, Fehler melden (als Zeichen), Version
    /* folgt der Wahl vom 01.10. ("Fehler melden" in der Statusleiste): die
       Liste der sichtbaren Teile nennt den Knopf dazu, sonst gleich streng. */
    await p.setViewportSize({ width: 600, height: 860 });
    await p.waitForTimeout(300);
    z = await sb();
    assert(JSON.stringify(z.sicht) === JSON.stringify(["#sbLive", "#sbDatei", "#sbFehler", "#sbVer"]), "unter 640 Punkt: Live, Datei, Fehler melden, Version", z.sicht);
    assert(z.fehler.wortB === 0 && z.fehler.zeichen && z.fehler.b >= 20 && z.fehler.name === "Fehler melden",
      "unter 640 Punkt: Fehler melden nur als Zeichen, mindestens 20 Punkt breit, der Name bleibt", z.fehler);
    await p.setViewportSize({ width: 560, height: 860 });
    await p.waitForTimeout(300);
    z = await sb();
    assert(!z.breit && Math.abs(z.h - 26) < 0.5, "560 Punkt: die Leiste bleibt 26 Punkt, kein waagerechtes Rollen", z);
    const rand = await p.evaluate(() => { const f = document.querySelector("#statusleiste").getBoundingClientRect();
      return ["#sbLive", "#sbDatei", "#sbFehler", "#sbVer"].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return r.left >= f.left && r.right <= f.right + 0.5; }); });
    assert(rand.every(Boolean), "560 Punkt: Live, Datei, Fehler melden und Version stehen ganz in der Leiste", rand);
    // Tastatur: Fehler melden bekommt den Fokus mit sichtbarem Ring
    await p.focus("#sbFehler");
    await p.keyboard.press("Shift+Tab");
    await p.keyboard.press("Tab");
    const fokus = await p.evaluate(() => { const b = document.activeElement; return { id: b.id, ring: getComputedStyle(b).outlineStyle !== "none" }; });
    assert(fokus.id === "sbFehler" && fokus.ring, "Fehler melden: mit Tab erreichbar, Fokus mit sichtbarem Ring", fokus);
    // Kompakt: keine Statusleiste
    await p.evaluate(() => document.querySelector("#btnCompact").onclick());
    await p.waitForTimeout(200);
    assert(await p.evaluate(() => document.querySelector("#statusleiste").getClientRects().length) === 0, "Kompakt: keine Statusleiste");
    assert(!s.fehler.length, "Statusleiste: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  // --- 4b. "heute" ist der Kalendertag der Ortszeit, wie die Uhrzeiten im Log
  // (Wanduhr, als UTC-Felder abgelegt). Das Beispiel ist vom 09.09. um 22:07.
  // Los Angeles 09.09. 23:00 ist in UTC schon der 10.; Auckland 10.09. 11:00
  // ist in UTC noch der 9. - ein Vergleich mit dem UTC-Datum faellt in beiden.
  for (const [zone, uhr, soll] of [
    ["America/Los_Angeles", Date.UTC(2026, 8, 10, 6, 0, 0), "2 fights today"],
    ["Pacific/Auckland", Date.UTC(2026, 8, 9, 23, 0, 0), "2 fights loaded"],
  ]) {
    const s = await oeffne({ uhr, zone });
    await beispielLaden(s.page);
    await s.page.waitForFunction(() => !document.querySelector("#app").hidden);
    const a = await s.page.evaluate(() => document.querySelector("#fightCount").textContent);   // DECISION 0.24
    assert(a === soll, "Ortszeit " + zone + ": " + soll, a);
    assert(!s.fehler.length, "Ortszeit " + zone + ": keine Fehler auf der Seite", s.fehler);
    await s.page.close();
  }

  // --- 4c. In der App beobachtet der Helfer einen Ordner: die Leiste zeigt
  // nur den Namen der Datei, der title den ganzen Pfad. Live laeuft: Punkt an.
  {
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-20260920.txt", text: readFileSync(LOG, "utf8") } });
    const p = s.page;
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await p.waitForFunction(() => document.querySelector("#sbDatei").textContent.startsWith("TLCombat"), null, { timeout: 8000 });
    const z = await p.evaluate(() => ({ datei: document.querySelector("#sbDatei").textContent, titel: document.querySelector("#sbDatei").title,
      live: document.querySelector("#sbLiveText").textContent, an: document.querySelector("#sbLive").classList.contains("on") }));
    assert(z.datei === "TLCombatLog-20260920.txt" && z.titel === "C:\\Logs\\TLCombatLog-20260920.txt",
      "App, beobachteter Ordner: der Name in der Leiste, der Pfad im title", z);
    assert(z.live === "Live" && z.an, "App, Live laeuft: das Wort und der Punkt", z);
    // der Punkt in derselben Farbe wie der des Live-Knopfs, in jedem Thema
    for (const thema of ["dark", "light", "tnl"]) {
      await themaWaehlen(p, thema);
      const f = await p.evaluate(() => ({ sb: getComputedStyle(document.querySelector("#sbLive .sbdot")).backgroundColor,
        knopf: getComputedStyle(document.querySelector("#btnWatch .ldot")).backgroundColor }));
      assert(f.sb === f.knopf && f.sb !== "rgba(0, 0, 0, 0)", "Live-Punkt " + thema + ": dieselbe Farbe wie am Live-Knopf", f);
    }
    assert(!s.fehler.length, "App-Zweig: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 5. Querschnitt (Spezifikation 2 und 7): Kompakt, 560 Punkt, drei Themen, beide Sprachen
  {
    // Kompakt blendet den ganzen neuen Rahmen aus; der Streifen misst wie vorher
    const s = await oeffne({ app: true });
    const p = s.page;
    await beispielLaden(p);
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    await p.keyboard.press("Control+K");
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await p.waitForTimeout(500);
    const k = await p.evaluate(() => ({ weg: ["#kwKnopf", "#kampfwahl", "#bereiche", "#statusleiste"].map((q) => document.querySelector(q).getClientRects().length),
      top: document.querySelector(".top").getBoundingClientRect().height,
      kinder: [...document.querySelector(".top").children].filter((e) => e.getClientRects().length).map((e) => e.id || e.className) }));
    assert(k.weg.every((n) => n === 0) && Math.abs(k.top - 26) < 0.5 && !k.kinder.includes("kwKnopf"),
      "Kompakt: Knopf, Kampfwahl, Bereichs- und Statusleiste sind nicht da, der Streifen ist 26 Punkt", k);
    assert(!s.fehler.length, "Kompakt: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  {
    // 560 Punkt: nirgends waagerechtes Rollen
    const s = await oeffne({ breite: 560 });
    const p = s.page;
    const quer = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert(!(await quer()), "560: Startseite ohne Querlauf");
    await beispielLaden(p);
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    for (const b of ["timeline", "rotation", "analysis", "compare", "history", "party", "start"]) {
      await p.evaluate((n) => document.querySelector(`[data-tab="${n}"]`).click(), b);
      await p.waitForTimeout(200);
      assert(!(await quer()), `560: Bereich ${b} ohne Querlauf`);
    }
    await p.evaluate((n) => document.querySelector(`[data-tab="${n}"]`).click(), "timeline");
    await p.keyboard.press("Control+K");
    const feld = await p.evaluate(() => { const r = document.querySelector("#kampfwahl").getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
    assert(!(await quer()) && feld.l >= 0 && feld.r <= feld.w, "560: die offene Kampfwahl passt ins Fenster", feld);
    await p.close();
  }
  {
    // drei Themen: Auswahlkante in --pick, Statusleiste lesbar, kein Rot/Gruen am gewaehlten Bereich
    const s = await oeffne();
    const p = s.page;
    await beispielLaden(p);
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    for (const thema of ["dark", "light", "tnl"]) {
      await themaWaehlen(p, thema);
      /* Die Kante hat einen Uebergang (.14s); eine feste Wartezeit von 150 ms
         las ihn manchmal mitten drin (2,996 statt 3 Punkt). Gewartet wird, bis
         die Kante in --pick fertig steht - hoechstens 3 s; die Pruefung
         danach ist dieselbe. */
      await p.waitForFunction(() => {
        const probe = document.createElement("i"); probe.style.color = "var(--pick)"; document.body.append(probe);
        const pick = getComputedStyle(probe).color; probe.remove();
        const an = document.querySelector("#bereiche .tab.on");
        const k = an ? getComputedStyle(an, "::before") : null;
        return !!k && k.backgroundColor === pick && k.width === "3px" && k.height === "16px";
      }, null, { timeout: 3000 }).catch(() => {});
      const f = await p.evaluate(() => {
        const probe = document.createElement("i"); probe.style.color = "var(--pick)"; document.body.append(probe);
        const pick = getComputedStyle(probe).color; probe.remove();
        const an = document.querySelector("#bereiche .tab.on"), sb = document.querySelector("#statusleiste");
        // seit der Neugestaltung 28.09. (0.20) eine Kante von 3 x 16 Punkt statt ueber die ganze Hoehe
        const k = getComputedStyle(an, "::before");
        return { pick, kante: k.backgroundColor, kw: k.width, kh: k.height, sbText: getComputedStyle(sb).color, sbGrund: getComputedStyle(sb).backgroundColor,
          fehlerText: getComputedStyle(document.querySelector("#sbFehler")).color };
      });
      assert(f.kante === f.pick && f.kw === "3px" && f.kh === "16px", `${thema}: der gewaehlte Bereich traegt die Auswahlkante in --pick`, f);
      assert(kontrast(f.sbText, f.sbGrund) >= 4.5, `${thema}: Statusleiste lesbar (4,5:1)`, { f, k: kontrast(f.sbText, f.sbGrund) });
      assert(kontrast(f.fehlerText, f.sbGrund) >= 4.5, `${thema}: Fehler melden lesbar (4,5:1)`, { f, k: kontrast(f.fehlerText, f.sbGrund) });
    }
    await p.close();
  }
  {
    // beide Sprachen: jeder neue Schluessel steht in en und de
    const built = await esbuild.build({ stdin: { contents: 'export { I18N } from "./src/renderer/app/07-dictionary";', resolveDir: root, loader: "ts" },
      bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
    const { I18N } = await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64"));
    const neu = (lang) => Object.keys(I18N[lang]).filter((key) => /^(kw|sb)\./.test(key) || key === "tabs.start" || key === "tabs.navLabel").sort();
    assert(neu("en").length >= 20 && JSON.stringify(neu("en")) === JSON.stringify(neu("de")), "jeder neue Text steht in beiden Sprachen mit demselben Schluessel", { en: neu("en"), de: neu("de") });
    const de = Object.entries(I18N.de).filter(([key]) => /^(kw|sb|tabs)\./.test(key)).map(([, v]) => typeof v === "function" ? v({ n: 2, q: "x", was: "x" }) : v).join(" ");
    assert(!/\bBau(e|s|en)?\b/.test(de), "Deutsch: Build, nie Bau", de.slice(0, 200));
    // die Knoepfe der Schiene ("Liste zeigen"/"Liste zu") gibt es nicht mehr
    const alt = ["rail.listOpen", "rail.listClose"].filter((key) => key in I18N.en || key in I18N.de);
    assert(!alt.length, "keine Texte der alten Schiene im Woerterbuch", alt);
  }
  {
    /* Aufgeraeumt: keine Regel zeigt mehr auf Schiene oder Reiterleiste
       (Kompakt-Regeln eingeschlossen); .tab gibt es nur in der Bereichsleiste. */
    const s = await oeffne();
    const tot = await s.page.evaluate(() => {
      const sel = [];
      const lauf = (regeln) => { for (const r of regeln) { if (r.selectorText) sel.push(r.selectorText); if (r.cssRules) lauf(r.cssRules); } };
      for (const b of document.styleSheets) { try { lauf(b.cssRules); } catch { /* fremd */ } }
      return sel.flatMap((x) => x.split(",")).map((x) => x.trim()).filter((x) =>
        /\.(atrail|attop|filterbtn|railfoot|fightsec|fbtns|rail|tabs)\b|\.scroll\.runs/.test(x) || (/\.tab\b/.test(x) && !/\.bereiche\b/.test(x)));
    });
    assert(!tot.length, "keine toten Regeln der Schiene und der Reiter", tot);
    await s.page.close();
  }
  {
    // renderAll setzt die Bereichsleiste einmal, nicht zweimal (syncTabs ruft syncBereiche)
    const s = await oeffne();
    const p = s.page;
    await beispielLaden(p);
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    await p.waitForTimeout(300);
    const n = await p.evaluate(async () => {
      let zahl = 0;
      const mo = new MutationObserver((m) => { zahl += m.length; });
      mo.observe(document.querySelector("#bereiche"), { subtree: true, attributes: true, attributeFilter: ["tabindex"] });
      document.querySelectorAll("#fightList .fight")[1].click();
      await new Promise((r) => setTimeout(r, 200));
      mo.disconnect();
      return { zahl, knoepfe: document.querySelectorAll("#bereiche .tab").length };
    });
    assert(n.zahl === n.knoepfe, "ein Kampf gewaehlt: die Bereichsleiste wird einmal gesetzt", n);
    assert(!s.fehler.length, "einmal gesetzt: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  {
    /* Live gestoert: die Statusleiste spricht dieselbe Farbe wie der
       Live-Knopf der Titelleiste (Ring in --neg, Wort in --neg-ink) - ein
       Fehlerzustand, kein Urteil. In jedem Thema. */
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-20260920.txt", text: readFileSync(LOG, "utf8") } });
    const p = s.page;
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await p.waitForFunction(() => document.querySelector("#sbLive").classList.contains("on"), null, { timeout: 8000 });
    await p.route("http://boro.test/api/**", (r) => r.abort());
    await p.waitForFunction(() => document.querySelector("#btnWatch").classList.contains("err"), null, { timeout: 15000 });
    for (const thema of ["dark", "light", "tnl"]) {
      await themaWaehlen(p, thema);
      const f = await p.evaluate(() => {
        const cs = (q) => getComputedStyle(document.querySelector(q));
        return { err: document.querySelector("#sbLive").classList.contains("err"),
          sbRing: cs("#sbLive .sbdot").boxShadow, sbGrund: cs("#sbLive .sbdot").backgroundColor, knopfRing: cs("#btnWatch .ldot").boxShadow,
          knopfGrund: cs("#btnWatch .ldot").backgroundColor, sbWort: cs("#sbLiveText").color, knopfWort: cs("#btnWatch .lstate").color };
      });
      assert(f.err && f.sbRing === f.knopfRing && f.sbGrund === f.knopfGrund && f.sbWort === f.knopfWort,
        "Live gestoert " + thema + ": Punkt und Wort wie am Live-Knopf", f);
    }
    await p.close();
  }

  // --- 6. Gesamtpruefung Stufe 1 (Nacharbeit)
  for (const app of [true, false]) {
    // 6.1 560 Punkt: die Titelleiste hoechstens zwei Zeilen, kein Querlauf;
    // Oeffnen und Gruppe nur als Symbol, der Name bleibt fuer Vorleser und im title
    const wo = app ? "App" : "Browser";
    for (const zoom of [100, 150]) {
      const s = await oeffne({ app, breite: zoom === 100 ? 560 : 840, config: { uiZoom: zoom } });
      const p = s.page;
      await beispielLaden(p);
      await p.waitForFunction(() => !document.querySelector("#app").hidden);
      await p.waitForTimeout(300);
      const z = await p.evaluate(() => {
        const knopf = (q) => { const b = document.querySelector(q), r = b.getBoundingClientRect();
          const txt = [...b.querySelectorAll(".blabel, #partyPillText")].map((e) => e.getBoundingClientRect().width);
          return { w: r.width, text: txt, name: b.getAttribute("aria-label") || b.textContent.trim(), title: b.title }; };
        return { h: document.querySelector(".top").getBoundingClientRect().height, quer: document.documentElement.scrollWidth > innerWidth,
          open: knopf("#btnOpen"), party: knopf("#partyPill") };
      });
      assert(z.h <= 80 * zoom / 100 + 0.5 && !z.quer, `${wo} 560 Punkt (${zoom} %): Titelleiste hoechstens zwei Zeilen, kein Querlauf`, z);
      // die Gruppen-Pille nur bei laufender Gruppe (Neugestaltung 28.09., DECISION 0.14)
      assert(z.open.text.every((w) => w <= zoom / 100 + 0.1) && z.open.name === "Open logs" && z.open.title === "Open logs"
        && z.party.w === 0 && z.party.name === "Party",
      `${wo} 560 Punkt (${zoom} %): Oeffnen als Symbol, Name und title bleiben; ohne Gruppe keine Gruppen-Pille`, z);
      assert(!s.fehler.length, `${wo} 560 Punkt: keine Fehler auf der Seite`, s.fehler);
      await p.close();
    }
  }
  {
    // breit: ruhige Symbolknoepfe wie im Entwurf (Entscheidung 27.09.) - Oeffnen,
    // Gruppe und Kompakt zeigen nur ihr Symbol, Name und title bleiben (am
    // Kompaktknopf nennt der title das Kuerzel fuers Durchklicken); Live
    // behaelt sein Wort. Im Kompaktstreifen steht "Vollansicht" weiter als Wort.
    const s = await oeffne({ app: true });
    await beispielLaden(s.page);
    await s.page.waitForFunction(() => !document.querySelector("#app").hidden);
    const z = await s.page.evaluate(() => {
      const knopf = (q, wort) => { const b = document.querySelector(q), w = wort ? document.querySelector(wort) : b;
        return { wort: w.getBoundingClientRect().width, fs: getComputedStyle(b).fontSize,
          name: b.getAttribute("aria-label") || b.textContent.trim(), title: b.title }; };
      return { open: knopf("#btnOpen", "#btnOpen .blabel"), party: knopf("#partyPill", "#partyPillText"),
        kompakt: knopf("#btnCompact"), live: document.querySelector("#btnWatch .lword").getBoundingClientRect().width };
    });
    // die Gruppen-Pille nur bei laufender Gruppe (Neugestaltung 28.09., DECISION 0.14)
    assert(z.open.wort <= 1.1 && z.open.name === "Open logs" && z.open.title === "Open logs"
      && z.party.wort === 0 && z.party.name === "Party"
      && z.kompakt.fs === "0px" && z.kompakt.name === "Compact" && z.kompakt.title.includes("Ctrl+Shift+D") && z.live > 10,
    "1280: Oeffnen und Kompakt als Symbol, Name und title bleiben (Kompakt: das Kuerzel), Live mit Wort; ohne Gruppe keine Gruppen-Pille", z);
    // wie im Entwurf: "Strg K" in der Kampfwahl (nur zu sehen, der Name nennt
    // es schon); die Statusleiste seit der Neugestaltung 28.09. (0.23) in der Folge
    // des Entwurfs: Rolle, Live, "Nur gelesen", Datei, rechts Groesse und Version
    const e = await s.page.evaluate(() => {
      const r = (q) => document.querySelector(q).getBoundingClientRect();
      const k = document.querySelector("#kwKnopf .kwkbd");
      return { kbd: k && k.textContent, kbdVersteckt: k && k.getAttribute("aria-hidden"), kbdW: k ? k.getBoundingClientRect().width : 0,
        name: document.querySelector("#kwKnopf").getAttribute("aria-label"),
        folge: ["#sbRolle", "#sbLive", ".sbnur", "#sbDatei", "#sbFehler", "#sbZoom", "#sbVer"].map((q) => r(q).left),
        fehlerL: r("#sbFehler").left,
        zoomL: r("#sbZoom").left, sbW: r("#statusleiste").width };
    });
    assert(e.kbd === "Ctrl K" && e.kbdVersteckt === "true" && e.kbdW > 10 && e.name.includes("Ctrl+K"),
      "1280: Kampfwahl zeigt Ctrl K, der Name nennt es", e);
    /* folgt der Wahl vom 01.10.: "Fehler melden" steht rechts neben Groesse und Version - gleich streng, ein Teil mehr in der Folge */
    assert(e.folge.every((x, i) => i === 0 || x > e.folge[i - 1]) && e.zoomL > e.sbW / 2 && e.fehlerL > e.sbW / 2,
      "1280: Rolle, Live, Nur gelesen, Datei; Fehler melden, Groesse und Version rechts", e);
    await s.page.click("#btnCompact");
    await s.page.waitForFunction(() => document.body.classList.contains("compact"));
    /* Overlay-Look (Entscheidung vom 29.09. (an Claude uebertragen), DECISION 11.4): im Streifen ist
       Vollansicht ein Symbol wie in der Titelleiste - das Wort bleibt Name und steht im title, gleich streng
       gefragt wie vorher (Wort, Groesse, dazu die Zeichnung). */
    const c = await s.page.evaluate(() => { const b = document.querySelector("#btnCompact");
      return { fs: getComputedStyle(b).fontSize, text: b.textContent, title: b.title, breit: b.getBoundingClientRect().width,
        symbol: getComputedStyle(b, "::after").content !== "none" && parseFloat(getComputedStyle(b, "::after").width) >= 12 }; });
    assert(c.fs === "0px" && c.text === "Full view" && c.title === "Full view" && c.breit <= 28 && c.symbol,
      "Kompakt: Vollansicht als Symbol, das Wort als Name und im title", c);
    await s.page.close();
  }
  for (const [breite, hoehe] of [[560, 600], [1040, 600]]) {
    // 6.2 wenig Hoehe, 150 %: Start bleibt erreichbar, auch mit Waffen und Log-Einrichtung
    const s = await oeffne({ breite, hoehe, config: { uiZoom: 150 } });
    const p = s.page;
    await beispielLaden(p);
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    await entwickler(p);
    await p.waitForTimeout(300);
    const z = await p.evaluate(() => {
      const leiste = document.querySelector("#bereiche"), sb = document.querySelector("#statusleiste").getBoundingClientRect();
      leiste.scrollTop = leiste.scrollHeight;
      const st = document.querySelector('#bereiche [data-tab="start"]'), r = st.getBoundingClientRect();
      const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const zr = document.querySelector('#bereiche [data-tab="settings"]'), rz = zr.getBoundingClientRect();
      const obenZ = document.elementFromPoint(rz.left + rz.width / 2, rz.top + rz.height / 2);
      return { unten: r.bottom, sbOben: sb.top, trifft: !!oben && st.contains(oben), sicht: [...leiste.querySelectorAll(".tab")].filter((b) => !b.hidden).length,
        untenZ: rz.bottom, trifftZ: !!obenZ && zr.contains(obenZ), quer: document.documentElement.scrollWidth > innerWidth };
    });
    // zwoelf Knoepfe seit der Neugestaltung 28.09.: dazu Builds und Weeklies; dreizehn seit den Rekorden (Spezifikation 2a); zwoelf ohne Builds (#207);
    // dreizehn mit der Gilde (Spezifikation Gilde 5)
    assert(z.sicht === 13 && z.unten <= z.sbOben + 0.5 && z.trifft && !z.quer, `${breite}x${hoehe} bei 150 %: Start ueber der Statusleiste und klickbar`, z);
    assert(z.untenZ <= z.sbOben + 0.5 && z.trifftZ, `${breite}x${hoehe} bei 150 %: das Zahnrad ueber der Statusleiste und klickbar`, z);
    await p.close();
  }
  {
    // 6.3 Knopf: Lauf nicht wiederholen, wenn er wie der Boss heisst (Feldboss "Ramux")
    const s = await oeffne();
    const p = s.page;
    await beispielLaden(p);
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    const z = await p.evaluate(() => { const i = [...document.querySelectorAll("#fightList .fight")].findIndex((f) => f.getAttribute("aria-label").includes("Ramux"));   // folgt #152/#155: unter dem Kopf heisst die Zeile "Pull N", der Vorleser-Name traegt den Boss
      document.querySelectorAll("#fightList .fight")[i].click();
      // der Lauf steht seit der Neugestaltung 28.09. (0.4) nur noch im Namen der Pille
      return { text: document.querySelector("#kwWas").textContent, lauf: document.querySelector("#kwKnopf").getAttribute("aria-label").split(", ").length - 3,
        name: document.querySelector("#kwKnopf").getAttribute("aria-label"), liste: document.querySelector("#fightList").textContent }; });
    assert(z.lauf === 0 && (z.text.match(/Ramux/g) || []).length === 1 && (z.name.match(/Ramux/g) || []).length === 1,
      "Kampfwahl-Knopf: \"Ramux\" nur einmal, auch im Namen", z);
    assert(/Ramux/.test(z.liste), "die Liste bleibt, wie sie ist", z.liste.slice(0, 80));
    // ein anderer Lauf bleibt stehen
    const d = await p.evaluate(() => { const i = [...document.querySelectorAll("#fightList .fight")].findIndex((f) => f.getAttribute("aria-label").includes("Dragaryle"));   // folgt #152/#155: Zeilenname kann "Pull N" sein
      const f = document.querySelectorAll("#fightList .fight")[i];
      // folgt #152/#155: der Kopf heisst "Ort · Boss"; der Lauf im Namen des Knopfes ist der Ort
      const kb = f.closest(".blockgroup").querySelector(".blockfold b");
      const lauf = [...kb.childNodes].filter((n) => !(n.classList && n.classList.contains("kboss"))).map((n) => n.textContent).join("").trim();
      f.click();
      return { lauf, name: document.querySelector("#kwKnopf").getAttribute("aria-label") }; });
    assert(d.lauf && d.name.includes(", " + d.lauf + ", "), "ein Lauf mit anderem Namen bleibt im Namen des Knopfes", d);
    await p.close();
  }
  {
    // 6.4 Landmarken mit Namen
    const s = await oeffne();
    const p = s.page;
    const namen = () => p.evaluate(() => [document.querySelector("header.top").getAttribute("aria-label"), document.querySelector('[role="main"]').getAttribute("aria-label")]);
    assert(JSON.stringify(await namen()) === JSON.stringify(["Title bar", "Content"]), "banner und main haben Namen", await namen());
    await sprache(p, "de");
    assert(JSON.stringify(await namen()) === JSON.stringify(["Titelleiste", "Inhalt"]), "Deutsch: Titelleiste und Inhalt", await namen());
    await p.close();
  }
  {
    // 6.5 In der Vollansicht angeheftet, nach Kompakt und zurueck: bleibt angeheftet
    const s = await oeffne({ app: true });
    const p = s.page;
    await p.click("#btnPin");
    await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await p.waitForTimeout(300);
    assert(await p.getAttribute("#btnPin", "aria-pressed") === "true" && !s.win.some((b) => b.do === "pin" && b.on === false),
      "Vollansicht angeheftet: Kompakt und zurueck loest es nicht", s.win.filter((b) => b.do === "pin"));
    // erst im Kompakt angeheftet: beim Verlassen geloest wie bisher
    await p.click("#btnPin");
    await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await p.waitForTimeout(300);
    await p.click("#btnPin");
    await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await p.waitForTimeout(400);
    assert(await p.getAttribute("#btnPin", "aria-pressed") === "false", "im Kompakt angeheftet: die Vollansicht loest es",
      s.win.filter((b) => b.do === "pin"));
    assert(!s.fehler.length, "Anheften: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  {
    // 6.7 Deckel der Tabelle: halb so viel wie zwischen Titel- und Statusleiste Platz ist
    const s = await oeffne({ hoehe: 600 });
    const p = s.page;
    await beispielLaden(p);
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    await p.waitForTimeout(400);
    /* Seit der Neugestaltung 28.09. (Luecke 2.9) steht ab 1100 Punkt Breite
       die erste Faehigkeit offen. Der Deckel zaehlt Hauptzeilen und wandert
       beim Aufklappen nicht; gemessen wird wie vorher mit zugeklappten Zeilen. */
    await p.evaluate(() => document.querySelectorAll('#bars .row[aria-expanded="true"]').forEach((z) => z.click()));
    await p.waitForTimeout(200);
    /* folgt Spezifikation Feinschliff 4.4: bei 600 Punkt Hoehe ist der Glutring gestapelt, dort hat die Liste
       keinen Deckel mehr - alle Zeilen stehen, die Seite rollt. Gleich streng gemessen, dass die Statusleiste
       mitzaehlt: dahin gerollt steht die letzte Zeile ganz und frei ueber der Statusleiste. */
    const z = await p.evaluate(async () => {
      const box = document.querySelector("#bars"), b = box.getBoundingClientRect();
      const zeilen = [...box.querySelectorAll(".row:not(.sub)")];
      const w = getComputedStyle(document.documentElement);
      const letzte = zeilen[zeilen.length - 1];
      const ganz = zeilen.filter((r) => r.getBoundingClientRect().bottom <= b.bottom + 0.5).length;
      letzte.scrollIntoView({ block: "center" });
      await new Promise((r) => setTimeout(r, 100));
      const unten = innerHeight - parseFloat(w.getPropertyValue("--sb-h"));
      const r = letzte.getBoundingClientRect(), oben = document.elementFromPoint(r.left + 20, r.bottom - 4);
      return { ganz, alle: zeilen.length,
        rollt: box.scrollHeight > box.clientHeight + 1, letzteUnten: r.bottom, unten, frei: !!oben && letzte.contains(oben) };
    });
    assert(z.alle >= 12 && z.ganz === z.alle && !z.rollt && z.letzteUnten <= z.unten + 0.5 && z.frei,
      "Deckel rechnet die Statusleiste mit (gestapelt: kein Deckel, die letzte Zeile steht ueber der Statusleiste)", z);
    await p.close();
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}

console.log();
if (failed) { console.log(`RAHMEN PAGE FAILED - ${failed}`); process.exit(1); }
console.log("RAHMEN PAGE PASSED");
