// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die Spielbilder (Spezifikation oeffentliches Repo, 4): die Weiche in
// scripts/bilder-weiche.mjs und die Tabellen in beiden Modi. Voll (privat,
// Release): jeder Verweis der Module zeigt auf ein vorhandenes, gueltiges
// WebP. Leer (oeffentlicher Quelltext): alle Tabellen leer, die eigene
// Bossmarke ist da und wkHatBild sagt fuer nichts "Bild".
//
// Run:  npm run test:spielbilder-core

import * as esbuild from "esbuild";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin, LEER, spielbilderText, tabellenNamen, VOLL } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const quelle = (f) => readFileSync(join(root, "src/renderer/app", f), "utf8");
// ein Schluessel in Anfuehrungszeichen, auch mit \u-Escape (deutsche Namen)
const KEY = '"(?:[^"\\\\]|\\\\u[0-9a-fA-F]{4})+"';
let failed = 0;
function ok(cond, name, info) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (info === undefined ? "" : "\n        " + JSON.stringify(info).slice(0, 600))); }
}
const wirft = (f) => { try { f(); return false; } catch { return true; } };

// ---- die Weiche an einem gestellten Ordner
const probe = mkdtempSync(join(tmpdir(), "boro-weiche-"));
try {
  ok(bilderModus(probe, {}) === "leer", "ohne assets/: leer");
  ok(wirft(() => bilderModus(probe, { BORO_BILDER: "pflicht" })), "pflicht ohne assets/: Abbruch");
  ok(wirft(() => bilderModus(probe, { BORO_BILDER: "ja" })), "unbekannter Wert von BORO_BILDER: Abbruch");
  mkdirSync(join(probe, "assets"));
  writeFileSync(join(probe, VOLL), "export const A: Record<string, string> = {};\n");
  ok(bilderModus(probe, {}) === "voll", "mit assets/spielbilder.ts: voll");
  ok(bilderModus(probe, { BORO_BILDER: "aus" }) === "leer", "BORO_BILDER=aus: leer");
  ok(bilderModus(probe, { BORO_BILDER: "pflicht" }) === "voll", "BORO_BILDER=pflicht mit Datei: voll");
} finally { rmSync(probe, { recursive: true, force: true }); }

// ---- die Form
const NAMEN = ["BOSS_ICON_BILD", "KERN_BILD", "SKILL_ICON_BILD", "WK_BOSS_BILD", "WK_GEGENSTAND_BILD"];
const leerText = spielbilderText(root, "leer");
ok(JSON.stringify(tabellenNamen(leerText)) === JSON.stringify(NAMEN), LEER + " hat genau die fuenf Tabellen", tabellenNamen(leerText));
ok(NAMEN.every((n) => new RegExp("^export const " + n + ": Record<string, string> = \\{\\};$", "m").test(leerText)),
  LEER + ": jede Tabelle ist leer");

const modus = bilderModus(root);
console.log("  Modus: " + modus);
const text = spielbilderText(root, modus);
if (modus === "voll")
  ok(JSON.stringify(tabellenNamen(text)) === JSON.stringify(NAMEN), VOLL + " hat dieselben Tabellen", tabellenNamen(text));

// ---- die Eintraege einer Tabelle (Schluessel -> Base64 ohne data:-Kopf)
function tabelle(t, name) {
  const a = t.indexOf("export const " + name + ": Record<string, string> = {");
  const e = t.indexOf("};", a);
  const m = new Map();
  for (const z of t.slice(a, e).matchAll(new RegExp("^\\s*(?:(" + KEY + ")|([A-Za-z_$][\\w$]*))\\s*:\\s*\"([^\"]*)\",?$", "gm")))
    m.set(z[1] ? JSON.parse(z[1]) : z[2], z[3].replace(/^data:image\/webp;base64,/, ""));
  return m;
}
function webp(b64) {
  const b = Buffer.from(b64, "base64");
  return b.length > 30 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" && b.readUInt32LE(4) + 8 === b.length;
}
// Breite und Hoehe eines WebP (VP8X, VP8 oder VP8L)
function masse(b64) {
  const b = Buffer.from(b64, "base64"), art = b.toString("latin1", 12, 16);
  if (art === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (art === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (art === "VP8L") { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  return null;
}
// die Ziele einer Verweis-Tabelle (Name -> Bildschluessel) in einem Modul
const werte = (text, kopf) => {
  const a = text.indexOf(kopf), e = text.indexOf("\n};", a);
  return a < 0 ? null : [...text.slice(a, e).matchAll(new RegExp("^\\s*" + KEY + "\\s*:\\s*\"([^\"]+)\",?$", "gm"))].map((m) => m[1]);
};

const T = Object.fromEntries(NAMEN.map((n) => [n, tabelle(text, n)]));
const q11 = quelle("11-skill-icons.ts"), q12 = quelle("12-boss-images.ts");
const marke = /^const EIGENE_BOSSMARKE = "([A-Za-z0-9+\/=]+)";$/m.exec(q12);
ok(!!marke && webp(marke[1]), "12-boss-images.ts traegt die eigene Bossmarke als gueltiges WebP");
const bossZiele = werte(q12, "const BOSS_ICON: Record<string, string> = {");
const skillZiele = [...(werte(q11, "export const SKILL_ICON_NAME: Record<string, string> = {") || []),
  ...(werte(q11, "export const SKILL_ICON_SID: Record<string, string> = {") || [])];
ok(!!bossZiele && bossZiele.length > 50 && skillZiele.length > 500, "Verweise der Module gelesen", { boss: bossZiele?.length, skill: skillZiele.length });
const fremdeZiele = [...new Set(bossZiele || [])].filter((z) => !/^(?:boro:boss|fremd:[a-z-]+|wk:[a-z]+|foto:[a-z-]+|PT_NPC_\w+)$/.test(z));
ok(!fremdeZiele.length, "jedes Ziel in BOSS_ICON hat eine bekannte Form (boro:boss, fremd:, wk:, foto:, PT_NPC_)", fremdeZiele);

if (modus === "voll") {
  const kaputt = NAMEN.flatMap((n) => [...T[n]].filter(([, v]) => !webp(v)).map(([k]) => n + ":" + k));
  ok(!kaputt.length, "voll: jeder Eintrag ist ein gueltiges WebP", kaputt);
  const ohneBoss = [...new Set(bossZiele)].filter((z) => z !== "boro:boss" &&
    !(z.startsWith("wk:") ? T.WK_BOSS_BILD.has(z.slice(3)) : T.BOSS_ICON_BILD.has(z)));
  ok(![...T.BOSS_ICON_BILD.keys()].some((k) => k.startsWith("wk:")), "voll: kein Schluessel im Asset beginnt mit wk: (der gehoert den Weekly-Bildern)");
  ok(!ohneBoss.length, "voll: jeder Boss-Verweis hat ein Bild (der Rueckfall auf die Marke aendert nichts Sichtbares)", ohneBoss);
  const ohneSkill = [...new Set(skillZiele)].filter((z) => !T.SKILL_ICON_BILD.has(z));
  ok(!ohneSkill.length, "voll: jeder Skill-Verweis hat ein Bild", ohneSkill);
  ok(!T.BOSS_ICON_BILD.has("boro:boss"), "voll: boro:boss steht nicht im Asset, sondern im Quelltext");
} else {
  ok(NAMEN.every((n) => T[n].size === 0), "leer: alle Tabellen leer");
}

// ---- jedes Buendel von Seitenteilen nimmt die Weiche
// Ohne das Plugin loest esbuild "../spielbilder" still auf die leere Datei auf:
// ein Test liefe im Modus "voll" mit leeren Tabellen. Gelesen wird jeder Aufruf
// von esbuild.build/buildSync in scripts/*.mjs. Er buendelt Seitenteile, wenn
// er src/renderer nennt; nennt er gar keine Quelle (ein Helfer wie bundle(),
// der sie als Wert bekommt), dann, wenn seine Datei irgendwo src/renderer
// buendelt. Ein solcher Aufruf muss bilderPlugin( tragen.
function aufrufe(text) {
  const liste = [];
  for (const m of text.matchAll(/esbuild\.build(?:Sync)?\(/g)) {
    let i = m.index + m[0].length, tiefe = 1, q = null;
    for (; i < text.length && tiefe; i++) {
      const c = text[i];
      if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === "`") q = c;
      else if (c === "(") tiefe++;
      else if (c === ")") tiefe--;
    }
    liste.push({ zeile: text.slice(0, m.index).split("\n").length, text: text.slice(m.index, i) });
  }
  return liste;
}
const RENDERER = /src\/renderer|"src", "renderer"/;
// benannte Ausnahmen mit Grund; jede muss noch zutreffen
// (keine mehr: das Audit buendelt die Seite seit Aufgabe A4 selbst durch die Weiche)
const BUENDEL_AUSNAHMEN = {};
const ohnePlugin = [], ausnahmenGesehen = new Set();
let gezaehlt = 0;
for (const f of readdirSync(join(root, "scripts")).filter((n) => n.endsWith(".mjs")).sort()) {
  const t = readFileSync(join(root, "scripts", f), "utf8");
  const dateiBuendeltSeite = /^(?!\s*(?:\/\/|\/?\*)).*["'`](?:\.\/)?src\/renderer\/[^"'`]*["'`]|"src", "renderer"/m.test(t.replace(/readFileSync\([^\n]*/g, ""));
  for (const a of aufrufe(t)) {
    const seite = RENDERER.test(a.text) || (!/src/.test(a.text) && dateiBuendeltSeite);
    if (!seite) continue;
    gezaehlt++;
    if (a.text.includes("bilderPlugin(")) continue;
    if (BUENDEL_AUSNAHMEN[f]) { ausnahmenGesehen.add(f); continue; }
    ohnePlugin.push(f + ":" + a.zeile);
  }
}
ok(gezaehlt >= 10, "Buendel von Seitenteilen in scripts/ gefunden", gezaehlt);
ok(!ohnePlugin.length, "jedes Buendel von Seitenteilen in scripts/ traegt bilderPlugin", ohnePlugin);
ok(Object.keys(BUENDEL_AUSNAHMEN).every((f) => ausnahmenGesehen.has(f)), "jede Ausnahme trifft noch zu", Object.keys(BUENDEL_AUSNAHMEN));

// ---- 60: wkHatBild und das Stilblatt, gebaut wie die Seite
const b = await esbuild.build({ stdin: { contents: 'export * from "./src/renderer/app/60-weeklies-bilder";', resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent", plugins: [bilderPlugin(root, modus)] });
const wk = await import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));
if (modus === "voll") {
  ok(wk.wkHatBild("korridor") && wk.wkHatBild("widerstandHeroischFreischalt") && wk.wkBilderCss().includes("data:image/webp;base64,UklGR"),
    "voll: Fluegel und Alias tragen ein Bild, das Stilblatt bettet es ein");
} else {
  ok(!wk.wkHatBild("korridor") && !wk.wkHatBild("widerstandHeroischFreischalt") && !wk.wkHatBild("goldeneKiste") && wk.wkBilderCss() === "",
    "leer: kein Schluessel traegt ein Bild, auch kein Alias, und das Stilblatt ist leer");
}
ok(!wk.wkHatBild("constructor") && !wk.wkHatBild("toString"), "nur eigene Schluessel, keine aus dem Prototyp");

// ---- 12: bossIcon, gebaut wie die Seite (Spezifikation Bossbilder, 04.10.2026)
// Die Seitenteile fragen beim Laden nach location, document und Stil: gestellt
// wie in test-live-core. Die Namen kommen aus den echten Tabellen von 06.
const element = () => ({ innerHTML: "", textContent: "", value: "", hidden: false, children: [], dataset: {}, style: {},
  classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, setAttribute() {}, querySelectorAll: () => [] });
globalThis.location = { protocol: "file:", search: "" };
globalThis.document = { querySelector: () => element(), querySelectorAll: () => [], body: element(),
  documentElement: { ...element(), getAttribute: () => null } };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const bb = await esbuild.build({ stdin: { contents: 'export { bossIcon, bossMark } from "./src/renderer/app/12-boss-images"; export { DUNGEON_TAFEL, OFFENE_BOSSE } from "./src/renderer/app/06-blocks-and-places";', resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent", define: { __BORO_VERSION__: '"test"' }, plugins: [bilderPlugin(root, modus)] });
const bi = await import("data:text/javascript;base64," + Buffer.from(bb.outputFiles[0].text).toString("base64"));
const MARKE = "data:image/webp;base64," + (marke ? marke[1] : "");
const formen = (d) => Object.values(d.forms || {}).flat();
const bossNamen = [...new Set([
  ...bi.DUNGEON_TAFEL.flatMap((d) => [...d.boss, ...(d.bosses || []).flat(), ...formen(d)]),
  ...bi.OFFENE_BOSSE.flatMap((o) => [o.de, o.en, ...o.names, ...(o.forms || [])]),
])];
ok(bossNamen.length >= 80, "Bossnamen aus 06 gelesen (DUNGEONS und OPEN_BOSSES)", bossNamen.length);
const ohneEintrag = bossNamen.filter((n) => !bi.bossIcon(n));
ok(!ohneEintrag.length, "jeder Bossname aus 06 (DE und EN) hat einen Eintrag in BOSS_ICON", ohneEintrag);
const phasenOhneForm = bi.DUNGEON_TAFEL.flatMap((d) => Object.values(d.phases || {}).flat().filter((p) => !formen(d).includes(p)));
ok(phasenOhneForm.includes("Fellini") && phasenOhneForm.every((p) => bi.bossIcon(p) === null && bi.bossMark(p) === ""),
  "eine Phase, die kein Boss ist (Fellini), bekommt kein Bild", phasenOhneForm.map((p) => [p, !!bi.bossIcon(p)]));
const PAARE = [["Grauauge", "Grayeye"], ["K\u00f6nig Khanzaizin", "King Khanzaizin"], ["Rex Chim\u00e4rus", "Rex Chimaerus"],
  ["K\u00f6nig Chim\u00e4rus", "King Chimaerus"], ["Magna-F\u00fcrst", "Duke Magna"], ["Kayser", "Kaiser Crimson"],
  ["Calanthia der Zerst\u00f6rung", "Calanthia"], ["Calanthia of Destruction", "Calanthia"]];
const ungleich = PAARE.filter(([de, en]) => !bi.bossIcon(de) || bi.bossIcon(de) !== bi.bossIcon(en));
ok(!ungleich.length, "deutsche Namen und Formen zeigen dasselbe Bild wie ihr englischer Name", ungleich);
const RAID = { Dragaryle: "zitadelle", Zairos: "korridor", Vulkan: "korridor", Calanthia: "altar",
  "Calanthia der Zerst\u00f6rung": "altar", "Calanthia of Destruction": "altar", Radeth: "radeth" };
if (modus === "voll") {
  const falsch = Object.entries(RAID).filter(([n, k]) => !T.WK_BOSS_BILD.has(k) || bi.bossIcon(n) !== "data:image/webp;base64," + T.WK_BOSS_BILD.get(k));
  ok(!falsch.length, "voll: die Raid-Bosse tragen im Meter ihr Bild aus den Weeklies (Vulkan das von Zairos)", falsch.map(([n]) => n));
}
const FOTO = { Vulcanus: "vulcanus", Fellinex: "fellinex", "Deus Chimaerus": "deus-chimaerus", Nerzatum: "nerzatum",
  "Kaiser Crimson": "kaiser-crimson", Kayser: "kaiser-crimson", "Norn Bercant": "norn-bercant", "Limuny Bercant": "limuny-bercant",
  "Duke Magna": "duke-magna", "Magna-F\u00fcrst": "duke-magna", "King Chimaerus": "king-chimaerus", "K\u00f6nig Chim\u00e4rus": "king-chimaerus",
  Kaligras: "kaligras", Gaitan: "gaitan", Turka: "turka", Shakarux: "shakarux", Lequirus: "lequirus", Shaikal: "shaikal",
  Minezerok: "minezerok", Minezrok: "minezerok", Exodus: "exodus",
  Verence: "verence", Marta: "marta", Haylock: "haylock", Gaudian: "gaudian" };
ok(new Set(Object.values(FOTO)).size === 21, "21 Fotos benannt");
if (modus === "voll") {
  const fotoFalsch = Object.entries(FOTO).filter(([n, k]) => !T.BOSS_ICON_BILD.has("foto:" + k) || bi.bossIcon(n) !== "data:image/webp;base64," + T.BOSS_ICON_BILD.get("foto:" + k));
  ok(!fotoFalsch.length, "voll: die 21 Bosse tragen ihr Foto, unter jedem Namen", fotoFalsch.map(([n]) => n));
  const mitMarke = bossNamen.filter((n) => bi.bossIcon(n) === MARKE);
  ok(!mitMarke.length, "voll: kein Boss aus 06 traegt mehr die gezeichnete Marke", mitMarke);
  const schief = [...T.BOSS_ICON_BILD, ...T.WK_BOSS_BILD].filter(([, v]) => String(masse(v)) !== "96,96").map(([k, v]) => [k, masse(v)]);
  ok(!schief.length, "voll: jedes Boss-Bild ist 96 x 96", schief);
}
if (modus === "leer")
  ok(bossNamen.every((n) => bi.bossIcon(n) === MARKE), "leer: jeder Boss traegt die eigene Marke");

console.log(failed ? "\n" + failed + " FAILED" : "\nall ok");
process.exit(failed ? 1 : 0);
