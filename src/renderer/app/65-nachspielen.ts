import { aufsummiert, fuehrtSeit, rennSchritt, rennStand, type RennPlatz } from "../glutring-core";
import type { Fight } from "../types";
import { SERIES_N, state } from "./01-state";
import { fmt } from "./03-helpers";
import { stats } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { skillMark } from "./11-skill-icons";
import { skillLabel } from "./14-questlog-weapons";
import { paintMech, perSecond } from "./16-fight-analysis";
import { $, clock, cssv, esc } from "./18-interface-basics";
import { glaetten } from "./22-timeline-smoothing";
import { kampfwahlOffen } from "./23-kampfwahl";
import { mechanikSekunden, mechanikStrecken } from "./61-mechanik";

/* ---------- Kampf nachspielen (Spezifikation Glutring 6) ----------
   Das Rennen der Faehigkeiten im Ringfeld: jede der zwoelf Faehigkeiten mit
   eigener Reihenfarbe eine Bahn, der Rest als "Uebrige Faehigkeiten" (E 12,
   wie perSecond in 16). Die Balken wachsen mit dem aufsummierten Schaden je
   Sekunde und ueberholen sich; oben Uhr und DPS bis hier, beim Durchlaufen
   der erkannten Mechanik (61) ein Satz, am Ende die Siegerehrung. 1x spielt
   den Kampf in etwa 10 s (RENNEN_MS, Kern). Bei reduzierter Bewegung startet
   es nicht von selbst und zeigt das Ende. Das Rennen nimmt beim Oeffnen
   einen festen Stand; ein anderer Kampf, ein anderer Bereich oder Kompakt
   schliessen es. Es fragt nichts und merkt sich nichts (Audit). */
interface Bahn { key: string; label: string; color: string; kum: number[]; el: HTMLElement }
interface Lauf {
  start: number; T: number; bahnen: Bahn[]; total: number[]; mech: boolean[]; strecken: {from: number; to: number}[];
  seit: number; t: number; spielt: boolean; letzt: number | null; raf: number;
}
let lauf: Lauf | null = null;
let tempo = 1;   // gilt fuer die Sitzung
const ruhig = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export const rennenOffen = () => !!lauf;

function sidVon(seg: Fight, name: string): string {
  for(const e of seg.events) if(e.skill === name && e.sid) return e.sid;
  return "";
}
export function rennenOeffnen(){
  rennenSchliessen(false);
  const seg = state.encounters[state.sel];
  if(!seg || !document.body.classList.contains("glut")) return;
  if(!seg.stats) seg.stats = stats(seg);
  const ps = perSecond(seg, SERIES_N);
  const box = $("#rennBahnen");
  box.innerHTML = "";
  const bahnen: Bahn[] = ps.series.map((s, i) => {
    const sonst = s.name === "__other__", sid = sonst ? "" : sidVon(seg, s.name);
    const label = sonst ? t("rennen.uebrige") : skillLabel(s.name, sid);
    const el = document.createElement("div");
    el.className = "rbahn";
    el.id = "rbahn" + i;   // fuer aria-owns (Reihenfolge fuer den Vorleser, zeigeBei)
    el.setAttribute("role", "listitem");
    el.dataset.key = s.name;
    el.style.setProperty("--c", s.color);
    el.innerHTML = '<span class="rpos"></span><span class="rwer">' + (sonst ? "" : skillMark(s.name, sid, s.color)) +
      '<span class="rname">' + esc(label) + '</span></span><span class="rspur"><span class="rfill"></span><span class="rwert num"></span></span>';
    box.appendChild(el);
    return {key: s.name, label, color: s.color, kum: aufsummiert(s.values), el};
  });
  lauf = {start: seg.start, T: ps.T, bahnen, total: ps.total, mech: mechanikSekunden(seg, ps.T), strecken: mechanikStrecken(seg),
    seit: fuehrtSeit(bahnen), t: 0, spielt: false, letzt: null, raf: 0};
  $("#rennPos").setAttribute("max", String(ps.T));
  document.body.classList.add("rennt");
  $("#rennen").hidden = false;
  tempoSetzen(tempo);
  if(ruhig()) zeigeBei(ps.T); else { zeigeBei(0); abspielen(); }
  knopf();
  $("#rennPlay").focus();
}
/* Schliesst das Rennen. Mit fokus (Esc, "Zurueck zum Ring") oder wenn der
   Fokus im Rennen lag, als es von aussen schloss (anderer Kampf, Bereich,
   Kompakt): der Fokus geht auf "Kampf nachspielen", wenn der Knopf zu sehen
   ist, sonst in die Liste - nie auf einen verschwundenen Knopf. */
export function rennenSchliessen(fokus: boolean){
  if(!lauf) return;
  const drin = $("#rennen").contains(document.activeElement);
  anhalten();
  lauf = null;
  $("#rennen").hidden = true;
  $("#rennBahnen").innerHTML = "";
  $("#rennBahnen").removeAttribute("aria-owns");
  $("#rennFinale").textContent = "";
  $("#rennMechText").textContent = "";
  document.body.classList.remove("rennt");
  if(!fokus && !drin) return;
  const nach = $("#ringNachspielen");
  if(nach.getClientRects().length) { nach.focus(); return; }
  /* Die Liste baut sich beim Wechsel (Kompakt) gleich neu: erst danach
     steht die Zeile, die den Fokus bekommt - und nur, wenn ihn bis dahin
     niemand sonst genommen hat. */
  requestAnimationFrame(() => {
    const a = document.activeElement;
    if(a && a !== document.body && a.getClientRects().length) return;
    const bars = $("#bars"), zeile = bars.querySelector<HTMLElement>('.row[tabindex="0"]') || bars.querySelector<HTMLElement>('[tabindex="0"]');
    if(zeile) zeile.focus();
    else { if(!bars.hasAttribute("tabindex")) bars.tabIndex = -1; bars.focus(); }
  });
}
/** Ein anderer Kampf oder kein Ring mehr: das Rennen schliesst (aus 64). */
export function rennenPruefen(){
  if(!lauf) return;
  const seg = state.encounters[state.sel];
  if(!seg || seg.start !== lauf.start || !document.body.classList.contains("glut")) rennenSchliessen(false);
}
/* Die Hoehe der Bahnen und wo ihr Block beginnt. Das Rennen ist eine
   Grafik, keine Liste (Entscheidung 03.10.): die Bahnen wachsen mit dem Feld in
   Schritten von 4 Punkt von 44 bis 64, in einem kleinen Feld bis hinab zu
   28. Der Block steht senkrecht mittig im freien Raum; was oben rechts aus
   dem Ringfeld hereinragt (#ringRechts mit "Kampf speichern" und
   "Teilen"), haelt er mit 8 Punkt Abstand frei. Gestapelt 36 je Bahn, und
   die Bahnen bekommen ihre Hoehe. */
function bahnLage(): {h: number; oben: number} {
  const n = lauf ? lauf.bahnen.length : 1, box = $("#rennBahnen");
  if(document.documentElement.matches(".w-max-899,.h-max-699")){
    const h = 36 * n + "px";
    if(box.style.height !== h) box.style.height = h;
    return {h: 36, oben: 0};
  }
  if(box.style.height) box.style.height = "";
  const b = box.getBoundingClientRect(), rr = $("#ringRechts").getBoundingClientRect();
  const frei = rr.height > 0 && rr.left < b.right && rr.bottom + 8 > b.top ? Math.ceil(rr.bottom + 8 - b.top) : 0;
  const platz = box.clientHeight - frei, roh = Math.floor(platz / n);
  const h = roh >= 44 ? Math.min(64, 44 + Math.floor((roh - 44) / 4) * 4) : Math.max(28, roh);
  return {h, oben: frei + Math.max(0, Math.floor((platz - n * h) / 2))};
}
function zeigeBei(zeit: number){
  if(!lauf) return;
  const L = lauf;
  L.t = Math.max(0, Math.min(L.T, zeit));
  const stand = rennStand(L.bahnen, L.t), ende = L.t >= L.T;
  const final = Math.max(1, ...L.bahnen.map(b => b.kum[b.kum.length - 1] || 0));
  const vorn = Math.max(stand[0]?.wert || 0, final * 0.12);
  const {h, oben} = bahnLage();
  $("#rennBahnen").style.setProperty("--bh", h + "px");
  for(const p of stand){
    const b = L.bahnen.find(x => x.key === p.key)!;
    b.el.style.top = oben + (p.platz - 1) * h + "px";
    b.el.dataset.platz = String(p.platz);
    b.el.classList.toggle("vorn", p.platz === 1);
    const w = (86 * p.wert / vorn).toFixed(2) + "%";
    b.el.querySelector<HTMLElement>(".rfill")!.style.width = w;
    const wert = b.el.querySelector<HTMLElement>(".rwert")!;
    wert.style.left = w;
    wert.textContent = fmt(p.wert, 1e3);
    const platz = b.el.querySelector<HTMLElement>(".rpos")!;
    const html = ende && p.platz <= 3
      ? '<span class="medaille m' + p.platz + '" role="img" aria-label="' + esc(t("rennen.platz", {platz: p.platz})) + '">' + p.platz + "</span>"
      : String(p.platz);
    if(platz.innerHTML !== html) platz.innerHTML = html;
  }
  /* Sichtbar ordnen sich die Bahnen ueber top; der Vorleser liest sie in der
     Reihenfolge der Plaetze ueber aria-owns. Die Knoten selbst bleiben
     stehen - ein umgehaengter Knoten verloere seinen Uebergang. Geschrieben
     wird nur, wenn sich die Reihenfolge aendert. */
  const reihe = stand.map(p => L.bahnen.find(x => x.key === p.key)!.el.id).join(" "), box = $("#rennBahnen");
  if(box.getAttribute("aria-owns") !== reihe) box.setAttribute("aria-owns", reihe);
  $("#rennUhr").textContent = clock(L.t);
  $("#rennVon").textContent = t("rennen.von", {T: clock(L.T)});
  const summe = stand.reduce((a, p) => a + p.wert, 0);
  $("#rennDps").textContent = L.t >= 1 ? fmt(summe / L.t) : "\u2014";
  const mech = !ende && !!L.mech[Math.min(L.T - 1, Math.floor(L.t))];
  const mt = mech ? t("rennen.mechanik") : "";
  if($("#rennMechText").textContent !== mt) $("#rennMechText").textContent = mt;
  $("#rennMech").classList.toggle("an", mech);
  const leiste = $<HTMLInputElement>("#rennPos");
  leiste.value = String(L.t);
  /* Der Wert fuer den Vorleser nennt volle Sekunden (clock) und wird nur
     geschrieben, wenn eine neue Sekunde beginnt - nicht in jedem Bild,
     sonst liest er beim Abspielen mit Fokus auf der Leiste ohne Pause. */
  const zeitText = t("rennen.zeitText", {t: clock(L.t), T: clock(L.T)});
  if(leiste.getAttribute("aria-valuetext") !== zeitText) leiste.setAttribute("aria-valuetext", zeitText);
  $("#rennen").dataset.t = L.t.toFixed(1);
  const fin = ende ? satz(stand) : "";
  if($("#rennFinale").textContent !== fin) $("#rennFinale").textContent = fin;
  miniKurve();
}
/* Die Siegerehrung in einem Satz: wer seit wann vorn liegt, wer dahinter. */
function satz(stand: RennPlatz[]): string {
  const L = lauf;
  if(!L || !stand[0]) return "";
  const name = (k: string) => L.bahnen.find(b => b.key === k)?.label || k;
  if(stand.length < 2) return t("rennen.allein", {name: name(stand[0].key)});
  const zweiter = stand[1]!;
  return t(L.seit > 0 ? "rennen.ende" : "rennen.endeStart",
    {name: name(stand[0].key), seit: clock(L.seit), zweiter: name(zweiter.key), wert: fmt(zweiter.wert, 1e3)});
}
/* Die Kurve in der Leiste: der ganze Kampf in Gold wie im Band, die Mechanik schraffiert, der Strich bei der Uhr. */
function miniKurve(){
  if(!lauf) return;
  const cv = $<HTMLCanvasElement>("#rennKurve"), r = cv.getBoundingClientRect(), q = window.devicePixelRatio || 1;
  if(r.width < 1 || r.height < 1) return;
  const w = Math.round(r.width * q), hc = Math.round(r.height * q);
  if(cv.width !== w) cv.width = w;
  if(cv.height !== hc) cv.height = hc;
  const ctx = cv.getContext("2d")!;
  ctx.setTransform(q, 0, 0, q, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
  const T = lauf.T, werte = glaetten(lauf.total, Math.min(5, Math.max(1, Math.floor(T / 6))));
  const oben = Math.max(1, ...werte) * 1.1, unten = r.height - 4;
  const X = (i: number) => r.width * i / Math.max(1, T - 1), Y = (v: number) => 4 + (unten - 4) * (1 - v / oben);
  paintMech(ctx, lauf.strecken, X, 0, T - 1, 4, unten);
  const gold = cssv("--gold");
  const pfad = () => { ctx.beginPath(); werte.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))); };
  pfad(); ctx.lineTo(X(werte.length - 1), unten); ctx.lineTo(X(0), unten); ctx.closePath();
  ctx.globalAlpha = 0.18; ctx.fillStyle = gold; ctx.fill(); ctx.globalAlpha = 1;
  pfad(); ctx.strokeStyle = gold; ctx.lineWidth = 1.6; ctx.stroke();
  const x = X(Math.min(T - 1, lauf.t));
  ctx.globalAlpha = 0.7; ctx.strokeStyle = cssv("--text"); ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, unten); ctx.stroke(); ctx.globalAlpha = 1;
}
function schritt(jetzt: number){
  const L = lauf;
  if(!L || !L.spielt) return;
  if(L.letzt != null) zeigeBei(L.t + rennSchritt(L.T, tempo, jetzt - L.letzt));
  L.letzt = jetzt;
  if(L.t >= L.T){ anhalten(); return; }
  L.raf = requestAnimationFrame(schritt);
}
function abspielen(){
  if(!lauf) return;
  if(lauf.t >= lauf.T) zeigeBei(0);
  lauf.spielt = true; lauf.letzt = null;
  knopf();
  lauf.raf = requestAnimationFrame(schritt);
}
function anhalten(){
  if(!lauf) return;
  lauf.spielt = false;
  cancelAnimationFrame(lauf.raf);
  knopf();
}
/* Ein Knopf, zwei Namen: "Abspielen" oder "Anhalten" (das Zeichen wechselt ueber data-spielt im Stilblatt). */
function knopf(){
  const spielt = !!lauf && lauf.spielt;
  $("#rennPlay").setAttribute("aria-label", t(spielt ? "rennen.anhalten" : "rennen.abspielen"));
  $("#rennen").dataset.spielt = spielt ? "1" : "0";
}
function tempoSetzen(n: number){
  tempo = n;
  $("#rennTempo").querySelectorAll<HTMLButtonElement>("[data-tempo]").forEach(b => {
    const an = Number(b.dataset.tempo) === n;
    b.classList.toggle("on", an);
    b.setAttribute("aria-pressed", an ? "true" : "false");
  });
}

/** Liegt eine Ebene ueber der Flaeche - Dialog, Filter, das Menue "Mehr" oder
    "Logs oeffnen", der Changelog? Deren Esc-Hoerer nehmen die Taste nicht
    (kein preventDefault); Esc schliesst dann nur sie, wie Kompakt in 37. */
export function obenOffen(): boolean {
  return state.modalOpen || state.filterOpen || state.moreOpen || state.openMenuOpen || $("#clogBg").classList.contains("on");
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  $("#ringNachspielen").addEventListener("click", () => rennenOeffnen());
  $("#rennZu").addEventListener("click", () => rennenSchliessen(true));
  $("#rennPlay").addEventListener("click", () => { if(lauf && lauf.spielt) anhalten(); else abspielen(); });
  $("#rennPos").addEventListener("input", () => { anhalten(); zeigeBei(Number($<HTMLInputElement>("#rennPos").value)); });
  /* Mit der Tastatur spult die Leiste in vollen Sekunden (Pfeile) und in
     zehn (Bild auf/ab); die Maus behaelt den feinen Schritt von 0,1 s.
     Pos1 und Ende tut die Leiste selbst. */
  $("#rennPos").addEventListener("keydown", e => {
    const L = lauf;
    if(!L) return;
    const um = ({ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10} as Record<string, number>)[e.key];
    if(!um) return;
    e.preventDefault();
    anhalten();
    zeigeBei(um > 0 ? Math.floor(L.t + 1e-6) + um : Math.ceil(L.t - 1e-6) + um);
  });
  $("#rennTempo").addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tempo]");
    if(b) tempoSetzen(Number(b.dataset.tempo));
  });
  /* Esc schliesst, solange das Rennen offen ist und der Fokus im Bereich
     Kampf liegt (#app) oder nirgends - auch nach einem Klick in die Liste
     oder ins Band. Wer die Taste schon genommen hat (Dialog, Bild,
     Rundgang), die Kampfwahl und jede Ebene darueber (obenOffen) gehen vor. */
  document.addEventListener("keydown", e => {
    if(e.key !== "Escape" || e.defaultPrevented || !lauf || kampfwahlOffen() || obenOffen()) return;
    const ziel = e.target as HTMLElement | null;
    if(ziel && ziel !== document.body && !$("#app").contains(ziel)) return;
    e.preventDefault();
    rennenSchliessen(true);
  });
  /* Die Leertaste spielt und haelt an - ausser auf einem Knopf, der tut
     dann, was er tut (Tempo waehlen, Zurueck). */
  $("#rennen").addEventListener("keydown", e => {
    if(e.key === " " && !(e.target as HTMLElement).closest("button")){
      e.preventDefault();
      if(lauf && lauf.spielt) anhalten(); else abspielen();
    }
  });
  if(typeof ResizeObserver !== "undefined") new ResizeObserver(() => { if(lauf) zeigeBei(lauf.t); }).observe($("#rennen"));
}
