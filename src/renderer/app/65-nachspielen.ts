import { aufsummiert, fuehrtSeit, gruppenBahnen, rennSchritt, rennStand, type RennPlatz } from "../glutring-core";
import type { Fight } from "../types";
import { SERIES_N, seriesColor, state } from "./01-state";
import { fmt } from "./03-helpers";
import { stats } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { skillMark } from "./11-skill-icons";
import { skillLabel } from "./14-questlog-weapons";
import { paintMech, perSecond } from "./16-fight-analysis";
import { $, clock, cssv, esc } from "./18-interface-basics";
import { glaetten } from "./22-timeline-smoothing";
import { kampfwahlOffen } from "./23-kampfwahl";
import { mitgliedName, partyForFight, partyGroupQuelle, partyGroupRows } from "./19-grouping-and-party-fights";
import { uiZoomFactor } from "./37-window-size-and-overlay";
import { gruppenKurvenHolen } from "./42-party";
import { ringStand } from "./64-glutring";
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
  start: number; modus: string; T: number; bahnen: Bahn[]; total: number[]; mech: boolean[]; strecken: {from: number; to: number}[];
  /* Die DPS am Ende, wie der Kopf sie fuer diesen Lauf zeigt (#98); null: Summe durch Sekunden. */
  schlussDps: (() => string) | null;
  seit: number; t: number; spielt: boolean; letzt: number | null; raf: number;
}
/* Die Uebrigen laufen ausser Konkurrenz: kein Platz, kein Abzeichen, nie Sieger
   (Spezifikation Feinschliff 1.1, #97). */
const REST = "__other__";
let lauf: Lauf | null = null;
let tempo = 1;   // gilt fuer die Sitzung
const ruhig = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export const rennenOffen = () => !!lauf;

function sidVon(seg: Fight, name: string): string {
  for(const e of seg.events) if(e.skill === name && e.sid) return e.sid;
  return "";
}
/* Eine Bahn, bevor sie Knoten wird: Schluessel, Name, Farbe, Zeichen davor, Schaden je Sekunde. */
interface BahnRoh { key: string; label: string; color: string; mark: string; werte: number[] }
let laden = 0;   // Laufnummer: ein spaeter Abruf nach einem Wechsel wird verworfen
const standSchluessel = () => { const r = ringStand(); return r.modus + "\u0000" + (r.mitglied || ""); };
function eigeneBahnen(seg: Fight): {ps: ReturnType<typeof perSecond>; roh: BahnRoh[]} {
  if(!seg.stats) seg.stats = stats(seg);
  const ps = perSecond(seg, SERIES_N);
  const roh = ps.series.map(s => {
    const sonst = s.name === REST, sid = sonst ? "" : sidVon(seg, s.name);
    return {key: s.name, label: sonst ? t("rennen.uebrige") : skillLabel(s.name, sid), color: s.color,
            mark: sonst ? "" : skillMark(s.name, sid, s.color), werte: s.values};
  });
  return {ps, roh};
}
export function rennenOeffnen(){
  if($("#ringNachspielen").getAttribute("aria-busy") === "true") return;
  rennenSchliessen(false);
  const seg = state.encounters[state.sel];
  if(!seg || !document.body.classList.contains("glut")) return;
  const stand = ringStand();
  if(stand.modus === "gruppe") { gruppenRennen(seg); return; }
  if(stand.modus === "mitglied" && stand.mitglied && stand.mitglied !== ((state.party && state.party.name) || "")) { mitgliedRennen(seg, stand.mitglied); return; }
  eigenesRennen(seg, "");
}
function eigenesRennen(seg: Fight, luecke: string){
  const {ps, roh} = eigeneBahnen(seg);
  laufStarten(seg, ps.T, roh.map(b => ({...b, kum: aufsummiert(b.werte)})), ps.total,
    mechanikSekunden(seg, ps.T), mechanikStrecken(seg), "rennen.bahnen", luecke,
    () => state.noTime || !seg.stats ? "—" : fmt(seg.stats.dps));
}
function gruppenRennen(seg: Fight){
  const zeilen = partyGroupRows();
  const ich = (state.party && state.party.name) || "";
  /* Deine Bahn kommt aus deinem Log, wenn der gezeigte Kampf deiner ist: der
     gewaehlte Pull hat Meldungen der Gruppe, oder die lebende Tafel und dein
     neuester Kampf. */
  const meins = zeilen.find(z => z.name === ich) && (partyForFight(seg) || state.sel === 0) ? seg : null;
  const nr = ++laden, schluessel = standSchluessel();
  ladenZeigen(true);
  void gruppenKurvenHolen(partyGroupQuelle(), ich).then(kurven => {
    if(nr !== laden) return;
    ladenZeigen(false);
    if(standSchluessel() !== schluessel || state.encounters[state.sel] !== seg || !document.body.classList.contains("glut")) return;
    const fehlen = zeilen.filter(z => z.name !== ich && !kurven.has(z.name)).length + (zeilen.some(z => z.name === ich) && !meins ? 1 : 0);
    const luecke = fehlen ? t("rennen.ohneVerlauf", {n: fehlen, m: zeilen.length}) : "";
    /* Passt keine fremde Kurve, spielt der gewaehlte eigene Kampf (Spezifikation 4.1.7), auch wenn er nicht deiner ist. */
    if(!kurven.size){ eigenesRennen(meins || seg, luecke); return; }
    const roh: (BahnRoh & {t0: number | null})[] = [];
    let eigenPs: ReturnType<typeof perSecond> | null = null;
    for(const z of zeilen){
      if(z.name === ich && meins){
        eigenPs = perSecond(meins, SERIES_N);
        roh.push({key: z.name, label: z.label, color: z.color, mark: z.icon || "", werte: eigenPs.total, t0: state.wall ? meins.start : null});
      } else {
        const k = kurven.get(z.name);
        if(k) roh.push({key: z.name, label: z.label, color: z.color, mark: z.icon || "", werte: k.total, t0: k.t0});
      }
    }
    const g = gruppenBahnen(roh.map(b => ({key: b.key, t0: b.t0, werte: b.werte})));
    /* In der Liste fuer den Vorleser und im Bild stehen die Bahnen nach dem Schaden am Ende. */
    const ende = (i: number) => g.bahnen[i]!.kum[g.bahnen[i]!.kum.length - 1] || 0;
    const ordnung = roh.map((_, i) => i).sort((a, b) => ende(b) - ende(a) || a - b);
    const bahnen = ordnung.map(i => ({...roh[i]!, kum: g.bahnen[i]!.kum}));
    /* Die Mechanik kennt nur dein eigener Kampf; sie rueckt um deinen Versatz. */
    const mech: boolean[] = new Array(g.T).fill(false);
    let strecken: {from: number; to: number}[] = [];
    const ei = roh.findIndex(b => b.key === ich && !!meins);
    if(ei >= 0 && meins && eigenPs){
      const ab = g.bahnen[ei]!.ab;
      mechanikSekunden(meins, eigenPs.T).forEach((m, i) => { if(m && ab + i < g.T) mech[ab + i] = true; });
      strecken = mechanikStrecken(meins).map(s => ({from: s.from + ab, to: s.to + ab}));
    }
    /* Die Gruppe: Summe durch Sekunden der gemeinsamen Uhr - es laufen nur die Mitglieder mit Kurve. */
    laufStarten(seg, g.T, bahnen, g.total, mech, strecken, "rennen.mitglieder", luecke, null);
  });
}
/* Ein geoeffnetes Mitglied (Spezifikation Gruppenkurven 4.2): seine Faehigkeiten
   aus den Spuren seiner Kurve. Die Spuren kommen erst, wenn sein Kampf steht;
   bis dahin oeffnet nichts. Die Farbe folgt dem Rang nach Schaden wie im Ring
   des Mitglieds. Keine Mechanik - die kennt nur dein eigener Kampf. */
function mitgliedRennen(seg: Fight, wer: string){
  const z = partyGroupRows().find(r => r.name === wer);
  if(!z){ hinweis(t("rennen.keinVerlauf", {name: mitgliedName(wer)})); return; }
  const nr = ++laden, schluessel = standSchluessel();
  ladenZeigen(true);
  void gruppenKurvenHolen(partyGroupQuelle().filter(r => r.name === wer), "").then(kurven => {
    if(nr !== laden) return;
    ladenZeigen(false);
    if(standSchluessel() !== schluessel || state.encounters[state.sel] !== seg) return;
    const k = kurven.get(wer);
    if(!k || !k.lanes || !k.lanes.length){ hinweis(t("rennen.keinVerlauf", {name: z.label})); return; }
    const summe = (v: number[]) => v.reduce((a, x) => a + (x || 0), 0);
    const reihe = k.lanes.filter(l => l.n !== REST).sort((a, b) => summe(b.v) - summe(a.v));
    const rang = new Map(reihe.map((l, i) => [l.n, i] as [string, number]));
    const T = Math.max(k.T, ...k.lanes.map(l => l.v.length));
    const roh = k.lanes.map(l => {
      const sonst = l.n === REST, c = sonst ? seriesColor(SERIES_N) : seriesColor(rang.get(l.n)!);
      return {key: l.n, label: sonst ? t("rennen.uebrige") : skillLabel(l.n, l.sid), color: c,
              mark: sonst ? "" : skillMark(l.n, l.sid, c), werte: l.v, kum: aufsummiert(l.v)};
    });
    /* Am Ende seine DPS wie im Kopf seines Rings (#ringMitgliedZahl). */
    laufStarten(seg, T, roh, k.total, new Array(T).fill(false), [], "rennen.bahnen", "", () => fmt(z.dps));
  });
}
/* "Verlaeufe laden ...": der Knopf ist besetzt, bis die Abrufe zurueck sind. Er
   bleibt bedienbar (der Fokus bleibt auf ihm); ein zweiter Klick waehrenddessen
   tut nichts (rennenOeffnen). */
function ladenZeigen(an: boolean){
  const k = $("#ringNachspielen"), s = k.querySelector("span")!;
  /* Waehrend des Ladens ohne data-i18n: ein Sprachwechsel setzt den Text sonst zurueck. */
  if(an){ k.setAttribute("aria-busy", "true"); s.removeAttribute("data-i18n"); s.textContent = t("rennen.laden"); }
  else { k.removeAttribute("aria-busy"); s.dataset.i18n = "ring.nachspielen"; s.textContent = t("ring.nachspielen"); }
}
/* Ein kurzer Satz neben dem Knopf, wenn kein Rennen oeffnet; nach vier Sekunden weg. */
let hinweisUhr = 0;
function hinweis(text: string){
  const h = $("#ringHinweis");
  /* Das Feld bleibt im Baum (role=status); leer blendet CSS es aus. So sagt der Vorleser den neuen Text an. */
  h.textContent = text;
  clearTimeout(hinweisUhr);
  hinweisUhr = window.setTimeout(() => { h.textContent = ""; }, 4000);
}
function laufStarten(seg: Fight, T: number, roh: (BahnRoh & {kum: number[]})[], total: number[], mech: boolean[],
                     strecken: {from: number; to: number}[], liste: string, luecke: string,
                     schlussDps: (() => string) | null){
  /* Ein spaeter Abruf darf kein Rennen oeffnen, wenn der Glutring nicht mehr zu sehen ist (Spezifikation 4.3). */
  if(!document.body.classList.contains("glut")) return;
  const box = $("#rennBahnen");
  box.innerHTML = "";
  box.setAttribute("aria-label", t(liste));
  box.dataset.i18nAriaLabel = liste;
  const bahnen: Bahn[] = roh.map((b, i) => {
    const el = document.createElement("div");
    el.className = "rbahn";
    el.id = "rbahn" + i;   // fuer aria-owns (Reihenfolge fuer den Vorleser, zeigeBei)
    el.setAttribute("role", "listitem");
    el.dataset.key = b.key;
    el.classList.toggle("rest", b.key === REST);
    el.style.setProperty("--c", b.color);
    el.innerHTML = '<span class="rpos"></span><span class="rwer">' + b.mark +
      '<span class="rname" title="' + esc(b.label) + '">' + esc(b.label) + '</span></span><span class="rspur"><span class="rfill"></span><span class="rwert num"></span></span>';
    box.appendChild(el);
    return {key: b.key, label: b.label, color: b.color, kum: b.kum, el};
  });
  const l = $("#rennLuecke");
  l.textContent = luecke; l.hidden = !luecke;
  lauf = {start: seg.start, modus: standSchluessel(), T, bahnen, total, mech, strecken, schlussDps,
    seit: fuehrtSeit(bahnen, REST), t: 0, spielt: false, letzt: null, raf: 0};
  $("#rennPos").setAttribute("max", String(T));
  document.body.classList.add("rennt");
  $("#rennen").hidden = false;
  tempoSetzen(tempo);
  if(ruhig()) zeigeBei(T); else { zeigeBei(0); abspielen(); }
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
  $("#rennLuecke").hidden = true; $("#rennLuecke").textContent = "";
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
  if(!seg || seg.start !== lauf.start || lauf.modus !== standSchluessel() || !document.body.classList.contains("glut")) rennenSchliessen(false);
}
/* Die Hoehe der Bahnen und wo ihr Block beginnt. Das Rennen ist eine
   Grafik, keine Liste: die Bahnen wachsen mit dem Feld in Schritten von 4
   Punkt von 44 bis 64, in einem kleinen Feld bis hinab zu 24. Der Block
   steht mittig im freien Raum und haelt 8 Punkt Abstand zu #ringRechts.
   Gerechnet in Punkten der Seite: unter Vergroesserung misst
   getBoundingClientRect in Bildschirmpunkten, darum geteilt durch den
   Zoom. Gestapelt 36 je Bahn, und die Bahnen bekommen ihre Hoehe. */
function bahnLage(): {h: number; oben: number} {
  const n = lauf ? lauf.bahnen.length : 1, box = $("#rennBahnen");
  if(document.documentElement.matches(".w-max-899,.h-max-699")){
    const h = 36 * n + "px";
    if(box.style.height !== h) box.style.height = h;
    return {h: 36, oben: 0};
  }
  if(box.style.height) box.style.height = "";
  const z = (typeof uiZoomFactor === "function" ? uiZoomFactor() : 1) || 1;
  const b = box.getBoundingClientRect(), rr = $("#ringRechts").getBoundingClientRect();
  const ueber = (rr.bottom - b.top) / z + 8;
  const frei = rr.height > 0 && rr.left < b.right && ueber > 0 ? Math.ceil(ueber) : 0;
  const platz = Math.min(box.clientHeight, Math.floor(b.height / z)) - frei, roh = Math.floor(platz / n);
  const h = roh >= 44 ? Math.min(64, 44 + Math.floor((roh - 44) / 4) * 4) : Math.max(24, roh);
  return {h, oben: frei + Math.max(0, Math.floor((platz - n * h) / 2))};
}
function zeigeBei(zeit: number){
  if(!lauf) return;
  const L = lauf;
  L.t = Math.max(0, Math.min(L.T, zeit));
  const stand = rennStand(L.bahnen, L.t, REST), ende = L.t >= L.T;
  const final = Math.max(1, ...L.bahnen.map(b => b.kum[b.kum.length - 1] || 0));
  const vorn = Math.max(final * 0.12, ...stand.map(p => p.wert));
  const {h, oben} = bahnLage();
  $("#rennBahnen").style.setProperty("--bh", h + "px");
  for(const [i, p] of stand.entries()){
    const b = L.bahnen.find(x => x.key === p.key)!;
    b.el.style.top = oben + i * h + "px";
    b.el.dataset.platz = p.platz ? String(p.platz) : "";
    b.el.classList.toggle("vorn", p.platz === 1);
    /* Die Fuellung als Bruch (--f): das Stilblatt zieht den Platz fuer den Wert ab, er bleibt im Bild. */
    b.el.style.setProperty("--f", (p.wert / vorn).toFixed(4));
    const wert = b.el.querySelector<HTMLElement>(".rwert")!;
    wert.textContent = fmt(p.wert, 1e3);
    const platz = b.el.querySelector<HTMLElement>(".rpos")!;
    const html = !p.platz ? "" : ende && p.platz <= 3
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
  /* Am Ende zeigt die Zeile dieselbe DPS wie der Kopf (#hDps, im Ring eines
     Mitglieds seine Zahl), nicht Summe durch Sekunden (schlussDps je Lauf). */
  $("#rennDps").textContent = ende && L.schlussDps ? L.schlussDps()
    : L.t >= 1 ? fmt(summe / L.t) : "\u2014";
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
  const fin = ende ? satz(stand.filter(p => p.platz > 0)) : "";
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
