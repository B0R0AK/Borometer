// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Kern des Log-Archivs (src/renderer/archiv-core.ts, Spezifikation
// Log-Archiv #264): Schluessel, Platz, Bossliste, Zeilenschnitt. Orte, Logs und
// Zahlen sind erfunden - keine Spieler. Vormerkung (Task 7, test-archiv-page):
// ein Stueck wieder eingelesen ergibt mit segment() denselben Kampf (DPS,
// Schaden, Dauer).
//
// Run:  npm run test:archiv-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const b = await esbuild.build({ stdin: { contents: 'export * from "./src/renderer/archiv-core";', resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
const core = await import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));

let failed = 0;
function ok(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "\n        " + JSON.stringify(detail).slice(0, 600))); }
}
const eq = (got, want, name) => ok(JSON.stringify(got) === JSON.stringify(want), name, { got, want });

const orte = [
  { id: "raid:alfa", de: "Alfa", en: "Alfa", namen: ["Alfa"], unter: { de: "Turm der Probe", en: "Tower of Trial" }, gruppe: "raid" },
  { id: "dungeon:beta", de: "Beta", en: "Beta", namen: ["Beta", "Betta"], unter: { de: "Grube", en: "Pit" }, gruppe: "s2" },
  { id: "puppe:120", de: "Übungspuppe", en: "Practice dummy", namen: ["Übungspuppe"], unter: null, gruppe: "puppe" },
];
const k = [{ k: "a|1", platz: "raid:alfa", boss: "Alfa", at: 1, dps: 466800, dmg: 1, dur: 60, datei: "a", zeilen: 1 },
           { k: "a|2", platz: "raid:alfa", boss: "Alfa", at: 2, dps: 300000, dmg: 1, dur: 60, datei: "a", zeilen: 1, geloest: true }];

eq(core.archivSchluessel("log1.txt", 5), "log1.txt|5", "Schluessel");
eq(core.archivPlatz("Betta", orte), "dungeon:beta", "Platz ueber zweiten Namen");
eq(core.archivPlatz("Aufgestiegener Alfa [Undead]", orte), "raid:alfa", "Rang und Zustand fallen weg");
eq(core.archivPlatz("alfa", orte), "raid:alfa", "Gross- und Kleinschreibung egal");
eq(core.archivPlatz("Unbekannt", orte), null, "unbekannter Boss gehoert nicht ins Archiv");
eq(core.archivPlatz("Übungspuppe", orte, 120), "puppe:120", "Puppe je Laengenklasse");
eq(core.archivPlatz("Übungspuppe", orte), null, "Puppe ohne Klasse: kein Platz");
eq(core.archivPlatz("Übungspuppe", orte, 90), null, "Puppe mit ungueltiger Klasse: kein Platz");
eq(core.archivPlatz("Practice Dummy", orte, 120), "puppe:120", "Puppe englisch");
eq(core.archivPlatz("Arkeum Statue for Training", orte, 120), "puppe:120", "Statue ist eine Puppe");
eq(core.archivPlatz("Practice Dummy", orte, 60), null, "Klasse ohne Ort: kein Platz");

const ohne = core.bossListe(orte, k, "", "de");
eq(ohne.map((g) => g.gruppe), ["raid", "s2", "puppe"], "Gliederung nach Album");
eq(ohne[0].zeilen[0], { ort: orte[0], n: 1, bester: 466800 }, "geloeste zaehlen nicht");
eq(ohne[1].zeilen[0], { ort: orte[1], n: 0, bester: null }, "ohne Kampf: n 0, bester null");
const ids = (f, s) => core.bossListe(orte, k, f, s).flatMap((g) => g.zeilen.map((z) => z.ort.id));
eq(ids("turm", "de"), ["raid:alfa"], "Raidname findet seinen Boss");
eq(ids("pit", "en"), ["dungeon:beta"], "Dungeonname englisch");
eq(ids("  BETTA ", "de"), ["dungeon:beta"], "Filter: klein und getrimmt, auch Nebenname");
eq(ids("zzz", "de"), [], "nichts gefunden");

// ---------------------------------------------------------------- Zeilenschnitt
const zeit = (z) => { const m = /^(\d+),/.exec(z); return m ? Number(m[1]) : null; };
const log = ["# Kopf", "// Notiz", "CombatLogVersion,4", "1000,x", "5000,x", "9000,y", "12000,y", "20000,z", "kaputt", "30000,z"].join("\n");
eq(core.kampfZeilen(log, 9000, 12000, zeit), "# Kopf\n// Notiz\nCombatLogVersion,4\n9000,y\n12000,y", "mittlerer Kampf: Kopf plus seine Zeilen");
eq(core.kampfZeilen(log, 5000, 5000, zeit), "# Kopf\n// Notiz\nCombatLogVersion,4\n5000,x", "Rand: 2000 ms vor und nach");
eq(core.kampfZeilen(log, 7000, 7000, zeit), "# Kopf\n// Notiz\nCombatLogVersion,4\n5000,x\n9000,y", "Rand inklusive");
eq(core.kampfZeilen(log, 100000, 200000, zeit), null, "ohne Treffer: null");
eq(core.kampfZeilen("", 0, 1, zeit), null, "leerer Text: null");
const gross = "1,x\n".repeat(2.2 * 1024 * 1024);
eq(core.kampfZeilen(gross, 0, 10, zeit), null, "ueber 8 MB: null");

// einmal zerlegt, mehrfach geschnitten: dasselbe Ergebnis wie kampfZeilen, die Zeitauslesung je Zeile nur einmal
{
  let rufe = 0;
  const z = core.logZeilen(log, (x) => { rufe++; return zeit(x); });
  const stuecke = [[9000, 12000], [5000, 5000], [7000, 7000], [100000, 200000]].map(([a, b]) => core.kampfStueck(z, a, b));
  eq(stuecke, [[9000, 12000], [5000, 5000], [7000, 7000], [100000, 200000]].map(([a, b]) => core.kampfZeilen(log, a, b, zeit)), "kampfStueck aus logZeilen wie kampfZeilen");
  eq(rufe, 7, "logZeilen liest die Zeit jeder Zeile ohne Kopf genau einmal");
}

// ---------------------------------------------------------------- Eintrag aus dem Verlauf
const kampfV = { name: "Alfa [Wut]", dps: 1234.5, dmg: 98765, dur: 80, at: 1789931100000, hits: 40, top: 9, w: [1, 2] };
eq(core.archivEintrag(kampfV, { platz: "raid:alfa", boss: "Alfa" }, "log-a.txt", 12),
  { k: "log-a.txt|1789931100000", platz: "raid:alfa", boss: "Alfa", at: 1789931100000, dps: 1234.5, dmg: 98765, dur: 80, datei: "log-a.txt", zeilen: 12 },
  "Eintrag: nur Schluessel, Platz, Zahlen, Datei; nichts sonst vom Verlauf");
eq(core.archivEintrag({ ...kampfV, c: 60, ch: "wprobe0001" }, { platz: "puppe:60", boss: "Practice Dummy" }, "log-b.txt", 3),
  { k: "log-b.txt|1789931100000", platz: "puppe:60", boss: "Practice Dummy", at: 1789931100000, dps: 1234.5, dmg: 98765, dur: 80, c: 60, ch: "wprobe0001", datei: "log-b.txt", zeilen: 3 },
  "Eintrag: Laengenklasse und Charakterkennung");
eq(["", "Erfunden", "w12", "W123456789"].map((x) => "ch" in core.archivEintrag({ ...kampfV, ch: x }, { platz: "raid:alfa", boss: "Alfa" }, "l.txt", 1)),
  [false, false, false, false], "Eintrag: ch nur als Kennung (w und neun Zeichen), nie ein Name, nie leer");

// Fix-Runde 1 zu Aufgabe 8: die Zahlen je Platz einmal je Stand (archivZahlen), die Liste daraus (bossListeAus)
const zahlen = core.archivZahlen([...k, { k: "b|3", platz: "dungeon:beta", boss: "Beta", at: 3, dps: 1000, dmg: 1, dur: 30, datei: "b", zeilen: 1 },
  { k: "b|4", platz: "dungeon:beta", boss: "Beta", at: 4, dps: 2500, dmg: 1, dur: 30, datei: "b", zeilen: 1 }]);
eq([...zahlen].sort(), [["dungeon:beta", { n: 2, bester: 2500 }], ["raid:alfa", { n: 1, bester: 466800 }]], "Zahlen je Platz: Anzahl und bester DPS, ohne geloeste");
for (const [f, sp] of [["", "de"], ["turm", "de"], ["pit", "en"], ["xyz", "de"], ["Betta", "en"]])
  eq(core.bossListeAus(orte, core.archivZahlen(k), f, sp), core.bossListe(orte, k, f, sp), "bossListeAus gleich bossListe (Frage " + JSON.stringify(f) + ")");
eq(core.bossListeAus(orte, new Map(), "", "de").flatMap((g) => g.zeilen.map((z) => [z.n, z.bester])), [[0, null], [0, null], [0, null]], "ohne Zahlen: jede Zeile ohne Kampf");

// Archiv neu (#288): Kategorie, Filter, Statistik und Kurve der Boss-Karten
const mitSeite = [
  { ...orte[0], seite: "raid" }, { ...orte[1], seite: "dungeon" }, { ...orte[2], seite: "puppe" },
  { id: "feld:gamma", de: "Gamma", en: "Gamma", namen: ["Gamma"], unter: null, gruppe: "erz", seite: "feld" },
  { id: "feld:delta", de: "Delta", en: "Delta", namen: ["Delta"], unter: null, gruppe: "feld", seite: "feld" },
];
eq(mitSeite.map((o) => core.archivKategorie(o)), ["raid", "dungeon", "puppe", "feld", "feld"], "Kategorie aus der Seite des Albums (Erzbosse zaehlen als Feldboss)");
eq(orte.map((o) => core.archivKategorie(o)), ["raid", "dungeon", "puppe"], "Kategorie ohne Seite aus der Gruppe");
eq(core.archivKategorie({ ...orte[0], seite: undefined, gruppe: "koloss" }), "feld", "Koloss ohne Seite: Feldboss");
eq(core.archivKategorie({ ...orte[0], seite: undefined, gruppe: "solo" }), "dungeon", "Solo ohne Seite: Dungeon");
const z5 = core.archivZahlen([{ k: "g|1", platz: "feld:gamma", boss: "Gamma", at: 1, dps: 5000, dmg: 1, dur: 30, datei: "g", zeilen: 1 }, ...k]);
const idsF = (f, filter) => core.bossListeAus(mitSeite, z5, f, "de", filter).flatMap((g) => g.zeilen.map((z) => z.ort.id));
eq(idsF("", { kat: "alle", nurMit: false }), mitSeite.map((o) => o.id), "Filter alle: jeder Boss");
eq(idsF("", undefined), mitSeite.map((o) => o.id), "ohne Filter: jeder Boss");
eq(idsF("", { kat: "feld", nurMit: false }), ["feld:gamma", "feld:delta"], "Chip Feldboss");
eq(idsF("", { kat: "raid", nurMit: false }), ["raid:alfa"], "Chip Raid");
eq(idsF("", { kat: "alle", nurMit: true }), ["raid:alfa", "feld:gamma"], "Nur mit Kaempfen");
eq(idsF("gam", { kat: "dungeon", nurMit: false }), [], "Chip und Suchtext wirken zusammen");
eq(idsF("a", { kat: "feld", nurMit: true }), ["feld:gamma"], "alle drei zusammen");
const kn = (dps, extra = {}) => ({ k: "x|" + dps, platz: "raid:alfa", boss: "Alfa", at: dps, dps, dmg: 1, dur: 60, datei: "x", zeilen: 1, ...extra });
eq(core.archivStatistik([]), { n: 0, bester: 0, median: 0 }, "Statistik ohne Kaempfe");
eq(core.archivStatistik([kn(100), kn(300), kn(200)]), { n: 3, bester: 300, median: 200 }, "Statistik: ungerade Zahl, Median in der Mitte");
eq(core.archivStatistik([kn(100), kn(200), kn(400), kn(300)]), { n: 4, bester: 400, median: 250 }, "Statistik: gerade Zahl, Mittel der zwei mittleren");
eq(core.archivStatistik([kn(100), kn(900, { geloest: true })]), { n: 1, bester: 100, median: 100 }, "Statistik ohne geloeste");
eq(core.archivKurve([5], 100, 20), null, "Kurve: ein Kampf ist keine Kurve");
eq(core.archivKurve([], 100, 20), null, "Kurve: ohne Kampf nichts");
const kv = core.archivKurve([100, 300, 200], 100, 20, 0);
eq(kv, { punkte: [[0, 20], [50, 0], [100, 10]], best: 1 }, "Kurve: aelteste links, hoher DPS oben, bester markiert");
eq(core.archivKurve([7, 7], 100, 20, 0), { punkte: [[0, 10], [100, 10]], best: 0 }, "Kurve: gleiche Werte liegen in der Mitte, der erste ist der beste");
eq(core.archivKurve([1, 2], 100, 20, 6).punkte, [[6, 14], [94, 6]], "Kurve: Rand innen");
eq(core.archivKurve([1, 2], 100, 20).punkte.every(([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= 20), true, "Kurve: alle Punkte liegen in der Flaeche");

// Archiv: die Bossseite zeigt die Verlaufsansicht (#292): die Vereinigung aus Verlauf und Archiv
const va = (at, dps, extra = {}) => ({ name: "Alfa", dps, dmg: dps * 10, dur: 60, at, file: "v.txt", ...extra });
const ak = (at, dps, extra = {}) => ({ k: "a.txt|" + at, platz: "raid:alfa", boss: "Alfa", at, dps, dmg: dps * 10, dur: 70, datei: "a.txt", zeilen: 5, ...extra });
eq(core.archivMenge([], []), [], "Menge: leer bleibt leer");
eq(core.archivMenge([va(5, 100)], []), [{ ...va(5, 100) }], "Menge: nur Verlauf, ohne Schluessel k");
eq(core.archivMenge([], [ak(5, 100, { ch: "w123456789" })]), [{ name: "Alfa", dps: 100, dmg: 1000, dur: 70, at: 5, file: "a.txt", ch: "w123456789", k: "a.txt|5" }],
  "Menge: nur Archiv, Boss als Name, Logname als Datei, Kennung des Charakters, Schluessel k");
eq(core.archivMenge([va(5, 100)], [ak(5, 100)]), [{ ...va(5, 100), k: "a.txt|5" }], "Menge: derselbe Beginn ist ein Kampf, er behaelt Name und Datei des Verlaufs und bekommt k");
eq(core.archivMenge([va(9, 300), va(1, 100)], [ak(5, 200)]).map((x) => [x.at, x.dps, x.k ?? null]), [[1, 100, null], [5, 200, "a.txt|5"], [9, 300, null]], "Menge: nach der Zeit, k nur am Archivkampf");
eq(core.archivMenge([va(5, 100)], [ak(5, 100, { geloest: true })]), [{ ...va(5, 100) }], "Menge: ein gelöster Archivkampf gibt kein k");
eq(core.archivMenge([], [ak(5, 100, { geloest: true })]), [], "Menge: ein gelöster Archivkampf steht nicht darin");
eq(core.archivMenge([], [ak(5, 100, { c: 120 })])[0].c, 120, "Menge: die Laengenklasse der Puppe bleibt");
eq(core.archivMenge([va(5, 100, { g: 1 })], []).length, 1, "Menge: reicht durch, was der Verlauf gibt (Summen filtert der Rufer)");
eq(core.archivStatistik([{ dps: 100 }, { dps: 300 }, { dps: 200 }]), { n: 3, bester: 300, median: 200 }, "Statistik: jede Liste mit dps");

// Loesen und endgueltig Loeschen (#264 Teil 4): der Satz zum Abtippen, wie der Hauptprozess ihn prueft
// (logDatum und bestaetigt in src/main/archiv.ts): Boss wie im Log, Leerzeichen, das Datum des Kampfs wie die Liste es
// zeigt - at ist die Wanduhr des Logs, als UTC gespeichert, also die UTC-Felder, keine Zeitzone (Entscheidung 26.10.2026)
eq(core.loeschBestaetigung("Erfundener Riese", Date.UTC(2026, 9, 10, 12, 0)), "Erfundener Riese 10.10.2026", "Bestaetigung: Boss und Tag");
eq(core.loeschBestaetigung("Alfa", Date.UTC(2026, 2, 5, 12, 0)), "Alfa 05.03.2026", "Bestaetigung: Tag und Monat mit fuehrender Null");
eq(core.loeschBestaetigung("Alfa", Date.UTC(2026, 9, 10, 23, 30)), "Alfa 10.10.2026", "Bestaetigung: 23:30 Logzeit bleibt der Tag der Liste (nicht der Berliner naechste)");
eq(core.loeschBestaetigung("Alfa", Date.UTC(2026, 9, 10, 22, 0)), "Alfa 10.10.2026", "Bestaetigung: 22:00 Logzeit ebenso");
eq(core.loeschBestaetigung("Alfa", Date.UTC(2026, 9, 11, 0, 0)), "Alfa 11.10.2026", "Bestaetigung: Mitternacht Logzeit ist der neue Tag");
eq(core.loeschBestaetigung("Alfa", Date.UTC(2026, 11, 31, 23, 59)), "Alfa 31.12.2026", "Bestaetigung: der letzte Moment des Jahres");
eq(core.logTag(Date.UTC(2026, 0, 31, 23, 30)), new Date(Date.UTC(2026, 0, 31, 23, 30)).toISOString().slice(0, 10).split("-").reverse().join("."),
  "logTag: dasselbe Datum wie die UTC-Felder (die Liste liest sie ueber toISOString)");
eq(core.loeschSoll([{ boss: "Alfa", at: Date.UTC(2026, 9, 10, 12, 0) }]), "Alfa 10.10.2026", "Soll: ein Kampf, Boss und Tag");
eq(core.loeschSoll([{ boss: "Alfa", at: 1 }, { boss: "Beta", at: 2 }, { boss: "Alfa", at: 3 }]), "3", "Soll: mehrere, die Anzahl in Ziffern");
eq(core.bestaetigungOk("  alfa 10.10.2026 ", "Alfa 10.10.2026"), true, "bestaetigungOk: getrimmt, ohne Gross-/Kleinschreibung");
eq(core.bestaetigungOk("ALFA 10.10.2026", "Alfa 10.10.2026"), true, "bestaetigungOk: Grossbuchstaben");
eq(core.bestaetigungOk("Alfa 10.10.26", "Alfa 10.10.2026"), false, "bestaetigungOk: ein anderes Datum nicht");
eq(core.bestaetigungOk("Alfa  10.10.2026", "Alfa 10.10.2026"), false, "bestaetigungOk: zwei Leerzeichen in der Mitte nicht");
eq(core.bestaetigungOk("", "Alfa 10.10.2026"), false, "bestaetigungOk: leer nicht");
eq(core.bestaetigungOk(" 3 ", "3"), true, "bestaetigungOk: die Anzahl mit Leerzeichen");
eq(core.bestaetigungOk("03", "3"), false, "bestaetigungOk: die Anzahl mit Null davor nicht");
eq(core.bestaetigungOk("drei", "3"), false, "bestaetigungOk: die Anzahl in Worten nicht");
const vorher = new Set(["a|1"]);
const nachher = core.auswahlUmschalten(vorher, "a|2");
eq([...nachher].sort(), ["a|1", "a|2"], "auswahlUmschalten: neu dazu");
eq([...vorher], ["a|1"], "auswahlUmschalten: die alte Menge bleibt, wie sie war");
eq([...core.auswahlUmschalten(nachher, "a|1")], ["a|2"], "auswahlUmschalten: gewaehlt wird abgewaehlt");
const gl = [ak(5, 100, { geloest: true }), { ...ak(9, 300, { geloest: true }), platz: "dungeon:beta", boss: "Beta" }, ak(7, 200, { geloest: true }), ak(8, 50)];
eq(core.geloesteGruppen(gl).map((g) => [g.platz, g.kaempfe.map((x) => x.at)]), [["dungeon:beta", [9]], ["raid:alfa", [7, 5]]],
  "geloesteGruppen: nur geloeste, je Boss, die Bosse nach ihrem neuesten Kampf, darin neueste zuerst");
eq(core.geloesteGruppen([ak(8, 50)]), [], "geloesteGruppen: ohne geloeste nichts");

if (failed) { console.log("\n" + failed + " FAILED"); process.exit(1); }
console.log("\nalle Proben ok");
