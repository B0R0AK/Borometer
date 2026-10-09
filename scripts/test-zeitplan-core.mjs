// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Zeitplan der Erinnerungen ohne Electron (src/main/zeitplan-core.ts,
// zeitplan.ts, erinnerung-core.ts; Spezifikation Weeklies neu, 6): wann ist
// etwas faellig, in Ortszeit, auch an der Zeitumstellung; der Laeufer mit
// gestellter Uhr (nie die Wanduhr des Rechners); der Text und die Anfragen.
//
// Run:  npm run test:zeitplan-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
async function lade(datei) {
  const b = await esbuild.build({ entryPoints: [join(root, datei)], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
  return import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));
}
const k = await lade("src/main/zeitplan-core.ts");
const l = await lade("src/main/zeitplan.ts");
const e = await lade("src/main/erinnerung-core.ts");
let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        bekommen " + a + "\n        erwartet " + b); }
}
const Z = (s) => Date.parse(s);
const H = 3600000;

// Ortszeit Berlin aus Intl, wie der Kern der Weeklies (der Rechner-Zeitzone nicht trauen)
const BERLIN = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
function berlin(ms) {
  const f = {};
  for (const t of BERLIN.formatToParts(ms)) if (t.type !== "literal") f[t.type] = Number(t.value);
  return Date.UTC(f.year, f.month - 1, f.day, f.hour % 24, f.minute, f.second) - Math.floor(ms / 1000) * 1000;
}
const newYork = () => -5 * H;
const R = (o = {}) => ({ id: "e1", an: true, tage: [2], zeit: "18:00", ...o });

// --- 6.1 faelligkeiten
eq(k.faelligkeiten([R()], Z("2026-10-05T00:00:00Z"), Z("2026-10-12T00:00:00Z"), berlin), [{ id: "e1", um: Z("2026-10-06T16:00:00Z") }], "Di 18:00 in Berlin im Sommer ist 16:00Z");
eq(k.faelligkeiten([R()], Z("2026-11-02T00:00:00Z"), Z("2026-11-09T00:00:00Z"), berlin), [{ id: "e1", um: Z("2026-11-03T17:00:00Z") }], "Di 18:00 in Berlin im Winter ist 17:00Z");
eq(k.faelligkeiten([R()], Z("2026-10-05T00:00:00Z"), Z("2026-10-12T00:00:00Z"), newYork), [{ id: "e1", um: Z("2026-10-06T23:00:00Z") }], "Ortszeit gilt: gleiche Regel in New York");
eq(k.faelligkeiten([R()], Z("2026-10-06T16:00:00Z"), Z("2026-10-12T00:00:00Z"), berlin), [], "von ist ausgeschlossen");
eq(k.faelligkeiten([R()], Z("2026-10-05T00:00:00Z"), Z("2026-10-06T16:00:00Z"), berlin).length, 1, "bis ist eingeschlossen");
eq(k.faelligkeiten([R({ tage: [1, 2, 3] })], Z("2026-10-05T00:00:00Z"), Z("2026-10-08T00:00:00Z"), berlin).map((x) => x.um),
  [Z("2026-10-05T16:00:00Z"), Z("2026-10-06T16:00:00Z"), Z("2026-10-07T16:00:00Z")], "mehrere Wochentage, in Reihenfolge");
eq(k.faelligkeiten([R({ an: false })], Z("2026-10-05T00:00:00Z"), Z("2026-10-12T00:00:00Z"), berlin), [], "ausgeschaltet laeuft nicht");
eq(k.faelligkeiten([R({ geloest: true })], Z("2026-10-05T00:00:00Z"), Z("2026-10-12T00:00:00Z"), berlin), [], "geloest laeuft nie");
eq(k.faelligkeiten([R({ tage: [] })], Z("2026-10-05T00:00:00Z"), Z("2026-10-12T00:00:00Z"), berlin), [], "ohne Tage laeuft nichts");
eq(k.faelligkeiten([R({ zeit: "kaputt" })], Z("2026-10-05T00:00:00Z"), Z("2026-10-12T00:00:00Z"), berlin), [], "eine kaputte Zeit laeuft nicht");
// Zeitumstellung: Fruehling 2026-03-29 (So = 0), 02:30 gibt es nicht; Herbst 2026-10-25, 02:30 gibt es zweimal
eq(k.faelligkeiten([R({ tage: [0], zeit: "02:30" })], Z("2026-03-28T00:00:00Z"), Z("2026-03-30T00:00:00Z"), berlin), [{ id: "e1", um: Z("2026-03-29T01:30:00Z") }], "Luecke: 02:30 gilt um 03:30 Ortszeit");
eq(k.faelligkeiten([R({ tage: [0], zeit: "02:30" })], Z("2026-10-24T00:00:00Z"), Z("2026-10-26T00:00:00Z"), berlin), [{ id: "e1", um: Z("2026-10-25T01:30:00Z") }], "doppelte Stunde: einmal");

// --- naechste
eq(k.naechste(R(), Z("2026-10-06T16:00:00Z"), berlin), Z("2026-10-13T16:00:00Z"), "naechste: nach dem Termin die Woche darauf");
eq(k.naechste(R({ an: false }), Z("2026-10-06T00:00:00Z"), berlin), null, "naechste: aus ist null");
eq(k.naechste(R({ tage: [] }), Z("2026-10-06T00:00:00Z"), berlin), null, "naechste: ohne Tage ist null");

// --- 6.2 Laeufer mit gestellter Uhr
{
  let jetzt = Z("2026-10-06T15:59:50Z");
  const gemeldet = [];
  let tick = null;
  let regeln = [R()];
  const lauf = l.zeitplanStarten({ regeln: () => regeln, beiFaellig: (id, um) => gemeldet.push([id, um]), jetzt: () => jetzt, versatz: berlin,
    stelle: (fn) => { tick = fn; return 1; }, loesche: () => {} });
  jetzt = Z("2026-10-06T15:59:55Z"); tick();
  eq(gemeldet, [], "Laeufer: vor der Zeit nichts");
  jetzt = Z("2026-10-06T16:00:10Z"); tick();
  eq(gemeldet, [["e1", Z("2026-10-06T16:00:00Z")]], "Laeufer: meldet beim Ueberschreiten");
  jetzt = Z("2026-10-06T16:00:30Z"); tick();
  eq(gemeldet.length, 1, "Laeufer: meldet denselben Termin nicht zweimal");
  jetzt = Z("2026-10-06T15:00:00Z"); tick();
  jetzt = Z("2026-10-06T16:00:40Z"); tick();
  eq(gemeldet.length, 1, "Laeufer: Uhr zurueck und wieder vor meldet nichts nach");
  // Rechner im Ruhezustand: Uhr springt weit vor, ein alter Termin wird nicht nachgeholt
  regeln = [R({ id: "e2", tage: [3], zeit: "10:00" })];
  jetzt = Z("2026-10-07T07:00:00Z"); tick();             // 09:00 Berlin, davor
  jetzt = Z("2026-10-07T12:00:00Z"); tick();             // 14:00 Berlin: 10:00 liegt 4 Stunden zurueck
  eq(gemeldet.length, 1, "Laeufer: ein Termin weit in der Vergangenheit verfaellt (FRIST)");
  regeln = [R({ id: "e3", tage: [3], zeit: "14:01" })];
  jetzt = Z("2026-10-07T12:01:10Z"); tick();
  eq(gemeldet.length, 2, "Laeufer: ein Termin innerhalb der Frist wird gemeldet");
  lauf.stoppen();
}

// --- erinnerung-core
eq(e.meldeText("Noch {n} offen", 3), "Noch 3 offen", "Text: {n} wird ersetzt");
eq(e.meldeText("{n} Charaktere offen", 2), "2 Charaktere offen", "Text: {n} am Anfang");
eq(e.meldeText("Noch {n} Charaktere offen", null), "Noch Charaktere offen", "Text: ohne Zahl entfaellt {n} samt Leerzeichen davor");
eq(e.meldeText("Eine Meldung", 4), "Eine Meldung", "Text ohne {n} bleibt gleich");
eq(e.sollZeigen(true, 0), false, "nurOffen: bei 0 offen still");
eq(e.sollZeigen(true, 2), true, "nurOffen: bei 2 offen zeigen");
eq(e.sollZeigen(false, 0), true, "immer melden: auch bei 0");
eq(e.sollZeigen(true, null), false, "nurOffen ohne Antwort: still");
eq(e.sollZeigen(false, null), true, "immer melden ohne Antwort: zeigen");
{
  const a = new e.Anfragen();
  a.neu("e1", 1000, 1000);
  eq(a.offene(2000), ["e1"], "Anfragen: eine offene");
  eq(a.antwort("e1", 2000), true, "Anfragen: die Antwort wird angenommen");
  eq(a.antwort("e1", 2100), false, "Anfragen: nur eine Antwort je Anfrage");
  eq(a.antwort("fremd", 2100), false, "Anfragen: eine unbekannte id wird abgelehnt");
  a.neu("e2", 5000, 5000);
  eq(a.verfallene(5000 + e.ANTWORT_FRIST - 1), [], "Anfragen: vor der Frist nichts verfallen");
  eq(a.verfallene(5000 + e.ANTWORT_FRIST), ["e2"], "Anfragen: nach der Frist verfallen");
  eq(a.antwort("e2", 5000 + e.ANTWORT_FRIST + 1), false, "Anfragen: eine verfallene wird nicht mehr beantwortet");
}

console.log(failed ? `\n${failed} FAILED` : "\nall ok");
process.exit(failed ? 1 : 0);
