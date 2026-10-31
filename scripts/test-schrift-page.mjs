// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Eine Schrift fuer alle Fenster (#342, Spezifikation 2026-10-30-schrift-frei-design.md):
// (a) jeder Text steht in Anton oder Source Sans 3, in allen Bereichen und vier Themen;
// (b) Kontur und Schattenversatz sind GANZE Geraete-Pixel, mindestens eines, bei Zoom 75, 100, 150;
// (c) dunkle Schrift auf Gold (--ink-on-gold, --acc-ink) hat keine Kontur und keinen Schatten;
// (d) beide Schriften sind geladen (document.fonts.check), bevor der erste Bereich zeichnet.
// Gewartet wird auf Zustaende (document.fonts.ready, Animationen), nie auf feste Zeit (#224).
//
// Run:  npm run test:schrift-page     (baut die Seite zuerst)
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATEI = "file:///" + join(root, "dist", "renderer", "index.html").replace(/\\/g, "/").replace(/^\/+/, "");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 700))); }
}

const THEMEN = ["dark", "light", "tnl", "glas"];
const ORTE = ["timeline", "rotation", "analysis", "compare", "history", "party", "start", "settings", "weeklies", "rekorde", "gilde", "archiv"];
const STUFEN = [75, 100, 150];

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(String(e)));
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* blockiert */ } });
  /* (d) die Schriften sind geladen, bevor der erste Bereich zeichnet: gleich nach dem Laden, vor dem Beispielkampf */
  await page.goto(DATEI);
  await page.waitForSelector("#btnSample", { state: "attached" });
  await page.evaluate(() => document.fonts.ready);
  const geladen = await page.evaluate(() => ({ anton: document.fonts.check("12px Anton"), text: document.fonts.check("12px 'Source Sans 3'"),
    text600: document.fonts.check("600 12px 'Source Sans 3'"), text700: document.fonts.check("700 12px 'Source Sans 3'") }));
  assert(geladen.anton, "(d) Anton ist geladen, bevor der erste Bereich zeichnet", geladen);
  assert(geladen.text && geladen.text600 && geladen.text700, "(d) Source Sans 3 (400, 600, 700) ist geladen", geladen);

  await page.evaluate(() => document.querySelector("#btnSample").click());
  await page.waitForFunction(() => !document.querySelector("#app").hidden);

  const gehe = async (ort) => {
    const da = await page.evaluate((o) => { const b = document.querySelector(`#bereiche [data-tab="${o}"]`);
      if (!b || b.disabled || !b.getClientRects().length) return false; b.click(); return true; }, ort);
    if (da) {
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.waitForFunction(() => document.getAnimations().every((a) => a.effect?.getComputedTiming().iterations === Infinity || a.playState !== "running"));
    }
    return da;
  };
  const zoomAuf = async (stufe) => {
    await page.keyboard.press("Control+0");
    let guard = 0;
    while (guard++ < 12) {
      const z = await page.evaluate(() => Math.round(parseFloat(document.documentElement.style.zoom || "1") * 100));
      if (z === stufe) break;
      await page.keyboard.press(z < stufe ? "Control+=" : "Control+-");
    }
  };

  /* Messung im Browser: gesammelt werden Verstoesse, nicht Werte */
  const messen = (pruefeKontur) => page.evaluate((pruefeKontur) => {
    const frei = new Set(["SCRIPT", "STYLE", "CANVAS", "NOSCRIPT", "TEMPLATE", "HEAD", "TITLE", "META", "LINK"]);
    const zoom = parseFloat(document.documentElement.style.zoom || "1"), q = window.devicePixelRatio, f = zoom * q;
    const ganz = (x) => Math.abs(x - Math.round(x)) < 0.02;
    /* Gold ist keine Farbe, die sich vom Text unterscheiden laesst (--acc-ink ist im dunklen Thema hell): gesucht werden die Regeln, die
       --ink-on-gold oder --acc-ink als color setzen, und alle Elemente, auf die sie passen, samt ihren Kindern. */
    const gold = new Set();
    const regeln = (liste) => { for (const r of liste) {
      if (r.cssRules && !r.selectorText) { try { regeln(r.cssRules); } catch { /* fremd */ } continue; }
      if (!r.selectorText || !r.style) continue;
      const c = r.style.getPropertyValue("color");
      if (!/--ink-on-gold|--acc-ink/.test(c)) continue;
      let ziele = [];
      try { ziele = [...document.querySelectorAll(r.selectorText.replace(/::?(before|after|hover|focus-visible|focus|active|disabled)/g, ""))]; } catch { /* Selektor ohne Treffer */ }
      for (const z of ziele) { gold.add(z); for (const k of z.querySelectorAll("*")) gold.add(k); }
    } };
    for (const s of document.styleSheets) { try { regeln(s.cssRules); } catch { /* fremd */ } }
    const aus = { familie: [], kontur: [], gold: [], n: 0, goldN: 0 };
    const sel = (e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + [...e.classList].slice(0, 3).map((c) => "." + c).join("");
    for (const e of document.querySelectorAll("body *")) {
      if (frei.has(e.tagName) || !e.getClientRects().length) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const eigen = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const steuer = /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.tagName);
      if (!eigen && !steuer) continue;
      const rr = e.getBoundingClientRect();
      if (rr.width * rr.height <= 4 || e.closest(".vh")) continue;   // .vh: nur fuer Vorleser
      aus.n++;
      const erste = cs.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
      if (erste !== "Anton" && erste !== "Source Sans 3") aus.familie.push(sel(e) + ": " + erste);
      const strich = parseFloat(cs.webkitTextStrokeWidth) || 0;
      const sch = [...cs.textShadow.replace(/rgba?\([^)]*\)|color\([^)]*\)/g, "").matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g)].map((m) => [parseFloat(m[1]), parseFloat(m[2])]);
      const istGold = gold.has(e);
      if (istGold) {
        aus.goldN++;
        if (strich !== 0 || cs.textShadow !== "none") aus.gold.push(sel(e) + ": strich " + strich + ", schatten " + cs.textShadow.slice(0, 40));
        continue;
      }
      if (!pruefeKontur) continue;
      /* ohne Strich (Eingabefelder, Steuerelemente ohne Text) kein Befund; Text mit Strich muss ganze Pixel haben */
      if (strich * f < 0.98 || !ganz(strich * f)) aus.kontur.push(sel(e) + ": strich " + (strich * f).toFixed(3) + " Geraete-px");
      else if (!sch.length || sch.some(([x, y]) => !ganz(x * f) || !ganz(y * f))) aus.kontur.push(sel(e) + ": schatten " + cs.textShadow.slice(0, 80));
    }
    return aus;
  }, pruefeKontur);
  const knapp = (l) => [...new Set(l)].slice(0, 6);

  let goldGesehen = 0;
  /* (a) und (c): alle Bereiche, alle Themen, Zoom 100 */
  for (const theme of THEMEN) {
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    for (const ort of ORTE) {
      if (!(await gehe(ort))) continue;
      const m = await messen(false);
      assert(m.n > 0 && !m.familie.length, `(a) ${theme}/${ort}: ${m.n} Texte in Anton oder Source Sans 3`, knapp(m.familie));
      goldGesehen += m.goldN;
      assert(!m.gold.length, `(c) ${theme}/${ort}: dunkle Schrift auf Gold ohne Kontur und Schatten`, knapp(m.gold));
    }
  }
  assert(goldGesehen > 20, "(c) die Probe hat dunkle Schrift auf Gold wirklich gesehen", goldGesehen);
  /* (b): Zoomstufen, zwei Bereiche (Kampf, Analyse) in allen Themen, dazu bei 100 alle Bereiche im dunklen Thema */
  for (const stufe of STUFEN) {
    await zoomAuf(stufe);
    for (const theme of THEMEN) {
      await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      for (const ort of ["timeline", "analysis"]) {
        if (!(await gehe(ort))) continue;
        const m = await messen(true);
        assert(!m.kontur.length, `(b) Zoom ${stufe} %, ${theme}/${ort}: Kontur und Schatten in ganzen Geraete-Pixeln`, knapp(m.kontur));
      }
    }
  }
  await zoomAuf(100);
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  for (const ort of ORTE) {
    if (!(await gehe(ort))) continue;
    const m = await messen(true);
    assert(!m.kontur.length, `(b) Zoom 100 %, dark/${ort}: Kontur und Schatten in ganzen Geraete-Pixeln`, knapp(m.kontur));
  }
  assert(!fehler.length, "keine Seitenfehler", fehler);
} finally {
  await browser.close();
}
if (failed) { console.log("\n" + failed + " FAILED"); process.exit(1); }
console.log("\nok");
