// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Kern der Gilde (src/renderer/gilde-core.ts), ohne Seite: Termine
// rechnen (Wanduhr, Sommerzeit), Auswerten (Quote, Straehne, letzte
// Teilnahme, entschuldigt zaehlt weder dafuer noch dagegen), Text, .ics
// (Spezifikation docs/superpowers/specs/2026-10-06-gilde-design.md, 3, 4, 6).
// Namen sind erfunden.
//
// Run:  npm run test:gilde-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const b = await esbuild.build({ entryPoints: [join(root, "src", "renderer", "gilde-core.ts")],
  bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
const k = await import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));
const bk = await esbuild.build({ entryPoints: [join(root, "src", "renderer", "klassen-core.ts")],
  bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
const kl = await import("data:text/javascript;base64," + Buffer.from(bk.outputFiles[0].text).toString("base64"));

let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), c = JSON.stringify(want);
  if (a === c) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        bekommen " + a + "\n        erwartet " + c); }
}

const reihe = (mehr = {}) => ({ id: "rtest00001", titel: "Raid", start: "2026-10-04T20:00", zone: "Europe/Berlin",
  wdh: { art: "woche", tage: [], }, dauerMin: 120, erinnerungMin: 15, ausnahmen: {}, ...mehr });   // 04.10.2026 ist ein Sonntag
const datum = (ts) => ts.map((t) => t.datum);

// --- Termine
eq(datum(k.termine(reihe(), "2026-10-01", "2026-10-31")), ["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25"], "jede Woche am Wochentag des Starts");
eq(k.termine(reihe(), "2026-10-24", "2026-11-02").map((t) => t.start), ["2026-10-25T20:00", "2026-11-01T20:00"],
  "20:00 bleibt 20:00 ueber das Ende der Sommerzeit (25.10.2026)");
eq(datum(k.termine(reihe(), "2026-09-01", "2026-10-12")), ["2026-10-04", "2026-10-11"], "nichts vor dem Start");
eq(datum(k.termine(reihe({ wdh: { art: "woche", tage: [], bis: "2026-10-12" } }), "2026-10-01", "2026-11-30")), ["2026-10-04", "2026-10-11"], "bis begrenzt die Reihe");
eq(datum(k.termine(reihe({ wdh: { art: "einmal", tage: [] } }), "2026-01-01", "2026-12-31")), ["2026-10-04"], "einmalig");
eq(datum(k.termine(reihe({ wdh: { art: "tage", tage: [3, 0] } }), "2026-10-04", "2026-10-14")), ["2026-10-04", "2026-10-07", "2026-10-11", "2026-10-14"], "selbst gewaehlte Tage (Mi, So)");
eq(k.termine(reihe({ ausnahmen: { "2026-10-11": { aus: true } } }), "2026-10-10", "2026-10-12").map((t) => [t.datum, t.aus]), [["2026-10-11", true]], "ein ausgefallener Termin bleibt mit aus=true in der Liste");
eq(k.termine(reihe({ ausnahmen: { "2026-10-11": { zeit: "19:30" } } }), "2026-10-11", "2026-10-11").map((t) => [t.datum, t.start]),
  [["2026-10-11", "2026-10-11T19:30"]], "verschoben: das Datum (Schluessel) bleibt, die Uhrzeit aendert sich");

const m = (id, name) => ({ id, name, rolle: "dps", waffen: [], notiz: "" });

// --- Klassen und Waffen
eq(kl.klasseVon(["Greatsword", "Sword and Shield"]), { en: "Crusader", de: "Kreuzritter", role: "tank" }, "klasseVon: Paar gibt die Klasse");
eq(kl.klasseVon(["Sword and Shield", "Greatsword"]), { en: "Crusader", de: "Kreuzritter", role: "tank" }, "klasseVon: Reihenfolge egal");
eq(kl.klasseVon(["Dagger", "Dagger"]), null, "klasseVon: zwei gleiche Waffen ergeben nichts");
eq(kl.klasseVon(["Dagger"]), null, "klasseVon: eine Waffe ergibt nichts");
eq(kl.klasseVon([]), null, "klasseVon: keine Waffe ergibt nichts");
eq(kl.klasseVon(["Dagger", "Passive"]), null, "klasseVon: Passive ist keine Waffe");
eq(kl.klasseVon(["Dagger", "Longbow", "Staff"]), null, "klasseVon: drei Waffen ergeben nichts");
eq(kl.klasseVon(["Staff", "Wand and Tome"]), { en: "Invocator", de: "Beschwörer", role: "heal" }, "klasseVon: Stab und Zauberstab sind Heiler");
eq(kl.klasseVon(["Dagger", "Longbow"]).en + "|" + kl.klasseVon(["Dagger", "Longbow"]).role, "Infiltrator|dps", "klasseVon: Dolch und Langbogen");
{
  let treffer = 0, rollenOk = true;
  for (let i = 0; i < kl.WAFFEN.length; i++) for (let j = i + 1; j < kl.WAFFEN.length; j++) {
    const c = kl.klasseVon([kl.WAFFEN[i], kl.WAFFEN[j]]);
    if (c) { treffer++; if (!["tank", "dps", "heal"].includes(c.role)) rollenOk = false; }
  }
  eq([kl.WAFFEN.length, treffer, rollenOk], [10, 45, true], "alle 45 Paare der zehn Waffen ergeben eine Klasse");
}
eq(Object.keys(kl.CLASS_NAMES).length, 45, "CLASS_NAMES hat 45 Schluessel");
eq(Object.keys(kl.CLASS_NAMES).every((s) => { const p = s.split("|"); return p.length === 2 && p[0] < p[1] && p.every((w) => kl.WAFFEN.includes(w)); }), true, "jeder Schluessel: zwei der zehn Waffen, sortiert");
eq(k.WAFFEN_DE["Greatsword"] + "|" + k.WAFFEN_DE["Orb"] + "|" + Object.keys(k.WAFFEN_DE).length, "Großschwert|Kugel|10", "WAFFEN_DE: zehn deutsche Namen");

const mw = (id, name, waffen, extra = {}) => ({ ...m(id, name), waffen, ...extra });
eq(k.rolleVon(mw("a", "X", ["Staff", "Wand and Tome"], { rolle: "dps" })), "heal", "rolleVon: das Paar gewinnt gegen rolle");
eq(k.rolleVon(mw("a", "X", [], { rolle: "tank" })), "tank", "rolleVon: ohne Paar gilt rolle");
eq(k.rolleVon(mw("a", "X", ["Dagger"], { rolle: "" })), "", "rolleVon: eine Waffe, keine Rolle");
const fm = [
  mw("f1", "Testperson A", ["Dagger", "Longbow"], { notiz: "" }),
  mw("f2", "Testperson B", ["Staff", "Wand and Tome"], { rolle: "dps", notiz: "Ersatz am Sonntag" }),
  mw("f3", "Testperson C", [], { rolle: "tank" }),
  mw("f4", "Testperson D", ["Greatsword", "Orb"], { geloest: true }),
];
const ids = (xs) => xs.map((x) => x.id);
eq(ids(k.filtern(fm, { rolle: "heal", suche: "" })), ["f2"], "filtern: Rolle heal nach Paar");
eq(ids(k.filtern(fm, { rolle: "", suche: "" })), ["f1", "f2", "f3"], "filtern: leer liefert alle nicht geloesten");
eq(ids(k.filtern(fm, { rolle: "", suche: "dolch" })), ["f1"], "filtern: Suche nach deutschem Waffennamen");
eq(ids(k.filtern(fm, { rolle: "", suche: "dagger" })), ["f1"], "filtern: Suche nach englischem Waffennamen");
eq(ids(k.filtern(fm, { rolle: "", suche: "infiltr" })), ["f1"], "filtern: Suche ueber Klasse");
eq(ids(k.filtern(fm, { rolle: "", suche: "ersatz" })), ["f2"], "filtern: Suche ueber Notiz");
eq(ids(k.filtern(fm, { rolle: "", suche: "TESTPERSON b" })), ["f2"], "filtern: Suche ueber Name, Gross-/Kleinschreibung egal");
eq(ids(k.filtern(fm, { rolle: "", suche: "kugel" })), [], "filtern: ein geloestes Mitglied fehlt immer");
eq(ids(k.filtern(fm, { rolle: "dps", suche: "testperson" })), ["f1"], "filtern: Rolle und Suche schneiden sich");

// --- Auswerten
const g = (anwesend, mehr = {}) => ({ id: "gtest00001", name: "Testgilde",
  mitglieder: [m("mtest00001", "Testperson A"), m("mtest00002", "Testperson B")],
  reihen: [reihe()], anwesend, ...mehr });
const key = (d) => "rtest00001|" + d;
const JETZT = "2026-10-26T12:00";

const z0 = k.auswerten(g({}), null, JETZT);
eq(z0.map((z) => [z.quote, z.straehne, z.letzte]), [[null, 0, null], [null, 0, null]], "ohne Haekchen: keine Quote, keine Straehne");

const A = "mtest00001", B = "mtest00002";
const an = {
  [key("2026-10-04")]: { [A]: "da", [B]: "da" },
  [key("2026-10-11")]: { [A]: "da", [B]: "fehlt" },
  [key("2026-10-18")]: { [A]: "entschuldigt", [B]: "da" },
  [key("2026-10-25")]: { [A]: "da", [B]: "da" },
};
const z1 = k.auswerten(g(an), null, JETZT);
eq(z1[0], { mitgliedId: A, da: 3, fehlt: 0, entschuldigt: 1, quote: 1, straehne: 3, letzte: "2026-10-25" },
  "entschuldigt faellt aus Nenner und Zaehler, unterbricht die Straehne nicht");
eq(z1[1], { mitgliedId: B, da: 3, fehlt: 1, entschuldigt: 0, quote: 0.75, straehne: 2, letzte: "2026-10-25" },
  "fehlt beendet die Straehne, die Quote ist da / (da + fehlt)");
eq(k.auswerten(g({ [key("2026-10-27")]: { [A]: "da" } }), null, JETZT)[0].da, 0, "ein Termin in der Zukunft zaehlt nicht");
eq(k.auswerten(g({ [key("2026-10-11")]: { [A]: "offen", [B]: "offen" } }), null, JETZT)[0].da, 0, "nur offene Haekchen: der Termin zaehlt nicht als abgehakt");
eq(k.auswerten(g({ ...an }, { reihen: [reihe({ ausnahmen: { "2026-10-11": { aus: true } } })] }), null, JETZT)[1].fehlt, 0, "ein ausgefallener Termin zaehlt nicht");
eq(k.auswerten(g(an, { mitglieder: [m(A, "Testperson A"), { ...m(B, "Testperson B"), geloest: true }] }), null, JETZT).map((z) => z.mitgliedId), [A], "ein geloestes Mitglied steht nicht in der Auswertung");
const zwei = { id: "rtest00002", titel: "Training", start: "2026-10-07T19:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 60, erinnerungMin: 0, ausnahmen: {} };
const g2 = g({ ...an, "rtest00002|2026-10-07": { [A]: "fehlt", [B]: "da" } }, { reihen: [reihe(), zwei] });
eq(k.auswerten(g2, ["rtest00002"], JETZT).map((z) => [z.da, z.fehlt]), [[0, 1], [1, 0]], "je Reihe");
eq(k.auswerten(g2, null, JETZT)[0].fehlt, 1, "gesamt zaehlt beide Reihen");

// --- Text
const kurz = (d) => d.slice(8, 10) + "." + d.slice(5, 7) + ".";
const w = { kopf: "Anwesenheit", reihe: "Raid", treffer: "", straehne: "Straehne", zuletzt: "zuletzt", entschuldigt: "entschuldigt", offen: "-", datum: kurz };
const text = k.textAusgabe(z1, g(an), w);
eq(text.split("\n")[0], "Testgilde \u00b7 Anwesenheit \u00b7 Raid", "Kopfzeile: Gilde, Kopf und Reihe; ohne Filter kein Treffersatz");
eq(k.textAusgabe(z1, g(an), { ...w, reihe: "Alle Reihen", treffer: "1 von 2 Mitgliedern" }).split("\n")[0],
  "Testgilde \u00b7 Anwesenheit \u00b7 Alle Reihen \u00b7 1 von 2 Mitgliedern", "Kopfzeile: mit Filter steht der Treffersatz dabei");
eq(k.textAusgabe(z1, g(an), { ...w, datum: (d) => d.slice(5, 7) + "/" + d.slice(8, 10) }).includes("zuletzt 10/25"), true, "das Datum kommt aus worte.datum (englisch 10/25)");
eq(k.textAusgabe(z0, g({}), w).split("\n")[1], "Testperson A \u00b7 - \u00b7 Straehne 0 \u00b7 zuletzt -", "ohne Teilnahme: offen statt Quote und Datum");
eq(text.includes("Testperson B \u00b7 75\u00a0% (3/4) \u00b7 Straehne 2 \u00b7 zuletzt 25.10."), true, "eine Zeile je Mitglied, geschuetztes Leerzeichen vor %");
eq(text.includes("Testperson A \u00b7 100\u00a0% (3/3) \u00b7 Straehne 3 \u00b7 zuletzt 25.10. \u00b7 1 entschuldigt"), true, "die Zahl der Entschuldigungen steht dahinter");

// --- .ics
const leer = k.ics(g({}, { reihen: [reihe({ wdh: { art: "tage", tage: [] } })] }), "rtest00001", 0);
eq(leer.includes("RRULE") || leer.includes("BYDAY="), false, "tage ohne Wochentage: keine RRULE");
eq(leer.split("\r\n").includes("DTSTART:20261004T200000"), true, "tage ohne Wochentage: DTSTART ist der Start");
const s = k.ics(g({}, { reihen: [reihe({ ausnahmen: { "2026-10-11": { aus: true }, "2026-10-18": { zeit: "19:30" } } })] }), "rtest00001", Date.UTC(2026, 9, 6, 8, 0));
eq(s.startsWith("BEGIN:VCALENDAR\r\n") && s.endsWith("END:VCALENDAR\r\n"), true, "Rahmen mit CRLF");
for (const zeile of ["DTSTART:20261004T200000", "DTEND:20261004T220000", "RRULE:FREQ=WEEKLY;BYDAY=SU", "EXDATE:20261011T200000",
  "UID:rtest00001@borometer.local", "DTSTAMP:20261006T080000Z", "X-WR-TIMEZONE:Europe/Berlin", "SUMMARY:Raid", "RECURRENCE-ID:20261018T200000", "DTSTART:20261018T193000"]) {
  eq(s.split("\r\n").includes(zeile), true, ".ics enthaelt " + zeile);
}
eq(k.ics(g({}, { reihen: [reihe({ wdh: { art: "tage", tage: [3, 0], bis: "2026-12-31" } })] }), "rtest00001", 0).includes("RRULE:FREQ=WEEKLY;BYDAY=SU,WE;UNTIL=20261231T235959"), true, "selbst gewaehlte Tage und Ende");
eq(k.ics(g({}, { reihen: [reihe({ wdh: { art: "einmal", tage: [] } })] }), "rtest00001", 0).includes("RRULE"), false, "einmalig ohne RRULE");
eq(k.ics(g({}, { reihen: [reihe({ titel: "A,B;C\\D" })] }), "rtest00001", 0).includes("SUMMARY:A\\,B\\;C\\\\D"), true, "Text wird nach RFC 5545 maskiert");

// --- .ics mit mehreren Reihen (Entscheidung 07.10.2026: "Alle Reihen" gibt eine Datei)
const mitAusnahmen = reihe({ ausnahmen: { "2026-10-11": { aus: true }, "2026-10-18": { zeit: "19:30" } } });
const lang = { id: "rtest00002", titel: "Training " + "x".repeat(80), start: "2026-10-07T19:00", zone: "Europe/Berlin",
  wdh: { art: "tage", tage: [3, 5] }, dauerMin: 60, erinnerungMin: 10, ausnahmen: {} };
const weg = { ...lang, id: "rtest00003", titel: "Geloest", geloest: true };
const ga = g({}, { reihen: [mitAusnahmen, lang, weg] });
const alle = k.icsAlle(ga, ["rtest00001", "rtest00002", "rtest00003"], Date.UTC(2026, 9, 6, 8, 0));
const az = alle.split("\r\n");
const zaehl = (x) => az.filter((z) => z === x).length;
eq([zaehl("BEGIN:VCALENDAR"), zaehl("END:VCALENDAR"), zaehl("VERSION:2.0"), zaehl("PRODID:-//Borometer//Gilde//DE"), zaehl("CALSCALE:GREGORIAN"),
  az.filter((z) => z.startsWith("X-WR-TIMEZONE:")).length], [1, 1, 1, 1, 1, 1], "mehrere Reihen: ein Kalender, der Kopf steht einmal");
eq(alle.startsWith("BEGIN:VCALENDAR\r\n") && alle.endsWith("END:VCALENDAR\r\n") && !/[\r\n]/.test(alle.replace(/\r\n/g, "")), true, "mehrere Reihen: CRLF wie bei einer");
eq([...new Set(az.filter((z) => z.startsWith("UID:")))], ["UID:rtest00001@borometer.local", "UID:rtest00002@borometer.local"], "mehrere Reihen: zwei UIDs, die geloeste fehlt");
eq(["RRULE:FREQ=WEEKLY;BYDAY=SU", "RRULE:FREQ=WEEKLY;BYDAY=WE,FR"].every((x) => az.includes(x)), true, "mehrere Reihen: beide RRULEs");
eq(["EXDATE:20261011T200000", "RECURRENCE-ID:20261018T200000", "TRIGGER:-PT15M", "TRIGGER:-PT10M"].every((x) => az.includes(x)), true,
  "mehrere Reihen: Ausfall, Verschiebung und Erinnerung je Reihe");
eq(zaehl("BEGIN:VEVENT") === zaehl("END:VEVENT") && zaehl("BEGIN:VEVENT") === 3, true, "mehrere Reihen: drei Ereignisse (zwei Reihen, eine Verschiebung)");
eq(az.every((z) => z.length <= 75) && az.some((z) => z.startsWith(" ")), true, "mehrere Reihen: lange Zeilen gefaltet wie bei einer");
eq(k.icsAlle(ga, ["rtest00001"], Date.UTC(2026, 9, 6, 8, 0)), k.ics(ga, "rtest00001", Date.UTC(2026, 9, 6, 8, 0)), "eine Reihe: icsAlle gibt dasselbe wie ics");
eq(k.icsAlle(ga, ["rtest00003"], 0).split("\r\n").includes("BEGIN:VEVENT"), false, "nur geloeste: ein leerer Kalender");

if (failed) { console.log("\n" + failed + " Probe(n) fehlgeschlagen."); process.exit(1); }
console.log("\nAlle Proben bestanden.");
