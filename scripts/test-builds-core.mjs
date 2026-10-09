// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die reinen Funktionen des Waffenpaars und der Zahlen (src/renderer/build-core.ts), ohne
// Seite: esbuild buendelt die eine Datei - sie importiert nur Typen -, Node
// fuehrt sie aus.
//
// Run:  npm run test:builds-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = await esbuild.build({
  entryPoints: [join(root, "src", "renderer", "build-core.ts")],
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

const sk = (key, weapon, damage) => ({ key, weapon, damage });

// Waffenpaar: wie autoPair fuer einen fertigen Kampf, Passiv nur im Nenner
eq(core.pairFromSkills([sk("a", "Crossbow", 60), sk("b", "Longbow", 38), sk("p", "Passive", 2)], 100, 3),
   ["Crossbow", "Longbow"], "pairFromSkills: die zwei staerksten Waffen");
eq(core.pairFromSkills([sk("a", "Crossbow", 97), sk("b", "Longbow", 2), sk("p", "Passive", 1)], 100, 3),
   ["Crossbow", ""], "pairFromSkills: unter 3 % keine zweite Waffe");
eq(core.pairFromSkills([sk("a", "Unassigned", 50), sk("p", "Passive", 50)], 100, 3), null,
   "pairFromSkills: ohne zugeordnete Waffe kein Paar");

/* Erkennung ueber Skills entfaellt (#51, Builds-Reiter 9); ersetzt durch: kampfBuild, kampfPaar,
   gleicherBezug, zuordnenListe (unten, "Boss-Tabelle, Zuordnen, Bezug"). Entfallen sind damit die Proben
   zu coreFromSkills (bis 80 %, hoechstens sechs, Passiv nur im Nenner, Raenge zusammen), fingerprint
   (Paar und Kern, Handauswahl gewinnt, ohne Schaden keiner), sameBau (vier von sechs, anderes Paar,
   kleiner Kern), bauId (Form, Reihenfolge, anderer Kern) und findBau (meiste gemeinsame, nichts
   Aehnliches). Was davon bleibt: das Paar aus den Skills (pairFromSkills, oben; die Handauswahl gewinnt in
   paarVon, 47-builds.ts) und samePair (hier). */
eq(core.samePair(["Longbow", "Crossbow"], ["Crossbow", "Longbow"]), true, "samePair: Reihenfolge egal");
eq(core.samePair(["Longbow", "Crossbow"], ["Longbow", ""]), false, "samePair: ein anderes Paar");

// Median wie im Verlauf, Abendgrenze 12:00
eq([core.mitte([3, 1, 2]), core.mitte([4, 1, 3, 2])], [2, 2.5], "mitte: bei gerader Anzahl der Mittelwert der beiden mittleren");
eq(core.mitte([36300, 29800, 33200, 30200]), 31700, "mitte: 29.8k, 30.2k, 33.2k, 36.3k ergeben 31.7k, nicht 33.2k");
eq([core.abend(Date.UTC(2026, 8, 18, 11, 59)), core.abend(Date.UTC(2026, 8, 18, 12, 0))], ["2026-09-17", "2026-09-18"],
   "abend: 11:59 gehoert zum Abend davor");
eq([core.abendText("2026-09-17", "de"), core.abendText("2026-09-17", "en")], ["17.09.", "17/09"], "abendText");
// aus test-abend-core.mjs, Neugestaltung 28.09.: der Abend entfaellt (Spezifikation 3), die Abendgrenze bleibt fuer den Verlauf
eq(core.ABEND_STUNDE, 12, "die Abendgrenze ist eine Konstante: 12 Uhr");
eq([core.abend(Date.UTC(2026, 8, 23, 11, 59, 59)), core.abend(Date.UTC(2026, 8, 23, 12)), core.abend(Date.UTC(2026, 8, 24, 1, 30)), core.abend(Date.UTC(2026, 8, 24, 11, 59, 59))],
   ["2026-09-22", "2026-09-23", "2026-09-23", "2026-09-23"], "abend: 11:59 gehoert zum Vorabend, 12:00 bis 11:59 zum selben");

// Der Builds-Reiter ist entfallen (#207): Build-Form, Name, Link, Rotation-Wahlen je Build, Kennungen, Uebernahme
// und Boss-Tabelle je Build gibt es im Kern nicht mehr; ihre Proben entfallen mit ihnen.

// --- Builds-Reiter (#51, Spez 5.2/5.3): Waffenliste, Kodierung, gespeicherte Builds
eq(core.WAFFEN, ["", "Greatsword", "Sword and Shield", "Dagger", "Crossbow", "Longbow", "Staff", "Wand and Tome", "Spear", "Gauntlet", "Orb"],
   "WAFFEN: feste Liste, Index 0 = keine (nur hinten verlaengern)");
eq([core.paarCode(["Longbow", "Crossbow"]), core.paarCode(["Dagger", ""]), core.paarCode(["", "Dagger"]), core.paarCode(["Passive", "Dagger"]), core.paarCode(["Bogen", "Dagger"])],
   [[5, 4], [3, 0], null, null, null], "paarCode: Index je Waffe, erste nie leer, Passiv und Fremdes nie");
eq([core.paarAus([5, 4]), core.paarAus([3, 0]), core.paarAus([0, 3]), core.paarAus([5, 99]), core.paarAus([1.5, 2]), core.paarAus("5,4"), core.paarAus([5])],
   [["Longbow", "Crossbow"], ["Dagger", ""], null, null, null, null, null], "paarAus: zurueck, nur ganze Zahlen im Bereich");
// Einordnung (Instrumententafel 4): Lagen auf der Skala, 0 links, 1 rechts
{
  const s = core.einordnungSkala(100, 160, 130);
  eq([s.sonst < s.dieser, s.dieser < s.bester, s.sonst > 0, s.bester < 1], [true, true, true, true],
    "Skala: sonst < dieser < bester, alle mit Rand");
  eq(Math.round((s.dieser - s.sonst) / (s.bester - s.sonst) * 100), 50, "Skala: 130 liegt mitten zwischen 100 und 160");
  const t = core.einordnungSkala(100, 160, 80);
  eq(t.dieser < t.sonst && t.dieser >= 0, true, "Skala: unter dem Median links davon, nicht aus der Skala");
  const g = core.einordnungSkala(100, 100, 100);
  eq([g.sonst, g.bester, g.dieser].every(x => x >= 0 && x <= 1), true, "Skala: alles gleich bleibt in der Skala");
}

// --- Bezug (Spez 6, seit #207 nur noch das Waffenpaar): kampfPaar liest nur w, gleicherBezug vergleicht Paare
{
  const F = (name, dps, at, x = {}) => ({ name, dps, dmg: dps, dur: 60, at, ...x });
  eq([core.kampfPaar(F("Fellinex", 1, 1, { w: [5, 4] })), core.kampfPaar(F("Fellinex", 1, 2, { w: [3, 0] })), core.kampfPaar(F("Fellinex", 1, 3)),
      core.kampfPaar(F("Fellinex", 1, 4, { w: [0, 3] })), core.kampfPaar(F("Fellinex", 1, 5, { w: "5,4" }))],
     [["Longbow", "Crossbow"], ["Dagger", ""], null, null, null], "kampfPaar: nur w; ein altes b liefert kein Paar mehr");
  const alt = F("Fellinex", 1, 6, { b: "pve0000000" });
  eq(core.kampfPaar(alt), null, "kampfPaar: ein alter Eintrag nur mit b (aus boro-builds.json) hat kein Paar und wirft nichts");
  eq([core.gleicherBezug(["X", "Y"], ["Y", "X"]), core.gleicherBezug(["X", "Y"], ["X", ""]), core.gleicherBezug(null, ["X", "Y"]),
      core.gleicherBezug(["X", "Y"], null), core.gleicherBezug(null, null)],
     [true, false, false, false, false], "gleicherBezug: dasselbe Paar in jeder Reihenfolge; Unbekanntes nie");
}

console.log();
if (failed) { console.log(`BUILDS CORE FAILED - ${failed}`); process.exit(1); }
console.log("BUILDS CORE PASSED");
