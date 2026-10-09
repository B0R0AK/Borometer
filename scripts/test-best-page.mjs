// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Gezielter Test von "Gegen deinen besten Pull" an der gebauten Seite,
// dist/renderer/index.html ueber file:// - ohne Server, der Speicher lebt
// also nur in dieser Sitzung. Neun kleine erzeugte Logs werden nacheinander
// geladen; was eines als besten Pull festhaelt, muss das naechste finden.
//
// Run:  npm run test:best-page     (baut die Seite zuerst)
// Mit Edge: $env:PARITY_CHROMIUM="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail))); }
}

/* Ein Log in der Form, die das Spiel schreibt: alle 0,5 s ein Treffer, vier
   Faehigkeiten im Wechsel, der Schaden mal `scale` (und je Faehigkeit mal
   `je[Name]`, wo ein Pull an einer Stelle anders laufen soll). Fuenf Stufen, nicht
   drei: so hatte die Heuristik in autoMap() (04-log-parsing.ts) eine
   Schadensspalte mit mehr als drei verschiedenen Werten. Seit 01.10. gilt fuer
   "CombatLogVersion,4" ohnehin die feste Zuordnung der Spalten. */
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
      const dmg = Math.round(1000 * p.scale * (p.je?.[skill] ?? 1) * (1 + (k % 5)));
      lines.push(`${stamp(p.start + k * 500)},DamageDone,${skill},${sid},${dmg},0,0,kNormalHit,Tester,${p.target}`);
    }
  }
  return lines.join("\n") + "\n";
}
const at = (day, h, m) => Date.UTC(2026, 8, day, h, m, 0);
const work = mkdtempSync(join(tmpdir(), "boro-best-"));
const logFile = (name, pulls) => { const p = join(work, name); writeFileSync(p, logText(pulls)); return p; };
const V = (day, scale) => ({ target: "Vulcanus", start: at(day, 21, 0), secs: 75, scale });
const L1 = logFile("best-1.txt", [V(17, 1.2)]);
const L2 = logFile("best-2.txt", [V(18, 1.0)]);
const L3 = logFile("best-3.txt", [V(19, 1.5)]);
const L4 = logFile("best-4.txt", [
  { target: "Practice Dummy", start: at(20, 20, 0), secs: 62, scale: 1.3 },
  { target: "Practice Dummy", start: at(20, 20, 5), secs: 30, scale: 1.0 }]);
const L5 = logFile("best-5.txt", [{ target: "Practice Dummy", start: at(21, 20, 0), secs: 62, scale: 1.0 }]);
const L7 = logFile("best-7.txt", [V(22, 1.47)]);
/* Ein Pull, dem der Abstand an einer Stelle fehlt: Detonation Mark bei 40 %,
   Quick Fire bei 90 %, der Rest wie beim besten (L3). Das Gegenstueck zu den
   gleichmaessig skalierten Logs oben, deren Abstand sich verteilt. */
const L8 = logFile("best-8.txt", [{ ...V(23, 1.5), je: { "Detonation Mark": 0.4, "Quick Fire": 0.9 } }]);
/* #151: zwei Fehlstarts mit 14 s und starkem Opener, dann zwei lange Pulls,
   alle schwaecher als L3 ueber die Mindestlaenge (min(60, 90/2) = 45 s). */
const W = (min, secs, scale) => ({ target: "Vulcanus", start: at(24, 21, min), secs, scale });
const L9 = logFile("best-9.txt", [W(0, 14, 4), W(2, 14, 4), W(4, 90, 1.0), W(8, 80, 1.1)]);
/* Aufgabe 7: ein Fehlstart mit fuenffachem Schaden (14 s) vor einem langen Pull
   (90 s) an einem Boss, an dem sonst kein Test kaempft (Lyxara). */
const L10 = logFile("best-10.txt", [{ target: "Lyxara", start: at(25, 21, 0), secs: 14, scale: 5 },
  { target: "Lyxara", start: at(25, 21, 4), secs: 90, scale: 1 }]);
/* Ein Log ohne Datum: nur die Uhrzeit (HH:MM:SS), so liest parseTime
   (03-helpers.ts) es als "nur Tageszeit" (state.wall falsch). Zwei Pulls an
   Vulcanus, beide ueber der Schwelle. */
function logTextNoWall(pulls) {
  const lines = ["CombatLogVersion,4"];
  for (const p of pulls) {
    for (let k = 0; k * 500 < p.secs * 1000; k++) {
      const [skill, sid] = SKILLS[k % SKILLS.length];
      const d = new Date(p.start + k * 500);
      const zeit = `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`;
      const dmg = Math.round(1000 * p.scale * (1 + (k % 5)));
      lines.push(`${zeit},DamageDone,${skill},${sid},${dmg},0,0,kNormalHit,Tester,Vulcanus`);
    }
  }
  return lines.join("\n") + "\n";
}
const L11 = (() => { const f = join(work, "best-11.txt");
  writeFileSync(f, logTextNoWall([V(26, 1.0), { ...V(26, 1.2), start: at(26, 21, 5) }])); return f; })();
const L6 = logFile("best-6.txt", [{ target: "Molting Grave Wolf", start: at(21, 22, 0), secs: 20, scale: 1.0 }]);

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ }
  });
  await page.goto("file://" + join(root, "dist", "renderer", "index.html"));

  const load = async (file, name) => {
    await page.setInputFiles("#fileInput", file);
    await page.waitForFunction((n) => (document.querySelector("#hName")?.textContent || "").includes(n), name);
    await page.waitForTimeout(150);
  };
  /* Die Kampfwahl: je Zeile die Zahl (.kd) und ob der Goldpunkt (i.best) dran haengt. */
  const kwZeilen = () => page.evaluate(() => [...document.querySelectorAll("#fightList .fight")]
    .map((r) => ({ kd: r.querySelector(".kd")?.textContent || "", gold: !!r.querySelector("i.best") })));
  /* Der Knopf steht im Urteil des Kampfs (Neugestaltung 28.09.); seit Stufe 4 (#54) haben die
     anderen Bereiche statt des Streifens eine Kopfzeile (58-felder.ts).
     Gemessen wird darum im Bereich Kampf, danach geht es zurueck in den
     Bereich von vorher. kampf() fuehrt vor einem Klick auf den Knopf hin. */
  const aktuell = () => page.evaluate(() => document.querySelector(".panel.on")?.id.replace(/^p-/, "") || "");
  const kampf = () => page.evaluate(() => document.querySelector('[data-tab="timeline"]').click());
  const head = async () => {
    const vorher = await aktuell();
    await kampf();
    const r = await page.evaluate(() => {
      const b = document.querySelector("#btnBestPull");
      return { shown: !!b && !b.hidden && !!b.offsetParent, label: b?.getAttribute("aria-label") || "", title: b?.title || "",
               /* Neugestaltung 28.09. (DECISION 2.5, Entwurf Bereich Kampf): der
                  Knopf steht als "Im Vergleich \u203a" im Urteil der Tafel, eine
                  Fassung statt zwei; der Pfeil ist Zeichen, kein Wort. */
               long: (b?.textContent || "").replace("\u203a", "").trim(), short: (b?.textContent || "").replace("\u203a", "").trim(),
               imUrteil: !!b?.closest("#urteilFeld") };
    });
    if (vorher && vorher !== "timeline") await page.evaluate((n) => document.querySelector(`[data-tab="${n}"]`).click(), vorher);
    return r;
  };
  // WCAG 2.5.3: der Name enthaelt, was sichtbar steht - breit wie schmal
  const nameHasText = (h) => !!h.long && h.label.toLowerCase().includes(h.long.toLowerCase())
    && h.label.toLowerCase().includes(h.short.toLowerCase());
  const line = () => page.evaluate(() => document.querySelector("#cmpBest")?.textContent || "");
  const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent || "", sel);
  const ticked = () => page.evaluate(() => document.querySelectorAll(".cmppick .run input:checked").length);
  const tab = (name) => page.evaluate((n) => document.querySelector(`[data-tab="${n}"]`).click(), name);
  const lead = () => text("#cmpLead");
  /* gegen den besten Pull: die Namen, die Auswahl, die Reihenfolge der Abschnitte.
     Folgt Entwurf (Neugestaltung 28.09., Luecken 5.3-5.5, DECISION 5.7): statt
     Kopf-an-Kopf, DPS je Faehigkeit, Feld und "Woher" stehen zwei grosse Zahlen
     (.vgross), der Satz mit der Summe und die Liste je Faehigkeit (#cmpJe);
     Direktvergleich und Raster gibt es von Hand hinter "Andere Kaempfe waehlen".
     Geprueft wird dasselbe: die Namen in jedem Teil, der Satz ueber der Liste,
     dieselben Zahlen, die Rotation direkt nach der Liste. */
  const mode = () => page.evaluate(() => {
    const out = document.querySelector("#cmpOut");
    const fold = document.querySelector("#cmpPick details.cmppickfold");
    const sum = fold?.querySelector("summary");
    const order = [...out.children].map((c) => c.id === "cmpRot" ? "rot" : c.id === "cmpJe" ? "liste" : c.className);
    return {
      gross: [...out.querySelectorAll(".vgross .lbl")].map((b) => b.textContent),
      kopf: [...out.querySelectorAll("#cmpJe .vkopf span")].map((b) => b.textContent),
      zeilen: out.querySelectorAll("#cmpJe .vr").length,
      rotZu: !!document.querySelector("#cmpRot > details:not([open])"),
      // die Raster stehen im Paar zugeklappt in #cmpRaster (Pruefung 29.09., Befund 1), nicht offen
      grids: out.querySelectorAll(":scope > :not(#cmpRaster) .cgrid, .cmpfeld").length,
      raster: !!document.querySelector("#cmpRaster:not([open]) .cgrid"),
      sub: out.querySelector("#cmpJe .cmpsub")?.textContent || "",
      folded: !!fold && !fold.open,
      summary: sum?.textContent || "",
      summaryFocusable: !!sum && sum.tabIndex === 0,
      hint: !!document.querySelector("#cmpPick .cmphint"),
      boxesInside: fold ? fold.querySelectorAll(".run input").length : 0,
      order,
      rotAfterContrib: !!out.querySelector("#cmpJe + #cmpRot"),
      leadOutline: (() => { const l = document.querySelector("#cmpLead"); return l ? getComputedStyle(l).outlineStyle : ""; })(),
    };
  });

  // 0 · Beispiel: kein Knopf, der Vergleich sagt warum
  // im geschlossenen Menue ist der Eintrag unsichtbar; wie test-parity.mjs per DOM
  await page.evaluate(() => document.querySelector("#btnSample").click());
  await page.waitForFunction(() => !document.querySelector("#app").hidden);
  assert(!(await head()).shown, "Beispiel: kein Knopf im Kopf");
  await tab("compare");
  /* Seit der Kritik vom 28.09.: dass das Beispiel niemandes Leistung ist,
     steht einmal in der Kopfzeile; die Zeile sagt, was hier erscheinen wird,
     und traegt "Open logs". */
  assert((await line()).includes("\u201cAgainst your best pull\u201d appears here") && (await line()).includes("Open logs")
    && (await text("#bkHinweis")).includes("nobody's performance") && !(await line()).includes("nobody's performance"),
    "Beispiel: Satz im Vergleich, der Hinweis in der Kopfzeile", [await line(), await text("#bkHinweis")]);

  // 1 · erster Kampf an Vulcanus
  await load(L1, "Vulcanus");
  assert(!(await head()).shown, "erster Kampf: kein Knopf");
  assert((await line()).includes("first fight on Vulcanus"), "erster Kampf: Satz warum", await line());
  assert((await kwZeilen()).length === 1 && (await kwZeilen()).every((z) => !z.gold),
    "Aufgabe 7: ein einziger Pull am Boss traegt kein Gold", await kwZeilen());

  // 2 · schwaecher als der erste: Knopf, per Tastatur
  await load(L2, "Vulcanus");
  let h = await head();
  assert(h.shown && h.imUrteil && h.label === "In the comparison: against your best pull" && h.long === "In the comparison",
    "zweiter Kampf: Knopf \u201eIm Vergleich\u201c im Urteil", h);
  assert(nameHasText(h), "zweiter Kampf: der Name enthaelt beide sichtbaren Texte", h);
  assert(h.title.includes("17/09 21:00"), "der Knopf nennt den Bezug im title", h.title);
  /* Folgt Entwurf (Luecken 5.1): der Vergleich steht schon gegen den besten Pull, der
     Umschalter im Kopf ist gedrueckt - vorher bot die Zeile hier den Knopf an. */
  assert((await lead()).startsWith("You are 17% (1.2k DPS) below your best pull from 17/09 on Vulcanus") &&
    await page.evaluate(() => document.querySelector("#vglBest")?.getAttribute("aria-pressed") === "true"),
    "der Vergleich steht schon gegen den besten Pull, der Umschalter nennt ihn", await lead());
  await kampf();
  await page.focus("#btnBestPull");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => document.querySelector("#p-compare").classList.contains("on")), "Enter oeffnet den Vergleich");
  assert((await ticked()) === 2, "genau zwei angehakt", await ticked());
  assert((await text(".cmppick")).includes("Best pull"), "Gruppe \"Best pull\" in der Auswahl");
  // die Antwort statt des allgemeinen Urteils (Kritik 25.09.)
  /* Alle vier Faehigkeiten gleich skaliert: keine traegt mehr als 40 % des
     Abstands, "Woher der Unterschied kommt" sagt "verteilt sich" - dann nennt
     auch der Satz keine (vorher: "Detonation Mark is short the most"). */
  assert((await lead()) === "You are 17% (1.2k DPS) below your best pull from 17/09 on Vulcanus; the gap is spread across many skills.",
    "Antwortsatz: Abstand, Bezug, und der Abstand verteilt sich", await lead());
  assert(!(await text("#cmpOut")).includes("wins on DPS"), "kein allgemeines Urteil gegen den besten Pull");
  assert(!(await line()), "ueber der Auswahl keine zweite Zeile, die dasselbe sagt", await line());
  assert(await page.evaluate(() => document.activeElement?.id === "cmpLead" && document.activeElement.tabIndex === -1),
    "Fokus auf dem Antwortsatz");
  let m = await mode();
  assert(m.leadOutline === "none", "Antwortsatz: kein Rahmen um den Absatz, wenn er den Fokus hat", m.leadOutline);
  assert(m.gross.join("|") === "This fight|Best pull (17/09 21:00)", "Namen in den zwei Zahlen", m.gross);
  assert(m.kopf[1] === "less than in the best" && m.zeilen === 4 && m.grids === 0 && m.raster, "Namen in der Liste je Faehigkeit, alle vier, die Raster zugeklappt", m);
  assert((await text("#cmpRot .cmpsub")).startsWith("Top: your best pull (17/09 21:00), bottom: this fight."), "Namen in der Rotation",
    await text("#cmpRot .cmpsub"));
  assert(m.sub.startsWith("The difference is spread out"), "Antwortsatz und Liste je Faehigkeit: beide verteilt", m.sub);
  // dieselben Zahlen wie auf der Seite: der Abstand in der Summe, die groesste Zeile, die zwei Zahlen
  const zahlen = await page.evaluate(() => ({
    summe: document.querySelector("#cmpSumme")?.textContent || "",
    row: document.querySelector("#cmpJe .vr .vw")?.textContent || "",
    gross: [...document.querySelectorAll("#cmpOut .vgross .num")].map((n) => n.textContent),
  }));
  const kz = (x) => /k$/.test(x) ? parseFloat(x) * 1e3 : parseInt(x.replace(/[.,]/g, ""), 10);
  assert(zahlen.summe.endsWith("The 4 rows add up to \u22121.2k \u2013 the same figure as above.") && zahlen.row === "\u2212309" &&
    zahlen.gross.length === 2 && Math.abs(kz(zahlen.gross[1]) - kz(zahlen.gross[0]) - 1200) <= 100,
    "Antwortsatz und Seite nennen dieselben Zahlen", zahlen);
  assert(m.folded && m.summary === "Choose other fights" && m.summaryFocusable && m.boxesInside >= 2,
    "Auswahl zugeklappt hinter \"Choose other fights\", per Tastatur erreichbar", m);
  assert(!m.hint, "kein \"Mark two to four fights\" gegen den besten Pull");
  assert(m.rotAfterContrib && m.rotZu && m.order.indexOf("liste") < m.order.indexOf("rot"),
    "Rotation direkt nach der Liste je Faehigkeit, zugeklappt (DECISION 5.7)", m.order);
  assert((await text("#cmpOut")).includes("Every change is measured against your best pull (17/09 21:00)."), "der beste Pull ist die Referenz",
    await text("#cmpOut .cmpstate"));
  // die Auswahl aufklappen per Tastatur: Enter auf der Zusammenfassung
  await page.focus("#cmpPick summary");
  await page.keyboard.press("Enter");
  assert(await page.evaluate(() => document.querySelector("#cmpPick details").open), "Enter klappt die Auswahl auf");
  /* #35: gegen den besten Pull kein "Bezug tauschen" - der Tausch verliess
     den Modus still (Liste auf, Uhrzeiten, Gruen). Die Zeile mit dem Bezug
     bleibt. Verlassen wird der Modus nur noch ueber einen Haken in der Auswahl;
     die umgekehrte Reihenfolge (Kampf links als Referenz) ist nicht mehr
     erreichbar, denn der beste Pull steht nur angehakt in der Liste. */
  assert(!(await page.$("#cmpSwap")), "#35: gegen den besten Pull kein Knopf \"Bezug tauschen\"");
  await page.evaluate(() => document.querySelector('#cmpPick .run[data-cid="seg0"] input').click());
  await page.waitForTimeout(150);
  assert((await ticked()) === 1, "#35: Haken am Kampf abgenommen, nur der beste Pull bleibt", await ticked());
  assert((await line()).startsWith("Your best pull on Vulcanus") && !!(await page.$("#cmpBestBtn")),
    "Modus verlassen: Zeile wieder mit Knopf", await line());
  m = await mode();
  assert(!(await page.$("#cmpLead")) && !m.summary && m.hint && !(await page.$("#cmpSwap")),
    "Modus verlassen: kein Antwortsatz, offene Liste, kein Tausch bei einem Kampf", m);
  await page.click("#cmpBestBtn");
  await page.waitForTimeout(150);
  assert((await lead()).startsWith("You are 17% (1.2k DPS) below your best pull"), "Knopf stellt den Vergleich wieder her", await lead());
  m = await mode();
  assert(m.folded, "wieder gegen den besten Pull: Auswahl zugeklappt", m);
  // Rotation nebeneinander - folgt Entwurf (DECISION 5.7): zugeklappt, per Klick auf
  // die Ueberschrift auf; danach dieselben Proben
  await page.click("#cmpRot summary");
  await page.waitForFunction(() => document.querySelector("#cmpRot > details")?.open);
  const rot = await page.evaluate(() => ({
    lanes: document.querySelectorAll("#cmpRot .crspur").length,
    marks: document.querySelectorAll("#cmpRot .crspur i").length,
    toggles: [...document.querySelectorAll("#cmpRot .seg button")].map((b) => b.getAttribute("aria-pressed")),
    lists: [...document.querySelectorAll("#cmpRot .crfolgen ol")].map((o) => o.children.length),
    hidden: document.querySelector("#cmpRot .crspur")?.getAttribute("aria-hidden"),
    sum: document.querySelector("#cmpRot .cmpsub")?.textContent || "",
  }));
  assert(rot.lanes === 4 && rot.marks > 0, "Rotation: vier Spuren mit Marken", rot);
  assert(rot.toggles.join() === "true,false", "Rotation: erste 60 s gewaehlt, ganzer Kampf daneben", rot.toggles);
  assert(rot.lists.join() === "12,12", "Rotation: je zwoelf Einsaetze als Liste", rot.lists);
  assert(rot.hidden === "true", "Rotation: Spuren fuer Vorleser verborgen, die Liste traegt");
  assert(rot.sum.startsWith("Top: your best pull (17/09 21:00), bottom: this fight."), "Rotation: Satz nennt oben und unten", rot.sum);
  assert(rot.sum.includes(" In the first 60\u00a0s:"), "Rotation: Satz nennt die ersten 60 s", rot.sum);
  await page.click('#cmpRot .seg button[data-all="1"]');
  const sumAll = await text("#cmpRot .cmpsub");
  assert(sumAll.includes(" Over the whole fight, up to ") && !sumAll.includes("In the first"),
    "Rotation: beim ganzen Kampf sagt der Satz das auch", sumAll);
  assert(await page.evaluate(() => document.activeElement?.getAttribute("data-all") === "1"
      && document.activeElement.getAttribute("aria-pressed") === "true"), "Rotation: ganzer Kampf, Fokus bleibt auf dem Knopf");
  assert(await page.evaluate(() => document.querySelector("#cmpRot > details")?.open), "Rotation: nach dem Neuzeichnen bleibt sie aufgeklappt");
  for (const theme of ["light", "tnl", "dark"]) {
    await page.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`).click(), theme);
    await page.waitForTimeout(100);
    const farbe = await page.evaluate(() => getComputedStyle(document.querySelector("#cmpRot .crspur i")).backgroundColor);
    assert(!!farbe && farbe !== "rgba(0, 0, 0, 0)", `Rotation im Thema ${theme}: Marken haben Farbe`, farbe);
  }

  // 3 · neuer Bestwert: gegen den zweitbesten
  await load(L3, "Vulcanus");
  h = await head();
  assert(h.shown && h.label === "In the comparison: against your second-best pull", "Bestwert: Knopf gegen den zweitbesten", h);
  assert(nameHasText(h), "Bestwert: der Name enthaelt beide sichtbaren Texte", h);
  await kampf();
  await page.click("#btnBestPull");
  await page.waitForTimeout(150);
  assert((await lead()) === "This is your best pull on Vulcanus: 25% (1.8k DPS) above your second best from 17/09; the gap is spread across many skills.",
    "Bestwert: Antwortsatz ohne Wertung, Abstand verteilt", await lead());
  assert((await text("#cmpOut")).includes("Every change is measured against your second-best pull (17/09 21:00)."), "Bestwert: Bezug ist der vom 17.09.",
    await text("#cmpOut .cmpstate"));

  // 4 · Uebungspuppe zu kurz
  await load(L4, "Practice Dummy");
  assert(!(await head()).shown, "Puppe 30 s: kein Knopf");
  assert((await line()).includes("fixed lengths"), "Puppe 30 s: Satz warum", await line());

  // 5 · Puppe 62 s gegen die 62 s aus L4, beide auf 60 s geschnitten
  await load(L5, "Practice Dummy");
  h = await head();
  assert(h.shown && h.label === "In the comparison: against your best pull", "Puppe 62 s: Knopf", h);
  await kampf();
  await page.click("#btnBestPull");
  await page.waitForTimeout(150);
  assert((await ticked()) === 2, "Puppe: zwei angehakt", await ticked());
  assert((await text("#cmpOut")).includes("Every fight is 1m 0s long"), "Puppe: beide auf 60 s",
    await text("#cmpOut .cmpstate"));

  // 6 · kein Boss
  await load(L6, "Molting Grave Wolf");
  assert(!(await head()).shown, "Trash: kein Knopf");
  assert((await line()).includes("is neither"), "Trash: Satz warum", await line());

  // 7 · Deutsch; Kompakt bleibt ohne Knopf
  await load(L3, "Vulcanus");
  await page.evaluate(() => document.querySelector("#btnLang").click());
  await page.waitForTimeout(150);
  h = await head();
  assert(h.label === "Im Vergleich: gegen deinen zweitbesten Pull" && h.long === "Im Vergleich", "Deutsch: Knopf", h);
  assert(nameHasText(h), "Deutsch: der Name enthaelt beide sichtbaren Texte", h);
  /* Folgt Entwurf (Luecken 5.1): der Vergleich steht schon gegen den zweitbesten Pull -
     vorher bot die Zeile ihn an; derselbe Satzanfang steht jetzt im Antwortsatz. */
  assert((await lead()).startsWith("Das ist dein bester Pull an Vulcanus") &&
    await page.evaluate(() => document.querySelector("#vglBest")?.getAttribute("aria-pressed") === "true"), "Deutsch: Zeile", await lead());
  // Deutsch gegen den zweitbesten: Satz, Namen, zugeklappte Auswahl
  await kampf();
  await page.click("#btnBestPull");
  await page.waitForTimeout(150);
  assert((await lead()) === "Das ist dein bester Pull an Vulcanus: 25\u00a0% (1.8k DPS) über deinem zweitbesten vom 17.09.; der Abstand verteilt sich auf viele Fähigkeiten.",
    "Deutsch: Antwortsatz", await lead());
  m = await mode();
  assert(m.sub.startsWith("Der Unterschied verteilt sich"), "Deutsch: Satz und Block sagen beide verteilt", m.sub);
  assert(m.gross.join("|") === "Dieser Kampf|Zweitbester Pull (17.09. 21:00)", "Deutsch: Namen in den zwei Zahlen", m.gross);
  assert(m.folded && m.summary === "Andere Kämpfe wählen" && !m.hint, "Deutsch: Auswahl zugeklappt, kein Hinweis", m);
  assert(m.rotAfterContrib, "Deutsch: Rotation nach der Liste je Faehigkeit", m.order);
  assert((await text("#cmpRot .cmpsub")).startsWith("Oben dein zweitbester Pull (17.09. 21:00), unten dieser Kampf."),
    "Deutsch: Rotation mit dem Bezug im Satz", await text("#cmpRot .cmpsub"));
  assert((await text("#cmpOut")).includes("Jede \u00c4nderung ist gegen deinen zweitbesten Pull (17.09. 21:00) gemessen."),
    "Deutsch: der Bezug im Satz gebeugt, kein Etikett", await text("#cmpOut .cmpstate"));
  await page.evaluate(() => document.querySelector("#btnCompact").click());
  await page.waitForTimeout(150);
  assert(!(await head()).shown, "Kompakt: kein Knopf");
  await page.evaluate(() => document.querySelector("#btnCompact").click());

  // 9 · unter 5 %: gleichauf, ohne Faehigkeit, die "fehlt"
  await load(L7, "Vulcanus");
  // der Bezug ist hier der beste Pull aus L3 (19.09.); #151 unten vergleicht damit
  const besterTitel = (await head()).title;
  assert(besterTitel.includes("19.09."), "L7: der Bezug ist der beste Pull aus L3", besterTitel);
  await kampf();
  await page.click("#btnBestPull");
  await page.waitForTimeout(150);
  assert((await lead()) === "Du liegst gleichauf mit deinem besten Pull vom 19.09. an Vulcanus: 2\u00a0% Unterschied, und unter 5\u00a0% ist das Rauschen.",
    "Deutsch: gleichauf unter 5 %", await lead());

  // 10 · eine klare Ursache: Detonierendes Mal traegt den Abstand, der Satz nennt es, der Block auch
  await load(L8, "Vulcanus");
  await kampf();
  await page.click("#btnBestPull");
  await page.waitForTimeout(150);
  const ursache = await lead();
  m = await mode();
  assert(ursache.startsWith("Du liegst ") && ursache.includes(" unter deinem besten Pull vom 19.09. an Vulcanus; am meisten fehlt Detonierendes Mal (\u2212")
    && !ursache.includes("verteilt"), "Deutsch: klare Ursache - der Satz nennt die Faehigkeit", ursache);
  assert(m.sub.includes("tragen") && !m.sub.includes("verteilt"), "Deutsch: klare Ursache - der Block sagt dasselbe", m.sub);

  /* 11 · #151: ein kurzer Fehlstart mit starkem Opener ist nie der beste
     Pull. L9 bringt zwei 14-s-Pulls mit vierfachem Schaden; bisher wurden
     sie bester und zweitbester, und jeder Kampf in L9 mass sich an ihnen.
     Nach der Regel (Mindestlaenge 45 s ueber die ganze Menge) bleibt der
     Bezug fuer jeden Kampf in L9 der beste Pull aus L3 - auch fuer die
     Fehlstarts selbst: sie werden verglichen, sind aber nie selbst der
     beste. Gold in der Kampfwahl prueft Aufgabe 7. */
  await load(L9, "Vulcanus");
  const kaempfe9 = await page.evaluate(() => document.querySelectorAll("#fightList .fight").length);
  assert(kaempfe9 === 4, "#151: L9 hat vier Kaempfe", kaempfe9);
  for (let i = 0; i < kaempfe9; i++) {
    await page.evaluate((k) => document.querySelector(`#fightList .fight[data-i="${k}"]`).click(), i);
    await page.waitForTimeout(150);
    const h9 = await head();
    assert(h9.shown && h9.label === "Im Vergleich: gegen deinen besten Pull" && h9.title === besterTitel,
      "#151: Kampf " + i + " in L9 misst sich am besten Pull aus L3, nicht an einem Fehlstart", { h9, besterTitel });
  }

  /* Aufgabe 7: In L9 liegt der beste Vulcanus-Pull in L3, also traegt hier kein Kampf Gold -
     auch nicht der Fehlstart mit der hoechsten DPS (vorher: Gold nach hoechster DPS im Log). */
  const z9 = await kwZeilen();
  assert(z9.length === 4 && z9.every((z) => !z.gold), "Aufgabe 7: L9 hat kein Gold, der beste Pull liegt in L3", z9);

  /* Aufgabe 7: Fehlstart (14 s, Skala 5) und langer Pull (90 s). Gold genau einmal, am langen
     Pull, nicht am Fehlstart mit der hoechsten DPS. */
  await load(L10, "Lyxara");
  const z10 = await kwZeilen();
  const hoechste = z10.reduce((a, b) => (parseFloat(b.kd) > parseFloat(a.kd) ? b : a));
  assert(z10.length === 2 && z10.filter((z) => z.gold).length === 1 && !hoechste.gold,
    "Aufgabe 7: Gold genau am langen Pull, nicht an der hoechsten DPS", z10);

  assert(!errors.length, "keine Fehler in der Seite", errors);

  /* 12 · Log ohne Datum: die Zeitpunkte sind Millisekunden seit Mitternacht.
     Der Bezug sagt "in this log", nie ein erfundenes Datum wie "01/01". */
  {
    const nw = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const nwErrors = [];
    nw.on("pageerror", (e) => nwErrors.push(String(e)));
    await nw.addInitScript(() => {
      try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ }
    });
    await nw.goto("file://" + join(root, "dist", "renderer", "index.html"));
    await nw.setInputFiles("#fileInput", L11);
    await nw.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
    await nw.waitForFunction(() => document.querySelectorAll("#fightList .fight").length >= 2);
    for (let i = 0; i < 2; i++) {
      await nw.evaluate((k) => { document.querySelector(`#fightList .fight[data-i="${k}"]`).click();
        document.querySelector('[data-tab="timeline"]').click(); }, i);
      await nw.waitForTimeout(200);
      const k = await nw.evaluate(() => { const b = document.querySelector("#btnBestPull");
        return { shown: !!b && !b.hidden, title: b?.title || "", urteil: document.querySelector("#urteilFeld")?.textContent || "" }; });
      assert(k.shown && k.title.includes("in this log") && !/01\/01/.test(k.title) && !/01\/01/.test(k.urteil),
        "ohne Datum, Kampf " + i + ": Knopf und Urteil sagen „in this log“, kein 01/01", k);
      await nw.click("#btnBestPull");
      await nw.waitForTimeout(200);
      const v = await nw.evaluate(() => ({
        lead: document.querySelector("#cmpLead")?.textContent || "",
        gross: [...document.querySelectorAll("#cmpOut .vgross .lbl")].map((b) => b.textContent),
        out: document.querySelector("#cmpOut")?.textContent || "",
      }));
      assert(v.lead.includes("in this log") && v.gross.some((g) => g.includes("in this log")) && !/01\/01/.test(v.out + v.lead),
        "ohne Datum, Kampf " + i + ": Antwortsatz und Namen sagen „in this log“, kein 01/01", v);
    }
    assert(!nwErrors.length, "ohne Datum: keine Fehler in der Seite", nwErrors);
    await nw.close();
  }

  // 8 · Wie vom eigenen Helfer ausgeliefert (SERVED): die Seite unter einer
  // erfundenen http-Adresse, jede Anfrage beantwortet page.route - es geht
  // nichts ins Netz. Scheitert das Lesen von boro-best.json (503), schreibt
  // die Seite nichts, fragt spaeter noch einmal und schreibt erst danach.
  // Ein 503 auf das Schreiben liest erneut und schreibt dann noch einmal.
  const served = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const servedErrors = [];
  served.on("pageerror", (e) => servedErrors.push(String(e)));
  await served.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ }
  });
  const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
  const events = [];
  let readOk = false;
  let postsRefused = 1;
  await served.route("http://boro.test/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/best" && req.method() === "GET") {
      events.push(readOk ? "GET 200" : "GET 503");
      return readOk ? json(200, { ok: true, best: {} }) : json(503, { ok: false });
    }
    if (path === "/api/best" && req.method() === "POST") {
      const key = JSON.parse(req.postData() || "{}").key;
      if (postsRefused > 0) { postsRefused--; events.push("POST 503 " + key); return json(503, { ok: false }); }
      events.push("POST 200 " + key);
      return json(200, { ok: true });
    }
    if (path.startsWith("/api/")) return json(200, {});
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
  });
  await served.goto("http://boro.test/index.html");
  await served.setInputFiles("#fileInput", L1);
  await served.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
  // laenger als die 3 s bis zum Schreiben: kaeme jetzt ein POST, haette die
  // Seite ein gescheitertes Lesen fuer einen leeren Speicher gehalten
  await served.waitForTimeout(4000);
  assert(events.length >= 1 && events.every((e) => e === "GET 503"),
    "Lesen gescheitert: die Seite schreibt nichts", events);
  readOk = true;
  const until = async (cond, ms) => {
    for (const end = Date.now() + ms; Date.now() < end && !cond();) await served.waitForTimeout(250);
    return cond();
  };
  await until(() => events.some((e) => e.startsWith("POST 200")), 20000);
  const firstOk = events.indexOf("GET 200");
  const firstPost = events.findIndex((e) => e.startsWith("POST"));
  assert(firstOk >= 0 && firstPost > firstOk, "erst nach einem gelungenen Lesen wird geschrieben", events);
  assert(events.includes("POST 503 boss:Vulcanus"), "der Eintrag wird geschrieben, sobald gelesen ist", events);
  const refused = events.indexOf("POST 503 boss:Vulcanus");
  const again = events.indexOf("POST 200 boss:Vulcanus");
  assert(again > refused && events.slice(refused + 1, again).includes("GET 200"),
    "503 beim Schreiben: neu gelesen, dann noch einmal geschrieben", events);
  assert(!servedErrors.length, "SERVED: keine Fehler in der Seite", servedErrors);
  await served.close();

  // 9 · Issue #32: das Kreuz in der Vergleichsauswahl entfernt einen
  // gespeicherten Kampf wie das Kreuz in der Leiste - mit Meldung und
  // Rueckgaengig. Danach steht der Kampf wieder an seinem Platz, angehakt
  // wie vorher, und die gespeicherte Config enthaelt ihn wieder.
  const kx = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const kxErrors = [];
  kx.on("pageerror", (e) => kxErrors.push(String(e)));
  await kx.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ }
  });
  const posts = [];
  await kx.route("http://boro.test/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/config" && req.method() === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      if (Array.isArray(body.runs)) posts.push(body.runs.map((r) => r.tag || r.name));
      return json(200, { ok: true });
    }
    if (path.startsWith("/api/")) return json(200, {});
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
  });
  await kx.goto("http://boro.test/index.html");
  const speichern = async (file, name) => {
    await kx.setInputFiles("#fileInput", file);
    await kx.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
    await kx.waitForTimeout(150);
    await kx.evaluate(() => document.querySelector("#btnSaveRun").click());
    await kx.waitForFunction(() => !!document.querySelector("#modalInput")?.offsetParent);
    await kx.fill("#modalInput", name);
    await kx.click("#modalOk");
    await kx.waitForFunction((n) => [...document.querySelectorAll("#runList .run b")].some((b) => b.textContent === n), name);
  };
  await speichern(L1, "Lauf A");
  await speichern(L2, "Lauf B");
  await speichern(L3, "Lauf C");
  const leiste = () => kx.evaluate(() => [...document.querySelectorAll("#runList .run b")].map((b) => b.textContent));
  const auswahlLaeufe = () => kx.evaluate(() => [...document.querySelectorAll(".cmppick .run")]
    .filter((r) => r.querySelector(".x")).map((r) => ({ name: r.querySelector("b").textContent, an: r.querySelector("input").checked })));
  assert(JSON.stringify(await leiste()) === JSON.stringify(["Lauf C", "Lauf B", "Lauf A"]),
    "#32: drei gespeicherte Kaempfe in der Leiste", await leiste());
  await kx.evaluate(() => document.querySelector('[data-tab="compare"]').click());
  await kx.waitForTimeout(150);
  /* Folgt Entwurf (Luecken 5.1): der Vergleich oeffnet gegen den besten Pull und hakt
     dafuer zwei an. Erst alle Haken ab (von Hand, der Umschalter steht dann still),
     danach wie bisher. */
  await kx.evaluate(() => { const z = () => [...document.querySelectorAll(".cmppick .run input")]; for (let n = 0; n < 5; n++) z().find((i) => i.checked)?.click(); });
  await kx.waitForFunction(() => !document.querySelector(".cmppick .run input:checked"));
  // B und A anhaken, dann B in der Auswahl entfernen
  for (const n of ["Lauf B", "Lauf A"]) {
    await kx.evaluate((name) => [...document.querySelectorAll(".cmppick .run")]
      .find((r) => r.querySelector("b")?.textContent === name).querySelector("input").click(), n);
    await kx.waitForTimeout(100);
  }
  // #35: zwei von Hand angehakte Kaempfe - "Bezug tauschen" bleibt
  assert(!!(await kx.$("#cmpSwap")), "#35: zwei von Hand angehakt: Knopf \"Bezug tauschen\" da");
  await kx.evaluate(() => [...document.querySelectorAll(".cmppick .run")]
    .find((r) => r.querySelector("b")?.textContent === "Lauf B").querySelector(".x").click());
  await kx.waitForTimeout(150);
  const meldung = await kx.evaluate(() => {
    const t = document.querySelector("#toast");
    return { on: t.classList.contains("on"), text: t.textContent, knopf: t.querySelector(".tact")?.textContent || "" };
  });
  assert(JSON.stringify(await leiste()) === JSON.stringify(["Lauf C", "Lauf A"]),
    "#32: Kreuz in der Auswahl - der Kampf ist aus der Leiste", await leiste());
  assert(!(await auswahlLaeufe()).some((r) => r.name === "Lauf B"),
    "#32: Kreuz in der Auswahl - der Kampf ist aus der Auswahl", await auswahlLaeufe());
  assert(meldung.on && meldung.text.includes("Lauf B removed") && meldung.knopf === "Undo",
    "#32: Kreuz in der Auswahl - Meldung mit Rueckgaengig", meldung);
  assert(JSON.stringify(posts.at(-1)) === JSON.stringify(["Lauf C", "Lauf A"]),
    "#32: die Config ohne den Kampf gespeichert", posts.at(-1));
  await kx.evaluate(() => document.querySelector("#toast .tact")?.click());
  await kx.waitForTimeout(150);
  assert(JSON.stringify(await leiste()) === JSON.stringify(["Lauf C", "Lauf B", "Lauf A"]),
    "#32: Rueckgaengig - der Kampf steht wieder an seinem Platz in der Leiste", await leiste());
  const zurueck = await auswahlLaeufe();
  assert(JSON.stringify(zurueck) === JSON.stringify([
    { name: "Lauf C", an: false }, { name: "Lauf B", an: true }, { name: "Lauf A", an: true }]),
    "#32: Rueckgaengig - in der Auswahl an seinem Platz und wieder angehakt", zurueck);
  assert(JSON.stringify(posts.at(-1)) === JSON.stringify(["Lauf C", "Lauf B", "Lauf A"]),
    "#32: Rueckgaengig - die Config enthaelt ihn wieder", posts.at(-1));
  assert((await kx.evaluate(() => document.querySelector("#toast").textContent)).includes("Lauf B is back"),
    "#32: Rueckgaengig - Bestaetigung", await kx.evaluate(() => document.querySelector("#toast").textContent));
  assert(!kxErrors.length, "#32: keine Fehler in der Seite", kxErrors);

  // 10 · Issue #33: ab drei Kaempfen misst alles gegen den Fuehrenden. Das
  // Feld oben ist nach DPS sortiert und rechnet gegen ihn; das Raster darunter
  // rechnete gegen den zuerst angehakten, in der Reihenfolge des Anhakens -
  // derselbe Kampf stand oben bei -19 % und unten bei +1 %.
  // Angehakt wird so, dass der erste Haken nicht der Fuehrende ist.
  for (const n of ["Lauf B", "Lauf A"]) {
    await kx.evaluate((name) => { const k = [...document.querySelectorAll(".cmppick .run")]
      .find((r) => r.querySelector("b")?.textContent === name).querySelector("input"); if (k.checked) k.click(); }, n);
    await kx.waitForTimeout(100);
  }
  for (const n of ["Lauf A", "Lauf B", "Lauf C"]) {
    await kx.evaluate((name) => [...document.querySelectorAll(".cmppick .run")]
      .find((r) => r.querySelector("b")?.textContent === name).querySelector("input").click(), n);
    await kx.waitForTimeout(100);
  }
  const drei = await kx.evaluate(() => {
    const out = document.querySelector("#cmpOut");
    const feld = [...out.querySelectorAll(".cmpzeile")].map((z) => ({
      name: z.querySelector(".nm").firstChild?.textContent || "",
      d: z.querySelector(".wert span")?.textContent || "",
      dps: z.querySelector(".wert b")?.textContent || "",
    }));
    const grid = out.querySelector(".card .cgrid");
    const kinder = [...grid.children];
    const kopf = kinder.filter((c) => c.classList.contains("czelle") && c.classList.contains("kopf"))
      .map((c) => c.querySelector("b")?.textContent || "");
    const dpsKopf = kinder.findIndex((c) => c.classList.contains("cgz") && !c.classList.contains("kopf"));
    const dpsZellen = kinder.slice(dpsKopf + 1, dpsKopf + 1 + kopf.length)
      .map((c) => c.querySelector(".v span")?.textContent || "");
    const state = [...out.querySelectorAll(".cmpstate")].map((p) => p.textContent).join(" | ");
    return { feld, kopf, dpsZeile: kinder[dpsKopf]?.textContent || "", dpsZellen, state };
  });
  const vz = (s) => s.startsWith("+") ? 1 : /^[-−]/.test(s) ? -1 : 0;
  assert(drei.feld.length === 3 && drei.dpsZeile.startsWith("DPS"), "#33: drei Kaempfe im Feld, erste Rasterzeile DPS", drei);
  assert(drei.feld[0].name !== "Lauf A", "#33: der zuerst angehakte ist nicht der Fuehrende (sonst prueft der Test nichts)", drei.feld);
  assert(JSON.stringify(drei.kopf) === JSON.stringify(drei.feld.map((f) => f.name)),
    "#33: Rasterspalten in der Reihenfolge des Feldes, der Fuehrende vorn", drei);
  for (const f of drei.feld) {
    const ix = drei.kopf.indexOf(f.name);
    assert(ix >= 0 && vz(f.d) === vz(drei.dpsZellen[ix]),
      "#33: " + f.name + " hat in Feld und Raster dasselbe Vorzeichen", { feld: f.d, raster: drei.dpsZellen[ix] });
  }
  assert(drei.state.includes("Every change is measured against " + drei.feld[0].name + "."),
    "#33: die Zeile nennt den Fuehrenden als Bezug", drei.state);
  assert(!(await kx.$("#cmpSwap")), "#33: ab drei kein Knopf \"Bezug tauschen\"");
  assert(!kxErrors.length, "#33: keine Fehler in der Seite", kxErrors);
  await kx.close();

  /* 11 \u00b7 aus test-trainer-page.mjs, Neugestaltung 28.09.: der Trainer
     entfaellt (Spezifikation 3), diese Proben gehoeren zum besten Pull und
     zum Vergleich. SERVED: der erste Versuch an der Puppe wird mit seinen
     Einsaetzen festgehalten (POST /api/best, entry.best.run.casts); ein
     gespeicherter bester Pull ohne "casts" bleibt lesbar - die Seite laedt den
     naechsten Versuch ohne Fehler. */
  {
    const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
    const P1 = logFile("trainer-puppe-1.txt", [{ target: "Practice Dummy", start: at(20, 20, 0), secs: 62, scale: 1.3 }]);
    const P2 = logFile("trainer-puppe-2.txt", [{ target: "Practice Dummy", start: at(20, 20, 5), secs: 62, scale: 1.0 }]);
    let gespeichert = null;
    const served = async (best) => {
      const p = await browser.newPage({ viewport: { width: 1280, height: 860 } });
      await p.addInitScript(() => {
        try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ }
      });
      await p.route("http://boro.test/**", async (route) => {
        const req = route.request();
        const path = new URL(req.url()).pathname;
        const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
        if (path === "/api/best" && req.method() === "GET") return json(200, { ok: true, best });
        if (path === "/api/best" && req.method() === "POST") { gespeichert = JSON.parse(req.postData() || "{}"); return json(200, { ok: true }); }
        if (path.startsWith("/api/")) return json(200, {});
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
      });
      await p.goto("http://boro.test/index.html");
      return p;
    };
    const s1 = await served({});
    await s1.setInputFiles("#fileInput", P1);
    for (const end = Date.now() + 15000; Date.now() < end && !gespeichert;) await s1.waitForTimeout(250);
    await s1.close();
    assert(gespeichert?.key === "dummy:60" && Array.isArray(gespeichert?.entry?.best?.run?.casts),
      "SERVED: der erste Versuch wurde mit Einsaetzen festgehalten", gespeichert?.key);
    const ohne = structuredClone(gespeichert.entry);
    delete ohne.best.run.casts;
    const s2 = await served({ "dummy:60": ohne });
    const s2Errors = [];
    s2.on("pageerror", (e) => s2Errors.push(String(e)));
    await s2.setInputFiles("#fileInput", P2);
    await s2.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Practice Dummy"));
    await s2.waitForTimeout(300);
    for (const n of ["rotation", "compare", "analysis"]) {
      await s2.evaluate((x) => document.querySelector(`[data-tab="${x}"]`).click(), n);
      await s2.waitForTimeout(150);
    }
    assert(!s2Errors.length, "SERVED: ein bester Pull ohne Einsaetze bleibt lesbar, keine Fehler in der Seite", s2Errors);
    await s2.close();

    /* Zwei Builds an Vulcanus: je Runde so viele Treffer einer Faehigkeit;
       LB Langbogen + Armbrust, DA Dolch + Armbrust. Der Vergleich bleibt beim
       besten Pull und nennt den anderen Build. */
    const QF = ["Quick Fire", 964762401], DM = ["Detonation Mark", 953174691], BS = ["Blade Storm", 945408027];
    const ST = ["Strafing", 945674044], BR = ["Brutal Arrow", 945725019], FL = ["Flash Arrow", 945731619];
    const AV = ["Arrow Vortex", 945743775], AG = ["Agile Shot", 944723371];
    const FS = ["Fatal Stigma", 939780553], TS = ["Thunder Spirit", 940580872], VS = ["Vampiric Strike", 940620545];
    const LT = ["Lightning Throw", 940614453], MS = ["Mad Sword Dance", 940624689];
    const muster = (gewichte) => gewichte.flatMap(([s, n]) => Array(n).fill(s));
    const LB = muster([[QF, 4], [DM, 4], [BS, 4], [ST, 4], [BR, 4], [FL, 4], [AG, 2], [AV, 2]]);
    const DA = muster([[QF, 4], [DM, 4], [BS, 4], [FS, 4], [TS, 4], [VS, 4], [LT, 2], [MS, 2]]);
    const bauLog = (name, bau, day, scale) => {
      const rows = [];
      for (let k = 0; k * 500 < 80000; k++) {
        const [skill, sid] = bau[k % bau.length];
        rows.push(`${stamp(at(day, 21, 0) + k * 500)},DamageDone,${skill},${sid},${Math.round(1000 * scale * (1 + (k % 5)))},0,0,kNormalHit,Tester,Vulcanus`);
      }
      const f = join(work, name);
      writeFileSync(f, ["CombatLogVersion,4", ...rows].join("\n") + "\n");
      return f;
    };
    const q = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const qErrors = [];
    q.on("pageerror", (e) => qErrors.push(String(e)));
    await q.addInitScript(() => {
      try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ }
    });
    await q.goto("file://" + join(root, "dist", "renderer", "index.html"));
    for (const f of [bauLog("bau-lb.txt", LB, 20, 1.3), bauLog("bau-da1.txt", DA, 21, 1.0)]) {
      await q.setInputFiles("#fileInput", f);
      await q.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
      await q.waitForTimeout(150);
    }
    await q.evaluate(() => document.querySelector('[data-tab="compare"]').click());
    await q.waitForTimeout(150);
    /* Builds-Reiter 6: vorher erkannte die Seite die Builds aus den Skills und nannte "Longbow/Crossbow 1".
       Jetzt gilt ohne gespeicherten Build das Waffenpaar, und der Satz nennt es mit " + ". */
    assert((await q.evaluate(() => document.querySelector("#cmpBest")?.textContent || "")).includes("Your best pull used a different weapon pair (Longbow + Crossbow)."),
      "der Vergleich bleibt beim besten Pull und nennt das Paar (Bezug: dasselbe Waffenpaar)", await q.evaluate(() => document.querySelector("#cmpBest")?.textContent || ""));
    assert(!qErrors.length, "zwei Builds: keine Fehler in der Seite", qErrors);
    await q.close();

    /* Spezifikation Bester Pull 5.2, "ohne Lauf", im Browser ohne Server
       (file://): ein Log mit zwei Angreifern kommt in den Verlauf, aber
       bestRecord haelt dort keinen Lauf fest. Sein Pull ist der beste an
       Vulcanus; der Kampf des naechsten Logs wird gegen ihn verglichen. Ohne
       Server kann keine Datei geoeffnet werden: die Tafel nennt den Bezug mit
       seiner DPS und sagt, dass Treffer und Rotation fehlen - ohne Knopf. */
    {
      const zwei = join(work, "best-zwei.txt");
      const reihen = ["CombatLogVersion,4"];
      for (let k = 0; k * 500 < 120000; k++) {
        const [skill, sid] = SKILLS[k % SKILLS.length];
        for (const [wer, f] of [["Tester", 3], ["Zweiter", 1]])
          reihen.push(`${stamp(at(9, 21, 0) + k * 500)},DamageDone,${skill},${sid},${Math.round(1000 * f * (1 + (k % 5)))},0,0,kNormalHit,${wer},Vulcanus`);
      }
      writeFileSync(zwei, reihen.join("\n") + "\n");
      const a = await browser.newPage({ viewport: { width: 1280, height: 860 } });
      const aErrors = [];
      a.on("pageerror", (e) => aErrors.push(String(e)));
      await a.addInitScript(() => {
        try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ }
      });
      await a.goto("file://" + join(root, "dist", "renderer", "index.html"));
      await a.setInputFiles("#fileInput", zwei);
      await a.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
      await a.waitForTimeout(250);
      /* Seit 06.10. ist die Summe einer Gruppe ("alle") nie dein bester Pull (g im Verzeichnis). Der Pull
         ohne Lauf ist darum der eines gewaehlten Angreifers: Tester waehlen und dasselbe Log unter einem
         zweiten Namen oeffnen (dieselbe Datei loest kein neues Lesen aus) - histRecord schreibt dann seinen
         Kampf ohne Markierung, bestRecord haelt weiter keinen Lauf fest (mehrere Angreifer). */
      const gruppeDps = await a.evaluate(() => document.querySelector("#fightList .fight .kd")?.textContent || "");
      await a.evaluate(() => { const e = document.querySelector("#selPlayer"); e.value = "Tester"; e.dispatchEvent(new Event("change")); });
      const zweiB = join(work, "best-zwei-tester.txt");
      writeFileSync(zweiB, reihen.join("\n") + "\n");
      await a.setInputFiles("#fileInput", zweiB);
      await a.waitForFunction(() => /best-zwei-tester/.test(document.querySelector("#sbDatei")?.textContent || "")
        && document.querySelector("#selPlayer")?.value === "Tester");
      await a.waitForTimeout(250);
      // die Zahl, die der Verlauf fuer diesen Kampf fuehrt: die der Kampfwahl
      const bezugDps = await a.evaluate(() => document.querySelector("#fightList .fight .kd")?.textContent || "");
      await a.setInputFiles("#fileInput", logFile("best-ohne-a.txt", [V(25, 1.0)]));
      await a.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus")
        && (document.querySelector("#fightList .fight .kd")?.textContent || "") !== "");
      await a.waitForTimeout(250);
      await a.evaluate(() => document.querySelector('[data-tab="timeline"]').click());
      await a.waitForTimeout(200);
      const u = await a.evaluate(() => ({
        bezug: document.querySelector("#urteilInhalt .ubezug")?.textContent || "",
        satz: document.querySelector("#urteilInhalt .ohnelauf")?.textContent || "",
        knopf: !!document.querySelector("#btnOhneLauf"),
        vergleich: !!document.querySelector("#btnBestPull")?.hidden,
      }));
      assert(u.satz.includes("Hits and rotation of this pull are not saved.") && !u.knopf,
        "ohne Lauf, ohne Server: der Satz best.ohneLaufWeg steht im Urteil, ohne Knopf", u);
      assert(!!bezugDps && u.bezug.includes("against your best pull") && u.bezug.trim().endsWith(bezugDps),
        "ohne Lauf, ohne Server: die Zeile nennt die DPS des Bezugs aus dem Verlauf", { bezugDps, ...u });
      assert(u.vergleich, "ohne Lauf, ohne Server: „Im Vergleich“ bleibt verborgen", u);
      /* Derselbe Kampf steht zweimal im Verzeichnis: als Summe der Gruppe (g) und als Kampf von Tester.
         Im Verlauf gewinnt der Eintrag ohne g - Gold und die Zeile best tragen die DPS des Angreifers. */
      await a.evaluate(() => document.querySelector('[data-tab="history"]').click());
      await a.click('#verlaufZeit [data-z="alles"]', { timeout: 3000 }).catch(() => {});
      await a.waitForFunction(() => document.querySelectorAll("#histPlotFeld svg circle.hp").length >= 2, null, { timeout: 5000 }).catch(() => {});
      const v = await a.evaluate(() => ({
        punkte: [...document.querySelectorAll("#histPlotFeld svg circle.hp")].map((c) => ({ at: +c.dataset.at, dps: +c.dataset.dps, gold: c.classList.contains("hpspitze") })),
        best: [...document.querySelectorAll("#histDetail tbody tr.best")].map((z) => z.textContent.replace(/\s+/g, " ").trim()),
      }));
      const goldP = v.punkte.filter((x) => x.gold);
      assert(!!gruppeDps && gruppeDps !== bezugDps && v.punkte.length === 2 && goldP.length === 1 && goldP[0].at === at(9, 21, 0)
        && v.best.length === 1 && v.best[0].includes(bezugDps) && !v.best[0].includes(gruppeDps),
        "ohne Lauf: im Verlauf steht der Kampf einmal, mit der DPS des Angreifers - Gold und Zeile best, nicht die Summe der Gruppe",
        { gruppeDps, bezugDps, ...v });
      assert(!aErrors.length, "ohne Lauf, ohne Server: keine Fehler in der Seite", aErrors);
      await a.close();
    }

    /* Spezifikation Bester Pull 5.2, "ohne Lauf": der beste Pull steht nur
       im Verlauf (logIndex), boro-best.json kennt ihn nicht. Er bleibt der
       Bezug (BestInfo.ohneLauf), aber es gibt nichts zu vergleichen: der
       Knopf in der Tafel bleibt verborgen, der Vergleich hakt nichts an, und
       keine Stelle wirft. Satz und Knopf "Log oeffnen" folgen spaeter. */
    {
      const altAt = at(10, 21, 0);
      // zwei Kaempfe, beide schwaecher als der im Verlauf: der Vergleich hat den letzten Pull als Paar
      const L10 = logFile("best-10.txt", [V(25, 1.0), { ...V(25, 1.1), start: at(25, 21, 5) }]);
      const s3 = await browser.newPage({ viewport: { width: 1280, height: 860 } });
      const s3Errors = [];
      s3.on("pageerror", (e) => s3Errors.push(String(e)));
      await s3.addInitScript(() => {
        try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ }
      });
      const s3Posts = [];
      /* Die Datei des besten Pulls liegt im Log-Ordner des gestellten Helfers
         (GET /api/logs, GET /api/log): sein Pull und danach ein schwacher,
         der beim Laden zuerst gewaehlt ist. */
      const altText = logText([{ target: "Vulcanus", start: altAt, secs: 90, scale: 3 },
        { target: "Vulcanus", start: at(10, 21, 5), secs: 75, scale: 0.5 }]);
      const logHolt = [];
      await s3.route("http://boro.test/**", async (route) => {
        const req = route.request();
        const url = new URL(req.url()), path = url.pathname;
        const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
        if (path === "/api/logs" && req.method() === "GET")
          return json(200, { ok: true, files: [{ name: "alt.txt", size: altText.length, mtime: Math.round(altAt / 1000) + 600 }] });
        if (path === "/api/log" && req.method() === "GET") {
          logHolt.push(url.searchParams.get("name"));
          if (url.searchParams.get("name") !== "alt.txt") return json(404, { ok: false });
          return json(200, { ok: true, file: "alt.txt", from: 0, to: altText.length, size: altText.length, text: altText });
        }
        if (path === "/api/config" && req.method() === "GET")
          return json(200, { logIndex: { "alt.txt": { size: 1, fights: [{ name: "Vulcanus", dps: 20000, dmg: 1800000, dur: 90, at: altAt }] } } });
        if (path === "/api/best" && req.method() === "GET") return json(200, { ok: true, best: {} });
        if (path === "/api/best" && req.method() === "POST") { s3Posts.push(JSON.parse(req.postData() || "{}")); return json(200, { ok: true }); }
        if (path.startsWith("/api/")) return json(200, {});
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
      });
      await s3.goto("http://boro.test/index.html");
      await s3.waitForTimeout(300);
      await s3.setInputFiles("#fileInput", L10);
      await s3.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
      await s3.waitForTimeout(300);
      await s3.evaluate(() => document.querySelector('[data-tab="timeline"]').click());
      await s3.waitForTimeout(150);
      const knopf = await s3.evaluate(() => { const b = document.querySelector("#btnBestPull"); return { da: !!b, hidden: !!b?.hidden }; });
      assert(knopf.da && knopf.hidden, "ohne Lauf: der Knopf „Im Vergleich“ bleibt verborgen", knopf);
      await s3.evaluate(() => document.querySelector('[data-tab="compare"]').click());
      await s3.waitForTimeout(150);
      const vgl = await s3.evaluate(() => ({
        zeile: document.querySelector("#cmpBest")?.textContent || "",
        haken: [...document.querySelectorAll(".cmppick .run input:checked")].map((i) => i.closest(".run")?.getAttribute("data-cid") || ""),
        letzt: document.querySelector("#vglLetzt")?.getAttribute("aria-pressed") || "",
      }));
      /* Ohne Lauf gibt es das Paar "bester Pull" nicht; der Vergleich nimmt
         den letzten Pull. Ein Haken allein hiesse: das Paar wurde mit einer
         Kennung ohne Lauf gesetzt, die kein Lauf ist. */
      assert(!vgl.zeile.includes("first fight") && vgl.haken.length === 2 && vgl.letzt === "true",
        "ohne Lauf: der Vergleich nennt keinen ersten Kampf und steht gegen den letzten Pull", vgl);
      for (const n of ["analysis", "rotation", "timeline", "compare"]) {
        await s3.evaluate((x) => document.querySelector(`[data-tab="${x}"]`).click(), n);
        await s3.waitForTimeout(150);
      }
      for (const end = Date.now() + 6000; Date.now() < end && !s3Posts.length;) await s3.waitForTimeout(250);
      assert(s3Posts.length > 0 && s3Posts.every((p) => p.entry?.best?.at !== altAt),
        "ohne Lauf: boro-best.json haelt nur, was einen Lauf hat", s3Posts.map((p) => p.entry?.best?.at));
      /* Mit Server: unter der Zeile des Bezugs der Satz und der Knopf "Log
         oeffnen". Er ist per Tastatur erreichbar, sein Name enthaelt den
         sichtbaren Text (WCAG 2.5.3), und bei 560 px rollt nichts waagerecht. */
      await s3.evaluate(() => document.querySelector('[data-tab="timeline"]').click());
      await s3.waitForTimeout(200);
      const mit = await s3.evaluate(() => {
        const b = document.querySelector("#btnOhneLauf");
        return { satz: document.querySelector("#urteilInhalt .ohnelauf")?.textContent || "",
                 bezug: document.querySelector("#urteilInhalt .ubezug")?.textContent || "",
                 knopf: !!b && !!b.offsetParent, text: (b?.textContent || "").trim(),
                 name: b?.getAttribute("aria-label") ?? null, tab: b ? b.tabIndex : -1, aus: !!b?.disabled };
      });
      assert(mit.satz.includes("Open the log from 10/09") && mit.knopf && mit.text === "Open log",
        "ohne Lauf, mit Server: Satz best.ohneLauf mit Datum und Knopf „Open log“", mit);
      assert(mit.bezug.includes("against your best pull") && mit.bezug.trim().endsWith("20.0k"),
        "ohne Lauf, mit Server: die Zeile nennt Bezug und DPS aus dem Verlauf", mit);
      assert(mit.tab >= 0 && !mit.aus && (mit.name === null || mit.name.toLowerCase().includes(mit.text.toLowerCase())),
        "ohne Lauf: der Knopf ist per Tastatur erreichbar, sein Name enthaelt den sichtbaren Text", mit);
      await s3.setViewportSize({ width: 560, height: 860 });
      await s3.waitForTimeout(250);
      const breit = await s3.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth,
        knopf: !!document.querySelector("#btnOhneLauf")?.offsetParent }));
      assert(breit.knopf && breit.scroll <= breit.client, "ohne Lauf: bei 560 px rollt nichts waagerecht", breit);
      await s3.setViewportSize({ width: 1280, height: 860 });
      await s3.waitForTimeout(250);
      await s3.focus("#btnOhneLauf");
      await s3.keyboard.press("Enter");
      for (const end = Date.now() + 8000; Date.now() < end && !logHolt.includes("alt.txt");) await s3.waitForTimeout(100);
      assert(logHolt.includes("alt.txt"), "ohne Lauf: der Knopf holt die Datei ueber GET /api/log?name=alt.txt", logHolt);
      await s3.waitForFunction(() => { const b = document.querySelector("#btnBestPull"); return !!b && !b.hidden && !!b.offsetParent; },
        null, { timeout: 8000 }).catch(() => {});
      const nach = await s3.evaluate(() => {
        const b = document.querySelector("#btnBestPull");
        return { vergleich: !!b && !b.hidden && !!b.offsetParent, satz: document.querySelector("#urteilInhalt .usatz")?.textContent || "",
                 ohne: !!document.querySelector("#urteilInhalt .ohnelauf"), fokus: document.activeElement?.id || "" };
      });
      /* Gewaehlt ist danach der Kampf des Bezugs (start === refAt), nicht der
         zuerst gewaehlte schwache: er ist jetzt selbst der beste Pull, und
         "Im Vergleich" steht gegen den zweitbesten. */
      assert(nach.vergleich && !nach.ohne && nach.satz.includes("Your best pull on Vulcanus"),
        "ohne Lauf: nach dem Oeffnen ist der Kampf des Bezugs gewaehlt und „Im Vergleich“ da", nach);
      assert(nach.fokus === "kwKnopf", "ohne Lauf: der Fokus steht danach auf der Kampfwahl wie nach jedem Wechsel des Kampfes", nach);
      assert(!s3Errors.length, "ohne Lauf: keine Fehler in der Seite", s3Errors);
      await s3.close();
    }

    /* Alte Zuordnung (#207): das Verzeichnis traegt noch b aus der Zeit des Builds-Reiters. Die Seite liest es nicht
       mehr und fragt /api/builds nicht mehr; der Hinweis nennt das Paar des besten Pulls. Dateiname und
       Startzeit stimmen mit denen der Logs ueberein. */
    const lager = { "lb00000000": { name: "Bow", weapons: ["Longbow", "Crossbow"], first: 1, eigen: 1 },
                    "da00000000": { name: "Dagger", weapons: ["Dagger", "Crossbow"], first: 1, eigen: 1 } };
    const zeile = (b, day) => ({ name: "Vulcanus", dps: 1, dmg: 1, dur: 80, at: at(day, 21, 0), b });
    const index = { "bau-lb.txt": { size: 1, fights: [zeile("lb00000000", 20)] }, "bau-da1.txt": { size: 1, fights: [zeile("da00000000", 21)] } };
    const g = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const gErrors = [], gAsked = [];
    g.on("pageerror", (e) => gErrors.push(String(e)));
    await g.addInitScript(() => {
      try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ }
    });
    await g.route("http://boro.test/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (/^\/api\/(builds|plans)/.test(path)) gAsked.push(path);
      if (path === "/api/best" && req.method() === "GET") return json(200, { ok: true, best: {} });
      if (path === "/api/config" && req.method() === "GET") return json(200, { rundgangGesehen: true, logIndex: index });
      if (path.startsWith("/api/")) return json(200, { ok: true });
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    });
    await g.goto("http://boro.test/index.html");
    await g.waitForTimeout(500);
    for (const f of [join(work, "bau-lb.txt"), join(work, "bau-da1.txt")]) {
      await g.setInputFiles("#fileInput", f);
      await g.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
      await g.waitForTimeout(250);
    }
    await g.evaluate(() => document.querySelector('[data-tab="compare"]').click());
    await g.waitForTimeout(250);
    assert((await g.evaluate(() => document.querySelector("#cmpBest")?.textContent || "")).includes("Your best pull used a different weapon pair (Longbow + Crossbow)."),
      "alte Zuordnung b im Verzeichnis (Builds-Reiter entfallen, #207): sie wird nicht gelesen, der Vergleich nennt das Paar des besten Pulls", await g.evaluate(() => document.querySelector("#cmpBest")?.textContent || ""));
    assert(!gErrors.length, "alte Zuordnung: keine Fehler in der Seite", gErrors);
    assert(!gAsked.length, "die Seite fragt weder /api/builds noch /api/plans (#207)", gAsked);
    await g.close();

    /* Builds-Reiter 6 (Fixrunde 1): kennt das Verzeichnis zu einem gespeicherten besten Pull weder Build noch Paar
       (ein Eintrag ohne w und b), kommt das Paar aus seinem Lauf - der Hinweis nennt es. Zuerst wird der Pull aus
       dem Langbogen-Log festgehalten, dann dient er in einer neuen Sitzung als gespeicherter bester Pull, mit
       einem Eintrag im Verzeichnis (anderer Dateiname, anderer Zeitpunkt), der nur den Zeitpunkt kennt. */
    const offen = async (best, index, bei) => {
      const h = await browser.newPage({ viewport: { width: 1280, height: 860 } });
      h.errors = [];
      h.on("pageerror", (e) => h.errors.push(String(e)));
      await h.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ } });
      await h.route("http://boro.test/**", async (route) => {
        const req = route.request();
        const path = new URL(req.url()).pathname;
        const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
        if (path === "/api/best" && req.method() === "GET") return json(200, { ok: true, best });
        if (path === "/api/best") { bei(JSON.parse(req.postData() || "{}")); return json(200, { ok: true }); }
        if (path === "/api/config" && req.method() === "GET") return json(200, { rundgangGesehen: true, ...(index ? { logIndex: index } : {}) });
        if (path.startsWith("/api/")) return json(200, { ok: true });
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
      });
      await h.goto("http://boro.test/index.html");
      await h.waitForTimeout(500);
      return h;
    };
    const ladeVulcanus = async (h, datei) => {
      await h.setInputFiles("#fileInput", datei);
      await h.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
      await h.waitForTimeout(250);
    };
    let festgehalten = null;
    const h1 = await offen({}, null, (b) => { festgehalten = b; });
    await ladeVulcanus(h1, join(work, "bau-lb.txt"));
    for (const ende = Date.now() + 10000; Date.now() < ende && !festgehalten;) await h1.waitForTimeout(200);
    await h1.close();
    const entry = structuredClone(festgehalten?.entry);
    const spaeter = entry.best.at + 864e5 * 40;
    entry.best.at = spaeter;
    /* Bester Pull 4: ein Kampf, den Verlauf und boro-best.json beide kennen, zaehlt mit den Zahlen des Verlaufs.
       Der Eintrag traegt deshalb DPS und Laenge des gespeicherten Laufs, wie ihn das Verzeichnis fuer denselben
       Kampf auch fuehrte - mit dps 1 waere er nach der Regel nicht mehr der beste Pull. */
    const h2 = await offen({ [festgehalten.key]: entry },
      { "fremd.txt": { size: 1, fights: [{ name: "Vulcanus", dps: entry.best.run.dps, dmg: 1, dur: entry.best.run.seconds, at: spaeter }] } }, () => {});
    await ladeVulcanus(h2, join(work, "bau-da1.txt"));
    await h2.evaluate(() => document.querySelector('[data-tab="compare"]').click());
    await h2.waitForTimeout(250);
    assert((await h2.evaluate(() => document.querySelector("#cmpBest")?.textContent || "")).includes("Your best pull used a different weapon pair (Longbow + Crossbow)."),
      "Eintrag im Verzeichnis ohne Paar: das Paar kommt aus dem Lauf des gespeicherten Pulls", await h2.evaluate(() => document.querySelector("#cmpBest")?.textContent || ""));
    assert(!h2.errors.length, "Paar aus dem Lauf: keine Fehler in der Seite", h2.errors);
    await h2.close();
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
console.log();
if (failed) { console.log(`BEST PAGE FAILED - ${failed}`); process.exit(1); }
console.log("BEST PAGE PASSED");
