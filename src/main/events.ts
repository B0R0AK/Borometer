// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Things that happen outside the page and that the page must act on: the
 * global hotkey, the two buttons in the taskbar preview, a resize by the
 * window's border and Windows switching "Transparency effects". Each has a counter; the page asks with the counts it has already acted on and gets
 * an answer as soon as one of them moves (GET /api/events in server.ts).
 * The compact window (spec Nachtraege N4) adds two: it opened or closed
 * ("kompakt"), and a hand resized it by its border ("kompakthand"). Full view
 * told the strip what it shows (Kompakt-Fix 01.10.2026, "kompaktstand").
 * The tray and the jump list add two (spec Windows-Einbindung): stay on top
 * was asked for ("pin"), and a start brought an order ("start").
 * The weeklies add two (spec Weeklies neu): a reminder fell due and the page
 * is asked for a number ("erinnerung"), and its notification asks for the
 * weeklies to open ("weeklies").
 */

export type EventName = "hotkey" | "compact" | "live" | "handsize" | "material" | "kompakt" | "kompakthand" | "kompaktstand" | "pin" | "start" | "erinnerung" | "weeklies";

const COUNTS: Record<EventName, number> = { hotkey: 0, compact: 0, live: 0, handsize: 0, material: 0, kompakt: 0, kompakthand: 0, kompaktstand: 0, pin: 0, start: 0, erinnerung: 0, weeklies: 0 };
const listeners = new Set<() => void>();

export function bump(name: EventName): void {
  COUNTS[name]++;
  for (const fn of [...listeners]) fn();
}

export function eventCounts(): Record<EventName, number> {
  return { ...COUNTS };
}

/** Calls fn at the next event of any kind; the returned function stops it. */
export function onEvent(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
