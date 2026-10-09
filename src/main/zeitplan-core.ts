// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * When a weekday-and-time rule falls due, in the computer's local time
 * (spec Weeklies neu, 6.1). Pure: no clock, no Electron, no file, no
 * network. A rule is the same shape for the weeklies' reminders and for
 * anything else that wants a weekly appointment (the guild window).
 */

export interface Regel { id: string; an: boolean; tage: number[]; zeit: string; geloest?: boolean }
/** the offset of local time to UTC at a moment, in ms (what Date's getTimezoneOffset gives, negated) */
export type Versatz = (ms: number) => number;

export const localOffset: Versatz = (ms) => -new Date(ms).getTimezoneOffset() * 60000;

/** A reminder counts only when it is at most this old: a computer that slept does not catch up. */
export const FRIST = 90000;
const TAG = 86400000;
const ZEIT_RX = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** how far ahead naechste() looks: a week and a day, so every weekday is met once */
const FENSTER = 8 * TAG;

/* The real moment of a local day and time. A time inside the spring gap is
   shifted by the gap (02:30 becomes 03:30), a time that occurs twice in
   autumn counts once, at its second turn. */
function um(tagFelder: number, h: number, m: number, versatz: Versatz): number {
  const w = tagFelder + (h * 60 + m) * 60000;
  const erst = w - versatz(w);
  return w - versatz(erst);
}

/** Every moment um with vonMs < um <= bisMs at which an active rule falls due, oldest first. */
export function faelligkeiten(regeln: readonly Regel[], vonMs: number, bisMs: number, versatz: Versatz = localOffset): { id: string; um: number }[] {
  if (!(bisMs > vonMs)) return [];
  const aus: { id: string; um: number }[] = [];
  const ersterTag = Math.floor((vonMs + versatz(vonMs)) / TAG) * TAG - TAG;
  const letzterTag = Math.floor((bisMs + versatz(bisMs)) / TAG) * TAG + TAG;
  for (const r of regeln) {
    const z = ZEIT_RX.exec(r.zeit);
    if (!r.an || r.geloest || !z || !r.tage.length) continue;
    for (let tag = ersterTag; tag <= letzterTag; tag += TAG) {
      if (!r.tage.includes(new Date(tag).getUTCDay())) continue;
      const t = um(tag, Number(z[1]), Number(z[2]), versatz);
      if (t > vonMs && t <= bisMs) aus.push({ id: r.id, um: t });
    }
  }
  return aus.sort((a, b) => a.um - b.um);
}

/** The next moment after abMs at which the rule falls due, or null (off, detached, no days, no valid time). */
export function naechste(regel: Regel, abMs: number, versatz: Versatz = localOffset): number | null {
  const f = faelligkeiten([regel], abMs, abMs + FENSTER, versatz);
  return f.length ? f[0]!.um : null;
}
