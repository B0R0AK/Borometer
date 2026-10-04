// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The best pull per boss and per practice-dummy length ("Against your best
 * pull"): one small file in the settings folder, beside boro-config.json but
 * apart from it. The config is read and rewritten whole on every setting, and
 * while logging live the history index rewrites it every couple of seconds;
 * two pulls per boss with their casts would ride along with each of those.
 *
 * The page sends one boss at a time. The key names a boss or a dummy length,
 * never a path; the file name is fixed here. Nothing in this file reads the
 * combat log or sends anything anywhere (safety-audit.mjs, section 9).
 */

import * as fs from "node:fs";
import { settingsPath } from "./paths";

export const BEST_PATH = settingsPath("boro-best.json");

/** one boss's two pulls as JSON text; a 20-minute raid fight comes to about 50 000 */
const MAX_ENTRY = 131072;
/** bosses and dummy-class lengths together; comfortably above what the game has */
const MAX_KEYS = 200;
const KEY_RX = /^(boss|dummy):[^\u0000-\u001f]{1,120}$/;

export type BestFile = Record<string, unknown>;

/*
 * A byte-order mark is accepted, as in config.ts: this is a file people may
 * open in Notepad. Reading is kept apart from deciding what "nothing stored
 * yet" means. Only a missing file (ENOENT) is an empty store. A file that
 * is there but unreadable (a lock, antivirus, a roaming-profile sync, a
 * half write) is neither empty to a GET nor to putBest(): the page would
 * take the empty answer as the file's state and write its own view back,
 * and saving one entry over it would silently erase every other pull.
 */
function readBestFile(): { data: BestFile } | { corrupt: true } {
  let text: string;
  try {
    text = fs.readFileSync(BEST_PATH, "utf8");
  } catch (err) {
    // ENOENT is the one read failure that truly means "nothing stored yet";
    // anything else (permissions, a lock, a disk error) must not be treated
    // the same, or putBest() below would go on to overwrite it with less
    return (err as NodeJS.ErrnoException)?.code === "ENOENT" ? { data: {} } : { corrupt: true };
  }
  try {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? { data: value as BestFile } : { corrupt: true };
  } catch {
    return { corrupt: true };
  }
}

/** The stored pulls; a missing file is an empty store. Null when the file is there but could not be read or understood. */
export function loadBest(): BestFile | null {
  const read = readBestFile();
  return "data" in read ? read.data : null;
}

function saveBest(all: BestFile): boolean {
  try {
    // written to a temp file and renamed into place: a crash or a second
    // Borometer instance mid-write leaves the previous file intact instead
    // of a half-written boro-best.json
    fs.writeFileSync(BEST_PATH + ".tmp", JSON.stringify(all), "utf8");
    fs.renameSync(BEST_PATH + ".tmp", BEST_PATH);
    return true;
  } catch {
    // an unwritable file costs the best pull, not the app
    return false;
  }
}

/**
 * "refused" is for good: the key, the size or the count. "unavailable" may
 * pass: the stored file could not be read, or not written, just now.
 */
export type PutResult = "saved" | "refused" | "unavailable";

/** Stores one entry, or removes it with null. */
export function putBest(key: unknown, entry: unknown): PutResult {
  if (typeof key !== "string" || !KEY_RX.test(key)) return "refused";
  if (entry !== null && (typeof entry !== "object" || Array.isArray(entry))) return "refused";
  if (entry !== null && JSON.stringify(entry).length > MAX_ENTRY) return "refused";
  const read = readBestFile();
  if ("corrupt" in read) return "unavailable";
  const all = read.data;
  if (entry === null) delete all[key];
  else if (!(key in all) && Object.keys(all).length >= MAX_KEYS) return "refused";
  else all[key] = entry;
  return saveBest(all) ? "saved" : "unavailable";
}
