// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Gezielter Test von "Deine Rotation" (Reiter Rotation, erster Block,
// Issue #44, Stufe 1) an der gebauten Seite, dist/renderer/index.html:
// zuerst ueber file:// mit dem Beispiel (ohne Build: die Wahl gilt in der
// Sitzung), dann wie vom eigenen Helfer ausgeliefert (page.route) mit einem
// erzeugten Log, fuer das Feld rot am Build.
//
// Stufe 2: unter Live haengt die Leiste nur an (gestellter Helfer mit den
// echten Funktionen aus src/main/logs.ts, wie test-live-page.mjs).
//
// Run:  npm run test:rotation-page     (baut die Seite zuerst)

import * as esbuild from "esbuild";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const work = mkdtempSync(join(tmpdir(), "boro-rotation-"));
const two = (n, w = 2) => String(n).padStart(w, "0");
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-` +
         `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`;
};
const QF = ["Quick Fire", 964762401], ST = ["Strafing", 945674044], DV = ["Deadly Viper", 940584840], AV = ["Arrow Vortex", 945743775];
const FS = ["Fatal Stigma", 939780553], VS = ["Vampiric Strike", 940620545];
/* Ein Boss-Log (Vulcanus), 30 s: alle 0,5 s ein gedrueckter Einsatz im Wechsel
   (Schnellfeuer, Strafing), zwischen 9,5 s und 14,3 s keiner; Deadly Viper
   jede Sekunde durch. Der Schaden in fuenf Stufen (autoMap). */
function stilleLog(start = Date.UTC(2026, 8, 20, 21, 0, 0), mehr = [], [A1, A2] = [QF, ST]) {
  const rows = [];
  const zeile = (t, [n, id], k) => rows.push([start + t, `,DamageDone,${n},${id},${1000 * (1 + (k % 5))},0,0,kNormalHit,Tester,Vulcanus`]);
  let k = 0;
  for (let t = 0; t < 10000; t += 500) zeile(t, k % 2 ? A2 : A1, k++);
  for (let t = 14300; t < 30000; t += 500) zeile(t, k % 2 ? A2 : A1, k++);
  for (let t = 250; t < 30000; t += 1000) zeile(t, DV, k++);
  for (const [t, s] of mehr) zeile(t, s, k++);
  rows.sort((a, b) => a[0] - b[0]);
  return ["CombatLogVersion,4", ...rows.map(([t, r]) => stamp(t) + r)].join("\n") + "\n";
}
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");

/* Was der Block gerade zeigt: Satz, Schluessel der Symbole in der Leiste,
   Punkte der Punktreihe, die Zeilen der Spalte. */
const stand = (page) => page.evaluate(() => {
  const box = document.querySelector("#deineRot");
  // ohne die Symbole, die nach einer Wahl noch ausblenden (FLIP, .geht)
  const syms = [...document.querySelectorAll("#rotBar .drsym:not(.geht)")].map((s) => s.dataset.k);
  return {
    hidden: !box || box.hidden,
    lead: document.querySelector("#deineRotLead")?.textContent || "",
    syms, keys: [...new Set(syms)],
    punkte: document.querySelectorAll("#rotBar .drpunkte i").length,
    striche: document.querySelectorAll("#rotBar .drstrich").length,
    ged: [...document.querySelectorAll("#drGed .rotgz")].map((b) => ({ k: b.dataset.k, an: b.getAttribute("aria-pressed"), text: b.textContent })),
    gedZeilen: [...document.querySelectorAll("#drGed .drzeile")].map((z) => ({ k: z.dataset.k, text: z.textContent,
      knoepfe: [...z.querySelectorAll("[data-wahl]")].map((b) => b.dataset.wahl + ":" + (b.getAttribute("aria-label") || "")) })),
    auto: [...document.querySelectorAll("#drAuto li[data-k]")].map((l) => ({ k: l.dataset.k, text: l.textContent,
      // Issue #52: kurz "confirmed"/"left out", der volle Satz im title
      status: l.querySelector(".drfest")?.textContent || "", fest: l.querySelector(".drfest")?.title || "",
      knoepfe: [...l.querySelectorAll("[data-wahl]")].map((b) => b.dataset.wahl + ":" + (b.getAttribute("aria-label") || "")) })),
    autoText: document.querySelector("#drAuto")?.textContent || "",
    kasten: (() => {
      const d = document.querySelector("details#drAutoKasten"), su = d?.querySelector(":scope > summary");
      return { da: !!d && !!su, offen: !!d?.open, label: su?.getAttribute("aria-label") || "", kopf: (su?.textContent || "").replace(/\s+/g, " ").trim(),
        neu: su?.querySelector(".drneu")?.textContent || "", syms: su ? su.querySelectorAll(".sic").length : 0 };
    })(),
  };
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ }
  });
  await page.goto("file://" + join(root, "dist", "renderer", "index.html"));
  const tab = async (name) => { await page.evaluate((n) => document.querySelector(`[data-tab="${n}"]`).click(), name); await page.waitForTimeout(150); };
  await page.evaluate(() => document.querySelector("#btnSample").click());
  await page.waitForFunction(() => !document.querySelector("#app").hidden);
  await tab("rotation");

  // 1 \u00b7 der erste Block. Neugestaltung 28.09.: Trainer und Leinwand "Alle Einsaetze" entfallen (Spezifikation 3)
  // folgt Aufgabe 10: der Satz ohne Zeitspalte steht jetzt im Bereich Rotation, verborgen per CSS (body.noTime) - gezaehlt wird, was zu sehen ist
  const reihe = await page.evaluate(() => [...document.querySelector("#p-rotation").children]
    .filter((c) => !c.matches("h2.vh") && !c.hidden && getComputedStyle(c).display !== "none").map((c) => c.id || c.className));
  assert(reihe.length === 1 && reihe[0] === "deineRot", "Deine Rotation ist der einzige Block (ohne Gruppe)", reihe);
  let s = await stand(page);
  assert(!s.hidden && await page.evaluate(() => document.querySelector("#deineRotTitel").textContent === "Your rotation"),
    "Beispiel: der Block steht da, mit Ueberschrift");

  // 2 · was draussen ist: Deadly Viper (Passiv); Auge von Ventius drueckt man selbst
  assert(s.keys.length > 3 && !s.keys.includes("Deadly Viper") && s.keys.includes("Eye of Ventius"),
    "die Leiste: ohne Deadly Viper, mit Eye of Ventius", s.keys);
  assert(!s.ged.some((g) => g.k === "Deadly Viper") && s.ged.some((g) => g.k === "Eye of Ventius"),
    "Gedrueckt: ohne Deadly Viper, mit Eye of Ventius", s.ged.map((g) => g.k));
  assert(/, in the order of the fight – without Deadly Viper, which deals damage on its own\./.test(s.lead) && !/Ventius/.test(s.lead),
    "der Satz nennt Deadly Viper, nicht Ventius", s.lead);
  const viper = s.auto.find((a) => a.k === "Deadly Viper");
  const viperN = viper ? +(/(\d+)×/.exec(viper.text) || [])[1] : 0;
  assert(s.auto.length === 1 && !!viper && viper.text.includes("Listed as a passive – Borometer knows it that way."),
    "Automatisch: Deadly Viper mit dem Grund Passiv, sonst nichts", s.auto);
  assert(viperN > 10 && s.punkte === viperN, "die Punktreihe: ein Punkt je Einsatz von Deadly Viper", { viperN, punkte: s.punkte });
  assert(s.autoText.includes("Applies to this session."),
    "ohne Build: die Wahl gilt in der Sitzung", s.autoText);
  /* Issue #52: "Automatisch" ist ein aufklappbarer Kasten. Deadly Viper ist ein ungepruefter Vorschlag:
     der Kasten steht offen, der Kopf sagt "1 new"; eine Zeile je Skill, die Begruendung einzeilig mit title. */
  assert(s.kasten.da && s.kasten.offen && s.kasten.label === "Automatic, 1 left out, 1 new" && s.kasten.neu === "1 new" && s.kasten.syms === 1 &&
    /^Automatic · 1 left out/.test(s.kasten.kopf), "Kasten: ungepruefter Vorschlag - offen, Kopf mit Anzahl und 1 new", s.kasten);
  assert(s.autoText.includes("These skills deal damage on their own; they are not in the bar, only as dots below it."),
    "Kasten: der Satz unter der Liste", s.autoText);
  const kastenMass = await page.evaluate(() => {
    const su = document.querySelector("#drAutoKasten > summary"), li = document.querySelector("#drAuto li[data-k]");
    const g = li.querySelector(".drgrund"), sym = su.querySelector(".sic"), neu = su.querySelector(".drneu");
    const probe = document.createElement("i"); probe.style.color = "var(--ridge)"; document.body.appendChild(probe);
    const ridge = getComputedStyle(probe).color; probe.remove();
    return { kopf: Math.round(su.getBoundingClientRect().height), zeile: Math.round(li.getBoundingClientRect().height),
      grundEinzeilig: getComputedStyle(g).whiteSpace === "nowrap" && getComputedStyle(g).textOverflow === "ellipsis",
      grundTitle: g.title, sym: Math.round(sym.getBoundingClientRect().width), symStumm: !!sym.closest("[aria-hidden='true']"),
      neuRand: getComputedStyle(neu).borderTopColor, ridge,
      ulLabel: document.querySelector("#drAuto ul")?.getAttribute("aria-labelledby"), suId: su.id };
  });
  assert(kastenMass.kopf >= 30 && kastenMass.kopf <= 42 && kastenMass.zeile <= 44 && kastenMass.grundEinzeilig &&
    kastenMass.grundTitle === "Listed as a passive – Borometer knows it that way." && kastenMass.sym === 20 && kastenMass.symStumm &&
    kastenMass.neuRand === kastenMass.ridge && kastenMass.ulLabel === kastenMass.suId && !!kastenMass.suId,
    "Kasten: Kopf eine Zeile (~38 px), eine Zeile je Skill, Begruendung mit title, Symbole 20 px stumm, 1 new mit --ridge-Rand", kastenMass);
  const lead1 = +(/^(\d+) casts you pressed/.exec(s.lead) || [])[1];
  assert(lead1 > 0 && lead1 === s.striche, "der Satz zaehlt jeden gedrueckten Einsatz, das Band hat einen Strich je Einsatz",
    { lead1, striche: s.striche });
  assert(s.syms.length <= s.striche && (s.syms.length === s.striche || /show only as a line in the band/.test(s.lead)),
    "was keinen Platz findet, steht als Strich, und der Satz sagt es", { syms: s.syms.length, striche: s.striche, lead: s.lead });
  const mass = await page.evaluate(() => {
    const b = document.querySelector("#deineRotScroll"), sym = document.querySelector("#rotBar .drsym:not(.jetzt)");
    const r = sym.getBoundingClientRect(), cs = getComputedStyle(sym);
    return { rollt: b.scrollWidth > b.clientWidth, w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderTopLeftRadius };
  });
  // Neugestaltung 28.09.: der Massstab nach dem Median-Abstand entfaellt (Spezifikation 3) - die Leiste zeigt den ganzen Kampf und rollt nicht mehr in sich
  assert(!mass.rollt && mass.w === 32 && mass.h === 32 && mass.radius === "7px", "Symbole 32 px (der aktuelle Einsatz 40 px, Stufe 2), Radius 7 px; die Leiste zeigt den ganzen Kampf ohne Rollen", mass);

  // 3 · Zeigen auf einen Namen hebt nur dessen Einsaetze hervor
  await page.hover('#drGed .rotgz[data-k="Basic Shot"]');
  await page.waitForTimeout(250);
  const heb = await page.evaluate(() => ({
    hebt: document.querySelector("#rotBar").classList.contains("hebt"),
    an: [...document.querySelectorAll("#rotBar .drsym.an")].map((x) => x.dataset.k),
    blass: getComputedStyle(document.querySelector('#rotBar .drsym:not(.an)')).opacity,
  }));
  assert(heb.hebt && heb.an.length > 0 && heb.an.every((k) => k === "Basic Shot") && heb.blass === "0.35",
    "Zeigen: nur Basic Shot hervorgehoben, die anderen auf 35 %", heb);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(80);
  assert(!(await page.evaluate(() => document.querySelector("#rotBar").classList.contains("hebt"))), "weg vom Namen: nichts hervorgehoben");

  // 4 · ohne Aenderung kein Neubau (Live zeichnet alle zwei Sekunden)
  await page.evaluate(() => {
    document.querySelector("#rotBar .drsym").dataset.merk = "1";
    document.querySelector("#drGed .rotgz").dataset.merk = "1";
  });
  await tab("timeline");
  await tab("rotation");
  assert(await page.evaluate(() => document.querySelector("#rotBar .drsym").dataset.merk === "1" && document.querySelector("#drGed .rotgz").dataset.merk === "1"),
    "neu gezeichnet ohne Aenderung: Leiste und Spalte bleiben dieselben Elemente");
  assert(await page.evaluate(() => ["#rotBar", "#drGed", "#drAuto"].every((id) => !document.querySelector(id).hasAttribute("data-marke"))),
    "die Leiste haelt ihr HTML nicht als Attribut im DOM (Review #44)");

  // 5 · aus der Leiste nehmen (nur die Ansicht fuer diesen Kampf), Alle zeigen
  await page.focus('#drGed .rotgz[data-k="Basic Shot"]');
  await page.keyboard.press("Enter");
  await page.waitForTimeout(120);
  s = await stand(page);
  assert(!s.keys.includes("Basic Shot") && s.ged.find((g) => g.k === "Basic Shot")?.an === "false",
    "Basic Shot aus der Leiste, der Knopf sagt es (aria-pressed)", s.ged.find((g) => g.k === "Basic Shot"));
  assert(/One skill is out of the bar/.test(s.lead), "der Satz sagt, dass eine Faehigkeit aus der Leiste ist", s.lead);
  assert(await page.evaluate(() => document.activeElement?.dataset?.k === "Basic Shot"), "der Fokus bleibt auf dem Knopf");
  /* Neugestaltung 28.09. (Aufgabe 4, Luecken 3.1, Entwurf E:447): "alle zeigen" steht im Kopf des
     Bereichs, mit der Zahl der ausgeblendeten - vorher unter der Spalte "Gedrueckt" */
  assert(await page.evaluate(() => !document.querySelector("#rotCtl").hidden && !!document.querySelector("#bereichKopf #rotShowAll")?.getClientRects().length &&
    /1 hidden/.test(document.querySelector("#rotCtl").textContent)),
    "Alle zeigen steht im Kopf, mit der Zahl der ausgeblendeten");
  // die Spalte ist ein Tab-Halt mit Pfeiltasten
  await page.keyboard.press("ArrowDown");
  const naechster = await page.evaluate(() => document.activeElement?.dataset?.k);
  assert(!!naechster && naechster !== "Basic Shot", "Pfeil nach unten: der naechste Name", naechster);
  await page.evaluate(() => document.querySelector("#rotShowAll").click());
  await page.waitForTimeout(120);
  s = await stand(page);
  assert(s.keys.includes("Basic Shot") && await page.evaluate(() => document.querySelector("#rotCtl").hidden), "Alle zeigen: wieder alle in der Leiste");

  // 7 · Tooltip ueber einem Symbol der Leiste
  /* folgt Aufgabe 10: der Zeitverlauf unter der Leiste schiebt die Einsaetze tiefer - der Fokus darauf (Schritt 5)
     rollt die Leiste aus dem Bild; erst zurueck zu ihr, dann zeigen */
  const box = await page.evaluate(() => { const e = document.querySelector("#rotBar .drsym"); e.scrollIntoView({ block: "center" });
    const r = e.getBoundingClientRect(); return { x: r.x + 16, y: r.y + 16 }; });
  await page.mouse.move(box.x, box.y);
  await page.waitForTimeout(100);
  const tip = await page.evaluate(() => ({ on: document.querySelector("#tip").classList.contains("on"), text: document.querySelector("#tip").textContent }));
  assert(tip.on && /hit/.test(tip.text), "Tooltip: Zeit, Schaden und Treffer des Einsatzes", tip);
  await page.mouse.move(5, 5);

  // 8 · drei Themen: Rahmen, Punkte und Band haben Farbe
  for (const theme of ["light", "tnl", "dark"]) {
    await page.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`).click(), theme);
    await page.waitForTimeout(120);
    const f = await page.evaluate(() => ({
      ring: getComputedStyle(document.querySelector("#rotBar .drsym")).boxShadow,
      punkt: getComputedStyle(document.querySelector("#rotBar .drpunkte i")).backgroundColor,
      band: getComputedStyle(document.querySelector("#rotBar .drband")).backgroundColor,
    }));
    assert(f.ring !== "none" && f.punkt !== "rgba(0, 0, 0, 0)" && f.band !== "rgba(0, 0, 0, 0)", `Thema ${theme}: Rahmen, Punkte und Band haben Farbe`, f);
    // Issue #52: der Kasten hat einen Rand, der Hinweis "1 new" den Rand in --ridge (nicht Gold)
    const k = await page.evaluate(() => {
      const probe = document.createElement("i"); document.body.appendChild(probe);
      const farbe = (v) => { probe.style.color = v; return getComputedStyle(probe).color; };
      const ridge = farbe("var(--ridge)"), gold = farbe("var(--gold)");
      probe.remove();
      const neu = getComputedStyle(document.querySelector("#drAutoKasten .drneu"));
      return { ridge, gold, neu: neu.borderTopColor, text: neu.color, kasten: getComputedStyle(document.querySelector("#drAutoKasten")).boxShadow };
    });
    assert(k.neu === k.ridge && k.neu !== k.gold && k.text !== k.gold && k.kasten !== "none", `Thema ${theme}: Kasten mit Rand, 1 new in --ridge, nicht Gold`, k);
  }

  // 9 · 560 px, hell: Spalte ueber der Leiste, die Seite rollt nicht waagerecht
  await page.evaluate(() => document.querySelector('#themeRow [data-theme="light"]').click());
  await page.setViewportSize({ width: 560, height: 900 });
  await page.waitForTimeout(300);
  const schmal = await page.evaluate(() => {
    /* Neugestaltung 28.09. (Aufgabe 4, Luecken 3, Entwurf r11-rotation-560): die Leiste zuerst, darunter
       der Kasten Automatisch, darunter das Feld Einsaetze - vorher standen Gedrueckt und Automatisch ueber
       der Leiste. Beide Teile liegen weiter ganz in der Karte. */
    const bu = document.querySelector("#deineRotScroll").getBoundingClientRect();
    const sp = [...document.querySelectorAll("#deineRot .drspalte")].map((x) => x.getBoundingClientRect());
    const k = document.querySelector("#deineRot").getBoundingClientRect();
    return { seite: document.documentElement.scrollWidth <= window.innerWidth,
      ueber: sp.length === 2 && bu.bottom <= sp[0].top + 1 && sp[0].bottom <= sp[1].top + 1 && sp.every((r) => r.left >= k.left - 0.5 && r.right <= k.right + 0.5),
      buehneRollt: document.querySelector("#deineRotScroll").scrollWidth > document.querySelector("#deineRotScroll").clientWidth };
  });
  // Neugestaltung 28.09.: die Leiste zeigt den ganzen Kampf auf der Breite und rollt nicht mehr in sich
  assert(schmal.seite && schmal.ueber && !schmal.buehneRollt, "560 px: kein waagerechtes Rollen, Leiste, darunter Automatisch und Einsaetze, die Leiste rollt nicht", schmal);
  const schmalKasten = await page.evaluate(() => {
    const li = document.querySelector("#drAuto li[data-k]"), n = li.querySelector(".drname").getBoundingClientRect(), g = li.querySelector(".drgrund");
    const d = document.querySelector("#drAutoKasten").getBoundingClientRect();
    return { unter: g.getBoundingClientRect().top >= n.bottom - 1, bricht: getComputedStyle(g).whiteSpace !== "nowrap",
      drin: d.right <= window.innerWidth && d.left >= 0 };
  });
  assert(schmalKasten.unter && schmalKasten.bricht && schmalKasten.drin, "560 px: die Begruendung steht unter dem Namen und bricht um, der Kasten passt", schmalKasten);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);
  const breit = await page.evaluate(() => {
    /* Neugestaltung 28.09. (Aufgabe 4, Luecken 3.7 und DECISION 3.10, Entwurf r11-rotation-dunkel): der
       Kasten Automatisch buendig unter der Leiste, das Feld Einsaetze darunter ueber die volle Breite der
       Karte - vorher stand Gedrueckt links neben der Leiste. */
    const ged = document.querySelector(".drteilged").getBoundingClientRect(), auto = document.querySelector("#drAutoKasten").getBoundingClientRect();
    /* Folgt Aufgabe 10 (Nachtrag 29.09.): zwischen Leiste und Kasten steht jetzt der Zeitverlauf, und die
       Leiste teilt mit ihm ein Raster mit Namensspalte (#zvRaster). Gleich streng: der Kasten unter Leiste und
       Zeitverlauf, buendig mit ihrem Raster. */
    const bu = document.querySelector("#deineRotScroll").getBoundingClientRect(), k = document.querySelector("#deineRot").getBoundingClientRect();
    const zv = document.querySelector("#stackScroll").getBoundingClientRect(), raster = document.querySelector("#zvRaster").getBoundingClientRect();
    return { gedUnter: ged.top >= auto.bottom - 1 && Math.abs(ged.left - k.left) < 1 && Math.abs(ged.right - k.right) < 1,
      autoUnter: auto.top >= bu.bottom - 1 && auto.top >= zv.bottom - 1 && Math.abs(auto.left - raster.left) < 1 };
  });
  assert(breit.gedUnter && breit.autoUnter, "breit: Automatisch buendig unter Leiste und Zeitverlauf, Einsaetze darunter ueber die volle Breite", breit);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => document.querySelector('#themeRow [data-theme="dark"]').click());
  await page.waitForTimeout(200);

  // 10 · Deutsch
  await page.evaluate(() => document.querySelector("#btnLang").click());
  await page.waitForTimeout(200);
  s = await stand(page);
  const de = await page.evaluate(() => document.querySelector("#deineRot").textContent);
  assert(/in der Reihenfolge des Kampfes – ohne Tödliche Viper, die von selbst Schaden macht\./.test(s.lead), "Deutsch: der Satz", s.lead);
  assert(s.kasten.label === "Automatisch, 1 ausgeblendet, 1 neu" && /^Automatisch · 1 ausgeblendet/.test(s.kasten.kopf) && s.kasten.neu === "1 neu" &&
    s.autoText.includes("Diese Skills machen Schaden von selbst; sie stehen nicht in der Leiste, nur als Punkte unter ihr."),
    "Deutsch: der Kopf des Kastens und der Satz darunter", { kasten: s.kasten, auto: s.autoText });
  // Neugestaltung 28.09. (Aufgabe 4, Luecken 3.7): statt der Spalte "Gedrueckt" das Feld "Einsaetze"
  assert(de.includes("Deine Rotation") && de.includes("Eins\u00e4tze") && de.includes("Treffer je Einsatz") &&
    de.includes("Steht als Passiv – Borometer kennt sie so.") && !/\bBau(e|s|en)?\b/.test(de), "Deutsch: Texte, Build statt Bau", de.slice(0, 400));
  await page.evaluate(() => document.querySelector("#btnLang").click());
  await page.waitForTimeout(150);

  // 11 · Kurve eines Gruppenmitglieds: Vorschlaege ohne Knoepfe
  await page.evaluate(() => { const b = document.querySelector("#miFakeParty"); b.hidden = false; b.click(); });
  await page.waitForTimeout(300);
  await tab("rotation");
  await page.evaluate(() => document.querySelector("#rotWho [data-wer]:not([data-wer=''])")?.click());
  await page.waitForTimeout(300);
  s = await stand(page);
  assert(!s.hidden && s.autoText.includes("Confirming works on your own fights.") && s.auto.every((a) => !a.knoepfe.length) &&
    s.gedZeilen.every((z) => !z.knoepfe.length), "Gruppenmitglied: keine Knoepfe, der Satz sagt warum", s.autoText);
  assert(!errors.length, "keine Fehler in der Seite", errors);
  await page.close();

  // 12 · Stille: erzeugtes Log, Schnellfeuer und Strafing im Wechsel, 9,5-14,3 s keins; Deadly Viper laeuft
  //      durch - sie ist automatisch und fuellt die Stille nicht
  const log = join(work, "stille.txt");
  writeFileSync(log, stilleLog());
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors2 = [];
  p2.on("pageerror", (e) => errors2.push(String(e)));
  await p2.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ } });
  await p2.goto("file://" + join(root, "dist", "renderer", "index.html"));
  await p2.setInputFiles("#fileInput", log);
  await p2.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
  await p2.evaluate(() => document.querySelector('[data-tab="rotation"]').click());
  await p2.waitForTimeout(200);
  const still = await p2.evaluate(() => [...document.querySelectorAll("#rotBar .drstill")].map((x) => ({ text: x.textContent, w: parseFloat(x.style.width) })));
  /* Neugestaltung 28.09. (Aufgabe 4, Luecken 3.4/3.5, Entwurf E:463): die Marke traegt nur die Dauer in
     Zehnteln, "4.8 s"; was Stille ist, sagt einmal der Satz ueber der Leiste - vorher "4.8 s idle" */
  const stillSatz = await p2.evaluate(() => document.querySelector("#deineRotLead").textContent);
  assert(still.length === 1 && still[0].text === "4.8\u00a0s" && still[0].w >= 40 && /idle time: at least 2\u00a0s without a pressed cast/.test(stillSatz),
    "Stille: vom Ende des letzten gedrueckten Einsatzes bis zum naechsten, mit Dauer; der Satz sagt, was Stille ist", { still, stillSatz });
  const s2 = await stand(p2);
  assert(s2.keys.length === 2 && !s2.keys.includes("Deadly Viper") && s2.punkte > 20, "erzeugtes Log: Viper nur als Punkte", s2);
  assert(!errors2.length, "Stille: keine Fehler in der Seite", errors2);
  await p2.close();

  /* 12b \u00b7 aus test-trainer-page.mjs, Neugestaltung 28.09. (Nr. 5b', 10, 11):
     der Trainer entfaellt (Spezifikation 3); was dort ueber "Deine Rotation"
     geprueft wurde, bleibt hier. Vier Faehigkeiten im Wechsel, alle 0,5 s ein
     Einsatz, zwei Pulls an Vulcanus (Issue #29: im ersten Schnellfeuer alle
     1,75 s, im zweiten ab 20 s keins). */
  {
    const VIER = [["Detonation Mark", 953174691], QF, ST, ["Decisive Sniping", 964581976]];
    const vierLog = (pulls, extra = () => []) => {
      const rows = [];
      for (const p of pulls) {
        for (let k = 0; k * 500 < p.secs * 1000; k++) {
          const i = k % 4, t = p.aendern ? p.aendern(i, k * 500) : k * 500;
          if (t == null) continue;
          rows.push([p.start + t, `,DamageDone,${VIER[i][0]},${VIER[i][1]},${Math.round(1000 * p.scale * (1 + (k % 5)))},0,0,kNormalHit,Tester,${p.target}`]);
        }
        for (const [t, [n, id], d] of extra(p)) rows.push([p.start + t, `,DamageDone,${n},${id},${Math.round(d * p.scale)},0,0,kNormalHit,Tester,${p.target}`]);
      }
      rows.sort((a, b) => a[0] - b[0]);
      return ["CombatLogVersion,4", ...rows.map(([t, r]) => stamp(t) + r)].join("\n") + "\n";
    };
    const seite = async () => {
      const pg = await browser.newPage({ viewport: { width: 1280, height: 860 } });
      const err = [];
      pg.on("pageerror", (e) => err.push(String(e)));
      await pg.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ } });
      await pg.goto("file://" + join(root, "dist", "renderer", "index.html"));
      const laden = async (f, name) => {
        await pg.setInputFiles("#fileInput", f);
        await pg.waitForFunction((n) => (document.querySelector("#hName")?.textContent || "").includes(n), name);
        await pg.waitForTimeout(150);
        await pg.evaluate(() => document.querySelector('[data-tab="rotation"]').click());
        await pg.waitForTimeout(150);
      };
      return { pg, err, laden };
    };
    // 5b' \u00b7 bei 560 px, Englisch und Deutsch: jeder Knopf in Gedrueckt traegt den vollen Namen, die Seite rollt nicht waagerecht
    const V = (min, scale, aendern) => ({ target: "Vulcanus", start: Date.UTC(2026, 8, 21, 21, min, 0), secs: 80, scale, aendern });
    const B3 = join(work, "boss-3.txt");
    writeFileSync(B3, vierLog([V(50, 1.3, (i, t) => i === 1 ? 500 + (t - 500) / 2000 * 1750 : t), V(60, 1.0, (i, t) => i === 1 && t >= 20000 ? null : t)]));
    const b = await seite();
    await b.laden(B3, "Vulcanus");
    for (const lang of ["en", "de"]) {
      if (lang === "de") { await b.pg.evaluate(() => document.querySelector("#btnLang").click()); await b.pg.waitForTimeout(150); }
      await b.pg.setViewportSize({ width: 560, height: 860 });
      await b.pg.waitForTimeout(300);
      assert(await b.pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `Boss 3, 560 (${lang}): kein waagerechtes Rollen`, await b.pg.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]));
      /* Fixrunde 1 zu Aufgabe 4, folgt Entwurf (src.js rotation, .auge): der Knopf ist nur das Auge, der
         Name steht daneben in der Zeile; Name im title und im Namen des Knopfs wie vorher */
      const knoepfe = await b.pg.evaluate(() => [...document.querySelectorAll("#drGed .rotgz")].map((x) => ({
        name: x.closest(".drzeile").querySelector("em").textContent, title: x.title })));
      assert(knoepfe.length === 4 && knoepfe.every((x) => x.name && x.title.startsWith(x.name + " \u2014 ")),
        `Boss 3, 560 (${lang}): in Gedrueckt steht jeder Name ganz im title, mit dem, was ein Klick tut`, knoepfe);
      for (const x of knoepfe)
        assert(await b.pg.locator("#drGed").getByRole("button", { name: x.name }).count() >= 1,
          `Boss 3, 560 (${lang}): Knopf mit vollem Namen ${x.name}`);
      await b.pg.setViewportSize({ width: 1280, height: 860 });
      await b.pg.waitForTimeout(300);
    }
    assert(!b.err.length, "Boss 3: keine Fehler in der Seite", b.err);
    await b.pg.close();

    /* 10 \u00b7 was die Leiste als automatisch weglaesst: Deadly Viper (Passiv)
       jede Sekunde, im zweiten Versuch hoert sie nach 10 s auf - sie steht
       unter Automatisch, nicht in der Leiste und nicht in Gedrueckt. */
    const P = (min, scale) => ({ target: "Practice Dummy", start: Date.UTC(2026, 8, 23, 20, min, 0), secs: 62, scale });
    const viper = (bis) => (p) => { const z = []; for (let t = 250; t < bis; t += 1000) z.push([t, DV, 300]); return z; };
    const V1 = join(work, "viper-1.txt"), V2 = join(work, "viper-2.txt");
    writeFileSync(V1, vierLog([P(0, 1.3)], viper(62000)));
    writeFileSync(V2, vierLog([P(5, 1.0)], viper(10000)));
    const v = await seite();
    await v.laden(V1, "Practice Dummy");
    await v.laden(V2, "Practice Dummy");
    const sv = await stand(v.pg);
    assert(sv.auto.some((a) => a.k === "Deadly Viper") && !sv.keys.includes("Deadly Viper") && !sv.ged.some((g) => g.k === "Deadly Viper"),
      "Deadly Viper: unter Automatisch, weder in der Leiste noch in Gedrueckt", sv);
    assert(!v.err.length, "Viper: keine Fehler in der Seite", v.err);
    await v.pg.close();

    /* 11 \u00b7 "Immer weglassen" fuer Arrow Vortex am ersten Versuch (dort
       selten dabei); im naechsten Versuch fehlt Arrow Vortex ganz - die Wahl
       bleibt in der Sitzung, nichts nennt Arrow Vortex in der Leiste. */
    const mitAV = (p) => { const z = []; for (let t = 250; t < 62000; t += 2000) z.push([t, AV, 200]); return z; };
    const A1 = join(work, "av-1.txt"), A2 = join(work, "av-2.txt");
    writeFileSync(A1, vierLog([{ ...P(0, 1.3), start: Date.UTC(2026, 8, 24, 20, 0, 0) }], mitAV));
    writeFileSync(A2, vierLog([{ ...P(5, 1.0), start: Date.UTC(2026, 8, 24, 20, 5, 0) }]));
    const w = await seite();
    await w.laden(A1, "Practice Dummy");
    await w.pg.evaluate(() => [...document.querySelectorAll("#drGed .rotgz")].find((x) => x.dataset.k === "Arrow Vortex").click());
    await w.pg.waitForTimeout(100);
    await w.pg.evaluate(() => [...document.querySelectorAll("#deineRot [data-wahl]")].find((x) => x.dataset.k === "Arrow Vortex" && x.dataset.wahl === "1").click());
    await w.pg.waitForTimeout(100);
    const sa = await stand(w.pg);
    assert(sa.auto.some((a) => a.k === "Arrow Vortex" && a.status === "left out") && !sa.keys.includes("Arrow Vortex"),
      "Arrow Vortex: Immer weglassen, unter Automatisch", sa.auto);
    await w.laden(A2, "Practice Dummy");
    const sw = await stand(w.pg);
    assert(!sw.keys.includes("Arrow Vortex") && !sw.ged.some((g) => g.k === "Arrow Vortex") && !/Arrow Vortex/.test(sw.lead),
      "Arrow Vortex: im naechsten Versuch ohne Arrow Vortex nennt die Leiste es nicht", sw);
    assert(!w.err.length, "Arrow Vortex: keine Fehler in der Seite", w.err);
    await w.pg.close();
  }

  // 13 · Waehlen (Beispiel, ohne Build: in der Sitzung): Druecke ich selbst, Rueckgaengig, Stimmt, Zurueck, Immer weglassen
  for (const reduziert of [false, true]) {
    const p3 = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: reduziert ? "reduce" : "no-preference" });
    const errors3 = [];
    p3.on("pageerror", (e) => errors3.push(String(e)));
    await p3.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ } });
    await p3.goto("file://" + join(root, "dist", "renderer", "index.html"));
    await p3.evaluate(() => document.querySelector("#btnSample").click());
    await p3.waitForFunction(() => !document.querySelector("#app").hidden);
    await p3.evaluate(() => document.querySelector('[data-tab="rotation"]').click());
    await p3.waitForTimeout(200);
    const wahl = (k, v) => p3.evaluate(([k, v]) => {
      const b = [...document.querySelectorAll("#deineRot [data-wahl]")].find((x) => x.dataset.k === k && x.dataset.wahl === v);
      if (!b) return null;
      b.click();
      // FLIP laeuft im selben Zug: was rutscht, traegt jetzt .flip
      return document.querySelectorAll("#rotBar .drsym.flip").length;
    }, [k, v]);
    const fokus = () => p3.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.k || "") + ":" + (a.dataset.wahl ?? a.className) : ""; });
    const vorher = await stand(p3);
    const vk = vorher.auto.find((a) => a.k === "Deadly Viper");
    if (!reduziert) assert(!!vk && vk.knoepfe.join("|") === "1:That's right: Deadly Viper deals damage on its own|2:I press Deadly Viper myself",
      "vorgeschlagen: Stimmt und Druecke ich selbst, mit der Faehigkeit im Namen", vk);
    if (!reduziert) {
      /* die Hilfe verspricht: die Knoepfe einer Wahl mit Tab. Neugestaltung 28.09. (Aufgabe 4, DECISION
         3.10): der Kasten Automatisch steht unter der Leiste und vor den Einsaetzen - der Weg mit Tab
         beginnt an der Leiste, nicht mehr in der Spalte Gedrueckt */
      await p3.focus("#deineRotScroll");
      const weg = [];
      // folgt Aufgabe 10: zwischen Leiste und Kasten stehen jetzt der Zeitverlauf und seine Bedienung (Spuren, Zoom, Von/bis, Massstab, Glaettung, Hilfe)
      for (let i = 0; i < 24 && !(await p3.evaluate(() => !!document.activeElement?.dataset?.wahl)); i++) {
        await p3.keyboard.press("Tab");
        weg.push(await p3.evaluate(() => document.activeElement?.className || document.activeElement?.tagName));
      }
      const hilfe = await p3.evaluate(() => document.querySelector('[data-i18n="help.rotLanes"]').textContent);
      const zuStimmt = await p3.evaluate(() => document.activeElement?.dataset?.wahl === "1");
      // und die Einsaetze bleiben ein Tab-Halt mit Pfeiltasten (wie vorher Gedrueckt)
      await p3.focus("#drGed .rotgz[tabindex='0']");
      const tabHalte = await p3.evaluate(() => [...document.querySelectorAll("#drGed .rotgz")].filter((b) => b.tabIndex === 0).length);
      await p3.keyboard.press("ArrowDown");
      const pfeil = await p3.evaluate(() => document.activeElement?.matches("#drGed .rotgz") && document.activeElement.tabIndex === 0);
      assert(zuStimmt && /reached with Tab/.test(hilfe) && tabHalte === 1 && pfeil,
        "Tastatur: von der Leiste mit Tab zu Stimmt, wie die Hilfe sagt; die Einsaetze ein Tab-Halt mit Pfeiltasten", { weg, hilfe, tabHalte, pfeil });
    }
    const rutscht = await wahl("Deadly Viper", "2");
    await p3.waitForTimeout(150);
    let s3 = await stand(p3);
    if (!reduziert) {
      assert(rutscht > 0, "FLIP: beim Hinzunehmen rutschen Symbole in ihre neue Etage", rutscht);
      /* Neugestaltung 28.09. (Aufgabe 4, Luecken 3.4): hinten steht jetzt immer der Satz zur Stille ("... at
         least 2 s without a pressed cast ..."); geprueft wird der Satz davor, so streng wie vorher */
      const ohneStille = (l) => l.replace(/ The fields in the band are idle time: .*$/, "");
      assert(s3.keys.includes("Deadly Viper") && s3.punkte === 0 && !s3.auto.length && !/without/.test(ohneStille(s3.lead)) && /idle time/.test(s3.lead),
        "Druecke ich selbst: Deadly Viper sofort in der Leiste, keine Punkte, der Satz nennt nichts mehr", { keys: s3.keys, punkte: s3.punkte, lead: s3.lead });
      /* Neugestaltung 28.09. (Aufgabe 4, DECISION 3.9/3.10): "von dir" und Zuruecknehmen stehen im Kasten
         Automatisch, die Zeile in den Einsaetzen traegt keine Knoepfe mehr - vorher in der Spalte Gedrueckt */
      const zw = await p3.evaluate(() => [...document.querySelectorAll("#drAutoKasten .drwahlen li")].map((l) => ({ k: l.dataset.sk, text: l.textContent,
        knoepfe: [...l.querySelectorAll("[data-wahl]")].map((b) => b.dataset.wahl + ":" + (b.getAttribute("aria-label") || "")) })));
      const z = zw.find((g) => g.k === "Deadly Viper");
      assert(!!z && z.text.includes("by you: you press it") && z.knoepfe.join("|") === "0:Take back the choice for Deadly Viper" &&
        s3.gedZeilen.some((g) => g.k === "Deadly Viper") && s3.gedZeilen.every((g) => !g.knoepfe.length),
        "Automatisch: die Zeile sagt von dir, mit Zuruecknehmen; Deadly Viper steht in den Einsaetzen", { z, ged: s3.gedZeilen.map((g) => g.k) });
      assert(await fokus() === "Deadly Viper:0", "der Fokus steht auf Zuruecknehmen", await fokus());
      assert(!(await p3.evaluate(() => document.querySelector("#rotBar").classList.contains("hebt"))),
        "der Fokus auf einem Knopf der Wahl hebt nichts hervor (nur ein Name tut das)");
      const toast = await p3.evaluate(() => ({ text: document.querySelector("#toast").textContent, undo: !!document.querySelector("#toast.on .tact") }));
      assert(toast.undo && toast.text.startsWith("Deadly Viper is back in the bar."), "Hinweis mit Rueckgaengig", toast);
      await p3.evaluate(() => document.querySelector("#toast .tact").click());
      await p3.waitForTimeout(150);
      s3 = await stand(p3);
      assert(!s3.keys.includes("Deadly Viper") && s3.auto.find((a) => a.k === "Deadly Viper")?.knoepfe.length === 2,
        "Rueckgaengig: wieder vorgeschlagen", s3.auto);
      await wahl("Deadly Viper", "1");
      await p3.waitForTimeout(150);
      s3 = await stand(p3);
      const a = s3.auto.find((x) => x.k === "Deadly Viper");
      assert(!!a && a.status === "confirmed" && a.fest === "Confirmed for this session" && a.knoepfe.join("|") === "0:Take back the choice for Deadly Viper" &&
        !s3.keys.includes("Deadly Viper"), "Stimmt: bestaetigt (ohne Build fuer die Sitzung), weiter draussen", a);
      assert(await fokus() === "Deadly Viper:0", "Stimmt: der Fokus steht auf Zuruecknehmen", await fokus());
      await wahl("Deadly Viper", "0");
      await p3.waitForTimeout(150);
      s3 = await stand(p3);
      assert(s3.auto.find((x) => x.k === "Deadly Viper")?.knoepfe.length === 2 && await fokus() === "Deadly Viper:1",
        "Zuruecknehmen: wieder wie vorgeschlagen, Fokus auf Stimmt", s3.auto);
      // Immer weglassen: erst in Gedrueckt ausschalten, dann dauerhaft
      await p3.evaluate(() => document.querySelector('#drGed .rotgz[data-k="Basic Shot"]').click());
      await p3.waitForTimeout(120);
      s3 = await stand(p3);
      /* Neugestaltung 28.09. (Aufgabe 4, DECISION 3.9): "Immer weglassen" steht im Kasten Automatisch - das
         Auge gilt der Sitzung, die Wahl dem Build; vorher in der Zeile unter Gedrueckt */
      const bw = await p3.evaluate(() => [...document.querySelectorAll("#drAutoKasten .drwahlen li")].map((l) => ({ k: l.dataset.sk, text: l.textContent,
        knoepfe: [...l.querySelectorAll("[data-wahl]")].map((b) => b.dataset.wahl + ":" + (b.getAttribute("aria-label") || "")) })));
      const bz = bw.find((g) => g.k === "Basic Shot");
      assert(!!bz && bz.knoepfe.join("|") === "1:Always leave Basic Shot out" && bz.text.includes("Hidden in this fight only") &&
        s3.ged.find((g) => g.k === "Basic Shot")?.an === "false", "ausgeschaltet: Immer weglassen im Kasten Automatisch", { bz, bw });
      await wahl("Basic Shot", "1");
      await p3.waitForTimeout(150);
      s3 = await stand(p3);
      const ba = s3.auto.find((x) => x.k === "Basic Shot");
      assert(!!ba && ba.text.includes("Left out by you.") && ba.status === "left out" && ba.fest === "Left out for this session" && !s3.ged.some((g) => g.k === "Basic Shot") && !s3.keys.includes("Basic Shot"),
        "Immer weglassen: unter Automatisch, von dir", ba);
      assert(/without Basic Shot and Deadly Viper, which deal damage on their own\./.test(s3.lead), "der Satz nennt beide, in der Reihenfolge der Spuren", s3.lead);
      await wahl("Basic Shot", "0");
      await p3.waitForTimeout(150);
      s3 = await stand(p3);
      assert(s3.keys.includes("Basic Shot") && s3.ged.find((g) => g.k === "Basic Shot")?.an === "true",
        "Zuruecknehmen: Basic Shot wieder in der Leiste", s3.ged.find((g) => g.k === "Basic Shot"));
    } else {
      assert(rutscht === 0 && s3.keys.includes("Deadly Viper"), "reduzierte Bewegung: nichts rutscht, die Wahl gilt trotzdem", rutscht);
      const pfeil = await p3.evaluate(() => getComputedStyle(document.querySelector("#drAutoKasten > summary"), "::after").transitionDuration);
      assert(pfeil === "0s", "reduzierte Bewegung: der Pfeil des Kastens dreht sich ohne Uebergang", pfeil);
    }
    assert(!errors3.length, `Waehlen${reduziert ? " (reduziert)" : ""}: keine Fehler in der Seite`, errors3);
    await p3.close();
  }

  // 14 · mit dem Helfer: die Wahl bleibt in der Sitzung. Der Builds-Reiter ist entfallen (#207): nichts geht an einen Build,
  // /api/builds und /api/plans werden nie gefragt (posts sammelt jeden Versuch)
  const logA = join(work, "bau-a.txt"), logB = join(work, "bau-b.txt");
  const vortex = Array.from({ length: 10 }, (_, i) => [15000 + i * 1500 + 250, AV]);
  writeFileSync(logA, stilleLog(Date.UTC(2026, 8, 20, 21, 0, 0), vortex));
  writeFileSync(logB, stilleLog(Date.UTC(2026, 8, 20, 21, 10, 0), vortex));
  const helfer = async () => {
    const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const err = [];
    pg.on("pageerror", (e) => err.push(String(e)));
    await pg.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ } });
    const posts = [];
    await pg.route("http://boro.test/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (/^\/api\/(builds|plans)/.test(path)) posts.push(path);
      if (path.startsWith("/api/")) return json(200, {});
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    });
    await pg.goto("http://boro.test/index.html");
    return { pg, err, posts };
  };
  const laden = async (pg, file) => {
    await pg.setInputFiles("#fileInput", file);
    await pg.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
    await pg.waitForTimeout(300);
    await pg.evaluate(() => document.querySelector('[data-tab="rotation"]').click());
    await pg.waitForTimeout(200);
  };
  const klick = (pg, k, v) => pg.evaluate(([k, v]) => [...document.querySelectorAll("#deineRot [data-wahl]")]
    .find((x) => x.dataset.k === k && x.dataset.wahl === v)?.click(), [k, v]);
  const warte = async (pg, bis) => { for (const end = Date.now() + 15000; Date.now() < end && !bis(); ) await pg.waitForTimeout(100); };

  // eine Wahl bleibt in der Sitzung: Stimmt, ein Kampf mit demselben Paar, Zuruecknehmen, Rueckgaengig; nichts wird geschrieben
  const A = await helfer();
  await laden(A.pg, logA);
  let sA = await stand(A.pg);
  assert(sA.autoText.includes("Applies to this session"), "Helfer: die Wahl gilt in der Sitzung, kein Build", sA.autoText);
  await klick(A.pg, "Deadly Viper", "1");
  await A.pg.waitForTimeout(300);
  sA = await stand(A.pg);
  assert(sA.auto.find((x) => x.k === "Deadly Viper")?.fest === "Confirmed for this session", "Stimmt: bestaetigt fuer diese Sitzung", sA.auto);
  await laden(A.pg, logB);
  sA = await stand(A.pg);
  assert(!sA.keys.includes("Deadly Viper") && sA.auto.find((x) => x.k === "Deadly Viper")?.fest === "Confirmed for this session",
    "ein neuer Kampf mit demselben Paar: weiter draussen und bestaetigt", sA.auto);
  await klick(A.pg, "Deadly Viper", "0");
  await A.pg.waitForTimeout(300);
  sA = await stand(A.pg);
  assert(sA.auto.find((x) => x.k === "Deadly Viper")?.status === "" , "Zuruecknehmen: wieder nur vorgeschlagen", sA.auto);
  await A.pg.evaluate(() => document.querySelector("#toast .tact")?.click());
  await A.pg.waitForTimeout(300);
  sA = await stand(A.pg);
  assert(sA.auto.find((x) => x.k === "Deadly Viper")?.fest === "Confirmed for this session", "Rueckgaengig: der Wert davor", sA.auto);
  await A.pg.waitForTimeout(800);
  assert(!A.posts.length, "nichts wird an einen Build geschrieben, /api/builds und /api/plans werden nie gefragt", A.posts);
  assert(!A.err.length, "Helfer: keine Fehler in der Seite", A.err);
  await A.pg.close();

  /* Issue #52: der Kasten "Automatisch" zu oder offen. Ein ungepruefter Vorschlag, der vorher nicht da war, oeffnet
     ihn; Enter auf dem Kopf schaltet um; Neuzeichnen setzt weder den Zustand noch den Fokus zurueck. Ein schon
     gesehener Vorschlag oeffnet ihn nicht wieder (gesehen gilt seit #207 je Faehigkeit in der Sitzung, nicht je Build). */
  const logKD = join(work, "kasten-dolch.txt"), logKC = join(work, "kasten-drei.txt");
  writeFileSync(logKD, stilleLog(Date.UTC(2026, 8, 21, 22, 0, 0), [], [FS, VS]));
  writeFileSync(logKC, stilleLog(Date.UTC(2026, 8, 21, 23, 0, 0), [], [QF, FS]));
  const K = await helfer();
  await laden(K.pg, logA);
  let sK = await stand(K.pg);
  assert(sK.kasten.da && sK.kasten.offen && sK.kasten.neu === "1 new" && sK.kasten.label === "Automatic, 1 left out, 1 new",
    "ein neuer Vorschlag: der Kasten oeffnet von selbst, der Kopf nennt 1 new", sK.kasten);
  await K.pg.focus("#drAutoKasten > summary");
  await K.pg.keyboard.press("Enter");
  await K.pg.waitForTimeout(80);
  assert(!(await stand(K.pg)).kasten.offen, "Enter auf dem Kopf: zu");
  const kopfHoch = await K.pg.evaluate(() => Math.round(document.querySelector("#drAutoKasten").getBoundingClientRect().height));
  assert(kopfHoch >= 30 && kopfHoch <= 44, "zugeklappt etwa 38 px hoch", kopfHoch);
  assert(sK.autoText.includes("Applies to this session"), "der Satz nennt die Sitzung", sK.autoText);
  await K.pg.keyboard.press(" ");
  await K.pg.waitForTimeout(80);
  assert((await stand(K.pg)).kasten.offen, "Leertaste auf dem Kopf: wieder offen");
  // Neuzeichnen (Sprache hin und zurueck baut den Kopf neu): offen bleibt offen, der Fokus bleibt auf dem Kopf
  await K.pg.evaluate(() => { document.querySelector("#btnLang").click(); document.querySelector("#btnLang").click(); });
  await K.pg.waitForTimeout(150);
  await K.pg.evaluate(() => { document.querySelector('[data-tab="timeline"]').click(); document.querySelector('[data-tab="rotation"]').click(); });
  await K.pg.waitForTimeout(150);
  sK = await stand(K.pg);
  assert(sK.kasten.offen && await K.pg.evaluate(() => document.activeElement === document.querySelector("#drAutoKasten > summary")),
    "Neuzeichnen: der Kasten bleibt offen, der Fokus auf dem Kopf", sK.kasten);
  // Tastatur: vom Kopf mit Tab zu Stimmt; der Fokus geht auf Zuruecknehmen, der Kasten bleibt offen, 1 new ist weg
  await K.pg.focus("#drAutoKasten > summary");
  await K.pg.keyboard.press("Tab");
  assert(await K.pg.evaluate(() => document.activeElement?.dataset?.wahl === "1"), "Tab vom Kopf: Stimmt");
  await K.pg.keyboard.press("Enter");
  await K.pg.waitForTimeout(200);
  sK = await stand(K.pg);
  assert(sK.kasten.offen && !sK.kasten.neu && await K.pg.evaluate(() => document.activeElement?.dataset?.wahl === "0"),
    "Stimmt mit der Tastatur: bestaetigt, Kasten offen, Fokus auf Zuruecknehmen", sK.kasten);
  // Zuruecknehmen: wieder vorgeschlagen, aber schon gesehen - der Handzustand zaehlt weiter
  await K.pg.keyboard.press("Enter");
  await K.pg.waitForTimeout(200);
  sK = await stand(K.pg);
  assert(sK.kasten.offen && sK.kasten.neu === "1 new" && await K.pg.evaluate(() => document.activeElement?.dataset?.wahl === "1"),
    "Zuruecknehmen: wieder 1 new, Fokus auf Stimmt", sK.kasten);
  await K.pg.focus("#drAutoKasten > summary");
  await K.pg.keyboard.press("Enter");
  await K.pg.waitForTimeout(80);
  await laden(K.pg, logA);
  await laden(K.pg, logKD);
  sK = await stand(K.pg);
  assert(!sK.kasten.offen && sK.kasten.neu === "1 new", "von Hand zu, der Vorschlag schon gesehen: der Kasten bleibt zu", sK.kasten);
  // von Hand weggelassen: der title sagt es und dass es in der Sitzung gilt
  await laden(K.pg, logKC);
  await K.pg.evaluate(() => document.querySelector('#drGed .rotgz[data-k="Quick Fire"]').click());
  await K.pg.waitForTimeout(120);
  await klick(K.pg, "Quick Fire", "1");
  await K.pg.waitForTimeout(300);
  sK = await stand(K.pg);
  const qf = sK.auto.find((x) => x.k === "Quick Fire");
  assert(!!qf && qf.status === "left out" && qf.fest === "Left out for this session", "Immer weglassen: ausgeblendet, title Left out for this session", qf);
  await laden(K.pg, logKD);
  // Druecke ich selbst: wirkt wie bisher, auch aus dem Kasten heraus
  await klick(K.pg, "Deadly Viper", "2");
  await K.pg.waitForTimeout(200);
  sK = await stand(K.pg);
  assert(sK.keys.includes("Deadly Viper") && !sK.auto.some((x) => x.k === "Deadly Viper"), "Druecke ich selbst: Deadly Viper in der Leiste", sK.keys);
  assert(!K.err.length, "Kasten: keine Fehler in der Seite", K.err);
  await K.pg.close();

  /* 15 · zwei Kaempfe ohne Build, verschiedene Paare (Review #44): eine Wahl der Sitzung, getroffen am Kampf
     mit dem Bogen, gilt nicht im Kampf mit dem Dolch und landet nirgends. */
  const logD = join(work, "bau-dolch.txt");
  writeFileSync(logD, stilleLog(Date.UTC(2026, 8, 21, 21, 0, 0), [], [FS, VS]));
  const Z = await helfer();
  await laden(Z.pg, logA);
  await klick(Z.pg, "Deadly Viper", "1");
  await Z.pg.waitForTimeout(200);
  await laden(Z.pg, logD);
  let sZ = await stand(Z.pg);
  assert(sZ.auto.find((x) => x.k === "Deadly Viper")?.knoepfe.length === 2 && !sZ.keys.includes("Deadly Viper"),
    "Kampf mit anderem Paar: die Wahl aus dem Kampf mit dem Bogen gilt hier nicht (Viper nur vorgeschlagen)", sZ.auto);
  await Z.pg.waitForTimeout(800);
  assert(!Z.posts.length, "nichts davon geht an /api/builds oder /api/plans", Z.posts);
  await laden(Z.pg, logA);
  sZ = await stand(Z.pg);
  assert(sZ.auto.find((x) => x.k === "Deadly Viper")?.fest === "Confirmed for this session",
    "zurueck beim Bogen: die Wahl der Sitzung gilt weiter", sZ.auto);
  assert(!Z.err.length, "zwei Paare: keine Fehler in der Seite", Z.err);
  await Z.pg.close();

  /* 19 · Abspielen (Stufe 2, Spezifikation 5.5): Bedienung, Kopf in --rot-kopf, "Jetzt" mit
     "danach", Tempo, Uhr, Kopf in der Leiste, Anhalten bei Reiterwechsel und verborgenem Fenster, eine Wahl
     haelt den Kopf bei seinem Einsatz, unter drei Einsaetzen keine Bedienung; reduzierte Bewegung. */
  const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
  const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const ueber = (fg, bg) => { const a = fg.length > 3 ? fg[3] : 1; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); };
  const sp = async (pg) => pg.evaluate(() => {
    const kopf = document.querySelector("#rotBar .drabkopf"), box = document.querySelector("#deineRotScroll");
    /* Neugestaltung 28.09.: der ganze Kampf auf der Breite - was in keine der drei Etagen passt, steht nur
       als Strich im Band; dann traegt der Strich die Marke des aktuellen Einsatzes */
    const jetzt = document.querySelector("#rotBar .drsym.jetzt") || document.querySelector("#rotBar .drstrich.jetzt");
    const war = document.querySelector("#rotBar .drsym.war");
    return {
      steuer: !document.querySelector("#drSteuer")?.hidden, jetztDa: !document.querySelector("#drJetzt")?.hidden,
      pressed: document.querySelector("#drPlay")?.getAttribute("aria-pressed"), title: document.querySelector("#drPlay")?.title,
      tempo: [...document.querySelectorAll("#drTempo button")].map((b) => b.getAttribute("aria-pressed")),
      uhr: document.querySelector("#drUhr")?.textContent || "", uhrHidden: document.querySelector("#drUhr")?.getAttribute("aria-hidden"),
      jetzt: document.querySelector("#drJetzt")?.textContent || "", danach: [...document.querySelectorAll("#drJetzt li")].map((l) => l.textContent),
      kopfX: kopf ? new DOMMatrix(getComputedStyle(kopf).transform).m41 : null,
      jetztW: jetzt ? Math.round(jetzt.getBoundingClientRect().width) : 0, jetztI: jetzt ? +jetzt.dataset.i : -1,
      war: document.querySelectorAll("#rotBar .drsym.war").length, warOp: war ? getComputedStyle(war).opacity : null,
      scroll: box.scrollLeft, cw: box.clientWidth, live: document.querySelector("#drLive")?.textContent ?? null,
    };
  });
  const uhrMs = (u) => { const m = /^(\d+):(\d\d)[.,](\d)$/.exec(u); return m ? (+m[1] * 60 + +m[2]) * 1000 + +m[3] * 100 : NaN; };
  for (const reduziert of [false, true]) {
    const p5 = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: reduziert ? "reduce" : "no-preference" });
    const errors5 = [];
    p5.on("pageerror", (e) => errors5.push(String(e)));
    await p5.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ } });
    await p5.goto("file://" + join(root, "dist", "renderer", "index.html"));
    await p5.evaluate(() => document.querySelector("#btnSample").click());
    await p5.waitForFunction(() => !document.querySelector("#app").hidden);
    await p5.evaluate(() => document.querySelector('[data-tab="rotation"]').click());
    await p5.waitForTimeout(250);
    const a0 = await sp(p5);
    const nAlle = +(/1 of (\d+) · at 0:0\d\.\d/.exec(a0.jetzt) || [])[1];
    if (!reduziert) {
      // Neugestaltung 28.09. (Aufgabe 4, DECISION 3.3): Tempo 1x 2x 4x statt 0,5x 1x 2x - 1x ist jetzt der erste
      assert(a0.steuer && a0.jetztDa && a0.pressed === "false" && /Play/.test(a0.title) && a0.tempo.join() === "true,false,false" &&
        /^0:0\d\.\d$/.test(a0.uhr) && a0.uhrHidden === "true", "Bedienung: Abspielen (aria-pressed), Tempo 1x gedrueckt, Uhr mit Zehnteln", a0);
      assert(/^Now/.test(a0.jetzt) && nAlle > 50 && a0.danach.length === 3 && a0.danach.every((d) => /\+\d+\.\d\u00a0s$/.test(d)),
        "Jetzt: Einsatz 1 von allen, danach drei mit Abstand", { jetzt: a0.jetzt, danach: a0.danach });
      assert(a0.jetztW === 40 && a0.jetztI === 0 && a0.war === 0 && a0.kopfX > 0, "vor dem Abspielen: Kopf und Rahmen auf Einsatz 1, 40 px, nichts blass", a0);
      // Gold als Auswahl in drei Themen: Kopf und Rahmen in --rot-kopf, gegen die Mulde mindestens 3:1
      for (const theme of ["dark", "light", "tnl"]) {
        await p5.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`).click(), theme);
        await p5.waitForTimeout(150);
        const f = await p5.evaluate(() => {
          const probe = document.createElement("i"); probe.style.color = "var(--rot-kopf)"; document.body.appendChild(probe);
          const soll = getComputedStyle(probe).color; probe.remove();
          const karte = getComputedStyle(document.querySelector("#deineRot"));
          const grund = karte.backgroundColor !== "rgba(0, 0, 0, 0)" ? karte.backgroundColor : (karte.backgroundImage.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i) || ["rgb(0,0,0)"])[0];
          return { soll, kopf: getComputedStyle(document.querySelector("#rotBar .drabkopf")).backgroundColor,
            rahmen: getComputedStyle(document.querySelector("#rotBar .drsym.jetzt")).boxShadow,
            well: getComputedStyle(document.querySelector("#rotBar .drband")).backgroundColor, grund };
        });
        const k = kontrast(rgb(f.kopf), ueber(rgb(f.well), rgb(f.grund)));
        assert(f.kopf === f.soll && f.rahmen.includes(f.soll) && k >= 3, `Thema ${theme}: Kopf und Rahmen in --rot-kopf, ${k.toFixed(2)}:1 gegen die Mulde`, f);
      }
      await p5.evaluate(() => document.querySelector('#themeRow [data-theme="dark"]').click());
    }
    // abspielen mit 2x
    await p5.evaluate(() => { document.querySelector('#drTempo [data-tempo="2"]').click(); document.querySelector("#drPlay").click(); });
    const b0 = await sp(p5);
    const zuege = [];
    for (let i = 0; i < 30; i++) { await p5.waitForTimeout(50); zuege.push((await sp(p5)).kopfX); }
    const b1 = await sp(p5);
    assert(b0.pressed === "true" && b1.pressed === "true" && /Pause/.test(b1.title) && b1.tempo.join() === "false,true,false",
      `Abspielen${reduziert ? " (reduziert)" : ""}: gedrueckt, 2x gewaehlt`, b1);
    assert(b1.kopfX > a0.kopfX && uhrMs(b1.uhr) > uhrMs(a0.uhr) && b1.jetztI > 0 && b1.war > 0 && b1.warOp === "0.45" && b1.jetzt !== a0.jetzt,
      `Abspielen${reduziert ? " (reduziert)" : ""}: Kopf, Uhr und Jetzt laufen, Vergangenes auf 45 %`, { a0, b1 });
    const striche = await p5.evaluate(() => [...document.querySelectorAll("#rotBar .drstrich")].map((s) => parseFloat(s.style.left) + 25));   // RAND 24 + halber Strich
    const anEinsatz = zuege.every((x) => striche.some((s) => Math.abs(s - x) < 0.2));
    if (reduziert) {
      const tr = await p5.evaluate(() => [getComputedStyle(document.querySelector("#rotBar .drsym")).transitionDuration,
        getComputedStyle(document.querySelector("#rotBar .drabkopf")).transitionDuration]);
      assert(anEinsatz && tr.every((d) => /^0s(, 0s)*$/.test(d)), "reduzierte Bewegung: der Kopf steht nur an Einsaetzen, kein Uebergang", { zuege: zuege.slice(0, 8), tr });
      // angehalten: Kopf und Uhr auf dem Einsatz, nicht dazwischen (Review Stufe 2)
      await p5.evaluate(() => document.querySelector("#drPlay").click());
      const h = await sp(p5);
      const bei = (/ · at (\d+:\d\d\.\d)/.exec(h.jetzt) || [])[1];
      assert(h.pressed === "false" && striche.some((x) => Math.abs(x - h.kopfX) < 0.2) && h.uhr === bei,
        "reduzierte Bewegung, angehalten: Kopf und Uhr stehen auf dem Einsatz", { kopfX: h.kopfX, uhr: h.uhr, bei });
    } else {
      assert(!anEinsatz && new Set(zuege).size > 10, "der Kopf gleitet mit der Kampfzeit", zuege.slice(0, 8));
      /* Tempo waehrend des Laufens. Neugestaltung 28.09. (Aufgabe 4, DECISION 3.3): 1x gegen 4x statt 0,5x
         gegen 2x - dasselbe Verhaeltnis 4, dieselbe Schwelle 2,5 */
      await p5.evaluate(() => document.querySelector('#drTempo [data-tempo="4"]').click());
      const u1 = uhrMs((await sp(p5)).uhr);
      await p5.waitForTimeout(1000);
      const u2 = uhrMs((await sp(p5)).uhr);
      await p5.evaluate(() => document.querySelector('#drTempo [data-tempo="1"]').click());
      const u3 = uhrMs((await sp(p5)).uhr);
      await p5.waitForTimeout(1000);
      const u4 = uhrMs((await sp(p5)).uhr);
      assert((u2 - u1) > 2.5 * (u4 - u3) && u4 > u3, "Tempo 1x waehrend des Laufens: langsamer als 4x", { vier: u2 - u1, eins: u4 - u3 });
      /* Neugestaltung 28.09.: das Mitrollen entfaellt (Spezifikation 3) - die Leiste zeigt den ganzen
         Kampf und rollt nicht; der Kopf bleibt in ihr sichtbar */
      await p5.evaluate(() => document.querySelector('#drTempo [data-tempo="2"]').click());
      await p5.waitForTimeout(600);
      const r = await sp(p5);
      assert(r.scroll === 0 && r.kopfX > 0 && r.kopfX < r.cw, "die Leiste rollt nicht, der Kopf bleibt in ihr sichtbar", r);
      // Reiterwechsel haelt an
      await p5.evaluate(() => document.querySelector('[data-tab="timeline"]').click());
      await p5.waitForTimeout(150);
      await p5.evaluate(() => document.querySelector('[data-tab="rotation"]').click());
      await p5.waitForTimeout(150);
      const c1 = await sp(p5);
      await p5.waitForTimeout(300);
      const c2 = await sp(p5);
      assert(c1.pressed === "false" && c1.uhr === c2.uhr && c1.kopfX === c2.kopfX, "Reiterwechsel haelt an, der Kopf bleibt stehen", { c1, c2 });
      // verborgenes Fenster haelt an
      await p5.evaluate(() => document.querySelector("#drPlay").click());
      await p5.waitForTimeout(200);
      await p5.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
      await p5.waitForTimeout(100);
      const d1 = await sp(p5);
      await p5.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); });
      assert(d1.pressed === "false", "document.hidden haelt an", d1);
      // eine Wahl (Neubau): angehalten bleibt der Kopf bei seinem Einsatz, laufend laeuft er weiter
      const e0 = await sp(p5);
      const bei = (j) => (/ · at (\d+:\d\d\.\d)/.exec(j) || [])[1];
      const wer = (j) => (/^Now(.*?)\d+ of/.exec(j) || [])[1];
      await p5.evaluate(() => [...document.querySelectorAll("#deineRot [data-wahl]")].find((x) => x.dataset.k === "Deadly Viper" && x.dataset.wahl === "2").click());
      await p5.waitForTimeout(200);
      const e1 = await sp(p5);
      const n1 = +(/ of (\d+) · at/.exec(e1.jetzt) || [])[1];
      assert(e1.pressed === "false" && bei(e1.jetzt) === bei(e0.jetzt) && wer(e1.jetzt) === wer(e0.jetzt) && n1 > nAlle,
        "eine Wahl baut neu: der Kopf bleibt bei seinem Einsatz", { vor: e0.jetzt, nach: e1.jetzt });
      await p5.evaluate(() => document.querySelector("#drPlay").click());
      await p5.evaluate(() => document.querySelector("#toast .tact")?.click());
      await p5.waitForTimeout(250);
      const e2 = await sp(p5);
      assert(e2.pressed === "true", "eine Wahl waehrend des Laufens haelt nicht an", e2);
      await p5.evaluate(() => document.querySelector("#drPlay").click());
      // 560 px hell: Bedienung und Jetzt bleiben in der Karte, die Seite rollt nicht waagerecht
      await p5.evaluate(() => document.querySelector('#themeRow [data-theme="light"]').click());
      await p5.setViewportSize({ width: 560, height: 900 });
      await p5.waitForTimeout(300);
      const eng = await p5.evaluate(() => {
        const k = document.querySelector("#deineRot").getBoundingClientRect();
        const drin = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return r.left >= k.left - 0.5 && r.right <= k.right + 0.5; };
        return { seite: document.documentElement.scrollWidth <= window.innerWidth, steuer: drin("#drSteuer"), jetzt: drin("#drJetzt"),
          li: [...document.querySelectorAll("#drJetzt li, #drSteuer > *")].every((x) => x.getBoundingClientRect().right <= k.right + 0.5),
          /* Knopf, Tempo und Uhr passen in eine Zeile. Neugestaltung 28.09. (Aufgabe 4, Luecken 3.2): die Uhr
             ist gross wie im Entwurf, die drei sind verschieden hoch - eine Zeile heisst jetzt: ihre Mitten
             liegen hoechstens 6 Punkt auseinander (vorher: die Oberkanten im selben 20-Punkt-Raster) */
          eineZeile: (() => { const m = ["#drPlay", "#drTempo", "#drUhr"].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return r.top + r.height / 2; });
            return Math.max(...m) - Math.min(...m) <= 6; })() };
      });
      assert(eng.seite && eng.steuer && eng.jetzt && eng.li && eng.eineZeile, "560 px hell: Bedienung und Jetzt in der Karte, kein waagerechtes Rollen", eng);
      await p5.setViewportSize({ width: 1280, height: 900 });
      // unter drei Einsaetzen: keine Bedienung
      await p5.evaluate(() => { for (let b; (b = document.querySelector('#drGed .rotgz[aria-pressed="true"]')); ) b.click(); });
      await p5.waitForTimeout(200);
      const f0 = await sp(p5);
      assert(!f0.steuer && !f0.jetztDa, "keine gezeigten Einsaetze: keine Bedienung, kein Jetzt", f0);
    }
    assert(!errors5.length, `Abspielen${reduziert ? " (reduziert)" : ""}: keine Fehler in der Seite`, errors5);
    await p5.close();
  }

  /* 20 · Tastatur der Buehne und Vorlesen (Stufe 2, Spezifikation 5.6): Leertaste, Pfeile, Pos1, Ende;
     aria-live nur beim Schritt und einmal beim Anhalten, nie waehrend des Abspielens. */
  {
    const p6 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors6 = [];
    p6.on("pageerror", (e) => errors6.push(String(e)));
    await p6.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ } });
    await p6.goto("file://" + join(root, "dist", "renderer", "index.html"));
    await p6.evaluate(() => document.querySelector("#btnSample").click());
    await p6.waitForFunction(() => !document.querySelector("#app").hidden);
    await p6.evaluate(() => document.querySelector('[data-tab="rotation"]').click());
    await p6.waitForTimeout(250);
    const hilfe = await p6.evaluate(() => {
      const b = document.querySelector("#deineRotScroll");
      return { ids: b.getAttribute("aria-describedby"), tasten: document.querySelector("#drTasten")?.textContent || "",
        live: document.querySelector("#drLive")?.getAttribute("aria-live") };
    });
    assert(/deineRotLead/.test(hilfe.ids) && /drTasten/.test(hilfe.ids) && /Space/.test(hilfe.tasten) && hilfe.live === "polite",
      "Buehne: beschrieben durch Satz und Tastenhilfe, ein aria-live-Feld", hilfe);
    await p6.focus("#deineRotScroll");
    await p6.evaluate(() => {
      window.__live = 0;
      new MutationObserver((l) => { window.__live += l.length; }).observe(document.querySelector("#drLive"), { childList: true, characterData: true, subtree: true });
    });
    for (let i = 0; i < 3; i++) await p6.keyboard.press("ArrowRight");
    let k = await sp(p6);
    const N = +(/ of (\d+) · at/.exec(k.jetzt) || [])[1];
    assert(/^4 of \d+: .+ at \d:\d\d\.\d$/.test(k.live) && /\D4 of \d+ · at/.test(k.jetzt) && k.jetztI === 3 && await p6.evaluate(() => window.__live) === 3,
      "Pfeil rechts: ein Einsatz weiter, vorgelesen", { live: k.live, jetzt: k.jetzt, i: k.jetztI, n: await p6.evaluate(() => window.__live) });
    await p6.keyboard.press("ArrowLeft");
    k = await sp(p6);
    assert(/^3 of /.test(k.live) && k.jetztI === 2, "Pfeil links: ein Einsatz zurueck", k.live);
    await p6.keyboard.press("End");
    k = await sp(p6);
    // Neugestaltung 28.09.: der ganze Kampf steht da, die Leiste rollt nicht (vorher rollte die Buehne mit)
    assert(k.live.startsWith(N + " of " + N + ":") && k.jetztI === N - 1 && k.scroll === 0 && k.kopfX < k.cw, "Ende: der letzte Einsatz, der Kopf in der Leiste", { live: k.live, scroll: k.scroll, kopfX: k.kopfX, cw: k.cw });
    await p6.keyboard.press("Home");
    k = await sp(p6);
    assert(k.live.startsWith("1 of " + N + ":") && k.jetztI === 0 && k.scroll === 0, "Pos1: Einsatz 1, die Buehne am Anfang", { live: k.live, scroll: k.scroll });
    // Leertaste: abspielen - still -, Leertaste: anhalten - genau einmal gesagt
    const vor = await p6.evaluate(() => window.__live);
    await p6.keyboard.press(" ");
    await p6.waitForTimeout(1000);
    const lauf = await p6.evaluate(() => window.__live);
    k = await sp(p6);
    assert(k.pressed === "true" && lauf === vor && k.jetztI > 0, "Leertaste spielt ab, und waehrenddessen bleibt das Live-Feld still", { vor, lauf, i: k.jetztI });
    await p6.keyboard.press(" ");
    const halt = await p6.evaluate(() => window.__live);
    k = await sp(p6);
    assert(k.pressed === "false" && halt === vor + 1 && new RegExp("^" + (k.jetztI + 1) + " of ").test(k.live), "Leertaste haelt an, einmal gesagt, wo", { halt, vor, live: k.live });
    // ein Pfeil waehrend des Laufens haelt an
    await p6.keyboard.press(" ");
    await p6.waitForTimeout(300);
    await p6.keyboard.press("ArrowRight");
    k = await sp(p6);
    assert(k.pressed === "false", "ein Schritt waehrend des Laufens haelt an", k.pressed);
    // das Ende: Kopf bleibt auf dem letzten, einmal gesagt; noch einmal Abspielen beginnt von vorn
    await p6.keyboard.press("End");
    await p6.keyboard.press("ArrowLeft");
    await p6.evaluate(() => document.querySelector('#drTempo [data-tempo="2"]').click());
    await p6.focus("#deineRotScroll");
    await p6.keyboard.press(" ");
    await p6.waitForFunction(() => document.querySelector("#drPlay").getAttribute("aria-pressed") === "false", null, { timeout: 15000 }).catch(() => {});
    k = await sp(p6);
    assert(k.pressed === "false" && k.jetztI === N - 1 && k.live.startsWith(N + " of " + N + ":"), "am Ende: angehalten auf dem letzten, gesagt", { i: k.jetztI, live: k.live });
    await p6.keyboard.press(" ");
    k = await sp(p6);
    assert(k.pressed === "true" && k.jetztI <= 2, "noch einmal Abspielen beginnt von vorn", { i: k.jetztI });
    await p6.keyboard.press(" ");
    // Deutsch: Komma in der Uhr, "von" und "bei"
    await p6.evaluate(() => document.querySelector("#btnLang").click());
    await p6.waitForTimeout(200);
    await p6.focus("#deineRotScroll");
    await p6.keyboard.press("ArrowRight");
    k = await sp(p6);
    assert(/^\d+ von \d+: .+ bei \d:\d\d,\d$/.test(k.live) && / von \d+ · bei \d:\d\d,\d/.test(k.jetzt) && /^\d:\d\d,\d$/.test(k.uhr) && /^Jetzt/.test(k.jetzt),
      "Deutsch: „3 von 64: … bei 0:04,2“", { live: k.live, jetzt: k.jetzt, uhr: k.uhr });
    assert(!errors6.length, "Tastatur: keine Fehler in der Seite", errors6);
    await p6.close();
  }

  /* 18 · Live (Stufe 2): der wachsende Kampf haengt nur die neuen Einsaetze an. Ein Symbol aus dem
     ersten Takt bleibt dasselbe Element; alles steht, wie ein voller Bau mit demselben Massstab es
     setzte (ein Massstab fuer alle, jede Etage die unterste, in die das Symbol passt). Sobald der Kampf
     steht, baut die Leiste einmal voll - genau wie ein frischer Bau. Seit der Neugestaltung (28.09.)
     zeigt die Leiste den ganzen Kampf, unter Live mit Vorlauf (leistenDauer). */
  const lb = await esbuild.build({ entryPoints: [join(root, "src/main/logs.ts")], bundle: true, format: "esm",
    platform: "node", write: false, logLevel: "silent" });
  const logs = await import("data:text/javascript;base64," + Buffer.from(lb.outputFiles[0].text).toString("base64"));
  const ZEILEN = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8").split("\n").filter(Boolean);
  const stueck = (von, zu) => ZEILEN.slice(Math.floor(ZEILEN.length * von), Math.floor(ZEILEN.length * zu)).join("\n") + "\n";
  const liveOrdner = join(work, "live"), liveDatei = join(liveOrdner, "TLCombatLog-20260925.txt");
  mkdirSync(liveOrdner);
  writeFileSync(liveDatei, stueck(0, 0.8));
  const LV = { anfragen: 0, fehler: [] };
  const lp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  lp.on("pageerror", (e) => LV.fehler.push(String(e)));
  await lp.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* storage blocked */ } });
  await lp.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/state") {
      const f = logs.newestLog(liveOrdner);
      return json(200, { dir: liveOrdner, file: f?.name ?? "", size: f?.size ?? 0, mtime: f?.mtime ?? 0 });
    }
    if (path === "/api/latest") {
      LV.anfragen++;
      const f = logs.newestLog(liveOrdner);
      if (!f) return route.fulfill({ status: 404, body: "" });
      if (!url.searchParams.has("from")) return route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: logs.readLog(f) });
      const a = logs.latestAnswer(f, url.searchParams.get("file"), url.searchParams.get("from"));
      return json(a.status, a.body);
    }
    if (path === "/api/best" && req.method() === "GET") return json(200, { ok: true, best: {} });
    if (path.startsWith("/api/")) return json(200, { ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
  });
  await lp.goto("http://boro.test/index.html");
  // Seite fertig: body[data-bereit] statt #landStatus (Neugestaltung 28.09., Befund 2)
  await lp.waitForFunction(() => document.body.dataset.bereit === "ordner");
  await lp.evaluate(() => document.querySelector("#btnWatch").click());
  const takt = async () => {
    const ziel = LV.anfragen + 1;
    for (const end = Date.now() + 15000; Date.now() < end && LV.anfragen < ziel; ) await lp.waitForTimeout(100);
    await lp.waitForTimeout(500);
  };
  await takt();
  await lp.waitForFunction(() => !document.querySelector("#app").hidden);
  await lp.evaluate(() => document.querySelector('[data-tab="rotation"]').click());
  await lp.waitForTimeout(300);
  /* Die Leiste, wie sie dasteht: je Symbol Zeit, Lage, Etage (top) - und ob die Lage aus einem Bau
     stammen kann: ein Massstab fuer alle, jede Etage die unterste, in die das Symbol passte. */
  const leiste = () => lp.evaluate(() => {
    const syms = [...document.querySelectorAll("#rotBar .drsym:not(.geht)")].map((e) => ({ t: +e.dataset.t, x: parseFloat(e.style.left) + 16, top: parseFloat(e.style.top) }));
    const lead = document.querySelector("#deineRotLead").textContent;
    return { syms, striche: document.querySelectorAll("#rotBar .drstrich").length, n: +(/^(\d+) casts? you pressed/.exec(lead) || [])[1],
      merk: !!document.querySelector("#rotBar .drsym[data-merk]"), watching: document.body.classList.contains("watching") };
  });
  const gebaut = (l) => {
    const letzte = l.syms[l.syms.length - 1];
    const pxs = (letzte.x - 24) / (letzte.t / 1000);   // RAND 24
    const einMass = l.syms.every((s) => Math.abs(s.x - (24 + s.t / 1000 * pxs)) <= 0.11);
    const tops = [...new Set(l.syms.map((s) => s.top))].sort((a, b) => b - a);   // unterste Etage zuerst
    const rechts = new Map();
    let unterste = true;
    for (const s of l.syms) {
      const r = tops.indexOf(s.top);
      for (let u = 0; u < r; u++) if (s.x - 16 >= (rechts.get(u) ?? -1e9) + 3 + 0.06) unterste = false;
      if (s.x - 16 < (rechts.get(r) ?? -1e9) + 3 - 0.06) unterste = false;
      rechts.set(r, s.x + 16);
    }
    return { pxs, einMass, unterste };
  };
  let l0 = await leiste();
  assert(l0.watching && l0.syms.length > 5 && l0.n === l0.striche, "Live: der wachsende Kampf steht in der Leiste", { n: l0.n, striche: l0.striche, syms: l0.syms.length });
  /* Markiert wird nach dem ersten Takt mit Wachstum: der erste Bau nach dem Oeffnen des Reiters kann
     noch einmal ganz bauen (die Seite bekommt ihre Rollleiste, die Breite der Buehne aendert sich). */
  appendFileSync(liveDatei, stueck(0.8, 0.84));
  await takt();
  await lp.evaluate(() => { document.querySelector("#rotBar .drsym").dataset.merk = "1"; });
  const l1 = await leiste();
  let lz = l1;
  for (const [von, zu] of [[0.84, 0.88], [0.88, 0.92], [0.92, 0.96]]) {
    appendFileSync(liveDatei, stueck(von, zu));
    await takt();
    lz = await leiste();
  }
  const gz = gebaut(lz);
  assert(lz.merk && lz.striche > l1.striche && l1.striche > l0.striche && lz.n === lz.striche,
    "Live: nach drei Takten mit neuen Einsaetzen ist das erste Symbol dasselbe Element, und die Striche sind mitgewachsen",
    { merk: lz.merk, vorher: l1.striche, nachher: lz.striche, n: lz.n });
  assert(gz.einMass && gz.unterste, "Live: angehaengt steht alles wie in einem Bau - ein Massstab, jede Etage die unterste, die passt", gz);
  /* Direkt verglichen (Review Stufe 2): im selben Takt ganz neu gebaut - zweimal die Sprache gewechselt, das
     baut die Leiste voll, unter Live mit demselben Massstab - steht jedes Symbol, wo das Anhaengen es hinsetzte. */
  for (let i = 0; i < 2; i++) { await lp.evaluate(() => document.querySelector("#btnLang").click()); await lp.waitForTimeout(200); }
  const vollBau = await leiste();
  assert(!vollBau.merk && vollBau.watching && JSON.stringify(vollBau.syms) === JSON.stringify(lz.syms) && vollBau.striche === lz.striche,
    "Live: angehaengt gleich voll gebaut im selben Takt (jedes Symbol, jede Etage, jeder Strich)", { angehaengt: lz.syms.length, voll: vollBau.syms.length });
  /* Wird der Kampf laenger und wieder kuerzer (T sinkt) bei denselben Einsaetzen: seit der Neugestaltung
     (28.09.) zeigt die Leiste den ganzen Kampf auf ihrer Breite (unter Live mit Vorlauf) - sie bleibt so
     breit wie ihr Feld, wird nie breiter (vorher: die rollende Leiste wurde breiter und baute beim
     Kuerzerwerden ganz, um wieder schmaler zu werden), und was nach dem Kuerzerwerden steht, gleicht
     einem frischen Bau. Eine spaete Zeile einer Faehigkeit mit Schaden 1 verlaengert den Kampf, ohne
     einen Einsatz der Leiste zu bringen; dann wird die Datei ohne sie neu geschrieben. */
  const breite = () => lp.evaluate(() => parseFloat(document.querySelector("#rotBar .drflaeche").style.width) - document.querySelector("#deineRotScroll").clientWidth);
  const stand96 = stueck(0, 0.96);
  const letzte = stand96.trim().split("\n").pop();
  const spaet = new Date(Date.UTC(+letzte.slice(0, 4), +letzte.slice(4, 6) - 1, +letzte.slice(6, 8), +letzte.slice(9, 11), +letzte.slice(12, 14), +letzte.slice(15, 17) + 6, +letzte.slice(18, 21)));
  const z2 = (n, w = 2) => String(n).padStart(w, "0");
  const spaetZeile = `${spaet.getUTCFullYear()}${z2(spaet.getUTCMonth() + 1)}${z2(spaet.getUTCDate())}-${z2(spaet.getUTCHours())}:${z2(spaet.getUTCMinutes())}:${z2(spaet.getUTCSeconds())}:${z2(spaet.getUTCMilliseconds(), 3)}` +
    "," + letzte.split(",").slice(1, 3).join(",").replace(/,.*/, "") + ",Fähigkeit – 1,1,1,0,0,kNormalHit," + letzte.split(",").slice(8).join(",");
  const w0 = await breite();
  appendFileSync(liveDatei, spaetZeile + "\n");
  await takt();
  const wLang = await breite();
  writeFileSync(liveDatei, stand96);
  await takt(); await takt();
  const wKurz = await breite();
  const kurz = await leiste();
  for (let i = 0; i < 2; i++) { await lp.evaluate(() => document.querySelector("#btnLang").click()); await lp.waitForTimeout(200); }
  const wFrisch = await breite();
  const frischL = await leiste();
  assert([w0, wLang, wKurz, wFrisch].every((w) => Math.abs(w) <= 1) && kurz.watching && JSON.stringify(kurz.syms) === JSON.stringify(frischL.syms),
    "Live: der Kampf wird laenger und kuerzer - die Leiste bleibt so breit wie ihr Feld und steht wie ein frischer Bau",
    { w0, wLang, wKurz, wFrisch, kurz: kurz.syms.length, frisch: frischL.syms.length });
  // Live in der Folge (Stufe 3) entfaellt mit der Folge (Neugestaltung 28.09., Spezifikation 3); die restlichen Zeilen der Datei kommen dazu
  appendFileSync(liveDatei, stueck(0.96, 0.98));
  await takt();
  appendFileSync(liveDatei, stueck(0.98, 1));
  await takt();
  /* Issue #52: der Fokus auf "Zuruecknehmen" im Kasten bleibt, wenn ein Live-Takt die Liste neu baut (eine
     neue automatische Faehigkeit kommt dazu, die Anzahl der anderen waechst). */
  /* Erst ein neuer Kampf aus eigenen Zeilen (Deadly Viper vorgeschlagen), dort Stimmt; dann waechst er
     um eine weitere passive Faehigkeit. */
  const letzteLive = readFileSync(liveDatei, "utf8").trim().split("\n").pop();
  const tl = Date.UTC(+letzteLive.slice(0, 4), +letzteLive.slice(4, 6) - 1, +letzteLive.slice(6, 8), +letzteLive.slice(9, 11), +letzteLive.slice(12, 14), +letzteLive.slice(15, 17), +letzteLive.slice(18, 21));
  const rest = letzteLive.split(",").slice(7).join(",");
  const liveZeilen = (von, bis, ids) => {
    const z = [];
    for (let i = von; i < bis; i++) ids.forEach((id, j) => z.push(stamp(tl + i * 600 + j * 100) + `,DamageDone,Fähigkeit – ${id},${id},${id === "940584840" ? 50000 : 400000},0,0,` + rest));
    return z.join("\n") + "\n";
  };
  appendFileSync(liveDatei, liveZeilen(1, 6, ["950282680", "940584840"]));
  await takt();
  const vorschlag = await lp.evaluate(() => [...document.querySelectorAll('#drAuto button[data-wahl="1"]')].find((b) => b.dataset.k === "Deadly Viper")?.dataset.k ?? null);
  await lp.focus('#drAuto button[data-wahl="1"][data-k="Deadly Viper"]');
  await lp.keyboard.press("Enter");
  await lp.waitForTimeout(200);
  const fokusLive = () => lp.evaluate(() => { const a = document.activeElement; return a && a.closest("#drAuto") ? a.dataset.k + ":" + a.dataset.art : ""; });
  const vorFokus = await fokusLive();
  const zeilenVor = await lp.evaluate(() => [...document.querySelectorAll("#drAuto li[data-k]")].map((l) => l.dataset.k).join("|"));
  appendFileSync(liveDatei, liveZeilen(6, 11, ["950282680", "940584840", "940593086"]));
  await takt();
  const zeilenNach = await lp.evaluate(() => [...document.querySelectorAll("#drAuto li[data-k]")].map((l) => l.dataset.k).join("|"));
  assert(!!vorschlag && vorFokus === "Deadly Viper:zurueck" && zeilenNach !== zeilenVor && await fokusLive() === vorFokus,
    "Live: die Liste im Kasten wird neu gebaut, der Fokus bleibt auf demselben Zuruecknehmen", { vorschlag, vorFokus, nach: await fokusLive(), zeilenVor, zeilenNach });
  /* Live (Stufe 2): beim wachsenden Kampf ist Abspielen gesperrt, mit dem Satz warum; die Leertaste startet
     nichts. Ein aelterer Kampf links spielt ab. */
  const sperre = await lp.evaluate(() => ({ dis: document.querySelector("#drPlay").disabled, satz: document.querySelector("#drSperre").hidden ? "" : document.querySelector("#drSperre").textContent,
    zu: document.querySelector("#drPlay").getAttribute("aria-describedby") }));
  await lp.focus("#deineRotScroll");
  const uhr0 = await lp.evaluate(() => document.querySelector("#drUhr").textContent);
  await lp.keyboard.press(" ");
  await lp.waitForTimeout(500);
  const nachLeer = await lp.evaluate(() => [document.querySelector("#drPlay").getAttribute("aria-pressed"), document.querySelector("#drUhr").textContent]);
  assert(sperre.dis && sperre.satz === "Playback works once the fight is over." && sperre.zu === "drSperre" && nachLeer[0] === "false" && nachLeer[1] === uhr0,
    "Live: beim wachsenden Kampf ist Abspielen gesperrt, mit dem Satz warum, und die Leertaste startet nichts", { sperre, nachLeer });
  await lp.evaluate(() => document.querySelectorAll("#fightList .fight")[1]?.click());
  await lp.waitForTimeout(400);
  const frei = await lp.evaluate(() => ({ dis: document.querySelector("#drPlay").disabled, satz: document.querySelector("#drSperre").hidden }));
  assert(!frei.dis && frei.satz, "Live: ein aelterer Kampf spielt ab", frei);
  await lp.evaluate(() => document.querySelectorAll("#fightList .fight")[0]?.click());
  await lp.waitForTimeout(400);
  await lp.evaluate(() => document.querySelector("#btnWatch").click());
  await lp.waitForTimeout(800);
  const aus = await leiste();
  for (let i = 0; i < 2; i++) { await lp.evaluate(() => document.querySelector("#btnLang").click()); await lp.waitForTimeout(250); }
  const frisch = await leiste();
  assert(!aus.watching && !aus.merk && JSON.stringify(aus.syms) === JSON.stringify(frisch.syms) && gebaut(aus).unterste,
    "Live aus: die Leiste baut einmal voll, genau wie ein frischer Bau", { aus: aus.syms.length, frisch: frisch.syms.length });
  assert(!LV.fehler.length, "Live: keine Fehler in der Seite", LV.fehler);
  await lp.close();
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
console.log();
if (failed) { console.log(`ROTATION PAGE FAILED - ${failed}`); process.exit(1); }
console.log("ROTATION PAGE PASSED");
