// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Die Punkte des Verlaufs ueber die Zeit (Neugestaltung 28.09., Luecken 6.1
   bis 6.3): ein Punktediagramm je Boss, rein gerechnet, ohne Seite und ohne
   Netz. Die Seite (32-history.ts) zeichnet daraus ein SVG; der Test
   (scripts/test-verlauf-core.mjs) liest die Zahlen direkt.

   x ist das Datum. Frueher stand x in der Reihenfolge der Kaempfe, damit
   ein Abend nicht als Klumpen am Rand steht; der Entwurf zeigt die Tage
   (Woche, Monat, Alles), und ein Abend ist dort ein senkrechter Streifen
   Punkte - so sieht man, an welchen Tagen gekaempft wurde. Ausnahme seit
   dem Feinschliff (02.10.): liegt alles an einem Abend (abendAchse), stehen
   die Pulls wieder nacheinander (pullLagen).
   Die Uhr ist die des Logs: Zeitstempel stehen als UTC-Felder (wallTime,
   pullWhen), ein Tag beginnt also um 0:00 UTC dieser Felder.
   y ist die DPS ab 0 - ein Diagramm, das bei 80k beginnt, macht aus 5 %
   eine Treppe.
   Die Groesse des Punktes ist die Dauer: kurze Pulls liegen oft hoch, und
   man soll sie als kurz erkennen.
   Die waagerechte Linie ist der Median, nicht der Mittelwert, ueber die
   Kaempfe im Zeitraum und erst ab MIN_MEDIAN Kaempfen, wie ueberall in der
   App. "sonst" im Kampf kann davon abweichen - es zaehlt alle Kaempfe am
   Boss, und nur die desselben Builds, wo es davon zwei gibt. */
import { MIN_MEDIAN, mitte } from "./build-core";

export interface PunktKampf { dps: number; dur: number }
export interface ZeitKampf extends PunktKampf { at: number }
export interface PunktLage { x: number; y: number; r: number }
export interface Rand { links: number; rechts: number; oben: number; unten: number }
export interface PunktFlaeche { breite: number; hoehe: number; rand: number | Rand }

export const TAG_MS = 86400000;
/** Der Beginn des Tages auf der Uhr des Logs (UTC-Felder). */
export const tagVon = (ms: number): number => Math.floor(ms / TAG_MS) * TAG_MS;

/* Der Zeitraum (Luecke 6.1). Er endet mit dem Tag des neuesten Kampfs am
   Boss, nicht mit der Uhr des Rechners: die Seite kennt "heute" nur aus dem
   Log, und wer einen Boss zwei Monate nicht gesehen hat, soll unter "Woche"
   seine letzte Woche an ihm sehen und kein leeres Bild (Entscheidung vom
   29.09., an Claude uebertragen). Woche 7, Monat 30 Tage, Alles
   ab dem Tag des aeltesten Kampfs. */
export type Zeitraum = "woche" | "monat" | "alles";
export const ZEITRAUM_TAGE = {woche: 7, monat: 30} as const;
export interface Spanne { von: number; bis: number; tage: number }
export function zeitSpanne(ats: readonly number[], z: Zeitraum): Spanne | null {
  if(!ats.length) return null;
  const bis = tagVon(Math.max(...ats)) + TAG_MS;
  const tage = z === "alles" ? Math.round((bis - tagVon(Math.min(...ats))) / TAG_MS) : ZEITRAUM_TAGE[z];
  return {von: bis - tage * TAG_MS, bis, tage};
}
/** Die Kaempfe in der Spanne: ab dem ersten Augenblick von "von", bis vor "bis". */
export function imZeitraum<T extends {at: number}>(kaempfe: readonly T[], s: Spanne): T[] {
  return kaempfe.filter(k => k.at >= s.von && k.at < s.bis);
}

/* Gelesene und gespeicherte Kaempfe (das Verlaufsverzeichnis logIndex, die
   gespeicherten Kaempfe und die besten Pulls): derselbe Kampf steht oft in
   mehreren, er hat dann denselben Beginn. Er zaehlt einmal, die erste
   Quelle gewinnt; heraus kommt die Liste nach der Zeit. */
export function zusammenfuehren<T extends {at: number}>(...quellen: readonly (readonly T[])[]): T[] {
  const da = new Set<number>(), raus: T[] = [];
  for(const q of quellen) for(const k of q){ if(da.has(k.at)) continue; da.add(k.at); raus.push(k); }
  return raus.sort((a, b) => a.at - b.at);
}

/* Die Teilstriche der Datumsachse: Tagesanfaenge, vom letzten Tag der
   Spanne rueckwaerts in gleichen Schritten - der Tag des neuesten Kampfs
   steht immer da. Der Schritt ist der kleinste aus 1, 2, 5, 7, 14, 30, 61,
   91, 182 und 365 Tagen, bei dem hoechstens "max" Striche entstehen. */
const SCHRITTE = [1, 2, 5, 7, 14, 30, 61, 91, 182, 365];
export function datumStriche(s: Spanne, max: number): number[] {
  const letzter = s.bis - TAG_MS;
  const schritt = SCHRITTE.find(x => Math.floor((s.tage - 1) / x) + 1 <= max) ?? s.tage;
  const raus: number[] = [];
  for(let d = letzter; d >= s.von && (raus.length < max || !raus.length); d -= schritt * TAG_MS) raus.push(d);
  return raus.reverse();
}

/** Radius nach der Dauer in Sekunden: r = 3 + min(4, sqrt(dauer/30) * 1.6). */
export function punktRadius(dauer: number): number {
  return 3 + Math.min(4, Math.sqrt(Math.max(0, dauer) / 30) * 1.6);
}

/* Eine runde Schrittweite: 1, 2, 2.5 oder 5 mal eine Zehnerpotenz (Luecke
   6.3, "vier runde Werte"), mit drei bis fuenf Schritten, und davon die, deren
   Ende am knappsten ueber dem besten Wert plus 5 % liegt - so klebt dessen
   Punkt nicht am Rand, und oben bleibt nicht ein Drittel leer (Pruefung
   29.09., Befund 4: aus 0/100k/200k/300k fuer 212k wird 0 bis 250k). Bei
   gleichem Ende gewinnt der groessere Schritt. */
function achse(best: number): { max: number; striche: number[] } {
  if(!(best > 0)) return {max: 1, striche: [0, 1]};
  const ziel = best * 1.05;
  let schritt = 0, n = 0;
  const e0 = Math.floor(Math.log10(ziel));
  for(let e = e0 - 2; e <= e0 + 1; e++) for(const f of [1, 2, 2.5, 5]){
    const s = f * Math.pow(10, e), m = Math.ceil(ziel / s);
    if(m < 3 || m > 5) continue;
    if(!schritt || m * s < n * schritt - 1e-9 || (Math.abs(m * s - n * schritt) <= 1e-9 && s > schritt)){ schritt = s; n = m; }
  }
  const striche: number[] = [];
  for(let i = 0; i <= n; i++) striche.push(i * schritt);
  return {max: n * schritt, striche};
}

export interface ZeitBild {
  /** "datum": x ist die Zeit; "pull": x ist die Reihenfolge (der Abend zuerst) */
  art: "datum" | "pull";
  punkte: PunktLage[];
  /** Index des Kampfs mit der hoechsten DPS (der erste bei Gleichstand), -1 ohne Kaempfe */
  bester: number;
  /** mitte() der DPS, erst ab MIN_MEDIAN Kaempfen, sonst null */
  median: number | null;
  medianY: number | null;
  /** oberes Ende der y-Achse (eine runde Zahl ueber dem besten Wert) */
  max: number;
  /** Teilstriche der y-Achse, von 0 bis max */
  striche: number[];
  /** Tagesanfaenge fuer die Datumsachse (datumStriche) */
  tage: number[];
  /** DPS -> y */
  y: (dps: number) => number;
  /** Zeitpunkt (ms, Uhr des Logs) -> x */
  x: (ms: number) => number;
  /** der Tag eines Zeitpunkts als Band von x0 bis x1 */
  band: (ms: number) => { x0: number; x1: number };
  /** die Beschriftungen der x-Achse: wo (x) und welcher Zeitpunkt (at) -
      auf der Datumsachse der Tagesanfang, auf der Pull-Achse der Beginn des Pulls */
  marken: { x: number; at: number }[];
}

/* y, bester und Median, gleich fuer beide Achsen. */
function yTeil(kaempfe: readonly PunktKampf[], flaeche: PunktFlaeche) {
  const r = flaeche.rand;
  const rand: Rand = typeof r === "number" ? {links: r, rechts: r, oben: r, unten: r} : r;
  const innenB = Math.max(0, flaeche.breite - rand.links - rand.rechts);
  const innenH = Math.max(0, flaeche.hoehe - rand.oben - rand.unten);
  const dps = kaempfe.map(k => Math.max(0, k.dps || 0));
  let bester = -1;
  dps.forEach((d, i) => { if(bester < 0 || d > dps[bester]!) bester = i; });
  const {max, striche} = achse(bester < 0 ? 0 : dps[bester]!);
  const unten = flaeche.hoehe - rand.unten;
  const y = (d: number) => unten - innenH * Math.max(0, d) / max;
  const median = kaempfe.length >= MIN_MEDIAN ? mitte(dps) : null;
  return {rand, innenB, dps, bester, max, striche, y, median, medianY: median == null ? null : y(median)};
}

/* Die Lagen der Punkte: x nach dem Beginn des Kampfs in der Spanne, y nach
   der DPS. maxStriche begrenzt die Beschriftungen der Datumsachse (die
   Seite gibt sie nach der Breite vor). */
export function zeitLagen(kaempfe: readonly ZeitKampf[], flaeche: PunktFlaeche, s: Spanne, maxStriche: number): ZeitBild {
  const {rand, innenB, dps, bester, max, striche, y, median, medianY} = yTeil(kaempfe, flaeche);
  const lang = Math.max(1, s.bis - s.von);
  const x = (ms: number) => rand.links + innenB * (ms - s.von) / lang;
  const punkte = kaempfe.map((k, i) => ({x: x(k.at), y: y(dps[i]!), r: punktRadius(k.dur)}));
  const band = (ms: number) => { const t = tagVon(ms); return {x0: x(t), x1: x(t + TAG_MS)}; };
  const tage = datumStriche(s, maxStriche);
  return {art: "datum", punkte, bester, median, medianY, max, striche,
          tage, y, x, band, marken: tage.map(d => ({x: x(d + TAG_MS / 2), at: d}))};
}

/* Der Abend zuerst (Feinschliff 02.10., Abschnitt 4): ein Abend auf der
   Monatsachse ist ein schmaler Streifen am Rand. Liegen alle Kaempfe an
   hoechstens zwei aufeinanderfolgenden Kalendertagen (ein Abend, auch ueber
   Mitternacht), stehen die Pulls nacheinander. Zwei Tage mit Luecke
   dazwischen (16. und 20.) sind kein Abend - dort sagt die Datumsachse,
   wie weit sie auseinanderliegen. Kein neuer Schalter. */
export function abendAchse(ats: readonly number[]): boolean {
  if(!ats.length) return false;
  const tage = ats.map(tagVon);
  return Math.max(...tage) - Math.min(...tage) <= TAG_MS;
}

/* Die Pull-Achse: je Pull ein gleich breites Feld, der Punkt in seiner
   Mitte (Pull 1 links), beschriftet mit der Uhrzeit. Hoechstens "max"
   Beschriftungen, ab Pull 1 in Schritten aus 1, 2, 5, 10, 20, 50 ...
   Der Tag eines Pulls ist als Band das Feld vom ersten bis zum letzten
   Pull dieses Tages. Die Kaempfe kommen nach der Zeit sortiert. */
const PULL_SCHRITTE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
export function pullLagen(kaempfe: readonly ZeitKampf[], flaeche: PunktFlaeche, maxStriche: number): ZeitBild {
  const {rand, innenB, dps, bester, max, striche, y, median, medianY} = yTeil(kaempfe, flaeche);
  const n = kaempfe.length, feld = n ? innenB / n : innenB;
  const xi = (i: number) => rand.links + feld * (i + 0.5);
  const index = (ms: number) => {
    let j = 0;
    kaempfe.forEach((k, i) => { if(Math.abs(k.at - ms) < Math.abs(kaempfe[j]!.at - ms)) j = i; });
    return j;
  };
  const x = (ms: number) => n ? xi(index(ms)) : rand.links + innenB / 2;
  const punkte = kaempfe.map((k, i) => ({x: xi(i), y: y(dps[i]!), r: punktRadius(k.dur)}));
  const band = (ms: number) => {
    const t = tagVon(ms);
    let a = -1, b = -1;
    kaempfe.forEach((k, i) => { if(tagVon(k.at) === t){ if(a < 0) a = i; b = i; } });
    if(a < 0) return {x0: x(ms), x1: x(ms)};
    return {x0: rand.links + feld * a, x1: rand.links + feld * (b + 1)};
  };
  const schritt = PULL_SCHRITTE.find(s => Math.ceil(n / s) <= Math.max(1, maxStriche)) ?? n;
  const marken: { x: number; at: number }[] = [];
  for(let i = 0; i < n; i += schritt) marken.push({x: xi(i), at: kaempfe[i]!.at});
  return {art: "pull", punkte, bester, median, medianY, max, striche,
          tage: [], y, x, band, marken};
}

/* "Zuletzt geoeffnet" auf Start (Neugestaltung 28.09., Luecken 1.8; der Kern
   vom Branch claude/entwurf-angleichung samt Proben): aus dem Verzeichnis
   der Logdateien (logIndex, je Dateiname die Bosskaempfe mit at und dur)
   die zuletzt gelesenen Dateien. Geoeffnet werden sie auf Start ueber
   GET /api/log (45-startup.ts, Nachtraege N3). Die Zeiten im Log sind die Wanduhr des
   Spielers, als UTC-Felder abgelegt (parseTime, 03-helpers.ts): gelesen
   wird darum mit getUTC*. Eine Zeit ohne Datum (unter einem Jahr ab 1970)
   hat keinen Tag, dann bleibt tag leer. Neueste zuerst, nach dem Ende des
   letzten Kampfs. Das Verzeichnis kennt nur die Kaempfe, die in den
   Verlauf gehen (Bosse und Uebungspuppe) - die Seite sagt deshalb
   "Kaempfe im Verlauf". Eine Datei, die nur die Rekorde nachgelesen haben
   (nach, 32-history.ts histNachlesen) und die nie geoeffnet wurde, steht
   nicht hier: geoeffnet hat sie niemand. */
export interface ZuletztKampf { at: number; dur: number }
export interface ZuletztZeile { datei: string; tag: string; von: string; bis: string; n: number; ende: number }
const JAHR_MS = 366 * TAG_MS;
const zwei = (n: number) => String(n).padStart(2, "0");
const uhr = (ms: number) => { const d = new Date(ms); return zwei(d.getUTCHours()) + ":" + zwei(d.getUTCMinutes()); };
export function zuletztGeoeffnet(dateien: Readonly<Record<string, { fights?: readonly ZuletztKampf[]; nach?: unknown } | undefined>> | undefined, anzahl = 3): ZuletztZeile[] {
  const zeilen: ZuletztZeile[] = [];
  for(const [datei, e] of Object.entries(dateien || {})){
    if(e && e.nach) continue;
    const k = (e && e.fights || []).filter(f => f && Number.isFinite(f.at));
    if(!k.length) continue;
    const anfang = Math.min(...k.map(f => f.at));
    const ende = Math.max(...k.map(f => f.at + Math.max(0, f.dur || 0) * 1000));
    const d = new Date(anfang);
    const tag = anfang >= JAHR_MS ? zwei(d.getUTCDate()) + "." + zwei(d.getUTCMonth() + 1) + "." : "";
    zeilen.push({datei, tag, von: uhr(anfang), bis: uhr(ende), n: k.length, ende});
  }
  zeilen.sort((a, b) => b.ende - a.ende || (a.datei < b.datei ? -1 : 1));
  return zeilen.slice(0, Math.max(0, anzahl));
}

/* Fruehere Tage in der Kampfwahl (Nachtraege N3): die Logdateien des
   Ordners, wie GET /api/logs sie meldet (mtime in ganzen Sekunden), nach dem
   Tag ihrer Aenderungszeit. Anders als die Kaempfe oben (Uhr des Logs) gilt
   hier die Uhr in Europe/Berlin: eine Datei, die um 0:30 zuletzt geschrieben
   wurde, gehoert zum neuen Tag (Entscheidung vom 30.09.2026, an
   Claude uebertragen). Der neueste Tag zuerst, im Tag die aelteste Datei
   zuerst - so steht der Abend in der Reihenfolge, in der er gespielt wurde.
   Eine Datei ohne Namen oder Zeit faellt weg. */
export interface LogDatei { name: string; size: number; mtime: number }
export interface LogTag { tag: string; dateien: LogDatei[] }
const BERLIN = new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit"});
/** Der Tag in Berlin als "JJJJ-MM-TT". */
export function berlinTag(ms: number): string {
  const t = Object.fromEntries(BERLIN.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return t.year + "-" + t.month + "-" + t.day;
}
export function logTage(dateien: readonly LogDatei[] | undefined): LogTag[] {
  const je = new Map<string, LogDatei[]>();
  for(const d of dateien || []){
    if(!d || typeof d.name !== "string" || !d.name || !Number.isFinite(d.mtime)) continue;
    const tag = berlinTag(d.mtime * 1000);
    if(!je.has(tag)) je.set(tag, []);
    je.get(tag)!.push(d);
  }
  return [...je.entries()].sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([tag, ds]) => ({tag, dateien: ds.slice().sort((a, b) => a.mtime - b.mtime || (a.name < b.name ? -1 : 1))}));
}
/** Wochentag (0 Sonntag) und "TT.MM." eines Tages "JJJJ-MM-TT", fuer kw.tag. */
export function tagTeile(tag: string): { w: number; d: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tag);
  if(!m) return null;
  return {w: new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).getUTCDay(), d: m[3] + "." + m[2] + "."};
}
