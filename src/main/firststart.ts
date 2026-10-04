// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Is this a new installation? A pure core (spec Rundgang 02.10.2026, 2;
 * review M6): the settings as read at startup, and the keys a person sets.
 * It is a first start when none of those keys holds anything - a key that is
 * missing, null, an empty string, an empty list or an empty object counts as
 * nothing. Keys that are written without anyone choosing (the theme "auto"
 * resolved to, where the window sat) are simply not in the list.
 */
export function isFirstStart(settings: Record<string, unknown>, personKeys: readonly string[]): boolean {
  return personKeys.every((k) => isNothing(settings[k]));
}

function isNothing(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}
