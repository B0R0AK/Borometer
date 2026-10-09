// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Start with Windows (spec Windows-Einbindung 7), off unless turned on.
 * Windows keeps the state itself (the Run key it writes for this exe), so
 * there is no setting of our own to drift from it. The one argument tells
 * main.ts to open minimized. Only the packaged app: in development the
 * exe is Electron itself.
 */

import { app } from "electron";

export function autostartDa(): boolean {
  return process.platform === "win32" && app.isPackaged;
}

export function autostartAn(): boolean {
  return autostartDa() && app.getLoginItemSettings({ args: ["--autostart"] }).openAtLogin;
}

export function autostartSetzen(an: boolean): boolean {
  if (!autostartDa()) return false;
  app.setLoginItemSettings({ openAtLogin: an, args: ["--autostart"] });
  return autostartAn();
}
