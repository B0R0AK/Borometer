// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Der Kern der Weeklies (Spezifikation 2026-09-29-weeklies-design.md,
   Abschnitte 3 und 5): die Grundliste, die Reset-Regel und der Stand, den
   die Seite zeigt. Rein gerechnet, ohne Seite und ohne Netz; der Test
   (scripts/test-weeklies-core.mjs) liest die Zahlen direkt.

   Reset: alle Takte um 06:00 UTC, ohne Sommer- und Winterzeit (Issue 420):
   woechentlich Mittwoch, taeglich, monatlich am 1., "montag" (Portal der
   Unendlichkeit Mo-Mo) Montag, "turm" (Turm der Gier): 28-Tage-Saison ab
   Mi 11.11.2026 06:00 UTC. Gerechnet wird allein in UTC, die
   Zeitzone des Rechners spielt keine Rolle.

   Die Texte der Punkte stehen nicht hier, sondern im Dictionary unter
   weeklies.punkt.<schluessel> und weeklies.gruppe.<gruppe>. */

export type Takt = "woche" | "tag" | "monat" | "montag" | "turm";
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
  /** der Angreifername, wie das Log ihn schreibt (Spezifikation Twinks 2) */
  log?: string;
  /** der Main: hoechstens einer, nie ein geloester */
  main?: true;
  zu?: Record<string, ZuWahl>;
  zaehler: Record<string, Zaehler>;
  aus: string[]; namen: Record<string, string>;
  eigene: EigenerPunkt[];
  vorwoche?: Vorwoche;
  /** die Turm-Zaehler der Saison davor (wie vorwoche) */
  vorsaison?: Vorwoche;
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

export const RESET_STUNDE = 6;      // 06:00 UTC, ohne Sommer- und Winterzeit
export const RESET_WOCHENTAG = 3;   // Mittwoch, 0 = Sonntag wie Date.getUTCDay
/** Der Wochentag des Takts "montag" (Portal der Unendlichkeit Mo-Mo, 01.10.2026), ebenfalls um 06:00 UTC. */
export const RESET_MONTAG = 1;
const TAG_MS = 86400000;

/** Der Turm der Gier (Spezifikation 2026-11-11-turm-der-gier-design.md): Saisonbeginn Mi 11.11.2026 06:00 UTC, alle 28 Tage. */
export const TURM_START = Date.UTC(2026, 10, 11, RESET_STUNDE);
export const TURM_TAGE = 28;
export const TURM_STUFEN: readonly string[] = Object.freeze(["erwachen", "morgenroete", "zwielicht", "abgrund"]);
export const TURM_EBENEN = 5;
/** Der Schluessel eines Hakens: stufe 0 bis 3, ebene 1 bis 5. Nur Buchstaben und Ziffern, wie der Speicher es verlangt. */
export const turmSchluessel = (stufe: number, ebene: number): string => "turmS" + (stufe + 1) + "E" + ebene;
export const TURM_SCHLUESSEL: readonly string[] = Object.freeze(TURM_STUFEN.flatMap((_, s) => Array.from({length: TURM_EBENEN}, (__, e) => turmSchluessel(s, e + 1))));

/* Ein Kalendertag (als UTC-Mitternacht) um RESET_STUNDE UTC. Keine Zeitzone,
   keine Umstellung: jeder Reset liegt genau auf 06:00:00 UTC. */
const resetAm = (tag: number): number => tag + RESET_STUNDE * 3600000;

/* Der erste Tag des Monats (UTC-Mitternacht), um n Monate verschoben. */
function monatsErster(tag: number, n: number): number {
  const d = new Date(tag);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
}

/** Der letzte Reset (UTC-ms) zu jetztMs: Mi 06:00 UTC, taeglich 06:00 UTC, am 1. um 06:00 UTC, "montag" Mo 06:00 UTC. */
export function letzterReset(jetztMs: number, takt: Takt): number {
  if(takt === "turm") return TURM_START + Math.floor((jetztMs - TURM_START) / (TURM_TAGE * TAG_MS)) * TURM_TAGE * TAG_MS;
  if(takt === "monat"){
    const r = resetAm(monatsErster(jetztMs, 0));
    return r > jetztMs ? resetAm(monatsErster(jetztMs, -1)) : r;
  }
  let tag = Math.floor(jetztMs / TAG_MS) * TAG_MS;
  if(takt !== "tag") tag -= ((new Date(tag).getUTCDay() - (takt === "montag" ? RESET_MONTAG : RESET_WOCHENTAG) + 7) % 7) * TAG_MS;
  let r = resetAm(tag);
  if(r > jetztMs) r = resetAm(tag - (takt === "tag" ? 1 : 7) * TAG_MS);
  return r;
}

/** Der naechste Reset (UTC-ms) nach jetztMs, echt spaeter. */
export function naechsterReset(jetztMs: number, takt: Takt): number {
  const l = letzterReset(jetztMs, takt);
  if(takt === "turm") return l + TURM_TAGE * TAG_MS;
  const tag = Math.floor(l / TAG_MS) * TAG_MS;
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
  if(TURM_SCHLUESSEL.includes(schluessel)) return "turm";
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
  if(profil.vorwoche && profil.vorwoche.reset >= r) return profil;
  // die Vorwoche gilt, wenn ihr Reset in diesem Fenster liegt; so zaehlt auch ein vor der Umstellung (Do 10:00 Berlin) gespeicherter Stand mit
  const alt = profil.vorwoche && profil.vorwoche.reset >= r0 ? profil.vorwoche.zaehler : null;
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
  // der gespeicherte Reset bleibt (auch ein alter aus Do 10:00 Berlin): die Datei nimmt keinen kleineren an
  const reset = alt && profil.vorwoche ? profil.vorwoche.reset : r0;
  return {...profil, vorwoche: {reset, zaehler: {...(alt || {}), ...neu}}};
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

/** Die Wochenzaehler der Woche davor, je Charakter "n von g"; null, wenn in der laufenden Woche schon etwas gesetzt ist (Turm-Haken zaehlen nicht) oder nichts zu zeigen ist (4.5). */
export function letzteWoche(profile: WeeklyProfil[], jetztMs: number): LetzteWoche[] | null {
  const r = letzterReset(jetztMs, "woche"), r0 = letzterReset(r - 1, "woche");
  const gesetzt = (z: Zaehler | undefined): z is Zaehler => !!z && typeof z.seit === "number" && typeof z.stand === "number";
  if(profile.some(q => Object.entries(q.zaehler || {}).some(([k, z]) => !TURM_SCHLUESSEL.includes(k) && gesetzt(z) && z.seit >= r))) return null;
  const out: LetzteWoche[] = [];
  for(const q of profile){
    const stand: Record<string, number> = {};
    for(const [k, z] of Object.entries(q.zaehler || {})) if(gesetzt(z) && z.seit >= r0 && z.seit < r && taktVon(q, k) === "woche") stand[k] = z.stand;
    if(q.vorwoche && q.vorwoche.reset >= r0 && q.vorwoche.reset < r) for(const [k, z] of Object.entries(q.vorwoche.zaehler || {})) if(gesetzt(z)) stand[k] = z.stand;
    if(!Object.keys(stand).length) continue;
    const punkte = sichtbarePunkte(q).filter(x => x.takt === "woche");
    out.push({id: q.id, name: q.name, n: punkte.filter(x => Math.min(x.menge, stand[x.schluessel] ?? 0) >= x.menge).length, g: punkte.length});
  }
  return out.length ? out : null;
}

export interface TurmStand { n: number; g: number; stufen: {n: number; g: number}[] }
const turmGesetzt = (z: Zaehler | undefined, jetztMs: number) => anzeigeStand(z, "turm", jetztMs) >= 1;
/** Die Haken des Turms: gesamt und je Stufe, gezaehlt wird nur die laufende Saison. Der Wochen-Fortschritt kennt sie nicht. */
export function fortschrittTurm(profil: WeeklyProfil, jetztMs: number): TurmStand {
  const stufen = TURM_STUFEN.map((_, s) => {
    let n = 0;
    for(let e = 1; e <= TURM_EBENEN; e++) if(turmGesetzt(profil.zaehler ? profil.zaehler[turmSchluessel(s, e)] : undefined, jetztMs)) n++;
    return {n, g: TURM_EBENEN};
  });
  return {n: stufen.reduce((a, s) => a + s.n, 0), g: TURM_STUFEN.length * TURM_EBENEN, stufen};
}

/** Die laufende Saison: Beginn, naechster Reset und die Resttage (aufgerundet, mindestens 1). */
export function turmSaison(jetztMs: number): {start: number; ende: number; tage: number} {
  const start = letzterReset(jetztMs, "turm"), ende = naechsterReset(jetztMs, "turm");
  return {start, ende, tage: Math.max(1, Math.ceil((ende - jetztMs) / TAG_MS))};
}

/* Vorsaison (wie vorwocheSichern): liegt ein Saison-Reset nach dem letzten Setzen, werden die Turm-Zaehler der Saison
   davor als vorsaison aufbewahrt, bevor ein neuer Stand sie ueberschreibt. Eine Saison, nicht mehr; eine neuere
   ersetzt die aeltere, nie umgekehrt. Ohne Aenderung kommt dasselbe Objekt zurueck. */
export function vorsaisonSichern<P extends WeeklyProfil>(profil: P, jetztMs: number): P {
  const r = letzterReset(jetztMs, "turm");
  const r0 = letzterReset(r - 1, "turm");
  if(profil.vorsaison && profil.vorsaison.reset >= r) return profil;
  const alt = profil.vorsaison && profil.vorsaison.reset >= r0 ? profil.vorsaison.zaehler : null;
  const neu: Record<string, Zaehler> = {};
  let dazu = 0;
  for(const [k, z] of Object.entries(profil.zaehler || {})) {
    if(!z || typeof z.seit !== "number" || z.seit < r0 || z.seit >= r) continue;
    if(!TURM_SCHLUESSEL.includes(k)) continue;
    if(alt && k in alt) continue;
    neu[k] = {stand: z.stand, seit: z.seit};
    dazu++;
  }
  if(!dazu) return profil;
  const reset = alt && profil.vorsaison ? profil.vorsaison.reset : r0;
  return {...profil, vorsaison: {reset, zaehler: {...(alt || {}), ...neu}}};
}

/** Die Haken der Saison davor, "n von 20"; null, wenn es keine gibt (erste Saison, nichts gesetzt). */
export function letzteSaison(profil: WeeklyProfil, jetztMs: number): {n: number; g: number} | null {
  const r = letzterReset(jetztMs, "turm"), r0 = letzterReset(r - 1, "turm");
  const gesetzt = (z: Zaehler | undefined): z is Zaehler => !!z && typeof z.seit === "number" && typeof z.stand === "number";
  const stand: Record<string, number> = {};
  for(const [k, z] of Object.entries(profil.zaehler || {})) if(gesetzt(z) && z.seit >= r0 && z.seit < r && TURM_SCHLUESSEL.includes(k)) stand[k] = z.stand;
  if(profil.vorsaison && profil.vorsaison.reset >= r0 && profil.vorsaison.reset < r)
    for(const [k, z] of Object.entries(profil.vorsaison.zaehler || {})) if(gesetzt(z) && TURM_SCHLUESSEL.includes(k)) stand[k] = z.stand;
  if(!Object.keys(stand).length) return null;
  return {n: TURM_SCHLUESSEL.filter(k => (stand[k] ?? 0) >= 1).length, g: TURM_SCHLUESSEL.length};
}
