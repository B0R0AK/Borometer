// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Windows-Einbindung (Spezifikation 2026-10-04, Abschnitte 3, 5, 6, 8, 11):
// der reine Kern src/main/windows-core.ts ohne Electron. Dazu die Gleichheit
// der Text-Tafel des Hauptprozesses mit den nativ.*-Eintraegen der Seite.
//
// Run:  npm run test:windows-core

import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
async function lade(datei) {
  // ueber die Bildweiche wie jedes Buendel von Seitenteilen (test-spielbilder-core.mjs)
  const b = await esbuild.build({ entryPoints: [join(root, datei)], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent",
    plugins: [bilderPlugin(root, bilderModus(root))] });
  return import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));
}
const k = await lade("src/main/windows-core.ts");
const { I18N } = await lade("src/renderer/app/07-dictionary.ts");
let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        bekommen " + a + "\n        erwartet " + b); }
}

// --- 8. die Tafel des Hauptprozesses ist Wort fuer Wort die der Seite
for (const l of ["de", "en"]) {
  const seite = Object.fromEntries(Object.entries(I18N[l]).filter(([s]) => s.startsWith("nativ.")).map(([s, v]) => [s.slice(6), v]));
  eq(Object.keys(k.TEXTE[l]).sort(), Object.keys(seite).sort(), l + ": dieselben Schluessel nativ.* wie 07-dictionary.ts");
  for (const key of Object.keys(k.TEXTE[l])) eq(k.TEXTE[l][key], seite[key], l + ": nativ." + key + " gleich");
}
eq(k.sprache("de"), "de", "de bleibt de");
for (const v of ["en", "fr", "", null, 1, {}]) eq(k.sprache(v), "en", "sprache(" + JSON.stringify(v) + ") ist en");
eq(k.wort("de", "beenden"), "Beenden", "wort de");
eq(k.wort(undefined, "beenden"), "Quit", "wort ohne Sprache: en");

// --- LOG_NAME wie in window.ts
const win = readFileSync(join(root, "src/main/window.ts"), "utf8");
eq(win.includes("const LOG_NAME = " + k.LOG_NAME.toString() + ";"), true, "LOG_NAME hat denselben Quelltext wie in window.ts");

// --- 5.1 Startschalter
const leer = { kompakt: false, live: false, logordner: false, autostart: false, log: "" };
eq(k.startSchalter([]), leer, "nichts: kein Auftrag");
eq(k.startSchalter(["C:\\Borometer.exe", "--kompakt"]), { ...leer, kompakt: true }, "--kompakt");
eq(k.startSchalter(["x", "--live", "--logordner"]), { ...leer, live: true, logordner: true }, "--live --logordner");
eq(k.startSchalter(["--autostart"]), { ...leer, autostart: true }, "--autostart");
eq(k.startSchalter(["--log=TLCombatLog-2026.10.04.txt"]).log, "TLCombatLog-2026.10.04.txt", "--log= mit Lognamen");
eq(k.startSchalter(["--log=TL Combat 1.log"]).log, "TL Combat 1.log", "--log= mit Leerzeichen");
for (const bad of ["--log=..\\..\\x.txt", "--log=C:\\a.txt", "--log=a/b.txt", "--log=x.exe", "--log=", "--log=a\u0001.txt", "--LOG=a.txt", "--kompakt=1", "kompakt", 5, null])
  eq(k.startSchalter([bad]), leer, "verworfen: " + JSON.stringify(bad));
eq(k.hatAuftrag(leer), false, "leer: kein Auftrag");
eq(k.hatAuftrag({ ...leer, autostart: true }), false, "--autostart allein ist kein Auftrag an die Seite");
eq([k.hatAuftrag({ ...leer, kompakt: true }), k.hatAuftrag({ ...leer, log: "a.txt" })], [true, true], "kompakt, log: Auftrag");

// --- 3.3 Pruefung der Meldung
eq(k.kampfMeldung("Fellinex \u00b7 136.4k", "32\u00a0% besser als sonst.", true), { titel: "Fellinex \u00b7 136.4k", satz: "32\u00a0% besser als sonst.", best: true }, "gueltig");
eq(k.kampfMeldung("  A  ", "", false), { titel: "A", satz: "", best: false }, "getrimmt, satz darf leer sein");
for (const [t, s, b, wie] of [["", "", true, "titel leer"], ["   ", "", true, "titel nur Leerzeichen"], ["x".repeat(121), "", true, "titel zu lang"],
  ["a", "x".repeat(241), true, "satz zu lang"], ["a\nb", "", true, "Steuerzeichen im titel"], ["a", "b\u007f", true, "DEL im satz"],
  [1, "", true, "titel keine Zeichenkette"], ["a", null, true, "satz null"], ["a", "", "true", "best als Text"], ["a", "", 1, "best als Zahl"]])
  eq(k.kampfMeldung(t, s, b), null, "abgelehnt: " + wie);
eq(k.kampfMeldung("x".repeat(120), "y".repeat(240), false) !== null, true, "Grenzen 120/240 gelten noch");

// --- 3.3 Entscheidung
const an = { meldenKampf: true };
eq(k.sollMelden({}, true, false, 10000, null), false, "aus ab Werk");
eq(k.sollMelden({ meldenKampf: "true" }, true, false, 10000, null), false, "nur genau true schaltet ein");
eq(k.sollMelden(an, false, false, 10000, null), true, "an: auch ohne Bestwert");
eq(k.sollMelden({ ...an, meldenNurBest: true }, false, false, 10000, null), false, "nur Bestwert: ohne Bestwert nein");
eq(k.sollMelden({ ...an, meldenNurBest: true }, true, false, 10000, null), true, "nur Bestwert: mit Bestwert ja");
eq(k.sollMelden({ meldenNurBest: true }, true, false, 10000, null), false, "Zusatz ohne Hauptschalter: nein");
eq(k.sollMelden(an, true, true, 10000, null), false, "Fenster vorn: nein");
eq(k.sollMelden(an, true, false, 10000, 5001), false, "unter 5 s nach der letzten: nein");
eq(k.sollMelden(an, true, false, 10000, 5000), true, "genau 5 s: ja");
eq(k.sollMelden(an, true, false, 10000, 20000), true, "Uhr zurueckgestellt: ja, statt bis zur alten Zeit zu sperren");

// --- 6. Fortschritt
eq(k.fortschritt(8388608, 33554432, false), 0.25, "erstes Stueck von vieren: 0.25");
eq(k.fortschritt(33554432, 33554432, true), -1, "fertig, Balken stand: aus");
eq(k.fortschritt(33554432, 33554432, false), null, "fertig, kein Balken: nichts");
eq(k.fortschritt(1000, 1010, false), null, "nur eine halbe Zeile fehlt: kein Balken");
eq(k.fortschritt(1000, 1010, true), -1, "halbe Zeile, Balken stand: aus");
eq(k.fortschritt(0, 0, false), null, "leere Datei: nichts");
eq(k.fortschritt(10, 0, true), -1, "Groesse 0, Balken stand: aus");

// --- 5. zuletzt gelesen
eq(k.zuletztNeu(undefined, "a.txt"), ["a.txt"], "erster Eintrag");
eq(k.zuletztNeu(["a.txt", "b.txt", "c.txt"], "d.txt"), ["d.txt", "a.txt", "b.txt"], "hoechstens drei, neueste zuerst");
eq(k.zuletztNeu(["a.txt", "b.txt", "c.txt"], "c.txt"), ["c.txt", "a.txt", "b.txt"], "ohne Doppelte, nach vorn");
eq(k.zuletztNeu(["../x.txt", 5, "b.txt"], "a.txt"), ["a.txt", "b.txt"], "Ungueltiges faellt heraus");
eq(k.zuletztNeu(["a.txt"], "kein/name.txt"), ["a.txt"], "ungueltiger neuer Name: Liste bleibt");
eq(k.zuletztListe("a.txt"), [], "keine Liste: leer");

// --- 5. Sprungliste
const j = k.jumpListe("de", ["a.txt", "b c.log"], []);
eq(j.map((c) => c.type), ["tasks", "custom"], "Aufgaben und eigene Kategorie");
eq(j[0].items.map((i) => [i.title, i.args]), [["Kompakt öffnen", "--kompakt"], ["Live-Aufzeichnung starten", "--live"], ["Log-Ordner öffnen", "--logordner"]], "drei Aufgaben, deutsch");
eq([j[1].name, j[1].items.map((i) => [i.title, i.args])], ["Zuletzt gelesen", [["a.txt", "\"--log=a.txt\""], ["b c.log", "\"--log=b c.log\""]]], "Zuletzt gelesen, Argument in Anfuehrungszeichen");
eq(k.jumpListe("en", [], []).length, 1, "ohne zuletzt gelesene: keine leere Kategorie");
eq(k.jumpListe("en", ["a.txt", "b.txt"], ["\"--log=a.txt\""])[1].items.map((i) => i.title), ["b.txt"], "vom Spieler entfernte Eintraege kommen nicht wieder");
eq(k.jumpListe("en", ["a.txt"], ["--kompakt"])[0].items.length, 2, "eine entfernte Aufgabe bleibt weg");
eq(k.jumpListe("en", [], [])[0].items[0].title, "Open compact", "englisch");

// --- vorholen
const spur = [];
const f = (min) => ({ isMinimized: () => min, restore: () => spur.push("restore"), show: () => spur.push("show"), focus: () => spur.push("focus") });
k.vorholen(f(true)); eq(spur.splice(0), ["restore", "show", "focus"], "minimiert: wiederherstellen, zeigen, Fokus");
k.vorholen(f(false)); eq(spur.splice(0), ["show", "focus"], "sonst: zeigen, Fokus");
k.vorholen(null); eq(spur.length, 0, "kein Fenster: nichts");

if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log("\nALL PASSED");
