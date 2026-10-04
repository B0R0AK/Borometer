import { state } from "./01-state";
import { renderStack, stackEnde, zeitLeeren } from "./24-table-keyboard-and-timeline";
import { renderWer, spurAbschnitt } from "./42-party";
import { leisteWieZeitverlauf, renderDeineRotation } from "./54-deine-rotation";
import type { Fight } from "../types";

/* ---------- das Fenster der Rotation ---------- */
export function rotWindow(seg: Fight){
  const T = seg.stats.seconds || 1;
  /* The window belongs to the fight it was drawn on. Every path that
     changes which fight is on screen - a click in the rail, the character
     filter, Gap or Min length, a fresh pull while logging - left rotFrom
     and rotTo standing, and the clamp below folded them into the new
     fight: 1:15-1:25 of an 85,6 s fight became 1:09,7-1:10,2 of a 69,7 s
     one, half a second past its end, drawing one bucket and no casts.
     seg.start is the right identity - it survives the re-segmentation
     that runs every couple of seconds while logging, and it changes
     exactly when the fight is genuinely re-cut. The zoom factor stays:
     it only rescales, it cannot point the view off the end. */
  if(state.rotSegStart !== seg.start){
    state.rotSegStart = seg.start;
    state.rotFrom = null; state.rotTo = null;
    /* Auch die ausgeblendeten Faehigkeiten gehoeren zu dem Kampf, an dem
       sie ausgeblendet wurden. Ein neuer Kampf faengt vollstaendig an. */
    state.rotAus = new Set();
    /* Auch die Ausblendung des Zeitverlaufs. Sie ueberlebte den
       Kampfwechsel, waehrend die der Rotation zurueckgesetzt wurde -
       nachgemessen: auf dem naechsten Kampf behauptete der Satz "darin
       stehen 7 % des Schadens", obwohl 93 % aus dem Bild waren und der
       Nutzer dort nie etwas versteckt hatte. */
    state.stackOff.clear();
  }
  let a = state.rotFrom == null ? 0 : state.rotFrom;
  let b = state.rotTo == null ? T : state.rotTo;
  a = Math.max(0, Math.min(a, T)); b = Math.max(a + 0.5, Math.min(b, T));
  return {a, b, T};
}

/* ---------- die gemeinsame Zeitachse (Aufgabe 10, Nachtrag 29.09.) ----------
   Zeitleiste (54) und Zeitverlauf (24) stehen in derselben Spalte
   uebereinander und zeichnen auf derselben Achse: gleich breit (der Zoom
   vervielfacht die Breite der Spalte), mit demselben Rand links und rechts
   und demselben Fenster (rotWindow, Von/bis). Der Rand ist der der
   Zeitleiste: der aktuelle Einsatz steht 40 Punkt breit, und der erste
   liegt meist bei 0:00. */
export const ACHSE_RAND = 24;
/** Die Breite, auf die beide zeichnen: die Spalte, mindestens 200 Punkt (so viel liess die Leiste schon immer), mal Zoom. */
export function achsenBreite(box: HTMLElement): number {
  return Math.round(Math.max(200, box.clientWidth || 600) * (state.rotZoom || 1));
}
/** Punkte je Sekunde auf dieser Breite fuer eine Spanne in s - eine Formel fuer beide (Fixrunde 1: die Leiste
    rechnete bei schmaler Spalte mit einem eigenen Boden und lag bis 44 Punkt neben ihrer Spur). */
export function achsenPxs(breite: number, spanne: number): number {
  return (breite - 2 * ACHSE_RAND) / Math.max(0.001, spanne);
}

/* Der Einstieg in den Bereich Rotation: "Deine Rotation"
   (54-deine-rotation.ts) zeichnet den Block, darin seit Aufgabe 10 unter der
   Zeitleiste den Zeitverlauf (24, renderStack) - vorher im Bereich Kampf.
   rotWindow gehoert dem Kampf und gilt fuer beide, der Kampfwechsel setzt
   die ausgeblendeten Faehigkeiten zurueck. Der Zeitverlauf zeichnet zuerst:
   er setzt die Breite der Namensspalte, und erst danach steht fest, wie
   breit die Zeitleiste ist. Unter Live zeigt die Zeitleiste mit Vorlauf
   mehr als den Kampf (leistenDauer); wechselt dieser Vorlauf, zeichnet der
   Zeitverlauf noch einmal auf dieselbe Dauer. */
export function renderRotation(){
  const seg = spurAbschnitt();
  if(!seg){ zeitLeeren(); return; }
  renderWer("rotWho", "chart.whoseRot");
  if(state.noTime){ renderDeineRotation(null); renderStack(); return; }   // the panel says why
  // das Fenster und die ausgeblendeten Faehigkeiten gehoeren dem Kampf: erst sie, dann der Block
  rotWindow(seg);
  const ende = renderStack();
  renderDeineRotation(seg);
  if(ende != null && ende !== stackEnde(seg)) renderStack();
  // gezoomt rollen beide gemeinsam (54): nach dem Zeichnen stehen sie an derselben Stelle
  leisteWieZeitverlauf();
}
