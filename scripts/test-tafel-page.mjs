// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Instrumententafel Stufe 2 (Spezifikation 27.09.2026, Abschnitt 4): die
// Kampf-Tafel an der gebauten Seite, vom gestellten Helfer ausgeliefert
// (page.route) - Raster aus Streifen, Tafel, Kurve und Urteil, darunter
// der Zeitverlauf zum Ausklappen.
//
// Run:  npm run test:tafel-page     (baut die Seite zuerst)

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

/* Ein Log in der Form, die das Spiel schreibt (wie test-rahmen-page.mjs):
   alle 0,5 s ein Treffer, vier Faehigkeiten im Wechsel. Nur Zielnamen und
   Zahlen, keine Spielernamen. Dreimal Vulcanus im Abstand von 30 Minuten
   (Staerke 1.0, 1.2, 0.8) - genug fuer einen Median (MIN_MEDIAN = 3) -,
   danach ein Trash-Gegner: der neueste Kampf laeuft im Live noch und steht
   nicht im Verzeichnis, die drei Vulcanus-Kaempfe davor schon. */
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
      const dmg = Math.round(1000 * p.scale * (1 + (k % 5)));
      lines.push(`${stamp(p.start + k * 500)},DamageDone,${skill},${sid},${dmg},0,0,kNormalHit,Tester,${p.target}`);
    }
  }
  return lines.join("\n") + "\n";
}
const at = (h, m, s = 0) => Date.UTC(2026, 8, 20, h, m, s);
const PULLS = [
  { target: "Vulcanus", start: at(20, 0, 0), secs: 60, scale: 1.0 },
  { target: "Vulcanus", start: at(20, 30, 0), secs: 60, scale: 1.2 },
  { target: "Vulcanus", start: at(21, 0, 0), secs: 60, scale: 0.8 },
  { target: "Stone Beetle", start: at(21, 30, 0), secs: 20, scale: 1.0 },
];

/* Eine Seite am gestellten Helfer, wie in test-rahmen-page.mjs. app: ?win=1
   und nativeFrame (das eigene Fenster der App), sonst ein Browser-Tab.
   config: was GET /api/config antwortet. helfer: {dir, file, text} - der
   Helfer beobachtet einen Ordner, /api/state nennt ihn und die Datei,
   /api/latest liefert den Text am Stueck. best: was GET /api/best als
   Stand der Datei liefert (wie in test-best-page.mjs {ok, best}), ohne
   Angabe kein bester Pull; eine Funktion wird abgewartet (eine spaete
   Antwort). Was die Seite an /api/best schreibt, steht in bestPosts. */
async function oeffne({ app = false, lang = "en", config = {}, breite = 1280, hoehe = 860, helfer = null, best = {}, gruppe = null } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const s = { page, fehler: [], posts: [], bestPosts: [] };
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
    // gruppe: der Helfer meldet eine laufende Gruppe (wie /api/party/state im Hauptprozess, test-neu-page.mjs)
    if (path === "/api/party/state" && gruppe) return json(gruppe);
    if (path === "/api/config" && req.method() === "GET") return json({ rundgangGesehen: true, ...config });
    if (path === "/api/config") { s.posts.push(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
    if (path === "/api/win") return json({ ok: true, max: false, w: 400, h: 28, on_top: true });
    if (path === "/api/events") { await new Promise((r) => setTimeout(r, 1000)); return json({ ok: true, registered: true, counts: {} }); }
    if (path === "/api/builds" && req.method() === "GET") return json({ ok: true, builds: {} });
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: typeof best === "function" ? await best() : best });
    if (path === "/api/best") { s.bestPosts.push(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
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

/* Nach dem Aufklappen: der Knopf behaelt den Fokus und ist zu sehen (nicht
   unter der Titelleiste), der Anfang von #p-timeline steht im Bild. Gemessen
   mit elementFromPoint - was darueber liegt, verdeckt.
   Seit der Pruefung 29.09. (Entscheidung vom 29.09., an Claude
   uebertragen: nichts doppelt) oeffnet
   den gestapelten Zeitverlauf der eigene Knopf #spurenAuf; #zeitAuf laesst
   nur die Kurve wachsen (test-neu-page 2.15/2.16). */
/* Folgt Aufgabe 10 (Nachtrag 29.09.): #spurenAuf ("Zeitverlauf und Rotation")
   fuehrt in den Bereich Rotation, wo der gestapelte Zeitverlauf unter der
   Zeitleiste steht. Gleich streng wie vorher: das Element mit dem Fokus (jetzt
   die Zeitleiste) ist zu sehen, nicht unter der Titelleiste, und der Anfang
   des Zeitverlaufs (#stackScroll) steht im Bild. */
async function imBild(page, wo) {
  await page.waitForFunction(() => !!document.querySelector("#stackLanes")?.width, null, { timeout: 4000 }).catch(() => {});
  const b = await page.evaluate(() => {
    const k = document.querySelector("#deineRotScroll").getBoundingClientRect(), z = document.querySelector("#stackScroll").getBoundingClientRect();
    const an = (x, y) => document.elementFromPoint(x, y);
    const kOben = an(k.left + 20, k.top + 2), kUnten = an(k.left + 20, k.bottom - 2), zOben = an(z.left + 20, z.top + 4);
    return { fokus: document.activeElement?.id, k: [k.top, k.bottom], z: z.top, h: innerHeight,
      knopf: !!kOben && kOben.closest("#deineRotScroll") !== null && !!kUnten && kUnten.closest("#deineRotScroll") !== null,
      zeit: !!zOben && zOben.closest("#stackScroll") !== null };
  });
  assert(b.fokus === "deineRotScroll" && b.knopf && b.zeit && b.k[0] >= 0 && b.k[1] <= b.h && b.z < b.h,
    `${wo} aufgeklappt: Zeitleiste mit Fokus und Anfang des Zeitverlaufs im Bild`, b);
}

/* Das Log des Helfers laden (Live an, der erste Takt laedt ganz) und den
   i-ten Kampf der Liste waehlen. Oben steht der neueste. */
async function ladeUndWaehle(page, i, n = 4) {
  await page.evaluate(() => document.querySelector("#btnWatch").click());
  await page.waitForFunction((m) => document.querySelectorAll("#fightList .fight").length >= m, n, { timeout: 8000 });
  await page.evaluate((n) => document.querySelector(`#fightList .fight[data-i="${n}"]`).click(), i);
  await page.waitForFunction(() => !document.querySelector("#app").hidden);
  await page.waitForTimeout(300);
}

/* Der beste Pull fuer das Urteil (Abschnitt 4): ein Vulcanus-Kampf und
   danach ein Trash-Gegner, der im Live noch laeuft. Den Lauf baut die Seite
   selbst (summarise, wie beim Festhalten): eine erste Seite laedt das Log
   und schreibt den Kampf an /api/best, der Test nimmt den Eintrag aus dem
   POST und macht daraus einen besten Pull von einem frueheren Tag - einmal
   mit doppeltem Schaden von Detonation Mark (der Abstand liegt an einer
   Stelle, etwa 25 % ueber diesem), einmal ganz schwaecher (dieser ist der
   beste). */
const U_PULLS = [
  { target: "Vulcanus", start: at(20, 0, 0), secs: 60, scale: 1.0 },
  { target: "Stone Beetle", start: at(20, 30, 0), secs: 20, scale: 1.0 },
];
const U_HELFER = () => ({ dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(U_PULLS) });
async function eintragAusSeite() {
  const s = await oeffne({ app: true, helfer: U_HELFER() });
  await ladeUndWaehle(s.page, 1, 2);
  // geschrieben wird 3 s nach dem Laden (planeSchreiben in 46-best-pull.ts)
  for (let n = 0; n < 40 && !s.bestPosts.some((b) => b.key === "boss:Vulcanus"); n++) await s.page.waitForTimeout(250);
  const post = s.bestPosts.find((b) => b.key === "boss:Vulcanus");
  await s.page.close();
  if (!post) throw new Error("kein Eintrag fuer boss:Vulcanus geschrieben");
  return post.entry;
}
function bestStub(entry, aendern) {
  const run = structuredClone(entry.best.run);
  const vorher = run.dps;
  aendern(run);
  run.perSecond = run.perSecond.map((v) => v * run.dps / vorher);
  return { "boss:Vulcanus": { best: { ...entry.best, run, at: Date.UTC(2026, 8, 19, 21, 0, 0), file: "TLCombatLog-0.txt" } } };
}
const doppeltDM = (run) => {
  const dm = run.skills.find((k) => k.name === "Detonation Mark");
  run.total += dm.damage; run.dps += dm.dps;
  dm.damage *= 2; dm.dps *= 2;
};
const schwaecher = (run) => {
  for (const k of ["total", "dps", "avg", "max"]) run[k] *= 0.8;
  for (const k of run.skills) { k.damage *= 0.8; k.dps *= 0.8; }
};

/* Pulls mit einem Fenster, wie fensterPull in test-analyse-page.mjs: alle
   96 s lang, Detonation Mark alle 12 s, Quick Fire jede Sekunde, in den 6 s
   nach dem Mal staerker; setz = [innen n, aussen n, innen Schaden, aussen
   Schaden] legt einen Pull mit vielen Treffern ausserhalb fest. Ein Ziel,
   das kein Boss ist: kein bester Pull, das Urteil kommt aus der Analyse. */
const QF = ["Quick Fire", 964762401], DM = ["Detonation Mark", 953174691], ST = ["Strafing", 945674044];
function trefferLog(treffer) {
  const rows = [...treffer].sort((a, b) => a[0] - b[0]).map(([t, skill, sid, dmg, krit, ziel]) =>
    `${stamp(t)},DamageDone,${skill},${sid},${Math.round(dmg)},${krit ? 1 : 0},0,${krit ? "kCritical" : "kNormalHit"},Tester,${ziel}`);
  return ["CombatLogVersion,4", ...rows].join("\n") + "\n";
}
function fensterPull(start, ziel, setz) {
  const tr = [];
  for (let t = 0; t < 96000; t += 12000) tr.push([start + t, DM[0], DM[1], 50000, false, ziel]);
  let i = 0, a = 0;
  const nimm = (k, n) => !setz || Math.floor((k + 1) * n / 48) !== Math.floor(k * n / 48);
  for (let t = 300; t < 96000; t += 1000) {
    const drin = t % 12000 < 6000;
    const k = drin ? i++ : a++;
    if (!nimm(k, drin ? setz?.[0] : setz?.[1])) continue;
    const d = setz ? (drin ? setz[2] : setz[3]) : (drin ? 100000 : 70000) * (0.9 + 0.2 * ((t / 1000) % 5) / 4);
    tr.push([start + t, QF[0], QF[1], d, drin ? k % 4 !== 0 : k % 3 === 0, ziel]);
  }
  for (let t = 700; t < 96000; t += 1000) tr.push([start + t, ST[0], ST[1], 20000, false, ziel]);
  return tr;
}

try {
  // --- 1. Raster des Glutrings (folgt Spezifikation Glutring 2 und 7; E 8, E 9): ab 900 x 700 nebeneinander -
  // Ringfeld links oben, Band darunter, Liste rechts mit dem Urteil darunter -, sonst gestapelt Ringfeld, Liste, Band
  for (const [breite, hoehe, zoom, voll] of [[1280, 860, 100, true], [1100, 700, 100, true], [1650, 1050, 150, true],
                                               [2000, 1480, 100, true], [900, 700, 100, true], [899, 700, 100, false],
                                               [832, 700, 100, false], [1280, 699, 100, false], [560, 800, 100, false]]) {
    const s = await oeffne({ app: true, breite, hoehe, config: { uiZoom: zoom } });
    await beispiel(s.page);
    const m = await s.page.evaluate(() => {
      const r = (q) => document.querySelector(q)?.getBoundingClientRect().toJSON();
      return { tafel: document.body.classList.contains("tafel"), glut: document.body.classList.contains("glut"),
        rollt: document.documentElement.scrollHeight > innerHeight + 1, quer: document.documentElement.scrollWidth > innerWidth,
        ring: r("#ringFeld"), liste: r(".table"), bars: r("#bars"), urteil: r("#urteilFeld"), band: r("#kurveFeld"),
        kopf: document.querySelector(".headwrap").getClientRects().length > 0, urteilInListe: !!document.querySelector(".table #urteilFeld") };
    });
    const wo = `${breite}x${hoehe} ${zoom} %`;
    assert(m.tafel && m.glut && !m.kopf, `${wo}: body.tafel und body.glut im Bereich Kampf, der Kopfstreifen entfaellt`, m);
    assert(!m.quer, `${wo}: kein waagerechtes Rollen`, m);
    assert(m.urteilInListe && m.urteil.top >= m.bars.bottom - 1 && m.urteil.left >= m.liste.left - 1 && m.urteil.right <= m.liste.right + 1,
      `${wo}: das Urteil steht unter der Liste, in ihrer Spalte`, m);
    if (voll) {
      assert(!m.rollt, `${wo}: die Felder fuellen die Flaeche ohne Seitenrollen`, m);
      assert(m.liste.left >= m.ring.right - 1 && Math.abs(m.liste.top - m.ring.top) < 2 && m.band.top >= m.ring.bottom - 1 &&
        Math.abs(m.band.left - m.ring.left) < 2 && Math.abs(m.band.right - m.ring.right) < 2,
        `${wo}: Ringfeld links oben, Band darunter ueber dieselbe Breite, Liste rechts`, m);
      // gemessen in sichtbaren Punkten - bei 150 % ist alles anderthalbmal so gross, darum nur bei 100 %
      if (zoom === 100) {
        const soll = Math.min(400, Math.max(340, 233 + breite * 0.0834));
        assert(Math.abs(m.liste.width - soll) <= 1.5, `${wo}: die Liste ist 340 bis 400 Punkt breit (hier ${Math.round(soll)})`, { soll, ist: m.liste.width });
        assert(m.band.height >= 100 && m.band.height <= 130, `${wo}: das Band ist etwa 110 Punkt hoch`, m.band);
      }
    } else {
      assert(m.ring.bottom <= m.liste.top + 1 && m.liste.bottom <= m.band.top + 1, `${wo}: gestapelt Ringfeld, Liste mit Urteil, Band`, m);
    }
    assert(!s.fehler.length, `${wo}: keine Fehler`, s.fehler);
    await s.page.close();
  }

  // --- 2. andere Bereiche wie in Stufe 1, Zeitverlauf zum Ausklappen
  {
    const s = await oeffne({ app: true });
    const p = s.page; await beispiel(p);
    /* der gestapelte Zeitverlauf hat seit der Pruefung 29.09. den eigenen Knopf #spurenAuf; folgt Aufgabe 10
       (Nachtrag 29.09.): er steht nicht mehr im Kampf, der Knopf fuehrt in den Bereich Rotation (siehe imBild) */
    const zu = await p.evaluate(() => ({ exp: document.querySelector("#spurenAuf").getAttribute("aria-expanded"),
      ctl: document.querySelector("#spurenAuf").getAttribute("aria-controls"), sicht: !!document.querySelector("#stack").offsetParent,
      knopf: !!document.querySelector("#spurenAuf").offsetParent }));
    assert(zu.exp === null && zu.ctl === null && !zu.sicht && zu.knopf, "Zeitverlauf nicht im Kampf, der Knopf dorthin ist da", zu);
    await p.click("#spurenAuf");
    await p.waitForFunction(() => !!document.querySelector("#stackLanes")?.width, null, { timeout: 4000 }).catch(() => {});
    const auf = await p.evaluate(() => ({ bereich: document.querySelector('#bereiche [data-tab="rotation"]').getAttribute("aria-current"),
      breite: document.querySelector("#stack").getBoundingClientRect().width }));
    assert(auf.bereich === "page" && auf.breite > 300, "der Knopf fuehrt in die Rotation: der Zeitverlauf zeichnet", auf);
    await imBild(p, "1280x860");
    await p.click('#bereiche [data-tab="rotation"]');
    /* Seit Stufe 4 (#54) ist Rotation ein Bereich aus Feldern (58-felder.ts,
       test-felder-page.mjs): keine Tafel, keine Kurve, die Flaeche ohne
       Deckel der Breite und ohne Streifen darueber. */
    const rot = await p.evaluate(() => ({ tafel: document.body.classList.contains("tafel"), felder: document.body.classList.contains("felder"),
      app: getComputedStyle(document.querySelector("#app")).maxWidth, kurve: !!document.querySelector("#kurveFeld").offsetParent,
      kopf: !!document.querySelector(".headwrap").offsetParent, glut: document.body.classList.contains("glut") }));
    // die Felder reichen von Leiste zu Leiste, seit der Neugestaltung 28.09. (0.25) hoechstens 1680 Punkt
    assert(!rot.tafel && rot.felder && rot.app === "1680px" && !rot.kurve && !rot.kopf && !rot.glut, "Rotation: Felder statt Tafel (Stufe 4)", rot);
    await p.click('#bereiche [data-tab="timeline"]');
    /* folgt Aufgabe 10: vorher "bleibt offen" - jetzt steht der Kampf wieder ohne Zeitverlauf da, mit dem Knopf
       dorthin, und der Zeitverlauf wartet gezeichnet im Bereich Rotation */
    const zur = await p.evaluate(() => ({ knopf: !!document.querySelector("#spurenAuf").offsetParent, sicht: !!document.querySelector("#stack").offsetParent,
      gezeichnet: document.querySelector("#stack").width > 300 }));
    assert(zur.knopf && !zur.sicht && zur.gezeichnet, "zurueck im Kampf: der Knopf steht da, der Zeitverlauf bleibt in der Rotation gezeichnet", zur);
    await p.click("#btnCompact"); await p.waitForFunction(() => document.body.classList.contains("compact"));
    const kom = await p.evaluate(() => ({ tafel: document.body.classList.contains("tafel"),
      // #einordnung entfiel (DECISION 2.4); an ihrer Stelle die Zahl im Feldkopf der Tafel (Luecke 2.7)
      felder: ["#kurveFeld", "#urteilFeld", "#zeitAuf", "#spurenAuf", "#tafelZahl", "#ringFeld"].map(q => !!document.querySelector(q).offsetParent) }));
    assert(!kom.tafel && kom.felder.every(x => !x), "Kompakt: keine Felder, keine Klasse", kom);
    /* Kompakt bleibt unveraendert (Spezifikation Glutring 2): die Knoten des Kopfs stehen wieder an ihrem Platz und
       in ihrer Reihenfolge, die Tabelle zeichnet 21 wie vor dem Glutring. */
    const schutz = await p.evaluate(() => ({
      kopf: [...document.querySelector(".headtop").children].map((e) => e.className.split(" ")[0]),
      meta: [...document.querySelector(".headtop .headmeta").children].map((e) => e.id || e.className),
      ring: document.querySelector("#ringFeld").getClientRects().length > 0, glut: document.body.classList.contains("glut"),
      tabelle: !!document.querySelector('#bars .bhead [data-k="damage"]') && !document.querySelector("#bars .ringzeile") &&
        !document.querySelector("#bars").classList.contains("ring") }));
    assert(JSON.stringify(schutz.kopf) === JSON.stringify(["big", "headmeta", "headact"]) &&
      JSON.stringify(schutz.meta) === JSON.stringify(["hName", "snapBadge", "hMeta", "hRead", "hHist"]) && !schutz.ring && !schutz.glut && schutz.tabelle,
      "Kompakt: Kopf und Tabelle stehen wie vor dem Glutring", schutz);
    await p.click("#btnCompact"); await p.waitForFunction(() => !document.body.classList.contains("compact"));
    const zurueck = await p.evaluate(() => ({ glut: document.body.classList.contains("glut"), zahl: !!document.querySelector("#ringMitte #hDps"),
      liste: !!document.querySelector("#bars .ringzeile") }));
    assert(zurueck.glut && zurueck.zahl && zurueck.liste, "zurueck aus Kompakt: wieder der Ring mit der Zahl in der Mitte und der Liste", zurueck);
    /* Das Umhaengen nimmt den Fokus nicht mit (Spezifikation 1, Tastatur): steht er auf "Kampf speichern", steht er
       nach Kompakt und zurueck wieder dort, im Ringfeld (ohne Klick, der Knopf Kompakt bekaeme ihn sonst selbst).
       Im Kompakt selbst sind die Handlungen ausgeblendet; dort darf der Fokus auf keinem unsichtbaren Knopf stehen. */
    await p.focus("#btnSaveRun");
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await p.waitForFunction(() => document.body.classList.contains("compact"));
    const fokusK = await p.evaluate(() => { const a = document.activeElement; return a === document.body || !a ? "" : a.getClientRects().length ? a.id : "unsichtbar"; });
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await p.waitForFunction(() => !document.body.classList.contains("compact") && document.body.classList.contains("glut"));
    const fokusR = await p.evaluate(() => ({ id: document.activeElement?.id, imRing: !!document.activeElement?.closest("#ringRechts") }));
    assert(fokusK !== "unsichtbar" && fokusR.id === "btnSaveRun" && fokusR.imRing,
      "Kompakt hin und zurueck: der Fokus bleibt auf „Kampf speichern“", { fokusK, fokusR });
    assert(!s.fehler.length, "Bereichswechsel: keine Fehler", s.fehler);
    await p.close();
  }

  // Aufklappen an der Grenze des Rasters und gestapelt: der Knopf und der Anfang des Zeitverlaufs im Bild
  for (const [breite, hoehe] of [[1100, 700], [900, 800]]) {
    const s = await oeffne({ app: true, breite, hoehe }); const p = s.page; await beispiel(p);
    await p.focus("#spurenAuf"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
    await imBild(p, `${breite}x${hoehe}`);
    await p.close();
  }

  // --- 3. Einordnung und Kurve
  {
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS) } });
    const p = s.page; await ladeUndWaehle(p, 1);   // der dritte Vulcanus-Kampf (scale 0.8, nicht der beste), oben steht der neueste
    /* Neugestaltung 28.09. (DECISION 2.4, Entwurf Bereich Kampf): die
       Einordnung ist eine leise Zeile unter dem Satz des Kopfes, die Skala
       mit drei Marken entfiel im Kampf (sie gehoert in den Verlauf). Die
       Zeile traegt den Median und diesen Pull als Zahlen am Element und
       nennt den Median im Tooltip; geprueft wird wie vorher, dass der Satz
       mit demselben Median rechnet. */
    const e = await p.evaluate(() => { const h = document.querySelector("#hHist"), l = document.querySelector("#hRead");
      return { sicht: !h.hidden && h.getClientRects().length > 0, satz: h.textContent, tip: h.title,
        med: +h.dataset.median, dps: +h.dataset.dps, skala: !!document.querySelector("#einordnung"),
        unter: h.getBoundingClientRect().top >= l.getBoundingClientRect().bottom - 1,
        leise: parseFloat(getComputedStyle(h).fontSize) < parseFloat(getComputedStyle(l).fontSize) }; });
    assert(e.sicht && !e.skala && e.unter && e.leise, "Einordnung: eine leise Zeile unter dem Satz, keine Skala", e);
    assert(/median/i.test(e.tip), "Einordnung: der Tooltip nennt den Median", e);
    // dieselbe Zahl wie der Satz: p = round(100*(dps/med-1)); im Englischen steht "%" ohne Leerzeichen
    const pz = Math.abs(Math.round(100 * (e.dps / e.med - 1)));
    assert(e.med > 0 && pz > 0 && new RegExp("(^|\\D)" + pz + "\u00a0?%").test(e.satz), "Einordnung: derselbe Median wie der Satz", e);
    assert(!s.fehler.length, "Einordnung: keine Fehler", s.fehler);
    await p.close();
  }
  // --- 3b. "+x % zum letzten Pull" unter der grossen Zahl (Feinschliff 02.10., Abschnitt 2):
  // dieselbe Rechnung und derselbe Text wie im Kompakt (gegenLetzten, head.shortPrev), in
  // neutraler Tinte (kein Gold, kein Rot, kein Gruen); ohne frueheren Kampf am selben Boss
  // entfaellt die Zeile ganz. Der Satz zum besten Kampf traegt kein Gold mehr (Glut-Regel).
  for (const [lang, minus, best] of [["en", /^\u221233% vs\. last pull$/, /^Your best of \d+ fights on this boss/],
                                     ["de", /^\u221233\u00a0% zum letzten Pull$/, /^Dein bester Kampf von \d+ an diesem Boss/]]) {
    const s = await oeffne({ app: true, lang, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS) } });
    const p = s.page;
    const lies = () => p.evaluate(() => {
      const v = document.querySelector("#hPrev"), z = document.querySelector("#hDps"), h = document.querySelector("#hHist");
      const farbe = (wert) => { const e = document.createElement("i"); e.style.color = wert; document.body.append(e);
        const c = getComputedStyle(e).color; e.remove(); return c; };
      const neutral = ["--dim", "--ink-soft", "--text", "--dimmer"].map(n => farbe("var(" + n + ")"));
      const glut = ["--gold", "--gold-ink", "--lite", "--hero-ink", "--pos", "--neg", "--amber"].map(n => farbe("var(" + n + ")"));
      return { da: !!v, sicht: !!v && !v.hidden && v.getClientRects().length > 0, text: v ? v.textContent : "",
        inBig: !!v && !!v.closest(".big"), unter: !!v && v.getBoundingClientRect().top >= z.getBoundingClientRect().bottom - 1,
        farbe: v ? getComputedStyle(v).color : "", neutral: v ? neutral.includes(getComputedStyle(v).color) : false,
        hist: h.textContent, histFarbe: getComputedStyle(h).color, histGlut: glut.includes(getComputedStyle(h).color),
        glut: v ? glut.includes(getComputedStyle(v).color) : true };
    });
    await ladeUndWaehle(p, 1);   // der dritte Vulcanus-Kampf (0.8) nach dem zweiten (1.2)
    const a = await lies();
    assert(a.sicht && minus.test(a.text) && a.inBig && a.unter, `${lang}: zum letzten Pull unter der grossen Zahl`, a);
    assert(a.neutral && !a.glut, `${lang}: zum letzten Pull in neutraler Tinte`, a);
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="2"]').click()); await p.waitForTimeout(300);
    const b = await lies();
    assert(b.sicht && best.test(b.hist) && !b.histGlut, `${lang}: der beste Kampf ohne Goldtinte`, b);
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="3"]').click()); await p.waitForTimeout(300);
    const c = await lies();
    assert(c.da && !c.sicht && !c.text, `${lang}: der erste Kampf am Boss ohne Zeile`, c);
    assert(!s.fehler.length, `${lang}: zum letzten Pull ohne Fehler`, s.fehler);
    await p.close();
  }
  {
    const s = await oeffne({ app: true }); const p = s.page; await beispiel(p);
    const v = await p.evaluate(() => { const e = document.querySelector("#hPrev"); return { da: !!e, sicht: !!e && !e.hidden && e.getClientRects().length > 0 }; });
    assert(v.da && !v.sicht, "Beispielkampf: keine Zeile zum letzten Pull", v);
    await p.close();
  }
  {
    const s = await oeffne({ app: true }); const p = s.page; await beispiel(p);
    const k = await p.evaluate(() => ({ leg: document.querySelector("#kurveLeg").textContent,
      unter: document.querySelector("#kurveUnter").textContent, bezug: document.querySelector("#kurve").dataset.bezug }));
    assert(k.bezug === "0" && !/best/i.test(k.leg), "Kurve ohne besten Pull: keine gestrichelte Linie, kein Hinweis", k);
    assert(k.unter === "Total", "Kurve: ohne Zeile heisst die Unterzeile Gesamt", k);
    // die Kurve ist ein Bild mit Namen (die Ueberschrift des Feldes) und Beschreibung (die Unterzeile)
    const name = await p.getByRole("img", { name: "Damage per second", exact: true }).count();
    const besch = await p.evaluate(() => document.querySelector("#kurve").getAttribute("aria-describedby"));
    assert(name === 1 && besch === "kurveUnter", "Kurve: role=img mit Namen und Beschreibung", { name, besch });
    await p.hover('#bars .row[data-skill="Detonation Mark"]');
    const h = await p.evaluate(() => ({ spur: document.querySelector("#kurve").dataset.spur, unter: document.querySelector("#kurveUnter").textContent }));
    assert(h.spur === "Detonation Mark" && /%/.test(h.unter), "Kurve: Zeigen auf eine Zeile zeigt ihre Spur mit Anteil", h);
    await p.focus('#bars .row[data-skill="Quick Fire"]');
    const f = await p.evaluate(() => document.querySelector("#kurve").dataset.spur);
    assert(f === "Quick Fire", "Kurve: Fokus auf einer Zeile zeigt ihre Spur", f);
    assert(!s.fehler.length, "Kurve: keine Fehler", s.fehler);
    await p.close();
  }
  // --- 4. Urteil
  const eintrag = await eintragAusSeite();
  const BEST_STUB = bestStub(eintrag, doppeltDM), BEST_SCHWACH = bestStub(eintrag, schwaecher);
  {
    const s = await oeffne({ app: true, best: BEST_STUB, helfer: U_HELFER() }); const p = s.page; await ladeUndWaehle(p, 1, 2);
    const u = await p.evaluate(() => ({ satz: document.querySelector("#urteilFeld .usatz")?.textContent,
      belege: [...document.querySelectorAll("#urteilFeld .ubeleg")].map(b => b.textContent),
      log: document.querySelector("#urteilFeld .ulog")?.textContent, knopf: !!document.querySelector("#urteilFeld .uanalyse"),
      kurve: document.querySelector("#kurve").dataset.bezug }));
    assert(/^.+ missing per second \u2013 mostly on .+/.test(u.satz), "Urteil: es fehlen ... vor allem bei ...", u);
    assert(u.belege.length === 2 && /per hit/.test(u.belege[0]) && /per minute/.test(u.belege[1]), "Urteil: zwei Belegzeilen", u);
    assert(!!u.log && u.knopf && u.kurve === "1", "Urteil: Satz des Logs, Knopf zur Analyse, Kurve mit Bezug", u);
    /* Ein Takt ohne Aenderung fasst das Feld nicht an: Live laeuft weiter,
       das Log waechst nicht. */
    const takte = await p.evaluate(() => new Promise((fertig) => {
      let n = 0; const mo = new MutationObserver((m) => { n += m.length; });
      mo.observe(document.querySelector("#urteilFeld"), { subtree: true, childList: true, characterData: true, attributes: true });
      setTimeout(() => { mo.disconnect(); fertig(n); }, 2500);
    }));
    assert(takte === 0, "Urteil: ein Takt ohne Aenderung fasst das Feld nicht an", takte);
    // derselbe Abstand wie der Antwortsatz im Vergleich ("... (25.8k DPS) below ...")
    const gap = await p.evaluate(() => document.querySelector("#urteilFeld .usatz b")?.textContent || "");
    await p.click("#btnBestPull");
    const lead = await p.evaluate(() => document.querySelector("#cmpLead")?.textContent || "");
    assert(lead.includes("(" + gap + " DPS)"), "Urteil: derselbe Abstand wie im Vergleich", { gap, lead });
    await p.click('#bereiche [data-tab="timeline"]');
    await p.click("#urteilFeld .uanalyse");
    const tab = await p.evaluate(() => document.querySelector("#bereiche .tab[aria-current=page]").dataset.tab);
    assert(tab === "analysis", "Ganze Analyse wechselt in den Bereich Analyse", tab);
    assert(!s.fehler.length, "Urteil: keine Fehler", s.fehler);
    await p.close();
  }
  {
    const s = await oeffne({ app: true }); const p = s.page; await beispiel(p);
    const u = await p.evaluate(() => ({ html: document.querySelector("#urteilFeld").innerHTML,
      satz: document.querySelector("#urteilFeld .uv")?.textContent || "" }));
    await p.click('#bereiche [data-tab="analysis"]');
    const analyse = await p.evaluate(() => document.querySelector("#analysisCall .uv")?.textContent || "");
    assert(!/per second/.test(u.html) && !!u.satz && u.satz === analyse, "ohne Bezug: der Satz des Urteils aus der Analyse", { ...u, analyse });
    await p.click('#bereiche [data-tab="timeline"]');
    // das Urteilsfeld hat eine Ueberschrift wie das Kurvenfeld, und sie ist sein Name
    const feld = await p.evaluate(() => { const f = document.querySelector("#urteilFeld"), id = f.getAttribute("aria-labelledby");
      const h = id && document.getElementById(id);
      return { h: h?.tagName, text: h?.textContent, drin: !!h && f.contains(h), sicht: !!h && h.getBoundingClientRect().width > 2 }; });
    const region = await p.getByRole("region", { name: "Verdict", exact: true }).count();
    /* Neugestaltung 28.09. (Luecke 2.17, Entwurf: <h2 class="vh">Urteil</h2>):
       die Schlagzeile steht ohne sichtbare Ueberschrift; das h2 bleibt im
       Feld und ist sein Name. */
    assert(feld.h === "H2" && feld.text === "Verdict" && feld.drin && !feld.sicht && region === 1,
      "Urteilsfeld: Ueberschrift h2 als Name des Feldes, nur fuer Vorleser", { feld, region });
    await p.close();
  }
  // ohne Bezug im Live: der neueste Kampf hat kein Fenster, solange er laeuft; endet Live, folgt die Tafel der Analyse
  {
    const tr = [];
    for (let n = 0; n < 5; n++) tr.push(...fensterPull(at(21, n * 10), "Stone Beetle"));
    tr.push(...fensterPull(at(21, 50), "Stone Beetle", [34, 26, 81200, 45500]));
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: trefferLog(tr) } });
    const p = s.page; await ladeUndWaehle(p, 0, 6);
    const imLive = await p.evaluate(() => document.querySelector("#urteilFeld .uv")?.textContent || "");
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await p.waitForTimeout(800);
    const tafel = await p.evaluate(() => document.querySelector("#urteilFeld .uv")?.textContent || "");
    await p.click('#bereiche [data-tab="analysis"]');
    const analyse = await p.evaluate(() => document.querySelector("#analysisCall .uv")?.textContent || "");
    assert(/outside the window/.test(analyse) && tafel === analyse, "Live endet: das Urteil der Tafel wie das der Analyse",
      { imLive, tafel, analyse });
    assert(!s.fehler.length, "Live endet: keine Fehler", s.fehler);
    await p.close();
  }
  {
    const s = await oeffne({ app: true, best: BEST_SCHWACH, helfer: U_HELFER() }); const p = s.page; await ladeUndWaehle(p, 1, 2);
    const u = await p.evaluate(() => ({ satz: document.querySelector("#urteilFeld .usatz")?.textContent,
      belege: document.querySelectorAll("#urteilFeld .ubeleg").length, kurve: document.querySelector("#kurve").dataset.bezug,
      bezug: document.querySelector("#urteilFeld .ubezug")?.textContent || "", leg: document.querySelector("#kurveLeg").textContent }));
    assert(/^Your best pull on Vulcanus/.test(u.satz || "") && u.belege === 0 && u.kurve === "1",
      "dieser ist der beste: der Satz ohne Belegzeilen, der Bezug gestrichelt", u);
    /* Ist dieser der beste, ist der Bezug der staerkste andere Pull - der
       zweitbeste (pickTarget). Satz und Legende sagen das, wie der Vergleich
       ("Gegen deinen zweitbesten Pull"). */
    assert(/^against your second-best pull \u00b7 Vulcanus/.test(u.bezug) && /second best/.test(u.leg) && !/- - - best/.test(u.leg),
      "dieser ist der beste: Bezug und Legende nennen den zweitbesten Pull", u);
    await p.close();
  }
  {
    const s = await oeffne({ app: true, lang: "de", best: BEST_SCHWACH, helfer: U_HELFER() }); const p = s.page; await ladeUndWaehle(p, 1, 2);
    const u = await p.evaluate(() => ({ bezug: document.querySelector("#urteilFeld .ubezug")?.textContent || "",
      leg: document.querySelector("#kurveLeg").textContent }));
    assert(/^gegen deinen zweitbesten Pull \u00b7 Vulcanus/.test(u.bezug) && /zweitbester/.test(u.leg),
      "de: dieser ist der beste: Bezug und Legende nennen den zweitbesten Pull", u);
    await p.close();
  }
  // "Ganze Analyse" behaelt den Fokus, wenn ein Live-Takt das Urteil neu schreibt
  {
    const pulls = [PULLS[0], { target: "Stone Beetle", start: at(20, 30, 0), secs: 5, scale: 1.0 }];
    const helfer = { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(pulls) };
    const s = await oeffne({ app: true, helfer }); const p = s.page; await ladeUndWaehle(p, 0, 2);
    // der laufende Kampf hat zu wenig Treffer: der Satz nennt ihre Zahl und aendert sich mit jedem Takt
    const vor = await p.evaluate(() => { document.querySelector("#urteilFeld .uanalyse").focus();
      return document.querySelector("#urteilFeld").textContent; });
    helfer.text = logText([pulls[0], { ...pulls[1], secs: 8 }]);
    const neu = await p.waitForFunction((v) => document.querySelector("#urteilFeld").textContent !== v, vor, { timeout: 8000 })
      .then(() => true, () => false);
    const f = await p.evaluate(() => ({ fokus: !!document.activeElement?.matches("#urteilFeld .uanalyse"),
      tag: document.activeElement?.tagName, text: document.querySelector("#urteilFeld").textContent }));
    assert(neu && f.fokus, "Live: \"Ganze Analyse\" behaelt den Fokus, wenn das Urteil neu geschrieben wird", { neu, vor, f });
    assert(!s.fehler.length, "Live und Fokus: keine Fehler", s.fehler);
    await p.close();
  }
  // Nach Waffe: der Hinweis auf Nicht zugewiesen steht im Feld der Tafel, ohne dass die Seite rollt
  {
    const helfer = { dir: "C:\\Logs", file: "TLCombatLog-1.txt",
      text: logText(PULLS.slice(0, 1)).replace(/,Strafing,945674044,/g, ",Unbekannt,1,") };
    const s = await oeffne({ app: true, helfer }); const p = s.page; await ladeUndWaehle(p, 0, 1);
    await p.evaluate(() => document.querySelector("#eDev").click()); await p.waitForTimeout(120);
    await p.evaluate(() => document.querySelector('#groupSeg [data-g="weapon"]').click()); await p.waitForTimeout(200);
    const n = await p.evaluate(() => {
      const note = document.querySelector("#barsNote"), r = note.getBoundingClientRect(), t = document.querySelector(".table").getBoundingClientRect();
      return { tafel: document.body.classList.contains("tafel"), text: note.textContent, sicht: !!note.offsetParent && r.height > 0,
        drin: r.top >= t.top - 1 && r.bottom <= t.bottom + 1 && r.left >= t.left - 1 && r.right <= t.right + 1, imBild: r.bottom <= innerHeight,
        rollt: document.documentElement.scrollHeight > innerHeight + 1 };
    });
    assert(n.tafel && /Unassigned/.test(n.text) && n.sicht && n.drin && n.imBild && !n.rollt,
      "Nach Waffe: der Hinweis steht im Feld der Tafel, keine Seitenrolle", n);
    await p.close();
  }
  // /api/best antwortet spaet: Kurve und Urteil folgen ohne Zutun
  {
    let los; const tor = new Promise((r) => { los = r; });
    const s = await oeffne({ app: true, best: () => tor, helfer: U_HELFER() }); const p = s.page; await ladeUndWaehle(p, 1, 2);
    const vor = await p.evaluate(() => ({ kurve: document.querySelector("#kurve").dataset.bezug,
      satz: !!document.querySelector("#urteilFeld .usatz") }));
    assert(vor.kurve === "0" && !vor.satz, "spaeter Stand: vorher ohne Bezug", vor);
    los(BEST_STUB);
    const da = await p.waitForFunction(() => document.querySelector("#kurve").dataset.bezug === "1" &&
      /missing per second/.test(document.querySelector("#urteilFeld .usatz")?.textContent || ""), null, { timeout: 5000 })
      .then(() => true, () => false);
    assert(da, "spaeter Stand: Kurve mit Bezug und Urteil ohne Zutun",
      await p.evaluate(() => document.querySelector("#urteilFeld").innerHTML.slice(0, 200)));
    await p.close();
  }
  // Fokus auf einer Zeile ohne Unterzeilen ueberlebt ein Neuzeichnen im Live
  {
    const helfer = { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS) };
    const s = await oeffne({ app: true, helfer }); const p = s.page; await ladeUndWaehle(p, 1);
    // folgt Spezifikation Glutring 4: jede Faehigkeit klappt in ihre Trefferarten auf; eine zugeklappte Zeile behaelt den Fokus
    const name = await p.evaluate(() => {
      const z = document.querySelector('#bars .row[data-skill][aria-expanded="false"]');
      z.focus(); window.__zeile = z; return z.dataset.skill;
    });
    // das Log waechst: der laufende Kampf bekommt Treffer dazu, die Tafel wird neu gebaut
    helfer.text = logText([...PULLS.slice(0, 3), { ...PULLS[3], secs: 25 }]);
    const neu = await p.waitForFunction(() => !document.querySelector("#bars").contains(window.__zeile), null, { timeout: 8000 })
      .then(() => true, () => false);
    const f = await p.evaluate(() => ({ skill: document.activeElement?.dataset?.skill, tag: document.activeElement?.tagName }));
    assert(neu && f.skill === name, "Live: der Fokus bleibt auf der Zeile derselben Faehigkeit", { neu, name, f });
    await p.close();
  }
  // die Spur gehoert zum Kampf: ein anderer Kampf beginnt ohne Spur
  {
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS) } });
    const p = s.page; await ladeUndWaehle(p, 1);
    /* Das Zeigen als Ereignis, nicht mit der Maus: stuende der Zeiger
       wirklich ueber der Tafel, schickte Chromium nach dem Neubau ein
       mouseover an die Zeile darunter, und die Spur waere zu Recht wieder
       da. Hier zeigt nach dem Wechsel nichts mehr auf eine Zeile. */
    await p.evaluate(() => document.querySelector('#bars .row[data-skill="Detonation Mark"]')
      .dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    const vor = await p.evaluate(() => document.querySelector("#kurve").dataset.spur);
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="2"]').click());
    await p.waitForTimeout(300);
    const nach = await p.evaluate(() => ({ spur: document.querySelector("#kurve").dataset.spur, unter: document.querySelector("#kurveUnter").textContent }));
    assert(vor === "Detonation Mark" && nach.spur === "" && nach.unter === "Total", "anderer Kampf: die Kurve beginnt ohne Spur", { vor, nach });
    await p.close();
  }
  /* Ein Filter, der dieselbe Zahl Treffer in derselben Zeit laesst, zeigt
     einen anderen Kampf: die Kurve zeichnet neu. Zwei Quellen mit gleichen
     Zeiten, der Schaden der einen steigt, der der anderen faellt. */
  {
    const zeilen = ["CombatLogVersion,4"];
    for (let k = 0; k < 120; k++) {
      zeilen.push(`${stamp(at(20, 0, 0) + k * 500)},DamageDone,Quick Fire,964762401,${1000 + 100 * k},0,0,kNormalHit,Tester,Stone Beetle`);
      zeilen.push(`${stamp(at(20, 0, 0) + k * 500)},DamageDone,Quick Fire,964762401,${13000 - 100 * k},0,0,kNormalHit,Zweiter,Stone Beetle`);
    }
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: zeilen.join("\n") + "\n" } });
    const p = s.page; await ladeUndWaehle(p, 0, 1);
    const wer = async (name) => {
      await p.evaluate((n) => { const sel = document.querySelector("#selPlayer"); sel.value = n; sel.dispatchEvent(new Event("change")); }, name);
      await p.waitForTimeout(300);
      return p.evaluate(() => ({ wert: document.querySelector("#selPlayer").value, bild: document.querySelector("#kurve").toDataURL() }));
    };
    const a = await wer("Tester"), b = await wer("Zweiter");
    assert(a.wert === "Tester" && b.wert === "Zweiter" && a.bild !== b.bild, "Filter mit gleicher Trefferzahl: die Kurve zeichnet neu",
      { a: a.wert, b: b.wert, gleich: a.bild === b.bild });
    await p.close();
  }
  // vom Raster in den Stapel, waehrend die Tafel in sich gerollt ist: gestapelt gilt wieder der Deckel
  {
    const s = await oeffne({ app: true }); const p = s.page; await beispiel(p);
    // alle Zeilen aufklappen, bis die Tafel im Raster in sich rollt (die erste ist seit der Neugestaltung 28.09., Luecke 2.9, schon offen)
    await p.evaluate(() => document.querySelectorAll("#bars .row[data-open][aria-expanded=false]").forEach((z) => z.click()));
    await p.waitForTimeout(200);
    const r = await p.evaluate(() => { const b = document.querySelector("#bars"); b.scrollTop = 40;
      return { rollt: b.scrollHeight > b.clientHeight + 40, top: b.scrollTop, max: b.style.maxHeight }; });
    // gestapelt ist seit der Neugestaltung 28.09. (Luecke 2.21, Entwurf) erst ab 832 Punkt Breite
    await p.setViewportSize({ width: 832, height: 700 });
    await p.waitForTimeout(400);
    const g = await p.evaluate(() => { const b = document.querySelector("#bars");
      return { max: b.style.maxHeight, h: b.clientHeight, voll: b.scrollHeight, stapel: document.documentElement.matches(".w-max-832") }; });
    assert(r.rollt && r.top > 0 && g.stapel && g.max !== "none" && g.h < g.voll, "Raster zu Stapel mit gerollter Tafel: der Deckel greift", { r, g });
    await p.close();
  }

  // --- 5. Querschnitt: drei Themen, zwei Sprachen, Zoom
  {
    // Kontrast wie in test-rahmen-page.mjs (Statusleiste): relative Leuchtdichte nach WCAG
    const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const TEXT = { en: { unter: "Total", zeit: "Show the timeline", urteil: "Verdict" }, de: { unter: "Gesamt", zeit: "Zeitverlauf ausklappen", urteil: "Urteil" } };
    for (const lang of ["en", "de"]) {
      // mit bestem Pull: so steht .ubezug im Urteil und die Kurve traegt beide Linien
      const s = await oeffne({ app: true, lang, best: BEST_STUB, helfer: U_HELFER() }); const p = s.page;
      await ladeUndWaehle(p, 1, 2);
      for (const thema of ["dark", "light", "tnl"]) {
        await p.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`).click(), thema);
        await p.waitForTimeout(250);
        const f = await p.evaluate(() => {
          const probe = document.createElement("i"); probe.style.background = "var(--comb)"; document.body.append(probe);
          const comb = getComputedStyle(probe).backgroundColor; probe.remove();
          const cv = document.querySelector("#kurve"), ctx = cv.getContext("2d");
          // ein Streifen in der Mitte ueber die ganze Hoehe: dort liegt die Flaeche unter der Kurve
          const d = ctx.getImageData(Math.floor(cv.width / 2) - 10, 0, 20, cv.height).data;
          /* Gezeichnet ist, was Deckkraft hat; die Flaeche und die Linie tragen
             das Gold des Themas - nach einem Wechsel nicht das des alten. */
          const probeG = document.createElement("i"); probeG.style.color = "var(--gold)"; document.body.append(probeG);
          const gold = getComputedStyle(probeG).color.match(/\d+/g).map(Number); probeG.remove();
          let gemalt = 0, golden = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i]) {
            gemalt++;
            if (Math.abs(d[i - 3] - gold[0]) <= 3 && Math.abs(d[i - 2] - gold[1]) <= 3 && Math.abs(d[i - 1] - gold[2]) <= 3) golden++;
          }
          const farbe = (q) => { const el = document.querySelector(q); return el ? getComputedStyle(el).color : null; };
          return { tafel: document.body.classList.contains("tafel"), quer: document.documentElement.scrollWidth > innerWidth,
            theme: document.documentElement.dataset.theme, comb, gemalt, golden,
            unter: document.querySelector("#kurveUnter").textContent, zeit: document.querySelector("#zeitAuf").textContent,
            urteil: document.getElementById(document.querySelector("#urteilFeld").getAttribute("aria-labelledby") || "-")?.textContent,
            cUnter: farbe("#kurveUnter"), cBezug: farbe("#urteilFeld .ubezug"), cLeg: farbe("#kurveLeg") };
        });
        const wo = `${thema} ${lang}`;
        assert(f.tafel && f.theme === thema && !f.quer, `${wo}: Tafel ohne waagerechtes Rollen`, f);
        assert(f.gemalt > 0, `${wo}: die Kurve hat gezeichnete Pixel`, f);
        assert(f.golden > f.gemalt / 2, `${wo}: die Kurve im Gold des Themas`, f);
        assert(f.unter === TEXT[lang].unter && f.zeit === TEXT[lang].zeit && f.urteil === TEXT[lang].urteil,
          `${wo}: Unterzeile, Knopf und Ueberschrift des Urteils in der Sprache`, f);
        for (const [was, c] of [["#kurveUnter", f.cUnter], [".ubezug", f.cBezug], ["#kurveLeg", f.cLeg]])
          assert(!!c && kontrast(c, f.comb) >= 4.5, `${wo}: ${was} lesbar auf --comb (4,5:1)`, { c, comb: f.comb, k: c && kontrast(c, f.comb) });
      }
      // die Bahnen der zwei Belegzeilen beginnen untereinander, auch bei verschieden breiten Zahlen
      const bahnen = await p.evaluate(() => [...document.querySelectorAll("#urteilFeld .ubahn")].map((b) => b.getBoundingClientRect().left));
      assert(bahnen.length === 2 && Math.abs(bahnen[0] - bahnen[1]) < 1, `${lang}: die Bahnen der Belegzeilen stehen untereinander`, bahnen);
      assert(!s.fehler.length, `${lang}: Themenwechsel ohne Fehler`, s.fehler);
      await p.close();
    }
  }
  // gestapelt (folgt Spezifikation Glutring 2, E 10): das Band hat seine feste Hoehe, keine halbe Seite
  for (const [breite, hoehe] of [[899, 700], [560, 800]]) {
    const s = await oeffne({ app: true, breite, hoehe }); const p = s.page; await beispiel(p);
    const h = await p.evaluate(() => document.querySelector("#kurve").getBoundingClientRect().height);
    assert(h >= 60 && h <= 100, `${breite}x${hoehe} gestapelt: das Band hat seine feste Hoehe`, h);
    await p.close();
  }
  {
    // Zoom 200 % bei 2200 x 1400: 1100 x 700 Layoutpunkte, die Tafel gilt und fuellt ohne Seitenrollen
    const s = await oeffne({ app: true, breite: 2200, hoehe: 1400, config: { uiZoom: 200 } }); const p = s.page;
    await beispiel(p);
    const m = await p.evaluate(() => ({ tafel: document.body.classList.contains("tafel"), zoom: document.documentElement.style.zoom,
      rollt: document.documentElement.scrollHeight > innerHeight + 1, quer: document.documentElement.scrollWidth > innerWidth }));
    assert(m.tafel && m.zoom === "2" && !m.rollt && !m.quer, "200 % bei 2200x1400: Tafel ohne Seitenrollen", m);
    assert(!s.fehler.length, "200 %: keine Fehler", s.fehler);
    await p.close();
  }

  /* Mass des Ringrasters (folgt Spezifikation Glutring 2 und 7; vorher "Rasterhoehe = min(Flaeche, Inhalt)"):
     das Raster fuellt die Flaeche zwischen den Leisten, die Liste rollt in sich und endet an einer ganzen Zeile,
     das Urteil steht ganz im Bild, das Band reicht bis zur Unterkante. */
  const ringMass = (p) => p.evaluate(() => {
    const r = (q) => document.querySelector(q).getBoundingClientRect();
    const cs = getComputedStyle(document.documentElement);
    const frei = innerHeight - parseFloat(cs.getPropertyValue("--chrome")) - parseFloat(cs.getPropertyValue("--sb-h"))
      - (parseFloat(cs.getPropertyValue("--flaeche-luft")) || 0);
    const app = document.querySelector("#app"), bars = document.querySelector("#bars"), b = bars.getBoundingClientRect();
    const kopf = bars.querySelector(".bhead")?.getBoundingClientRect();
    const zeilen = [...bars.querySelectorAll(".row")].map((z) => z.getBoundingClientRect());
    const sichtbar = zeilen.filter((z) => z.bottom > (kopf ? kopf.bottom : b.top) + 0.5 && z.top < b.bottom - 0.5), letzte = sichtbar[sichtbar.length - 1];
    return { frei, app: app.getBoundingClientRect().height, appRollt: app.scrollHeight > app.clientHeight + 1, appUnten: r("#app").bottom,
      seite: document.documentElement.scrollHeight > innerHeight + 1, rollt: bars.scrollHeight > bars.clientHeight + 1,
      letzteUnten: letzte ? letzte.bottom : 0, barsUnten: b.bottom, barsHoch: b.height,
      listeInhalt: zeilen.length ? zeilen[zeilen.length - 1].bottom - b.top + bars.scrollTop : 0,
      // aus Aufgabe 3 (6b): jede Zeile, auch jede aufgeklappte, ist zu sehen
      zeilen: zeilen.length, sichtbar: sichtbar.length,
      haupt: bars.querySelectorAll(".row:not(.sub)").length, urteilOben: r("#urteilFeld").top, urteilUnten: r("#urteilFeld").bottom,
      note: r("#barsNote").height, bandUnten: r("#kurveFeld").bottom, kurve: r("#kurve").height,
      knoepfe: ["#urteilAnalyse", "#zeitAuf", "#spurenAuf"].map((q) => r(q).bottom), win: innerHeight };
  });
  const ringRegel = (wo, m) => {
    assert(!m.seite && !m.appRollt && Math.abs(m.app - m.frei) < 2 && Math.abs(m.bandUnten - m.appUnten) < 2,
      `${wo}: das Raster fuellt die Flaeche, nichts rollt, das Band reicht bis unten`, m);
    assert(m.knoepfe.every((u) => u <= m.appUnten + 0.5 && u <= m.win) && m.urteilUnten <= m.appUnten + 0.5,
      `${wo}: das Urteil mit seinen Knoepfen und die Knoepfe des Bands stehen ganz im Bild`, m);
    if (m.rollt) assert(m.letzteUnten <= m.barsUnten + 0.5 && m.barsUnten - m.letzteUnten < 1,
      `${wo}: die Liste rollt in sich und endet an einer ganzen Zeile`, m);
    /* folgt der Entscheidung 03.10. (Aufgabe 10): passt alles, steht das Urteil unten in der Spalte (die Spalte reicht bis zur
       Unterkante, ihr Grund laeuft durch) statt direkt unter der Liste; die Liste bleibt nicht hoeher als ihr Inhalt */
    else assert(m.barsHoch <= m.listeInhalt + 2 && Math.abs(m.urteilUnten - m.appUnten) < 2 && m.urteilOben >= m.barsUnten + m.note - 0.5,
      `${wo}: alles passt \u2013 die Liste nicht hoeher als ihr Inhalt, das Urteil unten in der Spalte`, m);
    assert(Math.abs(m.kurve - 78) <= 1, `${wo}: die Kurve im Band ist zu 78 Punkt hoch`, m.kurve);
  };

  // --- 6. Das Ringraster bei den Hoehen, an denen die alte Tafel ihre Regeln wechselte
  for (const [breite, hoehe] of [[1920, 1080], [1280, 860], [1280, 800], [1280, 799], [1100, 700], [2000, 1480]]) {
    const s = await oeffne({ app: true, breite, hoehe }); const p = s.page; await beispiel(p);
    ringRegel(`${breite}x${hoehe}`, await ringMass(p));
    assert(!s.fehler.length, `${breite}x${hoehe}: ohne Fehler`, s.fehler);
    await p.close();
  }

  // --- 6b. Zeilenkante (DESIGN.md "mehr Hoehe heisst mehr Zeilen"): 12 Faehigkeiten bei 1280 x 860 rollen, 4 bei
  // 2000 x 1480 passen ganz; beides auch nach einem Wechsel der Fenstergroesse
  for (const [breite, hoehe, wenige] of [[1280, 860, false], [1280, 1000, false], [2000, 1480, true], [1280, 860, true]]) {
    const s = await oeffne({ app: true, breite, hoehe,
      ...(wenige ? { helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS) } } : {}) });
    const p = s.page;
    if (wenige) await ladeUndWaehle(p, 1); else await beispiel(p);
    const name = `${breite}x${hoehe} ${wenige ? "4 Zeilen" : "12 Zeilen"}`;
    const m1 = await ringMass(p);
    if (!wenige && breite === 1280 && hoehe === 860) assert(m1.rollt, `${name}: die Liste hat mehr Zeilen als Platz`, m1);
    /* folgt Spezifikation Glutring 4 (aus Aufgabe 3): die staerkste Faehigkeit steht offen (vier Trefferarten und
       die Summe); gezaehlt werden die vier Faehigkeiten, und jede Zeile, auch jede aufgeklappte, ist zu sehen */
    if (wenige) assert(!m1.rollt && m1.haupt === 4 && m1.sichtbar === m1.zeilen, `${name}: alle Zeilen passen`, m1);
    ringRegel(name, m1);
    await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(300);
    await p.setViewportSize({ width: breite, height: hoehe }); await p.waitForTimeout(300);
    ringRegel(`${name} nach 1280x900`, await ringMass(p));
    assert(!s.fehler.length, `${name}: ohne Fehler`, s.fehler);
    await p.close();
  }

  /* --- 7. Als Bild: aus test-abend-page.mjs, Neugestaltung 28.09. (Nr. 0,
     zweiter Teil, und Nr. 4, Teil). Der Abend entfaellt (Spezifikation 3);
     das Bild vom Kampf und die Gruppentafel als Bild bleiben. Ueber file://
     ohne Helfer, der Beispielkampf und zwei gespeicherte Gruppen-Logs. */
  {
    const work = mkdtempSync(join(tmpdir(), "boro-bild-"));
    try {
      const datei = (name, text) => { const f = join(work, name); writeFileSync(f, text); return f; };
      const bat = (day, h, m = 0, s = 0) => Date.UTC(2026, 8, day, h, m, s);
      const bLog = (pulls) => {
        const rows = [];
        for (const p of pulls) for (let k = 0; k * 500 < p.secs * 1000; k++) {
          const [skill, sid] = SKILLS[k % 4];
          rows.push([p.start + k * 500, `,DamageDone,${skill},${sid},${Math.round(1000 * p.scale * (1 + (k % 5)))},0,0,kNormalHit,Tester,${p.target}`]);
        }
        rows.sort((a, b) => a[0] - b[0]);
        return ["CombatLogVersion,4", ...rows.map(([t, r]) => stamp(t) + r)].join("\n") + "\n";
      };
      const BV = (day, min, scale) => ({ target: "Vulcanus", start: bat(day, 21, min), secs: 60, scale });
      const L16 = datei("vulcanus-16.txt", bLog([BV(16, 0, 5.0), BV(16, 10, 5.5)]));
      const L23 = datei("vulcanus-23.txt", bLog([BV(23, 0, 6.0), BV(23, 10, 5.75)]));
      /* Gruppen-Logs der Fassung 2, wie summarisePartyLog() sie schreibt: je
         Bosskampf die Zeilen der Mitglieder (Namen erfunden). */
      const iso = (ms) => new Date(ms).toISOString();
      const reihe = (...wer) => wer.map(([name, dps]) => ({ name, dps, damage: dps * 60, seconds: 60 }));
      const gkampf = (target, ms, ...wer) => ({ target, when: iso(ms), seconds: 60, board: reihe(...wer) });
      const gruppenLog = (fights) => {
        const letzter = fights[fights.length - 1];
        return JSON.stringify({ boroPartyLog: 2, fights, when: letzter.when, code: "RAID", target: letzter.target,
          board: letzter.board.map((r) => ({ ...r, waiting: false, target: letzter.target })), history: [] });
      };
      const P16 = datei("Raid 16.09.json", gruppenLog([
        gkampf("Vulcanus", bat(16, 21), ["Aelira", 40000], ["Borin", 50000], ["Cyra", 30000]),
        gkampf("Vulcanus", bat(16, 21, 20), ["Aelira", 44000], ["Borin", 50000], ["Cyra", 50000])]));
      const P23 = datei("Raid 23.09 Aelira.json", gruppenLog([
        gkampf("Vulcanus", bat(23, 21), ["Aelira", 44000], ["Borin", 52000], ["Cyra", 32000]),
        gkampf("Vulcanus", bat(23, 21, 15), ["Aelira", 50000], ["Borin", 51000], ["Cyra", 32000]),
        gkampf("Grauauge", bat(23, 22, 30), ["Aelira", 30000], ["Borin", 20000])]));

      const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* blockiert */ } });
      await page.goto("file://" + join(root, "dist", "renderer", "index.html"));
      const tab = async (name) => { await page.evaluate((n) => document.querySelector(`[data-tab="${n}"]`).click(), name); await page.waitForTimeout(150); };
      /* Das Bild im Dialog: Groesse, Farbe oben links (die Flaeche des Themas,
         --lift-1) und ob mehr als eine Farbe darin steht. Gelesen wird das
         Blob hinter der Vorschau, nicht der Bildschirm. */
      const bild = () => page.evaluate(async () => {
        const img = document.querySelector("#shareImg");
        for (let i = 0; i < 100 && !(img.src || "").startsWith("blob:"); i++) await new Promise((r) => setTimeout(r, 50));
        /* Das Blob hinter der Vorschau selbst lesen, nicht das <img>: zeichnet
           der Dialog kurz danach neu, wird das alte Blob freigegeben und das
           <img> bleibt 0 breit (CI 29.09.). Dann das jeweils aktuelle src
           nochmal holen, bis ein Bild mit Breite dasteht. */
        let blob = null, bmp = null;
        for (let i = 0; i < 100 && !(bmp && bmp.width > 0); i++) {
          try { blob = await (await fetch(img.src)).blob(); bmp = await createImageBitmap(blob); }
          catch { await new Promise((r) => setTimeout(r, 50)); }
        }
        // kein lesbares Bild: als Messwert melden, damit die Probe mit Grund scheitert statt abzubrechen
        if (!bmp) return { typ: blob?.type ?? "", bytes: blob?.size ?? 0, w: 0, h: 0, farben: 0, flaeche: false,
                           src: img.src, dw: img.dataset.w, dh: img.dataset.h, was: document.querySelector("#shareWas").textContent,
                           alt: img.alt, wahl: [], wahlDa: false };
        const cv = document.createElement("canvas");
        cv.width = bmp.width; cv.height = bmp.height;
        const ctx = cv.getContext("2d");
        ctx.drawImage(bmp, 0, 0);
        const px = [...ctx.getImageData(4, 4, 1, 1).data].slice(0, 3);
        const alle = ctx.getImageData(0, 0, cv.width, cv.height).data;
        const farben = new Set();
        for (let i = 0; i < alle.length; i += 4 * 97) farben.add(alle[i] + "," + alle[i + 1] + "," + alle[i + 2]);
        const lift = getComputedStyle(document.documentElement).getPropertyValue("--lift-1").trim();
        const hex = (lift.match(/#[0-9a-f]{6}/i) || ["#000000"])[0];
        const soll = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return { typ: blob.type, bytes: blob.size, w: bmp.width, h: bmp.height, farben: farben.size,
                 flaeche: px.every((v, i) => Math.abs(v - soll[i]) <= 3), px, soll,
                 was: document.querySelector("#shareWas").textContent, alt: img.alt,
                 wahl: [...document.querySelectorAll("#shareWahl [data-bild]")].filter((b) => !b.hidden)
                   .map((b) => b.dataset.bild + (b.getAttribute("aria-pressed") === "true" ? "*" : "")),
                 wahlDa: !document.querySelector("#shareWahl").hidden };
      });
      // Einstellungen wie ein Spieler ueber das Zahnrad, danach zurueck in den Bereich von vorher
      const einstellung = async (gruppe, tun) => {
        const vorher = await page.evaluate(() => document.querySelector('#bereiche .tab[aria-current="page"]')?.dataset.tab || "");
        const oben = await page.evaluate(() => document.querySelector("#btnEinst").getClientRects().length > 0);
        await page.click(oben ? "#btnEinst" : '#bereiche [data-tab="settings"]');
        await page.click(`#einstNav button[data-gruppe="${gruppe}"]`);
        await tun();
        if (vorher && vorher !== "settings" && await page.evaluate(() => !document.querySelector("#einst").hidden))
          await page.click(`#bereiche [data-tab="${vorher}"]`);
      };
      const sprache = (l) => einstellung("sprache", () => page.click(`#eSprache button[data-lang="${l}"]`));
      const themaWaehlen = (th) => einstellung("darst", () => page.click(`#eThema [data-theme="${th}"]`));
      const dialogZu = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(100); };

      // das Beispiel als Bild: ueber den Knopf der Kopfzeile, in jedem Thema die eigene Flaeche
      await einstellung("dev", () => page.click("#eBeispielkampf"));
      await page.waitForFunction(() => !document.querySelector("#app").hidden);
      await tab("analysis");
      for (const theme of ["dark", "light", "tnl"]) {
        await themaWaehlen(theme);
        await page.click("#bkBild");
        const b = await bild();
        // 982: 944 und eine Zeile Lesesatz unter der Faktenzeile (19 Punkte, doppelt fein gezeichnet 38)
        assert(b.typ === "image/png" && b.w === 1440 && b.h === 982 && b.bytes > 20000 && b.farben > 20 && b.flaeche,
          `Bild vom Kampf, Thema ${theme}: PNG 1440 x 982 mit Lesesatz, nicht leer, Flaeche aus dem Thema`, b);
        if (theme === "dark") {
          assert(b.was === "In the image: Ramux, head and table (12 rows), character names: Demo." && b.alt === b.was && !b.wahlDa,
            "vor dem Kopieren steht, was im Bild ist; nur ein Kampf, also keine Wahl", b);
          assert(await page.evaluate(() => document.activeElement?.id === "shareCopy"), "der Fokus steht auf \"Copy to clipboard\"");
          await page.keyboard.press("Tab");
          assert(await page.evaluate(() => document.activeElement?.id === "shareClose"), "Tab bleibt im Dialog");
          // speichern: ein Download des Browsers, kein Endpunkt
          const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#shareSave")]);
          const pfad = await dl.path();
          assert(dl.suggestedFilename() === "borometer-ramux-2026-09-09.png" && readFileSync(pfad).length === b.bytes &&
            readFileSync(pfad).subarray(1, 4).toString() === "PNG", "Als PNG speichern: Download mit Namen, dasselbe PNG", dl.suggestedFilename());
          // kopieren: navigator.clipboard.write mit image/png - hier nachgebaut, und einmal abgelehnt
          await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
            write: async (items) => { window.__kopiert = items.map((i) => i.types.join()); } } }));
          await page.click("#shareCopy");
          await page.waitForTimeout(100);
          assert(JSON.stringify(await page.evaluate(() => window.__kopiert)) === '["image/png"]' &&
            (await page.textContent("#shareMeld")) === "Copied \u2013 paste it into the chat.", "In die Zwischenablage: ein PNG");
          await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
            write: async () => { throw new DOMException("denied", "NotAllowedError"); } } }));
          await page.click("#shareCopy");
          await page.waitForTimeout(100);
          assert((await page.textContent("#shareMeld")) === "The clipboard does not take an image here. Save it as PNG instead.",
            "Zwischenablage abgelehnt: der Satz sagt, was geht");
        }
        await dialogZu();
        assert(await page.evaluate(() => !document.querySelector("#shareBg").classList.contains("on") && document.activeElement?.id === "bkBild"),
          `Thema ${theme}: Esc schliesst, der Fokus geht zurueck an den Knopf „Als Bild“`);
      }
      await themaWaehlen("dark");

      // die Gruppentafel als Bild: zwei Kaempfe an Vulcanus, zwei gespeicherte Gruppen-Logs von Hand geladen
      for (const f of [L16, L23]) {
        await page.setInputFiles("#fileInput", f);
        await page.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
        await page.waitForTimeout(150);
      }
      for (const f of [P16, P23]) {
        await page.setInputFiles("#partyLogInput", f);
        await page.waitForTimeout(200);
      }
      await sprache("de");
      await page.waitForTimeout(150);
      /* Mit einem Gruppen-Log steht die Gruppenansicht (state.group "party"):
         die Kopfzeile der Bereiche ist dann aus, "Als Bild" steht im Streifen
         des Kampfs (#btnBild) - vorher oeffnete der Knopf im Abend den Dialog. */
      await tab("timeline");
      await page.click("#btnBild");
      await page.waitForFunction(() => !!document.querySelector('#shareWahl [data-bild="board"]:not([hidden])'));
      const altSrc = await page.evaluate(() => document.querySelector("#shareImg").src);
      await page.click('#shareWahl [data-bild="board"]');
      await page.waitForFunction(() => document.querySelector("#shareImg").alt.includes("Gruppentafel"));
      // das neue Bild abwarten, nicht das alte Blob des Kampfs
      await page.waitForFunction((alt) => document.querySelector("#shareImg").src !== alt, altSrc);
      const b = await bild();
      assert(b.was === "Im Bild: Grauauge, die Gruppentafel mit den Charakternamen Aelira, Borin." && b.h === 424 &&
        // Neugestaltung 28.09.: die Wahl "Abend" entfaellt mit dem Abend (Spezifikation 3)
        b.wahl.join() === "kampf,board*", "die Gruppentafel als Bild; Wahl mit aria-pressed", b);
      await dialogZu();
      assert(await page.evaluate(() => document.activeElement?.id === "btnBild"), "Esc: der Fokus geht zurueck an den Knopf");
      assert(!errors.length, "Als Bild: keine Fehler in der Seite", errors);
      await page.close();
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  // --- 8. Der Ring (Spezifikation Glutring 3): ein Bogen je Zeile ab 12 Uhr, rund, in der Groesse des Felds, aussen die
  // Trefferarten, die grosse Zahl in der Mitte, ein Bild mit Beschreibung
  for (const [breite, hoehe, min, max, schrift] of [[1280, 860, 480, 560, "1"], [2000, 1480, 760, 760, "1"], [560, 800, 280, 460, "0"]]) {
    const s = await oeffne({ app: true, breite, hoehe }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    const m = await p.evaluate(() => {
      const cv = document.querySelector("#ring"), r = cv.getBoundingClientRect();
      const farbe = (n) => { const e = document.createElement("i"); e.style.color = `var(${n})`; document.body.append(e);
        const c = getComputedStyle(e).color.match(/\d+/g).slice(0, 3).map(Number); e.remove(); return c; };
      const g = JSON.parse(cv.dataset.mitte || "{}"), q = cv.width / r.width, ctx = cv.getContext("2d");
      const px = (w, rad) => [...ctx.getImageData(Math.round((g.x + Math.cos(w) * rad) * q), Math.round((g.y + Math.sin(w) * rad) * q), 1, 1).data].slice(0, 3);
      const w = -Math.PI / 2 + 0.03;   // kurz nach 12 Uhr: der erste Bogen, die staerkste Faehigkeit
      const z = document.querySelector("#hDps").getBoundingClientRect();
      return { d: +cv.dataset.d, boegen: +cv.dataset.boegen, zeilen: document.querySelectorAll("#bars .ringzeile").length, schrift: cv.dataset.schrift,
        rund: Math.abs(cv.width / cv.height - r.width / r.height) < 0.01, rolle: cv.getAttribute("role"), name: cv.getAttribute("aria-label") || "",
        bogen: px(w, g.r1 - 2), rand: px(w, g.r1 + 9), serie1: farbe("--series-1"), randSoll: farbe("--cat-" + cv.dataset.randErst),
        zahlX: z.left + z.width / 2 - r.left, g };
    });
    const wo = `${breite}x${hoehe}`;
    const nah = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
    assert(m.d >= min && m.d <= max, `${wo}: der Ring ist ${min}\u2013${max} Punkt gross`, m.d);
    assert(m.boegen === m.zeilen && m.boegen > 0, `${wo}: ein Bogen je Zeile der Liste`, m);
    assert(m.rund, `${wo}: der Ring ist nicht gestreckt (Canvas und Kasten im selben Verhaeltnis)`, m);
    assert(m.rolle === "img" && /^Ring: .+ \d+%/.test(m.name), `${wo}: ein Bild mit Beschreibung`, m.name);
    assert(nah(m.bogen, m.serie1, 40), `${wo}: kurz nach 12 Uhr steht die staerkste Faehigkeit in --series-1`, m);
    assert(nah(m.rand, m.randSoll, 40), `${wo}: aussen der Rand der Trefferarten in ihren Farben`, m);
    assert(m.schrift === schrift, `${wo}: Beschriftung ${schrift === "1" ? "mit" : "ohne"} Platz daneben`, m.schrift);
    assert(Math.abs(m.zahlX - m.g.x) < 4, `${wo}: die grosse Zahl steht in der Mitte des Rings`, m);
    assert(!s.fehler.length, `${wo}: Ring ohne Fehler`, s.fehler);
    await p.close();
  }
  // 8b. Die Beschriftung stoesst nicht an die Ecken des Ringfelds (Satz und Mechanik oben links, Boss und Handlungen
  // oben rechts) und nicht aneinander. Vier fast gleich starke Faehigkeiten legen je einen Namen auf 1:30, 4:30, 7:30
  // und 10:30 Uhr. Der Lauf "mech": fuenf Pulls mit derselben Panzerstrecke 0:24-0:30 (wie in test-analyse-page,
  // Mechanik), damit unter dem Satz die Zeile der Mechanik (#kurveMech) steht.
  const mechText = (() => {
    const z = ["CombatLogVersion,4"];
    for (let q = 0; q < 5; q++) {
      const start = at(19, 0, 0) + q * 180000;
      for (let k = 0; k < 700; k++) {
        const t = k * 100, panzer = t >= 24000 && t < 30000, [skill, sid] = SKILLS[k % SKILLS.length];
        z.push(`${stamp(start + t)},DamageDone,${skill},${sid},${panzer ? 150 : k % 5 === 0 ? 40000 : 600},0,0,kNormalHit,Tester,Vulcanus`);
      }
    }
    return z.join("\n") + "\n";
  })();
  for (const [breite, hoehe, mech] of [[1280, 860, false], [2000, 1480, false], [1100, 700, false], [1280, 860, true], [1100, 700, true]]) {
    const s = await oeffne({ app: true, breite, hoehe, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: mech ? mechText : logText(PULLS) } });
    const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await ladeUndWaehle(p, mech ? 4 : 1, mech ? 5 : 4);
    if (mech) await p.waitForFunction(() => document.querySelector("#kurveMech")?.hidden === false, null, { timeout: 5000 }).catch(() => {});
    const m = await p.evaluate(() => {
      const cv = document.querySelector("#ring"), r = cv.getBoundingClientRect();
      const schilder = JSON.parse(cv.dataset.schilder || "[]").map((b) => ({ l: b.l + r.left, t: b.t + r.top, r: b.r + r.left, b: b.b + r.top }));
      const ecken = ["#ringSatz", "#kurveMech", "#ringMeta", "#ringRechts"].map((q) => document.querySelector(q).getBoundingClientRect())
        .filter((b) => b.width > 0 && b.height > 0).map((b) => ({ l: b.left, t: b.top, r: b.right, b: b.bottom }));
      const schneidet = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      const km = document.querySelector("#kurveMech").getBoundingClientRect();
      return { n: +cv.dataset.beschriftet, schilder: schilder.length, ecken: ecken.length, mechZu: km.width > 0 && km.height > 0,
        anEcke: schilder.filter((a) => ecken.some((e) => schneidet(a, e))).length,
        aneinander: schilder.filter((a, i) => schilder.some((b, j) => j !== i && schneidet(a, b))).length,
        imBild: schilder.every((a) => a.l >= r.left && a.r <= r.right && a.t >= r.top && a.b <= r.bottom) };
    });
    const wo = `${breite}x${hoehe} vier Faehigkeiten${mech ? " mit Mechanik" : ""}`;
    if (mech) assert(m.mechZu, `${wo}: die Zeile der Mechanik steht oben links`, m);
    assert(m.n >= 3 && m.schilder === m.n && m.ecken >= 2, `${wo}: die Boegen sind beschriftet`, m);
    assert(m.anEcke === 0, `${wo}: keine Beschriftung stoesst an die Ecken des Ringfelds`, m);
    assert(m.aneinander === 0 && m.imBild, `${wo}: die Beschriftungen stehen frei und ganz im Bild`, m);
    assert(!s.fehler.length, `${wo}: ohne Fehler`, s.fehler);
    await p.close();
  }
  // --- 9. Hervorheben (Spezifikation Glutring 3): Bogen und Zeile heben sich gegenseitig hervor, die Mitte erzaehlt,
  // die Kurve zeigt die Spur, ein Klick auf den Bogen klappt die Zeile auf; Fokus wie Zeigen
  {
    const s = await oeffne({ app: true }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    const punkte = await p.evaluate(() => { const cv = document.querySelector("#ring"), r = cv.getBoundingClientRect();
      return JSON.parse(cv.dataset.punkte).map((q) => ({ k: q.k, x: r.left + q.x, y: r.top + q.y })); });
    const zweiter = punkte[1];
    await p.mouse.move(zweiter.x, zweiter.y); await p.waitForTimeout(120);
    const a = await p.evaluate((k) => ({ hervor: document.querySelector("#ring").dataset.hervor,
      zeile: [...document.querySelectorAll("#bars .ringzeile")].find((z) => z.dataset.ring === k)?.classList.contains("ringan"),
      an: document.querySelectorAll("#bars .ringzeile.ringan").length, spur: document.querySelector("#kurve").dataset.spur,
      mitte: document.querySelector("#ringFokus").textContent }), zweiter.k);
    assert(a.hervor === zweiter.k && a.zeile && a.an === 1, "Zeigen auf einen Bogen hebt Bogen und Zeile hervor", { a, k: zweiter.k });
    assert(a.spur === zweiter.k, "die Kurve zeigt die Spur des Bogens", a);
    assert(/ hits? \u00b7 .+ crit \u00b7 biggest /.test(a.mitte), "die Mitte erzaehlt den Bogen: Name, Schaden, Treffer, Kritanteil, groesster", a.mitte);
    await p.mouse.click(zweiter.x, zweiter.y); await p.waitForTimeout(150);
    const auf = await p.evaluate((k) => [...document.querySelectorAll("#bars .ringzeile")].find((z) => z.dataset.ring === k)?.getAttribute("aria-expanded"), zweiter.k);
    assert(auf === "true", "ein Klick auf den Bogen klappt dieselbe Zeile auf", auf);
    /* Entscheidung 03.10.: der Ring zeigt eine Faehigkeit - die vorher offene (hier die staerkste) klappt zu,
       ein zweiter Klick auf denselben Bogen klappt auch diese zu */
    const nurEine = await p.evaluate(() => [...document.querySelectorAll("#bars .ringzeile[aria-expanded=true]")].map((z) => z.dataset.ring));
    assert(JSON.stringify(nurEine) === JSON.stringify([zweiter.k.split("\u0000")[0]]), "ein Klick auf einen Bogen klappt die vorher offene Zeile zu", nurEine);
    await p.mouse.click(zweiter.x, zweiter.y); await p.waitForTimeout(150);
    const zu = await p.evaluate(() => document.querySelectorAll("#bars .ringzeile[aria-expanded=true]").length);
    assert(zu === 0, "ein zweiter Klick auf denselben Bogen klappt die Zeile wieder zu", zu);
    await p.mouse.move(2, 2); await p.waitForTimeout(120);
    const weg = await p.evaluate(() => ({ hervor: document.querySelector("#ring").dataset.hervor,
      an: document.querySelectorAll("#bars .ringzeile.ringan").length, mitte: document.querySelector("#ringFokus").textContent }));
    assert(weg.hervor === "" && weg.an === 0 && weg.mitte === "", "Zeiger weg: nichts hervorgehoben", weg);
    await p.locator("#bars .ringzeile").nth(2).hover(); await p.waitForTimeout(120);
    const b = await p.evaluate(() => ({ hervor: document.querySelector("#ring").dataset.hervor, ring: document.querySelectorAll("#bars .ringzeile")[2].dataset.ring }));
    assert(!!b.hervor && b.hervor === b.ring, "Zeigen auf eine Zeile hebt ihren Bogen hervor", b);
    await p.mouse.move(2, 2);
    await p.locator("#bars .ringzeile").nth(3).focus(); await p.waitForTimeout(120);
    const c = await p.evaluate(() => ({ hervor: document.querySelector("#ring").dataset.hervor, ring: document.querySelectorAll("#bars .ringzeile")[3].dataset.ring }));
    assert(!!c.hervor && c.hervor === c.ring, "die Zeile mit Fokus hebt ihren Bogen hervor (Tastatur)", c);
    // Hervorheben zeichnet den Ring oft neu, misst dabei aber die Ecken des Ringfelds nicht neu (Pruefung Aufgabe 5):
    // die Lage der Schilder steht fest, bis sich Groesse oder Kampf aendern
    await p.locator("#bars .ringzeile").nth(3).blur();
    await p.evaluate(() => { window.__eckenGemessen = 0;
      for (const q of ["#ringLinks", "#ringMeta", "#ringRechts"]) { const el = document.querySelector(q), orig = el.getBoundingClientRect.bind(el);
        el.getBoundingClientRect = () => { window.__eckenGemessen++; return orig(); }; } });
    for (const q of [...punkte, ...punkte]) { await p.mouse.move(q.x, q.y); await p.waitForTimeout(20); }
    await p.mouse.move(2, 2); await p.waitForTimeout(60);
    const gemessen = await p.evaluate(() => ({ n: window.__eckenGemessen, hervor: document.querySelector("#ring").dataset.hervor }));
    assert(gemessen.n === 0 && gemessen.hervor === "", "Hervorheben misst die Ecken des Ringfelds nicht neu", gemessen);
    assert(!s.fehler.length, "Hervorheben: keine Fehler", s.fehler);
    await p.close();
  }
  // 9b. Neues Bild bei ruhendem Zeiger (Fixrunde 1 zu Aufgabe 6): nach Sprachwechsel und anderem Kampf erzaehlt die
  // Mitte das neue Bild oder ist leer - nie den alten Stand
  {
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS) } }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await ladeUndWaehle(p, 1);
    const ziel = await p.evaluate(() => { const cv = document.querySelector("#ring"), r = cv.getBoundingClientRect();
      const q = JSON.parse(cv.dataset.punkte)[0]; return { k: q.k, x: r.left + q.x, y: r.top + q.y }; });
    await p.mouse.move(ziel.x, ziel.y); await p.waitForTimeout(120);
    const lies = () => p.evaluate(() => ({ hervor: document.querySelector("#ring").dataset.hervor, mitte: document.querySelector("#ringFokus").textContent,
      an: [...document.querySelectorAll("#bars .ringzeile.ringan")].map((z) => z.dataset.ring), spur: document.querySelector("#kurve").dataset.spur }));
    const vorher = await lies();
    assert(vorher.hervor === ziel.k && / hits? \u00b7 /.test(vorher.mitte), "9b: der erste Bogen ist hervorgehoben (en)", vorher);
    await p.evaluate(() => document.querySelector("#btnLang").click()); await p.waitForTimeout(200);
    const de = await lies();
    assert(de.mitte === "" ? de.hervor === "" && !de.an.length : / Treffer \u00b7 .+ krit\. \u00b7 gr\u00f6\u00dfter /.test(de.mitte) && de.hervor === ziel.k,
      "9b: nach dem Sprachwechsel erzaehlt die Mitte in der neuen Sprache (oder ist leer)", de);
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="2"]').click()); await p.waitForTimeout(300);
    const neu = await lies();
    const stimmig = neu.mitte === "" ? neu.hervor === "" && !neu.an.length && neu.spur === ""
      : neu.mitte !== de.mitte && neu.an.length === 1 && neu.an[0] === neu.hervor.split("\u0000")[0];
    assert(stimmig, "9b: nach einem anderen Kampf erzaehlt die Mitte das neue Bild (oder ist leer, ohne Zeile und Spur)", { de, neu });
    assert(!s.fehler.length, "9b: ohne Fehler", s.fehler);
    await p.close();
  }
  // --- 10. Die Liste neben dem Ring (Spezifikation Glutring 4): Kopf, Zeilen, Trefferarten mit Zahl der Treffer, Tastatur, Sortieren
  {
    // Quick Fire trifft reihum normal, kritisch, stark, kritisch stark (je 20), Strafing 80-mal normal
    const z = ["CombatLogVersion,4"], beginn = at(22, 0, 0);
    for (let k = 0; k < 80; k++) {
      const [krit, stark] = [[0, 0], [1, 0], [0, 1], [1, 1]][k % 4];
      z.push(`${stamp(beginn + k * 500)},DamageDone,${QF[0]},${QF[1]},${[1000, 2000, 1500, 3000][k % 4]},${krit},${stark},${krit ? "kCritical" : "kNormalHit"},Tester,Stone Beetle`);
      z.push(`${stamp(beginn + k * 500 + 250)},DamageDone,${ST[0]},${ST[1]},500,0,0,kNormalHit,Tester,Stone Beetle`);
    }
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: z.join("\n") + "\n" } });
    const p = s.page; await ladeUndWaehle(p, 0, 1);
    const m = await p.evaluate(() => {
      const box = document.querySelector("#bars");
      const zeilen = [...box.querySelectorAll(".row.ringzeile")].map((r) => ({ ring: r.dataset.ring, offen: r.getAttribute("aria-expanded"),
        hoch: r.getBoundingClientRect().height, zellen: r.querySelectorAll("[role=gridcell]").length,
        texte: [...r.querySelectorAll("[data-k]")].map((c) => c.dataset.k + "=" + c.textContent) }));
      const arten = [...box.querySelectorAll('.row.catrow[data-parent="Quick Fire"]')].map((r) =>
        [r.dataset.cat, r.querySelector('[data-k="hits"]')?.textContent, r.querySelector('[data-k="damage"]')?.textContent]);
      const su = box.querySelector('.row.bdetail[data-detail="Quick Fire"]');
      return { rolle: box.getAttribute("role"), name: box.getAttribute("aria-label"),
        kopf: [...box.querySelectorAll(".bhead [role=columnheader]")].map((e) => e.dataset.k),
        dpsSort: box.querySelector('.bhead [data-k="dps"]')?.getAttribute("aria-sort"), zeilen, arten,
        summe: su ? { text: su.textContent, vorher: su.previousElementSibling?.dataset.cat, rolle: su.getAttribute("role"),
          span: su.querySelector("[role=gridcell]")?.getAttribute("aria-colspan") } : null };
    });
    assert(m.rolle === "treegrid" && m.name === "Damage table", "Liste: ein Treegrid mit Namen wie bisher", m);
    assert(JSON.stringify(m.kopf) === JSON.stringify(["name", "dps", "share", "hits", "critRate", "heavyRate"]) && m.dpsSort === "descending",
      "Liste: Kopf Name, DPS, Anteil, Treffer, Kritisch, Stark; die Vorgabe Schaden steht an DPS", m);
    assert(m.zeilen.length === 2 && m.zeilen.every((r) => Math.abs(r.hoch - 44) < 0.5 && r.zellen === 6),
      "Liste: eine Zeile je Faehigkeit, 44 Punkt, sechs Zellen", m.zeilen);
    assert(m.zeilen[0]?.ring === "Quick Fire" && m.zeilen[0].offen === "true" && m.zeilen[1]?.offen === "false",
      "die staerkste Faehigkeit ist beim Oeffnen aufgeklappt", m.zeilen);
    const qf = (m.zeilen[0]?.texte || []).join(" | ");
    assert(/share=78\.9%/.test(qf) && /hits=80 hits/.test(qf) && /critRate=50% crit/.test(qf) && /heavyRate=50% heavy/.test(qf),
      "Zeile: Anteil, Treffer, Kritanteil und Starkanteil", qf);
    assert(JSON.stringify(m.arten) === JSON.stringify([["normal", "20 hits", "20.0k"], ["crit", "20 hits", "40.0k"], ["heavy", "20 hits", "30.0k"],
      ["critheavy", "20 hits", "60.0k"]]), "aufgeklappt: die vier Trefferarten mit Zahl der Treffer und Schaden", m.arten);
    assert(!!m.summe && m.summe.vorher === "critheavy" && m.summe.rolle === "row" && m.summe.span === "6" &&
      m.summe.text === "80 hits in all \u00b7 biggest 3.0k \u00b7 avg 1.9k per hit \u00b7 damage 150.0k",
      "darunter Treffer gesamt, groesster Treffer, Schnitt und Schaden", m.summe);
    // Tastatur (Spezifikation 4): rechts auf, runter in die Arten, links zur Zeile und zu, Enter um; ein Tabstopp
    await p.focus('#bars .row[data-ring="Strafing"]');
    await p.keyboard.press("ArrowRight"); await p.waitForTimeout(120);
    const k1 = await p.evaluate(() => ({ auf: document.querySelector('#bars .row.ringzeile[data-ring="Strafing"]').getAttribute("aria-expanded"),
      fokus: document.activeElement?.dataset.ring }));
    await p.keyboard.press("ArrowDown"); await p.waitForTimeout(60);
    const k2 = await p.evaluate(() => document.activeElement?.dataset.cat);
    await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(60);
    await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(120);
    const k3 = await p.evaluate(() => ({ auf: document.querySelector('#bars .row.ringzeile[data-ring="Strafing"]').getAttribute("aria-expanded"),
      fokus: document.activeElement?.dataset.ring, cat: document.activeElement?.dataset.cat || "" }));
    await p.keyboard.press("Enter"); await p.waitForTimeout(120);
    const k4 = await p.evaluate(() => document.querySelector('#bars .row.ringzeile[data-ring="Strafing"]').getAttribute("aria-expanded"));
    const stopps = await p.evaluate(() => [...document.querySelectorAll("#bars .row")].filter((r) => r.tabIndex === 0).length);
    assert(k1.auf === "true" && k1.fokus === "Strafing" && k2 === "normal" && k3.auf === "false" && k3.fokus === "Strafing" && !k3.cat &&
      k4 === "true" && stopps === 1, "Tastatur: rechts auf, runter in die Trefferarten, links zur Zeile und zu, Enter um; ein Tabstopp", { k1, k2, k3, k4, stopps });
    // Sortieren ueber den Kopf wie bisher (der erste Klick ordnet absteigend)
    await p.click('#bars .bhead [data-k="name"]'); await p.waitForTimeout(120);
    const so = await p.evaluate(() => ({ erste: document.querySelector("#bars .row.ringzeile").dataset.ring,
      name: document.querySelector('#bars .bhead [data-k="name"]').getAttribute("aria-sort"), dps: document.querySelector('#bars .bhead [data-k="dps"]').getAttribute("aria-sort"),
      fokus: document.activeElement?.dataset.k }));
    assert(so.erste === "Strafing" && so.name === "descending" && so.dps === "none", "Sortieren nach Name ueber den Kopf", so);
    assert(!s.fehler.length, "Liste: keine Fehler", s.fehler);
    await p.close();
  }
  // --- 11. Bewegung (Spezifikation Glutring 3): der Ring waechst beim Oeffnen in 0,9 s auf, beim Wechsel zwischen Kaempfen
  // gleiten die Boegen, bei reduzierter Bewegung steht er sofort. Ein Bereichswechsel ist kein Oeffnen: zurueck im Kampf
  // steht der Ring desselben Kampfes sofort, ein anderer Kampf gleitet (CI-Befund Paritaet 08, 03.10.)
  {
    const s = await oeffne({ app: true }); const p = s.page;
    await p.evaluate(() => document.querySelector("#btnSample").click());
    await p.waitForFunction(() => !document.querySelector("#app").hidden && document.querySelector("#ring").dataset.fertig);
    const frueh = await p.evaluate(() => document.querySelector("#ring").dataset.fertig);
    await p.waitForTimeout(1100);
    const spaet = await p.evaluate(() => document.querySelector("#ring").dataset.fertig);
    assert(frueh === "0" && spaet === "1", "beim Oeffnen waechst der Ring auf und steht nach 0,9 s", { frueh, spaet });
    // derselbe Kampf, derselbe Umschalter: zurueck aus der Analyse steht er sofort, ohne zu warten
    await p.click('#bereiche [data-tab="analysis"]'); await p.waitForTimeout(100);
    await p.click('#bereiche [data-tab="timeline"]');
    const zurueck = await p.evaluate(() => ({ fertig: document.querySelector("#ring").dataset.fertig, gleitet: document.querySelector("#ring").dataset.gleitet,
      beschriftet: document.querySelector("#ring").dataset.beschriftet }));
    assert(zurueck.fertig === "1" && zurueck.gleitet === "0" && Number(zurueck.beschriftet) > 0,
      "Bereichswechsel: zurueck im Kampf steht der Ring desselben Kampfes sofort und beschriftet, er waechst nicht neu", zurueck);
    // ein anderer Kampf, in der Analyse gewaehlt: zurueck im Kampf gleiten die Boegen, er waechst nicht neu
    await p.click('#bereiche [data-tab="analysis"]'); await p.waitForTimeout(100);
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="1"]').click()); await p.waitForTimeout(100);
    await p.click('#bereiche [data-tab="timeline"]');
    const anders = await p.evaluate(() => ({ fertig: document.querySelector("#ring").dataset.fertig, gleitet: document.querySelector("#ring").dataset.gleitet }));
    await p.waitForTimeout(700);
    const anders2 = await p.evaluate(() => document.querySelector("#ring").dataset.gleitet);
    assert(anders.fertig === "1" && anders.gleitet === "1" && anders2 === "0",
      "Bereichswechsel mit anderem Kampf: zurueck im Kampf gleiten die Boegen, er waechst nicht neu", { anders, anders2 });
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="0"]').click()); await p.waitForTimeout(700);
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="1"]').click());
    const g = await p.evaluate(() => ({ fertig: document.querySelector("#ring").dataset.fertig, gleitet: document.querySelector("#ring").dataset.gleitet }));
    await p.waitForTimeout(700);
    const g2 = await p.evaluate(() => document.querySelector("#ring").dataset.gleitet);
    assert(g.fertig === "1" && g.gleitet === "1" && g2 === "0", "beim Wechsel zwischen Kaempfen waechst er nicht neu, die Boegen gleiten", { g, g2 });
    assert(!s.fehler.length, "Bewegung: keine Fehler", s.fehler);
    await p.close();
  }
  {
    const s = await oeffne({ app: true }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    const r = await p.evaluate(() => ({ fertig: document.querySelector("#ring").dataset.fertig, gleitet: document.querySelector("#ring").dataset.gleitet }));
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="1"]').click());
    const w = await p.evaluate(() => document.querySelector("#ring").dataset.gleitet);
    assert(r.fertig === "1" && r.gleitet === "0" && w === "0", "bei reduzierter Bewegung steht der Ring sofort, nichts gleitet", { r, w });
    await p.close();
  }
  // --- 12. Gruppe (Spezifikation Glutring 5): innen die Mitglieder, aussen ihre Faehigkeiten; die Liste der Mitglieder;
  // ein Mitglied oeffnet seinen Ring mit Trefferarten, "\u2039 Gruppe" und Esc fuehren zurueck; das Band zeigt den Anteil je Mitglied
  {
    const arten = (f) => [["normal", 40000 * f, 10], ["crit", 60000 * f, 8], ["heavy", 30000 * f, 4], ["critheavy", 90000 * f, 6]]
      .map(([k, d, h]) => ({ k, d, h, m: d / h }));
    const faeh = (name, sid, f) => ({ name, sid, damage: 220000 * f, dps: 3667 * f, hits: 28, crit: 14, heavy: 10, max: 16000, cats: arten(f) });
    const zeile = (name, f) => ({ name, waiting: false, damage: 440000 * f, dps: 7333 * f, hits: 56, crit: 0.5, heavy: 0.36, seconds: 60, max: 16000,
      skills: [faeh("Quick Fire", "964762401", f), faeh("Strafing", "945674044", f)], hasCurve: false, share: 0, onTarget: true,
      target: "Vulcanus", lang: "en", weapons: ["Crossbow", "Longbow"], ventius: false, age: 0 });
    const board = [zeile("Tester", 1), zeile("Mitglied Eins", 1.5), zeile("Mitglied Zwei", 0.5)];
    const s = await oeffne({ app: true, gruppe: { role: "host", code: "QX7K", name: "Tester", board, target: "Vulcanus", error: "" },
      helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS.slice(0, 1)) } });
    const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await ladeUndWaehle(p, 0, 1);
    await p.waitForFunction(() => !!document.querySelector("#segParty")?.getClientRects().length, null, { timeout: 8000 }).catch(() => {});
    await p.click("#segParty"); await p.waitForTimeout(200);
    const g = await p.evaluate(() => {
      const cv = document.querySelector("#ring");
      return { glut: document.body.classList.contains("glut"), gruppe: document.body.classList.contains("ringgruppe"),
        innen: +cv.dataset.innen, boegen: +cv.dataset.boegen, name: cv.getAttribute("aria-label"),
        zeilen: [...document.querySelectorAll("#bars .ringzeile[data-member]")].map((z) => [z.dataset.member, z.classList.contains("me")]),
        kopf: [...document.querySelectorAll("#bars .bhead [role=columnheader]")].map((e) => e.dataset.k),
        du: document.querySelector("#ringDu").hidden ? "" : document.querySelector("#ringDu").textContent,
        seg: [...document.querySelectorAll("#bandGruppe [data-m]")].map((e) => [e.dataset.m, e.getBoundingClientRect().width]),
        band: document.querySelector("#bandGruppe").getAttribute("aria-label") || "",
        kurve: document.querySelector("#kurve").getClientRects().length, urteil: document.querySelector("#urteilFeld").getClientRects().length };
    });
    assert(g.glut && g.gruppe && g.innen === 3 && g.boegen === 6 && /^Group ring: /.test(g.name),
      "Gruppe: der Ring zeigt innen drei Mitglieder, aussen ihre sechs Faehigkeiten", g);
    assert(JSON.stringify(g.zeilen) === JSON.stringify([["Mitglied Eins", false], ["Tester", true], ["Mitglied Zwei", false]]) &&
      JSON.stringify(g.kopf) === JSON.stringify(["name", "dps", "share", "klasse"]), "Gruppe: die Mitglieder nach DPS mit Klasse, die eigene Zeile markiert", g);
    assert(/^You 7\.3k \u00b7 rank 2 of 3$/.test(g.du), "Gruppe: in der Mitte \"Du ... Platz 2 von 3\"", g.du);
    assert(g.seg.length === 3 && Math.abs(g.seg[0][1] / g.seg[1][1] - 1.5) < 0.05 && /^Share per member: /.test(g.band),
      "Gruppe: das Band zeigt den Anteil je Mitglied als gestapelten Balken", g);
    assert(g.kurve === 0 && g.urteil === 0, "Gruppe: keine Kurve und kein Urteil des eigenen Kampfes (E 11)", g);
    // Fixrunde 1: ueber dem Band steht in der Gruppe "Anteil je Mitglied" (auch der Name des Felds), der Weg in die Rotation fehlt dort
    const bandKopf = () => p.evaluate(() => ({ titel: document.querySelector("#kurveTitel").textContent,
      feld: document.querySelector("#kurveFeld").getAttribute("aria-label"), spuren: document.querySelector("#spurenAuf").getClientRects().length }));
    const bk = await bandKopf();
    assert(bk.titel === "Share per member" && bk.feld === "Share per member" && bk.spuren === 0,
      "Gruppe: ueber dem Band \"Share per member\", auch als Name des Felds; kein Weg in die Rotation des eigenen Kampfs", bk);
    await p.focus('#bars .ringzeile[data-member="Mitglied Eins"]'); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    const m = await p.evaluate(() => ({ mitglied: document.body.classList.contains("ringmitglied"), zurueck: !document.querySelector("#ringZurueck").hidden,
      zeilen: [...document.querySelectorAll("#bars .ringzeile")].map((z) => z.dataset.ring), fokus: document.activeElement?.dataset.ring,
      zahl: document.querySelector("#ringMitgliedZahl")?.textContent, einheit: document.querySelector("#ringMitgliedEinheit")?.textContent,
      boegen: +document.querySelector("#ring").dataset.boegen, innen: +document.querySelector("#ring").dataset.innen }));
    assert(m.mitglied && m.zurueck && JSON.stringify(m.zeilen) === JSON.stringify(["Quick Fire", "Strafing"]) && m.fokus === "Quick Fire" &&
      m.zahl === "11.0k" && m.einheit === "Mitglied Eins \u00b7 per second" && m.boegen === 2 && m.innen === 0,
      "Enter auf einem Mitglied oeffnet seinen Ring mit seinen Faehigkeiten, der Fokus geht in seine Liste", m);
    const bm = await bandKopf();
    assert(bm.titel === "Share per member" && bm.spuren === 0, "im Ring eines Mitglieds: Band \"Share per member\", kein Weg in die Rotation", bm);
    await p.keyboard.press("Enter"); await p.waitForTimeout(150);
    const arten2 = await p.evaluate(() => [...document.querySelectorAll('#bars .row.catrow[data-parent="Quick Fire"]')].map((z) =>
      [z.dataset.cat, z.querySelector('[data-k="hits"]').textContent]));
    assert(JSON.stringify(arten2) === JSON.stringify([["normal", "10 hits"], ["crit", "8 hits"], ["heavy", "4 hits"], ["critheavy", "6 hits"]]),
      "im Ring eines Mitglieds: die Trefferarten mit Zahl der Treffer aus seinem Bericht", arten2);
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    const z = await p.evaluate(() => ({ mitglied: document.body.classList.contains("ringmitglied"), fokus: document.activeElement?.dataset.member,
      innen: +document.querySelector("#ring").dataset.innen }));
    assert(!z.mitglied && z.fokus === "Mitglied Eins" && z.innen === 3, "Esc fuehrt zurueck zur Gruppe, der Fokus auf das Mitglied", z);
    const pkt = await p.evaluate(() => { const cv = document.querySelector("#ring"), r = cv.getBoundingClientRect(), q = JSON.parse(cv.dataset.mitte);
      const rr = q.r1 * 0.64, w = -Math.PI / 2 + 0.2; return { x: r.left + q.x + Math.cos(w) * rr, y: r.top + q.y + Math.sin(w) * rr }; });
    await p.mouse.click(pkt.x, pkt.y); await p.waitForTimeout(200);
    const k = await p.evaluate(() => ({ mitglied: document.body.classList.contains("ringmitglied"),
      zeilen: [...document.querySelectorAll("#bars .ringzeile")].map((r) => r.dataset.ring) }));
    await p.click("#ringZurueck"); await p.waitForTimeout(150);
    const k2 = await p.evaluate(() => document.body.classList.contains("ringmitglied"));
    assert(k.mitglied && JSON.stringify(k.zeilen) === JSON.stringify(["Quick Fire", "Strafing"]) && !k2,
      "Klick auf ein Mitglied im Ring oeffnet seinen Ring, \"\u2039 Gruppe\" fuehrt zurueck", { k, k2 });
    await p.click('#groupSeg [data-g="skill"]'); await p.waitForTimeout(200);
    const be = await bandKopf();
    assert(be.titel === "Damage per second" && be.feld === "Damage per second" && be.spuren === 1,
      "zurueck im eigenen Kampf: wieder \"Damage per second\" und der Weg in die Rotation", be);
    assert(!s.fehler.length, "Gruppe: keine Fehler", s.fehler);
    await p.close();
    // dasselbe auf Deutsch
    const sd = await oeffne({ app: true, lang: "de", gruppe: { role: "host", code: "QX7K", name: "Tester", board, target: "Vulcanus", error: "" },
      helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS.slice(0, 1)) } });
    const pd = sd.page;
    await pd.emulateMedia({ reducedMotion: "reduce" });
    await ladeUndWaehle(pd, 0, 1);
    await pd.waitForFunction(() => !!document.querySelector("#segParty")?.getClientRects().length, null, { timeout: 8000 }).catch(() => {});
    await pd.click("#segParty"); await pd.waitForTimeout(200);
    const kopfDe = () => pd.evaluate(() => [document.querySelector("#kurveTitel").textContent, document.querySelector("#kurveFeld").getAttribute("aria-label")]);
    const dg = await kopfDe();
    await pd.click('#groupSeg [data-g="skill"]'); await pd.waitForTimeout(200);
    const de = await kopfDe();
    assert(JSON.stringify(dg) === JSON.stringify(["Anteil je Mitglied", "Anteil je Mitglied"]) &&
      JSON.stringify(de) === JSON.stringify(["Schaden pro Sekunde", "Schaden pro Sekunde"]),
      "de: in der Gruppe \"Anteil je Mitglied\" ueber dem Band, im eigenen Kampf \"Schaden pro Sekunde\"", { dg, de });
    assert(!sd.fehler.length, "Gruppe de: keine Fehler", sd.fehler);
    await pd.close();
  }
  // --- 13. Kampf nachspielen (Spezifikation Glutring 6): im Ringfeld, spielt, haelt an, spult, Tempo, Siegerehrung, Esc
  {
    const s = await oeffne({ app: true }); const p = s.page; await beispiel(p);
    await p.click("#ringNachspielen"); await p.waitForTimeout(400);
    const a = await p.evaluate(() => ({ offen: !document.querySelector("#rennen").hidden, ring: document.querySelector("#ring").getClientRects().length,
      liste: document.querySelector("#bars").getClientRects().length > 0, band: document.querySelector("#kurveFeld").getClientRects().length > 0,
      spielt: document.querySelector("#rennen").dataset.spielt, t: +document.querySelector("#rennen").dataset.t,
      bahnen: document.querySelectorAll("#rennBahnen .rbahn").length, fokus: document.activeElement?.id,
      uhr: document.querySelector("#rennUhr").textContent, von: document.querySelector("#rennVon").textContent }));
    assert(a.offen && a.ring === 0 && a.liste && a.band, "das Rennen oeffnet im Ringfeld, der Ring weicht, Liste und Band bleiben", a);
    assert(a.spielt === "1" && a.t > 0 && a.bahnen >= 2 && a.bahnen <= 13 && a.fokus === "rennPlay",
      "es spielt von selbst, eine Bahn je Faehigkeit (zwoelf und die uebrigen)", a);
    assert(/^\d+:\d\d$/.test(a.uhr) && /^of \d+:\d\d$/.test(a.von), "oben die Uhr \"0:42 von 1:30\"", a);
    await p.focus("#rennPos"); await p.keyboard.press(" "); await p.waitForTimeout(100);
    const t1 = await p.evaluate(() => ({ spielt: document.querySelector("#rennen").dataset.spielt, t: +document.querySelector("#rennen").dataset.t }));
    await p.waitForTimeout(300);
    const t2 = await p.evaluate(() => +document.querySelector("#rennen").dataset.t);
    assert(t1.spielt === "0" && t2 === t1.t, "die Leertaste haelt an", { t1, t2 });
    await p.evaluate(() => { const r = document.querySelector("#rennPos"); r.value = String(+r.max / 2); r.dispatchEvent(new Event("input", { bubbles: true })); });
    const sp = await p.evaluate(() => {
      const zahl = (s) => parseFloat(s) * ({ k: 1e3, M: 1e6, B: 1e9 }[s.trim().slice(-1)] || 1);
      const b = [...document.querySelectorAll("#rennBahnen .rbahn")].map((e) => ({ platz: +e.dataset.platz, wert: zahl(e.querySelector(".rwert").textContent),
        top: parseFloat(e.style.top) })).sort((x, y) => x.platz - y.platz);
      return { t: +document.querySelector("#rennen").dataset.t, max: +document.querySelector("#rennPos").max, b,
        finale: document.querySelector("#rennFinale").textContent, wert: document.querySelector("#rennPos").getAttribute("aria-valuetext") };
    });
    assert(Math.abs(sp.t - sp.max / 2) < 0.2 && sp.b.every((x, i) => i === 0 || (x.wert <= sp.b[i - 1].wert && x.top > sp.b[i - 1].top)) &&
      !sp.finale && /^\d+:\d\d of \d+:\d\d$/.test(sp.wert), "spulen: die Bahnen stehen nach dem Stand dieser Sekunde, noch ohne Siegerehrung", sp);
    await p.click('#rennTempo [data-tempo="4"]');
    await p.click("#rennPlay");
    await p.waitForFunction(() => document.querySelector("#rennen").dataset.spielt === "0", null, { timeout: 4000 }).catch(() => {});
    const e = await p.evaluate(() => {
      const probe = document.createElement("i"); probe.style.color = "var(--gold)"; document.body.append(probe);
      const gold = getComputedStyle(probe).color; probe.remove();
      const m1 = document.querySelector("#rennBahnen .medaille.m1");
      return { t: +document.querySelector("#rennen").dataset.t, max: +document.querySelector("#rennPos").max,
        tempo: document.querySelector('#rennTempo [data-tempo="4"]').getAttribute("aria-pressed"),
        medaillen: [...document.querySelectorAll("#rennBahnen .medaille")].map((m) => m.textContent).sort(),
        gold: !!m1 && getComputedStyle(m1).backgroundColor === gold,
        andere: [...document.querySelectorAll("#rennBahnen .medaille:not(.m1)")].every((m) => getComputedStyle(m).backgroundColor !== gold),
        finale: document.querySelector("#rennFinale").textContent };
    });
    assert(e.t === e.max && e.tempo === "true" && JSON.stringify(e.medaillen) === JSON.stringify(["1", "2", "3"]) && e.gold && e.andere,
      "4x spielt zu Ende: Plaetze 1 bis 3 mit Abzeichen, Gold nur auf Platz 1", e);
    assert(/(has led since \d+:\d\d and never gave it up|led from the start)\. Behind: .+ with [\d.]+[kMB]?\.$/.test(e.finale),
      "am Ende ein Satz, der das Rennen liest", e.finale);
    await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    const z = await p.evaluate(() => ({ zu: document.querySelector("#rennen").hidden, ring: document.querySelector("#ring").getClientRects().length > 0,
      fokus: document.activeElement?.id }));
    assert(z.zu && z.ring && z.fokus === "ringNachspielen", "Esc schliesst das Rennen, der Ring ist zurueck, der Fokus auf \"Kampf nachspielen\"", z);
    await p.click("#ringNachspielen"); await p.waitForTimeout(100);
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="1"]').click()); await p.waitForTimeout(150);
    assert(await p.evaluate(() => document.querySelector("#rennen").hidden), "ein anderer Kampf schliesst das Rennen");
    assert(!s.fehler.length, "Rennen: keine Fehler", s.fehler);
    await p.close();
  }
  {
    const s = await oeffne({ app: true }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    await p.click("#ringNachspielen"); await p.waitForTimeout(150);
    const r = await p.evaluate(() => ({ spielt: document.querySelector("#rennen").dataset.spielt, t: +document.querySelector("#rennen").dataset.t,
      max: +document.querySelector("#rennPos").max, medaillen: document.querySelectorAll("#rennBahnen .medaille").length,
      uebergang: getComputedStyle(document.querySelector("#rennBahnen .rbahn")).transitionDuration }));
    assert(r.spielt === "0" && r.t === r.max && r.medaillen === 3 && /^0s/.test(r.uebergang),
      "reduzierte Bewegung: kein Selbststart, das Ende steht da, die Bahnen springen", r);
    await p.close();
  }
  {
    // fuenf Pulls an Vulcanus mit der Mechanik von 0:24 bis 0:30 (wie mechLog in test-analyse-page.mjs)
    const z = ["CombatLogVersion,4"];
    for (let n = 0; n < 5; n++) {
      const beginn = at(23, 0, 0) + n * 180000;
      for (let k = 0; k < 700; k++) {
        const ms = k * 100, panzer = ms >= 24000 && ms < 30000;
        const [skill, sid] = [QF, DM, ST][k % 3];
        z.push(`${stamp(beginn + ms)},DamageDone,${skill},${sid},${panzer ? 150 : k % 5 === 0 ? 40000 : 600},0,0,kNormalHit,Tester,Vulcanus`);
      }
    }
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: z.join("\n") + "\n" } }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await ladeUndWaehle(p, 1, 5);
    await p.click("#ringNachspielen"); await p.waitForTimeout(100);
    const bei = (sek) => p.evaluate((x) => { const r = document.querySelector("#rennPos"); r.value = String(x);
      r.dispatchEvent(new Event("input", { bubbles: true })); return document.querySelector("#rennMechText").textContent; }, sek);
    const drin = await bei(26.5), draussen = await bei(45);
    assert(drin === "Mechanic \u2013 nobody lands much" && draussen === "", "Mechanik: beim Durchlaufen eingeblendet, danach wieder weg", { drin, draussen });
    assert(!s.fehler.length, "Rennen mit Mechanik: keine Fehler", s.fehler);
    await p.close();
  }
  /* Nachbesserung 03.10. (gewuenscht): die Knoepfe oben rechts ragen in keine Bahn; in einem hohen Feld wachsen die
     Bahnen bis 64 Punkt und ihr Block steht mittig im freien Raum (das Rennen ist eine Grafik, keine Liste) */
  for (const [breite, hoehe] of [[1280, 860], [2000, 1480]]) {
    const s = await oeffne({ app: true, breite, hoehe }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    await p.click("#ringNachspielen"); await p.waitForTimeout(150);
    const l = await p.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const bahnen = [...document.querySelectorAll("#rennBahnen .rbahn")].map(r);
      const knoepfe = ["#btnSaveRun", "#btnBild"].map((k) => document.querySelector(k)).filter((e) => e && e.getClientRects().length).map(r);
      const schnitt = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const box = r(document.querySelector("#rennBahnen")), rr = r(document.querySelector("#ringRechts"));
      const oben = Math.min(...bahnen.map((b) => b.top)), unten = Math.max(...bahnen.map((b) => b.bottom));
      const frei = Math.max(box.top, rr.bottom > box.top ? rr.bottom : box.top);
      return { knoepfe: knoepfe.length, treffer: knoepfe.filter((k) => bahnen.some((b) => schnitt(k, b))).length,
        hoch: Math.max(...bahnen.map((b) => b.height)), ueber: Math.round(oben - frei), unter: Math.round(box.bottom - unten) };
    });
    assert(l.knoepfe === 2 && l.treffer === 0, `${breite}x${hoehe}: \"Kampf speichern\" und \"Teilen\" ragen in keine Bahn`, l);
    if (breite === 2000)
      assert(l.hoch > 44 && l.hoch <= 64 && l.unter <= l.ueber + 8 && Math.abs(l.unter - l.ueber) <= 8,
        "2000x1480: die Bahnen hoeher als 44, hoechstens 64, der Block mittig zwischen Kopf und Steuerleiste", l);
    assert(!s.fehler.length, `${breite}x${hoehe} Lage der Bahnen: keine Fehler`, s.fehler);
    await p.close();
  }
  /* Esc auch nach einem Klick in die Liste; schliesst sich das Rennen von aussen, waehrend der Fokus darin liegt,
     geht er auf "Kampf nachspielen" (sichtbar) oder in die Liste (Kompakt); Bereich und Kompakt schliessen es */
  {
    const s = await oeffne({ app: true }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    await p.click("#ringNachspielen"); await p.waitForTimeout(150);
    await p.click("#bars .ringzeile[data-skill]"); await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    const esc = await p.evaluate(() => ({ zu: document.querySelector("#rennen").hidden, fokus: document.activeElement?.id }));
    assert(esc.zu && esc.fokus === "ringNachspielen", "Esc nach einem Klick in die Liste schliesst das Rennen", esc);
    // ein anderer Kampf, der Fokus lag auf "Abspielen"
    await p.click("#ringNachspielen"); await p.waitForTimeout(150);
    await p.evaluate(() => { document.querySelector("#rennPlay").focus(); document.querySelector('#fightList .fight[data-i="1"]').click(); });
    await p.waitForTimeout(150);
    const k = await p.evaluate(() => ({ zu: document.querySelector("#rennen").hidden, fokus: document.activeElement?.id }));
    assert(k.zu && k.fokus === "ringNachspielen", "ein anderer Kampf bei Fokus im Rennen: der Fokus geht auf \"Kampf nachspielen\"", k);
    // ein anderer Bereich
    await p.click("#ringNachspielen"); await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelector('#bereiche [data-tab="rotation"]').click()); await p.waitForTimeout(150);
    const b = await p.evaluate(() => ({ zu: document.querySelector("#rennen").hidden, rennt: document.body.classList.contains("rennt") }));
    await p.evaluate(() => document.querySelector('#bereiche [data-tab="timeline"]').click()); await p.waitForTimeout(200);
    const b2 = await p.evaluate(() => ({ zu: document.querySelector("#rennen").hidden, ring: document.querySelector("#ring").getClientRects().length > 0 }));
    assert(b.zu && !b.rennt && b2.zu && b2.ring, "ein anderer Bereich schliesst das Rennen, zurueck steht der Ring", { b, b2 });
    // Kompakt, der Fokus lag auf "Abspielen"
    await p.click("#ringNachspielen"); await p.waitForTimeout(150);
    await p.evaluate(() => { document.querySelector("#rennPlay").focus(); document.querySelector("#btnCompact").click(); });
    await p.waitForFunction(() => document.body.classList.contains("compact"));
    await p.waitForTimeout(150);
    const c = await p.evaluate(() => ({ zu: document.querySelector("#rennen").hidden, rennt: document.body.classList.contains("rennt"),
      liste: !!document.activeElement && document.querySelector("#bars").contains(document.activeElement) }));
    assert(c.zu && !c.rennt && c.liste, "Kompakt schliesst das Rennen, der Fokus geht in die Liste", c);
    assert(!s.fehler.length, "Rennen schliessen: keine Fehler", s.fehler);
    await p.close();
  }
  /* In der Gruppe spielt das Rennen den eigenen Kampf (Entscheidung 02.10.): die Bahnen sind Faehigkeiten, keine Mitglieder */
  {
    const faeh = (name, sid, f) => ({ name, sid, damage: 220000 * f, dps: 3667 * f, hits: 28, crit: 14, heavy: 10, max: 16000, cats: [] });
    const zeile = (name, f) => ({ name, waiting: false, damage: 440000 * f, dps: 7333 * f, hits: 56, crit: 0.5, heavy: 0.36, seconds: 60, max: 16000,
      skills: [faeh("Quick Fire", "964762401", f), faeh("Strafing", "945674044", f)], hasCurve: false, share: 0, onTarget: true,
      target: "Vulcanus", lang: "en", weapons: ["Crossbow", "Longbow"], ventius: false, age: 0 });
    const board = [zeile("Tester", 1), zeile("Mitglied Eins", 1.5), zeile("Mitglied Zwei", 0.5)];
    const s = await oeffne({ app: true, gruppe: { role: "host", code: "QX7K", name: "Tester", board, target: "Vulcanus", error: "" },
      helfer: { dir: "C:\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS.slice(0, 1)) } });
    const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await ladeUndWaehle(p, 0, 1);
    await p.waitForFunction(() => !!document.querySelector("#segParty")?.getClientRects().length, null, { timeout: 8000 }).catch(() => {});
    await p.click("#segParty"); await p.waitForTimeout(200);
    await p.click("#ringNachspielen"); await p.waitForTimeout(150);
    const g = await p.evaluate(() => ({ gruppe: document.body.classList.contains("ringgruppe"), offen: !document.querySelector("#rennen").hidden,
      keys: [...document.querySelectorAll("#rennBahnen .rbahn")].map((e) => e.dataset.key).sort() }));
    assert(g.gruppe && g.offen && JSON.stringify(g.keys) === JSON.stringify(SKILLS.map((x) => x[0]).sort()),
      "Gruppe: das Rennen spielt den eigenen Kampf, eine Bahn je eigener Faehigkeit, kein Mitglied", g);
    assert(!s.fehler.length, "Rennen in der Gruppe: keine Fehler", s.fehler);
    await p.close();
  }
  // --- 14. Querschnitt (Spezifikation Glutring 1 und 7): drei Themen, 560 Punkt, 2000 x 1480, Vorleser
  {
    const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    for (const thema of ["dark", "light", "tnl"]) {
      const s = await oeffne({ app: true, config: { theme: thema } }); const p = s.page;
      await p.emulateMedia({ reducedMotion: "reduce" });
      await beispiel(p);
      const pk = await p.evaluate(() => { const cv = document.querySelector("#ring"), r = cv.getBoundingClientRect(), q = JSON.parse(cv.dataset.punkte)[0];
        return { x: r.left + q.x, y: r.top + q.y }; });
      await p.mouse.move(pk.x, pk.y); await p.waitForTimeout(150);
      const m = await p.evaluate(() => {
        const wert = (eig, v) => { const e = document.createElement("i"); e.style[eig] = v; document.body.append(e); const c = getComputedStyle(e)[eig]; e.remove(); return c; };
        const an = document.querySelector("#bars .ringzeile.ringan");
        return { theme: document.documentElement.dataset.theme, schein: document.querySelector("#ring").dataset.schein,
          hervor: document.querySelector("#ring").dataset.hervor, zeileGrund: an ? getComputedStyle(an).backgroundImage : "",
          pick: wert("backgroundImage", "var(--pick-wash)"), comb: wert("backgroundColor", "var(--comb)"),
          farben: ["#hRead", "#hMeta", '#bars .ringzeile .v[data-k="hits"]', "#ringFokus", "#kurveUnter"].map((q) => {
            const e = document.querySelector(q); return [q, e ? getComputedStyle(e).color : ""]; }),
          quer: document.documentElement.scrollWidth > innerWidth };
      });
      assert(m.theme === thema && !!m.hervor && (thema === "light" ? m.schein === "0" : +m.schein > 0),
        `${thema}: der Bogen unter dem Zeiger glueht in seiner Farbe, im hellen Thema nicht`, m);
      assert(m.zeileGrund === m.pick && m.zeileGrund !== "none", `${thema}: die hervorgehobene Zeile im Auswahlton (im TnL-Thema Magenta)`, m);
      for (const [q, c] of m.farben) assert(!!c && kontrast(c, m.comb) >= 4.5, `${thema}: ${q} lesbar auf --comb (4,5:1)`, { c, comb: m.comb });
      assert(!m.quer && !s.fehler.length, `${thema}: kein Querrollen, keine Fehler`, { quer: m.quer, fehler: s.fehler });
      await p.close();
    }
  }
  {
    const s = await oeffne({ app: true, breite: 560, hoehe: 900 }); const p = s.page; await beispiel(p);
    const a = await p.evaluate(() => ({ quer: document.documentElement.scrollWidth > innerWidth, d: +document.querySelector("#ring").dataset.d }));
    await p.click("#ringNachspielen"); await p.waitForTimeout(200);
    const b = await p.evaluate(() => ({ quer: document.documentElement.scrollWidth > innerWidth,
      rechts: [...document.querySelectorAll("#rennBahnen .rbahn")].map((e) => e.getBoundingClientRect().right) }));
    assert(!a.quer && a.d >= 280 && !b.quer && b.rechts.every((x) => x <= 560), "560 Punkt: der Ring mindestens 280, kein Querrollen, auch im Rennen", { a, b });
    assert(!s.fehler.length, "560 Punkt: keine Fehler", s.fehler);
    await p.close();
  }
  {
    const s = await oeffne({ app: true, breite: 2000, hoehe: 1480 }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    const m = await p.evaluate(() => ({ d: +document.querySelector("#ring").dataset.d, liste: document.querySelector(".table").getBoundingClientRect().width,
      zeilen: [...document.querySelectorAll("#bars .row")].map((z) => z.getBoundingClientRect().height),
      rollt: document.documentElement.scrollHeight > innerHeight + 1 || document.querySelector("#app").scrollHeight > document.querySelector("#app").clientHeight + 1,
      beschriftet: +document.querySelector("#ring").dataset.beschriftet }));
    assert(m.d === 760 && Math.abs(m.liste - 400) <= 1.5 && m.zeilen.every((h) => h <= 44.5) && !m.rollt && m.beschriftet > 0,
      "2000 x 1480: Ring 760, Liste 400, Zeilen hoechstens 44, beschriftet, nichts rollt", m);
    await p.close();
  }
  {
    const s = await oeffne({ app: true }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    const bild = await p.getByRole("img", { name: /^Ring: / }).count();
    const baum = await p.getByRole("treegrid", { name: "Damage table" }).count();
    await p.click("#ringNachspielen"); await p.waitForTimeout(150);
    const bereich = await p.getByRole("region", { name: "Fight replay" }).count();
    const leiste = await p.getByRole("slider", { name: "Time in the fight" }).count();
    const tempo = await p.getByRole("group", { name: "Speed" }).count();
    const live = await p.evaluate(() => document.querySelector("#rennFinale").getAttribute("aria-live"));
    assert(bild === 1 && baum === 1 && bereich === 1 && leiste === 1 && tempo === 1 && live === "polite",
      "Vorleser: der Ring ein Bild mit Beschreibung, die Liste ein Treegrid, das Rennen ein Bereich mit Leiste und Tempo, das Ende angesagt",
      { bild, baum, bereich, leiste, tempo, live });
    await p.close();
  }
  /* --- 14b. Nachschliff 03.10. (Rueckmeldung und die Bilder der Aufgaben 4 bis 9):
     - die grosse Zahl selbst steht auf dem Mittelpunkt des Rings (nicht der Block aus Zahl, Einheit und Erzaehlung),
       hoechstens 2 Punkt daneben - in jeder Groesse, im eigenen Kampf und in der Gruppe, mit und ohne Hervorheben;
     - die rechte Spalte (Liste und Urteil) reicht bis zur Unterkante des Rasters, ihr Grund laeuft durch (--comb),
       das Urteil steht unten in ihr; Zeilen bleiben hoechstens 44 Punkt;
     - neben dem 1680-Punkt-Raster passt der Grund zum Ringfeld (alle drei Themen);
     - die Summenzeile der Trefferarten bricht um statt abzuschneiden;
     - die Namen am Ring kuerzen sich nur, wenn sie auf ihrer Seite wirklich nicht passen. */
  const gBoard = (() => {
    const arten = (f) => [["normal", 40000 * f, 10], ["crit", 60000 * f, 8], ["heavy", 30000 * f, 4], ["critheavy", 90000 * f, 6]]
      .map(([k, d, h]) => ({ k, d, h, m: d / h }));
    const faeh = (name, sid, f) => ({ name, sid, damage: 220000 * f, dps: 3667 * f, hits: 28, crit: 14, heavy: 10, max: 16000, cats: arten(f) });
    const zeile = (name, f) => ({ name, waiting: false, damage: 440000 * f, dps: 7333 * f, hits: 56, crit: 0.5, heavy: 0.36, seconds: 60, max: 16000,
      skills: [faeh("Quick Fire", "964762401", f), faeh("Strafing", "945674044", f)], hasCurve: false, share: 0, onTarget: true,
      target: "Vulcanus", lang: "en", weapons: ["Crossbow", "Longbow"], ventius: false, age: 0 });
    return [zeile("Tester", 1), zeile("Mitglied Eins", 1.5), zeile("Mitglied Zwei", 0.5)];
  })();
  async function gruppeAuf(opts) {
    const s = await oeffne({ app: true, ...opts, gruppe: { role: "host", code: "QX7K", name: "Tester", board: gBoard, target: "Vulcanus", error: "" },
      helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS.slice(0, 1)) } });
    await s.page.emulateMedia({ reducedMotion: "reduce" });
    await ladeUndWaehle(s.page, 0, 1);
    await s.page.waitForFunction(() => !!document.querySelector("#segParty")?.getClientRects().length, null, { timeout: 8000 }).catch(() => {});
    await s.page.click("#segParty"); await s.page.waitForTimeout(200);
    return s;
  }
  const zahlMitte = (p) => p.evaluate(() => {
    const cv = document.querySelector("#ring"), r = cv.getBoundingClientRect(), m = JSON.parse(cv.dataset.mitte || "null");
    const z = document.querySelector(document.body.classList.contains("ringmitglied") ? "#ringMitgliedZahl" : "#hDps").getBoundingClientRect();
    return m ? { dx: +(z.left + z.width / 2 - r.left - m.x).toFixed(1), dy: +(z.top + z.height / 2 - r.top - m.y).toFixed(1), h: Math.round(z.height) } : null;
  });
  for (const [breite, hoehe] of [[1280, 860], [2000, 1480], [1100, 700], [560, 900]]) {
    for (const gruppe of [false, true]) {
      const s = gruppe ? await gruppeAuf({ breite, hoehe }) : await oeffne({ app: true, breite, hoehe });
      const p = s.page;
      if (!gruppe) { await p.emulateMedia({ reducedMotion: "reduce" }); await beispiel(p); }
      const wo = `${breite}x${hoehe}${gruppe ? " Gruppe" : ""}`;
      const ohne = await zahlMitte(p);
      const pk = await p.evaluate(() => { const cv = document.querySelector("#ring"), r = cv.getBoundingClientRect(), q = JSON.parse(cv.dataset.punkte)[0];
        return { x: r.left + q.x, y: r.top + q.y }; });
      await p.mouse.move(pk.x, pk.y); await p.waitForTimeout(150);
      const mit = await zahlMitte(p);
      const hervor = await p.evaluate(() => document.querySelector("#ring").dataset.hervor);
      const nah = (m) => !!m && Math.hypot(m.dx, m.dy) <= 2;
      assert(nah(ohne) && nah(mit) && !!hervor, `${wo}: die grosse Zahl steht auf dem Mittelpunkt des Rings, auch beim Hervorheben`, { ohne, mit, hervor });
      assert(!s.fehler.length, `${wo}: Mitte ohne Fehler`, s.fehler);
      await p.close();
    }
  }
  {
    // auch unter 200 % Vergroesserung (zoom auf <html>): die Zahl auf dem Mittelpunkt, die Namen am Ring nicht unter 11 Punkt der Seite
    const s = await oeffne({ app: true, breite: 2200, hoehe: 1400, config: { uiZoom: 200 } }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    const m = await zahlMitte(p);
    const sch = await p.evaluate(() => JSON.parse(document.querySelector("#ring").dataset.schilder || "[]").map((x) => x.b - x.t));
    assert(!!m && Math.hypot(m.dx, m.dy) <= 2 * 2 && sch.length > 0 && sch.every((h) => h >= 2 * 30),
      "200 %: die grosse Zahl auf dem Mittelpunkt, die Beschriftung waechst mit", { m, sch });
    assert(!s.fehler.length, "200 % Mitte: keine Fehler", s.fehler);
    await p.close();
  }
  /* Fixrunde 1 zu Aufgabe 10: unter 200 % bleibt die Zahl im Ringloch (schmaler als 0,7 des Lochs) und die gestapelte
     Buehne hoechstens Ring + 60 Punkt der Seite hoch (Rechtecke und data-d in Bildschirmpunkten, darum durch 2) */
  for (const [breite, hoehe] of [[1280, 860], [2200, 1400]]) {
    const s = await oeffne({ app: true, breite, hoehe, config: { uiZoom: 200 } }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    const m = await p.evaluate(() => { const cv = document.querySelector("#ring"), q = JSON.parse(cv.dataset.mitte);
      return { zahl: Math.round(document.querySelector("#hDps").getBoundingClientRect().width), loch: Math.round(2 * q.r0),
        buehne: Math.round(document.querySelector("#ringBuehne").getBoundingClientRect().height), d: +cv.dataset.d,
        gestapelt: document.documentElement.matches(".w-max-899,.h-max-699") }; });
    assert(m.zahl < 0.7 * m.loch && (!m.gestapelt || m.buehne / 2 <= m.d / 2 + 60),
      `200 % bei ${breite}x${hoehe}: die Zahl im Ringloch, die Buehne nicht hoeher als der Ring`, m);
    assert(!s.fehler.length, `200 % bei ${breite}x${hoehe}: keine Fehler`, s.fehler);
    await p.close();
  }
  /* Fixrunde 1 zu Aufgabe 10 (Entscheidung des Leiters): nebeneinander liegt die Oberkante des Urteils auf der des
     Bands - eine Fuge quer ueber das Raster, Band und Urteil als gemeinsame Fusszeile; auch mit ausgeklapptem Band */
  for (const [breite, hoehe, auf] of [[1280, 860, false], [1920, 1080, false], [2000, 1480, false], [1100, 700, false], [1280, 860, true]]) {
    const s = await oeffne({ app: true, breite, hoehe }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    if (auf) { await p.click("#zeitAuf"); await p.waitForTimeout(200); }
    const m = await p.evaluate(() => ({ urteil: document.querySelector("#urteilFeld").getBoundingClientRect().top,
      band: document.querySelector("#kurveFeld").getBoundingClientRect().top, kurve: document.querySelector("#kurve").getBoundingClientRect().height }));
    assert(Math.abs(m.urteil - m.band) <= 1, `${breite}x${hoehe}${auf ? " Band offen" : ""}: das Urteil beginnt auf der Hoehe des Bands`, m);
    if (auf) { await p.click("#zeitAuf"); await p.waitForTimeout(200);
      const z = await p.evaluate(() => ({ urteil: document.querySelector("#urteilFeld").getBoundingClientRect().top,
        band: document.querySelector("#kurveFeld").getBoundingClientRect().top, kurve: document.querySelector("#kurve").getBoundingClientRect().height }));
      assert(Math.abs(z.urteil - z.band) <= 1 && Math.abs(z.kurve - 78) <= 1 && z.band > m.band, `${breite}x${hoehe} Band wieder zu: Fusszeile schrumpft mit`, { m, z }); }
    assert(!s.fehler.length, `${breite}x${hoehe} Fusszeile: keine Fehler`, s.fehler);
    await p.close();
  }
  const spalteMass = (p) => p.evaluate(() => {
    const farbe = (v) => { const e = document.createElement("i"); e.style.backgroundColor = v; document.body.append(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; };
    const grundBei = (x, y) => { let e = document.elementFromPoint(x, y), g = "";
      while (e && (g = getComputedStyle(e).backgroundColor) === "rgba(0, 0, 0, 0)") e = e.parentElement; return g; };
    const tab = document.querySelector(".table"), t = tab.getBoundingClientRect(), app = document.querySelector("#app").getBoundingClientRect();
    const nach = getComputedStyle(tab, "::after"), u = document.querySelector("#urteilFeld");
    return { comb: farbe("var(--comb)"), spalteUnten: Math.round(t.bottom), rasterUnten: Math.round(app.bottom),
      urteilUnten: u.getClientRects().length ? Math.round(u.getBoundingClientRect().bottom) : null,
      nach: nach.content === "none" || nach.content === "normal" || nach.display === "none" ? "" : nach.backgroundColor,
      grund: grundBei(t.left + t.width / 2, t.bottom - 3), ring: getComputedStyle(document.querySelector("#ringFeld")).backgroundColor,
      links: Math.round(app.left), rechts: Math.round(innerWidth - app.right),
      randL: grundBei(app.left / 2, app.top + 200), randR: grundBei((app.right + innerWidth) / 2, app.top + 200),
      zeilen: [...document.querySelectorAll("#bars .ringzeile")].map((z) => z.getBoundingClientRect().height) };
  });
  for (const thema of ["dark", "light", "tnl"]) {
    for (const gruppe of [false, true]) {
      if (gruppe && thema !== "dark") continue;
      const s = gruppe ? await gruppeAuf({ breite: 2000, hoehe: 1480, config: { theme: thema } })
        : await oeffne({ app: true, breite: 2000, hoehe: 1480, config: { theme: thema } });
      const p = s.page;
      if (!gruppe) { await p.emulateMedia({ reducedMotion: "reduce" }); await beispiel(p); }
      const wo = `2000x1480 ${thema}${gruppe ? " Gruppe" : ""}`;
      const m = await spalteMass(p);
      assert(Math.abs(m.spalteUnten - m.rasterUnten) <= 2 && (m.urteilUnten === null || Math.abs(m.urteilUnten - m.rasterUnten) <= 2) &&
        m.grund === m.comb && (!m.nach || m.nach === m.comb) && m.zeilen.every((h) => h <= 44.5),
        `${wo}: die rechte Spalte reicht bis zur Unterkante, ihr Grund laeuft durch, das Urteil steht unten, Zeilen hoechstens 44`, m);
      assert(m.links > 40 && m.randL === m.ring && m.randR === m.ring,
        `${wo}: neben dem 1680-Punkt-Raster passt der Grund zum Ringfeld`, m);
      assert(!s.fehler.length, `${wo}: Spalte ohne Fehler`, s.fehler);
      await p.close();
    }
  }
  for (const lang of ["en", "de"]) {
    const s = await oeffne({ app: true, lang }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    const z = await p.evaluate(() => {
      const row = document.querySelector("#bars .row.bdetail"), d = row && row.querySelector(".dz"), bars = document.querySelector("#bars");
      if (!d) return null;
      const r = row.getBoundingClientRect(), dr = d.getBoundingClientRect();
      return { text: d.textContent, breit: d.scrollWidth <= d.clientWidth + 1, hoch: d.scrollHeight <= d.clientHeight + 1,
        drin: dr.bottom <= r.bottom + 0.5 && dr.right <= r.right + 0.5, quer: bars.scrollWidth > bars.clientWidth + 1, zeile: Math.round(r.height) };
    });
    assert(!!z && z.breit && z.hoch && z.drin && !z.quer && z.zeile <= 44 && /(damage|Schaden) [\d.]+[kMB]?$/.test(z.text),
      `1280x860 ${lang}: die Summenzeile der Trefferarten bricht um statt abzuschneiden, der Schaden steht am Ende`, z);
    await p.close();
  }
  for (const [breite, hoehe, lang] of [[1280, 860, "en"], [1280, 860, "de"], [2000, 1480, "de"], [1100, 700, "de"]]) {
    const s = await oeffne({ app: true, breite, hoehe, lang }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    const n = await p.evaluate(() => {
      const cv = document.querySelector("#ring"), w = cv.getBoundingClientRect().width;
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = "600 13px " + getComputedStyle(document.documentElement).getPropertyValue("--sans");
      const m = JSON.parse(cv.dataset.mitte);
      return JSON.parse(cv.dataset.schilder || "[]").map((s) => {
        const z = [...document.querySelectorAll("#bars .ringzeile")].find((e) => e.dataset.ring === s.k);
        const voll = z ? z.querySelector(".nmt").getAttribute("title") : s.k, breit = Math.ceil(ctx.measureText(voll).width);
        const rechts = (s.l + s.r) / 2 > m.x;
        return { k: s.k, breit, kasten: s.r - s.l, platz: rechts ? Math.floor(w - s.l) : Math.floor(s.r) };
      });
    });
    const zuFrueh = n.filter((x) => x.platz - 4 >= x.breit && x.kasten < x.breit - 1);
    assert(n.length > 0 && !zuFrueh.length, `${breite}x${hoehe} ${lang}: die Namen am Ring kuerzen sich nur, wenn sie auf ihrer Seite nicht passen`, { zuFrueh, n });
    await p.close();
  }
  /* Esc gehoert der obersten Ebene (Nachpruefung Aufgabe 9): bei offenem Menue "Mehr" oder "Logs oeffnen" oder dem
     Changelog schliesst Esc nur dieses, das Rennen bleibt offen (wie Kompakt in 37) */
  {
    const s = await oeffne({ app: true }); const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await beispiel(p);
    const ergebnis = {};
    for (const [was, auf, offen] of [
      ["mehr", () => p.evaluate(() => document.querySelector("#btnMore").click()), () => !document.querySelector("#morePanel").hidden],
      ["logs", () => p.evaluate(() => document.querySelector("#btnOpen").click()), () => !document.querySelector("#openPanel").hidden],
      ["changelog", () => p.evaluate(() => document.querySelector("#eClog").click()), () => document.querySelector("#clogBg").classList.contains("on")]]) {
      if (await p.evaluate(() => document.querySelector("#rennen").hidden)) { await p.click("#ringNachspielen"); await p.waitForTimeout(100); }
      await auf(); await p.waitForTimeout(100);
      // der Fokus liegt im Bereich Kampf (wie nach einem Druck auf Tab zurueck in die Liste)
      await p.evaluate(() => document.querySelector("#bars .ringzeile").focus());
      const vorher = await p.evaluate(offen);
      await p.keyboard.press("Escape"); await p.waitForTimeout(100);
      ergebnis[was] = { vorher, oben: await p.evaluate(offen), rennen: await p.evaluate(() => !document.querySelector("#rennen").hidden) };
    }
    assert(Object.values(ergebnis).every((e) => e.vorher && !e.oben && e.rennen),
      "Esc schliesst nur Menue oder Changelog, das Rennen darunter bleibt offen", ergebnis);
    assert(!s.fehler.length, "Esc ueber dem Rennen: keine Fehler", s.fehler);
    await p.close();
  }
  /* --- 15. Bereichswechsel mit Kampfwechsel (Gesamtpruefung C1 und I1): wird in einem anderen Bereich ein anderer Kampf
     gewaehlt oder die Gruppierung gewechselt, zeigen Ring und Liste beim Zurueck in den Kampf den neuen Stand - nicht das
     gemerkte Bild und nicht die Tabelle, die 21 dort gezeichnet hat. Zwei Kaempfe mit verschiedenen staerksten Faehigkeiten. */
  {
    const zweiKaempfe = () => {
      const tr = [];
      for (const [start, stark] of [[at(20, 0, 0), DM], [at(20, 30, 0), ST]])
        for (let t = 0; t < 60000; t += 1000) {
          tr.push([start + t, stark[0], stark[1], 5000, t % 3000 === 0, "Vulcanus"]);
          tr.push([start + t + 300, QF[0], QF[1], 1500, t % 4000 === 0, "Vulcanus"]);
          tr.push([start + t + 600, (stark === DM ? ST : DM)[0], (stark === DM ? ST : DM)[1], 800, false, "Vulcanus"]);
        }
      return trefferLog(tr);
    };
    const s = await oeffne({ app: true, helfer: { dir: "C:\Logs", file: "TLCombatLog-1.txt", text: zweiKaempfe() } });
    const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await ladeUndWaehle(p, 0, 2);
    const stand = () => p.evaluate(() => ({ ring: document.querySelector("#bars").classList.contains("ring"),
      zeilen: [...document.querySelectorAll("#bars .ringzeile")].map((z) => z.dataset.ring).join("|"),
      bild: document.querySelector("#ring").getAttribute("aria-label"),
      satz: document.querySelector("#hRead").textContent, zahl: document.querySelector("#hDps").textContent }));
    const waehle = async (i) => { await p.evaluate((n) => document.querySelector(`#fightList .fight[data-i="${n}"]`).click(), i); await p.waitForTimeout(200); };
    const bereich = async (b) => { await p.click(`#bereiche [data-tab="${b}"]`); await p.waitForTimeout(200); };
    const gruppe = async (g) => { await p.evaluate((x) => document.querySelector(`#groupSeg [data-g="${x}"]`).click(), g); await p.waitForTimeout(200); };
    // die Bezuege: jeder Kampf und die Ziele, im Bereich Kampf selbst gewaehlt
    await waehle(1); const e1 = await stand();
    await gruppe("target"); const e1z = await stand(); await gruppe("skill");
    await waehle(0); const e0 = await stand();
    assert(e0.bild !== e1.bild && e0.zeilen.split("|")[0] !== e1.zeilen.split("|")[0] && e0.ring && e1.ring && e1z.ring,
      "Bereichswechsel: die beiden Kaempfe und die Ziele unterscheiden sich im Ring", { e0, e1, e1z });
    // C1: in der Analyse den anderen Kampf waehlen, zurueck in den Kampf
    await bereich("analysis"); await waehle(1); await bereich("timeline");
    const c1 = await stand();
    assert(JSON.stringify(c1) === JSON.stringify(e1), "Kampfwechsel in der Analyse: Ring, Liste, Satz und Zahl zeigen zurueck im Kampf den neuen Kampf", { c1, e1 });
    // C1: in der Rotation die Gruppierung auf Ziele, zurueck in den Kampf
    await bereich("rotation"); await gruppe("target"); await bereich("timeline");
    const c1z = await stand();
    assert(JSON.stringify(c1z) === JSON.stringify(e1z), "Umschalter in der Rotation: zurueck im Kampf stehen Ring und Liste nach Zielen", { c1z, e1z });
    await gruppe("skill");
    /* I1: der Kampfwechsel im Ring setzt auch das Aufgeklappte der Tabelle von 21 (Kompakt, andere Bereiche) zurueck:
       zeichnet 21 danach ohne neuen Kampf, steht die staerkste Faehigkeit dieses Kampfes offen, nicht die des vorigen. */
    await bereich("analysis"); await waehle(0); await bereich("timeline");
    await waehle(1);
    await bereich("analysis"); await waehle(1);
    const i1 = await p.evaluate(() => [...document.querySelectorAll('#bars .row[aria-expanded="true"]')].map((z) => z.dataset.skill || z.dataset.open || ""));
    const staerkste1 = e1.zeilen.split("|")[0];
    assert(JSON.stringify(i1) === JSON.stringify([staerkste1]), "Kampfwechsel im Ring: in der Tabelle von 21 steht nur die staerkste des neuen Kampfes offen", { i1, staerkste1 });
    await bereich("timeline");
    assert(!s.fehler.length, "Bereichswechsel mit Kampfwechsel: keine Fehler", s.fehler);
    await p.close();
  }
  /* --- 16. Nacharbeit der Gesamtpruefung Glutring (M1, M2, M5, M6, M8, M9) */
  // M9 und M1 in der Gruppe: die Kopfzelle "Klasse" ist kein Knopf; Esc bei offener Kampfwahl schliesst nur die Kampfwahl
  {
    const faeh = (name, sid, f) => ({ name, sid, damage: 220000 * f, dps: 3667 * f, hits: 28, crit: 14, heavy: 10, max: 16000, cats: [] });
    const zeile = (name, f) => ({ name, waiting: false, damage: 440000 * f, dps: 7333 * f, hits: 56, crit: 0.5, heavy: 0.36, seconds: 60, max: 16000,
      skills: [faeh("Quick Fire", "964762401", f), faeh("Strafing", "945674044", f)], hasCurve: false, share: 0, onTarget: true,
      target: "Vulcanus", lang: "en", weapons: ["Crossbow", "Longbow"], ventius: false, age: 0 });
    const board = [zeile("Tester", 1), zeile("Mitglied Eins", 1.5), zeile("Mitglied Zwei", 0.5)];
    const s = await oeffne({ app: true, gruppe: { role: "host", code: "QX7K", name: "Tester", board, target: "Vulcanus", error: "" },
      helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS.slice(0, 1)) } });
    const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await ladeUndWaehle(p, 0, 1);
    await p.waitForFunction(() => !!document.querySelector("#segParty")?.getClientRects().length, null, { timeout: 8000 }).catch(() => {});
    await p.click("#segParty"); await p.waitForTimeout(200);
    const tinte = await p.evaluate(() => getComputedStyle(document.querySelector('#bars .bhead [data-k="klasse"]')).color);
    await p.hover('#bars .bhead [data-k="klasse"]'); await p.waitForTimeout(150);
    const kl = await p.evaluate(() => { const k = document.querySelector('#bars .bhead [data-k="klasse"]'), d = document.querySelector('#bars .bhead [data-k="dps"]');
      return { zeiger: getComputedStyle(k).cursor, grund: getComputedStyle(k).backgroundColor, tinte: getComputedStyle(k).color, dpsZeiger: getComputedStyle(d).cursor }; });
    assert(kl.zeiger !== "pointer" && /^(transparent|rgba\(0, 0, 0, 0\))$/.test(kl.grund) && kl.tinte === tinte && kl.dpsZeiger === "pointer",
      "Gruppe: die Kopfzelle Klasse hat weder Handzeiger noch Hover, die sortierbaren behalten den Zeiger (M9)", kl);
    await p.focus('#bars .ringzeile[data-member="Mitglied Eins"]'); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector("#kwKnopf").click()); await p.waitForTimeout(150);
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    const vor = await p.evaluate(() => ({ kw: !document.querySelector("#kampfwahl").hidden, mitglied: document.body.classList.contains("ringmitglied") }));
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    const nach = await p.evaluate(() => ({ kw: !document.querySelector("#kampfwahl").hidden, mitglied: document.body.classList.contains("ringmitglied") }));
    assert(vor.kw && vor.mitglied && !nach.kw && nach.mitglied, "Esc bei offener Kampfwahl ueber dem Ring eines Mitglieds schliesst nur die Kampfwahl (M1)", { vor, nach });
    assert(!s.fehler.length, "Gruppe Nacharbeit: keine Fehler", s.fehler);
    await p.close();
  }
  // M2: ein geladener Gruppen-Schnappschuss faerbt die Fakten auch im Ringfeld in --info, wie im Kopf von Kompakt
  {
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS.slice(0, 1)) } });
    const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await ladeUndWaehle(p, 0, 1);
    const reihe = (name, dps) => ({ name, dps, damage: dps * 60, seconds: 60, waiting: false, target: "Vulcanus", hits: 50 });
    const gl = { boroPartyLog: 2, when: new Date(at(20, 20, 0)).toISOString(), code: "RAID", target: "Vulcanus", history: [],
      fights: [{ target: "Vulcanus", when: new Date(at(20, 20, 0)).toISOString(), seconds: 60, board: [reihe("Mitglied A", 40000)] }],
      board: [reihe("Mitglied A", 40000), reihe("Mitglied B", 30000)] };
    await p.setInputFiles("#partyLogInput", { name: "gruppe.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(gl)) });
    await p.waitForTimeout(300);
    const farbe = () => p.evaluate(() => {
      const probe = document.createElement("i"); probe.style.color = "var(--info)"; document.body.append(probe);
      const info = getComputedStyle(probe).color; probe.remove();
      const m = document.querySelector("#hMeta");
      return { info, meta: getComputedStyle(m).color, imRing: !!m.closest("#ringFeld"), badge: !document.querySelector("#snapBadge").hidden,
        glut: document.body.classList.contains("glut") };
    });
    const f = await farbe();
    assert(f.glut && f.imRing && f.badge && f.meta === f.info, "Gruppen-Schnappschuss im Ring: die Fakten in --info wie im Kopf (M2)", f);
    assert(!s.fehler.length, "Schnappschuss im Ring: keine Fehler", s.fehler);
    await p.close();
  }
  // M8: waechst eine Ecke des Ringfelds ohne neues Bild (Verlauf kommt an, ein Knopf erscheint), weichen die Schilder ihr aus
  {
    const s = await oeffne({ app: true, helfer: { dir: "C:\\Logs", file: "TLCombatLog-1.txt", text: logText(PULLS) } });
    const p = s.page;
    await p.emulateMedia({ reducedMotion: "reduce" });
    await ladeUndWaehle(p, 1, 4);
    const pruefe = () => p.evaluate(() => {
      const cv = document.querySelector("#ring"), r = cv.getBoundingClientRect();
      const schilder = JSON.parse(cv.dataset.schilder || "[]").map((b) => ({ l: b.l + r.left, t: b.t + r.top, r: b.r + r.left, b: b.b + r.top }));
      const ecken = ["#ringLinks", "#ringMeta", "#ringRechts"].map((q) => document.querySelector(q).getBoundingClientRect())
        .filter((b) => b.width > 0 && b.height > 0).map((b) => ({ l: b.left, t: b.top, r: b.right, b: b.bottom }));
      const schneidet = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      return { n: schilder.length, anEcke: schilder.filter((a) => ecken.some((e) => schneidet(a, e))).map((a) => [Math.round(a.l), Math.round(a.t)]) };
    });
    const vorher = await pruefe();
    await p.evaluate(() => { const x = document.createElement("div"); x.id = "probeEcke"; x.style.cssText = "height:240px;width:100%";
      document.querySelector("#ringSatz").append(x); });
    await p.waitForTimeout(300);
    const nachher = await pruefe();
    assert(vorher.n > 0 && !vorher.anEcke.length && !nachher.anEcke.length,
      "eine Ecke waechst ohne neues Bild: keine Beschriftung stoesst an sie (M8)", { vorher, nachher });
    await p.evaluate(() => document.querySelector("#probeEcke").remove());
    assert(!s.fehler.length, "Ecken wachsen: keine Fehler", s.fehler);
    await p.close();
  }
  // M5 und M6: die Leiste spult mit der Tastatur in Sekunden, ihr Wert fuer den Vorleser aendert sich nur mit der vollen
  // Sekunde, und der Vorleser liest die Bahnen in der Reihenfolge der Plaetze
  {
    const s = await oeffne({ app: true }); const p = s.page; await beispiel(p);
    await p.click("#ringNachspielen"); await p.waitForTimeout(200);
    await p.focus("#rennPos"); await p.keyboard.press(" "); await p.waitForTimeout(100);
    await p.evaluate(() => { const r = document.querySelector("#rennPos"); r.value = "0"; r.dispatchEvent(new Event("input", { bubbles: true })); });
    const tNach = async (taste) => { await p.keyboard.press(taste); await p.waitForTimeout(60); return p.evaluate(() => +document.querySelector("#rennen").dataset.t); };
    const schritte = [await tNach("ArrowRight"), await tNach("ArrowRight"), await tNach("PageUp"), await tNach("ArrowLeft"), await tNach("PageDown")];
    const zeit = await p.evaluate(() => [document.querySelector("#rennPos").getAttribute("aria-valuetext"), document.querySelector("#rennVon").textContent]);
    assert(JSON.stringify(schritte) === JSON.stringify([1, 2, 12, 11, 1]) && zeit[0] === "0:01 " + zeit[1],
      "die Leiste spult mit Pfeilen um 1 s, mit Bild auf/ab um 10 s, und nennt die Zeit (M5)", { schritte, zeit });
    const lauf = await p.evaluate(async () => {
      const r = document.querySelector("#rennPos"); let n = 0;
      const mo = new MutationObserver((l) => { n += l.length; }); mo.observe(r, { attributes: true, attributeFilter: ["aria-valuetext"] });
      const von = +document.querySelector("#rennen").dataset.t;
      document.querySelector("#rennPlay").click();
      await new Promise((res) => setTimeout(res, 1500));
      document.querySelector("#rennPlay").click();
      await new Promise((res) => setTimeout(res, 50));
      mo.disconnect();
      return { n, sekunden: Math.floor(+document.querySelector("#rennen").dataset.t) - Math.floor(von) };
    });
    assert(lauf.sekunden >= 3 && lauf.n <= lauf.sekunden + 1, "beim Abspielen aendert sich der Wert fuer den Vorleser nur mit der vollen Sekunde (M5)", lauf);
    // M6: eine Stelle suchen, an der die Plaetze anders stehen als die Bahnen beim Oeffnen, und dort den Baum des Vorlesers lesen
    const max = await p.evaluate(() => +document.querySelector("#rennPos").max);
    let stelle = -1;
    for (let x = 1; x <= max && stelle < 0; x += 1) {
      const anders = await p.evaluate((v) => { const r = document.querySelector("#rennPos"); r.value = String(v); r.dispatchEvent(new Event("input", { bubbles: true }));
        const pl = [...document.querySelectorAll("#rennBahnen .rbahn")].map((e) => +e.dataset.platz); return pl.some((q, i) => i && q < pl[i - 1]); }, x);
      if (anders) stelle = x;
    }
    const cdp = await p.context().newCDPSession(p);
    await cdp.send("DOM.getDocument", { depth: -1 });
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    const liste = nodes.find((n) => n.role?.value === "list" && /Skills by damage so far/.test(n.name?.value || ""));
    const reihe = [];
    for (const id of liste?.childIds || []) {
      const k = nodes.find((n) => n.nodeId === id);
      if (!k || k.role?.value !== "listitem") continue;
      const { node } = await cdp.send("DOM.describeNode", { backendNodeId: k.backendDOMNodeId });
      const a = node.attributes || [];
      reihe.push(+a[a.indexOf("data-platz") + 1]);
    }
    await cdp.detach();
    assert(stelle > 0 && reihe.length >= 2 && reihe.every((q, i) => q === i + 1),
      "der Vorleser liest die Bahnen in der Reihenfolge der Plaetze, auch wenn sie anders geoeffnet wurden (M6)", { stelle, reihe });
    assert(!s.fehler.length, "Leiste und Bahnen: keine Fehler", s.fehler);
    await p.close();
  }
} finally {
  await browser.close();
}

console.log();
if (failed) { console.log(`TAFEL PAGE FAILED - ${failed}`); process.exit(1); }
console.log("TAFEL PAGE PASSED");
