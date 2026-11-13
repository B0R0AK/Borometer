// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Die Auswertung eines Bereichs der neuen Analyse (#414, Spezifikation
 * 2026-11-08-analyse-neu-zeitleiste-design.md 2.3, 5 und 8): Zahlen eines
 * Bereichs oder des ganzen Kampfs (`bereich`), daraus drei Listen
 * (`saetze`: was hier ablief, gut hier, besser moeglich) und die Marken ueber
 * der Kurve (`ereignisse`). Reiner Kern; Saetze sind Woerterbuch-Schluessel
 * mit Zahlen. Jeder Satz ist eine Regel ueber gemessene Zahlen, nie ein
 * "Warum": Buffs, Abklingzeiten und ob ein Ziel zu treffen war, weiss das Log
 * nicht.
 */

import { staerksteStrecke, type Luecken } from "./analyse-core";
import { hatVentius, imBereich, lueckenVon, summe, type Kampfdaten, type Satz } from "./kampfdaten-core";
import { skillsVon } from "./pruefstand-core";
import { ventiusAuswertung, type VentiusErgebnis } from "./ventius-core";

/** Leerlauf in einem Bereich: die Sekunden der Luecken, die hineinfallen. */
export function leerlaufIn(lk: Pick<Luecken, "luecken">, a: number, b: number): number {
  let s = 0;
  for (const [p, q] of lk.luecken) s += Math.max(0, Math.min(q, b) - Math.max(p, a));
  return s;
}

/** Die staerksten `fenster` Sekunden als [von, bis). */
export function staerkste(sekunden: readonly number[], fenster = 5): [number, number] {
  const s = staerksteStrecke(sekunden, fenster);
  return s ? [s.von, s.bis] : [0, Math.min(sekunden.length, fenster)];
}

/** Das 10-s-Fenster, in dem der beste Pull am weitesten voraus lag (wo der Abstand aufging). */
export function abstandFenster(k: Kampfdaten, best: Kampfdaten | null, fenster = 10): { von: number; bis: number; mehr: number } | null {
  if (!best) return null;
  const n = Math.min(k.schadenJeSekunde.length, best.schadenJeSekunde.length, Math.ceil(k.dauerS), Math.ceil(best.dauerS));
  let top = 0, at = -1;
  for (let i = 0; i + fenster <= n; i++) {
    const d = summe(best.schadenJeSekunde, i, i + fenster) - summe(k.schadenJeSekunde, i, i + fenster);
    if (d > top) { top = d; at = i; }
  }
  return at < 0 ? null : { von: at, bis: at + fenster, mehr: top };
}

/**
 * Zielwechsel: nur ein Wechsel auf einen anderen Namen zaehlt. Das Log kennt
 * nur den Namen des Ziels; zwei Gegner gleichen Namens sind ein Ziel.
 */
export function zielwechsel(k: Kampfdaten): [number, string][] {
  const out: [number, string][] = [];
  for (const z of k.zielwechsel || []) if (!out.length || out[out.length - 1]![1] !== z[1]) out.push(z);
  return out;
}

/* Schwellen fuer "Gut hier": ab wann eine Zahl nach oben auffaellt. Eine
   Beobachtung mit Zahl, kein Urteil und keine Farbe. Geprueft an den acht
   Beispielkaempfen (scripts/test-bereich-core.mjs). */
export const GUT = {
  RATE_UEBER: 1.1,           // Bereich: Schaden je Sekunde ab 10 % ueber dem ganzen Kampf
  BEST_UEBER: 1.05,          // ueber dem besten Pull ab 5 % mehr je Sekunde (dieselben Sekunden)
  BEST_NAH: 0.95,            // auf Hoehe des besten Pulls ab 95 % seiner Rate
  LEER_ANTEIL: 0.03,         // wenig Leerlauf: hoechstens 3 % der Zeit in Luecken ab 2 s
  LEER_MIN_DAUER_S: 10,      // unter 10 s sagt ein Bereich ueber Leerlauf nichts
  VENT_DECKE: 0.75,          // Ventius: ab drei Vierteln der lesbaren Salven an der Decke (nur mit Ventius)
  VENT_MIN_SALVEN: 3,        //   und erst ab drei lesbaren Salven
  KRIT_PUNKTE_BEREICH: 0.05, // Bereich: Kritquote ab 5 Punkten ueber dem ganzen Kampf
  KRIT_PUNKTE_BEST: 0.03,    // ganzer Kampf: Kritquote ab 3 Punkten ueber dem besten Pull
  ABSCHNITT_S: 30,           // "gleichmaessig" wird in vollen 30-s-Abschnitten gemessen
  ABSCHNITTE_MIN: 3,         //   ab drei vollen Abschnitten
  TAKT_GLEICH: 0.75,         // gleichmaessiger Takt: der schwaechste Abschnitt hat mind. 75 % der Einsaetze je Minute des staerksten
  KRIT_SPANNE: 0.08,         // stabile Kritquote: hoechstens 8 Punkte zwischen den Abschnitten (Entscheidung 08.11.2026; Entwurf: 12)
  KRIT_MIN_TREFFER: 15,      //   je Abschnitt ab 15 Treffern (sonst ist die Quote Zufall)
  TAKT_UEBER: 1.1,           // Bereich: gedrueckte Einsaetze je Minute ab 10 % ueber dem Kampf
  TAKT_WIE: 0.9,             // Bereich: "Takt gehalten" ab 90 % der Einsaetze je Minute des Kampfs
  TAKT_MIN_DAUER_S: 20,      //   und erst ab 20 s Bereich
  ZIELE_KAMPF_MIN: 3,        // "kein Zielwechsel im Bereich" nur, wo der Kampf mindestens drei hat (sonst sagt es nichts)
  HOECHSTENS: 5,             // so viele Gut-Saetze stehen hoechstens da, in der Reihenfolge der Regeln
} as const;

export interface Abschnitt { von: number; bis: number; jeMinute: number; treffer: number; krit: number | null }
export interface BereichErgebnis {
  a: number; b: number; T: number; ganz: boolean; dauer: number;
  schaden: number; dps: number; dpsKampf: number;
  spitze: { von: number; bis: number; dps: number };
  abschnitte: Abschnitt[];
  kritBest: number | null;
  bestVorne: { bis: number; hier: number; dort: number } | null;
  zieleKampf: number;
  istBester: boolean;
  anteil: number; anteilZeit: number;
  leerlauf: number; luecken: [number, number][]; median: number;
  einsaetze: number; jeMinute: number; jeMinuteKampf: number;
  krit: number | null; kritKampf: number | null;
  mischung: { name: string; dmg: number; tick: boolean; anteil: number }[];
  bereit: { name: string; ist: number; erwartet: number }[];
  ventius: VentiusErgebnis | null;
  /** dieselbe Rechnung auf den Salven des besten Pulls (#414), gegen dieselbe Decke und im selben Bereich; null, wo er keine kennt */
  ventiusBest: VentiusErgebnis | null;
  ziele: [number, string][];
  bestDps: number | null; bestSchaden: number | null; bestLiefKuerzer: boolean; bestDpsKampf: number | null; bestDauer: number | null;
}

export function bereich(k: Kampfdaten, best: Kampfdaten | null, deckeGegner: number, a: number, b: number): BereichErgebnis {
  const T = k.dauerS;
  a = Math.max(0, a); b = Math.min(T, b);
  const sekunden = k.schadenJeSekunde, lk = lueckenVon(k);
  const dauer = Math.max(0.001, b - a);
  const schaden = summe(sekunden, a, b);
  const skills = skillsVon(k);
  const gedrueckt = skills.filter((s) => !s.tick);
  const einsaetzeIm = (s: { einsaetze: { t: number; dmg: number }[] }) => s.einsaetze.filter((e) => imBereich(e, a, b));
  const nEins = gedrueckt.reduce((x, s) => x + einsaetzeIm(s).length, 0);
  const nEinsKampf = gedrueckt.reduce((x, s) => x + s.einsaetze.length, 0);
  let tr = 0, kr = 0, trK = 0, krK = 0;
  for (const s of gedrueckt) for (const e of s.einsaetze) { trK += e.n; krK += e.krit; if (imBereich(e, a, b)) { tr += e.n; kr += e.krit; } }
  const mischung = skills.map((s) => ({ name: s.name, dmg: einsaetzeIm(s).reduce((x, e) => x + e.dmg, 0), tick: s.tick }))
    .filter((s) => s.dmg > 0).sort((p, q) => q.dmg - p.dmg).map((s) => ({ ...s, anteil: schaden ? s.dmg / schaden : 0 }));
  const leer = leerlaufIn(lk, a, b);
  const lueckenIm = lk.luecken.filter(([p, q]) => q > a && p < b).map(([p, q]): [number, number] => [Math.max(p, a), Math.min(q, b)]);
  let bestDps: number | null = null, bestSchaden: number | null = null;
  if (best && best.dauerS >= b) { bestSchaden = summe(best.schadenJeSekunde, a, b); bestDps = bestSchaden / dauer; }
  const bestLiefKuerzer = !!best && best.dauerS < b;
  // Faehigkeiten, die im Bereich seltener kamen als im eigenen Takt des Kampfs: eine Beobachtung gegen sich selbst
  const bereit: BereichErgebnis["bereit"] = [];
  if (!(a <= 0 && b >= T)) for (const s of gedrueckt) {
    const im = einsaetzeIm(s);
    const erwartet = s.einsaetze.length / T * dauer;
    if (erwartet >= 3 && im.length < 0.6 * erwartet) bereit.push({ name: s.name, ist: im.length, erwartet: Math.round(erwartet) });
  }
  bereit.sort((p, q) => (q.erwartet - q.ist) - (p.erwartet - p.ist));
  const ventius = ventiusAuswertung(k, deckeGegner, a, b);
  const ventiusBest = ventius && best && hatVentius(best) && best.dauerS >= b ? ventiusAuswertung(best, ventius.decke, a, b) : null;
  const alleZiele = zielwechsel(k);
  const ziele = alleZiele.slice(1).filter(([t]) => t >= a && t < b);
  const sp = staerkste(sekunden, 5);
  const spitze = { von: sp[0], bis: sp[1], dps: summe(sekunden, sp[0], sp[1]) / Math.max(1, sp[1] - sp[0]) };
  const abschnitte: Abschnitt[] = [];
  for (let p = a; p + GUT.ABSCHNITT_S <= b + 1e-9; p += GUT.ABSCHNITT_S) {
    let e = 0, h = 0, kk = 0;
    for (const s of gedrueckt) for (const x of s.einsaetze) if (x.t >= p && x.t < p + GUT.ABSCHNITT_S) { e++; h += x.n; kk += x.krit; }
    abschnitte.push({ von: p, bis: p + GUT.ABSCHNITT_S, jeMinute: e / GUT.ABSCHNITT_S * 60, treffer: h, krit: h ? kk / h : null });
  }
  let kritBest: number | null = null;
  if (best) {
    let h = 0, kk = 0;
    for (const s of skillsVon(best)) if (!s.tick) for (const x of s.einsaetze) { h += x.n; kk += x.krit; }
    kritBest = h ? kk / h : null;
  }
  const ganz = a <= 0 && b >= T;
  let bestVorne: BereichErgebnis["bestVorne"] = null;
  if (ganz && best && best.dauerS < T) { const n = Math.floor(best.dauerS); bestVorne = { bis: n, hier: summe(sekunden, 0, n), dort: summe(best.schadenJeSekunde, 0, n) }; }
  return {
    a, b, T, ganz, dauer, schaden, dps: schaden / dauer, dpsKampf: k.schaden / T,
    spitze, abschnitte, kritBest, bestVorne, zieleKampf: Math.max(0, alleZiele.length - 1), istBester: !!best && k.dps > best.dps,
    anteil: k.schaden ? schaden / k.schaden : 0, anteilZeit: dauer / T,
    leerlauf: leer, luecken: lueckenIm, median: lk.median,
    einsaetze: nEins, jeMinute: nEins / dauer * 60, jeMinuteKampf: nEinsKampf / T * 60,
    krit: tr ? kr / tr : null, kritKampf: trK ? krK / trK : null,
    mischung, bereit, ventius, ventiusBest, ziele,
    bestDps, bestSchaden, bestLiefKuerzer, bestDpsKampf: best ? best.dps : null, bestDauer: best ? best.dauerS : null,
  };
}

/* ---------- Saetze, regelbasiert ---------- */

export interface Beobachtung { k: string; satz: Satz; neutral?: boolean }
export interface Saetze { kopf: Satz; gut: Beobachtung[]; besser: Beobachtung[] }

const bs = (k: string, key: string, vars: Record<string, unknown> = {}, neutral = false): Beobachtung =>
  ({ k, satz: { key: "analysis.e.bs." + key, vars }, ...(neutral ? { neutral } : {}) });

/** Der Satz zum Bereich, "Gut hier" und "Besser moeglich" als Beobachtungen; nie ein Warum. */
export function saetze(e: BereichErgebnis): Saetze {
  const gut: Beobachtung[] = [], besser: Beobachtung[] = [];
  const rel = e.dpsKampf ? e.dps / e.dpsKampf : 1;
  const top = e.mischung[0];
  // ist dieser Kampf selbst der beste, ist der Spiegel der naechstbeste
  const nb = e.istBester;
  const kopf: Satz = { key: "analysis.e.bs.kopf", vars: { ganz: e.ganz, a: e.a, b: e.b, dauer: e.dauer, dps: e.dps, rel, top: top ? { name: top.name, anteil: top.anteil } : null } };
  // 1. Rate im Bereich gegen den Kampf
  if (!e.ganz && rel >= GUT.RATE_UEBER) gut.push(bs("dps", "dps.gut", { rel, dps: e.dps, dpsKampf: e.dpsKampf }));
  if (!e.ganz && rel < 0.9) besser.push(bs("dps", "dps.besser", { rel, dps: e.dps, dpsKampf: e.dpsKampf }));
  // 2. der beste Pull: ganzer Kampf als bester, dieselben Sekunden, oder die Zeit, die der kuerzere beste Pull lief
  if (e.ganz && e.istBester && e.bestDpsKampf) gut.push(bs("best", "best.bester", { dpsKampf: e.dpsKampf, bestDps: e.bestDpsKampf, dauer: e.bestDauer || 0 }));
  else if (e.bestDps != null) {
    const r = e.bestDps ? e.dps / e.bestDps : 1;
    if (r >= GUT.BEST_UEBER) gut.push(bs("best", "best.ueber", { r, bestDps: e.bestDps, nb }));
    else if (r < GUT.BEST_NAH) besser.push(bs("best", "best.unter", { r, bestDps: e.bestDps, nb }));
    else gut.push(bs("best", "best.hoehe", { bestDps: e.bestDps, nb }));
  } else if (e.bestVorne && e.bestVorne.dort > 0) {
    const r = e.bestVorne.hier / e.bestVorne.dort;
    const v = { r, bis: e.bestVorne.bis, hier: e.bestVorne.hier, dort: e.bestVorne.dort, nb };
    if (r >= GUT.BEST_UEBER) gut.push(bs("best", "best.vorneUeber", v));
    else if (r >= GUT.BEST_NAH) gut.push(bs("best", "best.vorneGleich", v));
    else besser.push(bs("best", "best.vorneUnter", v));
  } else if (e.bestLiefKuerzer) besser.push(bs("best", "best.vorbei", { dauer: e.bestDauer || 0, nb }));
  // 3. Leerlauf: wenig ist eine Beobachtung nach oben, viel eine nach unten - nie beides
  const leerAnteil = e.leerlauf / Math.max(0.001, e.dauer);
  if (e.leerlauf >= 2 && leerAnteil > GUT.LEER_ANTEIL) besser.push(bs("leer", "leer.viel", { sek: Math.round(e.leerlauf), n: e.luecken.length }));
  else if (e.leerlauf >= 2) gut.push(bs("leer", "leer.wenig", { sek: Math.round(e.leerlauf), n: e.luecken.length, anteil: leerAnteil }));
  else if (e.dauer >= GUT.LEER_MIN_DAUER_S) gut.push(bs("leer", "leer.kein", { ganz: e.ganz }));
  // 4. Ventius, nur wenn es Salven gibt
  const v = e.ventius;
  if (v && v.gesamt) {
    if (v.lesbar && v.unter === 0) gut.push(bs("vent", "vent.alle", { lesbar: v.lesbar, decke: v.decke, soll: v.soll }));
    else if (v.lesbar >= GUT.VENT_MIN_SALVEN && v.anDecke / v.lesbar >= GUT.VENT_DECKE) gut.push(bs("vent", "vent.quote", { anDecke: v.anDecke, lesbar: v.lesbar, soll: v.soll }));
    // der Vergleich mit den Salven des besten Pulls (#414): nur, wo beide Seiten mindestens drei lesbare Salven haben
    const vb = e.ventiusBest;
    if (vb && v.lesbar >= GUT.VENT_MIN_SALVEN && vb.lesbar >= GUT.VENT_MIN_SALVEN) {
      const hier = v.anDecke / v.lesbar, dort = vb.anDecke / vb.lesbar;
      const o = bs("vent", hier >= dort ? "vent.vsGut" : "vent.vsBesser", { anHier: v.anDecke, lesbarHier: v.lesbar, anDort: vb.anDecke, lesbarDort: vb.lesbar, nb });
      if (hier >= dort) gut.push(o); else besser.push(o);
    }
    if (v.unter) besser.push(bs("vent", "vent.unter", { unter: v.unter, gefehlt: v.gefehlt, verlust: v.verlust }));
    if (v.unlesbar) besser.push(bs("ventu", "vent.unlesbar", { n: v.unlesbar, gruende: v.gruende }));
  }
  // 5. Kritquote: im Bereich gegen den Kampf, im ganzen Kampf gegen den besten Pull oder gleichmaessig.
  //    "Gleichmaessig" steht hoechstens einmal je Liste (Krit vor Takt).
  let gleichmaessig = false;
  const volle = e.abschnitte.filter((x) => x.treffer >= GUT.KRIT_MIN_TREFFER);
  if (e.krit != null && e.kritKampf != null && !e.ganz) {
    const d = e.krit - e.kritKampf;
    if (d >= GUT.KRIT_PUNKTE_BEREICH) gut.push(bs("krit", "krit.ueber", { krit: e.krit, punkte: Math.round(d * 100) }));
    if (d <= -0.08) besser.push(bs("krit", "krit.unter", { krit: e.krit, punkte: Math.round(-d * 100) }));
  } else if (e.ganz && e.krit != null && e.kritBest != null && e.krit - e.kritBest >= GUT.KRIT_PUNKTE_BEST) {
    gut.push(bs("krit", "krit.ueberBest", { krit: e.krit, punkte: Math.round((e.krit - e.kritBest) * 100), kritBest: e.kritBest, nb }));
  } else if (e.ganz && volle.length >= GUT.ABSCHNITTE_MIN) {
    const q = volle.map((x) => x.krit as number), lo = Math.min(...q), hi = Math.max(...q);
    if (hi - lo <= GUT.KRIT_SPANNE) { gut.push(bs("krit", "krit.gleich", { lo, hi, abschnitt: GUT.ABSCHNITT_S })); gleichmaessig = true; }
  }
  // 6. Takt: im Bereich gegen den Kampf; im ganzen Kampf gleichmaessig ueber die Abschnitte
  if (e.einsaetze && e.jeMinuteKampf) {
    const r = e.jeMinute / e.jeMinuteKampf;
    const t = { jeMinute: e.jeMinute, jeMinuteKampf: e.jeMinuteKampf };
    if (!e.ganz && r >= GUT.TAKT_UEBER) gut.push(bs("takt", "takt.ueber", t));
    else if (!e.ganz && r >= GUT.TAKT_WIE && e.dauer >= GUT.TAKT_MIN_DAUER_S) gut.push(bs("takt", "takt.gehalten", t));
    if (!e.ganz && r < 0.85) besser.push(bs("takt", "takt.unter", t));
  }
  if (e.ganz && !gleichmaessig && e.abschnitte.length >= GUT.ABSCHNITTE_MIN) {
    const q = e.abschnitte.map((x) => x.jeMinute), lo = Math.min(...q), hi = Math.max(...q);
    if (hi > 0 && lo / hi >= GUT.TAKT_GLEICH) gut.push(bs("takt", "takt.gleich", { lo, hi, abschnitt: GUT.ABSCHNITT_S }));
  }
  // 7. Zielwechsel: im Bereich keiner, wo der Kampf welche hat
  if (e.ziele.length) besser.push(bs("ziel", "ziel.wechsel", { n: e.ziele.length, liste: e.ziele.slice(0, 3).map(([t, z]) => ({ t, ziel: z })), mehr: e.ziele.length > 3 }));
  else if (!e.ganz && e.zieleKampf >= GUT.ZIELE_KAMPF_MIN && e.dauer >= GUT.TAKT_MIN_DAUER_S) gut.push(bs("ziel", "ziel.keiner", { kampf: e.zieleKampf }));
  // 8. die staerksten 5 s
  if (e.spitze.bis > e.spitze.von && e.dpsKampf) {
    const s = { von: e.spitze.von, bis: e.spitze.bis, dps: e.spitze.dps, faktor: e.spitze.dps / e.dpsKampf };
    if (e.ganz) gut.push(bs("spitze", "spitze.ganz", s));
    else if (e.spitze.von >= e.a && e.spitze.bis <= e.b) gut.push(bs("spitze", "spitze.hier", s));
  }
  for (const r of e.bereit.slice(0, 2)) besser.push(bs("bereit", "bereit", { name: r.name, ist: r.ist, erwartet: r.erwartet, dauer: e.dauer }));
  gut.splice(GUT.HOECHSTENS);
  besser.splice(GUT.HOECHSTENS);
  // nichts nach oben: ein neutraler Satz statt "nichts" (eine Luecke der Regeln ist kein Urteil)
  if (!gut.length) {
    const unten = besser.some((x) => x.k === "dps" || x.k === "takt");
    gut.push(bs("ruhig", e.ganz ? "ruhig.ganz" : unten ? "ruhig.unten" : "ruhig.rest", {}, true));
  }
  return { kopf, gut, besser };
}

/* ---------- Marken ueber der Kurve: allgemein, Ventius nur bei Ventius ---------- */

export type MarkenArt = "spitze" | "luecke" | "einsatz" | "ziel" | "unter" | "unlesbar";
export interface Marke { k: MarkenArt; von: number; bis: number; satz: Satz }

export function ereignisse(k: Kampfdaten, deckeGegner: number): Marke[] {
  const lk = lueckenVon(k), st = staerkste(k.schadenJeSekunde);
  const m = (art: MarkenArt, von: number, bis: number, key: string, vars: Record<string, unknown>): Marke => ({ k: art, von, bis, satz: { key: "analysis.e.marke." + key, vars } });
  const out: Marke[] = [m("spitze", st[0], st[1], "spitze", { dps: summe(k.schadenJeSekunde, st[0], st[1]) / 5 })];
  for (const [p, q] of lk.luecken) out.push(m("luecke", p, q, "luecke", { von: p, bis: q, dauer: q - p }));
  // der staerkste gedrueckte Einsatz des Kampfs
  let top: { t: number; dmg: number; name: string } | null = null;
  for (const s of skillsVon(k)) if (!s.tick) for (const e of s.einsaetze) if (!top || e.dmg > top.dmg) top = { t: e.t, dmg: e.dmg, name: s.name };
  if (top) out.push(m("einsatz", top.t, top.t + 1, "einsatz", { name: top.name, dmg: top.dmg, t: top.t }));
  for (const [t, ziel] of zielwechsel(k).slice(1)) out.push(m("ziel", t, t + 1, "ziel", { t, ziel }));
  const v = ventiusAuswertung(k, deckeGegner);
  if (v) for (const s of v.salven) {
    if (s.status === "unlesbar") out.push(m("unlesbar", s.t, s.t + 1.5, "salveUnlesbar", { t: s.t, grund: s.grund }));
    else if (s.status === "unter") out.push(m("unter", s.t, s.t + 1.5, "salveUnter", { t: s.t, n: s.n, soll: s.soll, nurOeffner: s.nurOeffner }));
  }
  return out.sort((p, q) => p.von - q.von);
}

