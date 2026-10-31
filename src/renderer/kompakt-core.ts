// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Der Kern des Streifens (Spezifikation Kompakt-Fenster, 04.10.2026):
   ob ein Kampf laeuft, wann er zuletzt wuchs, die Durchsicht im
   Durchklick und die Restzeile unter den Top 5. Rein: er importiert
   nichts und fasst weder Seite noch Netz an (Audit). */

export type KampfZustand = "kampf" | "nach";

/* "kampf", solange Live laeuft, der neueste Kampf gewaehlt ist und er vor
   weniger als trennS Sekunden zuletzt wuchs - so lange Stille, und das Log
   beginnt einen neuen Kampf. Alles Ungueltige ist "nach". */
export function kampfZustand(e: { live: boolean; neuester: boolean; seitWachstumMs: number; trennS: number }): KampfZustand {
  const ms = e.seitWachstumMs, trenn = e.trennS;
  if(!e.live || !e.neuester) return "nach";
  if(!Number.isFinite(ms) || ms < 0 || !Number.isFinite(trenn) || trenn <= 0) return "nach";
  return ms < trenn * 1000 ? "kampf" : "nach";
}

/* Der neueste Kampf, wie ihn ein Live-Abruf hinterlaesst: sein Schluessel
   (Start des ersten Treffers und Ziel, wie fightKey) und sein Ende. */
export type KampfMarke = { key: string; ende: number } | null;

/* Wann der neueste Kampf zuletzt wuchs, gemessen an der Uhr der Seite (die
   Uhr des Logs kann in einer anderen Zone stehen). Das erste Laden ist kein
   Wachstum: ein Kampf, der schon dastand, laeuft nicht deshalb. Danach
   (nachErstem) ist der Sprung von keinem Kampf auf einen schon Wachstum:
   der erste Kampf eines frischen Logs. */
export function wachstum(vorher: KampfMarke, jetzt: KampfMarke, bisher: number | null, nowMs: number, nachErstem = false): number | null {
  if(!jetzt) return null;
  if(!vorher) return nachErstem ? nowMs : bisher;
  return vorher.key !== jetzt.key || vorher.ende !== jetzt.ende ? nowMs : bisher;
}

/* Die Toenung unter dem Streifen auf Acrylic (Kompakt neu, 14.10.2026; klarer seit #328, 27.10.2026): der Regler "Durchsicht"
   (0 bis 55) stellt sie von .50 auf .10. Zeilen, Balken und Zahlen bleiben deckend, die Kontur der Schrift (--kn-schatten)
   traegt die Lesbarkeit, der Grund darf also klar sein; vor Kompakt neu .92 bis .65, weil weisse Schrift direkt auf dem Grund lag. */
export const TOENUNG_MAX = 0.5, TOENUNG_MIN = 0.1, DURCHSICHT_MAX = 55;
export function toenung(durchsicht: number): number {
  const s = Number.isFinite(durchsicht) ? Math.max(0, Math.min(DURCHSICHT_MAX, durchsicht)) : 0;
  return +(TOENUNG_MAX - (s / DURCHSICHT_MAX) * (TOENUNG_MAX - TOENUNG_MIN)).toFixed(3);
}

/* Die Deckkraft des ganzen Fensters auf Acrylic (#348, 30.10.2026): die Unschaerfe des Hintergrunds macht Windows, die Toenung
   allein macht ihn nicht erkennbar. Darum blendet das Fenster mit dem Regler zusaetzlich ab, von 1 (Regler 0) auf DECKUNG_MIN am
   Anschlag: der Hintergrund schimmert scharf durch, die Schrift bleibt ueber .70 und traegt ihre Kontur. */
export const DECKUNG_MIN = 0.7;
export function fensterDeckung(durchsicht: number): number {
  const s = Number.isFinite(durchsicht) ? Math.max(0, Math.min(DURCHSICHT_MAX, durchsicht)) : 0;
  return +(1 - (s / DURCHSICHT_MAX) * (1 - DECKUNG_MIN)).toFixed(3);
}

/* Durchklickbar heisst 40 % durchsichtig (#57), auf der Skala des Reglers.
   Steht der Regler hoeher, gilt er. */
export const DURCHKLICK_SICHT = 40;
export function durchsichtWirksam(regler: number, durchklick: boolean): number {
  return durchklick ? Math.max(regler, DURCHKLICK_SICHT) : regler;
}

/* Die Restzeile (#160): was unter der letzten ganzen Zeile liegt. alle:
   der Schaden jeder Hauptzeile, unten: der Schaden der Zeilen darunter. */
export type Rest = { n: number; anteil: number; schaden: number };
export function restZeile(alle: number[], unten: number[]): Rest | null {
  if(!unten.length) return null;
  const summe = (xs: number[]) => xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const ges = summe(alle), schaden = summe(unten);
  return { n: unten.length, anteil: ges > 0 ? schaden / ges : 0, schaden };
}

/* ---------- Die Leiste (Spezifikation Kompakt neu, 14.10.2026; Panel 21.10.2026) ---------- */

/* Die Zeilen (Spezifikation Kompakt neu, Panel, 2 und 3): zuerst grund Zeilen, dann der Knopf "+N weitere", der die Liste
   aufklappt. Bleibt dem Knopf nur eine Zeile, steht sie gleich da: ein Knopf fuer eine Zeile spart nichts. alle: aufgeklappt. */
export const KN_GRUND = 5, KN_GRUND_WK = 4;
export type ZeilenSicht = { zeigen: number; rest: number };
export function zeilenSicht(n: number, alle: boolean, grund = KN_GRUND): ZeilenSicht {
  const gesamt = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  if(alle || gesamt <= grund + 1) return { zeigen: gesamt, rest: 0 };
  return { zeigen: grund, rest: gesamt - grund };
}

/* Die Liste im Kampf (#328): bis KN_ALLE_BIS Zeilen stehen alle da, darueber zeigt sie KN_SICHT und rollt mit dem Mausrad.
   restUnten: was beim Rollen unter der letzten ganzen sichtbaren Zeile liegt (erste: Index der obersten ganzen Zeile,
   sicht: wie viele ganze Zeilen der Ausschnitt zeigt); null, wenn darunter nichts mehr liegt. */
export const KN_SICHT = 5, KN_ALLE_BIS = 6;
export function restUnten(schaeden: number[], erste: number, sicht: number): Rest | null {
  const von = Math.max(0, Number.isFinite(erste) ? Math.floor(erste) : 0), bis = von + Math.max(0, Math.floor(sicht) || 0);
  return restZeile(schaeden, schaeden.slice(bis));
}

/* Die zwei Ansichten des Streifens; was nicht "weeklies" ist, ist "kampf". */
export type Ansicht = "kampf" | "weeklies";
export function ansichtWechsel(a: string): Ansicht { return a === "kampf" ? "weeklies" : "kampf"; }

/* Die offenen Punkte der Weeklies: erledigt ist, wer seine Menge erreicht
   hat. Taegliche zuerst (sie verfallen am schnellsten), sonst bleibt die
   Folge der Liste. Stabil. */
export function offenePunkte<T extends { takt: string; stand: number; menge: number }>(punkte: readonly T[]): T[] {
  const offen = punkte.filter(x => x.stand < x.menge);
  return [...offen.filter(x => x.takt === "tag"), ...offen.filter(x => x.takt !== "tag")];
}

/* Der leise Punkt am Reiter Weeklies: eine Erinnerung war heute faellig
   (aktiv, nicht geloest, heutiger Wochentag, Uhrzeit erreicht, lokale Zeit),
   es ist noch etwas offen, und die Ansicht war seit dem nicht offen
   (gesehenMs: wann zuletzt, oder null). Rein: keine Uhr, keine Seite. */
export type Erinn = { an: boolean; geloest?: boolean; tage: readonly number[]; zeit: string };
export function erinnerungFaellig(liste: readonly Erinn[], offen: number, jetzt: Date, gesehenMs: number | null): boolean {
  if(!(offen > 0)) return false;
  for(const r of liste){
    if(!r.an || r.geloest || !r.tage.includes(jetzt.getDay())) continue;
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(r.zeit);
    if(!m) continue;
    const ab = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate(), +m[1]!, +m[2]!).getTime();
    if(jetzt.getTime() < ab) continue;
    if(gesehenMs === null || gesehenMs < ab) return true;
  }
  return false;
}
