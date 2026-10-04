// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Live-Leistung (Spezifikation 26.09.2026, Abschnitte 4, 7.1 und 7.2) ohne
// Fenster: der Helfer (src/main/logs.ts) liest ab einem Byte bis zur letzten
// ganzen Zeile, die Einstellungen (src/main/config.ts) werden ganz oder gar
// nicht geschrieben, die Seite (src/renderer/app/, in Node mit einer
// gestellten Seite drumherum) haengt das Stueck an. Nach vielen Stuecken muss
// alles genau so dastehen wie nach einmaligem Laden der ganzen Datei:
// Ereignisse, Kaempfe, Namen, Bloecke. Testdaten: das Beispiel der Seite und
// scripts/fixtures/live-auszug.txt (aus einem eigenen Log vom 25.09., auf Zeiten,
// Kennungen, Zahlen und Trefferarten reduziert; Gegner ausserhalb der
// Tabellen der Seite und alle Faehigkeiten heissen erfunden).
//
// Run:  npm run test:live-core

import * as esbuild from "esbuild";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        got  " + a.slice(0, 400) + "\n        want " + b.slice(0, 400)); }
}
async function bundle(contents, plugins = []) {
  const built = await esbuild.build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, format: "esm",
    platform: "node", write: false, logLevel: "silent", define: { __BORO_VERSION__: '"test"' }, plugins: [bilderPlugin(root, bilderModus(root)), ...plugins] });
  return import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64"));
}
const work = mkdtempSync(join(tmpdir(), "boro-live-"));

// --- 1. Der Helfer: ab einem Byte bis zur letzten ganzen Zeile (7.2)
const logs = await bundle('export { readLogFrom, latestAnswer, TAIL_MAX } from "./src/main/logs";');
{
  const datei = join(work, "TLCombatLog-helfer.txt");
  const found = () => { const st = statSync(datei); return { name: "TLCombatLog-helfer.txt", full: datei, size: st.size, mtime: 0, mtimeMs: 0 }; };
  writeFileSync(datei, "a,1\nb\u00e4,2\nc,3");                       // 4 + 6 + 3 Bytes, die letzte Zeile ohne Ende
  eq(logs.readLogFrom(found(), 0), { file: "TLCombatLog-helfer.txt", from: 0, to: 10, size: 13, head: "a,1\nb\u00e4,2\n", text: "a,1\nb\u00e4,2\n" },
    "ab 0: bis hinter die letzte ganze Zeile, die halbe bleibt liegen");
  eq(logs.readLogFrom(found(), 2).to, 10, "from mitten in einer Zeile: to steht trotzdem auf einem Zeilenende");
  eq(logs.readLogFrom(found(), 6).to, 10, "from mitten im \u00e4 (zwei Bytes): to steht auf dem Zeilenende");
  eq([logs.readLogFrom(found(), 10).to, logs.readLogFrom(found(), 10).text], [10, ""], "ab to: nichts Neues, bis die Zeile fertig ist");
  appendFileSync(datei, "\n");
  eq([logs.readLogFrom(found(), 10).to, logs.readLogFrom(found(), 10).text], [14, "c,3\n"], "die Zeile ist fertig: sie kommt ganz");
  eq(logs.readLogFrom(found(), 14), { file: "TLCombatLog-helfer.txt", from: 14, to: 14, size: 14, head: "a,1\nb\u00e4,2\n", text: "" }, "from = Groesse: leer");
  eq(logs.readLogFrom(found(), 15), null, "from hinter dem Ende: null (die Datei wurde kuerzer)");
  eq(logs.readLogFrom(found(), 0, 8), { file: "TLCombatLog-helfer.txt", from: 0, to: 4, size: 14, head: "a,1\nb\u00e4,2\n", text: "a,1\n" },
    "Obergrenze: bis zur letzten ganzen Zeile davor, der Rest im naechsten Takt");
  eq(logs.readLogFrom(found(), 0, 2).to, 0, "eine Zeile laenger als die Grenze: nichts, to bleibt");
  eq(logs.TAIL_MAX, 8 * 1024 * 1024, "die Grenze ist 8 MB");
  writeFileSync(join(work, "eine.txt"), "a,1\nb,2");
  eq(logs.readLogFrom({ name: "eine.txt", full: join(work, "eine.txt") }, 0).head, "", "noch keine zwei ganzen Zeilen: head ist leer");
  const status = (file, from) => logs.latestAnswer(found(), file, from).status;
  eq(status("TLCombatLog-helfer.txt", "0"), 200, "richtiger Name, from 0: 200");
  eq(status("TLCombatLog-alt.txt", "0"), 409, "anderer Name: 409");
  eq(status("../TLCombatLog-helfer.txt", "0"), 409, "ein Pfad statt eines Namens: 409");
  eq(status(null, "0"), 409, "ohne Namen: 409");
  eq(["-1", "1.5", "abc", "", " 1", "01", "1e3", "9999999999999999"].map((f) => status("TLCombatLog-helfer.txt", f)),
    [400, 400, 400, 400, 400, 400, 400, 400], "from keine ganze Zahl >= 0: 400");
  eq(status("TLCombatLog-helfer.txt", "15"), 409, "from groesser als die Datei: 409");
  writeFileSync(datei, "a,1\n");
  eq(status("TLCombatLog-helfer.txt", "10"), 409, "Datei gekuerzt: 409");
}

// --- 2. Die Einstellungen (Abschnitt 4): ganz oder gar nicht, und nur bei einer Aenderung.
// config.ts haengt ueber paths.ts an electron; hier steht ein gestelltes, die Datei liegt im Temp-Ordner.
{
  process.env.APPDATA = work;
  const electron = { name: "electron", setup(b) {
    b.onResolve({ filter: /^electron$/ }, () => ({ path: "electron", namespace: "gestellt" }));
    b.onLoad({ filter: /.*/, namespace: "gestellt" }, () => ({ loader: "js",
      contents: "export const app = { isPackaged: false, getAppPath: () => process.env.APPDATA, getPath: () => process.env.APPDATA };" }));
  } };
  const cfg = await bundle('export { updateConfig, loadConfig, CONFIG_PATH } from "./src/main/config";', [electron]);
  const { existsSync } = await import("node:fs");
  // bigint: unter Windows ist die Datei-ID groesser als 2^53, als Zahl fielen zwei IDs zusammen
  const ino = () => statSync(cfg.CONFIG_PATH, { bigint: true }).ino.toString();
  cfg.updateConfig({ logIndex: { "a.txt": { size: 1, fights: [] } } });
  const erst = ino();
  eq([cfg.loadConfig().logIndex["a.txt"].size, existsSync(cfg.CONFIG_PATH + ".tmp")], [1, false], "geschrieben, keine Temp-Datei bleibt liegen");
  cfg.updateConfig({ logIndex: { "a.txt": { size: 1, fights: [] } } });
  eq(ino(), erst, "derselbe Stand noch einmal: die Datei wird nicht angefasst");
  cfg.updateConfig({ logIndex: { "a.txt": { size: 2, fights: [] } } });
  eq([ino() !== erst, cfg.loadConfig().logIndex["a.txt"].size, existsSync(cfg.CONFIG_PATH + ".tmp")], [true, 2, false],
    "eine Aenderung: eine neue Datei an ihrer Stelle (umbenannt, nicht ueberschrieben)");
}

// --- 3. Die Seite: Stueck fuer Stueck gleich wie am Stueck (7.1)
/* Eine gestellte Seite: jedes Element nimmt alles an und merkt sich nur,
   was man ihm setzt. Die rechnenden Teile fragen nichts anderes. */
const element = () => ({ innerHTML: "", textContent: "", value: "", hidden: false, children: [], dataset: {}, style: {},
  classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, setAttribute() {}, querySelectorAll: () => [] });
globalThis.location = { protocol: "file:", search: "" };
globalThis.document = { querySelector: () => element(), querySelectorAll: () => [], body: element(),
  documentElement: { ...element(), getAttribute: () => null } };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const p = await bundle(`
  export { state } from "./src/renderer/app/01-state";
  export { setup as setup15 } from "./src/renderer/app/15-weapons-and-ventius";
  export { setup as setup18 } from "./src/renderer/app/18-interface-basics";
  export { setup as setup19 } from "./src/renderer/app/19-grouping-and-party-fights";
  export { setup as setup32, tailRechnen, refreshPlayers } from "./src/renderer/app/32-history";
  export { parseGrid, profile, autoMap, buildEvents } from "./src/renderer/app/04-log-parsing";
  export { segment } from "./src/renderer/app/05-fights";
  export { SAMPLE_LOG } from "./src/renderer/app/40-sample-fight";`);
p.setup15(); p.setup18(); p.setup19(); p.setup32();
const { state } = p;
state.ventiusTop = {};

const NAME = "TLCombatLog-live.txt";
function frisch(gap, phasen) {
  Object.assign(state, { text: "", fileNames: [], parsed: null, mapping: {}, events: [], encounters: [], sel: 0,
    player: "__all", delim: "auto", headerMode: "auto", clearBefore: null, gap, mergePhases: phasen, minDur: 3 });
  state.entfernt.clear(); state.cmp.clear();
}
/* Das ganze Laden: dieselben Schritte wie loadText() (32-history.ts), ohne
   Meldungen und ohne Zeichnen. */
function ganz(text) {
  const g = p.parseGrid(text);
  if (!g) return false;
  const cols = p.profile(g);
  Object.assign(state, { text, fileNames: [NAME], origin: "watch", parsed: g, _cols: cols, mapping: p.autoMap(g, cols),
    integrity: Object.assign({}, g.counts, { countedFrom: "full" }) });
  p.buildEvents(); p.refreshPlayers(); p.segment();
  return true;
}
/* Was gleich sein muss (Spezifikation 3.5): Ereignisse, Kaempfe, Namen,
   Bloecke - dazu, was die Ereignisse ueber die ganze Datei sagen. */
function abbild() {
  return {
    events: state.events.map((e) => [e.t, e.event, e.skill, e.sid, e.dmg, e.crit, e.heavy, e.hitType, e.shield, e.source, e.target]),
    fights: state.encounters.map((s) => ({ start: s.start, end: s.end, name: s.stats.name, total: s.stats.total,
      hits: s.stats.hits, dps: s.stats.dps, seconds: s.stats.seconds, fought: s.stats.fought, parts: s.parts,
      index: s.index, missed: s.missed ?? null, invuln: s.invuln ?? null, ventius: s.ventius, block: s.block?.index,
      skills: s.stats.skills.map((k) => [k.name, k.damage, k.hits]), targets: s.stats.targets.map((t) => [t.name, t.damage]) })),
    blocks: state.blocks.map((b) => ({ start: b.start, end: b.end, top: b.top, fights: b.fights, hidden: b.hidden,
      total: b.total, seconds: b.seconds, span: b.span, only: b.only, dungeon: b.dungeon?.en ?? null })),
    players: state.players, hitTypes: state.hitTypes, eventTypes: state.eventTypes, wall: state.wall,
    noTime: state.noTime, minDurDropped: state.minDurDropped,
    backwards: state.integrity.backwards, sidClash: state.integrity.sidClash,
  };
}
// fester Zufall (mulberry32), damit ein Fehler wiederkommt
let seed = 20260926;
const zufall = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/* Die Stelle, an der ein Zuruecksetzen um nur ein Stueck falsch waere
   (segmentTail in 05-fights.ts): nach 20 s Pause trifft der neue Abschnitt
   erst ein anderes Ziel haerter - dann steht er allein -, spaeter wieder
   das alte, und am Stueck gehoert er zum vorigen. Davor 400 s Vorlauf, damit
   die Seite ab dort anhaengt (mehr als 600 Zeilen). */
const zwei = (n, w = 2) => String(n).padStart(w, "0");
const stempel = (ms) => { const d = new Date(ms);
  return `${d.getUTCFullYear()}${zwei(d.getUTCMonth() + 1)}${zwei(d.getUTCDate())}-${zwei(d.getUTCHours())}:` +
         `${zwei(d.getUTCMinutes())}:${zwei(d.getUTCSeconds())}:${zwei(d.getUTCMilliseconds(), 3)}`; };
function phasenLog() {
  const z = ["CombatLogVersion,4"], t0 = Date.UTC(2026, 8, 25, 20, 0, 0);
  const treffer = (von, sek, ziel, dmg) => { for (let k = 0; k * 500 < sek * 1000; k++)
    z.push(`${stempel(von + k * 500)},DamageDone,F\u00e4higkeit \u2013 953174691,953174691,${dmg + (k % 7) * 13},${k % 3 ? 0 : 1},0,kNormalHit,Ich,${ziel}`); };
  treffer(t0, 400, "Gegner 3", 900);                        // Vorlauf, ein eigener Block
  treffer(t0 + 600e3, 40, "Gegner 1", 1000);                // Teil A
  treffer(t0 + 660e3, 5, "Gegner 2", 3000);                 // Teil B beginnt auf einem anderen Ziel ...
  treffer(t0 + 665e3, 35, "Gegner 1", 1000);                // ... und gehoert am Ende doch zu A
  return z.join("\n") + "\n";
}
const QUELLEN = [["Beispiel", p.SAMPLE_LOG + "\n"],
                 ["Auszug", readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8")],
                 ["Phasen", phasenLog()]];
const datei = join(work, NAME);
const found = () => ({ name: NAME, full: datei, size: statSync(datei).size, mtime: 0, mtimeMs: 0 });
const zahl = { stuecke: 0, angehaengt: 0, ganz: 0, mitten: 0 };
/* Die Datei waechst Schnitt fuer Schnitt; je Schnitt ein Takt wie in
   pollServer (41-server-mode.ts): erst das neue Ende ab dem Stand, und wenn
   das nicht geht, ganz. nachDemErsten laeuft nach dem ersten Laden (Leeren,
   Trennen nach, Entfernen). Gibt zurueck, was der letzte Takt als neu
   meldete. */
function stueckweise(bytes, schnitte, nachDemErsten) {
  writeFileSync(datei, "");
  let geschrieben = 0, stand = null, kopf = null, neu;
  for (const c of schnitte) {
    appendFileSync(datei, bytes.subarray(geschrieben, c)); geschrieben = c; zahl.stuecke++;
    if (stand !== null) {
      const d = logs.readLogFrom(found(), stand);
      const r = d && d.head === kopf ? p.tailRechnen(d.text, [NAME]) : false;
      if (d && (d.text === "" || r !== false)) { stand = d.to; if (d.text) { zahl.angehaengt++; neu = r; } continue; }
    }
    const d = logs.readLogFrom(found(), 0);
    if (d.text && ganz(d.text)) {
      stand = d.to; kopf = d.head; zahl.ganz++; neu = undefined;
      if (nachDemErsten) { nachDemErsten(); nachDemErsten = null; }
    }
  }
  return neu;
}
function vergleiche(name, einstellen, text, schnitte, nachDemErsten) {
  const bytes = Buffer.from(text, "utf8");
  einstellen();
  const neu = stueckweise(bytes, schnitte, nachDemErsten);
  const a = abbild();
  einstellen();
  ganz(text);
  if (nachDemErsten) { nachDemErsten(); }
  const b = abbild();
  const wo = Object.keys(b).find((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  if (wo) {
    failed++;
    console.log(`  FAIL  ${name}: ${wo} weicht ab`);
    console.log("        stueckweise " + JSON.stringify(a[wo]).slice(0, 300) + "\n        am Stueck   " + JSON.stringify(b[wo]).slice(0, 300));
  }
  return { gleich: !wo, neu };
}

let gleich = 0;
for (let lauf = 0; lauf < 200; lauf++) {
  const [quelle, text] = QUELLEN[lauf % 3];
  const laenge = Buffer.byteLength(text);
  const gap = [8, 8, 3, 60, 120][lauf % 5], phasen = lauf % 3 !== 1;
  // bis zu 40 Schnitte an beliebigen Bytes - mitten in Zeilen und in Zeichen
  const n = 1 + Math.floor(zufall() * 40);
  const schnitte = [...new Set(Array.from({ length: n }, () => Math.floor(zufall() * laenge)))].sort((a, b) => a - b);
  schnitte.push(laenge);
  const bytes = Buffer.from(text, "utf8");
  zahl.mitten += schnitte.filter((c) => c < laenge && (bytes[c] & 0xc0) === 0x80).length;
  if (vergleiche(`Lauf ${lauf} (${quelle}, Trennen nach ${gap} s, Phasen ${phasen}, ${schnitte.length} Stuecke)`,
                 () => frisch(gap, phasen), text, schnitte).gleich) gleich++;
}
eq(gleich, 200, `200 Laeufe mit festem Zufall: Stueck fuer Stueck gleich wie am Stueck (${zahl.stuecke} Stuecke, ` +
  `${zahl.angehaengt} angehaengt, ${zahl.ganz} ganz geladen, ${zahl.mitten} Schnitte mitten in einem Zeichen)`);
eq([zahl.angehaengt > 1000, zahl.mitten > 20], [true, true], "die meisten Stuecke wurden angehaengt, viele Schnitte lagen mitten in einem Zeichen");

// --- 4. Einzelfaelle
const AUSZUG = QUELLEN[1][1], PHASEN = QUELLEN[2][1];
const zeilenEnde = (text, anteil) => { const b = Buffer.from(text, "utf8"); return b.indexOf(0x0a, Math.floor(b.length * anteil)) + 1; };
{
  // der letzte Takt haengt ein paar Zeilen an den letzten Kampf: neu gerechnet werden nur die letzten Stuecke
  const L = Buffer.byteLength(AUSZUG);
  const r = vergleiche("wenige Zeilen am Ende", () => frisch(8, true), AUSZUG, [zeilenEnde(AUSZUG, 0.97), L]);
  eq([r.gleich, r.neu instanceof Set, r.neu && r.neu.size <= 3, state.encounters.length >= 6], [true, true, true, true],
    "ein Takt am Ende des letzten Kampfes: nur die letzten Kaempfe gelten als neu (histRecord, bestRecord)");
}
{
  // Zeilen, die vor den alten liegen (ein bearbeitetes Log): buildEvents rechnet alles neu, das Ergebnis bleibt gleich
  const frueh = PHASEN.split("\n").slice(1, 40).map((z) => z.replace(/^20260925-20:00/, "20260925-19:30")).join("\n") + "\n";
  const text = PHASEN + frueh;
  const r = vergleiche("Zeilen vor den alten", () => frisch(8, true), text, [Buffer.byteLength(PHASEN), Buffer.byteLength(text)]);
  eq([r.gleich, r.neu], [true, null], "Zeilen vor den alten: alles neu sortiert und geschnitten, gleich wie am Stueck");
}
{
  // "Leeren" waehrend Live: der Zeitschnitt gilt auch fuer das, was danach kommt
  const L = Buffer.byteLength(PHASEN);
  // derselbe Zeitschnitt fuer beide Wege: der Zeitpunkt des Klicks im stueckweisen Laden
  let zeit = null;
  const leeren = () => { zeit ??= state.events[state.events.length - 1].t; state.clearBefore = zeit;
    p.buildEvents(); p.refreshPlayers(); p.segment(); };
  eq(vergleiche("Leeren", () => frisch(8, true), PHASEN, [zeilenEnde(PHASEN, 0.6), zeilenEnde(PHASEN, 0.8), L], leeren).gleich, true,
    "nach \"Leeren\" kommt nur, was danach geschah - wie am Stueck mit demselben Zeitschnitt");
}
{
  // "Trennen nach" waehrend Live geaendert (34-menus-drop-and-tabs.ts schneidet dann neu): die Takte danach schneiden mit dem neuen Wert
  const L = Buffer.byteLength(AUSZUG);
  const aendern = () => { state.gap = 20; p.segment(); };
  eq(vergleiche("Trennen nach", () => frisch(8, true), AUSZUG, [zeilenEnde(AUSZUG, 0.7), zeilenEnde(AUSZUG, 0.9), L], aendern).gleich, true,
    "\"Trennen nach\" waehrend Live geaendert: weiter mit dem neuen Wert, wie am Stueck");
}
{
  // ein entfernter Kampf bleibt entfernt, waehrend weitere Zeilen kommen
  const L = Buffer.byteLength(AUSZUG);
  let erster = null;
  const entfernen = () => { erster ??= state.encounters[state.encounters.length - 1].start; state.entfernt.add(erster); p.segment(); };
  eq(vergleiche("Entfernen", () => frisch(8, true), AUSZUG, [zeilenEnde(AUSZUG, 0.7), zeilenEnde(AUSZUG, 0.9), L], entfernen).gleich, true,
    "ein entfernter Kampf bleibt draussen, waehrend weitere Zeilen kommen");
}

// --- 5. Die Schadensspalte an der Uebungspuppe (Fehlerbericht vom 28.09.)
/* Ein Stueck Puppenlog, wie das Spiel es schreibt (CombatLogVersion 4, zehn
   Spalten, kein Kopf), auf Zeiten, Kennungen, Zahlen und Trefferarten
   reduziert; der Spieler heisst erfunden. In den ersten Zeilen liegt der
   Schaden eng beisammen (719 bis 1209), vier Kennungen stehen schon da: die
   Heuristik fand keine "schwankende" Spalte und nahm die mit dem groessten
   Mittelwert - die Faehigkeitskennung, rund 940 Millionen je Treffer. Live
   liest die Datei in genau diesem Stand; beim Beobachten eines Ordners im
   Browser (sweep in 34-menus-drop-and-tabs.ts) bleibt die erste Zuordnung
   fuer alle weiteren Zeilen. */
const PUPPE = [
  "20260928-23:13:22:783,DamageDone,Claw,940710828,1209,1,0,kMaxDamageByCriticalDecision,Spieler A,Practice Dummy",
  "20260928-23:13:22:966,DamageDone,Claw,940710828,864,0,0,kNormalHit,Spieler A,Practice Dummy",
  "20260928-23:13:23:674,DamageDone,Claw,941169852,1209,1,0,kMaxDamageByCriticalDecision,Spieler A,Practice Dummy",
  "20260928-23:13:24:199,DamageDone,Claw,940973120,1016,0,0,kNormalHit,Spieler A,Practice Dummy",
  "20260928-23:13:24:441,DamageDone,Claw,940973120,719,0,0,kNormalHit,Spieler A,Practice Dummy",
  "20260928-23:13:24:849,DamageDone,Claw,940710828,1164,0,1,kNormalHit,Spieler A,Practice Dummy",
  "20260928-23:13:25:024,DamageDone,Claw,940710828,1164,1,0,kMaxDamageByCriticalDecision,Spieler A,Practice Dummy",
  "20260928-23:13:25:532,DamageDone,Claw,940842037,860,0,0,kNormalHit,Spieler A,Practice Dummy",
  "20260928-23:13:25:749,DamageDone,Claw,940842037,1164,1,0,kMaxDamageByCriticalDecision,Spieler A,Practice Dummy",
  "20260928-23:14:18:792,DamageDone,Claw,940710828,751,0,0,kNormalHit,Spieler A,Practice Dummy",
  "20260928-23:14:18:984,DamageDone,Claw,940710828,668,0,0,kNormalHit,Spieler A,Practice Dummy",
  "20260928-23:14:19:684,DamageDone,Claw,941169852,696,0,0,kNormalHit,Spieler A,Practice Dummy",
  "20260928-23:14:50:992,DamageDone,Claw,940710828,771,0,0,kNormalHit,Spieler A,Practice Dummy",
  "20260928-23:14:51:158,DamageDone,Claw,940710828,970,0,0,kNormalHit,Spieler A,Practice Dummy",
];
{
  const falsch = [], ohneKopfFalsch = [];
  for (let n = 2; n <= PUPPE.length; n++) {
    const zeilen = PUPPE.slice(0, n);
    const echt = zeilen.reduce((s, z) => s + Number(z.split(",")[4]), 0);
    frisch(8, true);
    ganz("CombatLogVersion,4\n" + zeilen.join("\n") + "\n");
    const summe = state.events.reduce((s, e) => s + e.dmg, 0);
    if (state.mapping.damage !== 4 || state.mapping.skillId !== 3 || summe !== echt)
      falsch.push(n + " Zeilen: Schaden aus Spalte " + state.mapping.damage + ", Summe " + summe + " statt " + echt);
    // ohne die Versionszeile entscheidet die Heuristik allein
    const g = p.parseGrid(zeilen.join("\n"));
    const m = p.autoMap(g, p.profile(g));
    if (n >= 5 && m.damage !== 4) ohneKopfFalsch.push(n + " Zeilen: Spalte " + m.damage);
  }
  eq(falsch, [], "Puppenlog Version 4, 2 bis 14 Zeilen: der Schaden kommt aus Spalte 5, die Summe ist der echte Schaden");
  eq(ohneKopfFalsch, [], "Puppenlog ohne Versionszeile, 5 bis 14 Zeilen: die Heuristik nimmt keine Kennung als Schaden");
}

// --- 5b. Die Kennungsschwelle mit Reserve (Pruefung 01.10., M2)
/* Gemessen ueber 99 Logs und 248.048 Zeilen: jede Faehigkeits-ID ist
   neunstellig, von 939.780.553 bis 981.417.584 (4,43 % Abstand), der hoechste
   Treffer 1.079.629. Die alte Schwelle (5 %) hatte kaum Reserve: eine neue
   Faehigkeit bei 995 Millionen in den ersten Zeilen, und der Rueckfall nahm
   wieder die ID. Hier stehen die gemessenen Grenzen und eine erfundene ID bei
   995.000.000 (5,9 %), der Schaden eng wie an der Puppe; ohne Versionszeile
   entscheidet die Heuristik allein. */
{
  const ids = ["939780553", "960000000", "981417584", "995000000"];
  const zeilen = [];
  for (let k = 0; k < 12; k++)
    zeilen.push(`${stempel(Date.UTC(2026, 8, 28, 23, 13, 20) + k * 400)},DamageDone,Claw,${ids[k % 4]},${700 + (k * 53) % 500},${k % 2},0,kNormalHit,Spieler A,Practice Dummy`);
  const g = p.parseGrid(zeilen.join("\n"));
  const m = p.autoMap(g, p.profile(g));
  eq([m.damage, m.skillId], [4, 3], "IDs von 939 bis 995 Millionen (5,9 % Abstand): Schaden aus Spalte 5, die ID als ID");
}

// --- 5c. Die Version gehoert zur Datei (Pruefung 01.10., N4): eine danach gelesene Datei ohne Versionszeile
// aendert die Zuordnung der ersten nicht
{
  const g4 = p.parseGrid("CombatLogVersion,4\n" + PUPPE.slice(0, 3).join("\n"));
  p.parseGrid("a,b,c\n1,2,3\n4,5,6");
  const m = p.autoMap(g4, p.profile(g4));
  eq([g4.version, m.damage, m.skillId], ["4", 4, 3], "erst ein Puppenlog (3 Zeilen), dann eine andere Datei: das Puppenlog behaelt die feste Zuordnung");
}

// --- 5d. King Khanzaizin: Wipes als eigene Kaempfe (Entscheidung 01.10.: "waren wipes")
/* Zwei Teile von je 40 s am Boss, dazwischen eine Pause. Bei King
   Khanzaizin ist eine Pause ab 20 s ein Wipe und der zweite Teil ein neuer
   Kampf; eine kurze (10 s) bleibt im Kampf. Gegenprobe: derselbe Ablauf an
   Vulcanus bleibt ein Kampf aus zwei Teilen (die Minute, PHASE_GAP). Nur
   Zeiten, Zahlen und Bossnamen, die Quelle heisst erfunden. */
function zweiTeile(boss, pause) {
  const z = ["CombatLogVersion,4"], t0 = Date.UTC(2026, 8, 18, 20, 0, 0);
  const teil = (von) => { for (let k = 0; k < 80; k++)
    z.push(`${stempel(von + k * 500)},DamageDone,Quick Fire,964762401,${3000 + (k % 7) * 113},${k % 3 ? 0 : 1},0,kNormalHit,Spieler A,${boss}`); };
  teil(t0);
  teil(t0 + 39500 + pause * 1000);
  return z.join("\n") + "\n";
}
{
  const kaempfe = (boss, pause) => { frisch(8, true); ganz(zweiTeile(boss, pause));
    return state.encounters.map((s) => [s.stats.name, s.parts, Math.round((s.end - s.start) / 1000)]); };
  eq(kaempfe("King Khanzaizin", 30), [["King Khanzaizin", 1, 40], ["King Khanzaizin", 1, 40]], "King Khanzaizin, 30 s Pause: zwei Kaempfe");
  eq(kaempfe("King Khanzaizin", 10), [["King Khanzaizin", 2, 89]], "King Khanzaizin, 10 s Pause: ein Kampf aus zwei Teilen");
  eq(kaempfe("König Khanzaizin", 30).length, 2, "König Khanzaizin (deutscher Client), 30 s Pause: zwei Kaempfe");
  eq(kaempfe("Vulcanus", 30), [["Vulcanus", 2, 109]], "Gegenprobe Vulcanus, 30 s Pause: ein Kampf aus zwei Teilen wie bisher");
}

// --- 6. Steuerzeichen des Spiels in Namen (Fehler vom 29.09.)
/* Das Spiel schrieb ein Ziel als "^<s=Dialogue_Speech_Text>Vagamont^</s>",
   und so stand es in der Kampfwahl. Die Zeichen kommen beim Einlesen aus
   jedem Namen - Ziel, Quelle, Faehigkeit -, auch aus Namen, in denen sie
   bisher nicht gesehen wurden. */
{
  const zeilen = [];
  for (let k = 0; k < 30; k++)
    zeilen.push(`${stempel(Date.UTC(2026, 8, 29, 22, 19, 11) + k * 400)},DamageDone,` +
      (k % 2 ? "^<b>Quick Fire^</b>" : "Quick Fire") + `,964762401,${1000 + k * 37},0,0,kNormalHit,` +
      (k % 3 ? "^<s=Dialogue_Speech_Text>Spieler B^</s>" : "Spieler B") + ",^<s=Dialogue_Speech_Text>Vagamont^</s>");
  frisch(8, true);
  ganz("CombatLogVersion,4\n" + zeilen.join("\n") + "\n");
  const namen = [...new Set(state.events.flatMap((e) => [e.skill, e.source, e.target]))].sort();
  eq(namen, ["Quick Fire", "Spieler B", "Vagamont"], "Ziel, Quelle und Faehigkeit ohne ^<...> und ^</...>");
  eq([state.encounters.length, state.encounters[0]?.stats.name], [1, "Vegamor"], "der Kampf gegen Vagamont heisst Vegamor");
}

rmSync(work, { recursive: true, force: true });
console.log();
if (failed) { console.log(`LIVE CORE FAILED - ${failed}`); process.exit(1); }
console.log("LIVE CORE PASSED");
