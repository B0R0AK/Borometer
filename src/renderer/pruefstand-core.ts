// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Der Pruefstand der neuen Analyse (#414, Spezifikation
 * 2026-11-08-analyse-neu-zeitleiste-design.md 2.4/2.5): eine Karte je
 * Faehigkeit mit Anteil, Einsaetzen, Schaden je Einsatz, Trefferart-Quote,
 * Treffern gegen das selbst erreichte Maximum, Takt-Schaetzung, Wartezeit und
 * Auslastung; dazu die Checkliste in Prozent und der Opener der ersten
 * Sekunden gegen den besten Pull. Reiner Kern, rechnet auf Kampfdaten.
 *
 * Das Log kennt keine Abklingzeit. Der Takt ist eine Schaetzung aus den
 * eigenen Abstaenden (20. Perzentil, aus diesem und dem besten Pull) und
 * heisst so. An der Ventius-Karte steht kein Takt (Empfehlung der Spezifikation, bis
 * etwas anderes entschieden wird): dort zaehlt der Abstand der Salven.
 */

import { hitze, median } from "./analyse-core";
import { hatVentius, imBereich, lueckenVon, perzentil, type Kampfdaten, type Satz } from "./kampfdaten-core";
import { VENTIUS, ventiusAuswertung } from "./ventius-core";

/** Faehigkeiten, die von selbst laufen (Ticks): sie zaehlen nicht als gedrueckter Einsatz. */
export const TICKS: ReadonlySet<string> = new Set(["Mother Nature's Protest", "Storm Current", "Thunder Spirit", "Deadly Viper",
  "Silver Reaper's Soul Harvest", "Roxie's Arrowhead", "Bloodleech Aura"]);

/** Hitzestufe eines Einsatzes (0 Asche, 1 stark, 2 kritisch, 3 beides) aus Zahlen statt Anteilen. */
export const hitzeVon = (krit: number, stark: number, n: number): 0 | 1 | 2 | 3 => (n ? hitze(krit / n, stark / n) : 0);

export interface Einsatz {
  t: number; sid: string; dmg: number; n: number; krit: number; stark: number;
  /** Teile eines Drucks mit mehreren IDs (Mal und Zuendung) */
  teile?: number;
  /** Kanal: Zeit des letzten Ticks des Schubs */
  last?: number;
  ticks?: number;
  /** Ventius: Nachbeben der Salve (-1 unlesbar) */
  nb?: number;
}
export interface SkillZeile {
  name: string;
  sids: string[];
  sid: string | null;
  einsaetze: Einsatz[];
  dmg: number;
  anteil: number;
  tick: boolean;
  kanal?: boolean;
  ventius?: boolean;
}

/* ---------- Einsaetze einer Faehigkeit ---------- */

/** Kanal: Ticks, die hoechstens 1,3 s auseinander liegen, sind ein Druck. */
export function kanalDruecke(einsaetze: readonly Einsatz[]): Einsatz[] {
  const out: Einsatz[] = [];
  for (const e of einsaetze) {
    const l = out[out.length - 1];
    if (l && e.t - l.last! <= 1.3) { l.last = e.t; l.dmg += e.dmg; l.n += e.n; l.krit += e.krit; l.stark += e.stark; l.ticks! += 1; }
    else out.push({ ...e, last: e.t, ticks: 1 });
  }
  return out;
}

/**
 * Ticks, die kein fester Name kennt: im Sekundentakt (Median der Abstaende
 * 0,85 bis 1,25 s, ab 8 Einsaetzen; Spiral Slash tickt mit 1,2 s). Eine
 * eigene Regel neben analyse-core.imTakt, das Abstaende der Rotation prueft.
 */
export function sekundenTakt(einsaetze: readonly Einsatz[]): boolean {
  if (einsaetze.length < 8) return false;
  const d: number[] = [];
  for (let i = 1; i < einsaetze.length; i++) d.push(einsaetze[i]!.t - einsaetze[i - 1]!.t);
  const m = median(d);
  return m >= 0.85 && m <= 1.25;
}

/** Die ID mit den meisten Einsaetzen: nach ihr sucht die Seite das Symbol. */
export function hauptSid(einsaetze: readonly { sid: string }[]): string | null {
  const z = new Map<string, number>();
  for (const e of einsaetze) z.set(e.sid, (z.get(e.sid) || 0) + 1);
  let best: string | null = null, n = 0;
  for (const [sid, c] of z) if (c > n) { best = sid; n = c; }
  return best;
}

/**
 * Mehrere IDs je Name zusammengelegt; Ventius aus den Salven als eigene
 * Faehigkeit (nur wenn es Salven gibt). Ticks und Kanaele werden erkannt.
 */
export function skillsVon(k: Kampfdaten): SkillZeile[] {
  interface Roh { name: string; sids: Set<string>; einsaetze: Einsatz[]; dmg: number; tick: boolean; kanal?: boolean; ventius?: boolean }
  const je = new Map<string, Roh>();
  for (const [t, sid, name, dmg, n, krit, stark] of k.einsaetze) {
    let s = je.get(name);
    if (!s) { s = { name, sids: new Set(), einsaetze: [], dmg: 0, tick: TICKS.has(name) }; je.set(name, s); }
    s.sids.add(sid); s.einsaetze.push({ t, sid, dmg, n, krit, stark }); s.dmg += dmg;
  }
  for (const s of je.values()) {
    s.einsaetze.sort((p, q) => p.t - q.t);
    // im Sekundentakt: laeuft es fast den ganzen Kampf (ab 0,6 Einsaetze je Sekunde), ist es ein Tick ohne Druck;
    // kommt es in Schueben, ist es ein Kanal (Javelin Inferno, Spiral Slash): die Ticks eines Schubs sind ein Druck
    if (!s.tick && sekundenTakt(s.einsaetze)) {
      if (s.einsaetze.length / Math.max(1, k.dauerS) >= 0.6) s.tick = true;
      else { s.kanal = true; s.einsaetze = kanalDruecke(s.einsaetze); continue; }
    }
    if (s.tick || s.sids.size < 2) continue;
    // ein Druck, mehrere IDs: Komponenten derselben Faehigkeit binnen 1,2 s werden ein Einsatz
    const out: Einsatz[] = [];
    for (const e of s.einsaetze) {
      const l = out[out.length - 1];
      if (l && e.sid !== l.sid && e.t - l.t <= 1.2) { l.dmg += e.dmg; l.n += e.n; l.krit += e.krit; l.stark += e.stark; l.teile = (l.teile || 1) + 1; }
      else out.push({ ...e });
    }
    s.einsaetze = out;
  }
  if (hatVentius(k)) {
    const v: Roh = { name: VENTIUS, sids: new Set(["boro:ventius"]), einsaetze: [], dmg: 0, tick: false, ventius: true };
    for (const [t, nb, n, dmg, krit, stark] of k.ventius!.salven) { v.einsaetze.push({ t, sid: "boro:ventius", dmg, n, krit, stark, nb }); v.dmg += dmg; }
    je.set(VENTIUS, v);
  }
  const gesamt = [...je.values()].reduce((x, s) => x + s.dmg, 0) || 1;
  return [...je.values()].map((s): SkillZeile => ({
    name: s.name, sids: [...s.sids], sid: hauptSid(s.einsaetze), anteil: s.dmg / gesamt, dmg: s.dmg, tick: s.tick,
    ...(s.kanal ? { kanal: true } : {}), ...(s.ventius ? { ventius: true } : {}),
    einsaetze: s.einsaetze.sort((p, q) => p.t - q.t),
  })).sort((p, q) => q.dmg - p.dmg);
}

/**
 * Takt-Schaetzung: der kuerzeste uebliche Abstand (20. Perzentil der Abstaende
 * aus diesem und dem besten Pull), nur ab 4 Einsaetzen und wenn der Median der
 * Abstaende ab 2,5 s liegt (sonst ist es kein Knopf mit Abklingzeit, sondern
 * Spam oder Kanal). Eine Schaetzung aus dem eigenen Spiel.
 */
export function abklingSchaetzung(einsaetze: readonly { t: number }[], weitere: readonly { t: number }[] = []): number | null {
  if (einsaetze.length < 4) return null;
  const d: number[] = [];
  for (let i = 1; i < einsaetze.length; i++) d.push(einsaetze[i]!.t - einsaetze[i - 1]!.t);
  if (median(d) < 2.5) return null;
  const alle = [...d];
  for (let i = 1; i < weitere.length; i++) alle.push(weitere[i]!.t - weitere[i - 1]!.t);
  const p = perzentil(alle, 0.2);
  return p >= 2 ? +p.toFixed(1) : null;
}

/**
 * Ein voller Einsatz: die hoechste Trefferzahl, die mindestens drei Einsaetze
 * (und ein Zehntel) erreichen; ein einzelner Ausreisser setzt kein Maximum.
 */
export function trefferVoll(einsaetze: readonly { n: number }[]): number | null {
  const z = new Map<number, number>();
  for (const e of einsaetze) z.set(e.n, (z.get(e.n) || 0) + 1);
  const min = Math.max(3, Math.ceil(einsaetze.length / 10));
  let voll = 0;
  for (const [n, c] of z) if (c >= min && n > voll) voll = n;
  return voll || null;
}

/** Treffer-Decke je ID; mehrteilige Druecke haben keine. */
function vollJeSid(einsaetze: readonly Einsatz[], weitere: readonly Einsatz[] = []): Map<string, number> {
  const je = new Map<string, Einsatz[]>();
  for (const e of [...einsaetze, ...weitere]) {
    if (e.teile) continue;
    if (!je.has(e.sid)) je.set(e.sid, []);
    je.get(e.sid)!.push(e);
  }
  const out = new Map<string, number>();
  for (const [sid, l] of je) { const v = trefferVoll(l); if (v) out.set(sid, v); }
  return out;
}

/* ---------- Die Karten ---------- */

export interface BestKarte {
  vergleichbar: boolean;
  einsaetze: number | null;
  jeMinute: number;
  jeEinsatz: number;
  anteil: number;
  krit: number | null;
}
export interface Karte {
  name: string;
  sids: string[];
  sid: string | null;
  ventius: boolean;
  anteil: number;
  dmg: number;
  einsaetze: number;
  einsaetzeKampf: number;
  liste: Einsatz[];
  alle: Einsatz[];
  jeEinsatz: number;
  jeEinsatzKampf: number;
  p10: number;
  p90: number;
  trefferMedian: number;
  trefferMax: number | null;
  trefferFehlen: number;
  decke: boolean;
  jeTreffer: number;
  mehrteilig: boolean;
  kanal: boolean;
  vergleichbarJe: boolean;
  krit: number | null;
  stark: number | null;
  treffer: number;
  /** geschaetzter Takt in s; null bei Ventius und wo es keinen Knopf mit Abklingzeit gibt */
  cd: number | null;
  warte: number;
  bereit: [number, number][];
  mehr: number;
  moeglich: number | null;
  auslastung: number | null;
  /** nur Ventius: Abstand der Salven (Median, 10. Perzentil) in s */
  salvenAbstand: { median: number; p10: number } | null;
  best: BestKarte | null;
  jeMinute: number;
  ganz: boolean;
}

/**
 * Die Karten fuer den Bereich [a, b) (Standard: der ganze Kampf), ohne Ticks.
 * Der beste Pull vergleicht nur, wo er noch lief.
 */
export function pruefstand(k: Kampfdaten, best: Kampfdaten | null, a = 0, b = Infinity, deckeGegner = 0): Karte[] {
  const skills = skillsVon(k), bestSkills = best ? skillsVon(best) : [];
  const T = k.dauerS;
  const bis = Math.min(T, b), dauer = Math.max(0.001, bis - a), ganz = a <= 0 && bis >= T;
  const V = ventiusAuswertung(k, deckeGegner, a, bis);
  return skills.filter((s) => !s.tick).map((s): Karte => {
    const im = s.einsaetze.filter((e) => imBereich(e, a, bis));
    const bs = bestSkills.find((x) => x.name === s.name);
    const ventius = !!s.ventius;
    const cd = ventius ? null : abklingSchaetzung(s.einsaetze, bs ? bs.einsaetze : []);
    const n = im.reduce((x, e) => x + e.n, 0), krit = im.reduce((x, e) => x + e.krit, 0), stark = im.reduce((x, e) => x + e.stark, 0);
    const vergleichbar = !!bs && best!.dauerS >= bis;
    const bestIm = bs ? bs.einsaetze.filter((e) => vergleichbar && imBereich(e, a, bis)) : [];
    // Mehrteilige Faehigkeiten (mehrere IDs oder Mal und Zuendung) haben keine Decke und keinen Vergleich je Einsatz:
    // die Zahl der Einsaetze haengt an der Zerlegung, nicht am Spiel. Kanaele und Spam schwanken von selbst.
    const mehrteilig = s.einsaetze.some((e) => e.teile) || s.sids.length > 1, kanal = !!s.kanal;
    let trefferMax: number | null = null, trefferFehlen = 0, decke = false;
    if (ventius && V) { trefferMax = V.soll; decke = true; trefferFehlen = V.gefehlt; }
    else {
      const voll = vollJeSid(s.einsaetze, bs ? bs.einsaetze : []);
      trefferMax = Math.max(0, ...voll.values()) || null;
      decke = !!cd && !mehrteilig && !kanal && (trefferMax ?? 0) >= 2;
      if (decke) for (const e of im) { const v = voll.get(e.sid); if (v) trefferFehlen += Math.max(0, v - e.n); }
    }
    const jeTreffer = n ? im.reduce((x, e) => x + e.dmg, 0) / n : 0;
    // Wartezeit: Abstand ueber der Schaetzung (ab 1 s), summiert; dazu die Stuecke fuer das Band
    let warte = 0; const bereit: [number, number][] = [];
    if (cd) for (let i = 1; i < im.length; i++) { const p = im[i - 1]!.t + cd, q = im[i]!.t; if (q - p >= 1) { warte += q - p; bereit.push([p, q]); } }
    const moeglich = cd ? Math.floor(dauer / cd) + 1 : null;
    const dmg = im.reduce((x, e) => x + e.dmg, 0);
    let salvenAbstand: Karte["salvenAbstand"] = null;
    if (ventius && s.einsaetze.length >= 3) {
      const d: number[] = [];
      for (let i = 1; i < s.einsaetze.length; i++) d.push(s.einsaetze[i]!.t - s.einsaetze[i - 1]!.t);
      salvenAbstand = { median: median(d), p10: perzentil(d, 0.1) };
    }
    const bestListe = bs ? (vergleichbar ? bestIm : bs.einsaetze) : [];
    const bestHits = bestListe.reduce((x, e) => x + e.n, 0);
    return {
      name: s.name, sids: s.sids, sid: s.sid, ventius, anteil: s.anteil, dmg,
      einsaetze: im.length, einsaetzeKampf: s.einsaetze.length, liste: im, alle: s.einsaetze,
      jeEinsatz: median(im.map((e) => e.dmg)), jeEinsatzKampf: median(s.einsaetze.map((e) => e.dmg)),
      p10: perzentil(im.map((e) => e.dmg), 0.1), p90: perzentil(im.map((e) => e.dmg), 0.9),
      trefferMedian: median(im.map((e) => e.n)), trefferMax, trefferFehlen, decke, jeTreffer, mehrteilig, kanal,
      vergleichbarJe: !mehrteilig,
      krit: n ? krit / n : null, stark: n ? stark / n : null, treffer: n,
      cd, warte, bereit, mehr: cd ? Math.floor(warte / cd) : 0, moeglich, auslastung: moeglich ? Math.min(1, im.length / moeglich) : null,
      salvenAbstand,
      // der beste Pull: in denselben Sekunden, wenn er dort noch lief, sonst sein ganzer Lauf je Minute
      best: bs ? {
        vergleichbar, einsaetze: vergleichbar ? bestIm.length : null, jeMinute: bs.einsaetze.length / best!.dauerS * 60,
        jeEinsatz: median(bestListe.map((e) => e.dmg)), anteil: bs.anteil,
        krit: bestHits ? bestListe.reduce((x, e) => x + e.krit, 0) / bestHits : null,
      } : null,
      jeMinute: im.length / dauer * 60, ganz,
    };
  });
}

/* ---------- Kennzahlen im Kopf: allgemein, bei jeder Waffe ---------- */

export interface Kennzahlen {
  dps: number;
  best: { dps: number; dauerS: number; besser: boolean } | null;
  dauerS: number;
  schaden: number;
  leerlauf: number;
  luecken: number;
  einsaetze: number;
  jeMinute: number;
  krit: number | null;
  treffer: number;
  waffen: string[];
}
export function kennzahlen(k: Kampfdaten, best: Kampfdaten | null): Kennzahlen {
  const lk = lueckenVon(k), gedr = skillsVon(k).filter((s) => !s.tick);
  const nE = gedr.reduce((x, s) => x + s.einsaetze.length, 0);
  let tr = 0, kr = 0;
  for (const s of gedr) for (const e of s.einsaetze) { tr += e.n; kr += e.krit; }
  return {
    dps: k.dps, best: best ? { dps: best.dps, dauerS: best.dauerS, besser: best.dps > k.dps } : null, dauerS: k.dauerS, schaden: k.schaden,
    leerlauf: lk.summe, luecken: lk.luecken.length, einsaetze: nE, jeMinute: nE / k.dauerS * 60, krit: tr ? kr / tr : null, treffer: tr, waffen: k.waffen || [],
  };
}

/* ---------- Die Checkliste: Prozent statt Note ---------- */

export interface CheckZeile {
  k: "aktiv" | "best" | "takt" | "treffer" | "ventDecke" | "ventTreffer" | "krit";
  /** Schluessel der Frage */
  frage: string;
  /** 0 bis 1 */
  wert: number;
  satz: Satz;
  /** Schluessel eines Vorbehalts */
  vorbehalt?: string;
  neutral?: boolean;
}
export function checkliste(k: Kampfdaten, best: Kampfdaten | null, deckeGegner: number): CheckZeile[] {
  const T = k.dauerS, lk = lueckenVon(k), karten = pruefstand(k, best, 0, Infinity, deckeGegner), V = ventiusAuswertung(k, deckeGegner);
  const z: CheckZeile[] = [];
  z.push({ k: "aktiv", frage: "analysis.e.ck.aktiv.frage", wert: 1 - lk.summe / T, satz: { key: "analysis.e.ck.aktiv.satz", vars: { sek: lk.summe, n: lk.luecken.length } } });
  if (best) z.push({ k: "best", frage: "analysis.e.ck.best.frage", wert: Math.min(1, k.dps / best.dps), satz: { key: "analysis.e.ck.best.satz", vars: { dps: k.dps, bestDps: best.dps, dauer: best.dauerS } } });
  const ab = karten.filter((c) => c.cd && !c.ventius);
  if (ab.length) {
    const n = ab.reduce((x, c) => x + c.einsaetze, 0), m = ab.reduce((x, c) => x + (c.moeglich ?? 0), 0);
    z.push({ k: "takt", frage: "analysis.e.ck.takt.frage", wert: m ? Math.min(1, n / m) : 1, vorbehalt: "analysis.e.ck.takt.vorbehalt",
      satz: { key: "analysis.e.ck.takt.satz", vars: { n, m, namen: ab.slice(0, 3).map((c) => c.name).join(", ") } } });
  }
  const mehr = karten.filter((c) => !c.ventius && c.decke);
  if (mehr.length) {
    const ist = mehr.reduce((x, c) => x + c.treffer, 0), soll = ist + mehr.reduce((x, c) => x + c.trefferFehlen, 0);
    z.push({ k: "treffer", frage: "analysis.e.ck.treffer.frage", wert: soll ? ist / soll : 1,
      satz: { key: "analysis.e.ck.treffer.satz", vars: { ist, soll, namen: mehr.slice(0, 3).map((c) => c.name).join(", ") } } });
  }
  if (V) {
    z.push({ k: "ventDecke", frage: "analysis.e.ck.ventDecke.frage", wert: V.lesbar ? V.anDecke / V.lesbar : 0,
      satz: { key: "analysis.e.ck.ventDecke.satz", vars: { anDecke: V.anDecke, lesbar: V.lesbar, decke: V.decke, unlesbar: V.unlesbar, kampfende: V.kampfende } } });
    z.push({ k: "ventTreffer", frage: "analysis.e.ck.ventTreffer.frage", wert: V.moeglich ? V.getroffen / V.moeglich : 0,
      satz: { key: "analysis.e.ck.ventTreffer.satz", vars: { getroffen: V.getroffen, moeglich: V.moeglich, gefehlt: V.gefehlt } } });
  }
  const kz = kennzahlen(k, best);
  z.push({ k: "krit", frage: "analysis.e.ck.krit.frage", wert: kz.krit || 0, neutral: true, satz: { key: "analysis.e.ck.krit.satz", vars: { krit: kz.krit || 0 } } });
  return z;
}

/* ---------- Opener: die ersten Sekunden gegen den besten Pull ---------- */

export interface OpenerEinsatz { t: number; name: string; sid: string; dmg: number; n: number; krit: number; stark: number }
export interface OpenerErgebnis { hier: OpenerEinsatz[]; dort: OpenerEinsatz[] | null; saetze: Satz[]; bis: number }
export function opener(k: Kampfdaten, best: Kampfdaten | null, bis = 15): OpenerErgebnis {
  const folge = (x: Kampfdaten): OpenerEinsatz[] => skillsVon(x).filter((s) => !s.tick)
    .flatMap((s) => s.einsaetze.filter((e) => e.t < bis).map((e) => ({ t: e.t, name: s.name, sid: e.sid, dmg: e.dmg, n: e.n, krit: e.krit, stark: e.stark })))
    .sort((p, q) => p.t - q.t);
  const hier = folge(k), dort = best ? folge(best) : null;
  const erste = (l: readonly OpenerEinsatz[]) => { const m = new Map<string, number>(); for (const e of l) if (!m.has(e.name)) m.set(e.name, e.t); return m; };
  const saetze: Satz[] = [];
  if (dort) {
    const a = erste(hier), b = erste(dort), rA = [...a.keys()], rB = [...b.keys()];
    for (let i = 0; i < Math.min(rA.length, rB.length, 6); i++) {
      if (rA[i] !== rB[i]) { saetze.push({ key: "analysis.e.op.stelle", vars: { i: i + 1, hier: rA[i], dort: rB[i] } }); break; }
    }
    for (const n of rB) if (!a.has(n)) saetze.push({ key: "analysis.e.op.fehlt", vars: { name: n, bis, t: b.get(n) } });
    saetze.push({ key: "analysis.e.op.anzahl", vars: { hier: hier.length, dort: dort.length, bis } });
  } else saetze.push({ key: "analysis.e.op.ohne", vars: { hier: hier.length, bis } });
  return { hier, dort, saetze, bis };
}
