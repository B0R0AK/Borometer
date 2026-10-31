// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Abschnitt "Charaktere" der Einstellungen an der gebauten Seite (Twinks #251,
// Spezifikation docs/superpowers/specs/2026-10-15-twinks-design.md Abschnitt 8,
// Plan Schritt 1 Aufgabe 4): die aktiven Charaktere der Weeklies mit Logname und
// Main, Rueckgaengig fuer den Main, Hinzufuegen mit seinen Saetzen, Deutsch und
// Englisch, 560 Punkt und 2000 x 1480, vier Themen, Tastatur, der Satz ohne Route
// (Datei-Modus) und die Kennung des Charakters (ch, zv) im Verlauf - ohne Namen.
//
// Kein Server: die Seite kommt vom gestellten Helfer (page.route), der
// /api/weeklies wie src/main/weeklies.ts beantwortet - jeder gesendete Stand
// geht durch das echte checkWeeklies() (gebuendelt mit einem gestellten
// electron wie in test-weeklies-page.mjs). Namen sind erfunden.
// Gewartet wird auf Zustaende, nie auf eine feste Zeit (#224).
//
// Run:  npm run test:charaktere-page     (baut die Seite zuerst)
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import * as esbuild from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 700))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const DATEI = "file:///" + join(root, "dist", "renderer", "index.html").replace(/\\/g, "/").replace(/^\/+/, "");

/* Der echte Speicher (weeklies.ts), ohne Electron: paths.ts haengt an electron. */
const ordner = mkdtempSync(join(tmpdir(), "boro-chpage-"));
process.env.APPDATA = ordner;
mkdirSync(join(ordner, "Borometer"), { recursive: true });
const electron = { name: "electron", setup(b) {
  b.onResolve({ filter: /^electron$/ }, () => ({ path: "electron", namespace: "gestellt" }));
  b.onLoad({ filter: /.*/, namespace: "gestellt" }, () => ({ loader: "js",
    contents: "export const app = { isPackaged: false, getAppPath: () => process.env.APPDATA, getPath: () => process.env.APPDATA };" }));
} };
const bundle = async (entry, plugins = []) => {
  const b = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root)), ...plugins] });
  return import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));
};
const wk = await bundle("src/main/weeklies.ts", [electron]);
const dictMod = await esbuild.build({ stdin: { contents: 'export { I18N } from "./src/renderer/app/07-dictionary";', resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
const { I18N } = await import("data:text/javascript;base64," + Buffer.from(dictMod.outputFiles[0].text).toString("base64"));
const DE = I18N.de, EN = I18N.en;
const CH_KEYS = Object.keys(DE).filter((k) => k.startsWith("ch.") || k === "einst.g.charaktere");

/* Ein kleiner Kampflog in der Form, die das Spiel schreibt (wie test-best-page.mjs): ein Angreifer, Vulcanus, 75 s. */
const SKILLS = [["Detonation Mark", 953174691], ["Quick Fire", 964762401], ["Strafing", 945674044], ["Decisive Sniping", 964581976]];
const two = (n, w = 2) => String(n).padStart(w, "0");
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-` +
         `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`;
};
const arbeit = mkdtempSync(join(tmpdir(), "boro-chlog-"));
function kampflog(name, wer) {
  const start = Date.UTC(2026, 9, 14, 21, 0, 0), zeilen = ["CombatLogVersion,4"];
  for (let k = 0; k * 500 < 75000; k++) {
    const [skill, sid] = SKILLS[k % SKILLS.length];
    zeilen.push(`${stamp(start + k * 500)},DamageDone,${skill},${sid},${1000 * (1 + (k % 5))},0,0,kNormalHit,${wer},Vulcanus`);
  }
  const p = join(arbeit, name);
  writeFileSync(p, zeilen.join("\n") + "\n");
  return p;
}

const VERZUG = Number(process.env.BORO_TEST_VERZUG || 0);
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

const profil = (id, name, mehr = {}) => ({ id, name, ...mehr, zaehler: {}, aus: [], namen: {}, eigene: [] });
/* alle erfundenen Namen der Proben: keiner darf je in einem POST /api/config stehen */
const NAMEN = ["Tessa", "Brann", "Ilka", "Mira"];
// Stand der Probe: Tessa (Main, Logname Tessa) und Brann (ohne Logname)
const STAND = { v: 1, profile: [profil("wtest00001", "Tessa", { log: "Tessa", main: true }), profil("wtest00002", "Brann")] };
const SECHS = { v: 1, profile: [profil("wtest00001", "Tessa", { log: "Tessa", main: true }), profil("wtest00002", "Brann"),
  profil("wtest00003", "Ilka"), profil("wtest00004", "Mira"), profil("wtest00005", "Tessa Zwei"), profil("wtest00006", "Brann Zwei")] };

/* Der gestellte Helfer: lager.data ist die Datei, lager.posts die gesendeten Staende, s.config die Texte von POST /api/config. */
/* halten: GET /api/weeklies antwortet erst, wenn halten.los() gerufen ist (Probe 11); config: was GET /api/config liefert */
async function oeffne({ lang = "de", breite = 1280, hoehe = 860, stand = STAND, datei = false, halten = null, config = { rundgangGesehen: true } } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const lager = { data: structuredClone(stand), posts: [], fertig: 0, abgelehnt: [] };
  const s = { page, fehler: [], lager, config: [] };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  if (datei) {
    await page.goto(DATEI);
    await page.waitForFunction(() => !!document.querySelector('#bereiche [data-tab="settings"]'));
    return s;
  }
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), path = new URL(req.url()).pathname;
    // BORO_TEST_VERZUG (nur zur Nachstellung von Last, #224): jede Antwort kommt zufaellig bis zu so viele ms spaeter; ohne den Wert aendert sich nichts
    // (POST /api/config merkt sich zuerst und verzoegert erst die Antwort: so bleibt die Reihenfolge, in der die Seite sendet)
    if (VERZUG && path !== "/api/events" && !(path === "/api/config" && req.method() === "POST")) await new Promise((r) => setTimeout(r, Math.random() * VERZUG));
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/weeklies" && req.method() === "GET") { if (halten) await halten.warten; return json({ ok: true, data: lager.data }); }
    if (path === "/api/weeklies") {
      const b = JSON.parse(req.postData() || "{}");
      lager.posts.push(b.data);
      // fertig zaehlt die beantworteten Posts: erst danach hat die Seite die Antwort und schickt den naechsten (Probe 8)
      const antwort = async (body, status) => { await json(body, status); lager.fertig++; };
      const clean = Object.keys(b).join() === "data" ? wk.checkWeeklies(b.data, lager.data) : null;
      if (!clean) { lager.abgelehnt.push(b.data); return antwort({ ok: false }, 400); }
      lager.data = clean;
      return antwort({ ok: true });
    }
    if (path === "/api/config" && req.method() === "GET") { await json(config); s.konfigGeliefert = true; return; }
    if (path === "/api/config") {
      s.config.push(req.postData() || "");
      if (VERZUG) await new Promise((r) => setTimeout(r, Math.random() * VERZUG));
      return json({ ok: true });
    }
    if (path === "/api/state") return json({ dir: "", file: "", nativeFrame: false, material: false, stayOnTop: false });
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: {} }); }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html");
  await page.waitForFunction(() => !!document.body.dataset.bereit);
  if (!halten) await page.waitForFunction(() => document.querySelector("#wkBody")?.dataset.lage === "da");
  return s;
}
/* die Einstellungen oeffnen (wie test-einst-page.mjs: das Zahnrad der Bereichsleiste) und zur Gruppe Charaktere springen */
async function einstCharaktere(page) {
  await page.click('#bereiche [data-tab="settings"]');
  await page.waitForFunction(() => !document.querySelector("#einst").hidden);
  await page.click('#einstNav button[data-gruppe="charaktere"]');
  await page.waitForFunction(() => document.querySelector('#einstNav button[aria-current]')?.dataset.gruppe === "charaktere"
    && !!document.querySelector("#chInhalt")?.children.length);
}
/* auf einen Zustand warten, nie auf eine feste Zeit */
async function bis(fn, ms = 4000) {
  const ende = performance.now() + ms;
  while (performance.now() < ende) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
  return !!(await fn());
}
/* Auf das Speichern warten, und zwar auf das eigene (wie nachPost in test-weeklies-page.mjs, #224): nach einer Aktion kann ein fremder Post
   dazwischenkommen, und die Seite schickt einen Stand erst, wenn der vorige beantwortet ist (59, unterwegs). Darum: ein neuer Post ist da, dann
   wird ueber die Entprellung der Seite (200 ms; die Seite hat hier keine gestellte Uhr) gewartet, jeder Post ist beantwortet (lager.fertig) und die
   Seite hat die Antwort verarbeitet (ein Hin und Zurueck zum Helfer), und bis kein weiterer Post mehr kommt. Erst dann ist posts.at(-1) der Stand
   nach der Aktion. Hoechstens 8 Runden; false, wenn es nicht zur Ruhe kommt (die Probe meldet das). */
const ZUR_RUHE = 250;
const hinUndZurueck = (s) => s.page.evaluate(() => fetch("/api/state").then((r) => r.ok));
async function nachPost(s, n) {
  const l = s.lager;
  if (!(await bis(() => l.posts.length > n, 8000))) return false;
  for (let i = 0; i < 8; i++) {
    const vorher = l.posts.length;
    await new Promise((r) => setTimeout(r, ZUR_RUHE));
    await hinUndZurueck(s);
    if (!(await bis(() => l.fertig === l.posts.length, 20000))) return false;
    await hinUndZurueck(s);
    if (l.posts.length === vorher) return true;
  }
  return false;
}
/* Dasselbe fuer POST /api/config (der Verlauf, Proben 10 und 11): warten, bis nach dem ersten Post kein weiterer mehr kommt (Hin und Zurueck,
   dazu die Zeit der Entprellung); false, wenn es nicht zur Ruhe kommt. */
async function ruheConfig(s) {
  for (let i = 0; i < 12; i++) {
    const n = s.config.length;
    await new Promise((r) => setTimeout(r, 400));
    await hinUndZurueck(s);
    if (s.config.length === n) return true;
  }
  return false;
}
const satz = (p) => p.evaluate(() => document.querySelector("#chSatz")?.textContent || "");
const reihen = (p) => p.evaluate(() => [...document.querySelectorAll("#chInhalt .charzeile")].map((z) => ({
  id: z.dataset.id, main: z.classList.contains("main"), name: z.querySelector(".charname b")?.textContent,
  wort: z.querySelector(".charmain")?.textContent || "", log: z.querySelector("input.chlog")?.value,
  wahl: z.querySelector('input[name="chMain"]')?.checked })));
const profilVon = (stand, id) => stand?.profile.find((x) => x.id === id);
/* ein Feld setzen und verlassen: das change der Seite kommt beim Verlassen, wie beim Spieler */
async function feldSetzen(p, sel, wert) {
  await p.fill(sel, wert);
  await p.evaluate((q) => document.querySelector(q).blur(), sel);
}
const nieDoppelt = (posts) => posts.every((d) => {
  const logs = (d?.profile || []).filter((x) => !x.geloest && x.log !== undefined).map((x) => x.log);
  return new Set(logs).size === logs.length;
});

try {
  // --- 1. bis 5.: die Liste, Logname, Main mit Rueckgaengig, Hinzufuegen (deutsch)
  {
    const s = await oeffne();
    const p = s.page;
    await einstCharaktere(p);
    let r = await reihen(p);
    assert(r.length === 2 && r[0].id === "wtest00001" && r[0].main && r[0].wort === "Main" && r[0].wahl && r[0].name === "Tessa"
      && r[1].id === "wtest00002" && !r[1].main && r[1].wort === "" && !r[1].wahl,
      "1: zwei Reihen, die erste (Tessa) traegt .main, das Wort „Main“ und die gewaehlte Wahl", r);
    const felder = await p.evaluate(() => [document.querySelector("#chLog-wtest00001")?.value, document.querySelector("#chLog-wtest00002")?.value,
      document.querySelector('label[for="chLog-wtest00001"]')?.textContent, document.querySelector('#chInhalt input[value="wtest00002"]')?.getAttribute("aria-label"),
      document.querySelector("#egh-charaktere")?.textContent, document.querySelector('#einstNav button[data-gruppe="charaktere"]')?.textContent.trim(),
      document.querySelector("#chSatz")?.getAttribute("role")]);
    assert(felder[0] === "Tessa" && felder[1] === "" && felder[2] === "Logname" && felder[3] === "Brann zum Main machen"
      && felder[4] === "Charaktere" && felder[5] === "Charaktere" && felder[6] === "status",
      "1: Logname von Tessa „Tessa“, von Brann leer; Feld mit Label, Wahl mit Namen fuer Vorleser, Ueberschrift wie die Sprungleiste, Satz als Live-Region", felder);

    // 2. Logname setzen
    let n = s.lager.posts.length;
    await feldSetzen(p, "#chLog-wtest00002", "Brann");
    assert(await nachPost(s, n), "2: das Speichern kommt zur Ruhe");
    assert(profilVon(s.lager.posts.at(-1), "wtest00002")?.log === "Brann" && profilVon(s.lager.data, "wtest00002")?.log === "Brann",
      "2: Logname von Brann gesetzt: der POST traegt log „Brann“ fuer wtest00002 und die Datei nimmt ihn an", s.lager.posts.at(-1));
    assert(await satz(p) === "Logname von Brann gespeichert.", "2: der Satz sagt „Logname von Brann gespeichert.“", await satz(p));

    // 3. doppelter Logname
    await feldSetzen(p, "#chLog-wtest00002", "Tessa");
    await bis(async () => (await satz(p)) === "Ein anderer Charakter hat diesen Lognamen schon.");
    assert(await satz(p) === "Ein anderer Charakter hat diesen Lognamen schon.", "3: Brann mit dem Lognamen „Tessa“: der Satz nennt den doppelten Lognamen", await satz(p));

    // 4. Main wechseln und zurueck
    n = s.lager.posts.length;
    await p.check('#chInhalt input[name="chMain"][value="wtest00002"]');
    assert(await nachPost(s, n), "4: das Speichern kommt zur Ruhe");
    let post = s.lager.posts.at(-1);
    assert(profilVon(post, "wtest00002")?.main === true && !("main" in (profilVon(post, "wtest00001") || {}))
      && post.profile.filter((x) => x.main).length === 1,
      "4: Brann zum Main: im POST traegt nur wtest00002 main, wtest00001 hat kein main", post);
    assert(profilVon(post, "wtest00002")?.log === "Brann" && nieDoppelt(s.lager.posts) && !s.lager.abgelehnt.length,
      "3: kein POST mit doppeltem Lognamen, Brann behaelt „Brann“, kein Stand abgelehnt", { posts: s.lager.posts.map((d) => d.profile.map((x) => x.log)), abgelehnt: s.lager.abgelehnt.length });
    r = await reihen(p);
    let z = await p.evaluate(() => ({ rueck: !!document.querySelector("#chRueck"), fokus: document.activeElement?.id || "",
      imAbschnitt: !!document.querySelector("#chInhalt")?.contains(document.activeElement) }));
    assert(r[1].main && r[1].wort === "Main" && !r[0].main && r[0].wort === "" && z.rueck && z.imAbschnitt && z.fokus === "chRueck",
      "4: Brann traegt jetzt .main und das Wort, „Rückgängig“ erscheint und hat den Fokus", { r, z });
    assert(await satz(p) === "Brann ist jetzt der Main.", "4: der Satz sagt „Brann ist jetzt der Main.“", await satz(p));
    n = s.lager.posts.length;
    await p.click("#chRueck");
    assert(await nachPost(s, n), "4: das Speichern nach Rückgängig kommt zur Ruhe");
    post = s.lager.posts.at(-1);
    z = await p.evaluate(() => ({ rueck: !!document.querySelector("#chRueck"), imAbschnitt: !!document.querySelector("#chInhalt")?.contains(document.activeElement) }));
    r = await reihen(p);
    assert(profilVon(post, "wtest00001")?.main === true && !("main" in (profilVon(post, "wtest00002") || {})) && !z.rueck && r[0].main && z.imAbschnitt,
      "4: Rückgängig: Tessa ist wieder Main (POST), der Knopf ist weg, der Fokus bleibt im Abschnitt", { post, z, r });
    assert(await satz(p) === "Tessa ist jetzt der Main.", "4: der Satz nach Rückgängig sagt „Tessa ist jetzt der Main.“", await satz(p));

    // 5. Hinzufuegen
    n = s.lager.posts.length;
    await p.fill("#chNeuName", "Ilka");
    await p.fill("#chNeuLog", "Ilka");
    await p.click("#chNeuKnopf");
    assert(await nachPost(s, n), "5: das Speichern kommt zur Ruhe");
    post = s.lager.posts.at(-1);
    const neu = post?.profile[2];
    assert(post?.profile.length === 3 && neu?.name === "Ilka" && neu?.log === "Ilka" && !neu?.main && /^w[0-9a-z]{9}$/.test(neu?.id || "")
      && profilVon(s.lager.data, neu?.id)?.name === "Ilka",
      "5: „Charakter hinzufügen“ Ilka mit Logname Ilka: ein dritter Eintrag im POST, die Datei nimmt ihn an", post);
    z = await p.evaluate(() => ({ n: document.querySelectorAll("#chInhalt .charzeile").length, name: document.querySelector("#chNeuName").value,
      log: document.querySelector("#chNeuLog").value, fokus: document.activeElement?.id }));
    assert(z.n === 3 && z.name === "" && z.log === "" && z.fokus === "chNeuName" && await satz(p) === "Ilka hinzugefügt.",
      "5: drei Reihen, die Felder leer, der Fokus im Feld Name, der Satz „Ilka hinzugefügt.“", { z, satz: await satz(p) });
    n = s.lager.posts.length;
    await p.evaluate(() => { document.querySelector("#chNeuName").value = "x".repeat(25); });
    await p.click("#chNeuKnopf");
    await bis(async () => (await satz(p)) === "Der Name braucht 1 bis 24 Zeichen.");
    assert(await satz(p) === "Der Name braucht 1 bis 24 Zeichen.", "5: Name aus 25 Zeichen: „Der Name braucht 1 bis 24 Zeichen.“", await satz(p));
    await p.fill("#chNeuName", "Mira");
    await p.fill("#chNeuLog", "Ilka");
    await p.click("#chNeuKnopf");
    await bis(async () => (await satz(p)) === "Ein anderer Charakter hat diesen Lognamen schon.");
    assert(await satz(p) === "Ein anderer Charakter hat diesen Lognamen schon." && await p.evaluate(() => document.querySelectorAll("#chInhalt .charzeile").length) === 3,
      "5: Hinzufuegen mit einem Lognamen, den Ilka schon hat: der Satz nennt ihn, keine vierte Reihe", await satz(p));
    assert(s.lager.posts.length === n && nieDoppelt(s.lager.posts) && !s.lager.abgelehnt.length,
      "5: abgelehnte Eingaben senden nichts, kein Stand abgelehnt", { vorher: n, nachher: s.lager.posts.length });
    assert(!s.fehler.length, "1 bis 5: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 5. Sechs aktive Charaktere: Hinzufuegen sagt, was zu tun ist
  {
    const s = await oeffne({ stand: SECHS });
    const p = s.page;
    await einstCharaktere(p);
    const n = s.lager.posts.length;
    await p.fill("#chNeuName", "Ilka Zwei");
    await p.click("#chNeuKnopf");
    await bis(async () => (await satz(p)).startsWith("Sechs Charaktere sind aktiv."));
    assert(await satz(p) === "Sechs Charaktere sind aktiv. Löse erst einen in den Weeklies." && s.lager.posts.length === n
      && await p.evaluate(() => document.querySelectorAll("#chInhalt .charzeile").length) === 6,
      "5: bei sechs aktiven Charakteren sagt „Hinzufügen“ „Sechs Charaktere sind aktiv. …“ und sendet nichts", { satz: await satz(p), posts: s.lager.posts.length });
    // der Weg zum Loesen: der Knopf oeffnet die Weeklies
    await p.click("#chWeeklies");
    await bis(() => p.evaluate(() => !document.querySelector("#weeklies").hidden && document.querySelector("#einst").hidden));
    assert(await p.evaluate(() => !document.querySelector("#weeklies").hidden), "„Weeklies öffnen“ fuehrt in die Weeklies (dort Loesen und Zurueckholen)");
    assert(!s.fehler.length, "sechs Charaktere: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 6. Sprachwechsel auf Englisch (wie test-einst-page.mjs: das Segment im Abschnitt Sprache)
  {
    const s = await oeffne();
    const p = s.page;
    await einstCharaktere(p);
    await p.click('#eg-sprache button[data-lang="en"]');
    await p.waitForFunction(() => document.documentElement.lang === "en");
    await bis(() => p.evaluate(() => document.querySelector("#egh-charaktere")?.textContent === "Characters"
      && document.querySelector("#chInhalt .charmain")?.textContent === "Main"));
    const z = await p.evaluate(() => {
      const sec = document.querySelector("#eg-charaktere");
      const aria = [...sec.querySelectorAll("[aria-label]")].map((x) => x.getAttribute("aria-label"));
      return { text: sec.innerText, aria, h: sec.querySelector("h3")?.textContent, h4: sec.querySelector("#chNeu h4")?.textContent,
        wahl: [...sec.querySelectorAll(".charwahl span")].map((x) => x.textContent), knopf: sec.querySelector("#chNeuKnopf")?.textContent,
        log: sec.querySelector('label[for="chLog-wtest00001"]')?.textContent };
    });
    const deReste = CH_KEYS.flatMap((k) => DE[k].split(/\{name\}/).map((x) => x.trim()).filter((x) => x.length > 3 && x !== EN[k] && !Object.values(EN).includes(x))
      .filter((x) => z.text.includes(x) || z.aria.some((a) => a.includes(x))).map((x) => k + ": " + x));
    assert(z.h === "Characters" && z.h4 === "Add character" && z.knopf === "Add" && z.log === "Log name" && z.wahl.every((x) => x === "Main")
      && z.aria.includes("Make Brann the main") && z.text.includes(EN["ch.satz"]) && z.text.includes(EN["ch.loesen"]),
      "6: englisch: Ueberschrift, Wahl „Main“, Feld, Hinzufuegen und die Saetze stehen englisch", z);
    assert(!deReste.length, "6: kein Text des Abschnitts bleibt deutsch", deReste);
    assert(!s.fehler.length, "6: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 7. 560 Punkt, 2000 x 1480 und die vier Themen
  {
    const s = await oeffne({ breite: 560, hoehe: 900 });
    const p = s.page;
    await einstCharaktere(p);
    const z = await p.evaluate(() => {
      const zl = document.querySelector('#chInhalt .charzeile[data-id="wtest00001"]');
      const r = (q) => zl.querySelector(q).getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, name: r(".charname").toJSON(), log: r(".charlog").toJSON(), wahl: r(".charwahl").toJSON() };
    });
    assert(z.sw <= z.iw, "7: 560 Punkt: kein waagerechtes Rollen mit der offenen Gruppe", z);
    assert(z.log.top >= z.name.bottom - 0.5 && z.wahl.top >= z.log.bottom - 0.5 && z.wahl.left >= z.name.left - 0.5,
      "7: 560 Punkt: Feld und Wahl stapeln sich unter dem Namen", z);
    for (const th of ["dark", "light", "tnl", "glas"]) {
      await p.evaluate((k) => document.querySelector(`#eg-darst [role=radio][data-theme="${k}"]`).click(), th);
      await p.waitForFunction((k) => document.documentElement.dataset.theme === k, th);
      const f = await p.evaluate(() => {
        const m = document.querySelector("#chInhalt .charzeile.main"), a = document.querySelector("#chInhalt .charzeile:not(.main)");
        const cs = (e) => getComputedStyle(e);
        return { sicht: !!m && m.getClientRects().length > 0 && cs(m).visibility !== "hidden",
          main: cs(m).boxShadow, andere: cs(a).boxShadow, ringMain: cs(m.querySelector(".charring")).boxShadow, ringAndere: cs(a.querySelector(".charring")).boxShadow,
          wort: cs(m.querySelector(".charmain")).color, text: cs(m.querySelector(".charname b")).color };
      });
      assert(f.sicht && f.main !== f.andere && f.ringMain !== f.ringAndere && f.wort !== f.text,
        "7: Thema " + th + ": der Main ist sichtbar, Rahmen und Ring unterscheiden sich von der anderen Reihe, das Wort hat seine Farbe", f);
    }
    assert(!s.fehler.length, "7: keine Fehler auf der Seite (560)", s.fehler);
    await p.close();
    const g = await oeffne({ breite: 2000, hoehe: 1480 });
    await einstCharaktere(g.page);
    const w = await g.page.evaluate(() => {
      const [a, b] = [...document.querySelectorAll("#chInhalt .charzeile")].map((x) => x.getBoundingClientRect());
      return { a: a.toJSON(), b: b.toJSON(), sw: document.documentElement.scrollWidth, iw: innerWidth };
    });
    assert(Math.abs(w.a.top - w.b.top) < 1 && w.b.left > w.a.right - 0.5 && w.sw <= w.iw, "7: 2000 x 1480: zwei Reihen nebeneinander", w);
    await g.page.close();
  }

  // --- 8. Tastatur: Feld, Wahl, Hinzufuegen in dieser Folge; der Main mit Pfeiltaste, der Fokus bleibt im Abschnitt
  {
    const s = await oeffne();
    const p = s.page;
    await einstCharaktere(p);
    await p.focus("#chLog-wtest00001");
    const folge = ["chLog-wtest00001"];
    for (let i = 0; i < 12 && folge.at(-1) !== "chNeuKnopf"; i++) {
      await p.keyboard.press("Tab");
      folge.push(await p.evaluate(() => { const a = document.activeElement; return a?.id || (a?.name === "chMain" ? "wahl:" + a.value : a?.tagName || ""); }));
    }
    const iFeld = folge.indexOf("chLog-wtest00001"), iWahl = folge.indexOf("wahl:wtest00001"), iKnopf = folge.indexOf("chNeuKnopf");
    assert(iFeld === 0 && iWahl > iFeld && iKnopf > iWahl && folge.includes("chLog-wtest00002") && folge.includes("chNeuName") && folge.includes("chNeuLog"),
      "8: Tab erreicht Feld, Wahl und „Hinzufügen“ in dieser Folge", folge);
    const n = s.lager.posts.length;
    await p.focus('#chInhalt input[name="chMain"][value="wtest00001"]');
    await p.keyboard.press("ArrowDown");
    assert(await nachPost(s, n), "8: das Speichern nach der Pfeiltaste kommt zur Ruhe");
    const z = await p.evaluate(() => ({ imAbschnitt: !!document.querySelector("#chInhalt")?.contains(document.activeElement), fokus: document.activeElement?.id }));
    assert(profilVon(s.lager.posts.at(-1), "wtest00002")?.main === true && z.imAbschnitt,
      "8: Pfeiltaste in der Wahl macht Brann zum Main (POST), der Fokus bleibt in #chInhalt", z);
    // das Rueckgaengig muss da sein und den Fokus haben, dann Enter
    assert(await bis(() => p.evaluate(() => document.activeElement?.id === "chRueck")), "8: „Rückgängig“ hat den Fokus");
    const m = s.lager.posts.length;
    await p.keyboard.press("Enter");
    assert(await nachPost(s, m), "8: das Speichern nach Enter kommt zur Ruhe");
    const y = await p.evaluate(() => ({ imAbschnitt: !!document.querySelector("#chInhalt")?.contains(document.activeElement), wahl: document.activeElement?.value }));
    assert(profilVon(s.lager.posts.at(-1), "wtest00001")?.main === true && y.imAbschnitt && y.wahl === "wtest00001",
      "8: Enter auf „Rückgängig“: Tessa wieder Main, der Fokus geht auf ihre Wahl", y);
    assert(!s.fehler.length, "8: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 9. Datei-Modus (ohne Route): der Satz statt der Liste
  {
    const s = await oeffne({ datei: true });
    const p = s.page;
    await einstCharaktere(p);
    const z = await p.evaluate(() => ({ text: document.querySelector("#chInhalt")?.innerText.trim(), reihen: document.querySelectorAll("#chInhalt .charzeile").length,
      form: !!document.querySelector("#chNeu") }));
    assert(z.text === DE["ch.nurApp"] && !z.reihen && !z.form, "9: Datei-Modus: „Nur in der App: …“ statt der Liste, kein Hinzufuegen", z);
    assert(!s.fehler.length, "9: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 10. Die Kennung des Charakters im Verlauf: ein Log mit genau einem Angreifer (state.player bleibt "__all")
  for (const [wer, ch, was, datei] of [["Tessa", "wtest00001", "Angreifer Tessa, Logname von Tessa", "kampf-a.txt"], ["Mira", "", "Angreifer ohne passenden Charakter", "kampf-b.txt"]]) {
    const s = await oeffne();
    const p = s.page;
    await p.setInputFiles("#fileInput", kampflog(datei, wer));
    await p.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
    const mitIndex = () => s.config.map((x) => JSON.parse(x)).filter((b) => b.logIndex);
    assert(await bis(() => mitIndex().some((b) => Object.values(b.logIndex).some((e) => e.fights?.length))) && await ruheConfig(s), "10: der Verlauf kommt zur Ruhe");
    const eintrag = mitIndex().at(-1)?.logIndex?.[datei];
    const f = eintrag?.fights?.[0];
    assert(f && f.name === "Vulcanus" && f.ch === ch && !("g" in f) && eintrag.zv === "wtest00001",
      "10: " + was + ": der Kampf im logIndex traegt ch " + JSON.stringify(ch) + " und der Eintrag zv „wtest00001“", eintrag);
    const namen = s.config.filter((x) => [...NAMEN, wer].some((n) => x.includes(n)));
    assert(!namen.length, "10: " + was + ": kein POST /api/config enthaelt einen Namen", namen.map((x) => x.slice(0, 200)));
    assert(!s.fehler.length, "10: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  /* --- 11. Ein Log, bevor die Weeklies gelesen sind (Review 15.10.): der Verlauf kennt den Kampf schon mit ch und zv
     (aus einer frueheren Sitzung, mit anderen Zahlen, damit er neu geschrieben wird). GET /api/weeklies antwortet erst,
     nachdem der erste POST /api/config mit diesem Log gesehen wurde - ein Zustand, keine feste Zeit. Kein POST
     dazwischen darf dem Kampf sein ch oder dem Eintrag sein zv nehmen. */
  {
    const datei = "kampf-c.txt", BEGINN = Date.UTC(2026, 9, 14, 21, 0, 0);
    let los;
    const halten = { warten: new Promise((r) => { los = r; }) };
    const vorher = { [datei]: { size: 1, fights: [{ name: "Vulcanus", dps: 1, dmg: 1, dur: 1, at: BEGINN, ch: "wtest00001" }], zv: "wtest00001" } };
    const s = await oeffne({ halten, config: { rundgangGesehen: true, logIndex: vorher } });
    const p = s.page;
    /* Die Seite nimmt den Verlauf (logIndex) aus GET /api/config; mit BORO_TEST_VERZUG kann diese Antwort nach "bereit" kommen. Ein Log, das davor
       geladen wuerde, schriebe einen Eintrag ohne den alten Stand, und die spaete Antwort legte den Verlauf dann darueber: das geschieht in der App nicht
       (der lokale Helfer antwortet sofort, der Spieler waehlt erst danach eine Datei, #301). Darum: erst warten, bis die Seite die Einstellungen hat. */
    await bis(() => s.konfigGeliefert, 20000);
    await hinUndZurueck(s);
    const lageVorher =await p.evaluate(() => document.querySelector("#wkBody")?.dataset.lage || "");
    await p.setInputFiles("#fileInput", kampflog(datei, "Tessa"));
    await p.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
    const mitDatei = () => s.config.map((x) => JSON.parse(x)).filter((b) => b.logIndex?.[datei]);
    const gesehen = await bis(() => mitDatei().some((b) => b.logIndex[datei].fights?.some((f) => f.dps > 1)));
    const frueh = mitDatei().length;
    los();
    await p.waitForFunction(() => document.querySelector("#wkBody")?.dataset.lage === "da");
    // der Zustand, auf den es ankommt: ein Eintrag mit ch und zv ist geschrieben (die Zuordnung nach dem Lesen kann nach "da" noch unterwegs sein)
    const zugeordnet = () => mitDatei().some((b) => b.logIndex[datei].zv === "wtest00001" && b.logIndex[datei].fights?.some((k) => k.at === BEGINN && k.ch === "wtest00001"));
    assert(await bis(zugeordnet, 20000) && await ruheConfig(s), "11: der Verlauf kommt nach dem Lesen der Weeklies zur Ruhe, mit der Zuordnung");
    const eintraege = mitDatei().map((b) => b.logIndex[datei]);
    const letzter = eintraege.at(-1), f = letzter?.fights?.[0];
    assert(lageVorher !== "da" && gesehen && frueh > 0,
      "11: die Weeklies waren beim Laden des Logs noch nicht gelesen, der Verlauf hat den Kampf vorher neu geschrieben", { lageVorher, gesehen, frueh });
    assert(f && f.at === BEGINN && f.dps > 1 && f.ch === "wtest00001" && letzter.zv === "wtest00001",
      "11: der zuletzt gespeicherte Eintrag traegt ch „wtest00001“ am Kampf und zv „wtest00001“", letzter);
    const verloren = eintraege.filter((e) => e.zv !== "wtest00001" || (e.fights || []).some((k) => k.at === BEGINN && k.ch !== "wtest00001"));
    assert(!verloren.length, "11: kein POST dazwischen hat dem Kampf sein ch oder dem Eintrag sein zv genommen", verloren);
    const namen = s.config.filter((x) => NAMEN.some((n) => x.includes(n)));
    assert(!namen.length, "11: kein POST /api/config enthaelt einen Namen", namen.map((x) => x.slice(0, 200)));
    assert(!s.fehler.length, "11: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 12. Rueckgaengig nach dem Loesen stellt den Main wieder her (Twinks Schritt 2, offener Punkt aus Schritt 1):
     Tessa ist Main, wird in den Weeklies geloest (dabei verliert sie main, die Datei laesst keinen geloesten Main zu)
     und kommt mit Rueckgaengig zurueck - als Main. */
  {
    const s = await oeffne();
    const p = s.page;
    await p.click('#bereiche [data-tab="weeklies"]');
    await p.waitForFunction(() => !!document.querySelector("[data-wk-loesen]"));
    let n = s.lager.posts.length;
    await p.click("[data-wk-loesen]");
    assert(await nachPost(s, n), "12: das Speichern nach dem Loesen kommt zur Ruhe");
    const geloest = profilVon(s.lager.data, "wtest00001");
    assert(geloest?.geloest === true && !("main" in geloest), "12: geloest: Tessa ist geloest und nicht mehr Main", geloest);
    n = s.lager.posts.length;
    await p.click("[data-wk-undo]");
    assert(await nachPost(s, n), "12: das Speichern nach Rückgängig kommt zur Ruhe");
    const zurueck = profilVon(s.lager.data, "wtest00001");
    assert(zurueck && !zurueck.geloest && zurueck.main === true && s.lager.data.profile.filter((x) => x.main).length === 1 && !s.lager.abgelehnt.length,
      "12: Rueckgaengig: Tessa ist zurueck und wieder Main, genau ein Main, nichts abgelehnt", s.lager.data.profile);
    assert(!s.fehler.length, "12: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  /* --- 13. bis 16.: der Main in den Weeklies (Twinks Schritt 3). In der Datei steht Brann vorn, Tessa ist Main. */
  const HINTEN = { v: 1, profile: [profil("wtest00002", "Brann"), profil("wtest00003", "Ilka"), profil("wtest00001", "Tessa", { log: "Tessa", main: true })] };
  const karten = (p) => p.evaluate(() => [...document.querySelectorAll("#wkReiter .wkkarte")].map((k) => ({
    id: k.dataset.wkReiter, an: k.getAttribute("aria-selected"), tab: k.tabIndex, main: k.classList.contains("main"),
    marke: k.querySelector(".wkmain")?.textContent || "", sicht: !!k.querySelector(".wkmain")?.getClientRects().length,
    vh: k.getAttribute("aria-label") || "", name: k.querySelector(".wkkname")?.textContent || "" })));
  const weekliesAuf = async (p) => {
    await p.click('#bereiche [data-tab="weeklies"]');
    await p.waitForFunction(() => !!document.querySelector("#wkReiter .wkkarte"));
  };
  // 13. Marke, Reihenfolge, Oeffnen auf dem Main, Vorleser und Pfeiltasten (deutsch und englisch)
  for (const lang of ["de", "en"]) {
    const s = await oeffne({ lang, stand: HINTEN });
    const p = s.page, L = lang === "de" ? DE : EN;
    await weekliesAuf(p);
    const k = await karten(p);
    assert(k.map((x) => x.id).join() === "wtest00001,wtest00002,wtest00003", "13 " + lang + ": die Karte des Mains steht zuerst, die anderen in ihrer Folge", k);
    assert(k[0].an === "true" && k[0].tab === 0 && k.slice(1).every((x) => x.an === "false" && x.tab === -1), "13 " + lang + ": die Weeklies oeffnen auf dem Main", k);
    assert(k[0].main && k[0].marke === L["ch.main"] && k[0].sicht && k.slice(1).every((x) => !x.main && !x.marke),
      "13 " + lang + ": nur der Main traegt die Marke „" + L["ch.main"] + "“ als sichtbaren Text", k);
    assert(k[0].vh.includes(L["ch.main"]) && k[0].vh.includes("Tessa") && !k[1].vh.includes(L["ch.main"]), "13 " + lang + ": der Vorleser hoert „Main“ am Reiter des Mains", k.map((x) => x.vh));
    assert(await p.evaluate(() => document.querySelector("#wkPanel")?.getAttribute("aria-labelledby")) === "wkTab-wtest00001", "13 " + lang + ": das Feld gehoert zum Main");
    await p.focus("#wkTab-wtest00001");
    await p.keyboard.press("ArrowRight");
    await p.waitForFunction(() => document.activeElement?.id === "wkTab-wtest00002" && document.activeElement.getAttribute("aria-selected") === "true");
    assert(true, "13 " + lang + ": Pfeil rechts geht vom Main zum naechsten Reiter");
    await p.keyboard.press("Home");
    await p.waitForFunction(() => document.activeElement?.id === "wkTab-wtest00001");
    assert(true, "13 " + lang + ": Pos1 geht zum Main");
    // die Glutkante: der Ring des Mains hat einen Rand, die anderen nicht; in allen vier Themen
    for (const th of ["dark", "light", "tnl", "glas"]) {
      await p.evaluate((x) => { document.documentElement.dataset.theme = x; }, th);
      const g = await p.evaluate(() => {
        const cs = (q) => getComputedStyle(document.querySelector(q));
        const m = cs("#wkTab-wtest00001 .wkscheibe"), a = cs("#wkTab-wtest00002 .wkscheibe"), w = cs("#wkTab-wtest00001 .wkmain"), n = cs("#wkTab-wtest00001 .wkkname");
        return { m: m.outlineStyle + " " + m.outlineColor, a: a.outlineStyle, wort: w.color, name: n.color };
      });
      assert(g.m.startsWith("solid") && g.a === "none" && g.wort !== g.name, "13 " + lang + " " + th + ": Glutkante am Ring des Mains, das Wort in Gold", g);
    }
    assert(!s.fehler.length, "13 " + lang + ": keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  // 14. Eine Wahl in der Sitzung bleibt; ohne Wahl folgt die Ansicht dem Main
  {
    const s = await oeffne({ stand: HINTEN });
    const p = s.page;
    await einstCharaktere(p);
    let n = s.lager.posts.length;
    await p.check('#chInhalt input[name="chMain"][value="wtest00003"]');
    assert(await nachPost(s, n) && s.lager.data.profile.find((x) => x.main)?.id === "wtest00003", "14: Ilka als Main gespeichert");
    await weekliesAuf(p);
    let k = await karten(p);
    assert(k.map((x) => x.id).join() === "wtest00003,wtest00002,wtest00001" && k[0].an === "true",
      "14: ohne Wahl: der neue Main (Ilka) steht vorn und ist gewaehlt", k);
    await p.click("#wkTab-wtest00002");
    await p.waitForFunction(() => document.querySelector("#wkTab-wtest00002")?.getAttribute("aria-selected") === "true");
    await einstCharaktere(p);
    n = s.lager.posts.length;
    await p.check('#chInhalt input[name="chMain"][value="wtest00001"]');
    assert(await nachPost(s, n) && s.lager.data.profile.find((x) => x.main)?.id === "wtest00001", "14: Tessa als Main gespeichert");
    await weekliesAuf(p);
    k = await karten(p);
    assert(k[0].id === "wtest00001" && k.find((x) => x.id === "wtest00002")?.an === "true",
      "14: mit Wahl: Tessa ist Main und steht vorn, gewaehlt bleibt Brann", k);
    assert(!s.fehler.length, "14: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  // 15. Ohne Main: die Folge der Datei, keine Marke, die erste Karte gewaehlt
  {
    const OHNE = { v: 1, profile: HINTEN.profile.map(({ main: _m, ...x }) => x) };
    const s = await oeffne({ stand: OHNE });
    const p = s.page;
    await weekliesAuf(p);
    const k = await karten(p);
    assert(k.map((x) => x.id).join() === "wtest00002,wtest00003,wtest00001" && k[0].an === "true" && k.every((x) => !x.main && !x.marke)
      && !k.some((x) => x.vh.includes(DE["ch.main"])), "15: ohne Main: Folge der Datei, erste Karte gewaehlt, keine Marke", k);
    assert(!s.fehler.length, "15: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  // 16. 560 Punkt und 2000 x 1480: die Marke steht ganz, ein langer Name kuerzt sich, kein waagerechtes Rollen
  for (const [breite, hoehe] of [[560, 900], [2000, 1480]]) {
    const LANG = { v: 1, profile: [profil("wtest00002", "Brann"), profil("wtest00001", "Tessa Sturmwindtochter", { log: "Tessa", main: true })] };
    const s = await oeffne({ breite, hoehe, stand: LANG });
    const p = s.page;
    await weekliesAuf(p);
    const z = await p.evaluate(() => {
      const k = document.querySelector("#wkTab-wtest00001"), m = k.querySelector(".wkmain").getBoundingClientRect(), r = k.getBoundingClientRect();
      const n = k.querySelector(".wkkn");
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, m: m.toJSON(), r: r.toJSON(), nw: n.scrollWidth, ncw: n.clientWidth };
    });
    assert(z.sw <= z.iw && z.m.right <= z.r.right + 0.5 && z.m.width > 10, breite + " Punkt: die Marke steht ganz in der Karte, kein waagerechtes Rollen", z);
    assert(!s.fehler.length, "16: keine Fehler auf der Seite (" + breite + ")", s.fehler);
    await p.close();
  }
} finally {
  await browser.close();
  rmSync(ordner, { recursive: true, force: true });
  rmSync(arbeit, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} Pruefung(en) fehlgeschlagen` : "\nalle Pruefungen ok");
process.exit(failed ? 1 : 0);
