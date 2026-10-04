import { t } from "./08-translation";
import { num1, secs1 } from "./16-fight-analysis";
import { esc } from "./18-interface-basics";
import type { TaktZeile } from "../rotation-core";

/* ---------- Feld "Einsaetze" im Bereich Rotation ----------
   Neugestaltung 28.09. (Luecken 3.7, 3.8), Vorlage die Seitenhaelfte vom
   Branch claude/entwurf-angleichung: je gedrueckte Faehigkeit eine Zeile -
   vorn das Auge, Symbol und Name, dann der Takt (ein Strich je Einsatz ueber
   den ganzen Kampf, mit dem Abspielkopf), Einsaetze, je Minute, O Abstand und
   Treffer je Einsatz. Gerechnet in ../rotation-core.ts (takt); die Zeilen
   selbst gibt 54-deine-rotation.ts herein.

   Das Auge vor dem Symbol ist ein eigener kleiner Knopf (.rotgz, wie .auge
   im Entwurf, Fixrunde 1): es nimmt die Faehigkeit aus der Zeitleiste und
   holt sie zurueck, sein Name nennt die Faehigkeit; Symbol und Name stehen
   daneben als Text. Die Knoepfe sind ein Tabstopp mit
   Pfeiltasten (spurGruppe, 22). Eine ausgeblendete Zeile ist gedaempft, ihr
   Takt bleibt blass sichtbar. Die Zahlen stehen je in einem <u title>:
   aendert sich unter Live nur eine Zahl, tauscht 54 (setzen) nur sie, und
   der Fokus bleibt auf seinem Knopf. Die Striche gehoeren nicht in dieses
   HTML - sie wachsen unter Live je Takt und werden danach je Zeile gesetzt
   (taktStriche). Fragt nichts ab, speichert nichts; ohne setup(). */

/** Eine Zeile, wie 54 sie hereingibt. */
export interface EinsatzZeile {
  z: TaktZeile;
  /** Name der Faehigkeit im Kampf (data-rot) und wie er gezeigt wird */
  name: string; label: string;
  /** das Symbol (skillMark) und die Marke eines Skillkerns, fertig gebaut */
  sym: string; kern: string;
  /** Reihenfarbe der Striche */
  farbe: string;
  /** in der Zeitleiste gezeigt (nicht mit dem Auge ausgeblendet) */
  drin: boolean;
}

/* Das Auge, gezeichnet wie im Entwurf (ico "auge"/"augeaus"): offen, solange
   die Faehigkeit in der Zeitleiste steht, durchgestrichen, wenn nicht. */
const AUGE = '<svg class="drauge" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const AUGE_AUS = '<svg class="drauge" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M2.5 12S6 5.5 12 5.5c1.6 0 3 .4 4.2 1M21.5 12S18 18.5 12 18.5c-1.6 0-3-.4-4.2-1"/><path d="M4 20L20 4"/></svg>';

const zahl = (text: string, title = "") => '<u title="' + esc(title) + '">' + esc(text) + "</u>";

/** Der Kopf der Tabelle. */
export function einsaetzeKopf(): string {
  return '<div class="drth" role="row">' +
    ["deinerot.spFaehigkeit", "deinerot.spTakt", "deinerot.spEinsaetze", "deinerot.spJeMinute", "deinerot.spAbstand", "deinerot.spTreffer"]
      .map((k, i) => '<span role="columnheader"' + (i >= 2 ? ' class="drr"' : "") + ">" + esc(t(k)) + "</span>").join("") + "</div>";
}

/** Eine Zeile je Faehigkeit. */
export function einsaetzeHtml(zeilen: readonly EinsatzZeile[]): string {
  let html = einsaetzeKopf();
  for(const r of zeilen){
    const z = r.z;
    html += '<div class="drzeile' + (r.drin ? "" : " aus") + '" role="row" data-k="' + esc(z.k) + '">' +
      '<span class="drtn" role="cell"><button type="button" class="rotgz" data-rot="' + esc(r.name) + '" data-k="' + esc(z.k) + '" aria-pressed="' + r.drin + '"' +
        ' aria-label="' + esc(t("deinerot.auge", {name: r.label})) + '" title="' + esc(r.label + " \u2014 " + t(r.drin ? "deinerot.an" : "deinerot.aus")) + '">' +
        (r.drin ? AUGE : AUGE_AUS) + "</button>" + r.sym + "<em>" + esc(r.label) + "</em>" + r.kern + "</span>" +
      '<span class="drtt" role="cell"><span class="drstriche" aria-hidden="true" data-k="' + esc(z.k) + '" style="--c:' + r.farbe + '"></span></span>' +
      '<span class="drr drn" role="cell">' + zahl(String(z.n), t("deinerot.anzahlTitel", {n: z.n})) + "</span>" +
      '<span class="drr" role="cell">' + zahl(num1(z.jeMinute)) + "</span>" +
      '<span class="drr" role="cell">' + zahl(z.abstand == null ? "\u2013" : secs1(z.abstand / 1000)) + "</span>" +
      '<span class="drr" role="cell">' + zahl(num1(z.trefferJe)) + "</span></div>";
  }
  return html;
}

/** Ohne Zeilen (ein Mitglied, das nichts geteilt hat): der Kopf und ein Satz. */
export function einsaetzeLeer(satz: string): string {
  return einsaetzeKopf() + '<div class="drleer" role="row"><span role="cell">' + esc(satz) + "</span></div>";
}

/* Die Striche je Zeile: ein Strich je Einsatz an seiner Stelle im Kampf,
   dazu der Abspielkopf (b.drtkkopf, seine Lage kommt aus --kopf am Feld).
   Neu gesetzt wird eine Zeile nur, wenn sich ihre Zeitpunkte geaendert haben. */
export function taktStriche(box: HTMLElement, zeilen: readonly EinsatzZeile[], dauerMs: number): void {
  const T = Math.max(1, dauerMs);
  const je = new Map(zeilen.map(r => [r.z.k, r.z.ts]));
  box.querySelectorAll<HTMLElement>(".drstriche").forEach(el => {
    const ts = je.get(el.dataset.k ?? "") ?? [];
    const sig = T + ":" + ts.join(",");
    if(el.dataset.sig === sig) return;
    el.dataset.sig = sig;
    el.innerHTML = ts.map(ms => '<i style="left:' + (Math.min(1, ms / T) * 100).toFixed(2) + '%"></i>').join("") + '<b class="drtkkopf"></b>';
  });
}

/** Der Abspielkopf in allen Takt-Zeilen: ein Anteil 0..1 des Kampfes, als Variable am Feld. */
export function taktKopf(box: HTMLElement, anteil: number): void {
  const v = (Math.max(0, Math.min(1, anteil)) * 100).toFixed(2) + "%";
  if(box.style.getPropertyValue("--kopf") === v) return;
  box.style.setProperty("--kopf", v);
}
