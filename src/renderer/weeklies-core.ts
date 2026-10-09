// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Der Kern der Weeklies (Spezifikation 2026-09-29-weeklies-design.md,
   Abschnitte 3 und 5): die Grundliste, die Reset-Regel und der Stand, den
   die Seite zeigt. Rein gerechnet, ohne Seite und ohne Netz; der Test
   (scripts/test-weeklies-core.mjs) liest die Zahlen direkt.

   Reset: woechentlich Donnerstag 10:00, taeglich 10:00, monatlich am 1.
   um 10:00 (Spezifikation 10, Annahme bis zur Bestaetigung), "montag"
   Montag 10:00 (Portal der Unendlichkeit Mo-Mo), alles deutsche
   Zeit (Europe/Berlin, mit Sommer- und Winterzeit). Die Uhr des Rechners
   zaehlt nicht: die Wandzeit in Berlin kommt allein aus
   Intl.DateTimeFormat mit timeZone "Europe/Berlin", kein fester Versatz.

   Die Texte der Punkte stehen nicht hier, sondern im Dictionary unter
   weeklies.punkt.<schluessel> und weeklies.gruppe.<gruppe>. */

export type Takt = "woche" | "tag" | "monat" | "montag";
export interface WeeklyPunkt { schluessel: string; gruppe: string; menge: number; takt: Takt }
export interface Zaehler { stand: number; seit: number }
export interface EigenerPunkt { schluessel: string; name: string; menge: number; takt: Takt; geloest?: boolean }
export interface Vorwoche { reset: number; zaehler: Record<string, Zaehler> }
/** Die Wahl beim Ein- oder Aufklappen eines Bereichs und der Fertig-Zustand dabei (Spezifikation Weeklies neu, 4.4). */
export interface ZuWahl { zu: boolean; bei: boolean }
/** Eine Erinnerung, wie die Datei sie haelt (src/main/weeklies.ts: Reminder); die Seite zeigt und aendert sie nur. */
export interface Erinnerung { id: string; an: boolean; tage: number[]; zeit: string; text: string; nurOffen: boolean; geloest?: boolean }
export interface Fortschritt {
  woche: { n: number; g: number; anteil: number };
  tag: { n: number; g: number };
  fertig: boolean;
}
export interface LetzteWoche { id: string; name: string; n: number; g: number }
export interface WeeklyProfil {
  id: string; name: string; geloest?: boolean;
  zu?: Record<string, ZuWahl>;
  zaehler: Record<string, Zaehler>;
  aus: string[]; namen: Record<string, string>;
  eigene: EigenerPunkt[];
  vorwoche?: Vorwoche;
}

/* Die Grundliste in der Reihenfolge der Spezifikation (3, seit 10 die
   Haendler in ihrer Folge). Menge 1 ist ein Haken, mehr ist ein Zaehler.
   Ein Gegenstand bei zwei Haendlern hat je Haendler einen eigenen
   Schluessel: jeder Haendler hat sein eigenes Limit. */
const p = (schluessel: string, gruppe: string, menge: number, takt: Takt = "woche"): WeeklyPunkt =>
  Object.freeze({schluessel, gruppe, menge, takt});
export const GRUNDLISTE: readonly WeeklyPunkt[] = Object.freeze([
  p("zitadelleNormal", "raid", 1), p("zitadelleSchwer", "raid", 1), p("zitadelleAlbtraum", "raid", 1),
  p("korridorNormal", "raid", 1), p("korridorSchwer", "raid", 1), p("korridorAlbtraum", "raid", 1),
  p("altarNormal", "raid", 1), p("altarSchwer", "raid", 1), p("altarAlbtraum", "raid", 1),
  p("illusionen", "geheimdungeon", 3), p("unendlichkeit", "geheimdungeon", 1), p("unendlichkeitMontag", "geheimdungeon", 1, "montag"),
  p("regionszertifikat", "events", 3),
  p("dimensionDungeons", "dimension", 7), p("goldeneKiste", "dimension", 5),
  p("phantomstein", "gemischtwaren", 1, "tag"), p("vertragNyx", "gemischtwaren", 1, "tag"),
  p("vertragTaedal", "gemischtwaren", 3),
  p("umwandlungsstein", "gildenhaendler", 100), p("chaosprisma", "gildenhaendler", 3),
  p("mystischerSchluessel", "vertragsmuenzen", 5), p("heroischVerzauberung", "vertragsmuenzen", 3),
  p("heroischFreischalt", "vertragsmuenzen", 8), p("freischaltFragment", "vertragsmuenzen", 75),
  p("katalysator", "vertragsmuenzen", 20), p("siegelschluessel", "vertragsmuenzen", 1),
  p("widerstandHeroischFreischalt", "widerstandswaren", 4), p("widerstandFreischaltFragment", "widerstandswaren", 6),
  p("vererbungsstein", "widerstandswaren", 2, "monat"),
  p("wachstumsbuch", "widerstandswaren", 5), p("wachstumsbuchAllmacht", "widerstandswaren", 2),
  p("truhePvp", "ehrenmuenzen", 3),
  p("verzauberungsstein", "raidwaren", 12), p("segenstascheChaos", "raidwaren", 5),
  p("auswahltruheVerzauberung", "raidwaren", 1), p("raidChaosprisma", "raidwaren", 1),
]);

export const RESET_STUNDE = 10;
export const RESET_WOCHENTAG = 4;   // Donnerstag, 0 = Sonntag wie Date.getUTCDay
/** Der Wochentag des Takts "montag" (Portal der Unendlichkeit Mo-Mo, 01.10.2026). */
export const RESET_MONTAG = 1;
const TAG_MS = 86400000;

/* Die Wandzeit in Berlin zu einem Zeitpunkt. Die Felder werden als
   UTC-Felder gelesen: wand(ms) - ms ist der Versatz Berlins zu UTC. */
const BERLIN = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});
function wand(ms: number): number {
  const f: Record<string, number> = {};
  for(const t of BERLIN.formatToParts(ms)) if(t.type !== "literal") f[t.type] = Number(t.value);
  const n = (k: string): number => f[k] ?? 0;
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute"), n("second"));
}
const versatz = (ms: number): number => wand(Math.floor(ms / 1000) * 1000) - Math.floor(ms / 1000) * 1000;

/* Ein Kalendertag (als UTC-Mitternacht seiner Felder) um RESET_STUNDE in
   Berlin, als echter UTC-Zeitpunkt. 10:00 liegt nie in der Umstellung
   (2:00 bis 3:00), der zweite Blick auf den Versatz genuegt also. */
function resetAm(tagFelder: number): number {
  const w = tagFelder + RESET_STUNDE * 3600000;
  const erst = w - versatz(w);
  return w - versatz(erst);
}

/* Der erste Tag des Monats (UTC-Mitternacht seiner Felder), um n Monate verschoben. */
function monatsErster(tagFelder: number, n: number): number {
  const d = new Date(tagFelder);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
}

/** Der letzte Reset (UTC-ms) zu jetztMs: Do 10:00, taeglich 10:00 bzw. am 1. um 10:00 in Berlin. */
export function letzterReset(jetztMs: number, takt: Takt): number {
  const w = wand(jetztMs);
  if(takt === "monat"){
    const r = resetAm(monatsErster(w, 0));
    return r > jetztMs ? resetAm(monatsErster(w, -1)) : r;
  }
  let tag = Math.floor(w / TAG_MS) * TAG_MS;
  if(takt !== "tag") tag -= ((new Date(tag).getUTCDay() - (takt === "montag" ? RESET_MONTAG : RESET_WOCHENTAG) + 7) % 7) * TAG_MS;
  let r = resetAm(tag);
  if(r > jetztMs) r = resetAm(tag - (takt === "tag" ? 1 : 7) * TAG_MS);
  return r;
}

/** Der naechste Reset (UTC-ms) nach jetztMs, echt spaeter. */
export function naechsterReset(jetztMs: number, takt: Takt): number {
  const l = letzterReset(jetztMs, takt);
  const tag = Math.floor(wand(l) / TAG_MS) * TAG_MS;
  if(takt === "monat") return resetAm(monatsErster(tag, 1));
  return resetAm(tag + (takt === "tag" ? 1 : 7) * TAG_MS);
}

/** Der Stand, den die Seite zeigt: 0, wenn vor dem letzten Reset gesetzt. */
export function anzeigeStand(z: Zaehler | undefined, takt: Takt, jetztMs: number): number {
  if(!z || typeof z.stand !== "number" || typeof z.seit !== "number" || !isFinite(z.stand) || !isFinite(z.seit)) return 0;
  if(z.seit < letzterReset(jetztMs, takt)) return 0;
  return Math.max(0, Math.floor(z.stand));
}

/* Der Takt eines Schluessels: Grundliste oder eigener Punkt; unbekannt
   heisst null (der Punkt zaehlt fuer die Vorwoche nicht). */
function taktVon(profil: WeeklyProfil, schluessel: string): Takt | null {
  const g = GRUNDLISTE.find(x => x.schluessel === schluessel);
  if(g) return g.takt;
  const e = (profil.eigene || []).find(x => x && x.schluessel === schluessel);
  return e && (e.takt === "woche" || e.takt === "tag") ? e.takt : null;   // eigene Punkte kennen keinen Monat
}

/* Vorwoche (Spezifikation 5): liegt ein Wochen-Reset nach dem letzten
   Setzen, werden die Wochenzaehler der Woche davor als vorwoche
   aufbewahrt, bevor ein neuer Stand sie ueberschreibt. Eine Woche, nicht
   mehr: eine neuere Vorwoche ersetzt die aeltere, nie umgekehrt. Die Zaehler selbst
   bleiben; das Profil wird nicht veraendert, ohne Aenderung kommt dasselbe
   Objekt zurueck. */
export function vorwocheSichern<P extends WeeklyProfil>(profil: P, jetztMs: number): P {
  const r = letzterReset(jetztMs, "woche");
  const r0 = letzterReset(r - 1, "woche");
  // eine gespeicherte Vorwoche, die neuer ist (Uhr zurueckgestellt), bleibt: die Datei nimmt keine aeltere an
  if(profil.vorwoche && profil.vorwoche.reset > r0) return profil;
  const alt = profil.vorwoche && profil.vorwoche.reset === r0 ? profil.vorwoche.zaehler : null;
  const neu: Record<string, Zaehler> = {};
  let dazu = 0;
  for(const [k, z] of Object.entries(profil.zaehler || {})) {
    if(!z || typeof z.seit !== "number" || z.seit < r0 || z.seit >= r) continue;
    if(taktVon(profil, k) !== "woche") continue;
    if(alt && k in alt) continue;
    neu[k] = {stand: z.stand, seit: z.seit};
    dazu++;
  }
  if(!dazu) return profil;
  return {...profil, vorwoche: {reset: r0, zaehler: {...(alt || {}), ...neu}}};
}

/* Die Punkte eines Charakters, die gezeigt und gezaehlt werden: die Grundliste ohne die
   ausgeblendeten, dazu seine eigenen, soweit nicht geloest (Spezifikation Weeklies neu, 4.1). */
export function sichtbarePunkte(profil: WeeklyProfil): WeeklyPunkt[] {
  const aus = new Set(profil.aus || []);
  const grund = GRUNDLISTE.filter(g => !aus.has(g.schluessel));
  const eigene = (profil.eigene || []).filter(e => e && !e.geloest).map(e => p(e.schluessel, "eigene", e.menge, e.takt));
  return [...grund, ...eigene];
}

/** Woche (alles ausser taeglich) und Tag getrennt; der Ring zeigt den Anteil nach Menge, "fertig" rechnet nur die Woche (4.2). */
export function fortschrittVon(profil: WeeklyProfil, jetztMs: number): Fortschritt {
  let wn = 0, wg = 0, wa = 0, tn = 0, tg = 0;
  for(const x of sichtbarePunkte(profil)){
    const s = Math.min(x.menge, anzeigeStand(profil.zaehler ? profil.zaehler[x.schluessel] : undefined, x.takt, jetztMs));
    if(x.takt === "tag"){ tg++; if(s >= x.menge) tn++; }
    else { wg++; wa += s / x.menge; if(s >= x.menge) wn++; }
  }
  return {woche: {n: wn, g: wg, anteil: wg ? wa / wg : 0}, tag: {n: tn, g: tg}, fertig: wg > 0 && wn === wg};
}

/** Ob ein Bereich zu ist: die Wahl gilt nur, solange der Fertig-Zustand noch der von damals ist; sonst "zu, wenn fertig" (4.4). */
export function bereichZu(wahl: ZuWahl | undefined, fertig: boolean): boolean {
  return wahl && wahl.bei === fertig ? wahl.zu : fertig;
}

/** Die Wochenzaehler der Woche davor, je Charakter "n von g"; null, wenn in der laufenden Woche schon etwas gesetzt ist oder nichts zu zeigen ist (4.5). */
export function letzteWoche(profile: WeeklyProfil[], jetztMs: number): LetzteWoche[] | null {
  const r = letzterReset(jetztMs, "woche"), r0 = letzterReset(r - 1, "woche");
  const gesetzt = (z: Zaehler | undefined): z is Zaehler => !!z && typeof z.seit === "number" && typeof z.stand === "number";
  if(profile.some(q => Object.values(q.zaehler || {}).some(z => gesetzt(z) && z.seit >= r))) return null;
  const out: LetzteWoche[] = [];
  for(const q of profile){
    const stand: Record<string, number> = {};
    for(const [k, z] of Object.entries(q.zaehler || {})) if(gesetzt(z) && z.seit >= r0 && z.seit < r && taktVon(q, k) === "woche") stand[k] = z.stand;
    if(q.vorwoche && q.vorwoche.reset === r0) for(const [k, z] of Object.entries(q.vorwoche.zaehler || {})) if(gesetzt(z)) stand[k] = z.stand;
    if(!Object.keys(stand).length) continue;
    const punkte = sichtbarePunkte(q).filter(x => x.takt === "woche");
    out.push({id: q.id, name: q.name, n: punkte.filter(x => Math.min(x.menge, stand[x.schluessel] ?? 0) >= x.menge).length, g: punkte.length});
  }
  return out.length ? out : null;
}
