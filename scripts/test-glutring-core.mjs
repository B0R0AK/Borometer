// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Glutring ohne Seite (src/renderer/glutring-core.ts, Spezifikation
// docs/superpowers/specs/2026-10-02-glutring-design.md, Abschnitte 3, 4, 6, 7):
// Bogenwinkel, Treffer am Winkel, Ringgroesse, Trefferarten, die aufsummierte
// Zeitreihe und die Ranglisten im Rennen. esbuild buendelt den Kern allein -
// er importiert nichts -, Node fuehrt ihn aus. Nur Zahlen und erfundene
// Schluessel, keine Namen aus Logs.
//
// Run:  npm run test:glutring-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = await esbuild.build({
  stdin: {
    contents: 'export * from "./glutring-core"; export { I18N } from "./app/07-dictionary";',
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
function ok(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}
const nah = (a, b, tol = 1e-9) => typeof a === "number" && Math.abs(a - b) <= tol;
const OBEN = -Math.PI / 2;

// --- 1. Boegen: ab 12 Uhr im Uhrzeigersinn, nach Wert absteigend, mit Haarfuge (Spezifikation 3)
{
  const b = core.boegen([{ key: "c", wert: 10 }, { key: "a", wert: 60 }, { key: "b", wert: 30 }, { key: "null", wert: 0 }]);
  eq(b.map((x) => x.key), ["a", "b", "c"], "Boegen nach Wert absteigend, ohne Null");
  eq(b.map((x) => +x.anteil.toFixed(3)), [0.6, 0.3, 0.1], "Anteile");
  ok(nah(b[0].a0, OBEN + core.FUGE / 2), "der erste beginnt bei 12 Uhr (plus halbe Fuge)", b[0]);
  ok(b.every((x, i) => i === 0 || x.a0 > b[i - 1].a1), "zwischen zwei Boegen liegt eine Fuge", b);
  ok(nah(b[2].a1, OBEN + 2 * Math.PI - core.FUGE / 2), "der letzte endet vor 12 Uhr", b[2]);
  const w = core.boegen([{ key: "gross", wert: 1e6 }, { key: "winzig", wert: 1 }]);
  ok(w[1].a1 > w[1].a0, "ein winziger Bogen behaelt eine Breite (die Fuge ist hoechstens ein Fuenftel)", w[1]);
  eq(core.boegen([]), [], "nichts: keine Boegen");
  eq(core.boegen([{ key: "x", wert: 0 }]), [], "nur Null: keine Boegen");
  eq(core.boegen([{ key: "p", wert: 5 }, { key: "q", wert: 5 }]).map((x) => x.key), ["p", "q"], "Gleichstand: Reihenfolge der Eingabe");
  const t = core.boegen([{ key: "u", wert: 1 }, { key: "v", wert: 3 }], 0, Math.PI);
  ok(t[0].key === "v" && nah(t[0].a0, core.FUGE / 2) && nah(t[1].a1, Math.PI - core.FUGE / 2), "Teilring (Gruppe aussen) in seiner Spanne", t);
}
// --- 2. Treffer am Winkel (Zeigen und Klicken auf den Ring)
{
  const b = core.boegen([{ key: "a", wert: 3 }, { key: "b", wert: 1 }]);
  eq(core.bogenBei(b, OBEN + 0.1)?.key, "a", "kurz nach 12 Uhr: der erste");
  eq(core.bogenBei(b, 0)?.key, "a", "3 Uhr: noch im ersten (75 %)");
  eq(core.bogenBei(b, -3 * Math.PI / 4)?.key, "b", "halb elf: im zweiten, der Winkel wird gefaltet");
  eq(core.bogenBei(b, Math.PI), null, "in der Fuge: keiner");
  ok(nah(core.winkelNorm(-Math.PI), Math.PI) && nah(core.winkelNorm(3 * Math.PI / 2), OBEN), "winkelNorm faltet nach [-90 Grad, 270 Grad)");
}
// --- 3. Beschriftung ab 10 Grad
{
  const b = core.boegen([{ key: "a", wert: 94.5 }, { key: "zehn", wert: 2.8 }, { key: "neun", wert: 2.7 }]);
  eq(b.map((x) => core.mitSchrift(x)), [true, true, false], "Beschriftung ab 10 Grad (2,8 % ja, 2,7 % nein)");
}
// --- 4. Gleiten zwischen zwei Kaempfen (Spezifikation 3, Bewegung)
{
  const alt = core.boegen([{ key: "a", wert: 1 }, { key: "b", wert: 1 }]);
  const neu = core.boegen([{ key: "a", wert: 3 }, { key: "b", wert: 1 }, { key: "c", wert: 1 }]);
  const z0 = core.zwischen(alt, neu, 0), z1 = core.zwischen(alt, neu, 1), zh = core.zwischen(alt, neu, 0.5);
  ok(nah(z0[0].a0, alt[0].a0) && nah(z0[0].a1, alt[0].a1) && nah(z0[1].a1, alt[1].a1), "f = 0: die alten Winkel", z0);
  ok(nah(z0[2].a0, z0[2].a1), "f = 0: ein neuer Bogen hat noch keine Breite", z0[2]);
  ok(z1.every((x, i) => nah(x.a0, neu[i].a0) && nah(x.a1, neu[i].a1)), "f = 1: die neuen Winkel", z1);
  ok(nah(zh[0].a1, (alt[0].a1 + neu[0].a1) / 2), "f = 0,5: dazwischen", zh[0]);
  ok(core.zwischen(alt, neu, 2).every((x, i) => nah(x.a1, neu[i].a1)), "f ueber 1 zaehlt als 1");
}
// --- 5. Groesse (Spezifikation 3 und 7; E 7)
{
  eq(core.ringMass(876, 680, false), { d: 517, schrift: true }, "1280 x 860: etwa 520 Punkt, mit Beschriftung");
  eq(core.ringMass(1536, 1300, false), { d: 760, schrift: true }, "2000 x 1480: hoechstens 760");
  eq(core.ringMass(528, Infinity, true), { d: 460, schrift: false }, "gestapelt bei 560: 460, ohne Beschriftung");
  eq(core.ringMass(300, 300, false), { d: 280, schrift: false }, "nie kleiner als 280");
  eq(core.ringMass(296, Infinity, true), { d: 280, schrift: false }, "gestapelt schmal: 280");
}
// --- 6. Trefferarten (Spezifikation 4; E 5)
{
  const tr = [
    ...Array.from({ length: 5 }, (_, i) => ({ name: "S1", kat: "normal", dmg: 100 + i })),
    ...Array.from({ length: 3 }, () => ({ name: "S1", kat: "crit", dmg: 300 })),
    { name: "S1", kat: "critheavy", dmg: 900 },
    { name: "S2", kat: "shield", dmg: 50 }, { name: "S2", kat: "normal", dmg: 70 },
  ];
  const m = core.artenZaehlen(tr), s1 = m.get("S1");
  eq(s1.zeilen.map((z) => [z.kat, z.n, z.d]), [["normal", 5, 510], ["crit", 3, 900], ["heavy", 0, 0], ["critheavy", 1, 900]],
    "S1: die vier Arten in fester Reihenfolge, auch die leere");
  eq([s1.n, s1.d, s1.max, +s1.schnitt.toFixed(3)], [9, 2310, 900, +(2310 / 9).toFixed(3)], "S1: Treffer gesamt, Schaden, groesster, Schnitt");
  ok(nah(s1.zeilen.reduce((a, z) => a + z.anteil, 0), 1), "S1: die Anteile ergeben 1");
  eq(m.get("S2").zeilen.map((z) => z.kat), ["normal", "crit", "heavy", "critheavy", "shield"], "S2: Schild nur mit Schildtreffern, am Ende");
  const r = core.artenAusBericht([{ k: "crit", h: 8, d: 60000, m: 9000 }, { k: "normal", h: 10, d: 40000, m: 5000 }, { k: "anders", h: 1, d: 1, m: 1 }]);
  eq(r.zeilen.map((z) => [z.kat, z.n, z.d, z.max]), [["normal", 10, 40000, 5000], ["crit", 8, 60000, 9000], ["heavy", 0, 0, 0], ["critheavy", 0, 0, 0]],
    "aus dem Bericht der Gruppe: dieselben vier, Unbekanntes faellt weg");
  eq([r.n, r.d, r.max], [18, 100000, 9000], "aus dem Bericht: Summen");
  eq(core.artenAusBericht([]).n, 0, "leerer Bericht: null Treffer");
}
// --- 7. Zeitreihe und Rennen (Spezifikation 6)
{
  eq(core.aufsummiert([1, 0, 2, 3]), [1, 1, 3, 6], "aufsummiert");
  eq(core.aufsummiert([]), [], "aufsummiert: leer");
  const R = [{ key: "a", kum: core.aufsummiert([10, 0, 0, 0]) }, { key: "b", kum: core.aufsummiert([0, 6, 6, 6]) }];
  eq(core.rennStand(R, 0).map((p) => [p.key, p.wert, p.platz]), [["a", 0, 1], ["b", 0, 2]], "t = 0: alle bei null, Reihenfolge der Eingabe");
  eq(core.rennStand(R, 1).map((p) => [p.key, p.wert]), [["a", 10], ["b", 0]], "nach der ersten Sekunde");
  eq(core.rennStand(R, 2.5).map((p) => [p.key, p.wert]), [["a", 10], ["b", 9]], "t = 2,5: dazwischen gerechnet");
  eq(core.rennStand(R, 3).map((p) => p.key), ["b", "a"], "t = 3: b hat ueberholt");
  eq(core.rennStand(R, 99).map((p) => p.wert), [18, 10], "nach dem Ende: die Endstaende");
  eq(core.fuehrtSeit(R), 2, "b liegt seit 0:02 vorn");
  eq(core.fuehrtSeit([{ key: "x", kum: [5, 9] }, { key: "y", kum: [1, 2] }]), 0, "von Anfang an vorn: 0");
  eq(core.fuehrtSeit([]), 0, "ohne Bahnen: 0");
  ok(nah(core.rennSchritt(90, 1, 1000), 9) && nah(core.rennSchritt(90, 4, 1000), 36) && core.rennSchritt(90, 1, -5) === 0,
    "1x spielt 90 s in 10 s, 4x viermal so schnell, nie rueckwaerts");
  eq(core.wertBei([], 3), 0, "wertBei ohne Reihe: 0");
}
// --- 8. Farbe mit Deckkraft (Bogen von innen nach aussen kraeftiger)
{
  eq(core.farbeMitAlpha("#6baffa", 0.5), "rgba(107,175,250,0.5)", "#rrggbb");
  eq(core.farbeMitAlpha("#abc", 1), "rgba(170,187,204,1)", "#rgb");
  eq(core.farbeMitAlpha("rgb(1, 2, 3)", 0.2), "rgba(1,2,3,0.2)", "rgb()");
  eq(core.farbeMitAlpha("var(--x)", 0.2), "var(--x)", "Unbekanntes bleibt");
}

// --- 9. Woerterbuch: ring.* und rennen.* in beiden Sprachen mit denselben Schluesseln (CLAUDE.md)
{
  const { I18N } = core;
  const schl = (l) => Object.keys(I18N[l]).filter((k) => /^(ring|rennen)\./.test(k)).sort();
  eq(schl("de"), schl("en"), "ring.* und rennen.*: dieselben Schluessel in DE und EN");
  ok(schl("de").length >= 35, "die Texte des Glutrings sind da", schl("de").length);
  const probe = { n: "3", z: 3, p: "41\u00a0%", name: "X", dps: "1.2k", platz: 2, teile: "A 50\u00a0%", seit: "0:20", zweiter: "Y",
    wert: "9.0k", t: "0:42", T: "1:30", max: "4.0k", avg: "1.0k", d: "12.0k", krit: "41\u00a0%", klasse: "K" };
  const text = (l, k) => { const v = I18N[l][k]; return typeof v === "function" ? v(probe) : v; };
  const leer = ["de", "en"].flatMap((l) => schl(l).filter((k) => { const s = text(l, k); return typeof s !== "string" || !s || /undefined|NaN/.test(s); })
    .map((k) => l + ":" + k));
  eq(leer, [], "jeder Text ergibt einen Satz ohne Luecke");
  ok(!/\bBau\b/.test(schl("de").map((k) => text("de", k)).join(" ")), "im Deutschen \"Build\", nie \"Bau\"");
  eq(typeof I18N.en["ring.treffer"] === "function" ? I18N.en["ring.treffer"]({ n: "1", z: 1 }) : "", "1 hit", "Einzahl im Englischen");
}

console.log();
if (failed) { console.log(`GLUTRING CORE FAILED - ${failed}`); process.exit(1); }
console.log("GLUTRING CORE PASSED");
