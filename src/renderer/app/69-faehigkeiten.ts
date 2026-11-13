import { state } from "./01-state";
import { anzahl, fmt } from "./03-helpers";
import { t } from "./08-translation";
import { skillEntry, skillKey } from "./10-skill-names";
import { skillLabel } from "./14-questlog-weapons";
import { casts, VENTIUS_NAME } from "./15-weapons-and-ventius";
import { isAutoWeapon, pct, weaponFor } from "./16-fight-analysis";
import { schnittKey } from "./05-fights";
import { clock, esc } from "./18-interface-basics";
import { isWatching } from "./45-startup";
import { bezugVon } from "./47-paar";
import { poolFights } from "./53-fenster";
import { ventiusVerlust } from "./26-analysis-tab";
import { kernName } from "./78-analyse-daten";
import {
  AUS_MIN_MS, ausStrecken, faecherOrdnen, hitze, median, MITTEL_MAX, taktLaeufe, taktMitLaeufen, type FArt
} from "../analyse-core";
import type { Fight, Insight, SkillCast } from "../types";

/* ---------- was die Analyse je Faehigkeit weiss, ausser dem Pruefstand (Issue #414) ----------
   Seit #414 gibt es keine Werkbank mehr (Spezifikation 2026-11-08, Inventur
   D01 bis D19, die Entscheidungen O6, O8 und O9): die Faecher und Gruppen
   sind die Karten des Pruefstands (70-pruefstand.ts). Was die Werkbank
   ausserdem sagte, kommt von hier an die Karte der Faehigkeit, die es
   betrifft:
   - die Ordnung der Faehigkeiten nach Art (Einsatz, Takt, dicht, passiv,
     Ventius), die auch "Meister Schaden" in der Kennzeile (26) liest;
   - die Saetze zu Laufzeit und Passiv ("aus, ab ... Vergessen einzuschalten?",
     "Lief ... in n Laeufen", "n Treffer, ausgeloest durch ...");
   - der groesste Treffer, die Fehlschlaege, "Ein Einsatz davon bringt ...";
   - die Tabelle dieser Pull gegen den besten Pull (nur mit Bezug).
   Die Zahlen rechnen die Rechenkerne und analyse-core.ts; hier steht die
   Zuordnung zu den Karten und der Wortlaut. */

/** Die Einsaetze des besten Pulls je Faehigkeit (Name aus dem Log), t in ms
    ab seinem Beginn; null ohne Bezug. */
export type BestCasts = Map<string, SkillCast[]>;

/* ---------- welche Faehigkeit welcher Art (Spezifikation 3.1 der Werkbank, bleibt) ----------
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

/** Die Ordnung der Faecher fuer einen Kampf - die Quelle fuer "Meister Schaden"
    in der Kennzeile (26) und fuer die Saetze an den Karten. */
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
  /* Ruling 14: Auge von Ventius hat immer ein Fach. Liegt es unter
     "Weitere", nimmt es den letzten mittleren Platz; wer dort stand, rueckt
     nach "Weitere" (nach Schaden geordnet). */
  const vi = o.weitere.indexOf(VENTIUS_NAME);
  if(vi >= 0){
    o.weitere.splice(vi, 1);
    if(o.mittel.length >= MITTEL_MAX){ o.weitere.push(o.mittel.pop()!); o.weitere.sort((a, b) => liste.get(b)!.dmg - liste.get(a)!.dmg); }
    o.mittel.push(VENTIUS_NAME);
  }
  ordnungMerk.set(seg, {stempel, o});
  return o;
}

/* ---------- was je Faehigkeit gelaufen ist ----------
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
  // passive Treffer werden nicht gedrueckt: sie zaehlen je Treffer, keine Einsaetze
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
      // Laeufe mit derselben Grenze wie "aus" (4 s), fuer den Satz
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

/* ---------- die Saetze zu Laufzeit und Passiv (Inventur O8) ----------
   Einsatz-Faehigkeiten sagt die Karte selbst (Einsaetze, je Einsatz, Takt);
   Ventius hat seine eigene Karte. Hier nur, was die Karte nicht sagt. */
function satzVon(f: WbFaehigkeit, sp: WbSpur, T: number): { t: string; befund: boolean } | null {
  if(f.art === "dicht" && sp.aus.length){
    const [a, b] = sp.aus.reduce((x, y) => y[1] - y[0] > x[1] - x[0] ? y : x);
    return {befund: true, t: t("analysis.wb.aus", {s: Math.round((b - a)/1000)+"\u00a0s", ab: clock(Math.round(a/1000))})};
  }
  if(f.art === "dicht" || f.art === "takt") return {befund: false, t: t("analysis.wb.lief", {s: Math.round(sp.lief/1000)+"\u00a0s",
    anteil: pct(Math.min(1, sp.lief/T)), n: anzahl(sp.laeufe.length)})};
  if(f.art === "passiv") return {befund: false, t: t("analysis.wb.passivSatz", {n: anzahl(f.hits)})};
  return null;
}

/* ---------- die Tabelle dieser Pull gegen den besten Pull (Inventur O9) ----------
   Spalten: dieser Pull, bester Pull (nur mit Bezug). Die Zahlen der
   Karte (Einsaetze, je Einsatz, kritisch) stehen dort kurz, hier alle fuenf
   nebeneinander. Ein Kampf des Logs bringt alle Einsaetze des besten Pulls
   mit Trefferart (alle); ein gespeicherter Pull nur seine zwoelf staerksten
   Faehigkeiten ohne "stark": dort steht "nicht gespeichert" bzw. ein Strich,
   und der Satz unter der Tabelle sagt warum. */
function vergleich(sp: WbSpur, dmg: number, best: SkillCast[] | null, alle: boolean, zweit: boolean): string {
  const spalte = (E: SkillCast[], D: number) => [anzahl(E.length), fmt(D), E.length ? fmt(median(E.map(c => c.dmg))) : "–",
    pct(E.filter(c => glut(c) >= 2).length/Math.max(1, E.length)), pct(E.filter(c => glut(c) % 2 === 1).length/Math.max(1, E.length))];
  const a = spalte(sp.einsaetze, dmg);
  const b = best && best.length ? spalte(best, best.reduce((s, c) => s + c.dmg, 0)) : alle ? spalte([], 0) : null;
  if(b && !alle) b[4] = "–";
  const kopf = ["analysis.wb.tEinsaetze", "analysis.wb.tSchaden", "analysis.wb.tJe", "analysis.wb.tKrit", "analysis.wb.tStark"];
  return '<table class="wbvgl"><thead><tr><th scope="col"><span class="vh">'+esc(t("analysis.wb.zahlen"))+'</span></th><th scope="col">'+
    esc(t("analysis.wb.diesePull"))+'</th><th scope="col">'+esc(t(zweit ? "analysis.wb.zweitPull" : "analysis.wb.besterPull"))+"</th></tr></thead><tbody>"+
    kopf.map((k, i) => '<tr><th scope="row">'+esc(t(k))+"</th><td>"+esc(a[i]!)+"</td><td>"+esc(b ? b[i]! : t("analysis.wb.nichtGespeichert"))+"</td></tr>").join("")+"</tbody></table>"+
    (!alle && best && best.length ? '<p class="wbfein">'+esc(t("analysis.wb.starkNicht"))+"</p>" : "");
}

/* ---------- was an die Karte kommt ---------- */
/** Eine Zeile der Karte (dt/dd): Beschriftung, Wert, leise Anmerkung; `zaehlt` = der Befund, den das Urteil nennt. */
export interface ZusatzZeile { k: string; dt: string; v: string; n: string; zaehlt: boolean }
export interface KartenZusatz {
  /** Saetze unter den Zahlen (Laufzeit, Passiv, "Ein Einsatz davon bringt ...") */
  saetze: { t: string; befund: boolean; leise?: boolean }[];
  zeilen: ZusatzZeile[];
  /** die aufklappbare Tabelle gegen den besten Pull, HTML; leer ohne Bezug */
  vergleich: string;
  /** die Faehigkeit ist passiv (Entscheidung O8: eigene Gruppe "Passiv") */
  passiv: boolean;
  /** fertiges HTML unter dem Satz der Karte: bei Ventius der Vorbehalt zum Verlust (die beiden Trefferwerte, auf die sich das Urteil beruft) */
  extra: string;
}
export interface ZusatzOptionen {
  gefunden: Insight[]; teuer: string;
  /** der beste Pull desselben Builds; alle: ein Kampf des Logs (alle Einsaetze), zweit: es ist der zweitbeste */
  best: BestCasts | null; bestAlle?: boolean; bestZweit?: boolean;
}
/** Je Karte (Name im Kern, skillKey) das, was die Werkbank an der Faehigkeit sagte. */
export type ZusatzMap = Map<string, KartenZusatz>;

export function kartenZusatz(seg: Fight, o: ZusatzOptionen): ZusatzMap {
  const ord = faecherVonKampf(seg), m = modell(seg, ord), aus: ZusatzMap = new Map();
  const stark = [...ord.liste.values()].sort((a, b) => b.dmg - a.dmg)[0]?.k ?? null;
  const von = (wer: string): KartenZusatz => {
    /* Eine Faehigkeit ohne Schaden (nur Fehlschlaege) hat keine Karte: ihr Satz geht an die staerkste,
       damit er nie verloren geht (wie vorher ins Hauptfach). */
    const name = ord.liste.has(wer) ? wer : ord.haupt ?? stark ?? wer;
    const k = kernName(name, ord.liste.get(name)?.sid ?? "");
    let z = aus.get(k);
    if(!z){ z = {saetze: [], zeilen: [], vergleich: "", extra: "", passiv: false}; aus.set(k, z); }
    return z;
  };
  const hol = (k: string) => o.gefunden.find(x => x.key === k);
  for(const f of ord.liste.values()){
    if(f.art === "ventius") continue;
    const sp = m.spuren.get(f.k)!, sa = satzVon(f, sp, m.T);
    if(f.art === "passiv") von(f.k).passiv = true;
    if(sa) von(f.k).saetze.push(sa);
    if(o.best && (f.art === "einsatz" || f.art === "takt"))
      von(f.k).vergleich = vergleich(sp, f.dmg, o.best.get(f.k) || null, !!o.bestAlle, !!o.bestZweit);
  }
  /* An der staerksten Faehigkeit leise, woraus sie kommt, und was danach kommt (Inventur D08; der Satz von "Wer traegt?"):
     "danach" ist die naechststaerkere Faehigkeit des ganzen Kampfes unter dieser (auch eine passive oder eine Laufzeit). */
  if(ord.haupt){
    const h = ord.liste.get(ord.haupt)!, ges = seg.stats.total || 0;
    const f2 = [...ord.liste.values()].sort((a, b) => b.dmg - a.dmg).find(x => x.k !== h.k && x.dmg <= h.dmg);
    von(h.k).saetze.push({befund: false, leise: true, t: t("analysis.d1.leise", {n: anzahl(h.hits), c: pct(h.hits ? h.crit/h.hits : 0), h: pct(h.hits ? h.heavy/h.hits : 0),
      zweit: f2 ? skillLabel(f2.k, f2.sid) : "", p2: f2 && ges ? pct(f2.dmg/ges, 1) : ""})});
  }
  // was die schwaecheren Salven gekostet haben: der Vorbehalt, auf den sich das Urteil beruft (Inventur E05), an der Ventius-Karte
  const vv = ventiusVerlust(seg);
  if(vv) von(VENTIUS_NAME).extra = vv;
  // der groesste Treffer an der Karte der Faehigkeit, die ihn schlug
  if(seg.stats.max > 0){
    let e = seg.events[0];
    for(const x of seg.events) if(!e || x.dmg > e.dmg) e = x;
    if(e) von(e.skill).zeilen.push({k: "groesster", dt: t("analysis.wb.groesster"), v: fmt(seg.stats.max), n: "", zaehlt: false});
  }
  /* Die Fehlschlaege bei der Faehigkeit mit den meisten, Satz wie vorher;
     ohne Fehlschlag "keine" an der staerksten Faehigkeit (wie vorher im Hauptfach). */
  const fehl = hol("missed");
  if(fehl){
    const namen = [...(seg.missSkills || new Map<string, { n: number; sid: string }>()).entries()].sort((a, b) => b[1].n - a[1].n);
    const skill = fehl.vars.sid ? skillLabel(fehl.vars.skill, fehl.vars.sid) : fehl.vars.skill;
    const wer = namen[0]?.[0] || String(fehl.vars.skill);
    von(wer).zeilen.push({k: "fehl", dt: t("insight.missed.label"), v: t("analysis.wb.fehl", {n: anzahl(fehl.vars.n), share: fehl.vars.share, skill}),
      n: t("insight.missed.note", {...fehl.vars, skill}), zaehlt: o.teuer === "missed"});
  } else {
    const wer = ord.haupt ?? [...ord.liste.values()].sort((a, b) => b.dmg - a.dmg)[0]?.k;
    if(wer) von(wer).zeilen.push({k: "fehl", dt: t("insight.missed.label"), v: t("analysis.wb.keine"), n: "", zaehlt: false});
  }
  // "Ein Einsatz davon bringt ..." gehoert zur staerksten Faehigkeit
  const kon = hol("concentration");
  if(kon && kon.vars.big){
    von(String(kon.vars.skill)).saetze.push({befund: false, t: t("insight.concentration.note", {...kon.vars,
      skill2: kon.vars.skill2 ? skillLabel(kon.vars.skill2, kon.vars.skill2Sid) : ""})});
  }
  return aus;
}
