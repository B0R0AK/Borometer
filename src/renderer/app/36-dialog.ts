import { state } from "./01-state";
import { toastFail } from "./03-helpers";
import { t, tt } from "./08-translation";
import { $, el, esc } from "./18-interface-basics";
import { uiZoomFactor, winPost } from "./37-window-size-and-overlay";
import { FENSTER, KOMPAKT_FENSTER, SERVED } from "./41-server-mode";
import { openFolder } from "./44-bug-report";
import type { ModalChoice, ModalOptions } from "../types";

/* ---------- modal — a real dialog instead of prompt()/confirm(). Some
   webviews (including the ones the packaged app can run under) never show
   native browser dialogs at all, which made Save as run look broken with
   no error — this always renders, since it's just our own markup. ---------- */
/* Resolves with the text typed (withInput), the value picked (choices), or
   true/false for a plain question; null when a text or a pick was cancelled. */
export function openModal(opts: ModalOptions): Promise<string | boolean | null> {
  return new Promise<string | boolean | null>(resolve => {
    const bg = $("#modalBg"), input = $<HTMLInputElement>("#modalInput"), list = $("#modalList");
    $("#modalTitle").textContent = opts.title || "";
    const msgEl = $("#modalMsg");
    msgEl.textContent = opts.msg || ""; msgEl.hidden = !opts.msg;
    input.hidden = !opts.withInput;
    input.value = opts.defaultValue || ""; input.placeholder = opts.placeholder || "";

    // a pick-one list, for choosing a saved file without an OS dialog
    const choices = opts.choices || null;
    list.hidden = !choices;
    list.innerHTML = "";
    $("#modalOk").hidden = !!choices;
    if(choices){
      choices.forEach(c => {
        const b = el("button", "pick");
        b.innerHTML = '<b>'+esc(c.label)+'</b>' + (c.note ? '<span>'+esc(c.note)+'</span>' : "");
        b.onclick = () => done(c.value);
        list.appendChild(b);
      });
    }

    /* The pick-a-file variant hides OK - the rows are the choice - which
       leaves the slot free for the one action that belongs beside a list of
       files: opening the folder they are in. It does not close the dialog;
       you are still choosing. */
    const folderKey = opts.folder || null;
    if(folderKey){
      $("#modalOk").hidden = false;
      $("#modalOk").textContent = t("modal.openFolder");
    } else $("#modalOk").textContent = opts.okLabel || t("modal.ok");
    $("#modalCancel").textContent = t("modal.cancel");
    /* Ein Ausgang, der etwas zerstoert, traegt nicht die Zusagefarbe der
       App und heisst nicht "OK". Er nennt sein Verb und steht in --neg;
       vorausgewaehlt ist dann der Weg zurueck. */
    $("#modalOk").classList.toggle("hot", !opts.danger);
    $("#modalOk").classList.toggle("wreck", !!opts.danger);
    bg.classList.add("on");
    state.modalOpen = true;
    // im Kompaktfenster waechst das Fenster fuer den Dialog (Gutachten H1)
    dialogRaum(true);
    /* The pick-list variant - the file choosers - opened with focus still
       on the button behind the scrim, so Tab walked the whole page before
       reaching the first file. */
    const prevFocus = document.activeElement as HTMLElement | null;
    if(opts.withInput) setTimeout(() => { input.focus(); input.select(); }, 30);
    else if(choices) setTimeout(() => {
      const f = list.querySelector<HTMLElement>(".pick"); if(f) f.focus();
    }, 30);
    else (opts.danger ? $("#modalCancel") : $("#modalOk")).focus();
    /* The dialog is the last block in the document, so without a trap one
       Tab off OK lands behind the scrim. Escape belongs here too: the
       global one is gated on the input being hidden, which made Escape
       dead as soon as you tabbed off the text field. */
    $("#modal").onkeydown = e => {
      if(e.key === "Escape"){ e.preventDefault(); done(opts.withInput || choices ? null : false); return; }
      if(e.key !== "Tab") return;
      const f = [...$("#modal").querySelectorAll<HTMLElement>("input,button")].filter(n => n.offsetParent);
      if(!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    };

    function done(result: string | boolean | null){
      bg.classList.remove("on"); state.modalOpen = false;
      dialogRaum(false);
      $("#modalOk").onclick = null; $("#modalCancel").onclick = null;
      $("#modalOk").hidden = false;
      list.hidden = true; list.innerHTML = "";
      bg.onclick = null; input.onkeydown = null; $("#modal").onkeydown = null;
      resolve(result);
      // after resolve, so the caller's own re-render does not fight it
      if(prevFocus && prevFocus.isConnected && prevFocus.focus)
        prevFocus.focus({preventScroll:true});
    }
    $("#modalOk").onclick = folderKey
      ? () => openFolder(folderKey)
      : () => done(opts.withInput ? input.value : true);
    $("#modalCancel").onclick = () => done(opts.withInput || choices ? null : false);
    bg.onclick = e => { if(e.target === bg) done(opts.withInput || choices ? null : false); };
    input.onkeydown = e => {
      if(e.key === "Enter"){ e.preventDefault(); done(input.value); }
      if(e.key === "Escape") done(null);
    };
  });
}
export const askPick = (title: string, msg: string, choices: ModalChoice[], folder?: string) =>
  openModal({title, msg, choices, folder}) as Promise<string | null>;
export const askText = (title: string, msg: string, defaultValue: string, placeholder?: string) =>
  openModal({title, msg, withInput:true, defaultValue, placeholder}) as Promise<string | null>;
export const askConfirm = (title: string, msg: string, opts?: ModalOptions) =>
  openModal(Object.assign({title, msg, withInput:false}, opts || {})) as Promise<boolean>;

/* Compact should shrink the actual window, not just the layout inside a
   desktop-sized one — otherwise you get a small meter floating in a large
   empty frame. The height is measured from the real content so the window
   ends up exactly as tall as the rows it has to show. */
/* Top 5 wie im Entwurf (Neugestaltung 28.09., Luecke 11.2, DECISION 11.6):
   so viele Zeilen stehen im gebauten Streifen; wer das Fenster groesser
   zieht, bekommt die ganze Tafel (die Liste fuellt die Hoehe und rollt). */
const COMPACT_ROWS = 5;      // rows visible before the list scrolls
/* Der Verlauf am unteren Rand von #bars. Er bekommt eigenen Platz, statt
   auf der letzten Zeile zu liegen - sonst zaehlt die Ueberschrift sieben
   Zeilen und die siebte ist halb ausradiert. */
export const COMPACT_FADE = 14;
/* Die Luft zwischen zwei Zeilen. Sie steht im Stylesheet als margin-bottom,
   und margin steckt nicht in getBoundingClientRect - wer sie hier vergisst,
   baut das Fenster um sechs mal zwei Punkte zu kurz und schneidet die
   letzte Zeile ab. */
const COMPACT_GAP = 2;
let lastCompactH = 0, lastCompactW = 0, compactSettle: ReturnType<typeof setTimeout> | null = null;
/* A visible element's box, or null. Hidden ones answer with a zero box at
   0,0, which any sum over children would otherwise take at face value. */
function CTRECT(el: HTMLElement){
  if(!el || el.hidden) return null;
  const cs = getComputedStyle(el);
  if(cs.display === "none" || cs.visibility !== "visible") return null;
  const r = el.getBoundingClientRect();
  return (r.width < 1 && r.height < 1) ? null : r;
}
function compactWindowSize(){
  // Measure the real pieces, but never a container that stretches to the
  // window: compact makes .stage and #app fill the viewport, so measuring
  // those would just report the size we already have and never shrink.
  const hOf = (sel: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    if(!el || el.hidden || !el.getBoundingClientRect) return 0;
    return el.getBoundingClientRect().height || 0;
  };
  const chrome = hOf("#titlebar") + hOf(".top") + hOf(".headwrap") + hOf(".bhead");
  const rowEl = document.querySelector("#bars .row");
  // clamp: a measured row should be ~20px in compact. If anything odd comes
  // back, do not let it multiply into an absurd window height.
  const rawRow = (rowEl && rowEl.getBoundingClientRect().height) || 20;
  // the clamp is in device pixels but the measurement is not, so at any size
  // under 70% the floor of 14 was above the real row and every window came
  // back too tall. Scale the guard into the units it is guarding.
  const zRow = uiZoomFactor();
  const rowH = Math.min(40 * zRow, Math.max(14 * zRow, rawRow));
  const rows = document.querySelectorAll("#bars .row").length ||
               (state.encounters[state.sel] ? state.encounters[state.sel]!.stats.skills.length : COMPACT_ROWS);
  const shown = Math.min(rows, COMPACT_ROWS);
  /* Ohne Kampf ist nur das Chrom da - der Streifen. Ohne diesen Fall rechnet
     die Formel mit sieben erfundenen Zeilen (ohne Zeilen faellt die Zahl auf
     COMPACT_ROWS zurueck) und baut ein leeres Fenster in voller Hoehe.
     Die Luft zwischen den Zeilen geht hier ein, weil margin nicht in
     getBoundingClientRect steckt. */
  const ruht = document.body.classList.contains("noFight");
  /* Ohne Kampf steht eine Meldung (der Randlos-Hinweis beim ersten Mal)
     unter dem Streifen im Fluss: das Fenster nimmt sie mit, sonst lag sie
     ausserhalb des 28-Punkte-Fensters (Gutachten H1). Mit Kampf schneidet
     die Tafel stattdessen eine Zeile ab (markiereRest). */
  const h = ruht ? (chrome || 26 * zRow) + hOf("#toast.on")
                 : (chrome || 60) + shown * rowH +
                   Math.max(0, shown - 1) * COMPACT_GAP * zRow +
                   COMPACT_FADE * zRow;
  // Width is set by the longest name the list can print, not by a round
  // number. The name column takes whatever is left after 13 + 55 + 44 for
  // rank and the two figures, and at 364 that leaves 222px for a name —
  // measured against the real German strings, whose longest here
  // ("Entschlossener Scharfschuss") renders at 142px. The 80px of headroom
  // is for names longer than any in these fights; past that the column
  // ellipsises rather than truncates, and the window can be dragged wider.
  // Die Hoehe ist gemessen, die Groesseneinstellung steckt also schon drin.
  // Fuer die Breite stand hier derselbe Satz, und er stimmte einmal: sie war
  // eine reine Konstante und wurde als einzige von Hand multipliziert. Seit die
  // Leiste unten GEMESSEN wird, ist sie es nicht mehr, und die Einstellung ging
  // zweimal ein. Nachgemessen am laufenden Programm: eine Zeile meldet ueber
  // getBoundingClientRect bei 100 Prozent 18,00 und bei 200 Prozent 36,00,
  // waehrend getComputedStyle beide Male "18px" sagt. Die Summe der
  // Kindbreiten stand entsprechend auf 247,1 gegen 494,2 - Verhaeltnis 2,000.
  // Das Ergebnis h wuchs um 1,991, das Ergebnis w von 364 auf 1106.
  // Was daraus wurde, gegen den richtigen Wert: bei 125 Prozent 4 Punkte zu
  // breit, bei 150 Prozent 98, bei 200 Prozent 378. Bis 125 Prozent verdeckt
  // der Boden 364 den Fehler, darueber nicht mehr.
  // Jetzt gilt hier dieselbe Regel wie in syncWindowVars(): beide Seiten einer
  // Rechnung in derselben Einheit, und genau einmal umgerechnet.
  // +2, not the +14 this carried before: a frameless window's client area is
  // its whole size, measured at 228 for a requested 228, so every pixel of
  // slop here was a strip of the eighth row showing under the seventh. The
  // two cover the header's fractional height rounding down.
  const z = uiZoomFactor();
  /* 364 is what the rows need; the top strip can need more, because with a
     party open it gains the Me/Party switch and the close button ended up
     outside the window.

     The strip's own scrollWidth is the wrong number for that: a container
     stretches to the window, so in full view it reports the full window and
     compact opened at 1271px wide. Measured is the sum of what is IN it -
     which is the same however wide the window happens to be right now - and
     it is capped, because no reading of a row of buttons justifies a window
     wider than this and a bad measurement must not be able to produce one. */
  const top = document.querySelector(".top");
  let needed = 0;
  if(top){
    const gap = parseFloat(getComputedStyle(top).gap) || 0;
    let n = 0;
    for(const el of top.children as HTMLCollectionOf<HTMLElement>){
      const r = CTRECT(el);
      if(!r) continue;
      /* Was absolut steht, liegt ueber den anderen und braucht keinen eigenen
         Platz: die Pillen fuer Durchsicht und Durchklick (Overlay-Look,
         Luecke 11.5, styles.css .ovpille). */
      if(getComputedStyle(el).position === "absolute") continue;
      /* A child that grows has no width of its own to ask for - it takes
         whatever is left. The drag strip is one, and it measured 802px in a
         1024px window, which is how this sum kept hitting its own cap. The
         364 floor below is what keeps a strip to grab. */
      /* Seine Mindestbreite und seine Luecke belegt er aber doch: der
         Ziehgriff hat in Kompakt 18 Punkte min-width und steht zwischen den
         Knoepfen und den Fensterknoepfen. Ohne beide fehlten gemessen 15
         Punkte (378 verlangt, 393 gebraucht), und der Schliessen-Knopf lag
         halb ausserhalb des Fensters. min-width ist Layoutpunkte, darum * z. */
      /* Der Ruhesatz ("Kein Log") darf nachgeben, soll aber ganz
         dastehen: gezaehlt wird die Breite seines Textes, gemessen am
         Text selbst (Range), nicht am Kasten. scrollWidth war hier falsch:
         es ist nie kleiner als der Kasten, und der Kasten waechst mit dem
         Fenster - aus der Vollansicht mit 1000 Punkt Breite verlangte der
         Streifen bei 150 % 700. Das Rechteck der Range ist wie r.width in
         Fensterpunkten. */
      if(el.id === "compactIdle"){
        const text = document.createRange();
        text.selectNodeContents(el);
        needed += text.getBoundingClientRect().width; n++;
        continue;
      }
      if(parseFloat(getComputedStyle(el).flexGrow) > 0){
        needed += (parseFloat(getComputedStyle(el).minWidth) || 0) * z; n++;
        continue;
      }
      needed += r.width; n++;
    }
    /* Drei Einheiten standen in dieser einen Rechnung. r.width ist gezoomt,
       also in Fensterpunkten; gap aus getComputedStyle ist es nicht, sondern in
       Layoutpunkten - dieselbe Messung wie oben zeigt es, computed bleibt
       "6px", waehrend der Rahmen mitwaechst. 16 und 560 sind ebenfalls
       Layoutpunkte. Beide werden jetzt in die Einheit der Messung hochgerechnet,
       so wie es die Hoehe unten mit 170 * z schon immer macht.
       16 ist der Rand der Leiste plus Rundung; 560 ist die Notbremse gegen eine
       schlechte Messung, dieselbe Zahl wie die unterste Sprosse der
       Breitenleiter. */
    needed = Math.ceil(needed + Math.max(0, n - 1) * gap * z) + 16 * z;
    needed = Math.min(needed, 560 * z);
    /* Im Ruhezustand stand hier ein Deckel von 364: "nicht breiter als mit
       Daten". Das stimmte, als der Streifen mit Daten 364 breit war. Seit
       Anheften, Geist und Gruppe darin stehen, braucht er im eigenen
       Fenster mit Daten selbst 433 (Deutsch) bzw. 409 (Englisch) - und der
       Deckel schnitt den leeren Streifen auf 364: gemessen endeten die
       Fensterknoepfe bei 481, "Kein Log" hatte null Punkte (Critique
       23.09.2026). Jetzt gilt auch hier, was darin steht. Die Wortmarke
       faellt im Ruhezustand weg (styles.css, body.compact.noFight), damit
       der Satz ihren Platz bekommt; der Streifen ist damit rund 40 Punkte
       breiter als mit Daten und wird beim ersten Kampf zugleich hoeher und
       schmaler. */
  }
  /* 300 wie der Streifen im Entwurf (E:796); die Bedienleiste kann mehr
     verlangen, dann gilt ihre Summe. Vorher 364 fuer die Spalten der Tafel,
     die der Streifen nicht mehr zeigt. */
  return {w: Math.round(Math.max(300 * z, needed)),
          h: Math.max(Math.round((ruht ? 26 : 170) * z), Math.round(h) + 2)};
}
/* ---------- Das Menue im Kompaktfenster (Kompakt-Fix 01.10.) ----------
   Befund: das Menue hinter den drei Punkten war im Streifen
   abgeschnitten und erst zu sehen, wenn man das Fenster gross zog. Nach
   innen passt es nicht: der leere Streifen ist 28 Punkt hoch, mit Kampf
   rund 235, das Menue rund 540.
   Also waechst das Fenster, solange das Menue offen ist (resize mit art
   "menue": so hoch, wie das Menue unten endet), und kehrt beim Schliessen
   auf die Groesse davor zurueck (art "zurueck"; der Hauptprozess merkt sie
   sich, auch eine von Hand gezogene). Dazwischen nennt der Streifen keine
   eigene Groesse. Die Anfragen gehen nacheinander, damit ein "zurueck"
   nie vor seinem "menue" ankommt; erst wenn "zurueck" beantwortet ist,
   misst sich der Streifen neu - ein Kampf, der kam, waehrend das Menue
   offen war (das Beispiel aus dem Menue), bekommt so seine Hoehe. */
let menueOffen = false;   // um Platz fuer eine Ueberlagerung gebeten
let menueGross = false;   // ... und noch nicht zurueck
let menueKette: Promise<unknown> = Promise.resolve();
type Bedarf = {w: number; h: number; rest: () => number};
/* Was das Menue braucht: so hoch, wie es ungerollt waere (die Grenze kurz
   aus, gemessen, wieder an). 8 Punkt Luft darunter wie im Stylesheet
   (max-height: Fenster minus 36), dazu 2 fuer die Rundung: unter Windows
   mit 200 % Skalierung kam das Fenster einen Punkt niedriger an, und das
   Menue rollte. rest: wie weit es danach noch rollt. */
function menueBedarf(): Bedarf | null {
  const p = document.getElementById("morePanel");
  if(!p || p.hidden) return null;
  const grenze = p.style.maxHeight;
  p.style.maxHeight = "none";
  const r = p.getBoundingClientRect();
  p.style.maxHeight = grenze;
  const z = uiZoomFactor();
  return {w: Math.ceil(r.right + 4 * z), h: Math.ceil(r.bottom + 10 * z),
          rest: () => p.hidden ? 0 : p.scrollHeight - p.clientHeight};
}
/* Was der Dialog braucht (askText, askConfirm, askPick - im Streifen etwa
   der Log-Ordner, wenn Live ohne einen gestartet wird; Gutachten H1): der
   Kasten mit dem Rand der Abdunklung (20 Punkt je Seite) und etwas Luft. */
function dialogBedarf(): Bedarf | null {
  const m = document.getElementById("modal");
  if(!m || !$("#modalBg").classList.contains("on")) return null;
  const r = m.getBoundingClientRect();
  const z = uiZoomFactor();
  return {w: Math.ceil(Math.min(r.width, 420 * z) + 44 * z), h: Math.ceil(r.height + 44 * z),
          rest: () => Math.max(0, m.getBoundingClientRect().bottom - innerHeight)};
}
function raum(bedarf: () => Bedarf | null, auf: boolean){
  if(!KOMPAKT_FENSTER || !SERVED) return;
  if(auf){
    if(menueOffen) return;
    const b = bedarf();
    if(!b) return;
    const w = Math.max(innerWidth, b.w), h = Math.max(innerHeight, b.h);
    if(w === innerWidth && h === innerHeight) return;
    menueOffen = true; menueGross = true;
    menueKette = menueKette.then(() => winPost({do:"resize", w, h, art:"menue"}));
    /* Nachgemessen, wenn das Fenster gewachsen ist: im echten Fenster (200 %
       Skalierung) rollte das Menue danach noch um ein paar Punkt. Reicht es
       nicht, bittet der Streifen um genau so viel mehr. */
    menueKette = menueKette.then(() => new Promise(fertig => setTimeout(fertig, 300))).then(() => {
      const rest = menueOffen ? b.rest() : 0;
      if(rest > 1) return winPost({do:"resize", w: innerWidth, h: innerHeight + Math.ceil(rest) + 2, art:"menue"});
      return null;
    });
  } else if(menueOffen){
    menueOffen = false;
    menueKette = menueKette.then(() => winPost({do:"resize", w: innerWidth, h: innerHeight, art:"zurueck"}))
      .then(() => {
        if(menueOffen) return;   // schon wieder offen
        menueGross = false;
        lastCompactH = 0; lastCompactW = 0;
        applyWindowSize();
      });
  }
}
/** Das Menue hinter den drei Punkten geht auf oder zu (43, toggleMore). */
export function menueRaum(auf: boolean){ raum(menueBedarf, auf); }
/** Ein Dialog (openModal) geht auf oder zu. */
function dialogRaum(auf: boolean){ raum(dialogBedarf, auf); }
export function applyWindowSize(){
  if(!SERVED) return;
  if(document.body.classList.contains("compact")){
    // Measure after the compact styles have actually been laid out, then
    // measure once more a moment later: fonts and the scrollbar can change
    // the height slightly after the first paint, and the second pass is what
    // makes the window border land on the meter's own edge.
    const push = () => {
      // once the window has been dragged to a size by hand, that size is the
      // answer — re-asserting the computed one would undo the drag on the
      // next render, which in a fight is every few seconds
      /* Das Kompaktfenster nennt seine Groesse trotzdem, nur als Grenze
         (Kompakt-Fix 01.10., art "hand"): der Hauptprozess macht daraus die
         Hoechstgroesse, an der die Hand haelt, und setzt keine Groesse. */
      // das Menue haelt das Fenster, bis es zugeht (menueRaum)
      if(menueGross) return;
      const hand = state.compactHandSized;
      if(hand && !KOMPAKT_FENSTER) return;
      const {w, h} = compactWindowSize();
      /* Both, not just the height. The first pass runs two frames after the
         class goes on and can still measure the full-view header; the second
         pass, 260 ms later, has the compact layout and the right width - and
         a height-only guard threw that correction away, which is how compact
         opened 1271px wide and had to be dragged small by hand. */
      if(h === lastCompactH && w === lastCompactW) return;
      lastCompactH = h; lastCompactW = w;
      fetch("/api/win", {method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({do:"resize", w, h, win: FENSTER, ...(hand ? {art: "hand"} : {})})})
        .then(r => r.json())
        .then(d => {
          // if the platform ignored the resize, say so once instead of leaving
          // a big empty window with no explanation
          state.lastResize = d;
          // nur als Grenze genannt: die Hoehe ist die der Hand, nicht diese
          if(!hand && d && d.ok && d.h && Math.abs(d.h - h) > 40 && !state.resizeWarned){
            state.resizeWarned = true;
            toastFail(tt("compact.resizeIgnored"), 6000);
          }
          if(d && !d.ok && !state.resizeWarned){
            state.resizeWarned = true;
            toastFail(tt("compact.resizeFailed",{why:d.error || "?"}), 6000);
          }
        })
        .catch(() => {});
    };
    requestAnimationFrame(() => requestAnimationFrame(push));
    clearTimeout(compactSettle ?? undefined);
    compactSettle = setTimeout(push, 260);
  } else {
    lastCompactH = 0; lastCompactW = 0;
    clearTimeout(compactSettle ?? undefined);
    /* Das Kompaktfenster (Nachtraege N4) ist immer der Streifen; eine
       Groesse von vor Kompakt gibt es dort nicht. */
    if(KOMPAKT_FENSTER) return;
    fetch("/api/win", {method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({do:"restore_size", win: FENSTER})}).catch(() => {});
  }
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  addEventListener("keydown", e => {
    if(e.key === "Escape" && state.modalOpen && $("#modalInput").hidden) $("#modalCancel").click();
  });
}
