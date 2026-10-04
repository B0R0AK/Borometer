// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Kern der Weeklies (src/renderer/weeklies-core.ts), ohne Seite:
// Grundliste, Reset-Regel (Donnerstag 10:00 und taeglich 10:00 in
// Europe/Berlin), Anzeige-Stand und Vorwoche (Spezifikation
// docs/superpowers/specs/2026-09-29-weeklies-design.md, Abschnitte 3 und 5).
//
// Die Rechner-Zeitzone darf nichts aendern: der Test startet sich selbst
// noch zweimal, mit TZ=UTC und TZ=America/New_York, und vergleicht die
// Ergebnisse mit denen des eigenen Laufs.
//
// Run:  npm run test:weeklies-core

import * as esbuild from "esbuild";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const hier = fileURLToPath(import.meta.url);
const root = join(dirname(hier), "..");
const b = await esbuild.build({
  entryPoints: [join(root, "src", "renderer", "weeklies-core.ts")],
  bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))],
});
const core = await import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));

const KIND = process.env.WEEKLIES_KIND === "1";
let failed = 0;
function ok(cond, name, detail) {
  if (cond) { if (!KIND) console.log("  ok    " + name); }
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "\n        " + JSON.stringify(detail))); }
}
const iso = (ms) => typeof ms === "number" && isFinite(ms) ? new Date(ms).toISOString() : String(ms);
const Z = (s) => Date.parse(s);            // UTC-Zeitpunkt aus ISO mit "Z"
const H = 3600000, TAG = 24 * H;
function reset(jetzt, takt, erwartet, name) {
  const r = core.letzterReset(Z(jetzt), takt);
  ok(r === Z(erwartet), name, { jetzt, takt, bekommen: iso(r), erwartet });
}
function naechst(jetzt, takt, erwartet, name) {
  const r = core.naechsterReset(Z(jetzt), takt);
  ok(r === Z(erwartet), name, { jetzt, takt, bekommen: iso(r), erwartet });
}

// ---- Wochen-Reset im Sommer (CEST, UTC+2): Do 1.10.2026 10:00 = 08:00Z
{
  reset("2026-10-01T07:59:00Z", "woche", "2026-09-24T08:00:00Z", "Do 09:59: noch der Reset der Vorwoche");
  reset("2026-10-01T08:00:00Z", "woche", "2026-10-01T08:00:00Z", "Do 10:00: genau der neue Reset");
  reset("2026-10-01T08:01:00Z", "woche", "2026-10-01T08:00:00Z", "Do 10:01: der neue Reset");
  reset("2026-09-30T12:00:00Z", "woche", "2026-09-24T08:00:00Z", "Mi: der Reset vom Donnerstag davor");
  reset("2026-10-02T12:00:00Z", "woche", "2026-10-01T08:00:00Z", "Fr: der Reset vom Donnerstag");
  reset("2026-10-04T21:59:59Z", "woche", "2026-10-01T08:00:00Z", "So spaet: noch der Donnerstag");
  naechst("2026-10-01T07:59:00Z", "woche", "2026-10-01T08:00:00Z", "naechster Wochen-Reset Do 09:59: in einer Minute");
  naechst("2026-10-01T08:00:00Z", "woche", "2026-10-08T08:00:00Z", "naechster Wochen-Reset Do 10:00: eine Woche spaeter");
  naechst("2026-09-30T12:00:00Z", "woche", "2026-10-01T08:00:00Z", "naechster Wochen-Reset am Mi: morgen");
}

// ---- Tages-Reset: jeden Tag 10:00
{
  reset("2026-09-29T07:59:00Z", "tag", "2026-09-28T08:00:00Z", "taeglich 09:59: der Reset von gestern");
  reset("2026-09-29T08:00:00Z", "tag", "2026-09-29T08:00:00Z", "taeglich 10:00: der Reset von heute");
  reset("2026-09-29T21:30:00Z", "tag", "2026-09-29T08:00:00Z", "taeglich 23:30: der Reset von heute");
  reset("2026-09-29T22:30:00Z", "tag", "2026-09-29T08:00:00Z", "taeglich 00:30 (neuer Tag in Berlin): der Reset von gestern");
  naechst("2026-09-29T07:59:00Z", "tag", "2026-09-29T08:00:00Z", "naechster Tages-Reset 09:59: heute 10:00");
  naechst("2026-09-29T08:00:00Z", "tag", "2026-09-30T08:00:00Z", "naechster Tages-Reset 10:00: morgen 10:00");
  // der Tages-Reset am Donnerstag ist derselbe Zeitpunkt wie der Wochen-Reset
  ok(core.letzterReset(Z("2026-10-01T09:00:00Z"), "tag") === core.letzterReset(Z("2026-10-01T09:00:00Z"), "woche"),
    "Do nach 10:00: Tages- und Wochen-Reset fallen zusammen");
}

// ---- Winterzeit beginnt: So 25.10.2026 (letzter Sonntag im Oktober), danach CET (UTC+1)
{
  reset("2026-10-24T12:00:00Z", "tag", "2026-10-24T08:00:00Z", "Sa vor dem Wechsel: 10:00 CEST = 08:00Z");
  naechst("2026-10-24T12:00:00Z", "tag", "2026-10-25T09:00:00Z", "naechster Tages-Reset am Wechseltag: 10:00 CET = 09:00Z");
  reset("2026-10-25T08:30:00Z", "tag", "2026-10-24T08:00:00Z", "So 09:30 CET: noch der Reset von Samstag");
  reset("2026-10-25T09:00:00Z", "tag", "2026-10-25T09:00:00Z", "So 10:00 CET: der Reset von heute");
  ok(core.naechsterReset(Z("2026-10-24T12:00:00Z"), "tag") - core.letzterReset(Z("2026-10-24T12:00:00Z"), "tag") === 25 * H,
    "der Tag des Wechsels hat 25 Stunden");
  reset("2026-10-26T12:00:00Z", "woche", "2026-10-22T08:00:00Z", "Mo nach dem Wechsel: Wochen-Reset noch in CEST");
  naechst("2026-10-26T12:00:00Z", "woche", "2026-10-29T09:00:00Z", "naechster Wochen-Reset in CET: 09:00Z");
  reset("2026-10-29T08:59:00Z", "woche", "2026-10-22T08:00:00Z", "Do 09:59 CET: noch der alte Reset");
  reset("2026-10-29T09:00:00Z", "woche", "2026-10-29T09:00:00Z", "Do 10:00 CET: der neue Reset");
}

// ---- Sommerzeit beginnt: So 29.3.2026 (letzter Sonntag im Maerz), danach CEST (UTC+2)
{
  reset("2026-03-28T12:00:00Z", "tag", "2026-03-28T09:00:00Z", "Sa vor dem Wechsel: 10:00 CET = 09:00Z");
  reset("2026-03-29T07:59:00Z", "tag", "2026-03-28T09:00:00Z", "So 09:59 CEST: noch der Reset von Samstag");
  reset("2026-03-29T08:00:00Z", "tag", "2026-03-29T08:00:00Z", "So 10:00 CEST: der Reset von heute");
  naechst("2026-03-28T12:00:00Z", "tag", "2026-03-29T08:00:00Z", "naechster Tages-Reset am Wechseltag: 08:00Z");
  ok(core.naechsterReset(Z("2026-03-28T12:00:00Z"), "tag") - core.letzterReset(Z("2026-03-28T12:00:00Z"), "tag") === 23 * H,
    "der Tag des Wechsels hat 23 Stunden");
  reset("2026-03-30T12:00:00Z", "woche", "2026-03-26T09:00:00Z", "Mo nach dem Wechsel: Wochen-Reset noch in CET");
  naechst("2026-03-30T12:00:00Z", "woche", "2026-04-02T08:00:00Z", "naechster Wochen-Reset in CEST: 08:00Z");
}

// ---- Monats-Reset (Spezifikation 10, Annahme): der 1. des Monats um 10:00 in Berlin
{
  reset("2026-10-01T07:59:00Z", "monat", "2026-09-01T08:00:00Z", "1.10. 09:59 CEST: noch der Reset vom 1.9.");
  reset("2026-10-01T08:00:00Z", "monat", "2026-10-01T08:00:00Z", "1.10. 10:00 CEST: der neue Monats-Reset");
  reset("2026-10-31T22:59:00Z", "monat", "2026-10-01T08:00:00Z", "31.10. 23:59 CET: noch der Oktober");
  reset("2026-11-01T08:59:00Z", "monat", "2026-10-01T08:00:00Z", "1.11. 09:59 CET: noch der Oktober");
  reset("2026-11-01T09:00:00Z", "monat", "2026-11-01T09:00:00Z", "1.11. 10:00 CET = 09:00Z");
  reset("2027-01-15T12:00:00Z", "monat", "2027-01-01T09:00:00Z", "Mitte Januar: der 1.1. (ueber den Jahreswechsel)");
  reset("2027-01-01T08:30:00Z", "monat", "2026-12-01T09:00:00Z", "1.1. 09:30: noch der Dezember");
  reset("2026-03-01T09:00:00Z", "monat", "2026-03-01T09:00:00Z", "1.3. 10:00 CET (Februar davor kurz)");
  reset("2026-04-01T08:00:00Z", "monat", "2026-04-01T08:00:00Z", "1.4. 10:00 CEST = 08:00Z (nach dem Wechsel)");
  naechst("2026-10-15T12:00:00Z", "monat", "2026-11-01T09:00:00Z", "naechster Monats-Reset im Oktober: 1.11. 10:00 CET");
  naechst("2026-12-20T12:00:00Z", "monat", "2027-01-01T09:00:00Z", "naechster Monats-Reset im Dezember: 1.1.");
  naechst("2026-10-01T08:00:00Z", "monat", "2026-11-01T09:00:00Z", "naechster Monats-Reset genau am Reset: ein Monat spaeter");
  const z = { stand: 2, seit: Z("2026-10-10T12:00:00Z") };
  ok(core.anzeigeStand(z, "monat", Z("2026-10-29T12:00:00Z")) === 2, "Monatspunkt: ueber den Wochen-Reset hinweg bleibt der Stand");
  ok(core.anzeigeStand(z, "monat", Z("2026-11-01T09:00:00Z")) === 0, "Monatspunkt: am 1.11. 10:00 ist er 0");
}

// ---- Montags-Reset (Spezifikation 10, Portal der Unendlichkeit Mo-Mo): Montag 10:00 in Berlin
{
  reset("2026-10-05T07:59:00Z", "montag", "2026-09-28T08:00:00Z", "Mo 05.10. 09:59: noch der Montag davor");
  reset("2026-10-05T08:00:00Z", "montag", "2026-10-05T08:00:00Z", "Mo 05.10. 10:00: der neue Reset");
  reset("2026-10-01T12:00:00Z", "montag", "2026-09-28T08:00:00Z", "Do: der Montag dieser Woche");
  reset("2026-10-04T21:00:00Z", "montag", "2026-09-28T08:00:00Z", "So 23:00: noch der Montag davor");
  naechst("2026-10-01T12:00:00Z", "montag", "2026-10-05T08:00:00Z", "naechster Montags-Reset am Do: Mo 10:00");
  naechst("2026-10-05T08:00:00Z", "montag", "2026-10-12T08:00:00Z", "naechster Montags-Reset genau am Reset: eine Woche spaeter");
  naechst("2026-10-24T12:00:00Z", "montag", "2026-10-26T09:00:00Z", "ueber die Winterzeit: Mo 26.10. 10:00 CET = 09:00Z");
  const z = { stand: 1, seit: Z("2026-09-29T12:00:00Z") };   // Di
  ok(core.anzeigeStand(z, "montag", Z("2026-10-01T09:00:00Z")) === 1, "Montagspunkt: ueber den Donnerstags-Reset hinweg bleibt der Stand");
  ok(core.anzeigeStand(z, "montag", Z("2026-10-05T08:00:00Z")) === 0, "Montagspunkt: am Montag 10:00 ist er 0");
}

// ---- ueber ein ganzes Jahr: jeder Wochen-Reset ist ein Donnerstag 10:00 in Berlin
{
  const berlin = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  let t = Z("2026-01-01T00:00:00Z"), schlecht = [];
  for (let i = 0; i < 400; i++) {
    const w = core.letzterReset(t, "woche"), d = core.letzterReset(t, "tag");
    const n = core.naechsterReset(t, "woche"), m = core.naechsterReset(t, "tag");
    const f = berlin.format(w), g = berlin.format(d);
    if (!(w <= t && t < n && d <= t && t < m && t - w < 8 * TAG && n - t <= 7 * TAG + H && t - d < 25 * H && m - t <= 25 * H)) schlecht.push(["spanne", iso(t)]);
    if (!/^Thu,? 10:00$/.test(f) || !/ 10:00$/.test(g)) schlecht.push([iso(t), f, g]);
    if (core.letzterReset(n, "woche") !== n || core.letzterReset(m, "tag") !== m) schlecht.push(["grenze", iso(t)]);
    t += 22 * H + 17 * 60000;
  }
  ok(schlecht.length === 0, "ein Jahr lang: Reset immer Do 10:00 bzw. 10:00 Berlin, jetzt liegt dazwischen", schlecht.slice(0, 5));
}

// ---- Anzeige-Stand: vor dem letzten Reset gesetzt heisst 0
{
  const jetzt = Z("2026-10-02T12:00:00Z"), r = Z("2026-10-01T08:00:00Z");
  ok(core.anzeigeStand(undefined, "woche", jetzt) === 0, "ohne Zaehler: 0");
  ok(core.anzeigeStand({ stand: 2, seit: r - 1 }, "woche", jetzt) === 0, "vor dem Wochen-Reset gesetzt: 0");
  ok(core.anzeigeStand({ stand: 2, seit: r }, "woche", jetzt) === 2, "genau zum Reset gesetzt: zaehlt");
  ok(core.anzeigeStand({ stand: 3, seit: r + H }, "woche", jetzt) === 3, "nach dem Reset gesetzt: zaehlt");
  ok(core.anzeigeStand({ stand: 1, seit: Z("2026-10-02T07:00:00Z") }, "tag", jetzt) === 0, "taeglich: vor 10:00 heute gesetzt: 0");
  ok(core.anzeigeStand({ stand: 1, seit: Z("2026-10-02T08:30:00Z") }, "tag", jetzt) === 1, "taeglich: nach 10:00 heute gesetzt: zaehlt");
  ok(core.anzeigeStand({ stand: 1, seit: Z("2026-10-02T07:00:00Z") }, "woche", jetzt) === 1, "derselbe Zeitpunkt zaehlt als Wochenpunkt weiter");
  ok(core.anzeigeStand({ stand: -4, seit: r + H }, "woche", jetzt) === 0 &&
     core.anzeigeStand({ stand: 2.7, seit: r + H }, "woche", jetzt) === 2 &&
     core.anzeigeStand({ stand: "x", seit: r + H }, "woche", jetzt) === 0 &&
     core.anzeigeStand({ stand: 2, seit: "x" }, "woche", jetzt) === 0, "kaputte Zaehler: ganze Zahl ab 0");
}

// ---- Vorwoche: der alte Wochenstand bleibt eine Woche erhalten
{
  const r0 = Z("2026-09-24T08:00:00Z"), r1 = Z("2026-10-01T08:00:00Z");
  const profil = {
    id: "p1", name: "A", aus: [], namen: {},
    eigene: [{ schluessel: "eigen1", name: "X", menge: 2, takt: "woche" }, { schluessel: "eigen2", name: "Y", menge: 1, takt: "tag" }],
    zaehler: {
      zitadelleNormal: { stand: 1, seit: r0 + H },           // letzte Woche: Wochenpunkt
      illusionen: { stand: 2, seit: r0 + 2 * H },             // letzte Woche: Wochenpunkt
      phantomstein: { stand: 1, seit: r0 + H },               // letzte Woche, aber taeglich
      vererbungsstein: { stand: 1, seit: r0 + H },            // letzte Woche, aber monatlich (Spezifikation 10)
      unendlichkeitMontag: { stand: 1, seit: r0 + H },        // letzte Woche, aber Montag bis Montag (Spezifikation 10)
      eigen1: { stand: 2, seit: r0 + 3 * H },                 // eigener Wochenpunkt
      eigen2: { stand: 1, seit: r0 + 3 * H },                 // eigener Tagespunkt
      chaosprisma: { stand: 1, seit: r0 - 3 * TAG },          // vorletzte Woche
      umwandlungsstein: { stand: 40, seit: r1 + H },          // diese Woche
    },
  };
  const kopie = JSON.stringify(profil);
  const vorher = core.vorwocheSichern(profil, r1 - 60000);
  ok(vorher.vorwoche && vorher.vorwoche.reset === r0 - 7 * TAG && Object.keys(vorher.vorwoche.zaehler).join() === "chaosprisma",
    "vor dem Reset: Vorwoche ist die Woche davor (nur der Stand von dort)", vorher.vorwoche);
  const p = core.vorwocheSichern(profil, r1 + 2 * H);
  ok(JSON.stringify(profil) === kopie, "das uebergebene Profil wird nicht veraendert");
  ok(p.vorwoche && p.vorwoche.reset === r0, "Vorwoche traegt den Reset, mit dem sie begann", p.vorwoche);
  const vz = p.vorwoche.zaehler;
  ok(Object.keys(vz).sort().join() === "eigen1,illusionen,zitadelleNormal", "Vorwoche: nur Wochenpunkte der letzten Woche", vz);
  ok(vz.illusionen.stand === 2 && vz.eigen1.stand === 2, "Vorwoche: die Staende bleiben", vz);
  ok(JSON.stringify(p.zaehler) === JSON.stringify(profil.zaehler), "die Zaehler selbst bleiben, nichts geht verloren");
  ok(core.vorwocheSichern(p, r1 + 3 * H) === p, "zweimal gesichert: nichts aendert sich");
  // ein neuer Stand wird gesetzt, die Vorwoche bleibt
  const p2 = { ...p, zaehler: { ...p.zaehler, illusionen: { stand: 1, seit: r1 + 4 * H } } };
  const p3 = core.vorwocheSichern(p2, r1 + 5 * H);
  ok(p3.vorwoche.zaehler.illusionen.stand === 2 && p3.vorwoche.zaehler.zitadelleNormal.stand === 1,
    "nach dem Setzen: die Vorwoche behaelt den alten Stand", p3.vorwoche);
  // eine Woche spaeter: die neue Vorwoche ersetzt die alte (eine Woche, nicht mehr)
  const r2 = Z("2026-10-08T08:00:00Z");
  const p4 = core.vorwocheSichern(p3, r2 + H);
  ok(p4.vorwoche.reset === r1 && Object.keys(p4.vorwoche.zaehler).sort().join() === "illusionen,umwandlungsstein",
    "eine Woche spaeter: die Vorwoche ist die Woche davor", p4.vorwoche);
  // ohne Wochenpunkte der letzten Woche bleibt das Profil, wie es ist
  const leer = { id: "p2", name: "B", aus: [], namen: {}, eigene: [], zaehler: { phantomstein: { stand: 1, seit: r0 + H } } };
  ok(core.vorwocheSichern(leer, r1 + H) === leer, "nur Tagespunkte: keine Vorwoche");
  ok(core.vorwocheSichern({ id: "p3", name: "C", aus: [], namen: {}, eigene: [], zaehler: {} }, r1 + H).vorwoche === undefined,
    "leeres Profil: keine Vorwoche");
  // Pruefung W3, K4: die Uhr wurde ueber einen Donnerstag zurueckgestellt - eine gespeicherte Vorwoche, die
  // neuer ist als die aus jetzt gerechnete, wird nie durch eine aeltere ersetzt (die Datei lehnte das ab)
  const zurueck = { ...p4, zaehler: { ...p4.zaehler, chaosprisma: { stand: 2, seit: r0 + 5 * H } } };
  ok(core.vorwocheSichern(zurueck, r1 + H) === zurueck && zurueck.vorwoche.reset === r1,
    "Uhr zurueckgestellt: die neuere gespeicherte Vorwoche bleibt, keine aeltere ersetzt sie", core.vorwocheSichern(zurueck, r1 + H).vorwoche);
}

// ---- Grundliste (Spezifikation 3 und 10): 36 Punkte, Mengen und Takt
{
  const G = core.GRUNDLISTE;
  ok(Array.isArray(G) && G.length === 36, "36 Punkte", G && G.length);
  const zahl = (g) => G.filter(p => p.gruppe === g).length;
  const GR = ["raid", "geheimdungeon", "events", "dimension", "gemischtwaren", "gildenhaendler", "vertragsmuenzen", "widerstandswaren", "ehrenmuenzen", "raidwaren"];
  ok(JSON.stringify(GR.map(zahl)) === "[9,3,1,2,3,2,6,5,1,4]" && G.length === 36, "Gruppen: 9, 3, 1, 2, 3, 2, 6, 5, 1, 4 (36 Punkte)", GR.map(zahl));
  ok(new Set(G.map(p => p.schluessel)).size === 36, "Schluessel eindeutig");
  ok(G.every(p => /^[a-z][A-Za-z0-9]*$/.test(p.schluessel) && /^[a-z][A-Za-z0-9]*$/.test(p.gruppe)),
    "Schluessel und Gruppen sind reine Kennungen (Texte kommen aus dem Dictionary)");
  ok(G.every(p => Object.keys(p).sort().join() === "gruppe,menge,schluessel,takt"), "keine Texte im Kern, nur Schluessel");
  const soll = {
    zitadelleNormal: [1, "woche"], zitadelleSchwer: [1, "woche"], zitadelleAlbtraum: [1, "woche"],
    korridorNormal: [1, "woche"], korridorSchwer: [1, "woche"], korridorAlbtraum: [1, "woche"],
    altarNormal: [1, "woche"], altarSchwer: [1, "woche"], altarAlbtraum: [1, "woche"],
    illusionen: [3, "woche"], unendlichkeit: [1, "woche"], unendlichkeitMontag: [1, "montag"],
    regionszertifikat: [3, "woche"],
    umwandlungsstein: [100, "woche"], chaosprisma: [3, "woche"],
    mystischerSchluessel: [5, "woche"], heroischVerzauberung: [3, "woche"], heroischFreischalt: [8, "woche"],
    freischaltFragment: [75, "woche"], katalysator: [20, "woche"], siegelschluessel: [1, "woche"],
    phantomstein: [1, "tag"], vertragNyx: [1, "tag"], vertragTaedal: [3, "woche"],
    dimensionDungeons: [7, "woche"], goldeneKiste: [5, "woche"],
    widerstandHeroischFreischalt: [4, "woche"], widerstandFreischaltFragment: [6, "woche"], vererbungsstein: [2, "monat"],
    wachstumsbuch: [5, "woche"], wachstumsbuchAllmacht: [2, "woche"],
    truhePvp: [3, "woche"],
    verzauberungsstein: [12, "woche"], segenstascheChaos: [5, "woche"], auswahltruheVerzauberung: [1, "woche"], raidChaosprisma: [1, "woche"],
  };
  const falsch = Object.entries(soll).filter(([k, [m, t]]) => {
    const p = G.find(x => x.schluessel === k); return !p || p.menge !== m || p.takt !== t;
  });
  ok(falsch.length === 0, "Menge und Takt je Punkt wie in der Spezifikation", falsch);
  ok(G.filter(p => p.gruppe === "raid").map(p => p.schluessel).join() ===
     "zitadelleNormal,zitadelleSchwer,zitadelleAlbtraum,korridorNormal,korridorSchwer,korridorAlbtraum,altarNormal,altarSchwer,altarAlbtraum",
     "Reihenfolge wie in der Spezifikation (Raid)");
  ok(G.map(p => p.gruppe).filter((g, i, a) => a.indexOf(g) === i).join() ===
     GR.join(), "Gruppen in der Reihenfolge der Spezifikation (10: Haendler in ihrer Folge)");
  ok(G.filter(p => p.takt === "monat").map(p => p.schluessel).join() === "vererbungsstein", "nur der Vererbungsstein ist monatlich");
  ok(Object.isFrozen(G) && G.every(p => Object.isFrozen(p)), "die Grundliste ist unveraenderlich");
}

// ---- andere Rechner-Zeitzone: gleiche Ergebnisse
const probe = () => {
  const aus = [];
  let t = Z("2026-01-01T00:00:00Z");
  for (let i = 0; i < 200; i++) {
    aus.push(core.letzterReset(t, "woche"), core.letzterReset(t, "tag"), core.naechsterReset(t, "woche"), core.naechsterReset(t, "tag"),
      core.letzterReset(t, "monat"), core.naechsterReset(t, "monat"), core.letzterReset(t, "montag"), core.naechsterReset(t, "montag"));
    t += 43 * H + 11 * 60000;
  }
  return aus;
};
if (KIND) {
  console.log("PROBE " + JSON.stringify({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, failed, probe: probe() }));
  process.exit(failed ? 1 : 0);
}
{
  const eigen = JSON.stringify(probe());
  for (const tz of ["UTC", "America/New_York"]) {
    const r = spawnSync(process.execPath, [hier], { env: { ...process.env, TZ: tz, WEEKLIES_KIND: "1" }, encoding: "utf8" });
    const zeile = (r.stdout || "").split(/\r?\n/).find(z => z.startsWith("PROBE "));
    const d = zeile ? JSON.parse(zeile.slice(6)) : null;
    ok(d && d.tz === tz, "Kindprozess laeuft wirklich in " + tz, d ? d.tz : (r.stdout || "") + (r.stderr || ""));
    ok(r.status === 0 && d && d.failed === 0, "alle Proben auch in " + tz, (r.stdout || "").slice(0, 2000));
    ok(d && JSON.stringify(d.probe) === eigen, "gleiche Resets in " + tz + " wie hier");
  }
}

console.log(failed ? `\n${failed} FAILED` : "\nall ok");
process.exit(failed ? 1 : 0);
