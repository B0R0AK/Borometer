// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Der rechnende Kern von "Gegen deinen besten Pull" (app/46-best-pull.ts).
   Keine Seite, kein state, kein Import ausser Typen: scripts/test-best-core.mjs
   buendelt diese Datei allein und prueft sie unter Node. */

import type { BestEntry, BestPull, Lang, PartyCasts } from "./types";

/** Die festen Laengen, in denen Kaempfe an der Uebungspuppe vergleichbar sind. */
export const DUMMY_CLASSES = [180, 120, 60] as const;
/** So viel darf ein Versuch unter der Klasse bleiben: wer bei 58,5 s aufhoert, meinte 60. */
export const DUMMY_SLACK = 2;

/** Die groesste Klasse, die der Versuch erreicht; darunter keine. */
export function dummyClass(seconds: number): number | null {
  for(const c of DUMMY_CLASSES) if(seconds >= c - DUMMY_SLACK) return c;
  return null;
}

/* Dieselbe Rechnung wie clip() in 16-fight-analysis.ts: ist der Kampf nicht
   laenger als die Klasse, bleibt er, wie er ist; sonst zaehlen die ersten
   ganzen Sekunden der Sekundenreihe, geteilt durch ihre Anzahl. Wer hier
   anders rechnete, kuerte einen besten Pull, den der Vergleich danach mit
   einer anderen Zahl zeigt. */
export function classDps(seconds: number, dps: number, perSecondTotal: number[], cls: number): number {
  if(seconds <= cls) return dps;
  const keep = Math.round(cls);
  let sum = 0;
  for(const v of perSecondTotal.slice(0, keep)) sum += v;
  return sum / keep;
}

/** Nur die Einsaetze, die vor `ms` begannen; leere Spuren fallen weg. */
export function cutCasts(list: PartyCasts[], ms: number): PartyCasts[] {
  return list.map(l => ({n: l.n, s: l.s, c: l.c.filter(c => c[0] < ms)})).filter(l => l.c.length > 0);
}

/* ---------- Die Regel fuer den besten Pull (Spezifikation Bester Pull 3) ----------
   Eine Regel fuer jede Stelle, die "bester Pull" sagt: Goldpunkt der
   Kampfwahl, Gegen deinen besten Pull, Rekorde, Verlauf. Erst die
   Mindestlaenge, dann die meisten DPS (Entscheidung vom 04.10., #151): ein Fehlstart
   mit starkem Opener ist nie der beste. Die Schwelle ist 60 s, oder die
   halbe Laenge des laengsten Pulls, wenn die kuerzer ist - so hat auch ein
   Boss, der nach 40 s liegt, einen besten Pull. Gemessen wird immer ueber
   die ganze Menge am Boss, nie ueber einen Ausschnitt. An der Puppe ist die
   Klasse (c) die Schwelle. */
export interface Pull { at: number; dps: number; dur: number; c?: number }
export const MINDEST_S = 60;
export function mindestLaenge(pulls: readonly Pull[]): number {
  let lang = 0;
  for(const p of pulls) if(p.dur > lang) lang = p.dur;
  return Math.min(MINDEST_S, lang / 2);
}
/** Die Kandidaten ab der Schwelle, nach DPS; bei gleicher DPS der fruehere zuerst. */
export function rangfolge<T extends Pull>(pulls: readonly T[], min = mindestLaenge(pulls)): T[] {
  return pulls.filter(p => p.dps > 0 && (p.c != null || p.dur >= min))
    .sort((a, b) => b.dps - a.dps || a.at - b.at);
}
/* Der beste Pull, oder null. Ein bester von einem ist keine Auskunft
   (#151, Punkt 2): erst ab zwei Pulls am Boss, kurze mitgezaehlt. */
export function besterPull<T extends Pull>(pulls: readonly T[]): T | null {
  return pulls.length < 2 ? null : rangfolge(pulls)[0] ?? null;
}

/* Zwei Plaetze je Boss. Derselbe Kampf (gleiches at) ersetzt sich selbst -
   ein Log, das erneut geladen wird oder beim Livelog waechst, zaehlt ihn
   nicht doppelt. Zuerst die Pulls ab der Schwelle min (Sekunden, von der
   Seite ueber die ganze Menge gemessen), darin nach DPS: ein kurzer
   Fehlstart verdraengt nie einen langen Pull. Ein kurzer bleibt, bis ein
   langer seinen Platz braucht - geloescht wird nichts, was nicht ersetzt ist.
   Bei gleicher DPS der fruehere, wie in rangfolge. */
export function mergeBest(entry: BestEntry | undefined, cand: BestPull, min = 0): BestEntry {
  const pulls: BestPull[] = [cand];
  for(const p of [entry?.best, entry?.second]) if(p && p.at !== cand.at) pulls.push(p);
  const lang = (p: BestPull) => (p.run.seconds ?? 0) >= min ? 1 : 0;
  pulls.sort((x, y) => lang(y) - lang(x) || y.run.dps - x.run.dps || x.at - y.at);
  return pulls[1] ? {best: pulls[0]!, second: pulls[1]} : {best: pulls[0]!};
}

/** Zwei Staende desselben Schlüssels; bei gleichem at gewinnt `newer`. */
export function mergeEntries(older: BestEntry | undefined, newer: BestEntry, min = 0): BestEntry {
  let out = mergeBest(older, newer.best, min);
  if(newer.second) out = mergeBest(out, newer.second, min);
  return out;
}

export function sameEntry(a: BestEntry, b: BestEntry): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Eine Faehigkeit in der Rotation nebeneinander: Beginn ihrer Einsaetze in ms, oben (a) und unten (b). */
export interface RotLane {
  name: string;
  sid: string;
  a: number[];
  b: number[];
}

/* Die Spuren beider Kaempfe, vereint ueber die Skill-Kennung (ein englischer
   und ein deutscher Client schreiben verschiedene Namen fuer dieselbe
   Faehigkeit), ohne Kennung ueber den Namen. Reihenfolge des Bezugs zuerst -
   partyEinsaetze() liefert sie nach Schaden -, dann was nur der zweite hat. */
export function rotLanes(a: PartyCasts[], b: PartyCasts[], spanMs: number, max: number): RotLane[] {
  const lanes = new Map<string, RotLane>();
  const take = (list: PartyCasts[], side: "a" | "b") => {
    for(const l of list){
      const key = l.s || l.n;
      let lane = lanes.get(key);
      if(!lane){ lane = {name: l.n, sid: l.s, a: [], b: []}; lanes.set(key, lane); }
      for(const c of l.c) if(c[0] < spanMs) lane[side].push(c[0]);
    }
  };
  take(a, "a");
  take(b, "b");
  return [...lanes.values()]
    .filter(l => l.a.length > 0 || l.b.length > 0)
    .map(l => ({...l, a: l.a.sort((x, y) => x - y), b: l.b.sort((x, y) => x - y)}))
    .slice(0, max);
}

/** Die ersten n Einsaetze vor spanMs, der Zeit nach - die Liste unter der Rotation. */
export function castOrder(list: PartyCasts[], spanMs: number, n: number): { name: string; sid: string; t: number }[] {
  const alle: { name: string; sid: string; t: number }[] = [];
  for(const l of list) for(const c of l.c) if(c[0] < spanMs) alle.push({name: l.n, sid: l.s, t: c[0]});
  return alle.sort((x, y) => x.t - y.t).slice(0, n);
}

/* Tag und Uhrzeit eines Pulls. Die UTC-Felder, weil die App die Uhr des Logs
   so ablegt - wallTime() in 18-interface-basics.ts liest sie genauso. */
export function pullWhen(ms: number, lang: Lang): string {
  const d = new Date(ms), p = (n: number) => String(n).padStart(2, "0");
  const tag = p(d.getUTCDate()), monat = p(d.getUTCMonth() + 1);
  const zeit = p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
  return lang === "de" ? tag + "." + monat + ". " + zeit : tag + "/" + monat + " " + zeit;
}

/* Traegt eine Faehigkeit den Unterschied, oder verteilt er sich? Ab 40 %
   des ganzen Abstands (Summe der Betraege) gilt eine als Ursache. Eine
   Regel fuer beide Stellen: "Woher der Unterschied kommt" (28-compare.ts)
   und den Antwortsatz gegen den besten Pull (46-best-pull.ts, bestAntwort).
   Sagte der Satz "am meisten fehlt X", waehrend der Block darunter "verteilt
   sich" sagte, widersprachen sich zwei Zeilen uebereinander. */
export const URSACHE_AB = 0.4;
/** Anteil der groessten Aenderung am Ganzen, 0 ohne Aenderung. */
export function groessterAnteil(deltas: readonly { d: number }[]): number {
  let sum = 0, max = 0;
  for(const x of deltas){ const a = Math.abs(x.d); sum += a; if(a > max) max = a; }
  return sum ? max / sum : 0;
}
/** Verteilt sich der Unterschied, statt an einer Faehigkeit zu haengen? */
export function verteilt(deltas: readonly { d: number }[]): boolean {
  return groessterAnteil(deltas) < URSACHE_AB;
}

/* Die Zahlen eines Vergleichs zweier Laeufe - vorher in 28-compare.ts,
   jetzt hier, damit der Antwortsatz im Vergleich und das Urteil der Tafel
   (Instrumententafel 4) dieselben Abstaende nennen. key fasst eine
   Faehigkeit ueber Sprache und Rang zusammen (cmpKey im Vergleich);
   mehrere Eintraege unter einem Schluessel werden addiert. */
export interface LaufZahlen {
  dps: number; seconds: number; fought?: number;
  skills: { name: string; sid?: string; damage: number; hits: number; dps: number }[];
}
type Faehigkeit = LaufZahlen["skills"][number];
export interface Abstand { key: string; name: string; sid?: string | undefined; d: number }
export function vergleichZahlen(ref: LaufZahlen, cur: LaufZahlen, key: (s: Faehigkeit) => string, noClock = false):
    { gap: number; rel: number; relShown: number; tie: boolean; deltas: Abstand[] } {
  const wert = (s: Faehigkeit) => noClock ? s.damage : s.dps;
  const summe = (l: LaufZahlen, k: string) => l.skills.filter(s => key(s) === k).reduce((a, s) => a + wert(s), 0);
  const namen = new Map<string, Faehigkeit>();
  for(const l of [ref, cur]) for(const s of l.skills) if(!namen.has(key(s))) namen.set(key(s), s);
  const deltas = [...namen].map(([k, s]) => ({key: k, name: s.name, sid: s.sid, d: summe(cur, k) - summe(ref, k)}))
    .filter(x => x.d).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const gap = cur.dps - ref.dps;
  const rel = ref.dps ? 100 * gap / ref.dps : 0;
  const relShown = Math.round(Math.abs(rel));
  return {gap, rel, relShown, tie: relShown < 5, deltas};
}
/* Das Urteil der Tafel. skill ist der groesste DPS-Abstand in der Richtung
   des Ganzen - ihn nennt die Schlagzeile, mit derselben Zahl wie der
   Antwortsatz im Vergleich. erst ist der erste Beleg (Pruefung 29.09.,
   Luecke 2.18, Entwurf E:370): die Faehigkeit mit dem groessten Verlust je
   Treffer, in DPS; ohne solchen Verlust null (dann zeigt die Tafel skill). zweit ist der zweite Beleg
   (Neugestaltung 28.09., DECISION 2.19, Entwurf E:378-395): die Faehigkeit,
   deren Treffer je Minute am meisten kosten (oder bringen) - die Differenz
   der Raten mal ihrem Schaden je Treffer in diesem Lauf, also DPS. Das darf
   dieselbe Faehigkeit sein wie skill: dann nennt das Urteil beide Ursachen
   einer Faehigkeit. Es zaehlen nur Faehigkeiten mit Treffern in beiden
   Laeufen; bewegt keine die Rate in der Richtung des Ganzen, ist zweit null. */
export function urteilZahlen(ref: LaufZahlen, cur: LaufZahlen, key: (s: Faehigkeit) => string):
    { gap: number; verteilt: boolean; skill: Abstand | null; proTreffer: [number, number]; proMinute: [number, number];
      erst: { skill: Abstand; proTreffer: [number, number] } | null;
      zweit: { skill: Abstand; proMinute: [number, number] } | null } {
  const v = vergleichZahlen(ref, cur, key);
  const breit = verteilt(v.deltas);
  const skill = breit || !v.gap ? null
    : v.deltas.filter(z => v.gap < 0 ? z.d < 0 : z.d > 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0] || null;
  const von = (l: LaufZahlen, k: string | null) => l.skills.filter(s => k != null && key(s) === k)
    .reduce((a, s) => ({damage: a.damage + s.damage, hits: a.hits + s.hits}), {damage: 0, hits: 0});
  const minuten = (l: LaufZahlen) => Math.max(l.fought || l.seconds, 1) / 60;
  const proMinute = (k: string | null): [number, number] => [von(cur, k).hits / minuten(cur), von(ref, k).hits / minuten(ref)];
  const c = von(cur, skill && skill.key), r = von(ref, skill && skill.key);
  let zweit: { skill: Abstand; proMinute: [number, number] } | null = null;
  let erst: { skill: Abstand; proTreffer: [number, number] } | null = null;
  if(v.gap){
    let bestWirkung = 0, bestT = 0;
    /* ueber alle Faehigkeiten, auch die ohne DPS-Abstand (deltas laesst sie
       weg): dort hebt mehr Schaden je Treffer die fehlenden Treffer auf */
    const alle = new Map<string, Abstand>();
    for(const s of cur.skills){ const k = key(s); if(!alle.has(k)) alle.set(k, v.deltas.find(z => z.key === k) || {key: k, name: s.name, sid: s.sid, d: 0}); }
    for(const z of alle.values()){
      const cz = von(cur, z.key), rz = von(ref, z.key);
      if(!cz.hits || !rz.hits) continue;
      const pm = proMinute(z.key);
      const wirkung = (pm[0] - pm[1]) / 60 * (cz.damage / cz.hits);
      if((v.gap < 0 ? wirkung < bestWirkung : wirkung > bestWirkung)){ bestWirkung = wirkung; zweit = {skill: z, proMinute: pm}; }
      /* erster Beleg: Differenz Schaden je Treffer mal Treffer dieses Laufs
         durch seine gekaempfte Zeit - DPS, wie lossT im Entwurf (E:370) */
      const pt: [number, number] = [cz.damage / cz.hits, rz.damage / rz.hits];
      const wirkungT = (pt[0] - pt[1]) * cz.hits / (minuten(cur) * 60);
      if((v.gap < 0 ? wirkungT < bestT : wirkungT > bestT)){ bestT = wirkungT; erst = {skill: z, proTreffer: pt}; }
    }
  }
  return {gap: v.gap, verteilt: breit, skill,
    proTreffer: [c.hits ? c.damage / c.hits : 0, r.hits ? r.damage / r.hits : 0],
    proMinute: proMinute(skill && skill.key), erst, zweit};
}

/* ---------- Pruefungen fuer das, was aus einer Datei kommt ----------
   boro-best.json kann von Hand bearbeitet sein oder von einem aelteren oder
   neueren Bau stammen. Der Hauptprozess prueft nur Schluessel und Groesse;
   was die Seite liest, muss sie selbst pruefen. Eine Huelle, die stimmt,
   reicht nicht: "skills":[null] liess renderCompare bei jedem Zeichnen
   werfen, solange der Pull angehakt war - und Haken ueberleben das Laden. */

/** Dieselbe Regel wie KEY_RX in src/main/best.ts - beide gleich halten. */
export const BEST_KEY_RX = /^(boss|dummy):[^\u0000-\u001f]{1,120}$/;

const zahl = (v: unknown) => Number.isFinite(v);
/* null auch: ein NaN (0-s-Kampf) wird in JSON zu null, und ein gespeicherter
   Lauf, der so in der Konfiguration steht, soll nicht beim naechsten Start
   verschwinden. Der Vergleich rechnet mit null als 0 und wirft nicht. */
const zahlOder = (v: unknown) => v == null || Number.isFinite(v);
const textOder = (v: unknown) => v === undefined || typeof v === "string";

/** Die Teile eines Laufs, die der Vergleich Element fuer Element liest. */
// any: die Pruefung entscheidet erst, ob der Wert die Form hat
export function runPartsOk(r: any): boolean {
  return !!r && typeof r === "object" &&
    Array.isArray(r.skills) && r.skills.every((k: any) =>
      !!k && typeof k === "object" && typeof k.name === "string" && zahl(k.damage) &&
      ["dps", "hits", "crit", "heavy", "max", "casts"].every(f => zahlOder(k[f])) &&
      textOder(k.sid) && textOder(k.weapon)) &&
    Array.isArray(r.windows) && r.windows.every((w: any) =>
      !!w && typeof w === "object" && zahl(w.from) && zahl(w.to) && zahlOder(w.dps) && zahlOder(w.damage)) &&
    Array.isArray(r.perSecond) && r.perSecond.every(zahl);
}

/** Einsaetze je Faehigkeit: [Beginn, Ende, Schaden, Treffer, Krits], alles Zahlen. */
export function castsOk(c: unknown): boolean {
  return c === undefined || (Array.isArray(c) && c.every((l: any) =>
    !!l && typeof l === "object" && typeof l.n === "string" && typeof l.s === "string" &&
    Array.isArray(l.c) && l.c.every((x: any) => Array.isArray(x) && x.length === 5 && x.every(zahl))));
}

/** Ein Eintrag der Datei. isRun ist looksLikeRun der Seite (34-menus-drop-and-tabs.ts),
    die ihrerseits runPartsOk fragt; hier noch einmal, damit der Test ohne Seite traegt. */
export function looksLikeBestEntry(e: any, isRun: (r: unknown) => boolean): e is BestEntry {
  const pull = (p: any): p is BestPull => !!p && typeof p === "object" && zahl(p.at) &&
    typeof p.file === "string" && typeof p.ver === "string" &&
    isRun(p.run) && runPartsOk(p.run) && castsOk(p.run.casts);
  return !!e && typeof e === "object" && pull(e.best) && (e.second === undefined || pull(e.second));
}
