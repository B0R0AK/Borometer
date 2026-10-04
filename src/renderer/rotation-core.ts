// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Der rechnende Kern von "Deine Rotation" (app/54-deine-rotation.ts),
   Spezifikation docs/superpowers/specs/2026-09-27-deine-rotation-design.md,
   Abschnitt 6. Keine Seite, kein state, kein Import ausser Typen:
   scripts/test-rotation-core.mjs buendelt diese Datei allein und prueft sie
   unter Node. Was die Seite weiss - wie eine Faehigkeit sprachfrei heisst,
   warum Borometer sie fuer automatisch haelt -, bekommt der Kern schon
   aufgeloest.

   Stufe 1: was automatisch ist, die Folge der gedrueckten Einsaetze samt
   Stille, die Wahl am Build, die Etagen der Leiste. Stufe 2: die Uhr zum
   Abspielen, der Einsatz zu einer Zeit und was die Leiste unter Live
   stueckweise weiterbauen laesst. Neugestaltung 28.09. (Spezifikation 3):
   der Massstab nach dem Median-Abstand, das Mitrollen und die Folge mit
   Durchgaengen (Stufe 3) entfallen; die Leiste zeigt den ganzen Kampf auf
   der Breite (leistenDauer), und die Strecken, in denen das Ziel
   unverwundbar war, rechnet dieser Kern fuer die Analyse. */

/** Die Wahl je Faehigkeit am Build: 0 zurueckgenommen, 1 von selbst, 2 druecke ich. */
export type RotWahl = 0 | 1 | 2;
/* Warum Borometer eine Faehigkeit fuer automatisch haelt - nur, was es
   sicher weiss (Entscheidung 26.09. abends): Passiv in der festen
   Tabelle, von dir im Waffen-Reiter als Passiv markiert, in der festen
   Liste VON_SELBST, oder in einem anderen Build desselben Waffenpaars
   bestaetigt. Keine Takt- oder Gefolge-Regel. */
export type Grund = "passiv" | "markiert" | "liste" | "anderer";
/** Eine Faehigkeit des Kampfes: sprachfreier Schluessel (skillKey) und ihr Grund, falls einer. */
export interface RotSkill { k: string; grund: Grund | null }
/** Ein Einsatz: Schluessel, Beginn und Ende (letzter Treffer), in ms seit Kampfbeginn. */
export interface RotEinsatz { k: string; t: number; ende: number }
/** Eine Stille zwischen zwei gedrueckten Einsaetzen, in ms seit Kampfbeginn. */
export interface Stille { von: number; bis: number }
/** So lange ohne laufenden gedrueckten Einsatz ist Stille. */
export const STILLE_MS = 2000;

/* Die Wahl zu einem Schluessel - nur ein eigener Eintrag: "toString" oder
   "constructor" kennt jedes Objekt schon ueber Object.prototype, und `k in
   rot` hielte sie fuer gewaehlt. */
export function wahlVon(rot: Readonly<Record<string, RotWahl>>, k: string): RotWahl | undefined {
  return Object.hasOwn(rot, k) ? rot[k] : undefined;
}

/* Was aus der Leiste faellt (Spezifikation 6.1): 2 holt eine Faehigkeit
   zurueck, 1 nimmt sie fest heraus - mit ihrem Grund, sonst "hand" (von
   dir weggelassen) -, 0 und keine Wahl lassen den Grund entscheiden: mit
   Grund vorlaeufig draussen, ohne drin. */
export function automatisch(skills: readonly RotSkill[], rot: Readonly<Record<string, RotWahl>>):
    Map<string, { grund: Grund | "hand"; fest: boolean }> {
  const raus = new Map<string, { grund: Grund | "hand"; fest: boolean }>();
  for(const s of skills){
    const w = wahlVon(rot, s.k);
    if(w === 2) continue;
    if(w === 1) raus.set(s.k, {grund: s.grund ?? "hand", fest: true});
    else if(s.grund) raus.set(s.k, {grund: s.grund, fest: false});
  }
  return raus;
}

const gleichesPaar = (a: readonly string[], b: readonly string[]) => [...a].sort().join("|") === [...b].sort().join("|");

/* Der Grund "anderer": ein anderer Build mit demselben Waffenpaar, in dem
   du die Faehigkeit als automatisch bestaetigt hast. Nie der eigene; die
   Kennungen in fester Reihenfolge, damit derselbe Vorschlag immer denselben
   Build nennt. */
export function andererBau(k: string, hier: { id: string | null; weapons: readonly string[] },
    builds: Readonly<Record<string, { weapons: readonly string[]; rot?: Readonly<Record<string, RotWahl>> }>>): string | null {
  for(const id of Object.keys(builds).sort()){
    if(id === hier.id) continue;
    const b = builds[id]!;
    if(b.rot && wahlVon(b.rot, k) === 1 && gleichesPaar(b.weapons, hier.weapons)) return id;
  }
  return null;
}

/* Die Folge: gedrueckte und automatische Einsaetze getrennt, beide nach
   der Zeit, dazu die Stille zwischen den gedrueckten - gemessen vom Ende
   des letzten, der noch trifft, bis zum Beginn des naechsten. */
export function folge(einsaetze: readonly RotEinsatz[], aus: ReadonlySet<string>):
    { gedrueckt: RotEinsatz[]; auto: RotEinsatz[]; stille: Stille[] } {
  const alle = [...einsaetze].sort((a, b) => a.t - b.t);
  const gedrueckt = alle.filter(e => !aus.has(e.k));
  const auto = alle.filter(e => aus.has(e.k));
  const stille: Stille[] = [];
  let ende = -Infinity;
  for(const e of gedrueckt){
    if(ende > -Infinity && e.t - ende >= STILLE_MS) stille.push({von: ende, bis: e.t});
    ende = Math.max(ende, e.ende, e.t);
  }
  return {gedrueckt, auto, stille};
}

/* Eine Wahl setzen: ein neues Objekt, nie ein Schluessel entfernt. Ein neuer
   Schluessel ueber der Grenze wird nicht gesetzt (null) - die Seite sagt es
   und haelt die Wahl in der Sitzung. */
export function wahlSetzen(rot: Readonly<Record<string, RotWahl>>, k: string, v: RotWahl, max: number): Record<string, RotWahl> | null {
  if(!Object.hasOwn(rot, k) && Object.keys(rot).length >= max) return null;
  return {...rot, [k]: v};
}

/* Die Wahlen der Sitzung, sobald der Build bekannt ist: nur fuer
   Schluessel, zu denen der Build noch nichts sagt, bis zur Grenze. null,
   wenn sich nichts aendert. */
export function sitzungUebernehmen(rot: Readonly<Record<string, RotWahl>>, sitzung: Readonly<Record<string, RotWahl>>,
    max: number): Record<string, RotWahl> | null {
  let neu: Record<string, RotWahl> | null = null;
  for(const k of Object.keys(sitzung)){
    const basis = neu ?? rot;
    if(Object.hasOwn(basis, k)) continue;
    const r = wahlSetzen(basis, k, sitzung[k]!, max);
    if(!r) break;
    neu = r;
  }
  return neu;
}

/* Die Etage je Symbol, wie in der alten Leiste: die unterste, in der es mit
   `luft` Punkten Abstand zum vorigen passt; passt es in keine der `n`, steht
   es nur als Strich im Band (-1). `xs` sind die Mitten, der Reihe nach. */
export function etagen(xs: readonly number[], platte: number, luft: number, n: number): number[] {
  return etagenFort(xs, platte, luft, new Array<number>(n).fill(-1e9));
}

/* Dieselbe Regel, fortgesetzt: `platz` haelt je Etage den rechten Rand des
   letzten Symbols und waechst mit. Weil die Etage eines Symbols nur an den
   Symbolen davor haengt, ergibt das Anhaengen genau, was ein Bau am Stueck
   ergaebe (Stufe 2: unter Live haengt die Leiste nur die neuen Einsaetze an). */
export function etagenFort(xs: readonly number[], platte: number, luft: number, platz: number[]): number[] {
  return xs.map(x => {
    for(let r = 0; r < platz.length; r++) if(x - platte / 2 >= platz[r]! + luft){ platz[r] = x + platte / 2; return r; }
    return -1;
  });
}

/* ---------- Stufe 2: Abspielen (Spezifikation 5.5) ---------- */

/** Stille ueber so vielen ms ... */
export const STILLE_LANG_MS = 3000;
/** ... laeuft beim Abspielen in so vielen ms durch; die Uhr springt mit. */
export const STILLE_SPIEL_MS = 1000;

/* Die Uhr mit Zehnteln, "0:13,8" (Spezifikation 12: neben clock()),
   abgerundet - sie soll nie eine Zeit zeigen, die noch nicht war. Das
   Dezimalzeichen gibt die Seite nach der Sprache. */
export function uhrZehntel(ms: number, dez: string): string {
  const z = Math.max(0, Math.floor(ms / 100));
  const s = Math.floor(z / 10) % 60, m = Math.floor(z / 600);
  return m + ":" + String(s).padStart(2, "0") + dez + (z % 10);
}

/** Kampfzeit und Spielzeit (Echtzeit bei 1x) ineinander umrechnen. */
export interface AbspielUhr { spiel(kampfMs: number): number; kampf(spielMs: number): number }

/* Die Abspieluhr: 1x ist Echtzeit, nur eine Stille ueber 3 s schrumpft
   gleichmaessig auf 1 s - sonst waere bei einem Kampf mit langer
   Unverwundbarkeit die Haelfte des Abspielens Warten. Stueckweise linear
   und streng steigend; die Stillen kommen der Reihe nach und ueberlappen
   nicht (folge()). */
export function abspielUhr(stille: readonly Stille[], ab = STILLE_LANG_MS): AbspielUhr {
  /* `ab` setzt die Schwelle: mit 1000 schrumpft jede Pause ueber 1 s auf
     1 s (die Folge der Stufe 3 tat das; sie entfaellt, die Seite nutzt die 3 s). */
  const lang = stille.filter(s => s.bis - s.von > Math.max(ab, STILLE_SPIEL_MS));
  return {
    spiel(ms){
      let spar = 0;
      for(const s of lang){
        if(ms <= s.von) break;
        const d = s.bis - s.von;
        if(ms >= s.bis){ spar += d - STILLE_SPIEL_MS; continue; }
        return ms - spar - (ms - s.von) * (1 - STILLE_SPIEL_MS / d);
      }
      return ms - spar;
    },
    kampf(sp){
      let spar = 0;
      for(const s of lang){
        const beginn = s.von - spar;   // Spielzeit am Anfang dieser Stille
        if(sp <= beginn) break;
        const d = s.bis - s.von;
        if(sp >= beginn + STILLE_SPIEL_MS){ spar += d - STILLE_SPIEL_MS; continue; }
        return s.von + (sp - beginn) * d / STILLE_SPIEL_MS;
      }
      return sp + spar;
    },
  };
}

/* Wo der Kopf nach dt ms Echtzeit steht: ueber die Spielzeit, damit das
   Tempo (0,5x, 1x, 2x) auch in einer gestauchten Stille gilt. */
export function weiter(uhr: AbspielUhr, kampfMs: number, dtMs: number, tempo: number): number {
  return uhr.kampf(uhr.spiel(kampfMs) + dtMs * tempo);
}

/* Der Einsatz, der zu einer Kampfzeit laeuft: der letzte, der schon
   begonnen hat (-1 davor). `ts` ist aufsteigend; binaer gesucht, weil der
   Kopf das je Bild fragt. */
export function einsatzBei(ts: readonly number[], ms: number): number {
  let lo = 0, hi = ts.length;
  while(lo < hi){ const m = (lo + hi) >> 1; if(ts[m]! <= ms) lo = m + 1; else hi = m; }
  return lo - 1;
}

/* Die Reihenfolge (Aufgabe 11, Nachtrag 29.09.; Vorlage die Folge vor der
   Neugestaltung, 6b72131): wo in der Reihe der gezeigten Einsaetze eine
   Stille steht - vor dem ersten Einsatz, der nach ihrem Ende beginnt. Nach
   dem letzten Einsatz steht keine; `ts` ist aufsteigend. */
export function stilleVor(ts: readonly number[], stille: readonly Stille[]): Map<number, Stille> {
  const vor = new Map<number, Stille>();
  for(const s of stille){
    const i = einsatzBei(ts, s.bis - 1) + 1;
    if(i > 0 && i < ts.length && !vor.has(i)) vor.set(i, s);
  }
  return vor;
}

/* ---------- die Zeitleiste: der ganze Kampf auf der Breite ---------- */

/* Die Leiste zeigt den ganzen Kampf auf der Breite (Neugestaltung 28.09.:
   der Massstab nach dem Median-Abstand und das Mitrollen entfallen,
   Spezifikation 3). Steht der Kampf, ist das genau seine Dauer. Unter Live
   waechst er: dann zeigt die Leiste mindestens eine Minute und sonst
   Vorlauf (x1,5, auf die Minute gerundet) und behaelt das, solange der
   Kampf hineinpasst - so bleibt der Massstab ueber viele Takte, und die
   Leiste haengt nur an, statt je Takt alles neu zu setzen. Schrumpft der
   Kampf unter die Haelfte (neu geschnitten), gilt der Vorlauf nicht mehr.
   Vorlage: Branch claude/entwurf-angleichung. */
export const LEISTE_LIVE_MIN_MS = 60000;
export const LEISTE_VORLAUF = 1.5;
export const LEISTE_RASTER_MS = 60000;
export function leistenDauer(dauerMs: number, alt: number | null, waechst: boolean): number {
  const d = Math.max(1000, dauerMs);
  if(!waechst) return d;
  if(alt != null && d <= alt && d >= alt / 2) return alt;
  return Math.max(LEISTE_LIVE_MIN_MS, Math.ceil(d * LEISTE_VORLAUF / LEISTE_RASTER_MS) * LEISTE_RASTER_MS);
}

/* ---------- das Feld "Einsaetze" (Luecken 3.7) ---------- */

/** Ein gedrueckter Einsatz fuer den Takt: Schluessel, Beginn in ms seit Kampfbeginn, Treffer. */
export interface TaktEinsatz { k: string; t: number; treffer: number }
/** Eine Zeile im Feld "Einsaetze": je Faehigkeit. */
export interface TaktZeile {
  k: string;
  /** Einsaetze, je Minute Kampf, mittlerer Abstand zweier Einsaetze in ms (null bei einem), Treffer je Einsatz */
  n: number; jeMinute: number; abstand: number | null; trefferJe: number;
  /** die Zeitpunkte, aufsteigend - die Striche der Takt-Spalte */
  ts: number[];
}

/* Der Takt der Einsaetze (Feld "Einsaetze" des Entwurfs): je Faehigkeit,
   wie oft sie gedrueckt wurde, wie oft je Minute des Kampfes, der mittlere
   Abstand zwischen zwei Einsaetzen (O, vom ersten bis zum letzten durch
   die Zahl der Abstaende) und die Treffer je Einsatz. Die Seite gibt hinein,
   was sie zeigen will; sortiert nach Einsaetzen, bei Gleichstand der
   fruehere zuerst. Vorlage: Branch claude/entwurf-angleichung. */
export function takt(einsaetze: readonly TaktEinsatz[], dauerMs: number): TaktZeile[] {
  const je = new Map<string, { ts: number[]; treffer: number }>();
  for(const e of [...einsaetze].sort((a, b) => a.t - b.t)){
    let z = je.get(e.k);
    if(!z){ z = {ts: [], treffer: 0}; je.set(e.k, z); }
    z.ts.push(e.t);
    z.treffer += e.treffer;
  }
  const min = Math.max(1, dauerMs) / 60000;
  const zeilen: TaktZeile[] = [];
  for(const [k, z] of je){
    const n = z.ts.length;
    zeilen.push({k, n, jeMinute: n / min, abstand: n > 1 ? (z.ts[n - 1]! - z.ts[0]!) / (n - 1) : null, trefferJe: z.treffer / n, ts: z.ts});
  }
  return zeilen.sort((a, b) => b.n - a.n || a.ts[0]! - b.ts[0]! || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
}

/* ---------- Unverwundbar (Issue #37) ---------- */

/** Treffer auf Unverwundbare, die naeher als das beieinander liegen, sind eine Strecke. */
export const FUGE_MS = 1500;

/* Die Strecken, in denen das Ziel unverwundbar war: Treffer auf
   Unverwundbare (kInvincible), die naeher als FUGE_MS beieinander liegen,
   sind eine Strecke; ein einzelner Treffer ist ein Punkt (von = bis). Die
   Analyse (06-blocks-and-places.ts, 05-fights.ts) rechnet damit, damit
   Befund, Form und Zeitverlauf dieselbe Stelle meinen. Zeiten in ms, nach
   Beginn geordnet. Aus trainer-core.ts hierher (Neugestaltung 28.09.: der
   Rotationstrainer entfaellt, Spezifikation 3). */
export function unverwundbarStrecken(treffer: readonly { t: number; ziel: string }[]): { von: number; bis: number; ziel: string }[] {
  const raus: { von: number; bis: number; ziel: string }[] = [];
  let offen: { von: number; bis: number; ziel: string } | null = null;
  for(const u of [...treffer].sort((x, y) => x.t - y.t)){
    if(offen && u.t - offen.bis <= FUGE_MS){ offen.bis = u.t; continue; }
    offen = {von: u.t, bis: u.t, ziel: u.ziel};
    raus.push(offen);
  }
  return raus;
}
