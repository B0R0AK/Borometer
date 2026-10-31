// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Der rechnende Kern des Log-Archivs (Spezifikation Log-Archiv, #264): Schluessel,
   Platz in der Bosstabelle, Bossliste der Suche, Zeilenschnitt eines Kampfs.
   Keine Seite, kein Netz, kein Node: scripts/test-archiv-core.mjs buendelt diese
   Datei allein. Die Seite reicht die Zeitauslesung einer Zeile hinein. */

import type { RkSeite } from "./rekorde-core";

/** Ein Kampf im Verzeichnis des Archivs: nur IDs, Zahlen und der Logname. */
export interface ArchivKampf {
  /** Logdatei + "|" + Start in ms */
  k: string;
  /** Platz der Bosstabelle, z. B. "raid:dragaryle", "puppe:120" */
  platz: string;
  /** Name im Log (ohne Rang und Zustand) */
  boss: string;
  at: number; dps: number; dmg: number; dur: number;
  /** Puppe: Laengenklasse 60/120/180 */
  c?: number;
  /** Charakterkennung, nie der Name */
  ch?: string;
  datei: string;
  zeilen: number;
  geloest?: boolean;
}

/** Ein Platz der Bosstabelle, flach, mit der Gruppe der Gliederung. */
export interface ArchivOrt {
  id: string;
  de: string;
  en: string;
  namen: readonly string[];
  unter: { de: string; en: string } | null;
  gruppe: string;
  /** Seite des Albums (raid, puppe, feld, dungeon); aelterer Aufbau ohne sie: aus der Gruppe */
  seite?: string;
}
export interface ArchivZeile { ort: ArchivOrt; n: number; bester: number | null }
export interface ArchivGruppe { gruppe: string; zeilen: ArchivZeile[] }

export const ARCHIV_MAX_BYTES = 8 * 1024 * 1024;
const PUFFER_MS = 2000;
/* Namen der Uebungsziele wie PRACTICE_TARGETS in 06-blocks-and-places.ts. */
const PUPPE_NAMEN: readonly string[] = ["practice dummy", "übungspuppe", "arkeum statue for training"];
const PUPPE_KLASSEN: readonly number[] = [60, 120, 180];

/* Rang vorn und Zustand hinten, wie bareBoss() in 06-blocks-and-places.ts. */
const RANG = /^(?:Aufgestiegene[rsn]?|Ascended)\s+/i;
const ZUSTAND = /\s*\[[^\]]*\]\s*$/;
const nackt = (n: string) => String(n || "").replace(RANG, "").replace(ZUSTAND, "").trim().toLowerCase();

/** Schluessel eines Kampfs: Datei ersetzt sich, wenn das Livelog waechst. */
export const archivSchluessel = (datei: string, start: number): string => datei + "|" + start;

/** Was der Verlauf von einem Kampf weiss (HistFight in types.ts), soweit das Archiv es nimmt. */
export interface ArchivQuelle { at: number; dps: number; dmg: number; dur: number; c?: number; ch?: string }
const CH_RX = /^w[0-9a-z]{9}$/;

/** Der Eintrag eines Kampfs fuers Verzeichnis (Spezifikation 6, archivEintrag): nur Schluessel,
    Platz, Zahlen und der Logname; der Charakter nur als Kennung, sonst gar nicht. */
export function archivEintrag(f: ArchivQuelle, ort: { platz: string; boss: string }, datei: string, zeilen: number): ArchivKampf {
  return {k: archivSchluessel(datei, f.at), platz: ort.platz, boss: ort.boss, at: f.at, dps: f.dps, dmg: f.dmg, dur: f.dur,
    ...(f.c === undefined ? {} : {c: f.c}), ...(typeof f.ch === "string" && CH_RX.test(f.ch) ? {ch: f.ch} : {}), datei, zeilen};
}

/** Flach aus dem Album; die Gruppe ist der Schluessel der Gruppe, sonst die Seite. */
export function archivOrte(seiten: readonly RkSeite[]): ArchivOrt[] {
  const aus: ArchivOrt[] = [];
  for(const s of seiten) for(const g of s.gruppen) for(const o of g.orte)
    aus.push({id: o.id, de: o.de, en: o.en, namen: o.klasse != null ? [...o.namen, ...PUPPE_NAMEN] : o.namen,
      unter: o.unter, gruppe: g.key ?? s.id, seite: s.id});
  return aus;
}

/** Die Art eines Bosses fuer die Filterchips: Raid, Dungeon, Feldboss (offene Welt, Erzbosse, Kolosse) oder Uebungspuppe. */
export type ArchivKategorie = "raid" | "dungeon" | "feld" | "puppe";
export function archivKategorie(o: Pick<ArchivOrt, "seite" | "gruppe">): ArchivKategorie {
  const s = o.seite ?? o.gruppe;
  return s === "raid" ? "raid" : s === "puppe" ? "puppe" : s === "feld" || s === "erz" || s === "koloss" ? "feld" : "dungeon";
}
/** Chip und Umschalter der Suche: "alle" oder eine Kategorie, dazu "nur mit Kaempfen". */
export interface ArchivFilter { kat: "alle" | ArchivKategorie; nurMit: boolean }


/** Ein Kampf, wie ihn der Verlauf fuehrt (HistFight in types.ts), soweit die Bossseite ihn braucht. */
export interface VerlaufKampf { name: string; dps: number; dmg: number; dur: number; at: number; file?: string; c?: number; g?: number; ch?: string }
/** Ein Kampf der Bossseite: k ist sein Schluessel im Archiv, wenn er dort (ungeloest) liegt. */
export type MengeKampf<T extends VerlaufKampf = VerlaufKampf> = T & { k?: string };

/** Die Kaempfe eines Bosses aus Verlauf und Archiv zusammen, nach der Zeit; derselbe Beginn ist ein Kampf.
    Der Kampf des Verlaufs behaelt seine Felder (Name, Datei, Waffen ...) und bekommt k, wenn er im Archiv liegt;
    ein Kampf nur im Archiv steht mit Boss als Name und Logname als Datei darin. Gelöste Archivkaempfe zaehlen nicht.
    Summen einer Gruppe (g) und die Wahl der Plaetze filtert der Rufer. */
export function archivMenge<T extends VerlaufKampf>(verlauf: readonly T[], archiv: readonly ArchivKampf[]): MengeKampf<T>[] {
  const schluessel = new Map<number, ArchivKampf>();
  for(const a of archiv) if(!a.geloest && !schluessel.has(a.at)) schluessel.set(a.at, a);
  const aus: MengeKampf<T>[] = [], da = new Set<number>();
  for(const v of verlauf){
    if(da.has(v.at)) continue;
    da.add(v.at);
    const a = schluessel.get(v.at);
    aus.push(a ? {...v, k: a.k} : {...v});
  }
  for(const a of schluessel.values()){
    if(da.has(a.at)) continue;
    aus.push({name: a.boss, dps: a.dps, dmg: a.dmg, dur: a.dur, at: a.at, file: a.datei,
      ...(a.c === undefined ? {} : {c: a.c}), ...(a.ch === undefined ? {} : {ch: a.ch}), k: a.k} as MengeKampf<T>);
  }
  return aus.sort((x, y) => x.at - y.at);
}
/** Zahl, bester DPS und Median der Kaempfe eines Platzes, ohne geloeste (gerade Zahl: Mittel der zwei mittleren). */
export function archivStatistik(kaempfe: readonly {dps: number; geloest?: boolean}[]): {n: number; bester: number; median: number} {
  const w = kaempfe.filter(k => !k.geloest).map(k => k.dps).sort((a, b) => a - b);
  if(!w.length) return {n: 0, bester: 0, median: 0};
  const m = w.length >> 1;
  return {n: w.length, bester: w[w.length - 1]!, median: w.length % 2 ? w[m]! : Math.round((w[m - 1]! + w[m]!) / 2)};
}

/** Die Punkte einer Kurve der DPS ueber die Kaempfe (aelteste zuerst) in einer Flaeche breite x hoehe mit Rand;
    best ist der Index des hoechsten Werts (bei Gleichstand der erste). Unter zwei Werten gibt es keine Kurve. */
export function archivKurve(werte: readonly number[], breite: number, hoehe: number, rand = 6): {punkte: [number, number][]; best: number} | null {
  if(werte.length < 2) return null;
  const lo = Math.min(...werte), hi = Math.max(...werte), sp = hi - lo;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const punkte = werte.map((v, i): [number, number] => [r1(rand + (breite - 2 * rand) * i / (werte.length - 1)),
    r1(sp ? hoehe - rand - (hoehe - 2 * rand) * (v - lo) / sp : hoehe / 2)]);
  return {punkte, best: werte.indexOf(hi)};
}

/** Der Platz eines Bosses im Album, sonst null (gehoert nicht ins Archiv). */
export function archivPlatz(boss: string, orte: readonly ArchivOrt[], puppeKlasse?: number): string | null {
  const name = nackt(boss);
  if(!name) return null;
  if(PUPPE_NAMEN.includes(name)){
    if(puppeKlasse == null || !PUPPE_KLASSEN.includes(puppeKlasse)) return null;
    const id = "puppe:" + puppeKlasse;
    return orte.some(o => o.id === id) ? id : null;
  }
  for(const o of orte) if(o.namen.some(n => nackt(n) === name)) return o.id;
  return null;
}

/** Die Bosse, gefiltert und nach Gruppe in der Reihenfolge des Albums gegliedert. */
export function bossListe(orte: readonly ArchivOrt[], kaempfe: readonly ArchivKampf[], frage: string, sprache: "de" | "en"): ArchivGruppe[] {
  return bossListeAus(orte, archivZahlen(kaempfe), frage, sprache);
}

/** Je Platz die Zahl der Kaempfe und der beste DPS, ohne geloeste. Die Seite rechnet es einmal je Stand des
    Verzeichnisses und filtert danach bei jedem Tastendruck nur noch die Plaetze (bossListeAus). */
export interface ArchivZahl { n: number; bester: number }
export function archivZahlen(kaempfe: readonly ArchivKampf[]): Map<string, ArchivZahl> {
  const m = new Map<string, ArchivZahl>();
  for(const k of kaempfe){
    if(k.geloest) continue;
    const z = m.get(k.platz);
    if(!z) m.set(k.platz, {n: 1, bester: k.dps});
    else { z.n++; if(k.dps > z.bester) z.bester = k.dps; }
  }
  return m;
}

/** Wie bossListe, aus schon gezaehlten Kaempfen (archivZahlen). */
export function bossListeAus(orte: readonly ArchivOrt[], zahlen: ReadonlyMap<string, ArchivZahl>, frage: string, sprache: "de" | "en", filter?: ArchivFilter): ArchivGruppe[] {
  void sprache; // der Filter sucht in beiden Sprachen
  const q = frage.trim().toLowerCase();
  const passt = (o: ArchivOrt) => !q || [o.de, o.en, ...o.namen, o.unter?.de ?? "", o.unter?.en ?? ""].some(t => t.toLowerCase().includes(q));
  const aus: ArchivGruppe[] = [];
  for(const o of orte){
    if(!passt(o)) continue;
    if(filter && filter.kat !== "alle" && archivKategorie(o) !== filter.kat) continue;
    const z = zahlen.get(o.id);
    if(filter?.nurMit && !z) continue;
    let g = aus.find(x => x.gruppe === o.gruppe);
    if(!g){ g = {gruppe: o.gruppe, zeilen: []}; aus.push(g); }
    g.zeilen.push({ort: o, n: z?.n ?? 0, bester: z ? z.bester : null});
  }
  return aus;
}

/* ---------- Loesen und endgueltig Loeschen (Spezifikation 2026-10-26-archiv-loeschen-design.md; #264 Teil 4) ----------
   Den Satz zum Abtippen prueft der Hauptprozess selbst (bestaetigt und logDatum in src/main/archiv.ts); die Seite
   zeigt ihn nur an und gibt den Knopf erst frei, wenn er stimmt. Darum rechnet sie ihn genau so: das Datum des Kampfs,
   wie die Liste es zeigt - at ist die Wanduhr des Logs, als UTC gespeichert, also die UTC-Felder, ohne Zeitzone
   (Entscheidung 26.10.2026), zwei Stellen fuer Tag und Monat. */
/** Der Tag eines Kampfs als TT.MM.JJJJ aus den UTC-Feldern von at (wie logDatum im Hauptprozess und das Datum der Liste). */
export function logTag(at: number): string {
  const d = new Date(at);
  return String(d.getUTCDate()).padStart(2, "0") + "." + String(d.getUTCMonth() + 1).padStart(2, "0") + "." + String(d.getUTCFullYear());
}
/** Der Satz, der einen einzelnen Kampf zum Loeschen bestaetigt: der Boss wie im Log, ein Leerzeichen, der Tag der Liste. */
export function loeschBestaetigung(boss: string, at: number): string { return boss + " " + logTag(at); }
/** Was zum Loeschen dieser Kaempfe einzutippen ist: bei einem sein Satz, bei mehreren die Anzahl in Ziffern. */
export function loeschSoll(kaempfe: readonly {boss: string; at: number}[]): string {
  return kaempfe.length === 1 ? loeschBestaetigung(kaempfe[0]!.boss, kaempfe[0]!.at) : String(kaempfe.length);
}
/** Stimmt die Eingabe? Getrimmt und ohne Gross-/Kleinschreibung, wie der Hauptprozess vergleicht. */
export function bestaetigungOk(eingabe: string, erwartet: string): boolean {
  return eingabe.trim().toLowerCase() === erwartet.toLowerCase();
}
/** Eine Auswahl mit k umgeschaltet (dazu oder weg); die alte Menge bleibt, wie sie war. */
export function auswahlUmschalten(menge: ReadonlySet<string>, k: string): Set<string> {
  const neu = new Set(menge);
  if(neu.has(k)) neu.delete(k); else neu.add(k);
  return neu;
}
/** Die geloesten Kaempfe je Platz: die Plaetze nach ihrem neuesten geloesten Kampf, darin die neuesten zuerst. */
export function geloesteGruppen(kaempfe: readonly ArchivKampf[]): {platz: string; kaempfe: ArchivKampf[]}[] {
  const aus: {platz: string; kaempfe: ArchivKampf[]}[] = [];
  for(const k of kaempfe.filter(x => x.geloest).sort((a, b) => b.at - a.at)){
    const g = aus.find(x => x.platz === k.platz);
    if(g) g.kaempfe.push(k); else aus.push({platz: k.platz, kaempfe: [k]});
  }
  return aus;
}

/** Das Stueck eines Kampfs aus dem Logtext: Kopfzeilen und alle Zeilen in
    [von - 2000, bis + 2000]; null, wenn nichts darin liegt oder mehr als 8 MB. */
export function kampfZeilen(text: string, von: number, bis: number, zeitAus: (zeile: string) => number | null): string | null {
  return kampfStueck(logZeilen(text, zeitAus), von, bis);
}

/** Ein Log einmal in Zeilen mit ihrer Zeit zerlegt ("kopf": Kopfzeile, immer im Stueck; null: ohne Zeit).
    Die Seite haelt es fuer denselben Text und schneidet daraus jeden Kampf (kampfStueck). */
export interface LogZeilen { zeilen: string[]; zeiten: (number | null | "kopf")[] }
export function logZeilen(text: string, zeitAus: (zeile: string) => number | null): LogZeilen {
  const zeilen: string[] = [], zeiten: (number | null | "kopf")[] = [];
  for(const roh of text.split("\n")){
    const zeile = roh.endsWith("\r") ? roh.slice(0, -1) : roh;
    if(!zeile) continue;
    zeilen.push(zeile);
    zeiten.push(zeile.startsWith("#") || zeile.startsWith("//") || zeile.startsWith("CombatLogVersion") ? "kopf" : zeitAus(zeile));
  }
  return {zeilen, zeiten};
}

/** Das Stueck eines Kampfs aus einem zerlegten Log, nach denselben Regeln wie kampfZeilen. */
export function kampfStueck(l: LogZeilen, von: number, bis: number): string | null {
  const aus: string[] = [];
  let treffer = 0, groesse = 0;
  for(let i = 0; i < l.zeilen.length; i++){
    const t = l.zeiten[i];
    let nimm = t === "kopf";
    if(!nimm && typeof t === "number" && t >= von - PUFFER_MS && t <= bis + PUFFER_MS){ nimm = true; treffer++; }
    if(!nimm) continue;
    const zeile = l.zeilen[i]!;
    groesse += zeile.length + 1;
    if(groesse > ARCHIV_MAX_BYTES) return null;
    aus.push(zeile);
  }
  return treffer ? aus.join("\n") : null;
}
