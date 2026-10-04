// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The builds as links to questlog.gg (Aufgabe 12 of the redesign, 29.09.):
 * the link, when it was saved, the weapons and the player's own name - never
 * a name from Questlog. Entries from before (spec Build-Planer, section 4)
 * also carry ids, levels, numbers and Borometer's own skill keys; they stay
 * as they are. One small file in the settings folder, apart from the builds.
 * Written only through putPlan() from the page, one entry at a time; an
 * entry is never removed ("Detach" marks it). Nothing here
 * fetches anything: questlog.ts fetches, and stores nothing (safety-audit.mjs,
 * sections 11 and 12).
 */

import * as fs from "node:fs";
import { settingsPath } from "./paths";

export const PLANS_PATH = settingsPath("boro-plans.json");

/** one plan as JSON text: 12 skills with traits, 60 nodes, 30 items and the Steckbrief with its item names (spec Steckbrief 4.3 and 11; "Borometer" 16.8 KB) */
const MAX_ENTRY = 49152;
/** plans overall */
const MAX_PLANS = 100;
/** the page's plan id (plan-core.ts, planId): "p" and nine lower-case letters or digits */
const ID_RX = /^p[0-9a-z]{9}$/;
/** the link it came from: questlog.gg over https, nothing else */
const LINK_RX = /^https:\/\/questlog\.gg\/throne-and-liberty\/[^\s\u0000-\u001f\u007f]{1,260}$/;

export type PlansFile = Record<string, unknown>;

/* ---------- the Steckbrief of a plan (spec Steckbrief 4.3, 6 and 11) ----------
   Ids and numbers: every string an id after SHEET_ID_RX, only the fields
   the spec names. The one text is the item name of a slot (`name`,
   SHEET_NAME_RX: 1-80 characters, no control, format or line separator
   characters) - decided on 26.09.; never a set, rune, perk or
   node name, never a set text. The page no longer draws a Steckbrief
   (Aufgabe 12 of the redesign, 29.09.), but older entries still carry one,
   and this stays the border for it (test-plan-core.mjs checks it). */
const SHEET_ID_RX = /^[A-Za-z0-9_.-]{1,80}$/;
const SHEET_NAME_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,80}$/u;
const SHEET_KEYS = ["slots", "sets", "fmt", "mast", "lack"];
const SLOT_KEYS = ["item", "name", "lvl", "lvlGuess", "vals", "runes", "syn", "perk", "resTier"];
const ORIGINS = ["grund", "traits", "einzig", "resonanz", "heroic", "potenzial"];
const RUNE_KEYS = ["type", "stat", "val", "lvl"];
const RUNE_TYPES = ["attack", "defense", "assist", "chaos"];
const SET_KEYS = ["id", "worn", "of", "active", "next"];
const UNITS = ["n", "%", "s", "m"];
const LACKS = ["runes", "syn", "fmt"];
const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const only = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).every((k) => keys.includes(k));
const idOk = (x: unknown) => typeof x === "string" && SHEET_ID_RX.test(x);
/** the item name of a slot - the one text a Steckbrief keeps (spec Steckbrief 11) */
const nameOk = (x: unknown) => typeof x === "string" && SHEET_NAME_RX.test(x) && x.trim() === x;
const numOk = (n: unknown) => typeof n === "number" && Number.isFinite(n);
const intOk = (n: unknown, max: number) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max;
const valsOk = (o: unknown, max: number) => isRec(o) && Object.keys(o).length <= max
  && Object.entries(o).every(([k, v]) => SHEET_ID_RX.test(k) && numOk(v));

function sheetOk(s: unknown): boolean {
  if (!isRec(s) || !only(s, SHEET_KEYS)) return false;
  if (!isRec(s.slots) || Object.keys(s.slots).length > 30) return false;
  for (const [slot, e] of Object.entries(s.slots)) {
    if (!SHEET_ID_RX.test(slot) || !isRec(e) || !only(e, SLOT_KEYS)) return false;
    if (!idOk(e.item) || !intOk(e.lvl, 1000) || typeof e.lvlGuess !== "boolean") return false;
    if (e.name !== undefined && !nameOk(e.name)) return false;
    if (!isRec(e.vals) || !only(e.vals, ORIGINS) || !Object.values(e.vals).every((v) => valsOk(v, 40))) return false;
    if (!Array.isArray(e.runes) || e.runes.length > 3 || !e.runes.every((r) => isRec(r) && only(r, RUNE_KEYS)
        && RUNE_TYPES.includes(r.type as string) && idOk(r.stat) && numOk(r.val) && intOk(r.lvl, 1000))) return false;
    if (e.syn !== undefined && !(isRec(e.syn) && only(e.syn, ["id", "vals"]) && idOk(e.syn.id) && valsOk(e.syn.vals, 10))) return false;
    if (e.perk !== undefined && !idOk(e.perk)) return false;
    if (e.resTier !== undefined && !intOk(e.resTier, 10)) return false;
  }
  if (!Array.isArray(s.sets) || s.sets.length > 30 || !s.sets.every((t) => isRec(t) && only(t, SET_KEYS) && idOk(t.id)
      && intOk(t.worn, 30) && intOk(t.of, 30) && Array.isArray(t.active) && t.active.length <= 10
      && t.active.every((n) => intOk(n, 30)) && (t.next === undefined || intOk(t.next, 30)))) return false;
  if (!isRec(s.fmt) || Object.keys(s.fmt).length > 400
      || !Object.entries(s.fmt).every(([k, v]) => SHEET_ID_RX.test(k) && UNITS.includes(v as string))) return false;
  if (s.mast !== undefined && !(isRec(s.mast) && Object.keys(s.mast).length <= 60
      && Object.entries(s.mast).every(([k, v]) => SHEET_ID_RX.test(k) && valsOk(v, 20)))) return false;
  if (s.lack !== undefined && !(Array.isArray(s.lack) && s.lack.length <= 3 && s.lack.every((x) => LACKS.includes(x as string)))) return false;
  return true;
}

function readPlansFile(): { data: PlansFile } | { corrupt: true } {
  let text: string;
  try {
    text = fs.readFileSync(PLANS_PATH, "utf8");
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code === "ENOENT" ? { data: {} } : { corrupt: true };
  }
  try {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? { data: value as PlansFile } : { corrupt: true };
  } catch {
    return { corrupt: true };
  }
}

/** The stored plans; a missing file is an empty store. Null when the file is there but could not be read or understood. */
export function loadPlans(): PlansFile | null {
  const read = readPlansFile();
  return "data" in read ? read.data : null;
}

function savePlans(all: PlansFile): boolean {
  try {
    fs.writeFileSync(PLANS_PATH + ".tmp", JSON.stringify(all), "utf8");
    fs.renameSync(PLANS_PATH + ".tmp", PLANS_PATH);
    return true;
  } catch {
    return false;
  }
}

export type PutResult = "saved" | "refused" | "unavailable";

/** Stores one plan under its id. There is no way to remove one. */
export function putPlan(id: unknown, entry: unknown): PutResult {
  if (typeof id !== "string" || !ID_RX.test(id)) return "refused";
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "refused";
  const e = entry as { link?: unknown; sheet?: unknown };
  if (typeof e.link !== "string" || !LINK_RX.test(e.link)) return "refused";
  if (e.sheet !== undefined && !sheetOk(e.sheet)) return "refused";
  if (JSON.stringify(entry).length > MAX_ENTRY) return "refused";
  const read = readPlansFile();
  if ("corrupt" in read) return "unavailable";
  const all = read.data;
  if (!(id in all) && Object.keys(all).length >= MAX_PLANS) return "refused";
  all[id] = entry;
  return savePlans(all) ? "saved" : "unavailable";
}
