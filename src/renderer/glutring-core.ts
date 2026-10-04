// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* ---------- Glutring und Rennen - der rechnende Kern ----------
   Spezifikation docs/superpowers/specs/2026-10-02-glutring-design.md. Wie
   mechanik-core.ts: kein state, kein Netz, kein Import - Zahlen hinein,
   Zahlen heraus. Die Teile 64 und 65 liefern Werte je Schluessel, Treffer
   je Art und Sekundenreihen; getestet von scripts/test-glutring-core.mjs.
   Winkel im Bogenmass wie im Canvas: 0 ist 3 Uhr, positiv im
   Uhrzeigersinn, 12 Uhr ist -PI/2. */

export type Kat = "normal" | "crit" | "heavy" | "critheavy" | "shield";
/** Die vier Arten, die jede aufgeklappte Zeile zeigt, in dieser Reihenfolge (Spezifikation 4). */
export const ARTEN: readonly Kat[] = ["normal", "crit", "heavy", "critheavy"];
const KATS: readonly Kat[] = ["normal", "crit", "heavy", "critheavy", "shield"];

export const VOLL = 2 * Math.PI;
export const OBEN = -Math.PI / 2;
/** Die Haarfuge zwischen zwei Boegen, hoechstens ein Fuenftel des Bogens. */
export const FUGE = 0.014;
/** Beschriftet wird ein Bogen ab 10 Grad (Spezifikation 3). */
export const SCHRIFT_AB = Math.PI / 18;
export const RING_MIN = 280, RING_MAX = 760;
/** 1x spielt den ganzen Kampf in etwa 10 s (Spezifikation 6). */
export const RENNEN_MS = 10000;

export interface Bogen { key: string; wert: number; anteil: number; a0: number; a1: number }

/** Boegen ab start ueber spanne, nach Wert absteigend; Null und weniger fallen weg. */
export function boegen(teile: readonly {key: string; wert: number}[], start = OBEN, spanne = VOLL, fuge = FUGE): Bogen[] {
  const da = teile.map((x, i) => ({key: x.key, wert: x.wert, i})).filter(x => x.wert > 0)
    .sort((a, b) => b.wert - a.wert || a.i - b.i);
  const summe = da.reduce((s, x) => s + x.wert, 0);
  if(!(summe > 0)) return [];
  let a = start;
  return da.map(x => {
    const breite = spanne * x.wert / summe, luecke = Math.min(fuge, breite * 0.2);
    const b = {key: x.key, wert: x.wert, anteil: x.wert / summe, a0: a + luecke / 2, a1: a + breite - luecke / 2};
    a += breite;
    return b;
  });
}
/** Ein Winkel, gefaltet nach [OBEN, OBEN + VOLL). */
export function winkelNorm(w: number): number {
  let x = w;
  while(x < OBEN) x += VOLL;
  while(x >= OBEN + VOLL) x -= VOLL;
  return x;
}
/** Der Bogen unter einem Winkel, oder null (Fuge, nichts). */
export function bogenBei(liste: readonly Bogen[], winkel: number): Bogen | null {
  const w = winkelNorm(winkel);
  return liste.find(b => w >= b.a0 && w <= b.a1) || null;
}
/** Steht der Bogen breit genug fuer eine Beschriftung? */
export function mitSchrift(b: Bogen, spanne = VOLL): boolean {
  return b.anteil * spanne >= SCHRIFT_AB - 1e-9;
}
/** Die Boegen auf dem Weg von alt nach neu; f von 0 bis 1. Ein neuer Bogen waechst aus seinem Anfang. */
export function zwischen(alt: readonly Bogen[], neu: readonly Bogen[], f: number): Bogen[] {
  const k = Math.max(0, Math.min(1, f));
  const vorher = new Map(alt.map(b => [b.key, b]));
  return neu.map(b => {
    const v = vorher.get(b.key) || {a0: b.a0, a1: b.a0};
    return {...b, a0: v.a0 + (b.a0 - v.a0) * k, a1: v.a1 + (b.a1 - v.a1) * k};
  });
}
/** Der Durchmesser im Ringfeld (Punkt) und ob daneben Platz fuer Beschriftung ist (E 7). */
export function ringMass(b: number, h: number, gestapelt: boolean): {d: number; schrift: boolean} {
  const roh = gestapelt ? Math.min(b - 32, 460) : Math.min(b * 0.6, h * 0.76);
  const d = Math.round(Math.max(RING_MIN, Math.min(RING_MAX, roh)));
  return {d, schrift: (b - d) / 2 >= 130};
}

export interface ArtZeile { kat: Kat; n: number; d: number; max: number; anteil: number }
export interface ArtenBlock { zeilen: ArtZeile[]; n: number; d: number; max: number; schnitt: number }
type Summe = {n: number; d: number; max: number};
function block(je: Map<Kat, Summe>): ArtenBlock {
  let n = 0, d = 0, max = 0;
  for(const v of je.values()){ n += v.n; d += v.d; if(v.max > max) max = v.max; }
  const zeilen = KATS.filter(k => ARTEN.includes(k) || (je.get(k)?.n || 0) > 0).map(k => {
    const v = je.get(k) || {n: 0, d: 0, max: 0};
    return {kat: k, n: v.n, d: v.d, max: v.max, anteil: d > 0 ? v.d / d : 0};
  });
  return {zeilen, n, d, max, schnitt: n ? d / n : 0};
}
/** Treffer je Name und Art: immer die vier Arten, Schild nur mit Schildtreffern (E 5). */
export function artenZaehlen(treffer: Iterable<{name: string; kat: Kat; dmg: number}>): Map<string, ArtenBlock> {
  const roh = new Map<string, Map<Kat, Summe>>();
  for(const x of treffer){
    let je = roh.get(x.name);
    if(!je){ je = new Map(); roh.set(x.name, je); }
    let v = je.get(x.kat);
    if(!v){ v = {n: 0, d: 0, max: 0}; je.set(x.kat, v); }
    v.n++; v.d += x.dmg; if(x.dmg > v.max) v.max = x.dmg;
  }
  return new Map([...roh].map(([k, je]) => [k, block(je)] as [string, ArtenBlock]));
}
/** Dieselben Zeilen aus dem Bericht eines Mitglieds (k, h, d, m wie artenJe in 42). */
export function artenAusBericht(cats: readonly {k: string; h: number; d: number; m: number}[]): ArtenBlock {
  const je = new Map<Kat, Summe>();
  for(const c of cats) if((KATS as readonly string[]).includes(c.k)) je.set(c.k as Kat, {n: c.h, d: c.d, max: c.m});
  return block(je);
}

/** Die Sekundenreihe aufsummiert: Wert i ist der Schaden bis zum Ende der Sekunde i. */
export function aufsummiert(werte: readonly number[]): number[] {
  let s = 0;
  return werte.map(v => (s += v || 0));
}
/** Der aufsummierte Wert zur Zeit t (Sekunden, auch zwischen zwei Sekunden). */
export function wertBei(kum: readonly number[], t: number): number {
  const T = kum.length;
  if(!T || t <= 0) return 0;
  if(t >= T) return kum[T - 1]!;
  const i = Math.floor(t), a = i > 0 ? kum[i - 1]! : 0, b = kum[i]!;
  return a + (b - a) * (t - i);
}
export interface RennPlatz { key: string; wert: number; platz: number }
/** Die Rangliste zur Zeit t; Gleichstand: Reihenfolge der Eingabe. */
export function rennStand(reihen: readonly {key: string; kum: readonly number[]}[], t: number): RennPlatz[] {
  return reihen.map((r, i) => ({key: r.key, wert: wertBei(r.kum, t), i}))
    .sort((a, b) => b.wert - a.wert || a.i - b.i)
    .map((x, p) => ({key: x.key, wert: x.wert, platz: p + 1}));
}
/** Seit welcher Sekunde der Sieger vorn liegt, ohne die Spitze wieder abzugeben; 0 von Anfang an. */
export function fuehrtSeit(reihen: readonly {key: string; kum: readonly number[]}[]): number {
  const T = Math.max(0, ...reihen.map(r => r.kum.length));
  const vorn = (s: number) => rennStand(reihen, s + 1)[0]?.key;
  let seit = 0;
  for(let s = 1; s < T; s++) if(vorn(s) !== vorn(s - 1)) seit = s;
  return seit;
}
/** Wie viele Sekunden des Kampfes in ms vergehen: 1x spielt T Sekunden in RENNEN_MS. */
export function rennSchritt(T: number, tempo: number, ms: number): number {
  return Math.max(0, ms) * T * tempo / RENNEN_MS;
}
/** Eine Reihenfarbe mit Deckkraft a; was keine Hex- oder rgb-Farbe ist, bleibt. */
export function farbeMitAlpha(farbe: string, a: number): string {
  const f = farbe.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(f);
  if(m){ const [r, g, b] = m[1]!.split("").map(x => parseInt(x + x, 16)); return `rgba(${r},${g},${b},${a})`; }
  m = /^#([0-9a-f]{6})$/i.exec(f);
  if(m){ const n = parseInt(m[1]!, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
  const r = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(f);
  return r ? `rgba(${r[1]},${r[2]},${r[3]},${a})` : f;
}
