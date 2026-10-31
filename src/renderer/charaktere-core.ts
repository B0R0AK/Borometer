// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Der Kern der Charaktere (Spezifikation 2026-10-15-twinks-design.md, 2, 3
   und 5): ein Kampf gehoert zu dem Charakter, dessen Logname genau so im
   Log steht (Gross- und Kleinschreibung zaehlt, sonst nichts), Main ist
   genau einer oder keiner. Rein gerechnet, ohne Seite und ohne Netz; der
   Test (scripts/test-charaktere-core.mjs) liest die Zahlen direkt.

   Namen verlassen diesen Kern nie: zuordnungsStand und charakterFuer geben
   nur Kennungen zurueck. Was im Verlauf landet, ist die Kennung. */

export interface CharEintrag { id: string; log: string }
/** Hoechstens 24 Zeichen, wie der Name eines Charakters in der Datei (weeklies.ts: NAME_RX). */
export const LOG_MAX = 24;
const STEUER = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

/** Der Logname ohne Steuer- und Formatzeichen, getrimmt; null, wenn er leer oder zu lang ist. */
export function logSauber(roh: string): string | null {
  const s = String(roh ?? "").replace(STEUER, "").trim();
  return s && [...s].length <= LOG_MAX ? s : null;
}

/** Geht dieser Logname? Doppelt ist er nur, wenn ein anderer aktiver Charakter (nicht "ausser") ihn schon traegt. */
export function logPruefen(roh: string, profile: readonly { id: string; log?: string; geloest?: boolean }[], ausser?: string):
  { ok: true; log: string } | { ok: false; grund: "leer" | "doppelt" } {
  const log = logSauber(roh);
  if(log == null) return {ok: false, grund: "leer"};
  if(profile.some(p => !p.geloest && p.id !== ausser && p.log === log)) return {ok: false, grund: "doppelt"};
  return {ok: true, log};
}

/** Die Kennung des Charakters, dessen Logname genau dem Angreifer entspricht; "" heisst keiner (auch fuer "__all" und ""). */
export function charakterFuer(angreifer: string, liste: readonly CharEintrag[]): string {
  if(!angreifer || angreifer === "__all") return "";
  for(const c of liste) if(c.log === angreifer) return c.id;
  return "";
}

/** Der Stand der Zuordnung: die Kennungen, sortiert, mit "," verbunden. Er traegt nie einen Namen; leer ohne Charaktere. */
export function zuordnungsStand(liste: readonly CharEintrag[]): string {
  return liste.map(c => c.id).sort().join(",");
}

/** Dieselbe Liste mit genau einem Main (oder keinem bei null). Ein geloester oder unbekannter Charakter wird nie Main; die Eingabe bleibt unberuehrt. */
export function mainSetzen<P extends { id: string; geloest?: boolean; main?: boolean }>(profile: readonly P[], id: string | null): P[] {
  const ziel = id == null ? null : profile.find(p => p.id === id && !p.geloest) ?? null;
  if(id != null && !ziel) return profile.map(p => ({...p}));
  return profile.map(p => {
    const q = {...p};
    delete q.main;
    if(ziel && p.id === ziel.id) q.main = true;
    return q;
  });
}

/** Die Folge der Weeklies und des Streifens (Twinks Schritt 3): der Main vorn, die anderen in ihrer Folge; ohne Main bleibt alles. Ein geloester zaehlt nie als Main. */
export function mainZuerst<P extends { geloest?: boolean; main?: boolean }>(liste: readonly P[]): P[] {
  const i = liste.findIndex(p => p.main && !p.geloest);
  return i <= 0 ? [...liste] : [liste[i]!, ...liste.slice(0, i), ...liste.slice(i + 1)];
}

/** In den Rekorden steht "?" fuer einen Kampf ohne bekannten Charakter (Spezifikation Twinks 4). */
export const UNBEKANNT = "?";

/* Wem ein Kampf in den Rekorden gehoert (Spezifikation Twinks 3 und 4): dem aktiven Charakter seiner
   Kennung; keinem (null), solange dieser geloest ist - Zurueckholen stellt ihn wieder her; sonst
   "unbekannt": ohne ch, mit "" oder mit einer Kennung, die nicht mehr in der Liste steht. */
export function halterVon(ch: unknown, aktiv: ReadonlySet<string>, geloest: ReadonlySet<string>): string | null {
  if(typeof ch !== "string" || !ch || ch === UNBEKANNT) return UNBEKANNT;
  if(aktiv.has(ch)) return ch;
  return geloest.has(ch) ? null : UNBEKANNT;
}

/** Die Kaempfe eines Halters (Kennung oder "?"); null heisst Gesamt: alle, die einem aktiven Charakter oder keinem bekannten gehoeren. */
export function kaempfeVon<K extends { ch?: unknown }>(kaempfe: readonly K[], halter: string | null, aktiv: ReadonlySet<string>, geloest: ReadonlySet<string>): K[] {
  return kaempfe.filter(k => { const h = halterVon(k.ch, aktiv, geloest); return h !== null && (halter === null || h === halter); });
}
