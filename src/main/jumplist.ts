// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The jump list (spec Windows-Einbindung 5): three tasks and the logs read
 * last. Every entry starts this exe with one of the fixed switches
 * (windows-core.ts); the running Borometer gets them in second-instance.
 * Only in the packaged app: in development process.execPath is Electron.
 */

import { app } from "electron";
import { loadConfig } from "./config";
import { jumpListe, sprache, zuletztListe } from "./windows-core";

export function jumpListBauen(): void {
  if (process.platform !== "win32" || !app.isPackaged) return;
  try {
    const cfg = loadConfig();
    const entfernt = app.getJumpListSettings().removedItems.map((i) => i.args ?? "");
    const kats = jumpListe(sprache(cfg.lang), zuletztListe(cfg.zuletztGelesen), entfernt);
    app.setJumpList(kats.map((k) => ({
      type: k.type,
      ...(k.name === undefined ? {} : { name: k.name }),
      items: k.items.map((i) => ({
        type: "task" as const,
        title: i.title,
        description: i.description,
        args: i.args,
        program: process.execPath,
        iconPath: process.execPath,
        iconIndex: 0,
      })),
    })));
  } catch {
    // a jump list Windows refuses costs the list, not the request
  }
}
