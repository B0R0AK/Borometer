// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Das schmale Datenformat der Rechenkerne der neuen Analyse (#414,
 * Spezifikation 2026-11-08-analyse-neu-zeitleiste-design.md, Abschnitt 4) und
 * die Handgriffe, die alle vier Kerne teilen. Reiner Kern: kein State, kein
 * DOM, kein Netz. Der Adapter der Seite (app/80-analyse-daten.ts) baut das
 * Format aus dem Kampf; die Kerne lesen nur dieses.
 *
 * Zeiten in Sekunden ab Kampfbeginn. Sprache steckt nie in einem Kern: wo ein
 * Satz gemeint ist, liefert er einen Schluessel des Woerterbuchs samt Zahlen.
 */

import { luecken, type Luecken } from "./analyse-core";

/** [t, sid, Name, Schaden, Treffer, krit, stark] */
export type EinsatzZeile = [number, string, string, number, number, number, number];
/** [t, Form, Treffer, Schaden, krit, stark, Wellengroessen]; Form: -1 unlesbar, 0 nur Oeffner, N Nachbeben */
export type SalveZeile = [number, number, number, number, number, number, number[]];

export interface Kampfdaten {
  hauptziel: string;
  dauerS: number;
  schaden: number;
  dps: number;
  schadenJeSekunde: number[];
  einsaetze: EinsatzZeile[];
  /** [t, Ziel]; nur Wechsel auf einen anderen Namen, der erste Eintrag ist das Startziel */
  zielwechsel: [number, string][];
  ventius: null | { salven: SalveZeile[] };
  fehlschlaege?: number;
  waffen?: string[];
  /** Sekunden, die nicht zaehlen: das Ziel war unverwundbar oder der Boss tat eine erkannte Mechanik (so lang wie schadenJeSekunde); fehlt es, zaehlt jede Sekunde */
  nichtGezaehlt?: boolean[];
}

/** Die Luecken eines Kampfs nach dem Median. Eine Sekunde, die nicht zaehlt, ist weder Luecke noch Teil des Medians (so rechnete die Seite sie immer). */
export const lueckenVon = (k: Pick<Kampfdaten, "schadenJeSekunde" | "nichtGezaehlt">): Luecken => luecken(k.schadenJeSekunde, k.nichtGezaehlt);

/** Ein Satz fuer das Woerterbuch: Schluessel (analysis.e.*) und was ihn fuellt. */
export interface Satz {
  key: string;
  vars: Record<string, unknown>;
  /** ohne Wertung gesetzt (grau) */
  neutral?: boolean;
}

export const hatVentius = (k: Kampfdaten | null | undefined): boolean =>
  !!(k && k.ventius && k.ventius.salven && k.ventius.salven.length);

/** Summe von xs ueber die ganzen Sekunden [a, b). */
export function summe(xs: readonly number[], a: number, b: number): number {
  let s = 0;
  for (let i = Math.max(0, Math.floor(a)); i < Math.min(xs.length, Math.ceil(b)); i++) s += xs[i]!;
  return s;
}

export const imBereich = (e: { t: number }, a: number, b: number): boolean => e.t >= a && e.t < b;

export function perzentil(xs: readonly number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
}
