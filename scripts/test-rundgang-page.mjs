// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Rundgang beim ersten Start (Spezifikation 02.10.2026,
// docs/superpowers/specs/2026-10-02-tutorial-design.md) an der gebauten
// Seite, vom gestellten Helfer ausgeliefert (page.route) - als eigenes
// Fenster der App (?win=1, nativeFrame) und als Tab im Browser. Was die Seite
// an /api/config schickt, wird mitgeschrieben.
//
// Run:  npm run test:rundgang-page     (baut die Seite zuerst)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 500))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Die Texte der Spezifikation (Abschnitt 3), je Schritt Titel und Ziel. */
const TITEL = {
  de: ["Log-Ordner", "Live", "Kampfwahl", "Kompakt", "Weeklies", "Fehler melden"],
  en: ["Log folder", "Live", "Fight picker", "Compact", "Weeklies", "Report a bug"],
};
const ZIEL = ["#btnPickFolder", "#btnWatch", "#kwKnopf", "#btnCompact", '#bereiche [data-tab="weeklies"]', "#sbFehler"];

/* Eine Seite am gestellten Helfer (wie test-einst-page.mjs). app: ?win=1 und
   nativeFrame, sonst ein Browser-Tab. config: was GET /api/config antwortet;
   configHalt: die Antwort kommt erst, wenn s.configFrei() gerufen wird.
   helfer: der Helfer kennt den Ordner helfer.dir. kfenster: der Helfer kann
   Kompakt als eigenes Fenster. suffix: mehr an der Adresse (?kompakt=1).
   Mitgeschrieben: POST /api/config in s.posts, POST /api/dir in s.dir. */
async function oeffne({ app = true, lang = "de", config = {}, configHalt = false, helfer = null, kfenster = false,
  suffix = "", breite = 1280, hoehe = 860, motion = "no-preference", warten = true } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe }, reducedMotion: motion });
  const s = { page, fehler: [], posts: [], dir: [], configFrei: () => {} };
  const halt = configHalt ? new Promise((r) => { s.configFrei = r; }) : null;
  let ordner = helfer ? helfer.dir : "";
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/state") return json({ dir: ordner, file: "", nativeFrame: app, material: false, stayOnTop: false, kompaktFenster: kfenster });
    // Fixrunde 1, M6: der Hauptprozess meldet den ersten Start (firstStart); eine eigene config ueberschreibt es
    if (path === "/api/config" && req.method() === "GET") { if (halt) await halt; return json({ firstStart: true, ...config }); }
    if (path === "/api/config") { s.posts.push(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
    if (path === "/api/dir") {
      const b = req.method() === "POST" ? JSON.parse(req.postData() || "{}") : { get: true };
      s.dir.push(b);
      if (b.path) ordner = b.path;
      return json(b.path ? { ok: true, dir: b.path } : { ok: true });
    }
    if (path === "/api/latest") return json({ file: "", from: 0, to: 0, size: 0, head: "", text: "" });
    if (path === "/api/win") return json({ ok: true, max: false, w: 400, h: 28, on_top: true });
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: {} }); }
    if (path === "/api/builds" && req.method() === "GET") return json({ ok: true, builds: {} });
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path === "/api/logs") return json({ ok: true, files: [] });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html" + (app ? "?win=1" : "") + suffix);
  if (warten) await page.waitForFunction(() => !!document.body.dataset.bereit);
  return s;
}
/* Der Rundgang hat entschieden, ob er von selbst kommt (data-von-selbst:
   "ja" oder "nein" - erst nach der Antwort von /api/config und "bereit"). */
const entschieden = (p) => p.waitForFunction(() => {
  const r = document.querySelector("#rundgang");
  return !!r && (r.dataset.vonSelbst === "ja" || r.dataset.vonSelbst === "nein");
});
const offen = (p) => p.waitForFunction(() => { const r = document.querySelector("#rundgang"); return !!r && !r.hidden && r.getClientRects().length > 0; });
const zu = (p) => p.waitForFunction(() => { const r = document.querySelector("#rundgang"); return !!r && r.hidden; });
/* Was die Karte gerade zeigt. */
const karte = (p) => p.evaluate((ziele) => {
  const r = document.querySelector("#rundgang");
  const sicht = (e) => !!e && e.getClientRects().length > 0;
  const q = (sel) => r?.querySelector(sel);
  const ring = [...document.querySelectorAll(".rgziel")];
  return {
    offen: !!r && !r.hidden && sicht(r),
    schritt: q("#rgSchritt")?.textContent.trim() || "", titel: q("#rgTitel")?.textContent.trim() || "",
    satz: q("#rgSatz")?.textContent.replace(/\s+/g, " ").trim() || "",
    wo: sicht(q("#rgWo")) ? q("#rgWo").textContent.trim() : "",
    ordnerKnopf: sicht(q("#rgOrdnerKnopf")), ordnerStand: sicht(q("#rgOrdnerStand")) ? q("#rgOrdnerStand").textContent.replace(/\s+/g, " ").trim() : "",
    zurueck: sicht(q("#rgZurueck")) && !q("#rgZurueck").disabled, weiter: q("#rgWeiter")?.textContent.trim() || "",
    skip: q("#rgSkip")?.textContent.trim() || "",
    seite: r?.dataset.seite || "", fokus: document.activeElement?.id || "",
    ring: ring.map((e) => ziele.findIndex((z) => document.querySelector(z) === e)),
  };
}, ZIEL);
const weiter = async (p) => { await p.click("#rgWeiter"); };
const configPosts = (s) => s.posts.filter((x) => "rundgangGesehen" in x);
/* Schreibt der Rundgang (oder sonst jemand) noch etwas? Ein Kreis ueber
   den Helfer: ein GET, dessen Antwort nach allen frueheren POSTs kommt. */
const helferRunde = (p) => p.evaluate(() => fetch("/api/ping").then(() => true));
/* Wartet, bis n POSTs mit rundgangGesehen angekommen sind (hoechstens 2 s). */
const bisPosts = async (s, n) => { for (let i = 0; i < 100 && configPosts(s).length < n; i++) await new Promise((r) => setTimeout(r, 20)); };

try {
  // --- 1. Erster Start in der App: erscheint, Schritt 1 ohne Ordner, Rolle und Namen
  {
    const s = await oeffne();
    const p = s.page;
    await entschieden(p);
    await offen(p);
    const k = await karte(p);
    assert(k.offen && k.schritt === "Schritt 1 von 6" && k.titel === "Log-Ordner", "leere Config, leerer logIndex: der Rundgang steht bei Schritt 1", k);
    assert(/Kampf-Logs, die Throne and Liberty selbst schreibt/.test(k.satz) && /CombatLogs/.test(k.satz), "Schritt 1: der Satz der Spezifikation", k.satz);
    assert(k.ordnerKnopf && !k.ordnerStand, "ohne Log-Ordner: „Log-Ordner wählen“ in der Karte", k);
    assert(k.fokus === "rgWeiter" && k.weiter === "Weiter" && !k.zurueck && k.skip === "Überspringen", "Fokus auf „Weiter“; „Zurück“ gibt es im ersten Schritt nicht; „Überspringen“", k);
    assert(JSON.stringify(k.ring) === "[0]", "der Ring steht am Ziel „Log-Ordner wählen“ auf Start", k.ring);
    const a = await p.evaluate(() => {
      const r = document.querySelector("#rundgang");
      const ids = (n) => (r.getAttribute(n) || "").split(/\s+/).filter(Boolean);
      const text = (n) => ids(n).map((i) => document.getElementById(i)?.textContent.trim() || "?").join(" ");
      const z = document.querySelector("#btnPickFolder");
      return { role: r.getAttribute("role"), modal: r.getAttribute("aria-modal"), name: text("aria-labelledby"), besch: text("aria-describedby"),
        ziel: (z.getAttribute("aria-describedby") || "").split(/\s+/).includes("rgSatz"),
        weiterTyp: document.querySelector("#rgWeiter").type, hot: document.querySelector("#rgWeiter").classList.contains("hot"),
        heiss: [...r.querySelectorAll(".btn.hot")].length };
    });
    assert(a.role === "dialog" && a.modal === "false", "role=dialog, aria-modal=false", a);
    assert(a.name === "Schritt 1 von 6 Log-Ordner" && /CombatLogs/.test(a.besch), "Vorleser: „Schritt 1 von 6, Log-Ordner“ und der Satz", a);
    assert(a.ziel, "das Ziel beschreibt sich mit dem Satz der Karte (aria-describedby)", a);
    assert(a.hot && a.heiss === 1 && a.weiterTyp === "button", "„Weiter“ ist der eine heiße Knopf der Karte", a);
    assert(!s.posts.length, "beim Erscheinen schreibt der Rundgang nichts", s.posts);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 2. Wann nicht: gesehen, logIndex, vor /api/config, Browser, Kompaktfenster
  {
    for (const [name, opt] of [
      ["rundgangGesehen: true", { config: { rundgangGesehen: true } }],
      ["logIndex vorhanden", { config: { logIndex: { "TLCombatLog-20260920.txt": { size: 10,
        fights: [{ name: "Stone Beetle", dps: 1000, dmg: 20000, dur: 20, at: Date.UTC(2026, 8, 20, 20) }] } } } }],
      // Fixrunde 1, M6: ein Update-Nutzer ohne Bosskampf - der Hauptprozess kennt Einstellungen, also kein erster Start
      ["Update-Nutzer ohne Verlauf (firstStart: false, logIndex leer)", { config: { firstStart: false, logIndex: {} } }],
      ["alter Helfer ohne firstStart", { config: { firstStart: undefined } }],
      ["im Browser ohne App", { app: false }],
    ]) {
      const s = await oeffne(opt);
      const p = s.page;
      await entschieden(p);
      const k = await karte(p);
      const v = await p.evaluate(() => document.querySelector("#rundgang").dataset.vonSelbst);
      assert(!k.offen && v === "nein" && !k.ring.length, name + ": kein Rundgang von selbst, kein Ring", { k, v });
      await p.close();
    }
    // vor der Antwort von /api/config: unbekannt, nichts; danach erscheint er
    const s = await oeffne({ configHalt: true });
    const p = s.page;
    const vorher = await p.evaluate(() => { const r = document.querySelector("#rundgang"); return { da: !!r, offen: !!r && !r.hidden, v: r?.dataset.vonSelbst ?? null }; });
    assert(vorher.da && !vorher.offen && !vorher.v, "vor der Antwort von /api/config: nichts entschieden, nichts zu sehen", vorher);
    s.configFrei();
    await entschieden(p);
    await offen(p);
    assert((await karte(p)).schritt === "Schritt 1 von 6", "nach der Antwort von /api/config erscheint er", await karte(p));
    await p.close();
    // das Kompaktfenster (?kompakt=1) zeigt ihn nie
    const kf = await oeffne({ suffix: "&kompakt=1", warten: false });
    await kf.page.waitForFunction(() => document.documentElement.classList.contains("kfenster") && !!document.body.dataset.bereit);
    await entschieden(kf.page);
    const kk = await karte(kf.page);
    assert(!kk.offen && !kk.ring.length, "im Kompaktfenster (?kompakt=1) kein Rundgang", kk);
    await kf.page.close();
  }

  // --- 3. Schritt 1: Ordner waehlen in der Karte, Ordner gesetzt; mit Ordner nur der Pfad
  {
    const s = await oeffne();
    const p = s.page;
    await offen(p);
    await p.click("#rgOrdnerKnopf");
    await p.waitForFunction(() => document.querySelector("#modalBg")?.classList.contains("on"));
    await p.fill("#modalInput", "C:\\Spiele\\TL\\CombatLogs");
    await p.click("#modalOk");
    await p.waitForFunction(() => /Ordner gesetzt/.test(document.querySelector("#rgOrdnerStand")?.textContent || "") && document.querySelector("#rgOrdnerStand").getClientRects().length > 0);
    const k = await karte(p);
    assert(s.dir.some((d) => d.path === "C:\\Spiele\\TL\\CombatLogs"), "„Log-Ordner wählen“ in der Karte nimmt denselben Weg (POST /api/dir)", s.dir);
    assert(!k.ordnerKnopf && k.ordnerStand.includes("C:\\Spiele\\TL\\CombatLogs") && k.schritt === "Schritt 1 von 6", "danach „Ordner gesetzt“ mit dem Pfad, der Rundgang bleibt bei Schritt 1", k);
    await p.waitForFunction(() => document.activeElement?.id === "rgWeiter", null, { timeout: 3000 }).catch(() => {});
    const fokusNach = await p.evaluate(() => document.activeElement?.id || "");
    assert(fokusNach === "rgWeiter", "nach der Wahl steht der Fokus wieder auf „Weiter“", fokusNach);
    await p.close();
    const m = await oeffne({ helfer: { dir: "D:\\TL\\CombatLogs" } });
    await offen(m.page);
    const km = await karte(m.page);
    assert(!km.ordnerKnopf && km.ordnerStand.includes("D:\\TL\\CombatLogs") && /CombatLogs/.test(km.satz), "mit Ordner: Schritt 1 zeigt den Pfad und den Satz, nur „Weiter“", km);
    await m.page.close();
  }

  // --- 4. Weiter, Zurueck, Fertig: sechs Schritte an ihren Zielen, danach genau ein POST
  {
    const s = await oeffne();
    const p = s.page;
    await offen(p);
    const gesehen = [];
    for (let i = 0; i < 6; i++) {
      await p.waitForFunction((n) => document.querySelector("#rgSchritt")?.textContent.trim() === `Schritt ${n} von 6`, i + 1);
      const k = await karte(p);
      gesehen.push(k);
      if (i < 5) await weiter(p);
    }
    assert(gesehen.every((k, i) => k.titel === TITEL.de[i]), "sechs Titel in der Reihenfolge der Spezifikation", gesehen.map((k) => k.titel));
    assert(gesehen.every((k, i) => JSON.stringify(k.ring) === JSON.stringify([i])), "je Schritt der Ring an genau seinem Ziel", gesehen.map((k) => k.ring));
    assert(gesehen.every((k) => k.fokus === "rgWeiter"), "bei jedem Schritt geht der Fokus auf „Weiter“", gesehen.map((k) => k.fokus));
    assert(gesehen.slice(1).every((k) => k.zurueck) && gesehen[5].weiter === "Fertig" && gesehen.slice(0, 5).every((k) => k.weiter === "Weiter"),
      "ab Schritt 2 „Zurück“, im letzten „Fertig“", gesehen.map((k) => [k.zurueck, k.weiter]));
    assert(/Wochenaufgaben je Charakter/.test(gesehen[4].satz) && /Donnerstag um 10:00/.test(gesehen[4].satz), "Schritt 5: Weeklies mit dem Reset am Donnerstag", gesehen[4].satz);
    assert(/ohne dein Kampflog/.test(gesehen[5].satz), "Schritt 6: der Bericht ohne Kampflog", gesehen[5].satz);
    assert(/Strg\+K/.test(gesehen[2].satz), "Schritt 3: Strg+K", gesehen[2].satz);
    assert(/beim Kampfende/.test(gesehen[1].satz), "Schritt 2: Live liest beim Kampfende", gesehen[1].satz);
    await p.click("#rgZurueck");
    await p.waitForFunction(() => document.querySelector("#rgSchritt")?.textContent.trim() === "Schritt 5 von 6");
    const z = await karte(p);
    assert(z.titel === "Weeklies" && JSON.stringify(z.ring) === "[4]" && z.fokus === "rgWeiter", "„Zurück“ geht einen Schritt zurück, Fokus wieder auf „Weiter“", z);
    assert(!s.posts.length, "unterwegs schreibt der Rundgang nichts", s.posts);
    await weiter(p);
    await p.waitForFunction(() => document.querySelector("#rgWeiter")?.textContent.trim() === "Fertig");
    await p.click("#rgWeiter");
    await zu(p);
    await bisPosts(s, 1);
    await helferRunde(p);
    const nach = await karte(p);
    const beschr = await p.evaluate((ziele) => ziele.map((q) => (document.querySelector(q)?.getAttribute("aria-describedby") || "").includes("rgSatz")), ZIEL);
    assert(!nach.ring.length && !beschr.some(Boolean), "danach kein Ring und keine Beschreibung mehr an einem Ziel", { ring: nach.ring, beschr });
    assert(JSON.stringify(s.posts) === JSON.stringify([{ rundgangGesehen: true }]), "„Fertig“: genau ein POST /api/config mit {rundgangGesehen: true}", s.posts);
    assert(nach.fokus === "btnPickFolder", "nach „Fertig“ steht der Fokus auf „Log-Ordner wählen“", nach.fokus);
    // das liveText bleibt am Live-Knopf
    const live = await p.evaluate(() => document.querySelector("#btnWatch").getAttribute("aria-describedby"));
    assert(live === "liveText", "der Live-Knopf behaelt seine eigene Beschreibung", live);
    await p.close();
  }

  // --- 5. Ueberspringen und Esc; Esc ausserhalb der Karte laesst sie stehen
  {
    const s = await oeffne();
    const p = s.page;
    await offen(p);
    await weiter(p);
    await p.click("#rgSkip");
    await zu(p);
    await bisPosts(s, 1);
    await helferRunde(p);
    assert(JSON.stringify(configPosts(s)) === JSON.stringify([{ rundgangGesehen: true }]), "„Überspringen“: genau ein POST mit {rundgangGesehen: true}", s.posts);
    await p.close();
    const e = await oeffne();
    await offen(e.page);
    await e.page.focus("#btnWatch");
    await e.page.keyboard.press("Escape");
    await helferRunde(e.page);
    assert((await karte(e.page)).offen && !configPosts(e).length, "Esc mit dem Fokus in der App: die Karte bleibt, nichts geschrieben", e.posts);
    await e.page.focus("#rgWeiter");
    await e.page.keyboard.press("Escape");
    await zu(e.page);
    await bisPosts(e, 1);
    await helferRunde(e.page);
    assert(JSON.stringify(configPosts(e)) === JSON.stringify([{ rundgangGesehen: true }]), "Esc in der Karte überspringt: genau ein POST", e.posts);
    await e.page.close();
  }

  // --- 6. Mitten im Rundgang neu geladen: er kommt wieder
  {
    const s = await oeffne();
    const p = s.page;
    await offen(p);
    await weiter(p); await weiter(p);
    await p.waitForFunction(() => document.querySelector("#rgSchritt")?.textContent.trim() === "Schritt 3 von 6");
    await p.reload();
    await p.waitForFunction(() => !!document.body.dataset.bereit);
    await offen(p);
    const k = await karte(p);
    assert(k.schritt === "Schritt 1 von 6" && !s.posts.length, "neu geladen ohne „Fertig“: der Rundgang kommt wieder, bei Schritt 1, nichts geschrieben", { k, posts: s.posts });
    await p.close();
  }

  // --- 7. „Rundgang zeigen“ in den Einstellungen, im Browser und in der App
  {
    for (const app of [false, true]) {
      const s = await oeffne({ app, config: { rundgangGesehen: true } });
      const p = s.page;
      await entschieden(p);
      await p.click('#bereiche [data-tab="settings"]');
      await p.waitForFunction(() => !document.querySelector("#einst").hidden);
      const knopf = await p.evaluate(() => { const b = document.querySelector("#eRundgang");
        return b ? { text: b.textContent.trim(), info: !!b.closest("#eg-info"), sicht: b.getClientRects().length > 0, hot: b.classList.contains("hot") } : null; });
      assert(knopf && knopf.text === "Rundgang zeigen" && knopf.info && knopf.sicht && !knopf.hot, (app ? "App" : "Browser") + ": „Rundgang zeigen“ im Abschnitt Info, leise", knopf);
      await p.click("#eRundgang");
      await offen(p);
      const k = await karte(p);
      const ort = await p.evaluate(() => ({ land: !document.querySelector("#land").hidden, einst: !document.querySelector("#einst").hidden }));
      assert(k.schritt === "Schritt 1 von 6" && ort.land && !ort.einst && k.fokus === "rgWeiter", (app ? "App" : "Browser") + ": er wechselt nach Start und beginnt bei Schritt 1", { k, ort });
      await p.click("#rgSkip");
      await zu(p);
      await helferRunde(p);
      assert(!configPosts(s).length, (app ? "App, schon gesehen" : "Browser") + ": danach nichts Neues geschrieben", s.posts);
      await p.close();
    }
  }

  // --- 8. Die App bleibt bedienbar: Live und Kampfwahl bei offener Karte
  {
    const s = await oeffne({ helfer: { dir: "D:\\TL\\CombatLogs" } });
    const p = s.page;
    await offen(p);
    await weiter(p);
    await p.click("#kwKnopf");
    await p.waitForFunction(() => document.querySelector("#kwKnopf").getAttribute("aria-expanded") === "true");
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => document.querySelector("#kwKnopf").getAttribute("aria-expanded") === "false");
    await p.click("#btnWatch");
    await p.waitForFunction(() => document.querySelector("#btnWatch").getAttribute("aria-pressed") === "true");
    const k = await karte(p);
    assert(k.offen && k.schritt === "Schritt 2 von 6", "Kampfwahl und Live lassen sich bei offener Karte klicken; der Rundgang bleibt stehen", k);
    const grund = await p.evaluate(() => { const ueber = [...document.querySelectorAll("body *")].filter((e) => {
      const c = getComputedStyle(e); return c.position === "fixed" && e.getClientRects().length > 0 && e.getBoundingClientRect().width >= innerWidth - 2
        && e.getBoundingClientRect().height >= innerHeight - 2 && !e.closest("#rundgang"); });
      return ueber.map((e) => e.id || e.className); });
    assert(!grund.length, "kein abgedunkelter Grund über der App", grund);
    await p.close();
  }

  // --- 9. Tastatur: Tab verlaesst die Karte, F6 springt hin und her
  {
    const s = await oeffne();
    const p = s.page;
    await offen(p);
    await weiter(p);
    await p.waitForFunction(() => document.activeElement?.id === "rgWeiter");
    await p.keyboard.press("Tab");
    const nachTab = await p.evaluate(() => ({ id: document.activeElement?.id || document.activeElement?.tagName, drin: !!document.activeElement?.closest("#rundgang") }));
    assert(!nachTab.drin && nachTab.id !== "BODY", "Tab nach „Weiter“ verlässt die Karte in die App (kein Fokusfang)", nachTab);
    await p.keyboard.press("F6");
    const f1 = await p.evaluate(() => document.activeElement?.id);
    assert(f1 === "rgWeiter", "F6 aus der App springt in die Karte, auf „Weiter“", f1);
    await p.keyboard.press("F6");
    const f2 = await p.evaluate(() => ({ id: document.activeElement?.id || document.activeElement?.tagName, drin: !!document.activeElement?.closest("#rundgang") }));
    assert(!f2.drin && f2.id === nachTab.id, "F6 aus der Karte springt zurück dorthin, wo man in der App war", { f2, nachTab });
    await p.keyboard.press("Shift+Tab");
    await p.keyboard.press("Shift+Tab");
    const zur = await p.evaluate(() => document.activeElement?.id);
    assert(zur === "rgZurueck", "Umschalt+Tab erreicht die Knöpfe der Karte in ihrer Reihenfolge", zur);
    await p.close();
  }

  // --- 10. Englisch; Kompakt-Satz je nach Fenster; Ziel nicht zu sehen
  {
    const s = await oeffne({ lang: "en", kfenster: true });
    const p = s.page;
    await offen(p);
    const titel = [];
    let kompakt = "";
    for (let i = 0; i < 6; i++) {
      const k = await karte(p);
      titel.push(k.titel);
      if (i === 0) assert(k.schritt === "Step 1 of 6" && k.weiter === "Next" && k.skip === "Skip", "EN: „Step 1 of 6“, „Next“, „Skip“", k);
      if (i === 3) kompakt = k.satz;
      if (i < 5) await weiter(p);
    }
    assert(JSON.stringify(titel) === JSON.stringify(TITEL.en), "EN: die sechs Titel", titel);
    assert(/Ctrl\+Shift\+D makes it click-through/.test(kompakt), "EN, eigenes Kompaktfenster: der Satz mit Ctrl+Shift+D", kompakt);
    assert((await karte(p)).weiter === "Done", "EN: „Done“", await karte(p));
    await p.close();
    const r = await oeffne({ kfenster: false });
    await offen(r.page);
    for (let i = 0; i < 3; i++) await weiter(r.page);
    const kr = await karte(r.page);
    assert(kr.titel === "Kompakt" && /Strg\+Umschalt\+D schaltet das Durchklicken\./.test(kr.satz) && !/durchklickbar, damit/.test(kr.satz),
      "ohne eigenes Kompaktfenster: „Strg+Umschalt+D schaltet das Durchklicken.“", kr.satz);
    await r.page.close();
    const b = await oeffne({ app: false });
    await entschieden(b.page);
    await b.page.click('#bereiche [data-tab="settings"]');
    await b.page.click("#eRundgang");
    await offen(b.page);
    for (let i = 0; i < 3; i++) await weiter(b.page);
    const kb = await karte(b.page);
    assert(kb.titel === "Kompakt" && /schmaler Streifen über dem Spiel/.test(kb.satz) && !/Strg\+Umschalt\+D/.test(kb.satz), "im Browser: ohne den Satz zum Kürzel", kb.satz);
    await b.page.close();
    // Ziel nicht zu sehen: Schritt 1 auf den Weeklies - unten mittig, ohne Pfeil, sagt wo
    // Lage und Groesse ohne Gleiten gemessen (die Bewegung prueft 13)
    const w = await oeffne({ motion: "reduce" });
    await offen(w.page);
    await w.page.click('#bereiche [data-tab="weeklies"]');
    await w.page.waitForFunction(() => document.querySelector("#rundgang")?.dataset.seite === "keine");
    const kw = await karte(w.page);
    const lage = await w.page.evaluate(() => { const r = document.querySelector("#rundgang").getBoundingClientRect();
      return { mitte: Math.abs((r.left + r.right) / 2 - innerWidth / 2), unten: innerHeight - r.bottom }; });
    assert(kw.schritt === "Schritt 1 von 6" && kw.wo === "Zu finden auf Start." && lage.mitte < 2 && lage.unten < 120 && !kw.ring.length,
      "Ziel nicht zu sehen: der Schritt bleibt, die Karte steht unten mittig ohne Pfeil und sagt „Zu finden auf Start.“", { kw, lage });
    await w.page.close();
  }

  // --- 11. Form: drei Themen, Ring in --pick, Schrift ab 11 px, kein Rot und Gruen, Karte neben dem Ziel
  {
    for (const theme of ["dark", "light", "tnl"]) {
      const s = await oeffne({ config: { theme }, motion: "reduce" });
      const p = s.page;
      await offen(p);
      await p.waitForFunction((t) => document.documentElement.dataset.theme === t, theme);
      for (let i = 0; i < 6; i++) {
        const f = await p.evaluate(() => {
          const r = document.querySelector("#rundgang"), cs = getComputedStyle(r);
          const z = document.querySelector(".rgziel"), zs = z && getComputedStyle(z);
          const probe = document.createElement("i"); probe.style.color = "var(--pick)"; document.body.append(probe);
          const pick = getComputedStyle(probe).color; probe.style.color = "var(--surf-tip)"; probe.remove();
          const texte = [...r.querySelectorAll("*")].filter((e) => e.getClientRects().length > 0 && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
          const klein = texte.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => e.id || e.className);
          const rb = r.getBoundingClientRect(), zb = z ? z.getBoundingClientRect() : null;
          const deckt = zb && !(rb.right <= zb.left || rb.left >= zb.right || rb.bottom <= zb.top || rb.top >= zb.bottom);
          const farben = texte.map((e) => getComputedStyle(e).color);
          const rotGruen = farben.filter((c) => { const [R, G, B] = c.match(/\d+(\.\d+)?/g).map(Number);
            return (R > 150 && G < 90 && B < 90) || (G > 150 && R < 90 && B < 120); });
          return { ring: zs ? [zs.outlineStyle, parseFloat(zs.outlineWidth), zs.outlineColor, parseFloat(zs.outlineOffset)] : null, pick,
            schein: zs ? zs.boxShadow : "", radius: cs.borderRadius, breite: rb.width, klein, deckt, rotGruen,
            drin: rb.left >= 0 && rb.top >= 0 && rb.right <= innerWidth && rb.bottom <= innerHeight, seite: r.dataset.seite,
            font: cs.fontFamily === getComputedStyle(document.body).fontFamily, shadow: cs.boxShadow };
        });
        const tag = `${theme}, Schritt ${i + 1}`;
        // Fixrunde 1, M2: gestrichelt mit 4 px Abstand - der Fokusring ist durchgezogen mit 2 px (Gold bleibt, 02.10.)
        assert(f.ring && f.ring[0] === "dashed" && f.ring[1] === 2 && f.ring[2] === f.pick && f.ring[3] === 4,
          tag + ": Ring 2 px gestrichelt in --pick, 4 px Abstand", f);
        if (i === 1) {
          // das Ziel selbst mit der Tastatur erreicht: dann gilt sein Fokusring, nicht der Ring
          await p.focus("#btnWatch");
          await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Tab");
          const fr = await p.evaluate(() => { const e = document.querySelector("#btnWatch"), c = getComputedStyle(e);
            const probe = document.createElement("i"); probe.style.color = "var(--focus)"; document.body.append(probe);
            const fokus = getComputedStyle(probe).color; probe.remove();
            return { fv: e.matches(":focus-visible"), stil: c.outlineStyle, farbe: c.outlineColor, fokus }; });
          assert(fr.fv && fr.stil === "solid" && fr.farbe === fr.fokus, tag + ": am fokussierten Ziel steht der Fokusring (durchgezogen, --focus), nicht der Ring", fr);
          await p.focus("#rgWeiter");
        }
        assert(!f.klein.length && f.radius === "9px" && f.breite <= 340.5 && f.font, tag + ": Schrift ab 11 px, die Textschrift der App, 9 px Rundung, höchstens 340 breit", f);
        assert(!f.deckt && f.drin && ["oben", "unten", "links", "rechts"].includes(f.seite), tag + ": die Karte steht neben dem Ziel, im Fenster, mit Pfeil", f);
        assert(!f.rotGruen.length, tag + ": kein Rot und kein Grün im Text", f.rotGruen);
        if (i < 5) await weiter(p);
      }
      assert(!s.fehler.length, theme + ": keine Fehler", s.fehler);
      await p.close();
    }
  }

  // --- 12. Groessen: 560 (unten, volle Breite, ohne Pfeil), 2000 x 1480 (340), Groesse 200 %
  {
    const s = await oeffne({ breite: 560, hoehe: 860, motion: "reduce" });
    const p = s.page;
    await offen(p);
    for (let i = 0; i < 6; i++) {
      const g = await p.evaluate(() => { const r = document.querySelector("#rundgang").getBoundingClientRect();
        const sb = document.querySelector("#statusleiste").getBoundingClientRect();
        const tb = document.querySelector("header.top").getBoundingClientRect();
        const leiste = document.querySelector("#bereiche"), lr = leiste && leiste.getClientRects().length ? leiste.getBoundingClientRect().right : 0;
        return { l: r.left, links: Math.max(16, lr + 8), r: innerWidth - r.right, ueberSb: r.bottom <= sb.top + 0.5 && r.top >= tb.bottom - 0.5, seite: document.querySelector("#rundgang").dataset.seite,
          quer: document.documentElement.scrollWidth > innerWidth, ring: document.querySelectorAll(".rgziel").length }; });
      assert(Math.abs(g.l - g.links) < 1 && Math.abs(g.r - 16) < 1 && g.ueberSb && g.seite === "keine" && !g.quer,
        // folgt Fixrunde 1, M3: die Karte steht unten oder oben, je nachdem, was nichts verdeckt (Probe 14)
        `560 px, Schritt ${i + 1}: zwischen Titel- und Statusleiste, rechts der Symbolleiste (sonst 16 Punkt Rand), ohne Pfeil, ohne Querrollen`, g);
      if (i < 5) await weiter(p);
    }
    await p.close();
    for (const [breite, hoehe] of [[1280, 860], [2000, 1480]]) {
      const g = await oeffne({ breite, hoehe, motion: "reduce" });
      await offen(g.page);
      const m = await g.page.evaluate(() => ({ w: document.querySelector("#rundgang").getBoundingClientRect().width,
        quer: document.documentElement.scrollWidth > innerWidth }));
      assert(m.w <= 340.5 && m.w >= 280 && !m.quer, `${breite} × ${hoehe}: die Karte ist höchstens 340 Punkt breit, kein Querrollen`, m);
      await g.page.close();
    }
    const z = await oeffne({ config: { uiZoom: 200 }, motion: "reduce" });
    await offen(z.page);
    await z.page.waitForFunction(() => document.documentElement.style.zoom === "2");
    for (let i = 0; i < 6; i++) {
      const m = await z.page.evaluate(() => { const r = document.querySelector("#rundgang").getBoundingClientRect();
        const t = document.querySelector(".rgziel")?.getBoundingClientRect();
        return { w: r.width, drin: r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
          deckt: !!t && !(r.right <= t.left || r.left >= t.right || r.bottom <= t.top || r.top >= t.bottom), seite: document.querySelector("#rundgang").dataset.seite }; });
      assert(m.drin && !m.deckt && (m.seite === "keine" || m.w > 400), `Größe 200 %, Schritt ${i + 1}: die Karte wächst mit, bleibt im Fenster und verdeckt das Ziel nicht`, m);
      if (i < 5) await weiter(z.page);
    }
    await z.page.close();
  }

  // --- 14. Fixrunde 1 (M3, M4, G7): beim ersten Start verdeckt die Karte nichts Wichtiges -
  //         nicht ihr Ziel, nicht den Hinweis mit dem Pfad auf Start, keinen Knopf
  //         auf Start, in der Titel-, Symbol- und Statusleiste (elementFromPoint)
  for (const [breite, hoehe] of [[1280, 860], [560, 860], [2000, 1480]]) {
    const s = await oeffne({ breite, hoehe, motion: "reduce" });
    const p = s.page;
    await offen(p);
    for (let i = 0; i < 6; i++) {
      await p.waitForFunction((n) => document.querySelector("#rgSchritt")?.textContent.trim() === `Schritt ${n} von 6`, i + 1);
      const v = await p.evaluate((ziele) => {
        const karte = document.querySelector("#rundgang");
        const unter = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && karte.contains(e); };
        const mitte = (r) => [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
        const imBild = ([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight;
        const nr = Number(document.querySelector("#rgSchritt").textContent.match(/\d+/)[0]) - 1;
        const ziel = document.querySelector(ziele[nr]);
        const zr = ziel && ziel.getClientRects().length ? ziel.getBoundingClientRect() : null;
        const zielDeckt = !!zr && imBild(mitte(zr)) && unter(...mitte(zr));
        const h = document.querySelector("#landHinweis");
        let hinweis = false;
        if (h && h.getClientRects().length) {
          const r = h.getBoundingClientRect();
          hinweis = [mitte(r), [r.left + 3, r.top + 3], [r.right - 3, r.top + 3], [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3]]
            .filter(imBild).some(([x, y]) => unter(x, y));
        }
        const knoepfe = [...document.querySelectorAll("#land button, header.top button, #bereiche button, #statusleiste button")]
          .filter((b) => b.getClientRects().length > 0 && !karte.contains(b))
          .filter((b) => imBild(mitte(b.getBoundingClientRect())) && unter(...mitte(b.getBoundingClientRect())))
          .map((b) => b.id || b.dataset.tab || b.className);
        return { zielDeckt, hinweis, knoepfe };
      }, ZIEL);
      assert(!v.zielDeckt && !v.hinweis && !v.knoepfe.length,
        `erster Start ${breite} × ${hoehe}, Schritt ${i + 1}: die Karte verdeckt weder ihr Ziel noch den Hinweis auf Start noch einen Knopf`, v);
      if (i < 5) await weiter(p);
    }
    await p.close();
  }

  // --- 15. Fixrunde 1 (G1, G2, G4): Fokus beim Erscheinen und nach dem Ende; nie im Kompakt-Rueckfall
  {
    // G1: wer schon einen Knopf fokussiert hat, behaelt ihn; F6 fuehrt zur Karte
    const s = await oeffne({ configHalt: true });
    const p = s.page;
    await p.focus("#kwKnopf");
    s.configFrei();
    await offen(p);
    const f = await p.evaluate(() => document.activeElement?.id || "");
    assert(f === "kwKnopf", "von selbst: ein schon gesetzter Fokus bleibt, wo er ist", f);
    await p.keyboard.press("F6");
    assert(await p.evaluate(() => document.activeElement?.id) === "rgWeiter", "F6 führt dann in die Karte", await p.evaluate(() => document.activeElement?.id));
    await p.close();
    // G2: Start verlassen, dann Ueberspringen - der Fokus landet auf etwas Sichtbarem
    const w = await oeffne();
    await offen(w.page);
    await w.page.click('#bereiche [data-tab="weeklies"]');
    await w.page.waitForFunction(() => !document.querySelector("#weeklies").hidden);
    await w.page.click("#rgSkip");
    await zu(w.page);
    const g = await w.page.evaluate(() => { const a = document.activeElement;
      return { id: a?.id || a?.dataset?.tab || a?.tagName, sicht: !!a && a !== document.body && a.getClientRects().length > 0 }; });
    assert(g.sicht, "Start verlassen und übersprungen: der Fokus steht auf einem sichtbaren Element", g);
    await w.page.close();
    // G4: der Kompakt-Rueckfall (ein Fenster, body.compact) zeigt ihn nie
    const k = await oeffne({ configHalt: true, kfenster: false });
    await k.page.click("#btnCompact");
    await k.page.waitForFunction(() => document.body.classList.contains("compact"));
    k.configFrei();
    await entschieden(k.page);
    const kk = await karte(k.page);
    const v = await k.page.evaluate(() => document.querySelector("#rundgang").dataset.vonSelbst);
    assert(!kk.offen && v === "nein", "im Kompakt-Rückfall beim Start: kein Rundgang von selbst", { kk, v });
    await k.page.close();
  }

  // --- 13. Bewegung: gleitet 120 ms, mit reduzierter Bewegung springt sie
  {
    for (const motion of ["no-preference", "reduce"]) {
      const s = await oeffne({ motion });
      await offen(s.page);
      const d = await s.page.evaluate(() => { const c = getComputedStyle(document.querySelector("#rundgang"));
        return { prop: c.transitionProperty, dauer: c.transitionDuration }; });
      if (motion === "reduce") assert(d.dauer.split(",").every((x) => parseFloat(x) === 0), "reduzierte Bewegung: die Karte springt", d);
      else assert(/left/.test(d.prop) && /top/.test(d.prop) && d.dauer.split(",").every((x) => x.trim() === "0.12s"), "sonst gleitet sie 120 ms", d);
      await s.page.close();
    }
  }
} finally {
  await browser.close();
}
if (failed) { console.log(`RUNDGANG PAGE TEST FAILED - ${failed}`); process.exit(1); }
console.log("RUNDGANG PAGE TEST PASSED");
