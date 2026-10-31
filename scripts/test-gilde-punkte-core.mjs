// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Kern der Punkte der Gilde (src/renderer/gilde-punkte-core.ts), ohne Seite und ohne Uhr:
// aktive Monate (volle Monate, Monatsende, Schaltjahr, Inaktiv-Zeitraeume), Teilnahmen je Art
// (Boss 7 je Punkt, Zaehler, Stichtag, inaktiv), Gildenansehen, Zusatz, Rang unter den Aktiven,
// Einlesen aus einer Tabelle, Text
// (Spezifikation docs/superpowers/specs/2026-10-11-gilde-punkte-design.md, 2). Namen sind erfunden.
// Die ganze Probe laeuft unter drei Zeitzonen: der Kern rechnet mit Wanduhr-Tagen und aendert sich nie.
//
// Run:  npm run test:gilde-punkte-core

import * as esbuild from "esbuild";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const hier = fileURLToPath(import.meta.url);
const root = join(dirname(hier), "..");

if (!process.env.BORO_TZ_LAUF) {
  for (const TZ of ["Pacific/Auckland", "America/Los_Angeles", "UTC"]) {
    console.log("--- Zeitzone " + TZ);
    const r = spawnSync(process.execPath, [hier], { env: { ...process.env, TZ, BORO_TZ_LAUF: TZ }, stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status || 1);
  }
  process.exit(0);
}

const b = await esbuild.build({ entryPoints: [join(root, "src", "renderer", "gilde-punkte-core.ts")],
  bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
const k = await import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));

let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), c = JSON.stringify(want);
  if (a === c) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        bekommen " + a + "\n        erwartet " + c); }
}
const nahe = (got, want, name) => eq(Math.round(got * 1e6) / 1e6, want, name);

const A = "mtest00001", B = "mtest00002", C = "mtest00003", D = "mtest00004";
const BOSS = "aboss00001", NORM = "anorm00001", SCHW = "aschw00001", ALPT = "aalpt00001";
const R1 = "rtest00001", R2 = "rtest00002";
const leerPunkte = (mehr = {}) => ({ seit: "2026-10-01", pausen: [], start: {}, ansehen: { start: 0, eintraege: [] }, zusatz: [], ...mehr });
const m = (id, name, punkte, mehr = {}) => ({ id, name, rolle: "dps", waffen: [], notiz: "", ...(punkte ? { punkte } : {}), ...mehr });
const reihe = (id, art, mehr = {}) => ({ id, titel: "Event", start: "2026-10-07T20:00", zone: "Europe/Berlin",
  wdh: { art: "woche", tage: [] }, dauerMin: 120, erinnerungMin: 0, ausnahmen: {}, ...(art ? { art } : {}), ...mehr });   // 07.10.2026 ist ein Mittwoch
const arten = () => JSON.parse(JSON.stringify(k.STANDARD_ARTEN));
const g = (mehr = {}, regeln = {}) => ({ id: "gtest00001", name: "Testgilde", mitglieder: [m(A, "Testperson A", leerPunkte())], reihen: [reihe(R1, BOSS)],
  anwesend: {}, punkte: { ...k.STANDARD_REGELN, an: true, stichtag: "2026-10-01", arten: arten(), ...regeln }, ...mehr });
const key = (r, d) => r + "|" + d;
const JETZT = "2026-10-22T12:00";

// --- Standard
eq(k.STANDARD_ARTEN.map((a) => [a.id, a.proPunkt]), [[BOSS, 7], [NORM, 1], [SCHW, 1], [ALPT, 1]], "Standardarten: Gildenboss 7 je Punkt, die Raids 1");
eq(k.STANDARD_REGELN, { an: false, rang: false, gruppen: false, schwellen: [80, 60], monat: 1, teiler: 100000 }, "Standardregeln: aus, 1 Punkt je Monat, Teiler 100 000");

// --- Monatstage
eq([k.monatTag("2026-01-31", 1), k.monatTag("2026-01-31", 2)], ["2026-02-28", "2026-03-31"], "31. Januar: im Februar der letzte Tag, im Maerz wieder der 31.");
eq(k.monatTag("2028-01-31", 1), "2028-02-29", "Schaltjahr: der 29. Februar");
eq(k.monatTag("2026-11-30", 3), "2027-02-28", "ueber den Jahreswechsel");

// --- aktive Monate
const mon = (p, heute) => k.aktiveMonate({ pausen: [], ...p }, heute);
eq(mon({ seit: "2026-01-31" }, "2026-03-30").monate, 1, "volle Monate: am 30. Maerz erst der Februar");
eq(mon({ seit: "2026-01-31" }, "2026-03-31").monate, 2, "volle Monate: am 31. Maerz auch der Maerz");
eq(mon({ seit: "2026-10-01" }, "2026-10-22").monate, 0, "vor dem ersten Monatstag: 0");
eq(mon({ seit: "2028-01-31" }, "2028-02-28").monate, 0, "Schaltjahr: am 28. Februar noch nicht");
eq(mon({ seit: "2028-01-31" }, "2028-02-29").monate, 1, "Schaltjahr: am 29. Februar der Monat");
const P1 = { seit: "2026-01-15", pausen: [{ von: "2026-05-01", bis: "2026-07-01" }] };
eq([mon({ seit: "2026-01-15" }, "2026-09-15").monate, mon(P1, "2026-09-15").monate], [8, 6], "eine Pause nimmt die Monatstage darin weg (Mai, Juni)");
eq(mon({ seit: "2026-01-15", pausen: [{ von: "2026-05-01", bis: "2026-05-15" }] }, "2026-09-15").monate, 8, "bis ist ausgeschlossen: der 15.05. zaehlt");
eq(mon({ seit: "2026-01-15", pausen: [{ von: "2026-05-15", bis: "2026-05-16" }] }, "2026-09-15").monate, 7, "von ist eingeschlossen: der 15.05. faellt weg");
const offen = { seit: "2026-01-15", pausen: [{ von: "2026-08-10" }] };
eq(mon(offen, "2026-09-15"), { roh: 6, monate: 6 }, "offene Pause: August und September zaehlen nicht");
eq(mon({ ...offen, abzugMonate: 2 }, "2026-09-15"), { roh: 6, monate: 4 }, "frueher inaktive Monate gehen ab");
eq(mon({ ...offen, abzugMonate: 99 }, "2026-09-15").monate, 0, "der Abzug macht nie weniger als 0");
eq(mon({ seit: "2026-01-15", pausen: [{ von: "2026-02-01", bis: "2026-03-01" }, { von: "2026-06-01", bis: "2026-07-01" }] }, "2026-09-15").monate, 6, "mehrere Pausen");

// --- inaktiv und Liste
const ap = [{ von: "2026-10-14" }];
eq([k.inaktivAm(ap, "2026-10-13"), k.inaktivAm(ap, "2026-10-14")], [false, true], "inaktivAm: ab dem Beginn");
eq([k.aufListe(m(A, "A", leerPunkte({ pausen: ap })), "2026-10-13"), k.aufListe(m(A, "A", leerPunkte({ pausen: ap })), "2026-10-14")], [true, false], "aufListe: ab dem Pausentag nicht mehr");
eq(k.aufListe(m(A, "A", leerPunkte(), { geloest: true }), "2026-10-13"), false, "aufListe: ein geloestes Mitglied nie");
eq(k.aufListe(m(A, "A"), "2026-10-13"), true, "aufListe: ohne Punkte-Feld immer");

// --- Teilnahmen und Konto: Gildenboss, 7 Teilnahmen je Punkt
const zaehler = { [key(R1, "2026-10-07")]: { [A]: 7 }, [key(R1, "2026-10-14")]: { [A]: 5 }, [key(R1, "2026-10-21")]: { [A]: 3 } };
const kA = (gil, mem = A) => k.konto(gil, gil.mitglieder.find((x) => x.id === mem), JETZT);
let ka = kA(g({ zaehler }));
eq(ka.zaehl[BOSS], 15, "Boss: 7 + 5 + 3 Teilnahmen");
nahe(ka.pkt[BOSS], 2.142857, "Boss: 15 Teilnahmen sind 15/7 Punkt");
eq([ka.teile.termine === ka.pkt[BOSS], ka.summe], [true, 2.14], "die Summe ist auf zwei Stellen gerundet");
eq(kA(g({ zaehler: { [key(R1, "2026-10-07")]: { [A]: 9 } } })).zaehl[BOSS], 7, "ein Zaehler ueber 7 zaehlt 7");
eq(kA(g({ zaehler }, { stichtag: "2026-10-14" })).zaehl[BOSS], 8, "Stichtag: nur Termine ab dem 14.10. (5 + 3)");
eq(kA(g({ zaehler }, { stichtag: "2026-10-14" })).summe, 1.14, "Stichtag: 8/7 sind 1.14");
const mitStart = g({ zaehler, mitglieder: [m(A, "Testperson A", leerPunkte({ start: { [BOSS]: 14 } }))] }, { stichtag: "2026-10-21" });
eq([kA(mitStart).zaehl[BOSS], kA(mitStart).summe], [17, 2.43], "Startstand 14 plus 3 seit dem Stichtag: 17 Teilnahmen, 2.43");
eq(kA(g({ zaehler: { [key(R1, "2026-10-28")]: { [A]: 7 } } })).zaehl[BOSS], 0, "ein Termin in der Zukunft zaehlt nicht");
eq(kA(g({ zaehler, reihen: [reihe(R1, BOSS, { ausnahmen: { "2026-10-14": { aus: true } } })] })).zaehl[BOSS], 10, "ein ausgefallener Termin zaehlt nicht");
eq(kA(g({ zaehler: { [key(R1, "2026-10-07")]: { [A]: 7 } }, mitglieder: [m(A, "Testperson A", leerPunkte({ pausen: ap }))] })).zaehl[BOSS], 7, "inaktiv ab 14.10.: nur der 07.10. zaehlt");
eq(kA(g({ zaehler: { [key(R1, "2026-10-14")]: { [A]: 5 } }, mitglieder: [m(A, "Testperson A", leerPunkte({ pausen: ap }))] })).zaehl[BOSS], 0, "inaktiv am Tag des Termins: er zaehlt nicht");
eq(kA(g({ zaehler, reihen: [reihe(R1, undefined)] })).zaehl[BOSS], 0, "ein Event ohne Art zaehlt nicht");
eq(kA(g({ zaehler, reihen: [reihe(R1, BOSS, { geloest: true })] })).zaehl[BOSS], 0, "ein geloestes Event zaehlt nicht");
const artGeloest = arten(); artGeloest[0].geloest = true;
eq(BOSS in kA(g({ zaehler }, { arten: artGeloest })).zaehl, false, "eine geloeste Art steht nicht im Konto");
eq(kA(g({ zaehler }, { arten: artGeloest })).summe, 0, "eine geloeste Art bringt keine Punkte");

// --- Raid: da zaehlt, nicht da und die alte Entschuldigung nicht
const raid = g({ reihen: [reihe(R2, NORM, { start: "2026-10-09T20:00" })],     // Freitag: 09.10., 16.10. (23.10. liegt in der Zukunft)
  mitglieder: [m(A, "Testperson A", leerPunkte()), m(B, "Testperson B", leerPunkte())],
  anwesend: { [key(R2, "2026-10-09")]: { [A]: "da", [B]: "fehlt" }, [key(R2, "2026-10-16")]: { [A]: "entschuldigt", [B]: "da" } } });
eq([kA(raid, A).zaehl[NORM], kA(raid, B).zaehl[NORM]], [1, 1], "Raid: nur da zaehlt (nicht da und alte Entschuldigung nicht)");
eq(kA(raid, A).pkt[NORM], 1, "Raid: 1 Teilnahme sind 1 Punkt");

// --- Monate in der Summe
const m9 = g({ mitglieder: [m(A, "Testperson A", leerPunkte({ seit: "2026-01-15", zusatz: [{ punkte: 0.5, notiz: "x" }] }))] });
eq([kA(m9).monate, kA(m9).summe], [9, 9.5], "neun Monatstage seit dem 15.01. und ein halber Zusatzpunkt");
eq(kA(g({ mitglieder: [m(A, "Testperson A", leerPunkte({ seit: "2026-01-15" }))] }, { monat: 2 })).teile.monate, 18, "Punkte je Monat einstellbar");

// --- Gildenansehen
const ans = (start, eintraege, regeln = {}) => kA(g({ mitglieder: [m(A, "Testperson A", leerPunkte({ ansehen: { start, eintraege } }))] }, regeln)).ansehen;
eq(ans(150000, [{ datum: "2026-10-04", betrag: 30000 }, { datum: "2026-10-05", betrag: 99999, geloest: true }]), 1.8, "Ansehen: Startstand plus Eintraege, gelöste zaehlen nicht");
eq(ans(150000, [{ datum: "2026-10-04", betrag: 30000 }], { teiler: 50000 }), 3.6, "Ansehen: der Teiler ist einstellbar");
eq(ans(0, [{ datum: "2026-10-04", betrag: 12600 }]), 0.13, "Ansehen: auf zwei Stellen gerundet (0.126)");
eq(ans(1000, []), 0.01, "Ansehen: 1000 sind 0.01 Punkt");

// --- Zusatz
const zus = kA(g({ mitglieder: [m(A, "Testperson A", leerPunkte({ zusatz: [{ punkte: 3, notiz: "x" }, { punkte: 0.5, notiz: "y" }, { punkte: 10, notiz: "z", geloest: true }] }))] }));
eq(zus.zusatz, 3.5, "Zusatz: Summe ohne die gelösten");

// --- ohne Punkte-Feld
eq(kA(g({ mitglieder: [m(A, "Testperson A")] })).summe, 0, "ohne Punkte-Feld: ein leeres Konto");

// --- Rang unter den Aktiven
const zp = (p, mehr = {}) => leerPunkte({ seit: "2026-10-22", zusatz: [{ punkte: p, notiz: "x" }], ...mehr });
const rang = g({ mitglieder: [m(C, "Testperson C", zp(5)), m(B, "Testperson B", zp(10)), m(A, "Testperson A", zp(10)), m(D, "Testperson D", zp(99, { pausen: [{ von: "2026-10-20" }] }))] },
  { rang: true, gruppen: true, schwellen: [8, 6] });
const rl = k.rangliste(rang, JETZT);
eq(rl.map((x) => [x.m.name, x.summe, x.rang, x.gruppe, x.pausiert]), [["Testperson A", 10, 1, "Spitze", false], ["Testperson B", 10, 1, "Spitze", false],
  ["Testperson C", 5, 3, "Ende", false], ["Testperson D", 99, null, "", true]], "Rangliste: Aktive nach Summe (gleich: nach Name, gleicher Rang), Inaktive danach ohne Rang und Gruppe");
eq(k.rangliste(g({ mitglieder: [m(A, "Testperson A", zp(7)), m(B, "Testperson B", zp(6))] }, { schwellen: [8, 6] }), JETZT).map((x) => x.gruppe), ["Mitte", "Mitte"], "Gruppe: Mitte ab der zweiten Schwelle");
eq(k.rangliste(g({ mitglieder: [m(A, "Testperson A", zp(5), { geloest: true })] }), JETZT), [], "Rangliste: geloeste Mitglieder fehlen");

// --- Text
const w = { kopf: "Punkte", inaktiv: "inaktiv", zahl: (n) => String(n), gruppe: (x) => x.toLowerCase() };
eq(k.punkteText(rl, rang, w), "Testgilde · Punkte\n1. Testperson A · 10 · spitze\n1. Testperson B · 10 · spitze\n3. Testperson C · 5 · ende\nTestperson D · 99 · [inaktiv]",
  "Text: Rang und Gruppe, wenn zugeschaltet; Inaktive am Ende mit Marke");
eq(k.punkteText(rl, g({ mitglieder: rang.mitglieder }), w), "Testgilde · Punkte\nTestperson A · 10\nTestperson B · 10\nTestperson C · 5\nTestperson D · 99 · [inaktiv]",
  "Text: ohne Rang und Gruppe nur Name und Summe");

// --- Einlesen aus einer Tabelle
const tg = g({ mitglieder: [m(A, "Testperson A", leerPunkte()), m(B, "Testperson B", leerPunkte()), m(C, "Testperson C", leerPunkte(), { geloest: true })] });
const text = ["Testperson A\t01.02.2025\t\t14\t3\t2\t1\t250000", "Testperson Q\t01.01.2025\t\t1\t1\t1\t1\t1", "Testperson B\t15.03.2025\tja\t7\t1.234,5\t0\t0\t5",
  "", "kaputt", "testperson C\t01.01.2025\t\t1\t1\t1\t1\t1"].join("\n");
const ein = k.tabelleEinlesen(text, tg);
eq(ein.fremd, 3, "Einlesen: unbekannte, kaputte und gelöste Namen werden gezaehlt, nicht uebernommen");
eq(ein.zeilen, [
  { mitgliedId: A, seit: "2025-02-01", offenePause: false, start: { [BOSS]: 98, [NORM]: 3, [SCHW]: 2, [ALPT]: 1 }, ansehenStart: 250000 },
  { mitgliedId: B, seit: "2025-03-15", offenePause: true, start: { [BOSS]: 49, [NORM]: 1234.5, [SCHW]: 0, [ALPT]: 0 }, ansehenStart: 5 }],
  "Einlesen: Punkte der Tabelle werden zu Teilnahmen (Boss mal 7), 1.234,5 ist 1234,5, ja ist eine offene Pause");
eq(k.tabelleEinlesen("Testperson A\t31.02.2025\t\t1", tg).zeilen[0].seit, undefined, "Einlesen: ein Datum, das es nicht gibt, wird nicht uebernommen");
eq(k.tabelleEinlesen("Testperson A\t\t\t1\t\t\t", tg).zeilen[0].start[NORM], 0, "Einlesen: eine leere Zelle ist 0");
const halb = g({ mitglieder: tg.mitglieder }, { arten: arten().map((a) => (a.id === BOSS ? { ...a, punkte: 2 } : a)) });
eq(k.tabelleEinlesen("Testperson A\t\t\t4", halb).zeilen[0].start[BOSS], 14, "Einlesen: Punkte der Tabelle durch Punkte der Art mal Teilnahmen je Punkt (4 / 2 * 7)");

// --- der Kern kennt keine Uhr, kein Netz, keine Zufallszahl
const quelle = readFileSync(join(root, "src", "renderer", "gilde-punkte-core.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
eq(/Date\.now|new Date\(\s*\)|Math\.random|\bfetch\b|\bimport\s*\(|\brequire\b/.test(quelle), false, "der Kern liest nie die Uhr und hat kein Netz");
eq([...quelle.matchAll(/^import [^\n]*from "([^"]+)";$/gm)].map((x) => x[1]).sort(), ["./gilde-core", "./gilde-core"].sort(), "der Kern importiert nur den Gilde-Kern (Werte und Typen)");

console.log(failed ? "\n" + failed + " Probe(n) fehlgeschlagen." : "\nAlle Proben bestanden.");
process.exit(failed ? 1 : 0);
