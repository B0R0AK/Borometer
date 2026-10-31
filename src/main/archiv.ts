// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The log archive (spec 2026-10-16-log-archiv-design.md, sections 4 and 5):
 * the lines of a fight, packed with gzip, one file per fight in the folder
 * "archiv" of the settings folder, and one small directory file (index.json)
 * that says what lies there. Everything stays on this PC; nothing here sends
 * anything anywhere, and nothing is written outside the archive folder.
 *
 * As in weeklies.ts the request is never taken as sent: eintragOf() rebuilds
 * the entry field by field from what the schema allows. The file name is a
 * hash of the key, never the key itself, so a key with ".." or "/" cannot
 * change where a file lies. "geloest" is never set through archiviere(); the
 * person detaches and restores fights through loeseArchiv(), which changes that
 * flag alone. Removing for good happens in one place only,
 * loescheArchivGeloest() (spec 2026-10-26-archiv-loeschen-design.md, section 4;
 * the second exception in CLAUDE.md): detached fights, the typed confirmation,
 * and a checked backup in "sicherungen" first.
 */

import * as fs from "node:fs";
import * as zlib from "node:zlib";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { settingsPath } from "./paths";

export const ARCHIV_DIR = settingsPath("archiv");
export const ARCHIV_INDEX = join(ARCHIV_DIR, "index.json");
/** where the backups lie before fights go for good (beside the weeklies' and the guild's); Borometer never removes one */
export const SICHERUNGEN_DIR = settingsPath("sicherungen");

/** the most characters of fight text one request may carry (UTF-16 code units; a fight is a few MB at most) */
const MAX_ROH = 8 * 1024 * 1024;
/** fights in the directory (spec section 4) */
export const MAX_EINTRAEGE = 50000;
/** the directory as JSON text, in characters (spec section 4) */
export const MAX_VERZEICHNIS = 16 * 1024 * 1024;
/** how far ahead of this computer's clock a time may lie: one day */
const AHEAD = 86400000;
const MAX_ZEILEN = 2000000;
const FILE_KEYS = ["v", "kaempfe"];
const ENTRY_KEYS = ["k", "platz", "boss", "at", "dps", "dmg", "dur", "c", "ch", "datei", "zeilen", "geloest"];
const REQ_KEYS = ["eintrag", "text"];
/** fights one request may detach, restore or remove (spec 2026-10-26, sections 3 and 4) */
const MAX_KS = 500;
const LOESEN_KEYS = ["ks", "geloest"];
const LOESCHEN_KEYS = ["ks", "bestaetigung"];
/** what a system answers when it cannot fsync a folder (Windows): no failure of the backup, its files are on the disk */
const ORDNER_OHNE_SYNC = ["EPERM", "EISDIR", "EINVAL", "EBADF", "ENOTSUP"];
/** a fight's key: log file name, "|", start in ms; 1-300 characters, no control characters (GET /api/archiv/kampf in server.ts takes the same 300) */
const K_RX = /^[^\p{Cc}]{1,300}$/u;
/** a place of the boss table, e.g. "raid:dragaryle", "puppe:120" */
const PLATZ_RX = /^(raid|dungeon|feld|erz|koloss|puppe):[^\p{Cc}]{1,80}$/u;
/** a boss name: no control, format or line separator characters */
const TEXT_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,80}$/u;
/** a log's name, or several opened together ("a + b + c", as the history names them): as TEXT_RX, up to 300 like the key */
const DATEI_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,300}$/u;
/** a character's id, as the page makes it (weeklies.ts: ID_RX): "w" and nine lower-case letters or digits, never a name */
const CH_RX = /^w[0-9a-z]{9}$/;

export interface ArchivKampf {
  k: string; platz: string; boss: string;
  at: number; dps: number; dmg: number; dur: number;
  c?: number; ch?: string;
  datei: string; zeilen: number;
  geloest?: boolean;
}
export interface ArchivFile { v: 1; kaempfe: ArchivKampf[] }
/** "refused" is for good (schema, size, count); "unavailable" may pass. */
export type PutResult = "saved" | "refused" | "unavailable";
/** per key: set ("ok"), already so ("schon"), not in the directory ("unbekannt") */
export type LoesenStand = "ok" | "schon" | "unbekannt";
export type LoesenErgebnis = { ok: true; ergebnis: Record<string, LoesenStand> } | { ok: false; grund: "abgelehnt" | "unavailable" };
/** per fight: removed, there was no file ("ohne-datei"), or its file could not be removed and lies on, out of the directory ("datei-bleibt") */
export type LoeschStand = "geloescht" | "ohne-datei" | "datei-bleibt";
/**
 * On every "ok: false" nothing was removed. "nicht-geloest" names the keys that are not detached fights (in the
 * request's order, at most 500); "sicherung" names the backup folder when it was already made (it stays); after a
 * failed directory write ("unavailable") the backup's name is there too.
 */
export type LoeschErgebnis = { ok: true; sicherung: string; ergebnis: Record<string, LoeschStand> }
  | { ok: false; grund: "nicht-geloest"; kaempfe: string[] }
  | { ok: false; grund: "sicherung"; sicherung?: string }
  | { ok: false; grund: "abgelehnt" | "bestaetigung" | "unavailable"; sicherung?: string };
/** a backup: its folder's name ("" when none was made) and the fights whose file it holds; null when it failed */
interface Sicherung { ordner: string; mitDatei: Set<string> | null }
const nichts = (ordner: string): Sicherung => ({ ordner, mitDatei: null });

const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const only = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).every((k) => keys.includes(k));
const textOk = (x: unknown, rx: RegExp): x is string => typeof x === "string" && rx.test(x) && x.trim() === x;
const numOk = (n: unknown, max = Infinity): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;
const intOk = (n: unknown, min: number, max: number): n is number => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;
const empty = (): ArchivFile => ({ v: 1, kaempfe: [] });

/** One fight, rebuilt from the fields the schema names; null when anything is off. */
function eintragOf(x: unknown, mitGeloest: boolean): ArchivKampf | null {
  if (!isRec(x) || !only(x, ENTRY_KEYS)) return null;
  if (typeof x.k !== "string" || !K_RX.test(x.k) || typeof x.platz !== "string" || !PLATZ_RX.test(x.platz)) return null;
  if (!textOk(x.boss, TEXT_RX) || !textOk(x.datei, DATEI_RX)) return null;
  if (!intOk(x.at, 0, Date.now() + AHEAD) || !numOk(x.dps) || !numOk(x.dmg) || !numOk(x.dur, 86400)) return null;
  if (!intOk(x.zeilen, 1, MAX_ZEILEN)) return null;
  if (x.c !== undefined && x.c !== 60 && x.c !== 120 && x.c !== 180) return null;
  if (x.ch !== undefined && (typeof x.ch !== "string" || !CH_RX.test(x.ch))) return null;
  if (x.geloest !== undefined && (!mitGeloest || typeof x.geloest !== "boolean")) return null;
  return { k: x.k, platz: x.platz, boss: x.boss, at: x.at, dps: x.dps, dmg: x.dmg, dur: x.dur,
    ...(x.c === undefined ? {} : { c: x.c as number }), ...(x.ch === undefined ? {} : { ch: x.ch as string }),
    datei: x.datei, zeilen: x.zeilen,
    ...(x.geloest === undefined ? {} : { geloest: x.geloest as boolean }) };
}

/** The directory, rebuilt: no key twice; null when anything is off. */
function dirOf(x: unknown): ArchivFile | null {
  if (!isRec(x) || !only(x, FILE_KEYS) || x.v !== 1 || !Array.isArray(x.kaempfe) || x.kaempfe.length > MAX_EINTRAEGE) return null;
  const out: ArchivKampf[] = [];
  const seen = new Set<string>();
  for (const e of x.kaempfe) {
    const k = eintragOf(e, true);
    if (!k || seen.has(k.k)) return null;
    seen.add(k.k);
    out.push(k);
  }
  return { v: 1, kaempfe: out };
}

const gzName = (k: string) => "k-" + createHash("sha256").update(k).digest("hex").slice(0, 16) + ".gz";

/* Only a missing file (ENOENT) is an empty directory; a file that is there but broken is never written over. */
function readIndex(): { data: ArchivFile } | { corrupt: true } {
  let text: string;
  try {
    text = fs.readFileSync(ARCHIV_INDEX, "utf8");
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code === "ENOENT" ? { data: empty() } : { corrupt: true };
  }
  try {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const data = dirOf(JSON.parse(text));
    return data ? { data } : { corrupt: true };
  } catch {
    return { corrupt: true };
  }
}

function writeIndex(all: ArchivFile): void {
  // temp file and rename: a crash mid-write leaves the old file
  fs.writeFileSync(ARCHIV_INDEX + ".tmp", JSON.stringify(all), "utf8");
  fs.renameSync(ARCHIV_INDEX + ".tmp", ARCHIV_INDEX);
}

/** The directory; a missing file is an empty one. Null when the file is there but could not be read or understood. */
export function loadArchiv(): ArchivFile | null {
  const read = readIndex();
  return "data" in read ? read.data : null;
}

/**
 * Takes a fight into the archive: { eintrag, text }. A shorter version of a
 * key already held never replaces the longer one; a longer one does (a live
 * log grows). "geloest" cannot be set here.
 */
export function archiviere(req: unknown): PutResult {
  if (!isRec(req) || !only(req, REQ_KEYS) || typeof req.text !== "string" || req.text.length > MAX_ROH) return "refused";
  const e = eintragOf(req.eintrag, false);
  if (!e) return "refused";
  const read = readIndex();
  if ("corrupt" in read) return "unavailable";
  const alt = read.data.kaempfe.find((x) => x.k === e.k);
  // zeilen is checked against the text (the page builds it by joining the lines with a newline), so it cannot be claimed
  if (e.zeilen !== req.text.split("\n").length) return "refused";
  if (alt && (alt.geloest || alt.zeilen > e.zeilen)) return "saved";
  if (!alt && read.data.kaempfe.length >= MAX_EINTRAEGE) return "refused";
  const neu = { v: 1 as const, kaempfe: read.data.kaempfe.filter((x) => x.k !== e.k).concat(e) };
  if (JSON.stringify(neu).length > MAX_VERZEICHNIS) return "refused";
  try {
    fs.mkdirSync(ARCHIV_DIR, { recursive: true });
    const datei = join(ARCHIV_DIR, gzName(e.k));
    fs.writeFileSync(datei + ".tmp", zlib.gzipSync(Buffer.from(req.text, "utf8")));
    fs.renameSync(datei + ".tmp", datei); // the file first, then the directory
    writeIndex(neu);
    return "saved";
  } catch {
    return "unavailable";
  }
}

/** The keys of a request (spec 2026-10-26, sections 3 and 4): 1-500 keys as K_RX allows, none twice; null when anything is off. */
function ksOf(x: unknown): string[] | null {
  if (!Array.isArray(x) || x.length < 1 || x.length > MAX_KS) return null;
  if (!x.every((k) => typeof k === "string" && K_RX.test(k))) return null;
  return new Set(x).size === x.length ? (x as string[]) : null;
}

/** The entry with only "geloest" changed: set to true, or the field taken away - never written as false. */
function nurFlag(e: ArchivKampf, geloest: boolean): ArchivKampf {
  const { geloest: _alt, ...rest } = e;
  return geloest ? { ...rest, geloest: true } : rest;
}

/**
 * Detaches fights, or restores them: { ks, geloest } (spec 2026-10-26, section 3). Only the flag "geloest" changes,
 * nothing else in an entry and no fight's file; written whole beside and renamed like archiviere(). A person's own
 * act, so it works while the archive takes nothing in. A key not in the directory is "unbekannt", the others are set.
 */
export function loeseArchiv(req: unknown): LoesenErgebnis {
  if (!isRec(req) || !only(req, LOESEN_KEYS) || typeof req.geloest !== "boolean") return { ok: false, grund: "abgelehnt" };
  const ks = ksOf(req.ks);
  if (!ks) return { ok: false, grund: "abgelehnt" };
  const wollen = req.geloest;
  const read = readIndex();
  if ("corrupt" in read) return { ok: false, grund: "unavailable" };
  const da = new Map(read.data.kaempfe.map((e) => [e.k, e]));
  const ergebnis = ks.map((k): [string, LoesenStand] => [k, !da.has(k) ? "unbekannt" : (da.get(k)!.geloest === true) === wollen ? "schon" : "ok"]);
  const setzen = new Set(ergebnis.filter(([, s]) => s === "ok").map(([k]) => k));
  if (setzen.size) {
    const neu = { v: 1 as const, kaempfe: read.data.kaempfe.map((e) => (setzen.has(e.k) ? nurFlag(e, wollen) : e)) };
    if (JSON.stringify(neu).length > MAX_VERZEICHNIS) return { ok: false, grund: "abgelehnt" };
    try {
      writeIndex(neu);
    } catch {
      return { ok: false, grund: "unavailable" };
    }
  }
  return { ok: true, ergebnis: Object.fromEntries(ergebnis) };
}

/** The day of a fight as the archive's list shows it, "TT.MM.JJJJ" (decision 26.10.2026): at is the log's wall clock stored
    as UTC, so its UTC fields are that clock - no time zone is applied a second time. */
function logDatum(at: number): string {
  const d = new Date(at);
  return String(d.getUTCDate()).padStart(2, "0") + "." + String(d.getUTCMonth() + 1).padStart(2, "0") + "." + String(d.getUTCFullYear());
}

/** The typed confirmation: one fight by its boss and its day as the list shows it ("Boss 10.10.2026"), several by their count in digits; trimmed, any case. */
function bestaetigt(eingabe: string, weg: ArchivKampf[]): boolean {
  const soll = weg.length === 1 ? weg[0]!.boss + " " + logDatum(weg[0]!.at) : String(weg.length);
  return eingabe.trim().toLowerCase() === soll.toLowerCase();
}

const pruefsumme = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/**
 * One copy into the backup: opened "wx" (never over a file), written whole, forced onto the disk (fsync) and closed,
 * then read back and equal to the original in size and SHA-256. Only a copy that is on the disk counts: a power cut
 * right after the removal must not leave an empty copy behind a file that is gone.
 */
function kopiere(original: Buffer, ziel: string): boolean {
  try {
    const fd = fs.openSync(ziel, "wx");
    try {
      for (let n = 0; n < original.length; ) {
        const w = fs.writeSync(fd, original, n, original.length - n);
        if (w <= 0) return false;
        n += w;
      }
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    const kopie = fs.readFileSync(ziel);
    return kopie.length === original.length && pruefsumme(kopie) === pruefsumme(original);
  } catch {
    return false;
  }
}

/**
 * A folder's own entries onto the disk, where the system allows it. Windows cannot open or fsync a folder: those
 * answers (ORDNER_OHNE_SYNC) are no failure - the files' own fsync is all there is then. Any other error is one.
 */
function ordnerDauerhaft(pfad: string): boolean {
  try {
    const fd = fs.openSync(pfad, "r");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    return true;
  } catch (err) {
    return ORDNER_OHNE_SYNC.includes((err as NodeJS.ErrnoException)?.code ?? "");
  }
}

/**
 * The backup before fights go for good (spec 2026-10-26, section 4): a new folder in "sicherungen" - never one that
 * is there -, a copy of the directory and of each fight's file, every copy on the disk and checked, then the folder
 * itself as far as the system allows. A fight whose file is missing has nothing to keep. When anything else fails,
 * mitDatei is null (with the folder's name once it was made); then nothing may go. Nothing here removes anything,
 * and nothing in Borometer removes a backup.
 */
function sichereArchiv(weg: ArchivKampf[]): Sicherung {
  try {
    fs.mkdirSync(SICHERUNGEN_DIR, { recursive: true });
  } catch {
    return nichts("");
  }
  const tag = new Date().toISOString().slice(0, 10);
  let ordner = "";
  for (const i of Array.from({ length: 99 }, (_, n) => n + 1)) {
    const name = "archiv-vor-loeschen-" + tag + (i === 1 ? "" : "-" + i);
    try {
      fs.mkdirSync(join(SICHERUNGEN_DIR, name));
      ordner = name;
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") return nichts("");
    }
  }
  if (!ordner) return nichts("");
  const mitDatei = new Set<string>();
  try {
    if (!kopiere(fs.readFileSync(ARCHIV_INDEX), join(SICHERUNGEN_DIR, ordner, "index.json"))) return nichts(ordner);
    for (const e of weg) {
      let original: Buffer;
      try {
        original = fs.readFileSync(join(ARCHIV_DIR, gzName(e.k)));
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") continue;
        return nichts(ordner);
      }
      if (!kopiere(original, join(SICHERUNGEN_DIR, ordner, gzName(e.k)))) return nichts(ordner);
      mitDatei.add(e.k);
    }
    if (!ordnerDauerhaft(join(SICHERUNGEN_DIR, ordner)) || !ordnerDauerhaft(SICHERUNGEN_DIR)) return nichts(ordner);
  } catch {
    return nichts(ordner);
  }
  return { ordner, mitDatei };
}

/**
 * Removes detached fights for good: { ks, bestaetigung } (spec 2026-10-26, section 4; CLAUDE.md, the second exception
 * to "never delete for good"). The one place in archiv.ts that removes a file. Every condition is checked before
 * anything happens, for the whole request: each fight is detached, the typed confirmation fits, and the backup of the
 * directory and of every fight's file lies checked in a new folder in "sicherungen". Then the directory without them
 * is written whole, and only then each fight's file is removed - in the archive folder, named by the hash of its key,
 * never by anything the request says.
 */
export function loescheArchivGeloest(req: unknown): LoeschErgebnis {
  if (!isRec(req) || !only(req, LOESCHEN_KEYS) || typeof req.bestaetigung !== "string" || req.bestaetigung.length > 200) return { ok: false, grund: "abgelehnt" };
  const ks = ksOf(req.ks);
  if (!ks) return { ok: false, grund: "abgelehnt" };
  const read = readIndex();
  if ("corrupt" in read) return { ok: false, grund: "unavailable" };
  const da = new Map(read.data.kaempfe.map((e) => [e.k, e]));
  const offen = ks.filter((k) => da.get(k)?.geloest !== true);
  if (offen.length) return { ok: false, grund: "nicht-geloest", kaempfe: offen };
  const weg = ks.map((k) => da.get(k)!);
  if (!bestaetigt(req.bestaetigung, weg)) return { ok: false, grund: "bestaetigung" };
  const sicherung = sichereArchiv(weg);
  const mitDatei = sicherung.mitDatei;
  if (!mitDatei) return sicherung.ordner ? { ok: false, grund: "sicherung", sicherung: sicherung.ordner } : { ok: false, grund: "sicherung" };
  const raus = new Set(ks);
  try {
    writeIndex({ v: 1, kaempfe: read.data.kaempfe.filter((e) => !raus.has(e.k)) });
  } catch {
    return { ok: false, grund: "unavailable", sicherung: sicherung.ordner };
  }
  const ergebnis = weg.map((e): [string, LoeschStand] => {
    if (!mitDatei.has(e.k)) return [e.k, "ohne-datei"];
    try {
      fs.unlinkSync(join(ARCHIV_DIR, gzName(e.k)));
      return [e.k, "geloescht"];
    } catch {
      return [e.k, "datei-bleibt"];
    }
  });
  return { ok: true, sicherung: sicherung.ordner, ergebnis: Object.fromEntries(ergebnis) };
}

/** The backups' folder, made when it is not there, for "open the backups' folder"; nothing in it is touched. */
export function createSicherungen(): void {
  try {
    fs.mkdirSync(SICHERUNGEN_DIR, { recursive: true });
  } catch {
    // not writable just now: the folder opens if it is there
  }
}

/**
 * The unpacked lines of a fight. Writing is capped at 8M characters (MAX_ROH); UTF-8 takes up to 3 bytes
 * per character, so the read cap is 32 MB (4 x MAX_ROH), not 8 MB of bytes. Null when there is none or it cannot be read. */
export function leseArchivKampf(k: string): string | null {
  if (typeof k !== "string") return null;
  try {
    const buf = zlib.gunzipSync(fs.readFileSync(join(ARCHIV_DIR, gzName(k))), { maxOutputLength: MAX_ROH * 4 });
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * On the first start, an empty directory with its version. "wx" creates it
 * only when there is none: a file already there, whatever it holds, is left alone.
 */
export function createArchiv(): void {
  try {
    fs.mkdirSync(ARCHIV_DIR, { recursive: true });
    fs.writeFileSync(ARCHIV_INDEX, JSON.stringify(empty()), { encoding: "utf8", flag: "wx" });
  } catch {
    // there already, or not writable just now: nothing is lost either way
  }
}
