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
/** Die Boegen beim Aufwachsen: alle Winkel ab OBEN mit ease (0 bis 1) gestaucht. Gezeichnet und getroffen wird dasselbe. */
export function gewachsen(liste: readonly Bogen[], ease: number): Bogen[] {
  if(ease >= 1) return liste as Bogen[];
  const k = Math.max(0, ease);
  return liste.map(b => ({...b, a0: OBEN + (b.a0 - OBEN) * k, a1: OBEN + (b.a1 - OBEN) * k}));
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
/** Die Rangliste zur Zeit t; Gleichstand: Reihenfolge der Eingabe. Der Rest
    (z. B. "Uebrige") steht zuletzt ohne Platz (platz 0), er laeuft ausser Konkurrenz. */
export function rennStand(reihen: readonly {key: string; kum: readonly number[]}[], t: number, rest?: string): RennPlatz[] {
  const alle = reihen.map((r, i) => ({key: r.key, wert: wertBei(r.kum, t), i}));
  const vorn = alle.filter(x => x.key !== rest).sort((a, b) => b.wert - a.wert || a.i - b.i)
    .map((x, p) => ({key: x.key, wert: x.wert, platz: p + 1}));
  const hinten = alle.filter(x => x.key === rest).map(x => ({key: x.key, wert: x.wert, platz: 0}));
  return [...vorn, ...hinten];
}
/** Seit welcher Sekunde der Sieger vorn liegt, ohne die Spitze wieder abzugeben; 0 von Anfang an. Der Rest zaehlt nicht. */
export function fuehrtSeit(reihen: readonly {key: string; kum: readonly number[]}[], rest?: string): number {
  const T = Math.max(0, ...reihen.map(r => r.kum.length));
  const vorn = (s: number) => rennStand(reihen, s + 1, rest)[0]?.key;
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

/** Die ersten n nach Wert, der Rest als ein Teil mit der Summe (wie perSecond in 16 und das Rennen). */
export function zusammenfassen(teile: readonly {key: string; wert: number}[], n = 12, key = "__rest__"):
    {teile: {key: string; wert: number}[]; rest: string[]} {
  const nach = teile.map((x, i) => ({...x, i})).sort((a, b) => b.wert - a.wert || a.i - b.i);
  if(nach.length <= n) return {teile: nach.map(x => ({key: x.key, wert: x.wert})), rest: []};
  const hinten = nach.slice(n);
  return {teile: [...nach.slice(0, n).map(x => ({key: x.key, wert: x.wert})), {key, wert: hinten.reduce((s, x) => s + x.wert, 0)}],
    rest: hinten.map(x => x.key)};
}

/** Abstand zweier Hex-Farben in OKLab, mal 100 (wie die Kommentare in styles.css). */
export function oklabAbstand(a: string, b: string): number {
  const lab = (hex: string) => {
    const n = parseInt(hex.replace("#", ""), 16);
    const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    const r = lin(n >> 16 & 255), g = lin(n >> 8 & 255), bl = lin(n & 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  };
  const p = lab(a), q = lab(b);
  return 100 * Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!);
}

/* ---------- Gruppenkurven (Spezifikation 2026-10-04) ----------
   Die gemeldeten Kurven der Mitglieder auf einer gemeinsamen Uhr: der
   frueheste Start ist der Nullpunkt, jede Reihe beginnt um ihren Versatz
   spaeter. Fehlt bei einer Reihe die Wanduhr, beginnen alle bei 0 s - ein
   halber Abgleich behauptete einen Versatz, den es nicht gibt. */
export interface KurvenReihe { key: string; t0: number | null; werte: readonly number[] }
export interface GruppenRennen { start: number | null; T: number; bahnen: {key: string; kum: number[]; ab: number}[]; total: number[] }
/** Hoechster Versatz der Starts in Sekunden. Die Uhrzeit im Log hat keine
    Zeitzone: ein Mitglied in einer anderen Zone oder mit falscher PC-Uhr liegt
    Stunden daneben. Darueber beginnen alle Bahnen bei 0 s. */
export const VERSATZ_MAX = 60;
export function gruppenBahnen(reihen: readonly KurvenReihe[]): GruppenRennen {
  const mitUhr = reihen.length > 0 && reihen.every(r => typeof r.t0 === "number" && isFinite(r.t0));
  const fruehst = mitUhr ? Math.min(...reihen.map(r => r.t0 as number)) : null;
  const spaet = mitUhr ? Math.max(...reihen.map(r => r.t0 as number)) : 0;
  const start = fruehst !== null && Math.round((spaet - fruehst) / 1000) <= VERSATZ_MAX ? fruehst : null;
  const ab = reihen.map(r => start === null ? 0 : Math.round(((r.t0 as number) - start) / 1000));
  const T = Math.max(0, ...reihen.map((r, i) => ab[i]! + r.werte.length));
  const total: number[] = new Array(T).fill(0);
  const bahnen = reihen.map((r, i) => {
    const v: number[] = new Array(T).fill(0);
    r.werte.forEach((x, j) => { const s = ab[i]! + j; v[s] = x || 0; total[s] = (total[s] || 0) + (x || 0); });
    return {key: r.key, kum: aufsummiert(v), ab: ab[i]!};
  });
  return {start, T, bahnen, total};
}
/** Gehoert eine geholte Kurve zu dieser Zeile? Der Server haelt je Mitglied nur
    die neueste. Dauer hoechstens 3 s, Summe hoechstens 2 % daneben - mindestens
    T, weil jede Sekunde der Kurve gerundet gemeldet wird. */
export function kurvePasst(k: {T: number; total: readonly number[]} | null | undefined,
                           z: {damage?: number | null; seconds?: number | null}): boolean {
  if(!k || !(k.T > 0) || !Array.isArray(k.total) || !k.total.length) return false;
  const d = z.damage || 0, s = z.seconds || 0;
  if(!(d > 0) || !(s > 0)) return false;
  const summe = k.total.reduce((a, v) => a + (v || 0), 0);
  return Math.abs(k.T - s) <= 3 && Math.abs(summe - d) <= Math.max(0.02 * d, k.T);
}
