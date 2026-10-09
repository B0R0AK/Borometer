// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die reinen Funktionen von "Gegen deinen besten Pull"
// (src/renderer/best-pull-core.ts), ohne Seite: esbuild buendelt die eine
// Datei - sie importiert nur Typen -, Node fuehrt sie aus.
//
// Run:  npm run test:best-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = await esbuild.build({
  entryPoints: [join(root, "src", "renderer", "best-pull-core.ts")],
  bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))],
});
const core = await import("data:text/javascript;base64," +
  Buffer.from(built.outputFiles[0].text).toString("base64"));

let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        got  " + a + "\n        want " + b); }
}

// Laengenklasse der Uebungspuppe: die groesste erreichte, mit 2 s Spielraum
eq([30, 57.9, 58, 61.5, 117.9, 118, 177.9, 178, 400].map(core.dummyClass),
   [null, null, 60, 60, 60, 120, 120, 180, 180], "dummyClass");

// DPS ueber die Klassenlaenge, so wie clip() sie rechnet
eq(core.classDps(61.5, 999, new Array(62).fill(100), 60), 100, "classDps: auf 60 s geschnitten");
eq(core.classDps(59, 88, new Array(59).fill(100), 60), 88, "classDps: kuerzer als die Klasse bleibt, wie er ist");

// zwei Plaetze je Boss
const pull = (at, dps) => ({ run: { dps }, at, file: "f", ver: "v" });
let e = core.mergeBest(undefined, pull(1, 10));
eq(e, { best: pull(1, 10) }, "mergeBest: der erste wird bester");
e = core.mergeBest(e, pull(2, 20));
eq(e, { best: pull(2, 20), second: pull(1, 10) }, "mergeBest: ein besserer verdraengt auf Platz zwei");
e = core.mergeBest(e, pull(3, 15));
eq(e, { best: pull(2, 20), second: pull(3, 15) }, "mergeBest: der dritte faellt heraus");
e = core.mergeBest(e, pull(3, 25));
eq(e, { best: pull(3, 25), second: pull(2, 20) }, "mergeBest: derselbe Kampf (gleiches at) ersetzt sich");
eq(core.mergeBest(e, pull(4, 5)), e, "mergeBest: schwaecher als beide aendert nichts");
// mit Schwelle (Spezifikation Bester Pull 5.2): ein kurzer verdraengt keinen langen
const pullS = (at, dps, seconds) => ({ run: { dps, seconds }, at, file: "f", ver: "v" });
{
  let m = core.mergeBest(undefined, pullS(1, 100, 90), 60);
  m = core.mergeBest(m, pullS(2, 80, 75), 60);
  eq(core.mergeBest(m, pullS(3, 999, 14), 60), m, "mergeBest: ein kurzer Pull mit hoher DPS verdraengt keinen langen");
  const kurz = core.mergeBest(core.mergeBest(undefined, pullS(4, 999, 14), 60), pullS(5, 50, 10), 60);
  eq(core.mergeBest(kurz, pullS(6, 70, 80), 60), { best: pullS(6, 70, 80), second: pullS(4, 999, 14) },
     "mergeBest: ein langer verdraengt kurze, auch mit weniger DPS");
  eq(core.mergeBest(m, pullS(7, 90, 60), 60), { best: pullS(1, 100, 90), second: pullS(7, 90, 60) },
     "mergeBest: genau auf der Schwelle zaehlt");
  /* Gleiche DPS: der fruehere zuerst, wie in rangfolge. Sonst verdraengte
     ein spaeterer Pull mit gleicher DPS den frueheren aus dem Speicher,
     obwohl die Regel den frueheren als besten waehlt. */
  eq(core.mergeBest({ best: pullS(1, 100, 90) }, pullS(2, 100, 90), 60), { best: pullS(1, 100, 90), second: pullS(2, 100, 90) },
     "mergeBest: gleiche DPS - der fruehere bleibt bester");
  eq(core.mergeBest({ best: pullS(5, 100, 90), second: pullS(6, 100, 90) }, pullS(1, 100, 90), 60),
     { best: pullS(1, 100, 90), second: pullS(5, 100, 90) }, "mergeBest: gleiche DPS - ein frueherer verdraengt den spaetesten");
}
eq(core.mergeEntries({ best: pull(1, 10) }, { best: pull(1, 12), second: pull(5, 11) }),
   { best: pull(1, 12), second: pull(5, 11) }, "mergeEntries: bei gleichem at gewinnt der neuere Stand");
eq(core.sameEntry({ best: pull(1, 10) }, { best: pull(1, 10) }), true, "sameEntry: gleich");
eq(core.sameEntry({ best: pull(1, 10) }, { best: pull(1, 11) }), false, "sameEntry: verschieden");

// Einsaetze: [Beginn ms, Ende ms, Schaden, Treffer, Krits] je Faehigkeit
const A = [{ n: "Quick Fire", s: "964762401", c: [[0, 100, 5, 1, 0], [3000, 3100, 5, 1, 0], [61000, 61100, 5, 1, 0]] },
           { n: "Strafing", s: "", c: [[500, 900, 7, 2, 1]] }];
const B = [{ n: "Schnellfeuer", s: "964762401", c: [[200, 300, 5, 1, 0], [70000, 70100, 5, 1, 0]] },
           { n: "Blade Storm", s: "", c: [[100, 200, 3, 1, 0]] }];
eq(core.cutCasts(A, 60000), [
  { n: "Quick Fire", s: "964762401", c: [[0, 100, 5, 1, 0], [3000, 3100, 5, 1, 0]] },
  { n: "Strafing", s: "", c: [[500, 900, 7, 2, 1]] }], "cutCasts: nur was vor dem Schnitt begann");
eq(core.cutCasts(B, 150), [{ n: "Blade Storm", s: "", c: [[100, 200, 3, 1, 0]] }], "cutCasts: leere Spuren fallen weg");
eq(core.rotLanes(A, B, 60000, 12), [
  { name: "Quick Fire", sid: "964762401", a: [0, 3000], b: [200] },
  { name: "Strafing", sid: "", a: [500], b: [] },
  { name: "Blade Storm", sid: "", a: [], b: [100] },
], "rotLanes: ueber die Skill-Kennung vereint, Reihenfolge des Bezugs zuerst");
eq(core.rotLanes(A, B, 60000, 1).length, 1, "rotLanes: hoechstens max Spuren");
eq(core.castOrder(A, 60000, 3), [
  { name: "Quick Fire", sid: "964762401", t: 0 },
  { name: "Strafing", sid: "", t: 500 },
  { name: "Quick Fire", sid: "964762401", t: 3000 },
], "castOrder: die ersten Einsaetze der Zeit nach");

// Datum in der Uhr des Logs (UTC-Felder, wie wallTime)
eq(core.pullWhen(Date.UTC(2026, 8, 17, 21, 5), "de"), "17.09. 21:05", "pullWhen: deutsch");
eq(core.pullWhen(Date.UTC(2026, 8, 17, 21, 5), "en"), "17/09 21:05", "pullWhen: englisch");

// Was aus boro-best.json kommt: gepruefte Schluessel und Eintraege bis in die Faehigkeiten
eq(["boss:vulcanus", "dummy:60", "__proto__", "boss:", "constructor", "boss:a" + String.fromCharCode(10) + "b", "x:vulcanus"]
   .map(k => core.BEST_KEY_RX.test(k)), [true, true, false, false, false, false, false], "BEST_KEY_RX: wie in main");
const lauf = (skills) => ({ name: "Vulcanus", skills, windows: [{ from: 0, to: 15, dps: 1, damage: 15 }], perSecond: [1, 2] });
const gut = { name: "Quick Fire", damage: 10, dps: 1, hits: 2, crit: 0, heavy: 0, max: 5, casts: 1, sid: "1", weapon: "Bow" };
eq([lauf([gut]), lauf([null]), lauf([{ ...gut, name: 7 }]), lauf([{ ...gut, damage: "10" }]),
    lauf([{ ...gut, sid: 5 }]), lauf([{ ...gut, dps: null }]), { ...lauf([gut]), perSecond: [1, null] },
    { ...lauf([gut]), windows: [null] }].map(core.runPartsOk),
   [true, false, false, false, false, true, false, false], "runPartsOk: jedes Element geprueft, null als Zahl erlaubt");
eq([undefined, [], [{ n: "a", s: "", c: [[0, 1, 2, 3, 4]] }], [null], [{ n: "a", s: "", c: [[0, 1, 2, 3]] }],
    [{ n: "a", s: "", c: [[0, 1, "2", 3, 4]] }]].map(core.castsOk),
   [true, true, true, false, false, false], "castsOk");
const huelle = (r) => typeof r.name === "string" && Array.isArray(r.skills);
const bp = (run) => ({ run, at: 1, file: "f", ver: "v" });
eq([{ best: bp(lauf([gut])) }, { best: bp(lauf([null])) }, { best: bp(lauf([gut])), second: bp(lauf([null])) },
    { best: bp({ ...lauf([gut]), casts: [null] }) }, { best: { ...bp(lauf([gut])), at: "1" } }, null]
   .map(e => core.looksLikeBestEntry(e, huelle)),
   [true, false, false, false, false, false], "looksLikeBestEntry: ein kaputter Eintrag wird uebergangen, nie geworfen");

// Ursache oder verteilt: eine Regel fuer den Antwortsatz und "Woher der Unterschied kommt"
const dl = (...d) => d.map((x) => ({ d: x }));
eq([core.groessterAnteil(dl(-300, 100, -100)), core.groessterAnteil([]), core.URSACHE_AB], [0.6, 0, 0.4],
   "groessterAnteil: Betrag der groessten Aenderung durch die Summe der Betraege");
eq([core.verteilt(dl(-300, -100, -100)), core.verteilt(dl(-100, -100, -100, -100)), core.verteilt(dl(-40, -30, -30)),
    core.verteilt(dl(-39, -31, -30)), core.verteilt([])],
   [false, true, false, true, true], "verteilt: ab 40 % traegt eine Faehigkeit, darunter und bei Gleichstand vieler verteilt");

// Urteil der Tafel (Instrumententafel 4): dieselben Abstaende wie der Vergleich
{
  const key = (s) => s.sid || s.name;
  const ref = { dps: 1000, seconds: 60, fought: 60, skills: [
    { name: "A", sid: "1", damage: 36000, hits: 60, dps: 600 },
    { name: "B", sid: "2", damage: 24000, hits: 120, dps: 400 } ] };
  const cur = { dps: 800, seconds: 60, fought: 50, skills: [
    { name: "A", sid: "1", damage: 22500, hits: 50, dps: 450 },
    { name: "B", sid: "2", damage: 17500, hits: 100, dps: 350 } ] };
  const v = core.vergleichZahlen(ref, cur, key);
  eq([v.gap, v.rel, v.relShown, v.tie], [-200, -20, 20, false], "Vergleich: Abstand und Anteil");
  eq(v.deltas.map(x => [x.key, x.d]), [["1", -150], ["2", -50]], "Vergleich: je Faehigkeit, groesster zuerst");
  const u = core.urteilZahlen(ref, cur, key);
  eq([u.gap, u.verteilt, u.skill && u.skill.key], [-200, false, "1"], "Urteil: es fehlt vor allem A");
  eq(u.proTreffer, [450, 600], "Urteil: Schaden je Treffer dieser gegen bester");
  eq(u.proMinute, [60, 60], "Urteil: Treffer je Minute nach gekaempfter Zeit");
  /* Zweiter Beleg (Neugestaltung 28.09., DECISION 2.19, Entwurf E:378-395):
     die Faehigkeit mit dem groessten Verlust in Treffern je Minute ueber alle
     Faehigkeiten - bewertet mit ihrem Schaden je Treffer, also DPS, die die
     fehlenden Treffer kosten. Das darf dieselbe Faehigkeit sein wie der erste. */
  eq(u.zweit, null, "Urteil: gleiche Treffer je Minute, kein zweiter Beleg");
  const rate = { dps: 750, seconds: 60, fought: 60, skills: [
    { name: "A", sid: "1", damage: 27000, hits: 60, dps: 450 },
    { name: "B", sid: "2", damage: 18000, hits: 90, dps: 300 } ] };
  const r2 = core.urteilZahlen(ref, rate, key);
  eq([r2.skill && r2.skill.key, r2.zweit && r2.zweit.skill.key, r2.zweit && r2.zweit.proMinute],
     ["1", "2", [90, 120]], "Urteil: zweiter Beleg B, 90 statt 120 Treffer je Minute");
  const selbe = { dps: 775, seconds: 60, fought: 60, skills: [
    { name: "A", sid: "1", damage: 22500, hits: 45, dps: 375 },
    { name: "B", sid: "2", damage: 24000, hits: 120, dps: 400 } ] };
  const s2 = core.urteilZahlen(ref, selbe, key);
  eq([s2.skill && s2.skill.key, s2.zweit && s2.zweit.skill.key, s2.zweit && s2.zweit.proMinute],
     ["1", "1", [45, 60]], "Urteil: zweiter Beleg darf dieselbe Faehigkeit sein");
  const nurHier = { dps: 700, seconds: 60, fought: 60, skills: [
    { name: "A", sid: "1", damage: 24000, hits: 40, dps: 400 },
    { name: "C", sid: "3", damage: 18000, hits: 200, dps: 300 } ] };
  const n2 = core.urteilZahlen(ref, nurHier, key);
  eq([n2.zweit && n2.zweit.skill.key, n2.zweit && n2.zweit.proMinute], ["1", [40, 60]],
     "Urteil: nur Faehigkeiten mit Treffern in beiden Laeufen zaehlen fuer den zweiten Beleg");
  /* Erster Beleg (Pruefung 29.09., Luecke 2.18, Entwurf E:370 lossT): die
     Faehigkeit mit dem groessten Verlust je Treffer - Differenz Schaden je
     Treffer mal Treffer dieses Laufs durch seine Sekunden, also DPS. A
     verliert nur Treffer (groesster DPS-Abstand), B nur Schaden je Treffer:
     erst = B, zweit = A, die Schlagzeile (skill) bleibt am DPS-Abstand A. */
  eq(u.erst && u.erst.skill.key, "1", "Urteil: erster Beleg A, 450 statt 600 je Treffer");
  const trennt = { dps: 700, seconds: 60, fought: 60, skills: [
    { name: "A", sid: "1", damage: 18000, hits: 30, dps: 300 },
    { name: "B", sid: "2", damage: 24000, hits: 120, dps: 400 } ] };
  const ref2 = { dps: 1000, seconds: 60, fought: 60, skills: [
    { name: "A", sid: "1", damage: 36000, hits: 60, dps: 600 },
    { name: "B", sid: "2", damage: 26400, hits: 120, dps: 440 } ] };
  const t2 = core.urteilZahlen(ref2, trennt, key);
  eq([t2.skill && t2.skill.key, t2.erst && t2.erst.skill.key, t2.erst && t2.erst.proTreffer, t2.zweit && t2.zweit.skill.key],
     ["1", "2", [200, 220], "1"], "Urteil: erster Beleg je Treffer (B), zweiter je Minute (A), Schlagzeile am DPS-Abstand (A)");
  eq(core.urteilZahlen(ref2, { ...trennt, skills: [trennt.skills[0], { ...ref2.skills[1] }] }, key).erst, null,
     "Urteil: ohne Verlust je Treffer kein eigener erster Beleg");
  const gleich = core.urteilZahlen(ref, ref, key);
  eq([gleich.gap, gleich.skill, gleich.zweit, gleich.erst], [0, null, null, null], "Urteil: kein Abstand, keine Faehigkeit");
  const breit = { ...cur, skills: [
    { name: "A", sid: "1", damage: 31000, hits: 60, dps: 520 },
    { name: "B", sid: "2", damage: 16000, hits: 100, dps: 280 } ] };
  const w = core.urteilZahlen(ref, breit, key);
  eq(w.verteilt, core.verteilt(core.vergleichZahlen(ref, breit, key).deltas), "Urteil: verteilt nach derselben Regel wie der Satz");
}

// ---------- die Regel fuer den besten Pull (#151, Spezifikation Bester Pull 3)
const P = (at, dps, dur, c) => (c ? { at, dps, dur, c } : { at, dps, dur });
{
  // #151: 22 Fehlstarts mit 14,4 s und 31.8k, ein Pull mit 4m 44s und 8.582
  const wipes = Array.from({ length: 22 }, (_, i) => P(i, 31800, 14.4));
  const lang = P(100, 8582, 284);
  eq(core.mindestLaenge([...wipes, lang]), 60, "Schwelle: 60 s, wenn der laengste Pull 120 s oder mehr hat");
  eq(core.besterPull([...wipes, lang]), lang, "#151: nach 22 Fehlstarts traegt der lange Pull das Gold");
  eq(core.besterPull([lang]), null, "ein einziger Pull ist kein bester (#151, Punkt 2)");
  eq(core.besterPull([]), null, "ohne Pulls kein bester");
  eq(core.mindestLaenge([]), 0, "Schwelle ohne Pulls: 0");
  eq(core.mindestLaenge([P(1, 1, 40), P(2, 1, 30)]), 20, "Schwelle: halber laengster, wenn der kuerzer als 60 s ist");
  eq(core.besterPull([P(1, 900, 20), P(2, 1000, 19.9), P(3, 800, 40)]), P(1, 900, 20), "genau auf der Schwelle zaehlt, knapp darunter nicht");
  eq(core.besterPull([P(5, 500, 90), P(3, 500, 70), P(9, 400, 300)]), P(3, 500, 70), "gleiche DPS: der fruehere");
  eq(core.rangfolge([P(1, 500, 90), P(2, 700, 61), P(3, 9000, 10), P(4, 600, 120)]).map((p) => p.at), [2, 4, 1],
     "Rangfolge: nur ab der Schwelle, nach DPS");
  eq(core.rangfolge([P(1, 500, 90), P(2, 9000, 30)], 20).map((p) => p.at), [2, 1], "Rangfolge: eine Schwelle von aussen gilt");
  eq(core.rangfolge([P(1, 0, 90), P(2, 300, 90)]).map((p) => p.at), [2], "Rangfolge: ohne DPS kein Kandidat");
  // Uebungspuppe: die Klasse ist die Schwelle, dur zaehlt nicht
  eq(core.besterPull([P(1, 700, 62, 60), P(2, 900, 59, 60), P(3, 650, 400, 60)]), P(2, 900, 59, 60),
     "Puppe: keine Mindestlaenge ueber die Klasse hinaus");
}

console.log();
if (failed) { console.log(`BEST CORE FAILED - ${failed}`); process.exit(1); }
console.log("BEST CORE PASSED");
