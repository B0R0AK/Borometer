// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Kern von "Gilde online" (src/renderer/gilde-online-core.ts, Spezifikation
// docs/superpowers/specs/2026-10-12-gilde-online-design.md, 2 und 5), ohne Seite
// und ohne Netz: Einladung lesen und bauen (nie eine Adresse darin), die Adresse
// des Servers pruefen (nur https), Rechte je Rolle, was auf eine Antwort folgt,
// und die Regel "es darf nichts fehlen" gegen den Stand vom Server.
// Namen sind erfunden.
//
// Run:  npm run test:gilde-online-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const b = await esbuild.build({ entryPoints: [join(root, "src", "renderer", "gilde-online-core.ts")],
  bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
const k = await import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));

let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), c = JSON.stringify(want);
  if (a === c) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        bekommen " + a + "\n        erwartet " + c); }
}

const CODE = "ABCDEFGHJKLM", KEY = "ABCDEFGHJKLMNPQRSTUVWXYZ23";

// --- Einladung
eq(k.parseEinladung("boro-gilde:" + CODE), { code: CODE }, "Einladung nur mit Code");
eq(k.parseEinladung("  boro-gilde:" + CODE + ":" + KEY + "\n"), { code: CODE, key: KEY }, "Einladung mit Schluessel, Leerraum ringsum");
eq(k.parseEinladung("boro-gilde:abcd-efgh-jklm"), { code: CODE }, "klein und mit Strichen geschrieben");
eq(k.parseEinladung(CODE), { code: CODE }, "der blanke Code geht auch");
eq(k.parseEinladung("boro-gilde:" + CODE + "@evil.example"), null, "eine Adresse im Link: abgelehnt");
eq(k.parseEinladung("https://evil.example/boro-gilde:" + CODE), null, "ein Link mit Adresse: abgelehnt");
eq(k.parseEinladung("boro-gilde:" + CODE + ":" + KEY + ":mehr"), null, "ein Teil zu viel: abgelehnt");
eq(k.parseEinladung("boro-gilde:ABC"), null, "zu kurzer Code: abgelehnt");
eq(k.parseEinladung("boro-gilde:" + CODE.replace("A", "0")), null, "Zeichen ausserhalb des Alphabets: abgelehnt");
eq(k.parseEinladung(""), null, "leer: abgelehnt");
eq(k.bauEinladung(CODE), "boro-gilde:" + CODE, "Einladung bauen ohne Schluessel");
eq(k.bauEinladung(CODE, KEY), "boro-gilde:" + CODE + ":" + KEY, "Einladung bauen mit Schluessel");
eq(k.parseEinladung(k.bauEinladung(CODE, KEY)), { code: CODE, key: KEY }, "bauen und lesen sind eins");
eq(k.anzeigeCode(CODE), "ABCD-EFGH-JKLM", "der Code in Vierergruppen");

// --- Adresse: nur https
eq(k.pruefeAdresse("https://gilde.example.org"), { ok: true, adresse: "https://gilde.example.org" }, "https mit Name");
eq(k.pruefeAdresse(" https://gilde.example.org/ "), { ok: true, adresse: "https://gilde.example.org" }, "Leerraum und Schraegstrich fallen weg");
eq(k.pruefeAdresse("https://gilde.example.org:8443"), { ok: true, adresse: "https://gilde.example.org:8443" }, "mit Port");
eq(k.pruefeAdresse("http://gilde.example.org"), { ok: false, grund: "kein-https" }, "http: abgelehnt");
eq(k.pruefeAdresse("gilde.example.org"), { ok: false, grund: "kein-https" }, "ohne Schema: abgelehnt");
eq(k.pruefeAdresse("http://localhost:8732"), { ok: false, grund: "kein-https" }, "auch localhost mit http: abgelehnt");
eq(k.pruefeAdresse(""), { ok: false, grund: "leer" }, "leer");
eq(k.pruefeAdresse("https://u:p@gilde.example.org"), { ok: false, grund: "ungueltig" }, "mit Zugangsdaten: abgelehnt");
eq(k.pruefeAdresse("https://gilde.example.org/pfad"), { ok: false, grund: "ungueltig" }, "mit Pfad: abgelehnt");
eq(k.pruefeAdresse("https://gilde.example.org?x=1"), { ok: false, grund: "ungueltig" }, "mit Abfrage: abgelehnt");
eq(k.pruefeAdresse("ftp://gilde.example.org"), { ok: false, grund: "kein-https" }, "anderes Schema: abgelehnt");
eq(k.pruefeAdresse("https://"), { ok: false, grund: "ungueltig" }, "ohne Rechner: abgelehnt");

// --- Rechte
const aktionen = ["lesen", "schreiben", "links", "staende", "zurueck", "marke", "schliessen"];
eq(aktionen.filter((a) => k.darf("lesen", a)), ["lesen"], "Mitglied darf nur lesen");
eq(aktionen.filter((a) => k.darf("bearbeiter", a)), ["lesen", "schreiben"], "Bearbeiter liest und schreibt, sonst nichts");
eq(aktionen.filter((a) => k.darf("lead", a)), aktionen, "Lead darf alles");

// --- was auf eine Antwort folgt
eq(k.naechsterSchritt({ status: 200, v: 3 }), "ok", "200: ok");
eq(k.naechsterSchritt({ status: 409, v: 3 }), "neu-laden", "409: neu laden, nichts ueberschreiben");
eq(k.naechsterSchritt({ status: 403 }), "abgelehnt", "403: abgelehnt");
eq(k.naechsterSchritt({ status: 429 }), "spaeter", "429: spaeter");
eq(k.naechsterSchritt({ status: 404 }), "abgelehnt", "404: abgelehnt");
eq(k.naechsterSchritt({ status: 0 }), "offline", "keine Antwort: offline");
eq(k.naechsterSchritt({ status: 410 }), "beendet", "410: der Lead hat die Gilde beendet");

// --- nichts fehlt (gegen den Stand vom Server)
const g = () => ({
  id: "g000000001", name: "Testgilde",
  mitglieder: [{ id: "m000000001", name: "Testperson A", rolle: "dps", waffen: [], notiz: "" }, { id: "m000000002", name: "Testperson B", rolle: "tank", waffen: [], notiz: "" }],
  reihen: [{ id: "r000000001", titel: "Raid", start: "2026-10-04T20:00", zone: "Europe/Berlin", wdh: { art: "woche", tage: [] }, dauerMin: 120, erinnerungMin: 15, ausnahmen: { "2026-10-11": { aus: true } } }],
  anwesend: { "r000000001|2026-10-04": { m000000001: "da", m000000002: "fehlt" } },
});
const ok = (a, b) => k.pruefeSchreiben(a, b).ok;
eq(ok(g(), g()), true, "gleicher Stand: ok");
{ const n = g(); n.mitglieder[0].name = "Testperson C"; eq(ok(g(), n), true, "ein Name darf sich aendern"); }
{ const n = g(); n.mitglieder[0].geloest = true; eq(ok(g(), n), true, "loesen statt loeschen: ok"); }
{ const n = g(); n.mitglieder.push({ id: "m000000003", name: "Testperson C", rolle: "heal", waffen: [], notiz: "" }); eq(ok(g(), n), true, "ein neues Mitglied: ok"); }
{ const n = g(); n.mitglieder.pop(); eq(k.pruefeSchreiben(g(), n), { ok: false, fehlt: "mitglied" }, "ein Mitglied fehlt: abgelehnt"); }
{ const n = g(); n.reihen = []; eq(k.pruefeSchreiben(g(), n), { ok: false, fehlt: "reihe" }, "eine Reihe fehlt: abgelehnt"); }
{ const n = g(); delete n.anwesend["r000000001|2026-10-04"].m000000002; eq(k.pruefeSchreiben(g(), n), { ok: false, fehlt: "marke" }, "eine Marke fehlt: abgelehnt"); }
{ const n = g(); n.anwesend["r000000001|2026-10-04"].m000000002 = "offen"; eq(ok(g(), n), true, "eine Marke zurueck auf offen: ok"); }
{ const n = g(); n.reihen[0].ausnahmen = {}; eq(k.pruefeSchreiben(g(), n), { ok: false, fehlt: "ausnahme" }, "eine Ausnahme fehlt: abgelehnt"); }
{ const a = g(); a.punkte = { an: true, rang: false, gruppen: false, schwellen: [1, 2], monat: 1, teiler: 1, stichtag: "2026-10-01", arten: [{ id: "a000000001", name: "Boss", punkte: 1, proPunkt: 1 }] };
  const n = JSON.parse(JSON.stringify(a)); n.punkte.arten = []; eq(k.pruefeSchreiben(a, n), { ok: false, fehlt: "art" }, "eine Art der Punkte fehlt: abgelehnt"); }
{ const a = g(); a.mitglieder[0].punkte = { seit: "2026-09-01", pausen: [{ von: "2026-09-02" }], start: {}, ansehen: { start: 0, eintraege: [{ datum: "2026-09-03", betrag: 5 }] }, zusatz: [{ punkte: 1, notiz: "x" }] };
  const n = JSON.parse(JSON.stringify(a)); n.mitglieder[0].punkte.ansehen.eintraege = [];
  eq(k.pruefeSchreiben(a, n), { ok: false, fehlt: "eintrag" }, "ein Eintrag der Punkte fehlt: abgelehnt");
  const p = JSON.parse(JSON.stringify(a)); p.mitglieder[0].punkte.pausen = [];
  eq(k.pruefeSchreiben(a, p), { ok: false, fehlt: "pause" }, "eine Pause fehlt: abgelehnt");
  const z = JSON.parse(JSON.stringify(a)); z.mitglieder[0].punkte.zusatz = [];
  eq(k.pruefeSchreiben(a, z), { ok: false, fehlt: "zusatz" }, "ein Zusatz fehlt: abgelehnt"); }

if (failed) { console.log(`\n${failed} fehlgeschlagen`); process.exit(1); }
console.log("\nalles gruen");
