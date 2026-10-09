// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The weeklies' reminders (spec Weeklies neu, 6): the schedule runs here
 * (zeitplan.ts), the page says how many characters still have something
 * open, and notify.ts shows the stored text. The main process reads no
 * counter and no log; it sends nothing anywhere. Only the stored text
 * of a reminder goes into a notification, never one from the page.
 */

import { bump } from "./events";
import { Anfragen, meldeText, sollZeigen, ANTWORT_FRIST, type Gespeichert } from "./erinnerung-core";
import { meldeErinnerung } from "./notify";
import { naechste, type Regel } from "./zeitplan-core";
import { zeitplanStarten } from "./zeitplan";

type Win = Parameters<typeof meldeErinnerung>[0];

const anfragen = new Anfragen();
/* The window, the icon and the source of the stored reminders are handed in:
   only server.ts reaches the weeklies' file (it passes the reader on). */
const halter = { win: (() => null) as () => Win, icon: "", quelle: (() => []) as () => Gespeichert[] };

/** The stored reminders as rules; a missing or unreadable file gives none. */
function regeln(): Regel[] {
  return halter.quelle().map((r) => ({ id: r.id, an: r.an, tage: r.tage, zeit: r.zeit, geloest: r.geloest === true }));
}
const gespeichert = (id: string) => halter.quelle().find((r) => r.id === id && r.an && !r.geloest);

/** The reader of the stored reminders, handed in by the server, which alone reads the weeklies' file. */
export function erinnerungQuelle(quelle: () => Gespeichert[]): void {
  halter.quelle = quelle;
}

function zeigen(id: string, n: number | null): boolean {
  const r = gespeichert(id);
  if (!r || !sollZeigen(r.nurOffen, n)) return false;
  return meldeErinnerung(halter.win(), halter.icon, meldeText(r.text, n));
}

/** Starts the schedule: a due reminder asks the page for the number, and shows the notification when it answers or runs out of time. */
export function erinnerungStarten(opts: { win: () => Win; icon: string }): void {
  halter.win = opts.win;
  halter.icon = opts.icon;
  zeitplanStarten({
    regeln,
    beiFaellig: (id, um) => {
      if (!gespeichert(id)) return;
      anfragen.neu(id, um, Date.now());
      bump("erinnerung");
      // no answer within the time: show without the number, or stay silent when only "open" was asked for
      setTimeout(() => { if (anfragen.verfallene(Date.now()).includes(id)) zeigen(id, null); }, ANTWORT_FRIST + 100);
    },
  });
}

/** For GET /api/erinnerung: the open requests and the next moment of every reminder. */
export function erinnerungAbfrage(): { anfragen: { id: string }[]; naechste: Record<string, number | null> } {
  const jetzt = Date.now();
  const next: Record<string, number | null> = {};
  for (const r of regeln()) next[r.id] = naechste(r, jetzt);
  return { anfragen: anfragen.offene(jetzt).map((id) => ({ id })), naechste: next };
}

/** For POST /api/erinnerung: only an id and a number, nothing else is read. true when it was an open request. */
export function erinnerungAntwort(id: unknown, n: unknown): boolean {
  if (typeof id !== "string" || typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 60) return false;
  if (!anfragen.antwort(id, Date.now())) return false;
  zeigen(id, n);
  return true;
}
