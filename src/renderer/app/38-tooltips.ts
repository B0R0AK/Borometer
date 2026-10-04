import { state } from "./01-state";
import { factLine, fmt, full } from "./03-helpers";
import { t } from "./08-translation";
import { seriesLabel, skillLabel } from "./14-questlog-weapons";
import { gapAt, unverwundbarOf } from "./15-weapons-and-ventius";
import { pctOf, secs1 } from "./16-fight-analysis";
import { $, clock, esc } from "./18-interface-basics";
import { stackHit } from "./22-timeline-smoothing";
import { renderStack, setStackMarke, stackStrich } from "./24-table-keyboard-and-timeline";
import { renderRotation } from "./25-rotation";
import { artenZaehlung, artenZeile, einzigeSpur, uiZoomFactor } from "./37-window-size-and-overlay";
import { rotBarHit } from "./54-deine-rotation";
import { mechanikStrecken } from "./61-mechanik";
import type { RotationHit } from "../types";

/* ---------- tooltips ---------- */
// not $(): while this module loads, the one with $ may not have run yet
const tipEl = document.querySelector<HTMLElement>("#tip")!;
function showTip(x: number,y: number,html: string){
  tipEl.innerHTML = html; tipEl.classList.add("on");
  /* Alles in dieser Rechnung ist gemalt: x und y kommen aus clientX und
     clientY, innerWidth ist der sichtbare Ausschnitt, und
     getBoundingClientRect traegt die Groesseneinstellung. Gesetzt werden left
     und top dagegen in Layoutpunkten, denn .tip steht mit position:fixed
     innerhalb des gezoomten Dokuments. Die Rechnung bleibt deshalb ganz im
     gemalten Raum, und erst das Ergebnis wird einmal umgerechnet - dieselbe
     Regel wie in syncWindowVars(). */
  const z = uiZoomFactor();
  const r = tipEl.getBoundingClientRect();
  tipEl.style.left = (Math.min(innerWidth - r.width - 10, x + 14) / z)+"px";
  tipEl.style.top = (Math.max(8, y - r.height - 12) / z)+"px";
}
const hideTip = () => tipEl.classList.remove("on");

/* Der Zeiger kommt in gemalten Punkten, das Diagramm steht in Layoutpunkten:
   clientX und getBoundingClientRect tragen die Groesseneinstellung,
   stackHit.x0 und x1 nicht - fit() gibt w in Layoutpunkten zurueck. Im 1280er
   Fenster bei 200 Prozent steht x1 auf 568, und ein Zeiger an der rechten
   Kante liefert mx 1152: die rechte Haelfte des Diagramms fiel aus der
   Pruefung heraus und zeigte nichts, die linke zeigte die doppelt so spaete
   Sekunde. Der Zeiger wird deshalb durch die Einstellung geteilt, danach
   stehen beide Seiten in derselben Einheit. */
function stackZeiger(e: MouseEvent){
  if(!stackHit) return;
  /* Der Strich folgt der Maus ueber beide Leinwaende. Er steht auch dann,
     wenn das Hinweisfenster gleich wieder zumacht - sonst blinkt er an
     jeder Pause. */
  const rf = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const mxs = (e.clientX - rf.left) / uiZoomFactor();
  if(mxs >= stackHit.x0 && mxs <= stackHit.x1){
    setStackMarke(Math.floor(stackHit.a + (mxs - stackHit.x0)/stackHit.bw));
  } else setStackMarke(null);
  stackStrich();
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const mx = (e.clientX - r.left) / uiZoomFactor();
  if(mx < stackHit.x0 || mx > stackHit.x1){ hideTip(); return; }
  const sec = stackHit.a + (mx - stackHit.x0)/stackHit.bw;
  const i = Math.floor(sec);
  if(i < 0 || i >= stackHit.ps.T){ hideTip(); return; }
  // Inside a gap the per-second lines would all read zero, which is true and
  // useless. The band is a measured stretch, so it answers with its own
  // length and where it ran.
  const g = stackHit.seg && gapAt(stackHit.seg, sec);
  if(g){
    showTip(e.clientX, e.clientY, "<span>" + esc(t("timeline.gapTip",
      {s: secs1(g.len), a: clock(g.from), b: clock(g.to)})) + "</span>");
    return;
  }
  // Dasselbe fuer eine Strecke, in der das Ziel unverwundbar war (Issue #37)
  const u = stackHit.seg && unverwundbarOf(stackHit.seg).find(x => sec >= x.from && sec < x.to);
  if(u){
    showTip(e.clientX, e.clientY, "<span>" + esc(t("timeline.invulnTip",
      {s: secs1(u.len), a: clock(u.from), b: clock(u.to)})) + "</span>");
    return;
  }
  // und fuer eine erkannte Mechanik (Pruefung 01.10., N6)
  const m = stackHit.seg && mechanikStrecken(stackHit.seg).find(x => sec >= x.from && sec < x.to);
  if(m){
    showTip(e.clientX, e.clientY, "<span>" + esc(t("timeline.mechTip",
      {s: secs1(m.len), a: clock(m.from), b: clock(m.to)})) + "</span>");
    return;
  }
  /* Gelesen wird, was GEZEICHNET ist: geglaettet und ohne die
     abgeschalteten Reihen. Ein Lesefenster, das andere Zahlen nennt als
     die Kurve darunter zeigt, ist schlimmer als keines. */
  const gz = stackHit.zeigen || stackHit.ps.series;
  const gl = stackHit.glatt || gz.map(sr => sr.values);
  const gesamt = stackHit.summe ? stackHit.summe[i] : stackHit.ps.total[i];
  const parts = gz.map((sr, k) => ({n:sr.name, v:gl[k]![i]!, sid:sr.sid}))
    .filter(p => p.v >= 1).sort((p,q)=>q.v-p.v).slice(0,6);
  /* Die dritte Angabe sagt, dass die Zahl ein Mittelwert ist. Ohne sie
     stand eine sekundengenaue Uhrzeit ueber einer Zahl mit
     Tausenderpunkten - gemessen 88.360, waehrend in dieser Sekunde 13
     ankamen. */
  const kopf = factLine(stackHit.smooth > 1
    ? [clock(i), full(Math.round(gesamt)), t("timeline.smoothMark", {n: stackHit.smooth})]
    : [clock(i), full(Math.round(gesamt))]);
  /* Nur wenn genau eine Faehigkeit eingeschaltet ist. Sonst waere die
     Angabe entweder eine Mischung aus allen - die niemand gefragt hat -
     oder sie muesste je Faehigkeit dastehen und das Fenster sprengen. */
  const nurSkill = einzigeSpur(stackHit.ps.series.filter(sr => !sr.rest).map(sr => sr.name),
                               state.stackOff);
  /* Dasselbe Fenster, ueber das die Kurve mittelt - glaetten() nimmt
     i-h bis i+h mit h = (f-1)/2. Eine Aufteilung ueber eine einzelne
     Sekunde neben einem Fuenf-Sekunden-Mittel waere zweierlei Mass. */
  const h = ((stackHit.smooth || 1) - 1) / 2 | 0;
  /* Ein fremder Kampf bringt keine Trefferarten mit - seine Ereignisse
     sind nachgebaut, eines je Sekunde. Eine Aufteilung daraus waere
     erfunden. */
  const arten = nurSkill && !(stackHit.seg && stackHit.seg.fremd)
    ? artenZaehlung(stackHit.seg, (i - h) * 1000, (i + h) * 1000 + 999, nurSkill) : null;
  showTip(e.clientX, e.clientY, '<b class="factline">' + kopf + "</b><span>" +
    (parts.map(p => esc(seriesLabel(p.n, p.sid))+" "+
      (stackHit!.anteilModus && gesamt > 0
        ? pctOf(100*p.v/gesamt, 0) : fmt(Math.round(p.v)))).join("<br>")
     || esc(t("tip.nothingLanded"))) + "</span>" +
    (arten ? artenZeile(arten) : ""));
}

/* ---------- Zeitverlauf: Darstellung, Glaettung, Legende ----------
   Die Legende wird bei jedem Zeichnen neu gebaut, der Zuhoerer sitzt
   deshalb am Behaelter und nicht an den Eintraegen. */
function syncStackCtl(){
  for(const b of document.querySelectorAll<HTMLElement>("#stackCtl [data-stackscale]")){
    const an = b.dataset.stackscale === state.stackScale;
    b.classList.toggle("on", an); b.setAttribute("aria-pressed", String(an));
  }
  for(const b of document.querySelectorAll<HTMLElement>("#stackCtl [data-stacksmooth]")){
    const an = +b.dataset.stacksmooth! === state.stackSmooth;
    b.classList.toggle("on", an); b.setAttribute("aria-pressed", String(an));
  }
}

/* Dieselbe Umrechnung wie beim Zeitverlauf darueber. Hier sind es beide
   Achsen, denn my wird gegen m.y und m.mh geprueft. */
function rotTip(hit: RotationHit | null, e: MouseEvent){
  if(!hit) return;
  const z = uiZoomFactor();
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const mx = (e.clientX - r.left) / z, my = (e.clientY - r.top) / z;
  let best = null, bd = 12;
  for(const m of hit.marks){
    const dy = my < m.y ? m.y-my : my > m.y+m.mh ? my-(m.y+m.mh) : 0;
    const d = Math.abs(m.x-mx) + dy;
    if(d < bd){ bd = d; best = m; }
  }
  if(!best){ hideTip(); return; }
  const c = best.cast;
  /* Die Spanne gehoert in dieselbe Zeile wie Zeit, Schaden und Treffer -
     sie ist eine Eigenschaft dieses Einsatzes und keine Fussnote. Unter
     einer Viertelsekunde bleibt sie weg: "0,1 s" neben einem einzelnen
     Treffer ist Messrauschen und keine Auskunft. */
  const spanne = ((c.last || c.t) - c.t)/1000;
  const zeilen = [
    clock((c.t-hit.seg.start)/1000),
    full(c.dmg),
    t("rotation.hitsInCast",{n:c.hits})
  ];
  if(spanne >= .25) zeilen.push(t("rotation.spanIn", {s: secs1(spanne)}));
  /* Dieselbe Regel wie im Zeitverlauf: nur bei genau einer
     eingeschalteten Faehigkeit. Gezaehlt wird ueber die Spanne DIESES
     Einsatzes - casts() haelt nur die Zahl der Krits fest und keine
     Ereignisse, also wird hier nachgesehen. */
  const namen = (hit.seg.stats.skills || []).slice(0, 14).map(k => k.name);
  const nurSkill = einzigeSpur(namen, state.rotAus || new Set());
  const arten = (nurSkill === best.name && !hit.seg.fremd)
    ? artenZaehlung(hit.seg, c.t - hit.seg.start, (c.last || c.t) - hit.seg.start, best.name)
    : null;
  showTip(e.clientX, e.clientY, "<b>"+esc(skillLabel(best.name, best.sid))+"</b>"+
    '<span class="factline">'+factLine(zeilen)+"</span>"+
    (arten ? artenZeile(arten) : ""));
}

/* ---------- cast timeline controls ---------- */
export function parseClock(v: string){
  v = (v||"").trim(); if(!v) return null;
  if(v.includes(":")){
    const [m, sec] = v.split(":") as [string, string];   // it has a ":", so two parts at least
    const mm = parseFloat(m), ss = parseFloat(sec);
    if(isNaN(mm) || isNaN(ss)) return null;
    return mm*60 + ss;
  }
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  for(const id of ["#stack", "#stackLanes"]){
    $(id).addEventListener("mousemove", stackZeiger);
    $(id).addEventListener("mouseleave", () => {
      hideTip(); setStackMarke(null); stackStrich();
    });
  }
  /* Derselbe Knopf wie im Zeitverlauf, dieselbe Beschriftung, dieselbe
     Stelle - nur die Menge, die er leert, ist die der Rotation. */
  $("#rotCtl").addEventListener("click", e => {
    if(!(e.target as HTMLElement).closest("#rotShowAll")) return;
    state.rotAus = new Set();
    renderRotation();
  });
  $("#stackCtl").addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest("button"); if(!b) return;
    if(b.id === "stackShowAll") state.stackOff.clear();
    else if(b.dataset.stackscale) state.stackScale = b.dataset.stackscale;
    else if(b.dataset.stacksmooth) state.stackSmooth = +b.dataset.stacksmooth;
    else return;
    syncStackCtl(); renderStack();
  });
  syncStackCtl();
  // die Leiste von "Deine Rotation"; die Leinwand "Alle Einsaetze" entfaellt (Spezifikation 3)
  $("#rotBar").addEventListener("mousemove", e => rotTip(rotBarHit, e));
  $("#rotBar").addEventListener("mouseleave", hideTip);
}
