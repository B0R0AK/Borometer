// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die Rekorde je Charakter an der gebauten Seite (Twinks #251, Schritt 2,
// Spezifikation docs/superpowers/specs/2026-10-15-twinks-design.md 4, 6 und 8,
// Aufbau B): ohne Charaktere der alte Aufbau; mit Charakteren die fixierte
// Leiste mit Ringen (Gesamt, Main, Twinks, unbekannt), Zaehlern, Gleiter,
// Pfeiltasten, Reihenfolge und Sprungleiste, die fuenf Teile, Medaillons mit
// bestem und erstem Kampf, Zuwachs und aufklappbarem Vergleich, der Held je
// Ring, der Hinweis "Neuer Charakter?" mit Hinzufuegen und Ignorieren (die
// Liste ignoriert, loesbar in den Einstellungen), Deutsch und Englisch,
// 560 Punkt und 2000 x 1480, vier Themen, weniger Bewegung.
//
// Kein Server: die Seite kommt vom gestellten Helfer (page.route), der
// /api/weeklies durch das echte checkWeeklies() beantwortet (wie
// test-charaktere-page.mjs) und den Verlauf als logIndex aus /api/config
// liefert. Namen und Zahlen sind erfunden. Gewartet wird auf Zustaende.
//
// Run:  npm run test:twinks-page     (baut die Seite zuerst)

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
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 900))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const NB = String.fromCharCode(160);

const ordner = mkdtempSync(join(tmpdir(), "boro-twpage-"));
process.env.APPDATA = ordner;
mkdirSync(join(ordner, "Borometer"), { recursive: true });
const electron = { name: "electron", setup(b) {
  b.onResolve({ filter: /^electron$/ }, () => ({ path: "electron", namespace: "gestellt" }));
  b.onLoad({ filter: /.*/, namespace: "gestellt" }, () => ({ loader: "js",
    contents: "export const app = { isPackaged: false, getAppPath: () => process.env.APPDATA, getPath: () => process.env.APPDATA };" }));
} };
const bundle = async (entry, plugins = []) => {
  const b = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent",
    plugins: [bilderPlugin(root, bilderModus(root)), ...plugins] });
  return import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));
};
const wk = await bundle("src/main/weeklies.ts", [electron]);
const dictMod = await esbuild.build({ stdin: { contents: 'export { I18N } from "./src/renderer/app/07-dictionary";', resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
const { I18N } = await import("data:text/javascript;base64," + Buffer.from(dictMod.outputFiles[0].text).toString("base64"));
const DE = I18N.de, EN = I18N.en;
const TW_KEYS = Object.keys(DE).filter((k) => k.startsWith("tw.") || k.startsWith("ch.ign"));

/* ---------- erfundene Charaktere und Kaempfe ---------- */
const TESSA = "wtest00001", BRANN = "wtest00002", ILKA = "wtest00003";
const profil = (id, name, mehr = {}) => ({ id, name, ...mehr, zaehler: {}, aus: [], namen: {}, eigene: [] });
const NAMEN = ["Tessa", "Brann", "Ilka", "Mira", "Nora"];
const STAND = { v: 1, profile: [profil(BRANN, "Brann", { log: "Brann" }), profil(TESSA, "Tessa", { log: "Tessa", main: true }),
  profil(ILKA, "Ilka", { log: "Ilka", geloest: true })] };
const TAG = 86400000, T0 = Date.UTC(2026, 9, 1, 19, 0, 0);
const kampf = (name, dps, tag, ch, mehr = {}) => ({ name, dps, dmg: dps * 120, dur: 120, at: T0 + tag * TAG + (mehr.min || 0) * 60000,
  top: mehr.top ?? dps * 3, topSid: "boro:ventius", hits: 300, crit: 100, heavy: 20, miss: 2, ...(ch === undefined ? {} : { ch }) });
const KAEMPFE = [
  // Kowazan: erster Kampf Tessa (100k), bester Brann (180k); Ilka (geloest) hatte mehr und zaehlt nicht
  kampf("Kowazan", 100000, 0, TESSA), kampf("Kowazan", 150000, 2, TESSA), kampf("Kowazan", 180000, 3, BRANN), kampf("Kowazan", 999000, 4, ILKA, { top: 9990000 }),
  // Daigon: ohne Charakter und mit einer Kennung, die nicht mehr in der Liste steht: unbekannt
  kampf("Daigon", 90000, 1), kampf("Daigon", 120000, 5, "wtest00099"),
  kampf("Tevent", 70000, 1, TESSA), kampf("Tevent", 77000, 2, TESSA),
  kampf("Vegamor", 60000, 1, BRANN), kampf("Vegamor", 66000, 6, BRANN),
  kampf("Vulcanus", 50000, 1, TESSA), kampf("Vulcanus", 65000, 2, TESSA),
  kampf("Verence", 40000, 1, BRANN), kampf("Verence", 44000, 2, BRANN),
  kampf("Calanthia", 20000, 1, TESSA), kampf("Calanthia", 25000, 3, TESSA, { top: 4100000 }),
];
const INDEX = { "TLCombatLog-alt.txt": { size: 1000, bytes: 1000, fights: KAEMPFE, zv: [BRANN, ILKA, TESSA].sort().join(",") } };

/* Ein kleiner Kampflog mit einem Angreifer (wie test-charaktere-page.mjs): Vulcanus, 75 s. */
const SKILLS = [["Detonation Mark", 953174691], ["Quick Fire", 964762401], ["Strafing", 945674044]];
const two = (n, w = 2) => String(n).padStart(w, "0");
const stamp = (ms) => { const d = new Date(ms);
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`; };
const arbeit = mkdtempSync(join(tmpdir(), "boro-twlog-"));
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

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

async function oeffne({ lang = "de", breite = 1280, hoehe = 860, stand = STAND, index = INDEX, thema = null, reduziert = false } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe }, reducedMotion: reduziert ? "reduce" : "no-preference" });
  const lager = { data: structuredClone(stand), posts: [], abgelehnt: [] };
  const s = { page, fehler: [], lager, config: [] };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/weeklies" && req.method() === "GET") return json({ ok: true, data: lager.data });
    if (path === "/api/weeklies") {
      const b = JSON.parse(req.postData() || "{}");
      lager.posts.push(b.data);
      const clean = Object.keys(b).join() === "data" ? wk.checkWeeklies(b.data, lager.data) : null;
      if (!clean) { lager.abgelehnt.push(b.data); return json({ ok: false }, 400); }
      lager.data = clean;
      return json({ ok: true });
    }
    if (path === "/api/config" && req.method() === "GET") return json({ rundgangGesehen: true, logIndex: index, ...(thema ? { theme: thema } : {}) });
    if (path === "/api/config") { s.config.push(req.postData() || ""); return json({ ok: true }); }
    if (path === "/api/logs") return json({ ok: true, files: [] });
    if (path === "/api/state") return json({ dir: "", file: "", nativeFrame: false, material: false, stayOnTop: false });
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: {} }); }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html");
  await page.waitForFunction(() => !!document.body.dataset.bereit);
  await page.waitForFunction(() => document.querySelector("#wkBody")?.dataset.lage === "da");
  if (thema) await page.evaluate((k) => document.querySelector(`#themeRow button[data-theme="${k}"]`)?.click(), thema);
  return s;
}
async function bis(fn, ms = 6000) {
  const ende = performance.now() + ms;
  while (performance.now() < ende) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
  return !!(await fn());
}
const rekordeAuf = async (p, mitTw = true) => {
  await p.click('#bereiche [data-tab="rekorde"]');
  await p.waitForFunction(() => !document.querySelector("#rekorde").hidden);
  if (mitTw) await p.waitForFunction(() => !!document.querySelector("#rkInhalt .twfix .twfk"));
};
const ringe = (p) => p.evaluate(() => [...document.querySelectorAll("#rkInhalt .twfk")].map((b) => ({ sel: b.dataset.sel, name: b.querySelector(".fn")?.textContent,
  an: b.getAttribute("aria-pressed") === "true", z: b.querySelector(".fz")?.textContent, main: !!b.querySelector(".twmain"), vh: b.querySelector(".vh")?.textContent })));
const med = (p, name) => p.evaluate((n) => {
  // der Name ohne die Initiale im Ring (aria-hidden)
  const ohneRing = (el) => { if (!el) return undefined; const c = el.cloneNode(true); c.querySelectorAll(".twring").forEach((x) => x.remove()); return c.textContent; };
  const li = [...document.querySelectorAll("#rkInhalt .twmed")].find((x) => x.querySelector(".mname")?.textContent === n);
  if (!li) return null;
  const k = li.querySelector(".twkopf"), v = li.querySelector(".twvgl");
  return { halter: li.dataset.halter, best: li.querySelector(".twbest .mdps")?.textContent, bestWer: ohneRing(li.querySelector(".twbest .twwer")),
    erst: li.querySelector(".twerst b")?.textContent, erstWer: ohneRing(li.querySelector(".twerst .twwer")),
    zuwachs: li.querySelector(".twweg em")?.textContent ?? null, zuwachsVh: li.querySelector(".twweg")?.getAttribute("aria-label") ?? null,
    auf: k?.getAttribute("aria-expanded"), inert: v?.hasAttribute("inert"), teil: li.closest(".twteil")?.id,
    vgl: [...li.querySelectorAll(".twvgl li")].map((r) => [r.querySelector("span:not(.twring)")?.textContent, r.querySelector("em")?.textContent, r.className]),
    top: li.querySelector(".twtop")?.textContent, zurueck: li.classList.contains("zurueck") };
}, name);
/* einen Ring waehlen und warten, bis er gewaehlt ist und die Zahlen stehen */
async function waehle(p, sel) {
  await p.click('.twfk[data-sel="' + sel + '"]');
  await p.waitForFunction((x) => document.querySelector('.twfk[data-sel="' + x + '"]')?.getAttribute("aria-pressed") === "true"
    && !("laeuft" in document.querySelector("#rkInhalt").dataset), sel);
}
const teilNamen = (p, id) => p.evaluate((i) => [...document.querySelectorAll("#tw-" + i + " .rkmed .mname")].map((x) => x.textContent), id);

try {
  // --- 1. Ohne Charaktere: der alte Aufbau, keine Leiste (Paritaet)
  {
    const s = await oeffne({ stand: { v: 1, profile: [profil(TESSA, "Tessa")] } });
    const p = s.page;
    await rekordeAuf(p, false);
    await p.waitForFunction(() => !!document.querySelector("#rks-raid"));
    const z = await p.evaluate(() => ({ fix: !!document.querySelector(".twfix"), alt: ["raid", "puppe", "feld", "dungeon"].every((i) => !!document.querySelector("#rks-" + i)),
      tw: !!document.querySelector(".twteil"), aufbau: document.querySelector("#rkInhalt").dataset.aufbau ?? null }));
    assert(!z.fix && z.alt && !z.tw && z.aufbau === null, "1: ohne Charakter mit Logname: der bisherige Aufbau, keine Leiste, keine fuenf Teile", z);
    assert(!s.fehler.length, "1: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 2. bis 9.: mit Charakteren (deutsch)
  {
    const s = await oeffne();
    const p = s.page;
    await rekordeAuf(p);
    let r = await ringe(p);
    assert(JSON.stringify(r.map((x) => x.sel)) === JSON.stringify(["gesamt", TESSA, BRANN, "?"]) && r.map((x) => x.name).join() === "Gesamt,Tessa,Brann,unbekannt",
      "2: Ringe Gesamt, der Main zuerst, dann der Twink, zuletzt unbekannt; der geloeste Charakter hat keinen", r);
    assert(r[1].an && !r[0].an && r[1].main && !r[2].main, "2: die Rekorde oeffnen auf dem Main (Tessa), er traegt die Marke „Main“", r);
    // Tessa: Tevent, Vulcanus, Calanthia = 3; Brann: Kowazan, Vegamor, Verence = 3; unbekannt: Daigon = 1; Gesamt: 7 Bosse
    assert(r.map((x) => x.z).join() === "7,3,3,1" && r[0].vh === ", 7 Bosse bekämpft" && r[1].vh === ", 3 Rekorde",
      "2: die Zaehler: 7 Bosse bekaempft, je Charakter die gehaltenen Rekorde (fuer Vorleser mit Wort)", r);
    const g = await p.evaluate(() => { const an = document.querySelector('.twfk[aria-pressed="true"]'), gl = document.querySelector(".twgleiter");
      return { gl: gl?.style.getPropertyValue("--x"), an: an?.offsetLeft + "px", w: gl?.style.getPropertyValue("--w"), aw: an?.offsetWidth + "px" }; });
    assert(g.gl === g.an && g.w === g.aw, "2: der Gleiter steht unter dem gewaehlten Ring", g);

    // 3. die fuenf Teile
    const teile = await p.evaluate(() => [...document.querySelectorAll("#rkInhalt .twteil")].map((x) => [x.id, x.querySelector("h3")?.textContent, x.querySelector(".szahl")?.textContent]));
    assert(JSON.stringify(teile.map((x) => x[1])) === JSON.stringify(["Raids", "Feldbosse", "Erzbosse", "Dungeons", "Halle der Illusionen"]),
      "3: fuenf Teile: Raids, Feldbosse, Erzbosse, Dungeons, Halle der Illusionen", teile);
    const sprung = await p.evaluate(() => [...document.querySelectorAll(".twsprung a")].map((a) => a.textContent));
    assert(sprung.join() === "Raids,Feldbosse,Erzbosse,Dungeons,Halle der Illusionen", "3: die Sprungleiste nennt die fuenf Teile", sprung);
    const raids = await teilNamen(p, "raid");
    assert(raids.join() === "Dragaryle,Zairos · Vulkan,Radeth,Calanthia", "3: Raids in der Reihenfolge des Spiels, auch die leeren", raids);
    const erz = await teilNamen(p, "erz");
    assert(erz.includes("Vegamor") && erz.includes("Tevent") && !(await teilNamen(p, "feld")).includes("Vegamor"), "3: Vegamor steht bei den Erzbossen", erz);
    assert((await teilNamen(p, "halle")).includes("Verence") && !(await teilNamen(p, "dungeon")).includes("Verence"), "3: Verence steht in der Halle der Illusionen");
    const puppe = await p.evaluate(() => !!document.querySelector("#rks-puppe") && !document.querySelector("#rks-feld"));
    assert(puppe, "3: die Uebungspuppe bleibt eine eigene Seite, Feldbosse alter Art gibt es nicht mehr");

    // 4. Gesamt: Kowazan haelt Brann, der erste Kampf ist Tessas
    await waehle(p, "gesamt");
    let m = await med(p, "Kowazan");
    assert(m && m.halter === BRANN && m.best === "180.0k" && /^Brann · am /.test(m.bestWer) && m.erst === "100.0k" && /^Tessa · am /.test(m.erstWer),
      "4: Gesamt, Kowazan: bester Kampf 180.0k von Brann, erster Kampf 100.0k von Tessa (Ilka ist geloest und zaehlt nicht)", m);
    assert(m.zuwachs === "+80" + NB + "%" && m.zuwachsVh === "Zuwachs vom ersten zum besten Kampf: plus 80 Prozent",
      "4: die Spur sagt +80 % (geschuetztes Leerzeichen) und fuer Vorleser den ganzen Satz", m);
    const d = await med(p, "Daigon");
    assert(d && d.halter === "?" && /^unbekannt · am /.test(d.bestWer) && /^unbekannt · am /.test(d.erstWer),
      "4: Kaempfe ohne ch und mit einer Kennung, die nicht mehr in der Liste steht, haelt „unbekannt“", d);

    // 5. aufklappen
    assert(m.auf === "false" && m.inert, "5: zu: aria-expanded false, der Vergleich ist inert", m);
    await p.evaluate(() => [...document.querySelectorAll(".twmed")].find((x) => x.querySelector(".mname")?.textContent === "Kowazan").querySelector(".twkopf").click());
    m = await med(p, "Kowazan");
    assert(m.auf === "true" && !m.inert && JSON.stringify(m.vgl) === JSON.stringify([["Tessa", "150.0k", ""], ["Brann", "180.0k", "v1"], ["unbekannt", "–", "v0"]]),
      "5: auf: der Vergleich nennt je Ring den besten Pull, mit nur einem Kampf dessen DPS; der Halter (Brann) traegt die Glut", m);
    assert(/stärkster Treffer/.test(m.top || ""), "5: der staerkste Treffer steht leise im aufgeklappten Teil", m.top);

    // 6. Reihenfolge: Zuletzt; die Raids bleiben
    const feldVor = await teilNamen(p, "feld");
    await p.click('.twsort button[data-sort="neu"]');
    await p.waitForFunction(() => document.querySelector('.twsort button[data-sort="neu"]')?.getAttribute("aria-pressed") === "true");
    const feldNach = await teilNamen(p, "feld");
    assert(feldVor[0] === "Kowazan" && feldNach[0] === "Daigon" && (await teilNamen(p, "raid")).join() === raids.join(),
      "6: Bester DPS stellt Kowazan vor Daigon, Zuletzt Daigon (Tag 5) vor Kowazan (Tag 3); die Raids bleiben in ihrer Reihenfolge", { feldVor, feldNach });
    assert((await med(p, "Kowazan")).auf === "true", "6: das Aufgeklappte bleibt beim neuen Zeichnen offen");
    await p.click('.twsort button[data-sort="best"]');

    // 7. Hervorheben in Gesamt
    await p.hover('.twfk[data-sel="' + BRANN + '"]');
    await bis(() => p.evaluate(() => document.querySelectorAll(".twmed.zurueck").length > 0));
    const hl = await p.evaluate((b) => [...document.querySelectorAll(".twmed")].map((x) => [x.dataset.halter === b, x.classList.contains("zurueck")]), BRANN);
    assert(hl.length > 0 && hl.every(([seins, zurueck]) => seins !== zurueck), "7: Hover auf Brann: seine Rekorde bleiben, die anderen treten zurueck", hl);
    await p.mouse.move(2, 2);
    await bis(() => p.evaluate(() => !document.querySelector(".twmed.zurueck")));

    // 8. Pfeiltasten
    await p.focus('.twfk[data-sel="gesamt"]');
    await p.keyboard.press("ArrowRight");
    await p.waitForFunction((t) => document.activeElement?.dataset.sel === t && document.activeElement.getAttribute("aria-pressed") === "true", TESSA);
    await p.keyboard.press("End");
    await p.waitForFunction(() => document.activeElement?.dataset.sel === "?" && document.activeElement.getAttribute("aria-pressed") === "true");
    await p.keyboard.press("ArrowRight");
    await p.waitForFunction(() => !("laeuft" in document.querySelector("#rkInhalt").dataset));
    const fk = await p.evaluate(() => document.activeElement?.dataset.sel);
    assert(fk === "gesamt", "8: Pfeil rechts, Ende und wieder rechts: der Fokus und die Wahl wandern mit, am Ende zurueck zum Anfang", fk);

    // 9. Held je Ring
    let held = await p.evaluate(() => ({ t: document.querySelector("#rkHeldT")?.textContent, von: [...document.querySelectorAll(".rkheld .hteil small")].map((x) => x.textContent),
      zahl: document.querySelector(".rkheld .hzahl")?.textContent, b: [...document.querySelectorAll(".rkheld .hteil b")].map((x) => x.textContent) }));
    assert(held.t === "Höchster Treffer insgesamt" && held.zahl === "4.10M" && held.von.includes("von") && held.b.includes("Tessa"),
      "9: Gesamt: der hoechste Treffer (Calanthia, 4.10M) mit „von Tessa“", held);
    await waehle(p, BRANN);
    held = await p.evaluate(() => ({ t: document.querySelector("#rkHeldT")?.textContent, zahl: document.querySelector(".rkheld .hzahl")?.textContent, von: [...document.querySelectorAll(".rkheld .hteil small")].map((x) => x.textContent) }));
    assert(held.t === "Höchster Treffer von Brann" && held.zahl === "540.0k" && !held.von.includes("von"), "9: Brann: sein hoechster Treffer (Kowazan), ohne „von“", held);
    m = await med(p, "Vegamor");
    assert(m && m.best === "66.0k" && !/Brann/.test(m.bestWer) && /^am /.test(m.bestWer) && m.erst === "60.0k", "9: je Charakter seine Zahlen, ohne Namen im Medaillon", m);
    const k1 = await med(p, "Kowazan");
    assert(k1 && k1.best === "noch kein bester Pull" && k1.erst === "180.0k", "9: Brann hat an Kowazan einen Kampf: kein bester Pull, der erste Kampf steht da", k1);
    const leer = await p.evaluate(() => [...document.querySelectorAll("#tw-feld .rkmed")].filter((x) => x.querySelector(".mname")?.textContent === "Daigon").map((x) => x.classList.contains("leer")));
    assert(leer.join() === "true", "9: Brann hat Daigon nicht bekaempft: dort ein leerer Umriss", leer);

    // 10. Sprungleiste und fixierte Leiste
    await p.click('.twsprung a[data-sprung="halle"]');
    await bis(() => p.evaluate(() => document.querySelector('.twsprung a[aria-current="true"]')?.dataset.sprung === "halle"));
    // das sanfte Rollen laeuft nach dem ersten "halle" weiter (#224): erst lesen, wenn scrollTop ueber mehrere Bilder gleich bleibt
    await p.evaluate(() => new Promise((fertig) => {
      const r = document.querySelector(".rkrollt");
      let letzt = -1, gleich = 0;
      const schritt = () => {
        gleich = r.scrollTop === letzt ? gleich + 1 : 0;
        letzt = r.scrollTop;
        if (gleich >= 8) fertig(); else requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    }));
    await bis(() => p.evaluate(() => document.querySelector('.twsprung a[aria-current="true"]')?.dataset.sprung === "halle"));
    const fix = await p.evaluate(() => ({ cur: document.querySelector('.twsprung a[aria-current="true"]')?.dataset.sprung, fokus: document.activeElement?.id,
      oben: Math.round(document.querySelector(".twfix").getBoundingClientRect().top - document.querySelector(".rkrollt").getBoundingClientRect().top),
      gerollt: document.querySelector(".rkrollt").scrollTop }));
    assert(fix.cur === "halle" && fix.fokus === "twt-halle" && fix.gerollt > 0 && fix.oben === 0,
      "10: Sprung zur Halle: gerollt, der Fokus auf ihrer Ueberschrift, die Leiste bleibt oben stehen, der Teil ist markiert", fix);
    assert(!s.fehler.length, "2-10: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 11. Neuer Charakter? Ignorieren, in den Einstellungen loesen, Hinzufuegen
  {
    const s = await oeffne();
    const p = s.page;
    await p.setInputFiles("#fileInput", kampflog("kampf-mira.txt", "Mira"));
    await p.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
    await rekordeAuf(p);
    await p.waitForFunction(() => !!document.querySelector(".twneu"));
    const hin = await p.evaluate(() => ({ text: document.querySelector(".twneu span")?.textContent, vor: !!document.querySelector(".twneu")?.compareDocumentPosition(document.querySelector(".twfix")) }));
    assert(hin.text === "Neuer Charakter? Im Log steht der Angreifer „Mira“, der nicht in deiner Liste steht." && hin.vor,
      "11: der Hinweis nennt den unbekannten Angreifer ruhig ueber der Leiste", hin);
    let n = s.lager.posts.length;
    await p.click("[data-tw-ign]");
    await bis(() => s.lager.posts.length > n);
    assert(JSON.stringify(s.lager.data.ignoriert) === JSON.stringify([{ name: "Mira" }]), "11: Ignorieren: die Datei merkt „Mira“ in ignoriert", s.lager.data);
    await p.waitForFunction(() => !document.querySelector(".twneu"));
    const satz = await p.evaluate(() => document.querySelector("#twSatz")?.textContent);
    assert(satz === "„Mira“ wird ignoriert. Rückgängig in den Einstellungen unter Charaktere.", "11: der Satz sagt, wo es rueckgaengig geht", satz);
    // Einstellungen: die Liste der Ignorierten
    await p.click('#bereiche [data-tab="settings"]');
    await p.waitForFunction(() => !document.querySelector("#einst").hidden);
    await p.click('#einstNav button[data-gruppe="charaktere"]');
    await p.waitForFunction(() => !!document.querySelector("#chInhalt [data-ign]"));
    const ign = await p.evaluate(() => [...document.querySelectorAll("#chInhalt .chign li")].map((li) => [li.querySelector("span")?.textContent, li.querySelector("button")?.getAttribute("aria-label")]));
    assert(JSON.stringify(ign) === JSON.stringify([["Mira", "Mira nicht mehr ignorieren"]]), "11: die Einstellungen zeigen „Mira“ mit „Nicht mehr ignorieren“", ign);
    n = s.lager.posts.length;
    await p.click("#chInhalt [data-ign]");
    await bis(() => s.lager.posts.length > n);
    assert(JSON.stringify(s.lager.data.ignoriert) === JSON.stringify([{ name: "Mira", geloest: true }]) && !s.lager.abgelehnt.length,
      "11: Nicht mehr ignorieren: der Name bleibt in der Datei, geloest", s.lager.data.ignoriert);
    const nachher = await p.evaluate(() => ({ liste: document.querySelectorAll("#chInhalt .chign li").length, satz: document.querySelector("#chSatz")?.textContent,
      fokus: document.activeElement?.id }));
    assert(nachher.liste === 0 && nachher.satz === "„Mira“ wird nicht mehr ignoriert." && nachher.fokus === "chWeeklies",
      "11: die Liste ist leer, ein Satz sagt es, der Fokus steht auf dem naechsten Knopf", nachher);
    // zurueck in die Rekorde: der Hinweis ist wieder da; hinzufuegen
    await rekordeAuf(p);
    await p.waitForFunction(() => !!document.querySelector("[data-tw-dazu]"));
    n = s.lager.posts.length;
    await p.click("[data-tw-dazu]");
    await bis(() => s.lager.posts.length > n && s.lager.data.profile.some((x) => x.name === "Mira"));
    const mira = s.lager.data.profile.find((x) => x.name === "Mira");
    assert(mira && mira.log === "Mira" && !mira.geloest && !mira.main, "11: Als Twink hinzufuegen: ein Charakter Mira mit Logname Mira", mira);
    await p.waitForFunction((id) => !!document.querySelector('.twfk[data-sel="' + id + '"]') && !document.querySelector(".twneu"), mira.id);
    const mi = await p.evaluate(() => document.querySelector("#twSatz")?.textContent);
    assert(mi === "Mira ist als Twink hinzugefügt.", "11: der Satz sagt es, der Ring ist da, der Hinweis weg", mi);
    const mitIndex = () => s.config.map((x) => JSON.parse(x)).filter((b) => b.logIndex?.["kampf-mira.txt"]);
    await bis(() => mitIndex().some((b) => b.logIndex["kampf-mira.txt"].fights?.some((f) => f.ch === mira.id)));
    assert(mitIndex().at(-1)?.logIndex["kampf-mira.txt"].fights.every((f) => f.ch === mira.id), "11: der Kampf des offenen Logs gehoert jetzt Mira (ch, nur die Kennung)",
      mitIndex().at(-1)?.logIndex["kampf-mira.txt"]);
    const namen = s.config.filter((x) => NAMEN.some((nm) => x.includes(nm)));
    assert(!namen.length, "11: kein POST /api/config enthaelt einen Namen", namen.map((x) => x.slice(0, 200)));
    assert(!s.fehler.length, "11: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 12. ein bekannter Angreifer: kein Hinweis
  {
    const s = await oeffne();
    const p = s.page;
    await p.setInputFiles("#fileInput", kampflog("kampf-tessa.txt", "Tessa"));
    await p.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
    await rekordeAuf(p);
    assert(!(await p.evaluate(() => !!document.querySelector(".twneu"))), "12: Angreifer Tessa (Logname eines Charakters): kein Hinweis");
    await p.close();
  }

  // --- 13. Englisch, alle Texte in beiden Sprachen
  {
    const fehlt = TW_KEYS.filter((k) => !(k in EN) || typeof EN[k] !== typeof DE[k]);
    assert(TW_KEYS.length >= 30 && !fehlt.length, "13: jeder neue Text steht in DE und EN mit demselben Schluessel", fehlt);
    const bau = TW_KEYS.filter((k) => typeof DE[k] === "string" && /\bBau\b/.test(DE[k]));
    assert(!bau.length, "13: kein „Bau“ im deutschen Text", bau);
    const s = await oeffne({ lang: "en" });
    const p = s.page;
    await rekordeAuf(p);
    const z = await p.evaluate(() => ({ ringe: [...document.querySelectorAll(".twfk .fn")].map((x) => x.textContent), sort: [...document.querySelectorAll(".twsort button")].map((x) => x.textContent),
      teile: [...document.querySelectorAll(".twteil h3")].map((x) => x.textContent) }));
    assert(z.ringe[0] === "All" && z.ringe.at(-1) === "unknown" && z.sort.join() === "Best DPS,Latest,Biggest gain"
      && z.teile.join() === "Raids,Field bosses,Archbosses,Dungeons,Halls of Illusion", "13: Englisch: Ringe, Reihenfolge und Teile", z);
    await p.close();
  }

  // --- 14. 560 Punkt ohne waagerechtes Rollen, 2000 x 1480 mit mehr Spalten
  for (const [breite, hoehe] of [[560, 900], [2000, 1480]]) {
    const s = await oeffne({ breite, hoehe });
    const p = s.page;
    await rekordeAuf(p);
    await p.evaluate(() => document.querySelector(".twfk")?.click());
    const z = await p.evaluate(() => {
      const r = document.querySelector(".rkrollt"), raster = document.querySelector("#tw-feld .twraster");
      const spalten = getComputedStyle(raster).gridTemplateColumns.split(" ").length;
      const breit = Math.max(...[...document.querySelectorAll(".twmed")].map((x) => x.getBoundingClientRect().width));
      return { seite: document.documentElement.scrollWidth <= innerWidth, rollt: r.scrollWidth <= r.clientWidth, spalten, breit };
    });
    if (breite === 560) assert(z.seite && z.rollt && z.spalten === 2, "14: 560 Punkt: kein waagerechtes Rollen, zwei Spalten", z);
    else assert(z.seite && z.rollt && z.spalten >= 6 && z.breit <= 200, "14: 2000 x 1480: mehr Spalten, kein Medaillon breiter als 200 Punkt", z);
    assert(!s.fehler.length, "14: keine Fehler (" + breite + ")", s.fehler);
    await p.close();
  }

  // --- 15. vier Themen: die Leiste deckt den Inhalt darunter (eigener Grund), der gewaehlte Zaehler traegt die Glut
  for (const thema of ["dark", "light", "tnl", "glass"]) {
    const s = await oeffne({ thema });
    const p = s.page;
    await rekordeAuf(p);
    const z = await p.evaluate(() => {
      const fix = getComputedStyle(document.querySelector(".twfix")).backgroundColor;
      const an = getComputedStyle(document.querySelector('.twfk[aria-pressed="true"] .fz')).backgroundColor;
      const aus = getComputedStyle(document.querySelector('.twfk[aria-pressed="false"] .fz')).backgroundColor;
      return { fix, an, aus, thema: document.documentElement.dataset.theme || document.body.dataset.theme || "" };
    });
    assert(z.fix !== "rgba(0, 0, 0, 0)" && z.fix !== "transparent" && z.an !== z.aus, "15: Thema " + thema + ": die Leiste hat Grund, der gewaehlte Zaehler hebt sich ab", z);
    await p.close();
  }

  // --- 16. weniger Bewegung: die Zahlen stehen sofort
  {
    const s = await oeffne({ reduziert: true });
    const p = s.page;
    await rekordeAuf(p);
    await p.click('.twfk[data-sel="gesamt"]');
    const m = await med(p, "Kowazan");
    const laeuft = await p.evaluate(() => "laeuft" in document.querySelector("#rkInhalt").dataset);
    assert(m && m.best === "180.0k" && !laeuft, "16: bei reduzierter Bewegung laufen die Zahlen nicht ein, sie stehen gleich", m);
    await p.close();
  }
} finally {
  await browser.close();
  rmSync(ordner, { recursive: true, force: true });
  rmSync(arbeit, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} Pruefung(en) fehlgeschlagen` : "\nalle Pruefungen ok");
process.exit(failed ? 1 : 0);
