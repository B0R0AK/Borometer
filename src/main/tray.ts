// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The icon in the notification area (spec Windows-Einbindung 4). A left
 * click brings the window forward; a right click builds the menu afresh,
 * so its ticks and its language are always the current ones. Every item
 * raises an event the page acts on like its own button (events.ts), shows
 * the window or quits - nothing else.
 */

import { app, BrowserWindow, Menu, Tray } from "electron";
import { APP_NAME } from "./paths";
import { loadConfig } from "./config";
import { bump } from "./events";
import { liveAn } from "./taskbar";
import { vorholen, wort } from "./windows-core";

const halter = { tray: null as Tray | null };

export function setupTray(icon: string, holeFenster: () => BrowserWindow | null): void {
  if (process.platform !== "win32" || halter.tray) return;
  const tray = new Tray(icon);
  halter.tray = tray;
  tray.setToolTip(APP_NAME);
  tray.on("click", () => vorholen(holeFenster()));
  tray.on("right-click", () => {
    const lang = loadConfig().lang;
    tray.popUpContextMenu(Menu.buildFromTemplate([
      { label: wort(lang, "oeffnen"), click: () => vorholen(holeFenster()) },
      { label: wort(lang, "kompaktFenster"), click: () => bump("compact") },
      { label: wort(lang, "live"), type: "checkbox", checked: liveAn(), click: () => bump("live") },
      { label: wort(lang, "pin"), type: "checkbox", checked: !!holeFenster()?.isAlwaysOnTop(), click: () => bump("pin") },
      { type: "separator" },
      { label: wort(lang, "beenden"), click: () => app.quit() },
    ]));
  });
}
