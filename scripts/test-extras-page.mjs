// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Fenster-Extras (Spezifikation 27.09.2026, Abschnitte 3.3 bis 3.5 und 7) an
// der gebauten Seite, vom gestellten Helfer ausgeliefert (page.route): die
// Seite als eigenes Fenster der App (?win=1, nativeFrame) und als Tab im
// Browser. Der Helfer ist gestellt; was die Seite an /api/win und
// /api/config schickt, wird mitgeschrieben.
//
// Run:  npm run test:extras-page     (baut die Seite zuerst)

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { gebauterModus } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/* Ohne Spielbilder (BORO_BILDER=aus) traegt jeder Kern die gezeichnete Marke
   (CORE_GEM in 21-damage-table.ts); die Probe des Kernbilds prueft dann sie. */
const BILDER = gebauterModus(root) === "voll";
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

const TEXT = {
  en: { satz: "The compact window only stays above the game when Throne and Liberty runs as a borderless window (Settings \u2192 Graphics \u2192 Display mode).",
        kurz: "Above the game only if it runs borderless \u00b7 see \u22ef", ok: "Got it" },
  de: { satz: "Das Kompaktfenster liegt nur \u00fcber dem Spiel, wenn Throne and Liberty als randloses Fenster l\u00e4uft (Einstellungen \u2192 Grafik \u2192 Anzeigemodus).",
        kurz: "Nur \u00fcber dem Spiel, wenn es randlos l\u00e4uft \u00b7 siehe \u22ef", ok: "Verstanden" },
};

/* Eine Seite am gestellten Helfer. app: mit ?win=1 und nativeFrame (das
   eigene Fenster der App), sonst ein Browser-Tab auf 127.0.0.1. config: was
   GET /api/config antwortet. s.material: was /api/state als material meldet;
   s.zaehler: die Zaehler von /api/events.
   Kompakt als eigenes Fenster (Nachtraege N4): zwei - der Helfer meldet
   kompaktFenster (Windows mit Acrylic); kfenster - die Seite ist das
   Kompaktfenster selbst (?win=1&kompakt=1); s.kompakt - was /api/state
   unter kompakt meldet (offen, live, durch); helfer - ein beobachteter
   Ordner mit einem Log (/api/latest liefert es am Stueck); gruppe - der
   Helfer ist in einer Gruppe; s.schreibt - jeder POST ausser /api/win.
   Kompakt-Fix (01.10.): dateien - Name -> Text, was GET /api/log?name=
   liefert (sonst 404, wie eine Datei, die nicht im Log-Ordner liegt);
   s.kompakt traegt dazu grund, datei und kampf (der Stand der Vollansicht);
   folgt - das Fenster folgt den Groessen, um die das Kompaktfenster bittet,
   wie der Hauptprozess (das Menue waechst und schrumpft zurueck);
   acrylic - was /api/state als material meldet; stateVerzug - so viele ms
   spaeter antwortet /api/state; kompaktVerzug - so viele ms spaeter
   antwortet der Hauptprozess auf "kompakt" (Wettlauf N4); bewegung - "reduce":
   reduzierte Bewegung schon beim Laden (die grosse Zahl zaehlt nicht hoch). */
async function oeffne({ app = true, lang = "en", config = {}, zwei = false, kfenster = false, kompakt = {}, helfer = null,
                        gruppe = false, breite = 1280, hoehe = 860, dateien = null, folgt = false, acrylic = true, stateVerzug = 0,
                        kompaktVerzug = 0, bewegung = undefined, logVerzug = 0 } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe }, ...(bewegung ? { reducedMotion: bewegung } : {}) });
  page.setDefaultTimeout(FRIST * 3);   // auch ein Klick wartet auf ein Element, das unter Last spaeter kommt
  const s = { page, fehler: [], posts: [], win: [], schreibt: [], material: acrylic, logs: [], standNein: 0,
              kompakt: { offen: kfenster, live: false, durch: false, ...kompakt },
              groesseOffen: 0, horcht: 0, zustaende: 0,
              zaehler: { hotkey: 0, compact: 0, live: 0, handsize: 0, material: 0, kompakt: 0, kompakthand: 0, kompaktstand: 0 } };
  let vorMenue = null;
  aktuell = s;
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.addInitScript(anfragenZaehlen);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    // BORO_TEST_VERZUG: Antworten kommen zufaellig spaeter (Last auf dem Runner nachgestellt)
    // (nicht /api/win und /api/events: der Hauptprozess ordnet die Fensterbefehle, und /api/events wartet ohnehin)
    if (VERZUG && path !== "/api/win" && path !== "/api/events") await new Promise((r) => setTimeout(r, Math.random() * VERZUG));
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    // stateVerzug: /api/state antwortet spaeter als /api/config (Kompakt-Fix 4)
    if (path === "/api/state" && stateVerzug) await new Promise((r) => setTimeout(r, stateVerzug));
    if (path === "/api/state") s.zustaende++;   // jeder Takt (Live) fragt zuerst hier
    if (path === "/api/state") return json({ dir: helfer ? helfer.dir : "", file: helfer ? helfer.file : "",
      ...(helfer ? { size: helfer.text.length, mtime: 1 } : {}), nativeFrame: app, material: app && s.material, stayOnTop: false,
      ...(zwei ? { kompaktFenster: true, kompakt: s.kompakt } : {}) });
    if (path === "/api/latest" && helfer) {
      const n = helfer.text.length;
      return json({ file: helfer.file, from: 0, to: n, size: n, head: helfer.text.split("\n").slice(0, 2).join("\n"), text: helfer.text });
    }
    if (path === "/api/log" && dateien) {
      const name = url.searchParams.get("name") || "";
      s.logs.push(name);
      // logVerzug: der Helfer antwortet erst nach so vielen Millisekunden (langsame Platte, Last)
      if (logVerzug) await new Promise((r) => setTimeout(r, logVerzug));
      if (!Object.hasOwn(dateien, name)) return route.fulfill({ status: 404, contentType: "application/json", body: "{}" }).catch(() => {});
      // 500: der Helfer konnte die Datei gerade nicht lesen (Gutachten N3)
      if (dateien[name] === 500) return route.fulfill({ status: 500, contentType: "text/plain", body: "" }).catch(() => {});
      const n = dateien[name].length;
      return json({ file: name, from: 0, to: n, size: n, text: dateien[name] });
    }
    // jede schreibende Anfrage ausser /api/win, fuer die Probe "der Streifen schreibt nichts" (Pruefung N4, W3/W4)
    if (req.method() === "POST" && path !== "/api/win") s.schreibt.push(path);
    if (path === "/api/config" && req.method() === "GET") return json(config);
    if (path === "/api/config") { s.posts.push(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    // gruppe: der Helfer ist in einer Gruppe (Mitglied), die Tafel noch leer
    if (path === "/api/party/state" && gruppe) return json({ ok: true, role: "member", code: "ABCD", name: "Ich", board: [] });
    if (path === "/api/win") {
      const b = JSON.parse(req.postData() || "{}"); s.win.push(b);
      // wie der Hauptprozess: "kompakt" oeffnet oder schliesst, pin nennt den Stand
      if (b.do === "kompakt") {
        s.kompakt.offen = !!b.on;
        // kompaktVerzug: die Antwort kommt spaeter, die Anfrage ist schon gezaehlt (Wettlauf N4)
        if (kompaktVerzug) await new Promise((r) => setTimeout(r, kompaktVerzug));
        return json({ ok: true, offen: !!b.on });
      }
      // s.standNein: so viele Staende lehnt der Hauptprozess ab (Gutachten N4)
      if (b.do === "stand" && s.standNein > 0) { s.standNein--; return json({ ok: false, error: "nicht jetzt" }); }
      if (b.do === "stand") { Object.assign(s.kompakt, { grund: b.grund, datei: b.datei, kampf: b.kampf }); return json({ ok: true }); }
      // folgt: wie der Hauptprozess - der Streifen, das Menue waechst, zurueck auf die Groesse davor
      // Die neue Groesse wird erst nach der Antwort gesetzt (Playwright nimmt
      // die Befehle der Reihe nach): auf sie zu warten, haelt die Antwort an,
      // solange die Seite beschaeftigt ist (das Beispiel laedt).
      // Ausnahme "zurueck" (Wettlauf, Fix 04.10.): wie im Hauptprozess erst die
      // Groesse, dann die Antwort - die Seite misst sich gleich danach neu, und
      // im noch grossen Fenster zeigt die Tafel mehr Zeilen (244 statt 235).
      // s.groesseOffen: so viele Groessen sind bestellt, aber noch nicht gesetzt.
      if (folgt && b.do === "resize" && b.win === "kompakt" && b.art !== "hand") {
        const jetzt = page.viewportSize();
        let neu = null;
        if (b.art === "menue") { vorMenue = vorMenue || jetzt; neu = { width: Math.max(jetzt.width, b.w), height: Math.max(jetzt.height, b.h) }; }
        else if (b.art === "zurueck") { neu = vorMenue; vorMenue = null; }
        else if (!vorMenue) neu = { width: b.w, height: b.h };
        const v = neu || jetzt;
        s.groesseOffen++;
        try {
          if (neu && b.art === "zurueck") await page.setViewportSize(neu).catch(() => {});
          await json({ ok: true, max: false, w: v.width, h: v.height });
          if (neu && b.art !== "zurueck") await page.setViewportSize(neu).catch(() => {});
        } finally { s.groesseOffen--; }
        return;
      }
      // ein Fenster, das die bestellte Hoehe annimmt (#328: die Leiste ist 34 statt 26 Punkt hoch, und die feste Antwort 28 lag mit dem Hinweis
      // ueber der Toleranz von 40 der Seite); sonst wie bisher
      return json({ ok: true, max: false, w: 400, h: b.do === "resize" && b.h ? b.h : 28, on_top: b.do === "pin" ? !!b.on : true,
                    ...(b.do === "clickthrough" ? { clickthrough: !!b.on } : {}) });
    }
    if (path === "/api/events") {
      // wie der Helfer: eine Frage wartet, bis sich ein Zaehler bewegt (hier hoechstens 1 s)
      if (!url.searchParams.get("now")) {
        s.horcht++;   // die Seite kennt den Stand und horcht: was jetzt hochzaehlt, sieht sie als neu
        const gesehen = JSON.parse(url.searchParams.get("seen") || "{}");
        const neu = () => Object.keys(s.zaehler).some((k) => s.zaehler[k] > (gesehen[k] || 0));
        for (const ende = performance.now() + 1000; performance.now() < ende && !neu(); ) await new Promise((r) => setTimeout(r, 50));
      }
      return json({ ok: true, registered: true, counts: s.zaehler });
    }
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html" + (kfenster ? "?win=1&kompakt=1" : app ? "?win=1" : ""));
  // Seite fertig: body[data-bereit] statt #landStatus (Neugestaltung 28.09., Befund 2)
  await warte(page, (h) => document.body.dataset.bereit === (h ? "ordner" : "ohne"), !!helfer, 30000, "die Seite ist bereit (body[data-bereit])");
  // und die Einstellungen (/api/config) sind gelesen und angewandt, alles, was daraus folgt, ist beim Helfer
  await stille(s, "Start");
  /* Das eigene Fenster horcht auf Ereignisse (horcheAufEreignisse): erst
     der Stand (?now=1), dann die wartende Frage. Ein Zaehler, der davor
     hochgeht, gehoert zum Stand und loest nichts aus. */
  if (app) await bis(() => s.horcht > 0, "die Seite horcht auf /api/events");
  return s;
}
/* Warten auf einen Zustand statt fester Pausen (Issue #167): laeuft die
   Frist ab, steht eine FAIL-Zeile mit dem, worauf gewartet wurde (ohne
   worauf: die Bedingung selbst), und es geht weiter - die Pruefungen danach
   sagen, was fehlt. */
/* Frist (#224): jedes Warten ist eine Frist, keine Pause - bei Erfolg ist es
   sofort vorbei. Auf den CI-Runnern laufen bis zu zehn Jobs auf sechs Kernen,
   und ein Ereignis entsteht dort ueber eine Kette von Anfragen und Antworten
   des gestellten Helfers; fuenf Sekunden reichten nicht. Die Frist ist darum
   mindestens FRIST, auch wo eine kuerzere steht. Nur die Wartezeit ist so
   lang, keine Pruefung ist lockerer. BORO_TEST_VERZUG (nur zur Nachstellung
   des Fehlers): so viele ms antwortet der gestellte Helfer auf jede Anfrage
   hoechstens spaeter, zufaellig zwischen 0 und dem Wert. */
const FRIST = 20000;
const VERZUG = Number(process.env.BORO_TEST_VERZUG || 0);
/* die zuletzt geoeffnete Seite: bei Zeitablauf nennt die FAIL-Zeile ihren Stand */
let aktuell = null;
const stand = (seit) => ({ nach_ms: Math.round(performance.now() - seit),
  letzte_an_den_helfer: aktuell ? aktuell.win.slice(-3) : null, dateien_geholt: aktuell ? aktuell.logs.length : null });
/* streng: die Zeit IST die Anforderung ("sofort", "im naechsten Takt"); dann
   gilt ms genau, ohne Aufschlag auf FRIST. Zwei Stellen: Live beenden (1 s,
   vor dem Wecker der Kampftrennung) und der erste Kampf eines leeren Logs
   (4,5 s, ein Takt). Wackeln sie unter Last, braucht ein anderer Wert die Freigabe des Eigentuemers. */
async function warte(page, fn, arg, ms = FRIST, worauf = String(fn).replace(/\s+/g, " "), streng = false) {
  const seit = performance.now(), frist = streng ? ms : Math.max(ms, FRIST);
  try { await page.waitForFunction(fn, arg, { timeout: frist }); return true; }
  catch (e) { assert(false, "Zeitablauf (" + frist + " ms) beim Warten auf: " + worauf, { fehler: String(e).split("\n")[0], ...stand(seit) }); return false; }
}
/* Wartet, bis fn() im Test wahr ist (die Anfragen der Seite liegen hier,
   nicht in der Seite), hoechstens ms; true, wenn es so kam. Mit worauf
   steht bei Zeitablauf eine FAIL-Zeile da; ohne nicht (fuer assert(await bis(...))). */
const bis = async (fn, worauf, ms = FRIST) => {
  const seit = performance.now(), frist = Math.max(ms, FRIST);
  for (const ende = seit + frist; performance.now() < ende; ) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); }
  if (fn()) return true;
  if (worauf) assert(false, "Zeitablauf (" + frist + " ms) beim Warten auf: " + (typeof worauf === "function" ? worauf() : worauf), stand(seit));
  return false;
};
// dasselbe als eigener Schritt: bei Zeitablauf die Bedingung selbst als FAIL-Zeile
const bisDa = (fn, ms = FRIST) => bis(fn, String(fn).replace(/\s+/g, " "), ms);
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
   an den Helfer schicken wollte, liegt jetzt in s.win, s.posts, s.schreibt. */
const stille = (s, wann) => warte(s.page, () => window.__offen === 0, undefined, 5000,
  "Ruhe, alle Anfragen der Seite beantwortet (" + wann + ")");
/* Eine hineingezogene Datei ist ganz geladen: ein Kampf steht in der Tafel
   (noFight allein reicht nicht, die Klasse faellt vor dem Zeichnen der Zeilen)
   und alles, was die Seite dabei an den Helfer schicken wollte, ist dort.
   Wer danach den Streifen oeffnet, schickt den Stand der Datei, nicht den
   davor (#224, Wettlauf N4: unter Last ging zuerst "leer" hinaus). */
async function dateiDa(s, wann) {
  await warte(s.page, () => !document.body.classList.contains("noFight") && document.querySelectorAll("#bars .row").length > 0,
    undefined, FRIST, "ein Kampf steht in der Tafel (" + wann + ")");
  await stille(s, wann);
}
/* Die Seite hat die Ereignisse gelesen, die der Test bis jetzt gezaehlt hat:
   die naechste Frage an /api/events beginnt (hoechstens 1 s, solange der
   Helfer wartet). Wer vorher eine Datei neu bestellt, riskiert, dass ein
   frueherer Zaehler die Seite ein zweites Mal holen laesst (#224, M3). */
async function ereignisseGelesen(s, wann) {
  const n = s.horcht;
  await bis(() => s.horcht > n, "die Seite fragt /api/events neu (" + wann + ")");
}
/* Die Seite steht: kein CSS-Uebergang laeuft mehr (nach
   einem Themenwechsel, bevor Farben gelesen werden); Keyframe-Animationen
   wie der atmende Live-Punkt zaehlen nicht. */
const steht = (page, wann) => warte(page, () => document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== "running"), undefined, 5000,
  "kein laufender Uebergang (" + wann + ")");
/* Zwei Bilder sind gezeichnet: was die Seite im naechsten Bild misst (etwa
   nach einer neuen Fenstergroesse), ist gemessen. */
async function bilder(page, wann) {
  const gezeichnet = await Promise.race([
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))),
    new Promise((r) => setTimeout(() => r(false), FRIST)),   // Frist, keine Pause: ohne Bild nach FRIST eine FAIL-Zeile
  ]);
  if (!gezeichnet) assert(false, "Zeitablauf (" + FRIST + " ms) beim Warten auf zwei gezeichnete Bilder (" + wann + ")");
}
/* Live: ein weiterer Takt hat /api/state gefragt, und alles, was er geholt
   hat, ist verarbeitet (stille). */
async function nachTakt(s, wann) {
  const n = s.zustaende;
  await bis(() => s.zustaende > n, "den naechsten Takt (" + wann + ")");
  await stille(s, wann);
}
/* Dass etwas NICHT geschieht, laesst sich nur ueber eine Frist zeigen: so
   lange, wie der gestellte Helfer hoechstens fuer eine Antwort auf
   /api/events braucht (1 s), und etwas Luft. */
const ruhig = () => new Promise((r) => setTimeout(r, 1500));
/* Mit folgt: wartet, bis das Fenster die zuletzt erbetene Groesse hat und
   der Streifen nichts Neues mehr bittet (er misst 260 ms spaeter nach).
   Unter Last reichte ruhig() dafuer nicht (Wettlauf, Fix 04.10.). */
const gefolgt = async (s) => {
  for (let i = 0; i < 20; i++) {
    await bis(() => !s.groesseOffen, "die bestellten Groessen sind gesetzt");
    const n = s.win.length;
    await s.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    // bewusst eine Frist: dass der Streifen NICHTS mehr bittet, zeigt nur die Zeit (er misst 260 ms spaeter nach)
    await new Promise((r) => setTimeout(r, 500));
    if (s.win.length === n && !s.groesseOffen) return;
  }
  assert(false, "Zeitablauf beim Warten darauf, dass der Streifen seiner Groesse gefolgt ist", { offen: s.groesseOffen, letzte: s.win.slice(-4) });
};
/* Kompakt im selben Fenster umschalten: bis die Seite umgeschaltet hat und
   alles, was sie dabei an den Helfer schickt, dort ist. */
const kompakt = async (s) => {
  const war = await s.page.evaluate(() => document.body.classList.contains("compact"));
  await s.page.click("#btnCompact");
  await warte(s.page, (w) => document.body.classList.contains("compact") !== w, war, 5000, "Kompakt umgeschaltet (vorher " + war + ")");
  await stille(s, "Kompakt umgeschaltet");
};
const meldung = (s) => s.page.evaluate(() => {
  const t = document.querySelector("#toast");
  const knopf = t.querySelector(".tact");
  return { an: t.classList.contains("on"), ruhig: t.classList.contains("ruhig"), text: t.firstChild?.nodeValue ?? "",
           knopf: knopf ? knopf.textContent : null, tinte: knopf ? getComputedStyle(knopf).color : null };
});
const randlosPosts = (s) => s.posts.filter((p) => "randlosGesehen" in p);
/* Ein erzeugtes Log an Vulcanus (wie in Abschnitt 8): je Pull 60 s, ein
   Treffer alle 500 ms, scale macht die Pulls unterscheidbar. Kompakt-Fix. */
function vulcanusLog(pulls) {
  const SKILLS = [["Detonation Mark", 953174691], ["Quick Fire", 964762401], ["Strafing", 945674044], ["Decisive Sniping", 964581976]];
  const two = (n, w = 2) => String(n).padStart(w, "0");
  const stamp = (ms) => {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-` +
           `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`;
  };
  const rows = [];
  for (const p of pulls) for (let k = 0; k * 500 < 60000; k++) {
    const [skill, sid] = SKILLS[k % 4];
    rows.push([p.start + k * 500, `,DamageDone,${skill},${sid},${Math.round(1000 * p.scale * (1 + (k % 5)))},0,0,kNormalHit,Tester,Vulcanus`]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  return ["CombatLogVersion,4", ...rows.map(([t, r]) => stamp(t) + r)].join("\n") + "\n";
}
const LOGNAME = "TLCombatLog-20260923.txt";
/* Die Starts der Pulls: der Zeitstempel des Logs als UTC gelesen (parseTime). */
const START = [Date.UTC(2026, 8, 23, 21, 0, 0), Date.UTC(2026, 8, 23, 21, 10, 0), Date.UTC(2026, 8, 23, 21, 20, 0)];
const LOG2 = vulcanusLog([{ start: START[0], scale: 6.0 }, { start: START[1], scale: 4.0 }]);
// dieselbe Datei, gewachsen um einen dritten Pull (Gutachten M3)
const LOG3 = vulcanusLog([{ start: START[0], scale: 6.0 }, { start: START[1], scale: 4.0 }, { start: START[2], scale: 2.0 }]);

try {
  // --- 1. Acrylic folgt Windows (3.3): ein Ereignis "material", und die Seite fragt nach
  {
    const s = await oeffne();
    const acrylic = () => s.page.evaluate(() => document.documentElement.classList.contains("acrylic"));
    assert(await acrylic(), "Start: html.acrylic, wie /api/state meldet");
    s.material = false; s.zaehler.material++;
    await warte(s.page, () => !document.documentElement.classList.contains("acrylic"), undefined, 5000, "html.acrylic faellt weg (Ereignis material)");
    await stille(s, "Transparenz aus");
    assert(!(await acrylic()), "Transparenz aus: html.acrylic faellt weg");
    assert(s.win.some((b) => b.do === "seethrough"), "und die Durchsicht wird neu gesetzt");
    s.material = true; s.zaehler.material++;
    await warte(s.page, () => document.documentElement.classList.contains("acrylic"), undefined, 5000, "html.acrylic kommt wieder (Ereignis material)");
    assert(await acrylic(), "Transparenz wieder an: html.acrylic ist wieder da");
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await s.page.close();
  }
  // --- 2. feste Groesse der Vollansicht (#364, ersetzt 3.4 "gemerkte Lage"): die Groessen-Einstellung
  //        skaliert die Seite, nie das Fenster - weder beim Start (mit und ohne gemerkte Lage) noch beim Stellen
  {
    for (const windowPlaced of [true, false]) {
      const s = await oeffne({ config: { uiZoom: 150, windowPlaced } });
      await warte(s.page, () => document.querySelector("#zoomVal")?.textContent === "150%", undefined, 5000, "150 % steht");
      await stille(s, "Start bei 150 %");
      assert(!s.win.some((b) => b.do === "size"), "Start bei 150 % (gemerkte Lage " + windowPlaced + "): die Seite bittet nie um eine Fenstergroesse", s.win);
      await s.page.evaluate(() => document.querySelector("#zoomIn").click());
      await warte(s.page, () => document.querySelector("#zoomVal")?.textContent === "175%", undefined, 5000, "175 % steht");
      await s.page.evaluate(() => document.querySelector("#zoomOut").click());
      await warte(s.page, () => document.querySelector("#zoomVal")?.textContent === "150%", undefined, 5000, "wieder 150 %");
      await stille(s, "Stufen der Groesse");
      assert(!s.win.some((b) => ["size", "maximize"].includes(b.do)), "Groesse stellen: die Seite bewegt das Fenster nicht (kein size, kein maximize)", s.win.map((b) => b.do));
      assert(!(await s.page.evaluate(() => !!document.querySelector("#winMax"))), "die Seite kennt keinen Maximieren-Knopf mehr");
      await s.page.close();
    }
  }
  // --- 3. der Randlos-Hinweis (3.5), Englisch: beim ersten Kompakt, ruhig, mit "Got it"
  {
    const s = await oeffne({ config: { randlosGesehen: false } });
    await kompakt(s);
    const m = await meldung(s);
    assert(m.an && m.text === TEXT.en.kurz && m.knopf === TEXT.en.ok, "erstes Kompakt: der Hinweis mit Got it", m);
    assert(m.ruhig, "ruhig: ohne Gold und Rot (Klasse ruhig)", m);
    /* Der Knopf ragt nicht aus dem Hinweis und nicht in den Streifen. Seit
       dem 28.09. steht der Hinweis im Fluss unter dem Streifen (nicht mehr
       darauf, darum nicht mehr hoechstens --chrome hoch): er beginnt unter
       dem Streifen, und der Knopf liegt mit Luft ganz darin. */
    const mass = await s.page.evaluate(() => {
      const t = document.querySelector("#toast"), k = t.querySelector(".tact");
      const tr = t.getBoundingClientRect(), kr = k.getBoundingClientRect();
      return { oben: tr.top, streifen: document.querySelector(".top").getBoundingClientRect().bottom,
               knopfOben: kr.top - tr.top, knopfUnten: tr.bottom - kr.bottom };
    });
    assert(mass.oben >= mass.streifen - 0.5 && mass.knopfOben >= 0 && mass.knopfUnten >= 0,
      "Kompakt: der Knopf im Hinweis ragt nicht ueber den Hinweis und nicht in den Streifen", mass);
    assert(m.tinte !== null && m.tinte === (await s.page.evaluate(() => {
      const p = document.createElement("span"); p.style.color = "var(--text)"; document.body.append(p);
      const c = getComputedStyle(p).color; p.remove(); return c; })), "die Taste in der Textfarbe, nicht in Gold", m);
    assert(!randlosPosts(s).length, "vor dem Klick wird nichts geschrieben", s.posts);
    await s.page.click("#toast .tact", { timeout: FRIST });
    await warte(s.page, () => !document.querySelector("#toast").classList.contains("on"), undefined, 5000, "der Hinweis geht nach Got it weg");
    await stille(s, "Got it");
    assert(JSON.stringify(randlosPosts(s)) === JSON.stringify([{ randlosGesehen: true }]), "Got it schreibt randlosGesehen: true", s.posts);
    assert(!(await meldung(s)).an, "und der Hinweis geht weg");
    await kompakt(s); await kompakt(s);
    const m2 = await meldung(s);
    assert(!(m2.an && m2.text === TEXT.en.kurz), "zweites Kompakt: kein Hinweis mehr", m2);
    const note = await s.page.evaluate(() => { const n = document.querySelector("#randlosNote"); return { hidden: n.hidden, text: n.textContent }; });
    assert(!note.hidden && note.text === TEXT.en.satz, "der ganze Satz steht in der Hilfe zum Kompaktfenster (⋯-Menue)", note);
    assert(s.posts.every((p) => !("fenster" in p)), "die Seite schickt nie fenster", s.posts);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await s.page.close();
  }
  // --- 4. nicht quittiert: der Hinweis kommt beim naechsten Kompakt wieder
  {
    const s = await oeffne({ config: { randlosGesehen: false } });
    await kompakt(s);
    await kompakt(s);            // zurueck in die Vollansicht, ohne Klick
    await kompakt(s);
    const m = await meldung(s);
    assert(m.an && m.text === TEXT.en.kurz, "ohne Got it: beim naechsten Kompakt wieder", m);
    assert(!randlosPosts(s).length, "und nichts geschrieben", s.posts);
    await s.page.close();
  }
  // --- 5. schon gesehen: kein Hinweis
  {
    const s = await oeffne({ config: { randlosGesehen: true } });
    await kompakt(s);
    const m = await meldung(s);
    assert(!(m.an && m.text === TEXT.en.kurz), "randlosGesehen: true - kein Hinweis", m);
    await s.page.close();
  }
  // --- 6. Deutsch
  {
    const s = await oeffne({ lang: "de", config: { randlosGesehen: false } });
    await kompakt(s);
    const m = await meldung(s);
    assert(m.an && m.text === TEXT.de.kurz && m.knopf === TEXT.de.ok, "Deutsch: der Hinweis mit Verstanden", m);
    const note = await s.page.evaluate(() => document.querySelector("#randlosNote").textContent);
    assert(note === TEXT.de.satz, "Deutsch: der Satz in der Hilfe", note);
    await s.page.close();
  }
  // --- 7. im Browser ohne App: kein Hinweis, keine Hilfe dazu
  {
    const s = await oeffne({ app: false, config: { randlosGesehen: false } });
    await kompakt(s);
    const m = await meldung(s);
    assert(!(m.an && m.text === TEXT.en.kurz), "Browser ohne App: kein Hinweis", m);
    assert(await s.page.evaluate(() => document.querySelector("#randlosNote").hidden), "Browser ohne App: der Satz steht nicht im Menue");
    await s.page.close();
  }
  /* --- 8. aus test-abend-page.mjs, Neugestaltung 28.09. (Nr. 8): der Abend
     entfaellt (Spezifikation 3), das Kompaktfenster bleibt. Issue #39: die
     Differenz zum letzten Pull steht neutral - in der Farbe der Lesezeile,
     nicht Gruen oder Rot; das Vorzeichen traegt die Richtung. Zwischen dem
     Satz und der Differenz ein Trenner, in beiden Sprachen, auch im title und
     fuer den Vorleser. Ueber file://, zwei erzeugte Logs an Vulcanus. */
  {
    const work = mkdtempSync(join(tmpdir(), "boro-kompakt-"));
    try {
      const SKILLS = [["Detonation Mark", 953174691], ["Quick Fire", 964762401],
                      ["Strafing", 945674044], ["Decisive Sniping", 964581976]];
      const two = (n, w = 2) => String(n).padStart(w, "0");
      const stamp = (ms) => {
        const d = new Date(ms);
        return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-` +
               `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`;
      };
      const logText = (pulls) => {
        const rows = [];
        for (const p of pulls) for (let k = 0; k * 500 < p.secs * 1000; k++) {
          const [skill, sid] = SKILLS[k % 4];
          rows.push([p.start + k * 500, `,DamageDone,${skill},${sid},${Math.round(1000 * p.scale * (1 + (k % 5)))},0,0,kNormalHit,Tester,${p.target}`]);
        }
        rows.sort((a, b) => a[0] - b[0]);
        return ["CombatLogVersion,4", ...rows.map(([t, r]) => stamp(t) + r)].join("\n") + "\n";
      };
      const V = (day, min, scale) => ({ target: "Vulcanus", start: Date.UTC(2026, 8, day, 21, min, 0), secs: 60, scale });
      const datei = (name, text) => { const f = join(work, name); writeFileSync(f, text); return f; };
      const L16 = datei("vulcanus-16.txt", logText([V(16, 0, 5.0), V(16, 10, 5.5)]));
      const L23 = datei("vulcanus-23.txt", logText([V(23, 0, 6.0), V(23, 10, 5.75)]));
      const k = await browser.newPage({ viewport: { width: 420, height: 260 } });
      const kErrors = [];
      k.on("pageerror", (e) => kErrors.push(String(e)));
      await k.addInitScript(() => {
        try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* storage blocked */ }
      });
      /* Gelesen ist eine Datei, wenn readFiles sie geladen hat: f.text() loest
         auf, loadText laeuft in den Mikroaufgaben danach - der Zaehler steigt
         erst in der Aufgabe dahinter. */
      await k.addInitScript(() => {
        window.__gelesen = 0;
        const text = Blob.prototype.text;
        Blob.prototype.text = function () {
          return text.call(this).then((t) => { setTimeout(() => { window.__gelesen++; }, 0); return t; });
        };
      });
      const lies = async (datei) => {
        const vor = await k.evaluate(() => window.__gelesen);
        await k.setInputFiles("#fileInput", datei);
        await warte(k, (n) => window.__gelesen > n, vor, 5000, "die Datei ist gelesen (" + datei.split(/[\\/]/).pop() + ")");
      };
      await k.goto("file://" + join(root, "dist", "renderer", "index.html"));
      const kompaktZeile = () => k.evaluate(() => {
        const el = document.querySelector("#hCompact");
        const pv = document.querySelector("#hPrev");
        const probe = (v) => { const s = document.createElement("span"); s.style.color = `var(${v})`; document.body.append(s);
          const c = getComputedStyle(s).color; s.remove(); return c; };
        return { da: !!el && !el.hidden && !!el.offsetParent, text: el?.textContent || "", title: el?.title || "",
                 kinder: [...(el?.children || [])].map((c) => c.className + ":" + c.textContent),
                 zeile: el ? getComputedStyle(el).color : "", satz: el?.firstElementChild ? getComputedStyle(el.firstElementChild).color : "",
                 kinderZahl: el ? el.children.length : -1,
                 prev: pv && !pv.hidden && pv.getClientRects().length ? pv.textContent : "",
                 prevFarbe: pv ? getComputedStyle(pv).color : "", soft: probe("--ink-soft"), text0: probe("--text"),
                 pos: probe("--pos"), neg: probe("--neg") };
      });
      await lies(L16);
      await warte(k, () => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"), undefined, 30000, "Vulcanus im Kopf (vulcanus-16)");
      await k.evaluate(() => document.querySelector("#btnCompact").click());
      await warte(k, () => document.body.classList.contains("compact") && !!document.querySelector("#hCompact")?.offsetParent, undefined, 5000,
        "Kompakt mit der Lesezeile #hCompact");
      // der zweite Pull an Vulcanus ist staerker als der erste (5,5 zu 5,0): "+10 %"
      for (const theme of ["dark", "light", "tnl"]) {
        await k.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`).click(), theme);
        await warte(k, (th) => document.documentElement.dataset.theme === th, theme, 5000, "Thema " + theme + " gesetzt");
        await steht(k, "Thema " + theme);
        const z = await kompaktZeile();
        assert(z.da && /^\+10\u00a0% zum letzten Pull$/.test(z.prev) && z.prevFarbe === z.soft && ![z.pos, z.neg].includes(z.prevFarbe) && z.kinderZahl === 1,
          `Kompakt, Thema ${theme}: der Anstieg unter der Zahl, weder gruen noch rot; die Lesezeile traegt nur den Satz`, z);
      }
      let z = await kompaktZeile();
      assert(z.kinderZahl === 1 && !/\u00b7/.test(z.text) && z.title === z.text && /^\+10\u00a0% zum letzten Pull$/.test(z.prev),
        "Kompakt DE: die Lesezeile ist nur der Satz (title gleich), der Vergleich steht unter der Zahl", z);
      /* Issue #39: kein doppelter Abstand. Satz und Vergleich stehen jetzt
         getrennt, ohne Punkt dazwischen; der Anspruch gilt fuer beide. */
      assert(!/\s{2}/.test(z.text) && !/\s{2}/.test(z.prev) && z.prev.trim() === z.prev,
        "Kompakt: kein doppelter Abstand in Lesezeile und Vergleich (Issue #39)", { text: z.text, prev: z.prev });
      // Durchsicht: der Vergleich nimmt die Textfarbe (Liste in styles.css, .big .prevline)
      await k.evaluate(() => document.body.classList.add("durchsicht"));
      z = await kompaktZeile();
      assert(z.prev !== "" && z.prevFarbe === z.text0 && ![z.pos, z.neg].includes(z.prevFarbe),
        "Kompakt, Durchsicht: der Vergleich unter der Zahl in var(--text)", z);
      await k.evaluate(() => document.body.classList.remove("durchsicht"));
      // der Rueckgang: zweites Log, sein zweiter Pull schwaecher (5,75 zu 6,0)
      await lies(L23);
      for (const theme of ["light", "tnl", "dark"]) {
        await k.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`).click(), theme);
        await warte(k, (th) => document.documentElement.dataset.theme === th, theme, 5000, "Thema " + theme + " gesetzt");
        await steht(k, "Thema " + theme);
        z = await kompaktZeile();
        assert(z.da && /^\u2212[\d.]+\u00a0% zum letzten Pull$/.test(z.prev) && z.prevFarbe === z.soft && ![z.pos, z.neg].includes(z.prevFarbe) && z.kinderZahl === 1,
          `Kompakt, Thema ${theme}: der Rueckgang unter der Zahl, weder gruen noch rot; die Lesezeile traegt nur den Satz`, z);
      }
      assert(/^\u2212\d/.test(z.prev), "Kompakt: der Rueckgang traegt das Minuszeichen U+2212", z.prev);
      await k.evaluate(() => document.querySelector("#btnLang").click());
      await warte(k, () => document.documentElement.lang === "en", undefined, 5000, "Sprache Englisch (html lang)");
      z = await kompaktZeile();
      assert(z.kinderZahl === 1 && /^\u2212[\d.]+% vs\. last pull$/.test(z.prev) && z.title === z.text,
        "Kompakt EN: Satz in der Lesezeile, der Vergleich unter der Zahl", z);
      assert(!kErrors.length, "Kompakt: keine Fehler in der Seite", kErrors);
      await k.close();
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  /* --- 9. Kompakt als eigenes Fenster (Nachtraege N4), das grosse Fenster:
     der Knopf oeffnet und schliesst das Kompaktfenster ueber /api/win
     {do:"kompakt"}; das grosse Fenster bleibt die Vollansicht und schrumpft
     nicht. Der Knopf sagt mit aria-pressed, ob der Streifen offen ist. */
  {
    const s = await oeffne({ zwei: true, config: { randlosGesehen: false } });
    const p = s.page;
    const knopf = () => p.evaluate(() => ({ kompakt: document.body.classList.contains("compact"),
      pressed: document.querySelector("#btnCompact").getAttribute("aria-pressed"),
      text: document.querySelector("#btnCompact").textContent }));
    await p.click("#btnCompact");
    await warte(p, () => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", undefined, 5000);
    const auf = s.win.filter((b) => b.do === "kompakt");
    assert(auf.length === 1 && auf[0].on === true && auf[0].live === false && auf[0].durch === false && auf[0].win === "main",
      "Kompakt: das grosse Fenster bittet um das Kompaktfenster (kompakt, on, live aus, ohne Kuerzel)", s.win);
    const k = await knopf();
    assert(!k.kompakt && k.text === "Compact", "das grosse Fenster bleibt die Vollansicht, der Knopf heisst weiter Compact", k);
    assert(!s.win.some((b) => ["resize", "material", "restore_size"].includes(b.do)),
      "das grosse Fenster schrumpft nicht und bekommt kein Material", s.win);
    assert(!(await meldung(s)).an || (await meldung(s)).text !== TEXT.en.kurz, "der Randlos-Hinweis gehoert dem Streifen, nicht dem grossen Fenster");
    // noch ein Klick schliesst es
    await p.click("#btnCompact");
    await warte(p, () => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "false", undefined, 5000);
    const zu = s.win.filter((b) => b.do === "kompakt");
    assert(zu.length === 2 && zu[1].on === false, "noch ein Klick: das Kompaktfenster geht zu", zu);
    // es schliesst sich selbst (Vollansicht im Streifen): das Ereignis "kompakt" holt den Stand
    await p.click("#btnCompact");
    await warte(p, () => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", undefined, 5000);
    s.kompakt.offen = false; s.zaehler.kompakt++;
    await warte(p, () => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "false", undefined, 5000);
    assert((await knopf()).pressed === "false", "das Kompaktfenster ging von selbst zu: der Knopf folgt dem Ereignis", await knopf());
    // die Taskleiste (Vorschau-Knopf Kompakt) schaltet es wie der Knopf
    const vorher = s.win.filter((b) => b.do === "kompakt").length;
    s.zaehler.compact++;
    await warte(p, (n) => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", vorher, 5000);
    const tb = s.win.filter((b) => b.do === "kompakt");
    assert(tb.length === vorher + 1 && tb[tb.length - 1].on === true, "Taskleiste: der Vorschau-Knopf oeffnet das Kompaktfenster", tb);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 10. das Kuerzel aus dem grossen Fenster: das Kompaktfenster auf, oben,
     durchklickbar (durch: true); ist es schon offen, gehoert das Kuerzel ihm */
  {
    const s = await oeffne({ zwei: true });
    const p = s.page;
    s.zaehler.hotkey++;
    await warte(p, () => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", undefined, 5000);
    const auf = s.win.filter((b) => b.do === "kompakt");
    assert(auf.length === 1 && auf[0].on === true && auf[0].durch === true, "Kuerzel aus der Vollansicht: das Kompaktfenster, durchklickbar", s.win);
    assert(!s.win.some((b) => b.do === "clickthrough" || b.do === "pin"), "das grosse Fenster wird weder durchklickbar noch angeheftet", s.win);
    s.zaehler.hotkey++;
    await ruhig();
    assert(s.win.filter((b) => b.do === "kompakt").length === 1, "Kuerzel bei offenem Kompaktfenster: das grosse Fenster laesst es dem Streifen", s.win);
    await p.close();
  }
  /* --- 11. Live laeuft im grossen Fenster: das Kompaktfenster laeuft mit (live: true) */
  {
    const text = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
    const helfer = { dir: "C:\\Logs", file: "TLCombatLog-20260925.txt", text };
    const s = await oeffne({ zwei: true, helfer });
    const p = s.page;
    await p.click("#btnWatch");
    await warte(p, () => document.body.classList.contains("watching"), undefined, 5000);
    await p.click("#btnCompact");
    await warte(p, () => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", undefined, 5000);
    const auf = s.win.filter((b) => b.do === "kompakt");
    assert(auf.length === 1 && auf[0].live === true, "Live im grossen Fenster: das Kompaktfenster laeuft mit", auf);
    await p.close();
  }
  /* --- 12. das Kompaktfenster selbst (?win=1&kompakt=1): der Streifen von
     Anfang an, jede Anfrage an /api/win nennt win "kompakt", nichts fuer
     Rahmen, Material oder Taskleiste; Anheften steht an (das Fenster ist
     immer vorn); ohne Minimieren (es hat keinen Platz in der Taskleiste) */
  {
    const s = await oeffne({ zwei: true, kfenster: true, config: { randlosGesehen: false } });
    const p = s.page;
    await warte(p, () => document.body.classList.contains("compact"), undefined, 5000);
    await warte(p, () => document.querySelector("#btnPin").getAttribute("aria-pressed") === "true", undefined, 5000);
    const k = await p.evaluate(() => ({
      weg: ["#kwKnopf", "#kampfwahl", "#bereiche", "#statusleiste", "#winMin"].map((q) => document.querySelector(q).getClientRects().length),
      top: document.querySelector(".top").getBoundingClientRect().height,
      klasse: document.documentElement.classList.contains("kfenster"),
      zu: document.querySelector("#winClose").getClientRects().length,
      quer: document.documentElement.scrollWidth > innerWidth }));
    assert(k.weg.every((n) => n === 0) && Math.abs(k.top - 34) < 0.5 && k.klasse && k.zu === 1,
      "Kompaktfenster: der Streifen (34 Punkt, #328) ohne Kampfwahl, Leisten und Minimieren, mit Schliessen", k);
    await warte(p, () => document.querySelector("#toast").classList.contains("on"), undefined, 5000);
    const m = await meldung(s);
    assert(m.an && m.text === TEXT.en.kurz, "Kompaktfenster: der Randlos-Hinweis beim ersten Mal", m);
    await bisDa(() => s.win.some((b) => b.do === "resize"));
    const resize = s.win.filter((b) => b.do === "resize");
    assert(resize.length >= 1 && resize.every((b) => b.win === "kompakt" && b.w >= 180 && b.h >= 24),
      "Kompaktfenster: es misst sich und bittet um seine eigene Groesse (win kompakt)", resize);
    assert(s.win.every((b) => b.win === "kompakt"), "jede Anfrage an /api/win nennt das Kompaktfenster", s.win);
    assert(!s.win.some((b) => ["material", "chrome", "size", "restore_size", "live", "maximize", "minimize"].includes(b.do)),
      "nichts fuer Rahmen, Material, Groesseneinstellung oder Taskleiste", s.win.map((b) => b.do));
    assert(!s.win.some((b) => b.do === "pin"), "Anheften steht an, ohne dass die Seite es erst setzt", s.win);
    // Anheften loesen gilt dem Kompaktfenster, und gemerkt wird es nicht
    await p.hover(".top");
    await p.click("#btnPin", { timeout: FRIST }).catch((e) => assert(false, "Zeitablauf beim Klick auf #btnPin", String(e).split("\n")[0]));
    await warte(p, () => document.querySelector("#btnPin").getAttribute("aria-pressed") === "false", undefined, 5000);
    const pin = s.win.filter((b) => b.do === "pin");
    assert(pin.length === 1 && pin[0].on === false && pin[0].win === "kompakt" && pin[0].remember === false,
      "Anheften im Kompaktfenster: fuer dieses Fenster, nicht gemerkt", pin);
    // Vollansicht: zum grossen Fenster, der Streifen geht zu - er selbst wechselt nicht
    await p.click("#btnCompact");
    await bisDa(() => s.win.some((b) => b.do === "kompakt"));
    const voll = s.win.filter((b) => b.do === "kompakt");
    assert(voll.length === 1 && voll[0].on === false && voll[0].win === "kompakt", "Vollansicht: das Kompaktfenster bittet ums Schliessen", voll);
    assert(await p.evaluate(() => document.body.classList.contains("compact")), "und bleibt selbst der Streifen");
    // Schliessen schliesst nur den Streifen
    await p.evaluate(() => document.querySelector("#winClose").click());
    await bisDa(() => s.win.some((b) => b.do === "close"));
    const close = s.win.filter((b) => b.do === "close");
    assert(close.length === 1 && close[0].win === "kompakt", "Schliessen im Streifen: nur das Kompaktfenster", close);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 12a. (#188) Die Knoepfe der Leiste liegen nie im Ziehbereich. Im
     echten Fenster nimmt Windows der Seite die Maus, sobald sie ueber einem
     Ziehbereich steht: :hover faellt weg, und die Leiste, die nur beim Zeigen
     da ist, verschwand genau unter dem Zeiger. Electron baut den Bereich in
     der Reihenfolge des Dokuments: drag fuegt hinzu, no-drag zieht ab, was
     spaeter kommt, gilt. Die Probe rechnet das nach und fragt die Mitte jedes
     sichtbaren Knopfs der Leiste - in allen vier Themen, mit und ohne
     Anheften, im Kompaktfenster und im geschrumpften grossen Fenster. Der
     Griff (.tdrag) muss dabei weiter ziehen. */
  {
    const zieht = (p) => p.evaluate(() => {
      const regel = (e) => getComputedStyle(e).getPropertyValue("app-region") || getComputedStyle(e).getPropertyValue("-webkit-app-region");
      const flaechen = [];
      for (const e of document.querySelectorAll("*")) {
        const r = regel(e);
        if ((r === "drag" || r === "no-drag") && e.getClientRects().length) flaechen.push([r === "drag", e.getBoundingClientRect()]);
      }
      const drin = (x, y) => flaechen.reduce((an, [d, b]) => (x >= b.left && x < b.right && y >= b.top && y < b.bottom) ? d : an, false);
      const knoepfe = [...document.querySelectorAll(".top :is(button,a,input,select)")].filter((e) => e.getClientRects().length &&
        getComputedStyle(e).visibility === "visible" && e.getBoundingClientRect().width > 0);
      const griff = document.querySelector(".tdrag").getBoundingClientRect();
      return { ziehen: knoepfe.filter((e) => { const b = e.getBoundingClientRect(); return drin(b.left + b.width / 2, b.top + b.height / 2); })
        .map((e) => e.id || e.className), zahl: knoepfe.length, griff: drin(griff.left + 4, griff.top + griff.height / 2) };
    });
    const text = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
    const helfer = { dir: "C:\\Logs", file: "TLCombatLog-20260925.txt", text };
    for (const theme of ["dark", "light", "tnl", "glas"]) {
      const s = await oeffne({ zwei: true, kfenster: true, helfer, kompakt: { live: true }, config: { randlosGesehen: true, theme } });
      const p = s.page;
      await warte(p, () => document.body.classList.contains("watching") && !document.body.classList.contains("noFight"), undefined, 8000);
      await warte(p, () => document.querySelector("#btnPin").getAttribute("aria-pressed") === "true", undefined, 5000);
      const an = await zieht(p);
      await p.hover(".top");
      await p.click("#btnPin", { timeout: FRIST }).catch((e) => assert(false, "Zeitablauf beim Klick auf #btnPin", String(e).split("\n")[0]));
      await warte(p, () => document.querySelector("#btnPin").getAttribute("aria-pressed") === "false", undefined, 5000);
      const aus = await zieht(p);
      assert(an.zahl >= 5 && !an.ziehen.length && an.griff && aus.zahl >= 5 && !aus.ziehen.length && aus.griff,
        `Kompaktfenster, Thema ${theme}: kein Knopf der Leiste im Ziehbereich, mit und ohne Anheften; der Griff zieht (#188)`, { an, aus });
      assert(!s.fehler.length, `Kompaktfenster, Thema ${theme}: keine Fehler`, s.fehler);
      await p.close();
    }
    for (const theme of ["dark", "glas"]) {
      const s = await oeffne({ config: { randlosGesehen: true, theme } });
      const p = s.page;
      await p.evaluate(() => document.querySelector("#btnSample").click());
      await warte(p, () => !document.querySelector("#app").hidden, undefined, 8000);
      await p.evaluate(() => document.querySelector("#btnCompact").click());
      await warte(p, () => document.body.classList.contains("compact") && !document.body.classList.contains("noFight"), undefined, 5000);
      const k = await zieht(p);
      assert(k.zahl >= 4 && !k.ziehen.length && k.griff,
        `Kompakt im grossen Fenster, Thema ${theme}: kein Knopf der Leiste im Ziehbereich; der Griff zieht (#188)`, k);
      await p.close();
    }
  }
  /* --- 13. im Kompaktfenster: Escape zweimal, das Kuerzel, Taskleiste und
     Live-Knopf gehoeren dem grossen Fenster. Mit Helfer (Pruefung N4, K1):
     dort wuerde ein Klick auf Live wirklich mitlesen. */
  {
    const text13 = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
    const s = await oeffne({ zwei: true, kfenster: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-20260925.txt", text: text13 },
                             config: { randlosGesehen: true } });
    const p = s.page;
    await warte(p, () => document.body.classList.contains("compact"), undefined, 5000);
    await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
    await bisDa(() => s.win.some((b) => b.do === "kompakt"));
    assert(s.win.filter((b) => b.do === "kompakt" && b.on === false).length === 1, "Escape zweimal: zur Vollansicht", s.win);
    s.zaehler.hotkey++;
    await warte(p, () => document.body.classList.contains("through"), undefined, 5000);
    const durch = s.win.filter((b) => b.do === "clickthrough");
    assert(durch.length === 1 && durch[0].on === true && durch[0].win === "kompakt" && await p.evaluate(() => !document.querySelector("#throughHint").hidden),
      "Kuerzel im Kompaktfenster: durchklickbar, die Pille mit dem Schloss", durch);
    // erst wenn der Streifen nach dem Kuerzel fertig gemessen hat (die Pille bittet noch um Groesse, #224)
    await gefolgt(s);
    const vorher = s.win.length;
    s.zaehler.compact++; s.zaehler.live++;
    await ruhig();
    assert(s.win.length === vorher && !(await p.evaluate(() => document.body.classList.contains("watching"))),
      "Taskleiste und Live-Knopf der Vorschau schalten im Kompaktfenster nichts", s.win);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 14. das Kompaktfenster startet, wie es geoeffnet wurde: durch das
     Kuerzel durchklickbar, mit Live, wenn das grosse Fenster live war */
  {
    const text = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
    const helfer = { dir: "C:\\Logs", file: "TLCombatLog-20260925.txt", text };
    const s = await oeffne({ zwei: true, kfenster: true, helfer, kompakt: { live: true, durch: true }, config: { randlosGesehen: true } });
    const p = s.page;
    await warte(p, () => document.body.classList.contains("watching") && document.body.classList.contains("through"), undefined, 8000);
    const z = await p.evaluate(() => ({ live: document.body.classList.contains("watching"), durch: document.body.classList.contains("through"),
      ruht: document.body.classList.contains("noFight") }));
    assert(z.live && !z.ruht, "mit live: der Streifen liest das Log mit und zeigt den Kampf", z);
    assert(z.durch && s.win.some((b) => b.do === "clickthrough" && b.on === true && b.win === "kompakt"), "mit durch: gleich durchklickbar", s.win);
    assert(!s.win.some((b) => b.do === "live"), "der Punkt in der Taskleiste bleibt Sache des grossen Fensters", s.win);
    await p.close();
    const t = await oeffne({ zwei: true, kfenster: true, helfer, config: { randlosGesehen: true } });
    await warte(t.page, () => document.body.classList.contains("compact"), undefined, 5000);
    await bisDa(() => t.win.some((b) => b.do === "resize"));
    await ruhig();
    const y = await t.page.evaluate(() => ({ live: document.body.classList.contains("watching"), durch: document.body.classList.contains("through") }));
    assert(!y.live && !y.durch && !t.win.some((b) => b.do === "clickthrough"), "ohne beides: weder Live noch Durchklick von selbst", { y, win: t.win });
    await t.page.close();
  }
  /* --- 15. von Hand gezogen (kompakthand): der Streifen behaelt die Groesse.
     Nachgeschaerft (Pruefung N4, W5): das Beispiel ein zweites Mal ergab
     dieselbe Groesse, und die fragte der Streifen ohnehin nicht nach. Jetzt
     werden die Zeilen hoeher gestellt (nur im Test) und ein Themawechsel
     zeichnet neu - das ergaebe eine andere Groesse. */
  {
    const s = await oeffne({ zwei: true, kfenster: true, config: { randlosGesehen: true } });
    const p = s.page;
    await warte(p, () => document.body.classList.contains("compact"), undefined, 5000);
    await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
    await warte(p, () => !document.body.classList.contains("noFight"), undefined, 5000);
    await bisDa(() => s.win.some((b) => b.do === "resize"));
    await ruhig();
    const hoeher = (px, thema) => p.evaluate(([x, th]) => {
      let st = document.querySelector("#probe-zeilen");
      if (!st) { st = document.createElement("style"); st.id = "probe-zeilen"; document.head.appendChild(st); }
      // #328: die Zeilen sind fest 26 Punkt und die Liste zeigt fuenf; mehr Hoehe verlangt hier der Kopf (headwrap)
      st.textContent = "body.compact .headwrap{min-height:" + (x + 100) + "px !important}";
      document.querySelector('#themeRow button[data-theme="' + th + '"]').click();
    }, [px, thema]);
    const letzte = () => s.win.filter((b) => b.do === "resize").at(-1);
    // Gegenprobe: ohne Hand bittet der Streifen um die neue, hoehere Groesse
    let n = s.win.filter((b) => b.do === "resize").length;
    const h0 = letzte().h;
    await hoeher(90, "light");   // Platten (Kompakt neu): 62 Punkt hoch, 90 sind deutlich mehr
    assert(await bis(() => s.win.filter((b) => b.do === "resize").length > n && letzte().h > h0),
      "ohne Hand: hoehere Zeilen, der Streifen bittet um eine groessere Hoehe (Gegenprobe)", s.win.slice(n));
    await ruhig();
    s.zaehler.kompakthand++;
    await ruhig();
    /* Folgt Kompakt-Fix (01.10.), Hoechstgroesse: von Hand gezogen nennt der
       Streifen seine Groesse noch als Grenze (art "hand", Abschnitt 26) -
       gezaehlt werden die Bitten, das Fenster zu setzen, gleich streng. */
    const setzt = () => s.win.filter((b) => b.do === "resize" && b.art !== "hand");
    n = setzt().length;
    await hoeher(110, "dark");
    await ruhig();
    assert(setzt().length === n, "von Hand gezogen: keine gerechnete Groesse mehr darueber", setzt().slice(n));
    await p.close();
  }
  /* --- 16. Rueckfall: im Browser meldet der Helfer das Kompaktfenster auch,
     aber der Tab schrumpft sich selbst wie bisher; in der App ohne
     kompaktFenster (Linux, Windows ohne Acrylic) ebenso (Abschnitte 3-7) */
  {
    const s = await oeffne({ app: false, zwei: true });
    await kompakt(s);
    assert(await s.page.evaluate(() => document.body.classList.contains("compact")) && !s.win.some((b) => b.do === "kompakt"),
      "Browser: Kompakt im selben Tab, ohne Kompaktfenster", s.win);
    await s.page.close();
    const t = await oeffne();
    await kompakt(t);
    // die Groesse bittet die Seite erst, wenn sie den Streifen gemessen hat (CI: nach dem Umschalten noch nicht da)
    await bisDa(() => t.win.some((b) => b.do === "resize" && b.win === "main"));
    assert(await t.page.evaluate(() => document.body.classList.contains("compact")) && !t.win.some((b) => b.do === "kompakt")
      && t.win.some((b) => b.do === "resize" && b.win === "main"),
      "App ohne Kompaktfenster: das grosse Fenster schrumpft wie bisher (win main)", t.win);
    await t.page.close();
  }
  /* --- 17. der Satz aus #57: ein Fenster ueber dem Spiel, kein Overlay im
     Spiel - im Menue des Streifens und in den Einstellungen, DE und EN,
     nur in der App */
  {
    const SATZ = { en: "A normal Windows window above the game, not an overlay in the game. Borometer does not touch the game.",
                   de: "Ein normales Windows-Fenster \u00fcber dem Spiel, kein Overlay im Spiel. Borometer greift nicht auf das Spiel zu." };
    for (const lang of ["en", "de"]) {
      const s = await oeffne({ zwei: true, kfenster: true, lang, config: { randlosGesehen: true } });
      await warte(s.page, () => document.body.classList.contains("compact"), undefined, 5000);
      await s.page.evaluate(() => document.querySelector("#btnMore").click());
      const n = await s.page.evaluate(() => { const e = document.querySelector("#fensterNote"); return { hidden: e.hidden, text: e.textContent, da: e.getClientRects().length > 0 }; });
      assert(!n.hidden && n.da && n.text === SATZ[lang], `${lang}: der Satz steht im Menue des Streifens`, n);
      await s.page.close();
      const g = await oeffne({ zwei: true, lang });
      await g.page.click('#bereiche [data-tab="settings"]');
      await g.page.click('#einstNav button[data-gruppe="overlay"]');
      const e = await g.page.evaluate(() => { const x = document.querySelector("#eFensterSatz"); return { da: x.getClientRects().length > 0, text: x.textContent }; });
      assert(e.da && e.text === SATZ[lang], `${lang}: der Satz steht in den Einstellungen unter Overlay`, e);
      await g.page.close();
    }
    const b = await oeffne({ app: false });
    const x = await b.page.evaluate(() => ({ menue: document.querySelector("#fensterNote").hidden }));
    assert(x.menue, "Browser: der Satz steht nicht im Menue", x);
    await b.page.close();
  }
  /* --- 18. der Streifen schreibt nichts Gespeichertes und meldet der Gruppe
     nichts (Pruefung N4, W3/W4/K4): nur seine Fensterfahnen ueber /api/win
     und randlosGesehen. Mit Helfer, Live und Gruppe; Thema, Groesse,
     Durchsicht und Geist werden gestellt, das Log laeuft. Gegenprobe:
     dieselben Handgriffe im grossen Fenster schreiben und melden. */
  {
    const text = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
    const helfer = { dir: "C:\\Logs", file: "TLCombatLog-20260925.txt", text };
    const handgriffe = async (p) => {
      await p.evaluate(() => {
        document.querySelector('#themeRow button[data-theme="light"]').click();
        document.querySelector("#zoomIn").click();
        const r = document.querySelector("#seeSlide"); r.value = "20";
        r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true }));
        document.querySelector("#btnGhost").click();
      });
      // die Gruppe fragt alle 3 s ab und meldet dann
      await new Promise((r) => setTimeout(r, 4000));
    };
    const s = await oeffne({ zwei: true, kfenster: true, helfer, gruppe: true, config: { randlosGesehen: false } });
    const p = s.page;
    // erst der Randlos-Hinweis quittiert, dann Live (wie mit live: true geoeffnet, nur spaeter)
    await warte(p, () => !!document.querySelector("#toast .tact"), undefined, 5000);
    await p.evaluate(() => document.querySelector("#toast .tact")?.click());
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await warte(p, () => document.body.classList.contains("watching") && !document.body.classList.contains("noFight"), undefined, 8000);
    await handgriffe(p);
    assert(await p.evaluate(() => document.body.classList.contains("watching")), "Streifen: Live laeuft (sonst prueft die Probe nichts)");
    assert(JSON.stringify(s.posts) === JSON.stringify([{ randlosGesehen: true }]),
      "Streifen: in die Einstellungen geht nur randlosGesehen", s.posts);
    assert(!s.schreibt.filter((w) => w !== "/api/config").length,
      "Streifen: kein POST an /api/best, /api/builds oder /api/party/report", s.schreibt);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
    // Gegenprobe im grossen Fenster
    const g = await oeffne({ zwei: true, helfer, gruppe: true, config: { randlosGesehen: true } });
    await g.page.click("#btnWatch");
    await warte(g.page, () => document.body.classList.contains("watching") && !document.body.classList.contains("noFight"), undefined, 8000);
    await handgriffe(g.page);
    const schluessel = [...new Set(g.posts.flatMap((b) => Object.keys(b)))];
    assert(["theme", "uiZoom", "compactAlpha", "ghost"].every((k) => schluessel.includes(k)) && g.schreibt.includes("/api/party/report"),
      "Gegenprobe: das grosse Fenster schreibt dieselben Handgriffe und meldet der Gruppe", { schluessel, schreibt: g.schreibt });
    await g.page.close();
  }
  /* --- 19. die Meldung im Streifen geht: das Fenster misst sich neu und ist um die Meldung niedriger, der Knopf steht ganz darin
     (Pruefung N4, M3). Kompakt neu, Panel (21.10.2026): die Hoehe folgt dem Inhalt (compactWindowSize misst die letzte Zeile und
     den Knopf), die Probe laeuft darum mit folgt und vergleicht die Hoehen mit und ohne Meldung; vorher schnitt die Tafel auf ganze
     Platten und die Probe zaehlte die Reihen. Der Randlos-Hinweis steht beim ersten Zeichnen und geht nach 12 s. */
  {
    const s = await oeffne({ zwei: true, kfenster: true, folgt: true, lang: "de", breite: 300, hoehe: 28, config: { randlosGesehen: false } });
    const p = s.page;
    await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
    await warte(p, () => !document.body.classList.contains("noFight"), undefined, 5000);
    const mass = () => p.evaluate(() => {
      const k = document.querySelector("#kRest"), ende = !k.hidden && k.getClientRects().length ? k.getBoundingClientRect().bottom : document.querySelector("#bars").getBoundingClientRect().bottom;
      return { meldung: document.querySelector("#toast").classList.contains("on"), luecke: Math.round(innerHeight - ende), h: innerHeight };
    });
    await warte(p, () => document.querySelector("#toast").classList.contains("on"), undefined, 3000);
    await gefolgt(s);
    const mit = await mass();
    await warte(p, () => !document.querySelector("#toast").classList.contains("on"), undefined, 16000);
    await gefolgt(s);
    const ohne = await mass();
    assert(mit.meldung && !ohne.meldung && ohne.h < mit.h && mit.luecke >= 0 && mit.luecke <= 10 && ohne.luecke >= 0 && ohne.luecke <= 10,
      "Meldung weg: das Fenster misst sich neu, ist niedriger als mit ihr, und der Knopf steht jedes Mal ganz darin (Luft unten hoechstens 10)", { mit, ohne });
    await p.close();
  }
  /* --- 20. das Kompaktfenster hat einen eigenen Titel (Pruefung N4, K6),
     in beiden Sprachen; das grosse behaelt seinen */
  {
    const s = await oeffne({ zwei: true, kfenster: true, config: { randlosGesehen: true } });
    await warte(s.page, () => document.body.classList.contains("compact"), undefined, 5000);
    const en = await s.page.title();
    await s.page.evaluate(() => document.querySelector("#btnLang").click());
    await warte(s.page, () => document.title !== "Borometer \u00b7 Compact", undefined, 3000);
    const de = await s.page.title();
    assert(en === "Borometer \u00b7 Compact" && de === "Borometer \u00b7 Kompakt", "Titel des Kompaktfensters in EN und DE", { en, de });
    await s.page.close();
    const g = await oeffne({ zwei: true });
    assert((await g.page.title()) === "Borometer \u2014 The Hive", "das grosse Fenster behaelt seinen Titel", await g.page.title());
    await g.page.close();
  }
  /* --- 21. das Kernbild im Kompakt (Abschlusspruefung, M2): die Marke ist
     dort 13 Punkt, das Bild darin ebenso - nicht 18 ueber die Marke hinaus.
     Eine aufgeklappte Unterzeile bekommt von Hand eine Marke in der Form,
     wie coreBadge sie baut (mit Bild eines Kerns, ohne Bilder die
     gezeichnete): gemessen wird die Groesse dort, nicht coreBadge selbst. */
  {
    const s = await oeffne({ app: false });
    const p = s.page;
    await p.evaluate(() => document.querySelector("#btnSample").click());
    await warte(p, () => document.querySelectorAll("#bars .row:not(.sub)").length > 0, undefined, 5000);
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await warte(p, () => document.body.classList.contains("compact"), undefined, 5000);
    await p.evaluate(() => document.querySelector("#bars .row.has-sub")?.click());
    await warte(p, () => !!document.querySelector("#bars .row.sub"), undefined, 5000);
    const m = BILDER ? await p.evaluate(() => {
      const src = document.querySelector("#bars .cmark.kernbild img")?.src;
      const sub = document.querySelector("#bars .row.sub");
      if (!src || !sub) return { src: !!src, sub: !!sub };
      sub.querySelectorAll(".cmark").forEach((x) => x.remove());
      const mark = document.createElement("i");
      mark.className = "cmark kernbild";
      mark.innerHTML = '<img src="' + src + '" alt="">';
      (sub.querySelector(".nmt") || sub.firstElementChild).after(mark);
      const a = mark.getBoundingClientRect(), b = mark.firstElementChild.getBoundingClientRect();
      return { marke: [a.width, a.height], bild: [b.width, b.height] };
    }) : await p.evaluate(() => {
      /* ohne Bilder: was dieser Zweig misst, und was nicht. Gruppiert nach
         Faehigkeit sind die Unterzeilen Trefferarten (catMode), coreBadge
         malt dort keine Marke; beide Zweige setzen sie deshalb von Hand ein.
         Hier wird die gezeichnete Marke einer Hauptzeile in die Unterzeile
         kopiert und gemessen: das Kompakt-CSS macht sie 13 Punkt gross, und
         der Stein liegt ganz darin. Ob coreBadge in einer Unterzeile eine
         Marke rendert, prueft dieser Zweig nicht. */
      const gem = document.querySelector("#bars .cmark:not(.kernbild) svg")?.closest(".cmark");
      const sub = document.querySelector("#bars .row.sub");
      if (!gem || !sub || document.querySelector("#bars .cmark.kernbild")) return { gem: !!gem, sub: !!sub, kernbild: !!document.querySelector("#bars .cmark.kernbild") };
      sub.querySelectorAll(".cmark").forEach((x) => x.remove());
      const mark = gem.cloneNode(true);
      (sub.querySelector(".nmt") || sub.firstElementChild).after(mark);
      const a = mark.getBoundingClientRect(), b = mark.querySelector("svg").getBoundingClientRect();
      return { marke: [a.width, a.height], gem: [b.width, b.height],
        drin: b.left >= a.left && b.right <= a.right && b.top >= a.top && b.bottom <= a.bottom };
    });
    assert(BILDER ? m.marke && m.marke[0] === 13 && m.bild[0] === m.marke[0] && m.bild[1] === m.marke[1]
      : m.marke && m.marke[0] === 13 && m.marke[1] === 13 && m.gem[0] > 0 && m.drin,
      "Kompakt: das Kernbild ist so gross wie seine Marke (13 Punkt)" + (BILDER ? "" : " (ohne Spielbilder: die gezeichnete Marke, 13 Punkt, der Stein darin)"), m);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 22. Kompakt-Fix (Befund 01.10.): die Vollansicht zeigt einen
     Kampf, der Streifen sagte "No log". Jetzt gibt die Vollansicht beim
     Oeffnen ihren Stand mit (/api/win "stand", vor "kompakt"): den
     Dateinamen und den Start des gewaehlten Kampfs, und sie folgt einem
     Kampfwechsel, solange der Streifen offen ist. Sonst nur den Grund:
     Beispiel, mehrere Dateien, Live. */
  const kampf = {};
  {
    const work = mkdtempSync(join(tmpdir(), "boro-stand-"));
    try {
      const f = join(work, LOGNAME), g = join(work, "TLCombatLog-20260924.txt");
      writeFileSync(f, LOG2); writeFileSync(g, LOG2);
      const s = await oeffne({ zwei: true, config: { randlosGesehen: true } });
      const p = s.page;
      const staende = () => s.win.filter((b) => b.do === "stand");
      // die grosse Zahl zaehlt sonst hoch: abgelesen wird der Endwert
      await p.emulateMedia({ reducedMotion: "reduce" });
      await p.setInputFiles("#fileInput", f);
      await warte(p, () => !document.body.classList.contains("noFight") && document.querySelectorAll("#bars .row").length > 0, undefined, 5000);
      kampf.dpsNeu = await p.textContent("#hDps");
      await p.evaluate(() => document.querySelector("#kwVor").click());
      await warte(p, (d) => document.querySelector("#hDps").textContent !== d, kampf.dpsNeu, 5000);
      kampf.dpsAlt = await p.textContent("#hDps");
      assert(kampf.dpsAlt !== kampf.dpsNeu, "Vollansicht: zwei Pulls, der aeltere gewaehlt (sonst prueft die Probe nichts)", kampf);
      assert(!staende().length, "solange kein Streifen offen ist, geht kein Stand hinaus", staende());
      await p.click("#btnCompact");
      await bisDa(() => s.win.some((b) => b.do === "kompakt"));
      // erst wenn der Streifen aus Sicht der Seite offen ist (Wettlauf N4, Fix 04.10.)
      await warte(p, () => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", undefined, 5000);
      const iStand = s.win.findIndex((b) => b.do === "stand"), iAuf = s.win.findIndex((b) => b.do === "kompakt");
      const st = s.win[iStand];
      assert(iStand >= 0 && iStand < iAuf && st?.win === "main" && st.grund === "datei" && st.datei === LOGNAME && Number.isSafeInteger(st.kampf),
        "Oeffnen: zuerst der Stand (Datei aus dem Log-Ordner, gewaehlter Kampf), dann das Kompaktfenster", s.win);
      assert(JSON.stringify(Object.keys(st || {}).sort()) === JSON.stringify(["datei", "do", "grund", "kampf", "win"]),
        "der Stand hat nur benannte Felder: grund, datei, kampf", st);
      kampf.alt = st?.kampf;
      // Kampfwechsel in der Vollansicht: der Stand folgt
      await p.evaluate(() => document.querySelector("#kwNach").click());
      await bisDa(() => staende().length >= 2);
      kampf.neu = staende().at(-1)?.kampf;
      assert(staende().length >= 2 && staende().at(-1)?.datei === LOGNAME && Number.isSafeInteger(kampf.neu) && kampf.neu > kampf.alt,
        "Kampfwechsel: die Vollansicht nennt den neuen Kampf (spaeterer Start)", staende());
      // dasselbe noch einmal zeichnen schickt nichts Neues
      const n = staende().length;
      await p.evaluate(() => document.querySelector('#themeRow button[data-theme="light"]').click());
      await ruhig();
      assert(staende().length === n, "ein Neuzeichnen ohne Wechsel schickt keinen neuen Stand", staende().slice(n));
      // zwei Dateien: nur der Grund, kein Name
      await p.setInputFiles("#fileInput", [f, g]);
      await bisDa(() => staende().at(-1)?.grund === "mehrere");
      assert(staende().at(-1)?.grund === "mehrere" && staende().at(-1)?.datei === "" && staende().at(-1)?.kampf === null,
        "zwei Dateien zugleich: Grund mehrere, ohne Namen", staende().at(-1));
      // das Beispiel: nur der Grund
      await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
      await bisDa(() => staende().at(-1)?.grund === "beispiel");
      assert(staende().at(-1)?.grund === "beispiel" && staende().at(-1)?.datei === "" && staende().at(-1)?.kampf === null,
        "das Beispiel: Grund beispiel, ohne Namen", staende().at(-1));
      // Streifen zu: kein Stand mehr
      await p.click("#btnCompact");
      await warte(p, () => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "false", undefined, 5000);
      const m = staende().length;
      await p.setInputFiles("#fileInput", f);
      await ruhig();
      assert(staende().length === m, "Streifen zu: die Vollansicht schickt keinen Stand", staende().slice(m));
      assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
      await p.close();
      // Live: der Grund live, wie heute laeuft der Streifen dann selbst mit
      const text = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
      const l = await oeffne({ zwei: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-20260925.txt", text }, config: { randlosGesehen: true } });
      await l.page.click("#btnWatch");
      await warte(l.page, () => document.body.classList.contains("watching"), undefined, 5000);
      await l.page.click("#btnCompact");
      await bisDa(() => l.win.some((b) => b.do === "kompakt"));
      const ls = l.win.filter((b) => b.do === "stand").at(-1);
      assert(ls && ls.grund === "live" && ls.datei === "" && ls.kampf === null && l.win.find((b) => b.do === "kompakt").live === true,
        "Live: Grund live, das Kompaktfenster laeuft mit wie bisher", l.win);
      await l.page.close();
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  /* --- 23. das Kompaktfenster laedt die Datei der Vollansicht ueber
     GET /api/log?name= (N3) und waehlt denselben Kampf; es folgt einem
     Kampfwechsel (Ereignis kompaktstand). Live startet es dabei nicht.
     Gutachten N5: die Starts stehen fest (START); die Zahlen der
     Vollansicht kommen aus 22 - fehlen sie, sagt die Probe das selbst. */
  assert(kampf.alt === START[0] && kampf.neu === START[1] && !!kampf.dpsAlt && !!kampf.dpsNeu,
    "Abschnitt 22 lieferte die Starts (wie START) und die Zahlen der Vollansicht, die 23 braucht", kampf);
  {
    const s = await oeffne({ zwei: true, kfenster: true, dateien: { [LOGNAME]: LOG2 }, config: { randlosGesehen: true },
                             kompakt: { grund: "datei", datei: LOGNAME, kampf: START[0] }, bewegung: "reduce" });
    const p = s.page;
    // die grosse Zahl zaehlt sonst hoch: reduzierte Bewegung schon beim Oeffnen, der Streifen laedt den Kampf beim Start
    await warte(p, () => !document.body.classList.contains("noFight"), undefined, 8000);
    const z = await p.evaluate(() => ({ ruht: document.body.classList.contains("noFight"), dps: document.querySelector("#hDps").textContent,
      live: document.body.classList.contains("watching"), idle: document.querySelector("#compactIdle").getClientRects().length }));
    assert(!z.ruht && z.idle === 0 && s.logs.includes(LOGNAME), "Streifen: die Datei der Vollansicht ueber /api/log, kein \"No log\"", { z, logs: s.logs });
    assert(z.dps === kampf.dpsAlt, "Streifen: derselbe Kampf wie in der Vollansicht (der aeltere)", { z, kampf });
    assert(!z.live, "Streifen: Live startet dabei nicht", z);
    s.kompakt.kampf = START[1]; s.zaehler.kompaktstand++;
    await warte(p, (d) => document.querySelector("#hDps").textContent === d, kampf.dpsNeu, 5000);
    assert((await p.textContent("#hDps")) === kampf.dpsNeu, "Kampfwechsel in der Vollansicht: der Streifen folgt", { dps: await p.textContent("#hDps"), kampf });
    assert(s.logs.filter((x) => x === LOGNAME).length === 1, "derselbe Name: die Datei wird nicht neu geholt", s.logs);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 24. nicht im Log-Ordner (hineingezogen: /api/log kennt den Namen
     nicht), das Beispiel, mehrere Dateien: ein klarer Satz im Streifen statt
     "No log", DE und EN, ganz zu lesen; ohne Grund bleibt "No log" */
  {
    const SATZ = {
      en: { fremd: "File not in the log folder", beispiel: "Sample: full view only", mehrere: "Several files: full view only", leer: "No log", archiv: "Archive: full view only" },
      de: { fremd: "Datei nicht im Log-Ordner", beispiel: "Beispiel: nur in der Vollansicht", mehrere: "Mehrere Dateien: nur in der Vollansicht", leer: "Kein Log", archiv: "Archiv: nur in der Vollansicht" },
    };
    for (const lang of ["en", "de"]) {
      for (const [grund, kompakt] of [["fremd", { grund: "datei", datei: "Mitschnitt.txt", kampf: 1 }], ["beispiel", { grund: "beispiel", datei: "", kampf: null }],
                                       ["mehrere", { grund: "mehrere", datei: "", kampf: null }], ["leer", { grund: "leer", datei: "", kampf: null }],
                                       // ein Kampf aus dem Archiv (#264): nur in der Vollansicht, der Streifen holt keine Datei
                                       ["archiv", { grund: "archiv", datei: "", kampf: null }]]) {
        const s = await oeffne({ zwei: true, kfenster: true, lang, dateien: {}, folgt: true, breite: 300, hoehe: 28, config: { randlosGesehen: true }, kompakt });
        const p = s.page;
        await warte(p, (t) => document.querySelector("#compactIdle").textContent === t, SATZ[lang][grund], 5000);
        await bisDa(() => s.win.some((b) => b.do === "resize"));
        await ruhig();
        await gefolgt(s);
        /* Die Messwerte stehen vorn in der FAIL-Zeile (Issue #167: unter Last
           zweimal rot, ohne Zahlen): Breite des Satzes und seines Kastens, die
           Breite der Seite gegen das Fenster, das Fenster selbst und die
           letzten Groessen, um die der Streifen bat. */
        const z = await p.evaluate(() => { const e = document.querySelector("#compactIdle"), r = e.getBoundingClientRect();
          const t = document.createRange(); t.selectNodeContents(e);
          const satz = t.getBoundingClientRect().width, sw = document.documentElement.scrollWidth;
          return { mass: { satz: +satz.toFixed(2), kasten: +r.width.toFixed(2), sw, iw: innerWidth, ih: innerHeight },
                   ganz: satz <= r.width + 0.5, quer: sw > innerWidth, ruht: document.body.classList.contains("noFight"),
                   sichtbar: e.getClientRects().length > 0, text: e.textContent, title: e.title }; });
        assert(z.ruht && z.sichtbar && z.text === SATZ[lang][grund] && z.ganz && !z.quer && z.title.length > z.text.length,
          `${lang}, ${grund}: der Satz steht ganz im Streifen, der title sagt mehr`,
          { mass: z.mass, fenster: p.viewportSize(), bitten: s.win.filter((b) => b.do === "resize").slice(-3).map((b) => [b.art || "", b.w, b.h]),
            offen: s.groesseOffen, ganz: z.ganz, quer: z.quer, ruht: z.ruht, sichtbar: z.sichtbar, text: z.text, title: z.title.length });
        assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
        if (grund === "archiv") assert(!s.logs.length, `${lang}, archiv: der Streifen fragt keine Datei (kein GET /api/log)`, s.logs);
        await p.close();
      }
    }
  }
  /* --- 24a. (#224) Der Satz kommt spaet: antwortet der Helfer auf /api/log erst nach der
     Nachmessung des Streifens (260 ms nach dem Umschalten), stand der Satz in einem Fenster,
     das nur fuer "Kein Log" gerechnet war ("File not in the log f..."). Ohne Kampf kehrt
     renderAll vor applyWindowSize um; der Satz muss das Fenster selbst neu messen lassen.
     Auf dem Runner kam das unter Last zufaellig (en/de, fremd, 3 von 30 Laeufen), hier ist
     die Antwort fest auf 900 ms gestellt. */
  for (const lang of ["en", "de"]) {
    const s = await oeffne({ zwei: true, kfenster: true, lang, dateien: {}, folgt: true, breite: 300, hoehe: 28, logVerzug: 900,
                             config: { randlosGesehen: true }, kompakt: { grund: "datei", datei: "Mitschnitt.txt", kampf: 1 } });
    const p = s.page;
    const satz = lang === "en" ? "File not in the log folder" : "Datei nicht im Log-Ordner";
    await warte(p, (t) => document.querySelector("#compactIdle").textContent === t, satz, 8000);
    await gefolgt(s);
    const ganz = () => p.evaluate(() => { const e = document.querySelector("#compactIdle"), r = e.getBoundingClientRect();
      const t = document.createRange(); t.selectNodeContents(e);
      return { satz: +t.getBoundingClientRect().width.toFixed(2), kasten: +r.width.toFixed(2), iw: innerWidth }; });
    let z = await ganz();
    /* auf den Zustand warten, nicht auf eine Zeit: das Fenster folgt, sobald der Streifen darum bittet */
    for (let i = 0; i < 60 && z.satz > z.kasten + 0.5; i++) { await new Promise((r) => setTimeout(r, 100)); z = await ganz(); }
    assert(z.satz <= z.kasten + 0.5, `${lang}, fremd, Antwort nach 900 ms: der spaete Satz steht ganz im Streifen, das Fenster hat nachgemessen (#224)`,
      { z, bitten: s.win.filter((b) => b.do === "resize").map((b) => [b.w, b.h]) });
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 25. Hoechstgroesse (Kompakt-Fix 2): auch von Hand gezogen meldet der
     Streifen seine gerechnete Groesse - nur als Grenze (art "hand"), aus
     der der Hauptprozess die Hoechstgroesse macht; die Groesse selbst bleibt
     die der Hand. */
  {
    const s = await oeffne({ zwei: true, kfenster: true, config: { randlosGesehen: true } });
    const p = s.page;
    await warte(p, () => document.body.classList.contains("compact"), undefined, 5000);
    await bisDa(() => s.win.some((b) => b.do === "resize"));
    await ruhig();
    s.zaehler.kompakthand++;
    await ruhig();
    const n = s.win.length;
    await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
    await warte(p, () => !document.body.classList.contains("noFight"), undefined, 5000);
    await bisDa(() => s.win.slice(n).some((b) => b.do === "resize" && b.art === "hand"));
    // das Beispiel kommt aus dem Menue: dessen Wachsen und Zurueck zaehlen hier nicht
    const r = s.win.slice(n).filter((b) => b.do === "resize" && b.art !== "menue" && b.art !== "zurueck");
    assert(r.length >= 1 && r.every((b) => b.art === "hand" && b.win === "kompakt") && r.at(-1).h > 100,
      "von Hand gezogen: der Streifen nennt seine Groesse nur als Grenze (art hand)", r);
    // die Antwort traegt die Hoehe der Hand: das ist keine "nicht uebernommene" Groesse
    const mm = await meldung(s);
    assert(!mm.an || !/did not apply/.test(mm.text), "von Hand gezogen: keine Meldung, Windows habe die Groesse nicht uebernommen", mm);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 26. das Menue im Streifen ist ganz zu sehen (Befund 01.10.): es lag
     im 28 Punkt hohen Streifen und war abgeschnitten. Das Fenster waechst,
     solange es offen ist (resize mit art "menue"), und kehrt beim Schliessen
     zurueck (art "zurueck"); dazwischen schickt der Streifen keine eigene
     Groesse. Leer und mit Kampf, EN und DE. */
  {
    for (const [lang, mitKampf] of [["en", false], ["de", true]]) {
      const s = await oeffne({ zwei: true, kfenster: true, lang, folgt: true, breite: 300, hoehe: 28, config: { randlosGesehen: true } });
      const p = s.page;
      await warte(p, () => document.body.classList.contains("compact"), undefined, 5000);
      if (mitKampf) {
        await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
        await warte(p, () => !document.body.classList.contains("noFight"), undefined, 5000);
        /* Das Fenster waechst mit dem Menue (innerHeight > 100 stimmt schon dann), geht beim Schliessen
           auf 28 zurueck und waechst erst danach mit dem Kampf (#224): auf das Ende der Groessen warten,
           dann auf die Hoehe, ehe gemessen wird. */
        await gefolgt(s);
        await bis(() => p.viewportSize().height > 100, "das Fenster hat die Hoehe des Streifens mit Kampf, Hoehe jetzt " + p.viewportSize().height);
        // das Beispiel kam aus dem Menue: es ging zu, waehrend der Kampf kam - danach der Streifen mit Kampf, nicht der leere
        assert(p.viewportSize().height > 100, "Beispiel aus dem Menue: danach hat das Fenster die Hoehe des Streifens mit Kampf", p.viewportSize());
      }
      await bisDa(() => s.win.some((b) => b.do === "resize"));
      await ruhig();
      await gefolgt(s);
      const vorher = p.viewportSize();
      const n = s.win.length;
      await p.click("#btnMore");
      await bisDa(() => s.win.slice(n).some((b) => b.do === "resize" && b.art === "menue"));
      await warte(p, () => { const q = document.querySelector("#morePanel"), r = q.getBoundingClientRect();
        return !q.hidden && r.bottom <= innerHeight && q.scrollHeight <= q.clientHeight + 1; }, undefined, 5000, "das Menue offen und ganz im Fenster");
      const m = await p.evaluate(() => { const q = document.querySelector("#morePanel"), r = q.getBoundingClientRect();
        // was im Menue zu sehen ist, bis zum letzten Satz ("... in der Vollansicht")
        const teile = [...q.querySelectorAll("*")].filter((x) => x.getClientRects().length);
        const letzte = { bottom: teile.length ? Math.max(...teile.map((x) => x.getBoundingClientRect().bottom)) : Infinity };
        return { offen: !q.hidden, unten: r.bottom, rechts: r.right, links: r.left, ih: innerHeight, iw: innerWidth,
                 rollt: q.scrollHeight > q.clientHeight + 1, letzte: letzte.bottom }; });
      assert(m.offen && m.unten <= m.ih && m.rechts <= m.iw && m.links >= 0 && !m.rollt && m.letzte <= m.ih,
        `${lang}${mitKampf ? ", mit Kampf" : ", leer"}: das Menue ist ganz zu sehen, ohne zu rollen`, m);
      const menue = s.win.slice(n).filter((b) => b.do === "resize");
      assert(menue.length === 1 && menue[0].art === "menue" && menue[0].win === "kompakt" && menue[0].h > vorher.height,
        "das Fenster waechst fuer das Menue (resize, art menue)", menue);
      // offen: ein Neuzeichnen (Thema) schickt keine eigene Groesse
      const k = s.win.length;
      await p.evaluate(() => document.querySelector('#themeRow button[data-theme="light"]').click());
      await ruhig();
      assert(!s.win.slice(k).some((b) => b.do === "resize"), "solange das Menue offen ist, bleibt die Groesse", s.win.slice(k));
      // zu: zurueck auf die Groesse davor
      await p.keyboard.press("Escape");
      await bisDa(() => s.win.slice(k).some((b) => b.do === "resize" && b.art === "zurueck"));
      await warte(p, (h) => innerHeight === h, vorher.height, 5000);
      assert(s.win.slice(k).some((b) => b.do === "resize" && b.art === "zurueck") && p.viewportSize().height === vorher.height
        && await p.evaluate(() => document.querySelector("#morePanel").hidden),
        "Menue zu: das Fenster kehrt auf seine Groesse zurueck", { zurueck: s.win.slice(k), jetzt: p.viewportSize(), vorher });
      // das Fenster verliert den Fokus (ein Klick ins Spiel): das Menue geht zu, das Fenster zurueck
      const mn = s.win.filter((b) => b.art === "menue").length;
      await p.click("#btnMore");
      // mindestens eine Bitte: unter Last misst der Streifen das Menue ein zweites Mal nach, bevor die Probe nachsieht (#224)
      await bisDa(() => s.win.filter((b) => b.art === "menue").length >= mn + 1);
      const j = s.win.length;
      await p.evaluate(() => window.dispatchEvent(new Event("blur")));
      await bisDa(() => s.win.slice(j).some((b) => b.art === "zurueck"));
      assert(await p.evaluate(() => document.querySelector("#morePanel").hidden) && s.win.slice(j).some((b) => b.art === "zurueck"),
        "Klick ins Spiel (blur): das Menue geht zu, das Fenster zurueck", s.win.slice(j));
      // zurueck ist draussen (oben); danach misst sich der Streifen noch einmal - bis er seiner Groesse gefolgt ist
      await gefolgt(s);
      /* Das Menue wird hoeher, nachdem es gemessen wurde (im echten Fenster
         bei 200 % Skalierung rollte es um ein paar Punkt): nachgemessen
         bittet der Streifen um so viel mehr. Hier macht ein Stil, gesetzt
         gleich nach dem Oeffnen, jeden Satz darin 24 Punkt hoeher. */
      await ruhig();
      const mn2 = s.win.filter((b) => b.art === "menue").length;
      await p.evaluate(() => { document.querySelector("#btnMore").click();
        const st = document.createElement("style"); st.id = "probe-menue";
        st.textContent = "#morePanel .seenote{padding-bottom:24px !important}"; document.head.append(st); });
      await bisDa(() => s.win.filter((b) => b.art === "menue").length >= mn2 + 2);
      await warte(p, () => { const q = document.querySelector("#morePanel");
        return !q.hidden && q.scrollHeight <= q.clientHeight + 1 && q.getBoundingClientRect().bottom <= innerHeight; }, undefined, 5000,
        "das hoeher gewordene Menue ganz im Fenster");
      const m2 = await p.evaluate(() => { const q = document.querySelector("#morePanel");
        return { rollt: q.scrollHeight > q.clientHeight + 1, unten: q.getBoundingClientRect().bottom, ih: innerHeight }; });
      assert(s.win.filter((b) => b.art === "menue").length === mn2 + 2 && !m2.rollt && m2.unten <= m2.ih,
        "das Menue wurde nach dem Messen hoeher: nachgemessen, das Fenster waechst noch einmal, nichts rollt", { m2, win: s.win.slice(-3) });
      const z0 = s.win.length;
      await p.evaluate(() => { document.querySelector("#probe-menue").remove(); document.querySelector("#btnMore").click(); });
      await bis(() => s.win.slice(z0).some((b) => b.art === "zurueck"), () => "zurueck nach dem Schliessen (am Ende), seither: " + JSON.stringify(s.win.slice(z0)));
      assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
      await p.close();
    }
  }
  /* --- 27. Durchsicht im Kompaktfenster (Nachtrag 01.10.): beim
     Overlay-Test waren mit Durchsicht auch Zeilen, Symbole und Namen
     durchsichtig. DESIGN.md: Durchsicht bestimmt nur, wie viel vom Spiel
     durch den Grund scheint; auf Acrylic toent sie die Flaeche, das Fenster
     bleibt deckend. Hier startet der Streifen mit einer gemerkten
     Durchsicht (55), und /api/state - das sagt, ob Acrylic da ist - kommt
     nach /api/config. Das ist ein Schutz: der Hauptprozess liefert die
     Durchsicht heute nicht ueber /api/config; im echten Fenster prueft
     test-window den Streifen selbst. Ohne Acrylic gilt der Rueckfall wie
     bisher: das ganze Fenster blendet ab. */
  {
    const deckung = (p) => p.evaluate(() => {
      const eff = (el) => { let o = 1; for (let x = el; x && x.nodeType === 1; x = x.parentElement) o *= Number(getComputedStyle(x).opacity); return o; };
      const zeile = document.querySelector("#bars .row:not(.sub)");
      const teile = zeile ? [zeile, ...zeile.querySelectorAll("img, .nm, .nmt, .v, .num, i")].filter((x) => x.getClientRects().length) : [];
      return { teile: teile.length, min: teile.length ? Math.min(...teile.map(eff)) : 0, dps: eff(document.querySelector("#hDps")),
               glass: document.documentElement.style.getPropertyValue("--glass-a"), acrylic: document.documentElement.classList.contains("acrylic"),
               grund: getComputedStyle(document.body).backgroundColor };
    });
    const s = await oeffne({ zwei: true, kfenster: true, stateVerzug: 400, config: { randlosGesehen: true, compactAlpha: 0.45 } });
    const p = s.page;
    await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
    await warte(p, () => !document.body.classList.contains("noFight") && document.querySelectorAll("#bars .row").length > 0, undefined, 5000);
    await ruhig();
    const d = await deckung(p);
    const alphas = s.win.filter((b) => b.do === "seethrough").map((b) => b.alpha);
    assert(d.acrylic && d.glass === "0.100" && /rgba\(.*0\.1\)/.test(d.grund), "Acrylic, Durchsicht 55: nur der Grund ist getoent (--glass-a .10, #328)", d);
    assert(alphas.length > 0 && Math.abs(alphas.at(-1) - 0.7) < 1e-9 && alphas.every((a) => a >= 0.7 - 1e-9),
      "Acrylic, Durchsicht 55: das Fenster blendet zusaetzlich auf .70 ab (#348), nie darunter, auch beim Start", alphas);
    assert(d.teile >= 3 && d.min === 1 && d.dps === 1, "Acrylic, Durchsicht 55: Zeilen, Namen, Symbole und die Zahl haben Deckkraft 1", d);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
    // Rueckfall ohne Acrylic: das Fenster blendet ab, wie bisher
    const r = await oeffne({ zwei: true, kfenster: true, acrylic: false, stateVerzug: 400, config: { randlosGesehen: true, compactAlpha: 0.45 } });
    await bisDa(() => r.win.some((b) => b.do === "seethrough"));
    await ruhig();
    const ra = r.win.filter((b) => b.do === "seethrough").map((b) => b.alpha);
    assert(ra.length > 0 && Math.abs(ra.at(-1) - 0.45) < 1e-9, "ohne Acrylic: der Rueckfall wie bisher, das Fenster blendet auf .45 ab", ra);
    await r.page.close();
  }
  /* --- 28. Gutachten H1: was im leeren Streifen (28 Punkt, Grenze 56)
     ueber ihm aufgeht, ist ganz zu sehen und zu treffen - per echtem Klick,
     gemessen mit elementFromPoint: das Menue bis zum untersten Satz, ein
     Dialog (hier die Frage nach dem Log-Ordner) mit beiden Knoepfen,
     die Meldung beim ersten Mal (Randlos-Hinweis) mit ihrem Knopf. Danach
     ist das Fenster wieder der Streifen. Die Kampfwahl gibt es im Streifen
     nicht (Abschnitt 12). */
  {
    const trifft = (p, sel) => p.evaluate((q) => {
      const els = [...document.querySelectorAll(q)].filter((x) => x.getClientRects().length);
      const el = els.length ? els.reduce((a, b) => (b.getBoundingClientRect().bottom > a.getBoundingClientRect().bottom ? b : a)) : null;
      if (!el) return { da: false };
      const r = el.getBoundingClientRect(), x = r.left + Math.min(r.width / 2, 20), y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { da: true, trifft: !!hit && (el === hit || el.contains(hit)), unten: r.bottom, ih: innerHeight };
    }, sel);
    // das Menue, per echtem Klick
    const s = await oeffne({ zwei: true, kfenster: true, folgt: true, breite: 300, hoehe: 28, config: { randlosGesehen: true } });
    const p = s.page;
    await bisDa(() => s.win.some((b) => b.do === "resize"));
    await ruhig();
    await gefolgt(s);
    await p.click("#btnMore");
    await warte(p, () => innerHeight > 100, undefined, 5000);
    await ruhig();
    const m = await trifft(p, "#morePanel > *");
    assert(m.da && m.trifft && m.unten <= m.ih, "Menue per Klick: der unterste Eintrag ist zu sehen und zu treffen (elementFromPoint)", m);
    await p.keyboard.press("Escape");
    await warte(p, () => innerHeight === 36, undefined, 5000);
    // der Dialog: Live ohne Log-Ordner fragt nach dem Ordner
    /* Live ist im Streifen ausgeblendet, kein Knopf dort oeffnet heute
       einen Dialog. Ausgeloest wird er hier ueber den verborgenen Knopf, um
       zu zeigen: kommt doch einer (etwa ueber ein Kuerzel), bekommt er Platz. */
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await warte(p, () => document.querySelector("#modalBg").classList.contains("on"), undefined, 5000);
    await warte(p, () => innerHeight > 100, undefined, 5000);
    await ruhig();
    const ok = await trifft(p, "#modalOk"), ab = await trifft(p, "#modalCancel"), feld = await trifft(p, "#modalInput");
    assert(ok.trifft && ab.trifft && feld.trifft && ok.unten <= ok.ih, "Dialog im Streifen: Feld, OK und Abbrechen sind zu sehen und zu treffen", { ok, ab, feld });
    await p.click("#modalCancel");
    await warte(p, () => innerHeight === 36, undefined, 5000);
    assert(p.viewportSize().height === 36 && s.win.filter((b) => b.art === "zurueck").length === 2,
      "Dialog zu: das Fenster ist wieder der Streifen", { v: p.viewportSize(), arten: s.win.map((b) => b.art || b.do) });
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
    // die Meldung beim ersten Mal, im leeren Streifen
    const t = await oeffne({ zwei: true, kfenster: true, folgt: true, breite: 300, hoehe: 28, config: { randlosGesehen: false } });
    await warte(t.page, () => document.querySelector("#toast").classList.contains("on"), undefined, 5000);
    await warte(t.page, () => innerHeight > 40, undefined, 5000);
    await ruhig();
    const k = await trifft(t.page, "#toast .tact");
    assert(k.trifft && k.unten <= k.ih, "Meldung im leeren Streifen: ganz zu sehen, ihr Knopf zu treffen", k);
    await t.page.click("#toast .tact").catch((e) => assert(false, "Zeitablauf beim Klick auf #toast .tact", String(e).split("\n")[0]));
    await warte(t.page, () => innerHeight === 36, undefined, 5000);
    assert(t.page.viewportSize().height === 36, "Meldung weg: das Fenster ist wieder der Streifen", t.page.viewportSize());
    await t.page.close();
  }
  /* --- 29. Gutachten M1, M3, N3, N4, N6: der Streifen sagt, wenn er der
     Vollansicht nicht folgen kann, statt still einen alten oder anderen
     Kampf zu zeigen. */
  {
    const SATZ = { fremd: "File not in the log folder", beispiel: "Sample: full view only", mehrere: "Several files: full view only",
                   andere: "Not a game log: full view only", kampf: "Fight not found in the file", fehler: "Log folder not readable right now",
                   leer: "No log" };
    const dateien = { [LOGNAME]: LOG2 };
    const s = await oeffne({ zwei: true, kfenster: true, dateien, config: { randlosGesehen: true },
                             kompakt: { grund: "datei", datei: LOGNAME, kampf: START[0] } });
    const p = s.page;
    const ruhe = () => p.evaluate(() => ({ ruht: document.body.classList.contains("noFight"), text: document.querySelector("#compactIdle").textContent,
      sichtbar: document.querySelector("#compactIdle").getClientRects().length > 0, title: document.querySelector("#compactIdle").title }));
    const stand = async (k) => { Object.assign(s.kompakt, k); s.zaehler.kompaktstand++; };
    const mitKampf = () => warte(p, () => !document.body.classList.contains("noFight"), undefined, 8000);
    await mitKampf();
    // M1: von einer Datei zu fremd, mehrere, Beispiel, kein Log, leer - der Kampf geht, der Satz kommt
    for (const [grund, k] of [["fremd", { grund: "datei", datei: "Mitschnitt.txt", kampf: 1 }], ["mehrere", { grund: "mehrere", datei: "", kampf: null }],
                              ["beispiel", { grund: "beispiel", datei: "", kampf: null }], ["andere", { grund: "andere", datei: "", kampf: null }],
                              ["leer", { grund: "leer", datei: "", kampf: null }]]) {
      await stand({ grund: "datei", datei: LOGNAME, kampf: START[0] });
      await mitKampf();
      await stand(k);
      await warte(p, (t) => document.body.classList.contains("noFight") && document.querySelector("#compactIdle").textContent === t, SATZ[grund], 5000);
      const z = await ruhe();
      assert(z.ruht && z.sichtbar && z.text === SATZ[grund], `M1: Datei, dann ${grund} - der Streifen zeigt keinen alten Kampf, sondern den Satz`, z);
    }
    // M3: der Start steht nicht in der Datei - kein anderer Kampf, ein eigener Satz
    await stand({ grund: "datei", datei: LOGNAME, kampf: START[0] });
    await mitKampf();
    await stand({ grund: "datei", datei: LOGNAME, kampf: START[0] + 12345 });
    await warte(p, (t) => document.body.classList.contains("noFight") && document.querySelector("#compactIdle").textContent === t, SATZ.kampf, 5000);
    const k3 = await ruhe();
    assert(k3.ruht && k3.text === SATZ.kampf && k3.title.length > k3.text.length, "M3: Kampf nicht gefunden - der Satz statt eines anderen Kampfs", k3);
    // M3: die Datei ist gewachsen, der neue Kampf steht erst in der frischen - einmal neu geholt
    await stand({ grund: "datei", datei: LOGNAME, kampf: START[0] });
    await mitKampf();
    // erst wenn die Seite den vorigen Zaehler gelesen hat und ruht: sonst holt sie auch dafuer noch einmal (#224)
    await ereignisseGelesen(s, "vor M3");
    await stille(s, "vor M3");
    const geholt = s.logs.filter((x) => x === LOGNAME).length;
    dateien[LOGNAME] = LOG3;
    await stand({ grund: "datei", datei: LOGNAME, kampf: START[2] });
    await bisDa(() => s.logs.filter((x) => x === LOGNAME).length > geholt);
    await mitKampf();
    await stille(s, "M3: Datei geholt");
    const g = await p.evaluate(() => ({ ruht: document.body.classList.contains("noFight"), name: document.querySelector("#hName")?.textContent || "" }));
    assert(s.logs.filter((x) => x === LOGNAME).length === geholt + 1 && !g.ruht, "M3: Datei gewachsen - einmal frisch geholt, der neue Kampf steht da", { g, logs: s.logs.length });
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
    // N3: der Helfer konnte nicht lesen (500) - nicht "nicht im Log-Ordner"
    const f = await oeffne({ zwei: true, kfenster: true, dateien: { [LOGNAME]: 500 }, config: { randlosGesehen: true },
                             kompakt: { grund: "datei", datei: LOGNAME, kampf: START[0] } });
    await warte(f.page, (t) => document.querySelector("#compactIdle").textContent === t, SATZ.fehler, 5000);
    const fz = await f.page.evaluate(() => document.querySelector("#compactIdle").textContent);
    assert(fz === SATZ.fehler, "N3: Lesefehler des Helfers - eigener Satz, nicht \"nicht im Log-Ordner\"", fz);
    await f.page.close();
    // N4 und N6 in der Vollansicht: abgelehnter Stand wird wiederholt; eine Datei, die kein Log ist, heisst "andere"
    const work = mkdtempSync(join(tmpdir(), "boro-andere-"));
    try {
      const csv = join(work, "tabelle.csv"), log = join(work, LOGNAME);
      writeFileSync(csv, LOG2); writeFileSync(log, LOG2);
      const v = await oeffne({ zwei: true, config: { randlosGesehen: true } });
      const staende = () => v.win.filter((b) => b.do === "stand");
      await v.page.setInputFiles("#fileInput", log);
      await dateiDa(v, "Datei geladen");
      v.standNein = 1;
      await v.page.click("#btnCompact");
      await bisDa(() => v.win.some((b) => b.do === "kompakt"));
      // erst wenn der Streifen aus Sicht der Seite offen ist (Wettlauf N4, Fix 04.10.)
      await warte(v.page, () => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", undefined, 5000);
      await bisDa(() => staende().length > 1);
      const n = staende().length;
      await v.page.evaluate(() => document.querySelector('#themeRow button[data-theme="light"]').click());
      await ruhig();
      assert(n === 2 && staende().length === 2 && staende()[1].datei === LOGNAME,
        "N4: der Hauptprozess lehnte den Stand ab - sobald der Streifen offen ist, geht er noch einmal, danach nicht wieder", staende());
      await v.page.setInputFiles("#fileInput", csv);
      await bisDa(() => staende().at(-1)?.grund === "andere");
      assert(staende().at(-1)?.grund === "andere" && staende().at(-1)?.datei === "", "N6: eine Datei, die kein .txt/.log ist - Grund andere, ohne Namen", staende().at(-1));
      await v.page.close();
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  /* --- 30. Durchklickbar heisst 40 % durchsichtig (Spezifikation
     Kompakt-Fenster 2): mit Acrylic toent der Grund (0,724), ohne blendet
     das Fenster auf 0,6, mit Geist nie unter 0,75; der Regler und
     compactAlpha bleiben, wie sie waren. */
  {
    const glas = (p) => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--glass-a").trim());
    const pille = (p) => p.evaluate(() => ({ da: !document.querySelector("#seePille").hidden, text: document.querySelector("#seePilleText").textContent,
      regler: document.querySelector("#seeSlide").value }));
    const kuerzel = async (s, an) => {
      s.zaehler.hotkey++;
      await warte(s.page, (a) => document.body.classList.contains("through") === a, an, 5000);
      await stille(s, "Durchklick " + (an ? "an" : "aus")); await steht(s.page, "Durchklick " + (an ? "an" : "aus"));
    };
    // mit Acrylic, Regler 0
    {
      const s = await oeffne({ zwei: true, kfenster: true, config: { randlosGesehen: true, compactAlpha: 1 } });
      await warte(s.page, () => document.body.classList.contains("compact"), undefined, 5000);
      await stille(s, "Streifen offen"); await steht(s.page, "Streifen offen");
      const vorher = await glas(s.page);
      await kuerzel(s, true);
      const an = { glas: await glas(s.page), pille: await pille(s.page), alpha: s.win.filter((b) => b.do === "seethrough").at(-1)?.alpha };
      assert(vorher === "0.500" && an.glas === "0.209" && an.pille.da && an.pille.text === "40\u00a0%" && an.pille.regler === "0" && Math.abs(an.alpha - 0.782) < 1e-9,
        "30 Acrylic: Durchklick toent den Grund auf 0,209 (Regler 40, #328), die Pille sagt 40 %, der Regler bleibt 0, das Fenster blendet auf .782 ab (#348)", { vorher, an });
      assert(!s.posts.some((p) => "compactAlpha" in p), "30: der Durchklick schreibt compactAlpha nicht", s.posts);
      await kuerzel(s, false);
      const aus = { glas: await glas(s.page), pille: await pille(s.page) };
      assert(aus.glas === "0.500" && !aus.pille.da, "30: Durchklick aus, wieder der Regler (0,500, keine Pille)", aus);
      await s.page.close();
    }
    // Regler 50: der Regler gilt
    {
      const s = await oeffne({ zwei: true, kfenster: true, config: { randlosGesehen: true, compactAlpha: 0.5 } });
      await warte(s.page, () => document.body.classList.contains("compact"), undefined, 5000);
      await stille(s, "Streifen offen"); await steht(s.page, "Streifen offen");
      await kuerzel(s, true);
      const g = await glas(s.page), pl = await pille(s.page);
      assert(g === "0.136" && pl.text === "50\u00a0%", "30: Regler 50 bleibt 50 im Durchklick (0,136)", { g, pl });
      await s.page.close();
    }
    // ohne Acrylic: das Fenster blendet auf 0,6
    {
      const s = await oeffne({ zwei: true, kfenster: true, acrylic: false, config: { randlosGesehen: true, compactAlpha: 1 } });
      await warte(s.page, () => document.body.classList.contains("compact"), undefined, 5000);
      await stille(s, "Streifen offen"); await steht(s.page, "Streifen offen");
      await kuerzel(s, true);
      const alpha = s.win.filter((b) => b.do === "seethrough").at(-1)?.alpha;
      assert(Math.abs(alpha - 0.6) < 1e-9, "30 ohne Acrylic: Durchklick blendet das Fenster auf 0,6", s.win.filter((b) => b.do === "seethrough"));
      await s.page.close();
    }
    // mit Geist: nie unter 0,75
    {
      const s = await oeffne({ zwei: true, kfenster: true, acrylic: false, config: { randlosGesehen: true, compactAlpha: 1, ghost: true } });
      await warte(s.page, () => document.body.classList.contains("compact"), undefined, 5000);
      await stille(s, "Streifen offen"); await steht(s.page, "Streifen offen");
      // der Geist zieht im Kompaktfenster nicht aus /api/config: den Knopf druecken (ohne Klick, er kann versteckt sein)
      if (!(await s.page.evaluate(() => document.body.classList.contains("ghost")))) await s.page.evaluate(() => document.querySelector("#btnGhost").click());
      await warte(s.page, () => document.body.classList.contains("ghost"), undefined, 5000);
      await kuerzel(s, true);
      const alpha = s.win.filter((b) => b.do === "seethrough").at(-1)?.alpha;
      assert(Math.abs(alpha - 0.75) < 1e-9, "30 mit Geist: der Durchklick geht nicht unter 0,75 (Boden)", s.win.filter((b) => b.do === "seethrough"));
      assert(alpha >= 0.75, "30 mit Geist: der Durchklick geht nicht unter 0,75", s.win.filter((b) => b.do === "seethrough"));
      await s.page.close();
    }
  }

  /* --- 31. Im Kampf und nach dem Kampf (Spezifikation Kompakt-Fenster 3):
     waechst der neueste Kampf, sagt die Lesezeile "Fight in progress" und
     der Vergleich wartet; nach der Kampftrennung (hier 3 s) ohne neue
     Zeilen wieder Satz und Vergleich. */
  {
    const vor = vulcanusLog([{ start: START[0], scale: 6.0 }]);
    const helfer = { dir: "C:\\Logs", file: LOGNAME, text: vor };
    const s = await oeffne({ zwei: true, kfenster: true, helfer, kompakt: { live: true }, config: { randlosGesehen: true, splitAfter: 3 } });
    const p = s.page;
    await warte(p, () => document.body.classList.contains("watching") && !document.body.classList.contains("noFight"), undefined, 8000);
    await nachTakt(s, "der Takt nach dem ersten Laden");
    const zeile = () => p.evaluate(() => ({ laeuft: document.body.classList.contains("kampf-laeuft"),
      lese: document.querySelector("#hCompact")?.textContent || "", prev: (() => { const e = document.querySelector("#hPrev"); return e && !e.hidden ? e.textContent : ""; })() }));
    const erst = await zeile();
    assert(!erst.laeuft && erst.lese !== "Fight in progress", "31: beim ersten Laden laeuft kein Kampf (er stand schon da)", erst);
    // ein zweiter Pull waechst Stueck fuer Stueck
    const voll = vulcanusLog([{ start: START[0], scale: 6.0 }, { start: START[1], scale: 7.0 }]);
    const zeilen = voll.split("\n");
    const ab = vor.split("\n").length - 1;
    helfer.text = zeilen.slice(0, ab + 20).join("\n") + "\n";
    await warte(p, () => document.body.classList.contains("kampf-laeuft"), undefined, 6000);
    const imKampf = await zeile();
    assert(imKampf.laeuft && imKampf.lese === "Fight in progress" && imKampf.prev === "",
      "31: der Kampf waechst - \"Fight in progress\", der Vergleich wartet", imKampf);
    // keine neuen Zeilen: nach 3 s Trennung "nach dem Kampf"
    await warte(p, () => !document.body.classList.contains("kampf-laeuft"), undefined, 8000);
    const nach = await zeile();
    assert(!nach.laeuft && nach.lese && nach.lese !== "Fight in progress" && /vs\. last pull$/.test(nach.prev),
      "31: nach der Trennung - Satz in der Lesezeile, Vergleich unter der Zahl", nach);
    // Live beenden, waehrend der Kampf laeuft: der Zustand geht sofort, nicht erst mit dem Wecker
    {
      helfer.text = zeilen.slice(0, ab + 40).join("\n") + "\n";
      await warte(p, () => document.body.classList.contains("kampf-laeuft"), undefined, 6000);
      const lief = await zeile();
      await p.evaluate(() => document.querySelector("#btnWatch").click());
      // "sofort": vor dem Wecker der Kampftrennung (3 s) - die Frist ist Teil der Pruefung, wie vorher die Pause
      await warte(p, () => !document.body.classList.contains("kampf-laeuft"), undefined, 1000, "kampf-laeuft geht mit dem Beenden", true);
      const aus = await zeile();
      assert(lief.laeuft && !aus.laeuft && aus.lese !== "Fight in progress",
        "31: Live beenden mitten im Kampf - \"Fight in progress\" geht sofort", { lief, aus });
    }
    assert(!s.fehler.length, "31: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  /* --- 32. Live im Streifen (#158, #161): ein Punkt vor Uhrzeit \u00b7 Dauer in
     --gold-ink, gestoert ein Ring, ohne Live keiner; kein Rahmen ums
     Fenster und kein Band im Streifen; die Datei im title. */
  {
    const text = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
    const helfer = { dir: "C:\\Logs", file: "TLCombatLog-20260925.txt", text };
    const s = await oeffne({ zwei: true, kfenster: true, helfer, kompakt: { live: true }, config: { randlosGesehen: true } });
    const p = s.page;
    await warte(p, () => document.body.classList.contains("watching") && !document.body.classList.contains("noFight"), undefined, 8000);
    const punkt = () => p.evaluate(() => {
      const m = document.querySelector("#hMeta"), b = getComputedStyle(m, "::before");
      const probe = document.createElement("span"); probe.style.color = document.documentElement.dataset.theme === "light" ? "#6d3c00" : "var(--gold-ink)"; document.body.append(probe);
      const gold = getComputedStyle(probe).color; probe.remove();
      return { inhalt: b.content, breite: b.width, grund: b.backgroundColor, rand: b.borderTopColor, gold, title: m.title,
        rahmen: getComputedStyle(document.body, "::after").display, band: document.querySelector("#watchPop").getClientRects().length };
    });
    const an = await punkt();
    assert(an.inhalt !== "none" && an.breite === "6px" && an.grund === an.gold && an.title === "Live \u00b7 TLCombatLog-20260925.txt",
      "32: Live - ein 6-Punkt-Punkt in --gold-ink vor Uhrzeit \u00b7 Dauer, die Datei im title", an);
    assert(an.rahmen === "none" && an.band === 0, "32: kein Rahmen ums Fenster und kein Band im Streifen (#161)", an);
    await p.evaluate(() => document.body.classList.add("livestoer"));
    const st = await punkt();
    assert(st.inhalt !== "none" && st.grund === "rgba(0, 0, 0, 0)" && st.rand !== "rgba(0, 0, 0, 0)", "32: gestoert - ein Ring statt des Punkts", st);
    await p.evaluate(() => { document.body.classList.remove("livestoer"); document.body.classList.remove("watching"); });
    const aus = await punkt();
    assert(aus.inhalt === "none" || aus.breite === "auto" || aus.breite === "0px", "32: ohne Live kein Punkt", aus);
    await p.close();
  }
  /* --- 33. Mausrad statt "+N weitere" (#160, #287, #328): im Kompaktfenster rollt das Rad die Liste, das Fenster behaelt seine Hoehe;
     die Vollansicht oeffnet es nicht. */
  {
    const s = await oeffne({ zwei: true, kfenster: true, folgt: true, config: { randlosGesehen: true } });
    const p = s.page;
    await warte(p, () => document.body.classList.contains("compact"), undefined, 5000);
    await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
    await warte(p, () => { const b = document.querySelector("#kRest"); return b && !b.hidden; }, undefined, 6000);
    await p.keyboard.press("Escape");
    // die Meldung "Escape noch einmal" steht zwei Sekunden im Fluss; die Hoehe ohne sie ist die Messlatte
    await warte(p, () => !document.querySelector("#toast").classList.contains("on"), undefined, 6000);
    await gefolgt(s);
    const zeilen = () => p.evaluate(() => [...document.querySelectorAll("#bars .row:not(.sub)")].filter((z) => z.getClientRects().length).length);
    const h0 = p.viewportSize().height;
    const ganz = () => p.evaluate(() => { const b = document.querySelector("#bars").getBoundingClientRect();
      return [...document.querySelectorAll("#bars .row:not(.sub)")].filter((z) => { const q = z.getBoundingClientRect(); return q.top >= b.top - 1 && q.bottom <= b.bottom + 1; }).length; });
    assert(await zeilen() >= 12 && await ganz() === 5, "33: fuenf ganze Zeilen und der Hinweis, die uebrigen liegen zum Rollen darunter", { zeilen: await zeilen(), ganz: await ganz() });
    const n0 = s.win.length;
    await p.mouse.move(150, 200);
    await p.mouse.wheel(0, 9000);
    await warte(p, () => { const b = document.querySelector("#bars"); return b.scrollTop > 0 && b.scrollTop >= b.scrollHeight - b.clientHeight - 1; });
    await gefolgt(s);
    assert(await ganz() === 5 && p.viewportSize().height === h0 && s.win.slice(n0).every((b) => b.h === undefined || b.h === h0),
      "33: das Mausrad rollt die Liste bis zur letzten Zeile, das Fenster bleibt so hoch wie vorher", { ganz: await ganz(), h0, h: p.viewportSize().height });
    assert(!s.win.some((b) => b.do === "kompakt" && b.on === false), "33: Rollen oeffnet nicht die Vollansicht", s.win.filter((b) => b.do === "kompakt"));
    await p.close();
  }
  /* --- 34. der erste Kampf eines frischen Logs (Abschlusspruefung, Minor 2):
     eine leere Datei, dann der erste Pull - die Lesezeile sagt noch im
     naechsten Takt "Fight in progress", nicht erst einen Takt spaeter. */
  {
    const helfer = { dir: "C:\\Logs", file: LOGNAME, text: "" };
    const s = await oeffne({ zwei: true, kfenster: true, helfer, kompakt: { live: true }, config: { randlosGesehen: true, splitAfter: 3 } });
    const p = s.page;
    await warte(p, () => document.body.classList.contains("watching"), undefined, 8000);
    await nachTakt(s, "der Takt nach dem leeren Log");
    const davor = await p.evaluate(() => document.body.classList.contains("kampf-laeuft"));
    helfer.text = vulcanusLog([{ start: START[0], scale: 6.0 }]).split("\n").slice(0, 40).join("\n") + "\n";
    await warte(p, () => document.body.classList.contains("kampf-laeuft"), undefined, 4500, "kampf-laeuft im naechsten Takt", true);
    const erst = await p.evaluate(() => ({ laeuft: document.body.classList.contains("kampf-laeuft"), lese: document.querySelector("#hCompact")?.textContent || "" }));
    assert(!davor && erst.laeuft && erst.lese === "Fight in progress",
      "34: der erste Kampf eines frischen, leeren Logs gilt gleich als laufend (kein Takt Verzug)", { davor, erst });
    assert(!s.fehler.length, "34: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 35. der Hinweis "+N weitere" im Einzelfenster (Minor 9, #287, #328): ohne zweites Fenster ist Kompakt derselbe Streifen im Hauptfenster;
     das Mausrad rollt die Liste und verlaesst Kompakt nicht. */
  {
    const s = await oeffne({ zwei: false, folgt: true, config: { randlosGesehen: true } });
    const p = s.page;
    await p.click("#btnCompact");
    await warte(p, () => document.body.classList.contains("compact"), undefined, 5000);
    await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
    await gefolgt(s);
    await p.setViewportSize({ width: 300, height: 700 });
    await warte(p, () => { const b = document.querySelector("#kRest"); return b && !b.hidden; }, undefined, 6000);
    const da = await p.evaluate(() => ({ kompakt: document.body.classList.contains("compact"), rest: !document.querySelector("#kRest").hidden }));
    assert(da.kompakt && da.rest, "35: im Einzelfenster-Kompakt steht der Hinweis bei mehr als sechs Zeilen", da);
    await p.mouse.move(150, 200);
    await p.mouse.wheel(0, 9000);
    await warte(p, () => { const b = document.querySelector("#bars"); return b.scrollTop > 0 && b.scrollTop >= b.scrollHeight - b.clientHeight - 1; }, undefined, 5000);
    const weg = await p.evaluate(() => document.body.classList.contains("compact"));
    assert(weg, "35: das Mausrad rollt die Liste und verlaesst Kompakt nicht", weg);
    assert(!s.fehler.length, "35: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 36. Wettlauf N4 (Fix 04.10.): der Hauptprozess antwortet spaet auf
     "kompakt". Was sich bis dahin am Stand aendert - ein abgelehnter Stand,
     ein anderer Kampf -, erfaehrt der Streifen, sobald er offen ist, nicht
     erst beim naechsten Zeichnen (das vielleicht nie kommt). */
  {
    const work = mkdtempSync(join(tmpdir(), "boro-wettlauf-"));
    try {
      const log = join(work, LOGNAME);
      writeFileSync(log, LOG2);
      for (const fall of ["abgelehnt", "kampfwechsel"]) {
        const v = await oeffne({ zwei: true, kompaktVerzug: 600, config: { randlosGesehen: true } });
        const staende = () => v.win.filter((b) => b.do === "stand");
        await v.page.setInputFiles("#fileInput", log);
        await dateiDa(v, "Datei geladen");
        if (fall === "abgelehnt") v.standNein = 1;
        await v.page.click("#btnCompact");
        await bisDa(() => v.win.some((b) => b.do === "kompakt"));
        const erster = staende()[0];
        // waehrend die Antwort unterwegs ist: ein aelterer Kampf
        if (fall === "kampfwechsel") await v.page.evaluate(() => document.querySelector("#kwVor").click());
        await warte(v.page, () => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", undefined, 5000);
        await bisDa(() => staende().length > 1, 3000);
        const z = staende().at(-1);
        if (fall === "abgelehnt")
          assert(staende().length === 2 && z.datei === LOGNAME && z.kampf === erster?.kampf,
            "Wettlauf N4: der Stand wurde abgelehnt, der Streifen ist offen - der Stand geht ohne neues Zeichnen noch einmal", staende());
        else
          assert(staende().length === 2 && z.datei === LOGNAME && Number.isSafeInteger(z.kampf) && z.kampf < erster?.kampf,
            "Wettlauf N4: Kampfwechsel, bevor der Streifen offen war - der neue Kampf geht hinaus, sobald er offen ist", staende());
        assert(!v.fehler.length, "keine Fehler auf der Seite", v.fehler);
        await v.page.close();
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
} catch (e) {
  failed++;
  console.log("  FAIL  " + (e && e.stack || e));
} finally {
  await browser.close();
}
if (failed) { console.log(`EXTRAS PAGE FAILED - ${failed}`); process.exit(1); }
console.log("EXTRAS PAGE PASSED");
