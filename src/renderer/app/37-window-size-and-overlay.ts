import { state } from "./01-state";
import { toast, toastFail, toastNachfuehren } from "./03-helpers";
import { t, tt } from "./08-translation";
import { markiereRest } from "./16-fight-analysis";
import { $, esc } from "./18-interface-basics";
import { catOf, HIT_CATS } from "./19-grouping-and-party-fights";
import { CAT_SWATCH } from "./21-damage-table";
import { istLivePausiert, kampfwahlOffen, kampfwahlSchliessen, streifenFolgt } from "./23-kampfwahl";
import { renderRotation } from "./25-rotation";
import { renderAnalysis } from "./26-analysis-tab";
import { persistPref } from "./27-weapons-tab";
import { renderAll } from "./32-history";
import { switchTab } from "./34-menus-drop-and-tabs";
import { applyWindowSize } from "./36-dialog";
import { FENSTER, KOMPAKT_FENSTER, OWN_WINDOW, SERVED } from "./41-server-mode";
import { isWatching } from "./45-startup";
import { syncPartySwitch } from "./42-party";
import { einstNachfuehren } from "./57-einstellungen";
import { startAuftragHolen } from "./66-windows";
import { erinnerungAnfragenPruefen } from "./67-weeklies-erinnerung";
import type { Fight, ViewOptions } from "../types";
import { durchsichtWirksam } from "../kompakt-core";

/* Was das Kompaktfenster (Nachtraege N4) den Hauptprozess fragen darf -
   dieselbe Liste wie KOMPAKT_AKTIONEN in window.ts. Rahmenknoepfe, Material,
   Groesseneinstellung und der Punkt in der Taskleiste gehoeren dem grossen
   Fenster. */
const KOMPAKT_DARF = ["kompakt", "close", "resize", "pin", "seethrough", "clickthrough"];

/** Eine Fensteraktion an den Hauptprozess. Nur im eigenen Fenster; sie nennt das Fenster (FENSTER). */
export function winPost(body: {do: string; [k: string]: unknown}): Promise<any> {
  if(!SERVED || !OWN_WINDOW) return Promise.resolve(null);
  if(KOMPAKT_FENSTER && !KOMPAKT_DARF.includes(body.do)) return Promise.resolve(null);
  return fetch("/api/win", {method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({...body, win: FENSTER})}).then(r => r.json()).catch(() => null);
}

/* ---------- size ----------
   One setting for how big everything is drawn, 10% to 200%, kept across
   restarts. It is CSS zoom on the root rather than a transform: zoom reflows,
   so at 150% the list stays a list of readable rows instead of a
   magnifying glass held over the same layout — the yield ladder in the bar
   and the wrapping all still fire, at their real widths.
   Compact needs no special case for it. Its window is measured from the rows
   it has to show, and those rows are the ones that just changed size. The
   width used to be a plain number, and it was the one thing multiplied by
   hand. That stopped being true once the top strip was measured rather than
   assumed: a measurement already carries the size setting, so
   compactWindowSize() now scales the constants it compares against instead of
   scaling the result — once, at the point of the comparison. */
const ZOOM_STEPS = [10, 25, 33, 50, 67, 75, 90, 100, 110, 125, 150, 175, 200];
export const ZOOM_MIN = ZOOM_STEPS[0]!, ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1]!;

/* The breakpoints the stylesheet used to spell as media queries. They are
   classes on <html> now, because a media query measures the window and the
   layout has the window divided by the size setting: at 150% in a 1267px
   window the bar is laid out for 845px, and the queries went on answering for
   1267. Measured before this existed, the top bar ran 236px past its own
   right edge at 150% and 737px at 200%.
   Everything else about them is unchanged — the rules kept their place in the
   stylesheet, and :where() means they kept their specificity too. */
/* 1099: unter 1100 Punkt stapeln sich die Felder der Kampf-Tafel
   (Instrumententafel 4); das Raster gilt ab 1100, also "max 1099" wie ein
   max-width:1099px. */
/* 759: unter 760 Punkt steht die Navigation der Einstellungen (57) als
   Zeile ueber den Gruppen statt links. */
/* 899: unter 900 Punkt stapelt der Bereich Kampf (Glutring, Spezifikation 7): Ringfeld, Liste, Band. */
const WIDTH_STOPS = [1172, 1099, 1040, 1012, 900, 899, 880, 832, 759, 752, 700, 692, 640, 620, 560];
export function syncWidthStops(){
  const eff = innerWidth / (clampUiZoom(state.zoom) / 100);
  const cl = document.documentElement.classList;
  for(const n of WIDTH_STOPS) cl.toggle("w-max-" + n, eff <= n);
  /* Eine Sprosse fuer die Hoehe, aus demselben Grund und in derselben
     Einheit. Die Kopfplatte ist fuer 860 Punkte Hoehe gebaut; ab 150 % auf
     einem 1280x860-Fenster bleiben 573, bei 200 % 430, und dann stand die
     Tabelle - das, weswegen man die App offen hat - ganz unter dem Falz.
     Die Stufe haengt an der Hoehe, nicht an der Einstellung: ein flaches
     Fenster bei 100 % hat dasselbe Problem, ein hoher Bildschirm bei 150 %
     nicht. */
  cl.toggle("h-max-640", innerHeight / (clampUiZoom(state.zoom) / 100) <= 640);
  /* Die Kampf-Tafel (Instrumententafel 4) fuellt die Hoehe erst ab 700
     Punkt; darunter stapeln die Felder und die Seite rollt. "max 699" wie
     die Breitenstufe 1099: bei genau 700 gilt das Raster. */
  cl.toggle("h-max-699", innerHeight / (clampUiZoom(state.zoom) / 100) <= 699);
  /* Ab 800 Punkt ist das Raster so hoch wie sein Inhalt (kompakt,
     Entscheidung 28.09.); darunter reicht der Inhalt nicht mehr ins Fenster und das
     Raster fuellt die Hoehe wie vorher, damit nichts unter den Rand faellt. */
  cl.toggle("h-max-799", innerHeight / (clampUiZoom(state.zoom) / 100) <= 799);
  /* Bis 899 Punkt ist die Kurve der Kampf-Tafel flacher (30 statt 34 % der
     Hoehe), damit das Urteil mit Bezug samt Knoepfen ohne Rollen passt
     (Pruefung 29.09., styles.css). */
  cl.toggle("h-max-899", innerHeight / (clampUiZoom(state.zoom) / 100) <= 899);
  /* Ab 1200 Punkt waechst das Band der Kampf-Tafel auf 150 (Spezifikation
     Feinschliff 6, #102); Zeilen werden nie hoeher, nur mehr. */
  cl.toggle("h-min-1200", innerHeight / (clampUiZoom(state.zoom) / 100) >= 1200);
  syncWindowVars();
  /* Eine Meldung, die gerade steht, zieht mit: ihre Lage war beim Erscheinen
     gemessen, und nach Strg+Plus auf 200 % stand sie mit den Massen von
     100 % mitten ueber Kopf und Tabelle. */
  toastNachfuehren();
}
/* Two things the stylesheet cannot work out for itself once the size setting
   is in play, both in layout pixels — which is what everything in the page is
   measured in, while innerWidth and innerHeight are the visual viewport and do
   not move with the setting.

   --winw/--winh are the window, and they replace vw and vh throughout. A vh is
   a hundredth of the window, and CSS zoom multiplies the result without
   dividing the unit: measured at 75%, 100vh came out 525px in a 700px window,
   so everything that means "fill the window" filled three quarters of it and
   left the rest black.

   --sbw/--sbh are how much of each edge a scrollbar is sitting on; nur noch
   fuer den Fehlerbericht (44-bug-report.ts), seit Windows den Rand zieht.

   --wco-reserve ist der Platz rechts in der Kopfleiste, den die Systemknoepfe
   des nativen Rahmens belegen. Windows nennt ihn in Fensterpunkten, die
   Kopfleiste steht aber unter der Groesseneinstellung: bei 150 Prozent haette
   ein Abstand in Fensterpunkten die Knoepfe um die Haelfte zu weit
   freigehalten, bei 50 Prozent halb zugedeckt. Also einmal geteilt. */
let lastChrome = 0;
export function syncWindowVars(){
  const de = document.documentElement;
  const z = clampUiZoom(state.zoom) / 100;
  const w = innerWidth / z, h = innerHeight / z;
  de.style.setProperty("--winw", w + "px");
  de.style.setProperty("--winh", h + "px");
  /* Die Breite des Scrollbalkens, und nur die. Hier standen w - clientWidth
     und h - clientHeight, und das mischte zwei Koordinatensysteme: w ist
     innerWidth GETEILT durch die Groesseneinstellung, clientWidth ist es
     nicht. Bei 100 Prozent faellt das nicht auf, weil beide gleich sind.

     Bei den eigenen 75 Prozent kam --sbw auf 436px und --sbh auf 287px heraus.
     Die Griffe fuer die Fensterraender haengen an diesen beiden Werten, und
     so sass der rechte Griff 340 Punkte innerhalb des Fensters - genau
     zwischen den Spalten DPS und Anteil. Ein Linksklick dort zog das
     Fenster groesser, statt eine Zeile auszuwaehlen. Gemeldet am 18.09.2026.

     Beide Seiten der Rechnung stehen jetzt in Geraetepixeln, und das
     Ergebnis wird einmal in CSS-Pixel umgerechnet - dieselbe Einheit, in der
     --winw und --winh stehen. (Die Griffe gibt es nicht mehr, Windows zieht
     den Rand. Der Wert bleibt fuer den Fehlerbericht.) */
  de.style.setProperty("--sbw", Math.max(0, Math.round((innerWidth - de.clientWidth) / z)) + "px");
  de.style.setProperty("--sbh", Math.max(0, Math.round((innerHeight - de.clientHeight) / z)) + "px");
  de.style.setProperty("--wco-reserve", Math.round(rahmenKnopfBreite() / z * 10) / 10 + "px");
  /* --chrome is how much of the window the header takes, and it was a
     constant. The header wraps to two rows when the bar runs out of width —
     which the size setting can cause on its own, at 150% in a window that was
     wide enough at 100% — and everything sized as "the window less the
     chrome" then hung off the bottom by exactly one row. Measured, not
     assumed, and only written when it changes, so the observer that calls
     this cannot chase its own tail. */
  const top = document.querySelector(".top");
  if(top){
    const ch = Math.round(top.getBoundingClientRect().height / z * 10) / 10;
    if(ch && ch !== lastChrome){
      lastChrome = ch;
      de.style.setProperty("--chrome", ch + "px");
    }
  }
}

export function clampUiZoom(pct: number){
  const n = Math.round(Number(pct));
  if(!isFinite(n) || !n) return 100;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n));
}
export function uiZoomFactor(){ return clampUiZoom(state.zoom) / 100; }
/* Wie breit die Systemknoepfe rechts sind, in Fensterpunkten. Windows sagt
   es selbst (Window Controls Overlay: die freie Titelleiste endet dort, wo
   die Knoepfe beginnen); ohne diese Auskunft drei Knoepfe zu 46 Punkten,
   das Mass von Windows. Ausserhalb des nativen Rahmens: nichts. */
function rahmenKnopfBreite(){
  if(!document.documentElement.classList.contains("native")) return 0;
  const wco = (navigator as any).windowControlsOverlay;
  if(wco && wco.visible && typeof wco.getTitlebarAreaRect === "function"){
    const r = wco.getTitlebarAreaRect();
    if(r && r.width > 0) return Math.max(0, innerWidth - (r.x + r.width));
  }
  return 138;
}
/* Die Hoehe der Titelleiste in Fensterpunkten: 36 Layoutpunkte (--chrome,
   seit der Neugestaltung 28.09., Luecke 0.2; vorher 40) mal der Groesseneinstellung. So hoch zeichnet
   Windows seine Knoepfe; der Hauptprozess begrenzt die Zahl (chrome.ts),
   Farben schickt die Seite nie. Bricht die Leiste im schmalen Fenster um,
   bleibt ihre erste Zeile so hoch. */
export function kopfHoehe(){ return Math.round(36 * uiZoomFactor()); }
/* Die Systemknoepfe auf Thema und Hoehe der Kopfleiste bringen. Nur in der
   Vollansicht: im Kompaktmodus sind sie ausgeblendet (mit und ohne Acrylic),
   und "material" setzt sie beim Verlassen in Thema und Hoehe von dann. */
export function syncRahmenKnoepfe(){
  if(!document.documentElement.classList.contains("native")
     || document.body.classList.contains("compact")) return;
  winPost({do:"chrome", theme: document.documentElement.dataset.theme, height: kopfHoehe()});
}
function applyUiZoom(){
  const z = clampUiZoom(state.zoom);
  // 100% clears the property instead of setting 1: an app nobody has touched
  // should carry no zoom at all
  document.documentElement.style.zoom = z === 100 ? "" : String(z / 100);
  syncWidthStops();   // the layout just got a different amount of room
  // die Kopfleiste ist mitgewachsen, die Systemknoepfe darueber muessen folgen
  syncRahmenKnoepfe();
}
export function syncZoomRow(){
  const val = $("#zoomVal");
  if(!val) return;
  const z = clampUiZoom(state.zoom);
  val.textContent = z + "%";
  val.title = t("top.zoomReset");
  // dieselbe Zahl in der Statusleiste, mit geschuetztem Leerzeichen vor %
  const sb = document.getElementById("sbZoom");
  if(sb){
    sb.textContent = z + "\u00a0%"; sb.title = t("top.zoomReset");
    // der Vorleser hoert Zahl und Handlung, nicht nur "150 %"
    sb.setAttribute("aria-label", t("sb.zoomLabel", {z}));
  }
  $<HTMLButtonElement>("#zoomOut").disabled = z <= ZOOM_MIN;
  $<HTMLButtonElement>("#zoomIn").disabled = z >= ZOOM_MAX;
  $("#zoomRow").title = t("top.zoomTitle");
}
export function setUiZoom(pct: number, opts?: ViewOptions){
  const z = clampUiZoom(pct);
  const was = clampUiZoom(state.zoom);
  state.zoom = z;
  applyUiZoom();
  syncZoomRow();
  einstNachfuehren();   // der Regler der Einstellungen folgt, woher die Groesse auch kam
  if(z === was && !(opts && opts.force)) return;
  if(!(opts && opts.quiet)) persistPref("uiZoom", z);
  // the canvases size themselves from their own boxes, and compact's window
  // from its rows — both of those just changed. Changing the size is itself a
  // statement about how big the window should be, so it overrules a compact
  // window that was dragged to a size by hand.
  state.compactHandSized = false;
  refitCanvases();
  /* Der Deckel der Tabelle zaehlt Zeilen im Fenster, und das Fenster hat
     in Layoutpunkten gerade eine andere Hoehe. Ohne diesen Aufruf stand
     nach Strg+Plus auf 200 % noch der Schnitt von 100 % da, und die
     Zaehlung im Kopf ("9 von 12") gehoerte zu einem Kasten, den es nicht
     mehr gab. */
  markiereRest();
  if(document.body.classList.contains("compact")) applyWindowSize();
  // At startup the saved size is applied to a window that was just created at
  // its fixed default, so it is sized from that default rather than scaled
  // from wherever it is. Scaling on every launch would multiply: 150% saved
  // would mean 1.5x bigger than last time, every time.
  else if(opts && opts.fromStart){
    /* Steht das Fenster schon an seiner gemerkten Lage (Fenster-Extras 3.4),
       hat es die Groesse, die es mit dieser Einstellung zuletzt hatte - vom
       Standard aus gerechnet waere sie wieder weg. */
    if(!opts.keepWindow) sizeWindowFor(z);
  }
  else scaleWindowBy(z / was);
}
/* Setting the size bigger should make the window bigger, not fit less of the
   app into the same frame. Compact works that out from the rows it has to
   show; full view has no such measurement, so it scales by the same factor
   the content just did.
   Die Aktion heisst "size", nicht "resize": resize merkt sich eine "Groesse
   vor Kompakt", die die Vollansicht spaeter wiederherstellt, und das hier ist
   keine - es ist die eigene Groesse des Fensters, die sich aendert. Frueher
   ging das ueber "edge" (die Randgriffe); die gibt es mit dem nativen Rahmen
   nicht mehr, und der Hauptprozess kennt "edge" nicht mehr. Nur im eigenen
   Fenster (winPost): ein Browser-Tab auf 127.0.0.1 soll das Fenster der App
   nicht von der Seite her umstellen. */
const WINDOW_BASE_W = 1280, WINDOW_BASE_H = 860;   // what src/main/window.ts creates
function setWindowSize(w: number, h: number){
  const maxW = (typeof screen !== "undefined" && screen.availWidth) || 4096;
  const maxH = (typeof screen !== "undefined" && screen.availHeight) || 2160;
  void winPost({do:"size",
    w: Math.min(maxW, Math.max(SIZE_MIN_W, Math.round(w))),
    h: Math.min(maxH, Math.max(SIZE_MIN_H, Math.round(h)))});
}
function scaleWindowBy(ratio: number){
  if(!isFinite(ratio) || ratio === 1) return;
  setWindowSize(innerWidth * ratio, innerHeight * ratio);
}
function sizeWindowFor(z: number){
  if(z === 100) return;   // the window is already the size it was created at
  setWindowSize(WINDOW_BASE_W * z / 100, WINDOW_BASE_H * z / 100);
}
function stepUiZoom(dir: number){
  const z = clampUiZoom(state.zoom);
  const next = dir > 0
    ? ZOOM_STEPS.find(s => s > z)
    : ZOOM_STEPS.slice().reverse().find(s => s < z);
  setUiZoom(next === undefined ? z : next);
}

export function clampSee(v: number | string){
  v = Math.round(Number(v) || 0);
  return Math.max(0, Math.min(55, v));
}
/* Der Boden, unter den die Durchsicht nicht geht, solange der Geist an
   ist. Beide Einstellungen multiplizieren sich am Fenster: .55 mal .45
   ergab 0,248 wirksame Deckkraft, und dort stand die Heldenzahl bei 1,60
   bis 1,95 zu 1. Keine der beiden Stellen wusste von der anderen. */
const GEIST_BODEN = 0.75;

/* Ob das Kompaktfenster schon weiss, ob es auf Acrylic liegt (Kompakt-Fix 4,
   Nachtrag 01.10.): mit Acrylic toent die Durchsicht nur den Grund
   (--glass-a), das Fenster bleibt deckend; ohne blendet es als Ganzes ab.
   Ein Schutz, kein Befund: kaeme die Durchsicht vor /api/state (ueber
   /api/config, das sie heute nicht liefert), ginge sonst alpha .45 an das
   ganze Fenster. Im echten Fenster mit Acrylic blieb es deckend
   (test-window); die Beobachtung erklaert das nicht. */
let materialBekannt = false;
/** /api/state ist da und html.acrylic gesetzt (41): jetzt gilt die Durchsicht. */
export function materialGemeldet(){
  materialBekannt = true;
  applySeeThrough({quiet:true});
}
export function applySeeThrough(opts?: ViewOptions){
  const on = document.body.classList.contains("compact");
  const geist = on && document.body.classList.contains("ghost");
  /* Der Regler, wie er steht, und was gilt: im Durchklick mindestens 40
     (Spezifikation Kompakt-Fenster 2). Der Regler und compactAlpha behalten
     seinen Wert; angezeigt und ans Fenster geht, was gilt. */
  const regler = clampSee(state.seeThrough);
  const see = durchsichtWirksam(regler, on && durchklick);
  /* Gesagt, nicht still getan: wenn der Geist den Regler deckelt, steht es
     unter ihm. */
  const gedeckelt = Math.round((1 - GEIST_BODEN) * 100);
  const greift = geist && see > gedeckelt;
  /* Die Anzeige nennt, was gilt, nicht was eingestellt ist. Vorher stand
     dort "55 %", waehrend das Fenster bei 25 blieb - eine Zahl, die etwas
     anderes sagt als das, was man sieht. Der Regler behaelt seinen Stand:
     schaltet man den Geist ab, gilt er wieder. */
  $("#seeVal").textContent = (greift ? gedeckelt : see) + " %";
  const zettel = $("#seeNote");
  if(zettel){
    zettel.hidden = !greift;
    if(greift) zettel.textContent = t("top.seeCapped", {n: gedeckelt});
  }
  syncSeePille(on ? (greift ? gedeckelt : see) : 0);
  $<HTMLInputElement>("#seeSlide").value = String(regler);
  $<HTMLButtonElement>("#seeLess").disabled = regler <= 0;
  $<HTMLButtonElement>("#seeMore").disabled = regler >= 55;
  einstNachfuehren();   // derselbe Stand im Regler der Einstellungen
  if(!SERVED) return;
  const acrylic = document.documentElement.classList.contains("acrylic");
  /* Mit Acrylic stellt der Regler die Toenung ein, nicht das Fenster: 0 %
     Durchsicht ist Toenung .92, das Maximum (55) ist .65 - darunter wird
     weisse Schrift auf einer hellen Spielszene unlesbar. Die Vollansicht ist
     immer deckend: Durchsicht ist eine Eigenschaft des Overlays.
     Der Geist bleibt, wie er vor Acrylic war (Spezifikation): mit ihm blendet
     das Fenster nach dem Regler ab, nie unter GEIST_BODEN - bei Regler 0 also
     gar nicht. Vorher stand auf Acrylic fest .75, auch bei 0, und #seeVal
     sagte "0 %" zu einem Fenster, das sichtbar verblasst war. */
  /* Am Anschlag .65 statt .5 (Entscheidung vom 29.09. (an Claude
     uebertragen), Pruefung Aufgabe 9): ueber einer hellen Szene blieb die
     Schrift bei .5 unter AA, im TnL-Thema auch bei .6. */
  document.documentElement.style.setProperty("--glass-a", (0.92 - (see/55) * 0.27).toFixed(3));
  const geistAlpha = Math.max(1 - see/100, GEIST_BODEN);
  /* Im Kompaktfenster erst, wenn /api/state gesagt hat, ob Acrylic da ist
     (Kompakt-Fix 4, materialGemeldet). */
  if(KOMPAKT_FENSTER && !materialBekannt) return;
  winPost({do:"seethrough",
    alpha: !on ? 1
         : acrylic ? (geist ? geistAlpha : 1)
         : (geist ? geistAlpha : 1 - see/100)});
  if(!(opts && opts.quiet)) persistPref("compactAlpha", 1 - regler/100);
}
/* Overlay-Look (Neugestaltung 28.09., Luecke 11.5): die Pille mit dem Auge
   rechts im Streifen nennt die Durchsicht, die gerade gilt - nur im Kompakt
   und nur ueber 0. Sie liegt absolut ueber der Leiste, darum zaehlt sie
   beim Messen des Fensters nicht mit (compactWindowSize in 36); im
   Durchklick steht statt ihrer die Pille mit dem Schloss. */
let seePilleWert = 0;
function syncSeePille(n: number){
  seePilleWert = n;
  const pille = document.querySelector<HTMLElement>("#seePille");
  if(!pille) return;
  pille.hidden = !(n > 0);
  // Luecke 11.7: bei Durchsicht stehen die leisen Texte in der Textfarbe (styles.css)
  document.body.classList.toggle("durchsicht", n > 0);
  $("#seePilleText").textContent = n + "\u00a0%";
  pille.setAttribute("aria-label", t("compact.seePille", {n}));
}
/* Die eine Handlung "Durchsicht setzen": das Kompakt-Menue und die
   Einstellungen rufen sie (input still beim Ziehen, change schreibt). */
export function setSee(v: number | string, opts?: ViewOptions){
  state.seeThrough = clampSee(v);
  applySeeThrough(opts);
}

/* Die Untergrenze, die setWindowSize() einhaelt: dieselbe, die das Fenster
   selbst hat (MIN_ACTION_W/H in window.ts). */
const SIZE_MIN_W = 180, SIZE_MIN_H = 100;

/* ---------- stay on top ----------
   Only offered alongside compact: a small window sitting over the game is
   the point of compact, and "stay on top" is a plain OS window-manager
   flag (Win32 topmost) — the same mechanism a pinned Discord or browser
   window already uses while gaming. It never touches the game process,
   reads its memory, or hooks its renderer, so it carries none of the risk
   a render-hook overlay would; Borometer was never going to build that anyway. */
/* Ob das Anheften im Kompakt entstand (Knopf, Merken vom letzten Start,
   Kuerzel). Nur dieses loest das Verlassen von Kompakt wieder; wer schon in
   der Vollansicht angeheftet hatte, bleibt angeheftet. */
let pinAusKompakt = false;
export function setPinButton(on: boolean){
  const war = $("#btnPin").getAttribute("aria-pressed") === "true";
  if(on !== war) pinAusKompakt = on && document.body.classList.contains("compact");
  $("#btnPin").setAttribute("aria-pressed", on ? "true" : "false");
  $("#btnPin").title = on ? t("top.pinOn") : t("top.pinOff");
  einstNachfuehren();   // "Ueber dem Spiel halten" in den Einstellungen zeigt denselben Stand
}
/* Dasselbe fuer den Geist. Der title stand an drei Stellen von Hand, und
   applyStaticI18n setzte ihn beim Sprachwechsel auf den Aus-Satz zurueck -
   bei eingeschaltetem Geist hiess der Knopf dann "Von selbst durchsichtig
   werden", waehrend er es laengst tat. Der Zustand ist body.ghost. */
export function syncGhostButton(){
  const on = document.body.classList.contains("ghost");
  $("#btnGhost").setAttribute("aria-pressed", on ? "true" : "false");
  $("#btnGhost").title = on ? t("top.ghostOn") : t("top.ghostOff");
}

/* Both views carry one strip of chrome, not two: the drag region and the
   window buttons move into the header and the title bar goes away. Compact
   gets back 22px of a window measured in 20px rows; full view stops printing
   "Borometer" twice, one line above itself, and starts everything below it
   34px higher.
   They move rather than get duplicated: pywebview looks the drag region up by
   querying the document at every mousedown, so a second copy would be a
   second drag handle, and two #winClose buttons cannot both be the one the
   click handler is bound to. Called once, when the title bar is revealed —
   nothing puts them back, because nothing wants them back. */
export function placeWindowChrome(){
  const bar = $("#titlebar"), strip = $(".top");
  const drag = document.querySelector(".tdrag"), btns = document.querySelector(".wbtns");
  if(!bar || !strip || !drag || !btns) return;
  // In a plain browser tab the title bar stays hidden, because the real
  // browser chrome is there and fake window buttons would be a lie. Folding
  // them into the header would put them on screen after all.
  if(bar.hidden) return;
  // Der Griff vorn, die Fensterknoepfe hinten (#188): Electron baut den
  // Ziehbereich in der Reihenfolge des Dokuments, und was spaeter kommt,
  // gilt. Stuende der Griff hinter den Knoepfen der Leiste, zoege er auch
  // unter ihnen. Wo er erscheint, sagt order in styles.css.
  if(drag.parentNode !== strip) strip.prepend(drag);
  if(btns.parentNode !== strip) strip.appendChild(btns);
}

/* Zweimal Escape, nicht einmal. Escape ist im Spiel die Abbruchtaste -
   die meistgedrueckte Taste ueberhaupt -, und ein Fehlgriff auf dem
   Overlay warf bisher sofort das grosse Fenster ueber den Boss. Das
   erste Escape sagt, was das zweite tut; nach zwei Sekunden zaehlt es
   nicht mehr. */
/* -Infinity, nicht 0: performance.now() zaehlt ab dem Laden der Seite, und
   in den ersten zwei Sekunden galt schon das erste Escape als zweites. Beim
   Kompaktfenster (Nachtraege N4), das gerade erst geladen hat, schloss so
   ein einziges Escape den Streifen. */
let escFenster = -Infinity;

/* ---------- Durchklick ----------
   Im Kompaktmodus kann das Fenster die Maus durchlassen: ein Klick landet im
   Spiel darunter. Umgeschaltet wird nur mit Strg+Umschalt+D, einem globalen
   Kuerzel des Hauptprogramms (hotkey.ts) - im Fenster selbst laesst sich dann
   ja nichts mehr anklicken. Aus der Vollansicht heraus macht dasselbe
   Kuerzel das ganze Overlay auf einmal: kompakt, oben, durchklickbar.
   Verlaesst man den Kompaktmodus, geht der Durchklick immer mit aus. */
let durchklick = false;
/* Kompakt ein oder aus in DIESEM Fenster (der Streifen im selben Fenster
   oder das Kompaktfenster beim Start); gesetzt in setup(). */
let kompaktSchalten: (on: boolean) => void = () => {};

/* ---------- Kompakt als eigenes Fenster (Nachtraege N4) ----------
   Im grossen Fenster: ob der Streifen offen ist, zeigt der Knopf mit
   aria-pressed; Oeffnen und Schliessen macht der Hauptprozess. Das
   Kompaktfenster laeuft mit Live, wenn Live hier laeuft, und startet
   durchklickbar, wenn das Kuerzel es geoeffnet hat. */
export function setKompaktOffen(offen: boolean){
  state.kompaktOffen = offen;
  $("#btnCompact").setAttribute("aria-pressed", offen ? "true" : "false");
  /* Wettlauf N4 (Fix 04.10.): was sich am Stand aenderte, waehrend die
     Antwort auf "kompakt" unterwegs war, oder ein abgelehnter Stand geht
     jetzt hinaus - nicht erst beim naechsten Zeichnen, das vielleicht nie
     kommt. */
  if(offen) standFolgen();
}
/* ---------- Der Stand der Vollansicht fuer den Streifen (Kompakt-Fix 01.10.) ----------
   Befund: die Vollansicht zeigte einen Kampf, der Streifen "Kein
   Log" - er liest nur bei Live mit, eine hier geoeffnete Datei kannte er
   nicht. Jetzt sagt die Vollansicht dem Hauptprozess, was sie zeigt: bevor
   sie den Streifen oeffnet und bei jedem Wechsel, solange er offen ist.
   Live, eine Datei (ihr Name und der Start des gewaehlten Kampfs), eine
   Datei, die kein Kampf-Log ist (andere), das Beispiel, mehrere Dateien
   oder nichts. Ob die Datei im Log-Ordner liegt, entscheidet erst
   GET /api/log im Streifen; hier ist sie nur ein Name. */
type VollStand = {grund: string; datei: string; kampf: number | null};
function vollStand(): VollStand {
  const nur = (grund: string): VollStand => ({grund, datei: "", kampf: null});
  if(isWatching() || istLivePausiert()) return nur("live");
  if(state.origin === "sample") return nur("beispiel");
  const namen = state.fileNames || [];
  if(!state.text || !namen.length) return nur("leer");
  if(namen.length > 1) return nur("mehrere");
  // kein Kampf-Log (ein Gruppen-Log, eine Tabelle aus der Log-Einrichtung): eigener Satz (Gutachten N6)
  if(!/\.(txt|log)$/i.test(namen[0]!)) return nur("andere");
  const seg = state.encounters[state.sel];
  return {grund: "datei", datei: namen[0]!, kampf: seg ? Math.round(seg.start) : null};
}
let standZuletzt = "";
function standSenden(){
  const st = vollStand();
  standZuletzt = JSON.stringify(st);
  /* Kam er nicht an oder lehnte der Hauptprozess ihn ab, geht er beim
     naechsten Zeichnen noch einmal (Gutachten N4). */
  return winPost({do:"stand", ...st}).then(d => {
    if(!d || !d.ok) standZuletzt = "";
    return d;
  });
}
/** Nach jedem Zeichnen (renderAll): hat sich der Stand geaendert, waehrend der Streifen offen ist, erfaehrt er es. */
export function standFolgen(){
  if(KOMPAKT_FENSTER || !state.zweiFenster || !state.kompaktOffen) return;
  if(JSON.stringify(vollStand()) === standZuletzt) return;
  void standSenden();
}
function kompaktFensterSchalten(on: boolean, durch = false){
  /* Vor dem Oeffnen der Stand: der Streifen fragt ihn beim Laden ab. */
  const vorher = on ? standSenden() : Promise.resolve(null);
  /* Live gilt auch als an, wenn es fuer einen frueheren Tag nur pausiert
     (Abschlusspruefung, M1): der Streifen ueber dem Spiel liest dann weiter. */
  void vorher.then(() => winPost({do:"kompakt", on, live: isWatching() || istLivePausiert(), durch})).then(d => {
    if(!d){ toastFail(tt("party.helperNoAnswer")); return; }
    if(!d.ok){ toastFail(tt("compact.fensterFehler", {why: d.error || "?"}), 6000); return; }
    setKompaktOffen(!!d.offen);
  });
}
async function kompaktStandHolen(){
  try {
    const s = await (await fetch("/api/state")).json();
    setKompaktOffen(!!(s.kompakt && s.kompakt.offen));
  } catch(err) {
    // der Helfer ist gerade weg: beim naechsten Ereignis wieder
  }
}
async function vollStandHolen(){
  try {
    const s = await (await fetch("/api/state")).json();
    void streifenFolgt(s.kompakt);
  } catch(err) {
    // der Helfer ist gerade weg: beim naechsten Ereignis wieder
  }
}
/* Das Kompaktfenster beim Start: gleich der Streifen (45-startup.ts). */
export function kompaktFensterAuf(){
  document.title = t("compact.fensterTitel");
  kompaktSchalten(true);
  /* Es entsteht immer vorn (window.ts), also steht Anheften an. */
  setPinButton(true);
}
/* ... und sobald /api/state da ist: vom Kuerzel geoeffnet, gleich
   durchklickbar (wie das Kuerzel aus der Vollansicht es bisher tat). */
export function kompaktFensterStart(durch: boolean){
  if(durch) setDurchklick(true);
}
let hotkeyFrei = true;   // false: another program holds the combination

/** The combination as the reader's keyboard labels it. */
export const kuerzelText = () => state.lang === "de" ? "Strg+Umschalt+D" : "Ctrl+Shift+D";

function syncHotkeyNote(){
  const note = $("#hotkeyNote");
  if(!note) return;
  note.hidden = !OWN_WINDOW;
  note.textContent = hotkeyFrei ? t("compact.throughNote", {key: kuerzelText()})
                                : t("compact.throughTaken", {key: kuerzelText()});
  /* Das Kuerzel stand nur in den Einstellungen. Am Knopf, der den
     Kompaktmodus schaltet, findet es auch, wer nie dorthin schaut. */
  const knopf = $("#btnCompact");
  /* Im Streifen ist der Knopf ein Symbol: der title nennt dort, was er tut */
  if(document.body.classList.contains("compact")) knopf.title = t("top.fullView");
  else if(OWN_WINDOW && hotkeyFrei) knopf.title = t("top.compactKeyTitle", {key: kuerzelText()});
  else knopf.removeAttribute("title");
  $("#btnDurch").title = t("top.durchTitle", {key: kuerzelText()});
  // die Einstellungen zeigen denselben Satz (belegt oder frei)
  einstNachfuehren();
}
/* Overlay-Look (Luecke 11.5): die Pille mit dem Schloss sagt
   "durchklickbar" und das Kuerzel, das zurueckholt - sichtbar, denn im
   Durchklick erreicht die Maus keinen title (Pruefung Aufgabe 9, M3). */
function syncThroughHint(){
  const hint = $("#throughHint");
  hint.hidden = !durchklick;
  $("#throughText").textContent = t("compact.throughKurz") + " \u00b7 " + kuerzelText();
  document.body.classList.toggle("through", durchklick);
  $("#btnDurch").setAttribute("aria-pressed", durchklick ? "true" : "false");
}
function setDurchklick(on: boolean){
  if(!OWN_WINDOW || on === durchklick) return;
  fetch("/api/win", {method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({do:"clickthrough", on, win: FENSTER})})
    .then(r => r.json())
    .then(d => {
      if(!d.ok){ toastFail(tt("compact.throughFailed", {why: d.error || "?"}), 6000); return; }
      durchklick = !!d.clickthrough;
      syncThroughHint();
      // die Durchsicht folgt dem Durchklick (40 %), still: nichts wird gespeichert
      applySeeThrough({quiet:true});
      toast(tt(durchklick ? "compact.throughToastOn" : "compact.throughToastOff", {key: kuerzelText()}), 2600);
    })
    .catch(() => toastFail(tt("party.helperNoAnswer")));
}
/* Was ein Druck auf das Kuerzel tut. Aus der Vollansicht: kompakt werden,
   nach oben, durchklickbar. Im Kompaktmodus: Durchklick an oder aus - und
   an heisst auch oben, denn ein durchklickbares Fenster hinter dem Spiel
   waere nur ein unsichtbares. */
/* Der Knopf im Streifen tut, was das Kuerzel im Kompakt tut: oben halten
   und die Maus durchlassen (oder zurueck, falls er doch erreicht wird). */
function aufDurchKnopf(){
  const an = !durchklick;
  if(an && $("#btnPin").getAttribute("aria-pressed") !== "true") $("#btnPin").click();
  setDurchklick(an);
}
function aufKuerzel(){
  /* Kompakt als eigenes Fenster (N4): aus dem grossen Fenster oeffnet das
     Kuerzel das Kompaktfenster, gleich durchklickbar; ist es schon offen,
     gehoert das Kuerzel ihm (es hoert dasselbe Ereignis). */
  if(state.zweiFenster){
    if(!state.kompaktOffen) kompaktFensterSchalten(true, true);
    return;
  }
  const kompakt = document.body.classList.contains("compact");
  if(!kompakt) $("#btnCompact").click();
  const an = !kompakt || !durchklick;
  if(an && $("#btnPin").getAttribute("aria-pressed") !== "true") $("#btnPin").click();
  setDurchklick(an);
}
/* Das Ohr fuer alles, was ausserhalb der Seite passiert: das Kuerzel und die
   zwei Knoepfe in der Vorschau der Taskleiste (events.ts). Eine Anfrage, die
   wartet, bis sich ein Zaehler bewegt; zuerst nur der Stand - ob die
   Kombination zu haben war -, dann in Schleife. Faellt der Helfer weg, drei
   Sekunden Pause statt eines Sturms von Anfragen.
   Die Schleife beginnt erst, wenn der Stand bekannt ist: die Zaehler im
   Hauptprozess laufen ueber ein Neuladen der Seite weiter. Fing sie bei 0
   an, weil die erste Frage scheiterte, hielt sie jeden alten Tastendruck
   und Knopfklick fuer neu und spielte sie alle noch einmal ab. */
async function horcheAufEreignisse(){
  let gesehen: Record<string, number> = {hotkey:0, compact:0, live:0, handsize:0, material:0, kompakt:0, kompakthand:0, kompaktstand:0, pin:0, start:0, erinnerung:0, weeklies:0};
  for(;;){
    try {
      const d = await (await fetch("/api/events?now=1")).json();
      gesehen = {...gesehen, ...(d.counts || {})}; hotkeyFrei = d.registered !== false;
      break;
    } catch(err) {
      // der Helfer ist noch nicht da: warten und nochmal fragen
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  syncHotkeyNote();
  for(;;){
    try {
      const d = await (await fetch("/api/events?seen=" + encodeURIComponent(JSON.stringify(gesehen)))).json();
      hotkeyFrei = d.registered !== false;
      const c = d.counts || {};
      const neu = (k: string) => (c[k] || 0) - (gesehen[k] || 0);
      // zwei schnelle Druecke heben sich auf, wie bei einem Lichtschalter
      if(neu("hotkey") > 0 && neu("hotkey") % 2 === 1) aufKuerzel();
      /* Eine Erinnerung der Weeklies ist faellig: die Seite sagt dem Hauptprozess, wie viele Charaktere noch offen haben (67).
         Und ihre Meldung will die Weeklies sehen (Klick auf "Ansehen"). Beides nur im grossen Fenster. */
      if(!KOMPAKT_FENSTER && neu("erinnerung") > 0) erinnerungAnfragenPruefen();
      if(!KOMPAKT_FENSTER && neu("weeklies") > 0) switchTab("weeklies");
      /* Die beiden Knoepfe der Taskleisten-Vorschau sind Umschalter wie die
         eigenen Knoepfe, fuer die sie stehen: jeder Klick dort ist ein Klick
         hier. Zwischen zwei Abfragen koennen mehrere zusammenkommen; eine
         gerade Zahl hebt sich auf wie beim Kuerzel, eine ungerade schaltet
         einmal. */
      /* Die Knoepfe der Vorschau sitzen am grossen Fenster; das
         Kompaktfenster hat keinen Platz in der Taskleiste und schaltet mit
         ihnen nichts (N4). */
      if(!KOMPAKT_FENSTER && neu("compact") > 0 && neu("compact") % 2 === 1) $("#btnCompact").click();
      /* #btnWatch steht an jedem Ort in der Titelleiste (seit 28.09. auch
         auf der Startseite); #btnWatch2 dort traegt denselben Handler. */
      if(!KOMPAKT_FENSTER && neu("live") > 0 && neu("live") % 2 === 1) $("#btnWatch").click();
      /* Das Fenster wurde am Rand von Hand gezogen (will-resize in window.ts).
         Im Kompaktmodus gilt die Groesse von da an, sonst schriebe
         applyWindowSize() beim naechsten Zeichnen die gerechnete darueber.
         Die eigenen Aufrufe von setContentSize melden sich dort nicht. */
      if(!KOMPAKT_FENSTER && neu("handsize") > 0 && document.body.classList.contains("compact"))
        state.compactHandSized = true;
      /* Dasselbe fuer das Kompaktfenster, das seinen eigenen Rand hat (N4). */
      if(KOMPAKT_FENSTER && neu("kompakthand") > 0) state.compactHandSized = true;
      /* Das Kompaktfenster ging auf oder zu - auch von selbst (Vollansicht,
         Schliessen im Streifen): der Knopf im grossen Fenster folgt. */
      if(state.zweiFenster && neu("kompakt") > 0) await kompaktStandHolen();
      /* Die Vollansicht zeigt jetzt etwas anderes (Kompakt-Fix 01.10.): der
         Streifen holt ihren Stand und folgt (23, streifenFolgt). */
      if(KOMPAKT_FENSTER && neu("kompaktstand") > 0) await vollStandHolen();
      /* Windows hat "Transparenzeffekte" umgeschaltet (transparencyChanged in
         window.ts): ob Kompakt jetzt auf Acrylic liegt, sagt /api/state. */
      if(neu("material") > 0) await materialNachfragen();
      /* Das Infobereich-Menue (tray.ts): "Ueber dem Spiel anheften" ist ein
         Klick auf den eigenen Knopf; ein Auftrag aus der Sprungliste wird
         geholt, getan und quittiert (66) - ohne die Schleife aufzuhalten. */
      if(!KOMPAKT_FENSTER && neu("pin") > 0 && neu("pin") % 2 === 1) $("#btnPin").click();
      if(!KOMPAKT_FENSTER && neu("start") > 0) void startAuftragHolen();
      gesehen = {...gesehen, ...c};
    } catch(err) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

/* Ob Kompakt gerade auf Acrylic liegt (Fenster-Extras 3.3). html.acrylic
   entscheidet, ob der Regler die Toenung stellt oder das ganze Fenster
   verblassen laesst; darum danach die Durchsicht neu. */
async function materialNachfragen(){
  try {
    const s = await (await fetch("/api/state")).json();
    document.documentElement.classList.toggle("acrylic", !!s.material);
    if(OWN_WINDOW) micaMerken(s);
    applySeeThrough({quiet:true});
  } catch(err) {
    // der Helfer ist gerade weg: beim naechsten Ereignis wieder
  }
}

/* Rauchglas (Spezifikation 4.2): ob das grosse Fenster auf Mica liegt und,
   wenn nicht, warum - beides sagt /api/state. html.mica schaltet die
   durchsichtige Schicht in styles.css, data-mica-grund den Satz unter der
   Kachel (57). Nur das eigene Fenster ruft das. Das Kompaktfenster
   (?win=1&kompakt=1) ist auch ein eigenes Fenster, liegt aber nie auf Mica -
   /api/state meldet dort, was fuer das grosse gilt; es bekommt beides nie. */
export function micaMerken(s: { mica?: unknown; micaGrund?: unknown }){
  const root = document.documentElement;
  root.classList.toggle("mica", s.mica === true && !KOMPAKT_FENSTER);
  if(!KOMPAKT_FENSTER && (s.micaGrund === "system" || s.micaGrund === "aus")) root.dataset.micaGrund = s.micaGrund;
  else delete root.dataset.micaGrund;
  einstNachfuehren();
}

/* Der Randlos-Hinweis (Fenster-Extras 3.5): beim ersten Kompakt im eigenen
   Fenster, bis "Verstanden" ihn quittiert - danach nie wieder. Ob das Spiel
   randlos laeuft, weiss Borometer nicht und fragt es nicht: der Satz ist nur
   Text. null heisst, die Einstellungen sind noch nicht da; dann lieber
   keiner. Im Streifen ist eine Meldung eine Zeile, darum die kurze Fassung;
   der ganze Satz steht im ⋯-Menue (#randlosNote). Ruhig: kein Gold, kein Rot. */
export function randlosHinweis(){
  if(!SERVED || !OWN_WINDOW || state.randlosGesehen !== false) return;
  toast(tt("compact.randlosKurz"), 12000, "ruhig", {label: tt("compact.randlosOk"), fn: () => {
    state.randlosGesehen = true;
    persistPref("randlosGesehen", true);
  }});
}

let rt: ReturnType<typeof setTimeout> | undefined;
function refitCanvases(){
  if(!state.encounters.length) return;
  // Zeitleiste und Zeitverlauf (Aufgabe 10) zeichnet renderRotation zusammen
  if(state.tab === "rotation") renderRotation();
  if(state.tab === "analysis") renderAnalysis();
}

/* Die Trefferarten in einem Zeitfenster, gezaehlt. Die Grenzen sind
   Millisekunden seit dem Kampfbeginn, damit dieselbe Funktion einen
   Einsatz in der Rotation und ein geglaettetes Fenster im Zeitverlauf
   bedienen kann.

   Gezaehlt und nicht als Anteil: gefragt ist "war das ein Krit", und
   darauf antwortet eine Anzahl. Bei einem einzelnen Treffer steht dann
   schlicht die Art da. */
export function artenZaehlung(seg: Fight, vonMs: number, bisMs: number, nurSkill: string | null){
  if(!seg) return null;
  const zahl = new Map();
  let ges = 0;
  for(const e of seg.events){
    const rel = e.t - seg.start;
    if(rel < vonMs || rel > bisMs) continue;
    if(nurSkill && e.skill !== nurSkill) continue;
    const k = catOf(e);
    const c = zahl.get(k) || {n: 0, d: 0};
    c.n++; c.d += e.dmg;
    zahl.set(k, c);
    ges++;
  }
  if(!ges) return null;
  return {ges, teile: HIT_CATS.filter(k => zahl.has(k))
    .map(k => ({k, n: zahl.get(k).n, d: zahl.get(k).d}))
    .sort((a, b) => b.d - a.d)};
}
/* Genau eine Faehigkeit eingeschaltet? Nur dann steht die Trefferart im
   Hinweisfenster - so ist es gewollt, und so bleibt das Fenster
   im Normalfall so kurz wie vorher. Gibt den Namen zurueck oder null. */
export function einzigeSpur(namen: string[], aus: Set<string>){
  const an = namen.filter(n => !aus.has(n));
  return an.length === 1 ? an[0] : null;
}
/* Eine Zeile aus den Zaehlungen. Farbtupfer wie in der Tabelle, damit es
   dieselbe Sprache ist. Bei nur einem Treffer steht die Art allein da -
   "1 kritisch stark" waere gezaehlt, wo nichts zu zaehlen ist. */
export function artenZeile(a: ReturnType<typeof artenZaehlung>){
  if(!a) return "";
  /* Jede Art in ein eigenes Element: nackter Text in einem Flex-Kasten
     wird Wort fuer Wort zu einem eigenen Teil, und das Fenster schnurrte
     dadurch auf 128 Punkte Breite und 450 Punkte Hoehe zusammen. */
  const einer = a.ges === 1;
  return '<span class="tiparten">' + a.teile.map(p =>
    '<em><i style="background:' + (CAT_SWATCH[p.k] || "currentColor") + '"></i>' +
    (einer ? "" : p.n + "\u00d7 ") + esc(t("hitcat." + p.k)) + "</em>").join("") + "</span>";
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  // die Hilfe zum Kompaktfenster: nur in der App, wie das Kuerzel darueber
  $("#randlosNote").hidden = !(SERVED && OWN_WINDOW);
  // der Satz aus #57 (N4): ein Fenster ueber dem Spiel, kein Overlay im Spiel
  $("#fensterNote").hidden = !(SERVED && OWN_WINDOW);
  /* Anheften steht in der Vollansicht, aber nur im eigenen Fenster: aus einem
     Browser-Tab auf 127.0.0.1 hefte es das Fenster der App von der Seite an
     (Instrumententafel 3.1). Im Kompakt gilt weiter die Regel unten. */
  $("#btnPin").hidden = !(SERVED && OWN_WINDOW);
  /* Both, and deliberately. The resize event is the obvious one and is not
     reliable on its own — it never arrived at all under the preview harness the
     breakpoints were measured in, which would have left the whole ladder frozen
     at whatever width the page happened to load with. The observer watches the
     box instead of the event, so it also catches maximise, restore, and compact
     resizing its own window. Both call the same idempotent function. */
  addEventListener("resize", syncWidthStops);
  if(typeof ResizeObserver !== "undefined"){
    new ResizeObserver(syncWidthStops).observe(document.documentElement);
  }
  /* Die Systemknoepfe koennen ihren Platz aendern, ohne dass die Seite ihre
     Groesse aendert (andere Hoehe nach "chrome", ausgeblendet in Kompakt). */
  const wco = (navigator as any).windowControlsOverlay;
  if(wco && typeof wco.addEventListener === "function") wco.addEventListener("geometrychange", syncWindowVars);
  $("#zoomIn").onclick = () => stepUiZoom(1);
  $("#zoomOut").onclick = () => stepUiZoom(-1);
  $("#zoomVal").onclick = () => setUiZoom(100);
  /* ---------- see-through, for the overlay ----------
     The window's own uniform alpha, which is what a translucent terminal or a
     faded Discord window uses. Not pywebview's transparent=True: measured on
     6.2.1, that makes the webview transparent onto the host form and never gives
     the form a colour, so the page ends up on the WinForms default grey and the
     window is as opaque as it started. This route was probed over a known
     backdrop and landed within 1/765 of the exact blend.

     Stated as see-through rather than as opacity, because that is the direction
     the reader is thinking in: 0% is the window you have now, 50% is halfway to
     not being there. The floor is 55% for the same reason the launcher floors
     it - a window nobody can find is not a setting anyone meant to choose. */
  /* Every whole percent from 0 to 55, not a handful of stops: the difference
     between 2% and 6% is one a person can see on their own screen and nobody
     else can pick for them. The slider covers the range in one drag, the two
     buttons step by one for the last bit of it. */
  state.seeThrough = 0;
  $("#seeMore").onclick = () => setSee(state.seeThrough + 1);
  $("#seeLess").onclick = () => setSee(state.seeThrough - 1);
  $("#seeVal").onclick = () => setSee(0);
  /* input while dragging, so the window fades under the hand; change on release,
     so the setting is written once instead of fifty times across one drag */
  $("#seeSlide").oninput = e => setSee((e.target as HTMLInputElement).value, {quiet:true});
  $("#seeSlide").onchange = e => setSee((e.target as HTMLInputElement).value);
  /* The same keys every browser and editor uses for this. Ctrl+wheel is not
     among them: pywebview blocks it at the page level, and unpicking that
     would change how the window behaves, not just how it looks. */
  addEventListener("keydown", e => {
    if(!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    if(e.key === "+" || e.key === "=" || e.code === "NumpadAdd"){ e.preventDefault(); stepUiZoom(1); }
    else if(e.key === "-" || e.code === "NumpadSubtract"){ e.preventDefault(); stepUiZoom(-1); }
    else if(e.key === "0"){ e.preventDefault(); setUiZoom(100); }
  });
  $("#btnPin").onclick = () => {
    if(!SERVED) return;
    const next = $("#btnPin").getAttribute("aria-pressed") !== "true";
    /* Gemerkt fuer den naechsten Start (stayOnTop) wird nur das Anheften im
       Kompaktfenster, wie bisher; das Anheften der Vollansicht gilt nur fuer
       diese Sitzung (remember:false, Instrumententafel 3.1). */
    /* Das Kompaktfenster (N4) ist von selbst immer vorn; sein Anheften
       gilt nur ihm und wird nicht gemerkt. */
    const pin = document.body.classList.contains("compact") && !KOMPAKT_FENSTER
      ? {do:"pin", on:next} : {do:"pin", on:next, remember:false};
    fetch("/api/win", {method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({...pin, win: FENSTER})})
      .then(r => r.json())
      .then(d => {
        if(d.ok){ setPinButton(!!d.on_top); toast(tt(d.on_top ? "top.pinToastOn" : "top.pinToastOff"), 2200); }
        else toastFail(tt("top.pinFailed",{why:d.error || "?"}), 6000);
      })
      .catch(() => toastFail(tt("party.helperNoAnswer")));
  };
  /* Fade the overlay when you are not pointing at it, full strength on
     hover. The point of an overlay is seeing the game underneath; this
     is the control that makes that a choice rather than a compromise. */
  $("#btnGhost").onclick = () => {
    const on = !document.body.classList.contains("ghost");
    document.body.classList.toggle("ghost", on);
    syncGhostButton();
    // remembered like the pin beside it, which it sits next to and was the only
    // one of the pair the app kept
    state.ghostPref = on;
    persistPref("ghost", on);
    /* Der Geist deckelt den Regler und blendet das Fenster ab (applySeeThrough);
       ohne diesen Aufruf galt der Wechsel erst beim naechsten Zug am Regler,
       und #seeVal nannte bis dahin den alten Wert. */
    applySeeThrough({quiet:true});
    // you are hovering the button at the instant you click it, so the
    // overlay is at full strength and nothing visibly changes — say what
    // happened, or the button looks broken
    toast(tt(on ? "top.ghostToastOn" : "top.ghostToastOff"), 2200);
  };
  /* Einmal beim Rollen, einmal nach jedem Zeichnen. Der Zuhoerer sitzt am
     Behaelter, weil die Zeilen bei jedem Zeichnen neu gebaut werden. */
  (function(){
    const box = $("#bars");
    if(box) box.addEventListener("scroll", markiereRest, {passive:true});
    addEventListener("resize", markiereRest);
  })();
  /* Die Restzeile fuehrt zur Vollansicht, wie der Knopf im Streifen (#160). */
  $("#kRest").addEventListener("click", () => $("#btnCompact").click());
  $("#btnDurch").onclick = aufDurchKnopf;
  /* Der Knopf (Nachtraege N4): im Kompaktfenster heisst er "Vollansicht"
     und bittet den Hauptprozess, den Streifen zu schliessen und das grosse
     Fenster zu zeigen; im grossen Fenster oeffnet oder schliesst er das
     Kompaktfenster, wo es eines gibt; sonst (Linux, Windows ohne Acrylic,
     Browser) schrumpft Kompakt dieses Fenster wie bisher. */
  $("#btnCompact").onclick = () => {
    if(KOMPAKT_FENSTER){ void winPost({do:"kompakt", on:false}); return; }
    if(state.zweiFenster){ kompaktFensterSchalten(!state.kompaktOffen); return; }
    kompaktSchalten(!document.body.classList.contains("compact"));
  };
  kompaktSchalten = (on: boolean) => {
    document.body.classList.toggle("compact", on);
    /* Die Kampfwahl gibt es im Kompakt nicht. Stand der Fokus darin, geht er
       an diesen Knopf - der Knopf der Kampfwahl ist gleich nicht mehr da. */
    if(on && kampfwahlOffen()){
      const hielt = $("#kampfwahl").contains(document.activeElement);
      kampfwahlSchliessen(false);
      if(hielt) $("#btnCompact").focus({preventScroll: true});
    }
    /* Im eigenen Fenster mit nativem Rahmen bei jedem Wechsel, nicht nur mit
       Acrylic: die Systemknoepfe (Titelleiste, kopfHoehe) muessen aus dem 26-Punkte-Streifen
       auch dort, wo Windows kein Acrylic kann. Ob das Material gesetzt wird,
       entscheidet der Hauptprozess. */
    if(document.documentElement.classList.contains("native"))
      winPost({do:"material", kind: on ? "acrylic" : "none",
               theme: document.documentElement.dataset.theme, height: kopfHoehe()});
    // switching views is a fresh intent about size, so a hand-dragged compact
    // window does not follow you back in
    state.compactHandSized = false;
    /* Aufgeklappte Zeilen aus der Vollansicht gehen zu: im Overlay nahmen
       sie die Zeilen weg, fuer die man es aufmacht. Wer dort selbst eine
       aufklappt, darf das weiter. */
    if(on){ state.expanded.clear(); state.expandedSub.clear(); }
    /* Erst zeichnen, dann messen. renderAll setzt die Klasse noFight, und die
       entscheidet, ob der Kompaktmodus ein 28-Punkte-Streifen ist oder die
       ganze Startseite in 364 Punkte gequetscht wird. Gemessen: direkt nach
       dem Umschalten hiess die Klasse nur "compact" und das Fenster wurde 180
       Punkte hoch; erst ein Render machte daraus 28. Der Umschalter rief
       applyWindowSize, aber nie den Render davor. */
    renderAll();
    toastNachfuehren();   // Kompakt hat eine eigene Lage fuer die Meldung
    $("#btnCompact").textContent = on ? t("top.fullView") : t("top.compact");
    $("#btnPin").hidden = on ? !SERVED : !(SERVED && OWN_WINDOW);
    $("#btnGhost").hidden = !on;   // only meaningful as an overlay
    $("#btnDurch").hidden = !(on && OWN_WINDOW);
    syncHotkeyNote();   // der title von Vollansicht und Durchklick
    $("#seeRow").hidden = !on || !SERVED;
    if(!on) document.body.classList.remove("ghost");   // never leave full view faded
    if(on && state.ghostPref){
      // restored every time you go compact, not once per launch like the pin:
      // fading is a habit about this overlay, and it changes nothing outside it
      document.body.classList.add("ghost");
    }
    /* Auch beim Verlassen: der Knopf blieb sonst gedrueckt stehen, obwohl
       body.ghost eben entfernt wurde. */
    syncGhostButton();
    /* Deckend in der Vollansicht, wieder durchsichtig in Kompakt. Erst nach dem
       Geist: stand der Aufruf davor, rechnete er ohne dessen Boden, und ein
       gemerkter Geist liess das Fenster bis zum naechsten Reglerzug unter
       GEIST_BODEN verblassen. */
    applySeeThrough({quiet:true});
    if(on && state.pinPref){
      state.pinPref = false;   // only ever auto-applied once per launch
      /* Schon in der Vollansicht angeheftet: ein Klick loeste es wieder.
         Das Merken ist trotzdem verbraucht. */
      if($("#btnPin").getAttribute("aria-pressed") !== "true") $("#btnPin").click();
    }
    if(!on){
      // leaving compact drops the pin it set, so the app never lingers on top
      // of the game once you are not using it as an overlay - a pin set in
      // full view before stays (pinAusKompakt)
      if(pinAusKompakt && $("#btnPin").getAttribute("aria-pressed") === "true") $("#btnPin").click();
      // and never a full-size window that lets every click through
      setDurchklick(false);
    }
    syncPartySwitch();
    refitCanvases();
    applyWindowSize();
    // zuletzt: die Meldung steht dann schon an ihrer Stelle im Streifen
    if(on) randlosHinweis();
  };
  addEventListener("keydown", e => {
    if(e.key !== "Escape" || !document.body.classList.contains("compact")) return;
    /* Escape closes the thing on top, not two things at once. Every overlay
       has its own Escape handler on this same event and none of them stop
       it, so leaving compact has to be the last resort: dismissing the menu
       used to drop the overlay as well, which resizes the window over the
       game mid-raid. (The select popup stops the event in capture already.) */
    if(state.moreOpen || state.modalOpen || state.filterOpen ||
       $("#clogBg").classList.contains("on")) return;
    const jetzt = performance.now();
    if(jetzt - escFenster < 2000){ escFenster = -Infinity; $("#btnCompact").click(); return; }
    escFenster = jetzt;
    toast(tt("compact.escAgain"), 2000);
  });
  if(typeof ResizeObserver !== "undefined"){
    let ro: ResizeObserver | null = null;
    const watchStage = () => {
      const stage = $(".stage"); if(!stage) return;
      if(ro) ro.disconnect();
      ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(refitCanvases, 90); });
      ro.observe(stage);
    };
    watchStage();
  }
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      refitCanvases();
    }, 130);
  });
  // only the app's own window listens: a browser tab on 127.0.0.1 would
  // otherwise switch the Electron window from the side
  if(OWN_WINDOW) void horcheAufEreignisse();
}
/** After a language switch: the two lines name the keys in the reader's words. */
export function syncThroughTexts(){
  /* Vorleser und Alt+Tab unterscheiden die zwei Fenster am Titel (N4,
     Pruefung K6); das grosse bleibt "Borometer". */
  if(KOMPAKT_FENSTER) document.title = t("compact.fensterTitel");
  syncHotkeyNote();
  if(durchklick) syncThroughHint();
  syncSeePille(seePilleWert);
}
