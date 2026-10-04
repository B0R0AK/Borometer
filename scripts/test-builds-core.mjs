// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die reinen Funktionen des Bautagebuchs (src/renderer/build-core.ts), ohne
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

// tragende Faehigkeiten: bis 80 %, hoechstens sechs, Passiv nie
eq(core.coreFromSkills([sk("a", "X", 30), sk("b", "X", 22), sk("c", "X", 16), sk("d", "X", 12), sk("e", "X", 10), sk("f", "X", 10)], 100),
   ["a", "b", "c", "d"], "coreFromSkills: bis 80 % erreicht sind");
eq(core.coreFromSkills("abcdefghij".split("").map((k) => sk(k, "X", 10)), 100),
   ["a", "b", "c", "d", "e", "f"], "coreFromSkills: hoechstens sechs");
eq(core.coreFromSkills([sk("p", "Passive", 50), sk("a", "X", 30), sk("b", "X", 20)], 100),
   ["a", "b"], "coreFromSkills: Passiv zaehlt im Nenner, nicht im Kern");
eq(core.coreFromSkills([sk("a", "X", 45), sk("a", "X", 40), sk("b", "X", 15)], 100),
   ["a"], "coreFromSkills: zwei Raenge derselben Faehigkeit zaehlen zusammen");

// Fingerabdruck, Handauswahl gewinnt beim Paar
const skills = [sk("a", "Longbow", 40), sk("b", "Crossbow", 30), sk("c", "Longbow", 20), sk("d", "Crossbow", 10)];
eq(core.fingerprint(skills, 100, 3, null), { weapons: ["Longbow", "Crossbow"], core: ["a", "b", "c"] },
   "fingerprint: Paar und Kern");
eq(core.fingerprint(skills, 100, 3, { main: "Dagger", off: "Staff" }).weapons, ["Dagger", "Staff"],
   "fingerprint: die Handauswahl gewinnt");
eq(core.fingerprint([], 0, 3, null), null, "fingerprint: ohne Schaden keiner");

// derselbe Bau
const fp = (weapons, coreKeys) => ({ weapons, core: coreKeys });
const A = fp(["Longbow", "Crossbow"], ["a", "b", "c", "d", "e", "f"]);
eq(core.samePair(["Longbow", "Crossbow"], ["Crossbow", "Longbow"]), true, "samePair: Reihenfolge egal");
eq(core.sameBau(A, fp(["Crossbow", "Longbow"], ["a", "b", "c", "d", "x", "y"])), true, "sameBau: vier von sechs gemeinsam");
eq(core.sameBau(A, fp(["Longbow", "Crossbow"], ["a", "b", "c", "x", "y", "z"])), false, "sameBau: drei von sechs sind ein anderer Bau");
eq(core.sameBau(A, fp(["Dagger", "Crossbow"], ["a", "b", "c", "d", "e", "f"])), false, "sameBau: anderes Paar, anderer Bau");
eq(core.sameBau(fp(["X", ""], ["a", "b"]), fp(["X", ""], ["a", "b", "c"])), true, "sameBau: ein kleiner Kern muss ganz im anderen stehen");
eq(core.sameBau(fp(["X", ""], ["a", "b"]), fp(["X", ""], ["a", "c"])), false, "sameBau: ... sonst nicht");

// Kennung
const id = core.bauId(A);
eq(/^[0-9a-z]{10}$/.test(id), true, "bauId: zehn Buchstaben oder Ziffern");
eq(core.bauId(fp(["Crossbow", "Longbow"], ["f", "e", "d", "c", "b", "a"])), id, "bauId: unabhaengig von der Reihenfolge");
eq(core.bauId(fp(["Longbow", "Crossbow"], ["a", "b", "c", "d", "e", "g"])) === id, false, "bauId: ein anderer Kern, eine andere Kennung");

// den bekannten Bau finden
const store = {
  aaaaaaaaaa: { name: "", weapons: ["Longbow", "Crossbow"], core: ["a", "b", "c", "d", "x", "y"], first: 2 },
  bbbbbbbbbb: { name: "", weapons: ["Longbow", "Crossbow"], core: ["a", "b", "c", "d", "e", "y"], first: 3 },
  cccccccccc: { name: "", weapons: ["Longbow", "Crossbow"], core: ["a", "b", "c", "d", "e", "z"], first: 1 },
  dddddddddd: { name: "", weapons: ["Dagger", "Crossbow"], core: ["a", "b", "c", "d", "e", "f"], first: 0 },
};
eq(core.findBau(A, store), "cccccccccc", "findBau: die meisten gemeinsamen, bei Gleichstand der aeltere");
eq(core.findBau(fp(["Staff", "Wand and Tome"], ["a"]), store), null, "findBau: nichts Aehnliches");

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

// Die Zeilen je Bau und Ziel (bauZeilen) entfielen mit der Karte des Builds (Aufgabe 12, 29.09.); ihre Regeln -
// Median ab drei Kaempfen, meiste Kaempfe zuerst, die Puppe kein Boss - prueft test-plan-core.mjs an kartenZahlen.

// Nummern ohne Namen, je Paar
eq(core.bauNummern(store), { cccccccccc: 1, aaaaaaaaaa: 2, bbbbbbbbbb: 3, dddddddddd: 1 }, "bauNummern: je Paar nach dem ersten Kampf");

// Name und Link
eq([core.cleanName("  Burst\u0007 "), core.cleanName("x".repeat(41)), core.cleanName("Burst  zwei")], ["Burst", null, "Burst zwei"],
   "cleanName: Steuerzeichen raus, hoechstens 40");
eq(["https://questlog.gg/throne-and-liberty/en/character-builder/abc", "http://questlog.gg/x", "javascript:alert(1)",
    "https://a b", "https://" + "x".repeat(300)].map(core.linkOk), [true, false, false, false, false], "linkOk: nur https");
eq(core.looksLikeBau({ name: "Burst", weapons: ["Longbow", "Crossbow"], core: ["a"], first: 1 }), true, "looksLikeBau: gut");
// Fixrunde 1 zu Aufgabe 12: ein Build mit Link wird im Bereich Builds geloest - als Zeitpunkt, nie geloescht
eq([{ geloest: 5 }, { geloest: "ja" }, { geloest: null }].map((x) => core.looksLikeBau({ name: "", weapons: ["Longbow", "Crossbow"], core: ["a"], first: 1,
   link: "https://maxroll.gg/tl/x", ...x })), [true, false, false], "looksLikeBau: geloest nur als Zahl");
eq([{ name: "x".repeat(41), weapons: ["a", "b"], core: ["a"], first: 1 },
    { name: "", weapons: ["a"], core: ["a"], first: 1 },
    { name: "", weapons: ["a", "b"], core: [], first: 1 },
    { name: "", weapons: ["a", "b"], core: ["a"], first: 1, link: "http://x" },
    { name: "", weapons: ["a", "b"], core: ["a"] }].map(core.looksLikeBau), [false, false, false, false, false],
   "looksLikeBau: zu langer Name, ein Paar ohne zweite Stelle, leerer Kern, http-Link, ohne first");

// Deine Rotation (Spezifikation 7): rot, Schluessel 1-80 Zeichen, Werte 0/1/2, hoechstens 24
const bau = (rot) => ({ name: "", weapons: ["a", "b"], core: ["a"], first: 1, rot });
const vieleRot = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => ["Skill " + i, i % 3]));
eq(core.BAU_ROT_MAX, 24, "BAU_ROT_MAX: 24 wie MAX_ROT in src/main/builds.ts");
eq([{ "Deadly Viper": 1, "Quick Fire": 2, "Storm Current": 0 }, {}, vieleRot(24), { ["k".repeat(80)]: 1 }].map(core.rotOk),
   [true, true, true, true], "rotOk: gueltig, leer, 24 Eintraege, 80 Zeichen");
eq([vieleRot(25), { a: 3 }, { a: 1.5 }, { a: -1 }, { a: "1" }, { "": 1 }, { ["k".repeat(81)]: 1 }, [1], null, "x"].map(core.rotOk),
   [false, false, false, false, false, false, false, false, false, false],
   "rotOk: 25 Eintraege, 3, 1.5, -1, Text, leerer Schluessel, 81 Zeichen, Liste, null, Text");
eq([bau({ "Deadly Viper": 1 }), bau(undefined)].map(core.looksLikeBau), [true, true], "looksLikeBau: mit rot und ohne");
eq([{ toString: 1 }, { constructor: 1 }, { prototype: 1 }, JSON.parse('{"__proto__": 1}'), { "Deadly Viper": 1 }].map(core.rotOk),
   [false, false, false, false, true], "rotOk: __proto__, constructor, prototype und toString nie (wie putBuild), ein Skill-Name schon");
eq([bau({ a: 3 }), bau(vieleRot(25)), bau([])].map(core.looksLikeBau), [false, false, false],
   "looksLikeBau: rot mit Wert 3, mit 25 Eintraegen, als Liste");
// bauPasst: was putBuild annimmt - die Form und hoechstens BAU_ENTRY_MAX (4096) Zeichen als JSON (Review #44)
eq(core.BAU_ENTRY_MAX, 4096, "BAU_ENTRY_MAX: 4096 wie MAX_ENTRY in src/main/builds.ts");
eq([bau(vieleRot(24)), { ...bau({}), mehr: "x".repeat(4100) }, bau({ ["k".repeat(81)]: 1 })].map(core.bauPasst), [true, false, false],
   "bauPasst: 24 Wahlen passen, ueber 4096 Zeichen nicht, ein Schluessel mit 81 Zeichen nicht");

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

console.log();
if (failed) { console.log(`BUILDS CORE FAILED - ${failed}`); process.exit(1); }
console.log("BUILDS CORE PASSED");
