// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Windows draws the frame; the page asks for the few things only this
 * process can do: POST /api/win lands in winAction().
 *
 * Two windows at most (spec Nachtraege N4): full view, and the compact strip
 * as a window of its own above the game - a normal Windows window, not an
 * overlay in the game. Both load the same page from this app's own server,
 * with the same web preferences, and neither opens a third.
 */

import { BrowserWindow, nativeTheme, screen, shell } from "electron";
import * as path from "node:path";
import { acrylicSupported, borderFor, materialFor, overlayFor, themeSourceFor } from "./chrome";
import { loadConfig, updateConfig } from "./config";
import { bump } from "./events";
import {
  fensterNeu, neuerMerker, platzGross, platzKompakt, teilAus,
  type LageGross, type LageKompakt, type Monitor, type Teil,
} from "./lage";
import { setLiveBadge } from "./taskbar";
import type { Json } from "./http";

export const WINDOW_W = 1280;
export const WINDOW_H = 860;
/* the floor of a requested resize: the same numbers as minWidth and
   minHeight below, so a size the window would not really accept is never
   sent on to setSize. The height stood at 100, and compact with no fight asks
   for a 26-point strip (28 with rounding), so that request was dropped and
   the strip sat at the top of a full-size window since the move to Electron
   (found in the critique of 23.09.2026). Lowering the floor to 24 was not
   the whole answer: the strip scales with the app's size setting, at 80 %
   it asks for 23, and a request under the floor was still dropped whole -
   width too - while the answer said ok. "resize" now clamps up to the floor
   instead (branch review, critique round 2). */
const MIN_ACTION_W = 180;
const MIN_ACTION_H = 24;

/*
 * The page's web preferences, one object for both windows (safety audit 8b):
 * no Node, no preload and no bridge into this process. The page talks to it
 * over http on 127.0.0.1 only.
 */
const SEITE = Object.freeze({ nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false });

/* The page's origin and the icon, as createWindow() got them from main.ts:
   the compact window loads the same page from the same server. */
const seite = { origin: "", icon: "" };

const state = {
  win: null as BrowserWindow | null,
  /** the size before compact shrank it, so Full view can restore it */
  prev: null as [number, number] | null,
  /** whether the window was maximised when compact shrank it */
  prevMax: false,
  max: false,
  /**
   * The header height the page last sent (chrome, material), unclamped:
   * overlayFor() clamps it wherever it is used. A reload resets the buttons
   * with it instead of the 100 % height, see did-finish-load.
   */
  header: undefined as unknown,
  /** whether the mouse currently goes through the window */
  through: false,
  /** true while this process sizes the window itself (see will-resize) */
  sizing: false,
  /** compact asked for its material (kind "acrylic"); full view: false */
  compact: false,
  /** Windows' "Transparency effects" off, as last seen (transparencyChanged) */
  reduced: false,
  /** the window opened at a remembered full-view place (fenster.gross) */
  placed: false,
};

export function currentWindow(): BrowserWindow | null {
  return state.win && !state.win.isDestroyed() ? state.win : null;
}

/* The compact window (N4) while it is open. */
const kompakt = {
  win: null as BrowserWindow | null,
  /** whether the mouse currently goes through it */
  through: false,
  /** how it was opened: with live logging running in full view, by the hotkey */
  start: { live: false, durch: false },
};

export function kompaktWindow(): BrowserWindow | null {
  return kompakt.win && !kompakt.win.isDestroyed() ? kompakt.win : null;
}

/*
 * What full view shows, for the strip to show the same (Kompakt-Fix
 * 01.10.2026): before it opens the strip, and whenever its fight changes
 * while the strip is open, full view sends it as "stand". Only named values:
 * a reason from a fixed list, and with "datei" one file name and the start
 * of the chosen fight. The name is never opened here - the strip asks
 * GET /api/log?name= for it, and logs.ts only compares it with a fresh
 * listing of the watched folder.
 */
const STAND_GRUENDE = ["leer", "live", "datei", "fremd", "andere", "beispiel", "mehrere"];
const vollStand = { grund: "leer", datei: "", kampf: null as number | null };
/* A log's file name and nothing else: no folder, no drive, no control
   character, ending in .txt or .log like the logs listLogs finds. */
const LOG_NAME = /^[^\\/:*?"<>|\u0000-\u001f]{1,200}\.(txt|log)$/i;
function logName(v: unknown): string {
  return typeof v === "string" && LOG_NAME.test(v) ? v : "";
}
/* A fight's start as the page counts it (ms of the log's clock), or none. */
function kampfZeit(v: unknown): number | null {
  return typeof v === "number" && Number.isSafeInteger(v) ? v : null;
}

/** For GET /api/state: whether the compact window is open, how it was opened, and what full view shows. */
export function kompaktStand(): { offen: boolean; live: boolean; durch: boolean; grund: string; datei: string; kampf: number | null } {
  return { offen: kompaktWindow() !== null, live: kompakt.start.live, durch: kompakt.start.durch,
    grund: vollStand.grund, datei: vollStand.datei, kampf: vollStand.kampf };
}

/* Whether compact can be a window of its own here: in the app's own window
   on Windows with Acrylic (11 22H2 and later). Elsewhere - Linux, older
   Windows - compact shrinks full view as before, and so it does for the page
   in a browser, which has no window of the app to ask. */
export function kompaktMoeglich(): boolean {
  return currentWindow() !== null && acrylicSupported();
}

/*
 * The frame is painted before the page in it exists, so the app writes the
 * theme it resolved last time into the config and this reads it back.
 * Otherwise a light theme opens on a near-black window for a moment.
 */
function backgroundFor(theme: unknown): string {
  if (theme === "light") return "#d8e1e0";
  if (theme === "tnl") return "#0e1122";
  return "#060402";
}

export function createWindow(url: string, iconPath: string): BrowserWindow {
  const cfg = loadConfig();
  /* Full view's place from last time (spec Fenster-Extras 3.4) while its
     title bar is still on a monitor, else the middle of the main monitor;
     nothing remembered: Electron's default, centred. */
  const platz = platzGross(teilAus(loadConfig().fenster, "gross"), monitore(), hauptmonitor());
  const win = new BrowserWindow({
    title: "Borometer",
    width: platz ? platz.w : WINDOW_W,
    height: platz ? platz.h : WINDOW_H,
    ...(platz ? { x: platz.x, y: platz.y } : {}),
    /*
     * 24 high: without a fight, compact shrinks to a strip of 26 points, and
     * a higher minimum would turn that back into a window with empty ground
     * below it.
     */
    minWidth: 180,
    minHeight: 24,
    // Windows draws the frame: the buttons (with snap layouts on maximise),
    // the border to resize by, the corners and the shadow. The page's own
    // header is the title bar and marks where the window can be dragged.
    titleBarStyle: "hidden",
    titleBarOverlay: overlayFor(cfg.themeResolved),
    backgroundColor: backgroundFor(cfg.themeResolved),
    icon: iconPath,
    show: false,
    // the page's preferences, the same as the compact window's (SEITE above)
    webPreferences: SEITE,
  });
  state.win = win;
  state.prev = null;
  state.prevMax = false;
  state.max = false;
  state.header = undefined;
  state.through = false;
  state.compact = false;
  state.placed = platz !== null;
  borderInTheme(win, cfg.themeResolved);
  watchTransparency();
  // A page that (re)loads starts in full view with live logging off and
  // knows nothing of what its predecessor set on this window: click-through,
  // compact's Acrylic with the buttons hidden, the taskbar dot. All of it
  // goes back to what a fresh full view has, so a reload (Ctrl+R, a crash)
  // cannot leave a window that ignores the mouse or has no buttons.
  win.webContents.on("did-finish-load", () => {
    if (state.through) {
      win.setIgnoreMouseEvents(false);
      state.through = false;
    }
    if (acrylicSupported()) win.setBackgroundMaterial("none");
    state.compact = false;
    // A page reloaded in compact had shrunk the window to the strip; the new
    // one starts in full view, so full view's place comes back (backToFull).
    backToFull(win);
    /*
     * At the height the page last sent, not at 100 %: the page sends its
     * zoomed height as soon as it knows it is in the native frame, and that
     * can arrive before this event. Reset to CHROME_HEIGHT afterwards, the buttons sat
     * too low at 150 % until the next theme or size change.
     */
    win.setTitleBarOverlay(overlayFor(loadConfig().themeResolved, state.header));
    borderInTheme(win, loadConfig().themeResolved);
    setLiveBadge(win, false);
  });
  /*
   * Compact sizes its window from the rows it shows, and would put that size
   * straight back on the next render after someone dragged the border. On
   * Windows will-resize fires only for a resize by hand (the border, the
   * corners), never for setContentSize below - the flag covers that anyway,
   * in case a platform ever reports its own resize as one. The page learns
   * of it through the event channel and keeps the size from then on.
   */
  win.on("will-resize", () => {
    if (!state.sizing) bump("handsize");
  });
  /* Where the window is, written 500 ms after the last move or resize
     (lage.ts). What this process moves or sizes itself (state.sizing) is no
     place anyone chose. Closing writes what is still waiting. */
  const bewegt = (): void => {
    if (!state.sizing) merker.ereignis();
  };
  win.on("move", bewegt);
  win.on("resize", bewegt);
  win.on("maximize", bewegt);
  win.on("unmaximize", bewegt);
  win.on("close", () => merker.jetzt());
  // nativeTheme may not report a change of "Transparency effects" as
  // "updated" (its documentation names only colours); coming back to the
  // window looks again
  win.on("focus", transparencyChanged);

  /* Shown on whichever comes first. Electron 44 never fires ready-to-show for
   * a window with titleBarStyle "hidden" and a titleBarOverlay (measured on
   * Windows 11: plain, "hidden" alone and frameless windows fire it after
   * ~250 ms, the overlay ones never), so the window would stay invisible.
   * did-finish-load comes a moment earlier than a first paint, which the
   * backgroundColor above covers. */
  const reveal = (): void => {
    if (win.isDestroyed() || win.isVisible()) return;
    // maximised last time: maximised again, on the monitor its place is on
    if (platz?.max) win.maximize();
    win.show();
  };
  win.once("ready-to-show", reveal);
  win.webContents.once("did-finish-load", reveal);
  // a page that fails to load must still show a window (with Chromium's
  // error page), not leave a process running with nothing on screen
  win.webContents.once("did-fail-load", reveal);
  win.on("maximize", () => (state.max = true));
  win.on("unmaximize", () => (state.max = false));
  win.on("closed", () => {
    if (state.win === win) state.win = null;
    // the strip does not outlive full view: closing full view ends the app
    kompaktWindow()?.close();
  });

  const origin = new URL(url).origin;
  seite.origin = origin;
  seite.icon = iconPath;
  nurEigeneSeite(win, origin);

  void win.loadURL(url);
  return win;
}

/*
 * What both windows show is this app's own page and nothing else: links out
 * of the app open in the real browser, never inside the meter, and no window
 * opens another (safety audit 8b).
 */
function nurEigeneSeite(win: BrowserWindow, origin: string): void {
  const external = (target: string): boolean => {
    try {
      const u = new URL(target);
      return u.origin !== origin && (u.protocol === "https:" || u.protocol === "http:");
    } catch {
      return false;
    }
  };
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (external(target)) void shell.openExternal(target);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin === origin) return;
    event.preventDefault();
    if (external(target)) void shell.openExternal(target);
  });
  /*
   * Ctrl+wheel only asks for a zoom here; nothing applies it. The page has its
   * own size setting on Ctrl+plus and Ctrl+minus, and a second, browser-level
   * zoom on top would make the compact window measure itself wrong.
   */
  win.webContents.on("zoom-changed", () => win.webContents.setZoomLevel(0));
}

/*
 * The compact window (spec Nachtraege N4): borderless, always on top, not in
 * the taskbar, on Acrylic where Windows has it. The same page with
 * ?kompakt=1, so it starts as the strip; full view stays where it is.
 * Shown without taking the focus: it is opened over a running game, often by
 * the hotkey, and the game keeps the keyboard.
 */
function openKompakt(start: { live: boolean; durch: boolean }): boolean {
  if (!kompaktMoeglich() || !seite.origin) return false;
  kompakt.start = start;
  const offen = kompaktWindow();
  if (offen) {
    offen.showInactive();
    offen.moveTop();
    return true;
  }
  const cfg = loadConfig();
  // compact's remembered corner while it is still on a monitor (lage.ts)
  const p = platzKompakt(teilAus(loadConfig().fenster, "kompakt"), monitore(), hauptmonitor());
  const kw = new BrowserWindow({
    title: "Borometer",
    width: 300,
    height: 170,
    ...(p ? { x: p.x, y: p.y } : {}),
    minWidth: MIN_ACTION_W,
    minHeight: MIN_ACTION_H,
    // no title bar and no system buttons: the strip carries its own close
    titleBarStyle: "hidden",
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: backgroundFor(cfg.themeResolved),
    icon: seite.icon,
    show: false,
    // the page's preferences, the same as full view's (SEITE above)
    webPreferences: SEITE,
  });
  kompakt.win = kw;
  kompakt.through = false;
  // a new strip measures itself anew: its limit starts from its first size
  streifen.grenze = { w: 0, h: 0 };
  streifen.vorMenue = null;
  const material = (): void => {
    if (!acrylicSupported()) return;
    const acrylic = materialFor(true, nativeTheme.prefersReducedTransparency) === "acrylic";
    kw.setBackgroundMaterial(acrylic ? "acrylic" : "none");
  };
  material();
  borderInTheme(kw, cfg.themeResolved);
  // a reload starts the page anew: the mouse comes back to the window
  kw.webContents.on("did-finish-load", () => {
    if (kompakt.through) {
      kw.setIgnoreMouseEvents(false);
      kompakt.through = false;
    }
    material();
  });
  const zeigen = (): void => {
    if (!kw.isDestroyed() && !kw.isVisible()) kw.showInactive();
  };
  kw.webContents.once("did-finish-load", zeigen);
  kw.webContents.once("did-fail-load", zeigen);
  // a hand on the border: the strip keeps that size (the page hears of it)
  kw.on("will-resize", () => {
    if (!state.sizing) bump("kompakthand");
  });
  kw.on("move", () => {
    if (!state.sizing) kompaktMerker.ereignis();
  });
  kw.on("close", () => kompaktMerker.jetzt());
  kw.on("closed", () => {
    if (kompakt.win === kw) {
      kompakt.win = null;
      kompakt.through = false;
    }
    bump("kompakt");
  });
  nurEigeneSeite(kw, seite.origin);
  void kw.loadURL(`${seite.origin}/?win=1&kompakt=1`);
  bump("kompakt");
  return true;
}

/*
 * The strip stays a strip (Kompakt-Fix 01.10.2026): the compact window could
 * be dragged to any size, as big as a monitor. Its maximum is now twice the
 * largest strip the page measured since it opened - twice the width for a
 * longer name column, twice the height for about twice the rows (the strip
 * shows its Top 5; a bigger window shows more of the table). Measured at
 * 100 % (review N1): the strip with a fight is 300 x 235 (its first pass
 * measures 244), without one 300 x 28, with its longest resting sentence
 * 326 (EN) or 382 (DE) wide. The limit so ends between 600 x 56 (bare
 * strip) and 764 x 488, at most about a fifth of a 1920 x 1080 monitor.
 * The limit only grows, so a hand-sized window is never squeezed by a later,
 * smaller measurement. The page names the size in every resize: "streifen"
 * sizes the window, "hand" (a hand holds the size) only moves the limit,
 * "menue" and "zurueck" make room for the strip's menu (menueAuf below).
 * Full view never gets a maximum.
 */
const KOMPAKT_MAX_FAKTOR = 2;
const STREIFEN_ARTEN = ["streifen", "hand", "menue", "zurueck"];
const streifen = {
  grenze: { w: 0, h: 0 },
  /** while the menu is open: the strip's outer bounds before it (outer: a content size read and set
      again came back a point narrower at 200 % scaling), and whether the menu lifted it */
  vorMenue: null as { w: number; h: number; x: number; y: number; gehoben: boolean } | null,
};

/* setMaximumSize counts the outer size; the strip measures its content. */
function grenzeSetzen(kw: BrowserWindow, w: number, h: number): void {
  const [ow = 0, oh = 0] = kw.getSize();
  const [cw = 0, ch = 0] = kw.getContentSize();
  kw.setMaximumSize(w + ow - cw, h + oh - ch);
}

/* While the menu is open it holds the window: a strip measured meanwhile
   only moves the limit, and closing the menu sizes back and sets it. The
   limit never passes the monitor's work area (review N2): one bad
   measurement - or a size beyond what setMaximumSize takes - must not lift
   it for good. */
function streifenGroesse(kw: BrowserWindow, w: number, h: number, art: string): void {
  if (art === "menue") return menueAuf(kw, w, h);
  if (art === "zurueck") return menueZu(kw);
  const a = screen.getDisplayMatching(kw.getBounds()).workArea;
  streifen.grenze.w = Math.min(a.width, Math.max(streifen.grenze.w, KOMPAKT_MAX_FAKTOR * w));
  streifen.grenze.h = Math.min(a.height, Math.max(streifen.grenze.h, KOMPAKT_MAX_FAKTOR * h));
  if (streifen.vorMenue) return;
  grenzeSetzen(kw, streifen.grenze.w, streifen.grenze.h);
  if (art === "streifen") sizeBySelf(kw, w, h);
}

/*
 * The strip's menu (Kompakt-Fix 01.10.2026): it hung below a 28-point strip
 * and was cut off. Inside the strip it does not fit - about 540 points of
 * menu in a strip of 28 without a fight and 235 with one - so the window
 * grows for it while it is open and comes back to the size before when it
 * closes, also a size set by hand. Never smaller, and never off its
 * monitor's work area: a menu that would run past the bottom lifts the
 * window by as much, and closing puts it back. The limit makes room for the
 * menu meanwhile and is set again on closing.
 */
function menueAuf(kw: BrowserWindow, w: number, h: number): void {
  const o = kw.getBounds();
  const [cw = 0, ch = 0] = kw.getContentSize();
  if (!streifen.vorMenue) streifen.vorMenue = { w: o.width, h: o.height, x: o.x, y: o.y, gehoben: false };
  const nw = Math.max(cw, w);
  const nh = Math.max(ch, h);
  grenzeSetzen(kw, Math.max(streifen.grenze.w, nw), Math.max(streifen.grenze.h, nh));
  sizeBySelf(kw, nw, nh);
  const a = screen.getDisplayMatching(o).workArea;
  const ueber = o.y + o.height - ch + nh - (a.y + a.height);
  if (ueber > 0) {
    positionBySelf(kw, { x: o.x, y: Math.max(a.y, o.y - ueber) });
    streifen.vorMenue.gehoben = true;
  }
}

function menueZu(kw: BrowserWindow): void {
  const v = streifen.vorMenue;
  if (!v) return;
  streifen.vorMenue = null;
  const b = kw.getBounds();
  boundsBySelf(kw, { x: b.x, y: v.gehoben ? v.y : b.y, w: v.w, h: v.h, max: false });
  if (streifen.grenze.w > 0) grenzeSetzen(kw, streifen.grenze.w, streifen.grenze.h);
}

/* The strip closes; from its "Vollansicht" full view comes forward as well. */
function schliesseKompakt(zeigen: boolean): void {
  kompaktWindow()?.close();
  const win = currentWindow();
  if (!zeigen || !win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

type Answer = { status: number; body: Json };

const ok = (body: Json = {}): Answer => ({ status: 200, body: { ok: true, ...body } });
const fail = (error: string): Answer => ({ status: 200, body: { ok: false, error } });

function describe(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/** A resize this process makes, which will-resize must not take for a hand. */
function sizeBySelf(win: BrowserWindow, w: number, h: number): void {
  state.sizing = true;
  try {
    win.setContentSize(w, h);
  } finally {
    state.sizing = false;
  }
}

/*
 * The border (Windows 11) and Windows' own menus in the theme (spec
 * Fenster-Extras 3.1, 3.2). The page names a theme, never a colour: the
 * colour comes from chrome.ts's fixed table. setAccentColor exists on
 * Windows only.
 */
function borderInTheme(win: BrowserWindow, theme: unknown): void {
  if (process.platform === "win32") win.setAccentColor(borderFor(theme));
  nativeTheme.themeSource = themeSourceFor(theme, loadConfig().theme);
}

/** After POST /api/config changed theme or themeResolved (server.ts). */
export function themeChanged(): void {
  const win = currentWindow();
  if (win) borderInTheme(win, loadConfig().themeResolved);
  const kw = kompaktWindow();
  if (kw) borderInTheme(kw, loadConfig().themeResolved);
}

/** Whether compact can sit on Acrylic right now (GET /api/state). */
export function acrylicNow(): boolean {
  return acrylicSupported() && !nativeTheme.prefersReducedTransparency;
}

/*
 * Windows' "Transparency effects" switched while the app runs (3.3).
 * nativeTheme raises "updated" for this and for much else - setting
 * themeSource raises it too - so only a real change of the value counts.
 * Compact changes its material at once; the page hears of it through the
 * event channel and asks /api/state again.
 */
function transparencyChanged(): void {
  const reduced = nativeTheme.prefersReducedTransparency;
  if (reduced === state.reduced) return;
  state.reduced = reduced;
  const acrylic = materialFor(true, reduced) === "acrylic";
  const win = currentWindow();
  if (win && state.compact && acrylicSupported()) win.setBackgroundMaterial(acrylic ? "acrylic" : "none");
  // the compact window is compact all the time
  const kw = kompaktWindow();
  if (kw && acrylicSupported()) kw.setBackgroundMaterial(acrylic ? "acrylic" : "none");
  bump("material");
}

let transparencyWatched = false;
/** Once per app: there is one nativeTheme for all windows. */
function watchTransparency(): void {
  if (transparencyWatched) return;
  transparencyWatched = true;
  state.reduced = nativeTheme.prefersReducedTransparency;
  nativeTheme.on("updated", transparencyChanged);
}

/* The monitors' work areas, in DIP; empty or null before any reports in. */
function monitore(): Monitor[] {
  try {
    return screen.getAllDisplays().map((d) => d.workArea);
  } catch {
    return [];
  }
}
function hauptmonitor(): Monitor | null {
  try {
    return screen.getPrimaryDisplay().workArea;
  } catch {
    return null;
  }
}

/* Only here is "fenster" written, and only what lage.ts let through. */
function merkeLage(teil: Teil, neu: unknown): void {
  const fenster = fensterNeu(loadConfig().fenster, teil, neu);
  if (fenster) updateConfig({ fenster });
}

/* What is remembered: full view's bounds before maximising and whether it
   was maximised, or compact's top-left corner. Nothing while minimised.
   Compact is whatever holds the size from before it (state.prev). */
function lageSchreiben(): void {
  const win = currentWindow();
  if (!win || win.isMinimized()) return;
  const b = win.getNormalBounds();
  if (state.prev) merkeLage("kompakt", { x: b.x, y: b.y });
  else merkeLage("gross", { x: b.x, y: b.y, w: b.width, h: b.height, max: win.isMaximized() });
}

const merker = neuerMerker(lageSchreiben, {
  stelle: (fn, ms) => setTimeout(fn, ms),
  loesche: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
});

/* The compact window's corner, remembered as compact's (N4): the same part
   "kompakt" the shrunk full view writes, so either finds it. */
function kompaktLageSchreiben(): void {
  const kw = kompaktWindow();
  if (!kw) return;
  const b = kw.getBounds();
  merkeLage("kompakt", { x: b.x, y: b.y });
}

const kompaktMerker = neuerMerker(kompaktLageSchreiben, {
  stelle: (fn, ms) => setTimeout(fn, ms),
  loesche: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
});

/** A move this process makes, not remembered as a place (see bewegt). */
function positionBySelf(win: BrowserWindow, p: LageKompakt): void {
  state.sizing = true;
  try {
    win.setPosition(p.x, p.y);
  } finally {
    state.sizing = false;
  }
}

function boundsBySelf(win: BrowserWindow, g: LageGross): void {
  state.sizing = true;
  try {
    win.setBounds({ x: g.x, y: g.y, width: g.w, height: g.h });
  } finally {
    state.sizing = false;
  }
}

/* Compact goes to its own remembered corner; without one it stays put. */
function kompaktHin(win: BrowserWindow): void {
  const p = platzKompakt(teilAus(loadConfig().fenster, "kompakt"), monitore(), hauptmonitor());
  if (p) positionBySelf(win, p);
}

/*
 * Leaving compact, and a page reloaded in compact: full view's remembered
 * place, maximised again if it was. Without one, the size from before
 * compact as before. Compact's last corner is written first, while
 * state.prev still says compact.
 */
function backToFull(win: BrowserWindow): void {
  const prev = state.prev;
  if (!prev) return;
  merker.jetzt();
  const g = platzGross(teilAus(loadConfig().fenster, "gross"), monitore(), hauptmonitor());
  if (g) boundsBySelf(win, g);
  else sizeBySelf(win, prev[0], prev[1]);
  const max = g ? g.max : state.prevMax;
  state.prev = null;
  state.prevMax = false;
  if (max) {
    win.maximize();
    state.max = true;
  }
}

/** Whether the window opened at a remembered place (GET /api/config). */
export function windowPlaced(): boolean {
  return currentWindow() !== null && state.placed;
}

function int(v: unknown): number {
  const n = Math.trunc(Number(v));
  return isFinite(n) ? n : 0;
}

/* What the compact window may be asked (N4): it has no frame buttons, no
   material the page switches and no size setting of its own. */
const KOMPAKT_AKTIONEN = ["kompakt", "close", "resize", "pin", "seethrough", "clickthrough"];

export function winAction(sent: Json): Answer {
  const action = String(sent.do ?? "").trim();
  // which window is meant: "main" (full view, also when the page names none) or "kompakt"
  const welches = sent.win ?? "main";
  if (welches !== "main" && welches !== "kompakt") return fail("unknown window");
  if (welches === "kompakt" && !KOMPAKT_AKTIONEN.includes(action)) return fail("not for the compact window");
  const win = welches === "kompakt" ? kompaktWindow() : currentWindow();
  if (!win) return fail("no window");
  try {
    switch (action) {
      case "close":
        win.close();
        break;
      case "minimize":
        win.minimize();
        break;
      case "kompakt": {
        /*
         * The compact window opens or closes (N4). Three flags from the page
         * and nothing else: on, whether live logging runs in full view (the
         * strip follows it) and whether the hotkey asked for it (the strip
         * starts click-through). Closing from the strip ("Vollansicht")
         * brings full view forward.
         */
        if (sent.on) {
          if (!openKompakt({ live: !!sent.live, durch: !!sent.durch })) return fail("no compact window here");
        } else {
          schliesseKompakt(true);
        }
        return ok({ offen: kompaktWindow() !== null });
      }
      case "stand": {
        /*
         * What full view shows, for the strip (Kompakt-Fix 01.10.2026; see
         * vollStand above). Full view only - the compact window's own list
         * does not have it. A reason from STAND_GRUENDE; with "datei" a
         * bare log file name (logName) and a fight's start (kampfZeit). A
         * name that is no bare log name keeps nothing of it: the strip then
         * says the file is not in the log folder ("fremd").
         * Kept as given and passed on through GET /api/state; nothing here
         * opens, lists or reads a file.
         */
        const grund = STAND_GRUENDE.find((g) => g === sent.grund);
        if (!grund) return fail("unknown state");
        const datei = grund === "datei" ? logName(sent.datei) : "";
        vollStand.grund = grund === "datei" && !datei ? "fremd" : grund;
        vollStand.datei = datei;
        vollStand.kampf = datei ? kampfZeit(sent.kampf) : null;
        bump("kompaktstand");
        return ok();
      }
      case "resize": {
        // compact shrinks the real window to fit the meter, and remembers the
        // old size so Full view can restore it. Content size, not outer size:
        // the native frame has invisible resize borders, so setSize(w, h)
        // left the page 16px narrower than it had measured and pushed the
        // strip's close button past the window edge.
        // A size under the floor is raised to it, not dropped: the page
        // measures the strip in its own units, and a strip a point lower
        // than Windows allows is still a strip. Zero or less is no size.
        const w = int(sent.w);
        const h = int(sent.h);
        // The compact window is the strip already: its size, and nothing
        // to come back to.
        // Its maximum follows the strip (streifenGroesse, Kompakt-Fix 2).
        if (win !== state.win) {
          const art = STREIFEN_ARTEN.find((a) => a === sent.art) ?? "streifen";
          if (w > 0 && h > 0) streifenGroesse(win, Math.max(w, MIN_ACTION_W), Math.max(h, MIN_ACTION_H), art);
          break;
        }
        if (w > 0 && h > 0) {
          // Entering compact: full view's place is written now, before
          // anything below moves the window.
          const entering = !state.prev;
          if (entering) merker.jetzt();
          // Leave the maximized state before sizing: a resized window that
          // Windows still treats as maximized can snap back to the full
          // monitor on the next window-manager event. Before the size is
          // remembered, so it is the restored size and not the monitor's;
          // whether it was maximised is remembered beside it.
          const wasMax = win.isMaximized();
          if (wasMax) win.unmaximize();
          if (!state.prev) {
            state.prev = win.getContentSize() as [number, number];
            state.prevMax = wasMax;
          }
          state.max = false;
          sizeBySelf(win, Math.max(w, MIN_ACTION_W), Math.max(h, MIN_ACTION_H));
          // compact's own corner, if one is remembered
          if (entering) kompaktHin(win);
          // leaving a maximised window moves it before sizing starts; that
          // move was ours, not a place someone chose for compact
          if (entering) merker.halt();
        }
        break;
      }
      case "restore_size":
        // full view's place, or the size from before compact (backToFull)
        backToFull(win);
        break;
      case "size": {
        /*
         * Full view follows the app's own size setting: at 150 % the page
         * asks for a window half as big again. Unlike resize this is not a
         * "size before compact" to come back to, so state.prev stays as it
         * is. Content size through sizeBySelf, so will-resize does not count
         * it as a hand on the border; the same floor as resize. Here a
         * request under it is left out rather than raised: full view scales
         * a window of hundreds of points, and one of 180 x 24 would be a
         * bad measurement, not a size anyone asked for.
         */
        // A maximised window stays maximised: the size setting scales a
        // window, it is no reason to drop out of a state someone chose.
        // The answer still carries the current content size.
        if (win.isMaximized()) break;
        const w = int(sent.w);
        const h = int(sent.h);
        if (w >= MIN_ACTION_W && h >= MIN_ACTION_H) sizeBySelf(win, w, h);
        break;
      }
      case "pin": {
        /*
         * "Stay on top" is a single window-manager flag on our own window: it
         * changes stacking order only. It does not touch the game process,
         * read its memory or hook its renderer - the same mechanism a pinned
         * Discord or browser window uses while gaming.
         */
        const want = !!sent.on;
        win.setAlwaysOnTop(want);
        // Only a pin made in compact is kept for the next start; the page
        // sends remember:false for a pin in the full view (frame spec 3.1).
        // The compact window (N4) is on top by itself: its pin is never kept.
        updateConfig({ stayOnTop: want && sent.remember !== false && win === state.win });
        return ok({ on_top: want });
      }
      case "seethrough": {
        /*
         * Compact's see-through: the uniform alpha of our own window. It
         * composites this window against whatever the desktop already drew.
         * It does not read the screen, touch the game or hook any renderer.
         * Floored well above invisible: a window you cannot find is not a
         * setting anyone wants to have chosen by accident.
         */
        let alpha = Number(sent.alpha);
        if (!isFinite(alpha)) alpha = 1;
        alpha = Math.max(0.35, Math.min(1, alpha));
        if (process.platform !== "win32" && process.platform !== "darwin") {
          return fail("this window cannot fade");
        }
        win.setOpacity(alpha);
        updateConfig({ compactAlpha: alpha });
        return ok({ alpha });
      }
      case "clickthrough": {
        /*
         * Compact's click-through: our own window stops taking the mouse, so
         * a click lands on whatever is underneath - the game. One flag on this
         * window, nothing else; `forward` keeps mouse moves coming so the page
         * still knows where the pointer is. Only Ctrl+Shift+D turns it off
         * again (hotkey.ts), because nothing in the window can be clicked.
         */
        const want = !!sent.on;
        win.setIgnoreMouseEvents(want, want ? { forward: true } : undefined);
        if (win === state.win) state.through = want;
        else kompakt.through = want;
        return ok({ clickthrough: want });
      }
      case "chrome": {
        /*
         * The frame's buttons follow the theme and the header's height. The
         * page sends a theme name and the height its header has at its own
         * size setting; the colours come from chrome.ts, never from the
         * request, and chrome.ts clamps the height to a whole number.
         */
        win.setTitleBarOverlay(overlayFor(sent.theme, sent.height));
        state.header = sent.height;
        borderInTheme(win, sent.theme);
        break;
      }
      case "material": {
        /*
         * Compact on Acrylic: Windows blurs what lies behind this window and
         * the page's own ground becomes a tint, so the figures stay solid
         * while the game shows through. Two values only, and full view goes
         * back to no material with its buttons. The page sends this on every
         * compact switch in the native frame: the system buttons (CHROME_HEIGHT) must
         * leave the 26px strip even where Windows has no Acrylic (before
         * 22H2), and there the ground simply stays solid.
         */
        // Windows' "Transparency effects" off: compact on its solid ground,
        // its buttons hidden all the same (spec Fenster-Extras 3.3)
        const compact = sent.kind === "acrylic";
        const acrylic = materialFor(compact, nativeTheme.prefersReducedTransparency) === "acrylic";
        state.compact = compact;
        if (acrylicSupported()) win.setBackgroundMaterial(acrylic ? "acrylic" : "none");
        if (compact) win.setTitleBarOverlay({ color: "#00000000", symbolColor: "#00000000", height: 1 });
        else win.setTitleBarOverlay(overlayFor(sent.theme, sent.height));
        state.header = sent.height;
        borderInTheme(win, sent.theme);
        return ok({ material: acrylic ? "acrylic" : "none" });
      }
      case "live": {
        // the taskbar dot follows the page's own live-logging state
        setLiveBadge(win, !!sent.on);
        break;
      }
      case "maximize":
        if (state.max || win.isMaximized()) {
          win.unmaximize();
          state.max = false;
        } else {
          win.maximize();
          state.max = true;
        }
        break;
      default:
        return { status: 200, body: { ok: false } };
    }
  } catch (err) {
    return fail(describe(err));
  }
  // Full view's size setting chose this size: remembered like a hand's
  // (spec Fenster-Extras, addendum 4), or leaving compact would bring back
  // the size from before the setting changed.
  if (action === "size") merker.ereignis();
  // report what the window actually ended up as, so a resize the platform
  // silently ignored can be seen rather than guessed at - in the same
  // content size the page asked for, so the comparison there holds
  const [w, h] = win.isDestroyed() ? [null, null] : win.getContentSize();
  return ok({ max: state.max, w, h });
}

export function iconFile(resourcesDir: string): string {
  return path.join(resourcesDir, process.platform === "win32" ? "icon.ico" : "icon.png");
}
