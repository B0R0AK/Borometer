// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The notifications: after a fight, and a weeklies reminder (spec Weeklies
 * neu, 6). Both are built in zeige() and nowhere else. The page cuts
 * the fight and writes the two lines in its own words; this file checks
 * them, asks the settings and shows one notification with two buttons:
 * View brings the window forward, Compact does what the taskbar preview's
 * button does. No toastXml: Electron 44 takes actions on Windows and puts
 * the texts in itself, so nothing from the page is ever built into XML.
 */

import { BrowserWindow, Notification } from "electron";
import { loadConfig } from "./config";
import { bump } from "./events";
import { APP_NAME } from "./paths";
import { kampfMeldung, sollMelden, vorholen, wort } from "./windows-core";

/* No control characters in a notification text. */
const STEUER = /[\u0000-\u001f\u007f]/;

/* The last one is held until the next: a notification the garbage
   collector takes loses its clicks. */
const letzte = { n: null as Notification | null, wann: null as number | null };

type Art = "kampf" | "erinnerung";

/* A click or the View button: the window comes forward; a reminder also asks
   the page to open the weeklies. */
function nach(art: Art, win: BrowserWindow | null): void {
  if (art === "erinnerung") bump("weeklies");
  vorholen(win && !win.isDestroyed() ? win : null);
}

/* The one place a notification is built (spec Weeklies neu, 9): the fight's
   report and a reminder share it. A reminder has one button, View. */
function zeige(win: BrowserWindow | null, icon: string, art: Art, titel: string, satz: string): void {
  const cfg = loadConfig();
  const n = new Notification({
    title: titel,
    body: satz,
    icon,
    actions: art === "kampf" ? [{ type: "button", text: wort(cfg.lang, "ansehen") }, { type: "button", text: wort(cfg.lang, "kompaktFenster") }] : [{ type: "button", text: wort(cfg.lang, "ansehen") }],
  });
  n.on("click", () => nach(art, win));
  n.on("action", (e) => {
    if (art === "kampf" && e.actionIndex === 1) bump("compact");
    else nach(art, win);
  });
  n.show();
  letzte.n = n;
}

/** null: the report was refused. Otherwise whether it was shown. */
export function meldeKampf(win: BrowserWindow | null, icon: string, titel: unknown, satz: unknown, best: unknown): boolean | null {
  const m = kampfMeldung(titel, satz, best);
  if (!m) return null;
  if (process.platform !== "win32" || !Notification.isSupported()) return false;
  const cfg = loadConfig();
  const vorn = !!win && win.isVisible() && win.isFocused();
  const jetzt = Date.now();
  if (!sollMelden(cfg, m.best, vorn, jetzt, letzte.wann)) return false;
  zeige(win, icon, "kampf", m.titel, m.satz);
  letzte.wann = jetzt;
  return true;
}

/** Shows a reminder. false: not on Windows, or the text is not one. The text is the stored one, never one from the page. */
export function meldeErinnerung(win: BrowserWindow | null, icon: string, text: string): boolean {
  if (process.platform !== "win32" || !Notification.isSupported()) return false;
  if (!text || text.length > 240 || STEUER.test(text)) return false;
  zeige(win, icon, "erinnerung", APP_NAME, text);
  return true;
}
