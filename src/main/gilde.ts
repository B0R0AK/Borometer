// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The guild (spec 2026-10-06-gilde-design.md, sections 2, 3 and 7): one
 * leader's member list, event series and attendance, in one small file in the
 * settings folder. It holds player names the leader typed in himself (decided
 * on 06.10.2026: a deliberate exception to "no player names"), so it stays on
 * this computer: nothing here is sent anywhere, and no other file reads it
 * except the reminder (gilde-erinnerung.ts).
 *
 * As with the weeklies the page sends the whole state, it is rebuilt field by
 * field, and refused when anything the file already holds would go missing:
 * the guild, a member, a series, a marked appointment, a mark, an exception, and
 * (points, 11.10.2026) a kind, a pause, an entry, an extra or a counter.
 * Taking a mark back is "offen", detaching is "geloest"; there is no way to
 * empty this file from the page.
 *
 * One narrow exception (the owner, 14.10.2026, issue #240): the person may remove
 * what they detached themselves (a guild in "geloeste", a member with
 * "geloest", a kind with "geloest") for good, through loescheGeloest() only,
 * only with the name typed in, and only after a backup of the whole file lies
 * in the folder "sicherungen" (written "wx", never over a file, never removed).
 */

import * as fs from "node:fs";
import { settingsPath } from "./paths";

export const GILDE_PATH = settingsPath("boro-gilde.json");

/** one guild as JSON text, in the envelope of the file: 2 097 152 characters (UTF-16 code units; raised from 524 288, decision of 07.10.2026) */
const MAX_GILDE_TEXT = 2097152;
/** the whole file as JSON text: 6 291 456 characters, the open guild and the detached ones (14.10.2026; the local server takes 8 MiB) */
const MAX_TEXT = 6291456;
/** detached guilds kept in the file (14.10.2026, issue #237) */
const MAX_GELOESTE = 20;
const MAX_MITGLIEDER = 100;
const MAX_REIHEN = 20;
/** appointments with marks, over all series */
const MAX_TERMINE = 4000;
/** points (spec 2026-10-11-gilde-punkte-design.md, 3): kinds of points, pauses, prestige entries and extras per member */
const MAX_ARTEN = 12;
const MAX_PAUSEN = 50;
const MAX_EINTRAEGE = 600;
const MAX_ZUSAETZE = 50;
const ID_RX = /^[gmr][0-9a-z]{9}$/;
const NAME_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,24}$/u;
const ART_ID_RX = /^a[0-9a-z]{9}$/;
const ART_NAME_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,40}$/u;
const ZUSATZ_NOTIZ_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,60}$/u;
const NOTIZ_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{0,120}$/u;
const TITEL_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,60}$/u;
const ZONE_RX = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){0,2}$/;
const DATUM_RX = /^\d{4}-\d{2}-\d{2}$/;
const START_RX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const ZEIT_RX = /^\d{2}:\d{2}$/;
const TERMIN_RX = /^(r[0-9a-z]{9})\|(\d{4}-\d{2}-\d{2})$/;
const ROLLEN = ["tank", "heal", "dps", ""];
/** the ten weapon keys, as the page names them; a member has none or exactly two different ones */
const WAFFEN = ["Greatsword", "Sword and Shield", "Dagger", "Crossbow", "Longbow", "Staff", "Wand and Tome", "Spear", "Gauntlet", "Orb"];
const MARKEN = ["da", "fehlt", "entschuldigt", "offen"];
const ARTEN = ["einmal", "woche", "tage"];
const ERINNERUNGEN = [0, 5, 10, 15, 30, 60, 120];
const FILE_KEYS = ["v", "gilde", "geloeste"];
const LOESCHEN_KEYS = ["was", "id", "name"];
const LOESCHEN_WAS = ["gilde", "mitglied", "art"];
const GELOEST_KEYS = ["am", "gilde"];
const GILDE_KEYS = ["id", "name", "geloest", "mitglieder", "reihen", "anwesend", "punkte", "zaehler"];
const MITGLIED_KEYS = ["id", "name", "rolle", "waffen", "notiz", "geloest", "ausgetreten", "alsDps", "offspec", "punkte"];
const REIHE_KEYS = ["id", "titel", "start", "zone", "wdh", "dauerMin", "erinnerungMin", "ausnahmen", "geloest", "art"];
const WDH_KEYS = ["art", "tage", "bis"];
const AUSNAHME_KEYS = ["aus", "zeit"];
const PUNKTE_KEYS = ["an", "rang", "gruppen", "schwellen", "monat", "teiler", "stichtag", "arten"];
const ART_KEYS = ["id", "name", "punkte", "proPunkt", "geloest"];
const MPUNKTE_KEYS = ["seit", "abzugMonate", "pausen", "start", "ansehen", "zusatz"];
const PAUSE_KEYS = ["von", "bis"];
const ANSEHEN_KEYS = ["start", "eintraege"];
const EINTRAG_KEYS = ["datum", "betrag", "geloest"];
const ZUSATZ_KEYS = ["punkte", "notiz", "geloest"];

export type Rolle = "tank" | "heal" | "dps" | "";
export type Marke = "da" | "fehlt" | "entschuldigt" | "offen";
export interface Art { id: string; name: string; punkte: number; proPunkt: number; geloest?: boolean }
export interface Pause { von: string; bis?: string }
export interface Eintrag { datum: string; betrag: number; geloest?: boolean }
export interface Zusatz { punkte: number; notiz: string; geloest?: boolean }
export interface MitgliedPunkte {
  seit: string; abzugMonate?: number; pausen: Pause[]; start: Record<string, number>;
  ansehen: { start: number; eintraege: Eintrag[] }; zusatz: Zusatz[];
}
export interface PunkteRegeln {
  an: boolean; rang: boolean; gruppen: boolean; schwellen: [number, number]; monat: number; teiler: number; stichtag: string; arten: Art[];
}
export interface Mitglied {
  id: string; name: string; rolle: Rolle; waffen: string[]; notiz: string; geloest?: boolean;
  ausgetreten?: string; alsDps?: boolean; offspec?: string[]; punkte?: MitgliedPunkte;
}
export interface Ausnahme { aus?: boolean; zeit?: string }
export interface Wdh { art: "einmal" | "woche" | "tage"; tage: number[]; bis?: string }
export interface Reihe {
  id: string; titel: string; start: string; zone: string; wdh: Wdh; dauerMin: number; erinnerungMin: number;
  ausnahmen: Record<string, Ausnahme>; geloest?: boolean; art?: string;
}
export interface Gilde {
  id: string; name: string; geloest?: boolean; mitglieder: Mitglied[]; reihen: Reihe[];
  anwesend: Record<string, Record<string, Marke>>;
  punkte?: PunkteRegeln; zaehler?: Record<string, Record<string, number>>;
}
/** a guild the leader detached (issue #237): the whole guild as it was, and the day it was detached */
export interface Geloeste { am: string; gilde: Gilde }
export interface GildeFile { v: 1; gilde: Gilde | null; geloeste?: Geloeste[] }

const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const only = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).every((k) => keys.includes(k));
const textOk = (x: unknown, rx: RegExp): x is string => typeof x === "string" && rx.test(x) && x.trim() === x;
const flagOk = (b: unknown) => b === undefined || typeof b === "boolean";
const idOk = (x: unknown, prefix: string): x is string => typeof x === "string" && ID_RX.test(x) && x[0] === prefix;
/** a real calendar day "YYYY-MM-DD" (30 February is refused) */
const datumOk = (x: unknown): x is string => {
  if (typeof x !== "string" || !DATUM_RX.test(x)) return false;
  const d = new Date(Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10)));
  return d.toISOString().slice(0, 10) === x;
};
const zeitOk = (x: unknown): x is string => typeof x === "string" && ZEIT_RX.test(x) && +x.slice(0, 2) < 24 && +x.slice(3, 5) < 60;
const startOk = (x: unknown): x is string => typeof x === "string" && START_RX.test(x) && datumOk(x.slice(0, 10)) && zeitOk(x.slice(11));
const empty = (): GildeFile => ({ v: 1, gilde: null });

/** The reasons loescheGeloest() says no; the file is untouched in every one of them. */
export type LoeschenGrund = "abgelehnt" | "nicht-geloest" | "name" | "sicherung" | "in-benutzung" | "unavailable";
export type LoeschenErgebnis = { ok: true; sicherung: string } | { ok: false; grund: LoeschenGrund };

const waffenOk = (x: unknown): x is string[] =>
  Array.isArray(x) && (x.length === 0 || (x.length === 2 && x.every((w) => typeof w === "string" && WAFFEN.includes(w)) && x[0] !== x[1]));

/** a finite number from 0 up to max */
const zahlOk = (x: unknown, max: number): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max;
const ganzOk = (x: unknown, min: number, max: number): x is number => typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;

function artOf(x: unknown): Art | null {
  if (!isRec(x) || !only(x, ART_KEYS) || typeof x.id !== "string" || !ART_ID_RX.test(x.id) || !textOk(x.name, ART_NAME_RX)) return null;
  if (!zahlOk(x.punkte, 1000) || !ganzOk(x.proPunkt, 1, 100) || !flagOk(x.geloest)) return null;
  return { id: x.id, name: x.name, punkte: x.punkte, proPunkt: x.proPunkt, ...(x.geloest === undefined ? {} : { geloest: x.geloest as boolean }) };
}

function punkteOf(x: unknown): PunkteRegeln | null {
  if (!isRec(x) || !only(x, PUNKTE_KEYS) || typeof x.an !== "boolean" || typeof x.rang !== "boolean" || typeof x.gruppen !== "boolean") return null;
  const sw = x.schwellen;
  if (!Array.isArray(sw) || sw.length !== 2 || !zahlOk(sw[0], 1000000) || !zahlOk(sw[1], 1000000)) return null;
  if (!zahlOk(x.monat, 1000) || !zahlOk(x.teiler, 1000000000) || x.teiler < 1 || !datumOk(x.stichtag)) return null;
  if (!Array.isArray(x.arten) || x.arten.length > MAX_ARTEN) return null;
  const arten: Art[] = [];
  for (const a of x.arten) {
    const r = artOf(a);
    if (!r || arten.some((o) => o.id === r.id)) return null;
    arten.push(r);
  }
  return { an: x.an, rang: x.rang, gruppen: x.gruppen, schwellen: [sw[0], sw[1]], monat: x.monat, teiler: x.teiler, stichtag: x.stichtag, arten };
}

function mitgliedPunkteOf(x: unknown, artIds: string[]): MitgliedPunkte | null {
  if (!isRec(x) || !only(x, MPUNKTE_KEYS) || !datumOk(x.seit)) return null;
  if (x.abzugMonate !== undefined && !ganzOk(x.abzugMonate, 0, 1200)) return null;
  if (!Array.isArray(x.pausen) || x.pausen.length > MAX_PAUSEN) return null;
  const pausen: Pause[] = [];
  for (const p of x.pausen) {
    if (!isRec(p) || !only(p, PAUSE_KEYS) || !datumOk(p.von) || (p.bis !== undefined && (!datumOk(p.bis) || p.bis < p.von))) return null;
    pausen.push({ von: p.von, ...(p.bis === undefined ? {} : { bis: p.bis as string }) });
  }
  if (!isRec(x.start)) return null;
  const start: Record<string, number> = {};
  for (const [id, n] of Object.entries(x.start)) {
    if (!artIds.includes(id) || !zahlOk(n, 1000000)) return null;
    start[id] = n;
  }
  const an = x.ansehen;
  if (!isRec(an) || !only(an, ANSEHEN_KEYS) || !zahlOk(an.start, 1000000000) || !Array.isArray(an.eintraege) || an.eintraege.length > MAX_EINTRAEGE) return null;
  const eintraege: Eintrag[] = [];
  for (const e of an.eintraege) {
    if (!isRec(e) || !only(e, EINTRAG_KEYS) || !datumOk(e.datum) || !zahlOk(e.betrag, 1000000000) || !flagOk(e.geloest)) return null;
    eintraege.push({ datum: e.datum, betrag: e.betrag, ...(e.geloest === undefined ? {} : { geloest: e.geloest as boolean }) });
  }
  if (!Array.isArray(x.zusatz) || x.zusatz.length > MAX_ZUSAETZE) return null;
  const zusatz: Zusatz[] = [];
  for (const z of x.zusatz) {
    if (!isRec(z) || !only(z, ZUSATZ_KEYS) || !zahlOk(z.punkte, 1000000) || !textOk(z.notiz, ZUSATZ_NOTIZ_RX) || !flagOk(z.geloest)) return null;
    zusatz.push({ punkte: z.punkte, notiz: z.notiz, ...(z.geloest === undefined ? {} : { geloest: z.geloest as boolean }) });
  }
  return { seit: x.seit, ...(x.abzugMonate === undefined ? {} : { abzugMonate: x.abzugMonate as number }), pausen, start,
    ansehen: { start: an.start, eintraege }, zusatz };
}

function mitgliedOf(x: unknown, artIds: string[]): Mitglied | null {
  if (!isRec(x) || !only(x, MITGLIED_KEYS) || !idOk(x.id, "m") || !textOk(x.name, NAME_RX)) return null;
  if (!ROLLEN.includes(x.rolle as string) || !waffenOk(x.waffen) || !textOk(x.notiz, NOTIZ_RX) || !flagOk(x.geloest) || !flagOk(x.alsDps)) return null;
  // out: only a detached member has left; offspec: a second pair of two different weapons, or absent
  if (x.ausgetreten !== undefined && (!datumOk(x.ausgetreten) || x.geloest !== true)) return null;
  if (x.offspec !== undefined && (!waffenOk(x.offspec) || x.offspec.length !== 2)) return null;
  const punkte = x.punkte === undefined ? undefined : mitgliedPunkteOf(x.punkte, artIds);
  if (punkte === null) return null;
  return { id: x.id, name: x.name, rolle: x.rolle as Rolle, waffen: [...x.waffen], notiz: x.notiz,
    ...(x.geloest === undefined ? {} : { geloest: x.geloest as boolean }),
    ...(x.ausgetreten === undefined ? {} : { ausgetreten: x.ausgetreten }),
    ...(x.alsDps === undefined ? {} : { alsDps: x.alsDps as boolean }),
    ...(x.offspec === undefined ? {} : { offspec: [...(x.offspec as string[])] }),
    ...(punkte === undefined ? {} : { punkte }) };
}

function reiheOf(x: unknown, artIds: string[]): Reihe | null {
  if (!isRec(x) || !only(x, REIHE_KEYS) || !idOk(x.id, "r") || !textOk(x.titel, TITEL_RX) || !startOk(x.start)) return null;
  if (typeof x.zone !== "string" || x.zone.length > 40 || !ZONE_RX.test(x.zone) || !flagOk(x.geloest)) return null;
  if (x.art !== undefined && (typeof x.art !== "string" || !artIds.includes(x.art))) return null;
  if (!Number.isInteger(x.dauerMin) || (x.dauerMin as number) < 15 || (x.dauerMin as number) > 1440) return null;
  if (!ERINNERUNGEN.includes(x.erinnerungMin as number)) return null;
  const w = x.wdh;
  if (!isRec(w) || !only(w, WDH_KEYS) || !ARTEN.includes(w.art as string)) return null;
  if (!Array.isArray(w.tage) || w.tage.length > 7 || !w.tage.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) || new Set(w.tage).size !== w.tage.length) return null;
  if (w.bis !== undefined && !datumOk(w.bis)) return null;
  const wdh: Wdh = { art: w.art as Wdh["art"], tage: [...(w.tage as number[])], ...(w.bis === undefined ? {} : { bis: w.bis as string }) };
  if (!isRec(x.ausnahmen) || Object.keys(x.ausnahmen).length > 4000) return null;
  const ausnahmen: Record<string, Ausnahme> = {};
  for (const [d, a] of Object.entries(x.ausnahmen)) {
    if (!datumOk(d) || !isRec(a) || !only(a, AUSNAHME_KEYS) || !flagOk(a.aus) || (a.zeit !== undefined && !zeitOk(a.zeit))) return null;
    ausnahmen[d] = { ...(a.aus === undefined ? {} : { aus: a.aus as boolean }), ...(a.zeit === undefined ? {} : { zeit: a.zeit as string }) };
  }
  return { id: x.id, titel: x.titel, start: x.start, zone: x.zone, wdh, dauerMin: x.dauerMin as number, erinnerungMin: x.erinnerungMin as number,
    ausnahmen, ...(x.geloest === undefined ? {} : { geloest: x.geloest as boolean }), ...(x.art === undefined ? {} : { art: x.art as string }) };
}

/** counters per appointment and member (a kind with several takes-part per point, e.g. the seven guild bosses of a week): 0 to 100 each */
function zaehlerOf(x: unknown, reihen: Reihe[], mitglieder: Mitglied[]): Record<string, Record<string, number>> | null {
  if (!isRec(x) || Object.keys(x).length > MAX_TERMINE) return null;
  const out: Record<string, Record<string, number>> = {};
  for (const [k, v] of Object.entries(x)) {
    const t = TERMIN_RX.exec(k);
    if (!t || !datumOk(t[2]) || !reihen.some((r) => r.id === t[1]) || !isRec(v) || Object.keys(v).length > MAX_MITGLIEDER) return null;
    const je: Record<string, number> = {};
    for (const [mid, n] of Object.entries(v)) {
      if (!mitglieder.some((m) => m.id === mid) || !ganzOk(n, 0, 100)) return null;
      je[mid] = n;
    }
    out[k] = je;
  }
  return out;
}

function gildeOf(x: unknown): Gilde | null {
  if (!isRec(x) || !only(x, GILDE_KEYS) || !idOk(x.id, "g") || !textOk(x.name, NAME_RX) || !flagOk(x.geloest)) return null;
  if (!Array.isArray(x.mitglieder) || x.mitglieder.length > MAX_MITGLIEDER || !Array.isArray(x.reihen) || x.reihen.length > MAX_REIHEN) return null;
  const punkte = x.punkte === undefined ? undefined : punkteOf(x.punkte);
  if (punkte === null) return null;
  const artIds = punkte ? punkte.arten.map((a) => a.id) : [];
  const mitglieder: Mitglied[] = [];
  for (const m of x.mitglieder) {
    const r = mitgliedOf(m, artIds);
    if (!r || mitglieder.some((o) => o.id === r.id)) return null;
    mitglieder.push(r);
  }
  const reihen: Reihe[] = [];
  for (const e of x.reihen) {
    const r = reiheOf(e, artIds);
    if (!r || reihen.some((o) => o.id === r.id)) return null;
    reihen.push(r);
  }
  if (!isRec(x.anwesend) || Object.keys(x.anwesend).length > MAX_TERMINE) return null;
  const anwesend: Record<string, Record<string, Marke>> = {};
  for (const [k, v] of Object.entries(x.anwesend)) {
    const t = TERMIN_RX.exec(k);
    if (!t || !datumOk(t[2]) || !reihen.some((r) => r.id === t[1]) || !isRec(v) || Object.keys(v).length > MAX_MITGLIEDER) return null;
    const marken: Record<string, Marke> = {};
    for (const [mid, mk] of Object.entries(v)) {
      if (!mitglieder.some((m) => m.id === mid) || !MARKEN.includes(mk as string)) return null;
      marken[mid] = mk as Marke;
    }
    anwesend[k] = marken;
  }
  const zaehler = x.zaehler === undefined ? undefined : zaehlerOf(x.zaehler, reihen, mitglieder);
  if (zaehler === null) return null;
  return { id: x.id, name: x.name, ...(x.geloest === undefined ? {} : { geloest: x.geloest as boolean }), mitglieder, reihen, anwesend,
    ...(punkte === undefined ? {} : { punkte }), ...(zaehler === undefined ? {} : { zaehler }) };
}

/**
 * True when the new state leaves out something of the points that the file already holds: a kind,
 * a member's points, a pause (its start stays, it may get an end), an entry or an extra (its date and
 * amount, or points and note, stay; detaching sets a flag), a counter's appointment or member.
 * Values of counters and the flags may change, nothing may disappear.
 */
function lostPunkte(old: Gilde, g: Gilde): boolean {
  if (!(old.punkte?.arten ?? []).every((a) => g.punkte?.arten.some((b) => b.id === a.id))) return true;
  for (const m of old.mitglieder) {
    if (!m.punkte) continue;
    const n = g.mitglieder.find((q) => q.id === m.id)?.punkte;
    if (!n) return true;
    const op = m.punkte.pausen, oe = m.punkte.ansehen.eintraege, oz = m.punkte.zusatz;
    if (n.pausen.length < op.length || !op.every((p, i) => n.pausen[i]?.von === p.von)) return true;
    if (n.ansehen.eintraege.length < oe.length || !oe.every((e, i) => n.ansehen.eintraege[i]?.datum === e.datum && n.ansehen.eintraege[i]?.betrag === e.betrag)) return true;
    if (n.zusatz.length < oz.length || !oz.every((z, i) => n.zusatz[i]?.punkte === z.punkte && n.zusatz[i]?.notiz === z.notiz)) return true;
  }
  for (const [k, v] of Object.entries(old.zaehler ?? {})) {
    const n = g.zaehler?.[k];
    if (!n || !Object.keys(v).every((mid) => Object.hasOwn(n, mid))) return true;
  }
  return false;
}

/** True when the new version of a guild leaves out something the stored version of it holds. */
function lostGilde(old: Gilde, g: Gilde): boolean {
  if (!old.mitglieder.every((m) => g.mitglieder.some((n) => n.id === m.id))) return true;
  for (const r of old.reihen) {
    const n = g.reihen.find((q) => q.id === r.id);
    if (!n || !Object.keys(r.ausnahmen).every((d) => Object.hasOwn(n.ausnahmen, d))) return true;
  }
  for (const [k, v] of Object.entries(old.anwesend)) {
    const n = g.anwesend[k];
    if (!n || !Object.keys(v).every((mid) => Object.hasOwn(n, mid))) return true;
  }
  return lostPunkte(old, g);
}

/** The detached guilds: a list of at most MAX_GELOESTE, each a day and a whole guild. */
function geloesteOf(x: unknown): Geloeste[] | null {
  if (!Array.isArray(x) || x.length > MAX_GELOESTE) return null;
  const out: Geloeste[] = [];
  for (const e of x) {
    if (!isRec(e) || !only(e, GELOEST_KEYS) || !datumOk(e.am)) return null;
    const g = gildeOf(e.gilde);
    if (!g) return null;
    out.push({ am: e.am, gilde: g });
  }
  return out;
}

/**
 * The state the page sent, checked against the schema and against what the
 * file already holds, and rebuilt from the allowed fields. Null when refused:
 * a field out of the schema, a bound passed, or anything stored that the page
 * left out. Every guild the file holds, the open one and each detached one,
 * must stand in the new state (open or detached) with nothing missing.
 * Leaving something out is never a way to remove it.
 */
export function checkGilde(next: unknown, stored: GildeFile): GildeFile | null {
  if (!isRec(next) || !only(next, FILE_KEYS) || next.v !== 1) return null;
  const g = next.gilde === null ? null : gildeOf(next.gilde);
  if (next.gilde !== null && !g) return null;
  const parked = next.geloeste === undefined ? undefined : geloesteOf(next.geloeste);
  if (parked === null) return null;
  const all = [...(g ? [g] : []), ...(parked ?? []).map((e) => e.gilde)];
  if (new Set(all.map((x) => x.id)).size !== all.length) return null;
  if (all.some((x) => JSON.stringify({ v: 1, gilde: x }).length > MAX_GILDE_TEXT)) return null;
  for (const old of [...(stored.gilde ? [stored.gilde] : []), ...(stored.geloeste ?? []).map((e) => e.gilde)]) {
    const n = all.find((x) => x.id === old.id);
    if (!n || lostGilde(old, n)) return null;
  }
  for (const e of stored.geloeste ?? []) {
    const n = parked?.find((p) => p.gilde.id === e.gilde.id);
    if (n && n.am !== e.am) return null;
  }
  return { v: 1, gilde: g, ...(parked === undefined ? {} : { geloeste: parked }) };
}

function readGildeFile(): { data: GildeFile } | { corrupt: true } {
  let text: string;
  try {
    text = fs.readFileSync(GILDE_PATH, "utf8");
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code === "ENOENT" ? { data: empty() } : { corrupt: true };
  }
  try {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const data = checkGilde(JSON.parse(text), empty());
    return data ? { data } : { corrupt: true };
  } catch {
    return { corrupt: true };
  }
}

/** The stored state; a missing file is an empty one. Null when the file is there but could not be read or understood. */
export function loadGilde(): GildeFile | null {
  const read = readGildeFile();
  return "data" in read ? read.data : null;
}

function saveGilde(all: GildeFile): boolean {
  try {
    // temp file and rename: a crash mid-write leaves the old file
    fs.writeFileSync(GILDE_PATH + ".tmp", JSON.stringify(all), "utf8");
    fs.renameSync(GILDE_PATH + ".tmp", GILDE_PATH);
    return true;
  } catch {
    return false;
  }
}

/** On the first start, an empty file with its version; "wx" never touches a file that is there. */
export function createGilde(): void {
  try {
    fs.writeFileSync(GILDE_PATH, JSON.stringify(empty()), { encoding: "utf8", flag: "wx" });
  } catch {
    // there already, or not writable just now: nothing is lost either way
  }
}

/** "refused" is for good (schema, size, count, something left out); "unavailable" may pass. */
export type PutResult = "saved" | "refused" | "unavailable";

/** Stores the whole state the page sent, as checkGilde() rebuilt it. */
export function putGilde(data: unknown): PutResult {
  const text = JSON.stringify(data);
  if (typeof text !== "string" || text.length > MAX_TEXT) return "refused";
  const read = readGildeFile();
  if ("corrupt" in read) return "unavailable";
  const clean = checkGilde(data, read.data);
  if (!clean) return "refused";
  return saveGilde(clean) ? "saved" : "unavailable";
}

const nameGleich = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const ohneKey = (o: Record<string, number>, key: string): Record<string, number> => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

/** The state without the detached thing asked for, or the reason that it may not go. Nothing is written here. */
function ohne(alt: GildeFile, was: string, id: string, name: string): GildeFile | LoeschenGrund {
  const parked = alt.geloeste === undefined ? {} : { geloeste: alt.geloeste };
  if (was === "gilde") {
    const e = (alt.geloeste ?? []).find((x) => x.gilde.id === id);
    if (!e) return "nicht-geloest";
    if (!nameGleich(name, e.gilde.name)) return "name";
    return { v: 1, gilde: alt.gilde, geloeste: (alt.geloeste ?? []).filter((x) => x !== e) };
  }
  const g = alt.gilde;
  if (!g) return "nicht-geloest";
  if (was === "mitglied") {
    const m = g.mitglieder.find((x) => x.id === id);
    if (!m || !m.geloest) return "nicht-geloest";
    if (!nameGleich(name, m.name)) return "name";
    const neu: Gilde = { ...g, mitglieder: g.mitglieder.filter((x) => x !== m),
      anwesend: Object.fromEntries(Object.entries(g.anwesend).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([mid]) => mid !== id))])) };
    if (g.zaehler) neu.zaehler = Object.fromEntries(Object.entries(g.zaehler).map(([k, v]) => [k, ohneKey(v, id)]));
    return { v: 1, gilde: neu, ...parked };
  }
  const p = g.punkte;
  const a = p?.arten.find((x) => x.id === id);
  if (!p || !a || !a.geloest) return "nicht-geloest";
  if (!nameGleich(name, a.name)) return "name";
  if (g.reihen.some((r) => r.art === id)) return "in-benutzung";
  const neu: Gilde = { ...g, punkte: { ...p, arten: p.arten.filter((x) => x !== a) },
    mitglieder: g.mitglieder.map((m) => (m.punkte ? { ...m, punkte: { ...m.punkte, start: ohneKey(m.punkte.start, id) } } : m)) };
  return { v: 1, gilde: neu, ...parked };
}

/** The backup before anything goes: the whole file, in the folder "sicherungen", beside others, never over one. */
function sichere(text: string): string | null {
  const dir = settingsPath("sicherungen");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    return null;
  }
  const tag = new Date().toISOString().slice(0, 10);
  for (const i of Array.from({ length: 99 }, (_, k) => k + 1)) {
    const name = "gilde-vor-loeschen-" + tag + (i === 1 ? "" : "-" + i) + ".json";
    try {
      fs.writeFileSync(dir + "/" + name, text, { encoding: "utf8", flag: "wx" });
      return name;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") return null;
    }
  }
  return null;
}

/**
 * Removes for good what the person detached: a guild from "geloeste", a former member, a detached kind of points.
 * Only that, only with the name typed in, only after the backup lies in "sicherungen". Everything else the file holds
 * stays; the page can never remove anything through putGilde().
 */
export function loescheGeloest(req: unknown): LoeschenErgebnis {
  if (!isRec(req) || !only(req, LOESCHEN_KEYS) || typeof req.was !== "string" || !LOESCHEN_WAS.includes(req.was) || typeof req.id !== "string" || typeof req.name !== "string") {
    return { ok: false, grund: "abgelehnt" };
  }
  const read = readGildeFile();
  if ("corrupt" in read) return { ok: false, grund: "unavailable" };
  const neu = ohne(read.data, req.was, req.id, req.name);
  if (typeof neu === "string") return { ok: false, grund: neu };
  const clean = checkGilde(neu, empty());
  if (!clean) return { ok: false, grund: "abgelehnt" };
  const sicherung = sichere(JSON.stringify(read.data));
  if (!sicherung) return { ok: false, grund: "sicherung" };
  return saveGilde(clean) ? { ok: true, sicherung } : { ok: false, grund: "unavailable" };
}
