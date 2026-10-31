// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Kern der Charaktere (src/renderer/charaktere-core.ts), ohne Seite:
// Zuordnung eines Angreifernamens zu einem Charakter (genau wie
// geschrieben), Pruefung des Lognamens, Main, Zuordnungsstand
// (Spezifikation docs/superpowers/specs/2026-10-15-twinks-design.md, 2, 3, 5).
// Namen sind erfunden.
//
// Run:  npm run test:charaktere-core

import * as esbuild from "esbuild";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const b = await esbuild.build({
  entryPoints: [join(root, "src", "renderer", "charaktere-core.ts")],
  bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent",
  plugins: [bilderPlugin(root, bilderModus(root))],
});
const k = await import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));

let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), w = JSON.stringify(want);
  if (a === w) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        bekommen " + a + "\n        erwartet " + w); }
}

const liste = [{ id: "wtest00001", log: "Tessa" }, { id: "wtest00002", log: "Brann" }];

// --- Zuordnung: genau wie geschrieben
eq(k.charakterFuer("Tessa", liste), "wtest00001", "Tessa gehoert zu wtest00001");
eq(k.charakterFuer("Brann", liste), "wtest00002", "Brann gehoert zu wtest00002");
eq(k.charakterFuer("tessa", liste), "", "Kleinschreibung ist ein anderer Name");
eq(k.charakterFuer("Tessa ", liste), "", "ein Leerzeichen dahinter ist ein anderer Name");
eq(k.charakterFuer("Mira", liste), "", "ein unbekannter Name gehoert zu keinem");
eq(k.charakterFuer("__all", liste), "", "die Summe einer Gruppe gehoert zu keinem");
eq(k.charakterFuer("", liste), "", "ein leerer Name gehoert zu keinem");
eq(k.charakterFuer("Tessa", []), "", "ohne Charaktere gehoert nichts zu einem");
eq(k.charakterFuer("constructor", liste), "", "kein Name aus Object.prototype trifft");

// --- Zuordnungsstand: nur Kennungen, sortiert
eq(k.zuordnungsStand(liste), "wtest00001,wtest00002", "der Stand nennt die Kennungen");
eq(k.zuordnungsStand([liste[1], liste[0]]), "wtest00001,wtest00002", "die Reihenfolge der Liste zaehlt nicht");
eq(k.zuordnungsStand([]), "", "ohne Charaktere ist der Stand leer");
eq(k.zuordnungsStand(liste).includes("Tessa"), false, "der Stand traegt keinen Namen");

// --- Lognamen pruefen
const profile = [
  { id: "wtest00001", log: "Tessa" },
  { id: "wtest00002", log: "Brann" },
  { id: "wtest00003", log: "Ilka", geloest: true },
  { id: "wtest00004" },
];
eq(k.logPruefen("Mira", profile), { ok: true, log: "Mira" }, "ein neuer Name geht");
eq(k.logPruefen("  Mira  ", profile), { ok: true, log: "Mira" }, "Leerraum am Rand faellt weg");
eq(k.logPruefen("Mi\u0007ra", profile), { ok: true, log: "Mira" }, "Steuerzeichen fallen weg");
eq(k.logPruefen("", profile), { ok: false, grund: "leer" }, "leer geht nicht");
eq(k.logPruefen("   ", profile), { ok: false, grund: "leer" }, "nur Leerraum geht nicht");
eq(k.logPruefen("x".repeat(25), profile), { ok: false, grund: "leer" }, "mehr als 24 Zeichen gehen nicht");
eq(k.logPruefen("Ä".repeat(24), profile), { ok: true, log: "Ä".repeat(24) }, "24 Zeichen mit Umlaut gehen");
eq(k.logPruefen("Tessa", profile), { ok: false, grund: "doppelt" }, "ein Name eines aktiven Charakters ist doppelt");
eq(k.logPruefen("Tessa", profile, "wtest00001"), { ok: true, log: "Tessa" }, "der eigene Name zaehlt nicht als doppelt");
eq(k.logPruefen("Ilka", profile), { ok: true, log: "Ilka" }, "der Name eines geloesten Charakters ist frei");

// --- Main: genau einer oder keiner
const ps = [{ id: "a" }, { id: "b", main: true }, { id: "c", geloest: true }];
eq(k.mainSetzen(ps, "a"), [{ id: "a", main: true }, { id: "b" }, { id: "c", geloest: true }], "Main wechselt, der alte verliert es");
eq(k.mainSetzen(ps, null), [{ id: "a" }, { id: "b" }, { id: "c", geloest: true }], "null nimmt die Markierung weg");
eq(k.mainSetzen(ps, "c"), [{ id: "a" }, { id: "b", main: true }, { id: "c", geloest: true }], "ein geloester Charakter wird nie Main");
eq(k.mainSetzen(ps, "zzz"), [{ id: "a" }, { id: "b", main: true }, { id: "c", geloest: true }], "eine unbekannte Kennung aendert nichts");
eq(ps[1].main, true, "die Eingabe bleibt unberuehrt");

// --- Main zuerst (Twinks Schritt 3): die Reihenfolge der Weeklies und des Streifens
const ids = (l) => l.map((p) => p.id);
eq(ids(k.mainZuerst([{ id: "a" }, { id: "b" }, { id: "c", main: true }, { id: "d" }])), ["c", "a", "b", "d"], "der Main steht vorn, die anderen in ihrer Folge");
eq(ids(k.mainZuerst([{ id: "a", main: true }, { id: "b" }])), ["a", "b"], "steht der Main schon vorn, bleibt alles");
eq(ids(k.mainZuerst([{ id: "a" }, { id: "b" }, { id: "c" }])), ["a", "b", "c"], "ohne Main bleibt die Folge der Datei");
eq(ids(k.mainZuerst([{ id: "a" }, { id: "b", main: true, geloest: true }])), ["a", "b"], "ein geloester zaehlt nie als Main");
eq(ids(k.mainZuerst([])), [], "eine leere Liste bleibt leer");
const folge = [{ id: "a" }, { id: "b", main: true }];
k.mainZuerst(folge);
eq(ids(folge), ["a", "b"], "die Eingabe bleibt unberuehrt");

// --- Halter eines Kampfs in den Rekorden (Spezifikation Twinks 3 und 4)
const aktiv = new Set(["wtest00001", "wtest00002"]), geloest = new Set(["wtest00003"]);
eq(k.halterVon("wtest00001", aktiv, geloest), "wtest00001", "ein aktiver Charakter haelt seinen Kampf");
eq(k.halterVon("wtest00003", aktiv, geloest), null, "ein geloester Charakter zaehlt nicht, solange er geloest ist");
eq(k.halterVon("", aktiv, geloest), "?", "ohne passenden Charakter: unbekannt");
eq(k.halterVon(undefined, aktiv, geloest), "?", "ein Kampf ohne ch: unbekannt");
eq(k.halterVon("wtest00009", aktiv, geloest), "?", "eine Kennung, die nicht mehr in der Liste steht: unbekannt");
eq(k.halterVon(42, aktiv, geloest), "?", "was keine Kennung ist: unbekannt");
eq(k.halterVon("?", aktiv, geloest), "?", "das Zeichen fuer unbekannt bleibt unbekannt");
const fs = [{ at: 1, ch: "wtest00001" }, { at: 2, ch: "wtest00003" }, { at: 3 }, { at: 4, ch: "wtest00002" }, { at: 5, ch: "wtest00009" }];
eq(k.kaempfeVon(fs, "wtest00001", aktiv, geloest).map((f) => f.at), [1], "die Kaempfe eines Charakters");
eq(k.kaempfeVon(fs, "?", aktiv, geloest).map((f) => f.at), [3, 5], "die Kaempfe ohne bekannten Charakter");
eq(k.kaempfeVon(fs, null, aktiv, geloest).map((f) => f.at), [1, 3, 4, 5], "Gesamt: alle ausser denen geloester Charaktere");
eq(k.kaempfeVon(fs, "wtest00003", aktiv, geloest).map((f) => f.at), [], "ein geloester Charakter hat in den Rekorden keine Kaempfe");
eq(fs[2].ch, undefined, "die Eingabe bleibt unberuehrt");

if (failed) { console.log(`charaktere-core: ${failed} FAIL`); process.exit(1); }
console.log("charaktere-core: all ok");
