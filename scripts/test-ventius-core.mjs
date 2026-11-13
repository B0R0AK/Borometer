// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Ventius als Baustein der neuen Analyse (src/renderer/ventius-core.ts, #414,
// Spezifikation 2026-11-08-analyse-neu-zeitleiste-design.md 8): Form 1 + 3 N,
// ein Punkt ist ein Nachbeben (3 Treffer), "nur Oeffner" ist lesbar mit 0
// Nachbeben, Kampfende zaehlt nicht als fehlend. Gerechnet auf den reduzierten
// Kampfdaten und auf kleinen, von Hand gebauten Salven.
//
// Run:  npm run test:ventius-core

import { daten, decke, ende, eq, hatVentius, kampf, ladeKern, ok } from "./_analyse-test.mjs";

const v = await ladeKern("ventius-core", true);

// ---- die Form einer Salve
eq(v.ventiusForm([1]), 0, "nur der Oeffner: 0 Nachbeben");
eq(v.ventiusForm([1, 3]), 1, "Oeffner und eine Welle: 1 Nachbeben");
eq(v.ventiusForm([1, 3, 3, 3]), 3, "drei Nachbeben");
for (const w of [[1, 1, 3], [3, 3], [1, 6], [1, 2], [2], []]) eq(v.ventiusForm(w), -1, "unlesbar: " + JSON.stringify(w));
eq(v.ventiusTreffer(3), 10, "ein Punkt ist ein Nachbeben: 1 + 3 x 3 = 10 Treffer");
eq(v.ventiusTreffer(0), 1, "ohne Nachbeben bleibt der Oeffner: 1 Treffer");

// ---- eine kleine, handgebaute Salvenreihe (Decke 3 = 10 Treffer)
const salve = (t, nb, wellen) => [t, nb, nb < 0 ? wellen.reduce((x, y) => x + y, 0) : 1 + 3 * nb, 1000, 1, 1, wellen];
const mini = (salven, dauerS = 100) => ({ hauptziel: "X", dauerS, schaden: 1, dps: 1, schadenJeSekunde: [], einsaetze: [], zielwechsel: [], ventius: { salven } });
const k1 = mini([
  salve(10, 3, [1, 3, 3, 3]),
  salve(20, 2, [1, 3, 3]),
  salve(30, 0, [1]),                // nur Oeffner mitten im Kampf
  salve(40, -1, [1, 1, 3]),         // Doppelsalve
  salve(50, -1, [3, 3]),            // ohne Oeffner
  salve(60, -1, [1, 6]),            // Mehrziel-Welle
  salve(70, -1, [1, 2]),            // Teilwelle
  salve(98.8, 0, [1]),              // in den letzten 1,5 s: Kampfende
]);
const a = v.ventiusAuswertung(k1, 0);
eq(a.top, 3, "Decke des Kampfs: die beste lesbare Salve");
eq(a.decke, 3, "ohne Decke des Gegners gilt die des Kampfs");
eq(a.soll, 10, "soll: 1 + 3 x 3");
eq([a.gesamt, a.lesbar, a.unlesbar, a.kampfende], [8, 3, 4, 1], "gesamt, lesbar (ohne Kampfende), unlesbar, Kampfende");
eq([a.anDecke, a.unter], [1, 2], "eine an der Decke, zwei darunter (Nachbeben 2 und nur Oeffner)");
eq([a.getroffen, a.moeglich, a.gefehlt], [10 + 7 + 1, 30, 12], "nur Oeffner zaehlt mit: 12 Treffer fehlen");
eq(a.salven[2].status, "unter", "nur Oeffner mitten im Kampf ist unter der Decke");
eq(a.salven[2].nurOeffner, true, "nur Oeffner wird benannt");
eq(a.salven[7].status, "kampfende", "die Salve in den letzten 1,5 s ist Kampfende");
eq(a.salven[7].fehlend, null, "Kampfende fehlt nicht");
eq(a.salven.slice(3, 7).map((s) => s.grund), ["doppelsalve", "ohne-oeffner", "mehrziel", "teilwelle"], "Gruende der unlesbaren Salven");
eq(a.gruende, { doppelsalve: 1, "ohne-oeffner": 1, mehrziel: 1, teilwelle: 1 }, "Gruende gezaehlt");
eq(a.stufen.map((s) => [s.nb, s.n, s.treffer]), [[3, 1, 10], [2, 1, 7], [0, 1, 1]], "Stufen: Schaden je Nachbeben-Stufe");

// die letzte Salve des Kampfs ist Kampfende, auch weit vor dem Ende
const k2 = mini([salve(10, 3, [1, 3, 3, 3]), salve(20, 1, [1, 3])], 100);
eq(v.ventiusAuswertung(k2, 0).salven[1].status, "kampfende", "die letzte Salve zaehlt als Kampfende");
eq(v.ventiusAuswertung(k2, 0).gefehlt, 0, "und fehlt nicht");

// Decke des Gegners hoeher als die des Kampfs: sie gilt, und nieErreicht sagt es
const k3 = mini([salve(10, 2, [1, 3, 3]), salve(20, 2, [1, 3, 3]), salve(30, 2, [1, 3, 3])]);
const a3 = v.ventiusAuswertung(k3, 4);
eq([a3.top, a3.deckeGegner, a3.decke, a3.soll, a3.nieErreicht], [2, 4, 4, 13, true], "Decke des Gegners gilt");
eq(a3.gefehlt, 12, "zwei lesbare Salven (die letzte ist Kampfende): 2 x (13 - 7)");

// ohne Salven gibt es den Baustein nicht
eq(v.ventiusAuswertung(mini([]), 3), null, "ohne Salven null");
for (const k of daten.kaempfe.filter((x) => !hatVentius(x))) eq(v.ventiusAuswertung(k, 5), null, "ohne Ventius null: " + k.hauptziel);

// ---- die drei Kaempfe mit Ventius: Rechnung geht auf
for (const k of daten.kaempfe.filter(hatVentius)) {
  const r = v.ventiusAuswertung(k, decke(k));
  const n = k.ventius.salven.length;
  ok(r.gesamt === n && r.lesbar + r.unlesbar + r.kampfende === n, "Summe der Arten: " + k.hauptziel, [r.gesamt, r.lesbar, r.unlesbar, r.kampfende]);
  ok(r.moeglich === r.lesbar * r.soll, "moeglich = lesbar x soll: " + k.hauptziel);
  ok(r.gefehlt === r.moeglich - r.getroffen && r.gefehlt >= 0, "gefehlt = moeglich - getroffen: " + k.hauptziel, r.gefehlt);
  ok(r.anDecke + r.unter === r.lesbar, "an der Decke plus darunter = lesbar: " + k.hauptziel);
  ok(r.decke >= r.top && r.decke >= decke(k), "die Decke ist die hoechste bekannte: " + k.hauptziel);
  // ein Bereich zaehlt nur seine Salven
  const h = v.ventiusAuswertung(k, decke(k), 0, 60);
  ok(h.gesamt === k.ventius.salven.filter((s) => s[0] < 60).length, "Bereich zaehlt nur seine Salven: " + k.hauptziel);
}

// ---- jeder Schluessel steht in beiden Sprachen
const schluessel = new Set();
for (const g of ["doppelsalve", "ohne-oeffner", "mehrziel", "teilwelle"]) schluessel.add(v.ventiusGrundSchluessel(g));
for (const s of schluessel) ok(typeof v.I18N.de[s] !== "undefined" && typeof v.I18N.en[s] !== "undefined", "Woerterbuch DE und EN: " + s);

ende();
