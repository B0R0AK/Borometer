// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Fruehere Tage in der Kampfwahl (Spezifikation
// docs/superpowers/specs/2026-09-30-nachtraege-design.md, Abschnitt N3; Plan
// docs/superpowers/plans/2026-09-30-nachtraege.md, N3).
//
// Teil 1, ohne Seite und ohne Electron: die Namenspruefung in
// src/main/logs.ts - listLogs() (die Logdateien des Ordners, neueste zuerst,
// hoechstens 60) und logAnswer() (ein Stueck einer Datei, deren Name nur mit
// der Auflistung verglichen wird) auf echten Dateien in einem Temp-Ordner.
//
// Teil 2, an der gebauten Seite, vom gestellten Helfer ausgeliefert
// (page.route): /api/state, /api/latest, /api/logs und /api/log antworten
// aus den echten Funktionen von logs.ts auf demselben Ordner. Blaettern zum
// vorigen und naechsten Tag, einen Tag laden (auch in Stuecken), Live
// pausiert und kehrt mit "Heute" zurueck, "Zuletzt geoeffnet" oeffnet die
// Datei, Deutsch und Englisch, Tastatur, 560 Punkt, im Browser ohne App
// keine Knoepfe. Nacharbeit aus der Pruefung (N3): Links im Ordner sind keine Logs (G2), Tag und
// Pfeile stehen zusammen links (G3), die Pause traegt den laufenden Kampf nicht als besten Pull ein (G4),
// Zeitschnitt und geloeste Kaempfe ueberstehen die Pause (W3). Bilder bei 1280 und 560, dunkel, hell und
// tnl, nach BILDER (wenn gesetzt).
//
// Testdaten: scripts/fixtures/live-auszug.txt, das Datum je Tag umgeschrieben.
//
// Run:  npm run test:tage-page     (baut die Seite zuerst)
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import * as esbuild from "esbuild";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 700))); }
}
const built = await esbuild.build({ entryPoints: [join(root, "src/main/logs.ts")], bundle: true, format: "esm",
  platform: "node", write: false, logLevel: "silent" });
const logs = await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64"));
const BILDER = process.env.BILDER || "";

const AUSZUG = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
const ZEILEN = AUSZUG.split("\n").filter(Boolean);
const KOPF = ZEILEN[0], REST = ZEILEN.slice(1);
/* der Auszug an einem anderen Tag: 20260925 wird tag */
const amTag = (tag, von = 0, bis = 1) => [KOPF, ...REST.slice(Math.floor(REST.length * von), Math.floor(REST.length * bis))]
  .map((z) => z.replace(/^20260925-/, tag + "-")).join("\n") + "\n";
/* eine Zeit in Berlin (Sommerzeit, UTC+2) als Sekunden fuer utimes */
const berlin = (tag, h, m = 0) => new Date(Date.UTC(2026, 8, tag, h - 2, m));
function datei(ordner, name, text, wann) {
  const p = join(ordner, name);
  writeFileSync(p, text);
  utimesSync(p, wann, wann);
  return p;
}
const work = mkdtempSync(join(tmpdir(), "boro-tage-"));

try {
  // ------------------------------------------------------------ Teil 1: logs.ts
  {
    const ordner = join(work, "eins");
    mkdirSync(ordner);
    datei(ordner, "alt.txt", amTag("20260924"), berlin(24, 22));
    datei(ordner, "Mitte Log.log", amTag("20260925"), berlin(25, 22));
    datei(ordner, "neu.txt", amTag("20260926"), berlin(26, 21));
    datei(ordner, "notiz.json", "{}", berlin(26, 23));
    mkdirSync(join(ordner, "ordner.txt"));
    datei(work, "draussen.txt", amTag("20260920"), berlin(27, 8));
    const L = logs.listLogs(ordner);
    assert(L.map((f) => f.name).join() === "neu.txt,Mitte Log.log,alt.txt" && L.every((f) => f.full.startsWith(ordner)),
      "listLogs: nur *.txt und *.log, keine Ordner, neueste zuerst, jeder Pfad im Ordner", L.map((f) => f.name));
    assert(logs.newestLog(ordner)?.name === "neu.txt", "newestLog ist der erste Eintrag der Auflistung", logs.newestLog(ordner));
    const gut = logs.logAnswer(ordner, "Mitte Log.log", "0");
    assert(gut.status === 200 && gut.body.file === "Mitte Log.log" && gut.body.text === amTag("20260925") && gut.body.to === gut.body.size,
      "logAnswer: ein Name der Auflistung liefert die Datei ab dem Byte", { status: gut.status, file: gut.body.file, to: gut.body.to, size: gut.body.size });
    const fremd = ["../draussen.txt", join(work, "draussen.txt"), "..\\draussen.txt", "ALT.TXT", "alt", "notiz.json", "ordner.txt", "", null,
      "./alt.txt", "alt.txt\u0000", " alt.txt"];
    const antworten = fremd.map((n) => logs.logAnswer(ordner, n, "0").status);
    assert(antworten.every((s) => s === 404), "logAnswer: ein Name, der nicht genau in der Auflistung steht, wird nie geoeffnet (404)",
      Object.fromEntries(fremd.map((n, i) => [String(n), antworten[i]])));
    assert(logs.logAnswer(ordner, "alt.txt", "-1").status === 400 && logs.logAnswer(ordner, "alt.txt", "1e3").status === 400
      && logs.logAnswer(ordner, "alt.txt", null).status === 400 && logs.logAnswer(ordner, "alt.txt", "abc").status === 400
      && logs.logAnswer(ordner, "alt.txt", "1234567890123456").status === 400 && logs.logAnswer(ordner, "alt.txt", "").status === 400,
      "logAnswer: from ist ein ganzes Byte (hoechstens 15 Stellen, kein Wort), sonst 400");
    /* G2: eine Verknuepfung im Log-Ordner ist kein Log, auch wenn sie auf eine Datei zeigt - wo das
       System Links erlaubt (unter Windows nur mit Entwicklermodus oder Adminrechten) */
    let link = "";
    try { symlinkSync(join(work, "draussen.txt"), join(ordner, "link.txt"), "file"); link = "da"; } catch (e) { link = String(e.code || e); }
    if (link === "da") {
      assert(!logs.listLogs(ordner).some((f) => f.name === "link.txt") && logs.logAnswer(ordner, "link.txt", "0").status === 404,
        "G2: ein Link im Log-Ordner wird nicht gelistet und nicht gelesen", logs.listLogs(ordner).map((f) => f.name));
    } else console.log("  SKIP  G2: Link im Log-Ordner - das System erlaubt hier keinen Symlink (" + link + ")");
    assert(logs.logAnswer(ordner, "alt.txt", String(10 ** 9)).status === 409, "logAnswer: hinter dem Ende 409");
    assert(logs.logAnswer(join(work, "gibtsnicht"), "alt.txt", "0").status === 404 && logs.logAnswer("", "alt.txt", "0").status === 404
      && logs.listLogs("").length === 0, "ohne Ordner: keine Auflistung, nichts zu lesen");
    // hoechstens 60: die aeltesten fallen weg und sind auch nicht zu lesen
    const viele = join(work, "viele");
    mkdirSync(viele);
    for (let i = 0; i < 63; i++) datei(viele, `log${String(i).padStart(2, "0")}.txt`, "x\n", new Date(Date.UTC(2026, 8, 1) + i * 60000));
    const V = logs.listLogs(viele);
    assert(V.length === 60 && V[0].name === "log62.txt" && V[59].name === "log03.txt", "listLogs: hoechstens 60, die neuesten",
      { n: V.length, erst: V[0]?.name, letzt: V[59]?.name });
    assert(logs.logAnswer(viele, "log02.txt", "0").status === 404 && logs.logAnswer(viele, "log03.txt", "0").status === 200,
      "logAnswer: eine Datei jenseits der 60 ist nicht zu lesen");
  }

  // ------------------------------------------------------------ Teil 2: die Seite
  /* Drei Tage: 24.09. (eine Datei), 25.09. (zwei Haelften, eine mit Leerzeichen im Namen) und 26.09. mit einer
     Datei von 00:30 in Berlin (nach UTC noch der 25.) und der neuesten, die Live liest. */
  const ordner = join(work, "logs");
  mkdirSync(ordner);
  datei(ordner, "TLCombatLog-260924.txt", amTag("20260924"), berlin(24, 21, 30));
  datei(ordner, "TLCombatLog-260925 a.txt", amTag("20260925", 0, 0.5), berlin(25, 20, 40));
  datei(ordner, "TLCombatLog-260925-b.txt", amTag("20260925", 0.5, 1), berlin(25, 23, 30));
  datei(ordner, "TLCombatLog-260926-nacht.txt", amTag("20260926", 0, 0.3), berlin(26, 0, 30));
  const neueste = datei(ordner, "TLCombatLog-260926.txt", amTag("20260926"), berlin(26, 21, 0));
  datei(ordner, "readme.json", "{}", berlin(26, 22, 0));

  const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
  const DATEI = "file:///" + join(root, "dist", "renderer", "index.html").replace(/\\/g, "/").replace(/^\/+/, "");
  const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

  /* Der gestellte Helfer. grenze: die Obergrenze eines Stuecks statt 8 MB, damit das Laden in Stuecken
     mit dem kleinen Auszug zu stellen ist. index: das Verzeichnis logIndex, wie /api/config es meldet. */
  async function oeffne({ lang = "de", breite = 1280, hoehe = 860, grenze = 0, index = {}, thema = null, uhr = false, app = false } = {}) {
    const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
    const s = { page, fehler: [], anfragen: [], posts: [], latest: 0, logIndex: null, best: [], win: [] };
    page.on("pageerror", (e) => s.fehler.push(String(e)));
    await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
    await page.route("http://boro.test/**", async (route) => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname;
      const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
      if (path.startsWith("/api/")) s.anfragen.push({ m: req.method(), path, name: url.searchParams.get("name"), from: url.searchParams.get("from") });
      if (path === "/api/state") {
        const f = logs.newestLog(ordner);
        return json(200, { dir: ordner, file: f?.name ?? "", size: f?.size ?? 0, mtime: f?.mtime ?? 0,
          // app: das eigene Fenster der App, wo es das Kompaktfenster gibt (Nachtraege N4)
          ...(app ? { nativeFrame: true, material: true, kompaktFenster: true, kompakt: { offen: false, live: false, durch: false } } : {}) });
      }
      if (path === "/api/latest") {
        s.latest++;
        const f = logs.newestLog(ordner);
        if (!f) return route.fulfill({ status: 404, body: "" });
        const a = logs.latestAnswer(f, url.searchParams.get("file"), url.searchParams.get("from"));
        return json(a.status, a.body);
      }
      if (path === "/api/logs" && req.method() === "GET")
        return json(200, { ok: true, files: logs.listLogs(ordner).map((f) => ({ name: f.name, size: f.size, mtime: f.mtime })) });
      if (path === "/api/log" && req.method() === "GET") {
        const a = logs.logAnswer(ordner, url.searchParams.get("name"), url.searchParams.get("from"));
        if (grenze && a.status === 200) {
          const f = logs.listLogs(ordner).find((x) => x.name === url.searchParams.get("name"));
          a.body = logs.readLogFrom(f, Number(url.searchParams.get("from")), grenze);
        }
        return json(a.status, a.body);
      }
      if (path === "/api/win") {
        const b = JSON.parse(req.postData() || "{}"); s.win.push(b);
        return json(200, b.do === "kompakt" ? { ok: true, offen: !!b.on } : { ok: true, w: 400, h: 300 });
      }
      if (path === "/api/best" && req.method() === "POST") {
        s.best.push(JSON.parse(req.postData() || "{}"));
        return json(200, { ok: true });
      }
      if (path === "/api/config" && req.method() === "POST") {
        const sent = JSON.parse(req.postData() || "{}");
        s.posts.push(Object.keys(sent).join());
        if (sent.logIndex) s.logIndex = sent.logIndex;
        return json(200, { ok: true });
      }
      if (path === "/api/config") return json(200, { logIndex: index, ...(thema ? { theme: thema } : {}) });
      if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json(200, { ok: true, registered: true, counts: {} }); }
      if (path === "/api/best" && req.method() === "GET") return json(200, { ok: true, best: {} });
      if (path === "/api/weeklies" && req.method() === "GET") return json(200, { ok: true, data: { v: 1, profile: [] } });
      if (path.startsWith("/api/")) return json(200, { ok: true });
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
    });
    // uhr: die Uhr der Seite laeuft, laesst sich aber vorspulen (der Takt von Live)
    if (uhr) await page.clock.install();
    await page.goto("http://boro.test/index.html" + (app ? "?win=1" : ""));
    await page.waitForFunction(() => document.body.dataset.bereit === "ordner");
    if (thema) await page.evaluate((k) => document.querySelector(`#themeRow button[data-theme="${k}"]`)?.click(), thema);
    return s;
  }
  /* auf Zustaende warten, nie auf eine feste Zeit */
  const warte = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 8000 }).then(() => true).catch(() => false);
  const blick = (p) => p.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const sicht = (e) => !!e && !e.hidden && !e.closest("[hidden]") && e.getBoundingClientRect().width > 0;
    const knopf = (id) => { const b = q(id); return b ? { sicht: sicht(b), aus: b.disabled, name: b.getAttribute("aria-label") || b.textContent.trim(),
      title: b.title, text: b.textContent.trim() } : null; };
    return {
      offen: !q("#kampfwahl").hidden,
      tag: (q("#kwTag")?.textContent || "").trim(),
      zahl: (q("#fightCount")?.textContent || "").trim(),
      pause: sicht(q("#kwPause")) ? q("#kwPause").textContent.trim() : "",
      vor: knopf("#kwTagVor"), nach: knopf("#kwTagNach"), heute: knopf("#kwHeute"),
      live: document.body.classList.contains("watching"),
      liveText: (q("#liveText")?.textContent || "").trim(),
      datei: (q("#sbDatei")?.textContent || "").trim(),
      kaempfe: document.querySelectorAll("#fightList .fight").length,
      busy: q("#kwListe")?.getAttribute("aria-busy") || "",
      start: !!q("#land") && !q("#land").closest("[hidden]") && document.querySelector("#stage")?.classList.contains("landing"),
      quer: document.documentElement.scrollWidth > innerWidth,
      fokus: document.activeElement?.id || "", fokusImFeld: !!document.activeElement?.closest("#kampfwahl"),
    };
  });
  /* folgt #155: ohne Log und ohne Log-Ordner oeffnet ein Klick auf die Pille den Log-Dialog ("No log · Open
     log"); die Kampfwahl dann mit Strg+K, wie in Teil 2. Sonst oeffnet weiter der Klick. */
  const kwAuf = async (p) => {
    const z = await p.evaluate(() => ({ zu: document.querySelector("#kampfwahl").hidden,
      ohneLog: /^(No log loaded|Kein Log geladen)/.test(document.querySelector("#kwKnopf").getAttribute("aria-label") || "") }));
    if (z.zu) { if (z.ohneLog) await p.keyboard.press("Control+k"); else await p.click("#kwKnopf"); }
    await warte(p, () => !document.querySelector("#kampfwahl").hidden); };
  const logAnfragen = (s) => s.anfragen.filter((a) => a.path === "/api/log");
  const namen = (s, ab = 0) => [...new Set(logAnfragen(s).slice(ab).map((a) => a.name))];
  const bild = async (p, name) => { if (BILDER) await p.screenshot({ path: join(BILDER, name + ".png") }); };

  // --- 1: Live liest den 26., ein Klick auf "Voriger Tag" laedt den 25. und pausiert Live
  {
    const s = await oeffne({ uhr: true });
    const p = s.page;
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    assert(await warte(p, () => document.querySelectorAll("#fightList .fight").length > 0 && document.body.classList.contains("watching")),
      "Live liest die neueste Datei");
    await kwAuf(p);
    assert(await warte(p, () => { const b = document.querySelector("#kwTagVor"); return !!b && !b.closest("[hidden]") && !b.hidden && !b.disabled; }),
      "die Kampfwahl zeigt „Voriger Tag“, sobald die Auflistung da ist");
    const b0 = await blick(p);
    assert(b0.vor?.name === "Voriger Tag" && b0.nach?.sicht && b0.nach.aus && !b0.heute?.sicht && !b0.pause,
      "heute: „Voriger Tag“ an, „Nächster Tag“ aus, kein „Heute“, keine Pause", b0);
    assert(s.anfragen.some((a) => a.path === "/api/logs" && a.m === "GET"), "die Auflistung kommt ueber GET /api/logs");
    const ab = logAnfragen(s).length, latestVorher = s.latest;
    await p.click("#kwTagVor");
    assert(await warte(p, () => document.querySelector("#kwTag")?.textContent.trim() === "Fr 25.09." && /260925/.test(document.querySelector("#sbDatei")?.textContent || "")),
      "der 25.09. ist geladen");
    const b1 = await blick(p);
    assert(JSON.stringify(namen(s, ab).sort()) === JSON.stringify(["TLCombatLog-260925 a.txt", "TLCombatLog-260925-b.txt"]),
      "geladen werden genau die Dateien des Tages (in Berlin), ueber /api/log", namen(s, ab));
    assert(logAnfragen(s).slice(ab).every((a) => a.m === "GET" && a.from === "0"), "/api/log nur als GET, ab Byte 0", logAnfragen(s).slice(ab));
    assert(b1.datei === "TLCombatLog-260925 a.txt + TLCombatLog-260925-b.txt" && b1.kaempfe > 0,
      "die Kaempfe des Tages stehen in der Liste; die Statusleiste nennt beide Dateien, die aeltere zuerst", b1);
    assert(!b1.live && b1.pause === "Live pausiert" && /pausiert/.test(b1.liveText),
      "Live pausiert, und der Kopf der Kampfwahl sagt es", b1);
    assert(b1.heute?.sicht && b1.heute.text === "Heute" && !b1.nach.aus && !b1.vor.aus && b1.offen,
      "ein frueherer Tag: „Heute“ erscheint, beide Pfeile an, das Feld bleibt offen", b1);
    assert(!b1.quer, "kein waagerechtes Rollen");
    /* G3: Tag und Pfeile zusammen links wie im Entwurf - "Nächster Tag" steht gleich hinter dem Tag,
       rechts davon eine leere Flaeche vor "Heute" und Live */
    const g3 = await p.evaluate(() => {
      const r = (id) => document.querySelector(id).getBoundingClientRect();
      // die Ausdehnung des Textes (Tag und Zahl), nicht die des Kastens
      const w = document.createTreeWalker(document.querySelector(".kwtag"), NodeFilter.SHOW_TEXT);
      const tag = { left: Infinity, right: -Infinity };
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.textContent.trim()) continue;
        const bereich = document.createRange();
        bereich.selectNodeContents(n);
        const r = bereich.getBoundingClientRect();
        if (r.width > 0) { tag.left = Math.min(tag.left, r.left); tag.right = Math.max(tag.right, r.right); }
      }
      return { vorR: r("#kwTagVor").right, tagL: tag.left, tagR: tag.right, nachL: r("#kwTagNach").left, nachR: r("#kwTagNach").right,
        luft: r(".kwluft").width, heuteL: r("#kwHeute").left };
    });
    assert(g3.vorR <= g3.tagL + 1 && g3.nachL >= g3.tagR - 1 && g3.nachL - g3.tagR <= 16 && g3.luft >= 40 && g3.heuteL >= g3.nachR + g3.luft - 1,
      "G3: ‹ Tag › zusammen links, dahinter die leere Flaeche, dann „Heute“", g3);
    await bild(p, "tage-1280-dunkel");
    /* Die neueste Datei waechst, waehrend der Tag offen ist, und die Uhr springt drei Takte vor: eine
       pausierte Aufzeichnung fragt weder /api/state noch /api/latest. Die Zeit der Datei bleibt am 26. */
    const zustaende = () => s.anfragen.filter((a) => a.path === "/api/state").length;
    const zustaendeVorher = zustaende();
    appendFileSync(neueste, amTag("20260926", 0.99, 1).split("\n").slice(1).join("\n"));
    utimesSync(neueste, berlin(26, 21, 5), berlin(26, 21, 5));
    await p.clock.fastForward(6500);
    // noch einen Tag zurueck: der 24. ist der aelteste
    await p.click("#kwTagVor");
    assert(await warte(p, () => document.querySelector("#kwTag")?.textContent.trim() === "Do 24.09."), "der 24.09. ist geladen");
    const b2 = await blick(p);
    assert(b2.vor.aus && !b2.nach.aus && b2.datei === "TLCombatLog-260924.txt", "am aeltesten Tag ist „Voriger Tag“ aus", b2);
    assert(s.latest === latestVorher && zustaende() === zustaendeVorher, "waehrend der Pause fragt die Seite weder /api/state noch /api/latest",
      { latest: [latestVorher, s.latest], state: [zustaendeVorher, zustaende()] });
    // naechster Tag: wieder der 25.
    await p.click("#kwTagNach");
    assert(await warte(p, () => document.querySelector("#kwTag")?.textContent.trim() === "Fr 25.09."), "„Nächster Tag“ geht zum 25.09.");
    // Heute: zurueck, Live liest wieder mit
    const latestPause = s.latest;
    await p.click("#kwHeute");
    assert(await warte(p, () => document.body.classList.contains("watching") && document.querySelector("#sbDatei")?.textContent.trim() === "TLCombatLog-260926.txt"),
      "„Heute“ nimmt das Mitlesen wieder auf und zeigt die neueste Datei");
    const b3 = await blick(p);
    assert(s.latest > latestPause && !b3.heute.sicht && !b3.pause && b3.nach.aus && !b3.vor.aus, "nach „Heute“: Live fragt wieder, keine Pause, kein „Heute“", b3);
    // Nachtraege N3: der logIndex aendert sich nur wie beim Oeffnen einer Datei
    const schluessel = Object.keys(s.logIndex || {});
    assert(schluessel.includes("TLCombatLog-260925 a.txt + TLCombatLog-260925-b.txt") && schluessel.includes("TLCombatLog-260924.txt")
      && s.posts.every((k) => k === "logIndex" || !/log/i.test(k)), "logIndex: je geladener Tag ein Eintrag wie beim Oeffnen der Dateien", { schluessel, posts: s.posts });
    // Live aus, dann Live ueber den Knopf im Feld an, waehrend ein frueherer Tag steht: zurueck zu heute
    await p.click("#kwTagVor");
    assert(await warte(p, () => document.querySelector("#kwTag")?.textContent.trim() === "Fr 25.09." && !document.body.classList.contains("watching")), "wieder der 25.09.");
    await p.click("#kwLive");
    assert(await warte(p, () => document.body.classList.contains("watching") && document.querySelector("#sbDatei")?.textContent.trim() === "TLCombatLog-260926.txt"),
      "Live im Feld einschalten verlaesst den frueheren Tag");
    const b4 = await blick(p);
    assert(!b4.heute.sicht && !b4.pause, "danach kein „Heute“ und keine Pause", b4);
    assert(s.anfragen.filter((a) => a.path === "/api/log" || a.path === "/api/logs").every((a) => a.m === "GET"), "beide Routen nur als GET");
    assert(!s.fehler.length, "Teil 1: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 2: ohne Live, Tag in Stuecken, der 26. mit der Datei von 00:30 in Berlin; Tastatur
  {
    const s = await oeffne({ grenze: 20000 });
    const p = s.page;
    await p.keyboard.press("Control+k");
    await warte(p, () => !document.querySelector("#kampfwahl").hidden);
    assert(await warte(p, () => { const b = document.querySelector("#kwTagVor"); return !!b && !b.closest("[hidden]") && !b.disabled; }), "ohne Live: „Voriger Tag“ an");
    // Tastatur: vom Suchfeld rueckwaerts zum Knopf, Enter
    let schritte = 0;
    while (schritte++ < 8 && (await p.evaluate(() => document.activeElement?.id)) !== "kwTagVor") await p.keyboard.press("Shift+Tab");
    const fokus = await p.evaluate(() => document.activeElement?.id);
    assert(fokus === "kwTagVor", "mit Umschalt+Tab aus der Suche erreichbar", { fokus, schritte });
    await p.keyboard.press("Enter");
    assert(await warte(p, () => document.querySelector("#kwTag")?.textContent.trim() === "Fr 25.09."), "Enter auf „Voriger Tag“ laedt den 25.09.");
    const b1 = await blick(p);
    const stuecke = logAnfragen(s).filter((a) => a.name === "TLCombatLog-260925 a.txt").map((a) => Number(a.from));
    assert(stuecke.length > 2 && stuecke[0] === 0 && stuecke.every((x, i) => i === 0 || x > stuecke[i - 1]),
      "eine Datei ueber der Grenze kommt in Stuecken, jedes ab dem Byte hinter dem vorigen", stuecke);
    assert(b1.pause === "" && !b1.live && b1.heute.sicht && b1.offen && b1.fokusImFeld, "ohne Live gibt es nichts zu pausieren; der Fokus bleibt im Feld", b1);
    // gleich viele Kaempfe wie am Stueck geladen
    const n25 = b1.kaempfe;
    // Naechster Tag vom 25. aus: der 26. mit beiden Dateien, die von 00:30 zuerst
    const ab = logAnfragen(s).length;
    await p.click("#kwTagNach");
    assert(await warte(p, () => /260926-nacht/.test(document.querySelector("#sbDatei")?.textContent || "")), "der 26.09. ist geladen");
    const b2 = await blick(p);
    assert(b2.datei === "TLCombatLog-260926-nacht.txt + TLCombatLog-260926.txt" && JSON.stringify(namen(s, ab)) ===
      JSON.stringify(["TLCombatLog-260926-nacht.txt", "TLCombatLog-260926.txt"]),
      "00:30 in Berlin gehoert zum 26. (nicht zum 25. nach UTC)", { datei: b2.datei, namen: namen(s, ab) });
    assert(!b2.heute.sicht && b2.nach.aus && !b2.live, "am neuesten Tag kein „Heute“, „Nächster Tag“ aus; Live bleibt aus", b2);
    // Vergleich: der 25. am Stueck gibt dieselbe Zahl
    const t = await oeffne();
    await kwAuf(t.page);
    await warte(t.page, () => { const b = document.querySelector("#kwTagVor"); return !!b && !b.disabled && !b.closest("[hidden]"); });
    await t.page.click("#kwTagVor");
    await warte(t.page, () => document.querySelector("#kwTag")?.textContent.trim() === "Fr 25.09.");
    const ganz = await blick(t.page);
    assert(ganz.kaempfe === n25 && n25 > 0, "in Stuecken dieselben Kaempfe wie am Stueck", { stuecke: n25, ganz: ganz.kaempfe });
    await t.page.close();
    assert(!s.fehler.length, "Teil 2: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 3: Englisch, 560 Punkt, hell
  {
    const s = await oeffne({ lang: "en", breite: 560, thema: "light" });
    const p = s.page;
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await warte(p, () => document.querySelectorAll("#fightList .fight").length > 0);
    await p.keyboard.press("Control+k");
    await warte(p, () => { const b = document.querySelector("#kwTagVor"); return !!b && !b.disabled && !b.closest("[hidden]"); });
    const b0 = await blick(p);
    assert(b0.vor?.name === "Previous day" && b0.nach?.name === "Next day", "Englisch: Previous day, Next day", b0);
    await p.click("#kwTagVor");
    await warte(p, () => document.querySelector("#kwTag")?.textContent.trim() === "Fri 25.09.");
    const b1 = await blick(p);
    assert(b1.tag === "Fri 25.09." && b1.pause === "Live paused" && b1.heute.text === "Today", "Englisch: Fri 25.09., Live paused, Today", b1);
    const lage = await p.evaluate(() => {
      const f = document.querySelector("#kampfwahl").getBoundingClientRect();
      const kopf = document.querySelector(".kwkopf");
      return { kopfH: kopf.getBoundingClientRect().height, drin: ["#kwTagVor", "#kwTagNach", "#kwHeute", "#kwLive"].every((id) => {
        const r = document.querySelector(id).getBoundingClientRect(); return r.left >= f.left - 0.5 && r.right <= f.right + 0.5 && r.width > 0; }),
        klein: [...document.querySelectorAll(".kwkopf *")].filter((e) => e.childElementCount === 0 && e.textContent.trim() && e.getBoundingClientRect().width > 0
          && parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => e.textContent.trim()),
        quer: document.documentElement.scrollWidth > innerWidth };
    });
    assert(lage.drin && !lage.quer && lage.kopfH <= 60 && !lage.klein.length, "560 Punkt: alle Knoepfe im Feld, kein waagerechtes Rollen, Text ab 11 Punkt", lage);
    await bild(p, "tage-560-hell");
    await p.setViewportSize({ width: 1280, height: 860 });
    await bild(p, "tage-1280-hell");
    await p.setViewportSize({ width: 560, height: 860 });
    await p.evaluate(() => document.querySelector('#themeRow button[data-theme="dark"]')?.click());
    await kwAuf(p);
    await bild(p, "tage-560-dunkel");
    await p.evaluate(() => document.querySelector('#themeRow button[data-theme="tnl"]')?.click());
    await kwAuf(p);
    await bild(p, "tage-560-tnl");
    await p.setViewportSize({ width: 1280, height: 860 });
    await bild(p, "tage-1280-tnl");
    assert(!s.fehler.length, "Teil 3: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 4: "Zuletzt geoeffnet" oeffnet die Datei ueber dieselbe Route
  {
    const k = (at, dur = 60) => ({ name: "Ziel", dps: 1000, dmg: 1000 * dur, dur, at });
    const index = {
      "TLCombatLog-260924.txt": { size: 1, fights: [k(Date.UTC(2026, 8, 24, 20, 30))] },
      "TLCombatLog-260925 a.txt + TLCombatLog-260925-b.txt": { size: 1, fights: [k(Date.UTC(2026, 8, 25, 20, 30))] },
      "weg.txt": { size: 1, fights: [k(Date.UTC(2026, 8, 23, 20, 30))] },
    };
    const s = await oeffne({ index });
    const p = s.page;
    assert(await warte(p, () => document.querySelectorAll("#landZuletztListe button.zr").length === 3), "Start: drei Zeilen, jede ein Knopf");
    const zeilen = await p.evaluate(() => [...document.querySelectorAll("#landZuletztListe button.zr")].map((b) => ({ datei: b.dataset.datei,
      h: b.getBoundingClientRect().height, tab: b.tabIndex, title: b.title })));
    assert(zeilen.every((z) => z.h <= 44 && z.tab >= 0 && z.title), "Zeilen hoechstens 44 Punkt, erreichbar, mit title", zeilen);
    const ab = logAnfragen(s).length;
    await p.focus('#landZuletztListe button.zr[data-datei="TLCombatLog-260924.txt"]');
    await p.keyboard.press("Enter");
    assert(await warte(p, () => document.querySelector("#sbDatei")?.textContent.trim() === "TLCombatLog-260924.txt"
      && !document.querySelector("#stage").classList.contains("landing")), "Enter auf der Zeile oeffnet die Datei und verlaesst Start");
    assert(JSON.stringify(namen(s, ab)) === JSON.stringify(["TLCombatLog-260924.txt"]), "geoeffnet ueber /api/log", namen(s, ab));
    await kwAuf(p);
    await warte(p, () => document.querySelector("#kwTag")?.textContent.trim() === "Do 24.09.");
    const b = await blick(p);
    assert(b.tag === "Do 24.09." && b.heute.sicht && b.vor.aus, "die Kampfwahl steht auf dem Tag der Datei", b);
    // zwei Dateien in einer Zeile, und eine, die nicht mehr im Ordner liegt
    await p.keyboard.press("Escape");
    await p.click('#bereiche [data-tab="start"]');
    assert(await warte(p, () => document.querySelector("#stage").classList.contains("landing")), "zurueck auf Start");
    await p.evaluate(() => document.querySelector("#landZuletztListe button.zr[data-datei^='TLCombatLog-260925']")?.click());
    assert(await warte(p, () => document.querySelector("#sbDatei")?.textContent.trim() === "TLCombatLog-260925 a.txt + TLCombatLog-260925-b.txt"),
      "eine Zeile aus zwei Dateien oeffnet beide");
    const vorher = logAnfragen(s).length;
    await p.evaluate(() => document.querySelector("#landZuletztListe button.zr[data-datei='weg.txt']")?.click());
    assert(await warte(p, () => /weg\.txt liegt nicht mehr im Log-Ordner/.test(document.querySelector("#toast")?.textContent || "")),
      "eine Datei, die nicht mehr im Ordner liegt: ein Satz, nichts geladen");
    assert(logAnfragen(s).length === vorher && (await blick(p)).datei === "TLCombatLog-260925 a.txt + TLCombatLog-260925-b.txt",
      "dafuer keine Anfrage an /api/log, die geladene Datei bleibt");
    assert(!s.fehler.length, "Teil 4: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 6: Pause und Rueckkehr (Pruefung N3, G4 und W3)
  {
    const s = await oeffne({ uhr: true });
    const p = s.page;
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    assert(await warte(p, () => document.querySelectorAll("#fightList .fight").length > 0 && document.body.classList.contains("watching")), "6: Live liest");
    // der laufende (neueste) Kampf, wie Live ihn ins Verzeichnis schrieb
    for (const ende = Date.now() + 8000; Date.now() < ende && !s.logIndex?.["TLCombatLog-260926.txt"]; ) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    const neuester = Math.max(...(s.logIndex?.["TLCombatLog-260926.txt"]?.fights || []).map((f) => f.at));
    await p.clock.fastForward(10000);
    await p.evaluate(() => fetch("/api/ping"));
    const bestLiveVorher = s.best.filter((b) => b.entry && (b.entry.best?.at === neuester || b.entry.second?.at === neuester)).length;
    assert(Number.isFinite(neuester) && bestLiveVorher === 0, "G4: waehrend Live zaehlt der laufende Kampf nicht als bester Pull", { neuester, bestLiveVorher });
    await kwAuf(p);
    await warte(p, () => { const b = document.querySelector("#kwTagVor"); return !!b && !b.hidden && !b.disabled; });
    await p.click("#kwTagVor");
    assert(await warte(p, () => document.querySelector("#kwTag")?.textContent.trim() === "Fr 25.09."), "6: der 25.09. ist geladen");
    await p.clock.fastForward(10000);
    await p.evaluate(() => fetch("/api/ping"));
    const alsBester = s.best.filter((b) => b.entry && (b.entry.best?.at === neuester || b.entry.second?.at === neuester));
    assert(alsBester.length === 0, "G4: die Pause traegt den laufenden Kampf nicht als besten Pull ein (anders als „Live aus“)",
      alsBester.map((b) => b.key));
    // W3: einen Kampf loesen und dann leeren; nach Tag zurueck und "Heute" gilt beides noch
    await p.click("#kwHeute");
    assert(await warte(p, () => document.body.classList.contains("watching") && document.querySelector("#sbDatei")?.textContent.trim() === "TLCombatLog-260926.txt"
      && (parseInt(document.querySelector("#fightCount")?.textContent || "", 10) || 0) > 1), "6: zurueck bei Live");
    /* die Zahl der Kaempfe im Kopf (zugeklappte Trash-Gruppen zeigen nicht jede Zeile) */
    const anzahl = () => p.evaluate(() => parseInt(document.querySelector("#fightCount")?.textContent || "", 10) || 0);
    const n0 = await anzahl();
    await p.click("#btnEditFights");
    const geloest = await p.evaluate(() => { const x = [...document.querySelectorAll("#fightList .fx")].pop(); x?.click(); return !!x; });
    assert(geloest && await warte(p, (n) => (parseInt(document.querySelector("#fightCount")?.textContent || "", 10) || 0) === n - 1, n0),
      "6: ein Kampf ist geloest", { geloest, n0, jetzt: await anzahl() });
    await p.click("#btnEditFights");
    await p.click("#kwTagVor");
    assert(await warte(p, () => document.querySelector("#kwTag")?.textContent.trim() === "Fr 25.09."), "6: wieder der 25.09.");
    await p.click("#kwHeute");
    assert(await warte(p, () => document.body.classList.contains("watching") && document.querySelector("#sbDatei")?.textContent.trim() === "TLCombatLog-260926.txt"),
      "6: wieder bei Live");
    const n1 = await anzahl();
    assert(n1 === n0 - 1, "W3: der geloeste Kampf bleibt nach „Heute“ geloest", { vorher: n0, nachher: n1 });
    await p.click("#btnClearLog");
    assert(await warte(p, () => (parseInt(document.querySelector("#fightCount")?.textContent || "", 10) || 0) === 0), "6: geleert");
    await p.click("#kwTagVor");
    assert(await warte(p, () => document.querySelector("#kwTag")?.textContent.trim() === "Fr 25.09." && document.querySelectorAll("#fightList .fight").length > 0),
      "6: der 25.09. zeigt seine Kaempfe");
    await p.click("#kwHeute");
    assert(await warte(p, () => document.body.classList.contains("watching") && document.querySelector("#sbDatei")?.textContent.trim() === "TLCombatLog-260926.txt"),
      "6: noch einmal bei Live");
    const n2 = await anzahl();
    assert(n2 === 0, "W3: der Zeitschnitt von „Leeren“ steht nach „Heute“ noch", { nachher: n2 });
    assert(!s.fehler.length, "Teil 6: keine Fehler", s.fehler);
    await p.close();
  }

  /* --- 7: frueherer Tag und Kompakt (Abschlusspruefung, M1 und H2).
     M1: Live ist fuer den frueheren Tag nur pausiert - das Kompaktfenster
     laeuft mit (live: true), auch ueber das Kuerzel. H2: im Rueckfall (ein
     Fenster) sagt der Streifen in seiner Lesezeile, dass Live pausiert. */
  const zumVortag = async (p) => {
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await warte(p, () => document.querySelectorAll("#fightList .fight").length > 0 && document.body.classList.contains("watching"));
    await kwAuf(p);
    await warte(p, () => { const b = document.querySelector("#kwTagVor"); return !!b && !b.hidden && !b.disabled; });
    await p.click("#kwTagVor");
    return warte(p, () => document.querySelector("#kwTag")?.textContent.trim() === "Fr 25.09." && !document.body.classList.contains("watching"));
  };
  {
    const s = await oeffne({ app: true });
    const p = s.page;
    assert(await zumVortag(p), "7: der 25.09. ist geladen, Live pausiert");
    await p.keyboard.press("Escape");
    await p.click("#btnCompact");
    await warte(p, () => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true");
    const auf = s.win.filter((b) => b.do === "kompakt");
    assert(auf.length === 1 && auf[0].on === true && auf[0].live === true,
      "M1: Live pausiert fuer einen frueheren Tag - das Kompaktfenster laeuft trotzdem mit", s.win);
    assert(!s.fehler.length, "Teil 7 (App): keine Fehler", s.fehler);
    await p.close();
  }
  for (const [lang, satz] of [["de", "Live pausiert"], ["en", "Live paused"]]) {
    const s = await oeffne({ lang, uhr: true });
    const p = s.page;
    await zumVortag(p);
    await p.keyboard.press("Escape");
    await p.click("#btnCompact");
    await warte(p, () => document.body.classList.contains("compact"));
    const lese = () => p.evaluate(() => { const e = document.querySelector("#hCompact");
      return { da: !!e && !e.hidden && e.getClientRects().length > 0, text: (e?.textContent || "").trim(), title: e?.title || "" }; });
    const z = await lese();
    assert(z.da && z.text.startsWith(satz + " \u00b7 ") && z.title === z.text,
      `H2 (${lang}): der Streifen sagt in der Lesezeile „${satz}“`, z);
    // zurueck zur Vollansicht, "Heute": Live laeuft wieder, im Streifen kein Hinweis mehr
    await p.click("#btnCompact");
    await warte(p, () => !document.body.classList.contains("compact"));
    await kwAuf(p);
    await p.click("#kwHeute");
    await warte(p, () => document.body.classList.contains("watching"));
    await p.keyboard.press("Escape");
    await p.click("#btnCompact");
    await warte(p, () => document.body.classList.contains("compact"));
    const y = await lese();
    assert(!y.text.includes(satz), `H2 (${lang}): nach „Heute“ kein Hinweis mehr`, y);
    assert(!s.fehler.length, `Teil 7 (${lang}): keine Fehler`, s.fehler);
    await p.close();
  }

  // --- 5: im Browser ohne App gibt es keine Route: keine Knoepfe
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const fehler = [];
    page.on("pageerror", (e) => fehler.push(String(e)));
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* blockiert */ } });
    await page.goto(DATEI);
    await page.waitForFunction(() => !!document.querySelector("#kwKnopf"));
    await page.click("#btnSample2");
    await page.waitForFunction(() => document.querySelectorAll("#fightList .fight").length > 0);
    await page.click("#kwKnopf");
    await page.waitForFunction(() => !document.querySelector("#kampfwahl").hidden);
    const b = await blick(page);
    assert(b.vor && !b.vor.sicht && !b.nach.sicht && !b.heute.sicht && !b.pause, "Datei-Modus: kein „Voriger Tag“, kein „Nächster Tag“, kein „Heute“", b);
    assert(!fehler.length, "Teil 5: keine Fehler", fehler);
    await page.close();
  }
  await browser.close();
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} FAILED` : "\nall ok");
process.exit(failed ? 1 : 0);
