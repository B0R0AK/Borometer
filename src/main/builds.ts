// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The build journal ("Your builds", spec Fortschritt, feature 2): the builds
 * the page has recognised, with the name someone gave them and an optional
 * planner link. One small file in the settings folder, apart from
 * boro-config.json for the same reason as boro-best.json (best.ts).
 *
 * The page sends one build at a time under its id; the file name is fixed
 * here. A build is never removed - there is no way to empty this file from
 * the page. A planner link is kept as text and never fetched: the page opens
 * it as a link, window.ts hands that to the system browser. Nothing in this
 * file reads the combat log or sends anything anywhere (safety-audit.mjs,
 * section 10).
 */

import * as fs from "node:fs";
import { settingsPath } from "./paths";

export const BUILDS_PATH = settingsPath("boro-builds.json");

/**
 * one build as JSON text: a name, two weapons, six skills and a link come to
 * a few hundred; 24 rotation choices at most about 2000 more
 */
const MAX_ENTRY = 4096;
/** builds overall; someone who switches a lot still has a few dozen */
const MAX_BUILDS = 200;
/**
 * a rotation key (skillKey): 1-80 characters, not __proto__ or prototype; the
 * check in putBuild also refuses every name Object.prototype already has
 */
const ROT_KEY_RX = /^(?!(?:__proto__|prototype)$)[\s\S]{1,80}$/;
/** rotation choices per build (spec Deine Rotation, 7): a build has about twelve skills and a few procs */
const MAX_ROT = 24;
/** the page's build id (build-core.ts, bauId): ten lower-case letters or digits */
const ID_RX = /^[0-9a-z]{10}$/;
/** a name: at most 40 characters, no control characters; empty until someone names it */
const NAME_RX = /^[^\u0000-\u001f\u007f]{0,40}$/;
/** a planner link: https and nothing else, no spaces or control characters */
const LINK_RX = /^https:\/\/[^\s\u0000-\u001f\u007f]{1,292}$/;

export type BuildsFile = Record<string, unknown>;

/*
 * As in best.ts: only a missing file (ENOENT) is an empty store. A file that
 * is there but unreadable or broken is neither empty to a GET nor to
 * putBuild(), or saving one build over it would erase every other.
 */
function readBuildsFile(): { data: BuildsFile } | { corrupt: true } {
  let text: string;
  try {
    text = fs.readFileSync(BUILDS_PATH, "utf8");
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code === "ENOENT" ? { data: {} } : { corrupt: true };
  }
  try {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? { data: value as BuildsFile } : { corrupt: true };
  } catch {
    return { corrupt: true };
  }
}

/** The stored builds; a missing file is an empty store. Null when the file is there but could not be read or understood. */
export function loadBuilds(): BuildsFile | null {
  const read = readBuildsFile();
  return "data" in read ? read.data : null;
}

function saveBuilds(all: BuildsFile): boolean {
  try {
    // temp file and rename, as in best.ts: a crash mid-write leaves the old file
    fs.writeFileSync(BUILDS_PATH + ".tmp", JSON.stringify(all), "utf8");
    fs.renameSync(BUILDS_PATH + ".tmp", BUILDS_PATH);
    return true;
  } catch {
    return false;
  }
}

/** "refused" is for good (id, name, link, rotation, size, count); "unavailable" may pass. */
export type PutResult = "saved" | "refused" | "unavailable";

/** Stores one build under its id. There is no way to remove one. */
export function putBuild(id: unknown, entry: unknown): PutResult {
  if (typeof id !== "string" || !ID_RX.test(id)) return "refused";
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "refused";
  const e = entry as { name?: unknown; link?: unknown; rot?: unknown };
  if (typeof e.name !== "string" || !NAME_RX.test(e.name)) return "refused";
  if (e.link !== undefined && (typeof e.link !== "string" || !LINK_RX.test(e.link))) return "refused";
  // rotation choices: skill key (ROT_KEY_RX) -> 0, 1 or 2, numbers only, so no new strings here
  if (e.rot !== undefined) {
    if (!e.rot || typeof e.rot !== "object" || Array.isArray(e.rot)) return "refused";
    const rot = Object.entries(e.rot);
    if (rot.length > MAX_ROT) return "refused";
    if (!rot.every(([k, v]) => ROT_KEY_RX.test(k) && !Object.hasOwn(Object.prototype, k) && Number.isInteger(v) && v >= 0 && v <= 2)) return "refused";
  }
  if (JSON.stringify(entry).length > MAX_ENTRY) return "refused";
  const read = readBuildsFile();
  if ("corrupt" in read) return "unavailable";
  const all = read.data;
  if (!(id in all) && Object.keys(all).length >= MAX_BUILDS) return "refused";
  all[id] = entry;
  return saveBuilds(all) ? "saved" : "unavailable";
}
