// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The guild (spec 2026-10-06-gilde-design.md, sections 2, 3 and 7): one
 * leader's member list, event series and attendance, in one small file in the
 * settings folder. It holds player names the leader typed in himself (decided
 * on 06.10.2026: a deliberate exception to "no player names"), so it stays on
 * this computer: nothing here is sent anywhere, and no other file reads it
 * except the reminder (gilde-erinnerung.ts).
 *
 * As with the weeklies the page sends the whole state, it is rebuilt field by
 * field, and refused when anything the file already holds would go missing:
 * the guild, a member, a series, a marked appointment, a mark, an exception.
 * Taking a mark back is "offen", detaching is "geloest"; there is no way to
 * empty this file from the page.
 */

import * as fs from "node:fs";
import { settingsPath } from "./paths";

export const GILDE_PATH = settingsPath("boro-gilde.json");

/** the whole state as JSON text: 2 097 152 characters (UTF-16 code units; raised from 524 288, decision of 07.10.2026) */
const MAX_TEXT = 2097152;
const MAX_MITGLIEDER = 100;
const MAX_REIHEN = 20;
/** appointments with marks, over all series */
const MAX_TERMINE = 4000;
const ID_RX = /^[gmr][0-9a-z]{9}$/;
const NAME_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,24}$/u;
const NOTIZ_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{0,120}$/u;
const TITEL_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,60}$/u;
const ZONE_RX = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){0,2}$/;
const DATUM_RX = /^\d{4}-\d{2}-\d{2}$/;
const START_RX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const ZEIT_RX = /^\d{2}:\d{2}$/;
const TERMIN_RX = /^(r[0-9a-z]{9})\|(\d{4}-\d{2}-\d{2})$/;
const ROLLEN = ["tank", "heal", "dps", ""];
/** the ten weapon keys, as the page names them; a member has none or exactly two different ones */
const WAFFEN = ["Greatsword", "Sword and Shield", "Dagger", "Crossbow", "Longbow", "Staff", "Wand and Tome", "Spear", "Gauntlet", "Orb"];
const MARKEN = ["da", "fehlt", "entschuldigt", "offen"];
const ARTEN = ["einmal", "woche", "tage"];
const ERINNERUNGEN = [0, 5, 10, 15, 30, 60, 120];
const FILE_KEYS = ["v", "gilde"];
const GILDE_KEYS = ["id", "name", "geloest", "mitglieder", "reihen", "anwesend"];
const MITGLIED_KEYS = ["id", "name", "rolle", "waffen", "notiz", "geloest"];
const REIHE_KEYS = ["id", "titel", "start", "zone", "wdh", "dauerMin", "erinnerungMin", "ausnahmen", "geloest"];
const WDH_KEYS = ["art", "tage", "bis"];
const AUSNAHME_KEYS = ["aus", "zeit"];

export type Rolle = "tank" | "heal" | "dps" | "";
export type Marke = "da" | "fehlt" | "entschuldigt" | "offen";
export interface Mitglied { id: string; name: string; rolle: Rolle; waffen: string[]; notiz: string; geloest?: boolean }
export interface Ausnahme { aus?: boolean; zeit?: string }
export interface Wdh { art: "einmal" | "woche" | "tage"; tage: number[]; bis?: string }
export interface Reihe {
  id: string; titel: string; start: string; zone: string; wdh: Wdh; dauerMin: number; erinnerungMin: number;
  ausnahmen: Record<string, Ausnahme>; geloest?: boolean;
}
export interface Gilde {
  id: string; name: string; geloest?: boolean; mitglieder: Mitglied[]; reihen: Reihe[];
  anwesend: Record<string, Record<string, Marke>>;
}
export interface GildeFile { v: 1; gilde: Gilde | null }

const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const only = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).every((k) => keys.includes(k));
const textOk = (x: unknown, rx: RegExp): x is string => typeof x === "string" && rx.test(x) && x.trim() === x;
const flagOk = (b: unknown) => b === undefined || typeof b === "boolean";
const idOk = (x: unknown, prefix: string): x is string => typeof x === "string" && ID_RX.test(x) && x[0] === prefix;
/** a real calendar day "YYYY-MM-DD" (30 February is refused) */
const datumOk = (x: unknown): x is string => {
  if (typeof x !== "string" || !DATUM_RX.test(x)) return false;
  const d = new Date(Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10)));
  return d.toISOString().slice(0, 10) === x;
};
const zeitOk = (x: unknown): x is string => typeof x === "string" && ZEIT_RX.test(x) && +x.slice(0, 2) < 24 && +x.slice(3, 5) < 60;
const startOk = (x: unknown): x is string => typeof x === "string" && START_RX.test(x) && datumOk(x.slice(0, 10)) && zeitOk(x.slice(11));
const empty = (): GildeFile => ({ v: 1, gilde: null });

const waffenOk = (x: unknown): x is string[] =>
  Array.isArray(x) && (x.length === 0 || (x.length === 2 && x.every((w) => typeof w === "string" && WAFFEN.includes(w)) && x[0] !== x[1]));

function mitgliedOf(x: unknown): Mitglied | null {
  if (!isRec(x) || !only(x, MITGLIED_KEYS) || !idOk(x.id, "m") || !textOk(x.name, NAME_RX)) return null;
  if (!ROLLEN.includes(x.rolle as string) || !waffenOk(x.waffen) || !textOk(x.notiz, NOTIZ_RX) || !flagOk(x.geloest)) return null;
  return { id: x.id, name: x.name, rolle: x.rolle as Rolle, waffen: [...x.waffen], notiz: x.notiz,
    ...(x.geloest === undefined ? {} : { geloest: x.geloest as boolean }) };
}

function reiheOf(x: unknown): Reihe | null {
  if (!isRec(x) || !only(x, REIHE_KEYS) || !idOk(x.id, "r") || !textOk(x.titel, TITEL_RX) || !startOk(x.start)) return null;
  if (typeof x.zone !== "string" || x.zone.length > 40 || !ZONE_RX.test(x.zone) || !flagOk(x.geloest)) return null;
  if (!Number.isInteger(x.dauerMin) || (x.dauerMin as number) < 15 || (x.dauerMin as number) > 1440) return null;
  if (!ERINNERUNGEN.includes(x.erinnerungMin as number)) return null;
  const w = x.wdh;
  if (!isRec(w) || !only(w, WDH_KEYS) || !ARTEN.includes(w.art as string)) return null;
  if (!Array.isArray(w.tage) || w.tage.length > 7 || !w.tage.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) || new Set(w.tage).size !== w.tage.length) return null;
  if (w.bis !== undefined && !datumOk(w.bis)) return null;
  const wdh: Wdh = { art: w.art as Wdh["art"], tage: [...(w.tage as number[])], ...(w.bis === undefined ? {} : { bis: w.bis as string }) };
  if (!isRec(x.ausnahmen) || Object.keys(x.ausnahmen).length > 4000) return null;
  const ausnahmen: Record<string, Ausnahme> = {};
  for (const [d, a] of Object.entries(x.ausnahmen)) {
    if (!datumOk(d) || !isRec(a) || !only(a, AUSNAHME_KEYS) || !flagOk(a.aus) || (a.zeit !== undefined && !zeitOk(a.zeit))) return null;
    ausnahmen[d] = { ...(a.aus === undefined ? {} : { aus: a.aus as boolean }), ...(a.zeit === undefined ? {} : { zeit: a.zeit as string }) };
  }
  return { id: x.id, titel: x.titel, start: x.start, zone: x.zone, wdh, dauerMin: x.dauerMin as number, erinnerungMin: x.erinnerungMin as number,
    ausnahmen, ...(x.geloest === undefined ? {} : { geloest: x.geloest as boolean }) };
}

function gildeOf(x: unknown): Gilde | null {
  if (!isRec(x) || !only(x, GILDE_KEYS) || !idOk(x.id, "g") || !textOk(x.name, NAME_RX) || !flagOk(x.geloest)) return null;
  if (!Array.isArray(x.mitglieder) || x.mitglieder.length > MAX_MITGLIEDER || !Array.isArray(x.reihen) || x.reihen.length > MAX_REIHEN) return null;
  const mitglieder: Mitglied[] = [];
  for (const m of x.mitglieder) {
    const r = mitgliedOf(m);
    if (!r || mitglieder.some((o) => o.id === r.id)) return null;
    mitglieder.push(r);
  }
  const reihen: Reihe[] = [];
  for (const e of x.reihen) {
    const r = reiheOf(e);
    if (!r || reihen.some((o) => o.id === r.id)) return null;
    reihen.push(r);
  }
  if (!isRec(x.anwesend) || Object.keys(x.anwesend).length > MAX_TERMINE) return null;
  const anwesend: Record<string, Record<string, Marke>> = {};
  for (const [k, v] of Object.entries(x.anwesend)) {
    const t = TERMIN_RX.exec(k);
    if (!t || !datumOk(t[2]) || !reihen.some((r) => r.id === t[1]) || !isRec(v) || Object.keys(v).length > MAX_MITGLIEDER) return null;
    const marken: Record<string, Marke> = {};
    for (const [mid, mk] of Object.entries(v)) {
      if (!mitglieder.some((m) => m.id === mid) || !MARKEN.includes(mk as string)) return null;
      marken[mid] = mk as Marke;
    }
    anwesend[k] = marken;
  }
  return { id: x.id, name: x.name, ...(x.geloest === undefined ? {} : { geloest: x.geloest as boolean }), mitglieder, reihen, anwesend };
}

/**
 * The state the page sent, checked against the schema and against what the
 * file already holds, and rebuilt from the allowed fields. Null when refused:
 * a field out of the schema, a bound passed, or anything stored that the page
 * left out. Leaving something out is never a way to remove it.
 */
export function checkGilde(next: unknown, stored: GildeFile): GildeFile | null {
  if (!isRec(next) || !only(next, FILE_KEYS) || next.v !== 1) return null;
  if (next.gilde === null) return stored.gilde ? null : empty();
  const g = gildeOf(next.gilde);
  if (!g) return null;
  const old = stored.gilde;
  if (old) {
    if (old.id !== g.id) return null;
    if (!old.mitglieder.every((m) => g.mitglieder.some((n) => n.id === m.id))) return null;
    for (const r of old.reihen) {
      const n = g.reihen.find((q) => q.id === r.id);
      if (!n || !Object.keys(r.ausnahmen).every((d) => Object.hasOwn(n.ausnahmen, d))) return null;
    }
    for (const [k, v] of Object.entries(old.anwesend)) {
      const n = g.anwesend[k];
      if (!n || !Object.keys(v).every((mid) => Object.hasOwn(n, mid))) return null;
    }
  }
  return { v: 1, gilde: g };
}

function readGildeFile(): { data: GildeFile } | { corrupt: true } {
  let text: string;
  try {
    text = fs.readFileSync(GILDE_PATH, "utf8");
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code === "ENOENT" ? { data: empty() } : { corrupt: true };
  }
  try {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const data = checkGilde(JSON.parse(text), empty());
    return data ? { data } : { corrupt: true };
  } catch {
    return { corrupt: true };
  }
}

/** The stored state; a missing file is an empty one. Null when the file is there but could not be read or understood. */
export function loadGilde(): GildeFile | null {
  const read = readGildeFile();
  return "data" in read ? read.data : null;
}

function saveGilde(all: GildeFile): boolean {
  try {
    // temp file and rename: a crash mid-write leaves the old file
    fs.writeFileSync(GILDE_PATH + ".tmp", JSON.stringify(all), "utf8");
    fs.renameSync(GILDE_PATH + ".tmp", GILDE_PATH);
    return true;
  } catch {
    return false;
  }
}

/** On the first start, an empty file with its version; "wx" never touches a file that is there. */
export function createGilde(): void {
  try {
    fs.writeFileSync(GILDE_PATH, JSON.stringify(empty()), { encoding: "utf8", flag: "wx" });
  } catch {
    // there already, or not writable just now: nothing is lost either way
  }
}

/** "refused" is for good (schema, size, count, something left out); "unavailable" may pass. */
export type PutResult = "saved" | "refused" | "unavailable";

/** Stores the whole state the page sent, as checkGilde() rebuilt it. */
export function putGilde(data: unknown): PutResult {
  const text = JSON.stringify(data);
  if (typeof text !== "string" || text.length > MAX_TEXT) return "refused";
  const read = readGildeFile();
  if ("corrupt" in read) return "unavailable";
  const clean = checkGilde(data, read.data);
  if (!clean) return "refused";
  return saveGilde(clean) ? "saved" : "unavailable";
}
