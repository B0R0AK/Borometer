// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* ---------- Gilde online: der reine Kern (Spezifikation 2026-10-12-gilde-online-design.md, 2 und 5) ----------
   Ohne Seite und ohne Netz. Hier steht nur, was sich ohne Server rechnen laesst: die Einladung lesen und
   bauen (nie mit einer Adresse darin), die Adresse des Servers pruefen (nur https), die Rechte je Rolle,
   was auf eine Antwort folgt und die Regel "es darf nichts fehlen" gegen den Stand vom Server. */

import type { Gilde } from "./gilde-core";

export type OnlineRolle = "lead" | "bearbeiter" | "lesen";
export type Aktion = "lesen" | "schreiben" | "links" | "staende" | "zurueck" | "marke" | "schliessen";

/** Das Alphabet von Code und Schluessel, wie auf dem Server (kein 0/O, kein 1/I). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RX = new RegExp(`^[${ALPHABET}]{12}$`);
const KEY_RX = new RegExp(`^[${ALPHABET}]{26}$`);
const VORSATZ = "boro-gilde:";

/** Liest eine Einladung: "boro-gilde:CODE", "boro-gilde:CODE:SCHLUESSEL" oder den blanken Code.
    Eine Adresse darin gibt es nicht: alles, was nicht genau so aussieht, ist keine Einladung (null). */
export function parseEinladung(text: string): { code: string; key?: string } | null {
  let t = String(text ?? "").trim();
  if (t.toLowerCase().startsWith(VORSATZ)) t = t.slice(VORSATZ.length);
  const teile = t.split(":");
  if (teile.length < 1 || teile.length > 2) return null;
  const code = (teile[0] ?? "").replace(/-/g, "").toUpperCase();
  if (!CODE_RX.test(code)) return null;
  if (teile.length === 1) return { code };
  const key = (teile[1] ?? "").toUpperCase();
  return KEY_RX.test(key) ? { code, key } : null;
}

export function bauEinladung(code: string, key?: string): string {
  return VORSATZ + code + (key ? ":" + key : "");
}

/** Der Code in Vierergruppen zum Vorlesen und Abtippen. */
export function anzeigeCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

export type AdressePruefung = { ok: true; adresse: string } | { ok: false; grund: "leer" | "kein-https" | "ungueltig" };

/** Die Adresse des Servers, die der Nutzer selbst eintippt: nur https://rechner[:port], sonst nichts.
    Auch localhost bekommt kein http (Spezifikation 0). */
export function pruefeAdresse(roh: string): AdressePruefung {
  const t = String(roh ?? "").trim();
  if (!t) return { ok: false, grund: "leer" };
  if (!/^https:\/\//i.test(t)) return { ok: false, grund: "kein-https" };
  let u: URL;
  try { u = new URL(t); } catch { return { ok: false, grund: "ungueltig" }; }
  if (u.protocol !== "https:" || !u.hostname || u.username || u.password || u.pathname !== "/" || u.search || u.hash) {
    return { ok: false, grund: "ungueltig" };
  }
  return { ok: true, adresse: "https://" + u.host };
}

const RECHTE: Record<OnlineRolle, Aktion[]> = {
  lesen: ["lesen"],
  bearbeiter: ["lesen", "schreiben"],
  lead: ["lesen", "schreiben", "links", "staende", "zurueck", "marke", "schliessen"],
};

/** Darf die Rolle das? (Der Server prueft es noch einmal; das hier blendet nur die Knoepfe aus.) */
export function darf(rolle: OnlineRolle, aktion: Aktion): boolean {
  return RECHTE[rolle].includes(aktion);
}

export type Schritt = "ok" | "neu-laden" | "abgelehnt" | "spaeter" | "offline" | "beendet";

/** Was auf die Antwort des Servers folgt. 409: der Stand ist veraltet, es wird nichts ueberschrieben. */
export function naechsterSchritt(antwort: { status: number; v?: number }): Schritt {
  const s = antwort.status;
  if (!s) return "offline";
  if (s >= 200 && s < 300) return "ok";
  if (s === 409) return "neu-laden";
  if (s === 429) return "spaeter";
  if (s === 410) return "beendet";
  return "abgelehnt";
}

export type Fehlt = "mitglied" | "reihe" | "ausnahme" | "marke" | "art" | "eintrag" | "pause" | "zusatz" | "zaehler";

/** Dieselbe Regel wie gilde.ts: Ein Schreiben darf nichts verlieren, was der Stand schon hielt (Mitglied, Reihe,
    Ausnahme, Marke, Art, Eintrag, Pause, Zusatz, Zaehler). Loesen statt loeschen; eine Marke zurueck heisst "offen". */
export function pruefeSchreiben(alt: Gilde, neu: Gilde): { ok: true } | { ok: false; fehlt: Fehlt } {
  const nein = (fehlt: Fehlt) => ({ ok: false as const, fehlt });
  const neuM = new Map(neu.mitglieder.map((m) => [m.id, m]));
  for (const m of alt.mitglieder) {
    const n = neuM.get(m.id);
    if (!n) return nein("mitglied");
    if (m.punkte) {
      const p = n.punkte;
      if ((p?.ansehen.eintraege.length ?? 0) < m.punkte.ansehen.eintraege.length) return nein("eintrag");
      if ((p?.pausen.length ?? 0) < m.punkte.pausen.length) return nein("pause");
      if ((p?.zusatz.length ?? 0) < m.punkte.zusatz.length) return nein("zusatz");
    }
  }
  const neuR = new Map(neu.reihen.map((r) => [r.id, r]));
  for (const r of alt.reihen) {
    const n = neuR.get(r.id);
    if (!n) return nein("reihe");
    for (const tag of Object.keys(r.ausnahmen ?? {})) if (!(n.ausnahmen ?? {})[tag]) return nein("ausnahme");
  }
  for (const [termin, marken] of Object.entries(alt.anwesend ?? {})) {
    for (const mid of Object.keys(marken)) if (!(neu.anwesend ?? {})[termin]?.[mid]) return nein("marke");
  }
  const neuA = new Set((neu.punkte?.arten ?? []).map((a) => a.id));
  for (const a of alt.punkte?.arten ?? []) if (!neuA.has(a.id)) return nein("art");
  for (const [termin, je] of Object.entries(alt.zaehler ?? {})) {
    for (const mid of Object.keys(je)) if ((neu.zaehler ?? {})[termin]?.[mid] === undefined) return nein("zaehler");
  }
  return { ok: true };
}
