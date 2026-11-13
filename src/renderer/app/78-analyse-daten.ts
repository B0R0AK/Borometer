// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Der Adapter der neuen Analyse (#414, Spezifikation
 * 2026-11-08-analyse-neu-zeitleiste-design.md 4): baut aus einem Kampf, aus
 * dem besten Pull (dem "Geist" der Analyse) und aus der gelernten Decke das
 * schmale Datenformat der Rechenkerne (kampfdaten-core.ts). Damit bleibt der
 * State aus den Kernen draussen. Rechnet nichts, was eine Regel der Seite ist:
 * Einsaetze sind 400 ms je Faehigkeits-ID (wie casts()), die Salven kommen
 * aus ventiusSalven() in 15, die Form 1 + 3N liest ventius-core.
 *
 * Namen der Faehigkeiten gehen als englischer Schluessel (skillKey) in die
 * Kerne, damit beide Client-Sprachen derselbe Name sind; angezeigt wird
 * mit analyseName().
 */

import type { Fight } from "../types";
import { FORMATE_DE, FORMATE_EN, type Formate } from "../analyse-woerter";
import type { EinsatzZeile, Kampfdaten, SalveZeile, Satz } from "../kampfdaten-core";
import { ventiusForm } from "../ventius-core";
import { state } from "./01-state";
import { t } from "./08-translation";
import { skillKey } from "./10-skill-names";
import { skillLabel } from "./14-questlog-weapons";
import { VENTIUS_NAME, unverwundbarOf, ventiusDecke, ventiusSalven } from "./15-weapons-and-ventius";
import { perSecond, unverwundbareSekunden } from "./16-fight-analysis";
import { mechanikSekunden, mechanikStand, mechanikStempel } from "./61-mechanik";
import type { BestGeist } from "./26-analysis-tab";

/** Treffer einer Faehigkeit gehoeren zu einem Einsatz, wenn sie hoechstens so viele ms auseinander liegen (wie casts()). */
const EINSATZ_MS = 400;
/** Ein Zielwechsel haelt sich mindestens so lange (ms), sonst war es ein Streifschuss. */
const ZIEL_HALT_MS = 2000;

const runden1 = (x: number) => Math.round(x * 10) / 10;

/** Der Name, den die Kerne fuer eine Faehigkeit sehen: englisch, in beiden Client-Sprachen gleich. */
export const kernName = (name: string, sid?: string | null): string => skillKey(name, sid);
/** Der Name fuer die Anzeige in der Sprache der Seite; "Eye of Ventius" findet seinen Namen ueber die Tabelle. */
export const analyseName = (name: string, sid?: string | null): string => skillLabel(name, sid || null);

function einsaetzeVon(seg: Fight): EinsatzZeile[] {
  const je = new Map<string, { t: number; last: number; sid: string; name: string; dmg: number; n: number; krit: number; stark: number }[]>();
  for(const e of seg.events){
    if(e.skill === VENTIUS_NAME || e.dmg <= 0) continue;
    const schluessel = e.sid || e.skill;
    let l = je.get(schluessel);
    if(!l){ l = []; je.set(schluessel, l); }
    const letzter = l[l.length - 1];
    if(letzter && e.t - letzter.last <= EINSATZ_MS){
      letzter.last = e.t; letzter.dmg += e.dmg; letzter.n++; letzter.krit += e.crit ? 1 : 0; letzter.stark += e.heavy ? 1 : 0;
    } else l.push({t: e.t, last: e.t, sid: e.sid, name: kernName(e.skill, e.sid), dmg: e.dmg, n: 1, krit: e.crit ? 1 : 0, stark: e.heavy ? 1 : 0});
  }
  return [...je.values()].flat().sort((a, b) => a.t - b.t)
    .map(c => [runden1((c.t - seg.start) / 1000), c.sid, c.name, c.dmg, c.n, c.krit, c.stark] as EinsatzZeile);
}

/** Das Ziel der Treffer wechselt und haelt mindestens 2 s: [t, Ziel]; der erste Eintrag ist das Startziel. */
function zielwechselVon(seg: Fight): [number, string][] {
  const out: [number, string][] = [];
  let akt: string | null = null, seit = 0;
  for(const e of seg.events){
    if(e.dmg <= 0) continue;
    if(e.target !== akt){
      if(akt !== null && out.length && e.t - seit < ZIEL_HALT_MS) out.pop();
      akt = e.target; seit = e.t;
      out.push([runden1((e.t - seg.start) / 1000), e.target]);
    }
  }
  return out;
}

/** Ein Kampf in Kampfdaten. Ventius nur, wo der Kampf Salven hat. */
export function kampfdatenVon(seg: Fight): Kampfdaten {
  const ps = perSecond(seg, 0), sek = ps.total;
  // Sekunden, die nicht zaehlen (Ziel unverwundbar, erkannte Mechanik): wie lueckenStand (26) sie ausnimmt
  const mech = mechanikSekunden(seg, ps.T);
  const aus = unverwundbareSekunden(seg, ps.T).map((x, i) => x || mech[i]!);
  const salven = ventiusSalven(seg);
  return {
    hauptziel: seg.stats.name, dauerS: seg.stats.seconds, schaden: seg.stats.total, dps: seg.stats.dps,
    schadenJeSekunde: sek, einsaetze: einsaetzeVon(seg), zielwechsel: zielwechselVon(seg),
    ventius: salven.length ? {salven: salven.map((s): SalveZeile =>
      [runden1((s.t - seg.start) / 1000), ventiusForm(s.wellen), s.hits, s.dmg, s.crit, s.heavy, s.wellen])} : null,
    fehlschlaege: seg.missed || 0,
    waffen: [],
    ...(aus.some(Boolean) ? {nichtGezaehlt: aus} : {}),
  };
}

/**
 * Der beste Pull als Kampfdaten, aus dem Geist der Analyse (bestCasts): seine
 * Einsaetze (ohne starke Treffer, die der Speicher nicht kennt), seine Kurve
 * und seine Rate. Ventius bleibt null, bis der Speicher die Salven kennt.
 */
export function bestDatenVon(g: BestGeist, hauptziel: string): Kampfdaten {
  const einsaetze: EinsatzZeile[] = [];
  for(const [name, liste] of g.casts) for(const c of liste) einsaetze.push([runden1(c.t / 1000), "", kernName(name, null), c.dmg, c.hits, c.crit, 0]);
  einsaetze.sort((a, b) => a[0] - b[0]);
  const schaden = g.sek.reduce((x, y) => x + y, 0);
  return {
    hauptziel, dauerS: g.sek.length, schaden, dps: g.wert, schadenJeSekunde: g.sek.slice(), einsaetze,
    zielwechsel: [[0, hauptziel]],
    /* Die Salven des Pulls: der Speicher haelt Beginn, Nachbeben und Treffer (#414); Schaden, Krit und die Wellen
       kennt er nicht und braucht der Vergleich nicht. Ein aelterer Pull hat sie nicht: null. */
    ventius: g.ventius ? {salven: g.ventius.map(([t, nb, n]): SalveZeile => [runden1(t / 1000), nb, n, 0, 0, 0, []])} : null,
  };
}

/** Die gelernte Decke des Gegners, 0 wo sie nicht belegt ist. */
export const deckeDesGegners = (hauptziel: string): number => ventiusDecke(hauptziel);

/* ---------- was die Teile 79 und 80 gemeinsam brauchen ---------- */

/** Zahlen im Format der gewaehlten Sprache (Komma oder Punkt, geschuetztes Leerzeichen vor %, s). */
export const fm = (): Formate => (state.lang === "de" ? FORMATE_DE : FORMATE_EN);

/**
 * Ein Satz, den die Seite zur Analyse beisteuert (#414, B2): was an Regeln der Seite haengt (das Fenster nach einem Skill, die schwaechste
 * Stelle, der Start, die Haelften ohne unverwundbare Sekunden) und nicht in die Kerne gehoert. Fertiger Text in der Sprache der Seite;
 * von/bis in Sekunden, wo der Satz eine Strecke hat; rot nennt den Namen des Wegs in die Rotation (Schluessel des Vorlesenamens).
 */
export interface SeitenSatz {
  k: "stelle" | "strecke" | "abstand" | "start" | "unverwundbar" | "haelften" | "raten" | "treffer";
  von?: number;
  bis?: number;
  text: string;
  rot?: string;
}

export interface AnalyseDaten {
  k: Kampfdaten;
  best: Kampfdaten | null;
  /** der Bezug ist selbst der zweitbeste Pull (dieser Kampf ist der beste) */
  zweit: boolean;
  /** wie der Bezug fuer den Vorleser heisst, "vom 22.09." (leer ohne Bezug) */
  bestWann: string;
  decke: number;
  /** Strecken, in denen der Boss nichts nahm: Ziel unverwundbar und erkannte Mechanik (61), in Sekunden, auf den Kampf begrenzt */
  baender: { unv: { von: number; bis: number; len: number }[]; mech: { von: number; bis: number }[] };
}

/** Unverwundbar-Strecken und erkannte Mechanik dieses Kampfs; beides sind Regeln der Seite (15, 61), der Adapter reicht sie nur durch. */
function baenderVon(seg: Fight, dauerS: number): AnalyseDaten["baender"] {
  const unv = unverwundbarOf(seg).map(g => ({von: g.from, bis: Math.min(dauerS, g.to), len: g.len})).filter(g => g.bis > g.von);
  const mst = mechanikStand(seg);
  const mech = (mst ? mst.liste.flatMap(x => x.strecken) : []).map(g => ({von: g.von, bis: Math.min(dauerS, g.bis)})).filter(g => g.bis > g.von);
  return {unv, mech};
}

let merk: { stempel: string; d: AnalyseDaten } | null = null;
/**
 * Kampf, Bezug und Decke in der Form der Kerne. Gemerkt je Stand des Kampfs:
 * unter Live kommt dieselbe Rechnung alle zwei Sekunden, und nur ein
 * wachsender Kampf rechnet neu.
 */
export function analyseDaten(seg: Fight, geist: BestGeist | null): AnalyseDaten {
  // Strecken des unverwundbaren Ziels und der Mechanik gehoeren dazu: ein weiteres Log desselben Bosses aendert sie, ohne die Zahl der Ereignisse zu aendern
  const stempel = [seg.start, seg.events.length, unverwundbarOf(seg).map(u => u.from + "-" + u.to).join(","), mechanikStempel(seg), state.lang, geist ? geist.wert + ":" + geist.sek.length + ":" + geist.wann : "-"].join("|");
  if(merk && merk.stempel === stempel) return merk.d;
  const k = kampfdatenVon(seg);
  const best = geist ? bestDatenVon(geist, k.hauptziel) : null;
  const d = {k, best, zweit: !!geist && geist.zweit, bestWann: geist ? geist.wann : "", decke: deckeDesGegners(k.hauptziel), baender: baenderVon(seg, k.dauerS)};
  merk = {stempel, d};
  return d;
}

/**
 * Ein Satz eines Kerns als Text der Seite. Namen von Faehigkeiten gehen als
 * englischer Schluessel in die Kerne und kommen hier in die Sprache der
 * Seite; Namen von Gegnern bleiben, wie das Spiel sie schreibt.
 */
export function satzText(s: Satz): string {
  const v: Record<string, unknown> = {...s.vars};
  const namen = (x: unknown) => (typeof x === "string" ? analyseName(x) : x);
  for(const k of ["name", "skill"]) if(k in v) v[k] = namen(v[k]);
  if(v.top && typeof v.top === "object") v.top = {...(v.top as object), name: namen((v.top as {name: string}).name)};
  if(typeof v.namen === "string") v.namen = v.namen.split(", ").map(n => analyseName(n)).join(", ");
  if(s.key === "analysis.e.op.stelle"){ v.hier = namen(v.hier); v.dort = namen(v.dort); }
  return t(s.key, v);
}
