// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Kern der Weeklies (src/renderer/weeklies-core.ts), ohne Seite:
// Grundliste, Reset-Regel (alle Takte um 06:00 UTC, woechentlich Mittwoch,
// ohne Sommer- und Winterzeit; Issue 420), Anzeige-Stand und Vorwoche (Spezifikation
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

// ---- Wochen-Reset: jeden Mittwoch 06:00:00 UTC (Issue 420), im Sommer wie im Winter derselbe Zeitpunkt
{
  reset("2026-10-07T05:59:59Z", "woche", "2026-09-30T06:00:00Z", "Mi 05:59:59: noch der Reset der Vorwoche");
  reset("2026-10-07T05:59:59.999Z", "woche", "2026-09-30T06:00:00Z", "Mi 05:59:59.999: eine ms davor, noch der alte");
  reset("2026-10-07T06:00:00Z", "woche", "2026-10-07T06:00:00Z", "Mi 06:00:00: genau der neue Reset");
  reset("2026-10-07T06:00:00.001Z", "woche", "2026-10-07T06:00:00Z", "Mi 06:00:00.001: eine ms danach, der neue");
  reset("2026-10-06T12:00:00Z", "woche", "2026-09-30T06:00:00Z", "Di: der Reset vom Mittwoch davor");
  reset("2026-10-08T12:00:00Z", "woche", "2026-10-07T06:00:00Z", "Do: der Reset vom Mittwoch (frueher Do 10:00 Berlin, jetzt schon seit Mi)");
  reset("2026-10-08T08:00:00Z", "woche", "2026-10-07T06:00:00Z", "Do 10:00 Berlin (08:00Z): kein Reset mehr, der Mittwoch gilt");
  reset("2026-10-11T23:59:59Z", "woche", "2026-10-07T06:00:00Z", "So spaet: noch der Mittwoch");
  reset("2026-10-12T00:00:00Z", "woche", "2026-10-07T06:00:00Z", "Mo 00:00: noch der Mittwoch");
  naechst("2026-10-07T05:59:59Z", "woche", "2026-10-07T06:00:00Z", "naechster Wochen-Reset Mi 05:59:59: in einer Sekunde");
  naechst("2026-10-07T06:00:00Z", "woche", "2026-10-14T06:00:00Z", "naechster Wochen-Reset genau am Reset: eine Woche spaeter");
  naechst("2026-10-06T12:00:00Z", "woche", "2026-10-07T06:00:00Z", "naechster Wochen-Reset am Di: morgen 06:00Z");
  // Wochengrenze Mi -> Do: ein Zaehler vom Mi 05:00 gehoert zur alten, einer vom Mi 07:00 zur neuen Woche
  const jetzt = Z("2026-10-08T12:00:00Z");
  ok(core.anzeigeStand({ stand: 1, seit: Z("2026-10-07T05:00:00Z") }, "woche", jetzt) === 0, "Mi 05:00 gesetzt: gehoert zur alten Woche, 0");
  ok(core.anzeigeStand({ stand: 1, seit: Z("2026-10-07T07:00:00Z") }, "woche", jetzt) === 1, "Mi 07:00 gesetzt: gehoert zur neuen Woche, 1");
}

// ---- Tages-Reset: jeden Tag 06:00:00 UTC
{
  reset("2026-09-29T05:59:59.999Z", "tag", "2026-09-28T06:00:00Z", "taeglich 05:59:59.999: der Reset von gestern");
  reset("2026-09-29T06:00:00Z", "tag", "2026-09-29T06:00:00Z", "taeglich 06:00:00: der Reset von heute");
  reset("2026-09-29T06:00:00.001Z", "tag", "2026-09-29T06:00:00Z", "taeglich 06:00:00.001: der Reset von heute");
  reset("2026-09-29T23:59:59Z", "tag", "2026-09-29T06:00:00Z", "taeglich 23:59:59: der Reset von heute");
  reset("2026-09-30T00:30:00Z", "tag", "2026-09-29T06:00:00Z", "taeglich 00:30 (neuer UTC-Tag): der Reset von gestern");
  naechst("2026-09-29T05:59:59Z", "tag", "2026-09-29T06:00:00Z", "naechster Tages-Reset 05:59:59: heute 06:00");
  naechst("2026-09-29T06:00:00Z", "tag", "2026-09-30T06:00:00Z", "naechster Tages-Reset 06:00: morgen 06:00");
  // der Tages-Reset am Mittwoch ist derselbe Zeitpunkt wie der Wochen-Reset
  ok(core.letzterReset(Z("2026-10-07T07:00:00Z"), "tag") === core.letzterReset(Z("2026-10-07T07:00:00Z"), "woche"),
    "Mi nach 06:00: Tages- und Wochen-Reset fallen zusammen");
}

// ---- Zeitumstellung verschiebt nichts mehr: jeder Tag hat 24 Stunden, jeder Reset liegt auf 06:00 UTC
{
  // Winterzeit beginnt So 25.10.2026, Sommerzeit So 29.3.2026
  naechst("2026-10-24T12:00:00Z", "tag", "2026-10-25T06:00:00Z", "Tages-Reset am Tag der Winterzeit: 06:00Z");
  ok(core.naechsterReset(Z("2026-10-24T12:00:00Z"), "tag") - core.letzterReset(Z("2026-10-24T12:00:00Z"), "tag") === 24 * H,
    "der Tag der Umstellung (Herbst) hat 24 Stunden");
  naechst("2026-03-28T12:00:00Z", "tag", "2026-03-29T06:00:00Z", "Tages-Reset am Tag der Sommerzeit: 06:00Z");
  ok(core.naechsterReset(Z("2026-03-28T12:00:00Z"), "tag") - core.letzterReset(Z("2026-03-28T12:00:00Z"), "tag") === 24 * H,
    "der Tag der Umstellung (Fruehling) hat 24 Stunden");
  reset("2026-10-26T12:00:00Z", "woche", "2026-10-21T06:00:00Z", "Mo nach der Winterzeit: Mittwoch 06:00Z");
  naechst("2026-10-26T12:00:00Z", "woche", "2026-10-28T06:00:00Z", "naechster Wochen-Reset nach der Winterzeit: 06:00Z");
  reset("2026-03-30T12:00:00Z", "woche", "2026-03-25T06:00:00Z", "Mo nach der Sommerzeit: Mittwoch 06:00Z");
  naechst("2026-03-30T12:00:00Z", "woche", "2026-04-01T06:00:00Z", "naechster Wochen-Reset nach der Sommerzeit: 06:00Z");
  ok(core.naechsterReset(Z("2026-10-21T06:00:00Z"), "woche") - Z("2026-10-21T06:00:00Z") === 7 * TAG, "die Woche ueber die Winterzeit hat genau 7 mal 24 Stunden");
  ok(core.naechsterReset(Z("2026-03-25T06:00:00Z"), "woche") - Z("2026-03-25T06:00:00Z") === 7 * TAG, "die Woche ueber die Sommerzeit hat genau 7 mal 24 Stunden");
}

// ---- Monats-Reset: der 1. des Monats um 06:00:00 UTC
{
  reset("2026-10-01T05:59:59.999Z", "monat", "2026-09-01T06:00:00Z", "1.10. 05:59:59.999: noch der Reset vom 1.9.");
  reset("2026-10-01T06:00:00Z", "monat", "2026-10-01T06:00:00Z", "1.10. 06:00:00: der neue Monats-Reset");
  reset("2026-10-01T06:00:00.001Z", "monat", "2026-10-01T06:00:00Z", "1.10. 06:00:00.001: der neue Monats-Reset");
  reset("2026-10-31T23:59:00Z", "monat", "2026-10-01T06:00:00Z", "31.10. 23:59: noch der Oktober");
  reset("2026-11-01T05:59:00Z", "monat", "2026-10-01T06:00:00Z", "1.11. 05:59: noch der Oktober");
  reset("2026-11-01T06:00:00Z", "monat", "2026-11-01T06:00:00Z", "1.11. 06:00");
  reset("2027-01-15T12:00:00Z", "monat", "2027-01-01T06:00:00Z", "Mitte Januar: der 1.1. (ueber den Jahreswechsel)");
  reset("2027-01-01T05:59:59Z", "monat", "2026-12-01T06:00:00Z", "1.1. 05:59:59: noch der Dezember (Jahreswechsel)");
  reset("2027-01-01T06:00:00Z", "monat", "2027-01-01T06:00:00Z", "1.1. 06:00:00: der neue Januar");
  reset("2026-03-01T06:00:00Z", "monat", "2026-03-01T06:00:00Z", "1.3. 06:00 (Februar davor kurz)");
  reset("2026-04-01T06:00:00Z", "monat", "2026-04-01T06:00:00Z", "1.4. 06:00Z (Monat der Sommerzeit, kein Versatz)");
  naechst("2026-10-15T12:00:00Z", "monat", "2026-11-01T06:00:00Z", "naechster Monats-Reset im Oktober: 1.11. 06:00Z");
  naechst("2026-12-20T12:00:00Z", "monat", "2027-01-01T06:00:00Z", "naechster Monats-Reset im Dezember: 1.1.");
  naechst("2026-10-01T06:00:00Z", "monat", "2026-11-01T06:00:00Z", "naechster Monats-Reset genau am Reset: ein Monat spaeter");
  const z = { stand: 2, seit: Z("2026-10-10T12:00:00Z") };
  ok(core.anzeigeStand(z, "monat", Z("2026-10-29T12:00:00Z")) === 2, "Monatspunkt: ueber den Wochen-Reset hinweg bleibt der Stand");
  ok(core.anzeigeStand(z, "monat", Z("2026-11-01T05:59:59Z")) === 2, "Monatspunkt: am 1.11. 05:59:59 noch 2");
  ok(core.anzeigeStand(z, "monat", Z("2026-11-01T06:00:00Z")) === 0, "Monatspunkt: am 1.11. 06:00 ist er 0");
}

// ---- Montags-Reset (Portal der Unendlichkeit Mo-Mo): Montag 06:00:00 UTC (Issue 420, Nachtrag)
{
  reset("2026-10-05T05:59:59.999Z", "montag", "2026-09-28T06:00:00Z", "Mo 05.10. 05:59:59.999: noch der Montag davor");
  reset("2026-10-05T06:00:00Z", "montag", "2026-10-05T06:00:00Z", "Mo 05.10. 06:00: der neue Reset");
  reset("2026-10-01T12:00:00Z", "montag", "2026-09-28T06:00:00Z", "Do: der Montag dieser Woche");
  reset("2026-10-04T21:00:00Z", "montag", "2026-09-28T06:00:00Z", "So 23:00: noch der Montag davor");
  naechst("2026-10-01T12:00:00Z", "montag", "2026-10-05T06:00:00Z", "naechster Montags-Reset am Do: Mo 06:00Z");
  naechst("2026-10-05T06:00:00Z", "montag", "2026-10-12T06:00:00Z", "naechster Montags-Reset genau am Reset: eine Woche spaeter");
  naechst("2026-10-24T12:00:00Z", "montag", "2026-10-26T06:00:00Z", "ueber die Winterzeit: Mo 26.10. 06:00Z, kein Versatz");
  const z = { stand: 1, seit: Z("2026-09-29T12:00:00Z") };   // Di
  ok(core.anzeigeStand(z, "montag", Z("2026-10-01T09:00:00Z")) === 1, "Montagspunkt: ueber den Wochen-Reset hinweg bleibt der Stand");
  ok(core.anzeigeStand(z, "montag", Z("2026-10-05T06:00:00Z")) === 0, "Montagspunkt: am Montag 06:00 ist er 0");
  ok(core.anzeigeStand({ stand: 1, seit: Z("2026-10-05T06:00:00Z") }, "montag", Z("2026-10-08T12:00:00Z")) === 1, "Montagspunkt: genau zum Reset gesetzt zaehlt, auch nach dem Mittwoch");
}

// ---- ueber 400 Tage: jeder Wochen-Reset ist ein Mittwoch 06:00:00 UTC, die anderen Takte 06:00:00 UTC, nie ein Versatz
{
  let t = Z("2026-01-01T00:00:00Z"), schlecht = [];
  const ist = (ms, wt) => { const d = new Date(ms); return d.getUTCHours() === 6 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && (wt === undefined || d.getUTCDay() === wt); };
  for (let i = 0; i < 400; i++) {
    const w = core.letzterReset(t, "woche"), d = core.letzterReset(t, "tag"), mo = core.letzterReset(t, "monat"), mt = core.letzterReset(t, "montag");
    const n = core.naechsterReset(t, "woche"), m = core.naechsterReset(t, "tag");
    if (!(w <= t && t < n && d <= t && t < m && t - w < 7 * TAG && n - t <= 7 * TAG && t - d < TAG && m - t <= TAG && n - w === 7 * TAG && m - d === TAG)) schlecht.push(["spanne", iso(t)]);
    if (!ist(w, 3) || !ist(d) || !ist(mo) || new Date(mo).getUTCDate() !== 1 || !ist(mt, 1)) schlecht.push([iso(t), iso(w), iso(d), iso(mo), iso(mt)]);
    if (core.letzterReset(n, "woche") !== n || core.letzterReset(m, "tag") !== m) schlecht.push(["grenze", iso(t)]);
    t += 22 * H + 17 * 60000;
  }
  ok(schlecht.length === 0, "400 Tage lang: Reset immer auf 06:00:00 UTC (Woche Mi, Montag Mo, Monat am 1.), Woche und Tag ohne Versatz", schlecht.slice(0, 5));
}

// ---- Anzeige-Stand: vor dem letzten Reset gesetzt heisst 0
{
  const jetzt = Z("2026-10-02T12:00:00Z"), r = Z("2026-09-30T06:00:00Z");
  ok(core.anzeigeStand(undefined, "woche", jetzt) === 0, "ohne Zaehler: 0");
  ok(core.anzeigeStand({ stand: 2, seit: r - 1 }, "woche", jetzt) === 0, "vor dem Wochen-Reset gesetzt: 0");
  ok(core.anzeigeStand({ stand: 2, seit: r }, "woche", jetzt) === 2, "genau zum Reset gesetzt: zaehlt");
  ok(core.anzeigeStand({ stand: 3, seit: r + H }, "woche", jetzt) === 3, "nach dem Reset gesetzt: zaehlt");
  ok(core.anzeigeStand({ stand: 1, seit: Z("2026-10-02T05:59:59Z") }, "tag", jetzt) === 0, "taeglich: vor 06:00 heute gesetzt: 0");
  ok(core.anzeigeStand({ stand: 1, seit: Z("2026-10-02T06:00:00Z") }, "tag", jetzt) === 1, "taeglich: genau 06:00 heute gesetzt: zaehlt");
  ok(core.anzeigeStand({ stand: 1, seit: Z("2026-10-02T05:59:59Z") }, "woche", jetzt) === 1, "derselbe Zeitpunkt zaehlt als Wochenpunkt weiter");
  ok(core.anzeigeStand({ stand: -4, seit: r + H }, "woche", jetzt) === 0 &&
     core.anzeigeStand({ stand: 2.7, seit: r + H }, "woche", jetzt) === 2 &&
     core.anzeigeStand({ stand: "x", seit: r + H }, "woche", jetzt) === 0 &&
     core.anzeigeStand({ stand: 2, seit: "x" }, "woche", jetzt) === 0, "kaputte Zaehler: ganze Zahl ab 0");
}

// ---- Vorwoche: der alte Wochenstand bleibt eine Woche erhalten
{
  const r0 = Z("2026-09-23T06:00:00Z"), r1 = Z("2026-09-30T06:00:00Z");
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
  const r2 = Z("2026-10-07T06:00:00Z");
  const p4 = core.vorwocheSichern(p3, r2 + H);
  ok(p4.vorwoche.reset === r1 && Object.keys(p4.vorwoche.zaehler).sort().join() === "illusionen,umwandlungsstein",
    "eine Woche spaeter: die Vorwoche ist die Woche davor", p4.vorwoche);
  // ohne Wochenpunkte der letzten Woche bleibt das Profil, wie es ist
  const leer = { id: "p2", name: "B", aus: [], namen: {}, eigene: [], zaehler: { phantomstein: { stand: 1, seit: r0 + H } } };
  ok(core.vorwocheSichern(leer, r1 + H) === leer, "nur Tagespunkte: keine Vorwoche");
  ok(core.vorwocheSichern({ id: "p3", name: "C", aus: [], namen: {}, eigene: [], zaehler: {} }, r1 + H).vorwoche === undefined,
    "leeres Profil: keine Vorwoche");
  // Pruefung W3, K4: die Uhr wurde ueber einen Mittwoch zurueckgestellt - eine gespeicherte Vorwoche, die
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

// ---- Fortschritt, Zu-Zustand, Vorwoche (Spezifikation Weeklies neu, 4.1 bis 4.5)
{
  const profil = (zaehler, rest = {}) => ({ id: "w000000001", name: "Aurel", zaehler, aus: [], namen: {}, eigene: [], ...rest });
  const voll = (seit) => Object.fromEntries(core.GRUNDLISTE.map(g => [g.schluessel, { stand: g.menge, seit }]));
  const Montag = Z("2026-10-12T12:00:00Z");   // Mo nach dem Montags-Reset, in der Woche ab Mi 07.10.
  const woche = core.GRUNDLISTE.filter(g => g.takt !== "tag");
  const tag = core.GRUNDLISTE.filter(g => g.takt === "tag");

  let f = core.fortschrittVon(profil(voll(Montag)), Z("2026-10-12T18:00:00Z"));
  ok(f.fertig && f.woche.n === woche.length && f.woche.g === woche.length && f.tag.n === tag.length, "alles voll: Woche und Tag erledigt", f);
  f = core.fortschrittVon(profil(voll(Montag)), Z("2026-10-13T09:00:00Z"));
  ok(f.fertig && f.tag.n === 0 && f.tag.g === tag.length, "nach dem Tagesreset bleibt die Woche erledigt (121)", f);
  f = core.fortschrittVon(profil(voll(Montag)), Z("2026-10-14T06:05:00Z"));
  ok(!f.fertig && f.woche.n === core.GRUNDLISTE.filter(g => g.takt === "monat" || g.takt === "montag").length, "nach dem Wochen-Reset ist die Woche offen (Monats- und Montagspunkte gelten weiter)", f);

  const teil = profil({ dimensionDungeons: { stand: 3, seit: Montag }, goldeneKiste: { stand: 2, seit: Montag } });
  f = core.fortschrittVon(teil, Z("2026-10-12T18:00:00Z"));
  const erwartet = (3 / 7 + 2 / 5) / woche.length;
  ok(Math.abs(f.woche.anteil - erwartet) < 1e-9 && f.woche.n === 0, "Teilfortschritt zaehlt nach Menge in den Ring (121)", { anteil: f.woche.anteil, erwartet });

  const eig = profil({}, { aus: ["illusionen"], eigene: [
    { schluessel: "eigenaaa", name: "Mein Punkt", menge: 2, takt: "woche" },
    { schluessel: "eigenbbb", name: "Alt", menge: 1, takt: "woche", geloest: true }] });
  const sp = core.sichtbarePunkte(eig);
  ok(!sp.some(x => x.schluessel === "illusionen") && sp.some(x => x.schluessel === "eigenaaa") && !sp.some(x => x.schluessel === "eigenbbb"), "sichtbarePunkte: aus und geloest fehlen, eigener Punkt da", sp.map(x => x.schluessel));
  ok(core.fortschrittVon(profil({}, { aus: core.GRUNDLISTE.map(g => g.schluessel) }), Montag).fertig === false, "ohne sichtbare Wochenpunkte ist nichts 'fertig'");

  ok(core.bereichZu(undefined, true) === true && core.bereichZu(undefined, false) === false, "bereichZu: ohne Wahl gilt 'zu = fertig'");
  ok(core.bereichZu({ zu: false, bei: true }, true) === false, "bereichZu: aufgeklappt bleibt aufgeklappt, solange fertig");
  ok(core.bereichZu({ zu: false, bei: true }, false) === false && core.bereichZu({ zu: true, bei: true }, false) === false, "bereichZu: Wahl verfaellt, wenn der Fertig-Zustand wechselt");
  ok(core.bereichZu({ zu: true, bei: false }, false) === true, "bereichZu: zugeklappt im offenen Zustand bleibt, solange offen");

  const mi = Z("2026-10-06T20:00:00Z");   // Di, in der Woche vor dem Reset Mi 07.10.
  const alt = profil({ zitadelleNormal: { stand: 1, seit: mi }, illusionen: { stand: 2, seit: mi } });
  const doDanach = Z("2026-10-07T06:05:00Z");
  let lw = core.letzteWoche([alt], doDanach);
  ok(lw && lw.length === 1 && lw[0].n === 1 && lw[0].g === woche.filter(g => g.takt === "woche").length && lw[0].name === "Aurel", "Letzte Woche erscheint nach dem Reset", lw);
  const neu = profil({ zitadelleNormal: { stand: 1, seit: mi }, illusionen: { stand: 2, seit: mi }, zitadelleSchwer: { stand: 1, seit: Z("2026-10-07T06:10:00Z") } });
  ok(core.letzteWoche([neu], Z("2026-10-07T09:00:00Z")) === null, "Letzte Woche verschwindet beim ersten Stand der neuen Woche");
  ok(core.letzteWoche([profil({})], doDanach) === null, "Letzte Woche fehlt, wenn nie etwas gesetzt wurde");
  const mitVor = profil({}, { vorwoche: { reset: Z("2026-09-30T06:00:00Z"), zaehler: { zitadelleNormal: { stand: 1, seit: mi } } } });
  lw = core.letzteWoche([mitVor], doDanach);
  ok(lw && lw[0].n === 1, "Letzte Woche liest die gespeicherte vorwoche", lw);
}

// ---- Umstellung (Issue 420): alte Staende aus der Zeit mit Do 10:00 Berlin gehen nicht kaputt, nichts wird geloescht
{
  const profil = (zaehler, rest = {}) => ({ id: "w000000001", name: "Aurel", zaehler, aus: [], namen: {}, eigene: [], ...rest });
  // So wurde bis zur Umstellung gespeichert: Wochen-Reset Do 10:00 Berlin (CEST, 08:00Z)
  const altR = (tag) => Z("2026-10-" + tag + "T08:00:00Z");   // Do 01.10., Do 08.10. (alt)
  // Neuer Stand: Mi 07.10. 06:00Z; jetzt ist Do 08.10. 12:00Z (zwischen Mi 06:00Z und Do 10:00 Berlin liegt der Uebergang)
  const jetzt = Z("2026-10-08T12:00:00Z");
  const r = core.letzterReset(jetzt, "woche"), r0 = core.letzterReset(r - 1, "woche");
  ok(r === Z("2026-10-07T06:00:00Z") && r0 === Z("2026-09-30T06:00:00Z"), "Uebergang: die neue Woche beginnt Mi 07.10. 06:00Z", [iso(r), iso(r0)]);
  // Ein alter Stand mit altem seit (Do 01.10. 11:00Z, Woche ab alt-Reset Do 01.10.) zaehlt in der Woche bis Mi 07.10. noch als Wochenstand
  const alt = { stand: 2, seit: Z("2026-10-01T11:00:00Z") };
  ok(core.anzeigeStand(alt, "woche", Z("2026-10-06T12:00:00Z")) === 2, "alter Stand (Do 01.10.) zaehlt bis zum neuen Reset weiter");
  ok(core.anzeigeStand(alt, "woche", jetzt) === 0, "alter Stand (Do 01.10.) ist nach dem neuen Reset 0 (nicht verloren, nur eine neue Woche)");
  // Wer zwischen Mi 06:00Z und Do 10:00 Berlin abhakt, zaehlt zur neuen Woche (einmalig)
  const zwischen = { stand: 1, seit: Z("2026-10-07T20:00:00Z") };
  ok(core.anzeigeStand(zwischen, "woche", jetzt) === 1, "abgehakt zwischen Mi 06:00Z und Do 10:00 Berlin: zaehlt zur neuen Woche");
  // Eine vor der Umstellung gespeicherte Vorwoche (reset = Do 24.09. 08:00Z) wird in der Woche danach als Vorwoche erkannt, nicht verworfen
  const mitVor = profil({
    zitadelleNormal: { stand: 1, seit: Z("2026-10-02T09:00:00Z") },          // alte Woche, vor Mi 07.10.
    illusionen: { stand: 2, seit: Z("2026-09-26T09:00:00Z") },
  }, { vorwoche: { reset: altR("01"), zaehler: { chaosprisma: { stand: 3, seit: Z("2026-10-01T12:00:00Z") } } } });
  const kopie = JSON.stringify(mitVor);
  const lw = core.letzteWoche([mitVor], jetzt);
  ok(lw && lw.length === 1 && lw[0].n === 2, "Vorwoche aus der alten Zeit (reset Do 01.10. 08:00Z) zaehlt mit: Zaehler und alte Vorwoche", lw);
  const gesichert = core.vorwocheSichern(mitVor, jetzt);
  ok(JSON.stringify(mitVor) === kopie, "die alte Datei wird nicht veraendert");
  ok(gesichert.vorwoche && gesichert.vorwoche.reset === altR("01") && gesichert.vorwoche.zaehler.chaosprisma.stand === 3 && gesichert.vorwoche.zaehler.zitadelleNormal.stand === 1,
    "vorwocheSichern ueber die Umstellung: alte Vorwoche und Zaehler der letzten Woche bleiben beide erhalten", gesichert.vorwoche);
  ok(JSON.stringify(gesichert.zaehler) === JSON.stringify(mitVor.zaehler), "die Zaehler bleiben, nichts geht verloren");
  ok(core.vorwocheSichern(gesichert, jetzt) === gesichert, "nach der Umstellung gesichert: ein zweiter Lauf aendert nichts (konsistent)");
  // Zeit laeuft weiter: eine Woche spaeter ersetzt die neue Vorwoche die umgestellte, wie sonst auch
  const spaeter = core.vorwocheSichern({ ...gesichert, zaehler: { ...gesichert.zaehler, altarNormal: { stand: 1, seit: Z("2026-10-09T12:00:00Z") } } }, Z("2026-10-14T07:00:00Z"));
  ok(spaeter.vorwoche.reset === r && Object.keys(spaeter.vorwoche.zaehler).join() === "altarNormal", "eine Woche spaeter: die Vorwoche ist die neue Woche", spaeter.vorwoche);
  // eine Vorwoche, die neuer ist als das Fenster (Uhr zurueckgestellt), bleibt wie bisher
  const neuer = profil({}, { vorwoche: { reset: Z("2026-10-07T06:00:00Z"), zaehler: { chaosprisma: { stand: 1, seit: Z("2026-10-07T07:00:00Z") } } } });
  ok(core.vorwocheSichern(neuer, Z("2026-10-06T12:00:00Z")) === neuer, "Uhr zurueck: die neuere Vorwoche bleibt");
  // ein sehr alter Stand ohne passende Vorwoche: nichts kaputt
  ok(core.letzteWoche([profil({ zitadelleNormal: { stand: 1, seit: Z("2026-08-01T10:00:00Z") } })], jetzt) === null, "sehr alter Stand: keine Letzte Woche, kein Fehler");
}

/* Turm der Gier (Spezifikation 2026-11-11-turm-der-gier-design.md, Abschnitt 2): 28-Tage-Saison ab Mi 11.11.2026 06:00 UTC */
{
  ok(core.TURM_START === Z("2026-11-11T06:00:00Z") && core.TURM_TAGE === 28, "Turm: Anker Mi 11.11.2026 06:00 UTC, 28 Tage");
  reset("2026-11-11T06:00:00Z", "turm", "2026-11-11T06:00:00Z", "Turm: am Anker selbst beginnt die Saison");
  reset("2026-11-11T05:59:59Z", "turm", "2026-10-14T06:00:00Z", "Turm: eine Sekunde vor dem Anker gilt die Saison davor (periodisch rueckwaerts)");
  reset("2026-12-09T05:59:59Z", "turm", "2026-11-11T06:00:00Z", "Turm: 9.12. 05:59:59 noch Saison 1");
  reset("2026-12-09T06:00:00Z", "turm", "2026-12-09T06:00:00Z", "Turm: 9.12. 06:00:00 beginnt Saison 2");
  reset("2027-01-06T06:00:00Z", "turm", "2027-01-06T06:00:00Z", "Turm: 6.1.2027 beginnt Saison 3");
  naechst("2026-11-20T12:00:00Z", "turm", "2026-12-09T06:00:00Z", "Turm: der naechste Reset in Saison 1 ist der 9.12. 06:00 UTC");
  ok(core.naechsterReset(Z("2026-12-09T06:00:00Z"), "turm") - Z("2026-12-09T06:00:00Z") === 28 * TAG, "Turm: genau 28 mal 24 Stunden, auch ueber die Winterzeit");
  ok(core.naechsterReset(Z("2027-03-10T12:00:00Z"), "turm") - core.letzterReset(Z("2027-03-10T12:00:00Z"), "turm") === 28 * TAG, "Turm: 28 mal 24 Stunden ueber die Sommerzeit");

  ok(core.TURM_SCHLUESSEL.length === 20 && new Set(core.TURM_SCHLUESSEL).size === 20 && core.TURM_SCHLUESSEL[0] === "turmS1E1" && core.TURM_SCHLUESSEL[19] === "turmS4E5"
    && core.TURM_SCHLUESSEL.every(k => /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(k)), "Turm: 20 Schluessel turmS1E1 bis turmS4E5, passen in die Schluesselform des Speichers");
  ok(core.turmSchluessel(2, 3) === "turmS3E3", "Turm: turmSchluessel(2, 3) ist turmS3E3");
  ok(!core.GRUNDLISTE.some(g => core.TURM_SCHLUESSEL.includes(g.schluessel)), "Turm: die Schluessel stehen nicht in der Grundliste");

  const profil = (zaehler, rest = {}) => ({ id: "w000000001", name: "Aurel", zaehler, aus: [], namen: {}, eigene: [], ...rest });
  const jetzt = Z("2026-11-20T12:00:00Z");
  const z1 = (k, seit) => ({ [k]: { stand: 1, seit } });
  const p = profil({ ...z1("turmS1E1", Z("2026-11-12T08:00:00Z")), ...z1("turmS1E2", Z("2026-11-12T08:00:00Z")), ...z1("turmS2E5", Z("2026-11-13T08:00:00Z")), ...z1("turmS3E1", Z("2026-11-10T08:00:00Z")) });
  const f = core.fortschrittTurm(p, jetzt);
  ok(f.n === 3 && f.g === 20 && f.stufen.length === 4 && f.stufen.map(s => s.n).join() === "2,1,0,0" && f.stufen.every(s => s.g === 5),
    "Turm: 3 von 20 (2 + 1), der Stand von vor dem Saisonbeginn zaehlt nicht", f);
  ok(core.fortschrittVon(p, jetzt).woche.g === core.fortschrittVon(profil({}), jetzt).woche.g
    && core.fortschrittVon(p, jetzt).woche.n === 0 && core.fortschrittVon(p, jetzt).fertig === false,
    "Turm: Turm-Zaehler aendern Wochen-Fortschritt und Fertig nicht");
  ok(core.letzteWoche([p], Z("2026-11-18T07:00:00Z")) === null, "Turm: Turm-Zaehler erscheinen nicht in der letzten Woche");
  {
    const mitWoche = profil({ zitadelleNormal: { stand: 1, seit: Z("2026-11-12T10:00:00Z") }, ...z1("turmS1E1", Z("2026-11-18T08:00:00Z")) });
    const lwT = core.letzteWoche([mitWoche], Z("2026-11-19T12:00:00Z"));
    ok(Array.isArray(lwT) && lwT.length === 1 && lwT[0].id === "w000000001", "Turm: ein Turm-Haken in der neuen Woche laesst die letzte Woche nicht verschwinden", lwT);
  }

  const s = core.turmSaison(Z("2026-11-11T06:00:00Z"));
  ok(s.start === Z("2026-11-11T06:00:00Z") && s.ende === Z("2026-12-09T06:00:00Z") && s.tage === 28, "Turm: am ersten Tag 'noch 28 Tage'", s);
  ok(core.turmSaison(Z("2026-12-09T05:00:00Z")).tage === 1, "Turm: eine Stunde vor dem Ende noch 1 Tag");

  /* Vorsaison: die Saison davor bleibt erhalten, bevor ein neuer Stand sie ueberschreibt */
  const alt = profil({ ...z1("turmS1E1", Z("2026-11-12T08:00:00Z")), ...z1("turmS1E2", Z("2026-11-13T08:00:00Z")), illusionen: { stand: 2, seit: Z("2026-11-12T08:00:00Z") } });
  const neu = Z("2026-12-10T10:00:00Z");
  const q = core.vorsaisonSichern(alt, neu);
  ok(q.vorsaison && q.vorsaison.reset === Z("2026-11-11T06:00:00Z") && Object.keys(q.vorsaison.zaehler).sort().join() === "turmS1E1,turmS1E2",
    "Vorsaison: die zwei Turm-Zaehler der Saison davor werden gesichert (kein Wochenzaehler)", q.vorsaison);
  ok(q.zaehler === alt.zaehler || JSON.stringify(q.zaehler) === JSON.stringify(alt.zaehler), "Vorsaison: die Zaehler selbst bleiben");
  ok(core.vorsaisonSichern(q, neu) === q, "Vorsaison: ohne Aenderung kommt dasselbe Objekt zurueck");
  { const leer = profil({}); ok(core.vorsaisonSichern(leer, neu) === leer, "Vorsaison: ohne Turm-Zaehler nichts zu sichern, dasselbe Objekt"); }
  const ueber = { ...q, zaehler: { ...q.zaehler, turmS1E1: { stand: 1, seit: neu } } };
  ok(core.vorsaisonSichern(ueber, neu + 3600000).vorsaison.zaehler.turmS1E1.seit === Z("2026-11-12T08:00:00Z"), "Vorsaison: ein Ueberschreiben im neuen Stand loescht die gesicherte Saison nicht");
  const neuere = profil({}, { vorsaison: { reset: Z("2026-12-09T06:00:00Z"), zaehler: { turmS1E1: { stand: 1, seit: Z("2026-12-10T00:00:00Z") } } } });
  ok(core.vorsaisonSichern(neuere, Z("2026-12-10T10:00:00Z")) === neuere, "Vorsaison: eine neuere gespeicherte Vorsaison bleibt (Uhr zurueckgestellt)");

  const ls = core.letzteSaison(q, neu);
  ok(ls && ls.n === 2 && ls.g === 20, "Letzte Saison: 2 von 20", ls);
  ok(core.letzteSaison(profil({}), neu) === null, "Letzte Saison: ohne Daten null");
  ok(core.letzteSaison(q, Z("2026-11-20T12:00:00Z")) === null, "Letzte Saison: in der ersten Saison gibt es keine davor");
}

// ---- andere Rechner-Zeitzone: gleiche Ergebnisse
const probe = () => {
  const aus = [];
  let t = Z("2026-01-01T00:00:00Z");
  for (let i = 0; i < 200; i++) {
    aus.push(core.letzterReset(t, "woche"), core.letzterReset(t, "tag"), core.naechsterReset(t, "woche"), core.naechsterReset(t, "tag"),
      core.letzterReset(t, "monat"), core.naechsterReset(t, "monat"), core.letzterReset(t, "montag"), core.naechsterReset(t, "montag"),
      core.letzterReset(t, "turm"), core.naechsterReset(t, "turm"));
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
