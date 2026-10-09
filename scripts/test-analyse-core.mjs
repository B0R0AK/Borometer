// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die reinen Funktionen der Analyse zu Fenster, Nebenzielen und Start
// (src/renderer/analyse-core.ts, Spezifikation 2026-09-27, Abschnitte 4 und
// 9.1), ohne Seite: esbuild buendelt den Kern allein - er importiert nichts -,
// Node fuehrt ihn aus. Die Pulls sind erzeugt, mit festem Samen; Namen sind
// Platzhalter, keine Spielernamen.
//
// Run:  npm run test:analyse-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = await esbuild.build({
  stdin: {
    contents: 'export * from "./analyse-core"; export { I18N } from "./app/07-dictionary";',
    resolveDir: join(root, "src", "renderer"), loader: "ts",
  },
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
const nah = (x, soll, tol) => typeof x === "number" && Math.abs(x - soll) <= tol;

// fester Zufall (mulberry32), damit ein Fehler wiederkommt
let seed = 20260927;
const zufall = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/* Ein Pull: F ("Mal") alle fAlle ms, H jede hAlle ms (bei +300 ms), im
   echten Fenster (stark ms nach einem F) mit inDmg, sonst outDmg, je
   +-10 % gestreut; dazu ein Fueller mit Waffe jede Sekunde und ein Proc
   ohne Waffe. */
function pull(o = {}) {
  const { secs = 96, fAlle = 12000, stark = 6000, hAlle = 1000, inDmg = 100000, outDmg = 70000,
    inKrit = 0.75, outKrit = 0.65, streu = 0.1, ohneF = false, alle = true, aus } = o;
  const f = [], h = [], fueller = [], proc = [];
  for (let t = 0; t < secs * 1000; t += fAlle) f.push([t, t + 200, 50000, 1, 0]);
  for (let t = 300; t < secs * 1000; t += hAlle) {
    const drin = f.some((x) => x[0] <= t && t < x[0] + stark);
    const d = Math.round((drin ? inDmg : outDmg) * (1 + streu * (2 * zufall() - 1)));
    h.push([t, t + 100, d, 1, zufall() < (drin ? inKrit : outKrit) ? 1 : 0]);
  }
  for (let t = 700; t < secs * 1000; t += 1000) fueller.push([t, t + 50, 20000, 1, 0]);
  for (let t = 900; t < secs * 1000; t += 2000) proc.push([t, t, 5000, 1, 0]);
  const spuren = [
    { k: "H", n: "Haupt", s: "1", waffe: true, c: h },
    { k: "FUE", n: "Fueller", s: "3", waffe: true, c: fueller },
    { k: "PROC", n: "Proc", s: "4", waffe: false, c: proc },
  ];
  if (!ohneF) spuren.splice(1, 0, { k: "F", n: "Mal", s: "2", waffe: true, c: f });
  return { spuren, sekunden: secs, alle, ...(aus ? { aus } : {}) };
}
const pool = (n, o) => Array.from({ length: n }, () => pull(o));

// --- gut genutzt: 14 Pulls, 95 % ... hier: das Fenster ist 6 s, +43 %
const gut = pool(14);
eq(core.hauptschaden(gut), "H", "hauptschaden: die Spur mit dem meisten Schaden ueber den Pool");
const fe = core.fensterSuchen(gut, "H");
eq(fe && [fe.f, fe.h, fe.l, fe.pulls], ["F", "H", 6, 14], "fensterSuchen: F, 6 s, ueber 14 Pulls");
eq(fe && nah(fe.gewinn, 0.4286, 0.01), true, "fensterSuchen: Gewinn 0,43 +- 0,01 (" + fe?.gewinn + ")");
eq(fe && nah(fe.abdeckung, 0.5, 0.02), true, "fensterSuchen: Abdeckung 50 % (" + fe?.abdeckung + ")");
eq(fe && nah(fe.kritIn, 0.75, 0.05) && nah(fe.kritAus, 0.65, 0.05), true, "fensterSuchen: Krit-Raten innen und aussen");
eq(fe && nah(fe.jeIn, 100000, 2000) && nah(fe.jeAus, 70000, 1500), true, "fensterSuchen: Trefferstaerken des Builds");
{
  const w = core.fensterLesen(gut[0], fe);
  eq([nah(w.aussen, 0.41, 0.03), w.trefferIn, w.trefferAus, w.jeMinute], [true, 48, 48, 5],
    "fensterLesen: Anteil aussen, Treffer je Seite, 5,0 Mal je Minute");
  // gut genutzt: 95 % von H im Fenster
  const g = core.fensterLesen(gesetzt(46, 3, 100000, 70000), fe);
  eq([nah(g.aussen, 0.044, 0.005), core.fensterUrteil(g, 46 * 100000 + 3 * 70000)], [true, false],
    "fensterUrteil: gut genutzt (95 % im Fenster) schlaegt nicht an");
}
// Proc (ohne Waffe) und Fueller (deckt alles) sind nie das Fenster
eq(core.fensterSuchen(gut.map((p) => ({ ...p, spuren: p.spuren.filter((s) => s.k !== "F") })), "H"), null,
  "fensterSuchen: ohne Mal kein Fenster - Fueller und Proc sind keine");
eq(core.hauptschaden([pull({ secs: 20 })]), null, "hauptschaden: unter 200 Treffern kein Hauptschaden");

// --- 30 % ausserhalb, Staerken 81,2k/45,5k: Kosten mit den Staerken des Kampfes
function gesetzt(nIn, nAus, dIn, dAus, extra = {}) {
  const f = [], h = [];
  for (let t = 0; t < 96000; t += 12000) f.push([t, t + 200, 50000, 1, 0]);
  let i = 0, a = 0;
  for (let t = 300; t < 96000; t += 1000) {
    const drin = t % 12000 < 6000;
    if (drin && i < nIn) { h.push([t, t + 100, dIn, 1, 0]); i++; }
    if (!drin && a < nAus) { h.push([t, t + 100, dAus, 1, 0]); a++; }
  }
  return { spuren: [{ k: "H", n: "Haupt", s: "1", waffe: true, c: h }, { k: "F", n: "Mal", s: "2", waffe: true, c: f }],
    sekunden: 96, alle: true, ...extra };
}
{
  const w = core.fensterLesen(gesetzt(34, 26, 81200, 45500), fe);
  eq(nah(w.aussen, 0.30, 0.005), true, "30 %: Anteil aussen 0,30 (" + w.aussen + ")");
  eq([w.hAussen, w.kIn, w.kAus], [26 * 45500, 81200, 45500], "30 %: Kosten mit den Staerken dieses Kampfes");
  eq(nah(w.kosten, w.hAussen * 0.785, w.hAussen * 0.785 * 0.01), true, "30 %: Kosten = H aussen x 0,785 (" + w.kosten + ")");
  eq(core.fensterUrteil(w, 34 * 81200 + 26 * 45500), true, "30 %: fensterUrteil schlaegt an");
  eq(core.fensterUrteil(w, 100e6), false, "30 %: unter 2 % des Kampfes kein Urteil");
  const elf = core.fensterLesen(gesetzt(34, 7, 81200, 45500), fe);
  eq([nah(elf.aussen, 0.10, 0.01), core.fensterUrteil(elf, 34 * 81200 + 7 * 45500)], [true, false], "11 %: kein Urteil");
  const duenn = core.fensterLesen(gesetzt(34, 10, 81200, 45500), fe);
  eq([duenn.kIn, duenn.kAus], [fe.jeIn, fe.jeAus], "unter 15 Treffern aussen: Kosten mit den Staerken des Builds");
  const umgekehrt = core.fensterLesen(gesetzt(20, 20, 40000, 70000), fe);
  eq(umgekehrt.kosten, 0, "innen schwaecher als aussen: Kosten 0, nie negativ");

  /* Issue #108: gegen den Bezugspull, nicht gegen 0 % aussen. Der beste Pull
     hatte 41 % aussen, dieser Kampf 30 % - er war besser, also kein Urteil. */
  const ges = 34 * 81200 + 26 * 45500;
  eq(core.fensterKosten(w, null), w.kosten, "fensterKosten: ohne Bezug wie bisher, gegen alles im Fenster");
  eq([core.fensterKosten(w, 0.41), core.fensterUrteil(w, ges, 0.02, 0.41)], [0, false],
    "#108: Bezug 41 % aussen, Kampf 30 % - keine Kosten, kein Urteil");
  eq(core.fensterUrteil(w, ges, 0.02, w.aussen), false, "#108: gleich viel aussen wie der Bezug - kein Urteil");
  eq(nah(core.fensterKosten(w, 0.10), w.kosten * (w.aussen - 0.10) / w.aussen, 1e-6), true,
    "#108: Bezug 10 % - Kosten nur fuer den Teil ueber dem Bezug");
  eq(core.fensterUrteil(w, ges, 0.02, 0.10), true, "#108: Bezug 10 %, Kampf 30 % - das Urteil spricht");
  eq(core.fensterUrteil(w, ges, 0.02, 0.29), false, "#108: Bezug 29 % - der Rest liegt unter 2 % des Kampfes");
  eq(core.fensterUrteil(elf, 34 * 81200 + 7 * 45500, 0.02, 0), false, "#108: unter 20 % aussen auch gegen einen Bezug mit 0 % kein Urteil");
}

// --- Gleichstand zweier Laengen: auf 1 % gilt die laengere
{
  /* H nur bei +300 ... +4300 ms nach dem Mal (innen) und ab +6300 (aussen):
     5 s und 6 s teilen genau gleich, 4 s und 7 s nicht. */
  const p = () => {
    const f = [], h = [];
    for (let t = 0; t < 96000; t += 12000) f.push([t, t + 200, 50000, 1, 0]);
    for (let t = 300; t < 96000; t += 1000) {
      const o = t % 12000;
      if (o === 5300) continue;
      h.push([t, t + 100, o < 6000 ? 100000 : 70000, 1, 0]);
    }
    return { spuren: [{ k: "H", n: "Haupt", s: "1", waffe: true, c: h }, { k: "F", n: "Mal", s: "2", waffe: true, c: f }],
      sekunden: 96, alle: true };
  };
  const w = core.fensterSuchen(Array.from({ length: 6 }, p), "H");
  eq(w && w.l, 6, "Gleichstand 5 s / 6 s: die laengere gilt");
}
// --- Gleichstand zweier Kandidaten: mehr Einsaetze gewinnt
{
  const p = () => {
    const q = gesetzt(48, 48, 100000, 70000);
    const f = q.spuren.find((x) => x.k === "F");
    // F2 setzt zu denselben Zeiten, jedes Mal doppelt: dieselbe Teilung, mehr Einsaetze
    const f2 = { k: "F2", n: "Mal zwei", s: "5", waffe: true, c: f.c.flatMap((c) => [c, [...c]]) };
    return { ...q, spuren: [q.spuren[0], f, f2] };
  };
  const w = core.fensterSuchen(Array.from({ length: 6 }, p), "H");
  eq(w && w.f, "F2", "Gleichstand zweier Kandidaten: der mit mehr Einsaetzen");
  const umgekehrt = Array.from({ length: 6 }, () => { const q = p(); return { ...q, spuren: [q.spuren[0], q.spuren[2], q.spuren[1]] }; });
  eq(core.fensterSuchen(umgekehrt, "H")?.f, "F2", "... auch in anderer Reihenfolge");
}

// --- kein Fenster
eq(core.fensterSuchen(pool(14, { inDmg: 70000 }), "H"), null, "kein Fenster: gleiche Staerke innen und aussen");
eq(core.fensterSuchen(pool(14, { inDmg: 80500, streu: 0 }), "H"), null, "kein Fenster: Gewinn 15 %");
eq(core.fensterSuchen(pool(14, { fAlle: 7000, streu: 0 }), "H"), null, "kein Fenster: Abdeckung ueber 80 % (Fueller)");
eq(core.fensterSuchen(pool(2, { hAlle: 2000, streu: 0 }), "H"), null, "kein Fenster: unter 100 Treffern je Seite");
eq(core.fensterSuchen([pull({ inDmg: 300000, streu: 0 }), ...pool(3, { inDmg: 68000, streu: 0 })], "H"), null,
  "kein Fenster: nur einer von vier Pulls zeigt den Effekt");

// --- Ventius-Familie: drei Namen, ein Schluessel
{
  const v = (n, d) => ({ k: "fam:ventius", n, s: "", waffe: true,
    c: Array.from({ length: 80 }, (_, i) => [i * 1000, i * 1000 + 50, d, 1, 0]) });
  const x = { k: "X", n: "Andere", s: "9", waffe: true, c: Array.from({ length: 80 }, (_, i) => [i * 1000, i * 1000, 50000, 1, 0]) };
  // X traegt mehr als jeder einzelne Name, weniger als die Familie
  const p = (n) => ({ spuren: [v(n, 100000), { ...x, c: x.c.map((c) => [...c]) }], sekunden: 80, alle: true });
  const drei = [p("Decisive Sniping"), p("Entschlossener Scharfschuss"), p("Eye of Ventius")];
  drei.forEach((q, i) => { q.spuren[1].c = q.spuren[1].c.map((c) => [c[0], c[1], i === 0 ? 150000 : 20000, 1, 0]); });
  eq(core.hauptschaden(drei), "fam:ventius",
    "Ventius-Familie: drei Namen sind ein Hauptschaden");
}

// --- Unverwundbar: H-Einsaetze in [von, bis + L) zaehlen auf keiner Seite
{
  const p = gesetzt(48, 48, 100000, 70000);
  const ohne = core.fensterLesen(p, fe), mit = core.fensterLesen({ ...p, aus: [{ von: 20000, bis: 30000 }] }, fe);
  eq([ohne.trefferIn + ohne.trefferAus, mit.trefferIn + mit.trefferAus], [96, 80],
    "Unverwundbar: 16 Einsaetze in [20 s, 36 s) zaehlen nicht");
}

// --- gespeicherter Bezug: F fehlt
eq(core.fensterLesen(pull({ ohneF: true, alle: false }), fe), null, "gespeichert, F nicht unter den zwoelf: unbekannt");
{
  const w = core.fensterLesen(pull({ ohneF: true, alle: true }), fe);
  eq([w.aussen, w.jeMinute, w.jeIn, w.trefferIn], [1, 0, null, 0], "im Log, F nie eingesetzt: alles aussen, 0 je Minute");
}
eq(core.fensterLesen({ spuren: [{ k: "F", n: "Mal", s: "2", waffe: true, c: [[0, 1, 1, 1, 0]] }], sekunden: 60, alle: true }, fe),
  null, "H nicht im Kampf: nichts zu lesen");

// --- Nebenziele
{
  const haupt = (z) => z === "Fellinex";
  const treffer = [];
  for (let i = 0; i < 93; i++) treffer.push({ t: i * 600, dmg: 10000, ziel: "Fellinex" });
  treffer.push({ t: 3000, dmg: 1000, ziel: "Nebenziel A" });
  for (let i = 0; i < 69; i++) treffer.push({ t: 19000 + i * 100, dmg: 1000, ziel: "Nebenziel A" });
  const n = core.nebenziele(treffer, haupt, 1000000);
  eq(n && [nah(n.anteil, 0.07, 1e-9), n.ab, n.ziele.length, n.ziele[0].ziel], [true, 19000, 1, "Nebenziel A"],
    "Nebenziel: 7 % ab 0:19, ein Streifschuss bei 0:03 verschiebt es nicht");
  const vier = treffer.filter((x) => x.ziel === "Fellinex" || x.t < 19000 + 39 * 100);
  eq(core.nebenziele(vier, haupt, 1000000 - 30000), null, "Nebenziel: 4 % bleibt ungenannt");
  const zwei = [...treffer, ...Array.from({ length: 30 }, (_, i) => ({ t: 30000 + i * 100, dmg: 1000, ziel: "Nebenziel B" }))];
  const z = core.nebenziele(zwei, haupt, 1030000);
  eq(z && [nah(z.anteil, 100 / 1030, 1e-9), z.ziele.map((x) => x.ziel), nah(z.ziele[0].anteil, 70 / 1030, 1e-9)],
    [true, ["Nebenziel A", "Nebenziel B"], true], "zwei Nebenziele: Summe, beide, das groesste zuerst");
  eq(core.nebenziele(treffer, () => true, 1000000), null, "nur Hauptziel: nichts");
}

// --- Start
{
  const reihe = (x, n = 30) => Array.from({ length: n }, (_, i) => (i < 10 ? x : 50));
  const art = (x) => core.start(reihe(x), reihe(100))?.art;
  eq([art(18), art(79), art(80), art(124), art(125)], ["schwaecher", "schwaecher", "ueblich", "ueblich", "staerker"],
    "start: unter 80 % schwaecher, ab 125 % staerker");
  const s = core.start(reihe(18), reihe(100));
  eq([s.dps, s.bezug, nah(s.q, 0.18, 1e-9)], [18, 100, true], "start: Schnitt der ersten 10 s und q");
  eq([core.start(reihe(80, 19), reihe(100)), core.start(reihe(80), reihe(100, 19)), core.start(reihe(80), reihe(0))],
    [null, null, null], "start: unter 20 s oder ohne Bezugswert nichts");
}

// --- Texte: dieselben Schluessel in beiden Sprachen (Spezifikation 6)
const tr = (lang) => (key, vars) => {
  const e = core.I18N[lang][key];
  if (e === undefined) return key;
  return typeof e === "function" ? e(vars || {}) : e;
};
{
  const KEYS = ["head.side", "head.sideMany", "analysis.side", "analysis.sideMany", "analysis.sideNoTime",
    "analysis.sideManyNoTime", "analysis.sideCounts", "analysis.sec.window", "analysis.window.foundPair",
    "analysis.window.one", "analysis.window.value", "analysis.window.bar", "analysis.window.barAlone",
    "analysis.window.in", "analysis.window.out", "analysis.window.rate", "analysis.window.ref", "analysis.window.crit",
    "analysis.window.noRefPair", "analysis.window.tiles", "analysis.call.window.value", "analysis.call.window.note", "analysis.call.window.noteRef",
    "analysis.start.label", "analysis.start.ref", "analysis.start.usual", "analysis.start.weaker",
    "analysis.start.weakerSecond", "analysis.start.stronger", "analysis.start.strongerSecond",
    "analysis.zumBeleg", "analysis.inRotation", "analysis.inRotation.luecke", "analysis.inRotation.schwach",
    "analysis.inRotation.start", "analysis.folgeRotation", "analysis.ganzerKampf",
    "analysis.ref.best", "analysis.ref.second"];
  eq(KEYS.filter((k) => core.I18N.de[k] === undefined || core.I18N.en[k] === undefined), [],
    "Texte: jeder Schluessel in DE und EN");
  const de = tr("de"), en = tr("en");
  eq(de("head.side", { p: "7\u00a0%", ziel: "Fellini", t: "0:19" }), "davon 7\u00a0% auf Fellini, ab 0:19", "DE head.side");
  eq(en("head.sideMany", { p: "12%", n: 3, ziel: "Fellini", q: "7%", t: "0:19" }),
    "12% of it on 3 other targets, most on Fellini (7%), from 0:19", "EN head.sideMany");
  // Builds-Reiter 6: ohne gespeicherten Build gilt das Waffenpaar, der Satz endet auf "mit diesen Waffen."
  eq(de("analysis.window.foundPair", { l: "6 s", f: "Detonierendes Mal", h: "Auge von Ventius", g: "43 %",
    in: "103.0k", out: "72.0k", n: 14 }),
    "Borometer hat das Fenster selbst gefunden: in den 6 s nach Detonierendes Mal trifft Auge von Ventius im Schnitt " +
    "43 % stärker (103.0k statt 72.0k) – gemessen über 14 Pulls mit diesen Waffen.", "DE analysis.window.foundPair");
  eq(de("analysis.window.noRefPair", { boss: "Fellinex" }),
    "Einen Vergleichswert gibt es ab dem zweiten Pull an Fellinex mit diesen Waffen.", "DE analysis.window.noRefPair");
  eq(de("analysis.window.bar", { p: "30\u00a0%", bp: de("analysis.ref.best"), q: "11\u00a0%" }),
    "30\u00a0% au\u00dferhalb \u00b7 bester Pull 11\u00a0%", "DE analysis.window.bar");
  eq(de("analysis.call.window.note", { dmg: "1.57M", pct: "19\u00a0%", p: "30\u00a0%", out: "45.5k", in: "81.2k" }),
    "Etwa 1.57M Schaden, 19\u00a0% des Kampfes, gerechnet, als l\u00e4ge alles im Fenster: 30\u00a0% davon lag au\u00dferhalb, und dort traf es mit 45.5k statt 81.2k.",
    "DE analysis.call.window.note: ohne Bezug sagt der Satz, wogegen er rechnet (#108)");
  eq([de("analysis.call.window.noteRef", { dmg: "680k", pct: "8\u00a0%", p: "30\u00a0%", q: "17\u00a0%", out: "45.5k", in: "81.2k" }),
      de("analysis.call.window.noteRef", { dmg: "680k", pct: "8\u00a0%", p: "30\u00a0%", q: "17\u00a0%", out: "45.5k", in: "81.2k", zweit: true }),
      en("analysis.call.window.noteRef", { dmg: "680k", pct: "8%", p: "30%", q: "17%", out: "45.5k", in: "81.2k" })],
    ["Etwa 680k Schaden, 8\u00a0% des Kampfes, gerechnet gegen deinen besten Pull: 30\u00a0% davon lag au\u00dferhalb, dort nur 17\u00a0%. Au\u00dferhalb traf es mit 45.5k statt 81.2k.",
     "Etwa 680k Schaden, 8\u00a0% des Kampfes, gerechnet gegen deinen zweitbesten Pull: 30\u00a0% davon lag au\u00dferhalb, dort nur 17\u00a0%. Au\u00dferhalb traf es mit 45.5k statt 81.2k.",
     "About 680k damage, 8% of the fight, counted against your best pull: 30% of it landed outside, there only 17%. Outside it hit for 45.5k instead of 81.2k."],
    "analysis.call.window.noteRef: mit Bezug nennt der Satz ihn und seinen Anteil (#108)");
  eq([de("analysis.start.weaker", { p: "18\u00a0%" }), de("analysis.start.weakerSecond", { p: "18\u00a0%" })],
    ["Dein Start war deutlich schw\u00e4cher: 18\u00a0% deines besten Pulls.",
     "Dein Start war deutlich schw\u00e4cher: 18\u00a0% deines zweitbesten Pulls."], "DE Start: bester und zweitbester");
  const alleDe = KEYS.map((k) => de(k, { p: "1", q: "1", n: 2, ziel: "Z", t: "0:01", dps: "1k", l: "6\u00a0s", f: "F", h: "H",
    g: "1", in: "1", out: "1", bp: "b", x: "1", a: "1", b: "1", boss: "B", dmg: "1", pct: "1" })).join(" ");
  eq(/\bBau\b|\bBaus\b/.test(alleDe), false, "DE: Build, nie Bau");
  /* Geschuetztes Leerzeichen vor % und s: die Werte kommen schon mit ihm
     (pct, "6\u00a0s"), und was der Text selbst an Einheiten traegt ("Die
     ersten 10 s"), muss es ebenso haben - nie ein gewoehnliches oder gar
     keines. */
  const alleDeWerte = KEYS.map((k) => de(k, { p: "7\u00a0%", q: "5\u00a0%", n: 2, ziel: "Z", t: "0:01", dps: "1k",
    l: "6\u00a0s", f: "F", h: "H", g: "43\u00a0%", in: "1k", out: "1k", bp: "b", x: "1k", a: "70\u00a0%", b: "60\u00a0%",
    boss: "B", dmg: "1M", pct: "2\u00a0%" })).join(" | ");
  eq(alleDeWerte.match(/\d(?: )?%|\d s\b|\ds\b/g), null, "DE: vor % und s steht das geschuetzte Leerzeichen");
  eq(de("analysis.start.label"), "Die ersten 10\u00a0s", "DE: \"Die ersten 10 s\" mit geschuetztem Leerzeichen");
}

/* Neugestaltung 28.09., Luecken 4.3 (Entwurf src.js leerzeit): eine Luecke
   sind mindestens 2 Sekunden, in denen weniger als 2 % der gewoehnlichen
   Sekunde ankam - des Medians der Sekunden mit Treffern; die ersten 3 und
   die letzten 5 Sekunden zaehlen nicht. */
{
  eq([core.median([]), core.median([5]), core.median([3, 1, 2]), core.median([4, 1, 3, 2])], [0, 5, 2, 2.5], "median: leer, eins, ungerade, gerade");
  // 20 Sekunden zu 100; 5-7 leer (3 s), 9 leer (1 s: keine Luecke), 11-12 je 1 (unter 2 % von 100), 0-2 leer, 16-19 leer
  const sek = Array.from({ length: 20 }, (_, i) => [0, 1, 2, 5, 6, 7, 9, 16, 17, 18, 19].includes(i) ? 0 : [11, 12].includes(i) ? 1 : 100);
  const l = core.luecken(sek);
  eq({ median: l.median, grenze: l.grenze, luecken: l.luecken, summe: l.summe, laengste: l.laengste },
     { median: 100, grenze: 2, luecken: [[5, 8], [11, 13]], summe: 5, laengste: [5, 8] },
     "luecken: 5-8 und 11-13; nicht die eine Sekunde, nicht die ersten 3, nicht die letzten 5");
  eq(core.luecken(sek, sek.map((_, i) => i >= 5 && i < 8)).luecken, [[11, 13]], "luecken: Sekunden mit unverwundbarem Ziel sind keine Luecke");
  eq(core.luecken(sek.map((v, i) => i === 11 ? 2 : v)).luecken, [[5, 8]], "luecken: genau 2 % ist keine Luecke mehr (weniger als 2 %)");
  eq(core.luecken(new Array(20).fill(0)), { median: 0, grenze: 0, luecken: [], summe: 0, laengste: null }, "luecken: ohne Treffer keine Luecke");
  // der Median nur ueber Sekunden mit Treffern: viele leere Sekunden ziehen ihn nicht herunter
  eq(core.luecken([0, 0, 0, 10, 0, 0, 0, 0, 30, 20, 0, 0, 0, 0, 0]).median, 20, "luecken: Median der Sekunden mit Treffern");
  eq(core.jeMinute(30, 60, 10), { mit: 30, ohne: 36 }, "jeMinute: mit und ohne die Luecken");
  eq(core.jeMinute(30, 60, 60), { mit: 30, ohne: null }, "jeMinute: ohne Zeit ausserhalb der Luecken keine Rate");
}

/* Issue #105: die schwaechste Stelle zaehlt erst unter dem halben Median
   (Entscheidung vom 04.10.2026) - im Eintrag wie im Urteil. Die Faelle aus der
   Kritik: 84.8k bei einem Median von 84.8k, 51.7k bei 45.0k. */
{
  eq(core.SCHWACH_ANTEIL, 0.5, "schwacheStelle: Grenze 50 %");
  eq([core.schwacheStelle(84800, 84800), core.schwacheStelle(51700, 45000)], [false, false],
    "schwacheStelle: auf oder ueber dem Median keine schwache Stelle");
  eq([core.schwacheStelle(30000, 45000), core.schwacheStelle(22500, 45000), core.schwacheStelle(22000, 45000)], [false, false, true],
    "schwacheStelle: erst unter dem halben Median");
  eq([core.schwacheStelle(0, 0), core.schwacheStelle(10, 0)], [false, false], "schwacheStelle: ohne Median nie");
}

/* Issue #106: der Haelftenvergleich erst ab dem 1,15-fachen - "dem
   1,0-fachen der ersten" ist keine Aussage. */
{
  const gleich = Array.from({ length: 60 }, () => 1000);
  eq(core.HAELFTE_AB, 1.15, "haelften: Grenze 1,15");
  eq(core.haelften(gleich), null, "haelften: 1,0-fach - kein Satz");
  eq(core.haelften([...Array(30).fill(1000), ...Array(30).fill(1140)]), null, "haelften: 1,14-fach - kein Satz");
  eq(core.haelften([...Array(30).fill(1000), ...Array(30).fill(1200)]), { erste: 1000, zweite: 1200, x: 1.2, staerker: "zweite" },
    "haelften: 1,2-fach - die zweite ist staerker");
  eq(core.haelften([...Array(30).fill(1500), ...Array(30).fill(1000)]), { erste: 1500, zweite: 1000, x: 1.5, staerker: "erste" },
    "haelften: die erste ist staerker");
  eq(core.haelften([...Array(31).fill(1000), ...Array(30).fill(2000)]).erste, 1000, "haelften: ungerade Zahl - die erste Haelfte ist die kleinere");
  eq([core.haelften([]), core.haelften([0, 0, 0, 5000]), core.haelften([5000])], [null, null, null], "haelften: eine leere Haelfte - kein Satz");
}

/* aus test-trainer-core.mjs, Neugestaltung 28.09.: der Trainer entfaellt
   (Spezifikation 3); der leise Befund der Analyse (insight.invulnCasts)
   bleibt - beide Sprachen, mehrere Teile. */
{
  const zwei = { teile: [{ n: 2, skill: "A" }, { n: 1, skill: "B" }], n: 3, from: "0:57", to: "1:04" };
  const eins = { teile: [{ n: 1, skill: "A" }], n: 1, from: "0:57", to: "0:57" };
  const drei = { teile: [{ n: 2, skill: "A" }, { n: 1, skill: "B" }, { n: 1, skill: "C" }], n: 4, from: "0:57", to: "1:04" };
  eq([tr("de")("insight.invulnCasts.value", zwei), tr("de")("insight.invulnCasts.value", eins), tr("de")("insight.invulnCasts.value", drei)], [
    "2 Eins\u00e4tze von A und 1 von B gingen ins unverwundbare Ziel (0:57\u20131:04).",
    "1 Einsatz von A ging ins unverwundbare Ziel (0:57).",
    "2 Eins\u00e4tze von A, 1 von B und 1 von C gingen ins unverwundbare Ziel (0:57\u20131:04).",
  ], "invulnCasts DE: Einzahl, Mehrzahl, Liste");
  eq([tr("en")("insight.invulnCasts.value", zwei), tr("en")("insight.invulnCasts.value", eins)], [
    "2 casts of A and 1 of B went into the invulnerable target (0:57\u20131:04).",
    "1 cast of A went into the invulnerable target (0:57).",
  ], "invulnCasts EN: Einzahl, Mehrzahl, Liste");
}

/* aus test-abend-core.mjs, Neugestaltung 28.09.: der Abend entfaellt
   (Spezifikation 3); das Bild (50-bild.ts, bild.*) bleibt - was vor dem
   Kopieren im Bild steht, kein Satz rangiert von unten, jeder Satz in
   beiden Sprachen. */
{
  eq(tr("de")("bild.inBoard", { boss: "Vulcanus", namen: "Aelira, Borin" }),
     "Im Bild: Vulcanus, die Gruppentafel mit den Charakternamen Aelira, Borin.", "vor dem Kopieren: was im Bild ist");
  const texte = ["de", "en"].flatMap((l) => Object.entries(core.I18N[l]).filter(([k]) => /^bild\./.test(k))
    .map(([, v]) => (typeof v === "function" ? v({ tag: "1", n: 2, name: "X", boss: "V", jetzt: "1", vorher: "1", plus: "1", namen: "X", rows: 3 }) : v)));
  eq(texte.length > 0 && texte.filter((s) => /schw(a|\u00e4)ch|schlecht|worst|weak|lowest|Rangliste der/i.test(s)).length, 0,
     "bild: kein Satz nennt Schwaechste oder Schlechteste");
  eq(Object.keys(core.I18N.en).filter((k) => /^bild\./.test(k)).sort(),
     Object.keys(core.I18N.de).filter((k) => /^bild\./.test(k)).sort(), "bild: jeder Satz in beiden Sprachen");
}

console.log(failed ? "\n" + failed + " FAILED" : "\nall passed");
process.exit(failed ? 1 : 0);
