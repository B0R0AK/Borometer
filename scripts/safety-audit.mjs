// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Safety audit for Borometer.
//
// The promise this checks: Borometer only ever READS the combat log Throne and
// Liberty writes itself. It never writes into the game's folder, never touches
// the game process, never injects anything, and never sends a combat log
// anywhere. Anything that could look like tampering to anti-cheat should be
// mechanically impossible, not merely absent by habit.
//
// Run:  npm run audit:safety

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// overridable so audit-negative.mjs can point the audit at a scratch copy of
// src/main with one forbidden change inserted, without touching the real tree
const mainDir = process.env.AUDIT_MAIN_DIR || join(root, "src", "main");
// and the page folder likewise, for the cases that change a page part
const rendererDir = process.env.AUDIT_RENDERER_DIR || join(root, "src", "renderer");
const pageDir = process.env.AUDIT_PAGE_DIR || join(rendererDir, "app");
const serverPath = join(root, "BoroPartyServer", "boro_server.py");
// the full image data and the two scripts of the image switch, overridable for audit-negative.mjs
const assetsDir = process.env.AUDIT_ASSETS_DIR || join(root, "assets");
const scriptsDir = process.env.AUDIT_SCRIPTS_DIR || join(root, "scripts");
// the page audit asks esbuild what the bundle is made of; missing, that rule fails
let esbuild = null;
try { esbuild = await import("esbuild"); } catch { /* reported by the rule */ }
// and it bundles through the build's own image switch, so it sees the file
// the build takes for ../spielbilder (section 15); missing, that rule fails
let weiche = null;
try { weiche = await import("./bilder-weiche.mjs"); } catch { /* reported by the rule */ }

const notes = [];
const failures = [];

function check(ok, label, detail = "") {
  (ok ? notes : failures).push({ status: ok ? "PASS" : "FAIL", label, detail });
}

/*
 * Source with comments removed, so prose explaining *why* never matches - and
 * only comments: a "/*" or "//" inside a string, a template or a regex literal
 * is part of that literal, not the start of a comment (a plain pattern replace
 * once let `const a = "/*"; ...code... const b = "*" + "/";` hide the code in
 * between from every check). Returns two views:
 *   code - comments gone, literals as written (for checks on fixed strings)
 *   bare - the same, with the inside of every string, template text and regex
 *          blanked to spaces (for checks on identifiers and calls, which a
 *          string must neither hide nor fake)
 * plus every quoted string's content and whether a template literal occurs.
 * Anything it cannot follow - an unterminated string, comment, template or
 * regex, or braces that do not balance - comes back as an error, and the
 * audit fails rather than guess.
 */
function tokenise(src) {
  let code = "";
  let bare = "";
  const strings = [];
  const texts = [];       // the text pieces of every template literal
  let templates = 0;
  const emit = (c, b = c) => { code += c; bare += b; };
  const blank = (s) => s.replace(/[^\n]/g, " ");
  const KEYWORDS = new Set(["return", "typeof", "case", "do", "else", "in", "of", "new", "delete", "void",
    "throw", "instanceof", "yield", "await"]);
  const BEFORE_REGEX = "(,=:[!&|?{};+-*%<>~^";
  const n = src.length;
  let i = 0;
  let depth = 0;          // open braces in the current code run
  const outer = [];       // brace depth outside each open ${ ... }
  let lastSig = "";       // last significant character, "a" for a word, ")" for a literal value
  let lastWord = "";
  const fail = (why) => ({ error: `${why} at offset ${i}` });
  // template text from i up to the closing backtick or the next ${
  const templateText = () => {
    const start = i;
    while (i < n) {
      const c = src[i];
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { const t = src.slice(start, i); texts.push(t); emit(t + "`", blank(t) + "`"); i++; return "end"; }
      if (c === "$" && src[i + 1] === "{") { const t = src.slice(start, i); texts.push(t); emit(t + "${", blank(t) + "${"); i += 2; return "expr"; }
      i++;
    }
    return null;
  };
  const afterTemplate = (r) => {
    if (r === "expr") { outer.push(depth); depth = 0; lastSig = "{"; lastWord = ""; }
    else { lastSig = ")"; lastWord = ""; }
  };
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      const e = src.indexOf("\n", i);
      i = e < 0 ? n : e;
      continue;
    }
    if (c === "/" && d === "*") {
      const e = src.indexOf("*/", i + 2);
      if (e < 0) return fail("unterminated comment");
      // a space, not nothing, where the comment would glue two words together
      if (/\w/.test(code.slice(-1)) && /\w/.test(src[e + 2] ?? "")) emit(" ");
      i = e + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === "\n") return fail("unterminated string");
        j += src[j] === "\\" ? 2 : 1;
      }
      if (j >= n) return fail("unterminated string");
      const body = src.slice(i + 1, j);
      strings.push(body);
      emit(c + body + c, c + blank(body) + c);
      i = j + 1;
      lastSig = ")"; lastWord = "";
      continue;
    }
    if (c === "`") {
      templates++;
      emit("`");
      i++;
      const r = templateText();
      if (!r) return fail("unterminated template");
      afterTemplate(r);
      continue;
    }
    if (c === "/") {
      const regexHere = lastSig === "" || BEFORE_REGEX.includes(lastSig) || (lastSig === "a" && KEYWORDS.has(lastWord));
      if (!regexHere) { emit("/"); i++; lastSig = "/"; lastWord = ""; continue; }
      let j = i + 1;
      let inClass = false;
      while (j < n) {
        const ch = src[j];
        if (ch === "\n") return fail("unterminated regex");
        if (ch === "\\") { j += 2; continue; }
        if (inClass) { if (ch === "]") inClass = false; }
        else if (ch === "[") inClass = true;
        else if (ch === "/") break;
        j++;
      }
      if (j >= n) return fail("unterminated regex");
      j++;
      while (j < n && /[a-z]/i.test(src[j])) j++;
      const lit = src.slice(i, j);
      const close = lit.lastIndexOf("/");
      emit(lit, "/" + blank(lit.slice(1, close)) + lit.slice(close));
      i = j;
      lastSig = ")"; lastWord = "";
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < n && /[\w$]/.test(src[j])) j++;
      const w = src.slice(i, j);
      emit(w);
      i = j;
      lastSig = "a"; lastWord = w;
      continue;
    }
    if (/\d/.test(c)) {
      let j = i + 1;
      while (j < n && /[\w.]/.test(src[j])) j++;
      emit(src.slice(i, j));
      i = j;
      lastSig = ")"; lastWord = "";
      continue;
    }
    if (c === "{") depth++;
    if (c === "}") {
      if (depth === 0) {
        if (!outer.length) return fail("unbalanced }");
        // the end of a ${ ... }: back into the template's text
        emit("}");
        i++;
        depth = outer.pop();
        const r = templateText();
        if (!r) return fail("unterminated template");
        afterTemplate(r);
        continue;
      }
      depth--;
    }
    emit(c);
    i++;
    if (!/\s/.test(c)) { lastSig = c; lastWord = ""; }
  }
  if (depth !== 0 || outer.length) return fail("unbalanced braces");
  return { code, bare, strings, texts, templates };
}

function auditMain() {
  // every rule below reads the .ts files at the top of src/main and nothing
  // else, while tsc builds src/main/**/*.ts: a file in a folder below (or
  // one the build would pick up under another ending) would be built and
  // never audited (Gutachten Update-Hinweis, 02.10.2026). So src/main holds
  // .ts files and nothing else - no folder, no link.
  const entries = readdirSync(mainDir, { withFileTypes: true });
  const unread = entries.filter((e) => !e.isFile() || !e.name.endsWith(".ts")).map((e) => e.name + (e.isDirectory() ? "/" : ""));
  check(!unread.length, "src/main holds .ts files only, no folder: every file the build takes is audited",
    `found: ${unread.join(", ")}`);
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".ts")).map((e) => e.name);
  const sources = Object.fromEntries(files.map((f) => [f, readFileSync(join(mainDir, f), "utf8")]));
  const toks = Object.fromEntries(files.map((f) => [f, tokenise(sources[f])]));
  const untokenised = files.filter((f) => toks[f].error).map((f) => `${f}: ${toks[f].error}`);
  check(!untokenised.length, "every main file could be tokenised (strings, templates, regexes, comments)",
    untokenised.join("; "));
  // a file that could not be read confidently is still checked as written,
  // so the rest of the report says what it can - the audit has failed anyway
  const code = Object.fromEntries(files.map((f) => [f, toks[f].error ? sources[f] : toks[f].code]));
  const bare = Object.fromEntries(files.map((f) => [f, toks[f].error ? sources[f] : toks[f].bare]));
  const all = Object.values(code).join("\n");
  const allBare = Object.values(bare).join("\n");

  // --- 0. no module is loaded at run time. Everything main uses comes in
  //        through a written import, so every check below sees it. The ways
  //        around that - Node's module loader (module, _load, require with a
  //        computed name, a computed import()), process.getBuiltinModule,
  //        and the Function constructor reached through .constructor - are
  //        named here; none has a use in main. `constructor` may only open
  //        a class's own constructor.
  const PROCESS_OK = new Set(["env", "platform", "arch", "versions", "execPath", "resourcesPath", "argv", "exit",
    "on", "once", "cwd", "pid"]);
  const loaders = [];
  for (const f of files) {
    const b = bare[f];
    const c = code[f];
    // Node's `global` as well as globalThis: global["fe" + "tch"] would reach
    // any function by a name no check below can read
    for (const m of b.matchAll(/\bmodule\b|\b_load\b|\bgetBuiltinModule\b|\bglobalThis\b|\bglobal\b|\bFunction\b/g)) loaders.push(`${f}: ${m[0]}`);
    // process only as process.<one of PROCESS_OK>: never handed on as a
    // value, never with a computed key (process["getBuiltin" + "Module"]),
    // and none of those members reaches a module loader
    for (const m of b.matchAll(/\bprocess\b(\s*\.\s*(\w+))?/g)) {
      if (!PROCESS_OK.has(m[2] ?? "")) loaders.push(`${f}: ${m[0]}`);
    }
    // with the strings kept: x["constructor"] or x["getBuiltinModule"] as a computed key
    for (const m of c.matchAll(/[^\n]*\bconstructor\b[^\n]*/g)) {
      if (!/^\s*constructor\s*\(/.test(m[0])) loaders.push(`${f}: ${m[0].trim()}`);
    }
    for (const m of c.matchAll(/["'`](?:_load|getBuiltinModule|constructor)["'`]/g)) loaders.push(`${f}: ${m[0]}`);
    for (const m of c.matchAll(/\b(require|import)\b(\s*\(\s*[^)]*\)?)?/g)) {
      const kw = m[1];
      if (kw === "import" && !m[2]) continue; // an import statement, checked by its own rules
      if (!/^\s*\(\s*("[^"\n]*"|'[^'\n]*')\s*\)$/.test(m[2] ?? "")) loaders.push(`${f}: ${m[0].trim()}`);
    }
  }
  check(!loaders.length,
    "main loads no module at run time (no module/_load, computed require or import, getBuiltinModule, global/globalThis, .constructor, process as a value)",
    `found: ${loaders.join(" | ")}`);

  // --- 0b. no built-in object is changed. Many checks below pin a function's
  //         text word for word; `Object.keys = () => [];` or
  //         `Array.prototype.every = function () { return true; };` anywhere in
  //         main would change what that pinned text does without touching it.
  //         So, in every main file: nothing is assigned to, counted up or down,
  //         deleted from or destructured into a built-in or one of its members;
  //         a built-in is never reached through a computed key; the words that
  //         redefine or re-parent an object are never named, not even in a
  //         string; prototype only as Object.hasOwn(Object.prototype, k); and a
  //         built-in is used only by name - called, read with ".", made with
  //         new, tested with instanceof, extended - never handed on as a value
  //         that some other name could then change.
  const BUILTIN = "Object|Array|Function|String|Number|Boolean|Symbol|BigInt|JSON|Math|Reflect|Proxy|Promise|RegExp"
    + "|Date|Map|Set|WeakMap|WeakSet|WeakRef|Error|Atomics|Intl";
  const builtinChain = `\\b(?:${BUILTIN})\\b(?:\\s*\\??\\.\\s*[\\w$]+|\\s*\\[[^\\]\\n]*\\])*`;
  const changed = [];
  const computedBuiltin = [];
  const redefining = [];
  const protoStray = [];
  const builtinValues = [];
  for (const f of files) {
    const b = bare[f];
    // an assignment of any kind, ++ or --, or a place that is only a target
    // or a loose value: a destructuring slot ({ k: Object.keys } = ...,
    // [Math.max] = ...), a for-of/in variable
    const target = new RegExp(`${builtinChain}\\s*(?:(?:[-+*/%&|^]|\\*\\*|<<|>>>?|&&|\\|\\||\\?\\?)?=(?![=>])|\\+\\+|--|[,}\\]]|\\b(?:of|in)\\b)`, "g");
    for (const m of b.matchAll(target)) {
      // the one read of a prototype main has: Object.hasOwn(Object.prototype, k)
      if (m[0] === "Object.prototype," && b.slice(0, m.index).endsWith("Object.hasOwn(")) continue;
      changed.push(`${f}: ${m[0].trim()}`);
    }
    for (const m of b.matchAll(new RegExp(`(?:\\+\\+|--|\\bdelete\\b)\\s*\\(?\\s*\\b(?:${BUILTIN})\\b`, "g"))) changed.push(`${f}: ${m[0].trim()}`);
    for (const m of b.matchAll(new RegExp(`\\b(?:${BUILTIN})\\b\\s*(?:\\?\\.)?\\s*\\[`, "g"))) computedBuiltin.push(`${f}: ${m[0]}`);
    for (const m of b.matchAll(/\b(?:defineProperty|defineProperties|setPrototypeOf|getPrototypeOf|__proto__|__defineGetter__|__defineSetter__|__lookupGetter__|__lookupSetter__|Reflect|Proxy)\b/g)) {
      redefining.push(`${f}: ${m[0]}`);
    }
    // and not as a string or template text either (x["__proto__"], x[`prototype`])
    const lits = toks[f].error ? [sources[f]] : [...toks[f].strings, ...toks[f].texts];
    for (const s of lits) {
      for (const m of s.matchAll(/defineProperty|defineProperties|setPrototypeOf|getPrototypeOf|__proto__|__define|__lookup|prototype/g)) redefining.push(`${f}: "${m[0]}"`);
    }
    const protoAll = [...b.matchAll(/\bprototype\b/g)].length;
    const protoOk = [...b.matchAll(/\bObject\.hasOwn\(Object\.prototype, /g)].length;
    if (protoAll !== protoOk) protoStray.push(`${f}: ${protoAll} mentions, ${protoOk} as Object.hasOwn(Object.prototype, k)`);
    for (const m of b.matchAll(new RegExp(`\\b(?:${BUILTIN})\\b`, "g"))) {
      const before = b.slice(0, m.index);
      const after = b.slice(m.index + m[0].length);
      if (/^\s*(?:\??\.|\(|<)/.test(after)) continue;               // Object.keys(, Number(, Promise<void>
      if (/\b(?:new|instanceof|extends)\s+$/.test(before)) continue;  // new Map, x instanceof Error, extends Error
      if (m[0] === "Number" && /\.map\($/.test(before) && after.startsWith(")")) continue;     // .map(Number)
      if (m[0] === "Boolean" && /\.filter\($/.test(before) && after.startsWith(")")) continue; // .filter(Boolean)
      // a parameter's type, (rx: RegExp) - not a ternary's branch, which has "? " before its name
      if (/^(?:RegExp|Date|Error)$/.test(m[0]) && /[(,]\s*[\w$]+: $/.test(before) && after.startsWith(")")) continue;
      builtinValues.push(`${f}: ${(before.slice(-16) + m[0] + after.slice(0, 8)).replace(/\s+/g, " ").trim()}`);
    }
  }
  check(!changed.length,
    "main changes no built-in object (no assignment, ++/--, delete or destructuring into Object, Array, JSON, Math, ... or a member of one)",
    `found: ${changed.join(" | ")}`);
  check(!computedBuiltin.length, "main never reaches a built-in object through a computed key",
    `found: ${computedBuiltin.join(" | ")}`);
  check(!redefining.length,
    "main names no defineProperty, setPrototypeOf, getPrototypeOf, __proto__, Reflect or Proxy (not even in a string)",
    `found: ${redefining.join(" | ")}`);
  check(!protoStray.length, "prototype is named only as Object.hasOwn(Object.prototype, k)",
    `found: ${protoStray.join(" | ")}`);
  check(!builtinValues.length,
    "a built-in object is used only by name (called, read with \".\", new, instanceof, extends), never handed around",
    `found: ${builtinValues.join(" | ")}`);

  // --- 1. every write must target the config file or one of the app's own
  //        folders (saves, party logs, bug reports) - named individually, so
  //        a new write target has to be argued for here before it can ship.
  const allowedWrites = {
    "config.ts": ["target", 'CONFIG_PATH + ".tmp"'],
    "server.ts": ["target"],
    "best.ts": ["BEST_PATH", 'BEST_PATH + ".tmp"'],
    "weeklies.ts": ["WEEKLIES_PATH", 'WEEKLIES_PATH + ".tmp"'],
    "gilde.ts": ["GILDE_PATH", 'GILDE_PATH + ".tmp"'],
  };
  const bad = [];
  for (const [file, src] of Object.entries(code)) {
    for (const m of src.matchAll(/\b(?:fs\.)?(writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream|copyFileSync|cpSync)\(\s*([^,)]+)/g)) {
      const target = m[2].trim();
      if (!(allowedWrites[file] ?? []).includes(target)) bad.push(`${file}: ${m[1]}(${target}`);
    }
  }
  check(!bad.length, "no writes outside config and the app's own folders", `unexpected write targets: ${bad.join("; ")}`);

  // --- 1c. reads, like writes, go only to named targets (Befund K-9: a new
  //         GET case reading path.join(path.dirname(CONFIG_PATH), "boro-week"
  //         + "lies.json") passed every rule, since the stores were guarded
  //         only by their function names and literal file names). Every call
  //         that reads the file system is listed here in full - path and
  //         options, and how often - so a new read, above all of a store in
  //         the settings folder, has to be argued for here before it ships.
  //         The paths that come in as parameters are pinned at their callers.
  const norm = (s) => s.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").trim();
  // the whole argument list of the call whose "(" sits at `open`, balanced on
  // the bare view (strings cannot hide a parenthesis) and cut from the code
  // view, which is the same length
  const argsAt = (f, open) => {
    let depth = 0;
    for (let i = open; i < bare[f].length; i++) {
      if (bare[f][i] === "(") depth++;
      else if (bare[f][i] === ")" && --depth === 0) return norm(code[f].slice(open + 1, i));
    }
    return null;
  };
  const callsOf = (f, re) => [...bare[f].matchAll(re)].map((m) => ({ name: m[1], args: argsAt(f, m.index + m[0].length - 1) }));
  const counts = (f, re) => [...(bare[f] ?? "").matchAll(re)].length;
  const READ_FNS = "readFileSync|readFile|createReadStream|openSync|open|opendirSync|opendir|readdirSync|readdir|"
    + "statSync|stat|lstatSync|lstat|statfsSync|statfs|existsSync|exists|accessSync|access|readlinkSync|readlink|"
    + "realpathSync|realpath|watch|watchFile";
  // fstatSync and readSync are not listed: they work on a descriptor, and the
  // one descriptor there is comes from the openSync on the log below
  const allowedReads = {
    "best.ts": ['fs.readFileSync(BEST_PATH, "utf8")'],
    "weeklies.ts": ['fs.readFileSync(WEEKLIES_PATH, "utf8")'],
    "gilde.ts": ['fs.readFileSync(GILDE_PATH, "utf8")'],
    "config.ts": ["fs.existsSync(target)", "fs.statSync(legacy)", 'fs.readFileSync(legacy, "utf8")',
      'fs.readFileSync(CONFIG_PATH, "utf8")'],
    // readdirSync(folder) and lstatSync(full) are listLogs(), the one listing
    // of the log folder - lstat, so a link in the folder is not a log (spec
    // Nachtraege N3, Pruefung G2): newestLog() for /api/state and
    // /api/latest, GET /api/logs and the name check of GET /api/log all go
    // through it (2c). Per request: /api/state, /api/latest and /api/logs
    // 1x readdirSync(folder) and 1x lstatSync(full) per entry of the folder;
    // /api/log the same, then 1x openSync(found.full, "r") on the one entry
    // whose name matched, for a piece of at most TAIL_MAX (8 MB) - the page
    // asks once per piece. readFileSync(found.full) is readLog(), only for
    // /api/latest without from (2b).
    "logs.ts": ["fs.statSync(p)", "fs.readdirSync(steam)", "fs.readdirSync(folder)", "fs.lstatSync(full)",
      'fs.readFileSync(found.full, "utf8")', 'fs.openSync(found.full, "r")'],
    "paths.ts": ["fs.existsSync(path.join(path.dirname(process.execPath), `Uninstall ${APP_NAME}.exe`))",
      "fs.statSync(p)", "fs.statSync(p)", "fs.readdirSync(prev)", "fs.existsSync(dst)", "fs.existsSync(dst)",
      "fs.readdirSync(full)"],
    "server.ts": ["fs.readdirSync(folder)", "fs.statSync(path.join(folder, name))",
      'fs.readFileSync(path.join(folder, safeSaveName(wanted)), "utf8")', 'fs.readFileSync(STATE.pagePath, "utf8")',
      "fs.statSync(wanted)",
      // /api/folder/open asks whether the watched folder is still a folder
      // before the file manager opens it (5c, spec Nachtraege N1)
      "fs.statSync(STATE.dir)"],
  };
  const badReads = [];
  for (const f of files) {
    const left = [...(allowedReads[f] ?? [])];
    for (const c of callsOf(f, new RegExp(`\\bfs\\s*\\.\\s*(${READ_FNS})\\s*\\(`, "g"))) {
      const call = `fs.${c.name}(${c.args})`;
      const at = left.indexOf(call);
      if (at < 0) badReads.push(`${f}: ${call}`);
      else left.splice(at, 1);
    }
  }
  check(!badReads.length, "every file read in main is one listed here, path and count",
    `unlisted reads: ${badReads.join("; ")}`);

  // node:fs only as the namespace fs, and fs only for the calls main makes
  // today - a named import, a require, fs.promises, a stream or fs handed on
  // under another name would reach a file without the "fs.<call>(" the list
  // above reads. The modules main may load at all are fixed as well.
  const FS_CALLS = new Set(["readFileSync", "readdirSync", "statSync", "lstatSync", "existsSync", "openSync", "fstatSync",
    "readSync", "closeSync", "writeFileSync", "renameSync", "mkdirSync"]);
  const MODULES = new Set(["electron", "node:dgram", "node:fs", "node:http", "node:os", "node:path"]);
  const FS_IMPORT = 'import * as fs from "node:fs";';
  const fsStray = [];
  for (const f of files) {
    const imports = [...code[f].matchAll(/^[ \t]*import\b[^\n]*\bfrom\s*"([^"\n]*)";?[ \t]*$/gm)];
    for (const m of imports) {
      if (m[1] === "node:fs" && m[0].trim() !== FS_IMPORT) fsStray.push(`${f}: ${m[0].trim()}`);
      if (!m[1].startsWith("./") && !MODULES.has(m[1])) fsStray.push(`${f}: ${m[0].trim()}`);
    }
    for (const m of code[f].matchAll(/\b(?:require|import)\s*\(\s*["'`]([^"'`\n]*)/g)) fsStray.push(`${f}: ${m[0]}`);
    // "fs", "node:fs/promises", "original-fs" - any other way to name a file system module
    const fsNames = (toks[f].strings ?? []).filter((s) => /(^|[:/-])fs(\/|$)/.test(s));
    const fsImports = imports.filter((m) => m[1] === "node:fs").length;
    if (fsNames.some((s) => s !== "node:fs") || fsNames.length !== fsImports) fsStray.push(`${f}: strings ${fsNames.join(", ")}`);
    // with the one import line taken out (found in the code view, blanked at
    // the same place in the bare one), fs appears only as fs.<listed call>(
    let rest = bare[f];
    for (let at = code[f].indexOf(FS_IMPORT); at >= 0; at = code[f].indexOf(FS_IMPORT, at + 1)) {
      rest = rest.slice(0, at) + " ".repeat(FS_IMPORT.length) + rest.slice(at + FS_IMPORT.length);
    }
    for (const m of rest.matchAll(/\bfs\b(\s*\.\s*(\w+)\s*\(?)?/g)) {
      if (!m[2] || !FS_CALLS.has(m[2]) || !m[0].endsWith("(")) fsStray.push(`${f}: ${norm(m[0])}`);
    }
  }
  check(!fsStray.length, "main reaches the file system only through fs.<listed call>( on the one import of node:fs",
    `found: ${fsStray.join(" | ")}`);

  // --- 1d. never delete for good (CLAUDE.md, 03.10.2026): no file in
  //         main deletes or truncates a file - not through fs, fs.promises or
  //         an fsp, not under a name imported on its own (import { unlinkSync }),
  //         and not even as a string (fs["unlink"]). Read on the code view, so
  //         a comment may explain, but code and literals may not name them.
  const deleting = [];
  for (const f of files) {
    for (const m of code[f].matchAll(/\b(?:unlink|rm|rmdir|truncate)(?:Sync)?\b/g)) {
      deleting.push(`${f}: ${norm(code[f].slice(Math.max(0, m.index - 24), m.index + m[0].length + 24))}`);
    }
  }
  check(!deleting.length,
    "the main process never deletes a file (no unlink, rm, rmdir or truncate, sync or not, by any name)",
    `found: ${deleting.join(" | ")}`);

  // the settings folder, where the stores live, is named only where a store
  // is declared: settingsPath in paths.ts and once per store file, SETTINGS_DIR
  // for Electron's own folder in main.ts, getPath and the %APPDATA% the folder
  // is built from only in paths.ts. A store's path does not leave its file,
  // except CONFIG_PATH shown as text; no path is climbed up from with dirname
  // or ".."; process.env only by name, and only these names.
  const settingsStray = [];
  const STORE_FILES = ["best.ts", "weeklies.ts", "gilde.ts", "config.ts"];
  for (const f of files) {
    if (f === "paths.ts") continue;
    const sp = counts(f, /\bsettingsPath\b/g);
    if (sp !== (STORE_FILES.includes(f) ? 2 : 0)) settingsStray.push(`${f}: settingsPath ${sp}x`);
    const sd = counts(f, /\bSETTINGS_DIR\b/g);
    if (sd !== (f === "main.ts" ? 2 : 0)) settingsStray.push(`${f}: SETTINGS_DIR ${sd}x`);
    if (/\bgetPath\b/.test(bare[f])) settingsStray.push(`${f}: getPath`);
    for (const [name, owner] of [["BEST_PATH", "best.ts"], ["WEEKLIES_PATH", "weeklies.ts"], ["GILDE_PATH", "gilde.ts"]]) {
      if (f !== owner && new RegExp(`\\b${name}\\b`).test(bare[f])) settingsStray.push(`${f}: ${name}`);
    }
  }
  if (counts("main.ts", /\bSETTINGS_DIR\b/g) && (code["main.ts"] ?? "").split('path.join(SETTINGS_DIR, "electron")').length !== 2) {
    settingsStray.push("main.ts: SETTINGS_DIR not only for Electron's folder");
  }
  // outside config.ts, CONFIG_PATH only in the import and these one uses a line
  const CONFIG_PATH_USES = { "main.ts": "${CONFIG_PATH}", "server.ts": "settings: CONFIG_PATH," };
  for (const f of files.filter((x) => x !== "config.ts")) {
    const lines = [...code[f].matchAll(/^[^\n]*\bCONFIG_PATH\b[^\n]*$/gm)].map((m) => m[0].trim());
    const odd = lines.filter((l) => !/^import \{[^}]*\} from "\.\/config";$/.test(l)
      && !(CONFIG_PATH_USES[f] && l.includes(CONFIG_PATH_USES[f]) && l.split("CONFIG_PATH").length === 2));
    if (odd.length || lines.length > (CONFIG_PATH_USES[f] ? 2 : 1)) settingsStray.push(`${f}: ${odd.join(" | ") || `CONFIG_PATH ${lines.length}x`}`);
  }
  for (const f of files) {
    for (const c of callsOf(f, /\b(dirname)\s*\(/g)) {
      if (c.args !== "process.execPath" && c.args !== "process.env.APPIMAGE") settingsStray.push(`${f}: dirname(${c.args})`);
    }
    if ((toks[f].strings ?? []).some((s) => /(^|[\\/])\.\.([\\/]|$)/.test(s))) settingsStray.push(`${f}: ".."`);
  }
  const ENV = { "logs.ts": ["LOCALAPPDATA"], "main.ts": ["BOROMETER_TEST_STARTUP_DELAY_MS"],
    "paths.ts": ["PORTABLE_EXECUTABLE_DIR", "APPIMAGE", "APPDATA"] };
  for (const f of files) {
    for (const m of bare[f].matchAll(/\bprocess\s*\.\s*env\b(\s*\.\s*(\w+))?/g)) {
      if (!m[2] || !(ENV[f] ?? []).includes(m[2])) settingsStray.push(`${f}: ${norm(m[0])}`);
    }
  }
  check(!settingsStray.length, "the settings folder is named only where a store is declared",
    `found: ${settingsStray.join(" | ")}`);

  // a store's file name is written out once, in its declaration - and no
  // file in main holds a piece of one ("boro-week" + "lies.json")
  const STORE_NAMES = { "best.ts": 1, "weeklies.ts": 1, "gilde.ts": 1, "config.ts": 2, "paths.ts": 1 };
  const nameStray = files
    .map((f) => [f, [...code[f].matchAll(/boro-/gi)].length])
    .filter(([f, k]) => k !== (STORE_NAMES[f] ?? 0))
    .map(([f, k]) => `${f} ${k}x`);
  check(!nameStray.length, "a store's file name appears only in its one declaration, never in pieces",
    `"boro-" in: ${nameStray.join(", ")}`);

  // the read paths that come in as parameters, fixed where they come from:
  // server.ts lists and serves files only from the saves and party-log
  // folders, and the page only from where main.ts built it; config.ts
  // carries over only the old config beside the exe.
  const srv = code["server.ts"] ?? "";
  const bodyOf = (src, sig) => {
    const at = src.indexOf(sig);
    if (at < 0) return null;
    const end = src.indexOf("\n}\n", at);
    return end < 0 ? null : norm(src.slice(at + sig.length, end));
  };
  const LIST_JSON = "const files: { name: string; size: number; mtime: number }[] = []; try { for (const name of "
    + "fs.readdirSync(folder)) { if (!name.toLowerCase().endsWith(\".json\")) continue; const stat = "
    + "fs.statSync(path.join(folder, name)); if (!stat.isFile()) continue; files.push({ name, size: stat.size, "
    + "mtime: Math.floor(stat.mtimeMs / 1000) }); } } catch { } files.sort((a, b) => b.mtime - a.mtime); return { folder, files };";
  const LOAD_JSON = "try { let body = fs.readFileSync(path.join(folder, safeSaveName(wanted)), \"utf8\"); if "
    + "(body.charCodeAt(0) === 0xfeff) body = body.slice(1); text(res, body, 200, JSON_TYPE); } catch { reply(res, "
    + "{ ok: false, error: \"not found\" }, 404); }";
  const PAGE_PATH = "return app.isPackaged ? path.join(process.resourcesPath, \"renderer\", \"index.html\") : "
    + "path.join(app.getAppPath(), \"dist\", \"renderer\", \"index.html\");";
  const FILE_CALLS = ["listJson(savesDir())", "loadJsonFile(res, savesDir(), q.get(\"name\"))",
    "listJson(partyLogsDir())", "loadJsonFile(res, partyLogsDir(), q.get(\"name\"))"];
  const paramStray = [];
  const listBody = bodyOf(srv, "function listJson(folder: string): { folder: string; files: { name: string; size: number; mtime: number }[] } {");
  if (listBody !== LIST_JSON) paramStray.push(`listJson() is now: ${listBody}`);
  const loadBody = bodyOf(srv, "function loadJsonFile(res: http.ServerResponse, folder: string, wanted: string | null): void {");
  if (loadBody !== LOAD_JSON) paramStray.push(`loadJsonFile() is now: ${loadBody}`);
  const fileCalls = callsOf("server.ts", /\b(listJson|loadJsonFile)\s*\(/g).map((c) => `${c.name}(${c.args})`)
    .filter((c) => !/^\w+\(\w+: /.test(c));
  if (fileCalls.slice().sort().join() !== FILE_CALLS.slice().sort().join()
      || counts("server.ts", /\b(listJson|loadJsonFile)\b/g) !== 6) paramStray.push(`calls: ${fileCalls.join(" | ")}`);
  // STATE.pagePath: empty until startServer sets it, once, to what main.ts
  // built; STATE itself only ever as STATE.<field>
  const pageUses = counts("server.ts", /\bpagePath\b/g);
  if (pageUses !== 5 || !/^  pagePath: "",$/m.test(srv) || srv.split("STATE.pagePath = pagePath;").length !== 2
      || !/export async function startServer\(pagePath: string\): Promise<number> \{\n  STATE\.pagePath = pagePath;/.test(srv)) {
    paramStray.push(`server.ts: pagePath ${pageUses}x`);
  }
  for (const m of (bare["server.ts"] ?? "").matchAll(/\bSTATE\b(\s*\.\s*\w+)?/g)) {
    if (!m[1] && !srv.slice(m.index).startsWith("STATE = {")) paramStray.push("server.ts: STATE as a value");
  }
  const mainSrc = code["main.ts"] ?? "";
  if (counts("main.ts", /\bstartServer\b/g) !== 2 || !mainSrc.includes("await startServer(pagePath());")
      || counts("main.ts", /\bpagePath\b/g) !== 2 || bodyOf(mainSrc, "function pagePath(): string {") !== PAGE_PATH) {
    paramStray.push("main.ts: startServer(pagePath())");
  }
  for (const f of files.filter((x) => x !== "main.ts" && x !== "server.ts")) {
    if (/\bstartServer\b/.test(bare[f])) paramStray.push(`${f}: startServer`);
  }
  const cfg = code["config.ts"] ?? "";
  if (counts("config.ts", /\bmigrateSettings\b/g) !== 2
      || !cfg.includes('migrateSettings(CONFIG_PATH, besideExe("boro-config.json"));')
      || /\b(target|legacy)\s*(=|\+=)(?!=)/.test(bare["config.ts"] ?? "")) paramStray.push("config.ts: migrateSettings");
  check(!paramStray.length, "the read paths that come in as parameters are fixed at their callers",
    `found: ${paramStray.join(" | ")}`);

  // --- 1d. die Ordner hinter FOLDERS (Befund aus den Nachtraegen). Das
  //         Speichern und /api/folder/open vertrauen darauf, dass savesDir,
  //         partyLogsDir und bugReportsDir feste Ordner liefern. Eine davon
  //         umzubiegen - ueber `export let`, eine Zuweisung in paths.ts, ein
  //         require("./paths") von aussen - wuerde einen Pfad aus der Anfrage
  //         beschreiben oder oeffnen. Also: kein veraenderlicher Export im
  //         Hauptprozess, die Kette von exeDir() bis FOLDERS Wort fuer Wort,
  //         und ausserhalb von paths.ts jede Nennung in einer gelisteten Form.
  //         FOLDERS selbst, /api/folder/open und openPath haelt 5c fest.
  const letExports = [];
  for (const f of files) {
    for (const m of bare[f].matchAll(/\bexport\s+(?:declare\s+)?(?:let|var)\b|\bexport\s*(?:\{|\*|default\b|=)|\bexports\b/g)) {
      letExports.push(`${f}: ${norm(m[0])}`);
    }
  }
  check(!letExports.length, "no main file exports a let or var (nor an export list, default, * or exports.<name>)",
    `found: ${letExports.join(" | ")}`);
  const pathsCode = code["paths.ts"] ?? "";
  const PATHS_PINS = {
    "export function exeDir(): string {": "const portable = process.env.PORTABLE_EXECUTABLE_DIR; if (portable) return portable; "
      + "if (process.env.APPIMAGE) return path.dirname(process.env.APPIMAGE); if (app.isPackaged) return "
      + "path.dirname(process.execPath); return app.getAppPath();",
    "function dataDir(): string {": "return INSTALLED ? path.join(app.getPath(\"documents\"), APP_NAME) : exeDir();",
    "function folder(name: string, old: string | null, create: boolean): string {": "const base = dataDir(); const full = "
      + "path.join(base, name); if (old) { const prev = path.join(base, old); try { const same = sameFolder(prev, full); if "
      + "(isDir(prev) && (same || !isDir(full))) { fs.renameSync(prev, full); } else if (isDir(prev) && isDir(full)) { for "
      + "(const entry of fs.readdirSync(prev)) { const src = path.join(prev, entry); const dst = path.join(full, entry); if "
      + "(isFile(src) && !fs.existsSync(dst)) fs.renameSync(src, dst); } } } catch { } } if (create) { try { "
      + "fs.mkdirSync(full, { recursive: true }); } catch { } } return full;",
    "export function savesDir(create = false): string {": "const full = folder(\"Logs\", \"saves\", create); let strays: "
      + "string[] = []; try { strays = fs .readdirSync(full) .filter((n) => n.toLowerCase().startsWith(\"boro-bug-\") && "
      + "n.toLowerCase().endsWith(\".json\")); } catch { strays = []; } if (strays.length) { const bugs = bugReportsDir(true); "
      + "for (const name of strays) { try { const dst = path.join(bugs, name); if (!fs.existsSync(dst)) "
      + "fs.renameSync(path.join(full, name), dst); } catch { } } } return full;",
    "export function partyLogsDir(create = false): string {": "return folder(\"Party-Logs\", \"party-logs\", create);",
    "export function bugReportsDir(create = false): string {": "return folder(\"Bug-Reports\", null, create);",
  };
  const folderStray = Object.entries(PATHS_PINS).filter(([sig, body]) => bodyOf(pathsCode, sig) !== body)
    .map(([sig]) => `${sig} ${bodyOf(pathsCode, sig)}`);
  const installed = norm((pathsCode.match(/\nexport const INSTALLED =([^;]*);/) || [null, ""])[1]);
  if (installed !== "app.isPackaged && process.platform === \"win32\" && !process.env.PORTABLE_EXECUTABLE_DIR && "
      + "fs.existsSync(path.join(path.dirname(process.execPath), `Uninstall ${APP_NAME}.exe`))") folderStray.push(`INSTALLED = ${installed}`);
  const foldersTable = norm((pathsCode.match(/\nexport const FOLDERS: Record<string, \(create\?: boolean\) => string> = \{([^}]*)\};\n/) || [null, ""])[1]);
  if (foldersTable !== "logs: savesDir, party: partyLogsDir, bugs: bugReportsDir,") folderStray.push(`FOLDERS = { ${foldersTable} }`);
  // und in paths.ts nennt nichts ausserhalb davon die Namen der Kette
  const CHAIN = { exeDir: 5, INSTALLED: 2, dataDir: 2, folder: 4, savesDir: 2, partyLogsDir: 2, bugReportsDir: 3, FOLDERS: 1 };
  for (const [name, n] of Object.entries(CHAIN)) {
    const k = counts("paths.ts", new RegExp(`\\b${name}\\b`, "g"));
    if (k !== n) folderStray.push(`paths.ts: ${name} ${k}x`);
  }
  check(!folderStray.length, "the folders behind FOLDERS are fixed in paths.ts, word for word from exeDir() to FOLDERS",
    `found: ${folderStray.join(" | ")}`);
  // ausserhalb von paths.ts: ./paths nur als benannter Import ohne Umbenennung,
  // die Ordner nur aufgerufen - savesDir() - oder an saveJsonFile gereicht
  const PATHS_IMPORT = /^import \{[^}]*\} from "\.\/paths";$/gm;
  const useStray = [];
  for (const f of files.filter((x) => x !== "paths.ts")) {
    let rest = bare[f];
    const imports = [...code[f].matchAll(PATHS_IMPORT)];
    for (const m of imports) {
      if (/\bas\b|\*|\bdefault\b/.test(m[0])) useStray.push(`${f}: ${m[0]}`);
      rest = rest.slice(0, m.index) + " ".repeat(m[0].length) + rest.slice(m.index + m[0].length);
    }
    const named = (toks[f].strings ?? []).filter((s) => /(^|[\\/])paths(\.\w+)?$/.test(s)).length;
    if (named !== imports.length) useStray.push(`${f}: "./paths" ${named}x, imported ${imports.length}x`);
    for (const m of rest.matchAll(/\b(exeDir|savesDir|partyLogsDir|bugReportsDir)\b/g)) {
      const before = rest.slice(0, m.index);
      const after = rest.slice(m.index + m[0].length);
      if (m[1] !== "exeDir" && after.startsWith("()")) continue;
      else if (m[1] !== "exeDir" && f === "server.ts" && before.endsWith("saveJsonFile(res, sent, ") && after.startsWith(")")) continue;
      useStray.push(`${f}: ${norm(before.slice(-24) + m[0] + after.slice(0, 12))}`);
    }
  }
  const saveCalls = callsOf("server.ts", /\b(saveJsonFile)\s*\(/g).map((c) => `${c.name}(${c.args})`).filter((c) => !/^\w+\(\w+: /.test(c));
  if (saveCalls.slice().sort().join() !== ["saveJsonFile(res, sent, bugReportsDir)", "saveJsonFile(res, sent, partyLogsDir)",
      "saveJsonFile(res, sent, savesDir)"].join() || counts("server.ts", /\bsaveJsonFile\b/g) !== 4) useStray.push(`calls: ${saveCalls.join(" | ")}`);
  const saveBody = bodyOf(srv, "function saveJsonFile(res: http.ServerResponse, sent: Json, dir: (create?: boolean) => string): void {");
  if (saveBody !== "const name = safeSaveName(sent.name); const payload = sent.data; if (payload === undefined || payload === null) "
      + "{ reply(res, { ok: false, error: \"nothing to save\" }, 400); return; } const target = path.join(dir(true), name); try { "
      + "fs.writeFileSync(target, JSON.stringify(payload, null, 1), \"utf8\"); } catch (err) { reply(res, { ok: false, error: err "
      + "instanceof Error ? err.message : String(err) }, 500); return; } reply(res, { ok: true, name, folder: dir() });") {
    useStray.push(`saveJsonFile() is now: ${saveBody}`);
  }
  check(!useStray.length, "the folders behind FOLDERS are used only as listed: called or handed to saveJsonFile",
    `found: ${useStray.join(" | ")}`);

  // --- 1b. die Einstellungen (Spezifikation Live-Leistung 4 und 6): ganz
  //         oder gar nicht - eine Temp-Datei daneben, darueber umbenannt -
  //         und nur, wenn sich etwas aendert. Sonst schreibt nur
  //         migrateSettings() die Datei, einmal, wenn es sie noch nicht gibt.
  const cfgSrc = code["config.ts"] ?? "";
  const cfgWrites = [...cfgSrc.matchAll(/\bfs\.(writeFileSync|renameSync)\(([^;]*)\);/g)].map((m) => `${m[1]}(${m[2]})`);
  const save = (cfgSrc.match(/function saveConfig\(cfg: Config\): void \{([\s\S]*?)\n\}/) || [null, ""])[1];
  check(cfgWrites.length === 3 && cfgWrites[0] === 'writeFileSync(target, data, "utf8")'
      && cfgWrites[1] === 'writeFileSync(CONFIG_PATH + ".tmp", JSON.stringify(cfg, null, 1), "utf8")'
      && cfgWrites[2] === 'renameSync(CONFIG_PATH + ".tmp", CONFIG_PATH)'
      && save.indexOf(cfgWrites[1]) >= 0 && save.indexOf(cfgWrites[1]) < save.indexOf(cfgWrites[2])
      && !/\bfs\.(?!readFileSync|writeFileSync|renameSync|existsSync|statSync)\w+/.test(cfgSrc),
    "the settings file is written whole: a temp file beside it, then renameSync", `found: ${cfgWrites.join(" | ")}`);
  const upd = (cfgSrc.match(/export function updateConfig\(changes: Config\): Config \{([\s\S]*?)\n\}/) || [null, ""])[1];
  check(upd === "\n  const cfg = loadConfig();\n  const before = JSON.stringify(cfg);\n  Object.assign(cfg, changes);" +
      "\n  if (JSON.stringify(cfg) !== before) saveConfig(cfg);\n  return cfg;"
      && [...cfgSrc.matchAll(/\bsaveConfig\(/g)].length === 2,
    "the settings file is written only when something changed", `updateConfig: ${upd.trim().replace(/\s+/g, " ")}`);
  // Positivliste statt Verbotsliste (wie 2b): "fs.writeFileSync" und
  // "fs.renameSync" als Text zu verlangen genuegt nicht - writeFileSync unter
  // einem zweiten Namen importiert (import { writeFileSync as wfs } ...) oder
  // aus fs herausdestrukturiert (const { writeFileSync: w2 } = fs) ruft
  // dieselbe Funktion auf, ohne dass "fs." je davorsteht, und faellt durch die
  // Zaehlung oben. Also: jede Nennung von writeFileSync/renameSync als Wort
  // (in der stringfreien Ansicht, damit ein Text es nicht vortaeuschen kann)
  // muss unmittelbar hinter "fs." stehen - sonst ist es ein zweiter Name dafuer.
  const cfgBare = bare["config.ts"] ?? "";
  const cfgBareNames = [...cfgBare.matchAll(/\b(writeFileSync|renameSync)\b/g)];
  const cfgStrayNames = cfgBareNames.filter((m) => cfgBare.slice(Math.max(0, m.index - 3), m.index) !== "fs.");
  check(!cfgStrayNames.length,
    "writeFileSync and renameSync are named only as fs.writeFileSync / fs.renameSync, never imported or bound under another name",
    `found: ${cfgStrayNames.map((m) => m[0]).join(" | ")}`);
  // "fs.writeFileSync" darf selbst auch nicht als Wert herumgereicht werden
  // (const w = fs.writeFileSync; ... w(CONFIG_PATH, ...)) - jede Nennung, die
  // hinter "fs." steht, muss Teil genau eines der drei Aufrufe oben sein, nie
  // eine blosse Referenz.
  check(cfgBareNames.length - cfgStrayNames.length === cfgWrites.length,
    "fs.writeFileSync / fs.renameSync appear only as the three calls above, never handed on as a value",
    `${cfgBareNames.length - cfgStrayNames.length} mentions behind "fs.", ${cfgWrites.length} calls`);
  // und nicht ueber einen Zeichenkettenschluessel (fs["writeFileSync"]),
  // der in der stringfreien Ansicht unsichtbar waere
  const cfgComputed = [...cfgSrc.matchAll(/["'`](writeFileSync|renameSync)["'`]/g)].map((m) => m[0]);
  check(!cfgComputed.length,
    "writeFileSync and renameSync are never reached through a computed (string) key",
    `found: ${cfgComputed.join(" | ")}`);

  // --- 2. the watched log folder must only ever be read
  const logs = code["logs.ts"] ?? "";
  const logWrites = logs.match(/\b(writeFile|appendFile|createWriteStream|rename|unlink|rm|rmdir|mkdir|copyFile|truncate|chmod|utimes)\w*\(/g);
  check(!logWrites, "the combat log folder is only ever read from", `found: ${logWrites}`);
  const dirWrites = all.match(/(writeFile|appendFile|rename|unlink|rm)\w*\([^)]*STATE\.dir/g);
  check(!dirWrites, "nothing derived from the watched folder is written or removed", `found: ${dirWrites}`);

  // --- 2b. Live (Spezifikation Live-Leistung 6): die eine geoeffnete Datei
  //         nur lesend, unter dem Pfad, den newestLog() fand. Kein Aufruf auf
  //         dem Deskriptor schreibt, und der Name aus der Anfrage wird nur
  //         verglichen, nie geoeffnet.
  const opens = [...(bare["logs.ts"] ?? "").matchAll(/\bopenSync\s*\(/g)].length;
  const openArgs = [...logs.matchAll(/\bopenSync\s*\(([^)]*)\)/g)].map((m) => m[1].trim());
  const logFd = (bare["logs.ts"] ?? "").match(/\bfs\s*\.\s*(open|openAsBlob|createReadStream|writeSync|writev\w*|ftruncate\w*|fchmod\w*|fchown\w*|futimes\w*|fsync\w*|fdatasync\w*|promises)\b|\bfs\s*\[/g) || [];
  check(opens > 0 && opens === openArgs.length && openArgs.every((a) => a === 'found.full, "r"') && !logFd.length,
    "the log is opened read-only (\"r\"), only by the path newestLog found, and nothing on it is written",
    `openSync(${openArgs.join(") | openSync(")}); also: ${logFd.join(" | ")}`);
  const answer = (logs.match(/export function latestAnswer\(found: FoundLog, file: string \| null, from: string \| null\):[^{]*\{([\s\S]*?)\n\}/) || [null, ""])[1];
  const latestCase = ((code["server.ts"] ?? "").match(/case "\/api\/latest": \{([\s\S]*?)\n    case "/) || [null, ""])[1];
  const latestCalls = [...latestCase.matchAll(/\b(readLog|readLogFrom|latestAnswer)\s*\(/g)].map((m) => m[1]);
  // found is built exactly once, by newestLog(). A blacklist of "bad"
  // patterns (an assignment, Object.assign, ...) always misses a new way to
  // read or write it - a cast (found as any).full = ..., or copying it to
  // another name first. So instead: every occurrence of the token "found"
  // in the case body, and in latestAnswer's body, must be one of the exact,
  // unchanged lines below - nothing else may so much as mention it.
  const foundTotal = [...latestCase.matchAll(/\bfound\b/g)].length;
  const foundAllowed = [
    /\bconst found = newestLog\(STATE\.dir\);/g,
    /\bif \(!found\) return text\(res, "", 404\);/g,
    /\blatestAnswer\(found, q\.get\("file"\), q\.get\("from"\)\)/g,
    /\breadLog\(found\)/g,
  ].reduce((n, re) => n + [...latestCase.matchAll(re)].length, 0);
  const answerFoundTotal = [...answer.matchAll(/\bfound\b/g)].length;
  const answerFoundAllowed = [
    /\bif \(file !== found\.name\) return \{ status: 409, body: \{ ok: false, error: "not the newest log" \} \};/g,
    /\bconst tail = readLogFrom\(found, Number\(from\)\);/g,
  ].reduce((n, re) => n + [...answer.matchAll(re)].length, 0);
  check(/^\s*const found = newestLog\(STATE\.dir\);/.test(latestCase)
      && latestCalls.join() === "latestAnswer,readLog"
      && latestCase.includes('const { status, body } = latestAnswer(found, q.get("file"), q.get("from"));')
      && latestCase.includes('if (status === 200 && "to" in body) leseFortschritt(currentWindow(), body.to, body.size);')
      && latestCase.includes("text(res, readLog(found));")
      && !/\bfs\b|openSync|readFileSync|createReadStream|\bpath\./.test(latestCase)
      && foundTotal === foundAllowed && answerFoundTotal === answerFoundAllowed
      && [...answer.matchAll(/\bfile\b/g)].length === 1 && answer.includes("if (file !== found.name) return")
      && [...answer.matchAll(/\breadLogFrom\(([^)]*)\)/g)].every((m) => /^found,/.test(m[1])),
    "/api/latest reads only the newest log; the name in the request is compared, never opened, and found is never reassigned, cast or aliased",
    `calls: ${latestCalls.join(" | ")}; found ${foundTotal}/${foundAllowed} allowed uses, latestAnswer found ${answerFoundTotal}/${answerFoundAllowed} allowed uses`);

  // --- 2c. Fruehere Tage (Spezifikation Nachtraege N3): GET /api/logs listet
  //         die Logdateien des beobachteten Ordners, GET /api/log liest eine
  //         davon in Stuecken. Wie 2b eine Positivliste: listLogs(),
  //         newestLog() und logAnswer() stehen hier wortwoertlich - der Name
  //         aus der Anfrage wird nur mit einer frischen Auflistung verglichen,
  //         geoeffnet wird der Pfad dieser Auflistung (ueber readLogFrom, "r",
  //         hoechstens TAIL_MAX je Antwort), nur Dateien, hoechstens 60. Die
  //         beiden Faelle stehen wortwoertlich im GET-Pfad, der POST-Pfad
  //         nennt keinen; jeder Aufruf der drei in server.ts fragt STATE.dir.
  const LIST_LOGS = "if (!folder || !isDir(folder)) return []; const found: FoundLog[] = []; try { for (const name of "
    + "fs.readdirSync(folder)) { const lower = name.toLowerCase(); if (!LOG_PATTERNS.some((ext) => lower.endsWith(ext))) "
    + "continue; const full = path.join(folder, name); const stat = fs.lstatSync(full); if (!stat.isFile()) continue; "
    + "found.push({ name, full, size: stat.size, mtime: Math.floor(stat.mtimeMs / 1000), mtimeMs: stat.mtimeMs }); } } "
    + "catch { return []; } found.sort((a, b) => b.mtimeMs - a.mtimeMs); return found.slice(0, LIST_MAX);";
  const LOG_ANSWER = "const found = listLogs(folder).find((f) => f.name === name); if (!found) return { status: 404, body: "
    + "{ ok: false, error: \"not a log in the folder\" } }; if (from === null || !/^(0|[1-9]\\d{0,14})$/.test(from)) return "
    + "{ status: 400, body: { ok: false, error: \"from is not a byte\" } }; const piece = readLogFrom(found, Number(from)); "
    + "if (!piece) return { status: 409, body: { ok: false, error: \"the log is shorter than that\" } }; return { status: 200, body: piece };";
  const LOGS_CASE = "const files = listLogs(STATE.dir).map((f) => ({ name: f.name, size: f.size, mtime: f.mtime })); "
    + "return reply(res, { ok: true, files });";
  const LOG_CASE = "try { const { status, body } = logAnswer(STATE.dir, q.get(\"name\"), q.get(\"from\")); if (status === 200 && \"to\" in body) leseFortschritt(currentWindow(), body.to, body.size); return reply(res, body, status); } "
    + "catch { return text(res, \"\", 500); }";
  const tageStray = [];
  const listBodyLogs = bodyOf(logs, "export function listLogs(folder: string): FoundLog[] {");
  if (listBodyLogs !== LIST_LOGS) tageStray.push(`listLogs() is now: ${listBodyLogs}`);
  const newestBody = bodyOf(logs, "export function newestLog(folder: string): FoundLog | null {");
  if (newestBody !== "return listLogs(folder)[0] ?? null;") tageStray.push(`newestLog() is now: ${newestBody}`);
  const logAnswerBody = bodyOf(logs, "export function logAnswer(folder: string, name: string | null, from: string | null):\n"
    + "  { status: number; body: LogTail | { ok: false; error: string } } {");
  if (logAnswerBody !== LOG_ANSWER) tageStray.push(`logAnswer() is now: ${logAnswerBody}`);
  if (!/^export const LIST_MAX = 60;$/m.test(logs) || counts("logs.ts", /\bLIST_MAX\b/g) !== 2) tageStray.push("LIST_MAX is not 60, once");
  // only *.txt and *.log, as written, used only in listLogs (Pruefung N3, W2)
  if (!/^const LOG_PATTERNS = \["\.txt", "\.log"\];$/m.test(logs) || counts("logs.ts", /\bLOG_PATTERNS\b/g) !== 2) {
    tageStray.push("LOG_PATTERNS is not [\".txt\", \".log\"], once");
  }
  if (counts("logs.ts", /\blistLogs\b/g) !== 3) tageStray.push(`logs.ts: listLogs ${counts("logs.ts", /\blistLogs\b/g)}x`);
  const srvCode = code["server.ts"] ?? "";
  const tageGet = (srvCode.match(/async function handleGet\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || [null, ""])[1];
  const tagePost = (srvCode.match(/async function handlePost\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || [null, ""])[1];
  const caseBody = (name) => {
    const m = tageGet.match(new RegExp(`\\n    case "${name.replace(/\//g, "\\/")}": \\{([\\s\\S]*?)\\n    \\}\\n`));
    return m ? norm(m[1]) : null;
  };
  if (caseBody("/api/logs") !== LOGS_CASE) tageStray.push(`case /api/logs is now: ${caseBody("/api/logs")}`);
  if (caseBody("/api/log") !== LOG_CASE) tageStray.push(`case /api/log is now: ${caseBody("/api/log")}`);
  if (/"\/api\/logs?"/.test(tagePost)) tageStray.push("the POST path names /api/log or /api/logs");
  if (counts("server.ts", /\blistLogs\b/g) !== 3 || counts("server.ts", /\blogAnswer\b/g) !== 2) tageStray.push("server.ts calls listLogs or logAnswer elsewhere");
  for (const c of callsOf("server.ts", /\b(newestLog|listLogs|logAnswer)\s*\(/g)) {
    if (!/^STATE\.dir(,|$)/.test(c.args ?? "")) tageStray.push(`server.ts: ${c.name}(${c.args})`);
  }
  check(!tageStray.length,
    "/api/logs and /api/log only list and read the logs of the watched folder: the name is compared with a fresh listing, never opened; GET only",
    `found: ${tageStray.join(" | ")}`);

  // "recently read" (spec Windows-Einbindung 5): the one POST that keeps a log's name. Pinned word for
  // word: only name is read, it must equal the name of an entry of a fresh listing, and what is kept is
  // that entry's name under zuletztGelesen - once. It exists only in the POST handler.
  const GELESEN_CASE = "const name = String(sent.name ?? \"\"); const entry = listLogs(STATE.dir).find((f) => f.name === name); "
    + "if (!entry) return reply(res, { ok: false }, 404); "
    + "updateConfig({ zuletztGelesen: zuletztNeu(loadConfig().zuletztGelesen, entry.name) }); jumpListBauen(); return reply(res, { ok: true });";
  const gelesenIn = (handler) => (handler.match(/\n    case "\/api\/gelesen": \{([\s\S]*?)\n    \}\n/) || [null, null])[1];
  const gelesenPost = gelesenIn(tagePost);
  const gelesenStray = [];
  if (gelesenPost === null || gelesenPost === undefined || norm(gelesenPost) !== GELESEN_CASE) gelesenStray.push(`case /api/gelesen is now: ${gelesenPost == null ? null : norm(gelesenPost)}`);
  if ([...srvCode.matchAll(/\/api\/gelesen/g)].length !== 1) gelesenStray.push(`/api/gelesen named ${[...srvCode.matchAll(/\/api\/gelesen/g)].length}x in server.ts`);
  if (counts("server.ts", /\bzuletztGelesen\b/g) !== 2) gelesenStray.push(`zuletztGelesen ${counts("server.ts", /\bzuletztGelesen\b/g)}x in server.ts`);
  check(!gelesenStray.length,
    "/api/gelesen keeps only the name of a listed log under zuletztGelesen, and only in the POST path",
    `found: ${gelesenStray.join(" | ")}`);

  // --- 2d. Ein Log wird nur als Eintrag der Auflistung gelesen (Pruefung N3,
  //         W1; die Luecke bestand fuer 2b schon vorher): 2b und 2c halten
  //         latestAnswer, logAnswer und die Faelle fest, aber nicht, dass
  //         keine neue Funktion und kein neuer Fall ein FoundLog aus der
  //         Anfrage baut oder eines umbiegt. Darum: readLogFrom wird nur in
  //         latestAnswer und logAnswer gerufen, readLog nur im Fall
  //         /api/latest; der Pfad eines Logs (full) steht nur an seinen
  //         festen Stellen in logs.ts - gebaut nur in listLogs, gelesen nur
  //         als found.full in readLog und readLogFrom -, nirgends sonst in
  //         main, und nirgends wird .full zugewiesen; FoundLog ist nur in
  //         logs.ts genannt, an seinen sieben Stellen.
  const pathStray = [];
  const bodyHas = (body, call) => (body ?? "").split(call).length - 1;
  const latestBody = bodyOf(logs, "export function latestAnswer(found: FoundLog, file: string | null, from: string | null):\n"
    + "  { status: number; body: LogTail | { ok: false; error: string } } {");
  if (counts("logs.ts", /\breadLogFrom\b/g) !== 3 || bodyHas(latestBody, "readLogFrom(found, ") !== 1
      || bodyHas(logAnswerBody, "readLogFrom(found, ") !== 1) pathStray.push(`logs.ts: readLogFrom ${counts("logs.ts", /\breadLogFrom\b/g)}x`);
  if (bodyOf(logs, "export function readLog(found: FoundLog): string {") !== 'return fs.readFileSync(found.full, "utf8");'
      || counts("logs.ts", /\breadLog\b/g) !== 1) pathStray.push(`logs.ts: readLog ${counts("logs.ts", /\breadLog\b/g)}x`);
  if (counts("server.ts", /\breadLog\b/g) !== 2 || !latestCase.includes("text(res, readLog(found));")) {
    pathStray.push(`server.ts: readLog ${counts("server.ts", /\breadLog\b/g)}x`);
  }
  const FULL_AT = ["  full: string;", "      const full = path.join(folder, name);", "      const stat = fs.lstatSync(full);",
    "      found.push({ name, full, size: stat.size, mtime: Math.floor(stat.mtimeMs / 1000), mtimeMs: stat.mtimeMs });",
    '  return fs.readFileSync(found.full, "utf8");', '  const fd = fs.openSync(found.full, "r");'];
  const fullLines = [...logs.matchAll(/^[^\n]*\bfull\b[^\n]*$/gm)].map((m) => m[0]);
  if (counts("logs.ts", /\bfull\b/g) !== 6 || fullLines.join("\n") !== FULL_AT.join("\n")) pathStray.push(`logs.ts: full at ${fullLines.map((l) => l.trim()).join(" | ")}`);
  for (const f of files) {
    if (f !== "logs.ts" && /\bFoundLog\b/.test(bare[f])) pathStray.push(`${f}: FoundLog`);
    if (f !== "logs.ts" && /\.\s*full\b|\bfull\s*:/.test(bare[f])) pathStray.push(`${f}: .full`);
    if (f === "server.ts" && /\bfull\b/.test(bare[f])) pathStray.push("server.ts: full");
    if (/\.\s*full\s*(=(?!=)|\+=)|\[\s*["'`]full["'`]\s*\]/.test(code[f])) pathStray.push(`${f}: .full assigned`);
  }
  if (counts("logs.ts", /\bFoundLog\b/g) !== 7) pathStray.push(`logs.ts: FoundLog ${counts("logs.ts", /\bFoundLog\b/g)}x`);
  check(!pathStray.length,
    "a log is read only as an entry of the listing: readLogFrom only in latestAnswer and logAnswer, readLog only for /api/latest, full never built or set elsewhere",
    `found: ${pathStray.join(" | ")}`);

  // --- 3. no process access, memory access, input injection or native code
  const forbidden = {
    child_process: "spawning processes",
    "node:child_process": "spawning processes",
    "process.dlopen": "native code",
    ffi: "native/DLL access",
    koffi: "native/DLL access",
    "node-gyp": "native code",
    ".node\"": "native addons",
    OpenProcess: "process handle access",
    ReadProcessMemory: "reading game memory",
    WriteProcessMemory: "writing game memory",
    robotjs: "synthetic input",
    "nut-js": "synthetic input",
    SendInput: "synthetic input",
    uiohook: "global input hooks",
    iohook: "global input hooks",
    globalShortcut: "global key hooks",
    desktopCapturer: "screen capture",
    capturePage: "screen capture",
    eval: "code execution",
    "new Function": "code execution",
  };
  // hotkey.ts is the one file allowed to name globalShortcut; section 3b
  // below holds it to exactly one fixed key combination
  const allButHotkey = Object.entries(code).filter(([f]) => f !== "hotkey.ts").map(([, s]) => s).join("\n");
  const hits = Object.entries(forbidden)
    .filter(([k]) => {
      const src = k === "globalShortcut" ? allButHotkey : all;
      return k === "eval" ? /\beval\s*\(/.test(src) : src.includes(k);
    })
    .map(([k, v]) => `${k} (${v})`);
  check(!hits.length, "no process, memory, input-injection, capture or native-code access", `found: ${hits.join(", ")}`);

  // --- 3b. one global hotkey, and nothing that reads the keyboard.
  //   globalShortcut on Windows is RegisterHotKey: Windows tells the app
  //   when that one combination is pressed and about no other key. A
  //   keyboard hook (uiohook, SetWindowsHookEx) sees every key and stays
  //   forbidden above. So: one file, one register() call, and its key is a
  //   constant written out in full - never built at run time from input.
  const hk = code["hotkey.ts"];
  if (hk !== undefined) {
    const combo = hk.match(/export const HOTKEY\s*=\s*"([^"]+)"\s*;/);
    check(!!combo && /^(CommandOrControl|Control|Ctrl)\+Shift\+[A-Z]$/.test(combo[1]),
      "the global hotkey is one fixed combination written as a constant", `found: ${combo ? combo[1] : "no HOTKEY constant"}`);
    const calls = [...hk.matchAll(/globalShortcut\.(\w+)\(([^)]*)\)/g)].map((m) => [m[1], m[2].trim()]);
    const registers = calls.filter(([fn]) => fn === "register");
    check(registers.length === 1 && registers[0][1].startsWith("HOTKEY,"),
      "hotkey.ts registers exactly one shortcut, the HOTKEY constant", `register calls: ${registers.map((r) => r[1]).join(" | ") || "none"}`);
    const others = calls.filter(([fn]) => !["register", "unregister", "isRegistered"].includes(fn));
    check(!others.length, "no other globalShortcut use (no registerAll)", `found: ${others.map(([fn]) => fn).join(", ")}`);
    check(!/SetWindowsHookEx|keybd_event|GetAsyncKeyState|GetKeyState|before-input-event/.test(hk),
      "hotkey.ts reads no keys beyond its own combination");
  }

  // --- 4. nothing uploads a combat log: no outbound request carries file
  //        contents, and the log reader is used only by the local server
  const fetchBodies = [...all.matchAll(/fetchJson\(([\s\S]*?)\);/g)].map((m) => m[1]);
  for (const body of fetchBodies) {
    check(!/readLog|readFile|latest/.test(body), "outbound request carries no file contents", body.slice(0, 80));
  }
  // with the listing and the older days (spec Nachtraege N3): listLogs and logAnswer as well
  const readers = Object.entries(code).filter(([f, src]) => f !== "logs.ts" && /\b(readLog|readLogFrom|latestAnswer|listLogs|logAnswer)\(/.test(src)).map(([f]) => f);
  check(readers.every((f) => f === "server.ts"), "only the local server reads the log", `readers: ${readers}`);
  check(!/readLog/.test(code["party.ts"] ?? ""), "the party code never touches the log");

  // --- 5. the app's own server binds to localhost; only the party listener
  //        may be reachable from the network
  const server = code["server.ts"] ?? "";
  check(/listenFrom\(\s*server,\s*"127\.0\.0\.1"/.test(server), "the app's own server binds to localhost");
  const publicBinds = Object.entries(code).filter(([, src]) => /"0\.0\.0\.0"/.test(src)).map(([f]) => f);
  check(publicBinds.every((f) => f === "party.ts"), "only the party listener binds to the network", `found in: ${publicBinds}`);
  // --- 5b. /api answers the app's own page only. Localhost is not enough: a
  //         web page in a browser on this machine can POST to 127.0.0.1
  //         without a preflight, and an <img src> can GET it with no Origin
  //         at all. apiRefusal() checks Host, Origin, Sec-Fetch-Site and the
  //         JSON content type, and handle() asks it before anything else.
  const refusal = (server.match(/function apiRefusal\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || [null, null])[1];
  check(refusal !== null, "an /api origin check (apiRefusal) exists in server.ts");
  if (refusal !== null) {
    const returns = [...refusal.matchAll(/return\s+([^;]*);/g)].map((m) => m[1].trim());
    check(returns.join() === "403,403,403,415,0",
      "the /api check refuses a foreign Host, Origin and fetch site (403) and a non-JSON POST (415), in that order", `returns: ${returns.join(", ")}`);
    check(/const own = \[`127\.0\.0\.1:\$\{port\}`, `localhost:\$\{port\}`\];/.test(refusal)
        && /const port = STATE\.port;/.test(refusal)
        && !/\bown\s*(\.\s*(?!includes\b|some\b)\w+|\[|=(?!=))/.test(refusal.replace(/const own = [^;]*;/, "")),
      "the only accepted hosts are this server's own loopback names and port");
    check(/if \(!own\.includes\(host\)\) return 403;/.test(refusal)
        && /const host = String\(req\.headers\.host \?\? ""\)\.toLowerCase\(\);/.test(refusal)
        && /if \(origin !== undefined && !own\.some\(\(h\) => origin\.toLowerCase\(\) === `http:\/\/\$\{h\}`\)\) return 403;/.test(refusal)
        && /const origin = req\.headers\.origin;/.test(refusal)
        && /if \(req\.method === "POST" && media !== JSON_TYPE\) return 415;/.test(refusal),
      "the /api check compares Host, Origin and Content-Type as written");
    // a no-cors GET (<img src>) carries no Origin; Sec-Fetch-Site says where it came from
    check(/const site = req\.headers\["sec-fetch-site"\];/.test(refusal)
        && /if \(site !== undefined && site !== "same-origin" && site !== "none"\) return 403;/.test(refusal),
      "the /api check refuses a request another site made (Sec-Fetch-Site)");
    check(!/req\.headers(\[[^\]]*\]|\.\w+)?\s*=(?!=)|delete\s+req\.headers/.test(refusal),
      "the /api check reads the request's headers and never changes them");
  }
  // Nothing a GET can trigger changes anything: a GET is what any web page
  // can make this browser send without asking. Changing the watched folder,
  // writing the settings and asking the party server are POST only.
  const getBody = (server.match(/async function handleGet\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || [null, null])[1];
  const postBody = (server.match(/async function handlePost\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || [null, null])[1];
  check(getBody !== null && postBody !== null, "server.ts has one GET and one POST handler");
  if (getBody !== null && postBody !== null) {
    const stateful = ["updateConfig(", "STATE.dir =", "fetchJson(", "/api/dir", "/api/party/check", "/api/party/curve",
      "writeFileSync(", "shell.", "putBest(", "saveBest(", "putBuild(", "saveBuilds(",
      "putWeeklies(", "saveWeeklies(", "createWeeklies(", "putGilde(", "saveGilde(", "createGilde(",
      "checkUpdate(", "setUpdate("].filter((w) => getBody.includes(w));
    check(!stateful.length, "no GET route changes state or reaches out (dir, settings, party server)", `found: ${stateful}`);
    check(['case "/api/dir":', 'case "/api/party/check":', 'case "/api/party/curve":'].every((c) => postBody.includes(c)),
      "/api/dir, party/check and party/curve are handled in the POST path");
  }
  const handleBody = (server.match(/async function handle\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || [null, ""])[1];
  const guardAt = handleBody.indexOf('if (url.pathname.startsWith("/api")) {\n    const refused = apiRefusal(req);\n    if (refused) return ');
  const firstUse = Math.min(...["handleGet(", "handlePost(", "readJson("].map((f) => {
    const i = handleBody.indexOf(f);
    return i < 0 ? Infinity : i;
  }));
  check(guardAt >= 0 && guardAt < firstUse && isFinite(firstUse),
    "every /api request passes the origin check before it is read or answered");
  check(server.split("apiRefusal(").length === 3,
    "the origin check is defined once and asked once, from handle()");

  // --- 5c. the file manager opens only the folders named here (spec
  //         Nachtraege N1). /api/folder/open takes a key, never a path: the
  //         app's three own folders (FOLDERS in paths.ts, made if missing)
  //         and "game", the watched combat log folder, which is opened only
  //         while it is a folder and never made or written. shell does
  //         nothing else: openPath only in that case, openExternal (links to
  //         the web) only in window.ts, and no other member at all.
  //         Electron comes in only as named imports on one line, each under
  //         its own name - no alias, no namespace or default import - so
  //         shell cannot be reached under a name the rules below do not
  //         read (Pruefung N1, W1: `import { shell as sh }` and
  //         `import * as E` + E["sh" + "ell"] passed before).
  const ELECTRON_IMPORT = /^import \{ ([A-Za-z_$][\w$]*(?:, [A-Za-z_$][\w$]*)*) \} from "electron";$/;
  const electronStray = [];
  const shellImports = [];
  const importLines = {};
  for (const f of files) {
    // every place the module is named as one - from "electron", a bare
    // import "electron" - stands on a plain named import line
    const lines = [...code[f].matchAll(/^[^\n]*$/gm)].filter((m) => ELECTRON_IMPORT.test(m[0]));
    for (const m of code[f].matchAll(/^[^\n]*(?:\bfrom|\bimport)\s*["'`]electron["'`][^\n]*$/gm)) {
      if (!ELECTRON_IMPORT.test(m[0])) electronStray.push(`${f}: ${m[0].trim()}`);
    }
    importLines[f] = lines;
    for (const l of lines) if (l[0].match(ELECTRON_IMPORT)[1].split(", ").includes("shell")) shellImports.push(f);
  }
  check(!electronStray.length && shellImports.join() === "server.ts,window.ts",
    "electron is imported only as { names } on one line, each under its own name; shell only in server.ts and window.ts",
    `found: ${electronStray.join(" | ")}; shell imported in: ${shellImports.join(", ")}`);
  const shellUses = [];
  for (const f of files) {
    // the plain import lines checked above are the one place shell may stand
    // on its own; any other import line stays in and is read like code
    let rest = bare[f];
    for (const l of importLines[f]) rest = rest.slice(0, l.index) + " ".repeat(l[0].length) + rest.slice(l.index + l[0].length);
    for (const m of rest.matchAll(/\bshell\b(\s*\.\s*(\w+)\s*\(?)?/g)) shellUses.push({ f, use: norm(m[0]) });
  }
  // every naming of the shell members that open, remove or reveal - in code
  // and in strings - is counted to its fixed places, whatever it hangs on
  const SHELL_NAMES = /\b(openPath|openExternal|trashItem|showItemInFolder|beep)\b/g;
  const named = {};
  for (const f of files) for (const m of code[f].matchAll(SHELL_NAMES)) named[`${f}: ${m[1]}`] = (named[`${f}: ${m[1]}`] ?? 0) + 1;
  check(JSON.stringify(named) === JSON.stringify({ "server.ts: openPath": 1, "window.ts: openExternal": 2 }),
    "openPath, openExternal, trashItem, showItemInFolder and beep are named only at their fixed places",
    `found: ${JSON.stringify(named)}`);
  const shellOk = (u) => u.use === "shell.openPath(" || u.use === "shell.openExternal(";
  check(shellUses.every(shellOk), "main reaches shell only as shell.openPath( and shell.openExternal(",
    `found: ${shellUses.filter((u) => !shellOk(u)).map((u) => `${u.f}: ${u.use}`).join(" | ")}`);
  const folderCase = (server.match(/\n    case "\/api\/folder\/open": \{([\s\S]*?)\n    \}\n/) || [null, null])[1];
  const openPaths = shellUses.filter((u) => u.use === "shell.openPath(");
  check(folderCase !== null && openPaths.length === 1 && openPaths[0].f === "server.ts" && folderCase.includes("shell.openPath("),
    "shell.openPath is called once, in the /api/folder/open case", `found in: ${openPaths.map((u) => u.f).join(", ")}`);
  const externals = shellUses.filter((u) => u.use === "shell.openExternal(");
  check(externals.every((u) => u.f === "window.ts"), "shell.openExternal is called only in window.ts",
    `found in: ${externals.map((u) => u.f).join(", ")}`);
  // the keys: FOLDERS as written in paths.ts, named nowhere but there and in
  // the one case (import, the own-key test, the call), and "game" beside it
  const FOLDERS_DEF = "export const FOLDERS: Record<string, (create?: boolean) => string> = { "
    + "logs: savesDir, party: partyLogsDir, bugs: bugReportsDir, };";
  const foldersDef = norm(((code["paths.ts"] ?? "").match(/export const FOLDERS\b[^\n]*\{[^}]*\};/) || [""])[0]);
  const foldersIn = Object.fromEntries(files.map((f) => [f, [...bare[f].matchAll(/\bFOLDERS\b/g)].length]).filter(([, n]) => n));
  check(foldersDef === FOLDERS_DEF && JSON.stringify(foldersIn) === JSON.stringify({ "paths.ts": 1, "server.ts": 3 })
      && folderCase !== null && [...folderCase.matchAll(/\bFOLDERS\b/g)].length === 2
      && [...folderCase.matchAll(/\bkey\s*[!=]==?\s*"([^"\n]*)"/g)].map((m) => m[1]).join() === "game",
    "the folder keys are fixed: logs, party, bugs and game", `FOLDERS: ${foldersDef}; named in: ${JSON.stringify(foldersIn)}`);
  // the case word for word: the path is an own FOLDERS entry or STATE.dir, the
  // request gives the key alone, and the game folder is checked, never made
  const FOLDER_CASE = 'const key = String(sent.folder ?? ""); '
    + "const make = Object.hasOwn(FOLDERS, key) ? FOLDERS[key] : undefined; "
    + 'let folder = ""; if (key === "game") { let isDir = false; '
    + "try { isDir = !!STATE.dir && fs.statSync(STATE.dir).isDirectory(); } catch { isDir = false; } "
    + "if (!isDir) return reply(res, { ok: false }, 404); folder = STATE.dir; } "
    + "else if (make) { folder = make(true); } "
    + 'else { return reply(res, { ok: false, error: "unknown folder" }, 400); } '
    + "const error = await shell.openPath(folder); if (error) return reply(res, { ok: false, folder, error }, 500); "
    + "return reply(res, { ok: true, folder });";
  check(folderCase !== null && norm(folderCase) === FOLDER_CASE,
    "the folder opened comes only from FOLDERS or STATE.dir, never from the request",
    `case: ${folderCase === null ? "missing" : norm(folderCase)}`);
  // STATE.dir itself is set in two places only (Pruefung N1, M1): where
  // STATE is declared, from the settings or the guess, and in the POST case
  // /api/dir, after the folder check. No other assignment - plain,
  // compound, ++/--, destructuring or a for-in/of target.
  const srvBare = bare["server.ts"] ?? "";
  const dirSets = [];
  for (const m of srvBare.matchAll(/\bSTATE\s*\.\s*dir\b/g)) {
    const after = srvBare.slice(m.index + m[0].length);
    const before = srvBare.slice(0, m.index);
    if (/^\s*(?:=(?![=>])|(?:\*\*|<<|>>>|>>|&&|\|\||\?\?|[-+*/%&|^])=|\+\+|--)/.test(after) || /(?:\+\+|--)\s*$/.test(before)
        || /^\s+(?:of|in)\b/.test(after)) dirSets.push(norm(srvBare.slice(m.index, m.index + 60).split("\n")[0]));
  }
  // a destructuring target: a { ... } or [ ... ] naming STATE, then "="
  for (const m of srvBare.matchAll(/[}\]]\s*=(?![=>])/g)) {
    const close = srvBare[m.index], open = close === "}" ? "{" : "[";
    let depth = 0, i = m.index;
    for (; i >= 0; i--) {
      if (srvBare[i] === close) depth++;
      else if (srvBare[i] === open && --depth === 0) break;
    }
    if (i >= 0 && /\bSTATE\b/.test(srvBare.slice(i, m.index))) dirSets.push(`destructuring: ${norm(srvBare.slice(i, m.index + 1))}`);
  }
  const dirCase = (server.match(/\n    case "\/api\/dir": \{([\s\S]*?)\n    \}\n/) || [null, ""])[1];
  const DIR_CASE = 'const wanted = String(sent.path ?? "").replace(/^["\\s]+|["\\s]+$/g, ""); let isDir = false; '
    + "try { isDir = !!wanted && fs.statSync(wanted).isDirectory(); } catch { isDir = false; } "
    + "if (isDir) { STATE.dir = wanted; updateConfig({ log_dir: wanted }); reply(res, { ok: true, dir: wanted }); } "
    + "else { reply(res, { ok: false }); } return;";
  check(dirSets.length === 1 && dirSets[0].startsWith("STATE.dir = wanted;") && norm(dirCase) === DIR_CASE
      && /\nconst STATE = \{\n  dir: configString\("log_dir"\) \|\| guessLogDir\(\),\n/.test(server),
    "STATE.dir is set only at its declaration (settings or guess) and in /api/dir after the folder check",
    `assignments: ${dirSets.join(" | ")}; /api/dir: ${norm(dirCase)}`);
  // and /api/folder/open is reached only as a POST (Pruefung N1, G1):
  // handlePost is called once, from handle(), never handed on; the route's
  // name stands once in server.ts; and the case before it ends in a return,
  // so nothing falls through into it
  const handleCalls = [...srvBare.matchAll(/\bhandlePost\b/g)].length;
  check(handleCalls === 2 && /\n    return handlePost\(url, read\.body, res\);\n/.test(handleBody)
      && (toks["server.ts"].strings ?? []).filter((s) => s.includes("folder/open")).length === 1
      && /\n    case "\/api\/party-log\/save":\n      return saveJsonFile\(res, sent, partyLogsDir\);\n\n    case "\/api\/folder\/open": \{\n/.test(server),
    "/api/folder/open is reached only through handlePost's own case, called once from handle(), with no fall-through into it",
    `handlePost named ${handleCalls}x`);

  // --- 6/7. "stay on top" and "see-through" are one property each, on our
  //          own window, and nothing near them resembles an overlay hook or
  //          a screen capture.
  const win = code["window.ts"] ?? "";
  const block = (name) => {
    const m = win.match(new RegExp(`case "${name}":([\\s\\S]*?)(?=\\n\\s*case "|\\n\\s*default:)`));
    return m ? m[1] : null;
  };
  const risky = ["FindWindow", "SetWindowLong", "hwnd", "getNativeWindowHandle", "GetDC", "BitBlt",
    "CopyFromScreen", "PrintWindow", "capture", "d3d", "opengl", "vulkan", "hook", "inject"];
  const pin = block("pin");
  check(pin !== null, "a 'pin' (stay on top) action exists");
  if (pin !== null) {
    check(/\.setAlwaysOnTop\(/.test(pin), "pin only ever sets the window's own always-on-top flag");
    const found = risky.filter((w) => pin.toLowerCase().includes(w.toLowerCase()));
    check(!found.length, "pin touches nothing resembling a render-hook overlay", `found: ${found}`);
  }
  const see = block("seethrough");
  check(see !== null, "a 'see-through' action exists");
  if (see !== null) {
    check(/\.setOpacity\(/.test(see), "see-through only ever sets the window's own opacity");
    const found = risky.filter((w) => see.toLowerCase().includes(w.toLowerCase()));
    check(!found.length, "see-through captures nothing and hooks nothing", `found: ${found}`);
  }
  // click-through: mouse events on our own window only, nothing else
  const through = block("clickthrough");
  if (through !== null) {
    check(/\.setIgnoreMouseEvents\(/.test(through), "click-through only ever sets the window's own mouse-event flag");
    const found = risky.filter((w) => through.toLowerCase().includes(w.toLowerCase()));
    check(!found.length, "click-through captures nothing and hooks nothing", `found: ${found}`);
  }
  // What the page sends reaches these three blocks only as a theme name, a
  // material name, an on/off flag or (chrome, material) a header height that
  // chrome.ts clamps. Any other use of the request - a cast, a spread, a
  // field lookup - could carry a colour or a value from the page to Windows.
  const onlyNamedFields = (src, allowed) => {
    const uses = [...src.matchAll(/\bsent\b(\s*\.\s*(\w+))?/g)]
      .filter((m) => !m[2] || !allowed.includes(m[2])).map((m) => m[0]);
    return uses;
  };
  // every argument handed to setTitleBarOverlay, parentheses balanced
  const overlayArgs = (src) => {
    const out = [];
    for (const m of src.matchAll(/setTitleBarOverlay\(/g)) {
      let depth = 1, i = m.index + m[0].length;
      const from = i;
      while (i < src.length && depth) {
        if (src[i] === "(") depth++;
        else if (src[i] === ")") depth--;
        i++;
      }
      out.push(src.slice(from, i - 1).replace(/\s+/g, " ").trim());
    }
    return out;
  };
  const PAGE_OVERLAY = "overlayFor(sent.theme, sent.height)";
  const HIDDEN_OVERLAY = '{ color: "#00000000", symbolColor: "#00000000", height: 1 }';
  // the frame's buttons: one call, colours from the fixed table only
  const chrome = block("chrome");
  if (chrome !== null) {
    const calls = [...chrome.matchAll(/\.(\w+)\(/g)].map((m) => m[1]);
    check(calls.every((c) => ["setTitleBarOverlay"].includes(c)),
      "chrome only sets the frame's buttons", `calls: ${calls}`);
    const args = overlayArgs(chrome);
    check(args.length === 1 && args[0] === PAGE_OVERLAY,
      "chrome takes its colours from chrome.ts, never from the page", `setTitleBarOverlay(${args.join(") | (")})`);
    const stray = onlyNamedFields(chrome, ["theme", "height"]);
    check(!stray.length, "chrome reads only the theme name and header height from the request", `found: ${stray}`);
  }
  // compact's Acrylic and full view's Mica: the material of our own window,
  // set only through materialSetzen() with a yes/no and a theme name
  const material = block("material");
  if (material !== null) {
    const calls = [...material.matchAll(/\.(\w+)\(/g)].map((m) => m[1]);
    check(calls.every((c) => ["setTitleBarOverlay"].includes(c)),
      "material only sets the frame's buttons itself; the material goes through materialSetzen()", `calls: ${calls}`);
    check(/\n\s*const compact = sent\.kind === "acrylic";\n/.test(material) && /\n\s*materialSetzen\(win, compact, sent\.theme\);\n/.test(material),
      "material takes compact as a comparison with one literal and the material from materialSetzen(), never a value from the page");
    // the buttons are either hidden (a literal) or the theme's from chrome.ts
    const args = overlayArgs(material);
    check(args.length >= 1 && args.every((a) => a === PAGE_OVERLAY || a === HIDDEN_OVERLAY),
      "material sets the frame's buttons only to hidden or to chrome.ts's colours", `setTitleBarOverlay(${args.join(") | (")})`);
    const stray = onlyNamedFields(material, ["theme", "kind", "height"]);
    check(!stray.length, "material reads only names and the header height from the request", `found: ${stray}`);
    const found = risky.filter((w) => material.toLowerCase().includes(w.toLowerCase()));
    check(!found.length, "material captures nothing and hooks nothing", `found: ${found}`);
  }
  // header height from the page: a number chrome.ts clamps, never passed on raw
  const chromeTs = code["chrome.ts"];
  if (chromeTs !== undefined) {
    const body = (chromeTs.match(/function headerHeight\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || ["", ""])[1];
    const returns = [...body.matchAll(/return\s+([^;]*);/g)].map((m) => m[1].trim());
    const bound = (name) => Number((chromeTs.match(new RegExp(`const ${name}\\s*=\\s*(\\d+)\\s*;`)) || [])[1]);
    check(/height:\s*headerHeight\(height\)/.test(chromeTs)
        && returns.length === 2
        && returns.includes("CHROME_HEIGHT")
        && returns.includes("Math.min(MAX_HEADER, Math.max(MIN_HEADER, n))")
        && bound("MIN_HEADER") >= 1 && bound("MAX_HEADER") <= 200 && bound("MIN_HEADER") < bound("MAX_HEADER"),
      "the header height from the page is clamped in chrome.ts", `returns: ${returns.join(" | ")}`);
  }

  // The header height the page last sent is kept (state.header) so a reload
  // resets the buttons at that height. It is stored as sent and reaches
  // Windows only through overlayFor(), which clamps it - never on its own.
  const headerUses = [...win.matchAll(/[^\n;]*\bstate\.header\b[^\n;]*/g)].map((m) => m[0].trim());
  const headerOk = (u) => u === "state.header = sent.height"
    || u === "state.header = undefined"
    || /^win\.setTitleBarOverlay\(overlayFor\([\w.()]+, state\.header\)\)$/.test(u);
  check(headerUses.length > 0 && headerUses.every(headerOk),
    "the remembered header height is only stored from the request and passed through overlayFor()",
    `found: ${headerUses.filter((u) => !headerOk(u)).join(" | ")}`);

  // the jump list (spec Windows-Einbindung 5): one file, this exe, fixed arguments
  const jumpers = Object.keys(code).filter((f) => f !== "jumplist.ts" && /\bsetJumpList\b/.test(code[f]));
  check(!jumpers.length && /\bapp\.setJumpList\(/.test(code["jumplist.ts"] ?? ""), "setJumpList only in jumplist.ts", `found in: ${jumpers}`);
  const JUMP_IFACE = "export interface JumpEintrag { title: string; args: string; description: string }";
  const wc = code["windows-core.ts"] ?? "";
  const jumpArgs = [...wc.replace(JUMP_IFACE, "").matchAll(/\bargs: ([^,}]+)/g)].map((m) => m[1].trim());
  check(wc.includes(JUMP_IFACE) && JSON.stringify(jumpArgs) === JSON.stringify(['"--kompakt"', '"--live"', '"--logordner"', "logArg(n)"])
      && /^  return "\\"--log=" \+ name \+ "\\"";$/m.test(wc),
    "jump-list arguments come only from the fixed list", `found: ${jumpArgs.join(" | ")}`);
  const jl = code["jumplist.ts"] ?? "";
  check([...jl.matchAll(/\bprogram:/g)].length === 1 && /\bprogram: process\.execPath,/.test(jl)
      && [...jl.matchAll(/\bargs:/g)].length === 1 && /\bargs: i\.args,/.test(jl)
      && [...jl.matchAll(/\biconPath:/g)].length === 1 && /\biconPath: process\.execPath,/.test(jl),
    "a jump-list entry starts only this exe", "");

  // the taskbar: one file, our own window, two buttons
  const taskbarUsers = Object.entries(code)
    .filter(([f, src]) => f !== "taskbar.ts" && /setOverlayIcon|setThumbarButtons|setProgressBar/.test(src)).map(([f]) => f);
  check(!taskbarUsers.length, "only taskbar.ts touches the taskbar", `found in: ${taskbarUsers}`);
  const tb = code["taskbar.ts"];
  if (tb !== undefined) {
    // a button is whatever reacts to a click - counted by click:, since a
    // button needs no tooltip to exist
    const buttons = (tb.match(/setThumbarButtons\(\[([\s\S]*?)\]\)/) || ["", ""])[1].match(/\bclick\s*:/g) || [];
    check(buttons.length === 2, "the preview carries exactly two buttons", `found: ${buttons.length}`);
    check(!/exec|spawn|shell\./.test(tb), "a taskbar button runs nothing, it only raises an event");
    // the progress bar (spec Windows-Einbindung 6): one value from fortschritt(), or -1 from the timer
    const bars = [...tb.matchAll(/\.setProgressBar\(([^)]*)\)/g)].map((m) => m[1].trim());
    check(bars.length === 2 && bars[0] === "wert" && bars[1] === "-1" && /const wert = fortschritt\(to, size, balken\.an\);/.test(tb),
      "the progress bar is set only to fortschritt()'s value", `found: ${bars.join(" | ")}`);
  }
  const live = block("live");
  if (live !== null) {
    const calls = [...live.matchAll(/\b(\w+)\(/g)].map((m) => m[1]);
    check(/setLiveBadge\(win,/.test(live) && calls.every((c) => c === "setLiveBadge"),
      "live only sets the taskbar dot through taskbar.ts", `calls: ${calls}`);
    const stray = onlyNamedFields(live, ["on"]);
    check(!stray.length, "live reads only the on/off flag from the request", `found: ${stray}`);
  }

  // Full view's size: the content size of our own window and nothing else.
  // Two whole numbers from the request, each through int(); the size before
  // compact (state.prev) is not this action's to touch.
  const size = block("size");
  check(size !== null, "a 'size' (full view follows the size setting) action exists");
  if (size !== null) {
    const calls = [...size.matchAll(/\b(\w+)\s*\(/g)].map((m) => m[1]).filter((c) => c !== "if");
    check(calls.every((c) => ["int", "isMaximized", "sizeBySelf"].includes(c))
        && calls.filter((c) => c === "sizeBySelf").length === 1,
      "size only sets our own window's content size (sizeBySelf)", `calls: ${calls}`);
    check(/if \(win\.isMaximized\(\)\) break;/.test(size),
      "size leaves a maximised window as it is");
    const raw = [...size.matchAll(/\bsent\b[^;]*/g)].map((m) => m[0].trim())
      .filter((u) => !/^sent\.(w|h)\)$/.test(u));
    const viaInt = [...size.matchAll(/\bsent\b/g)].length
      === [...size.matchAll(/\bint\(sent\.(w|h)\)/g)].length;
    check(!raw.length && viaInt, "size reads only w and h from the request, as whole numbers through int()",
      `found: ${raw.join(" | ") || "a use of sent outside int()"}`);
    check(!/state\.prev/.test(size), "size leaves the size before compact alone");
    const found = risky.filter((w) => size.toLowerCase().includes(w.toLowerCase()));
    check(!found.length, "size captures nothing and hooks nothing", `found: ${found}`);
  }
  // sizeBySelf: the flag that tells will-resize this is no hand, and one
  // setContentSize - nothing a caller could widen into something else
  const bySelf = (win.match(/function sizeBySelf\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || [null, null])[1];
  check(bySelf !== null && [...bySelf.matchAll(/\.(\w+)\(/g)].map((m) => m[1]).join() === "setContentSize"
      && /win\.setContentSize\(w, h\)/.test(bySelf),
    "sizeBySelf only sets the window's own content size");

  // --- 7b. Fenster-Extras (Spezifikation 27.09.2026, 3.1-3.4 und 6). Was
  //         die Seite schickt, erreicht Windows hier nur als Name eines
  //         Themas; Farbe, Material und Lage kommen aus festen Tabellen oder
  //         aus dem reinen Kern lage.ts.
  // every argument of every call to fn, parentheses balanced
  const argsOf = (src, fn) => {
    const out = [];
    for (const m of src.matchAll(new RegExp(`\\b${fn}\\(`, "g"))) {
      let depth = 1, i = m.index + m[0].length;
      const from = i;
      while (i < src.length && depth) {
        if (src[i] === "(") depth++;
        else if (src[i] === ")") depth--;
        i++;
      }
      out.push(src.slice(from, i - 1).replace(/\s+/g, " ").trim());
    }
    return out;
  };
  const fnBody = (src, head) => (src.match(new RegExp(head + "[^{]*\\{([\\s\\S]*?)\\n\\}")) || [null, null])[1];
  const chromeSrc = code["chrome.ts"] ?? "";
  // 3.1: der Rand bekommt nur borderFor() aus der festen Tabelle
  const accent = Object.entries(code).flatMap(([f, src]) => argsOf(src, "setAccentColor").map((a) => `${f}: ${a}`));
  check(accent.length === 1 && accent[0] === "window.ts: borderFor(theme)",
    "the window border takes its colour from chrome.ts's fixed table, never from the page",
    `setAccentColor(${accent.join(") | (")})`);
  const borderTable = chromeSrc.match(/const BORDER: Record<string, string> = \{([^}]*)\};/);
  const borderRows = borderTable ? borderTable[1].split(",").map((r) => r.trim()).filter(Boolean) : [];
  check(borderRows.length === 4
      && borderRows.every((r, i) => new RegExp(`^${["dark", "light", "tnl", "glas"][i]}: "#[0-9a-f]{6}"$`).test(r))
      && [...chromeSrc.matchAll(/\bBORDER\b/g)].length === 3,
    "border colours are fixed and opaque: one #rrggbb each for dark, light, tnl and glas, read only by borderFor()",
    `found: ${borderRows.join(" | ") || "no BORDER table"}`);
  const borderBody = fnBody(chromeSrc, "export function borderFor\\(theme: unknown\\): string");
  check(borderBody === '\n  const key = typeof theme === "string" && Object.hasOwn(BORDER, theme) ? theme : "dark";\n  return BORDER[key]!;',
    "borderFor() looks the theme up among the table's own keys and falls back to dark");
  // 3.2: themeSource nur aus themeSourceFor(), und das kennt drei Woerter
  const themeSources = Object.entries(bare).flatMap(([f, src]) =>
    [...src.matchAll(/[^\n;{}]*\bthemeSource\b[^\n;]*/g)].map((m) => `${f}: ${m[0].trim()}`));
  check(themeSources.length === 1 && themeSources[0] === "window.ts: nativeTheme.themeSource = themeSourceFor(theme, loadConfig().theme)",
    "themeSource is set only from themeSourceFor() in chrome.ts", `found: ${themeSources.join(" | ")}`);
  const sourceBody = fnBody(chromeSrc, 'export function themeSourceFor\\(resolved: unknown, setting: unknown\\): "system" \\| "light" \\| "dark"');
  check(sourceBody === '\n  if (setting === "auto") return "system";\n  return resolved === "light" ? "light" : "dark";',
    "themeSourceFor() returns only \"system\", \"light\" or \"dark\"");
  const inTheme = fnBody(win, "function borderInTheme\\(win: BrowserWindow, theme: unknown\\): void");
  check(inTheme === '\n  if (process.platform === "win32") win.setAccentColor(borderFor(theme));\n  nativeTheme.themeSource = themeSourceFor(theme, loadConfig().theme);',
    "borderInTheme() sets the border and themeSource and nothing else");
  // 3.3 / Rauchglas 3.4: das Material an genau einer Stelle, nur aus materialFor()
  const materials = Object.entries(code).flatMap(([f, src]) => argsOf(src, "setBackgroundMaterial").map((a) => `${f}: ${a}`));
  const SETZEN = "\nfunction materialSetzen(win: BrowserWindow, compact: boolean, theme: unknown): void {\n  if (acrylicSupported()) win.setBackgroundMaterial(materialFor(compact, nativeTheme.prefersReducedTransparency, theme));\n}";
  check(materials.length === 1 && materials[0] === "window.ts: materialFor(compact, nativeTheme.prefersReducedTransparency, theme)"
      && win.split(SETZEN).length === 2,
    "setBackgroundMaterial is called once, in materialSetzen() in window.ts, with materialFor() from chrome.ts",
    `setBackgroundMaterial(${materials.join(") | (")})`);
  const setzen = argsOf(win, "materialSetzen")
    .filter((a) => a !== "win: BrowserWindow, compact: boolean, theme: unknown");
  check(setzen.length > 0 && setzen.every((a) => /^(win|kw), (true|false|compact|state\.compact), (sent\.theme|cfg\.themeResolved|loadConfig\(\)\.themeResolved)$/.test(a)),
    "materialSetzen() gets a window, a yes/no for compact and a theme name - nothing else from a request",
    `materialSetzen(${setzen.join(") | (")})`);
  // #189: full view's glass ground is Acrylic, Mica is gone - materialFor()
  // knows two materials, and only compact or the theme glas gets Acrylic
  const materialBody = fnBody(chromeSrc, 'export function materialFor\\(compact: boolean, reducedTransparency: boolean, theme: unknown\\): "acrylic" \\| "none"');
  check(materialBody === '\n  if (reducedTransparency) return "none";\n  if (compact) return "acrylic";\n  return theme === "glas" ? "acrylic" : "none";',
    "materialFor() returns only \"acrylic\" or \"none\", and full view's Acrylic only for the theme glas");
  const micaWords = Object.entries(code).flatMap(([f, src]) => [...src.matchAll(/["'`]mica["'`]/g)].map(() => f));
  check(micaWords.length === 0,
    "the material mica is named nowhere in the main process (#189)", `found in: ${micaWords.join(", ")}`);
  const micaNowBody = fnBody(win, "export function micaNow\\(\\): boolean");
  check(micaNowBody === '\n  return acrylicSupported() && !state.compact\n    && materialFor(false, nativeTheme.prefersReducedTransparency, loadConfig().themeResolved) === "acrylic";',
    "micaNow() asks materialFor() and nothing else");
  const grundBody = fnBody(win, 'export function micaGrund\\(\\): "system" \\| "aus" \\| null');
  check(grundBody === '\n  if (!acrylicSupported()) return "system";\n  return nativeTheme.prefersReducedTransparency ? "aus" : null;',
    "micaGrund() returns only \"system\", \"aus\" or null");
  const stateSrv = code["server.ts"] ?? "";
  check(/\n\s*mica: currentWindow\(\) !== null && micaNow\(\),\n\s*micaGrund: currentWindow\(\) !== null \? micaGrund\(\) : null,\n/.test(stateSrv)
      && [...stateSrv.matchAll(/\bmica(Grund)?:/g)].length === 2,
    "GET /api/state reports mica only as micaNow() and its reason only as micaGrund(), for the app's own window");
  const themeUses = Object.entries(bare).flatMap(([f, src]) =>
    [...src.matchAll(/\bnativeTheme\b(\s*\.\s*(\w+))?/g)].map((m) => ({ f, member: m[2] ?? "" })));
  const themeOk = themeUses.every(({ f, member }) => f === "window.ts" && ["", "prefersReducedTransparency", "on", "themeSource"].includes(member))
    && themeUses.filter(({ member }) => member === "").length === 1
    && /^import \{[^}]*\bnativeTheme\b[^}]*\} from "electron";$/m.test(win)
    && themeUses.filter(({ member }) => member === "on").length === [...win.matchAll(/nativeTheme\.on\("updated", transparencyChanged\);/g)].length;
  check(themeOk,
    "nativeTheme is used only in window.ts: to read reduced transparency, to hear it change, and to set themeSource",
    `found: ${themeUses.map(({ f, member }) => `${f}: nativeTheme${member ? "." + member : ""}`).join(" | ")}`);
  // 3.4: die Fensterlage. lage.ts ist ein reiner Kern; "fenster" schreibt
  // nur window.ts, und nur, was fensterNeu() durchgelassen hat
  check(code["lage.ts"] !== undefined && !/\bimport\b|\brequire\b|\bprocess\b|\bfetch\b|\bglobal(This)?\b/.test(bare["lage.ts"] ?? ""),
    "lage.ts is a pure core: it imports nothing and reaches nothing (no require, process, fetch, global)");
  const FENSTER_WRITE = "const fenster = fensterNeu(loadConfig().fenster, teil, neu);\n  if (fenster) updateConfig({ fenster });";
  const fensterWords = Object.entries(bare).filter(([f]) => f !== "lage.ts")
    .flatMap(([f, src]) => [...src.matchAll(/\bfenster\b/g)]
      .filter((m) => src.slice(Math.max(0, m.index - 13), m.index) !== "loadConfig().").map(() => f));
  const fensterQuoted = Object.entries(code).filter(([f, src]) => f !== "lage.ts" && /["'`]fenster["'`]/.test(src)).map(([f]) => f);
  check(win.split(FENSTER_WRITE).length === 2 && fensterWords.length === 3 && fensterWords.every((f) => f === "window.ts")
      && !fensterQuoted.length,
    "the window place (fenster) is written only by window.ts, only what fensterNeu() in lage.ts let through",
    `written in: ${fensterWords.join(", ")}; as a string in: ${fensterQuoted.join(", ")}`);
  const configKeys = ((code["server.ts"] ?? "").match(/const CONFIG_KEYS = \[([^\]]*)\];/) || [null, ""])[1]
    .split(",").map((k) => k.trim()).filter(Boolean);
  const configPost = ((postBody ?? "").match(/case "\/api\/config": \{([\s\S]*?)\n    \}/) || [null, ""])[1];
  check(configKeys.length > 0 && configKeys.every((k) => /^"[A-Za-z_]+"$/.test(k)) && !configKeys.includes('"fenster"')
      && /for \(const key of CONFIG_KEYS\)/.test(configPost) && [...configPost.matchAll(/\bchanges\[/g)].length === 1
      && [...configPost.matchAll(/\bupdateConfig\(/g)].length === 1 && configPost.includes("updateConfig(changes);"),
    "POST /api/config writes only the listed keys, and fenster is not one of them", `keys: ${configKeys.join(" ")}`);
  // 3.5: randlosGesehen und rundgangGesehen sind Schluessel der Seite, aber nur
  // als true oder false; ebenso updatePruefen, der Schalter des Update-Hinweises
  // (Abschnitt 14.11). Seit dem Rundgang (Spezifikation 02.10.2026, 7)
  // genauer: jeder Schluessel der Liste, der auf "Gesehen" endet, steht in
  // BOOLEAN_KEYS - ein neuer Hinweis kann nicht still beliebige Werte tragen.
  check(configPost.includes('for (const key of CONFIG_KEYS) {\n        if (key in sent && (!BOOLEAN_KEYS.includes(key) || typeof sent[key] === "boolean")) changes[key] = sent[key];\n      }')
      && /^const BOOLEAN_KEYS = \["randlosGesehen", "rundgangGesehen", "updatePruefen", "meldenKampf", "meldenNurBest", "trayBeimSchliessen", "gildeErinnerung"\];$/m.test(code["server.ts"] ?? ""),
    "POST /api/config takes a true/false key (randlosGesehen, rundgangGesehen, updatePruefen, meldenKampf, meldenNurBest, trayBeimSchliessen, gildeErinnerung) only as true or false");
  const booleanKeys = ((code["server.ts"] ?? "").match(/^const BOOLEAN_KEYS = \[([^\]]*)\];$/m) || [null, ""])[1]
    .split(",").map((k) => k.trim()).filter(Boolean);
  // Pruefung Rundgang G3: auch "Seen" und in jeder Schreibweise (gesehen, SEEN)
  const seenLoose = configKeys.filter((k) => /(gesehen|seen)"$/i.test(k) && !booleanKeys.includes(k));
  check(configKeys.includes('"rundgangGesehen"') && !seenLoose.length,
    "every settings key ending in Gesehen (or Seen) is a true/false key (BOOLEAN_KEYS)", `not in BOOLEAN_KEYS: ${seenLoose.join(" ")}`);
  // der erste Start (Spezifikation Rundgang 2, Pruefung M6): firststart.ts ist
  // ein reiner Kern, server.ts liest die Einstellungen dafuer einmal
  check(code["firststart.ts"] !== undefined
      && !/\bimport\b|\brequire\b|\bprocess\b|\bfetch\b|\bglobal(This)?\b|\bfs\b/.test(bare["firststart.ts"] ?? "")
      && /^import \{ isFirstStart \} from "\.\/firststart";$/m.test(code["server.ts"] ?? "")
      && [...(bare["server.ts"] ?? "").matchAll(/\bisFirstStart\b/g)].length === 2,
    "firststart.ts is a pure core, called once from server.ts");

  // --- 7c. Fensterwege (Befund aus den Nachtraegen). Die Regeln oben pruefen
  //         die Faelle von winAction; ausserhalb davon blieb offen: ein Skript,
  //         das die Seite wegnavigiert (executeJavaScript), ein Hoerer auf
  //         neue Fenster (did-create-window und seine Verwandten am app),
  //         setOpacity und setAlwaysOnTop an anderer Stelle - oder ein "pin",
  //         der selbst nichts setzt, waehrend es ein anderer tut. Also: diese
  //         Woerter nirgends im Hauptprozess, webContents und app nur mit
  //         gelisteten Gliedern und Ereignissen, Deckkraft und Obenbleiben je
  //         genau einmal, in ihrem Fall, der Wort fuer Wort feststeht; das
  //         Kompakt-Fenster ist von sich aus oben (alwaysOnTop: true in seinen
  //         Optionen, sonst nirgends). Was geladen wird, haelt 8b fest.
  const scriptWays = files.flatMap((f) => [...code[f].matchAll(/executeJavaScript\w*|did-create-window|web-contents-created|browser-window-created/g)]
    .map((m) => `${f}: ${m[0]}`));
  check(!scriptWays.length,
    "main runs no script in the page and hears of no new window (executeJavaScript, did-create-window, web-contents-created, browser-window-created)",
    `found: ${scriptWays.join(" | ")}`);
  const WC_MEMBERS = new Set(["on", "once", "setWindowOpenHandler", "setZoomLevel"]);
  const WC_EVENTS = new Set(["did-finish-load", "did-fail-load", "will-navigate", "zoom-changed"]);
  const wcStray = [];
  for (const f of files) {
    for (const m of bare[f].matchAll(/\bwebContents\b/g)) {
      const member = (bare[f].slice(m.index).match(/^webContents\.(\w+)\(/) || [null, ""])[1];
      const event = (code[f].slice(m.index).match(/^webContents\.(?:on|once)\("([^"\n]*)",/) || [null, null])[1];
      if (f !== "window.ts" || !/(?:^|[^\w$.])(?:win|kw)\.$/.test(bare[f].slice(Math.max(0, m.index - 5), m.index)) || !WC_MEMBERS.has(member)
          || ((member === "on" || member === "once") && !WC_EVENTS.has(event))) {
        wcStray.push(`${f}: ${norm(code[f].slice(Math.max(0, m.index - 4), m.index + 40))}`);
      }
    }
    for (const s of [...(toks[f].strings ?? []), ...(toks[f].texts ?? [])]) if (/webContents/i.test(s)) wcStray.push(`${f}: "${s}"`);
  }
  check(!wcStray.length,
    "webContents is used only as win.webContents or kw.webContents in window.ts, with the listed members and the listed events",
    `found: ${wcStray.join(" | ")}`);
  const APP_EVENTS = new Set(["will-quit", "activate", "window-all-closed", "second-instance", "before-quit"]);
  const appStray = [];
  const quitListeners = [];
  for (const f of files) {
    for (const m of bare[f].matchAll(/\bapp\s*\.\s*(on|once|addListener|prependListener|prependOnceListener)\s*\(/g)) {
      const event = (code[f].slice(m.index).match(/^app\.(?:on|once)\("([^"\n]*)",/) || [null, null])[1];
      if (!APP_EVENTS.has(event)) appStray.push(`${f}: ${norm(code[f].slice(m.index, m.index + 48))}`);
      // before-quit: exactly one listener, the one line in main.ts that lets the window close for good
      if (event === "before-quit") quitListeners.push(f === "main.ts" && code[f].slice(m.index).startsWith('app.on("before-quit", beendenErlauben);') ? "ok" : `${f}: ${norm(code[f].slice(m.index, m.index + 60))}`);
    }
  }
  if (quitListeners.length !== 1 || quitListeners[0] !== "ok") appStray.push(`before-quit listeners: ${quitListeners.join(" | ") || "none"}`);
  check(!appStray.length, "app listens only to its listed events (will-quit, activate, window-all-closed, second-instance, before-quit)",
    `found: ${appStray.join(" | ")}`);
  const PIN = "const want = !!sent.on; win.setAlwaysOnTop(want); updateConfig({ stayOnTop: want && sent.remember !== false && win === state.win }); "
    + "return ok({ on_top: want }); }";
  const SEE = "let alpha = Number(sent.alpha); if (!isFinite(alpha)) alpha = 1; alpha = Math.max(0.35, Math.min(1, alpha)); if "
    + "(process.platform !== \"win32\" && process.platform !== \"darwin\") { return fail(\"this window cannot fade\"); } "
    + "win.setOpacity(alpha); updateConfig({ compactAlpha: alpha }); return ok({ alpha }); }";
  // the tray may only read it (isAlwaysOnTop() for its tick), once
  const onTop = files.flatMap((f) => [...(f === "tray.ts" ? code[f].replace(/\?\.isAlwaysOnTop\(\)/, "") : code[f]).matchAll(/alwaysOnTop/gi)].map(() => f));
  check(win.split('case "pin":').length === 2 && norm(pin ?? "").replace(/^\{ /, "") === PIN
      && onTop.join() === "window.ts,window.ts" && win.split("win.setAlwaysOnTop(want);").length === 2
      && /\n  const kw = new BrowserWindow\(\{\n(?:    [^\n]*\n)*?    alwaysOnTop: true,\n/.test(win),
    "the window's always-on-top is set only in pin: one call, win.setAlwaysOnTop(want), in the one pin case as written (and the compact window's own option)",
    `pin: ${norm(pin ?? "")}; alwaysOnTop in: ${onTop.join(", ")}`);
  const opacity = files.flatMap((f) => [...code[f].matchAll(/opacity/gi)].map(() => f));
  check(win.split('case "seethrough":').length === 2 && norm(see ?? "").replace(/^\{ /, "") === SEE
      && opacity.join() === "window.ts" && win.split("win.setOpacity(alpha);").length === 2,
    "the window's opacity is set only in see-through: one call, win.setOpacity(alpha), in the one see-through case as written",
    `seethrough: ${norm(see ?? "")}; opacity in: ${opacity.join(", ")}`);

  // --- 8c. Kompakt-Fenster (04.10.2026): der Durchklick Wort fuer Wort wie
  //         Pin und Durchsicht. setIgnoreMouseEvents steht dreimal, alle in
  //         window.ts: im Fall clickthrough, und je einmal mit false, wenn
  //         ein Fenster neu laedt (es nimmt die Maus dann wieder an).
  const THROUGH = "const want = !!sent.on; win.setIgnoreMouseEvents(want, want ? { forward: true } : undefined); "
    + "if (win === state.win) state.through = want; else kompakt.through = want; return ok({ clickthrough: want }); }";
  const throughBlock = block("clickthrough");
  const ignores = files.flatMap((f) => [...code[f].matchAll(/setIgnoreMouseEvents/g)].map(() => f));
  check(throughBlock !== null && norm(throughBlock).replace(/^\{ /, "") === THROUGH
      && ignores.join() === "window.ts,window.ts,window.ts"
      && win.split("\n      win.setIgnoreMouseEvents(false);\n").length === 2
      && win.split("\n      kw.setIgnoreMouseEvents(false);\n").length === 2,
    "click-through is set only in its case, as written; elsewhere only reset to false on reload",
    `clickthrough: ${norm(throughBlock ?? "")}; setIgnoreMouseEvents in: ${ignores.join(", ")}`);

  // no handle to any window but our own is ever taken
  check(!/getNativeWindowHandle|FindWindow/.test(all), "no native window handles are taken");

  // --- 8. the page gets no Node and no bridge into this process
  check(/nodeIntegration:\s*false/.test(win) && /contextIsolation:\s*true/.test(win) && /sandbox:\s*true/.test(win),
    "the page runs sandboxed, without Node");
  check(!/preload\s*:/.test(win), "no preload script bridges the page into the main process");

  // --- 8b. Kompakt als eigenes Fenster (spec Nachtraege N4). Two windows at
  //         most, both made in window.ts, both on the one frozen SEITE
  //         object; both load only this app's own page from 127.0.0.1; both
  //         carry the handler that opens no further window; /api/win names a
  //         window only as "main" or "kompakt"; pin, see-through and
  //         click-through stay one handler each, for whichever window is named.
  const mainTs = code["main.ts"] ?? "";
  const winBare = bare["window.ts"] ?? "";
  const newWindows = files.flatMap((f) => [...bare[f].matchAll(/\bnew\s+BrowserWindow\b/g)].map(() => f));
  const otherHosts = files.filter((f) => /\b(BrowserView|WebContentsView|webviewTag)\b|\bwebContents\s*\.\s*create\b|<webview/.test(bare[f] + code[f]));
  check(newWindows.length === 2 && newWindows.every((f) => f === "window.ts") && !otherHosts.length
      && /\n  const win = new BrowserWindow\(\{\n/.test(win) && /\n  const kw = new BrowserWindow\(\{\n/.test(win),
    "at most two windows, both in window.ts (full view and the compact window), and no other page host",
    `new BrowserWindow in: ${newWindows.join(", ")}; other hosts in: ${otherHosts.join(", ")}`);
  // each window's options, braces balanced, from its "new BrowserWindow({"
  const optionsOf = (src, head) => {
    const at = src.indexOf(head);
    if (at < 0) return null;
    let depth = 0, i = at + head.length - 1;
    const from = i;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) break;
    }
    return src.slice(from, i + 1);
  };
  const SEITE_DEF = "const SEITE = Object.freeze({ nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false, backgroundThrottling: false });";
  const winOpts = [optionsOf(win, "const win = new BrowserWindow({"), optionsOf(win, "const kw = new BrowserWindow({")];
  const prefsIn = files.flatMap((f) => [...bare[f].matchAll(/\bwebPreferences\b/g)].map(() => f));
  check(win.split(SEITE_DEF).length === 2 && [...winBare.matchAll(/\bSEITE\b/g)].length === 3
      && winOpts.every((o) => o !== null && [...o.matchAll(/\bwebPreferences\b/g)].length === 1 && /\n    webPreferences: SEITE,\n/.test(o))
      && prefsIn.length === 2 && prefsIn.every((f) => f === "window.ts"),
    "both windows take the same fixed web preferences (SEITE: sandbox, contextIsolation, no nodeIntegration, no preload)",
    `webPreferences in: ${prefsIn.join(", ")}; SEITE named ${[...winBare.matchAll(/\bSEITE\b/g)].length}x`);
  // the page: main.ts builds its url from the server's port on 127.0.0.1,
  // createWindow keeps that origin, and the compact window loads the same
  // page with ?kompakt=1. Nothing else is loaded, anywhere.
  const loads = files.flatMap((f) => [...code[f].matchAll(/\.\s*(loadURL|loadFile)\s*\(([^)]*)\)/g)].map((m) => `${f}: ${m[1]}(${m[2].trim()})`));
  const createCalls = [...mainTs.matchAll(/\bcreateWindow\(([^)]*)\)/g)].map((m) => m[1]);
  const originSets = [...winBare.matchAll(/\bseite\s*\.\s*origin\s*(=(?![=>])|\+=)/g)].length;
  check(JSON.stringify(loads) === JSON.stringify(["window.ts: loadURL(url)", "window.ts: loadURL(`${seite.origin}/?win=1&kompakt=1`)"])
      && /\n  const port = await startServer\(pagePath\(\)\);\n  const url = `http:\/\/127\.0\.0\.1:\$\{port\}\/`;\n/.test(mainTs)
      && /\n  const winUrl = `\$\{url\}\?win=1`;\n/.test(mainTs)
      && JSON.stringify(createCalls) === JSON.stringify(["winUrl, icon, startArt", "winUrl, icon"])
      && mainTs.includes('\n  const startArt = ERSTER_START.autostart ? (loadConfig().trayBeimSchliessen === true ? "verborgen" : "minimiert") : "normal";\n')
      && /\nexport function createWindow\(url: string, iconPath: string, start: "normal" \| "minimiert" \| "verborgen" = "normal"\): BrowserWindow \{\n/.test(win)
      && originSets === 1 && /\n  const origin = new URL\(url\)\.origin;\n  seite\.origin = origin;\n/.test(win)
      && !files.some((f) => f !== "window.ts" && /\bseite\b/.test(bare[f])),
    "both windows load only the app's own page from 127.0.0.1 (full view ?win=1, the compact window ?win=1&kompakt=1)",
    `loads: ${loads.join(" | ")}; createWindow(${createCalls.join(") | (")}); seite.origin set ${originSets}x`);
  const eigene = fnBody(win, "function nurEigeneSeite\\(win: BrowserWindow, origin: string\\): void");
  const handlers = files.flatMap((f) => [...bare[f].matchAll(/\bsetWindowOpenHandler\b/g)].map(() => f));
  const createBody = fnBody(win, "export function createWindow\\(url: string, iconPath: string, start: \"normal\" \\| \"minimiert\" \\| \"verborgen\" = \"normal\"\\): BrowserWindow");
  const openBody = fnBody(win, "function openKompakt\\(start: \\{ live: boolean; durch: boolean \\}\\): boolean");
  check(eigene !== null && handlers.length === 1 && handlers[0] === "window.ts"
      && /\n  win\.webContents\.setWindowOpenHandler\(\(\{ url: target \}\) => \{\n    if \(external\(target\)\) void shell\.openExternal\(target\);\n    return \{ action: "deny" \};\n  \}\);/.test(eigene)
      && /win\.webContents\.on\("will-navigate", /.test(eigene)
      && [...winBare.matchAll(/\bnurEigeneSeite\(/g)].length === 3
      && createBody !== null && createBody.includes("\n  nurEigeneSeite(win, origin);\n")
      && openBody !== null && openBody.includes("\n  nurEigeneSeite(kw, seite.origin);\n"),
    "no window opens another: both have the open handler that denies (nurEigeneSeite)",
    `setWindowOpenHandler in: ${handlers.join(", ")}; nurEigeneSeite named ${[...winBare.matchAll(/\bnurEigeneSeite\(/g)].length}x`);
  // the field "win": read once, only the two names pass, and the compact
  // window gets only its own short list of actions
  const winField = [...winBare.matchAll(/\bsent\s*(\.\s*win\b|\[)/g)].length;
  const welchesUses = [...win.matchAll(/[^\n]*\bwelches\b[^\n]*/g)].map((m) => m[0].trim());
  check(winField === 1
      && JSON.stringify(welchesUses) === JSON.stringify([
        'const welches = sent.win ?? "main";',
        'if (welches !== "main" && welches !== "kompakt") return fail("unknown window");',
        'if (welches === "kompakt" && !KOMPAKT_AKTIONEN.includes(action)) return fail("not for the compact window");',
        'const win = welches === "kompakt" ? kompaktWindow() : currentWindow();'])
      && /\nconst KOMPAKT_AKTIONEN = \["kompakt", "close", "resize", "pin", "seethrough", "clickthrough"\];\n/.test(win)
      && [...winBare.matchAll(/\bKOMPAKT_AKTIONEN\b/g)].length === 2,
    "/api/win names a window only as \"main\" or \"kompakt\", and the compact window takes only its own actions",
    `sent.win/sent[...] ${winField}x; welches: ${welchesUses.join(" | ")}`);
  const caseCount = (name) => [...win.matchAll(new RegExp(`\\bcase\\s+"${name}"\\s*:`, "g"))].length;
  check(["pin", "seethrough", "clickthrough"].every((n) => caseCount(n) === 1)
      && /\n  const win = welches === "kompakt" \? kompaktWindow\(\) : currentWindow\(\);\n  if \(!win\) return fail\("no window"\);\n  try \{\n    switch \(action\) \{\n/.test(win)
      && [...winBare.matchAll(/\bswitch\s*\(/g)].length === 1,
    "pin, see-through and click-through are handled once, for the window named (the rules of 6/7 hold for both)",
    `cases: pin ${caseCount("pin")}, seethrough ${caseCount("seethrough")}, clickthrough ${caseCount("clickthrough")}`);
  const kompaktCase = block("kompakt");
  const kompaktCalls = kompaktCase === null ? [] : [...kompaktCase.matchAll(/\b(\w+)\s*\(/g)].map((m) => m[1]).filter((c) => c !== "if");
  check(kompaktCase !== null && !onlyNamedFields(kompaktCase, ["on", "live", "durch"]).length
      && kompaktCalls.every((c) => ["openKompakt", "fail", "schliesseKompakt", "ok", "kompaktWindow"].includes(c))
      && [...winBare.matchAll(/\bopenKompakt\(/g)].length === 2,
    "the compact action only opens or closes the compact window, from on, live and durch",
    `calls: ${kompaktCalls.join(", ")}; fields: ${kompaktCase === null ? "no case" : onlyNamedFields(kompaktCase, ["on", "live", "durch"]).join(", ")}`);
  // Pruefung N4, W1: the options of both windows are plain named keys from a
  // fixed list - no computed key, no quoted key, no spread but the one place
  // spread of each window, so no second webPreferences can follow SEITE
  const OPTION_KEYS = ["title", "width", "height", "minWidth", "minHeight", "titleBarStyle", "titleBarOverlay",
    "backgroundColor", "icon", "show", "webPreferences", "alwaysOnTop", "skipTaskbar", "minimizable", "maximizable", "fullscreenable"];
  const PLACE_SPREADS = ["...(platz ? { x: platz.x, y: platz.y } : {})", "...(p ? { x: p.x, y: p.y } : {})"];
  const topEntries = (o) => {
    const out = [];
    let depth = 0, from = 1;
    for (let i = 1; i < o.length - 1; i++) {
      const c = o[i];
      if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) depth--;
      else if (c === "," && depth === 0) { out.push(o.slice(from, i)); from = i + 1; }
    }
    out.push(o.slice(from, o.length - 1));
    return out.map((e) => e.replace(/\s+/g, " ").trim()).filter(Boolean);
  };
  const strayOptions = winOpts.flatMap((o, n) => o === null ? [`window ${n}: none`] : topEntries(o).filter((e) => {
    if (PLACE_SPREADS[n] === e) return false;
    const m = e.match(/^([A-Za-z_$][\w$]*)\s*:/);
    return !m || !OPTION_KEYS.includes(m[1]);
  }).map((e) => `window ${n}: ${e.slice(0, 60)}`));
  check(!strayOptions.length,
    "both windows' options are plain named keys from a fixed list (no computed, quoted or spread key beside SEITE)",
    `found: ${strayOptions.join(" | ")}`);
  // Pruefung N4, W2: winAction reads the request only as sent.<name> (no
  // destructuring, no index), and no window is looked up by number, content
  // or focus anywhere in the main process
  const actionBody = fnBody(winBare, "export function winAction\\(sent: Json\\): Answer");
  const sentOdd = actionBody === null ? ["no winAction"] : [...actionBody.matchAll(/\bsent\b(?!\s*\.\s*[A-Za-z_$])/g)].map((m) => actionBody.slice(m.index, m.index + 20));
  const lookups = files.flatMap((f) => [...bare[f].matchAll(/\b(fromId|fromWebContents|fromBrowserView|getAllWindows|getFocusedWindow|getAllWebContents)\b/g)].map((m) => `${f}: ${m[1]}`));
  check(!sentOdd.length && !lookups.length && [...winBare.matchAll(/\bsent\b/g)].length === [...(actionBody ?? "").matchAll(/\bsent\b/g)].length + 1,
    "the window is chosen only by the named field: winAction reads sent.<name> alone, and no window is looked up by id, content or focus",
    `sent: ${sentOdd.join(" | ")}; lookups: ${lookups.join(", ")}`);
  // Pruefung N4, M1: the page's origin - every line naming seite, as written
  const SEITE_LINES = ['const seite = { origin: "", icon: "" };', "seite.origin = origin;", "seite.icon = iconPath;",
    "if (!kompaktMoeglich() || !seite.origin) return false;", "icon: seite.icon,", "nurEigeneSeite(kw, seite.origin);",
    "void kw.loadURL(`${seite.origin}/?win=1&kompakt=1`);",
    "const gezeigt = meldeKampf(currentWindow(), seite.icon, sent.titel, sent.satz, sent.best);"];
  const seiteLines = [...win.matchAll(/[^\n]*\bseite\b[^\n]*/g)].map((m) => m[0].trim());
  check(JSON.stringify(seiteLines) === JSON.stringify(SEITE_LINES),
    "the page's origin (seite) is set once from createWindow's url and used only where written",
    `found: ${seiteLines.join(" | ")}`);
  // Pruefung N4, M2: one compact window at a time - kompakt.win is set only
  // to the new window and cleared only when that window is closed, and an
  // open one is only shown again
  const KOMPAKT_WIN_LINES = ["return kompakt.win && !kompakt.win.isDestroyed() ? kompakt.win : null;", "kompakt.win = kw;",
    "if (kompakt.win === kw) {", "kompakt.win = null;"];
  const kompaktWinLines = [...win.matchAll(/[^\n]*\bkompakt\s*\.\s*win\b[^\n]*/g)].map((m) => m[0].trim());
  const kompaktOdd = [...winBare.matchAll(/\bkompakt\b(?!\s*\.\s*(win|through|start)\b)/g)].map((m) => winBare.slice(m.index, m.index + 20));
  check(JSON.stringify(kompaktWinLines) === JSON.stringify(KOMPAKT_WIN_LINES) && kompaktOdd.length === 1
      && /\nconst kompakt = \{\n/.test(win)
      && /\n    if \(kompakt\.win === kw\) \{\n      kompakt\.win = null;\n/.test(win)
      && openBody !== null && openBody.startsWith("\n  if (!kompaktMoeglich() || !seite.origin) return false;\n  kompakt.start = start;\n"
        + "  const offen = kompaktWindow();\n  if (offen) {\n    offen.showInactive();\n    offen.moveTop();\n    return true;\n  }\n"),
    "one compact window at a time: an open one is shown again, kompakt.win is set to the new one and cleared when it closes",
    `kompakt.win: ${kompaktWinLines.join(" | ")}; other uses: ${kompaktOdd.join(" | ")}`);
  // Pruefung N4, K3: nothing takes the guards off a window's page again or
  // slips a preload in through its session
  const unguard = files.flatMap((f) => [...bare[f].matchAll(/\b(removeAllListeners|removeListener|setPreloads|registerPreloadScript)\b|\bsession\s*\.\s*(set|register)\w*/g)]
    .map((m) => `${f}: ${m[0]}`))
    .concat([...winBare.matchAll(/\.\s*off\s*\(/g)].map(() => "window.ts: .off("));
  check(!unguard.length,
    "no listener is taken off a window and no preload comes in through a session",
    `found: ${unguard.join(", ")}`);
  // Kompakt-Fix 1 (01.10.2026): full view tells the strip what it shows -
  // "stand", for full view only, from named fields alone: a reason from a
  // fixed list and, for a file, one bare log file name and a fight's start.
  // The name is only kept and handed on through /api/state; main opens,
  // lists and reads nothing with it (the strip asks /api/log, which only
  // compares it with a fresh listing - section 2b's N3 rules).
  const B = String.fromCharCode(92);
  const STAND_DEFS = [
    'const STAND_GRUENDE = ["leer", "live", "datei", "fremd", "andere", "beispiel", "mehrere"];',
    'const vollStand = { grund: "leer", datei: "", kampf: null as number | null };',
    "const LOG_NAME = /^[^" + B + B + "/:*?\"<>|" + B + "u0000-" + B + "u001f]{1,200}" + B + ".(txt|log)$/i;",
  ];
  const STAND_CASE = "{ const grund = STAND_GRUENDE.find((g) => g === sent.grund); if (!grund) return fail(\"unknown state\"); "
    + "const datei = grund === \"datei\" ? logName(sent.datei) : \"\"; "
    + "vollStand.grund = grund === \"datei\" && !datei ? \"fremd\" : grund; vollStand.datei = datei; vollStand.kampf = datei ? kampfZeit(sent.kampf) : null; "
    + "bump(\"kompaktstand\"); return ok(); }";
  const VOLLSTAND_LINES = ['const vollStand = { grund: "leer", datei: "", kampf: null as number | null };',
    "grund: vollStand.grund, datei: vollStand.datei, kampf: vollStand.kampf };",
    'vollStand.grund = grund === "datei" && !datei ? "fremd" : grund;', "vollStand.datei = datei;", "vollStand.kampf = datei ? kampfZeit(sent.kampf) : null;"];
  const vollStandLines = [...win.matchAll(/[^\n]*\bvollStand\b[^\n]*/g)].map((m) => m[0].trim());
  // Gutachten M5: /api/state hands the strip exactly these fields, and
  // winAction reads exactly these fields of the request - a new one (a
  // "pfad" passed on beside the stand) is a change the audit sees
  const KOMPAKT_STAND = "\n  return { offen: kompaktWindow() !== null, live: kompakt.start.live, durch: kompakt.start.durch,\n"
    + "    grund: vollStand.grund, datei: vollStand.datei, kampf: vollStand.kampf };";
  const SENT_FIELDS = ["alpha", "an", "art", "best", "datei", "do", "durch", "grund", "h", "height", "kampf", "kind", "live", "nr", "on", "remember", "satz", "theme", "titel", "w", "win"];
  const sentFields = [...new Set([...winBare.matchAll(/\bsent\s*\.\s*(\w+)/g)].map((m) => m[1]))].sort();
  const standOk = fnBody(win, "export function kompaktStand\\(\\): \\{ offen: boolean; live: boolean; durch: boolean; grund: string; datei: string; kampf: number \\| null \\}") === KOMPAKT_STAND
    && JSON.stringify(sentFields) === JSON.stringify(SENT_FIELDS);
  const standCase = block("stand");
  const nennt = (name) => [...winBare.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length;
  const winImports = [...win.matchAll(/^import\b[^\n]*$/gm)].map((m) => m[0]);
  check(standOk && STAND_DEFS.every((d) => win.split(d).length === 2)
      && norm(standCase ?? "") === STAND_CASE && win.split('case "stand":').length === 2
      && JSON.stringify(vollStandLines) === JSON.stringify(VOLLSTAND_LINES)
      && fnBody(win, "function logName\\(v: unknown\\): string") === '\n  return typeof v === "string" && LOG_NAME.test(v) ? v : "";'
      && fnBody(win, "function kampfZeit\\(v: unknown\\): number \\| null") === '\n  return typeof v === "number" && Number.isSafeInteger(v) ? v : null;'
      && nennt("STAND_GRUENDE") === 2 && nennt("LOG_NAME") === 2 && nennt("logName") === 2 && nennt("kampfZeit") === 2
      && [...winBare.matchAll(/\bsent\s*\.\s*datei\b/g)].length === 1
      && !winImports.some((l) => /["'](node:)?fs["']|["']\.\/logs["']|["']\.\/server["']/.test(l))
      && /\n        kompakt: kompaktStand\(\),\n/.test(code["server.ts"] ?? "")
      && [...allBare.matchAll(/\bkompaktStand\b/g)].length === 3,
    "full view's stand reaches the strip only as named values: a listed reason, one bare log file name, a fight's start - never opened in main",
    `stand: ${norm(standCase ?? "no case")}; vollStand: ${vollStandLines.join(" | ")}; sent: ${sentFields.join(" ")}`);
  // the start switches (spec Windows-Einbindung 5.1): argv - the process's
  // and second-instance's - is handed to startSchalter( and nowhere else
  // each naming of argv, with the rest of its line; windows-core.ts names it as the parameter and in the loop over it
  const argvUses = files.flatMap((f) => [...bare[f].matchAll(/\bargv\b[^\n]*/g)].map((m) => `${f}: ${m[0].trim()}`));
  const ARGV_OK = ["main.ts: argv);", "main.ts: argv) => {", "main.ts: argv));", "windows-core.ts: argv: readonly unknown[]): Start {", "windows-core.ts: argv) {"];
  check(argvUses.length === ARGV_OK.length && argvUses.every((u) => ARGV_OK.includes(u))
      && /^const ERSTER_START = startSchalter\(process\.argv\);$/m.test(code["main.ts"] ?? "")
      && /\n    auftragSetzen\(startSchalter\(argv\)\);\n/.test(code["main.ts"] ?? ""),
    "argv reaches nothing but startSchalter(", `found: ${argvUses.join(" | ")}`);
  const sTs = code["start.ts"] ?? "";
  check(sTs !== "" && !/\bfs\b|shell|loadURL|readLog|listLogs|logAnswer|require\(|import\(/.test(sTs),
    "start.ts only holds the order: no file, no shell, no log", "");
  const erledigt = block("starterledigt");
  check(erledigt !== null && !onlyNamedFields(erledigt, ["nr"]).length,
    "starterledigt reads only nr from the request", erledigt ?? "missing");
  // autostart (spec Windows-Einbindung 7): one file, one fixed argument
  const loginUsers = files.filter((f) => /\bsetLoginItemSettings\b/.test(code[f]));
  const au = code["autostart.ts"] ?? "";
  const loginArgs = [...au.matchAll(/\bargs: (\[[^\]]*\])/g)].map((m) => m[1]);
  check(loginUsers.join() === "autostart.ts" && loginArgs.length === 2 && loginArgs.every((a) => a === '["--autostart"]'),
    "setLoginItemSettings only in autostart.ts", `in: ${loginUsers}; args: ${loginArgs.join(" | ")}`);
  // Abschlussreview Important 1: both calls as written, each once - no other path, no other option
  const AU_SET = '\n  app.setLoginItemSettings({ openAtLogin: an, args: ["--autostart"] });\n';
  const AU_GET = '\n  return autostartDa() && app.getLoginItemSettings({ args: ["--autostart"] }).openAtLogin;\n';
  const loginCalls = (re) => files.reduce((n, f) => n + [...bare[f].matchAll(re)].length, 0);
  check(au.includes(AU_SET) && au.includes(AU_GET)
      && loginCalls(/\bsetLoginItemSettings\b/g) === 1 && loginCalls(/\bgetLoginItemSettings\b/g) === 1,
    "the login item is set and read only as written in autostart.ts",
    `set: ${loginCalls(/\bsetLoginItemSettings\b/g)}, get: ${loginCalls(/\bgetLoginItemSettings\b/g)}`);
  const auCase = block("autostart");
  check(auCase !== null && !onlyNamedFields(auCase, ["an"]).length, "autostart reads only an from the request", auCase ?? "missing");
  // the notification after a fight (spec Windows-Einbindung 3): one file, plain options, no XML
  const notifiers = files.filter((f) => f !== "notify.ts" && /\bNotification\b/.test(bare[f]));
  const nt = code["notify.ts"] ?? "";
  const nOpts = (nt.match(/new Notification\(\{([\s\S]*?)\}\);/) || [null, null])[1];
  // only the keys of the options themselves: what stands in nested braces, brackets or parentheses is cut first
  let nTop = nOpts ?? "";
  for (let prev = ""; prev !== nTop;) { prev = nTop; nTop = nTop.replace(/\{[^{}]*\}|\[[^\[\]]*\]|\([^()]*\)/g, ""); }
  const nKeys = nOpts === null ? [] : [...nTop.matchAll(/(?:^|,|\{)\s*(\w+)\s*(?=[:,}])/g)].map((m) => m[1]);
  check(!notifiers.length && [...nt.matchAll(/new Notification\(/g)].length === 1 && !files.some((f) => /toastXml/.test(code[f]))
      && JSON.stringify(nKeys) === JSON.stringify(["title", "body", "icon", "actions"]),
    "Notification only in notify.ts", `elsewhere: ${notifiers}; keys: ${nKeys.join(",")}`);
  // the tray (spec Windows-Einbindung 4): one file, one icon, items that raise an event, show the window or quit
  const trayUsers = files.filter((f) => f !== "tray.ts" && /\bTray\b|buildFromTemplate|popUpContextMenu/.test(bare[f]));
  const tr = code["tray.ts"] ?? "";
  const menuUses = files.flatMap((f) => [...bare[f].matchAll(/\bMenu\s*\.\s*(\w+)/g)].map((m) => `${f}: ${m[1]}`));
  check(!trayUsers.length && [...tr.matchAll(/new Tray\(/g)].length === 1
      && menuUses.every((u) => u === "main.ts: setApplicationMenu" || u === "tray.ts: buildFromTemplate"),
    "Tray and its menu only in tray.ts", `elsewhere: ${trayUsers}; Menu: ${menuUses.join(", ")}`);
  // every way to hear a click: the two tray.on calls as written, five menu items, nothing else
  const trayOn = [...tr.matchAll(/\btray\s*\.\s*on\(/g)].length;
  const clickForms = [...tr.matchAll(/\bclick\b/g)].length;
  const clicks = [...tr.matchAll(/click: \(\) => ([^\n]*?)\s*\},?$/gm)].map((m) => m[1].trim());
  check(trayOn === 2 && clickForms === 7 && tr.includes('  tray.on("click", () => vorholen(holeFenster()));\n') && tr.includes('  tray.on("right-click", () => {\n')
      && clicks.length === 5 && clicks.every((c) => /^(bump\("(compact|live|pin)"\)|vorholen\(holeFenster\(\)\)|app\.quit\(\))$/.test(c)) && !/\bshell\b|\bfs\b|exec|spawn|relaunch|loadURL|openExternal|\bexit\b/.test(tr),
    "a tray item only raises an event, shows the window or quits", `found: ${clicks.join(" | ")}`);
  check(nt !== "" && !/\bshell\b|\bfs\b|exec|spawn|relaunch|loadURL|openExternal/.test(nt),
    "a notification click only brings the window forward or raises compact", "");
  // Abschlussreview Important 2: the options block and both handlers word for word (a quoted key or a
  // spread cannot hide in them), and nothing else listens: two .on( in notify.ts, both on n
  const N_GEBAUT = "\n  const n = new Notification({\n    title: titel,\n    body: satz,\n    icon,\n"
    + '    actions: art === "kampf" ? [{ type: "button", text: wort(cfg.lang, "ansehen") }, { type: "button", text: wort(cfg.lang, "kompaktFenster") }] : [{ type: "button", text: wort(cfg.lang, "ansehen") }],\n'
    + "  });\n"
    + '  n.on("click", () => nach(art, win));\n'
    + '  n.on("action", (e) => {\n'
    + '    if (art === "kampf" && e.actionIndex === 1) bump("compact");\n'
    + "    else nach(art, win);\n"
    + "  });\n"
    + "  n.show();\n";
  const ntBare = bare["notify.ts"] ?? "";
  const nOn = [...ntBare.matchAll(/\.\s*on\s*\(/g)].length;
  const nNOn = [...ntBare.matchAll(/\bn\s*\.\s*on\s*\(/g)].length;
  check(nt.includes(N_GEBAUT) && nOn === 2 && nNOn === 2
      && !/\.\s*(once|addListener|prependListener|prependOnceListener)\s*\(/.test(ntBare),
    "a notification is built and heard only as written in notify.ts", `.on( ${nOn}, n.on( ${nNOn}`);
  // a notification raises only compact or the weeklies, and is built in the one function zeige()
  const nBumps = [...nt.matchAll(/\bbump\(([^)]*)\)/g)].map((m) => m[1]);
  check(nBumps.length === 2 && nBumps.every((b) => b === '"compact"' || b === '"weeklies"')
      && [...nt.matchAll(/\nfunction zeige\(win: BrowserWindow \| null, icon: string, art: Art, titel: string, satz: string\): void \{\n/g)].length === 1
      && [...ntBare.matchAll(/\bzeige\s*\(/g)].length === 3,
    "notify.ts raises only compact or weeklies, and zeige() builds every notification and is called only for a fight and a reminder", `bump: ${nBumps.join(", ")}`);
  const kampfCase = block("kampf");
  check(kampfCase !== null && !onlyNamedFields(kampfCase, ["titel", "satz", "best"]).length,
    "kampf reads only titel, satz and best from the request", kampfCase ?? "missing");
  // the weeklies' reminders (spec Weeklies neu, 9): the schedule's files import only each other, and
  // reach no network, file system, shell, process or notification; only notify.ts shows anything
  const ZEIT_DATEIEN = ["zeitplan-core.ts", "zeitplan.ts", "erinnerung-core.ts"];
  const zeitStray = [];
  for (const f of ZEIT_DATEIEN) {
    if (code[f] === undefined) { zeitStray.push(f + ": missing"); continue; }
    for (const m of code[f].matchAll(/^[ \t]*import\b[^\n]*\bfrom\s*"([^"\n]*)";?[ \t]*$/gm)) if (!m[1].startsWith("./")) zeitStray.push(f + ": " + m[0].trim());
    for (const m of bare[f].matchAll(/\b(?:http|https|net|dgram|fetch|XMLHttpRequest|WebSocket|fs|shell|electron|Notification|child_process|process|require|globalThis|eval|Function)\b|\bimport\s*\(/g)) zeitStray.push(f + ": " + m[0]);
  }
  check(!zeitStray.length, "the schedule's files (zeitplan-core, zeitplan, erinnerung-core) import only ./ modules and name no network, file, shell, process or notification", "found: " + zeitStray.join(" | "));
  const zp = bare["zeitplan.ts"] ?? "";
  const optsUsed = [...zp.matchAll(/\bopts\.(\w+)/g)].map((m) => m[1]);
  check([...zp.matchAll(/\bsetInterval\s*\(/g)].length === 1 && !/\bsetTimeout\b/.test(zp)
      && optsUsed.every((n) => ["regeln", "beiFaellig", "jetzt", "versatz", "stelle", "loesche"].includes(n))
      && optsUsed.filter((n) => n === "beiFaellig").length === 1,
    "the schedule has one timer, in zeitplan.ts, and calls only beiFaellig", "found: " + optsUsed.join(","));
  const er = code["erinnerung.ts"] ?? "";
  const erImports = [...er.matchAll(/^[ \t]*import\b[^\n]*\bfrom\s*"([^"\n]*)";?[ \t]*$/gm)].map((m) => m[1]).sort();
  const erBare = bare["erinnerung.ts"] ?? "";
  check(JSON.stringify(erImports) === JSON.stringify(["./erinnerung-core", "./events", "./notify", "./zeitplan", "./zeitplan-core"])
      && [...erBare.matchAll(/\bsetTimeout\s*\(/g)].length === 1 && !/\bsetInterval\b|\bfetch\b|\bfs\b|\bhttp\b|\bshell\b|\belectron\b|\bNotification\b|\bsent\b/.test(erBare),
    "erinnerung.ts imports only the schedule, events and notify, has one timer (the answer's time) and no network, file or notification of its own", "found: " + erImports.join(", "));
  const erUsers = files.filter((f) => /from "\.\/erinnerung"/.test(code[f])).sort();
  check(JSON.stringify(erUsers) === JSON.stringify(["main.ts", "server.ts"])
      && [...(bare["main.ts"] ?? "").matchAll(/\berinnerungStarten\s*\(/g)].length === 1,
    "only main.ts starts the reminders and only server.ts answers for them", "found: " + erUsers.join(", "));
  const erGet = (((getBody ?? "").match(/case "\/api\/erinnerung":\n([\s\S]*?)\n    case "/) || [null, ""])[1]).replace(/\s+/g, " ").replace(/\/\/[^\n]*?(?=return)/, "").trim();
  const erPost = (((postBody ?? "").match(/case "\/api\/erinnerung": \{\n([\s\S]*?)\n    \}/) || [null, ""])[1]).replace(/\/\/[^\n]*\n/g, "").replace(/\s+/g, " ").trim();
  check(erGet.endsWith("return reply(res, { ok: true, ...erinnerungAbfrage() });")
      && erPost === "const done = erinnerungAntwort(sent.id, sent.n); return reply(res, { ok: done }, done ? 200 : 400);",
    "/api/erinnerung answers a GET with erinnerungAbfrage() and takes a POST of an id and a number only, nothing else from the request", "get: " + erGet + " post: " + erPost);
  const serverSrc = code["server.ts"] ?? "";
  check(/\n      if \(changes\.lang !== "de" && changes\.lang !== "en"\) delete changes\.lang;\n/.test(serverSrc)
      // GET /api/config gives it back only as "de", "en" or null (Windows-Einbindung 8, Fixrunde 1 zu Aufgabe 8)
      && serverSrc.includes('\n        lang: cfg.lang === "de" || cfg.lang === "en" ? cfg.lang : null,\n')
      && [...serverSrc.matchAll(/\bcfg\.lang\b/g)].length === 3
      && /^const FIRST_START = isFirstStart\(loadConfig\(\),\n  \[\.\.\.CONFIG_KEYS\.filter\(\(k\) => k !== "themeResolved" && k !== "rundgangGesehen" && k !== "lang"\)/m.test(serverSrc),
    "lang is stored only as de or en", "");
  // Kompakt-Fix 2 (01.10.2026): the compact window has a maximum - twice the
  // largest strip the page measured, only ever growing - set in one place
  // and only from the compact window's resize; full view gets none. How the
  // page names the request ("art") is a word from a fixed list.
  const maxCalls = files.flatMap((f) => [...code[f].matchAll(/setMaximumSize\s*\(([^)]*)\)/g)].map((m) => `${f}: ${m[1].trim()}`));
  const maxOptions = files.flatMap((f) => [...bare[f].matchAll(/\bmax(Width|Height)\b/g)].map((m) => `${f}: ${m[0]}`));
  const GRENZE_SETZEN = "\n  const [ow = 0, oh = 0] = kw.getSize();\n  const [cw = 0, ch = 0] = kw.getContentSize();\n"
    + "  kw.setMaximumSize(w + ow - cw, h + oh - ch);";
  // Kompakt-Fix 3 put the menu's two words in front (menueAuf, menueZu below)
  const STREIFEN_GROESSE = "\n  if (art === \"menue\") return menueAuf(kw, w, h);\n  if (art === \"zurueck\") return menueZu(kw);\n"
    + "  const a = screen.getDisplayMatching(kw.getBounds()).workArea;\n"
    + "  streifen.grenze.w = Math.min(a.width, Math.max(streifen.grenze.w, KOMPAKT_MAX_FAKTOR * w));\n"
    + "  streifen.grenze.h = Math.min(a.height, Math.max(streifen.grenze.h, KOMPAKT_MAX_FAKTOR * h));\n"
    + "  if (streifen.vorMenue) return;\n"
    + "  grenzeSetzen(kw, streifen.grenze.w, streifen.grenze.h);\n  if (art === \"streifen\") sizeBySelf(kw, w, h);";
  const RESIZE_KOMPAKT = "\n        if (win !== state.win) {\n          const art = STREIFEN_ARTEN.find((a) => a === sent.art) ?? \"streifen\";\n"
    + "          if (w > 0 && h > 0) streifenGroesse(win, Math.max(w, MIN_ACTION_W), Math.max(h, MIN_ACTION_H), art);\n"
    + "          break;\n        }\n";
  const GRENZE_LINES = ["streifen.grenze = { w: 0, h: 0 };",
    "streifen.grenze.w = Math.min(a.width, Math.max(streifen.grenze.w, KOMPAKT_MAX_FAKTOR * w));",
    "streifen.grenze.h = Math.min(a.height, Math.max(streifen.grenze.h, KOMPAKT_MAX_FAKTOR * h));",
    "grenzeSetzen(kw, streifen.grenze.w, streifen.grenze.h);",
    "grenzeSetzen(kw, Math.max(streifen.grenze.w, nw), Math.max(streifen.grenze.h, nh));",
    "if (streifen.grenze.w > 0) grenzeSetzen(kw, streifen.grenze.w, streifen.grenze.h);"];
  const grenzeLines = [...win.matchAll(/[^\n]*\bstreifen\s*\.\s*grenze\b[^\n]*/g)].map((m) => m[0].trim());
  const resizeCase = block("resize");
  // Gutachten M4: setMaximumSize named once in all of main - so no .call,
  // .apply or second handle beside the one call - and in the files that
  // reach a window no member is looked up by a computed string name
  // (["setMaximum" + "Size"]); the two header reads of the server are the
  // only computed string keys there, as written.
  const maxMentions = files.flatMap((f) => [...bare[f].matchAll(/\bsetMaximumSize\b/g)].map(() => f));
  const winFiles = files.filter((f) => /\b(BrowserWindow|currentWindow|kompaktWindow)\b/.test(bare[f]));
  const HEADER_READS = ['const site = req.headers["sec-fetch-site"];',
    'const media = String(req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();'];
  const computedNames = winFiles.flatMap((f) => [...code[f].matchAll(/[^\n]*[\w$)\]]\s*\[\s*["'`][^\n]*/g)]
    .map((m) => m[0].trim()).filter((l) => !(f === "server.ts" && HEADER_READS.includes(l))).map((l) => `${f}: ${l}`));
  check(maxMentions.length === 1 && maxMentions[0] === "window.ts" && !computedNames.length
      && JSON.stringify(maxCalls) === JSON.stringify(["window.ts: w + ow - cw, h + oh - ch"]) && !maxOptions.length
      && fnBody(win, "function grenzeSetzen\\(kw: BrowserWindow, w: number, h: number\\): void") === GRENZE_SETZEN
      && fnBody(win, "function streifenGroesse\\(kw: BrowserWindow, w: number, h: number, art: string\\): void") === STREIFEN_GROESSE
      && /\nconst KOMPAKT_MAX_FAKTOR = 2;\n/.test(win) && nennt("KOMPAKT_MAX_FAKTOR") === 3
      && /\nconst STREIFEN_ARTEN = \["streifen", "hand", "menue", "zurueck"\];\n/.test(win) && nennt("STREIFEN_ARTEN") === 2
      && nennt("grenzeSetzen") === 4 && nennt("streifenGroesse") === 2
      && resizeCase !== null && resizeCase.split(RESIZE_KOMPAKT).length === 2
      && [...winBare.matchAll(/\bsent\s*\.\s*art\b/g)].length === 1
      && JSON.stringify(grenzeLines) === JSON.stringify(GRENZE_LINES),
    "the compact window has a maximum: twice the largest strip the page measured, set in one place, never for full view",
    `setMaximumSize(${maxCalls.join(") | (")}) named in ${maxMentions.join(", ")}; options: ${maxOptions.join(", ")}; `
    + `computed names: ${computedNames.join(" | ")}; grenze: ${grenzeLines.join(" | ")}`);
  // Kompakt-Fix 3 (01.10.2026): the strip's menu - the compact window grows
  // for it while it is open, never smaller and never off its monitor's work
  // area, and comes back to the size (and place) from before when it closes.
  // Only from the compact window's resize, only these two functions, as
  // written; full view is never grown or moved by them.
  const MENUE_AUF = "\n  const o = kw.getBounds();\n  const [cw = 0, ch = 0] = kw.getContentSize();\n"
    + "  if (!streifen.vorMenue) streifen.vorMenue = { w: o.width, h: o.height, x: o.x, y: o.y, gehoben: false };\n"
    + "  const nw = Math.max(cw, w);\n  const nh = Math.max(ch, h);\n"
    + "  grenzeSetzen(kw, Math.max(streifen.grenze.w, nw), Math.max(streifen.grenze.h, nh));\n  sizeBySelf(kw, nw, nh);\n"
    + "  const a = screen.getDisplayMatching(o).workArea;\n  const ueber = o.y + o.height - ch + nh - (a.y + a.height);\n"
    + "  if (ueber > 0) {\n    positionBySelf(kw, { x: o.x, y: Math.max(a.y, o.y - ueber) });\n    streifen.vorMenue.gehoben = true;\n  }";
  const MENUE_ZU = "\n  const v = streifen.vorMenue;\n  if (!v) return;\n  streifen.vorMenue = null;\n  const b = kw.getBounds();\n"
    + "  boundsBySelf(kw, { x: b.x, y: v.gehoben ? v.y : b.y, w: v.w, h: v.h, max: false });\n"
    + "  if (streifen.grenze.w > 0) grenzeSetzen(kw, streifen.grenze.w, streifen.grenze.h);";
  const VOR_MENUE_LINES = ["streifen.vorMenue = null;", "if (streifen.vorMenue) return;",
    "if (!streifen.vorMenue) streifen.vorMenue = { w: o.width, h: o.height, x: o.x, y: o.y, gehoben: false };",
    "streifen.vorMenue.gehoben = true;", "const v = streifen.vorMenue;", "streifen.vorMenue = null;"];
  const vorMenueLines = [...win.matchAll(/[^\n]*\bstreifen\s*\.\s*vorMenue\b[^\n]*/g)].map((m) => m[0].trim());
  const POSITION_CALLS = ["kw, { x: o.x, y: Math.max(a.y, o.y - ueber) }", "win, p"];
  const BOUNDS_CALLS = ["kw, { x: b.x, y: v.gehoben ? v.y : b.y, w: v.w, h: v.h, max: false }", "win, g"];
  const boundsCalls = argsOf(win, "boundsBySelf").filter((a) => a !== "win: BrowserWindow, g: LageGross");
  const positionCalls = argsOf(win, "positionBySelf").filter((a) => a !== "win: BrowserWindow, p: LageKompakt");
  check(fnBody(win, "function menueAuf\\(kw: BrowserWindow, w: number, h: number\\): void") === MENUE_AUF
      && fnBody(win, "function menueZu\\(kw: BrowserWindow\\): void") === MENUE_ZU
      && nennt("menueAuf") === 2 && nennt("menueZu") === 2
      && JSON.stringify(vorMenueLines) === JSON.stringify(VOR_MENUE_LINES)
      && JSON.stringify(positionCalls) === JSON.stringify(POSITION_CALLS) && JSON.stringify(boundsCalls) === JSON.stringify(BOUNDS_CALLS),
    "the strip's menu grows only the compact window, never off its monitor, and gives size and place back on closing",
    `vorMenue: ${vorMenueLines.join(" | ")}; positionBySelf(${positionCalls.join(") | (")}); boundsBySelf(${boundsCalls.join(") | (")})`);

  // --- 9. the best pull per boss (boro-best.json): one fixed file in the
  //        settings folder, written only through putBest() from a POST, after
  //        its checks, and never sent anywhere. best.ts writes through a temp
  //        file and a rename (so a crash mid-write cannot half-write the real
  //        file); every reader and writer is checked against those two fixed
  //        names, not just the writeFileSync call section 1 already covers.
  const best = code["best.ts"];
  if (best !== undefined) {
    // every declaration of BEST_PATH, not just the first: a second one
    // appended anywhere (e.g. built from a variable) is as dangerous as
    // changing the one already there
    const bestPathDefs = [...best.matchAll(/\bconst BEST_PATH\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
    check(bestPathDefs.length > 0 && bestPathDefs.every((d) => d === 'settingsPath("boro-best.json")'),
      "best pulls live in one fixed file in the settings folder, never a name built at run time",
      `found: ${bestPathDefs.join(" | ")}`);
    check(!/fetchJson|readLog|STATE\.dir|shell\.|\bfetch\(|require\(|import\(/.test(best),
      "best.ts reads no log and sends nothing anywhere");
    // best.ts is a leaf: exactly these imports, each in exactly this form.
    // A named import from node:fs (import { unlinkSync } ...) would reach fs
    // without the "fs." the checks below look for, so only the namespace
    // form is allowed; ./paths lends settingsPath and nothing else. With the
    // allowed lines taken out, no import, re-export or require may remain.
    const ALLOWED_IMPORTS = ['import * as fs from "node:fs";', 'import * as path from "node:path";',
      'import { settingsPath } from "./paths";'];
    const importLines = [...best.matchAll(/^[ \t]*import\b[^\n]*$/gm)].map((m) => m[0].trim());
    const rest = ALLOWED_IMPORTS.reduce((src, line) => src.split(line).join(""), best);
    const strayImports = [...rest.matchAll(/\bimport\b[^\n]*|\bfrom\s*["'`][^\n]*|\brequire\b[^\n]*/g)].map((m) => m[0]);
    check(importLines.every((l) => ALLOWED_IMPORTS.includes(l)) && !strayImports.length,
      "best.ts imports only node:fs, node:path and ./paths",
      `found: ${[...importLines.filter((l) => !ALLOWED_IMPORTS.includes(l)), ...strayImports].join(" | ")}`);
    check(!/\bprocess\b|\bglobalThis\b|\bReflect\b|\bFunction\s*\(/.test(rest),
      "best.ts reaches nothing through process, globalThis, Reflect or Function");
    // node:fs only as three calls: read the file, write the temp file, rename
    // it into place. Every mention of fs must be one of them - no unlink, rm,
    // open/write on a descriptor, truncate, copy, stream, fs.promises, and no
    // fs handed on under another name.
    const fsMentions = [...rest.matchAll(/\bfs\b[.\w]*/g)].map((m) => m[0]);
    const otherFs = fsMentions.filter((m) => !/^fs\.(readFileSync|writeFileSync|renameSync)$/.test(m));
    const fsCalls = [...rest.matchAll(/\bfs\.(readFileSync|writeFileSync|renameSync)\(/g)].length;
    check(fsMentions.length > 0 && !otherFs.length && fsMentions.length === fsCalls,
      "best.ts uses node:fs only to read, write and rename (no delete, descriptor, copy or stream)",
      `found: ${otherFs.join(" | ") || `${fsMentions.length} mentions of fs, ${fsCalls} calls`}`);
    // every read or write in best.ts names BEST_PATH or its temp twin, never
    // a path from the request, the log folder or anywhere else
    const TMP_EXPR = 'BEST_PATH + ".tmp"';
    const fileOps = [...rest.matchAll(/\bfs\.(readFileSync|writeFileSync)\(\s*([^,)]+)/g)];
    const badFileOps = fileOps.filter((m) => m[2].trim() !== "BEST_PATH" && m[2].trim() !== TMP_EXPR).map((m) => m[0]);
    check(fileOps.length > 0 && !badFileOps.length,
      "best.ts reads and writes only BEST_PATH and its temp file", `found: ${badFileOps.join(" | ")}`);
    const renames = [...rest.matchAll(/\bfs\.renameSync\(([^)]*)\)/g)];
    check(renames.length > 0 && renames.every((m) => m[1].trim() === TMP_EXPR + ", BEST_PATH"),
      "best.ts renames only its own temp file onto BEST_PATH", `found: ${renames.map((m) => m[0]).join(" | ")}`);
    // BEST_PATH is never shadowed or handed around: past its one declaration
    // it appears only as the path of those three calls, and settingsPath is
    // used for that declaration alone
    const pathLeft = rest
      .replace(/export const BEST_PATH = settingsPath\("boro-best\.json"\);/, "")
      .replace(/\bfs\.(readFileSync|writeFileSync)\(BEST_PATH\b/g, "")
      .replace(/\bfs\.renameSync\(BEST_PATH \+ "\.tmp", BEST_PATH\)/g, "");
    const strayPath = [...pathLeft.matchAll(/[^\n]{0,30}\b(BEST_PATH|settingsPath)\b[^\n]{0,30}/g)].map((m) => m[0].trim());
    check(!strayPath.length, "BEST_PATH is declared once and used only as the path of those calls",
      `found: ${strayPath.join(" | ")}`);
    const put = (best.match(/export function putBest\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || [null, null])[1];
    check(put !== null, "putBest() exists in best.ts");
    if (put !== null) {
      // the signature pinned too: a parameter named like a bound (a default
      // MAX_KEYS = 1e9) would shadow the constant pinned below
      check(/export function putBest\(key: unknown, entry: unknown\): PutResult \{/.test(best),
        "putBest takes exactly the key and the entry");
      const at = (s) => put.indexOf(s);
      const checks = [at("KEY_RX.test(key)"), at("> MAX_ENTRY"), at(">= MAX_KEYS")];
      check(checks.every((i) => i >= 0) && at("saveBest(") > Math.max(...checks),
        "putBest checks key, size and count before it writes", `positions: ${checks} / saveBest ${at("saveBest(")}`);
    }
    // every declaration of the two bounds and the key rule, however declared,
    // not just the first: MAX_ENTRY within its cap, MAX_KEYS and KEY_RX
    // exactly as ruled (MAX_KEYS 200; a key is boss: or dummy: and a name)
    const declAll = (name) => [...best.matchAll(new RegExp(`\\b(?:const|let|var)\\s+${name}\\b\\s*(?::[^=]+)?=\\s*([^;]+);`, "g"))]
      .map((m) => m[1].trim());
    const entryVals = declAll("MAX_ENTRY");
    const keyVals = declAll("MAX_KEYS");
    const num = (v) => (/^[\d_]+$/.test(v) ? Number(v.replace(/_/g, "")) : NaN);
    check(entryVals.length > 0 && entryVals.every((v) => num(v) > 0 && num(v) <= 262144)
        && keyVals.length > 0 && keyVals.every((v) => v === "200"),
      "one best pull and the number of them are capped (MAX_KEYS 200)", `MAX_ENTRY ${entryVals}, MAX_KEYS ${keyVals}`);
    // built with String.fromCharCode(92) for the two backslashes, so this
    // file holds no escape an editor could turn into the character itself
    const BSL = String.fromCharCode(92);
    const KEY_RX_SRC = "/^(boss|dummy):[^" + BSL + "u0000-" + BSL + "u001f]{1,120}$/";
    const keyRxVals = declAll("KEY_RX");
    check(keyRxVals.length > 0 && keyRxVals.every((v) => v === KEY_RX_SRC),
      "best keys are boss: or dummy: and a name, as ruled (KEY_RX pinned)", `found: ${keyRxVals.join(" | ")}`);
    // each bound and the key rule is bound exactly once and used exactly
    // once, in putBest's own check - whatever form a second binding took
    // (const { MAX_KEYS } = ..., const [KEY_RX] = ..., a parameter) or an
    // export handing the name on, it is one mention too many. Counted in
    // the view without string contents, so a string cannot add or hide one.
    const bestBare = bare["best.ts"] ?? "";
    const mentions = (name) => [...bestBare.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length;
    const pins = [["MAX_ENTRY", "> MAX_ENTRY"], ["MAX_KEYS", ">= MAX_KEYS"], ["KEY_RX", "KEY_RX.test(key)"]];
    const loose = pins.filter(([name, use]) => mentions(name) !== 2 || declAll(name).length !== 1 || !(put ?? "").includes(use))
      .map(([name]) => `${name}: ${mentions(name)} mentions, ${declAll(name).length} declarations`);
    check(!loose.length, "MAX_ENTRY, MAX_KEYS and KEY_RX are each bound once and used once, in putBest",
      `found: ${loose.join(" | ")}`);
    // the strings best.ts may hold, all of them: its imports, its file name,
    // encodings and error codes, and the names of its own results. Nothing
    // else - no path, no URL, and no text that could stand in for a check
    // the rules above look for; no template literal either.
    const BEST_STRINGS = new Set(["node:fs", "node:path", "./paths", "boro-best.json", ".tmp", "utf8", "ENOENT",
      "object", "string", "data", "corrupt", "saved", "refused", "unavailable"]);
    const tb = toks["best.ts"];
    const oddStrings = tb.error ? ["(not tokenised)"] : tb.strings.filter((x) => !BEST_STRINGS.has(x)).map((x) => JSON.stringify(x));
    check(!oddStrings.length && !(tb.templates > 0), "best.ts holds only its own fixed strings and no template",
      `found: ${oddStrings.join(" | ")}${tb.templates ? ` and ${tb.templates} template(s)` : ""}`);
  }
  const putters = Object.entries(code).filter(([f, s]) => f !== "best.ts" && /\bputBest\(/.test(s)).map(([f]) => f);
  // the import pinned as well: under another name (putBest as keep) a call
  // from any other file would not say putBest at all
  const bestImporters = Object.entries(code)
    .filter(([f, s]) => f !== "best.ts" && /from\s*["'`]\.\/best(\.js)?["'`]|require\(\s*["'`]\.\/best|import\(\s*["'`]\.\/best/.test(s))
    .map(([f]) => f);
  check(putters.every((f) => f === "server.ts") && bestImporters.every((f) => f === "server.ts")
      && (!bestImporters.length || /^import \{ loadBest, putBest \} from "\.\/best";$/m.test(code["server.ts"] ?? ""))
      && [...(code["server.ts"] ?? "").matchAll(/\bputBest\(/g)].length <= 1,
    "only the local server calls putBest, once, under its own name", `callers: ${putters}; importers: ${bestImporters}`);
  // and as a value nowhere: in server.ts the name occurs exactly twice - in
  // that import and in the one call of the POST case - and in no other file
  // at all. An alias (export const keep = putBest), a re-export or putBest
  // passed along is a third mention. Counted without string contents.
  const putNames = Object.fromEntries(files.filter((f) => f !== "best.ts")
    .map((f) => [f, [...bare[f].matchAll(/\bputBest\b/g)].length]));
  const serverCode = code["server.ts"] ?? "";
  const putOk = Object.entries(putNames).every(([f, k]) => (f === "server.ts" ? k === 2 : k === 0))
    && (putNames["server.ts"] ?? 0) === 2
    && /^import \{ loadBest, putBest \} from "\.\/best";$/m.test(serverCode)
    && [...serverCode.matchAll(/\bputBest\(sent\.key, sent\.entry\);/g)].length === 1
    && [...serverCode.matchAll(/["'`]\.\/best(\.js)?["'`]/g)].length === 1;
  check(putOk, "putBest is named only in server.ts's import and its one call, never passed on as a value",
    `mentions: ${Object.entries(putNames).filter(([, k]) => k).map(([f, k]) => `${f} ${k}`).join(", ")}`);
  check(!/loadBest|putBest|BEST_PATH/.test(code["party.ts"] ?? ""), "the party code never sees the best pulls");
  if (postBody !== null && best !== undefined) {
    check(postBody.includes('case "/api/best":'), "/api/best writes in the POST path");
    // the POST case passes on exactly what the page sent, once - nothing
    // added in from the log or the watched folder
    const postCase = (postBody.match(/case "\/api\/best": \{([\s\S]*?)\n    \}/) || [null, null])[1];
    const putCalls = [...(postCase ?? "").matchAll(/putBest\([^)]*\)/g)].map((m) => m[0]);
    check(postCase !== null && putCalls.length === 1 && putCalls[0] === "putBest(sent.key, sent.entry)"
        && !/readLog|STATE\.dir/.test(postCase),
      "/api/best's POST case calls putBest(sent.key, sent.entry) once and nothing else", `found: ${putCalls.join(", ")}`);
  }
  if (getBody !== null && best !== undefined) {
    check(getBody.includes('case "/api/best":'), "/api/best also answers a GET (read-only)");
    // the GET answers what loadBest() read, or 503 when the file is there
    // but unreadable - never an empty store the page would write back over
    const getCase = (getBody.match(/case "\/api\/best": \{\n([\s\S]*?)\n    \}/) || [null, null])[1];
    const getCode = (getCase ?? "").replace(/\s+/g, " ").trim();
    check(getCode === "const best = loadBest(); return best ? reply(res, { ok: true, best }) : reply(res, { ok: false }, 503);",
      "/api/best's GET case answers only loadBest(), 503 when it could not read, nothing from the log", `found: ${getCode}`);
  }

  // --- 10-12. the builds, the plans and the Questlog request are gone
  //         (#207, 06.10.2026). Sections 10 (boro-builds.json), 11
  //         (boro-plans.json) and 12 (questlog.ts, the one request to
  //         questlog.gg) held the rules for three files. The files are gone,
  //         and the rules now say that they stay gone: no store of the
  //         builds, no route to them, no name of Questlog anywhere in main,
  //         and the global fetch only in http.ts (the party, section 3) and
  //         update.ts (the update notice, section 14), once each. The
  //         player's own files boro-builds.json and boro-plans.json stay on
  //         the disk untouched: no main file names them (the count of
  //         "boro-" per file, below, already holds that; the explicit check
  //         here names the two).
  const GONE = ["builds.ts", "plans.ts", "questlog.ts"];
  check(!GONE.some((f) => files.includes(f)), "builds.ts, plans.ts and questlog.ts are gone from src/main",
    `found: ${GONE.filter((f) => files.includes(f)).join(", ")}`);
  const namesGone = files.filter((f) => /boro-(builds|plans)|questlog/i.test(code[f]) || /\b(putBuild|loadBuilds|putPlan|loadPlans|fetchPlan|QL_BASE)\b/.test(bare[f]));
  check(!namesGone.length, "no main file names Questlog, boro-builds.json, boro-plans.json or the old builds, plans and Questlog functions",
    `found in: ${namesGone}`);
  const routesGone = files.filter((f) => /\/api\/(builds|plans?)\b/.test(code[f]));
  check(!routesGone.length, "no main file serves /api/builds, /api/plans or /api/plan/fetch", `found in: ${routesGone}`);
  // every module path in a main file (import/export ... from, a bare import,
  // require() or import() with a plain string - section 0 allows no other)
  // that leads to <name>.ts, however it is spelled: "./plans",
  // "././plans.js", "../main/plans" all end in the same file
  const modRefs = (f, name) => [...code[f].matchAll(/(?:\bfrom|\bimport|\brequire)\s*\(?\s*["'`]([^"'`\n]+)["'`]/g)]
    .filter((m) => /^[./]/.test(m[1]))
    .map((m) => posix.basename(posix.normalize(m[1])).replace(/\.(js|ts|mjs|cjs)$/, ""))
    .filter((x) => x === name).length;
  // ... and none loads the three files under any spelling of the path
  const gonePaths = files.filter((f) => GONE.some((g) => modRefs(f, g.replace(/\.ts$/, ""))));
  check(!gonePaths.length, "no main file imports builds, plans or questlog, however the path is spelled", `found in: ${gonePaths}`);
  const fetchers = files.flatMap((f) => [...bare[f].matchAll(/\bfetch\b/g)].map(() => f));
  // 14.4: update.ts is the second file, and the only one added (02.10.2026); questlog.ts left in #207
  const FETCHERS = ["http.ts", "update.ts"];
  check(FETCHERS.every((g) => fetchers.filter((f) => f === g).length <= 1) && fetchers.every((f) => FETCHERS.includes(f)),
    "only http.ts and update.ts call fetch, once each", `found in: ${fetchers}`);

  // --- 12b. every way out of this computer, not only fetch (Gutachten
  //          Update-Hinweis, 02.10.2026: http.get, https.request, electron's
  //          net.request, new WebSocket and a fetch in a folder below
  //          src/main all passed). The ways main has today, and where:
  //          node:http in http.ts (types only), server.ts and party.ts (the
  //          two listeners, createServer once each); node:dgram in party.ts
  //          (one UDP socket that only picks the LAN address, it sends
  //          nothing); fetch in http.ts and update.ts (section 10-12).
  //          Nothing else: no node:https, node:net, node:tls, node:http2,
  //          node:dns or undici, no electron net or session, no WebSocket,
  //          EventSource, XMLHttpRequest, WebTransport or WebRTC.
  // a main file loads another main file only as "./name", never from a
  // folder above or below - otherwise code outside the files read here
  // could run in main
  const relStray = [];
  for (const f of files) {
    for (const m of code[f].matchAll(/(?<![\w$.])(?:from|import)\s*["'`]([^"'`\n]*)["'`]/g)) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue; // a module by name, checked by the module rules
      if (!/^\.\/[\w-]+$/.test(spec) || !files.includes(spec.slice(2) + ".ts")) relStray.push(`${f}: ${spec}`);
    }
  }
  check(!relStray.length, "main loads its own files only as \"./name\", each a .ts file at the top of src/main",
    `found: ${relStray.join(" | ")}`);
  // the network modules by name - in any string, so a multi-line or named
  // import, a re-export or a require is counted as well - only where they
  // are used today, and there only as the one namespace import line
  const NET_MODULES = /^(?:node:)?(?:http|https|http2|net|tls|dgram|dns|undici)(?:\/.*)?$/;
  const NET_OK = { "http.ts": ["node:http"], "server.ts": ["node:http"], "party.ts": ["node:dgram", "node:http"] };
  const netModules = [];
  for (const f of files) {
    const named = (toks[f].strings ?? []).filter((s) => NET_MODULES.test(s));
    const lines = [...code[f].matchAll(/^import \* as (http|dgram) from "node:(http|dgram)";$/gm)]
      .filter((m) => m[1] === m[2]).map((m) => "node:" + m[1]);
    const allowed = NET_OK[f] ?? [];
    if (named.some((s) => !allowed.includes(s)) || named.slice().sort().join() !== lines.slice().sort().join()
        || new Set(lines).size !== lines.length) {
      netModules.push(`${f}: ${named.join(", ")}`);
    }
  }
  check(!netModules.length,
    "network modules only as one namespace import each: node:http in http.ts, server.ts and party.ts, node:dgram in party.ts - "
      + "never node:https, net, tls, http2, dns or undici",
    `found: ${netModules.join(" | ")}`);
  // with its import line blanked, http and dgram stand only before a listed
  // member: the listeners and their types, never request, get, Agent or a
  // handle on the module itself
  const HTTP_MEMBERS = new Set(["createServer", "Server", "ServerResponse", "IncomingMessage", "OutgoingHttpHeaders"]);
  const nsUses = [];
  const servers = [];
  for (const f of files) {
    let rest = bare[f];
    for (const l of code[f].matchAll(/^import \* as (http|dgram) from "node:\1";$/gm)) {
      rest = rest.slice(0, l.index) + " ".repeat(l[0].length) + rest.slice(l.index + l[0].length);
    }
    for (const m of rest.matchAll(/\bhttp\b(\s*\.\s*(\w+))?/g)) {
      if (!HTTP_MEMBERS.has(m[2] ?? "")) nsUses.push(`${f}: ${norm(m[0])}`);
      else if (m[2] === "createServer") servers.push(f);
    }
    for (const m of rest.matchAll(/\bdgram\b(\s*\.\s*(\w+)\s*\(?)?/g)) {
      if (norm(m[0]) !== "dgram.createSocket(") nsUses.push(`${f}: ${norm(m[0])}`);
    }
  }
  check(!nsUses.length && servers.join() === "party.ts,server.ts",
    "node:http only for the two listeners (createServer once in server.ts and party.ts) and their types - no request, get or Agent",
    `found: ${nsUses.join(" | ")}; createServer in: ${servers.join(", ")}`);
  // the one UDP socket: made once, in party.ts, as probe; it is only
  // connected (which sends nothing, it picks the route) and asked its own
  // address, then closed
  const party = code["party.ts"] ?? "";
  const partyBare = bare["party.ts"] ?? "";
  const probeUses = [...partyBare.matchAll(/\bprobe\b(\s*\.\s*(\w+)\s*\(?)?/g)].map((m) => norm(m[0]));
  const PROBE_OK = new Set(["probe.on(", "probe.close(", "probe.connect(", "probe.address("]);
  check([...party.matchAll(/\bdgram\.createSocket\(/g)].length === 1
      && [...party.matchAll(/^    const probe = dgram\.createSocket\("udp4"\);$/gm)].length === 1
      && files.every((f) => f === "party.ts" || !/\bdgram\b/.test(bare[f]))
      && probeUses.filter((u) => u === "probe").length === 1 && probeUses.every((u) => u === "probe" || PROBE_OK.has(u))
      && [...party.matchAll(/\bprobe\.connect\(/g)].length === 1 && /\bprobe\.connect\(1, "10\.255\.255\.255", \(\) => \{/.test(party),
    "the one UDP socket (party.ts, probe) only picks the LAN address: connect to 10.255.255.255, address, close - it sends nothing",
    `probe: ${probeUses.join(" | ")}`);
  // electron's own ways out: net (request, fetch), a session (fetch,
  // resolveHost, downloads), netLog and downloadURL - not imported, and
  // not reached through a window's webContents either
  const ELECTRON_NET = new Set(["net", "netLog", "session", "ClientRequest", "utilityProcess"]);
  const electronNet = [];
  for (const f of files) {
    for (const l of importLines[f]) {
      for (const name of l[0].match(ELECTRON_IMPORT)[1].split(", ")) if (ELECTRON_NET.has(name)) electronNet.push(`${f}: import ${name}`);
    }
    for (const m of bare[f].matchAll(/\b(?:session|defaultSession|netLog|downloadURL|ClientRequest|utilityProcess)\b/g)) {
      electronNet.push(`${f}: ${m[0]}`);
    }
  }
  check(!electronNet.length, "main uses no electron net, session, netLog or downloadURL", `found: ${electronNet.join(" | ")}`);
  // and the web's other ways, which Node and Electron both carry as globals
  const webWays = files.flatMap((f) => [...bare[f].matchAll(
    /\b(?:WebSocket|WebSocketStream|EventSource|XMLHttpRequest|WebTransport|RTCPeerConnection|sendBeacon)\b/g)]
    .map((m) => `${f}: ${m[0]}`));
  check(!webWays.length, "main opens no WebSocket, EventSource, XMLHttpRequest, WebTransport or WebRTC connection",
    `found: ${webWays.join(" | ")}`);

  // --- 13. the weeklies (boro-weeklies.json, spec Weeklies 6;
  //         approved 29.09.): one fixed file in the settings folder, written
  //         only through putWeeklies() from a POST after checkWeeklies()
  //         rebuilt the state, or created empty once on start ("wx", never
  //         over a file that is there). Never sent anywhere, never emptied.
  //         The rules of sections 9-11 for a fourth store, written out once
  //         more. Checks on calls and names read `bare`, on fixed text `code`.
  const wk = code["weeklies.ts"];
  const wkBare = bare["weeklies.ts"] ?? "";
  check(wk !== undefined && /^export function putWeeklies\(data: unknown\): PutResult \{$/m.test(wk),
    "weeklies.ts is there to audit, with putWeeklies(data)");
  if (wk !== undefined) {
    const P = "WEEKLIES_PATH", TMP = 'WEEKLIES_PATH + ".tmp"';
    const defs = [...wk.matchAll(/\bconst WEEKLIES_PATH\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
    check(defs.length === 1 && defs[0] === 'settingsPath("boro-weeklies.json")'
        && [...wkBare.matchAll(/\bsettingsPath\b/g)].length === 2,
      "weeklies live in one fixed file in the settings folder (settingsPath imported and used once)", `found: ${defs.join(" | ")}`);
    check(!/fetchJson|readLog|STATE\.dir|shell\.|\bfetch\b|require\s*\(|import\s*\(|\bprocess\b|\bglobal\b|\bglobalThis\b|\bReflect\b|\bFunction\b/
        .test(wkBare), "weeklies.ts reads no log and sends nothing");
    const IMPORTS = ['import * as fs from "node:fs";', 'import { settingsPath } from "./paths";'];
    const lines = [...wk.matchAll(/^[ \t]*import\b[^\n]*$/gm)].map((m) => m[0].trim());
    const wRest = IMPORTS.reduce((src, line) => src.split(line).join(""), wk);
    const wStray = [...wRest.matchAll(/\bimport\b[^\n]*|\bfrom\s*["'`][^\n]*/g)].map((m) => m[0]);
    check(lines.length === 2 && lines.every((l) => IMPORTS.includes(l)) && !wStray.length,
      "weeklies.ts imports only node:fs and ./paths", `found: ${[...lines, ...wStray].join(" | ")}`);
    const fsMentions = [...wkBare.matchAll(/\bfs\b[.\w]*/g)].map((m) => m[0]);
    const fsCalls = [...wkBare.matchAll(/\bfs\.(readFileSync|writeFileSync|renameSync)\(/g)].length;
    // the import line names fs once without a method
    check(fsMentions.filter((m) => m === "fs").length === 1 && fsCalls === fsMentions.length - 1 && fsCalls > 0,
      "weeklies.ts uses node:fs only to read, write and rename (no delete, descriptor, copy or stream)",
      `found: ${fsMentions.join(" | ")}`);
    const ops = [...wk.matchAll(/\bfs\.(readFileSync|writeFileSync)\(\s*([^,)]+)/g)];
    check(ops.length > 0 && ops.every((m) => [P, TMP].includes(m[2].trim())),
      "weeklies.ts reads and writes only WEEKLIES_PATH and its temp file", `found: ${ops.map((m) => m[0]).join(" | ")}`);
    // the two writes as written: the whole state into the temp file, and the
    // empty file on the first start, only when there is none
    const writes = [...wk.matchAll(/\bfs\.writeFileSync\([^;]*;/g)].map((m) => m[0]);
    check(writes.length === 2
        && writes[0] === 'fs.writeFileSync(WEEKLIES_PATH + ".tmp", JSON.stringify(all), "utf8");'
        && writes[1] === 'fs.writeFileSync(WEEKLIES_PATH, JSON.stringify(empty()), { encoding: "utf8", flag: "wx" });',
      "the weeklies file is written whole through its temp file, or created once and never over a file that is there",
      `found: ${writes.join(" | ")}`);
    const renames = [...wk.matchAll(/\bfs\.renameSync\(([^)]*)\)/g)];
    check(renames.length === 1 && renames[0][1].trim() === TMP + ", " + P,
      "weeklies.ts renames only its own temp file onto WEEKLIES_PATH", `found: ${renames.map((m) => m[0]).join(" | ")}`);
    // WEEKLIES_PATH never shadowed (a parameter default, a let): its six
    // mentions are the declaration, the read, the two writes and the rename;
    // the one let is the text of readWeekliesFile
    check([...wkBare.matchAll(/\bWEEKLIES_PATH\b/g)].length === 6
        && [...wkBare.matchAll(/\b(let|var)\b/g)].length === 1 && wk.includes("\n  let text: string;\n"),
      "WEEKLIES_PATH is declared once and used only as the path of its read, writes and rename",
      `found: ${[...wkBare.matchAll(/\bWEEKLIES_PATH\b/g)].length} mentions`);
    // no word for removing, no array emptied in place, and saveWeeklies
    // writes the state it was given as written
    const save = ((wk.match(/\nfunction saveWeeklies\(all: WeekliesFile\): boolean \{([\s\S]*?)\n\}/) || [null, ""])[1])
      .replace(/\s+/g, " ").trim();
    check(!/\bdelete\b|unlink|\brm\w*\b|truncate|\bsplice\b|\.pop\s*\(|\.shift\s*\(|\.length\s*=(?!=)|\.fill\s*\(|copyWithin/.test(wkBare)
        && save === 'try { fs.writeFileSync(WEEKLIES_PATH + ".tmp", JSON.stringify(all), "utf8"); fs.renameSync(WEEKLIES_PATH + ".tmp", WEEKLIES_PATH); return true; } catch { return false; }',
      "weeklies.ts never deletes or empties a character or a point", `saveWeeklies: ${save}`);
    // checkWeeklies as written: every stored character, own point, counter
    // and last week's counters must come back, detached ones included
    const chk = ((wk.match(/\nexport function checkWeeklies\(next: unknown, stored: WeekliesFile\): WeekliesFile \| null \{([\s\S]*?)\n\}/) || [null, ""])[1])
      .replace(/\s+/g, " ").trim();
    const CHK = "if (!isRec(next) || !only(next, FILE_KEYS) || next.v !== 1) return null;"
      + " if (!Array.isArray(next.profile) || next.profile.length > MAX_PROFILES) return null;"
      + " const profile: Profile[] = []; for (const x of next.profile) { const p = profileOf(x);"
      + " if (!p || profile.some((q) => q.id === p.id)) return null; profile.push(p); }"
      + " if (profile.filter((p) => !p.geloest).length > MAX_ACTIVE) return null;"
      + " const erinnerungen = next.erinnerungen === undefined ? undefined : remindersOf(next.erinnerungen);"
      + " if (erinnerungen === null) return null;"
      + " if (!(stored.erinnerungen ?? []).every((old) => (erinnerungen ?? []).some((r) => r.id === old.id))) return null;"
      + " for (const old of stored.profile) { const p = profile.find((q) => q.id === old.id); if (!p) return null;"
      + " if (!Object.keys(old.zaehler).every((k) => Object.hasOwn(p.zaehler, k))) return null;"
      + " if (!old.eigene.every((e) => p.eigene.some((f) => f.schluessel === e.schluessel))) return null;"
      + " if (old.vorwoche) { const week = p.vorwoche; if (!week || week.reset < old.vorwoche.reset) return null;"
      + " if (week.reset === old.vorwoche.reset && !Object.keys(old.vorwoche.zaehler).every((k) => Object.hasOwn(week.zaehler, k))) return null; } }"
      + " return { v: 1, profile, ...(erinnerungen === undefined ? {} : { erinnerungen }) };";
    check(chk === CHK && [...wkBare.matchAll(/\bcheckWeeklies\b/g)].length === 3,
      "checkWeeklies refuses a state that leaves out a stored character, own point, counter or last week, and keeps detached ones",
      `found: ${chk}`);
    // putWeeklies as written: size first, then the stored state, then
    // checkWeeklies against it, and only its result is saved
    const put = ((wk.match(/export function putWeeklies\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || [null, ""])[1])
      .replace(/\s+/g, " ").trim();
    const PUT = 'const text = JSON.stringify(data); if (typeof text !== "string" || text.length > MAX_TEXT) return "refused";'
      + ' const read = readWeekliesFile(); if ("corrupt" in read) return "unavailable";'
      + ' const clean = checkWeeklies(data, read.data); if (!clean) return "refused";'
      + ' return saveWeeklies(clean) ? "saved" : "unavailable";';
    check(put === PUT && [...wkBare.matchAll(/\bsaveWeeklies\b/g)].length === 2,
      "putWeeklies checks size and schema before it writes, and writes only what checkWeeklies returned", `found: ${put}`);
    check(/^const MAX_TEXT = 262144;$/m.test(wk) && /^const MAX_ACTIVE = 6;$/m.test(wk)
        && [...wkBare.matchAll(/\bMAX_TEXT\b/g)].length === 2 && [...wkBare.matchAll(/\bMAX_ACTIVE\b/g)].length === 2
        && wk.includes("if (profile.filter((p) => !p.geloest).length > MAX_ACTIVE) return null;")
        && ["const MAX_PROFILES = 60;", "const MAX_OWN = 100;", "const MAX_KEYS = 150;", "const MAX_COUNT = 999;", "const AHEAD = 86400000;"]
          .every((l) => wk.split("\n").includes(l))
        && ["MAX_PROFILES", "MAX_OWN", "MAX_KEYS", "MAX_COUNT", "AHEAD"]
          .every((n) => [...wkBare.matchAll(new RegExp(`\\b${n}\\s*=`, "g"))].length === 1),
      "weeklies are capped (MAX_TEXT 262144 characters, MAX_ACTIVE 6 characters not detached, MAX_PROFILES 60, MAX_OWN 100, MAX_KEYS 150, MAX_COUNT 999, AHEAD one day), each bound once");
    const WEEKLIES_STRINGS = new Set(["node:fs", "./paths", "boro-weeklies.json", ".tmp", "utf8", "ENOENT", "wx",
      "woche", "tag", "v", "profile", "id", "name", "geloest", "zaehler", "aus", "namen", "eigene", "vorwoche",
      "schluessel", "menge", "takt", "stand", "seit", "reset",
      "erinnerungen", "zu", "bei", "an", "tage", "zeit", "text", "nurOffen",
      "object", "string", "boolean", "data", "corrupt", "saved", "refused", "unavailable"]);
    const tw = toks["weeklies.ts"];
    const wOdd = tw.error ? ["(not tokenised)"] : tw.strings.filter((x) => !WEEKLIES_STRINGS.has(x)).map((x) => JSON.stringify(x));
    check(!wOdd.length && !(tw.templates > 0), "weeklies.ts holds only its own fixed strings and no template",
      `found: ${wOdd.join(" | ")}${tw.templates ? ` and ${tw.templates} template(s)` : ""}`);
  }
  // only the local server reaches the weeklies: one import line, each name
  // there and in its one call, never handed on as a value
  const wkNames = Object.fromEntries(files.filter((f) => f !== "weeklies.ts")
    .map((f) => [f, [...bare[f].matchAll(/\b(putWeeklies|loadWeeklies|createWeeklies|checkWeeklies|saveWeeklies|WEEKLIES_PATH)\b/g)].length
      + modRefs(f, "weeklies")]));
  const serverBare = bare["server.ts"] ?? "";
  check(Object.entries(wkNames).every(([f, k]) => f === "server.ts" || k === 0)
      && (wk === undefined || (/^import \{ createWeeklies, loadWeeklies, putWeeklies \} from "\.\/weeklies";$/m.test(serverCode)
        && ["putWeeklies", "loadWeeklies", "createWeeklies"]
          .every((n) => [...serverBare.matchAll(new RegExp(`\\b${n}\\b`, "g"))].length === (n === "loadWeeklies" ? 3 : 2))
        && wkNames["server.ts"] === 8)),
    "only the local server imports weeklies.ts, and names createWeeklies and putWeeklies only in that import and one call each, loadWeeklies in it and two calls (the GET and the reminders' reader)",
    `mentions: ${Object.entries(wkNames).filter(([, k]) => k).map(([f, k]) => `${f} ${k}`).join(", ")}`);
  const wkFileNamers = files.filter((f) => f !== "weeklies.ts" && /boro-weeklies\.json/.test(code[f]));
  check(!wkFileNamers.length, "only weeklies.ts names boro-weeklies.json", `found in: ${wkFileNamers}`);
  if (wk !== undefined) {
    // the route: "/api/weeklies" twice (one GET case, one POST case), and no
    // other string of the server names the weeklies
    const ts = toks["server.ts"];
    const wkStrings = ts.error ? ["(not tokenised)"] : ts.strings.filter((x) => /weekl/i.test(x));
    check(wkStrings.filter((x) => x === "/api/weeklies").length === 2
        && wkStrings.every((x) => x === "/api/weeklies" || x === "./weeklies")
        && (getBody ?? "").includes('case "/api/weeklies":') && (postBody ?? "").includes('case "/api/weeklies":'),
      "the weeklies route is /api/weeklies, one GET and one POST case", `found: ${wkStrings.join(" | ")}`);
    const wGet = (((getBody ?? "").match(/case "\/api\/weeklies": \{\n([\s\S]*?)\n    \}/) || [null, ""])[1]).replace(/\s+/g, " ").trim();
    check(wGet === "const weeklies = loadWeeklies(); return weeklies ? reply(res, { ok: true, data: weeklies }) : reply(res, { ok: false }, 503);",
      "/api/weeklies's GET case answers only loadWeeklies(), 503 when it could not read", `found: ${wGet}`);
    const wPost = (((postBody ?? "").match(/case "\/api\/weeklies": \{\n([\s\S]*?)\n    \}/) || [null, ""])[1]).replace(/\s+/g, " ").trim();
    check(wPost === 'const put = putWeeklies(sent.data); return reply(res, { ok: put === "saved" }, put === "saved" ? 200 : put === "refused" ? 400 : 503);',
      "/api/weeklies's POST case calls putWeeklies(sent.data) once and nothing else", `found: ${wPost}`);
    const start = (serverCode.match(/export async function startServer\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || [null, ""])[1];
    check([...serverBare.matchAll(/\bcreateWeeklies\(/g)].length === 1
        && /\n  STATE\.port = port;\n\s*createWeeklies\(\);\n\s*createGilde\(\);\n  return port;$/.test(start),
      "createWeeklies is called once, from startServer, once the server listens", `found in startServer: ${/createWeeklies/.test(start)}`);
  }

  // --- 13b. the guild (boro-gilde.json, spec Gilde 7 and 8, 06.10.2026):
  //          one fixed file in the settings folder that holds player names
  //          the leader typed in himself (a deliberate exception), so
  //          it never leaves this computer. Written only through putGilde()
  //          from a POST after checkGilde() rebuilt the state, or created
  //          empty once on start ("wx"). Never sent anywhere, never emptied.
  //          Section 13's rules once more, and a few more: no other file but
  //          the server and the reminder (gilde-erinnerung.ts) reaches it, and
  //          the ways out of this computer (update.ts, the party)
  //          never name it. The page's side is in auditPage (13b.15).
  //          Rules on gilde-erinnerung.ts (13b.11, 13b.16) hold vacuously
  //          until that file exists (plan Gilde, task 8); a mention of the
  //          guild's names anywhere else fails already.
  const gd = code["gilde.ts"];
  const gdBare = bare["gilde.ts"] ?? "";
  // 13b.1
  check(gd !== undefined && /^export function putGilde\(data: unknown\): PutResult \{$/m.test(gd),
    "gilde.ts is there to audit, with putGilde(data)");
  if (gd !== undefined) {
    const P = "GILDE_PATH", TMP = 'GILDE_PATH + ".tmp"';
    // 13b.2
    const defs = [...gd.matchAll(/\bconst GILDE_PATH\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
    check(defs.length === 1 && defs[0] === 'settingsPath("boro-gilde.json")'
        && /^export const GILDE_PATH = settingsPath\("boro-gilde\.json"\);$/m.test(gd)
        && [...gdBare.matchAll(/\bsettingsPath\b/g)].length === 2,
      "the guild lives in one fixed file in the settings folder (GILDE_PATH defined once, settingsPath imported and used once)",
      `found: ${defs.join(" | ")}`);
    // 13b.3
    check(!/fetchJson|readLog|STATE\.dir|shell\.|\bfetch\b|\bhttps?\b|\bnet\b|\bdns\b|child_process|electron|require\s*\(|import\s*\(|\bprocess\b|\bglobal\b|\bglobalThis\b|\bReflect\b|\bFunction\b/
        .test(gdBare), "gilde.ts reads no log and sends nothing (no fetch, http, net, child_process or electron)");
    // 13b.4
    const IMPORTS = ['import * as fs from "node:fs";', 'import { settingsPath } from "./paths";'];
    const lines = [...gd.matchAll(/^[ \t]*import\b[^\n]*$/gm)].map((m) => m[0].trim());
    const gRest = IMPORTS.reduce((src, line) => src.split(line).join(""), gd);
    const gStray = [...gRest.matchAll(/\bimport\b[^\n]*|\bfrom\s*["'`][^\n]*/g)].map((m) => m[0]);
    check(lines.length === 2 && lines.every((l) => IMPORTS.includes(l)) && new Set(lines).size === 2 && !gStray.length,
      "gilde.ts imports only node:fs and ./paths", `found: ${[...lines, ...gStray].join(" | ")}`);
    // 13b.5: the import line names fs once without a method
    const fsMentions = [...gdBare.matchAll(/\bfs\b[.\w]*/g)].map((m) => m[0]);
    const fsCalls = [...gdBare.matchAll(/\bfs\.(readFileSync|writeFileSync|renameSync)\(/g)].length;
    check(fsMentions.filter((m) => m === "fs").length === 1 && fsCalls === fsMentions.length - 1 && fsCalls === 4,
      "gilde.ts uses node:fs only to read, write and rename (no delete, descriptor, copy or stream)",
      `found: ${fsMentions.join(" | ")}`);
    // 13b.6: one read, two writes, one rename - and GILDE_PATH never shadowed
    // (a parameter default, a let): its six mentions are the declaration, the
    // read, the two writes and the two of the rename; the one let is the text
    // of readGildeFile
    const ops = [...gd.matchAll(/\bfs\.(readFileSync|writeFileSync)\(\s*([^,)]+)/g)];
    const renames = [...gd.matchAll(/\bfs\.renameSync\(([^)]*)\)/g)];
    check(ops.length === 3 && ops.every((m) => [P, TMP].includes(m[2].trim()))
        && gd.split('fs.readFileSync(GILDE_PATH, "utf8")').length === 2
        && renames.length === 1 && renames[0][1].trim() === TMP + ", " + P
        && [...gdBare.matchAll(/\bGILDE_PATH\b/g)].length === 6
        && [...gdBare.matchAll(/\b(let|var)\b/g)].length === 1 && gd.includes("\n  let text: string;\n"),
      "gilde.ts reads and writes only GILDE_PATH and its temp file, and renames only its own temp file onto GILDE_PATH",
      `found: ${[...ops, ...renames].map((m) => m[0]).join(" | ")}; GILDE_PATH ${[...gdBare.matchAll(/\bGILDE_PATH\b/g)].length}x`);
    // 13b.7: the two writes as written - the whole state into the temp file,
    // and the empty file on the first start, only when there is none
    const writes = [...gd.matchAll(/\bfs\.writeFileSync\([^;]*;/g)].map((m) => m[0]);
    check(writes.length === 2
        && writes[0] === 'fs.writeFileSync(GILDE_PATH + ".tmp", JSON.stringify(all), "utf8");'
        && writes[1] === 'fs.writeFileSync(GILDE_PATH, JSON.stringify(empty()), { encoding: "utf8", flag: "wx" });'
        && /\nexport function createGilde\(\): void \{\n  try \{\n    fs\.writeFileSync\(GILDE_PATH, JSON\.stringify\(empty\(\)\), \{ encoding: "utf8", flag: "wx" \}\);\n  \} catch \{/.test(gd)
        && /^const empty = \(\): GildeFile => \(\{ v: 1, gilde: null \}\);$/m.test(gd),
      "the guild file is written whole through its temp file, or created once (empty) and never over a file that is there",
      `found: ${writes.join(" | ")}`);
    // 13b.8: no word for removing, no array emptied in place, nothing of the
    // stored state assigned to; saveGilde writes the state it was given as
    // written; checkGilde refuses a state that leaves out anything stored
    const save = ((gd.match(/\nfunction saveGilde\(all: GildeFile\): boolean \{([\s\S]*?)\n\}/) || [null, ""])[1])
      .replace(/\s+/g, " ").trim();
    check(!/\bdelete\b|unlink|\brm\w*\b|truncate|\bsplice\b|\.pop\s*\(|\.shift\s*\(|\.length\s*=(?!=)|\.fill\s*\(|copyWithin|Object\.assign/.test(gdBare)
        && !/\b(?:stored|old|read\.data)(?:\s*\.\s*\w+|\s*\[[^\]]*\])+\s*(?:[-+*/%&|^]|\?\?|&&|\|\|)?=(?!=)/.test(gdBare)
        && !/(?<!\bconst\s+)\b(?:stored|old)\s*(?:[-+*/%&|^]|\?\?|&&|\|\|)?=(?!=)/.test(gdBare)
        && save === 'try { fs.writeFileSync(GILDE_PATH + ".tmp", JSON.stringify(all), "utf8"); fs.renameSync(GILDE_PATH + ".tmp", GILDE_PATH); return true; } catch { return false; }',
      "saveGilde never deletes or empties: no delete, no splice, nothing of the stored state assigned", `saveGilde: ${save}`);
    const chk = ((gd.match(/\nexport function checkGilde\(next: unknown, stored: GildeFile\): GildeFile \| null \{([\s\S]*?)\n\}/) || [null, ""])[1])
      .replace(/\s+/g, " ").trim();
    const CHK = "if (!isRec(next) || !only(next, FILE_KEYS) || next.v !== 1) return null;"
      + " if (next.gilde === null) return stored.gilde ? null : empty();"
      + " const g = gildeOf(next.gilde); if (!g) return null; const old = stored.gilde;"
      + " if (old) { if (old.id !== g.id) return null;"
      + " if (!old.mitglieder.every((m) => g.mitglieder.some((n) => n.id === m.id))) return null;"
      + " for (const r of old.reihen) { const n = g.reihen.find((q) => q.id === r.id);"
      + " if (!n || !Object.keys(r.ausnahmen).every((d) => Object.hasOwn(n.ausnahmen, d))) return null; }"
      + " for (const [k, v] of Object.entries(old.anwesend)) { const n = g.anwesend[k];"
      + " if (!n || !Object.keys(v).every((mid) => Object.hasOwn(n, mid))) return null; } }"
      + " return { v: 1, gilde: g };";
    check(chk === CHK && [...gdBare.matchAll(/\bcheckGilde\b/g)].length === 3,
      "checkGilde refuses a state that leaves out the stored guild, a member, a series, an exception or a mark, and keeps detached ones",
      `found: ${chk}`);
    // putGilde as written: size first, then the stored state, then checkGilde
    // against it, and only its result is saved
    const put = ((gd.match(/export function putGilde\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || [null, ""])[1])
      .replace(/\s+/g, " ").trim();
    const PUT = 'const text = JSON.stringify(data); if (typeof text !== "string" || text.length > MAX_TEXT) return "refused";'
      + ' const read = readGildeFile(); if ("corrupt" in read) return "unavailable";'
      + ' const clean = checkGilde(data, read.data); if (!clean) return "refused";'
      + ' return saveGilde(clean) ? "saved" : "unavailable";';
    check(put === PUT && [...gdBare.matchAll(/\bsaveGilde\b/g)].length === 2,
      "putGilde checks size and schema before it writes, and writes only what checkGilde returned", `found: ${put}`);
    // 13b.9: the bounds, each defined once and used where it bounds
    const BOUNDS = { MAX_TEXT: ["2097152", 2], MAX_MITGLIEDER: ["100", 3], MAX_REIHEN: ["20", 2], MAX_TERMINE: ["4000", 2] };
    check(Object.entries(BOUNDS).every(([n, [v, k]]) => gd.split("\n").filter((l) => l === `const ${n} = ${v};`).length === 1
          && [...gdBare.matchAll(new RegExp(`\\b${n}\\s*=(?!=)`, "g"))].length === 1
          && [...gdBare.matchAll(new RegExp(`\\b${n}\\b`, "g"))].length === k)
        && gd.includes("x.mitglieder.length > MAX_MITGLIEDER || !Array.isArray(x.reihen) || x.reihen.length > MAX_REIHEN) return null;")
        && gd.includes("if (!isRec(x.anwesend) || Object.keys(x.anwesend).length > MAX_TERMINE) return null;")
        && gd.includes("Object.keys(v).length > MAX_MITGLIEDER) return null;"),
      "the guild is capped (MAX_TEXT 2097152 characters, MAX_MITGLIEDER 100, MAX_REIHEN 20, MAX_TERMINE 4000), each bound once");
    // 13b.10
    const GILDE_STRINGS = new Set(["node:fs", "./paths", "boro-gilde.json", ".tmp", "utf8", "ENOENT", "wx",
      "tank", "heal", "dps", "", "da", "fehlt", "entschuldigt", "offen", "einmal", "woche", "tage",
      "v", "gilde", "id", "name", "geloest", "mitglieder", "reihen", "anwesend", "rolle", "waffen", "notiz",
      "Greatsword", "Sword and Shield", "Dagger", "Crossbow", "Longbow", "Staff", "Wand and Tome", "Spear", "Gauntlet", "Orb",
      "titel", "start", "zone", "wdh", "dauerMin", "erinnerungMin", "ausnahmen", "art", "bis", "aus", "zeit",
      "m", "r", "g", "object", "string", "boolean", "data", "corrupt", "saved", "refused", "unavailable"]);
    const tg = toks["gilde.ts"];
    const gOdd = tg.error ? ["(not tokenised)"] : tg.strings.filter((x) => !GILDE_STRINGS.has(x)).map((x) => JSON.stringify(x));
    check(!gOdd.length && !(tg.templates > 0), "gilde.ts holds only its own fixed strings and no template",
      `found: ${gOdd.join(" | ")}${tg.templates ? ` and ${tg.templates} template(s)` : ""}`);
  }
  // 13b.11: only the local server reaches the guild: one import line, each
  // name there and in its one call, never handed on as a value. The one
  // exception is the reminder (gilde-erinnerung.ts, plan task 8): it may
  // import loadGilde alone, in one line, and call it once - it only reads.
  // Until that file exists, the exception is not used.
  const gdNames = Object.fromEntries(files.filter((f) => f !== "gilde.ts")
    .map((f) => [f, [...bare[f].matchAll(/\b(putGilde|loadGilde|createGilde|checkGilde|saveGilde|readGildeFile|GILDE_PATH)\b/g)].length
      + modRefs(f, "gilde")]));
  const gdServerBare = bare["server.ts"] ?? "";
  const reminder = code["gilde-erinnerung.ts"];
  const reminderBare = bare["gilde-erinnerung.ts"] ?? "";
  check(Object.entries(gdNames).every(([f, k]) => f === "server.ts" || f === "gilde-erinnerung.ts" || k === 0)
      && (gd === undefined || (/^import \{ createGilde, loadGilde, putGilde \} from "\.\/gilde";$/m.test(serverCode)
        && ["putGilde", "loadGilde", "createGilde"]
          .every((n) => [...gdServerBare.matchAll(new RegExp(`\\b${n}\\b`, "g"))].length === 2)
        && [...gdServerBare.matchAll(/\bcreateGilde\(\);/g)].length === 1
        && gdNames["server.ts"] === 7))
      && (reminder === undefined || ([...reminder.matchAll(/^[^\n]*\bfrom\s*["'`][^"'`\n]*\bgilde["'`][^\n]*$/gm)].length === 1
        && /^import \{ loadGilde \} from "\.\/gilde";$/m.test(reminder)
        && [...reminderBare.matchAll(/\bloadGilde\b/g)].length === 2
        && [...reminderBare.matchAll(/\bloadGilde\(\)/g)].length === 1
        && gdNames["gilde-erinnerung.ts"] === 3)),
    "only the local server imports gilde.ts, and names createGilde, loadGilde and putGilde only in that import and one call each (the reminder: loadGilde alone, read once)",
    `mentions: ${Object.entries(gdNames).filter(([, k]) => k).map(([f, k]) => `${f} ${k}`).join(", ")}`);
  // 13b.12
  const gdFileNamers = files.filter((f) => f !== "gilde.ts" && /boro-gilde\.json/i.test(code[f]));
  check(!gdFileNamers.length, "only gilde.ts names boro-gilde.json", `found in: ${gdFileNamers}`);
  // 13b.13: the route - "/api/gilde" twice (one GET case, one POST case), the
  // module's path once, the reminder's settings key twice (CONFIG_KEYS and
  // BOOLEAN_KEYS), and no other string of the server names the guild
  if (gd !== undefined) {
    const ts = toks["server.ts"];
    const gdStrings = ts.error ? ["(not tokenised)"] : ts.strings.filter((x) => /gilde/i.test(x));
    const many = (x) => gdStrings.filter((y) => y === x).length;
    check(many("/api/gilde") === 2 && many("./gilde") === 1 && many("gildeErinnerung") === 2 && gdStrings.length === 5
        && (getBody ?? "").split('case "/api/gilde":').length === 2 && (postBody ?? "").split('case "/api/gilde":').length === 2,
      "the guild route is /api/gilde, one GET and one POST case, and no other string of the server names the guild",
      `found: ${gdStrings.join(" | ")}`);
    const gGet = (((getBody ?? "").match(/case "\/api\/gilde": \{\n([\s\S]*?)\n    \}/) || [null, ""])[1]).replace(/\s+/g, " ").trim();
    check(gGet === "const gilde = loadGilde(); return gilde ? reply(res, { ok: true, data: gilde }) : reply(res, { ok: false }, 503);",
      "/api/gilde's GET case answers only loadGilde(), 503 when it could not read", `found: ${gGet}`);
    const gPost = (((postBody ?? "").match(/case "\/api\/gilde": \{\n([\s\S]*?)\n    \}/) || [null, ""])[1]).replace(/\s+/g, " ").trim();
    check(gPost === 'const put = putGilde(sent.data); return reply(res, { ok: put === "saved" }, put === "saved" ? 200 : put === "refused" ? 400 : 503);',
      "/api/gilde's POST case calls putGilde(sent.data) once and nothing else", `found: ${gPost}`);
    const gStart = (serverCode.match(/export async function startServer\([^)]*\)[^{]*\{([\s\S]*?)\n\}/) || [null, ""])[1];
    check([...gdServerBare.matchAll(/\bcreateGilde\(/g)].length === 1
        && /\n  STATE\.port = port;\n\s*createWeeklies\(\);\n\s*createGilde\(\);\n  return port;$/.test(gStart),
      "createGilde is called once, from startServer, once the server listens", `found in startServer: ${/createGilde/.test(gStart)}`);
  }
  // 13b.14: nothing leaves this computer. No file but gilde.ts, the reminder
  // and the server names loadGilde or GILDE_PATH, and the ways out - the
  // update notice, the party and its HTTP helper - never name the guild, in
  // any case, not even in a string. The fourth way out, questlog.ts, left
  // with #207; rule 14 keeps it gone, and should it ever come back it is
  // held to this rule too (decision of 07.10.2026).
  const gdReaders = files.filter((f) => !["gilde.ts", "gilde-erinnerung.ts", "server.ts"].includes(f)
    && /\b(?:loadGilde|GILDE_PATH)\b/.test(code[f]));
  const OUTWARD = ["update.ts", "party.ts", "http.ts"];
  const gdOutward = [...OUTWARD, "questlog.ts"].filter((f) => /gilde/i.test(code[f] ?? ""));
  check(!gdReaders.length && !gdOutward.length && OUTWARD.every((f) => code[f] !== undefined),
    "nothing leaves this computer with the guild: update.ts, party.ts and http.ts never name it, and no file but gilde.ts, the reminder and the server reads it",
    `found in: ${[...gdReaders, ...gdOutward].join(", ")}`);
  // 13b.16: the reminder (plan task 8) shows a Notification from electron and
  // reaches nothing else: it imports no node: module, names no electron way
  // but Notification (and BrowserWindow, for the window it raises), and no
  // fetch, http, https, net, dns, child_process or shell. Holds vacuously
  // until gilde-erinnerung.ts exists.
  if (reminder !== undefined) {
    const eNames = [...reminder.matchAll(/^import \{([^}]*)\} from "electron";$/gm)].flatMap((m) => m[1].split(",").map((x) => x.trim()).filter(Boolean));
    const rStrings = toks["gilde-erinnerung.ts"].strings ?? [];
    check(eNames.includes("Notification") && eNames.every((n) => n === "Notification" || n === "BrowserWindow")
        && [...reminder.matchAll(/\bfrom\s*"electron"/g)].length === 1
        && !rStrings.some((s) => /^node:|^(?:https?|net|dns|child_process|electron\/)/.test(s))
        && !/\bfetch\b|\bhttps?\b|\bnet\b|\bdns\b|child_process|\bshell\b|require\s*\(|import\s*\(|WebSocket|EventSource|XMLHttpRequest/.test(reminderBare),
      "the guild reminder uses electron's Notification and nothing that reaches the network (no fetch, http, https, net, dns, child_process or shell)",
      `electron: ${eNames.join(", ")}`);
  }

  // --- 14. the update notice (spec Update-Hinweis, decided on
  //         02.10.2026): the third way out of this computer, beside the
  //         party and Questlog, and the only one that asks on its own - so
  //         only when the player turned it on, once per start. update.ts
  //         asks UPDATE_URL only, by one GET without cookies or redirects,
  //         5 s, 256 KB, and reads tag_name and html_url and nothing else.
  //         main.ts calls it in one fixed line behind startServer; no page
  //         request reaches it, and what it found waits in server.ts for
  //         GET /api/state. update.ts imports nothing and touches no file,
  //         log or setting. Checks on calls and names read `bare`, on fixed
  //         text `code` (as in 12 and 13).
  const up = code["update.ts"];
  const upBare = bare["update.ts"] ?? "";
  const UP_URL = "https://api.github.com/repos/B0R0AK/Borometer/releases/latest";
  const UP_PAGE = "https://github.com/B0R0AK/Borometer/releases/tag/";
  // 14.1
  check(up !== undefined && /^export async function checkUpdate\(current: string, net: Net = realNet\): Promise<UpdateInfo \| null> \{$/m.test(up),
    "update.ts is there to audit, with checkUpdate(current, net = realNet)");
  // 14.3: in main, the two GitHub names stand only in update.ts
  const ghNamers = files.filter((f) => f !== "update.ts" && /api\.github\.com|github\.com\/B0R0AK/i.test(code[f]));
  check(!ghNamers.length, "only update.ts names api.github.com or github.com/B0R0AK", `found in: ${ghNamers}`);
  if (up !== undefined) {
    // 14.2: the one address and the release page prefix, each bound once
    const hosts = [...up.matchAll(/https?:\/\/[^"'`\s)]*/g)].map((m) => m[0]);
    check(/^export const UPDATE_URL = "https:\/\/api\.github\.com\/repos\/B0R0AK\/Borometer\/releases\/latest";$/m.test(up)
        && /^const PAGE_PREFIX = "https:\/\/github\.com\/B0R0AK\/Borometer\/releases\/tag\/";$/m.test(up)
        && [...upBare.matchAll(/\bUPDATE_URL\b/g)].length === 2 && [...upBare.matchAll(/\bPAGE_PREFIX\b/g)].length === 2
        && JSON.stringify(hosts) === JSON.stringify([UP_URL, UP_PAGE]),
      "UPDATE_URL is exactly " + UP_URL + ", and update.ts names no other address but the release page prefix",
      `found: ${hosts.join(" | ")}`);
    // and no address put together: only its own fixed strings, no template
    const UPDATE_STRINGS = new Set([UP_URL, UP_PAGE, "GET", "omit", "error", "application/vnd.github+json", "0",
      "string", "object", ".", "", "body"]);
    const tu = toks["update.ts"];
    const uOdd = tu.error ? ["(not tokenised)"] : tu.strings.filter((x) => !UPDATE_STRINGS.has(x)).map((x) => JSON.stringify(x));
    check(!uOdd.length && !(tu.templates > 0), "update.ts holds only its own fixed strings and no template",
      `found: ${uOdd.join(" | ")}${tu.templates ? ` and ${tu.templates} template(s)` : ""}`);
    // 14.5: the one fetch, in realNet, with exactly these options (sorted);
    // realNet is only the default of net, and net is called once, with UPDATE_URL
    const topLevel = (s) => {
      const out = [];
      let depth = 0, from = 0;
      for (let i = 0; i < s.length; i++) {
        if ("({[".includes(s[i])) depth++;
        else if (")}]".includes(s[i])) depth--;
        else if (s[i] === "," && depth === 0) { out.push(s.slice(from, i)); from = i + 1; }
      }
      out.push(s.slice(from));
      return out.map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
    };
    const realNetDef = [...up.matchAll(/^const realNet: Net = \(url\) =>\s*fetch\(url, \{([^\n]*)\}\);$/gm)];
    const upOpts = realNetDef.length === 1 ? topLevel(realNetDef[0][1]).sort() : [];
    const UP_OPTS = ['credentials: "omit"', 'headers: { Accept: "application/vnd.github+json" }', 'method: "GET"',
      'redirect: "error"', "signal: AbortSignal.timeout(TIMEOUT_MS)"];
    check(realNetDef.length === 1 && JSON.stringify(upOpts) === JSON.stringify(UP_OPTS)
        && [...upBare.matchAll(/\bfetch\b/g)].length === 1 && [...upBare.matchAll(/\brealNet\b/g)].length === 2
        && [...upBare.matchAll(/\bnet\b/g)].length === 2 && [...upBare.matchAll(/\bnet\(/g)].length === 1
        && /\n    const res = await net\(UPDATE_URL\);\n/.test(up),
      "update.ts fetches once, only GET to UPDATE_URL, without credentials or redirects, with one Accept header",
      `options: ${upOpts.join(", ")}`);
    // 14.6: the limits as written, each bound once and used once
    const limitSets = [...upBare.matchAll(/\b(?:TIMEOUT_MS|MAX_BYTES)\s*(?:[-+*/%&|^]|\*\*|<<|>>>?|&&|\|\||\?\?)?=(?![=>])|(?:\+\+|--)\s*(?:TIMEOUT_MS|MAX_BYTES)\b|\b(?:TIMEOUT_MS|MAX_BYTES)\s*(?:\+\+|--)/g)];
    check(/^const TIMEOUT_MS = 5000;$/m.test(up) && /^const MAX_BYTES = 256 \* 1024;$/m.test(up) && limitSets.length === 2
        && [...upBare.matchAll(/\bTIMEOUT_MS\b/g)].length === 2 && [...upBare.matchAll(/\bMAX_BYTES\b/g)].length === 2
        && /\n    if \(size > MAX_BYTES\) \{\n/.test(up),
      "update.ts caps time (TIMEOUT_MS = 5000) and size (MAX_BYTES = 256 * 1024), each bound once",
      `assignments: ${limitSets.map((m) => m[0]).join(" | ")}`);
    // 14.7: of the answer only tag_name and html_url are read - parseRelease
    // as written, and the body reaches nothing else: readCapped and
    // checkUpdate as written too
    const fnText = (head) => ((up.match(new RegExp("\\n" + head + "[^{]*\\{([\\s\\S]*?)\\n\\}")) || [null, ""])[1]).replace(/\s+/g, " ").trim();
    const PARSE = "let body: unknown; try { body = JSON.parse(text); } catch { return null; }"
      + ' if (!body || typeof body !== "object" || Array.isArray(body)) return null;'
      + " const tag = (body as { tag_name?: unknown }).tag_name;"
      + " const url = (body as { html_url?: unknown }).html_url;"
      + ' if (typeof tag !== "string" || !TAG_RX.test(tag)) return null;'
      + ' if (typeof url !== "string" || url !== PAGE_PREFIX + tag) return null;'
      + " return { tag, url };";
    const READ = "const reader = stream.getReader(); const decoder = new TextDecoder(); let size = 0; let text = \"\";"
      + " for (;;) { const piece = await reader.read(); if (piece.done) return text + decoder.decode();"
      + " size += piece.value.byteLength; if (size > MAX_BYTES) { void reader.cancel().catch(() => undefined); return null; }"
      + " text += decoder.decode(piece.value, { stream: true }); }";
    const CHECK = "try { const res = await net(UPDATE_URL); if (res.status !== 200 || !res.body) return null;"
      + " const text = await readCapped(res.body); if (text === null) return null;"
      + " const found = parseRelease(text); if (!found || !isNewer(found.tag, current)) return null;"
      + " return { version: shown(found.tag), url: found.url }; } catch { return null; }";
    const parse = fnText("export function parseRelease\\(text: string\\): \\{ tag: string; url: string \\} \\| null");
    const read = fnText("async function readCapped\\(stream: NonNullable<Response\\[\"body\"\\]>\\): Promise<string \\| null>");
    const chk = fnText("export async function checkUpdate\\(current: string, net: Net = realNet\\): Promise<UpdateInfo \\| null>");
    check(parse === PARSE && read === READ && chk === CHECK
        && [...upBare.matchAll(/\bJSON\b/g)].length === 1 && [...upBare.matchAll(/\b(?:parseRelease|readCapped)\b/g)].length === 4
        && [...up.matchAll(/\b(?:tag_name|html_url)\b/g)].length === 4,
      "update.ts reads only tag_name and html_url of the answer (parseRelease, readCapped and checkUpdate as written)",
      `parseRelease: ${parse === PARSE ? "as written" : parse}; readCapped: ${read === READ ? "as written" : read}; checkUpdate: ${chk === CHECK ? "as written" : chk}`);
    // 14.7, made tight (security review M2): html_url is safe only because
    // the tag is digits and dots - TAG_RX as written (no .*, no flag), bound
    // once and used in numbers() and parseRelease() only, and the version
    // compare and the shown version as written
    const TAG_RX_LINE = "const TAG_RX = /^v?(\\d{1,3})\\.(\\d{1,3})(?:\\.(\\d{1,3}))?$/;";
    const NUMBERS = 'const m = TAG_RX.exec(v); return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? "0")] : null;';
    const NEWER = "const a = numbers(tag); const b = numbers(current); if (!a || !b) return false;"
      + " for (let i = 0; i < 3; i++) { if (a[i]! !== b[i]!) return a[i]! > b[i]!; } return false;";
    const SHOWN = 'const n = numbers(tag)!; return n[0] + "." + n[1] + (n[2] ? "." + n[2] : "");';
    const nums = fnText("function numbers\\(v: string\\): number\\[\\] \\| null");
    const newer = fnText("export function isNewer\\(tag: string, current: string\\): boolean");
    const shownBody = fnText("function shown\\(tag: string\\): string");
    check(up.split("\n").filter((l) => l === TAG_RX_LINE).length === 1 && [...upBare.matchAll(/\bTAG_RX\b/g)].length === 3
        && nums === NUMBERS && newer === NEWER && shownBody === SHOWN
        && [...upBare.matchAll(/\b(?:numbers|isNewer|shown)\b/g)].length === 8,
      "update.ts holds the tag to digits and dots (TAG_RX as written) and compares versions as written (numbers, isNewer, shown)",
      `TAG_RX: ${up.split("\n").filter((l) => /\bTAG_RX\s*=/.test(l)).join(" | ")}; numbers: ${nums === NUMBERS ? "as written" : nums}; `
      + `isNewer: ${newer === NEWER ? "as written" : newer}; shown: ${shownBody === SHOWN ? "as written" : shownBody}`);
    // 14.8: imports nothing, touches no file, log or setting
    const upImports = [...up.matchAll(/^[ \t]*import\b[^\n]*$/gm)].map((m) => m[0]);
    const upTouches = upBare.match(/\bimport\b|\bfrom\b|\bfs\b|readLog|fetchJson|\bSTATE\b|\bshell\b|\brequire\b|\bprocess\b|\bglobal\b|\bglobalThis\b|\bReflect\b|\bFunction\b|\bconsole\b|\b(?:load|update|save)Config\b|\bsetTimeout\b|\bsetInterval\b/g) || [];
    check(!upImports.length && !upTouches.length,
      "update.ts imports nothing and touches no file, log or setting", `found: ${[...upImports, ...upTouches].join(" | ")}`);
  }
  // 14.9: checkUpdate is called once, from main.ts, in one fixed line behind
  // startServer, and only when updatePruefen is strictly true
  const UPDATE_LINE = "if (loadConfig().updatePruefen === true) void checkUpdate(app.getVersion()).then(setUpdate);";
  const upNames = Object.fromEntries(files.filter((f) => f !== "update.ts")
    .map((f) => [f, [...bare[f].matchAll(/\b(?:checkUpdate|parseRelease|isNewer|UPDATE_URL)\b/g)].length + modRefs(f, "update")]));
  const mainLines = mainTs.split("\n").filter((l) => /\bcheckUpdate\b|\bupdatePruefen\b/.test(l)).map((l) => l.trim());
  check(Object.entries(upNames).every(([f, k]) => (f === "main.ts" ? k === 3 : k === 0))
      && /^import \{ checkUpdate \} from "\.\/update";$/m.test(mainTs)
      && JSON.stringify(mainLines) === JSON.stringify(['import { checkUpdate } from "./update";', UPDATE_LINE])
      && /\n  const port = await startServer\(pagePath\(\)\);\n/.test(mainTs)
      && new RegExp("\\n  console\\.log\\(`Install: [^\\n]*\\n(?:[ \\t]*\\n)*  " + UPDATE_LINE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\n").test(mainTs)
      && mainTs.indexOf("const port = await startServer(pagePath());") < mainTs.indexOf(UPDATE_LINE),
    "checkUpdate is called once, from main.ts behind startServer, only when updatePruefen is strictly true",
    `mentions: ${Object.entries(upNames).filter(([, k]) => k).map(([f, k]) => `${f} ${k}`).join(", ")}; main.ts: ${mainLines.join(" | ")}`);
  // 14.9, made tight (security review M1): "once per start" - the line is a
  // statement of its own on the top level of main(), right behind the
  // Install line as written: no loop, timer, callback or retry around it,
  // and main() itself is named twice only (defined, called once)
  const mainB = bare["main.ts"] ?? "";
  const INSTALL_LINE = '  console.log(`Install:    ${app.isPackaged ? (INSTALLED ? "installed" : "portable") : "development"}`);';
  const MAIN_HEAD = "async function main(): Promise<void> {";
  const mainAt = mainTs.indexOf(MAIN_HEAD), lineAt = mainTs.indexOf("\n  " + UPDATE_LINE + "\n");
  const tiefe = { brace: -1, paren: -1, bracket: -1 };
  let mainEnde = -1;
  if (mainAt >= 0 && lineAt > mainAt) {
    let d = 1;
    for (let i = mainAt + MAIN_HEAD.length; i < mainB.length; i++) {
      if (i === lineAt) tiefe.brace = d;
      if (mainB[i] === "{") d++;
      else if (mainB[i] === "}" && --d === 0) { mainEnde = i; break; }
    }
    const zwischen = mainB.slice(mainAt + MAIN_HEAD.length, lineAt);
    const zahl = (rx) => [...zwischen.matchAll(rx)].length;
    tiefe.paren = zahl(/\(/g) - zahl(/\)/g);
    tiefe.bracket = zahl(/\[/g) - zahl(/\]/g);
  }
  const vorher = mainTs.slice(0, Math.max(0, lineAt + 1)).split("\n").filter((l) => l.trim()).at(-1) ?? "";
  check(mainAt >= 0 && lineAt > mainAt && lineAt < mainEnde && tiefe.brace === 1 && tiefe.paren === 0 && tiefe.bracket === 0
      && vorher === INSTALL_LINE && mainTs.split(INSTALL_LINE + "\n").length === 2
      && [...mainB.matchAll(/\bmain\b/g)].length === 2 && /\n  main\(\)\.catch\(/.test(mainTs),
    "the update check stands once on the top level of main(), right behind the Install line - no loop, timer or callback around it, and main() runs once",
    `depth: ${JSON.stringify(tiefe)}; line before: ${vorher.trim()}; main named ${[...mainB.matchAll(/\bmain\b/g)].length}x`);
  // 14.10: no page request reaches it - setUpdate is defined in server.ts
  // and called only from main.ts; what it holds is set there alone and only
  // read by GET /api/state
  const serverB = bare["server.ts"] ?? "";
  const setUpNames = Object.fromEntries(files.map((f) => [f, [...bare[f].matchAll(/\bsetUpdate\b/g)].length]).filter(([, n]) => n));
  const SET_UPDATE = "export function setUpdate(found: { version: string; url: string } | null): void {\n  UPDATE = found;\n}";
  check(JSON.stringify(setUpNames) === JSON.stringify({ "main.ts": 2, "server.ts": 1 })
      && /^import \{ logDir, setUpdate, startServer \} from "\.\/server";$/m.test(mainTs)
      && serverCode.split(SET_UPDATE).length === 2
      && /\nlet UPDATE: \{ version: string; url: string \} \| null = null;\n/.test(serverCode)
      && [...serverB.matchAll(/\bUPDATE\b/g)].length === 3 && (getBody ?? "").includes("\n        update: UPDATE,\n")
      && !/\bcheckUpdate\b|\bsetUpdate\b/.test((getBody ?? "") + (postBody ?? "")),
    "no GET or POST case reaches checkUpdate or setUpdate; what the check found is set once and only read by GET /api/state",
    `setUpdate named: ${JSON.stringify(setUpNames)}`);
  // 14.11: the switch is a key the page may write, only as true or false
  // (3.5 holds BOOLEAN_KEYS word for word), and reads as off unless true
  const cfgGet = ((getBody ?? "").match(/case "\/api\/config": \{([\s\S]*?)\n    \}/) || [null, ""])[1];
  check(configKeys.includes('"updatePruefen"') && /^const BOOLEAN_KEYS = \[[^\]\n]*"updatePruefen"[^\]\n]*\];$/m.test(serverCode)
      && cfgGet.includes("\n        updatePruefen: cfg.updatePruefen === true,\n")
      && files.every((f) => [...bare[f].matchAll(/\bupdatePruefen\b/g)].length === (f === "main.ts" ? 1 : f === "server.ts" ? 2 : 0))
      && [...(toks["server.ts"].strings ?? [])].filter((x) => x === "updatePruefen").length === 2,
    "updatePruefen is written only as true or false (BOOLEAN_KEYS) and read as off unless it is true",
    `keys: ${configKeys.join(" ")}`);
}

async function auditPage() {
  // what esbuild bundles into the page is whatever src/renderer/main.ts
  // reaches by import - the parts in app/, and main.ts, types.ts and the
  // cores beside it - while the rules below read only the top of app/: a
  // part in a folder below, or a file the page imports from outside
  // src/renderer, would be bundled and never audited (as in src/main,
  // Gutachten Update-Hinweis, 02.10.2026). So both folders hold only what
  // the page is made of, no further folder, and every import stays among
  // the files read here.
  const appEntries = readdirSync(pageDir, { withFileTypes: true });
  const outerEntries = readdirSync(rendererDir, { withFileTypes: true });
  const strayEntries = [
    ...appEntries.filter((e) => !e.isFile() || !(e.name.endsWith(".ts") || e.name === "README.md"))
      .map((e) => "app/" + e.name + (e.isDirectory() ? "/" : "")),
    ...outerEntries.filter((e) => !(e.isDirectory() && e.name === "app")
        && !(e.isFile() && (e.name.endsWith(".ts") || e.name === "index.html" || e.name === "styles.css")))
      .map((e) => e.name + (e.isDirectory() ? "/" : "")),
  ];
  check(!strayEntries.length,
    "src/renderer holds the page's .ts files, index.html, styles.css and app/ (.ts parts and README.md) - no further folder",
    `found: ${strayEntries.join(", ")}`);
  const outer = Object.fromEntries(outerEntries.filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => ["../" + e.name, readFileSync(join(rendererDir, e.name), "utf8")]));
  // the page script, all of its parts and the files beside them
  const src = [...readdirSync(pageDir).filter((f) => f.endsWith(".ts"))
    .map((f) => readFileSync(join(pageDir, f), "utf8")), ...Object.values(outer)].join("\n");
  check(src.length > 0, "the page script has parts to audit");
  // what the bundle is made of, asked of esbuild itself with the build's own
  // entry: every input must be one of the files read here - no package, no
  // file outside src/renderer - and no part loads anything at run time
  // (import() or require, which esbuild would leave to the page). It bundles
  // as the build does, through the image switch (section 15): the one file
  // outside these, then, is the one the switch takes for ../spielbilder in
  // this mode - assets/spielbilder.ts with the images, src/renderer's empty
  // one without - and it must be in the bundle, read by the rules of 15.
  {
    const own = [...appEntries.filter((e) => e.isFile() && e.name.endsWith(".ts")).map((e) => "app/" + e.name),
      ...Object.keys(outer).map((f) => f.slice(3))];
    // the files read here, compared exactly as esbuild names them (as before
    // section 15): on a case-sensitive CI a name in another case is another file
    const known = new Set(own);
    // only the switch's file is compared as a path, and without case only where
    // the file system ignores it
    const fold = (p) => (process.platform === "win32" ? p.toLowerCase() : p);
    let inputs = null;
    let switched = null;
    let imports = [];
    let why = "";
    if (!esbuild) why = "esbuild is not installed";
    else if (!weiche) why = "scripts/bilder-weiche.mjs does not load";
    else {
      try {
        const modus = weiche.bilderModus(root);
        switched = fold(resolve(root, modus === "voll" ? "assets/spielbilder.ts" : "src/renderer/spielbilder.ts"));
        const r = await esbuild.build({ entryPoints: ["main.ts"], absWorkingDir: rendererDir, bundle: true, write: false,
          metafile: true, format: "iife", logLevel: "silent", tsconfigRaw: { compilerOptions: { alwaysStrict: false } },
          plugins: [weiche.bilderPlugin(root, modus)] });
        inputs = Object.keys(r.metafile.inputs);
        imports = Object.entries(r.metafile.inputs).flatMap(([f, x]) => x.imports.map((i) => [f, i]));
      } catch (e) { why = "the bundle does not build: " + (e.errors?.[0]?.text ?? String(e.message ?? e).split("\n")[0]); }
    }
    const at = (f) => fold(resolve(rendererDir, f));
    const foreign = (inputs ?? []).filter((f) => !known.has(f) && at(f) !== switched);
    if (inputs && !inputs.some((f) => at(f) === switched)) foreign.push("(the image switch's file is not in the bundle)");
    // and it comes in only through the switch: as "../spielbilder", never by another path
    foreign.push(...imports.filter(([, i]) => at(i.path) === switched && i.original !== "../spielbilder")
      .map(([f, i]) => `${f}: ${i.original}`));
    const runtime = Object.entries({ ...Object.fromEntries(appEntries.filter((e) => e.isFile() && e.name.endsWith(".ts"))
      .map((e) => ["app/" + e.name, readFileSync(join(pageDir, e.name), "utf8")])), ...outer })
      .flatMap(([f, s]) => [...s.matchAll(/\b(?:import|require)\s*\(/g)].map((m) => `${f}: ${m[0]}`));
    check(inputs !== null && inputs.includes("main.ts") && !foreign.length && !runtime.length,
      "the page bundle is made only of the files read by this audit - no package, no file outside src/renderer but the image switch's one, no import() or require",
      why || `found: ${[...foreign, ...runtime].join(" | ")}`);
  }

  // the page asks nothing but its own helper (spec Build-Planer, section 7),
  // in every part, not only the plan part: no part names Questlog's API, no
  // part fetches an absolute or protocol-relative address, and every fetch
  // starts at /api/ - always a literal. The one exception there was
  // (42-party.ts's `route`, one of two /api/ literals) went with the redesign
  // of the party area (28.09., Luecken 7): starting a party now calls each of
  // its two routes with its own literal.
  const parts = Object.fromEntries(readdirSync(pageDir).filter((f) => f.endsWith(".ts"))
    .map((f) => [f, readFileSync(join(pageDir, f), "utf8")]));
  // the three rules on where the page may ask read the files beside app/ as well
  const page = { ...parts, ...outer };
  const qlApi = Object.keys(page).filter((f) => /questlog\.gg\/throne-and-liberty\/api/i.test(page[f]));
  check(!qlApi.length, "no page part names questlog.gg/throne-and-liberty/api", `found in: ${qlApi}`);
  const absolute = Object.keys(page).flatMap((f) =>
    [...page[f].matchAll(/\bfetch\s*\(\s*(?:new\s+URL\s*\(\s*)?["'`]\s*(?:[a-z][a-z0-9+.-]*:|\/\/|\\)/gi)].map((m) => `${f}: ${m[0]}`));
  check(!absolute.length, "no page part fetches an absolute address", `found: ${absolute.join(" | ")}`);
  const notApi = Object.keys(page).flatMap((f) => [...page[f].matchAll(/\bfetch\s*\(\s*([^,)]*)/g)]
    .map((m) => [f, m[1].trim()]))
    .filter(([, a]) => !/^["'`]\/api\//.test(a))
    .map(([f, a]) => `${f}: ${a}`);
  // the party's two ways to start: each with its own literal in 42-party.ts, and no other
  // part asks the helper to host (counted over every part, in any quoting)
  const partyStart = Object.keys(page).sort().flatMap((f) => [...page[f].matchAll(/\bfetch\s*\(\s*["'`](\/api\/party\/(?:create|host))\b/g)]
    .map((m) => (f === "42-party.ts" ? "" : f + ": ") + m[1]));
  check(!notApi.length && JSON.stringify(partyStart) === JSON.stringify(["/api/party/create", "/api/party/host"]),
    "every page fetch starts at /api/ as a literal (the party starts through /api/party/create or /api/party/host)",
    `found: ${[...notApi, ...partyStart].join(" | ")}`);
  // Gruppenkurven (Spezifikation 2026-10-04, 6): die Kurve eines Mitglieds holt
  // nur kurveHolen in 42-party.ts - eine Stelle, die die Zahl der Abrufe je
  // Klick in der Hand hat. Ring und Rennen (64/65) rufen sie dort auf.
  // auch ein Ziel als Vorlage (fetch(`/api/party/${x}`)) zaehlt als Abruf
  const kurveAbruf = Object.keys(page).sort().flatMap((f) => [...page[f].matchAll(/\bfetch\s*\(\s*["'`]\/api\/party\/(?:curve\b|[^"'`]*\$\{)/g)].map(() => f));
  check(JSON.stringify(kurveAbruf) === JSON.stringify(["42-party.ts"]),
    "a member's curve is fetched only in 42-party.ts, at one place", `found: ${kurveAbruf.join(" | ") || "none"}`);
  // the page must not try to write files anywhere near the game
  for (const bad of ["createWritable", "removeEntry", "showSaveFilePicker"]) {
    check(!src.includes(bad), `the page never writes to the log folder (${bad})`);
  }
  // the builds are gone (#207): see "the Builds tab, the plans and the Questlog request stay gone" below
  const part = (f) => (existsSync(join(pageDir, f)) ? readFileSync(join(pageDir, f), "utf8") : "");
  // a part read below under a name it no longer has would read as empty,
  // and an empty part passes every rule - so the names must still be there
  // (49-abend.ts went with the redesign of 28.09., Spezifikation 3; its
  // rules below keep reading the image part, which stays)
  const named = ["47-paar.ts", "50-bild.ts"].filter((f) => !existsSync(join(pageDir, f)));
  check(!named.length, "the parts the rules below read are there under their names", `missing: ${named}`);
  // the first-start tour (spec Rundgang 02.10.2026, 7) asks nothing: no fetch,
  // no beacon, no request object, no /api/ address in its part; it writes
  // only rundgangGesehen, and only through persistPref
  const tourPart = readdirSync(pageDir).filter((f) => /^\d\d-rundgang\.ts$/.test(f));
  const tour = tourPart.length === 1 ? part(tourPart[0]) : "";
  // Pruefung G3: auch kein Speicher im Browser - "gesehen" wird dort nicht gemerkt (Spezifikation 9)
  const tourAsks = [...tour.matchAll(/\bfetch\b|sendBeacon|XMLHttpRequest|EventSource|WebSocket|\/api\/|localStorage|sessionStorage|indexedDB|\.cookie\b|caches\b/g)].map((m) => m[0]);
  // und nur diese Importe, Zeile fuer Zeile
  const TOUR_IMPORTS = [
    'import { state } from "./01-state";',
    'import { t } from "./08-translation";',
    'import { $, esc } from "./18-interface-basics";',
    'import { persistPref } from "./27-weapons-tab";',
    'import { switchTab } from "./34-menus-drop-and-tabs";',
    'import { kuerzelText, uiZoomFactor } from "./37-window-size-and-overlay";',
    'import { chooseServerDir, KOMPAKT_FENSTER, OWN_WINDOW, SERVED, serverDir } from "./41-server-mode";',
  ];
  const tourImports = [...tour.matchAll(/^\s*import\b[^\n]*$/gm)].map((m) => m[0].trim());
  check(JSON.stringify(tourImports) === JSON.stringify(TOUR_IMPORTS) && !/\bimport\s*\(|\brequire\s*\(/.test(tour),
    "the tour part imports only its listed parts", `found: ${tourImports.join(" | ")}`);
  const tourWrites = [...tour.matchAll(/\bpersistPref\b\s*\(([^)]*)\)/g)].map((m) => m[1].replace(/\s+/g, " ").trim());
  check(tourPart.length === 1 && tour.length > 0 && !tourAsks.length
      && tourWrites.length === 1 && tourWrites[0] === '"rundgangGesehen", true'
      && [...tour.matchAll(/\bpersistPref\b/g)].length === 2,
    "the tour part asks nothing and writes only rundgangGesehen: true through persistPref",
    `part: ${tourPart}; asks: ${tourAsks.join(" ")}; writes: ${tourWrites.join(" | ")}`);
  // Glutring (Spezifikation 02.10.2026, 8: keine neuen Daten, kein Netz): der Ring (64) und das
  // Rennen (65) fragen nichts und merken sich nichts - kein fetch, kein /api/, kein Speicher im
  // Browser, kein persistPref, kein neues Fenster. Beide Teile muessen da sein: ein fehlender
  // Teil liest sich leer, und ein leerer Teil bestuende jede Regel. Mindestens so breit wie
  // reach bei 47-paar; gezaehlt wird auch in Kommentaren und Zeichenketten.
  const glutTeile = ["64-glutring.ts", "65-nachspielen.ts"];
  const glutFehlt = glutTeile.filter((f) => !existsSync(join(pageDir, f)));
  const glutFragt = glutTeile.flatMap((f) => [...part(f).matchAll(/\bfetch\b|sendBeacon|XMLHttpRequest|EventSource|WebSocket|\/api\/|localStorage|sessionStorage|indexedDB|\.cookie\b|\bcaches\b|\bpersistPref\b|window\.open|\bnew\s+Image\b|\blocation\b|<img\b|<iframe\b|\bimport\s*\(|\bnavigator\b|\bWorker\b|\bglobalThis\b/g)]
    .map((m) => `${f}: ${m[0]}`));
  check(!glutFehlt.length && !glutFragt.length,
    "the ring and replay parts ask nothing and keep nothing (no fetch, no /api/, no browser storage, no persistPref, no image, location, navigator, worker or import(); counted in comments and strings too)",
    `missing: ${glutFehlt.join(", ")}; found: ${glutFragt.join(" | ")}`);
  // ... und ihr Kern ist rein: er importiert nichts (auch kein Re-Export, kein import mitten in
  // der Zeile) und fasst weder Seite noch Netz an. Gelesen ohne Blockkommentare und ohne ganze
  // //-Zeilen; ein // hinter Code bleibt stehen, damit "http://..." in einer Zeichenkette nicht
  // den Rest der Zeile verschluckt.
  const glutKernPfad = join(rendererDir, "glutring-core.ts");
  const glutKern = existsSync(glutKernPfad) ? readFileSync(glutKernPfad, "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/[^\n]*/gm, "") : "";
  const kernGriffe = [...glutKern.matchAll(/\bimport\b|\bfrom\s*["'`]|\brequire\s*\(|\bfetch\b|\bdocument\b|\bwindow\b|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bglobalThis\b|\bnavigator\b|\bXMLHttpRequest\b|\bsendBeacon\b|\bEventSource\b|\bWebSocket\b|\bImage\b|\blocation\b|\bself\b|\beval\b|\bFunction\b/g)]
    .map((m) => m[0].trim());
  check(glutKern.length > 0 && !kernGriffe.length,
    "glutring-core.ts is a pure core: it imports and re-exports nothing and touches no page or network",
    `found: ${kernGriffe.join(" | ")}`);
  // ... und ebenso der Kern des Streifens (Spezifikation Kompakt-Fenster, 04.10.2026)
  const kompaktKernPfad = join(rendererDir, "kompakt-core.ts");
  const kompaktKern = existsSync(kompaktKernPfad) ? readFileSync(kompaktKernPfad, "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/[^\n]*/gm, "") : "";
  const kompaktGriffe = [...kompaktKern.matchAll(/\bimport\b|\bfrom\s*["'`]|\brequire\s*\(|\bfetch\b|\bdocument\b|\bwindow\b|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bglobalThis\b|\bnavigator\b|\bXMLHttpRequest\b|\bsendBeacon\b|\bEventSource\b|\bWebSocket\b|\bImage\b|\blocation\b|\bself\b|\beval\b|\bFunction\b/g)]
    .map((m) => m[0].trim());
  check(kompaktKern.length > 0 && !kompaktGriffe.length,
    "kompakt-core.ts is a pure core: it imports and re-exports nothing and touches no page or network",
    `found: ${kompaktGriffe.join(" | ")}`);
  // the weapon pair and the reference of the comparisons (47-paar.ts, #207)
  // ask nothing: no fetch, no /api/ address, no beacon, no request object, no link
  const shown = part("47-paar.ts");
  const fetched = [...shown.matchAll(/\bfetch\b/g)].map((m) => m[0]);
  const reach = shown.match(/XMLHttpRequest|sendBeacon|new Image\b|window\.open|\blocation\s*(\.\s*href\s*)?=|\bimport\(|<img\b|<iframe\b|\/api\//g) || [];
  check(shown.length > 0 && !fetched.length && !reach.length,
    "the weapon-pair part asks nothing and loads nothing: no fetch, no /api/, no beacon, no link",
    `fetch: ${fetched.join(" | ")}; also: ${reach.join(" | ")}`);
  // the shared image (spec Fortschritt, feature 4). The evening, which read
  // the saved party logs by GET, went with the redesign of 28.09., and with
  // it the permission for those two fetches: the image part fetches nothing
  // at all. The image is drawn on a canvas from the figures and leaves only
  // through the browser's download or the clipboard. No new endpoint, no
  // upload, no link, and nothing that photographs the screen: main may not
  // name capturePage or desktopCapturer (section 3), and the page may not
  // either.
  const bild = part("50-bild.ts");
  const bildFetch = [...bild.matchAll(/\bfetch\(\s*([^,)]*)/g)].map((m) => m[1].trim());
  const bildReach = bild.match(/XMLHttpRequest|sendBeacon|WebSocket|EventSource|method\s*:|window\.open|\blocation\s*(\.\s*href\s*)?=|\bimport\(|<img\b|<iframe\b|navigator\.share\b/g) || [];
  check(!bildFetch.length && !bildReach.length,
    "the image part fetches nothing and sends nothing: the picture leaves by download or clipboard only",
    `fetch: ${bildFetch.join(" | ")}; also: ${bildReach.join(" | ")}`);
  const capture = src.match(/getDisplayMedia|capturePage|desktopCapturer|html2canvas|drawWindow|captureVisibleTab/g) || [];
  check(!capture.length, "the page never takes a picture of the screen: a shared image is drawn from the figures",
    `found: ${capture.join(", ")}`);
  const abendOut = ["35-party-log-files.ts", "42-party.ts", "44-bug-report.ts"]
    .filter((f) => /49-abend|50-bild|abendStand|bildInhalt/.test(part(f)));
  check(!abendOut.length, "the party report, the party logs and the bug report never see the evening or the image",
    `found in: ${abendOut}`);
  // the Builds tab, the plans and the Questlog request are gone (#207). Nothing
  // of the page may bring them back: the parts 47-builds, 51-plan and
  // 67-build-feld and the core plan-core are not there; no part and no file
  // beside app/ names an /api/ route of the builds or plans, the state of
  // either, the player's two files or the functions that wrote a build
  // (comments and strings count too). The party report, the party logs, the
  // bug report and the image never saw the builds, and now there is nothing
  // for them to see.
  const GONE_FILES = ["47-builds.ts", "51-plan.ts", "67-build-feld.ts"].filter((f) => existsSync(join(pageDir, f)))
    .concat(["plan-core.ts"].filter((f) => existsSync(join(rendererDir, f))));
  const GONE_NAMES = /\/api\/(?:builds|plans?)\b|\b(?:planNames|buildWahl)\b|\bstate\.(?:builds|plans)\b|boro-(?:builds|plans)|\b(?:BauStore|PlanStore|buildAnlegen|buildAendern|buildLoesen|buildWiederherstellen|kampfZuordnen|renderBuilds|syncBuildFeld|syncKampfQuestlog)\b/;
  const goneNamed = Object.keys(page).sort().filter((f) => GONE_NAMES.test(page[f]));
  check(!GONE_FILES.length && !goneNamed.length,
    "the Builds tab, the plans and the Questlog request stay gone: no page part names their routes, state, files or functions",
    `files: ${GONE_FILES.join(", ")}; named in: ${goneNamed.join(", ")}`);
  // 13b.15: the guild's names stay on this computer (spec Gilde 8). Its core
  // (gilde-core.ts) is pure and asks nothing; its part (68-gilde.ts, since
  // plan task 5 there under its name) fetches nothing but /api/gilde.
  // Neither names the party or Questlog, and the party report, the party logs
  // and the bug report never name the guild.
  check(existsSync(join(rendererDir, "gilde-core.ts")), "the guild's core is there under its name");
  check(existsSync(join(pageDir, "68-gilde.ts")), "the guild's part is there under its name");
  // The one import the core may make is the class table (klassen-core.ts, as
  // pure as it is - read here under the same bans); any other import trips.
  const klassenCore = outer["../klassen-core.ts"] ?? "";
  check(existsSync(join(rendererDir, "klassen-core.ts")), "the class table's core is there under its name");
  const gildeCore = (outer["../gilde-core.ts"] ?? "").replace(/^import \{[^}]*\} from "\.\/klassen-core";$/m, "") + "\n" + klassenCore;
  // The one thing the guild's part takes from the party's part: the names
  // this session already knows, for "Aus der Gruppe uebernehmen" (spec Gilde
  // 4, on a click, each name ticked by hand). Exactly this import line is
  // read past here - any other line naming the party still trips - and the
  // function it imports is pinned as written: the session's colour names and
  // the board standing now, without the sample party; nothing goes the other
  // way (the party report, logs and bug report never name the guild, below).
  const GRUPPEN_IMPORT = 'import { gruppenNamen } from "./19-grouping-and-party-fights";';
  const gildeRoh = part("68-gilde.ts");
  const gildePart = gildeRoh.split("\n").filter((l) => l !== GRUPPEN_IMPORT).join("\n");
  // What the guild's part may import: exactly the modules it uses (plan task 5) - state, words, weapon
  // marks, esc, the names line above, SERVED, its core and the class table. Anything else trips.
  const GILDE_IMPORTE = ["./01-state", "./08-translation", "./09-weapon-icons", "./18-interface-basics", "./19-grouping-and-party-fights",
    "./41-server-mode", "../gilde-core", "../klassen-core"];
  const gildeImporte = [...gildeRoh.matchAll(/\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|\brequire\s*\(/gm)]
    .map((m) => m[1] ?? m[2] ?? "require(");
  check(gildeImporte.length > 0 && gildeImporte.every((x) => GILDE_IMPORTE.includes(x)),
    "the guild's part imports only its listed modules (state, words, weapon marks, esc, the session's names, SERVED, its core, the class table)",
    `imports: ${gildeImporte.join(" | ")}`);
  // the protected space and the middle dot stand as escapes in code (CLAUDE.md), never as raw characters
  const rohZeichen = [["68-gilde.ts", gildeRoh], ["gilde-core.ts", outer["../gilde-core.ts"] ?? ""], ["klassen-core.ts", outer["../klassen-core.ts"] ?? ""]]
    .filter(([, text]) => /[\u00a0\u00b7]/.test(text)).map(([n]) => n);
  check(!rohZeichen.length, "the guild's part, its core and the class table write the protected space and the middle dot as escapes, never raw",
    `raw in: ${rohZeichen.join(" | ")}`);
  const namenFn = /\nexport function gruppenNamen\(\): string\[\] \{\n([\s\S]*?)\n\}\n/.exec(part("19-grouping-and-party-fights.ts"));
  check(!!namenFn && namenFn[1] === "  mitgliederMerken(((state.party && state.party.board) || []).map(r => r.name));\n" +
      "  return [...mitgliedNr.keys()].filter(n => !/^Beispiel [A-C]$/.test(n));",
    "the guild takes from the party's part only the names this session knows (gruppenNamen as written)",
    `body: ${namenFn ? namenFn[1] : "(missing)"}`);
  const REACH = /XMLHttpRequest|sendBeacon|WebSocket|EventSource|window\.open|\blocation\s*(\.\s*href\s*)?=|\bimport\(|<img\b|<iframe\b|navigator\.share\b/g;
  const gildeFetch = [...gildePart.matchAll(/\bfetch\b\s*(?:\(\s*([^,)]*))?/g)].map((m) => (m[1] ?? "").trim());
  const gildeReach = [...(gildePart.match(REACH) || []), ...(gildeCore.match(REACH) || []),
    ...[...gildeCore.matchAll(/\bfetch\b|\bimport\b|\brequire\b/g)].map((m) => "gilde-core.ts: " + m[0]),
    ...[gildePart, gildeCore].flatMap((s) => s.match(/party|questlog/gi) || [])];
  check(gildeFetch.length > 0 && gildeFetch.every((a) => a === '"/api/gilde"') && !gildeReach.length,
    "the guild's part fetches nothing but /api/gilde, its core nothing at all, and neither names the party or Questlog",
    `fetch: ${gildeFetch.join(" | ")}; also: ${gildeReach.join(" | ")}`);
  // The files the guild hands out (the image, the calendar file, plan task 7) leave only as a Blob of its
  // own: every link the part sets is exactly URL.createObjectURL(...), in one place, and nothing in it loads
  // a picture or a page by address (no new Image, no src, no href or src by setAttribute).
  const gildeHref = [...gildePart.matchAll(/\.\s*href\s*=(?!=)\s*([^;\n]*)|\[\s*["'`]href["'`]\s*\]\s*=(?!=)\s*([^;\n]*)/g)]
    .map((m) => (m[1] ?? m[2] ?? "").trim());
  check(gildeHref.length === 1 && /^URL\.createObjectURL\([A-Za-z_$][\w$]*\)$/.test(gildeHref[0]),
    "the guild's part sets a link only to a Blob of its own (URL.createObjectURL), in one place", `href: ${gildeHref.join(" | ")}`);
  const gildeLaden = gildePart.match(/\bnew\s+Image\b|\.\s*src\s*=(?!=)|\[\s*["'`]src["'`]\s*\]\s*=(?!=)|\.setAttribute\(\s*["'`](?:href|src)["'`]/gi) || [];
  check(!gildeLaden.length, "the guild's part loads no picture or page by address (no new Image, no src, no href or src by setAttribute)",
    `found: ${gildeLaden.join(" | ")}`);
  const gildeOut = ["35-party-log-files.ts", "42-party.ts", "44-bug-report.ts"].filter((f) => /gilde/i.test(part(f)));
  check(!gildeOut.length, "the party report, the party logs and the bug report never name the guild",
    `found in: ${gildeOut}`);
  // the Steckbrief part (spec Steckbrief 6) went with Aufgabe 12 of the
  // redesign (29.09.), and with it its core: no page part imports either.
  // Should 52-steckbrief.ts come back, the rule after this one still reads
  // it: it may fetch nothing and load nothing from outside.
  const steckImp = Object.keys(parts).filter((f) => f !== "52-steckbrief.ts"
    && /["'`][^"'`\n]*(?:52-steckbrief|gear-core)(?:\.ts|\.js)?["'`]/.test(parts[f]));
  check(!steckImp.length, "no page part imports the Steckbrief (52-steckbrief.ts, gear-core.ts) - it went with Aufgabe 12", `found in: ${steckImp}`);
  const steck = part("52-steckbrief.ts");
  const steckReach = steck.match(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|window\.open|\blocation\s*(\.\s*href\s*)?=|\bimport\(|<img\b|<iframe\b|\bsrc=|url\(|questlog\.gg/g) || [];
  check(!steckReach.length, "the Steckbrief part fetches nothing and loads nothing from outside", `found: ${steckReach.join(" | ")}`);
  // the history index (spec Steckbrief 4.3): per fight four whole numbers
  // more - hits, crit, heavy, miss - and never a text. histRecord builds a
  // fight in one literal and a few assignments; nothing else joins them
  check(existsSync(join(pageDir, "32-history.ts")), "the history part is there under its name");
  const histBody = (part("32-history.ts").match(/export function histRecord\(\)\{([\s\S]*?)\n\}/) || [null, ""])[1];
  const histLit = (histBody.match(/const f: HistFight = \{([\s\S]*?)\};/) || [null, ""])[1];
  const histKeys = [...histLit.matchAll(/\b(\w+)\s*:/g)].map((m) => m[1]).sort().join();
  const histSets = [...histBody.matchAll(/\bf\.(\w+)\s*=(?!=)/g)].map((m) => m[1]).sort().join();
  // the group mark g (06.10.2026): the sum of a group, opened with
  // "everyone", is set in exactly one line and only to the number 1 - never
  // a name, never the chosen attacker
  check(histKeys === "at,dmg,dps,dur,name" && histSets === "b,c,crit,g,heavy,hits,miss,w"
      && !/Object\.assign\(\s*f\b|\bf\s*\[|\(f as\b|\.\.\.f\b/.test(histBody)
      && histBody.includes("\n    const miss = seg.missed || 0;\n")
      && histBody.includes("\n    f.hits = st.hits + miss; f.crit = st.crit; f.heavy = st.heavy; f.miss = miss;\n")
      && histBody.includes("\n    const b = altB.get(seg.start);\n    if(b) f.b = b;\n")
      && histBody.includes("\n    const w = paarCode(paarVon(seg, histStill) ?? []);\n    if(w) f.w = w;\n")
      && histBody.includes("\n    if(state.players.length > 1 && state.player === \"__all\") f.g = 1;\n")
      && [...histBody.matchAll(/\bf\.g\b/g)].length === 1,
    "the history index takes per fight only its known fields, hits, crit, heavy and miss as whole numbers, the pair w as two numbers, b carried over and the group mark g as 1",
    `literal: ${histKeys}; assigned: ${histSets}`);
  // Records (spec Rekorde 3, Fixrunde 1, 02.10.2026): the fight's top hit
  // joins the index only through topDazu - called once in histRecord, after
  // the four numbers - as a whole number and a skill id of a fixed pattern
  // (digits, or Borometer's own boro: ids such as boro:ventius), never a
  // name. The name the log gives that id lives only in the session
  // (topNamen), read for the records and never stored or sent.
  const h32 = part("32-history.ts");
  const topBody = (h32.match(/\nfunction topDazu\(f: HistFight, ev: readonly CombatEvent\[\]\)\{([\s\S]*?)\n\}/) || [null, null])[1];
  const TOP_BODY = "\n  let top = ev[0];\n  for(const e of ev) if(e.dmg > top!.dmg) top = e;\n"
    + "  if(top){ f.top = top.dmg; f.topSid = TOP_SID.test(top.sid) ? top.sid : \"\"; topNamen.set(top.sid, top.skill); }";
  const topNamenUse = Object.keys(parts).sort().flatMap((f) => [...parts[f].matchAll(/^[^\n]*\btopNamen\b[^\n]*/gm)].map((m) => `${f}: ${m[0].trim()}`));
  const TOP_NAMEN = ["32-history.ts: const topNamen = new Map<string, string>();",
    "32-history.ts: export const topName = (sid: string) => topNamen.get(sid) || \"\";",
    "32-history.ts: if(top){ f.top = top.dmg; f.topSid = TOP_SID.test(top.sid) ? top.sid : \"\"; topNamen.set(top.sid, top.skill); }"];
  const topSetsOut = Object.keys(parts).flatMap((f) => [...parts[f].matchAll(/\bf\.top\s*=(?!=)|\.top(?:Sid|Skill)\s*=(?!=)/g)].map((m) => `${f}: ${m[0]}`));
  check(topBody === TOP_BODY && /^const TOP_SID = \/\^\(\?:\\d\{1,12\}\|boro:\[a-z-\]\{1,32\}\)\$\/;$/m.test(h32)
      && [...h32.matchAll(/\bTOP_SID\b/g)].length === 2 && [...h32.matchAll(/\btopDazu\b/g)].length === 2
      && histBody.includes("\n    f.hits = st.hits + miss; f.crit = st.crit; f.heavy = st.heavy; f.miss = miss;\n    topDazu(f, seg.events);\n")
      && JSON.stringify(topNamenUse) === JSON.stringify(TOP_NAMEN) && topSetsOut.length === 2,
    "the top hit joins the history index as a number and a skill id of a fixed pattern, never a name; the name stays in the session",
    `topDazu: ${JSON.stringify(topBody)}; topNamen: ${topNamenUse.filter((l) => !TOP_NAMEN.includes(l)).join(" | ")}; top set: ${topSetsOut.join(" | ")}`);
  // Records (spec Rekorde 3, 02.10.2026): an entry of the history index per
  // file is written in exactly two lines - histRecord's, and the records'
  // re-read (histNachlesen) with only size, bytes, nach and the fights - and
  // removed in one (histRecord with no fights left; since Fixrunde 1 the
  // re-read never removes an entry, histRecord hands it the fights). Nothing
  // else writes into it.
  const IDX_WRITES = [
    "32-history.ts: else state.hist.files[key] = {size: state.text.length, fights};",
    "32-history.ts: state.hist.files[name] = !alt || alt.nach ? {size, bytes, nach: true, fights} : {...alt, size, bytes, fights};"];
  const IDX_DELETES = ["32-history.ts: if(!fights.length) delete state.hist.files[key];"];
  const idxWrites = Object.keys(parts).sort().flatMap((f) => [...parts[f].matchAll(/^[^\n]*\bhist\.files\s*\[[^\]]*\]\s*=(?!=)[^\n]*/gm)]
    .map((m) => `${f}: ${m[0].trim()}`));
  const idxDeletes = Object.keys(parts).sort().flatMap((f) => [...parts[f].matchAll(/^[^\n]*\bdelete\s+[^\n;]*\bhist\.files\b[^\n]*/gm)]
    .map((m) => `${f}: ${m[0].trim()}`));
  const idxOther = Object.keys(parts).flatMap((f) => [...parts[f].matchAll(/Object\.assign\(\s*state\.hist\.files\b|=\s*state\.hist\.files\s*;|Reflect\.\w+\(\s*state\.hist\.files\b/g)]
    .map((m) => `${f}: ${m[0]}`));
  check(JSON.stringify(idxWrites) === JSON.stringify(IDX_WRITES) && JSON.stringify(idxDeletes) === JSON.stringify(IDX_DELETES) && !idxOther.length,
    "the history index per file is written only by histRecord and the records' re-read, with size, bytes, nach and fights",
    `writes: ${idxWrites.filter((l) => !IDX_WRITES.includes(l)).join(" | ")}; deletes: ${idxDeletes.filter((l) => !IDX_DELETES.includes(l)).join(" | ")}; other: ${idxOther.join(" | ")}`);
  // Records (Fixrunde 1, Gutachten H2): the re-read stores nothing but the
  // index entry - histRecord under histStill makes no build (bauFuer would
  // write boro-builds.json), hands its fights back before the index, the
  // best pulls and the save, and Ventius learns nothing while it runs
  const v15 = part("15-weapons-and-ventius.ts");
  const stillAt = histBody.indexOf("\n  if(histStill){ histStillFights = fights; return; }\n");
  check(!/\bbauFuer\b/.test(histBody)
      && stillAt > 0 && stillAt < histBody.indexOf("const alt = state.hist.files[key];") && stillAt < histBody.indexOf("bestRecord(") && stillAt < histBody.indexOf("persistPref(")
      && h32.includes("\n        setVentiusLernen(false);\n        segment();\n") && h32.includes("\n    histStill = false; setVentiusLernen(true);\n")
      && /\nexport function learnVentius\(segs: Encounter\[\]\)\{\n  if\(!ventiusLernen\) return;\n/.test(v15),
    "the records' re-read makes no build, no best pull and teaches Ventius nothing; it stores only the index entry",
    `bauFuer: ${[...histBody.matchAll(/[^\n]*\bbauFuer\s*\([^\n]*/g)].map((m) => m[0].trim()).join(" | ")}; early return at ${stillAt}`);
  // Builds-Reiter (#207): the Builds tab is gone, and a fight gets no build any
  // more. histRecord only carries a b over from the earlier index entry of
  // the same file (an old assignment; nothing reads or shows it). No other
  // `.b =` on a fight in any page part.
  const bSets = Object.keys(parts).sort().flatMap((f) => [...parts[f].matchAll(/^[^\n]*(?:\.b|\[\s*["'`]b["'`]\s*\])\s*(?:\?\?|\|\||&&)?=(?!=)[^\n]*/gm)].map((m) => `${f}: ${m[0].trim()}`));
  const B_SETS = ["32-history.ts: if(b) f.b = b;"];
  check(JSON.stringify(bSets) === JSON.stringify(B_SETS),
    "a fight gets a b only carried over in histRecord, never assigned anew",
    `found: ${bSets.filter((l) => !B_SETS.includes(l)).join(" | ")}`);
  // Builds-Reiter (spec 9 and 12): the recognition by skills is gone and must not
  // come back quietly. No page part and no file beside app/ names coreFromSkills
  // or fingerprint (not even in a comment), and none reads `core` of a build:
  // no `.core` or `?.core`, no `["core"]` or `"core" in`, no `core` between
  // braces (a destructuring, an object). types.ts may declare the field (Bau.core stays in
  // boro-builds.json for builds recognised before #51); build-core.ts checks its
  // form in looksLikeBau - exactly the two lines listed here, nothing else.
  // "bars.core" is a text key, not a read: a `.core` right before a quote or
  // part of a longer word does not count. A read continued on the next line
  // (`state.builds[id]!` and `.core` below it, or `.` and `core` below it) is
  // folded into one line first (Fixrunde 1, Minor 3). The names of the old
  // recognition count too: sameBau, findBau, bauNummern, and bauId as a call
  // (`bauId` alone is a variable name in 54-deine-rotation.ts).
  const pageFiles = { ...parts, ...outer };
  const CORE_READ = /[\w$)\]!]\s*\??\.\s*core\b(?![\w$"'`-])|\[\s*["'`]core["'`]\s*\]|["'`]core["'`]\s+in\b|\{[^{}\n]*(?<![\w$.\-"'`])core(?![\w$\-"'`])[^{}\n]*\}/;
  const recog = Object.keys(pageFiles).sort().flatMap((f) => [...pageFiles[f].matchAll(/^[^\n]*\b(?:coreFromSkills|fingerprint|sameBau|findBau|bauNummern)\b[^\n]*|^[^\n]*\bbauId\s*\([^\n]*/gim)]
    .map((m) => `${f}: ${m[0].trim()}`));
  const gefaltet = (src) => src.replace(/\s*\n\s*(?=\??\.\s*core\b)/g, "").replace(/(\??\.)[ \t]*\n\s*(?=core\b)/g, "$1");
  const coreLines = (f) => gefaltet(pageFiles[f]).split("\n").filter((l) => CORE_READ.test(l)).map((l) => l.trim());
  const coreReads = Object.keys(pageFiles).sort().filter((f) => f !== "../build-core.ts" && f !== "../types.ts")
    .flatMap((f) => coreLines(f).map((l) => `${f}: ${l}`));
  const typeCore = pageFiles["../types.ts"] === undefined ? ["types.ts missing"] : coreLines("../types.ts");
  // build-core.ts no longer holds the form of a build (#207): no line of it reads core either
  const KERN_ZEILEN = [];
  const bcCore = pageFiles["../build-core.ts"] === undefined ? ["build-core.ts missing"] : coreLines("../build-core.ts");
  check(!recog.length && !coreReads.length && !typeCore.length && JSON.stringify(bcCore) === JSON.stringify(KERN_ZEILEN),
    "no page part reads core of a build or names coreFromSkills or fingerprint (the recognition by skills stays gone)",
    `recognition: ${recog.join(" | ")}; core read: ${coreReads.join(" | ")}; types.ts: ${typeCore.join(" | ")}; build-core.ts: ${bcCore.join(" | ")}`);
  // the records part reads older logs only through the two routes of
  // "Earlier days" (spec Nachtraege N3), GET /api/logs and GET /api/log, and
  // sends nothing itself: what it reads goes into the history through 32
  const rkPart = part("62-rekorde.ts");
  const rkFetches = [...rkPart.matchAll(/\bfetch\([^\n]*/g)].map((m) => m[0].trim());
  const rkReach = rkPart.match(/XMLHttpRequest|sendBeacon|WebSocket|EventSource|window\.open|\blocation\s*(\.\s*href\s*)?=|\bimport\(|<iframe\b|questlog\.gg|\bpersistPref\b|\bmethod\s*:/g) || [];
  check(existsSync(join(pageDir, "62-rekorde.ts"))
      && JSON.stringify(rkFetches) === JSON.stringify(['fetch("/api/logs", {signal: signal()});',
        'fetch("/api/log?name=" + encodeURIComponent(name) + "&from=" + from, {signal: signal()});'])
      && [...rkPart.matchAll(/\bfetch\b/g)].length === 2 && !rkReach.length,
    "the records part fetches only GET /api/logs and GET /api/log, and sends nothing",
    `fetch: ${rkFetches.join(" | ")}; also: ${rkReach.join(" | ")}`);
  // Kompakt-Fix 1 (01.10.2026): the strip takes full view's file name (from
  // /api/state, kompakt.datei) only to GET /api/log - the route that compares
  // it with a fresh listing of the log folder - and to nothing else
  const kw23 = part("23-kampfwahl.ts");
  const kwFetches = [...kw23.matchAll(/\bfetch\([^\n]*/g)].map((m) => m[0].trim());
  const STREIFEN_DATEI = '\n  if(!frisch && state.origin === "file" && gleich(state.fileNames || [], [name])) return "ok";\n  const lauf = ++tagLauf;\n'
    + "  const text = await dateiHolen(name, lauf);\n  if(lauf !== tagLauf) return \"fehler\";\n"
    + "  if(text === null) return holStatus === 404 ? \"fremd\" : \"fehler\";\n"
    + '  setLoadOrigin("file");\n  loadText(text, [name], true);\n  return "ok";';
  const streifenDateiBody = (kw23.match(/\nasync function streifenDatei\(name: string, frisch: boolean\): Promise<"ok" \| "fremd" \| "fehler"> \{([\s\S]*?)\n\}/) || [null, null])[1];
  const kDatei = [...kw23.matchAll(/[^\n]*\bk\s*\.\s*datei\b[^\n]*/g)].map((m) => m[0].trim());
  const otherParts = Object.keys(parts).filter((f) => f !== "23-kampfwahl.ts" && /\bstreifenDatei\b|\bdateiHolen\b/.test(parts[f]));
  // Gutachten M6: the stand from /api/state (s.kompakt) is read in every
  // part only where written - its file name goes to streifenFolgt and
  // nowhere else - never destructured or looked up by a string; and 23
  // names fetch only in its two fetches (no fetch.call, no handle on it)
  const KOMPAKT_READS = [
    "37-window-size-and-overlay.ts: setKompaktOffen(!!(s.kompakt && s.kompakt.offen));",
    "37-window-size-and-overlay.ts: void streifenFolgt(s.kompakt);",
    "41-server-mode.ts: if(state.zweiFenster) setKompaktOffen(!!(s.kompakt && s.kompakt.offen));",
    "41-server-mode.ts: kompaktFensterStart(!!(s.kompakt && s.kompakt.durch));",
    "41-server-mode.ts: if(s.kompakt && s.kompakt.live && serverDir && !isWatching()) beginServedWatch();",
    "41-server-mode.ts: else void streifenFolgt(s.kompakt);",
    // Windows-Einbindung 5.1: das Flag "kompakt" eines Auftrags aus der Sprungliste (start in /api/state), kein Dateiname
    "66-windows.ts: if(a.kompakt && !kompaktIstOffen()) $(\"#btnCompact\").click();"];
  const kompaktReads = Object.keys(parts).sort().flatMap((f) => [...parts[f].matchAll(/^[^\n]*[\w$)\]]\s*\.\s*kompakt\b[^\n]*/gm)]
    .map((m) => `${f}: ${m[0].trim()}`));
  const kompaktOther = Object.keys(parts).flatMap((f) => [...parts[f].matchAll(/\[\s*["'`]kompakt["'`]\s*\]|\{[^{}]*\bkompakt\b[^{}]*\}\s*=[^=>]/g)]
    .map((m) => `${f}: ${m[0]}`));
  const fetchNamed = [...kw23.matchAll(/\bfetch\b/g)].length;
  check(JSON.stringify(kwFetches) === JSON.stringify(['fetch("/api/logs", {signal: AbortSignal.timeout(10000)});',
        'fetch("/api/log?name=" + encodeURIComponent(name) + "&from=" + from, {signal: AbortSignal.timeout(10000)});'])
      && streifenDateiBody === STREIFEN_DATEI && [...kw23.matchAll(/\bstreifenDatei\b/g)].length === 3
      && JSON.stringify(kDatei) === JSON.stringify(['if(grund === "datei" && typeof k.datei === "string" && k.datei){',
        "let da = await streifenDatei(k.datei, false);", "da = await streifenDatei(k.datei, true);"])
      && !otherParts.length
      && JSON.stringify(kompaktReads) === JSON.stringify(KOMPAKT_READS) && !kompaktOther.length && fetchNamed === 2,
    "the strip takes full view's file name only to GET /api/log, which compares it with the log folder",
    `fetch: ${kwFetches.join(" | ")} (fetch named ${fetchNamed}x); k.datei: ${kDatei.join(" | ")}; elsewhere: ${otherParts.join(", ")}; `
    + `.kompakt: ${kompaktReads.filter((l) => !KOMPAKT_READS.includes(l)).join(" | ")}; other: ${kompaktOther.join(" | ")}`);
  // 14.12: the update notice on the page (spec Update-Hinweis 2.3). The page
  // asks nothing outside - every fetch starts at /api/ (above) - and no part
  // names GitHub's API. The release page prefix stands in one part only,
  // 55-statusleiste.ts, and only to check the address GET /api/state
  // brought; the link's href is set from that checked value alone.
  const ghApiParts = Object.keys(parts).filter((f) => /api\.github\.com/i.test(parts[f]));
  const prefixAt = Object.keys(parts).sort().flatMap((f) => [...parts[f].matchAll(/^[^\n]*github\.com\/B0R0AK[^\n]*/gim)]
    .map((m) => `${f}: ${m[0].trim()}`));
  const sb55 = part("55-statusleiste.ts");
  const UPDATE_CHECK = 'if(typeof url !== "string" || !url.startsWith(RELEASE_PREFIX) || !RELEASE_TAG.test(url.slice(RELEASE_PREFIX.length))) return null;';
  check(!ghApiParts.length
      && JSON.stringify(prefixAt) === JSON.stringify(['55-statusleiste.ts: const RELEASE_PREFIX = "https://github.com/B0R0AK/Borometer/releases/tag/";'])
      && [...sb55.matchAll(/\bRELEASE_PREFIX\b/g)].length === 3 && sb55.split(UPDATE_CHECK).length === 2
      && Object.keys(parts).every((f) => f === "55-statusleiste.ts" || !/\bRELEASE_PREFIX\b/.test(parts[f]))
      && [...sb55.matchAll(/\bupdate\s*=(?![=>])/g)].map((m) => sb55.slice(m.index, m.index + 27)).join() === "update = updateGeprueft(u);"
      && /\n  update = updateGeprueft\(u\);\n/.test(sb55)
      && [...sb55.matchAll(/setAttribute\(\s*["'`]href/g)].length === 1 && sb55.includes('a.setAttribute("href", update.url);'),
    "no page part names api.github.com; the release page prefix stands only in 55-statusleiste.ts, to check the link /api/state brought",
    `api.github.com in: ${ghApiParts}; prefix: ${prefixAt.join(" | ")}`);
  // 14.12, made tight (security review M2): the page's own check as written -
  // tag and version digits and dots, no .*, no flag - each bound once and used once
  const RELEASE_LINES = ["const RELEASE_TAG = /^v?\\d{1,3}\\.\\d{1,3}(?:\\.\\d{1,3})?$/;",
    "const RELEASE_VERSION = /^\\d{1,3}\\.\\d{1,3}(?:\\.\\d{1,3})?$/;"];
  const sbLines = sb55.split("\n");
  check(RELEASE_LINES.every((l) => sbLines.filter((x) => x === l).length === 1)
      && [...sb55.matchAll(/\bRELEASE_TAG\b/g)].length === 2 && [...sb55.matchAll(/\bRELEASE_VERSION\b/g)].length === 2
      && sb55.includes('if(typeof version !== "string" || !RELEASE_VERSION.test(version)) return null;')
      && Object.keys(parts).every((f) => f === "55-statusleiste.ts" || !/\bRELEASE_(?:TAG|VERSION)\b/.test(parts[f])),
    "the page checks the release tag and version as digits and dots (RELEASE_TAG, RELEASE_VERSION as written)",
    `found: ${sbLines.filter((l) => /\bRELEASE_(?:TAG|VERSION)\s*=/.test(l)).join(" | ")}`);
  // 14.13: the move to the public repository (spec oeffentliches Repo, 5) is a
  // move, not a loosening: the old private address stands nowhere in src
  const oldRepo = [...walkAll(mainDir, "main/"), ...walkAll(rendererDir, "renderer/")]
    .filter(([, full]) => /B0R0AK\/Borometer-Rework/i.test(readFileSync(full, "utf8"))).map(([rel]) => rel);
  check(!oldRepo.length, "no source names the private working repository B0R0AK/Borometer-Rework", `found in: ${oldRepo}`);
}

/*
 * 15. Game images (spec oeffentliches Repo, 4). The source carries no image
 * from the game, from questlog.gg or from Flaticon: those live in
 * assets/spielbilder.ts - private, and in the public release build only -
 * and the build swaps that one file in for src/renderer/spielbilder.ts.
 * Image data anywhere in src/ is one of the own images, counted and pinned
 * by hash; both spielbilder.ts are data only, so swapping one for the other
 * can change pictures and nothing else. LEER and VOLL of the switch are
 * written out again rather than shared.
 */
// every file below dir, as [pre + relative path, full path]; used by 14.13 and 15
function walkAll(dir, pre) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walkAll(join(dir, e.name), pre + e.name + "/") : [[pre + e.name, join(dir, e.name)]]);
}

function auditSpielbilder() {
  const BILD = /(?<![A-Za-z0-9+\/])(?:UklGR|iVBORw0KGgo|\/9j\/|R0lGOD)[A-Za-z0-9+\/]{100,}={0,2}|data:image\/(?!svg\+xml)[a-z]+;base64,[A-Za-z0-9+\/]{100,}={0,2}/g;
  // the own images: the own weapon drawings (11 x light and dark), the own boss mark, the clan logo
  const EIGENE = { "renderer/app/09-weapon-icons.ts": 22, "renderer/app/12-boss-images.ts": 1, "renderer/index.html": 1 };
  // pinned 03.10.2026; a new own image moves this only on the owner's word, with a line why
  const EIGENE_SHA256 = "a65a3c9201d8456009219d1f8468771e71f6df00c2d77d3725081a1a509f766b";
  const files = [...walkAll(mainDir, "main/"), ...walkAll(rendererDir, "renderer/")].sort(([a], [b]) => a.localeCompare(b));
  const found = files.map(([rel, full]) => [rel, readFileSync(full, "utf8").match(BILD) ?? []]).filter(([, m]) => m.length);
  const counts = Object.fromEntries(found.map(([rel, m]) => [rel, m.length]));
  check(JSON.stringify(counts) === JSON.stringify(Object.fromEntries(Object.entries(EIGENE).sort(([a], [b]) => a.localeCompare(b)))),
    "no image data in src outside the own images (09 weapon icons, 12 boss mark, index.html clan logo)",
    `found: ${Object.entries(counts).map(([f, n]) => f + " x" + n).join(", ")}`);
  const sha = createHash("sha256").update(found.flatMap(([, m]) => m).join("\n")).digest("hex");
  check(sha === EIGENE_SHA256, "the own images in src are exactly the pinned ones", `sha256 ${sha}`);

  // both spielbilder.ts: comments, exported string tables, nothing else; the same tables
  const TABLE = /^export const [A-Z][A-Z_]*: Record<string, string> = \{(?:\};)?$/;
  /* an entry is a key and pure image data. KERN_BILD goes into <img src> as it
     stands, so there only the one data URI form its entries have (webp) - never
     an address. The other tables are plain base64, no scheme and no ":"; the
     page puts "data:image/webp;base64," in front of them itself */
  const ENTRY = /^\s*(?:"(?:[^"\\]|\\u[0-9a-fA-F]{4})+"|[A-Za-z_$][\w$]*)\s*:\s*"[A-Za-z0-9+\/]+=*",?$/;
  const ENTRY_KERN = /^\s*(?:"(?:[^"\\]|\\u[0-9a-fA-F]{4})+"|[A-Za-z_$][\w$]*)\s*:\s*"data:image\/webp;base64,[A-Za-z0-9+\/]+=*",?$/;
  const names = (s) => [...s.matchAll(/^export const ([A-Z][A-Z_]*)\b/gm)].map((m) => m[1]).sort().join();
  const empty = readFileSync(join(rendererDir, "spielbilder.ts"), "utf8");
  const fullPath = join(assetsDir, "spielbilder.ts");
  const data = [["src/renderer/spielbilder.ts", empty], ...(existsSync(fullPath) ? [["assets/spielbilder.ts", readFileSync(fullPath, "utf8")]] : [])];
  const odd = data.flatMap(([f, s]) => {
    const t = tokenise(s);
    if (t.error) return [`${f}: ${t.error}`];
    // the open table decides the form of an entry; outside a table there is none
    let table = "";
    return t.code.split("\n").map((l) => l.trimEnd()).filter((l) => {
      if (!l.trim()) return false;
      if (TABLE.test(l)) { table = l.endsWith("{};") ? "" : l.match(/^export const ([A-Z][A-Z_]*)/)[1]; return false; }
      if (l === "};") { const open = table; table = ""; return !open; }
      return !table || !(table === "KERN_BILD" ? ENTRY_KERN : ENTRY).test(l);
    }).map((l) => `${f}: ${l.slice(0, 60)}`);
  });
  const sameNames = data.every(([, s]) => names(s) === names(empty))
    && names(empty) === "BOSS_ICON_BILD,KERN_BILD,SKILL_ICON_BILD,WK_BOSS_BILD,WK_GEGENSTAND_BILD";
  check(!odd.length && sameNames, "spielbilder.ts is data only: exported string tables, nothing else, the same five in both",
    `found: ${odd.join(" | ")}${sameNames ? "" : " | other tables"}`);

  // the switch: one onResolve for exactly ../spielbilder onto exactly the two files, one plugin in the build
  const weicheText = readFileSync(join(scriptsDir, "bilder-weiche.mjs"), "utf8");
  const build = readFileSync(join(scriptsDir, "build-renderer.mjs"), "utf8");
  check([...weicheText.matchAll(/\bonResolve\b/g)].length === 1 && !/\bonLoad\b/.test(weicheText)
      && weicheText.includes("build.onResolve({ filter: /^\\.\\.\\/spielbilder$/ }, () => ({ path: join(root, modus === \"voll\" ? VOLL : LEER) }));")
      && /^export const LEER = "src\/renderer\/spielbilder\.ts";$/m.test(weicheText) && /^export const VOLL = "assets\/spielbilder\.ts";$/m.test(weicheText)
      && [...build.matchAll(/\bplugins\s*:/g)].length === 1 && build.includes("plugins: [bilderPlugin(root, modus)],")
      && !/\bon(?:Resolve|Load)\b/.test(build),
    "the build swaps only ../spielbilder for assets/spielbilder.ts, with one plugin");
}

function auditServer() {
  const src = readFileSync(serverPath, "utf8");
  const forbidden = ["subprocess", "os.system", "ctypes", "eval(", "exec(", "pickle"];
  const hits = forbidden.filter((f) => src.includes(f));
  check(!hits.length, "party server executes nothing and unpickles nothing", `found: ${hits}`);
  const opens = src.match(/open\(([^)]*)\)/g);
  check(!opens, "party server never touches the filesystem", `found: ${opens}`);
}

// A missing file must never read as a pass.
if (!existsSync(mainDir)) failures.push({ status: "FAIL", label: "could not find src/main to audit", detail: "" });
else auditMain();
if (!existsSync(pageDir)) failures.push({ status: "FAIL", label: "could not find src/renderer/app/ to audit", detail: "" });
else await auditPage();
// the folders the image rules read; a missing one must not read as a pass either
const missing15 = [mainDir, rendererDir, scriptsDir].filter((d) => !existsSync(d));
if (missing15.length) failures.push({ status: "FAIL", label: "could not find the folders the game image rules read", detail: missing15.join(", ") });
else auditSpielbilder();
if (existsSync(serverPath)) auditServer();
else notes.push({ status: "SKIP", label: "party server not in this folder, not audited", detail: "" });

for (const n of notes) console.log(`  ${n.status}  ${n.label}`);
for (const f of failures) {
  console.log(`  ${f.status}  ${f.label}`);
  if (f.detail) console.log(`        ${f.detail}`);
}
console.log();
// exitCode rather than process.exit(): exit() can drop what is still queued
// for stdout, and a negative case (audit-negative.mjs) then saw a failed
// audit without its FAIL lines - the report went missing once it grew past
// about 12 KB
if (failures.length) {
  console.log(`SAFETY AUDIT FAILED - ${failures.length} problem(s)`);
  process.exitCode = 1;
} else console.log("SAFETY AUDIT PASSED - logs are read-only, the game is never touched");
