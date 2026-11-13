// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die Probe zum Layout der Analyse (Issue #236): bei jeder Zoomstufe der App
// und jeder von vier Fenstergroessen, ruhig und mit gedrueckter Fahne, am
// Beispielkampf der gebauten Seite. Sie misst, was am 14.10.2026 im
// Fenster zu sehen war: Faecher ueber dem Streifen, ein Name Buchstabe fuer
// Buchstabe, Texte, die in andere Texte laufen. Eingebunden von
// test-analyse-page.mjs; allein lauffaehig mit `node scripts/analyse-layout-probe.mjs`
// (nach npm run build:renderer).

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const GROESSEN = [[1890, 1285], [2000, 1480], [1280, 860], [560, 900]];
export const STUFEN = [75, 100, 125, 150, 200];

/* Lauft in der Seite: gibt je Pruefung die Fundstellen zurueck (leer = gut). */
function messen() {
  const sichtbar = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== "hidden" && !e.closest("[hidden]");
  };
  const panel = document.querySelector("#p-analysis");
  const R = (e) => e.getBoundingClientRect();
  const name = (e) => (e.dataset?.n || e.id || e.className || e.tagName).toString().slice(0, 30);
  const ov = (a, b) => a.left < b.right - 1.5 && b.left < a.right - 1.5 && a.top < b.bottom - 1.5 && b.top < a.bottom - 1.5;
  const aus = {};

  // 1 - die Karten des Pruefstands (seit #414 statt der Faecher der Werkbank): nicht ueber dem Kopf (Urteil, Kennzeile), nicht ineinander
  const faecher = [...document.querySelectorAll("#a2 .a2karte")].filter(sichtbar);
  const streifen = document.querySelector("#analysisCall");
  aus.faecherUeberStreifen = streifen && sichtbar(streifen) ? faecher.filter((f) => ov(R(f), R(streifen))).map(name) : [];
  aus.faecherIneinander = [];
  for (let i = 0; i < faecher.length; i++) for (let j = i + 1; j < faecher.length; j++)
    if (ov(R(faecher[i]), R(faecher[j]))) aus.faecherIneinander.push(name(faecher[i]) + "/" + name(faecher[j]));
  // der Inhalt eines Fachs bleibt in seinem Fach
  aus.faecherInhaltUeber = faecher.filter((f) => f.scrollHeight > f.clientHeight + 1).map(name);

  // 2 - kein Text ueber einem anderen (Zeilenkasten je Textknoten; die Kurve selbst ausgenommen)
  const knoten = [];
  const lauf = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
  for (let n = lauf.nextNode(); n; n = lauf.nextNode()) {
    if (!n.textContent.trim()) continue;
    const e = n.parentElement;
    if (!e || e.closest("#a2kurve, svg, .vh, script, style, [hidden]") || !sichtbar(e)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const zeilen = [...rg.getClientRects()].filter((r) => r.width > 2 && r.height > 2)
      .map((r) => ({ left: r.left, right: r.right, top: r.top + r.height * 0.2, bottom: r.bottom - r.height * 0.2 }));
    if (zeilen.length) knoten.push({ n, e, zeilen });
  }
  aus.textUeberText = [];
  for (let i = 0; i < knoten.length && aus.textUeberText.length < 8; i++)
    for (let j = i + 1; j < knoten.length; j++) {
      const a = knoten[i], b = knoten[j];
      if (a.zeilen.some((x) => b.zeilen.some((y) => ov(x, y)))) {
        aus.textUeberText.push((a.n.textContent.trim().slice(0, 24)) + " | " + (b.n.textContent.trim().slice(0, 24)));
        if (aus.textUeberText.length >= 8) break;
      }
    }

  // 3 - kein Wort bricht mitten im Wort (ein Name Buchstabe fuer Buchstabe): jedes Wort in einer Zeile
  aus.wortGebrochen = [];
  for (const { n } of knoten) {
    const t = n.textContent;
    for (const m of t.matchAll(/[^\s \-–—\/]{4,}/g)) {
      const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
      const zl = [...rg.getClientRects()].filter((r) => r.width > 1);
      if (zl.length > 1 && new Set(zl.map((r) => Math.round(r.top / 4))).size > 1) { aus.wortGebrochen.push(m[0].slice(0, 24)); break; }
    }
    if (aus.wortGebrochen.length >= 8) break;
  }
  // und kein Name schmaler als sein laengstes Wort
  const cv = document.createElement("canvas").getContext("2d");
  aus.nameZuSchmal = [...panel.querySelectorAll(".a2karte .nmt")].filter(sichtbar).filter((e) => {
    if (getComputedStyle(e).textOverflow === "ellipsis") return false;
    // Wort fuer Wort je Textknoten, in der Schrift seines eigenen Elements (der Name und sein <small> haben zwei)
    let wort = 0;
    const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const cs = getComputedStyle(n.parentElement);
      cv.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      for (const x of n.textContent.split(/\s+/).filter(Boolean)) { const bw = cv.measureText(x).width; if (bw > wort) { wort = bw; e.dataset.wort = x + "@" + cs.fontSize; } }
    }
    e.dataset.msg = Math.round(e.clientWidth) + "<" + Math.round(wort) + " " + e.dataset.wort;
    return e.clientWidth < wort * 0.95;
  }).map((e) => e.textContent.trim().slice(0, 24) + " " + e.dataset.msg);

  // 4 - nichts abgeschnitten, ohne dass man rollen kann (Ellipse mit title ausgenommen)
  aus.abgeschnitten = [...panel.querySelectorAll("*")].filter((e) => {
    if (e.closest("svg, #a2kurve, .vh, [hidden]") || e.classList.contains("vh") || !sichtbar(e)) return false;
    const cs = getComputedStyle(e);
    if (cs.textOverflow === "ellipsis") return false;
    const kappt = (o) => o === "hidden" || o === "clip";
    return (kappt(cs.overflowY) && e.scrollHeight > e.clientHeight + 1) || (kappt(cs.overflowX) && e.scrollWidth > e.clientWidth + 1);
  }).map(name).slice(0, 8);

  // 5 - der Fuss ist erreichbar: ganz unten steht er ueber der Statusleiste
  const fuss = document.querySelector("#afuss"), leiste = document.querySelector("#statusleiste");
  if (fuss && sichtbar(fuss)) {
    window.scrollTo(0, 1e7);   // ganz nach unten, wie mit dem Mausrad; scrollIntoView stellte ihn unter die Leiste
    const unten = leiste && sichtbar(leiste) ? R(leiste).top : innerHeight;
    aus.fussUnerreichbar = R(fuss).bottom > unten + 1.5 ? [Math.round(R(fuss).bottom) + ">" + Math.round(unten)] : [];
    window.scrollTo(0, 0);
  } else aus.fussUnerreichbar = ["kein Fuss"];

  // 6 - kein waagerechtes Rollen, nichts ragt rechts hinaus
  aus.ragtHinaus = [...panel.querySelectorAll("#findings > *, #a2, #a2 .a2karte, .urteil, #afuss")]
    .filter(sichtbar).filter((e) => R(e).right > innerWidth + 1.5).map(name);
  return aus;
}

/* @param browser  ein Playwright-Browser
   @param dist     Pfad der gebauten index.html
   @param pruefe   (bedingung, name, detail) wie assert im Test */
export async function layoutProbe(browser, dist, pruefe, { sprache = "de", thema = "dark" } = {}) {
  for (const [w, h] of GROESSEN) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const fehler = [];
    page.on("pageerror", (e) => fehler.push(String(e)));
    await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* storage blocked */ } }, sprache);
    await page.goto("file://" + dist);
    await page.evaluate(() => document.querySelector("#btnSample").click());
    await page.waitForFunction(() => /Ramux/.test(document.querySelector("#hName")?.textContent || ""), null, { timeout: 5000 });
    await page.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`)?.click(), thema);
    await page.evaluate(() => document.querySelector('[data-tab="analysis"]').click());
    await page.waitForTimeout(250);
    for (const z of STUFEN) {
      for (let i = 0; i < 14; i++) {
        const jetzt = parseInt(await page.evaluate(() => document.querySelector("#sbZoom").textContent), 10);
        if (jetzt === z) break;
        await page.keyboard.press(jetzt < z ? "Control+=" : "Control+-");
        await page.waitForTimeout(60);
      }
      for (const zustand of ["ruhig", "Bereich gesetzt"]) {
        await page.evaluate(() => document.querySelector("#a2ganz")?.click());
        if (zustand !== "ruhig") await page.evaluate(() => document.querySelector("#a2marken .a2marke.luecke")?.click());
        await page.waitForTimeout(500);
        const r = await page.evaluate(messen);
        const wo = `Analyse ${w} x ${h}, Zoom ${z} %, ${zustand}` + (sprache !== "de" || thema !== "dark" ? ` (${sprache}, ${thema})` : "");
        if (zustand !== "ruhig")
          pruefe(await page.evaluate(() => !!document.querySelector("#a2brush") && !document.querySelector("#a2brush").hidden), wo + ": der Bereich steht (die Probe misst den Zustand)");
        pruefe(r.faecherUeberStreifen.length === 0, wo + ": kein Fach ueber dem Streifen", r.faecherUeberStreifen);
        pruefe(r.faecherIneinander.length === 0, wo + ": kein Fach in einem anderen", r.faecherIneinander);
        pruefe(r.faecherInhaltUeber.length === 0, wo + ": der Inhalt jedes Fachs passt hinein", r.faecherInhaltUeber);
        pruefe(r.textUeberText.length === 0, wo + ": kein Text laeuft in einen anderen", r.textUeberText);
        pruefe(r.wortGebrochen.length === 0, wo + ": kein Wort bricht mitten im Wort", r.wortGebrochen);
        pruefe(r.nameZuSchmal.length === 0, wo + ": kein Name schmaler als sein laengstes Wort", r.nameZuSchmal);
        pruefe(r.abgeschnitten.length === 0, wo + ": nichts abgeschnitten, ohne dass man rollen kann", r.abgeschnitten);
        pruefe(r.fussUnerreichbar.length === 0, wo + ": der Fuss ist erreichbar", r.fussUnerreichbar);
        pruefe(r.ragtHinaus.length === 0, wo + ": nichts ragt rechts hinaus", r.ragtHinaus);
      }
    }
    pruefe(!fehler.length, `Analyse ${w} x ${h}: keine Fehler in der Seite`, fehler);
    await page.close();
  }
}

// allein: node scripts/analyse-layout-probe.mjs
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const { chromium } = await import("playwright");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  let rot = 0;
  const b = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});
  await layoutProbe(b, process.env.ANALYSE_DIST || join(root, "dist", "renderer", "index.html"), (ok, name, detail) => {
    if (!ok) { rot++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail))); }
  }, { sprache: process.env.PROBE_SPRACHE || "de", thema: process.env.PROBE_THEMA || "dark" });
  await b.close();
  console.log(rot ? rot + " rot" : "alles gruen");
}
