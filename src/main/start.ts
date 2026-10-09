// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * An order from the jump list (spec Windows-Einbindung 5.1): open compact,
 * start live logging, open the log folder, read a log. Held here with a
 * number until the page has done it and says so (POST /api/win
 * "starterledigt"); GET /api/state only shows it, so no GET changes
 * anything and a reload does nothing twice. A log name is only passed on.
 */

import { bump } from "./events";
import { hatAuftrag, type Start } from "./windows-core";

const auftrag = { nr: 0, offen: null as { nr: number; kompakt: boolean; live: boolean; logordner: boolean; log: string } | null };

export function auftragSetzen(s: Start): void {
  if (!hatAuftrag(s)) return;
  auftrag.nr++;
  auftrag.offen = { nr: auftrag.nr, kompakt: s.kompakt, live: s.live, logordner: s.logordner, log: s.log };
  bump("start");
}

export function startAuftrag(): { nr: number; kompakt: boolean; live: boolean; logordner: boolean; log: string } | null {
  return auftrag.offen ? { ...auftrag.offen } : null;
}

export function auftragErledigt(nr: unknown): boolean {
  if (!auftrag.offen || nr !== auftrag.offen.nr) return false;
  auftrag.offen = null;
  return true;
}
