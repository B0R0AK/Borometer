// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die Zeitleiste der neuen Analyse (#414, Spezifikation
// 2026-11-08-analyse-neu-zeitleiste-design.md 2.2 bis 2.4, 7) an der gebauten
// Seite, im Beispielkampf der App: Bereich per Ziehen, Tippen und Tastatur,
// Marken, Wahl einer Faehigkeit (Kerben, Daempfung, Ansage), Zeigen,
// Bedienbarkeit (Flaechen, Namen, Symbole), kein waagerechtes Rollen in allen
// Themen und Groessen. Wartet auf Zustaende, nie auf feste Zeiten.
//
// Run:  npm run test:zeitleiste-page     (baut die Seite zuerst)

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { gebauterModus } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BILDER = gebauterModus(root) === "voll";
const dist = pathToFileURL(process.env.ANALYSE_DIST || join(root, "dist", "renderer", "index.html")).href;
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/** Die Seite im Beispielkampf, im Bereich Analyse, bis die Zeitleiste steht. */
async function oeffne({ breite = 1280, hoehe = 900, lang = "de", thema = "dark", ruhig = false } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe }, ...(ruhig ? { reducedMotion: "reduce" } : {}) });
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(String(e)));
  await page.addInitScript(([l]) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, [lang]);
  await page.goto(dist);
  await page.waitForSelector("button");
  await page.evaluate(() => {
    const k = [...document.querySelectorAll("button")].find((e) => /^(beispiel|sample)$/i.test((e.textContent || "").trim()));
    if (k) k.click();
  });
  await page.waitForFunction(() => document.querySelector('[data-tab="analysis"]'));
  await page.evaluate((th) => { document.documentElement.setAttribute("data-theme", th); document.querySelector('[data-tab="analysis"]').click(); }, thema);
  await page.waitForFunction(() => { const a = document.querySelector("#a2"); return a && !a.hidden && document.querySelector("#a2kurve") && document.querySelector(".a2karte"); });
  return { page, fehler };
}
const brush = (p) => p.evaluate(() => { const b = document.querySelector("#a2brush"); return { sichtbar: !!b && !b.hidden, von: document.querySelector("#a2von").value, bis: document.querySelector("#a2bis").value,
  ganz: document.querySelector("#a2ganz").getAttribute("aria-pressed") }; });

try {
  // ---------- Aufbau im Beispielkampf (Ventius vorhanden)
  {
    const { page, fehler } = await oeffne();
    const z = await page.evaluate(() => ({
      karten: document.querySelectorAll(".a2karte").length, ventius: document.querySelectorAll(".a2karte.vent").length, marken: document.querySelectorAll(".a2marke").length,
      bahnen: document.querySelectorAll("#a2graf .a2bahn").length, gut: document.querySelectorAll("#a2gut li").length, besser: document.querySelectorAll("#a2besser li").length,
      check: document.querySelectorAll(".a2check tbody tr").length, opener: document.querySelectorAll("#a2opener .a2spur").length,
      satz: document.querySelector("#a2satz").textContent, kurve: !!document.querySelector("#a2kurve svg path"),
      leck: /analysis\.e\./.test(document.querySelector("#a2").textContent),
    }));
    assert(z.karten >= 4 && z.ventius === 1 && z.marken >= 3 && z.bahnen >= 4 && z.gut >= 1 && z.check >= 5 && z.opener >= 1 && z.kurve, "Aufbau: Karten, Ventius-Karte, Marken, Bahnen, Checkliste, Opener, Kurve", z);
    assert(/^Im ganzen Kampf: .*je Sekunde/.test(z.satz), "der Satz des Bereichs nennt den ganzen Kampf", z.satz);
    assert(!z.leck, "kein Woerterbuch-Schluessel steht roh auf der Seite");
    assert(!fehler.length, "keine Seitenfehler", fehler);
    await page.close();
  }

  // ---------- Bereich: Tastatur
  {
    const { page } = await oeffne();
    assert((await brush(page)).ganz === "true" && !(await brush(page)).sichtbar, "am Anfang: ganzer Kampf, kein Bereich");
    await page.focus("#a2fokus");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector("#a2ganz").getAttribute("aria-pressed") === "false");
    let b = await brush(page);
    assert(b.sichtbar && b.von === "0:00" && b.bis === "0:10", "Pfeil rechts setzt die ersten 10 s", b);
    await page.keyboard.press("ArrowRight");
    b = await brush(page);
    assert(b.von === "0:01" && b.bis === "0:11", "noch einmal: um 1 s weiter", b);
    await page.keyboard.press("Shift+ArrowRight");
    b = await brush(page);
    assert(b.von === "0:06" && b.bis === "0:16", "mit Umschalt: um 5 s", b);
    await page.keyboard.press("Control+ArrowRight");
    b = await brush(page);
    assert(b.von === "0:07" && b.bis === "0:16", "Strg verschiebt den Anfang", b);
    await page.keyboard.press("Alt+ArrowRight");
    b = await brush(page);
    assert(b.von === "0:07" && b.bis === "0:17", "Alt verschiebt das Ende", b);
    await page.keyboard.press("+");
    b = await brush(page);
    assert(b.von === "0:06" && b.bis === "0:18", "+ weitet", b);
    await page.keyboard.press("-");
    b = await brush(page);
    assert(b.von === "0:07" && b.bis === "0:17", "- verengt", b);
    const ansage = await page.evaluate(() => document.querySelector("#a2satz").textContent);
    assert(/0:07/.test(ansage) && /0:17/.test(ansage), "der Satz der Auswertung nennt den Bereich (aria-live)", ansage);
    await page.keyboard.press("Escape");
    b = await brush(page);
    assert(!b.sichtbar && b.ganz === "true", "Escape hebt den Bereich auf", b);
    await page.keyboard.press("End");
    b = await brush(page);
    assert(b.sichtbar && b.bis !== "0:00" && b.von !== b.bis, "Ende setzt die letzten 10 s", b);
    await page.close();
  }

  // ---------- Bereich: Maus und Tippen, Knoepfe
  {
    const { page } = await oeffne();
    await page.locator("#a2kurve").scrollIntoViewIfNeeded();
    const r = await page.evaluate(() => { const k = document.querySelector("#a2kurve").getBoundingClientRect(); return { x: k.left, y: k.top, w: k.width, h: k.height }; });
    await page.mouse.move(r.x + r.w * 0.2, r.y + r.h / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + r.w * 0.4, r.y + r.h / 2, { steps: 4 });
    await page.mouse.up();
    let b = await brush(page);
    assert(b.sichtbar && b.von !== "0:00" && b.von !== b.bis, "Ziehen auf der Kurve setzt einen Bereich", b);
    await page.mouse.click(r.x + r.w * 0.7, r.y + r.h / 2);
    b = await brush(page);
    assert(!b.sichtbar, "Klick ohne Ziehen hebt auf", b);
    await page.fill("#a2von", "0:10"); await page.fill("#a2bis", "0:30"); await page.dispatchEvent("#a2bis", "change");
    b = await brush(page);
    assert(b.sichtbar && b.von === "0:10" && b.bis === "0:30", "Von und bis tippen", b);
    await page.fill("#a2bis", "0:05"); await page.dispatchEvent("#a2bis", "change");
    assert((await page.getAttribute("#a2bis", "aria-invalid")) === "true", "ein Bereich mit bis vor von ist ungueltig und sagt es");
    await page.click("#a2spitze");
    assert((await page.getAttribute("#a2spitze", "aria-pressed")) === "true", "Staerkste 5 s waehlt ihre Strecke");
    await page.click("#a2luecke");
    assert((await page.getAttribute("#a2luecke", "aria-pressed")) === "true" && (await page.getAttribute("#a2spitze", "aria-pressed")) === "false", "Laengste Luecke waehlt ihre Strecke");
    await page.click("#a2ganz");
    assert(!(await brush(page)).sichtbar, "Ganzer Kampf hebt auf");
    // Linked Brushing: der Bereich rechnet die Karten neu
    const vorher = await page.evaluate(() => [...document.querySelectorAll(".a2karte")].map((k) => k.querySelector("dd").textContent));
    await page.fill("#a2von", "0:00"); await page.fill("#a2bis", "0:05"); await page.dispatchEvent("#a2bis", "change");
    const nachher = await page.evaluate(() => [...document.querySelectorAll(".a2karte")].map((k) => k.querySelector("dd").textContent));
    assert(JSON.stringify(vorher) !== JSON.stringify(nachher), "ein Bereich rechnet die Karten neu (Linked Brushing)");
    await page.close();
  }

  // ---------- Marken und Salven
  {
    const { page } = await oeffne();
    const m = [page.locator(".a2marke").first()];
    await m[0].click();
    assert(await page.evaluate(() => document.querySelector(".a2marke").getAttribute("aria-pressed") === "true" && document.querySelector("#a2brush") && !document.querySelector("#a2brush").hidden), "Klick auf eine Marke waehlt ihre Strecke");
    await m[0].click();
    assert(await page.evaluate(() => document.querySelector("#a2brush").hidden), "noch ein Klick hebt auf");
    await page.focus(".a2marke");
    await page.keyboard.press("Enter");
    assert(await page.evaluate(() => !document.querySelector("#a2brush").hidden), "Enter auf einer Marke waehlt ihre Strecke");
    await page.click("#a2ganz");
    await page.evaluate(() => { const d = document.querySelector("#a2vent"); d.open = true; });
    const n = await page.evaluate(() => ({ s: document.querySelectorAll(".a2salve").length, zeilen: document.querySelectorAll(".a2stufen tbody tr").length }));
    assert(n.s >= 5 && n.zeilen >= 1, "Ventius-Raster: eine Saeule je Salve, Stufen als Tabelle", n);
    await page.click(".a2salve");
    assert(await page.evaluate(() => !document.querySelector("#a2brush").hidden), "Klick auf eine Salve waehlt die Strecke um sie");
    await page.close();
  }

  // ---------- Wahl einer Faehigkeit: Kerben, Daempfung, Ansage, Zuruecknehmen
  {
    const { page } = await oeffne();
    const hinweisVorher = await page.textContent("#a2bahnHinweis");
    await page.hover("#a2graf .bezk >> nth=1");
    const lese = await page.textContent("#a2lese");
    assert(lese.length > 10, "Zeigen schreibt die Zahlen der Faehigkeit in die Lesezeile", lese);
    assert((await page.locator("#a2kerben i.vor").count()) > 0, "Zeigen setzt helle Vorschau-Kerben an den Fuss der Kurve");
    await page.click("#a2graf .bezk >> nth=1");
    const w = await page.evaluate(() => {
      const bk = document.querySelectorAll("#a2graf .bezk")[1], name = bk.closest("[data-skill]").dataset.skill;
      return { gedr: bk.getAttribute("aria-pressed"), kerben: document.querySelectorAll("#a2kerben i:not(.vor)").length, gewaehlt: document.querySelector("#a2graf").classList.contains("gewaehlt"),
        karte: !!document.querySelector('.a2karte.hebt[data-skill="' + CSS.escape(name) + '"]'), ansage: document.querySelector("#a2ansage").textContent, hinweis: document.querySelector("#a2bahnHinweis").textContent,
        beschr: bk.getAttribute("aria-describedby") };
    });
    assert(w.gedr === "true" && w.kerben >= 1 && w.gewaehlt && w.karte, "Klick auf den Bahnnamen waehlt: aria-pressed, goldene Kerben, andere Bahnen zurueck, Karte gehoben", w);
    assert(w.ansage.length > 10 && w.hinweis !== hinweisVorher && w.beschr === "a2bahnHinweis", "die Wahl wird angesagt und steht im Hinweis; der Knopf verweist darauf", w);
    await page.keyboard.press("Escape");
    assert(await page.evaluate(() => !document.querySelector("#a2graf").classList.contains("gewaehlt") && document.querySelectorAll("#a2kerben i:not(.vor)").length === 0), "Escape nimmt die Wahl zurueck, auch nach einem Mausklick");
    // Karte: Name waehlt, Enter und Leertaste ebenso
    await page.focus(".a2karte .nm");
    await page.keyboard.press("Enter");
    assert(await page.evaluate(() => !!document.querySelector(".a2karte.hebt") && document.querySelector("#a2graf").classList.contains("gewaehlt")), "Enter auf dem Kartennamen waehlt");
    await page.keyboard.press("Space");
    assert(await page.evaluate(() => !document.querySelector(".a2karte.hebt")), "Leertaste nimmt die Wahl zurueck");
    await page.close();
  }

  // ---------- Bedienbarkeit: Flaechen, Namen, Symbole
  {
    const { page } = await oeffne();
    const b = await page.evaluate(() => {
      const klein = [...document.querySelectorAll("#a2 button, #a2 input")].filter((e) => e.offsetParent).map((e) => ({ r: e.getBoundingClientRect(), c: e.className || e.id }))
        .filter((x) => x.r.height < 24 || x.r.width < 24).map((x) => x.c);
      const ohneName = [...document.querySelectorAll("#a2 button, #a2 input")].filter((e) => !((e.getAttribute("aria-label") || e.textContent || "").trim())).map((e) => e.className || e.id);
      const bilder = [...document.querySelectorAll("#a2 img")].filter((i) => i.getAttribute("alt") !== "" || i.getAttribute("aria-hidden") !== "true").length;
      const nImg = document.querySelectorAll("#a2 img").length;
      const klein11 = [...document.querySelectorAll("#a2 *")].filter((e) => e.children.length === 0 && (e.textContent || "").trim() && e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 11).length;
      return { klein, ohneName, bilder, nImg, klein11 };
    });
    assert(!b.klein.length, "jede Flaeche mindestens 24 Punkt", b.klein);
    assert(!b.ohneName.length, "jeder Knopf und jedes Feld hat einen Namen", b.ohneName);
    assert(!b.bilder, "alle Symbole sind Zierde (alt leer, aria-hidden)", b);
    assert(BILDER ? b.nImg > 0 : b.nImg === 0, BILDER ? "mit Spielbildern stehen Symbole" : "ohne Spielbilder stehen keine Symbole, die Namen bleiben", b.nImg);
    assert(b.klein11 === 0, "Schrift mindestens 11 Punkt", b.klein11);
    await page.close();
  }

  // ---------- kein waagerechtes Rollen: Groessen mal Themen, Deutsch und Englisch
  for (const [breite, hoehe] of [[2000, 1480], [1280, 860], [760, 860], [560, 860]]) {
    for (const thema of ["dark", "light", "tnl", "glas"]) {
      const { page, fehler } = await oeffne({ breite, hoehe, thema, lang: thema === "tnl" ? "en" : "de" });
      const q = await page.evaluate(() => ({ quer: document.documentElement.scrollWidth > document.documentElement.clientWidth, a2: document.querySelector("#a2").scrollWidth > document.querySelector("#a2").clientWidth + 1 }));
      assert(!q.quer && !q.a2 && !fehler.length, `${breite} x ${hoehe}, ${thema}: kein waagerechtes Rollen, keine Seitenfehler`, { q, fehler });
      await page.close();
    }
  }

  // ---------- Kontrast in allen vier Themen (WCAG 2.1 AA: 4,5:1 fuer Text) und Schrift mindestens 11 Punkt
  for (const thema of ["dark", "light", "tnl", "glas"]) {
    const { page } = await oeffne({ breite: 1600, hoehe: 1100, thema });
    await page.fill("#a2von", "0:20"); await page.fill("#a2bis", "0:50"); await page.dispatchEvent("#a2bis", "change");
    await page.evaluate(() => { document.querySelector("#a2vent").open = true; document.querySelector("#a2olist").open = true; document.querySelector("#a2tabZeit").open = true; });
    await page.waitForFunction(() => document.querySelector("#a2vinnen").children.length > 0);
    const r = await page.evaluate(() => {
      // color-mix() rechnet Chromium zu "color(srgb r g b)" mit Werten 0..1 aus
      const lum = (c) => { let m = c.match(/[\d.]+/g).map(Number); if (/^color\(srgb/.test(c)) m = m.map((v) => v * 255); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
      const bgVon = (el) => { let e = el; while (e) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c) && !/, 0(\.\d+)?\)$|\/ 0\.[0-4]\d*\)$/.test(c)) return c; e = e.parentElement; } return "rgb(0,0,0)"; };
      const kontrast = (a, c) => { const x = lum(a), y = lum(c); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
      const proben = [".a2bereich .satz", ".a2bereich .kopfzeile .zeit", ".a2kacheln dt", ".a2kacheln .n", ".a2kacheln .zahl", ".a2zwei li", ".a2zwei li.leer", ".a2check th", ".a2check td.z", ".a2check td.s", ".a2check td.s .vb",
        ".a2karte .nm .nmt", ".a2karte .ant small", ".a2karte .vsatz", ".a2vlegende", ".a2salve .tz", ".a2karte dt", ".a2karte dd", ".a2karte dd .n", ".a2karte .satz", ".a2karte .satz.ruhig", ".a2ticks",
        ".a2chip", ".a2steuer input", ".a2marke", ".a2graf .bez.name .nmt", ".a2lese", ".a2legende", ".a2bahnhinweis", ".a2tasten", ".a2tab summary", ".a2opener .l", ".a2opener ol", ".a2opener .achse span", ".a2achse span",
        ".a2zeit h3", ".a2tab td", ".a2vent summary", ".a2stufen td", ".a2fuss"];
      const schlecht = [];
      for (const s of proben) {
        const el = document.querySelector(s); if (!el || !el.offsetParent) continue;
        const cs = getComputedStyle(el), k = kontrast(cs.color, bgVon(el)), px = parseFloat(cs.fontSize);
        if (k < 4.5 || px < 11) schlecht.push(s + " " + k + " " + px + "px");
      }
      return schlecht;
    });
    assert(!r.length, `Kontrast mindestens 4,5:1 und Schrift mindestens 11 Punkt: ${thema}`, r);
    await page.close();
  }

  // ---------- 2000 x 1480: Kurve und Auswertung nebeneinander, ohne dass etwas gestreckt wird
  {
    const { page } = await oeffne({ breite: 2000, hoehe: 1480 });
    const r = await page.evaluate(() => { const z = document.querySelector(".a2zeit").getBoundingClientRect(), b = document.querySelector(".a2bereich").getBoundingClientRect(); return { zr: z.right, bl: b.left, zt: z.top, bt: b.top }; });
    assert(r.bl >= r.zr - 1 && Math.abs(r.zt - r.bt) < 2, "bei 2000 x 1480 steht die Auswertung neben der Zeitleiste", r);
    await page.close();
  }

  // ---------- reduzierte Bewegung: keine Uebergaenge beim Ziehen
  {
    const { page } = await oeffne({ ruhig: true });
    const d = await page.evaluate(() => getComputedStyle(document.querySelector(".a2bahn")).transitionDuration);
    assert(/^0s(, 0s)*$/.test(d), "bei reduzierter Bewegung keine Uebergaenge", d);
    await page.close();
  }
} finally {
  await browser.close();
}
if (failed) { console.log("\n" + failed + " failed"); process.exit(1); }
console.log("\nalles gruen");
