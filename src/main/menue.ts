// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The native menu on a table row (spec Windows-Teil 2). The page only says
 * that a row was clicked; the items and their words are fixed here
 * (windows-core.ts), in the language of the config. A choice becomes an event
 * the page acts on (events.ts) - nothing here reads the clipboard or the page.
 */

import { BrowserWindow, Menu } from "electron";
import { loadConfig } from "./config";
import { menueGewaehlt } from "./events";
import { menuePunkte } from "./windows-core";

export function zeigeMenue(win: BrowserWindow): void {
  const items = menuePunkte(loadConfig().lang).map((p) => ({ label: p.label, click: () => menueGewaehlt(p.id) }));
  Menu.buildFromTemplate(items).popup({ window: win });
}
