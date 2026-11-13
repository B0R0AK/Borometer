// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Die Texte der neuen Analyse (#414, Schluessel analysis.e.*). Jeder Eintrag
 * steht hier einmal mit deutscher und englischer Fassung; ANALYSE_DE und
 * ANALYSE_EN werden daraus gezogen und in 07-dictionary.ts in die beiden
 * Woerterbuecher gestreut. So haben beide Sprachen immer dieselben Schluessel.
 *
 * Die Kerne liefern Schluessel und Zahlen (kampfdaten-core.ts, Satz); hier
 * steht, wie daraus ein Satz wird. Zahlen kommen roh an und werden hier
 * formatiert: geschuetztes Leerzeichen vor %, s und m, Kurzzahlen 466.8k mit
 * Punkt auch im Deutschen (DESIGN.md). Kein Satz nennt ein Warum, das das
 * Log nicht hergibt.
 */

import type { I18nEntry, I18nVars } from "./types";

export interface Formate {
  /** 0,12 -> "12 %" */
  pr(q: number, stellen?: number): string;
  /** 3.4 -> "3,4 s" */
  sek(s: number, stellen?: number): string;
  /** 466800 -> "466.8k" */
  kurz(n: number): string;
  /** 83 -> "1:23" */
  uhr(s: number): string;
  /** Zahl mit Komma/Punkt je Sprache */
  zahl(n: number, stellen?: number): string;
}

const NBSP = "\u00a0";
function formate(komma: boolean): Formate {
  const dez = (s: string) => (komma ? s.replace(".", ",") : s);
  return {
    pr: (q, st = 0) => dez((q * 100).toFixed(st)) + NBSP + "%",
    sek: (s, st = 0) => dez(s.toFixed(st)) + NBSP + "s",
    kurz: (n) => {
      if (!Number.isFinite(n)) return "–";
      const a = Math.abs(n);
      if (a >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
      if (a >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
      return String(Math.round(n));
    },
    uhr: (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); },
    zahl: (n, st = 0) => dez(n.toFixed(st)),
  };
}
export const FORMATE_DE = formate(true);
export const FORMATE_EN = formate(false);

type Fn = (v: I18nVars, f: Formate) => string;
interface Wort { de: string | Fn; en: string | Fn }
const W: Record<string, Wort> = {};

/* ---------- Ventius (ventius-core.ts) ---------- */
Object.assign(W, {
  "analysis.e.vent.grund.doppelsalve": { de: "Doppelsalve", en: "double volley" },
  "analysis.e.vent.grund.ohne-oeffner": { de: "ohne Öffner", en: "no opener" },
  "analysis.e.vent.grund.mehrziel": { de: "Mehrziel-Welle", en: "multi-target wave" },
  "analysis.e.vent.grund.teilwelle": { de: "Teilwelle", en: "partial wave" },
  "analysis.e.vent.nurOeffner": { de: "nur Öffner", en: "opener only" },
  "analysis.e.vent.kampfende": { de: "Kampfende", en: "end of fight" },
} satisfies Record<string, Wort>);

/** "1 Lücke" / "2 Lücken" */
const mal = (n: number, eins: string, viele: string) => n + NBSP + (n === 1 ? eins : viele);

/* ---------- Checkliste und Opener (pruefstand-core.ts) ---------- */
Object.assign(W, {
  "analysis.e.ck.aktiv.frage": { de: "Ohne Leerlauf?", en: "No idle time?" },
  "analysis.e.ck.aktiv.satz": {
    de: (v, f) => v.n ? f.sek(v.sek) + " Leerlauf in " + mal(v.n, "Lücke", "Lücken") + " (unter 2" + NBSP + "% des Medians)." : "Keine Lücke ab 2" + NBSP + "s.",
    en: (v, f) => v.n ? f.sek(v.sek) + " idle in " + mal(v.n, "gap", "gaps") + " (under 2" + NBSP + "% of the median)." : "No gap of 2" + NBSP + "s or more.",
  },
  "analysis.e.ck.best.frage": { de: "Auf Höhe des besten Pulls?", en: "On par with your best pull?" },
  "analysis.e.ck.best.satz": {
    de: (v, f) => f.kurz(v.dps) + " gegen " + f.kurz(v.bestDps) + " je Sekunde im besten Pull (" + f.uhr(v.dauer) + ").",
    en: (v, f) => f.kurz(v.dps) + " against " + f.kurz(v.bestDps) + " per second in your best pull (" + f.uhr(v.dauer) + ").",
  },
  "analysis.e.ck.takt.frage": { de: "Takt gehalten?", en: "Rhythm kept?" },
  "analysis.e.ck.takt.satz": {
    de: (v) => v.n + " Einsätze, wo im geschätzten Takt " + v.m + " Platz hatten (" + v.namen + ").",
    en: (v) => v.n + " casts where the estimated rhythm had room for " + v.m + " (" + v.namen + ").",
  },
  "analysis.e.ck.takt.vorbehalt": {
    de: "Takt geschätzt aus deinen eigenen Abständen; das Log kennt keine Abklingzeit.",
    en: "Rhythm estimated from your own gaps; the log does not know cooldowns.",
  },
  "analysis.e.ck.treffer.frage": { de: "Mehrfachtreffer voll?", en: "Multi-hits complete?" },
  "analysis.e.ck.treffer.satz": {
    de: (v) => v.ist + " von " + v.soll + " Treffern bei " + v.namen + "; voll ist, was du je Einsatz selbst schon erreicht hast.",
    en: (v) => v.ist + " of " + v.soll + " hits on " + v.namen + "; complete is what you have already reached per cast yourself.",
  },
  "analysis.e.ck.ventDecke.frage": { de: "Ventius an der Decke?", en: "Ventius at the ceiling?" },
  "analysis.e.ck.ventDecke.satz": {
    de: (v) => v.anDecke + " von " + v.lesbar + " lesbaren Salven mit " + v.decke + " Nachbeben" +
      (v.unlesbar ? ", " + v.unlesbar + " nicht lesbar" : "") + (v.kampfende ? ", " + v.kampfende + " am Kampfende" : "") + ".",
    en: (v) => v.anDecke + " of " + v.lesbar + " readable volleys with " + v.decke + " aftershocks" +
      (v.unlesbar ? ", " + v.unlesbar + " unreadable" : "") + (v.kampfende ? ", " + v.kampfende + " at the end of the fight" : "") + ".",
  },
  "analysis.e.ck.ventTreffer.frage": { de: "Ventius-Treffer gesetzt?", en: "Ventius hits landed?" },
  "analysis.e.ck.ventTreffer.satz": {
    de: (v) => v.getroffen + " von " + v.moeglich + " möglichen Treffern, " + v.gefehlt + " fehlen.",
    en: (v) => v.getroffen + " of " + v.moeglich + " possible hits, " + v.gefehlt + " missing.",
  },
  "analysis.e.ck.krit.frage": { de: "Kritisch getroffen?", en: "Critical hits?" },
  "analysis.e.ck.krit.satz": {
    de: (v, f) => f.pr(v.krit) + " der Treffer gedrückter Einsätze. Keine Wertung: Krit hängt an Buffs, die das Log nicht kennt.",
    en: (v, f) => f.pr(v.krit) + " of the hits of pressed casts. No verdict: crit depends on buffs the log does not know.",
  },
  "analysis.e.op.stelle": {
    de: (v) => "An Stelle " + v.i + " kam hier " + v.hier + ", im besten Pull " + v.dort + ".",
    en: (v) => "At position " + v.i + " you cast " + v.hier + ", your best pull " + v.dort + ".",
  },
  "analysis.e.op.fehlt": {
    de: (v, f) => v.name + " kam im besten Pull in den ersten " + v.bis + NBSP + "s (" + f.sek(v.t, 1) + "), hier nicht.",
    en: (v, f) => v.name + " came in the first " + v.bis + NBSP + "s of your best pull (" + f.sek(v.t, 1) + "), not here.",
  },
  "analysis.e.op.anzahl": {
    de: (v) => v.hier + " gedrückte Einsätze in " + v.bis + NBSP + "s gegen " + v.dort + " im besten Pull.",
    en: (v) => v.hier + " pressed casts in " + v.bis + NBSP + "s against " + v.dort + " in your best pull.",
  },
  "analysis.e.op.ohne": {
    de: (v) => v.hier + " gedrückte Einsätze in den ersten " + v.bis + NBSP + "s. Ohne zweiten Pull kein Vergleich.",
    en: (v) => v.hier + " pressed casts in the first " + v.bis + NBSP + "s. No second pull, no comparison.",
  },
} satisfies Record<string, Wort>);

/* ---------- Bereich: Saetze und Marken (bereich-core.ts) ---------- */
const GRUENDE: Record<"de" | "en", Record<string, string>> = {
  de: { doppelsalve: "Doppelsalve", "ohne-oeffner": "ohne Öffner", mehrziel: "Mehrziel-Welle", teilwelle: "Teilwelle" },
  en: { doppelsalve: "double volley", "ohne-oeffner": "no opener", mehrziel: "multi-target wave", teilwelle: "partial wave" },
};
const gruendeListe = (g: Record<string, number>, sprache: "de" | "en") => Object.keys(g).map((k) => GRUENDE[sprache][k] ?? k).join(", ");
/** der Spiegel: der beste Pull oder, ist dieser Kampf der beste, der naechstbeste */
const spiegel = (nb: boolean, de: boolean, fall: "dat" | "nom") =>
  de ? (fall === "dat" ? (nb ? "deinem nächstbesten Pull" : "deinem besten Pull") : (nb ? "Dein nächstbester Pull" : "Dein bester Pull"))
     : (nb ? "your next-best pull" : "your best pull");
Object.assign(W, {
  "analysis.e.bs.kopf": {
    de: (v, f) => (v.ganz ? "Im ganzen Kampf" : "Von " + f.uhr(v.a) + " bis " + f.uhr(v.b) + " (" + f.sek(v.dauer) + ")") + ": " + f.kurz(v.dps) + " je Sekunde" +
      (v.ganz ? "" : ", " + (v.rel >= 1 ? "+" : "−") + f.pr(Math.abs(v.rel - 1)) + " zum Kampf") + (v.top ? "; " + f.pr(v.top.anteil) + " davon " + v.top.name : "") + ".",
    en: (v, f) => (v.ganz ? "Whole fight" : "From " + f.uhr(v.a) + " to " + f.uhr(v.b) + " (" + f.sek(v.dauer) + ")") + ": " + f.kurz(v.dps) + " per second" +
      (v.ganz ? "" : ", " + (v.rel >= 1 ? "+" : "−") + f.pr(Math.abs(v.rel - 1)) + " against the fight") + (v.top ? "; " + f.pr(v.top.anteil) + " of it " + v.top.name : "") + ".",
  },
  "analysis.e.bs.dps.gut": {
    de: (v, f) => "Schadensrate " + f.pr(v.rel - 1) + " über dem Kampf (" + f.kurz(v.dps) + " gegen " + f.kurz(v.dpsKampf) + ").",
    en: (v, f) => "Damage rate " + f.pr(v.rel - 1) + " above the fight (" + f.kurz(v.dps) + " against " + f.kurz(v.dpsKampf) + ").",
  },
  "analysis.e.bs.dps.besser": {
    de: (v, f) => "Schadensrate " + f.pr(1 - v.rel) + " unter dem Kampf (" + f.kurz(v.dps) + " gegen " + f.kurz(v.dpsKampf) + ").",
    en: (v, f) => "Damage rate " + f.pr(1 - v.rel) + " below the fight (" + f.kurz(v.dps) + " against " + f.kurz(v.dpsKampf) + ").",
  },
  "analysis.e.bs.best.bester": {
    de: (v, f) => "Dein bester Pull an diesem Gegner: " + f.kurz(v.dpsKampf) + " je Sekunde, der nächstbeste " + f.kurz(v.bestDps) + " (" + f.uhr(v.dauer) + ").",
    en: (v, f) => "Your best pull on this enemy: " + f.kurz(v.dpsKampf) + " per second, the next best " + f.kurz(v.bestDps) + " (" + f.uhr(v.dauer) + ").",
  },
  "analysis.e.bs.best.ueber": {
    de: (v, f) => "In denselben Sekunden " + f.pr(v.r - 1) + " über " + spiegel(v.nb, true, "dat") + " (" + f.kurz(v.bestDps) + " je Sekunde dort).",
    en: (v, f) => "In the same seconds " + f.pr(v.r - 1) + " above " + spiegel(v.nb, false, "dat") + " (" + f.kurz(v.bestDps) + " per second there).",
  },
  "analysis.e.bs.best.unter": {
    de: (v, f) => spiegel(v.nb, true, "nom") + " machte in denselben Sekunden " + f.kurz(v.bestDps) + " je Sekunde, " + f.pr(1 / v.r - 1) + " mehr.",
    en: (v, f) => spiegel(v.nb, false, "nom").replace(/^./, (c) => c.toUpperCase()) + " did " + f.kurz(v.bestDps) + " per second in the same seconds, " + f.pr(1 / v.r - 1) + " more.",
  },
  "analysis.e.bs.best.hoehe": {
    de: (v, f) => "Auf Höhe " + (v.nb ? "deines nächstbesten" : "deines besten") + " Pulls in denselben Sekunden (" + f.kurz(v.bestDps) + " je Sekunde dort).",
    en: (v, f) => "On par with " + spiegel(v.nb, false, "dat") + " in the same seconds (" + f.kurz(v.bestDps) + " per second there).",
  },
  "analysis.e.bs.best.vorneUeber": {
    de: (v, f) => "In den ersten " + f.uhr(v.bis) + " (so lange lief " + (v.nb ? "dein nächstbester Pull" : "dein bester Pull") + ") " + f.pr(v.r - 1) + " vor ihm: " + f.kurz(v.hier) + " gegen " + f.kurz(v.dort) + " Schaden.",
    en: (v, f) => "In the first " + f.uhr(v.bis) + " (as long as " + spiegel(v.nb, false, "nom") + " lasted) " + f.pr(v.r - 1) + " ahead of it: " + f.kurz(v.hier) + " against " + f.kurz(v.dort) + " damage.",
  },
  "analysis.e.bs.best.vorneGleich": {
    de: (v, f) => "In den ersten " + f.uhr(v.bis) + " (so lange lief " + (v.nb ? "dein nächstbester Pull" : "dein bester Pull") + ") auf seiner Höhe: " + f.kurz(v.hier) + " gegen " + f.kurz(v.dort) + " Schaden.",
    en: (v, f) => "In the first " + f.uhr(v.bis) + " (as long as " + spiegel(v.nb, false, "nom") + " lasted) on par with it: " + f.kurz(v.hier) + " against " + f.kurz(v.dort) + " damage.",
  },
  "analysis.e.bs.best.vorneUnter": {
    de: (v, f) => "In den ersten " + f.uhr(v.bis) + " (so lange lief " + (v.nb ? "dein nächstbester Pull" : "dein bester Pull") + ") machte er " + f.pr(1 / v.r - 1) + " mehr Schaden: " + f.kurz(v.dort) + " gegen " + f.kurz(v.hier) + ".",
    en: (v, f) => "In the first " + f.uhr(v.bis) + " (as long as " + spiegel(v.nb, false, "nom") + " lasted) it did " + f.pr(1 / v.r - 1) + " more damage: " + f.kurz(v.dort) + " against " + f.kurz(v.hier) + ".",
  },
  "analysis.e.bs.best.vorbei": {
    de: (v, f) => spiegel(v.nb, true, "nom") + " war hier schon vorbei (er dauerte " + f.uhr(v.dauer) + "); kein Vergleich je Sekunde.",
    en: (v, f) => spiegel(v.nb, false, "nom").replace(/^./, (c) => c.toUpperCase()) + " was already over here (it lasted " + f.uhr(v.dauer) + "); no per-second comparison.",
  },
  "analysis.e.bs.leer.viel": {
    de: (v, f) => f.sek(v.sek) + " Leerlauf in " + v.n + NBSP + (v.n === 1 ? "Lücke" : "Lücken") + " (unter 2" + NBSP + "% des Medians). Ob das Ziel zu treffen war, sagt das Log nicht.",
    en: (v, f) => f.sek(v.sek) + " idle in " + v.n + NBSP + (v.n === 1 ? "gap" : "gaps") + " (under 2" + NBSP + "% of the median). Whether the target could be hit, the log does not say.",
  },
  "analysis.e.bs.leer.wenig": {
    de: (v, f) => "Wenig Leerlauf: " + f.sek(v.sek) + " in " + v.n + NBSP + (v.n === 1 ? "Lücke" : "Lücken") + ", " + f.pr(v.anteil) + " der Zeit.",
    en: (v, f) => "Little idle time: " + f.sek(v.sek) + " in " + v.n + NBSP + (v.n === 1 ? "gap" : "gaps") + ", " + f.pr(v.anteil) + " of the time.",
  },
  "analysis.e.bs.leer.kein": {
    de: (v) => "Kein Leerlauf" + (v.ganz ? " im ganzen Kampf" : "") + ": keine Lücke ab 2" + NBSP + "s unter 2" + NBSP + "% des Medians.",
    en: (v) => "No idle time" + (v.ganz ? " in the whole fight" : "") + ": no gap of 2" + NBSP + "s under 2" + NBSP + "% of the median.",
  },
  "analysis.e.bs.vent.alle": {
    de: (v) => (v.lesbar === 1 ? "Die eine lesbare Salve" : "Alle " + v.lesbar + " lesbaren Salven") + " von Ventius an der Decke (" + v.decke + " Nachbeben = " + v.soll + " Treffer).",
    en: (v) => (v.lesbar === 1 ? "The one readable volley" : "All " + v.lesbar + " readable volleys") + " of Ventius at the ceiling (" + v.decke + " aftershocks = " + v.soll + " hits).",
  },
  "analysis.e.bs.vent.quote": {
    de: (v, f) => v.anDecke + " von " + v.lesbar + " lesbaren Ventius-Salven an der Decke (" + f.pr(v.anDecke / v.lesbar) + ", je " + v.soll + " Treffer).",
    en: (v, f) => v.anDecke + " of " + v.lesbar + " readable Ventius volleys at the ceiling (" + f.pr(v.anDecke / v.lesbar) + ", " + v.soll + " hits each).",
  },
  "analysis.e.bs.vent.vsGut": {
    de: (v) => v.anHier + " von " + v.lesbarHier + " lesbaren Ventius-Salven an der Decke, " + (v.nb ? "im nächstbesten" : "im besten") + " Pull " + v.anDort + " von " + v.lesbarDort + ".",
    en: (v) => v.anHier + " of " + v.lesbarHier + " readable Ventius volleys at the ceiling, " + v.anDort + " of " + v.lesbarDort + " in your " + (v.nb ? "next-best" : "best") + " pull.",
  },
  "analysis.e.bs.vent.vsBesser": {
    de: (v) => (v.nb ? "Im nächstbesten" : "Im besten") + " Pull " + v.anDort + " von " + v.lesbarDort + " lesbaren Ventius-Salven an der Decke, hier " + v.anHier + " von " + v.lesbarHier + ".",
    en: (v) => "In your " + (v.nb ? "next-best" : "best") + " pull " + v.anDort + " of " + v.lesbarDort + " readable Ventius volleys were at the ceiling, here " + v.anHier + " of " + v.lesbarHier + ".",
  },
  "analysis.e.bs.vent.unter": {
    de: (v, f) => v.unter + NBSP + (v.unter === 1 ? "Salve" : "Salven") + " von Ventius unter der Decke: " + v.gefehlt + " Treffer fehlen, etwa " + f.kurz(v.verlust) + ". Warum, steht nicht im Log.",
    en: (v, f) => v.unter + NBSP + (v.unter === 1 ? "volley" : "volleys") + " of Ventius below the ceiling: " + v.gefehlt + " hits missing, about " + f.kurz(v.verlust) + ". The log does not say why.",
  },
  "analysis.e.bs.vent.unlesbar": {
    de: (v) => v.n + (v.n === 1 ? " Salve ließ" : " Salven ließen") + " sich nicht lesen (" + gruendeListe(v.gruende, "de") + ").",
    en: (v) => v.n + (v.n === 1 ? " volley" : " volleys") + " could not be read (" + gruendeListe(v.gruende, "en") + ").",
  },
  "analysis.e.bs.krit.ueber": {
    de: (v, f) => "Kritquote " + f.pr(v.krit) + ", " + v.punkte + " Punkte über dem Kampf. Kritisch hängt an Buffs, die das Log nicht kennt.",
    en: (v, f) => "Crit rate " + f.pr(v.krit) + ", " + v.punkte + " points above the fight. Crit depends on buffs the log does not know.",
  },
  "analysis.e.bs.krit.unter": {
    de: (v, f) => "Kritquote " + f.pr(v.krit) + ", " + v.punkte + " Punkte unter dem Kampf. Eine Beobachtung, kein Fehler: der Würfel.",
    en: (v, f) => "Crit rate " + f.pr(v.krit) + ", " + v.punkte + " points below the fight. An observation, not a mistake: the dice.",
  },
  "analysis.e.bs.krit.ueberBest": {
    de: (v, f) => "Kritquote " + f.pr(v.krit) + ", " + v.punkte + " Punkte über " + spiegel(v.nb, true, "dat") + " (" + f.pr(v.kritBest) + "). Kritisch hängt an Buffs, die das Log nicht kennt.",
    en: (v, f) => "Crit rate " + f.pr(v.krit) + ", " + v.punkte + " points above " + spiegel(v.nb, false, "dat") + " (" + f.pr(v.kritBest) + "). Crit depends on buffs the log does not know.",
  },
  "analysis.e.bs.krit.gleich": {
    de: (v, f) => "Kritquote gleichmäßig: in jedem " + v.abschnitt + "-s-Abschnitt zwischen " + Math.round(v.lo * 100) + " und " + f.pr(v.hi) + ".",
    en: (v, f) => "Even crit rate: between " + Math.round(v.lo * 100) + " and " + f.pr(v.hi) + " in every " + v.abschnitt + "-s section.",
  },
  "analysis.e.bs.takt.ueber": {
    de: (v) => v.jeMinute.toFixed(0) + " gedrückte Einsätze je Minute, im Kampf " + v.jeMinuteKampf.toFixed(0) + ".",
    en: (v) => v.jeMinute.toFixed(0) + " pressed casts per minute, " + v.jeMinuteKampf.toFixed(0) + " in the fight.",
  },
  "analysis.e.bs.takt.gehalten": {
    de: (v) => "Takt gehalten: " + v.jeMinute.toFixed(0) + " gedrückte Einsätze je Minute, im Kampf " + v.jeMinuteKampf.toFixed(0) + ".",
    en: (v) => "Rhythm kept: " + v.jeMinute.toFixed(0) + " pressed casts per minute, " + v.jeMinuteKampf.toFixed(0) + " in the fight.",
  },
  "analysis.e.bs.takt.unter": {
    de: (v) => "Nur " + v.jeMinute.toFixed(0) + " gedrückte Einsätze je Minute, im Kampf " + v.jeMinuteKampf.toFixed(0) + ".",
    en: (v) => "Only " + v.jeMinute.toFixed(0) + " pressed casts per minute, " + v.jeMinuteKampf.toFixed(0) + " in the fight.",
  },
  "analysis.e.bs.takt.gleich": {
    de: (v) => "Gleichmäßiger Takt: " + v.lo.toFixed(0) + " bis " + v.hi.toFixed(0) + " gedrückte Einsätze je Minute in jedem " + v.abschnitt + "-s-Abschnitt.",
    en: (v) => "Even rhythm: " + v.lo.toFixed(0) + " to " + v.hi.toFixed(0) + " pressed casts per minute in every " + v.abschnitt + "-s section.",
  },
  "analysis.e.bs.ziel.wechsel": {
    de: (v, f) => v.n + NBSP + "Zielwechsel (" + (v.liste as { t: number; ziel: string }[]).map((x) => f.uhr(x.t) + " " + x.ziel).join(", ") + (v.mehr ? ", …" : "") + "). Ob gewollt, sagt das Log nicht.",
    en: (v, f) => v.n + NBSP + (v.n === 1 ? "target change" : "target changes") + " (" + (v.liste as { t: number; ziel: string }[]).map((x) => f.uhr(x.t) + " " + x.ziel).join(", ") + (v.mehr ? ", …" : "") + "). Whether intended, the log does not say.",
  },
  "analysis.e.bs.ziel.keiner": {
    de: (v) => "Kein Zielwechsel in diesem Bereich (im Kampf " + v.kampf + ").",
    en: (v) => "No target change in this range (" + v.kampf + " in the fight).",
  },
  "analysis.e.bs.spitze.ganz": {
    de: (v, f) => "Stärkste 5" + NBSP + "s: " + f.uhr(v.von) + "–" + f.uhr(v.bis) + ", " + f.kurz(v.dps) + " je Sekunde (" + f.zahl(v.faktor, 1) + "-mal die Rate des Kampfs).",
    en: (v, f) => "Strongest 5" + NBSP + "s: " + f.uhr(v.von) + "–" + f.uhr(v.bis) + ", " + f.kurz(v.dps) + " per second (" + f.zahl(v.faktor, 1) + " times the rate of the fight).",
  },
  "analysis.e.bs.spitze.hier": {
    de: (v, f) => "Die stärksten 5" + NBSP + "s des Kampfs liegen hier: " + f.uhr(v.von) + "–" + f.uhr(v.bis) + ", " + f.kurz(v.dps) + " je Sekunde.",
    en: (v, f) => "The strongest 5" + NBSP + "s of the fight are here: " + f.uhr(v.von) + "–" + f.uhr(v.bis) + ", " + f.kurz(v.dps) + " per second.",
  },
  "analysis.e.bs.bereit": {
    de: (v, f) => v.name + " " + v.ist + "× in " + f.sek(Math.round(v.dauer)) + "; im Takt des ganzen Kampfs wären es " + v.erwartet + "×.",
    en: (v, f) => v.name + " " + v.ist + "× in " + f.sek(Math.round(v.dauer)) + "; at the pace of the whole fight it would be " + v.erwartet + "×.",
  },
  "analysis.e.bs.ruhig.ganz": { de: "Kein Ausreißer nach oben im ganzen Kampf.", en: "No outlier upwards in the whole fight." },
  "analysis.e.bs.ruhig.unten": { de: "Kein Ausreißer nach oben.", en: "No outlier upwards." },
  "analysis.e.bs.ruhig.rest": { de: "Kein Ausreißer nach oben; Rate und Takt wie im übrigen Kampf.", en: "No outlier upwards; rate and rhythm as in the rest of the fight." },
  "analysis.e.marke.spitze": {
    de: (v, f) => "Stärkste 5" + NBSP + "s: " + f.kurz(v.dps) + " je Sekunde",
    en: (v, f) => "Strongest 5" + NBSP + "s: " + f.kurz(v.dps) + " per second",
  },
  "analysis.e.marke.luecke": {
    de: (v, f) => "Lücke " + f.sek(v.dauer) + ", " + f.uhr(v.von) + "–" + f.uhr(v.bis),
    en: (v, f) => "Gap " + f.sek(v.dauer) + ", " + f.uhr(v.von) + "–" + f.uhr(v.bis),
  },
  "analysis.e.marke.einsatz": {
    de: (v, f) => "Stärkster Einsatz: " + v.name + " " + f.kurz(v.dmg) + ", " + f.uhr(v.t),
    en: (v, f) => "Strongest cast: " + v.name + " " + f.kurz(v.dmg) + ", " + f.uhr(v.t),
  },
  "analysis.e.marke.ziel": {
    de: (v, f) => "Ziel ab " + f.uhr(v.t) + ": " + v.ziel,
    en: (v, f) => "Target from " + f.uhr(v.t) + ": " + v.ziel,
  },
  "analysis.e.marke.salveUnlesbar": {
    de: (v, f) => "Salve " + f.uhr(v.t) + " nicht lesbar (" + (GRUENDE.de[v.grund] ?? v.grund) + ")",
    en: (v, f) => "Volley " + f.uhr(v.t) + " unreadable (" + (GRUENDE.en[v.grund] ?? v.grund) + ")",
  },
  "analysis.e.marke.salveUnter": {
    de: (v, f) => "Salve " + f.uhr(v.t) + ": " + v.n + " statt " + v.soll + " Treffer" + (v.nurOeffner ? " (nur Öffner)" : ""),
    en: (v, f) => "Volley " + f.uhr(v.t) + ": " + v.n + " instead of " + v.soll + " hits" + (v.nurOeffner ? " (opener only)" : ""),
  },
} satisfies Record<string, Wort>);

/* ---------- Kopf-Befund (befund-core.ts) ---------- */
Object.assign(W, {
  "analysis.e.kopf.vor.kosten": { de: "Das kostet dich am meisten: ", en: "This costs you the most: " },
  "analysis.e.kopf.vor.auffaellt": { de: "Das fällt am meisten auf: ", en: "This stands out the most: " },
  "analysis.e.kopf.vor.abstand": {
    de: (v, f) => "Dein bester Pull lag " + f.pr(v.rel) + " höher: ",
    en: (v, f) => "Your best pull was " + f.pr(v.rel) + " higher: ",
  },
  "analysis.e.kopf.vor.quelle": { de: (v) => "Getragen von " + v.name + ": ", en: (v) => "Carried by " + v.name + ": " },
  "analysis.e.kopf.vor.kein": { de: "Kein Befund: ", en: "No finding: " },
  "analysis.e.kopf.leerlauf.text": {
    de: (v, f) => f.sek(v.sek) + " Leerlauf in " + v.n + NBSP + (v.n === 1 ? "Lücke" : "Lücken") + ", etwa " + f.kurz(v.wert) + ".",
    en: (v, f) => f.sek(v.sek) + " idle in " + v.n + NBSP + (v.n === 1 ? "gap" : "gaps") + ", about " + f.kurz(v.wert) + ".",
  },
  "analysis.e.kopf.leerlauf.note": {
    de: "Sekunden unter 2" + NBSP + "% des Medians, bewertet mit dem Median. Ob das Ziel zu treffen war, weiß das Log nicht.",
    en: "Seconds under 2" + NBSP + "% of the median, valued at the median. Whether the target could be hit, the log does not know.",
  },
  "analysis.e.kopf.ventius.text": {
    de: (v, f) => v.gefehlt + " Treffer fehlten über alle Salven von Auge von Ventius, etwa " + f.kurz(v.wert) + ".",
    en: (v, f) => v.gefehlt + " hits missing across all volleys of Eye of Ventius, about " + f.kurz(v.wert) + ".",
  },
  "analysis.e.kopf.ventius.note": {
    de: (v, f) => v.unter + NBSP + (v.unter === 1 ? "Salve erreichte" : "Salven erreichten") + " weniger als " + v.decke + " Nachbeben; je fehlender Treffer der Median eines Treffers an der Decke (" + f.kurz(v.jeTreffer) + "). Warum, steht nicht im Log.",
    en: (v, f) => v.unter + NBSP + (v.unter === 1 ? "volley reached" : "volleys reached") + " fewer than " + v.decke + " aftershocks; each missing hit is valued at the median hit at the ceiling (" + f.kurz(v.jeTreffer) + "). The log does not say why.",
  },
  "analysis.e.kopf.treffer.text": {
    de: (v, f) => v.name + ": " + v.fehlen + " Treffer weniger als bei vollen Einsätzen (" + v.max + " je Einsatz), etwa " + f.kurz(v.wert) + ".",
    en: (v, f) => v.name + ": " + v.fehlen + " fewer hits than in complete casts (" + v.max + " per cast), about " + f.kurz(v.wert) + ".",
  },
  "analysis.e.kopf.treffer.note": {
    de: "Voll ist, was du mit dieser Fähigkeit selbst schon je Einsatz erreicht hast. Warum ein Einsatz weniger traf, sagt das Log nicht.",
    en: "Complete is what you have already reached per cast with this skill. Why a cast hit less, the log does not say.",
  },
  "analysis.e.kopf.takt.text": {
    de: (v, f) => v.name + " " + f.zahl(v.hier, 1) + "× je Minute, im besten Pull " + f.zahl(v.dort, 1) + "×: etwa " + v.fehl + " Einsätze weniger, rund " + f.kurz(v.wert) + ".",
    en: (v, f) => v.name + " " + f.zahl(v.hier, 1) + "× per minute, " + f.zahl(v.dort, 1) + "× in your best pull: about " + v.fehl + " casts fewer, around " + f.kurz(v.wert) + ".",
  },
  "analysis.e.kopf.takt.note": {
    de: (v, f) => "Gegen deinen besten Pull am selben Gegner (" + f.uhr(v.dauer) + "), je Einsatz der Median dieses Kampfs.",
    en: (v, f) => "Against your best pull on the same enemy (" + f.uhr(v.dauer) + "), valued at the median cast of this fight.",
  },
  "analysis.e.kopf.je.text": {
    de: (v, f) => v.name + " je Einsatz " + f.kurz(v.hier) + ", im besten Pull " + f.kurz(v.dort) + ": über " + v.n + " Einsätze etwa " + f.kurz(v.wert) + ".",
    en: (v, f) => v.name + " per cast " + f.kurz(v.hier) + ", " + f.kurz(v.dort) + " in your best pull: over " + v.n + " casts about " + f.kurz(v.wert) + ".",
  },
  "analysis.e.kopf.je.note": {
    de: "Kritisch und stark hängen an Buffs, die das Log nicht kennt; eine Beobachtung, keine Ursache.",
    en: "Crit and heavy depend on buffs the log does not know; an observation, not a cause.",
  },
  "analysis.e.kopf.abstand.text": {
    de: (v, f) => f.kurz(v.best) + " gegen " + f.kurz(v.dps) + " je Sekunde" + (v.fenster ? "; am weitesten voraus " + f.uhr(v.fenster.von) + "–" + f.uhr(v.fenster.bis) + " (" + f.kurz(v.fenster.mehr) + " mehr)." : "."),
    en: (v, f) => f.kurz(v.best) + " against " + f.kurz(v.dps) + " per second" + (v.fenster ? "; furthest ahead " + f.uhr(v.fenster.von) + "–" + f.uhr(v.fenster.bis) + " (" + f.kurz(v.fenster.mehr) + " more)." : "."),
  },
  "analysis.e.kopf.abstand.note": {
    de: (v, f) => "Kein gemessener Posten über " + f.pr(v.schwelle) + " des Schadens; der Abstand verteilt sich.",
    en: (v, f) => "No measured item above " + f.pr(v.schwelle) + " of the damage; the gap is spread out.",
  },
  "analysis.e.kopf.quelle.text": {
    de: (v, f) => f.pr(v.anteil) + " des Schadens in " + v.n + NBSP + (v.n === 1 ? "Einsatz" : "Einsätzen") +
      (v.vergleich ? ", " + (v.vergleich.art === "bester" ? "dein bester Pull an " + v.vergleich.ziel : f.pr(v.vergleich.rel) + " unter deinem besten Pull") : "") + ".",
    en: (v, f) => f.pr(v.anteil) + " of the damage in " + v.n + NBSP + (v.n === 1 ? "cast" : "casts") +
      (v.vergleich ? ", " + (v.vergleich.art === "bester" ? "your best pull on " + v.vergleich.ziel : f.pr(v.vergleich.rel) + " below your best pull") : "") + ".",
  },
  "analysis.e.kopf.quelle.leer": { de: "", en: "" },
  "analysis.e.kopf.quelle.noteMit": {
    de: (v, f) => "Kein Posten über " + f.pr(v.schwelle) + " des Schadens; der größte: ",
    en: (v, f) => "No item above " + f.pr(v.schwelle) + " of the damage; the largest: ",
  },
  "analysis.e.kopf.quelle.noteOhne": {
    de: (v) => "Keine Lücke, keine fehlenden Treffer" + (v.best ? ", kein Rückstand gegen den besten Pull." : "."),
    en: (v) => "No gap, no missing hits" + (v.best ? ", no deficit against your best pull." : "."),
  },
} satisfies Record<string, Wort>);

/* ---------- feste Texte der Seite (aus dem Entwurf E, woerter.mjs) ---------- */
Object.assign(W, {
  "analysis.e.ui.wahl": { de: "Beispielkampf", en: "Sample fight" },
  "analysis.e.ui.kopf.titel": { de: "Befund", en: "Finding" },
  "analysis.e.ui.kenn.dps": { de: "Schaden je Sekunde", en: "Damage per second" },
  "analysis.e.ui.kenn.dps.best": { de: "bester Pull {dps} ({dauer}), {q} darunter", en: "best pull {dps} ({dauer}), {q} below" },
  "analysis.e.ui.kenn.dps.selbst": { de: "dein bester Pull; der zweitbeste {dps} ({dauer})", en: "your best pull; second best {dps} ({dauer})" },
  "analysis.e.ui.kenn.dps.keiner": { de: "kein zweiter Pull an {ziel} in den Logs", en: "no second pull on {ziel} in the logs" },
  "analysis.e.ui.kenn.dauer": { de: "Dauer · Schaden", en: "Duration · damage" },
  "analysis.e.ui.kenn.dauer.n": { de: "{schaden} auf {ziel}", en: "{schaden} on {ziel}" },
  "analysis.e.ui.kenn.leerlauf": { de: "Leerlauf", en: "Idle" },
  "analysis.e.ui.kenn.leerlauf.n": { de: "{n} Lücken ab 2\u00a0s", en: "{n} gaps of 2\u00a0s or more" },
  "analysis.e.ui.kenn.leerlauf.keine": { de: "keine Lücke ab 2\u00a0s", en: "no gap of 2\u00a0s or more" },
  "analysis.e.ui.kenn.einsaetze": { de: "Gedrückte Einsätze", en: "Casts pressed" },
  "analysis.e.ui.kenn.einsaetze.n": { de: "je Minute, {n} im Kampf", en: "per minute, {n} in the fight" },
  "analysis.e.ui.kenn.krit": { de: "Kritisch", en: "Critical" },
  "analysis.e.ui.kenn.krit.n": { de: "der Treffer gedrückter Einsätze", en: "of hits from pressed casts" },
  "analysis.e.ui.dazu": { de: "Dazu", en: "Also" },
  "analysis.e.ui.zeit.titel": { de: "Zeitleiste", en: "Timeline" },
  "analysis.e.ui.zeit.wie": { de: "Schaden je Sekunde, 2\u00a0s geglättet. Zieh auf der Kurve einen Bereich auf, oder wähle eine Marke.", en: "Damage per second, smoothed over 2\u00a0s. Drag a range on the curve, or pick a marker." },
  "analysis.e.ui.zeit.von": { de: "Von", en: "From" },
  "analysis.e.ui.zeit.bis": { de: "bis", en: "to" },
  "analysis.e.ui.zeit.spitze": { de: "Stärkste 5\u00a0s", en: "Strongest 5\u00a0s" },
  "analysis.e.ui.zeit.luecke": { de: "Längste Lücke", en: "Longest gap" },
  "analysis.e.ui.zeit.ganz": { de: "Ganzer Kampf", en: "Whole fight" },
  "analysis.e.ui.zeit.jeSekunde": { de: "je Sekunde", en: "per second" },
  "analysis.e.ui.zeit.tasten": { de: "Tastatur: Tab auf die Kurve, ← → verschieben (mit Umschalt 5\u00a0s), Strg+← → Anfang, Alt+← → Ende, + − weiten und engen, Pos1 Ende, Esc hebt auf; Enter auf einer Marke oder Salve wählt ihre Strecke.", en: "Keyboard: Tab to the curve, ← → move (Shift: 5\u00a0s), Ctrl+← → start, Alt+← → end, + − widen and narrow, Home End, Esc clears; Enter on a marker or volley picks its range." },
  "analysis.e.ui.zeit.tabelle": { de: "Als Tabelle: Einsätze im Bereich", en: "As a table: casts in the range" },
  "analysis.e.ui.zeit.weitere": { de: "{n} weitere", en: "{n} more" },
  "analysis.e.ui.zeit.ticks": { de: "läuft von selbst", en: "runs by itself" },
  "analysis.e.ui.legende.kurve": { de: "Schaden je Sekunde", en: "Damage per second" },
  "analysis.e.ui.legende.geist": { de: "{wer} Pull, {dauer}", en: "{wer} pull, {dauer}" },
  "analysis.e.ui.legende.luecke": { de: "Lücke", en: "Gap" },
  // Weg von einem Befund der Liste in die Zeitleiste
  "analysis.e.ui.zeigen": { de: "In der Zeitleiste zeigen", en: "Show in the timeline" },
  "analysis.e.ui.zeigen.label": { de: (v) => "Die Strecke " + v.z + " in der Zeitleiste zeigen", en: (v) => "Show the stretch " + v.z + " in the timeline" },
  // was die Kurve zeigt, fuer den Vorleser: Luecken, unverwundbare Strecken, erkannte Mechanik, der Bezug
  "analysis.e.p.kurveBeschreibung": {
    de: (v) => "Schaden je Sekunde über " + v.dauer + ", " + (v.n === 0 ? "keine Lücken" : v.n === 1 ? "1 Lücke: " + v.liste : v.n + " Lücken: " + v.liste) + (v.geist || "") + (v.unv ? "; Ziel unverwundbar " + v.unv : "") + (v.mech ? "; Mechanik " + v.mech : ""),
    en: (v) => "Damage per second over " + v.dauer + ", " + (v.n === 0 ? "no gaps" : v.n === 1 ? "1 gap: " + v.liste : v.n + " gaps: " + v.liste) + (v.geist || "") + (v.unv ? "; target invulnerable " + v.unv : "") + (v.mech ? "; mechanic " + v.mech : ""),
  },
  "analysis.e.ui.legende.bereich": { de: "gewählter Bereich", en: "selected range" },
  "analysis.e.ui.legende.kerbe": { de: "Einsätze der gewählten Fähigkeit", en: "casts of the chosen skill" },
  "analysis.e.ui.legende.hitze": { de: "normal, stark, kritisch, kritisch stark (Hitze eines Einsatzes, ab 50\u00a0% seiner Treffer)", en: "normal, heavy, critical, critical heavy (heat of a cast, from 50\u00a0% of its hits)" },
  "analysis.e.ui.marke.spitze": { de: "Stärkste 5\u00a0s", en: "Strongest 5\u00a0s" },
  "analysis.e.ui.marke.luecke": { de: "Lücke {s}", en: "Gap {s}" },
  "analysis.e.ui.marke.stelle": { de: "Schwächste Stelle", en: "Weakest stretch" },
  "analysis.e.ui.marke.einsatz": { de: "Stärkster Einsatz", en: "Strongest cast" },
  "analysis.e.ui.marke.ziel": { de: "Zielwechsel", en: "Target switch" },
  "analysis.e.ui.marke.ziele": { de: "{n} Zielwechsel", en: "{n} target switches" },
  "analysis.e.ui.marke.unter": { de: "Salve unter Decke", en: "Volley below ceiling" },
  "analysis.e.ui.marke.unlesbar": { de: "Salve unlesbar", en: "Volley unreadable" },
  "analysis.e.ui.marke.salven": { de: "{n} Salven", en: "{n} volleys" },
  "analysis.e.ui.bereich.titel": { de: "Was hier ablief", en: "What happened here" },
  "analysis.e.ui.bereich.ganz": { de: "ganzer Kampf, {dauer}", en: "whole fight, {dauer}" },
  "analysis.e.ui.bereich.teil": { de: "{von}–{bis} · {dauer} · {zeit} der Zeit, {schaden} des Schadens", en: "{von}–{bis} · {dauer} · {zeit} of the time, {schaden} of the damage" },
  "analysis.e.ui.bereich.gut": { de: "Gut hier", en: "Good here" },
  "analysis.e.ui.bereich.besser": { de: "Besser möglich", en: "Room to gain" },
  "analysis.e.ui.bereich.nichts": { de: "Nichts, was auffällt.", en: "Nothing stands out." },
  "analysis.e.ui.kachel.dps": { de: "Je Sekunde", en: "Per second" },
  "analysis.e.ui.kachel.leerlauf": { de: "Leerlauf", en: "Idle" },
  "analysis.e.ui.kachel.einsaetze": { de: "Gedrückte Einsätze", en: "Casts pressed" },
  "analysis.e.ui.kachel.krit": { de: "Kritisch", en: "Critical" },
  "analysis.e.ui.kachel.ventius": { de: "Ventius-Treffer", en: "Ventius hits" },
  "analysis.e.ui.kachel.mischung": { de: "Mischung", en: "Mix" },
  "analysis.e.ui.skills.titel": { de: "Deine Fähigkeiten", en: "Your skills" },
  "analysis.e.ui.skills.stand": { de: "IDs je Name zusammengelegt", en: "ids merged by name" },
  "analysis.e.ui.check.titel": { de: "Checkliste", en: "Checklist" },
  "analysis.e.ui.opener.titel": { de: "Opener, die ersten {s} s", en: "Opener, the first {s} s" },
  "analysis.e.ui.opener.hier": { de: "dieser Pull", en: "this pull" },
  "analysis.e.ui.opener.dort": { de: "bester Pull", en: "best pull" },
  "analysis.e.ui.opener.keiner": { de: "kein zweiter Pull am selben Gegner", en: "no second pull on this enemy" },
  "analysis.e.ui.karte.einsaetze": { de: "Einsätze", en: "Casts" },
  "analysis.e.ui.karte.je": { de: "je Einsatz", en: "per cast" },
  "analysis.e.ui.karte.treffer": { de: "Treffer je Einsatz", en: "Hits per cast" },
  "analysis.e.ui.karte.hitze": { de: "Kritisch · stark", en: "Critical · heavy" },
  "analysis.e.ui.karte.takt": { de: "Takt (geschätzt)", en: "Cadence (estimated)" },
  "analysis.e.ui.karte.bereit": { de: "Bereit, nicht gedrückt", en: "Ready, not pressed" },
  "analysis.e.ui.karte.heben": { de: "Einsätze im Kampf zeigen", en: "Show casts in the fight" },
  "analysis.e.ui.ventius.titel": { de: "Auge von Ventius", en: "Eye of Ventius" },
  "analysis.e.ui.ventius.auf": { de: "Salven und Stufen", en: "Volleys and tiers" },
  "analysis.e.ui.ventius.moeglich": { de: "Treffer möglich", en: "Hits possible" },
  "analysis.e.ui.ventius.getroffen": { de: "getroffen", en: "landed" },
  "analysis.e.ui.ventius.gefehlt": { de: "gefehlt", en: "missed" },
  "analysis.e.ui.info.einsaetze": { de: "{n} Einsätze", en: "{n} casts" },
  "analysis.e.ui.info.salven": { de: "{n} Salven", en: "{n} volleys" },
  "analysis.e.ui.info.imBereich": { de: "im Bereich", en: "in the range" },
  "analysis.e.ui.info.anteil": { de: "{q} des Schadens", en: "{q} of the damage" },
  "analysis.e.ui.info.je": { de: "je Einsatz {dmg}", en: "per cast {dmg}" },
  "analysis.e.ui.info.takt": { de: "Takt etwa {s}", en: "cadence about {s}" },
  "analysis.e.ui.info.waehlen": { de: "Klick zeigt die Einsätze als Kerben an der Kurve", en: "click shows the casts as notches on the curve" },
  "analysis.e.ui.info.abwaehlen": { de: "gewählt; Klick oder Esc nimmt es zurück", en: "chosen; click or Esc clears it" },
  "analysis.e.ui.bahn.hinweis": { de: "Zeig auf eine Fähigkeit für ihre Zahlen. Klick oder Enter auf Bahn, Name oder Karte wählt sie: ihre Einsätze stehen dann als goldene Kerben am Fuß der Kurve, die anderen Bahnen treten zurück.", en: "Point at a skill for its numbers. Click or Enter on a lane, name or card picks it: its casts then sit as gold notches at the foot of the curve, the other lanes step back." },
  "analysis.e.ui.bahn.gewaehlt": { de: "Gewählt: {name}, {n} Einsätze als goldene Kerben am Fuß der Kurve. Noch ein Klick oder Esc nimmt die Wahl zurück.", en: "Chosen: {name}, {n} casts as gold notches at the foot of the curve. Click again or press Esc to clear." },
  "analysis.e.ui.bahn.abgewaehlt": { de: "Keine Fähigkeit gewählt.", en: "No skill chosen." },
  "analysis.e.ui.karte.wahl": { de: "Klick auf den Namen: Einsätze an der Kurve zeigen", en: "Click the name: show casts on the curve" },
  "analysis.e.ui.karte.gewaehlt": { de: "Gewählt: Einsätze als Kerben an der Kurve · Esc nimmt zurück", en: "Chosen: casts as notches on the curve · Esc clears" },
  "analysis.e.ui.legende.vent": { de: "Ventius-Salve: je Punkt ein Nachbeben (3 Treffer), hohl = fehlte", en: "Ventius volley: one dot per aftershock (3 hits), hollow = missing" },
  "analysis.e.ui.ventius.formel": { de: "1 + 3 × {d} Nachbeben", en: "1 + 3 × {d} aftershocks" },
  "analysis.e.ui.ventius.satz": { de: "Eine Salve = 1 Treffer (Öffner) + 3 Treffer je Nachbeben; ein Punkt ist ein Nachbeben, nicht ein Treffer. An der Decke ({d} Nachbeben) sind das {soll} Treffer.", en: "One volley = 1 hit (opener) + 3 hits per aftershock; a dot is an aftershock, not a hit. At the ceiling ({d} aftershocks) that is {soll} hits." },
  "analysis.e.ui.ventius.decke.selbst": { de: "Die Decke stammt aus deinen eigenen Salven: die meisten Nachbeben, die du an {ziel} erreicht hast, in diesem Kampf {d}, über alle deine Logs {gegner}. Kein Spielwert, was das Spiel zulässt, sagt das Log nicht.", en: "The ceiling comes from your own volleys: the most aftershocks you reached on {ziel}, {d} in this fight, {gegner} across all your logs. Not a game value; what the game allows, the log does not say." },
  "analysis.e.ui.ventius.decke.gegner": { de: "In diesem Kampf höchstens {top} Nachbeben; an {ziel} hast du schon {d} erreicht (über alle deine Logs), gerechnet wird gegen {d}. Kein Spielwert, was das Spiel zulässt, sagt das Log nicht.", en: "At most {top} aftershocks in this fight; on {ziel} you already reached {d} (across all your logs), so the count runs against {d}. Not a game value; what the game allows, the log does not say." },
  "analysis.e.ui.ventius.l.oeffner": { de: "Öffner, 1 Treffer", en: "opener, 1 hit" },
  "analysis.e.ui.ventius.l.punkt": { de: "Nachbeben, 3 Treffer", en: "aftershock, 3 hits" },
  "analysis.e.ui.ventius.l.hohl": { de: "Nachbeben fehlte", en: "aftershock missing" },
  "analysis.e.ui.ventius.l.ring": { de: "unter der Decke", en: "below the ceiling" },
  "analysis.e.ui.ventius.l.tot": { de: "nicht lesbar", en: "unreadable" },
  "analysis.e.ui.ventius.l.zahl": { de: "Treffer der Salve", en: "hits of the volley" },
  "analysis.e.ui.ventius.raster": { de: "Eine Säule je Salve, in Zeitfolge: unten der Öffner, darüber je Nachbeben ein Punkt bis zur Decke, darunter die Treffer der Salve. Außerhalb des Bereichs abgeblendet.", en: "One column per volley, in time order: the opener at the bottom, above it one dot per aftershock up to the ceiling, below it the volley's hits. Dimmed outside the range." },
  "analysis.e.ui.opener.liste": { de: "Folge als Liste", en: "Sequence as a list" },
  "analysis.e.ui.opener.l.bild": { de: "Symbol der Fähigkeit", en: "skill icon" },
  "analysis.e.ui.opener.l.mono": { de: "Anfangsbuchstaben (ohne Spielbilder)", en: "initials (without game images)" },
  "analysis.e.ui.opener.l.vent": { de: "Bernstein = Auge von Ventius", en: "amber = Eye of Ventius" },
  "analysis.e.ui.opener.l.krit": { de: "goldener Fuß = kritisch", en: "gold foot = critical" },
  "analysis.e.ui.passiv.titel": { de: "Passiv", en: "Passive" },
  "analysis.e.ui.fuss.takt": { de: "Takt (geschätzt) ist das 20. Perzentil deiner eigenen Abstände zwischen zwei Einsätzen, aus diesem und dem besten Pull; das Log kennt keine Abklingzeit. Treffer je Einsatz: Median gegen das Maximum, das du selbst je Einsatz erreicht hast; bei Kanälen und mehrteiligen Fähigkeiten steht keins.", en: "Cadence (estimated) is the 20th percentile of your own intervals between two casts, from this and your best pull; the log knows no cooldowns. Hits per cast: median against the maximum you reached yourself per cast; channels and multi-part skills show none." },
} satisfies Record<string, Wort>);

/* ---------- Texte der Seitenteile 79 und 80 (Zeitleiste, Pruefstand) ---------- */
const pl = (n: number, eins: string, viele: string) => n + NBSP + (n === 1 ? eins : viele);
Object.assign(W, {
  "analysis.e.p.hz0": { de: "normal", en: "normal" },
  "analysis.e.p.hz1": { de: "stark", en: "heavy" },
  "analysis.e.p.hz2": { de: "kritisch", en: "critical" },
  "analysis.e.p.hz3": { de: "kritisch stark", en: "critical heavy" },
  "analysis.e.p.bester": { de: "bester", en: "best" },
  "analysis.e.p.zweitbester": { de: "zweitbester", en: "second-best" },
  "analysis.e.p.besterN": { de: "besten", en: "best" },
  "analysis.e.p.zweitbesterN": { de: "zweitbesten", en: "second-best" },
  "analysis.e.p.vonLabel": { de: "Bereich von, Minuten und Sekunden", en: "Range from, minutes and seconds" },
  "analysis.e.p.bisLabel": { de: "Bereich bis, Minuten und Sekunden", en: "Range to, minutes and seconds" },
  "analysis.e.p.bereichswahl": { de: "Bereichswahl", en: "range selection" },
  "analysis.e.p.markenGruppe": { de: "Ereignisse im Kampf", en: "Events in the fight" },
  "analysis.e.p.markeUnter": { de: " unter Decke", en: " below ceiling" },
  "analysis.e.p.markeUnles": { de: " unlesbar", en: " unreadable" },
  "analysis.e.p.markeBeides": { de: (v) => ", " + v.u + " unter Decke, " + v.l + " unlesbar", en: (v) => ", " + v.u + " below ceiling, " + v.l + " unreadable" },
  "analysis.e.p.bahnName": { de: (v) => v.name + ", " + v.q + " des Schadens", en: (v) => v.name + ", " + v.q + " of the damage" },
  "analysis.e.p.bahnLabel": {
    de: (v) => v.name + ": " + v.n + " Einsätze als Striche über die Kampfzeit, Höhe = Schaden, Farbe = Hitze",
    en: (v) => v.name + ": " + v.n + " casts as strokes over the fight, height = damage, colour = heat",
  },
  "analysis.e.p.ventBahn": {
    de: (v) => "Auge von Ventius: " + v.n + " Salven als Perlen über die Kampfzeit, je Punkt ein Nachbeben (3 Treffer), " + v.unter + " unter der Decke, " + v.unles + " nicht lesbar; Einzelheiten in der Karte Auge von Ventius",
    en: (v) => "Eye of Ventius: " + v.n + " volleys as pearls over the fight, one dot per aftershock (3 hits), " + v.unter + " below the ceiling, " + v.unles + " unreadable; details in the Eye of Ventius card",
  },
  "analysis.e.p.treffer": { de: (v) => v.n + " Treffer", en: (v) => v.n + (v.n === 1 ? " hit" : " hits") },
  "analysis.e.p.legGeist": { de: (v) => v.wer + " Pull, " + v.dauer, en: (v) => v.wer + " pull, " + v.dauer },
  "analysis.e.p.salveUnlesbar": {
    de: (v) => "nicht lesbar (" + v.grund + "), Wellen " + v.wellen + ", " + v.n + " Treffer",
    en: (v) => "unreadable (" + v.grund + "), waves " + v.wellen + ", " + v.n + " hits",
  },
  "analysis.e.p.salveEnde": {
    de: (v) => "am Kampfende, " + v.n + " von " + v.soll + " Treffern (zählt nicht als fehlend)",
    en: (v) => "at the end of the fight, " + v.n + " of " + v.soll + " hits (not counted as missing)",
  },
  "analysis.e.p.salveNb": {
    de: (v) => (v.nur ? "nur Öffner, " : v.nb + " Nachbeben, ") + v.n + " von " + v.soll + " Treffern" + (v.fehlt ? ", " + v.fehlt + " fehlen" : ""),
    en: (v) => (v.nur ? "opener only, " : v.nb + " aftershocks, ") + v.n + " of " + v.soll + " hits" + (v.fehlt ? ", " + v.fehlt + " missing" : ""),
  },
  "analysis.e.p.salveNr": { de: (v) => "Salve " + v.i, en: (v) => "Volley " + v.i },
  "analysis.e.p.fokusLabel": {
    de: (v) => "Schaden je Sekunde über " + v.dauer + "; Bereich: " + v.bereich + ". Pfeiltasten wählen, Escape hebt auf.",
    en: (v) => "Damage per second over " + v.dauer + "; range: " + v.bereich + ". Arrow keys select, Escape clears.",
  },
  "analysis.e.p.ganzerKampf": { de: "ganzer Kampf", en: "whole fight" },
  "analysis.e.p.derKampf": { de: "der Kampf", en: "the fight" },
  "analysis.e.p.zumKampf": { de: (v) => v.v + " zum Kampf", en: (v) => v.v + " against the fight" },
  "analysis.e.p.zumBest": { de: (v) => v.v + " zum " + v.wer + " Pull", en: (v) => v.v + " against your " + v.wer + " pull" },
  "analysis.e.p.keineLuecke": { de: "keine Lücke", en: "no gap" },
  "analysis.e.p.jeMinute": { de: (v) => v.n + " je Minute", en: (v) => v.n + " per minute" },
  "analysis.e.p.kampfMinute": { de: (v) => "Kampf " + v.n, en: (v) => "fight " + v.n },
  "analysis.e.p.kritBasis": { de: "der Treffer gedrückter Einsätze", en: "of the hits of pressed casts" },
  "analysis.e.p.kritKampf": { de: (v) => "Kampf " + v.q, en: (v) => "fight " + v.q },
  "analysis.e.p.ventKachel": {
    de: (v) => v.lesbar + " lesbare Salven × " + v.soll + " Treffer (" + v.formel + "), " + v.anDecke + " an der Decke",
    en: (v) => v.lesbar + " readable volleys × " + v.soll + " hits (" + v.formel + "), " + v.anDecke + " at the ceiling",
  },
  "analysis.e.p.tippFehler": {
    de: (v) => "Von und bis als Minuten:Sekunden, bis nach von, innerhalb von " + v.dauer + ".",
    en: (v) => "From and to as minutes:seconds, to after from, within " + v.dauer + ".",
  },
  "analysis.e.p.leseSekunde": { de: (v) => v.dmg + " in dieser Sekunde", en: (v) => v.dmg + " in this second" },
  "analysis.e.p.leseBest": { de: (v) => v.wer + " Pull " + v.dmg, en: (v) => v.wer + " pull " + v.dmg },
  "analysis.e.p.tZeit": { de: "Zeit", en: "Time" },
  "analysis.e.p.tFaehigkeit": { de: "Fähigkeit", en: "Skill" },
  "analysis.e.p.tSchaden": { de: "Schaden", en: "Damage" },
  "analysis.e.p.tTreffer": { de: "Treffer", en: "Hits" },
  "analysis.e.p.tHitze": { de: "Hitze", en: "Heat" },
  "analysis.e.p.tWeitere": { de: (v) => "… " + v.n + " weitere", en: (v) => "… " + v.n + " more" },
  "analysis.e.p.spiegel": { de: (v) => "Spiegel: " + v.wer + " Pull", en: (v) => "Mirror: " + v.wer + " pull" },
  "analysis.e.p.nEinsaetze": { de: (v) => v.n + " Einsätze", en: (v) => v.n + (v.n === 1 ? " cast" : " casts") },
  "analysis.e.p.openerLabel": { de: "Was der Opener zeigt", en: "What the opener shows" },
  "analysis.e.p.dieserPull": { de: "dieser Pull", en: "this pull" },
  "analysis.e.p.bereitTitel": { de: (v) => "bereit (geschätzt), nicht gedrückt: " + v.s, en: (v) => "ready (estimated), not pressed: " + v.s },
  "analysis.e.p.kTreffer": {
    de: (v) => v.n + " Treffer weniger als bei vollen Einsätzen (" + v.max + " je Einsatz). Warum ein Einsatz weniger traf, sagt das Log nicht.",
    en: (v) => v.n + " fewer hits than in complete casts (" + v.max + " per cast). Why a cast hit less, the log does not say.",
  },
  "analysis.e.p.kBereit": {
    de: (v) => v.sek + " lag der Knopf nach dem geschätzten Takt (" + v.cd + ") bereit, ohne Druck" + (v.mehr >= 2 ? ": bis zu " + v.mehr + " Einsätze mehr." : "."),
    en: (v) => "The button sat ready for " + v.sek + " after the estimated rhythm (" + v.cd + "), unpressed" + (v.mehr >= 2 ? ": up to " + v.mehr + " more casts." : "."),
  },
  "analysis.e.p.kWeniger": {
    de: (v) => "Im " + v.werN + " Pull " + v.dort + " Einsätze in denselben Sekunden, hier " + v.hier + ".",
    en: (v) => "In your " + v.werN + " pull " + v.dort + " casts in the same seconds, here " + v.hier + ".",
  },
  "analysis.e.p.kJe": {
    de: (v) => "Je Einsatz " + v.hier + ", im " + v.werN + " Pull " + v.dort + ". Kritisch und stark hängen an Buffs, die das Log nicht kennt.",
    en: (v) => "Per cast " + v.hier + ", " + v.dort + " in your " + v.werN + " pull. Crit and heavy depend on buffs the log does not know.",
  },
  "analysis.e.p.kKein": { de: "Kein Einsatz im Bereich.", en: "No cast in the range." },
  "analysis.e.p.streifenLabel": {
    de: (v) => v.n + " Einsätze im Bereich als Striche, Höhe = Schaden, Farbe = Hitze" + (v.cd ? "; schraffiert: bereit nach dem geschätzten Takt" : ""),
    en: (v) => v.n + " casts in the range as strokes, height = damage, colour = heat" + (v.cd ? "; hatched: ready after the estimated rhythm" : ""),
  },
  "analysis.e.p.salven": { de: "Salven", en: "Volleys" },
  "analysis.e.p.kanaele": { de: "Kanäle", en: "Channels" },
  "analysis.e.p.imKampf": { de: (v) => v.n + " im Kampf", en: (v) => v.n + " in the fight" },
  "analysis.e.p.imBest": { de: (v) => v.n + " im " + v.werN + " Pull", en: (v) => v.n + " in your " + v.werN + " pull" },
  "analysis.e.p.jeMinuteBest": { de: (v) => v.n + " je Minute im " + v.werN, en: (v) => v.n + " per minute in your " + v.werN },
  "analysis.e.p.jeMinuteHier": {
    de: (v) => v.n + " je Minute" + (v.ids ? ", " + v.ids + " IDs" : ""),
    en: (v) => v.n + " per minute" + (v.ids ? ", " + v.ids + " IDs" : ""),
  },
  "analysis.e.p.jeSalve": { de: "je Salve", en: "per volley" },
  "analysis.e.p.jeKanal": { de: "je Kanal", en: "per channel" },
  "analysis.e.p.spanne": { de: (v) => v.von + " bis " + v.bis, en: (v) => v.von + " to " + v.bis },
  "analysis.e.p.trefferSalve": { de: "Treffer je Salve", en: "Hits per volley" },
  "analysis.e.p.fehlen": { de: (v) => v.n + " fehlen", en: (v) => v.n + " missing" },
  "analysis.e.p.medianVoll": { de: "Median / voll", en: "median / complete" },
  "analysis.e.p.kanalOhneDecke": { de: "Ticks je Kanal, keine Decke", en: "ticks per channel, no ceiling" },
  "analysis.e.p.mehrteilig": { de: "mehrteilig, keine Decke", en: "multi-part, no ceiling" },
  "analysis.e.p.bisOhneDecke": { de: (v) => "bis " + v.max + ", keine Decke", en: (v) => "up to " + v.max + ", no ceiling" },
  "analysis.e.p.keinMax": { de: "kein festes Maximum", en: "no fixed maximum" },
  "analysis.e.p.kritBest": { de: (v) => v.wer + " " + v.q + " kritisch", en: (v) => v.wer + " " + v.q + " critical" },
  "analysis.e.p.salvenAbstand": { de: "Abstand der Salven", en: "Gap between volleys" },
  "analysis.e.p.abstandP10": {
    de: (v) => "kürzester üblicher " + v.s + ", " + v.n + " je Minute",
    en: (v) => "shortest usual " + v.s + ", " + v.n + " per minute",
  },
  "analysis.e.p.genutzt": { de: (v) => v.q + " genutzt", en: (v) => v.q + " used" },
  "analysis.e.p.zuWenige": { de: "zu wenige Einsätze", en: "too few casts" },
  "analysis.e.p.keinTakt": { de: "kein Takt lesbar", en: "no rhythm readable" },
  "analysis.e.p.bisZu": {
    de: (v) => "bis zu " + v.n + (v.n === 1 ? " Einsatz" : " Einsätze") + " mehr",
    en: (v) => "up to " + v.n + " more " + (v.n === 1 ? "cast" : "casts"),
  },
  "analysis.e.p.nachTakt": { de: "nach dem geschätzten Takt", en: "after the estimated rhythm" },
  "analysis.e.p.ticks": {
    de: (v) => "Läuft von selbst, nicht als Einsatz gezählt: " + v.liste + ". Eine Zahl je Treffer und je Sekunde, keine Reihenfolge; Takt erkannt am Sekundenabstand.",
    en: (v) => "Runs by itself, not counted as a cast: " + v.liste + ". One figure per hit and per second, no order; rhythm recognised by the one-second gap.",
  },
  "analysis.e.p.ventStand": {
    de: (v) => "Decke " + v.d + " Nachbeben = " + v.soll + " Treffer je Salve (aus deinen eigenen Salven)" + (v.nie ? ", in diesem Kampf nie erreicht (" + v.top + ")" : ""),
    en: (v) => "ceiling " + v.d + " aftershocks = " + v.soll + " hits per volley (from your own volleys)" + (v.nie ? ", never reached in this fight (" + v.top + ")" : ""),
  },
  "analysis.e.p.ventSalven": {
    de: (v) => pl(v.n, "Salve", "Salven") + (v.ganz ? " im Kampf" : " im Bereich"),
    en: (v) => pl(v.n, "volley", "volleys") + (v.ganz ? " in the fight" : " in the range"),
  },
  "analysis.e.p.ventZaehlung": {
    de: (v) => v.lesbar + " lesbar, " + v.anDecke + " an der Decke, " + v.unter + " darunter, " + v.unles + " nicht lesbar" + (v.ende ? ", " + v.ende + " am Kampfende" : "") + ".",
    en: (v) => v.lesbar + " readable, " + v.anDecke + " at the ceiling, " + v.unter + " below, " + v.unles + " unreadable" + (v.ende ? ", " + v.ende + " at the end of the fight" : "") + ".",
  },
  "analysis.e.p.ventGefehlt": {
    de: (v) => pl(v.unter, "Salve blieb", "Salven blieben") + " unter der Decke: " + v.gefehlt + " Treffer fehlen, etwa " + v.verlust + " (je Treffer der Median an der Decke, " + v.je + ").",
    en: (v) => pl(v.unter, "volley stayed", "volleys stayed") + " below the ceiling: " + v.gefehlt + " hits missing, about " + v.verlust + " (each hit valued at the median at the ceiling, " + v.je + ").",
  },
  "analysis.e.p.ventVs": {
    de: (v) => "Im " + v.werN + " Pull " + v.anDort + " von " + v.lesbarDort + " lesbaren Salven an der Decke, hier " + v.anHier + " von " + v.lesbarHier + ".",
    en: (v) => "In your " + v.werN + " pull " + v.anDort + " of " + v.lesbarDort + " readable volleys were at the ceiling, here " + v.anHier + " of " + v.lesbarHier + ".",
  },
  "analysis.e.p.ventVsKeine": {
    de: "Der gespeicherte Pull kennt die Salven noch nicht; ab dem nächsten besten Pull ja.",
    en: "The saved pull does not know the volleys yet; from your next best pull on it does.",
  },
  "analysis.e.p.ventAlleDecke": { de: "Jede lesbare Salve an der Decke.", en: "Every readable volley at the ceiling." },
  "analysis.e.p.ventKeine": { de: "Keine lesbare Salve im Bereich.", en: "No readable volley in the range." },
  "analysis.e.p.ventNie": {
    de: (v) => "An " + v.ziel + " sind schon " + v.d + " Nachbeben gefallen; gerechnet wird gegen diese Decke.",
    en: (v) => "On " + v.ziel + " you already reached " + v.d + " aftershocks; the count runs against that ceiling.",
  },
  "analysis.e.p.rasterLabel": { de: "Salven in Zeitfolge, Enter wählt die Strecke um eine Salve", en: "Volleys in time order, Enter selects the range around a volley" },
  "analysis.e.p.stNachbeben": { de: "Nachbeben", en: "Aftershocks" },
  "analysis.e.p.stSalven": { de: "Salven", en: "Volleys" },
  "analysis.e.p.stTreffer": { de: "Treffer je Salve", en: "Hits per volley" },
  "analysis.e.p.stSchaden": { de: "Schaden je Salve", en: "Damage per volley" },
  "analysis.e.p.stDecke": { de: "(Decke)", en: "(ceiling)" },
  "analysis.e.p.stUnlesbar": { de: "nicht lesbar", en: "unreadable" },
  "analysis.e.p.ventForm": {
    de: "Lesbar ist eine Salve mit der Form 1 + 3·N (ein Öffner, dann Wellen zu drei). Nur Öffner zählt als lesbar mit 0 Nachbeben; ob kein Nachbeben kam oder die Salve abbrach, sagt das Log nicht. Doppelsalve: ein zweiter Öffner im 1,2-s-Fenster; Mehrziel-Welle: eine Welle über drei Treffer; Teilwelle: eine Welle mit ein oder zwei Treffern. Eine Salve am Kampfende zählt nicht als fehlend. Was die Decke im Spiel setzt, sagt das Log nicht.",
    en: "A volley is readable when it has the shape 1 + 3·N (one opener, then waves of three). Opener only counts as readable with 0 aftershocks; whether none came or the volley broke off, the log does not say. Double volley: a second opener within the 1.2-s window; multi-target wave: a wave of more than three hits; partial wave: a wave of one or two hits. A volley at the end of the fight does not count as missing. What sets the ceiling in the game, the log does not say.",
  },
} satisfies Record<string, Wort>);

/* ---------- Ausgabe ---------- */
function ziehen(sprache: "de" | "en"): Record<string, I18nEntry> {
  const f = sprache === "de" ? FORMATE_DE : FORMATE_EN;
  const out: Record<string, I18nEntry> = {};
  for (const [k, w] of Object.entries(W)) {
    const e = w[sprache];
    out[k] = typeof e === "string" ? e : (v: I18nVars) => e(v, f);
  }
  return out;
}
export const ANALYSE_DE = ziehen("de");
export const ANALYSE_EN = ziehen("en");
