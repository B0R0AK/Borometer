// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Der Kern des Streifens (Spezifikation Kompakt-Fenster, 04.10.2026):
   ob ein Kampf laeuft, wann er zuletzt wuchs, die Durchsicht im
   Durchklick und die Restzeile unter den Top 5. Rein: er importiert
   nichts und fasst weder Seite noch Netz an (Audit). */

export type KampfZustand = "kampf" | "nach";

/* "kampf", solange Live laeuft, der neueste Kampf gewaehlt ist und er vor
   weniger als trennS Sekunden zuletzt wuchs - so lange Stille, und das Log
   beginnt einen neuen Kampf. Alles Ungueltige ist "nach". */
export function kampfZustand(e: { live: boolean; neuester: boolean; seitWachstumMs: number; trennS: number }): KampfZustand {
  const ms = e.seitWachstumMs, trenn = e.trennS;
  if(!e.live || !e.neuester) return "nach";
  if(!Number.isFinite(ms) || ms < 0 || !Number.isFinite(trenn) || trenn <= 0) return "nach";
  return ms < trenn * 1000 ? "kampf" : "nach";
}

/* Der neueste Kampf, wie ihn ein Live-Abruf hinterlaesst: sein Schluessel
   (Start des ersten Treffers und Ziel, wie fightKey) und sein Ende. */
export type KampfMarke = { key: string; ende: number } | null;

/* Wann der neueste Kampf zuletzt wuchs, gemessen an der Uhr der Seite (die
   Uhr des Logs kann in einer anderen Zone stehen). Das erste Laden ist kein
   Wachstum: ein Kampf, der schon dastand, laeuft nicht deshalb. Danach
   (nachErstem) ist der Sprung von keinem Kampf auf einen schon Wachstum:
   der erste Kampf eines frischen Logs. */
export function wachstum(vorher: KampfMarke, jetzt: KampfMarke, bisher: number | null, nowMs: number, nachErstem = false): number | null {
  if(!jetzt) return null;
  if(!vorher) return nachErstem ? nowMs : bisher;
  return vorher.key !== jetzt.key || vorher.ende !== jetzt.ende ? nowMs : bisher;
}

/* Durchklickbar heisst 40 % durchsichtig (#57), auf der Skala des Reglers.
   Steht der Regler hoeher, gilt er. */
export const DURCHKLICK_SICHT = 40;
export function durchsichtWirksam(regler: number, durchklick: boolean): number {
  return durchklick ? Math.max(regler, DURCHKLICK_SICHT) : regler;
}

/* Die Restzeile (#160): was unter der letzten ganzen Zeile liegt. alle:
   der Schaden jeder Hauptzeile, unten: der Schaden der Zeilen darunter. */
export type Rest = { n: number; anteil: number; schaden: number };
export function restZeile(alle: number[], unten: number[]): Rest | null {
  if(!unten.length) return null;
  const summe = (xs: number[]) => xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const ges = summe(alle), schaden = summe(unten);
  return { n: unten.length, anteil: ges > 0 ? schaden / ges : 0, schaden };
}
