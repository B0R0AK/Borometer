// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Der Kern des erweiterten Rundgangs (Spezifikation 16.10.2026, #265): wann
   gefragt wird und wann ein Bereich seinen Hinweis zeigt. Rein, ohne Seite
   und Netz; die Seite (63, 74) liest und merkt, hier wird nur entschieden. */

/** Die Bereiche der Symbolleiste mit Hinweis (Kennung = data-tab). */
export const HINWEIS_BEREICHE = ["timeline", "rotation", "analysis", "compare", "history",
  "party", "weeklies", "gilde", "rekorde", "archiv", "settings"] as const;
/** So oft darf "Spaeter" gewaehlt werden; das letzte gilt wie "Nein". */
export const SPAETER_MAX = 3;

/** Kommt die Frage? Unbekanntes (null) heisst nein. Beim ersten Start einmal,
    danach nur, solange "Spaeter" gewaehlt wurde und weniger als dreimal. */
export function frageNoetig(a: { gesehen: boolean | null; ersterStart: boolean | null; spaeter: number | null; fenster: boolean }): boolean {
  if(!a.fenster || a.gesehen !== false || a.spaeter === null) return false;
  if(a.spaeter >= SPAETER_MAX) return false;
  if(a.spaeter >= 1) return true;
  return a.ersterStart === true;
}

export function naechstesSpaeter(spaeter: number): number {
  return Math.min(SPAETER_MAX, Math.max(0, Math.floor(spaeter)) + 1);
}

/** Die Liste der gezeigten Bereiche, wie sie aus den Einstellungen kommt:
    nur bekannte Kennungen, je einmal, in der Reihenfolge der Bereiche. */
export function gezeigtBereinigt(roh: unknown): string[] {
  if(!Array.isArray(roh)) return [];
  return HINWEIS_BEREICHE.filter(b => roh.includes(b));
}

/** Zeigt dieser Bereich jetzt seinen Hinweis? an: der Schalter (null = noch
    nicht gelesen, gilt als an); gezeigt: null, bis die Einstellungen da sind;
    ruhe: kein Rundgang offen, keine Frage da, nicht Kompakt. */
export function hinweisNoetig(a: { bereich: string; an: boolean | null; gezeigt: string[] | null; ruhe: boolean }): boolean {
  if(!a.ruhe || a.an === false || a.gezeigt === null) return false;
  return (HINWEIS_BEREICHE as readonly string[]).includes(a.bereich) && !a.gezeigt.includes(a.bereich);
}

export function gezeigtMit(gezeigt: string[], bereich: string): string[] {
  return gezeigtBereinigt([...gezeigt, bereich]);
}
