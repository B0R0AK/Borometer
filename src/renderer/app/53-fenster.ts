import { state } from "./01-state";
import { fmt } from "./03-helpers";
import { schnittKey } from "./05-fights";
import { hauptzielVon, practiceTarget, rateSecs } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { skillKey } from "./10-skill-names";
import { skillLabel } from "./14-questlog-weapons";
import { casts, VENTIUS_FAMILY, VENTIUS_ID, VENTIUS_NAME } from "./15-weapons-and-ventius";
import { LIEST_AB_TREFFER, num1, pct, perSecond, weaponFor } from "./16-fight-analysis";
import { clock, esc } from "./18-interface-basics";
import { isWatching } from "./45-startup";
import { bauBezug, bestInfo, bestLauf, mitLauf } from "./46-best-pull";
import { gleicherBezug } from "../build-core";
import { bezugVon, bezugVonRef } from "./47-paar";
import { cutCasts, dummyClass } from "../best-pull-core";
import {
  fensterLesen, fensterSuchen, hauptschaden, nebenziele, start, START_S, type Fenster, type FensterWerte, type FPull, type FSpur,
} from "../analyse-core";
import type { Fight, PartyCasts, SavedRun } from "../types";

/* ---------- Analyse: Fenster, Nebenziele, Start ----------
   Spezifikation docs/superpowers/specs/2026-09-27-analyse-fenster-design.md
   (Issue #45). Gerechnet wird im Kern (../analyse-core.ts); hier werden nur
   die Zahlen der Seite in seine Form gebracht und die Saetze gebaut. Nichts
   wird gespeichert, geladen oder geschickt. Ohne setup(): der Teil
   deklariert nur, gerufen wird er vom Kopf (20) und von der Analyse (26). */

/* ---------- Nebenziele ----------
   Die grosse Zahl zaehlt jeden Treffer des Kampfes, auch die auf Fellini in
   der Phase dazwischen. Die Zeile darunter sagt, wie viel davon - ab 5 %,
   darunter waere sie auf fast jedem Kampf mit einer Flaechenattacke da.
   Hauptziel sind der Boss aus dem Kampfnamen, seine Schreibweisen und
   Formen (hauptzielVon, 06). Gerechnet einmal je Kampfstand: der Kopf
   zeichnet beim Livelog alle zwei Sekunden. */
type Neben = ReturnType<typeof nebenziele>;
const nebenMerk = new WeakMap<Fight, { stempel: string; n: Neben }>();
function nebenStand(seg: Fight | undefined): Neben {
  if(!seg || !seg.stats || seg.stats.hits < LIEST_AB_TREFFER) return null;
  const stempel = seg.events.length + "|" + seg.stats.total + "|" + seg.stats.name;
  const alt = nebenMerk.get(seg);
  if(alt && alt.stempel === stempel) return alt.n;
  const treffer = seg.events.map(e => ({t: e.t - seg.start, dmg: e.dmg, ziel: e.target}));
  const n = nebenziele(treffer, hauptzielVon(seg), seg.stats.total);
  nebenMerk.set(seg, {stempel, n});
  return n;
}
function nebenWerte(n: NonNullable<Neben>){
  const g = n.ziele[0]!;
  return {p: pct(n.anteil), ziel: g.ziel, n: n.ziele.length, q: pct(g.anteil), t: clock(n.ab / 1000)};
}
/** Die Zeile unter der grossen Zahl, oder "" (ohne Uhr steht dort keine Zahl, also auch keine Zeile). */
export function nebenzielKopf(seg: Fight | undefined): string {
  if(state.noTime) return "";
  const n = nebenStand(seg);
  if(!n) return "";
  return t(n.ziele.length > 1 ? "head.sideMany" : "head.side", nebenWerte(n));
}
/* Unter der Zielaufteilung dieselbe Angabe, und was die Zahl oben ohne
   diesen Schaden zeigte - gerechnet durch dieselbe Zeit wie sie (rateSecs).
   Ohne Uhr gibt es weder "ab" noch eine Zahl oben. */
export function nebenzielAnalyse(seg: Fight | undefined): string {
  const n = nebenStand(seg);
  if(!n || !seg) return "";
  const v = nebenWerte(n), viele = n.ziele.length > 1;
  if(state.noTime)
    return '<p class="sidefind">' + esc(t(viele ? "analysis.sideManyNoTime" : "analysis.sideNoTime", v)) + "</p>";
  const ohne = seg.stats.total * (1 - n.anteil) / rateSecs(seg);
  return '<p class="sidefind">' + esc(t(viele ? "analysis.sideMany" : "analysis.side", v)) +
    ' <span class="sn">' + esc(t("analysis.sideCounts", {dps: fmt(ohne)})) + "</span></p>";
}

/* ---------- Hast du im Fenster getroffen? ----------
   Borometer sucht selbst den Skill, nach dem der Hauptschaden deutlich
   staerker trifft (4.2) - ueber alle Pulls desselben Builds: die Kaempfe des
   geladenen Logs und die gespeicherten besten und zweitbesten Pulls (alle
   Bosse, alle Puppenlaengen). Nichts wird gemerkt ausser in der Sitzung: das
   Fenster ist jedes Mal nachgemessen, und der Satz sagt, worueber. */
const FAM = "fam:ventius";
const KEINE_WAFFE = new Set(["", "Unassigned", "Passive"]);
/* Die Ventius-Familie ist ein Schluessel: nach ventiusPass heisst sie Auge
   von Ventius, in einem Kampf ohne Salve noch Decisive Sniping/Bombardment
   bzw. in der Sprache des Clients. */
function schluessel(n: string, s: string){
  if(s === VENTIUS_ID || n === VENTIUS_NAME) return FAM;
  const k = skillKey(n, s);
  return VENTIUS_FAMILY.has(k) ? FAM : k;
}
/* Einsaetze in die Form des Kerns. Zwei Namen mit einem Schluessel (die
   beiden Faehigkeiten der Familie in einem Kampf ohne Salve) werden eine
   Spur. */
function spuren(liste: PartyCasts[]): FSpur[] {
  const je = new Map<string, FSpur>();
  for(const l of liste){
    const k = schluessel(l.n, l.s);
    const da = je.get(k);
    if(da){ da.c = [...da.c, ...l.c].sort((a, b) => a[0] - b[0]); continue; }
    je.set(k, {k, n: l.n, s: l.s, waffe: !KEINE_WAFFE.has(weaponFor(l.n, l.s)), c: l.c.slice()});
  }
  return [...je.values()];
}
/* Ein Kampf des Logs: ALLE Einsaetze (casts), nicht nur die zwoelf, die ein
   gespeicherter Pull traegt - hier heisst "fehlt" wirklich "nicht
   eingesetzt". An der Puppe auf die Klassenlaenge geschnitten wie beim
   besten Pull. Exportiert fuer das Messskript (scripts/fenster-mess.mjs). */
export function segPull(seg: Fight, cls: number | null = null): FPull {
  const sidOf = new Map<string, string>();
  for(const e of seg.events) if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);
  let liste: PartyCasts[] = [...casts(seg)].map(([n, c]) => ({n, s: sidOf.get(n) || "",
    c: c.map(x => [Math.round(x.t - seg.start), Math.round((x.last || x.t) - seg.start), Math.round(x.dmg), x.hits, x.crit || 0])}));
  if(cls) liste = cutCasts(liste, cls * 1000);
  const aus = (seg.unverwundbar || []).filter(u => u.bis > u.von).map(u => ({von: u.von, bis: u.bis}));
  return {spuren: spuren(liste), sekunden: cls ? Math.min(rateSecs(seg), cls) : rateSecs(seg), alle: true,
          ...(aus.length ? {aus} : {})};
}
/* Ein gespeicherter Pull: nur seine zwoelf staerksten Faehigkeiten, also
   "alle: false" - fehlt der Fenster-Skill, ist das unbekannt, nicht null.
   Seine unverwundbaren Strecken kennt er nicht; er wird nicht korrigiert. */
function laufPull(run: SavedRun): FPull | null {
  if(!run.casts || !run.casts.length) return null;
  return {spuren: spuren(run.casts), sekunden: Number.isFinite(run.fought) ? run.fought : run.seconds, alle: false};
}

/* Der Pool je Build, und die Suche darueber - gemerkt in der Sitzung,
   solange sich weder das Log noch die gespeicherten Pulls noch die
   Waffenzuordnung noch die Zuordnung der Builds aendern (beim Livelog zeichnet die Analyse alle zwei
   Sekunden). Ohne Paar nur der Kampf selbst. Der laufende Kampf
   waehrend Live gehoert nicht hinein. */
const suchMerk = new Map<string, { fe: Fenster | null; pool: FPull[] }>();
function bestStempel(){
  return Object.keys(state.best).sort().map(k => { const e = state.best[k]!; return k + ":" + e.best.at + ":" + (e.second?.at ?? ""); }).join(",");
}
function gesucht(seg: Fight): { fe: Fenster | null; pool: FPull[] } {
  const hier = bezugVon(seg);
  const bekannt = !!hier;
  const live = isWatching();
  /* Waehrend Live waechst nur der laufende Kampf, und der gehoert nicht in
     den Pool: gemerkt wird dann nach der Zahl der Kaempfe und der Laenge des
     juengsten fertigen - sonst suchte jeder Takt alle zwei Sekunden neu. */
  const logStand = live ? state.encounters.length + ":" + (state.encounters[1]?.events.length ?? 0) : state.events.length;
  /* Wer und wie geschnitten (schnittKey, 05): im Party-Log mit zwei
     Spielern desselben Builds saehe der zweite sonst den Pool des ersten. */
  const merk = [schnittKey(), bekannt ? JSON.stringify(hier) : "seg" + seg.start + "|" + seg.events.length, state.encounters.length,
    logStand, live, bestStempel(), Object.keys(state.weaponOf).length, Object.keys(state.weaponById).length].join("|");
  const alt = suchMerk.get(merk);
  if(alt) return alt;
  const pool: FPull[] = [];
  if(!bekannt) pool.push(segPull(seg));
  else {
    const starts = new Set<number>();
    state.encounters.forEach((x, i) => {
      starts.add(x.start);
      if(live && i === 0) return;
      const dort = x === seg ? hier : bezugVon(x);
      if(gleicherBezug(hier, dort)) pool.push(segPull(x));
    });
    for(const key of Object.keys(state.best)){
      const e = state.best[key]!;
      for(const platz of ["best", "second"] as const){
        const p = e[platz];
        // ein Pull aus dem geladenen Log zaehlt nur einmal, als Kampf mit allen Einsaetzen
        if(!p || (state.wall && starts.has(p.at))) continue;
        const dort = bezugVonRef("best|" + key + "|" + platz);
        if(!dort || !gleicherBezug(hier, dort)) continue;
        const q = laufPull(p.run);
        if(q) pool.push(q);
      }
    }
  }
  const h = hauptschaden(pool);
  const raus = {fe: h ? fensterSuchen(pool, h) : null, pool};
  if(suchMerk.size > 20) suchMerk.clear();
  suchMerk.set(merk, raus);
  return raus;
}

/* Der Name eines Schluessels, wie ihn die Oberflaeche nennt: Auge von
   Ventius, sobald ein Pull des Pools die Salve hatte, sonst der Name aus dem
   Log - in der Sprache der Oberflaeche. */
function nameVon(k: string, pool: FPull[]): string {
  let erst: FSpur | undefined;
  for(const p of pool) for(const s of p.spuren){
    if(s.k !== k) continue;
    if(k === FAM && s.s === VENTIUS_ID) return skillLabel(VENTIUS_NAME, VENTIUS_ID);
    erst = erst || s;
  }
  return erst ? skillLabel(erst.n, erst.s) : k;
}

/** Was der Abschnitt und das Urteil zum Kampf links brauchen. */
export interface FensterStand {
  fe: Fenster;
  hName: string;
  fName: string;
  werte: FensterWerte;
  /** der Vergleichspull, null ohne Bezug oder wenn er den Fenster-Skill nicht unter seinen zwoelf traegt */
  bezug: FensterWerte | null;
  /** es gibt einen Vergleichspull (auch wenn er nichts ueber das Fenster sagt) */
  hatBezug: boolean;
  zweit: boolean;
  /** der Satz, dass es noch keinen Vergleich gibt, oder "" */
  noRef: string;
}

/* Der Stand zum Kampf links, oder null: dann entfaellt der Abschnitt ganz
   (Spezifikation 8). */
export function fensterStand(seg: Fight | undefined): FensterStand | null {
  if(!seg || state.noTime || !seg.stats || seg.stats.hits < LIEST_AB_TREFFER) return null;
  if(state.group === "party") return null;
  // mehrere Angreifer ohne Filter: die Einsaetze mehrerer Spieler mischten sich
  if(state.players.length > 1 && state.player === "__all") return null;
  // waehrend Live waechst der neueste Kampf noch
  if(state.encounters[0] === seg && isWatching()) return null;
  const {fe, pool} = gesucht(seg);
  if(!fe) return null;
  /* An der Puppe wie beim besten Pull: der Kampf und sein Bezug auf dieselbe
     Klassenlaenge geschnitten (60/120/180 s) - Anteil, Kosten, je Minute
     und Urteil rechnen so ueber gleich lange Strecken. Die Suche im Pool
     bleibt ungeschnitten; gespeicherte Puppen-Pulls sind es ohnehin. */
  const cls = practiceTarget(seg.stats.name) ? dummyClass(seg.stats.seconds) : null;
  const werte = fensterLesen(segPull(seg, cls), fe);
  if(!werte) return null;
  /* Der Bezug innerhalb des Waffenpaars (bauBezug, 46-best-pull.ts): der beste Pull an diesem Boss mit demselben
     Paar, im besten selbst der zweitbeste. */
  const alle = seg === state.encounters[state.sel] ? bestInfo() : {};
  const hier = bezugVon(seg);
  const info = alle.refId ? bauBezug(hier, alle) : alle;
  let bezug: FensterWerte | null = null, hatBezug = false, noRef = "";
  // ein Bezug ohne Lauf (ohneLauf) hat keine Werte: wie kein Bezug
  if(mitLauf(info) && info.curId){
    const s = /^seg(\d+)/.exec(info.refId);
    const refSeg = s ? state.encounters[+s[1]!] : undefined;
    const run = s ? null : bestLauf(info.refId);
    const p = refSeg ? segPull(refSeg, cls) : run ? laufPull(run) : null;
    hatBezug = !!(refSeg || run);
    bezug = p ? fensterLesen(p, fe) : null;
  } else if(info.grund === "first" && info.label){
    noRef = t("analysis.window.noRefPair", {boss: info.label});
  }
  return {fe, hName: nameVon(fe.h, pool), fName: nameVon(fe.f, pool), werte, bezug, hatBezug,
          zweit: !!info.isBest, noRef};
}

/* Der Abschnitt: der Satz "gefunden" zuerst - die Regel ist gemessen, nicht
   gewusst -, dann die Antwort mit ihrem Balken, drei Kacheln, der Krit-Satz.
   Glut traegt die Antwort nur, wenn das Urteil oben sie nennt (zaehlt). */
export function fensterAbschnitt(st: FensterStand, zaehlt: boolean): string {
  const {fe, werte: w, bezug: b} = st;
  const bp = t(st.zweit ? "analysis.ref.second" : "analysis.ref.best");
  const zahl = (x: number | null) => x == null ? "\u2014" : fmt(x);
  const rate = (x: number | null) => x == null ? "\u2014" : num1(x);
  const gef = t(fe.pulls > 1 ? "analysis.window.foundPair" : "analysis.window.one", {
    l: fe.l + "\u00a0s", f: st.fName, h: st.hName, g: pct(fe.gewinn), in: fmt(fe.jeIn), out: fmt(fe.jeAus), n: fe.pulls});
  const wort = b ? t("analysis.window.bar", {p: pct(w.aussen), bp, q: pct(b.aussen)})
                 : t("analysis.window.barAlone", {p: pct(w.aussen)});
  const p = Math.max(0, Math.min(1, w.aussen));
  const kachel = (k: string, z: string, r: string | null) => "<li>" + '<span class="k">' + esc(k) + "</span>" +
    '<span class="z">' + esc(z) + "</span>" + (r != null ? '<span class="r">' + esc(t("analysis.window.ref", {bp, x: r})) + "</span>" : "") + "</li>";
  const mitRef = st.hatBezug;
  return '<div class="fwin">' +
    '<p class="fgef">' + esc(gef) + "</p>" +
    '<div class="fant' + (zaehlt ? " zaehlt" : "") + '"><p class="v">' + esc(t("analysis.window.value", {p: pct(w.aussen), h: st.hName})) + "</p>" +
    '<div class="mass"><div class="m"><span class="mspur" aria-hidden="true"><i style="width:' + (100 * p).toFixed(1) + '%"></i></span>' +
    '<span class="mwort">' + esc(wort) + "</span></div></div></div>" +
    '<ul class="fwerte" aria-label="' + esc(t("analysis.window.tiles")) + '">' +
    kachel(t("analysis.window.in"), zahl(w.jeIn), mitRef ? zahl(b ? b.jeIn : null) : null) +
    kachel(t("analysis.window.out"), zahl(w.jeAus), mitRef ? zahl(b ? b.jeAus : null) : null) +
    kachel(t("analysis.window.rate", {f: st.fName}), rate(w.jeMinute), mitRef ? rate(b ? b.jeMinute : null) : null) +
    "</ul>" +
    (w.kritIn != null && w.kritAus != null
      ? '<p class="fkrit">' + esc(t("analysis.window.crit", {a: pct(w.kritIn), b: pct(w.kritAus)})) + "</p>" : "") +
    (st.noRef ? '<p class="fkrit">' + esc(st.noRef) + "</p>" : "") +
    "</div>";
}

/* ---------- Der Start ----------
   Die ersten 10 s gegen den Vergleichspull (4.5): die Wirkung, gemessen am
   Schaden. Die Ursache steht nicht hier; der Satz verweist auf die
   Zeitleiste im Bereich Rotation, wo die Einsaetze der ersten Sekunden
   stehen (der Trainer, auf den er frueher verwies, entfaellt:
   Spezifikation 3). Der Bezug innerhalb des Waffenpaars (bauBezug). */
export interface StartStand {
  dps: number;
  bezug: number;
  q: number;
  art: "schwaecher" | "ueblich" | "staerker";
  zweit: boolean;
}
export function startStand(seg: Fight | undefined): StartStand | null {
  if(!seg || state.noTime || !seg.stats || seg.stats.hits < LIEST_AB_TREFFER) return null;
  if(state.group === "party" || seg !== state.encounters[state.sel]) return null;
  if(state.encounters[0] === seg && isWatching()) return null;
  /* Eine Strecke, in der das Ziel unverwundbar war, in den ersten 10 s:
     dort lief Mechanik. Geprueft nur beim eigenen Kampf - der Bezug ist oft
     ein gespeicherter Pull, und der kennt seine Strecken nicht. */
  if((seg.unverwundbar || []).some(u => u.bis > u.von && u.von < START_S * 1000)) return null;
  const alle = bestInfo();
  if(!alle.refId) return null;
  const info = bauBezug(bezugVon(seg), alle);
  if(!mitLauf(info)) return null;
  const s = /^seg(\d+)/.exec(info.refId);
  const refSeg = s ? state.encounters[+s[1]!] : undefined;
  const run = s ? null : bestLauf(info.refId);
  const bezug = refSeg ? perSecond(refSeg, 0).total : run ? run.perSecond : null;
  if(!bezug) return null;
  const r = start(perSecond(seg, 0).total, bezug);
  return r ? {...r, zweit: !!info.isBest} : null;
}
function startSatz(st: StartStand): string {
  if(st.art === "ueblich") return t("analysis.start.usual");
  if(st.art === "staerker") return t(st.zweit ? "analysis.start.strongerSecond" : "analysis.start.stronger");
  return t(st.zweit ? "analysis.start.weakerSecond" : "analysis.start.weaker", {p: pct(st.q)});
}
/* Ein Weg in die Rotation (Issue #107): Von/bis auf die Strecke, der Klick
   laeuft ueber den Hoerer der Analyse (data-weg, 26-analysis-tab.ts). */
/** Der Knopf in die Rotation fuer die Strecke von-bis (Sekunden), mit der Strecke im Vorlesenamen. */
export function inRotationKnopf(von: number, bis: number, label: string): string {
  return '<dd class="w"><button type="button" class="inrot" data-weg="rot" data-von="'+von+'" data-bis="'+bis+'" aria-label="'+
    esc(t(label, {z: clock(von)+"\u2013"+clock(bis)}))+'">'+esc(t("analysis.inRotation"))+"</button></dd>";
}
/** Der Eintrag unter "Weitere Befunde" (Neugestaltung 28.09., DECISION 4.14:
    der Rhythmus verdichtet): Wert, Vergleichswert und ein Satz - nur mit
    Vergleichspull. Begriff und Werte fuer die Liste #weitereListe. */
export function startZeile(seg: Fight | undefined): string {
  const st = startStand(seg);
  if(!st) return "";
  const bp = t(st.zweit ? "analysis.ref.second" : "analysis.ref.best");
  // ein deutlich schwaecherer Start fuehrt in die Rotation, auf die ersten 10 s (Issue #107)
  return '<div class="find" data-k="start"><dt class="k">' + esc(t("analysis.start.label")) + '</dt><dd class="v">' + esc(fmt(st.dps)) +
    '</dd><dd class="n">' + esc(t("analysis.start.ref", {bp, x: fmt(st.bezug)}) + " \u00b7 " + startSatz(st)) + "</dd>" +
    (st.art === "schwaecher" ? inRotationKnopf(0, START_S, "analysis.inRotation.start") : "") + "</div>";
}
