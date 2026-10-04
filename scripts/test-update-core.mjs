// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Update-Hinweis (src/main/update.ts, Spezifikation
// docs/superpowers/specs/2026-10-02-update-hinweis-design.md, Abschnitt 5):
// checkUpdate ohne echtes Netz. Einmal mit gestelltem net (Antworten als
// Response), einmal ueber den eigenen Weg (realNet) mit gestelltem fetch -
// dort wird mitgeschrieben, welche Adresse und welche Optionen die Anfrage
// bekommt. Keine Anfrage verlaesst den Rechner.
//
// Run:  npm run test:update-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = await esbuild.build({ entryPoints: [join(root, "src", "main", "update.ts")], bundle: true, format: "esm",
  platform: "node", write: false, logLevel: "silent" });
const u = await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64"));

let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        bekommen " + a + "\n        erwartet " + b); }
}

const API = "https://api.github.com/repos/B0R0AK/Borometer/releases/latest";
const SEITE = "https://github.com/B0R0AK/Borometer/releases/tag/";
const release = (tag, url = SEITE + tag, mehr = {}) => JSON.stringify({ tag_name: tag, html_url: url, ...mehr });
const antwort = (body, status = 200) => async () => new Response(body, { status });
const pruefe = (body, current = "1.8.0", status = 200) => u.checkUpdate(current, antwort(body, status));

// --- Versionen: nur eine groessere ergibt einen Hinweis
eq(await pruefe(release("v1.9.0")), { version: "1.9", url: SEITE + "v1.9.0" }, "neuere Version v1.9.0: Hinweis 1.9 mit der Release-Seite");
eq(await pruefe(release("v1.9")), { version: "1.9", url: SEITE + "v1.9" }, "neuere Version v1.9 (so heissen die Tags): Hinweis");
eq(await pruefe(release("1.8.1")), { version: "1.8.1", url: SEITE + "1.8.1" }, "neuere Version ohne v, mit Patch: Hinweis 1.8.1");
eq(await pruefe(release("v2.0")), { version: "2.0", url: SEITE + "v2.0" }, "neuere Hauptversion: Hinweis");
eq(await pruefe(release("v1.10.0"), "1.9.0"), { version: "1.10", url: SEITE + "v1.10.0" }, "1.10 ist neuer als 1.9 (Zahl, nicht Text)");
eq(await pruefe(release("v1.8")), null, "gleiche Version (v1.8 gegen 1.8.0): kein Hinweis");
eq(await pruefe(release("v1.8.0")), null, "gleiche Version (v1.8.0): kein Hinweis");
eq(await pruefe(release("v1.7.9")), null, "aeltere Version: kein Hinweis");
eq(await pruefe(release("v0.99")), null, "viel aeltere Version: kein Hinweis");
eq(await pruefe(release("v1.9.0"), "kaputt"), null, "eigene Version nicht lesbar: kein Hinweis");

// --- kaputte Nummern und Vorabversionen
for (const tag of ["v1.9.0-beta", "1.9.0.1", "v1", "V1.9", "v1.9 ", "v01.9.x", "v1234.0", "", "latest", "v1.9\n",
  "v１.９", "v1..9", "v1.9/../../x", "v1.9#x", "\nv1.9", "v1.9\nv2.0"])
  eq(await pruefe(release(tag)), null, "Tag " + JSON.stringify(tag) + ": kein Hinweis");
eq(await pruefe(JSON.stringify({ tag_name: 1.9, html_url: SEITE + "1.9" })), null, "tag_name als Zahl: kein Hinweis");

// --- html_url muss genau die Release-Seite des Tags sein
for (const [url, wie] of [
  ["https://github.com/someone/Borometer/releases/tag/v1.9", "anderer Besitzer"],
  ["https://github.com/B0R0AK/Borometer/releases/download/v1.9", "anderer Pfad"],
  ["http://github.com/B0R0AK/Borometer/releases/tag/v1.9", "http:"],
  ["https://github.com/B0R0AK/Borometer/releases/tag/v1.9.0", "anderer Tag"],
  ["https://github.com/B0R0AK/Borometer/releases/tag/v1.9?x=1", "mit Anhang"],
  ["https://evil.example/B0R0AK/Borometer/releases/tag/v1.9", "fremder Host"],
  // zusammengesetzt: der alte Name steht in keiner exportierten Datei (export-regeln.mjs)
  ["https://github.com/B0R0AK/Borometer" + "-Rework/releases/tag/v1.9", "altes privates Repo"],
  [null, "leer"],
  // Sicherheitspruefung N1: Tricks, die heute am strengen Vergleich scheitern
  ["HTTPS://GITHUB.COM/B0R0AK/Borometer/releases/tag/v1.9", "gross geschrieben"],
  [SEITE + "v1.9#x", "mit Fragment"],
  [SEITE + "v1.9@evil.example", "mit @ hinter dem Tag"],
  ["https://github.com@evil.example/B0R0AK/Borometer/releases/tag/v1.9", "github.com als Benutzername vor fremdem Host"],
  [SEITE + "v1.9/../../x", "Pfad mit .. hinter dem Tag"]])
  eq(await pruefe(release("v1.9", url)), null, "html_url " + wie + ": kein Hinweis");
eq(await pruefe(JSON.stringify({ tag_name: "v1.9" })), null, "html_url fehlt: kein Hinweis");

// --- nur die zwei Felder: alles andere kommt nicht heraus
eq(await pruefe(release("v1.9", SEITE + "v1.9", { body: "<script>", assets: [{ browser_download_url: "https://x" }], name: "Release" })),
  { version: "1.9", url: SEITE + "v1.9" }, "Beschreibung, Dateien und Name werden nicht weitergegeben");

// --- Antworten, die keine sind: null
eq(await pruefe("{kaputt"), null, "kaputtes JSON: null");
eq(await pruefe("[]"), null, "JSON-Liste statt Objekt: null");
eq(await pruefe("null"), null, "JSON null: null");
eq(await pruefe(""), null, "leerer Koerper: null");
for (const status of [404, 403, 429, 500, 301])
  eq(await pruefe(release("v1.9"), "1.8.0", status), null, "Status " + status + ": null");
// zu gross: 300 KB, in Stuecken, und ein gueltiger Release ganz vorn
{
  const kopf = release("v1.9").slice(0, -1) + ', "fill": "';
  const stuecke = [kopf, "x".repeat(150 * 1024), "x".repeat(150 * 1024), '"}'];
  let gelesen = 0, abgebrochen = false;
  const strom = new ReadableStream({
    pull(c) { if (gelesen < stuecke.length) c.enqueue(new TextEncoder().encode(stuecke[gelesen++])); else c.close(); },
    cancel() { abgebrochen = true; },
  }, { highWaterMark: 0 });
  eq(await u.checkUpdate("1.8.0", async () => new Response(strom)), null, "300 KB Koerper: null");
  eq([abgebrochen, gelesen < stuecke.length], [true, true], "zu gross: das Lesen bricht ab, bevor der Rest kommt");
  // knapp darunter geht noch
  const knapp = release("v1.9", SEITE + "v1.9", { fill: "x".repeat(255 * 1024) });
  eq(await pruefe(knapp), { version: "1.9", url: SEITE + "v1.9" }, "255 KB Koerper: wird gelesen");
}
// kein Netz, Weiterleitung, Zeitablauf: net wirft
eq(await u.checkUpdate("1.8.0", async () => { throw new TypeError("fetch failed"); }), null, "kein Netz: null");
eq(await u.checkUpdate("1.8.0", async () => { throw new TypeError("unexpected redirect"); }), null, "Weiterleitung: null");
eq(await u.checkUpdate("1.8.0", async () => new Response(null, { status: 200 })), null, "200 ohne Koerper: null");

// --- der eigene Weg: realNet ruft fetch genau so (gestelltes fetch)
const echt = globalThis.fetch;
const anfragen = [];
let verhalten = "gut";
globalThis.fetch = async (url, init) => {
  anfragen.push({ url, init });
  if (verhalten === "umleiten") {
    // wie undici: bei redirect "error" bricht eine Weiterleitung ab
    if (init.redirect === "error") throw new TypeError("unexpected redirect");
    return new Response(release("v9.9"), { status: 200 });
  }
  if (verhalten === "haengt") {
    // antwortet nie; nur das Signal beendet die Anfrage
    return new Promise((_, nein) => init.signal.addEventListener("abort", () => nein(init.signal.reason)));
  }
  if (verhalten === "tropft") {
    // die Kopfzeilen kommen, der Koerper stockt: das Signal bricht auch ihn ab
    const strom = new ReadableStream({ start(c) {
      c.enqueue(new TextEncoder().encode('{"tag_name":"v1.9",'));
      init.signal.addEventListener("abort", () => c.error(init.signal.reason));
    } });
    return new Response(strom, { status: 200 });
  }
  return new Response(release("v1.9"), { status: 200 });
};
try {
  eq(await u.checkUpdate("1.8.0"), { version: "1.9", url: SEITE + "v1.9" }, "realNet: neuere Version ueber das gestellte fetch");
  const a = anfragen[0];
  eq(anfragen.length, 1, "realNet: genau eine Anfrage");
  eq(a.url, API, "realNet: genau die feste Adresse");
  const opts = Object.keys(a.init).sort();
  eq(opts, ["credentials", "headers", "method", "redirect", "signal"], "realNet: genau diese Optionen, keine weiteren");
  eq([a.init.method, a.init.credentials, a.init.redirect], ["GET", "omit", "error"], "realNet: GET, ohne Cookies, Weiterleitung bricht ab");
  eq(a.init.headers, { Accept: "application/vnd.github+json" }, "realNet: als einziger eigener Kopf Accept");
  eq(a.init.signal instanceof AbortSignal && !a.init.signal.aborted, true, "realNet: mit Zeitgrenze (AbortSignal)");
  verhalten = "umleiten";
  eq(await u.checkUpdate("1.8.0"), null, "realNet: eine Weiterleitung ergibt null, gefolgt wird nicht");
  // Zeitgrenze: beide Faelle gleichzeitig, 5 s
  verhalten = "haengt";
  const t0 = Date.now();
  const haengt = u.checkUpdate("1.8.0");
  verhalten = "tropft";
  const tropft = u.checkUpdate("1.8.0");
  // AbortSignal.timeout haelt Node nicht wach (in der App laeuft ohnehin alles weiter)
  const wach = setInterval(() => {}, 250);
  const [h, tr] = await Promise.all([haengt, tropft]);
  clearInterval(wach);
  const dauer = Date.now() - t0;
  eq(h, null, "Zeitgrenze: eine Antwort, die nicht kommt, ergibt null");
  eq(tr, null, "Zeitgrenze: ein Koerper, der stockt, ergibt null");
  eq(dauer >= 4900 && dauer < 7000, true, "Zeitgrenze: nach etwa 5 s (" + dauer + " ms)");
  eq(anfragen.length, 4, "jede Pruefung fragt genau einmal, nichts wird wiederholt");
} finally {
  globalThis.fetch = echt;
}

// --- der Start (Sicherheitspruefung M3): src/main/main.ts, wie es ist, mit gestelltem Electron, Server,
//     Fenster, Kuerzel und Taskleiste; echt sind config.ts, paths.ts und update.ts, die Einstellungsdatei liegt
//     in einem Temp-Ordner. fetch ist gestellt und zaehlt: ausgeschaltet keine Anfrage, eingeschaltet genau eine.
{
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const ordner = mkdtempSync(join(tmpdir(), "boro-update-start-"));
  const altAppdata = process.env.APPDATA;
  process.env.APPDATA = ordner;
  const STUBS = {
    electron: "export const app = { isPackaged: false, getAppPath: () => process.env.APPDATA, getPath: () => process.env.APPDATA,"
      + " setPath() {}, setName() {}, setAppUserModelId() {}, requestSingleInstanceLock: () => true, on() {},"
      + " whenReady: () => Promise.resolve(), getVersion: () => \"1.8.0\", quit() {}, exit() {} };"
      + " export const Menu = { setApplicationMenu() {} }; export const dialog = { showErrorBox() {} };",
    "./server": "export async function startServer() { return 8731; } export function logDir() { return \"\"; }"
      + " export function setUpdate(u) { globalThis.__boroStart.gesetzt.push(u); }",
    "./window": "export function createWindow() { globalThis.__boroStart.fenster++; return { once() {}, on() {}, focus() {} }; }"
      + " export function currentWindow() { return null; } export function iconFile() { return \"\"; }",
    "./hotkey": "export const HOTKEY = \"Control+Shift+D\"; export function registerHotkey() { return true; } export function unregisterHotkey() {}",
    "./taskbar": "export function setupTaskbar() {}",
  };
  const gestellt = { name: "gestellt", setup(b) {
    b.onResolve({ filter: /^(electron|\.\/(server|window|hotkey|taskbar))$/ }, (a) => ({ path: a.path, namespace: "gestellt" }));
    b.onLoad({ filter: /.*/, namespace: "gestellt" }, (a) => ({ loader: "js", contents: STUBS[a.path] }));
  } };
  const start = await esbuild.build({ entryPoints: [join(root, "src", "main", "main.ts")], bundle: true, format: "esm",
    platform: "node", write: false, logLevel: "silent", plugins: [gestellt] });
  const code = start.outputFiles[0].text;
  const echt = globalThis.fetch, log = console.log;
  let lauf = 0;
  const starte = async (config) => {
    mkdirSync(join(ordner, "Borometer"), { recursive: true });
    const datei = join(ordner, "Borometer", "boro-config.json");
    rmSync(datei, { force: true });
    if (config !== undefined) writeFileSync(datei, JSON.stringify(config));
    const s = globalThis.__boroStart = { fenster: 0, gesetzt: [], anfragen: [] };
    globalThis.fetch = async (url, init) => { s.anfragen.push({ url, init }); return new Response(release("v9.9"), { status: 200 }); };
    console.log = () => {};
    try {
      // jedes Mal ein frisches Modul: der Start laeuft wie bei einem neuen Programmstart
      await import("data:text/javascript;base64," + Buffer.from(code + "\n// lauf " + (++lauf)).toString("base64"));
      // createWindow kommt nach der Zeile des Update-Hinweises: bis dahin ist die Anfrage gestellt oder nicht
      for (let i = 0; i < 100 && !s.fenster; i++) await new Promise((r) => setTimeout(r, 10));
      for (let i = 0; i < 50 && s.anfragen.length && !s.gesetzt.length; i++) await new Promise((r) => setTimeout(r, 10));
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      console.log = log;
      globalThis.fetch = echt;
    }
    return s;
  };
  try {
    for (const [config, wie] of [[undefined, "ohne Einstellungsdatei"], [{}, "ohne Schluessel"], [{ updatePruefen: false }, "updatePruefen false"],
      [{ updatePruefen: "true" }, "updatePruefen \"true\" (Text)"], [{ updatePruefen: 1 }, "updatePruefen 1"]]) {
      const s = await starte(config);
      eq([s.fenster, s.anfragen.length, s.gesetzt.length], [1, 0, 0], "Start " + wie + ": keine Anfrage, nichts gesetzt");
    }
    const an = await starte({ updatePruefen: true });
    eq([an.fenster, an.anfragen.length, an.anfragen[0]?.url], [1, 1, API], "Start mit updatePruefen true: genau eine Anfrage an die feste Adresse");
    eq(an.gesetzt, [{ version: "9.9", url: SEITE + "v9.9" }], "Start mit updatePruefen true: das Ergebnis geht einmal an setUpdate");
  } finally {
    process.env.APPDATA = altAppdata;
    rmSync(ordner, { recursive: true, force: true });
  }
}

if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall update core tests passed");
