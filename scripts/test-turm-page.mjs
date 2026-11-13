// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Turm der Gier an der gebauten Seite (Spezifikation
// docs/superpowers/specs/2026-11-11-turm-der-gier-design.md, #423): der
// Unter-Tab neben den Wochenzielen, vier Stufen mit zusammen 20 Haken,
// "Alle abhaken" und "Alle zurueck" je Stufe, Speichern, die Saison mit
// Resttagen und der Saisonwechsel mit der Vorsaison (gestellte Uhr), Deutsch
// und Englisch, Tastatur (Leiste und Raster), die Verweise aria-controls und
// aria-labelledby, die Groessen (kein Rollen, Plaketten mindestens 52 px,
// auch bei 560 x 700) und mit und ohne Spielbilder (Turmbild und Plaketten
// bzw. Ziffern). Der Kopf der Datei ist der von test-weeklies-page.mjs:
// derselbe gestellte Helfer, dieselbe Uhr, derselbe echte Speicher.
// Namen sind erfunden.
//
// Run:  npm run test:turm-page     (baut die Seite zuerst)
// Ohne Bilder: BORO_BILDER=aus npm run test:turm-page
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import * as esbuild from "esbuild";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { bilderModus, bilderPlugin, gebauterModus } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/* Ohne Spielbilder (BORO_BILDER=aus, der oeffentliche Quelltext) tragen die
   Fluegel eine runde Platte mit dem Anfang des Namens (wkAnfang) und jeder
   Punkt seine gezeichnete Marke (WK_MARKE); die Proben der Bilder pruefen dann
   sie an derselben Stelle. */
const BILDER = gebauterModus(root) === "voll";
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 700))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const DATEI = "file:///" + join(root, "dist", "renderer", "index.html").replace(/\\/g, "/").replace(/^\/+/, "");

/* Der echte Speicher (weeklies.ts), ohne Electron: paths.ts haengt an electron. */
const ordner = mkdtempSync(join(tmpdir(), "boro-wkpage-"));
process.env.APPDATA = ordner;
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
const WKDATEI = join(ordner, "Borometer", "boro-weeklies.json");
mkdirSync(join(ordner, "Borometer"), { recursive: true });
const kern = await bundle("src/renderer/weeklies-core.ts");
/* folgt Spezifikation 10: die Groesse der Grundliste kommt aus dem Kern (keine feste Zahl), die Haendler und Kacheln in ihrer Folge */
const N = kern.GRUNDLISTE.length;
/* folgt Weeklies neu: die Karte zaehlt nur die Wochenpunkte (alles ausser taeglich); Tagespunkte stehen getrennt (121) */
const NW = kern.GRUNDLISTE.filter((x) => x.takt !== "tag").length;
const HAENDLER = ["gemischtwaren", "gildenhaendler", "vertragsmuenzen", "widerstandswaren", "ehrenmuenzen", "raidwaren"];
const KACHELN = ["raid", "geheimdungeon", "events", "dimension", "haendler"];
const vonGruppe = (g) => kern.GRUNDLISTE.filter((x) => x.gruppe === g).map((x) => x.schluessel);
const ringWert = (a, g) => Math.round(a / g * 10000) / 100;
/* die Punkte des Geheimdungeons; ausser Illusionen und Unendlichkeit sind es Haken, die die Probe "Kachel fertig" vorher setzt.
   ERL: was der erste Charakter danach erledigt hat (Zitadelle 2, Umwandlung, Illusionen, Unendlichkeit und diese Haken) */
const GD = vonGruppe("geheimdungeon"), GD_MEHR = GD.filter((k) => k !== "illusionen" && k !== "unendlichkeit"), ERL = 5 + GD_MEHR.length;
const bilder = await bundle("src/renderer/app/60-weeklies-bilder.ts");
const dictMod = await esbuild.build({ stdin: { contents: 'export { I18N } from "./src/renderer/app/07-dictionary";', resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
const { I18N } = await import("data:text/javascript;base64," + Buffer.from(dictMod.outputFiles[0].text).toString("base64"));

/* Ohne Spielbilder traegt der Fluegelkopf eine Platte mit dem Anfangsbuchstaben; ein fuehrender Artikel (der, die, das; the)
   zaehlt nicht, sonst stuende dreimal "D" bzw. "T" (Pruefung A3, Fixrunde 1) */
{
  const FL = ["zitadelle", "korridor", "altar"];
  const platte = (l) => FL.map((f) => typeof bilder.wkAnfang === "function" ? bilder.wkAnfang(I18N[l]["weeklies.fluegel." + f]) : "");
  const de = platte("de"), en = platte("en");
  assert(de.join() === "V,K,A" && en.join() === "F,C,A" && new Set(de).size === 3 && new Set(en).size === 3
    && bilder.wkAnfang?.("Theodor") === "T" && bilder.wkAnfang?.("Das Tor") === "T" && bilder.wkAnfang?.("dieser Weg") === "D",
    "Fluegelkopf ohne Bild: der Anfangsbuchstabe nach dem Artikel unterscheidet die drei Fluegel (DE V K A, EN F C A)", { de, en });
}

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Zeitpunkte im alten Gefuege der Tests (Tag und Stunde so gezaehlt, wie der Reset einst lag: Do 10:00 Berlin, Sommerzeit UTC+2),
   um 26 Stunden verschoben auf den neuen Reset Mi 06:00 UTC (Issue 420). So behalten alle Abstaende zu den Resets ihren Sinn:
   zeit(23, 9, 55) ist Di 22.09.2026 05:55 UTC, fuenf Minuten vor dem Tages-Reset und einen Tag vor dem Wochen-Reset. */
const zeit = (tag, h, m = 0) => Date.UTC(2026, 8, tag - 1, h - 4, m);
const MI_0955 = zeit(23, 9, 55);
const LEER = { v: 1, profile: [] };
const profil = (id, name, mehr = {}) => ({ id, name, zaehler: {}, aus: [], namen: {}, eigene: [], ...mehr });

/* Die Regeln der Route (W2), die die Seite beim Erzeugen einhalten muss. Zeiten (seit, reset)
   hoechstens einen Tag nach der Uhr der Seite (Pruefung W3, K6: nicht der Uhr dieses Rechners). */
const ID_RX = /^w[0-9a-z]{9}$/, EIGEN_RX = /^eigen[0-9a-z]{1,35}$/, TAG_MS = 86400000;
function regelBruch(d, jetzt) {
  const f = [];
  const zeit = (was, t) => { if (!(Number.isInteger(t) && t <= jetzt + TAG_MS)) f.push(was + " " + t); };
  for (const p of d?.profile || []) {
    if (!ID_RX.test(p.id)) f.push("id " + p.id);
    for (const e of p.eigene || []) if (!EIGEN_RX.test(e.schluessel)) f.push("eigen " + e.schluessel);
    for (const [k, z] of Object.entries(p.zaehler || {})) zeit("seit " + k, z?.seit);
    if (p.vorwoche) { zeit("reset", p.vorwoche.reset); for (const [k, z] of Object.entries(p.vorwoche.zaehler || {})) zeit("vorwoche " + k, z?.seit); }
  }
  return f;
}
/* checkWeeklies mit der Uhr der Seite: Date.now zeigt fuer den Aufruf auf die gestellte Zeit */
function pruefen(data, stored, jetzt) {
  const echt = Date.now;
  Date.now = () => jetzt;
  try { return wk.checkWeeklies(data, stored); } finally { Date.now = echt; }
}

/* Der gestellte Helfer. lager.data ist die Datei; getStatus/postStatus stellen 503 oder 400,
   getStatus "abbruch" einen Netzfehler, "ohneDaten" ein {ok:true} ohne data. */
const VERZUG = Number(process.env.BORO_TEST_VERZUG || 0);
const neuesLager = (data = LEER) => ({ data: structuredClone(data), posts: [], fertig: 0, abgelehnt: [], getStatus: 200, postStatus: null });
async function oeffne({ lang = "de", breite = 1280, hoehe = 860, lager = neuesLager(), uhr = MI_0955, datei = false, thema = null, fest = true } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  // die Uhr der Seite: gestellte Zeit plus was seitdem verging; vorspulen() rechnet das Vorspulen dazu
  const s = { page, fehler: [], lager, uhr: { basis: uhr, echt: performance.now() } };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  // Seit #224 ist fest der Normalfall: die Seite zeichnet im Minutentakt neu (59-weeklies.ts, planen), und ein Klick, dessen Maustaste vor dem Neuzeichnen
  // faellt und danach loslaesst, geht verloren (der Knopf ist ersetzt). Lief die Seitenuhr mit der Zeit des Runners, traf das unter Last eine Probe
  // zufaellig (Grundliste wiederherstellen, erster Haken, Anlegen). Mit stehender Uhr zeichnet nur neu, was die Probe selbst bewegt (nachPost, vorspulen).
  // fest: die Seite laedt eine Minute vor der Zeit und steht dann genau auf uhr + 500 ms, angehalten; nur vorspulen() bewegt sie
  // (sonst laeuft die Seitenuhr mit der Zeit des Runners weiter, und eine Minutenprobe haengt davon ab, wie lange das Laden dauerte)
  await page.clock.install({ time: fest ? uhr - 60000 : uhr });
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  if (datei) {
    await page.goto(DATEI);
    await page.waitForFunction(() => !!document.querySelector("#bereiche [data-tab=weeklies]"));
  } else {
    await page.route("http://boro.test/**", async (route) => {
      const req = route.request(), path = new URL(req.url()).pathname;
      // BORO_TEST_VERZUG (nur zur Nachstellung von Last, #224): so viele ms antwortet der gestellte Helfer auf jede Anfrage hoechstens spaeter,
      // zufaellig zwischen 0 und dem Wert; ohne den Wert aendert sich nichts
      if (VERZUG && path !== "/api/events") await new Promise((r) => setTimeout(r, Math.random() * VERZUG));
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
      if (path === "/api/weeklies" && req.method() === "GET")
        return lager.getStatus === 200 ? json({ ok: true, data: lager.data }) : lager.getStatus === "abbruch" ? route.abort().catch(() => {})
          : lager.getStatus === "ohneDaten" ? json({ ok: true }) : json({ ok: false }, lager.getStatus);
      if (path === "/api/weeklies") {
        const b = JSON.parse(req.postData() || "{}");
        lager.posts.push(b.data);
        // fertig zaehlt die beantworteten Posts: erst danach hat die Seite ihre Antwort und ist ruhig (nachPost wartet darauf)
        const antwort = async (body, status) => { await json(body, status); lager.fertig++; };
        if (lager.postStatus) return antwort({ ok: false }, lager.postStatus);
        const jetzt = seitenUhr(s);
        const bruch = regelBruch(b.data, jetzt);
        const clean = Object.keys(b).join() === "data" ? pruefen(b.data, lager.data, jetzt) : null;
        if (!clean || bruch.length) { lager.abgelehnt.push({ bruch, data: b.data }); return antwort({ ok: false }, 400); }
        lager.data = clean;
        return antwort({ ok: true });
      }
      if (path === "/api/weeklies-loeschen" && req.method() === "POST") {
        // der echte Speicher: die Datei traegt den Stand des Lagers, loescheWeekliesGeloest arbeitet an ihr, das Lager liest sie zurueck
        writeFileSync(WKDATEI, JSON.stringify(lager.data));
        const gone = wk.loescheWeekliesGeloest(JSON.parse(req.postData() || "{}"));
        if (gone.ok) lager.data = JSON.parse(readFileSync(WKDATEI, "utf8"));
        return json(gone, gone.ok ? 200 : gone.grund === "unavailable" ? 503 : 400);
      }
      if (path === "/api/state") return json({ dir: "", file: "", nativeFrame: false, material: false, stayOnTop: false });
      if (path === "/api/config" && req.method() === "GET") return json(thema ? { theme: thema } : {});
      if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: {} }); }
      if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
      if (path.startsWith("/api/")) return json({ ok: true });
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
    });
    await page.goto("http://boro.test/index.html");
    await page.waitForFunction(() => !!document.body.dataset.bereit);
  }
  if (thema) await page.evaluate((k) => document.querySelector(`#themeRow button[data-theme="${k}"]`)?.click(), thema);
  await page.click('#bereiche [data-tab="weeklies"]');
  await page.waitForFunction(() => !document.querySelector("#weeklies").hidden);
  if (!datei && lager.getStatus === 200) await page.waitForFunction(() => document.querySelector("#wkBody")?.dataset.lage === "da");
  if (fest) { await page.clock.pauseAt(uhr + 500); s.uhr = { basis: uhr + 500, echt: performance.now(), fest: true }; }
  return s;
}
/* monotone Uhr: die Wanduhr springt in WSL2 (timesyncd) um ~1,2 s zurueck, die Seitenuhr (Playwright) laeuft monoton */
const seitenUhr = (s) => s.uhr.basis + (s.uhr.fest ? 0 : performance.now() - s.uhr.echt);
async function vorspulen(s, ms) { await s.page.clock.fastForward(ms); s.uhr.basis += ms; }
/* auf einen Zustand warten, nie auf eine feste Zeit */
async function bis(fn, ms = 4000) {
  const ende = performance.now() + ms;
  while (performance.now() < ende) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
  return !!(await fn());
}
const nPosts = (s) => s.lager.posts.length;
/* Kein weiteres Speichern erwarten: die Seite sendet entprellt (200 ms). Die Uhr der Seite wird selbst weitergestellt, statt reale Zeit verstreichen zu
   lassen, und ein Hin und Zurueck zum Helfer stellt sicher, dass ein gesendeter Post schon angekommen waere. */
async function keinPost(s, ms = 500) {
  await vorspulen(s, ms);
  await s.page.evaluate(() => fetch("/api/state").then((r) => r.ok));
}
/* Auf das Speichern warten, und zwar auf das eigene: nach einer Aktion (Klick, Eingabe) kann ein fremder Post dazwischenkommen (ein Stand, den die
   Seite schon vorher entprellt hatte), und ein Lesen der Datei direkt nach dem ersten neuen Post saehe dann den Stand vor der Aktion. Darum: ein neuer
   Post ist da, danach wird die Uhr der Seite ueber die Entprellung (200 ms) gestellt, bis kein weiterer Post mehr kommt, und jeder ist beantwortet
   und die Seite hat die Antwort verarbeitet (ein Hin und Zurueck zum Helfer; kein requestAnimationFrame: unter der gestellten Uhr ist es ein Zeitgeber, und ein
   Vorspulen um Tage gleich danach blieb ohne Wirkung). Erst dann ist die Datei der Stand nach der Aktion und ein naechster Klick faellt nicht
   auf ein Element, das gerade ersetzt wird. Die Entprellung selbst bleibt streng: keinPost und die Proben mit vorspulen() pruefen sie. */
async function nachPost(s, n) {
  const l = s.lager;
  // gelingt es nicht, steht der Grund in der FAIL-Zeile (#224): kein Post, ein unbeantworteter oder dauernd neue
  const aus = async (grund) => {
    const seite = await s.page.evaluate(() => ({ lage: document.querySelector("#wkBody")?.dataset.lage, status: document.querySelector("#wkStatus")?.textContent,
      feld: document.querySelector("#wkNeuName")?.value ?? null, fokus: (document.activeElement?.outerHTML || "").slice(0, 120), zeit: new Date().toISOString() })).catch((e) => String(e));
    assert(false, "Speichern: kein ruhiger, beantworteter Post nach der Aktion (" + grund + ")", { n, posts: l.posts.length, fertig: l.fertig, abgelehnt: l.abgelehnt.length, seite });
    return false;
  };
  const hinundzurueck = () => s.page.evaluate(() => fetch("/api/state").then((r) => r.ok));
  // die Uhr der Seite steht (fest) oder laeuft: in beiden Faellen stellt die Probe sie ueber die Entprellung, das sendet, was ansteht
  for (let i = 0; i < 40; i++) {
    await vorspulen(s, 250);
    await hinundzurueck();
    const k = l.posts.length;
    if (!(await bis(() => l.fertig === l.posts.length, 8000))) return await aus("Antwort bleibt aus");
    await hinundzurueck();
    if (k > n && l.posts.length === k) return true;
  }
  return await aus(l.posts.length > n ? "es kommen dauernd neue Posts" : "kein neuer Post");
}

/* Was der Bereich zeigt: Reiter, Gruppen, Punkte, Saetze. */

const JETZT = Date.UTC(2026, 10, 20, 10, 0);          // Fr 20.11.2026, Saison 1 (11.11. bis 9.12.)
const NACH = Date.UTC(2026, 11, 9, 5, 59);            // eine Minute vor dem Saisonwechsel
const lagerMit = () => neuesLager({ v: 1, profile: [profil("w00000001a", "Aurel")] });
const turm = (s) => s.page.evaluate(() => {
  const q = (x, r = document) => r.querySelector(x), qa = (x, r = document) => [...r.querySelectorAll(x)];
  return {
    tabs: qa(".wkt-unterknopf").map((b) => ({ id: b.dataset.wkUnter, sel: b.getAttribute("aria-selected"), tab: b.tabIndex })),
    da: !!q("#wkTurm"), zahl: q("#wkTurm .wkt-kopf .wkt-zahl")?.textContent || "", saison: q("#wkTurm .wkt-sub")?.textContent || "",
    letzte: q("#wkTurm .wkt-letzte")?.textContent || "",
    ebenen: qa("#wkTurm .wkt-ebene").map((b) => ({ k: b.dataset.wkTurm, an: b.getAttribute("aria-pressed"), tab: b.tabIndex, label: b.getAttribute("aria-label") })),
    stufen: qa("#wkTurm .wkt-stufe").map((x) => ({ h: q("h4", x)?.textContent, alle: q(".wkt-alle", x)?.textContent, z: q(".wkt-zahl", x)?.textContent })),
    bild: !!q("#wkTurm .wkt-b-ebene1"), ziffer: !!q("#wkTurm .wkt-ziffer"), turmBild: q("#wkTurm")?.classList.contains("wkt-b-turm"),
    karte: q('#wkReiter [role="tab"]')?.dataset.wkWoche,
    anton: qa("#wkTurm .wkt-zahl b, .wkt-unterknopf .wkt-zahl b").map((b) => getComputedStyle(b).fontFamily.split(",")[0]),
    rollBreit: [document.querySelector(".wkrollt").scrollWidth, document.querySelector(".wkrollt").clientWidth],
    rollHoch: [document.querySelector(".wkrollt").scrollHeight, document.querySelector(".wkrollt").clientHeight],
    /* kleinste Plakette (Breite oder Hoehe, die kleinere), gerundet */
    /* Anteil der Flaeche, der ueber den Stufenkarten frei bleibt (das Turmbild soll oben zu sehen sein) */
    frei: (() => { if (!q("#wkTurm")) return 0; const w = q("#wkTurm").getBoundingClientRect(), s = q("#wkTurm .wkt-stufen").getBoundingClientRect(); return Math.round((s.top - w.top) / w.height * 100) / 100; })(),
    platte: Math.round(Math.min(...qa("#wkTurm .wkt-ebene").map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))) * 10) / 10,
  };
});
const ansage = (s) => s.page.evaluate(() => document.querySelector("#wkAnsage")?.textContent || "");
const zumTurm = async (s) => { await s.page.click('[data-wk-unter="turm"]'); await bis(async () => (await turm(s)).da); };
/* Verweise der Bedienelemente: jedes aria-controls und aria-labelledby im Bereich muss auf ein vorhandenes Element zeigen */
const verweise = (s) => s.page.evaluate(() => {
  const lose = [];
  for (const attr of ["aria-controls", "aria-labelledby"])
    for (const e of document.querySelectorAll("#weeklies [" + attr + "]"))
      for (const id of e.getAttribute(attr).split(/\s+/).filter(Boolean))
        if (!document.getElementById(id)) lose.push(attr + "=" + id + " an " + (e.dataset.wkUnter || e.dataset.wkReiter || e.id || e.tagName));
  return lose;
});

{
  console.log("Turm: Unter-Tab, Haken, Alle abhaken");
  const s = await oeffne({ lager: lagerMit(), uhr: JETZT });
  let z = await turm(s);
  assert(z.tabs.length === 2 && z.tabs[0].sel === "true" && !z.da, "Start: Wochenziele sind offen, der Turm noch nicht", z.tabs);
  assert((await verweise(s)).length === 0, "Wochenziele: jedes aria-controls und aria-labelledby zeigt auf ein vorhandenes Element", await verweise(s));
  await zumTurm(s);
  z = await turm(s);
  assert(z.da && z.tabs[1].sel === "true" && z.ebenen.length === 20 && z.stufen.length === 4, "Der Turm hat vier Stufen mit zusammen 20 Ebenen");
  assert((await verweise(s)).length === 0, "Turm: jedes aria-controls und aria-labelledby zeigt auf ein vorhandenes Element", await verweise(s));
  assert(await s.page.evaluate(() => {
    const t = document.querySelector('[data-wk-unter="turm"]'), p = document.querySelector("#wkTurm");
    return !!t.id && t.getAttribute("aria-controls") === p.id && p.getAttribute("aria-labelledby") === t.id;
  }), "Der Turm-Tab steuert das Turm-Feld, das Feld ist nach dem Tab benannt (aria-controls, aria-labelledby)");
  assert(z.stufen.map((x) => x.h).join() === "Erwachen,Morgenröte,Zwielicht,Abgrund" && !/·|Awakening/.test(z.stufen[0].h), "Deutsch: nur der deutsche Name je Stufe", z.stufen);
  assert(z.zahl === "0/20" && /11\.11\. bis 9\.12\. · noch 19 Tage/.test(z.saison), "0/20 und die Saison 11.11. bis 9.12. mit den Resttagen", { zahl: z.zahl, saison: z.saison });
  assert(z.anton.every((f) => /Source Sans/.test(f)), "Alle Zahlen des Turms stehen in Source Sans, nie in Anton", z.anton);
  const karte0 = z.karte;

  const n0 = nPosts(s);
  await s.page.click('[data-wk-turm="turmS1E1"]');
  assert(await nachPost(s, n0), "Ein Haken wird gespeichert");
  const p = s.lager.data.profile[0];
  assert(p.zaehler.turmS1E1?.stand === 1 && Object.keys(p.zaehler).join() === "turmS1E1", "Gespeichert: nur turmS1E1 mit Stand 1", p.zaehler);
  assert(await bis(async () => (await ansage(s)) === "Erwachen: 1 von 5. Turm der Gier: 1 von 20"), "Der Vorleser hoert nach dem Haken: Erwachen: 1 von 5. Turm der Gier: 1 von 20", await ansage(s));
  z = await turm(s);
  assert(z.zahl === "1/20" && z.ebenen[0].an === "true" && /abgehakt/.test(z.ebenen[0].label), "Danach 1/20, die Ebene ist abgehakt (aria-pressed, Beschriftung)");
  assert(z.karte === karte0, "Der Turm aendert die Karte (Wochen-Fertig) nicht", { vorher: karte0, nachher: z.karte });

  const n1 = nPosts(s);
  await s.page.click('[data-wk-turm-alle="1"]');
  assert(await nachPost(s, n1), "Alle abhaken einer Stufe wird gespeichert");
  assert(await bis(async () => (await ansage(s)) === "Morgenröte: 5 von 5. Turm der Gier: 6 von 20"), "Der Vorleser hoert nach Alle abhaken: Morgenröte: 5 von 5. Turm der Gier: 6 von 20", await ansage(s));
  z = await turm(s);
  assert(z.zahl === "6/20" && z.stufen[1].alle === "Alle zurück" && z.stufen[0].alle === "Alle abhaken", "Stufe 2 ist voll: Knopf heisst Alle zurück, die anderen Alle abhaken", z.stufen);
  const n2 = nPosts(s);
  await s.page.click('[data-wk-turm-alle="1"]');
  assert(await nachPost(s, n2), "Alle zurück wird gespeichert");
  const zz = s.lager.data.profile[0].zaehler;
  assert(["turmS2E1", "turmS2E2", "turmS2E3", "turmS2E4", "turmS2E5"].every((k) => zz[k]?.stand === 0) && (await turm(s)).zahl === "1/20",
    "Alle zurück setzt die fuenf Zaehler auf 0, die Schluessel bleiben", zz);
  assert(s.fehler.length === 0, "keine Seitenfehler", s.fehler);
  await s.page.close();
}

{
  console.log("Turm: Saisonwechsel und Vorsaison");
  const s = await oeffne({ lager: lagerMit(), uhr: NACH });
  await zumTurm(s);
  let n = nPosts(s);
  await s.page.click('[data-wk-turm="turmS1E1"]'); await s.page.click('[data-wk-turm="turmS1E2"]');
  assert(await nachPost(s, n), "Zwei Haken kurz vor dem Saisonwechsel");
  assert((await turm(s)).zahl === "2/20", "2/20 in Saison 1");
  await vorspulen(s, 2 * 60000);                      // 9.12. 06:01 UTC: Saison 2
  await s.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  assert(await bis(async () => (await turm(s)).zahl === "0/20"), "Nach dem Wechsel zeigt der Turm wieder 0/20");
  let z = await turm(s);
  assert(/noch 28 Tage/.test(z.saison) && /9\.12\. bis 6\.1\./.test(z.saison), "Die neue Saison: 9.12. bis 6.1., noch 28 Tage", z.saison);
  assert(z.letzte === "Letzte Saison: 2 von 20", "Die alte Saison bleibt sichtbar: 2 von 20", z.letzte);
  n = nPosts(s);
  await s.page.click('[data-wk-turm="turmS3E3"]');
  assert(await nachPost(s, n), "Ein Haken in Saison 2 wird gespeichert");
  const p = s.lager.data.profile[0];
  assert(p.vorsaison && Object.keys(p.vorsaison.zaehler).sort().join() === "turmS1E1,turmS1E2", "Die Vorsaison mit den zwei alten Haken steht in der Datei", p.vorsaison);
  assert(p.zaehler.turmS1E1.stand === 1, "Die alten Zaehler selbst bleiben stehen (nichts geloescht)");
  z = await turm(s);
  assert(z.zahl === "1/20" && z.letzte === "Letzte Saison: 2 von 20", "1/20 in Saison 2, die Vorsaison bleibt", { zahl: z.zahl, letzte: z.letzte });
  await s.page.close();
}

{
  console.log("Turm: Tastatur, Englisch, Raster");
  const s = await oeffne({ lager: lagerMit(), uhr: JETZT, lang: "en" });
  await s.page.focus('[data-wk-unter="wochen"]');
  /* Tastenkombinationen mit Alt, Ctrl, Meta oder Umschalt gehoeren dem Browser: die Leiste bleibt stehen */
  for (const k of ["Alt+ArrowRight", "Control+ArrowRight", "Meta+ArrowRight", "Shift+ArrowRight", "Alt+End"]) await s.page.keyboard.press(k);
  await keinPost(s, 300);
  assert(!(await turm(s)).da && await s.page.evaluate(() => document.activeElement?.dataset.wkUnter) === "wochen", "Alt, Ctrl, Meta und Umschalt mit Pfeil oder Ende bewegen die Leiste nicht", await turm(s));
  await s.page.keyboard.press("ArrowRight");
  assert(await bis(async () => (await turm(s)).da), "Pfeil rechts in der Leiste oeffnet den Turm");
  let z = await turm(s);
  assert(z.stufen.map((x) => x.h).join() === "Awakening,Dawn,Twilight,Abyss", "Englisch: Awakening, Dawn, Twilight, Abyss", z.stufen);
  assert(z.ebenen.filter((e) => e.tab === 0).length === 1, "Ein Tabstopp im Raster der 20 Ebenen", z.ebenen.filter((e) => e.tab === 0));
  await s.page.focus('[data-wk-turm="turmS1E1"]');
  await s.page.keyboard.press("ArrowRight");
  await s.page.keyboard.press("ArrowDown");
  assert(await s.page.evaluate(() => document.activeElement?.dataset.wkTurm) === "turmS2E2", "Pfeile bewegen im Raster (rechts, dann runter: S2E2)");
  await s.page.keyboard.press("End");
  assert(await s.page.evaluate(() => document.activeElement?.dataset.wkTurm) === "turmS4E5", "Ende springt auf die letzte Ebene");
  const n = nPosts(s);
  await s.page.keyboard.press("Space");
  assert(await nachPost(s, n) && (await turm(s)).ebenen[19].an === "true", "Leertaste hakt ab und speichert");
  assert(await s.page.evaluate(() => document.activeElement?.dataset.wkTurm) === "turmS4E5", "Der Fokus bleibt auf der Ebene");
  await s.page.close();
}

{
  console.log("Turm: Groessen, kein Scrollen, Bilder");
  /* Hoch genug: der Turm nimmt die Resthoehe, kein senkrechtes Rollen. 560 x 700 ist niedriger als die Mindestflaeche: die Seite darf rollen,
     die Plaketten bleiben trotzdem mindestens 52 px (Spezifikation "Kein Scrollen"). */
  for (const [b, h, dyn, min] of [[1280, 860, true, 0], [2000, 1480, true, 0], [560, 900, true, 52], [560, 700, false, 52]]) {
    const s = await oeffne({ lager: lagerMit(), uhr: JETZT, breite: b, hoehe: h });
    await zumTurm(s);
    const z = await turm(s);
    console.log(`  mass  ${b} x ${h}: Rollen breit ${z.rollBreit.join("/")}, hoch ${z.rollHoch.join("/")}, kleinste Plakette ${z.platte} px`);
    assert(z.rollBreit[0] <= z.rollBreit[1], `${b} x ${h}: kein waagerechtes Rollen`, z.rollBreit);
    assert(!dyn || z.rollHoch[0] <= z.rollHoch[1] + 1, `${b} x ${h}: kein senkrechtes Rollen (der Turm nimmt die Resthoehe)`, z.rollHoch);
    if (min) assert(z.platte >= min, `${b} x ${h}: die Plaketten sind mindestens ${min} px gross`, z.platte);
    else assert(z.platte >= 52, `${b} x ${h}: die Plaketten sind nicht winzig`, z.platte);
    if (b >= 1280) assert(z.frei >= 0.37, `${b} x ${h}: das Turmbild bleibt oben frei, die Karten sitzen unten (frei ${z.frei})`, z.frei);
    if (b === 1280) assert(BILDER ? z.bild && z.turmBild && !z.ziffer : z.ziffer && !z.bild && !z.turmBild, BILDER ? "Mit Bildern: Turmbild und Plaketten" : "Ohne Bilder: Ziffern auf Bogen-Knoepfen statt Plaketten", z);
    await s.page.close();
  }
}

{
  console.log("Turm: Themen hell und glas, heller Text auf dunkler Flaeche");
  for (const th of ["light", "glas"]) {
    const s = await oeffne({ lager: lagerMit(), uhr: JETZT, thema: th });
    await zumTurm(s);
    const m = await s.page.evaluate(() => {
      const kanal = (c) => (c.match(/[0-9.]+/g) || []).slice(0, 3).map(Number);
      const hell = (c) => Math.min(...kanal(c));
      const q = (x) => document.querySelector(x);
      return {
        thema: document.documentElement.dataset.theme || document.body.dataset.theme || "",
        kopf: hell(getComputedStyle(q("#wkTurm .wkt-kopf h3")).color), h4: hell(getComputedStyle(q("#wkTurm .wkt-stufe h4")).color),
        sub: hell(getComputedStyle(q("#wkTurm .wkt-sub")).color),
        karte: Math.max(...kanal(getComputedStyle(q("#wkTurm .wkt-stufe")).backgroundColor)),
      };
    });
    assert(m.thema === th, `Thema ${th} ist gesetzt`, m);
    assert(m.kopf >= 180 && m.h4 >= 180 && m.sub >= 180, `Thema ${th}: Kopf, Stufenname und Saison bleiben hell`, m);
    assert(m.karte <= 60, `Thema ${th}: die Stufenkarten bleiben dunkel`, m);
    await s.page.close();
  }
}

await browser.close();
rmSync(ordner, { recursive: true, force: true });
console.log();
if (failed) { console.log(`TURM PAGE FAILED - ${failed}`); process.exit(1); }
console.log("TURM PAGE PASSED");
