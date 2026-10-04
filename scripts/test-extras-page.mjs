// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Fenster-Extras (Spezifikation 27.09.2026, Abschnitte 3.3 bis 3.5 und 7) an
// der gebauten Seite, vom gestellten Helfer ausgeliefert (page.route): die
// Seite als eigenes Fenster der App (?win=1, nativeFrame) und als Tab im
// Browser. Der Helfer ist gestellt; was die Seite an /api/win und
// /api/config schickt, wird mitgeschrieben.
//
// Run:  npm run test:extras-page     (baut die Seite zuerst)

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { gebauterModus } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/* Ohne Spielbilder (BORO_BILDER=aus) traegt jeder Kern die gezeichnete Marke
   (CORE_GEM in 21-damage-table.ts); die Probe des Kernbilds prueft dann sie. */
const BILDER = gebauterModus(root) === "voll";
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

const TEXT = {
  en: { satz: "The compact window only stays above the game when Throne and Liberty runs as a borderless window (Settings \u2192 Graphics \u2192 Display mode).",
        kurz: "Above the game only if it runs borderless \u00b7 see \u22ef", ok: "Got it" },
  de: { satz: "Das Kompaktfenster liegt nur \u00fcber dem Spiel, wenn Throne and Liberty als randloses Fenster l\u00e4uft (Einstellungen \u2192 Grafik \u2192 Anzeigemodus).",
        kurz: "Nur \u00fcber dem Spiel, wenn es randlos l\u00e4uft \u00b7 siehe \u22ef", ok: "Verstanden" },
};

/* Eine Seite am gestellten Helfer. app: mit ?win=1 und nativeFrame (das
   eigene Fenster der App), sonst ein Browser-Tab auf 127.0.0.1. config: was
   GET /api/config antwortet. s.material: was /api/state als material meldet;
   s.zaehler: die Zaehler von /api/events.
   Kompakt als eigenes Fenster (Nachtraege N4): zwei - der Helfer meldet
   kompaktFenster (Windows mit Acrylic); kfenster - die Seite ist das
   Kompaktfenster selbst (?win=1&kompakt=1); s.kompakt - was /api/state
   unter kompakt meldet (offen, live, durch); helfer - ein beobachteter
   Ordner mit einem Log (/api/latest liefert es am Stueck); gruppe - der
   Helfer ist in einer Gruppe; s.schreibt - jeder POST ausser /api/win.
   Kompakt-Fix (01.10.): dateien - Name -> Text, was GET /api/log?name=
   liefert (sonst 404, wie eine Datei, die nicht im Log-Ordner liegt);
   s.kompakt traegt dazu grund, datei und kampf (der Stand der Vollansicht);
   folgt - das Fenster folgt den Groessen, um die das Kompaktfenster bittet,
   wie der Hauptprozess (das Menue waechst und schrumpft zurueck);
   acrylic - was /api/state als material meldet; stateVerzug - so viele ms
   spaeter antwortet /api/state. */
async function oeffne({ app = true, lang = "en", config = {}, zwei = false, kfenster = false, kompakt = {}, helfer = null,
                        gruppe = false, breite = 1280, hoehe = 860, dateien = null, folgt = false, acrylic = true, stateVerzug = 0 } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const s = { page, fehler: [], posts: [], win: [], schreibt: [], material: acrylic, logs: [], standNein: 0,
              kompakt: { offen: kfenster, live: false, durch: false, ...kompakt },
              zaehler: { hotkey: 0, compact: 0, live: 0, handsize: 0, material: 0, kompakt: 0, kompakthand: 0, kompaktstand: 0 } };
  let vorMenue = null;
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    // stateVerzug: /api/state antwortet spaeter als /api/config (Kompakt-Fix 4)
    if (path === "/api/state" && stateVerzug) await new Promise((r) => setTimeout(r, stateVerzug));
    if (path === "/api/state") return json({ dir: helfer ? helfer.dir : "", file: helfer ? helfer.file : "",
      ...(helfer ? { size: helfer.text.length, mtime: 1 } : {}), nativeFrame: app, material: app && s.material, stayOnTop: false,
      ...(zwei ? { kompaktFenster: true, kompakt: s.kompakt } : {}) });
    if (path === "/api/latest" && helfer) {
      const n = helfer.text.length;
      return json({ file: helfer.file, from: 0, to: n, size: n, head: helfer.text.split("\n").slice(0, 2).join("\n"), text: helfer.text });
    }
    if (path === "/api/log" && dateien) {
      const name = url.searchParams.get("name") || "";
      s.logs.push(name);
      if (!Object.hasOwn(dateien, name)) return route.fulfill({ status: 404, contentType: "application/json", body: "{}" }).catch(() => {});
      // 500: der Helfer konnte die Datei gerade nicht lesen (Gutachten N3)
      if (dateien[name] === 500) return route.fulfill({ status: 500, contentType: "text/plain", body: "" }).catch(() => {});
      const n = dateien[name].length;
      return json({ file: name, from: 0, to: n, size: n, text: dateien[name] });
    }
    // jede schreibende Anfrage ausser /api/win, fuer die Probe "der Streifen schreibt nichts" (Pruefung N4, W3/W4)
    if (req.method() === "POST" && path !== "/api/win") s.schreibt.push(path);
    if (path === "/api/config" && req.method() === "GET") return json(config);
    if (path === "/api/config") { s.posts.push(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path === "/api/builds" && req.method() === "GET") return json({ ok: true, builds: {} });
    // gruppe: der Helfer ist in einer Gruppe (Mitglied), die Tafel noch leer
    if (path === "/api/party/state" && gruppe) return json({ ok: true, role: "member", code: "ABCD", name: "Ich", board: [] });
    if (path === "/api/win") {
      const b = JSON.parse(req.postData() || "{}"); s.win.push(b);
      // wie der Hauptprozess: "kompakt" oeffnet oder schliesst, pin nennt den Stand
      if (b.do === "kompakt") { s.kompakt.offen = !!b.on; return json({ ok: true, offen: !!b.on }); }
      // s.standNein: so viele Staende lehnt der Hauptprozess ab (Gutachten N4)
      if (b.do === "stand" && s.standNein > 0) { s.standNein--; return json({ ok: false, error: "nicht jetzt" }); }
      if (b.do === "stand") { Object.assign(s.kompakt, { grund: b.grund, datei: b.datei, kampf: b.kampf }); return json({ ok: true }); }
      // folgt: wie der Hauptprozess - der Streifen, das Menue waechst, zurueck auf die Groesse davor
      // Die neue Groesse wird erst nach der Antwort gesetzt (Playwright nimmt
      // die Befehle der Reihe nach): auf sie zu warten, haelt die Antwort an,
      // solange die Seite beschaeftigt ist (das Beispiel laedt).
      if (folgt && b.do === "resize" && b.win === "kompakt" && b.art !== "hand") {
        const jetzt = page.viewportSize();
        let neu = null;
        if (b.art === "menue") { vorMenue = vorMenue || jetzt; neu = { width: Math.max(jetzt.width, b.w), height: Math.max(jetzt.height, b.h) }; }
        else if (b.art === "zurueck") { neu = vorMenue; vorMenue = null; }
        else if (!vorMenue) neu = { width: b.w, height: b.h };
        const v = neu || jetzt;
        await json({ ok: true, max: false, w: v.width, h: v.height });
        if (neu) await page.setViewportSize(neu).catch(() => {});
        return;
      }
      return json({ ok: true, max: false, w: 400, h: 28, on_top: b.do === "pin" ? !!b.on : true,
                    ...(b.do === "clickthrough" ? { clickthrough: !!b.on } : {}) });
    }
    if (path === "/api/events") {
      // wie der Helfer: eine Frage wartet, bis sich ein Zaehler bewegt (hier hoechstens 1 s)
      if (!url.searchParams.get("now")) {
        const gesehen = JSON.parse(url.searchParams.get("seen") || "{}");
        const neu = () => Object.keys(s.zaehler).some((k) => s.zaehler[k] > (gesehen[k] || 0));
        for (const ende = Date.now() + 1000; Date.now() < ende && !neu(); ) await new Promise((r) => setTimeout(r, 50));
      }
      return json({ ok: true, registered: true, counts: s.zaehler });
    }
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html" + (kfenster ? "?win=1&kompakt=1" : app ? "?win=1" : ""));
  // Seite fertig: body[data-bereit] statt #landStatus (Neugestaltung 28.09., Befund 2)
  await page.waitForFunction((h) => document.body.dataset.bereit === (h ? "ordner" : "ohne"), !!helfer);
  await page.waitForTimeout(400);
  return s;
}
/* Wartet, bis fn() im Test wahr ist (die Anfragen der Seite liegen hier,
   nicht in der Seite), hoechstens ms; true, wenn es so kam. */
const bis = async (fn, ms = 5000) => {
  for (const ende = Date.now() + ms; Date.now() < ende; ) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); }
  return !!fn();
};
/* Dass etwas NICHT geschieht, laesst sich nur ueber eine Frist zeigen: so
   lange, wie der gestellte Helfer hoechstens fuer eine Antwort auf
   /api/events braucht (1 s), und etwas Luft. */
const ruhig = () => new Promise((r) => setTimeout(r, 1500));
const kompakt = async (s) => { await s.page.click("#btnCompact"); await s.page.waitForTimeout(400); };
const meldung = (s) => s.page.evaluate(() => {
  const t = document.querySelector("#toast");
  const knopf = t.querySelector(".tact");
  return { an: t.classList.contains("on"), ruhig: t.classList.contains("ruhig"), text: t.firstChild?.nodeValue ?? "",
           knopf: knopf ? knopf.textContent : null, tinte: knopf ? getComputedStyle(knopf).color : null };
});
const randlosPosts = (s) => s.posts.filter((p) => "randlosGesehen" in p);
/* Ein erzeugtes Log an Vulcanus (wie in Abschnitt 8): je Pull 60 s, ein
   Treffer alle 500 ms, scale macht die Pulls unterscheidbar. Kompakt-Fix. */
function vulcanusLog(pulls) {
  const SKILLS = [["Detonation Mark", 953174691], ["Quick Fire", 964762401], ["Strafing", 945674044], ["Decisive Sniping", 964581976]];
  const two = (n, w = 2) => String(n).padStart(w, "0");
  const stamp = (ms) => {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-` +
           `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`;
  };
  const rows = [];
  for (const p of pulls) for (let k = 0; k * 500 < 60000; k++) {
    const [skill, sid] = SKILLS[k % 4];
    rows.push([p.start + k * 500, `,DamageDone,${skill},${sid},${Math.round(1000 * p.scale * (1 + (k % 5)))},0,0,kNormalHit,Tester,Vulcanus`]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  return ["CombatLogVersion,4", ...rows.map(([t, r]) => stamp(t) + r)].join("\n") + "\n";
}
const LOGNAME = "TLCombatLog-20260923.txt";
/* Die Starts der Pulls: der Zeitstempel des Logs als UTC gelesen (parseTime). */
const START = [Date.UTC(2026, 8, 23, 21, 0, 0), Date.UTC(2026, 8, 23, 21, 10, 0), Date.UTC(2026, 8, 23, 21, 20, 0)];
const LOG2 = vulcanusLog([{ start: START[0], scale: 6.0 }, { start: START[1], scale: 4.0 }]);
// dieselbe Datei, gewachsen um einen dritten Pull (Gutachten M3)
const LOG3 = vulcanusLog([{ start: START[0], scale: 6.0 }, { start: START[1], scale: 4.0 }, { start: START[2], scale: 2.0 }]);

try {
  // --- 1. Acrylic folgt Windows (3.3): ein Ereignis "material", und die Seite fragt nach
  {
    const s = await oeffne();
    const acrylic = () => s.page.evaluate(() => document.documentElement.classList.contains("acrylic"));
    assert(await acrylic(), "Start: html.acrylic, wie /api/state meldet");
    s.material = false; s.zaehler.material++;
    await s.page.waitForTimeout(700);
    assert(!(await acrylic()), "Transparenz aus: html.acrylic faellt weg");
    assert(s.win.some((b) => b.do === "seethrough"), "und die Durchsicht wird neu gesetzt");
    s.material = true; s.zaehler.material++;
    await s.page.waitForTimeout(700);
    assert(await acrylic(), "Transparenz wieder an: html.acrylic ist wieder da");
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await s.page.close();
  }
  // --- 2. gemerkte Lage (3.4): beim Start setzt die Seite das Fenster nicht vom Standard aus neu
  {
    const s = await oeffne({ config: { uiZoom: 150, windowPlaced: true } });
    assert(!s.win.some((b) => b.do === "size"), "gemerkte Lage und 150 %: keine Groesse vom Standard aus", s.win);
    await s.page.close();
    const t = await oeffne({ config: { uiZoom: 150, windowPlaced: false } });
    assert(t.win.some((b) => b.do === "size"), "ohne gemerkte Lage: wie bisher 150 % vom Standard aus", t.win);
    await t.page.close();
  }
  // --- 3. der Randlos-Hinweis (3.5), Englisch: beim ersten Kompakt, ruhig, mit "Got it"
  {
    const s = await oeffne({ config: { randlosGesehen: false } });
    await kompakt(s);
    const m = await meldung(s);
    assert(m.an && m.text === TEXT.en.kurz && m.knopf === TEXT.en.ok, "erstes Kompakt: der Hinweis mit Got it", m);
    assert(m.ruhig, "ruhig: ohne Gold und Rot (Klasse ruhig)", m);
    /* Der Knopf ragt nicht aus dem Hinweis und nicht in den Streifen. Seit
       dem 28.09. steht der Hinweis im Fluss unter dem Streifen (nicht mehr
       darauf, darum nicht mehr hoechstens --chrome hoch): er beginnt unter
       dem Streifen, und der Knopf liegt mit Luft ganz darin. */
    const mass = await s.page.evaluate(() => {
      const t = document.querySelector("#toast"), k = t.querySelector(".tact");
      const tr = t.getBoundingClientRect(), kr = k.getBoundingClientRect();
      return { oben: tr.top, streifen: document.querySelector(".top").getBoundingClientRect().bottom,
               knopfOben: kr.top - tr.top, knopfUnten: tr.bottom - kr.bottom };
    });
    assert(mass.oben >= mass.streifen - 0.5 && mass.knopfOben >= 0 && mass.knopfUnten >= 0,
      "Kompakt: der Knopf im Hinweis ragt nicht ueber den Hinweis und nicht in den Streifen", mass);
    assert(m.tinte !== null && m.tinte === (await s.page.evaluate(() => {
      const p = document.createElement("span"); p.style.color = "var(--text)"; document.body.append(p);
      const c = getComputedStyle(p).color; p.remove(); return c; })), "die Taste in der Textfarbe, nicht in Gold", m);
    assert(!randlosPosts(s).length, "vor dem Klick wird nichts geschrieben", s.posts);
    await s.page.click("#toast .tact", { timeout: 3000 });
    await s.page.waitForTimeout(300);
    assert(JSON.stringify(randlosPosts(s)) === JSON.stringify([{ randlosGesehen: true }]), "Got it schreibt randlosGesehen: true", s.posts);
    assert(!(await meldung(s)).an, "und der Hinweis geht weg");
    await kompakt(s); await kompakt(s);
    const m2 = await meldung(s);
    assert(!(m2.an && m2.text === TEXT.en.kurz), "zweites Kompakt: kein Hinweis mehr", m2);
    const note = await s.page.evaluate(() => { const n = document.querySelector("#randlosNote"); return { hidden: n.hidden, text: n.textContent }; });
    assert(!note.hidden && note.text === TEXT.en.satz, "der ganze Satz steht in der Hilfe zum Kompaktfenster (⋯-Menue)", note);
    assert(s.posts.every((p) => !("fenster" in p)), "die Seite schickt nie fenster", s.posts);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await s.page.close();
  }
  // --- 4. nicht quittiert: der Hinweis kommt beim naechsten Kompakt wieder
  {
    const s = await oeffne({ config: { randlosGesehen: false } });
    await kompakt(s);
    await kompakt(s);            // zurueck in die Vollansicht, ohne Klick
    await kompakt(s);
    const m = await meldung(s);
    assert(m.an && m.text === TEXT.en.kurz, "ohne Got it: beim naechsten Kompakt wieder", m);
    assert(!randlosPosts(s).length, "und nichts geschrieben", s.posts);
    await s.page.close();
  }
  // --- 5. schon gesehen: kein Hinweis
  {
    const s = await oeffne({ config: { randlosGesehen: true } });
    await kompakt(s);
    const m = await meldung(s);
    assert(!(m.an && m.text === TEXT.en.kurz), "randlosGesehen: true - kein Hinweis", m);
    await s.page.close();
  }
  // --- 6. Deutsch
  {
    const s = await oeffne({ lang: "de", config: { randlosGesehen: false } });
    await kompakt(s);
    const m = await meldung(s);
    assert(m.an && m.text === TEXT.de.kurz && m.knopf === TEXT.de.ok, "Deutsch: der Hinweis mit Verstanden", m);
    const note = await s.page.evaluate(() => document.querySelector("#randlosNote").textContent);
    assert(note === TEXT.de.satz, "Deutsch: der Satz in der Hilfe", note);
    await s.page.close();
  }
  // --- 7. im Browser ohne App: kein Hinweis, keine Hilfe dazu
  {
    const s = await oeffne({ app: false, config: { randlosGesehen: false } });
    await kompakt(s);
    const m = await meldung(s);
    assert(!(m.an && m.text === TEXT.en.kurz), "Browser ohne App: kein Hinweis", m);
    assert(await s.page.evaluate(() => document.querySelector("#randlosNote").hidden), "Browser ohne App: der Satz steht nicht im Menue");
    await s.page.close();
  }
  /* --- 8. aus test-abend-page.mjs, Neugestaltung 28.09. (Nr. 8): der Abend
     entfaellt (Spezifikation 3), das Kompaktfenster bleibt. Issue #39: die
     Differenz zum letzten Pull steht neutral - in der Farbe der Lesezeile,
     nicht Gruen oder Rot; das Vorzeichen traegt die Richtung. Zwischen dem
     Satz und der Differenz ein Trenner, in beiden Sprachen, auch im title und
     fuer den Vorleser. Ueber file://, zwei erzeugte Logs an Vulcanus. */
  {
    const work = mkdtempSync(join(tmpdir(), "boro-kompakt-"));
    try {
      const SKILLS = [["Detonation Mark", 953174691], ["Quick Fire", 964762401],
                      ["Strafing", 945674044], ["Decisive Sniping", 964581976]];
      const two = (n, w = 2) => String(n).padStart(w, "0");
      const stamp = (ms) => {
        const d = new Date(ms);
        return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-` +
               `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`;
      };
      const logText = (pulls) => {
        const rows = [];
        for (const p of pulls) for (let k = 0; k * 500 < p.secs * 1000; k++) {
          const [skill, sid] = SKILLS[k % 4];
          rows.push([p.start + k * 500, `,DamageDone,${skill},${sid},${Math.round(1000 * p.scale * (1 + (k % 5)))},0,0,kNormalHit,Tester,${p.target}`]);
        }
        rows.sort((a, b) => a[0] - b[0]);
        return ["CombatLogVersion,4", ...rows.map(([t, r]) => stamp(t) + r)].join("\n") + "\n";
      };
      const V = (day, min, scale) => ({ target: "Vulcanus", start: Date.UTC(2026, 8, day, 21, min, 0), secs: 60, scale });
      const datei = (name, text) => { const f = join(work, name); writeFileSync(f, text); return f; };
      const L16 = datei("vulcanus-16.txt", logText([V(16, 0, 5.0), V(16, 10, 5.5)]));
      const L23 = datei("vulcanus-23.txt", logText([V(23, 0, 6.0), V(23, 10, 5.75)]));
      const k = await browser.newPage({ viewport: { width: 420, height: 260 } });
      const kErrors = [];
      k.on("pageerror", (e) => kErrors.push(String(e)));
      await k.addInitScript(() => {
        try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* storage blocked */ }
      });
      await k.goto("file://" + join(root, "dist", "renderer", "index.html"));
      const kompaktZeile = () => k.evaluate(() => {
        const el = document.querySelector("#hCompact");
        const d = el?.querySelector(".cdelta");
        const probe = (v) => { const s = document.createElement("span"); s.style.color = `var(${v})`; document.body.append(s);
          const c = getComputedStyle(s).color; s.remove(); return c; };
        return { da: !!el && !el.hidden && !!el.offsetParent, text: el?.textContent || "", title: el?.title || "",
                 kinder: [...(el?.children || [])].map((c) => c.className + ":" + c.textContent),
                 zeile: el ? getComputedStyle(el).color : "", satz: el?.firstElementChild ? getComputedStyle(el.firstElementChild).color : "",
                 delta: d ? getComputedStyle(d).color : "", klasse: d?.className || "",
                 pos: probe("--pos"), neg: probe("--neg") };
      });
      await k.setInputFiles("#fileInput", L16);
      await k.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
      await k.waitForTimeout(150);
      await k.evaluate(() => document.querySelector("#btnCompact").click());
      await k.waitForTimeout(150);
      // der zweite Pull an Vulcanus ist staerker als der erste (5,5 zu 5,0): "+10 %"
      for (const theme of ["dark", "light", "tnl"]) {
        await k.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`).click(), theme);
        await k.waitForTimeout(100);
        const z = await kompaktZeile();
        assert(z.da && z.klasse === "cdelta up" && z.delta === z.zeile && z.delta === z.satz && ![z.pos, z.neg].includes(z.delta),
          `Kompakt, Thema ${theme}: Anstieg in der Farbe der Lesezeile, weder gruen noch rot`, z);
      }
      let z = await kompaktZeile();
      assert(z.kinder.length === 3 && z.kinder[1] === "csep: \u00b7 " && /^\+10\u00a0% zum letzten Pull$/.test(z.kinder[2].replace(/^cdelta up:/, "")) &&
        z.title === z.text && / \u00b7 \+10\u00a0% zum letzten Pull$/.test(z.text),
        "Kompakt DE: Satz \u00b7 Differenz, der Trenner auch im title", z);
      /* Issue #39: um den Punkt stand doppelt Abstand (Zwischenraum der Zeile
         und Leerzeichen). Im Text je ein Leerzeichen, gemessen links und
         rechts gleich viel und nicht mehr als ein Leerzeichen. */
      const abstand = await k.evaluate(() => {
        const el = document.querySelector("#hCompact"), [satz, sep, delta] = el.children;
        const rect = (knoten, von, bis) => { const r = document.createRange(); r.setStart(knoten, von); r.setEnd(knoten, bis); return r.getBoundingClientRect(); };
        const st = satz.firstChild, dt = delta.firstChild, pt = sep.firstChild;
        const punkt = rect(pt, pt.textContent.indexOf("\u00b7"), pt.textContent.indexOf("\u00b7") + 1);
        const leer = rect(pt, 0, 1).width;
        return { links: punkt.left - rect(st, st.textContent.length - 1, st.textContent.length).right,
                 rechts: rect(dt, 0, 1).left - punkt.right, leer };
      });
      assert(!/\s{2}/.test(z.text) && abstand.leer > 0 && Math.abs(abstand.links - abstand.rechts) <= 1.5
        && abstand.links <= abstand.leer + 1.5 && abstand.rechts <= abstand.leer + 1.5,
        "Kompakt: um den Punkt je ein Leerzeichen, kein doppelter Abstand, links und rechts gleich", { text: z.text, abstand });
      // der Rueckgang: zweites Log, sein zweiter Pull schwaecher (5,75 zu 6,0)
      await k.setInputFiles("#fileInput", L23);
      await k.waitForTimeout(300);
      for (const theme of ["light", "tnl", "dark"]) {
        await k.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`).click(), theme);
        await k.waitForTimeout(100);
        z = await kompaktZeile();
        assert(z.da && z.klasse === "cdelta down" && z.delta === z.zeile && z.delta === z.satz && ![z.pos, z.neg].includes(z.delta),
          `Kompakt, Thema ${theme}: Rueckgang in der Farbe der Lesezeile, weder gruen noch rot`, z);
      }
      assert(/ \u00b7 \u2212\d/.test(z.text), "Kompakt: der Rueckgang traegt das Minuszeichen U+2212", z.text);
      await k.evaluate(() => document.querySelector("#btnLang").click());
      await k.waitForTimeout(150);
      z = await kompaktZeile();
      assert(z.kinder[1] === "csep: \u00b7 " && / \u00b7 \u2212[\d.]+% vs\. last pull$/.test(z.text) && z.title === z.text,
        "Kompakt EN: Satz \u00b7 Differenz", z);
      assert(!kErrors.length, "Kompakt: keine Fehler in der Seite", kErrors);
      await k.close();
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  /* --- 9. Kompakt als eigenes Fenster (Nachtraege N4), das grosse Fenster:
     der Knopf oeffnet und schliesst das Kompaktfenster ueber /api/win
     {do:"kompakt"}; das grosse Fenster bleibt die Vollansicht und schrumpft
     nicht. Der Knopf sagt mit aria-pressed, ob der Streifen offen ist. */
  {
    const s = await oeffne({ zwei: true, config: { randlosGesehen: false } });
    const p = s.page;
    const knopf = () => p.evaluate(() => ({ kompakt: document.body.classList.contains("compact"),
      pressed: document.querySelector("#btnCompact").getAttribute("aria-pressed"),
      text: document.querySelector("#btnCompact").textContent }));
    await p.click("#btnCompact");
    await p.waitForFunction(() => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", null, { timeout: 5000 }).catch(() => {});
    const auf = s.win.filter((b) => b.do === "kompakt");
    assert(auf.length === 1 && auf[0].on === true && auf[0].live === false && auf[0].durch === false && auf[0].win === "main",
      "Kompakt: das grosse Fenster bittet um das Kompaktfenster (kompakt, on, live aus, ohne Kuerzel)", s.win);
    const k = await knopf();
    assert(!k.kompakt && k.text === "Compact", "das grosse Fenster bleibt die Vollansicht, der Knopf heisst weiter Compact", k);
    assert(!s.win.some((b) => ["resize", "material", "restore_size"].includes(b.do)),
      "das grosse Fenster schrumpft nicht und bekommt kein Material", s.win);
    assert(!(await meldung(s)).an || (await meldung(s)).text !== TEXT.en.kurz, "der Randlos-Hinweis gehoert dem Streifen, nicht dem grossen Fenster");
    // noch ein Klick schliesst es
    await p.click("#btnCompact");
    await p.waitForFunction(() => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "false", null, { timeout: 5000 }).catch(() => {});
    const zu = s.win.filter((b) => b.do === "kompakt");
    assert(zu.length === 2 && zu[1].on === false, "noch ein Klick: das Kompaktfenster geht zu", zu);
    // es schliesst sich selbst (Vollansicht im Streifen): das Ereignis "kompakt" holt den Stand
    await p.click("#btnCompact");
    await p.waitForFunction(() => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", null, { timeout: 5000 }).catch(() => {});
    s.kompakt.offen = false; s.zaehler.kompakt++;
    await p.waitForFunction(() => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "false", null, { timeout: 5000 })
      .catch(() => {});
    assert((await knopf()).pressed === "false", "das Kompaktfenster ging von selbst zu: der Knopf folgt dem Ereignis", await knopf());
    // die Taskleiste (Vorschau-Knopf Kompakt) schaltet es wie der Knopf
    const vorher = s.win.filter((b) => b.do === "kompakt").length;
    s.zaehler.compact++;
    await p.waitForFunction((n) => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", vorher, { timeout: 5000 }).catch(() => {});
    const tb = s.win.filter((b) => b.do === "kompakt");
    assert(tb.length === vorher + 1 && tb[tb.length - 1].on === true, "Taskleiste: der Vorschau-Knopf oeffnet das Kompaktfenster", tb);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 10. das Kuerzel aus dem grossen Fenster: das Kompaktfenster auf, oben,
     durchklickbar (durch: true); ist es schon offen, gehoert das Kuerzel ihm */
  {
    const s = await oeffne({ zwei: true });
    const p = s.page;
    s.zaehler.hotkey++;
    await p.waitForFunction(() => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", null, { timeout: 5000 }).catch(() => {});
    const auf = s.win.filter((b) => b.do === "kompakt");
    assert(auf.length === 1 && auf[0].on === true && auf[0].durch === true, "Kuerzel aus der Vollansicht: das Kompaktfenster, durchklickbar", s.win);
    assert(!s.win.some((b) => b.do === "clickthrough" || b.do === "pin"), "das grosse Fenster wird weder durchklickbar noch angeheftet", s.win);
    s.zaehler.hotkey++;
    await ruhig();
    assert(s.win.filter((b) => b.do === "kompakt").length === 1, "Kuerzel bei offenem Kompaktfenster: das grosse Fenster laesst es dem Streifen", s.win);
    await p.close();
  }
  /* --- 11. Live laeuft im grossen Fenster: das Kompaktfenster laeuft mit (live: true) */
  {
    const text = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
    const helfer = { dir: "C:\\Logs", file: "TLCombatLog-20260925.txt", text };
    const s = await oeffne({ zwei: true, helfer });
    const p = s.page;
    await p.click("#btnWatch");
    await p.waitForFunction(() => document.body.classList.contains("watching"), null, { timeout: 5000 }).catch(() => {});
    await p.click("#btnCompact");
    await p.waitForFunction(() => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "true", null, { timeout: 5000 }).catch(() => {});
    const auf = s.win.filter((b) => b.do === "kompakt");
    assert(auf.length === 1 && auf[0].live === true, "Live im grossen Fenster: das Kompaktfenster laeuft mit", auf);
    await p.close();
  }
  /* --- 12. das Kompaktfenster selbst (?win=1&kompakt=1): der Streifen von
     Anfang an, jede Anfrage an /api/win nennt win "kompakt", nichts fuer
     Rahmen, Material oder Taskleiste; Anheften steht an (das Fenster ist
     immer vorn); ohne Minimieren (es hat keinen Platz in der Taskleiste) */
  {
    const s = await oeffne({ zwei: true, kfenster: true, config: { randlosGesehen: false } });
    const p = s.page;
    await p.waitForFunction(() => document.body.classList.contains("compact"), null, { timeout: 5000 }).catch(() => {});
    await p.waitForFunction(() => document.querySelector("#btnPin").getAttribute("aria-pressed") === "true", null, { timeout: 5000 }).catch(() => {});
    const k = await p.evaluate(() => ({
      weg: ["#kwKnopf", "#kampfwahl", "#bereiche", "#statusleiste", "#winMin", "#winMax"].map((q) => document.querySelector(q).getClientRects().length),
      top: document.querySelector(".top").getBoundingClientRect().height,
      klasse: document.documentElement.classList.contains("kfenster"),
      zu: document.querySelector("#winClose").getClientRects().length,
      quer: document.documentElement.scrollWidth > innerWidth }));
    assert(k.weg.every((n) => n === 0) && Math.abs(k.top - 26) < 0.5 && k.klasse && k.zu === 1,
      "Kompaktfenster: der Streifen (26 Punkt) ohne Kampfwahl, Leisten und Minimieren, mit Schliessen", k);
    await p.waitForFunction(() => document.querySelector("#toast").classList.contains("on"), null, { timeout: 5000 }).catch(() => {});
    const m = await meldung(s);
    assert(m.an && m.text === TEXT.en.kurz, "Kompaktfenster: der Randlos-Hinweis beim ersten Mal", m);
    await bis(() => s.win.some((b) => b.do === "resize"));
    const resize = s.win.filter((b) => b.do === "resize");
    assert(resize.length >= 1 && resize.every((b) => b.win === "kompakt" && b.w >= 180 && b.h >= 24),
      "Kompaktfenster: es misst sich und bittet um seine eigene Groesse (win kompakt)", resize);
    assert(s.win.every((b) => b.win === "kompakt"), "jede Anfrage an /api/win nennt das Kompaktfenster", s.win);
    assert(!s.win.some((b) => ["material", "chrome", "size", "restore_size", "live", "maximize", "minimize"].includes(b.do)),
      "nichts fuer Rahmen, Material, Groesseneinstellung oder Taskleiste", s.win.map((b) => b.do));
    assert(!s.win.some((b) => b.do === "pin"), "Anheften steht an, ohne dass die Seite es erst setzt", s.win);
    // Anheften loesen gilt dem Kompaktfenster, und gemerkt wird es nicht
    await p.hover(".top");
    await p.click("#btnPin", { timeout: 5000 }).catch(() => {});
    await p.waitForFunction(() => document.querySelector("#btnPin").getAttribute("aria-pressed") === "false", null, { timeout: 5000 }).catch(() => {});
    const pin = s.win.filter((b) => b.do === "pin");
    assert(pin.length === 1 && pin[0].on === false && pin[0].win === "kompakt" && pin[0].remember === false,
      "Anheften im Kompaktfenster: fuer dieses Fenster, nicht gemerkt", pin);
    // Vollansicht: zum grossen Fenster, der Streifen geht zu - er selbst wechselt nicht
    await p.click("#btnCompact");
    await bis(() => s.win.some((b) => b.do === "kompakt"));
    const voll = s.win.filter((b) => b.do === "kompakt");
    assert(voll.length === 1 && voll[0].on === false && voll[0].win === "kompakt", "Vollansicht: das Kompaktfenster bittet ums Schliessen", voll);
    assert(await p.evaluate(() => document.body.classList.contains("compact")), "und bleibt selbst der Streifen");
    // Schliessen schliesst nur den Streifen
    await p.evaluate(() => document.querySelector("#winClose").click());
    await bis(() => s.win.some((b) => b.do === "close"));
    const close = s.win.filter((b) => b.do === "close");
    assert(close.length === 1 && close[0].win === "kompakt", "Schliessen im Streifen: nur das Kompaktfenster", close);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 13. im Kompaktfenster: Escape zweimal, das Kuerzel, Taskleiste und
     Live-Knopf gehoeren dem grossen Fenster. Mit Helfer (Pruefung N4, K1):
     dort wuerde ein Klick auf Live wirklich mitlesen. */
  {
    const text13 = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
    const s = await oeffne({ zwei: true, kfenster: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-20260925.txt", text: text13 },
                             config: { randlosGesehen: true } });
    const p = s.page;
    await p.waitForFunction(() => document.body.classList.contains("compact"), null, { timeout: 5000 }).catch(() => {});
    await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
    await bis(() => s.win.some((b) => b.do === "kompakt"));
    assert(s.win.filter((b) => b.do === "kompakt" && b.on === false).length === 1, "Escape zweimal: zur Vollansicht", s.win);
    s.zaehler.hotkey++;
    await p.waitForFunction(() => document.body.classList.contains("through"), null, { timeout: 5000 }).catch(() => {});
    const durch = s.win.filter((b) => b.do === "clickthrough");
    assert(durch.length === 1 && durch[0].on === true && durch[0].win === "kompakt" && await p.evaluate(() => !document.querySelector("#throughHint").hidden),
      "Kuerzel im Kompaktfenster: durchklickbar, die Pille mit dem Schloss", durch);
    const vorher = s.win.length;
    s.zaehler.compact++; s.zaehler.live++;
    await ruhig();
    assert(s.win.length === vorher && !(await p.evaluate(() => document.body.classList.contains("watching"))),
      "Taskleiste und Live-Knopf der Vorschau schalten im Kompaktfenster nichts", s.win.slice(vorher));
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 14. das Kompaktfenster startet, wie es geoeffnet wurde: durch das
     Kuerzel durchklickbar, mit Live, wenn das grosse Fenster live war */
  {
    const text = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
    const helfer = { dir: "C:\\Logs", file: "TLCombatLog-20260925.txt", text };
    const s = await oeffne({ zwei: true, kfenster: true, helfer, kompakt: { live: true, durch: true }, config: { randlosGesehen: true } });
    const p = s.page;
    await p.waitForFunction(() => document.body.classList.contains("watching") && document.body.classList.contains("through"), null, { timeout: 8000 }).catch(() => {});
    const z = await p.evaluate(() => ({ live: document.body.classList.contains("watching"), durch: document.body.classList.contains("through"),
      ruht: document.body.classList.contains("noFight") }));
    assert(z.live && !z.ruht, "mit live: der Streifen liest das Log mit und zeigt den Kampf", z);
    assert(z.durch && s.win.some((b) => b.do === "clickthrough" && b.on === true && b.win === "kompakt"), "mit durch: gleich durchklickbar", s.win);
    assert(!s.win.some((b) => b.do === "live"), "der Punkt in der Taskleiste bleibt Sache des grossen Fensters", s.win);
    await p.close();
    const t = await oeffne({ zwei: true, kfenster: true, helfer, config: { randlosGesehen: true } });
    await t.page.waitForFunction(() => document.body.classList.contains("compact"), null, { timeout: 5000 }).catch(() => {});
    await bis(() => t.win.some((b) => b.do === "resize"));
    await ruhig();
    const y = await t.page.evaluate(() => ({ live: document.body.classList.contains("watching"), durch: document.body.classList.contains("through") }));
    assert(!y.live && !y.durch && !t.win.some((b) => b.do === "clickthrough"), "ohne beides: weder Live noch Durchklick von selbst", { y, win: t.win });
    await t.page.close();
  }
  /* --- 15. von Hand gezogen (kompakthand): der Streifen behaelt die Groesse.
     Nachgeschaerft (Pruefung N4, W5): das Beispiel ein zweites Mal ergab
     dieselbe Groesse, und die fragte der Streifen ohnehin nicht nach. Jetzt
     werden die Zeilen hoeher gestellt (nur im Test) und ein Themawechsel
     zeichnet neu - das ergaebe eine andere Groesse. */
  {
    const s = await oeffne({ zwei: true, kfenster: true, config: { randlosGesehen: true } });
    const p = s.page;
    await p.waitForFunction(() => document.body.classList.contains("compact"), null, { timeout: 5000 }).catch(() => {});
    await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
    await p.waitForFunction(() => !document.body.classList.contains("noFight"), null, { timeout: 5000 }).catch(() => {});
    await bis(() => s.win.some((b) => b.do === "resize"));
    await ruhig();
    const hoeher = (px, thema) => p.evaluate(([x, th]) => {
      let st = document.querySelector("#probe-zeilen");
      if (!st) { st = document.createElement("style"); st.id = "probe-zeilen"; document.head.appendChild(st); }
      st.textContent = "body.compact #bars .row{min-height:" + x + "px !important}";
      document.querySelector('#themeRow button[data-theme="' + th + '"]').click();
    }, [px, thema]);
    const letzte = () => s.win.filter((b) => b.do === "resize").at(-1);
    // Gegenprobe: ohne Hand bittet der Streifen um die neue, hoehere Groesse
    let n = s.win.filter((b) => b.do === "resize").length;
    const h0 = letzte().h;
    await hoeher(30, "light");
    assert(await bis(() => s.win.filter((b) => b.do === "resize").length > n && letzte().h > h0),
      "ohne Hand: hoehere Zeilen, der Streifen bittet um eine groessere Hoehe (Gegenprobe)", s.win.slice(n));
    await ruhig();
    s.zaehler.kompakthand++;
    await ruhig();
    /* Folgt Kompakt-Fix (01.10.), Hoechstgroesse: von Hand gezogen nennt der
       Streifen seine Groesse noch als Grenze (art "hand", Abschnitt 26) -
       gezaehlt werden die Bitten, das Fenster zu setzen, gleich streng. */
    const setzt = () => s.win.filter((b) => b.do === "resize" && b.art !== "hand");
    n = setzt().length;
    await hoeher(38, "dark");
    await ruhig();
    assert(setzt().length === n, "von Hand gezogen: keine gerechnete Groesse mehr darueber", setzt().slice(n));
    await p.close();
  }
  /* --- 16. Rueckfall: im Browser meldet der Helfer das Kompaktfenster auch,
     aber der Tab schrumpft sich selbst wie bisher; in der App ohne
     kompaktFenster (Linux, Windows ohne Acrylic) ebenso (Abschnitte 3-7) */
  {
    const s = await oeffne({ app: false, zwei: true });
    await kompakt(s);
    assert(await s.page.evaluate(() => document.body.classList.contains("compact")) && !s.win.some((b) => b.do === "kompakt"),
      "Browser: Kompakt im selben Tab, ohne Kompaktfenster", s.win);
    await s.page.close();
    const t = await oeffne();
    await kompakt(t);
    assert(await t.page.evaluate(() => document.body.classList.contains("compact")) && !t.win.some((b) => b.do === "kompakt")
      && t.win.some((b) => b.do === "resize" && b.win === "main"),
      "App ohne Kompaktfenster: das grosse Fenster schrumpft wie bisher (win main)", t.win);
    await t.page.close();
  }
  /* --- 17. der Satz aus #57: ein Fenster ueber dem Spiel, kein Overlay im
     Spiel - im Menue des Streifens und in den Einstellungen, DE und EN,
     nur in der App */
  {
    const SATZ = { en: "A normal Windows window above the game, not an overlay in the game. Borometer does not touch the game.",
                   de: "Ein normales Windows-Fenster \u00fcber dem Spiel, kein Overlay im Spiel. Borometer greift nicht auf das Spiel zu." };
    for (const lang of ["en", "de"]) {
      const s = await oeffne({ zwei: true, kfenster: true, lang, config: { randlosGesehen: true } });
      await s.page.waitForFunction(() => document.body.classList.contains("compact"), null, { timeout: 5000 }).catch(() => {});
      await s.page.evaluate(() => document.querySelector("#btnMore").click());
      const n = await s.page.evaluate(() => { const e = document.querySelector("#fensterNote"); return { hidden: e.hidden, text: e.textContent, da: e.getClientRects().length > 0 }; });
      assert(!n.hidden && n.da && n.text === SATZ[lang], `${lang}: der Satz steht im Menue des Streifens`, n);
      await s.page.close();
      const g = await oeffne({ zwei: true, lang });
      await g.page.click('#bereiche [data-tab="settings"]');
      await g.page.click('#einstNav button[data-gruppe="overlay"]');
      const e = await g.page.evaluate(() => { const x = document.querySelector("#eFensterSatz"); return { da: x.getClientRects().length > 0, text: x.textContent }; });
      assert(e.da && e.text === SATZ[lang], `${lang}: der Satz steht in den Einstellungen unter Overlay`, e);
      await g.page.close();
    }
    const b = await oeffne({ app: false });
    const x = await b.page.evaluate(() => ({ menue: document.querySelector("#fensterNote").hidden }));
    assert(x.menue, "Browser: der Satz steht nicht im Menue", x);
    await b.page.close();
  }
  /* --- 18. der Streifen schreibt nichts Gespeichertes und meldet der Gruppe
     nichts (Pruefung N4, W3/W4/K4): nur seine Fensterfahnen ueber /api/win
     und randlosGesehen. Mit Helfer, Live und Gruppe; Thema, Groesse,
     Durchsicht und Geist werden gestellt, das Log laeuft. Gegenprobe:
     dieselben Handgriffe im grossen Fenster schreiben und melden. */
  {
    const text = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
    const helfer = { dir: "C:\\Logs", file: "TLCombatLog-20260925.txt", text };
    const handgriffe = async (p) => {
      await p.evaluate(() => {
        document.querySelector('#themeRow button[data-theme="light"]').click();
        document.querySelector("#zoomIn").click();
        const r = document.querySelector("#seeSlide"); r.value = "20";
        r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true }));
        document.querySelector("#btnGhost").click();
      });
      // die Gruppe fragt alle 3 s ab und meldet dann
      await new Promise((r) => setTimeout(r, 4000));
    };
    const s = await oeffne({ zwei: true, kfenster: true, helfer, gruppe: true, config: { randlosGesehen: false } });
    const p = s.page;
    // erst der Randlos-Hinweis quittiert, dann Live (wie mit live: true geoeffnet, nur spaeter)
    await p.waitForFunction(() => !!document.querySelector("#toast .tact"), null, { timeout: 5000 }).catch(() => {});
    await p.evaluate(() => document.querySelector("#toast .tact")?.click());
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await p.waitForFunction(() => document.body.classList.contains("watching") && !document.body.classList.contains("noFight"), null, { timeout: 8000 }).catch(() => {});
    await handgriffe(p);
    assert(await p.evaluate(() => document.body.classList.contains("watching")), "Streifen: Live laeuft (sonst prueft die Probe nichts)");
    assert(JSON.stringify(s.posts) === JSON.stringify([{ randlosGesehen: true }]),
      "Streifen: in die Einstellungen geht nur randlosGesehen", s.posts);
    assert(!s.schreibt.filter((w) => w !== "/api/config").length,
      "Streifen: kein POST an /api/best, /api/builds oder /api/party/report", s.schreibt);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
    // Gegenprobe im grossen Fenster
    const g = await oeffne({ zwei: true, helfer, gruppe: true, config: { randlosGesehen: true } });
    await g.page.click("#btnWatch");
    await g.page.waitForFunction(() => document.body.classList.contains("watching") && !document.body.classList.contains("noFight"), null, { timeout: 8000 }).catch(() => {});
    await handgriffe(g.page);
    const schluessel = [...new Set(g.posts.flatMap((b) => Object.keys(b)))];
    assert(["theme", "uiZoom", "compactAlpha", "ghost"].every((k) => schluessel.includes(k)) && g.schreibt.includes("/api/party/report"),
      "Gegenprobe: das grosse Fenster schreibt dieselben Handgriffe und meldet der Gruppe", { schluessel, schreibt: g.schreibt });
    await g.page.close();
  }
  /* --- 19. die Meldung im Streifen geht: die Tafel schneidet neu, keine
     Zeile Leere darunter (Pruefung N4, M3). Das Fenster ist so gross wie
     der Streifen ohne Meldung. Wie im Nachbau der Pruefung: der
     Randlos-Hinweis steht beim ersten Zeichnen und geht nach 12 s. */
  {
    const s = await oeffne({ zwei: true, kfenster: true, lang: "de", breite: 300, hoehe: 330, config: { randlosGesehen: false } });
    const p = s.page;
    await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
    await p.waitForFunction(() => !document.body.classList.contains("noFight"), null, { timeout: 5000 }).catch(() => {});
    const mass = () => p.evaluate(() => {
      const b = document.querySelector("#bars"), r = b.getBoundingClientRect();
      const ganz = [...b.querySelectorAll(".row:not(.sub)")].filter((z) => z.getBoundingClientRect().bottom <= r.bottom + 1).length;
      return { meldung: document.querySelector("#toast").classList.contains("on"), luecke: Math.round(innerHeight - r.bottom), ganz };
    });
    await p.waitForFunction(() => document.querySelector("#toast").classList.contains("on"), null, { timeout: 3000 }).catch(() => {});
    const mit = await mass();
    await p.waitForFunction(() => !document.querySelector("#toast").classList.contains("on"), null, { timeout: 16000 }).catch(() => {});
    await p.waitForFunction(() => { const b = document.querySelector("#bars"); return innerHeight - b.getBoundingClientRect().bottom <= 2; },
      null, { timeout: 2000 }).catch(() => {});
    const ohne = await mass();
    assert(mit.meldung && !ohne.meldung && ohne.luecke <= 2 && ohne.ganz > mit.ganz,
      "Meldung weg: die Tafel reicht wieder bis unten, mit einer Zeile mehr", { mit, ohne });
    await p.close();
  }
  /* --- 20. das Kompaktfenster hat einen eigenen Titel (Pruefung N4, K6),
     in beiden Sprachen; das grosse behaelt seinen */
  {
    const s = await oeffne({ zwei: true, kfenster: true, config: { randlosGesehen: true } });
    await s.page.waitForFunction(() => document.body.classList.contains("compact"), null, { timeout: 5000 }).catch(() => {});
    const en = await s.page.title();
    await s.page.evaluate(() => document.querySelector("#btnLang").click());
    await s.page.waitForFunction(() => document.title !== "Borometer \u00b7 Compact", null, { timeout: 3000 }).catch(() => {});
    const de = await s.page.title();
    assert(en === "Borometer \u00b7 Compact" && de === "Borometer \u00b7 Kompakt", "Titel des Kompaktfensters in EN und DE", { en, de });
    await s.page.close();
    const g = await oeffne({ zwei: true });
    assert((await g.page.title()) === "Borometer \u2014 The Hive", "das grosse Fenster behaelt seinen Titel", await g.page.title());
    await g.page.close();
  }
  /* --- 21. das Kernbild im Kompakt (Abschlusspruefung, M2): die Marke ist
     dort 13 Punkt, das Bild darin ebenso - nicht 18 ueber die Marke hinaus.
     Eine aufgeklappte Unterzeile bekommt von Hand eine Marke in der Form,
     wie coreBadge sie baut (mit Bild eines Kerns, ohne Bilder die
     gezeichnete): gemessen wird die Groesse dort, nicht coreBadge selbst. */
  {
    const s = await oeffne({ app: false });
    const p = s.page;
    await p.evaluate(() => document.querySelector("#btnSample").click());
    await p.waitForFunction(() => document.querySelectorAll("#bars .row:not(.sub)").length > 0, null, { timeout: 5000 }).catch(() => {});
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await p.waitForFunction(() => document.body.classList.contains("compact"), null, { timeout: 5000 }).catch(() => {});
    await p.evaluate(() => document.querySelector("#bars .row.has-sub")?.click());
    await p.waitForFunction(() => !!document.querySelector("#bars .row.sub"), null, { timeout: 5000 }).catch(() => {});
    const m = BILDER ? await p.evaluate(() => {
      const src = document.querySelector("#bars .cmark.kernbild img")?.src;
      const sub = document.querySelector("#bars .row.sub");
      if (!src || !sub) return { src: !!src, sub: !!sub };
      sub.querySelectorAll(".cmark").forEach((x) => x.remove());
      const mark = document.createElement("i");
      mark.className = "cmark kernbild";
      mark.innerHTML = '<img src="' + src + '" alt="">';
      (sub.querySelector(".nmt") || sub.firstElementChild).after(mark);
      const a = mark.getBoundingClientRect(), b = mark.firstElementChild.getBoundingClientRect();
      return { marke: [a.width, a.height], bild: [b.width, b.height] };
    }) : await p.evaluate(() => {
      /* ohne Bilder: was dieser Zweig misst, und was nicht. Gruppiert nach
         Faehigkeit sind die Unterzeilen Trefferarten (catMode), coreBadge
         malt dort keine Marke; beide Zweige setzen sie deshalb von Hand ein.
         Hier wird die gezeichnete Marke einer Hauptzeile in die Unterzeile
         kopiert und gemessen: das Kompakt-CSS macht sie 13 Punkt gross, und
         der Stein liegt ganz darin. Ob coreBadge in einer Unterzeile eine
         Marke rendert, prueft dieser Zweig nicht. */
      const gem = document.querySelector("#bars .cmark:not(.kernbild) svg")?.closest(".cmark");
      const sub = document.querySelector("#bars .row.sub");
      if (!gem || !sub || document.querySelector("#bars .cmark.kernbild")) return { gem: !!gem, sub: !!sub, kernbild: !!document.querySelector("#bars .cmark.kernbild") };
      sub.querySelectorAll(".cmark").forEach((x) => x.remove());
      const mark = gem.cloneNode(true);
      (sub.querySelector(".nmt") || sub.firstElementChild).after(mark);
      const a = mark.getBoundingClientRect(), b = mark.querySelector("svg").getBoundingClientRect();
      return { marke: [a.width, a.height], gem: [b.width, b.height],
        drin: b.left >= a.left && b.right <= a.right && b.top >= a.top && b.bottom <= a.bottom };
    });
    assert(BILDER ? m.marke && m.marke[0] === 13 && m.bild[0] === m.marke[0] && m.bild[1] === m.marke[1]
      : m.marke && m.marke[0] === 13 && m.marke[1] === 13 && m.gem[0] > 0 && m.drin,
      "Kompakt: das Kernbild ist so gross wie seine Marke (13 Punkt)" + (BILDER ? "" : " (ohne Spielbilder: die gezeichnete Marke, 13 Punkt, der Stein darin)"), m);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 22. Kompakt-Fix (Befund 01.10.): die Vollansicht zeigt einen
     Kampf, der Streifen sagte "No log". Jetzt gibt die Vollansicht beim
     Oeffnen ihren Stand mit (/api/win "stand", vor "kompakt"): den
     Dateinamen und den Start des gewaehlten Kampfs, und sie folgt einem
     Kampfwechsel, solange der Streifen offen ist. Sonst nur den Grund:
     Beispiel, mehrere Dateien, Live. */
  const kampf = {};
  {
    const work = mkdtempSync(join(tmpdir(), "boro-stand-"));
    try {
      const f = join(work, LOGNAME), g = join(work, "TLCombatLog-20260924.txt");
      writeFileSync(f, LOG2); writeFileSync(g, LOG2);
      const s = await oeffne({ zwei: true, config: { randlosGesehen: true } });
      const p = s.page;
      const staende = () => s.win.filter((b) => b.do === "stand");
      // die grosse Zahl zaehlt sonst hoch: abgelesen wird der Endwert
      await p.emulateMedia({ reducedMotion: "reduce" });
      await p.setInputFiles("#fileInput", f);
      await p.waitForFunction(() => !document.body.classList.contains("noFight") && document.querySelectorAll("#bars .row").length > 0, null, { timeout: 5000 }).catch(() => {});
      kampf.dpsNeu = await p.textContent("#hDps");
      await p.evaluate(() => document.querySelector("#kwVor").click());
      await p.waitForFunction((d) => document.querySelector("#hDps").textContent !== d, kampf.dpsNeu, { timeout: 5000 }).catch(() => {});
      kampf.dpsAlt = await p.textContent("#hDps");
      assert(kampf.dpsAlt !== kampf.dpsNeu, "Vollansicht: zwei Pulls, der aeltere gewaehlt (sonst prueft die Probe nichts)", kampf);
      assert(!staende().length, "solange kein Streifen offen ist, geht kein Stand hinaus", staende());
      await p.click("#btnCompact");
      await bis(() => s.win.some((b) => b.do === "kompakt"));
      const iStand = s.win.findIndex((b) => b.do === "stand"), iAuf = s.win.findIndex((b) => b.do === "kompakt");
      const st = s.win[iStand];
      assert(iStand >= 0 && iStand < iAuf && st?.win === "main" && st.grund === "datei" && st.datei === LOGNAME && Number.isSafeInteger(st.kampf),
        "Oeffnen: zuerst der Stand (Datei aus dem Log-Ordner, gewaehlter Kampf), dann das Kompaktfenster", s.win);
      assert(JSON.stringify(Object.keys(st || {}).sort()) === JSON.stringify(["datei", "do", "grund", "kampf", "win"]),
        "der Stand hat nur benannte Felder: grund, datei, kampf", st);
      kampf.alt = st?.kampf;
      // Kampfwechsel in der Vollansicht: der Stand folgt
      await p.evaluate(() => document.querySelector("#kwNach").click());
      await bis(() => staende().length >= 2);
      kampf.neu = staende().at(-1)?.kampf;
      assert(staende().length >= 2 && staende().at(-1)?.datei === LOGNAME && Number.isSafeInteger(kampf.neu) && kampf.neu > kampf.alt,
        "Kampfwechsel: die Vollansicht nennt den neuen Kampf (spaeterer Start)", staende());
      // dasselbe noch einmal zeichnen schickt nichts Neues
      const n = staende().length;
      await p.evaluate(() => document.querySelector('#themeRow button[data-theme="light"]').click());
      await ruhig();
      assert(staende().length === n, "ein Neuzeichnen ohne Wechsel schickt keinen neuen Stand", staende().slice(n));
      // zwei Dateien: nur der Grund, kein Name
      await p.setInputFiles("#fileInput", [f, g]);
      await bis(() => staende().at(-1)?.grund === "mehrere");
      assert(staende().at(-1)?.grund === "mehrere" && staende().at(-1)?.datei === "" && staende().at(-1)?.kampf === null,
        "zwei Dateien zugleich: Grund mehrere, ohne Namen", staende().at(-1));
      // das Beispiel: nur der Grund
      await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
      await bis(() => staende().at(-1)?.grund === "beispiel");
      assert(staende().at(-1)?.grund === "beispiel" && staende().at(-1)?.datei === "" && staende().at(-1)?.kampf === null,
        "das Beispiel: Grund beispiel, ohne Namen", staende().at(-1));
      // Streifen zu: kein Stand mehr
      await p.click("#btnCompact");
      await p.waitForFunction(() => document.querySelector("#btnCompact").getAttribute("aria-pressed") === "false", null, { timeout: 5000 }).catch(() => {});
      const m = staende().length;
      await p.setInputFiles("#fileInput", f);
      await ruhig();
      assert(staende().length === m, "Streifen zu: die Vollansicht schickt keinen Stand", staende().slice(m));
      assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
      await p.close();
      // Live: der Grund live, wie heute laeuft der Streifen dann selbst mit
      const text = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
      const l = await oeffne({ zwei: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-20260925.txt", text }, config: { randlosGesehen: true } });
      await l.page.click("#btnWatch");
      await l.page.waitForFunction(() => document.body.classList.contains("watching"), null, { timeout: 5000 }).catch(() => {});
      await l.page.click("#btnCompact");
      await bis(() => l.win.some((b) => b.do === "kompakt"));
      const ls = l.win.filter((b) => b.do === "stand").at(-1);
      assert(ls && ls.grund === "live" && ls.datei === "" && ls.kampf === null && l.win.find((b) => b.do === "kompakt").live === true,
        "Live: Grund live, das Kompaktfenster laeuft mit wie bisher", l.win);
      await l.page.close();
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  /* --- 23. das Kompaktfenster laedt die Datei der Vollansicht ueber
     GET /api/log?name= (N3) und waehlt denselben Kampf; es folgt einem
     Kampfwechsel (Ereignis kompaktstand). Live startet es dabei nicht.
     Gutachten N5: die Starts stehen fest (START); die Zahlen der
     Vollansicht kommen aus 22 - fehlen sie, sagt die Probe das selbst. */
  assert(kampf.alt === START[0] && kampf.neu === START[1] && !!kampf.dpsAlt && !!kampf.dpsNeu,
    "Abschnitt 22 lieferte die Starts (wie START) und die Zahlen der Vollansicht, die 23 braucht", kampf);
  {
    const s = await oeffne({ zwei: true, kfenster: true, dateien: { [LOGNAME]: LOG2 }, config: { randlosGesehen: true },
                             kompakt: { grund: "datei", datei: LOGNAME, kampf: START[0] } });
    const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.waitForFunction(() => !document.body.classList.contains("noFight"), null, { timeout: 8000 }).catch(() => {});
    const z = await p.evaluate(() => ({ ruht: document.body.classList.contains("noFight"), dps: document.querySelector("#hDps").textContent,
      live: document.body.classList.contains("watching"), idle: document.querySelector("#compactIdle").getClientRects().length }));
    assert(!z.ruht && z.idle === 0 && s.logs.includes(LOGNAME), "Streifen: die Datei der Vollansicht ueber /api/log, kein \"No log\"", { z, logs: s.logs });
    assert(z.dps === kampf.dpsAlt, "Streifen: derselbe Kampf wie in der Vollansicht (der aeltere)", { z, kampf });
    assert(!z.live, "Streifen: Live startet dabei nicht", z);
    s.kompakt.kampf = START[1]; s.zaehler.kompaktstand++;
    await p.waitForFunction((d) => document.querySelector("#hDps").textContent === d, kampf.dpsNeu, { timeout: 5000 }).catch(() => {});
    assert((await p.textContent("#hDps")) === kampf.dpsNeu, "Kampfwechsel in der Vollansicht: der Streifen folgt", { dps: await p.textContent("#hDps"), kampf });
    assert(s.logs.filter((x) => x === LOGNAME).length === 1, "derselbe Name: die Datei wird nicht neu geholt", s.logs);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 24. nicht im Log-Ordner (hineingezogen: /api/log kennt den Namen
     nicht), das Beispiel, mehrere Dateien: ein klarer Satz im Streifen statt
     "No log", DE und EN, ganz zu lesen; ohne Grund bleibt "No log" */
  {
    const SATZ = {
      en: { fremd: "File not in the log folder", beispiel: "Sample: full view only", mehrere: "Several files: full view only", leer: "No log" },
      de: { fremd: "Datei nicht im Log-Ordner", beispiel: "Beispiel: nur in der Vollansicht", mehrere: "Mehrere Dateien: nur in der Vollansicht", leer: "Kein Log" },
    };
    for (const lang of ["en", "de"]) {
      for (const [grund, kompakt] of [["fremd", { grund: "datei", datei: "Mitschnitt.txt", kampf: 1 }], ["beispiel", { grund: "beispiel", datei: "", kampf: null }],
                                       ["mehrere", { grund: "mehrere", datei: "", kampf: null }], ["leer", { grund: "leer", datei: "", kampf: null }]]) {
        const s = await oeffne({ zwei: true, kfenster: true, lang, dateien: {}, folgt: true, breite: 300, hoehe: 28, config: { randlosGesehen: true }, kompakt });
        const p = s.page;
        await p.waitForFunction((t) => document.querySelector("#compactIdle").textContent === t, SATZ[lang][grund], { timeout: 5000 }).catch(() => {});
        await bis(() => s.win.some((b) => b.do === "resize"));
        await ruhig();
        const z = await p.evaluate(() => { const e = document.querySelector("#compactIdle"), r = e.getBoundingClientRect();
          const t = document.createRange(); t.selectNodeContents(e);
          return { text: e.textContent, title: e.title, ruht: document.body.classList.contains("noFight"), sichtbar: e.getClientRects().length > 0,
                   ganz: t.getBoundingClientRect().width <= r.width + 0.5, quer: document.documentElement.scrollWidth > innerWidth }; });
        assert(z.ruht && z.sichtbar && z.text === SATZ[lang][grund] && z.ganz && !z.quer && z.title.length > z.text.length,
          `${lang}, ${grund}: der Satz steht ganz im Streifen, der title sagt mehr`, z);
        assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
        await p.close();
      }
    }
  }
  /* --- 25. Hoechstgroesse (Kompakt-Fix 2): auch von Hand gezogen meldet der
     Streifen seine gerechnete Groesse - nur als Grenze (art "hand"), aus
     der der Hauptprozess die Hoechstgroesse macht; die Groesse selbst bleibt
     die der Hand. */
  {
    const s = await oeffne({ zwei: true, kfenster: true, config: { randlosGesehen: true } });
    const p = s.page;
    await p.waitForFunction(() => document.body.classList.contains("compact"), null, { timeout: 5000 }).catch(() => {});
    await bis(() => s.win.some((b) => b.do === "resize"));
    await ruhig();
    s.zaehler.kompakthand++;
    await ruhig();
    const n = s.win.length;
    await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
    await p.waitForFunction(() => !document.body.classList.contains("noFight"), null, { timeout: 5000 }).catch(() => {});
    await bis(() => s.win.slice(n).some((b) => b.do === "resize" && b.art === "hand"));
    // das Beispiel kommt aus dem Menue: dessen Wachsen und Zurueck zaehlen hier nicht
    const r = s.win.slice(n).filter((b) => b.do === "resize" && b.art !== "menue" && b.art !== "zurueck");
    assert(r.length >= 1 && r.every((b) => b.art === "hand" && b.win === "kompakt") && r.at(-1).h > 100,
      "von Hand gezogen: der Streifen nennt seine Groesse nur als Grenze (art hand)", r);
    // die Antwort traegt die Hoehe der Hand: das ist keine "nicht uebernommene" Groesse
    const mm = await meldung(s);
    assert(!mm.an || !/did not apply/.test(mm.text), "von Hand gezogen: keine Meldung, Windows habe die Groesse nicht uebernommen", mm);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  /* --- 26. das Menue im Streifen ist ganz zu sehen (Befund 01.10.): es lag
     im 28 Punkt hohen Streifen und war abgeschnitten. Das Fenster waechst,
     solange es offen ist (resize mit art "menue"), und kehrt beim Schliessen
     zurueck (art "zurueck"); dazwischen schickt der Streifen keine eigene
     Groesse. Leer und mit Kampf, EN und DE. */
  {
    for (const [lang, mitKampf] of [["en", false], ["de", true]]) {
      const s = await oeffne({ zwei: true, kfenster: true, lang, folgt: true, breite: 300, hoehe: 28, config: { randlosGesehen: true } });
      const p = s.page;
      await p.waitForFunction(() => document.body.classList.contains("compact"), null, { timeout: 5000 }).catch(() => {});
      if (mitKampf) {
        await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
        await p.waitForFunction(() => !document.body.classList.contains("noFight"), null, { timeout: 5000 }).catch(() => {});
        await p.waitForFunction(() => innerHeight > 100, null, { timeout: 5000 }).catch(() => {});
        // das Beispiel kam aus dem Menue: es ging zu, waehrend der Kampf kam - danach der Streifen mit Kampf, nicht der leere
        assert(p.viewportSize().height > 100, "Beispiel aus dem Menue: danach hat das Fenster die Hoehe des Streifens mit Kampf", p.viewportSize());
      }
      await bis(() => s.win.some((b) => b.do === "resize"));
      await ruhig();
      const vorher = p.viewportSize();
      const n = s.win.length;
      await p.click("#btnMore");
      await bis(() => s.win.slice(n).some((b) => b.do === "resize" && b.art === "menue"));
      await p.waitForFunction(() => { const q = document.querySelector("#morePanel"), r = q.getBoundingClientRect();
        return !q.hidden && r.bottom <= innerHeight && q.scrollHeight <= q.clientHeight + 1; }, null, { timeout: 5000 }).catch(() => {});
      const m = await p.evaluate(() => { const q = document.querySelector("#morePanel"), r = q.getBoundingClientRect();
        // was im Menue zu sehen ist, bis zum letzten Satz ("... in der Vollansicht")
        const teile = [...q.querySelectorAll("*")].filter((x) => x.getClientRects().length);
        const letzte = { bottom: teile.length ? Math.max(...teile.map((x) => x.getBoundingClientRect().bottom)) : Infinity };
        return { offen: !q.hidden, unten: r.bottom, rechts: r.right, links: r.left, ih: innerHeight, iw: innerWidth,
                 rollt: q.scrollHeight > q.clientHeight + 1, letzte: letzte.bottom }; });
      assert(m.offen && m.unten <= m.ih && m.rechts <= m.iw && m.links >= 0 && !m.rollt && m.letzte <= m.ih,
        `${lang}${mitKampf ? ", mit Kampf" : ", leer"}: das Menue ist ganz zu sehen, ohne zu rollen`, m);
      const menue = s.win.slice(n).filter((b) => b.do === "resize");
      assert(menue.length === 1 && menue[0].art === "menue" && menue[0].win === "kompakt" && menue[0].h > vorher.height,
        "das Fenster waechst fuer das Menue (resize, art menue)", menue);
      // offen: ein Neuzeichnen (Thema) schickt keine eigene Groesse
      const k = s.win.length;
      await p.evaluate(() => document.querySelector('#themeRow button[data-theme="light"]').click());
      await ruhig();
      assert(!s.win.slice(k).some((b) => b.do === "resize"), "solange das Menue offen ist, bleibt die Groesse", s.win.slice(k));
      // zu: zurueck auf die Groesse davor
      await p.keyboard.press("Escape");
      await bis(() => s.win.slice(k).some((b) => b.do === "resize" && b.art === "zurueck"));
      await p.waitForFunction((h) => innerHeight === h, vorher.height, { timeout: 5000 }).catch(() => {});
      assert(s.win.slice(k).some((b) => b.do === "resize" && b.art === "zurueck") && p.viewportSize().height === vorher.height
        && await p.evaluate(() => document.querySelector("#morePanel").hidden),
        "Menue zu: das Fenster kehrt auf seine Groesse zurueck", { zurueck: s.win.slice(k), jetzt: p.viewportSize(), vorher });
      // das Fenster verliert den Fokus (ein Klick ins Spiel): das Menue geht zu, das Fenster zurueck
      const mn = s.win.filter((b) => b.art === "menue").length;
      await p.click("#btnMore");
      await bis(() => s.win.filter((b) => b.art === "menue").length === mn + 1);
      const j = s.win.length;
      await p.evaluate(() => window.dispatchEvent(new Event("blur")));
      await bis(() => s.win.slice(j).some((b) => b.art === "zurueck"));
      assert(await p.evaluate(() => document.querySelector("#morePanel").hidden) && s.win.slice(j).some((b) => b.art === "zurueck"),
        "Klick ins Spiel (blur): das Menue geht zu, das Fenster zurueck", s.win.slice(j));
      /* Das Menue wird hoeher, nachdem es gemessen wurde (im echten Fenster
         bei 200 % Skalierung rollte es um ein paar Punkt): nachgemessen
         bittet der Streifen um so viel mehr. Hier macht ein Stil, gesetzt
         gleich nach dem Oeffnen, jeden Satz darin 24 Punkt hoeher. */
      await bis(() => s.win.at(-1)?.art === "zurueck");
      await ruhig();
      const mn2 = s.win.filter((b) => b.art === "menue").length;
      await p.evaluate(() => { document.querySelector("#btnMore").click();
        const st = document.createElement("style"); st.id = "probe-menue";
        st.textContent = "#morePanel .seenote{padding-bottom:24px !important}"; document.head.append(st); });
      await bis(() => s.win.filter((b) => b.art === "menue").length >= mn2 + 2);
      await p.waitForFunction(() => { const q = document.querySelector("#morePanel");
        return !q.hidden && q.scrollHeight <= q.clientHeight + 1 && q.getBoundingClientRect().bottom <= innerHeight; }, null, { timeout: 5000 }).catch(() => {});
      const m2 = await p.evaluate(() => { const q = document.querySelector("#morePanel");
        return { rollt: q.scrollHeight > q.clientHeight + 1, unten: q.getBoundingClientRect().bottom, ih: innerHeight }; });
      assert(s.win.filter((b) => b.art === "menue").length === mn2 + 2 && !m2.rollt && m2.unten <= m2.ih,
        "das Menue wurde nach dem Messen hoeher: nachgemessen, das Fenster waechst noch einmal, nichts rollt", { m2, win: s.win.slice(-3) });
      await p.evaluate(() => { document.querySelector("#probe-menue").remove(); document.querySelector("#btnMore").click(); });
      await bis(() => s.win.at(-1)?.art === "zurueck");
      assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
      await p.close();
    }
  }
  /* --- 27. Durchsicht im Kompaktfenster (Nachtrag 01.10.): beim
     Overlay-Test waren mit Durchsicht auch Zeilen, Symbole und Namen
     durchsichtig. DESIGN.md: Durchsicht bestimmt nur, wie viel vom Spiel
     durch den Grund scheint; auf Acrylic toent sie die Flaeche, das Fenster
     bleibt deckend. Hier startet der Streifen mit einer gemerkten
     Durchsicht (55), und /api/state - das sagt, ob Acrylic da ist - kommt
     nach /api/config. Das ist ein Schutz: der Hauptprozess liefert die
     Durchsicht heute nicht ueber /api/config; im echten Fenster prueft
     test-window den Streifen selbst. Ohne Acrylic gilt der Rueckfall wie
     bisher: das ganze Fenster blendet ab. */
  {
    const deckung = (p) => p.evaluate(() => {
      const eff = (el) => { let o = 1; for (let x = el; x && x.nodeType === 1; x = x.parentElement) o *= Number(getComputedStyle(x).opacity); return o; };
      const zeile = document.querySelector("#bars .row:not(.sub)");
      const teile = zeile ? [zeile, ...zeile.querySelectorAll("img, .nm, .nmt, .v, .num, i")].filter((x) => x.getClientRects().length) : [];
      return { teile: teile.length, min: teile.length ? Math.min(...teile.map(eff)) : 0, dps: eff(document.querySelector("#hDps")),
               glass: document.documentElement.style.getPropertyValue("--glass-a"), acrylic: document.documentElement.classList.contains("acrylic"),
               grund: getComputedStyle(document.body).backgroundColor };
    });
    const s = await oeffne({ zwei: true, kfenster: true, stateVerzug: 400, config: { randlosGesehen: true, compactAlpha: 0.45 } });
    const p = s.page;
    await p.evaluate(() => { document.querySelector("#btnMore").click(); document.querySelector("#btnSample").click(); });
    await p.waitForFunction(() => !document.body.classList.contains("noFight") && document.querySelectorAll("#bars .row").length > 0, null, { timeout: 5000 }).catch(() => {});
    await ruhig();
    const d = await deckung(p);
    const alphas = s.win.filter((b) => b.do === "seethrough").map((b) => b.alpha);
    assert(d.acrylic && d.glass === "0.650" && /rgba\(.*0\.65\)/.test(d.grund), "Acrylic, Durchsicht 55: nur der Grund ist getoent (--glass-a .65)", d);
    assert(alphas.length > 0 && alphas.every((a) => a === 1),
      "Acrylic, Durchsicht 55: das Fenster selbst bleibt deckend (seethrough alpha 1, auch beim Start)", alphas);
    assert(d.teile >= 3 && d.min === 1 && d.dps === 1, "Acrylic, Durchsicht 55: Zeilen, Namen, Symbole und die Zahl haben Deckkraft 1", d);
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
    // Rueckfall ohne Acrylic: das Fenster blendet ab, wie bisher
    const r = await oeffne({ zwei: true, kfenster: true, acrylic: false, stateVerzug: 400, config: { randlosGesehen: true, compactAlpha: 0.45 } });
    await bis(() => r.win.some((b) => b.do === "seethrough"));
    await ruhig();
    const ra = r.win.filter((b) => b.do === "seethrough").map((b) => b.alpha);
    assert(ra.length > 0 && Math.abs(ra.at(-1) - 0.45) < 1e-9, "ohne Acrylic: der Rueckfall wie bisher, das Fenster blendet auf .45 ab", ra);
    await r.page.close();
  }
  /* --- 28. Gutachten H1: was im leeren Streifen (28 Punkt, Grenze 56)
     ueber ihm aufgeht, ist ganz zu sehen und zu treffen - per echtem Klick,
     gemessen mit elementFromPoint: das Menue bis zum untersten Satz, ein
     Dialog (hier die Frage nach dem Log-Ordner) mit beiden Knoepfen,
     die Meldung beim ersten Mal (Randlos-Hinweis) mit ihrem Knopf. Danach
     ist das Fenster wieder der Streifen. Die Kampfwahl gibt es im Streifen
     nicht (Abschnitt 12). */
  {
    const trifft = (p, sel) => p.evaluate((q) => {
      const els = [...document.querySelectorAll(q)].filter((x) => x.getClientRects().length);
      const el = els.length ? els.reduce((a, b) => (b.getBoundingClientRect().bottom > a.getBoundingClientRect().bottom ? b : a)) : null;
      if (!el) return { da: false };
      const r = el.getBoundingClientRect(), x = r.left + Math.min(r.width / 2, 20), y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { da: true, trifft: !!hit && (el === hit || el.contains(hit)), unten: r.bottom, ih: innerHeight };
    }, sel);
    // das Menue, per echtem Klick
    const s = await oeffne({ zwei: true, kfenster: true, folgt: true, breite: 300, hoehe: 28, config: { randlosGesehen: true } });
    const p = s.page;
    await bis(() => s.win.some((b) => b.do === "resize"));
    await ruhig();
    await p.click("#btnMore");
    await p.waitForFunction(() => innerHeight > 100, null, { timeout: 5000 }).catch(() => {});
    await ruhig();
    const m = await trifft(p, "#morePanel > *");
    assert(m.da && m.trifft && m.unten <= m.ih, "Menue per Klick: der unterste Eintrag ist zu sehen und zu treffen (elementFromPoint)", m);
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => innerHeight === 28, null, { timeout: 5000 }).catch(() => {});
    // der Dialog: Live ohne Log-Ordner fragt nach dem Ordner
    /* Live ist im Streifen ausgeblendet, kein Knopf dort oeffnet heute
       einen Dialog. Ausgeloest wird er hier ueber den verborgenen Knopf, um
       zu zeigen: kommt doch einer (etwa ueber ein Kuerzel), bekommt er Platz. */
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await p.waitForFunction(() => document.querySelector("#modalBg").classList.contains("on"), null, { timeout: 5000 }).catch(() => {});
    await p.waitForFunction(() => innerHeight > 100, null, { timeout: 5000 }).catch(() => {});
    await ruhig();
    const ok = await trifft(p, "#modalOk"), ab = await trifft(p, "#modalCancel"), feld = await trifft(p, "#modalInput");
    assert(ok.trifft && ab.trifft && feld.trifft && ok.unten <= ok.ih, "Dialog im Streifen: Feld, OK und Abbrechen sind zu sehen und zu treffen", { ok, ab, feld });
    await p.click("#modalCancel");
    await p.waitForFunction(() => innerHeight === 28, null, { timeout: 5000 }).catch(() => {});
    assert(p.viewportSize().height === 28 && s.win.filter((b) => b.art === "zurueck").length === 2,
      "Dialog zu: das Fenster ist wieder der Streifen", { v: p.viewportSize(), arten: s.win.map((b) => b.art || b.do) });
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
    // die Meldung beim ersten Mal, im leeren Streifen
    const t = await oeffne({ zwei: true, kfenster: true, folgt: true, breite: 300, hoehe: 28, config: { randlosGesehen: false } });
    await t.page.waitForFunction(() => document.querySelector("#toast").classList.contains("on"), null, { timeout: 5000 }).catch(() => {});
    await t.page.waitForFunction(() => innerHeight > 40, null, { timeout: 5000 }).catch(() => {});
    await ruhig();
    const k = await trifft(t.page, "#toast .tact");
    assert(k.trifft && k.unten <= k.ih, "Meldung im leeren Streifen: ganz zu sehen, ihr Knopf zu treffen", k);
    await t.page.click("#toast .tact").catch(() => {});
    await t.page.waitForFunction(() => innerHeight === 28, null, { timeout: 5000 }).catch(() => {});
    assert(t.page.viewportSize().height === 28, "Meldung weg: das Fenster ist wieder der Streifen", t.page.viewportSize());
    await t.page.close();
  }
  /* --- 29. Gutachten M1, M3, N3, N4, N6: der Streifen sagt, wenn er der
     Vollansicht nicht folgen kann, statt still einen alten oder anderen
     Kampf zu zeigen. */
  {
    const SATZ = { fremd: "File not in the log folder", beispiel: "Sample: full view only", mehrere: "Several files: full view only",
                   andere: "Not a game log: full view only", kampf: "Fight not found in the file", fehler: "Log folder not readable right now",
                   leer: "No log" };
    const dateien = { [LOGNAME]: LOG2 };
    const s = await oeffne({ zwei: true, kfenster: true, dateien, config: { randlosGesehen: true },
                             kompakt: { grund: "datei", datei: LOGNAME, kampf: START[0] } });
    const p = s.page;
    const ruhe = () => p.evaluate(() => ({ ruht: document.body.classList.contains("noFight"), text: document.querySelector("#compactIdle").textContent,
      sichtbar: document.querySelector("#compactIdle").getClientRects().length > 0, title: document.querySelector("#compactIdle").title }));
    const stand = async (k) => { Object.assign(s.kompakt, k); s.zaehler.kompaktstand++; };
    const mitKampf = () => p.waitForFunction(() => !document.body.classList.contains("noFight"), null, { timeout: 8000 }).catch(() => {});
    await mitKampf();
    // M1: von einer Datei zu fremd, mehrere, Beispiel, kein Log, leer - der Kampf geht, der Satz kommt
    for (const [grund, k] of [["fremd", { grund: "datei", datei: "Mitschnitt.txt", kampf: 1 }], ["mehrere", { grund: "mehrere", datei: "", kampf: null }],
                              ["beispiel", { grund: "beispiel", datei: "", kampf: null }], ["andere", { grund: "andere", datei: "", kampf: null }],
                              ["leer", { grund: "leer", datei: "", kampf: null }]]) {
      await stand({ grund: "datei", datei: LOGNAME, kampf: START[0] });
      await mitKampf();
      await stand(k);
      await p.waitForFunction((t) => document.body.classList.contains("noFight") && document.querySelector("#compactIdle").textContent === t, SATZ[grund], { timeout: 5000 }).catch(() => {});
      const z = await ruhe();
      assert(z.ruht && z.sichtbar && z.text === SATZ[grund], `M1: Datei, dann ${grund} - der Streifen zeigt keinen alten Kampf, sondern den Satz`, z);
    }
    // M3: der Start steht nicht in der Datei - kein anderer Kampf, ein eigener Satz
    await stand({ grund: "datei", datei: LOGNAME, kampf: START[0] });
    await mitKampf();
    await stand({ grund: "datei", datei: LOGNAME, kampf: START[0] + 12345 });
    await p.waitForFunction((t) => document.body.classList.contains("noFight") && document.querySelector("#compactIdle").textContent === t, SATZ.kampf, { timeout: 5000 }).catch(() => {});
    const k3 = await ruhe();
    assert(k3.ruht && k3.text === SATZ.kampf && k3.title.length > k3.text.length, "M3: Kampf nicht gefunden - der Satz statt eines anderen Kampfs", k3);
    // M3: die Datei ist gewachsen, der neue Kampf steht erst in der frischen - einmal neu geholt
    await stand({ grund: "datei", datei: LOGNAME, kampf: START[0] });
    await mitKampf();
    const geholt = s.logs.filter((x) => x === LOGNAME).length;
    dateien[LOGNAME] = LOG3;
    await stand({ grund: "datei", datei: LOGNAME, kampf: START[2] });
    await bis(() => s.logs.filter((x) => x === LOGNAME).length > geholt);
    await mitKampf();
    const g = await p.evaluate(() => ({ ruht: document.body.classList.contains("noFight"), name: document.querySelector("#hName")?.textContent || "" }));
    assert(s.logs.filter((x) => x === LOGNAME).length === geholt + 1 && !g.ruht, "M3: Datei gewachsen - einmal frisch geholt, der neue Kampf steht da", { g, logs: s.logs.length });
    assert(!s.fehler.length, "keine Fehler auf der Seite", s.fehler);
    await p.close();
    // N3: der Helfer konnte nicht lesen (500) - nicht "nicht im Log-Ordner"
    const f = await oeffne({ zwei: true, kfenster: true, dateien: { [LOGNAME]: 500 }, config: { randlosGesehen: true },
                             kompakt: { grund: "datei", datei: LOGNAME, kampf: START[0] } });
    await f.page.waitForFunction((t) => document.querySelector("#compactIdle").textContent === t, SATZ.fehler, { timeout: 5000 }).catch(() => {});
    const fz = await f.page.evaluate(() => document.querySelector("#compactIdle").textContent);
    assert(fz === SATZ.fehler, "N3: Lesefehler des Helfers - eigener Satz, nicht \"nicht im Log-Ordner\"", fz);
    await f.page.close();
    // N4 und N6 in der Vollansicht: abgelehnter Stand wird wiederholt; eine Datei, die kein Log ist, heisst "andere"
    const work = mkdtempSync(join(tmpdir(), "boro-andere-"));
    try {
      const csv = join(work, "tabelle.csv"), log = join(work, LOGNAME);
      writeFileSync(csv, LOG2); writeFileSync(log, LOG2);
      const v = await oeffne({ zwei: true, config: { randlosGesehen: true } });
      const staende = () => v.win.filter((b) => b.do === "stand");
      await v.page.setInputFiles("#fileInput", log);
      await v.page.waitForFunction(() => !document.body.classList.contains("noFight"), null, { timeout: 5000 }).catch(() => {});
      v.standNein = 1;
      await v.page.click("#btnCompact");
      await bis(() => v.win.some((b) => b.do === "kompakt"));
      const n = staende().length;
      await v.page.evaluate(() => document.querySelector('#themeRow button[data-theme="light"]').click());
      await bis(() => staende().length > n);
      assert(n === 1 && staende().length === 2 && staende()[1].datei === LOGNAME,
        "N4: der Hauptprozess lehnte den Stand ab - beim naechsten Zeichnen geht er noch einmal", staende());
      await v.page.setInputFiles("#fileInput", csv);
      await bis(() => staende().at(-1)?.grund === "andere");
      assert(staende().at(-1)?.grund === "andere" && staende().at(-1)?.datei === "", "N6: eine Datei, die kein .txt/.log ist - Grund andere, ohne Namen", staende().at(-1));
      await v.page.close();
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
} catch (e) {
  failed++;
  console.log("  FAIL  " + (e && e.stack || e));
} finally {
  await browser.close();
}
if (failed) { console.log(`EXTRAS PAGE FAILED - ${failed}`); process.exit(1); }
console.log("EXTRAS PAGE PASSED");
