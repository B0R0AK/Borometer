// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The runner of the schedule (spec Weeklies neu, 6.2): every TAKT it asks
 * which rule fell due since the last look and calls beiFaellig. It keeps no
 * file and talks to nobody; a restart forgets, and a late moment is not
 * caught up (FRIST). The clock and the timer are given in, so the test sets
 * both.
 */

import { faelligkeiten, FRIST, localOffset, type Regel, type Versatz } from "./zeitplan-core";

export const TAKT = 20000;
const GEDAECHTNIS = 50;

export interface ZeitplanOpts {
  regeln: () => Regel[];
  beiFaellig: (id: string, um: number) => void;
  jetzt?: () => number;
  versatz?: Versatz;
  stelle?: (fn: () => void, ms: number) => unknown;
  loesche?: (handle: unknown) => void;
}

export function zeitplanStarten(opts: ZeitplanOpts): { stoppen(): void } {
  const jetzt = opts.jetzt ?? Date.now;
  const versatz = opts.versatz ?? localOffset;
  const stelle = opts.stelle ?? ((fn, ms) => setInterval(fn, ms));
  const loesche = opts.loesche ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>));
  let letzte = jetzt();
  const gemeldet: string[] = [];
  const tick = (): void => {
    const j = jetzt();
    // a clock set back: look forward from here, report nothing
    if (j < letzte) { letzte = j; return; }
    const von = Math.max(letzte, j - FRIST);
    for (const f of faelligkeiten(opts.regeln(), von, j, versatz)) {
      const key = f.id + "@" + f.um;
      if (gemeldet.includes(key)) continue;
      gemeldet.push(key);
      if (gemeldet.length > GEDAECHTNIS) gemeldet.shift();
      opts.beiFaellig(f.id, f.um);
    }
    letzte = j;
  };
  const handle = stelle(tick, TAKT);
  return { stoppen: () => loesche(handle) };
}
