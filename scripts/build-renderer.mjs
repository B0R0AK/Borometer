// Builds the page: compiles the parts in src/renderer/app/ and folds them and
// styles.css back into one self-contained index.html.
//
// One file on purpose. The app serves it, but it also still works opened
// straight from disk in a browser - drop a combat log on it and it reads it -
// and that only holds while nothing has to be fetched next to it.
//
// The page stays one classic script, not a <script type="module">: a module
// would not load from file://. The sources are ES modules - src/renderer/main.ts
// and the parts in src/renderer/app/ it imports - and esbuild bundles them into
// that one script. See src/renderer/app/README.md.

import * as esbuild from "esbuild";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin, merkeModus, pruefeFormen } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src", "renderer");
const out = join(root, "dist", "renderer");

// The parts are numbered 01, 02, ... with no gap and no twin, and main.ts
// runs every part's setup() in that order. A mistyped number or a setup
// left out would change what the page does when it starts, so both stop the
// build rather than the page.
const parts = readdirSync(join(src, "app")).filter((f) => f.endsWith(".ts")).sort();
// Numbers left free on purpose, and only these: 49 (evening) went with the
// redesign of 28.09. (Spezifikation 3); 52 (the Steckbrief) went with Aufgabe 12
// of it (29.09.); 48 (rotation trainer) went too and is
// taken again by 48-einsaetze.ts. Renaming the parts after them would have
// moved every reference to them. A free number may be taken again by a new
// part; any other gap stops the build.
const FREE = new Set(["49", "52"]);
let nr = 0;
parts.forEach((f) => {
  nr++;
  while (FREE.has(String(nr).padStart(2, "0")) && !f.startsWith(String(nr).padStart(2, "0") + "-")) nr++;
  const want = String(nr).padStart(2, "0") + "-";
  if (!f.startsWith(want)) throw new Error(`src/renderer/app: expected a part starting ${want}, found ${f}`);
});
const withSetup = parts.filter((f) => /^export function setup\(/m.test(readFileSync(join(src, "app", f), "utf8")))
  .map((f) => f.slice(0, 2));
const main = readFileSync(join(src, "main.ts"), "utf8");
const calls = [...main.matchAll(/^setup(\d\d)\(\);$/gm)].map((m) => m[1]);
if (calls.join() !== withSetup.join()) {
  throw new Error(`src/renderer/main.ts must call the setup() of ${withSetup.join(", ")} in that order; it calls ${calls.join(", ") || "none"}`);
}

// One version for the whole app: package.json's, which electron-builder also
// puts on the installer. Shown without a trailing ".0" patch, as the app
// always has (1.0.0 reads v1.0).
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const shownVersion = version.replace(/\.0$/, "");

// Die Spielbilder (Spezifikation oeffentliches Repo, 4): assets/spielbilder.ts,
// wenn es sie gibt, sonst die leeren Tabellen aus src/renderer/spielbilder.ts.
const modus = bilderModus(root);
if (modus === "voll") pruefeFormen(root);

const r = await esbuild.build({
  entryPoints: [join(src, "main.ts")],
  define: { __BORO_VERSION__: JSON.stringify(shownVersion) },
  bundle: true,
  format: "iife",
  write: false,
  // Stated here rather than read from a tsconfig: the page runs without
  // "use strict", as it always did, and esbuild would otherwise add the
  // directive as soon as any tsconfig above the sources says "strict". Type
  // checking is tsc's job (npm run typecheck); this only strips the types.
  tsconfigRaw: { compilerOptions: { alwaysStrict: false } },
  target: "chrome120",
  charset: "utf8",
  legalComments: "inline",
  logLevel: "warning",
  plugins: [bilderPlugin(root, modus)],
});
const script = r.outputFiles[0].text;
const css = readFileSync(join(src, "styles.css"), "utf8");
let html = readFileSync(join(src, "index.html"), "utf8");

// Anything that would end the inline element early has to fail the build,
// not the page.
if (/<\/script/i.test(script)) throw new Error("the page script contains </script, which cannot be inlined");
if (/<\/style/i.test(css)) throw new Error("styles.css contains </style, which cannot be inlined");

const link = '<link rel="stylesheet" href="./styles.css">';
const tag = '<script src="./app.js"></script>';
if (!html.includes(link) || !html.includes(tag)) throw new Error("index.html lost its stylesheet or script tag");
// functions as replacements, so a "$&" or "$1" in the sources stays literal
html = html.replace(link, () => `<style>\n${css}</style>`);
html = html.replace(tag, () => `<script>\n${script}</script>`);
const verTag = /(<span class="ver" id="appVer">)v[^<]*(<\/span>)/;
if (!verTag.test(html)) throw new Error("index.html lost its version label (#appVer)");
html = html.replace(verTag, (_, a, b) => `${a}v${shownVersion}${b}`);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "index.html"), html, "utf8");
merkeModus(root, modus);
console.log(`renderer: dist/renderer/index.html (${(html.length / 1024 / 1024).toFixed(2)} MB, ${modus === "voll" ? "mit Spielbildern aus assets/" : "ohne Spielbilder - gezeichnete Marken"})`);
