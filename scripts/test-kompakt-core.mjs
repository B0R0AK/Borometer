// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Kern des Streifens ohne Seite (src/renderer/kompakt-core.ts,
// Spezifikation docs/superpowers/specs/2026-10-04-kompakt-fenster-design.md,
// Abschnitte 2, 3 und 8a): ob ein Kampf laeuft, wann er zuletzt wuchs, die
// Durchsicht im Durchklick und die Restzeile. Nur Zahlen und erfundene
// Schluessel, keine Namen aus Logs.
//
// Run:  npm run test:kompakt-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = await esbuild.build({
  stdin: {
    contents: 'export * from "./kompakt-core"; export { I18N } from "./app/07-dictionary";',
    resolveDir: join(root, "src", "renderer"), loader: "ts",
  },
  bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent",
  plugins: [bilderPlugin(root, bilderModus(root))],
});
const core = await import("data:text/javascript;base64," +
  Buffer.from(built.outputFiles[0].text).toString("base64"));

let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        got  " + a + "\n        want " + b); }
}

// --- 1. kampfZustand (Spezifikation 3.1)
{
  const z = (o) => core.kampfZustand({ live: true, neuester: true, seitWachstumMs: 1000, trennS: 8, ...o });
  eq(z({}), "kampf", "Live, neuester Kampf, vor 1 s gewachsen: kampf");
  eq(z({ live: false }), "nach", "ohne Live: nach");
  eq(z({ neuester: false }), "nach", "ein aelterer Kampf gewaehlt: nach");
  eq(z({ seitWachstumMs: 7999 }), "kampf", "knapp unter der Trennung: kampf");
  eq(z({ seitWachstumMs: 8000 }), "nach", "genau an der Trennung: nach");
  eq(z({ seitWachstumMs: Infinity }), "nach", "nie gewachsen (Infinity): nach");
  eq(z({ seitWachstumMs: NaN }), "nach", "NaN: nach");
  eq(z({ seitWachstumMs: -5 }), "nach", "negativ (Uhr zurueckgestellt): nach");
  eq(z({ trennS: 0 }), "nach", "Trennung 0: nach");
  eq(z({ trennS: NaN }), "nach", "Trennung NaN: nach");
}

// --- 2. wachstum (Spezifikation 3.1)
{
  const a = { key: "1000|X", ende: 5000 };
  eq(core.wachstum(null, a, null, 42), null, "erstes Laden: kein Wachstum");
  eq(core.wachstum(a, { key: "1000|X", ende: 5500 }, null, 42), 42, "laengerer Kampf: jetzt");
  eq(core.wachstum(a, { key: "9000|Y", ende: 9000 }, 7, 42), 42, "neuer Kampf: jetzt");
  eq(core.wachstum(a, { ...a }, 7, 42), 7, "gleicher Stand: der alte Zeitpunkt");
  eq(core.wachstum(a, null, 7, 42), null, "kein Kampf mehr: null");
  eq(core.wachstum(null, a, null, 42, true), 42, "nach dem ersten Takt: der erste Kampf eines frischen Logs ist Wachstum");
  eq(core.wachstum(null, a, null, 42, false), null, "im ersten Takt bleibt es beim Merken, auch mit ausdruecklichem false");
  eq(core.wachstum(null, null, 7, 42, true), null, "kein Kampf: null, auch nach dem ersten Takt");
}

// --- 3. durchsichtWirksam (Spezifikation 2)
{
  eq(core.DURCHKLICK_SICHT, 40, "die Durchsicht im Durchklick ist 40");
  eq(core.durchsichtWirksam(0, true), 40, "Regler 0, Durchklick: 40");
  eq(core.durchsichtWirksam(50, true), 50, "Regler 50, Durchklick: 50");
  eq(core.durchsichtWirksam(10, false), 10, "ohne Durchklick: der Regler");
  // Kompakt Wuensche (#328): die Toenung auf Acrylic ist .50 bis .10 (die Kontur der Schrift traegt die Lesbarkeit)
  eq(core.toenung(0), 0.5, "Toenung bei Regler 0: .500");
  eq(core.toenung(55), 0.1, "Toenung am Anschlag 55: .100");
  eq(core.toenung(core.durchsichtWirksam(0, true)), 0.209, "Toenung im Durchklick (40): .209");
  eq(core.toenung(27.5), 0.3, "Toenung bei Regler 27,5: .300");
  eq([core.toenung(-5), core.toenung(99), core.toenung(NaN)], [0.5, 0.1, 0.5], "ausserhalb und ungueltig: an den Anschlaegen, NaN wie 0");
  // #348: auf Acrylic blendet das ganze Fenster mit der Durchsicht ab, bis DECKUNG_MIN
  eq([core.fensterDeckung(0), core.fensterDeckung(55), core.fensterDeckung(27.5), core.fensterDeckung(40)], [1, 0.7, 0.85, 0.782], "Fensterdeckung: 1 bei Regler 0, .70 am Anschlag 55, dazwischen linear");
  eq([core.fensterDeckung(-5), core.fensterDeckung(99), core.fensterDeckung(NaN)], [1, 0.7, 1], "Fensterdeckung ausserhalb und ungueltig: an den Anschlaegen, NaN wie 0");
}

// --- 4. restZeile (Spezifikation 8a)
{
  eq(core.restZeile([50, 30, 20], []), null, "nichts unter der Kante: keine Restzeile");
  eq(core.restZeile([60, 20, 10, 6, 4], [6, 4]), { n: 2, anteil: 0.1, schaden: 10 }, "zwei unten, 10 % des Schadens");
  eq(core.restZeile([0, 0], [0]), { n: 1, anteil: 0, schaden: 0 }, "ohne Schaden: Anteil 0, kein NaN");
}

// --- 4b. restUnten (#328): was beim Rollen noch unter der letzten ganzen Zeile liegt
{
  const s = [60, 20, 10, 6, 4];
  eq(core.restUnten(s, 0, 3), { n: 2, anteil: 0.1, schaden: 10 }, "oben: zwei Zeilen unter drei sichtbaren, 10 %");
  eq(core.restUnten(s, 1, 3), { n: 1, anteil: 0.04, schaden: 4 }, "eine Zeile weiter: eine Zeile unten");
  eq(core.restUnten(s, 2, 3), null, "am Ende: nichts darunter");
  eq(core.restUnten(s, 4, 3), null, "ueber das Ende hinaus: nichts darunter");
  eq(core.restUnten(s, 0, 9), null, "alle sichtbar: nichts darunter");
  eq(core.restUnten([], 0, 5), null, "keine Zeilen: nichts");
  eq(core.restUnten(s, -2, 3), { n: 2, anteil: 0.1, schaden: 10 }, "negativer Anfang gilt als 0");
  eq(core.restUnten(s, NaN, 3), { n: 2, anteil: 0.1, schaden: 10 }, "NaN als Anfang gilt als 0");
  eq(core.restUnten([0, 0, 0], 0, 1), { n: 2, anteil: 0, schaden: 0 }, "ohne Schaden: Anteil 0, kein NaN");
  eq([core.KN_SICHT, core.KN_ALLE_BIS], [5, 6], "fuenf Zeilen sichtbar, bis sechs stehen alle");
}

// --- 5. Woerterbuch: die Texte des Streifens in beiden Sprachen (CLAUDE.md)
{
  const { I18N } = core;
  const SCHL = ["compact.imKampf", "compact.rest", "compact.restEnde", "compact.listeName", "compact.listeNameGruppe", "compact.liveTitle"];
  const probe = { n: 9, p: "12\u00a0%", datei: "TLCombatLog-1.txt", a: 1, b: 5 };
  const text = (l, k) => { const v = I18N[l][k]; return typeof v === "function" ? v(probe) : v; };
  const leer = ["de", "en"].flatMap((l) => SCHL.filter((k) => { const s = text(l, k); return typeof s !== "string" || !s || /undefined|NaN/.test(s); })
    .map((k) => l + ":" + k));
  eq(leer, [], "jeder Text in DE und EN da und ohne Luecke");
  eq(text("de", "compact.imKampf"), "Kampf läuft", "DE: Kampf laeuft");
  eq(text("en", "compact.imKampf"), "Fight in progress", "EN: Fight in progress");
  eq(text("de", "compact.rest"), "+9 weitere \u00b7 12\u00a0%", "DE: Restzeile");
  eq(text("en", "compact.rest"), "+9 more \u00b7 12\u00a0%", "EN: Restzeile");
  eq(text("de", "compact.restEnde"), "Ende", "DE: Ende der Liste");
  eq(text("en", "compact.restEnde"), "End", "EN: Ende der Liste");
  eq(text("de", "compact.listeName"), "Fähigkeiten, Zeile 1 bis 5 von 9", "DE: Name der Liste");
  eq(text("en", "compact.listeName"), "Skills, rows 1 to 5 of 9", "EN: Name der Liste");
  eq(text("de", "compact.listeNameGruppe"), "Mitglieder, Zeile 1 bis 5 von 9", "DE: Name der Liste in der Gruppe");
  eq(text("en", "compact.listeNameGruppe"), "Members, rows 1 to 5 of 9", "EN: Name der Liste in der Gruppe");
}

// --- 9. Die Leiste (Spezifikation Kompakt neu, 14.10.2026, Abschnitte 2 bis 4)
{
  // Zeilen und Rest (Spezifikation Kompakt neu, Panel, 2 und 3): fuenf Traeger, dann "+N weitere"; sechs stehen ganz da
  eq(core.zeilenSicht(0, false), { zeigen: 0, rest: 0 }, "kein Traeger: nichts");
  eq(core.zeilenSicht(5, false), { zeigen: 5, rest: 0 }, "5 Traeger: alle, kein Rest");
  eq(core.zeilenSicht(6, false), { zeigen: 6, rest: 0 }, "6 Traeger: alle (ein Knopf fuer eine Zeile spart nichts)");
  eq(core.zeilenSicht(7, false), { zeigen: 5, rest: 2 }, "7 Traeger: 5 und +2");
  eq(core.zeilenSicht(11, false), { zeigen: 5, rest: 6 }, "11 Traeger: 5 und +6 (der Fall aus #287)");
  eq(core.zeilenSicht(11, true), { zeigen: 11, rest: 0 }, "aufgeklappt: alle, kein Rest");
  eq(core.zeilenSicht(3, true), { zeigen: 3, rest: 0 }, "aufgeklappt mit wenigen: alle");
  eq(core.zeilenSicht(11, false, 4), { zeigen: 4, rest: 7 }, "andere Grundzahl (Weeklies: vier)");
  eq(core.zeilenSicht(5, false, 4), { zeigen: 5, rest: 0 }, "Grundzahl 4, fuenf Punkte: alle (eine Zeile mehr ist kein Knopf wert)");
  eq(core.zeilenSicht(NaN, false), { zeigen: 0, rest: 0 }, "NaN: nichts");
  eq(core.zeilenSicht(-3, true), { zeigen: 0, rest: 0 }, "negativ: nichts");
  eq(core.zeilenSicht(9.7, false), { zeigen: 5, rest: 4 }, "gebrochene Zahl wird abgerundet");
  // Wechsel der Ansicht
  eq(core.ansichtWechsel("kampf"), "weeklies", "Kampf wechselt zu Weeklies");
  eq(core.ansichtWechsel("weeklies"), "kampf", "Weeklies wechselt zu Kampf");
  eq(core.ansichtWechsel("quatsch"), "kampf", "Unbekanntes wird Kampf");
  // offene Punkte: erledigte weg, taegliche zuerst, sonst die Folge bleibt
  const p = (k, takt, stand, menge) => ({ k, takt, stand, menge });
  const alle = [p("a", "woche", 0, 1), p("b", "tag", 0, 1), p("c", "woche", 3, 3), p("d", "woche", 1, 3), p("e", "tag", 1, 1), p("f", "monat", 0, 2), p("g", "tag", 0, 1)];
  eq(core.offenePunkte(alle).map((x) => x.k), ["b", "g", "a", "d", "f"], "offene Punkte: taegliche zuerst, Folge bleibt, Erledigtes weg");
  eq(core.offenePunkte([]).map((x) => x.k), [], "keine Punkte: leer");
  eq(core.offenePunkte([p("x", "woche", 5, 3)]).map((x) => x.k), [], "mehr als die Menge gilt als erledigt");
  // Erinnerung faellig: aktiv, heutiger Wochentag, Uhrzeit erreicht, etwas offen, seitdem nicht gesehen
  const mo = (h, m) => new Date(2026, 9, 12, h, m);   // Montag 12.10.2026, lokale Zeit
  const er = (o) => ({ an: true, tage: [1], zeit: "18:00", ...o });
  eq(core.erinnerungFaellig([er()], 3, mo(18, 0), null), true, "Montag 18:00, offen, nie gesehen: faellig");
  eq(core.erinnerungFaellig([er()], 3, mo(17, 59), null), false, "eine Minute vorher: nicht faellig");
  eq(core.erinnerungFaellig([er({ tage: [2] })], 3, mo(19, 0), null), false, "anderer Wochentag: nicht faellig");
  eq(core.erinnerungFaellig([er({ an: false })], 3, mo(19, 0), null), false, "ausgeschaltet: nicht faellig");
  eq(core.erinnerungFaellig([er({ geloest: true })], 3, mo(19, 0), null), false, "geloest: nicht faellig");
  eq(core.erinnerungFaellig([er()], 0, mo(19, 0), null), false, "nichts offen: nicht faellig");
  eq(core.erinnerungFaellig([er()], 3, mo(19, 0), mo(18, 30).getTime()), false, "nach der Zeit gesehen: nicht faellig");
  eq(core.erinnerungFaellig([er()], 3, mo(19, 0), mo(17, 0).getTime()), true, "vor der Zeit gesehen: faellig");
  eq(core.erinnerungFaellig([er({ zeit: "kaputt" })], 3, mo(19, 0), null), false, "ungueltige Uhrzeit: nicht faellig");
  eq(core.erinnerungFaellig([], 3, mo(19, 0), null), false, "keine Erinnerung: nicht faellig");
  eq(core.erinnerungFaellig([er({ zeit: "20:00" }), er({ zeit: "18:00" })], 1, mo(18, 30), null), true, "eine von zwei reicht");
  // die Texte
  const SCHL = ["compact.restKurz", "compact.tabK", "compact.tabW", "compact.tabs", "compact.tabWErinnerung", "compact.wkOffen", "compact.wkErledigt", "compact.wkReset", "compact.wkAlles",
    "compact.wkPunkt", "compact.wkErledigtAnsage", "compact.wkWahl", "compact.wkOeffnen", "compact.wkDurchklick", "compact.zeileName", "compact.gruppeAuf", "compact.gruppeZu", "compact.ansageK", "compact.ansageW"];
  const probe = { n: 2, m: 3, g: 36, name: "Zitadelle", in: "14 Std", anteil: "91,1 %", dps: "425.2k", schaden: "14.2M" };
  const text = (l, k) => { const v = core.I18N[l][k]; return typeof v === "function" ? v(probe) : v; };
  const leer = ["de", "en"].flatMap((l) => SCHL.filter((k) => { const s = text(l, k); return typeof s !== "string" || !s || /undefined|NaN/.test(s); }).map((k) => l + ":" + k));
  eq(leer, [], "jeder neue Text in DE und EN da und ohne Luecke");
  eq(text("de", "compact.tabK"), "Kampf", "DE: Reiter Kampf");
  eq(text("en", "compact.tabK"), "Fight", "EN: Reiter Fight");
  eq(text("de", "compact.wkErledigt"), "2 von 36 erledigt", "DE: erledigt von gesamt");
  eq(text("en", "compact.wkErledigt"), "2 of 36 done", "EN: done of total");
}

console.log();
if (failed) { console.log(`KOMPAKT CORE FAILED - ${failed}`); process.exit(1); }
console.log("KOMPAKT CORE PASSED");
