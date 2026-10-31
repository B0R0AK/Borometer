// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* ---------- Gilde: die Punkte, der reine Kern (Spezifikation 2026-10-11-gilde-punkte-design.md, 2) ----------
   Ohne Seite, ohne Netz und ohne Uhr: "heute" und "jetzt" kommen immer als Parameter, alle Zeiten sind
   Wanduhr-Zeichenketten ("YYYY-MM-DD", "YYYY-MM-DDTHH:mm"), gerechnet wird mit UTC-Tagen, damit Zeitzone und
   Sommerzeit nichts aendern. Summe = Monate + Termine + Gildenansehen + Zusatz, auf zwei Stellen. */

import { termine, terminSchluessel } from "./gilde-core";
import type { Art, Gilde, Mitglied, MitgliedPunkte, Pause, PunkteRegeln } from "./gilde-core";

/** Hoechstens so viele Monate werden gezaehlt, damit eine verirrte Eingabe nie haengt. */
const MAX_MONATE = 1200;
const r2 = (x: number) => Math.round(x * 100) / 100;
const tagStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Die vier Arten ab Werk: der Gildenboss zaehlt 7 Teilnahmen (die sieben Bosse der Woche) als einen Punkt, die Raids je einen. */
export const STANDARD_ARTEN: Art[] = [
  { id: "aboss00001", name: "Gildenboss", punkte: 1, proPunkt: 7 },
  { id: "anorm00001", name: "Raid Normal", punkte: 1, proPunkt: 1 },
  { id: "aschw00001", name: "Raid Schwer", punkte: 1, proPunkt: 1 },
  { id: "aalpt00001", name: "Raid Alptraum", punkte: 1, proPunkt: 1 },
];
export const STANDARD_REGELN: Omit<PunkteRegeln, "stichtag" | "arten"> =
  { an: false, rang: false, gruppen: false, schwellen: [80, 60], monat: 1, teiler: 100000 };

/** Der Tag nach k Monaten; faellt er nicht in den Monat (31. Januar plus ein Monat), gilt der letzte Tag des Monats. */
export function monatTag(seit: string, k: number): string {
  const j = +seit.slice(0, 4), mo = +seit.slice(5, 7) - 1, t = +seit.slice(8, 10);
  const ziel = new Date(Date.UTC(j, mo + k, 1));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate();
  return tagStr(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth(), Math.min(t, letzter)));
}

/** War jemand an diesem Tag inaktiv? Der Zeitraum gilt ab "von" und bis ausschliesslich "bis"; ohne "bis" ist er offen. */
export function inaktivAm(pausen: Pause[], tag: string): boolean {
  return pausen.some((p) => tag >= p.von && (p.bis === undefined || tag < p.bis));
}

/** Steht das Mitglied an diesem Tag auf der Liste (nicht geloest, nicht inaktiv)? Die Haken davor bleiben und zaehlen. */
export function aufListe(m: Mitglied, tag: string): boolean {
  return !m.geloest && !(m.punkte && inaktivAm(m.punkte.pausen, tag));
}

/** Volle Monate seit "seit", ohne die Monatstage in Inaktiv-Zeiten; davon geht der Abzug (inaktive Monate aus der Zeit vor Borometer) ab, nie unter 0. */
export function aktiveMonate(p: { seit: string; pausen: Pause[]; abzugMonate?: number }, heute: string): { roh: number; monate: number } {
  let roh = 0;
  for (let k = 1; k <= MAX_MONATE; k++) {
    const t = monatTag(p.seit, k);
    if (t > heute) break;
    if (!inaktivAm(p.pausen, t)) roh++;
  }
  return { roh, monate: Math.max(0, roh - Math.max(0, p.abzugMonate ?? 0)) };
}

/** Teilnahmen eines Mitglieds an den Events dieser Art: nur vergangene, nicht ausgefallene Termine ab dem Stichtag, nicht an Tagen,
    an denen es inaktiv war. Bei mehr als einer Teilnahme je Punkt zaehlt der Zaehler des Termins (hoechstens proPunkt), sonst "da" als eine. */
export function teilnahmen(g: Gilde, m: Mitglied, art: Art, jetzt: string): number {
  const stichtag = g.punkte?.stichtag ?? "0000-00-00", heute = jetzt.slice(0, 10), pausen = m.punkte?.pausen ?? [];
  let n = 0;
  for (const r of g.reihen) {
    if (r.geloest || r.art !== art.id) continue;
    const erster = r.start.slice(0, 10), von = erster > stichtag ? erster : stichtag;
    for (const t of termine(r, von, heute)) {
      if (t.aus || t.start > jetzt || inaktivAm(pausen, t.datum)) continue;
      const key = terminSchluessel(t);
      if (art.proPunkt > 1) n += Math.min(art.proPunkt, Math.max(0, g.zaehler?.[key]?.[m.id] ?? 0));
      else if (g.anwesend[key]?.[m.id] === "da") n += 1;
    }
  }
  return n;
}

export interface Konto {
  m: Mitglied;
  /** Monate vor dem Abzug, der Abzug und die Monate danach */
  roh: number; abzug: number; monate: number;
  /** je Art (nicht geloest): Teilnahmen (Startstand plus Termine) und Punkte */
  zaehl: Record<string, number>; pkt: Record<string, number>;
  ansehen: number; zusatz: number;
  teile: { monate: number; termine: number; ansehen: number; zusatz: number };
  summe: number; pausiert: boolean;
  /** nur Aktive haben Rang und Gruppe */
  rang: number | null; gruppe: "" | "Spitze" | "Mitte" | "Ende";
}

const leerePunkte = (heute: string): MitgliedPunkte => ({ seit: heute, pausen: [], start: {}, ansehen: { start: 0, eintraege: [] }, zusatz: [] });

/** Das Konto eines Mitglieds: woher jeder Punkt kommt. Rang und Gruppe setzt erst rangliste. */
export function konto(g: Gilde, m: Mitglied, jetzt: string): Konto {
  const heute = jetzt.slice(0, 10), p = m.punkte ?? leerePunkte(heute);
  const regeln = g.punkte ?? { ...STANDARD_REGELN, stichtag: heute, arten: [] };
  const { roh, monate } = aktiveMonate(p, heute);
  const zaehl: Record<string, number> = {}, pkt: Record<string, number> = {};
  let termineSumme = 0;
  for (const a of regeln.arten) {
    if (a.geloest) continue;
    zaehl[a.id] = (p.start[a.id] ?? 0) + teilnahmen(g, m, a, jetzt);
    pkt[a.id] = zaehl[a.id]! / a.proPunkt * a.punkte;
    termineSumme += pkt[a.id]!;
  }
  const gesamtAnsehen = p.ansehen.start + p.ansehen.eintraege.reduce((s, e) => s + (e.geloest ? 0 : e.betrag), 0);
  const ansehen = r2(gesamtAnsehen / regeln.teiler);
  const zusatz = p.zusatz.reduce((s, z) => s + (z.geloest ? 0 : z.punkte), 0);
  const teile = { monate: monate * regeln.monat, termine: termineSumme, ansehen, zusatz };
  return { m, roh, abzug: roh - monate, monate, zaehl, pkt, ansehen, zusatz, teile,
    summe: r2(teile.monate + teile.termine + teile.ansehen + teile.zusatz), pausiert: p.pausen.some((q) => q.bis === undefined), rang: null, gruppe: "" };
}

/** Alle Konten: die Aktiven nach Summe (bei Gleichstand nach Name, gleiche Summe gleicher Rang, Gruppe nach den Schwellen), danach die Inaktiven ohne Rang. */
export function rangliste(g: Gilde, jetzt: string): Konto[] {
  const alle = g.mitglieder.filter((x) => !x.geloest).map((x) => konto(g, x, jetzt));
  const nach = (a: Konto, b: Konto) => b.summe - a.summe || (a.m.name < b.m.name ? -1 : a.m.name > b.m.name ? 1 : 0);
  const akt = alle.filter((x) => !x.pausiert).sort(nach), ina = alle.filter((x) => x.pausiert).sort(nach);
  const [spitze, mitte] = g.punkte?.schwellen ?? STANDARD_REGELN.schwellen;
  let rang = 0, vor: number | null = null;
  akt.forEach((x, i) => {
    if (x.summe !== vor) rang = i + 1;
    vor = x.summe;
    x.rang = rang;
    x.gruppe = x.summe >= spitze ? "Spitze" : x.summe >= mitte ? "Mitte" : "Ende";
  });
  return [...akt, ...ina];
}

export interface EinleseZeile { mitgliedId: string; seit?: string; offenePause: boolean; start: Record<string, number>; ansehenStart?: number }

/** Eine Zahl aus einer Tabelle: "1.234,5" (Komma ist die Dezimalstelle), "1.234" (Punkt ist Tausender), "1.5" oder "250000"; sonst 0. */
function zelle(s: string | undefined): number {
  const t = (s ?? "").replace(/\s/g, "");
  const z = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  const n = Number(z);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Zeilen aus einer Tabelle (Tabulator): Name, Mitglied seit (TT.MM.JJJJ), Pause (ja), Bosse, Raid Normal, Schwer, Alptraum, Ansehen.
    Die Zahlen der Arten sind Punkte der Tabelle und werden zu Teilnahmen (Punkte durch Punkte der Art mal Teilnahmen je Punkt).
    Nur Namen, die in der Gilde stehen (nicht geloest, ohne Gross-/Kleinschreibung); die anderen werden nur gezaehlt. */
export function tabelleEinlesen(text: string, g: Gilde): { zeilen: EinleseZeile[]; fremd: number } {
  const zeilen: EinleseZeile[] = [];
  let fremd = 0;
  const arten = g.punkte?.arten ?? STANDARD_ARTEN;
  for (const roh of text.split(/\r?\n/)) {
    if (!roh.trim()) continue;
    const s = roh.split("\t"), name = (s[0] ?? "").trim().toLowerCase();
    const m = g.mitglieder.find((x) => !x.geloest && x.name.toLowerCase() === name);
    if (!m) { fremd++; continue; }
    const d = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec((s[1] ?? "").trim());
    let seit: string | undefined;
    if (d) {
      const j = +d[3]!, mo = +d[2]!, t = +d[1]!, u = new Date(Date.UTC(j, mo - 1, t));
      if (u.getUTCFullYear() === j && u.getUTCMonth() === mo - 1 && u.getUTCDate() === t) seit = tagStr(u.getTime());
    }
    const z: EinleseZeile = { mitgliedId: m.id, ...(seit ? { seit } : {}), offenePause: /^(ja|x|1)$/i.test((s[2] ?? "").trim()), start: {} };
    STANDARD_ARTEN.forEach((std, i) => {
      const a = arten.find((x) => x.id === std.id && !x.geloest);
      if (a && a.punkte > 0) z.start[a.id] = r2(zelle(s[3 + i]) / a.punkte * a.proPunkt);
    });
    if (s[7] !== undefined && s[7].trim() !== "") z.ansehenStart = Math.round(zelle(s[7]));
    zeilen.push(z);
  }
  return { zeilen, fremd };
}

/** Die Worte der Textausgabe in der Seitensprache: kopf (etwa "Punkte"), inaktiv, die Zahl in der Schreibweise der Sprache und die Gruppe als Wort. */
export interface PunkteWorte { kopf: string; inaktiv: string; zahl: (n: number) => string; gruppe: (g: "Spitze" | "Mitte" | "Ende") => string }

/** Die Liste als Text zum Kopieren: Rang und Gruppe nur, wenn der Lead sie zugeschaltet hat; Inaktive am Ende mit Marke. */
export function punkteText(konten: Konto[], g: Gilde, w: PunkteWorte): string {
  const out = [[g.name, w.kopf].join(" · ")];
  for (const x of konten) {
    const teile = [(g.punkte?.rang && x.rang !== null ? x.rang + ". " : "") + x.m.name, w.zahl(x.summe)];
    if (g.punkte?.gruppen && x.gruppe) teile.push(w.gruppe(x.gruppe));
    if (x.pausiert) teile.push("[" + w.inaktiv + "]");
    out.push(teile.join(" · "));
  }
  return out.join("\n");
}
