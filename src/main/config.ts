// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

import * as fs from "node:fs";
import { besideExe, settingsPath } from "./paths";

export type Config = Record<string, unknown>;

export const CONFIG_PATH = settingsPath("boro-config.json");

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/*
 * Carry a config from beside the exe to the settings folder, once. Only when
 * the new one does not exist yet, so this never overwrites settings someone
 * is already using. The old file is left where it is.
 */
function migrateSettings(target: string, legacy: string): boolean {
  if (fs.existsSync(target)) return false;
  try {
    if (!fs.statSync(legacy).isFile()) return false;
    const data = stripBom(fs.readFileSync(legacy, "utf8"));
    JSON.parse(data); // refuse to carry over a broken file
    fs.writeFileSync(target, data, "utf8");
    return true;
  } catch {
    return false;
  }
}

/** Reported at startup: a settings file quietly moving is worth telling. */
export const CONFIG_MIGRATED = migrateSettings(CONFIG_PATH, besideExe("boro-config.json"));

/*
 * A byte-order mark is accepted: it is what Windows Notepad and PowerShell
 * put there by default, and this file is one people are told they can edit by
 * hand. Without that, the next save would write a file holding only whatever
 * was being saved.
 */
export function loadConfig(): Config {
  try {
    const parsed: unknown = JSON.parse(stripBom(fs.readFileSync(CONFIG_PATH, "utf8")));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Config) : {};
  } catch {
    return {};
  }
}

/*
 * Whole or not at all (spec Live Performance 4): the new file is created
 * beside the old one and renamed over it. A crash or a full disk in between
 * leaves the old settings standing instead of a half-written file - which
 * loadConfig would read as "no settings", and the next save would write
 * exactly that.
 */
function saveConfig(cfg: Config): void {
  try {
    fs.writeFileSync(CONFIG_PATH + ".tmp", JSON.stringify(cfg, null, 1), "utf8");
    fs.renameSync(CONFIG_PATH + ".tmp", CONFIG_PATH);
  } catch {
    // an unwritable settings file costs the setting, not the app
  }
}

/*
 * Every path that changes a key goes through here. Node runs this
 * synchronously on one thread, so two settings changed a moment apart can no
 * longer overwrite each other the way two threads of the Python server did.
 * Only a real change is written (spec Live Performance 4): Live sends the
 * history index after every fight that changed, and much of what arrives
 * already looks exactly like that.
 */
export function updateConfig(changes: Config): Config {
  const cfg = loadConfig();
  const before = JSON.stringify(cfg);
  Object.assign(cfg, changes);
  if (JSON.stringify(cfg) !== before) saveConfig(cfg);
  return cfg;
}

export function configString(key: string): string {
  const value = loadConfig()[key];
  return typeof value === "string" ? value : "";
}
