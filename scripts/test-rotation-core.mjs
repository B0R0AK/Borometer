// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die reinen Funktionen von "Deine Rotation" (src/renderer/rotation-core.ts),
// ohne Seite: esbuild buendelt die eine Datei - sie importiert nur Typen -,
// Node fuehrt sie aus.
//
// Run:  npm run test:rotation-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = await esbuild.build({
  entryPoints: [join(root, "src", "renderer", "rotation-core.ts")],
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
const map = (m) => [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));

// ---------- automatisch (Spezifikation 6.1) ----------
const sk = (k, grund = null) => ({ k, grund });
const skills = [sk("viper", "passiv"), sk("mark", "markiert"), sk("liste", "liste"), sk("ventius"), sk("basic")];
eq(map(core.automatisch(skills, {})), [
  ["liste", { grund: "liste", fest: false }],
  ["mark", { grund: "markiert", fest: false }], ["viper", { grund: "passiv", fest: false }],
], "automatisch: jeder Grund schlaegt vorlaeufig vor, ohne Grund bleibt drin (Ventius)");
eq(map(core.automatisch(skills, { viper: 1, mark: 2, liste: 0 })), [
  ["liste", { grund: "liste", fest: false }],
  ["viper", { grund: "passiv", fest: true }],
], "automatisch: 1 macht fest, 2 holt zurueck, 0 ist wie ohne Wahl");
eq(map(core.automatisch(skills, { basic: 1, ventius: 2 })).filter(([k]) => k === "basic" || k === "ventius"),
   [["basic", { grund: "hand", fest: true }]], "automatisch: von Hand weggelassen ohne Grund heisst hand");
eq(map(core.automatisch(skills, { fremd: 1 })).some(([k]) => k === "fremd"), false,
   "automatisch: eine Wahl fuer eine Faehigkeit, die im Kampf fehlt, zeigt nichts");

// ---------- folge (Spezifikation 6.1, 5.3) ----------
const e = (k, t, ende = t) => ({ k, t, ende });
const einsaetze = [e("a", 3000), e("viper", 500), e("a", 0, 400), e("b", 1000, 1200), e("viper", 1500), e("c", 5500), e("a", 7400), e("b", 9500, 9600)];
const f = core.folge(einsaetze, new Set(["viper"]));
eq(f.gedrueckt.map((x) => x.k + "@" + x.t), ["a@0", "b@1000", "a@3000", "c@5500", "a@7400", "b@9500"], "folge: gedrueckt, nach der Zeit");
eq(f.auto.map((x) => x.k + "@" + x.t), ["viper@500", "viper@1500"], "folge: die automatischen fuer die Punktreihe");
eq(f.stille, [{ von: 3000, bis: 5500 }, { von: 7400, bis: 9500 }],
   "folge: Stille ab 2 s nach dem Ende des letzten Einsatzes; 1,8 s (1,2 s bis 3,0 s) ist keine");
const lang = core.folge([e("a", 0, 4000), e("b", 1000), e("c", 5500)], new Set());
eq(lang.stille, [], "folge: ein Einsatz, der noch trifft, laesst keine Stille zu (Ende 4,0 s, naechster 5,5 s)");
eq(core.folge([], new Set()).stille, [], "folge: ohne Einsatz keine Stille");

eq(map(core.automatisch([sk("toString"), sk("constructor", "passiv")], {})), [["constructor", { grund: "passiv", fest: false }]],
   "automatisch: toString ohne Wahl bleibt drin, constructor mit Grund vorlaeufig draussen");
eq([core.wahlVon({ a: 2 }, "a"), core.wahlVon({}, "toString"), core.wahlVon({}, "constructor")], [2, undefined, undefined],
   "wahlVon: nur eigene Schluessel");

// ---------- etagen (wie die Leiste, Spezifikation 5.3) ----------
eq(core.etagen([20, 30, 40, 50, 100], 32, 3, 3), [0, 1, 2, -1, 0], "etagen: drei Etagen, was nicht passt, bleibt Strich");
eq(core.etagen([20, 55, 90], 32, 3, 3), [0, 0, 0], "etagen: mit 3 px Luft passt es in eine Etage");

// ---------- Stufe 2: Abspielen (Spezifikation 5.5) ----------
eq([core.uhrZehntel(0, ","), core.uhrZehntel(13850, ","), core.uhrZehntel(59999, ","), core.uhrZehntel(61050, ","),
    core.uhrZehntel(13850, "."), core.uhrZehntel(-40, ",")],
   ["0:00,0", "0:13,8", "0:59,9", "1:01,0", "0:13.8", "0:00,0"], "uhrZehntel: abgerundet auf Zehntel, Komma oder Punkt");

const ohne = core.abspielUhr([]);
eq([ohne.spiel(0), ohne.spiel(12345), ohne.kampf(777)], [0, 12345, 777], "abspielUhr: ohne Stille ist Spielzeit Kampfzeit");
eq(core.abspielUhr([{ von: 1000, bis: 3500 }]).spiel(5000), 5000, "abspielUhr: 2,5 s Stille laeuft in Echtzeit");
const u1 = core.abspielUhr([{ von: 1000, bis: 5300 }]);
eq([u1.spiel(1000), u1.spiel(5300), u1.spiel(8000), u1.kampf(2000), u1.kampf(1500)], [1000, 2000, 4700, 5300, 3150],
   "abspielUhr: 4,3 s Stille dauert 1 s, gleichmaessig");
const u2 = core.abspielUhr([{ von: 2000, bis: 12000 }, { von: 15000, bis: 20000 }]);
eq([u2.spiel(12000), u2.spiel(15000), u2.spiel(20000), u2.spiel(25000)], [3000, 6000, 7000, 12000], "abspielUhr: zwei lange Stillen zusammen");
let hin = true, mono = true, vor = -1;
for (let x = 0; x <= 26000; x += 1300) {
  if (Math.abs(u2.kampf(u2.spiel(x)) - x) > 1e-6) hin = false;
  if (u2.spiel(x) < vor) mono = false;
  vor = u2.spiel(x);
}
eq([hin, mono], [true, true], "abspielUhr: kampf(spiel(x)) = x, monoton");
eq([core.weiter(ohne, 4000, 1000, 0.5), core.weiter(ohne, 4000, 1000, 1), core.weiter(ohne, 4000, 1000, 2)], [4500, 5000, 6000],
   "weiter: 1 s Echtzeit ist bei 0,5x/1x/2x 0,5/1/2 s Kampfzeit");
eq(Math.round(core.weiter(u1, 1000, 500, 1)), 3150, "weiter: in der gestauchten Stille 4,3-mal so schnell");

const ts = [0, 400, 1000, 1000, 2500];
eq([core.einsatzBei(ts, -1), core.einsatzBei(ts, 0), core.einsatzBei(ts, 399), core.einsatzBei(ts, 1000), core.einsatzBei(ts, 2000), core.einsatzBei(ts, 9e9), core.einsatzBei([], 5)],
   [-1, 0, 0, 3, 3, 4, -1], "einsatzBei: der letzte Einsatz, der schon begonnen hat");
// etagenFort: stueckweise gleich wie am Stueck - die Grundlage des Anhaengens unter Live
let samen = 7;
const zufall = () => (samen = (samen * 16807) % 2147483647) / 2147483647;
const xs = [];
for (let x = 20, i = 0; i < 40; i++) xs.push(x += 2 + zufall() * 24);
const ganz = core.etagen(xs, 32, 3, 3);
let stueckGleich = true;
for (let cut = 0; cut <= xs.length; cut++) {
  const platz = [-1e9, -1e9, -1e9];
  const a = core.etagenFort(xs.slice(0, cut), 32, 3, platz), b = core.etagenFort(xs.slice(cut), 32, 3, platz);
  if (JSON.stringify([...a, ...b]) !== JSON.stringify(ganz)) stueckGleich = false;
}
eq([stueckGleich, ganz.includes(-1), ganz.includes(2)], [true, true, true], "etagenFort: an jeder Schnittstelle gleich wie am Stueck (mit Strich und dritter Etage)");

// ---------- die Zeitleiste: der ganze Kampf auf der Breite (Neugestaltung 28.09.) ----------
/* Der Massstab nach dem Median-Abstand, das Mitrollen und die Folge mit
   Durchgaengen entfallen (Spezifikation 3); an ihre Stelle tritt die Dauer,
   die die Leiste zeigt. Proben vom Branch claude/entwurf-angleichung. */
eq([core.leistenDauer(69000, null, false), core.leistenDauer(69000, 90000, false)], [69000, 69000],
   "leistenDauer: steht der Kampf, gilt genau seine Dauer - der ganze Kampf auf der Breite");
eq([core.leistenDauer(6000, null, true), core.leistenDauer(30000, null, true), core.leistenDauer(58000, 60000, true), core.leistenDauer(61000, 60000, true),
    core.leistenDauer(100000, 90000, true), core.leistenDauer(40000, 150000, true)],
   [60000, 60000, 60000, 120000, 180000, 60000],
   "leistenDauer: unter Live mindestens eine Minute, sonst mit Vorlauf (x1,5, auf die Minute); sie bleibt, solange der Kampf hineinpasst - dann wird nur angehaengt");
// ---------- Takt der Einsaetze (Feld "Einsaetze", Luecken 3.7) ----------
/* Proben vom Branch claude/entwurf-angleichung (Neugestaltung 28.09.,
   Aufgabe 4). */
eq(typeof core.takt, "function", "takt: der Kern rechnet das Feld Einsaetze");
if (typeof core.takt === "function") {
  const ein = (k, t, treffer = 1) => ({ k, t, treffer });
  const z = core.takt([ein("B", 3000, 2), ein("A", 0, 1), ein("A", 20000, 3), ein("B", 1000, 4), ein("A", 10000, 2), ein("C", 5000, 1),
    ein("B", 2000, 3)], 60000);
  eq(z.map((r) => [r.k, r.n, r.jeMinute, r.abstand, r.trefferJe, r.ts]), [
    ["A", 3, 3, 10000, 2, [0, 10000, 20000]],
    ["B", 3, 3, 1000, 3, [1000, 2000, 3000]],
    ["C", 1, 1, null, 1, [5000]],
  ], "takt: je Faehigkeit Einsaetze, je Minute, O Abstand, Treffer je Einsatz und Zeitpunkte; nach Einsaetzen, bei Gleichstand der fruehere zuerst");
  const k = core.takt([ein("A", 0), ein("A", 15000), ein("A", 30000)], 30000);
  eq([k[0].jeMinute, k[0].abstand], [6, 15000], "takt: je Minute auf die Kampfdauer gerechnet (3 in 30 s = 6 je Minute)");
  eq(core.takt([], 60000), [], "takt: ohne Einsaetze keine Zeile");
  eq(core.takt([ein("A", 0)], 0)[0].jeMinute > 0, true, "takt: ein Kampf ohne Dauer teilt nicht durch null");
}
const u3 = core.abspielUhr([{ von: 1000, bis: 3500 }], 1000);
eq([u3.spiel(3500), u3.spiel(5000), core.abspielUhr([{ von: 1000, bis: 3500 }]).spiel(3500)], [2000, 3500, 3500],
   "abspielUhr: mit der Schwelle 1 s dauert auch eine Pause von 2,5 s nur 1 s");
// ---------- stilleVor (Aufgabe 11, Nachtrag 29.09.) ----------
/* aus test-rotation-core.mjs vor der Neugestaltung (6b72131): die Reihenfolge ist zurueck, und mit ihr die
   Stille an ihrer Stelle in der Reihe - vor dem ersten Einsatz danach. */
{
  const m = core.stilleVor([0, 700, 5000, 6000, 8500], [{ von: 700, bis: 5000 }, { von: 6000, bis: 8500 }]);
  eq([...m.entries()].map(([i, s]) => [i, s.bis - s.von]), [[2, 4300], [4, 2500]], "stilleVor: die Pause gehoert vor den ersten Einsatz danach");
  eq([...core.stilleVor([0, 700, 5000], [{ von: 700, bis: 4000 }]).keys()], [2], "stilleVor: auch, wenn der Einsatz am Ende der Stille fehlt (ausgeschaltet)");
  eq([...core.stilleVor([0, 700], [{ von: 700, bis: 4000 }]).keys()], [], "stilleVor: nach dem letzten Einsatz keine");
  eq([...core.stilleVor([], [{ von: 700, bis: 4000 }]).keys()], [], "stilleVor: ohne Einsaetze keine");
}
// ---------- unverwundbarStrecken (Issue #37) ----------
/* aus test-trainer-core.mjs, Neugestaltung 28.09.: der Trainer entfaellt
   (Spezifikation 3), die Rechnung zieht mit ihren Proben hierher. Treffer
   naeher als 1,5 s sind eine Strecke; ungeordnet hinein, nach Beginn
   geordnet heraus. */
{
  const unv = [{ t: 33200, ziel: "Vulcanus" }, { t: 32000, ziel: "Vulcanus" }, { t: 32600, ziel: "Vulcanus" }, { t: 40000, ziel: "Vulcanus" }];
  eq(core.unverwundbarStrecken(unv), [
    { von: 32000, bis: 33200, ziel: "Vulcanus" },
    { von: 40000, bis: 40000, ziel: "Vulcanus" },
  ], "unverwundbarStrecken: naeher als 1,5 s eine Strecke, ein Einzeltreffer ein Punkt");
  // 38 s unverwundbar, alle 0,44 s ein Treffer: eine Strecke
  const lang = [];
  for (let t = 57000; t <= 95000; t += 440) lang.push({ t, ziel: "Deus Chimaerus" });
  const s = core.unverwundbarStrecken(lang);
  eq([s.length, s[0].von, s[0].bis >= 94700], [1, 57000, true], "unverwundbarStrecken: 38 s dicht getroffen sind eine Strecke");
  eq(core.unverwundbarStrecken([]), [], "unverwundbarStrecken: ohne Treffer keine Strecke");
}

console.log();
if (failed) { console.log(`ROTATION CORE FAILED - ${failed}`); process.exit(1); }
console.log("ROTATION CORE PASSED");
