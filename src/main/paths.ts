// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Where things live on disk.
 *
 * Three ways to run the app, and they differ only in where the folders people
 * save into end up:
 *
 *   installed  - the NSIS setup. The program folder is not a place anyone
 *                goes looking, so Logs, Party-Logs and Bug-Reports go to
 *                Documents\Borometer.
 *   portable   - the single portable exe or the unpacked zip folder. The
 *                folders sit next to the exe, as they always did, so the
 *                whole thing can live on a stick.
 *   dev        - `npm start` from the repository: next to the sources.
 *
 * Settings are the same in all three: one place per user, %APPDATA%\Borometer,
 * so swapping versions - or switching from portable to installed - keeps
 * weapon assignments, theme and saved runs.
 */

import { app } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";

export const APP_NAME = "Borometer";

/** The folder the person started the app from. */
export function exeDir(): string {
  // electron-builder's portable exe unpacks itself into a temp folder and
  // runs from there; this variable is where the real exe sits.
  const portable = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portable) return portable;
  // an AppImage is mounted read-only, the file itself is what people moved
  if (process.env.APPIMAGE) return path.dirname(process.env.APPIMAGE);
  if (app.isPackaged) return path.dirname(process.execPath);
  return app.getAppPath();
}

/** True for the NSIS install: it leaves its uninstaller beside the exe. */
export const INSTALLED =
  app.isPackaged &&
  process.platform === "win32" &&
  !process.env.PORTABLE_EXECUTABLE_DIR &&
  fs.existsSync(path.join(path.dirname(process.execPath), `Uninstall ${APP_NAME}.exe`));

export function besideExe(name: string): string {
  return path.join(exeDir(), name);
}

/** Where saved runs, party logs and bug reports go. */
function dataDir(): string {
  return INSTALLED ? path.join(app.getPath("documents"), APP_NAME) : exeDir();
}

/*
 * Settings do NOT live next to the exe. They used to, and every new version
 * folder therefore started blank. %APPDATA% and not %LOCALAPPDATA%: these are
 * preferences, and preferences are what roams with a Windows profile. It is
 * also where the Python build kept them, so an existing setup is picked up
 * as it is.
 */
function settingsDir(): string {
  let base: string;
  if (process.env.APPDATA) base = path.join(process.env.APPDATA, APP_NAME);
  else if (app.isPackaged) base = path.join(app.getPath("appData"), APP_NAME);
  else return exeDir();
  try {
    fs.mkdirSync(base, { recursive: true });
    return base;
  } catch {
    return exeDir();
  }
}

export const SETTINGS_DIR = settingsDir();

export function settingsPath(name: string): string {
  return path.join(SETTINGS_DIR, name);
}

function sameFolder(a: string, b: string): boolean {
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/*
 * A real folder people can open. Made only when something is written into it
 * (`create`), so it appears the first time you save that kind of file and not
 * before. Listing a folder that is not there is an empty list, which is the
 * true answer.
 *
 * `old` is the name this folder used to have: renaming carries what is
 * already in there across, rather than leaving half the files in a folder the
 * app no longer looks at.
 */
function folder(name: string, old: string | null, create: boolean): string {
  const base = dataDir();
  const full = path.join(base, name);
  if (old) {
    const prev = path.join(base, old);
    try {
      const same = sameFolder(prev, full);
      if (isDir(prev) && (same || !isDir(full))) {
        fs.renameSync(prev, full);
      } else if (isDir(prev) && isDir(full)) {
        for (const entry of fs.readdirSync(prev)) {
          const src = path.join(prev, entry);
          const dst = path.join(full, entry);
          if (isFile(src) && !fs.existsSync(dst)) fs.renameSync(src, dst);
        }
      }
    } catch {
      // a folder that cannot be moved is still usable under its old name
    }
  }
  if (create) {
    try {
      fs.mkdirSync(full, { recursive: true });
    } catch {
      // reported by whoever tries to write into it
    }
  }
  return full;
}

/** Saved runs - one fight kept under the name of the build you wore. */
export function savesDir(create = false): string {
  const full = folder("Logs", "saves", create);
  // Bug reports were once written through the runs route, so anyone who sent
  // one has it among their saved runs. Carry those across once.
  let strays: string[] = [];
  try {
    strays = fs
      .readdirSync(full)
      .filter((n) => n.toLowerCase().startsWith("boro-bug-") && n.toLowerCase().endsWith(".json"));
  } catch {
    strays = [];
  }
  if (strays.length) {
    const bugs = bugReportsDir(true);
    for (const name of strays) {
      try {
        const dst = path.join(bugs, name);
        if (!fs.existsSync(dst)) fs.renameSync(path.join(full, name), dst);
      } catch {
        // left where it is
      }
    }
  }
  return full;
}

/** Party-log snapshots and saved solo runs are different shapes; kept apart. */
export function partyLogsDir(create = false): string {
  return folder("Party-Logs", "party-logs", create);
}

/** Bug reports describe the app, not a fight. */
export function bugReportsDir(create = false): string {
  return folder("Bug-Reports", null, create);
}

/** The app's own folders the page may ask the file manager to open. The one
 *  other key, "game" (the watched log folder), is never made: server.ts. */
export const FOLDERS: Record<string, (create?: boolean) => string> = {
  logs: savesDir,
  party: partyLogsDir,
  bugs: bugReportsDir,
};

/** Keep it a plain filename in the saves folder - no traversal, no path. */
export function safeSaveName(raw: unknown): string {
  let name = path.basename(String(raw ?? "").trim());
  name = name.replace(/[^A-Za-z0-9 ._-]+/g, "").slice(0, 80).trim();
  if (!name) name = "runs";
  if (!name.toLowerCase().endsWith(".json")) name += ".json";
  return name;
}
