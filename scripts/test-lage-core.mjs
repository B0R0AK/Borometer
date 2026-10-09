// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Fenster-Extras (Spezifikation 27.09.2026, Abschnitte 3.1 bis 3.4 und 7)
// ohne Fenster: der reine Kern src/main/lage.ts und die festen Tabellen in
// src/main/chrome.ts. Monitore sind Daten (Arbeitsbereiche in DIP), die Uhr
// des Merkers ist gestellt.
//
// Run:  npm run test:lage-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        got  " + a + "\n        want " + b); }
}
const built = await esbuild.build({
  stdin: { contents: 'export * from "./src/main/lage"; export { borderFor, themeSourceFor, materialFor, overlayFor } from "./src/main/chrome"; export { isFirstStart } from "./src/main/firststart";',
    resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const k = await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64"));

// Monitore: der Hauptmonitor (Taskleiste unten abgezogen), einer links mit
// negativen Koordinaten, einer rechts, hoeher und nach oben versetzt
const HAUPT = { x: 0, y: 0, width: 1920, height: 1040 };
const LINKS = { x: -1920, y: 0, width: 1920, height: 1040 };
const RECHTS = { x: 1920, y: -200, width: 2560, height: 1400 };
const G = { x: 120, y: 80, w: 1280, h: 860, max: false };

// --- 1. pruefen: nur ganze Zahlen in den Grenzen, nur die genannten Felder
eq(k.pruefen(G, "gross"), G, "gross gueltig");
eq(k.pruefen({ ...G, notiz: "x" }, "gross"), G, "fremdes Feld bleibt draussen");
eq(k.pruefen({ x: 1500, y: 40 }, "kompakt"), { x: 1500, y: 40 }, "kompakt gueltig");
eq(k.pruefen({ x: 1500, y: 40, w: 5 }, "kompakt"), { x: 1500, y: 40 }, "kompakt: nur x und y");
eq(k.pruefen({ x: 1500 }, "kompakt"), null, "kompakt ohne y");
const grenzen = [
  [{ x: -32000 }, true], [{ x: -32001 }, false], [{ y: 32000 }, true], [{ y: 32001 }, false],
  [{ w: 180 }, true], [{ w: 179 }, false], [{ w: 16000 }, true], [{ w: 16001 }, false],
  [{ h: 24 }, true], [{ h: 23 }, false], [{ h: 16000 }, true], [{ h: 16001 }, false],
];
for (const [aenderung, gilt] of grenzen) {
  const r = k.pruefen({ ...G, ...aenderung }, "gross");
  eq(r !== null, gilt, "Grenze " + JSON.stringify(aenderung));
}
const fremd = [
  ["x als Text", { ...G, x: "120" }], ["x mit Komma", { ...G, x: 1.5 }], ["x NaN", { ...G, x: NaN }],
  ["x unendlich", { ...G, x: Infinity }], ["max als Text", { ...G, max: "false" }], ["max fehlt", { x: 1, y: 2, w: 800, h: 600 }],
];
for (const [name, roh] of fremd) eq(k.pruefen(roh, "gross"), null, "fremder Typ: " + name);
for (const roh of [null, undefined, "x", 42, [], [1, 2, 3, 4]]) eq(k.pruefen(roh, "gross"), null, "keine Lage: " + JSON.stringify(roh));
eq(k.teilAus({ gross: G }, "gross"), G, "teilAus: der Teil");
eq(k.teilAus({ gross: G }, "kompakt"), undefined, "teilAus: fehlt");
eq(k.teilAus("kaputt", "gross"), undefined, "teilAus: kein Objekt");
eq(k.teilAus(Object.create({ gross: G }), "gross"), undefined, "teilAus: nur eigene Schluessel");

// --- 2. sichtbar: 64 x 64 der Titelleiste auf einem Monitor
eq(k.sichtbar(G, [HAUPT]), true, "ganz auf dem Hauptmonitor");
const aufRechts = { x: 2200, y: 100, w: 1600, h: 900 };
eq(k.sichtbar(aufRechts, [HAUPT, RECHTS]), true, "auf dem rechten Monitor");
eq(k.sichtbar(aufRechts, [HAUPT]), false, "rechter Monitor abgezogen");
eq(k.sichtbar({ ...G, y: 1000 }, [HAUPT]), false, "Titelleiste nur 40 px hoch sichtbar (unten)");
eq(k.sichtbar({ ...G, y: 976 }, [HAUPT]), true, "Titelleiste genau 64 px hoch sichtbar");
eq(k.sichtbar({ ...G, y: -30 }, [HAUPT]), false, "Titelleiste ueber dem oberen Rand, 34 px sichtbar");
eq(k.sichtbar({ ...G, x: 1857 }, [HAUPT]), false, "rechts nur 63 px breit sichtbar");
eq(k.sichtbar({ ...G, x: 1856 }, [HAUPT]), true, "rechts genau 64 px breit sichtbar");
const A = { x: 0, y: 0, width: 1920, height: 1040 }, B = { x: 1920, y: 0, width: 1920, height: 1040 };
eq(k.sichtbar({ x: 1890, y: 100, w: 60, h: 400 }, [A, B]), false, "zwei Monitore: 30 + 30 px, auf keinem 64");
eq(k.sichtbar({ x: 1800, y: 100, w: 1280, h: 860 }, [A, B]), true, "zwei Monitore: ueber die Kante, links 120 px");
eq(k.sichtbar({ x: -1500, y: 100, w: 800, h: 600 }, [HAUPT, LINKS]), true, "negativer Monitor links");
eq(k.sichtbar({ x: -1500, y: 100, w: 800, h: 600 }, [HAUPT]), false, "negativer Monitor abgezogen");
eq(k.sichtbar({ x: 100, y: 1016, w: 180, h: 24 }, [HAUPT]), true, "Streifen 24 hoch, ganz sichtbar");
eq(k.sichtbar({ x: 100, y: 1017, w: 180, h: 24 }, [HAUPT]), false, "Streifen, eine Zeile abgeschnitten");
eq(k.sichtbar(G, []), false, "kein Monitor");

// --- 3. rueckfall: Mitte des Hauptmonitors, hoechstens so gross wie er
eq(k.rueckfall({ w: 1280, h: 860 }, HAUPT), { x: 320, y: 90, w: 1280, h: 860 }, "Mitte");
eq(k.rueckfall({ w: 2560, h: 1400 }, HAUPT), { x: 0, y: 0, w: 1920, h: 1040 }, "Groesse gekappt");
eq(k.rueckfall({ w: 1000, h: 500 }, { x: 0, y: 40, width: 1920, height: 1000 }), { x: 460, y: 290, w: 1000, h: 500 },
  "Taskleiste oben: Mitte des Arbeitsbereichs");

// --- 4. platzGross und platzKompakt
eq(k.platzGross(G, [HAUPT], HAUPT), G, "gross: die gemerkte Lage");
const maxRechts = { x: 2000, y: 50, w: 1400, h: 900, max: true };
eq(k.platzGross(maxRechts, [HAUPT, RECHTS], HAUPT), maxRechts, "maximiert auf dem anderen Monitor: bleibt dort");
eq(k.platzGross(maxRechts, [HAUPT], HAUPT), { x: 260, y: 70, w: 1400, h: 900, max: true },
  "maximiert, Monitor abgezogen: Mitte des Hauptmonitors, weiter maximiert");
eq(k.platzGross({ x: 2200, y: 100, w: 2560, h: 1400, max: false }, [HAUPT], HAUPT), { x: 0, y: 0, w: 1920, h: 1040, max: false },
  "abgezogen und groesser als der Hauptmonitor: gekappt");
eq(k.platzGross(G, [], null), null, "kein Monitor meldet sich: Standard");
eq(k.platzGross(undefined, [HAUPT], HAUPT), null, "nichts gemerkt: Standard");
eq(k.platzGross({ ...G, w: 100 }, [HAUPT], HAUPT), null, "ungueltig: Standard");
eq(k.platzKompakt(undefined, [HAUPT], HAUPT), null, "kompakt ohne Lage: bleibt, wo es ist");
eq(k.platzKompakt({ x: 1500, y: 40 }, [HAUPT], HAUPT), { x: 1500, y: 40 }, "kompakt: die gemerkte Ecke");
eq(k.platzKompakt({ x: 2500, y: 40 }, [HAUPT], HAUPT), { x: 870, y: 508 }, "kompakt, Monitor abgezogen: Mitte");
eq(k.platzKompakt({ x: 1800, y: 40 }, [HAUPT], HAUPT), { x: 1800, y: 40 }, "kompakt am rechten Rand, 120 px sichtbar");

// --- 5. fensterNeu: was geschrieben wird
eq(k.fensterNeu(undefined, "gross", G), { gross: G }, "erste Lage");
eq(k.fensterNeu({ kompakt: { x: 1, y: 2 } }, "gross", G), { kompakt: { x: 1, y: 2 }, gross: G }, "der andere Teil bleibt");
eq(k.fensterNeu({ kompakt: "kaputt", notiz: 7 }, "gross", G), { kompakt: "kaputt", notiz: 7, gross: G },
  "kaputter Teil und fremder Schluessel bleiben stehen (nie loeschen)");
eq(k.fensterNeu("fremd", "gross", G), null, "fenster ist kein Objekt: nichts schreiben");
eq(k.fensterNeu([], "gross", G), null, "fenster ist eine Liste: nichts schreiben");
eq(k.fensterNeu(undefined, "gross", { ...G, w: 100 }), null, "ungueltige Lage: nichts schreiben");
eq(k.fensterNeu(undefined, "gross", { ...G, max: "ja" }), null, "max kein Boolean: nichts schreiben");
eq(k.fensterNeu(undefined, "kompakt", { x: 5, y: 6, w: 400, h: 28, max: false }), { kompakt: { x: 5, y: 6 } }, "kompakt: nur die Ecke");
const einmal = k.fensterNeu(undefined, "gross", G);
eq(JSON.stringify(k.fensterNeu(einmal, "gross", G)), JSON.stringify(einmal), "dieselbe Lage noch einmal: derselbe Text (updateConfig schreibt nicht)");

// --- 6. der Merker: 500 ms nach dem letzten Ereignis, jetzt() vor dem Wechsel
function gestellteUhr() {
  let jetzt = 0, naechste = 1;
  const offen = new Map();
  return {
    stelle(fn, ms) { const id = naechste++; offen.set(id, { fn, bei: jetzt + ms }); return id; },
    loesche(id) { offen.delete(id); },
    vor(ms) {
      const ziel = jetzt + ms;
      for (;;) {
        const f = [...offen.entries()].filter(([, t]) => t.bei <= ziel).sort((a, b) => a[1].bei - b[1].bei)[0];
        if (!f) break;
        offen.delete(f[0]); jetzt = f[1].bei; f[1].fn();
      }
      jetzt = ziel;
    },
  };
}
{
  const uhr = gestellteUhr(), geschrieben = [];
  const m = k.neuerMerker(() => geschrieben.push("x"), uhr);
  for (let i = 0; i < 20; i++) { m.ereignis(); uhr.vor(100); }
  eq(geschrieben.length, 0, "20 Bewegungen im Abstand von 100 ms: noch nichts geschrieben");
  uhr.vor(399);
  eq(geschrieben.length, 0, "499 ms nach der letzten: noch nichts");
  uhr.vor(1);
  eq(geschrieben.length, 1, "500 ms nach der letzten: einmal geschrieben");
  uhr.vor(5000);
  eq(geschrieben.length, 1, "danach nichts mehr");
  m.jetzt();
  eq(geschrieben.length, 1, "jetzt() ohne Wartendes schreibt nichts");
  m.ereignis(); m.halt(); uhr.vor(1000);
  eq(geschrieben.length, 1, "halt() verwirft das Wartende");
}
{
  // Wechsel gross -> kompakt mit einem wartenden Merken: jetzt() schreibt
  // es noch unter dem alten Teil, erst danach wechselt der Teil
  const uhr = gestellteUhr(), geschrieben = [];
  let teil = "gross";
  const m = k.neuerMerker(() => geschrieben.push(teil), uhr);
  m.ereignis(); uhr.vor(200);
  m.jetzt(); teil = "kompakt";
  m.ereignis(); uhr.vor(500);
  m.ereignis(); uhr.vor(100); m.jetzt(); teil = "gross";
  uhr.vor(2000);
  eq(geschrieben, ["gross", "kompakt", "kompakt"], "Wechsel waehrend des Wartens: jeder Teil bekommt seine Lage");
}

// --- 7. Tabellen in chrome.ts
eq([k.borderFor("dark"), k.borderFor("light"), k.borderFor("tnl"), k.borderFor("glas")], ["#242525", "#abb9b8", "#3a2744", "#3c3b3a"], "Randfarbe je Thema");
eq(["dark", "light", "tnl", "glas"].every((t) => /^#[0-9a-f]{6}$/.test(k.borderFor(t))), true, "jede Randfarbe deckend (#rrggbb, ohne Alpha)");
eq(["constructor", "toString", "auto", "", undefined, 42].map((t) => k.borderFor(t)), Array(6).fill("#242525"),
  "unbekanntes Thema: dark");
eq(k.overlayFor("glas").symbolColor, "#bdb4a7", "Systemknoepfe in Rauchglas: --dim des Themas");
eq(k.overlayFor("glas").color, "#00000000", "Systemknoepfe in Rauchglas: durchsichtiger Grund wie ueberall");
eq([k.themeSourceFor("light", "light"), k.themeSourceFor("dark", "dark"), k.themeSourceFor("tnl", "tnl"), k.themeSourceFor("glas", "glas")],
  ["light", "dark", "dark", "dark"], "themeSource: hell light, dunkel, tnl und Rauchglas dark (dunkles Mica)");
eq([k.themeSourceFor("light", "auto"), k.themeSourceFor("dark", "auto")], ["system", "system"], "Einstellung auto: system");
eq([k.themeSourceFor("constructor", undefined), k.themeSourceFor(undefined, null)], ["dark", "dark"], "unbekannt: dark");
eq([k.materialFor(true, false, "dark"), k.materialFor(true, true, "dark"), k.materialFor(false, false, "dark"), k.materialFor(false, true, "dark")],
  ["acrylic", "none", "none", "none"], "Acrylic nur in Kompakt und nur ohne reduzierte Transparenz");
eq([k.materialFor(false, false, "glas"), k.materialFor(false, true, "glas"), k.materialFor(true, false, "glas"), k.materialFor(true, true, "glas")],
  ["acrylic", "none", "acrylic", "none"], "Rauchglas: Acrylic im grossen Fenster wie im Kompakt, ohne Transparenz nichts (#189)");
eq(["dark", "light", "tnl", "auto", "constructor", "toString", "", undefined, null, 42, "Glas", "glas ", "mica", "acrylic"].map((t) => k.materialFor(false, false, t)),
  Array(14).fill("none"), "grosses Fenster ohne Rauchglas (auch feindliche Namen): kein Material");
/* #189: Mica zeigt nur das verwischte Hintergrundbild, nie die Fenster
   dahinter, und ein inaktives Fenster bekommt statt Mica die feste Farbe -
   auf einem einfarbigen Desktop und neben dem Spiel also immer nur Grau. Kein
   Thema und kein Zustand fuehrt mehr auf Mica. */
eq([true, false].flatMap((c) => [true, false].flatMap((r) => ["dark", "light", "tnl", "glas", "mica"].map((t) => k.materialFor(c, r, t))))
  .filter((m) => m !== "acrylic" && m !== "none"), [], "materialFor kennt nur acrylic und none, nie mica (#189)");

// Der erste Start (Spezifikation Rundgang 2, Pruefung M6): src/main/firststart.ts.
// Die Schluessel, die ein Mensch setzt, wie server.ts sie nennt (gekuerzt um
// nichts: die Seitenschluessel ohne themeResolved und rundgangGesehen, dazu
// log_dir, partyServer, stayOnTop).
const PERSON = ["weaponOf", "weaponById", "mainWeapon", "offWeapon", "weaponPick", "runs", "splitAfter", "gap", "minDur", "ghost",
  "uiZoom", "devMode", "skillNames", "ventiusTop", "compactAlpha", "mergePhases", "theme", "logIndex", "randlosGesehen",
  "log_dir", "partyServer", "stayOnTop"];
const ERST = [
  ["neue Installation: keine Einstellungen", {}, true],
  ["neue Installation: nur das aufgeloeste Thema, die Fensterlage und ein halber Rundgang", { themeResolved: "dark", fenster: { gross: {} }, rundgangGesehen: false }, true],
  ["neue Installation: leere Karten zaehlen nicht", { logIndex: {}, runs: [], weaponOf: {}, mainWeapon: "" }, true],
  ["Update: nur ein Log-Ordner", { log_dir: "C:\Spiele\TL\CombatLogs" }, false],
  ["Update: nur ein Thema gewaehlt", { theme: "light" }, false],
  ["Update: gespeicherte Laeufe, kein Bosskampf im Verlauf", { runs: [{ name: "x" }], logIndex: {} }, false],
  ["Update: ein Verlauf", { logIndex: { "TLCombatLog-20260920.txt": { size: 1, fights: [{ at: 1 }] } } }, false],
  ["Update: Kompakt schon benutzt (randlosGesehen)", { randlosGesehen: true }, false],
  ["Update: ein Gruppen-Server", { partyServer: "203.0.113.5:8732" }, false],
  ["Update: Waffen von Hand zugeordnet", { weaponOf: { "Quick Fire": "Crossbow" } }, false],
  ["Update: Groesse eingestellt", { uiZoom: 120 }, false],
  ["Update: Ueber dem Spiel gehalten, auch false", { stayOnTop: false }, false],
  ["Update: Durchsicht 0", { compactAlpha: 0 }, false],
];
for (const [name, cfg, soll] of ERST) eq(k.isFirstStart(cfg, PERSON), soll, "erster Start - " + name);

if (failed) { console.log(`LAGE CORE FAILED - ${failed}`); process.exit(1); }
console.log("LAGE CORE PASSED");
