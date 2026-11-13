// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Auge von Ventius als Baustein der neuen Analyse (#414, Spezifikation
 * 2026-11-08-analyse-neu-zeitleiste-design.md 2 und 8). Reiner Kern: er
 * rechnet auf den Salven des Kampfdatenformats und fasst die Rechenregeln der
 * Seite (app/15-weapons-and-ventius.ts: Salve = Treffer binnen 1200 ms auf
 * ein Ziel, Welle = Treffer binnen 30 ms) nicht an.
 *
 * Die Form einer Salve ist 1 + 3 N: eine Welle mit einem Treffer (Oeffner),
 * dann N Wellen mit genau drei Treffern (Nachbeben). Ein Punkt im Raster ist
 * ein Nachbeben, also drei Treffer. Die Decke ist die hoechste Nachbebenzahl
 * aus den eigenen Salven (dieser Kampf oder der Gegner ueber alle Logs), kein
 * Spielwert.
 *
 * Entschieden (08.11.2026): eine Salve nur aus dem Oeffner zaehlt als lesbar
 * mit 0 Nachbeben und damit als fehlende Treffer. Ausgenommen ist Kampfende:
 * die letzte Salve des Kampfs und jede in den letzten 1,5 s, die unter der
 * Decke blieb. Das Ziel konnte dann schon gefallen sein; das Log sagt es
 * nicht, die Salve wird nur nicht als fehlend gezaehlt.
 * Unlesbar bleibt nur, was die Form verletzt.
 */

import { median } from "./analyse-core";
import { hatVentius, imBereich, type Kampfdaten } from "./kampfdaten-core";

export const KAMPFENDE_S = 1.5;
/** Der Name der Faehigkeit fuer die Kerne: englisch wie skillKey() der Seite, die ihn in der Sprache der Seite zeigt. */
export const VENTIUS = "Eye of Ventius";

export type UnlesbarGrund = "doppelsalve" | "ohne-oeffner" | "mehrziel" | "teilwelle";
export type SalveStatus = "decke" | "unter" | "unlesbar" | "kampfende";

/** Nachbeben einer Salve aus den Groessen ihrer Wellen: -1 unlesbar, 0 nur Oeffner, sonst N. */
export function ventiusForm(wellen: readonly number[]): number {
  if (wellen.length === 0 || wellen[0] !== 1) return -1;
  for (let i = 1; i < wellen.length; i++) if (wellen[i] !== 3) return -1;
  return wellen.length - 1;
}

/** Treffer einer lesbaren Salve mit N Nachbeben: 1 + 3 N. */
export const ventiusTreffer = (nachbeben: number): number => 1 + 3 * nachbeben;

/** Warum eine Salve unlesbar ist, aus der Form ihrer Wellen. */
export function ventiusGrund(wellen: readonly number[]): UnlesbarGrund {
  if (wellen[0] !== 1) return "ohne-oeffner";
  const rest = wellen.slice(1);
  if (rest.includes(1)) return "doppelsalve";
  if (rest.some((w) => w > 3)) return "mehrziel";
  return "teilwelle";
}

export const ventiusGrundSchluessel = (g: UnlesbarGrund | string): string => "analysis.e.vent.grund." + g;

export interface Salve {
  t: number;
  /** -1 unlesbar, 0 nur Oeffner, N Nachbeben */
  nb: number;
  n: number;
  dmg: number;
  krit: number;
  stark: number;
  wellen: number[];
  unlesbar: boolean;
  nurOeffner: boolean;
  grund: UnlesbarGrund | "";
  soll: number;
  fehlend: number | null;
  status: SalveStatus;
  im: boolean;
}
export interface Stufe { nb: number; n: number; treffer: number; dmg: number; jeSalve: number }
export interface VentiusErgebnis {
  salven: Salve[];
  top: number;
  deckeGegner: number;
  decke: number;
  soll: number;
  /** Salven im Bereich */
  gesamt: number;
  /** lesbar und nicht Kampfende */
  lesbar: number;
  unlesbar: number;
  kampfende: number;
  anDecke: number;
  unter: number;
  getroffen: number;
  moeglich: number;
  gefehlt: number;
  jeTreffer: number;
  verlust: number;
  stufen: Stufe[];
  gruende: Record<string, number>;
  /** die bekannte Decke des Gegners wurde in diesem Kampf nie erreicht */
  nieErreicht: boolean;
}

/**
 * Die Salven eines Kampfs mit Soll und Ist; Decke des Kampfs (top) und
 * bekannte Decke des Gegners. Null, wenn der Kampf keine Salve hat: dann gibt
 * es den Baustein nicht. a und b begrenzen die Zahlen auf einen Bereich; die
 * Decke bleibt die des ganzen Kampfs.
 */
export function ventiusAuswertung(k: Kampfdaten, deckeGegner: number, a = 0, b = Infinity): VentiusErgebnis | null {
  if (!hatVentius(k)) return null;
  const roh = k.ventius!.salven;
  const top = Math.max(0, ...roh.filter((s) => s[1] >= 0).map((s) => s[1]));
  const decke = Math.max(top, deckeGegner || 0);
  const soll = ventiusTreffer(decke);
  const letzte = roh.length - 1;
  const salven: Salve[] = roh.map(([t, nb, n, dmg, krit, stark, wellen], i) => {
    const unlesbar = nb < 0;
    const unter = !unlesbar && nb < decke;
    const ende = unter && (i === letzte || t >= k.dauerS - KAMPFENDE_S);
    const status: SalveStatus = unlesbar ? "unlesbar" : ende ? "kampfende" : nb >= decke ? "decke" : "unter";
    return {
      t, nb, n, dmg, krit, stark, wellen, unlesbar, nurOeffner: nb === 0,
      grund: unlesbar ? ventiusGrund(wellen) : "", soll,
      fehlend: status === "unter" || status === "decke" ? Math.max(0, soll - n) : null,
      status, im: imBereich({ t }, a, b),
    };
  });
  const dabei = salven.filter((s) => s.im);
  const les = dabei.filter((s) => s.status === "decke" || s.status === "unter");
  const stufen: Stufe[] = [];
  for (let n = decke; n >= 0; n--) {
    const l = les.filter((s) => s.nb === n);
    if (l.length) stufen.push({ nb: n, n: l.length, treffer: ventiusTreffer(n), dmg: l.reduce((x, s) => x + s.dmg, 0), jeSalve: median(l.map((s) => s.dmg)) });
  }
  const getroffen = les.reduce((x, s) => x + s.n, 0);
  const moeglich = les.length * soll;
  const anDecke = les.filter((s) => s.status === "decke");
  const jeTreffer = median((anDecke.length ? anDecke : les).map((s) => s.dmg / s.n));
  const gruende: Record<string, number> = {};
  for (const s of dabei) if (s.unlesbar) gruende[s.grund] = (gruende[s.grund] || 0) + 1;
  return {
    salven, top, deckeGegner: deckeGegner || 0, decke, soll,
    gesamt: dabei.length, lesbar: les.length, unlesbar: dabei.filter((s) => s.unlesbar).length,
    kampfende: dabei.filter((s) => s.status === "kampfende").length,
    anDecke: anDecke.length, unter: les.length - anDecke.length,
    getroffen, moeglich, gefehlt: moeglich - getroffen, jeTreffer, verlust: (moeglich - getroffen) * jeTreffer,
    stufen, gruende, nieErreicht: top < (deckeGegner || 0),
  };
}
