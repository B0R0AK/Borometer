// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The combat log folder. Everything in here only ever READS: list, stat and
 * read. Nothing in this file writes, moves or deletes, and scripts/safety-audit
 * checks that it stays that way.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const LOG_PATTERNS = [".txt", ".log"];

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Where Throne and Liberty keeps combat logs, on Windows or under Proton. */
export function guessLogDir(): string {
  const tries: string[] = [];
  const local = process.env.LOCALAPPDATA;
  if (local) {
    tries.push(
      path.join(local, "TL", "Saved", "CombatLogs"),
      path.join(local, "TL", "Saved", "CombatLog"),
      path.join(local, "TL", "Saved"),
    );
  }
  const steam = path.join(os.homedir(), ".local", "share", "Steam", "steamapps", "compatdata");
  if (isDir(steam)) {
    try {
      for (const appId of fs.readdirSync(steam)) {
        tries.push(
          path.join(steam, appId, "pfx", "drive_c", "users", "steamuser",
            "AppData", "Local", "TL", "Saved", "CombatLogs"),
        );
      }
    } catch {
      // an unreadable Steam folder is simply not where the logs are
    }
  }
  return tries.find(isDir) ?? "";
}

export interface FoundLog {
  name: string;
  full: string;
  size: number;
  /** whole seconds, like the page has always been sent */
  mtime: number;
  mtimeMs: number;
}

/*
 * The log files of the folder (*.txt, *.log, files only - lstat, so a link is
 * not a log, not even one pointing at a file), newest first, at most LIST_MAX -
 * the listing that GET /api/logs shows the page (spec
 * Nachtraege N3). newestLog() is its first entry, and /api/log reads only
 * an entry of a fresh listing (logAnswer below).
 */
export const LIST_MAX = 60;

export function listLogs(folder: string): FoundLog[] {
  if (!folder || !isDir(folder)) return [];
  const found: FoundLog[] = [];
  try {
    for (const name of fs.readdirSync(folder)) {
      const lower = name.toLowerCase();
      if (!LOG_PATTERNS.some((ext) => lower.endsWith(ext))) continue;
      const full = path.join(folder, name);
      const stat = fs.lstatSync(full);
      if (!stat.isFile()) continue;
      found.push({ name, full, size: stat.size, mtime: Math.floor(stat.mtimeMs / 1000), mtimeMs: stat.mtimeMs });
    }
  } catch {
    return [];
  }
  // stable: of two logs with the same time, the one read first stays first, as before
  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return found.slice(0, LIST_MAX);
}

export function newestLog(folder: string): FoundLog | null {
  return listLogs(folder)[0] ?? null;
}

/** The log as text. Broken bytes become U+FFFD instead of failing the read. */
export function readLog(found: FoundLog): string {
  return fs.readFileSync(found.full, "utf8");
}

/*
 * Live (Live-Leistung specification 3): only the end of the log, from a byte
 * the page already has, up to the last complete line ending. This way a half
 * line, and a cut-off UTF-8 character, never arrive; the rest waits for the
 * next tick. Along with it, the first two lines of the file: the page uses
 * them to notice a file that was replaced under the same name. At most
 * TAIL_MAX bytes per answer, as much as a request to this server may carry -
 * the next tick fetches the rest. Opened read-only ("r") and only a file of
 * the listing: the one newestLog() found, or for /api/log the entry
 * logAnswer() found.
 */
export const TAIL_MAX = 8 * 1024 * 1024;

export interface LogTail {
  file: string;
  from: number;
  /** the byte behind the last complete line that came along */
  to: number;
  /** the size of the file at the time of reading */
  size: number;
  /** the first two lines of the file, whole - or "" as long as there are not two yet */
  head: string;
  text: string;
}

/** null when from lies behind the end: the file has become shorter. */
export function readLogFrom(found: FoundLog, from: number, max = TAIL_MAX): LogTail | null {
  const fd = fs.openSync(found.full, "r");
  try {
    const size = fs.fstatSync(fd).size;
    if (from > size) return null;
    const want = Math.min(size - from, max);
    const buf = Buffer.alloc(want);
    let got = 0;
    while (got < want) {
      const n = fs.readSync(fd, buf, got, want - got, from + got);
      if (n <= 0) break;
      got += n;
    }
    const end = got > 0 ? buf.lastIndexOf(0x0a, got - 1) : -1;
    const to = from + end + 1;
    // the version line and the first event with its time down to the
    // millisecond: a different session starts differently
    const kopf = Buffer.alloc(Math.min(size, 4096));
    const k = fs.readSync(fd, kopf, 0, kopf.length, 0);
    const n1 = kopf.subarray(0, k).indexOf(0x0a);
    const n2 = n1 < 0 ? -1 : kopf.subarray(0, k).indexOf(0x0a, n1 + 1);
    const head = n2 < 0 ? "" : kopf.toString("utf8", 0, n2 + 1);
    return { file: found.name, from, to, size, head, text: buf.toString("utf8", 0, end + 1) };
  } finally {
    fs.closeSync(fd);
  }
}

/*
 * GET /api/latest?file=&from= (server.ts). file must be the name of the
 * newest log - never a path: it is only compared, what is read is always
 * the file that newestLog() found. from is an integer number of bytes, at
 * most the size. 409 means for the page: load whole again from scratch;
 * 400: asked wrong.
 */
export function latestAnswer(found: FoundLog, file: string | null, from: string | null):
  { status: number; body: LogTail | { ok: false; error: string } } {
  if (file !== found.name) return { status: 409, body: { ok: false, error: "not the newest log" } };
  if (from === null || !/^(0|[1-9]\d{0,14})$/.test(from)) return { status: 400, body: { ok: false, error: "from is not a byte" } };
  const tail = readLogFrom(found, Number(from));
  if (!tail) return { status: 409, body: { ok: false, error: "the log is shorter than that" } };
  return { status: 200, body: tail };
}

/*
 * GET /api/log?name=&from= (server.ts, spec Nachtraege N3): an older log of
 * the watched folder, in pieces of at most TAIL_MAX bytes like /api/latest -
 * the page asks again from "to" until it has the whole file. name is only
 * compared with the names of a fresh listing of the same folder; what is
 * read is the path that listing found, never one built from the request.
 * 404: not a log of the folder (any more); 400: asked wrong; 409: the log
 * is shorter than that.
 */
export function logAnswer(folder: string, name: string | null, from: string | null):
  { status: number; body: LogTail | { ok: false; error: string } } {
  const found = listLogs(folder).find((f) => f.name === name);
  if (!found) return { status: 404, body: { ok: false, error: "not a log in the folder" } };
  if (from === null || !/^(0|[1-9]\d{0,14})$/.test(from)) return { status: 400, body: { ok: false, error: "from is not a byte" } };
  const piece = readLogFrom(found, Number(from));
  if (!piece) return { status: 409, body: { ok: false, error: "the log is shorter than that" } };
  return { status: 200, body: piece };
}
