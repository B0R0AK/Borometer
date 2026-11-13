// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Gemeinsames Geruest der Kern-Tests der neuen Analyse (#414): bündelt einen
// Kern aus src/renderer/ mit esbuild allein, laedt ihn per data:-Import und
// stellt die reduzierten Kampfdaten bereit (scripts/fixtures/analyse-kaempfe.json).

import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Bündelt src/renderer/<datei>.ts (ohne Endung) und gibt das Modul zurueck; "wort" haengt das Woerterbuch an. */
export async function ladeKern(datei, mitWoerterbuch = false) {
  const contents = `export * from "./${datei}";` + (mitWoerterbuch ? ' export { I18N } from "./app/07-dictionary";' : "");
  const built = await esbuild.build({
    stdin: { contents, resolveDir: join(root, "src", "renderer"), loader: "ts" },
    bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent",
    plugins: [bilderPlugin(root, bilderModus(root))],
  });
  return import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64"));
}

let failed = 0;
export function eq(got, want, name) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        got  " + a + "\n        want " + b); }
}
export function ok(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}
export const nah = (x, soll, tol) => typeof x === "number" && Math.abs(x - soll) <= tol;
export function ende() {
  if (failed) { console.log("\n" + failed + " failed"); process.exit(1); }
  console.log("\nalles gruen");
}

export const daten = JSON.parse(readFileSync(join(root, "scripts", "fixtures", "analyse-kaempfe.json"), "utf8"));
export const hatVentius = (k) => !!(k && k.ventius && k.ventius.salven && k.ventius.salven.length);
export const kampf = (ziel, mitVentius) => daten.kaempfe.find((k) => k.hauptziel === ziel && hatVentius(k) === mitVentius);
export const bester = (k) => daten.bester[k.quelle + "#" + k.hauptziel] || null;
export const decke = (k) => daten.decke[k.hauptziel] || 0;
