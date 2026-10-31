// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Dialog "Erinnerungen" der Weeklies an der gebauten Seite (Spezifikation
// docs/superpowers/specs/2026-10-06-weeklies-neu-design.md, 3.6 und 6): die
// Glocke im Kopf, der ehrliche Hinweis, anlegen, Wochentage (mindestens einer),
// Uhrzeit, Text, an/aus, nur wenn offen, lösen mit Rückgängig (nie endgültig),
// zwölf sind das Höchste, Escape und der Fokus, Deutsch und Englisch, 560 px
// ohne waagerechtes Rollen in allen vier Themen, und das Beantworten einer
// Anfrage des Hauptprozesses: genau {id, n}, nie ein Text.
//
// Kein Server: die Seite kommt vom gestellten Helfer (page.route), der
// /api/weeklies wie src/main/weeklies.ts beantwortet - jeder gesendete Stand
// geht durch das echte checkWeeklies() - und /api/erinnerung wie
// src/main/erinnerung.ts (offene Anfragen, naechste Zeiten, Antworten).
// Namen sind erfunden. Zeiten nur mit gestellter Uhr (Playwright page.clock).
//
// Run:  npm run test:erinnerung-page     (baut die Seite zuerst)
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import * as esbuild from "esbuild";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 700))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const DATEI = "file:///" + join(root, "dist", "renderer", "index.html").replace(/\\/g, "/").replace(/^\/+/, "");

const ordner = mkdtempSync(join(tmpdir(), "boro-erinpage-"));
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
const wk = await bundle("src/main/weeklies.ts", [electron]);
const kern = await bundle("src/renderer/weeklies-core.ts");
const dictMod = await esbuild.build({ stdin: { contents: 'export { I18N } from "./src/renderer/app/07-dictionary";', resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
const { I18N } = await import("data:text/javascript;base64," + Buffer.from(dictMod.outputFiles[0].text).toString("base64"));

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});
/* Mi 23.09.2026 09:55 in Berlin (Sommerzeit, UTC+2) */
const berlin = (tag, h, m = 0) => Date.UTC(2026, 8, tag, h - 2, m);
const MI_0955 = berlin(23, 9, 55);
const profil = (id, name, mehr = {}) => ({ id, name, zaehler: {}, aus: [], namen: {}, eigene: [], ...mehr });
const seitenUhr = (s) => s.uhr.basis + (performance.now() - s.uhr.echt);
/* Fristen mit performance.now(), nie mit Date.now(): auf den Linux-Runnern springt die Wanduhr um rund 8 s vor und zurueck, eine Frist nach
   Date.now() liefe dann sofort ab (#224, #337; nachstellen mit node --import ./scripts/uhrsprung.mjs). */
async function bis(fn, ms = 6000) {
  const ende = performance.now() + ms;
  while (performance.now() < ende) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
  return !!(await fn());
}
/* Wann hat die Seite eine Antwort des Helfers verarbeitet (#337)? Der Helfer weiss nur, wann er geantwortet hat; danach muss die Antwort noch zur
   Seite, und die Seite zeichnet den Dialog neu. Tippt die Probe schon vorher, kann das Neuzeichnen das Feld ersetzen, und die Eingabe geht verloren.
   (Zwei Bilder abwarten hilft nicht: mit page.clock ist requestAnimationFrame gestellt und nur ein kurzer Zeitgeber.)
   ruheSkript zaehlt in der Seite je Art ("GET /api/erinnerung"), wie viele Anfragen begonnen und wie viele fertig verarbeitet sind. Fertig heisst:
   die Antwort ist da, ein Lesen des Inhalts (json, text) ist abgeschlossen, und danach ist eine ganze Aufgabe der Seite vergangen; was die Seite in den
   Mikroaufgaben nach der Antwort tut (Zustand setzen, neu zeichnen), ist dann geschehen. Die eigene Aufgabe kommt aus einem MessageChannel, den die
   gestellte Uhr nicht anfasst.
   BORO_PROBE_VERZUG=<ms> haelt jede Antwort an /api/... vor der Seite so lange auf, nur zur Nachstellung von Last. */
const VERZUG = Math.max(0, Number(process.env.BORO_PROBE_VERZUG || 0) || 0);
function ruheSkript(verzug) {
  if (window.__boroRuhe) return;
  const ruhe = { begonnen: {}, fertig: {} };
  window.__boroRuhe = ruhe;
  const kanal = new MessageChannel(), schlange = [];
  kanal.port1.onmessage = () => { const f = schlange.shift(); if (f) f(); };
  const naechsteAufgabe = (f) => { schlange.push(f); kanal.port2.postMessage(0); };
  // ohne die gestellte Uhr: so oft eine eigene Aufgabe, bis die Zeit nach performance.now vergangen ist
  const echtWarten = (ms, f) => { const ende = performance.now() + ms; const w = () => (performance.now() >= ende ? f() : naechsteAufgabe(w)); naechsteAufgabe(w); };
  const art = (eingabe, init) => {
    try {
      const req = eingabe instanceof Request ? eingabe : null;
      const methode = String((init && init.method) || (req ? req.method : "GET")).toUpperCase();
      const pfad = new URL(req ? req.url : String(eingabe), location.href).pathname;
      return pfad.startsWith("/api/") ? methode + " " + pfad : null;
    } catch { return null; }
  };
  const echtFetch = window.fetch;
  window.fetch = function (eingabe, init) {
    const k = art(eingabe, init);
    const p = echtFetch.apply(this, arguments);
    if (!k) return p;
    ruhe.begonnen[k] = (ruhe.begonnen[k] || 0) + 1;
    let gelesen = false, gemeldet = false;
    const fertig = () => { if (gemeldet) return; gemeldet = true; naechsteAufgabe(() => { ruhe.fertig[k] = (ruhe.fertig[k] || 0) + 1; }); };
    const spaeter = verzug > 0
      ? p.then((r) => new Promise((ja) => echtWarten(verzug, () => ja(r))), (e) => new Promise((_, nein) => echtWarten(verzug, () => nein(e))))
      : p;
    return spaeter.then((r) => {
      // liest die Seite den Inhalt, ist sie erst nach dem Lesen fertig; sonst nach dieser Aufgabe
      for (const m of ["json", "text", "arrayBuffer", "blob"]) {
        const echt = r[m].bind(r);
        r[m] = () => { gelesen = true; const q = echt(); q.then(fertig, fertig); return q; };
      }
      naechsteAufgabe(() => { if (!gelesen) fertig(); });
      return r;
    }, (e) => { fertig(); throw e; });
  };
}
/* Wartet, bis die Seite von jeder Art in alle alles verarbeitet hat, was sie begonnen hat, und von jeder Art in mindestens wenigstens so viele. */
async function verarbeitet(page, alle, { mindestens = {}, ms = 8000 } = {}) {
  try {
    await page.waitForFunction(({ alle, mindestens }) => {
      const r = window.__boroRuhe;
      if (!r) return false;
      const f = (k) => r.fertig[k] || 0;
      return alle.every((k) => f(k) >= (r.begonnen[k] || 0)) && Object.entries(mindestens).every(([k, n]) => f(k) >= n);
    }, { alle, mindestens }, { timeout: ms, polling: 20 });
    return true;
  } catch { return false; }
}
/* Der gestellte Helfer: die Datei (data), die Anfragen und naechsten Zeiten des Hauptprozesses (erin), die Zaehler (counts) und alles, was die Seite
   an /api/erinnerung geschickt hat (antworten). */
const neuesLager = (data) => ({ data: structuredClone(data), posts: [], abgelehnt: [], erin: { anfragen: [], naechste: {} }, counts: {}, antworten: [],
  /* wie viele Posts der Helfer beantwortet hat */
  postFertig: 0 });
async function oeffne({ lang = "de", breite = 1280, hoehe = 860, lager, uhr = MI_0955, datei = false, thema = null, app = false } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const s = { page, fehler: [], lager, uhr: { basis: uhr, echt: performance.now() } };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.clock.install({ time: uhr });
  await page.addInitScript(ruheSkript, VERZUG);
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  if (datei) {
    await page.goto(DATEI);
    await page.waitForFunction(() => !!document.querySelector("#bereiche [data-tab=weeklies]"));
  } else {
    await page.route("http://boro.test/**", async (route) => {
      const req = route.request(), path = new URL(req.url()).pathname;
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
      if (path === "/api/weeklies" && req.method() === "GET") return json({ ok: true, data: lager.data });
      if (path === "/api/weeklies") {
        const b = JSON.parse(req.postData() || "{}");
        lager.posts.push(structuredClone(b.data));
        const echt = Date.now; Date.now = () => seitenUhr(s);
        let clean = null;
        try { clean = wk.checkWeeklies(b.data, lager.data); } finally { Date.now = echt; }
        if (!clean) { lager.abgelehnt.push(b.data); return json({ ok: false }, 400); }
        lager.data = clean;
        lager.postFertig = lager.posts.length;
        return json({ ok: true });
      }
      if (path === "/api/erinnerung" && req.method() === "GET") return json({ ok: true, anfragen: lager.erin.anfragen, naechste: lager.erin.naechste });
      if (path === "/api/erinnerung") { lager.antworten.push(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
      if (path === "/api/state") return json({ dir: "", file: "", nativeFrame: false, material: false, stayOnTop: false });
      if (path === "/api/config" && req.method() === "GET") return json(thema ? { theme: thema } : {});
      if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: lager.counts }); }
      if (path === "/api/builds" && req.method() === "GET") return json({ ok: true, builds: {} });
      if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
      if (path === "/api/plans" && req.method() === "GET") return json({ ok: true, plans: {} });
      if (path.startsWith("/api/")) return json({ ok: true });
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
    });
    await page.goto("http://boro.test/index.html" + (app ? "?win=1" : ""));
    await page.waitForFunction(() => !!document.body.dataset.bereit);
  }
  if (thema) await page.evaluate((k) => document.querySelector(`#themeRow button[data-theme="${k}"]`)?.click(), thema);
  await page.click('#bereiche [data-tab="weeklies"]');
  await page.waitForFunction(() => !document.querySelector("#weeklies").hidden);
  if (!datei) await page.waitForFunction(() => document.querySelector("#wkBody")?.dataset.lage === "da");
  return s;
}
const nPosts = (s) => s.lager.posts.length;
/* Auf das Speichern warten, und zwar auf das eigene: der Post ist beim Helfer angekommen UND beantwortet, und die Seite hat die Antwort verarbeitet.
   Danach fragt sie bei offenem Dialog /api/erinnerung (haken.gespeichert) und zeichnet ihn mit der Antwort neu; auch das muss geschehen sein (in der
   Seite gezaehlt, ruheSkript). Erst dann ist der Dialog ruhig: eine Eingabe davor kann in ein Feld gehen, das gleich ersetzt wird, und ginge
   verloren (#337). */
const nachPost = async (s, n) => {
  const l = s.lager;
  if (!(await bis(() => l.posts.length > n && l.postFertig === l.posts.length))) return false;
  return verarbeitet(s.page, ["POST /api/weeklies", "GET /api/erinnerung"], { mindestens: { "POST /api/weeklies": l.posts.length } });
};
/* Die Glocke oeffnet den Dialog; er fragt sofort /api/erinnerung und zeichnet sich mit der Antwort neu. Gewartet wird, bis die Seite sie verarbeitet hat. */
async function glocke(s) {
  await s.page.click("#wkGlocke");
  return verarbeitet(s.page, ["GET /api/erinnerung"]);
}
/* Kein Speichern erwarten: die Seite sendet entprellt (200 ms); die Uhr der Seite wird selbst weitergestellt, statt reale Zeit zu verstreichen, und
   ein Hin und Zurueck zum Helfer stellt sicher, dass ein gesendeter Post schon da waere. */
async function keinPost(s) {
  await s.page.clock.fastForward(500); s.uhr.basis += 500;
  await s.page.evaluate(() => fetch("/api/state").then((r) => r.ok));
}
const ansage = (p) => p.evaluate(() => document.querySelector("#wkAnsage")?.textContent || "");

try {
  const WOCHE = kern.GRUNDLISTE.filter((g) => g.takt !== "tag");
  const wocheVoll = (seit) => Object.fromEntries(WOCHE.map((g) => [g.schluessel, { stand: g.menge, seit }]));
  const data = { v: 1, profile: [
    profil("werin00001", "Eins", { zaehler: { zitadelleNormal: { stand: 1, seit: berlin(22, 20) } } }),
    profil("werin00002", "Zwei"),
    profil("werin00003", "Fertig", { zaehler: wocheVoll(berlin(21, 12)) }),
  ] };

  // ===== Glocke, Dialog, ehrlicher Hinweis, anlegen, bearbeiten, loesen
  {
    const el = neuesLager(data);
    const s = await oeffne({ lager: el, app: true });
    const p = s.page;
    const kopf = await p.evaluate(() => { const g = document.querySelector("#wkGlocke"); return { da: !!g && !g.hidden, text: g?.textContent, vh: g?.getAttribute("aria-label"), pop: g?.getAttribute("aria-haspopup") }; });
    assert(kopf.da && kopf.text === "Erinnerungen0" && kopf.vh === "Erinnerungen, 0 eingeschaltet" && kopf.pop === "dialog", "Glocke im Kopf: \u201eErinnerungen\u201c mit der Zahl der eingeschalteten", kopf);
    await glocke(s);
    const dlg = await p.evaluate(() => { const d = document.querySelector('#wkErinSchein [role="dialog"]'); return { da: !!d && !d.closest("[hidden]"), modal: d?.getAttribute("aria-modal"), fokusIn: !!d?.contains(document.activeElement),
      name: document.getElementById(d?.getAttribute("aria-labelledby") || "")?.textContent, hinweis: document.querySelector(".wkehrlich")?.textContent || "", knopfImHinweis: !!document.querySelector(".wkehrlich button") }; });
    assert(dlg.da && dlg.modal === "true" && dlg.fokusIn && dlg.name === "Erinnerungen", "Dialog: modal, mit Namen, der Fokus liegt darin", dlg);
    assert(/solange Borometer l\u00e4uft/.test(dlg.hinweis) && /Ortszeit/.test(dlg.hinweis) && /10:00 deutscher Zeit/.test(dlg.hinweis) && /Infobereich/.test(dlg.hinweis)
      && /nicht nachgeholt/.test(dlg.hinweis) && !/Im Browser gibt es keine/.test(dlg.hinweis) && !dlg.knopfImHinweis,
      "Hinweis, immer da: l\u00e4uft nur, solange Borometer l\u00e4uft (Infobereich), Ortszeit gegen den Reset in deutscher Zeit, nichts wird nachgeholt; im Fenster der App kein Browser-Satz", dlg.hinweis);
    // anlegen
    let n = nPosts(s);
    await p.click("[data-er-neu]");
    await nachPost(s, n);
    const e0 = el.data.erinnerungen?.[0];
    assert(e0 && /^e[0-9a-z]{9}$/.test(e0.id) && JSON.stringify(e0.tage) === "[2]" && e0.zeit === "18:00" && e0.nurOffen === true && e0.an === true && e0.geloest === undefined
      && e0.text === I18N.de["weeklies.erin.standard"] && !el.abgelehnt.length, "anlegen: Di 18:00, an, nur wenn offen, der Standardtext, die Datei nimmt es an", { e0, abg: el.abgelehnt.length });
    assert(/neue Erinnerung angelegt/i.test(await ansage(p)), "anlegen wird angesagt", await ansage(p));
    assert((await p.evaluate(() => document.querySelector("#wkGlocke").textContent)) === "Erinnerungen1", "die Glocke z\u00e4hlt eine eingeschaltete");
    // Wochentage: Mi dazu, Di weg; der letzte bleibt
    n = nPosts(s); await p.click('[data-er-tag="3"]'); await nachPost(s, n);
    assert(JSON.stringify(el.data.erinnerungen[0].tage) === "[2,3]" && /Mi dazu/.test(await ansage(p)), "Wochentag dazu: Mi, angesagt", el.data.erinnerungen[0].tage);
    n = nPosts(s); await p.click('[data-er-tag="2"]'); await nachPost(s, n);
    assert(JSON.stringify(el.data.erinnerungen[0].tage) === "[3]" && /Di weg/.test(await ansage(p)), "Wochentag weg: Di, angesagt", el.data.erinnerungen[0].tage);
    n = nPosts(s); await p.click('[data-er-tag="3"]'); await keinPost(s);
    assert(nPosts(s) === n && JSON.stringify(el.data.erinnerungen[0].tage) === "[3]", "der letzte Wochentag l\u00e4sst sich nicht abw\u00e4hlen", el.data.erinnerungen[0].tage);
    const pr = await p.evaluate(() => [...document.querySelectorAll("[data-er-tag]")].map((b) => b.getAttribute("aria-pressed")));
    assert(pr.length === 7 && pr.filter((x) => x === "true").length === 1, "Wochentage: sieben Knöpfe mit aria-pressed, einer gedrückt", pr);
    // Uhrzeit und Text
    n = nPosts(s); await p.fill("[data-er-zeit]", "19:30"); await nachPost(s, n);
    assert(el.data.erinnerungen[0].zeit === "19:30", "Uhrzeit: 19:30 gespeichert", el.data.erinnerungen[0].zeit);
    n = nPosts(s); await p.fill("[data-er-text]", "Weeklies: noch {n} offen"); await p.press("[data-er-text]", "Enter"); await nachPost(s, n);
    assert(el.data.erinnerungen[0].text === "Weeklies: noch {n} offen", "Text mit {n} gespeichert", el.data.erinnerungen[0].text);
    const maxl = await p.evaluate(() => document.querySelector("[data-er-text]").maxLength);
    assert(maxl === 120, "Text: h\u00f6chstens 120 Zeichen", maxl);
    n = nPosts(s); await p.fill("[data-er-text]", "   "); await p.press("[data-er-text]", "Enter"); await keinPost(s);
    assert(nPosts(s) === n && el.data.erinnerungen[0].text === "Weeklies: noch {n} offen", "ein leerer Text wird nicht \u00fcbernommen");
    n = nPosts(s); await p.click("[data-er-nur]"); await nachPost(s, n);
    assert(el.data.erinnerungen[0].nurOffen === false, "\u201eNur melden, wenn noch etwas offen ist\u201c l\u00e4sst sich ausschalten", el.data.erinnerungen[0].nurOffen);
    // naechste Zeit aus dem Hauptprozess; null heisst Strich
    el.erin.naechste = { [e0.id]: seitenUhr(s) + 5 * 24 * 3600000 + 3600000 };
    n = nPosts(s); await p.click("[data-er-an]"); await nachPost(s, n);
    assert(el.data.erinnerungen[0].an === false && /Erinnerung 19:30 aus/.test(await ansage(p)) && (await p.evaluate(() => document.querySelector("#wkGlocke").textContent)) === "Erinnerungen0",
      "ausschalten: an false, angesagt, die Glocke zählt 0", el.data.erinnerungen[0].an);
    n = nPosts(s); await p.click("[data-er-an]"); await nachPost(s, n);
    await bis(async () => /^N\u00e4chste: \S+ \d\d:\d\d \(in /.test((await p.evaluate(() => document.querySelector(".wkerin .vor span")?.textContent || ""))));
    const nxt = await p.evaluate(() => document.querySelector(".wkerin .vor span")?.textContent || "");
    assert(/^N\u00e4chste: \S+ \d\d:\d\d \(in /.test(nxt), "„Nächste: Tag Zeit (in …)“ kommt vom Hauptprozess, in Ortszeit", nxt);
    // loesen mit Rueckgaengig, nie endgueltig
    n = nPosts(s);
    await p.click("[data-er-los]");
    await nachPost(s, n);
    const lo = await p.evaluate(() => { const u = document.querySelector("[data-er-undo]"), d = document.getElementById(u?.getAttribute("aria-describedby") || "");
      return { undo: !!u, desc: d?.textContent || "", fokus: document.activeElement === u, zeilen: document.querySelectorAll("[data-er-zeile]").length }; });
    assert(el.data.erinnerungen.length === 1 && el.data.erinnerungen[0].geloest === true && lo.undo && /19:30 gel\u00f6st/.test(lo.desc) && lo.fokus && lo.zeilen === 0 && /gel\u00f6st/.test(await ansage(p)),
      "lösen: in der Datei bleibt sie mit geloest, die Zeile verschwindet, „Rückgängig“ trägt den Satz als Beschreibung, der Fokus darauf, angesagt", { lo, e: el.data.erinnerungen });
    n = nPosts(s);
    await p.click("[data-er-undo]");
    await nachPost(s, n);
    assert(el.data.erinnerungen[0].geloest === undefined && (await p.evaluate(() => document.querySelectorAll("[data-er-zeile]").length)) === 1 && /ist zur\u00fcck/.test(await ansage(p)),
      "Rückgängig: die Erinnerung ist zurück, angesagt", el.data.erinnerungen[0]);
    // Escape schliesst, der Fokus geht auf die Glocke
    await p.keyboard.press("Escape");
    const zu = await p.evaluate(() => ({ zu: document.querySelector("#wkErinSchein").hidden, fokus: document.activeElement?.id }));
    assert(zu.zu && zu.fokus === "wkGlocke", "Escape schließt den Dialog, der Fokus liegt wieder auf der Glocke", zu);
    assert(!s.fehler.length && !el.abgelehnt.length, "Erinnerungen: jeder gesendete Stand gilt, keine Fehler", { f: s.fehler, a: el.abgelehnt.length });
    // nach Neuladen: die Erinnerung steht in der Datei, die Charaktere sind unberuehrt
    await p.close();
    const t = await oeffne({ lager: el, app: true });
    await glocke(t);
    const nach = await t.page.evaluate(() => ({ zeilen: document.querySelectorAll("[data-er-zeile]").length, zeit: document.querySelector("[data-er-zeit]")?.value, glocke: document.querySelector("#wkGlocke").textContent }));
    assert(nach.zeilen === 1 && nach.zeit === "19:30" && nach.glocke === "Erinnerungen1" && el.data.profile.length === 3, "nach Neuladen: die Erinnerung ist da, die Charaktere auch", nach);
    // zwoelf sind das Hoechste
    for (let i = 1; i < 12; i++) { const k = nPosts(t); await t.page.click("[data-er-neu]"); await nachPost(t, k); }
    const voll = await t.page.evaluate(() => ({ zeilen: document.querySelectorAll("[data-er-zeile]").length, neu: document.querySelector("[data-er-neu]").disabled,
      satz: document.getElementById(document.querySelector("[data-er-neu]").getAttribute("aria-describedby") || "")?.textContent || "" }));
    assert(voll.zeilen === 12 && voll.neu && /Zwölf Erinnerungen/.test(voll.satz) && el.data.erinnerungen.filter((r) => !r.geloest).length === 12, "zwölf Erinnerungen: \u201e+ Erinnerung\u201c ist gesperrt, ein Satz sagt warum", voll);
    // eine gelöste zählt nicht mit: lösen macht Platz
    const k2 = nPosts(t); await t.page.click("[data-er-los]"); await nachPost(t, k2);
    assert(await t.page.evaluate(() => !document.querySelector("[data-er-neu]").disabled) && el.data.erinnerungen.length === 12, "eine gelöste macht Platz, bleibt aber in der Datei (12 gespeichert)");
    await t.page.close();
  }

  // ===== die Seite beantwortet eine Anfrage des Hauptprozesses: genau id und n
  {
    const el = neuesLager({ ...data, erinnerungen: [{ id: "eabcdefghi", an: true, tage: [2], zeit: "18:00", text: "Offen: {n}", nurOffen: true }] });
    const s = await oeffne({ lager: el, app: true });
    // erst muss der erste Stand der Zaehler gelesen sein (die Seite fragt mit ?now=1), dann zaehlt der Hauptprozess hoch; gewartet wird, bis die
    // Seite diese erste Antwort verarbeitet hat (statt einer festen Zeit)
    await verarbeitet(s.page, [], { mindestens: { "GET /api/events": 1 } });
    el.erin.anfragen = [{ id: "eabcdefghi" }];
    el.counts = { erinnerung: 1 };
    await bis(() => el.antworten.length >= 1, 8000);
    const a = el.antworten[0];
    // zwei Charaktere haben die Woche offen, "Fertig" nicht
    assert(a && JSON.stringify(Object.keys(a).sort()) === '["id","n"]' && a.id === "eabcdefghi" && a.n === 2, "Anfrage: die Seite antwortet mit genau {id, n}, n = 2 Charaktere mit offener Woche (der fertige zählt nicht)", a);
    assert(a && !JSON.stringify(a).includes("Offen"), "die Antwort enthält nie einen Text");
    await s.page.close();
    // im Browser (nicht im Fenster der App) wird nicht geantwortet: dort gibt es keine Windows-Meldung
    const b = neuesLager({ ...data, erinnerungen: [{ id: "eabcdefghi", an: true, tage: [2], zeit: "18:00", text: "x", nurOffen: true }] });
    b.erin.anfragen = [{ id: "eabcdefghi" }];
    b.counts = { erinnerung: 1 };
    const sb = await oeffne({ lager: b, app: false });
    await glocke(sb);
    await new Promise((r) => setTimeout(r, 2500));
    const hint = await sb.page.evaluate(() => document.querySelector(".wkehrlich")?.textContent || "");
    assert(!b.antworten.length && /Im Browser gibt es keine Windows-Meldung/.test(hint), "im Browser: keine Antwort, und der Hinweis sagt, dass es dort keine Windows-Meldung gibt", { a: b.antworten.length, hint });
    await sb.page.close();
  }

  // ===== Datei-Modus (ohne Helfer): nur der Satz, keine Liste
  {
    const s = await oeffne({ datei: true });
    await glocke(s);
    const d = await s.page.evaluate(() => ({ satz: document.querySelector('[role="dialog"] .wksatz:not(:first-of-type)')?.textContent || document.querySelector('[role="dialog"]').textContent, neu: !!document.querySelector("[data-er-neu]"), zeilen: document.querySelectorAll("[data-er-zeile]").length }));
    assert(!d.neu && !d.zeilen && /Im Browser gibt es keine Windows-Meldung/.test(d.satz), "ohne Helfer: der Dialog sagt, dass es im Browser keine Meldung gibt, keine Liste", d);
    assert(!s.fehler.length, "Datei-Modus: keine Fehler", s.fehler);
    await s.page.close();
  }

  // ===== Englisch und Tastatur
  {
    const el = neuesLager({ ...data, erinnerungen: [{ id: "eabcdefghi", an: true, tage: [2], zeit: "18:00", text: "x {n}", nurOffen: true }] });
    const s = await oeffne({ lager: el, lang: "en", app: true });
    await glocke(s);
    const en = await s.page.evaluate(() => ({ g: document.querySelector("#wkGlocke").textContent, h: document.querySelector(".wkehrlich").textContent, t: [...document.querySelectorAll("[data-er-tag]")].map((b) => b.textContent).join(),
      neu: document.querySelector("[data-er-neu]").textContent, nur: document.querySelector("#wkErinSchein .wknur")?.textContent.trim() }));
    assert(en.g === "Reminders1" && /only while Borometer is running/.test(en.h) && /local time/.test(en.h) && en.t === "Mon,Tue,Wed,Thu,Fri,Sat,Sun" && en.neu === "+ Reminder" && /Only notify while something is open/.test(en.nur), "English: Reminders, the notice, weekdays, + Reminder", en);
    // Tab bleibt im Dialog
    const ids = [];
    for (let i = 0; i < 40; i++) { await s.page.keyboard.press("Tab"); ids.push(await s.page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))); }
    assert(ids.every(Boolean), "Tab wandert im Dialog im Kreis und verl\u00e4sst ihn nicht", ids.filter((x) => !x).length);
    await s.page.close();
  }

  // ===== 560 px ohne waagerechtes Rollen, in allen vier Themen und beiden Sprachen
  for (const thema of ["dark", "light", "tnl", "glas"]) {
    for (const lang of ["de", "en"]) {
      const el = neuesLager({ ...data, erinnerungen: [{ id: "eabcdefghi", an: true, tage: [1, 2, 3, 4, 5, 6, 0], zeit: "18:00", text: "Ein langer Text, der die Zeile ausfuellt und nicht ueberlaufen darf, {n}", nurOffen: true },
        { id: "eabcdefghj", an: false, tage: [2], zeit: "21:30", text: "Zweite", nurOffen: false }] });
      const s = await oeffne({ lager: el, breite: 560, hoehe: 900, thema, lang, app: true });
      await glocke(s);
      const m = await s.page.evaluate(() => { const d = document.querySelector(".wkdlg"), sc = document.querySelector("#wkErinSchein");
        return { dlgInnen: d.scrollWidth <= d.clientWidth + 1, schein: sc.scrollWidth <= sc.clientWidth + 1, doc: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          rechts: d.getBoundingClientRect().right <= innerWidth + 0.5 }; });
      assert(m.dlgInnen && m.schein && m.doc && m.rechts, `560 px ${thema}/${lang}: der Dialog rollt nicht waagerecht und liegt im Fenster`, m);
      assert(!s.fehler.length, `560 px ${thema}/${lang}: keine Fehler`, s.fehler);
      await s.page.close();
    }
  }
} finally {
  await browser.close();
  rmSync(ordner, { recursive: true, force: true });
}

console.log();
if (failed) { console.log(`ERINNERUNG PAGE FAILED - ${failed}`); process.exit(1); }
console.log("ERINNERUNG PAGE PASSED");
