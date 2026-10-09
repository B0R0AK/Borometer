/* ============================================================
   Borometer — interface
   ============================================================ */

import { state } from "./01-state";
import { uiZoomFactor } from "./37-window-size-and-overlay";
import type { BestStore } from "../types";

/* The first element matching a selector. These are the page's own ids, so the
   element is there - hence the "!"; the few callers that allow for a missing
   one still test it. Ask for the element type when more than HTMLElement is
   needed, as in $<HTMLInputElement>("#modalInput").value. */
export const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector<T>(s)!;
export const el = <K extends keyof HTMLElementTagNameMap>(t: K, c?: string, x?: string | number) => { const n=document.createElement(t); if(c)n.className=c; if(x!=null)n.textContent=String(x); return n; };
const ESC: Record<string, string> = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"};
export const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ESC[c]!);
export function clock(s: number){ const m=Math.floor(s/60), r=Math.floor(s%60); return m+":"+String(r).padStart(2,"0"); }
export function wallTime(ms: number){
  const d = new Date(ms), p = (n: number) => String(n).padStart(2,"0");
  return p(d.getUTCHours())+":"+p(d.getUTCMinutes())+":"+p(d.getUTCSeconds());
}

export function fit(canvas: HTMLCanvasElement, cssH: number, forceW?: number){
  const dpr = window.devicePixelRatio || 1;
  // forceW lets the cast timeline draw wider than its container so it can
  // be zoomed and scrolled horizontally
  const w = forceW || canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 600;
  /* Der Puffer steht in Geraetepunkten, gezeichnet wird in Layoutpunkten, und
     zwischen beiden stand bisher nur die Bildschirmdichte. Die
     Groesseneinstellung fehlte: clientWidth ist eine Layoutbreite und waechst
     nicht mit zoom, die gemalte Flaeche waechst mit. Gemessen an #stack in
     einem 1280 breiten Fenster mit echten Daten - bei 100 Prozent 954
     Layoutpunkte gegen 954,0 gemalte, bei 150 Prozent 789 gegen 1183,5, bei
     200 Prozent 576 gegen 1152,0. Das Diagramm wurde dort also in einen halb
     so breiten Puffer gezeichnet und danach auf die doppelte Breite gezogen.

     Der Boden bei dpr ist Absicht. Unter 100 Prozent waere dpr * Faktor
     rechnerisch richtig - jeder Layoutpunkt wird dort kleiner gemalt -, aber
     es senkte die Aufloesung von etwas, das heute funktioniert, die eigenen 75
     Prozent eingeschlossen. So wird nichts schlechter und der Fehler
     oberhalb von 100 Prozent trotzdem behoben.

     Keine Obergrenze: bei hoher Einstellung schrumpft die Layoutbreite im
     selben Mass, in dem der Massstab waechst (954 gegen 576 oben), der Puffer
     bleibt also etwa gleich gross und kann die Kantengrenze der Leinwand
     nicht eher reissen als heute.

     Es aendern sich nur der Puffer und der Massstab. w und cssH bleiben
     Layoutpunkte, jeder Aufrufer zeichnet weiter in genau diesen. */
  const s = dpr * Math.max(1, uiZoomFactor());
  canvas.style.height = cssH+"px";
  canvas.width = Math.max(1,Math.round(w*s));
  canvas.height = Math.max(1,Math.round(cssH*s));
  // null only when the canvas already carries another kind of context, and
  // nothing here ever asks one for anything but "2d"
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(s,0,0,s,0,0);
  ctx.clearRect(0,0,w,cssH);
  return {ctx,w,h:cssH};
}
/* Einmal je Zeichnen gelesen, nicht je Aufruf (Spezifikation Live-Leistung
   4): stats() fragt die Farbe jeder Faehigkeit jedes Kampfes, und jede Frage
   an getComputedStyle kann die Stile neu rechnen lassen. Die Werte haengen
   am Thema und an den Klassen und Inline-Stilen des Wurzelelements - aendert
   sich eines davon, gilt der Speicher nicht mehr; das zu lesen kostet kein
   Layout. Nach dem Zeichnen verfaellt er (Mikroaufgabe), so sieht auch eine
   Aenderung, die niemand vorhersieht, spaetestens das naechste Zeichnen. */
let cssvWerte: Map<string, string> | null = null, cssvSchluessel = "";
export const cssv = (n: string) => {
  const r = document.documentElement;
  const schluessel = (r.getAttribute("data-theme") || "") + "|" + r.className + "|" + r.style.cssText;
  if(!cssvWerte || schluessel !== cssvSchluessel){
    cssvWerte = new Map(); cssvSchluessel = schluessel;
    queueMicrotask(() => { cssvWerte = null; });
  }
  let v = cssvWerte.get(n);
  if(v === undefined){ v = getComputedStyle(r).getPropertyValue(n).trim(); cssvWerte.set(n, v); }
  return v;
};

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  state.group = "skill";
  state.sortBars = {key:"damage", dir:-1};
  state.cmpRuns = new Set();
  /* Der Vergleich oeffnet gegen den besten Pull (Neugestaltung 28.09.,
     Luecken 5.1); ein Haken von Hand setzt ihn auf null (28-compare.ts). */
  state.cmpPaar = "best";
  /* Die Laeufe, die aus Kaempfen des geladenen Logs gebaut wurden, damit
     summarise() nicht bei jedem Neuzeichnen ueber denselben Abschnitt laeuft.
     Kennung "segN" - N ist der Platz in state.encounters. */
  state.cmpSeg = new Map();
  /* Die besten Pulls je Boss (46-best-pull.ts). Hier und nicht in dessen
     setup(): renderHead() fragt danach, und Teil 46 laeuft als letzter. */
  /* Ohne Prototyp: die Schluessel kommen aus einer Datei (bestLaden in
     46-best-pull.ts), und state.best["constructor"] saehe sonst wie ein
     Eintrag aus. */
  state.best = Object.create(null) as BestStore;
  state.cmpRotAll = false;
  state.filterOpen = false;
  // Aus, bis jemand den Haken im ⋯-Menue setzt. Wiederhergestellt wird er
  // aus der Einstellungsdatei, siehe die /api/config-Antwort weiter unten.
  state.devMode = false;
  state.openMenuOpen = false;
  state.moreOpen = false;
  // preferences, until the saved ones arrive from /api/config a moment later
  state.ghostPref = false;
  state.zoom = 100;           // how big everything is drawn, 10-200
  state.theme = "dark";       // "dark" | "light" | "tnl" | "glas" | "auto" (follow the system)
  /* Der Zeitverlauf: was gezeigt wird und wie glatt.
     Betraege oder Anteile, gleitender Mittelwert ueber 1, 3 oder 5 Sekunden,
     und welche Reihen gerade aus dem Bild genommen sind. Die Vorgabe 5 s ist
     gemessen: der Lattenzaun verschwindet schon bei 3 s (75 Richtungswechsel
     werden 42), breitere Fenster bringen keine ruhigere Kurve mehr, sie
     druecken nur die Spitze - bei 5 s steht die hoechste Sekunde beim
     Vierfachen des Schnitts statt beim Neunfachen. */
  state.stackScale = "eigen"; // "eigen" | "gleich" - Massstab der Spuren
  state.stackSmooth = 5;      // 1 | 3 | 5
  state.stackOff = new Set(); // Reihen, die gerade nicht im Bild stehen
  state.compactHandSized = false;   // true once compact's window was dragged
  state.zweiFenster = false;        // Kompakt als eigenes Fenster (N4): erst /api/state sagt es
  state.kompaktOffen = false;
  state.randlosGesehen = null;      // Randlos-Hinweis: unbekannt, bis /api/config antwortet
  state.rundgangGesehen = null;     // Rundgang (63): unbekannt, bis /api/config antwortet
  state.ersterStart = null;         // ebenso: ob dies eine neue Installation ist
  state.wasKicked = false;          // so being removed is said once, not every poll
  state.fromSample = false;   // the sample's character must never be offered as yours
  state.origin = "";          // "watch" | "file" | "sample" - see loadOrigin
  state.grew = 0;             // times this file was seen to lengthen while watched
  state.integrity = null;     // counts taken off the file itself, for the report
  state.rotZoom = 1;
  state.rotFrom = null;
  state.rotTo = null;
  state.rotSegStart = null;
  state.mergePhases = true;   // a boss you go back to inside a minute is one fight
  /* Which heads of the list the reader has folded, keyed by a timestamp rather
     than a position: the list is re-segmented whenever Gap, Min length or the
     character filter changes, and an index would then fold a different stretch
     of the night than the one that was pressed. Seit dem Feinschliff (02.10.,
     Abschnitt 5) ist der Schluessel der Beginn des aeltesten Laufs unter dem
     Kopf (kopfGruppen, 30-fight-list.ts) - er bleibt stehen, wenn im Live ein
     neuer Pull am selben Ort dazukommt. */
  state.folded = new Set();
  state.clearBefore = null;   // the log file itself is never touched — this only hides fights from before the moment "Clear" was pressed
  /* Einzeln entfernte Kaempfe, gemerkt an ihrer Startzeit statt an ihrem
     Platz in der Liste. Aus demselben Grund, aus dem "Leeren" ein Zeitschnitt
     ist und kein Loeschen: state.encounters wird bei jedem Durchlauf neu aus
     den Ereignissen gerechnet, und die Live-Aufzeichnung liest die ganze
     Datei alle paar Sekunden komplett neu. Ein Kampf, den man aus dem Feld
     wirft, ist beim naechsten Takt wieder da - eine gemerkte Startzeit greift
     jedes Mal neu. Die Logdatei wird nirgends angefasst.

     Nicht gespeichert, wie der Zeitschnitt auch nicht: beim naechsten Start
     ist die Liste wieder vollstaendig. Auf der Platte war sie das ohnehin. */
  state.entfernt = new Set();
  state.entferntAktiv = 0;    // wie viele davon gerade wirklich fehlen — siehe segment()
  state.bearbeiten = false;   // der Bearbeiten-Modus der Schiene, nur fuer diese Sitzung
  state.partySince = null;    // wall-clock ms when you joined/hosted; fights older than this are not reported to the party
  state.expanded = new Set();
  /* clipping is no longer a fixed sixty seconds: the target is the
     shortest ticked run's own length, which is self-justifying and
     throws away less of the data */
  state.clipRuns = false;
  state.tab = "timeline";
  state.start = false;
  state.einst = false;
  state.weeklies = false;
  state.rekorde = false;
  state.gilde = false;
}
