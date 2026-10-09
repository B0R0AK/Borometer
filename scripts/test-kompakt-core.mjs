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
  eq(+(0.92 - (core.durchsichtWirksam(0, true) / 55) * 0.27).toFixed(3), 0.724, "Toenung im Durchklick 0,724");
}

// --- 4. restZeile (Spezifikation 8a)
{
  eq(core.restZeile([50, 30, 20], []), null, "nichts unter der Kante: keine Restzeile");
  eq(core.restZeile([60, 20, 10, 6, 4], [6, 4]), { n: 2, anteil: 0.1, schaden: 10 }, "zwei unten, 10 % des Schadens");
  eq(core.restZeile([0, 0], [0]), { n: 1, anteil: 0, schaden: 0 }, "ohne Schaden: Anteil 0, kein NaN");
}

// --- 5. Woerterbuch: die Texte des Streifens in beiden Sprachen (CLAUDE.md)
{
  const { I18N } = core;
  const SCHL = ["compact.imKampf", "compact.rest", "compact.restName", "compact.restNameGruppe", "compact.liveTitle"];
  const probe = { n: 9, p: "12\u00a0%", datei: "TLCombatLog-1.txt" };
  const text = (l, k) => { const v = I18N[l][k]; return typeof v === "function" ? v(probe) : v; };
  const leer = ["de", "en"].flatMap((l) => SCHL.filter((k) => { const s = text(l, k); return typeof s !== "string" || !s || /undefined|NaN/.test(s); })
    .map((k) => l + ":" + k));
  eq(leer, [], "jeder Text in DE und EN da und ohne Luecke");
  eq(text("de", "compact.imKampf"), "Kampf läuft", "DE: Kampf laeuft");
  eq(text("en", "compact.imKampf"), "Fight in progress", "EN: Fight in progress");
  eq(text("de", "compact.rest"), "+9 weitere \u00b7 12\u00a0%", "DE: Restzeile");
  eq(text("en", "compact.rest"), "+9 more \u00b7 12\u00a0%", "EN: Restzeile");
}

console.log();
if (failed) { console.log(`KOMPAKT CORE FAILED - ${failed}`); process.exit(1); }
console.log("KOMPAKT CORE PASSED");
