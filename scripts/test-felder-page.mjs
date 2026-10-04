// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Instrumententafel Stufe 4 (Spezifikation 27.09.2026, Abschnitt 6): die
// Bereiche ausser Kampf als Felder an der gebauten Seite, vom gestellten
// Helfer ausgeliefert (page.route) - oben die Kopfzeile des Bereichs
// (#bereichKopf) statt Zahlenstreifen und Schadenstafel, darunter die
// Bloecke des Panels mit 1-Punkt-Fugen.
//
// Run:  npm run test:felder-page     (baut die Seite zuerst)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Ein Log in der Form, die das Spiel schreibt (wie test-tafel-page.mjs):
   alle 0,5 s ein Treffer, vier Faehigkeiten im Wechsel, je Faehigkeit mal
   je[Name], wo ein Pull an einer Stelle anders laufen soll. Nur Zielnamen
   und Zahlen, keine Spielernamen. */
const SKILLS = [["Detonation Mark", 953174691], ["Quick Fire", 964762401],
                ["Strafing", 945674044], ["Decisive Sniping", 964581976]];
const two = (n, w = 2) => String(n).padStart(w, "0");
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-` +
         `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`;
};
function logText(pulls) {
  const lines = ["CombatLogVersion,4"];
  for (const p of pulls) {
    for (let k = 0; k * 500 < p.secs * 1000; k++) {
      const [skill, sid] = SKILLS[k % SKILLS.length];
      const dmg = Math.round(1000 * p.scale * (p.je?.[skill] ?? 1) * (1 + (k % 5)));
      lines.push(`${stamp(p.start + k * 500)},DamageDone,${skill},${sid},${dmg},0,0,kNormalHit,Tester,${p.target}`);
    }
  }
  return lines.join("\n") + "\n";
}
/* Wie logText, aber mit einer blossen Uhrzeit (HH:MM:SS) ohne Datum - so
   liest parseTime (03-helpers.ts) sie als "nur Tageszeit" (wall:false), und
   die Kopfzeile hat keine Uhrzeit zum Zeigen. Fuer die Probe, dass #bkTr1
   dann leer bleibt statt eines zweiten, doppelten Trenners. */
function logTextNoWall(secs) {
  const lines = ["CombatLogVersion,4"];
  for (let k = 0; k * 500 < secs * 1000; k++) {
    const [skill, sid] = SKILLS[k % SKILLS.length];
    const t = k * 0.5;
    const two2 = (n) => String(n).padStart(2, "0");
    const zeit = `${two2(Math.floor(t / 3600))}:${two2(Math.floor((t % 3600) / 60))}:${two2(Math.floor(t % 60))}`;
    lines.push(`${zeit},DamageDone,${skill},${sid},1000,0,0,kNormalHit,Tester,Vulcanus`);
  }
  return lines.join("\n") + "\n";
}
const at = (h, m, s = 0) => Date.UTC(2026, 8, 20, h, m, s);
const PULLS = [
  { target: "Vulcanus", start: at(20, 0, 0), secs: 60, scale: 1.0 },
  { target: "Vulcanus", start: at(20, 30, 0), secs: 60, scale: 1.2 },
  { target: "Stone Beetle", start: at(21, 0, 0), secs: 20, scale: 1.0 },
];

/* Eine Seite am gestellten Helfer, wie in test-einst-page.mjs. app: ?win=1
   und nativeFrame (das eigene Fenster der App), sonst ein Browser-Tab.
   helfer: {dir, file, text} - der Helfer beobachtet einen Ordner.
   Mitgeschrieben: POST /api/config in s.posts. */
async function oeffne({ app = false, lang = "en", config = {}, breite = 1280, hoehe = 860, helfer = null } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const s = { page, fehler: [], posts: [], baue: {} };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/state") return json(helfer
      ? { dir: helfer.dir, file: helfer.file, size: helfer.text.length, mtime: 1, nativeFrame: app, material: false, stayOnTop: false }
      : { dir: "", file: "", nativeFrame: app, material: false, stayOnTop: false });
    if (path === "/api/latest" && helfer) {
      const n = helfer.text.length;
      return json({ file: helfer.file, from: 0, to: n, size: n, head: helfer.text.split("\n").slice(0, 2).join("\n"), text: helfer.text });
    }
    /* folgt Spezifikation Rundgang 02.10.2026: ein erster Start der App zeigt den
       Rundgang. Diese Proben gelten der App danach; den Rundgang selbst prueft
       test-rundgang-page.mjs. Eine eigene config kann es ueberschreiben. */
    if (path === "/api/config" && req.method() === "GET") return json({ rundgangGesehen: true, ...config });
    if (path === "/api/config") { s.posts.push(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
    if (path === "/api/win") return json({ ok: true, max: false, w: 400, h: 28, on_top: true });
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: {} }); }
    if (path === "/api/builds" && req.method() === "GET") return json({ ok: true, builds: {} });
    // die Builds, wie die Seite sie in boro-builds.json schreibt (Aufgabe 12: ihre Namen stehen nur noch im Verlauf)
    if (path === "/api/builds" && req.method() === "POST") { const b = JSON.parse(req.postData() || "{}"); s.baue[b.id] = b.build; return json({ ok: true }); }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html" + (app ? "?win=1" : ""));
  // Seite fertig: body[data-bereit] statt #landStatus (Neugestaltung 28.09., Befund 2)
  await page.waitForFunction((h) => document.body.dataset.bereit === (h ? "ordner" : "ohne"), !!helfer);
  await page.waitForTimeout(400);
  return s;
}
/* Der Beispielkampf: der Knopf auf der Startseite, dann steht der Bereich Kampf. */
async function beispiel(page) {
  await page.evaluate(() => document.querySelector("#btnSample").click());
  await page.waitForFunction(() => !document.querySelector("#app").hidden);
  await page.waitForTimeout(300);
}
/* Wie test-rahmen-page.mjs: ueber die Einstellungen, danach zurueck in den Bereich von vorher. */
async function einstellung(p, gruppe, tun) {
  const vorher = await p.evaluate(() => document.querySelector('#bereiche .tab[aria-current="page"]')?.dataset.tab || "");
  const oben = await p.evaluate(() => document.querySelector("#btnEinst").getClientRects().length > 0);
  await p.click(oben ? "#btnEinst" : '#bereiche [data-tab="settings"]');
  await p.click(`#einstNav button[data-gruppe="${gruppe}"]`);
  await tun();
  if (vorher && vorher !== "settings" && await p.evaluate(() => !document.querySelector("#einst").hidden))
    await p.click(`#bereiche [data-tab="${vorher}"]`);
}
const entwickler = (p) => einstellung(p, "dev", () => p.click("#eDev"));
const bereich = async (p, name) => { await p.click(`#bereiche [data-tab="${name}"]`); await p.waitForTimeout(200); };

/* Was ein Bereich zeigt: Klassen, Kopf und Tafel, die Kopfzeile, die
   sichtbaren Bloecke des Panels (ohne die unsichtbare Ueberschrift) und
   ihre Fugen, Querrollen. */
const blick = (p) => p.evaluate(() => {
  const q = (x) => document.querySelector(x);
  const sicht = (e) => !!e && e.getClientRects().length > 0;
  const panel = q(".panel.on"), kopf = q("#bereichKopf");
  const bloecke = panel ? [...panel.children].filter((c) => !c.matches("h2.vh") && sicht(c) && c.getBoundingClientRect().height > 0)
    .map((c) => ({ id: c.id || c.className, r: c.getBoundingClientRect().toJSON(), rad: getComputedStyle(c).borderTopLeftRadius })) : [];
  bloecke.sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
  // Fugen: jeder Block beginnt hoechstens 1 Punkt unter dem Ende des vorigen (untereinander)
  const fugen = [];
  for (let i = 1; i < bloecke.length; i++) fugen.push(+(bloecke[i].r.top - bloecke[i - 1].r.bottom).toFixed(2));
  const kr = sicht(kopf) ? kopf.getBoundingClientRect() : null;
  return {
    felder: document.body.classList.contains("felder"), tafel: document.body.classList.contains("tafel"),
    kopfwrap: sicht(q(".headwrap")), tabelle: sicht(q(".table")), ring: sicht(q("#ringFeld")),
    kopf: sicht(kopf), name: q("#bkName")?.textContent || "", nameTag: q("#bkName")?.tagName, huelle: kopf?.tagName,
    kampf: sicht(q("#bereichKopf .bkkampf")), boss: q("#bereichKopf .bkkampf b")?.textContent || "",
    zeit: q("#bereichKopf .bkzeit")?.textContent || "", dps: q("#bereichKopf .bkkampf .num")?.textContent || "",
    kampfText: q("#bereichKopf .bkkampf")?.textContent || "",
    // Gruppe (Luecken 7.1): statt des Kampfs ihr Stand ("No party yet", "Party running \u00b7 K7QX")
    ctx: sicht(q("#bkCtx")) ? q("#bkCtx").textContent.trim() : "",
    akt: sicht(q("#bereichKopf .bkakt")), speichern: sicht(q("#bkSpeichern")), bild: sicht(q("#bkBild")),
    speichernAus: q("#bkSpeichern")?.disabled, saveRunAus: q("#btnSaveRun")?.disabled,
    kopfZuPanel: kr && bloecke.length ? +(bloecke[0].r.top - kr.bottom).toFixed(2) : null,
    bloecke: bloecke.map((b) => b.id), fugen, radien: bloecke.map((b) => b.rad),
    quer: document.documentElement.scrollWidth > innerWidth,
    vhSicht: panel ? [...panel.querySelectorAll(":scope > h2.vh")].some((h) => getComputedStyle(h).display !== "none") : false,
  };
});

const BEREICHE = [["rotation", "Rotation"], ["analysis", "Analysis"], ["compare", "Compare"], ["history", "History"],
                  ["party", "Party"], ["weapons", "Weapons"], ["setup", "Log setup"]];

/* Verlauf (Abschnitt 8 und 9): vier Pulls an Vulcanus mit verschiedener
   Dauer und Staerke, dazu ein Trash-Gegner. Der Median der vier ist das
   Mittel der beiden mittleren (mitte()), der Median aller Kaempfe am Boss
   wie in der Bossliste. */
const VER = [
  { target: "Vulcanus", start: at(20, 0, 0), secs: 60, scale: 1.0 },
  { target: "Vulcanus", start: at(20, 30, 0), secs: 90, scale: 1.3 },
  { target: "Vulcanus", start: at(21, 0, 0), secs: 30, scale: 0.8 },
  { target: "Vulcanus", start: at(21, 30, 0), secs: 60, scale: 1.1 },
  { target: "Stone Beetle", start: at(22, 0, 0), secs: 20, scale: 1.0 },
];
/* Live einschalten, bis die Kaempfe in der Liste stehen, dann einen
   Vulcanus-Pull waehlen, der nicht der beste ist (der neueste steht oben). */
const laden = async (p, n = 5) => {
  await p.evaluate(() => document.querySelector("#btnWatch").click());
  await p.waitForFunction((m) => document.querySelectorAll("#fightList .fight").length >= m, n, { timeout: 8000 });
  await p.evaluate(() => {
    const v = [...document.querySelectorAll("#fightList .fight")].filter((f) => /Vulcanus/.test(f.textContent));
    v[1].click();
  });
  await p.waitForFunction(() => !document.querySelector("#app").hidden);
  await p.waitForTimeout(300);
};

try {
  // --- 1. jeder Bereich ausser Kampf: Kopfzeile, ohne Streifen und Tafel, Felder mit Fugen
  {
    const s = await oeffne({ app: true }); const p = s.page; await beispiel(p);
    await entwickler(p);   // Waffen und Log-Einrichtung in der Leiste
    await p.waitForTimeout(600);
    const kampf = await p.evaluate(() => ({ boss: document.querySelector("#hName").textContent.trim(),
      dps: document.querySelector("#hDps").textContent.trim() }));
    const k0 = await blick(p);
    /* folgt Spezifikation Glutring 2: der Kopfstreifen entfaellt im Bereich Kampf, seine Knoten stehen im Ringfeld */
    assert(k0.tafel && !k0.felder && !k0.kopf && !k0.kopfwrap && k0.ring && k0.tabelle, "Kampf: Tafel wie in Stufe 2, keine Kopfzeile", k0);
    for (const [tab, name] of BEREICHE) {
      // weit unten im vorigen Bereich: der neue beginnt mit seiner Kopfzeile unter der Titelleiste
      await p.evaluate(() => window.scrollTo(0, 1e6));
      await bereich(p, tab);
      const b = await blick(p);
      const oben = await p.evaluate(() => {
        const r = document.querySelector("#bereichKopf").getBoundingClientRect();
        const e = document.elementFromPoint(r.left + 40, r.top + r.height / 2);
        return { top: r.top, leiste: document.querySelector(".top").getBoundingClientRect().bottom, trifft: !!e && !!e.closest("#bereichKopf") };
      });
      assert(oben.trifft && oben.top >= oben.leiste - 1, `${name}: die Kopfzeile steht unter der Titelleiste im Bild`, oben);
      assert(b.felder && !b.tafel && !b.kopfwrap && !b.tabelle, `${name}: body.felder, Streifen und Schadenstafel nicht zu sehen`, b);
      assert(b.kopf && b.huelle === "HEADER" && b.nameTag === "H2" && b.name === name, `${name}: Kopfzeile (header, h2) mit dem Namen des Bereichs`, b);
      /* Folgt Entwurf (Neugestaltung 28.09., Luecken 7.1): die Gruppe nennt im Kopf statt des Kampfs
         ihren Stand; alle anderen Bereiche den Kampf wie bisher, ohne Stand. */
      if (tab === "party") assert(!b.kampf && b.ctx === "No party yet", `${name}: Kopfzeile nennt den Stand der Gruppe statt des Kampfs`, b);
      else assert(b.kampf && !b.ctx && b.boss === kampf.boss && b.dps.includes(kampf.dps) && /\d:\d\d/.test(b.zeit),
        `${name}: Kopfzeile nennt Boss, Uhrzeit und DPS des gewaehlten Kampfs`, { b, kampf });
      /* Seit der Kritik vom 28.09. (Abschnitt 12) nur, wo es um den Kampf geht;
         dort mit demselben Zustand wie #btnSaveRun. */
      if (["rotation", "analysis", "compare", "weapons"].includes(tab))
        assert(b.akt && b.speichern && b.bild && b.speichernAus === b.saveRunAus, `${name}: Kampf speichern und Als Bild in der Kopfzeile`, b);
      assert(b.bloecke.length >= 1 && b.fugen.every((f) => f >= -0.5 && f <= 1) && b.kopfZuPanel !== null && b.kopfZuPanel >= -0.5 && b.kopfZuPanel <= 1,
        `${name}: die Bloecke stossen mit 1 Punkt aneinander`, b);
      assert(b.radien.every((r) => r === "0px"), `${name}: Felder ohne Radius`, b.radien);
      assert(!b.quer && !b.vhSicht, `${name}: kein Querrollen, eine Ueberschrift des Bereichs`, b);
    }
    // Speichern: derselbe Weg wie #btnSaveRun (Dialog, dann POST /api/config mit dem Kampf)
    await bereich(p, "rotation");
    await p.click("#bkSpeichern");
    await p.waitForSelector("#modalInput", { state: "visible" });
    await p.fill("#modalInput", "Felderprobe");
    await p.click("#modalOk");
    await p.waitForTimeout(300);
    const gespeichert = s.posts.some((b) => Array.isArray(b.runs) && b.runs.some((r) => JSON.stringify(r).includes("Felderprobe")));
    assert(gespeichert, "Kampf speichern (Kopfzeile): postet den Kampf wie #btnSaveRun", s.posts.length);
    await p.click("#bkBild");
    await p.waitForTimeout(300);
    const bild = await p.evaluate(() => document.querySelector("#shareBg").classList.contains("on"));
    assert(bild, "Als Bild (Kopfzeile): das Bild-Fenster oeffnet", bild);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(200);
    // Kampf -> Rotation -> Kampf: die Tafel ist wieder da
    await bereich(p, "timeline");
    const k1 = await blick(p);
    const kurve = await p.evaluate(() => document.querySelector("#kurveFeld").getClientRects().length > 0);
    assert(k1.tafel && !k1.felder && !k1.kopf && !k1.kopfwrap && k1.ring && k1.tabelle && kurve, "zurueck im Kampf: Tafel wieder da, keine Kopfzeile", k1);
    // Kompakt: keine Kopfzeile, der Kopf wie immer
    await bereich(p, "rotation");
    await p.click("#btnCompact"); await p.waitForFunction(() => document.body.classList.contains("compact"));
    await p.waitForTimeout(200);
    const kom = await blick(p);
    assert(!kom.felder && !kom.kopf && kom.kopfwrap, "Kompakt: keine Kopfzeile, der Kopf wie immer", kom);
    await p.click("#btnCompact"); await p.waitForFunction(() => !document.body.classList.contains("compact"));
    await p.waitForTimeout(200);
    const zur = await blick(p);
    assert(zur.felder && zur.kopf && !zur.kopfwrap, "zurueck aus dem Kompakt: wieder Felder", zur);
    assert(!s.fehler.length, "Bereiche: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 2. Deutsch und schmal (560 Punkt)
  {
    const s = await oeffne({ app: true, lang: "de", breite: 560, hoehe: 800 }); const p = s.page; await beispiel(p);
    for (const [tab, name] of [["rotation", "Rotation"], ["analysis", "Analyse"], ["compare", "Vergleich"], ["history", "Verlauf"], ["party", "Gruppe"]]) {
      await bereich(p, tab);
      const b = await blick(p);
      assert(b.felder && b.kopf && b.name === name && !b.quer, `560, Deutsch: ${name} ohne Querrollen`, b);
    }
    const knopf = await p.evaluate(() => [document.querySelector("#bkSpeichern").textContent.trim(), document.querySelector("#bkBild").getAttribute("aria-label")]);
    assert(knopf[0] === "Kampf speichern" && knopf[1] === "Als Bild teilen", "Deutsch: die Knoepfe der Kopfzeile", knopf);
    assert(!s.fehler.length, "560, Deutsch: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 3. ohne Kampf: Gruppe ohne Log - die Kopfzeile nennt nur den Bereich
  {
    const s = await oeffne({ app: true }); const p = s.page;
    await bereich(p, "party");
    const b = await blick(p);
    const app = await p.evaluate(() => !document.querySelector("#app").hidden);
    assert(app && b.felder && b.kopf && b.name === "Party" && !b.kampf && !b.akt, "Gruppe ohne Log: Kopfzeile nur mit dem Namen", { app, b });
    assert(!b.kopfwrap && !b.tabelle && b.fugen.every((f) => f >= -0.5 && f <= 1), "Gruppe ohne Log: Felder mit Fugen", b);
    assert(!s.fehler.length, "ohne Kampf: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 4. Live: ein Neuzeichnen ohne Aenderung fasst die Kopfzeile nicht an, ein neuer Kampf schon
  {
    const helfer = { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS) };
    const s = await oeffne({ app: true, helfer });
    const p = s.page;
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await p.waitForFunction(() => document.querySelectorAll("#fightList .fight").length >= 3, null, { timeout: 8000 });
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="1"]').click());
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    await p.waitForTimeout(300);
    await bereich(p, "rotation");
    const b = await blick(p);
    assert(b.felder && b.kopf && b.boss === "Vulcanus", "Live: Kopfzeile mit dem gewaehlten Kampf", b);
    /* Boss, Zeit und DPS stehen nur mit CSS-Abstand nebeneinander - ohne
       eigenen Trenner liest ein Vorleser sie als ein Wort. #bkTr1/#bkTr2
       tragen darum versteckten Text (.vh) im Baum selbst, den textContent
       (und mit ihm ein Vorleser) mitliest; dieser Kampf hat eine Uhrzeit,
       darum drei Teile mit zwei Trennern. */
    const teileKampf = b.kampfText.split(" \u00b7 ");
    assert(teileKampf.length === 3 && teileKampf[0] === b.boss && teileKampf[1] === b.zeit && teileKampf[2] === b.dps,
      "Live: #bkKampf traegt versteckte Trenner zwischen Boss, Zeit und DPS", { kampfText: b.kampfText, b });
    /* Im Fenster laeuft sicher ein Neuzeichnen durch syncFelder: derselbe
       Bereich noch einmal (switchTab ruft syncFelder) und dasselbe Thema noch
       einmal (setzeThema ruft renderAll). Dass renderAll lief, zeigt die
       Tabelle (#bars wird neu geschrieben); die Kopfzeile bleibt unberuehrt. */
    const takte = await p.evaluate(() => new Promise((fertig) => {
      let n = 0, bars = 0;
      const mo = new MutationObserver((m) => { n += m.length; });
      const mb = new MutationObserver((m) => { bars += m.length; });
      mo.observe(document.querySelector("#bereichKopf"), { subtree: true, childList: true, characterData: true, attributes: true });
      mb.observe(document.querySelector("#bars"), { subtree: true, childList: true });
      setTimeout(() => {
        document.querySelector('#bereiche [data-tab="rotation"]').click();
        const th = document.documentElement.dataset.theme || "dark";
        document.querySelector(`#themeRow [data-theme="${th}"]`).click();
      }, 300);
      setTimeout(() => { mo.disconnect(); mb.disconnect(); fertig({ n, bars }); }, 2500);
    }));
    assert(takte.bars > 0, "Live: im Fenster lief ein Neuzeichnen (renderAll)", takte);
    assert(takte.n === 0, "Live: ein Neuzeichnen ohne Aenderung fasst #bereichKopf nicht an", takte);
    // ein neuer Kampf im Log: die Kopfzeile folgt dem gewaehlten Kampf, wie der Kopf des Kampfs
    const vorher = await blick(p);
    helfer.text = logText([...PULLS, { target: "Vulcanus", start: at(21, 30, 0), secs: 90, scale: 2.0 }]);
    await p.waitForFunction(() => document.querySelectorAll("#fightList .fight").length >= 4, null, { timeout: 10000 });
    await p.waitForTimeout(500);
    const nachher = await blick(p);
    const kopfKampf = await p.evaluate(() => ({ boss: document.querySelector("#hName").textContent.trim(),
      dps: document.querySelector("#hDps").textContent.trim() }));
    assert(nachher.felder && nachher.boss === kopfKampf.boss && nachher.dps.includes(kopfKampf.dps),
      "Live: nach einem neuen Kampf nennt die Kopfzeile den gewaehlten Kampf", { nachher, kopfKampf });
    assert(nachher.dps !== vorher.dps || nachher.zeit !== vorher.zeit, "Live: der neue Kampf aendert die Kopfzeile", { vorher, nachher });
    assert(!s.fehler.length, "Live: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 4b. Kopfzeile ohne Uhrzeit (Log ohne Datum, state.wall bleibt false):
  // genau ein Trenner zwischen Boss und DPS, kein doppelter an der leeren Zeit
  {
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logTextNoWall(30) } });
    const p = s.page;
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await p.waitForFunction(() => document.querySelectorAll("#fightList .fight").length >= 1, null, { timeout: 8000 });
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="0"]').click());
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    await p.waitForTimeout(300);
    await bereich(p, "rotation");
    const b = await blick(p);
    assert(b.felder && b.kampf && b.boss === "Vulcanus" && b.zeit === "",
      "Kopfzeile ohne Uhrzeit: Vorbedingung, kein Datum im Log, keine Uhrzeit in der Kopfzeile", b);
    const teileOhneZeit = b.kampfText.split(" \u00b7 ");
    assert(teileOhneZeit.length === 2 && teileOhneZeit[0] === b.boss && teileOhneZeit[1] === b.dps,
      "Kopfzeile ohne Uhrzeit: genau ein Trenner zwischen Boss und DPS, kein doppelter", { kampfText: b.kampfText, b });
    assert(!s.fehler.length, "Kopfzeile ohne Uhrzeit: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 5. nach dem Leeren: der Satz, dass die Liste leer ist und worauf sie wartet, steht unter der Kopfzeile
  {
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS) } });
    const p = s.page;
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await p.waitForFunction(() => document.querySelectorAll("#fightList .fight").length >= 3, null, { timeout: 8000 });
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="1"]').click());
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    await bereich(p, "rotation");
    await p.evaluate(() => document.querySelector("#btnClearLog").click());
    await p.waitForTimeout(400);
    const b = await blick(p);
    const satz = await p.evaluate(() => {
      const n = document.querySelector("#clearedNote"), k = document.querySelector("#bereichKopf");
      const sicht = !!n && n.getClientRects().length > 0;
      return { sicht, text: n?.textContent || "", unterKopf: sicht && k.getBoundingClientRect().bottom <= n.getBoundingClientRect().top + 1,
        ueberPanel: sicht && n.getBoundingClientRect().bottom <= document.querySelector(".panel.on").getBoundingClientRect().top + 1 };
    });
    assert(b.felder && b.kopf && b.name === "Rotation" && !b.kampf, "Leeren auf Rotation: Kopfzeile nur mit dem Namen", b);
    assert(satz.sicht && /List cleared/.test(satz.text) && satz.unterKopf && satz.ueberPanel,
      "Leeren auf Rotation: der Satz „List cleared“ steht unter der Kopfzeile, ueber dem Panel", satz);
    assert(!b.quer, "Leeren: kein Querrollen", b);
    assert(!s.fehler.length, "Leeren: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 6. (Aufgabe 2) Rotation und Analyse als Felder
  {
    /* Die Felder eines Panels: sichtbare direkte Kinder mit Lage, dazu die
       Breite des Panels. */
    const felder = (p, panel) => p.evaluate((sel) => {
      const pn = document.querySelector(sel), pr = pn.getBoundingClientRect();
      const sicht = (e) => !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().height > 0;
      const k = [...pn.children].filter((c) => !c.matches("h2.vh") && sicht(c)).map((c) => ({ el: c, r: c.getBoundingClientRect() }));
      k.sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
      return { links: pr.left, rechts: pr.right,
        ids: k.map((x) => x.el.id || x.el.className),
        breit: k.map((x) => Math.abs(x.r.left - pr.left) < 1 && Math.abs(x.r.right - pr.right) < 1),
        fugen: k.slice(1).map((x, i) => +(x.r.top - k[i].r.bottom).toFixed(2)),
        autoIn: k.findIndex((x) => x.el.contains(document.querySelector("#drAutoKasten"))),
        verdictIn: k.findIndex((x) => x.el.contains(document.querySelector("#verdict"))),
        findingsIn: k.findIndex((x) => x.el.contains(document.querySelector("#findings"))),
        // die Ueberschrift jedes Feldes (h2/h3, die erste darin), sichtbar und nicht leer
        koepfe: k.map((x) => { const h = x.el.querySelector("h2:not(.vh), h3");
          return h && h.getClientRects().length > 0 ? h.textContent.trim() : ""; }),
        callIn: k.findIndex((x) => x.el.contains(document.querySelector("#analysisCall"))),
        callKarte: !!document.querySelector("#analysisCall")?.closest(".card"),
        callName: document.querySelector("#analysisCall")?.getAttribute("aria-label") || "",
        callRolle: document.querySelector("#analysisCall")?.getAttribute("role") || "",
        quer: document.documentElement.scrollWidth > innerWidth };
    }, panel);
    for (const [lang, breite] of [["en", 1280], ["de", 560]]) {
      const s = await oeffne({ app: true, lang, breite }); const p = s.page; await beispiel(p);
      // der Satz des Urteils in der Tafel des Kampfs (derselbe Weg, urteilHtml)
      const tafelUrteil = await p.evaluate(() => ({ uv: document.querySelector("#urteilFeld .uv")?.textContent || "",
        un: document.querySelector("#urteilFeld .un")?.textContent || "" }));
      await bereich(p, "rotation");
      const r = await felder(p, "#p-rotation");
      /* Neugestaltung 28.09.: Rotationstrainer und Leinwand "Alle Einsaetze"
         entfallen (Spezifikation 3) - vorher drei Felder (Deine Rotation,
         Trainer, Diagramm), jetzt eines; ohne Gruppe bleibt "Wessen" verborgen. */
      assert(r.ids.length === 1 && r.ids[0] === "deineRot",
        `${breite}: Rotation - ein Feld: Deine Rotation`, r);
      const TITEL = lang === "de" ? ["Deine Rotation"] : ["Your rotation"];
      /* Neugestaltung 28.09., Aufgabe 4 (Luecken 3.1, Entwurf): die Ueberschrift des Feldes steht bewusst nur
         fuer Vorleser da, sichtbar nennt die Kopfzeile den Bereich - beides wird geprueft */
      const rotName = await p.evaluate(() => ({ zu: document.querySelector("#deineRot").getAttribute("aria-labelledby"),
        vh: document.querySelector("#deineRotTitel").classList.contains("vh"), kopf: document.querySelector("#bkName").textContent,
        kopfSicht: document.querySelector("#bkName").getClientRects().length > 0 }));
      assert(r.koepfe.length === 1 && r.koepfe.every((h, i) => h === TITEL[i]) && rotName.zu === "deineRotTitel" && rotName.vh &&
        rotName.kopfSicht && rotName.kopf === "Rotation",
        `${breite}: Rotation - das Feld hat seine Ueberschrift (fuer Vorleser), sichtbar nennt die Kopfzeile \u201eRotation\u201c`, { koepfe: r.koepfe, rotName });
      assert(r.autoIn === 0, `${breite}: Rotation - der Kasten Automatisch steht im ersten Feld`, r);
      assert(r.breit.every(Boolean) && r.fugen.every((f) => f >= -0.5 && f <= 1), `${breite}: Rotation - untereinander, volle Breite, 1-Punkt-Fugen`, r);
      assert(!r.quer, `${breite}: Rotation - kein Querrollen`, r);
      await bereich(p, "analysis");
      const a = await felder(p, "#p-analysis");
      assert(a.ids[0] === "analysisCall" && a.callIn === 0 && !a.callKarte && a.breit[0],
        `${breite}: Analyse - das Urteil ist das erste Feld, oben, volle Breite, nicht in der Karte`, a);
      assert(a.callRolle === "region" && a.callName === (lang === "de" ? "Urteil" : "Verdict"), `${breite}: Analyse - das Urteilsfeld hat einen Namen`, a);
      assert(a.verdictIn > 0 && a.findingsIn >= a.verdictIn && a.breit.every(Boolean) && a.fugen.every((f) => f >= -0.5 && f <= 1),
        `${breite}: Analyse - darunter Form und Befunde, Fugen 1 Punkt`, a);
      const call = await p.evaluate(() => ({ uv: document.querySelector("#analysisCall .uv")?.textContent || "",
        un: document.querySelector("#analysisCall .un")?.textContent || "" }));
      assert(!!call.uv && call.uv === tafelUrteil.uv && call.un === tafelUrteil.un, `${breite}: Analyse - der Text des Urteils wie in der Tafel (urteilHtml)`, { call, tafelUrteil });
      assert(!a.quer, `${breite}: Analyse - kein Querrollen`, a);
      assert(!s.fehler.length, `${breite}: Rotation und Analyse - keine Fehler`, s.fehler);
      await p.close();
    }
  }

  // --- 7. (Aufgabe 3) Vergleich: Felder, und je Zeile ein Balken zur Mittellinie
  {
    /* Zwei Pulls an Vulcanus, die an Stellen anders laufen: im zweiten hat
       Detonation Mark weniger, Quick Fire und Strafing mehr - so gibt es
       Zeilen auf beiden Seiten der Mitte, und in der Summe 5 % mehr. Der Stone Beetle ist der neueste
       Kampf (im Livebetrieb zaehlt er noch nicht fuer den besten Pull). */
    const VGL = [
      { target: "Vulcanus", start: at(20, 0, 0), secs: 60, scale: 1.0 },
      { target: "Vulcanus", start: at(20, 30, 0), secs: 60, scale: 1.0, je: { "Detonation Mark": 0.5, "Quick Fire": 1.4, "Strafing": 1.3 } },
      { target: "Stone Beetle", start: at(21, 0, 0), secs: 20, scale: 1.0 },
    ];
    /* Was "Woher der Unterschied kommt" zeigt: je Zeile Zahl, Pille, Balken,
       Mitte, Farbe; dazu die Farbe jeder Faehigkeit in den Spuren der
       "Rotation nebeneinander" und in der Schadenstafel des gewaehlten
       Kampfs (#bars, im Bereich Kampf; hier nur verborgen), je nach Namen. */
    const balken = (p) => p.evaluate(() => {
      const probe = document.createElement("i");
      document.body.appendChild(probe);
      const farbe = (v) => { probe.style.color = ""; probe.style.color = v; return getComputedStyle(probe).color; };
      const tok = { pos: farbe("var(--pos)"), neg: farbe("var(--neg)"), ink: farbe("var(--ink-soft)"), rest: farbe("var(--series-rest)") };
      probe.remove();
      const zahl = (s) => {
        const m = /([+\-\u2212]?)([\d.]+)(k|M)?/.exec(s.replace(/,/g, ""));
        if (!m) return NaN;
        return (m[1] === "+" || !m[1] ? 1 : -1) * parseFloat(m[2]) * (m[3] === "k" ? 1e3 : m[3] === "M" ? 1e6 : 1);
      };
      const zeilen = [...document.querySelectorAll(".cmpcontrib .crow")].map((z) => {
        const c = z.querySelector(".cdiv"), b = c?.querySelector("i");
        const cr = c?.getBoundingClientRect(), br = b?.getBoundingClientRect();
        const vor = c ? getComputedStyle(c, "::before") : null;
        const v = z.querySelector(".v");
        return {
          total: z.classList.contains("total"), n: z.querySelector(".n")?.textContent || "",
          v: v?.textContent || "", d: zahl(v?.textContent || ""), pille: v?.className || "",
          hat: !!c, versteckt: c?.getAttribute("aria-hidden") === "true", sicht: !!c && c.getClientRects().length > 0,
          mitte: cr ? cr.left + cr.width / 2 : 0, halb: cr ? cr.width / 2 : 0,
          linie: !!vor && vor.content !== "none" && vor.position === "absolute" &&
            Math.abs(parseFloat(vor.left) + parseFloat(vor.width) / 2 - (cr?.width || 0) / 2) <= 1,
          links: br ? br.left : 0, rechts: br ? br.right : 0, breite: br ? br.width : 0,
          farbe: b ? getComputedStyle(b).backgroundColor : "",
        };
      });
      const namen = [...document.querySelectorAll("#cmpRot .crn:not(.crkopf) em")].map((e) => e.textContent);
      const spuren = [...document.querySelectorAll("#cmpRot .crspur")];
      const bahn = Object.fromEntries(namen.map((n, i) => {
        const m = spuren[i]?.querySelector(".cra i, .crb i");
        return [n, m ? getComputedStyle(m).backgroundColor : ""];
      }));
      document.body.appendChild(probe);
      const tafel = Object.fromEntries([...document.querySelectorAll("#bars [data-skill]")].map((r) =>
        [r.querySelector(".nmt")?.textContent || "", farbe(getComputedStyle(r.querySelector(".fill")).getPropertyValue("--c").trim())]));
      probe.remove();
      return { zeilen, tok, bahn, tafel };
    });
    /* Die Felder des Vergleichs: die sichtbaren Bloecke von #cmpBody (ohne
       #cmpOut selbst) und von #cmpOut, ihre Fugen, Grund und Radius, volle
       Breite; dazu "Woher der Unterschied kommt" als eigenes Feld im Band. */
    const vfelder = (p) => p.evaluate(() => {
      const pn = document.querySelector("#p-compare"), pr = pn.getBoundingClientRect();
      const sicht = (e) => !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().height > 0;
      const k = [...document.querySelectorAll("#cmpBody > :not(#cmpOut), #cmpOut > *")].filter(sicht)
        .map((c) => ({ el: c, r: c.getBoundingClientRect(), cs: getComputedStyle(c) }));
      k.sort((a, b) => a.r.top - b.r.top);
      const probe = document.createElement("i"); document.body.appendChild(probe);
      probe.style.backgroundColor = "var(--comb)"; const comb = getComputedStyle(probe).backgroundColor; probe.remove();
      const woher = document.querySelector(".cmpcontrib"), wr = woher?.getBoundingClientRect();
      const vor = woher?.previousElementSibling?.getBoundingClientRect();
      return {
        ids: k.map((x) => x.el.id || x.el.className),
        breit: k.map((x) => Math.abs(x.r.left - pr.left) < 1 && Math.abs(x.r.right - pr.right) < 1),
        fugen: k.slice(1).map((x, i) => +(x.r.top - k[i].r.bottom).toFixed(2)),
        radien: k.map((x) => x.cs.borderTopLeftRadius), grund: k.map((x) => x.cs.backgroundColor === comb),
        woherBreit: !!wr && Math.abs(wr.left - pr.left) < 1 && Math.abs(wr.right - pr.right) < 1,
        woherFuge: !!woher && /inset/.test(getComputedStyle(woher).boxShadow) && /0px 1px 0px/.test(getComputedStyle(woher).boxShadow),
        woherUnter: !!wr && !!vor && wr.top >= vor.bottom,
        quer: document.documentElement.scrollWidth > innerWidth,
      };
    });
    const pruefe = (b, wo) => {
      const z = b.zeilen, sk = z.filter((x) => !x.total), tot = z.find((x) => x.total);
      assert(z.length >= 3 && !!tot && z.every((x) => x.hat && x.sicht && x.versteckt),
        `${wo}: jede Zeile hat einen Balken (.cdiv), fuer Vorleser verborgen`, z);
      assert(z.every((x) => x.linie), `${wo}: jeder Balken hat die Mittellinie`, z.map((x) => x.linie));
      assert(sk.some((x) => x.d < 0) && sk.some((x) => x.d > 0), `${wo}: Zeilen auf beiden Seiten`, sk.map((x) => x.v));
      assert(z.filter((x) => x.d < 0).every((x) => Math.abs(x.rechts - x.mitte) <= 1 && x.links < x.mitte - 1),
        `${wo}: weniger - der Balken liegt links der Mitte`, z.filter((x) => x.d < 0));
      assert(z.filter((x) => x.d > 0).every((x) => Math.abs(x.links - x.mitte) <= 1 && x.rechts > x.mitte + 1),
        `${wo}: mehr - der Balken liegt rechts der Mitte`, z.filter((x) => x.d > 0));
      const max = Math.max(...z.map((x) => Math.abs(x.d)));
      const laengste = z.find((x) => Math.abs(x.d) === max);
      assert(Math.abs(laengste.breite - laengste.halb) <= 1, `${wo}: die laengste Zeile hat die volle halbe Breite`, laengste);
      // im Verhaeltnis der Abstaende; die Zahl daneben ist gerundet (fmt), darum 4 % Spiel
      assert(z.every((x) => Math.abs(x.breite / laengste.halb - Math.abs(x.d) / max) <= 0.04 + 2 / laengste.halb),
        `${wo}: die anderen im Verhaeltnis ihrer Abstaende`, z.map((x) => [x.v, +(x.breite / laengste.halb).toFixed(3)]));
      assert(z.every((x) => x.farbe !== b.tok.pos && x.farbe !== b.tok.neg), `${wo}: kein --pos/--neg an den Balken`, z.map((x) => x.farbe));
      assert(tot.farbe === b.tok.ink, `${wo}: die Gesamtzeile in --ink-soft`, { farbe: tot.farbe, ink: b.tok.ink });
      // eine Farbe je Faehigkeit: Balken = Spur der Rotation nebeneinander = Schadenstafel des gewaehlten Kampfs
      assert(sk.every((x) => !!x.farbe && x.farbe === b.bahn[x.n] && x.farbe === b.tafel[x.n]),
        `${wo}: jede Faehigkeit in derselben Farbe wie ihre Spur und ihre Zeile in der Schadenstafel`,
        { zeilen: sk.map((x) => [x.n, x.farbe]), bahn: b.bahn, tafel: b.tafel });
      assert(new Set(Object.values(b.bahn)).size === Object.keys(b.bahn).length,
        `${wo}: jede Spur hat ihre eigene Farbe`, b.bahn);
    };
    const vergleichFelder = (f, wo) => {
      assert(f.ids.length >= 4 && f.breit.every(Boolean) && f.fugen.every((x) => x >= -0.5 && x <= 1),
        `${wo}: die Bloecke sind Felder - untereinander, volle Breite, 1-Punkt-Fugen`, f);
      assert(f.radien.every((r) => r === "0px") && f.grund.every(Boolean), `${wo}: Felder ohne Radius, Grund --comb`, f);
      assert(f.woherBreit && f.woherFuge && f.woherUnter, `${wo}: "Woher der Unterschied kommt" ist ein eigenes Feld mit Fuge`, f);
      assert(!f.quer, `${wo}: kein Querrollen`, f);
    };
    /* Gegen den besten Pull (Luecken 5.5): je Faehigkeit eine Zeile .vr - Name,
       Balken links (.vl, weniger), Zahl (.vw), Balken rechts (.vrr, mehr). */
    const balkenPaar = (p) => p.evaluate(() => {
      const probe = document.createElement("i");
      document.body.appendChild(probe);
      const farbe = (v) => { probe.style.color = ""; probe.style.color = v; return getComputedStyle(probe).color; };
      const tok = { pos: farbe("var(--pos)"), neg: farbe("var(--neg)"), text: farbe("var(--text)") };
      const zahl = (s) => {
        const m = /([+\-\u2212]?)([\d.]+)(k|M)?/.exec(s.replace(/,/g, ""));
        if (!m) return NaN;
        return (m[1] === "+" || !m[1] ? 1 : -1) * parseFloat(m[2]) * (m[3] === "k" ? 1e3 : m[3] === "M" ? 1e6 : 1);
      };
      const zeilen = [...document.querySelectorAll("#cmpJe .vr")].map((z) => {
        const vl = z.querySelector(".vl"), vr = z.querySelector(".vrr"), vw = z.querySelector(".vw");
        const b = z.querySelector(".vl i, .vrr i");
        const rl = vl?.getBoundingClientRect(), rr = vr?.getBoundingClientRect(), rw = vw?.getBoundingClientRect(), rb = b?.getBoundingClientRect();
        const vor = vw ? getComputedStyle(vw, "::before") : null, nach = vw ? getComputedStyle(vw, "::after") : null;
        return {
          n: z.querySelector(".vnn")?.textContent || "", v: vw?.textContent || "", d: zahl(vw?.textContent || ""),
          hat: !!vl && !!vr, versteckt: vl?.getAttribute("aria-hidden") === "true" && vr?.getAttribute("aria-hidden") === "true",
          sicht: !!b && b.getClientRects().length > 0,
          mitte: !!vor && !!nach && vor.position === "absolute" && nach.position === "absolute" && vor.content !== "none" && nach.content !== "none" &&
            parseFloat(vor.width) === 1 && parseFloat(nach.width) === 1,
          links: rb ? rb.left : 0, rechts: rb ? rb.right : 0, breite: rb ? rb.width : 0,
          vlRechts: rl ? rl.right : 0, vrLinks: rr ? rr.left : 0, halb: rl ? rl.width : 0, wLinks: rw ? rw.left : 0, wRechts: rw ? rw.right : 0,
          farbe: b ? getComputedStyle(b).backgroundColor : "", wert: vw ? getComputedStyle(vw).color : "",
        };
      });
      const namen = [...document.querySelectorAll("#cmpRot .crn:not(.crkopf) em")].map((e) => e.textContent);
      const spuren = [...document.querySelectorAll("#cmpRot .crspur")];
      const bahn = Object.fromEntries(namen.map((n, i) => {
        const m = spuren[i]?.querySelector(".cra i, .crb i");
        return [n, m ? getComputedStyle(m).backgroundColor : ""];
      }));
      const tafel = Object.fromEntries([...document.querySelectorAll("#bars [data-skill]")].map((r) =>
        [r.querySelector(".nmt")?.textContent || "", farbe(getComputedStyle(r.querySelector(".fill")).getPropertyValue("--c").trim())]));
      probe.remove();
      return { zeilen, tok, bahn, tafel };
    });
    const pruefePaar = (b, wo) => {
      const z = b.zeilen;
      // alle Faehigkeiten stehen da, auch eine ohne Abstand (Decisive Sniping): sie hat keinen Balken
      assert(z.filter((x) => x.d).length >= 3 && z.every((x) => x.hat && x.versteckt && x.sicht === !!x.d),
        `${wo}: jede Zeile mit Abstand hat einen Balken (.vl/.vrr), eine ohne keinen; fuer Vorleser verborgen`, z);
      assert(z.length >= 3 && z.every((x) => x.mitte), `${wo}: jede Zahl steht in der Mitte zwischen zwei Linien`, z.map((x) => x.mitte));
      assert(z.some((x) => x.d < 0) && z.some((x) => x.d > 0), `${wo}: Zeilen auf beiden Seiten`, z.map((x) => x.v));
      assert(z.some((x) => x.d < 0) && z.filter((x) => x.d < 0).every((x) => Math.abs(x.rechts - x.vlRechts) <= 1 && x.vlRechts <= x.wLinks && x.links < x.rechts - 1),
        `${wo}: weniger - der Balken endet links an der Zahl`, z.filter((x) => x.d < 0));
      assert(z.some((x) => x.d > 0) && z.filter((x) => x.d > 0).every((x) => Math.abs(x.links - x.vrLinks) <= 1 && x.vrLinks >= x.wRechts && x.rechts > x.links + 1),
        `${wo}: mehr - der Balken beginnt rechts an der Zahl`, z.filter((x) => x.d > 0));
      const max = Math.max(...z.map((x) => Math.abs(x.d)));
      const laengste = z.find((x) => Math.abs(x.d) === max);
      assert(!!laengste && Math.abs(laengste.breite - laengste.halb) <= 1, `${wo}: die laengste Zeile hat die volle halbe Breite`, laengste);
      // im Verhaeltnis der Abstaende; die Zahl daneben ist gerundet (fmt), darum 4 % Spiel
      assert(!!laengste && z.every((x) => Math.abs(x.breite / laengste.halb - Math.abs(x.d) / max) <= 0.04 + 2 / laengste.halb),
        `${wo}: die anderen im Verhaeltnis ihrer Abstaende`, z.map((x) => [x.v, laengste && +(x.breite / laengste.halb).toFixed(3)]));
      assert(z.length >= 3 && z.every((x) => x.farbe !== b.tok.pos && x.farbe !== b.tok.neg), `${wo}: kein --pos/--neg an den Balken`, z.map((x) => x.farbe));
      assert(z.length >= 3 && z.every((x) => x.wert === b.tok.text), `${wo}: die Zahlen in --text, ohne Rot und Gruen`, { werte: z.map((x) => x.wert), text: b.tok.text });
      assert(z.filter((x) => x.d).length >= 3 && z.filter((x) => x.d).every((x) => !!x.farbe && x.farbe === b.bahn[x.n] && x.farbe === b.tafel[x.n]),
        `${wo}: jede Faehigkeit in derselben Farbe wie ihre Spur und ihre Zeile in der Schadenstafel`,
        { zeilen: z.map((x) => [x.n, x.farbe]), bahn: b.bahn, tafel: b.tafel });
      assert(new Set(Object.values(b.bahn)).size === Object.keys(b.bahn).length && Object.keys(b.bahn).length >= 3,
        `${wo}: jede Spur hat ihre eigene Farbe`, b.bahn);
    };
    /* Die Felder gegen den besten Pull: dieselben Proben wie vergleichFelder; die
       Liste je Faehigkeit ist selbst ein Feld (#cmpJe) mit Fuge unter dem vorigen. */
    const vergleichFelderPaar = (f, wo) => {
      assert(f.ids.length >= 4 && f.breit.every(Boolean) && f.fugen.every((x) => x >= -0.5 && x <= 1),
        `${wo}: die Bloecke sind Felder - untereinander, volle Breite, 1-Punkt-Fugen`, f);
      assert(f.radien.every((r) => r === "0px") && f.grund.every(Boolean), `${wo}: Felder ohne Radius, Grund --comb`, f);
      const i = f.ids.indexOf("cmpJe");
      assert(i > 0 && f.breit[i] && f.fugen[i - 1] >= -0.5 && f.fugen[i - 1] <= 1, `${wo}: die Liste je Faehigkeit ist ein eigenes Feld mit Fuge`, f);
      assert(!f.quer, `${wo}: kein Querrollen`, f);
    };
    for (const [lang, breite] of [["en", 1280], ["de", 560]]) {
      const s = await oeffne({ app: true, lang, breite, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(VGL) } });
      const p = s.page;
      await p.evaluate(() => document.querySelector("#btnWatch").click());
      await p.waitForFunction(() => document.querySelectorAll("#fightList .fight").length >= 3, null, { timeout: 8000 });
      await p.evaluate(() => document.querySelector('#fightList .fight[data-i="1"]').click());
      await p.waitForFunction(() => !document.querySelector("#app").hidden);
      await p.waitForTimeout(300);
      /* a) zwei Kaempfe des Logs, angehakt in der Auswahl: der spaetere zuerst,
         er ist der Bezug. Andersherum waere es genau "bester Pull gegen diesen
         Kampf" (gegenBestAktiv) - der kommt unter b).
         Folgt Entwurf (Neugestaltung 28.09., Luecken 5.1): der Vergleich oeffnet
         gegen den besten Pull, die Auswahl steht hinter "Andere Kaempfe waehlen".
         Darum erst alle Haken ab (die Zeilen je Schritt frisch gesucht, die
         Liste wird beim Wechsel neu gebaut), dann von Hand wie bisher. */
      await bereich(p, "compare");
      await p.evaluate(() => {
        const zeilen = () => [...document.querySelectorAll("#cmpPick .run")];
        for (let n = 0; n < 5; n++) zeilen().find((r) => r.querySelector("input").checked)?.querySelector("input").click();
        const uhr = (r) => (/\d\d:\d\d(:\d\d)?/.exec(r.textContent) || [""])[0];
        const reihe = zeilen().filter((r) => /Vulcanus/.test(r.textContent)).map(uhr).sort((a, b) => b.localeCompare(a));
        for (const u of reihe) zeilen().find((r) => uhr(r) === u)?.querySelector("input").click();
      });
      await p.waitForTimeout(300);
      const b2 = await balken(p);
      pruefe(b2, `${breite} zwei Kaempfe`);
      // die Pillen bleiben (Variante C): gruen und rot bei zwei Kaempfen desselben Bosses
      assert(b2.zeilen.filter((x) => !x.total).every((x) => /\bdelta\b/.test(x.pille) && /\b(good|bad)\b/.test(x.pille)),
        `${breite} zwei Kaempfe: die Pillen der Zahlen bleiben`, b2.zeilen.map((x) => x.pille));
      vergleichFelder(await vfelder(p), `${breite} zwei Kaempfe`);
      // b) gegen den besten Pull: der Knopf im Kampf
      await bereich(p, "timeline");
      await p.evaluate(() => document.querySelector("#btnBestPull").click());
      await p.waitForTimeout(400);
      assert(await p.evaluate(() => !!document.querySelector("#cmpLead")), `${breite}: gegen den besten Pull steht der Antwortsatz`);
      /* Folgt Entwurf (Neugestaltung 28.09., Luecken 5.5/5.6): gegen den besten Pull
         ist "Woher der Unterschied kommt" die Liste aller Faehigkeiten (#cmpJe .vr),
         der Balken zur Mitte liegt links oder rechts der Zahl. Dieselben Proben:
         Balken je Zeile, fuer Vorleser verborgen, Mitte, beide Seiten, laengste volle
         halbe Breite, im Verhaeltnis, kein --pos/--neg, Farbe = Spur = Schadenstafel,
         eigene Farbe je Spur; statt der Gesamtzeile in --ink-soft die Zahlen in
         --text (die Summe steht im Satz, Abschnitt 5 in test-neu-page). */
      pruefePaar(await balkenPaar(p), `${breite} bester Pull`);
      vergleichFelderPaar(await vfelder(p), `${breite} bester Pull`);
      assert(!s.fehler.length, `${breite} Vergleich: keine Fehler`, s.fehler);
      await p.close();
    }
  }

  // --- 8. (Aufgabe 4) Verlauf: Liste und Detail als Felder, Punktediagramm, Spalte Build
  /* Folgt Entwurf (Neugestaltung 28.09., Luecken 6): statt Bossliste und Detail
     nebeneinander stehen das Diagramm (#histPlotFeld) und die Liste "Kaempfe"
     (#histDetail) als zwei Felder untereinander; x ist das Datum (6.2), der
     Median steht in der Legende, der beste ist gold, die Wahl traegt den Ring;
     die Spalte Build steht an vierter Stelle (6.7), der Boss ist ein
     Auswahlfeld (6.5). Die Proben pruefen dasselbe mindestens so streng. */
  {
    /* Was der Verlauf zeigt: die beiden Felder, das SVG, die Kreise mit ihren
       Zahlen, Linie und Legende, die Zeilen der Tabelle, der Fokus. */
    const verlauf = (p) => p.evaluate(() => {
      const q = (x) => document.querySelector(x);
      const probe = document.createElement("i"); document.body.appendChild(probe);
      const farbe = (v) => { probe.style.color = ""; probe.style.color = v; return getComputedStyle(probe).color; };
      const tok = { gold: farbe("var(--gold-ink)"), comb: farbe("var(--comb)"), pick: farbe("var(--pick)") };
      probe.remove();
      const li = q("#histPlotFeld"), de = q("#histDetail");
      const lr = li.getBoundingClientRect(), dr = de.getBoundingClientRect();
      const svg = q("#histPlotFeld svg");
      const kreise = [...document.querySelectorAll("#histPlotFeld svg circle.hp")].map((c) => {
        const r = c.getBoundingClientRect();
        return { k: c.dataset.k, at: +c.dataset.at, dps: +c.dataset.dps, dur: +c.dataset.dur, cx: +c.getAttribute("cx"), cy: +c.getAttribute("cy"),
          r: +c.getAttribute("r"), cur: c.classList.contains("hpcur"), fill: getComputedStyle(c).fill, stroke: getComputedStyle(c).stroke,
          mx: r.left + r.width / 2, my: r.top + r.height / 2, rechts: r.right };
      });
      const med = q("#histPlotFeld svg .hpmed");
      const leg = [...document.querySelectorAll("#histPlotFeld .vlg > span")].map((x) => x.textContent.trim());
      const ring = q("#histPlotFeld svg .hpring");
      const kopf = [...document.querySelectorAll("#histDetail .histtab thead th")].map((th) => th.textContent);
      const zeilen = [...document.querySelectorAll("#histDetail .histtab tbody tr")].map((tr) => ({
        k: tr.dataset.k, sel: tr.getAttribute("aria-selected"), tab: tr.tabIndex, cur: tr.classList.contains("cur"), best: tr.classList.contains("best"),
        zellen: [...tr.cells].map((c) => c.textContent) }));
      return {
        li: { left: lr.left, right: lr.right, top: lr.top, bottom: lr.bottom, grund: getComputedStyle(li).backgroundColor, rad: getComputedStyle(li).borderTopLeftRadius },
        de: { left: dr.left, right: dr.right, top: dr.top, bottom: dr.bottom, grund: getComputedStyle(de).backgroundColor, rad: getComputedStyle(de).borderTopLeftRadius },
        tok, rolle: svg?.getAttribute("role"), name: svg?.getAttribute("aria-label") || "",
        kreise, med: med ? { wert: +med.dataset.wert, y1: +med.getAttribute("y1"), y2: +med.getAttribute("y2"), dash: getComputedStyle(med).strokeDasharray } : null,
        medText: leg.find((x) => /^Median /.test(x)) || "", bestText: leg.find((x) => x === "bester" || x === "best") || "",
        spitze: q("#histPlotFeld svg circle.hpspitze")?.dataset.k ?? null,
        ring: ring ? { k: ring.dataset.k, stroke: getComputedStyle(ring).stroke } : null,
        kopf, zeilen, aktiv: document.activeElement?.closest?.("#histDetail tbody tr")?.dataset.k ?? null,
        quer: document.documentElement.scrollWidth > innerWidth,
      };
    });
    const radius = (d) => 3 + Math.min(4, Math.sqrt(d / 30) * 1.6);
    for (const [lang, breite] of [["en", 1280], ["de", 560]]) {
      const s = await oeffne({ app: true, lang, breite, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(VER) } });
      const p = s.page;
      await laden(p);
      /* Neugestaltung 28.09. (DECISION 2.4, Entwurf Bereich Kampf): die Skala
         im Kampf entfiel; die leise Zeile #hHist traegt dieselben Zahlen
         ("sonst" = Median, dieser Pull) am Element. */
      const ein = await p.evaluate(() => { const h = document.querySelector("#hHist");
        return { sonst: +h.dataset.median || 0, dieser: +h.dataset.dps || 0 }; });
      assert(ein.sonst > 0 && ein.dieser > 0, `${breite}: im Kampf steht die Einordnung mit "sonst"`, ein);
      await bereich(p, "history");
      await p.waitForTimeout(300);
      const v = await verlauf(p);
      const wo = `${breite} Verlauf`;
      // Felder: das Diagramm oben, die Liste darunter, gleich breit, 1-Punkt-Fuge (folgt Entwurf 6.5)
      assert(Math.abs(v.li.left - v.de.left) <= 1 && Math.abs(v.li.right - v.de.right) <= 1 && v.de.top - v.li.bottom >= -0.5 && v.de.top - v.li.bottom <= 1,
        `${wo}: Diagramm und Liste als zwei Felder untereinander, 1-Punkt-Fuge`, v);
      assert(v.li.grund === v.tok.comb && v.de.grund === v.tok.comb && v.li.rad === "0px" && v.de.rad === "0px",
        `${wo}: beide Felder ohne Radius, Grund --comb`, v);
      // das Diagramm
      assert(v.rolle === "img" && /Vulcanus/.test(v.name) && /\b4\b/.test(v.name), `${wo}: SVG role=img mit Namen (Boss, Anzahl)`, v.name);
      assert(v.kreise.length === 4, `${wo}: je Kampf ein Kreis`, v.kreise.length);
      // folgt Entwurf 6.2: x ist das Datum - die Abstaende im Verhaeltnis der Zeit (die vier Pulls liegen je 30 min auseinander)
      const dx = v.kreise.slice(1).map((c, i) => (c.cx - v.kreise[i].cx) / (c.at - v.kreise[i].at));
      assert(dx.length === 3 && dx.every((d) => d > 0 && Math.abs(d - dx[0]) < 1e-9), `${wo}: Abstaende im Verhaeltnis der Zeit`, dx);
      assert(v.kreise.length && v.kreise.every((c) => Math.abs(c.r - radius(c.dur)) < 0.01), `${wo}: Groesse nach der Dauer`, v.kreise.map((c) => [c.dur, c.r]));
      const hoechster = v.kreise.reduce((a, c) => (c.dps > a.dps ? c : a), { dps: -1, cy: 0, my: 0, rechts: 0 });
      assert(v.kreise.length && v.kreise.every((c) => c === hoechster || c.cy > hoechster.cy), `${wo}: der hoechste DPS steht am hoechsten`, v.kreise);
      // die Linie ist der Median aller Kaempfe am Boss im Zeitraum: mitte() der Kreise, dieselbe Zahl wie in der Legende
      const ds = v.kreise.map((c) => c.dps).sort((a, b) => a - b), h = ds.length >> 1;
      const mitteDps = ds.length % 2 ? ds[h] : (ds[h - 1] + ds[h]) / 2;
      const medZahl = v.medText.replace(/^\S+\s/, "");
      assert(!!v.med && Math.abs(v.med.wert - mitteDps) < 1e-6 && v.med.y1 === v.med.y2 && v.med.dash !== "none",
        `${wo}: die Medianlinie (gestrichelt) auf dem Median aller Kaempfe am Boss`, { med: v.med, mitteDps });
      const zurueck = (x) => /k$/.test(x) ? parseFloat(x) * 1e3 : parseInt(x.replace(/[.,]/g, ""), 10);
      assert(!!medZahl && Math.abs(zurueck(medZahl) - mitteDps) <= 50, `${wo}: dieselbe Zahl wie die Linie in der Legende (gerundet)`, { med: v.medText, mitteDps });
      assert(v.medText.startsWith("Median "), `${wo}: die Linie heisst Median`, v.medText);
      assert(v.name.includes("Median " + medZahl) && !/usual|sonst/.test(v.name), `${wo}: der Name nennt den Median, nicht "sonst"`, { name: v.name, med: v.medText });
      // nur ein Build am Boss: dann rechnet "sonst" im Kampf ueber dieselben Kaempfe - zusaetzliche Probe, keine Gleichsetzung
      assert(!!v.med && Math.abs(v.med.wert - ein.sonst) < 1e-6,
        `${wo}: ein Build am Boss - "sonst" im Kampf hat hier denselben Wert`, { med: v.med, sonst: ein.sonst });
      // folgt Entwurf 6: "bester" steht in der Legende, der hoechste Kreis ist gold
      assert(v.bestText === (lang === "de" ? "bester" : "best") && v.spitze === hoechster.k && hoechster.fill === v.tok.gold,
        `${wo}: "bester" ist der hoechste Kreis, in Gold, und steht in der Legende`, { best: v.bestText, spitze: v.spitze, hoechster });
      const dies = v.kreise.filter((c) => c.cur);
      assert(dies.length === 1 && Math.abs(dies[0].dps - ein.dieser) < 1e-6 && dies[0].fill !== v.tok.gold && v.ring?.k === dies[0].k,
        `${wo}: dieser Kampf (der gewaehlte des Logs) ist ohne eigene Wahl der gewaehlte (Ring), nicht gold`, { dies, dieser: ein.dieser, ring: v.ring });
      assert(v.kreise.filter((c) => c.k !== v.spitze).every((c) => c.fill !== v.tok.gold && c.stroke !== v.tok.gold),
        `${wo}: sonst kein Gold an den Kreisen`, v.kreise);
      // die Tabelle mit der Spalte Build
      assert(v.kopf.length === 5 && v.kopf[3] === "Build", `${wo}: die Tabelle hat die Spalte Build (folgt Entwurf 6.7: an vierter Stelle)`, v.kopf);
      /* folgt Aufgabe 12 (29.09.): der Bereich Builds zeigt Links zu Questlog, keine erkannten Builds mehr - die Namen
         kommen darum aus dem, was die Seite in boro-builds.json schreibt: ohne eigenen Namen "Paar Nummer" wie
         bauNameVon (47-builds.ts), die Waffen in der Sprache der Seite, die Nummer je Paar nach dem ersten Kampf */
      for (const ende = Date.now() + 8000; Date.now() < ende && !Object.keys(s.baue).length; ) await p.waitForTimeout(100);
      const DE = { Longbow: "Langbogen", Crossbow: "Armbrust", Dagger: "Dolch", Staff: "Stab" };
      const paar = (w) => w.filter(Boolean).map((x) => (lang === "de" ? DE[x] || x : x)).join("/");
      const ids = Object.keys(s.baue), nummer = (id) => ids.filter((o) => paar(s.baue[o].weapons) === paar(s.baue[id].weapons) &&
        (s.baue[o].first < s.baue[id].first || (s.baue[o].first === s.baue[id].first && o <= id))).length;
      const baue = ids.map((id) => s.baue[id].name || paar(s.baue[id].weapons) + " " + nummer(id));
      assert(v.zeilen.length === 4 && baue.length >= 1 && v.zeilen.every((z) => baue.includes(z.zellen[3])),
        `${wo}: je Zeile der Name des gespeicherten Builds`, { zeilen: v.zeilen.map((z) => z.zellen), baue });
      assert(v.zeilen.filter((z) => z.cur).length === 1 && v.kreise.find((c) => c.cur)?.k === v.zeilen.find((z) => z.cur)?.k,
        `${wo}: dieselbe Zeile ist dieser Kampf`, v.zeilen);
      // Auswahl: genau eine Zeile, ihr Kreis mit Ring
      assert(v.zeilen.filter((z) => z.sel === "true").length === 1 && v.zeilen.every((z) => z.sel === "true" || z.sel === "false") &&
        !!v.ring && v.ring.k === v.zeilen.find((z) => z.sel === "true")?.k && v.ring.stroke === v.tok.pick,
        `${wo}: eine Zeile gewaehlt, ihr Kreis hat den Ring (--pick)`, { zeilen: v.zeilen, ring: v.ring });
      if (v.zeilen.length === 4 && v.kreise.length === 4) {
        // Klick auf eine Zeile: Zeile gewaehlt, Ring am Kreis, Fokus auf der Zeile
        const andere = v.zeilen.find((z) => z.sel !== "true" && !z.cur);
        await p.click(`#histDetail tbody tr[data-k="${andere.k}"] td:nth-child(2)`);
        await p.waitForTimeout(150);
        let w = await verlauf(p);
        assert(w.zeilen.find((z) => z.k === andere.k).sel === "true" && w.zeilen.filter((z) => z.sel === "true").length === 1 &&
          w.ring?.k === andere.k && w.aktiv === andere.k,
          `${wo}: Klick auf eine Zeile hebt ihren Kreis hervor, der Fokus bleibt auf der Zeile`, { zeilen: w.zeilen, ring: w.ring, aktiv: w.aktiv });
        assert(w.zeilen.find((z) => z.k === andere.k).tab === 0 && w.zeilen.filter((z) => z.tab === 0).length === 1,
          `${wo}: die gewaehlte Zeile ist der Tabstopp`, w.zeilen.map((z) => z.tab));
        // Klick auf einen Kreis: seine Zeile gewaehlt und im Fokus
        const kreis = w.kreise.find((c) => c.k !== andere.k && !c.cur);
        await p.mouse.click(kreis.mx, kreis.my);
        await p.waitForTimeout(150);
        w = await verlauf(p);
        assert(w.zeilen.find((z) => z.k === kreis.k).sel === "true" && w.ring?.k === kreis.k && w.aktiv === kreis.k,
          `${wo}: Klick auf einen Kreis waehlt seine Zeile, Fokus auf der Zeile`, { zeilen: w.zeilen, ring: w.ring, aktiv: w.aktiv });
        // Tastatur: Pfeil bewegt den Fokus, Enter waehlt
        const idx = w.zeilen.findIndex((z) => z.k === kreis.k);
        const ziel = w.zeilen[idx === w.zeilen.length - 1 ? idx - 1 : idx + 1];
        await p.keyboard.press(idx === w.zeilen.length - 1 ? "ArrowUp" : "ArrowDown");
        await p.waitForTimeout(100);
        w = await verlauf(p);
        assert(w.aktiv === ziel.k && w.zeilen.find((z) => z.k === kreis.k).sel === "true", `${wo}: Pfeil bewegt den Fokus, die Wahl bleibt`, { aktiv: w.aktiv, ziel: ziel.k });
        await p.keyboard.press("Enter");
        await p.waitForTimeout(150);
        w = await verlauf(p);
        assert(w.zeilen.find((z) => z.k === ziel.k).sel === "true" && w.ring?.k === ziel.k && w.aktiv === ziel.k,
          `${wo}: Enter waehlt die Zeile, Ring am Kreis, Fokus bleibt`, { zeilen: w.zeilen, ring: w.ring, aktiv: w.aktiv });
        assert(!w.quer, `${wo}: kein Querrollen`, w);
        if (breite === 1280) {
          // schmaler: weiter untereinander, das Diagramm zeichnet sich neu
          await p.setViewportSize({ width: 1000, height: 860 });
          await p.waitForTimeout(400);
          const g = await verlauf(p);
          assert(Math.abs(g.li.left - g.de.left) <= 1 && g.de.top - g.li.bottom >= -0.5 && g.de.top - g.li.bottom <= 1,
            "1000 Verlauf: untereinander", { li: g.li, de: g.de });
          assert(g.kreise.length === 4 && g.zeilen.find((z) => z.sel === "true")?.k === ziel.k && !g.quer,
            "1000 Verlauf: Diagramm und Wahl bleiben, kein Querrollen", g.zeilen);
        }
      }
      assert(!s.fehler.length, `${wo}: keine Fehler`, s.fehler);
      await p.close();
    }
    // Fokus in der Bossliste: liste.innerHTML schreibt nur bei Aenderung (wie
    // detZuletzt beim Detail), sonst faellt der Fokus einer Bosszeile auf
    // body zurueck, sobald ein Live-Takt (renderAll bei offenem Verlauf) die
    // Liste neu schreibt.
    {
      const helfer = { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(VER) };
      const s = await oeffne({ app: true, helfer });
      const p = s.page;
      await laden(p);
      await bereich(p, "history");
      await p.waitForTimeout(300);
      // Stone Beetle hat nur einen Pull und steht darum nicht in der Auswahl
      // (histTargets zeigt nur Bosse mit mehr als einem Kampf) - Vulcanus reicht.
      // Folgt Entwurf (Luecken 6.5): der Boss ist ein Auswahlfeld, der Fokus liegt darauf.
      const zeilen0 = await p.evaluate(() => [...document.querySelectorAll("#histBoss option")].map((b) => b.value));
      assert(zeilen0.length >= 1, "Fokus Bossliste: Vorbedingung, mindestens ein Boss in der Auswahl", zeilen0);
      const vulcData = zeilen0.find((z) => /Vulcanus/.test(z));
      await p.evaluate(() => document.querySelector("#histBoss").focus());
      const vorFokus = await p.evaluate(() => document.activeElement?.id === "histBoss" ? document.activeElement.value : null);
      assert(vorFokus === vulcData, "Fokus Bossliste: die Vulcanus-Zeile hat den Fokus", { vorFokus, vulcData });
      // Live-Takt ohne Aenderung: ein Themewechsel ruft renderAll() bei offenem Verlauf, wie oben bei #bereichKopf
      await p.evaluate(() => {
        const th = document.documentElement.dataset.theme || "dark";
        document.querySelector(`#themeRow [data-theme="${th}"]`).click();
      });
      await p.waitForTimeout(150);
      const nachTakt = await p.evaluate(() => document.activeElement?.id === "histBoss" ? document.activeElement.value : null);
      assert(nachTakt === vulcData, "Fokus Bossliste: ein Neuzeichnen ohne Aenderung laesst den Fokus auf der Zeile", { vorFokus, nachTakt });
      // eine echte Aenderung: ein weiterer Pull am selben Boss (Vulcanus) kommt ins Log
      const vorherAnzahl = await p.evaluate(() => document.querySelectorAll("#fightList .fight").length);
      helfer.text = logText([...VER, { target: "Vulcanus", start: at(23, 0, 0), secs: 45, scale: 1.5 }]);
      await p.waitForFunction((n) => document.querySelectorAll("#fightList .fight").length > n, vorherAnzahl, { timeout: 10000 });
      await p.waitForTimeout(500);
      const nachAenderung = await p.evaluate(() => document.activeElement?.id === "histBoss" ? document.activeElement.value : null);
      assert(nachAenderung === vulcData, "Fokus Bossliste: nach einem neuen Kampf am selben Boss bleibt der Fokus auf der Zeile", { vorFokus, nachAenderung });
      assert(!s.fehler.length, "Fokus Bossliste: keine Fehler", s.fehler);
      await p.close();
    }
    // ein Kampf aus der Zeit vor dem Bautagebuch (ohne b): in der Spalte Build ein Strich
    {
      /* zwei alte Kaempfe mit derselben, hoechsten DPS: "bester" in Diagramm
         und Tabelle ist derselbe, der erste (wie verlauf-core) */
      const alt = { "alt.txt": { size: 1, fights: [
        { name: "Vulcanus", dps: 99999, dmg: 5999940, dur: 60, at: Date.UTC(2026, 8, 1, 20, 0, 0) },
        { name: "Vulcanus", dps: 99999, dmg: 5999940, dur: 60, at: Date.UTC(2026, 8, 2, 20, 0, 0) }] } };
      const s = await oeffne({ app: true, config: { logIndex: alt }, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(VER) } });
      const p = s.page;
      await laden(p);
      await bereich(p, "history");
      await p.waitForTimeout(300);
      const v = await verlauf(p);
      const leer = v.zeilen.filter((z) => z.zellen[3] === "\u2013");
      assert(v.zeilen.length === 6 && leer.length === 2 && leer.every((z) => z.k === "0" || z.k === "1"), "ohne Build: ein Strich in der Spalte Build", v.zeilen.map((z) => z.zellen));
      assert(v.kreise.length === 6 && !!v.med, "ohne Build: die Kaempfe stehen im Diagramm", v.kreise.length);
      const beste = v.zeilen.filter((z) => z.best).map((z) => z.k);
      assert(beste.length === 1 && beste[0] === "0" && v.spitze === "0", "Gleichstand: bester in Tabelle und Diagramm derselbe, der erste", { beste, spitze: v.spitze });
      assert(!s.fehler.length, "ohne Build: keine Fehler", s.fehler);
      await p.close();
    }
  }

  // --- 9. (Aufgabe 5) Querschnitt: drei Themen x zwei Sprachen, Kontrast, Zoom, 560 Punkt, Tab-Reihenfolge
  {
    const NAMEN = { en: Object.fromEntries(BEREICHE),
      de: { rotation: "Rotation", analysis: "Analyse", compare: "Vergleich", history: "Verlauf", party: "Gruppe", weapons: "Waffen", setup: "Log-Einrichtung" } };
    /* Kontrast wie test-rahmen-page.mjs (WCAG, relative Leuchtdichte). Der
       Grund ist der erste deckende Grund der Vorfahren, halbdurchsichtige
       Gruende und Schrift werden darueber gemischt. */
    const kontraste = (p) => p.evaluate(() => {
      const teile = (c) => { const m = (c || "").match(/[\d.]+/g) || []; return m.length < 3 ? null : [+m[0], +m[1], +m[2], m.length > 3 ? +m[3] : 1]; };
      const misch = (o, u) => [0, 1, 2].map((i) => o[i] * o[3] + u[i] * (1 - o[3])).concat(1);
      const grund = (e) => {
        const schichten = [];
        for (let x = e; x; x = x.parentElement) {
          const c = teile(getComputedStyle(x).backgroundColor);
          if (c && c[3] > 0) { schichten.push(c); if (c[3] >= 1) break; }
        }
        let g = [255, 255, 255, 1];
        for (const c of schichten.reverse()) g = misch(c, g);
        return g;
      };
      const lum = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const verh = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const miss = (e, svg) => {
        const g = grund(svg ? e.closest("svg") : e);
        const f = teile(getComputedStyle(e)[svg ? "fill" : "color"]);
        return f ? +verh(misch(f, g), g).toFixed(2) : 0;
      };
      const sicht = (e) => !!e && e.getClientRects().length > 0 && (e.textContent || "").trim() !== "";
      const kopf = ["#bkName", "#bkBossName", "#bkZeit", "#bkDps", "#bkSpeichern", "#bkCtx"].map((q) => document.querySelector(q))
        .filter(sicht).map((e) => ({ id: e.id, k: miss(e, false) }));
      // folgt Entwurf (Luecken 6): das Diagramm steht im eigenen Feld #histPlotFeld
      const achse = [...document.querySelectorAll("#histPlotFeld svg.histplot text")].filter(sicht)
        .map((e) => ({ t: e.textContent, k: miss(e, true) }));
      return { kopf, achse };
    });
    for (const thema of ["dark", "light", "tnl"]) {
      for (const lang of ["en", "de"]) {
        const wo = `${thema}/${lang}`;
        const s = await oeffne({ app: true, lang, config: { theme: thema }, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(VER) } });
        const p = s.page;
        await laden(p);
        await entwickler(p);   // Waffen und Log-Einrichtung in der Leiste
        await p.waitForTimeout(300);
        const th = await p.evaluate(() => document.documentElement.dataset.theme);
        assert(th === thema, `${wo}: das Thema steht`, th);
        for (const [tab] of BEREICHE) {
          await bereich(p, tab);
          await p.waitForTimeout(tab === "history" ? 300 : 100);
          const b = await blick(p);
          const name = NAMEN[lang][tab];
          // folgt Entwurf (Luecken 7.1): die Gruppe nennt ihren Stand statt des Kampfs
          assert(b.felder && b.kopf && b.name === name && (tab === "party" ? !b.kampf && !!b.ctx : b.kampf && !b.ctx) && !b.quer,
            `${wo} ${name}: Kopfzeile, Felder, kein Querrollen`, b);
          /* Einzug: in jedem Feld beginnt der erste Text mindestens 16 Punkt
             vom linken Rand des Panels (die Felder haben 16 Punkt Innenabstand).
             #histWrap und #cmpBody sind selbst Raster, ihre Kinder die Felder. */
          const einzug = await p.evaluate(() => {
            const pn = document.querySelector(".panel.on"), pl = pn.getBoundingClientRect().left;
            return [...pn.children].filter((c) => !c.matches("#histWrap,#cmpBody") && c.getClientRects().length && c.getBoundingClientRect().height > 0).map((c) => {
              const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT,
                /* Neugestaltung 28.09., Aufgabe 4: Ueberschriften nur fuer Vorleser (.vh) zaehlen nicht als
                   sichtbarer Einzug - gemessen wird der erste Text, den man sieht */
                { acceptNode: (n) => (n.textContent.trim() && n.parentElement.getClientRects().length && !n.parentElement.closest(".vh") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
              const n = w.nextNode(); if (!n) return { id: c.id || c.className, x: null };
              const r = document.createRange(); r.selectNodeContents(n);
              return { id: c.id || c.className, x: Math.round(r.getBoundingClientRect().left - pl) };
            });
          });
          assert(einzug.every((e) => e.x === null || e.x >= 16), `${wo} ${name}: jedes Feld hat seinen Einzug`, einzug);
          const k = await kontraste(p);
          // Gruppe: Name und Stand (Luecken 7.1); sonst Name und Kampf wie bisher
          assert((tab === "party" ? k.kopf.length === 2 && k.kopf[1].id === "bkCtx" : k.kopf.length >= 4) && k.kopf.every((x) => x.k >= 4.5),
            `${wo} ${name}: Kopfzeile lesbar (4,5:1)`, k.kopf);
          if (tab === "history")
            assert(k.achse.length >= 3 && k.achse.every((x) => x.k >= 4.5), `${wo} Verlauf: Achsenbeschriftung lesbar (4,5:1)`, k.achse);
        }
        assert(!s.fehler.length, `${wo}: keine Fehler`, s.fehler);
        await p.close();
      }
    }

    /* Groesse 50/150/200 % im grossen Fenster und 560 Layoutpunkte bei 100,
       150 und 200 % (das Fenster ist dann 560 x Groesse breit): jeder
       Bereich mit Kopfzeile im Bild, kein Querrollen. */
    for (const [breite, zoom] of [[1280, 50], [1280, 150], [1280, 200], [560, 100], [840, 150], [1120, 200]]) {
      const wo = `${breite}/${zoom} %`;
      const s = await oeffne({ app: true, lang: "de", breite, config: { uiZoom: zoom }, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(VER) } });
      const p = s.page;
      await laden(p);
      await entwickler(p);
      await p.waitForTimeout(300);
      for (const [tab] of BEREICHE) {
        await bereich(p, tab);
        await p.waitForTimeout(tab === "history" ? 300 : 100);
        const b = await blick(p);
        const r = await p.evaluate(() => {
          const k = document.querySelector("#bereichKopf").getBoundingClientRect();
          const akt = document.querySelector("#bkAkt").getBoundingClientRect();
          return { l: k.left, r: k.right, aktR: akt.right, w: innerWidth };
        });
        assert(b.felder && b.kopf && b.name === NAMEN.de[tab] && !b.quer && r.l >= -0.5 && r.r <= r.w + 0.5 && r.aktR <= r.w + 0.5,
          `${wo} ${NAMEN.de[tab]}: Kopfzeile ganz im Bild, kein Querrollen`, { b, r });
      }
      if (breite * 100 / zoom === 560) {
        // 560 Punkt: Titelleiste hoechstens zwei Zeilen, das Zahnrad im Bild und anklickbar, Einstellungen ohne Querrollen
        // (das Zahnrad steht seit der Neugestaltung 28.09., DECISION 0.14, nur unten in der Symbolleiste)
        const t = await p.evaluate(() => {
          const top = document.querySelector(".top"), g = document.querySelector('#bereiche [data-tab="settings"]');
          const r = g.getBoundingClientRect(), sicht = g.getClientRects().length > 0;
          const e = sicht ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
          return { h: top.getBoundingClientRect().height, sicht, l: r.left, r: r.right, trifft: !!e && !!e.closest('#bereiche [data-tab="settings"]'), w: innerWidth,
            quer: document.documentElement.scrollWidth > innerWidth };
        });
        assert(t.h <= 80 * zoom / 100 + 0.5 && !t.quer, `${wo}: Titelleiste hoechstens zwei Zeilen, kein Querrollen`, t);
        assert(t.sicht && t.trifft && t.l >= 0 && t.r <= t.w, `${wo}: das Zahnrad steht im Bild und ist anklickbar`, t);
        await p.click('#bereiche [data-tab="settings"]');
        await p.waitForTimeout(200);
        const e = await p.evaluate(() => ({ offen: !document.querySelector("#einst").hidden, felder: document.body.classList.contains("felder"),
          quer: document.documentElement.scrollWidth > innerWidth }));
        assert(e.offen && !e.felder && !e.quer, `${wo}: Einstellungen offen, ohne Felder, kein Querrollen`, e);
      }
      assert(!s.fehler.length, `${wo}: keine Fehler`, s.fehler);
      await p.close();
    }

    /* Tab-Reihenfolge: vom gewaehlten Bereich in der Leiste aus erreicht Tab
       erst die Kopfzeile (Kampf speichern, Als Bild), dann die Felder. */
    {
      const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(VER) } });
      const p = s.page;
      await laden(p);
      await entwickler(p);
      await p.waitForTimeout(300);
      for (const [tab, name] of BEREICHE) {
        await bereich(p, tab);
        await p.waitForTimeout(tab === "history" ? 300 : 100);
        await p.focus(`#bereiche [data-tab="${tab}"]`);
        const weg = [];
        for (let i = 0; i < 40; i++) {
          await p.keyboard.press("Tab");
          const wo = await p.evaluate(() => {
            const a = document.activeElement;
            if (!a || a === document.body) return "body";
            if (a.closest("#bereichKopf")) return "kopf:" + (a.id || (a.dataset.z ? "zeit-" + a.dataset.z : ""));
            if (a.closest(".panel.on")) return "feld";
            return "sonst";
          });
          weg.push(wo);
          if (wo === "feld") break;
        }
        let kopf = weg.findIndex((w) => w.startsWith("kopf:"));
        const feld = weg.indexOf("feld");
        /* Folgt Entwurf (Neugestaltung 28.09., Luecken 5.1): im Vergleich steht vor
           Speichern und Bild der Umschalter Bester Pull | Letzter Pull - er kommt
           zuerst, in dieser Reihenfolge, danach geht es wie ueberall weiter. */
        if (tab === "compare") {
          assert(kopf >= 0 && weg[kopf] === "kopf:vglBest" && weg[kopf + 1] === "kopf:vglLetzt",
            `${name}: Tab erreicht in der Kopfzeile zuerst den Umschalter (Bester Pull, Letzter Pull)`, weg);
          kopf += 2;
        }
        // Kampf speichern und Als Bild stehen seit der Kritik vom 28.09. nur, wo es um den Kampf geht (Abschnitt 12)
        if (["rotation", "analysis", "compare", "weapons"].includes(tab))
          assert(kopf >= 0 && weg[kopf] === "kopf:bkSpeichern" && weg[kopf + 1] === "kopf:bkBild" && (feld < 0 || feld > kopf + 1),
            `${name}: Tab erreicht erst die Kopfzeile (Speichern, Bild), dann die Felder`, weg);
        /* Folgt Entwurf (Luecken 6.1): im Verlauf steht in der Kopfzeile der Zeitraum
           (Woche, Monat, Alles) - genau diese drei, dann die Felder. */
        else if (tab === "history")
          assert(kopf >= 0 && weg.slice(kopf, kopf + 3).join("|") === "kopf:zeit-woche|kopf:zeit-monat|kopf:zeit-alles" && feld === kopf + 3,
            `${name}: in der Kopfzeile nur der Zeitraum (Woche, Monat, Alles), dann die Felder`, weg);
        else assert(kopf < 0, `${name}: in der Kopfzeile ist nichts zu bedienen`, weg);
        // die Analyse hat nur Text in ihren Feldern (nichts zum Bedienen): dort gibt es nichts zu erreichen
        const bedienbar = await p.evaluate(() => [...document.querySelectorAll(".panel.on :is(a[href],button,input,select,textarea,[tabindex])")]
          .some((e) => e.tabIndex >= 0 && !e.disabled && e.getClientRects().length > 0));
        // ohne Kopfzeilen-Knoepfe (Abschnitt 12) ist das Feld der erste Halt, Index 0
        assert(!bedienbar || feld >= 0, `${name}: Tab erreicht die Felder` + (bedienbar ? "" : " (nichts zu bedienen)"), weg);
      }
      assert(!s.fehler.length, "Tab-Reihenfolge: keine Fehler", s.fehler);
      await p.close();
    }
  }

  // --- 10. (Kritik 28.09., P1) die Titelleiste steht fest: Live und Logs oeffnen
  // auch auf Start, die Kampfwahl an derselben Stelle auf Start und im Kampf
  for (const breite of [1280, 1100]) {
    const s = await oeffne({ app: true, lang: "de", breite }); const p = s.page;
    const leiste = () => p.evaluate(() => {
      const sicht = (q) => { const e = document.querySelector(q); if (!e || !e.getClientRects().length) return false;
        const r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!t && !!t.closest(q); };
      const k = document.querySelector("#kwKnopf").getBoundingClientRect();
      return { live: sicht("#btnWatch"), oeffnen: sicht("#btnOpen"), mitte: k.left + k.width / 2, breit: k.width };
    });
    const leer = await leiste();
    await beispiel(p);
    const kampf = await leiste();
    await bereich(p, "start");
    const start = await leiste();
    for (const [wo, m] of [["Start ohne Kampf", leer], ["Kampf", kampf], ["Start mit Kampf", start]])
      assert(m.live && m.oeffnen, `${breite}: ${wo} - Live und Logs oeffnen stehen in der Titelleiste`, m);
    assert(Math.abs(leer.mitte - kampf.mitte) <= 1 && Math.abs(start.mitte - kampf.mitte) <= 1,
      `${breite}: die Kampfwahl steht auf Start (mit und ohne Kampf) und im Kampf an derselben Stelle`, { leer, kampf, start });
    assert(!s.fehler.length, `${breite}: Titelleiste ohne Fehler`, s.fehler);
    await p.close();
  }

  {
    // Live an und aus: die Kampfwahl bleibt stehen (der Umschalter hat eine feste Mindestbreite)
    for (const lang of ["de", "en"]) {
      const s = await oeffne({ app: true, lang, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS) } });
      const p = s.page;
      const mitte = () => p.evaluate(() => { const k = document.querySelector("#kwKnopf").getBoundingClientRect(); return k.left + k.width / 2; });
      const aus0 = await mitte();
      await p.evaluate(() => document.querySelector("#btnWatch").click());
      await p.waitForFunction(() => !document.querySelector("#app").hidden && document.body.classList.contains("watching"), null, { timeout: 8000 });
      await p.waitForTimeout(300);
      const an = await mitte();
      await p.evaluate(() => document.querySelector("#btnWatch").click());
      await p.waitForFunction(() => !document.body.classList.contains("watching"), null, { timeout: 8000 });
      await p.waitForTimeout(300);
      const aus = await mitte();
      assert(Math.abs(an - aus) <= 1 && Math.abs(aus0 - aus) <= 1, `${lang}: die Kampfwahl steht mit Live an und aus an derselben Stelle`, { aus0, an, aus });
      assert(!s.fehler.length, `${lang}: Live an/aus ohne Fehler`, s.fehler);
      await p.close();
    }
  }

  // --- 11. (Kritik 28.09., P1) leere Bereiche: der Beispiel-Hinweis einmal in der
  // Kopfzeile, in Verlauf und Vergleich je ein handelnder Knopf. Der Knopf im
  // Abend (Bereich Gruppe) entfaellt mit dem Abend (Neugestaltung 28.09.,
  // Spezifikation 3); der Hinweis wird dort weiter gezaehlt.
  for (const lang of ["de", "en"]) {
    const s = await oeffne({ app: true, lang }); const p = s.page; await beispiel(p);
    const WORT = lang === "de" ? "niemandes Leistung" : "nobody's performance";
    const OEFFNEN = lang === "de" ? "Logs öffnen" : "Open logs";
    for (const [tab, name] of [["history", "Verlauf"], ["compare", "Vergleich"], ["party", "Gruppe"], ["rotation", "Rotation"]]) {
      await bereich(p, tab);
      await p.waitForTimeout(tab === "party" ? 400 : 100);
      const m = await p.evaluate((wort) => {
        const zahl = (txt) => txt.split(wort).length - 1;
        const kn = [...document.querySelectorAll(".panel.on [data-leer]")].filter((b) => b.getClientRects().length > 0)
          .map((b) => ({ art: b.dataset.leer, text: b.textContent.trim(), tag: b.tagName }));
        return { ganz: zahl(document.body.innerText), kopf: zahl(document.querySelector("#bereichKopf").innerText),
          hinweisSicht: document.querySelector("#bkHinweis")?.getClientRects().length > 0, knoepfe: kn };
      }, WORT);
      assert(m.ganz === 1 && m.kopf === 1 && m.hinweisSicht, `${lang} ${name}: der Beispiel-Hinweis steht genau einmal, in der Kopfzeile`, m);
      if (tab !== "rotation" && tab !== "party")
        assert(m.knoepfe.length === 1 && m.knoepfe[0].art === "open" && m.knoepfe[0].text === OEFFNEN && m.knoepfe[0].tag === "BUTTON",
          `${lang} ${name}: ein sichtbarer Knopf "${OEFFNEN}" im leeren Feld`, m.knoepfe);
    }
    // derselbe Knopf, dieselbe Tinte: im Vergleich (Zeile zum besten Pull) wie im Verlauf
    const tinte = {};
    for (const tab of ["history", "compare"]) {
      await bereich(p, tab);
      await p.waitForTimeout(100);
      tinte[tab] = await p.evaluate(() => { const b = document.querySelector(".panel.on [data-leer]"); return b ? getComputedStyle(b).color : null; });
    }
    assert(!!tinte.history && tinte.compare === tinte.history, `${lang}: der Knopf hat ueberall dieselbe Tinte`, tinte);
    // der Knopf tut, was der Knopf auf Start tut: die Dateiauswahl (#btnOpen2 -> #fileInput)
    for (const tab of ["history", "compare"]) {
      await bereich(p, tab);
      await p.waitForTimeout(100);
      const da = !!(await p.$(".panel.on [data-leer=open]"));
      const wahl = da ? p.waitForEvent("filechooser", { timeout: 3000 }).then(() => true).catch(() => false) : false;
      if (da) await p.click(".panel.on [data-leer=open]");
      assert(da && await wahl, `${lang} ${tab}: der Knopf oeffnet die Dateiauswahl wie "Logs oeffnen"`);
    }
    // im Kampf gibt es keine Kopfzeile und keinen zweiten Hinweis
    await bereich(p, "timeline");
    const kampf = await p.evaluate((wort) => document.body.innerText.split(wort).length - 1, WORT);
    assert(kampf === 0, `${lang}: im Kampf steht kein Beispiel-Hinweis`, kampf);
    assert(!s.fehler.length, `${lang}: leere Bereiche ohne Fehler`, s.fehler);
    await p.close();
  }
  {
    // eigene Logs, nur ein Kampf an einem Gegner, der kein Boss ist (kein Verlauf, nichts zu
    // vergleichen): Verlauf und Vergleich tragen "Live-Aufzeichnung starten" (der Abend entfaellt);
    // der Knopf schaltet dasselbe wie #btnWatch, und laeuft Live, verschwindet er.
    // Der Helfer beobachtet einen Ordner mit demselben Log, damit Live wirklich anlaeuft.
    const s = await oeffne({ app: true, lang: "de", helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText([PULLS[2]]) } });
    const p = s.page;
    await p.setInputFiles("#fileInput", { name: "TLCombatLog-1.txt", mimeType: "text/plain", buffer: Buffer.from(logText([PULLS[2]])) });
    await p.waitForFunction(() => !document.querySelector("#app").hidden);
    await p.waitForTimeout(300);
    for (const [tab, name] of [["history", "Verlauf"], ["compare", "Vergleich"]]) {
      await bereich(p, tab);
      await p.waitForTimeout(100);
      const m = await p.evaluate(() => ({ hinweis: document.querySelector("#bkHinweis")?.getClientRects().length > 0,
        knoepfe: [...document.querySelectorAll(".panel.on [data-leer]")].filter((b) => b.getClientRects().length > 0)
          .map((b) => ({ art: b.dataset.leer, text: b.textContent.trim() })) }));
      assert(!m.hinweis && m.knoepfe.length === 1 && m.knoepfe[0].art === "live" && m.knoepfe[0].text === "Live-Aufzeichnung starten",
        `eigenes Log, ${name}: kein Beispiel-Hinweis, ein Knopf "Live-Aufzeichnung starten"`, m);
    }
    await bereich(p, "history");
    await p.evaluate(() => { window.__live = 0; document.querySelector("#btnWatch").addEventListener("click", () => window.__live++); });
    if (await p.$(".panel.on [data-leer=live]")) await p.click(".panel.on [data-leer=live]");
    await p.waitForFunction(() => document.body.classList.contains("watching"), null, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(600);
    const an = await p.evaluate(() => ({ live: window.__live, laeuft: document.body.classList.contains("watching"),
      knopf: [...document.querySelectorAll(".panel.on [data-leer]")].filter((b) => b.getClientRects().length > 0).length }));
    assert(an.live === 1, "der Knopf ist ein Klick auf #btnWatch (derselbe Umschalter)", an);
    const fokus = await p.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    assert(fokus === "btnWatch", "nach dem Klick steht der Fokus auf dem Live-Umschalter, nicht auf body", fokus);
    assert(an.laeuft && an.knopf === 0, "Live laeuft, der Knopf steht nicht mehr da", an);
    assert(!s.fehler.length, "eigenes Log: keine Fehler", s.fehler);
    await p.close();
    // Live laeuft schon: kein Knopf, der sie noch einmal startet
    const t = await oeffne({ app: true, lang: "de", helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText([PULLS[0]]) } });
    await t.page.evaluate(() => document.querySelector("#btnWatch").click());
    await t.page.waitForFunction(() => !document.querySelector("#app").hidden && document.body.classList.contains("watching"), null, { timeout: 8000 });
    await bereich(t.page, "history");
    // erst: der Verlauf ist wirklich leer (ein Kampf an Vulcanus, ein Boss erscheint ab dem zweiten)
    const leerV = await t.page.evaluate(() => ({ wrap: document.querySelector("#histWrap").hidden,
      zeilen: document.querySelectorAll("#histBoss option").length, satz: document.querySelector("#histNote").textContent }));
    assert(leerV.wrap && leerV.zeilen === 0 && leerV.satz.length > 0, "Live laeuft, ein Kampf: der Verlauf ist leer", leerV);
    const lv = await t.page.evaluate(() => [...document.querySelectorAll(".panel.on [data-leer]")].filter((b) => b.getClientRects().length > 0).length);
    assert(lv === 0, "Live laeuft: im leeren Verlauf kein Knopf", lv);
    await t.page.close();
  }

  // --- 12. (Kritik 28.09., P2) Kampf speichern und Als Bild nur, wo es um den Kampf geht
  {
    const s = await oeffne({ app: true, lang: "de" }); const p = s.page; await beispiel(p);
    await entwickler(p);   // Waffen und Log-Einrichtung in der Leiste
    await p.waitForTimeout(600);
    const KAMPF = new Set(["rotation", "analysis", "compare", "weapons"]);
    for (const [tab, name] of BEREICHE) {
      await bereich(p, tab);
      const b = await blick(p);
      if (KAMPF.has(tab)) assert(b.akt && b.speichern && b.bild, `${name}: Kampf speichern und Als Bild in der Kopfzeile`, b);
      // folgt Entwurf (Luecken 7.1): die Gruppe nennt statt des Kampfs ihren Stand
      else assert(!b.akt && !b.speichern && !b.bild && (tab === "party" ? !b.kampf && b.ctx === "Noch keine Gruppe" : b.kampf),
        `${name}: keine Kampf-Handlungen in der Kopfzeile, der Kampf (in der Gruppe ihr Stand) bleibt genannt`, b);
    }
    assert(!s.fehler.length, "Kopfzeilen-Handlungen: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 13. (Kritik 28.09., P2) "Zeitverlauf ausklappen" im Kurvenfeld:
  // das Raster endet mit den Feldern, keine eigene Zeile darunter.
  /* Neugestaltung 28.09. (Luecke 2.15, Entwurf docs/entwurf/borometer-entwurf-app.html,
     Bereich Kampf: .kfuss unter der Kurve): der Knopf steht unter der
     Kurve, links im Feld, statt rechts im Feldkopf. Geprueft wird wie
     vorher, dass er im Kurvenfeld steht, zu ist und keine eigene Zeile
     unter dem Raster braucht; #spurenAuf daneben ist seit Aufgabe 10 ein
     Weg in den Bereich Rotation. */
  for (const [breite, hoehe] of [[1280, 860], [1920, 1080], [1100, 700], [900, 800]]) {
    const s = await oeffne({ app: true, lang: "de", breite, hoehe }); const p = s.page; await beispiel(p);
    const m = await p.evaluate(() => {
      const r = (q) => document.querySelector(q).getBoundingClientRect();
      /* Seit der Pruefung 29.09. zwei Knoepfe unter der Kurve: #zeitAuf laesst
         die Kurve wachsen (steuert #kurveFeld), #spurenAuf fuehrt seit
         Aufgabe 10 (Nachtrag 29.09.) in den Bereich Rotation zum gestapelten
         Zeitverlauf - ein Weg, der nichts auf- oder zuklappt (ohne
         aria-expanded und aria-controls). Beide geprueft. */
      const k = document.querySelector("#spurenAuf"), z = document.querySelector("#zeitAuf");
      return { imFeld: !!k.closest("#kurveFeld .kfuss") && !!z.closest("#kurveFeld .kfuss"), exp: k.getAttribute("aria-expanded"), ctl: k.getAttribute("aria-controls"),
        zExp: z.getAttribute("aria-expanded"), zCtl: z.getAttribute("aria-controls"), z: r("#zeitAuf"),
        k: r("#zeitAuf"), kurve: r("#kurve"), feld: r("#kurveFeld"), urteil: r("#urteilFeld"), tafel: r(".table"), app: r("#app"),
        grund: getComputedStyle(k).backgroundColor };
    });
    const wo = `${breite}x${hoehe}`;
    assert(m.imFeld && m.exp === null && m.ctl === null && m.zExp === "false" && m.zCtl === "kurveFeld",
      `${wo}: die Knoepfe stehen im Kurvenfeld; #spurenAuf ist ein Weg (nichts zu steuern), #zeitAuf steuert die Kurve und ist zu`, m);
    // folgt Spezifikation Glutring 2: die Knoepfe stehen rechts im Kopf des Bands, ueber der Kurve
    assert(m.z.bottom <= m.kurve.top + 0.5 && m.z.top >= m.feld.top - 0.5 && m.z.right <= m.feld.right + 0.5 &&
      m.k.bottom <= m.kurve.top + 0.5 && m.k.right <= m.feld.right + 0.5, `${wo}: im Kopf des Bands, ueber der Kurve, rechts im Feld`, m);
    assert(Math.abs(m.app.bottom - m.feld.bottom) <= 1.5, `${wo}: das Raster endet mit dem Band (keine Zeile fuer den Knopf)`, m);
    assert(!s.fehler.length, `${wo}: keine Fehler`, s.fehler);
    await p.close();
  }

  // --- 14. (Kritik 28.09., P2) Kompakt: die Meldung deckt den Bedienstreifen nicht
  // und wird nicht abgeschnitten - sie steht unter ihm und bricht um
  for (const lang of ["de", "en"]) {
    const s = await oeffne({ app: true, lang }); const p = s.page; await beispiel(p);
    await p.click("#btnCompact"); await p.waitForFunction(() => document.body.classList.contains("compact"));
    await p.waitForTimeout(600);
    await p.setViewportSize({ width: 480, height: 330 }); await p.waitForTimeout(600);
    // die Meldung, die das Fenster hier ohnehin zeigt (die kleinere Groesse wurde nicht uebernommen)
    await p.waitForFunction(() => document.querySelector("#toast").classList.contains("on"), null, { timeout: 5000 }).catch(() => {});
    const m = await p.evaluate(() => {
      const t = document.querySelector("#toast"), tr = t.getBoundingClientRect(), cs = getComputedStyle(t);
      const top = document.querySelector(".top");
      const knoepfe = [...top.querySelectorAll("button")].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== "hidden")
        .map((b) => ({ id: b.id, r: b.getBoundingClientRect() }));
      const deckt = knoepfe.filter((k) => k.r.left < tr.right && k.r.right > tr.left && k.r.top < tr.bottom && k.r.bottom > tr.top).map((k) => k.id);
      const zahl = document.querySelector("#hDps"), zr = zahl.getBoundingClientRect();
      const ueberZahl = zr.left < tr.right && zr.right > tr.left && zr.top < tr.bottom && zr.bottom > tr.top;
      return { an: t.classList.contains("on"), text: t.textContent, deckt, streifen: top.getBoundingClientRect().bottom, oben: tr.top,
        ueberZahl, zahlSicht: zr.height > 0, kopfOben: document.querySelector(".headwrap").getBoundingClientRect().top, unten: tr.bottom,
        breit: [t.scrollWidth, t.clientWidth], hoch: [t.scrollHeight, t.clientHeight], ellipse: cs.textOverflow, umbruch: cs.whiteSpace,
        rechts: tr.right, fenster: innerWidth };
    });
    assert(m.an && m.text.length > 20, `${lang} Kompakt 480: eine Meldung steht`, m);
    assert(!m.deckt.length && m.oben >= m.streifen - 0.5, `${lang} Kompakt 480: die Meldung liegt unter dem Streifen, auf keinem Knopf`, m);
    assert(m.breit[0] <= m.breit[1] + 1 && m.hoch[0] <= m.hoch[1] + 1 && m.ellipse !== "ellipsis" && m.umbruch !== "nowrap" && m.rechts <= m.fenster + 0.5,
      `${lang} Kompakt 480: der Text steht ganz da (bricht um, nichts abgeschnitten)`, m);
    // im Fluss: die Meldung schiebt den Kopf nach unten, statt auf der grossen Zahl zu liegen
    assert(m.zahlSicht && !m.ueberZahl && m.kopfOben >= m.unten - 0.5, `${lang} Kompakt 480: die Meldung deckt die grosse Zahl nicht, der Kopf steht darunter`, m);
    // geht sie, steht der Kopf wieder direkt unter dem Streifen
    await p.waitForFunction(() => !document.querySelector("#toast").classList.contains("on"), null, { timeout: 12000 });
    await p.waitForTimeout(300);
    const nach = await p.evaluate(() => ({ streifen: document.querySelector(".top").getBoundingClientRect().bottom,
      kopf: document.querySelector(".headwrap").getBoundingClientRect().top, toast: getComputedStyle(document.querySelector("#toast")).display }));
    assert(Math.abs(nach.kopf - nach.streifen) <= 1, `${lang} Kompakt 480: nach der Meldung steht der Kopf wieder unter dem Streifen`, nach);
    assert(!s.fehler.length, `${lang} Kompakt-Meldung: keine Fehler`, s.fehler);
    await p.close();
  }

  // --- 15. (Kritik 28.09., Kleinigkeiten) das Kurvenfeld: "pro Sekunde" wie ueberall,
  // die Beschriftung der Spur als Unterzeile ueber der Kurve, nicht verwaist unter der Achse
  for (const [lang, titel, gesamt] of [["de", "Schaden pro Sekunde", "Gesamt"], ["en", "Damage per second", "Total"]]) {
    const s = await oeffne({ app: true, lang }); const p = s.page; await beispiel(p);
    const m = await p.evaluate(() => {
      const r = (q) => document.querySelector(q).getBoundingClientRect();
      return { titel: document.querySelector("#kurveTitel").textContent, name: document.querySelector("#kurveFeld").getAttribute("aria-label"),
        unter: document.querySelector("#kurveUnter").textContent, u: r("#kurveUnter"), kopf: r("#kurveFeld .feldkopf"), kurve: r("#kurve") };
    });
    assert(m.titel === titel && m.name === titel, `${lang}: das Kurvenfeld heisst "${titel}"`, m);
    // folgt Spezifikation Glutring 2: die Unterzeile steht im Kopf des Bands neben der Ueberschrift, ueber der Kurve
    assert(m.unter === gesamt && m.u.top >= m.kopf.top - 0.5 && m.u.bottom <= m.kopf.bottom + 0.5 && m.u.bottom <= m.kurve.top + 0.5,
      `${lang}: "${gesamt}" steht im Kopf des Bands, ueber der Kurve`, m);
    assert(!s.fehler.length, `${lang} Kurvenfeld: keine Fehler`, s.fehler);
    await p.close();
  }
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} FAILED` : "\nall ok");
process.exit(failed ? 1 : 0);
