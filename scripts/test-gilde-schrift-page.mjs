// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die Schriften der Gilde gegen die der Weeklies (Issue #237): Ueberschriften und Zahlen in der Schrift der
// Weeklies fuer Ueberschriften (Anton), Fliesstext in der des Fliesstexts (Source Sans 3), Palatino nur fuer Namen,
// kein Kursiv und keine Kapitaelchen ausserhalb der Namen. In vier Themen, bei 2000 x 1480 und 560 px, in allen
// vier Reitern. Kein Server: die Seite kommt vom gestellten Helfer (page.route), alle Namen sind erfunden.
//
// Run:  npm run test:gilde-schrift-page     (baut die Seite zuerst)
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 900))); }
}
const ARTEN = [{ id: "aboss00001", name: "Gildenboss", punkte: 1, proPunkt: 7 }];
const pk = (zus) => ({ seit: "2026-10-06", pausen: [], start: {}, ansehen: { start: 0, eintraege: [] }, zusatz: [{ punkte: zus, notiz: "Test" }] });
const GILDE = { v: 1, gilde: { id: "g000000001", name: "Testgilde", geloest: undefined,
  mitglieder: [
    { id: "m000000001", name: "Testperson A", rolle: "tank", waffen: ["Greatsword", "Sword and Shield"], notiz: "Notiz", punkte: pk(10) },
    { id: "m000000002", name: "Testperson B", rolle: "heal", waffen: ["Wand and Tome", "Staff"], notiz: "", punkte: pk(7) },
    { id: "m000000003", name: "Testperson C", rolle: "dps", waffen: ["Dagger", "Crossbow"], notiz: "", punkte: pk(4) }],
  reihen: [{ id: "r000000001", titel: "Gildenabend", start: "2026-10-06T20:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [2] }, dauerMin: 120, erinnerungMin: 15, ausnahmen: {} }],
  anwesend: {},
  punkte: { an: true, rang: false, gruppen: false, schwellen: [8, 6], monat: 1, teiler: 100000, stichtag: "2026-10-01", arten: ARTEN } } };

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Namen standen frueher in Palatino, jetzt in Source Sans 3 (Muster der Weeklies und des Verlaufs: .wbzeile .nn, .vtabzeile .bn) */
const NAMEN = ".gl-name, .gl-gname, .gl-p-name, .gl-saal-name h3, #gildeEName, .gl-den b";

for (const thema of ["dark", "light", "tnl", "glas"]) for (const [breite, hoehe] of [[2000, 1480], [560, 900]]) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(String(e)));
  await page.clock.install({ time: new Date("2026-10-06T10:00:00") });
  await page.clock.setFixedTime(new Date("2026-10-06T10:00:00"));
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* blockiert */ } });
  await page.route("http://boro.test/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
    const j = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) }).catch(() => {});
    if (p === "/api/gilde") return j({ ok: true, data: GILDE });
    if (p === "/api/config" && route.request().method() === "GET") return j({ logIndex: {}, theme: thema });
    if (p === "/api/state") return j({ dir: "", file: "", size: 0, mtime: 0 });
    if (p === "/api/weeklies") return j({ ok: true, data: { v: 1, profile: [] } });
    if (p.startsWith("/api/")) return j({ ok: true, builds: {}, best: {}, plans: {}, files: [] });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html");
  await page.waitForFunction(() => !!document.body.dataset.bereit);
  await page.evaluate((k) => document.querySelector(`#themeRow button[data-theme="${k}"]`)?.click(), thema);
  const wo = `${thema} ${breite}px`;

  // Bezug: die Weeklies
  await page.click('#bereiche [data-tab="weeklies"]');
  await page.waitForFunction(() => !document.querySelector("#weeklies").hidden);
  const bezug = await page.evaluate(() => {
    const fam = (e) => getComputedStyle(e).fontFamily.split(",")[0].replace(/["']/g, "").trim();
    return { kopf: fam(document.querySelector("#weeklies h2")), text: fam(document.querySelector("#weeklies .wksatz")) };
  });
  assert(/Anton/.test(bezug.kopf) && /Source Sans 3/.test(bezug.text), `${wo}: Bezug - Weeklies: Ueberschrift Anton, Text Source Sans 3`, bezug);

  await page.click('#bereiche [data-tab="gilde"]');
  await page.waitForFunction(() => !document.querySelector("#gilde").hidden && document.querySelector("#gildeTabs [data-gtab]"));
  for (const tab of ["termine", "mitglieder", "auswertung", "punkte"]) {
    await page.click(`#gildeTabs [data-gtab="${tab}"]`);
    await page.waitForTimeout(300);
    const r = await page.evaluate(({ namen, bezug }) => {
      const fam = (c) => c.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      const bad = [], zahlen = [], koepfe = [];
      let n = 0;
      for (const e of document.querySelectorAll("#gilde *")) {
        const t = [...e.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent.trim()).join("").trim();
        if (!t || e.closest("[hidden]") || e.closest("svg") || e.tagName === "OPTION") continue;
        n++;
        const c = getComputedStyle(e), f = fam(c), name = e.matches(namen) || !!e.closest(namen);
        const wie = e.tagName.toLowerCase() + "." + String(e.className).split(" ")[0] + ":" + t.slice(0, 14);
        if (!name && /Palatino/.test(f)) bad.push(["palatino", wie]);
        if (!name && c.fontStyle === "italic") bad.push(["kursiv", wie]);
        if (!name && c.fontVariantCaps !== "normal") bad.push(["kapitaelchen", wie]);
        if (!name && !/Anton|Source Sans 3/.test(f)) bad.push(["fremd:" + f, wie]);
        if (/^h[1-6]$/.test(e.tagName.toLowerCase()) && !name && f !== bezug.kopf) koepfe.push([f, wie]);
        if (e.matches(".gl-saal-zahlen dd, .gl-chip b, .gl-p-sm, .gl-p-gross, .gl-saal-wann span") && f !== bezug.kopf) zahlen.push([f, wie]);
      }
      return { n, bad: bad.slice(0, 8), zahlen, koepfe };
    }, { namen: NAMEN, bezug });
    assert(r.n > 5, `${wo}/${tab}: die Probe sieht Text`, r.n);
    assert(!r.bad.length, `${wo}/${tab}: Palatino, Kursiv und Kapitaelchen nur bei Namen; sonst Anton oder Source Sans 3`, r.bad);
    assert(!r.koepfe.length, `${wo}/${tab}: Ueberschriften in der Schrift der Weeklies`, r.koepfe);
    assert(!r.zahlen.length, `${wo}/${tab}: grosse Zahlen in der Schrift der Weeklies fuer Ueberschriften`, r.zahlen);
    if (breite === 560) assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${wo}/${tab}: kein waagerechtes Rollen`);
  }
  assert(!fehler.length, `${wo}: keine Seitenfehler`, fehler);
  await page.close();
}
await browser.close();
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log("\nalle Proben gruen");
