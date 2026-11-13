// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Glutring, Mitte (#335): jede Zeile des Mittelblocks (#ringMitte) liegt im
// Loch des Rings. Gemessen wird an der gebauten Seite im Beispielkampf mit der
// Erzaehlung eines gezeigten Bogens (die Zeilen: Fahigkeit und Schaden,
// Treffer und Krit, "zum letzten Pull"): jedes Zeilenrechteck des Textes muss
// mit allen vier Ecken im Kreis mit dem Radius des Lochs minus Rand liegen -
// die Sehne auf der Hoehe der Zeile, nicht die Breite des Blocks. Fenster,
// Vergroesserung, Themen und beide Sprachen; Fantasiewerte, keine Namen.
//
// Run:  npm run test:glutring-mitte-page     (baut die Seite zuerst)

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
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

async function oeffne({ lang, config, breite, hoehe }) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/state") return json({ dir: "", file: "", nativeFrame: true, material: false, stayOnTop: false });
    if (path === "/api/config" && req.method() === "GET") return json({ rundgangGesehen: true, bereichHinweise: false, ...config });
    if (path === "/api/win") return json({ ok: true, max: false, w: 400, h: 28, on_top: true });
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: {} }); }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html?win=1");
  await page.waitForFunction(() => document.body.dataset.bereit === "ohne");
  await page.evaluate(() => document.querySelector("#btnSample").click());
  await page.waitForFunction(() => !document.querySelector("#app").hidden && !!document.querySelector("#ring")?.dataset.mitte);
  return { page, fehler };
}

/* Zeigt den groessten Bogen (Maus auf den Bogen rechts vom Scheitel), wartet
   auf die Erzaehlung und misst jedes Zeilenrechteck gegen das Loch. */
const LANG_NAME = { de: "Verheerender Schlag der Aschenfürsten des Sturms", en: "Devastating Strike of the Ash Lords of the Storm" };
async function messen(page, szenario, lang) {
  const ziel = await page.evaluate(() => {
    const cv = document.querySelector("#ring"), m = JSON.parse(cv.dataset.mitte), b = cv.getBoundingClientRect();
    const rr = (m.r0 + m.r1) / 2, w = 8 * Math.PI / 180;
    return { x: b.left + m.x + rr * Math.sin(w), y: b.top + m.y - rr * Math.cos(w) };
  });
  await page.mouse.move(ziel.x - 40, ziel.y + 60);
  await page.mouse.move(ziel.x, ziel.y);
  await page.waitForFunction(() => document.querySelector("#ringFokus")?.textContent.trim().length > 0);
  await page.waitForFunction(() => document.querySelector("#ringMitte").getBoundingClientRect().height > 0);
  /* Die Zeilen der Erzaehlung bekommen die Zahlen eines grossen Kampfes
     (vier Stellen Treffer, 100 %, 661.4k) und einen langen Namen; der Bau
     der Zeilen (fett, Umbruch, leiser Rest) bleibt der des Programms. */
  if (szenario !== "normal") await page.evaluate(([sz, name]) => {
    const f = document.querySelector("#ringFokus"), b = f.querySelector("b"), sp = f.querySelector("span");
    if (sz === "lang") b.textContent = name;
    sp.textContent = sp.textContent.replace(/^[\d.,]+/, "4.406").replace(/\d+(?=[\u00a0 ]?%)/, "100").replace(/\d+[.,]\dk/, "661.4k");
    const p = document.querySelector("#hPrev"); if (!p.hidden) p.textContent = p.textContent.replace(/\d+/, "150");
  }, [szenario, LANG_NAME[lang]]);
  return page.evaluate(() => {
    const cv = document.querySelector("#ring"), m = JSON.parse(cv.dataset.mitte), b = cv.getBoundingClientRect();
    const cx = b.left + m.x, cy = b.top + m.y, z = m.z || 1, rand = 6 * z, grenze = m.r0 - rand;
    const mitte = document.querySelector("#ringMitte"), zeilen = [];
    const walker = document.createTreeWalker(mitte, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el.getClientRects().length || el.closest("[hidden]")) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const q of r.getClientRects()) {
        if (q.width < 1) continue;
        const ecken = [[q.left, q.top], [q.right, q.top], [q.left, q.bottom], [q.right, q.bottom]];
        const fern = Math.max(...ecken.map(([x, y]) => Math.hypot(x - cx, y - cy)));
        zeilen.push({ text: n.textContent.trim().slice(0, 28), b: Math.round(q.width / z), fern: Math.round(fern), grenze: Math.round(grenze), drin: fern <= grenze });
      }
    }
    return { erz: document.querySelector("#ringFokus span")?.textContent ?? "", zeilen, r0: Math.round(m.r0), zoom: z, quer: document.documentElement.scrollWidth > innerWidth + 1 };
  });
}

/* #401: der Nebenziel-Hinweis (head.sideMany, mit langem Namen und Zeit) steht
   nicht in der Ringmitte, sondern oben links unter der Einordnung, vor
   "Replay the fight". In der Mitte bleiben Zahl, Einheit und Vergleichszeile
   im Loch. Der Hinweis ist erfunden, ohne Spielernamen. */
const NEBEN = {
  de: "davon 41 % auf 5 Nebenziele, am meisten " + LANG_NAME.de + " (26 %), ab 0:02",
  en: "41% of it on 5 other targets, most on " + LANG_NAME.en + " (26%), from 0:02"
};
async function hinweisMessen(page, lang) {
  await messen(page, "normal", lang); // Maus auf den Bogen: die Mitte steht
  await page.evaluate((text) => {
    const e = document.querySelector("#hSide");
    e.textContent = text; e.title = text; e.hidden = false;
  }, NEBEN[lang]);
  await page.waitForFunction(() => { const e = document.querySelector("#hSide"); return e && !e.hidden && e.getClientRects().length > 0; });
  const m = await messen(page, "normal", lang);
  const r = await page.evaluate(() => {
    const e = document.querySelector("#hSide"), box = (el) => { const q = el.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
    const links = box(document.querySelector("#ringLinks")), me = box(e), nach = box(document.querySelector("#ringNachspielen"));
    const hist = document.querySelector("#hHist"), satz = document.querySelector("#ringSatz");
    const zeilen = [...satz.children].filter((c) => !c.hidden && c.getClientRects().length);
    return {
      inMitte: !!e.closest("#ringMitte"), inSatz: e.parentElement === satz, letzter: zeilen[zeilen.length - 1] === e,
      sichtbar: !e.hidden && e.getClientRects().length > 0,
      imKopf: me.l >= links.l - 1 && me.r <= links.r + 1 && me.t >= links.t - 1 && me.b <= links.b + 1,
      ueberNachspielen: me.b <= nach.t + 1 || me.r <= nach.l || me.l >= nach.r,
      nachHist: !hist || hist.hidden || !hist.getClientRects().length || me.t >= hist.getBoundingClientRect().bottom - 1,
      title: e.title, text: e.textContent, box: me, links, nach
    };
  });
  return { m, r };
}

try {
  const fenster = [[1634, 1047], [2000, 1480], [1100, 700]];
  for (const lang of ["de", "en"]) for (const thema of ["dark", "light", "tnl", "glas"])
    for (const [breite, hoehe] of fenster) for (const zoom of [75, 100, 150, 200]) {
      if (zoom !== 100 && thema !== "dark") continue; // die Themen aendern die Masse nicht: Zoom nur im dunklen
      if (zoom === 200 && breite < 1634) continue;     // 1100 bei 200 % ist gestapelt (unter 900 Punkt)
      const { page, fehler } = await oeffne({ lang, config: { uiZoom: zoom, theme: thema }, breite, hoehe });
      const wo = `${lang} ${thema} ${breite}x${hoehe} ${zoom} %`;
      for (const sz of ["normal", "gross", "lang"]) {
        const m = await messen(page, sz, lang);
        // die Probe prueft "100 % krit." nur, wenn die Ersetzung griff (de: geschuetztes Leerzeichen, en: ohne)
        if (sz !== "normal") assert(/(^|[^\d.,])100[\u00a0 ]?%/.test(m.erz) && /4\.406/.test(m.erz), `${wo} ${sz}: die Erzaehlung traegt 4.406 Treffer und 100 %`, m.erz);
        const draussen = m.zeilen.filter((z) => !z.drin);
        assert(m.zeilen.length >= 4 && !draussen.length, `${wo} ${sz}: jede Zeile der Mitte liegt im Loch des Rings`, draussen);
        assert(!m.quer && !fehler.length, `${wo} ${sz}: kein waagerechtes Rollen, keine Fehler`, { quer: m.quer, fehler });
      }
      await page.close();
    }

  /* #401: der Hinweis oben links, nie in der Mitte */
  for (const lang of ["de", "en"]) for (const thema of ["dark", "light", "tnl", "glas"])
    for (const [breite, hoehe] of [[1601, 760], [2000, 1480], [560, 900]]) {
      if (thema !== "dark" && breite !== 1601) continue;
      const { page, fehler } = await oeffne({ lang, config: { theme: thema }, breite, hoehe });
      const wo = `#401 ${lang} ${thema} ${breite}x${hoehe}`;
      const { m, r } = await hinweisMessen(page, lang);
      assert(!r.inMitte, `${wo}: der Nebenziel-Hinweis steht nicht in der Ringmitte`, r);
      assert(r.inSatz && r.letzter, `${wo}: er steht unter der Einordnung (letzte Zeile in #ringSatz)`, r);
      assert(r.sichtbar && r.imKopf && r.ueberNachspielen && r.nachHist, `${wo}: sichtbar, im Kopf, ohne die Handlung zu ueberdecken`, r);
      assert(r.title === r.text && r.text === NEBEN[lang], `${wo}: Satz und Zeit unveraendert, ganzer Satz im title`, r);
      const draussen = m.zeilen.filter((z) => !z.drin);
      assert(m.zeilen.length >= 3 && !draussen.length, `${wo}: jede Zeile der Mitte liegt im Loch des Rings`, draussen);
      assert(!m.quer && !fehler.length, `${wo}: kein waagerechtes Rollen, keine Fehler`, { quer: m.quer, fehler });
      await page.close();
    }
} finally {
  await browser.close();
}
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
