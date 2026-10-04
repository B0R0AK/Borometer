// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Bereich Weeklies an der gebauten Seite (Spezifikation
// docs/superpowers/specs/2026-09-29-weeklies-design.md, Abschnitte 3 bis 7;
// Plan docs/superpowers/plans/2026-09-29-weeklies.md, Aufgabe W3): bis zu
// sechs Charaktere als Reiter mit Fortschritt, anlegen, umbenennen, loesen
// mit Rueckgaengig (auch nach Neuladen), Haken und Zaehler mit -, +, voll
// und Klick auf den Namen, erledigte Kacheln treten zurueck, Anpassen
// (ausblenden, umbenennen, eigener Punkt, Grundliste wiederherstellen), der
// Reset ueber eine gestellte Uhr (Playwright page.clock) mit der Vorwoche im
// gesendeten Stand, die Reset-Anzeige im Minutentakt, Deutsch und Englisch,
// Groessen, drei Themen, Tastatur, der Satz ohne Route (Datei-Modus) und die
// Saetze bei 400 und 503. Seit der Neugestaltung "Wochenband" (Spezifikation
// Abschnitt 9, 01.10.2026) dazu: Kacheln statt Liste (erledigte treten
// zurueck), der Raid als 3x3-Raster mit Bossbildern und Pfeiltasten, der
// Fuellring n/Menge um das Gegenstandssymbol, die Ringe an den Reitern und
// das Wochenband mit dem Jetzt-Strich an der richtigen Stelle (gestellte Uhr,
// auch in der Woche der Zeitumstellung). Angepasste Proben tragen "folgt
// Entwurf 01.10." und bleiben gleich streng. Seit Spezifikation 10
// (01.10.2026) dazu: das Feld "Haendler" mit sechs Bloecken in Spalten (die
// Kachel "Taeglich" entfaellt), die Dimensionspruefung mit Punkten und fuenf
// goldenen Truhen, "monatlich" am Vererbungsstein und der Monats-Reset;
// angepasste Proben tragen "folgt Spezifikation 10", die Zahlen der
// Grundliste kommen aus kern.GRUNDLISTE.
//
// Kein Server: die Seite kommt vom gestellten Helfer (page.route), der
// /api/weeklies wie src/main/weeklies.ts beantwortet - jeder gesendete Stand
// geht durch das echte checkWeeklies() (gebuendelt mit einem gestellten
// electron wie in test-weeklies-store.mjs) und die Regeln der Route
// (Kennung w + neun Zeichen, eigene Schluessel eigen...). Namen sind erfunden.
//
// Run:  npm run test:weeklies-page     (baut die Seite zuerst)
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import * as esbuild from "esbuild";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
const kern = await bundle("src/renderer/weeklies-core.ts");
/* folgt Spezifikation 10: die Groesse der Grundliste kommt aus dem Kern (keine feste Zahl), die Haendler und Kacheln in ihrer Folge */
const N = kern.GRUNDLISTE.length;
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

/* Uhrzeiten in Berlin (Sommerzeit, UTC+2): Mi 23.09.2026 09:55 ist der Alltag. */
const berlin = (tag, h, m = 0) => Date.UTC(2026, 8, tag, h - 2, m);
const MI_0955 = berlin(23, 9, 55);
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
const neuesLager = (data = LEER) => ({ data: structuredClone(data), posts: [], abgelehnt: [], getStatus: 200, postStatus: null });
async function oeffne({ lang = "de", breite = 1280, hoehe = 860, lager = neuesLager(), uhr = MI_0955, datei = false, thema = null } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  // die Uhr der Seite: gestellte Zeit plus was seitdem verging; vorspulen() rechnet das Vorspulen dazu
  const s = { page, fehler: [], lager, uhr: { basis: uhr, echt: Date.now() } };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.clock.install({ time: uhr });
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  if (datei) {
    await page.goto(DATEI);
    await page.waitForFunction(() => !!document.querySelector("#bereiche [data-tab=weeklies]"));
  } else {
    await page.route("http://boro.test/**", async (route) => {
      const req = route.request(), path = new URL(req.url()).pathname;
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
      if (path === "/api/weeklies" && req.method() === "GET")
        return lager.getStatus === 200 ? json({ ok: true, data: lager.data }) : lager.getStatus === "abbruch" ? route.abort().catch(() => {})
          : lager.getStatus === "ohneDaten" ? json({ ok: true }) : json({ ok: false }, lager.getStatus);
      if (path === "/api/weeklies") {
        const b = JSON.parse(req.postData() || "{}");
        lager.posts.push(b.data);
        if (lager.postStatus) return json({ ok: false }, lager.postStatus);
        const jetzt = seitenUhr(s);
        const bruch = regelBruch(b.data, jetzt);
        const clean = Object.keys(b).join() === "data" ? pruefen(b.data, lager.data, jetzt) : null;
        if (!clean || bruch.length) { lager.abgelehnt.push({ bruch, data: b.data }); return json({ ok: false }, 400); }
        lager.data = clean;
        return json({ ok: true });
      }
      if (path === "/api/state") return json({ dir: "", file: "", nativeFrame: false, material: false, stayOnTop: false });
      if (path === "/api/config" && req.method() === "GET") return json(thema ? { theme: thema } : {});
      if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: {} }); }
      if (path === "/api/builds" && req.method() === "GET") return json({ ok: true, builds: {} });
      if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
      if (path === "/api/plans" && req.method() === "GET") return json({ ok: true, plans: {} });
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
  return s;
}
const seitenUhr = (s) => s.uhr.basis + (Date.now() - s.uhr.echt);
async function vorspulen(s, ms) { await s.page.clock.fastForward(ms); s.uhr.basis += ms; }
/* auf einen Zustand warten, nie auf eine feste Zeit */
async function bis(fn, ms = 4000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
  return !!(await fn());
}
const nPosts = (s) => s.lager.posts.length;
const nachPost = async (s, n) => bis(() => s.lager.posts.length > n);

/* Was der Bereich zeigt: Reiter, Gruppen, Punkte, Saetze. */
const blick = (p) => p.evaluate(() => {
  const q = (x, r = document) => r.querySelector(x), qa = (x, r = document) => [...r.querySelectorAll(x)];
  const sicht = (e) => !!e && e.getClientRects().length > 0;
  return {
    lage: q("#wkBody")?.dataset.lage || "",
    woche: q("#wkWoche")?.textContent || "", tag: q("#wkTag")?.textContent || "", status: q("#wkStatus")?.textContent || "",
    reiter: qa('#wkReiter [role="tab"]').map((t) => ({ id: t.dataset.wkReiter, name: q(".wkrname", t)?.textContent, fort: q(".wkfort", t)?.textContent,
      an: t.getAttribute("aria-selected") === "true", tab: t.tabIndex })),
    neu: sicht(q("#wkNeu")), voll: q("#wkVoll")?.textContent || "",
    /* folgt Entwurf 01.10.: Kacheln statt aufklappbarer Gruppen (fertig statt zugeklappt), die Punkte des Raids
       als Felder im Raster (data-wk-punkt am Feld, der Name an der Checkbox) */
    gruppen: qa("#wkPanel .wkgruppe").map((g) => ({ g: g.dataset.wkG, name: q(".wkgname", g)?.textContent, zahl: q(".wkgzahl", g)?.textContent,
      fertig: g.classList.contains("fertig"), erl: q(".wkkerl", g)?.textContent || "", liste: sicht(q(".wkliste, .wkraster", g)) })),
    punkte: qa("#wkPanel [data-wk-punkt]").map((li) => {
      const h = q("input[data-wk-haken]", li), z = q('[role="spinbutton"]', li);
      return { k: li.dataset.wkPunkt, name: q(".wkname", li)?.textContent ?? h?.getAttribute("aria-label"), sicht: sicht(li), tag: q(".wktag", li)?.textContent || "",
        haken: h ? h.checked : null, stand: z ? +z.getAttribute("aria-valuenow") : null, menge: z ? +z.getAttribute("aria-valuemax") : null,
        text: z?.textContent || "", wert: z?.getAttribute("aria-valuetext") || "", kisten: qa("button.wkkiste", li).length };
    }),
    satz: (q("#wkBody .wksatz")?.textContent || "").trim(),
  };
});
const punkt = (b, k) => b.punkte.find((x) => x.k === k);
const klick = (p, sel) => p.click(sel);
async function anlegen(s, name) {
  const p = s.page, n = nPosts(s);
  await klick(p, "#wkNeu");
  await p.fill("#wkNeuName", name);
  await p.press("#wkNeuName", "Enter");
  await nachPost(s, n);
}

try {
  // ===== Datei-Modus: ohne Route nur der Satz, nichts taeuscht Speichern vor
  {
    const s = await oeffne({ datei: true });
    const b = await blick(s.page);
    assert(b.lage === "nurApp" && /nur in der App/.test(b.satz) && !b.reiter.length && !b.neu,
      "Datei-Modus: der Satz, dass Weeklies nur in der App gespeichert werden; kein Reiter, kein \u201e+ Charakter\u201c", b);
    assert(/^N\u00e4chster Wochen-Reset: Do 10:00 \u00b7 in 1\u00a0T 0\u00a0Std$/.test(b.woche), "Datei-Modus: die Reset-Anzeige steht trotzdem", b.woche);
    assert(!s.fehler.length, "Datei-Modus: keine Fehler", s.fehler);
    await s.page.close();
  }
  /* ===== GET 503, ein Netzfehler (Pruefung W3, K9) und {ok:true} ohne data (K3): die Datei ist nicht lesbar -
     ein Satz, keine Liste, kein Schreiben; spaeter wird noch einmal gelesen, und der gespeicherte Stand
     uebersteht den ersten Haken danach (K7) */
  for (const [wie, status] of [["503", 503], ["Netzfehler", "abbruch"], ["ohne data", "ohneDaten"]]) {
    const vorher = { v: 1, profile: [profil("wlesen0001", "Gelesen", { zaehler: { illusionen: { stand: 2, seit: berlin(22, 20) },
      zitadelleNormal: { stand: 1, seit: berlin(22, 20) } }, eigene: [{ schluessel: "eigenalt01", name: "Alt", menge: 3, takt: "woche" }] })] };
    const gl = neuesLager(vorher); gl.getStatus = status;
    const s = await oeffne({ lager: gl });
    await s.page.waitForFunction(() => ["gesperrt", "nurApp", "da"].includes(document.querySelector("#wkBody")?.dataset.lage));
    let b = await blick(s.page);
    assert(b.lage === "gesperrt" && /nicht lesen/.test(b.satz) && !b.reiter.length && !b.neu && !gl.posts.length,
      `${wie} beim Lesen: ein ruhiger Satz (nicht „nur in der App“), keine Liste, nichts gesendet`, b);
    gl.getStatus = 200;
    assert(await bis(() => s.page.evaluate(() => document.querySelector("#wkBody")?.dataset.lage === "da"), 15000),
      `${wie} beim Lesen: Borometer liest spaeter noch einmal und zeigt dann die Liste`);
    const n = nPosts(s);
    await s.page.click('input[data-wk-haken="korridorNormal"]');
    await nachPost(s, n);
    await bis(() => gl.data.profile[0].zaehler.korridorNormal?.stand === 1);
    const z = gl.data.profile[0];
    assert(!gl.abgelehnt.length && z.zaehler.korridorNormal?.stand === 1 && z.zaehler.illusionen?.stand === 2 && z.zaehler.zitadelleNormal?.stand === 1
      && z.eigene.length === 1, `${wie} beim Lesen: der erste Haken danach gilt, der gespeicherte Stand bleibt ganz`, { a: gl.abgelehnt.length, z });
    await s.page.close();
  }

  // ===== Anlegen bis sechs, der siebte geht nicht; Reiter mit Fortschritt
  const lager = neuesLager();
  {
    const s = await oeffne({ lager });
    const p = s.page;
    let b = await blick(p);
    assert(b.lage === "da" && !b.reiter.length && b.neu && /Noch kein Charakter/.test(b.satz), "leer: der Satz und \u201e+ Charakter\u201c", b);
    // Pruefung W3, K1: die Live-Region bleibt leer im Baum (nicht display:none), nur optisch zusammengefaltet
    const region = await p.evaluate(() => { const e = document.querySelector("#wkStatus"), c = getComputedStyle(e);
      return { text: e.textContent, display: c.display, sichtbar: c.visibility, hoch: e.getBoundingClientRect().height, rolle: e.getAttribute("role") }; });
    assert(!region.text && region.display !== "none" && region.sichtbar === "visible" && region.hoch === 0 && region.rolle === "status",
      "leere Live-Region: im Baum, ohne Hoehe", region);
    // Abbrechen legt nichts an
    await klick(p, "#wkNeu");
    await p.fill("#wkNeuName", "Zwischen");
    await p.press("#wkNeuName", "Escape");
    b = await blick(p);
    assert(!b.reiter.length && b.neu && !lager.posts.length, "Esc bricht ab, nichts angelegt", b);
    const fokusNeu = await p.evaluate(() => document.activeElement?.id);
    assert(fokusNeu === "wkNeu", "nach Esc steht der Fokus wieder auf \u201e+ Charakter\u201c", fokusNeu);
    // ein leerer Name wird nicht angelegt
    await klick(p, "#wkNeu");
    await p.fill("#wkNeuName", "   ");
    await p.press("#wkNeuName", "Enter");
    b = await blick(p);
    assert(!b.reiter.length && /1 bis 24/.test(b.status) && !lager.posts.length, "leerer Name: ein Satz, nichts angelegt", b.status);
    await p.press("#wkNeuName", "Escape");
    for (const [i, name] of ["Eins", "Zwei", "Drei", "Vier", "Fuenf", "Sechs"].entries()) {
      await anlegen(s, name);
      b = await blick(p);
      assert(b.reiter.length === i + 1 && b.reiter[i].name === name && b.reiter[i].an && b.reiter[i].fort === `0/${N}`,
        `anlegen ${i + 1}: Reiter \u201e${name}\u201c gewaehlt, Fortschritt 0/${N} (folgt Spezifikation 10)`, b.reiter);
    }
    assert(!b.neu && /h\u00f6chstens sechs|Sechs Charaktere/i.test(b.voll), "beim siebten ein Satz statt des Knopfs", { neu: b.neu, voll: b.voll });
    // Pruefung W3, W1/K7: der Satz ist ein Satz - kein Rahmen, kein Zeiger, keine feste Hoehe
    const gestalt = await p.evaluate(() => { const e = document.querySelector("#wkVoll"), c = getComputedStyle(e);
      return { tag: e.tagName, rolle: e.getAttribute("role"), cursor: c.cursor, rahmen: c.boxShadow, rand: c.borderTopStyle, display: c.display,
        hoehe: [...document.styleSheets].flatMap((x) => { try { return [...x.cssRules]; } catch { return []; } })
          .filter((r) => r.selectorText && e.matches(r.selectorText) && r.style.height).map((r) => r.selectorText) }; });
    assert(gestalt.tag === "P" && !gestalt.rolle && gestalt.cursor !== "pointer" && gestalt.rahmen === "none" && gestalt.rand === "none"
      && gestalt.display === "block" && !gestalt.hoehe.length, "der Satz bei sechs sieht nicht wie ein Knopf aus", gestalt);
    const ids = lager.data.profile.map((x) => x.id);
    assert(lager.data.profile.length === 6 && ids.every((x) => ID_RX.test(x)) && new Set(ids).size === 6,
      "gespeichert: sechs Charaktere, jede Kennung w + neun Zeichen, verschieden", ids);
    const langer = await p.evaluate(() => document.querySelector("#wkNeuName"));
    assert(langer === null, "kein Namensfeld, solange sechs da sind");
    // Tablist: Rollen und Tastatur
    await p.focus('#wkReiter [role="tab"][aria-selected="true"]');
    await p.keyboard.press("Home");
    b = await blick(p);
    assert(b.reiter[0].an && b.reiter[0].tab === 0 && b.reiter.slice(1).every((r) => r.tab === -1), "Tastatur: Pos1 waehlt den ersten Reiter, ein Tabstopp", b.reiter);
    await p.keyboard.press("ArrowRight");
    b = await blick(p);
    let fokus = await p.evaluate(() => document.activeElement?.dataset.wkReiter);
    assert(b.reiter[1].an && fokus === b.reiter[1].id, "Tastatur: Pfeil rechts waehlt und fokussiert den zweiten", { fokus, r: b.reiter });
    await p.keyboard.press("End");
    await p.keyboard.press("ArrowRight");
    b = await blick(p);
    fokus = await p.evaluate(() => document.activeElement?.dataset.wkReiter);
    assert(b.reiter[0].an && fokus === b.reiter[0].id, "Tastatur: Ende, dann Pfeil rechts springt zum ersten", fokus);
    await p.keyboard.press("ArrowLeft");
    b = await blick(p);
    assert(b.reiter[5].an, "Tastatur: Pfeil links vom ersten zum letzten", b.reiter.map((r) => r.an));
    const panel = await p.evaluate(() => { const x = document.querySelector("#wkPanel"), t = document.querySelector('#wkReiter [aria-selected="true"]');
      return { rolle: x?.getAttribute("role"), von: x?.getAttribute("aria-labelledby"), tab: t?.id, steuert: t?.getAttribute("aria-controls"),
        liste: document.querySelector("#wkReiter")?.getAttribute("role"), name: document.querySelector("#wkReiter")?.getAttribute("aria-label") }; });
    assert(panel.rolle === "tabpanel" && panel.von === panel.tab && panel.steuert === "wkPanel" && panel.liste === "tablist" && !!panel.name,
      "Vorleser: Tablist mit Namen, das Feld ist tabpanel und nach dem Reiter benannt", panel);
    assert(!lager.abgelehnt.length && !s.fehler.length, "anlegen: jeder gesendete Stand gilt, keine Fehler", { a: lager.abgelehnt, f: s.fehler });
    await p.close();
  }

  // ===== Umbenennen, Loesen und Rueckgaengig, auch nach Neuladen
  {
    const s = await oeffne({ lager });
    const p = s.page;
    await p.click('#wkReiter [data-wk-reiter]:nth-child(2)');
    let b = await blick(p);
    const zwei = b.reiter[1].id;
    assert(b.reiter[1].an && b.reiter[1].name === "Zwei", "nach Neuladen: die sechs Reiter, der zweite gewaehlt", b.reiter);
    let n = nPosts(s);
    await klick(p, "[data-wk-umbenennen]");
    const vorbelegt = await p.inputValue("#wkNameNeu");
    await p.fill("#wkNameNeu", "Zwei Neu");
    await p.press("#wkNameNeu", "Enter");
    await nachPost(s, n);
    b = await blick(p);
    assert(vorbelegt === "Zwei" && b.reiter[1].name === "Zwei Neu" && lager.data.profile.find((x) => x.id === zwei).name === "Zwei Neu",
      "umbenennen: das Feld traegt den alten Namen, der Reiter und die Datei den neuen", { vorbelegt, r: b.reiter[1] });
    const maxlen = await p.evaluate(() => { document.querySelector("[data-wk-umbenennen]").click(); return document.querySelector("#wkNameNeu")?.maxLength; });
    assert(maxlen === 24, "umbenennen: hoechstens 24 Zeichen", maxlen);
    await p.press("#wkNameNeu", "Escape");
    // loesen
    n = nPosts(s);
    await klick(p, "[data-wk-loesen]");
    await nachPost(s, n);
    b = await blick(p);
    const undo = await p.evaluate(() => ({ satz: document.querySelector(".wkgeloest")?.textContent || "", fokus: document.activeElement?.hasAttribute("data-wk-undo") }));
    const gespeichert = lager.data.profile.find((x) => x.id === zwei);
    assert(b.reiter.length === 5 && !b.reiter.some((r) => r.id === zwei) && gespeichert && gespeichert.geloest === true && lager.data.profile.length === 6,
      "loesen: der Reiter ist weg, in der Datei bleibt er mit geloest", { r: b.reiter, g: gespeichert });
    assert(/Zwei Neu/.test(undo.satz) && undo.fokus, "loesen: ein Satz mit \u201eRueckgaengig\u201c, der Fokus darauf", undo);
    assert(b.neu, "nach dem Loesen ist wieder Platz: \u201e+ Charakter\u201c steht da", b.neu);
    n = nPosts(s);
    await klick(p, "[data-wk-undo]");
    await nachPost(s, n);
    b = await blick(p);
    assert(b.reiter.length === 6 && b.reiter.find((r) => r.id === zwei)?.an && lager.data.profile.find((x) => x.id === zwei).geloest !== true,
      "Rueckgaengig: der Reiter ist zurueck und gewaehlt", b.reiter);
    // noch einmal loesen und neu laden
    n = nPosts(s);
    await klick(p, "[data-wk-loesen]");
    await nachPost(s, n);
    await p.close();
    const t = await oeffne({ lager });
    const q = t.page;
    b = await blick(q);
    assert(b.reiter.length === 5 && !b.reiter.some((r) => r.id === zwei), "nach Neuladen: der geloeste Charakter hat keinen Reiter", b.reiter);
    await klick(q, "[data-wk-geloeste]");
    const liste = await q.evaluate(() => [...document.querySelectorAll("[data-wk-zurueck]")].map((x) => ({ id: x.dataset.wkZurueck, text: x.closest("li")?.textContent })));
    assert(liste.length === 1 && liste[0].id === zwei && /Zwei Neu/.test(liste[0].text), "\u201eGeloeste Charaktere zeigen\u201c: er steht mit \u201eZurueckholen\u201c da", liste);
    n = nPosts(t);
    await klick(q, `[data-wk-zurueck="${zwei}"]`);
    await nachPost(t, n);
    b = await blick(q);
    assert(b.reiter.length === 6 && b.reiter.find((r) => r.id === zwei)?.an && lager.data.profile.find((x) => x.id === zwei).geloest !== true,
      "Zurueckholen nach Neuladen: der Reiter ist wieder da", b.reiter);
    assert(!lager.abgelehnt.length && !s.fehler.length && !t.fehler.length, "umbenennen und loesen: jeder gesendete Stand gilt, keine Fehler",
      { a: lager.abgelehnt, f: [...s.fehler, ...t.fehler] });
    await q.close();
  }

  // ===== Haken, Zaehler, Name +1, erledigte Kachel tritt zurueck, Tastatur am Zaehler
  {
    const s = await oeffne({ lager });
    const p = s.page;
    await p.click('#wkReiter [data-wk-reiter]:nth-child(1)');
    let b = await blick(p);
    const eins = b.reiter[0].id;
    const alle = b.punkte.map((x) => x.k);
    /* folgt Entwurf 01.10. und Spezifikation 10: die Grundliste in der Lesefolge der Kacheln, der Raid zeilenweise (Normal, Schwer,
       Albtraum), danach Geheimdungeon, Events, Dimensionspruefung und die Haendler in ihrer Folge, je Gruppe in der Folge des Kerns */
    const FOLGE = ["zitadelleNormal", "korridorNormal", "altarNormal", "zitadelleSchwer", "korridorSchwer", "altarSchwer", "zitadelleAlbtraum", "korridorAlbtraum",
      "altarAlbtraum", ...["geheimdungeon", "events", "dimension", ...HAENDLER].flatMap(vonGruppe)];
    assert(JSON.stringify(alle) === JSON.stringify(FOLGE) && JSON.stringify([...alle].sort()) === JSON.stringify(kern.GRUNDLISTE.map((x) => x.schluessel).sort()),
      `die Grundliste in der Lesefolge der Kacheln, jeder der ${N} Punkte genau einmal (folgt Spezifikation 10)`, alle);
    assert(JSON.stringify(b.gruppen.map((g) => g.g)) === JSON.stringify(KACHELN) && !b.gruppen.some((g) => g.g === "taeglich")
      && b.gruppen.find((g) => g.g === "dimension")?.name === "Dimensionsprüfung" && b.gruppen.find((g) => g.g === "haendler")?.name === "Händler",
      "fuenf Kacheln in der Lesefolge: Raid, Geheimdungeon, Events, Dimensionsprüfung, Händler; keine Kachel „Täglich“ mehr (folgt Spezifikation 10)", b.gruppen);
    const TAKTWORT = { woche: "", montag: "", tag:"täglich", monat: "monatlich" };
    assert(kern.GRUNDLISTE.every((g) => g.takt in TAKTWORT && punkt(b, g.schluessel).tag === TAKTWORT[g.takt]) && punkt(b, "phantomstein").tag === "täglich"
      && punkt(b, "vererbungsstein").tag === "monatlich",
      "„täglich“ genau an den Tagespunkten, „monatlich“ genau am Monatspunkt (folgt Spezifikation 10)", b.punkte.filter((x) => x.tag));
    // folgt Spezifikation 10: die goldene Truhe ist weder Haken noch Zaehler, sondern fuenf Truhenknoepfe
    assert(kern.GRUNDLISTE.every((g) => g.schluessel === "goldeneKiste"
      ? punkt(b, g.schluessel).haken === null && punkt(b, g.schluessel).stand === null && punkt(b, g.schluessel).kisten === g.menge
      : (g.menge === 1) === (punkt(b, g.schluessel).haken !== null) && (g.menge === 1 || punkt(b, g.schluessel).menge === g.menge) && !punkt(b, g.schluessel).kisten),
      "Menge 1 ist ein Haken, mehr ein Zaehler bis zur Menge, die goldene Truhe fuenf Truhenknoepfe", b.punkte);
    // Haken
    let n = nPosts(s);
    await p.click('input[data-wk-haken="zitadelleNormal"]');
    await nachPost(s, n);
    b = await blick(p);
    let z = lager.data.profile.find((x) => x.id === eins).zaehler;
    assert(punkt(b, "zitadelleNormal").haken && b.reiter[0].fort === `1/${N}` && z.zitadelleNormal?.stand === 1 && Math.abs(z.zitadelleNormal.seit - MI_0955) < 600000,
      `Haken: gesetzt, Reiter 1/${N}, gespeichert als {stand 1, seit jetzt} (folgt Spezifikation 10)`, { z: z.zitadelleNormal, fort: b.reiter[0].fort });
    // Pruefung W3, K8: der Vorleser hoert "taeglich" am Haken (aria-describedby)
    const beschr = await p.evaluate(() => { const e = document.querySelector('input[data-wk-haken="phantomstein"]'), w = document.querySelector('input[data-wk-haken="zitadelleNormal"]');
      return { tag: (e.getAttribute("aria-describedby") || "").split(" ").map((i) => document.getElementById(i)?.textContent).join(" "), woche: (w.getAttribute("aria-describedby") || "").split(" ").map((i) => document.getElementById(i)?.textContent).join(" ") }; });
    // folgt Pruefung N3: ein Wochenpunkt im Raster beschreibt nur die Tastatur, nie "taeglich"
    assert(beschr.tag === "t\u00e4glich" && beschr.woche === "Pfeiltasten wechseln das Feld, die Leertaste hakt.",
      "Vorleser: Tagespunkte beschreibt \u201et\u00e4glich\u201c, ein Wochenpunkt im Raster nur die Tastatur", beschr);
    // Klick auf das Feld im Raster setzt den Haken (folgt Entwurf 01.10.: das Feld traegt keinen Namen)
    n = nPosts(s);
    await p.click('.wkzelle[data-wk-punkt="zitadelleSchwer"]');
    await nachPost(s, n);
    b = await blick(p);
    assert(punkt(b, "zitadelleSchwer").haken && b.reiter[0].fort === `2/${N}`, "Klick auf das Feld im Raid-Raster setzt den Haken", b.reiter[0].fort);
    // Klick auf den Namen eines Hakens setzt ihn auch - und wieder zurueck
    n = nPosts(s);
    await p.click('li[data-wk-punkt="siegelschluessel"] .wkname');
    await nachPost(s, n);
    b = await blick(p);
    assert(punkt(b, "siegelschluessel").haken && b.reiter[0].fort === `3/${N}`, "Klick auf den Namen eines Hakens setzt ihn", b.reiter[0].fort);
    n = nPosts(s);
    await p.click('li[data-wk-punkt="siegelschluessel"] .wkname');
    await nachPost(s, n);
    b = await blick(p);
    assert(!punkt(b, "siegelschluessel").haken && b.reiter[0].fort === `2/${N}`, "noch ein Klick auf den Namen nimmt ihn zurueck", b.reiter[0].fort);
    // Zaehler
    const stand = async (k) => punkt(await blick(p), k);
    n = nPosts(s);
    await p.click('.wkschritt[data-wk-plus="illusionen"]');
    await nachPost(s, n);
    let x = await stand("illusionen");
    assert(x.stand === 1 && x.text === "1/3" && x.wert === "1 von 3", "Zaehler +: 1/3, fuer den Vorleser \u201e1 von 3\u201c", x);
    await p.click('[data-wk-minus="illusionen"]');
    x = await stand("illusionen");
    assert(x.stand === 0 && x.text === "0/3", "Zaehler \u2212: 0/3", x);
    const minusAus = await p.evaluate(() => document.querySelector('[data-wk-minus="illusionen"]').disabled);
    assert(minusAus, "bei 0 ist \u2212 gesperrt", minusAus);
    await p.click('li[data-wk-punkt="illusionen"] button.wkname');
    x = await stand("illusionen");
    assert(x.stand === 1, "Klick auf den Namen zaehlt +1", x);
    n = nPosts(s);
    await p.click('[data-wk-voll="umwandlungsstein"]');
    await nachPost(s, n);
    x = await stand("umwandlungsstein");
    const vollAus = await p.evaluate(() => ({ voll: document.querySelector('[data-wk-voll="umwandlungsstein"]').disabled,
      plus: document.querySelector('.wkschritt[data-wk-plus="umwandlungsstein"]').disabled, fokus: document.activeElement?.dataset.wkStand }));
    assert(x.stand === 100 && x.text === "100/100" && vollAus.voll && vollAus.plus, "voll: 100/100, + und voll gesperrt", { x, vollAus });
    assert(vollAus.fokus === "umwandlungsstein", "nach \u201evoll\u201c steht der Fokus auf dem Zaehler", vollAus.fokus);
    await bis(() => lager.data.profile.find((y) => y.id === eins).zaehler.umwandlungsstein?.stand === 100);
    // Tastatur am Zaehler (in einer Kachel, die dabei nicht fertig wird)
    await p.focus('[role="spinbutton"][data-wk-stand="mystischerSchluessel"]');
    await p.keyboard.press("ArrowUp");
    await p.keyboard.press("ArrowUp");
    x = await stand("mystischerSchluessel");
    const f1 = await p.evaluate(() => document.activeElement?.dataset.wkStand);
    assert(x.stand === 2 && f1 === "mystischerSchluessel", "Tastatur: zweimal Pfeil hoch zaehlt 2, der Fokus bleibt", { x, f1 });
    await p.keyboard.press("ArrowDown");
    assert((await stand("mystischerSchluessel")).stand === 1, "Tastatur: Pfeil runter zaehlt 1");
    await p.keyboard.press("End");
    assert((await stand("mystischerSchluessel")).stand === 5, "Tastatur: Ende setzt voll");
    await p.keyboard.press("Home");
    assert((await stand("mystischerSchluessel")).stand === 0, "Tastatur: Pos1 setzt 0");
    const rolle = await p.evaluate(() => { const e = document.querySelector('[data-wk-stand="mystischerSchluessel"]');
      return { r: e.getAttribute("role"), min: e.getAttribute("aria-valuemin"), max: e.getAttribute("aria-valuemax"), name: e.getAttribute("aria-label"), tab: e.tabIndex }; });
    assert(rolle.r === "spinbutton" && rolle.min === "0" && rolle.max === "5" && rolle.name === "Mystischer Schlüssel" && rolle.tab === 0,
      "Vorleser: der Zaehler ist ein spinbutton mit Namen und Grenzen", rolle);
    /* Kachel Geheimdungeon fertig - folgt Entwurf 01.10. (Spezifikation 9): erledigte Kacheln treten zurueck und
       verschwinden nicht (statt zuzuklappen); dieselben Fragen: Zustand, Fokus, zurueck, die anderen - dazu der Grund.
       Folgt Spezifikation 10: die Zahl der Punkte der Kachel kommt aus dem Kern; weitere Haken darin werden vorher gesetzt */
    await p.click('[data-wk-voll="illusionen"]');
    for (const k of GD_MEHR) { n = nPosts(s); await p.click(`input[data-wk-haken="${k}"]`); await nachPost(s, n); }
    n = nPosts(s);
    await p.click('input[data-wk-haken="unendlichkeit"]');
    await nachPost(s, n);
    b = await blick(p);
    let g = b.gruppen.find((y) => y.g === "geheimdungeon");
    const gf = await p.evaluate(() => document.activeElement?.dataset.wkHaken);
    assert(g.fertig && g.erl === "erledigt" && g.liste && g.zahl === `${GD.length}/${GD.length}` && GD.every((k) => punkt(b, k).sicht),
      `erledigte Kachel tritt zurueck (fertig, „erledigt“, ${GD.length}/${GD.length}), ihre Punkte bleiben sichtbar`, g);
    assert(gf === "unendlichkeit", "der Fokus bleibt auf dem Haken", gf);
    const grund = await p.evaluate(() => [...document.querySelectorAll("#wkPanel .wkgruppe")].map((x) => ({ g: x.dataset.wkG, bg: getComputedStyle(x).backgroundColor })));
    const bgFertig = grund.find((x) => x.g === "geheimdungeon")?.bg;
    assert(grund.filter((x) => x.g !== "geheimdungeon").every((x) => x.bg !== bgFertig), "die erledigte Kachel hat einen anderen Grund als die offenen", grund);
    await p.click('[data-wk-minus="illusionen"]');
    b = await blick(p);
    g = b.gruppen.find((y) => y.g === "geheimdungeon");
    assert(!g.fertig && !g.erl && g.liste && g.zahl === `${GD.length - 1}/${GD.length}`, `ein Punkt zurueck: die Kachel ist wieder offen, ${GD.length - 1}/${GD.length}`, g);
    n = nPosts(s);
    await p.click('[data-wk-voll="illusionen"]');
    await nachPost(s, n);
    b = await blick(p);
    const offen = b.gruppen.filter((y) => y.g !== "geheimdungeon").every((y) => !y.fertig && y.liste) && b.gruppen.find((y) => y.g === "geheimdungeon").fertig;
    assert(offen, "offene Kacheln treten nicht zurueck", b.gruppen);
    // Fortschritt: Zitadelle 2, Umwandlung, Illusionen, Unendlichkeit (und die weiteren Haken des Geheimdungeons)
    assert(b.reiter[0].fort === `${ERL}/${N}`, "Reiter: erledigt/gesamt der sichtbaren Punkte", b.reiter[0].fort);
    assert(!lager.abgelehnt.length && !s.fehler.length, "Haken und Zaehler: jeder gesendete Stand gilt, keine Fehler", { a: lager.abgelehnt, f: s.fehler });
    await p.close();
  }

  // ===== Anpassen: ausblenden, umbenennen, eigener Punkt, loesen, Grundliste wiederherstellen
  {
    const s = await oeffne({ lager });
    const p = s.page;
    await p.click('#wkReiter [data-wk-reiter]:nth-child(1)');
    const eins = (await blick(p)).reiter[0].id;
    await klick(p, "[data-wk-anpassen]");
    const anp = await p.evaluate(() => ({ zeilen: [...document.querySelectorAll("#wkPanel li.wkanp")].map((l) => l.dataset.wkAnp),
      gedrueckt: document.querySelector("[data-wk-anpassen]")?.getAttribute("aria-pressed") }));
    assert(anp.zeilen.length === N && anp.gedrueckt === "true", `Anpassen: alle ${N} Punkte, der Knopf gedrueckt (folgt Spezifikation 10)`, anp);
    let n = nPosts(s);
    await p.click('[data-wk-aus="katalysator"]');
    await nachPost(s, n);
    let pr = lager.data.profile.find((x) => x.id === eins);
    assert(pr.aus.includes("katalysator"), "ausblenden: gespeichert in aus", pr.aus);
    const ein = await p.evaluate(() => document.querySelector('[data-wk-aus="katalysator"]')?.textContent);
    assert(ein === "Einblenden", "ausgeblendet: der Knopf heisst Einblenden", ein);
    // umbenennen
    n = nPosts(s);
    await p.click('[data-wk-umben="chaosprisma"]');
    await p.fill("#wkPunktName", "Prisma fuer Waffe");
    await p.press("#wkPunktName", "Enter");
    await nachPost(s, n);
    pr = lager.data.profile.find((x) => x.id === eins);
    assert(pr.namen.chaosprisma === "Prisma fuer Waffe", "umbenennen: gespeichert in namen", pr.namen);
    // eigener Punkt
    n = nPosts(s);
    await p.fill("#wkEigenName", "Gildenkiste");
    await p.fill("#wkEigenMenge", "2");
    await p.selectOption("#wkEigenTakt", "tag");
    await p.click("[data-wk-eigen-neu]");
    await nachPost(s, n);
    pr = lager.data.profile.find((x) => x.id === eins);
    const ei = pr.eigene[0];
    assert(pr.eigene.length === 1 && EIGEN_RX.test(ei.schluessel) && ei.name === "Gildenkiste" && ei.menge === 2 && ei.takt === "tag",
      "eigener Punkt: Name, Menge, Takt, Schluessel eigen...", pr.eigene);
    const grenzen = await p.evaluate(() => { const m = document.querySelector("#wkEigenMenge"); return { min: m.min, max: m.max, nl: document.querySelector("#wkEigenName").maxLength }; });
    assert(grenzen.min === "1" && grenzen.max === "999" && grenzen.nl === 60, "eigener Punkt: Menge 1 bis 999, Name hoechstens 60", grenzen);
    await klick(p, "[data-wk-anpassen]");
    let b = await blick(p);
    const kiste = punkt(b, ei.schluessel);
    const kb = await p.evaluate((k) => { const e = document.querySelector(`[role="spinbutton"][data-wk-stand="${k}"]`);
      return (e?.getAttribute("aria-describedby") || "").split(" ").map((i) => document.getElementById(i)?.textContent).join(" "); }, ei.schluessel);
    assert(kb === "t\u00e4glich", "Vorleser: der Zaehler eines taeglichen eigenen Punkts beschreibt \u201et\u00e4glich\u201c (K8)", kb);
    assert(!punkt(b, "katalysator") && punkt(b, "chaosprisma").name === "Prisma fuer Waffe" && kiste && kiste.menge === 2 && kiste.tag === "t\u00e4glich"
      && b.gruppen.at(-1).g === "eigene" && b.gruppen.at(-1).name === "Eigene", "Liste: ohne Katalysator, Prisma umbenannt, Gildenkiste unter \u201eEigene\u201c, täglich", b.gruppen);
    assert(b.reiter[0].fort === `${ERL}/${N}`, `Fortschritt der sichtbaren: ${N - 1} der Grundliste und 1 eigener (folgt Spezifikation 10)`, b.reiter[0].fort);
    // eigener Punkt zaehlt
    n = nPosts(s);
    await p.click(`.wkschritt[data-wk-plus="${ei.schluessel}"]`);
    await nachPost(s, n);
    assert(lager.data.profile.find((x) => x.id === eins).zaehler[ei.schluessel]?.stand === 1, "eigener Punkt zaehlt und wird gespeichert");
    // eigener Punkt loesen und zurueck
    await klick(p, "[data-wk-anpassen]");
    n = nPosts(s);
    await p.click(`[data-wk-eigen-los="${ei.schluessel}"]`);
    await nachPost(s, n);
    pr = lager.data.profile.find((x) => x.id === eins);
    const eu = await p.evaluate(() => ({ satz: document.querySelector(".wkgeloest")?.textContent || "", fokus: document.activeElement?.hasAttribute("data-wk-undo") }));
    assert(pr.eigene.length === 1 && pr.eigene[0].geloest === true && /Gildenkiste/.test(eu.satz) && eu.fokus,
      "eigenen Punkt loesen: bleibt mit geloest, Satz mit Rueckgaengig und Fokus", { e: pr.eigene, eu });
    n = nPosts(s);
    await p.click("[data-wk-undo]");
    await nachPost(s, n);
    pr = lager.data.profile.find((x) => x.id === eins);
    assert(pr.eigene[0].geloest !== true, "Rueckgaengig: der eigene Punkt ist zurueck", pr.eigene);
    // Grundliste wiederherstellen
    n = nPosts(s);
    await p.click("[data-wk-grundliste]");
    await nachPost(s, n);
    pr = lager.data.profile.find((x) => x.id === eins);
    assert(pr.aus.length === 0 && pr.namen.chaosprisma === "Prisma fuer Waffe", "Grundliste wiederherstellen: alles eingeblendet, Namen bleiben", pr);
    await klick(p, "[data-wk-anpassen]");
    b = await blick(p);
    assert(punkt(b, "katalysator") && b.punkte.length === N + 1 && b.reiter[0].fort === `${ERL}/${N + 1}`, `danach wieder ${N} Grundpunkte und der eigene (folgt Spezifikation 10)`, b.reiter[0]);
    assert(!lager.abgelehnt.length && !s.fehler.length, "Anpassen: jeder gesendete Stand gilt, keine Fehler", { a: lager.abgelehnt, f: s.fehler });
    await p.close();
  }

  /* ===== Neugestaltung "Wochenband" (Spezifikation 9, 01.10.2026): das Raid-Raster 3x3 mit Bossbildern, die
     Pfeiltasten im Raster, der Fuellring n/Menge, die Ringe an den Reitern und das Wochenband mit dem Jetzt-Strich
     (gestellte Uhr Mi 23.09. 09:55, dann im Minutentakt ueber den Tages-Reset) */
  {
    const seit = berlin(22, 20);
    const wl = neuesLager({ v: 1, profile: [
      profil("wband00001", "Band", { zaehler: { zitadelleNormal: { stand: 1, seit }, umwandlungsstein: { stand: 60, seit }, illusionen: { stand: 3, seit },
        unendlichkeit: { stand: 1, seit }, freischaltFragment: { stand: 40, seit }, regionszertifikat: { stand: 1, seit } },
        namen: { korridorSchwer: "Korridor mit einem sehr langen eigenen Namen fuer das Feld" },
        eigene: [{ schluessel: "eigenband01", name: "Kiste", menge: 2, takt: "tag" }] }),
      profil("wband00002", "Zwei", { zaehler: { altarNormal: { stand: 1, seit } }, aus: ["korridorNormal", "korridorSchwer", "korridorAlbtraum", "altarAlbtraum"] })] });
    const s = await oeffne({ lager: wl, breite: 1280, hoehe: 860 });
    const p = s.page;
    // --- das Wochenband
    const band = () => p.evaluate(() => {
      const b = document.querySelector("#wkBand"), bahn = b.querySelector(".wkbahn").getBoundingClientRect(), j = b.querySelector(".wkjetzt").getBoundingClientRect();
      return { name: b.getAttribute("aria-label"), text: b.querySelector(".wkbandjetzt").textContent, w: bahn.width, x: j.left + j.width / 2 - bahn.left,
        tage: [...b.querySelectorAll(".wkbtag")].map((t) => ({ t: t.textContent, heute: t.classList.contains("heute"), vorbei: t.classList.contains("vorbei"),
          l: t.getBoundingClientRect().left - bahn.left, r: t.getBoundingClientRect().right - bahn.left })),
        breit: b.getBoundingClientRect().width, waben: document.querySelector(".wkwaben").getBoundingClientRect().width,
        gold: getComputedStyle(b.querySelector(".wkjetzt")).backgroundColor, zahl: getComputedStyle(document.querySelector(".wkgzahl b")).color };
    });
    let bd = await band();
    const W = 7 * 1440;
    assert(Math.abs(bd.x - bd.w * (6 * 1440 - 5) / W) <= 1, "Wochenband Mi 09:55: der Jetzt-Strich steht bei 6 Tagen weniger 5 Minuten von 7 Tagen", { x: bd.x, soll: bd.w * (6 * 1440 - 5) / W });
    assert(bd.tage.map((t) => t.t).join() === "Do,Fr,Sa,So,Mo,Di,Mi" && bd.tage.findIndex((t) => t.heute) === 5 && bd.tage.filter((t) => t.vorbei).length === 5
      && bd.tage.every((t, i) => Math.abs(t.l - bd.w * i / 7) <= 1) && bd.x >= bd.tage[5].l && bd.x <= bd.tage[5].r,
      "Wochenband: sieben Tage Do bis Mi ab 10:00, heute ist noch der Dienstag-Abschnitt (vor dem Tages-Reset), der Strich steht darin", bd.tage);
    assert(bd.text === "jetzt Mi 09:55 \u00b7 Reset in 1\u00a0T 0\u00a0Std" && bd.name === "Die Woche vom Do 17.09. 10:00 bis Do 24.09. 10:00",
      "Wochenband: „jetzt Mi 09:55 \u00b7 Reset in 1 T 0 Std“, fuer den Vorleser die Woche mit Datum (Pruefung N4)", { t: bd.text, n: bd.name });
    assert(Math.abs(bd.breit - bd.waben) <= 1 && bd.gold === bd.zahl, "Wochenband ueber die volle Breite, der Strich in Gold wie die Fortschrittszahl", bd);
    await vorspulen(s, 6 * 60000);
    await bis(async () => (await band()).text.includes("10:01"));
    bd = await band();
    assert(Math.abs(bd.x - bd.w * (6 * 1440 + 1) / W) <= 1 && bd.tage.findIndex((t) => t.heute) === 6 && bd.text === "jetzt Mi 10:01 \u00b7 Reset in 23\u00a0Std 59\u00a0Min",
      "im Minutentakt ueber den Tages-Reset: der Strich wandert, heute ist der Mittwoch-Abschnitt", { x: bd.x, soll: bd.w * (6 * 1440 + 1) / W, t: bd.text, h: bd.tage.map((t) => t.heute) });
    // --- das Raster
    const raster = () => p.evaluate((bilder) => {
      const t = document.querySelector('#wkPanel [data-wk-g="raid"] table.wkraster');
      if (!t) return null;
      const bild = (e) => ({ bg: getComputedStyle(e).backgroundImage.slice(0, 40), w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, rund: getComputedStyle(e).borderRadius,
        ...(bilder ? {} : { init: e.classList.contains("init"), anfang: e.textContent }) });
      return { titel: t.querySelector("caption")?.textContent,
        kopf: [...t.querySelectorAll('thead th[scope="col"]')].map((th) => ({ name: bilder ? th.textContent.trim() : th.querySelector(".wkkopfname")?.textContent.trim(), ...bild(th.querySelector(".wkbild")),
          voll: getComputedStyle(th.querySelector(".wkbild")).backgroundImage })),
        zeilen: [...t.querySelectorAll("tbody tr")].map((tr) => ({ stufe: tr.querySelector('th[scope="row"]')?.textContent,
          felder: [...tr.querySelectorAll("td")].map((td) => td.querySelector("input[data-wk-haken]")?.dataset.wkHaken || "") })),
        an: [...t.querySelectorAll(".wkzelle.an")].map((l) => l.dataset.wkPunkt), tab: [...t.querySelectorAll("input")].filter((i) => i.tabIndex === 0).map((i) => i.dataset.wkHaken),
        namen: [...t.querySelectorAll("input")].map((i) => i.getAttribute("aria-label")).slice(0, 3) };
    }, BILDER);
    let r = await raster();
    assert(r && r.kopf.map((k) => k.name).join() === "Die vergessene Zitadelle,Der Korridor der Pein,Der Altar der Wiedergeburt"
      && (BILDER ? r.kopf.every((k) => /^url\("?data:image\/webp;base64,/.test(k.bg) && k.w >= 36 && k.w === k.h && k.rund === "50%") && new Set(r.kopf.map((k) => k.voll)).size === 3
        : r.kopf.every((k) => k.init && k.anfang === bilder.wkAnfang(k.name) && k.anfang.length === 1 && k.bg === "none" && k.voll === "none" && k.w >= 36 && k.w === k.h && k.rund === "50%")
          && new Set(r.kopf.map((k) => k.anfang)).size === 3),
      "Raster: die drei Fluegel als Spalten, oben je ein rundes, eingebettetes Bossbild (drei verschiedene)" + (BILDER ? "" : " (ohne Spielbilder: runde Platte mit dem Anfang des Namens)"), r && r.kopf.map(({ voll, ...k }) => k));
    assert(r && JSON.stringify(r.zeilen) === JSON.stringify(["Normal", "Schwer", "Albtraum"].map((st) => ({ stufe: st, felder: ["zitadelle", "korridor", "altar"].map((f) => f + st) })))
      && r.titel === "Raid \u2013 Altar von Calanthia" && r.namen.join() === "Die vergessene Zitadelle \u2013 Normal,Der Korridor der Pein \u2013 Normal,Der Altar der Wiedergeburt \u2013 Normal",
      "Raster 3x3: Normal, Schwer, Albtraum als Zeilen, je Fluegel ein Haken mit vollem Namen", r && { z: r.zeilen, t: r.titel, n: r.namen });
    assert(r && r.an.join() === "zitadelleNormal" && r.tab.join() === "zitadelleNormal", "Raster: das abgehakte Feld ist gefuellt, ein Tabstopp im Raster", r && { an: r.an, tab: r.tab });
    // --- die Pfeiltasten im Raster
    const wo = () => p.evaluate(() => ({ f: document.activeElement?.dataset.wkHaken || document.activeElement?.tagName,
      tab: [...document.querySelectorAll(".wkraster input")].filter((i) => i.tabIndex === 0).map((i) => i.dataset.wkHaken).join(),
      roll: document.querySelector(".wkrollt").scrollTop }));
    await p.focus('input[data-wk-haken="zitadelleNormal"]');
    const roll0 = (await wo()).roll, n0 = nPosts(s);
    const wege = [["ArrowRight", "korridorNormal"], ["ArrowDown", "korridorSchwer"], ["End", "altarSchwer"], ["ArrowRight", "altarSchwer"], ["Home", "zitadelleSchwer"],
      ["ArrowUp", "zitadelleNormal"], ["ArrowUp", "zitadelleNormal"], ["Control+End", "altarAlbtraum"], ["ArrowDown", "altarAlbtraum"], ["Control+Home", "zitadelleNormal"], ["ArrowRight", "korridorNormal"]];
    const gegangen = [];
    for (const [taste, ziel] of wege) { await p.keyboard.press(taste); const w = await wo(); gegangen.push({ taste, ziel, ...w }); }
    assert(gegangen.every((x) => x.f === x.ziel && x.tab === x.ziel && x.roll === roll0) && nPosts(s) === n0,
      "Raster: Pfeile, Pos1/Ende und Strg+Pos1/Ende wandern von Feld zu Feld, am Rand bleibt der Fokus; der Tabstopp wandert mit, nichts rollt, nichts gespeichert",
      gegangen.filter((x) => x.f !== x.ziel || x.tab !== x.ziel || x.roll !== roll0));
    await p.keyboard.press("Space");
    await nachPost(s, n0);
    r = await raster();
    const fk = await wo();
    assert(r.an.join() === "zitadelleNormal,korridorNormal" && fk.f === "korridorNormal" && fk.tab === "korridorNormal",
      "Raster: die Leertaste hakt das Feld, der Fokus bleibt darauf", { an: r.an, fk });
    // --- der Fuellring um das Symbol zeigt n/Menge (folgt Spezifikation 10: bei der goldenen Truhe zaehlen die gefuellten Truhen)
    /* ohne Spielbilder: die Marke, die jeder Punkt zeigen soll (WK_MARKE[k] ?? WK_MARKE.eigen, wie 59-weeklies.ts) */
    const SOLL = BILDER ? null : Object.fromEntries([...kern.GRUNDLISTE.map((g) => g.schluessel), "eigenband01"].map((k) => [k, bilder.WK_MARKE[k] ?? bilder.WK_MARKE.eigen]));
    const ringe = () => p.evaluate((soll) => [...document.querySelectorAll("#wkPanel li.wkpunkt")].map((li) => {
      const rf = li.querySelector(".wksym .wkring .rf"), icon = li.querySelector(".wksym .wkicon"), z = li.querySelector('[role="spinbutton"]'), h = li.querySelector("input[data-wk-haken]");
      const ki = li.querySelectorAll("button.wkkiste");
      return { k: li.dataset.wkPunkt, a: rf ? parseFloat(rf.getAttribute("stroke-dasharray")) : null, strich: rf ? getComputedStyle(rf).stroke : "",
        s: z ? +z.getAttribute("aria-valuenow") : ki.length ? li.querySelectorAll('button.wkkiste[aria-pressed="true"]').length : h?.checked ? 1 : 0,
        m: z ? +z.getAttribute("aria-valuemax") : ki.length || 1,
        bild: icon ? getComputedStyle(icon).backgroundImage.startsWith("url(") : false, marke: !!icon?.querySelector("svg"), w: icon?.getBoundingClientRect().width,
        ring: li.querySelector(".wksym .wkring")?.getBoundingClientRect().width,
        ...(soll ? { sollMarke: (() => { const v = document.createElement("span"); v.innerHTML = soll[li.dataset.wkPunkt] ?? ""; return !!icon && !!v.innerHTML && v.innerHTML === icon.innerHTML; })() } : {}) };
    }), SOLL);
    let rg = await ringe();
    /* folgt Spezifikation 10: welche Punkte ein Bild tragen und welche eine gezeichnete Marke, sagt 60-weeklies-bilder.ts;
       jeder Punkt ausserhalb des Raids hat genau eins davon, keiner faellt auf die Raute der eigenen Punkte zurueck */
    const OHNE_RAID = kern.GRUNDLISTE.filter((g) => g.gruppe !== "raid").map((g) => g.schluessel);
    const BILD = OHNE_RAID.filter((k) => bilder.wkHatBild(k)), MARKE = OHNE_RAID.filter((k) => !bilder.wkHatBild(k));
    const falsch = rg.filter((x) => x.a === null || Math.abs(x.a - Math.round(x.s / x.m * 10000) / 100) > 0.001 || (x.s === 0) !== (x.strich === "none"));
    assert(rg.length === OHNE_RAID.length + 1 && !falsch.length && rg.find((x) => x.k === "umwandlungsstein").a === 60 && rg.find((x) => x.k === "freischaltFragment").a === 53.33
      && rg.find((x) => x.k === "regionszertifikat").a === 33.33 && rg.find((x) => x.k === "illusionen").a === 100,
      `Fuellring: jeder der ${OHNE_RAID.length + 1} Punkte zeigt n/Menge (60/100, 40/75, 1/3, 3/3; leer ohne Strich) (folgt Spezifikation 10)`, { falsch, n: rg.length });
    assert(BILDER ? MARKE.every((k) => Object.hasOwn(bilder.WK_MARKE, k)) && MARKE.includes("dimensionDungeons") && BILD.includes("goldeneKiste")
      && rg.every((x) => BILD.includes(x.k) ? x.bild && !x.marke : MARKE.includes(x.k) || x.k === "eigenband01" ? x.marke && !x.bild : false) && rg.every((x) => x.w === 26 && x.ring === 36)
      : BILD.length === 0 && MARKE.length === OHNE_RAID.length && rg.every((x) => x.marke && !x.bild && x.sollMarke) && rg.every((x) => x.w === 26 && x.ring === 36),
      `Symbole: ${BILD.length} Gegenstandsbilder (eingebettet), ${MARKE.length} gezeichnete Marken und die Raute des eigenen Punkts, 26 im Ring von 36 (folgt Spezifikation 10)` + (BILDER ? "" : " (ohne Spielbilder: Marke)"),
      { marke: MARKE, rg: rg.map((x) => ({ k: x.k, b: x.bild, m: x.marke, s: x.sollMarke, w: x.w })) });
    let n = nPosts(s);
    await p.click('.wkschritt[data-wk-plus="umwandlungsstein"]');
    await nachPost(s, n);
    rg = await ringe();
    assert(rg.find((x) => x.k === "umwandlungsstein").a === 61 && rg.find((x) => x.k === "umwandlungsstein").s === 61, "Fuellring: + zaehlt, der Ring folgt (61/100)",
      rg.find((x) => x.k === "umwandlungsstein"));
    // --- die Ringe an den Reitern: erledigt/gesamt, 16 Punkt (folgt Spezifikation 10: die Gesamtzahl aus dem Kern)
    const reiterRinge = () => p.evaluate(() => [...document.querySelectorAll('#wkReiter [role="tab"]')].map((t) => ({ fort: t.querySelector(".wkfort")?.textContent,
      a: parseFloat(t.querySelector(".wkring .rf")?.getAttribute("stroke-dasharray")), w: t.querySelector(".wkring")?.getBoundingClientRect().width })));
    const passt = (rr) => rr.every((x) => { const [a, g] = x.fort.split("/").map(Number); return Math.abs(x.a - Math.round(a / g * 10000) / 100) < 0.001 && x.w === 16; });
    let rr = await reiterRinge();
    assert(rr.length === 2 && rr[0].fort === `4/${N + 1}` && rr[0].a === ringWert(4, N + 1) && rr[1].fort === `1/${N - 4}` && rr[1].a === ringWert(1, N - 4) && passt(rr),
      `Reiter-Ringe: je Charakter erledigt/gesamt der sichtbaren Punkte (4/${N + 1} mit einem eigenen, 1/${N - 4} mit vier ausgeblendeten), 16 Punkt`, rr);
    n = nPosts(s);
    await p.click('input[data-wk-haken="siegelschluessel"]');
    await nachPost(s, n);
    rr = await reiterRinge();
    assert(rr[0].fort === `5/${N + 1}` && rr[0].a === ringWert(5, N + 1) && passt(rr), `Reiter-Ring folgt dem Haken (5/${N + 1})`, rr);
    // Pruefung N6: ein eigener taeglicher Punkt steht in "Eigene" - folgt Spezifikation 10: nicht bei den Haendlern, eine Kachel "Taeglich" gibt es nicht
    const kiste = await p.evaluate(() => ({ eigene: !!document.querySelector('[data-wk-g="eigene"] [data-wk-punkt="eigenband01"]'),
      taeglich: !!document.querySelector('[data-wk-g="taeglich"]'), haendler: !!document.querySelector('[data-wk-g="haendler"] [data-wk-punkt="eigenband01"]'),
      tag: document.querySelector('[data-wk-punkt="eigenband01"] .wktag')?.textContent, name: document.querySelector('[data-wk-g="eigene"] .wkgname')?.textContent }));
    assert(kiste.eigene && !kiste.taeglich && !kiste.haendler && kiste.tag === "täglich" && kiste.name === "Eigene",
      "ein eigener taeglicher Punkt steht in „Eigene“ (mit „täglich“), nicht bei den Händlern; keine Kachel „Täglich“", kiste);
    // Pruefung M2: ein umbenannter Raid-Punkt zeigt seinen Namen klein im Feld, einzeilig mit Auslassung, das Feld bleibt 44 hoch
    const umb = await p.evaluate(() => {
      const z = document.querySelector('.wkzelle[data-wk-punkt="korridorSchwer"]'), n = z?.querySelector(".wkzname");
      const zr = z.getBoundingClientRect(), nr = n?.getBoundingClientRect(), c = n && getComputedStyle(n);
      return { text: n?.textContent, px: c ? parseFloat(c.fontSize) : 0, zeilen: c ? c.whiteSpace : "", aus: c ? c.textOverflow : "", gekuerzt: n ? n.scrollWidth > n.clientWidth : false,
        hoch: zr.height, drin: !!nr && nr.top >= zr.top && nr.bottom <= zr.bottom && nr.left >= zr.left && nr.right <= zr.right, einzeilig: !!nr && nr.height <= parseFloat(c.lineHeight) + 1,
        andere: document.querySelectorAll(".wkzelle .wkzname").length, haken: document.querySelector('.wkzelle[data-wk-punkt="korridorSchwer"] input')?.getAttribute("aria-label") };
    });
    assert(umb.text === "Korridor mit einem sehr langen eigenen Namen fuer das Feld" && umb.px >= 11 && umb.zeilen === "nowrap" && umb.aus === "ellipsis" && umb.gekuerzt
      && umb.einzeilig && umb.drin && umb.hoch <= 44 && umb.andere === 1 && umb.haken === umb.text,
      "umbenannter Raid-Punkt: der Name steht klein (mindestens 11) im Feld, einzeilig mit Auslassung, das Feld hoechstens 44 hoch; nur dort", umb);
    // Pruefung N3: das Raster sagt, wie die Tastatur darin geht
    const hilfe = await p.evaluate(() => { const i = document.querySelector(".wkraster input"); return (i.getAttribute("aria-describedby") || "").split(" ").map((x) => document.getElementById(x)?.textContent).join(" "); });
    assert(hilfe === "Pfeiltasten wechseln das Feld, die Leertaste hakt.", "Vorleser: das Rasterfeld beschreibt die Pfeiltasten (Pruefung N3)", hilfe);
    // Pruefung N2: Pfeile mit Umschalt, Alt oder Meta gehen am Raster vorbei
    await p.focus('input[data-wk-haken="zitadelleNormal"]');
    await p.evaluate(() => { window.__wkVorbei = []; document.addEventListener("keydown", (e) => { if (e.key.startsWith("Arrow")) window.__wkVorbei.push(e.defaultPrevented); }); });
    await p.keyboard.press("Shift+ArrowRight");
    await p.keyboard.press("Shift+ArrowDown");
    const mod = await p.evaluate(() => ({ f: document.activeElement?.dataset.wkHaken, vorbei: window.__wkVorbei }));
    assert(mod.f === "zitadelleNormal" && mod.vorbei.length === 2 && mod.vorbei.every((x) => !x), "Raster: Umschalt+Pfeil wandert nicht und wird nicht abgefangen (Pruefung N2)", mod);
    // ein ausgeblendeter Fluegel entfaellt, ein ausgeblendetes Feld bleibt leer
    await p.click('#wkReiter [data-wk-reiter="wband00002"]');
    r = await raster();
    assert(r && r.kopf.map((k) => k.name).join() === "Die vergessene Zitadelle,Der Altar der Wiedergeburt"
      && JSON.stringify(r.zeilen.map((z) => z.felder)) === JSON.stringify([["zitadelleNormal", "altarNormal"], ["zitadelleSchwer", "altarSchwer"], ["zitadelleAlbtraum", ""]])
      && r.an.join() === "altarNormal", "Raster mit Ausgeblendetem: der Korridor entfaellt, Albtraum am Altar bleibt ein leeres Feld" + (BILDER ? "" : " (ohne Spielbilder: Fluegelname ohne den Buchstaben der Platte)"), r);
    const ohne = await p.evaluate(() => ({ eigene: document.querySelectorAll('[data-wk-g="eigene"], .wk-eigene').length, kacheln: [...document.querySelectorAll("#wkPanel .wkgruppe")].map((x) => x.dataset.wkG).join() }));
    assert(!ohne.eigene && ohne.kacheln === KACHELN.join(), "ohne eigene Punkte entfaellt die Kachel \u201eEigene\u201c (Pruefung N6; folgt Spezifikation 10: die fuenf Kacheln)", ohne);
    await p.click('#wkReiter [data-wk-reiter="wband00001"]');
    assert(!wl.abgelehnt.length && !s.fehler.length, "Wochenband und Raster: jeder gesendete Stand gilt, keine Fehler", { a: wl.abgelehnt, f: s.fehler });
    await p.close();
    // die Woche der Zeitumstellung (So 25.10.2026, 3:00 -> 2:00): 169 Stunden, der Sonntag-Abschnitt beginnt bei 73 Stunden
    const t = await oeffne({ lager: neuesLager({ v: 1, profile: [profil("wband00003", "Umstellung")] }), uhr: Date.UTC(2026, 9, 25, 11, 0) });
    const tq = t.page;
    const z = await tq.evaluate(() => { const b = document.querySelector("#wkBand"), bahn = b.querySelector(".wkbahn").getBoundingClientRect(), j = b.querySelector(".wkjetzt").getBoundingClientRect();
      const so = [...b.querySelectorAll(".wkbtag")].find((x) => x.classList.contains("heute"));
      return { w: bahn.width, x: j.left + j.width / 2 - bahn.left, heute: so?.textContent, l: so.getBoundingClientRect().left - bahn.left, r: so.getBoundingClientRect().right - bahn.left,
        text: b.querySelector(".wkbandjetzt").textContent }; });
    assert(Math.abs(z.x - z.w * 75 / 169) <= 1 && z.heute === "So" && Math.abs(z.l - z.w * 73 / 169) <= 1 && Math.abs(z.r - z.w * 97 / 169) <= 1 && z.text.startsWith("jetzt So 12:00"),
      "Zeitumstellung: der Strich bei 75 von 169 Stunden, der Sonntag-Abschnitt an seinen echten Resets (73 bis 97 Stunden)", { ...z, soll: z.w * 75 / 169 });
    assert(!t.fehler.length, "Zeitumstellung: keine Fehler", t.fehler);
    await tq.close();
  }

  // ===== Reset ueber die gestellte Uhr: Do 10:00 leert die Wochenpunkte, die Vorwoche bleibt im Stand
  {
    const seitWoche = berlin(20, 12);            // So 20.09. 12:00, in der Woche ab Do 17.09. 10:00
    const seitTag = berlin(24, 8);               // Do 24.09. 08:00, nach dem Tages-Reset vom Mi
    const rl = neuesLager({ v: 1, profile: [profil("wreset0001", "Uhr", { zaehler: {
      zitadelleNormal: { stand: 1, seit: seitWoche }, illusionen: { stand: 2, seit: seitWoche }, phantomstein: { stand: 1, seit: seitTag } } })] });
    const s = await oeffne({ lager: rl, uhr: berlin(24, 9, 59) });
    const p = s.page;
    let b = await blick(p);
    assert(punkt(b, "zitadelleNormal").haken && punkt(b, "illusionen").stand === 2 && punkt(b, "phantomstein").haken,
      "Do 09:59: der Stand der Woche steht", b.punkte.filter((x) => x.haken || x.stand));
    await vorspulen(s, 120000);
    await bis(async () => !punkt(await blick(p), "zitadelleNormal").haken);
    b = await blick(p);
    assert(!punkt(b, "zitadelleNormal").haken && punkt(b, "illusionen").stand === 0 && !punkt(b, "phantomstein").haken && b.reiter[0].fort === `0/${N}`,
      "Do 10:01 (ohne Neuladen, im Minutentakt): alle Wochen- und Tagespunkte 0", b.punkte.filter((x) => x.haken || x.stand));
    assert(!rl.posts.length, "der Reset allein schreibt nichts");
    const n = nPosts(s);
    await p.click('input[data-wk-haken="korridorNormal"]');
    await nachPost(s, n);
    const sent = rl.posts.at(-1).profile[0];
    const r0 = kern.letzterReset(berlin(24, 9, 59), "woche");
    assert(sent.vorwoche && sent.vorwoche.reset === r0 && sent.vorwoche.zaehler.zitadelleNormal?.stand === 1 && sent.vorwoche.zaehler.illusionen?.stand === 2
      && !("phantomstein" in sent.vorwoche.zaehler), "Vorwoche im gesendeten Stand: Zitadelle 1 und Illusionen 2 der Woche ab Do 17.09., ohne Tagespunkt", sent.vorwoche);
    assert(sent.zaehler.zitadelleNormal?.stand === 1 && sent.zaehler.illusionen?.stand === 2 && sent.zaehler.korridorNormal?.stand === 1,
      "die alten Zaehler bleiben im Stand, der neue kommt dazu", sent.zaehler);
    assert(!rl.abgelehnt.length && !s.fehler.length, "Reset: der gesendete Stand gilt, keine Fehler", { a: rl.abgelehnt, f: s.fehler });
    await p.close();
    // Tages-Reset: Fr 10:00 leert nur die Tagespunkte
    const tl = neuesLager({ v: 1, profile: [profil("wreset0002", "Tag", { zaehler: {
      zitadelleNormal: { stand: 1, seit: berlin(24, 12) }, phantomstein: { stand: 1, seit: berlin(24, 12) }, vertragNyx: { stand: 1, seit: berlin(24, 12) } } })] });
    const t = await oeffne({ lager: tl, uhr: berlin(25, 9, 59) });
    b = await blick(t.page);
    assert(punkt(b, "phantomstein").haken && punkt(b, "vertragNyx").haken && punkt(b, "zitadelleNormal").haken, "Fr 09:59: Tages- und Wochenpunkt gesetzt");
    await vorspulen(t, 120000);
    await bis(async () => !punkt(await blick(t.page), "phantomstein").haken);
    b = await blick(t.page);
    assert(!punkt(b, "phantomstein").haken && !punkt(b, "vertragNyx").haken && punkt(b, "zitadelleNormal").haken && b.reiter[0].fort === `1/${N}`,
      "Fr 10:01: die Tagespunkte 0, der Wochenpunkt bleibt", b.punkte.filter((x) => x.haken));
    await t.page.close();
  }

  /* ===== Spezifikation 10 (Entscheidung 01.10.2026): das Feld "Haendler" mit sechs Bloecken (je Name, Ring und n/g), die
     taeglichen Punkte beim Gemischtwarenhaendler, "monatlich" am Vererbungsstein, die Dimensionspruefung mit Punkten und
     fuenf goldenen Truhen (Klick, Tastatur, Ansage), der Monats- und der Montags-Reset ueber die gestellte Uhr, die
     Spalten der Haendler bei 2000, 1280 und 560 und die Symbole der Haendler-Punkte */
  {
    const seit = berlin(22, 20);
    const HZ = { truhePvp: { stand: 3, seit }, phantomstein: { stand: 1, seit: berlin(23, 9) }, umwandlungsstein: { stand: 100, seit }, chaosprisma: { stand: 1, seit },
      vererbungsstein: { stand: 1, seit }, dimensionDungeons: { stand: 3, seit }, wachstumsbuch: { stand: 5, seit } };
    /* die Dungeons: Menge aus dem Kern, die Punkte so, dass alle zusammen 42.000 ergeben (Spezifikation 10) */
    const DM = kern.GRUNDLISTE.find((g) => g.schluessel === "dimensionDungeons").menge, DP = 42000 / DM;
    const de = (x) => x.toLocaleString("de-DE"), en = (x) => x.toLocaleString("en-US");
    const hl = neuesLager({ v: 1, profile: [profil("whaendl001", "Haendler", { zaehler: HZ })] });
    const fertigIn = (z, ks) => ks.filter((k) => (z[k]?.stand ?? 0) >= kern.GRUNDLISTE.find((g) => g.schluessel === k).menge).length;
    // --- Englisch zuerst, mit demselben Stand: die Punkte-Zeile der Dungeons
    {
      const e = await oeffne({ lager: neuesLager(hl.data), lang: "en" });
      const d = await e.page.evaluate(() => { const li = document.querySelector('li[data-wk-punkt="dimensionDungeons"]');
        return { pkt: li?.querySelector(".wkpkt")?.textContent, wert: li?.querySelector('[role="spinbutton"]')?.getAttribute("aria-valuetext"),
          feld: document.querySelector('[data-wk-g="haendler"] .wkgname')?.textContent, dim: document.querySelector('[data-wk-g="dimension"] .wkgname')?.textContent,
          kiste: document.querySelector('button.wkkiste[data-wk-kiste="3"]')?.getAttribute("aria-label"),
          tag: document.querySelector('li[data-wk-punkt="vererbungsstein"] .wktag')?.textContent }; });
      assert(Number.isInteger(DP) && d.pkt === `${en(3 * DP)} / 42,000 points` && d.wert === `3 of ${DM}, ${en(3 * DP)} points` && d.feld === "Merchants" && d.dim === "Dimensional Trial"
        && d.kiste === "Golden Chest 3 of 5" && d.tag === "monthly",
        `English: „${en(3 * DP)} / 42,000 points“ unter Dungeons, „3 of ${DM}, ${en(3 * DP)} points“ fuer den Vorleser, Merchants, Golden Chest, monthly`, d);
      assert(!e.fehler.length, "English (Spezifikation 10): keine Fehler", e.fehler);
      await e.page.close();
    }
    const s = await oeffne({ lager: hl });
    const p = s.page;
    // --- das Feld "Haendler": sechs Bloecke in ihrer Folge, je Name, Ring und erledigt/gesamt; im Kopf die Summe
    const feld = () => p.evaluate(() => {
      const f = document.querySelector('#wkPanel section.wk-haendler.wkgruppe[data-wk-g="haendler"]');
      return f && { name: f.querySelector(".wkkkopf h3")?.textContent, kopf: f.querySelector(".wkkkopf .wkgzahl")?.textContent, kopfVh: f.querySelector(".wkkkopf .vh")?.textContent,
        bloecke: [...f.querySelectorAll("section.wkhd")].map((h) => ({ g: h.dataset.wkH, h4: h.querySelector(".wkhkopf h4")?.textContent, zahl: h.querySelector(".wkhkopf .wkgzahl")?.textContent,
          vh: h.querySelector(".wkhkopf .vh")?.textContent, ring: !!h.querySelector(".wkhkopf .wkring"), fertig: h.classList.contains("fertig"), erl: !!h.querySelector(".wkkerl"),
          von: h.getAttribute("aria-labelledby"), hid: h.querySelector(".wkhkopf h4")?.id, punkte: [...h.querySelectorAll("[data-wk-punkt]")].map((x) => x.dataset.wkPunkt) })),
        lose: [...f.querySelectorAll("[data-wk-punkt]")].filter((x) => !x.closest("section.wkhd")).length };
    });
    const feldSoll = (z) => HAENDLER.map((g) => ({ g, n: fertigIn(z, vonGruppe(g)), m: vonGruppe(g).length }));
    const feldStimmt = (f, z) => {
      const soll = feldSoll(z), summe = soll.reduce((a, x) => a + x.n, 0), alle = soll.reduce((a, x) => a + x.m, 0);
      return !!f && f.name === "Händler" && f.kopf === `${summe}/${alle}` && f.kopfVh === `${summe} von ${alle}` && !f.lose && f.bloecke.length === HAENDLER.length
        && f.bloecke.every((b, i) => b.g === soll[i].g && b.h4 === I18N.de["weeklies.gruppe." + b.g] && b.zahl === `${soll[i].n}/${soll[i].m}` && b.vh === `${soll[i].n} von ${soll[i].m}`
          && b.ring && b.fertig === (soll[i].n === soll[i].m) && !b.erl && b.von === b.hid && !!b.hid && JSON.stringify(b.punkte) === JSON.stringify(vonGruppe(b.g)));
    };
    let f = await feld();
    assert(feldStimmt(f, HZ), `Feld Händler: sechs Bloecke in der Folge ${HAENDLER.join(", ")}, je h4, Ring und n/g, die Punkte ihres Händlers; im Kopf die Summe`,
      { f, soll: feldSoll(HZ) });
    assert(f.bloecke.find((b) => b.g === "ehrenmuenzen").fertig && !f.bloecke.find((b) => b.g === "gildenhaendler").fertig,
      "ein erledigter Händler-Block tritt zurueck (Ehrenmünzen 1/1), ohne „erledigt“; die anderen nicht", f.bloecke.map((b) => [b.g, b.fertig]));
    let n = nPosts(s);
    await p.click('input[data-wk-haken="vertragNyx"]');
    await nachPost(s, n);
    f = await feld();
    assert(feldStimmt(f, { ...HZ, vertragNyx: { stand: 1 } }) && f.bloecke[0].zahl === "2/3",
      "ein Haken beim Gemischtwarenhändler: der Block zählt 2/3, der Kopf des Feldes die Summe", { kopf: f.kopf, b: f.bloecke[0] });
    // --- die taeglichen Punkte stehen beim Gemischtwarenhaendler mit "taeglich", eine Kachel "Taeglich" gibt es nicht
    const tg = await p.evaluate(() => ["phantomstein", "vertragNyx"].map((k) => { const li = document.querySelector(`li[data-wk-punkt="${k}"]`), t = li?.querySelector(".wktag");
      return { k, block: li?.closest("section.wkhd")?.dataset.wkH, tag: t?.textContent, id: t?.id,
        beschr: (li?.querySelector("input")?.getAttribute("aria-describedby") || "").split(" ").map((i) => document.getElementById(i)?.textContent).join(" ") }; })
      .concat([{ taeglich: document.querySelectorAll('[data-wk-g="taeglich"], .wk-taeglich').length }]));
    assert(tg.slice(0, 2).every((x) => x.block === "gemischtwaren" && x.tag === "täglich" && x.id === "wkT-" + x.k && x.beschr === "täglich") && tg[2].taeglich === 0,
      "Tagespunkte im Block Gemischtwarenhändler mit „täglich“ (auch fuer den Vorleser), keine Kachel „Täglich“", tg);
    // --- "monatlich" am Vererbungsstein: unter dem Namen, fuer den Vorleser am Zaehler
    const mon = await p.evaluate(() => { const li = document.querySelector('li[data-wk-punkt="vererbungsstein"]'), t = li?.querySelector(".wktag"), z = li?.querySelector('[role="spinbutton"]');
      const nm = li?.querySelector(".wknamen .wkname");
      return { t: t?.textContent, id: t?.id, inNamen: !!t?.parentElement?.classList.contains("wknamen"), unter: !!t && !!nm && t.getBoundingClientRect().top >= nm.getBoundingClientRect().bottom - 1,
        beschr: (z?.getAttribute("aria-describedby") || "").split(" ").map((i) => document.getElementById(i)?.textContent).join(" "), px: t ? parseFloat(getComputedStyle(t).fontSize) : 0,
        block: li?.closest("section.wkhd")?.dataset.wkH, andere: [...document.querySelectorAll(".wktag")].filter((x) => x.textContent === "monatlich").length }; });
    assert(mon.t === "monatlich" && mon.id === "wkT-vererbungsstein" && mon.inNamen && mon.unter && mon.beschr === "monatlich" && mon.px >= 11 && mon.block === "widerstandswaren" && mon.andere === 1,
      "„monatlich“ am Vererbungsstein: in span.wknamen unter dem Namen, aria-describedby am Zaehler, nur dort", mon);
    // --- Dimensionspruefung: Dungeons mit Punkten (3000 je Dungeon)
    const dim = () => p.evaluate(() => { const li = document.querySelector('li[data-wk-punkt="dimensionDungeons"]'), z = li?.querySelector('[role="spinbutton"]'), pk = li?.querySelector(".wkpkt");
      return { pkt: pk?.textContent, versteckt: pk?.getAttribute("aria-hidden"), inNamen: !!pk?.closest(".wknamen"), wert: z?.getAttribute("aria-valuetext"), jetzt: z?.getAttribute("aria-valuenow"),
        max: z?.getAttribute("aria-valuemax"), kachel: li?.closest(".wkgruppe")?.dataset.wkG, px: pk ? parseFloat(getComputedStyle(pk).fontSize) : 0 }; });
    let d = await dim();
    assert(d.pkt === `${de(3 * DP)} / 42.000 Punkte` && d.versteckt === "true" && d.inNamen && d.wert === `3 von ${DM}, ${de(3 * DP)} Punkte` && d.jetzt === "3" && d.max === String(DM)
      && d.kachel === "dimension" && d.px >= 11,
      `Dimensionsprüfung: Dungeons 3 von ${DM}, darunter „${de(3 * DP)} / 42.000 Punkte“; der Vorleser hoert „3 von ${DM}, ${de(3 * DP)} Punkte“`, d);
    n = nPosts(s);
    await p.click('.wkschritt[data-wk-plus="dimensionDungeons"]');
    await nachPost(s, n);
    d = await dim();
    assert(d.pkt === `${de(4 * DP)} / 42.000 Punkte` && d.wert === `4 von ${DM}, ${de(4 * DP)} Punkte` && await bis(() => hl.data.profile[0].zaehler.dimensionDungeons?.stand === 4),
      `Dungeons +: 4 von ${DM}, ${de(4 * DP)} Punkte, gespeichert`, d);
    await p.focus('[role="spinbutton"][data-wk-stand="dimensionDungeons"]');
    await p.keyboard.press("End");
    d = await dim();
    assert(d.pkt === "42.000 / 42.000 Punkte" && d.wert === `${DM} von ${DM}, 42.000 Punkte`, "Dungeons Ende: voll, 42.000 / 42.000 Punkte", d);
    // --- die goldenen Truhen: fuenf Knoepfe, Klick fuellt bis i, Klick auf eine gefuellte nimmt bis i-1 zurueck
    const truhen = () => p.evaluate(() => { const g = document.querySelector('li[data-wk-punkt="goldeneKiste"] span.wkkisten'), a = document.querySelector("#wkAnsage");
      const rf = document.querySelector('li[data-wk-punkt="goldeneKiste"] .wksym .wkring .rf');
      return { rolle: g?.getAttribute("role"), name: g?.getAttribute("aria-label"), kachel: g?.closest(".wkgruppe")?.dataset.wkG,
        k: [...(g?.querySelectorAll("button.wkkiste") || [])].map((b) => ({ i: b.dataset.wkKiste, an: b.getAttribute("aria-pressed"), cls: b.classList.contains("an"), name: b.getAttribute("aria-label"), tab: b.tabIndex })),
        fokus: document.activeElement?.dataset.wkKiste || "", ansage: a?.textContent || "", aRolle: a?.getAttribute("role"), aDraussen: !!a && !document.querySelector("#wkBody").contains(a),
        ring: rf ? parseFloat(rf.getAttribute("stroke-dasharray")) : null, dimZahl: document.querySelector('[data-wk-g="dimension"] .wkkkopf .wkgzahl')?.textContent }; });
    const truheStimmt = (t, n, tab) => t.kachel === "dimension" && t.rolle === "group" && t.name === `Goldene Truhen, ${n} von 5` && t.k.length === 5 && t.ring === ringWert(n, 5)
      && t.k.every((x, j) => x.i === String(j + 1) && x.an === String(j < n) && x.cls === (j < n) && x.name === `Goldene Truhe ${j + 1} von 5` && x.tab === (j + 1 === tab ? 0 : -1));
    const gespeichert = (n) => bis(() => hl.data.profile[0].zaehler.goldeneKiste?.stand === n);
    let t = await truhen();
    assert(truheStimmt(t, 0, 1) && t.aRolle === "status" && t.aDraussen && !t.ansage,
      "Truhen: fuenf Knoepfe „Goldene Truhe i von 5“ in einer Gruppe, keine gedrueckt, ein Tabstopp auf der ersten; die Ansage-Region (status) ausserhalb von #wkBody, leer", t);
    for (const [i, soll, wie] of [[3, 3, "Klick auf die leere dritte fuellt bis zu ihr"], [2, 1, "Klick auf die gefuellte zweite nimmt bis vor sie zurueck"],
      [1, 0, "Klick auf die gefuellte erste leert alle"], [5, 5, "Klick auf die fuenfte fuellt alle"], [5, 4, "Klick auf die gefuellte fuenfte nimmt nur sie zurueck"]]) {
      n = nPosts(s);
      await p.click(`button.wkkiste[data-wk-kiste="${i}"]`);
      await nachPost(s, n);
      t = await truhen();
      assert(truheStimmt(t, soll, i) && t.fokus === String(i) && t.ansage === `Goldene Truhen, ${soll} von 5` && await gespeichert(soll),
        `Truhen: ${wie} (${soll} von 5), aria-pressed stimmt, gespeichert als zaehler.goldeneKiste, der Fokus bleibt auf der Truhe, angesagt`,
        { t, z: hl.data.profile[0].zaehler.goldeneKiste });
    }
    assert(t.dimZahl === "1/2", "Truhen 4 von 5 und Dungeons voll: die Kachel Dimensionsprüfung zeigt 1/2", t.dimZahl);
    // Tastatur: Pfeile, Pos1 und Ende wandern (ein Tabstopp, am Rand bleibt der Fokus), Leertaste und Enter klicken
    const n0 = nPosts(s), wege = [];
    for (const [taste, ziel] of [["Home", 1], ["ArrowLeft", 1], ["ArrowRight", 2], ["End", 5], ["ArrowRight", 5], ["ArrowLeft", 4], ["Home", 1], ["ArrowRight", 2]]) {
      await p.keyboard.press(taste);
      const w = await truhen();
      wege.push({ taste, ziel, f: w.fokus, tab: w.k.filter((x) => x.tab === 0).map((x) => x.i).join(), an: w.k.filter((x) => x.an === "true").length });
    }
    await new Promise((r) => setTimeout(r, 300));
    assert(wege.every((x) => x.f === String(x.ziel) && x.tab === String(x.ziel) && x.an === 4) && nPosts(s) === n0,
      "Truhen-Tastatur: Pfeile links/rechts, Pos1 und Ende wandern, am Rand bleibt der Fokus; der Tabstopp wandert mit, nichts gespeichert", wege);
    n = nPosts(s);
    await p.keyboard.press("Space");
    await nachPost(s, n);
    t = await truhen();
    assert(truheStimmt(t, 1, 2) && t.fokus === "2" && t.ansage === "Goldene Truhen, 1 von 5" && await gespeichert(1),
      "Truhen-Tastatur: die Leertaste auf der gefuellten zweiten nimmt bis vor sie zurueck (1 von 5), der Fokus bleibt", t);
    n = nPosts(s);
    await p.keyboard.press("Enter");
    await nachPost(s, n);
    t = await truhen();
    assert(truheStimmt(t, 2, 2) && t.fokus === "2" && t.ansage === "Goldene Truhen, 2 von 5" && await gespeichert(2),
      "Truhen-Tastatur: Enter auf der leeren zweiten fuellt bis zu ihr (2 von 5), der Fokus bleibt", t);
    // --- Symbole: die Haendler-Punkte mit gleichem Gegenstand zeigen dasselbe Bild wie das Original
    const gleich = await p.evaluate(() => [["widerstandHeroischFreischalt", "heroischFreischalt"], ["widerstandFreischaltFragment", "freischaltFragment"], ["raidChaosprisma", "chaosprisma"]]
      .map(([a, o]) => { const bg = (k) => getComputedStyle(document.querySelector(`li[data-wk-punkt="${k}"] .wksym .wkicon`)).backgroundImage;
        const svg = (k) => document.querySelector(`li[data-wk-punkt="${k}"] .wksym .wkicon`).innerHTML;
        return { a, gleich: bg(a) === bg(o), url: bg(a).startsWith("url("), marke: /^<svg/.test(svg(a)) && svg(a) === svg(o) }; }));
    assert(gleich.every((x) => BILDER ? x.gleich && x.url : x.gleich && !x.url && x.marke), "Symbole: die drei Händler-Aliasse tragen das Bild ihres Gegenstands" + (BILDER ? "" : " (ohne Spielbilder: Marke)"), gleich);
    assert(!hl.abgelehnt.length && !s.fehler.length, "Spezifikation 10: jeder gesendete Stand gilt, keine Fehler", { a: hl.abgelehnt, f: s.fehler });
    await p.close();

    // --- Monats- und Montags-Reset ueber die gestellte Uhr: Do 24.09. (Wochen-Reset), Mo 28.09. (Montag), Do 01.10. (Monat)
    const ml = neuesLager({ v: 1, profile: [profil("wmonat0001", "Monat", { zaehler: { vererbungsstein: { stand: 2, seit: berlin(5, 12) },
      unendlichkeit: { stand: 1, seit: berlin(21, 12) }, unendlichkeitMontag: { stand: 1, seit: berlin(21, 12) }, truhePvp: { stand: 2, seit: berlin(21, 12) } } })] });
    const u = await oeffne({ lager: ml, uhr: berlin(24, 9, 59) });
    const q = u.page;
    const st = async () => { const b = await blick(q); return { verb: punkt(b, "vererbungsstein").stand, unend: punkt(b, "unendlichkeit").haken, mo: punkt(b, "unendlichkeitMontag").haken,
      pvp: punkt(b, "truhePvp").stand, monName: punkt(b, "unendlichkeitMontag").name, doName: punkt(b, "unendlichkeit").name }; };
    const bisZu = async (ziel) => { const jetzt = await q.evaluate(() => Date.now()); await vorspulen(u, ziel - jetzt); };
    let x = await st();
    assert(x.verb === 2 && x.unend && x.mo && x.pvp === 2 && x.monName === "Portal der Unendlichkeit (Mo–Mo)" && x.doName === "Portal der Unendlichkeit (Do–Do)",
      "Do 24.09. 09:59: Vererbungsstein 2/2, beide Portale (Do–Do und Mo–Mo) und die PvP-Truhe 2 stehen", x);
    await vorspulen(u, 120000);
    await bis(async () => !(await st()).unend);
    x = await st();
    assert(x.verb === 2 && !x.unend && x.mo && x.pvp === 0, "Do 10:01 (Wochen-Reset): Wochenpunkte 0, der Vererbungsstein (monatlich) und das Portal Mo–Mo bleiben", x);
    assert(!ml.posts.length, "Wochen-Reset mit Monats- und Montagspunkt: der Reset allein schreibt nichts", ml.posts.length);
    n = nPosts(u);
    await q.click('input[data-wk-haken="korridorNormal"]');
    await nachPost(u, n);
    const sent = ml.posts.at(-1).profile[0];
    assert(sent.vorwoche && sent.vorwoche.zaehler.unendlichkeit?.stand === 1 && sent.vorwoche.zaehler.truhePvp?.stand === 2 && !("vererbungsstein" in sent.vorwoche.zaehler)
      && !("unendlichkeitMontag" in sent.vorwoche.zaehler) && sent.zaehler.vererbungsstein?.stand === 2 && sent.zaehler.unendlichkeitMontag?.stand === 1,
      "Vorwoche: nur die Wochenpunkte, kein Monats- und kein Montagspunkt; beide bleiben im Stand", sent);
    await bisZu(Date.UTC(2026, 8, 28, 7, 59));
    await bis(async () => (await blick(q)).tag.includes("1 Min"));
    x = await st();
    assert(x.verb === 2 && x.mo, "Mo 28.09. 09:59: das Portal Mo–Mo und der Vererbungsstein stehen noch", x);
    await vorspulen(u, 120000);
    await bis(async () => !(await st()).mo);
    x = await st();
    assert(!x.mo && x.verb === 2, "Mo 10:01 (Montags-Reset): das Portal Mo–Mo ist 0, der Vererbungsstein bleibt", x);
    await bisZu(Date.UTC(2026, 9, 1, 7, 59));
    await bis(async () => (await blick(q)).tag.includes("1 Min"));
    x = await st();
    assert(x.verb === 2, "Do 01.10. 09:59: der Vererbungsstein steht ueber zwei Wochen-Resets", x);
    await vorspulen(u, 120000);
    await bis(async () => (await st()).verb === 0);
    x = await st();
    assert(x.verb === 0, "Do 01.10. 10:01 (1. des Monats, 10:00 Berlin): der Vererbungsstein ist 0", x);
    assert(!ml.abgelehnt.length && !u.fehler.length, "Monats- und Montags-Reset: jeder gesendete Stand gilt, keine Fehler", { a: ml.abgelehnt, f: u.fehler });
    await q.close();

    // --- die Spalten der Haendler und die Lage der Kacheln bei 2000 x 1480, 1280 x 860 und 560 x 860
    for (const [breite, hoehe] of [[2000, 1480], [1280, 860], [560, 860]]) {
      const v = await oeffne({ lager: neuesLager(hl.data), breite, hoehe });
      const m = await v.page.evaluate(() => {
        const r = (e) => { const x = e.getBoundingClientRect(); return { l: x.left, r: x.right, t: x.top, b: x.bottom, w: x.width }; };
        const feld = document.querySelector(".wkhaendler"), cs = getComputedStyle(feld);
        const innen = feld.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const bl = [...feld.querySelectorAll("section.wkhd")].map((h) => ({ g: h.dataset.wkH, n: h.getClientRects().length, ...r(h) }));
        const kach = Object.fromEntries([...document.querySelectorAll("#wkPanel .wkgruppe")].map((k) => [k.dataset.wkG, r(k)]));
        const zone = [...document.querySelectorAll('#wkPanel [data-wk-g="dimension"], #wkPanel [data-wk-g="haendler"]')];
        const zeilen = zone.flatMap((z) => [...z.querySelectorAll("li.wkpunkt")]).filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().height);
        const texte = zone.flatMap((z) => [...z.querySelectorAll("*")]).filter((e) => e.getClientRects().length && [...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()));
        return { quer: document.documentElement.scrollWidth > innerWidth, innen, gap: parseFloat(cs.columnGap) || 0, bl, kach, waben: r(document.querySelector(".wkwaben")),
          n: zeilen.length, hoch: Math.max(...zeilen), klein: texte.map((e) => ({ t: e.textContent.trim().slice(0, 30), px: parseFloat(getComputedStyle(e).fontSize) })).filter((x) => x.px < 11) };
      });
      const wo = `Spezifikation 10, ${breite} × ${hoehe}`;
      const spalten = [...new Set(m.bl.map((b) => Math.round(b.l)))];
      const spaltenBreite = (m.innen - (spalten.length - 1) * m.gap) / spalten.length;
      assert(!m.quer, `${wo}: kein waagerechtes Rollen`, m.quer);
      assert(m.bl.length === 6 && m.bl.every((b) => b.n === 1 && b.w <= spaltenBreite + 1) && spalten.length <= 3 && (breite === 560 ? spalten.length === 1 : spalten.length >= 2)
        && spalten.every((l) => { const s = m.bl.filter((b) => Math.round(b.l) === l).sort((a, c) => a.t - c.t); return s.every((b, i) => !i || b.t >= s[i - 1].b - 0.5); }),
        `${wo}: kein Händler-Block bricht um (ein Rechteck, innerhalb einer Spalte), ${spalten.length} Spalte(n), hoechstens drei`, { spalten, spaltenBreite, bl: m.bl });
      assert(m.n >= 20 && m.hoch <= 44 && !m.klein.length, `${wo}: Dimensionsprüfung und Händler - ${m.n} Zeilen, jede hoechstens 44 hoch, kein Text unter 11`,
        { hoch: m.hoch, klein: m.klein });
      const k = m.kach, nah = (a, b) => Math.abs(a - b) <= 1.5;
      const lage = breite === 2000
        ? nah(k.dimension.l, k.geheimdungeon.l) && nah(k.dimension.r, k.events.r) && k.dimension.t >= k.events.b - 1 && k.raid.r <= k.dimension.l + 1
          && nah(k.haendler.w, m.waben.w) && k.haendler.t >= Math.max(k.raid.b, k.dimension.b) - 1
        : breite === 1280
          ? nah(k.dimension.w, m.waben.w) && k.dimension.t >= Math.max(k.raid.b, k.events.b) - 1 && nah(k.haendler.w, m.waben.w) && k.haendler.t >= k.dimension.b - 1
          : nah(k.dimension.w, m.waben.w) && nah(k.haendler.w, m.waben.w) && k.haendler.t >= k.dimension.b - 1;
      assert(lage, breite === 2000 ? `${wo}: die Dimensionsprüfung unter Geheimdungeon und Events neben dem Raid, die Händler darunter ueber die volle Breite`
        : `${wo}: die Dimensionsprüfung ueber die volle Breite unter dem Raid, die Händler darunter`, k);
      assert(!v.fehler.length, `${wo}: keine Fehler`, v.fehler);
      await v.page.close();
    }
  }
  // Symbole (Spezifikation 10): jeder Haendler-Punkt der Grundliste traegt ein Bild, auch die drei mit eigenem Schluessel
  {
    const ohne = kern.GRUNDLISTE.filter((g) => HAENDLER.includes(g.gruppe) && !bilder.wkHatBild(g.schluessel)).map((g) => g.schluessel);
    const haendler = kern.GRUNDLISTE.filter((g) => HAENDLER.includes(g.gruppe)).map((g) => g.schluessel);
    assert(BILDER ? !ohne.length && ["widerstandHeroischFreischalt", "widerstandFreischaltFragment", "raidChaosprisma", "goldeneKiste"].every((k) => bilder.wkHatBild(k))
      : haendler.length > 0 && ohne.length === haendler.length && !bilder.wkHatBild("goldeneKiste")
        && haendler.every((k) => /^<svg/.test(bilder.WK_MARKE[k] ?? bilder.WK_MARKE.eigen)),
      "Bilder: jeder Händler-Punkt der Grundliste hat ein Bild, auch die Aliasse widerstandHeroischFreischalt, widerstandFreischaltFragment, raidChaosprisma"
      + (BILDER ? "" : " (ohne Spielbilder: kein Händler-Punkt hat ein Bild, jeder zeigt WK_MARKE[k] ?? WK_MARKE.eigen)"), BILDER ? ohne : haendler.filter((k) => bilder.wkHatBild(k)));
  }

  // ===== Reset-Anzeige, Deutsch und Englisch, Minutentakt
  {
    const s = await oeffne({ lager });
    let b = await blick(s.page);
    assert(b.woche === "N\u00e4chster Wochen-Reset: Do 10:00 \u00b7 in 1\u00a0T 0\u00a0Std" && b.tag === "T\u00e4glicher Reset: 10:00 \u00b7 in 5\u00a0Min",
      "Reset-Anzeige Mi 09:55: Wochen-Reset Do 10:00 in 1 T 0 Std, taeglich in 5 Min", { w: b.woche, t: b.tag });
    await vorspulen(s, 60000);
    await bis(async () => (await blick(s.page)).tag.endsWith("4\u00a0Min"));
    b = await blick(s.page);
    assert(b.tag === "T\u00e4glicher Reset: 10:00 \u00b7 in 4\u00a0Min", "eine Minute spaeter: in 4 Min (Minutentakt)", b.tag);
    // auf 10:01:30: der Tages-Reset liegt hinter uns, beide kommen Do 10:00 (aufgerundet 23 Std 59 Min)
    await vorspulen(s, 5 * 60000 + 30000);
    await bis(async () => (await blick(s.page)).tag.includes("Std"));
    b = await blick(s.page);
    assert(b.woche === "N\u00e4chster Wochen-Reset: Do 10:00 \u00b7 in 23\u00a0Std 59\u00a0Min" && b.tag === "T\u00e4glicher Reset: 10:00 \u00b7 in 23\u00a0Std 59\u00a0Min",
      "nach dem Tages-Reset: beide in Stunden und Minuten", { w: b.woche, t: b.tag });
    // der Takt laeuft nur, solange der Bereich offen ist
    const vorher = await s.page.evaluate(() => document.querySelector("#wkTag").textContent);
    await s.page.click('#bereiche [data-tab="start"]');
    await vorspulen(s, 5 * 60000);
    const zu = await s.page.evaluate(() => document.querySelector("#wkTag").textContent);
    assert(zu === vorher, "Bereich zu: kein Minutentakt", { vorher, zu });
    await s.page.click('#bereiche [data-tab="weeklies"]');
    await bis(async () => (await blick(s.page)).tag !== vorher);
    assert((await blick(s.page)).tag !== vorher, "Bereich wieder offen: die Anzeige stimmt sofort");
    await s.page.close();
    const e = await oeffne({ lager, lang: "en" });
    b = await blick(e.page);
    const en = await e.page.evaluate(() => ({ neu: document.querySelector("#wkNeu")?.textContent || document.querySelector("#wkVoll")?.textContent,
      werk: [...document.querySelectorAll(".wkwerk button")].map((x) => x.textContent), titel: document.querySelector("#weekliesTitel")?.textContent }));
    assert(b.woche === "Next weekly reset: Thu 10:00 \u00b7 in 1\u00a0d 0\u00a0h" && b.tag === "Daily reset: 10:00 \u00b7 in 5\u00a0min",
      "English: Next weekly reset: Thu 10:00 in 1 d 0 h, daily in 5 min", { w: b.woche, t: b.tag });
    assert(b.gruppen[0].name === "Raid \u2013 Altar of Calanthia" && punkt(b, "zitadelleNormal").name === "The Forgotten Citadel \u2013 Normal"
      && punkt(b, "phantomstein").tag === "daily" && punkt(b, "vertragNyx").name === "Allied Resistance Forces Contract Scroll: Nix",
      "English: groups, points and \u201edaily\u201c", { g: b.gruppen[0].name, p: punkt(b, "zitadelleNormal").name });
    assert(JSON.stringify(en.werk) === JSON.stringify(["Rename", "Customise", "Detach"]) && en.titel === "Weeklies", "English: Rename, Customise, Detach", en);
    const enRaster = await e.page.evaluate((bilder) => ({ zeilen: [...document.querySelectorAll(".wkraster tbody th")].map((x) => x.textContent).join(),
      spalten: [...document.querySelectorAll(".wkraster thead th")].map((x) => bilder ? x.textContent.trim() : x.querySelector(".wkkopfname")?.textContent.trim()).join(),
      anfang: [...document.querySelectorAll(".wkraster thead th .wkbild.init")].map((x) => x.textContent).join(), hilfe: document.querySelector("#wkRasterHilfe")?.textContent }), BILDER);
    assert(enRaster.zeilen === "Normal,Difficult,Nightmare" && enRaster.spalten === "The Forgotten Citadel,The Corridor of Anguish,The Altar of Rebirth"
      && enRaster.hilfe === "Arrow keys move between the fields, Space ticks." && (BILDER || enRaster.anfang === "F,C,A"),
      "English: the raid grid rows, columns and keyboard hint (Pruefung N6)" + (BILDER ? "" : " (without game images: plates F, C, A)"), enRaster);
    // Sprachwechsel auf der Seite
    await e.page.evaluate(() => document.querySelector("#btnLang")?.click());
    await bis(async () => (await blick(e.page)).woche.startsWith("N\u00e4chster"));
    b = await blick(e.page);
    assert(b.gruppen[0].name === "Raid \u2013 Altar von Calanthia" && punkt(b, "zitadelleNormal").name === "Die vergessene Zitadelle \u2013 Normal"
      && punkt(b, "phantomstein").tag === "t\u00e4glich", "Sprachwechsel: die Liste auf Deutsch", b.gruppen[0]);
    assert(!e.fehler.length, "Englisch: keine Fehler", e.fehler);
    await e.page.close();
    // gleiche Schluessel in beiden Sprachen, jeder Punkt und jede Gruppe benannt
    const ke = Object.keys(I18N.en).filter((k) => k.startsWith("weeklies.")).sort(), kd = Object.keys(I18N.de).filter((k) => k.startsWith("weeklies.")).sort();
    const fehlt = [...kern.GRUNDLISTE.map((g) => "weeklies.punkt." + g.schluessel), ...[...new Set(kern.GRUNDLISTE.map((g) => "weeklies.gruppe." + g.gruppe))], "weeklies.gruppe.eigene",
      // folgt Spezifikation 10: das Feld Haendler, "monatlich", die Punkte der Dungeons und die Truhen
      "weeklies.gruppe.haendler", "weeklies.monatlich", "weeklies.punkteVon", "weeklies.dungeonsText", "weeklies.kisteNr", "weeklies.kisten"]
      .filter((k) => !ke.includes(k));
    assert(JSON.stringify(ke) === JSON.stringify(kd) && !fehlt.length && ke.length > 40, "Dictionary: weeklies.* mit gleichen Schluesseln in DE und EN, alle Punkte und Gruppen", { fehlt, n: ke.length });
    const bau = [...kd.map((k) => I18N.de[k])].filter((v) => typeof v === "string" && /\bBau\b/.test(v));
    assert(!bau.length, "Deutsch: \u201eBuild\u201c, nie \u201eBau\u201c", bau);
  }

  /* ===== Pruefung W3, K2: 60 Charaktere in der Datei (geloeste mitgezaehlt) - kein 61., ein eigener Satz; und ein Stand,
     den ein anderes Fenster geaendert hat: nach 400 liest die Seite neu und uebernimmt den gelesenen */
  {
    const viele = { v: 1, profile: Array.from({ length: 60 }, (_, i) => profil("wviele" + String(i).padStart(4, "0"), "Nr " + i, i < 55 ? { geloest: true } : {})) };
    const vl = neuesLager(viele);
    const s = await oeffne({ lager: vl });
    const p = s.page;
    await klick(p, "#wkNeu");
    await p.fill("#wkNeuName", "Einundsechzig");
    await p.press("#wkNeuName", "Enter");
    const b = await blick(p);
    assert(b.reiter.length === 5 && /60/.test(b.status) && !vl.posts.length && vl.data.profile.length === 60,
      "60 Charaktere in der Datei: kein 61., ein Satz, nichts gesendet", { r: b.reiter.length, st: b.status, posts: vl.posts.length });
    assert(!s.fehler.length, "60 Charaktere: keine Fehler", s.fehler);
    await p.close();
  }
  {
    const al = neuesLager({ v: 1, profile: [profil("wfenster01", "Fenster A", { zaehler: { illusionen: { stand: 1, seit: berlin(22, 20) } } })] });
    const s = await oeffne({ lager: al });
    const p = s.page;
    // ein anderes Fenster legt einen Charakter an und zaehlt weiter
    al.data = { v: 1, profile: [{ ...al.data.profile[0], zaehler: { illusionen: { stand: 2, seit: berlin(23, 9) } } }, profil("wfenster02", "Fenster B")] };
    const n = nPosts(s);
    await p.click('input[data-wk-haken="zitadelleNormal"]');
    await nachPost(s, n);
    await bis(async () => (await blick(p)).reiter.length === 2);
    let b = await blick(p);
    assert(al.abgelehnt.length === 1 && b.reiter.map((r) => r.name).join() === "Fenster A,Fenster B" && /Anderswo ge\u00e4ndert/.test(b.status)
      && punkt(b, "illusionen").stand === 2, "anderswo geaendert: nach 400 liest die Seite neu, uebernimmt den Stand und sagt es", { st: b.status, r: b.reiter, a: al.abgelehnt.length });
    const m = nPosts(s);
    await p.click('input[data-wk-haken="zitadelleNormal"]');
    await nachPost(s, m);
    await bis(() => al.data.profile[0].zaehler.zitadelleNormal?.stand === 1);
    assert(al.abgelehnt.length === 1 && al.data.profile.length === 2 && al.data.profile[0].zaehler.zitadelleNormal?.stand === 1 && al.data.profile[0].zaehler.illusionen.stand === 2,
      "danach speichert der naechste Haken, ohne etwas Gespeichertes zu verlieren", al.data.profile);
    await bis(async () => !(await blick(p)).status);
    assert(!(await blick(p)).status, "nach dem Speichern ist der Satz weg");
    assert(!s.fehler.length, "anderswo geaendert: keine Fehler", s.fehler);
    await p.close();
  }
  // ===== Pruefung W3, K5: verlassen gleich nach einer Aenderung verliert sie nicht.
  // Die Uhr steht, damit das Entprellen (200 ms) nicht feuern kann: ankommen
  // kann die Aenderung nur ueber pagehide. Frueher lud die Probe die Seite neu;
  // ob der Browser eine Anfrage beim Entladen noch zustellt, wackelte in der
  // Linux-CI (30.09.), und ein frueh feuerndes Entprellen liess sie auch ohne
  // pagehide gruen werden.
  {
    const rl = neuesLager({ v: 1, profile: [profil("wneulade01", "Neuladen")] });
    const s = await oeffne({ lager: rl });
    await s.page.clock.pauseAt(await s.page.evaluate(() => Date.now()) + 1000);
    const n = nPosts(s);
    await s.page.click('input[data-wk-haken="zitadelleAlbtraum"]');
    assert(nPosts(s) === n, "pagehide: vor dem Verlassen ist nichts gesendet (Uhr steht, Entprellen wartet)", { n, jetzt: nPosts(s) });
    await s.page.evaluate(() => dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
    assert(await bis(() => rl.data.profile[0].zaehler.zitadelleAlbtraum?.stand === 1, 5000) && !rl.abgelehnt.length,
      "im Entprell-Fenster verlassen: die letzte Aenderung geht sofort hinaus (pagehide, keepalive)", rl.data.profile[0].zaehler);
    await s.page.clock.fastForward(1000);
    await new Promise((r) => setTimeout(r, 300));
    assert(nPosts(s) === n + 1, "pagehide: genau ein POST, das Entprellen sendet nicht noch einmal", { n, jetzt: nPosts(s) });
    await s.page.close();
  }

  // ===== 400 und 503 beim Schreiben: ein ruhiger Satz, der Stand bleibt sichtbar
  {
    const l4 = neuesLager({ v: 1, profile: [profil("wfehler001", "Fehler")] });
    const s = await oeffne({ lager: l4 });
    const p = s.page;
    l4.postStatus = 400;
    let n = nPosts(s);
    await p.click('input[data-wk-haken="zitadelleNormal"]');
    await nachPost(s, n);
    await bis(async () => /nicht gespeichert/.test((await blick(p)).status));
    let b = await blick(p);
    assert(/Zu gro\u00df oder ung\u00fcltig/.test(b.status) && /nicht gespeichert/.test(b.status) && punkt(b, "zitadelleNormal").haken && b.reiter[0].fort === `1/${N}`,
      "400: \u201eZu groß oder ungültig \u2013 nicht gespeichert\u201c, der Haken bleibt sichtbar", b.status);
    const rolle = await p.evaluate(() => document.querySelector("#wkStatus")?.getAttribute("role"));
    assert(rolle === "status", "der Satz steht in einer Live-Region", rolle);
    l4.postStatus = 503;
    n = nPosts(s);
    await p.click('input[data-wk-haken="zitadelleSchwer"]');
    await nachPost(s, n);
    await bis(async () => /versucht/.test((await blick(p)).status));
    b = await blick(p);
    assert(/nicht gespeichert/.test(b.status) && /versucht es/.test(b.status) && punkt(b, "zitadelleSchwer").haken, "503: nicht gespeichert, Borometer versucht es wieder", b.status);
    l4.postStatus = null;
    n = nPosts(s);
    assert(await bis(() => l4.data.profile[0].zaehler.zitadelleSchwer?.stand === 1, 15000), "503: der naechste Versuch speichert den ganzen Stand");
    await bis(async () => !(await blick(p)).status);
    b = await blick(p);
    assert(!b.status && l4.data.profile[0].zaehler.zitadelleNormal?.stand === 1, "danach ist der Satz weg, auch der Haken von vorher ist gespeichert", b.status);
    assert(!l4.abgelehnt.length && !s.fehler.length, "400 und 503: keine Fehler", { a: l4.abgelehnt, f: s.fehler });
    await p.close();
  }

  // ===== Groessen, Schrift, Zeilen, drei Themen
  {
    const voll = structuredClone(lager.data);
    voll.profile[0].eigene.push({ schluessel: "eigenlang01", name: "Ein sehr langer eigener Punkt mit vielen Worten fuer die Probe", menge: 999, takt: "woche" });
    for (const [breite, hoehe] of [[1280, 860], [1920, 1080], [2000, 1480], [1000, 860], [760, 860], [560, 860]]) {
      for (const anp of [false, true]) {
        const s = await oeffne({ lager: neuesLager(voll), breite, hoehe });
        const p = s.page;
        await p.click('#wkReiter [data-wk-reiter]:nth-child(1)');
        if (anp) await klick(p, "[data-wk-anpassen]");
        const m = await p.evaluate(() => {
          const w = document.querySelector("#weeklies");
          const texte = [...w.querySelectorAll("*")].filter((e) => e.getClientRects().length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
          const klein = texte.map((e) => ({ t: e.textContent.trim().slice(0, 30), px: parseFloat(getComputedStyle(e).fontSize) })).filter((x) => x.px < 11);
          // folgt Entwurf 01.10.: die Felder des Raid-Rasters sind Zeilen wie die Punkte
          const zeilen = [...w.querySelectorAll("li.wkpunkt, li.wkanp, .wkzelle")].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect());
          const glow = [...w.querySelectorAll("*")].map((e) => getComputedStyle(e).textShadow).filter((x) => x && x !== "none");
          return { quer: document.documentElement.scrollWidth > innerWidth, doc: document.documentElement.scrollHeight - innerHeight,
            klein, n: zeilen.length, hoch: Math.max(...zeilen.map((r) => r.height)), breit: Math.max(...zeilen.map((r) => r.width)), glow,
            rechts: Math.max(...[...w.querySelectorAll("*")].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().right)),
            inhalt: document.querySelector("#wkBody").getBoundingClientRect().width,
            bilder: [...w.querySelectorAll(".wkraster .wkbild")].map((e) => ({ w: e.getBoundingClientRect().width, top: e.getBoundingClientRect().top })),
            werk: (() => { const a = w.querySelector(".wkwerk")?.getBoundingClientRect(), l = w.querySelector(".wkleiste")?.getBoundingClientRect(); return a && l ? l.right - a.right : null; })() };
        });
        const wo = `${breite} \u00d7 ${hoehe}${anp ? " Anpassen" : ""}`;
        assert(!m.quer && m.doc <= 0 && m.rechts <= breite + 0.5, `${wo}: kein waagerechtes Rollen, die Seite rollt nicht (die Liste rollt in sich)`, m);
        assert(!m.klein.length && !m.glow.length, `${wo}: Text mindestens 11 Punkt, kein Leuchtschatten`, { klein: m.klein, glow: m.glow });
        assert(m.n >= 20 && m.hoch <= 44 && m.breit <= 640, `${wo}: ${m.n} Zeilen, jede hoechstens 44 Punkt hoch und 640 breit (nichts gestreckt)`, { hoch: m.hoch, breit: m.breit });
        assert(m.inhalt <= 1680, `${wo}: der Inhalt hoechstens 1680 Punkt breit`, m.inhalt);
        if (!anp) {
          const soll = breite === 560 ? 36 : 48;
          assert(m.bilder.length === 3 && m.bilder.every((x) => x.w === soll) && Math.max(...m.bilder.map((x) => x.top)) - Math.min(...m.bilder.map((x) => x.top)) <= 0.5,
            `${wo}: die Bossbilder ${soll} Punkt, auf einer Linie (Pruefung N6, Finish 1)`, m.bilder);
        }
        assert(m.werk !== null && Math.abs(m.werk) <= 1, `${wo}: Umbenennen, Anpassen, Loesen stehen rechts in der Leiste (Finish 6)`, m.werk);
        assert(!s.fehler.length, `${wo}: keine Fehler`, s.fehler);
        await p.close();
      }
    }
    // drei Themen: kein Rot, kein Gruen als Urteil; der Haken und der volle Zaehler in der Farbe der Auswahl
    const farbe = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map((x) => +x / 255);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
      if (!d) return { h: 0, s: 0 }; const sat = d / (1 - Math.abs(2 * l - 1));
      const h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
      return { h: (h + 360) % 360, s: sat }; };
    const urteil = (c) => { const f = farbe(c); return !!f && f.s > 0.3 && (f.h < 18 || f.h > 340 || (f.h > 80 && f.h < 165)); };
    for (const thema of ["dark", "light", "tnl"]) {
      const s = await oeffne({ lager: neuesLager(voll), thema });
      const p = s.page;
      await p.click('#wkReiter [data-wk-reiter]:nth-child(1)');
      const f = await p.evaluate(() => {
        const w = document.querySelector("#weeklies"), th = document.documentElement.dataset.theme;
        const alle = [...w.querySelectorAll("*")].filter((e) => e.getClientRects().length);
        return { th, farben: [...new Set(alle.flatMap((e) => { const c = getComputedStyle(e); return [c.color, c.backgroundColor, c.borderTopColor, c.accentColor]; }))]
          .filter((c) => c && !/rgba\(0, 0, 0, 0\)|transparent|auto/.test(c)) };
      });
      const schlecht = f.farben.filter(urteil);
      assert(f.th === thema && !schlecht.length, `Thema ${thema}: kein Rot und kein Gruen im Bereich`, { th: f.th, schlecht });
      const k = await p.evaluate(() => {
        const rgba = (c) => { const m = (c.match(/[\d.]+/g) || []).map(Number); return [m[0] || 0, m[1] || 0, m[2] || 0, m.length > 3 ? m[3] : 1]; };
        const ueber = (o, u) => [0, 1, 2].map((i) => o[i] * o[3] + u[i] * (1 - o[3]));
        const kette = (el) => { const k = []; for (let e = el; e; e = e.parentElement) k.unshift(e); return k; };
        const grund = (el) => kette(el).reduce((u, e) => { const b = rgba(getComputedStyle(e).backgroundColor); const op = kette(e).reduce((a, x) => a * +getComputedStyle(x).opacity, 1); return ueber([b[0], b[1], b[2], b[3] * op], u); }, [255, 255, 255]);
        const lum = (c) => { const l = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
        const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const text = (el) => { const g = grund(el), c = rgba(getComputedStyle(el).color), op = kette(el).reduce((a, x) => a * +getComputedStyle(x).opacity, 1);
          return Math.round(kontrast(ueber([c[0], c[1], c[2], c[3] * op], g), g) * 100) / 100; };
        const fertig = document.querySelector('.wkgruppe.fertig[data-wk-g="geheimdungeon"]'), offen = document.querySelector('.wkgruppe[data-wk-g="events"]');
        const st = fertig?.querySelector(".wkpunkt.fertig .wkstand");
        return { fertig: !!fertig, stand: st ? text(st) : 0, standText: st?.textContent,
          erl: fertig ? getComputedStyle(fertig.querySelector(".wkkerl")).color : "", gold: getComputedStyle(document.querySelector(".wkgzahl b")).color,
          nameF: fertig ? getComputedStyle(fertig.querySelector(".wkname")).color : "", nameO: getComputedStyle(offen.querySelector(".wkname")).color,
          iconF: fertig ? getComputedStyle(fertig.querySelector(".wkicon")).opacity : "", iconO: getComputedStyle(offen.querySelector(".wkicon")).opacity,
          linien: [...document.querySelectorAll(".wkraster thead th, .wkraster tbody tr")].map((x) => getComputedStyle(x)).filter((c) => c.boxShadow !== "none" || c.borderBottomStyle !== "none").length };
      });
      assert(k.fertig && k.stand >= 4.5, `Thema ${thema}: der Zaehlerstand in der erledigten Kachel (${k.standText}) hat mindestens 4,5:1, gemessen ${k.stand}:1 (Pruefung M1)`, k);
      assert(k.erl && k.erl !== k.gold && k.nameF !== k.nameO && k.iconF === "0.6" && k.iconO === "1",
        `Thema ${thema}: die erledigte Kachel tritt zurueck - \u201eerledigt\u201c ohne Gold, Namen leiser, Bilder 60 % (Finish 4, Pruefung N6)`, k);
      assert(k.linien === 0, `Thema ${thema}: keine Linien unter den Fluegelkoepfen und Zeilen des Rasters (Finish 5)`, k.linien);
      // der leere Punkt, am Bildschirm gemessen: der staerkste Pixel um die Mitte gegen den Grund des Feldes
      const png = (await p.locator('.wkzelle[data-wk-punkt="altarAlbtraum"]').screenshot()).toString("base64");
      const punktK = await p.evaluate(async (b64) => {
        const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        const g = c.getContext("2d"); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data, px = (x, y) => { const i = (y * c.width + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
        const lum = (q) => { const l = q.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
        const cx = Math.floor(c.width / 2), cy = Math.floor(c.height / 2), grund = px(cx - 30, cy);
        let best = 1;
        for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 6; x <= cx + 6; x++) { const a = lum(px(x, y)), b = lum(grund); best = Math.max(best, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)); }
        return { best: Math.round(best * 100) / 100, grund, w: c.width, h: c.height };
      }, png);
      assert(punktK.best >= 3, `Thema ${thema}: der leere Punkt im Rasterfeld hat am Bildschirm mindestens 3:1, gemessen ${punktK.best}:1 (Finish 2)`, punktK);
      assert(!s.fehler.length, `Thema ${thema}: keine Fehler`, s.fehler);
      await p.close();
    }
  }
  assert((BILDER ? bilder.wkHatBild("korridor") && bilder.wkHatBild("umwandlungsstein") : !bilder.wkHatBild("korridor") && !bilder.wkHatBild("umwandlungsstein"))
    && !bilder.wkHatBild("constructor") && !bilder.wkHatBild("toString") && !bilder.wkHatBild("illusionen"),
    "Bilder: nur eigene Schluessel tragen ein Bild, keine aus dem Prototyp (Pruefung N6)" + (BILDER ? "" : " (ohne Spielbilder: Marke)"));
  assert(!lager.abgelehnt.length, "ueber alles: kein gesendeter Stand brach eine Regel der Route oder liess Gespeichertes weg", lager.abgelehnt);
} finally {
  await browser.close();
  rmSync(ordner, { recursive: true, force: true });
}

console.log();
if (failed) { console.log(`WEEKLIES PAGE FAILED - ${failed}`); process.exit(1); }
console.log("WEEKLIES PAGE PASSED");
