// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Speicher der Weeklies (src/main/weeklies.ts), ohne Electron und ohne
// Server: checkWeeklies (Schema, hoechstens sechs nicht geloeste
// Charaktere, nichts Gespeichertes darf fehlen) und putWeeklies,
// loadWeeklies, createWeeklies gegen eine Datei in einem Temp-Ordner
// (Spezifikation docs/superpowers/specs/2026-09-29-weeklies-design.md,
// Abschnitt 6; Plan Aufgabe W2).
//
// weeklies.ts haengt ueber paths.ts an electron; hier steht ein gestelltes
// electron wie in test-plan-core.mjs. Namen sind erfunden.
//
// Run:  npm run test:weeklies-store

import * as esbuild from "esbuild";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ordner = mkdtempSync(join(tmpdir(), "boro-weeklies-"));
process.env.APPDATA = ordner;
const electron = { name: "electron", setup(b) {
  b.onResolve({ filter: /^electron$/ }, () => ({ path: "electron", namespace: "gestellt" }));
  b.onLoad({ filter: /.*/, namespace: "gestellt" }, () => ({ loader: "js",
    contents: "export const app = { isPackaged: false, getAppPath: () => process.env.APPDATA, getPath: () => process.env.APPDATA };" }));
} };
const built = await esbuild.build({ entryPoints: [join(root, "src", "main", "weeklies.ts")], bundle: true, format: "esm",
  platform: "node", write: false, logLevel: "silent", plugins: [electron] });
const w = await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64"));

let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        bekommen " + a + "\n        erwartet " + b); }
}

const DATEI = join(ordner, "Borometer", "boro-weeklies.json");
const T = Date.UTC(2026, 8, 24, 8, 0);      // Do 24.09.2026 10:00 in Berlin
const leer = { v: 1, profile: [] };
const profil = (id, name, mehr = {}) => ({ id, name, zaehler: {}, aus: [], namen: {}, eigene: [], ...mehr });
const eins = profil("wtest00001", "Test Eins", {
  zaehler: { zitadelleNormal: { stand: 1, seit: T }, umwandlungsstein: { stand: 40, seit: T + 1000 } },
  aus: ["katalysator"], namen: { chaosprisma: "Prisma" },
  eigene: [{ schluessel: "eigen1", name: "Gildenkiste", menge: 2, takt: "tag" }],
  vorwoche: { reset: T - 7 * 86400000, zaehler: { illusionen: { stand: 3, seit: T - 86400000 } } },
});
const stand = (...profile) => ({ v: 1, profile });
const mit = (f) => { const c = structuredClone(eins); f(c); return stand(c); };
const ok = (x, alt = leer) => w.checkWeeklies(x, alt) !== null;

// --- Schema: was gilt
eq(ok(leer), true, "ein leerer Stand mit Version");
eq(ok(stand(eins)), true, "ein Charakter mit Zaehlern, Ausgeblendetem, Umbenanntem, eigenem Punkt und Vorwoche");
eq(w.checkWeeklies(stand(eins), leer), stand(eins), "der gepruefte Stand ist derselbe Stand");
eq(ok(stand(...[1, 2, 3, 4, 5, 6].map((i) => profil("wtest0000" + i, "Test " + i)))), true, "sechs Charaktere");
eq(ok(stand(...[1, 2, 3, 4, 5, 6].map((i) => profil("wtest0000" + i, "Test " + i)), profil("wtest00007", "Test 7", { geloest: true }))),
  true, "sechs Charaktere und ein geloester siebter");
eq(ok(mit((c) => { c.geloest = false; })), true, "geloest als false");
eq(ok(mit((c) => { c.eigene[0].geloest = true; })), true, "ein geloester eigener Punkt");
eq(ok(mit((c) => { c.name = "Ä".repeat(24); })), true, "ein Name mit 24 Zeichen und Umlaut");
eq(ok(mit((c) => { c.zaehler.zitadelleNormal.seit = Date.now() + 3600000; c.vorwoche.reset = Date.now() + 3600000; })), true,
  "seit und reset eine Stunde voraus (Uhren gehen nicht gleich)");
eq(ok(mit((c) => { c.aus = Array.from({ length: 150 }, (_, i) => "k" + i);
  c.namen = Object.fromEntries(Array.from({ length: 150 }, (_, i) => ["k" + i, "N"]));
  for (let i = 0; i < 149; i++) c.vorwoche.zaehler["k" + i] = { stand: 999, seit: T }; })), true,
  "150 ausgeblendete und 150 umbenannte Punkte, 150 Zaehler in der Vorwoche");
eq(ok(mit((c) => { const s = "eigen" + "z".repeat(35); c.eigene[0].schluessel = s; c.zaehler[s] = { stand: 1, seit: T }; })), true,
  "ein eigener Schluessel mit 40 Zeichen");
eq(ok(mit((c) => { c.eigene[0].menge = 999; c.zaehler.eigen1 = { stand: 999, seit: T }; })), true, "Menge und Stand 999");

// --- Schema: was abgelehnt wird
const falsch = [
  ["keine Version", { profile: [] }],
  ["Version 2", { v: 2, profile: [] }],
  ["Version als Text", { v: "1", profile: [] }],
  ["ein fremdes Feld oben", { v: 1, profile: [], mehr: 1 }],
  ["profile kein Array", { v: 1, profile: {} }],
  ["kein Objekt", [leer]],
  ["null", null],
  ["sieben nicht geloeste Charaktere", stand(...[1, 2, 3, 4, 5, 6, 7].map((i) => profil("wtest0000" + i, "Test " + i)))],
  ["zweimal dieselbe id", stand(profil("wtest00001", "A"), profil("wtest00001", "B"))],
  ["eine id ohne w", mit((c) => { c.id = "xtest00001"; })],
  ["eine id mit Pfad", mit((c) => { c.id = "../boro-co"; })],
  ["ein Name mit 25 Zeichen", mit((c) => { c.name = "x".repeat(25); })],
  ["ein leerer Name", mit((c) => { c.name = ""; })],
  ["ein Name mit Leerraum am Rand", mit((c) => { c.name = " Test"; })],
  ["ein Name mit Steuerzeichen", mit((c) => { c.name = "Test\u0007"; })],
  ["ein Name mit Richtungszeichen", mit((c) => { c.name = "Test‮"; })],
  ["ein Name als Zahl", mit((c) => { c.name = 5; })],
  ["geloest als Text", mit((c) => { c.geloest = "ja"; })],
  ["ein fremdes Feld im Charakter", mit((c) => { c.log = "x"; })],
  ["zaehler fehlt", mit((c) => { delete c.zaehler; })],
  ["ein Zaehler mit Stand 1000", mit((c) => { c.zaehler.zitadelleNormal.stand = 1000; })],
  ["ein Zaehler mit negativem Stand", mit((c) => { c.zaehler.zitadelleNormal.stand = -1; })],
  ["ein Zaehler mit Bruch", mit((c) => { c.zaehler.zitadelleNormal.stand = 0.5; })],
  ["ein Zaehler mit Stand als Text", mit((c) => { c.zaehler.zitadelleNormal.stand = "1"; })],
  ["ein Zaehler ohne seit", mit((c) => { delete c.zaehler.zitadelleNormal.seit; })],
  ["ein Zaehler mit seit vor 1970", mit((c) => { c.zaehler.zitadelleNormal.seit = -1; })],
  ["ein Zaehler mit seit hinter Date", mit((c) => { c.zaehler.zitadelleNormal.seit = 8640000000000001; })],
  ["ein Zaehler mit fremdem Feld", mit((c) => { c.zaehler.zitadelleNormal.name = "x"; })],
  ["ein Schluessel mit Leerzeichen", mit((c) => { c.zaehler["zitadelle normal"] = { stand: 1, seit: T }; })],
  ["ein Schluessel constructor", mit((c) => { c.zaehler.constructor = { stand: 1, seit: T }; })],
  ["ein Schluessel __proto__", JSON.parse(JSON.stringify(stand(eins)).replace('"zaehler":{', '"zaehler":{"__proto__":{"stand":1,"seit":1},'))],
  ["ein Schluessel mit 41 Zeichen", mit((c) => { c.zaehler["a".repeat(41)] = { stand: 1, seit: T }; })],
  ["151 Zaehler", mit((c) => { for (let i = 0; i < 151; i++) c.zaehler["k" + i] = { stand: 0, seit: T }; })],
  ["aus kein Array", mit((c) => { c.aus = "katalysator"; })],
  ["aus doppelt", mit((c) => { c.aus = ["katalysator", "katalysator"]; })],
  ["aus mit Pfad", mit((c) => { c.aus = ["../x"]; })],
  ["ein Umbenennen mit 61 Zeichen", mit((c) => { c.namen.chaosprisma = "x".repeat(61); })],
  ["ein leeres Umbenennen", mit((c) => { c.namen.chaosprisma = ""; })],
  ["ein Umbenennen als Zahl", mit((c) => { c.namen.chaosprisma = 1; })],
  ["ein Umbenennen unter toString", mit((c) => { c.namen.toString = "x"; })],
  ["ein eigener Punkt mit Menge 0", mit((c) => { c.eigene[0].menge = 0; })],
  ["ein eigener Punkt mit Menge 1000", mit((c) => { c.eigene[0].menge = 1000; })],
  ["ein eigener Punkt mit Takt monat", mit((c) => { c.eigene[0].takt = "monat"; })],
  ["ein eigener Punkt ohne Namen", mit((c) => { delete c.eigene[0].name; })],
  ["ein eigener Punkt mit fremdem Feld", mit((c) => { c.eigene[0].link = "https://example.com"; })],
  ["zwei eigene Punkte mit demselben Schluessel", mit((c) => { c.eigene.push({ ...c.eigene[0] }); })],
  ["101 eigene Punkte", mit((c) => { for (let i = 0; i < 101; i++) c.eigene.push({ schluessel: "eigen" + i, name: "E", menge: 1, takt: "woche" }); c.eigene.shift(); })],
  ["eine Vorwoche ohne reset", mit((c) => { delete c.vorwoche.reset; })],
  ["eine Vorwoche mit fremdem Feld", mit((c) => { c.vorwoche.mehr = 1; })],
  ["eine Vorwoche mit kaputtem Zaehler", mit((c) => { c.vorwoche.zaehler.illusionen.stand = "drei"; })],
  // Nacharbeit K-6: kein Zeitpunkt mehr als einen Tag vor der Uhr des Rechners (er setzte nie mehr zurueck)
  ["ein Zaehler mit seit zwei Tage voraus", mit((c) => { c.zaehler.zitadelleNormal.seit = Date.now() + 2 * 86400000; })],
  ["eine Vorwoche mit reset zwei Tage voraus", mit((c) => { c.vorwoche.reset = Date.now() + 2 * 86400000; })],
  ["ein Zaehler der Vorwoche mit seit zwei Tage voraus", mit((c) => { c.vorwoche.zaehler.illusionen.seit = Date.now() + 2 * 86400000; })],
  // Nacharbeit K-7: eigene Punkte mit Vorsilbe eigen, nie ein Schluessel der Grundliste
  ["ein eigener Punkt mit dem Schluessel katalysator", mit((c) => { c.eigene[0].schluessel = "katalysator"; })],
  ["ein eigener Punkt mit dem Schluessel eigen allein", mit((c) => { c.eigene[0].schluessel = "eigen"; })],
  ["ein eigener Punkt mit Grossbuchstaben nach eigen", mit((c) => { c.eigene[0].schluessel = "eigenX"; })],
  // Nacharbeit K-8: die Grenzen je Profil und in der Vorwoche
  ["151 ausgeblendete Punkte", mit((c) => { c.aus = Array.from({ length: 151 }, (_, i) => "k" + i); })],
  ["151 Umbenennungen", mit((c) => { c.namen = Object.fromEntries(Array.from({ length: 151 }, (_, i) => ["k" + i, "N"])); })],
  ["151 Zaehler in der Vorwoche (illusionen und 150 mehr)", mit((c) => { for (let i = 0; i < 150; i++) c.vorwoche.zaehler["k" + i] = { stand: 0, seit: T }; })],
  ["ein Zaehler der Vorwoche mit Stand 1000", mit((c) => { c.vorwoche.zaehler.illusionen.stand = 1000; })],
  ["61 Charaktere", stand(...Array.from({ length: 61 }, (_, i) => profil("w" + String(i).padStart(9, "0"), "T", { geloest: true })))],
];
for (const [was, x] of falsch) eq(ok(x), false, "abgelehnt: " + was);

// --- nichts Gespeichertes darf fehlen (kein Loeschen durch Weglassen)
const alt = w.checkWeeklies(stand(eins, profil("wtest00002", "Test Zwei", { geloest: true })), leer);
eq(alt !== null, true, "der gespeicherte Stand mit einem geloesten Charakter");
eq(ok(stand(eins, profil("wtest00002", "Test Zwei", { geloest: true })), alt), true, "derselbe Stand noch einmal");
eq(ok(stand(eins, profil("wtest00002", "Test Zwei"), profil("wtest00003", "Test Drei")), alt), true,
  "Rueckgaengig (geloest faellt) und ein neuer Charakter");
eq(ok(stand(eins), alt), false, "der geloeste Charakter fehlt: abgelehnt");
eq(ok(stand(profil("wtest00002", "Test Zwei", { geloest: true })), alt), false, "ein Charakter fehlt: abgelehnt");
const zwei = profil("wtest00002", "Test Zwei", { geloest: true });
eq(ok(stand(mit((c) => { delete c.zaehler.umwandlungsstein; }).profile[0], zwei), alt), false, "ein Zaehler fehlt: abgelehnt");
eq(ok(stand(mit((c) => { c.eigene = []; }).profile[0], zwei), alt), false, "ein eigener Punkt fehlt: abgelehnt");
eq(ok(stand(mit((c) => { c.eigene[0].geloest = true; }).profile[0], zwei), alt), true, "ein eigener Punkt wird geloest, nicht entfernt");
eq(ok(stand(mit((c) => { delete c.vorwoche; }).profile[0], zwei), alt), false, "die Vorwoche fehlt: abgelehnt");
eq(ok(stand(mit((c) => { c.vorwoche = { reset: T, zaehler: {} }; }).profile[0], zwei), alt), true, "eine neuere Vorwoche ersetzt die alte");
// Nacharbeit K-1: eine aeltere Vorwoche, oder dieselbe mit weniger Zaehlern, ist ein Weglassen
eq(ok(stand(mit((c) => { c.vorwoche = { reset: 0, zaehler: {} }; }).profile[0], zwei), alt), false, "eine aeltere, leere Vorwoche: abgelehnt");
eq(ok(stand(mit((c) => { c.vorwoche.reset -= 7 * 86400000; }).profile[0], zwei), alt), false,
  "eine aeltere Vorwoche mit denselben Zaehlern: abgelehnt");
eq(ok(stand(mit((c) => { c.vorwoche.zaehler = {}; }).profile[0], zwei), alt), false,
  "dieselbe Vorwoche ohne ihren Zaehler: abgelehnt");
eq(ok(stand(mit((c) => { c.vorwoche.zaehler.altarNormal = { stand: 1, seit: T - 86400000 }; }).profile[0], zwei), alt), true,
  "dieselbe Vorwoche mit einem Zaehler mehr");
eq(ok(stand(mit((c) => { c.aus = []; c.namen = {}; }).profile[0], zwei), alt), true,
  "Grundliste wiederherstellen und Umbenennen zuruecknehmen sind erlaubt");

// --- nie blind uebernommen: nur die Felder des Schemas, neu gebaut
const roh = stand(eins);
const sauber = w.checkWeeklies(roh, leer);
eq(sauber.profile[0] !== roh.profile[0] && sauber.profile[0].zaehler !== roh.profile[0].zaehler, true, "der Stand wird neu gebaut, nicht uebernommen");

/* Ein gueltiger Stand mit genau n Zeichen JSON-Text: eins und dazu geloeste
   Charaktere mit Umbenennungen (hoechstens 150 je Charakter); der letzte Name
   wird auf die genaue Laenge gebracht. Rein bestimmt, also immer derselbe. */
function aufLaenge(n) {
  const x = stand(structuredClone(eins));
  let k = 0, q = null, letzter = "";
  const len = () => JSON.stringify(x).length;
  const dazu = (text) => {
    if (!q || Object.keys(q.namen).length >= 150) {
      q = profil("w" + String(x.profile.length).padStart(9, "0"), "Test", { geloest: true });
      x.profile.push(q);
    }
    letzter = "n" + (k++).toString(36);
    q.namen[letzter] = text;
  };
  while (n - len() > 300) dazu("x".repeat(45));
  while (n - len() > 15) dazu("x");
  q.namen[letzter] += "x".repeat(n - len());
  if (len() !== n || q.namen[letzter].length > 60) throw new Error("aufLaenge " + n + ": " + len());
  return x;
}

// --- die Datei
try {
  eq(w.loadWeeklies(), leer, "ohne Datei: ein leerer Stand");
  eq(existsSync(DATEI), false, "ein GET legt keine Datei an");
  // Nacharbeit K-8: ganz ohne Datei speichert putWeeklies, und keine Temp-Datei bleibt zurueck
  eq(w.putWeeklies(stand(eins)), "saved", "putWeeklies ohne Datei: gespeichert");
  eq([w.loadWeeklies(), existsSync(DATEI + ".tmp")], [stand(eins), false], "gelesen wie gesendet, keine .tmp-Datei");
  rmSync(DATEI);
  w.createWeeklies();
  eq(JSON.parse(readFileSync(DATEI, "utf8")), leer, "erster Start: eine leere Datei mit der Version");
  eq(w.putWeeklies(stand(eins)), "saved", "putWeeklies speichert einen Stand");
  eq(existsSync(DATEI + ".tmp"), false, "nach dem Speichern bleibt keine .tmp-Datei");
  eq(w.loadWeeklies(), stand(eins), "loadWeeklies liest ihn zurueck");
  w.createWeeklies();
  eq(w.loadWeeklies(), stand(eins), "ein zweiter Start ueberschreibt nichts");
  eq(w.putWeeklies(leer), "refused", "ein leerer Stand loescht den Charakter nicht");
  eq(w.putWeeklies({ v: 1, profile: [{ ...eins, name: "x".repeat(25) }] }), "refused", "ein falsches Schema");
  eq(w.putWeeklies(undefined), "refused", "nichts gesendet");
  const gross = stand({ ...eins, eigene: [...eins.eigene, { schluessel: "eigengross", name: "G", menge: 1, takt: "woche", pad: "x".repeat(270000) }] });
  eq(w.putWeeklies(gross), "refused", "ueber 256 KB");
  eq(w.loadWeeklies(), stand(eins), "nach den Ablehnungen steht der Stand noch");
  // Nacharbeit K-8: die Grenze genau, 262144 Zeichen gehen, 262145 nicht (beide Staende sonst gueltig)
  const [genau, einsMehr] = [262144, 262145].map(aufLaenge);
  eq([JSON.stringify(genau).length, JSON.stringify(einsMehr).length], [262144, 262145], "zwei Staende mit 262144 und 262145 Zeichen");
  eq([ok(genau, stand(eins)), ok(einsMehr, stand(eins))], [true, true], "beide sind nach dem Schema gueltig");
  eq(w.putWeeklies(einsMehr), "refused", "262145 Zeichen: abgelehnt");
  eq(w.putWeeklies(genau), "saved", "262144 Zeichen: gespeichert");
  eq(w.loadWeeklies(), w.checkWeeklies(genau, leer), "der grosse Stand wird gelesen, wie er gesendet wurde");
  // Nacharbeit K-8: ein Schreibfehler (ein Ordner, wo die Temp-Datei hin soll) ist voruebergehend
  mkdirSync(DATEI + ".tmp");
  eq(w.putWeeklies(genau), "unavailable", "ein Schreibfehler: unavailable (503)");
  rmSync(DATEI + ".tmp", { recursive: true });
  eq(w.loadWeeklies(), w.checkWeeklies(genau, leer), "nach dem Schreibfehler steht der alte Stand noch");
  writeFileSync(DATEI, JSON.stringify(stand(eins)));
  writeFileSync(DATEI, "﻿" + JSON.stringify(stand(eins)));
  eq(w.loadWeeklies(), stand(eins), "eine Datei mit Byte-Order-Mark wird gelesen");
  writeFileSync(DATEI, "{kaputt");
  eq(w.loadWeeklies(), null, "eine kaputte Datei: null (503), kein leerer Stand");
  eq(w.putWeeklies(stand(eins)), "unavailable", "eine kaputte Datei wird nicht ueberschrieben (503)");
  eq(readFileSync(DATEI, "utf8"), "{kaputt", "die kaputte Datei bleibt, wie sie ist");
  writeFileSync(DATEI, JSON.stringify({ v: 2, profile: [] }));
  eq([w.loadWeeklies(), w.putWeeklies(leer)], [null, "unavailable"], "eine Datei einer anderen Version wird nicht ueberschrieben");
  w.createWeeklies();
  eq(JSON.parse(readFileSync(DATEI, "utf8")), { v: 2, profile: [] }, "createWeeklies laesst eine vorhandene Datei stehen");
} finally {
  rmSync(ordner, { recursive: true, force: true });
}

if (failed) { console.log(`weeklies-store: ${failed} FAIL`); process.exit(1); }
console.log("weeklies-store: all ok");
