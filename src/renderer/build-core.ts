// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Der rechnende Kern des Bautagebuchs (app/47-builds.ts).
   Keine Seite, kein state, kein Import ausser Typen: scripts/test-builds-core.mjs
   buendelt diese Datei allein und prueft sie unter Node. Was die Seite
   weiss - welche Waffe eine Faehigkeit hat, wie sie sprachunabhaengig
   heisst -, bekommt der Kern schon aufgeloest (BauSkill). */

import type { Bau, BauStore, Lang } from "./types";

/** So viel des Schadens tragen die tragenden Faehigkeiten zusammen mindestens. */
export const BAU_ANTEIL = 0.8;
/** Hoechstens so viele tragende Faehigkeiten. */
export const BAU_KERN_MAX = 6;
/* Derselbe Bau: gleiches Waffenpaar und mindestens so viele tragende
   Faehigkeiten gemeinsam. Vier von sechs, weil eine Faehigkeit auch mal
   knapp unter die Schwelle rutscht (Spezifikation Fortschritt, offene
   Frage 4 - der Standard, bis anders entschieden wird). Hat ein Kern
   weniger als vier, muessen alle seine Faehigkeiten im anderen stehen. */
export const BAU_GLEICH = 4;
/* Unter so vielen Werten steht kein Median - fuer die Karten im Bereich
   Builds (kartenZahlen in plan-core.ts) und den Verlauf: sonst waere der "Median"
   von zweien nur ihr Mittelwert - keine Mitte, die ein Ausreisser nicht
   verschiebt. EIN Wert fuer eine Sache. */
export const MIN_MEDIAN = 3;
/** Dieselbe Regel wie ID_RX in src/main/builds.ts - beide gleich halten. */
export const BAU_ID_RX = /^[0-9a-z]{10}$/;
export const BAU_NAME_MAX = 40;
/* Hoechstens so viele Wahlen von "Deine Rotation" je Bau (Bau.rot) -
   dieselbe Grenze wie MAX_ROT in src/main/builds.ts, beide gleich halten.
   Ein Bau hat etwa zwoelf Faehigkeiten und ein paar Procs. */
export const BAU_ROT_MAX = 24;
/** Ein Bau als JSON hoechstens so lang - dieselbe Grenze wie MAX_ENTRY in src/main/builds.ts, beide gleich halten. */
export const BAU_ENTRY_MAX = 4096;
/** Dieselbe Regel wie LINK_RX in src/main/builds.ts - beide gleich halten. */
export const BAU_LINK_RX = /^https:\/\/[^\s\u0000-\u001f\u007f]{1,292}$/;

/** Eine Faehigkeit, wie der Kern sie braucht: sprachfreier Schluessel, Waffe, Schaden. */
export interface BauSkill {
  key: string;
  weapon: string;
  damage: number;
}
/** Woran ein Bau erkannt wird: das Waffenpaar und die tragenden Faehigkeiten. */
export interface Fingerprint {
  weapons: [string, string];
  core: string[];
}
export interface HandPair {
  main: string;
  off: string;
}

/* Passiv und Unzugewiesen zaehlen nicht als Waffe - dieselbe Regel wie
   weaponShares() in 42-party.ts. Sie bleiben im Nenner. */
const KEINE_WAFFE = new Set(["", "Passive", "Unassigned"]);
const nachSchaden = (a: [string, number], b: [string, number]) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

/* Das Paar, das autoPair() (42-party.ts) fuer einen fertigen Kampf liest:
   die Waffe mit dem meisten Schaden, dazu die zweite, wenn sie mindestens
   offMin Prozent des GANZEN Schadens traegt. Ohne das Mitschreiben ueber die
   Live-Durchlaeufe (state.autoSeen) - das braucht nur ein wachsender Kampf,
   und es gehoert der Anzeige, nicht der Erkennung. */
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

/* Die tragenden Faehigkeiten: nach Schaden, bis zusammen BAU_ANTEIL des
   ganzen Schadens erreicht ist, hoechstens BAU_KERN_MAX. Ein Satzbonus
   (Passiv) ist keine Faehigkeit, die jemand waehlt, und bleibt draussen;
   er zaehlt nur im Nenner. Zwei Raenge derselben Faehigkeit haben denselben
   Schluessel und werden zusammengezaehlt. */
export function coreFromSkills(skills: BauSkill[], total: number): string[] {
  if(!(total > 0)) return [];
  const je = new Map<string, number>();
  for(const k of skills){
    if(k.weapon === "Passive" || !k.key || !(k.damage > 0)) continue;
    je.set(k.key, (je.get(k.key) || 0) + k.damage);
  }
  const kern: string[] = [];
  let summe = 0;
  for(const [key, d] of [...je.entries()].sort(nachSchaden)){
    if(kern.length >= BAU_KERN_MAX || summe >= BAU_ANTEIL * total) break;
    kern.push(key);
    summe += d;
  }
  return kern;
}

/** Der Fingerabdruck eines Kampfes. Eine Handauswahl (weaponPick) gewinnt beim Paar, wie ueberall. */
export function fingerprint(skills: BauSkill[], total: number, offMin: number, hand?: HandPair | null): Fingerprint | null {
  const core = coreFromSkills(skills, total);
  if(!core.length) return null;
  const weapons: [string, string] | null = hand && hand.main ? [hand.main, hand.off || ""] : pairFromSkills(skills, total, offMin);
  return weapons ? {weapons, core} : null;
}

/** Dasselbe Paar, gleich in welcher Reihenfolge: welche Waffe vorn liegt, kann von Kampf zu Kampf kippen. */
export function samePair(a: readonly string[], b: readonly string[]): boolean {
  return [...a].sort().join("|") === [...b].sort().join("|");
}

export function sharedCore(a: readonly string[], b: readonly string[]): number {
  const s = new Set(a);
  return b.filter(k => s.has(k)).length;
}

export function sameBau(a: Fingerprint, b: Fingerprint): boolean {
  if(!samePair(a.weapons, b.weapons)) return false;
  const noetig = Math.min(BAU_GLEICH, a.core.length, b.core.length);
  return noetig > 0 && sharedCore(a.core, b.core) >= noetig;
}

/* FNV-1a, zweimal mit verschiedenem Anfang: zehn Zeichen aus zwei 32-Bit-
   Werten. Keine Sicherheit, nur eine kurze Kennung, die fuer denselben
   ersten Kampf auf jedem Rechner dieselbe ist. */
function fnv(text: string, seed: number): number {
  let h = seed >>> 0;
  for(let i = 0; i < text.length; i++){
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
/** Die Kennung eines neuen Baus, aus seinem ersten Fingerabdruck. */
export function bauId(fp: Fingerprint): string {
  const text = [...fp.weapons].sort().join("+") + "|" + [...fp.core].sort().join(",");
  return (fnv(text, 2166136261).toString(36).padStart(7, "0") +
          fnv(text, 0x9e3779b9).toString(36).padStart(7, "0")).slice(0, 10);
}

/* Der bekannte Bau, zu dem ein Fingerabdruck gehoert: der mit den meisten
   gemeinsamen tragenden Faehigkeiten, bei Gleichstand der aeltere. */
export function findBau(fp: Fingerprint, store: BauStore): string | null {
  let wahl: string | null = null, n = -1, first = Infinity;
  for(const id of Object.keys(store)){
    const b = store[id]!;
    if(!sameBau(fp, b)) continue;
    const k = sharedCore(fp.core, b.core);
    if(k > n || (k === n && b.first < first)){ wahl = id; n = k; first = b.first; }
  }
  return wahl;
}

/* Der Median, und zwar der eine der App: die Karten im Bereich Builds
   (kartenZahlen in plan-core.ts) und der Verlauf (histTargets und
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

/* "Langbogen/Dolch 1": die Nummer je Waffenpaar, in der Reihenfolge des
   ersten Kampfes. Sie wird nicht gespeichert, sondern jedes Mal gezaehlt -
   der Name ohne Namen folgt so der Sprache der Waffen. */
export function bauNummern(store: BauStore): Record<string, number> {
  const je = new Map<string, { id: string; first: number }[]>();
  for(const id of Object.keys(store)){
    const k = [...store[id]!.weapons].sort().join("|");
    let l = je.get(k);
    if(!l){ l = []; je.set(k, l); }
    l.push({id, first: store[id]!.first});
  }
  const raus: Record<string, number> = {};
  for(const l of je.values()){
    l.sort((a, b) => a.first - b.first || (a.id < b.id ? -1 : 1));
    l.forEach((e, i) => { raus[e.id] = i + 1; });
  }
  return raus;
}

/* ---------- Pruefungen fuer das, was aus der Datei oder dem Feld kommt ---------- */

export function nameOk(n: unknown): n is string {
  return typeof n === "string" && n.length <= BAU_NAME_MAX && !/[\u0000-\u001f\u007f]/.test(n);
}
/** Ein Name aus dem Feld: Steuerzeichen raus, Leerraum zusammengezogen; null, wenn er zu lang bleibt. */
export function cleanName(roh: string): string | null {
  const n = roh.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return n.length <= BAU_NAME_MAX ? n : null;
}
export function linkOk(s: unknown): s is string {
  if(typeof s !== "string" || !BAU_LINK_RX.test(s)) return false;
  try { return new URL(s).protocol === "https:"; } catch { return false; }
}

/* Die Wahlen von "Deine Rotation" (Spezifikation Deine Rotation 7): ein
   Objekt mit hoechstens BAU_ROT_MAX Schluesseln zu 1-80 Zeichen, jeder Wert
   eine ganze Zahl 0, 1 oder 2; kein __proto__ oder prototype und kein Name,
   den Object.prototype schon hat (constructor, toString ...) - dieselbe
   Pruefung wie putBuild. */
/** Dieselbe Regel wie ROT_KEY_RX in src/main/builds.ts - beide gleich halten: 1-80 Zeichen, nicht __proto__ oder prototype. */
export const BAU_ROT_KEY_RX = /^(?!(?:__proto__|prototype)$)[\s\S]{1,80}$/;
export function rotOk(r: unknown): r is Record<string, 0 | 1 | 2> {
  if(!r || typeof r !== "object" || Array.isArray(r)) return false;
  const e = Object.entries(r);
  return e.length <= BAU_ROT_MAX &&
    e.every(([k, v]) => BAU_ROT_KEY_RX.test(k) && !Object.hasOwn(Object.prototype, k) && Number.isInteger(v) && v >= 0 && v <= 2);
}

// any: die Pruefung entscheidet erst, ob der Wert die Form hat
export function looksLikeBau(e: any): e is Bau {
  return !!e && typeof e === "object" && !Array.isArray(e) && nameOk(e.name) &&
    Array.isArray(e.weapons) && e.weapons.length === 2 &&
    e.weapons.every((w: unknown) => typeof w === "string" && w.length <= 40) &&
    Array.isArray(e.core) && e.core.length >= 1 && e.core.length <= BAU_KERN_MAX &&
    e.core.every((k: unknown) => typeof k === "string" && k.length > 0 && k.length <= 80) &&
    (e.link === undefined || linkOk(e.link)) && (e.rot === undefined || rotOk(e.rot)) && Number.isFinite(e.first) &&
    // geloest (Fixrunde 1 zu Aufgabe 12): ein Zeitpunkt, der Bau bleibt gespeichert
    (e.geloest === undefined || Number.isFinite(e.geloest));
}
/* Was putBuild annimmt: die Form und hoechstens BAU_ENTRY_MAX Zeichen als
   JSON. Die Seite fragt vorher, statt einen POST mit 400 scheitern zu lassen
   (ein Bau aus der Datei kann Felder tragen, die sie nicht kennt). */
export function bauPasst(b: unknown): boolean {
  return looksLikeBau(b) && JSON.stringify(b).length <= BAU_ENTRY_MAX;
}
