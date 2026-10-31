import { state } from "./01-state";
import { anzahl, fmt } from "./03-helpers";
import { t } from "./08-translation";
import { skillEntry, skillKey } from "./10-skill-names";
import { skillIcon } from "./12-boss-images";
import { skillLabel } from "./14-questlog-weapons";
import { casts, VENTIUS_ID, VENTIUS_NAME, ventiusMix } from "./15-weapons-and-ventius";
import { isAutoWeapon, num1, pct, weaponFor } from "./16-fight-analysis";
import { schnittKey } from "./05-fights";
import { $, clock, esc } from "./18-interface-basics";
import { lueckenStand, renderAnalysis, ventiusFehlend, ventiusVerlust } from "./26-analysis-tab";
import { isWatching } from "./45-startup";
import { bezugVon } from "./47-paar";
import { fensterAbschnitt, poolFights, type FensterStand } from "./53-fenster";
import { ventiusAbschnittDa, zuVentius } from "./62-rekorde";
import { streifenKerben } from "./70-kampfstreifen";
import {
  AUS_MIN_MS, ausStrecken, faecherOrdnen, hitze, median, MITTEL_MAX, packen, taktLaeufe, taktMitLaeufen, zeilenBefund, type FArt, type ZeilenBefund
} from "../analyse-core";
import type { Fight, Insight, SkillCast } from "../types";

/* ---------- die Werkbank je Faehigkeit (Issue #218, Spezifikation 2026-10-07, 3) ----------
   In #findings unter dem Kampfstreifen: je Faehigkeit ein Fach oder eine
   Zeile. Das Hauptfach (Meister Schaden) links, bis zu drei mittlere Faecher
   daneben, gepackt ohne leere Zelle (packen, ../analyse-core.ts); darunter
   die Zeilen "Laufzeit" (im Takt oder dicht wie Protest von Mutter Natur),
   "Weitere Faehigkeiten" und "Passiv" - jede Ueberschrift nur mit Inhalt.
   Jedes Fach zeigt seine Einsaetze als Glut-Striche (Hitze nach Krit und
   stark), einen Satz und "Mehr zu ..." mit den Zahlen; das Ventius-Fach
   seine Salven als Perlen und die Zahlen des frueheren Kastens; das
   Hauptfach traegt die Frage nach dem Fenster (#45). Der groesste Treffer
   und die Fehlschlaege stehen im Fach ihrer Faehigkeit. Zeigen oder Fokus
   auf ein Fach oder eine Zeile zeichnet ihre Einsaetze als Kerben in den
   Streifen (streifenKerben, 70). Der beste Pull desselben Builds kommt als
   BestCasts herein (bestCasts, 26): gespiegelt unter den Strichen, als
   duenne Linie unter einer Laufzeit und als Spalte der Tabelle. */

/** Die Einsaetze des besten Pulls je Faehigkeit (Name aus dem Log), t in ms
    ab seinem Beginn; null ohne Bezug. */
export type BestCasts = Map<string, SkillCast[]>;

/* ---------- welche Faehigkeit wohin (Spezifikation 3.1) ----------
   Passiv: die Waffentabelle sagt "Passive" (wie grundVon in 54), dazu die
   ausgeloesten Treffer Sturmstroemung und Roxies Pfeilspitze (Entscheidung
   vom 08.10.; die Waffentabelle bleibt). Laufzeit im Takt nur, wenn die Treffer
   derselben Faehigkeit am selben Ziel ueber die Pulls desselben Builds im
   festen 1-s-Takt kommen (Abstaende 250 bis 6000 ms) UND in kurzen Laeufen
   (Median hoechstens 20 s, Ruling 13: was den ganzen Kampf im Sekundentakt
   trifft, ist gedrueckt); Toedliche Viper verfehlt das meist und steht dann
   als Einsatz-Faehigkeit (Messung vom 09.10.). Protest von Mutter Natur ist
   "dicht". Ventius bekommt immer ein Fach (Ruling 14). */
const PASSIV_EN = new Set(["Storm Current", "Roxie's Arrowhead"]);
const TAKT_AB_MS = 250, TAKT_BIS_MS = 6000;
export interface WbFaehigkeit { k: string; sid: string; dmg: number; hits: number; crit: number; heavy: number; art: FArt }
export interface WbOrdnung {
  liste: Map<string, WbFaehigkeit>;
  haupt: string | null; mittel: string[]; weitere: string[]; lauf: string[]; passiv: string[];
}
const ordnungMerk = new WeakMap<Fight, { stempel: string; o: WbOrdnung }>();

function sidVon(seg: Fight): Map<string, string> {
  const m = new Map<string, string>();
  for(const e of seg.events) if(e.sid && !m.has(e.skill)) m.set(e.skill, e.sid);
  return m;
}

/* Die Schluessel (skillKey, beide Sprachen) der Faehigkeiten im Takt. Der
   Pool ist derselbe wie beim Fenster (53, gesucht): gemerkt nach Build oder
   Kampf, Zahl der Kaempfe, unter Live nach dem juengsten fertigen Kampf
   (der laufende waechst jeden Takt, gehoert aber nicht zum Pool), Waffen und
   Uhr - so rechnet Live nicht alle zwei Sekunden alle Pulls neu. In derselben
   Schleife die Laeufe je Kampf und Ziel (taktLaeufe) fuer Ruling 13. */
let taktMerk: { stempel: string; im: Set<string> } | null = null;
function imTaktUeberPool(seg: Fight): Set<string> {
  const live = isWatching(), b = bezugVon(seg);
  const stempel = [schnittKey(), b ? JSON.stringify(b) : "seg" + seg.start + "|" + seg.events.length,
    state.encounters.length, live ? state.encounters[1]?.events.length ?? 0 : "", live,
    Object.keys(state.weaponOf).length, Object.keys(state.weaponById).length, state.noTime].join("|");
  if(taktMerk && taktMerk.stempel === stempel) return taktMerk.im;
  const abst = new Map<string, number[]>(), laeufe = new Map<string, number[]>();
  const dazu = (m: Map<string, number[]>, k: string, x: number) => { let a = m.get(k); if(!a){ a = []; m.set(k, a); } a.push(x); };
  for(const f of poolFights(seg)){
    // je Faehigkeit und Ziel die Zeiten der Treffer
    const zeiten = new Map<string, Map<string, number[]>>();
    for(const e of f.events){
      if(e.skill === VENTIUS_NAME) continue;
      const k = skillKey(e.skill, e.sid);
      let jeZiel = zeiten.get(k); if(!jeZiel){ jeZiel = new Map(); zeiten.set(k, jeZiel); }
      let z = jeZiel.get(e.target); if(!z){ z = []; jeZiel.set(e.target, z); }
      z.push(e.t);
    }
    for(const [k, jeZiel] of zeiten) for(const z of jeZiel.values()){
      for(let i = 1; i < z.length; i++){ const d = z[i]! - z[i-1]!; if(d >= TAKT_AB_MS && d <= TAKT_BIS_MS) dazu(abst, k, d); }
      for(const [a, b] of taktLaeufe(z).laeufe) dazu(laeufe, k, b - a);
    }
  }
  const im = new Set<string>();
  for(const [k, a] of abst) if(taktMitLaeufen(a, laeufe.get(k) || [])) im.add(k);
  taktMerk = {stempel, im};
  return im;
}

/* Die Reihenfolge der Fragen zaehlt: Takt vor Passiv - eine Faehigkeit, die
   die Waffentabelle "Passive" nennt, aber als Dauerschaden tickt (Toedliche
   Viper), gehoert zur Laufzeit; tickt sie nicht, ist sie ein Einsatz (Ruling
   5), keine passive. */
function artVon(name: string, sid: string, takt: Set<string>): FArt {
  if(name === VENTIUS_NAME) return "ventius";
  const en = skillEntry(name, sid)?.en || "";
  if(en === "Mother Nature's Protest") return "dicht";
  if(takt.has(skillKey(name, sid))) return "takt";
  if(en === "Deadly Viper") return "einsatz";
  if(PASSIV_EN.has(en)) return "passiv";
  if(weaponFor(name, sid) === "Passive" && isAutoWeapon(name, sid)) return "passiv";
  return "einsatz";
}

/** Die Ordnung der Faecher fuer einen Kampf - dieselbe Quelle fuer die
    Werkbank und "Meister Schaden" in der Kennzeile (26). */
export function faecherVonKampf(seg: Fight): WbOrdnung {
  const takt = state.noTime ? new Set<string>() : imTaktUeberPool(seg);
  const stempel = [seg.end, seg.events.length, [...takt].join(","), state.noTime,
    Object.keys(state.weaponOf).length, Object.keys(state.weaponById).length].join("|");
  const alt = ordnungMerk.get(seg);
  if(alt && alt.stempel === stempel) return alt.o;
  const sid = sidVon(seg);
  const liste = new Map<string, WbFaehigkeit>();
  for(const s of seg.stats.skills){
    if(!(s.damage > 0)) continue;
    const id = sid.get(s.name) || "";
    liste.set(s.name, {k: s.name, sid: id, dmg: s.damage, hits: s.hits, crit: s.crit, heavy: s.heavy, art: artVon(s.name, id, takt)});
  }
  const o: WbOrdnung = {liste, ...faecherOrdnen([...liste.values()])};
  /* Ruling 14: Auge von Ventius hat immer ein Fach (Perlen, Zahlen, "Zum
     Beleg"). Liegt es unter "Weitere", nimmt es den letzten mittleren Platz;
     wer dort stand, rueckt nach "Weitere" (nach Schaden geordnet). */
  const vi = o.weitere.indexOf(VENTIUS_NAME);
  if(vi >= 0){
    o.weitere.splice(vi, 1);
    if(o.mittel.length >= MITTEL_MAX){ o.weitere.push(o.mittel.pop()!); o.weitere.sort((a, b) => liste.get(b)!.dmg - liste.get(a)!.dmg); }
    o.mittel.push(VENTIUS_NAME);
  }
  ordnungMerk.set(seg, {stempel, o});
  return o;
}

/* ---------- was je Faehigkeit gezeichnet und gesagt wird ----------
   Zeiten in ms ab dem Beginn des Kampfes. Je Kampf gemerkt (wie oben). */
interface WbSpur {
  k: string; einsaetze: SkillCast[]; treffer: number[];
  laeufe: [number, number][]; lief: number; aus: [number, number][];
}
interface WbModell { T: number; spuren: Map<string, WbSpur> }
const modellMerk = new WeakMap<Fight, { stempel: string; m: WbModell }>();
function modell(seg: Fight, o: WbOrdnung): WbModell {
  const stempel = seg.end + "|" + seg.events.length + "|" + o.lauf.join(",") + "|" + o.passiv.join(",");
  const alt = modellMerk.get(seg);
  if(alt && alt.stempel === stempel) return alt.m;
  const T = Math.max(1, seg.end - seg.start);
  const cs = casts(seg);
  const treffer = new Map<string, number[]>();
  // passive Treffer werden nicht gedrueckt: sie zeichnen je Treffer einen Strich, keine Einsaetze
  const passivTreffer = new Map<string, SkillCast[]>();
  const fremdeOhnePassiv = new Map<string, number[]>();
  const passiv = new Set(o.passiv);
  for(const e of seg.events){
    let a = treffer.get(e.skill); if(!a){ a = []; treffer.set(e.skill, a); }
    a.push(e.t - seg.start);
    if(passiv.has(e.skill)){
      let q = passivTreffer.get(e.skill); if(!q){ q = []; passivTreffer.set(e.skill, q); }
      const z = e.t - seg.start;
      q.push({t: z, last: z, dmg: e.dmg, hits: 1, crit: e.crit ? 1 : 0, heavy: e.heavy ? 1 : 0});
    }
  }
  const spuren = new Map<string, WbSpur>();
  for(const f of o.liste.values()){
    const z = treffer.get(f.k) || [];
    const sp: WbSpur = {k: f.k, einsaetze: f.art === "passiv" ? passivTreffer.get(f.k) || []
      : (cs.get(f.k) || []).map(c => ({...c, t: c.t - seg.start, last: c.last - seg.start})),
      treffer: z, laeufe: [], lief: 0, aus: []};
    if(f.art === "takt"){
      const r = taktLaeufe(z);
      sp.laeufe = r.laeufe; sp.lief = r.lief;
    } else if(f.art === "dicht"){
      /* "aus": mindestens 4 s ohne Protest, waehrend andere (nicht passive)
         Faehigkeiten mindestens dreimal trafen (Spezifikation 5.5) */
      let fremde = fremdeOhnePassiv.get(f.k);
      if(!fremde){
        fremde = [];
        for(const e of seg.events) if(e.skill !== f.k && !passiv.has(e.skill)) fremde.push(e.t - seg.start);
        fremdeOhnePassiv.set(f.k, fremde);
      }
      sp.aus = ausStrecken(z, fremde, T);
      // Laeufe mit derselben Grenze wie "aus" (4 s), fuer Satz und Bild
      sp.laeufe = laeufeMit(z, AUS_MIN_MS);
      sp.lief = sp.laeufe.reduce((s, [a, b]) => s + b - a, 0);
    }
    spuren.set(f.k, sp);
  }
  const m = {T, spuren};
  modellMerk.set(seg, {stempel, m});
  return m;
}
/* Strecken, in denen die Treffer hoechstens `luft` auseinanderliegen. */
function laeufeMit(z: readonly number[], luft: number): [number, number][] {
  const r: [number, number][] = [];
  let a = -1, p = -1;
  for(const x of z){
    if(a < 0){ a = x; p = x; continue; }
    if(x - p > luft){ r.push([a, p]); a = x; }
    p = x;
  }
  if(a >= 0) r.push([a, p]);
  return r;
}

const glut = (c: SkillCast) => hitze(c.hits ? c.crit/c.hits : 0, c.hits ? (c.heavy || 0)/c.hits : 0);
const HITZE = ["var(--h0)", "var(--h1)", "var(--h2)", "var(--h3)"];

/* ---------- die Saetze (Spezifikation 5.2) ---------- */
/* kurz: die Kurzform fuer die Zeile, wenn der ganze Satz unter der Gruppe steht */
function satzVon(seg: Fight, f: WbFaehigkeit, sp: WbSpur, T: number): { t: string; befund: boolean; kurz?: string } {
  if(f.art === "ventius"){
    const v = ventiusFehlend(seg), m = ventiusMix(seg);
    // die Salven, die sich nicht lesen liessen, nennt jeder Satz (die Perlen sind fuer den Vorleser stumm)
    const unlesbar = m.off ? " "+t("analysis.wb.ventUnlesbar", {n: anzahl(m.off)}) : "";
    if(v){
      const zeiten: number[] = m.zeiten || [], folge: number[] = m.folge || [];
      const unter: number[] = [];
      folge.forEach((w, i) => { if(w > 0 && w < m.top) unter.push(zeiten[i] ?? seg.start); });
      const uhr = (z: number | undefined) => clock(Math.max(0, ((z ?? seg.start) - seg.start)/1000));
      const von = uhr(unter[0]), bis = uhr(unter[unter.length - 1]);
      const w = v.unten.map(r => r.waves), lo = Math.min(...w), hi = Math.max(...w);
      return {befund: true, t: t("analysis.wb.ventUnter", {n: anzahl(v.uN), von, bis,
        ist: lo === hi ? String(lo) : lo+"\u2013"+hi, soll: String(m.top), fehlen: anzahl(v.fehlen)})+unlesbar};
    }
    if(!m.shaped) return {befund: false, t: t("analysis.wb.sonst", {n: anzahl(sp.einsaetze.length), je: fmt(median(sp.einsaetze.map(c => c.dmg)))})};
    /* "auf der optimalen Entfernung" nur, wenn alle lesbaren Salven den
       Bestwert erreichten und der nicht unter dem liegt, was das Ziel schon
       hergab (ventiusTop); sonst der neutrale Satz */
    if(m.atTop === m.shaped && (!m.cap || m.top >= m.cap))
      return {befund: false, t: m.off ? t("analysis.wb.ventAlle", {n: anzahl(m.shaped), unlesbar: anzahl(m.off)})
        : t("analysis.wb.ventAlleGanz", {n: anzahl(m.shaped)})};
    return {befund: false, t: t("analysis.wb.ventNeutral", {n: anzahl(m.shaped), top: String(m.top)})+unlesbar};
  }
  if(f.art === "dicht"){
    if(sp.aus.length){
      const [a, b] = sp.aus.reduce((x, y) => y[1] - y[0] > x[1] - x[0] ? y : x);
      const v = {s: Math.round((b - a)/1000)+"\u00a0s", ab: clock(Math.round(a/1000))};
      return {befund: true, t: t("analysis.wb.aus", v), kurz: t("analysis.wb.ausKurz", v)};
    }
  }
  if(f.art === "dicht" || f.art === "takt") return {befund: false, t: t("analysis.wb.lief", {s: Math.round(sp.lief/1000)+"\u00a0s",
    anteil: pct(Math.min(1, sp.lief/T)), n: anzahl(sp.laeufe.length)})};
  if(f.art === "passiv") return {befund: false, t: t("analysis.wb.passivSatz", {n: anzahl(f.hits)})};
  return {befund: false, t: t("analysis.wb.sonst", {n: anzahl(sp.einsaetze.length), je: fmt(median(sp.einsaetze.map(c => c.dmg)))})};
}

/* ---------- die Bilder (Spezifikation 3.3), nach der Breite gezeichnet ---------- */
/* Je Einsatz ein Strich an seiner Zeit, Hoehe nach der Wurzel des Schadens,
   Farbe nach Hitze; kritisch stark mit heller Kappe. Mit bestem Pull dessen
   Einsaetze gespiegelt unter der Grundlinie (Task 10). */
let schraffurZaehler = 0;
const HITZEWORT = ["analysis.art.normal", "analysis.art.heavy", "analysis.art.crit", "analysis.art.critheavy"];
function striche(sp: WbSpur, T: number, W: number, H: number, spiegel: SkillCast[] | null, pause: [number, number] | null = null, pauseText = ""): string {
  const X = (z: number) => Math.max(0, Math.min(W, z/T*W));
  const y0 = spiegel ? Math.round(H*0.66) : H - 2;
  const max = Math.max(1, ...sp.einsaetze.map(c => c.dmg), ...(spiegel || []).map(c => c.dmg));
  /* In einer Zeile (H <= 24) steht die Grundlinie gepunktet, mit Kerben bei Beginn und Ende: wo kein Strich
     steht, verging Zeit ohne Einsatz. Eine Pause, die zum Takt der Faehigkeit nicht passt, ist schraffiert. */
  const zeile = H <= 24;
  let s = zeile ? '<line x1="0" x2="'+W+'" y1="'+y0+'" y2="'+y0+'" stroke="var(--hair-rule)" stroke-dasharray="1 3"/>'+
      '<rect x="0" y="'+(y0 - 4)+'" width="1" height="5" fill="var(--hair-rule)"/><rect x="'+(W - 1)+'" y="'+(y0 - 4)+'" width="1" height="5" fill="var(--hair-rule)"/>'
    : '<line x1="0" x2="'+W+'" y1="'+y0+'" y2="'+y0+'" stroke="var(--hair-rule)"/>';
  if(pause){
    const id = "wbsch"+(schraffurZaehler++);
    s += '<defs><pattern id="'+id+'" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--dim)" stroke-width="1" opacity=".55"/></pattern></defs>'+
      '<rect x="'+X(pause[0]).toFixed(1)+'" y="1" width="'+Math.max(2, X(pause[1]) - X(pause[0])).toFixed(1)+'" height="'+(H - 3)+'" fill="url(#'+id+')"><title>'+esc(pauseText)+"</title></rect>";
  }
  if(spiegel) for(const c of spiegel){
    const h = Math.max(2, (H - y0 - 2)*Math.sqrt(c.dmg/max));
    s += '<rect x="'+(X(c.t) - 1).toFixed(1)+'" y="'+(y0 + 1)+'" width="2" height="'+h.toFixed(1)+'" fill="var(--wbspiegel)" opacity=".36"/>';
  }
  for(const c of sp.einsaetze){
    const g = glut(c), h = Math.max(3, (y0 - 2)*Math.sqrt(c.dmg/max)), w = zeile ? 2 : g === 3 ? 3 : 2.4, x = (X(c.t) - w/2).toFixed(1);
    // der Hinweis je Strich (Zeigen, nicht fuer den Vorleser): Zeit, Schaden, Hitze
    const tip = "<title>"+esc(clock(Math.round(c.t/1000))+" \u00b7 "+fmt(c.dmg)+" \u00b7 "+t(HITZEWORT[g]!))+"</title>";
    s += '<rect x="'+x+'" y="'+(y0 - h).toFixed(1)+'" width="'+w+'" height="'+h.toFixed(1)+'" rx="1" fill="'+HITZE[g]+'"'+
      (g ? (zeile ? ' style="opacity:.82"' : "") : ' style="opacity:var(--h0o)"')+">"+tip+"</rect>";
    if(g === 3 && !zeile) s += '<rect x="'+x+'" y="'+(y0 - h).toFixed(1)+'" width="'+w+'" height="2" fill="var(--hcap)"/>';
  }
  return '<svg class="wbglut" viewBox="0 0 '+W+" "+H+'" preserveAspectRatio="none" style="height:'+H+'px" aria-hidden="true" focusable="false">'+s+"</svg>";
}
/* Laufzeit: ein Band je Lauf in Bernstein, im Takt eine Kerbe je Tick, die
   "aus"-Strecken mit goldenem Rahmen. */
/* Mit bestem Pull dessen Einsaetze derselben Faehigkeit als duenne Linie
   darunter, je Einsatz von Beginn bis letztem Treffer (Spezifikation 3.3);
   nur, wo er sie gespeichert hat. */
function laufBild(sp: WbSpur, art: FArt, T: number, W: number, H: number, spiegel: SkillCast[] | null): string {
  const X = (z: number) => Math.max(0, Math.min(W, z/T*W)), y = H/2;
  let s = '<line x1="0" x2="'+W+'" y1="'+y+'" y2="'+y+'" stroke="var(--hair-rule)"/>';
  if(spiegel) for(const c of spiegel) s += '<rect x="'+X(c.t).toFixed(1)+'" y="'+(y + 5)+'" width="'+Math.max(2, X(c.last || c.t) - X(c.t)).toFixed(1)+
    '" height="2.5" rx="1.2" fill="var(--wbspiegel)" opacity=".4"/>';
  // dieselben Laeufe wie im Satz (dicht: Grenze 4 s, Takt: taktLaeufe)
  const baender = sp.laeufe;
  for(const [a, b] of baender) s += '<rect x="'+X(a).toFixed(1)+'" y="'+(y - 4)+'" width="'+Math.max(2, X(b) - X(a)).toFixed(1)+'" height="8" rx="2" fill="var(--h1)" opacity=".9"/>';
  if(art === "takt") for(const z of sp.treffer) s += '<rect x="'+(X(z) - 0.5).toFixed(1)+'" y="'+(y - 4)+'" width="1" height="8" fill="var(--comb)"/>';
  for(const [a, b] of sp.aus) s += '<rect x="'+X(a).toFixed(1)+'" y="'+(y - 7)+'" width="'+Math.max(2, X(b) - X(a)).toFixed(1)+'" height="14" rx="2" fill="none" stroke="var(--gold)" stroke-width="1.2"/>';
  return '<svg class="wbglut" viewBox="0 0 '+W+" "+H+'" preserveAspectRatio="none" style="height:'+H+'px" aria-hidden="true" focusable="false">'+s+"</svg>";
}
/* Ventius: je Salve eine Saeule an ihrer Zeit, unten der Einsatz, darueber
   die Nachbeben bis zum Bestwert dieses Kampfes - gefuellt erreicht
   (data-welle 1, in der Hitze der Salve), leer gefehlt (data-welle 0),
   gestrichelt nicht lesbar; Salven unter dem Bestwert umrandet. Der Satz
   darunter (.salvenwort) sagt in Worten, ob sie auf der optimalen
   Entfernung kamen. */
function perlen(seg: Fight, sp: WbSpur, T: number, W: number): string {
  const m = ventiusMix(seg), zeiten: number[] = m.zeiten || [], folge: number[] = m.folge || [];
  const top = Math.max(1, m.top), st = 6.6, r = 2.5, H = Math.round(top*st + 18), y0 = H - 6;
  const X = (z: number, i: number) => zeiten.length === folge.length ? Math.max(4, Math.min(W - 4, (z - seg.start)/T*W)) : (i + 0.5)/Math.max(1, folge.length)*W;
  let s = '<line x1="0" x2="'+W+'" y1="'+(y0 + 5)+'" y2="'+(y0 + 5)+'" stroke="var(--hair-rule)"/>';
  folge.forEach((w, i) => {
    const x = X(zeiten[i] || 0, i).toFixed(1);
    const c = sp.einsaetze.find(e => Math.abs(e.t + seg.start - (zeiten[i] || 0)) < 100);
    // die Perlen tragen die Hitze ihrer Salve (Asche mit ihrer Deckkraft wie bei den Strichen)
    const g = c ? glut(c) : 2, farbe = '" fill="'+HITZE[g]+'"'+(g ? "" : ' style="opacity:var(--h0o)"');
    s += '<g class="wbsalve" data-best="'+(w > 0 && w >= m.top ? 1 : 0)+'" data-lesbar="'+(w > 0 ? 1 : 0)+'" data-hitze="'+g+'">'+
      '<circle cx="'+x+'" cy="'+y0+'" r="3.1'+farbe+"/>";
    if(!w) s += '<circle cx="'+x+'" cy="'+(y0 - st).toFixed(1)+'" r="'+r+'" fill="none" stroke="var(--dim)" stroke-width=".9" stroke-dasharray="1.4 1.4"/>';
    else {
      for(let k = 1; k <= m.top; k++){
        const yy = (y0 - k*st).toFixed(1);
        s += k <= w ? '<circle data-welle="1" cx="'+x+'" cy="'+yy+'" r="'+r+farbe+"/>"
          : '<circle data-welle="0" cx="'+x+'" cy="'+yy+'" r="'+r+'" fill="none" stroke="var(--gold-ink)" stroke-width="1"/>';
      }
      if(w < m.top) s += '<rect x="'+(+x - 6)+'" y="'+(y0 - top*st - 6).toFixed(1)+'" width="12" height="'+(top*st + 12).toFixed(1)+'" rx="6" fill="none" stroke="var(--gold)" stroke-width="1.2" opacity=".8"/>';
    }
    s += "</g>";
  });
  return '<svg class="wbglut" viewBox="0 0 '+W+" "+H+'" preserveAspectRatio="none" style="height:'+H+'px" aria-hidden="true" focusable="false">'+s+"</svg>";
}

/* ---------- Markup ---------- */
// derselbe Eintrag wie in der Befundliste des Streifens (renderWeitere, 26)
const eintrag = (k: string, dt: string, v: string, n: string, zaehlt: boolean, id = "") =>
  '<div class="find'+(zaehlt ? " zaehlt" : "")+'" data-k="'+k+'"'+(id ? ' id="'+id+'"' : "")+'><dt class="k">'+esc(dt)+'</dt><dd class="v">'+esc(v)+"</dd>"+
  (n ? '<dd class="n">'+esc(n)+"</dd>" : "")+"</div>";
const AUF = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 4l4 4-4 4"/></svg>';

// aufgeklappte Faecher, je Kampf (an seinem Beginn: unter Live entsteht der Kampf jeden Takt neu)
let offen = new Set<string>();
let offenFuer: number | null = null;
let zuletzt: { seg: Fight; best: BestCasts | null } | null = null;

function bildVon(seg: Fight, k: string, sid: string): string {
  const b = k === VENTIUS_NAME ? (seg.ventiusBase ? skillIcon(seg.ventiusBase.name, seg.ventiusBase.sid) : null) : skillIcon(k, sid);
  return b || "";
}
const nameVon = (f: WbFaehigkeit) => f.k === VENTIUS_NAME ? skillLabel(VENTIUS_NAME, VENTIUS_ID) : skillLabel(f.k, f.sid);

/* Unter den Perlen in einer Zeile der Zeitraum, die Leserichtung und die Legende der Perlen: gefuellt = Nachbeben getroffen, leer =
   bis zum Bestwert gefehlt, Ring = Salve unter dem Bestwert, gestrichelt = nicht lesbar. */
function ventiusAchse(T: number): string {
  const e = (k: string, w: string) => '<span><i class="'+k+'"></i>'+esc(t(w))+"</span>";
  // eine Zeile: Zeitraum (fuer den Vorleser stumm, er hat die Saetze), Leserichtung, Legende; schmal bricht sie um
  return '<div class="vachse"><span class="vzeit" aria-hidden="true">'+esc(clock(0)+" \u2013 "+clock(Math.round(T/1000)))+'</span><span class="wbachse">'+esc(t("analysis.wb.ventAchse"))+
    '</span><p class="perlleg">'+e("pe", "analysis.wb.vLegErr")+e("pl", "analysis.wb.vLegLeer")+e("pr", "analysis.wb.vLegRing")+e("pn", "analysis.wb.vLegNicht")+"</p></div>";
}

/* Die Zahlen des frueheren Kastens Auge von Ventius, im Fach: links nur,
   was ein Nachbeben ist (der Satz unter den Perlen sagt schon, ob die
   Salven auf der optimalen Entfernung kamen), rechts alle Zahlen in einem
   Raster: Treffer je Einsatz, fehlende Treffer, Salven (aus dem Befund),
   dazu die Zahlen aus Spezifikation 3.3, die der fruehere Kasten nicht
   hatte - Nachbeben je Salve (bis zum Bestwert) und der Median je Salve
   mit seiner Grundlage (wie viele Salven) und der Spanne vom 10. bis zum
   90. Perzentil. Der Median heisst Median: der Satz "im Schnitt" daneben
   (insight.concentration) ist der Mittelwert. Darunter, was die
   schwaecheren Salven gekostet haben (ventiusVerlust, 26). */
function ventiusZahlen(seg: Fight, sp: WbSpur, pos: Insight | undefined): { links: string; rechts: string } {
  const m = ventiusMix(seg), d = sp.einsaetze.map(c => c.dmg).sort((a, b) => a - b);
  const zahl = (dt: string, z: string, leise = "") => "<div><dt>"+esc(dt)+'</dt><dd class="num">'+esc(z)+"</dd>"+
    (leise ? '<dd class="fein">'+esc(leise)+"</dd>" : "")+"</div>";
  let zellen = "", links = "";
  if(pos){
    const v = pos.vars;
    links = '<p class="wbfein">'+esc(t("insight.ventiusPos.note", v))+"</p>";
    const salven = Number(v.casts) || m.folge.length, treffer = Number(v.treffer) || 0, fehlt = ventiusFehlend(seg);
    zellen += zahl(t("analysis.vent.jeEinsatz"), salven ? num1(treffer/salven) : "\u2013")+
      zahl(t("analysis.vent.fehlend"), anzahl(fehlt ? fehlt.fehlen : 0), t("analysis.vent.fehlendNote"))+
      zahl(t("analysis.vent.salven"), anzahl(salven), t("analysis.vent.treffer", {n: anzahl(treffer)}));
  }
  if(d.length){
    const q = (p: number) => d[Math.floor((d.length - 1)*p)] || 0;
    if(m.top) zellen += zahl(t("analysis.wb.nachbeben"), t("analysis.wb.bisN", {n: String(m.top)}));
    zellen += zahl(t("analysis.wb.medianSalve"), fmt(median(d)), t("analysis.wb.spanneUeber", {n: anzahl(d.length), von: fmt(q(0.1)), bis: fmt(q(0.9))}));
  }
  return {links, rechts: (zellen ? '<dl class="vkz">'+zellen+"</dl>" : "") + ventiusVerlust(seg)};
}

/* "Mehr zu ...": die Einsaetze gross, die Zahlen dieses Pulls (und des
   besten, wo es ihn gibt) und der Weg in die Rotation. Ein Kampf des Logs
   als Bezug (alle) kennt jeden Einsatz: fehlt die Faehigkeit dort, waren es
   null. Ein gespeicherter Pull kennt nur seine zwoelf staerksten und keine
   starken Treffer: dort steht "nicht gespeichert" bzw. ein Strich, und der
   Satz unter der Tabelle sagt warum. */
function vergleich(sp: WbSpur, dmg: number, best: SkillCast[] | null, mitBest: boolean, alle: boolean, zweit: boolean): string {
  const spalte = (E: SkillCast[], D: number) => [anzahl(E.length), fmt(D), E.length ? fmt(median(E.map(c => c.dmg))) : "\u2013",
    pct(E.filter(c => glut(c) >= 2).length/Math.max(1, E.length)), pct(E.filter(c => glut(c) % 2 === 1).length/Math.max(1, E.length))];
  const a = spalte(sp.einsaetze, dmg);
  const b = best && best.length ? spalte(best, best.reduce((s, c) => s + c.dmg, 0)) : alle ? spalte([], 0) : null;
  if(b && !alle) b[4] = "\u2013";
  const kopf = ["analysis.wb.tEinsaetze", "analysis.wb.tSchaden", "analysis.wb.tJe", "analysis.wb.tKrit", "analysis.wb.tStark"];
  return '<table class="wbvgl"><thead><tr><th scope="col"><span class="vh">'+esc(t("analysis.wb.zahlen"))+'</span></th><th scope="col">'+
    esc(t("analysis.wb.diesePull"))+"</th>"+(mitBest ? '<th scope="col">'+esc(t(zweit ? "analysis.wb.zweitPull" : "analysis.wb.besterPull"))+"</th>" : "")+"</tr></thead><tbody>"+
    kopf.map((k, i) => '<tr><th scope="row">'+esc(t(k))+"</th><td>"+esc(a[i]!)+"</td>"+
      (mitBest ? "<td>"+esc(b ? b[i]! : t("analysis.wb.nichtGespeichert"))+"</td>" : "")+"</tr>").join("")+"</tbody></table>"+
    (mitBest && !alle && best && best.length ? '<p class="wbfein">'+esc(t("analysis.wb.starkNicht"))+"</p>" : "");
}

/* Was ein Fach oder eine Gruppe zusaetzlich traegt: Befunde (.find) und
   Saetze (.wbsatz), gesammelt in werkbankHtml nach ihrem Ort. */
/* bezug: je Faehigkeit die Kennungen ihrer Befunde und Saetze unter der
   Gruppe - die Zeile nennt sie in aria-describedby */
interface Ablage { finds: string; saetze: string; bezug: Map<string, string[]> }
const leer = (): Ablage => ({finds: "", saetze: "", bezug: new Map()});
let kennZaehler = 0;
const neueKennung = () => "wbb" + (kennZaehler++);
function verweis(ab: Ablage, k: string, id: string){ const l = ab.bezug.get(k) || []; l.push(id); ab.bezug.set(k, l); }

interface WbOptionen {
  fenster: FensterStand | null; teuer: string; gefunden: Insight[];
  /** der beste Pull desselben Builds; bestAlle: ein Kampf des Logs (alle Einsaetze), bestZweit: es ist der zweitbeste */
  best: BestCasts | null; bestAlle?: boolean; bestZweit?: boolean;
}
function fachHtml(seg: Fight, f: WbFaehigkeit, i: number, platz: { spalte: string; zeile: string; allein: boolean }, haupt: boolean,
  m: WbModell, o: WbOptionen, zu: Ablage, ges: number): string {
  const sp = m.spuren.get(f.k)!, id = "wbf" + i, auf = offen.has(f.k), name = nameVon(f), sa = satzVon(seg, f, sp, m.T);
  const vent = f.art === "ventius";
  const bild = bildVon(seg, f.k, f.sid);
  const kl = "wbfach " + (haupt ? "haupt" : "mittel") + (platz.allein ? " allein" : "") + (auf ? " offen" : "") + (vent ? " vfeld" : "");
  const anteil = ges ? f.dmg/ges : 0;
  let h = '<section class="'+kl+'" data-n="'+esc(f.k)+'" style="grid-column:'+platz.spalte+";grid-row:"+platz.zeile+'" aria-labelledby="'+id+'-h">'+
    '<div class="wbfkopf">'+(bild ? '<img class="wbbild" src="'+bild+'" alt="" aria-hidden="true">' : '<span class="wbbild" aria-hidden="true"></span>')+
    '<h3 class="wbname" id="'+id+'-h">'+esc(name)+"<small>"+esc(fmt(f.dmg)+" \u00b7 "+t("analysis.wb.einsaetze", {n: anzahl(sp.einsaetze.length)}))+"</small></h3>"+
    '<div class="wbanteil">'+esc(pct(anteil, 1))+"<small>"+esc(t("analysis.wb.desSchadens"))+"</small></div></div>";
  if(!state.noTime) h += '<div class="wbbild2" data-bild="'+(vent ? "vent" : "ein")+'" data-n="'+esc(f.k)+'"></div>';
  const pos = vent ? o.gefunden.find(x => x.key === "ventiusPos") : undefined;
  const satz = '<p class="wbsatz'+(sa.befund ? " befund" : "")+(vent ? " salvenwort" : "")+'">'+esc(sa.t)+"</p>";
  /* Ventius: unter den Perlen leise die Leserichtung, dann der Satz zur
     optimalen Entfernung - einmal, als Unterschrift der Perlen (die Perlen
     selbst sind fuer den Vorleser verborgen). */
  if(vent) h += (!state.noTime && ventiusMix(seg).folge.length ? ventiusAchse(m.T) : "") + satz;
  /* Darunter links die Saetze, rechts die Zahlen und Befunde - im breiten
     Fach nebeneinander (styles.css, Container wbf), sonst untereinander. */
  let links = vent ? "" : satz, rechts = "";
  if(vent){ const vz = ventiusZahlen(seg, sp, pos); links += vz.links; rechts += vz.rechts; }
  /* Die Tabelle je Boss steht in den Rekorden (#218 Etappe 3); der Knopf
     zeigt den Weg dorthin, nur wenn es den Abschnitt gibt (62). */
  if(vent && ventiusAbschnittDa()) links += '<p class="wbfein"><button type="button" class="wbrk">'+esc(t("analysis.wb.zuRekorden"))+"</button></p>";
  /* Im Hauptfach leise, woraus es kommt, und was danach kommt - der Satz
     von "Wer traegt?", das in den Faechern aufgegangen ist. "Danach" ist
     die naechststaerkere Faehigkeit des ganzen Kampfes unter dieser (auch
     eine passive oder eine Laufzeit), so bleibt der Satz wahr. */
  if(haupt){
    const ord = faecherVonKampf(seg);
    const f2 = [...ord.liste.values()].sort((a, b) => b.dmg - a.dmg).find(x => x.k !== f.k && x.dmg <= f.dmg);
    links += '<p class="wbfein">'+esc(t("analysis.d1.leise", {n: anzahl(f.hits), c: pct(f.hits ? f.crit/f.hits : 0), h: pct(f.hits ? f.heavy/f.hits : 0),
      zweit: f2 ? nameVon(f2) : "", p2: f2 && ges ? pct(f2.dmg/ges, 1) : ""}))+"</p>";
  }
  links += zu.saetze;
  /* Im Ventius-Fach stehen die Befunde links unter den Saetzen: rechts
     traegt das Zahlenraster, so enden beide Spalten etwa gleich hoch. */
  if(zu.finds){ const b = '<dl class="wbbefunde">'+zu.finds+"</dl>"; if(vent) links += b; else rechts += b; }
  h += rechts ? '<div class="wbteile"><div>'+links+"</div><div>"+rechts+"</div></div>" : links;
  if(haupt && o.fenster) h += '<section class="fsec" aria-labelledby="fensterH"><h4 id="fensterH">'+esc(t("analysis.sec.window"))+"</h4>"+
    fensterAbschnitt(o.fenster, o.teuer === "window")+"</section>";
  const best = o.best ? o.best.get(f.k) || null : null;
  h += '<button type="button" class="wbauf" aria-expanded="'+auf+'" aria-controls="'+id+'-m">'+AUF+
    esc(auf ? t("analysis.wb.weniger") : t("analysis.wb.mehr", {name}))+"</button>"+
    /* zugeklappt ist die Region leer: ihre Ueberschriften stuenden sonst
       unsichtbar im Ueberschriftenbaum */
    (auf ? '<div class="wbmehr" id="'+id+'-m" role="region" aria-labelledby="'+id+'-mh">'+
    '<div><h4 id="'+id+'-mh">'+esc(t("analysis.wb.einsaetzeIm"))+"</h4>"+
    (state.noTime ? "" : '<div class="wbbild2" data-bild="gross" data-n="'+esc(f.k)+'"></div>')+
    '<p class="wbfein">'+esc(t("analysis.wb.mehrSatz"))+(best && best.length ? " "+esc(t("analysis.wb.spiegelSatz")) : "")+"</p></div>"+
    "<div><h4>"+esc(t("analysis.wb.zahlen"))+"</h4>"+vergleich(sp, f.dmg, best, !!o.best, !!o.bestAlle, !!o.bestZweit)+
    '<div class="wbwege"><button type="button" class="inrot" data-weg="folge">'+esc(t("analysis.folgeRotation"))+"</button></div></div></div>"
    : '<div class="wbmehr" id="'+id+'-m" hidden></div>');
  return h + "</section>";
}

/* Der Satz einer Zeile "Einsatz": was an der Faehigkeit auffaellt (zeilenBefund, ../analyse-core.ts) - eine
   Pause im eigenen Takt (ohne Luecken des ganzen Kampfes), weniger Einsaetze oder weniger Schaden als im
   besten Pull im selben Zeitraum, sonst Zahl und Takt. Ein Befund ist keine Wertung: Goldpunkt, kein Rot. */
const sek1 = (ms: number) => ms < 100 ? t("analysis.wb.zUnter") : ms >= 10000 ? Math.round(ms/1000)+"\u00a0s" : num1(ms/1000)+"\u00a0s";
function zeilenSatz(seg: Fight, f: WbFaehigkeit, sp: WbSpur, T: number, ges: number, best: SkillCast[] | null): { text: string; kurz: string; rest: string; b: ZeilenBefund } {
  const lk = lueckenStand(seg);
  const b = zeilenBefund(sp.einsaetze, T, ges ? f.dmg/ges : 0, best, lk ? lk.luecken : []);
  const uhr = (ms: number) => clock(Math.round(ms/1000));
  let text = "";
  switch(b.art){
    case "eins": text = t("analysis.wb.zEins", {t: uhr(b.at!)}); break;
    case "kaum": text = t("analysis.wb.zKaum", {n: anzahl(b.n!), p: pct(ges ? f.dmg/ges : 0, 1)}); break;
    case "takt": text = t("analysis.wb.zTakt", {n: anzahl(b.n!), je: sek1(b.je!)}); break;
    case "pause": text = t(b.spanne! - b.dauer! >= 1000 ? "analysis.wb.zPauseTeil" : "analysis.wb.zPause", {von: uhr(b.pause![0]), bis: uhr(b.pause![1]), s: Math.round(b.dauer!/1000)+"\u00a0s", je: sek1(b.je!)}); break;
    case "weniger": text = t("analysis.wb.zWeniger", {n: anzahl(b.n!), nb: anzahl(b.nb!)}); break;
    case "schwach": text = t("analysis.wb.zSchwach", {p: pct(b.minus!)}); break;
    default: text = "";
  }
  /* Die Woerterbuch-Saetze tragen eine Marke (U+0001) vor ihrem Ende: schmal (Gruppe unter 620 Punkt) entfaellt das
     Ende, damit der Satz in die Zeile passt; der ganze Satz steht im title und fuer den Vorleser im Text. */
  const [kurz, rest = ""] = text.split("\u0001");
  return {text: kurz + rest, kurz: kurz!, rest, b};
}
// Legende und Achse ueber einer Gruppe mit Strichen (die Zeilen "Einsatz"); die Achse nur mit Zeit im Log
function zeilenKopf(): string {
  return '<div class="wbzkopf"><p class="wbsw"><span class="wbzleg">'+esc(t("analysis.wb.zLeg"))+"</span>"+
    '<span><i class="sp"></i>'+esc(t("analysis.wb.zPauseLeg"))+"</span></p></div>";
}

/* Eine Zeile (Ruling 19, hoechstens 44 px): Bild, Name in einer Zeile,
   darunter eine kurze Datenzeile ("6 Einsaetze \u00b7 meist 37.0k", "120
   Treffer", "lief 54 s, 3 Laeufe" oder kurz "12 s aus, ab 0:20"), der Strich
   und der Anteil. Saetze mit Befund stehen ganz unter der Gruppe; die Zeile
   verweist mit aria-describedby auf sie. */
function zeileHtml(seg: Fight, f: WbFaehigkeit, m: WbModell, ges: number, ablage: Ablage): string {
  const sp = m.spuren.get(f.k)!, sa = satzVon(seg, f, sp, m.T), bild = bildVon(seg, f.k, f.sid), name = nameVon(f);
  if(sa.befund){
    const id = neueKennung();
    ablage.saetze += '<p class="wbsatz befund" id="'+id+'">'+esc(name+": "+sa.t)+"</p>";
    verweis(ablage, f.k, id);
  }
  const zs = f.art === "einsatz" && !state.noTime ? zeilenSatz(seg, f, sp, m.T, ges, zuletzt && zuletzt.seg === seg && zuletzt.best ? zuletzt.best.get(f.k) || null : null) : null;
  const daten = zs && zs.text ? zs.text : sa.kurz ? sa.kurz
    : f.art === "passiv" ? t("analysis.wb.treffer", {n: anzahl(f.hits)})
    : f.art === "takt" || f.art === "dicht" ? t("analysis.wb.liefKurz", {s: Math.round(sp.lief/1000)+"\u00a0s", n: anzahl(sp.laeufe.length)})
    : t("analysis.wb.einsaetze", {n: anzahl(sp.einsaetze.length)})+" \u00b7 "+t("analysis.wb.meist", {je: fmt(median(sp.einsaetze.map(c => c.dmg)))});
  const bez = ablage.bezug.get(f.k);
  return '<li><button type="button" class="wbzeile'+(sa.befund || zs?.b.befund ? " befund" : "")+'" data-n="'+esc(f.k)+'"'+
    (bez ? ' aria-describedby="'+bez.join(" ")+'"' : "")+">"+
    (bild ? '<img src="'+bild+'" alt="">' : '<span class="wbleer"></span>')+
    '<span class="n"><span class="nn" title="'+esc(name)+'">'+esc(name)+"</span><small"+(zs && zs.text ? ' title="'+esc(daten)+'"' : "")+">"+
      (zs && zs.text ? esc(zs.kurz)+(zs.rest ? '<span class="zl">'+esc(zs.rest)+"</span>" : "") : esc(daten))+"</small></span>"+
    '<span class="wbstrich" data-n="'+esc(f.k)+'" data-art="'+f.art+'" aria-hidden="true"></span>'+
    '<span class="a">'+esc(pct(ges ? f.dmg/ges : 0, 1))+"<small>"+esc(fmt(f.dmg))+"</small></span></button></li>";
}

/** Die Werkbank als HTML fuer #findings (renderAnalysis, 26). */
export function werkbankHtml(seg: Fight, o: WbOptionen): string {
  if(offenFuer !== seg.start){ offen = new Set(); offenFuer = seg.start; }
  kennZaehler = 0;
  zuletzt = {seg, best: o.best};
  const ord = faecherVonKampf(seg), m = modell(seg, ord), ges = seg.stats.total || 0;
  const hol = (k: string) => o.gefunden.find(x => x.key === k);
  /* Wohin ein Befund gehoert: ins Fach seiner Faehigkeit, sonst unter die
     Gruppe ihrer Zeile, sonst (auch eine Faehigkeit ohne Schaden, nur mit
     Fehlschlaegen) ins Hauptfach - so findet "Zum Beleg" ihn immer. */
  const faecher = new Set([ord.haupt, ...ord.mittel].filter((x): x is string => !!x));
  const gruppeVon = (k: string) => ord.lauf.includes(k) ? "lauf" : ord.weitere.includes(k) ? "weitere" : ord.passiv.includes(k) ? "passiv" : "";
  const ersteGruppe = ord.lauf.length ? "lauf" : ord.weitere.length ? "weitere" : ord.passiv.length ? "passiv" : "";
  const ablagen = new Map<string, Ablage>();
  const ablage = (ort: string) => { let a = ablagen.get(ort); if(!a){ a = leer(); ablagen.set(ort, a); } return a; };
  // ein Befund; unter einer Gruppe mit Kennung, damit die Zeile auf ihn verweist
  const legeAb = (ort: string, k: string, html: (id: string) => string) => {
    const ab = ablage(ort);
    if(ort.startsWith("gruppe:")){ const id = neueKennung(); ab.finds += html(id); verweis(ab, k, id); }
    else ab.finds += html("");
  };
  const ortVon = (k: string) => faecher.has(k) ? "fach:" + k : gruppeVon(k) ? "gruppe:" + gruppeVon(k)
    : ord.haupt ? "fach:" + ord.haupt : ersteGruppe ? "gruppe:" + ersteGruppe : "rest";
  if(seg.stats.max > 0){
    let e = seg.events[0];
    for(const x of seg.events) if(!e || x.dmg > e.dmg) e = x;
    // im Fach seiner Faehigkeit ohne ihren Namen (der steht darueber), unter einer Gruppe oder fremd mit ihm
    if(e){ const ort = ortVon(e.skill), eigen = ort === "fach:" + e.skill;
      legeAb(ort, e.skill, id => eintrag("groesster", t("analysis.wb.groesster"), fmt(seg.stats.max)+(eigen ? "" : " \u00b7 "+skillLabel(e.skill, e.sid)), "", false, id)); }
  }
  /* Die Fehlschlaege bei der Faehigkeit mit den meisten, Satz wie vorher;
     ohne Fehlschlag "keine" im Hauptfach (wie vorher in der Liste). */
  const fehl = hol("missed");
  if(fehl){
    const namen = [...(seg.missSkills || new Map<string, { n: number; sid: string }>()).entries()].sort((a, b) => b[1].n - a[1].n);
    const skill = fehl.vars.sid ? skillLabel(fehl.vars.skill, fehl.vars.sid) : fehl.vars.skill;
    const wer = namen[0]?.[0] || String(fehl.vars.skill);
    legeAb(ortVon(wer), wer, id => eintrag("fehl", t("insight.missed.label"),
      t("analysis.wb.fehl", {n: anzahl(fehl.vars.n), share: fehl.vars.share, skill}), t("insight.missed.note", {...fehl.vars, skill}), o.teuer === "missed", id));
  } else ablage(ord.haupt ? "fach:" + ord.haupt : ortVon("")).finds += eintrag("fehl", t("insight.missed.label"), t("analysis.wb.keine"), "", false);
  // "Ein Einsatz davon bringt ..." gehoert zur staerksten Faehigkeit (vorher unter "Wer traegt?")
  const kon = hol("concentration");
  if(kon && kon.vars.big){
    const ort = ortVon(String(kon.vars.skill)), ab = ablage(ort), id = ort.startsWith("gruppe:") ? neueKennung() : "";
    ab.saetze += '<p class="wbsatz"'+(id ? ' id="'+id+'"' : "")+">"+esc(t("insight.concentration.note", {...kon.vars,
      skill2: kon.vars.skill2 ? skillLabel(kon.vars.skill2, kon.vars.skill2Sid) : ""}))+"</p>";
    if(id) verweis(ab, String(kon.vars.skill), id);
  }
  let h = "";
  if(ord.haupt){
    const reihe = [ord.haupt, ...ord.mittel];
    for(const p of packen(ord.haupt, ord.mittel, offen))
      h += fachHtml(seg, ord.liste.get(p.k)!, reihe.indexOf(p.k), p, p.k === ord.haupt, m, o, ablage("fach:" + p.k), ges);
  }
  /* Laufzeit, Weitere Faehigkeiten, Passiv als Spalten nebeneinander, in
     dieser Folge von links nach rechts (Spezifikation 2.3, Ruling 16 neu),
     je nur mit Inhalt (Ruling 8); jede Spalte haelt ihre Zeilen von oben nach
     unten, so ist die Lesefolge die Tab-Folge. Die Breite folgt dem Inhalt:
     die Gruppe mit den meisten Zeilen bekommt bei dreien die Haelfte (12er
     Raster, 6/3/3), bei zweien je die Haelfte. Schmal stehen sie
     untereinander (styles.css). */
  const gruppen = [
    {ort: "lauf", id: "wbLaufH", titel: "analysis.wb.laufzeit", wie: "analysis.wb.laufzeitWie", ks: ord.lauf},
    {ort: "weitere", id: "wbWeitereH", titel: "analysis.wb.weitere", wie: "", ks: ord.weitere},
    {ort: "passiv", id: "wbPassivH", titel: "analysis.wb.passiv", wie: "analysis.wb.passivWie", ks: ord.passiv},
  ].filter(g => g.ks.length);
  const breiteste = gruppen.reduce((a, g, i) => g.ks.length > gruppen[a]!.ks.length ? i : a, 0);
  gruppen.forEach((g, i) => {
    const spanne = gruppenSpanne(gruppen.length, i, breiteste);
    const ab = ablage("gruppe:" + g.ort);
    const zeilen = g.ks.map(k => zeileHtml(seg, ord.liste.get(k)!, m, ges, ab)).join("");
    h += '<section class="wbgruppe" style="grid-column:span '+spanne+'" aria-labelledby="'+g.id+'"><h3 id="'+g.id+'">'+esc(t(g.titel))+"</h3>"+
      (g.wie ? '<p class="wbgwie">'+esc(t(g.wie))+"</p>" : "")+
      (!state.noTime && g.ks.some(k => ord.liste.get(k)!.art === "einsatz") ? zeilenKopf() : "")+'<ul class="wbliste">'+zeilen+"</ul>"+
      (ab.saetze ? '<div class="wbbefunde wbsaetze">'+ab.saetze+"</div>" : "")+
      (ab.finds ? '<dl class="wbbefunde">'+ab.finds+"</dl>" : "")+"</section>";
  });
  /* Nichts entfaellt ohne Ersatz: hat der Kampf kein Hauptfach (nur
     Laufzeit oder Passiv), steht die Frage nach dem Fenster fuer sich. */
  let rest = "";
  const r = ablagen.get("rest");
  if(r && (r.finds || r.saetze)) rest += '<section class="fsec">'+r.saetze+(r.finds ? '<dl class="wbbefunde">'+r.finds+"</dl>" : "")+"</section>";
  if(!ord.haupt && o.fenster) rest += '<section class="fsec" aria-labelledby="fensterH"><h3 id="fensterH">'+esc(t("analysis.sec.window"))+"</h3>"+
    fensterAbschnitt(o.fenster, o.teuer === "window")+"</section>";
  if(!h) return rest;
  return '<div class="wbbank">'+h+"</div>"+rest;
}

/* ---------- die rechte Spalte fuellen (#270, 22.10.2026, Aufbau B) ----------
   Traegt eine Faehigkeit fast allen Schaden, ist das Hauptfach (7/12) viel
   hoeher als die ein bis drei mittleren Faecher daneben (5/12), und rechts
   bliebe Platz leer. Ab 1200 Punkt Fensterhoehe (html.h-min-1200) ruecken
   darum "Weitere Faehigkeiten" als Zeilen in die rechte Spalte unter die
   mittleren Faecher, solange sie dort bis zur Unterkante des Hauptfachs
   passen: mehr Platz zeigt mehr Zeilen, keine Zeile wird gestreckt (hoechstens
   44 Punkt, Regel von der festen Zeile). Passen alle samt ihren Saetzen und
   Befunden, steht die Gruppe nicht mehr unten; sonst bleibt der Rest dort
   unter derselben Ueberschrift. Gemessen wird nach dem Zeichnen (die Bilder
   haben ihre Hoehe erst dann), je neu bei jeder Fenstergroesse und jedem
   Schreiben: erst zuruecksetzen, dann fuellen. Die Folge im Dokument bleibt
   die Tab-Folge (Hauptfach, mittlere Faecher, diese Zeilen, die Gruppen). */
interface RestHeim { gruppe: HTMLElement; ul: HTMLElement }
const restHeim = new WeakMap<HTMLElement, RestHeim>();

/** Die Breite der Gruppen unter der Werkbank: eine nimmt alles, zwei je die
    Haelfte, bei dreien die mit den meisten Zeilen die Haelfte (12er Raster). */
const gruppenSpanne = (n: number, i: number, breiteste: number) => n === 1 ? 12 : n === 2 ? 6 : i === breiteste ? 6 : 3;

function restZurueck(bank: HTMLElement): void {
  bank.querySelectorAll<HTMLElement>(".wbrest").forEach(rest => {
    const heim = restHeim.get(rest);
    if(heim){
      [...rest.querySelectorAll("li")].reverse().forEach(li => heim.ul.prepend(li));
      rest.querySelectorAll(".wbsaetze, dl.wbbefunde").forEach(x => heim.gruppe.append(x));
    }
    rest.remove();
  });
  const haupt = bank.querySelector<HTMLElement>(".wbfach.haupt");
  if(haupt && haupt.dataset.reihe !== undefined){ haupt.style.gridRow = haupt.dataset.reihe; delete haupt.dataset.reihe; }
  bank.querySelectorAll<HTMLElement>(".wbgruppe > .wbzkopf, .wbgruppe > h3").forEach(x => { x.hidden = false; });
  bank.querySelectorAll<HTMLElement>(".wbgruppe").forEach(g => {
    g.hidden = false;
    if(g.dataset.span0){ g.style.gridColumn = g.dataset.span0; delete g.dataset.span0; }
  });
}

/** true, wenn Zeilen aufgerueckt sind (dann zeichnet der Aufrufer die Bilder neu). */
function werkbankFuellen(): boolean {
  const bank = document.querySelector<HTMLElement>("#findings .wbbank");
  if(!bank) return false;
  const a = document.activeElement as HTMLElement | null, fokus = a && bank.contains(a) ? a : null;
  const hatRest = !!bank.querySelector(".wbrest");
  if(hatRest) restZurueck(bank);
  const haupt = bank.querySelector<HTMLElement>(".wbfach.haupt");
  const mitte = [...bank.querySelectorAll<HTMLElement>(".wbfach.mittel")];
  const quelle = [...bank.querySelectorAll<HTMLElement>(".wbgruppe")].find(g => g.querySelector("#wbWeitereH"));
  const gilt = document.documentElement.classList.contains("h-min-1200") && !!haupt && !!quelle && mitte.length > 0 &&
    !haupt.classList.contains("offen") && !mitte.some(m => m.classList.contains("offen")) &&
    haupt.getBoundingClientRect().width < bank.clientWidth * 0.7;     // nur im Raster 7/5
  let aufgerueckt = false;
  if(gilt){
    const ul = quelle.querySelector<HTMLElement>("ul.wbliste")!, lis = [...ul.children] as HTMLElement[];
    const ziel = haupt.getBoundingClientRect().height, h = (e: Element) => e.getBoundingClientRect().height;
    mitte.forEach(m => { m.style.alignSelf = "start"; });
    const rest = document.createElement("section");
    rest.className = "wbgruppe wbrest";
    rest.setAttribute("aria-labelledby", "wbRestH");
    rest.innerHTML = '<h3 id="wbRestH">'+esc(t("analysis.wb.weitere"))+"</h3>"+(quelle.querySelector(".wbzkopf")?.outerHTML || "")+'<ul class="wbliste"></ul>';
    const rul = rest.querySelector("ul")!;
    restHeim.set(rest, {gruppe: quelle, ul});
    bank.insertBefore(rest, bank.querySelector(".wbgruppe"));
    haupt.dataset.reihe = haupt.style.gridRow;
    haupt.style.gridRow = "span " + (mitte.length + 1);
    rest.style.alignSelf = "start";
    const passt = () => mitte.reduce((s, m) => s + h(m) + 1, 0) + h(rest) <= ziel + 0.5;
    // erst alles auf einmal (Zeilen, Saetze, Befunde der Gruppe), sonst Zeile fuer Zeile
    lis.forEach(li => rul.append(li));
    const beiwerk = [...quelle.querySelectorAll<HTMLElement>(".wbsaetze, dl.wbbefunde")];
    beiwerk.forEach(x => rest.append(x));
    if(!passt()){
      beiwerk.forEach(x => quelle.append(x));
      for(let i = lis.length - 1; i >= 0 && !passt(); i--) ul.prepend(lis[i]!);    // von hinten zurueck, bis es passt
    }
    rest.style.alignSelf = "";
    mitte.forEach(m => { m.style.alignSelf = ""; });
    aufgerueckt = rul.children.length > 0;
    if(!aufgerueckt){ restZurueck(bank); }
    else {
      // die Gruppen darunter neu aufteilen: ohne Zeilen und Beiwerk entfaellt die Quelle ganz
      /* Ohne Zeilen traegt die untere Gruppe weder Ueberschrift noch Legende (die stehen jetzt in der rechten Spalte);
         bleiben Saetze oder Befunde uebrig (sie passten nicht mehr hinein), stehen sie fuer sich. */
      if(!ul.children.length){
        quelle.querySelectorAll<HTMLElement>(":scope > .wbzkopf, :scope > h3, :scope > .wbgwie").forEach(x => { x.hidden = true; });
        if(!quelle.querySelector(".wbsaetze, dl.wbbefunde")) quelle.hidden = true;
      }
      const sicht = [...bank.querySelectorAll<HTMLElement>(".wbgruppe:not(.wbrest)")].filter(g => !g.hidden);
      const zahl = sicht.map(g => g.querySelectorAll("li").length);
      const breiteste = zahl.reduce((m, n, i) => n > zahl[m]! ? i : m, 0);
      sicht.forEach((g, i) => { g.dataset.span0 = g.style.gridColumn; g.style.gridColumn = "span " + gruppenSpanne(sicht.length, i, breiteste); });
    }
  }
  if(fokus && (hatRest || aufgerueckt) && document.activeElement !== fokus && fokus.isConnected) fokus.focus({preventScroll: true});
  return aufgerueckt;
}

/** Zeichnet die Bilder der Faecher und Zeilen nach ihrer Breite (nach dem
    Schreiben von #findings und bei jeder Fenstergroesse): erst alle Breiten
    lesen, dann schreiben, und nur, wo sich ein Bild aendert. Danach steht
    die Hervorhebung des gezeigten Fachs wieder (nach neuem Schreiben). */
const bildMerk = new WeakMap<Element, string>();
export function werkbankZeichnen(seg: Fight): void {
  bilderZeichnen(seg);
  // aufgerueckte Zeilen stehen in einer anderen Breite: ihre Striche neu
  if(werkbankFuellen()) bilderZeichnen(seg);
}
function bilderZeichnen(seg: Fight): void {
  const box = $("#findings");
  if(!box) return;
  box.querySelectorAll<HTMLElement>(".wbfach[data-n], .wbzeile[data-n]").forEach(f => f.classList.toggle("zeigt", !!gezeigt && f.dataset.n === gezeigt));
  if(state.noTime) return;
  const ord = faecherVonKampf(seg), m = modell(seg, ord), best = zuletzt && zuletzt.seg === seg ? zuletzt.best : null;
  /* der Spiegel nur, wo der beste Pull Einsaetze dieser Faehigkeit hat (die Ventius-Perlen und die Zeilen ohne);
     wie die gestrichelte Kurve auf die Laenge dieses Kampfs geschnitten - sonst stuenden alle spaeteren
     Einsaetze eines laengeren Bezugs als Block am rechten Rand. Die Tabelle unter "Mehr zu" zaehlt den ganzen Pull. */
  const spiegelVon = (k: string) => { const b = best ? best.get(k) : undefined, da = b ? b.filter(c => c.t < m.T) : []; return da.length ? da : null; };
  const ziele = [...box.querySelectorAll<HTMLElement>(".wbbild2[data-n], .wbstrich[data-n]")].map(el => ({el, W: Math.round(el.clientWidth)}));
  for(const {el, W} of ziele){
    if(!W) continue;
    const k = el.dataset.n || "", f = ord.liste.get(k), sp = m.spuren.get(k);
    if(!f || !sp) continue;
    let svg = "";
    if(el.classList.contains("wbstrich")){
      if(f.art === "takt" || f.art === "dicht") svg = laufBild(sp, f.art, m.T, W, 24, spiegelVon(k));
      else {
        const zs = f.art === "einsatz" ? zeilenSatz(seg, f, sp, m.T, seg.stats.total || 0, best ? best.get(k) || null : null) : null;
        svg = striche(sp, m.T, W, 24, null, zs && zs.b.art === "pause" ? zs.b.pause : null, zs ? zs.text : "");
      }
    }
    else if(el.dataset.bild === "vent") svg = perlen(seg, sp, m.T, W);
    else if(el.dataset.bild === "gross") svg = striche(sp, m.T, W, 84, spiegelVon(k));
    else svg = striche(sp, m.T, W, el.closest(".haupt") ? 46 : 30, spiegelVon(k));
    if(bildMerk.get(el) === svg) continue;
    el.innerHTML = svg;
    bildMerk.set(el, svg);
  }
}

/* ---------- Bedienung ----------
   Einmal gebunden, an #findings (der Inhalt wird neu geschrieben): Zeigen
   und Fokus auf ein Fach oder eine Zeile zeichnen ihre Kerben in den
   Streifen, Verlassen nimmt sie weg (der Fokus behaelt sie); "Mehr zu ..."
   klappt auf und zu, der Fokus bleibt auf dem Knopf (Spezifikation 6). */
let gezeigt: string | null = null;
function zeigen(k: string | null){
  if(k === gezeigt) return;
  gezeigt = k;
  document.querySelectorAll<HTMLElement>("#findings .wbfach[data-n], #findings .wbzeile[data-n]")
    .forEach(f => f.classList.toggle("zeigt", !!k && f.dataset.n === k));
  streifenKerben(k);
}
const zielVon = (e: EventTarget | null) => e instanceof Element ? e.closest<HTMLElement>("#findings .wbfach[data-n], #findings .wbzeile[data-n]") : null;
let gebunden = false;
export function werkbankBinden(): void {
  const box = $("#findings");
  if(gebunden || !box) return;
  gebunden = true;
  box.addEventListener("pointerover", (ev: PointerEvent) => zeigen(zielVon(ev.target)?.dataset.n || zielVon(document.activeElement)?.dataset.n || null));
  box.addEventListener("pointerleave", () => zeigen(zielVon(document.activeElement)?.dataset.n || null));
  box.addEventListener("focusin", (ev: FocusEvent) => zeigen(zielVon(ev.target)?.dataset.n || null));
  box.addEventListener("focusout", (ev: FocusEvent) => { if(!zielVon(ev.relatedTarget)) zeigen(null); });
  box.addEventListener("click", (ev: MouseEvent) => {
    const k = (ev.target as HTMLElement).closest<HTMLElement>(".wbauf");
    if(k){
      const n = k.closest<HTMLElement>(".wbfach[data-n]")?.dataset.n;
      if(!n) return;
      if(offen.has(n)) offen.delete(n); else offen.add(n);
      renderAnalysis();
      // der Knopf ist neu geschrieben: der Fokus geht auf den neuen
      box.querySelector<HTMLElement>('.wbfach[data-n="'+CSS.escape(n)+'"] .wbauf')?.focus();
      return;
    }
    if((ev.target as HTMLElement).closest(".wbrk")){ zuVentius(); return; }
    const z = (ev.target as HTMLElement).closest<HTMLElement>(".wbzeile[data-n]");
    if(z){ gezeigt = null; zeigen(z.dataset.n || null); }
  });
}

/** Neu geladener Kampf: die Striche gluehen einmal von links auf (nicht bei
    Live-Nachladen, nicht bei reduzierter Bewegung - das regelt styles.css). */
export function werkbankNeu(): void {
  const b = document.querySelector<HTMLElement>("#findings .wbbank");
  if(!b) return;
  b.classList.add("neu");
  setTimeout(() => b.classList.remove("neu"), 1100);
}
