// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Gezielter Test der Analyse zu Fenster, Nebenzielen und Start (Spezifikation
// 2026-09-27, Abschnitt 9.2, Issue #45) an der gebauten Seite,
// dist/renderer/index.html ueber file:// - ohne Server, der beste Pull lebt
// also nur in dieser Sitzung. Die Logs erzeugt der Test selbst: Bossnamen aus
// der Tabelle der Seite, Skills aus dem Woerterbuch, Angreifer "Tester".
//
// Run:  npm run test:analyse-page     (baut die Seite zuerst)

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { gebauterModus } from "./bilder-weiche.mjs";
import { layoutProbe } from "./analyse-layout-probe.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/* Ohne Spielbilder (BORO_BILDER=aus) tragen die Zeilen statt img.sic die volle
   Platte span.sic.leer in ihrer Farbe (--sic-c); die Proben der Symbole pruefen
   dann sie an derselben Stelle. */
const BILDER = gebauterModus(root) === "voll";
const dist = process.env.ANALYSE_DIST || join(root, "dist", "renderer", "index.html");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail))); }
}

const two = (n, w = 2) => String(n).padStart(w, "0");
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-` +
         `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`;
};
const at = (day, h, m) => Date.UTC(2026, 8, day, h, m, 0);
/* Eine Zeile je Treffer: [ms, Skill, ID, Schaden, Krit, Ziel, Angreifer = "Tester", Stark = false].
   #218: `stark` setzt die Spalte "heavy" (und bei Krit die Trefferart wie im Spiel); ohne `stark`
   bleiben die Zeilen genau wie vorher. */
function logText(treffer) {
  const rows = [...treffer].sort((a, b) => a[0] - b[0]).map(([t, skill, sid, dmg, krit, ziel, wer = "Tester", stark = false]) =>
    `${stamp(t)},DamageDone,${skill},${sid},${Math.round(dmg)},${krit ? 1 : 0},${stark ? 1 : 0},` +
    `${stark ? (krit ? "kMaxDamageByCriticalDecision" : "kNormalHit") : krit ? "kCritical" : "kNormalHit"},${wer},${ziel}`);
  return ["CombatLogVersion,4", ...rows].join("\n") + "\n";
}
const work = mkdtempSync(join(tmpdir(), "boro-analyse-"));
const logFile = (name, treffer) => { const p = join(work, name); writeFileSync(p, logText(treffer)); return p; };

const QF = ["Quick Fire", 964762401], DM = ["Detonation Mark", 953174691], ST = ["Strafing", 945674044];

/* Werkbank (#218, Spezifikation 2026-10-07, Abschnitt 3.1): welche Faehigkeit
   welches Fach bekommt, aus den Treffern des gezeigten Kampfes gerechnet -
   Schaden je Faehigkeit absteigend, die erste Hauptfach, die naechsten drei
   mit mindestens 0,8 % mittlere Faecher, der Rest "Weitere Faehigkeiten".
   Nur fuer Einsatz-Faehigkeiten (Laufzeit und Passiv rechnet der Test selbst
   heraus). Die Namen wie auf der Seite (Deutsch); die Ventius-Familie heisst
   als Salve "Auge von Ventius". */
const DE_NAME = { "Quick Fire": "Schnellfeuer", "Detonation Mark": "Detonierendes Mal", "Strafing": "Beschuss",
  "Blade Storm": "Klingensturm", "Agile Shot": "Agiler Schuss", "Decisive Sniping": "Entschlossener Scharfschuss" };
function faecherVon(treffer, { ventius = false } = {}) {
  const summe = new Map();
  for (const [, skill, , dmg] of treffer) {
    const n = ventius && skill === "Decisive Sniping" ? "Auge von Ventius" : DE_NAME[skill] || skill;
    summe.set(n, (summe.get(n) || 0) + Math.round(dmg));
  }
  const ges = [...summe.values()].reduce((a, b) => a + b, 0);
  const folge = [...summe.entries()].sort((a, b) => b[1] - a[1]);
  const mittel = folge.slice(1).filter(([, d]) => d / ges >= 0.008).slice(0, 3).map(([n]) => n);
  return { haupt: folge[0]?.[0] || "", mittel, weitere: folge.slice(1).map(([n]) => n).filter((n) => !mittel.includes(n)) };
}
/* der zuletzt geschriebene Pull einer Serie (Pulls zehn Minuten auseinander, je unter 5 min) */
const letzterPull = (treffer) => { const m = Math.max(...treffer.map((r) => r[0])); return treffer.filter((r) => r[0] > m - 300000); };

/* Ein Kampf fuer die Nebenziele: 60 s auf das Hauptziel, alle 500 ms ein
   Treffer (1000-5000 Schaden, im Schnitt 3000), dazu `neben` als Liste
   [Ziel, Anteil am ganzen Kampf, ab ms, bis ms]. */
function nebenKampf(start, haupt, neben = []) {
  const tr = [];
  let summe = 0;
  for (let k = 0; k < 120; k++) {
    const [s, id] = [QF, DM, ST][k % 3];
    const d = 10000 * (1 + (k % 5));
    summe += d;
    tr.push([start + k * 500, s, id, d, false, typeof haupt === "function" ? haupt(k) : haupt]);
  }
  const anteile = neben.reduce((a, n) => a + n[1], 0);
  const gesamt = summe / (1 - anteile);
  for (const [ziel, q, von, bis] of neben) {
    const n = Math.floor((bis - von) / 500);
    for (let i = 0; i < n; i++) tr.push([start + von + i * 500 + 250, ST[0], ST[1], gesamt * q / n, false, ziel]);
  }
  return { tr, haupt: summe, gesamt };
}

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* storage blocked */ }
  });
  await page.goto("file://" + dist);

  const load = async (file, name) => {
    await page.setInputFiles("#fileInput", file);
    await page.waitForFunction((n) => (document.querySelector("#hName")?.textContent || "").includes(n), name);
    await page.waitForTimeout(150);
  };
  const tab = async (name) => { await page.evaluate((n) => document.querySelector(`[data-tab="${n}"]`).click(), name); await page.waitForTimeout(120); };
  /* #hSide steht im Streifen des Kampfs; seit Stufe 4 (#54) zeigen die
     anderen Bereiche statt des Streifens eine Kopfzeile (58-felder.ts).
     Gemessen wird darum im Bereich Kampf, danach zurueck in den Bereich von vorher. */
  const kopf = async () => {
    const vorher = await page.evaluate(() => document.querySelector(".panel.on")?.id.replace(/^p-/, "") || "");
    if (vorher && vorher !== "timeline") await tab("timeline");
    const r = await page.evaluate(() => {
      const e = document.querySelector("#hSide");
      return { text: e?.textContent || "", hidden: !e || e.hidden, sichtbar: !!e && !e.hidden && !!e.offsetParent, title: e?.title || "" };
    });
    if (vorher && vorher !== "timeline") await tab(vorher);
    return r;
  };
  const unterZielen = () => page.evaluate(() => document.querySelector("#findings .tsplit .sidefind")?.textContent || "");
  const sprache = async (lang) => {
    if (await page.evaluate(() => document.documentElement.lang) !== lang) {
      await page.evaluate(() => document.querySelector("#btnLang").click());
      await page.waitForTimeout(150);
    }
  };

  /* Kontrast der Schrift gegen ihren tatsaechlichen Grund: die Hintergruende
     der Vorfahren uebereinander gelegt (halbdurchsichtige Mulden), nur
     sichtbare Elemente. */
  const kontraste = (sels, p = page) => p.evaluate((sels) => {
    const rgb = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const grund = (el) => {
      const kette = [];
      for (let e = el; e; e = e.parentElement) kette.push(rgb(getComputedStyle(e).backgroundColor));
      let c = { r: 255, g: 255, b: 255 };
      for (const b of kette.reverse()) c = { r: b.r * b.a + c.r * (1 - b.a), g: b.g * b.a + c.g * (1 - b.a), b: b.b * b.a + c.b * (1 - b.a) };
      return c;
    };
    const kontrast = (sel) => {
      const el = document.querySelector(sel); if (!el || !el.offsetParent) return null;
      const a = lum(rgb(getComputedStyle(el).color)), b = lum(grund(el));
      return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2);
    };
    return sels.map((s) => [s, kontrast(s)]).filter((x) => x[1] != null);
  }, sels);
  /* #218 (Spezifikation 2026-10-07, 8.3): alle vier Themen, Glas eingeschlossen - strenger als vorher (drei) */
  const THEMEN = ["dark", "light", "tnl", "glas"];
  const themen = async (sels, name, p = page) => {
    for (const theme of THEMEN) {
      await p.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`)?.click(), theme);
      await p.waitForTimeout(150);
      const k = await kontraste(sels, p);
      assert(k.length === sels.length && k.every(([, v]) => v >= 4.5), `${name}, Thema ${theme}: Kontrast >= 4,5:1`, k);
    }
    await p.evaluate(() => document.querySelector('#themeRow [data-theme="dark"]')?.click());
  };

  // --- 1 \u00b7 Nebenziele (Spezifikation 3.1, 3.2, 4.4)
  {
    const k = nebenKampf(at(20, 20, 0), "Fellinex", [["Fellini", 0.07, 19000, 29000]]);
    await load(logFile("fellinex-7.txt", k.tr), "Fellinex");
    let h = await kopf();
    assert(h.sichtbar && h.text === "davon 7\u00a0% auf Fellini, ab 0:19", "Kopf: davon 7 % auf Fellini, ab 0:19", h);
    assert(h.title === h.text, "Kopf: der ganze Satz im title", h);
    await tab("analysis");
    const erwartet = (k.haupt / 59.5 / 1000).toFixed(1) + "k";
    assert(await unterZielen() === "Davon 7\u00a0% auf Fellini, ab 0:19. Die Zahl oben z\u00e4hlt diesen Schaden mit; ohne ihn st\u00fcnden dort " + erwartet + ".",
      "Analyse: derselbe Satz unter der Zielaufteilung, und was oben ohne ihn stuende", await unterZielen());
    const dunkel = await page.evaluate(() => {
      const e = document.querySelector("#findings .sidefind .sn");
      return e ? getComputedStyle(e).color !== getComputedStyle(e.parentElement).color : false;
    });
    assert(dunkel, "Analyse: der zweite Satz leiser als der erste");
    await themen(["#findings .sidefind", "#findings .sidefind .sn"], "Nebenziel-Zeile und Satz");
    // die Zeile im Kopf steht seit Stufe 4 nur im Streifen des Kampfs
    await tab("timeline");
    await themen(["#hSide"], "Nebenziel-Zeile im Kopf");
    await tab("analysis");
    await sprache("en");
    h = await kopf();
    assert(h.text === "7% of it on Fellini, from 0:19", "Kopf EN", h);
    assert((await unterZielen()).startsWith("7% of it on Fellini, from 0:19. The number above counts this damage; without it, it would read "),
      "Analyse EN", await unterZielen());
    await sprache("de");
    // Kompaktmodus: die Zeile ist aus
    await page.evaluate(() => document.querySelector("#btnCompact").click());
    await page.waitForTimeout(250);
    h = await kopf();
    assert(!h.sichtbar, "Kompaktmodus: keine Nebenziel-Zeile", h);
    await page.evaluate(() => document.querySelector("#btnCompact").click());
    await page.waitForTimeout(250);
    // Gruppentafel: geleert
    // ein gespeichertes Gruppen-Log (Fassung 2) macht die Gruppentafel waehlbar
    const reihe = (name, dps) => ({ name, dps, damage: dps * 60, seconds: 60, waiting: false, target: "Fellinex" });
    const gl = { boroPartyLog: 2, when: new Date(at(20, 20, 0)).toISOString(), code: "RAID", target: "Fellinex", history: [],
      fights: [{ target: "Fellinex", when: new Date(at(20, 20, 0)).toISOString(), seconds: 60, board: [reihe("Mitglied A", 40000)] }],
      board: [reihe("Mitglied A", 40000), reihe("Mitglied B", 30000)] };
    const glPfad = join(work, "gruppe.json");
    writeFileSync(glPfad, JSON.stringify(gl));
    await page.setInputFiles("#partyLogInput", glPfad);
    await page.waitForTimeout(250);
    await page.evaluate(() => document.querySelector("#segParty").click());
    await page.waitForTimeout(250);
    h = await kopf();
    assert(h.hidden && h.text === "", "Gruppentafel: Zeile geleert", h);
    await page.evaluate(() => document.querySelector('#groupSeg [data-g="skill"]').click());
    await page.waitForTimeout(150);
    assert((await kopf()).sichtbar, "zurueck zur Faehigkeit: die Zeile ist wieder da");
  }
  {
    const k = nebenKampf(at(20, 21, 0), "Fellinex", [["Fellini", 0.04, 19000, 29000]]);
    await load(logFile("fellinex-4.txt", k.tr), "Fellinex");
    assert((await kopf()).hidden, "4 % auf Fellini: keine Zeile im Kopf");
    await tab("analysis");
    assert(await unterZielen() === "", "4 % auf Fellini: kein Satz unter der Zielaufteilung");
  }
  {
    // Calanthia der Zerstoerung ist eine Form, kein Nebenziel
    const k = nebenKampf(at(20, 22, 0), (i) => (i >= 60 ? "Calanthia der Zerst\u00f6rung" : "Calanthia"));
    await load(logFile("calanthia.txt", k.tr), "Calanthia");
    assert((await kopf()).hidden, "Calanthia mit ihrer Form: keine Nebenziel-Zeile", await kopf());
  }
  {
    const k = nebenKampf(at(20, 23, 0), "Fellinex", [["Fellini", 0.07, 19000, 29000], ["Grabw\u00e4chter", 0.05, 30000, 40000]]);
    await load(logFile("fellinex-zwei.txt", k.tr), "Fellinex");
    const h = await kopf();
    assert(h.text === "davon 12\u00a0% auf 2 Nebenziele, am meisten Fellini (7\u00a0%), ab 0:19", "zwei Nebenziele: Summe, Anzahl, das groesste", h);
  }


  // --- 2 \u00b7 Hast du im Fenster getroffen? (Spezifikation 3.3, 3.4, 4)
  const frisch = async () => { await page.reload(); await page.waitForTimeout(200); };
  const fenster = () => page.evaluate(() => {
    /* Neugestaltung 28.09., Aufgabe 5 (folgt Entwurf, Luecken 4): die Fragen sind die
       Ueberschriften der Felder unter der Form (h3), in der Reihenfolge der Seite */
    /* #414 (Inventur D19): die Werkbank ist abgeloest, die Frage nach dem Fenster steht als h3 fuer sich in #findings
       unter dem Pruefstand, in keiner Karte. Gelesen werden h3 und h4 in der Reihenfolge der Seite. */
    const secs = [...document.querySelectorAll("#findings .fsec")];
    const w = secs.find((s) => s.querySelector(".fwin"));
    const q = (sel) => w?.querySelector(sel);
    const nurName = (h) => { const c = h.cloneNode(true); c.querySelectorAll("small").forEach((s) => s.remove()); return c.textContent.trim(); };
    return {
      fragen: [...document.querySelectorAll("#findings :is(h3,h4)")].map(nurName),
      // das Fenster steht unter dem Pruefstand, nicht in einer Karte; die Frage ist h3#fensterH
      unterKarten: !!w && !w.closest(".a2karte, #a2") && w.querySelector("h3")?.id === "fensterH",
      da: !!w,
      gef: q(".fgef")?.textContent || "",
      v: q(".fant .v")?.textContent || "",
      zaehlt: !!q(".fant.zaehlt"),
      spurVerborgen: q(".fant .mspur")?.getAttribute("aria-hidden") === "true",
      wort: q(".fant .mwort")?.textContent || "",
      liste: q("ul.fwerte")?.getAttribute("aria-label") || "",
      kacheln: [...(w?.querySelectorAll("ul.fwerte > li") || [])].map((li) =>
        [...li.children].map((c) => c.className + ":" + c.textContent)),
      krit: [...(w?.querySelectorAll(".fkrit") || [])].map((p) => p.textContent),
      urteil: document.querySelector("#analysisCall .uv")?.textContent || "",
      // der Satz ohne den Knopf "Zum Beleg" an seinem Ende (#107)
      note: (() => { const e = document.querySelector("#analysisCall .un")?.cloneNode(true); e?.querySelectorAll("button").forEach((k) => k.remove()); return (e?.textContent || "").trim(); })(),
      glut: (() => {
        const u = document.querySelector("#analysisCall .uv"), a = q(".fant .v"), z = q(".fwerte .z");
        return u && a && z ? { urteil: getComputedStyle(u).color, antwort: getComputedStyle(a).color, kachel: getComputedStyle(z).color } : null;
      })(),
    };
  });
  /* Pulls an einem Boss, alle 96 s lang, zehn Minuten auseinander: F
     (Detonierendes Mal) alle 12 s, H (Schnellfeuer) jede Sekunde bei +300 ms,
     in den 6 s nach F mit `inDmg`, sonst `outDmg` (Krits 3 von 4 innen, 1 von 3
     aussen), dazu Beschuss als Fueller jede Sekunde. `setz` legt fest, wie
     viele der 48 Plaetze innen und aussen H bekommt (gleichmaessig verteilt);
     `leise` laesst Mal und Schnellfeuer bis dahin weg (ein schwacher Start);
     `dauer`, `fBis` (kein Mal mehr ab dann), `wer`, `h` (Hauptschaden statt
     Schnellfeuer) und `streu` fuer die Faelle 4 bis 6. */
  function fensterPull(start, ziel, o = {}) {
    const { inDmg = 100000, outDmg = 70000, setz, filler = 20000, leise = 0, dauer = 96000, fBis = Infinity,
      wer = "Tester", h = QF, streu = true } = o;
    const tr = [];
    for (let t = 0; t < dauer && t < fBis; t += 12000) if (t >= leise) tr.push([start + t, DM[0], DM[1], 50000, false, ziel, wer]);
    let i = 0, a = 0;
    const nimm = (k, n) => !setz || Math.floor((k + 1) * n / 48) !== Math.floor(k * n / 48);
    for (let t = 300; t < dauer; t += 1000) {
      const drin = t % 12000 < 6000 && t < fBis + 6000;
      const k = drin ? i++ : a++;
      if (!nimm(k, drin ? setz?.[0] : setz?.[1]) || t < leise) continue;
      const d = setz ? (drin ? setz[2] : setz[3]) : (drin ? inDmg : outDmg);
      tr.push([start + t, h[0], h[1], d * (setz || !streu ? 1 : 0.9 + 0.2 * ((t / 1000) % 5) / 4), drin ? k % 4 !== 0 : k % 3 === 0, ziel, wer]);
    }
    for (let t = 700; t < dauer; t += 1000) tr.push([start + t, ST[0], ST[1], filler, false, ziel, wer]);
    return tr;
  }
  const serie = (day, ziel, n, o, letzter) => {
    const tr = [];
    for (let p = 0; p < n; p++) tr.push(...fensterPull(at(day, 20, p * 10), ziel, o));
    if (letzter) tr.push(...fensterPull(at(day, 20, n * 10), ziel, letzter));
    return tr;
  };
  {
    await frisch();
    // fuenf gewoehnliche Pulls, der letzte mit 30 % aussen (34 innen zu 81,2k, 26 aussen zu 45,5k)
    const tr30 = serie(21, "Fellinex", 5, {}, { setz: [34, 26, 81200, 45500] });
    await load(logFile("fenster-30.txt", tr30), "Fellinex");
    await tab("analysis");
    const f = await fenster();
    /* #414 (Inventur D19, O13): die Werkbank ist abgeloest; die Frage steht als h3 fuer sich in #findings, unter dem
       Pruefstand, in keinem Fach und in keiner Gruppe. */
    assert(f.unterKarten && f.fragen[0] === "Hast du im Fenster getroffen?" && !f.fragen.some((h) => /Laufzeit|Weitere F\u00e4higkeiten|Passiv|Mehr zu/.test(h)),
      "die Frage steht fuer sich unter dem Pruefstand, in keinem Fach (Ventius gibt es hier nicht)", { fragen: f.fragen, unterKarten: f.unterKarten });
    // Builds-Reiter 6: ohne gespeicherten Build gilt das Waffenpaar (diese Kaempfe haben keinen); vorher erkannter Build, der Satz endete auf "mit diesem Build."
    assert(/^Borometer hat das Fenster selbst gefunden: in den 6\u00a0s nach Detonierendes Mal trifft Schnellfeuer im Schnitt \d+\u00a0% st\u00e4rker \(\d+\.\dk statt \d+\.\dk\) \u2013 gemessen \u00fcber 6 Pulls mit diesen Waffen\.$/.test(f.gef),
      "Satz: gefunden, 6 s nach Detonierendes Mal, ueber 6 Pulls", f.gef);
    assert(f.v === "30\u00a0% des Schadens von Schnellfeuer au\u00dferhalb des Fensters", "Antwort: 30 % aussen", f.v);
    assert(f.spurVerborgen && /^30\u00a0% au\u00dferhalb \u00b7 bester Pull \d+\u00a0%$/.test(f.wort), "Balken fuer Vorleser verborgen, das Wort nennt den besten Pull", f.wort);
    assert(f.liste === "Treffer im Fenster und au\u00dferhalb" && f.kacheln.length === 3 &&
      JSON.stringify(f.kacheln.map((k) => k.map((x) => x.split(":")[0]))) === JSON.stringify([["k", "z", "r"], ["k", "z", "r"], ["k", "z", "r"]]),
      "drei Kacheln als Liste mit Beschriftung, Wert und Vergleichswert", f.kacheln);
    assert(JSON.stringify(f.kacheln.map((k) => k[0])) === JSON.stringify(["k:Treffer im Fenster", "k:Treffer au\u00dferhalb", "k:Detonierendes Mal je Minute"]) &&
      f.kacheln[0][1] === "z:81.2k" && f.kacheln[1][1] === "z:45.5k" && f.kacheln[2][1] === "z:5,0" && f.kacheln.every((k) => k[2].startsWith("r:bester Pull ")),
      "Kacheln: 81.2k, 45.5k, 5,0 je Minute, je mit bestem Pull", f.kacheln);
    assert(f.krit.length === 1 && /^Kritisch: \d+\u00a0% im Fenster, \d+\u00a0% au\u00dferhalb\.$/.test(f.krit[0]), "Krit-Satz", f.krit);
    /* Issue #108: der beste Pull (ein gewoehnlicher) hatte gut 40 % aussen, dieser 30 % - er war im
       Fenster besser als der Bezug, also nennt das Urteil das Fenster nicht und nichts glueht dort.
       Vorher rechnete es gegen 0 % aussen einen grossen Verlust. */
    const bezug = /bester Pull (\d+)\u00a0%$/.exec(f.wort);
    assert(!!bezug && +bezug[1] > 30, "#108: der Bezug hatte mehr aussen als dieser Kampf", f.wort);
    assert(!f.urteil.includes("Fensters") && !/außerhalb/.test(f.note) && !f.zaehlt,
      "#108: besser als der Bezug - kein Fenster-Urteil, keine Glut auf der Antwort", [f.urteil, f.note, f.zaehlt]);
    await sprache("en");
    const e = await fenster();
    assert(e.fragen.includes("Did you hit inside the window?") && e.v === "30% of Quick Fire's damage outside the window" &&
      /^30% outside \u00b7 best pull \d+%$/.test(e.wort),
      "EN: Frage, Antwort, Balkenwort", e);
    await sprache("de");
    // 560 px: keine waagerechte Rolle, Kacheln untereinander; drei Themen mit Kontrast
    // #218: alle vier Themen (Glas dazu), das Fenster steht jetzt im Hauptfach
    await page.setViewportSize({ width: 560, height: 900 });
    await page.waitForTimeout(300);
    for (const theme of THEMEN) {
      await page.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`)?.click(), theme);
      await page.waitForTimeout(150);
      const k = await kontraste([".fwin .fgef", ".fwerte .k", ".fwerte .z", ".fwerte .r", ".fwin .fkrit", ".fant .mwort"]);
      const m = await page.evaluate(() => {
        const li = [...document.querySelectorAll(".fwerte > li")].map((x) => x.getBoundingClientRect());
        return {
          breit: document.documentElement.scrollWidth <= window.innerWidth + 1,
          untereinander: li.length === 3 && li[1].top >= li[0].bottom - 1 && li[2].top >= li[1].bottom - 1,
        };
      });
      assert(m.breit && m.untereinander, `560 px, Thema ${theme}: keine waagerechte Rolle, Kacheln untereinander`, m);
      assert(k.length === 6 && k.every(([, v]) => v >= 4.5), `Thema ${theme}: Kontrast der neuen Tinten >= 4,5:1`, k);
    }
    await page.evaluate(() => document.querySelector('#themeRow [data-theme="dark"]')?.click());
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.waitForTimeout(200);
  }
  {
    await frisch();
    // 11 % aussen: die Frage steht, das Urteil nennt sie nicht
    await load(logFile("fenster-11.txt", serie(22, "Fellinex", 5, {}, { setz: [34, 7, 81200, 45500] })), "Fellinex");
    await tab("analysis");
    const f = await fenster();
    assert(f.da && /^1\d\u00a0% des Schadens/.test(f.v) && !f.zaehlt && !f.urteil.includes("Fensters"),
      "11 % aussen: die Frage steht, kein Fenster-Urteil, keine Glut auf der Antwort", [f.v, f.urteil, f.zaehlt]);
  }
  {
    await frisch();
    /* #108 mit besserem Bezug: acht Pulls mit 40 Treffern innen und 12 aussen (gut 17 % des Schadens
       aussen), der letzte mit 30 %. Das Urteil rechnet nur den Teil ueber dem Bezug und nennt ihn. */
    await load(logFile("fenster-30-bezug.txt", serie(27, "Fellinex", 8, { setz: [40, 12, 100000, 70000] },
      { setz: [34, 26, 81200, 45500] })), "Fellinex");
    await tab("analysis");
    const f = await fenster();
    const q = /bester Pull (\d+)\u00a0%$/.exec(f.wort);
    assert(!!q && +q[1] >= 15 && +q[1] <= 20, "#108: der Bezug hatte weniger aussen (um 17 %)", f.wort);
    assert(f.urteil === "Schnellfeuer au\u00dferhalb des Fensters nach Detonierendes Mal" &&
      /^Das kostet dich am meisten: Etwa \d+(\.\d+)?k Schaden, \d+\u00a0% des Kampfes, gerechnet gegen deinen besten Pull: 30\u00a0% davon lag außerhalb, dort nur (\d+)\u00a0%\. Außerhalb traf es mit 45\.5k statt 81\.2k\.$/.exec(f.note)?.[2] === q?.[1],
      "#108: schlechter als der Bezug - das Urteil rechnet gegen ihn und nennt seinen Anteil", [f.urteil, f.note]);
    // die Kosten: H aussen 26 x 45,5k mal (81,2k/45,5k - 1), davon der Anteil ueber dem Bezug (30 % - q) / 30 %
    const k = /Etwa (\d+(?:\.\d+)?)k/.exec(f.note), aussen = /^(\d+)\u00a0%/.exec(f.v);
    const soll = 26 * 45500 * (81200 / 45500 - 1) * (+aussen?.[1] - +q?.[1]) / +aussen?.[1] / 1000;
    assert(!!k && Math.abs(+k[1] - soll) <= soll * 0.06, "#108: Kosten nur fuer den Teil ueber dem Bezug", { note: f.note, soll });
    assert(f.zaehlt && f.glut && f.glut.antwort === f.glut.urteil && f.glut.kachel !== f.glut.urteil,
      "Glut nur auf dem Urteil und der Antwort, die es nennt - nicht auf den Kacheln", f.glut);
    await sprache("en");
    const e = await fenster();
    assert(e.urteil === "Quick Fire outside the window after Detonation Mark" && /counted against your best pull: 30% of it landed outside, there only \d+%\./.test(e.note),
      "#108 EN: Urteil gegen den Bezug", [e.urteil, e.note]);
    await sprache("de");
  }
  {
    await frisch();
    // gleiche Staerke innen und aussen: kein Fenster, keine Ueberschrift
    await load(logFile("fenster-kein.txt", serie(23, "Fellinex", 6, { inDmg: 70000 })), "Fellinex");
    await tab("analysis");
    const f = await fenster();
    assert(!f.da && !f.fragen.includes("Hast du im Fenster getroffen?"), "kein Fenster: der Abschnitt entfaellt samt Ueberschrift", f.fragen);
  }
  {
    await frisch();
    /* Erster Pull an Fellinex mit diesem Build: das Fenster kommt aus dem
       Pool (drei Pulls an Vulcanus, als beste Pulls dieser Sitzung
       gespeichert), einen Vergleichswert gibt es noch nicht. */
    await load(logFile("vulcanus-drei.txt", serie(24, "Vulcanus", 3, {})), "Vulcanus");
    await load(logFile("fellinex-erster.txt", serie(25, "Fellinex", 1, {})), "Fellinex");
    await tab("analysis");
    const f = await fenster();
    // Builds-Reiter 6: ohne gespeicherten Build gilt das Waffenpaar (diese Kaempfe haben keinen); vorher erkannter Build, der Satz endete auf "mit diesem Build."
    assert(f.da && / gemessen \u00fcber 3 Pulls mit diesen Waffen\.$/.test(f.gef), "erster Pull: Fenster aus dem Pool ueber das Waffenpaar (dieser und zwei gespeicherte)", f.gef);
    assert(/^\d+\u00a0% au\u00dferhalb$/.test(f.wort) && f.kacheln.every((k) => k.length === 2) &&
      f.krit.includes("Einen Vergleichswert gibt es ab dem zweiten Pull an Fellinex mit diesen Waffen."),   // Builds-Reiter 6: ohne Build das Paar, vorher "mit diesem Build."
      "erster Pull: ohne Vergleichswerte, mit dem Satz dazu", [f.wort, f.kacheln, f.krit]);
  }


  // --- 3 \u00b7 Der Start (Spezifikation 3.5, 4.5)
  const startZeile = () => page.evaluate(() => {
    /* #414 (B2, Inventur O7): der Start steht als Satz unter dem Opener (#a2start, im Abschnitt der Faehigkeiten), nicht mehr in der
       Befundliste: "Die ersten 10 s: <Wert> \u00b7 <Bezug> \u00b7 <Satz>", gelesen wird die h3 des Abschnitts */
    const e = document.querySelector("#a2start");
    if (!e || e.hidden) return null;
    const c = e.cloneNode(true); c.querySelectorAll("button").forEach((b) => b.remove());
    const m = /^(?:Die ersten|The first) 10\u00a0s: (\S+) \u00b7 (.*)$/.exec(c.textContent.trim());
    return m ? { sec: e.closest("section")?.querySelector("h3")?.textContent || "", v: m[1], n: m[2] } : null;
  });
  // #414 (B2): "unter der Form" steht kein Start-Satz - die Saetze der Form sind der Satz des Bereichs, der Haelftensatz, Gut hier, Besser moeglich und die Zeile unter der Legende
  const formSatz = () => page.evaluate(() => ["#a2satz", "#a2haelften", "#a2gut", "#a2besser", "#a2unv"].map((x) => document.querySelector(x)?.textContent || "").join(" "));
  {
    await frisch();
    // fuenf gewoehnliche Pulls, im letzten die ersten 10 s nur der Fueller
    await load(logFile("start-schwach.txt", serie(26, "Fellinex", 5, {}, { leise: 10000 })), "Fellinex");
    await tab("analysis");
    const z = await startZeile();
    assert(z && z.sec === "Deine Fähigkeiten" && /^\d+\.\dk$/.test(z.v) &&
      /^bester Pull \d+\.\dk \u00b7 Dein Start war deutlich schw\u00e4cher: \d+\u00a0% deines besten Pulls\.$/.test(z.n),
      "schwacher Start: Satz unter dem Opener mit Wert, bestem Pull und Satz (#414)", z);
    /* Issue #106: der Start steht genau einmal - unter "Weitere Befunde" (oben), nicht noch als
       Nebensatz unter der Form (vorher mit dem Verweis auf die Zeitleiste der Rotation) */
    assert(!/Start/.test(await formSatz()), "schwacher Start: kein zweiter Satz unter der Form (#106)", await formSatz());
    await sprache("en");
    assert(!/start/i.test(await formSatz()), "EN: kein Start-Satz unter der Form (#106)", await formSatz());
    await sprache("de");
  }
  {
    await frisch();
    // ein gewoehnlicher Start, der letzte Pull etwas schwaecher als der beste
    await load(logFile("start-ueblich.txt", serie(27, "Fellinex", 5, {}, { filler: 19000 })), "Fellinex");
    await tab("analysis");
    const z = await startZeile();
    assert(z && /^bester Pull \d+\.\dk \u00b7 Dein Start war wie \u00fcblich\.$/.test(z.n), "gewoehnlicher Start: wie ueblich", z);
    assert(!(await formSatz()).includes("Start"), "gewoehnlicher Start: kein Nebensatz unter der Form", await formSatz());
  }
  {
    await frisch();
    await load(logFile("start-erster.txt", serie(28, "Fellinex", 1, {})), "Fellinex");
    await tab("analysis");
    assert(await startZeile() === null && !(await formSatz()).includes("Start"), "erster Pull: keine Start-Zeile, kein Nebensatz");
  }


  // --- 4 \u00b7 Zwei Spieler desselben Builds im Party-Log: jeder sieht sein Fenster (Review 1)
  {
    await frisch();
    // ein langer Pull, beide zur selben Zeit, gleich viele Treffer; aussen trifft der zweite schwaecher
    const tr = [...fensterPull(at(29, 20, 0), "Fellinex", { dauer: 300000 }),
                ...fensterPull(at(29, 20, 0), "Fellinex", { dauer: 300000, outDmg: 50000, wer: "Zweiter" })];
    await load(logFile("zwei-spieler.txt", tr), "Fellinex");
    await tab("analysis");
    assert(!(await fenster()).da, "zwei Angreifer ohne Filter: kein Fenster (die Einsaetze mischten sich)");
    const gewinn = async (wer) => {
      // die Auswahl steht im zugeklappten Filter: gesetzt wie von Hand, mit change
      await page.evaluate((w) => { const e = document.querySelector("#selPlayer"); e.value = w; e.dispatchEvent(new Event("change")); }, wer);
      await page.waitForTimeout(250);
      await tab("analysis");
      const f = await fenster();
      return (f.gef.match(/im Schnitt (\d+)\u00a0%/) || [])[1] || f.gef;
    };
    const a = await gewinn("Tester"), b = await gewinn("Zweiter"), a2 = await gewinn("Tester");
    assert(+a >= 40 && +a <= 46 && +b >= 95 && +b <= 105 && a2 === a,
      "Spielerwechsel: jeder Spieler bekommt sein eigenes Fenster (+43 % gegen +100 %), zurueck wieder das erste", [a, b, a2]);
  }

  // --- 5 \u00b7 Puppe: der Kampf und sein Bezug auf dieselbe Klassenlaenge geschnitten (Review 2)
  {
    await frisch();
    /* Erster Versuch 125 s (Klasse 120), zweiter 175 s (ebenfalls 120): die
       ersten 120 s gleich, danach kein Mal mehr - dort laege nur noch
       Schnellfeuer ausserhalb. Geschnitten sind beide Seiten gleich. */
    const tr = [...fensterPull(at(30, 20, 0), "Practice Dummy", { dauer: 125000, streu: false }),
                ...fensterPull(at(30, 20, 10), "Practice Dummy", { dauer: 175000, fBis: 120000, streu: false })];
    await load(logFile("puppe.txt", tr), "Practice Dummy");
    await tab("analysis");
    const f = await fenster();
    const m = f.wort.match(/^(\d+)\u00a0% au\u00dferhalb \u00b7 (?:zweit)?bester Pull (\d+)\u00a0%$/);
    assert(f.da && m && m[1] === m[2], "Puppe: Anteil aussen ueber 120 s, gleich wie der Bezug ueber 120 s", f.wort);
    assert(f.kacheln[2] && f.kacheln[2][1] === "z:5,0" && /^r:(zweit)?bester Pull 5,0$/.test(f.kacheln[2][2]),
      "Puppe: Mal je Minute ueber die Klassenlaenge, beide 5,0", f.kacheln[2]);
  }

  // --- 6 \u00b7 Ventius-Familie als Hauptschaden (Review 3)
  {
    await frisch();
    /* Entschlossener Scharfschuss als Salve (ein Eroeffnungstreffer, eine
       Sekunde spaeter zwei Wellen zu drei): die Seite nennt sie Auge von
       Ventius. Alle 3 s ein Einsatz, im Fenster nach dem Mal staerker. */
    const DS = ["Decisive Sniping", 964581976];
    const salven = (start) => {
      const tr = [];
      for (let t = 0; t < 96000; t += 12000) tr.push([start + t, DM[0], DM[1], 50000, false, "Fellinex"]);
      for (let t = 300; t < 96000; t += 3000) {
        const d = t % 12000 < 6000 ? 100000 : 70000;
        tr.push([start + t, DS[0], DS[1], d, false, "Fellinex"]);
        for (const w of [1000, 1100]) for (const x of [0, 5, 10]) tr.push([start + t + w + x, DS[0], DS[1], d, false, "Fellinex"]);
      }
      for (let t = 700; t < 96000; t += 1000) tr.push([start + t, ST[0], ST[1], 20000, false, "Fellinex"]);
      return tr;
    };
    const tr = [];
    for (let p = 0; p < 6; p++) tr.push(...salven(at(1, 20, p * 10)));
    await load(logFile("salven.txt", tr), "Fellinex");
    await tab("analysis");
    const f = await fenster();
    assert(/ nach Detonierendes Mal trifft Auge von Ventius im Schnitt /.test(f.gef), "Salve: der Hauptschaden heisst Auge von Ventius", f.gef);
    // folgt Entwurf (DECISION 4.13, Luecken 4.10): die drei Felder, das Fenster, der Kasten Auge von Ventius
    /* #218 (Spezifikation 2026-10-07, 8.2): das Ventius-Fach ist das Hauptfach (Meister Schaden), seine h3
       "Auge von Ventius" zuerst, darin die Frage zum Fenster als h4, danach die mittleren Faecher */
    const faV = faecherVon(letzterPull(tr), { ventius: true });
    const vKarte = await page.evaluate(() => document.querySelectorAll("#a2 .a2karte.vent").length);
    assert(faV.haupt === "Auge von Ventius" && vKarte === 1 && f.unterKarten && f.fragen[0] === "Hast du im Fenster getroffen?",
      "Ventius hat seine Karte im Pruefstand, die Frage nach dem Fenster steht darunter in #findings (#414)", { fragen: f.fragen, vKarte, unterKarten: f.unterKarten });
    /* #218 neu (Spezifikation 3.3, 8.3): je Salve eine Saeule, gefuellte Perlen bis zur erreichten Zahl
       der Nachbeben, leere bis zum Bestwert des Kampfes (ventiusMix().top). Hier fliegt jede Salve mit
       zwei Wellen zu drei (Eroeffnung, +1000 ms, +1100 ms): 32 Salven je Pull, je zwei gefuellte Perlen,
       keine leere. Die Saeulen trennt der Test an ihrer Lage (Mitte der Perle auf der x-Achse). */
    /* #414: die Perlen sind das Raster der Ventius-Karte (ein Punkt = ein Nachbeben); es ist erst gebaut, wenn die Karte
       aufgeklappt ist. Je Salve ein Streifen mit so vielen vollen Punkten wie Nachbeben, keinem hohlen beim Bestwert. */
    await page.evaluate(() => { document.querySelector("#a2vent").open = true; });
    await page.waitForFunction(() => document.querySelectorAll("#a2vinnen .a2salve").length > 0);
    const perlen = await page.evaluate(() => [...document.querySelectorAll("#a2vinnen .a2salve")]
      .map((e) => ({ voll: e.querySelectorAll(".voll").length, leer: e.querySelectorAll(".leer").length })));
    const salvenJePull = Math.ceil((96000 - 300) / 3000);
    assert(perlen.length === salvenJePull && perlen.every((s) => s.voll === 2 && s.leer === 0),
      "Ventius: je Salve so viele volle Punkte wie Nachbeben (ventiusMix), keinen hohlen beim Bestwert", { salvenJePull, n: perlen.length, erste: perlen.slice(0, 3) });
  }
  {
    await frisch();
    /* Ohne Salve, halb mit deutschem, halb mit englischem Client
       geschrieben: ein Schluessel, ein Fenster ueber alle sechs Pulls. */
    const tr = [];
    for (let p = 0; p < 6; p++)
      tr.push(...fensterPull(at(2, 20, p * 10), "Fellinex",
        { h: p % 2 ? ["Entschlossener Scharfschuss", 964581976] : ["Decisive Sniping", 964581976] }));
    await load(logFile("scharfschuss.txt", tr), "Fellinex");
    await tab("analysis");
    const f = await fenster();
    // Builds-Reiter 6: ohne gespeicherten Build gilt das Waffenpaar (diese Kaempfe haben keinen); vorher erkannter Build, der Satz endete auf "mit diesem Build."
    assert(/ nach Detonierendes Mal trifft Entschlossener Scharfschuss im Schnitt \d+\u00a0% st\u00e4rker .* gemessen \u00fcber 6 Pulls mit diesen Waffen\.$/.test(f.gef),
      "Scharfschuss unter zwei Client-Namen: ein Hauptschaden ueber sechs Pulls", f.gef);
  }

  // --- 7 \u00b7 Unter der Schwelle und ohne Uhr (Review 5)
  {
    await frisch();
    const tr = serie(3, "Fellinex", 5, {});
    for (let k = 0; k < 15; k++) tr.push([at(3, 21, 0) + k * 500, QF[0], QF[1], 10000 * (1 + (k % 5)), false, "Fellinex"]);
    await load(logFile("duenn.txt", tr), "Fellinex");
    await tab("analysis");
    const f = await fenster();
    const call = await page.evaluate(() => document.querySelector("#analysisCall")?.className || "");
    assert(!f.da && call.includes("ruhig") && !f.urteil.includes("Fensters"), "unter 20 Treffern: kein Fenster-Abschnitt, kein Fenster-Urteil", [f.fragen, f.urteil]);
  }
  {
    await frisch();
    // ein Log ohne Zeitspalte: der Satz ohne "ab" und ohne die Zahl oben
    const zeilen = ["CombatLogVersion,4"];
    for (let k = 0; k < 120; k++) zeilen.push(`DamageDone,${QF[0]},${QF[1]},${10000 * (1 + (k % 5))},0,0,kNormalHit,Tester,Fellinex`);
    for (let k = 0; k < 20; k++) zeilen.push(`DamageDone,${ST[0]},${ST[1]},${Math.round(360000 * 7 / 93 * 10 / 20)},0,0,kNormalHit,Tester,Fellini`);
    const p = join(work, "ohne-uhr.txt");
    writeFileSync(p, zeilen.join("\n") + "\n");
    await page.setInputFiles("#fileInput", p);
    await page.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Fellinex"));
    await page.waitForTimeout(150);
    await tab("analysis");
    assert(await unterZielen() === "Davon 7\u00a0% auf Fellini.", "ohne Uhr: Satz ohne \"ab\" und ohne Zahl oben", await unterZielen());
    assert((await kopf()).hidden, "ohne Uhr: keine Zeile im Kopf (dort steht keine Zahl)");
    // Abschlusspruefung I1: ohne Uhr gibt es keinen besten Pull - kein Eintrag, kein "noch kein Pull"
    await tab("analysis");
    const ohneUhr = await page.evaluate(() => ({ eintrag: !!document.querySelector('#wbKenn .find[data-k="gegenBest"]'),
      kenn: !!document.querySelector("#wbKenn"), text: document.querySelector("#p-analysis").innerText }));
    assert(ohneUhr.kenn && !ohneUhr.eintrag && !/noch kein Pull|dein erster Pull/.test(ohneUhr.text),
      "ohne Uhr: kein Eintrag „Gegen deinen besten Pull“, kein „noch kein Pull“", ohneUhr);
  }

  // --- 8 \u00b7 Kopf und Schadenstafel (Issue #53)
  {
    await frisch();
    await page.setViewportSize({ width: 1280, height: 860 });
    // ein Pull mit Krits: Schnellfeuer klappt in Trefferarten auf
    await load(logFile("tafel.txt", serie(4, "Fellinex", 1, {})), "Fellinex");
    /* folgt Spezifikation Glutring 4: im Bereich Kampf der vollen Ansicht steht die Liste neben dem Ring
       (64-glutring.ts) statt der breiten und der schmalen Tafel - bei jeder Breite dieselbe. Dieselben Zusagen,
       neu gemessen: die Spalten des Kopfs, Zellen je Zeile, Balken an derselben Kante als Spur mit Bahn, die Schrift
       der Zahl, Zeile 44 Punkt, Symbole ohne Farbring, Aufklappen in die Trefferarten mit einer Summenzeile, der
       Fokus beim Neuzeichnen, Sortieren und kein Querrollen bei 620 und 560 Punkt.
       folgt Spezifikation Feinschliff 4 (#100): der Kopf ist eine Zeile aus Name und Knopf "Ordnen" mit Menue. Die
       Spalten zaehlen jetzt an den Zellen der ersten Zeile, der Kopf hat zwei Zellen, geordnet wird ueber das Menue,
       die gewaehlte Ordnung steht im Menue (aria-checked) und auf dem Knopf. */
    const ordne = async (k) => {
      await page.evaluate(() => document.querySelector("#ringOrdnen").click());
      await page.waitForTimeout(80);
      await page.evaluate((k) => document.querySelector(`#ringOrdnenMenue [data-k="${k}"]`).click(), k);
    };
    const tafel = () => page.evaluate(() => {
      const box = document.querySelector("#bars");
      const sichtbar = (e) => !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0;
      const zeilen = [...box.querySelectorAll(".row:not(.sub)")];
      const kopf = zeilen[0] ? [...zeilen[0].querySelectorAll("[role=gridcell]")] : [];
      return {
        kopfAlle: kopf.map((s) => s.dataset.k || "name"), kopf: kopf.filter(sichtbar).map((s) => s.dataset.k || "name"),
        sortiert: document.querySelector('#ringOrdnenMenue [aria-checked="true"]')?.dataset.k || "",
        knopf: document.querySelector("#ringOrdnen")?.textContent || "",
        zellen: [...box.querySelectorAll("[role=row]")].map((r) => [r.classList.contains("catrow") ? "art" : r.classList.contains("bdetail") ? "summe" :
          r.classList.contains("bhead") ? "kopf" : "zeile",
          r.querySelectorAll("[role=gridcell],[role=columnheader]").length]),
        balken: zeilen.map((z) => {
          const f = z.querySelector(".fill").getBoundingClientRect(), n = z.querySelector(".nmt").getBoundingClientRect(), d = z.querySelector(".v.dps").getBoundingClientRect();
          return { links: Math.round(f.left), hoch: Math.round(f.height), oben: Math.round(f.top), textUnten: Math.round(n.bottom),
            rechts: Math.round(f.right), dpsRechts: Math.round(d.right) };
        }),
        bahn: zeilen.slice(0, 1).map((z) => getComputedStyle(z, "::before").backgroundColor)[0] || "",
        rollt: document.documentElement.scrollWidth > window.innerWidth + 1 || box.scrollWidth > box.clientWidth + 1,
      };
    });
    let b = await tafel();
    assert(JSON.stringify(b.kopfAlle) === JSON.stringify(["name", "dps", "share", "hits", "critRate", "heavyRate"]),
      "Liste: Name, DPS, Anteil, Treffer, Kritisch, Stark", b.kopfAlle);
    assert(b.zellen.every(([art, n]) => (art === "kopf" && n === 2) || (art === "zeile" && n === 6) || (art === "art" && n === 3) || (art === "summe" && n === 1)) &&
      b.zellen.filter(([art]) => art === "kopf").length === 1,
      "Liste: der Kopf zwei Zellen (Name, Ordnen), Hauptzeilen sechs, Trefferarten drei (Name, Treffer, Schaden), die Summe eine ueber alle", b.zellen);
    assert(b.balken.length >= 3 && b.balken.every((x) => x.links === b.balken[0].links && x.oben >= x.textUnten - 1 && x.hoch === 4 && x.rechts <= x.dpsRechts + 1),
      "Liste: alle Balken an derselben Kante, eine 4-px-Spur unter dem Namen, der volle endet mit der DPS-Zahl", b.balken);
    assert(b.bahn && !/rgba\(0, 0, 0, 0\)|transparent/.test(b.bahn), "Liste: hinter dem Balken eine Bahn", b.bahn);
    const schrift = await page.evaluate(() => {
      const f = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e) : null; };
      const dps = f("#bars .row:not(.sub) .v.dps"), unter = f('#bars .row:not(.sub) .v[data-k="hits"]');
      const summe = f("#hMeta [data-f=schaden] .dmgv"), satz = f("#hRead");
      return { dps: dps?.fontFamily, unter: unter?.fontFamily, summe: summe?.fontFamily, summeW: summe?.fontWeight,
        chips: !!document.querySelector("#chips"), treffer: document.querySelector("#hMeta [data-f=treffer]")?.textContent || "",
        satz: satz?.fontSize, zeile: document.querySelector("#bars .row:not(.sub)").getBoundingClientRect().height };
    });
    assert(/Anton/.test(schrift.dps) && /Source Sans 3/.test(schrift.unter), "die DPS der Zeile in Anton, die Unterzeile in Source Sans 3", schrift);
    assert(!schrift.chips && /Source Sans 3/.test(schrift.summe) && schrift.summeW === "600" && /^\d+ Treffer$/.test(schrift.treffer) &&
      schrift.satz === "13.5px" && schrift.zeile === 44,
      "keine Werteleiste, Treffer in der Faktenzeile, Schaden dort in Source Sans 3 600, Lese-Satz 13,5 px, Zeile 44 px", schrift);

    /* Ohne Spielbilder entfaellt der Unterschied "ohne Farbring" (Liste) gegen "mit Farbring" (Kompakt):
       die Platte .sic.leer ist bewusst kein Ring, sondern die volle Flaeche in der Serienfarbe, und bleibt
       in beiden Ansichten so (styles.css, Kommentar vor "body:not(.compact) #bars .row .nm img.sic").
       Geprueft wird darum an allen drei Stellen dieselbe Platte: 16 Punkt, Flaeche in --sic-c. */
    const ringe = (seite = 16) => page.evaluate(([bilder, seite]) => bilder ? [...document.querySelectorAll("#bars .row .nm img.sic")]
      .map((e) => /0px 0px 0px 1\.5px/.test(getComputedStyle(e).boxShadow))
      : [...document.querySelectorAll("#bars .row:not(.catrow) .nm span.sic.leer:not(.hatch)")].map((e) => {
        const probe = document.createElement("i"); probe.style.color = "var(--sic-c)"; e.appendChild(probe);
        const farbe = getComputedStyle(probe).color; probe.remove();
        const r = e.getBoundingClientRect(), bg = getComputedStyle(e).backgroundColor;
        return { platte: !!e.style.getPropertyValue("--sic-c") && bg === farbe && bg !== "rgba(0, 0, 0, 0)" && r.width === seite && r.height === seite, bg, farbe, w: r.width, h: r.height };
      }), [BILDER, seite]);
    const ohneSym = " (ohne Spielbilder: Platte in --sic-c, 16 Punkt)";
    const ohneSymKompakt = " (ohne Spielbilder: Platte in --sic-c, 20 Punkt)"; /* Aufbau B: 20 Punkt (vorher 18, Panel #287) */
    let r = await ringe();
    assert(r.length >= 3 && r.every((x) => BILDER ? !x : x.platte), "Liste: Symbole ohne Farbring" + (BILDER ? "" : ohneSym), r);

    await page.evaluate(() => { const z = document.querySelector('#bars .row[data-open="Quick Fire"]'); if (z.getAttribute("aria-expanded") !== "true") z.click(); });
    await page.waitForTimeout(120);
    const detail = () => page.evaluate(() => {
      const d = document.querySelector('#bars .row.bdetail[data-detail="Quick Fire"]'), zelle = d?.querySelector("[role=gridcell]");
      return d ? { rolle: d.getAttribute("role"), text: d.textContent, colspan: zelle?.getAttribute("aria-colspan"), vorher: d.previousElementSibling?.dataset.cat || "",
        arten: [...document.querySelectorAll('#bars .row.catrow[data-parent="Quick Fire"]')].map((z) => z.dataset.cat) } : null;
    });
    let d = await detail();
    assert(d && d.rolle === "row" && d.colspan === "6" && JSON.stringify(d.arten.slice(0, 4)) === JSON.stringify(["normal", "crit", "heavy", "critheavy"]) &&
      d.vorher === d.arten[d.arten.length - 1], "Aufklappen: die vier Trefferarten, darunter die Summenzeile mit einer Zelle ueber alle Spalten", d);
    assert(d && /^\d+ Treffer gesamt \u00b7 gr\u00f6\u00dfter [\d.]+k? \u00b7 \u00d8 [\d.]+k? je Treffer \u00b7 Schaden [\d.]+[kM]?$/.test(d.text), "Summenzeile DE", d);
    b = await tafel();
    assert(b.zellen.every(([art, n]) => (art === "kopf" && n === 2) || (art === "zeile" && n === 6) || (art === "art" && n === 3) || (art === "summe" && n === 1)), "aufgeklappt: Zellen wie oben", b.zellen);
    const katQuoten = await page.evaluate(() => document.querySelectorAll('#bars .row.catrow [data-k="critRate"], #bars .row.catrow [data-k="heavyRate"]').length);
    assert(katQuoten === 0, "Trefferarten ohne Kritisch/Stark-Quote wie bisher", katQuoten);
    const subBahn = await page.evaluate(() => [...document.querySelectorAll("#bars .row.catrow")].map((z) => {
      const s = getComputedStyle(z, "::before"), h = getComputedStyle(document.querySelector("#bars .row:not(.sub)"), "::before");
      return { da: s.content !== "none" && s.backgroundColor === h.backgroundColor, hoch: s.height };
    }));
    assert(subBahn.length >= 2 && subBahn.every((x) => x.da && x.hoch === "3px"),
      "auch hinter den 3-px-Spuren der Trefferarten eine Bahn, in der Farbe der Hauptzeilen", subBahn);
    const fokus = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.detail ? "detail:" + a.dataset.detail : a.dataset.open ? "open:" + a.dataset.open : a.tagName) : ""; });
    await page.evaluate(() => document.querySelector("#bars .bdetail").focus());
    assert(await fokus() === "detail:Quick Fire", "Summenzeile laesst sich fokussieren und traegt ihren Namen", await fokus());
    await sprache("en");
    assert(await fokus() === "detail:Quick Fire", "Neuzeichnen (Sprache): der Fokus bleibt auf der Summenzeile", await fokus());
    await sprache("de");
    await page.setViewportSize({ width: 620, height: 860 });
    await page.waitForTimeout(250);
    assert(await fokus() === "detail:Quick Fire", "Breitenwechsel nach 620: dieselbe Liste, der Fokus bleibt", await fokus());
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.waitForTimeout(250);
    await themen(["#bars .bdetail .dz", "#bars .row:not(.sub) .v.dps"], "Summenzeile und DPS");
    for (const theme of ["dark", "light", "tnl"]) {
      await page.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`)?.click(), theme);
      await page.waitForTimeout(120);
      const bahn = (await tafel()).bahn;
      assert(bahn && !/rgba\(0, 0, 0, 0\)/.test(bahn), `Thema ${theme}: die Bahn ist da`, bahn);
    }
    await page.evaluate(() => document.querySelector('#themeRow [data-theme="dark"]')?.click());
    await sprache("en");
    d = await detail();
    assert(d && /^\d+ hits in all \u00b7 biggest [\d.]+k? \u00b7 avg [\d.]+k? per hit \u00b7 damage [\d.]+[kM]?$/.test(d.text), "Summenzeile EN", d);
    await sprache("de");

    // 620 und 560 Punkt: dieselbe Liste unter dem Ring, alle Spalten, sortierbar, kein Querrollen
    await page.setViewportSize({ width: 620, height: 860 });
    await page.waitForTimeout(250);
    b = await tafel();
    assert(JSON.stringify(b.kopf) === JSON.stringify(["name", "dps", "share", "hits", "critRate", "heavyRate"]) && !b.rollt,
      "620 px: dieselben sechs Spalten, kein Querrollen", b);
    r = await ringe();
    assert(r.length >= 3 && r.every((x) => BILDER ? !x : x.platte), "620 px: Symbole ebenfalls ohne Farbring" + (BILDER ? "" : ohneSym), r);
    /* folgt Spezifikation Feinschliff 4: "Anteil" ordnet wie DPS und steht nicht mehr im Menue (F2); dieselbe Zusage
       - bei 620 Punkt laesst sich die Liste umordnen - mit Kritisch */
    await ordne("critRate");
    await page.waitForTimeout(120);
    b = await tafel();
    assert(b.sortiert === "critRate" && b.knopf === "Ordnen: Kritisch \u2193", "620 px: ueber das Menue umzuordnen wie heute", b);
    await page.setViewportSize({ width: 560, height: 860 });
    await page.waitForTimeout(250);
    for (const theme of ["dark", "light", "tnl"]) {
      await page.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`)?.click(), theme);
      await page.waitForTimeout(120);
      b = await tafel();
      assert(!b.rollt, `560 px, Thema ${theme}: kein waagerechtes Rollen`, b);
    }
    await page.evaluate(() => document.querySelector('#themeRow [data-theme="dark"]')?.click());
    await ordne("hits"); // folgt Spezifikation Feinschliff 4: ueber das Menue statt ueber den Spaltenkopf
    await page.waitForTimeout(120);
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.waitForTimeout(250);
    b = await tafel();
    /* Probe 2.6 (Groesster Treffer faellt in der Gruppe auf DPS zurueck, Spezifikation Feinschliff 4.3, #86) steht in
       test-tafel-page.mjs, Abschnitt 12: nur dort gibt es eine Gruppe. */
    assert(b.sortiert === "hits" && b.knopf === "Ordnen: Treffer \u2193" && b.kopfAlle.length === 6, "die Sortierung nach Treffer bleibt beim Breitenwechsel", b);

    /* Kompakt folgt seit der Neugestaltung dem Entwurf (Overlay-Szene E:1017ff., Luecke 11.2): je Zeile Name
       und Schaden, Rang, DPS und Anteil gehen, der Balken ist die 3-Punkt-Spur unter dem Namen, die Zahl in
       der Anzeigeschrift. Gleich streng wie vorher: welche Spalten stehen, wo der Balken liegt, welche Schrift
       die Zahl traegt - jetzt je Zeile statt am Kopf, den der Streifen nicht mehr zeigt. */
    await page.evaluate(() => document.querySelector("#btnCompact").click());
    await page.waitForFunction(() => document.body.classList.contains("compact"));
    const kompakt = await page.evaluate(() => {
      const sicht = (e) => !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0;
      const z = document.querySelector("#bars .row:not(.sub)");
      const f = z.querySelector(".fill").getBoundingClientRect(), zb = z.getBoundingClientRect();
      return { zellen: [...z.querySelectorAll("[role=gridcell]")].filter(sicht).map((c) => c.dataset.k || c.className.split(" ")[0]),
        fuellt: f.height >= 24 && f.left <= zb.left + 1, nameSicht: sicht(z.querySelector(".nmt")),
        dmg: getComputedStyle(z.querySelector('[data-k="damage"]')).fontFamily };
    });
    /* Kompakt neu (14.10.2026, #241): je Zeile eine Platte - Schaden und Anteil stehen, der Name nur fuer Vorleser (Zelle ohne eigenen
       Kasten), die Spur liegt unter der Zahl in der Breite der Platte, die Zahl in der Textschrift (die Platte ist 44 Punkt breit) */
    /* Kompakt neu, Panel (21.10.2026, #287): je Zeile steht der Anteil (der Schaden nur im Namen fuer Vorleser), der Name ist sichtbar,
       der Balken fuellt die Zeile von der Kante an, die Zahl steht in der Textschrift. */
    assert(JSON.stringify(kompakt.zellen) === JSON.stringify(["damage", "dps"]) && kompakt.fuellt && kompakt.nameSicht && !/Anton/.test(kompakt.dmg),
      "Kompakt (Panel): Schaden und DPS je Zeile (Aufbau B, kein Anteil), der Name sichtbar, die Fuellung deckt die Zeile, der Schaden in der Textschrift", kompakt);
    r = await ringe(20);
    assert(r.length >= 3 && r.every((x) => BILDER ? x : x.platte), "Kompakt: die Symbole behalten ihren Farbring" + (BILDER ? "" : ohneSymKompakt), r);
    await page.evaluate(() => document.querySelector("#btnCompact").click());
    await page.waitForTimeout(300);

    // "Nach Waffe" nur im Entwicklermodus
    const waffe = () => page.evaluate(() => {
      const w = document.querySelector('#groupSeg [data-g="weapon"]');
      return { hidden: w.hidden || getComputedStyle(w).display === "none", an: document.querySelector("#groupSeg .on")?.dataset.g };
    });
    assert((await waffe()).hidden, "ohne Entwicklermodus: kein \"Nach Waffe\"", await waffe());
    // der Schalter der Einstellungen (der Haken #miDev im ⋯-Menue ging mit Stufe 3)
    await page.evaluate(() => document.querySelector("#eDev").click());
    await page.waitForTimeout(120);
    assert(!(await waffe()).hidden, "Entwicklermodus: \"Nach Waffe\" ist da", await waffe());
    await page.evaluate(() => document.querySelector('#groupSeg [data-g="weapon"]').click());
    await page.waitForTimeout(120);
    assert((await waffe()).an === "weapon", "Nach Waffe gewaehlt");
    await page.evaluate(() => document.querySelector("#eDev").click());
    await page.waitForTimeout(120);
    const w = await waffe();
    const ersteZeile = await page.evaluate(() => document.querySelector("#bars .row")?.dataset.open || document.querySelector("#bars .row .nmt")?.textContent);
    assert(w.hidden && w.an === "skill" && ersteZeile !== "Unassigned" && !/Bogen|Armbrust|Bow|Crossbow/.test(ersteZeile || ""),
      "Entwicklermodus aus: zurueck auf \"Nach F\u00e4higkeit\"", [w, ersteZeile]);
  }

  assert(errors.length === 0, "keine Fehler auf der Seite", errors);

  /* --- 9 \u00b7 aus test-trainer-page.mjs, Neugestaltung 28.09. (Nr. 7b, 7c und
     die Proben danach): der Trainer entfaellt (Spezifikation 3), diese Proben
     pruefen die Analyse und den Zeitverlauf. Eine eigene Seite, Deutsch. */
  {
    const tp = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const tErrors = [];
    tp.on("pageerror", (e) => tErrors.push(String(e)));
    await tp.addInitScript(() => {
      try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* storage blocked */ }
    });
    await tp.goto("file://" + dist);
    const load = async (file, name) => {
      await tp.setInputFiles("#fileInput", file);
      await tp.waitForFunction((n) => (document.querySelector("#hName")?.textContent || "").includes(n), name);
      await tp.waitForTimeout(150);
    };
    const tab = async (name) => { await tp.evaluate((n) => document.querySelector(`[data-tab="${n}"]`).click(), name); await tp.waitForTimeout(120); };
    /* Instrumententafel 4: im Bereich Kampf ist der Zeitverlauf (Spuren, Zoom, Von/bis) zugeklappt; folgt Aufgabe 10
       (Nachtrag 29.09.): er steht im Bereich Rotation, der Knopf "Zeitverlauf und Rotation" im Kampf fuehrt hin */
    const zeitAuf = async () => { await tp.evaluate(() => document.querySelector("#spurenAuf").click()); await tp.waitForTimeout(120); };
    const text = (sel) => tp.evaluate((s) => document.querySelector(s)?.textContent || "", sel);

    /* 7b \u00b7 Analyse, Issue #38: unter 20 Treffern kein Urteil - wie der Kopf.
       Ein Wolf mit 11 Treffern (3 kritisch, 6 stark) und einem Fehlschlag;
       danach ein Wolf mit 25 Treffern, davon 6 stark: die Anzahl ganzzahlig. */
    const wolfLog = (name, n, stark) => {
      const rows = [];
      for (let k = 0; k < n; k++) {
        const crit = k % 4 === 1 ? 1 : 0, heavy = stark(k) ? 1 : 0;
        rows.push(`${stamp(at(23, 20, 0) + k * 1000)},DamageDone,Quick Fire,964762401,${1000 * (1 + (k % 5))},${crit},${heavy},kNormalHit,Tester,Frost Wolf`);
      }
      rows.push(`${stamp(at(23, 20, 0) + 500)},DamageDone,Quick Fire,964762401,0,0,0,kMiss,Tester,Frost Wolf`);
      const f = join(work, name);
      writeFileSync(f, ["CombatLogVersion,4", ...rows].join("\n") + "\n");
      return f;
    };
    const analyse = () => tp.evaluate(() => ({
      call: document.querySelector("#analysisCall").textContent,
      ruhig: document.querySelector("#analysisCall").classList.contains("ruhig"),
      // #414 (B2): der Haelftensatz steht unter dem Satz des Bereichs (#a2haelften), nicht mehr unter dem Kampfstreifen
      verdict: document.querySelector("#a2haelften")?.hidden !== false ? "" : document.querySelector("#a2haelften").textContent,
      alles: document.querySelector("#p-analysis").innerText,
    }));
    await load(wolfLog("wolf-duenn.txt", 11, (k) => k % 2 === 0), "Frost Wolf");
    await tab("analysis");
    let an = await analyse();
    assert(an.ruhig && an.call.includes("11 Treffer") && an.call.includes("ab 20"),
      "duenn: ruhiges Urteil nennt Trefferzahl und Schwelle", an.call);
    assert(!an.alles.includes("Art deiner Skillung"), "duenn: keine Art der Skillung", an.alles);
    assert(!/Hälfte/.test(an.verdict + an.alles), "duenn: kein Haelftenvergleich", an.verdict);
    assert(!/\d,\d/.test(an.alles.replace(/\d+:\d+/g, "")), "duenn: keine Anzahl mit Nachkommastelle (kein \"6,0\")", an.alles);
    assert(/11 Treffer/.test(an.alles) && /3 kritisch/.test(an.alles) && /6 stark/.test(an.alles) && /1 verfehlt/.test(an.alles),
      "duenn: nur die Zaehlungen stehen, als ganze Zahlen", an.alles);
    assert(!/Wie viele Treffer waren kritisch|der Treffer|Fehlschläge,/.test(an.alles),
      "duenn: keine Anteilsbefunde", an.alles);
    await load(wolfLog("wolf-voll.txt", 25, (k) => k < 6), "Frost Wolf");
    await tab("analysis");
    an = await analyse();
    assert(an.alles.includes("6 von 25 Treffern waren stark"), "ab 20: Anzahl starker Treffer ganzzahlig", an.alles);
    assert(!an.call.includes("Zu wenige Treffer"), "ab 20: das gewoehnliche Urteil", an.call);

    /* 7c \u00b7 Analyse und Zeitverlauf, Issue #37: Unverwundbarkeit ist Mechanik,
       keine Leerzeit. Deus Chimaerus, 135 s: alle 0,5 s Schnellfeuer, alle
       10 s Detonationsmal; 57-95 s (38 s) ist jeder Treffer kInvincible.
       "mitMal": in der Phase genau ein Detonationsmal (60 s), sonst dort nur
       Schnellfeuer. */
    const deusLog = (name, mitMal) => {
      const rows = [];
      for (let k = 0; k * 500 <= 135000; k++) {
        const t = k * 500, inv = t >= 57000 && t <= 95000;
        const mal = t % 10000 === 0 && (!inv || (mitMal && t === 60000));
        const [skill, sid] = mal ? DM : QF;
        const dmg = mal ? 20000 : 1000 * (1 + (k % 5));
        rows.push(`${stamp(at(24, 21, 0) + t)},DamageDone,${skill},${sid},${dmg},0,0,${inv ? "kInvincible" : "kNormalHit"},Tester,Deus Chimaerus`);
      }
      const f = join(work, name);
      writeFileSync(f, ["CombatLogVersion,4", ...rows].join("\n") + "\n");
      return f;
    };
    /* Neugestaltung 28.09., Aufgabe 5 (folgt Entwurf): die Befunde stehen unter "Weitere Befunde";
       die Leerzeit heisst dort "Luecken ab 2 s" (Anzahl, die Summe darunter) und zaehlt nach dem Median */
    // #414 (B2): was keine .find mehr ist, steht als Satz in der Analyse (unter Gut hier, Besser moeglich, am Opener, unter der Legende, unter dem Satz des Bereichs);
    // befunde() liest beides, damit die Proben unten nicht an einer leeren Quelle immer wahr sind
    const befunde = () => tp.evaluate(() => {
      const ohne = (e) => { const c = e.cloneNode(true); c.querySelectorAll("button").forEach((b) => b.remove()); return c.textContent.trim(); };
      const alt = [...document.querySelectorAll("#p-analysis .find")]
        .map((f) => f.querySelector(".k").textContent + " | " + f.querySelector(".v").textContent +
          (f.querySelector(".n") ? " | " + f.querySelector(".n").textContent : ""));
      const neu = [...document.querySelectorAll("#a2gut li[data-k], #a2besser li[data-k]")].map((li) => {
        const t = ohne(li), m = /^(Schwächste drei Sekunden) (.*)$/.exec(t);
        return m ? m[1] + " | " + m[2] : li.dataset.k + " | " + t;
      });
      for (const [sel, k] of [["#a2unv", "Ziel unverwundbar"], ["#a2start", "Start"], ["#a2haelften", "Hälften"]]) {
        const e = document.querySelector(sel);
        if (e && !e.hidden) neu.push(k + " | " + ohne(e));
      }
      return alt.concat(neu);
    });
    await load(deusLog("deus-ohne.txt", false), "Deus Chimaerus");
    await tab("analysis");
    an = await analyse();
    let bf = await befunde();
    assert(!/unverwundbar/i.test(an.call), "Unverwundbar: nie das Urteil oben", an.call);
    /* Die Dauer der Phase steht seit der Beschriftung des Bandes einmal im
       Bild ("Ziel unverwundbar \u00b7 38,0 s", unten geprueft) - genau diese eine
       Stelle faellt aus der Suche heraus, sonst keine. */
    const ohneBand = an.alles.replace("Ziel unverwundbar \u00b7 38,0\u00a0s", "");
    /* Fixrunde 1 zu Aufgabe 5 (folgt Entwurf, Pruefung Befund 8): "was war los" stammte aus dem entfallenen
       Leerzeit-Befund - jetzt: in der Phase 57-95 s liegt kein Band einer Luecke, die Saeulen nennen keine */
    const phaseForm = await tp.evaluate(() => ({ zonen: [...document.querySelectorAll("#a2kurve .gapz")].map((z) => z.dataset.zeit),
      label: document.querySelector("#a2beschr")?.textContent || "" }));
    assert(!/39,1|38,\d/.test(ohneBand) && phaseForm.zonen.length === 0 && phaseForm.label.includes("keine Lücken"),
      "Unverwundbar: keine Luecke aus der Phase, die Zeitleiste sagt „keine Lücken“", { phaseForm, alles: an.alles.slice(0, 300) });
    // #109: die Beschreibung nennt die Strecke, die im Bild steht
    assert(phaseForm.label.endsWith("; Ziel unverwundbar 0:57\u20131:35"), "#109: die Beschreibung der Zeitleiste nennt die unverwundbare Strecke mit Zeit", phaseForm.label);
    assert(bf.some((b) => b === "Lücken ab 2\u00a0s | keine"), "Unverwundbar: keine Luecke", bf);
    // folgt Entwurf (Pruefung Befund 8): der Satz unter der Form nennt keine Luecke und keine Pause
    // seit #106 darf der Satz fehlen (kein Krit, kein Haelftensatz beim 1,0-fachen) - steht er, nennt er keine Luecke
    assert(!/Lücke|Pause|ohne Treffer/.test(an.verdict) && phaseForm.zonen.length === 0,
      "Unverwundbar: die Form zeigt keine Leerzeit - kein Band, kein Wort im Satz darunter", { verdict: an.verdict, phaseForm });
    // kein Satz heisst seit #106: unter dem 1,15-fachen
    const faktor = Number((/(\d+,\d)-fachen/.exec(an.verdict) || [0, "1,0"])[1].replace(",", "."));
    assert(faktor < 1.3, "Unverwundbar: der Haelftenvergleich rechnet ohne die Phase", an.verdict);
    // Fixrunde 1 zu Aufgabe 5 (Pruefung Befund 2): der Satz steht jetzt sichtbar dabei - geprueft werden wie vorher Begriff und Wert
    assert(!/Burst/.test(bf.map((b) => b.split(" | ").slice(0, 2).join(" | ")).join()), "Unverwundbar: die Phase macht die Skillung nicht zu Burst", bf);
    const schwach = /Schwächste[^|]*\| (\d+):(\d+)/.exec(bf.join("\n"));
    const schwachAb = schwach ? +schwach[1] * 60 + +schwach[2] : -1;
    assert(!schwach || schwachAb + 3 <= 57 || schwachAb >= 95, "Unverwundbar: die schwaechste Stelle liegt nicht in der Phase", bf);
    assert(!bf.some((b) => /unverwundbare Ziel/.test(b)), "ohne Einsatz in der Phase: kein Befund, nur das Band", bf);
    const form = await tp.evaluate(() => ({
      gap: !!document.querySelector("#a2legende .lp"), inv: !!document.querySelector("#a2legende .lu"),
      text: document.querySelector("#a2legende .lu")?.parentElement.textContent || "",
    }));
    assert(form.inv && !form.gap && form.text === "Ziel unverwundbar", "Form: Legende \"Ziel unverwundbar\", keine Pause", form);
    await tab("timeline");
    await zeitAuf();
    const band = await tp.evaluate(() => {
      const probe = (v) => { const s = document.createElement("span"); s.style.color = `var(${v})`; document.body.append(s);
        const c = getComputedStyle(s).color; s.remove(); return c; };
      const key = document.querySelector("#stackGut .bandkey");
      const bk = key?.querySelector(".bk.invuln");
      const cv = document.querySelector("#stack"), r = cv.getBoundingClientRect();
      // die Mitte der Phase (76 s von 135 s), halb hoch in der Kurve; der Rand links und rechts 24 wie die Zeitleiste (Aufgabe 10, vorher 14 und 16)
      const q = cv.width / r.width, x = Math.round((24 + (76 / 135) * (r.width - 48)) * q), y = Math.round(r.height * 0.45 * q);
      const px = [...cv.getContext("2d").getImageData(x, y, 1, 1).data];
      return { key: key?.textContent || "", farbe: bk ? getComputedStyle(bk).backgroundColor : "",
               neg: probe("--neg"), gap: probe("--gap-band"), token: probe("--invuln-band"), px };
    });
    assert(band.key.includes("Ziel unverwundbar") && !band.key.includes("ohne Treffer"),
      "Zeitverlauf: die Bandlegende nennt \"Ziel unverwundbar\", nicht \"ohne Treffer\"", band.key);
    assert(band.farbe === band.token && band.farbe !== band.neg && band.farbe !== band.gap,
      "Zeitverlauf: das Band traegt sein eigenes Token, nicht --neg und nicht die Pausenfarbe", band);
    // das Pausenband liegt bei Rot 224 zu Gruen 100; ein neutrales Grau hat beide fast gleich
    assert(band.px[3] > 0 && Math.abs(band.px[0] - band.px[1]) < 30,
      "Zeitverlauf: in der Phase ist das Bild getoent, und ohne Rotstich", band.px);
    /* Issue #37: jeder Legendeneintrag ist Muster und Wort auf einer Zeile -
       "Ziel unverwundbar" stand am Zeilenende, "schwaechste 3 s" darunter,
       getrennt von seinem Kaestchen. Im Zeitverlauf und in der Form, bei 1280
       und bei 560 px. Die Rotation hat keine Bandlegende. */
    const legende = () => tp.evaluate(() => [...document.querySelectorAll("#stackGut .bandkey .bke, #a2legende > span")]
      .filter((e) => e.offsetParent && !e.hidden).map((e) => {
        const kasten = e.querySelector("i, svg").getBoundingClientRect();
        const zeilen = [], lauf = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        for (let n = lauf.nextNode(); n; n = lauf.nextNode()) {
          if (!n.textContent.trim()) continue;
          const r = document.createRange(); r.selectNodeContents(n);
          zeilen.push(...[...r.getClientRects()].map((q) => [Math.round(q.top), Math.round(q.bottom)]));
        }
        const oben = Math.min(...zeilen.map((z) => z[0])), unten = Math.max(...zeilen.map((z) => z[1]));
        return { text: e.textContent, zeilen: zeilen.length,
                 zusammen: zeilen.length === 1 && kasten.bottom > oben && kasten.top < unten };
      }));
    for (const breite of [1280, 560]) {
      await tp.setViewportSize({ width: breite, height: 860 });
      await tp.waitForTimeout(300);
      const zv = await legende();
      assert(zv.length === 2 && zv.every((l) => l.zusammen),
        `Zeitverlauf ${breite}: jeder Legendeneintrag hat Kaestchen und Text auf einer Zeile`, zv);
      await tab("analysis");
      const fo = await legende();
      assert(fo.some((l) => l.text.includes("Ziel unverwundbar")) && fo.every((l) => l.zusammen),
        `Zeitleiste ${breite}: jeder Legendeneintrag hat Kaestchen und Text auf einer Zeile`, fo);
      assert(await tp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `Form ${breite}: kein waagerechtes Rollen`);
      await tab("timeline");
      await zeitAuf();
    }
    await tp.setViewportSize({ width: 1280, height: 860 });
    await tp.waitForTimeout(300);
    await load(deusLog("deus-mit.txt", true), "Deus Chimaerus");
    await tab("analysis");
    bf = await befunde();
    // #414 (B2): der Einsatz ins unverwundbare Ziel steht als leiser Satz unter der Legende der Zeitleiste (#a2unv), genau einmal
    const leise = await tp.evaluate(() => [...document.querySelectorAll("#p-analysis *")].filter((e) => !e.children.length && /unverwundbare Ziel/.test(e.textContent)).map((e) => e.id + ": " + e.textContent.trim()));
    // Fixrunde 1 zu Aufgabe 5 (Pruefung Befund 2, Befund 4): mit dem sichtbaren Satz, der sagt, dass die Strecke weder Pause noch Luecke ist
    await themen(["#a2unv"], "Satz zum unverwundbaren Ziel", tp);
    assert(leise.length === 1 && /^a2unv: 1 Einsatz von Detonierendes Mal ging ins unverwundbare Ziel \(0:57\u20131:35\)\. Die Strecke selbst steht im Zeitverlauf als Band und zählt weder als Pause noch als Lücke\.$/.test(leise[0]),
      "ein Detonationsmal in der Phase: genau ein leiser Satz", leise);
    assert(!/unverwundbar/i.test((await analyse()).call), "mit Einsatz: trotzdem nicht das Urteil oben", (await analyse()).call);

    /* Freie Zeilen: je Eintrag [ms, Faehigkeit, Ziel, unverwundbar?]; Schnellfeuer
       in fuenf Schadensstufen, Detonationsmal 20000. */
    const freiLog = (name, zeilen) => {
      const rows = zeilen.sort((a, b) => a[0] - b[0]).map(([t, [skill, sid], ziel, inv], k) =>
        `${stamp(at(25, 21, 0) + t)},DamageDone,${skill},${sid},${skill === DM[0] ? 20000 : 1000 * (1 + (k % 5))},0,0,${inv ? "kInvincible" : "kNormalHit"},Tester,${ziel}`);
      const f = join(work, name);
      writeFileSync(f, ["CombatLogVersion,4", ...rows].join("\n") + "\n");
      return f;
    };
    // Grundmuster wie oben: alle 0,5 s Schnellfeuer, alle 10 s Detonationsmal; `wie(t)` sagt, was mit der Zeile geschieht
    const muster2 = (wie) => {
      const z = [];
      for (let t = 0; t <= 135000; t += 500) {
        const sk = t % 10000 === 0 ? DM : QF;
        for (const [ziel, inv] of wie(t, sk)) z.push([t, sk, ziel, inv]);
      }
      return z;
    };
    const DEUS = "Deus Chimaerus", ADD = "Flame Add";
    const phase = (t) => t >= 57000 && t <= 95000;
    const legenden = async () => {
      const form = await tp.evaluate(() => !!document.querySelector("#a2legende .lu"));
      await tab("timeline");
      await zeitAuf();
      const key = await text("#stackGut .bandkey");
      await tab("analysis");
      return { form, key };
    };

    // Flaechenangriff: in der Phase trifft jeder Einsatz den unverwundbaren Boss UND ein verwundbares Add
    await load(freiLog("deus-aoe.txt", muster2((t) => phase(t) ? [[DEUS, true], [ADD, false]] : [[DEUS, false]])), DEUS);
    await tab("analysis");
    bf = await befunde();
    let lg = await legenden();
    assert(!lg.form && !lg.key.includes("Ziel unverwundbar"),
      "Flaechenangriff aufs Add: kein Band ueber gelandetem Schaden", lg);
    assert(!bf.some((b) => /unverwundbare Ziel/.test(b)), "Flaechenangriff: kein Befund, das Add nahm den Schaden", bf);
    assert(bf.some((b) => b === "Lücken ab 2\u00a0s | keine"), "Flaechenangriff: keine Luecke", bf);

    // Das eine Detonationsmal der Phase (60 s) trifft auch das Add: Band ja, Befund nein
    await load(freiLog("deus-mal-add.txt", muster2((t, sk) =>
      !phase(t) ? [[DEUS, false]] : t === 60000 ? [[DEUS, true], [ADD, false]] : sk === DM ? [] : [[DEUS, true]])), DEUS);
    await tab("analysis");
    bf = await befunde();
    lg = await legenden();
    assert(lg.form && lg.key.includes("Ziel unverwundbar"), "Mal auch aufs Add: die Phase bleibt ein Band", lg);
    assert(!bf.some((b) => /unverwundbare Ziel/.test(b)), "Mal auch aufs Add: kein Befund fuer eine Faehigkeit, die auch normal traf", bf);

    /* Zwei Strecken und zwei echte Pausen: 50-54 s nichts, 54-70 s unverwundbar,
       80-90 s unverwundbar, 90-95 s nichts bis auf einen einzelnen Treffer aufs
       Unverwundbare bei 92,5 s - ein Punkt, der die Pause nicht teilt. Die
       Baender der Form nennen genau die zwei. */
    await load(freiLog("deus-zwei.txt", muster2((t) =>
      t === 92500 ? [[DEUS, true]]
        : (t > 50000 && t < 54000) || (t > 90000 && t < 95000) ? []
        : (t >= 54000 && t < 70000) || (t >= 80000 && t <= 90000) ? [[DEUS, true]] : [[DEUS, false]])), DEUS);
    await tab("analysis");
    bf = await befunde();
    /* folgt Entwurf (Luecken 4.3/4.5): die Luecken nach dem Median in ganzen Sekunden - 51-54 s ohne
       Treffer (vorher gemessen ab dem letzten Treffer bei 50 s, 4 s) und 90-95 s; die Pausenliste ist
       entfallen, die Zeiten stehen an den Baendern der Form */
    const pausenText = await tp.evaluate(() => [...document.querySelectorAll("#a2kurve .gapz")].map((p) => p.dataset.zeit));
    assert(bf.some((b) => b === "Lücken ab 2\u00a0s | 2 | zusammen 8\u00a0s"), "zwei Strecken: Luecken sind nur die zwei echten Pausen (3 + 5 s)", bf);
    assert(JSON.stringify(pausenText) === JSON.stringify(["0:51\u20130:54", "1:30\u20131:35"]),
      "zwei Strecken: die Bänder der Form nennen die Luecke vor dem Streckenbeginn und die nach dem Ende", pausenText);

    /* Issue #37: nicht jeder Boss wird unverwundbar. Eine grosse Luecke
       ohne jeden Treffer (Zwischenphase, der Spieler lag tot) bleibt eine
       Pause wie bisher - rotes Band mit Dauer, Leerzeit zaehlt sie. Das graue
       Band gilt nur, wo kInvincible-Treffer liegen, und traegt seine Dauer. */
    const baender = async () => {
      const form = await tp.evaluate(() => ({
        gap: !!document.querySelector("#a2legende .lp"), inv: !!document.querySelector("#a2legende .lu"),
        marken: [...document.querySelectorAll("#a2kurve .vgap")].map((m) => m.textContent) }));
      await tab("timeline");
      await zeitAuf();
      const zv = await tp.evaluate(() => {
        const cv = document.querySelector("#stack"), r = cv.getBoundingClientRect(), q = cv.width / r.width;
        // ein Punkt bei Sekunde s, halb hoch in der Kurve, wie oben
        const bei = (s) => [...cv.getContext("2d").getImageData(Math.round((24 + (s / 135) * (r.width - 48)) * q), Math.round(r.height * 0.45 * q), 1, 1).data];
        return { key: document.querySelector("#stackGut .bandkey")?.textContent || "", px: { s27: bei(27.5), s72: bei(72), s76: bei(76) } };
      });
      await tab("analysis");
      return { ...form, ...zv };
    };
    const roetlich = (p) => p[3] > 0 && p[0] - p[1] > 30, grau = (p) => p[3] > 0 && Math.abs(p[0] - p[1]) < 30;
    // eine Luecke von 30 s (56,5-86,5 s) ganz ohne Treffer, kein kInvincible
    await load(freiLog("deus-luecke.txt", muster2((t) => t > 56500 && t < 86500 ? [] : [[DEUS, false]])), DEUS);
    await tab("analysis");
    bf = await befunde();
    let bd = await baender();
    // folgt Entwurf: in ganzen Sekunden ohne Treffer, 57-86 s (vorher von Treffer zu Treffer 30,0 s)
    assert(bf.some((b) => b === "Lücken ab 2\u00a0s | 1 | zusammen 29\u00a0s"), "Luecke ohne Treffer: die Luecken zaehlen sie (29 s)", bf);
    assert(bd.gap && !bd.inv && JSON.stringify(bd.marken) === JSON.stringify(["29\u00a0s"]),
      "Luecke ohne Treffer: in der Form ein Pausenband mit Dauer, kein \"Ziel unverwundbar\"", bd);
    assert(bd.key.includes("ohne Treffer") && !bd.key.includes("Ziel unverwundbar") && roetlich(bd.px.s72),
      "Luecke ohne Treffer: im Zeitverlauf das rote Pausenband, keine Unverwundbar-Legende", bd);
    // die Phase allein (57-95 s kInvincible): das graue Band traegt, was es ist, und seine Dauer
    await load(deusLog("deus-ohne.txt", false), "Deus Chimaerus");
    await tab("analysis");
    bd = await baender();
    assert(!bd.gap && bd.inv && JSON.stringify(bd.marken) === JSON.stringify(["Ziel unverwundbar \u00b7 38,0\u00a0s"]),
      "Unverwundbar: das Band sagt \"Ziel unverwundbar \u00b7 38,0 s\"", bd);
    // beides: 20-35 s nichts (15 s), 57-95 s unverwundbar
    await load(freiLog("deus-beides.txt", muster2((t) =>
      t > 20000 && t < 35000 ? [] : phase(t) ? [[DEUS, true]] : [[DEUS, false]])), DEUS);
    await tab("analysis");
    bf = await befunde();
    bd = await baender();
    // folgt Entwurf: 21-35 s in ganzen Sekunden (vorher von Treffer zu Treffer 15,0 s)
    assert(bf.some((b) => b === "Lücken ab 2\u00a0s | 1 | zusammen 14\u00a0s"), "beides: Luecken sind nur die Luecke ohne Treffer (14 s)", bf);
    assert(bd.gap && bd.inv && JSON.stringify(bd.marken) === JSON.stringify(["14\u00a0s", "Ziel unverwundbar \u00b7 38,0\u00a0s"]),
      "beides: in der Form zwei getrennte Baender, jedes mit seiner Dauer", bd);
    assert(bd.key.includes("ohne Treffer") && bd.key.includes("Ziel unverwundbar") && roetlich(bd.px.s27) && grau(bd.px.s76),
      "beides: im Zeitverlauf rot in der Luecke, grau in der Phase", bd);

    // Unter 20 Treffern: kein Befund, auch mit Detonationsmal ins Unverwundbare
    await load(freiLog("deus-duenn.txt", [
      ...Array.from({ length: 15 }, (_, k) => [k * 1000 + (k >= 5 ? 4000 : 0), QF, DEUS, false]),
      [5000, QF, DEUS, true], [6000, DM, DEUS, true], [7000, QF, DEUS, true], [8000, QF, DEUS, true]]), DEUS);
    await tab("analysis");
    an = await analyse();
    assert(an.ruhig && !/unverwundbare Ziel/.test(an.alles), "unter 20 Treffern: kein Unverwundbarkeits-Befund", an.alles);
    assert(!tErrors.length, "aus test-trainer-page: keine Fehler in der Seite", tErrors);
    await tp.close();
  }

  /* --- 10 \u00b7 aus test-trainer-page.mjs Nr. 9, Neugestaltung 28.09.: der
     Bezug innerhalb eines Builds (bauBezug, 46-best-pull.ts). Der Trainer
     entfaellt, die Wahl des Bezugs bleibt - Fenster und Start der Analyse
     vergleichen so (53-fenster.ts). Zwei Builds an Vulcanus: je Runde so
     viele Treffer einer Faehigkeit; sechs mit Gewicht 4 sind die tragenden.
     LB: Langbogen (16) und Armbrust (12). DA: Dolch (16) und Armbrust (12).
     Im schwaecheren zweiten Dolch-Kampf fehlt Toedliches Stigma ab 20 s jeder
     zweite Einsatz. Der beste Pull an Vulcanus ist der Langbogen-Kampf. */
  {
    const BS = ["Blade Storm", 945408027];
    const BR = ["Brutal Arrow", 945725019], FL = ["Flash Arrow", 945731619];
    const AV = ["Arrow Vortex", 945743775], AG = ["Agile Shot", 944723371];
    const FS = ["Fatal Stigma", 939780553], TS = ["Thunder Spirit", 940580872], VS = ["Vampiric Strike", 940620545];
    const LT = ["Lightning Throw", 940614453], MS = ["Mad Sword Dance", 940624689];
    const muster = (gewichte) => gewichte.flatMap(([s, n]) => Array(n).fill(s));
    const LB = muster([[QF, 4], [DM, 4], [BS, 4], [ST, 4], [BR, 4], [FL, 4], [AG, 2], [AV, 2]]);
    const DA = muster([[QF, 4], [DM, 4], [BS, 4], [FS, 4], [TS, 4], [VS, 4], [LT, 2], [MS, 2]]);
    const bauLog = (name, pulls) => {
      const rows = [];
      for (const p of pulls) {
        for (let k = 0; k * 500 < p.secs * 1000; k++) {
          const [skill, sid] = p.bau[k % p.bau.length];
          if (p.ohne && p.ohne(skill, k * 500)) continue;
          const dmg = Math.round(1000 * p.scale * (1 + (k % 5)));
          rows.push(`${stamp(p.start + k * 500)},DamageDone,${skill},${sid},${dmg},0,0,kNormalHit,Tester,Vulcanus`);
        }
      }
      const f = join(work, name);
      writeFileSync(f, ["CombatLogVersion,4", ...rows].join("\n") + "\n");
      return f;
    };
    const VB = (bau, day, m, scale, ohne) => ({ bau, start: at(day, 21, m), secs: 80, scale, ohne });
    const BAU_LB = bauLog("bau-lb.txt", [VB(LB, 20, 0, 1.3)]);
    const BAU_DA1 = bauLog("bau-da1.txt", [VB(DA, 21, 0, 1.0)]);
    const BAU_DA2 = bauLog("bau-da2.txt", [VB(DA, 22, 0, 1.2), VB(DA, 22, 10, 1.0, (s, t) => s === "Fatal Stigma" && t >= 20000 && t % 1000 === 0)]);
    // derselbe Build mit Beschuss (Armbrust) als staerkster Faehigkeit: der gespeicherte Dolch-Pull kennt sie nicht
    const BAU_DA3 = bauLog("bau-da3.txt", [VB(muster([[ST, 8]]).concat(DA), 23, 0, 1.0)]);
    /* Abstand gegen den zweitbesten Pull: der beste Dolch-Kampf (21:00, 90 s) ist hinten stark
       (45 s mit 0,7, dann 45 s mit 2,1, im Schnitt 1,4); der zweitbeste (21:10, 50 s, 1,25)
       liegt ueber die gemeinsamen 50 s vorn - dort waechst der Rueckstand des besten. */
    const BAU_DA4 = bauLog("bau-da4.txt", [{ bau: DA, start: at(24, 21, 0), secs: 45, scale: 0.7 },
      { bau: DA, start: at(24, 21, 0) + 45000, secs: 45, scale: 2.1 }, { bau: DA, start: at(24, 21, 10), secs: 50, scale: 1.25 }]);

    const q = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const qErrors = [];
    q.on("pageerror", (e) => qErrors.push(String(e)));
    await q.addInitScript(() => {
      try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* storage blocked */ }
    });
    await q.goto("file://" + dist);
    const qLoad = async (file) => {
      await q.setInputFiles("#fileInput", file);
      await q.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"));
      await q.waitForTimeout(150);
    };
    const qTab = async (name) => { await q.evaluate((n) => document.querySelector(`[data-tab="${n}"]`).click(), name); await q.waitForTimeout(120); };
    // die Start-Zeile im Rhythmus: Wert, Bezug (bester/zweitbester Pull) und dessen Wert
    const qStart = () => q.evaluate(() => {
      // #414 (B2): der Start steht als Satz unter dem Opener (#a2start)
      const f = document.querySelector("#a2start");
      if (!f || f.hidden) return null;
      const c = f.cloneNode(true); c.querySelectorAll("button").forEach((b) => b.remove());
      const tx = c.textContent.trim();
      const m = /^(?:Die ersten|The first) 10\u00a0s: (\S+) \u00b7 (bester Pull|zweitbester Pull|best pull|second best pull) (\S+) \u00b7 /.exec(tx);
      return { v: m ? m[1] : "", bp: m ? m[2] : "", x: m ? m[3] : "", n: tx };
    });
    const alles = () => q.evaluate(() => document.querySelector("#p-analysis").innerText);
    // Kampf waehlen: der Reihe nach in der Liste (0 der neueste)
    const waehle = async (i) => { await q.evaluate((k) => document.querySelectorAll("#fightList .fight")[k].click(), i); await q.waitForTimeout(150); };

    // der Geist des besten Pulls (#218, Task 10): Kennzeile, gestrichelte Kurve, Spiegel und Tabelle
    /* Ein Weg, eine Zahl (Entscheidung 11.11.2026): die Tafel ruft das Urteil wie die Analyse mit dem besten Pull auf (56). Zeigt die Tafel einen
       Urteilssatz (ohne Bezug mit Lauf; mit einem zeigt sie ihren Vergleich), ist es derselbe wie in der Analyse. Gesammelt an jedem Kampf
       dieses Blocks, am Ende geprueft. Diese Kaempfe haben alle einen Bezug mit Lauf und zeigen darum den Vergleich; den Fall mit Geist UND
       Urteilssatz (der beste Pull liegt nur im Verlauf, ein Pull desselben Builds hat einen Lauf) prueft test-best-page ("ohne Lauf, mit Pull
       desselben Builds"), samt Gegenprobe ohne den Aufruf mit Geist. */
    const uSaetze = [];
    const uSatz = async (wo) => {
      const lies = (sel) => q.evaluate((x) => { const e = document.querySelector(x)?.cloneNode(true); e?.querySelectorAll("button").forEach((k) => k.remove()); return (e?.textContent || "").trim(); }, sel);
      const analyse = { uv: await lies("#analysisCall .uv"), un: await lies("#analysisCall .un") };
      const geist = await q.evaluate(() => !!document.querySelector("#a2kurve path.a2geist"));
      // die Tafel zeichnet ihr Urteil nur im Bereich Kampf (tafelGilt, 56): dorthin, lesen, zurueck
      await q.evaluate(() => document.querySelector('[data-tab="timeline"]').click());
      await q.waitForFunction(() => !!document.querySelector("#urteilInhalt .uv, #urteilInhalt .usatz"), null, { timeout: 5000 }).catch(() => {});
      const tafel = { uv: await lies("#urteilInhalt .uv"), un: await lies("#urteilInhalt .un"), vergleich: await q.evaluate(() => !!document.querySelector("#urteilInhalt .ubezug")) };
      await q.evaluate(() => document.querySelector('[data-tab="analysis"]').click());
      await q.waitForFunction(() => !!document.querySelector("#analysisCall .uv"), null, { timeout: 5000 }).catch(() => {});
      uSaetze.push({ wo, geist, analyse, tafel });
    };
    const geist = () => q.evaluate(() => {
      const g = document.querySelector('#wbKenn .find[data-k="gegenBest"]');
      return { v: g?.querySelector(".v")?.textContent || "", n: g?.querySelector(".n")?.textContent || "",
        pfad: !!document.querySelector("#a2kurve path.a2geist"), label: document.querySelector("#a2beschr")?.textContent || "" };
    });
    /* #414 (Inventur O9): die Tabelle dieser Pull gegen den besten Pull steht aufklappbar an der ersten Karte (der staerksten
       Faehigkeit); aufklappen und lesen: Spaltenkoepfe, je Zeile die Zellen. Die gespiegelten Striche der Werkbank entfallen. */
    const tabelle = async () => {
      await q.evaluate(() => { const d = document.querySelector(".a2karte .a2vgl"); if (d) d.open = true; });
      await q.waitForTimeout(150);
      return q.evaluate(() => {
        const t = document.querySelector(".a2karte .a2vgl .wbvgl");
        if (!t) return null;
        return { kopf: [...t.querySelectorAll("thead th")].map((x) => x.textContent.trim()),
          zeilen: [...t.querySelectorAll("tbody tr")].map((r) => [...r.children].map((x) => x.textContent.trim())),
          fein: [...document.querySelectorAll(".a2karte .a2vgl .wbfein")].map((x) => x.textContent).join(" ") };
      });
    };
    // der beste Pull: Langbogen + Armbrust
    await qLoad(BAU_LB);
    await qTab("analysis");
    const gLb = await geist();
    // Abschlusspruefung I1: der Kampf ist selbst ein Pull mit diesen Waffen - "noch kein Pull" waere falsch
    assert(gLb.v === "–" && gLb.n === "dein erster Pull an Vulcanus" && !gLb.pfad && !/gestrichelt/.test(gLb.label),
      "Geist: der erste Pull sagt „dein erster Pull an …“ und zeigt keinen Geist", gLb);
    await q.evaluate(() => document.querySelector("#btnLang").click());
    await q.waitForTimeout(150);
    const gLbEn = await geist();
    assert(gLbEn.v === "–" && gLbEn.n === "your first pull on Vulcanus" && !gLbEn.pfad,
      "Geist: Englisch - der erste Pull sagt „your first pull on …“", gLbEn);
    await q.evaluate(() => document.querySelector("#btnLang").click());
    await q.waitForTimeout(150);
    // ein schwaecherer Kampf mit Dolch + Armbrust: kein Pull desselben Builds - kein Bezug, auch nicht der Langbogen
    await qLoad(BAU_DA1);
    await qTab("analysis");
    const da1 = await qStart();
    const da1Text = await alles();
    assert(da1 === null && !/bester Pull|zweitbester Pull/.test(da1Text),
      "anderer Build: keine Start-Zeile und kein Vergleichswert gegen den besten Pull aus dem Langbogen-Build", { da1, text: da1Text.slice(0, 600) });
    const gDa1 = await geist();
    assert(gDa1.v === "–" && /^noch kein Pull mit diesen Waffen an Vulcanus/.test(gDa1.n) && !gDa1.pfad,
      "Geist: erster Dolch-Pull, kein Geist aus dem Langbogen-Build", gDa1);
    // zwei Dolch-Kaempfe im Log: der schwaechere (21:10) gegen den staerkeren desselben Builds (21:00)
    await qLoad(BAU_DA2);
    await qTab("analysis");
    await waehle(0);
    await qTab("analysis");
    const spaet = await qStart();
    await waehle(1);
    await qTab("analysis");
    const frueh = await qStart();
    assert(!!spaet && spaet.bp === "bester Pull" && !!frueh && spaet.x === frueh.v,
      "zweiter Dolch-Kampf: Bezug ist der beste Pull desselben Builds (22.09. 21:00), nicht der Langbogen", { spaet, frueh });
    // der beste Dolch-Kampf selbst: gegen den zweitbesten desselben Builds, nicht gegen den Langbogen
    assert(!!frueh && frueh.bp === "zweitbester Pull" && frueh.x === spaet?.v,
      "bester Dolch-Kampf: gegen den zweitbesten desselben Builds (22.09. 21:10), die Zeile sagt zweitbester", { frueh, spaet });
    // Englisch: derselbe Bezug
    await q.evaluate(() => document.querySelector("#btnLang").click());
    await q.waitForTimeout(150);
    const fruehEn = await qStart();
    assert(!!fruehEn && fruehEn.bp === "second best pull" && fruehEn.x.replace(/\D/g, "") === (frueh?.x || "-").replace(/\D/g, ""),
      "Englisch: derselbe Bezug, der zweitbeste desselben Builds", fruehEn);
    await q.evaluate(() => document.querySelector("#btnLang").click());
    await q.waitForTimeout(150);
    // der schwaechere Dolch-Kampf gegen den staerkeren desselben Builds
    await waehle(0);
    await qTab("analysis");
    const gSpaet = await geist();
    await uSatz("Spaet");
    assert(/^[−+]\d+,\d %$/.test(gSpaet.v) && gSpaet.v.startsWith("−") && /^\S+ am 22\.09\.$/.test(gSpaet.n),
      "Geist: zweiter Pull desselben Builds, gegen den besten mit Vorzeichen und %, Wert am Tag", gSpaet);
    assert(gSpaet.pfad && /gestrichelt dein bester Pull vom 22\.09\./.test(gSpaet.label),
      "Geist: gestrichelte Kurve path.wbgeist, im Namen des Bildes beschrieben", gSpaet);
    const abst = await q.evaluate(() => {
      // #414 (B2, Inventur O5): der Satz steht unter "Besser möglich", mit dem Weg in die Rotation und dem in die Zeitleiste
      const e = document.querySelector('#a2besser li[data-k="abstand"]');
      const k = e?.querySelector("button.inzeit");
      const von = Number(k?.dataset.von), bis = Number(k?.dataset.bis);
      const n = (e?.textContent || "");
      if (k) k.click();
      const uhr = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
      return { e: !!e, von, bis, n, weg: !!e?.querySelector("button.inrot"), zeit: !!k, zeitLabel: k?.getAttribute("aria-label") || "", bereich: document.querySelector("#a2bereichZeit")?.textContent || "", erwartet: e ? uhr(von) + "–" + uhr(bis) : "" };
    });
    assert(abst.e && abst.zeit && abst.bis - abst.von === 15 && /Rückstand zum besten Pull/.test(abst.n) && abst.weg && /^Die Strecke \d+:\d\d–\d+:\d\d in der Zeitleiste zeigen$/.test(abst.zeitLabel) && abst.bereich.startsWith(abst.erwartet + " ·"),
      "Geist: der Satz „Rückstand wuchs“ mit 15 s unter Besser möglich, Weg in die Rotation und Weg in die Zeitleiste (die 15 s werden der Bereich)", abst);
    await q.evaluate(() => document.querySelector("#a2ganz")?.click());
    const tSpaet = await tabelle();
    assert(!!tSpaet && tSpaet.kopf.some((x) => /^bester Pull$/i.test(x)) && tSpaet.kopf.some((x) => /^dieser Pull$/i.test(x)),
      "Geist: die Karte mit der Tabelle „dieser Pull“ gegen „bester Pull“ (#414)", tSpaet);
    // der beste Dolch-Kampf: der Geist ist der zweitbeste
    await waehle(1);
    await qTab("analysis");
    const gFrueh = await geist();
    await uSatz("Frueh");
    assert(gFrueh.v.startsWith("+") && /^zweitbester /.test(gFrueh.n) && gFrueh.pfad && /gestrichelt dein zweitbester Pull/.test(gFrueh.label),
      "Geist: im besten Pull selbst gegen den zweitbesten, mit +", gFrueh);
    // gespeicherter Bezug: der erste Dolch-Kampf allein; der gespeicherte zweitbeste Pull ist der Dolch-Kampf vom 22.09. 21:00
    await qLoad(BAU_DA1);
    await qTab("analysis");
    const gGesp = await geist();
    await uSatz("Gesp");
    assert(gGesp.v.startsWith("−") && gGesp.pfad && /am 22\.09\.$/.test(gGesp.n),
      "Geist: gegen den gespeicherten Pull desselben Builds", gGesp);
    const tGesp = await tabelle();
    const stark = tGesp && tGesp.zeilen.find((z) => /^Meist stark$/.test(z[0]));
    assert(!!tGesp && tGesp.kopf.some((x) => /^bester Pull$/i.test(x)) && !!stark && stark[2] === "–" && /speichert nicht/.test(tGesp.fein),
      "Geist: gespeicherter Pull - „stark“ zeigt – und sagt warum", tGesp);
    // eine Faehigkeit, die der gespeicherte Pull nicht traegt: "nicht gespeichert", nie eine Null
    await qLoad(BAU_DA3);
    await qTab("analysis");
    const gDa3 = await geist();
    await uSatz("Da3");
    const tDa3 = await tabelle();
    const haupt3 = await q.evaluate(() => document.querySelector("#a2 .a2karte")?.dataset.skill || "");
    assert(gDa3.pfad && haupt3 === "Strafing" && !!tDa3 && tDa3.kopf.some((x) => /^bester Pull$/i.test(x)) &&
      tDa3.zeilen.every((z) => z[2] === "nicht gespeichert"),
      "Geist: Faehigkeit ausserhalb des gespeicherten Pulls zeigt „nicht gespeichert“, keine Null", { gDa3, haupt3, tDa3 });
    /* #439: bei ungerader Kartenzahl bleibt am Ende eine leere Zelle; die Flaeche dahinter hat nicht die Farbe der
       Trennlinie (--hair-rule), sondern ist durchsichtig wie die Seite. Jede Linie wird genau einmal gezeichnet: Rahmen
       oben, Rahmen links, senkrechte und waagerechte Linie zwischen den Karten und ihre Kreuzung haben dieselbe Farbe
       (kein zweiter Auftrag, der sie dunkler macht). Der Test macht die Zahl ungerade (drei Karten in zwei Spalten) und
       liest Bildpunkte aus einem Bildschirmfoto. Glas bleibt wie vorher: nur der Aussenrahmen, keine inneren Linien. */
    const themaDavor = await q.evaluate(() => ({ t: document.documentElement.dataset.theme, m: document.documentElement.classList.contains("mica") }));
    const punkte = async (t) => {
      await q.setViewportSize({ width: 1280, height: 1100 }); /* die ganze Karte samt Rahmen unter dem festen Kopf im Bild */
      const g = await q.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        document.documentElement.classList.toggle("mica", t === "glas");
        const kk = document.querySelector("#a2 .a2karten");
        if (!kk) return null;
        const karten = [...kk.querySelectorAll(".a2karte")];
        karten.forEach((k, i) => { k.style.display = i < 3 ? "" : "none"; });
        kk.style.gridTemplateColumns = "repeat(2,minmax(0,1fr))";
        kk.style.scrollMarginTop = "40px"; kk.scrollIntoView({ block: "start" });
        const a = karten[0].getBoundingClientRect(), c = karten[2].getBoundingClientRect(), k0 = kk.getBoundingClientRect();
        return { n: karten.length, bg: getComputedStyle(kk).backgroundColor, ax: a.left, ay: a.top, ar: a.right, ab: a.bottom, cr: c.right, ct: c.top, ch: c.height, kr: k0.right, k1r: karten[1].getBoundingClientRect().right,
          mass: (() => { const st = getComputedStyle(kk), pa = kk.parentElement, ps = getComputedStyle(pa), pr = pa.getBoundingClientRect();
            return { hoehe: Math.round((k0.height + parseFloat(st.marginTop) + parseFloat(st.marginBottom)) - (c.bottom - a.top - 1)),
              rechts: Math.round(k0.right + parseFloat(st.marginRight) - (pr.right - parseFloat(ps.paddingRight) - parseFloat(ps.borderRightWidth))),
              links: Math.round(k0.left - parseFloat(st.marginLeft) - (pr.left + parseFloat(ps.paddingLeft) + parseFloat(ps.borderLeftWidth))) }; })() };
      }, t);
      if (!g) return null;
      const bild = (await q.screenshot()).toString("base64");
      const px = await q.evaluate(async ({ bild, p }) => {
        const bm = await createImageBitmap(await (await fetch("data:image/png;base64," + bild)).blob());
        const cv = document.createElement("canvas"); cv.width = bm.width; cv.height = bm.height;
        const cx = cv.getContext("2d"); cx.drawImage(bm, 0, 0);
        const f = Object.fromEntries(Object.entries(p).map(([k, [x, y]]) => [k, [...cx.getImageData(Math.round(x), Math.round(y), 1, 1).data].join(",")]));
        return f;
      }, { bild, p: {
        oben: [g.ax + 20, g.ay - 1], links: [g.ax - 1, g.ay + 20],
        senkrecht: [g.ar - 1, g.ay + 20], waagerecht: [g.ax + 20, g.ab - 1], kreuz: [g.ar - 1, g.ab - 1], eckeOR: [g.k1r - 1, g.ay - 1], eckeUL: [g.ax - 1, g.ab + g.ch - 1],
        leer: [g.cr + (g.kr - g.cr) / 2, g.ct + g.ch / 2] } });
      await q.evaluate(() => { document.querySelectorAll("#a2 .a2karte").forEach((k) => { k.style.display = ""; }); document.querySelector("#a2 .a2karten").style.gridTemplateColumns = ""; });
      await q.setViewportSize({ width: 1280, height: 860 });
      return { ...g, px };
    };
    /* der Rahmen oben liegt bei Bruchteilen eines Pixels nicht pixelgenau (Schatten werden nicht gerundet): 3 von 255 Toleranz;
       eine zweite Schicht laege bei etwa 18 */
    const gleich = (x, y) => x.split(",").every((v, i) => Math.abs(Number(v) - Number(y.split(",")[i])) <= 3);
    for (const thema of ["dunkel", "hell", "tnl"]) {
      const g = await punkte(thema);
      const p = g?.px;
      assert(!!p && g.n >= 3 && /rgba\(0, 0, 0, 0\)|transparent/.test(g.bg) && gleich(p.oben, p.senkrecht) && gleich(p.links, p.senkrecht) && gleich(p.waagerecht, p.senkrecht) && gleich(p.kreuz, p.senkrecht) && g.mass.hoehe === 0 && g.mass.rechts === 0 && g.mass.links === 0 && gleich(p.eckeOR, p.senkrecht) && gleich(p.eckeUL, p.senkrecht) && !gleich(p.leer, p.senkrecht),
        "#439: leere Zelle zeigt die Seite; Rahmen, Linien zwischen den Karten und Kreuzung haben dieselbe Farbe, einmal gezeichnet (" + thema + ")", g);
    }
    const gg = await punkte("glas");
    const nah = (x, y) => x.split(",").every((v, i) => Math.abs(Number(v) - Number(y.split(",")[i])) <= 2);
    assert(!!gg && nah(gg.px.senkrecht, gg.px.leer) && nah(gg.px.waagerecht, gg.px.leer) && !nah(gg.px.oben, gg.px.leer),
      "#439: Glas bleibt wie vorher: nur der Aussenrahmen, keine inneren Linien zwischen den Karten", gg);
    /* #439: die Karten rollen bei keiner Breite waagerecht, und die Zeilen sind nicht gestreckt: die hoechste Karte
       einer Zeile ist genau so hoch wie ihr Inhalt (Rand und Polster eingerechnet), nirgends mehr */
    for (const [b, h] of [[560, 900], [1280, 860], [2000, 1480]]) {
      await q.setViewportSize({ width: b, height: h });
      await q.waitForFunction(() => document.querySelector("#a2 .a2karte"));
      const m = await q.evaluate(() => {
        const kk = document.querySelector("#a2 .a2karten");
        const karten = [...kk.querySelectorAll(".a2karte")];
        const zeilen = new Map();
        karten.forEach((k) => { const t = Math.round(k.getBoundingClientRect().top + scrollY); const r = zeilen.get(t) || []; r.push(k); zeilen.set(t, r); });
        const ueber = [...zeilen.values()].map((r) => {
          const hoch = Math.max(...r.map((k) => k.getBoundingClientRect().height));
          const inhalt = Math.max(...r.map((k) => { const kr = k.getBoundingClientRect(); const stil = getComputedStyle(k);
            return Math.max(...[...k.children].map((c) => c.getBoundingClientRect().bottom)) - kr.top + parseFloat(stil.paddingBottom) + parseFloat(stil.borderBottomWidth); }));
          return Math.round(hoch - inhalt);
        });
        return { rollt: document.documentElement.scrollWidth > document.documentElement.clientWidth, karten: karten.length, ueber };
      });
      assert(!m.rollt && m.ueber.every((u) => u <= 4), "#439: Karten bei " + b + " px: kein waagerechtes Rollen, Zeilen nicht gestreckt", m);
    }
    await q.setViewportSize({ width: 1280, height: 860 });
    await q.evaluate(({ t, m }) => { document.documentElement.dataset.theme = t; document.documentElement.classList.toggle("mica", m); }, themaDavor);
    // ein Pull eines anderen Builds (Langbogen): kein Geist
    await qLoad(BAU_LB);
    await qTab("analysis");
    const gLb2 = await geist();
    await uSatz("Lb2");
    assert(!gLb2.pfad && gLb2.v === "–", "Geist: Langbogen-Pull zeigt keinen Geist", gLb2);
    assert(uSaetze.every((x) => !!x.analyse.uv && (!x.tafel.uv || (x.tafel.uv === x.analyse.uv && x.tafel.un === x.analyse.un))),
      "Urteil: wo die Tafel einen Urteilssatz zeigt, ist es derselbe wie in der Analyse (auch mit besten Pull)", uSaetze);
    // diese Kaempfe haben alle einen Bezug mit Lauf: wo die Analyse den Geist zeichnet, zeigt die Tafel ihren Vergleich (.ubezug), keinen Urteilssatz
    assert(uSaetze.some((x) => x.geist) && uSaetze.filter((x) => x.geist).every((x) => x.tafel.vergleich && !x.tafel.uv),
      "Urteil: Kampf mit Geist und Bezug mit Lauf: die Tafel zeigt ihren Vergleich (.ubezug) statt des Urteilssatzes", uSaetze.map((x) => [x.wo, x.geist, x.tafel.vergleich, !!x.tafel.uv]));

    // der beste Pull selbst gegen den zweitbesten, der ueber die gemeinsame Strecke vorn liegt
    await qLoad(BAU_DA4);
    await qTab("analysis");
    await waehle(1);
    await qTab("analysis");
    const zweitAbst = () => q.evaluate(() => {
      const e = document.querySelector('#a2besser li[data-k="abstand"]');
      return { e: !!e, text: e?.textContent || "", aria: e?.querySelector("button.inrot")?.getAttribute("aria-label") || "",
        n: document.querySelector('#wbKenn .find[data-k="gegenBest"] .n')?.textContent || "" };
    });
    const zDe = await zweitAbst();
    assert(zDe.e && /zweitbesten Pull/.test(zDe.text) && !/Rückstand zum besten Pull/.test(zDe.text) && /zweitbesten Pull/.test(zDe.aria),
      "Geist: im besten Pull sagt „Abstand wächst“ zweitbester Pull, im Satz und im Namen des Knopfs", zDe);
    assert(/^zweitbester Pull, .+ (am \d\d\.\d\d\.|aus diesem Log)$/.test(zDe.n),
      "Geist: Kennzeile im besten Pull nennt den zweitbesten Pull", zDe);
    await q.evaluate(() => document.querySelector("#btnLang").click());
    await q.waitForTimeout(150);
    const zEn = await zweitAbst();
    assert(zEn.e && /second best pull/.test(zEn.text) && !/gap to your best pull/.test(zEn.text) && /second best pull/.test(zEn.aria) &&
      /^second best pull, .+ (on \d\d\/\d\d|in this log)$/.test(zEn.n),
      "Geist: Englisch - Abstand und Kennzeile gegen den second best pull", zEn);
    await q.evaluate(() => document.querySelector("#btnLang").click());
    await q.waitForTimeout(150);
    /* Abschlusspruefung I2 (Spiegel am rechten Rand): entfallen mit den gespiegelten Strichen der Werkbank (#414, Inventur D05/D16);
       die Geisterkurve der Zeitleiste ist auf die Laenge dieses Kampfs geschnitten (geistBauen, 26) und hat keinen Rand. */
    await waehle(0);
    await qTab("analysis");
    /* Abschlusspruefung I1: ein duenner Dolch-Kampf (15 Treffer) - der beste Pull desselben Builds ist
       gespeichert, nur der Geist wird unter der Schwelle nicht gezeichnet: kein Eintrag, kein "noch kein Pull" */
    const BAU_DUENN = bauLog("bau-duenn.txt", [{ bau: DA, start: at(25, 21, 0), secs: 7.5, scale: 1.0 }]);
    await qLoad(BAU_DUENN);
    await qTab("analysis");
    const duenn = await q.evaluate(() => ({ eintrag: !!document.querySelector('#wbKenn .find[data-k="gegenBest"]'),
      kenn: document.querySelector("#wbKenn")?.textContent || "", text: document.querySelector("#p-analysis").innerText,
      pfad: !!document.querySelector("#a2:not([hidden]) #a2kurve path.a2geist") }));
    assert(!duenn.eintrag && !duenn.pfad && !/noch kein Pull|dein erster Pull/.test(duenn.text) && duenn.kenn.length > 0,
      "Geist: duenner Kampf mit gespeichertem Bezug - kein Eintrag „Gegen deinen besten Pull“, kein „noch kein Pull“", duenn);
    /* Abschlusspruefung I1: der Langbogen-Pull sagt "noch kein Pull mit diesen Waffen" (Ruling 10); in der
       Gruppentafel gibt es keinen besten Pull - dort entfaellt der Eintrag */
    await qLoad(BAU_LB);
    await qTab("analysis");
    const gegenBest = () => q.evaluate(() => ({ eintrag: !!document.querySelector('#wbKenn .find[data-k="gegenBest"]'),
      n: document.querySelector('#wbKenn .find[data-k="gegenBest"] .n')?.textContent || "",
      text: document.querySelector("#p-analysis").innerText }));
    const gbEinzeln = await gegenBest();
    assert(gbEinzeln.eintrag && /^noch kein Pull mit diesen Waffen an Vulcanus$/.test(gbEinzeln.n),
      "Geist: Langbogen-Pull neben Dolch-Pulls sagt „noch kein Pull mit diesen Waffen an …“", gbEinzeln);
    const zeile = (name, dps) => ({ name, dps, damage: dps * 60, seconds: 60, waiting: false, target: "Vulcanus" });
    const gruppe = { boroPartyLog: 2, when: new Date(at(26, 20, 0)).toISOString(), code: "RAID", target: "Vulcanus", history: [],
      fights: [{ target: "Vulcanus", when: new Date(at(26, 20, 0)).toISOString(), seconds: 60, board: [zeile("Mitglied A", 40000)] }],
      board: [zeile("Mitglied A", 40000), zeile("Mitglied B", 30000)] };
    const gruppePfad = join(work, "gruppe-vulcanus.json");
    writeFileSync(gruppePfad, JSON.stringify(gruppe));
    await q.setInputFiles("#partyLogInput", gruppePfad);
    await q.waitForTimeout(250);
    await q.evaluate(() => document.querySelector("#segParty").click());
    await q.waitForTimeout(250);
    await qTab("analysis");
    const gbGruppe = await gegenBest();
    assert(!gbGruppe.eintrag && !/noch kein Pull|dein erster Pull/.test(gbGruppe.text),
      "Gruppentafel: kein Eintrag „Gegen deinen besten Pull“, kein „noch kein Pull“", gbGruppe);
    await q.evaluate(() => document.querySelector('#groupSeg [data-g="skill"]').click());
    await q.waitForTimeout(150);
    assert(!qErrors.length, "zwei Builds: keine Fehler in der Seite", qErrors);
    await q.close();
  }
  /* Mechanik-Erkennung, erster Schritt (Spezifikation 2026-10-01, Abschnitte 3
     und 5): erzeugte Vulcanus-Pulls mit derselben Panzerstrecke - die Treffer
     laufen weiter (zehn je Sekunde), landen 0:24-0:30 aber nur mit 150. Ohne
     Erkennung ist das eine Luecke (unter 2 % der gewoehnlichen Sekunde). Nur
     Zahlen, Angreifer "Tester". */
  {
    /* folgt Pruefung 01.10.: von/bis legen die Panzerstrecke (ms ab Beginn),
       quellen je Pull die Figur (M3: eine fremde Figur zaehlt nicht mit) */
    const mechLog = (name, n, { von = 24000, bis = 30000, quellen = [] } = {}) => {
      const rows = [];
      for (let p = 0; p < n; p++) {
        const start = at(25, 20, 0) + p * 180000, wer = quellen[p] || "Tester";
        for (let k = 0; k < 700; k++) {
          const t = k * 100, panzer = t >= von && t < bis;
          const [skill, sid] = [QF, DM, ST][k % 3];
          const dmg = panzer ? 150 : k % 5 === 0 ? 40000 : 600;
          rows.push(`${stamp(start + t)},DamageDone,${skill},${sid},${dmg},0,0,kNormalHit,${wer},Vulcanus`);
        }
      }
      const f = join(work, name);
      writeFileSync(f, ["CombatLogVersion,4", ...rows].join("\n") + "\n");
      return f;
    };
    const m = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const mErrors = [];
    m.on("pageerror", (e) => mErrors.push(String(e)));
    await m.addInitScript(() => {
      try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* storage blocked */ }
    });
    await m.goto("file://" + dist);
    const mLaden = async (file, n) => {
      await m.setInputFiles("#fileInput", file);
      await m.waitForFunction((k) => document.querySelectorAll("#fightList .fight").length === k, n);
    };
    const mAnalyse = async (warte = "") => {
      await m.evaluate(() => document.querySelector('[data-tab="analysis"]').click());
      await m.waitForFunction((w) => !!document.querySelector("#a2kurve svg") &&
        (document.querySelector("#mechanikZeile")?.textContent || "").includes(w), warte, { timeout: 5000 }).catch(() => {});
      return m.evaluate(() => ({
        zeile: document.querySelector("#mechanikZeile")?.hidden !== false ? "" : document.querySelector("#mechanikZeile").textContent,
        mech: [...document.querySelectorAll("#a2kurve .mechz")].map((z) => z.dataset.zeit),
        gaps: [...document.querySelectorAll("#a2kurve .gapz")].map((z) => z.dataset.zeit),
        leg: !!document.querySelector("#a2legende .lm"),
        // #218: die Zahl der Luecken steht in der Kennzeile des Kopfs (#wbKenn), die Strecken im Streifen
        luecken: [...document.querySelectorAll('#wbKenn .find[data-k="luecken"]')]
          .map((f) => f.querySelector(".k").textContent + " | " + f.querySelector(".v").textContent).find((x) => /^Lücken/.test(x)) || "",
        px: document.querySelector("#mechanikZeile") ? parseFloat(getComputedStyle(document.querySelector("#mechanikZeile")).fontSize) : 0,
        urteil: document.querySelector("#a2haelften")?.hidden ? "" : document.querySelector("#a2haelften")?.textContent || "",
        /* #218: "Weitere Befunde" ist entfallen; die Befunde stehen verteilt (Kopf, Streifen, Faecher) -
           gelesen werden alle Eintraege des Bereichs (strenger: nirgends ein Mechanik-Eintrag) */
        weitere: [...document.querySelectorAll("#p-analysis .find")].map((f) => f.textContent).join(" | "),
        label: document.querySelector("#a2beschr")?.textContent || "",
        rolle: document.querySelector("#mechanikZeile")?.getAttribute("role") || "",
        mechEintrag: [...document.querySelectorAll('#p-analysis .find[data-k="mechanik"]')]
          .map((f) => f.querySelector(".k").textContent + " | " + f.querySelector(".v").textContent),
        fuss: (() => { const e = document.querySelector("#fussMech"); return e && !e.hidden ? e.textContent : ""; })(),
        art: [...document.querySelectorAll("#p-analysis .find")]
          .map((f) => f.querySelector(".k").textContent + " | " + f.querySelector(".v").textContent).find((x) => /^Art deiner Skillung/.test(x)) || "",
      }));
    };
    /* Der Bereich Kampf: die leise Zeile zur Mechanik (#kurveMech, seit dem Glutring oben links im Ringfeld), die
       Strecke an der Leinwand (data-mech) und die Schraffur.
       folgt Spezifikation Glutring 2 (E 10): zuerst im zugeklappten Band (Kurve 78 Punkt). Dort reichen die Spitzen
       der Kurve bis in den obersten Streifen; die Schraffur erkennt man darum an ihrem Muster - die schraegen Striche
       wechseln den Alphawert alle 7 Punkt, ueber die ganze Hoehe -, gezaehlt als Wechsel des Alphas entlang jeder
       Zeile, in der Strecke gegen dieselbe Breite daneben (dort wechselt er nur, wo die Kurve die Zeile kreuzt).
       Danach aufgeklappt (200 Punkt, wie vorher bei 220 bis 360): gemalte Punkte im obersten Streifen, in der
       Strecke gegen daneben, wo ueber der Kurve nichts liegt. Am Ende wieder zu. */
    const mMessen = () => m.evaluate(() => {
      const z = document.querySelector("#kurveMech"), c = document.querySelector("#kurve");
      const zeile = z && !z.hidden ? z.textContent : "";
      const leise = !!z && parseFloat(getComputedStyle(z).fontSize) >= 11 && parseFloat(getComputedStyle(z).fontSize) < 14;
      const mech = c.dataset.mech || "";
      let schraffur = 0, daneben = 0, wechsel = 0, wechselDaneben = 0;
      const sek = JSON.parse(c.dataset.mechx || "[]")[0];
      if (sek) {
        const g = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, q = c.width / c.getBoundingClientRect().width;
        const alpha = (x, y) => g[(y * c.width + x) * 4 + 3];
        const zaehl = (x0, x1) => { let n = 0; for (let y = Math.round(10 * q); y < Math.round(24 * q); y++)
          for (let x = Math.round(x0 * q); x < Math.round(x1 * q); x++) if (alpha(x, y) > 0) n++; return n; };
        const wechselt = (x0, x1) => { let n = 0; for (let y = 0; y < c.height; y++)
          for (let x = Math.round(x0 * q) + 1; x < Math.round(x1 * q); x++) if (Math.abs(alpha(x, y) - alpha(x - 1, y)) > 8) n++; return n; };
        const breit = sek.b - sek.a;
        schraffur = zaehl(sek.a + 3, sek.b - 3); daneben = zaehl(sek.b + breit, sek.b + 2 * breit - 6);
        wechsel = wechselt(sek.a + 3, sek.b - 3); wechselDaneben = wechselt(sek.b + breit, sek.b + 2 * breit - 6);
      }
      return { zeile, leise, mech, schraffur, daneben, wechsel, wechselDaneben, hoch: c.getBoundingClientRect().height,
        auf: document.querySelector("#zeitAuf").getAttribute("aria-expanded"), leg: document.querySelector("#kurveLeg").textContent };
    });
    const mKampf = async () => {
      await m.evaluate(() => document.querySelector('[data-tab="timeline"]').click());
      await m.waitForTimeout(250);
      const zu = await mMessen();
      await m.evaluate(() => document.querySelector("#zeitAuf").click());
      await m.waitForTimeout(250);
      const offen = await mMessen();
      await m.evaluate(() => document.querySelector("#zeitAuf").click());
      await m.waitForTimeout(150);
      return { ...zu, zu, offen };
    };
    // vier Pulls sind zu wenige: keine Zeile, kein Band, die Strecke bleibt eine Luecke
    await mLaden(mechLog("mech-vier.txt", 4), 4);
    let r = await mAnalyse();
    assert(r.zeile === "" && r.mech.length === 0 && !r.leg, "Mechanik: unter 5 Pulls keine Zeile und kein Band", r);
    assert(r.gaps.includes("0:24\u20130:30"), "Mechanik: unter 5 Pulls bleibt die Strecke eine Luecke", r);
    // Feinschliff 02.10., Abschnitt 3: ohne Mechanik kein Eintrag und kein Zusatz im Fuss, im Kampf nichts
    assert(!r.mechEintrag.length && !r.fuss, "Mechanik: unter 5 Pulls kein Eintrag bei den Befunden, kein Zusatz im Fuss", r);
    let k = await mKampf();
    assert(!k.zeile && !k.mech && !/Mechanik/.test(k.leg), "Mechanik: unter 5 Pulls im Kampf keine Zeile und keine Schraffur", k);
    // fuenf Pulls: erkannt
    await mLaden(mechLog("mech-fuenf.txt", 5), 5);
    r = await mAnalyse("Vulcanus");
    // folgt Pruefung 01.10., N1: ohne Zuschreibung an den Boss, die Dauer als Spanne (hier 6 bis 6 s)
    assert(r.zeile === "Vulcanus: Ab etwa 0:24 machen deine Treffer 6\u00a0s lang kaum Schaden (in 5 von 5 deiner geladenen Pulls). 0:24\u20130:30 nicht mitgezählt: Mechanik.",
      "Mechanik: die Zeile in der Analyse, mit dem Satz zu den Luecken", r.zeile);
    assert(r.mech.join() === "0:24\u20130:30" && r.leg, "Mechanik: die Strecke schraffiert in der Form, mit Legende", r);
    assert(!r.gaps.length && r.luecken === "Lücken ab 2\u00a0s | keine", "Mechanik: in der Strecke keine Luecke", r);
    assert(r.px >= 11, "Mechanik: die Zeile mindestens 11 px", r.px);
    /* Feinschliff 02.10., Abschnitt 3: der Befund als eigener Eintrag bei den weiteren
       Befunden, und der Fuss sagt, dass Borometer es aus deinen Pulls erkennt */
    /* #106 (Entscheidung vom 04.10.2026): die Mechanik steht genau einmal - als Zeile an der Form (oben
       geprueft), nicht noch als Eintrag bei den weiteren Befunden */
    assert(!r.mechEintrag.length && !/Mechanik/.test(r.weitere), "Mechanik: kein zweiter Eintrag bei den weiteren Befunden", r);
    // #109: die Saeulen-Beschreibung nennt die Strecke, die Zeile ist eine Notiz fuer den Vorleser
    assert(r.label.endsWith("; Mechanik 0:24\u20130:30") && r.rolle === "note", "#109: Saeulen-Beschreibung mit Mechanik, die Zeile mit role=note", r);
    // #110: auch bei 2000 Punkt Breite hoechstens 70 Zeichen je Zeile
    await m.setViewportSize({ width: 2000, height: 1480 });
    await m.waitForTimeout(200);
    const mz = await m.evaluate(() => { const inCh = (e) => { if (!e || !e.getClientRects().length) return -1; const m = document.createElement("span");
          m.textContent = "0".repeat(100); m.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:inherit";
          e.appendChild(m); const ch = m.getBoundingClientRect().width / 100; m.remove(); return e.getBoundingClientRect().width / ch; };
      return inCh(document.querySelector("#mechanikZeile")); });
    assert(mz > 0 && mz <= 70.5, "#110: die Zeile zur Mechanik hoechstens 70 Zeichen breit", mz);
    await m.setViewportSize({ width: 1280, height: 860 });
    assert(r.fuss === " \u2013 au\u00dfer Borometer erkennt es aus deinen Pulls (Mechanik)", "Mechanik: der Fuss nennt die Erkennung", r.fuss);
    /* und im Kampf: die Kurve schraffiert die Strecke wie Analyse und Rotation, darunter
       eine leise Zeile, die Legende nennt sie; der Boss steht nicht als Urheber da */
    k = await mKampf();
    assert(k.zeile === "0:24\u20130:30 Mechanik \u2013 nicht als L\u00fccke gez\u00e4hlt" && !/Vulcanus/.test(k.zeile) && k.leise,
      "Mechanik im Kampf: eine leise Zeile unter der Kurve", k);
    assert(k.zu.auf === "false" && Math.abs(k.zu.hoch - 78) <= 1 && k.zu.mech === "0:24\u20130:30" && k.zu.wechsel > 3 * (k.zu.wechselDaneben + 1) && /Mechanik/.test(k.zu.leg),
      "Mechanik im Kampf: im zugeklappten Band (78 Punkt) schraffiert die Kurve die Strecke, mit Legende", k.zu);
    assert(k.offen.auf === "true" && k.offen.mech === "0:24\u20130:30" && k.offen.schraffur > 3 * (k.offen.daneben + 1) && /Mechanik/.test(k.offen.leg),
      "Mechanik im Kampf: die Kurve schraffiert die Strecke, mit Legende (aufgeklappt)", k.offen);
    // Zeitverlauf im Bereich Rotation: die Legende nennt die Mechanik
    await m.evaluate(() => document.querySelector('[data-tab="rotation"]').click());
    await m.waitForFunction(() => !!document.querySelector("#stackGut .bandkey"), null, { timeout: 5000 }).catch(() => {});
    const key = await m.evaluate(() => [...document.querySelectorAll("#stackGut .bandkey .bke")].map((b) => b.textContent));
    assert(key.includes("Mechanik") && !key.some((k) => /Pause/.test(k)), "Mechanik: der Zeitverlauf nennt die Mechanik, keine Pause", key);
    /* Feinschliff 02.10., Abschnitt 3: "6 s" in der Schraffur steht auf derselben Pille wie in
       der Analyse (Grund --comb, gerundet) - gemessen am Pixel neben der Schrift */
    const pille = await m.evaluate(() => {
      const c = document.querySelector("#stack"), liste = JSON.parse(c.dataset.mechpille || "[]");
      const e = document.createElement("i"); e.style.color = "var(--comb)"; document.body.append(e);
      const comb = getComputedStyle(e).color; e.remove();
      const q = c.width / c.getBoundingClientRect().width, p = liste[0];
      const px = p ? [...c.getContext("2d").getImageData(Math.round((p.x + 1.5) * q), Math.round((p.y + p.h / 2) * q), 1, 1).data] : [];
      return { liste, comb, px };
    });
    assert(pille.liste.length === 1 && /6\u00a0s$/.test(pille.liste[0].text) && pille.px[3] === 255 &&
      "rgb(" + pille.px.slice(0, 3).join(", ") + ")" === pille.comb, "Mechanik: die Dauer im Zeitverlauf auf einer Pille im Grund der Flaeche", pille);
    // Pruefung 01.10., N6: ueber der Schraffur antwortet das Lesefenster mit Dauer und Zeitraum
    const tips = await m.evaluate(() => { const c = document.querySelector("#stack"); c.scrollIntoView({ block: "center" });
      const b = c.getBoundingClientRect(); return { x: b.x, y: b.y + b.height / 2, w: b.width }; });
    let tip = "";
    for (let x = tips.x + 2; x < tips.x + tips.w && !/^Mechanik/.test(tip); x += 3) {
      await m.mouse.move(x, tips.y);
      tip = await m.evaluate(() => document.querySelector("#tip").classList.contains("on") ? document.querySelector("#tip").textContent : "");
    }
    assert(/^Mechanik: 6,0\u00a0s kaum Schaden je Treffer, 0:24 bis 0:30\.$/.test(tip), "Mechanik: das Lesefenster im Zeitverlauf nennt Dauer und Zeitraum", tip);
    await m.mouse.move(2, 2);
    // Englisch
    await m.evaluate(() => document.querySelector("#btnLang").click());
    r = await mAnalyse("your hits");
    assert(r.zeile === "Vulcanus: from about 0:24, your hits do hardly any damage for 6\u00a0s (in 5 of 5 of your loaded pulls). 0:24\u20130:30 not counted: mechanic.",
      "Mechanik: die Zeile auf Englisch", r.zeile);
    // #106: kein Eintrag, nur die Zeile (oben) und der Fuss
    assert(!r.mechEintrag.length && !/Mechanic/.test(r.weitere) &&
      r.fuss === " \u2013 unless Borometer recognises it from your pulls (mechanic)", "Mechanik: kein Eintrag, der Fuss auf Englisch", r);
    k = await mKampf();
    assert(k.zeile === "0:24\u20130:30 mechanic \u2013 not counted as a gap", "Mechanik im Kampf: die Zeile auf Englisch", k);
    await m.evaluate(() => document.querySelector("#btnLang").click());
    // Pruefung 01.10., N3: bei 560 px rollt mit Zeile und Legende nichts waagerecht
    await m.setViewportSize({ width: 560, height: 860 });
    r = await mAnalyse("Vulcanus");
    // auch nichts abgeschnitten: Zeile und Legende passen in ihre eigene Breite
    const roll560 = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth ||
      [...document.querySelectorAll("#a2 .a2zeit *")].some((e) => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth + 1) ||
      ["#mechanikZeile", "#a2legende"].some((s) => { const e = document.querySelector(s); return !e || e.scrollWidth > e.clientWidth + 1; }));
    assert(!!r.zeile && r.leg && !roll560, "Mechanik: bei 560 px Zeile und Legende sichtbar, kein waagerechtes Rollen", { zeile: r.zeile, leg: r.leg, roll560 });
    await m.setViewportSize({ width: 1280, height: 860 });
    /* Pruefung 01.10., M1: Haelftenvergleich und Schwankung ohne die Mechanik. Die Strecke
       0:10-0:40 liegt fast ganz in der ersten Haelfte; ohne sie sind beide Haelften gleich,
       und die Skillung ist gleichmaessig. */
    await mLaden(mechLog("mech-lang.txt", 5, { von: 10000, bis: 40000 }), 5);
    r = await mAnalyse("Vulcanus");
    assert(r.mech.join() === "0:10\u20130:40", "Mechanik: die lange Strecke 0:10-0:40 erkannt", r);
    /* ohne die Strecke sind beide Haelften gleich: seit #106 steht beim 1,0-fachen kein Satz (mit der Strecke
       waere die erste Haelfte deutlich schwaecher, und der Satz stuende da) */
    assert(!/Hälfte/.test(r.urteil), "Mechanik: der Haelftenvergleich rechnet ohne die Strecke (gleich, also kein Satz)", r.urteil);
    assert(r.art === "Art deiner Skillung | Gleichm\u00e4\u00dfig", "Mechanik: die Schwankung rechnet ohne die Strecke (gleichmaessig)", r.art);
    /* Pruefung 01.10., M3: vier Pulls dieser Figur und einer einer anderen sind nicht
       "fuenf deiner Pulls" - keine Zeile, die Strecke bleibt eine Luecke */
    await mLaden(mechLog("mech-fremd.txt", 5, { quellen: ["Tester", "Tester", "Tester", "Tester", "Zweite"] }), 5);
    r = await mAnalyse();
    assert(r.zeile === "" && r.mech.length === 0 && r.gaps.includes("0:24\u20130:30"),
      "Mechanik: eine fremde Figur zaehlt nicht zu deinen Pulls", r);
    assert(!mErrors.length, "Mechanik: keine Fehler in der Seite", mErrors);
    await m.close();
  }
  /* Alte Zuordnung (#207): das Verzeichnis traegt b aus der Zeit des Builds-Reiters. Die Seite liest es nicht mehr, das
     Fenster rechnet ueber das Waffenpaar, der Satz endet auf "mit diesen Waffen.", und /api/builds wird nie gefragt.
     Dateiname und Startzeiten der sechs Pulls stimmen mit dem Log ueberein. */
  {
    const html = readFileSync(dist, "utf8");
    const datei = logFile("fenster-build.txt", serie(26, "Fellinex", 6, {}));
    const index = { "fenster-build.txt": { size: 1, fights: [0, 1, 2, 3, 4, 5].map((p) => ({ name: "Fellinex", dps: 1, dmg: 1, dur: 96, at: at(26, 20, p * 10), b: "bu00000000" })) } };
    const g = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const gErrors = [], gAsked = [];
    g.on("pageerror", (e) => gErrors.push(String(e)));
    await g.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* storage blocked */ } });
    await g.route("http://boro.test/**", async (route) => {
      const req = route.request(), path = new URL(req.url()).pathname;
      const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (/^\/api\/(builds|plans)/.test(path)) gAsked.push(path);
      if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
      if (path === "/api/config" && req.method() === "GET") return json({ rundgangGesehen: true, logIndex: index });
      if (path.startsWith("/api/")) return json({ ok: true });
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    });
    await g.goto("http://boro.test/index.html");
    await g.waitForTimeout(500);
    await g.setInputFiles("#fileInput", datei);
    await g.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Fellinex"));
    await g.waitForTimeout(300);
    await g.evaluate(() => document.querySelector('[data-tab="analysis"]').click());
    await g.waitForTimeout(300);
    const gef = await g.evaluate(() => document.querySelector("#findings .fwin .fgef")?.textContent || "");
    assert(/ gemessen über 6 Pulls mit diesen Waffen\.$/.test(gef), "alte Zuordnung b im Verzeichnis: der Satz endet auf \"mit diesen Waffen.\", kein Build mehr", gef);
    assert(!gAsked.length, "die Seite fragt weder /api/builds noch /api/plans (#207)", gAsked);
    assert(!gErrors.length, "alte Zuordnung: keine Fehler in der Seite", gErrors);
    await g.close();
  }
  /* Builds-Reiter 6 (Fixrunde 1, Ruling 13): Unbekanntes passt nie. Ein gespeicherter bester Pull, dessen Paar sich
     weder aus dem Verzeichnis noch aus seinem Lauf lesen laesst, ist kein Bezug fuer einen Kampf mit bekanntem Paar:
     die Start-Zeile entfaellt. Zur Gegenprobe dieselbe Lage mit lesbarem Lauf: die Zeile steht. */
  {
    const html = readFileSync(dist, "utf8");
    const geoeffnet = async (best, bei) => {
      const g = await browser.newPage({ viewport: { width: 1280, height: 860 } });
      g.errors = [];
      g.on("pageerror", (e) => g.errors.push(String(e)));
      await g.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* storage blocked */ } });
      await g.route("http://boro.test/**", async (route) => {
        const req = route.request(), path = new URL(req.url()).pathname;
        const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best });
        if (path === "/api/best") { bei(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
        if (path === "/api/config" && req.method() === "GET") return json({ rundgangGesehen: true });
        if (path.startsWith("/api/")) return json({ ok: true });
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
      });
      await g.goto("http://boro.test/index.html");
      await g.waitForTimeout(500);
      return g;
    };
    const ladeUndAnalyse = async (g, datei) => {
      await g.setInputFiles("#fileInput", datei);
      await g.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Fellinex"));
      await g.waitForTimeout(300);
      await g.evaluate(() => document.querySelector('[data-tab="analysis"]').click());
      await g.waitForTimeout(300);
      // #414 (B2): der Start steht als Satz unter dem Opener (#a2start)
      return g.evaluate(() => { const e = document.querySelector("#a2start"); return !!e && !e.hidden && /^(Die ersten|The first) 10\u00a0s: /.test(e.textContent); });
    };
    let gespeichert = null;
    const g1 = await geoeffnet({}, (b) => { gespeichert = b; });
    await ladeUndAnalyse(g1, logFile("unbekannt-1.txt", serie(1, "Fellinex", 1, {})));
    for (const ende = performance.now() + 10000; performance.now() < ende && !gespeichert;) await g1.waitForTimeout(200);
    await g1.close();
    assert(!!gespeichert?.key && !!gespeichert?.entry?.best?.run?.skills?.length, "unbekannter Bezug: ein bester Pull wurde festgehalten", gespeichert?.key);
    // derselbe Pull, aber an einem anderen Zeitpunkt (kein Eintrag im Verzeichnis); mit oder ohne lesbaren Lauf
    const entry = (ohneSkills) => {
      const e = structuredClone(gespeichert.entry);
      e.best.at += 864e5 * 40;
      if (ohneSkills) e.best.run.skills = [];
      return e;
    };
    const zweiter = logFile("unbekannt-2.txt", serie(2, "Fellinex", 1, { inDmg: 90000, outDmg: 60000 }));
    const gA = await geoeffnet({ [gespeichert.key]: entry(false) }, () => {});
    const mitLauf = await ladeUndAnalyse(gA, zweiter);
    await gA.close();
    const gB = await geoeffnet({ [gespeichert.key]: entry(true) }, () => {});
    const ohneLauf = await ladeUndAnalyse(gB, zweiter);
    assert(mitLauf, "lesbarer Lauf, gleiches Paar: der gespeicherte Pull ist der Bezug, die Start-Zeile steht", mitLauf);
    assert(!ohneLauf, "Paar nicht lesbar: der gespeicherte Pull ist kein Bezug, die Start-Zeile entfaellt (Unbekanntes passt nie)", ohneLauf);
    assert(!gB.errors.length, "unbekannter Bezug: keine Fehler in der Seite", gB.errors);
    await gB.close();
  }

  /* --- 11 · Analyse-Feinschliff (Spezifikation 2026-10-04, #105-#110). Eine
     eigene Seite, Deutsch. Die Kaempfe erzeugt flachLog: alle 500 ms ein
     Treffer im Wechsel Schnellfeuer/Detonationsmal, 9000-11000 Schaden;
     `delle` [von s, bis s, Faktor] schwaecht eine Strecke ab. */
  {
    const fp = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const fErrors = [];
    fp.on("pageerror", (e) => fErrors.push(String(e)));
    await fp.addInitScript(() => {
      try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* storage blocked */ }
    });
    await fp.goto("file://" + dist);
    /* Der Name allein sagt nicht, dass der neue Kampf geladen ist (viele Logs hier heissen gleich): zusaetzlich warten, bis sich die Seite
       gegenueber vorher geaendert hat (#224: ein Zustand, keine feste Zeit; gleiche Seite = keine Aenderung, dann endet das Warten nach 4 s). */
    const fLoad = async (file, name) => {
      const vorher = await fp.evaluate(() => document.querySelector("#app")?.innerText || "");
      await fp.setInputFiles("#fileInput", file);
      await fp.waitForFunction((n) => (document.querySelector("#hName")?.textContent || "").includes(n), name);
      await fp.waitForFunction((v) => (document.querySelector("#app")?.innerText || "") !== v, vorher, { timeout: 4000 }).catch(() => {});
      await fp.waitForTimeout(150);
    };
    const fTab = async (name) => { await fp.evaluate((n) => document.querySelector(`[data-tab="${n}"]`).click(), name); await fp.waitForTimeout(150); };
    /* `pulls` (wahlweise) legt weitere Pulls desselben Logs davor, zehn Minuten auseinander, mit ihren
       eigenen Optionen; `krit` macht jeden dritten Treffer kritisch (doppelter Schaden). */
    let fTag = 0;
    /* #218: die Treffer des zuletzt geschriebenen Pulls ([ms, Skill, ID, Schaden]), fuer die Faecher */
    let flachLetzter = [];
    const flachLog = (name, boss, { pulls = [], ...letzter } = {}) => {
      const tag = 10 + (fTag++), rows = [];
      [...pulls, letzter].forEach(({ secs = 90, delle = null, krit = false }, p) => {
        if (p === pulls.length) flachLetzter = [];
        for (let k = 0; k * 500 < secs * 1000; k++) {
          const t = k * 500, [skill, sid] = k % 2 ? DM : QF, kr = krit && k % 3 === 0;
          let dmg = (9000 + (k * 7919 % 2001)) * (kr ? 2 : 1);
          if (delle && t >= delle[0] * 1000 && t < delle[1] * 1000) dmg *= delle[2];
          if (p === pulls.length) flachLetzter.push([t, skill, sid, Math.round(dmg)]);
          rows.push(`${stamp(at(tag, 20, p * 10) + t)},DamageDone,${skill},${sid},${Math.round(dmg)},${kr ? 1 : 0},0,${kr ? "kCritical" : "kNormalHit"},Tester,${boss}`);
        }
      });
      const f = join(work, name);
      writeFileSync(f, ["CombatLogVersion,4", ...rows].join("\n") + "\n");
      return f;
    };
    const zaehle = (text, re) => (text.match(new RegExp(re.source, "g")) || []).length;
    // #218: die Befunde stehen verteilt (Kennzeile, Streifen, Faecher) - gelesen werden alle des Bereichs
    const fBefunde = () => fp.evaluate(() => [...document.querySelectorAll("#p-analysis .find")]
      .map((f) => f.dataset.k + " | " + f.querySelector(".k").textContent + " | " + f.querySelector(".v").textContent +
        (f.querySelector(".n") ? " | " + f.querySelector(".n").textContent : "")));
    const fText = () => fp.evaluate(() => document.querySelector("#p-analysis").innerText);
    /* #414 (B2): die Befundliste ist entfallen; die Saetze stehen in der Analyse (unter Gut hier, Besser moeglich, am Opener, unter der
       Legende und unter dem Satz des Bereichs). Gelesen wird "Schluessel | Satz" ohne die Knoepfe. */
    const fListe = () => fp.evaluate(() => {
      const ohne = (e) => { const c = e.cloneNode(true); c.querySelectorAll("button").forEach((b) => b.remove()); return c.textContent.trim(); };
      return [...document.querySelectorAll("#a2gut li[data-k], #a2besser li[data-k]")].map((e) => e.dataset.k + " | " + ohne(e)).concat(
        [["start", "#a2start"], ["unverwundbar", "#a2unv"], ["haelften", "#a2haelften"]].filter(([, sel]) => { const e = document.querySelector(sel); return e && !e.hidden; })
          .map(([k, sel]) => k + " | " + ohne(document.querySelector(sel))));
    });

    // Tab-Erreichbarkeit: von der Bereichsleiste aus erreicht Tab das Ziel (die Knoepfe der neuen Saetze, #414 B2)
    const tabErreicht = async (sel) => {
      await fp.evaluate(() => document.querySelector('#bereiche [data-tab="analysis"]').focus());
      for (let i = 0; i < 200; i++) {
        await fp.keyboard.press("Tab");
        if (await fp.evaluate((x) => !!document.activeElement?.matches(x), sel)) return true;
      }
      return false;
    };
    // #105: ein gleichmaessiger Kampf - keine schwaechste Stelle, kein "Pruefe"
    await fLoad(flachLog("flach.txt", "Fellinex"), "Fellinex");
    await fTab("analysis");
    let bf = await fBefunde(), alles = await fText();
    assert(!(await fListe()).some((b) => b.startsWith("stelle |")) && !bf.some((b) => b.startsWith("schwach |")) && !/Schwächste drei Sekunden/.test(alles),
      "#105: gleichmaessiger Kampf ohne \"Schwaechste drei Sekunden\"", bf);
    assert(!/Prüfe/.test(alles), "#105: gleichmaessiger Kampf ohne \"Pruefe\"", alles);
    // eine Delle auf 40 %: unter dem halben Median, der Eintrag steht
    await fLoad(flachLog("delle40.txt", "Fellinex", { delle: [40, 43, 0.4] }), "Fellinex");
    await fTab("analysis");
    bf = await fBefunde();
    let fl = await fListe();
    assert(fl.some((b) => /^stelle \| Schwächste drei Sekunden 0:40–0:43 bei /.test(b)) && await fp.evaluate(() => !!document.querySelector("#a2marken .a2marke.stelle[data-von='40'][data-bis='43']")),
      "#105/#414: eine Strecke unter dem halben Median steht als Satz unter Besser moeglich und als Marke der Zeitleiste", fl);
    // die staerksten 5 s: im ganzen Kampf der Satz mit Anteil und tragender Faehigkeit unter Gut hier, statt des Satzes zur Spitze (nicht beide)
    const gutText = await fp.evaluate(() => document.querySelector("#a2gut")?.textContent || "");
    assert(fl.some((b) => /^strecke \| Von \d+:\d\d bis \d+:\d\d kam \d+\u00a0% des Schadens dieses Pulls, das meiste von \S/.test(b)) && !/Stärkste 5\s*s:/.test(gutText),
      "#414: die staerksten 5 s nennen ihren Anteil und die tragende Faehigkeit, der Satz zur Spitze steht nicht noch einmal da", { fl, gutText });
    // eine Delle auf 70 %: schwaecher als ueblich, aber nicht unter der Haelfte - kein Eintrag
    await fLoad(flachLog("delle70.txt", "Fellinex", { delle: [40, 43, 0.7] }), "Fellinex");
    await fTab("analysis");
    bf = await fBefunde();
    assert(!bf.some((b) => b.startsWith("schwach |")) && !(await fListe()).some((b) => b.startsWith("stelle |")) && await fp.evaluate(() => !document.querySelector("#a2marken .a2marke.stelle")),
      "#105: 70 % des Medians ist keine schwaechste Stelle (kein Satz, keine Marke)", bf);
    assert(!/Die Stelle/.test(await fp.evaluate(() => document.querySelector("#analysisCall").textContent)),
      "#105: 70 % des Medians auch nicht im Urteil", await fp.evaluate(() => document.querySelector("#analysisCall").textContent));

    /* #106: jede Aussage einmal. Ein gleichmaessiger Kampf mit Krits: der Krit-Satz nur unter "Wie
       triffst du?", ohne Luecken kein "Ohne die Luecken", kein Haelftensatz beim 1,0-fachen. */
    await fLoad(flachLog("flach-krit.txt", "Fellinex", { krit: true }), "Fellinex");
    await fTab("analysis");
    alles = await fText();
    // #414 (B3): "Wie triffst du?" und der Kopf des Kampfs (#wbWie, #verdict) sind entfallen; die Rate steht unter "Gut hier",
    // der Anteil der Krits am Schaden unter dem Satz des Bereichs (#a2treffer), jede Aussage einmal
    assert(await fp.evaluate(() => !document.querySelector("#wbWie, #verdict, #verdictText, #formTitel, .wbrampe")),
      "#414 B3: der Kopf des Kampfs mit der Rampe der Trefferarten ist aus der Seite", null);
    const dRate = await fp.evaluate(() => { const li = document.querySelector('#a2gut li[data-k="raten"]'); return li ? li.textContent.trim() : ""; });
    const dTreffer = await fp.evaluate(() => { const e = document.querySelector("#a2treffer"); return e && !e.hidden ? e.textContent.trim() : ""; });
    const dWie = dRate + " | " + dTreffer;
    assert(zaehle(alles, /deines Schadens kamen aus Krits/) === 1 && /deines Schadens kamen aus Krits/.test(dTreffer) && !/Krits/.test(dRate) && dRate.length > 0,
      "#106: der Krit-Satz steht genau einmal, unter dem Satz des Bereichs; die Rate steht unter Gut hier", { dRate, dTreffer });
    // #269: die Rate nennt die direkten Treffer; die leise Zeile sagt, woraus gerechnet ist, die Gesamtzahl bleibt
    assert(/^\d+\u00a0% deiner direkten Treffer kritisch, \d+\u00a0% stark\.$/.test(dRate) && /Treffer, davon \d+\u00a0% kritisch/.test(alles) &&
      !/Gerechnet/.test(dWie),
      "#106/#269: jeder Krit-Wert sagt, worauf er sich bezieht (direkte Treffer, Schaden); sind alle Treffer direkt, steht keine Basiszeile", dWie);
    // #218: "Hast du durchgedrueckt?" ist entfallen; die Einsaetze je Minute stehen in der Kennzeile
    const d3 = await fp.evaluate(() => [...document.querySelectorAll('#wbKenn .find[data-k="jeMinute"] .fein')].map((x) => x.textContent).join(" | "));
    assert(!/Lücken/.test(d3) && /^\d+,\d je Minute\./.test(d3), "#106: ohne Luecken kein \"Ohne die Luecken ..., mit ihnen\"", d3);
    assert(!/Hälfte|fachen/.test(alles), "#106: kein Haelftensatz beim 1,0-fachen", alles);
    // eine deutlich staerkere zweite Haelfte steht da
    await fLoad(flachLog("haelften.txt", "Fellinex", { delle: [0, 45, 0.6] }), "Fellinex");
    await fTab("analysis");
    assert((await fListe()).some((b) => /^haelften \| Deine zweite Hälfte lief mit [\d.]+k, dem 1,\d-fachen der ersten\.$/.test(b)),
      "#106/#414: ab dem 1,15-fachen steht der Haelftensatz, in der Analyse unter dem Satz des Bereichs", await fListe());
    await themen(["#a2haelften"], "Haelftensatz", fp);
    /* #218 (8.3): hier steht der Satz unter dem Streifen sicher - seine Breite bei 2000 x 1480 wird jetzt
       gemessen und unten mit der Lesezeile geprueft (hoechstens 75 Zeichen) */
    await fp.setViewportSize({ width: 2000, height: 1480 });
    await fp.waitForTimeout(300);
    const formsatzBreit = await fp.evaluate(() => {
      const e = document.querySelector("#a2haelften");
      if (!e || !e.getClientRects().length || !e.textContent.trim()) return -1;
      const m = document.createElement("span");
      m.textContent = "0".repeat(100); m.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:inherit";
      e.appendChild(m); const ch = m.getBoundingClientRect().width / 100; m.remove();
      return Math.round(e.getBoundingClientRect().width / ch * 10) / 10;
    });
    await fp.setViewportSize({ width: 1280, height: 860 });
    await fp.waitForTimeout(300);
    /* Der Start genau einmal: zwei Pulls, der zweite mit schwachem Start (die ersten 10 s auf 30 %).
       Er steht unter "Weitere Befunde", nicht noch einmal unter der Form. */
    await fLoad(flachLog("start.txt", "Fellinex", { pulls: [{}], delle: [0, 10, 0.3] }), "Fellinex");
    await fTab("analysis");
    alles = await fText();
    bf = await fBefunde();
    fl = await fListe();
    assert(fl.some((b) => /^start \| Die ersten 10\u00a0s: .*Dein Start war deutlich schwächer/.test(b)),
      "#106/#414: der schwache Start steht als Satz unter dem Opener", fl);
    assert(zaehle(alles, /Dein Start war deutlich schwächer/) === 1 && !/Start/.test(await fp.evaluate(() => ["#a2satz", "#a2haelften", "#a2gut", "#a2besser", "#a2unv"].map((x) => document.querySelector(x)?.textContent || "").join(" "))),
      "#106: der Start steht genau einmal, nicht unter der Form", alles);

    /* #109: ein h2 (der Name des Bereichs; mit Feldern steht er in der Kopfzeile, das h2 im Panel ist
       dann nicht gezeichnet), darunter alle Felder als h3 auf einer Ebene - zuerst das Urteil, ganz unten
       der Fuss; kein Sprung zurueck auf h2. Gezaehlt wird, was der Vorleser bekommt: was eine Box hat. */
    /* #218 (Spezifikation 2026-10-07, 8.2): die Folge ist wieder genau festgelegt - H2 Analyse, H3 Urteil,
       H3 Der Kampf, je Fach eine H3 mit dem Namen der Faehigkeit (Hauptfach, dann die mittleren), "Weitere
       Faehigkeiten" nur, wenn welche uebrig sind, zuletzt der Fuss. Dieser Kampf hat nur Schnellfeuer und
       Detonierendes Mal, kein Fenster, keine Laufzeit, kein Passiv, ein Ziel. Die Faecher tragen in ihrer
       h3 eine Zusatzzeile (small); verglichen wird der Name. */
    /* #414 (Inventur O13): die Werkbank ist abgeloest; unter dem Urteil stehen (das Feld "Der Kampf" entfiel mit #414 B3) die Zeitleiste, die Auswertung (drei Listen),
       die Faehigkeiten (der Pruefstand, die Karten sind keine Ueberschriften) und der Opener, dann der Fuss. Ohne Fenster und
       mit einem Ziel kommen keine weiteren Ueberschriften. */
    const sollBaum = ["H2 Analyse", "H3 Urteil", "H3 Zeitleiste", "H3 Was hier ablief", "H3 Gut hier", "H3 Besser möglich", "H3 Deine Fähigkeiten", "H3 Opener, die ersten 15 s", "H3 Was das Log nicht weiß"];
    const baum = await fp.evaluate(() => [...document.querySelectorAll("#bereichKopf h2, #p-analysis :is(h1,h2,h3,h4)")]
      .filter((h) => h.getClientRects().length > 0).map((h) => { const c = h.cloneNode(true); c.querySelectorAll("small").forEach((s) => s.remove());
        return h.tagName + " " + c.textContent.trim(); }));
    assert(JSON.stringify(baum) === JSON.stringify(sollBaum) && baum.slice(1).every((h) => h.startsWith("H3 ")),
      "#109: Ueberschriften h2 Analyse, dann nur h3 in der Reihenfolge der Seite", { baum, soll: sollBaum });
    const sprung = async () => fp.evaluate(() => document.querySelector(".skiplink").textContent);
    assert(await sprung() === "Zum Bereich Analyse springen", "#109: der Sprunglink nennt den Bereich Analyse", await sprung());
    await fTab("rotation");
    assert(await sprung() === "Zum Bereich Rotation springen", "#109: der Sprunglink folgt dem Bereich (Rotation)", await sprung());
    await fTab("timeline");
    assert(await sprung() === "Zum Kampf springen", "#109: im Bereich Kampf wie bisher", await sprung());
    await fTab("analysis");
    await fp.evaluate(() => document.querySelector("#btnLang").click());
    await fp.waitForTimeout(200);
    assert(await sprung() === "Skip to Analysis", "#109: der Sprunglink folgt der Sprache", await sprung());
    await fp.evaluate(() => document.querySelector("#btnLang").click());
    await fp.waitForTimeout(200);

    /* #107: vom Urteil zum Beleg und in die Rotation. Ein Kampf mit einer Luecke 0:40-0:46 (nichts
       trifft): das Urteil nennt die Leerzeit, "Zum Beleg" fuehrt zur Form und setzt den Fokus dorthin. */
    const weg = () => fp.evaluate(() => {
      const a = document.activeElement;
      const r = a ? a.getBoundingClientRect() : null;
      return {
        tab: document.querySelector(".panel.on")?.id || "",
        fokus: a ? (a.id ? "#" + a.id : a.className || a.tagName) : "",
        sichtbar: !!r && r.top < innerHeight && r.bottom > 0,
        von: document.querySelector("#p-rotation .vfrom")?.value || "", bis: document.querySelector("#p-rotation .vto")?.value || "",
        ganz: document.querySelector("#analysisCall .ganz")?.textContent || "",
        bereich: document.querySelector("#a2bereichZeit")?.textContent || "",
      };
    });
    await fLoad(flachLog("luecke.txt", "Fellinex", { delle: [40, 46, 0] }), "Fellinex");
    await fTab("analysis");
    const zb = await fp.evaluate(() => { const k = document.querySelector("#analysisCall button.zubeleg");
      return k ? { text: k.textContent, typ: k.type } : null; });
    assert(zb?.text === "Zum Beleg ›" && zb.typ === "button", "#107: unter dem Urteil der Knopf \"Zum Beleg\"", zb);
    await fp.evaluate(() => document.querySelector("#analysisCall button.zubeleg").click());
    await fp.waitForTimeout(400);
    let w = await weg();
    assert(w.tab === "p-analysis" && w.fokus === "#a2fokus" && w.sichtbar && /^0:40–0:46 /.test(w.bereich),
      "#107: \"Zum Beleg\" rollt zur Zeitleiste, setzt die Luecke als Bereich und den Fokus auf die Kurve", w);
    // an "Luecken ab 2 s": die laengste Luecke in der Rotation, mit 2 s Rand
    // #414 (B2, Inventur O10): ein Knopf an der Zeile des Bereichs zeigt den gewaehlten Bereich (hier die Luecke) in der Rotation
    const lb = await fp.evaluate(() => { const k = document.querySelector("#a2weg button.inrot");
      return k ? { text: k.textContent, label: k.getAttribute("aria-label") } : null; });
    assert(lb?.text === "In der Rotation zeigen ›" && lb.label === "Den Bereich 0:40\u20130:46 in der Rotation zeigen",
      "#107/#414: an der Zeile des Bereichs der Knopf mit der Strecke im Vorlesenamen", lb);
    assert(await tabErreicht("#a2weg button.inrot"), "#414: der Knopf in die Rotation an der Zeile des Bereichs ist mit Tab erreichbar", null);
    await themen(["#a2weg button.inrot"], "Knopf an der Zeile des Bereichs", fp);
    await fp.evaluate(() => document.querySelector("#a2weg button.inrot").click());
    await fp.waitForTimeout(500);
    w = await weg();
    assert(w.tab === "p-rotation" && w.von === "0:38" && w.bis === "0:48" && w.fokus === "#deineRotScroll",
      "#107: die Rotation oeffnet mit Von/bis 0:38-0:48, Fokus auf der Zeitleiste", w);
    // zurueck in der Analyse: sie sagt, dass sie den ganzen Kampf liest
    await fTab("analysis");
    w = await weg();
    assert(w.ganz === "Die Analyse liest den ganzen Kampf. Von/bis 0:38\u20130:48 gilt nur in der Rotation.",
      "#107: mit Von/bis in der Rotation sagt die Analyse, dass sie den ganzen Kampf liest", w);
    // "Die Folge in der Rotation" unter "Hast du durchgedrueckt?"
    // #218: jetzt an den Einsaetzen je Minute in der Kennzeile des Kopfs
    const fo = await fp.evaluate(() => document.querySelector('#wbKenn .find[data-k="jeMinute"] button.inrot')?.textContent || "");
    assert(fo === "Die Folge in der Rotation ›", "#107: der Verweis auf die Folge ist ein Knopf", fo);
    await fp.evaluate(() => document.querySelector('#wbKenn .find[data-k="jeMinute"] button.inrot')?.click());
    await fp.waitForTimeout(400);
    assert((await weg()).tab === "p-rotation", "#107: \"Die Folge in der Rotation\" oeffnet die Rotation", await weg());
    /* Tastatur: von der Bereichsleiste aus erreicht Tab "Zum Beleg" und die Knoepfe in den Befunden */
    await fTab("analysis");
    await fp.evaluate(() => document.querySelector('#bereiche [data-tab="analysis"]').focus());
    /* #218: die Werkbank bringt mehr Knoepfe (Zeitleiste, "Mehr zu ..."), darum bis zu 120 Schritte; die
       Folge des ersten Erreichens wird mitgeschrieben (Zeitleiste = "zeit", "Mehr zu ..." = "fach") */
    const erreicht = new Set(), folge = [];
    for (let i = 0; i < 120; i++) {
      await fp.keyboard.press("Tab");
      const k = await fp.evaluate(() => { const a = document.activeElement;
        return a?.closest("#p-analysis") ? (a.classList.contains("zubeleg") ? "beleg" : a.closest(".a2karte") ? "karte" : a.closest(".a2marke") ? "marke" : a.closest("#a2") ? "zeit" :
          a.closest(".find")?.dataset.k || a.closest("section")?.id || "") : ""; });
      if (k && !erreicht.has(k)) folge.push(k);
      if (k) erreicht.add(k);
    }
    // #218: der Weg zur Folge sitzt an den Einsaetzen je Minute (Kennzeile), nicht mehr im Feld #dDurch
    assert(erreicht.has("beleg") && erreicht.has("marke") && erreicht.has("zeit") && erreicht.has("jeMinute"), "#107: alle neuen Wege mit Tab erreichbar", [...erreicht]);
    /* #218 (Spezifikation 8.2, letzte Zeile), seit #414: Zum Beleg, dann die Zeitleiste; die Karten danach prueft
       test-pruefstand-page (dieser Kampf hat nur eine Faehigkeit im Sekundentakt, einen Tick, und darum keine Karte). */
    const iBeleg = folge.indexOf("beleg"), iZeit = folge.indexOf("zeit");
    assert(iBeleg >= 0 && iZeit > iBeleg,
      "#107/#414: Tab erreicht Zum Beleg, dann die Zeitleiste in dieser Folge", folge);
    // die schwaechste Stelle: ihr Knopf nennt die Strecke, die Rotation zeigt sie mit Rand
    await fLoad(flachLog("delle40b.txt", "Fellinex", { delle: [40, 43, 0.4] }), "Fellinex");
    await fTab("analysis");
    assert(await tabErreicht('#a2besser li[data-k="stelle"] button.inrot') && await tabErreicht("#a2marken .a2marke.stelle"),
      "#414: der Knopf in die Rotation am Satz der schwaechsten Stelle und ihre Marke sind mit Tab erreichbar", null);
    await themen(['#a2besser li[data-k="stelle"]', "#a2marken .a2marke.stelle .l"], "schwaechste Stelle (Satz und Marke)", fp);
    const sb = await fp.evaluate(() => document.querySelector('#a2besser li[data-k="stelle"] button.inrot')?.getAttribute("aria-label") || "");
    assert(sb === "Die Stelle 0:40\u20130:43 in der Rotation zeigen", "#107: an der schwaechsten Stelle der Knopf", sb);
    await fp.evaluate(() => document.querySelector('#a2besser li[data-k="stelle"] button.inrot').click());
    await fp.waitForTimeout(500);
    w = await weg();
    assert(w.tab === "p-rotation" && w.von === "0:38" && w.bis === "0:45", "#107: die Stelle in der Rotation mit 2 s Rand", w);
    // ein neuer Kampf ohne Von/bis: kein Hinweis; ein ruhiges Urteil: kein "Zum Beleg"
    await fLoad(flachLog("flach2.txt", "Fellinex"), "Fellinex");
    await fTab("analysis");
    // fLoad wartet nur auf den Namen (derselbe wie vorher): auf den Zustand warten, den die Probe pruefen will (#224), statt auf eine Zeit
    await fp.waitForFunction(() => !document.querySelector("#analysisCall .ganz"), null, { timeout: 4000 }).catch(() => {});
    w = await weg();
    assert(!w.ganz && !(await fp.evaluate(() => !!document.querySelector("#analysisCall .zubeleg"))),
      "#107: ohne Von/bis kein Hinweis, ohne Urteil kein \"Zum Beleg\"", w);
    // der schwache Start: sein Knopf zeigt die ersten 10 s
    await fLoad(flachLog("start2.txt", "Fellinex", { pulls: [{}], delle: [0, 10, 0.3] }), "Fellinex");
    await fTab("analysis");
    assert(await tabErreicht("#a2start button.inrot"), "#414: der Knopf in die Rotation am schwachen Start ist mit Tab erreichbar", null);
    await themen(["#a2start"], "Start-Satz", fp);
    const st = await fp.evaluate(() => document.querySelector("#a2start button.inrot")?.getAttribute("aria-label") || "");
    assert(st === "Die ersten 10\u00a0s in der Rotation zeigen", "#107: am schwachen Start der Knopf", st);
    await fp.evaluate(() => document.querySelector("#a2start button.inrot").click());
    await fp.waitForTimeout(500);
    w = await weg();
    assert(w.tab === "p-rotation" && w.von === "0:00" && w.bis === "0:12", "#107: der Start in der Rotation, 0:00-0:12", w);
    // Englisch
    await fTab("analysis");
    await fp.evaluate(() => document.querySelector("#btnLang").click());
    await fp.waitForTimeout(200);
    const en = await fp.evaluate(() => ({ ganz: document.querySelector("#analysisCall .ganz")?.textContent || "",
      start: document.querySelector("#a2start button.inrot")?.getAttribute("aria-label") || "" }));
    assert(en.ganz === "The analysis reads the whole fight. From/to 0:00\u20130:12 only applies in Rotation." &&
      en.start === "Show the first 10\u00a0s in Rotation", "#107 EN: Hinweis und Knopf", en);
    await fp.evaluate(() => document.querySelector("#btnLang").click());
    await fp.waitForTimeout(200);

    /* #110 bei 2000 \u00d7 1480: die Ziele ("Wohin ging der Schaden?") hoechstens 900 Punkt breit */
    await fp.setViewportSize({ width: 2000, height: 1480 });
    const zk = nebenKampf(at(28, 20, 0), "Fellinex", [["Ziel Zwei", 0.3, 5000, 50000]]);
    await fLoad(logFile("ziele.txt", zk.tr), "Fellinex");
    await fTab("analysis");
    const ts = await fp.evaluate(() => document.querySelector("#findings .tsplit")?.getBoundingClientRect().width || -1);
    assert(ts > 0 && ts <= 900.5, "#110: die Ziele hoechstens 900 Punkt breit", ts);
    await fp.setViewportSize({ width: 1280, height: 860 });

    /* --- Werkbank #218 (Spezifikation 2026-10-07, Abschnitte 2, 3, 5, 6 und 8.3). Ein Kampf von 60 s
       an Fellinex mit Faehigkeiten aller Arten, Skills aus dem Woerterbuch, Angreifer "Tester":
       Schnellfeuer alle 700 ms (10000), Beschuss alle 2 s (15000), Detonierendes Mal alle 6 s (30000),
       Klingensturm alle 5 s (20000), ein Agiler Schuss (1000, unter 0,8 %), Protest von Mutter Natur
       alle 400 ms (300) ausser zwischen 20,0 und 32,0 s, und Blitzgeschwindigkeit (940593086, in der
       Waffentabelle "Passive") alle 1300 ms mit 40000 - der meiste Schaden, aber nie Hauptfach.
       `stumm`: in der Luecke des Protests trifft auch sonst nichts (dann ist es eine Luecke, kein "aus"). */
    const PR = ["Mother Nature's Protest", 963754730], LS = ["Lightning Speed", 940593086];
    const BS = ["Blade Storm", 945408027], AG = ["Agile Shot", 944723371];
    const PR_AUS = [20000, 32000];
    const werkbankTreffer = (start, { stumm = false } = {}) => {
      const tr = [], drin = (t) => t > PR_AUS[0] && t < PR_AUS[1];
      const alle = (s, ms, dmg) => { for (let t = 0; t < 60000; t += ms) if (!(stumm && drin(t))) tr.push([start + t, s[0], s[1], dmg, false, "Fellinex"]); };
      /* Schnellfeuer in allen vier Hitzestufen (Spezifikation 3.3): jeder dritte Treffer kritisch, jeder
         vierte ab dem zweiten stark - also normal, stark (1), kritisch (2) und kritisch stark (3) */
      for (let t = 0, k = 0; t < 60000; t += 700, k++)
        if (!(stumm && drin(t))) tr.push([start + t, QF[0], QF[1], 10000, k % 3 === 0, "Fellinex", "Tester", k % 4 === 1]);
      alle(ST, 2000, 15000); alle(DM, 6000, 30000); alle(BS, 5000, 20000); alle(LS, 1300, 40000);
      tr.push([start + 50000, AG[0], AG[1], 1000, false, "Fellinex"]);
      for (let t = 0; t < 60000; t += 400) if (!drin(t)) tr.push([start + t, PR[0], PR[1], 300, false, "Fellinex"]);
      return tr;
    };
    const mmss = (s) => Math.floor(s / 60) + ":" + two(s % 60);
    /* Ruling 1: der Erwartungswert aus dem eigenen Log, gerundet wie die Seite (ganze Sekunden) */
    const prZeiten = (tr) => tr.filter((r) => r[1] === PR[0]).map((r) => r[0] - tr.reduce((m, x) => Math.min(m, x[0]), Infinity)).sort((a, b) => a - b);
    const ausErwartet = (tr) => {
      const z = prZeiten(tr);
      let a = 0, b = 0;
      for (let i = 1; i < z.length; i++) if (z[i] - z[i - 1] > b - a) { a = z[i - 1]; b = z[i]; }
      return Math.round((b - a) / 1000) + "\u00a0s aus, ab " + mmss(Math.round(a / 1000));
    };
    /* eine Zeile der Werkbank (nach Name oder data-n) und die h3, unter der sie steht */
    const wbZeile = (muster) => fp.evaluate((m) => {
      const re = new RegExp(m);
      const z = [...document.querySelectorAll("#findings .wbzeile[data-n]")].find((x) => re.test(x.dataset.n + " " + x.textContent));
      if (!z) return null;
      const nurName = (h) => { const c = h.cloneNode(true); c.querySelectorAll("small").forEach((s) => s.remove()); return c.textContent.trim(); };
      const vorher = [...document.querySelectorAll("#findings h3")].filter((h) => h.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { text: z.textContent, n: z.querySelector(".n")?.textContent || "", unter: vorher.length ? nurName(vorher.at(-1)) : "" };
    }, muster);
    const wbKoepfe = () => fp.evaluate(() => [...document.querySelectorAll("#findings :is(h3,h4)")].filter((h) => h.getClientRects().length > 0)
      .map((h) => { const c = h.cloneNode(true); c.querySelectorAll("small").forEach((s) => s.remove()); return c.textContent.trim(); }));
    const versuch = async (fn) => { try { await fn(); return true; } catch { return false; } };

    const wbTr = werkbankTreffer(at(5, 22, 0));
    await fLoad(logFile("werkbank.txt", wbTr), "Fellinex");
    await fTab("analysis");
    /* #414 (Inventur D01 bis D15): die Faecher, Gruppen, "Mehr zu ..." und Zeilen der Werkbank sind abgeloest. Ihre Aussagen
       pruefen jetzt test-pruefstand-page (Protest "aus", Passiv, groesster Treffer, Fehlschlaege auf den Karten, #findings ohne
       Faecher) und test-zeitleiste-page (Kerben beim Waehlen und Zeigen einer Faehigkeit); die Tabelle gegen den besten Pull
       steht oben bei den Geist-Proben. */
    // Kein Rot und kein Gruen als Urteil (8.3), seit #414 an den Streifen der Karten: sie fuellen mit der Hitze, nie mit --pos oder --neg
    for (const theme of THEMEN) {
      await fp.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`)?.click(), theme);
      await fp.waitForTimeout(150);
      const fb = await fp.evaluate(() => {
        const probe = (v) => { const s = document.createElement("span"); s.style.color = `var(${v})`; document.body.append(s);
          const c = getComputedStyle(s).color; s.remove(); return c; };
        const pos = probe("--pos"), neg = probe("--neg");
        const farben = [...document.querySelectorAll("#a2 .a2karte .streifen i")].map((e) => getComputedStyle(e).backgroundColor);
        return { pos, neg, n: farben.length, rotGruen: farben.filter((c) => c === pos || c === neg), stufen: new Set(farben).size };
      });
      // die Hitzestufen (kritisch, stark) sind an den Streifen zu sehen: mehr als eine Farbe
      assert(fb.stufen >= 2, `Karten, Thema ${theme}: die Streifen tragen mehrere Hitzestufen`, fb);
      assert(fb.n > 0 && fb.rotGruen.length === 0, `Karten, Thema ${theme}: der Streifen nutzt weder --pos noch --neg`, fb);
    }
    await fp.evaluate(() => document.querySelector('#themeRow [data-theme="dark"]')?.click());

    // 560 px und Kontrast in allen vier Themen (8.3)
    await fp.setViewportSize({ width: 560, height: 900 });
    await fp.waitForTimeout(300);
    await themen(["#wbKenn dt", ".a2karte .satz", ".a2karte .zsatz", ".a2karte .wbfein", ".a2tsatz"], "Analyse 560 px: Kennzeile, Saetze der Karte, Zeile der Ticks", fp);
    for (const theme of THEMEN) {
      await fp.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`)?.click(), theme);
      await fp.waitForTimeout(150);
      const breit = await fp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      assert(breit, `Analyse 560 px, Thema ${theme}: kein waagerechtes Rollen`, breit);
    }
    await fp.evaluate(() => document.querySelector('#themeRow [data-theme="dark"]')?.click());
    await fp.setViewportSize({ width: 1280, height: 860 });
    await fp.waitForTimeout(300);

    // 2000 x 1480: keine leere Zelle in der Werkbank, kein Satz breiter als 75 Zeichen (#414: entfallen mit der Bank, Inventur D14 und D15)
    await fp.setViewportSize({ width: 1280, height: 860 });
    await fp.waitForTimeout(300);

    // Protest ohne andere Treffer in der Luecke: das ist eine Luecke, kein "aus" (5.5)
    const stummTr = werkbankTreffer(at(6, 22, 0), { stumm: true });
    await fLoad(logFile("werkbank-stumm.txt", stummTr), "Fellinex");
    await fTab("analysis");
    // (Protest ohne fremde Treffer in der Luecke sagt kein "aus": jetzt in test-pruefstand-page, an der Zeile der Ticks)
    // #269: Protest ist Laufzeit - die Rate zaehlt ihn nicht mit, die Gesamtzahl der Treffer schon
    const wieStumm = await fp.evaluate(() => (document.querySelector('#a2gut li[data-k="raten"]')?.textContent || "") + " " + (document.querySelector("#a2treffer")?.textContent || ""));
    const basisStumm = /Gerechnet über (\S+) von (\S+) Treffern, ohne Laufzeit und Passiv\./.exec(wieStumm);
    assert(/deiner direkten Treffer/.test(wieStumm) && !!basisStumm && basisStumm[1] !== basisStumm[2],
      "#269: mit Laufzeit im Kampf nennt die Rate die direkten Treffer, weniger als alle", wieStumm);

    /* Der Weg vom Befund in die Zeitleiste (#414; vorher die Fahnen des Kampfstreifens, 5.1, 6): der Knopf
       "In der Zeitleiste zeigen" am Befund mit Zeit setzt die Strecke als Bereich; der Satz der Auswertung
       (aria-live) nennt ihn, Escape auf der Kurve hebt ihn auf. Die Fahnen, die Lesezeile #wbLese und das Zeigen
       von Befund und Kurve (#269) entfallen mit dem Streifen: die Marken der Zeitleiste und ihr Zeigen uebernehmen. */
    const zeitweg = () => fp.evaluate(() => {
      const uhr = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
      // #414 (B2): die Befundliste ist entfallen, der Weg in die Zeitleiste ist die Marke der Luecke
      const b = [...document.querySelectorAll("#a2marken .a2marke.luecke")], s = document.querySelector("#a2satz"), l = b[0];
      return { alle: b.length, label: b[0]?.getAttribute("aria-label") || "", erwartet: l ? uhr(Number(l.dataset.von)) + "–" + uhr(Number(l.dataset.bis)) : "",
        bereich: document.querySelector("#a2bereichZeit")?.textContent || "", live: s?.getAttribute("aria-live") || "", satz: (s?.textContent || "").trim(),
        brush: !!document.querySelector("#a2brush") && !document.querySelector("#a2brush").hidden };
    });
    const zeitAus = () => fp.evaluate(() => document.querySelector("#a2ganz")?.click());
    const w0 = await zeitweg();
    assert(w0.alle > 0 && /^Lücke \d+\u00a0s, \d+:\d\d–\d+:\d\d$/.test(w0.label) && w0.label.endsWith(", " + w0.erwartet) && w0.live === "polite" && w0.satz.length > 0 && !w0.brush,
      "Zeit-Weg: Marken der Luecken mit Namen, der Satz der Zeitleiste ist aria-live=polite, noch kein Bereich", w0);
    const wegFokus = await versuch(() => fp.locator("#a2marken .a2marke.luecke").first().focus({ timeout: 2000 }));
    if (wegFokus) { await fp.keyboard.press("Enter"); await fp.waitForTimeout(200); }
    const w1 = await zeitweg();
    assert(wegFokus && w1.brush && w1.erwartet !== "" && w1.bereich.startsWith(w1.erwartet + " ·"),
      "Zeit-Weg: Enter am Knopf setzt die Luecke als Bereich der Zeitleiste, die Auswertung nennt ihn", w1);
    // #414 (B3): bei einem gewaehlten Bereich steht weder die Rate unter Gut hier noch der Krit-Anteil: beide gelten dem ganzen Kampf
    const imBereich = await fp.evaluate(() => ({ rate: !!document.querySelector('#a2gut li[data-k="raten"]'), treffer: document.querySelector("#a2treffer")?.hidden !== false }));
    assert(!imBereich.rate && imBereich.treffer, "#414 B3: im gewaehlten Bereich keine Rate und kein Krit-Anteil des ganzen Kampfs", imBereich);
    // Escape auf der Kurve hebt den Bereich auf
    const kurveFokus = await versuch(() => fp.locator("#a2fokus").focus({ timeout: 2000 }));
    if (kurveFokus) { await fp.keyboard.press("Escape"); await fp.waitForTimeout(200); }
    const w2 = await zeitweg();
    assert(kurveFokus && !w2.brush,
      "Zeit-Weg: Escape auf der Kurve hebt den Bereich auf", w2);
    assert(await fp.evaluate(() => !!document.querySelector('#a2gut li[data-k="raten"]') && document.querySelector("#a2treffer")?.hidden === false),
      "#414 B3: ohne Bereich stehen Rate und Krit-Anteil wieder da", null);
    // Spezifikation 6: auch die Leertaste schaltet
    const wegLeer = await versuch(() => fp.locator("#a2marken .a2marke.luecke").first().focus({ timeout: 2000 }));
    if (wegLeer) { await fp.keyboard.press(" "); await fp.waitForTimeout(200); }
    const w3 = await zeitweg();
    assert(wegLeer && w3.brush && w3.bereich.startsWith(w3.erwartet + " ·"), "Zeit-Weg: die Leertaste setzt den Bereich ebenso", w3);
    /* der Satz der Zeitleiste in allen vier Themen lesbar (8.3), bei 560 px wie im Brief, solange ein Bereich steht:
       erst je Thema pruefen, dass der Bereich den Wechsel uebersteht, dann den Kontrast messen */
    await fp.setViewportSize({ width: 560, height: 900 });
    await fp.waitForTimeout(300);
    for (const theme of THEMEN) {
      await fp.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`)?.click(), theme);
      await fp.waitForTimeout(150);
      const l = await zeitweg();
      assert(l.brush && l.satz.length > 0, `Zeit-Weg 560 px, Thema ${theme}: der Bereich bleibt beim Themenwechsel`, l);
    }
    await fp.evaluate(() => document.querySelector('#themeRow [data-theme="dark"]')?.click());
    await themen(["#a2satz"], "Satz der Zeitleiste", fp);
    // 2000 x 1480: der Satz unter dem Kopf hoechstens 75 Zeichen breit, der Satz der Auswertung hoechstens 80
    await fp.setViewportSize({ width: 2000, height: 1480 });
    await fp.waitForTimeout(300);
    const zeilenBreit = await fp.evaluate(() => {
      const inCh = (e) => { if (!e || !e.getClientRects().length || !e.textContent.trim()) return -1; const m = document.createElement("span");
        m.textContent = "0".repeat(100); m.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:inherit";
        e.appendChild(m); const ch = m.getBoundingClientRect().width / 100; m.remove(); return Math.round(e.getBoundingClientRect().width / ch * 10) / 10; };
      return { haelften: inCh(document.querySelector("#a2haelften")), satz: inCh(document.querySelector("#a2satz")) };
    });
    // der Haelftensatz (#a2haelften) gemessen am Kampf mit Haelftensatz (oben, "haelften.txt"): dort steht er sicher, also > 0
    assert(zeilenBreit.satz > 0 && zeilenBreit.satz <= 80.5 && formsatzBreit > 0 && formsatzBreit <= 75.5,
      "2000 x 1480: der Haelftensatz hoechstens 75, der Satz der Zeitleiste hoechstens 80 Zeichen breit", { ...zeilenBreit, formsatzBreit });
    await fp.setViewportSize({ width: 1280, height: 860 });
    await fp.waitForTimeout(300);
    await zeitAus();

    /* #269 (#414): die Marke nennt die Dauer ("Luecke 5 s"), dieselbe wie ihr Befund in der Liste, und der Knopf am Befund
       setzt die Strecke als Bereich - in allen vier Themen, bei 560 Punkt ohne waagerechtes Rollen, bei 2000 x 1480 nichts gestreckt. */
    {
      const marken = () => fp.evaluate(() => [...document.querySelectorAll("#a2marken .a2marke.luecke")].map((m) => {
        return { text: m.querySelector(".l")?.textContent, label: m.getAttribute("aria-label") || "", dauer: Number(m.dataset.bis) - Number(m.dataset.von) };
      }));
      const ms = await marken();
      assert(ms.length > 0 && ms.every((m) => m.text === "Lücke " + m.dauer + "\u00a0s" && m.label.startsWith("Lücke " + m.dauer + "\u00a0s, ")),
        "#269: jede Luecken-Marke nennt ihre Dauer (data-bis minus data-von) und traegt einen Namen fuer den Vorleser", ms);
      // vier Themen, 560 Punkt ohne waagerechtes Rollen, 2000 x 1480 nichts gestreckt
      for (const [breite, hoehe] of [[560, 900], [2000, 1480], [1280, 860]]) {
        await fp.setViewportSize({ width: breite, height: hoehe });
        for (const theme of THEMEN) {
          await fp.evaluate((th) => document.querySelector(`#themeRow [data-theme="${th}"]`)?.click(), theme);
          await zeitAus();
          await fp.evaluate(() => document.querySelector("#a2marken .a2marke.luecke")?.click());
          await fp.waitForFunction(() => document.querySelector("#a2brush") && !document.querySelector("#a2brush").hidden, null, { timeout: 5000 });
          const z = await fp.evaluate(() => {
            const br = document.querySelector("#a2brush").getBoundingClientRect(), box = document.querySelector("#a2kurve").getBoundingClientRect();
            return { breit: Math.round(br.width), drin: br.left >= box.left - 1 && br.right <= box.right + 1, hoch: Math.round(br.height), boxH: Math.round(box.height),
              breitOk: document.documentElement.scrollWidth <= window.innerWidth + 1 };
          });
          assert(z.breit > 0 && z.drin && z.hoch <= z.boxH + 1 && z.breitOk,
            `#269: ${breite} x ${hoehe}, Thema ${theme}: der Bereich liegt in der Kurve, nicht gestreckt, ohne waagerechtes Rollen`, z);
        }
      }
      await zeitAus();
      await fp.evaluate(() => document.querySelector('#themeRow [data-theme="dark"]')?.click());
      await fp.mouse.move(2, 2);
    }

    /* #270 "Werkbank fuellt die Flaeche": entfallen mit der Werkbank (Inventur D15), das Kartenlayout prueft analyse-layout-probe. */

    /* #270 "Werkbank-Zeilen sagen, was auffaellt": entfallen mit den Zeilen (Inventur D13). Die Pause im eigenen Takt und das
       Warten zeigt die Karte als "Bereit, nicht gedrueckt" und Takt (test-pruefstand-page); die Zeitachse gemeinsam hat die Zeitleiste. */

    /* Ventius mit wechselnden Salven (3.3, 8.3): jede dritte Salve nur eine Welle zu drei, die anderen zwei.
       Der Bestwert des Kampfes (ventiusMix().top) ist 2: je Saeule so viele gefuellte Perlen wie Nachbeben,
       die fehlenden bis 2 leer. */
    const DS = ["Decisive Sniping", 964581976], vStart = at(7, 22, 0), vTr = [], vWellen = [];
    for (let t = 300, i = 0; t < 60000; t += 3000, i++) {
      const w = i % 3 === 2 ? 1 : 2;
      vTr.push([vStart + t, DS[0], DS[1], 80000, false, "Fellinex"]);
      for (const ab of [1000, 1100].slice(0, w)) for (const x of [0, 5, 10]) vTr.push([vStart + t + ab + x, DS[0], DS[1], 80000, false, "Fellinex"]);
      vWellen.push(w);
    }
    for (let t = 700; t < 60000; t += 1000) vTr.push([vStart + t, ST[0], ST[1], 20000, false, "Fellinex"]);
    await fLoad(logFile("salven-mix.txt", vTr), "Fellinex");
    await fTab("analysis");
    // #414: die Perlen sind das Raster der Ventius-Karte (erst gebaut, wenn aufgeklappt): je Salve volle Punkte = Nachbeben, hohle bis zum Bestwert
    await fp.evaluate(() => { document.querySelector("#a2vent").open = true; });
    await fp.waitForFunction(() => document.querySelectorAll("#a2vinnen .a2salve").length > 0, null, { timeout: 5000 });
    const vSaeulen = await fp.evaluate(() => [...document.querySelectorAll("#a2vinnen .a2salve")].map((e) => e.querySelectorAll(".voll").length + "/" + e.querySelectorAll(".leer").length));
    const vSoll = vWellen.map((w) => w + "/" + (2 - w));
    assert(JSON.stringify(vSaeulen) === JSON.stringify(vSoll),
      "Ventius: volle Punkte je Salve gleich den Nachbeben, hohle bis zum Bestwert (Raster der Karte)", { ist: vSaeulen, soll: vSoll });
    // #270 "Achse unter den Perlen": entfallen (Inventur E02); die Legende der Karte (fuenf Zeichen) prueft test-pruefstand-page.

    /* Ruling 19 (Zeilen der Werkbank mit ihrem Strich, mindestens 80 Punkt, hoechstens 44 Punkt hoch): entfallen mit den Zeilen
       (Inventur D13, D16); jede Faehigkeit hat ihre Bahn in der Zeitleiste, das prueft test-zeitleiste-page. */

    assert(!fErrors.length, "Feinschliff: keine Fehler in der Seite", fErrors);
    await fp.close();
  }

  /* #236: das Layout der Analyse bei jeder Zoomstufe und vier Fenstergroessen, ruhig und mit gedrueckter Fahne */
  await layoutProbe(browser, dist, assert);
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}

console.log(failed ? "\n" + failed + " FAILED" : "\nall passed");
process.exit(failed ? 1 : 0);
