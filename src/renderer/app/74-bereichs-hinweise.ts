import { state } from "./01-state";
import { t } from "./08-translation";
import { $ } from "./18-interface-basics";
import { persistPref } from "./27-weapons-tab";
import { bereichGewechselt } from "./34-menus-drop-and-tabs";
import { KOMPAKT_FENSTER, OWN_WINDOW } from "./41-server-mode";
import { frageOffen, rundgangOffen } from "./63-rundgang";
import { gezeigtMit, hinweisNoetig } from "../rundgang-core";

/* ---------- Der Hinweis beim ersten Besuch eines Bereichs (Spezifikation
   16.10.2026, #265, 3.2) ----------
   Ein Streifen im Fluss, ganz oben in der Flaeche (#stage), mit dem Satz des
   Bereichs und "Verstanden". Kein Abdunkeln, kein Fokusfang, kein Pfeil, kein
   Schatten: er liegt im Lesefluss und nimmt der Seite nur seine Hoehe - die
   Bereiche sind auf die Fensterhoehe gerechnet und ziehen --hw-h davon ab.

   Er kommt beim ersten Wechsel in einen Bereich mit Hinweis (rundgang-core.ts:
   hinweisNoetig), nicht im Kompaktfenster, nicht im Kompakt-Rueckfall, nicht
   solange der Rundgang oder die Frage dazu offen ist (der Besuch zaehlt dann
   nicht) und nicht, wenn der Schalter in Einstellungen, Info aus ist. Gemerkt
   wird nur in der App (nur bereicheGezeigt, die Liste der Kennungen, ueber
   den einen Weg der Einstellungen); im Browser lebt die Liste in der Sitzung. Vorleser: role="note"
   im Lesefluss, der Inhalt (#stage) beschreibt sich fuer die Zeit mit dem Satz.
   Der Teil fragt nichts ab (Audit). */

const HOEHE = "--hw-h";
let el: HTMLElement | null = null;
let aktuell = "";                 // der Bereich, der zuletzt dran war: nur ein Wechsel zaehlt
let gezeigtBereich = "";          // wessen Satz gerade steht ("" = keiner)
let sitzung: string[] = [];       // im Browser: die Bereiche dieser Sitzung
let messen: ResizeObserver | null = null;

function bauen(): HTMLElement {
  const e = document.createElement("div");
  e.id = "bereichsHinweis"; e.className = "bhinweis"; e.hidden = true;
  e.setAttribute("role", "note");
  e.innerHTML = '<p class="bhsatz" id="bhSatz"></p><button class="leise" type="button" id="bhOk"></button>';
  $("#stage").prepend(e);
  return e;
}

/** Die Hoehe, die der Streifen den Bereichen nimmt (Layoutpunkte; 0, solange er zu ist). */
function hoeheSetzen(): void {
  const h = el && !el.hidden ? el.offsetHeight : 0;
  document.documentElement.style.setProperty(HOEHE, h + "px");
}

function zeichnen(): void {
  if(!el || !gezeigtBereich) return;
  const satz = $("#bhSatz");
  const s = t("hinweis." + gezeigtBereich);
  if(satz.textContent !== s) satz.textContent = s;
  $("#bhOk").textContent = t("hinweis.verstanden");
  el.setAttribute("aria-label", t("hinweis.region"));
  hoeheSetzen();
}

function zu(): void {
  if(!el) return;
  const drin = el.contains(document.activeElement);
  el.hidden = true;
  gezeigtBereich = "";
  $("#stage").removeAttribute("aria-describedby");
  hoeheSetzen();
  if(drin) $("#stage").focus({preventScroll: true});
}

function zeigen(bereich: string): void {
  if(!el) return;
  gezeigtBereich = bereich;
  el.hidden = false;
  $("#stage").setAttribute("aria-describedby", "bhSatz");
  zeichnen();
}

function ruhe(): boolean {
  return !rundgangOffen() && !frageOffen() && !document.body.classList.contains("compact") && !KOMPAKT_FENSTER;
}

/* Ein Wechsel des Bereichs (aria-current in der Symbolleiste): der alte Streifen geht,
   der neue kommt, wenn dieser Bereich dran ist. Der Besuch zaehlt, sobald der Satz steht. */
function pruefen(): void {
  const knopf = document.querySelector<HTMLElement>('#bereiche [aria-current="page"]');
  const bereich = knopf ? knopf.dataset.tab || "" : "";
  if(bereich === aktuell){
    if(document.body.classList.contains("compact") && el && !el.hidden) zu();
    return;
  }
  aktuell = bereich;
  zu();
  const gezeigt = OWN_WINDOW ? state.bereicheGezeigt : sitzung;
  if(hinweisNoetig({bereich, an: state.bereichHinweise, gezeigt, ruhe: ruhe()})){
    zeigen(bereich);
    if(OWN_WINDOW && state.bereicheGezeigt){
      state.bereicheGezeigt = gezeigtMit(state.bereicheGezeigt, bereich);
      persistPref("bereicheGezeigt", state.bereicheGezeigt);
    } else {
      sitzung = gezeigtMit(sitzung, bereich);
    }
  }
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  if(KOMPAKT_FENSTER) return;
  el = bauen();
  $("#bhOk").addEventListener("click", zu);
  // der Schalter in den Einstellungen (57) schaltet zuerst; ist er aus, geht ein offener Streifen
  const schalter = document.querySelector("#eBereichHinweise");
  if(schalter) schalter.addEventListener("click", () => { if(state.bereichHinweise === false) zu(); });
  // Der Wechsel durch einen Klick meldet sich selbst (34), vor dem Rollen an den Anfang; der Beobachter faengt den Rest (ein Kampf wird geladen, Start)
  bereichGewechselt.push(pruefen);
  new MutationObserver(pruefen).observe($("#bereiche"), {subtree: true, attributes: true, attributeFilter: ["aria-current"]});
  // Kompakt (der Rueckfall im selben Fenster): der Streifen geht
  new MutationObserver(() => { if(document.body.classList.contains("compact") && el && !el.hidden) zu(); })
    .observe(document.body, {attributes: true, attributeFilter: ["class"]});
  // die Sprache: der Satz steht neu da
  new MutationObserver(zeichnen).observe(document.documentElement, {attributes: true, attributeFilter: ["lang"]});
  // der Streifen kann umbrechen (schmal, Groesse 200 %): --hw-h folgt seiner Hoehe
  if(typeof ResizeObserver !== "undefined"){
    messen = new ResizeObserver(hoeheSetzen);
    messen.observe(el);
  }
}
