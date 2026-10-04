// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// The installer's pictures, drawn from the app's own material: the tokens and
// the embedded Archivo Black out of src/renderer/styles.css. NSIS wants 24-bit
// BMPs at fixed sizes, so a Chromium canvas draws them and this script writes
// the pixels out as BMP.
//
//   build/installerSidebar.bmp    164 x 314  welcome and finish page (install)
//   build/uninstallerSidebar.bmp  164 x 314  welcome and finish page (uninstall)
//   build/installerHeader.bmp     150 x  57  top right of every inner page
//   build/portableSplash.bmp      440 x 200  while the portable exe unpacks
//   build/taskbar/*.png           16 x 16 and @2x 32 x 32, the taskbar's live
//                                 dot and the preview's two buttons
//
// The ground of all three is --comb, the colour build/installer.nsh gives the
// pages themselves (MUI_BGCOLOR), so a picture has no edge against its page.
//
// Run:  npm run installer-art       (only when the look changes; the BMPs are
//                                    committed, the installer build reads them)
// Needs a Chromium: Playwright's own, or any other through PARITY_CHROMIUM.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src", "renderer", "styles.css"), "utf8");

/* The dark theme's tokens, read rather than copied, so the pictures follow the
   app if a colour there is ever measured again. */
function darkTokens() {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const i = plain.indexOf(":root{");
  let depth = 0, j = i + 5;
  for (; j < plain.length; j++) {
    if (plain[j] === "{") depth++;
    else if (plain[j] === "}" && --depth === 0) break;
  }
  const out = {};
  for (const m of plain.slice(i + 6, j).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const T = darkTokens();
const need = ["--comb", "--pitch", "--gold", "--lite", "--amber", "--deep", "--dim", "--ridge", "--text"];
for (const k of need) if (!/^#[0-9a-f]{6}$/i.test(T[k] || "")) throw new Error(`token ${k} is not a plain hex colour: ${T[k]}`);

// the display face, exactly as the app embeds it
const face = css.match(/@font-face\{\s*font-family:"Archivo Black";[\s\S]*?\}/);
if (!face) throw new Error("Archivo Black @font-face not found in styles.css");

const PAGE = `<!doctype html><meta charset="utf-8"><style>${face[0]}</style>
<body style="margin:0;background:#000">
<span style="font-family:'Archivo Black'">BOROMETER</span>
<canvas id="c"></canvas>
<script>
const T = ${JSON.stringify(T)};
const hex = (h, a) => { const n = parseInt(h.slice(1), 16);
  return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + (a ?? 1) + ")"; };

/* The wordmark: the gold ramp the app's own mark wears (--grad-mark), light
   at the top, into the deep bronze at the foot. */
function wordmark(ctx, text, x, y, size, align) {
  ctx.font = size + "px 'Archivo Black'";
  ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y);
  g.addColorStop(0.08, "#f7d9a4"); g.addColorStop(0.55, T["--gold"]); g.addColorStop(1, T["--deep"]);
  ctx.fillStyle = g;
  ctx.save(); ctx.letterSpacing = "0.05em"; ctx.fillText(text, x, y); ctx.restore();
}

/* A few rows of the damage table, reduced to their bars: the same run from the
   colour into nothing that .fill draws behind every row, gold for the one that
   carried the fight, amber for the rest. Lengths fall the way a real fight's
   do - one skill far ahead, the rest close together. */
function bars(ctx, x, y, w, rows, gap, h) {
  const shares = [1, 0.46, 0.33, 0.26, 0.2, 0.15, 0.11];
  for (let i = 0; i < rows; i++) {
    const len = Math.round(w * shares[i]);
    const top = y + i * (h + gap);
    const g = ctx.createLinearGradient(x, 0, x + len, 0);
    const c = i === 0 ? T["--gold"] : T["--amber"];
    g.addColorStop(0, hex(c, i === 0 ? 0.62 : 0.5 - i * 0.05));
    g.addColorStop(1, hex(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x, top, len, h);
    // the hard edge at the end of the bar, as in the table
    ctx.fillStyle = hex(c, i === 0 ? 0.9 : 0.55);
    ctx.fillRect(x + len - 2, top, 2, h);
  }
}

/* The ember: the radial glow the head of the app lays behind the big number. */
function ember(ctx, cx, cy, r, a) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, hex(T["--amber"], a)); g.addColorStop(0.45, hex(T["--amber"], a * 0.4));
  g.addColorStop(1, hex(T["--amber"], 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

window.draw = (kind) => {
  const c = document.getElementById("c");
  const [w, h] = kind === "header" ? [150, 57] : kind === "splash" ? [440, 200] : [164, 314];
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = T["--comb"]; ctx.fillRect(0, 0, w, h);

  if (kind === "splash") {
    /* What the portable exe shows while it unpacks itself - a few seconds
       at every start. No words: it has to read the same on any Windows. */
    // stroke top (50) to last bar (152): the block sits in the middle of 200
    ember(ctx, 70, 66, 260, 0.26);
    const gs = ctx.createLinearGradient(0, 48, 0, 78);
    gs.addColorStop(0, T["--lite"]); gs.addColorStop(1, T["--amber"]);
    ctx.fillStyle = gs; ctx.fillRect(40, 50, 4, 27);
    wordmark(ctx, "BOROMETER", 56, 76, 30, "left");
    bars(ctx, 40, 102, 360, 4, 6, 8);
    // a hairline round the edge, so the dark plate stands off a dark desktop
    ctx.strokeStyle = hex(T["--ridge"], 1); ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  } else if (kind === "header") {
    ember(ctx, w - 30, h / 2, 90, 0.16);
    wordmark(ctx, "BOROMETER", w - 12, 33, 15, "right");
    // the glow line under the mark, the same stroke the app sets before a heading
    const g = ctx.createLinearGradient(w - 12 - 96, 0, w - 12, 0);
    g.addColorStop(0, hex(T["--amber"], 0)); g.addColorStop(1, hex(T["--lite"], 0.9));
    ctx.fillStyle = g; ctx.fillRect(w - 12 - 96, 40, 96, 2);
  } else {
    ember(ctx, 40, 96, 150, kind === "uninstall" ? 0.12 : 0.22);
    // glutstrich + wordmark, 15px so the mark keeps the same margin on the
    // right as the stroke has on the left
    const gs = ctx.createLinearGradient(0, 84, 0, 99);
    gs.addColorStop(0, T["--lite"]); gs.addColorStop(1, T["--amber"]);
    ctx.fillStyle = gs; ctx.fillRect(18, 85, 3, 14);
    wordmark(ctx, "BOROMETER", 28, 98, 15, "left");
    // the uninstaller's picture is the same fight with the bars running out
    bars(ctx, 18, 204, 128, kind === "uninstall" ? 3 : 6, 6, 9);
    // a ridge line closing the picture off at the foot, like the rail's edge
    ctx.fillStyle = hex(T["--ridge"], 1); ctx.fillRect(18, 296, 128, 1);
  }
  const d = ctx.getImageData(0, 0, w, h).data;
  return { w, h, rgba: Array.from(d) };
};
</script>`;

/** 24-bit bottom-up BMP, rows padded to four bytes - what NSIS loads. */
function bmp({ w, h, rgba }) {
  const row = Math.ceil((w * 3) / 4) * 4;
  const size = 54 + row * h;
  const b = Buffer.alloc(size);
  b.write("BM", 0); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14); b.writeInt32LE(w, 18); b.writeInt32LE(h, 22);
  b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.writeUInt32LE(row * h, 34);
  b.writeInt32LE(2835, 38); b.writeInt32LE(2835, 42);
  for (let y = 0; y < h; y++) {
    const off = 54 + (h - 1 - y) * row;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      b[off + x * 3] = rgba[s + 2]; b[off + x * 3 + 1] = rgba[s + 1]; b[off + x * 3 + 2] = rgba[s];
    }
  }
  return b;
}

const browser = await chromium.launch({
  args: ["--disable-gpu", "--disable-lcd-text", "--font-render-hinting=none", "--force-color-profile=srgb"],
  ...(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {}),
});
try {
  const page = await browser.newPage();
  await page.setContent(PAGE);
  await page.evaluate(() => document.fonts.load("17px 'Archivo Black'"));
  const loaded = await page.evaluate(() => document.fonts.check("17px 'Archivo Black'"));
  if (!loaded) throw new Error("Archivo Black did not load - the pictures would fall back to a system face");
  for (const [kind, file] of [["install", "installerSidebar.bmp"], ["uninstall", "uninstallerSidebar.bmp"],
                              ["header", "installerHeader.bmp"], ["splash", "portableSplash.bmp"]]) {
    const img = await page.evaluate((k) => window.draw(k), kind);
    writeFileSync(join(root, "build", file), bmp(img));
    console.log(`build/${file}  ${img.w} x ${img.h}`);
  }
  await taskbarIcons();
} finally {
  await browser.close();
}

/* The taskbar's pictures (src/main/taskbar.ts): the gold dot Windows lays
   over the app's icon while live logging runs, and the two buttons in the
   window's preview. 16 px, and 32 px for a screen at 200%. The taskbar is
   dark or light by the Windows setting, not by the app's theme, so --text
   alone would vanish on a light one: every outline is drawn twice, first
   wider in --pitch, then --text on top - a light line with a dark edge
   reads on both. The gold carries on both without help; the dot gets the
   same thin dark rim so it stands off the app's own gold icon. */
async function taskbarIcons() {
  const dir = join(root, "build", "taskbar");
  mkdirSync(dir, { recursive: true });
  const ICONS = `<!doctype html><body style="margin:0;background:transparent">
<canvas id="c" style="width:16px;height:16px;display:block"></canvas>
<script>
const T = ${JSON.stringify(T)};
/* A light line with a dark edge. At 16 px a 1.5 px line always falls
   between pixels and blurs, so there it is one pixel wide on pixel centres
   with one dark pixel either side; at 32 px it is the full 1.5 (three
   device pixels) with one dark device pixel either side. */
function edged(ctx, s, path) {
  path(); ctx.lineWidth = s === 1 ? 3 : 2.5; ctx.strokeStyle = T["--pitch"]; ctx.stroke();
  path(); ctx.lineWidth = s === 1 ? 1 : 1.5; ctx.strokeStyle = T["--text"]; ctx.stroke();
}
const draw = {
  // a filled circle, 10/16 of the edge, in the middle
  "live-dot": (ctx) => {
    ctx.beginPath(); ctx.arc(8, 8, 5, 0, Math.PI * 2);
    ctx.fillStyle = T["--gold"]; ctx.fill();
    ctx.beginPath(); ctx.arc(8, 8, 4.6, 0, Math.PI * 2);
    ctx.lineWidth = 0.8; ctx.strokeStyle = "rgba(6,4,2,.6)"; ctx.stroke();
  },
  // a window, and bottom right the small one compact makes of it
  "thumb-compact": (ctx, s) => {
    if (s === 1) {
      ctx.fillStyle = T["--pitch"]; ctx.fillRect(7, 7, 6, 5);
      ctx.fillStyle = T["--gold"]; ctx.fillRect(8, 8, 5, 4);
      edged(ctx, s, () => { ctx.beginPath(); ctx.rect(2.5, 3.5, 11, 9); });
    } else {
      ctx.fillStyle = T["--pitch"]; ctx.fillRect(7, 7, 7, 6);
      ctx.fillStyle = T["--gold"]; ctx.fillRect(7.5, 7.5, 6, 5);
      edged(ctx, s, () => { ctx.beginPath(); ctx.rect(2.25, 3.25, 11.5, 9.5); });
    }
  },
  // a ring with the live dot inside
  "thumb-live": (ctx, s) => {
    edged(ctx, s, () => { ctx.beginPath(); ctx.arc(8, 8, s === 1 ? 5.5 : 5.75, 0, Math.PI * 2); });
    ctx.beginPath(); ctx.arc(8, 8, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = T["--gold"]; ctx.fill();
  },
};
window.icon = (name, scale) => {
  const c = document.getElementById("c");
  c.width = c.height = 16 * scale;
  const ctx = c.getContext("2d");
  ctx.scale(scale, scale);
  draw[name](ctx, scale);
};
</script>`;
  for (const scale of [1, 2]) {
    const ctx = await browser.newContext({ deviceScaleFactor: scale });
    const page = await ctx.newPage();
    await page.setContent(ICONS);
    for (const name of ["live-dot", "thumb-compact", "thumb-live"]) {
      await page.evaluate(([n, sc]) => window.icon(n, sc), [name, scale]);
      const file = `${name}${scale === 2 ? "@2x" : ""}.png`;
      writeFileSync(join(dir, file), await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 16, height: 16 } }));
      console.log(`build/taskbar/${file}  ${16 * scale} x ${16 * scale}`);
    }
    await ctx.close();
  }
}
