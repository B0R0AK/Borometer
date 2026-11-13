// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Der Kopf-Befund der neuen Analyse (#414, Spezifikation
 * 2026-11-08-analyse-neu-zeitleiste-design.md 2.1): die auffaelligste
 * Beobachtung des Kampfs, regelbasiert und bei jeder Waffe. Kandidaten werden
 * in Schaden gerechnet, damit sie vergleichbar sind; die Schlagzeile nimmt den
 * groessten *gemessenen* Posten ab 2 % des Kampfschadens, sonst den Abstand
 * zum besten Pull (ab 15 %), sonst einen weichen Posten, sonst nennt sie, was
 * den Kampf trug. "Je Einsatz gegen den besten Pull" ist weich (Krit, Buffs)
 * und traegt die Schlagzeile nie, wenn Gemessenes da ist. Ventius ist ein
 * Kandidat wie jeder andere und kommt nur vor, wo der Kampf Salven hat. Kein
 * Satz nennt ein Warum. Reiner Kern; Saetze sind Woerterbuch-Schluessel.
 */

import { abstandFenster } from "./bereich-core";
import { lueckenVon, type Kampfdaten, type Satz } from "./kampfdaten-core";
import { pruefstand, skillsVon } from "./pruefstand-core";
import { VENTIUS, ventiusAuswertung } from "./ventius-core";

/** Ein Befund traegt die Schlagzeile erst ab diesem Anteil am Schaden des Kampfs. */
export const BEFUND_SCHWELLE = 0.02;
/** Ab diesem Anteil am Schaden steht ein Kandidat unter "weitere". */
export const WEITERE_SCHWELLE = 0.005;
/** Der beste Pull liegt mindestens so viel hoeher, damit der Abstand die Schlagzeile traegt. */
export const ABSTAND_AB = 1.15;

/** fenster, stelle und fehl rechnet die Seite (53, 16) und reicht sie herein (Inventur O1) */
export type KandidatArt = "leerlauf" | "ventius" | "treffer" | "takt" | "je" | "fenster" | "stelle" | "fehl";
export interface Kandidat {
  art: KandidatArt;
  /** in Schaden gerechnet */
  wert: number;
  weich?: true;
  skill?: string;
  text: Satz;
  note: Satz;
  /** Strecke in Sekunden, wenn der Befund an einer Stelle haengt */
  von?: number | null;
  bis?: number | null;
}

const s = (key: string, vars: Record<string, unknown> = {}): Satz => ({ key: "analysis.e.kopf." + key, vars });

export function befundKandidaten(k: Kampfdaten, best: Kampfdaten | null, deckeGegner: number, extra: readonly Kandidat[] = []): Kandidat[] {
  const T = k.dauerS, lk = lueckenVon(k);
  const karten = pruefstand(k, best, 0, Infinity, deckeGegner);
  const V = ventiusAuswertung(k, deckeGegner);
  const out: Kandidat[] = [...extra];
  if (lk.summe >= 2) {
    const wert = lk.summe * lk.median;
    out.push({ art: "leerlauf", wert, text: s("leerlauf.text", { sek: lk.summe, n: lk.luecken.length, wert }), note: s("leerlauf.note"),
      von: lk.luecken[0] ? lk.luecken[0][0] : null, bis: lk.luecken[0] ? lk.luecken[0][1] : null });
  }
  if (V && V.gefehlt > 0) {
    out.push({ art: "ventius", wert: V.verlust, skill: VENTIUS, text: s("ventius.text", { gefehlt: V.gefehlt, wert: V.verlust }),
      note: s("ventius.note", { unter: V.unter, decke: V.decke, jeTreffer: V.jeTreffer }) });
  }
  for (const c of karten) {
    if (!c.ventius && c.decke && c.trefferFehlen >= 3) {
      const wert = c.trefferFehlen * c.jeTreffer;
      out.push({ art: "treffer", wert, skill: c.name, text: s("treffer.text", { name: c.name, fehlen: c.trefferFehlen, max: c.trefferMax, wert }), note: s("treffer.note") });
    }
    if (c.best && c.vergleichbarJe && c.einsaetzeKampf >= 3 && c.best.jeMinute >= c.jeMinute * 1.25) {
      const fehl = Math.round((c.best.jeMinute - c.jeMinute) * T / 60);
      if (fehl >= 2) {
        const wert = fehl * c.jeEinsatzKampf;
        out.push({ art: "takt", wert, skill: c.name, text: s("takt.text", { name: c.name, hier: c.jeMinute, dort: c.best.jeMinute, fehl, wert }), note: s("takt.note", { dauer: best!.dauerS }) });
      }
    }
    // "je Einsatz" gegen den besten Pull ist weich: zweite Stufe
    if (c.best && c.vergleichbarJe && c.einsaetzeKampf >= 5 && c.best.jeEinsatz > c.jeEinsatzKampf * 1.2) {
      const wert = (c.best.jeEinsatz - c.jeEinsatzKampf) * c.einsaetzeKampf;
      out.push({ art: "je", weich: true, wert, skill: c.name, text: s("je.text", { name: c.name, hier: c.jeEinsatzKampf, dort: c.best.jeEinsatz, n: c.einsaetzeKampf, wert }), note: s("je.note") });
    }
  }
  return out.sort((p, q) => q.wert - p.wert);
}

export type BefundArt = "kosten" | "abstand" | "quelle";
export interface KopfBefund {
  art: BefundArt;
  /** der Anfang der Schlagzeile ("Das kostet dich am meisten: ") */
  vor: Satz;
  text: Satz;
  note: Satz;
  /** der groesste Posten, wenn die Notiz ihn nennt (art quelle) */
  noteKand: Satz | null;
  skill: string | null;
  kand?: Kandidat;
  fenster?: { von: number; bis: number; mehr: number } | null;
  weitere: Kandidat[];
}

export function kopfBefund(k: Kampfdaten, best: Kampfdaten | null, deckeGegner: number, extra: readonly Kandidat[] = []): KopfBefund {
  const kand = befundKandidaten(k, best, deckeGegner, extra);
  const schwelle = k.schaden * BEFUND_SCHWELLE;
  const weitere = kand.filter((x) => x.wert >= k.schaden * WEITERE_SCHWELLE).slice(0, 3);
  // 1. ein gemessener Posten; daneben stehen dann nur gemessene Posten, kein weicher Vergleich, der groesser aussieht als die Schlagzeile
  const fest = kand.find((x) => !x.weich);
  if (fest && fest.wert >= schwelle) {
    return { art: "kosten", vor: s("vor.kosten"), text: fest.text, note: fest.note, noteKand: null, skill: fest.skill || null, kand: fest,
      weitere: weitere.filter((x) => x !== fest && !x.weich).slice(0, 2) };
  }
  // 2. der Abstand zum besten Pull, wenn er gross ist
  if (best && best.dps > k.dps * ABSTAND_AB) {
    const f = abstandFenster(k, best);
    return { art: "abstand", vor: s("vor.abstand", { rel: best.dps / k.dps - 1 }), text: s("abstand.text", { best: best.dps, dps: k.dps, fenster: f }),
      note: s("abstand.note", { schwelle: BEFUND_SCHWELLE }), noteKand: null, skill: null, fenster: f, weitere: weitere.slice(0, 2) };
  }
  // 3. ein weicher Posten
  if (kand[0] && kand[0].wert >= schwelle) {
    return { art: "kosten", vor: s("vor.auffaellt"), text: kand[0].text, note: kand[0].note, noteKand: null, skill: kand[0].skill || null, kand: kand[0], weitere: weitere.slice(1, 3) };
  }
  // 4. was den Kampf trug
  const top = skillsVon(k)[0];
  const text = top ? s("quelle.text", { anteil: top.anteil, n: top.einsaetze.length,
    vergleich: best ? (k.dps >= best.dps ? { art: "bester", ziel: k.hauptziel } : { art: "unter", rel: 1 - k.dps / best.dps }) : null }) : s("quelle.leer");
  return { art: "quelle", vor: top ? s("vor.quelle", { name: top.name }) : s("vor.kein"), text,
    note: kand[0] ? s("quelle.noteMit", { schwelle: BEFUND_SCHWELLE }) : s("quelle.noteOhne", { best: !!best }),
    noteKand: kand[0] ? kand[0].text : null, skill: top ? top.name : null, weitere };
}
