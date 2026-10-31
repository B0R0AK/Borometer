import { state } from "./01-state";
import { anzahl, axisNum, dur, fmt } from "./03-helpers";
import { practiceTarget } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { bossIcon } from "./12-boss-images";
import { skillLabel } from "./14-questlog-weapons";
import { casts, VENTIUS_ID, VENTIUS_NAME, ventiusMix } from "./15-weapons-and-ventius";
import {
  fightFacts, insights, LIEST_AB_TREFFER, num1, pct, pctMin, pctOf, perSecond, schwaechstesFenster,
  unverwundbareSekunden, zaehlung
} from "./16-fight-analysis";
import { $, clock, esc } from "./18-interface-basics";
import { rotWindow } from "./25-rotation";
import { switchTab } from "./34-menus-drop-and-tabs";
import { catOf, HIT_CATS } from "./19-grouping-and-party-fights";
import { isWatching } from "./45-startup";
import { bauBezug, bestInfo, bestLauf, mitLauf } from "./46-best-pull";
import { bezugVon } from "./47-paar";
import { fensterStand, inRotationKnopf, nebenzielAnalyse, startZeile, type FensterStand } from "./53-fenster";
import { gedrueckteEinsaetze } from "./54-deine-rotation";
import { mechanikSekunden, mechanikStand, mechanikStempel } from "./61-mechanik";
import { faecherVonKampf, type BestCasts, werkbankBinden, werkbankHtml, werkbankNeu, werkbankZeichnen } from "./69-werkbank";
import { fahneWaehlen, renderStreifen } from "./70-kampfstreifen";
import {
  abstandWaechst, direkteRaten, fensterKosten, fensterUrteil, haelften, jeMinute, luecken, schwacheStelle, staerksteStrecke, type Luecken
} from "../analyse-core";
import { classDps, dummyClass, pullWhen } from "../best-pull-core";
import type { Fight, Insight, SkillCast } from "../types";

/* ---------- analysis ----------
   Seit #218 (Spezifikation 2026-10-07, 2): oben der Kopf (#analysisCall)
   mit dem einen Urteil links und der Kennzeile rechts (#wbKenn), darunter
   der Kampfstreifen (#verdict, 70-kampfstreifen.ts) mit der Glutkurve, den
   Fahnen und der Befundliste (#weitereListe), dann in #findings die
   Werkbank je Faehigkeit (69-werkbank.ts: die Faecher mit "Hast du im
   Fenster getroffen?" im Hauptfach, DECISION 4.13, und dem Fach Auge von
   Ventius; "je Boss" steht seit #218 Etappe 3 in den Rekorden, 62; die Zeilen Laufzeit, Weitere
   Faehigkeiten, Passiv) und die Ziele (nur bei mehreren); ganz unten der
   feste Fuss "Was das Log nicht weiss" (index.html). Luecken
   zaehlen nach dem Median (luecken, ../analyse-core.ts), ihre Definition
   steht als Satz unter der Ueberschrift der Form, darunter die Zeile zur
   erkannten Mechanik des Bosses (61-mechanik.ts); deren Strecke zaehlt
   nicht als Luecke. */
export function renderAnalysis(){
  const seg = state.encounters[state.sel];
  /* Ohne Kampf bleibt nichts stehen. Vorher kehrte diese Zeile nackt um,
     und alles, was die Tafel beim letzten Mal geschrieben hatte, blieb im
     Dokument: nach "Leeren" stand der Urteilskasten mit 179.4k SCHNITT und
     drei Saetzen ueber einen geloeschten Kampf da, waehrend die Leiste
     daneben "Noch keine Kaempfe geladen" sagte. Hier kann das niemand
     umgehen. */
  if(!seg){
    const kasten = $("#verdict"); if(kasten) kasten.hidden = true;
    const urteil = $("#analysisCall"); if(urteil){ urteil.hidden = true; urteil.innerHTML = ""; }
    const liste = $("#weitereListe"); if(liste) liste.innerHTML = "";
    const befunde = $("#findings"); if(befunde) befunde.innerHTML = "";
    findingsHtml = ""; zuletztGezeigt = null;
    return;
  }
  const f = fightFacts(seg);
  const lk = lueckenStand(seg);
  const duenn = seg.stats.hits < LIEST_AB_TREFFER;
  // der Geist des besten Pulls (Etappe 2): Kennzeile, Kurve, Fahne, Spiegel und Tabelle lesen ihn
  const best = duenn ? null : bestCasts(seg);

  /* Das Urteil oben und die Befunde darunter aus einer Rechnung
     (urteilHtml); die Tafel im Bereich Kampf zeigt dasselbe Urteil. */
  const u = urteilHtml(seg, true);
  const kasten = $("#analysisCall");
  // das unsichtbare h3 "Urteil" (Issue #109): der Vorleser findet das Feld im Ueberschriftenbaum
  // der Kopf (#218): links das Urteil, rechts die Kennzeile
  if(kasten){ kasten.hidden = false; kasten.className = u.klasse + " wbkopf";
    /* "Zum Beleg" steht am Ende der Erklaerung wie ein Verweis im Satz, nicht
       in einer eigenen Zeile: bei 2000 x 1480 bleibt der Fuss so im Blick. */
    const beleg = u.teuer ? ' <button type="button" class="zubeleg" data-weg="beleg" data-ziel="'+esc(u.teuer)+'">'+esc(t("analysis.zumBeleg"))+"</button>" : "";
    kasten.innerHTML = '<div class="wbu"><h3 class="vh">'+esc(t("tafel.urteil"))+"</h3>"+u.html.replace(/<\/p>$/, beleg+"</p>")+ganzerKampf(seg)+"</div>"+
      kennzeile(seg, u.gefunden, lk, best); }
  const {gefunden, fenster, teuer} = u;
  wegeBinden();

  renderWeitere(seg, gefunden, teuer, lk, best);
  $("#wbWie").innerHTML = wieHtml(seg, gefunden);

  // die Werkbank (#218); unter der Schwelle steht nur der Kopf
  let html = duenn ? "" : werkbankHtml(seg, {fenster, teuer, gefunden,
    best: best ? best.casts : null, bestAlle: !!best && best.alle, bestZweit: !!best && best.zweit});
  /* Die Ziele nur, wo es wirklich mehr als eines gab - mit Bossbild, wo
     eines bekannt ist, sonst bleibt die Spalte leer und die Zeilen stehen
     trotzdem buendig. Darunter der Satz zu den Nebenzielen. */
  if(f.targetCount >= 2){
    html += '<section class="fsec" aria-labelledby="zieleH"><h3 id="zieleH">'+esc(t("analysis.sec.where"))+"</h3>"+
      '<div class="tsplit"><div class="tsk">'+esc(t("facts.targetsIn",{n:f.targetCount}))+'</div>'+
      f.targets.slice(0,6).map(tg => {
        const bild = bossIcon(tg.name);
        return '<div class="tsrow">'+
          (bild ? '<img src="'+bild+'" alt="" aria-hidden="true">' : "<span></span>")+
          '<span class="tsn">'+esc(tg.name)+'</span>'+
          '<span class="tsbar"><i style="width:'+(100*tg.share).toFixed(1)+'%"></i></span>'+
          '<span class="tsv">'+pctMin(tg.share, 0)+'</span></div>';
      }).join("")+nebenzielAnalyse(seg)+"</div></section>";
  }
  /* Unter Live laeuft das hier alle zwei Sekunden, dazu bei jeder
     Fenstergroesse: #findings wird nur neu geschrieben, wenn sich das
     Markup aendert. Lag der Fokus darin (ein Knopf der Werkbank), bekommt
     ihn danach derselbe Knopf. */
  const box = $("#findings");
  if(html !== findingsHtml){
    const a = document.activeElement as HTMLElement | null;
    const fokus = a && box.contains(a) ? fokusPfad(box, a) : null;
    box.innerHTML = html;
    findingsHtml = html;
    if(fokus) ((fokus.pfad && box.querySelector<HTMLElement>(fokus.pfad)) || box.querySelectorAll<HTMLElement>(FOKUSBAR)[fokus.i])?.focus();
  }
  werkbankBinden();
  werkbankZeichnen(seg);
  if(seg.start !== zuletztGezeigt){ zuletztGezeigt = seg.start; werkbankNeu(); }
  // der Streifen nach den Faechern: eine gedrueckte Fahne dimmt die neuen
  renderVerdict(seg, lk, best);
  formFuellen();
}

/* ---------- der Geist des besten Pulls (#218, Spezifikation 1, 2.1, 3.2, 5.1) ----------
   Derselbe Bezug wie Fenster und Start (53-fenster.ts): der beste Pull an
   diesem Boss mit demselben Waffenpaar (bauBezug), im besten selbst der
   zweitbeste; ein Bezug ohne Lauf zaehlt nicht. Ein Kampf des geladenen
   Logs ("seg<n>") bringt alle Einsaetze mit Trefferart; ein gespeicherter
   Pull nur seine zwoelf staerksten Faehigkeiten, ohne "stark" (alle: false -
   was fehlt, ist unbekannt, nicht null). Die Kurve ist sein Schaden je
   Sekunde (perSecond, wie beim Start), an der Puppe auf die Klassenlaenge
   geschnitten. Unter Live laeuft das alle zwei Sekunden: gemerkt nach dem
   Kampf und dem Bezug. */
export interface BestGeist {
  casts: BestCasts;
  sek: number[];
  /** Schaden je Sekunde des Bezugs */
  wert: number;
  /** sein Tag ("21.09."), leer ohne Datum */
  tag: string;
  /** "vom 21.09." oder "aus diesem Log" */
  wann: string;
  /** der Kampf ist selbst der beste: der Geist ist der zweitbeste */
  zweit: boolean;
  /** alle Einsaetze bekannt (ein Kampf des Logs), sonst nur die zwoelf gespeicherten */
  alle: boolean;
  /** dieser Kampf gegen den Bezug, -0.08 = 8 % darunter */
  rel: number;
}
let geistMerk: { stempel: string; g: BestGeist | null } | null = null;
export function bestCasts(seg: Fight): BestGeist | null {
  if(state.noTime || !seg.stats || seg.stats.hits < LIEST_AB_TREFFER) return null;
  if(state.group === "party" || seg !== state.encounters[state.sel]) return null;
  // waehrend Live waechst der neueste Kampf noch (wie Fenster und Start)
  if(state.encounters[0] === seg && isWatching()) return null;
  const alle = bestInfo();
  if(!alle.refId) return null;
  const info = bauBezug(bezugVon(seg), alle);
  if(!mitLauf(info) || !(info.refDps && info.refDps > 0)) return null;
  const m = /^seg(\d+)/.exec(info.refId);
  const refSeg = m ? state.encounters[+m[1]!] : undefined;
  const stempel = [seg.start, seg.events.length, seg.stats.dps, info.refId, info.refDps, info.refAt, !!info.isBest, state.lang,
    refSeg ? refSeg.start + ":" + refSeg.events.length : ""].join("|");
  if(geistMerk && geistMerk.stempel === stempel) return geistMerk.g;
  const g = geistBauen(seg, info.refId, refSeg, info.refDps, info.refAt ?? null, !!info.isBest);
  geistMerk = {stempel, g};
  return g;
}
function geistBauen(seg: Fight, refId: string, refSeg: Fight | undefined, wert: number, at: number | null, zweit: boolean): BestGeist | null {
  const cls = practiceTarget(seg.stats.name) ? dummyClass(seg.stats.seconds) : null;
  const bisMs = cls ? cls*1000 : Infinity;
  const map: BestCasts = new Map();
  let sek: number[];
  if(refSeg){
    for(const [n, liste] of casts(refSeg)){
      const c: SkillCast[] = liste.map(x => ({...x, t: x.t - refSeg.start, last: (x.last || x.t) - refSeg.start})).filter(x => x.t < bisMs);
      if(c.length) map.set(n, c);
    }
    sek = perSecond(refSeg, 0).total;
    if(cls) sek = sek.slice(0, cls);
  } else {
    const run = bestLauf(refId);
    if(!run) return null;
    for(const p of run.casts || []){
      const c: SkillCast[] = p.c.map(([t0, l, d, h, k]) => ({t: t0, last: l, dmg: d, hits: h, crit: k}));
      const da = map.get(p.n);
      map.set(p.n, da ? [...da, ...c].sort((a, b) => a.t - b.t) : c);
    }
    /* Die Kurve aus perSecond des Laufs (der ganze Schaden, wie beim Start);
       ein Lauf ohne sie aus seinen Einsaetzen, je an der Sekunde ihres Beginns */
    if(run.perSecond && run.perSecond.length) sek = run.perSecond.slice();
    else {
      sek = Array.from({length: Math.max(1, Math.ceil(run.seconds || 0))}, () => 0);
      for(const c of map.values()) for(const x of c){ const i = Math.floor(x.t/1000); if(i >= 0 && i < sek.length) sek[i]! += x.dmg; }
    }
  }
  if(!sek.length) return null;
  const eigen = cls ? classDps(seg.stats.seconds, seg.stats.dps, perSecond(seg, 0).total, cls) : seg.stats.dps;
  // ohne Datum (state.wall falsch) ist at null: "aus diesem Log"
  const tag = at != null ? pullWhen(at, state.lang).split(" ")[0]! : "";
  return {casts: map, sek, wert, tag, wann: tag ? t("best.leadFrom", {day: tag}) : t("best.thisLog"), zweit, alle: !!refSeg, rel: eigen/wert - 1};
}

let findingsHtml = "", zuletztGezeigt: number | null = null;
/* Ein Selektor fuer das fokussierte Element in #findings, der ein neues
   Schreiben uebersteht: Knopf und Fach ueber data-n und Klasse. */
const FOKUSBAR = "button, a[href], [tabindex]:not([tabindex='-1'])";
function fokusPfad(box: HTMLElement, a: HTMLElement): { pfad: string; i: number } {
  const fach = a.closest<HTMLElement>("[data-n]");
  const n = fach ? '[data-n="'+CSS.escape(fach.dataset.n || "")+'"]' : "";
  const pfad = !n ? "" : a.classList.contains("wbauf") ? ".wbfach"+n+" .wbauf" : a.classList.contains("wbzeile") ? ".wbzeile"+n
    : a.matches(".inrot[data-weg]") ? ".wbfach"+n+' .inrot[data-weg="'+(a.dataset.weg || "")+'"]' : "";
  // alles andere (die Gruppen, das Fenster, die Ziele): die Stelle unter den fokussierbaren
  return {pfad, i: [...box.querySelectorAll(FOKUSBAR)].indexOf(a)};
}

/* ---------- die Form im grossen Fenster (Issue #110) ----------
   Ab 1200 Punkt Fensterhoehe nimmt die Form den Platz, der da ist: sie
   waechst in das, was unter dem Fuss frei bliebe (im Mechanik-Fall blieben
   bei 2000 x 1480 sonst etwa 650 Punkt leer), hoechstens auf FORM_MAX, und
   gibt nach, wo der Fuss sonst unter die Statusleiste rutschte, hoechstens
   bis FORM_MIN (gewuenscht: "Was das Log nicht weiss" ohne Rollen bei
   2000 x 1480). Die Saeulen sind ein SVG ohne festes Seitenverhaeltnis, sie
   folgen ohne neues Zeichnen; renderAnalysis laeuft bei jeder Fenstergroesse. */
const FORM_MIN = 112, FORM_MAX = 320, FORM_AB_H = 1200;
function formFuellen(){
  const box = $("#saeulen"), fuss = $("#afuss"), leiste = $("#statusleiste");
  if(!box) return;
  box.style.height = "";
  const hoch = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--winh")) || innerHeight;
  if(hoch < FORM_AB_H || !fuss || !leiste || !box.getClientRects().length) return;
  const frei = leiste.getBoundingClientRect().top - fuss.getBoundingClientRect().bottom - 8;
  const jetzt = box.getBoundingClientRect().height;
  const soll = Math.max(FORM_MIN, Math.min(FORM_MAX, jetzt + frei));
  if(Math.abs(soll - jetzt) >= 1) box.style.height = soll.toFixed(0) + "px";
}

/* ---------- die Luecken nach dem Median ----------
   Einmal je Kampf gerechnet (das Urteil, die Form, die Befunde und "Hast du
   durchgedrueckt?" lesen dieselben); unter Live waechst der Kampf, darum
   haengt der Merker an Ende und Zahl der Treffer. Ohne Uhr gibt es keine
   Sekunden und damit keine Luecken. Eine erkannte Mechanik des Bosses
   (61-mechanik.ts) ist wie eine Unverwundbarkeit keine Luecke und zaehlt
   nicht zum Median; sie haengt an den anderen geladenen Pulls und steht
   darum mit im Merker. */
export type LueckenStand = Luecken & { T: number; sek: number[] };
const lueckenMerk = new WeakMap<Fight, { stempel: string; l: LueckenStand }>();
export function lueckenStand(seg: Fight): LueckenStand | null {
  if(state.noTime || !seg.stats.seconds) return null;
  const stempel = seg.end + "|" + seg.events.length + "|" + (seg.unverwundbar || []).length + "|" + mechanikStempel(seg);
  const alt = lueckenMerk.get(seg);
  if(alt && alt.stempel === stempel) return alt.l;
  const ps = perSecond(seg, 0);
  const mech = mechanikSekunden(seg, ps.T);
  const l = {...luecken(ps.total, unverwundbareSekunden(seg, ps.T).map((x, i) => x || mech[i]!)), T: ps.T, sek: ps.total};
  lueckenMerk.set(seg, {stempel, l});
  return l;
}

/* ---------- die Befundliste im Kampfstreifen ----------
   Seit #218 (Ruling 9) stehen die zeitgebundenen Befunde vollstaendig in
   #weitereListe unter dem Streifen, Markup wie vorher unter "Weitere
   Befunde": Begriff, Wert, sichtbar der erklaerende Satz (Pruefung 29.09.:
   im title erreichten ihn weder Tastatur noch Vorleser), dazu der Weg in die
   Rotation. Wer eine Zeit hat, traegt sie in data-von/data-bis (Sekunden):
   daraus macht der Streifen seine Fahnen (70). Die laengste Luecke (nur mit
   Luecken; die Zahl steht in der Kennzeile), die staerksten 5 s, die
   schwaechste Stelle, der Start und Einsaetze ins unverwundbare Ziel. Der
   groesste Treffer und die Fehlschlaege stehen im Fach ihrer Faehigkeit
   (69); je Minute und die Skillung stehen in der Kennzeile. Unter der
   Schwelle nur die Zaehlungen. */
function renderWeitere(seg: Fight, gefunden: Insight[], teuer: string, lk: LueckenStand | null, best: BestGeist | null){
  const liste = $("#weitereListe");
  if(!liste) return;
  const hol = (k: string) => gefunden.find(x => x.key === k);
  // data-k benennt den Eintrag; zaehlt traegt er, wenn das Urteil oben ihn nennt (der Schluessel des Kandidaten)
  const eintrag = (k: string, dt: string, v: string, n = "", kandidat = k, weg = "", zeit: [number, number] | null = null) =>
    '<div class="find'+(teuer && teuer === kandidat ? " zaehlt" : "")+'" data-k="'+k+'"'+(zeit ? ' data-von="'+zeit[0]+'" data-bis="'+zeit[1]+'"' : "")+">"+
    '<dt class="k">'+esc(dt)+'</dt><dd class="v">'+esc(v)+"</dd>"+(n ? '<dd class="n">'+esc(n)+"</dd>" : "")+weg+"</div>";
  let h = "";
  const zaehl = hol("thinCounts");
  if(zaehl){
    liste.innerHTML = eintrag("gezaehlt", t("insight.thinCounts.label"), t("insight.thinCounts.value", zaehl.vars), t("insight.thinCounts.note", zaehl.vars));
    return;
  }
  /* Je Luecke ein Eintrag und damit eine Fahne (Spezifikation 5.1): zuerst
     die laengste mit dem Weg in die Rotation (Issue #107), dann die uebrigen
     in der Folge der Zeit. Zahl und Summe stehen nur in der Kennzeile. */
  const strecke = (g: [number, number]) => clock(g[0])+"\u2013"+clock(g[1])+" \u00b7 "+(g[1]-g[0])+"\u00a0s";
  if(lk && lk.laengste){
    const l = lk.laengste;
    h += eintrag("luecken", t("analysis.wb.laengsteLuecke"), strecke(l), "", "luecken", inRotationKnopf(l[0], l[1], "analysis.inRotation.luecke"), l);
    for(const g of lk.luecken) if(g !== l) h += eintrag("luecke", t("analysis.wb.luecke"), strecke(g), "", "", inRotationKnopf(g[0], g[1], "analysis.inRotation.lueckeEine"), g);
  }
  // die staerksten 5 s (Spezifikation 5.1): ihr Anteil am Schaden und wer ihn trug
  const st = lk ? staerksteStrecke(lk.sek) : null;
  if(lk && st && st.summe > 0){
    const ges = lk.sek.reduce((a, b) => a + b, 0), je = new Map<string, number>(), sidOf = new Map<string, string>();
    const a = seg.start + st.von*1000, b = seg.start + st.bis*1000;
    for(const e of seg.events) if(e.t >= a && e.t < b){ je.set(e.skill, (je.get(e.skill) || 0) + e.dmg); if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid); }
    const darin = [...je].sort((x, y) => y[1] - x[1])[0];
    const anteil = pct(ges ? st.summe/ges : 0);
    // der Wert ist die Strecke, der Anteil steht einmal, im Satz
    h += eintrag("strecke", t("analysis.wb.strecke"), clock(st.von)+"\u2013"+clock(st.bis), darin ? t("analysis.wb.streckeSatz", {von: clock(st.von), bis: clock(st.bis), anteil,
      darin: skillLabel(darin[0], sidOf.get(darin[0]))}) : "", "", "", [st.von, st.bis]);
  }
  /* Die erkannte Mechanik steht nicht hier, sondern einmal als Zeile im
     Streifen, neben ihrem Band (Issue #106, Entscheidung vom 04.10.2026).
     Der groesste Treffer und die Fehlschlaege stehen im Fach ihrer
     Faehigkeit (Werkbank, 69). */
  /* Nur eine wirklich schwache Stelle (Issue #105): dieselbe Grenze wie im
     Urteil, unter dem halben Median. Sonst stand hier "Pruefe ..." bei einer
     Stelle auf dem Median. */
  const schwach = hol("weakestWindow"), stelle = schwach && lk ? schwaechstesFenster(seg) : null;
  if(schwach && stelle && lk && schwacheStelle(stelle.dps, lk.median)){
    const v = {...schwach.vars, drove: schwach.vars.drove ? skillLabel(schwach.vars.drove, schwach.vars.droveSid) : ""};
    h += eintrag("schwach", t("insight.weakestWindow.label"), t("insight.weakestWindow.value", v), t("insight.weakestWindow.note", v), "weakestWindow",
      inRotationKnopf(stelle.von, stelle.bis, "analysis.inRotation.schwach"), [stelle.von, stelle.bis]);
  }
  if(!state.noTime) h += startZeile(seg);
  /* Abstand waechst (Spezifikation 5.1): nur mit bestem Pull - das 15-s-Fenster,
     in dem der Rueckstand am staerksten wuchs, ab 10 % des ganzen Abstands */
  const ab = lk && best ? abstandWaechst(lk.sek, best.sek) : null;
  if(ab) h += eintrag("abstand", t("analysis.wb.abstand"), clock(ab.von)+"\u2013"+clock(ab.bis),
    t(best && best.zweit ? "analysis.wb.abstandSatzZweit" : "analysis.wb.abstandSatz", {von: clock(ab.von), bis: clock(ab.bis), fehlt: fmt(ab.fehlt), anteil: pct(ab.fehlt/ab.ende)}), "",
    inRotationKnopf(ab.von, ab.bis, best && best.zweit ? "analysis.inRotation.abstandZweit" : "analysis.inRotation.abstand"), [ab.von, ab.bis]);
  const unv = hol("invulnCasts");
  if(unv){
    const v = {...unv.vars, teile: (unv.vars.teile as { skill: string; sid: string; n: number }[])
      .map(x => ({...x, skill: skillLabel(x.skill, x.sid)}))};
    h += eintrag("unverwundbar", t("insight.invulnCasts.label"), t("insight.invulnCasts.value", v), t("insight.invulnCasts.note", v), "unverwundbar", "",
      state.noTime ? null : [Number(unv.vars.vonS), Number(unv.vars.bisS)]);
  }
  liste.innerHTML = h;
}

/* Der Satz der Kennzeile, wenn kein Geist gezeichnet wird - oder "", dann
   entfaellt der Eintrag. "Gibt es einen Bezug?" ist eine andere Frage als
   "darf der Geist jetzt stehen?" (bestCasts): unter Live beim neuesten
   Kampf, unter der Schwelle oder mit einem Bezug ohne Lauf gibt es einen
   besten Pull, nur keinen Geist - dann kein Satz. In der Gruppentafel, ohne
   Uhr, im Beispiel, mit mehreren Angreifern, an einer zu kurzen Puppe oder
   an keinem Boss gibt es keinen besten Pull (bestInfo nennt den Grund) -
   auch dann kein Satz. Nur wenn der Kampf allein steht: der erste Pull am
   Boss, oder die anderen Pulls dort nur mit anderen Waffen (Ruling 10). */
function ohneGeist(seg: Fight): string {
  if(state.group === "party") return "";
  const alle = bestInfo();
  if(!alle.refId && alle.grund !== "first") return "";
  if(bauBezug(bezugVon(seg), alle).refId) return "";
  return t(alle.refId ? "analysis.wb.keinBest" : "analysis.wb.ersterPull", {boss: seg.stats.name});
}

/* ---------- die Kennzeile im Kopf (#218, Spezifikation 2.1) ----------
   Rechts neben dem Urteil: Schaden je Sekunde, Meister Schaden (Anteil und
   Name der Faehigkeit, im Spielnamen), gegen den besten Pull (bestCasts,
   ohne Bezug der Satz ohne Zahl), Einsaetze je Minute mit dem Weg zur Folge
   (vorher "Hast du durchgedrueckt?"), die Art der Skillung und die Luecken
   ab 2 s (vorher unter "Weitere Befunde"). Dasselbe Markup wie die
   Befundliste (.find mit .k/.v/.n). Unter der Schwelle nur die ersten drei. */
function kennzeile(seg: Fight, gefunden: Insight[], lk: LueckenStand | null, best: BestGeist | null): string {
  const s = seg.stats, duenn = s.hits < LIEST_AB_TREFFER;
  const hol = (k: string) => gefunden.find(x => x.key === k);
  // n ist hier schon HTML (der Knopf zur Folge)
  const e = (k: string, dt: string, v: string, n = "", nKlasse = "") => '<div class="find" data-k="'+k+'"><dt class="k">'+esc(dt)+
    '</dt><dd class="v">'+esc(v)+"</dd>"+(n ? '<dd class="n'+nKlasse+'">'+n+"</dd>" : "")+"</div>";
  let h = "";
  if(!state.noTime && s.dps > 0) h += e("dps", t("analysis.wb.dps"), fmt(s.dps));
  /* Meister Schaden: das Hauptfach der Werkbank (faecherOrdnen ueber die
     Arten aus 69) - nie eine passive oder eine Laufzeit-Faehigkeit
     (Spezifikation 3.1) */
  const ord = faecherVonKampf(seg), m = ord.haupt ? ord.liste.get(ord.haupt) : undefined;
  if(m && s.total > 0) h += e("meister", t("analysis.wb.meister"), pct(m.dmg/s.total),
    esc(m.k === VENTIUS_NAME ? skillLabel(VENTIUS_NAME, VENTIUS_ID) : skillLabel(m.k, m.sid)), " wbspiel");
  /* Gegen den besten Pull (Etappe 2): Vorzeichen immer, eine Stelle, echtes
     Minus; darunter sein Wert und Tag. Ohne Geist steht nur, was stimmt
     (ohneGeist). */
  if(best){
    // erst runden, dann das Vorzeichen: "-0,0 %" gibt es nicht, gleich ist "0,0 %"
    const p = Math.round(1000*best.rel)/10;
    const v = (p < 0 ? "\u2212" : p > 0 ? "+" : "") + pctOf(Math.abs(p), 1);
    const n = best.tag ? t(best.zweit ? "analysis.wb.zweitAm" : "analysis.wb.bestAm", {wert: fmt(best.wert), tag: best.tag})
      : t(best.zweit ? "analysis.wb.zweitHier" : "analysis.wb.bestHier", {wert: fmt(best.wert)});
    h += e("gegenBest", t("analysis.wb.gegenBest"), v, esc(n));
  } else {
    const satz = ohneGeist(seg);
    if(satz) h += e("gegenBest", t("analysis.wb.gegenBest"), "\u2013", esc(satz));
  }
  if(!duenn && lk){
    // dieselben Einsaetze wie die Zeitleiste der Rotation; "ohne die Luecken / mit ihnen" nur mit Luecken (Issue #106)
    const n = gedrueckteEinsaetze(seg), r = jeMinute(n, s.seconds, lk.summe);
    const leise = r.mit == null ? "" : lk.summe > 0
      ? t("analysis.d3.leise", {ohne: r.ohne != null ? num1(r.ohne) : "\u2013", mit: num1(r.mit)}) : t("analysis.d3.leiseOhne", {mit: num1(r.mit)});
    // darunter, wie vorher unter "Hast du durchgedrueckt?", die Zahl der Einsaetze; der leise Satz bleibt ein eigenes Element
    h += e("jeMinute", t("analysis.wb.jeMinute"), r.mit != null ? num1(r.mit) : "\u2013",
      esc(t("analysis.d3.ant", {n: anzahl(n), dauer: dur(s.seconds)}))+'</dd><dd class="n fein">'+
      (leise ? esc(leise)+" " : "")+'<button type="button" class="inrot" data-weg="folge">'+esc(t("analysis.folgeRotation"))+"</button>", " wbein");
  }
  const art = hol("consistency");
  if(art) h += e("skillung", t("insight.consistency.label"), t("insight.consistency.value", art.vars), esc(t("insight.consistency.note", art.vars)));
  if(!duenn && lk) h += e("luecken", t("analysis.wb.luecken"), lk.luecken.length ? String(lk.luecken.length) : t("analysis.wb.keine"),
    lk.luecken.length ? esc(t("analysis.wb.lueckenSumme", {s: lk.summe + "\u00a0s"})) : "");
  return '<dl class="wbkenn" id="wbKenn">'+h+"</dl>";
}

/* ---------- wie du triffst, im Kopf des Streifens (#wbWie) ----------
   Vorher das Feld "Wie triffst du?": jetzt die Glut-Rampe der vier Stufen
   (normal, stark, kritisch, kritisch stark - dieselben Farben wie die
   Striche der Werkbank, Breite nach ihrem Anteil an den Treffern) und
   derselbe Satz, darunter leise Krit-Anteil am Schaden, starke Treffer und
   Schild (DECISION 4.14). Jede Zahl einmal im Bereich (Issue #106). Unter
   der Schwelle nichts. */
/* Der Satz "wie triffst du" (#269): die Raten der DIREKTEN Treffer, ohne
   Laufzeit und Passiv (direkteRaten im Kern; die Arten kommen aus der
   Werkbank), und in einer leisen Zeile, woraus sie gerechnet sind. Ohne
   direkte Treffer bleibt der alte Satz ueber alle. Die Anteile am Schaden
   (analysis.critSum) bleiben, wie sie waren. */
function ratenSatz(seg: Fight): { ant: string; basis: string } {
  const s = seg.stats;
  const r = direkteRaten([...faecherVonKampf(seg).liste.values()]);
  if(r.stark == null) return {ant: t("analysis.d2.ant", {c: pct(s.hits ? s.crit/s.hits : 0), h: pct(s.hits ? s.heavy/s.hits : 0)}), basis: ""};
  const ant = r.krit == null ? t("analysis.d2.antStark", {h: pct(r.stark)}) : t("analysis.d2.antDirekt", {c: pct(r.krit), h: pct(r.stark)});
  // sind alle Treffer direkt, ist nichts herausgerechnet: dann steht kein "149 von 149"
  const ges = s.hits || r.gesamt;
  const teile = [r.direkt !== ges ? t("analysis.d2.basis", {n: anzahl(r.direkt), ges: anzahl(ges)}) : "", r.nie ? t("analysis.d2.nie", {nie: r.nie}) : ""];
  return {ant, basis: teile.filter(Boolean).join(" ")};
}
function wieHtml(seg: Fight, gefunden: Insight[]): string {
  const s = seg.stats;
  if(s.hits < LIEST_AB_TREFFER) return "";
  const raten = ratenSatz(seg);
  const hol = (k: string) => gefunden.find(x => x.key === k);
  const zahl = new Map<string, number>();
  for(const e of seg.events){ const k = catOf(e); zahl.set(k, (zahl.get(k) || 0) + 1); }
  const N = seg.events.length || 1, an = (k: string) => (zahl.get(k) || 0)/N;
  // die Trefferarten in der Folge des alten Balkens, je in der Farbe ihrer Hitzestufe; Schild nur, wo es ihn gab
  const STUFE: Record<string, string> = {normal: "h0", heavy: "h1", crit: "h2", critheavy: "h3", shield: "hs"};
  const arten = HIT_CATS.filter(k => zahl.get(k));
  const rampe = t("analysis.wb.rampe", {normal: pct(an("normal")), stark: pct(an("heavy")), krit: pct(an("crit")), kritStark: pct(an("critheavy"))});
  // die Anteile stehen sichtbar in der Legende darunter, die Rampe selbst ist Bild
  let h = '<span class="wbrampe" aria-hidden="true" title="'+esc(rampe)+'">'+
    arten.map(k => '<i data-art="'+k+'" class="'+STUFE[k]+'" style="width:'+(100*an(k)).toFixed(2)+'%"></i>').join("")+"</span>"+
    '<span class="lg">'+arten.map(k => '<span><i class="'+STUFE[k]+'"></i>'+esc(t("analysis.art."+k)+" "+pct(an(k)))+"</span>").join("")+"</span>"+
    '<span class="ant">'+esc(raten.ant)+"</span>";
  const krit = hol("critContribution"), stark = hol("heavyHits"), schild = hol("shield");
  const leise: string[] = [];
  if(raten.basis) leise.push(raten.basis);
  if(krit && s.crit > 0) leise.push(t("analysis.critSum", {pct: pctOf(Number(krit.vars.share), 0)}));
  if(stark) leise.push(t("insight.heavyHits.note", stark.vars));
  if(schild) leise.push(t("insight.shield.label") + ": " + t("insight.shield.value", schild.vars) + ". " + t("insight.shield.note", {...schild.vars,
    skill: schild.vars.skill ? skillLabel(schild.vars.skill, schild.vars.sid) : ""}));
  if(leise.length) h += ' <span class="fein">'+esc(leise.join(" "))+"</span>";
  return h;
}

/* ---------- Wege vom Urteil zum Beleg und in die Rotation (Issue #107) ----------
   Die Analyse war eine reine Leseflaeche: kein fokussierbares Element, und
   "steht unter Rotation" war Text, kein Weg. Jetzt:
   - "Zum Beleg" unter dem Urteil rollt zum Feld, das es belegt, und setzt
     den Fokus darauf;
   - "In der Rotation zeigen" an der laengsten Luecke, der schwaechsten
     Stelle und dem schwachen Start setzt Von/bis der Rotation auf die
     Strecke (2 s Rand) und oeffnet sie, der Fokus geht auf die Zeitleiste;
   - ist dort ein Von/bis gesetzt, sagt die Analyse, dass sie trotzdem den
     ganzen Kampf liest.
   Die Klicks laufen ueber einen Hoerer am Panel (data-weg), denn der Inhalt
   wird bei jedem Zeichnen neu geschrieben. Den Knopf in die Rotation baut
   inRotationKnopf (53-fenster.ts), der Start-Eintrag dort braucht ihn auch. */
const RAND_S = 2;
/* Wohin "Zum Beleg" fuehrt: das Feld, aus dem der teuerste Kandidat kommt.
   Hat der Befund eine Fahne im Streifen (#218), wird sie dabei gedrueckt:
   die Strecke leuchtet, ihr Satz steht in der Lesezeile. */
const BELEG_FAHNE: Record<string, string> = {luecken: "luecken", weakestWindow: "schwach"};
const BELEG: Record<string, string> = {
  luecken: "#verdict",
  weakestWindow: '#weitereListe .find[data-k="schwach"]',
  missed: '#findings .find[data-k="fehl"]',
  ventiusPos: "#findings .vfeld",
  window: "#findings .fsec:has(#fensterH)",
};
function ganzerKampf(seg: Fight): string {
  if(state.rotSegStart !== seg.start || (state.rotFrom == null && state.rotTo == null)) return "";
  const T = seg.stats.seconds || 0;
  const a = Math.max(0, state.rotFrom ?? 0), b = Math.min(T, state.rotTo ?? T);
  return '<p class="ganz">'+esc(t("analysis.ganzerKampf", {z: clock(a)+"\u2013"+clock(b)}))+"</p>";
}
function zurRotation(){
  switchTab("rotation");
  // wie "Zeitverlauf und Rotation" im Kampf (56-tafel.ts): der Fokus auf die Zeitleiste, ohne sie auf den Bereich
  const leiste = $("#deineRotScroll");
  (leiste && !leiste.closest("[hidden]") ? leiste : $('#bereiche [data-tab="rotation"]')).focus();
}
let wegeGebunden = false;
function wegeBinden(){
  const panel = $("#p-analysis");
  if(wegeGebunden || !panel) return;
  wegeGebunden = true;
  panel.addEventListener("click", (e: MouseEvent) => {
    const k = (e.target as HTMLElement).closest<HTMLElement>("[data-weg]");
    if(!k || !panel.contains(k)) return;
    const seg = state.encounters[state.sel];
    if(k.dataset.weg === "beleg"){
      const ziel = panel.querySelector<HTMLElement>(BELEG[k.dataset.ziel || ""] || "");
      if(!ziel) return;
      const fahne = BELEG_FAHNE[k.dataset.ziel || ""];
      if(fahne) fahneWaehlen(fahne);
      if(ziel.tabIndex < 0) ziel.tabIndex = -1;
      const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
      ziel.scrollIntoView({block: "center", behavior: ruhig ? "auto" : "smooth"});
      ziel.focus({preventScroll: true});
      return;
    }
    if(!seg) return;
    if(k.dataset.weg === "rot"){
      const {T} = rotWindow(seg);   // setzt Von/bis zurueck, wenn sie zu einem anderen Kampf gehoerten
      state.rotFrom = Math.max(0, Number(k.dataset.von) - RAND_S);
      state.rotTo = Math.min(T, Number(k.dataset.bis) + RAND_S);
    }
    zurRotation();
  });
}

/* ---------- das eine Urteil oben ----------
   Die Befunde darunter stehen gleichrangig, jeder beantwortet seine Frage.
   Welcher davon am meisten gekostet hat, sagte keiner - und alle Antworten
   gluehten gleich. Hier wird jeder Befund, der einen vermeidbaren Verlust
   beschreibt, in dieselbe Einheit gerechnet (Schaden), und der groesste
   steht oben. Gold traegt danach nur noch dieses Urteil und der Befund,
   den es nennt; alles andere steht in Textfarbe.

   Die Rangfolge ist die Groesse des geschaetzten Verlusts, nichts sonst.
   Geschaetzt wird jeweils vorsichtig, mit dem kleineren Wert, wo es zwei
   gibt:
   - Leerzeit (Neugestaltung 28.09., Luecken 4.3): die Sekunden der Luecken
     nach dem Median mal dem Median der Sekunden mit Treffern - der
     gewoehnlichen Sekunde, gegen die eine Luecke gemessen ist (luecken,
     ../analyse-core.ts). Vorher: Sekunden ohne Treffer mal Schnitt.
   - Schwaechste Stelle: drei Sekunden gegen drei GEWOEHNLICHE Sekunden
     dieses Kampfes (das mittlere gueltige Fenster), nicht gegen den
     Schnitt. Ein Burst-Build liegt fast ueberall unter seinem Schnitt;
     gegen ihn gemessen waere jede ruhige Stelle ein Verlust.
   - Fehlschlaege: jeder mit dem Schnitt eines Treffers derselben
     Faehigkeit bewertet - die Faehigkeit, die daneben ging, nicht der
     Kampf.
   - Ventius-Position: die fehlenden Treffer mit dem kleineren der beiden
     Trefferwerte des Kastens (die untere Grenze von "etwa ... bis ...").
   - Fenster nach einem Skill (Issue #45): der Schaden des Hauptschadens
     ausserhalb mal (Staerke im Fenster / Staerke ausserhalb - 1), mit den
     Staerken DIESES Kampfes, wenn beide Seiten genug Treffer haben, sonst
     mit denen des Builds; nie negativ. Nur ab 20 % ausserhalb - darunter
     haengt der Anteil kaum mit der DPS zusammen. Vorsicht wie bei der
     Position: der Abstand der Staerken ist gemessen, aber nicht allein dem
     Fenster zuzuschreiben, und das Fenster ist zeitlich gelesen, nicht je
     Ziel.
   Nicht dabei: Treffer auf Unverwundbare - das ist Mechanik, kein
   Verlust (Issue #37); sie haben ihr Band im Zeitverlauf und hoechstens
   einen leisen Befund. Auch nicht: Schild (wird nicht abgezogen), Krits, starke Treffer,
   groesster Treffer, Konzentration, Skillungsart - das sind Eigenschaften
   eines Kampfes, keine Verluste.

   Unter 2 % des Schadens ist nichts nennenswert: dann sagt der Satz das,
   statt ein Problem zu erfinden. Gleichstand entscheidet die Reihenfolge
   der Liste unten (Leerzeit vor Position vor Fenster vor Stelle vor
   Fehlschlag). */
const URTEIL_AB = 0.02;
/* Was ohne Uhr uebrig bleibt. Die Schwankung und das schwaechste Fenster
   kommen aus Sekunden; wie konzentriert der Schaden faellt und was die
   Krits beigetragen haben, braucht keine.
   "missed" ist eine Zaehlung von Zeilen, keine Rate ueber Zeit - das haelt
   auf einem Log ohne Uhr genauso wie die Schildzahl. */
const CLOCKLESS = ["concentration","critContribution","shield","ventiusPos","missed",
                   "heavyHits"];
/** Das Urteil als HTML mit seiner Klasse, dazu die Befunde, aus denen es
    kommt. renderAnalysis schreibt es nach #analysisCall, die Kampf-Tafel
    (56-tafel.ts) ohne besten Pull in ihr Urteilsfeld - ein Weg, eine Zahl. */
export function urteilHtml(seg: Fight, mitForm = false): { html: string; klasse: string; teuer: string;
                                          gefunden: Insight[]; fenster: FensterStand | null } {
  /* Unter der Schwelle des Kopfes nur die Zaehlungen - dieselbe Grenze,
     an der der Kopf "zu wenig" sagt. */
  const gefunden = seg.stats.hits < LIEST_AB_TREFFER ? [zaehlung(seg)]
    : insights(seg).filter(f => !state.noTime || CLOCKLESS.includes(f.key));
  /* Das Fenster nach einem Skill (Issue #45): gesucht ueber die Pulls
     desselben Builds, nur, wo es eines gibt - sonst entfaellt die Frage ganz. */
  const fenster = seg.stats.hits < LIEST_AB_TREFFER ? null : fensterStand(seg);
  return {...urteilRechnen(seg, gefunden, fenster, mitForm), gefunden, fenster};
}

/* mitForm: nur die Analyse selbst - dort steht die Form mit der Linie des
   Medians darunter, und die Erklaerung der Leerzeit verweist auf sie
   (Entwurf, Pruefung Befund 9). Die Tafel im Kampf hat keine Saeulen. */
function urteilRechnen(seg: Fight, gefunden: Insight[], fenster: FensterStand | null, mitForm = false): { html: string; klasse: string; teuer: string }{
  const s = seg.stats, gesamt = s.total || 0;
  /* Zu duenn: kein Urteil, nur die Schwelle - ruhig, in Textfarbe. */
  if(s.hits < LIEST_AB_TREFFER)
    return {klasse: "urteil ruhig", teuer: "",
            html: '<p class="uv">'+esc(t("analysis.call.thin", {n: anzahl(s.hits), min: LIEST_AB_TREFFER}))+"</p>"};
  const hat = (k: string) => gefunden.some(f => f.key === k);
  // note: ein eigener Erklaersatz statt "analysis.call.<art>.note" (das Fenster gegen den Bezug)
  const kandidaten: { key: string; art: string; verlust: number; note?: string; vars: Record<string, unknown> }[] = [];
  /* Die Form des Entwurfs (DECISION 4.2): "18 Sekunden ohne Treffer",
     gemessen an der gewoehnlichen Sekunde, mit der laengsten Luecke. */
  const lk = lueckenStand(seg);
  if(lk && lk.summe > 0 && lk.laengste)
    kandidaten.push({key:"luecken", art:"leer", verlust: lk.summe*lk.median, vars:{n: lk.summe, med: fmt(lk.median, 1e3),
      zeit: pct(lk.summe/(s.seconds || lk.T), 0), von: clock(lk.laengste[0]), bis: clock(lk.laengste[1])}});
  if(hat("ventiusPos")){
    const v = ventiusFehlend(seg);
    if(v) kandidaten.push({key:"ventiusPos", art:"ventius", verlust: v.von,
      vars:{n: v.fehlen, skill: skillLabel(VENTIUS_NAME, VENTIUS_ID)}});
  }
  /* Gegen den Bezugspull, wo er das Fenster kennt (Issue #108): dann zaehlt
     nur der Anteil ausserhalb, der ueber seinem liegt, und der Satz nennt
     ihn. Ohne Bezug gegen alles im Fenster, und der Satz sagt das. */
  const bezugAussen = fenster && fenster.bezug ? fenster.bezug.aussen : null;
  if(fenster && fensterUrteil(fenster.werte, gesamt, URTEIL_AB, bezugAussen)){
    const w = fenster.werte;
    kandidaten.push({key:"window", art:"window", verlust: fensterKosten(w, bezugAussen), note: bezugAussen == null ? "" : "noteRef",
      vars:{h: fenster.hName, f: fenster.fName, p: pct(w.aussen), out: fmt(w.kAus), in: fmt(w.kIn),
        q: bezugAussen == null ? "" : pct(bezugAussen), zweit: fenster.zweit}});
  }
  /* Die schwaechste Stelle misst mit demselben Massstab wie die Leerzeit:
     jede ihrer Sekunden gegen den Median der Sekunden mit Treffern, so
     erklaert ein Satz beide (Entscheidung vom 29.09. (an Claude
     uebertragen)). Vorher gegen das mittlere Dreisekundenfenster (typ), das
     bei einem Burst-Build ein Vielfaches davon ist - dann verlor die
     Leerzeit fast immer gegen die Stelle direkt daneben. */
  if(hat("weakestWindow") && lk && lk.median > 0){
    const w = schwaechstesFenster(seg);
    // dieselbe Grenze wie der Eintrag unter "Weitere Befunde" (Issue #105)
    if(w && schwacheStelle(w.dps, lk.median)) kandidaten.push({key:"weakestWindow", art:"weak",
      verlust: (lk.median - w.dps)*(w.bis - w.von),
      vars:{from: clock(w.von), to: clock(w.bis), med: fmt(lk.median, 1e3)}});
  }
  if(hat("missed") && seg.missSkills){
    const namen = [...seg.missSkills.keys()];
    let dmg = 0, zeilen = 0;
    for(const e of seg.events) if(namen.includes(e.skill)){ dmg += e.dmg; zeilen++; }
    const eins = namen.length === 1;
    if(zeilen) kandidaten.push({key:"missed", art:"missed", verlust: (seg.missed || 0)*dmg/zeilen,
      vars:{n: seg.missed, eins, skill: eins ? skillLabel(namen[0]!, seg.missSkills.get(namen[0]!)!.sid) : namen.join(" \u00b7 ")}});
  }

  // stabil sortiert: bei Gleichstand bleibt die Reihenfolge von oben
  const erst = kandidaten.sort((a,b) => b.verlust - a.verlust)[0];
  if(!erst || !gesamt || erst.verlust < URTEIL_AB*gesamt){
    /* Ohne Behauptung ueber "die Befunde unten": oft gibt es gar keinen,
       der einen Verlust beschreibt (keine Leerzeit, keine Fehlschlaege),
       und dann waere "keiner ist mehr wert als 2 %" eine Aussage ueber
       nichts. */
    return {klasse: "urteil ruhig", teuer: "", html: '<p class="uv">'+esc(t("analysis.call.nothing"))+"</p>"};
  }
  const vars = Object.assign({dmg: fmt(erst.verlust), pct: pct(erst.verlust/gesamt, 0)}, erst.vars);
  /* "Das kostet dich am meisten:" eroeffnet die Erklaerung wie im Entwurf -
     keine eigene kleine Zeile ueber der Schlagzeile (Pruefung Befund 3). */
  const note = t("analysis.call."+erst.art+"."+(erst.note || (mitForm && erst.art === "leer" ? "noteForm" : "note")), vars);
  return {klasse: "urteil", teuer: erst.key,
    html: '<p class="uv">'+esc(t("analysis.call."+erst.art+".value", vars))+"</p>"+
      '<p class="un">'+esc(t("analysis.call.label")+" "+note)+"</p>"};
}

/* ---------- der Kampf (Streifen) ----------
   Seit #218 zeichnet 70-kampfstreifen.ts das Bild (Glutkurve statt Saeulen,
   dieselben Luecken, Baender und Beschreibung) und die Fahnen. Hier die
   Saetze darunter: die Definition der Luecke (so gewuenscht: Luecken zaehlen
   nach dem Median, und ihre Definition steht dabei), die Zeile zur
   Mechanik und der Satz ueber die Haelften. Ohne Uhr steht nur der Kopf
   des Streifens mit #wbWie und die Liste. */
function renderVerdict(seg: Fight, lk: LueckenStand | null, best: BestGeist | null){
  const s = seg.stats;
  mechanikZeile(seg);
  renderStreifen(seg, lk, best ? {sek: best.sek, wann: best.wann, zweit: best.zweit} : null);
  if(!lk) return;

  /* Die Haelften ohne die Sekunden, in denen das Ziel unverwundbar war
     (Issue #37): eine Phase, in der nichts landen kann, machte sonst die
     Haelfte, in der sie liegt, zur schwachen. Ebenso die Sekunden einer
     erkannten Mechanik (Pruefung 01.10., M1): sonst wertete der Vergleich
     genau die Strecke, die die Zeile darueber ausnimmt. */
  const mech = mechanikSekunden(seg, lk.T);
  const aus = unverwundbareSekunden(seg, lk.T).map((x, i) => x || mech[i]!);
  const sek: number[] = [];
  for(let i=0;i<lk.T;i++) if(!aus[i]) sek.push(lk.sek[i]!);
  const teile = [];
  /* Unter der Schwelle kein Haelftenvergleich; darueber nur, wenn eine
     Haelfte deutlich staerker war (haelften, ab dem 1,15-fachen, Issue #106).
     Der Krit-Anteil steht nur in #wbWie, der Start nur in der Befundliste -
     jede Zahl einmal (Issue #106). */
  const h = s.hits < LIEST_AB_TREFFER ? null : haelften(sek);
  if(h) teile.push(t(h.staerker === "zweite" ? "analysis.halfUp" : "analysis.halfDown", {
    strong: axisNum(Math.max(h.erste, h.zweite)), x: num1(h.x)
  }));
  const text = $("#verdictText");
  text.textContent = teile.join(" ");
  text.hidden = !teile.length;
  $("#lueckeDef").textContent = t("analysis.lueckeDef");
}

/* ---------- die Zeile zur Mechanik ----------
   Spezifikation Mechanik 3: eine kleine, neutrale Zeile unter der
   Definition der Luecke - was der Boss in deinen geladenen Pulls wiederholt
   tut, und, wenn die Strecke in diesem Pull liegt, dass sie nicht als
   Luecke zaehlt. Unter fuenf Pulls oder ohne Fund steht nichts. */
function mechanikZeile(seg: Fight){
  const p = $("#mechanikZeile"); if(!p) return;
  const st = mechanikStand(seg);
  /* Der Fuss "Was das Log nicht weiss" bekommt seinen Zusatz nur, wenn in
     diesem Kampf Mechanik erkannt wurde (Feinschliff 02.10., Abschnitt 3). */
  const fuss = $("#fussMech");
  if(fuss){
    const mit = !!st && st.liste.some(x => x.strecken.length);
    fuss.textContent = mit ? t("analysis.fuss.mech") : "";
    fuss.hidden = !mit;
  }
  if(!st){ p.hidden = true; p.textContent = ""; return; }
  const teile: string[] = [];
  for(const {m, strecken} of st.liste){
    // die Dauer als Spanne (Pruefung 01.10., N1): sie streut, an Vulcanus 5 bis 25 s
    const dv = Math.round(m.dauerVon), db = Math.round(m.dauerBis);
    const s = (dv === db ? String(db) : dv+"\u2013"+db)+"\u00a0s";
    teile.push(t("mechanik.zeile", {boss: st.boss, ab: clock(Math.round(m.beginn)), s, mit: m.mit, n: m.pulls}));
    if(strecken.length) teile.push(t("mechanik.nichtGezaehlt", {zeiten: strecken.map(g => clock(g.von)+"\u2013"+clock(g.bis)).join(", ")})+".");
  }
  p.textContent = teile.join(" ");
  p.hidden = false;
}

/* ---------- was die schwaecheren Salven gekostet haben ----------
   Zwei Zahlen mit sehr verschiedenem Gewicht, und sie bleiben getrennt.

   Die fehlenden Treffer sind exakt: eine Salve mit n Nachbeben landet 3n+1
   Treffer, und wie viele Nachbeben sie hatte, liest ventiusWaves ohnehin an
   ihrer Form ab. Da wird nichts geschaetzt.

   Der Schaden ist gemessen, aber NICHT allein der Position zuzuschreiben.
   Auf dem Referenzkampf brachten die 60 besten Salven 100,4k je Treffer und
   die 12 schwaecheren 74,9k - waere nur die Position schuld, muesste ein
   einzelner Treffer gleich gross sein. Darum nennt der Text als Preis der
   Position nur die fehlenden Treffer, bewertet mit beiden Trefferwerten, und
   sagt dazu, dass der Abstand der Mittelwerte groesser ist. */
/* Die Rechnung allein, ohne Tafel: das Urteil oben braucht dieselbe Zahl
   wie der Kasten hier, und zwei Rechnungen liefen irgendwann auseinander. */
export function ventiusFehlend(seg: Fight){
  const m = ventiusMix(seg);
  if(!m.top || m.shaped < 3) return null;
  const gut = m.rows.find(r => r.waves === m.top);
  /* Absteigend: die Zeilen sollen eine Leiter sein - 5, 4, 3, 2 - und
     nicht 5, 2, 3, 4. */
  const unten = m.rows.filter(r => r.waves < m.top).sort((a,b) => b.waves - a.waves);
  if(!gut || !unten.length) return null;
  const besteTreffer = m.top*3 + 1;
  const fehlen = unten.reduce((x,r) => x + r.n*(besteTreffer - r.hits), 0);
  if(!fehlen) return null;
  let uSumme = 0, uTreffer = 0, uN = 0;
  for(const r of unten){ uSumme += r.dmg; uTreffer += r.trefferIst; uN += r.n; }
  const jeGut = gut.trefferIst ? gut.dmg/gut.trefferIst : 0;
  const jeUnten = uTreffer ? uSumme/uTreffer : 0;
  const von = fehlen*Math.min(jeGut, jeUnten), bis = fehlen*Math.max(jeGut, jeUnten);
  return {m, gut, unten, besteTreffer, fehlen, uSumme, uTreffer, uN, jeGut, jeUnten, von, bis};
}
/* Was die Position erklaert: die fehlenden Treffer, mit beiden Trefferwerten
   bewertet, und wie weit die Mittelwerte auseinanderliegen - der Satz unter
   den drei Zahlen, auf den sich das Urteil beruft ("die beiden Trefferwerte"). */
export function ventiusVerlust(seg: Fight){
  const r0 = ventiusFehlend(seg);
  if(!r0) return "";
  const {gut, fehlen, uSumme, uN, jeGut, jeUnten, von, bis} = r0;
  const mittelAbstand = gut.n ? (gut.dmg/gut.n)*uN - uSumme : 0;
  return '<p class="kvorbehalt">'+esc(t("analysis.lost.caveat", {
    low: fmt(jeUnten), high: fmt(jeGut), n: fehlen, from: fmt(von), to: fmt(bis), mean: fmt(mittelAbstand)
  }))+"</p>";
}
