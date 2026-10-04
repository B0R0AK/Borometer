import { artenAusBericht, artenZaehlen, bogenBei, boegen, farbeMitAlpha, FUGE, mitSchrift, OBEN, ringMass, type ArtenBlock, type Bogen, type Kat, winkelNorm, zwischen } from "../glutring-core";
import type { BarFigures, BarSubRow, Fight } from "../types";
import { SERIES_N, seriesColor, state } from "./01-state";
import { fmt, full } from "./03-helpers";
import { stats } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { skillMark } from "./11-skill-icons";
import { markiereRest, pct } from "./16-fight-analysis";
import { className, classNameFor } from "./17-class-names";
import { $, cssv, esc } from "./18-interface-basics";
import { catOf, groupRows, partyForFight, partyGroupRows } from "./19-grouping-and-party-fights";
import { CAT_SWATCH, coreBadge, tafelKopfZahl } from "./21-damage-table";
import { kampfwahlOffen } from "./23-kampfwahl";
import { barsRoving } from "./24-table-keyboard-and-timeline";
import { focusKeeper } from "./30-fight-list";
import { waffenText } from "./42-party";
import { uiZoomFactor } from "./37-window-size-and-overlay";
import { renderKurve, tafelGilt } from "./56-tafel";
import { obenOffen, rennenOffen, rennenPruefen, rennenSchliessen } from "./65-nachspielen";

/* ---------- Glutring: der Kampf als Ring um die grosse Zahl ----------
   Spezifikation docs/superpowers/specs/2026-10-02-glutring-design.md. Im
   Bereich Kampf der vollen Ansicht (tafelGilt, 56) zeichnet dieser Teil die
   Liste neben dem Ring, den Ring und die Gruppe; das Rennen steht in
   65-nachspielen.ts, gerechnet wird in ../glutring-core.ts. Kompakt zeichnet
   21 wie bisher - renderBars gibt nur hierher ab, wenn die Tafel gilt. */

/** Eine Zeile der Liste und ein Bogen des Rings: eine Faehigkeit, Waffe, ein Ziel, Angreifer oder Mitglied. */
export interface RingZeile extends BarFigures {
  name: string; label: string; color: string; dps: number;
  sid?: string; rest?: boolean; icon?: string | null; subs: BarSubRow[];
}
interface RingDaten { modus: "allein" | "gruppe" | "mitglied"; zeilen: RingZeile[]; arten: (key: string) => ArtenBlock | null }

/* Welche Zeilen offen stehen (Sitzung) und ob der Leser selbst geklappt hat:
   beim Oeffnen eines Kampfes steht die staerkste offen (E, Spezifikation 4),
   danach gilt seine Wahl. Eigene Menge, nicht state.expanded - Kompakt
   klappt fuer sich. */
let listeKampf: number | null = null;
let selbstGeklappt = false;
const offen = new Set<string>();

/* Wer im Ring steht: in der Gruppe die Mitglieder (Spezifikation 5) oder,
   wenn eines geoeffnet ist, dessen Faehigkeiten mit den Trefferarten aus
   seinem Bericht; sonst die Zeilen der gewaehlten Gruppierung. */
let mitglied: string | null = null;
let listeModus = "";   // eigener Kampf, Gruppe oder welches Mitglied die Liste zuletzt zeigte
function ringDaten(seg: Fight): RingDaten {
  if(state.group === "party"){
    const alle: RingZeile[] = partyGroupRows();
    const m = mitglied ? alle.find(r => r.name === mitglied) : undefined;
    if(m) return mitgliedDaten(m);
    mitglied = null;
    return {modus: "gruppe", zeilen: alle, arten: () => null};
  }
  mitglied = null;
  const zeilen: RingZeile[] = groupRows(seg, state.group);
  if(state.group !== "skill") return {modus: "allein", zeilen, arten: () => null};
  const je = artenZaehlen(seg.events.map(e => ({name: e.skill, kat: catOf(e) as Kat, dmg: e.dmg})));
  return {modus: "allein", zeilen, arten: k => je.get(k) || null};
}
function mitgliedDaten(m: RingZeile): RingDaten {
  /* Die Farbe einer Faehigkeit folgt ihrem Rang nach Schaden im Bericht, nicht
     der Reihenfolge, in der das Mitglied sie schickt (wie groupRows im eigenen Kampf). */
  const rang = new Map(m.subs.slice().sort((a, b) => (b.damage || 0) - (a.damage || 0)).map((s, i) => [s.key, i] as [string, number]));
  const zeilen: RingZeile[] = m.subs.map(s => ({
    name: s.key, label: s.label, color: seriesColor(rang.get(s.key)!), sid: s.sid || "", rest: rang.get(s.key)! >= SERIES_N, icon: null,
    damage: s.damage, dps: s.dps ?? 0, hits: s.hits, share: s.damage / (m.damage || 1),
    max: s.max ?? null, critRate: s.critRate ?? null, heavyRate: s.heavyRate ?? null, subs: []}));
  const arten = new Map<string, ArtenBlock>();
  for(const s of m.subs) if(s.subs && s.subs.length)
    arten.set(s.key, artenAusBericht(s.subs.map(c => ({k: c.key, h: c.hits, d: c.damage, m: c.max ?? 0}))));
  return {modus: "mitglied", zeilen, arten: k => arten.get(k) || null};
}
/* Klasse und Waffen eines Mitglieds aus seinem Bericht (wie die Tafel im Bereich Gruppe, 42). */
function klasseVon(name: string): string {
  const seg = state.encounters[state.sel];
  const roh: {name: string; weapons?: string[]}[] = (seg && partyForFight(seg)) || (state.party && state.party.board) || [];
  const w = roh.find(r => r.name === name)?.weapons || [];
  return [className(classNameFor(w)), waffenText(w)].filter(Boolean).join(" \u00b7 ");
}

/* Der Kopf: sechs sortierbare Spalten, ein Tabstopp (Pfeiltasten in 24).
   Schaden, Anteil und DPS ordnen gleich; die Vorgabe "damage" steht an DPS.
   In der Gruppe: Mitglied, DPS, Anteil und die Klasse (nicht sortierbar). */
const sortSpalte = () => state.sortBars.key === "damage" ? "dps" : state.sortBars.key;
type Spalte = readonly [key: string, text: string, sortierbar: boolean];
const KOPF: readonly Spalte[] = [["name", "bars.name", true], ["dps", "bars.dps", true], ["share", "bars.share", true],
  ["hits", "bars.hits", true], ["critRate", "bars.crit", true], ["heavyRate", "bars.heavy", true]];
const KOPF_GRUPPE: readonly Spalte[] = [["name", "party.colMitglied", true], ["dps", "bars.dps", true], ["share", "bars.share", true],
  ["klasse", "ring.kopfKlasse", false]];
function kopfHtml(kopf: readonly Spalte[]): string {
  const k = sortSpalte(), ab = state.sortBars.dir < 0;
  return '<div class="bhead ringkopf" role="row">' + kopf.map(([key, text, sortierbar]) => {
    const an = sortierbar && key === k;
    return '<span data-k="' + key + '" role="columnheader" class="' + (an ? "sorted" : "") + '"' +
      (sortierbar ? ' tabindex="' + (an ? 0 : -1) + '" aria-sort="' + (an ? (ab ? "descending" : "ascending") : "none") + '"' : "") + ">" +
      esc(t(text)) + (an ? '<span aria-hidden="true">' + (ab ? " \u2193" : " \u2191") + "</span>" : "") + "</span>";
  }).join("") + "</div>";
}
function ordnen(zeilen: RingZeile[]): RingZeile[] {
  const st = state.sortBars, k = sortSpalte();
  return zeilen.slice().sort((a, b) => {
    if(k === "name") return st.dir * a.label.localeCompare(b.label);
    const x = Number(a[k]) || 0, y = Number(b[k]) || 0;
    return st.dir * (x - y) || ((b.hits || 0) - (a.hits || 0));
  });
}
const quote = (x: number | null | undefined, key: string) => x == null ? "\u2014" : t(key, {p: pct(x)});
function zeileHtml(r: RingZeile, spitze: number, d: RingDaten, seg: Fight): string {
  const arten = d.arten(r.name);
  const kann = !!arten || r.subs.length > 0;
  const auf = kann && offen.has(r.name);
  const w = Math.min(1, Math.max(0, (r.damage || 0) / spitze));
  let html = '<div class="row ringzeile' + (kann ? " has-sub" : "") + (auf ? " open" : "") + (r.rest ? " rest" : "") +
    '" role="row" aria-level="1" tabindex="-1" data-ring="' + esc(r.name) + '"' +
    (state.group === "skill" ? ' data-skill="' + esc(r.name) + '"' : "") +
    (kann ? ' data-open="' + esc(r.name) + '" aria-expanded="' + (auf ? "true" : "false") + '"' : "") + ">" +
    '<span class="nm" role="gridcell"><span class="twist" aria-hidden="true">' + (kann ? "\u203a" : "") + "</span>" +
      (r.icon != null ? r.icon : skillMark(r.name, r.sid, r.color, r.rest)) +
      '<span class="nmt" title="' + esc(r.label) + '">' + esc(r.label) + "</span>" + coreBadge(r.name, r.sid, seg.ventiusBase) + "</span>" +
    '<span class="v dps" data-k="dps" role="gridcell">' + (state.noTime ? "\u2014" : esc(fmt(r.dps, 1e3))) + "</span>" +
    '<span class="fill" role="presentation" style="--w:' + w.toFixed(4) + ";--c:" + esc(r.color) + '"></span>' +
    '<span class="v soft" data-k="share" role="gridcell">' + esc(pct(r.share, 1)) + "</span>" +
    '<span class="v soft" data-k="hits" role="gridcell">' + esc(t("ring.treffer", {n: full(r.hits), z: r.hits})) + "</span>" +
    /* Die Quote traegt ihren Nenner im title wie in der Tafel (bars.rateBase). */
    '<span class="v soft" data-k="critRate" role="gridcell"' + (r.critRate == null ? "" : ' title="' + esc(t("bars.rateBase", {n: r.hits})) + '"') + ">" +
      esc(quote(r.critRate, "ring.krit")) + "</span>" +
    '<span class="v soft" data-k="heavyRate" role="gridcell"' + (r.heavyRate == null ? "" : ' title="' + esc(t("bars.rateBase", {n: r.hits})) + '"') + ">" +
      esc(quote(r.heavyRate, "ring.stark")) + "</span></div>";
  if(auf) html += arten ? artenHtml(r.name, arten) : subsHtml(r);
  return html;
}
/* Aufgeklappt (Spezifikation 4): Normal, Kritisch, Stark, Kritisch stark -
   je Balken, Zahl der Treffer und Schaden -, darunter Treffer gesamt, der
   groesste Treffer und der Schnitt je Treffer. */
function artenHtml(name: string, a: ArtenBlock): string {
  const spitze = Math.max(1, ...a.zeilen.map(z => z.d));
  return a.zeilen.map(z => '<div class="row sub catrow" role="row" aria-level="2" tabindex="-1" data-cat="' + z.kat +
      '" data-parent="' + esc(name) + '" data-ring="' + esc(name) + '">' +
      '<span class="nm" role="gridcell"><i class="artfleck" style="--c:' + esc(CAT_SWATCH[z.kat] || "") + '" aria-hidden="true"></i>' +
        '<span class="nmt">' + esc(t("ring.art." + z.kat)) + "</span></span>" +
      '<span class="v" data-k="hits" role="gridcell">' + esc(t("ring.treffer", {n: full(z.n), z: z.n})) + "</span>" +
      '<span class="fill" role="presentation" style="--w:' + (z.d / spitze).toFixed(4) + ";--c:" + esc(CAT_SWATCH[z.kat] || "") + '"></span>' +
      '<span class="v" data-k="damage" role="gridcell">' + esc(fmt(z.d, 1e3)) + "</span></div>").join("") +
    '<div class="row sub bdetail" role="row" aria-level="2" tabindex="-1" data-detail="' + esc(name) + '" data-ring="' + esc(name) + '">' +
      '<span class="dz" role="gridcell" aria-colspan="6">' +
      esc(t("ring.summe", {n: full(a.n), z: a.n, max: fmt(a.max, 1e3), avg: fmt(a.schnitt, 1e3), d: fmt(a.d, 1e3)})) + "</span></div>";
}
/* Nach Waffe, Ziel oder Angreifer klappt eine Zeile wie bisher in ihre Faehigkeiten auf. */
function subsHtml(r: RingZeile): string {
  const spitze = Math.max(1, ...r.subs.map(s => s.damage || 0));
  return r.subs.map(s => '<div class="row sub" role="row" aria-level="2" tabindex="-1" data-parent="' + esc(r.name) + '" data-ring="' + esc(r.name) + '">' +
    '<span class="nm" role="gridcell">' + skillMark(s.name || s.key, s.sid, r.color, r.rest) + '<span class="nmt" title="' + esc(s.label) + '">' + esc(s.label) + "</span></span>" +
    '<span class="v" data-k="hits" role="gridcell">' + esc(t("ring.treffer", {n: full(s.hits), z: s.hits})) + "</span>" +
    '<span class="fill" role="presentation" style="--w:' + ((s.damage || 0) / spitze).toFixed(4) + ";--c:" + esc(r.color) + '"></span>' +
    '<span class="v" data-k="damage" role="gridcell">' + esc(fmt(s.damage, 1e3)) + "</span></div>").join("");
}

/* Eine Zeile je Mitglied (Spezifikation 5): Rang nach DPS wie das Board,
   Waffenpaar, Name, DPS, Balken in seiner festen Farbe, Anteil, Klasse und
   Waffen. Die eigene Zeile ist markiert. Enter oder Klick oeffnet seinen Ring. */
function gruppeHtml(zeilen: RingZeile[], spitze: number): string {
  const ich = (state.party && state.party.name) || "";
  const rang = new Map(zeilen.slice().sort((a, b) => b.dps - a.dps).map((r, i) => [r.name, i + 1] as [string, number]));
  return ordnen(zeilen).map(r => {
    const w = Math.min(1, Math.max(0, (r.damage || 0) / spitze)), me = !!ich && r.name === ich;
    return '<div class="row ringzeile mitglied' + (me ? " me" : "") + '" role="row" aria-level="1" tabindex="-1" data-ring="' + esc(r.name) +
      '" data-member="' + esc(r.name) + '">' +
      '<span class="nm" role="gridcell"><span class="rang">' + (rang.get(r.name) || "") + "</span>" + (r.icon || "") +
        '<span class="nmt" title="' + esc(r.label) + '">' + esc(r.label) + "</span>" +
        (me ? '<span class="du">' + esc(t("ring.duMarke")) + "</span>" : "") + "</span>" +
      '<span class="v dps" data-k="dps" role="gridcell">' + esc(fmt(r.dps, 1e3)) + "</span>" +
      '<span class="fill" role="presentation" style="--w:' + w.toFixed(4) + ";--c:" + esc(r.color) + '"></span>' +
      '<span class="v soft" data-k="share" role="gridcell">' + esc(pct(r.share, 1)) + "</span>" +
      '<span class="v soft" data-k="klasse" role="gridcell">' + esc(klasseVon(r.name)) + "</span></div>";
  }).join("");
}
function renderRingListe(seg: Fight, d: RingDaten){
  if(seg.start !== listeKampf){
    listeKampf = seg.start;
    offen.clear();
    if(!selbstGeklappt && d.modus === "allein"){
      const erste = d.zeilen.slice().sort((a, b) => b.damage - a.damage)[0];
      if(erste && (d.arten(erste.name) || erste.subs.length)) offen.add(erste.name);
    }
  }
  /* Zwischen eigenem Kampf, Gruppe und dem Ring eines Mitglieds gilt das
     Aufgeklappte nicht weiter: dieselbe Faehigkeit hiesse sonst im Ring eines
     Mitglieds schon offen, nur weil sie beim eigenen Kampf offen stand. */
  const schluessel = d.modus + "\u0000" + (mitglied || "");
  if(schluessel !== listeModus){ if(listeModus) offen.clear(); listeModus = schluessel; }
  const gruppe = d.modus === "gruppe", kopf = gruppe ? KOPF_GRUPPE : KOPF;
  /* Eine Ordnung, fuer die keine Spalte dasteht, faellt auf die Vorgabe zurueck. */
  if(state.sortBars.key !== "damage" && !kopf.some(([k, , s]) => s && k === state.sortBars.key)) state.sortBars = {key: "damage", dir: -1};
  const box = $("#bars");
  const spitze = Math.max(1, ...d.zeilen.map(r => r.damage || 0));
  const halten = focusKeeper(document.activeElement as HTMLElement | null, box);
  box.classList.remove("breit");
  box.classList.add("ring");
  box.innerHTML = kopfHtml(kopf) + (gruppe ? gruppeHtml(d.zeilen, spitze) : ordnen(d.zeilen).map(r => zeileHtml(r, spitze, d, seg)).join(""));
  markiereRest();
  binden(box);
  // die hervorgehobene Zeile behaelt ihren Ton ueber ein Neuzeichnen (Live)
  if(hervor) box.querySelectorAll<HTMLElement>(".ringzeile").forEach(z => z.classList.toggle("ringan", z.dataset.ring === hervor.split("\u0000")[0]));
  halten();
  barsRoving();
  tafelKopfZahl(d.zeilen, gruppe);
}
/* Enter und Leertaste tun, was ein Klick tut (wie in 21). */
function aufAus(el: HTMLElement, tun: (tastatur: boolean) => void){
  el.onclick = () => tun(false);
  el.onkeydown = e => {
    if(e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    tun(true);
  };
}
function binden(box: HTMLElement){
  const kopf = [...box.querySelectorAll<HTMLElement>(".bhead [data-k][tabindex]")];
  if(kopf.length && !kopf.some(k => k.tabIndex === 0)) kopf[0]!.tabIndex = 0;
  kopf.forEach(sp => aufAus(sp, () => {
    const k = sp.dataset.k!, st = state.sortBars;
    if(sortSpalte() === k) st.dir *= -1; else { st.key = k; st.dir = -1; }
    const hatte = document.activeElement === sp;
    renderGlutring();
    if(hatte) box.querySelector<HTMLElement>('.bhead [data-k="' + k + '"]')?.focus();
  }));
  box.querySelectorAll<HTMLElement>(".ringzeile[data-open]").forEach(z => aufAus(z, () => {
    const name = z.dataset.open!;
    selbstGeklappt = true;
    if(offen.has(name)) offen.delete(name); else offen.add(name);
    renderGlutring();
  }));
  box.querySelectorAll<HTMLElement>(".ringzeile[data-member]").forEach(z => aufAus(z, tastatur => mitgliedOeffnen(z.dataset.member!, tastatur)));
}

/* ---------- Der Kopf haengt um (E 1) ----------
   Was der Kopf (20) zeichnet, steht im Ring an anderer Stelle: die grosse
   Zahl in der Mitte, Satz und Einordnung oben links, Boss, Fakten und die
   zwei Handlungen oben rechts. Umgehaengt werden die Knoten selbst -
   renderHead schreibt weiter dieselben Kennungen, und beim Verlassen (Kompakt,
   ein anderer Bereich) steht jeder wieder an seinem alten Platz. */
const UMHAENGEN: readonly [string, string][] = [
  [".headtop > .big", "#ringMitte"], ["#hName", "#ringMeta"], ["#snapBadge", "#ringMeta"], ["#hMeta", "#ringMeta"],
  [".headtop > .headact", "#ringRechts"], ["#hRead", "#ringSatz"], ["#hHist", "#ringSatz"]];
const herkunft: [Element, Node, Node | null][] = [];
let umgehaengt = false;
let fokusMerk: HTMLElement | null = null;
function umhaengen(an: boolean){
  if(an === umgehaengt) return;
  umgehaengt = an;
  /* Ein verschobener Knoten verliert den Fokus (der Browser setzt ihn auf
     body). Steht er in einem der Knoten - etwa auf "Kampf speichern" -,
     kommt er danach auf dasselbe Element zurueck. Ist es dort nicht zu
     sehen (Kompakt blendet die Handlungen aus), merkt sich 64 das Element
     und gibt ihm den Fokus beim Zurueckhaengen, solange niemand ihn
     inzwischen woanders hingesetzt hat (er steht noch auf body). */
  const aktiv = document.activeElement;
  const fokus = aktiv instanceof HTMLElement && aktiv !== document.body ? aktiv
    : fokusMerk && fokusMerk.isConnected ? fokusMerk : null;
  fokusMerk = null;
  const halten = (els: Element[]) => {
    if(!fokus || !els.some(el => el.contains(fokus))) return;
    if(fokus !== document.activeElement) fokus.focus({preventScroll:true});
    if(fokus !== document.activeElement) fokusMerk = fokus;
  };
  if(an){
    for(const [wer, wohin] of UMHAENGEN){
      const el = document.querySelector(wer);
      if(!el || !el.parentNode) continue;
      herkunft.push([el, el.parentNode, el.nextSibling]);
      // die Zahl steht in der Mitte vor allem, was 64 dort selbst schreibt (Erzaehlung, "Du ...")
      if(wohin === "#ringMitte") $(wohin).prepend(el); else $(wohin).appendChild(el);
    }
    halten(herkunft.map(h => h[0]));
    return;
  }
  /* Rueckwaerts: so steht jeder Nachbar schon wieder da, wenn ein Knoten vor ihn zurueckgeht. */
  const zurueck = herkunft.map(h => h[0]);
  for(const [el, eltern, vor] of herkunft.reverse()) eltern.insertBefore(el, vor && vor.parentNode === eltern ? vor : null);
  herkunft.length = 0;
  halten(zurueck);
}
/** body.glut und das Ringfeld; aus syncTafel (56), vor dem Schnitt der Liste. */
export function syncGlutring(an: boolean){
  /* Der Ring erscheint wieder. Er waechst nicht neu auf: ein Bereichswechsel
     ist kein Oeffnen eines Kampfes (Spezifikation 3). Zeigt er denselben
     Kampf, steht er sofort; sonst gleiten die Boegen wie beim Kampfwechsel
     (bewegen). Aufgewachsen wird nur, solange noch kein Ring zu sehen war:
     ein Bild, das vor dem ersten Betreten gesetzt wurde, waechst ab jetzt. */
  const betreten = an && !document.body.classList.contains("glut");
  if(betreten && !gesehen) frisch = true;
  document.body.classList.toggle("glut", an);
  umhaengen(an);
  if(!an){ document.body.classList.remove("ringgruppe", "ringmitglied"); bandTitel(false); }
  if(!an) rennenSchliessen(false);
  fussAngleichen();   // verlassen: keine Mindesthoehe bleibt an Band und Urteil haengen
  lage = null;
  /* Beim Betreten (Bereichswechsel, aus Kompakt, Start, Einstellungen)
     werden Liste und Ring aus dem jetzigen Kampf neu gesetzt, nicht aus dem
     gemerkten Bild: ausserhalb des Rings zeichnet renderBars (21) die
     Tabelle von Kompakt in #bars, und Kampf oder Gruppierung koennen dort
     gewechselt haben (Gesamtpruefung Glutring, C1). 34 ruft beim
     Bereichswechsel nur syncTafel. */
  if(betreten) renderGlutring();
}

/* ---------- Der Ring (Spezifikation 3) ----------
   Canvas, mit derselben Glaettung wie die Kurve (devicePixelRatio). Boegen im
   Uhrzeigersinn ab 12 Uhr nach Schaden, Haarfuge dazwischen, in der
   Reihenfarbe; von innen (--glutring-innen) nach aussen kraeftiger. Aussen
   ein duenner Rand je Bogen nach den Trefferarten. Beschriftung aussen mit
   Leitlinie ab 10 Grad, wenn daneben Platz ist (E 7). Fuer den Vorleser ist
   der Ring ein Bild mit Beschreibung; die Liste ist das Gegenstueck. */
interface RingBild {
  boegen: Bogen[]; innen: Bogen[] | null;
  arten: Map<string, ArtenBlock>; farbe: Map<string, string>; name: Map<string, string>;
  unter: Map<string, string>; erzaehl: Map<string, string>;
}
interface Geo { w: number; h: number; cx: number; cy: number; R: number; d: number; schrift: boolean; z: number }
let ringBild: RingBild | null = null;
let gezeigt: Bogen[] = [];   // was gerade steht (beim Gleiten zwischen alt und neu, Aufgabe 7)
let wachs = 1;               // 0 bis 1 beim Aufwachsen (Aufgabe 7)
let hervor = "";             // der hervorgehobene Bogen (Aufgabe 6)

function bildAus(d: RingDaten): RingBild {
  const b: RingBild = {boegen: boegen(d.zeilen.map(r => ({key: r.name, wert: r.damage}))), innen: null,
    arten: new Map(), farbe: new Map(), name: new Map(), unter: new Map(), erzaehl: new Map()};
  for(const r of d.zeilen){
    b.farbe.set(r.name, r.color);
    b.name.set(r.name, r.label);
    b.unter.set(r.name, (state.noTime ? "" : fmt(r.dps, 1e3) + " \u00b7 ") + pct(r.share, 0));
    const a = d.arten(r.name);
    if(a) b.arten.set(r.name, a);
    b.erzaehl.set(r.name, erzaehlHtml(r, a));
  }
  return b;
}
/* Was die Mitte beim Zeigen erzaehlt: Name, Schaden, Treffer, Kritanteil, groesster Treffer. */
function erzaehlHtml(r: RingZeile, a: ArtenBlock | null): string {
  return "<b>" + esc(r.label) + "</b> \u00b7 " + esc(fmt(r.damage, 1e3)) + "<br><span>" +
    esc(t("ring.erzaehl", {n: full(r.hits), z: r.hits, krit: r.critRate == null ? "\u2014" : pct(r.critRate),
      max: fmt(a ? a.max : r.max, 1e3)})) + "</span>";
}
/* Die Groesse folgt dem Feld (ringMass, Kern): nebeneinander fuellt die Buehne
   das Ringfeld, gestapelt bekommt sie die Hoehe des Rings plus Luft. Die
   grosse Zahl waechst mit (--ring-zahl, 36 bis 76 Punkt). */
function geometrie(): Geo {
  /* Gemessen wird in Bildschirmpunkten (Rechtecke, Canvas), gerechnet und
     gesetzt in Punkten der Seite: unter der Vergroesserung (zoom auf <html>,
     37) ist ein Punkt der Seite z Bildschirmpunkte. ringMass bekommt Punkte
     der Seite, damit 280 bis 760 und der Platz fuer die Schrift dort gelten. */
  const z = (typeof uiZoomFactor === "function" ? uiZoomFactor() : 1) || 1;
  const buehne = $("#ringBuehne");
  const gestapelt = document.documentElement.matches(".w-max-899,.h-max-699");
  if(gestapelt){
    const hoch = ringMass(buehne.getBoundingClientRect().width / z, Infinity, true).d + 56 + "px";
    if(buehne.style.height !== hoch) buehne.style.height = hoch;
  } else if(buehne.style.height) buehne.style.height = "";
  const r = buehne.getBoundingClientRect();
  const m = ringMass(r.width / z, r.height / z, gestapelt), d = m.d * z;
  const zahl = Math.round(Math.max(36, Math.min(76, m.d * 0.115))) + "px", feld = $("#ringFeld");
  if(feld.style.getPropertyValue("--ring-zahl") !== zahl) feld.style.setProperty("--ring-zahl", zahl);
  /* Die grosse Zahl selbst steht auf dem Mittelpunkt (Entscheidung 03.10.), nicht
     der Block aus Zahl, Einheit und Erzaehlung: die Mitte haengt an der Hoehe
     des Mittelpunkts (--ring-cy), die Zeilen darunter stehen unter der Zahl. */
  const cy = r.height / 2 + (gestapelt ? 0 : 10), mitte = (cy / z).toFixed(1) + "px";
  if(feld.style.getPropertyValue("--ring-cy") !== mitte) feld.style.setProperty("--ring-cy", mitte);
  return {w: r.width, h: r.height, cx: r.width / 2, cy, R: d / 2, d, schrift: m.schrift, z};
}
/* Die gemessene Lage: Groesse des Felds und die gesetzten Schilder. Gemessen
   wird nur, wenn sie fehlt - nach einer neuen Groesse (ResizeObserver), einem
   neuen Bild (ringSetzen) oder beim Betreten des Rings (syncGlutring). Das
   Hervorheben zeichnet oft neu und liest dabei kein Layout. */
interface Lage { g: Geo; q: number; schilder: Schild[] | null }
let lage: Lage | null = null;
function zeichneRing(){
  const cv = $<HTMLCanvasElement>("#ring");
  if(!ringBild || !document.body.classList.contains("glut")) return;
  // ein anderer Zoom des Bildschirms bei gleicher Groesse: neu messen (scharfe Pixel)
  if(lage && lage.q !== (window.devicePixelRatio || 1)) lage = null;
  if(!lage){
    const neu = geometrie(), dpr = window.devicePixelRatio || 1;
    if(neu.w < 1 || neu.h < 1) return;
    lage = {g: neu, q: dpr, schilder: null};
    cv.width = Math.round(neu.w * dpr); cv.height = Math.round(neu.h * dpr);
  }
  const {g, q} = lage;
  gesehen = true;
  const ctx = cv.getContext("2d")!;
  ctx.setTransform(q, 0, 0, q, 0, 0);
  ctx.clearRect(0, 0, g.w, g.h);
  const ease = 1 - Math.pow(1 - wachs, 3);
  const schein = parseFloat(cssv("--glutring-schein")) || 0, innenA = parseFloat(cssv("--glutring-innen")) || 0.5;
  // der Glutschein hinter dem Ring (--ember; im hellen Thema durchsichtig, "Tag ohne Glut")
  const glut = ctx.createRadialGradient(g.cx, g.cy, g.R * 0.2, g.cx, g.cy, g.R * 1.3);
  glut.addColorStop(0, cssv("--ember") || "rgba(0,0,0,0)");
  glut.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glut; ctx.fillRect(0, 0, g.w, g.h);
  const gruppe = !!ringBild.innen;
  const r0 = gruppe ? g.R * 0.73 : g.R * 0.70, r1 = g.R;
  if(ringBild.innen) for(const b of ringBild.innen) bogen(ctx, g, b, g.R * 0.58, g.R * 0.70, ease, innenA, schein, false);
  for(const b of gezeigt) bogen(ctx, g, b, r0, r1, ease, gruppe ? Math.min(1, innenA + 0.2) : innenA, schein, !gruppe);
  /* Beschriftet wird erst, wenn der Ring ganz steht; gesetzt nach dem Ziel
     (ringBild), nicht nach dem Zwischenstand - beim Gleiten misst so kein
     Bild die Ecken neu, und die Schilder springen nicht. */
  let beschriftet: Schild[] = [];
  if(wachs >= 1 && g.schrift){
    if(!lage.schilder) lage.schilder = schilderSetzen(ctx, g, ringBild.innen || ringBild.boegen, r1);
    beschriftet = lage.schilder;
    schilderMalen(ctx, beschriftet, g.z);
  }
  const ds = cv.dataset;
  ds.d = String(g.d); ds.boegen = String(gezeigt.length); ds.innen = String(ringBild.innen ? ringBild.innen.length : 0);
  ds.schrift = g.schrift ? "1" : "0"; ds.beschriftet = String(beschriftet.length);
  ds.schilder = JSON.stringify(beschriftet.map(s => ({k: s.k, l: Math.round(s.l), t: Math.round(s.t), r: Math.round(s.r), b: Math.round(s.b)})));
  ds.hervor = hervor; ds.schein = String(schein);
  ds.mitte = JSON.stringify({x: +g.cx.toFixed(1), y: +g.cy.toFixed(1), r0: +r0.toFixed(1), r1: +r1.toFixed(1)});
  const erster = gezeigt[0] ? ringBild.arten.get(gezeigt[0].key) : undefined;
  ds.randErst = erster ? (erster.zeilen.find(z => z.d > 0)?.kat || "") : "";
  ds.punkte = JSON.stringify(gezeigt.slice(0, 16).map(b => {
    const m = (b.a0 + b.a1) / 2, rr = (r0 + r1) / 2;
    return {k: b.key, x: +(g.cx + Math.cos(m) * rr).toFixed(1), y: +(g.cy + Math.sin(m) * rr).toFixed(1)};
  }));
  const name = beschreibung(ringBild);
  if(cv.getAttribute("aria-label") !== name) cv.setAttribute("aria-label", name);
}
function bogen(ctx: CanvasRenderingContext2D, g: Geo, b: Bogen, r0: number, r1: number, ease: number,
               innenA: number, schein: number, artenRand: boolean){
  if(!ringBild) return;
  const a0 = OBEN + (b.a0 - OBEN) * ease, a1 = OBEN + (b.a1 - OBEN) * ease;
  if(!(a1 > a0)) return;
  // hervorgehoben: der Bogen selbst, oder alle Boegen des gezeigten Mitglieds (Gruppe, Aufgabe 8)
  const hi = !!hervor && (hervor === b.key || hervor === b.key.split("\u0000")[0]);
  const aus = hi ? 6 : 0;
  const farbe = ringBild.farbe.get(b.key) || cssv("--series-rest");
  const verlauf = ctx.createRadialGradient(g.cx, g.cy, r0 + aus, g.cx, g.cy, r1 + aus);
  verlauf.addColorStop(0, farbeMitAlpha(farbe, innenA));
  verlauf.addColorStop(1, farbe);
  ctx.beginPath(); ctx.arc(g.cx, g.cy, r1 + aus, a0, a1); ctx.arc(g.cx, g.cy, r0 + aus, a1, a0, true); ctx.closePath();
  ctx.fillStyle = verlauf;
  if(hi && schein > 0){ ctx.shadowColor = farbe; ctx.shadowBlur = schein; }
  ctx.fill();
  ctx.shadowBlur = 0;
  const arten = artenRand ? ringBild.arten.get(b.key) : undefined;
  if(!arten || !(arten.d > 0)) return;
  let c0 = a0;
  for(const z of arten.zeilen){
    const c1 = c0 + (a1 - a0) * z.d / arten.d;
    if(c1 > c0){
      ctx.beginPath(); ctx.arc(g.cx, g.cy, r1 + 9 + aus, c0, c1);
      ctx.strokeStyle = CAT_SWATCH[z.kat] || farbe; ctx.lineWidth = 4; ctx.stroke();
    }
    c0 = c1;
  }
}
/* Aussen mit Leitlinie: Name (13 Punkt) und "DPS \u00b7 Anteil" (12 Punkt). Oben
   im Ringfeld stehen Satz und Mechanik (#ringLinks) sowie Boss und
   Handlungen (#ringRechts); ein
   Schild, das dort oder an ein anderes stoesst oder aus dem Bild ragt,
   gleitet auf seinem Kreis zur Waagerechten hin, bis es frei steht. Findet
   es keinen Platz, steht der Name nur in der Liste. schilderSetzen misst
   (Sperrflaechen, Schriftbreiten) und gibt die gesetzten Schilder zurueck
   (Kasten in Punkt relativ zum Canvas, dazu was zu malen ist); die Lage
   merkt sie sich, schilderMalen zeichnet sie in jedem Bild ohne Messen. */
interface Kasten { l: number; t: number; r: number; b: number }
interface Schild extends Kasten {
  k: string; name: string; unter: string; rechts: boolean;
  px: number; py: number; x1: number; y1: number;
}
const ECKEN = ["#ringLinks", "#ringMeta", "#ringRechts"] as const;
function sperrflaechen(cv: HTMLCanvasElement): Kasten[] {
  const o = cv.getBoundingClientRect(), luft = 6;
  return ECKEN.map(q => document.querySelector(q)?.getBoundingClientRect()).filter((r): r is DOMRect => !!r && r.width > 0 && r.height > 0)
    .map(r => ({l: r.left - o.left - luft, t: r.top - o.top - luft, r: r.right - o.left + luft, b: r.bottom - o.top + luft}));
}
const schneidet = (a: Kasten, b: Kasten) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
/* Abstand des Punkts (x, y) von der Strecke a-b. */
function abstand(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const k = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
  return Math.hypot(x - ax - k * dx, y - ay - k * dy);
}
function schilderSetzen(ctx: CanvasRenderingContext2D, g: Geo, liste: Bogen[], r1: number): Schild[] {
  if(!ringBild) return [];
  /* Schrift und Abstaende in Punkten der Seite: unter der Vergroesserung (g.z)
     waechst die Beschriftung mit, wie jede andere Schrift. */
  const schrift = cssv("--sans"), z = g.z;
  const rho = r1 + 30 * z;
  const besetzt = sperrflaechen(ctx.canvas);
  const fertig: Schild[] = [];
  for(const b of liste){
    if(!mitSchrift(b)) continue;
    const m = (b.a0 + b.a1) / 2, c = Math.cos(m), s = Math.sin(m), rechts = c >= 0, seite = rechts ? 1 : -1;
    const voll = ringBild.name.get(b.key) || b.key, unter = ringBild.unter.get(b.key) || "";
    ctx.font = 12 * z + "px " + schrift;
    const unterBreit = ctx.measureText(unter).width;
    /* Der Knick der Leitlinie wandert in Schritten von 4 Punkt zur Waagerechten
       durch die Mitte, auf dem Kreis rho - nie ueber sie hinaus, und nur so
       weit, wie die Leitlinie aussen am Rand der Trefferarten vorbeigeht. */
    const zur = s < 0 ? 1 : -1, y0 = g.cy + s * rho;
    const px = g.cx + c * (r1 + 15 * z), py = g.cy + s * (r1 + 15 * z);
    for(let y1 = y0; zur * (g.cy - y1) >= 0; y1 += zur * 4){
      const x1 = g.cx + seite * Math.sqrt(Math.max(0, rho * rho - (y1 - g.cy) ** 2)), tx = x1 + seite * 20 * z;
      if(abstand(g.cx, g.cy, px, py, x1, y1) < r1 + 13 * z) break;
      /* Gekuerzt wird nach dem Platz auf dieser Seite an dieser Hoehe (bis
         4 Punkt vor den Rand), nicht nach einem gleichen Mass fuer beide Seiten. */
      ctx.font = "600 " + 13 * z + "px " + schrift;
      const name = kuerzen(ctx, voll, (rechts ? g.w - tx : tx) - 4 * z);
      const breit = Math.max(ctx.measureText(name).width, unterBreit);
      const kasten: Schild = {k: b.key, name, unter, rechts, px, py, x1, y1,
        l: rechts ? tx : tx - breit, r: rechts ? tx + breit : tx, t: y1 - 15 * z, b: y1 + 17 * z};
      const frei = kasten.l >= 0 && kasten.r <= g.w && kasten.t >= 0 && kasten.b <= g.h &&
        !besetzt.some(e => schneidet(kasten, e)) && !fertig.some(e => schneidet(kasten, e));
      if(frei){ fertig.push(kasten); break; }
    }
  }
  return fertig;
}
function schilderMalen(ctx: CanvasRenderingContext2D, schilder: readonly Schild[], z: number){
  if(!schilder.length) return;
  const tinte = cssv("--text"), leise = cssv("--dim"), linie = cssv("--ridge"), schrift = cssv("--sans");
  for(const s of schilder){
    const seite = s.rechts ? 1 : -1, x2 = s.x1 + seite * 14 * z, tx = x2 + seite * 6 * z;
    ctx.strokeStyle = linie; ctx.lineWidth = z;
    ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x1, s.y1); ctx.lineTo(x2, s.y1); ctx.stroke();
    ctx.textAlign = s.rechts ? "left" : "right";
    ctx.fillStyle = tinte; ctx.font = "600 " + 13 * z + "px " + schrift;
    ctx.fillText(s.name, tx, s.y1 - 2 * z);
    ctx.fillStyle = leise; ctx.font = 12 * z + "px " + schrift;
    ctx.fillText(s.unter, tx, s.y1 + 13 * z);
  }
}
function kuerzen(ctx: CanvasRenderingContext2D, s: string, max: number): string {
  if(max <= 0 || ctx.measureText(s).width <= max) return s;
  let n = s.length;
  while(n > 1 && ctx.measureText(s.slice(0, n) + "\u2026").width > max) n--;
  return s.slice(0, n) + "\u2026";
}
/* "Ring: Beschuss 22 %, Detonierendes Mal 20 %, ..." - die ersten acht. */
function beschreibung(b: RingBild): string {
  const liste = b.innen || b.boegen;
  const teile = liste.slice(0, 8).map(x => (b.name.get(x.key) || x.key) + " " + pct(x.anteil, 0)).join(", ") +
    (liste.length > 8 ? ", \u2026" : "");
  return t(b.innen ? "ring.bildGruppe" : "ring.bild", {teile});
}
/* ---------- Bewegung (Spezifikation 3) ----------
   Beim Oeffnen (das erste Bild des Rings) waechst er in 0,9 s im
   Uhrzeigersinn auf, ease-out. Jede andere Aenderung - ein anderer Kampf, ein
   Live-Takt, eine andere Gruppierung, auch beim Zurueck aus einem anderen
   Bereich oder aus Kompakt - laesst die Boegen in 0,4 s in ihre neuen
   Groessen gleiten; ist das Bild dasselbe, steht er sofort. Bei reduzierter
   Bewegung steht er sofort. Die Uhr ist die von requestAnimationFrame. */
const WACHS_MS = 900, GLEIT_MS = 400;
let gesehen = false;          // ob der Ring schon einmal gezeichnet wurde (syncGlutring)
let frisch = true, wachsAb = 0, gleitAb = 0, gleitVon: Bogen[] = [], ziel: Bogen[] = [], takt = 0;
const ruhig = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const gleich = (a: readonly Bogen[], b: readonly Bogen[]) => a.length === b.length &&
  a.every((x, i) => x.key === b[i]!.key && Math.abs(x.a0 - b[i]!.a0) < 1e-6 && Math.abs(x.a1 - b[i]!.a1) < 1e-6);
function bewegen(neu: Bogen[]){
  const vorher = gezeigt;
  ziel = neu;
  if(ruhig()){ frisch = false; wachs = 1; gleitAb = 0; gezeigt = neu; schreibeBewegung(); zeichneRing(); return; }
  if(frisch){ frisch = false; wachs = 0; wachsAb = -1; gleitAb = 0; gezeigt = neu; }
  else if(gleich(vorher, neu) || !vorher.length){ gezeigt = neu; if(!gleitAb && wachs >= 1){ zeichneRing(); return; } }
  else { gleitVon = vorher; gleitAb = -1; }
  schreibeBewegung();
  zeichneRing();
  if(!takt) takt = requestAnimationFrame(schritt);
}
function schritt(jetzt: number){
  takt = 0;
  if(wachs < 1){
    if(wachsAb < 0) wachsAb = jetzt;
    wachs = Math.min(1, (jetzt - wachsAb) / WACHS_MS);
  }
  if(gleitAb){
    if(gleitAb < 0) gleitAb = jetzt;
    const f = Math.min(1, (jetzt - gleitAb) / GLEIT_MS);
    gezeigt = zwischen(gleitVon, ziel, 1 - Math.pow(1 - f, 3));
    if(f >= 1){ gleitAb = 0; gezeigt = ziel; }
  }
  schreibeBewegung();
  zeichneRing();
  if(wachs < 1 || gleitAb) takt = requestAnimationFrame(schritt);
}
/* Fuer Pruefungen, sofort und nicht erst im naechsten Bild. */
function schreibeBewegung(){
  const ds = $<HTMLCanvasElement>("#ring").dataset;
  ds.fertig = wachs >= 1 ? "1" : "0";
  ds.gleitet = gleitAb ? "1" : "0";
}

/* Das neue Bild setzen (die Lage wird einmal neu gemessen: Text und Ecken
   koennen sich geaendert haben), dann wachsen oder gleiten. */
let bildKampf: number | null = null;
function ringSetzen(d: RingDaten, kampf: number){
  ringBild = d.modus === "gruppe" ? bildGruppe(d.zeilen) : bildAus(d);
  lage = null;
  /* Was hervorgehoben war, folgt dem neuen Bild (Live, Sprache): die Mitte
     erzaehlt aus ihm neu. Ein anderer Kampf oder ein Schluessel, den das neue
     Bild nicht kennt, leert das Hervorheben - Zeile, Mitte und Spur. */
  if(hervor){
    const html = kampf === bildKampf ? ringBild.erzaehl.get(hervor) || ringBild.erzaehl.get(hervor.split("\u0000")[0]!) || "" : "";
    if(html){ const f = $("#ringFokus"); if(f.innerHTML !== html) f.innerHTML = html; }
    else hervorLeeren();
  }
  bildKampf = kampf;
  bewegen(ringBild.boegen);
}
function hervorLeeren(){
  const war = hervor;
  hervor = "";
  $("#bars").querySelectorAll<HTMLElement>(".ringzeile.ringan").forEach(z => z.classList.remove("ringan"));
  $("#ringFokus").innerHTML = "";
  if(war && state.kurveSkill === war){ state.kurveSkill = ""; renderKurve(); }
}

/* ---------- Hervorheben (Spezifikation 3) ----------
   Zeigen auf einen Bogen oder eine Zeile (Maus oder Fokus) hebt beide
   hervor: der Bogen tritt 6 Punkt nach aussen und glueht in seiner Farbe
   (--glutring-schein, im hellen Thema 0), die Zeile steht im Auswahlton,
   die Mitte erzaehlt ihn, und die Kurve zeigt seine Spur wie beim Zeigen
   auf eine Zeile (56). Das Neuzeichnen nimmt die gemerkte Lage (lage),
   misst also nichts neu. */
function zeige(key: string){
  if(key === hervor) return;
  hervor = key;
  const zeile = key.split("\u0000")[0]!;
  $("#bars").querySelectorAll<HTMLElement>(".ringzeile").forEach(z => z.classList.toggle("ringan", !!key && z.dataset.ring === zeile));
  const html = key && ringBild ? ringBild.erzaehl.get(key) || ringBild.erzaehl.get(zeile) || "" : "";
  const f = $("#ringFokus");
  if(f.innerHTML !== html) f.innerHTML = html;
  if(state.group === "skill"){
    const spur = key && ringBild && ringBild.name.has(key) ? key : "";
    if(spur !== state.kurveSkill){ state.kurveSkill = spur; renderKurve(); }
  }
  zeichneRing();
}
/* Welcher Bogen liegt unter dem Zeiger? Lage und Radien schreibt zeichneRing an den Canvas. */
function bogenUnter(e: MouseEvent): string {
  if(!ringBild) return "";
  const cv = $<HTMLCanvasElement>("#ring"), r = cv.getBoundingClientRect();
  const m = JSON.parse(cv.dataset.mitte || "null") as {x: number; y: number; r0: number; r1: number} | null;
  if(!m) return "";
  const dx = e.clientX - r.left - m.x, dy = e.clientY - r.top - m.y, abst = Math.hypot(dx, dy), w = winkelNorm(Math.atan2(dy, dx));
  if(ringBild.innen && abst >= m.r1 * 0.58 && abst <= m.r1 * 0.70 + 3) return bogenBei(ringBild.innen, w)?.key || "";
  if(abst >= m.r0 && abst <= m.r1 + 20) return bogenBei(gezeigt, w)?.key || "";
  return "";
}
/* Klick auf einen Bogen klappt in der Liste dieselbe Zeile auf (Spezifikation 3).
   Der Ring zeigt eine Faehigkeit (Entscheidung 03.10.): die vorher offenen klappen
   zu, ein zweiter Klick auf denselben Bogen klappt auch diese zu. In der
   Liste selbst bleiben mehrere offen. */
function klickAufBogen(key: string){
  // in der Gruppe oeffnet ein Mitglied (innen) oder eine seiner Faehigkeiten (aussen) seinen Ring
  if(state.group === "party" && !mitglied){ mitgliedOeffnen(key.split("\u0000")[0]!, false); return; }
  const zeile = key.split("\u0000")[0]!;
  selbstGeklappt = true;
  const war = offen.has(zeile) && offen.size === 1;
  offen.clear();
  if(!war) offen.add(zeile);
  renderGlutring();
  [...$("#bars").querySelectorAll<HTMLElement>(".ringzeile")].find(z => z.dataset.ring === zeile)?.scrollIntoView({block: "nearest"});
}

/* "Klasse \u00b7 Klick oeffnet seinen Ring" - ohne Klasse faellt der Teil davor samt Trenner weg. */
function erzaehlMitglied(klasse: string): string {
  const satz = t("ring.erzaehlMitglied", {klasse});
  return klasse ? satz : satz.replace(/^\s*\u00b7\s*/, "");
}
/* Innen die Mitglieder in ihrer festen Farbe (mitgliedIndex, 19), aussen
   ihre Faehigkeiten im Bogen ihres Mitglieds, in seiner Farbe und leiser. */
function bildGruppe(zeilen: RingZeile[]): RingBild {
  const innen = boegen(zeilen.map(r => ({key: r.name, wert: r.damage})));
  const b: RingBild = {boegen: [], innen, arten: new Map(), farbe: new Map(), name: new Map(), unter: new Map(), erzaehl: new Map()};
  for(const m of innen){
    const r = zeilen.find(z => z.name === m.key)!;
    b.farbe.set(r.name, r.color); b.name.set(r.name, r.label);
    b.unter.set(r.name, fmt(r.dps, 1e3) + " \u00b7 " + pct(m.anteil, 0));
    b.erzaehl.set(r.name, "<b>" + esc(r.label) + "</b> \u00b7 " + esc(fmt(r.dps, 1e3)) + "<br><span>" +
      esc(erzaehlMitglied(klasseVon(r.name))) + "</span>");
    for(const x of boegen(r.subs.map(s => ({key: r.name + "\u0000" + s.key, wert: s.damage || 0})), m.a0, m.a1 - m.a0, FUGE / 2)){
      const s = r.subs.find(y => r.name + "\u0000" + y.key === x.key)!;
      b.boegen.push(x);
      b.farbe.set(x.key, r.color); b.name.set(x.key, s.label);
      b.erzaehl.set(x.key, "<b>" + esc(s.label) + "</b> \u00b7 " + esc(fmt(s.damage, 1e3)) + "<br><span>" + esc(r.label) + "</span>");
    }
  }
  return b;
}
/* Die Mitte in der Gruppe: die Gruppen-DPS schreibt 20 in #hDps, darunter
   "Du 504.3k \u00b7 Platz 2 von 5" (nach DPS, nur mit eigenem Namen im Board,
   E 11); im Ring eines Mitglieds seine DPS statt der Gruppe. */
function mitteSetzen(d: RingDaten){
  const ich = (state.party && state.party.name) || "", du = $("#ringDu");
  let text = "";
  if(d.modus === "gruppe" && ich){
    const nach = d.zeilen.slice().sort((a, b) => b.dps - a.dps), i = nach.findIndex(r => r.name === ich);
    if(i >= 0) text = t("ring.du", {dps: fmt(nach[i]!.dps, 1e3), platz: i + 1, n: nach.length});
  }
  if(du.textContent !== text) du.textContent = text;
  du.hidden = !text;
  const m = d.modus === "mitglied" ? partyGroupRows().find(r => r.name === mitglied) : undefined;
  $("#ringMitglied").hidden = !m;
  if(m){
    $("#ringMitgliedZahl").textContent = fmt(m.dps);
    $("#ringMitgliedEinheit").textContent = t("ring.mitgliedEinheit", {name: m.label});
  }
}
/* Das Band in der Gruppe (E 11 der Spezifikation 5): der Anteil je Mitglied
   als gestapelter Balken ueber die volle Breite - eine Kurve je Mitglied
   gibt es nicht, die Mitglieder melden nur Summen. */
function bandTitel(gruppe: boolean){
  /* Ueber dem Band und als Name des Felds: in der Gruppe "Anteil je Mitglied",
     sonst "Schaden pro Sekunde". Ueber data-i18n, damit ein Sprachwechsel (31)
     den richtigen Schluessel nimmt. */
  const k = gruppe ? "ring.bandGruppe" : "tafel.kurve", titel = $("#kurveTitel"), feld = $("#kurveFeld");
  if(titel.dataset.i18n !== k){ titel.dataset.i18n = k; feld.dataset.i18nAriaLabel = k; }
  const text = t(k);
  if(titel.textContent !== text) titel.textContent = text;
  if(feld.getAttribute("aria-label") !== text) feld.setAttribute("aria-label", text);
}
function bandGruppe(d: RingDaten){
  const box = $("#bandGruppe"), an = d.modus !== "allein";
  box.hidden = !an;
  bandTitel(an);
  if(!an) return;
  const alle: RingZeile[] = partyGroupRows();
  const summe = alle.reduce((a, r) => a + (r.damage || 0), 0) || 1;
  const reihe = alle.slice().sort((a, b) => b.damage - a.damage);
  const html = reihe.map(r => '<i data-m="' + esc(r.name) + '" class="' + (r.name === mitglied ? "an" : "") + '" style="flex-grow:' +
    (r.damage / summe).toFixed(4) + ";--c:" + esc(r.color) + '" title="' + esc(r.label + " " + pct(r.damage / summe)) + '"><span>' +
    esc(r.label + " " + pct(r.damage / summe, 0)) + "</span></i>").join("");
  if(box.innerHTML !== html) box.innerHTML = html;
  box.setAttribute("aria-label", t("ring.bandGruppeBild", {teile: reihe.map(r => r.label + " " + pct(r.damage / summe, 0)).join(", ")}));
}
/** Den Ring eines Mitglieds oeffnen (Klick, Enter) oder zur Gruppe zurueck (null: "\u2039 Gruppe", Esc). */
function mitgliedOeffnen(name: string | null, tastatur: boolean){
  const vorher = mitglied;
  mitglied = name;
  zeige("");   // was hervorgehoben war, gehoert zum anderen Ring
  renderGlutring();
  if(!tastatur) return;
  const box = $("#bars");
  if(name) box.querySelector<HTMLElement>(".ringzeile")?.focus();
  else if(vorher) box.querySelector<HTMLElement>('.ringzeile[data-member="' + CSS.escape(vorher) + '"]')?.focus();
}

/* Band und Urteil als gemeinsame Fusszeile (Fixrunde 1 zu Aufgabe 10):
   nebeneinander sind beide gleich hoch, so laeuft ueber dem Band und dem
   Urteil eine Fuge quer ueber das Raster, und die Flaeche darueber gehoert
   zur Liste. Beide werden ohne Mindesthoehe gemessen (Punkte der Seite,
   offsetHeight) und bekommen die groessere als Mindesthoehe. Gestapelt, in
   der Gruppe (kein Urteil) und ausserhalb des Rings gilt keine. */
function fussAngleichen(){
  const band = $("#kurveFeld"), urteil = $("#urteilFeld");
  const gilt = document.body.classList.contains("glut") && !document.documentElement.matches(".w-max-899,.h-max-699") &&
    urteil.getClientRects().length > 0 && band.getClientRects().length > 0;
  const vorher = band.style.minHeight;
  band.style.minHeight = ""; urteil.style.minHeight = "";
  if(!gilt) return;
  const h = Math.max(band.offsetHeight, urteil.offsetHeight) + "px";
  band.style.minHeight = h; urteil.style.minHeight = h;
  // die Buehne wird dabei kleiner oder groesser: der Ring misst neu
  if(vorher !== h){ lage = null; zeichneRing(); }
}

/** Zeichnet im Bereich Kampf der vollen Ansicht die Liste, den Ring, die Mitte und in der Gruppe das Band. */
export function renderGlutring(){
  if(!tafelGilt()) return;
  const seg = state.encounters[state.sel];
  if(!seg) return;
  rennenPruefen();
  if(!seg.stats) seg.stats = stats(seg);
  const d = ringDaten(seg);
  document.body.classList.toggle("ringgruppe", d.modus !== "allein");
  document.body.classList.toggle("ringmitglied", d.modus === "mitglied");
  $("#ringZurueck").hidden = d.modus !== "mitglied";
  renderRingListe(seg, d);
  ringSetzen(d, seg.start);
  mitteSetzen(d);
  bandGruppe(d);
  fussAngleichen();
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  // die Buehne aendert ihre Groesse mit dem Fenster und dem Raster: neu zeichnen, ohne neu zu rechnen
  if(typeof ResizeObserver !== "undefined") new ResizeObserver(() => { lage = null; zeichneRing(); }).observe($("#ringBuehne"));
  /* Die Ecken des Ringfelds aendern ihre Groesse auch ohne neues Bild: der
     Verlauf kommt an (#hHist, 41), ein Knopf erscheint (syncBestBtn). Die
     Schilder weichen den Ecken aus (sperrflaechen), also wird die Lage dann
     verworfen. Nur bei einer wirklich anderen Groesse: zeichneRing schreibt
     an der Buehne und am Feld, nicht an den Ecken - keine Schleife. */
  if(typeof ResizeObserver !== "undefined"){
    const masse = new Map<Element, string>();
    const ecken = new ResizeObserver(eintraege => {
      let anders = false;
      for(const e of eintraege){
        const r = e.contentRect, m = r.width.toFixed(1) + "x" + r.height.toFixed(1);
        if(masse.get(e.target) !== m){ masse.set(e.target, m); anders = true; }
      }
      if(anders && lage){ lage = null; zeichneRing(); }
    });
    for(const q of ECKEN){ const el = document.querySelector(q); if(el) ecken.observe(el); }
  }
  /* Was die Hoehe der Fusszeile aendert: das Urteil (neuer Text), die Kurve
     (aus- und eingeklappt), der Balken der Gruppe, die Breite des Fensters */
  if(typeof ResizeObserver !== "undefined"){
    const fuss = new ResizeObserver(() => fussAngleichen());
    for(const q of ["#urteilInhalt", ".uknoepfe", "#kurve", "#kurveReihen", "#bandGruppe", "#kurveFeld .feldkopf", "#ringFeld"]){
      const el = document.querySelector(q); if(el) fuss.observe(el);
    }
  }
  const cv = $<HTMLCanvasElement>("#ring");
  cv.addEventListener("mousemove", e => { const k = bogenUnter(e); zeige(k); cv.style.cursor = k ? "pointer" : ""; });
  cv.addEventListener("mouseleave", () => zeige(""));
  cv.addEventListener("click", e => { const k = bogenUnter(e); if(k) klickAufBogen(k); });
  $("#ringZurueck").addEventListener("click", () => mitgliedOeffnen(null, true));
  /* Esc fuehrt aus dem Ring eines Mitglieds zur Gruppe zurueck - nur aus der
     Flaeche heraus, nicht aus einem Dialog oder der Kampfwahl, und nicht,
     wenn ein anderer Teil die Taste schon genommen hat. Ist das Rennen (65)
     offen, gehoert Esc ihm: es lauscht ebenfalls am Dokument, nach diesem.
     Die Kampfwahl lauscht an window, also nach diesem Hoerer und ohne Blick
     auf defaultPrevented - darum hier ausdruecklich (wie in 65). */
  document.addEventListener("keydown", e => {
    if(e.key !== "Escape" || e.defaultPrevented || !mitglied || rennenOffen() || !document.body.classList.contains("glut") ||
       kampfwahlOffen() || obenOffen()) return;
    const ziel = e.target as HTMLElement | null;
    if(ziel && ziel !== document.body && !$("#app").contains(ziel)) return;
    e.preventDefault();
    mitgliedOeffnen(null, true);
  });
  const bars = $("#bars"), imRing = () => document.body.classList.contains("glut");
  const ausZeile = (el: EventTarget | null) => {
    const z = el instanceof Element ? el.closest<HTMLElement>("[data-ring]") : null;
    return z && bars.contains(z) ? z.dataset.ring! : "";
  };
  bars.addEventListener("mouseover", e => { if(imRing()) zeige(ausZeile(e.target)); });
  bars.addEventListener("mouseleave", () => { if(imRing()) zeige(ausZeile(document.activeElement)); });
  bars.addEventListener("focusin", e => { if(imRing()) zeige(ausZeile(e.target)); });
  bars.addEventListener("focusout", e => { if(imRing() && !bars.contains(e.relatedTarget as Node | null)) zeige(""); });
}
