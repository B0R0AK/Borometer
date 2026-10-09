// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Rauchglas (#55, Spezifikation docs/superpowers/specs/2026-10-04-rauchglas-design.md,
// 4.1 und 5): das vierte Thema "glas" an der gebauten Seite, vom gestellten
// Helfer ausgeliefert (page.route) wie in test-einst-page.mjs. Hier der
// deckende Block (der Rueckfall, wenn kein Mica darunter liegt):
// vollstaendig gegen TnL, deckend, jede Schrift lesbar auf ihrem Grund, die
// Reihenfarben nicht schwaecher als im dunklen Thema.
//
// Run:  npm run test:glas-page     (baut die Seite zuerst)
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 600))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");

/* WCAG-Kontrast; Farben als [r,g,b,a] 0..255 / 0..1 */
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const ueber = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
/* Spezifikation 5.1 nahm Mica auf einem weissen Hintergrundbild an (#4a4a4a).
   Seit #189 liegt das grosse Fenster auf Acrylic, und Acrylic zeigt die Fenster
   dahinter: gemessen am 06.10. vor einem weissen Fenster, aktiv, Windows 11
   dunkel - Fenstergrund 103 bei .35, der Grund darunter also #929292. */
const SCHLECHTESTER_DESKTOP = [0x92, 0x92, 0x92];
/* Der Kompaktstreifen lag schon immer auf Acrylic; seine Probe rechnet weiter
   mit der alten Annahme. Vor einem hellen Fenster ist er nicht nachgemessen
   (offen nach #189). */
const DESKTOP_KOMPAKT = [0x4a, 0x4a, 0x4a];

/* Abstand zweier Reihenfarben (Spezifikation 5.2, Nachtrag 04.10.): OKLab x
   100, mit voller Sicht oder unter Farbsinn-Simulation nach Machado (Staerke
   1,0, in linearem RGB). Gemessen wird das kleinste Paar ueber alle 66. */
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const oklab = (hex, art) => {
  let c = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  if (art) c = MACHADO[art].map((z) => Math.min(1, Math.max(0, z[0] * c[0] + z[1] * c[1] + z[2] * c[2])));
  const [r, g, b] = c;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const kleinsterAbstand = (reihe, art) => {
  let best = { wert: Infinity, paar: "" };
  for (let i = 0; i < reihe.length; i++) for (let j = i + 1; j < reihe.length; j++) {
    const a = oklab(reihe[i], art), b = oklab(reihe[j], art), d = 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (d < best.wert) best = { wert: Math.round(d * 1000) / 1000, paar: (i + 1) + "/" + (j + 1) };
  }
  return best;
};

/* Die Seite rechnet nicht selbst: im Browser werden nur die Farben gesammelt,
   gemischt wird hier. Fuer jedes sichtbare Element mit eigenem Textknoten:
   die Textfarbe (text-fill-color, sonst color) und die Kette der
   background-color vom Element nach aussen bis html - sie endet am ersten
   deckenden Grund, weil alles darunter verdeckt ist. Liegt vorher ein
   background-image in der Kette (Verlauf, Bild), ist der Grund nicht eine
   Farbe: bei einem Verlauf (linear-/radial-gradient) zaehlt jede seiner
   Stufen als moeglicher Grund und gemessen wird der schlechteste; ein Bild
   (url) laesst das Element aus und wird gezaehlt, ebenso Schrift mit
   durchsichtiger Fuellung (Verlaufsschrift), durchscheinende Elemente
   (opacity unter 1, etwa abgeschaltete Knoepfe) und Schrift in SVG. Gemischt
   wird von aussen nach innen ueber "unten" - das, was unter dem Fenster
   liegt. Verlangt: 4,5:1, ab font-size 24px 3:1. */
async function kontrastProbe(page, unten) {
  const roh = await page.evaluate(() => {
    const farbe = (s) => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const t = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [t[0], t[1], t[2], t.length > 3 ? t[3] : 1];
    };
    const sel = (e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") +
      [...e.classList].slice(0, 3).map((c) => "." + c).join("");
    const aus = { elemente: [], uebersprungen: { bild: 0, verlaufsschrift: 0, durchscheinend: 0, svg: 0 } };
    for (const e of document.querySelectorAll("body *")) {
      if (["SCRIPT", "STYLE", "CANVAS", "NOSCRIPT", "TEMPLATE"].includes(e.tagName)) continue;
      const eigen = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!eigen || !e.innerText || !e.innerText.trim()) continue;
      if (!e.getClientRects().length) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden") continue;
      const r = e.getBoundingClientRect();
      if (r.width * r.height <= 4) continue;   // .vh: nur fuer Vorleser
      if (e instanceof SVGElement) { aus.uebersprungen.svg++; continue; }
      let deck = 1;
      for (let a = e; a; a = a.parentElement) deck *= Number(getComputedStyle(a).opacity);
      if (deck <= 0) continue;
      if (deck < 1) { aus.uebersprungen.durchscheinend++; continue; }
      const fg = farbe(cs.webkitTextFillColor || cs.color);
      if (fg[3] === 0) { aus.uebersprungen.verlaufsschrift++; continue; }
      /* Die Kette von innen nach aussen; ein Glied ist eine Liste von
         Farben, die dort liegen koennen: die background-color, und bei einem
         Verlauf jede seiner Stufen darueber (eine davon ist die schlechteste
         Stelle hinter der Schrift). Sie endet am ersten Glied, das ueberall
         deckt. */
      const kette = [];
      let bild = false, verlauf = false;
      for (let a = e; a; a = a.parentElement) {
        const ac = getComputedStyle(a);
        const bg = farbe(ac.backgroundColor);
        const bi = ac.backgroundImage || "none";
        if (bi !== "none" && (/url\(/.test(bi) || !/gradient\(/.test(bi))) { bild = true; break; }
        const stufen = bi === "none" ? [] : (bi.match(/rgba?\([^)]+\)/g) || []).map(farbe);
        if (bi !== "none" && !stufen.length) { bild = true; break; }
        if (stufen.length) verlauf = true;
        if (bg[3] > 0 || stufen.length) kette.push({ bg, stufen });
        if (bg[3] >= 1 || (stufen.length && stufen.every((f) => f[3] >= 1))) break;
      }
      if (bild) { aus.uebersprungen.bild++; continue; }
      aus.elemente.push({ sel: sel(e), text: e.innerText.trim().replace(/\s+/g, " ").slice(0, 40),
        fg, kette, verlauf, gross: parseFloat(cs.fontSize) >= 24 });
    }
    return aus;
  });
  const verstoesse = [];
  let kleinster = Infinity;
  for (const el of roh.elemente) {
    /* alle Gruende, die hinter der Schrift liegen koennen (je Verlaufsstufe
       einer), gemessen wird der schlechteste */
    let gruende = [unten.slice(0, 3)];
    for (const { bg, stufen } of [...el.kette].reverse()) {
      gruende = gruende.map((g) => bg[3] > 0 ? ueber(bg, g) : g);
      if (stufen.length) gruende = gruende.flatMap((g) => stufen.map((f) => ueber(f, g)));
    }
    let k = Infinity, grund = gruende[0];
    for (const g of gruende) { const x = kontrast(ueber(el.fg, g), g); if (x < k) { k = x; grund = g; } }
    const soll = el.gross ? 3 : 4.5;
    kleinster = Math.min(kleinster, k / soll * 4.5);
    if (k < soll) verstoesse.push({ sel: el.sel, text: el.text, wert: Math.round(k * 100) / 100, soll,
      fg: el.fg.join(","), grund: grund.map(Math.round).join(",") });
  }
  verstoesse.sort((a, b) => a.wert - b.wert);
  return { verstoesse, geprueft: roh.elemente.length, uebersprungen: roh.uebersprungen,
    verlauf: roh.elemente.filter((x) => x.verlauf).length, kleinster: Math.round(kleinster * 100) / 100 };
}

/* Die Kopfleiste im Kompakt steht in Ruhe halb durchsichtig (body.compact
   .top > *, je Thema eine Deckung). Gemessen wird jede Schrift darin: ihre
   Farbe ueber dem Grund der Leiste, beides mit der Deckung des Elements
   (Produkt bis html) ueber den Grund gelegt, der Grund ueber "unten". Der
   Zeiger steht dabei nicht auf dem Fenster. Rueckgabe: der kleinste Wert
   und seine Schrift. */
async function kopfKontrast(page, unten) {
  const roh = await page.evaluate(() => {
    const farbe = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0];
      const t = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [t[0], t[1], t[2], t.length > 3 ? t[3] : 1]; };
    const aus = [];
    for (const e of document.querySelectorAll("body.compact .top *")) {
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      if (!e.getClientRects().length || getComputedStyle(e).visibility === "hidden") continue;
      const r = e.getBoundingClientRect(); if (r.width * r.height <= 4) continue;
      let deck = 1; for (let a = e; a; a = a.parentElement) deck *= Number(getComputedStyle(a).opacity);
      if (deck <= 0) continue;
      const kette = [];
      for (let a = e; a; a = a.parentElement) { const bg = farbe(getComputedStyle(a).backgroundColor); if (bg[3] > 0) kette.push(bg); if (bg[3] >= 1) break; }
      aus.push({ text: e.innerText.trim().slice(0, 30), fg: farbe(getComputedStyle(e).color), deck, kette });
    }
    return aus;
  });
  let min = { wert: Infinity, text: "", deck: 1 };
  for (const x of roh) {
    let g = unten.slice(0, 3);
    for (const b of [...x.kette].reverse()) g = ueber(b, g);
    const k = kontrast(ueber([...ueber(x.fg, g), x.deck], g), g);
    if (k < min.wert) min = { wert: Math.round(k * 100) / 100, text: x.text, deck: x.deck };
  }
  return { ...min, n: roh.length };
}

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Eine Seite am gestellten Helfer, wie in test-einst-page.mjs. app: ?win=1
   und nativeFrame (das eigene Fenster der App), sonst ein Browser-Tab.
   config: was GET /api/config antwortet. mica, micaGrund: was /api/state
   dazu meldet (Spezifikation 3.3 und 4.3); fehlen sie, wie ein Helfer ohne
   Mica. material: der Helfer meldet Acrylic (Kompakt). suffix: haengt an
   die URL an (etwa "&kompakt=1"); beispiel: false laedt kein Beispiel und
   wartet nur, bis die Antwort von /api/state verarbeitet ist. Mitgeschrieben: POST /api/config in s.posts. Danach liegt das
   Beispiel-Log offen. hauptprozess: der Helfer spielt den Fall "material"
   in window.ts nach - POST /api/win {do:"material"} setzt Kompakt aus
   kind, /api/state meldet mica nur ausserhalb von Kompakt (micaNow), und
   das Ereignis "material" zaehlt eins hoch (s.zaehler). */
async function oeffne({ app = false, material = false, mica = undefined, micaGrund = undefined, lang = "en", config = {}, breite = 1280, hoehe = 860, suffix = "", beispiel = true, hauptprozess = false } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const s = { page, fehler: [], posts: [], zaehler: { material: 0 }, kompakt: false };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  /* alpha(e): wie deckend der Grund eines Elements ist - die
     background-color oder, liegt ein Verlauf darauf, seine deckendste Stufe;
     null ohne Element. Fuer page.evaluate in den Proben unten. */
  await page.addInitScript(() => {
    const deck = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return 0;
      const t = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return t.length > 3 ? t[3] : 1; };
    window.alpha = (e) => { if (!e) return null; const cs = getComputedStyle(e);
      return Math.max(deck(cs.backgroundColor), ...(cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(deck)); };
  });
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/state") return json({ dir: "", file: "", nativeFrame: app, material: app && material, stayOnTop: false,
      ...(mica === undefined ? {} : { mica: mica && !s.kompakt }), ...(micaGrund === undefined ? {} : { micaGrund }) });
    if (path === "/api/config" && req.method() === "GET") return json(config);
    if (path === "/api/config") { s.posts.push(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
    if (path === "/api/win") {
      const auftrag = req.method() === "POST" ? JSON.parse(req.postData() || "{}") : {};
      if (hauptprozess && auftrag.do === "material") { s.kompakt = auftrag.kind === "acrylic"; s.zaehler.material++; }
      return json({ ok: true, max: false, w: 400, h: 28, on_top: true });
    }
    /* wie server.ts: ?now=1 (der Stand) antwortet sofort, sonst wartet die
       Frage - hier eine Sekunde - und nennt dann die Zaehler */
    if (path === "/api/events") {
      if (!url.searchParams.has("now")) await new Promise((r) => setTimeout(r, 1000));
      return json({ ok: true, registered: true, counts: { ...s.zaehler } });
    }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path === "/api/runs/list") return json({ folder: "saves", files: [] });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  // nur, wenn darauf gewartet wird - sonst bliebe ein Versprechen offen
  const zustand = beispiel ? null : page.waitForResponse((r) => new URL(r.url()).pathname === "/api/state");
  await page.goto("http://boro.test/" + (app ? "?win=1" : "") + suffix);
  if (!beispiel) {
    /* die Antwort von /api/state ist da und verarbeitet: im eigenen Fenster
       setzt 41 im selben Zug html.native (eigenerRahmen) und ruft micaMerken */
    await zustand;
    if (app) await page.waitForFunction(() => document.documentElement.classList.contains("native"));
    return s;
  }
  await page.waitForFunction(() => document.body.dataset.bereit === "ohne");
  await page.evaluate(() => document.querySelector("#btnSample").click());
  await page.waitForFunction(() => !document.querySelector("#app").hidden);
  await page.waitForTimeout(400);
  return s;
}

/* Die Orte der Seite, die der Beispielkampf erreicht: die Bereiche ueber
   die Bereichsleiste (alle elf: ohne Builds seit #207, mit der Gilde; die Proben verlangen, dass jeder erreicht
   wird). Rueckgabe false, wenn der Knopf fehlt oder gesperrt ist. */
const ORTE = ["timeline", "rotation", "analysis", "compare", "history", "party", "start", "settings", "weeklies", "rekorde", "gilde"];
async function gehe(page, ort) {
  const da = await page.evaluate((o) => { const b = document.querySelector(`#bereiche [data-tab="${o}"]`);
    if (!b || b.disabled || !b.getClientRects().length) return false; b.click(); return true; }, ort);
  if (da) await page.waitForTimeout(250);
  return da;
}

/* Flaechenprobe (Spezifikation 4.2): unter html.mica deckt keine grosse
   Flaeche (mehr als 8 % des Fensters) den Desktop mit mehr als 50 % zu -
   ausser denen, die ueber anderem liegen. */
/* Ausgenommen ist genau die Scheibe (--mica-scheibe): sie ist seit der
   Entscheidung vom 04.10. (A) mit .57 dichter als 50 %, damit die
   Reihenfarben darauf 3,10:1 halten. Dafuer darf keine Scheibe auf einer
   anderen liegen (zwei uebereinander deckten wie eine Flaeche). */
const UEBER_ANDEREM = ["#kampfwahl", ".morepanel", ".watchpop", ".tip", ".btip", ".modalbg", ".toast", ".rundgang", "thead", ".bhead", ".einstnav"];
const flaechenProbe = (page) => page.evaluate((ueberAnderem) => {
  const gross = innerWidth * innerHeight * 0.08;
  const i = document.createElement("i"); i.style.background = getComputedStyle(document.documentElement).getPropertyValue("--mica-scheibe").trim();
  document.body.append(i); const scheibe = getComputedStyle(i).backgroundColor; i.remove();
  const istScheibe = (e) => getComputedStyle(e).backgroundColor === scheibe;
  const sichtbar = (e) => { const cs = getComputedStyle(e); return cs.display !== "none" && cs.visibility !== "hidden" && e.getClientRects().length > 0; };
  const name = (e) => e.tagName + (e.id ? "#" + e.id : "") + "." + [...e.classList].join(".");
  const deckend = [...document.querySelectorAll("body, body *")].filter((e) => {
    const r = e.getBoundingClientRect(); if (r.width * r.height < gross) return false;
    if (!sichtbar(e) || ueberAnderem.some((s) => e.closest(s))) return false;
    return alpha(e) > 0.5 && !istScheibe(e);
  }).map(name);
  const doppelt = [...document.querySelectorAll("body *")].filter((e) => {
    if (!sichtbar(e) || !istScheibe(e)) return false;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) if (istScheibe(p)) return true;
    return false;
  }).map((e) => "doppelte Scheibe: " + name(e));
  return [...deckend, ...doppelt];
}, UEBER_ANDEREM);

try {
  /* Rauchglas (Spezifikation 4.1): der deckende Block ist vollstaendig - jede
     Farbe, die TnL neu setzt, setzt auch glas - und deckend: kein Token der
     Flaechen hat Alpha. */
  {
    const s = await oeffne({ config: { theme: "glas" } });
    const z = await s.page.evaluate(() => {
      const regeln = (sel) => [...document.styleSheets].flatMap((sh) => [...sh.cssRules])
        .filter((r) => r.selectorText === sel).flatMap((r) => [...r.style].filter((p) => p.startsWith("--")));
      const tnl = new Set(regeln(':root[data-theme="tnl"]')), glas = new Set(regeln(':root[data-theme="glas"]'));
      const cs = getComputedStyle(document.documentElement);
      return { fehlt: [...tnl].filter((p) => !glas.has(p)), thema: document.documentElement.dataset.theme,
        flaechen: ["--pitch", "--comb", "--comb2", "--raise", "--ridge", "--ridge-soft"].map((p) => [p, cs.getPropertyValue(p).trim()]) };
    });
    assert(z.thema === "glas", "gespeichertes Thema glas gilt beim Start", z.thema);
    assert(z.fehlt.length === 0, "glas setzt jede Farbe, die TnL setzt", z.fehlt);
    assert(z.flaechen.every(([, v]) => /^#[0-9a-f]{6}$/i.test(v)), "die Flaechen von glas sind deckend (#rrggbb)", z.flaechen);

    /* Spezifikation 5.1: auf dem deckenden Rauchgrau liegt das Fenster auf
       seinem eigenen --pitch; darunter scheint nichts. */
    const probe = await kontrastProbe(s.page, [0x1a, 0x18, 0x17]);
    console.log("  info  Kontrastprobe: " + probe.geprueft + " Elemente geprueft, uebersprungen " + JSON.stringify(probe.uebersprungen));
    assert(probe.geprueft > 50, "Kontrastprobe: sie findet Schrift auf der Seite", { geprueft: probe.geprueft, uebersprungen: probe.uebersprungen });
    assert(probe.verstoesse.length === 0, "Rauchgrau: jede Schrift mit 4,5:1 (gross 3:1) auf ihrem Grund",
      { geprueft: probe.geprueft, uebersprungen: probe.uebersprungen, verstoesse: probe.verstoesse.slice(0, 8) });

    /* Spezifikation 5.2: die zwoelf Reihenfarben gegen --comb, der kleinste
       Wert in glas nicht schwaecher als der kleinste in dark. */
    const reihen = await s.page.evaluate(() => {
      const root = document.documentElement, vorher = root.dataset.theme;
      const lies = (thema) => {
        root.dataset.theme = thema;
        const cs = getComputedStyle(root);
        return { comb: cs.getPropertyValue("--comb").trim(),
          reihe: Array.from({ length: 12 }, (_, i) => cs.getPropertyValue("--series-" + (i + 1)).trim()) };
      };
      const aus = { glas: lies("glas"), dark: lies("dark"), tnl: lies("tnl") };
      root.dataset.theme = vorher;
      return aus;
    });
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const liste = reihen.glas.reihe.map((f, i) => ({
      i: i + 1, glas: Math.round(kontrast(hex(f), hex(reihen.glas.comb)) * 100) / 100,
      dark: Math.round(kontrast(hex(reihen.dark.reihe[i]), hex(reihen.dark.comb)) * 100) / 100 }));
    const glasMin = Math.min(...liste.map((x) => x.glas)), dunkelMin = Math.min(...liste.map((x) => x.dark));
    assert(liste.every((x) => Number.isFinite(x.glas) && Number.isFinite(x.dark)), "Reihenfarben: alle zwoelf als #rrggbb lesbar", reihen);
    assert(glasMin >= dunkelMin, "Reihenfarben: auf Rauchgrau nicht schwaecher als in Dunkel", { glasMin, dunkelMin, liste });
    /* Nachtrag 04.10. zur Spezifikation 5.2: jede Farbe fuer sich mindestens 3,10:1
       auf --comb; eine eigene Stufe haelt den Ton von dunkel (OKLCH-Ton
       hoechstens 1 Grad daneben). */
    const ton = (h) => { const [, a, b] = oklab(h); return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; };
    const abweichung = (x, y) => { const d = Math.abs(x - y) % 360; return d > 180 ? 360 - d : d; };
    for (const x of liste) assert(x.glas >= 3.10, `Reihenfarbe ${x.i}: mindestens 3,10:1 auf --comb`, x);
    const eigen = reihen.glas.reihe.map((f, i) => ({ i: i + 1, glas: f, dark: reihen.dark.reihe[i] })).filter((x) => x.glas.toLowerCase() !== x.dark.toLowerCase());
    for (const x of eigen) {
      const d = Math.round(abweichung(ton(x.glas), ton(x.dark)) * 100) / 100;
      assert(d <= 1, `Reihenfarbe ${x.i}: eigene Stufe im Ton von dunkel (${d} Grad)`, { ...x, d });
    }
    assert(eigen.length > 0, "Reihenfarben: die eigenen Stufen von glas gefunden", eigen);
    /* Abstand untereinander: je Mass mindestens der schwaechere Wert von
       dunkel und TnL - beide hier im selben Lauf gemessen. */
    for (const art of [undefined, "protan", "deutan", "tritan"]) {
      const g = kleinsterAbstand(reihen.glas.reihe, art), d = kleinsterAbstand(reihen.dark.reihe, art), t = kleinsterAbstand(reihen.tnl.reihe, art);
      const boden = Math.min(d.wert, t.wert);
      assert(Number.isFinite(g.wert) && g.wert >= boden, "Reihenfarben: Abstand " + (art || "volle Sicht") + " nicht unter dunkel und TnL",
        { glas: g, dunkel: d, tnl: t, boden });
    }

    assert(!s.fehler.length, "Logs: keine Fehler", s.fehler);
    await s.page.close();
  }

  /* Kompakt auf Acrylic (die Toenung --glass ueber DESKTOP_KOMPAKT): die
     ruhende Kopfleiste in glas nicht leiser als in dunkel und
     nie unter den 4,04:1, die der Kommentar bei body.compact .top > * fuer
     dunkel nennt. */
  {
    const kopf = async (thema) => {
      const s = await oeffne({ app: true, material: true, config: { theme: thema } });
      await s.page.evaluate(() => document.querySelector("#btnCompact").click());
      await s.page.waitForFunction(() => document.body.classList.contains("compact"));
      await s.page.evaluate(() => document.activeElement && document.activeElement.blur());
      await s.page.mouse.move(-20, -20);   // der Zeiger ausserhalb des Fensters: die Leiste ruht
      await s.page.waitForTimeout(500);
      const k = await kopfKontrast(s.page, DESKTOP_KOMPAKT);
      const acr = await s.page.evaluate(() => document.documentElement.classList.contains("acrylic") && document.documentElement.dataset.theme);
      const fehler = s.fehler;
      await s.page.close();
      return { ...k, acr, fehler };
    };
    const glas = await kopf("glas"), dunkel = await kopf("dark");
    console.log("  info  Kompakt-Kopf: glas " + glas.wert + " (" + glas.text + ", Deckung " + glas.deck + "), dunkel " + dunkel.wert + " (Deckung " + dunkel.deck + ")");
    assert(glas.acr === "glas" && dunkel.acr === "dark" && glas.n > 0 && dunkel.n > 0 && Number.isFinite(glas.wert) && Number.isFinite(dunkel.wert),
      "Kompakt-Kopf: auf Acrylic, Schrift gefunden", { glas, dunkel });
    assert(glas.deck < 1 && dunkel.deck < 1, "Kompakt-Kopf: gemessen in Ruhe (halb durchsichtig)", { glas, dunkel });
    assert(glas.wert >= 4.04 && glas.wert >= dunkel.wert, "Kompakt-Kopf in Ruhe: glas mindestens 4,04:1 und nicht leiser als dunkel", { glas, dunkel });
    assert(!glas.fehler.length && !dunkel.fehler.length, "Kompakt: keine Fehler", [glas.fehler, dunkel.fehler]);
  }

  /* Spezifikation 4.2: html.mica genau dann, wenn /api/state im eigenen
     Fenster mica: true meldet; der Grund ohne Mica steht an data-mica-grund. */
  {
    const app = await oeffne({ app: true, mica: true, micaGrund: null, config: { theme: "glas" } });
    const browserTab = await oeffne({ app: false, mica: true, config: { theme: "glas" } });
    const alt = await oeffne({ app: true, mica: false, micaGrund: "system", config: { theme: "glas" } });
    const lies = (s) => s.page.evaluate(() => ({ mica: document.documentElement.classList.contains("mica"),
      grund: document.documentElement.dataset.micaGrund ?? null }));
    const [a, b, c] = [await lies(app), await lies(browserTab), await lies(alt)];
    assert(a.mica === true && a.grund === null, "eigenes Fenster mit mica: html.mica", a);
    assert(b.mica === false, "Browser-Tab: nie html.mica, auch wenn der Helfer es meldet", b);
    assert(c.mica === false && c.grund === "system", "ohne Mica: kein html.mica, der Grund steht am html", c);
    for (const s of [app, browserTab, alt]) await s.page.close();
  }

  /* Ohne html.mica (eigenes Fenster, Helfer meldet kein Mica): der Rueckfall
     (Spezifikation 6: alle Flaechen deckend). html, body, die drei Leisten
     und die Buehne deckend; und in jedem Ort liegt jede grosse
     halbdurchsichtige Flaeche auf einem deckenden Grund. Halbdurchsichtig
     sind in jedem Thema nur die Haarlinien-Gruende der Behaelter mit Fugen
     (--hair-rule) und die Toenungen auf Feldern (.vkasten, .cmppick,
     .ablage, .rkseite, .rkleer); beide liegen immer auf Deckendem. */
  {
    const s = await oeffne({ app: true, mica: false, micaGrund: "aus", config: { theme: "glas" } });
    const a = await s.page.evaluate(() => ["html", "body", ".top", ".bereiche", ".statusleiste", ".stage"].map((sel) => [sel, alpha(document.querySelector(sel))]));
    assert(a.every(([, x]) => x === 1), "ohne Mica: html, body, Titel-, Bereichs-, Statusleiste und Buehne deckend", a);
    let erreicht = 0;
    for (const ort of ORTE) {
      if (!(await gehe(s.page, ort))) continue;
      erreicht++;
      const lose = await s.page.evaluate(() => { const g = innerWidth * innerHeight * 0.08;
        return [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect();
          if (r.width * r.height < g || !e.getClientRects().length) return false;
          const x = alpha(e); if (!(x > 0 && x < 1)) return false;
          // unterhalb von body: dass body deckt, ist oben schon gesagt
          for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) if (alpha(p) === 1) return false;
          return true; }).map((e) => e.tagName + (e.id ? "#" + e.id : "") + "." + [...e.classList].join(".")); });
      assert(lose.length === 0, `ohne Mica, ${ort}: jede halbdurchsichtige Flaeche liegt auf Deckendem`, lose);
    }
    assert(erreicht === ORTE.length, "ohne Mica: alle Orte erreicht", { erreicht, orte: ORTE.length });
    await s.page.close();
  }

  /* Das Kompaktfenster (?win=1&kompakt=1) ist auch ein eigenes Fenster, liegt
     aber nie auf Mica - auch wenn /api/state fuer das grosse mica meldet. */
  {
    const s = await oeffne({ app: true, mica: true, micaGrund: "aus", suffix: "&kompakt=1", beispiel: false, config: { theme: "glas" } });
    const z = await s.page.evaluate(() => ({ mica: document.documentElement.classList.contains("mica"),
      grund: document.documentElement.dataset.micaGrund ?? null }));
    assert(z.mica === false && z.grund === null, "Kompaktfenster: nie html.mica, kein Grund", z);
    assert(!s.fehler.length, "Kompaktfenster: keine Fehler", s.fehler);
    await s.page.close();
  }

  /* Die Mica-Schicht (Spezifikation 4.2) in jedem Bereich, den der
     Beispielkampf erreicht: keine grosse Flaeche deckt den Desktop zu, jede
     Schrift lesbar ueber dem schlechtesten Desktop (5.1), was ueber anderem
     liegt bleibt deckend. */
  {
    const s = await oeffne({ app: true, mica: true, micaGrund: null, config: { theme: "glas" } });
    const page = s.page;
    const rahmen = await page.evaluate(() => ({
      mica: document.documentElement.classList.contains("mica"),
      html: alpha(document.documentElement), body: alpha(document.body),
      leisten: [".top", ".bereiche", ".statusleiste"].map((sel) => { const e = document.querySelector(sel), i = document.createElement("i");
        i.style.background = getComputedStyle(document.documentElement).getPropertyValue("--mica-scheibe").trim(); document.body.append(i);
        const soll = getComputedStyle(i).backgroundColor; i.remove(); return [sel, getComputedStyle(e).backgroundColor === soll]; }) }));
    assert(rahmen.mica && rahmen.html === 0, "Mica: html durchsichtig", rahmen);
    assert(rahmen.body > 0 && rahmen.body < 0.5, "Mica: body nur der Fenstergrund (halb durchsichtig)", rahmen);
    // #189: vor einem hellen Fenster traegt der Fenstergrund keine Schrift mehr - die Leisten liegen auf der Scheibe
    assert(rahmen.leisten.every(([, s]) => s), "Mica: Titel-, Bereichs- und Statusleiste auf der Scheibe (#189)", rahmen);

    /* Entscheidung 04.10. (A zur Scheibe): jede Reihenfarbe haelt auf der Scheibe
       ueber dem Fenstergrund ueber dem schlechtesten Desktop mindestens
       3,10:1 - wie auf --comb. Die Werte kommen aus dem CSS der Seite. */
    const glasFarben = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const lies = (v) => { const e = document.createElement("i"); e.style.background = v; document.body.append(e);
        const c = getComputedStyle(e).backgroundColor; e.remove(); return c; };
      return { grund: lies(cs.getPropertyValue("--mica-grund").trim()), scheibe: lies(cs.getPropertyValue("--mica-scheibe").trim()),
        reihe: Array.from({ length: 12 }, (_, i) => cs.getPropertyValue("--series-" + (i + 1)).trim()) };
    });
    const rgba = (x) => { const t = x.match(/rgba?\(([^)]+)\)/)[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [t[0], t[1], t[2], t.length > 3 ? t[3] : 1]; };
    const scheibeGrund = ueber(rgba(glasFarben.scheibe), ueber(rgba(glasFarben.grund), SCHLECHTESTER_DESKTOP));
    const hexF = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    for (const [i, f] of glasFarben.reihe.entries()) {
      const k = Math.round(kontrast(hexF(f), scheibeGrund) * 1000) / 1000;
      assert(k >= 3.10, `Reihenfarbe ${i + 1} auf der Scheibe ueber #929292: mindestens 3,10:1 (${k})`, { f, k, ...glasFarben });
    }

    let erreicht = 0;
    for (const ort of ORTE) {
      const da = await gehe(page, ort);
      assert(da, `${ort}: erreichbar`);
      if (!da) continue;
      erreicht++;
      const flaechen = await flaechenProbe(page);
      assert(flaechen.length === 0, `${ort}: unter Mica deckt keine grosse Flaeche (> 8 %) mit mehr als 50 %`, flaechen);
      /* Scheiben: sichtbare Elemente genau in der Farbe --mica-scheibe. Start
         hat keine: seine zwei Kacheln (.ablage, .landsetup) sind in jedem
         Thema eine Toenung (.34) und bleiben das. */
      const scheiben = await page.evaluate(() => { const farbe = getComputedStyle(document.documentElement).getPropertyValue("--mica-scheibe").trim();
        const probe = document.createElement("i"); probe.style.background = farbe; document.body.append(probe);
        const soll = getComputedStyle(probe).backgroundColor; probe.remove();
        return [...document.querySelectorAll("body *")].filter((e) => e.getClientRects().length && getComputedStyle(e).backgroundColor === soll).length; });
      if (ort !== "start") assert(scheiben > 0, `${ort}: die Felder tragen die Scheibe (${scheiben})`, scheiben);
      const probe = await kontrastProbe(page, SCHLECHTESTER_DESKTOP);
      console.log(`  info  ${ort}: Kontrastprobe ${probe.geprueft} geprueft, uebersprungen ${JSON.stringify(probe.uebersprungen)}, Verlauf aufgeloest ${probe.verlauf}, kleinster ${probe.kleinster}`);
      const ueber = Object.values(probe.uebersprungen).reduce((x, y) => x + y, 0);
      assert(probe.geprueft > 0 && ueber < probe.geprueft, `${ort}: Kontrastprobe prueft mehr, als sie ueberspringt`, { geprueft: probe.geprueft, uebersprungen: probe.uebersprungen });
      assert(probe.verstoesse.length === 0, `${ort}: auf dem Glasgrund ueber #929292 jede Schrift mit 4,5:1 (gross 3:1)`, probe.verstoesse.slice(0, 8));
    }
    assert(erreicht === ORTE.length, "Mica: alle Orte erreicht", { erreicht, orte: ORTE.length });
    const nav = await page.evaluate(() => alpha(document.querySelector("#einstNav")));
    assert(nav === 1, "Mica: die Sprungleiste der Einstellungen bleibt deckend", nav);

    /* Was ueber anderem liegt, bleibt deckend: Kampfwahl, Menue, Tooltip,
       Dialog, Toast, haftender Tabellenkopf, Rundgang. */
    await gehe(page, "timeline");
    const deckend = await page.evaluate(() => {
      document.querySelector("#kwKnopf").click();
      const a = (sel) => { const e = document.querySelector(sel); return e ? alpha(e) : null; };
      return { kampfwahl: a("#kampfwahl"), menue: a("#morePanel"), tooltip: a("#tip"), dialog: a("#modal"),
        toast: a("#toast"), kopf: a(".table .bhead"), rundgang: a("#rundgang") };
    });
    await page.keyboard.press("Escape");
    /* der Rundgang, aus den Einstellungen gestartet: die Karte offen und deckend */
    await gehe(page, "settings");
    await page.evaluate(() => document.querySelector("#eRundgang").click());
    await page.waitForFunction(() => { const r = document.querySelector("#rundgang"); return !!r && !r.hidden && r.getClientRects().length > 0; });
    deckend.rundgang = await page.evaluate(() => alpha(document.querySelector("#rundgang")));
    await page.keyboard.press("Escape");
    for (const [name, wert] of Object.entries(deckend)) assert(wert === 1, `Mica: ${name} bleibt deckend`, deckend);
    assert(!s.fehler.length, "Mica: keine Fehler", s.fehler);
    await page.close();
  }

  /* Kompakt im selben Fenster (Rueckfall ohne Kompaktfenster): beim Eintritt
     geht html.mica, beim Verlassen kommt es wieder. Der Hauptprozess meldet
     beides ueber das Ereignis "material" (window.ts), die Seite fragt dann
     /api/state neu. Vorher kam html.mica nach Kompakt nicht zurueck. */
  {
    const s = await oeffne({ app: true, mica: true, micaGrund: null, material: true, hauptprozess: true, config: { theme: "glas" } });
    const mica = () => s.page.evaluate(() => document.documentElement.classList.contains("mica"));
    const warte = (soll) => s.page.waitForFunction((x) => document.documentElement.classList.contains("mica") === x, soll, { timeout: 10000 })
      .then(() => true, () => false);
    assert(await mica(), "Kompakt im selben Fenster: vorher html.mica");
    /* die Seite hat den Stand der Zaehler und horcht (erste Frage mit seen=) */
    await s.page.waitForRequest((r) => new URL(r.url()).pathname === "/api/events" && new URL(r.url()).searchParams.has("seen"));
    await s.page.evaluate(() => document.querySelector("#btnCompact").click());
    await s.page.waitForFunction(() => document.body.classList.contains("compact"));
    assert(await warte(false), "Kompakt im selben Fenster: im Kompakt kein html.mica", { zaehler: s.zaehler, kompakt: s.kompakt });
    await s.page.evaluate(() => document.querySelector("#btnCompact").click());
    await s.page.waitForFunction(() => !document.body.classList.contains("compact"));
    assert(await warte(true), "Kompakt im selben Fenster: nach Kompakt html.mica wieder da", { zaehler: s.zaehler, kompakt: s.kompakt });
    assert(s.zaehler.material === 2, "Kompakt im selben Fenster: zwei Ereignisse material", s.zaehler);
    assert(!s.fehler.length, "Kompakt im selben Fenster: keine Fehler", s.fehler);
    await s.page.close();
  }

  /* Kompakt: die Schicht greift nie - body und .top wie ohne html.mica. */
  {
    const kompakt = async (mica, material = true) => {
      const s = await oeffne({ app: true, mica, material, config: { theme: "glas" } });
      await s.page.evaluate(() => document.querySelector("#btnCompact").click());
      await s.page.waitForFunction(() => document.body.classList.contains("compact"));
      await s.page.waitForTimeout(300);
      const z = await s.page.evaluate(() => ({ mica: document.documentElement.classList.contains("mica"),
        body: getComputedStyle(document.body).backgroundColor, top: getComputedStyle(document.querySelector(".top")).backgroundColor,
        html: getComputedStyle(document.documentElement).backgroundColor }));
      await s.page.close();
      return z;
    };
    const mit = await kompakt(true), ohne = await kompakt(false);
    assert(mit.mica === true && mit.body === ohne.body && mit.top === ohne.top && mit.html === ohne.html,
      "Kompakt: die Mica-Schicht greift nicht", { mit, ohne });
    /* auch wenn Kompakt (gegen die Regel) nicht auf Acrylic laege */
    const mit2 = await kompakt(true, false), ohne2 = await kompakt(false, false);
    assert(mit2.mica === true && mit2.body === ohne2.body && mit2.top === ohne2.top && mit2.html === ohne2.html,
      "Kompakt ohne Acrylic: die Mica-Schicht greift nicht", { mit2, ohne2 });
  }

  /* Spezifikation 4.3: ist Rauchglas gewaehlt und kein Mica da, steht unter
     der Kachel leise der Grund - je Fall ein eigener Satz, in einem anderen
     Thema keiner. */
  {
    const saetze = {};
    for (const [fall, opt, schluessel] of [
      ["Browser", { app: false }, "browser"],
      ["altes System", { app: true, mica: false, micaGrund: "system" }, "system"],
      ["Transparenz aus", { app: true, mica: false, micaGrund: "aus" }, "aus"],
      ["mit Mica", { app: true, mica: true, micaGrund: null }, null],
    ]) {
      const s = await oeffne({ ...opt, lang: "de", config: { theme: "glas" } });
      await s.page.evaluate(() => document.querySelector('#bereiche [data-tab="settings"]').click());
      const z = await s.page.evaluate(() => { const e = document.querySelector("#eGlasOhne"); return { hidden: e.hidden, text: e.textContent }; });
      if (schluessel === null) assert(z.hidden, `${fall}: kein Satz unter der Kachel`, z);
      else { assert(!z.hidden && z.text.length > 10, `${fall}: der Grund steht unter der Kachel`, z); saetze[schluessel] = z.text; }
      await s.page.evaluate(() => document.querySelector('#eThema [data-theme="dark"]').click());
      assert(await s.page.evaluate(() => document.querySelector("#eGlasOhne").hidden), `${fall}: in Dunkel kein Satz`);
      assert(!s.fehler.length, `${fall}: keine Fehler`, s.fehler);
      await s.page.close();
    }
    assert(new Set(Object.values(saetze)).size === 3, "drei Gruende, drei verschiedene Saetze", saetze);
  }

  /* 560 px: in glas auf Mica nirgends waagerechtes Rollen. */
  {
    const s = await oeffne({ app: true, mica: true, breite: 560, hoehe: 900, config: { theme: "glas" } });
    let erreicht = 0;
    for (const ort of ORTE) {
      if (!(await gehe(s.page, ort))) continue;
      erreicht++;
      const w = await s.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
      assert(w.sw <= w.iw, `560 px, ${ort}: kein waagerechtes Rollen`, w);
    }
    assert(erreicht === ORTE.length, "560 px: alle Orte erreicht", { erreicht, orte: ORTE.length });
    await s.page.close();
  }
} finally {
  await browser.close();
}

console.log();
if (failed) { console.log(`GLAS PAGE FAILED - ${failed}`); process.exit(1); }
console.log("GLAS PAGE PASSED");
