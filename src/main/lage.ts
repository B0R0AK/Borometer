// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Where the window was (spec Fenster-Extras 3.4), as plain data: no Electron,
 * no file, nothing imported. window.ts hands in what it read from the
 * settings and the work areas screen.getAllDisplays() reports (in DIP); this
 * decides what may be written and where the window goes. The names are the
 * spec's: gross is full view, kompakt the compact strip - full view shrunk to
 * it, or the compact window of its own (spec Nachtraege N4), whichever the
 * platform has; both write the same corner.
 */

export type Teil = "gross" | "kompakt";
export interface LageGross { x: number; y: number; w: number; h: number; max: boolean }
export interface LageKompakt { x: number; y: number }
/** a monitor's work area, in DIP */
export interface Monitor { x: number; y: number; width: number; height: number }

/** the title bar: this much of the window's top has to lie on one monitor */
export const TITEL = 64;
/** compact's smallest strip - MIN_ACTION_W x MIN_ACTION_H in window.ts */
export const KOMPAKT_W = 180;
export const KOMPAKT_H = 24;
/** how long after the last move or resize a place is written */
export const WARTE_MS = 500;

function ganz(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function objekt(roh: unknown): Record<string, unknown> | null {
  return roh !== null && typeof roh === "object" && !Array.isArray(roh) ? (roh as Record<string, unknown>) : null;
}

/** One part of the settings key "fenster" as it stands, unchecked. */
export function teilAus(fenster: unknown, teil: Teil): unknown {
  const o = objekt(fenster);
  return o && Object.hasOwn(o, teil) ? o[teil] : undefined;
}

/*
 * Whole numbers only, x and y in -32000..32000, w 180..16000, h 24..16000,
 * max a boolean. Anything else is not a place: not used, and not written.
 * Only the named fields come out; whatever else the object holds stays behind.
 */
export function pruefen(roh: unknown, teil: "gross"): LageGross | null;
export function pruefen(roh: unknown, teil: "kompakt"): LageKompakt | null;
export function pruefen(roh: unknown, teil: Teil): LageGross | LageKompakt | null {
  const o = objekt(roh);
  if (!o) return null;
  const { x, y, w, h, max } = o;
  if (!ganz(x, -32000, 32000) || !ganz(y, -32000, 32000)) return null;
  if (teil === "kompakt") return { x, y };
  if (!ganz(w, 180, 16000) || !ganz(h, 24, 16000) || typeof max !== "boolean") return null;
  return { x, y, w, h, max };
}

/*
 * A place counts only while its title bar can be grabbed: a piece of the
 * window's top, TITEL wide and TITEL high (or the whole height of a window
 * lower than that, like the compact strip), lies on one connected monitor.
 */
export function sichtbar(r: { x: number; y: number; w: number; h: number }, monitore: readonly Monitor[]): boolean {
  const breit = Math.min(TITEL, r.w);
  const hoch = Math.min(TITEL, r.h);
  return monitore.some((m) => {
    const sx = Math.min(r.x + r.w, m.x + m.width) - Math.max(r.x, m.x);
    const sy = Math.min(r.y + hoch, m.y + m.height) - Math.max(r.y, m.y);
    return sx >= breit && sy >= hoch;
  });
}

/** The middle of the main monitor, at the remembered size but no bigger than its work area. */
export function rueckfall(lage: { w: number; h: number }, haupt: Monitor): { x: number; y: number; w: number; h: number } {
  const w = Math.min(lage.w, haupt.width);
  const h = Math.min(lage.h, haupt.height);
  return { x: haupt.x + Math.round((haupt.width - w) / 2), y: haupt.y + Math.round((haupt.height - h) / 2), w, h };
}

/** Where full view opens: its remembered place, the fallback, or null for Electron's default. */
export function platzGross(roh: unknown, monitore: readonly Monitor[], haupt: Monitor | null): LageGross | null {
  const lage = pruefen(roh, "gross");
  if (!lage) return null;
  if (sichtbar(lage, monitore)) return lage;
  if (!haupt) return null;
  return { ...rueckfall(lage, haupt), max: lage.max };
}

/** Where compact goes: its remembered corner, the fallback, or null to stay where it is. */
export function platzKompakt(roh: unknown, monitore: readonly Monitor[], haupt: Monitor | null): LageKompakt | null {
  const lage = pruefen(roh, "kompakt");
  if (!lage) return null;
  const streifen = { x: lage.x, y: lage.y, w: KOMPAKT_W, h: KOMPAKT_H };
  if (sichtbar(streifen, monitore)) return lage;
  if (!haupt) return null;
  const r = rueckfall(streifen, haupt);
  return { x: r.x, y: r.y };
}

/*
 * The new value of "fenster" with one part replaced, or null when nothing may
 * be written: the new place is none, or the key holds something that is not
 * an object - someone else's, left as it stands. Everything else in it is
 * carried over as it is, valid or not: a place this app does not use is not
 * one it removes.
 */
export function fensterNeu(alt: unknown, teil: Teil, neu: unknown): Record<string, unknown> | null {
  const lage = teil === "gross" ? pruefen(neu, "gross") : pruefen(neu, "kompakt");
  if (!lage) return null;
  if (alt === undefined) return { [teil]: lage };
  const o = objekt(alt);
  return o ? { ...o, [teil]: lage } : null;
}

/** The timer the Merker runs on: setTimeout in window.ts, a fake clock in the test. */
export interface Uhr {
  stelle(fn: () => void, ms: number): unknown;
  loesche(t: unknown): void;
}
export interface Merker {
  /** a move or resize: write WARTE_MS after the last one */
  ereignis(): void;
  /** write what is waiting now (before a switch of view, on close) */
  jetzt(): void;
  /** drop what is waiting */
  halt(): void;
}

export function neuerMerker(schreibe: () => void, uhr: Uhr, warte = WARTE_MS): Merker {
  let t: unknown = null;
  const halt = (): void => {
    if (t !== null) uhr.loesche(t);
    t = null;
  };
  return {
    ereignis() {
      halt();
      t = uhr.stelle(() => {
        t = null;
        schreibe();
      }, warte);
    },
    jetzt() {
      if (t === null) return;
      halt();
      schreibe();
    },
    halt,
  };
}
