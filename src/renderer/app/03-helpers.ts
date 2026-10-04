import { state } from "./01-state";
import { markiereRest, numN, secs1 } from "./16-fight-analysis";
import { $, esc } from "./18-interface-basics";
import { applyWindowSize } from "./36-dialog";
import type { FactPart, ToastAction } from "../types";

/* ---------- small helpers ---------- */
/* kurzAb: ab welcher Zahl die k-Form gilt. Normal 10.000 - in einer Zeile
   des Kompaktmodus 1.000.

   Der Grund: zwischen 1.000 und 9.999 schreibt fmt() die Zahl mit dem
   Tausendertrennzeichen der Sprache, darueber die k-Form mit einem Punkt
   als Komma. Auf Deutsch stand damit in einer Zeile "320.9k" neben
   "9.572" - derselbe Punkt, sechzig Punkt auseinander, zweimal etwas
   anderes. Wer im Vorbeischauen die Regel der Nachbarspalte anwendet,
   liest neuneinhalb statt neuntausendfuenfhundert. Englisch stimmte in
   sich (320.9k / 9,572); der Fehler war deutsch, und Deutsch ist die
   Hauptsprache.

   Nur im Kompaktmodus, weil nur dort die beiden Spalten so eng
   beieinanderstehen und kein Platz fuer die genaue Zahl ist. */
// anything that is not a number reads as 0, as it always has
export function fmt(n: number | null | undefined, kurzAb?: number){
  n = Number(n)||0;
  const a = Math.abs(n);
  // compact k/M/B numbers always use a dot — a German locale comma in this
  // display font renders as a stray mark, not a real decimal point
  if(a >= 1e9) return (n/1e9).toFixed(2)+"B";
  /* Gerundet steigt eine Zahl ueber ihre eigene Stufe: 999.999 ergab
     "1000.0k", waehrend 1.000.000 "1.00M" ergibt - vierstelliges k in
     einem Feld, das sonst M schreibt. Gerundet wird darum zuerst, und
     erst dann entschieden, welche Stufe das Ergebnis traegt. */
  if(a >= 1e6){
    const m = n/1e6;
    return Math.abs(m) >= 999.995 ? (n/1e9).toFixed(2)+"B" : m.toFixed(2)+"M";
  }
  if(a >= (kurzAb || 1e4)){
    const k = n/1e3;
    return Math.abs(k) >= 999.95 ? (n/1e6).toFixed(2)+"M" : k.toFixed(1)+"k";
  }
  if(a >= 1000) return Math.round(n).toLocaleString(state.lang === "de" ? "de-DE" : "en-US");
  // Die Zeile darueber richtet sich nach der Sprache, diese tat es nicht:
  // toFixed schreibt immer einen Punkt, und so stand im deutschen Fenster
  // "0.0 DPS" neben "1.234" aus derselben Funktion.
  return a >= 10 ? Math.round(n).toString() : numN(n, 1);
}
/* Eine Anzahl - Treffer, Einsaetze - hat keine Nachkommastelle. fmt()
   schreibt unter 10 eine, und so stand "6,0 von 11 Treffern" da. Ab 10
   dieselbe Form wie fmt(), damit Spalten gleich bleiben. */
export function anzahl(n: number | null | undefined){
  n = Number(n)||0;
  return Math.abs(n) < 10 ? String(Math.round(n)) : fmt(n);
}
/* fmt() is built for table cells, where "50.0k" and "0.0" line up in a
   column. On a chart they are noise, so axis ticks and cast labels drop the
   trailing zero. Only the k/M/B forms carry a real decimal point: a plain
   number is locale-formatted, and in German the thousands separator is also
   a dot, so stripping zeros there would turn 1.000 into 1. */
export function axisNum(v: number){
  const s = fmt(v);
  return /[kMB]$/.test(s) ? s.replace(/\.?0+(?=[kMB]$)/, "") : s.replace(/\.0$/, "");
}
/* One run of facts, ruled apart instead of welded together with middle dots.
   The first part is the subject — a scope, a file, a clock time — and the
   rest are measurements of it. Three places build this: the readout's meta
   line, the log setup header, and the fight rows in the rail. Two of them
   show the very same three facts about the very same fight, so having them
   render differently in one window was the app disagreeing with itself. */
/* Names what the figures beside it are measuring. Four of them — hits, crit,
   heavy, biggest hit — carry the same words as columns in the table a
   little way below, and the only thing telling a fight's crit rate from a
   skill's is the scope. The readout's meta line states it, but 120px further
   up: too far for the eye to carry it. This says it where the numbers are,
   and it is a cell in the strip rather than a label above it, so it reads as
   what the row is about instead of as a heading. */

export function factLine(parts: FactPart[]){
  /* A part is text and gets escaped. The one exception is {html}, for a part
     that is already markup — the star rating is glyphs plus a label, and
     escaping it would print the span. Opt-in and per part, so every ordinary
     caller keeps its escaping. */
  return parts.filter(Boolean)
    .map((p,i) => {
      const text = (p && typeof p === "object" && p.html !== undefined) ? null : String(p);
      /* Der title, den das Stilblatt seit Langem verspricht: im Overlay
         gibt der Geltungsbereich alles ab und steht dann als "all..."
         da. Was gekuerzt ist, muss wenigstens beim Zeigen vollstaendig
         sein. Nur fuer Text - ein Teil aus Markup traegt sein eigenes. */
      return '<span class="'+(i ? "f" : "scope")+'"'+
        (text ? ' title="'+esc(text)+'"' : "")+'>'+
        (text === null ? (p as { html: string }).html : esc(text))+"</span>";
    }).join("");
}
export const full = (n: number) => Math.round(Number(n)||0).toLocaleString(state.lang === "de" ? "de-DE" : "en-US");
export function dur(s: number){
  s = Math.max(0,s);
  /* Rounded before the split, not after. The minutes used to be taken off
     the unrounded figure and the remainder rounded on its own, so 239,6 s
     printed as "3m 60s" - seen on a real block heading, "Getrennt nach
     3m 60s Pause". */
  const whole = Math.round(s);
  const m = Math.floor(whole/60), r = whole - m*60;
  // Under a minute this is the same figure the gap sentences print, so it
  // goes through the same formatter: a German reader got "1m 26s" here and
  // "8,4 s" two lines below. The m/s composite has no decimal point and so
  // carries no locale question.
  return m ? m+"m "+r+"s" : secs1(s);
}
/* The app's only voice. It carries both "saved" and "the helper is not
   answering", and until now said both in exactly the same tone.
   Two states, not three: a confirmation keeps the ordinary notice, and the
   one distinction worth drawing is whether the thing you asked for actually
   happened. A separate "good" tone would be decoration — you already know
   it worked, because you asked for it. */
/* Das vierte Argument ist wahlweise: {label, fn}. Ohne es verhaelt sich
   toast() wie bisher, darum musste kein einziger der vorhandenen Aufrufe
   angefasst werden. Mit ihm bekommt das Band eine Taste - und nur dann
   auch Mausdurchlass, denn sonst ist .toast durchlaessig. */
/* Der Satz darf ein tt(...) sein statt fertigem Text (08-translation.ts):
   dann zeichnet retranslateToast() ihn nach einem Sprachwechsel neu, solange
   er noch steht. Ein fertiger String - etwa die Fehlermeldung, die der
   Helfer selbst schickt - bleibt, wie er ist. */
type Say = string | (() => string);
const said = (s: Say) => typeof s === "function" ? s() : s;
// var, not let: hoisted like the function, so a toast from anywhere in the
// script finds it
var toastTimer: ReturnType<typeof setTimeout> | undefined;
var toastNow: { msg: Say; action: ToastAction | undefined; knopf: HTMLButtonElement | undefined } | null = null;
export function toast(msg: Say,ms?: number,tone?: string | null,action?: ToastAction){
  const t = $("#toast");
  const jetzt: NonNullable<typeof toastNow> = {msg, action, knopf: undefined};
  toastNow = jetzt;
  t.textContent = said(msg);
  t.classList.toggle("bad", tone === "bad");
  t.classList.toggle("ruhig", tone === "ruhig");
  t.classList.toggle("hasact", !!action);
  if(action){
    const b = document.createElement("button");
    b.type = "button"; b.className = "tact"; b.textContent = said(action.label);
    b.onclick = () => { verbergen(); action.fn(); };
    t.appendChild(b);
    jetzt.knopf = b;
  }
  placeToast();
  t.classList.add("on");
  kompaktNachschneiden();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(verbergen, ms||4200);
  /* Weg ist weg: der Zustand geht mit. Vorher blieb toastNow nach dem
     Ausblenden stehen, und ein Sprachwechsel oder Nachfuehren arbeitete an
     einer Meldung, die niemand mehr sah. Nur die eigene - kam inzwischen
     eine neue, gehoert toastNow ihr. */
  function verbergen(){
    t.classList.remove("on","hasact");
    kompaktNachschneiden();
    if(toastNow === jetzt){ toastNow = null; clearTimeout(toastTimer); }
  }
}
/* Im Kompakt steht die Meldung im Fluss (styles.css, .toast.on): kommt oder
   geht sie, aendert sich die Hoehe der Tafel, ohne dass das Fenster seine
   Groesse aendert. markiereRest schneidet die Liste auf ganze Zeilen; ohne
   diesen Aufruf blieb nach der Meldung eine Zeile Leere unter vier Zeilen
   stehen (Pruefung N4, M3). */
function kompaktNachschneiden(){
  if(document.body.classList.contains("compact")) requestAnimationFrame(() => markiereRest());
  /* Ohne Kampf hat die Meldung im Fenster ihren eigenen Platz (36,
     compactWindowSize): es misst sich neu, wenn sie kommt oder geht. */
  if(document.body.classList.contains("compact") && document.body.classList.contains("noFight")) applyWindowSize();
}
// for the call sites that report a failure — reads as what it is at the
// place it is raised, without a bare "bad" string floating in the argument list
export const toastFail = (msg: Say,ms?: number) => toast(msg, ms || 6000, "bad");
/* Nach dem Sprachwechsel: die Meldung, die noch steht, in der neuen Sprache.
   Nur der Text wird getauscht - die Taste darin bleibt dasselbe Element,
   damit ein Fokus auf "Rueckgaengig" nicht verloren geht, und die Uhr
   laeuft weiter, wie sie lief. */
export function retranslateToast(){
  const t = $("#toast");
  if(!toastNow || !t.classList.contains("on")) return;
  const {msg, action, knopf} = toastNow;
  if(typeof msg === "function"){
    if(t.firstChild && t.firstChild.nodeType === Node.TEXT_NODE) t.firstChild.nodeValue = msg();
    else t.insertBefore(document.createTextNode(msg()), t.firstChild);
  }
  if(action && knopf) knopf.textContent = said(action.label);
  placeToast();
}
/* Wo die Meldung steht. In der Vollansicht unten links, neben der
   Bereichsleiste und ueber der Statusleiste (styles.css, body:not(.compact)
   .toast) - dort deckt sie fuer Sekunden Inhalt, der mitrollt, nie die
   Titelleiste und nie die Kampfwahl; zu messen gibt es dort nichts. Im
   Kompaktmodus steht sie seit dem 28.09. im Fluss zwischen Streifen und
   Kopf (styles.css, body.compact #toast) - auch dort gibt es nichts mehr zu
   messen. Die Funktion bleibt als Stelle, an der das geschaehe.
   Ueber toastNachfuehren() neu gesetzt, wenn sich das Fenster aendert. */
function placeToast(){
  $("#toast").style.removeProperty("--toast-top");
}
/* Eine stehende Meldung an die neue Lage des Fensters anpassen. */
export function toastNachfuehren(){
  if(toastNow && $("#toast").classList.contains("on")) placeToast();
}
export const truthy = (v: unknown) => /^(1|true|t|y|yes|j|ja|crit|critical|heavy|hard)$/i.test(String(v||"").trim());

/* ---------- timestamps ---------- */
function pad3(s: string){ return (s+"00").slice(0,3); }
export function looksTimestamp(v: string){
  v = String(v||"").trim().replace(/^[[(]|[\])]$/g,"");
  if(/^\d{8}[-_ T]\d{1,2}:\d{2}:\d{2}([:.,]\d{1,3})?$/.test(v)) return true;   // 20260909-11:01:04:160
  if(/^\d{1,2}:\d{2}:\d{2}([.,:]\d{1,3})?$/.test(v)) return true;
  if(/^\d{4}[-/]\d{1,2}[-/]\d{1,2}[T ]\d{1,2}:\d{2}:\d{2}/.test(v)) return true;
  if(/^\d{1,2}[-/]\d{1,2}[-/]\d{4}[T ]\d{1,2}:\d{2}:\d{2}/.test(v)) return true;
  if(/^\d{13,}$/.test(v)) return true;                    // epoch ms
  if(/^\d{10}(\.\d+)?$/.test(v)) return true;             // epoch s
  return false;
}
// returns {ms, wall} — wall=false means "time of day only", needs midnight handling
// a short log line has no cell here: undefined reads as no time
export function parseTime(v: string | undefined){
  v = String(v||"").trim().replace(/^[[(]|[\])]$/g,"");
  let m = v.match(/^(\d{4})(\d{2})(\d{2})[-_ T](\d{1,2}):(\d{2}):(\d{2})(?:[:.,](\d{1,3}))?$/);
  if(m) return {ms:Date.UTC(+m[1]!,+m[2]!-1,+m[3]!,+m[4]!,+m[5]!,+m[6]!,m[7]?+pad3(m[7]):0), wall:true};
  m = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?/);
  if(m) return {ms:Date.UTC(+m[1]!,+m[2]!-1,+m[3]!,+m[4]!,+m[5]!,+m[6]!,m[7]?+pad3(m[7]):0), wall:true};
  m = v.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})[T ](\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?/);
  if(m) return {ms:Date.UTC(+m[3]!,+m[2]!-1,+m[1]!,+m[4]!,+m[5]!,+m[6]!,m[7]?+pad3(m[7]):0), wall:true};
  m = v.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:[.,:](\d{1,3}))?/);
  if(m) return {ms:((+m[1]!*3600)+(+m[2]!*60)+(+m[3]!))*1000 + (m[4]?+pad3(m[4]):0), wall:false};
  if(/^\d{13,}$/.test(v)) return {ms:+v, wall:true};
  if(/^\d{10}(\.\d+)?$/.test(v)) return {ms:parseFloat(v)*1000, wall:true};
  if(/^\d+(\.\d+)?$/.test(v)) return {ms:parseFloat(v)*1000, wall:true};
  const d = Date.parse(v);
  return isNaN(d) ? null : {ms:d, wall:true};
}
