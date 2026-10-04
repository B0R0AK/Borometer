import { seriesColor, state } from "./01-state";
import { toastFail } from "./03-helpers";
import { tt } from "./08-translation";
import { burstAt } from "./15-weapons-and-ventius";
import { num1 } from "./16-fight-analysis";
import { $, clock } from "./18-interface-basics";
import { loadSwatches } from "./21-damage-table";
import { stackHit } from "./22-timeline-smoothing";
import { renderRotation } from "./25-rotation";
import { persistPref } from "./27-weapons-tab";
import { renderAll } from "./32-history";
import { syncRahmenKnoepfe, uiZoomFactor } from "./37-window-size-and-overlay";
import { parseClock } from "./38-tooltips";
import { einstNachfuehren } from "./57-einstellungen";

/* ---------- light and dark ----------
   The page always carries an explicit data-theme; "auto" is resolved here
   rather than left to a media query, so a setting and the system can never
   both be half in force. The charts paint with values read out of the
   stylesheet, so they have to be told to paint again. */
const SYSTEM_LIGHT = matchMedia("(prefers-color-scheme: light)");
/* Was der Starter beim Ausliefern in das <html>-Tag geschrieben hat: das
   Thema, das die letzte Sitzung aufgeloest hat. Hier gelesen, bevor
   applyTheme das Attribut zum ersten Mal ueberschreibt. Leer, wenn die Seite
   ohne den Starter laeuft. */
const BOOT_THEME = document.documentElement.getAttribute("data-theme") || "";
export function applyTheme(repaint: boolean, boot?: string){
  const on = boot ? boot
           : state.theme === "auto" ? (SYSTEM_LIGHT.matches ? "light" : "dark")
                                    : state.theme;
  /* One frame with no transitions anywhere, while the swap happens.
     Switching themes changes custom properties and nothing else, and an
     element that transitions a property reading one does not re-evaluate
     it: measured, the tab labels and the grouping buttons kept painting
     the dark theme's ink on a light ground - 1,9:1 - until something
     re-rendered or hovered them. Two frames, because the class has to be
     in force for the restyle the theme change itself triggers. */
  const root = document.documentElement;
  root.classList.add("nofade");
  root.dataset.theme = on;
  const unfade = () => root.classList.remove("nofade");
  requestAnimationFrame(() => requestAnimationFrame(unfade));
  // rAF is throttled to a halt in a background tab, and the class must not
  // outlive the swap that needed it
  setTimeout(unfade, 120);
  document.querySelectorAll<HTMLElement>("#themeRow button").forEach(b =>
    b.setAttribute("aria-pressed", b.dataset.theme === state.theme ? "true" : "false"));
  loadSwatches();
  /* The launcher paints the window frame before this page loads, so it
     cannot ask which theme is on - it reads what the last session left
     here. Without it a light theme opens on a near-black window for the
     moment before the first paint. */
  if(repaint) persistPref("themeResolved", on);
  // die Systemknoepfe im Rahmen folgen dem Thema; Farben kennt nur der
  // Hauptprozess (chrome.ts), gesendet wird der Name
  // - ausser in Kompakt: dort sind sie ausgeblendet (mit und ohne Acrylic),
  // und ein Themenwechsel aus dem Mehr-Menue holte sie sonst ueber das
  // Overlay zurueck. Beim Verlassen setzt "material" sie im neuen Thema.
  syncRahmenKnoepfe();
  /* Die Farbe eines Skills wird in stats() festgeschrieben, und stats()
     laeuft nur beim Segmentieren. Seit die Reihe vom Thema abhaengt, heisst
     das: ohne diese Zeile behaelt die Tabelle nach dem Themenwechsel die
     Farben des alten Themas, bis irgendetwas anderes eine neue Segmentierung
     ausloest - ein Filter, ein anderes Log. Neu segmentieren waere zu viel
     (Ventius-Lernen, Bloecke, alles noch einmal); die Farben allein neu zu
     vergeben reicht, alles andere holt sich seine Farbe beim Zeichnen. */
  if(repaint && state.encounters.length){
    for(const s of state.encounters)
      s.stats.skills.forEach((k,i) => { k.color = seriesColor(i); });
    renderAll();
  }
  // die Themenwahl der Einstellungen zeigt denselben Stand wie das Menue
  einstNachfuehren();
}
/* Die eine Handlung "Thema waehlen": das Menue (#themeRow, auch im Kompakt)
   und die Einstellungen rufen sie, und sie schreibt den Schluessel "theme". */
export function setzeThema(k: string){
  state.theme = k;
  applyTheme(true);
  persistPref("theme", state.theme);
}
/* Der erste Anstrich nimmt das Thema, das der Starter eingesetzt hat.
   state.theme steht hier noch auf "dark", weil die gespeicherte Wahl erst mit
   /api/config kommt - applyTheme(false) laeuft in Zeile 13269, geholt wird die
   Antwort erst dreitausend Zeilen spaeter, und das Skript ist ein einziger
   blockierender Block. Der erste Anstrich liegt also dazwischen.
   state.theme bleibt dabei unberuehrt: applyTheme setzt danach aria-pressed in
   der Themenreihe, und eine gespeicherte "auto"-Wahl stuende sonst als das
   aufgeloeste Thema im Menue.
   Geprueft wird gegen die Knoepfe selbst, damit hier keine zweite Themenliste
   entsteht. "auto" faellt dabei heraus: der Starter schreibt das aufgeloeste
   Thema, nicht die Wahl. */
const bootTheme = BOOT_THEME !== "auto" &&
  [...document.querySelectorAll<HTMLElement>("#themeRow button")]
    .some(b => b.dataset.theme === BOOT_THEME) ? BOOT_THEME : "";

// Zoom und Von/bis gelten fuer Zeitleiste und Zeitverlauf zugleich (Aufgabe 10): renderRotation zeichnet beide
function renderViews(){ renderRotation(); }
function setZoom(z: number){
  state.rotZoom = Math.max(1, Math.min(12, +z.toFixed(2)));
  renderViews();
}
/* the timeline keeps its window and zoom in state (rotFrom, rotTo, rotZoom);
   the toolbar is wired by class rather than id */
export function syncViewBars(a: number, b: number){
  document.querySelectorAll<HTMLElement>(".viewbar").forEach(bar => {
    const lvl = bar.querySelector(".vlevel"), f = bar.querySelector<HTMLInputElement>(".vfrom"), to = bar.querySelector<HTMLInputElement>(".vto");
    // toFixed schreibt immer einen Punkt: im deutschen Fenster stand "1.5x"
    // neben einer Zeitleiste, die ihre Sekunden mit Komma schreibt.
    if(lvl) lvl.textContent = num1(state.rotZoom || 1)+"×";
    if(f && document.activeElement !== f) f.value = clock(a);
    if(to && document.activeElement !== to) to.value = clock(b);
  });
}
function applyRange(bar: HTMLElement){
  const seg = state.encounters[state.sel]; if(!seg) return;
  const T = seg.stats.seconds || 1;
  let a = parseClock(bar.querySelector<HTMLInputElement>(".vfrom")!.value), b = parseClock(bar.querySelector<HTMLInputElement>(".vto")!.value);
  if(a == null) a = 0;
  if(b == null) b = T;
  if(b <= a){ toastFail(tt("rotation.badRange")); return; }
  state.rotFrom = Math.max(0, a); state.rotTo = Math.min(T, b);
  renderViews();
}

let lastDragMove = 0;
/* A click inside a burst zooms to it. The window is the one rotWindow keeps
   per fight (25-rotation.ts); the rotation canvas that shared it is gone
   with the redesign (Spezifikation 3). */
function stackKlick(e: MouseEvent){
  if(lastDragMove > 4 || !stackHit || !stackHit.seg) return;
  // dieselbe Umrechnung wie im mousemove daneben: sonst zoomt der Klick auf
  // einen anderen Burst als den unter dem Zeiger, und rechts der Mitte auf
  // gar keinen
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const mx = (e.clientX - r.left) / uiZoomFactor();
  if(mx < stackHit.x0 || mx > stackHit.x1) return;
  const sec = stackHit.a + (mx - stackHit.x0)/stackHit.bw;
  const seg = stackHit.seg, T = seg.stats.seconds || 1;
  const burst = burstAt(seg, sec);
  if(!burst || burst.to - burst.from < 1) return;
  // already looking at exactly this burst: the click puts the whole fight back
  const same = state.rotFrom != null &&
               Math.abs(state.rotFrom - Math.max(0, burst.from - .5)) < .01 &&
               Math.abs(state.rotTo! - Math.min(T, burst.to + .5)) < .01;   // set together with rotFrom
  if(same){ state.rotFrom = null; state.rotTo = null; }
  else { state.rotFrom = Math.max(0, burst.from - .5); state.rotTo = Math.min(T, burst.to + .5); }
  renderViews();
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  document.querySelectorAll<HTMLElement>("#themeRow button").forEach(b => b.onclick = () => setzeThema(b.dataset.theme!));
  SYSTEM_LIGHT.addEventListener("change", () => {
    if(state.theme === "auto") applyTheme(true);
  });
  applyTheme(false, bootTheme);
  document.querySelectorAll<HTMLElement>(".viewbar").forEach(bar => {
    bar.querySelectorAll<HTMLElement>("[data-act]").forEach(btn => btn.onclick = () => {
      const act = btn.dataset.act;
      if(act === "in") setZoom((state.rotZoom || 1) * 1.5);
      else if(act === "out") setZoom((state.rotZoom || 1) / 1.5);
      else if(act === "reset"){ state.rotZoom = 1; state.rotFrom = null; state.rotTo = null; renderViews(); }
      else if(act === "apply") applyRange(bar);
    });
    bar.querySelectorAll<HTMLElement>(".vfrom,.vto").forEach(inp =>
      inp.onkeydown = e => { if(e.key === "Enter") applyRange(bar); });
  });
  // scroll-wheel zoom, the way anyone expects a timeline to behave; a plain
  /* Und dieselben zwei Behaelter mit der Tastatur. Der Browser schiebt einen
     fokussierten Rollbehaelter moeglicherweise von selbst, aber das laesst sich
     hier nicht pruefen: synthetische Tastenereignisse loesen keine
     Standardaktion aus, und das Messwerkzeug ebenso wenig - acht Pfeiltasten
     und ein Bild-ab auf einem nachweislich rollbaren 5000-Punkte-Dokument
     liessen scrollY auf 0. Ein Handler, den man pruefen kann, ist mehr wert
     als ein Verhalten, das man nicht pruefen kann, und er legt die
     Schrittweite fest, statt sie dem Browser zu ueberlassen.

     60 Punkte je Pfeiltaste: das ist knapp eine Sekunde auf der Zeitleiste bei
     mittlerem Zoom und damit ein Schritt, der sich lesen laesst. Die Bildtasten
     nehmen eine Fensterbreite, Pos1 und Ende die Enden.

     Zoomen braucht hier nichts: die drei Knoepfe der Werkzeugleiste sind echte
     Knoepfe und liegen ohnehin in der Tab-Reihenfolge. */
  // nur noch der Zeitverlauf: die Leinwand der Rotation entfaellt (Spezifikation 3)
  ["#stackScroll"].forEach(sel => {
    const box = $(sel);
    box.addEventListener("keydown", e => {
      if(e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      const w = box.clientWidth;
      const schritt = {ArrowLeft:-60, ArrowRight:60, PageUp:-w, PageDown:w}[e.key];
      if(schritt !== undefined){ box.scrollLeft += schritt; e.preventDefault(); }
      else if(e.key === "Home"){ box.scrollLeft = 0; e.preventDefault(); }
      else if(e.key === "End"){ box.scrollLeft = box.scrollWidth; e.preventDefault(); }
    });
  });
  /* Das Mausrad zoomt auch ueber der Zeitleiste der Rotation (Aufgabe 10):
     der Zoom gilt fuer sie und den Zeitverlauf darunter. Ziehen bleibt beim
     Zeitverlauf - ein Klick in die Leiste springt an die Stelle. */
  $("#deineRotScroll").addEventListener("wheel", e => {
    if(!e.ctrlKey && !e.shiftKey) return;
    e.preventDefault();
    setZoom((state.rotZoom || 1) * (e.deltaY < 0 ? 1.2 : 1/1.2));
  }, {passive:false});
  // drag on the canvas pans, so you never have to reach for the scrollbar
  ["#stackScroll"].forEach(sel => {
    const box = $(sel);
    box.addEventListener("wheel", e => {
      if(!e.ctrlKey && !e.shiftKey) return;
      e.preventDefault();
      setZoom((state.rotZoom || 1) * (e.deltaY < 0 ? 1.2 : 1/1.2));
    }, {passive:false});
    let drag: { x: number; s: number; moved: number } | null = null;
    box.addEventListener("mousedown", e => {
      /* Nur die linke Taste, wie es die gezeichneten Fenstergriffe damals auch
         hielten. Hier ist sie keine Fehlerbehebung, sondern Gleichklang: die
         rechte Taste raeumt die Zeile darunter ohnehin gleich wieder weg. Sie
         nimmt zusaetzlich das Schieben mit der mittleren Taste heraus, das nie
         jemand gewollt hat. */
      if(e.button !== 0) return;
      drag = {x:e.clientX, s:box.scrollLeft, moved:0};
    });
    addEventListener("mousemove", e => {
      if(drag){
        /* Ausserhalb des Fensters losgelassen: dieses mouseup kommt nie an, denn
           hier haengt kein setPointerCapture wie einst an den Fenstergriffen. Ohne
           diese Zeile schob das Diagramm danach unter jeder blossen
           Mausbewegung weiter, bis irgendwo der naechste Klick fiel - und der
           Zeiger stand dabei laengst wieder auf grab statt grabbing, weil das an
           :active haengt und nicht an dieser Marke. Der Zustand war also
           unsichtbar.

           e.buttons ist ein Live-Zustand auf jedem mousemove, den der Browser
           liefert, auch auf den erfundenen, die er schickt, wenn sich der Inhalt
           unter einem stehenden Zeiger bewegt - genau das passiert hier eine
           Zeile weiter. Waehrend eines echten Zuges steht es auf 1, die Zeile
           kann ein laufendes Schieben also nicht abschneiden. Sobald keine Taste
           mehr gedrueckt ist, steht es auf 0, und die erste Bewegung danach
           raeumt selbst auf, bevor irgendetwas geschoben wird. */
        if(!(e.buttons & 1)){ drag = null; return; }
        drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.x));
        box.scrollLeft = drag.s - (e.clientX - drag.x);
      }
    });
    // mousedown here is already pan, so a click only counts as a click if the
    // pointer stayed put. Four pixels is the slack a real click has.
    addEventListener("mouseup", () => { lastDragMove = drag ? drag.moved : 99; drag = null; });
  });
  for(const id of ["#stack", "#stackLanes"]) $(id).addEventListener("click", stackKlick);
}
