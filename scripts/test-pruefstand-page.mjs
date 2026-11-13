// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Pruefstand der neuen Analyse (#414, Spezifikation
// 2026-11-08-analyse-neu-zeitleiste-design.md 2.4 bis 2.6) an der gebauten
// Seite: eine Karte je Faehigkeit, Checkliste, Opener, die Karte Auge von
// Ventius NUR in einem Kampf mit Salven (ein erzeugter Kampf ohne Ventius und
// das Beispiel mit), aufgeklappte Teile erst beim Aufklappen gebaut, ein
// Kampf unter 20 Treffern ohne die neue Analyse. Die Kaempfe sind erzeugt,
// die Namen Platzhalter, keine Spielernamen. Wartet auf Zustaende, nie auf Zeit.
//
// Run:  npm run test:pruefstand-page     (baut die Seite zuerst)

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = pathToFileURL(process.env.ANALYSE_DIST || join(root, "dist", "renderer", "index.html")).href;
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}

const two = (n, w = 2) => String(n).padStart(w, "0");
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`;
};
const logText = (treffer) => ["CombatLogVersion,4", ...[...treffer].sort((a, b) => a[0] - b[0]).map(([t, skill, sid, dmg, krit, ziel, fehl]) =>
  `${stamp(t)},DamageDone,${skill},${sid},${fehl ? 0 : Math.round(dmg)},${krit ? 1 : 0},0,${fehl ? "kMiss" : krit ? "kMaxDamageByCriticalDecision" : "kNormalHit"},Tester,${ziel}`)].join("\n") + "\n";
const work = mkdtempSync(join(tmpdir(), "boro-pruefstand-"));
const datei = (name, treffer) => { const p = join(work, name); writeFileSync(p, logText(treffer)); return p; };

/* 90 s auf ein Ziel: Schnellfeuer alle 2 s (vier Treffer, im Abstand von 100 ms), Detonierendes Mal alle 5 s,
   ein Leerlauf von 8 s ab Sekunde 40. Ohne Ventius. */
const T0 = Date.UTC(2026, 10, 8, 12, 0, 0);
function kampf(ziel, dauer = 90) {
  const r = [];
  for (let s = 0; s < dauer; s++) {
    if (s >= 40 && s < 48) continue;
    if (s % 2 === 0) for (let i = 0; i < 4; i++) r.push([T0 + s * 1000 + i * 100, "Quick Fire", 964762401, 4000 + (s % 7) * 100, (s + i) % 3 === 0, ziel]);
    if (s % 5 === 0) r.push([T0 + s * 1000 + 500, "Detonation Mark", 953174691, 9000, s % 10 === 0, ziel]);
  }
  return r;
}
const dünn = (ziel) => Array.from({ length: 8 }, (_, i) => [T0 + i * 1000, "Quick Fire", 964762401, 4000, false, ziel]);

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});
async function oeffne(lang = "de") {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.goto(dist);
  await page.waitForSelector("#fileInput", { state: "attached" });
  return { page, fehler };
}
const analyse = (page) => page.evaluate(() => document.querySelector('[data-tab="analysis"]').click());
const beispiel = async (page) => {
  await page.evaluate(() => document.querySelector("#btnSample").click());
  await page.waitForFunction(() => /Ramux/.test(document.querySelector("#hName")?.textContent || ""));
  await analyse(page);
  await page.waitForFunction(() => { const a = document.querySelector("#a2"); return a && !a.hidden && document.querySelector(".a2karte"); });
};
const ladeLog = async (page, pfad, name) => {
  await page.setInputFiles("#fileInput", pfad);
  await page.waitForFunction((n) => (document.querySelector("#hName")?.textContent || "").includes(n), name);
  await analyse(page);
};

try {
  // ---------- ohne Ventius: die Karten tragen, die Karte Auge von Ventius fehlt ganz
  {
    const { page, fehler } = await oeffne();
    await ladeLog(page, datei("ohne.txt", kampf("Probeboss")), "Probeboss");
    await page.waitForFunction(() => { const a = document.querySelector("#a2"); return a && !a.hidden && document.querySelector(".a2karte"); });
    const z = await page.evaluate(() => {
      const a = document.querySelector("#a2");
      return { karten: [...a.querySelectorAll(".a2karte")].map((k) => k.dataset.skill), vent: a.querySelectorAll(".a2karte.vent").length, text: a.textContent,
        check: [...a.querySelectorAll(".a2check th")].map((t) => t.textContent), satz: document.querySelector("#a2satz").textContent,
        takt: [...a.querySelectorAll(".a2karte dt")].some((d) => /Takt/.test(d.textContent)) };
    });
    assert(z.karten.length === 2 && z.karten.includes("Quick Fire") && z.karten.includes("Detonation Mark"), "eine Karte je Faehigkeit (Namen des Kerns als Schluessel)", z.karten);
    assert(z.vent === 0 && !/Ventius/i.test(z.text), "ohne Salven keine Ventius-Karte und kein Wort Ventius in der neuen Analyse", z.vent);
    assert(!z.check.some((t) => /Ventius/.test(t)) && z.check.length >= 3, "die Checkliste ohne Ventius-Zeilen", z.check);
    assert(/^Im ganzen Kampf: .*je Sekunde/.test(z.satz) && !/Ventius/.test(z.satz), "der Satz des Bereichs nennt keinen Ventius-Anteil", z.satz);
    assert(z.takt, "die Karten tragen Takt und Bereit");
    // der Leerlauf von 8 s steht in den Auswertungen und als Marke
    const l = await page.evaluate(() => ({ besser: document.querySelector("#a2besser").textContent, marke: [...document.querySelectorAll(".a2marke.luecke")].length }));
    assert(/Leerlauf/.test(l.besser) && l.marke >= 1, "der Leerlauf steht unter Besser moeglich und als Marke", l);
    assert(!fehler.length, "keine Seitenfehler", fehler);
    await page.close();
  }

  // ---------- das Beispiel mit Ventius: Karte, Abstand statt Takt, aufgeklappte Teile erst beim Aufklappen
  {
    const { page, fehler } = await oeffne();
    await beispiel(page);
    const v = await page.evaluate(() => {
      const k = document.querySelector(".a2karte.vent");
      return { dts: [...k.querySelectorAll("dt")].map((d) => d.textContent), innenZu: document.querySelector("#a2vinnen").children.length, offen: document.querySelector("#a2vent").open,
        listeZu: document.querySelector("#a2olist .inhalt").children.length, check: [...document.querySelectorAll(".a2check th")].map((t) => t.textContent), satz: k.querySelector(".vsatz")?.textContent || "" };
    });
    assert(v.dts.some((d) => /Abstand der Salven/.test(d)) && !v.dts.some((d) => /Takt|Bereit/.test(d)), "an der Ventius-Karte der Abstand der Salven, kein Takt und kein Bereit (Entscheidung offen, Empfehlung)", v.dts);
    assert(v.check.some((t) => /Ventius an der Decke/.test(t)) && v.check.some((t) => /Ventius-Treffer gesetzt/.test(t)), "die Checkliste traegt die Ventius-Zeilen", v.check);
    assert(/ein Punkt ist ein Nachbeben/.test(v.satz) && /Kein Spielwert/.test(v.satz), "die Karte sagt: ein Punkt ist ein Nachbeben, die Decke ist kein Spielwert", v.satz);
    // das Urteil nennt die fehlenden Treffer ueber alle Salven, nicht "unter der Decke" (das las sich neben "1 Salve erreichte weniger als 7 Nachbeben" widerspruechlich; Entscheidung 11.11.2026)
    const vu = await page.evaluate(() => ({ uv: document.querySelector("#analysisCall .uv")?.textContent || "", tafel: document.querySelector("#urteilInhalt .uv")?.textContent || "" }));
    assert(/^\d+ Treffer fehlten über alle Salven von Auge von Ventius, etwa \S+\.$/.test(vu.uv) && vu.tafel === vu.uv, "Urteil: die fehlenden Treffer ueber alle Salven, in der Analyse wie in der Tafel", vu);
    assert(!v.offen && v.innenZu === 0 && v.listeZu === 0, "geschlossene Teile (Ventius-Raster, Opener-Liste) halten noch keinen Inhalt", v);
    await page.evaluate(() => { document.querySelector("#a2vent").open = true; document.querySelector("#a2olist").open = true; });
    await page.waitForFunction(() => document.querySelector("#a2vinnen").children.length > 0 && document.querySelector("#a2olist .inhalt").children.length > 0);
    const o = await page.evaluate(() => ({ salven: document.querySelectorAll(".a2salve").length, punkte: document.querySelector(".a2salve .voll") !== null, legende: document.querySelectorAll(".a2vlegende svg").length,
      oeffner: document.querySelectorAll(".a2salve .oeffner").length, stufen: document.querySelectorAll(".a2stufen tbody tr").length, liste: document.querySelectorAll("#a2olist ol li").length }));
    assert(o.salven >= 5 && o.punkte && o.legende === 5 && o.oeffner === o.salven && o.stufen >= 1 && o.liste >= 3, "aufgeklappt: Raster mit Oeffner-Strich und Punkten, Legende, Stufen, Opener-Liste", o);
    // der Aufklappzustand haelt ueber einen neuen Bereich
    await page.fill("#a2von", "0:00"); await page.fill("#a2bis", "0:20"); await page.dispatchEvent("#a2bis", "change");
    assert(await page.evaluate(() => document.querySelector("#a2vent").open && document.querySelectorAll(".a2salve").length > 0), "ein neuer Bereich laesst die Karte aufgeklappt");
    const im = await page.evaluate(() => document.querySelectorAll(".a2salve.aus").length);
    assert(im > 0, "Salven ausserhalb des Bereichs sind abgeblendet", im);
    assert(!fehler.length, "keine Seitenfehler", fehler);
    await page.close();
  }

  // ---------- die Werkbank ist abgeloest (#414): ihre Aussagen leben auf den Karten, #findings hat keine Faecher und Gruppen mehr
  {
    /* 60 s an Fellinex mit Faehigkeiten aller Arten (wie die Werkbank-Probe in test-analyse-page): Schnellfeuer alle 700 ms,
       Detonierendes Mal alle 6 s (30000), Protest von Mutter Natur alle 400 ms (300) ausser zwischen 20 und 32 s (Laufzeit, dicht),
       Blitzgeschwindigkeit alle 1300 ms mit 40000 (in der Waffentabelle "Passive": nie ein Fach). `fehl`: Fehlschlaege des Schnellfeuers. */
    const PR = ["Mother Nature's Protest", 963754730], LS = ["Lightning Speed", 940593086], QF = ["Quick Fire", 964762401], DM = ["Detonation Mark", 953174691];
    const Z = "Fellinex", PR_AUS = [20000, 32000];
    // `stumm`: in der Luecke des Protests trifft auch sonst nichts (dann ist es eine Luecke des Kampfes, kein "aus")
    const wbKampf = (start, { fehl = 0, stumm = false, tickGross = false } = {}) => {
      const tr = [], drin = (t) => t > PR_AUS[0] && t < PR_AUS[1], ruhe = (t) => stumm && drin(t);
      for (let t = 0, k = 0; t < 60000; t += 700, k++) if (!ruhe(t)) tr.push([start + t, QF[0], QF[1], 10000, k % 3 === 0, Z]);
      for (let t = 0; t < 60000; t += 6000) if (!ruhe(t)) tr.push([start + t, DM[0], DM[1], 30000, false, Z]);
      for (let t = 0; t < 60000; t += 1300) if (!ruhe(t)) tr.push([start + t, LS[0], LS[1], 40000, false, Z]);
      for (let t = 0; t < 60000; t += 400) if (!drin(t)) tr.push([start + t, PR[0], PR[1], 300, false, Z]);
      for (let i = 0; i < fehl; i++) tr.push([start + 3000 + i * 4000, tickGross ? PR[0] : QF[0], tickGross ? PR[1] : QF[1], 0, false, Z, true]);
      // der groesste Treffer des Kampfes faellt auf einen Tick (Protest von Mutter Natur hat keine Karte)
      if (tickGross) tr.push([start + 1000, PR[0], PR[1], 90000, false, Z]);
      return tr;
    };
    const mmss = (s) => Math.floor(s / 60) + ":" + two(s % 60);
    const kartenInfo = (page) => page.evaluate(() => [...document.querySelectorAll(".a2karte")].map((k) => ({ n: k.dataset.skill, text: k.textContent, dts: [...k.querySelectorAll("dt")].map((d) => d.textContent), vent: k.classList.contains("vent") })));
    // 1. ohne Fehlschlaege
    {
      const { page, fehler } = await oeffne();
      await ladeLog(page, datei("wb.txt", wbKampf(T0)), Z);
      await page.waitForFunction(() => { const a = document.querySelector("#a2"); return a && !a.hidden && document.querySelector(".a2karte"); });
      const alt = await page.evaluate(() => ({ faecher: document.querySelectorAll("#findings .wbfach, #findings .wbzeile, #findings .wbgruppe, #findings .wbbank").length,
        koepfe: [...document.querySelectorAll("#findings :is(h3,h4)")].map((h) => h.textContent.trim()) }));
      assert(alt.faecher === 0 && !alt.koepfe.some((h) => /Laufzeit|Weitere Fähigkeiten|Passiv|Mehr zu/.test(h)), "#findings hat keine Faecher, Zeilen und Gruppen der Werkbank mehr", alt);
      const karten = await kartenInfo(page);
      const nameVon = (rx) => karten.find((k) => rx.test(k.n) || rx.test(k.text));
      // Laufzeit (dicht): die Luecke des Protests steht als Satz der Karte, wie vorher in der Zeile
      // (der Prüfstand führt den Protest als Tick, nicht als Karte: sein Satz steht in der Zeile der Ticks unter den Karten)
      const pr = await page.evaluate(() => { const l = [...document.querySelectorAll("#a2skills .a2tsatz li")].find((x) => /Mother Nature|Mutter Natur/.test(x.textContent)); return l ? { text: l.textContent } : null; });
      assert(!!pr && pr.text.includes("12 s aus, ab " + mmss(20)), "Protest von Mutter Natur: die Karte sagt, wie lange er aus war und ab wann", pr && pr.text.slice(0, 300));
      assert(!!pr && /Vergessen einzuschalten/.test(pr.text), "Protest: die Frage \"Vergessen einzuschalten?\" steht an der Karte", pr && pr.text.slice(0, 300));
      // Passiv: Treffer statt Einsaetze, ohne den Takt-Satz
      const nLs = wbKampf(T0).filter((r) => r[1] === LS[0]).length;
      const ls = nameVon(/Lightning Speed|Blitzgeschwindigkeit/);
      assert(!!ls && ls.text.includes(nLs + " Treffer, ausgelöst durch deine anderen Treffer"), "Blitzgeschwindigkeit (passiv): die Karte zaehlt Treffer und sagt, wodurch sie ausgeloest sind", ls && ls.text.slice(0, 300));
      // Passiv bleibt eine eigene Gruppe (Entscheidung O8, 10.11.2026): Ueberschrift "Passiv", die passive Karte steht darin, keine andere
      const pg = await page.evaluate(() => { const s = document.querySelector("#a2skills .a2passiv"); return { h: s?.querySelector("h4")?.textContent || null,
        karten: s ? [...s.querySelectorAll(".a2karte")].map((k) => k.dataset.skill) : [], aussen: [...document.querySelectorAll("#a2skills .a2karte")].filter((k) => !k.closest(".a2passiv")).map((k) => k.dataset.skill) }; });
      const hb = await page.evaluate(() => { const h = document.querySelector("#a2skills .a2passiv > :is(h3,h4)"); return { tag: h?.tagName || "", ids: [...document.querySelectorAll("#a2 :is(h3,h4)")].filter((x) => x.getClientRects().length).map((x) => x.tagName + " " + x.textContent.trim()) }; });
      // die Gruppe ist eine Untergruppe von "Deine Faehigkeiten": h4, nach der h3 (Ueberschriftenbaum ohne Sprung)
      assert(hb.tag === "H4" && hb.ids.indexOf("H4 Passiv") > hb.ids.indexOf("H3 Deine Fähigkeiten") && hb.ids.indexOf("H3 Deine Fähigkeiten") >= 0, "Passiv ist ein h4 unter \"Deine Faehigkeiten\" (Ueberschriftenbaum ohne Sprung)", hb);
      assert(pg.h === "Passiv" && pg.karten.length === 1 && /Lightning Speed/.test(pg.karten[0]) && !pg.aussen.some((n) => /Lightning Speed/.test(n)),
        "Passiv ist eine eigene Gruppe mit Ueberschrift, die passive Faehigkeit steht als Karte darin", pg);
      // Groesster Treffer: an der Karte der Faehigkeit, die ihn schlug (40000 = 40.0k, Blitzgeschwindigkeit)
      const mitGroesst = karten.filter((k) => k.dts.some((d) => /Größter Treffer/.test(d)));
      assert(mitGroesst.length === 1 && /Lightning Speed|Blitzgeschwindigkeit/.test(mitGroesst[0].n + mitGroesst[0].text) && /40\.0k/.test(mitGroesst[0].text), "der groesste Treffer steht an der Karte, die ihn schlug (und nur dort)", mitGroesst.map((k) => k.n));
      // Fehlschlaege: ohne Fehlschlag steht "keine" an genau einer Karte (der staerksten), nicht im Nichts
      const keine = karten.filter((k) => k.dts.some((d) => /Fehlschläge/.test(d)));
      assert(keine.length === 1 && /keine/.test(keine[0].text), "ohne Fehlschlaege sagt genau eine Karte \"keine\"", keine.map((k) => k.n));
      // Fenster-Auswertung und Fuss bleiben unter dem Pruefstand, nicht in einem Fach
      const fen = await page.evaluate(() => { const h = document.querySelector("#fensterH"); return { da: !!h, inKarte: !!h?.closest(".a2karte, .a2"), inFindings: !!h?.closest("#findings") }; });
      assert(!fen.da || (fen.inFindings && !fen.inKarte), "die Frage nach dem Fenster steht, wo sie vorkommt, unter dem Pruefstand in #findings", fen);
      assert(!fehler.length, "keine Seitenfehler", fehler);
      await page.close();
    }
    // 2. mit Fehlschlaegen: der Satz steht an der Karte der Faehigkeit mit den meisten
    {
      const { page, fehler } = await oeffne();
      await ladeLog(page, datei("wb-fehl.txt", wbKampf(T0, { fehl: 3 })), Z);
      await page.waitForFunction(() => document.querySelector(".a2karte"));
      const karten = await kartenInfo(page);
      const f = karten.filter((k) => k.dts.some((d) => /Fehlschläge/.test(d)));
      assert(f.length === 1 && /Quick Fire|Schnellfeuer/.test(f[0].n + f[0].text) && /3 · /.test(f[0].text), "Fehlschlaege: der Satz steht an der Karte der Faehigkeit mit den meisten", f.map((k) => ({ n: k.n, t: k.text.slice(0, 200) })));
      assert(!fehler.length, "keine Seitenfehler", fehler);
      await page.close();
    }
    // 3. in der Luecke des Protests trifft auch sonst nichts: eine Luecke des Kampfes, kein "aus" (Spezifikation der Werkbank 5.5)
    {
      const { page, fehler } = await oeffne();
      await ladeLog(page, datei("wb-stumm.txt", wbKampf(T0, { stumm: true })), Z);
      await page.waitForFunction(() => document.querySelector(".a2karte"));
      const pr = await page.evaluate(() => { const l = [...document.querySelectorAll("#a2skills .a2tsatz li")].find((x) => /Mother Nature|Mutter Natur/.test(x.textContent)); return l ? l.textContent : null; });
      assert(pr !== null && !/\d+[\s\u00a0]s aus\b/.test(pr) && /Lief /.test(pr), "ohne fremde Treffer in der Luecke sagt der Protest kein \"aus\", sondern wie lange er lief", pr);
      assert(!fehler.length, "keine Seitenfehler", fehler);
      await page.close();
    }
    // 3b. Ticks haben keine Karte: faellt der groesste Treffer oder ein Fehlschlag auf einen, steht die Aussage in seiner Zeile
    {
      const { page, fehler } = await oeffne();
      await ladeLog(page, datei("wb-tick.txt", wbKampf(T0, { fehl: 2, tickGross: true })), Z);
      await page.waitForFunction(() => document.querySelector(".a2karte"));
      const z = await page.evaluate(() => {
        const l = [...document.querySelectorAll("#a2skills .a2tsatz li")].find((x) => /Mother Nature|Mutter Natur/.test(x.textContent));
        return { zeile: l ? l.textContent : null, karten: [...document.querySelectorAll(".a2karte")].filter((k) => /Größter Treffer|Fehlschläge/.test(k.textContent)).length };
      });
      assert(z.zeile !== null && /Größter Treffer/.test(z.zeile) && /90\.0k/.test(z.zeile), "der groesste Treffer auf einem Tick steht in dessen Zeile", z);
      assert(z.zeile !== null && /Fehlschläge/.test(z.zeile) && /2 · /.test(z.zeile), "Fehlschlaege eines Ticks stehen in dessen Zeile", z);
      assert(z.karten === 0, "und an keiner Karte (nichts doppelt, nichts verloren)", z);
      assert(!fehler.length, "keine Seitenfehler", fehler);
      await page.close();
    }
    // 3c. Kontrast der neuen Zeilen in allen vier Themen, Satzbreite bei 2000 x 1480 (#110: hoechstens 70 Zeichen)
    {
      const { page } = await oeffne();
      await ladeLog(page, datei("wb-kontrast.txt", wbKampf(T0, { fehl: 3, tickGross: false })), Z);
      await page.waitForFunction(() => document.querySelector(".a2karte"));
      await page.setViewportSize({ width: 2000, height: 1480 });
      for (const th of ["dark", "light", "tnl", "glas"]) {
        await page.evaluate((t) => document.querySelector(`#themeRow [data-theme="${t}"]`)?.click(), th);
        await page.waitForFunction((t) => document.documentElement.dataset.theme === t, th);
        const k = await page.evaluate(() => {
          const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
          const grund = (e) => { for (let x = e; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (!/rgba?\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return "rgb(0, 0, 0)"; };
          return [".a2karte .zsatz", ".a2karte .wbfein", ".a2karte .find dd.n", ".a2tsatz li", ".a2karte .satz"].map((sel) => {
            const e = document.querySelector(sel); if (!e) return [sel, null];
            const a = lum(getComputedStyle(e).color), b = lum(grund(e)), hi = Math.max(a, b), lo = Math.min(a, b);
            return [sel, +((hi + 0.05) / (lo + 0.05)).toFixed(2)];
          });
        });
        assert(k.every(([, v]) => v !== null && v >= 4.5), `Thema ${th}: Kontrast der Saetze und Zeilen an den Karten mindestens 4,5:1`, k);
      }
      const breite = await page.evaluate(() => [".a2karte .satz", ".a2karte .zsatz", ".a2karte .wbfein"].map((sel) => {
        const e = document.querySelector(sel); if (!e) return [sel, -1];
        const m = document.createElement("span"); m.textContent = "0".repeat(100); m.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:inherit";
        e.appendChild(m); const ch = m.getBoundingClientRect().width / 100; m.remove(); return [sel, +(e.getBoundingClientRect().width / ch).toFixed(1)];
      }));
      assert(breite.every(([, v]) => v > 0 && v <= 70.5), "bei 2000 x 1480: kein Satz an den Karten breiter als 70 Zeichen", breite);
      await page.close();
    }
    // 4. Tab: von der Bereichsleiste erst durch die Zeitleiste (Marken, Kurve), dann durch die Karten, jede Karte mit ihrem Namen als Knopf (#107)
    {
      const { page } = await oeffne();
      await beispiel(page);
      await page.evaluate(() => document.querySelector('#bereiche [data-tab="analysis"]').focus());
      const folge = [];
      for (let i = 0; i < 90; i++) {
        await page.keyboard.press("Tab");
        const k = await page.evaluate(() => { const a = document.activeElement; return a?.closest("#p-analysis") ? (a.closest(".a2karte") ? "karte" : a.closest("#a2") ? "zeit" : "sonst") : "aus"; });
        if (!folge.length || folge[folge.length - 1] !== k) folge.push(k);
      }
      const iZ = folge.indexOf("zeit"), iK = folge.indexOf("karte");
      assert(iZ >= 0 && iK > iZ, "Tab erreicht erst die Zeitleiste, dann die Karten", folge);
      await page.close();
    }
    // 4b. Sturmstroemung ist ein Tick: ihr Satz steht in der Zeile der Ticks, nicht in der Gruppe Passiv (Entscheidung O8)
    {
      const { page } = await oeffne();
      await beispiel(page);
      const st = await page.evaluate(() => ({ zeile: [...document.querySelectorAll("#a2skills .a2tsatz li")].map((l) => l.textContent).find((x) => /Sturmströmung|Storm Current/.test(x)) || null,
        inGruppe: !!document.querySelector("#a2skills .a2passiv") && /Sturmströmung|Storm Current/.test(document.querySelector("#a2skills .a2passiv").textContent) }));
      assert(st.zeile !== null && /ausgelöst durch deine anderen Treffer/.test(st.zeile) && !st.inGruppe, "Sturmstroemung (Tick): der Satz steht in der Tick-Zeile, nicht in der Gruppe Passiv", st);
      await page.close();
    }
    // 5. das Beispiel: die Ventius-Karte traegt den Weg in die Rekorde
    {
      const { page } = await oeffne();
      await beispiel(page);
      const rk = await page.evaluate(() => ({ an: document.querySelectorAll(".a2karte.vent .wbrk").length, sonst: document.querySelectorAll(".a2karte:not(.vent) .wbrk, #findings .wbrk").length }));
      assert(rk.an === 1 && rk.sonst === 0, "die Ventius-Karte traegt den Weg in die Rekorde (Bester Einsatz je Boss), sonst keine Karte", rk);
      await page.close();
    }
  }

  // ---------- Englisch: dieselben Schluessel, kein deutscher Satz
  {
    const { page } = await oeffne("en");
    await beispiel(page);
    const e = await page.evaluate(() => ({ text: document.querySelector("#a2").textContent, satz: document.querySelector("#a2satz").textContent, dts: [...document.querySelectorAll(".a2karte dt")].map((d) => d.textContent) }));
    assert(/^Whole fight: .*per second/.test(e.satz), "EN: der Satz des Bereichs", e.satz);
    const eu = await page.evaluate(() => document.querySelector("#analysisCall .uv")?.textContent || "");
    assert(/^\d+ hits missing across all volleys of Eye of Ventius, about \S+\.$/.test(eu), "EN: das Urteil nennt die fehlenden Treffer ueber alle Salven", eu);
    assert(!/Einsätze|Lücke|Salven|Leerlauf|Kritisch|Fähigkeit/.test(e.text), "EN: kein deutsches Wort in der neuen Analyse", e.text.match(/Einsätze|Lücke|Salven|Leerlauf|Kritisch|Fähigkeit/));
    assert(!/analysis\.e\./.test(e.text), "EN: kein roher Schluessel");
    assert(e.dts.includes("Casts") || e.dts.includes("Volleys"), "EN: Karten tragen englische Namen der Zahlen", e.dts.slice(0, 6));
    await page.close();
  }

  // ---------- unter 20 Treffern: nur Zaehlungen, die neue Analyse bleibt weg (wie die Werkbank)
  {
    const { page } = await oeffne();
    await ladeLog(page, datei("duenn.txt", dünn("Probeziel")), "Probeziel");
    await page.waitForFunction(() => document.querySelector('[data-tab="analysis"]'));
    const h = await page.evaluate(() => { const a = document.querySelector("#a2"); return { hidden: !a || a.hidden, karten: document.querySelectorAll(".a2karte").length }; });
    assert(h.hidden && h.karten === 0, "unter 20 Treffern bleibt die neue Analyse weg", h);
    await page.close();
  }
  // ---------- Salven im besten Pull (#414): schreiben, gegen den Pull stellen, einen alten Pull ohne sie benennen
  {
    /* Ein Kampf an Vulcanus mit Salven von Auge von Ventius: ein Oeffner, nach 950 ms Wellen zu drei Treffern im selben
       Tick, alle 3,4 s. `nbs` sind die Nachbeben je Salve; dazu Quick Fire, damit der Kampf genug Treffer hat. */
    const salvenLog = (name, start, nbs, skala) => {
      const z = "Vulcanus", r = [];
      nbs.forEach((nb, i) => {
        const t = start + i * 3400;
        r.push([t, "Decisive Sniping", 964631505, 190000 * skala, true, z]);
        for (let w = 0; w < nb; w++) for (let h = 0; h < 3; h++) r.push([t + 950 + w * 100, "Decisive Sniping", 964631505, 55000 * skala, true, z]);
        r.push([t + 1500, "Quick Fire", 964762401, 4000 * skala, false, z]);
        r.push([t + 1600, "Quick Fire", 964762401, 4000 * skala, false, z]);
      });
      return datei(name, r);
    };
    const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
    const SA = Date.UTC(2026, 8, 17, 21, 0, 0), SB = Date.UTC(2026, 8, 18, 21, 0, 0);
    const logA = salvenLog("salven-a.txt", SA, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], 1.5);
    const logB = salvenLog("salven-b.txt", SB, [3, 3, 2, 1, 3, 2, 3, 1, 3, 3], 1.0);
    let gespeichert = null;
    const served = async (best) => {
      const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const fehler = [];
      p.on("pageerror", (e) => fehler.push(String(e)));
      await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* blockiert */ } });
      await p.route("http://boro.test/**", async (route) => {
        const req = route.request(), pfad = new URL(req.url()).pathname;
        const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
        if (pfad === "/api/best" && req.method() === "GET") return json(200, { ok: true, best });
        if (pfad === "/api/best" && req.method() === "POST") { gespeichert = JSON.parse(req.postData() || "{}"); return json(200, { ok: true }); }
        if (pfad.startsWith("/api/")) return json(200, {});
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
      });
      await p.goto("http://boro.test/index.html");
      return { p, fehler };
    };
    // 1. der erste Pull wird mit den Salven festgehalten
    const s1 = await served({});
    await s1.p.setInputFiles("#fileInput", logA);
    for (const end = performance.now() + 20000; performance.now() < end && !gespeichert;) await s1.p.waitForTimeout(250);
    await s1.p.close();
    const v = gespeichert?.entry?.best?.run?.ventius;
    assert(gespeichert && Array.isArray(v) && v.length === 10 && v.every((x) => x.length === 3 && x.every(Number.isFinite)),
      "der beste Pull wird mit seinen Salven festgehalten: Beginn, Nachbeben, Treffer", v);
    assert(v && v.every((x) => x[1] === 3 && x[2] === 10) && v[1][0] - v[0][0] === 3400, "drei Nachbeben, zehn Treffer, Beginn in ms ab Kampfbeginn", v && v.slice(0, 2));
    assert(Array.isArray(gespeichert?.entry?.best?.run?.casts) && gespeichert.entry.best.run.casts.length > 0, "die Einsaetze bleiben wie bisher dabei");
    const schluessel = gespeichert.key, mit = structuredClone(gespeichert.entry);
    // 2. ein schwaecherer Pull wird gegen die Salven des besten gestellt
    const s2 = await served({ [schluessel]: mit });
    await s2.p.setInputFiles("#fileInput", logB);
    await s2.p.waitForFunction(() => /Vulcanus/.test(document.querySelector("#hName")?.textContent || ""));
    await s2.p.evaluate(() => document.querySelector('[data-tab="analysis"]').click());
    await s2.p.waitForFunction(() => document.querySelector(".a2karte.vent"));
    const vs = await s2.p.evaluate(() => ({ satz: document.querySelector(".a2karte.vent .satz")?.textContent || "", besser: document.querySelector("#a2besser").textContent }));
    assert(/Im besten Pull 10 von 10 lesbaren Salven an der Decke, hier \d+ von \d+/.test(vs.besser + " " + vs.satz), "gegen den besten Pull: dessen Salven an der Decke gegen die hier", vs);
    assert(!/kennt die Salven noch nicht/.test(vs.satz), "kein Hinweis, wo der Pull die Salven kennt");
    assert(!s2.fehler.length, "keine Seitenfehler", s2.fehler);
    await s2.p.close();
    // 3. ein aelterer Pull ohne das Feld bleibt, wie er ist, und die Karte sagt es
    const alt = structuredClone(mit);
    delete alt.best.run.ventius;
    const s3 = await served({ [schluessel]: alt });
    await s3.p.setInputFiles("#fileInput", logB);
    await s3.p.waitForFunction(() => /Vulcanus/.test(document.querySelector("#hName")?.textContent || ""));
    await s3.p.evaluate(() => document.querySelector('[data-tab="analysis"]').click());
    await s3.p.waitForFunction(() => document.querySelector(".a2karte.vent"));
    const k3 = await s3.p.evaluate(() => ({ satz: document.querySelector(".a2karte.vent .satz")?.textContent || "", gesamt: document.querySelector("#a2").textContent }));
    assert(/Der gespeicherte Pull kennt die Salven noch nicht/.test(k3.gesamt), "ein Pull ohne Salven: die Karte sagt, dass er sie noch nicht kennt", k3.satz);
    assert(!/Im besten Pull \d+ von \d+ lesbaren Salven/.test(k3.gesamt), "und rechnet keinen Vergleich daraus");
    assert(!s3.fehler.length, "keine Seitenfehler mit dem alten Pull", s3.fehler);
    await s3.p.close();
  }

} finally {
  await browser.close();
}
if (failed) { console.log("\n" + failed + " failed"); process.exit(1); }
console.log("\nalles gruen");
