// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die Mechanik-Erkennung, erster Schritt (src/renderer/mechanik-core.ts,
// Spezifikation docs/superpowers/specs/2026-10-01-mechanik-design.md,
// Abschnitte 2 und 5), ohne Seite: esbuild buendelt den Kern allein - er
// importiert nichts -, Node fuehrt ihn aus. Die Pulls sind erzeugt, mit
// festem Samen, und tragen nur Zeiten und Zahlen - keine Namen, keine Logs.
//
// Run:  npm run test:mechanik-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = await esbuild.build({
  stdin: {
    contents: 'export * from "./mechanik-core"; export { I18N } from "./app/07-dictionary";',
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
let seed = 20261001;
const zufall = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/* Ein Pull wie am Boss gemessen (Machbarkeitsbericht 01.10., reduziert auf
   Zahlen): rund zehn Treffer je Sekunde, die meisten klein (Ticks, 200 bis
   900), der erste jeder Sekunde und sonst jeder fuenfte gross (20k bis
   80k) - im Mittel rund 15k je Treffer.
   art "panzer": ab beginn fuer dauer Sekunden laufen die Treffer weiter
   (14 je Sekunde), landen aber nur mit 50 bis 400. art "stille": in der
   Strecke kommt fast nichts an (ein kleiner Treffer je Sekunde). art
   "ticks": in der Strecke treffen nur die eigenen kleinen Ticks (14 je
   Sekunde, 200 bis 900 wie ueberall) - der eigene Build, nicht der Boss.
   Jeder Treffer traegt seine Faehigkeit (k): "gross" oder "tick". */
function pull({ secs = 70, beginn = 24, dauer = 6, art = "panzer" } = {}) {
  const treffer = [];
  for (let s = 0; s < secs; s++) {
    const drin = art !== "ohne" && s >= beginn && s < beginn + dauer;
    const n = drin ? (art === "stille" ? 1 : 14) : 8 + Math.floor(zufall() * 5);
    for (let k = 0; k < n; k++) {
      const t = s + (k + zufall() * 0.9) / n;
      if (drin && art === "ticks") { treffer.push({ t, dmg: 200 + Math.round(zufall() * 700), k: "tick" }); continue; }
      const dmg = drin ? 50 + Math.round(zufall() * 350)
        : k === 0 || zufall() < 0.2 ? 20000 + Math.round(zufall() * 60000) : 200 + Math.round(zufall() * 700);
      treffer.push({ t, dmg, k: (drin ? k === 0 : dmg >= 20000) ? "gross" : "tick" });
    }
  }
  return { treffer, sekunden: secs };
}

/* Ein fester Pull ohne Zufall, fuer die Grenzwerte: jede Sekunde zehn
   Treffer, einer "gross" (100000) und neun "tick" (1000). In den Sekunden
   von "weich" landen sie mit x (dieselben Faehigkeiten), in "nur" nur die
   neun Ticks mit x, und in "bruecke" ein einzelner grosser Treffer mit 5000. */
function fest({ secs = 60, weich = [], nur = [], bruecke = [], x = 300 }) {
  const treffer = [];
  for (let s = 0; s < secs; s++) {
    if (bruecke.includes(s)) { treffer.push({ t: s + 0.5, dmg: 5000, k: "gross" }); continue; }
    const w = weich.includes(s), n = nur.includes(s);
    for (let k = 0; k < 10; k++) {
      if (n && k === 0) continue;
      const gross = k === 0;
      treffer.push({ t: s + k / 10, dmg: w || n ? x : gross ? 100000 : 1000, k: gross ? "gross" : "tick" });
    }
  }
  return { treffer, sekunden: secs };
}
/* x so, dass der Schaden je Treffer in der Strecke genau a des Mittels je
   Treffer des ganzen Pulls ist (das Mittel enthaelt die Strecke selbst). */
function xFuer(a, secs, L) {
  const No = 10 * (secs - L), O = 109000 * (secs - L), Ni = 10 * L;
  return a * O / (No + Ni - a * Ni);
}
const von = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const reihe = (n, f) => Array.from({ length: n }, (_, i) => f(i));

console.log("Strecken eines Pulls");
{
  const p = pull({ beginn: 24, dauer: 6 });
  const st = core.kaumSchaden(p);
  eq(st.length, 1, "Panzerstrecke: genau eine Strecke");
  eq(st[0] && [st[0].von, st[0].bis], [24, 30], "Panzerstrecke: 0:24 bis 0:30");
  eq(core.kaumSchaden(pull({ art: "ohne" })).length, 0, "ohne Panzer: keine Strecke");
  eq(core.kaumSchaden(pull({ art: "stille", dauer: 25, beginn: 40 })).length, 0, "Stille (kaum Treffer): keine Strecke");
  eq(core.kaumSchaden(pull({ dauer: 2 })).length, 0, "zwei Sekunden sind zu kurz (mindestens drei)");
  eq(core.kaumSchaden({ treffer: [], sekunden: 0 }), [], "leerer Pull: nichts");
}

console.log("Vulcanus-Muster: 11 von 11 Pulls");
{
  const starts = [21, 24, 26, 23, 25, 22, 24, 27, 23, 24, 25];
  const dauern = [6, 5, 7, 6, 13, 6, 5, 6, 7, 6, 6];
  const pulls = starts.map((b, i) => pull({ beginn: b, dauer: dauern[i] }));
  const m = core.mechaniken(pulls);
  eq(m.length, 1, "eine Mechanik");
  const x = m[0] || {};
  eq([x.mit, x.pulls], [11, 11], "in 11 von 11 Pulls");
  eq(nah(x.beginn, 24, 0.5), true, "Beginn im Median 0:24 (" + x.beginn + ")");
  eq(nah(x.dauer, 6, 0.5), true, "Dauer im Median 6 s (" + x.dauer + ")");
  eq([x.dauerVon, x.dauerBis], [5, 13], "Spanne der Dauer 5 bis 13 s");
  eq(x.strecken && x.strecken.map((s) => s && s.von), starts, "je Pull die eigene Strecke");
  // die Strecke im gerade offenen Pull
  const s = core.streckeIn(pulls[4], x);
  eq(s && [s.von, s.bis], [25, 38], "streckeIn: die Strecke dieses Pulls");
  eq(core.streckeIn(pull({ art: "ohne" }), x), null, "streckeIn: ein Pull ohne Strecke hat keine");
  eq(core.streckeIn(pull({ beginn: 50 }), x), null, "streckeIn: eine Strecke ausserhalb der Streuung zaehlt nicht");
}

console.log("Zerfallene Strecke: beide Stuecke gehoeren zur Mechanik");
{
  // folgt Pruefung 01.10., N2: das Fenster endet bei Beginn + laengster Dauer; ein Pull dauert darum 12 s
  const pulls = [21, 24, 26, 23, 25].map((b, i) => pull({ beginn: b, dauer: i === 4 ? 12 : 6 }));
  const m = core.mechaniken(pulls)[0];
  eq(m && [m.beginn, m.dauerBis], [24, 12], "Beginn 0:24, laengste Dauer 12 s");
  // 24-30 kaum Schaden, 30-34 voller Schaden, 34-40 wieder kaum: zwei Stuecke
  const a = pull({ beginn: 24, dauer: 6, secs: 70 }), b = pull({ beginn: 34, dauer: 6, secs: 70 });
  const zwei = { sekunden: 70, treffer: [...a.treffer.filter((h) => h.t < 34), ...b.treffer.filter((h) => h.t >= 34)] };
  eq(core.kaumSchaden(zwei).map((s) => [s.von, s.bis]), [[24, 30], [34, 40]], "zwei Stuecke mit vollem Schaden dazwischen");
  eq(m && core.streckenIn(zwei, m).map((s) => [s.von, s.bis]), [[24, 30], [34, 40]], "streckenIn: beide im Fenster der Mechanik");
  const spaet = { sekunden: 90, treffer: [...a.treffer, ...pull({ beginn: 75, dauer: 6, secs: 90 }).treffer.filter((h) => h.t >= 70)] };
  eq(core.kaumSchaden(spaet).map((s) => [s.von, s.bis]), [[24, 30], [75, 81]], "spaeter Pull: zwei Strecken, die zweite bei 1:15");
  eq(m && core.streckenIn(spaet, m).map((s) => [s.von, s.bis]), [[24, 30]], "streckenIn: eine Strecke weit hinter dem Fenster zaehlt nicht");
  // ein Stueck ab 0:37 liegt hinter Beginn + laengster Dauer (0:36), wenn auch unter + 8 s
  const c = pull({ beginn: 37, dauer: 6, secs: 70 });
  const knapp = { sekunden: 70, treffer: [...a.treffer.filter((h) => h.t < 37), ...c.treffer.filter((h) => h.t >= 37)] };
  eq(core.kaumSchaden(knapp).map((s) => [s.von, s.bis]), [[24, 30], [37, 43]], "zwei Stuecke, das zweite ab 0:37");
  eq(m && core.streckenIn(knapp, m).map((s) => [s.von, s.bis]), [[24, 30]], "streckenIn: ab Beginn + laengster Dauer zaehlt nichts mehr");
}

console.log("Ein Pull, der nicht mitzaehlt, nimmt nichts aus (Pruefung 01.10., N2)");
{
  // fuenf Pulls ab 0:24 (einer 14 s lang: das Fenster reicht bis 0:38), der sechste ab 0:34 -
  // 10 s neben dem Median, also nicht "mit", aber im Fenster
  const pulls = [24, 24, 23, 25, 24, 34].map((b, i) => pull({ beginn: b, dauer: i === 0 ? 14 : 6 }));
  const m = core.mechaniken(pulls)[0];
  eq(m && [m.mit, m.pulls, m.strecken[5]], [5, 6, null], "5 von 6, der sechste steht als null");
  eq(m && core.streckenIn(pulls[5], m, 5), [], "streckenIn: im sechsten Pull nichts");
  eq(m && core.streckenIn(pulls[5], m), [], "streckenIn ohne Stelle: ebenso nichts");
  eq(m && core.streckenIn(pulls[0], m, 0).map((s) => [s.von, s.bis]), [[24, 38]], "streckenIn: im ersten die Strecke");
}

console.log("Eigener Build: nur eigene kleine Ticks, keine Mechanik (Pruefung 01.10., H1)");
{
  // bei 0:11 fuer 5 s treffen nur Ticks, die ueberall klein sind - in 6 von 6 Pulls
  const pulls = reihe(6, () => pull({ art: "ticks", beginn: 11, dauer: 5 }));
  eq(core.mechaniken(pulls), [], "Ticks bei 0:11 in 6 von 6 Pulls: nichts");
  eq(core.kaumSchaden(pulls[0]), [], "Ticks allein sind keine Strecke");
  const anteil = core.eigenerAnteil(pulls[0].treffer, 11, 16);
  eq(anteil > 0.6, true, "je Faehigkeit landen die Ticks wie ueberall (" + anteil.toFixed(2) + ")");
  // derselbe Pull mit Panzer: jede Faehigkeit landet weit unter ihrem eigenen Mittel
  const p = pull({ beginn: 11, dauer: 5 });
  eq(core.eigenerAnteil(p.treffer, 11, 16) < 0.1, true, "Panzer: je Faehigkeit weit unter dem eigenen Mittel");
  eq(core.eigenerAnteil([{ t: 12, dmg: 5, k: "nur-drin" }, { t: 30, dmg: 9000, k: "nur-draussen" }], 11, 16), 1,
    "keine Faehigkeit drinnen und draussen: zaehlt nicht");
}

console.log("Grenzwerte (Pruefung 01.10., M2)");
{
  const w = von(20, 26);
  const st = (a) => core.kaumSchaden(fest({ weich: w, x: xFuer(a, 60, 6) })).map((s) => [s.von, s.bis]);
  eq(st(0.09), [[20, 26]], "9 % des Mittels je Treffer: Strecke");
  eq(st(0.12), [], "12 % des Mittels je Treffer: keine Strecke");
  // je Faehigkeit: nur Ticks (eigenes Mittel 1000) landen mit 240 oder 260
  const eig = (x) => core.kaumSchaden(fest({ nur: w, x })).map((s) => [s.von, s.bis]);
  eq(eig(240), [[20, 26]], "Ticks mit 24 % ihres eigenen Mittels: Strecke");
  eq(eig(260), [], "Ticks mit 26 % ihres eigenen Mittels: keine Strecke");
  // Bruecke: zwei Sekunden mit einem vollen Treffer dazwischen halten zusammen, drei nicht
  const br = (b) => core.kaumSchaden(fest({ weich: [...von(20, 26), ...von(26 + b, 32 + b)], bruecke: von(26, 26 + b) }))
    .map((s) => [s.von, s.bis]);
  eq(br(2), [[20, 34]], "2 s dazwischen: eine Strecke");
  eq(br(3), [[20, 26], [29, 35]], "3 s dazwischen: zwei Strecken");
  // Mittel statt Median: der Median je Treffer ist ein Tick (1000), 300 liegen darueber
  const tick = fest({ weich: w, x: 300 });
  const med = core.mMedian(tick.treffer.map((h) => h.dmg));
  eq(300 > 0.10 * med, true, "mit dem Median (" + med + ") laege die Strecke ueber der Grenze");
  eq(core.kaumSchaden(tick).map((s) => [s.von, s.bis]), [[20, 26]], "mit dem Mittel: Strecke gefunden");
}

console.log("Voellige Stille: keine Mechanik");
{
  const pulls = reihe(6, (i) => pull({ art: "stille", beginn: 66 + i, dauer: 25, secs: 140 }));
  eq(core.mechaniken(pulls), [], "Stille in 6 von 6 Pulls wird nicht erkannt");
}

console.log("Zu wenige Pulls: nichts");
{
  const pulls = reihe(4, () => pull({ beginn: 24 }));
  eq(core.mechaniken(pulls), [], "4 Pulls mit Strecke: nichts");
  eq(core.mechaniken(reihe(5, () => pull({ beginn: 24 }))).length, 1, "5 Pulls mit Strecke: erkannt");
  eq(core.mechaniken([]), [], "keine Pulls: nichts");
}

console.log("Streuender Beginn ueber +-8 s: nichts");
{
  const pulls = [8, 18, 28, 38, 48, 58].map((b) => pull({ beginn: b, secs: 80 }));
  eq(core.mechaniken(pulls), [], "Beginn 0:08 bis 0:58: nichts");
  // 8 s um den Median gelten noch, 9 s nicht mehr
  const rand = [16, 24, 24, 24, 24, 32].map((b) => pull({ beginn: b }));
  eq(core.mechaniken(rand).map((m) => m.mit), [6], "genau 8 s um den Median: noch dabei");
  const drueber = [15, 24, 24, 24, 33].map((b) => pull({ beginn: b }));
  eq(core.mechaniken(drueber), [], "9 s um den Median in 2 von 5: nur 3 von 5, nichts");
}

console.log("79 % gegen 80 %");
{
  // 15 von 19 sind 78,9 %, 16 von 20 sind 80 %
  const neunzehn = reihe(19, (i) => pull({ beginn: 24, art: i < 15 ? "panzer" : "ohne" }));
  eq(core.mechaniken(neunzehn), [], "15 von 19 (79 %): nichts");
  const zwanzig = reihe(20, (i) => pull({ beginn: 24, art: i < 16 ? "panzer" : "ohne" }));
  const m = core.mechaniken(zwanzig);
  eq(m.map((x) => [x.mit, x.pulls]), [[16, 20]], "16 von 20 (80 %): erkannt");
  eq(m[0] && m[0].strecken.filter((s) => s === null).length, 4, "die vier Pulls ohne Strecke stehen als null");
}

console.log("Texte DE/EN");
{
  const keys = (l) => Object.keys(core.I18N[l]).filter((k) => /^mechanik\./.test(k)).sort();
  eq(keys("de").length > 0, true, "es gibt Texte zur Mechanik");
  eq(keys("en"), keys("de"), "jeder Text in beiden Sprachen");
  const satz = core.I18N.de["mechanik.zeile"];
  // folgt Pruefung 01.10., N1: ohne Zuschreibung an den Boss, die Dauer als Spanne;
  // Feinschliff 02.10., Abschnitt 3: "machen ... kaum Schaden" statt "landen ... kaum Schaden"
  const de = typeof satz === "function" ? satz({ boss: "Vulcanus", ab: "0:15", s: "5\u201325\u00a0s", mit: 11, n: 11 }) : satz;
  eq(de, "Vulcanus: Ab etwa 0:15 machen deine Treffer 5\u201325\u00a0s lang kaum Schaden (in 11 von 11 deiner geladenen Pulls).",
    "die Zeile wie in der Spezifikation");
  const en = core.I18N.en["mechanik.zeile"];
  const enTxt = typeof en === "function" ? en({ boss: "Vulcanus", ab: "0:15", s: "5\u201325\u00a0s", mit: 11, n: 11 }) : en;
  eq(enTxt, "Vulcanus: from about 0:15, your hits do hardly any damage for 5\u201325\u00a0s (in 11 of 11 of your loaded pulls).",
    "die Zeile auf Englisch");
  eq([de, enTxt].filter((x) => /nimmt|takes/.test(x)), [], "kein Satz schreibt dem Boss etwas zu");
  const nicht = core.I18N.de["mechanik.nichtGezaehlt"];
  eq(typeof nicht === "function" ? nicht({ zeiten: "0:24\u20130:30" }) : nicht,
    "0:24\u20130:30 nicht mitgezählt: Mechanik", "der Satz zu den Luecken wie in der Spezifikation");
  const alle = ["de", "en"].flatMap((l) => keys(l).map((k) => { const v = core.I18N[l][k];
    return typeof v === "function" ? v({ boss: "B", ab: "0:24", s: "6 s", mit: 5, n: 6, zeiten: "0:24" }) : v; }));
  eq(alle.filter((s) => /schlecht|schwach|fehler|verlier|bad|weak|poor|lose|mistake/i.test(s)), [], "kein Satz wertet");
}

console.log(failed ? "\n" + failed + " FAILED" : "\nall passed");
process.exit(failed ? 1 : 0);
