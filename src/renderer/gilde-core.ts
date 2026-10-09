// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* ---------- Gilde: der reine Kern (Spezifikation 2026-10-06-gilde-design.md) ----------
   Ohne Seite und ohne Netz. Alle Zeiten sind Wanduhr-Zeichenketten
   ("YYYY-MM-DD", "YYYY-MM-DDTHH:mm"); gerechnet wird mit UTC-Tagen, damit
   Zeitzone und Sommerzeit nichts aendern: 20:00 bleibt 20:00. */

import { klasseVon } from "./klassen-core";

export type Rolle = "tank" | "heal" | "dps" | "";
export type Marke = "da" | "fehlt" | "entschuldigt" | "offen";
export interface Mitglied { id: string; name: string; rolle: Rolle; waffen: string[]; notiz: string; geloest?: boolean }
export interface Ausnahme { aus?: boolean; zeit?: string }
export interface Wdh { art: "einmal" | "woche" | "tage"; tage: number[]; bis?: string }
export interface Reihe {
  id: string; titel: string; start: string; zone: string; wdh: Wdh; dauerMin: number; erinnerungMin: number;
  ausnahmen: Record<string, Ausnahme>; geloest?: boolean;
}
export interface Gilde {
  id: string; name: string; geloest?: boolean; mitglieder: Mitglied[]; reihen: Reihe[];
  anwesend: Record<string, Record<string, Marke>>;
}
export interface Termin { reiheId: string; datum: string; start: string; aus: boolean }
export interface Zeile {
  mitgliedId: string; da: number; fehlt: number; entschuldigt: number; quote: number | null; straehne: number; letzte: string | null;
}
/** Die Worte der Textausgabe in der Seitensprache. reihe: die gewaehlte Reihe oder "Alle Reihen"; treffer: bei aktivem
    Filter "N von M Mitgliedern", sonst leer; datum: das kurze Datum wie auf den Karten (25.10. oder 10/25). */
export interface TextWorte {
  kopf: string; reihe: string; treffer: string; straehne: string; zuletzt: string; entschuldigt: string; offen: string; datum: (tag: string) => string;
}

/** Die deutschen Waffennamen (wie WEAPON_LABEL_DE der Seite), fuer die Suche. */
export const WAFFEN_DE: Record<string, string> = {
  "Greatsword": "Großschwert", "Sword and Shield": "Schwert und Schild", "Dagger": "Dolch",
  "Crossbow": "Armbrust", "Longbow": "Langbogen", "Staff": "Stab",
  "Wand and Tome": "Zauberstab und Foliant", "Spear": "Speer",
  "Gauntlet": "Panzerhandschuhe", "Orb": "Kugel",
};

/** Die Rolle eines Mitglieds: aus dem Waffenpaar, sonst die gesetzte. */
export function rolleVon(m: Mitglied): Rolle {
  return klasseVon(m.waffen)?.role ?? m.rolle;
}

/** Rolle ("" = alle) und Suche (Name, Klasse, Waffen, Notiz; ohne Gross-/Kleinschreibung); geloeste nie. */
export function filtern(ms: Mitglied[], f: { rolle: Rolle; suche: string }): Mitglied[] {
  const q = f.suche.trim().toLowerCase();
  return ms.filter((m) => {
    if (m.geloest) return false;
    if (f.rolle && rolleVon(m) !== f.rolle) return false;
    if (!q) return true;
    const k = klasseVon(m.waffen);
    const heu = [m.name, m.notiz, k?.en, k?.de, ...m.waffen, ...m.waffen.map((w) => WAFFEN_DE[w])];
    return heu.some((x) => !!x && x.toLowerCase().includes(q));
  });
}

const TAG = 86400000;
/** Obergrenze der durchlaufenen Tage, damit eine verirrte Spanne nie haengt */
const MAX_TAGE = 3700;
const tagMs = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const tagStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const zwei = (n: number) => String(n).padStart(2, "0");

export const terminSchluessel = (t: { reiheId: string; datum: string }) => t.reiheId + "|" + t.datum;

/** Die Termine einer Reihe zwischen zwei Tagen (beide eingeschlossen); ausgefallene mit aus=true. */
export function termine(r: Reihe, von: string, bis: string): Termin[] {
  const erster = r.start.slice(0, 10), zeit = r.start.slice(11, 16);
  const ende = r.wdh.bis && r.wdh.bis < bis ? r.wdh.bis : bis;
  const anfang = von > erster ? von : erster;
  const wochentag = new Date(tagMs(erster)).getUTCDay();
  const out: Termin[] = [];
  let ms = tagMs(anfang);
  for (let n = 0; n < MAX_TAGE && tagStr(ms) <= ende; n++, ms += TAG) {
    const d = tagStr(ms), wt = new Date(ms).getUTCDay();
    const trifft = r.wdh.art === "einmal" ? d === erster : r.wdh.art === "woche" ? wt === wochentag : r.wdh.tage.includes(wt);
    if (!trifft) continue;
    const a = r.ausnahmen[d];
    out.push({ reiheId: r.id, datum: d, start: d + "T" + (a?.zeit ?? zeit), aus: !!a?.aus });
  }
  return out;
}

/** Hat der Leader zu diesem Termin mindestens ein Haekchen gesetzt (nicht "offen")? */
export function abgehakt(g: Gilde, t: Termin): boolean {
  const m = g.anwesend[terminSchluessel(t)];
  return !!m && Object.values(m).some((x) => x !== "offen");
}

/** Die lokale Uhr des PCs als Wanduhr-Zeichenkette. */
export function wandUhr(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}T${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

/** Quote, Straehne, letzte Teilnahme je Mitglied; nur vergangene, nicht ausgefallene, abgehakte Termine zaehlen. */
export function auswerten(g: Gilde, reiheIds: string[] | null, jetzt: string): Zeile[] {
  const reihen = g.reihen.filter((r) => !r.geloest && (!reiheIds || reiheIds.includes(r.id)));
  const alle = reihen.flatMap((r) => termine(r, r.start.slice(0, 10), jetzt.slice(0, 10)))
    .filter((t) => !t.aus && t.start <= jetzt && abgehakt(g, t))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return g.mitglieder.filter((m) => !m.geloest).map((m) => {
    let da = 0, fehlt = 0, entschuldigt = 0, letzte: string | null = null;
    const marken: Marke[] = [];
    for (const t of alle) {
      const x = g.anwesend[terminSchluessel(t)]?.[m.id] ?? "offen";
      marken.push(x);
      if (x === "da") { da++; letzte = t.datum; } else if (x === "fehlt") fehlt++; else if (x === "entschuldigt") entschuldigt++;
    }
    let straehne = 0;
    for (let i = marken.length - 1; i >= 0; i--) {
      if (marken[i] === "da") straehne++;
      else if (marken[i] === "fehlt") break;
    }
    return { mitgliedId: m.id, da, fehlt, entschuldigt, quote: da + fehlt ? da / (da + fehlt) : null, straehne, letzte };
  });
}

/** Die Auswertung als Text zum Kopieren; Namen und Zahlen, kein Urteil. */
export function textAusgabe(zeilen: Zeile[], g: Gilde, w: TextWorte): string {
  const out = [[g.name, w.kopf, w.reihe, w.treffer].filter(Boolean).join(" \u00b7 ")];
  for (const z of zeilen) {
    const m = g.mitglieder.find((x) => x.id === z.mitgliedId);
    if (!m) continue;
    const teile = [m.name,
      z.quote === null ? w.offen : `${Math.round(z.quote * 100)}\u00a0% (${z.da}/${z.da + z.fehlt})`,
      `${w.straehne} ${z.straehne}`, `${w.zuletzt} ${z.letzte ? w.datum(z.letzte) : w.offen}`];
    if (z.entschuldigt) teile.push(`${z.entschuldigt} ${w.entschuldigt}`);
    out.push(teile.join(" \u00b7 "));
  }
  return out.join("\n");
}

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsZeit = (s: string) => s.replace(/[-:]/g, "") + "00";       // "2026-10-04T20:00" -> "20261004T200000"
const icsZeit0 = (d: string, hhmm: string) => icsZeit(d + "T" + hhmm);
function plusMin(start: string, min: number): string {
  const ms = Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10), +start.slice(11, 13), +start.slice(14, 16)) + min * 60000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${zwei(d.getUTCMonth() + 1)}-${zwei(d.getUTCDate())}T${zwei(d.getUTCHours())}:${zwei(d.getUTCMinutes())}`;
}
function falten(zeile: string): string {
  const teile: string[] = [];
  let rest = zeile;
  while (rest.length > 74) { teile.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  teile.push(rest);
  return teile.join("\r\n");
}

const ICS_LEER = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Borometer//Gilde//DE\r\nEND:VCALENDAR\r\n";
const icsStempel = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
/** Die Ereignisse einer Reihe: das wiederkehrende (RRULE, Ausfaelle als EXDATE, Erinnerung als VALARM) und je
    verschobenem Termin eines mit RECURRENCE-ID. */
function ereignisse(r: Reihe, stamp: string): string[] {
  const erster = r.start.slice(0, 10), zeit = r.start.slice(11, 16);
  // der erste Termin, der zur Regel passt (bei "tage" kann das spaeter sein als der Start)
  const ersterTermin = termine({ ...r, ausnahmen: {} }, erster, tagStr(tagMs(erster) + 7 * TAG))[0];
  const dtstart = ersterTermin ? ersterTermin.datum + "T" + zeit : r.start;
  const uid = r.id + "@borometer.local";
  const kopf = () => ["BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + stamp];
  const zeilen = [...kopf(), "DTSTART:" + icsZeit(dtstart), "DTEND:" + icsZeit(plusMin(dtstart, r.dauerMin)), "SUMMARY:" + icsText(r.titel)];
  const tage = r.wdh.art === "woche" ? [new Date(tagMs(erster)).getUTCDay()] : r.wdh.art === "tage" ? [...r.wdh.tage].sort((a, b) => a - b) : [];
  if (tage.length) {
    zeilen.push("RRULE:FREQ=WEEKLY;BYDAY=" + tage.map((d) => BYDAY[d]).join(",") + (r.wdh.bis ? ";UNTIL=" + r.wdh.bis.replace(/-/g, "") + "T235959" : ""));
  }
  for (const [d, a] of Object.entries(r.ausnahmen).sort()) if (a.aus) zeilen.push("EXDATE:" + icsZeit0(d, zeit));
  if (r.erinnerungMin > 0) zeilen.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsText(r.titel), "TRIGGER:-PT" + r.erinnerungMin + "M", "END:VALARM");
  zeilen.push("END:VEVENT");
  for (const [d, a] of Object.entries(r.ausnahmen).sort()) {
    if (a.aus || !a.zeit) continue;
    zeilen.push(...kopf(), "RECURRENCE-ID:" + icsZeit0(d, zeit), "DTSTART:" + icsZeit0(d, a.zeit),
      "DTEND:" + icsZeit(plusMin(d + "T" + a.zeit, r.dauerMin)), "SUMMARY:" + icsText(r.titel), "END:VEVENT");
  }
  return zeilen;
}
/** Der Rahmen eines Kalenders um die Ereignisse: der Kopf einmal, gefaltet, \r\n. */
function kalender(zone: string, ev: string[]): string {
  const zeilen = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Borometer//Gilde//DE", "CALSCALE:GREGORIAN", "X-WR-TIMEZONE:" + zone, ...ev, "END:VCALENDAR"];
  return zeilen.map(falten).join("\r\n") + "\r\n";
}

/** Die Reihe als .ics (RFC 5545), in schwebender Ortszeit mit X-WR-TIMEZONE; Ausfaelle als EXDATE, verschobene als RECURRENCE-ID. */
export function ics(g: Gilde, reiheId: string, jetztMs: number): string {
  const r = g.reihen.find((x) => x.id === reiheId);
  if (!r) return ICS_LEER;
  return kalender(r.zone, ereignisse(r, icsStempel(jetztMs)));
}

/** Mehrere Reihen in einem Kalender (Entscheidung 07.10.2026: "Alle Reihen" gibt eine Datei); geloeste nie, jede einmal.
    Die Zeitzone im Kopf ist die der ersten Reihe (die Zeiten sind schwebende Ortszeit). */
export function icsAlle(g: Gilde, reiheIds: string[], jetztMs: number): string {
  const rs = g.reihen.filter((r) => !r.geloest && reiheIds.includes(r.id));
  if (!rs.length) return ICS_LEER;
  const stamp = icsStempel(jetztMs);
  return kalender(rs[0]!.zone, rs.flatMap((r) => ereignisse(r, stamp)));
}
