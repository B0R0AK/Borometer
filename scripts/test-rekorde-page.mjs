// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Bereich Rekorde an der gebauten Seite (Spezifikation
// docs/superpowers/specs/2026-10-01-rekorde-design.md, 2a und 3): Bereich,
// Held, Albumseiten mit "N von M bekaempft", Medaillons, leere Umrisse und
// "ab TT.MM."; das einmalige Nachlesen ueber gestellte Routen (Fortschritt,
// Abbruch, Fortsetzen, nichts doppelt, eine gewachsene Datei nur ab der
// bekannten Groesse), "Rekorde neu einlesen", der Satz im Browser ohne App,
// histRecord mit top und topSid (nie ein Name), Deutsch und Englisch, die Groessen
// 2000 x 1480, 1280 x 860 und 560, drei Themen und die Tastatur. Dazu ein Log nur
// mit Uhrzeit (Fix verlauf-ohne-datum): kein Kampf ins Verzeichnis, ein alter
// Eintrag bleibt, Verlauf und Rekorde zeigen keinen 01.01.
//
// Kein Server: die Seite kommt vom gestellten Helfer (page.route), der
// /api/logs und /api/log mit dem echten logs.ts aus einem Temp-Ordner
// beantwortet. Die Logs sind erfunden - Bossnamen, Zahlen und Faehigkeiten,
// der Spieler heisst "Probe7"; sein Name darf nirgends gespeichert werden.
//
// Run:  npm run test:rekorde-page     (baut die Seite zuerst)
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import * as esbuild from "esbuild";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { bilderModus, bilderPlugin, gebauterModus } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/* Ohne Spielbilder (BORO_BILDER=aus, der oeffentliche Quelltext) tragen die
   Raid-Medaillons statt des Fotos die runde Platte mit dem Anfang des Namens
   (.bild.init); die Proben pruefen dann sie an derselben Stelle. */
const BILDER = gebauterModus(root) === "voll";
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 900))); }
}
const bundle = async (contents) => {
  const b = await esbuild.build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, format: "esm", platform: "node",
    write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))], define: { __BORO_VERSION__: '"test"' } });
  return import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));
};
const logs = await bundle('export * from "./src/main/logs";');
const { I18N } = await bundle('export { I18N } from "./src/renderer/app/07-dictionary";');
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const DATEI = "file:///" + join(root, "dist", "renderer", "index.html").replace(/\\/g, "/").replace(/^\/+/, "");
const NB = String.fromCharCode(160);

/* ---------- erfundene Logs ----------
   Ein Kampf: Treffer alle 500 ms ueber dur Sekunden an einem Boss, Schaden
   wachsend, dazu ein staerkster Treffer mit eigener Faehigkeit in der Mitte.
   Die Uhr ist die des Logs (Datum und Uhrzeit, wie das Spiel sie schreibt). */
const SPIELER = "Probe7";
const zwei = (n, l = 2) => String(n).padStart(l, "0");
const stempel = (ms) => { const d = new Date(ms); return d.getUTCFullYear() + zwei(d.getUTCMonth() + 1) + zwei(d.getUTCDate()) + "-" +
  zwei(d.getUTCHours()) + ":" + zwei(d.getUTCMinutes()) + ":" + zwei(d.getUTCSeconds()) + ":" + zwei(d.getUTCMilliseconds(), 3); };
function kampf({ boss, at, dur = 30, basis = 1000, top, skill = "Eye of Ventius", sid = "boro:ventius", volley = false }) {
  const z = [], n = Math.floor(dur * 2);
  let max = { dmg: -1, t: 0, skill: "" }, sum = 0;
  for (let i = 0; i <= n; i++) {
    const t = at + i * 500;
    const istTop = top != null && i === Math.floor(n / 2);
    const dmg = istTop ? top : basis + i;
    const sk = istTop ? skill : "Brutal Arrow";
    z.push(`${stempel(t)},DamageDone,${sk},${istTop ? sid : 999000002},${dmg},0,0,kNormalHit,${SPIELER},${boss}`);
    sum += dmg;
    if (dmg > max.dmg) max = { dmg, t, skill: sk };
  }
  /* volley: eine Salve von Ventius (1 + 3 + 3 Treffer der Familie, wie das Spiel sie schreibt) - beim Oeffnen lernte
     Ventius daraus; beim Nachlesen darf es das nicht */
  if (volley) {
    const v0 = at + 2000, w = [0, 1000, 1000, 1000, 1100, 1100, 1100];
    w.forEach((d, j) => { z.push(`${stempel(v0 + d + j)},DamageDone,Decisive Sniping,999000003,${900 + j},0,0,kNormalHit,${SPIELER},${boss}`); sum += 900 + j; });
    z.sort();
  }
  return { zeilen: z, boss, at, dps: sum / Math.max(n * 0.5, 1), top: max.dmg, topSid: max.skill === "Brutal Arrow" ? "999000002" : sid };
}
const logText = (kaempfe) => ["CombatLogVersion,4", ...kaempfe.flatMap((k) => k.zeilen)].join("\n") + "\n";
const TAG = 86400000, T0 = Date.UTC(2026, 8, 20, 19, 0, 0);   // 20.09.2026 19:00 (Uhr des Logs)

const work = mkdtempSync(join(tmpdir(), "boro-rekorde-"));
function datei(ordner, name, kaempfe, wann) {
  const p = join(ordner, name);
  writeFileSync(p, logText(kaempfe));
  utimesSync(p, new Date(wann), new Date(wann));
  return p;
}
/* drei Logs an drei Tagen: Morokai zweimal, Akman (Manticus) einmal, Aridus einmal */
/* K1: der staerkste Treffer ist ein Entschlossener Scharfschuss mit der Kennung des Spiels; die Salve im selben
   Kampf macht ihn zu Ventius (ventiusPass), gespeichert wird boro:ventius - "Wenn es Ventius ist, ist es Ventius" */
const K1 = [kampf({ boss: "Morokai", at: T0, basis: 2000, top: 300000, skill: "Decisive Sniping", sid: "999000001", volley: true })];
const K2 = [kampf({ boss: "Morokai", at: T0 + TAG, basis: 3000, top: 280000, skill: "Decisive Sniping", sid: "999000001" }),
  kampf({ boss: "Akman", at: T0 + TAG + 3600000, basis: 2500, top: 512000 })];
const K3 = [kampf({ boss: "Aridus", at: T0 + 2 * TAG, basis: 1500, top: 150000, skill: "Brutal Arrow", sid: "945725019" })];
const ordner = join(work, "logs");
mkdirSync(ordner);
datei(ordner, "TLCombatLog-260920.txt", K1, T0 + 3600000);
datei(ordner, "TLCombatLog-260921.txt", K2, T0 + TAG + 7200000);
const D3 = datei(ordner, "TLCombatLog-260922.txt", K3, T0 + 2 * TAG + 3600000);

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Der gestellte Helfer. index: der logIndex aus /api/config; liste: statt der Dateien des Ordners eine feste
   Liste fuer /api/logs; grenze: die Obergrenze eines Stuecks (das Laden in Stuecken); halten(name): ein
   Versprechen, auf das /api/log fuer diese Datei wartet (der Fortschritt laesst sich so ansehen). */
async function oeffne({ lang = "de", breite = 1280, hoehe = 860, index = {}, liste = null, grenze = 0, thema = null, halten = null, dir = ordner, zoom = null, live = false, best = {} } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const s = { page, fehler: [], anfragen: [], logIndex: null, posts: 0, schluessel: [] };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path.startsWith("/api/")) s.anfragen.push({ m: req.method(), path, name: url.searchParams.get("name"), from: url.searchParams.get("from") });
    if (path === "/api/state") {
      const f = live ? logs.newestLog(dir) : null;
      return json(200, { dir, file: f?.name ?? "", size: f?.size ?? 0, mtime: f?.mtime ?? 0 });
    }
    if (path === "/api/latest") {
      const f = logs.newestLog(dir);
      if (!f) return route.fulfill({ status: 404, body: "" }).catch(() => {});
      const a = logs.latestAnswer(f, url.searchParams.get("file"), url.searchParams.get("from"));
      return json(a.status, a.body);
    }
    if (path === "/api/logs" && req.method() === "GET")
      return json(200, { ok: true, files: liste || logs.listLogs(dir).map((f) => ({ name: f.name, size: f.size, mtime: f.mtime })) });
    if (path === "/api/log" && req.method() === "GET") {
      if (halten) { const h = halten(url.searchParams.get("name")); if (h) await h; }
      const a = logs.logAnswer(dir, url.searchParams.get("name"), url.searchParams.get("from"));
      if (grenze && a.status === 200) {
        const f = logs.listLogs(dir).find((x) => x.name === url.searchParams.get("name"));
        a.body = logs.readLogFrom(f, Number(url.searchParams.get("from")), grenze);
      }
      return json(a.status, a.body);
    }
    if (path === "/api/config" && req.method() === "POST") {
      const sent = JSON.parse(req.postData() || "{}");
      s.schluessel.push(...Object.keys(sent));
      if (sent.logIndex) { s.logIndex = sent.logIndex; s.posts++; }
      return json(200, { ok: true });
    }
    if (path === "/api/config") return json(200, { logIndex: index, ...(thema ? { theme: thema } : {}), ...(zoom ? { uiZoom: zoom } : {}) });
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json(200, { ok: true, registered: true, counts: {} }); }
    if (path === "/api/best" && req.method() === "GET") return json(200, { ok: true, best });
    if (path === "/api/weeklies" && req.method() === "GET") return json(200, { ok: true, data: { v: 1, profile: [] } });
    if (path.startsWith("/api/")) return json(200, { ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html");
  await page.waitForFunction(() => !!document.body.dataset.bereit);
  if (thema) await page.evaluate((k) => document.querySelector(`#themeRow button[data-theme="${k}"]`)?.click(), thema);
  return s;
}
/* auf Zustaende warten, nie auf eine feste Zeit */
const warte = (p, fn, arg, ms = 8000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
async function bis(fn, ms = 8000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
  return !!(await fn());
}
const rekordeAuf = async (p) => {
  await p.click('#bereiche [data-tab="rekorde"]');
  await p.waitForFunction(() => !document.querySelector("#rekorde").hidden);
};
const ruhig = (s) => bis(() => s.page.evaluate(() => {
  const b = document.querySelector("#rkAbbrechen");
  return !!b && b.hidden;
}));
const logAnfragen = (s) => s.anfragen.filter((a) => a.path === "/api/log");
const blick = (p) => p.evaluate(() => {
  const q = (x, r = document) => r.querySelector(x), qa = (x, r = document) => [...r.querySelectorAll(x)];
  // nur gewoehnlicher Leerraum: das geschuetzte Leerzeichen vor % und s bleibt, wie es steht
  const txt = (e) => (e?.textContent || "").replace(/[ \t\n\r]+/g, " ").trim();
  return {
    offen: !q("#rekorde").hidden, aktuell: q('#bereiche [data-tab="rekorde"]')?.getAttribute("aria-current") || "",
    titel: txt(q("#rkTitel")), quelle: txt(q("#rkQuelle")), hinweis: txt(q(".rkhinweis")), satz: txt(q("#rkSatz")),
    abbrechen: !q("#rkAbbrechen").hidden, weiter: !q("#rkWeiter").hidden,
    held: q(".rkheld") ? { zahl: txt(q(".rkheld .hzahl")), label: txt(q(".rkheld .hlabel")), teile: qa(".rkheld .hteil b").map(txt) } : null,
    leer: txt(q(".rkleer")),
    seiten: qa(".rkseite").map((s) => ({ id: s.id.replace("rks-", ""), titel: txt(q("h3", s)), zahl: txt(q(".szahl", s)),
      gruppen: qa(".rkgruppe", s).map(txt), meds: qa(".rkmed", s).length, leer: qa(".rkmed.leer", s).length })),
    meds: qa(".rkmed:not(.leer)").map((m) => ({ name: txt(q(".mname", m)), dps: txt(q(".mdps", m)), plus: txt(q(".mplus", m)),
      top: txt(q(".mtop", m)), skill: txt(q(".mskill", m)), erst: txt(q(".merst", m)), bild: !!q("img.bild, span.bild[class*=wkb-]", m) })),
  };
});
const med = (b, name) => b.meds.find((m) => m.name === name);
/* die Zahl, wie das Medaillon sie schreibt (fmt mit kurz ab 1000): "8.1k" statt "8.060" (Pruefung N7) */
const fmtK = (n) => n >= 1e3 ? (n / 1000).toFixed(1) + "k" : String(Math.round(n));
const tagDe = (ms) => { const d = new Date(ms); return zwei(d.getUTCDate()) + "." + zwei(d.getUTCMonth() + 1) + "."; };
const kaempfeIn = (idx) => Object.values(idx || {}).flatMap((e) => e.fights || []);

try {
  // ------------------------------------------------------------ 1. Nachlesen: Fortschritt, Abbruch, Fortsetzen
  {
    /* ein Tor: /api/log fuer die genannte Datei wartet, bis die Probe es oeffnet */
    let tor = null;
    const torZu = (name) => { let auf; const p = new Promise((r) => { auf = r; }); tor = { name, p, auf }; };
    const torAuf = () => { const t = tor; tor = null; t?.auf(); };
    // die zweite Datei (neueste zuerst: 260922, 260921, 260920) haelt, bis die Probe sie loslaesst
    torZu("TLCombatLog-260921.txt");
    const s = await oeffne({ grenze: 1500, halten: (n) => (tor && tor.name === n ? tor.p : null) });
    const p = s.page;
    await rekordeAuf(p);
    const b0 = await blick(p);
    assert(b0.offen && b0.aktuell === "page" && b0.titel === "Rekorde", "der Bereich steht, der Pokal ist gewaehlt", b0);
    assert(await warte(p, () => /Lese 2 von 3 Logs/.test(document.querySelector("#rkSatz").textContent)), "Fortschritt: \"Lese 2 von 3 Logs\"",
      (await blick(p)).satz);
    const b1 = await blick(p);
    assert(b1.abbrechen && !b1.weiter && /bisher/.test(b1.held?.label || ""), "waehrend des Lesens: Abbrechen steht, der Held sagt \"bisher\"", b1);
    const stueckeErste = logAnfragen(s).filter((a) => a.name === "TLCombatLog-260922.txt").map((a) => +a.from);
    assert(stueckeErste.length > 1 && stueckeErste[0] === 0 && stueckeErste.every((f, i) => i === 0 || f > stueckeErste[i - 1]),
      "die erste Datei kam in Stuecken, jedes ab dem Ende des vorigen", stueckeErste);
    // Abbrechen (Tastatur): Fokus auf den Knopf, Enter
    await p.focus("#rkAbbrechen");
    await p.keyboard.press("Enter");
    torAuf();
    assert(await warte(p, () => /angehalten/.test(document.querySelector("#rkSatz").textContent)), "nach Abbrechen: \"Nachlesen angehalten\"",
      (await blick(p)).satz);
    const b2 = await blick(p);
    assert(b2.satz.includes("1 von 3") && b2.weiter && !b2.abbrechen, "angehalten: 1 von 3 gelesen, Weiterlesen steht", b2);
    assert(await p.evaluate(() => document.activeElement?.id) === "rkWeiter", "der Fokus wandert von Abbrechen auf Weiterlesen",
      await p.evaluate(() => document.activeElement?.id));
    const nachAbbruch = s.logIndex ? Object.keys(s.logIndex) : [];
    assert(JSON.stringify(nachAbbruch) === JSON.stringify(["TLCombatLog-260922.txt"]), "ein Abbruch verliert nichts: die gelesene Datei ist gespeichert", nachAbbruch);
    const e3 = s.logIndex?.["TLCombatLog-260922.txt"];
    assert(e3 && e3.nach === true && e3.bytes === statSync(D3).size && e3.fights.length === 1 && e3.fights[0].top === 150000
      && e3.fights[0].topSid === "945725019" && !("topSkill" in e3.fights[0]) && !("b" in e3.fights[0]),
      "der Eintrag: bytes bis zum Ende, nach, der Kampf mit top und topSid (Kennung, kein Name, kein Build)", e3);
    // Fortsetzen: Bereich schliessen und wieder oeffnen - es geht weiter, ohne die erste Datei noch einmal
    const vorher = logAnfragen(s).length;
    await p.click('#bereiche [data-tab="start"]');
    await rekordeAuf(p);
    assert(await ruhig(s) && await warte(p, () => !document.querySelector("#rkLesen").classList.contains("an")), "beim naechsten Oeffnen geht es weiter und endet ruhig");
    const neu = logAnfragen(s).slice(vorher);
    assert(neu.every((a) => a.name !== "TLCombatLog-260922.txt") && neu.some((a) => a.name === "TLCombatLog-260921.txt")
      && neu.some((a) => a.name === "TLCombatLog-260920.txt"), "fortgesetzt: nur die zwei ungelesenen Dateien", neu.map((a) => a.name + ":" + a.from));
    const alle = kaempfeIn(s.logIndex);
    assert(alle.length === 4 && new Set(alle.map((k) => k.at)).size === 4, "nichts doppelt: vier Kaempfe, jeder einmal", alle.map((k) => k.name + "@" + k.at));
    assert(!JSON.stringify(s.logIndex).includes(SPIELER), "kein Spielername im Verlauf");
    const e1 = s.logIndex?.["TLCombatLog-260920.txt"]?.fights?.[0];
    assert(e1 && e1.top === 300000 && e1.topSid === "boro:ventius" && !/Ventius|Sniping/.test(JSON.stringify(s.logIndex)),
      "Ventius ueber ventiusPass: gespeichert die Kennung boro:ventius, kein Faehigkeitsname im Verzeichnis", e1);
    // das Album nach dem Lesen
    const b = await blick(p);
    const mor = med(b, "Morokai"), man = med(b, "Manticus"), ari = med(b, "Aridus");
    const best = Math.max(K1[0].dps, K2[0].dps), vor = Math.min(K1[0].dps, K2[0].dps);
    assert(mor && mor.dps.endsWith(fmtK(best)) && mor.plus.startsWith("+" + Math.round((best / vor - 1) * 100) + NB + "% \u00b7 vorher " + fmtK(vor)),
      "Morokai: bester DPS, +x % und vorher", mor);
    assert(mor && mor.top.endsWith("300.0k") && mor.skill === "Auge von Ventius" && mor.erst === "erster Kampf " + tagDe(T0),
      "Morokai: staerkster Treffer, Faehigkeit ueber die Kennung (DE), erster Kampf", mor);
    assert(man && man.top.endsWith("512.0k") && man.skill === "Auge von Ventius \u00b7 an Akman" && man.plus.startsWith("ein Kampf"),
      "Manticus (Kolosse): der Treffer nennt den Teil, \"ein Kampf\"", man);
    assert(ari?.skill === "Brutaler Pfeil", "Aridus: die Faehigkeit ueber die Kennung in der Sprache der Seite", ari);
    assert(b.held && b.held.zahl === "512.0k" && b.held.teile[1] === "Manticus" && b.held.teile[2] === "21.09.2026" && !/bisher/.test(b.held.label),
      "der Held: hoechster Treffer, Boss, Tag; nach dem Lesen ohne \"bisher\"", b.held);
    const feld = b.seiten.find((x) => x.id === "feld");
    assert(feld && /^3 von \d+ bekämpft$/.test(feld.zahl) && feld.leer === feld.meds - 3 && feld.gruppen.join() === "Erzbosse,Kolosse",
      "Feldbosse: 3 von M bekaempft, die uebrigen als leere Umrisse, Erzbosse und Kolosse", feld);
    assert(b.seiten.map((x) => x.id).join() === "raid,puppe,feld,dungeon" && b.seiten[0].meds === 4 && b.seiten[0].leer === 4,
      "vier Seiten; der Raid mit vier leeren Umrissen", b.seiten.map((x) => x.id + ":" + x.meds + "/" + x.leer));
    assert(!b.meds.some((m) => /ab /.test(m.erst)), "drei Logs im Ordner: kein \"ab\"", b.meds.map((m) => m.erst));
    assert(/^aus 3 Logdateien und 4 K\u00e4mpfen \u00b7 20\.09\.\u201322\.09\.$/.test(b.quelle), "die Quelle im Kopf", b.quelle);
    assert(!s.fehler.length, "keine Seitenfehler", s.fehler);

    // eine gewachsene Datei: nur ab der bekannten Groesse
    const bytes = s.logIndex["TLCombatLog-260922.txt"].bytes;
    const K3b = kampf({ boss: "Aridus", at: T0 + 2 * TAG + 1800000, basis: 9000, top: 160000 });
    appendFileSync(D3, K3b.zeilen.join("\n") + "\n");
    const v2 = logAnfragen(s).length;
    torZu("TLCombatLog-260922.txt");
    await p.click('#bereiche [data-tab="start"]');
    await rekordeAuf(p);
    // die Bewegung beim Oeffnen laeuft aus; dann merkt sich die Probe die Seite der Dungeons, erst danach kommt die Datei
    await warte(p, () => !document.getAnimations().some((x) => x.animationName === "rkauf" && x.playState === "running"));
    await p.evaluate(() => { document.querySelector("#rks-dungeon").dataset.probe = "1"; });
    torAuf();
    assert(await bis(() => kaempfeIn(s.logIndex).length === 5) && await ruhig(s), "die gewachsene Datei bringt ihren neuen Kampf");
    const still = await p.evaluate(() => ({ dungeon: document.querySelector("#rks-dungeon")?.dataset.probe === "1",
      laeuft: document.getAnimations().filter((x) => x.animationName === "rkauf" && x.playState === "running").length,
      feldStill: !!document.querySelector('[data-rk="feld"].still') }));
    assert(still.dungeon && still.feldStill && still.laeuft === 0,
      "nachgelesen wird nur der Block neu gezeichnet, der sich aendert, und er blendet nicht noch einmal ein", still);
    const n2 = logAnfragen(s).slice(v2);
    assert(n2.length >= 1 && n2.every((a) => a.name === "TLCombatLog-260922.txt") && +n2[0].from === bytes,
      "gelesen wird nur das neue Ende, ab den bekannten bytes", { n2, bytes });
    const e3b = s.logIndex["TLCombatLog-260922.txt"];
    assert(e3b.fights.length === 2 && e3b.bytes === statSync(D3).size && e3b.fights[1].top === 160000, "der alte Kampf bleibt, der neue kommt dazu", e3b);
    const b3 = await blick(p);
    assert(med(b3, "Aridus")?.dps.endsWith(fmtK(K3b.dps)) && med(b3, "Aridus")?.plus.includes("vorher " + fmtK(K3[0].dps)), "Aridus hat jetzt einen besseren DPS mit vorher", med(b3, "Aridus"));
    // danach liest es nichts Altes mehr
    const v3 = logAnfragen(s).length;
    await p.click('#bereiche [data-tab="start"]');
    await rekordeAuf(p);
    assert(await bis(() => s.anfragen.filter((a) => a.path === "/api/logs").length >= 4) && await ruhig(s) && logAnfragen(s).length === v3,
      "beim naechsten Oeffnen: nur die Liste, keine Datei", logAnfragen(s).slice(v3));
    // Rekorde neu einlesen (Einstellungen): alle drei ganz, nichts doppelt, nichts geloescht
    const v4 = logAnfragen(s).length;
    await p.click('#bereiche [data-tab="settings"]');
    // mit der Tastatur: Fokus auf den Knopf, Enter; der Fokus bleibt auf ihm, solange gelesen wird
    await p.focus("#eRekorde");
    await p.keyboard.press("Enter");
    assert(await warte(p, () => document.querySelector("#eRekorde").getAttribute("aria-disabled") === "true"
      && document.activeElement?.id === "eRekorde" && /Lese|Suche/.test(document.querySelector("#eRekordeStand").textContent)),
      "neu einlesen per Tastatur: der Knopf sagt belegt, der Fokus bleibt, der Stand steht daneben");
    assert(await bis(() => new Set(logAnfragen(s).slice(v4).filter((a) => a.from === "0").map((a) => a.name)).size === 3) && await ruhig(s),
      "neu einlesen: jede der drei Dateien noch einmal ab 0", logAnfragen(s).slice(v4).map((a) => a.name + ":" + a.from));
    const nachNeu = kaempfeIn(s.logIndex);
    assert(nachNeu.length === 5 && new Set(nachNeu.map((k) => k.at)).size === 5, "neu eingelesen: dieselben fuenf Kaempfe, keiner doppelt", nachNeu.length);
    // Pruefung H2: das Nachlesen aendert nichts Gespeichertes ausser dem Verzeichnis - kein Build, kein bester Pull, kein Ventius
    const posts = s.anfragen.filter((a) => a.m === "POST").map((a) => a.path);
    assert(!posts.includes("/api/builds") && !posts.includes("/api/best") && s.schluessel.every((k) => k === "logIndex")
      && kaempfeIn(s.logIndex).every((k) => !("b" in k)),
      "das Nachlesen schreibt nur das Verzeichnis: kein POST /api/builds oder /api/best, kein ventiusTop, kein Build am Kampf",
      { posts: [...new Set(posts)], schluessel: [...new Set(s.schluessel)] });
    // Pruefung M1: nachgelesene Kaempfe zaehlen nur in den Rekorden - der Verlauf zeigt, was geoeffnet wurde
    const f2 = join(work, "zwei.txt");
    writeFileSync(f2, logText([kampf({ boss: "Morokai", at: T0 + 5 * TAG, basis: 2200, top: 1000, sid: "945725019" }),
      kampf({ boss: "Morokai", at: T0 + 5 * TAG + 3600000, basis: 2300, top: 1100, sid: "945725019" })]));
    await p.setInputFiles("#fileInput", f2);
    await warte(p, () => !document.querySelector("#app").hidden);
    await p.click('#bereiche [data-tab="history"]');
    const zeilen = await bis(() => p.evaluate(() => document.querySelectorAll("#histDetail .histtab tbody tr").length === 2), 6000);
    assert(zeilen, "der Verlauf zeigt die zwei geoeffneten Morokai-Kaempfe, nicht die nachgelesenen",
      await p.evaluate(() => document.querySelectorAll("#histDetail .histtab tbody tr").length));
    await p.click('#bereiche [data-tab="rekorde"]');
    assert(await bis(async () => (await blick(p)).quelle.startsWith("aus 4 Logdateien und 7 ")), "die Rekorde zaehlen beides: nachgelesen und geoeffnet",
      (await blick(p)).quelle);
    await p.close();
  }

  // ------------------------------------------------------------ 1b. eine Datei mit zwei Angreifern (fremd)
  {
    const o2 = join(work, "fremd");
    mkdirSync(o2);
    const zweiter = kampf({ boss: "Aridus", at: T0 + 2 * TAG + 30000, basis: 1000, top: 9000 }).zeilen.map((z) => z.replace("," + SPIELER + ",", ",Probe8,"));
    const zwei = ["CombatLogVersion,4", ...[...K3[0].zeilen, ...zweiter].sort()].join("\n") + "\n";
    writeFileSync(join(o2, "TLCombatLog-260930.txt"), zwei);
    utimesSync(join(o2, "TLCombatLog-260930.txt"), new Date(T0 + 9 * TAG), new Date(T0 + 9 * TAG));
    datei(o2, "TLCombatLog-260929.txt", K1, T0 + 8 * TAG);
    const s = await oeffne({ dir: o2 });
    const p = s.page;
    await rekordeAuf(p);
    assert(await bis(() => Object.keys(s.logIndex || {}).length === 2) && await ruhig(s), "zwei Dateien nachgelesen", Object.keys(s.logIndex || {}));
    const e = s.logIndex?.["TLCombatLog-260930.txt"];
    assert(e && e.fights.length === 0 && e.bytes === statSync(join(o2, "TLCombatLog-260930.txt")).size && !JSON.stringify(s.logIndex).includes("Probe8"),
      "zwei Angreifer ohne Gruppe und Wahl: nicht zu sagen, wer du bist - die Datei bleibt ohne Kaempfe, kein Name", e);
    const v = logAnfragen(s).length;
    await p.click('#bereiche [data-tab="start"]');
    await rekordeAuf(p);
    assert(await bis(() => s.anfragen.filter((a) => a.path === "/api/logs").length >= 2) && await ruhig(s) && logAnfragen(s).length === v,
      "die fremde Datei wird beim naechsten Oeffnen nicht noch einmal gelesen", logAnfragen(s).slice(v));
    await p.close();
  }

  // ------------------------------------------------------------ 1c. Nachlesen, waehrend Live laeuft
  {
    const o3 = join(work, "live");
    mkdirSync(o3);
    datei(o3, "TLCombatLog-261001.txt", K1, T0 + 10 * TAG);
    datei(o3, "TLCombatLog-261002.txt", K3, T0 + 11 * TAG);
    const lf = datei(o3, "TLCombatLog-261003.txt", [kampf({ boss: "Morokai", at: T0 + 12 * TAG, basis: 3000, top: 4000, sid: "945725019" })], T0 + 12 * TAG);
    const s = await oeffne({ dir: o3, live: true });
    const p = s.page;
    await p.click("#btnWatch");
    const zahl = () => p.evaluate(() => document.querySelectorAll("#fightList .fight").length);
    assert(await bis(async () => (await zahl()) === 1, 10000), "Live liest die neueste Datei", await zahl());
    await rekordeAuf(p);
    assert(await bis(() => Object.values(s.logIndex || {}).filter((x) => x.nach).length === 2, 10000) && await ruhig(s),
      "waehrend Live: die zwei aelteren Dateien nachgelesen, die laufende nicht", Object.keys(s.logIndex || {}));
    // der Stand der Seite ist nach dem Nachlesen wieder der laufende: dieselbe Datei, derselbe eine Kampf
    const stand = await p.evaluate(() => ({ n: document.querySelectorAll("#fightList .fight").length, text: document.querySelector("#fightList").textContent,
      datei: document.querySelector("#sbDatei")?.textContent || "" }));
    assert(stand.n === 1 && /Morokai/.test(stand.text) && !/Aridus/.test(stand.text) && /261003/.test(stand.datei),
      "nach dem Nachlesen steht die Seite auf der laufenden Datei, nicht auf einer nachgelesenen", stand);
    appendFileSync(lf, kampf({ boss: "Aridus", at: T0 + 12 * TAG + 600000, basis: 3100, top: 5000, sid: "945725019" }).zeilen.join("\n") + "\n");
    assert(await bis(async () => (await zahl()) === 2, 12000), "danach schneidet Live weiter: der neue Kampf kommt in die Kampfwahl", await zahl());
    const offen = s.logIndex?.["TLCombatLog-261003.txt"];
    assert(offen && !offen.nach && offen.fights.length === 2 && !s.fehler.length, "die laufende Datei steht wie geoeffnet im Verzeichnis, keine Fehler",
      { offen, fehler: s.fehler });
    await p.close();
  }

  // ------------------------------------------------------------ 1d. dreizehn Knoepfe (zwoelf ohne Builds, #207, dazu die Gilde) bei 200 % und 1280 x 860 (Pruefung N6)
  {
    const s = await oeffne({ zoom: 200 });
    const p = s.page;
    await p.click('#bereiche [data-tab="settings"]');
    await p.click('#einstNav button[data-gruppe="dev"]').catch(() => {});
    await p.click("#eDev");
    await warte(p, () => !document.querySelector('#bereiche [data-tab="weapons"]').hidden);
    const z = await p.evaluate(() => {
      const sb = document.querySelector("#statusleiste").getBoundingClientRect();
      const g = document.querySelector('#bereiche [data-tab="settings"]'), r = g.getBoundingClientRect();
      const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { sicht: [...document.querySelectorAll("#bereiche .tab")].filter((b) => !b.hidden).length, unten: r.bottom, sbOben: sb.top, trifft: !!e && g.contains(e) };
    });
    assert(z.sicht === 13 && z.unten <= z.sbOben + 0.5 && z.trifft, "1280 x 860 bei 200 % mit Entwicklermodus: das Zahnrad steht ueber der Statusleiste und ist anklickbar", z);
    await p.close();
  }

  // ------------------------------------------------------------ 2. Verlauf: histRecord schreibt top und topSid
  {
    const s = await oeffne();
    const p = s.page;
    const f = join(work, "eigen.txt");
    writeFileSync(f, logText(K2));
    await p.setInputFiles("#fileInput", f);
    assert(await bis(() => kaempfeIn(s.logIndex).length === 2), "eine geoeffnete Datei steht im Verlauf");
    const k = kaempfeIn(s.logIndex).sort((a, b) => a.at - b.at);
    assert(k[0].top === 280000 && k[0].topSid === "999000001" && k[1].top === 512000 && k[1].topSid === "boro:ventius"
      && k.every((x) => !("topSkill" in x)) && Object.values(s.logIndex).every((e) => !e.nach), "histRecord: top und topSid je Kampf, kein Name; geoeffnet heisst nicht nach", k);
    await p.close();
  }


  // ------------------------------------------------------------ 2b. Ein Log nur mit Uhrzeit (Fix verlauf-ohne-datum)
  /* Traegt das Log nur die Uhrzeit (state.wall false), ist der Beginn eines Kampfs die Zeit seit Mitternacht: ein
     Kampf um 21:00 hiesse im Verlauf 01.01.1970, und zwei Kaempfe um 21:00 an zwei Tagen haetten denselben Schluessel.
     Entscheidung vom 05.10.2026: solche Kaempfe nicht verzeichnen. Ein Eintrag, der schon so im Verzeichnis
     steht, bleibt dort (nie loeschen), Verlauf und Rekorde blenden ihn aus. */
  const nurUhr = (k) => ({ ...k, zeilen: k.zeilen.map((z) => z.replace(/^\d{8}-/, "")) });
  const altUhr = { size: 10, fights: [{ name: "Morokai", dps: 7000, dmg: 1, dur: 30, at: 21 * 3600000, top: 95000, topSid: "999000002" }] };
  const fU = join(work, "nurUhr.txt");
  {
    const KU = [nurUhr(kampf({ boss: "Morokai", at: T0 + 2 * 3600000, basis: 2000, top: 90000 })),
      nurUhr(kampf({ boss: "Morokai", at: T0 + 2.5 * 3600000, basis: 2100, top: 91000 }))];
    assert(/^21:00:00:000,DamageDone,/.test(logText(KU).split("\n")[1]), "die Probe: das Log traegt nur die Uhrzeit");
    const MITTERNACHT = 366 * TAG;
    const index = { "nurUhr.txt": altUhr, "alt.txt": { size: 10, fights: [
      { name: "Morokai", dps: 6000, dmg: 1, dur: 30, at: T0 + 5 * TAG }, { name: "Morokai", dps: 6500, dmg: 1, dur: 30, at: T0 + 6 * TAG }] } };
    const s = await oeffne({ index, liste: [] });
    const p = s.page;
    writeFileSync(fU, logText(KU));
    await p.setInputFiles("#fileInput", fU);
    await warte(p, () => !document.querySelector("#app").hidden);
    // danach ein Log mit Datum: sein Eintrag schickt das ganze Verzeichnis, auch was das Log ohne Datum hinterliess
    const fD = join(work, "mitDatum.txt");
    writeFileSync(fD, logText([kampf({ boss: "Morokai", at: T0 + 7 * TAG, basis: 2400, top: 1200, sid: "945725019" })]));
    await p.setInputFiles("#fileInput", fD);
    assert(await bis(() => !!s.logIndex?.["mitDatum.txt"]), "ein Log mit Datum steht danach im Verzeichnis", Object.keys(s.logIndex || {}));
    assert(JSON.stringify(s.logIndex?.["nurUhr.txt"]) === JSON.stringify(altUhr),
      "ein Log nur mit Uhrzeit verzeichnet keinen Kampf, sein alter Eintrag bleibt unveraendert (nicht geloescht)", s.logIndex?.["nurUhr.txt"]);
    assert(kaempfeIn(s.logIndex).filter((k) => k.at < MITTERNACHT).length === 1, "kein neuer Kampf ohne Datum im Verzeichnis",
      kaempfeIn(s.logIndex).map((k) => k.at));
    await p.click('#bereiche [data-tab="history"]');
    const zeilen = async () => p.evaluate(() => [...document.querySelectorAll("#histDetail .histtab tbody tr")].map((r) => r.textContent.replace(/\s+/g, " ").trim()));
    assert(await bis(async () => (await zeilen()).length === 3), "der Verlauf zeigt die drei Kaempfe mit Datum", await zeilen());
    assert((await zeilen()).every((z) => !/01\.01\./.test(z)), "kein Kampf vom 01.01. im Verlauf", await zeilen());
    await rekordeAuf(p);
    await ruhig(s);
    const b = await blick(p);
    assert(!/01\.01\./.test(b.quelle) && /^aus 2 Logdateien und 3 /.test(b.quelle), "die Rekorde zaehlen den Kampf ohne Datum nicht mit", b.quelle);
    assert(med(b, "Morokai") && !/01\.01\./.test(med(b, "Morokai").erst) && b.held?.zahl !== "95.0k",
      "Morokai: erster Kampf und hoechster Treffer ohne den Kampf ohne Datum", { med: med(b, "Morokai"), held: b.held });
    await p.close();
  }
  {
    // nur Kaempfe ohne Datum (wie im Befund): der Verlauf bleibt leer, statt sie am 01.01. zu zeigen
    const s = await oeffne({ index: { "nurUhr.txt": altUhr }, liste: [] });
    const p = s.page;
    await p.setInputFiles("#fileInput", fU);
    await warte(p, () => !document.querySelector("#app").hidden);
    await p.click('#bereiche [data-tab="history"]');
    const v = await p.evaluate(() => ({ leer: !document.querySelector("#histLeer").hidden,
      zeilen: [...document.querySelectorAll("#histDetail .histtab tbody tr")].map((r) => r.textContent.replace(/\s+/g, " ").trim()) }));
    assert(v.leer && v.zeilen.length === 0, "nur Kaempfe ohne Datum: der Verlauf bleibt leer, kein 01.01.", v);
    await p.close();
  }
  {
    // Nachlesen: eine Datei nur mit Uhrzeit bekommt einen Eintrag ohne Kaempfe (gelesen bis bytes), die mit Datum ihre Kaempfe
    const o3 = join(work, "uhr");
    mkdirSync(o3);
    datei(o3, "TLCombatLog-uhr.txt", [nurUhr(kampf({ boss: "Aridus", at: T0 + 3600000, basis: 1800, top: 400000 }))], T0 + 2 * 3600000);
    datei(o3, "TLCombatLog-260920.txt", K1, T0 + 3 * 3600000);
    const s = await oeffne({ dir: o3 });
    const p = s.page;
    await rekordeAuf(p);
    assert(await bis(() => Object.keys(s.logIndex || {}).length === 2) && await ruhig(s), "beide Dateien nachgelesen", Object.keys(s.logIndex || {}));
    const e = s.logIndex?.["TLCombatLog-uhr.txt"];
    assert(e && e.nach && e.fights.length === 0 && e.bytes > 0, "nachgelesen ohne Datum: ein Eintrag ohne Kaempfe, nicht noch einmal zu lesen", e);
    const b = await blick(p);
    assert(!/01\.01\./.test(b.quelle) && b.held?.zahl !== "400.0k" && !med(b, "Aridus"), "die Rekorde zeigen den Kampf ohne Datum nicht", { quelle: b.quelle, held: b.held });
    await p.close();
  }

  // ------------------------------------------------------------ 3. "ab": aeltere Logs im Ordner, nicht gelesen
  {
    const voll = Array.from({ length: 60 }, (_, i) => ({ name: "f" + zwei(i) + ".txt", size: 10, mtime: 1758000000 - i }));
    const index = Object.fromEntries(voll.map((x) => [x.name, { size: 10, bytes: 10, nach: true, fights: [] }]));
    index["f00.txt"].fights = [{ name: "Morokai", dps: 100000, dmg: 1, dur: 30, at: T0 + 2 * TAG, top: 200000, topSid: "999000009" }];
    index["f01.txt"].fights = [{ name: "Aridus", dps: 90000, dmg: 1, dur: 30, at: T0, top: 210000, topSid: "boro:ventius" },
      { name: "Morokai", dps: 50000, dmg: 1, dur: 30, at: T0 + 3600000 }];
    const s = await oeffne({ index, liste: voll });
    const p = s.page;
    await rekordeAuf(p);
    await ruhig(s);
    const b = await blick(p);
    // folgt der Entscheidung vom 02.10. ("erster Kampf"); der Satz fuer Vorleser steht im Medaillon (Pruefung M5)
    assert(med(b, "Aridus")?.erst === "erster Kampf: ab " + tagDe(T0) + ", ältere Logs nicht gelesen" && med(b, "Morokai")?.erst === "erster Kampf: ab " + tagDe(T0) + ", ältere Logs nicht gelesen",
      "60 Logs im Ordner: die Kills am ersten Tag tragen \"ab\"", b.meds.map((m) => m.name + " " + m.erst));
    assert(logAnfragen(s).length === 0, "alles schon gelesen: keine Datei angefragt", logAnfragen(s));
    assert(med(b, "Morokai")?.plus.startsWith("+100") && med(b, "Morokai")?.top.endsWith("200.0k"), "ein Kampf ohne top zaehlt fuer DPS, der mit top fuer den Treffer", med(b, "Morokai"));
    const title = await p.evaluate(() => [...document.querySelectorAll(".rkmed .merst")].find((e) => /ab/.test(e.textContent))?.title || "");
    assert(/nicht gelesen/.test(title), "\"ab\" erklaert sich im title", title);
    /* der title bleibt mit der Maus erreichbar, auch im Medaillon als Knopf: nichts liegt ueber .merst */
    const maus = await p.evaluate(() => [...document.querySelectorAll(".rkmed .merst[title]")].map((e) => {
      e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect(), x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { knopf: !!e.closest(".rkknopf"), trifft: !!x && (x === e || e.contains(x)) };
    }));
    assert(maus.length >= 2 && maus.every((m) => m.knopf && m.trifft), "der title von \"ab\" ist im Knopf mit der Maus erreichbar", maus);
    await p.close();
  }

  // ------------------------------------------------------------ 4. leer, Datei-Modus, Englisch
  {
    const s = await oeffne({ liste: [] });
    const p = s.page;
    await rekordeAuf(p);
    await ruhig(s);
    const b = await blick(p);
    assert(/Noch keine Rekorde/.test(b.leer) && /\u00dcbungspuppe/.test(b.leer) && b.quelle === "noch keine K\u00e4mpfe" && !b.held,
      "ohne Kaempfe: ein Satz, wie man zu Rekorden kommt", b);
    await p.close();
  }
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const fehler = [], netz = [];
    page.on("pageerror", (e) => fehler.push(String(e)));
    page.on("request", (r) => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:")) netz.push(r.url()); });
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* blockiert */ } });
    await page.goto(DATEI);
    await page.waitForFunction(() => !!document.querySelector('#bereiche [data-tab="rekorde"]'));
    await rekordeAuf(page);
    const b = await blick(page);
    assert(/Im Browser liest Borometer keine \u00e4lteren Logs nach/.test(b.satz) && !b.abbrechen && !b.weiter,
      "Datei-Modus: kein Nachlesen und ein Satz dazu", b.satz);
    await page.click('#bereiche [data-tab="settings"]');
    const e = await page.evaluate(() => ({ aus: document.querySelector("#eRekorde").disabled, satz: !document.querySelector("#eRekordeBrowser").hidden }));
    assert(e.aus && e.satz, "Datei-Modus: \"Rekorde neu einlesen\" ist aus, der Satz sagt warum", e);
    assert(!netz.length && !fehler.length, "Datei-Modus: keine Anfrage, kein Fehler", { netz, fehler });
    // Pruefung N5: ohne Liste des Helfers weiss die Seite nicht, ob aeltere Logs fehlen - "ab" steht vorsichtig
    const f = join(work, "browser.txt");
    writeFileSync(f, logText(K3));
    await page.setInputFiles("#fileInput", f);
    await page.waitForFunction(() => !document.querySelector("#app").hidden);
    await rekordeAuf(page);
    const ab = await page.evaluate(() => [...document.querySelectorAll(".rkmed .merst")].map((x) => x.textContent));
    assert(ab.length === 1 && /^erster Kampf: ab /.test(ab[0]), "Datei-Modus: ohne Liste des Helfers steht vorsichtig \"ab\"", ab);
    await page.close();
  }
  {
    const index = { "a.txt": { size: 1, bytes: 1, nach: true, fights: [{ name: "Akman", dps: 120000, dmg: 1, dur: 30, at: T0, top: 512000, topSid: "boro:ventius" },
      { name: "Practice Dummy", dps: 2171, dmg: 1, dur: 60, at: T0 + 60000, c: 60 },
      // ein Boss mit zwei Kaempfen ueber der Schwelle: hier gibt es einen besten Pull
      { name: "Morokai", dps: 90000, dmg: 1, dur: 120, at: T0 + 120000, top: 100000, topSid: "945725019" },
      { name: "Morokai", dps: 150000, dmg: 1, dur: 120, at: T0 + 180000, top: 110000, topSid: "945725019" }] } };
    const s = await oeffne({ lang: "en", index, liste: [{ name: "a.txt", size: 1, mtime: 1 }] });
    const p = s.page;
    await rekordeAuf(p);
    await ruhig(s);
    const b = await blick(p);
    const en = I18N.en;
    assert(b.titel === "Records" && b.hinweis === en["rk.hinweis"] && b.held?.label === en["rk.held"] && b.held?.teile[0] === "Eye of Ventius \u00b7 on Akman"
      && b.seiten.map((x) => x.titel).join() === "Raid,Practice dummy,Field bosses,Dungeons" && /^1 of 3 fought$/.test(b.seiten[1].zahl)
      && med(b, "Practice dummy \u00b7 60" + NB + "s")?.plus.startsWith("one fight") && b.meds.find((x) => /^Practice dummy/.test(x.name))?.dps === en["rk.keinBester"] && !/\d/.test(b.meds.find((x) => /^Practice dummy/.test(x.name))?.dps || "") && /^from 1 log file and 4 fights/.test(b.quelle)
      && /^best DPS 150\.0k$/.test(b.meds.find((x) => x.name === "Morokai")?.dps || "") && b.meds.find((x) => x.name === "Morokai")?.plus.startsWith("+67"),
      "Englisch: Titel, Held, Seiten, Zaehlung, Puppe mit Laengenklasse", b);
    // die Sprache wechseln: der Bereich folgt
    await p.evaluate(() => document.querySelector('button[data-lang="de"]')?.click());
    const de = await warte(p, () => document.querySelector("#rkTitel").textContent === "Rekorde" && /bekämpft/.test(document.querySelector(".szahl").textContent));
    assert(de, "die Sprache wechseln: Rekorde, bekaempft", (await blick(p)).titel);
    await p.close();
  }

  // ------------------------------------------------------------ 5. Groessen, Themen, Tastatur
  const index = { "a.txt": { size: 1, bytes: 1, nach: true, fights: [
    ...["Morokai", "Akman", "Aridus", "Talus", "Grauauge", "Dragaryle", "Calanthia", "Zairos \u00b7 Vulkan", "Deluzhnoa", "Vegarus"].map((n, i) =>
      ({ name: n, dps: 100000 + i * 9000, dmg: 1, dur: 60, at: T0 + i * 600000, top: 300000 + i * 1000, topSid: i % 2 ? "boro:ventius" : "945725019" })),
    { name: "Radeth", dps: 16800, dmg: 1, dur: 60, at: T0 + 7200000, top: 29300, topSid: "999000004" },
    { name: "Practice Dummy", dps: 224000, dmg: 1, dur: 60, at: T0, c: 60, top: 506000, topSid: "boro:ventius" },
    // Morokai zum zweiten Mal: dieser Platz hat einen besten Pull (Zahl), die uebrigen nicht
    { name: "Morokai", dps: 95000, dmg: 1, dur: 60, at: T0 + 10800000, top: 300500, topSid: "945725019" }] } };
  for (const [breite, hoehe] of [[2000, 1480], [1280, 860], [560, 900]]) {
    const s = await oeffne({ breite, hoehe, index, liste: [{ name: "a.txt", size: 1, mtime: 1 }] });
    const p = s.page;
    await rekordeAuf(p);
    await ruhig(s);
    await warte(p, () => [...document.querySelectorAll(".rkmed")].every((m) => getComputedStyle(m).opacity === "1"));
    const m = await p.evaluate(() => {
      const klein = [];
      for (const el of document.querySelectorAll("#rekorde *")) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        if (!el.getClientRects().length || el.closest(".vh,[hidden]")) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 11) klein.push((el.className || el.tagName) + ":" + fs);
      }
      const meds = [...document.querySelectorAll(".rkmed")].map((e) => e.getBoundingClientRect());
      const zeile = (y) => meds.filter((r) => Math.abs(r.top - y) < 2).length;
      const raid = [...document.querySelectorAll("#rks-raid .rkmed")].map((e) => e.getBoundingClientRect());
      return { quer: document.documentElement.scrollWidth > innerWidth || document.querySelector(".rkrollt").scrollWidth > document.querySelector(".rkrollt").clientWidth,
        klein, inhalt: document.querySelector(".rkinhalt").getBoundingClientRect().width,
        spaltenRaid: new Set(raid.map((r) => Math.round(r.left))).size, medBreite: Math.max(...meds.map((r) => r.width)),
        hoch: Math.max(...meds.filter((r, i) => document.querySelectorAll(".rkmed")[i].classList.contains("leer")).map((r) => r.height)),
        zeile1: zeile(meds[0].top) };
    });
    assert(!m.quer, `${breite} x ${hoehe}: kein waagerechtes Rollen`, m);
    assert(!m.klein.length, `${breite} x ${hoehe}: kein Text unter 11 Punkt`, m.klein);
    if (breite === 2000) assert(m.inhalt <= 1680 && m.medBreite <= 172 && m.spaltenRaid === 4, "2000 x 1480: Inhalt hoechstens 1680, Medaillons hoechstens 172, Raid in einer Reihe", m);
    if (breite === 1280) assert(m.medBreite <= 172 && m.spaltenRaid === 4, "1280 x 860: Raid in einer Reihe, nichts gestreckt", m);
    if (breite === 560) assert(m.spaltenRaid === 2 && m.hoch <= 44, "560: zwei Spalten, leere Umrisse als flache Zeile (hoechstens 44)", m);
    // Pruefung M5: der Satz zum ersten Kampf steht in jeder Breite; Radeth traegt sein Foto (02.10.2026), keine Platte, keine Maske
    const kopf = await p.evaluate((bilder) => { const h = document.querySelector(".rkhinweis"), r = h.getBoundingClientRect();
      const rad = [...document.querySelectorAll("#rks-raid .rkmed")].find((x) => /Radeth/.test(x.textContent));
      const foto = rad?.querySelector(bilder ? "span.bild.wkb-radeth" : ".bild.init"), fr = foto?.getBoundingClientRect();
      return { sicht: r.width > 0 && r.height > 0 && getComputedStyle(h).display !== "none", text: h.textContent,
        radeth: rad ? { img: !!rad.querySelector("img.bild"), init: !!rad.querySelector(".bild.init"),
          foto: foto ? getComputedStyle(foto).backgroundImage.slice(0, 40) : "", rund: foto ? parseFloat(getComputedStyle(foto).borderRadius) > 0 : false,
          gross: fr ? fr.width > 0 && Math.abs(fr.width - fr.height) < 1 : false,
          wkb: !!rad.querySelector('[class*="wkb-"]') } : null }; }, BILDER);
    assert(BILDER ? kopf.sicht && /^Erster Kampf hei/.test(kopf.text) && kopf.radeth && !kopf.radeth.img && !kopf.radeth.init
      && /^url\("data:image\/webp;base64,UklG/.test(kopf.radeth.foto) && kopf.radeth.rund && kopf.radeth.gross
      : kopf.sicht && /^Erster Kampf hei/.test(kopf.text) && kopf.radeth && !kopf.radeth.img && kopf.radeth.init && !kopf.radeth.wkb
      && kopf.radeth.foto === "none" && kopf.radeth.rund && kopf.radeth.gross,
      `${breite} x ${hoehe}: der Satz zum ersten Kampf steht; Radeth mit rundem Foto statt Platte oder Maske` + (BILDER ? "" : " (ohne Spielbilder: runde, quadratische Platte, keine Maske)"), kopf);    assert(!s.fehler.length, `${breite} x ${hoehe}: keine Seitenfehler`, s.fehler);
    await p.close();
  }
  for (const thema of ["dark", "light", "tnl"]) {
    const s = await oeffne({ thema, index, liste: [{ name: "a.txt", size: 1, mtime: 1 }] });
    const p = s.page;
    await rekordeAuf(p);
    await ruhig(s);
    const f = await p.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const farbe = (v) => { const d = document.createElement("i"); d.style.color = `var(${v})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; };
      const gold = farbe("--gold-ink"), pos = farbe("--pos"), neg = farbe("--neg");
      // was man sieht: Text in den Saetzen fuer den Vorleser (.vh) zaehlt nicht
      const alle = [...document.querySelectorAll("#rekorde *")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        && e.getClientRects().length && !e.closest(".vh"));
      const eigen = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
      const goldTexte = alle.filter((e) => getComputedStyle(e).color === gold).map(eigen).filter(Boolean);
      const urteil = alle.filter((e) => [pos, neg].includes(getComputedStyle(e).color)).map((e) => e.textContent.trim());
      return { thema: document.documentElement.dataset.theme, goldTexte, urteil, zahl: !!document.querySelector(".rkmed .mdps:not(.offen)") && getComputedStyle(document.querySelector(".rkmed .mdps:not(.offen)")).color === gold,
        offenNichtGold: !!document.querySelector(".rkmed .mdps.offen") && [...document.querySelectorAll(".rkmed .mdps.offen")].every((e) => getComputedStyle(e).color !== gold),
        name: getComputedStyle(document.querySelector(".rkmed .mname")).color !== gold, css: !!css.getPropertyValue("--gold-ink") };
    });
    assert(f.thema === thema && f.zahl && f.offenNichtGold && f.name && f.goldTexte.length && f.goldTexte.every((x) => /^[+\d.,kMB\s]+$/.test(x.replace(/[\u00a0]/g, " "))) && !f.urteil.length,
      `Thema ${thema}: Gold nur auf Zahlen, kein Rot und kein Gruen`, f);
    await p.close();
  }
  {
    const s = await oeffne({ index, liste: [{ name: "a.txt", size: 1, mtime: 1 }] });
    const p = s.page;
    // Tastatur: in die Leiste, mit den Pfeilen zum Pokal, Enter
    await p.focus('#bereiche .tab[tabindex="0"]');
    let gefunden = false;
    for (let i = 0; i < 16 && !gefunden; i++) {
      gefunden = await p.evaluate(() => document.activeElement?.dataset?.tab === "rekorde");
      if (!gefunden) await p.keyboard.press("ArrowDown");
    }
    await p.keyboard.press("Enter");
    const auf = await warte(p, () => !document.querySelector("#rekorde").hidden);
    assert(gefunden && auf, "Tastatur: mit den Pfeilen zum Pokal, Enter oeffnet die Rekorde");
    const name = await p.evaluate(() => document.querySelector('#bereiche [data-tab="rekorde"] .vh').textContent);
    assert(name === "Rekorde", "der Knopf traegt seinen Namen fuer den Vorleser", name);
    await ruhig(s);
    // Tab erreicht die rollende Flaeche, die Pfeile rollen sie
    let rollt = false;
    for (let i = 0; i < 40 && !rollt; i++) {
      await p.keyboard.press("Tab");
      rollt = await p.evaluate(() => document.activeElement?.classList.contains("rkrollt"));
    }
    const vor = await p.evaluate(() => document.querySelector(".rkrollt").scrollTop);
    await p.keyboard.press("PageDown");
    const gerollt = await bis(() => p.evaluate((v) => document.querySelector(".rkrollt").scrollTop > v, vor));
    assert(rollt && gerollt, "Tab erreicht die Albumseiten, Bild runter rollt sie", { rollt, gerollt });
    const a11y = await p.evaluate((bilder) => ({
      region: document.querySelector(".rkrollt").getAttribute("role") === "region" && !!document.querySelector(".rkrollt").getAttribute("aria-labelledby"),
      listen: [...document.querySelectorAll(".rkraster")].every((u) => u.getAttribute("role") === "list"),
      seiten: [...document.querySelectorAll(".rkseite")].every((x) => document.getElementById(x.getAttribute("aria-labelledby"))),
      leerVh: [...document.querySelectorAll(".rkmed.leer")].every((m) => /noch nicht bekämpft/.test(m.textContent)),
      dpsVh: [...document.querySelectorAll(".rkmed:not(.leer) .mdps .vh")].every((v) => /bester DPS/.test(v.textContent)),
      status: document.querySelector("#rkSatz").getAttribute("role") === "status",
      bilder: [...document.querySelectorAll("#rekorde img")].every((i) => i.getAttribute("alt") === "" && i.getAttribute("aria-hidden") === "true"),
      raidBild: bilder ? ["zitadelle", "korridor", "altar", "radeth"].every((k) => !!document.querySelector("#rks-raid .wkb-" + k))
        : (() => { const m = [...document.querySelectorAll("#rks-raid .rkmed")];
          return m.length >= 4 && m.every((x) => !!x.querySelector(".bild.init") && !x.querySelector('[class*="wkb-"]')); })(),
    }), BILDER);
    assert(Object.values(a11y).every(Boolean), "Vorleser: Region, Listen, benannte Seiten, Saetze fuer leere Umrisse und Zahlen, Live-Region; Raid-Bilder aus den Weeklies"
      + (BILDER ? "" : " (ohne Spielbilder: jedes Raid-Medaillon mit Platte, keine wkb-Klasse)"), a11y);
    await p.close();
  }

  // ------------------------------------------------------------ 6. Bester Pull 5.3: dieselbe Menge, Medaillon als Knopf
  {
    /* (d) ein Pull, der nur in boro-best.json steht (der Verlauf kennt sein at nicht), zaehlt mit:
       er ist der beste am Boss, das Medaillon zeigt seine Zahl */
    const lauf = (name, dps, seconds) => ({ id: "run1", name, tag: "", note: "", when: T0 + 2 * TAG, noTime: false, seconds, total: dps * seconds, dps,
      hits: 10, critRate: 0, critDmgShare: 0, heavyRate: 0, avg: 1, max: 1, dead: 0, worstGap: 0, skills: [], windows: [], perSecond: [] });
    const best = { "boss:Morokai": { best: { run: lauf("Morokai", 250000, 60), at: T0 + 2 * TAG, file: "TLCombatLog-alt.txt", ver: "test" } } };
    const index = { "a.txt": { size: 1, bytes: 1, nach: true, fights: [
      { name: "Morokai", dps: 100000, dmg: 1, dur: 60, at: T0, top: 300000, topSid: "945725019" },
      { name: "Morokai", dps: 120000, dmg: 1, dur: 60, at: T0 + 3600000, top: 310000, topSid: "945725019" },
      { name: "Aridus", dps: 90000, dmg: 1, dur: 60, at: T0 + 7200000, top: 200000, topSid: "945725019" }] } };
    const s = await oeffne({ index, best, liste: [{ name: "a.txt", size: 1, mtime: 1 }] });
    const p = s.page;
    await rekordeAuf(p);
    await ruhig(s);
    const b = await blick(p);
    assert(med(b, "Morokai")?.dps.endsWith("250.0k") && med(b, "Morokai")?.plus.includes("vorher 120.0k"),
      "(d) ein Pull nur aus boro-best.json zaehlt in den Rekorden: er ist der beste, vorher der beste aus dem Verlauf", med(b, "Morokai"));
    /* (b) jedes Medaillon mit Kampf ist ein Knopf im Listenpunkt. Sein Name kommt aus dem sichtbaren Text
       (aria-labelledby: Boss und Wert) und der Handlung (rk.oeffnen); der Rest des Medaillons bleibt
       als Beschreibung (aria-describedby) fuer den Vorleser - kein aria-label, das ihn verdeckte */
    const k = await p.evaluate(() => {
      const mor = [...document.querySelectorAll(".rkmed:not(.leer)")].find((m) => m.querySelector(".mname")?.textContent === "Morokai");
      const knopf = mor?.querySelector(":scope > button.rkknopf");
      const texte = (attr) => (knopf?.getAttribute(attr) || "").split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)).map((e) => (e && knopf.contains(e) ? e.textContent.replace(/\s+/g, " ").trim() : "FEHLT"));
      const ids = [...document.querySelectorAll("#rekorde [id]")].map((e) => e.id);
      // die ganze Flaeche nimmt den Klick, auch der Rand im Innenabstand des Listenpunkts
      mor?.scrollIntoView({ block: "center" });
      const r = mor?.getBoundingClientRect(), ecke = r ? document.elementFromPoint(r.left + 4, r.top + 4) : null;
      return { knopf: !!knopf, typ: knopf?.getAttribute("type") || "", ohneLabel: !knopf?.hasAttribute("aria-label"),
        name: texte("aria-labelledby"), beschreibung: texte("aria-describedby"), eindeutig: ids.length === new Set(ids).size,
        rand: !!ecke && ecke === knopf, liInLi: mor?.tagName === "LI" && mor.parentElement?.getAttribute("role") === "list",
        alle: [...document.querySelectorAll(".rkmed:not(.leer)")].every((m) => !!m.querySelector(":scope > button.rkknopf")),
        leerOhne: [...document.querySelectorAll(".rkmed.leer")].every((m) => !m.querySelector("button")) && document.querySelectorAll(".rkmed.leer").length > 0 };
    });
    const de = I18N.de;
    assert(k.knopf && k.typ === "button" && k.ohneLabel && k.rand && k.liInLi && k.alle && k.leerOhne && k.eindeutig
      && JSON.stringify(k.name) === JSON.stringify(["Morokai", de["rk.dpsVh"].trim() + " 250.0k", de["rk.oeffnen"]])
      && k.beschreibung.some((x) => x.includes("vorher 120.0k")) && k.beschreibung.some((x) => /^stärkster Treffer 310\.0k/.test(x))
      && k.beschreibung.some((x) => /^erster Kampf/.test(x)) && !k.beschreibung.includes("FEHLT"),
      "(b) Medaillon mit Kampf: button im Listenpunkt, Name aus Boss, Wert und rk.oeffnen, der Rest als Beschreibung; leere Umrisse ohne Knopf", { k });
    // WCAG 2.5.3, wie der Browser rechnet: der Name beginnt mit dem sichtbaren Namen
    const rolle = await p.getByRole("button", { name: "Morokai bester DPS 250.0k " + de["rk.oeffnen"], exact: true }).count();
    assert(rolle === 1, "(b) der berechnete Name des Knopfs: \"Morokai bester DPS 250.0k Öffnet den Kampf.\"", rolle);
    // per Tab erreichbar: von der rollenden Flaeche aus der naechste Halt ist ein Medaillon
    await p.focus(".rkrollt");
    await p.keyboard.press("Tab");
    const fokus = await p.evaluate(() => ({ knopf: document.activeElement?.classList.contains("rkknopf"),
      ring: document.activeElement ? getComputedStyle(document.activeElement, "::before").outlineStyle + "|" + getComputedStyle(document.activeElement).outlineStyle : "" }));
    assert(fokus.knopf && /solid/.test(fokus.ring), "(b) Tab erreicht das Medaillon, der Fokusring steht", fokus);
    assert(!s.fehler.length, "6: keine Seitenfehler", s.fehler);
    await p.close();
  }
  {
    /* Mit dem Helfer: der Klick oeffnet das Log des besten Pulls aus dem Log-Ordner und waehlt diesen Kampf */
    const s = await oeffne({});
    const p = s.page;
    await rekordeAuf(p);
    assert(await bis(() => Object.keys(s.logIndex || {}).length === 3) && await ruhig(s), "6: drei Dateien nachgelesen", Object.keys(s.logIndex || {}));
    const bester = K1[0].dps > K2[0].dps ? { datei: "260920", at: K1[0].at } : { datei: "260921", at: K2[0].at };
    await p.evaluate(() => [...document.querySelectorAll(".rkmed:not(.leer)")].find((m) => m.querySelector(".mname")?.textContent === "Morokai")
      ?.querySelector(".rkknopf")?.click());
    const da = await warte(p, (d) => document.querySelector("#rekorde").hidden && !document.querySelector("#app").hidden
      && (document.querySelector("#sbDatei")?.textContent || "").includes(d), bester.datei);
    // folgt #152: die Zeile unter "Ort · Boss" heisst "Pull N"; der Boss steht im aria-label vorn
    const gewaehlt = await p.evaluate(() => document.querySelector("#fightList .fight.on")?.getAttribute("aria-label") || "");
    assert(da && /^Morokai, /.test(gewaehlt) && await p.evaluate(() => document.activeElement?.id) === "kwKnopf",
      "mit dem Helfer: der Klick oeffnet das Log des besten Pulls, waehlt diesen Kampf, der Fokus steht auf der Kampfwahl",
      { da, gewaehlt, datei: await p.evaluate(() => document.querySelector("#sbDatei")?.textContent), fokus: await p.evaluate(() => document.activeElement?.id) });
    assert(!s.fehler.length, "6: keine Seitenfehler beim Oeffnen", s.fehler);
    await p.close();
  }
  {
    /* (a) und (c) im Browser ohne App. (a) nach der Regel, nicht nach dem hoechsten DPS: ein kurzer Wipe
       (20 s) mit dem hoechsten DPS am Boss, dann zwei lange Pulls (120 s), der staerkere zuerst. Die
       Schwelle ist min(60, 60) s: der Wipe zaehlt nicht, der beste ist der erste lange Pull - Medaillon
       und Tafel nennen ihn. Gewaehlt ist der neueste Kampf, die Tafel vergleicht also gegen den besten. */
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const fehler = [];
    page.on("pageerror", (e) => fehler.push(String(e)));
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* blockiert */ } });
    await page.goto(DATEI);
    await page.waitForFunction(() => !!document.querySelector('#bereiche [data-tab="rekorde"]'));
    const f = join(work, "zwei-pulls.txt");
    const wipe = kampf({ boss: "Morokai", at: T0, dur: 20, basis: 60000, top: 95000, sid: "945725019" });
    const lang = kampf({ boss: "Morokai", at: T0 + 3600000, dur: 120, basis: 41000, top: 90000, sid: "945725019" });
    writeFileSync(f, logText([wipe, lang, kampf({ boss: "Morokai", at: T0 + 7200000, dur: 120, basis: 33000, top: 80000, sid: "945725019" })]));
    await page.setInputFiles("#fileInput", f);
    await page.waitForFunction(() => !document.querySelector("#app").hidden);
    await page.evaluate(() => document.querySelector('[data-tab="timeline"]').click());
    await page.waitForFunction(() => { const b = document.querySelector("#btnBestPull"); return !!b && !b.hidden && !!b.title; });
    const titel = await page.evaluate(() => document.querySelector("#btnBestPull").title);
    const ref = /^Öffnet den Vergleich mit diesem Kampf und deinem besten an Morokai \(([^,]+),/.exec(titel)?.[1] || "";
    await rekordeAuf(page);
    const b = await blick(page);
    assert(ref && ref === fmtK(lang.dps) && ref !== fmtK(wipe.dps) && med(b, "Morokai")?.dps === "bester DPS " + ref,
      "(a) Wipe mit hoechstem DPS und langer Pull: Medaillon und \"Gegen deinen besten Pull\" nennen beide den langen Pull",
      { titel, ref, lang: fmtK(lang.dps), wipe: fmtK(wipe.dps), med: med(b, "Morokai") });
    // der Knopf fuehrt ohne Server in den Verlauf - sein Name sagt das (rk.verlauf)
    const nameV = await page.getByRole("button", { name: "Morokai bester DPS " + ref + " " + I18N.de["rk.verlauf"], exact: true }).count();
    assert(nameV === 1, "(c) ohne Server nennt der Knopf den Verlauf als Handlung (rk.verlauf)", nameV);
    // (c) ohne Server: der Klick fuehrt in den Verlauf dieses Bosses
    await page.focus(".rkrollt");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    const verlauf = await warte(page, () => document.querySelector("#rekorde").hidden && !document.querySelector("#p-history")?.hidden
      && document.querySelector("#p-history")?.classList.contains("on") && document.querySelector("#histBoss")?.value === "Morokai");
    assert(verlauf && await page.evaluate(() => document.activeElement?.id) === "histBoss",
      "(c) ohne Server: Enter auf dem Medaillon fuehrt in den Verlauf, #histBoss hat den Boss gewaehlt und den Fokus",
      await page.evaluate(() => ({ rk: document.querySelector("#rekorde").hidden, tab: document.querySelector(".panel.on")?.id, boss: document.querySelector("#histBoss")?.value,
        fokus: document.activeElement?.id })));
    assert(!fehler.length, "6: keine Seitenfehler im Browser", fehler);
    await page.close();
  }
  {
    /* (b) mit dem Helfer: der beste Pull steht nur in boro-best.json (gestellter /api/best), das geoeffnete Log
       hat zwei schwaechere Pulls am Boss. Medaillon und Tafel nennen denselben Wert, den des gespeicherten.
       Dann der Ausweg (5): seine Datei steht in der Liste des Ordners, laesst sich aber nicht holen (404) -
       der Klick fuehrt in den Verlauf des Bosses. */
    const lauf = (name, dps, seconds) => ({ id: "run1", name, tag: "", note: "", when: T0 - TAG, noTime: false, seconds, total: dps * seconds, dps,
      hits: 10, critRate: 0, critDmgShare: 0, heavyRate: 0, avg: 1, max: 1, dead: 0, worstGap: 0, skills: [], windows: [], perSecond: [] });
    const best = { "boss:Morokai": { best: { run: lauf("Morokai", 87654, 90), at: T0 - TAG, file: "TLCombatLog-weg.txt", ver: "test" } } };
    const s = await oeffne({ best, liste: [{ name: "TLCombatLog-weg.txt", size: 10, mtime: 1758000000 }] });
    const p = s.page;
    const f = join(work, "zwei-schwaechere.txt");
    writeFileSync(f, logText([kampf({ boss: "Morokai", at: T0, dur: 60, basis: 31000, top: 90000, sid: "945725019" }),
      kampf({ boss: "Morokai", at: T0 + 3600000, dur: 60, basis: 29000, top: 80000, sid: "945725019" })]));
    await p.setInputFiles("#fileInput", f);
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    await p.evaluate(() => document.querySelector('[data-tab="timeline"]').click());
    await p.waitForFunction(() => { const b = document.querySelector("#btnBestPull"); return !!b && !b.hidden && !!b.title; });
    const titel = await p.evaluate(() => document.querySelector("#btnBestPull").title);
    const ref = /^Öffnet den Vergleich mit diesem Kampf und deinem besten an Morokai \(([^,]+),/.exec(titel)?.[1] || "";
    await rekordeAuf(p);
    await ruhig(s);
    const b = await blick(p);
    assert(ref === "87.7k" && med(b, "Morokai")?.dps === "bester DPS " + ref,
      "(b) ein Pull nur aus boro-best.json: Medaillon und \"Gegen deinen besten Pull\" nennen denselben Wert", { titel, ref, med: med(b, "Morokai") });
    const vorKlick = s.anfragen.length;
    await p.evaluate(() => [...document.querySelectorAll(".rkmed:not(.leer)")].find((m) => m.querySelector(".mname")?.textContent === "Morokai")
      ?.querySelector(".rkknopf")?.click());
    const verlauf = await warte(p, () => document.querySelector("#rekorde").hidden && document.querySelector("#p-history")?.classList.contains("on")
      && document.querySelector("#histBoss")?.value === "Morokai");
    const versucht = s.anfragen.slice(vorKlick).some((a) => a.path === "/api/log" && a.name === "TLCombatLog-weg.txt");
    assert(verlauf && versucht && await p.evaluate(() => document.activeElement?.id) === "histBoss",
      "(5) die Datei laesst sich nicht oeffnen: der Klick fuehrt in den Verlauf des Bosses, der Fokus auf seine Wahl",
      { verlauf, versucht, fokus: await p.evaluate(() => document.activeElement?.id), tab: await p.evaluate(() => document.querySelector(".panel.on")?.id) });
    assert(!s.fehler.length, "6: keine Seitenfehler beim Ausweg", s.fehler);
    await p.close();
  }

  // ------------------------------------------------------------ 7. die Summe einer Gruppe ist nicht dein bester Pull
  {
    /* Entscheidung 06.10.: ein Log mit zwei Angreifern, geoeffnet mit "alle" (state.player "__all"), schreibt
       die Summe der Gruppe ins Verzeichnis. Der Eintrag traegt die Markierung g: 1 und zaehlt weder fuer
       "Gegen deinen besten Pull" noch fuer das Medaillon. Dazu ein eigenes Log mit zwei Pulls am selben Boss:
       Tafel und Medaillon nennen den besseren davon, nicht die Summe. Der Eintrag bleibt im Verzeichnis. */
    const s = await oeffne({ liste: [] });
    const p = s.page;
    const g1 = kampf({ boss: "Morokai", at: T0 - TAG, dur: 60, basis: 45000, top: 90000, sid: "945725019" });
    const g2 = kampf({ boss: "Morokai", at: T0 - TAG, dur: 60, basis: 44000, top: 90000, sid: "945725019" }).zeilen
      .map((z) => z.replace("," + SPIELER + ",", ",Probe8,"));
    const fg = join(work, "gruppe-alle.txt");
    writeFileSync(fg, ["CombatLogVersion,4", ...[...g1.zeilen, ...g2].sort()].join("\n") + "\n");
    await p.setInputFiles("#fileInput", fg);
    await p.waitForFunction(() => !document.querySelector("#app").hidden && /Morokai/.test(document.querySelector("#hName")?.textContent || ""));
    assert(await bis(() => kaempfeIn(s.logIndex).length === 1), "7: die Summe der Gruppe steht im Verzeichnis", s.logIndex);
    const eigen1 = kampf({ boss: "Morokai", at: T0, dur: 60, basis: 31000, top: 90000, sid: "945725019" });
    const eigen2 = kampf({ boss: "Morokai", at: T0 + 3600000, dur: 60, basis: 29000, top: 80000, sid: "945725019" });
    const fe = join(work, "eigen-zwei.txt");
    writeFileSync(fe, logText([eigen1, eigen2]));
    await p.setInputFiles("#fileInput", fe);
    assert(await bis(() => kaempfeIn(s.logIndex).length === 3), "7: dazu die zwei eigenen Pulls", s.logIndex);
    const gEintrag = s.logIndex?.["gruppe-alle.txt"]?.fights || [], eEintrag = s.logIndex?.["eigen-zwei.txt"]?.fights || [];
    assert(gEintrag.length === 1 && gEintrag[0].g === 1 && gEintrag[0].dps > 2 * eigen1.dps && eEintrag.length === 2 && eEintrag.every((f) => !("g" in f))
      && !JSON.stringify(s.logIndex).includes("Probe8"),
      "7: der Eintrag der Gruppe traegt g: 1 (eine Zahl, kein Name), die eigenen nicht; er bleibt im Verzeichnis", s.logIndex);
    await p.evaluate(() => document.querySelector('[data-tab="timeline"]').click());
    await p.waitForFunction(() => { const b = document.querySelector("#btnBestPull"); return !!b && !b.hidden && !!b.title; }, null, { timeout: 8000 }).catch(() => {});
    const titel = await p.evaluate(() => document.querySelector("#btnBestPull")?.title || "");
    const ref = /^Öffnet den Vergleich mit diesem Kampf und deinem besten an Morokai \(([^,]+),/.exec(titel)?.[1] || "";
    await rekordeAuf(p);
    await ruhig(s);
    const b = await blick(p);
    assert(ref === fmtK(eigen1.dps) && med(b, "Morokai")?.dps === "bester DPS " + fmtK(eigen1.dps),
      "7: Tafel und Medaillon nennen den eigenen besten Pull, nicht die Summe der Gruppe",
      { titel, ref, eigen: fmtK(eigen1.dps), gruppe: fmtK(gEintrag[0]?.dps || 0), med: med(b, "Morokai") });
    assert(!s.fehler.length, "7: keine Seitenfehler", s.fehler);
    await p.close();
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exitCode = failed ? 1 : 0;
