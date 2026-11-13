// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Hinweis beim ersten Besuch jedes Bereichs (Spezifikation
// docs/superpowers/specs/2026-10-16-rundgang-erweitert-design.md, 3.2, 3.3 und
// 5) an der gebauten Seite, vom gestellten Helfer ausgeliefert (page.route) -
// als eigenes Fenster der App (?win=1, nativeFrame) und als Tab im Browser.
// Was die Seite an /api/config schickt, wird mitgeschrieben.
//
// Run:  npm run test:hinweise-page     (baut die Seite zuerst)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 500))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Die Bereiche in der Reihenfolge der Symbolleiste, mit den Saetzen der Spezifikation (5.3). */
const BEREICHE = ["timeline", "rotation", "analysis", "compare", "history", "party", "weeklies", "gilde", "rekorde", "archiv", "settings"];
const TEXT = {
  de: {
    timeline: "Der Ring um deine DPS, rechts die Treffer. Strg+Pfeil links oder rechts wechselt den Kampf.",
    rotation: "Wann du was gewirkt hast, auf einer Zeitleiste. Die Leertaste spielt sie ab, die Pfeiltasten gehen Schritt für Schritt.",
    analysis: "Ordnet den Kampf nach Fähigkeiten und sagt, wo Schaden liegen blieb.",
    compare: "Zwei Kämpfe, Fähigkeit gegen Fähigkeit.",
    history: "Jeder Kampf, den Borometer gesehen hat, je Boss.",
    party: "Ein Board für alle, die mit dem Code beitreten.",
    weeklies: "Deine Wochenaufgaben je Charakter. Mit den Pfeiltasten gehst du durch die Kacheln.",
    gilde: "Die Liste deiner Gilde mit Punkten. Mit / suchst du, N legt ein Mitglied an.",
    rekorde: "Deine besten Pulls je Boss.",
    archiv: "Deine Bosskämpfe als Kopie, je Boss. Sie bleiben, auch wenn du die Kampflogs löschst.",
    settings: "Thema, Größe, Sprache und Schalter. Diese Hinweise schaltest du hier auch aus.",
  },
  en: {
    timeline: "The ring around your DPS, your hits on the right. Ctrl+Left or Right arrow switches the fight.",
    rotation: "When you cast what, on a timeline. Space plays it, the arrow keys step through it.",
    analysis: "Sorts the fight by skill and says where damage was left on the table.",
    compare: "Two fights, skill against skill.",
    history: "Every fight Borometer has seen, per boss.",
    party: "One board for everyone who joins with the code.",
    weeklies: "Your weekly tasks per character. The arrow keys move through the tiles.",
    gilde: "Your guild's list with points. / searches, N adds a member.",
    rekorde: "Your best pulls per boss.",
    archiv: "Copies of your boss fights, per boss. They stay even if you delete the combat logs.",
    settings: "Theme, size, language and switches. You can turn these notes off here too.",
  },
};
const OK = { de: "Verstanden", en: "Got it" };

/* Eine Seite am gestellten Helfer (wie test-rundgang-page.mjs). app: ?win=1 und
   nativeFrame, sonst ein Browser-Tab. config: was GET /api/config antwortet. Ohne
   eigene config ist es ein Bestandsnutzer, der den Rundgang kennt. */
async function oeffne({ app = true, lang = "de", config = {}, kfenster = false, suffix = "", breite = 1280, hoehe = 860,
  motion = "no-preference" } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe }, reducedMotion: motion });
  const s = { page, fehler: [], posts: [] };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/state") return json({ dir: "", file: "", nativeFrame: app, material: false, stayOnTop: false, kompaktFenster: kfenster });
    if (path === "/api/config" && req.method() === "GET") return json({ firstStart: false, rundgangGesehen: true, ...config });
    if (path === "/api/config") {
      const b = JSON.parse(req.postData() || "{}");
      if (Object.keys(b).join() !== "lang") s.posts.push(b);
      return json({ ok: true });
    }
    if (path === "/api/dir") return json({ ok: true });
    if (path === "/api/latest") return json({ file: "", from: 0, to: 0, size: 0, head: "", text: "" });
    if (path === "/api/win") return json({ ok: true, max: false, w: 400, h: 28, on_top: true });
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: {} }); }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path === "/api/logs") return json({ ok: true, files: [] });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html" + (app ? "?win=1" : "") + suffix);
  await page.waitForFunction(() => !!document.body.dataset.bereit);
  return s;
}
/* Ein Kampf da: der Beispielkampf von Start; danach sind alle Bereiche offen und der Bereich Kampf steht. */
const mitKampf = async (p) => {
  await p.click("#btnSample2");
  await p.waitForFunction(() => !document.querySelector('#bereiche [data-tab="analysis"]').disabled);
};
const geh = async (p, b) => {
  await p.click(`#bereiche [data-tab="${b}"]`);
  await p.waitForFunction((x) => document.querySelector(`#bereiche [data-tab="${x}"]`).getAttribute("aria-current") === "page", b);
};
/* Was der Streifen gerade zeigt (null: nichts). */
const streifen = (p) => p.evaluate(() => {
  const e = document.querySelector("#bereichsHinweis");
  if (!e || e.hidden || !e.getClientRects().length) return null;
  const st = document.querySelector("#stage");
  return { satz: document.querySelector("#bhSatz").textContent.trim(), ok: document.querySelector("#bhOk").textContent.trim(),
    rolle: e.getAttribute("role"), name: e.getAttribute("aria-label"), erstes: st.firstElementChild === e,
    beschr: st.getAttribute("aria-describedby"), hoch: Math.round(e.getBoundingClientRect().height),
    oben: Math.round(e.getBoundingClientRect().top), rollt: document.scrollingElement.scrollTop };
});
const bereichePosts = (s) => s.posts.filter((x) => "bereicheGezeigt" in x);
const helferRunde = (p) => p.evaluate(() => fetch("/api/ping").then(() => true));
/* Der Streifen ist da oder weg (Zustand, keine Zeit). */
const da = (p) => p.waitForFunction(() => { const e = document.querySelector("#bereichsHinweis"); return !!e && !e.hidden && e.getClientRects().length > 0; });
const weg = (p) => p.waitForFunction(() => { const e = document.querySelector("#bereichsHinweis"); return !e || e.hidden; });

try {
  // --- 1. Jeder Bereich zeigt beim ersten Besuch seinen Satz, in der App; gemerkt wird die Liste
  for (const lang of ["de", "en"]) {
    const s = await oeffne({ lang });
    const p = s.page;
    await mitKampf(p);
    await da(p);
    const k = await streifen(p);
    assert(k && k.satz === TEXT[lang].timeline && k.ok === OK[lang], `${lang}: nach dem Beispielkampf zeigt Kampf seinen Hinweis`, k);
    assert(k && k.rolle === "note" && k.erstes && k.beschr === "bhSatz" && !!k.name, `${lang}: role=note, erstes Element im Inhalt, der Inhalt beschreibt sich mit dem Satz`, k);
    for (const b of BEREICHE.slice(1)) {
      await geh(p, b);
      await da(p);
      const z = await streifen(p);
      assert(z && z.satz === TEXT[lang][b], `${lang}: ${b}: der Satz des Bereichs`, z);
      // der Wechsel rollt an den Anfang des Inhalts; der Streifen darf dabei nicht ueber den Bildrand rutschen
      assert(z && z.rollt === 0 && z.oben >= 0, `${lang}: ${b}: der Streifen steht im Bild, die Seite ist nicht um seine Hoehe verschoben`, z);
    }
    await helferRunde(p);
    const liste = bereichePosts(s);
    assert(liste.length === 11 && JSON.stringify(liste.at(-1)) === JSON.stringify({ bereicheGezeigt: BEREICHE }),
      `${lang}: je erstem Besuch ein POST, am Ende alle elf Kennungen in der Reihenfolge der Leiste`, liste.at(-1));
    assert(liste.every((x) => Object.keys(x).join() === "bereicheGezeigt"), `${lang}: es wird nur bereicheGezeigt geschrieben`, liste);
    // zweiter Besuch: nichts mehr, nichts Neues geschrieben
    const vor = s.posts.length;
    await geh(p, "rotation");
    await weg(p);
    await helferRunde(p);
    assert(!(await streifen(p)) && s.posts.length === vor, `${lang}: ein zweiter Besuch zeigt nichts und schreibt nichts`, s.posts.length - vor);
    assert(!s.fehler.length, `${lang}: keine Fehler auf der Seite`, s.fehler);
    await p.close();
  }

  // --- 2. Gemerkt aus den Einstellungen: ein gesehener Bereich kommt nicht wieder, ein anderer schon
  {
    const s = await oeffne({ config: { bereicheGezeigt: ["timeline", "rotation", "gibtesnicht"] } });
    const p = s.page;
    await mitKampf(p);
    await helferRunde(p);
    assert(!(await streifen(p)), "Kampf war schon gezeigt: nach dem Beispielkampf nichts", await streifen(p));
    await geh(p, "rotation");
    await helferRunde(p);
    assert(!(await streifen(p)), "Rotation war schon gezeigt: nichts", await streifen(p));
    await geh(p, "analysis");
    await da(p);
    await p.click("#bhOk");
    await weg(p);
    const l = bereichePosts(s).at(-1);
    assert(JSON.stringify(l) === JSON.stringify({ bereicheGezeigt: ["timeline", "rotation", "analysis"] }), "Analyse kommt dazu, Unbekanntes fehlt in der Liste", l);
    const f = await p.evaluate(() => ({ drin: !!document.querySelector("#bereichsHinweis")?.contains(document.activeElement), id: document.activeElement?.id || document.activeElement?.tagName }));
    assert(!f.drin && (await p.evaluate(() => !document.querySelector("#stage").hasAttribute("aria-describedby"))),
      "„Verstanden“: der Streifen ist weg, der Fokus haengt nicht im Leeren, die Beschreibung am Inhalt auch", f);
    await p.close();
  }

  // --- 3. Browser ohne App: der Hinweis kommt, aber nichts wird gemerkt
  {
    const s = await oeffne({ app: false });
    const p = s.page;
    await mitKampf(p);
    await da(p);
    assert((await streifen(p))?.satz === TEXT.de.timeline, "Browser: Kampf zeigt seinen Hinweis", await streifen(p));
    await geh(p, "rotation");
    await da(p);
    await geh(p, "timeline");
    await weg(p);
    await helferRunde(p);
    assert(!(await streifen(p)), "Browser: in der Sitzung kommt er nicht noch einmal", await streifen(p));
    assert(!bereichePosts(s).length, "Browser: kein POST mit bereicheGezeigt", s.posts);
    await p.close();
  }

  // --- 4. Der Schalter in den Einstellungen
  {
    const aus = await oeffne({ config: { bereichHinweise: false } });
    const p = aus.page;
    await mitKampf(p);
    await geh(p, "rotation");
    await helferRunde(p);
    assert(!(await streifen(p)) && !bereichePosts(aus).length, "Schalter aus (gespeichert): kein Hinweis, nichts gemerkt", aus.posts);
    await geh(p, "settings");
    const sw = await p.evaluate(() => { const b = document.querySelector("#eBereichHinweise");
      return b ? { rolle: b.getAttribute("role"), an: b.getAttribute("aria-checked"), sicht: b.getClientRects().length > 0,
        name: document.querySelector("#eBereichHinweiseName")?.textContent.trim(), info: !!b.closest("#eg-info") } : null; });
    assert(sw && sw.rolle === "switch" && sw.an === "false" && sw.sicht && sw.info && sw.name === "Hinweise zu den Bereichen", "der Schalter steht in Info, aus", sw);
    await p.click("#eBereichHinweise");
    await p.waitForFunction(() => document.querySelector("#eBereichHinweise").getAttribute("aria-checked") === "true");
    await helferRunde(p);
    assert(aus.posts.some((x) => x.bereichHinweise === true), "einschalten: POST {bereichHinweise: true}", aus.posts);
    await geh(p, "gilde");
    await da(p);
    assert((await streifen(p))?.satz === TEXT.de.gilde, "danach kommt der Hinweis des naechsten ersten Besuchs", await streifen(p));
    await p.close();
    // an (Standard): der Schalter steht an; ausschalten blendet einen offenen Streifen aus
    const an = await oeffne();
    const q = an.page;
    await mitKampf(q);
    await da(q);
    await geh(q, "settings");
    await da(q);
    assert(await q.evaluate(() => document.querySelector("#eBereichHinweise").getAttribute("aria-checked") === "true"), "Standard: der Schalter steht an");
    await q.click("#eBereichHinweise");
    await weg(q);
    await helferRunde(q);
    assert(an.posts.some((x) => x.bereichHinweise === false) && !(await streifen(q)), "ausschalten: POST {bereichHinweise: false}, der offene Streifen geht", an.posts);
    await geh(q, "weeklies");
    await helferRunde(q);
    assert(!(await streifen(q)), "danach kommt keiner mehr", await streifen(q));
    await q.close();
  }

  // --- 5. Kompaktfenster und Kompakt-Rueckfall: nichts
  {
    const kf = await oeffne({ suffix: "&kompakt=1", kfenster: true });
    await kf.page.waitForFunction(() => document.documentElement.classList.contains("kfenster"));
    await helferRunde(kf.page);
    assert(!(await streifen(kf.page)) && !bereichePosts(kf).length, "Kompaktfenster: kein Hinweis, nichts gemerkt", kf.posts);
    await kf.page.close();
    const s = await oeffne();
    const p = s.page;
    await mitKampf(p);
    await da(p);
    await p.click("#btnCompact");
    await p.waitForFunction(() => document.body.classList.contains("compact"));
    await weg(p);
    assert(!(await streifen(p)), "Kompakt-Rueckfall: der Streifen geht, wenn das Fenster Kompakt wird", await streifen(p));
    await p.close();
  }

  // --- 6. Solange die Frage oder der Rundgang offen ist, kommt keiner - und der Besuch zaehlt nicht
  {
    const s = await oeffne({ config: { firstStart: true, rundgangGesehen: false } });
    const p = s.page;
    await p.waitForFunction(() => { const b = document.querySelector("#rgFrage"); return !!b && !b.hidden; });
    await mitKampf(p);
    await helferRunde(p);
    assert(!(await streifen(p)) && !bereichePosts(s).length, "die Frage steht: kein Hinweis, nichts gezaehlt", { s: await streifen(p), posts: s.posts });
    await p.click('#bereiche [data-tab="start"]');
    await p.click("#rgFrageNein");
    await geh(p, "timeline");
    await da(p);
    assert((await streifen(p))?.satz === TEXT.de.timeline, "nach der Antwort zaehlt der Besuch: Kampf zeigt seinen Hinweis", await streifen(p));
    await p.close();
    const r = await oeffne({ config: { firstStart: true, rundgangGesehen: false } });
    const q = r.page;
    await q.waitForFunction(() => { const b = document.querySelector("#rgFrage"); return !!b && !b.hidden; });
    await q.click("#rgFrageJa");
    await q.waitForFunction(() => { const e = document.querySelector("#rundgang"); return !!e && !e.hidden; });
    await mitKampf(q);
    await helferRunde(q);
    assert(!(await streifen(q)) && !bereichePosts(r).length, "der Rundgang laeuft: kein Hinweis, nichts gezaehlt", { s: await streifen(q), posts: r.posts });
    await q.close();
  }

  // --- 7. Tastatur: der Knopf ist von der Symbolleiste aus mit Tab erreichbar, Enter schliesst
  {
    const s = await oeffne();
    const p = s.page;
    await mitKampf(p);
    await geh(p, "compare");
    await da(p);
    await p.focus("#bhOk");
    assert(await p.evaluate(() => document.activeElement?.id === "bhOk"), "„Verstanden“ nimmt den Fokus", await p.evaluate(() => document.activeElement?.id));
    await p.keyboard.press("Enter");
    await weg(p);
    assert(!(await streifen(p)), "Enter auf „Verstanden“ blendet aus");
    // der Fokus auf der Symbolleiste bleibt, der Streifen nimmt ihn nie von selbst
    await p.focus('#bereiche [data-tab="history"]');
    await p.keyboard.press("Enter");
    await da(p);
    assert(await p.evaluate(() => document.activeElement?.dataset?.tab === "history"), "der Streifen nimmt keinen Fokus", await p.evaluate(() => document.activeElement?.id));
    await p.close();
  }

  // --- 8. Form: vier Themen, Schrift ab 11 Punkt, kein Rot und Gruen, Textschrift der App
  for (const theme of ["dark", "light", "tnl", "glas"]) {
    const s = await oeffne({ config: { theme }, motion: "reduce" });
    const p = s.page;
    await p.waitForFunction((t) => document.documentElement.dataset.theme === t, theme);
    await mitKampf(p);
    await da(p);
    const f = await p.evaluate(() => {
      const e = document.querySelector("#bereichsHinweis"), cs = getComputedStyle(e);
      const texte = [...e.querySelectorAll("*")].filter((x) => x.getClientRects().length && [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
      const klein = texte.filter((x) => parseFloat(getComputedStyle(x).fontSize) < 11).map((x) => x.id || x.className);
      const farben = texte.map((x) => getComputedStyle(x).color);
      const rotGruen = farben.filter((c) => { const [R, G, B] = c.match(/\d+(\.\d+)?/g).map(Number);
        return (R > 150 && G < 90 && B < 90) || (G > 150 && R < 90 && B < 120); });
      const r = e.getBoundingClientRect(), st = document.querySelector("#stage").getBoundingClientRect();
      return { klein, rotGruen, font: cs.fontFamily === getComputedStyle(document.body).fontFamily, schatten: cs.boxShadow,
        breite: Math.abs(r.width - st.width) < 1 || r.width <= st.width, quer: document.documentElement.scrollWidth > innerWidth,
        hoch: r.height, hoechst: parseFloat(cs.minHeight) };
    });
    assert(!f.klein.length && f.font && !f.rotGruen.length && f.breite && !f.quer && /^rgb\(\d+, \d+, \d+\) 0px 1px 0px 0px$/.test(f.schatten),
      `${theme}: Schrift ab 11 Punkt, die Textschrift der App, kein Rot und Gruen, nur die Haarlinie unten statt eines Wurfs, ohne Querrollen`, f);
    assert(!s.fehler.length, theme + ": keine Fehler", s.fehler);
    await p.close();
  }

  // --- 9. Groessen: 560 ohne Querrollen; in jedem Bereich laeuft nichts nach unten ueber
  for (const [breite, hoehe] of [[560, 860], [1280, 860], [2000, 1480]]) {
    const s = await oeffne({ breite, hoehe, motion: "reduce" });
    const p = s.page;
    await mitKampf(p);
    for (const b of BEREICHE) {
      await geh(p, b);
      await da(p);
      const m = await p.evaluate(() => {
        const e = document.querySelector("#bereichsHinweis").getBoundingClientRect();
        const sb = document.querySelector("#statusleiste").getBoundingClientRect();
        const wurzel = getComputedStyle(document.documentElement).getPropertyValue("--hw-h").trim();
        return { quer: document.documentElement.scrollWidth > innerWidth, hoch: Math.round(e.height), oben: Math.round(e.top), sbTop: Math.round(sb.top),
          wurzel, drin: e.right <= innerWidth + 0.5 && e.left >= -0.5 };
      });
      assert(!m.quer && m.drin && m.hoch >= 30 && m.wurzel === m.hoch + "px", `${breite} × ${hoehe}, ${b}: kein Querrollen, im Fenster, --hw-h = ${m.hoch} Punkt`, m);
      // der Streifen schiebt den Bereich nur um seine Hoehe: nicht mehr als diese Hoehe Zuwachs im Rollmass
      /* a2, marken und fonts: nur zur Auskunft im Fehlerfall (#414), nichts davon wird geprueft */
      const teile = () => p.evaluate(() => ({ h: document.scrollingElement.scrollHeight, a2: Math.round(document.querySelector("#a2")?.getBoundingClientRect().height || 0),
        marken: document.querySelector("#a2marken")?.style.height || "", fonts: document.fonts?.status || "",
        teile: ["#analysisCall", "#findings", "#a2", "#afuss", "#app", "#p-analysis"].map((x) => x + "=" + Math.round(document.querySelector(x)?.getBoundingClientRect().height || 0)).join(" "),
        winh: getComputedStyle(document.documentElement).getPropertyValue("--winh").trim(), h1200: document.documentElement.classList.contains("h-min-1200") }));
      const t1 = await teile(), mit = t1.h;
      await p.click("#bhOk");
      await weg(p);
      const t2 = await teile(), ohne = t2.h;
      assert(mit - ohne <= m.hoch + 1, `${breite} × ${hoehe}, ${b}: mit dem Streifen waechst das Rollmass hoechstens um seine Hoehe`, { mit, ohne, hoch: m.hoch, t1, t2 });
    }
    await p.close();
  }

  // --- 10. Fester Bereich: kein Ueberlauf nach unten bei den Bereichen, die auf die Fensterhoehe gerechnet sind
  for (const [breite, hoehe] of [[1280, 860], [2000, 1480]]) {
    for (const b of ["timeline", "weeklies", "gilde", "rekorde", "archiv"]) {
      const s = await oeffne({ breite, hoehe, motion: "reduce", config: { bereicheGezeigt: BEREICHE.filter((x) => x !== b) } });
      const p = s.page;
      await mitKampf(p);
      await geh(p, b);
      await da(p);
      const mit = await p.evaluate(() => document.scrollingElement.scrollHeight);
      await p.click("#bhOk");
      await weg(p);
      const ohne = await p.evaluate(() => document.scrollingElement.scrollHeight);
      assert(mit <= ohne + 1, `${breite} × ${hoehe}, ${b}: der feste Bereich laeuft mit dem Streifen nicht ueber (${mit} gegen ${ohne})`, { mit, ohne });
      await p.close();
    }
  }
} finally {
  await browser.close();
}
if (failed) { console.log(`HINWEISE PAGE TEST FAILED - ${failed}`); process.exit(1); }
console.log("HINWEISE PAGE TEST PASSED");
