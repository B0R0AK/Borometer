// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The pure parts of a weeklies reminder (spec Weeklies neu, 6.3): the text
 * with its {n}, the decision whether to show, and the open requests the
 * page answers. No Electron, no file. Only the stored text ever goes out;
 * nothing the page sends becomes part of a notification.
 */

/** How long the page has to answer; later, the request is gone. */
export const ANTWORT_FRIST = 15000;

/** The text of the notification: {n} becomes the number; without one, {n} and the space before it go. */
export function meldeText(text: string, n: number | null): string {
  return n === null ? text.replace(/ ?\{n\}/g, "") : text.replace(/\{n\}/g, String(n));
}

/** Whether to show: a reminder "only when open" stays silent at 0, and without an answer. */
export function sollZeigen(nurOffen: boolean, n: number | null): boolean {
  return nurOffen ? n !== null && n > 0 : true;
}

/** The requests the main process has put and the page has not yet answered. */
export class Anfragen {
  private offen = new Map<string, number>();
  neu(id: string, _um: number, jetztMs: number): void { this.offen.set(id, jetztMs); }
  /** the ids still waiting and not expired */
  offene(jetztMs: number): string[] {
    return [...this.offen].filter(([, seit]) => jetztMs - seit < ANTWORT_FRIST).map(([id]) => id);
  }
  /** true once per request, only while it is open and in time */
  antwort(id: string, jetztMs: number): boolean {
    const seit = this.offen.get(id);
    if (seit === undefined || jetztMs - seit >= ANTWORT_FRIST) return false;
    this.offen.delete(id);
    return true;
  }
  /** the ids that ran out of time without an answer; they are taken off the list */
  verfallene(jetztMs: number): string[] {
    const weg = [...this.offen].filter(([, seit]) => jetztMs - seit >= ANTWORT_FRIST).map(([id]) => id);
    for (const id of weg) this.offen.delete(id);
    return weg;
  }
}

/** A stored reminder as the schedule needs it; the file's own type (weeklies.ts) has these fields and more. */
export interface Gespeichert { id: string; an: boolean; tage: number[]; zeit: string; text: string; nurOffen: boolean; geloest?: boolean }
