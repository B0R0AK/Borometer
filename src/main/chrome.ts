// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * What the native frame looks like, per theme. Windows draws minimise,
 * maximise (with its snap layouts) and close over the page's own header;
 * the page only ever names a theme, never a colour, so nothing it sends can
 * paint the frame.
 */

import * as os from "node:os";

/** the page's title bar height (--chrome in styles.css) at a UI size of 100 %;
    36 since the companion-app redesign (spec 2026-09-28, gap 0.2), 40 before */
export const CHROME_HEIGHT = 36;
/* The page scales its header with its own size setting (10-200 %) and sends
   the height it ends up with. Only a whole number in this range reaches
   Windows: a page value can move the buttons' height, nothing else. */
const MIN_HEADER = 20;
const MAX_HEADER = 96;

function headerHeight(height: unknown): number {
  const n = Math.round(Number(height));
  if (height == null || !isFinite(n)) return CHROME_HEIGHT;
  return Math.min(MAX_HEADER, Math.max(MIN_HEADER, n));
}

/* The symbols in the ink of the title bar's quiet buttons (--dim), as in the
   draft of 2026-09-28 (DECISION 0.15: keep titleBarOverlay, match height and
   colours). --dim is 8.2:1 (dark), 6.3:1 (light) and 7.3:1 (TnL) against
   the ground (--pitch); smoked glass (spec Rauchglas 3.1) 8.6:1 on its solid
   ground #1a1817 and 5.8:1 over the assumed worst Mica (#4a4a4a under the
   frame tint). The page's own buttons beside them use the same ink. */
const SYMBOL: Record<string, string> = {
  dark: "#b3a189",   // --dim, dark
  light: "#41514c",  // --dim, light
  tnl: "#aaa18f",    // --dim, TnL
  glas: "#bdb4a7",   // --dim, smoked glass
};

export function overlayFor(theme: unknown, height?: unknown): { color: string; symbolColor: string; height: number } {
  // own keys only: "constructor" or "toString" must not pass as a theme
  const key = typeof theme === "string" && Object.hasOwn(SYMBOL, theme) ? theme : "dark";
  // transparent ground: the header behind the buttons is the page's own
  return { color: "#00000000", symbolColor: SYMBOL[key]!, height: headerHeight(height) };
}

/** Acrylic and Mica behind a window exist from Windows 11 22H2 (build 22621):
    Electron's setBackgroundMaterial needs that build for either. */
export function acrylicSupported(): boolean {
  if (process.platform !== "win32") return false;
  const build = Number(os.release().split(".")[2] ?? 0);
  return build >= 22621;
}

/*
 * The window border on Windows 11 (setAccentColor, spec Fenster-Extras 3.1):
 * the theme's quiet edge, not its accent (the glow rule). --hair-rule-strong
 * laid over the ground (--pitch) and written out opaque, because Windows
 * ignores alpha here:
 *   dark   rgba(198,214,226,.158) over #060402 = #242525, 1.33:1 against the ground
 *   light  rgba(30,58,56,.24)     over #d8e1e0 = #abb9b8, 1.52:1
 *   tnl    rgba(196,107,176,.24)  over #0e1122 = #3a2744, 1.38:1
 *   glas   rgba(255,255,255,.15)  over #1a1817 = #3c3b3a, 1.55:1
 * A hairline, not a frame: the contrast is meant to be low.
 */
const BORDER: Record<string, string> = {
  dark: "#242525",
  light: "#abb9b8",
  tnl: "#3a2744",
  glas: "#3c3b3a",
};

export function borderFor(theme: unknown): string {
  const key = typeof theme === "string" && Object.hasOwn(BORDER, theme) ? theme : "dark";
  return BORDER[key]!;
}

/*
 * Windows' own menus, dialogs and scrollbars follow the app's theme (3.2):
 * light is "light", dark and TnL are "dark". The setting "auto" follows the
 * system: nativeTheme.themeSource also decides what the page's
 * prefers-color-scheme reports, and "auto" is resolved from exactly that
 * query - a fixed value here would freeze "auto" on what it saw last.
 */
export function themeSourceFor(resolved: unknown, setting: unknown): "system" | "light" | "dark" {
  if (setting === "auto") return "system";
  return resolved === "light" ? "light" : "dark";
}

/*
 * The window's material (spec Fenster-Extras 3.3, Rauchglas 3.1): compact
 * sits on Acrylic, full view on Acrylic too, but only in the theme smoked
 * glass, and nothing at all with Windows' "Transparency effects" off. The
 * theme is a name the page sent or the config holds; only an exact match
 * counts, so no word from a request can become a material.
 * Full view was on Mica until #189. Mica only ever shows a blurred copy of
 * the desktop wallpaper, never the windows behind, and Windows swaps it for
 * a solid colour whenever the window is not the active one: on a one-colour
 * desktop, or beside the game, smoked glass was plain grey. Acrylic blurs
 * what really lies behind the window and stays when it loses the focus.
 * The page still calls this ground "mica" (GET /api/state, html.mica).
 */
export function materialFor(compact: boolean, reducedTransparency: boolean, theme: unknown): "acrylic" | "none" {
  if (reducedTransparency) return "none";
  if (compact) return "acrylic";
  return theme === "glas" ? "acrylic" : "none";
}
