// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Schaerfe der Heldenzahl (Vorhaben schrift-balken, Teil 1): Kontur und
// Schattenversatz von .big .v, #ringMitglied .v und .rkheld .hzahl (#284) sind
// bei jedem Zoom und jeder Pixeldichte GANZE Geraete-Pixel. Bei 75 % waren die
// 2px der Kontur 1,5 Geraete-Pixel, die Kante lag zwischen zwei Pixeln und die
// Zahl wirkte verwaschen. Gemessen wird nicht ein Bild, sondern der Wert, der
// das Bild bestimmt: berechneter Wert (Layoutpunkte) x Zoom x devicePixelRatio.
// Dazu: die Zahl steht in allen vier Themen, und die Kontur ist nie duenner als
// ein Geraete-Pixel.
//
// Teil 2 (Balken, Metall-Glanz): die Textur der Balken (.fill) ist reines Hell und
// Dunkel (jede Stufe grau: r = g = b, nie ein Farbton, kein Rot und kein Gruen als
// Urteil), und ihre erste Kante, die helle Oberkante, ist ein ganzes Geraete-Pixel.
// Der Kompaktbalken traegt nur die beiden Kanten.
//
// Die Seite laeuft aus der Datei (Datei-Modus, kein Server); der Zoom kommt von
// der Tastatur (Strg + / Strg -), wie beim Nutzer.
//
// Run:  npm run test:schaerfe-page     (baut die Seite zuerst)
// Mit Edge: PARITY_CHROMIUM="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATEI = "file:///" + join(root, "dist", "renderer", "index.html").replace(/\\/g, "/").replace(/^\/+/, "");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 600))); }
}

const STUFEN = [75, 100, 150, 200];
const THEMEN = ["dark", "light", "tnl", "glas"];
const DICHTEN = [1, 1.25, 1.5];
const ZIELE = [".rkheld .hzahl", ".big .v", "#ringMitglied .v"];

const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});
try {
  for (const dpr of DICHTEN) {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: dpr });
    const p = await ctx.newPage();
    await p.goto(DATEI);
    await p.waitForSelector("#zoomIn", { state: "attached" });
    // frisch geladen, ohne dass jemand gezoomt hat: ein Geraete-Pixel ist ein Geraete-Pixel
    const frisch = await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--geraete-px")) * window.devicePixelRatio);
    assert(Math.abs(frisch - 1) < 0.01, `dpr ${dpr}: beim Start ist --geraete-px ein Geraete-Pixel`, frisch);
    for (const stufe of STUFEN) {
      // Strg+0, dann die Stufen der Tastatur bis zur gewuenschten (die Seite kennt keine andere Tuer)
      await p.keyboard.press("Control+0");
      let guard = 0;
      while (guard++ < 12) {
        const z = await p.evaluate(() => Math.round(parseFloat(document.documentElement.style.zoom || "1") * 100));
        if (z === stufe) break;
        await p.keyboard.press(z < stufe ? "Control+=" : "Control+-");
      }
      const z = await p.evaluate(() => Math.round(parseFloat(document.documentElement.style.zoom || "1") * 100));
      assert(z === stufe, `dpr ${dpr}: Zoom ${stufe} % steht`, z);
      for (const theme of THEMEN) {
        const mess = await p.evaluate(({ theme, ZIELE }) => {
          document.documentElement.dataset.theme = theme;
          let box = document.getElementById("schaerfeBox");
          if (!box) {
            box = document.createElement("div"); box.id = "schaerfeBox";
            box.innerHTML = '<div class="rkheld"><div class="h1"><div class="hzahl">1.11M</div></div></div>'
              + '<div class="big"><div class="v">123.4k</div></div><div id="ringMitglied"><div class="v">5.6k</div></div>';
            document.body.append(box);
          }
          const zoom = parseFloat(document.documentElement.style.zoom || "1"), q = window.devicePixelRatio;
          return ZIELE.map((sel) => {
            const e = box.querySelector(sel), c = getComputedStyle(e);
            const strich = parseFloat(c.webkitTextStrokeWidth);
            const m = /(-?[\d.]+)px (-?[\d.]+)px/.exec(c.textShadow.replace(/color\([^)]*\)|rgba?\([^)]*\)/g, ""));
            return { sel, strich: strich * zoom * q, schatten: m ? parseFloat(m[2]) * zoom * q : null };
          });
        }, { theme, ZIELE });
        for (const m of mess) {
          const ganz = (x) => Math.abs(x - Math.round(x)) < 0.02;
          assert(m.strich >= 0.98 && ganz(m.strich), `dpr ${dpr}, ${stufe} %, ${theme}: Kontur von ${m.sel} ist ganze Geraete-Pixel`, m);
          assert(m.schatten !== null && m.schatten >= 0.98 && ganz(m.schatten), `dpr ${dpr}, ${stufe} %, ${theme}: Schatten von ${m.sel} sitzt auf ganzen Geraete-Pixeln`, m);
        }
      }
    }
    for (const [theme, kompakt] of [["dark", false], ["light", false], ["tnl", false], ["glas", false], ["dark", true]]) {
      for (const stufe of [75, 100, 200]) {
        await p.keyboard.press("Control+0");
        let guard = 0;
        while (guard++ < 12) {
          const z = await p.evaluate(() => Math.round(parseFloat(document.documentElement.style.zoom || "1") * 100));
          if (z === stufe) break;
          await p.keyboard.press(z < stufe ? "Control+=" : "Control+-");
        }
        const t = await p.evaluate(({ theme, kompakt }) => {
          document.documentElement.dataset.theme = theme;
          document.body.classList.toggle("compact", kompakt);
          let box = document.getElementById("balkenBox");
          if (!box) {
            box = document.createElement("div"); box.id = "balkenBox";
            box.innerHTML = '<div id="bars"><div class="row"><div class="fill" style="--c:#6baffa;--w:.5"></div></div></div>';
            document.body.append(box);
          }
          const f = box.querySelector(".fill"), bild = getComputedStyle(f).backgroundImage;
          const zoom = parseFloat(document.documentElement.style.zoom || "1"), q = window.devicePixelRatio;
          // erste Ebene = die Textur; ihre rgba-Stufen und das Ende der ersten Kante
          const ebene = bild.split(/\), (?=linear-gradient|repeating)/)[0];
          const farben = [...ebene.matchAll(/rgba?\((\d+), (\d+), (\d+)/g)].map((m) => [+m[1], +m[2], +m[3]]);
          // die erste Stufe mit einer Lage ueber 0: dort endet die helle Oberkante
          const kante = [...ebene.matchAll(/rgba?\([^)]*\) ([\d.]+)px/g)].map((m) => parseFloat(m[1])).find((v) => v > 0);
          return { ebenen: (bild.match(/linear-gradient/g) || []).length, farben, kantePx: kante ? kante * zoom * q : null };
        }, { theme, kompakt });
        const name = `dpr ${dpr}, ${stufe} %, ${theme}${kompakt ? " kompakt" : ""}`;
        assert(t.ebenen >= (kompakt ? 1 : 2) && t.farben.length >= 2 && t.farben.every(([r, g, b]) => r === g && g === b), `${name}: die Textur des Balkens ist nur Hell und Dunkel`, t);
        assert(t.kantePx !== null && Math.abs(t.kantePx - Math.round(t.kantePx)) < 0.02 && t.kantePx >= 0.98, `${name}: die helle Oberkante ist ein ganzes Geraete-Pixel`, t);
      }
    }
    await p.evaluate(() => document.body.classList.remove("compact"));
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(failed ? `\n${failed} FAIL` : "\nalles ok");
process.exit(failed ? 1 : 0);
