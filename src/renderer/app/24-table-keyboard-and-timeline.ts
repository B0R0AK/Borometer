import { SERIES_N, state } from "./01-state";
import { axisNum, fmt } from "./03-helpers";
import { t } from "./08-translation";
import { gapsOf, unverwundbarOf } from "./15-weapons-and-ventius";
import {
  paintGaps, paintInvuln, paintMech, paintWeak, pctOf, perSecond, schwaechstesFenster, secs1
} from "./16-fight-analysis";
import { $, clock, cssv, fit } from "./18-interface-basics";
import {
  glaetten, monotonSteigungen, renderStackGut, setStackHit, stackHit
} from "./22-timeline-smoothing";
import { ACHSE_RAND, achsenBreite, achsenPxs, rotWindow } from "./25-rotation";
import { clampUiZoom } from "./37-window-size-and-overlay";
import { syncViewBars } from "./39-themes";
import { spurAbschnitt } from "./42-party";
import { deineRotVergessen, leisteBis } from "./54-deine-rotation";
import { mechanikStrecken } from "./61-mechanik";
import type { Fight } from "../types";

/* ---------- Tastatur in der Schadenstabelle ----------
   Die Rolle treegrid verspricht Pfeiltasten. Sie war da, die Tasten
   nicht: dreizehn Zeilen und 108 Zellen, und wer sie benutzt, kam nur
   mit der Tabulatortaste durch - Zeile fuer Zeile, quer durch die
   ganze Anwendung.

   Ein Tabstopp fuer den Kasten, innen die Pfeiltasten. Rechts klappt
   eine geschlossene Zeile auf und geht bei einer offenen ins Kind;
   links klappt zu und geht sonst zur Zeile darueber. Pos1 und Ende an
   die Enden. Enter und Leertaste klappten schon vorher auf. */
const barsZeilen = () => {
  const box = $("#bars");
  return box ? [...box.querySelectorAll<HTMLElement>(".row")] : [];
};
export function barsRoving(){
  const zeilen = barsZeilen();
  if(!zeilen.length) return;
  const hier = zeilen.indexOf(document.activeElement as HTMLElement);
  zeilen.forEach((z, i) => { z.tabIndex = i === (hier >= 0 ? hier : 0) ? 0 : -1; });
}
function barsFokus(zeile: HTMLElement | null | undefined){
  if(!zeile) return;
  barsZeilen().forEach(z => { z.tabIndex = -1; });
  zeile.tabIndex = 0;
  zeile.focus();
}
/* Die Zeile darueber, eine Ebene hoeher - das ist der Elternknoten. */
function barsEltern(zeilen: HTMLElement[], i: number){
  const stufe = +(zeilen[i]!.getAttribute("aria-level") || 1);
  for(let k = i - 1; k >= 0; k--){
    if(+(zeilen[k]!.getAttribute("aria-level") || 1) < stufe) return zeilen[k];
  }
  return null;
}

/* Was gerade unter dem Mauszeiger liegt - als Sekundenindex, nicht als
   Pixel. null heisst: nichts. */
export let stackMarke: number | null = null;
// an import cannot be assigned to - the tooltip sets it through this
export function setStackMarke(v: number | null){ stackMarke = v; }

/* Was die beiden Diagramme geschrieben haben, wieder wegnehmen.
   Ein blosses "return" ohne Kampf reicht nicht: dann bleibt stehen, was der
   letzte Kampf hinterlassen hat. Beim Analyse-Reiter war das einmal ein
   Urteilskasten mit den Zahlen eines geloeschten Kampfes; hier war es der
   Satz ueber die schwaechste Stelle, samt Uhrzeit und DPS. */
export function zeitLeeren(){
  /* Auch die Bedienreihen. Nach dem Leeren standen Spuren, Glaettung,
     Zoom und der Zeitbereich weiter da - Knoepfe fuer ein Bild, das es
     nicht gibt. Sie kommen zurueck, sobald wieder ein Abschnitt da ist. */
  // Trainer und Leinwand der Rotation entfallen (Spezifikation 3); der Strich beim Abspielen (Aufgabe 10) geht mit
  kopfMs = null;
  ["stackCtl", "rotCtl", "rotWhoBar", "stackKopf", "deineRot"].forEach(id => {
    const el = $("#" + id); if(el) el.hidden = true;
  });
  document.querySelectorAll<HTMLElement>(".viewbar").forEach(b => { b.hidden = true; });
  ["stackDesc", "stackNote"].forEach(id => {
    const el = $("#" + id); if(el) el.textContent = "";
  });
  ["stackShowAll", "rotShowAll"].forEach(id => {
    const el = $("#" + id); if(el) el.hidden = true;
  });
  ["stack", "stackLanes"].forEach(id => {
    const cv = $<HTMLCanvasElement>("#" + id);
    if(!cv) return;
    cv.getContext("2d")!.clearRect(0, 0, cv.width, cv.height);
    /* Nicht nur die Pixel loeschen: die Leinwand behaelt sonst ihre Hoehe,
       und uebrig bleibt eine leere Flaeche von ueber 500 Punkten. Beides
       muss weg - renderStack setzt die Hoehe als Merkmal UND als
       Stilangabe, und die Stilangabe gewinnt. */
    cv.height = 0;
    cv.style.height = "";
  });
  ["stackGut", "rotBar", "drGed", "drAuto"].forEach(id => {
    const el = $("#" + id); if(el) el.innerHTML = "";
  });
  // die Leiste von "Deine Rotation" samt Spalte vergisst, was sie gesetzt hatte, sonst baute sie nicht neu
  deineRotVergessen();
  /* Die Von/bis-Felder gehoeren dem Kampf, nicht dem Fenster. Nach dem
     Leeren standen dort weiter Anfang und Ende des geloeschten. */
  document.querySelectorAll<HTMLElement>(".viewbar").forEach(bar => {
    const f = bar.querySelector<HTMLInputElement>(".vfrom"), to = bar.querySelector<HTMLInputElement>(".vto");
    if(f && document.activeElement !== f) f.value = "";
    if(to && document.activeElement !== to) to.value = "";
  });
}
/* Wo die Achse des Zeitverlaufs endet, in s: am Ende des Fensters - ohne
   "bis" unter Live am Ende der Zeitleiste, die mit Vorlauf mehr als den
   Kampf zeigt (leistenDauer, 54). So zeichnen beide auf dieselbe Achse
   (Aufgabe 10). */
export function stackEnde(seg: Fight): number {
  const {b} = rotWindow(seg), l = leisteBis(seg);
  return state.rotTo == null && l != null ? Math.max(b, l) : b;
}

/* Der gestapelte Zeitverlauf: seit Aufgabe 10 (Nachtrag 29.09.) im Bereich
   Rotation unter der Zeitleiste, auf derselben Achse (25-rotation.ts,
   ACHSE_RAND, achsenBreite). Gibt das Ende der Achse zurueck, auf die er
   gezeichnet hat, ohne Kampf oder Uhr null. Wessen Kampf er zeigt, waehlt
   die Reihe ueber der Rotation (#rotWho) fuer beide. */
export function renderStack(): number | null {
  const seg = spurAbschnitt();
  if(!seg){ zeitLeeren(); return null; }
  $("#stackCtl").hidden = false;
  document.querySelectorAll<HTMLElement>(".viewbar").forEach(b => { b.hidden = false; });
  if(state.noTime) return null;   // the panel says why
  /* Zwoelf Reihen tragen eine eigene Farbe - dieselben, die auch die
     Tabelle und die Rotation faerben. Ein Skill hat in der ganzen App
     eine Farbe. */
  const ps = perSecond(seg, SERIES_N);
  const sidOf = new Map();
  for(const e of seg.events) if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);
  ps.series.forEach(s => { s.sid = sidOf.get(s.name); });
  if(state.stackOff.size >= ps.series.length) state.stackOff.clear();

  const cv = $<HTMLCanvasElement>("#stack"), lv = $<HTMLCanvasElement>("#stackLanes"), box = $("#stackScroll");
  const {a, b: bis} = rotWindow(seg);
  const b = stackEnde(seg);
  const span = b - a;
  const gaps = gapsOf(seg);
  const unverwundbar = unverwundbarOf(seg);
  // die erkannte Mechanik des Bosses in diesem Pull (61-mechanik.ts), schraffiert
  const mechanik = mechanikStrecken(seg);

  /* Die Namensspalte: bis Aufgabe 10 so breit, wie der laengste Name und
     seine zwei Zahlen es verlangten (hoechstens 38 Prozent der Karte). Seit
     Aufgabe 10 (Nachtrag 29.09.) bestimmt sie auch, wie breit die Zeitleiste
     darueber ist - und unter Live wachsen die Zahlen je Takt: jeder Punkt
     Breite baute die ganze Leiste neu, statt nur anzuhaengen, und eine andere
     Sprache verschob jeden Einsatz. Darum haengt sie nur noch an der Breite
     des Rasters: 26 Prozent, hoechstens 340 Punkt, mindestens 200 - ab
     760 Punkt Raster. Schmaler wird auch die Spalte schmaler (30 Prozent,
     mindestens 96: Symbol und der Anfang des Namens), damit der Leiste
     genug bleibt (Fixrunde 1: bei 560 Punkt Fenster frass sie 200 von 448).
     Leiste und Spuren teilen sich die Spalte daneben in jeder Breite; was
     laenger ist, kuerzt der Name mit Auslassung (.rotgz em, der title nennt
     ihn ganz). */
  const gesamtAlle = ps.series.reduce((x, sr) => x + sr.values.reduce((p, q) => p + q, 0), 0) || 1;
  const karte = $("#zvRaster");
  const ganz = karte ? karte.clientWidth : 900;
  /* Ganz schmal (unter 420 Punkt Raster, etwa 560 Punkt Fenster bei 150 %
     Groesse) bleibt nur das Symbol: die Spalte ist 44 Punkt breit, Namen und
     Koepfe treten zurueck (fuer den Vorleser bleiben sie, .zvraster.eng) -
     so behaelt die Leiste ihre 200 Punkt, und die x-Lage bleibt dieselbe. */
  const eng = ganz < 420;
  if(karte) karte.classList.toggle("eng", eng);
  const gutW = eng ? 44 : Math.round(ganz >= 760 ? Math.min(340, Math.max(200, ganz * 0.26)) : Math.max(96, ganz * 0.3));
  $("#stackGut").style.width = gutW + "px";

  // dieselbe Breite und derselbe Rand wie die Zeitleiste darueber (Aufgabe 10)
  const drawW = achsenBreite(box);
  const pad = {l: ACHSE_RAND, r: ACHSE_RAND, t: 14};
  const pxProSek = achsenPxs(drawW, span);
  const X = (t: number) => pad.l + (t - a) * pxProSek;

  const zeigen = ps.series.filter(sr => !state.stackOff.has(sr.name));
  const roh = new Array(ps.T).fill(0);
  for(const sr of zeigen) for(let i = 0; i < ps.T; i++) roh[i] += sr.values[i];
  const glatt = wirksameGlaettung(ps.T);
  const kurve = glaetten(roh, glatt);

  /* Die Kurve bekommt die Hoehe, die das Fenster hergibt, die Spuren eine
     feste je Zeile. Zusammen ist die Tafel hoeher als der alte Stapel -
     dafuer steht keine Legende mehr darunter. */
  const uiz = clampUiZoom(state.zoom) / 100;
  const kurveH = Math.round(Math.max(128, Math.min(228, (innerHeight / uiz) * .22)));
  const SPUR = 25, ACHSE = 22;

  /* Die zwei Baender in der Kurve hatten keine Legende: ein rotes fuer
     Sekunden ohne Treffer, ein tuerkises fuer die schwaechste Stelle. Die
     Legende steht unter der Beschreibung der Kurve, und nur mit dem, was
     dieser Kampf auch zeigt. */
  const schwach = schwaechstesFenster(seg);
  renderStackGut(ps.series, kurveH + ACHSE, SPUR, gesamtAlle,
                 {luecke: gaps.length > 0, schwach: !!schwach, unverwundbar: unverwundbar.length > 0,
                  mechanik: mechanik.length > 0});

  cv.style.width = drawW + "px";
  lv.style.width = drawW + "px";
  const k = fit(cv, kurveH + ACHSE, drawW).ctx;
  const boden = kurveH - 6;
  const i0 = Math.max(0, Math.floor(a)), i1 = Math.min(ps.T, Math.ceil(b) + 1);
  let spitze = 1;
  for(let i = i0; i < i1; i++) spitze = Math.max(spitze, kurve[i] || 0);
  spitze *= 1.08;
  const Y = (v: number) => boden - (v / spitze) * (boden - pad.t);

  paintGaps(k, gaps, X, a, b, pad.t - 4, boden);
  paintInvuln(k, unverwundbar, X, a, b, pad.t - 4, boden);
  paintMech(k, mechanik, X, a, b, pad.t - 4, boden);
  /* Die schwaechste Stelle, ueber Kurve und Spuren durchgehend, damit sie
     eine Zone ist und nicht zwei Streifen. */
  paintWeak(k, schwach, X, a, b, pad.t - 4, boden);

  /* Flaeche und Linie: eine Lichtquelle wie ueberall, der Verlauf faellt
     nach unten ins Nichts statt in eine zweite Farbe. */
  const g1 = k.createLinearGradient(0, pad.t, 0, boden);
  g1.addColorStop(0, cssv("--gold"));
  g1.addColorStop(1, "transparent");
  k.save();
  k.globalAlpha = .32; k.fillStyle = g1;
  k.beginPath();
  bahnDurch(k, kurve, X, Y, i0, i1);
  k.lineTo(X(Math.min(b, i1 - 1)), boden); k.lineTo(X(Math.max(a, i0)), boden);
  k.closePath(); k.fill();
  k.restore();
  k.strokeStyle = cssv("--gold"); k.lineWidth = 2; k.lineJoin = "round";
  k.beginPath(); bahnDurch(k, kurve, X, Y, i0, i1); k.stroke();
  k.lineWidth = 1;

  /* Der Schnitt des Kampfes - dieselbe Zahl, die die Kopfzeile zeigt.
     Ist etwas abgeschaltet, gilt der Schnitt des Gezeigten, und die
     Beschriftung sagt das auch. */
  const gezeigt = zeigen.reduce((x, sr) => x + sr.values.reduce((p, q) => p + q, 0), 0);
  const avg = state.stackOff.size
    ? gezeigt / Math.max(1, seg.stats.seconds) : (seg.stats.dps || 0);
  k.font = "11px " + cssv("--sans");
  if(avg > 0 && avg < spitze){
    const y = Math.round(Y(avg)) + .5;
    k.save(); k.setLineDash([5, 4]); k.strokeStyle = cssv("--avg-line");
    k.beginPath(); k.moveTo(X(a), y); k.lineTo(X(b), y); k.stroke(); k.restore();
    /* Auf einer Platte im Bild und nicht in der Gasse daneben: der Satz
       ist laenger als jede Gasse, die man dafuer freihalten koennte. */
    const txt = t(state.stackOff.size ? "timeline.avgShown" : "timeline.avgMark",
                  {dps: axisNum(avg)});
    k.textAlign = "right"; k.textBaseline = "alphabetic";
    const lw = k.measureText(txt).width;
    k.fillStyle = cssv("--canvas-chip");
    k.fillRect(X(b) - lw - 7, y - 8, lw + 6, 15);
    k.fillStyle = cssv("--canvas-chip-ink");
    k.fillText(txt, X(b) - 4, y + 4);
  }

  /* Die rohe Kurve als blasse Linie dahinter. Ohne sie muss man glauben,
     was die Glaettung weggenommen hat; mit ihr sieht man es. Sie liegt
     hinter der gezeichneten Kurve, ohne Fuellung und ohne Beschriftung -
     sie ist der Beleg, nicht die Aussage. Dieselbe Farbe wie die Kurve
     davor (--gold, die Gesamtzahl), nicht --series-1: das war nur Gold,
     solange Rang 1 golden war. */
  /* Der Massstab gehoert der geglaetteten Kurve, und die rohen Spitzen
     liegen darueber - bei Burst bis zum Doppelten. Sie liefen bisher ueber
     den Rand der Leinwand hinaus und wurden dort irgendwo abgeschnitten.
     Jetzt endet die Linie an derselben Oberkante wie die Baender (pad.t - 4),
     und wo sie darueber hinausgeht, steht dort ein kurzer Strich: "hier
     geht es weiter", statt einer Spitze, die so aussieht, als waere sie
     genau so hoch. Den Massstab nach den rohen Spitzen zu richten haette
     die Kurve - die Aussage - auf die halbe Hoehe gedrueckt. */
  if(glatt > 1){
    const oben = pad.t - 4;
    k.save();
    k.beginPath(); k.rect(0, oben, cv.width, boden - oben + 1); k.clip();
    k.strokeStyle = cssv("--gold");
    k.globalAlpha = .3; k.lineWidth = 1;
    k.beginPath();
    for(let i = i0; i < i1; i++){
      const x = X(i), y = Y(roh[i]);
      i === i0 ? k.moveTo(x, y) : k.lineTo(x, y);
    }
    k.stroke();
    k.globalAlpha = .7; k.fillStyle = cssv("--gold");
    for(let i = i0; i < i1; i++) if(Y(roh[i]) < oben) k.fillRect(Math.round(X(i)) - 2, oben, 4, 2);
    k.restore();
  }

  // die hoechste Sekunde im Bild, benannt
  let hi = -1, hiV = 0;
  for(let i = i0; i < i1; i++) if(kurve[i] > hiV){ hiV = kurve[i]; hi = i; }
  if(hi >= 0 && hiV > 0){
    const xs = X(hi), ys = Y(hiV);
    k.fillStyle = cssv("--gold");
    k.beginPath(); k.arc(xs, ys, 3.5, 0, 7); k.fill();
    k.strokeStyle = cssv("--well"); k.lineWidth = 1.5;
    k.beginPath(); k.arc(xs, ys, 3.5, 0, 7); k.stroke(); k.lineWidth = 1;
    k.fillStyle = cssv("--gold-ink"); k.textBaseline = "alphabetic";
    const rechts = xs > X(a) + (X(b) - X(a)) * .72;
    k.textAlign = rechts ? "right" : "left";
    /* Der Gipfel einer geglaetteten Kurve ist kein Messwert. Er traegt
       darum sein Mass mit sich. */
    const gipfel = glatt > 1
      ? axisNum(hiV) + " " + t("timeline.smoothMark", {n: glatt})
      : axisNum(hiV);
    k.fillText(gipfel, xs + (rechts ? -8 : 8), ys - 9);
  }

  /* Steht eine Sekunde breit genug im Bild, bekommt sie ihre Zahl - aber
     nur, wenn nicht geglaettet wird. Eine Zahl AN einer Sekunde neben
     einer ueber fuenf Sekunden gemittelten Kurve behauptet eine Messung,
     die es nicht gibt. Weil die Deckelung kurze Kaempfe ohnehin roh
     laesst, stehen die Zahlen genau dort, wo sie hingehoeren. */
  if(pxProSek >= 34 && glatt === 1){
    /* 11 statt 10 Punkte: 10 liegt unter dem Boden, den die App sonst
       ueberall einhaelt, und Text in einer Leinwand laesst sich nicht
       nachtraeglich vergroessern. */
    k.fillStyle = cssv("--ink-soft"); k.font = "11px " + cssv("--sans");
    k.textAlign = "center";
    for(let i = i0; i < i1; i++){
      if(!(kurve[i] > 0) || i === hi) continue;
      k.fillText(axisNum(kurve[i]), X(i), Y(kurve[i]) - 5);
    }
    k.font = "11px " + cssv("--sans");
  }

  /* Die staerksten drei Sekunden, unter der Grundlinie. Dasselbe Fenster,
     das die Analyse "staerkste drei Sekunden" nennt - ein zweites Mass
     waere ein Wort fuer zwei Dinge. */
  let best = null;
  if(ps.T >= 6){
    const wsec = 3; let bi = 0, bv = -1;
    for(let i = 0; i + wsec <= ps.T; i++){
      let v = 0; for(let j = i; j < i + wsec; j++) v += ps.total[j];
      if(v > bv){ bv = v; bi = i; }
    }
    if(avg > 0 && bv / wsec >= avg * 1.25) best = {from: bi, to: bi + wsec};
  }
  if(best && best.to > a && best.from < b){
    const xa = Math.max(X(a), X(Math.max(best.from, a)));
    const xb = Math.min(X(b), X(Math.min(best.to, b)));
    if(xb > xa){
      k.fillStyle = cssv("--gold");
      if(k.roundRect){
        k.beginPath(); k.roundRect(xa, boden + 3, Math.max(3, xb - xa), 3, 1.5); k.fill();
      } else k.fillRect(xa, boden + 3, Math.max(3, xb - xa), 3);
    }
  }

  /* die Zeitachse, eine fuer Kurve, Spuren und - seit Fixrunde 1 zu Aufgabe 10 - die Zeitleiste
     darueber; was sie beschriftet, steht fuer Pruefungen als data-achse an der Leinwand */
  const step = [1, 2, 5, 10, 15, 30, 60, 120, 300].find(x => x * pxProSek >= 64) || 600;
  const first = Math.ceil(a / step) * step;
  const beschriftet: string[] = [];
  k.fillStyle = cssv("--ink-faint"); k.textAlign = "center";
  for(let tt = first; tt <= b; tt += step){
    k.strokeStyle = cssv("--canvas-rule");
    k.beginPath(); k.moveTo(Math.round(X(tt)) + .5, boden);
    k.lineTo(Math.round(X(tt)) + .5, boden + 4); k.stroke();
    k.fillText(clock(tt), X(tt), kurveH + ACHSE - 6);
    beschriftet.push(clock(tt));
  }
  cv.dataset.achse = beschriftet.join(" ");

  /* Die laengsten drei Aussetzer sagen ihre Laenge - ueber der Kurve, wo
     nichts steht, das sie zudecken koennte. */
  const lang = gaps.slice().sort((x, y) => y.len - x.len).slice(0, 3);
  k.textAlign = "center"; k.fillStyle = cssv("--ink-faint");
  for(const g of lang){
    if(!(g.to > a && g.from < b)) continue;
    const xa = Math.max(X(a), X(Math.max(g.from, a))), xb = Math.min(X(b), X(Math.min(g.to, b)));
    if(xb - xa < 34) continue;
    k.fillText(secs1(g.len), (xa + xb) / 2, pad.t + 8);
  }
  /* Eine Strecke, in der das Ziel unverwundbar war, sagt ihre Laenge an
     derselben Stelle wie eine Pause, dazu was sie ist ("Ziel unverwundbar
     \u00b7 38,0 s", Issue #37) - nur die Zahl, wenn der Satz nicht hineinpasst,
     und nichts, wenn nicht einmal die Zahl passt. */
  for(const g of unverwundbar){
    if(!(g.to > a && g.from < b)) continue;
    const xa = Math.max(X(a), X(Math.max(g.from, a))), xb = Math.min(X(b), X(Math.min(g.to, b)));
    const satz = t("timeline.invulnLen", {s: secs1(g.len)});
    const txt = k.measureText(satz).width + 12 <= xb - xa ? satz : xb - xa >= 34 ? secs1(g.len) : "";
    if(txt) k.fillText(txt, (xa + xb) / 2, pad.t + 8);
  }
  /* die Mechanik ebenso, in ganzen Sekunden wie in der Analyse - und auf
     derselben Pille wie dort (Grund der Flaeche, 4 Punkt Rand, gerundet;
     Feinschliff 02.10., Abschnitt 3): auf der Schraffur war die Zahl kaum
     zu lesen. Die Lage steht fuer Pruefungen als data-mechpille da. */
  const pillen: { x: number; y: number; w: number; h: number; text: string }[] = [];
  for(const g of mechanik){
    if(!(g.to > a && g.from < b)) continue;
    const xa = Math.max(X(a), X(Math.max(g.from, a))), xb = Math.min(X(b), X(Math.min(g.to, b)));
    const s = g.len + "\u00a0s", satz = t("mechanik.band", {s});
    const txt = k.measureText(satz).width + 12 <= xb - xa ? satz : xb - xa >= 34 ? s : "";
    if(!txt) continue;
    const mt = k.measureText(txt), cx = (xa + xb) / 2, y = pad.t + 8;
    const oben = mt.actualBoundingBoxAscent || 8, unten = mt.actualBoundingBoxDescent || 2;
    const p = {x: Math.round(cx - mt.width / 2 - 4), y: Math.round(y - oben - 2), w: Math.round(mt.width + 8),
               h: Math.round(oben + unten + 4), text: txt};
    k.fillStyle = cssv("--comb");
    k.beginPath();
    if(k.roundRect) k.roundRect(p.x, p.y, p.w, p.h, 2); else k.rect(p.x, p.y, p.w, p.h);
    k.fill();
    k.fillStyle = cssv("--dim");
    k.fillText(txt, cx, y);
    pillen.push(p);
  }
  cv.dataset.mechpille = JSON.stringify(pillen);

  /* ---------- die Spuren ---------- */
  const spurenH = ps.series.length * SPUR + 2;
  const s = fit(lv, spurenH, drawW).ctx;
  paintGaps(s, gaps, X, a, b, 0, ps.series.length * SPUR);
  paintInvuln(s, unverwundbar, X, a, b, 0, ps.series.length * SPUR);
  paintMech(s, mechanik, X, a, b, 0, ps.series.length * SPUR);
  paintWeak(s, schwach, X, a, b, 0, ps.series.length * SPUR);
  let gemeinsam = 1;
  const geglaettet = ps.series.map(sr => glaetten(sr.values, state.stackSmooth));
  for(const v of geglaettet) for(let i = i0; i < i1; i++) gemeinsam = Math.max(gemeinsam, v[i] || 0);
  ps.series.forEach((sr, idx) => {
    const v = geglaettet[idx]!;
    /* Eigene Spitze heisst: jede Spur zeigt ihre Form. Bei einer Spur mit
       0,0 % Anteil hiess es aber auch, dass drei Treffer auf volle Hoehe
       gezogen wurden und aussahen wie die Hauptfaehigkeit. Hoechstens
       fuenfzigfach gestreckt, gemessen an der gemeinsamen Spitze - was
       darunter liegt, bleibt so klein, wie es ist. Zehnfach war zu streng:
       im Beispiel lagen dann schon die Spuren um 1 % flach, und die beiden
       Knoepfe zeigten fast dasselbe Bild. */
    let eigen = Math.max(1, gemeinsam / 50);
    for(let i = i0; i < i1; i++) eigen = Math.max(eigen, v[i] || 0);
    const hoch = state.stackScale === "gleich" ? gemeinsam : eigen;
    const y0 = idx * SPUR + SPUR - 3;
    const YY = (x: number) => y0 - Math.min(1, x / hoch) * (SPUR - 7);
    s.strokeStyle = cssv("--canvas-rule");
    s.beginPath(); s.moveTo(X(a), Math.round(idx * SPUR) + .5);
    s.lineTo(X(b), Math.round(idx * SPUR) + .5); s.stroke();
    s.strokeStyle = cssv("--canvas-rule");
    s.beginPath(); s.moveTo(X(a), Math.round(y0) + .5);
    s.lineTo(X(b), Math.round(y0) + .5); s.stroke();
    const blass = state.stackOff.has(sr.name);
    s.save(); s.globalAlpha = blass ? .18 : .5;
    if(sr.rest) s.fillStyle = cssv("--series-rest"); else s.fillStyle = sr.color;
    s.beginPath(); bahnDurch(s, v, X, YY, i0, i1);
    s.lineTo(X(Math.min(b, i1 - 1)), y0); s.lineTo(X(Math.max(a, i0)), y0);
    s.closePath(); s.fill(); s.restore();
    s.save(); s.globalAlpha = blass ? .3 : 1;
    s.strokeStyle = sr.rest ? cssv("--series-rest") : sr.color; s.lineWidth = 1.25;
    s.beginPath(); bahnDurch(s, v, X, YY, i0, i1); s.stroke(); s.restore();
  });
  s.strokeStyle = cssv("--canvas-rule");
  s.beginPath(); s.moveTo(X(a), Math.round(ps.series.length * SPUR) + .5);
  s.lineTo(X(b), Math.round(ps.series.length * SPUR) + .5); s.stroke();

  /* Dieselben Felder wie bisher: das Hinweisfenster und der Klick-Zoom
     lesen daraus, und beide sollen unveraendert weiterlaufen. summe ist
     jetzt die geglaettete Kurve des Gezeigten - genau das, was gemalt
     wurde. */
  setStackHit({ps, x0: X(a), x1: X(b), a, b, bw: pxProSek,
               w: drawW, h: kurveH + ACHSE, seg,
               zeigen, glatt: zeigen.map(sr => glaetten(sr.values, glatt)),
               summe: kurve, anteilModus: false, smooth: glatt,
               X, hoehe: kurveH + ACHSE + spurenH});
  stackStrich();
  stackKopfZeigen();
  syncViewBars(a, bis);

  /* Der Satz sagt, was das Bild ist und was daran eingestellt ist. Eine
     geglaettete Kurve ist lesbarer, aber nicht mehr die rohe Wahrheit. */
  /* Gesagt wird, was wirklich gerechnet wurde - und wenn die Einstellung
     dafuer gedeckelt wurde, warum. */
  /* Ein Satz ueber die Daten, nicht zwei: was das Bild ist und wie stark
     es geglaettet ist, in einem. Vorher stand davor noch "Hier siehst
     du ...", und die Glaettung folgte als eigener Satz. */
  const wieGlatt = glatt > 1
    ? t("timeline.descSmooth", {n: glatt})
    : (state.stackSmooth > 1
        ? t("timeline.descRawShort", {n: state.stackSmooth, s: secs1(seg.stats.seconds || ps.T)})
        : t("timeline.descRaw"));
  const wasFehlt = state.stackOff.size
    ? " " + t("timeline.hidden", {n: state.stackOff.size,
        pct: pctOf(100 * gezeigt / Math.max(1, seg.stats.total || 1), 0)})
    : "";
  $("#stackDesc").textContent = wieGlatt + wasFehlt;
  /* Der Satz sagt, welches der beiden Felder welches ist - und sagt es mit
     der Uhrzeit, damit man es nicht an der Farbe festmachen muss. Steht nur
     da, wenn die Stelle auch im Bild liegt.
     Die Bedienung (Mausrad, Leiste, Klick, Tastatur) stand hier als
     Absatz von acht Zeilen hinter diesem Satz und las sich bei jedem Kampf
     mit. Sie liegt jetzt hinter "Hilfe" in der Zoomzeile und in den title
     der Knoepfe; hier bleibt, was die Daten sagen. */
  const schwachDrin = schwach && schwach.bis > a && schwach.von < b;
  $("#stackNote").textContent =
    schwachDrin ? t("timeline.footWeak", {from: clock(schwach.von),
       to: clock(schwach.bis), dps: fmt(schwach.dps)}) : "";
  $("#stackShowAll").hidden = state.stackOff.size === 0;
  return b;
}

/* Wie stark auf DIESEM Kampf wirklich geglaettet wird. Die Einstellung
   des Nutzers bleibt stehen; sie wird nur gedeckelt, wenn der Kampf zu
   kurz dafuer ist. Ein Sechstel der Laenge ist die Grenze: bei 30 s sind
   die vollen 5 s erlaubt, bei 8 s bleibt 1 s, also roh. Ohne die Deckelung
   mittelte die Vorgabe auf einem 5,5-Sekunden-Kampf ueber fast den ganzen
   Kampf und schrieb das Ergebnis als Gipfelwert ans Diagramm. */
function wirksameGlaettung(T: number){
  return Math.max(1, Math.min(state.stackSmooth || 1, Math.floor(T / 6) || 1));
}

/* Eine Bahn durch die geglaetteten Werte, monoton kubisch - sie geht durch
   jeden Messwert und schwingt zwischen zweien nicht ueber. Gezeichnet wird
   nur das Fenster, das im Bild steht. */
function bahnDurch(ctx: CanvasRenderingContext2D, v: number[], X: (i: number) => number, Y: (v: number) => number, i0: number, i1: number){
  const n = i1 - i0;
  if(n <= 0) return;
  if(n === 1){ ctx.moveTo(X(i0), Y(v[i0]!)); ctx.lineTo(X(i0), Y(v[i0]!)); return; }
  const teil = v.slice(i0, i1);
  const m = monotonSteigungen(teil);
  ctx.moveTo(X(i0), Y(teil[0]!));
  for(let i = 0; i < n - 1; i++){
    for(let q = 1; q <= 4; q++){
      const tt = q / 4;
      const h00 = 2*tt*tt*tt - 3*tt*tt + 1, h10 = tt*tt*tt - 2*tt*tt + tt;
      const h01 = -2*tt*tt*tt + 3*tt*tt, h11 = tt*tt*tt - tt*tt;
      ctx.lineTo(X(i0 + i + tt),
                 Y(h00*teil[i]! + h10*m[i]! + h01*teil[i+1]! + h11*m[i+1]!));
    }
  }
}

/* Der Kopf beim Abspielen (Aufgabe 10): die Zeitleiste setzt ihn mit der
   Kampfzeit (54, anwenden), er steht als 2-Punkt-Strich in --rot-kopf ueber
   Kurve und Spuren - an derselben Stelle wie ihr Kopf, weil beide auf
   derselben Achse zeichnen. null: kein Kopf (unter drei Einsaetzen, ohne
   Block). Ausserhalb der gezeichneten Flaeche steht er nicht, sonst rollte
   der Zeitverlauf weiter als die Zeitleiste. */
let kopfMs: number | null = null;
export function setzeStackKopf(ms: number | null){
  kopfMs = ms;
  stackKopfZeigen();
}
function stackKopfZeigen(){
  const el = $("#stackKopf");
  if(!el) return;
  const x = kopfMs == null || !stackHit ? NaN : stackHit.X(kopfMs / 1000);
  const weg = !(x >= 0 && x <= (stackHit?.w ?? 0));
  if(el.hidden !== weg) el.hidden = weg;
  if(weg) return;
  const t = "translateX(" + x.toFixed(1) + "px)", h = stackHit!.hoehe + "px";
  if(el.style.transform !== t) el.style.transform = t;
  if(el.style.height !== h) el.style.height = h;
}

/* Der Strich unter der Maus. Er liegt als eigenes Element ueber den zwei
   Leinwaenden, damit eine Mausbewegung nicht das ganze Bild neu malt. */
export function stackStrich(){
  const el = $("#stackMark");
  if(!el || !stackHit) return;
  if(stackMarke == null){ el.hidden = true; return; }
  el.hidden = false;
  el.style.left = Math.round(stackHit.X(stackMarke)) + "px";
  el.style.height = stackHit.hoehe + "px";
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  document.addEventListener("keydown", e => {
    if(e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement;
    /* Der Kopf: ein Tabstopp, links und rechts von Spalte zu Spalte, runter
       in die erste Zeile. Enter und Leertaste sortieren wie bisher. */
    const kopfZelle = el && el.closest && el.closest<HTMLElement>("#bars .bhead [tabindex]");
    if(kopfZelle){
      const kopf = [...$("#bars").querySelectorAll<HTMLElement>(".bhead [tabindex]")];
      const k = kopf.indexOf(kopfZelle);
      let nach: HTMLElement | undefined;
      if(e.key === "ArrowRight") nach = kopf[k + 1];
      else if(e.key === "ArrowLeft") nach = kopf[k - 1];
      else if(e.key === "Home") nach = kopf[0];
      else if(e.key === "End") nach = kopf[kopf.length - 1];
      else if(e.key === "ArrowDown"){ e.preventDefault(); barsFokus(barsZeilen()[0]); return; }
      else return;
      e.preventDefault();
      if(!nach) return;
      kopf.forEach(sp => { sp.tabIndex = -1; });
      nach.tabIndex = 0; nach.focus();
      return;
    }
    const zeile = el && el.closest && el.closest<HTMLElement>("#bars .row");
    if(!zeile) return;
    const zeilen = barsZeilen();
    const i = zeilen.indexOf(zeile);
    if(i < 0) return;
    const auf = zeile.getAttribute("aria-expanded");
    let ziel = null;
    switch(e.key){
      case "ArrowDown": ziel = zeilen[i + 1]; break;
      case "ArrowUp":
        // aus der ersten Zeile zurueck in den Kopf, auf den Tabstopp dort
        if(i === 0){
          const stopp = $("#bars").querySelector<HTMLElement>('.bhead [tabindex="0"]');
          if(stopp){ e.preventDefault(); stopp.focus(); return; }
        }
        ziel = zeilen[i - 1]; break;
      case "Home":      ziel = zeilen[0]; break;
      case "End":       ziel = zeilen[zeilen.length - 1]; break;
      case "ArrowRight":
        if(auf === "false"){ e.preventDefault(); zeile.click(); return; }
        if(auf === "true") ziel = zeilen[i + 1];
        break;
      case "ArrowLeft":
        if(auf === "true"){ e.preventDefault(); zeile.click(); return; }
        ziel = barsEltern(zeilen, i);
        break;
      default: return;
    }
    e.preventDefault();
    barsFokus(ziel);
  });
}
