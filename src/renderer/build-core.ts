// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Der Kern des Waffenpaars und der Zahlen am Kampf (app/47-paar.ts):
   Waffen und Paar, Bezug "dasselbe Paar", Median, Einordnung, Abendgrenze.
   Der Builds-Reiter ist entfallen (#207); was an Builds, Plaenen und ihrer
   Form hing, gibt es hier nicht mehr. Keine Seite, kein state, kein Import
   ausser Typen: scripts/test-builds-core.mjs buendelt diese Datei allein und
   prueft sie unter Node. Was die Seite weiss - welche Waffe eine Faehigkeit
   hat -, bekommt der Kern schon aufgeloest (BauSkill). */

import type { Lang } from "./types";

/* Unter so vielen Werten steht kein Median - fuer den Verlauf: sonst waere der "Median"
   von zweien nur ihr Mittelwert - keine Mitte, die ein Ausreisser nicht
   verschiebt. EIN Wert fuer eine Sache. */
export const MIN_MEDIAN = 3;
/* Die Waffen, wie das Log sie nennt. Das Verlaufsverzeichnis traegt ein Paar als zwei Indizes in diese
   Liste (HistFight.w) - Zahlen, nie Text. Nur hinten verlaengern, nie
   umsortieren: alte Eintraege lesen sonst eine andere Waffe. */
export const WAFFEN: readonly string[] = ["", "Greatsword", "Sword and Shield", "Dagger", "Crossbow", "Longbow",
  "Staff", "Wand and Tome", "Spear", "Gauntlet", "Orb"];
/** Ein Paar als zwei Indizes; null, wenn eine Waffe fremd ist oder die erste fehlt. */
export function paarCode(w: readonly string[]): [number, number] | null {
  const a = WAFFEN.indexOf(w[0] ?? ""), b = WAFFEN.indexOf(w[1] ?? "");
  return a > 0 && b >= 0 ? [a, b] : null;
}
/** Zwei Indizes zurueck zum Paar; null bei jeder anderen Form. */
export function paarAus(c: unknown): [string, string] | null {
  if(!Array.isArray(c) || c.length !== 2 || !c.every(n => Number.isInteger(n) && n >= 0 && n < WAFFEN.length) || c[0] === 0) return null;
  return [WAFFEN[c[0]]!, WAFFEN[c[1]]!];
}
/** Eine Faehigkeit, wie der Kern sie braucht: sprachfreier Schluessel, Waffe, Schaden. */
export interface BauSkill {
  key: string;
  weapon: string;
  damage: number;
}
/* Passiv und Unzugewiesen zaehlen nicht als Waffe - dieselbe Regel wie
   weaponShares() in 42-party.ts. Sie bleiben im Nenner. */
const KEINE_WAFFE = new Set(["", "Passive", "Unassigned"]);
const nachSchaden = (a: [string, number], b: [string, number]) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

/* Das Paar, das autoPair() (42-party.ts) fuer einen fertigen Kampf liest:
   die Waffe mit dem meisten Schaden, dazu die zweite, wenn sie mindestens
   offMin Prozent des GANZEN Schadens traegt. Ohne das Mitschreiben ueber die
   Live-Durchlaeufe (state.autoSeen) - das braucht nur ein wachsender Kampf,
   und es gehoert der Anzeige. */
export function pairFromSkills(skills: BauSkill[], total: number, offMin: number): [string, string] | null {
  if(!(total > 0)) return null;
  const je = new Map<string, number>();
  for(const k of skills){
    if(KEINE_WAFFE.has(k.weapon)) continue;
    je.set(k.weapon, (je.get(k.weapon) || 0) + k.damage);
  }
  const teile = [...je.entries()].sort(nachSchaden);
  if(!teile.length) return null;
  const zweite = teile[1];
  return [teile[0]![0], zweite && 100 * zweite[1] / total >= offMin ? zweite[0] : ""];
}

/** Dasselbe Paar, gleich in welcher Reihenfolge: welche Waffe vorn liegt, kann von Kampf zu Kampf kippen. */
export function samePair(a: readonly string[], b: readonly string[]): boolean {
  return [...a].sort().join("|") === [...b].sort().join("|");
}

/* Der Median, und zwar der eine der App: die Boss-Tabelle im Bereich
   Builds (bossTabelle) und der Verlauf (histTargets und
   histVerdict in 32-history.ts) rufen diese Funktion (der
   Clanabend-Rueckblick entfaellt, Neugestaltung 28.09.). Bei gerader Anzahl der Mittelwert der beiden
   mittleren Werte - der echte Median; frueher nahm er den oberen, und aus
   29.8k, 30.2k, 33.2k und 36.3k wurde 33.2k statt 31.7k (Entscheidung
   vom 25.09.). Zwei Rechnungen fuer "Median" in einer App waeren zwei
   Zahlen fuer eine Sache. */
export function mitte(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const h = (s.length / 2) | 0;
  return s.length % 2 ? s[h]! : (s[h - 1]! + s[h]!) / 2;
}

/* Die Einordnung im Streifen (Instrumententafel 4): Median ("sonst"),
   bester Wert und dieser Pull als Lagen 0..1 auf einer waagerechten Skala.
   Die Skala reicht vom kleinsten zum groessten der drei Werte, mit einem
   Viertel der Spanne Luft links und einem Sechstel rechts, damit keine
   Marke am Rand klebt. Sind alle gleich, stehen sie in der Mitte. */
export function einordnungSkala(med: number, best: number, cur: number): { sonst: number; bester: number; dieser: number } {
  const lo = Math.min(med, best, cur), hi = Math.max(med, best, cur);
  const spanne = hi - lo;
  if(!(spanne > 0)) return {sonst: 0.5, bester: 0.5, dieser: 0.5};
  const a = lo - spanne / 4, b = hi + spanne / 6;
  const lage = (x: number) => (x - a) / (b - a);
  return {sonst: lage(med), bester: lage(best), dieser: lage(cur)};
}

const zwei = (n: number) => String(n).padStart(2, "0");
/* Die Abendgrenze: ein Abend geht von 12:00 bis 11:59 des Folgetags
   (Spezifikation Fortschritt, Merkmal 4 und offene Frage 6 - fest, nicht
   waehlbar). Ein Raid, der um 23 Uhr beginnt und um 1 Uhr endet, bleibt so
   ein Abend. (Das Bautagebuch zaehlte je Abend bis Aufgabe 12, 29.09.; der
   Clanabend-Rueckblick, der mit derselben Grenze zaehlte, entfiel mit der
   Neugestaltung 28.09.) */
export const ABEND_STUNDE = 12;
/* Der Abend eines Kampfes, auf der Uhr des Logs - die UTC-Felder, wie
   pullWhen() in best-pull-core.ts. */
export function abend(ms: number): string {
  const d = new Date(ms - ABEND_STUNDE * 3600 * 1000);
  return d.getUTCFullYear() + "-" + zwei(d.getUTCMonth() + 1) + "-" + zwei(d.getUTCDate());
}
export function abendText(tag: string, lang: Lang): string {
  const [, m, d] = tag.split("-");
  return lang === "de" ? d + "." + m + "." : d + "/" + m;
}

/** Das Paar eines Kampfs: w (zwei Indizes in WAFFEN), sonst unbekannt. Ein altes b im Verzeichnis zaehlt nicht mehr (#207). */
export function kampfPaar(f: { w?: unknown }): [string, string] | null {
  return paarAus(f.w);
}
/* Derselbe Bezug (Spezifikation 6, seit #207 ohne Build): dasselbe Paar, in
   jeder Reihenfolge. Unbekanntes nie. */
export function gleicherBezug(hier: readonly string[] | null, dort: readonly string[] | null): boolean {
  return !!hier && !!dort && samePair(hier, dort);
}
