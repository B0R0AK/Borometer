// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The weeklies (spec 2026-09-29-weeklies-design.md, section 6): a checklist
 * of weekly and daily tasks for up to six of the player's own characters.
 * One small file in the settings folder, apart from boro-config.json for the
 * same reason as boro-best.json (best.ts).
 *
 * Unlike the other stores the page sends the whole state at once, and it is
 * never taken as sent: checkWeeklies() rebuilds it field by field from what
 * the schema allows, and refuses it when anything the file already holds
 * would go missing - a character, an own point, a counter or last week's
 * counters. Detaching ("geloest") marks, it never removes; there is no way
 * to empty this file from the page. Nothing here reads the combat log or
 * sends anything anywhere.
 */

import * as fs from "node:fs";
import { settingsPath } from "./paths";

export const WEEKLIES_PATH = settingsPath("boro-weeklies.json");

/**
 * the whole state as JSON text: 262 144 characters (UTF-16 code units, as
 * String.length counts them, not bytes). Six characters with all their points
 * come to about 20 000. The bounds below allow a state well above this when
 * every one of them is used to the full; such a state is refused with 400, and
 * the page (W3) says so in a sentence rather than failing silently.
 */
const MAX_TEXT = 262144;
/** characters that are not detached (spec 2: up to six) */
const MAX_ACTIVE = 6;
/** characters overall, the detached ones included: they stay in the file */
const MAX_PROFILES = 60;
/** own points per character, the detached ones included */
const MAX_OWN = 100;
/** counters, hidden points or renamed points per character: the 23 of the base list and the own points */
const MAX_KEYS = 150;
/** the largest amount of a point (spec 4: 1-999), and so the largest count */
const MAX_COUNT = 999;
/** how far ahead of this computer's clock a point in time may lie: one day; a later one would never reset */
const AHEAD = 86400000;
/** a character's id, made by the page: "w" and nine lower-case letters or digits */
const ID_RX = /^w[0-9a-z]{9}$/;
/** a point's key: the base list's (weeklies-core.ts, GRUNDLISTE) or an own one; letters and digits, a letter first */
const KEY_RX = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
/** an own point's key: "eigen" first, so it can never be one of the base list's (review K-7) */
const OWN_KEY_RX = /^eigen[0-9a-z]{1,35}$/;
/** a character's name (spec 4: at most 24), no control, format or line separator characters */
const NAME_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,24}$/u;
/** the name of an own or a renamed point */
const TEXT_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,60}$/u;
const TAKTE = ["woche", "tag"];
const FILE_KEYS = ["v", "profile", "erinnerungen"];
const PROFILE_KEYS = ["id", "name", "geloest", "zaehler", "aus", "namen", "eigene", "vorwoche", "zu"];
const OWN_KEYS = ["schluessel", "name", "menge", "takt", "geloest"];
const COUNTER_KEYS = ["stand", "seit"];
const LAST_WEEK_KEYS = ["reset", "zaehler"];
/** reminders: at most 12 not detached, 40 in all (the detached ones stay in the file) */
const MAX_REMINDERS_ACTIVE = 12;
const MAX_REMINDERS = 40;
/** collapse choices per character: one per area of the page */
const MAX_ZU = 20;
/** a reminder's id, made by the page: "e" and nine lower-case letters or digits */
const REMINDER_ID_RX = /^e[0-9a-z]{9}$/;
const TIME_RX = /^([01]\d|2[0-3]):[0-5]\d$/;
/** the text of a reminder, at most 120 characters, no control, format or line separator characters */
const REMINDER_TEXT_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,120}$/u;
const REMINDER_KEYS = ["id", "an", "tage", "zeit", "text", "nurOffen", "geloest"];
const ZU_KEYS = ["zu", "bei"];

export type Takt = "woche" | "tag";
export interface Counter { stand: number; seit: number }
export interface OwnPoint { schluessel: string; name: string; menge: number; takt: Takt; geloest?: boolean }
export interface Profile {
  id: string; name: string; geloest?: boolean;
  zaehler: Record<string, Counter>;
  aus: string[]; namen: Record<string, string>;
  eigene: OwnPoint[];
  vorwoche?: { reset: number; zaehler: Record<string, Counter> };
  zu?: Record<string, ZuWahl>;
}
export interface ZuWahl { zu: boolean; bei: boolean }
export interface Reminder { id: string; an: boolean; tage: number[]; zeit: string; text: string; nurOffen: boolean; geloest?: boolean }
export interface WeekliesFile { v: 1; profile: Profile[]; erinnerungen?: Reminder[] }

const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const only = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).every((k) => keys.includes(k));
/** a key, never one of the names every object already has (constructor, toString ...) */
const keyOk = (k: unknown): k is string => typeof k === "string" && KEY_RX.test(k) && !Object.hasOwn(Object.prototype, k);
const textOk = (x: unknown, rx: RegExp): x is string => typeof x === "string" && rx.test(x) && x.trim() === x;
const timeOk = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= Date.now() + AHEAD;
const countOk = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_COUNT;
const flagOk = (b: unknown) => b === undefined || typeof b === "boolean";
const empty = (): WeekliesFile => ({ v: 1, profile: [] });

/** Counters {key: {stand, seit}}, rebuilt; null when anything is off. */
function countersOf(x: unknown): Record<string, Counter> | null {
  if (!isRec(x) || Object.keys(x).length > MAX_KEYS) return null;
  const out: Record<string, Counter> = {};
  for (const [k, z] of Object.entries(x)) {
    if (!keyOk(k) || !isRec(z) || !only(z, COUNTER_KEYS) || !countOk(z.stand) || !timeOk(z.seit)) return null;
    out[k] = { stand: z.stand, seit: z.seit };
  }
  return out;
}

/** The collapse choices {key: {zu, bei}}, rebuilt; null when anything is off. */
function zuOf(x: unknown): Record<string, ZuWahl> | null {
  if (!isRec(x) || Object.keys(x).length > MAX_ZU) return null;
  const out: Record<string, ZuWahl> = {};
  for (const [k, v] of Object.entries(x)) {
    if (!keyOk(k) || !isRec(v) || !only(v, ZU_KEYS) || typeof v.zu !== "boolean" || typeof v.bei !== "boolean") return null;
    out[k] = { zu: v.zu, bei: v.bei };
  }
  return out;
}

/** One reminder, rebuilt from the fields the schema names; null when anything is off. */
function reminderOf(x: unknown): Reminder | null {
  if (!isRec(x) || !only(x, REMINDER_KEYS)) return null;
  if (typeof x.id !== "string" || !REMINDER_ID_RX.test(x.id) || typeof x.an !== "boolean" || typeof x.nurOffen !== "boolean" || !flagOk(x.geloest)) return null;
  if (typeof x.zeit !== "string" || !TIME_RX.test(x.zeit) || !textOk(x.text, REMINDER_TEXT_RX)) return null;
  const tage = x.tage;
  if (!Array.isArray(tage) || tage.length < 1 || tage.length > 7 || !tage.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) || new Set(tage).size !== tage.length) return null;
  return { id: x.id, an: x.an, tage: [...(tage as number[])], zeit: x.zeit, text: x.text, nurOffen: x.nurOffen,
    ...(x.geloest === undefined ? {} : { geloest: x.geloest as boolean }) };
}

/** The reminders, each rebuilt: at most 40, at most 12 not detached, no id twice; null when anything is off. */
function remindersOf(x: unknown): Reminder[] | null {
  if (!Array.isArray(x) || x.length > MAX_REMINDERS) return null;
  const out: Reminder[] = [];
  for (const e of x) {
    const r = reminderOf(e);
    if (!r || out.some((q) => q.id === r.id)) return null;
    out.push(r);
  }
  return out.filter((r) => !r.geloest).length > MAX_REMINDERS_ACTIVE ? null : out;
}

/** One character, rebuilt from the fields the schema names; null when anything is off. */
function profileOf(x: unknown): Profile | null {
  if (!isRec(x) || !only(x, PROFILE_KEYS)) return null;
  if (typeof x.id !== "string" || !ID_RX.test(x.id) || !textOk(x.name, NAME_RX) || !flagOk(x.geloest)) return null;
  const zaehler = countersOf(x.zaehler);
  if (!zaehler) return null;
  const aus = x.aus;
  if (!Array.isArray(aus) || aus.length > MAX_KEYS || !aus.every(keyOk) || new Set(aus).size !== aus.length) return null;
  const namen: Record<string, string> = {};
  if (!isRec(x.namen) || Object.keys(x.namen).length > MAX_KEYS) return null;
  for (const [k, v] of Object.entries(x.namen)) {
    if (!keyOk(k) || !textOk(v, TEXT_RX)) return null;
    namen[k] = v;
  }
  if (!Array.isArray(x.eigene) || x.eigene.length > MAX_OWN) return null;
  const eigene: OwnPoint[] = [];
  for (const e of x.eigene) {
    if (!isRec(e) || !only(e, OWN_KEYS) || !keyOk(e.schluessel) || !OWN_KEY_RX.test(e.schluessel) || !textOk(e.name, TEXT_RX) || !flagOk(e.geloest)) return null;
    if (!countOk(e.menge) || e.menge < 1 || !TAKTE.includes(e.takt as string)) return null;
    const schluessel = e.schluessel;
    if (eigene.some((o) => o.schluessel === schluessel)) return null;
    eigene.push({ schluessel, name: e.name, menge: e.menge, takt: e.takt as Takt,
      ...(e.geloest === undefined ? {} : { geloest: e.geloest as boolean }) });
  }
  const p: Profile = { id: x.id, name: x.name, ...(x.geloest === undefined ? {} : { geloest: x.geloest as boolean }),
    zaehler, aus: [...aus], namen, eigene };
  if (x.zu !== undefined) {
    const zu = zuOf(x.zu);
    if (!zu) return null;
    p.zu = zu;
  }
  if (x.vorwoche !== undefined) {
    const w = x.vorwoche;
    if (!isRec(w) || !only(w, LAST_WEEK_KEYS) || !timeOk(w.reset)) return null;
    const z = countersOf(w.zaehler);
    if (!z) return null;
    p.vorwoche = { reset: w.reset, zaehler: z };
  }
  return p;
}

/**
 * The state the page sent, checked against the schema and against what the
 * file already holds, and rebuilt from the allowed fields. Null when it is
 * refused: a field out of the schema, more than six characters that are not
 * detached, or anything stored that the page left out - a character, an own
 * point, a counter or last week's counters. Leaving something out is never
 * a way to remove it.
 */
export function checkWeeklies(next: unknown, stored: WeekliesFile): WeekliesFile | null {
  if (!isRec(next) || !only(next, FILE_KEYS) || next.v !== 1) return null;
  if (!Array.isArray(next.profile) || next.profile.length > MAX_PROFILES) return null;
  const profile: Profile[] = [];
  for (const x of next.profile) {
    const p = profileOf(x);
    if (!p || profile.some((q) => q.id === p.id)) return null;
    profile.push(p);
  }
  if (profile.filter((p) => !p.geloest).length > MAX_ACTIVE) return null;
  const erinnerungen = next.erinnerungen === undefined ? undefined : remindersOf(next.erinnerungen);
  if (erinnerungen === null) return null;
  // a stored reminder may be detached, never left out (never deleted for good)
  if (!(stored.erinnerungen ?? []).every((old) => (erinnerungen ?? []).some((r) => r.id === old.id))) return null;
  for (const old of stored.profile) {
    const p = profile.find((q) => q.id === old.id);
    if (!p) return null;
    if (!Object.keys(old.zaehler).every((k) => Object.hasOwn(p.zaehler, k))) return null;
    if (!old.eigene.every((e) => p.eigene.some((f) => f.schluessel === e.schluessel))) return null;
    // last week's counters: replaced only by a week as old or newer, and by
    // the same week only with every key it already had (review K-1)
    if (old.vorwoche) {
      const week = p.vorwoche;
      if (!week || week.reset < old.vorwoche.reset) return null;
      if (week.reset === old.vorwoche.reset && !Object.keys(old.vorwoche.zaehler).every((k) => Object.hasOwn(week.zaehler, k))) return null;
    }
  }
  return { v: 1, profile, ...(erinnerungen === undefined ? {} : { erinnerungen }) };
}

/*
 * As in best.ts: only a missing file (ENOENT) is an empty store. A file that
 * is there but unreadable, broken or not of this schema is neither empty to
 * a GET nor to putWeeklies(), or the page's state would be written over it.
 */
function readWeekliesFile(): { data: WeekliesFile } | { corrupt: true } {
  let text: string;
  try {
    text = fs.readFileSync(WEEKLIES_PATH, "utf8");
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code === "ENOENT" ? { data: empty() } : { corrupt: true };
  }
  try {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const data = checkWeeklies(JSON.parse(text), empty());
    return data ? { data } : { corrupt: true };
  } catch {
    return { corrupt: true };
  }
}

/** The stored state; a missing file is an empty one. Null when the file is there but could not be read or understood. */
export function loadWeeklies(): WeekliesFile | null {
  const read = readWeekliesFile();
  return "data" in read ? read.data : null;
}

function saveWeeklies(all: WeekliesFile): boolean {
  try {
    // temp file and rename, as in best.ts: a crash mid-write leaves the old file
    fs.writeFileSync(WEEKLIES_PATH + ".tmp", JSON.stringify(all), "utf8");
    fs.renameSync(WEEKLIES_PATH + ".tmp", WEEKLIES_PATH);
    return true;
  } catch {
    return false;
  }
}

/**
 * On the first start, an empty file with its version. "wx" creates it only
 * when there is none: a file already there, whatever it holds, is left alone.
 */
export function createWeeklies(): void {
  try {
    fs.writeFileSync(WEEKLIES_PATH, JSON.stringify(empty()), { encoding: "utf8", flag: "wx" });
  } catch {
    // there already, or not writable just now: nothing is lost either way
  }
}

/** "refused" is for good (schema, size, count, something left out); "unavailable" may pass. */
export type PutResult = "saved" | "refused" | "unavailable";

/** Stores the whole state the page sent, as checkWeeklies() rebuilt it. */
export function putWeeklies(data: unknown): PutResult {
  const text = JSON.stringify(data);
  if (typeof text !== "string" || text.length > MAX_TEXT) return "refused";
  const read = readWeekliesFile();
  if ("corrupt" in read) return "unavailable";
  const clean = checkWeeklies(data, read.data);
  if (!clean) return "refused";
  return saveWeeklies(clean) ? "saved" : "unavailable";
}
