// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die Weiche fuer die Spielbilder (Spezifikation oeffentliches Repo, 4).
// Im Quelltext steht src/renderer/spielbilder.ts mit leeren Tabellen. Liegt
// assets/spielbilder.ts daneben - privat im Repo, oeffentlich nur im
// Release-Build aus dem Asset-Repo -, setzt der Build diese Datei ein.
// BORO_BILDER=aus baut ohne sie, BORO_BILDER=pflicht bricht ab, wenn sie
// fehlt. Gelesen von build-renderer.mjs, safety-audit.mjs und den Tests.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const LEER = "src/renderer/spielbilder.ts";
export const VOLL = "assets/spielbilder.ts";
const MERKER = "dist/bilder-modus.txt";

/** "voll" oder "leer" - aus dem Ordner und BORO_BILDER. */
export function bilderModus(root, env = process.env) {
  const wunsch = env.BORO_BILDER ?? "";
  if (!["", "aus", "pflicht"].includes(wunsch)) throw new Error(`BORO_BILDER="${wunsch}": erlaubt sind "aus", "pflicht" oder nichts`);
  const da = existsSync(join(root, VOLL));
  if (wunsch === "pflicht" && !da) throw new Error(`BORO_BILDER=pflicht, aber ${VOLL} fehlt`);
  return da && wunsch !== "aus" ? "voll" : "leer";
}

/** Die Namen der exportierten Tabellen, sortiert. */
export function tabellenNamen(text) {
  return [...text.matchAll(/^export const ([A-Z][A-Z_]*)\b/gm)].map((m) => m[1]).sort();
}

/** Der Text der Datei, die der Build in diesem Modus nimmt. */
export function spielbilderText(root, modus) {
  return readFileSync(join(root, modus === "voll" ? VOLL : LEER), "utf8");
}

/** Bricht ab, wenn die volle Datei andere Tabellen hat als die leere. */
export function pruefeFormen(root) {
  const leer = tabellenNamen(spielbilderText(root, "leer")).join(", ");
  const voll = tabellenNamen(spielbilderText(root, "voll")).join(", ");
  if (leer !== voll) throw new Error(`${VOLL} hat ${voll}, ${LEER} hat ${leer} - beide brauchen dieselben Tabellen`);
}

/** esbuild-Plugin: genau "../spielbilder" zeigt auf die Datei des Modus, sonst nichts. */
export function bilderPlugin(root, modus) {
  return {
    name: "spielbilder",
    setup(build) {
      build.onResolve({ filter: /^\.\.\/spielbilder$/ }, () => ({ path: join(root, modus === "voll" ? VOLL : LEER) }));
    },
  };
}

/** Haelt fest, mit welchem Modus dist/renderer/index.html gebaut ist. */
export function merkeModus(root, modus) {
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(join(root, MERKER), modus + "\n");
}

/** Der Modus der gebauten Seite; muss zum jetzigen passen, sonst prueft ein Test die falsche Seite. */
export function gebauterModus(root, env = process.env) {
  const p = join(root, MERKER);
  if (!existsSync(p)) throw new Error(`${MERKER} fehlt - erst npm run build:renderer`);
  const m = readFileSync(p, "utf8").trim();
  const soll = bilderModus(root, env);
  if (m !== soll) throw new Error(`die Seite ist "${m}" gebaut, jetzt gilt "${soll}" - npm run build:renderer`);
  return m;
}
