// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Kern des erweiterten Rundgangs ohne Seite (src/renderer/rundgang-core.ts,
// Spezifikation docs/superpowers/specs/2026-10-16-rundgang-erweitert-design.md,
// Abschnitt 4): wann gefragt wird und wann ein Bereich seinen Hinweis zeigt.
// Nur Wahrheitswerte, Zahlen und Kennungen.
//
// Run:  npm run test:rundgang-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = await esbuild.build({
  stdin: {
    contents: 'export * from "./rundgang-core";',
    resolveDir: join(root, "src", "renderer"), loader: "ts",
  },
  bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent",
  plugins: [bilderPlugin(root, bilderModus(root))],
});
const core = await import("data:text/javascript;base64," +
  Buffer.from(built.outputFiles[0].text).toString("base64"));

let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        got  " + a + "\n        want " + b); }
}

// --- 1. frageNoetig (Spezifikation 3.1)
{
  const f = (o) => core.frageNoetig({ gesehen: false, ersterStart: true, spaeter: 0, fenster: true, ...o });
  eq(f({}), true, "erster Start, nie Spaeter, nicht gesehen: fragen");
  eq(f({ gesehen: true }), false, "Rundgang gesehen (auch Nein): nicht fragen");
  eq(f({ gesehen: null }), false, "gesehen unbekannt: nicht fragen");
  eq(f({ ersterStart: null }), false, "erster Start unbekannt: nicht fragen");
  eq(f({ spaeter: null }), false, "Spaeter unbekannt: nicht fragen");
  eq(f({ fenster: false }), false, "kein eigenes Fenster der App (Browser, Kompakt): nicht fragen");
  eq(f({ ersterStart: false }), false, "Bestandsnutzer, nie gefragt: nicht fragen");
  eq(f({ ersterStart: false, spaeter: 1 }), true, "einmal Spaeter, kein erster Start mehr: wieder fragen");
  eq(f({ ersterStart: false, spaeter: 2 }), true, "zweimal Spaeter: wieder fragen");
  eq(f({ ersterStart: false, spaeter: 3 }), false, "dreimal Spaeter gilt wie Nein");
  eq(f({ spaeter: 3 }), false, "dreimal Spaeter, auch im ersten Start: nicht fragen");
  eq(f({ ersterStart: false, spaeter: 1, gesehen: true }), false, "Spaeter, dann doch gesehen: nicht fragen");
}

// --- 2. naechstesSpaeter
{
  eq([0, 1, 2, 3, 7].map(core.naechstesSpaeter), [1, 2, 3, 3, 3], "Spaeter zaehlt hoch bis 3 und bleibt dort");
  eq(core.naechstesSpaeter(-4), 1, "negativ: wie 0");
  eq(core.SPAETER_MAX, 3, "hoechstens dreimal");
}

// --- 3. gezeigtBereinigt
{
  eq(core.gezeigtBereinigt(null), [], "null: leer");
  eq(core.gezeigtBereinigt("rotation"), [], "keine Liste: leer");
  eq(core.gezeigtBereinigt({ 0: "rotation" }), [], "ein Objekt: leer");
  eq(core.gezeigtBereinigt(["analysis", "start", "x", "analysis", 5, "timeline"]), ["timeline", "analysis"],
    "nur bekannte Kennungen, einmal, in der Reihenfolge der Bereiche");
  eq(core.gezeigtBereinigt([]), [], "leere Liste");
  eq(core.HINWEIS_BEREICHE.length, 11, "elf Bereiche mit Hinweis (Archiv seit #264)");
  eq(core.HINWEIS_BEREICHE.indexOf("archiv"), core.HINWEIS_BEREICHE.indexOf("rekorde") + 1, "Archiv nach Rekorde, wie in der Leiste");
  eq(core.HINWEIS_BEREICHE.includes("start") || core.HINWEIS_BEREICHE.includes("weapons") || core.HINWEIS_BEREICHE.includes("setup"), false,
    "Start, Waffen und Log-Einrichtung haben keinen Hinweis");
}

// --- 4. hinweisNoetig (Spezifikation 3.2)
{
  const h = (o) => core.hinweisNoetig({ bereich: "rotation", an: true, gezeigt: [], ruhe: true, ...o });
  eq(h({}), true, "erster Besuch: zeigen");
  eq(h({ gezeigt: ["rotation"] }), false, "schon gezeigt: nicht noch einmal");
  eq(h({ gezeigt: ["analysis"] }), true, "ein anderer Bereich war dran: zeigen");
  eq(h({ an: false }), false, "Schalter aus: nichts");
  eq(h({ an: null }), true, "Schalter unbekannt (Standard an): zeigen");
  eq(h({ ruhe: false }), false, "Rundgang offen, Frage da oder Kompakt: nichts");
  eq(h({ gezeigt: null }), false, "Stand unbekannt: nichts");
  for (const b of ["start", "weapons", "setup", "gibtesnicht", ""]) eq(h({ bereich: b }), false, "kein Hinweis fuer '" + b + "'");
  for (const b of core.HINWEIS_BEREICHE) eq(h({ bereich: b }), true, "Hinweis fuer " + b);
}

// --- 5. gezeigtMit
{
  eq(core.gezeigtMit([], "gilde"), ["gilde"], "haengt an");
  eq(core.gezeigtMit(["gilde"], "gilde"), ["gilde"], "einmalig");
  eq(core.gezeigtMit(["rekorde", "timeline"], "party"), ["timeline", "party", "rekorde"], "in der Reihenfolge der Bereiche");
  eq(core.gezeigtMit(["timeline"], "start"), ["timeline"], "Unbekanntes kommt nicht hinein");
}

if (failed) { console.log(`RUNDGANG CORE TEST FAILED - ${failed}`); process.exit(1); }
console.log("RUNDGANG CORE TEST PASSED");
