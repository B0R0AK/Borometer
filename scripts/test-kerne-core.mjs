// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Skillkern-Bilder (Nachtraege N2): jeder Kern in SKILL_CORE
// (src/renderer/app/21-damage-table.ts, dazu Eye of Ventius aus setup())
// hat ein Bild in KERN_BILD (assets/spielbilder.ts, ueber die Weiche) oder steht
// in der benannten Ausnahmeliste. Jedes Bild ist ein gueltiges WebP von
// 48 x 48 und hoechstens 6 kB. Der Quelltext wird gelesen, nicht gebaut:
// SKILL_CORE ist nicht exportiert und die Seite haengt an DOM und Zustand.
//
// Run:  npm run test:kerne-core

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, spielbilderText } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/* Ohne Spielbilder (BORO_BILDER=aus, der oeffentliche Quelltext) ist KERN_BILD
   leer und jeder Kern traegt die gezeichnete Marke; die Pruefungen der Bilder
   laufen dann nur mit Bildern, daneben steht die Pruefung der leeren Tabelle. */
const BILDER = bilderModus(root) === "voll";
const app = (f) => readFileSync(join(root, "src/renderer/app", f), "utf8");
let failed = 0;
function ok(cond, name, info) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (info ? "\n        " + info : "")); }
}

/* Kerne ohne Bild, mit Grund. Drei Kerne ergeben im Log "Ice Rain", jeder mit
   anderem Symbol; welches der Zeile gehoert, sagt das Log nicht. */
const AUSNAHMEN = ["Ice Rain"];
const MAX_BYTES = 6 * 1024;

// ---- die Kerne: die Schluessel von SKILL_CORE plus der zur Laufzeit angelegte
const dt = app("21-damage-table.ts");
const start = dt.indexOf("const SKILL_CORE: Record<string, SkillCoreInfo> = {");
const ende = dt.indexOf("\n};", start);
ok(start > 0 && ende > start, "SKILL_CORE im Quelltext gefunden");
const kerne = [...dt.slice(start, ende).matchAll(/^  "([^"]+)": *\{/gm)].map((m) => m[1]);
const vName = /export const VENTIUS_NAME = "([^"]+)"/.exec(app("15-weapons-and-ventius.ts"));
ok(!!vName && /SKILL_CORE\[VENTIUS_NAME\]\s*=/.test(dt), "Eye of Ventius wird in setup() angelegt");
if (vName) kerne.push(vName[1]);
ok(kerne.length >= 35 && new Set(kerne).size === kerne.length, "Kerne gelesen, ohne Doppelte (" + kerne.length + ")");

// ---- die Bilder: aus der Datei, die der Build nimmt (Spezifikation oeffentliches Repo, 4)
const ik = app("11-skill-icons.ts");
const sb = spielbilderText(root, bilderModus(root));
const bs = sb.indexOf("export const KERN_BILD: Record<string, string> = {");
const be = sb.indexOf("\n};", bs);
ok(BILDER ? bs > 0 && be > bs : /^export const KERN_BILD: Record<string, string> = \{\};$/m.test(sb),
  "KERN_BILD im Quelltext gefunden" + (BILDER ? "" : " (ohne Spielbilder: leer)"));
const bilder = new Map();
const kb = BILDER ? sb.slice(bs, be) : "";
for (const m of kb.matchAll(/^  "([^"]+)":"data:image\/webp;base64,([A-Za-z0-9+\/=]+)"/gm)) {
  ok(!bilder.has(m[1]), "KERN_BILD: " + m[1] + " nur einmal");
  bilder.set(m[1], Buffer.from(m[2], "base64"));
}
/* ohne Spielbilder gibt es nichts zu lesen: die leere Tabelle prueft die Probe darueber (= {};) */
if (BILDER) {
  const eintraege = (kb.match(/^  "/gm) || []).length;
  ok(eintraege === bilder.size, "jeder Eintrag von KERN_BILD ist eine WebP-data-URI",
    eintraege + " Eintraege, " + bilder.size + " gelesen");
}

// ---- jeder Kern: Bild oder Ausnahme
ok(JSON.stringify(AUSNAHMEN) === '["Ice Rain"]', "die Ausnahmeliste ist genau [\"Ice Rain\"]");
if (BILDER) {
  for (const a of AUSNAHMEN) ok(kerne.includes(a) && !bilder.has(a), "Ausnahme " + a + " ist ein Kern und hat kein Bild");
  const ohne = kerne.filter((k) => !bilder.has(k) && !AUSNAHMEN.includes(k));
  ok(ohne.length === 0, "jeder Kern hat ein Bild oder steht in der Ausnahmeliste", "ohne Bild: " + ohne.join(", "));
  const fremd = [...bilder.keys()].filter((k) => !kerne.includes(k));
  ok(fremd.length === 0, "kein Bild ohne Kern", "ohne Kern: " + fremd.join(", "));
} else {
  for (const a of AUSNAHMEN) ok(kerne.includes(a), "Ausnahme " + a + " ist ein Kern");
  ok(/const CORE_GEM =/.test(dt) && dt.includes(`(bild ? '<img src="'+bild+'" alt="" aria-hidden="true">' : CORE_GEM)`),
    "ohne Spielbilder: coreBadge zeichnet CORE_GEM, wo KERN_BILD kein Bild hat");
}

// ---- jedes Bild: WebP, 48 x 48, hoechstens 6 kB
function webpMasse(b) {
  if (b.length < 30 || b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WEBP") return null;
  if (b.readUInt32LE(4) + 8 !== b.length) return null;
  const f = b.toString("latin1", 12, 16);
  if (f === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (f === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const v = b.readUInt32LE(21);
    return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)];
  }
  if (f === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  return null;
}
for (const [name, b] of bilder) {
  const m = webpMasse(b);
  ok(!!m, name + ": gueltiger WebP-Kopf");
  ok(!!m && m[0] === 48 && m[1] === 48, name + ": 48 x 48", "Masse " + (m && m.join(" x ")));
  ok(b.length <= MAX_BYTES, name + ": hoechstens 6 kB", b.length + " Byte");
}

// Fallende Blume (Entscheidung 01.10.2026): die Waffen-Spezialisierung aller Waffen
// traegt ihr Symbol unter beiden Namen, ein 64x64-WebP wie die uebrigen
if (BILDER) {
  const fb = /^  "WM_Common_SKILL_009":"([A-Za-z0-9+/=]+)",$/m.exec(sb);
  ok(!!fb, "Fallende Blume: Symbol WM_Common_SKILL_009 in SKILL_ICON_BILD");
  const fbm = fb ? webpMasse(Buffer.from(fb[1], "base64")) : null;
  ok(!!fbm && fbm[0] === 64 && fbm[1] === 64, "Fallende Blume: 64 x 64", "Masse " + (fbm && fbm.join(" x ")));
} else {
  ok(!/^  "WM_Common_SKILL_009":/m.test(spielbilderText(root, "leer")), "ohne Spielbilder: kein Symbol fuer Fallende Blume im Quelltext");
}
ok(/^  "Falling Flower":"WM_Common_SKILL_009",$/m.test(ik) && /^  "Fallende Blume":"WM_Common_SKILL_009",$/m.test(ik),
  "Fallende Blume: englischer und deutscher Name zeigen auf das Symbol");

console.log(failed ? "\n" + failed + " FAILED" : "\nall ok");
process.exit(failed ? 1 : 0);
