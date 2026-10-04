// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die Rekorde (src/renderer/rekorde-core.ts, Spezifikation Rekorde 2a und 3),
// ohne Seite: esbuild buendelt die eine Datei, Node fuehrt sie aus. Die Kaempfe
// hier sind erfunden - nur Bossnamen, Zahlen und Faehigkeiten, keine Spieler.
// Dazu eine Probe gegen die echte Boss- und Dungeon-Tabelle der App
// (06-blocks-and-places.ts), damit das Album mit ihr waechst.
//
// Run:  npm run test:rekorde-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/* Die Seitenteile lesen beim Laden location und document: fuer die Probe
   gegen die echte Tabelle stehen dieselben Platzhalter da wie in
   scripts/fenster-mess.mjs, eine Datei-Adresse wie im Browser ohne App. */
const ATTRAPPE = `const el = () => ({ style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  dataset: {}, addEventListener() {}, setAttribute() {}, getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [] });
globalThis.location ??= { protocol: "file:", search: "", hash: "" };
globalThis.document ??= { querySelector: () => el(), querySelectorAll: () => [], body: el(), documentElement: el(), addEventListener() {} };
globalThis.getComputedStyle ??= () => ({ getPropertyValue: () => "" });
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} });`;
async function bundle(contents, platform = "neutral") {
  const b = await esbuild.build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, format: "esm",
    platform, write: false, logLevel: "silent", define: { __BORO_VERSION__: '"test"' }, plugins: [bilderPlugin(root, bilderModus(root))],
    banner: { js: platform === "node" ? ATTRAPPE : "" } });
  return import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));
}
const core = await bundle('export * from "./src/renderer/rekorde-core";');

let failed = 0;
function ok(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "\n        " + JSON.stringify(detail).slice(0, 600))); }
}
const eq = (got, want, name) => ok(JSON.stringify(got) === JSON.stringify(want), name, { got, want });

/* Eine kleine Tabelle in der Form von 06-blocks-and-places.ts: ein Raid in
   drei Teilen, Dungeons mit Sternen, Stufe und Solo, offene Bosse aller
   drei Arten. */
const ALTAR = { en: "Altar of Calanthia", de: "Altar von Calanthia" };
const DUNGEONS = [
  { stars: 4, en: "Frostbreath Cave", de: "Frostatemhöhle", boss: ["Vulcanus"] },
  { stars: 4, en: "Stone Grave Cradle", de: "Steingrab-Wiege", boss: ["Fellinex"], phases: { Fellinex: ["Fellini"] } },
  { stars: 3, en: "Fate's Abyss", de: "Abgrund des Schicksals", boss: ["Lucien"] },
  { stars: 2, en: "Chapel of Madness", de: "Kapelle des Wahnsinns", boss: ["Grayeye", "Grauauge"] },
  { stars: 1, en: "Cave of Destruction", de: "Höhle der Zerstörung", boss: ["Lequirus"] },
  { lvl: 20, en: "Specter's Abyss", de: "Gespenster Abgrund", boss: ["Heliber"] },
  { solo: true, en: "Tumgir Hollow", de: "Tumgir Kessel",
    boss: ["Silent Gatekeeper Vahelon", "Stiller Torwächter Vahelon", "Quente, Executor of the Seal", "Quente, Vollstrecker des Siegels"],
    bosses: [["Silent Gatekeeper Vahelon", "Stiller Torwächter Vahelon"], ["Quente, Executor of the Seal", "Quente, Vollstrecker des Siegels"]] },
  { of: ALTAR, en: "The Forgotten Citadel", de: "Die vergessene Zitadelle", boss: ["Dragaryle"] },
  { of: ALTAR, en: "The Corridor of Anguish", de: "Der Korridor der Pein", boss: ["Zairos", "Vulkan", "Radeth"], bosses: [["Zairos"], ["Vulkan"], ["Radeth"]] },
  { of: ALTAR, en: "The Altar of Rebirth", de: "Der Altar der Wiedergeburt", boss: ["Calanthia"],
    phases: { Calanthia: ["Calanthia of Destruction", "Calanthia der Zerstörung"] },
    forms: { Calanthia: ["Calanthia of Destruction", "Calanthia der Zerstörung"] } },
];
const OFFEN = [
  { kind: "field", de: "Morokai", en: "Morokai", names: ["Morokai"] },
  { kind: "field", de: "Talus", en: "Tallus", names: ["Talus", "Tallus"] },
  { kind: "field", de: "Minezerok", en: "Minezerok", names: ["Minezerok", "Minezrok"] },
  { kind: "field", de: "Aridus", en: "Aridus", names: ["Aridus"] },
  { kind: "field", de: "Manticus", en: "Manticus", names: ["Akman", "Deckman", "Manticus"] },
  { kind: "arch", de: "Sintflutbringerin", en: "Deluzhnoa", names: ["Deluzhnoa", "Sintflutbringerin"] },
  { kind: "koloss", de: "Vegamor", en: "Vegamor", names: ["Vegamor", "Vegarus", "Vegarion", "Vegaorb", "Vegamor's Claw", "Vagamont"], forms: ["Vagamont"] },
];

// ---------------------------------------------------------------- die Tafel
const T = core.albumTafel(DUNGEONS, OFFEN);
eq(T.map((s) => s.id), ["raid", "puppe", "feld", "dungeon"], "vier Seiten: Raid, Uebungspuppe, Feldbosse, Dungeons");
const orte = (s) => s.gruppen.flatMap((g) => g.orte);
const raid = T[0];
eq(orte(raid).map((o) => o.de), ["Dragaryle", "Zairos \u00b7 Vulkan", "Radeth", "Calanthia"],
  "Raid: Zairos und Vulkan sind ein Medaillon, Radeth ein eigenes, in der Reihenfolge der Tabelle");
eq([raid.unter.de, raid.unter.en], [ALTAR.de, ALTAR.en], "der Kopf der Raid-Seite nennt den Altar");
eq(orte(raid).map((o) => o.unter && o.unter.de), ["Die vergessene Zitadelle", "Der Korridor der Pein", "Der Korridor der Pein", "Der Altar der Wiedergeburt"],
  "jeder Raid-Teil nennt seinen Fluegel");
eq(orte(T[1]).map((o) => o.klasse), [60, 120, 180], "Uebungspuppe: drei Laengenklassen wie im Verlauf");
eq(T[2].gruppen.map((g) => [g.key, g.orte.map((o) => o.de)]),
  [[null, ["Morokai", "Talus", "Minezerok", "Aridus", "Manticus"]], ["erz", ["Sintflutbringerin"]], ["koloss", ["Vegamor"]]],
  "Feldbosse: offene Welt, dann Erzbosse, dann Kolosse");
eq(T[3].gruppen.map((g) => [g.key, g.orte.map((o) => o.en)]),
  [["s4", ["Vulcanus", "Fellinex"]], ["s3", ["Lucien"]], ["s2", ["Grayeye"]], ["s1", ["Lequirus", "Heliber"]],
   ["solo", ["Silent Gatekeeper Vahelon", "Quente, Executor of the Seal"]]],
  "Dungeons nach Sternen; ein Stern und die Einstiegsdungeons zusammen; Solo mit beiden Bossen");
const grau = orte(T[3]).find((o) => o.en === "Grayeye");
eq([grau.de, grau.en], ["Grauauge", "Grayeye"], "zwei Schreibweisen: die erste englisch, die zweite deutsch");
eq(orte(T[2]).find((o) => o.de === "Manticus").teile, ["Akman", "Deckman"], "Manticus: Akman und Deckman sind seine Teile");
eq(orte(T[2]).find((o) => o.de === "Vegamor").teile, ["Vegarus", "Vegarion", "Vegaorb", "Vegamor's Claw"], "Vegamor: vier Teile, die Form Vagamont ist keiner");
eq([orte(T[2]).find((o) => o.de === "Talus").teile, orte(T[2]).find((o) => o.de === "Minezerok").teile], [[], []],
  "eine zweite Schreibweise ist kein Teil");
const ids = T.flatMap(orte).map((o) => o.id);
ok(new Set(ids).size === ids.length, "jeder Platz hat eine eigene Kennung", ids);

// ---------------------------------------------------------------- die Rekorde
const TAG = 86400000, T0 = Date.UTC(2026, 8, 10, 20, 0, 0);   // 10.09.2026, Uhr des Logs
const k = (name, dps, tag, extra = {}) => ({ name, dps, dur: 120, at: T0 + tag * TAG + (extra.min || 0) * 60000, file: extra.file || "a.txt",
  ...(extra.c ? { c: extra.c } : {}), ...(extra.top != null ? { top: extra.top, topSid: extra.skill ?? "boro:ventius" } : {}) });
const platz = (a, de, klasse) => a.seiten.flatMap((s) => s.gruppen.flatMap((g) => g.plaetze)).find((p) => p.ort.de === de && (klasse == null || p.ort.klasse === klasse));

{
  const a = core.rekorde([
    k("Morokai", 100000, 0, { top: 300000 }), k("Morokai", 150000, 2, { top: 280000 }), k("Morokai", 120000, 4, { top: 320000, skill: "951234567" }),
  ], T, false);
  const w = platz(a, "Morokai").wert;
  eq([w.n, w.dps, w.vorher, w.plus, w.dpsAt], [3, 150000, 100000, 50, T0 + 2 * TAG], "bester DPS mit dem Wert davor und +50 %");
  eq([w.top, w.topSid, w.topAt], [320000, "951234567", T0 + 4 * TAG], "staerkster Treffer: immer die Faehigkeit des staerksten");
  eq([w.erster, w.zuletzt], [T0, T0 + 4 * TAG], "erster Kill und letzter Kampf");
}
{
  const a = core.rekorde([k("Morokai", 150000, 0, { top: 1 }), k("Morokai", 120000, 1, { top: 1 })], T, false);
  const w = platz(a, "Morokai").wert;
  eq([w.dps, w.vorher, w.plus, w.n], [150000, null, null, 2], "der beste ist der erste: kein vorher (der erste von N)");
  const e = core.rekorde([k("Morokai", 99000, 0)], T, false);
  eq([platz(e, "Morokai").wert.n, platz(e, "Morokai").wert.vorher], [1, null], "ein Kampf: kein vorher");
}
{
  // gleiche Werte: der fruehere zaehlt, beim DPS und beim Treffer
  const a = core.rekorde([k("Aridus", 200000, 0, { top: 500000, skill: "A" }), k("Aridus", 200000, 3, { top: 500000, skill: "B" })], T, false);
  const w = platz(a, "Aridus").wert;
  eq([w.dpsAt, w.vorher, w.topSid, w.topAt], [T0, null, "A", T0], "gleiche Werte: der fruehere zaehlt");
  eq(a.held.topSid, "A", "auch im Held: der fruehere bei gleichem Treffer");
}
{
  // Kolosse: ueber alle Teile, und der Treffer nennt den Teil
  const a = core.rekorde([
    k("Akman", 180000, 0, { top: 400000 }), k("Aufgestiegener Deckman", 210000, 1, { top: 700000 }),
    k("Vegarus", 90000, 2, { top: 200000 }), k("Vagamont", 95000, 2, { min: 5, top: 260000 }), k("Vegamor's Claw", 80000, 2, { min: 9, top: 250000 }),
  ], T, false);
  const m = platz(a, "Manticus").wert, v = platz(a, "Vegamor").wert;
  eq([m.n, m.dps, m.vorher, m.top, m.topTeil], [2, 210000, 180000, 700000, "Deckman"], "Manticus: ein Boss ueber beide Haelften, der Treffer nennt Deckman");
  eq([v.n, v.top, v.topTeil], [3, 260000, null], "Vegamor: drei Teile ein Boss; der Treffer an Vagamont (seiner Form) nennt keinen Teil");
  const v2 = core.rekorde([k("Vegarion", 90000, 2, { top: 300000 })], T, false);
  eq(platz(v2, "Vegamor").wert.topTeil, "Vegarion", "ein Treffer an Vegarion nennt Vegarion");
}
{
  // Zairos und Vulkan: ein Medaillon; ein Pull nur auf Vulkan ist sein Rest. Radeth bleibt fuer sich.
  const a = core.rekorde([k("Zairos \u00b7 Vulkan", 229000, 0, { top: 400000 }), k("Vulkan", 120000, 0, { min: 4 }), k("Radeth", 50000, 1)], T, false);
  eq([platz(a, "Zairos \u00b7 Vulkan").wert.n, platz(a, "Radeth").wert.n, platz(a, "Zairos \u00b7 Vulkan").wert.topTeil], [2, 1, null],
    "Zairos und Vulkan zaehlen zusammen, Radeth fuer sich");
  const c = core.rekorde([k("Calanthia of Destruction", 1, 0), k("Fellini", 1, 0), k("Calanthia", 2, 1)], T, false);
  eq([platz(c, "Calanthia").wert.n, platz(c, "Fellinex").wert.n], [2, 1], "eine Phase zaehlt bei ihrem Boss (wie im Verlauf)");
}
{
  // Uebungspuppe nach Laengenklassen
  const a = core.rekorde([k("Practice Dummy", 176000, 0, { c: 60 }), k("Übungspuppe", 224000, 1, { c: 60 }), k("Practice Dummy", 2171, 1, { c: 120 })], T, false);
  eq([platz(a, "Übungspuppe", 60).wert.n, platz(a, "Übungspuppe", 60).wert.plus, platz(a, "Übungspuppe", 120).wert.n, platz(a, "Übungspuppe", 180).wert],
    [2, 27, 1, null], "Uebungspuppe: je Laengenklasse eigene Rekorde, 180 s bleibt leer");
  eq(a.seiten[1].besiegt + "/" + a.seiten[1].gesamt, "2/3", "die Seite zaehlt 2 von 3");
}
{
  // fehlendes top: der Kampf zaehlt fuer DPS und Kill, der Treffer bleibt offen
  const a = core.rekorde([k("Morokai", 100000, 0), k("Morokai", 120000, 1)], T, false);
  const w = platz(a, "Morokai").wert;
  eq([w.dps, w.top, w.topSid, a.ohneTop, a.held], [120000, null, null, 2, null], "ohne top: DPS ja, Treffer noch nicht gelesen, kein Held");
  const b = core.rekorde([k("Morokai", 100000, 0, { top: 90000 }), k("Morokai", 120000, 1)], T, false);
  eq([platz(b, "Morokai").wert.top, b.ohneTop], [90000, 1], "ein Kampf mit top reicht fuer den Treffer");
  // eine Kennung ausserhalb des Musters speichert histRecord als "": der Treffer zaehlt trotzdem, ohne Faehigkeit
  const c = core.rekorde([k("Morokai", 100000, 0, { top: 70000, skill: "" })], T, false);
  eq([platz(c, "Morokai").wert.top, platz(c, "Morokai").wert.topSid, c.ohneTop, c.held?.top], [70000, "", 0, 70000], "top mit leerer Kennung: der Treffer zaehlt");
  // und ein Name statt Kennung (ein fremder Eintrag) ist kein gelesener Treffer
  const d = core.rekorde([{ name: "Morokai", dps: 1, at: T0, top: 5, topSkill: "Eye of Ventius" }], T, false);
  eq([platz(d, "Morokai").wert.top, d.ohneTop], [null, 1], "ein Eintrag mit Name statt Kennung zaehlt als ungelesen");
}
{
  // Namen: Rang und Zustand fallen ab, beide Client-Schreibweisen sind ein Platz (angezeigt wird der Name der Tabelle)
  const a = core.rekorde([k("Ascended Aridus [Undead]", 1, 0), k("Aufgestiegener Morokai", 1, 0), k("Grayeye", 1, 0), k("Grauauge", 2, 1), k("Unbekannt", 5, 0)], T, false);
  eq([platz(a, "Aridus").wert.n, platz(a, "Morokai").wert.n, platz(a, "Grauauge").wert.n], [1, 1, 2],
    "Rang und Zustand fallen ab; beide Schreibweisen sind ein Boss");
  eq([a.kaempfe, a.ohneOrt], [4, 1], "ein Ziel ausserhalb der Tabelle zaehlt nicht mit");
}
{
  // Seiten: N von M, erst die besiegten, dann die leeren
  const a = core.rekorde([k("Minezerok", 1, 0), k("Aridus", 1, 1)], T, false);
  const feld = a.seiten[2];
  eq([feld.besiegt, feld.gesamt], [2, 7], "Feldbosse: 2 von 7 besiegt");
  eq(feld.gruppen[0].plaetze.map((p) => p.ort.de + (p.wert ? "+" : "")), ["Minezerok+", "Aridus+", "Morokai", "Talus", "Manticus"],
    "in der Gruppe erst die besiegten, dann die leeren, je in Tabellenreihenfolge");
  eq(a.seiten.map((s) => s.besiegt + "/" + s.gesamt), ["0/4", "0/3", "2/7", "0/8"], "jede Seite zaehlt fuer sich");
}
{
  // erster Kill ehrlich: "ab" nur, wenn aeltere Logs ungelesen sind, und nur am Anfang des Zeitraums
  const l = [k("Morokai", 1, 0, { min: 30 }), k("Aridus", 1, 0, { min: 200 }), k("Talus", 1, 2), k("Morokai", 2, 3)];
  const mit = core.rekorde(l, T, true), ohne = core.rekorde(l, T, false);
  eq([platz(mit, "Morokai").wert.ab, platz(mit, "Aridus").wert.ab, platz(mit, "Talus").wert.ab], [true, true, false],
    "aeltere ungelesen: die Kills am ersten Tag des Zeitraums tragen \"ab\"");
  eq([platz(ohne, "Morokai").wert.ab, platz(ohne, "Aridus").wert.ab], [false, false], "alles gelesen: kein \"ab\"");
  eq([mit.von, mit.bis], [T0 + 30 * 60000, T0 + 3 * TAG], "der Zeitraum: erster bis letzter Kampf");
}
{
  // der Held: der hoechste Treffer ueber alles
  const a = core.rekorde([k("Morokai", 1, 0, { top: 500000 }), k("Akman", 1, 1, { top: 900000, skill: "boro:ventius" }), k("Practice Dummy", 1, 1, { c: 60, top: 800000 })], T, false);
  eq([a.held.ort.de, a.held.top, a.held.topSid, a.held.topTeil, a.held.at], ["Manticus", 900000, "boro:ventius", "Akman", T0 + TAG], "der Held: hoechster Treffer, Faehigkeit, Boss, Tag");
  eq([a.dateien, a.kaempfe], [1, 3], "Quelle: Dateien und Kaempfe");
}
{
  const leer = core.rekorde([], T, true);
  eq([leer.held, leer.kaempfe, leer.von, leer.seiten.every((s) => s.besiegt === 0)], [null, 0, null, true], "ohne Kaempfe: leeres Album, kein Held");
  // was kein Kampf ist, faellt weg
  const kaputt = core.rekorde([{ name: "Morokai", dps: NaN, at: T0 }, { name: "Morokai", dps: 5, at: NaN }, null, { name: 3, dps: 1, at: T0 }], T, false);
  eq(kaputt.kaempfe, 0, "Kaempfe ohne Zahl, ohne Zeit oder ohne Namen zaehlen nicht");
}
{
  // Bytes und Bedarf des Nachlesens: was muss gelesen werden?
  const idx = {
    "neu.txt": { size: 10, fights: [{ name: "Morokai", dps: 1, at: 1, top: 5, topSid: "A" }] },
    "alt.txt": { size: 10, fights: [{ name: "Morokai", dps: 1, at: 1 }] },
    "leer.txt": { size: 10, bytes: 50, nach: true, fights: [] },
    "wuchs.txt": { size: 10, bytes: 100, nach: true, fights: [{ name: "Morokai", dps: 1, at: 1, top: 5, topSid: "A" }] },
    // schon bis zum Ende nachgelesen, aber ohne top (eine Datei mit mehreren Angreifern): nicht noch einmal
    "gruppe.txt": { size: 10, bytes: 80, fights: [{ name: "Morokai", dps: 1, at: 1 }] },
    // gewachsen, aber ein alter Kampf ohne top: dann ganz
    "beides.txt": { size: 10, bytes: 80, fights: [{ name: "Morokai", dps: 1, at: 1 }] },
    "kleiner.txt": { size: 10, bytes: 80, nach: true, fights: [] },
  };
  const liste = [{ name: "neu.txt", size: 10 }, { name: "alt.txt", size: 10 }, { name: "leer.txt", size: 50 }, { name: "wuchs.txt", size: 160 },
    { name: "fremd.txt", size: 70 }, { name: "gruppe.txt", size: 80 }, { name: "beides.txt", size: 90 }, { name: "kleiner.txt", size: 40 }];
  eq(core.lesebedarf(liste, idx, false), [{ name: "alt.txt", ab: 0 }, { name: "wuchs.txt", ab: 100 }, { name: "fremd.txt", ab: 0 },
    { name: "beides.txt", ab: 0 }, { name: "kleiner.txt", ab: 0 }],
    "gelesen werden: Dateien ohne top ganz, unbekannte ganz, gewachsene ab der bekannten Groesse, geschrumpfte ganz");
  eq(core.lesebedarf(liste, idx, true).map((x) => x.name + ":" + x.ab),
    ["neu.txt:0", "alt.txt:0", "leer.txt:0", "wuchs.txt:0", "fremd.txt:0", "gruppe.txt:0", "beides.txt:0", "kleiner.txt:0"],
    "neu einlesen: alle Dateien der Liste ganz");
  eq(core.lesebedarf([...Array(70).keys()].map((i) => ({ name: "f" + i + ".txt", size: 1 })), {}, false).length, 60, "hoechstens die 60 neuesten");
}

// ---------------------------------------------------------------- die echte Tabelle der App
{
  const app = await bundle('export { DUNGEON_TAFEL, OFFENE_BOSSE } from "./src/renderer/app/06-blocks-and-places";', "node").catch((e) => ({ fehler: String(e) }));
  ok(app && Array.isArray(app.DUNGEON_TAFEL) && Array.isArray(app.OFFENE_BOSSE), "06-blocks-and-places.ts reicht seine Tabellen heraus", app && app.fehler);
  if (app && Array.isArray(app.DUNGEON_TAFEL)) {
    const t = core.albumTafel(app.DUNGEON_TAFEL, app.OFFENE_BOSSE);
    const o = t.flatMap(orte);
    eq(orte(t[0]).map((x) => x.de), ["Dragaryle", "Zairos \u00b7 Vulkan", "Radeth", "Calanthia"], "echte Tabelle: der Raid wie im Entwurf");
    eq(t[2].gruppen.map((g) => g.key), [null, "erz", "koloss"], "echte Tabelle: Feldbosse, Erzbosse, Kolosse");
    eq(t[3].gruppen.map((g) => g.key), ["s4", "s3", "s2", "s1", "solo"], "echte Tabelle: Dungeons nach Sternen");
    ok(o.length === new Set(o.map((x) => x.id)).size && o.length > 60, "echte Tabelle: jeder Boss einmal", o.length);
    const a = core.rekorde([k("Deluzhnoa", 1, 0), k("Ascended Aridus [Undead]", 1, 0), k("King Khanzaizin", 1, 0), k("Vegamor's Claw", 1, 0)], t, false);
    eq(a.ohneOrt, 0, "echte Tabelle: Erzboss, Feldboss mit Zustand, Dungeonboss und Kolossteil finden ihren Platz");
  }
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exitCode = failed ? 1 : 0;
