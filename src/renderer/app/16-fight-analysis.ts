import { DEAD_TIME, seriesColor, state } from "./01-state";
import { anzahl, fmt } from "./03-helpers";
import { rateSecs } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { SKILL_WEAPON } from "./10-skill-names";
import { weaponByName } from "./14-questlog-weapons";
import { unverwundbarTreffer } from "./05-fights";
import { casts, gapsOf, unverwundbarOf, ventiusMix } from "./15-weapons-and-ventius";
import { $, clock, cssv } from "./18-interface-basics";
import { mitte } from "../build-core";
import { mechanikSekunden, mechanikStempel, mechanikStrecken } from "./61-mechanik";
import { luecken } from "../analyse-core";
import { uiZoomFactor } from "./37-window-size-and-overlay";
import { COMPACT_ROWS } from "./36-dialog";
import { restZeile } from "../kompakt-core";
import type { Fight, Insight, SavedRun, StackSeries } from "../types";

/* One encoding for one fact. A --pitch band was the first idea for the gaps
   and it measures nine levels away from the card it would sit on, which is
   not a hole in anything; this is the wash the Rotation tab has always used
   for the same stretches. The 1px edges are what let a two-pixel band read
   as a marked field instead of a rendering fault. */
/* ---------- was unter dem Rand liegt ----------
   Nur im Kompaktmodus, und nur wenn wirklich etwas folgt. Zwei Zeichen: der
   Verlauf am Rand und die Zahl in der Spaltenueberschrift, die ohnehin
   dasteht. Gerechnet wird an den gemessenen Kaesten, nicht an der Zeilenzahl
   - eine aufgeklappte Zeile macht die Liste hoeher, ohne dass eine Zeile
   dazukommt. */
/* Auf ganze Zeilen beschneiden - im Kompakt und im Raster des Glutrings.

   Kompakt: das Fenster wird aus der Zeilenhoehe berechnet, von Hand
   gezogen passt es aber nicht mehr auf, und dann stand eine halb
   abgeschnittene Zeile unter einer Kopfzeile, die "4 von 12" sagte.

   Gemessen, nicht gerechnet: der Kasten wird an der Unterkante der
   letzten Zeile abgeschnitten, die noch ganz hineinpasst. Eine Rechnung
   aus Kopf- und Zeilenhoehe ging daneben, weil in der Liste mehr steht
   als Kopf und Zeilen - gemessen 255 Punkt Inhalt gegen 231 aus der
   Rechnung. Nur am Anfang der Liste: wer gerollt hat, bekommt seine
   Hoehe nicht unter den Fingern weggeschnitten. */
function schneideAufZeilen(box: HTMLElement, kompakt: boolean){
  /* Im Raster des Glutrings (64) rollt die Liste in sich und endet an der
     letzten ganzen Zeile (DESIGN.md "mehr Hoehe heisst mehr Zeilen").
     Gestapelt (schmal oder flach) rollt die Seite, siehe unten. */
  if(box && document.body.classList.contains("glut") &&
     !document.documentElement.matches(".w-max-899,.h-max-699")){ ringSchnitt(box); return; }
  box?.classList.remove("rollt");
  if(!box) return;
  /* Gestapelt rollt die Seite, nicht die Liste (Spezifikation Feinschliff
     4.4): kein Deckel, alle Zeilen stehen, "x von y sichtbar" entfaellt von
     selbst. Ein Schnitt von vorher (Raster oder Kompakt) wird aufgehoben.
     Ausserhalb des Glutrings und ausserhalb von Kompakt hat #bars keine
     Flaeche (Feinschliff 7, Belegprobe in test-tafel-page): der Deckel der
     alten Vollansicht entfiel, es gibt nichts zu schneiden. */
  if(!kompakt){ box.style.maxHeight = ""; return; }
  /* Hier kommt nur noch Kompakt an. Gerollt wird nicht neu geschnitten -
     aber ein "none" aus dem Raster darf nicht stehen bleiben, sonst haette
     die Liste im Kompakt gar keinen Deckel. Dann gilt wenigstens der aus
     styles.css. */
  if(box.scrollTop >= 1){ if(box.style.maxHeight === "none") box.style.maxHeight = ""; return; }
  /* Erst freigeben, dann messen. Ohne das misst die Funktion ihren
     eigenen letzten Schnitt und kann nur noch kleiner werden: ein
     groesser gezogenes Fenster blieb bei der Hoehe von vorher stehen -
     bei 860, 900 und 1015 Punkt Fensterhoehe gemessen dieselben 276. */
  box.style.maxHeight = "";
  void box.offsetHeight;
  /* Die Vergroesserung sitzt als CSS-zoom auf <html>. getBoundingClientRect
     liefert danach SICHTBARE Punkte, style.maxHeight und clientHeight
     rechnen in Layoutpunkten - wer beides mischt, schreibt bei jeder
     Einstellung ausser 100 % eine falsche Hoehe. Gemessen im
     Kompaktmodus: bei 75 % stand maxHeight auf 160, der Kasten war 120
     hoch und eine Zeile wieder angeschnitten; bei 200 % 66 gegen 88.
     Also alles, was aus einem Rechteck kommt, durch den Faktor teilen. */
  const zf = (typeof uiZoomFactor === "function" ? uiZoomFactor() : 1) || 1;
  /* Gemessen: an der Unterkante der letzten Zeile, die ganz
     hineinpasst. Hier ist das richtig, weil unter dem Kasten nichts
     mehr kommt, was wandern koennte. */
  const bk = box.getBoundingClientRect();
  let letzte = 0;
  for(const z of box.querySelectorAll(".row")){
    const r = z.getBoundingClientRect();
    if(r.bottom <= bk.bottom + 0.5) letzte = (r.bottom - bk.top) / zf; else break;
  }
  /* Der Kasten endet an der letzten ganzen Zeile (Pruefung Aufgabe 9,
     M5): vorher kamen die vierzehn Punkte des Verlaufs dazu, und in ihnen
     lief die sechste Zeile an. compactWindowSize rechnet die Punkte dem
     Fenster weiter zu (COMPACT_FADE) - unter der Liste bleiben sie leer
     wie der Griff im Entwurf. */
  box.style.maxHeight = letzte > 1 ? Math.round(letzte) + "px" : "";
}
/* Der Schnitt im Raster des Glutrings: erst freigeben, dann messen - die
   Liste nimmt in ihrer Spalte, was Kopf und Urteil uebrig lassen (flex), und
   endet an der Unterkante der letzten ganzen Zeile. Gerollt zaehlen die
   Zeilen ab der ersten sichtbaren. Gesetzt wird nur, wenn nicht alles passt.
   Die Vergroesserung (zoom auf <html>) wie unten: Rechtecke durch den Faktor. */
function ringSchnitt(box: HTMLElement){
  const zf = (typeof uiZoomFactor === "function" ? uiZoomFactor() : 1) || 1;
  box.style.maxHeight = "none";
  void box.offsetHeight;
  const bk = box.getBoundingClientRect();
  const kopf = box.querySelector(".bhead");
  const oben = bk.top + (kopf ? kopf.getBoundingClientRect().height : 0);
  let letzte = 0, allesDa = true;
  for(const z of box.querySelectorAll(".row")){
    const r = z.getBoundingClientRect();
    if(r.bottom <= oben + 0.5) continue;
    if(r.bottom <= bk.bottom + 0.5) letzte = (r.bottom - bk.top) / zf;
    else { allesDa = false; break; }
  }
  const rollt = !allesDa && letzte > 1;
  if(rollt) box.style.maxHeight = Math.round(letzte) + "px";
  /* Rollt die Liste, fuellt sie die Spalte und das Urteil steht am Ende
     (margin-top:auto, styles.css); passt alles, folgt das Urteil der Liste
     (Spezifikation Feinschliff 6). */
  box.classList.toggle("rollt", rollt);
}
/* Im Overlay beschneidet der Kasten die Faktenzeile, nicht der Text:
   die Teile geben nichts ab (flex:0 0 auto), ihre eigene Ellipse greift
   also nie. Gemessen bei 320 Punkt Fensterbreite: "32.542.077 Schaden"
   lief bis 332, der Schnitt sitzt bei 310 - die Zahl endete mitten in
   einer Ziffer. Der Kommentar an der Reihenfolge sagt, warum das
   schlimmer ist als sie wegzulassen: eine angeschnittene Summe sieht
   aus wie eine kleinere Summe.

   Also von hinten weg, ganze Werte. Die Reihenfolge ist die, die dort
   schon festgelegt ist - hinten steht, was am wenigsten kostet. */
function kopfBeschneiden(){
  const box = $("#hMeta");
  if(!box) return;
  const teile = [...box.querySelectorAll<HTMLElement>(".f")];
  const bereich = box.querySelector(".scope");
  teile.forEach(el => el.classList.remove("zuEng"));
  if(bereich) bereich.classList.remove("zuEng");
  if(!document.body.classList.contains("compact")) return;
  void box.offsetWidth;
  const rand = () => box.getBoundingClientRect().right + 0.5;
  const uebrig = () => teile.filter(el => !el.classList.contains("zuEng") &&
                                          el.offsetParent !== null);
  /* Zuerst: der Geltungsbereich ist mehr wert als die Dauer. Die grosse
     Zahl ist ein DPS-Wert - wessen er ist, sagt mehr als wie lange der
     Kampf ging, und die Dauer steht in der Vollansicht ohnehin. Also
     weicht die Dauer, bevor "Dein Schaden" auf "De..." faellt. */
  const beschnitten = () => bereich && bereich.scrollWidth > bereich.clientWidth + 1;
  let schutz = teile.length;
  while(beschnitten() && uebrig().length > 1 && schutz-- > 0){
    uebrig()[0]!.classList.add("zuEng");
    void box.offsetWidth;
  }
  /* Dann von hinten: was nicht mehr ganz hineinpasst, faellt ganz weg. */
  for(let i = teile.length - 1; i >= 0; i--){
    const el = teile[i]!;
    if(el.classList.contains("zuEng") || el.offsetParent === null) continue;
    if(el.getBoundingClientRect().right > rand()) el.classList.add("zuEng");
    else break;
  }
  /* Und wenn selbst dann nur ein Stummel bleibt: lieber nichts. Ein
     Wortanfang, der wie ein Wort aussieht, ist schlechter als eine
     Luecke - der volle Text steht im title. */
  if(bereich && beschnitten() && bereich.getBoundingClientRect().width < 30)
    bereich.classList.add("zuEng");
}
/* Die Restzeile (#160, Spezifikation Kompakt-Fenster 8a): was unter der
   letzten ganzen Zeile liegt, als eigene Zeile darunter - "+9 weitere, 12 %". Gemessen an den Kaesten wie die Zaehlung im Spaltenkopf; ein
   Klick fuehrt zur Vollansicht (37). Nur im Kompakt. */
function restZeileSetzen(box: HTMLElement, kompakt: boolean){
  const knopf = document.querySelector<HTMLButtonElement>("#kRest");
  if(!knopf) return;
  const haupt = [...box.querySelectorAll<HTMLElement>(".row:not(.sub)")];
  const bk = box.getBoundingClientRect();
  const unten = kompakt ? haupt.filter(z => z.getBoundingClientRect().bottom > bk.bottom + 0.5) : [];
  const wert = (z: HTMLElement) => Number(z.dataset.dmg) || 0;
  const r = restZeile(haupt.map(wert), unten.map(wert));
  knopf.hidden = !r;
  if(!r) return;
  knopf.querySelector(".kresttext")!.textContent = t("compact.rest", {n: r.n, p: pctMin(r.anteil, 0)});
  knopf.querySelector(".krestwert")!.textContent = fmt(r.schaden);
  knopf.querySelector<HTMLElement>(".krestspur")!.style.width = (100 * r.anteil).toFixed(1) + "%";
  // der Name sagt, was ein Klick tut; Anteil und Schaden stehen im sichtbaren Text, darauf zeigt die Beschreibung
  knopf.setAttribute("aria-describedby", "kRestText");
  knopf.setAttribute("aria-label", t(state.group === "party" ? "compact.restNameGruppe" : "compact.restName", {n: r.n}));
}
export function markiereRest(){
  const box = $("#bars");
  if(!box) return;
  const kompakt = document.body.classList.contains("compact");
  kopfBeschneiden();
  /* Der Platz der Restzeile steht fest, sobald es mehr als fuenf Hauptzeilen
     gibt - vor dem Schneiden, sonst kuerzt ihr Erscheinen die Liste erneut. */
  document.body.classList.toggle("mitrest", kompakt && box.querySelectorAll(".row:not(.sub)").length > COMPACT_ROWS);
  schneideAufZeilen(box, kompakt);
  restZeileSetzen(box, kompakt);
  const folgt = box.scrollHeight - box.clientHeight - box.scrollTop > 2;
  /* Die Blende am unteren Rand des Kompakts (.mehr) entfiel mit der
     Neugestaltung: die Liste endet dort an der letzten ganzen Zeile.
     Die Zaehlung steht in beiden Ansichten. Sie lief frueher nur in der
     Ueberlagerung - gemessen an
     einem eigenen Log: bei einem 900 Punkt hohen Fenster zeigt die Tabelle neun
     Zeilen, und 62 von 66 Kaempfen haben mehr. Der Median liegt bei
     vierzehn Faehigkeiten. Eine Laufleiste sagt, DASS es weitergeht; sie
     sagt nicht, wie weit. */
  const kopf = box.querySelector('.bhead span[data-k="name"]');
  if(!kopf) return;
  /* Nur Hauptzeilen. Eine aufgeklappte Zeile bringt vier Unterzeilen mit,
     und "7 von 16" bei zwoelf Faehigkeiten ist die Zaehlung von nichts,
     das jemand sieht. */
  const zeilen = [...box.querySelectorAll(".row:not(.sub)")];
  const alle = zeilen.length;
  if(!alle) return;
  let sichtbar = 0;
  /* Gemessen an den Kaesten, nicht an offsetTop. offsetTop zaehlt gegen
     den naechsten positionierten Vorfahren, und #bars ist nur im
     Kompaktmodus einer (body.compact #bars{position:relative}). In der
     Vollansicht verglich die Rechnung damit zwei verschiedene Bezuege und
     meldete "0 von 17", waehrend neun Zeilen dastanden.
     Zwei Kaesten gegeneinander tragen dieselbe Einheit, also faellt auch
     die Zoomfalle weg - hier wird nichts umgerechnet. */
  const bk = box.getBoundingClientRect();
  for(const z of zeilen){
    const r = z.getBoundingClientRect();
    if(r.top >= bk.top - 0.5 && r.bottom <= bk.bottom + 0.5) sichtbar++;
  }
  /* Angehaengt, nicht ersetzt. Vorher schrieb textContent das Wort und den
     Sortierpfeil weg: aus "Spieler" wurde in der Gruppenansicht "Name",
     und das "\u2193" der sortierten Spalte verschwand. Die Ueberschrift
     bleibt stehen, der Zaehler kommt dahinter. */
  let zettel = kopf.querySelector(".mehrzahl");
  const zeigen = folgt || box.scrollTop > 0;
  if(!zeigen){ if(zettel) zettel.remove(); return; }
  if(!zettel){
    zettel = document.createElement("span");
    zettel.className = "mehrzahl";
    /* aria-hidden: die Spaltenueberschrift heisst "Name". Haenge ich die
       Zaehlung an ihren Namen, meldet sich der Spaltenkopf als
       "Name (9 von 17), Spaltenkopf, absteigend sortiert" - und aendert
       seinen Namen bei jedem Rollen. Die Zahl ist fuers Auge; wer die
       Tabelle hoert, hat die Zeilen ohnehin einzeln. */
    zettel.setAttribute("aria-hidden", "true");
    kopf.appendChild(zettel);
  }
  zettel.textContent = t("bars.someOfAll", {n: sichtbar, total: alle});
}

/* ---------- die schwaechste Stelle des Kampfes ----------
   Dieselbe Rechnung fuer den Satz in der Analyse und fuer das Band im
   Zeitverlauf. Stuende sie zweimal da, wuerden die beiden irgendwann
   auseinanderlaufen, und dann zeigte das Bild woanders hin als der Text.

   Ausgeschlossen wird, was kein schwaches Spiel ist: die ersten fuenf
   Sekunden eines Pulls, die letzten fuenf (ein Fenster und zwei Sekunden
   dazu), und alles, was einer Pause naeher kommt als die Fensterlaenge -
   davor laeuft es aus, danach faengt es wieder an. Bleibt nichts uebrig,
   gibt es die Stelle nicht, und dann gibt es weder Satz noch Band.

   Das Ende nach den Daten, nicht nach dem Gefuehl: im Beispiel auf Ramux
   (1:10) endet der letzte Wurf bei 1:06,1, danach kommen nur noch die
   Sekundenticks von Mother Nature's Protest und eine nachlaufende
   Detonation Mark bei 1:09,1. "Nach dem letzten Treffer aufs Ziel"
   schneidet dort nichts ab - der letzte Treffer IST ein Nachlaeufer, und
   die Ticks jede Sekunde halten auch die Pausensuche zu. Die Rechnung
   fand so "1:06-1:09 bei 708 DPS": den Boss, der schon faellt, nicht ein
   schwaches Spiel. Wo ein Kampf endet, laufen immer Nachlaeufer aus, also
   wird das Ende so behandelt wie der Anfang: fest ausgeschlossen. */
const ENDE_FREI = 2;

/* Gemerkt in einer WeakMap statt am Kampf selbst: renderStack zeichnet bei
   jedem Zoomschritt neu, und eine eigene Eigenschaft am Segment laege in
   allem, was ein Segment je serialisiert. */
const schwachMerk = new WeakMap<Fight, { stempel: string; raus: { von: number; bis: number; dps: number; typ: number } | null }>();
export function schwaechstesFenster(seg: Fight){
  /* Die Mechanik dieses Pulls haengt an den anderen geladenen Pulls
     desselben Bosses (61-mechanik.ts): kommt unter Live der fuenfte dazu,
     gilt die Stelle neu. */
  const stempel = mechanikStempel(seg);
  const alt = schwachMerk.get(seg);
  if(alt && alt.stempel === stempel) return alt.raus;
  const ps = perSecond(seg, 0).total, T = ps.length;
  let raus = null;
  if(T >= 30){
    /* Eine Strecke, in der das Ziel unverwundbar war, ist wie eine Pause
       keine schwache Stelle deiner Rotation (Issue #37). Seit der
       Neugestaltung (28.09., Luecken 4.3) nennt die Analyse Luecken nach
       dem Median; auch sie sind schon benannt und darum keine Stelle
       (Entscheidung vom 29.09., an Claude uebertragen). Eine
       erkannte Mechanik des Bosses (Spezifikation Mechanik 3) ist es
       ebenso wenig: dort laufen deine Treffer, der Boss nimmt sie nicht. */
    const aus = unverwundbareSekunden(seg, T), mech = mechanikSekunden(seg, T);
    const nachMedian = luecken(ps, aus.map((x, i) => x || mech[i]!)).luecken.map(([von, bis]) => ({from: von, to: bis}));
    const w = 3, pausen = [...gapsOf(seg), ...unverwundbarOf(seg), ...mechanikStrecken(seg), ...nachMedian], eimer = [];
    for(let i = 5; i + w <= T - w - ENDE_FREI; i++){
      if(pausen.some(g => i + w > g.from - w && i < g.to + w)) continue;
      eimer.push({i, v: ps.slice(i, i + w).reduce((x, y) => x + y, 0) / w});
    }
    eimer.sort((x, y) => x.v - y.v);
    const schlecht = eimer[0];
    /* typ: der Median der gueltigen Fenster (mitte(), wie ueberall), also
       drei gewoehnliche Sekunden dieses Kampfes. Das Urteil oben in der Analyse misst den
       Verlust der schwaechsten Stelle daran und nicht am Schnitt: bei
       einem Burst-Build liegt der Schnitt ueber fast jedem Fenster, und
       gegen ihn gemessen waere jede ruhige Stelle ein "Verlust". */
    const typ = eimer.length ? mitte(eimer.map(e => e.v)) : 0;
    if(schlecht) raus = {von: schlecht.i, bis: schlecht.i + w, dps: schlecht.v, typ};
  }
  schwachMerk.set(seg, {stempel, raus});
  return raus;
}

/* Dieselbe Behandlung wie eine Pause, andere Farbe. Gezeichnet wird nur,
   was im Fenster liegt. */
export function paintWeak(ctx: CanvasRenderingContext2D, f: ReturnType<typeof schwaechstesFenster>, X: (t: number) => number, a: number, b: number, yTop: number, yBot: number){
  if(!f || f.bis <= a || f.von >= b) return;
  const xa = X(Math.max(f.von, a)), xb = X(Math.min(f.bis, b));
  if(xb - xa < .5) return;
  ctx.fillStyle = cssv("--weak-band");
  ctx.fillRect(xa, yTop, xb - xa, yBot - yTop);
  ctx.fillStyle = cssv("--weak-edge");
  ctx.fillRect(Math.round(xa), yTop, 2, yBot - yTop);
  ctx.fillRect(Math.round(xb) - 2, yTop, 2, yBot - yTop);
}

export function paintGaps(ctx: CanvasRenderingContext2D, gaps: ReturnType<typeof gapsOf>, X: (t: number) => number, a: number, b: number, yTop: number, yBot: number){
  for(const g of gaps){
    if(g.to <= a || g.from >= b) continue;
    const xa = X(Math.max(g.from, a)), xb = X(Math.min(g.to, b));
    if(xb - xa < .5) continue;
    ctx.fillStyle = cssv("--gap-band");
    ctx.fillRect(xa, yTop, xb - xa, yBot - yTop);
    /* Zwei Punkte breit, nicht einer. Das Feld selbst liegt bei gemessen
       1,12 zu 1 gegen den Grund - es ist ein Hauch und traegt die Aussage
       nicht allein. Die Kanten tun es jetzt: .72 bzw. .68 Deckung ergeben
       3,0 zu 1, und zwei Punkte sind auf einem Bildschirm auch zu sehen.
       Der wichtigste Befund eines Kampfes - wie lange gar nichts lief -
       darf nicht an einer Farbtoenung haengen. */
    ctx.fillStyle = cssv("--gap-edge");
    ctx.fillRect(Math.round(xa), yTop, 2, yBot - yTop);
    ctx.fillRect(Math.round(xb) - 2, yTop, 2, yBot - yTop);
  }
}
/* Die Strecken, in denen das Ziel unverwundbar war (Issue #37). Dieselbe
   Form wie eine Pause - Feld und zwei Punkte breite Kanten -, aber in
   einer ruhigen, neutralen Toenung (--invuln-band, --invuln-edge): das ist
   Mechanik, kein Aussetzer, und darf mit dem roten Band nicht zu
   verwechseln sein. */
export function paintInvuln(ctx: CanvasRenderingContext2D, strecken: ReturnType<typeof unverwundbarOf>, X: (t: number) => number, a: number, b: number, yTop: number, yBot: number){
  for(const g of strecken){
    if(g.to <= a || g.from >= b) continue;
    const xa = X(Math.max(g.from, a)), xb = X(Math.min(g.to, b));
    if(xb - xa < .5) continue;
    ctx.fillStyle = cssv("--invuln-band");
    ctx.fillRect(xa, yTop, xb - xa, yBot - yTop);
    ctx.fillStyle = cssv("--invuln-edge");
    ctx.fillRect(Math.round(xa), yTop, 2, yBot - yTop);
    ctx.fillRect(Math.round(xb) - 2, yTop, 2, yBot - yTop);
  }
}
/* Eine erkannte Mechanik des Bosses (61-mechanik.ts, Spezifikation
   Mechanik 3): der Ton des Unverwundbar-Bandes und dieselben Kanten, dazu
   eine leise Schraffur - dort liefen deine Treffer weiter, der Boss nahm
   sie kaum. Die Striche haengen an der Zeitachse (X(0)), damit sie beim
   Rollen und Zoomen nicht wandern. */
export function paintMech(ctx: CanvasRenderingContext2D, strecken: { from: number; to: number }[], X: (t: number) => number, a: number, b: number, yTop: number, yBot: number){
  for(const g of strecken){
    if(g.to <= a || g.from >= b) continue;
    const xa = X(Math.max(g.from, a)), xb = X(Math.min(g.to, b));
    if(xb - xa < .5) continue;
    const h = yBot - yTop, takt = 7;
    ctx.save();
    ctx.fillStyle = cssv("--invuln-band");
    ctx.fillRect(xa, yTop, xb - xa, h);
    ctx.beginPath(); ctx.rect(xa, yTop, xb - xa, h); ctx.clip();
    ctx.strokeStyle = cssv("--invuln-edge"); ctx.lineWidth = 1;
    ctx.beginPath();
    const x0 = X(0), start = xa - h - ((((xa - h - x0) % takt) + takt) % takt);
    for(let x = start; x < xb; x += takt){ ctx.moveTo(x, yBot); ctx.lineTo(x + h, yTop); }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = cssv("--invuln-edge");
    ctx.fillRect(Math.round(xa), yTop, 2, h);
    ctx.fillRect(Math.round(xb) - 2, yTop, 2, h);
  }
}
/* One decimal in the reader's own number format: "6,1", not the "6.1"
   toFixed hands back whatever language the app is in. */
export const numN = (x: number, dp: number) => x.toLocaleString(state.lang === "de" ? "de-DE" : "en-US",
  {minimumFractionDigits:dp, maximumFractionDigits:dp});
export const num1 = (x: number) => numN(x, 1);
export const secs1 = (x: number) => num1(x) + "\u00a0s";
/* German sets a no-break space before the unit and a comma for the decimal.
   The dictionary does this by hand inside its own strings; these two do it
   for the percentages the renderers build themselves, which until now were
   "31.4%" in both languages. pct() takes a fraction, pctOf() a figure that
   has already been multiplied out. Neither belongs in a style attribute -
   width:"31,4 %" is not a length. */
export const pctOf = (n: number, dp?: number) => numN(n, dp || 0) + (state.lang === "de" ? "\u00a0%" : "%");
export const pct = (frac: number, dp?: number) => pctOf(100 * frac, dp);
/* Ein Anteil, der kleiner ist als die Stelle, die ihn anzeigen soll. "0 %"
   neben etwas, das nicht null ist, ist eine falsche Aussage: das Ziel
   "Blue Core" nahm gemessen 64 von 83.558.502 Schaden und bekam dafuer
   "0 %". Unterhalb der kleinsten darstellbaren Stelle steht darum "< 1 %"
   beziehungsweise "< 0,1 %". Eine echte Null bleibt eine Null. */
export function pctMin(frac: number, dp: number){
  const f = Number(frac) || 0;
  const stelle = Math.pow(10, -(dp || 0)) / 100;
  if(f > 0 && f < stelle) return "< " + pctOf(100 * stelle, dp || 0);
  /* Und dasselbe am oberen Ende: "100 %" heisst, dass sonst nichts da ist.
     Gemessen stand in der Zielaufteilung "King Khanzaizin 100 %" ueber
     "Blue Core < 1 %" - zusammen mehr als das Ganze. */
  if(f < 1 && f > 1 - stelle) return "> " + pctOf(100 * (1 - stelle), dp || 0);
  return pct(f, dp);
}
/* Welche ganzen Sekunden eines Kampfes zur Haelfte oder mehr in einer
   Strecke liegen, in der das Ziel unverwundbar war (Issue #37). Die
   Schwankung und der Haelftenvergleich lassen sie aus: dort lief
   Mechanik, nicht deine Rotation. Und nur, wenn in der Sekunde selbst
   die Treffer auf Unverwundbare ueberwiegen: traf daneben etwas
   Verwundbares, lief dort Schaden, und die Sekunde zaehlt. */
export function unverwundbareSekunden(seg: Fight, T: number): boolean[] {
  const raus: boolean[] = new Array(T).fill(false);
  const strecken = unverwundbarOf(seg);
  if(!strecken.length) return raus;
  const inv = new Array(T).fill(0), normal = new Array(T).fill(0);
  const sek = (t: number) => Math.min(T - 1, Math.floor((t - seg.start) / 1000));
  for(const e of unverwundbarTreffer(seg)) inv[sek(e.t)]++;
  for(const e of seg.events) normal[sek(e.t)]++;
  for(const u of strecken)
    for(let i = Math.max(0, Math.floor(u.from)); i < Math.min(T, Math.ceil(u.to)); i++)
      if(Math.min(i + 1, u.to) - Math.max(i, u.from) >= .5 && normal[i] < inv[i]) raus[i] = true;
  return raus;
}

/* Eine Abklingfaehigkeit, fuer den leisen Befund zur Unverwundbarkeit.
   Das Log sagt nicht, welche Faehigkeit eine Abklingzeit hat, und die App
   kennt dafuer keine Liste. Gelesen wird darum am Rhythmus im Kampf
   selbst: liegen die Einsaetze einer Faehigkeit (mit denen ins
   Unverwundbare) im Median mindestens so weit auseinander, ist sie keine
   Fuellfaehigkeit, die man alle ein, zwei Sekunden drueckt. Eine, die nur
   einmal kam, zaehlt auch.
   Ein Einsatz sind hier alle Treffer einer Faehigkeit, zwischen denen
   hoechstens DEAD_TIME liegt - weiter als das Fenster von casts(), damit
   eine Faehigkeit mit mehreren Treffern oder ein Kanal nicht in lauter
   kurze "Einsaetze" zerfaellt und wie Fuellwerk aussieht. */
const ABKLING_AB_MS = 5000;
function einsaetze(zeiten: number[]){
  const raus: { t: number; last: number }[] = [];
  for(const t of [...zeiten].sort((a, b) => a - b)){
    const l = raus[raus.length - 1];
    if(l && t - l.last <= DEAD_TIME * 1000) l.last = t; else raus.push({t, last: t});
  }
  return raus;
}
/* Wer eine Faehigkeit ohne Pause drueckt, bekommt so einen einzigen
   langen Einsatz: laenger als ABKLING_AB_MS ist darum Fuellwerk, auch
   wenn nur einer da ist. */
function abklingfaehig(ein: { t: number; last: number }[]){
  if(!ein.length || mitte(ein.map(c => c.last - c.t)) >= ABKLING_AB_MS) return false;
  if(ein.length < 2) return true;
  const abst = [];
  for(let i = 1; i < ein.length; i++) abst.push(ein[i]!.t - ein[i - 1]!.t);
  return mitte(abst) >= ABKLING_AB_MS;
}

export function perSecond(seg: Fight, topN: number){
  const s = seg.stats;
  const T = Math.max(1, Math.ceil(s.seconds));
  const top = s.skills.slice(0, topN || 8);
  const names = top.map(k => k.name);
  const idx = new Map<string, number>(names.map((n,i) => [n,i]));
  const lanes = names.map(() => new Array(T).fill(0));
  const other = new Array(T).fill(0);
  const total = new Array(T).fill(0);
  /* Treffer je Sekunde, in dieselbe Sekunde einsortiert wie der Schaden.
     clip() hat die Treffer bisher aus dem Verhaeltnis der Schadenssummen
     hochgerechnet. Ueber zehn geschnittene Kaempfe gemessen lag das zwischen
     -33,5 % und +30,4 % neben der Zahl, die im Fenster wirklich gelandet ist,
     und traf in keinem der zehn Faelle. Mit dieser Reihe zaehlt clip() sie.
     Die Summe der Reihe ist ev.length, also genau stats().hits - beide
     entstehen in derselben Schleife ueber dieselben Ereignisse. */
  const hitsPer = new Array(T).fill(0);
  for(const e of seg.events){
    const i = Math.min(T-1, Math.floor((e.t - seg.start)/1000));
    const l = idx.get(e.skill);
    if(l == null) other[i] += e.dmg; else lanes[l]![i] += e.dmg;
    total[i] += e.dmg;
    hitsPer[i]++;
  }
  const hasOther = other.some(v => v > 0);
  return {
    T, total, hits: hitsPer,
    series: top.map((k,i): StackSeries => ({name:k.name, color:k.color, values:lanes[i]!}))
      // dieselbe Farbe wie Rang dreizehn und weiter: beides heisst "nicht eine
      // der zwoelf", und zwei Graus dafuer waeren eine Unterscheidung ohne
      // Unterschied
      .concat(hasOther ? [{name:"__other__", color:cssv("--series-rest"), values:other}] : [])
  };
}

/* fixed windows, the way a 60 second build test is usually read */
function windows(seg: Fight, size: number){
  size = size || 15;
  const s = seg.stats;
  const n = Math.max(1, Math.ceil(s.seconds/size));
  const out = [];
  for(let i=0;i<n;i++){
    const a = seg.start + i*size*1000, b = a + size*1000;
    const ev = seg.events.filter(e => e.t >= a && e.t < b);
    const span = Math.min(size, s.seconds - i*size) || size;
    const dmg = ev.reduce((x,e) => x+e.dmg, 0);
    const m = new Map();
    ev.forEach(e => m.set(e.skill, (m.get(e.skill)||0)+e.dmg));
    const best = [...m.entries()].sort((a,b)=>b[1]-a[1])[0];
    const bestSkill = best ? best[0] : null;
    const bestEvent = bestSkill ? ev.find(e => e.skill === bestSkill) : null;
    out.push({
      partial: span < size*0.9,
      from: i*size, to: i*size + span,
      damage: dmg, dps: dmg/Math.max(span,0.001), hits: ev.length,
      crit: ev.length ? ev.filter(e => e.crit).length/ev.length : 0,
      top: bestSkill || "—",
      topSid: bestEvent ? bestEvent.sid : ""
    });
  }
  return out;
}

/* Ab wie vielen Treffern Borometer einen Kampf liest. Darunter sagt der
   Kopf "zu wenig", und die Analyse zaehlt nur noch, statt zu urteilen -
   beide an dieser einen Zahl, damit sie nie auseinanderlaufen. */
export const LIEST_AB_TREFFER = 20;

/* Was unter der Schwelle stehen bleibt: die Zaehlungen, sonst nichts.
   Kein Anteil, keine Art der Skillung, kein Haelftenvergleich - auf elf
   Treffern ist jede davon Zufall. */
export function zaehlung(seg: Fight): Insight {
  const s = seg.stats;
  return {key:"thinCounts", vars:{
    hits: anzahl(s.hits), crit: anzahl(s.crit), heavy: anzahl(s.heavy),
    missed: seg.missed ? anzahl(seg.missed) : "", min: LIEST_AB_TREFFER
  }};
}

/* short, named findings — the things worth changing. Language-neutral:
   returns a key plus the numbers/names it needs; ui.js turns that into
   text in whichever language is active. */
export function insights(seg: Fight){
  const s = seg.stats, out: Insight[] = [];
  const sidOf = new Map();
  for(const e of seg.events) if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);
  /* Die Schwankung ohne die Sekunden, in denen das Ziel unverwundbar war:
     dort landet nichts, und 38 solche Sekunden machten jede Skillung zu
     "Burst" (Issue #37). Ebenso ohne die Sekunden einer erkannten Mechanik
     (Pruefung 01.10., M1). */
  const alleSek = perSecond(seg, 0).total;
  const mech = mechanikSekunden(seg, alleSek.length);
  const aus = unverwundbareSekunden(seg, alleSek.length).map((x, i) => x || mech[i]!);
  const ohne = alleSek.filter((_, i) => !aus[i]);
  const ps = ohne.length ? ohne : alleSek;
  const T = ps.length;
  const mean = ps.reduce((a,b)=>a+b,0)/T;
  const sd = Math.sqrt(ps.reduce((a,b)=>a+(b-mean)*(b-mean),0)/T);
  const cv = mean ? sd/mean : 0;

  out.push({key:"consistency", vars:{
    swing:(100*cv).toFixed(0),
    variant: cv > .9 ? "bursty" : cv > .5 ? "normal" : "steady"
  }});

  const top = s.skills[0];
  if(top){
    const share = top.damage/s.total;
    const top3 = s.skills.slice(0,3).reduce((a,k)=>a+k.damage,0)/s.total;
    /* q ist derselbe Anteil ungerundet. Die Seite zeichnet daraus eine
       Laenge; aus "81" zurueckzurechnen waere eine zweite Quelle fuer
       dieselbe Zahl, und "0,0 %" liesse sich gar nicht zurueckrechnen. */
    /* Der Satz behauptete einen Vergleich, ohne die Zahlen zu nennen, an
       denen man ihn pruefen koennte - und im Deutschen behauptete er den
       falschen: "mehr als alle anderen Faehigkeiten" heisst deren Summe.
       Gemessen auf King Khanzaizin bringt ein Einsatz Auge von Ventius
       911.732, alle anderen Faehigkeiten zusammen 16.090.337. Jetzt stehen
       beide Zahlen da und verglichen wird, was vergleichbar ist: Einsatz
       gegen Einsatz. Fehlt eine der beiden Zahlen, faellt der Satz auf die
       Drei-staerksten-Aussage zurueck, die immer stimmt. */
    const jeName = casts(seg);
    const zweit = s.skills[1];
    const n1 = (jeName.get(top.name) || []).length;
    const n2 = zweit ? (jeName.get(zweit.name) || []).length : 0;
    const proEins = n1 ? fmt(top.damage / n1) : "";
    const proZwei = (zweit && n2) ? fmt(zweit.damage / n2) : "";
    out.push({key:"concentration", vars:{
      share:(100*share).toFixed(0), skill:top.name, sid:sidOf.get(top.name)||"", top3:(100*top3).toFixed(0),
      big: share > .5 && !!proEins && !!proZwei,
      perCast: proEins, perCast2: proZwei,
      skill2: zweit ? zweit.name : "", skill2Sid: zweit ? (sidOf.get(zweit.name)||"") : "",
      q: share
    }});
  }

  /* Das schwaechste Fenster - aber nur dort, wo ein schwaches Fenster
     etwas bedeutet.

     Gemessen ueber alle 51 Kaempfe des Beispiellogs zeigte der Befund auf
     32 davon entweder eine Luecke, die die App zwei Zeilen darueber selbst
     als Pause auflistet (21), oder die ersten Sekunden des Pulls (11) -
     und gab dazu die Anweisung "Pruefe, was dort im Cooldown war". In
     Sekunde 2 eines Pulls ist nichts im Cooldown, und eine Pause ist
     bereits benannt. Beides faellt jetzt weg; bleibt kein Fenster uebrig,
     faellt der ganze Befund weg.

     Die Luecken werden dafuer um die Fensterlaenge aufgeblasen, nach beiden
     Seiten. Ohne das lag der Befund auf King Khanzaizin bei 1:43-1:46 -
     ausserhalb jeder Luecke, aber endend in genau der Sekunde, in der die
     49-Sekunden-Pause beginnt. Das ist das Auslaufen vor einem
     Phasenwechsel, und die drei Sekunden dahinter sind der Wiedereinstieg;
     beides ist kein schwaches Spiel. Ein Fenster muss also mit seiner
     ganzen Laenge Abstand zu einer Pause halten.

     Die Schwelle steigt von 6 auf 30 Sekunden: auf einem 5,5-Sekunden-Kampf
     deckte das Dreisekundenfenster mehr als die Haelfte des Kampfes ab und
     hiess trotzdem "die schwaechste Stelle". */
  {
    const worst = schwaechstesFenster(seg);
    if(worst){
      const ev = seg.events.filter(e => {
        const t = (e.t-seg.start)/1000; return t >= worst.von && t < worst.bis;
      });
      const m = new Map(); ev.forEach(e => m.set(e.skill,(m.get(e.skill)||0)+e.dmg));
      const drove = [...m.entries()].sort((a,b)=>b[1]-a[1])[0];
      out.push({key:"weakestWindow", vars:{
        from: clock(worst.von), to: clock(worst.bis), dps: fmt(worst.dps),
        // "only" has to mean only: the top entry of the map exists whenever
        // anything landed, so choosing on that printed exclusivity off a maximum
        variant: !drove ? "nothing" : m.size === 1 ? "only" : "led",
        others: m.size - 1,
        drove: drove ? drove[0] : "", droveSid: drove ? (sidOf.get(drove[0])||"") : ""
      }});
    }
  }

  out.push({key:"critContribution", vars:{
    share:(100*s.critDmgShare).toFixed(0), critRate:(100*s.critRate).toFixed(0), heavyRate:(100*s.heavyRate).toFixed(0),
    q: s.critRate, qDmg: s.critDmgShare
  }});

  /* Starke Treffer: die App misst sie in jedem Kampf; die Analyse nennt sie
     unter "Wie triffst du?". Ohne Uhr. Den groessten Treffer nennt die
     Analyse seit der Neugestaltung (28.09., DECISION 2.3) mit seiner
     Faehigkeit unter "Weitere Befunde", gelesen aus den Treffern selbst. */
  if(s.heavy > 0) out.push({key:"heavyHits", vars:{
    pct: pct(s.heavyRate, 0), n: anzahl(s.heavy), total: anzahl(s.hits), q: s.heavyRate
  }});

  /* --- where you stood for Ventius --------------------------------
     This used to ask whether a cast landed exactly seven hits, because
     that is what a cast does on a practice dummy at 2, 5, 8, 11, 14 or
     17 metres - and four from anywhere else. Measured on a night of
     dungeons, that question answered "no" on all 24 fights and the
     finding never appeared: of 193 casts there, six landed four hits
     and 37 landed seven, while 79 landed ten and 36 landed thirteen.

     What a cast actually is, read hit by hit: one opening hit, then a
     pause of 900-990 ms, then a wave of three landing in the same
     millisecond, then ~106 ms, the next wave of three, and so on. So
     the hit count is 1 + 3xN, which fits 86% of every cast in that log,
     and N - the number of waves - is the thing the distance moves.

     Seven is not the ceiling, it is the DUMMY's ceiling. Measured per
     target: Vulcanus never gives more than three waves, Deus Chimaerus
     runs at four, ordinary trash at two, a practice dummy at two. The
     target's size sets the ceiling; where you stand decides how often
     you reach it. So the question is asked against the best this fight
     ever gave, which on a dummy is seven hits and says exactly what the
     old wording said, and in a dungeon says something true as well.

     Three casts is the floor. Below that the best-seen figure is one
     lucky cast rather than a ceiling. */
  /* --- what went past ---------------------------------------------
     Only when the log recorded a miss at all: a fight with none has nothing
     to say here, and a flat "0 %" on every screen would be noise. The rate is
     against everything that was swung, hits plus misses, because that is the
     question - how much of what you threw landed. */
  if(seg.missed){
    /* Asked against the skill that missed, not against the fight. The old
       denominator was every damage row of the fight plus the misses - and a
       damage row is not a swing: one press of a volley writes a row per
       enemy it reaches, so "2 of 424 attacks did not land" counted 424 of
       something nobody threw. On the Calanthia pull that read 0,1% where the
       true figure was 6,3%, a factor of 42.

       Every miss in the 87 logs on this machine is a basic attack but
       sixteen, and a basic attack writes one row per shot - so against that
       skill the comparison is one swing to one swing, which is what the
       sentence says it is. */
    const entries = [...(seg.missSkills || new Map()).entries()];
    const names = entries.map(e => e[0]);
    const rows = seg.events.reduce((n,e) => n + (names.indexOf(e.skill) >= 0 ? 1 : 0), 0);
    const swung = rows + seg.missed;
    // one skill is the ordinary case - all but three of the 87 logs here, and
    // two of those three are the same skill under both its names, from a log
    // whose client changed language halfway. Only then is there an id to hand
    // over; a joined label could not carry one that means anything.
    const one = entries.length === 1;
    out.push({key:"missed", vars:{
      n: seg.missed, swung, share: pct(seg.missed/swung, 1), q: seg.missed/swung,
      skill: one ? names[0] : names.join(" · "), sid: one ? entries[0]![1].sid : ""
    }});
  }

  /* --- was ins unverwundbare Ziel ging (Issue #37) ------------------
     Unverwundbarkeit ist Mechanik, kein Verlust: sie ist nie das Urteil,
     und ihre Strecke steht im Zeitverlauf und in der Form als eigenes,
     ruhiges Band. Ein Satz steht hier nur, wenn in einer solchen Strecke
     eine Abklingfaehigkeit eingesetzt wurde - das ist das Einzige daran,
     das man beim naechsten Mal anders machen kann. Eine Feststellung,
     ohne Schaden und ohne Anteil. Wer nur weiter Grundangriffe setzte,
     bekommt keinen Satz, nur das Band. */
  /* Gezaehlt wird nur eine Faehigkeit, die eine Waffe hat (weaponFor) -
     sonst ist es ein Proc, ein Set oder eine Rune und nichts, das man
     drueckt -, und nur ein Einsatz, der in einer Strecke liegt und nicht
     zugleich etwas Verwundbares traf: ein Flaechenangriff, der das
     unverwundbare Add und den Boss traf, ging nicht ins Leere. */
  if(seg.unverwundbar && seg.unverwundbar.length){
    const strecken = seg.unverwundbar;
    const roh = unverwundbarTreffer(seg);
    const zeitenDort = new Map<string, number[]>(), zeitenHier = new Map<string, number[]>();
    const sidVon = new Map<string, string>();
    for(const e of roh){
      if(!zeitenDort.has(e.skill)) zeitenDort.set(e.skill, []);
      zeitenDort.get(e.skill)!.push(e.t);
      if(e.sid && !sidVon.has(e.skill)) sidVon.set(e.skill, e.sid);
    }
    for(const e of seg.events) if(zeitenDort.has(e.skill)){
      if(!zeitenHier.has(e.skill)) zeitenHier.set(e.skill, []);
      zeitenHier.get(e.skill)!.push(e.t);
    }
    const teile: { n: number; skill: string; sid: string }[] = [];
    let von = Infinity, bis = -Infinity;
    for(const [name, zeiten] of zeitenDort){
      const w = weaponFor(name, sidVon.get(name));
      if(w === "Unassigned" || w === "Passive") continue;
      const normal = zeitenHier.get(name) || [];
      if(!abklingfaehig(einsaetze(normal.concat(zeiten)))) continue;
      const fenster = DEAD_TIME * 1000;
      let n = 0;
      for(const c of einsaetze(zeiten)){
        if(normal.some(t => t >= c.t - fenster && t <= c.last + fenster)) continue;
        const st = strecken.find(u => c.t - seg.start >= u.von && c.t - seg.start <= u.bis);
        if(!st) continue;
        n++; von = Math.min(von, st.von); bis = Math.max(bis, st.bis);
      }
      if(n) teile.push({n, skill: name, sid: sidVon.get(name) || ""});
    }
    if(teile.length && von <= bis){
      teile.sort((a, b) => b.n - a.n);
      out.push({key:"invulnCasts", vars:{
        teile, n: teile.reduce((x, p) => x + p.n, 0),
        from: clock(von / 1000), to: clock(bis / 1000)
      }});
    }
  }

  if(seg.ventius){
    const m = ventiusMix(seg);
    if(m.shaped >= 3){
      /* Counted per enemy, not per press: one volley that reaches three
         enemies is read three times here, once for each, because where you
         stood is a question about the enemy you were standing at. That is a
         different number from the press count the rhythm finding shows on
         the same screen - 8 against 29 on one raid fight - so this one says
         "volleys on <enemy>" where that one says "casts", and names the
         enemy it counted them on. */
      out.push({key:"ventiusPos", vars:{
        good: m.atTop, total: m.shaped, off: m.shaped - m.atTop,
        // the casts the shape test threw out, said out loud rather than
        // quietly left out of a denominator
        unread: m.off, target: m.target,
        waves: m.top, hits: m.top * 3 + 1,
        // what this target has ever allowed, which is the only way the finding
        // can say "there was more in it" to someone who stood badly all pull
        cap: m.cap, capHits: m.cap * 3 + 1, capSeen: m.capAt,
        share: pct(m.atTop/m.shaped, 0), q: m.atTop/m.shaped,
        // Eine Nachbebenzahl je Salve, in der Reihenfolge der Einsaetze, 0
        // fuer eine unlesbare: so lang wie casts, alle Salven auf dem Ziel.
        folge: m.folge, casts: m.casts, treffer: m.hits
      }});
    }
  }

  /* --- what went into a shield ------------------------------------
     Only on a fight that had any, which is one in ten in the sample
     raid log - and the only place where the load-bearing sentence, that
     nothing is deducted, is on screen rather than inside a tooltip.
     The skill is picked by shield DAMAGE, not by its own share: on the
     reference fight Beschuss put 42% of its own damage into the shield
     and Auge von Ventius 11%, but in absolute terms that is 98.188
     against 982.449, and the second is the answer to "what went in". */
  if(s.shieldHits){
    // a party member's skill carries no shield figure: that is none
    const worstSkill = s.skills.filter(k => (k.shieldDmg ?? 0) > 0)
      .sort((a,b) => (b.shieldDmg ?? 0) - (a.shieldDmg ?? 0))[0];
    const onTarget = s.targets.filter(x => x.shieldDmg > 0)
      .sort((a,b) => b.shieldDmg - a.shieldDmg)[0];
    // shieldDmg is null only without a hit-type column, and then so is shieldHits
    const shieldDmg = s.shieldDmg!;
    out.push({key:"shield", vars:{
      dmg: fmt(shieldDmg), hits: s.shieldHits,
      share: pct(shieldDmg/(s.total||1), 1),
      target: onTarget ? onTarget.name : "—",
      skill: worstSkill ? worstSkill.name : null,
      sid: worstSkill ? (skillIds(seg).get(worstSkill.name)||new Set()).values().next().value || "" : "",
      skillDmg: worstSkill ? fmt(worstSkill.shieldDmg) : "—"
    }});
  }

  /* Die Leerzeit ist seit der Neugestaltung (28.09., Luecken 4.3) kein
     Befund dieser Liste mehr: die Analyse zaehlt Luecken nach dem Median
     (luecken, ../analyse-core.ts) und nennt sie unter "Weitere Befunde". */
  return out;
}

/* weapon roll-up */
/* every skill id seen for a skill name, in this fight */
export function skillIds(seg: Fight){
  const m = new Map();
  for(const e of seg.events){
    if(!e.sid) continue;
    let s = m.get(e.skill); if(!s){ s = new Set(); m.set(e.skill, s); }
    s.add(e.sid);
  }
  return m;
}
function autoWeapon(name: string, sid?: string){
  if(typeof SKILL_WEAPON === "undefined") return null;
  // a known id first, then the same skill name under a new rank id
  return (sid && SKILL_WEAPON[sid])
      || (typeof weaponByName === "function" ? weaponByName(name) : null)
      || null;
}
export function weaponFor(name: string, sid?: string){
  // your own assignment always wins; the measured table only fills gaps
  return (sid && state.weaponById[sid]) || state.weaponOf[name]
      || autoWeapon(name, sid) || "Unassigned";
}
export function isAutoWeapon(name: string, sid?: string){
  const mine = (sid && state.weaponById[sid]) || state.weaponOf[name];
  return !mine && !!autoWeapon(name, sid);
}
export function setWeapon(name: string, ids: string[], weapon: string){
  if(weapon === "Unassigned"){
    delete state.weaponOf[name];
    (ids||[]).forEach(i => delete state.weaponById[i]);
  } else {
    state.weaponOf[name] = weapon;
    (ids||[]).forEach(i => { state.weaponById[i] = weapon; });
  }
}
export function byWeapon(seg: Fight){
  // Split per event, not per skill name. One name can belong to two weapons —
  // Basic Shot is on both Longbow and Crossbow, Manaball on Wand and Staff —
  // and taking the first id would dump every hit into just one of them.
  const m = new Map();
  const seenSkills = new Map();
  for(const ev of seg.events){
    const w = weaponFor(ev.skill, ev.sid);
    let e = m.get(w);
    if(!e){ e = {name:w, damage:0, hits:0, crit:0, heavy:0, skills:0}; m.set(w, e); }
    e.damage += ev.dmg; e.hits++;
    if(ev.crit) e.crit++;
    if(ev.heavy) e.heavy++;
    let set = seenSkills.get(w);
    if(!set){ set = new Set(); seenSkills.set(w, set); }
    set.add(ev.skill);
  }
  for(const [w, set] of seenSkills){ m.get(w).skills = set.size; }
  const list = [...m.values()].sort((a,b)=>b.damage-a.damage);
  list.forEach((w,i) => { w.color = seriesColor(i); w.dps = w.damage/rateSecs(seg); });
  return list;
}

/* a saved run: everything compare needs, nothing it doesn't */
export function summarise(seg: Fight, tag: string, note?: string){
  const s = seg.stats;
  const ids = skillIds(seg);
  return {
    id: "run"+(state.runSeq++),
    name: s.name, tag: tag || "", note: note || "",
    when: state.wall ? seg.start : null,
    // carried, so a run saved from a clockless log cannot launder the
    // fabrication into the sidebar and the Vergleich table later
    noTime: !!state.noTime,
    seconds: s.seconds, total: s.total, dps: s.dps, hits: s.hits,
    critRate: s.critRate, critDmgShare: s.critDmgShare, heavyRate: s.heavyRate,
    avg: s.avg, max: s.max, dead: s.dead, worstGap: s.worstGap,
    mainWeapon: state.mainWeapon || "", offWeapon: state.offWeapon || "",
    skills: s.skills.map(k => ({
      name:k.name, damage:k.damage, hits:k.hits, crit:k.crit, heavy:k.heavy, max:k.max, dps:k.dps,
      casts:(casts(seg).get(k.name)||[]).length,
      sid: [...(ids.get(k.name)||[])][0] || "",
      // the weapon this skill belonged to, frozen at save time — so an old
      // run keeps its own true split even if you later reassign weapons
      weapon: weaponFor(k.name, [...(ids.get(k.name)||[])][0])
    })),
    windows: windows(seg, 15).map(w => ({from:w.from, to:w.to, dps:w.dps, damage:w.damage})),
    perSecond: perSecond(seg, 0).total,
    /* Zwei Reihen und eine Zahl, damit ein geschnittener Lauf nicht mehr
       raten muss. hitsPerSecond ist in denselben ganzen Sekunden gebucht wie
       perSecond, clip() schneidet also beide an derselben Stelle.
       fought ist die Kampfzeit OHNE die Pausen zwischen zusammengefassten
       Teilen - dieselbe Zahl, durch die stats() teilt. Wo die Pausen liegen,
       steht nirgends mehr; dass es welche gibt, sagt fought < seconds, und
       mehr braucht clip() nicht, um zu wissen, wann es eine Rate nicht
       verantworten kann.
       Ein Lauf, der vor dieser Fassung gespeichert wurde, hat beides nicht.
       Dann bleibt die alte Hochrechnung, und die Zeile sagt das. */
    hitsPerSecond: perSecond(seg, 0).hits,
    fought: (seg.fought == null ? seg.end - seg.start : seg.fought) / 1000
  };
}

/* cut a run down to its first N seconds so two tests are read on equal terms */
export function clip(run: SavedRun, seconds: number){
  if(!seconds || run.seconds <= seconds) return run;
  const keep = Math.round(seconds);
  const ps = run.perSecond.slice(0, keep);
  const total = ps.reduce((a,b)=>a+b,0);
  const ratio = run.total ? total/run.total : 1;
  /* Gezaehlt, wenn die Reihe da ist, sonst hochgerechnet und gekennzeichnet.
     estCounts entscheidet nur, ob die Zeile im Vergleich einen Hinweis traegt
     und ob sie einen Sieger kuert - der Wert selbst steht in beiden Faellen
     da, die Hausregel nimmt keinen Wert weg. */
  const hps = Array.isArray(run.hitsPerSecond) ? run.hitsPerSecond : null;
  const hits = hps ? hps.slice(0, keep).reduce((a,b) => a+b, 0)
                   : Math.round(run.hits*ratio);
  /* Die Rate kann geschnitten nur stimmen, wenn der Kampf keine Loecher hat:
     ungeschnitten teilt stats() durch fought, hier wird durch keep geteilt,
     und das sind bei einem zusammengefassten Kampf zwei verschiedene Zahlen.
     Im eigenen Log: Sluggish Zombie 41,2 s Uhrzeit, 20,6 s gekaempft.
     Wo die Loecher liegen, weiss ein gespeicherter Lauf nicht - also wird die
     Zeile gekennzeichnet, statt eine Zahl zu drucken, hinter der sie nicht
     steht. Ein Lauf ohne Loecher ist davon nicht betroffen. */
  const hatLoecher = Number.isFinite(run.fought) && run.fought < run.seconds - 0.5;
  return {
    ...run, clipped:true, seconds:keep, total, dps: total/keep,
    estCounts: !hps, estRate: hatLoecher,
    hits,
    skills: run.skills.map(k => ({...k, damage:k.damage*ratio, dps:k.damage*ratio/keep,
                                  hits:Math.round(k.hits*ratio), casts:Math.round(k.casts*ratio)})),
    /* Die Zeilen je Faehigkeit bleiben hochgerechnet: die Reihe oben zaehlt
       die Treffer des ganzen Kampfes, nicht die je Faehigkeit. Sie tragen
       denselben Hinweis wie die Gesamtzeile. */
    windows: run.windows.filter(w => w.from < keep),
    perSecond: ps
  };
}

/* ---------- fight facts ----------
   Concrete, checkable facts about the fight as the log actually recorded
   it — the kind of thing you'd want to know before comparing two pulls.
   Everything here is derived, nothing is estimated: if the log can't
   support a number, that number is simply absent rather than guessed. */
export function fightFacts(seg: Fight){
  const s = seg.stats;
  const ev = seg.events;
  const secs = s.seconds || 1;

  // damage concentration — how much of the fight rode on a few skills
  const sorted = s.skills.slice().sort((a,b) => b.damage - a.damage);
  const top1 = sorted[0] ? sorted[0].damage / (s.total||1) : 0;
  const top3 = sorted.slice(0,3).reduce((a,k) => a + k.damage, 0) / (s.total||1);

  // the best and worst 15s stretches, so a pull can be judged on more
  // than its average
  /* Full windows only, because a part-window is a shorter stretch and its
     rate is not comparable - but that also means a fight of 15 to 30 seconds
     has exactly ONE of them, and one window cannot swing. It used to be read
     as both the best and the weakest and the line underneath said "the fight
     swung 1.0x between them: 82.8k at best, 82.8k at worst" - about a table
     whose other row, marked as a part, read 211.5k. Two of the thirteen
     fights in the raid log said that. Below two windows there is nothing to
     compare and the sentence is left out. */
  const ws = windows(seg, 15).filter(w => !w.partial);
  const bestWin = ws.length > 1 ? ws.reduce((a,b) => b.dps > a.dps ? b : a) : null;
  const worstWin = ws.length > 1 ? ws.reduce((a,b) => b.dps < a.dps ? b : a) : null;

  // Uptime: second-buckets where at least one hit landed, against the number
  // of buckets the fight spans. Both halves have to be counted the same way.
  // The denominator used to be the raw fractional length, so a 57.4s fight —
  // which spans buckets 0..57, that is 58 of them — reported "58 of 57".
  // Math.min(1, …) hid it in the percentage but the note printed it plainly.
  const activeSecs = new Set();
  for(const e of ev) activeSecs.add(Math.floor((e.t - seg.start)/1000));
  const spanSeconds = Math.max(1, Math.ceil(secs));
  const uptime = Math.min(1, activeSecs.size / spanSeconds);

  // opener: the first 15 seconds, which is where burst windows live
  const openEnd = seg.start + 15000;
  const openEvents = ev.filter(e => e.t <= openEnd);
  const openDmg = openEvents.reduce((a,e) => a + e.dmg, 0);
  const openSecs = Math.min(15, secs);

  // how many distinct enemies took damage, and the split
  const byTarget = new Map();
  for(const e of ev) byTarget.set(e.target, (byTarget.get(e.target)||0) + e.dmg);
  const targets = [...byTarget.entries()].sort((a,b) => b[1]-a[1])
    .map(([name, dmg]) => ({name, damage:dmg, share: dmg/(s.total||1)}));

  return {
    top1, top3, topSkill: sorted[0] ? sorted[0].name : null,
    bestWin, worstWin,
    swing: (bestWin && worstWin && worstWin.dps) ? bestWin.dps / worstWin.dps : null,
    uptime, activeSeconds: activeSecs.size, spanSeconds,
    openDps: openSecs ? openDmg/openSecs : 0, openDamage: openDmg,
    openVsAverage: s.dps ? (openSecs ? (openDmg/openSecs)/s.dps : 0) : 0,
    targets, targetCount: targets.length,
    hitsPerSecond: s.hits/rateSecs(seg),
  };
}
