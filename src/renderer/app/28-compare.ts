import { SERIES_N, seriesColor, state } from "./01-state";
import { dur, factLine, fmt, full, toastFail } from "./03-helpers";
import { histKey, stats } from "./06-blocks-and-places";
import { t, tt } from "./08-translation";
import { weaponLabel, weaponMark } from "./09-weapon-icons";
import { skillEntry } from "./10-skill-names";
import { skillMark } from "./11-skill-icons";
import { skillLabel } from "./14-questlog-weapons";
import { clip, numN, pct, pctOf, secs1, summarise } from "./16-fight-analysis";
import { $, esc, wallTime } from "./18-interface-basics";
import { letzterKampf } from "./20-meter-head";
import { entferneLauf, renderRuns } from "./30-fight-list";
import { partyEinsaetze } from "./42-party";
import { syncCompareBtn } from "./45-startup";
import { leerKnopf, leerTauschen } from "./58-felder";
import {
  antwortSchluss, bestAntwort, bestBezug, bestInfo, bestLauf, bestNamen, bestZeile, bestZeileBinden, cmpRotation, cmpRotationBinden, gegenBestAktiv, mitLauf,
  type BestInfo,
} from "./46-best-pull";
import { cutCasts, groessterAnteil, vergleichZahlen, verteilt } from "../best-pull-core";
import type { CmpCellOptions, CmpMetric, Fight, FightStats, SavedRun } from "../types";

/* ---------- compare ---------- */
/* Which way is good is a property of the metric, not the sign of the change.
   Every row in the head-to-head declares its direction — 1 where more is
   better, -1 where less is, 0 where neither is — and the winner highlight
   has always used it. The delta beside it did not: it painted every rise
   green. So a longer fight was congratulated for being longer, and more idle
   time would have been too. Where a metric declares no direction, the chip
   states the change and stays out of judging it. */
/** better: +1 when higher is better, -1 when lower is, 0 when neither. */
function deltaClass(d: number | null, better: number){
  if(!better) return "delta";
  return ((d ?? 0) > 0) === (better > 0) ? "delta good" : "delta bad";
}

/* The shortest ticked run's own length. The old target was a flat sixty
   seconds, a constant the reader had to accept, and on two 70 s runs it threw
   away ten seconds of real data for nothing. clip(run, seconds) was already
   parameterised, so this is an argument, not a computation. */
function clipTarget(runs: { seconds: number }[]){
  return Math.max(1, Math.round(Math.min.apply(null, runs.map(r => r.seconds))));
}
/* Ein Raster statt einer Tabelle. Links eine Spalte, die stehenbleibt,
   rechts die Kaempfe, die scrollen - dieselbe Form wie im Zeitverlauf und
   in der Rotation. */
function cmpGrid(kopf: string, kopfZellen: string[], zeilen: { kopf: string; zellen: string[] }[]){
  let h = '<div class="cgz kopf"><em>'+kopf+"</em></div>" + kopfZellen.join("");
  for(const z of zeilen) h += '<div class="cgz">'+z.kopf+"</div>" + z.zellen.join("");
  return '<div class="cgroll"><div class="cgrid" style="--n:'+
         kopfZellen.length+'">'+h+"</div></div>";
}
/* Eine Zelle. anteil ist der Wert gegen den besten der Zeile; null heisst
   "kein Balken" - und das heisst: diese Zeile ist nicht vergleichbar. */
function cmpZelle(inhalt: string, o: CmpCellOptions){
  o = o || {};
  return '<div class="czelle'+(o.kopf ? " kopf" : "")+(o.wenig ? " wenig" : "")+
    (o.best ? " best" : "")+(o.leer ? " leer" : "")+'"'+(o.win ? ' data-win="1"' : "")+">"+
    (o.anteil != null
      ? '<span class="cfuell" style="width:'+(Math.max(0, Math.min(1, o.anteil))*100).toFixed(1)+'%"></span>'
      : "")+
    '<span class="v">'+inhalt+"</span>"+
    (o.zu ? '<span class="zu">'+o.zu+"</span>" : "")+"</div>";
}
/* Was sich vergleichen laesst: die gespeicherten Laeufe und die Kaempfe des
   geladenen Logs. Zwei Quellen, eine Liste. */
/** One thing that can be compared: a saved run or a fight of the loaded log. */
interface CmpChoice {
  id: string; quelle: "run" | "seg" | "best"; titel: string; name: string;
  /** clock time of a fight, so two pulls of one boss can be told apart */
  zeit?: string;
  dps: number; seconds: number; total: number; noTime: boolean;
}
export function cmpAuswahl(){
  const raus: CmpChoice[] = state.runs.map(r => ({
    id: r.id, quelle: "run", titel: r.tag || r.name, name: r.name,
    dps: r.dps, seconds: r.seconds, total: r.total, noTime: r.noTime}));
  state.encounters.forEach((seg, i) => {
    const st = seg.stats || (seg.stats = stats(seg));
    if(!(st.total > 0)) return;
    raus.push({id: "seg"+i, quelle: "seg", titel: st.name, name: st.name,
      zeit: state.wall ? wallTime(seg.start) : "",
      dps: st.dps, seconds: st.seconds, total: st.total, noTime: !!state.noTime});
  });
  /* Was "Gegen deinen besten Pull" angehakt hat und sonst in keiner Liste
     steht: ein gespeicherter bester Pull oder ein Puppenkampf, auf die
     Klassenlaenge geschnitten. Nur solange er angehakt ist - abgehakt
     verschwindet er wieder, statt die Liste mit jedem Boss zu fuellen. */
  state.cmpRuns.forEach(id => {
    if(!/^best\||^seg\d+@\d+$/.test(id)) return;
    const r = cmpLauf(id);
    if(r) raus.push({id, quelle: "best", titel: r.tag || r.name, name: r.name,
      dps: r.dps, seconds: r.seconds, total: r.total, noTime: r.noTime});
  });
  return raus;
}
/* Zwei Kaempfe gegen denselben Boss heissen sonst gleich, und der Vergleich
   sagt dann "X gewinnt auf DPS, X kommt 31 % niedriger heraus". Die Uhrzeit
   trennt sie - dieselbe Angabe, an der die Kampfliste links sie auseinander
   haelt.

   Der Boss steht davor, und das ist kein Schmuck: dieser Titel ist die
   Kennung, mit der der Urteilssatz die Kaempfe benennt. Ohne den Namen
   stand dort "22:06:08 gewinnt auf DPS. 18:36:42 kommt 46 % niedriger
   heraus" - der eine Satz, der die Antwort traegt, geschrieben in der
   einzigen Angabe, die ein Mensch nicht lesen kann. */
function cmpTitel(seg: Fight, st: FightStats){
  return state.wall ? st.name + " " + wallTime(seg.start)
                    : st.name + " \u00b7 " + dur(st.seconds);
}
/* Grouped by what the id resolves to, not by the raw id. A rank-up gives
   the same skill a new id and summarise() stores whichever rank fired
   first in that fight, so comparing the sample's own two fights split
   Schnellfeuer and Klingensturm into two half-empty rows each - and then
   reported "+11,8k" and "-4.270" for one skill, as if it had been added
   and removed. autoWeapon already falls back the same way. Resolving
   first still matches an English run's "Detonation Mark" to a German
   run's "Detonierendes Mal". Das Urteil der Tafel (56-tafel.ts) fasst die
   Faehigkeiten mit derselben Regel zusammen. */
export function cmpKey(k: {name: string; sid?: string | undefined}): string {
  const e = skillEntry(k.name, k.sid);
  return (e && (e.en || e.de)) || k.sid || k.name;
}

/* Eine Farbe je Faehigkeit fuer den ganzen Vergleich (Balken zur
   Mittellinie, Spuren der Rotation nebeneinander), ueber cmpKey: zuerst die
   Farbe, die die Faehigkeit im gewaehlten Kampf des Logs hat - dieselbe wie
   in der Schadenstafel und der Zeitleiste (SkillStats.color). Was dort
   nicht vorkommt, bekommt der Reihe nach (Reihenfolge von "folge") die
   naechste Reihenfarbe, die noch frei ist; sind alle zwoelf vergeben, die
   Restfarbe, wie ab Rang dreizehn ueberall. */
export function cmpFarben(folge: {name: string; sid?: string | undefined}[]): (s: {name: string; sid?: string | undefined}) => string {
  const farben = new Map<string, string>();
  const seg = state.encounters[state.sel];
  if(seg){
    const st = seg.stats || (seg.stats = stats(seg));
    const sidOf = new Map<string, string>();
    for(const e of seg.events) if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);
    for(const k of st.skills){
      const key = cmpKey({name: k.name, sid: sidOf.get(k.name)});
      if(k.color && !farben.has(key)) farben.set(key, k.color);
    }
  }
  const belegt = new Set(farben.values());
  let naechste = 0;
  const farbe = (s: {name: string; sid?: string | undefined}) => {
    const key = cmpKey(s);
    let f = farben.get(key);
    if(f) return f;
    while(naechste < SERIES_N && belegt.has(seriesColor(naechste))) naechste++;
    f = seriesColor(naechste < SERIES_N ? naechste++ : SERIES_N);
    belegt.add(f);
    farben.set(key, f);
    return f;
  };
  folge.forEach(farbe);
  return farbe;
}

/* Eine Kennung zu einem Lauf machen. Bei einem gespeicherten Lauf steht er
   schon da; bei einem Kampf aus dem Log wird er beim ersten Anhaken gebaut
   und gemerkt. Die Kennung bleibt "segN" und nicht die laufende Nummer aus
   summarise(), sonst fiele der Haken beim naechsten Zeichnen ins Leere. */
export function cmpLauf(id: string): SavedRun | null {
  const fertig = state.runs.find(r => r.id === id);
  if(fertig) return fertig;
  // ein gespeicherter bester Pull (46-best-pull.ts); jedes Mal frisch, der
  // Name haengt an der Sprache
  if(id.startsWith("best|")) return bestLauf(id);
  if(state.cmpSeg.has(id)) return state.cmpSeg.get(id)!;
  /* "segN" ist ein Kampf des Logs, "segN@60" derselbe Kampf auf 60 s
     geschnitten - so vergleicht "Gegen deinen besten Pull" an der Puppe. */
  const m = /^seg(\d+)(?:@(\d+))?$/.exec(id);
  if(!m) return null;
  const seg = state.encounters[+m[1]!];
  if(!seg) return null;
  if(!seg.stats) seg.stats = stats(seg);
  let lauf: SavedRun = summarise(seg, cmpTitel(seg, seg.stats));
  // die Einsaetze fuer die Rotation nebeneinander, wie die Gruppe sie schickt
  lauf.casts = partyEinsaetze(seg, true);
  if(m[2]){
    const cls = +m[2];
    lauf = clip(lauf, cls);
    lauf.casts = lauf.casts && cutCasts(lauf.casts, cls * 1000);
  }
  lauf.id = id;
  state.cmpSeg.set(id, lauf);
  return lauf;
}
/* Die Auswahlliste. Keine neue Bauart: das ist .run aus der Laufliste, mit
   demselben Kaestchen, demselben Namen und derselben Zahlenzeile.
   Gegen den besten Pull ist die Wahl schon getroffen: die Liste steht dann
   zugeklappt hinter "Andere Kaempfe waehlen", ohne den Satz "Hake zwei bis
   vier an" - er fordert zu etwas auf, das schon erledigt ist. Ein echtes
   <details>, damit Tastatur und Vorleser es wie jedes andere erreichen. */
function cmpPicker(auswahl: CmpChoice[], zu: boolean){
  const zeile = (a: CmpChoice) =>
    '<div class="run" data-cid="'+esc(a.id)+'">'+
      '<input type="checkbox" aria-label="'+esc(a.zeit ? a.titel+", "+a.zeit : a.titel)+'"'+
        (state.cmpRuns.has(a.id) ? " checked" : "")+">"+
      '<div class="t"><b>'+esc(a.titel)+"</b>"+
        "<span class='num factline'>"+
        /* Wie die Zeilen der Kampfwahl: die Uhrzeit vorn in Stunden und
           Minuten, die ganze Uhrzeit im Namen des Hakens; dann die Zahlen.
           Sie steht hier, weil in der Liste zwei Zeilen denselben Bossnamen
           tragen koennen und der Name allein sie nicht trennt. */
        factLine((a.zeit ? [a.zeit.slice(0, 5)] : []).concat(
          a.noTime ? [fmt(a.total)+" "+t("head.damage")]
                   : [fmt(a.dps)+" "+t("bars.dps"), dur(a.seconds)]))+
        "</span></div>"+
      (a.quelle === "run"
        ? '<button class="x" title="'+esc(t("rail.removeRun"))+'" aria-label="'+
          esc(t("rail.removeRun"))+'">\u2715</button>'
        : "")+
    "</div>";
  const kopf = (wort: string, notiz: string) =>
    '<div class="cmpgroup"><span>'+esc(wort)+"</span><i>"+esc(notiz)+"</i></div>";
  const besten = auswahl.filter(a => a.quelle === "best");
  const laeufe = auswahl.filter(a => a.quelle === "run");
  const ausLog = auswahl.filter(a => a.quelle === "seg");
  const liste = '<div class="cmppick">'+
    (besten.length ? kopf(t("best.groupTitle"), t("best.groupNote")) +
                     besten.map(zeile).join("") : "")+
    (laeufe.length ? kopf(t("compare.groupSaved"), t("compare.groupSavedNote")) +
                     laeufe.map(zeile).join("") : "")+
    (ausLog.length ? kopf(t("compare.groupLog"), t("compare.groupLogNote", {n: ausLog.length})) +
                     ausLog.map(zeile).join("") : "")+
    "</div>";
  return zu
    ? '<details class="fold cmppickfold"><summary>'+esc(t("best.pickOther"))+"</summary>"+liste+"</details>"
    : '<p class="cmphint">'+esc(t("compare.pickHint"))+"</p>"+liste;
}
function cmpPickerBinden(box: HTMLElement){
  /* Aufgeklappt waechst die Liste ueber dem Antwortsatz, und das Verankern
     des Browsers haelt den Satz fest - die Zeile "Andere Kaempfe waehlen"
     mit dem Fokus rutschte dabei unter die klebende Leiste. Danach steht
     sie wieder direkt unter der Leiste. */
  box.querySelector<HTMLDetailsElement>("details.cmppickfold")?.addEventListener("toggle", e => {
    const d = e.currentTarget as HTMLDetailsElement, tabs = document.querySelector<HTMLElement>(".top");
    if(!d.open || !tabs) return;
    const kante = tabs.getBoundingClientRect().bottom + 8;
    const oben = d.getBoundingClientRect().top;
    if(oben < kante) window.scrollBy({top: oben - kante});
  });
  box.querySelectorAll<HTMLElement>(".cmppick .run").forEach(row => {
    const id = row.dataset.cid!;
    const kasten = row.querySelector("input")!;   // every .run row has its box
    /* Die ganze Zeile hakt an. Das Kaestchen ist 13x13 gross - das ist
       die Voreinstellung des Browsers fuer eine Ankreuzflaeche - und war
       die einzige Stelle, an der man diesen Reiter bedienen konnte. Der
       Name daneben sah aus wie ein Ziel und war keines.
       Ausgenommen: das Kaestchen selbst (sonst zweimal umgeschaltet) und
       das Kreuz zum Loeschen. */
    row.onclick = e => {
      const ziel = e.target as HTMLElement;
      if(ziel === kasten || (ziel.closest && ziel.closest(".x"))) return;
      kasten.click();
    };
    kasten.onchange = () => {
      vonHand();
      if(kasten.checked){
        if(state.cmpRuns.size >= 4){ kasten.checked = false; toastFail(tt("toast.fourRunsMax")); return; }
        state.cmpRuns.add(id);
      } else state.cmpRuns.delete(id);
      syncCompareBtn(); renderRuns(); renderCompare();
    };
    const x = row.querySelector<HTMLElement>(".x");
    /* Derselbe Weg wie in der Laufliste links: ein Lauf wird an einer
       Stelle entfernt, verschwindet an beiden und kommt mit Rueckgaengig
       an beiden zurueck (Issue #32). */
    if(x) x.onclick = () => {
      const lauf = state.runs.find(o => o.id === id);
      if(lauf) entferneLauf(lauf);
    };
  });
}
/* ---------- Bester Pull | Letzter Pull (Neugestaltung 28.09., Luecken 5) ----------
   Gegen den besten oder den letzten Pull zeigt der Vergleich die Form des
   Entwurfs (paarHtml): zwei grosse Zahlen, der Satz mit der Summe, je
   Faehigkeit eine Zeile mit Balken zur Mitte - neutral, ohne Rot und Gruen
   (DECISION 5.6). Was der Entwurf nicht zeigt, bleibt hinter Aufklappern
   (DECISION 5.7): "Andere Kaempfe waehlen" mit der Auswahl, daraus "Kaempfe
   vergleichen" mit Rangliste, Direktvergleich und Waffe fuer Waffe, dazu
   "Rotation nebeneinander" zugeklappt. */
type PaarArt = "best" | "letzt";
/** Der letzte Pull: der vorige Kampf am selben Boss in diesem Log (letzterKampf, 20), oder warum es ihn nicht gibt. */
interface LetztInfo { refId?: string; curId?: string; refAt?: number; label?: string; grund?: string }
function letztInfo(): LetztInfo {
  // die Gruppentafel misst die ganze Gruppe, wie bei bestInfo()
  if(state.group === "party") return {};
  const seg = state.encounters[state.sel];
  if(!seg) return {};
  if(state.noTime) return {grund: t("vgl.letztOhneUhr")};
  const st = seg.stats || (seg.stats = stats(seg));
  const vor = letzterKampf(seg);
  if(!vor) return {grund: t("vgl.letztFehlt", {zeit: state.wall ? wallTime(seg.start).slice(0, 5) : "", boss: st.name})};
  return {refId: "seg" + state.encounters.indexOf(vor), curId: "seg" + state.sel, refAt: vor.start, label: st.name};
}
/* Der Antwortsatz gegen den letzten Pull, gebaut wie bestAntwort (46): wie
   weit, und welche Faehigkeit den Abstand traegt oder dass er sich verteilt. */
function letztAntwort(li: LetztInfo, zeit: string, o: { rel: number; relShown: number; tie: boolean; gap: number;
                                                         deltas: { n: string; d: number }[] }): string {
  const vars = {boss: li.label, zeit, pct: o.relShown, gap: fmt(Math.abs(o.gap), 1e3)};
  if(o.tie) return t("vgl.leadTie", vars);
  const drunter = o.rel < 0;
  return antwortSchluss(t(drunter ? "vgl.leadBelow" : "vgl.leadAbove", vars), drunter, o.deltas);
}
/* Der Umschalter im Kopf (#vglWahl, index.html): gedrueckt ist die Art, die
   gerade verglichen wird, keine, wenn von Hand gewaehlt ist. Gibt es eine
   Art fuer diesen Kampf nicht, ist ihr Knopf gesperrt (aria-disabled, er
   bleibt erreichbar) und verweist auf den Satz, der sagt warum: #cmpBest
   fuer den besten, #vglGrund fuer den letzten Pull. */
function vglWahlSync(paar: PaarArt | null, hat: Record<PaarArt, boolean>, grundLetzt: boolean){
  const setze = (b: HTMLElement, art: PaarArt, grundId: string) => {
    const an = paar === art ? "true" : "false";
    if(b.getAttribute("aria-pressed") !== an) b.setAttribute("aria-pressed", an);
    if(!hat[art]) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
    if(!hat[art] && grundId) b.setAttribute("aria-describedby", grundId); else b.removeAttribute("aria-describedby");
    b.onclick = () => {
      if(b.getAttribute("aria-disabled") === "true") return;
      state.cmpPaar = art;
      renderCompare();
      b.focus();
    };
  };
  setze($("#vglBest"), "best", document.querySelector("#cmpBest") ? "cmpBest" : "");
  setze($("#vglLetzt"), "letzt", grundLetzt ? "vglGrund" : "");
}
/* Ein Haken von Hand verlaesst den Umschalter: die Wahl gilt, bis er wieder gedrueckt wird. */
export function vonHand(){ state.cmpPaar = null; }

interface PaarDaten {
  art: PaarArt; picks: SavedRun[]; namen: [string, string]; verdict: string; gap: number; tie: boolean; stand: string;
  farbe: (s: {name: string; sid?: string | undefined}) => string; bi: BestInfo;
  /** Beginn des Bezugs und dieses Kampfs (Uhr des Logs) */
  zeiten: [number | null | undefined, number | undefined];
}
function paarHtml(o: PaarDaten): string {
  const ref = o.picks[0]!, cur = o.picks[1]!;
  const uhr = (ms: number | null | undefined) => ms != null && state.wall ? wallTime(ms).slice(0, 5) : "";
  // der Sieger in Gold; unter 5 % keiner (die Regel des Vergleichs)
  const sieger = o.tie || cur.dps === ref.dps ? null : cur.dps > ref.dps ? cur : ref;
  const zahl = (p: SavedRun, name: string, zeit: string) =>
    "<div" + (p === sieger ? ' class="sieger"' : "") + '><span class="num">' + esc(fmt(p.dps)) + '</span><span class="lbl">' + esc(name) +
    "</span><small>" + esc([zeit, p.noTime ? "" : dur(p.seconds), t("vgl.treffer", {n: full(p.hits)})].filter(Boolean).join(" \u00b7 ")) +
    "</small></div>";
  let h = '<div class="vgross">' + zahl(cur, o.namen[1], uhr(o.zeiten[1])) + zahl(ref, o.namen[0], uhr(o.zeiten[0])) + "</div>";
  /* Jede Faehigkeit aus beiden Kaempfen, auch die nur in einem (cmpKey fasst
     Sprache und Rang zusammen), nach dem Betrag des Unterschieds. */
  const keys = new Map<string, {name: string; sid?: string | undefined}>();
  for(const p of [cur, ref]) for(const k of p.skills){ const key = cmpKey(k); if(!keys.has(key)) keys.set(key, {name: k.name, sid: k.sid}); }
  const summe = (p: SavedRun, key: string) => p.skills.filter(s => cmpKey(s) === key).reduce((a, s) => a + s.dps, 0);
  const zeilen = [...keys].map(([key, k]) => {
    const a = summe(ref, key), b = summe(cur, key);
    return {roh: k.name, sid: k.sid, n: skillLabel(k.name, k.sid), d: b - a,
            nur: a > 0 && !(b > 0) ? "ref" : b > 0 && !(a > 0) ? "cur" : ""};
  }).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const zeichen = (x: number) => { const z = fmt(Math.abs(x), 1e3); return z === "0" ? z : (x < 0 ? "\u2212" : "+") + z; };
  /* Der Satz (Luecke 5.4): was wieder hereinkommt (oder verloren geht), und
     dass die Zeilen zusammen die Zahl oben ergeben - gesagt wird das nur,
     wenn es stimmt; sonst steht da, um wie viel sie abweichen. */
  const gegen = o.gap < 0 ? zeilen.filter(z => z.d > 0).sort((x, y) => y.d - x.d)[0]
    : o.gap > 0 ? zeilen.filter(z => z.d < 0).sort((x, y) => x.d - y.d)[0] : undefined;
  const alle = zeilen.reduce((a, z) => a + z.d, 0);
  const satz = (gegen ? t(o.gap < 0 ? "vgl.holt" : "vgl.kostet", {skill: gegen.n, d: fmt(Math.abs(gegen.d), 1e3)}) + " " : "") +
    (zeichen(alle) === zeichen(o.gap) ? t("vgl.summe", {n: zeilen.length, sum: zeichen(alle)})
      : t("vgl.summeRest", {n: zeilen.length, sum: zeichen(alle), rest: fmt(Math.abs(o.gap - alle), 1e3)}));
  h += '<p class="vsatz"><span class="cmplead" id="cmpLead" tabindex="-1">' + esc(o.verdict) + '</span> <span id="cmpSumme">' + esc(satz) + "</span></p>";
  h += '<div class="vstand">' + o.stand + "</div>";
  // wie in "Woher der Unterschied kommt": traegt eine Faehigkeit den Abstand, oder verteilt er sich?
  const sum = zeilen.reduce((a, z) => a + Math.abs(z.d), 0) || 1;
  const drei = zeilen.slice(0, 3).reduce((a, z) => a + Math.abs(z.d), 0);
  const sub = !zeilen.length ? "" : !verteilt(zeilen)
    ? t("compare.concentrated", {n: Math.min(3, zeilen.length), pct: Math.round(100 * drei / sum)})
    : t("compare.spread", {pct: Math.round(100 * groessterAnteil(zeilen))});
  const dm = Math.max(...zeilen.map(z => Math.abs(z.d))) || 1;
  /* Der Balken in der Farbe der Faehigkeit (cmpFarben, dieselbe wie in der
     Schadenstafel und in der Rotation), links weniger, rechts mehr - die
     Richtung steht im Raum und im Vorzeichen, nicht in Rot und Gruen. */
  const balken = (d: number, farbe: string) => '<i style="width:' + (100 * Math.abs(d) / dm).toFixed(2) + "%;--c:" + farbe + '"></i>';
  const nurRef = t(o.art === "best" ? "vgl.nurBest" : "vgl.nurLetzt");
  h += '<section class="vfeld" id="cmpJe" aria-labelledby="cmpJeT"><h3 class="vh" id="cmpJeT">' + esc(t("vgl.liste")) + "</h3>" +
    (sub ? '<p class="cmpsub">' + esc(sub) + "</p>" : "") +
    '<div class="vkopf" aria-hidden="true"><span>' + esc(t("vgl.kopfSkill")) + "</span><span>" +
      esc(t(o.art === "best" ? "vgl.kopfWenigerBest" : "vgl.kopfWenigerLetzt")) + "</span><span>" + esc(t("vgl.kopfUnterschied")) +
      "</span><span>" + esc(t("vgl.kopfMehr")) + "</span></div>" +
    '<div class="vliste" role="table" aria-label="' + esc(t("vgl.liste")) + '">' +
    zeilen.map(z => {
      const f = o.farbe({name: z.roh, sid: z.sid});
      return '<div class="vr" role="row"><span class="vn" role="cell">' + skillMark(z.roh, z.sid, f, false) +
        '<span class="vnn" title="' + esc(z.n) + '">' + esc(z.n) + "</span>" +
        (z.nur ? '<small class="nurb">' + esc(z.nur === "cur" ? t("vgl.nurDiesem") : nurRef) + "</small>" : "") + "</span>" +
        '<span class="vl" aria-hidden="true">' + (z.d < 0 ? balken(z.d, f) : "") + "</span>" +
        '<span class="vw num" role="cell">' + esc(zeichen(z.d)) + "</span>" +
        '<span class="vrr" aria-hidden="true">' + (z.d > 0 ? balken(z.d, f) : "") + "</span></div>";
    }).join("") + "</div></section>";
  // die Rotation nebeneinander, zugeklappt (DECISION 5.7)
  h += cmpRotation(o.picks, false, o.art === "best" ? o.bi : undefined, o.farbe, {zu: true, namen: o.namen});
  return h;
}
/* Aufgeklappt bleiben die Raster im Paar, bis man sie wieder zuklappt. */
let rasterOffen = false;
/* "Auf gleiche Laenge kuerzen" und zurueck, in beiden Formen des Vergleichs. */
function standBinden(){
  const clipBtn = document.querySelector<HTMLElement>("#cmpClip"), unclipBtn = document.querySelector<HTMLElement>("#cmpUnclip");
  if(clipBtn) clipBtn.onclick = () => { state.clipRuns = true; renderCompare(); };
  if(unclipBtn) unclipBtn.onclick = () => { state.clipRuns = false; renderCompare(); };
}

export function renderCompare(){
  const box = $("#cmpBody");
  /* Bester Pull | Letzter Pull (Neugestaltung 28.09., Luecken 5.1/5.2): der
     Umschalter im Kopf setzt das Paar selbst - der Bezug zuerst, dann der
     gewaehlte Kampf -, und es folgt der Kampfwahl. Gibt es die gewaehlte Art
     fuer diesen Kampf nicht, gilt die andere; von Hand gewaehlte Kaempfe
     (state.cmpPaar null) bleiben, wie sie sind. */
  const biAlle = bestInfo(), li = letztInfo();
  // ein bester Pull ohne Lauf (ohneLauf) ist hier kein Bezug: es gibt nichts anzuhaken
  const hat = {best: mitLauf(biAlle) && !!biAlle.curId, letzt: !!(li.refId && li.curId)};
  const wunsch = state.cmpPaar;
  const soll: PaarArt | null = !wunsch ? null : hat[wunsch] ? wunsch : hat[wunsch === "best" ? "letzt" : "best"] ? (wunsch === "best" ? "letzt" : "best") : null;
  if(soll){
    const paarIds = soll === "best" ? [biAlle.refId!, biAlle.curId!] : [li.refId!, li.curId!];
    if([...state.cmpRuns].join("|") !== paarIds.join("|")){
      state.cmpRuns = new Set(paarIds);
      state.clipRuns = false;
      syncCompareBtn(); renderRuns();
    }
  }
  const auswahl = cmpAuswahl();
  const raw = [...state.cmpRuns].map(cmpLauf).filter((r): r is SavedRun => !!r);
  /* Zwei Faecher: die Liste oben, der Vergleich darunter. Getrennt, weil ein
     Haken nur das untere aendert - schreibt man beides neu, springt die Liste
     an den Anfang zurueck und der Fokus faellt auf <body>. */
  if(!box.querySelector("#cmpPick"))
    box.innerHTML = '<div id="cmpBestWrap"></div><div id="cmpPick"></div><div id="cmpOut"></div>';
  const pick = $("#cmpPick"), out = $("#cmpOut");
  /* Die Zeile zum besten Pull steht ueber der Auswahl, zum Kampf links.
     Neu gebaut nur, wenn sie anders lautet - sonst verloere ein Knopf darin
     bei jedem Wachstum des Logs den Fokus. */
  const bestWrap = $("#cmpBestWrap");
  const bi = raw.length === 2 ? biAlle : {} as BestInfo;
  const gegenBest = raw.length === 2 && gegenBestAktiv(bi);
  const gegenLetzt = raw.length === 2 && !!li.refId && [...state.cmpRuns][0] === li.refId && state.cmpRuns.has(li.curId!);
  /* Ist der bester Pull zugleich der letzte, entscheidet der Umschalter, als was er erscheint. */
  const paar: PaarArt | null = soll === "letzt" && gegenLetzt ? "letzt" : gegenBest ? "best" : gegenLetzt ? "letzt" : null;
  box.classList.toggle("paar", !!paar);
  /* Gegen den letzten Pull traegt die Zeile zum besten nichts bei - der
     Umschalter bietet ihn an. Ist der letzte gesperrt, steht sein Grund
     darunter; der Knopf verweist darauf (vglWahlSync). */
  const grundLetzt = state.encounters[state.sel] && !hat.letzt && li.grund
    ? '<p class="cmpstate vgrund" id="vglGrund">' + esc(li.grund) + "</p>" : "";
  const bestHtml = (paar === "letzt" && hat.best ? "" : bestZeile()) + grundLetzt;
  if(bestWrap.dataset.marke !== bestHtml){
    leerTauschen(bestWrap, bestHtml);
    bestWrap.dataset.marke = bestHtml;
    bestZeileBinden();
  }
  /* Die Liste steht ueber allem, auch ueber dem fertigen Vergleich: wer zwei
     Kaempfe verglichen hat, will als naechstes einen davon austauschen.
     Neu gebaut wird sie nur, wenn sich die Auswahlmenge geaendert hat. */
  /* Die Sprache gehoert in die Marke: sonst blieb der Satz ueber der Liste
     nach einem Sprachwechsel in der alten Sprache stehen (gemessen im
     Paritaetsszenario 22, "Mark two to four fights." im deutschen Fenster). */
  /* Ein gespeicherter bester Pull traegt eine Kennung je Platz, nicht je
     Kampf: rueckt ein neuer Bestwert nach, bleibt die Kennung und Name und
     DPS wechseln. Darum steht bei ihnen beides mit in der Marke. Bei den
     Kaempfen des Logs nicht - deren DPS waechst im Livebetrieb alle zwei
     Sekunden, und die Liste verloere jedes Mal den Fokus. */
  /* Gegen den besten Pull? Dieselbe Bedingung, die unten Farbe und Namen
     steuert; hier entscheidet sie, ob die Liste zugeklappt steht. */
  vglWahlSync(paar, hat, !!li.grund);
  const marke = auswahl.length >= 2 ? state.lang + (paar ? ":zu:" : ":") + auswahl.map(a =>
    a.quelle === "best" ? a.id + "=" + a.titel + "=" + a.dps : a.id).join(",") : "";
  if(pick.dataset.marke !== marke){
    /* Wechselt die Form (zugeklappt oder offen), weil ein Haken darin
       gesetzt wurde, bleibt der Fokus auf derselben Zeile, und eine
       aufgeklappte Liste bleibt aufgeklappt. */
    const war = pick.querySelector<HTMLDetailsElement>("details.cmppickfold");
    const offen = !!war && war.open;
    const fokus = document.activeElement instanceof HTMLElement && pick.contains(document.activeElement)
      ? document.activeElement.closest<HTMLElement>(".run")?.dataset.cid : undefined;
    pick.innerHTML = marke ? cmpPicker(auswahl, !!paar) : "";
    pick.dataset.marke = marke;
    cmpPickerBinden(pick);
    const neu = pick.querySelector<HTMLDetailsElement>("details.cmppickfold");
    if(neu && offen) neu.open = true;
    if(fokus) [...pick.querySelectorAll<HTMLElement>(".run")]
      .find(r => r.dataset.cid === fokus)?.querySelector("input")?.focus();
  }
  /* Die Haken immer nachziehen: gesetzt werden sie hier oder in der
     Laufliste rechts, und beide Listen zeigen dieselbe Menge. */
  pick.querySelectorAll<HTMLElement>(".run").forEach(row => {
    const k = row.querySelector("input");
    if(k) k.checked = state.cmpRuns.has(row.dataset.cid!);
  });
  if(raw.length < 2){
    // Three states, not one grey line. What to do next is different when
    // nothing is there to pick, when something is there but none is ticked,
    // and when one is ticked and the reader is a single click from the answer.
    const body = auswahl.length < 2 ? esc(t("compare.nothingYet"))
      : raw.length === 1 ? esc(t("compare.emptyOne"))
      : esc(t("compare.emptyPick", {n: auswahl.length}));
    /* Kein Zaehler mehr. Darunter stand "0 / 2" in Gold und Kopfgroesse -
       die groesste und hellste Stelle eines leeren Reiters, und sie sagte
       nur, dass noch nichts gewaehlt ist. Gold gehoert der Zahl, die zaehlt
       (Glut-Regel). Der Satz nennt jetzt den naechsten Schritt selbst. */
    /* Ohne zwei Kaempfe zum Anhaken: der Knopf, der welche bringt
       (leerKnopf, 58-felder.ts, Kritik 28.09.). Mit Auswahl sind die Haken
       oben die Handlung. */
    const akt = auswahl.length < 2 ? leerKnopf() : "";
    const neu = '<div class="cmpempty"><h3>'+esc(t("compare.emptyTitle"))+"</h3><p>"+
      body+"</p>"+(akt ? '<div class="leerakt">'+akt+"</div>" : "")+"</div>";
    if(out.dataset.marke !== neu){ leerTauschen(out, neu); out.dataset.marke = neu; }
    return;
  }

  const target = clipTarget(raw);
  const lo = Math.min.apply(null, raw.map(r => r.seconds));
  const hi = Math.max.apply(null, raw.map(r => r.seconds));
  const lengthsDiffer = hi - lo > 0.5;
  const geschnitten = state.clipRuns ? raw.map(r => clip(r, target)) : raw;
  /* Ab drei Kaempfen ist es eine Rangliste: nach DPS sortiert, und alles -
     Feld, Raster, Tafeln - misst gegen den ersten, den mit den meisten DPS.
     Vorher rechnete das Raster gegen den zuerst angehakten, in der
     Reihenfolge des Anhakens, und derselbe Kampf stand oben bei -19 % und
     darunter bei +1 % (#33). Bei zweien bleibt die Reihenfolge des Anhakens:
     ein Vorher/Nachher, mit "Bezug tauschen". */
  const picks = geschnitten.length > 2
    ? [...geschnitten].sort((a, b) => b.dps - a.dps) : geschnitten;
  // A run saved without a Time column carries no seconds anyone measured,
  // so the three rows built on them are left out rather than printed as a
  // comparison. Everything else on the table is a count or a rate.
  const noClock = picks.some(p => p.noTime);
  const two = picks.length === 2;
  /* Gegen den besten oder letzten Pull heissen die zwei ueberall gleich:
     "Bester Pull (Datum)" bzw. "Letzter Pull (Uhrzeit)" und "Dieser Kampf" -
     in den zwei Zahlen, im Satz und in der Rotation. */
  const letztZeit = li.refAt != null && state.wall ? wallTime(li.refAt).slice(0, 5) : "";
  const namen: [string, string] | null = paar === "best" ? bestNamen(bi)
    : paar === "letzt" ? [t("vgl.letztName", {zeit: letztZeit}), t("best.colThis")] : null;
  const name = (p: SavedRun) => namen ? namen[p === picks[0] ? 0 : 1] : p.tag || p.name;
  // der Bezug mitten im Satz: gegen den besten oder letzten Pull gebeugt ("deinen besten Pull (...)"), sonst sein Name
  const bezugSatz = paar === "best" ? bestBezug(bi) : paar === "letzt" ? t("vgl.letztAcc", {zeit: letztZeit})
    : picks[0] ? name(picks[0]) : "";

  /* Under five percent, two runs of the same fight are telling you about the
     night, not about the build. The threshold is printed rather than applied
     quietly, and in that state nothing is marked as the winner. */
  const dpsAll = picks.map(p => p.dps);
  const top = Math.max.apply(null, dpsAll);
  const win = dpsAll.indexOf(top);
  /* Zwei Laeufe: Abstand, Prozent und "gleichauf" aus dem Kern
     (best-pull-core.ts, vergleichZahlen), dieselbe Rechnung wie das Urteil
     der Tafel. rel ist dieselbe Zahl, die der Chip der zweiten Zeile druckt;
     relShown das ganze Prozent jedes Chips hier und die Zahl, gegen die die
     Schwelle "unter 5 %" gelesen wird (der Satz sagte "3,7 % Unterschied"
     ueber einem Chip mit "+4 %"). Ab drei Laeufen ist es eine Rangliste:
     es gibt keinen einen Abstand, also kein rel und kein Gleichauf - dafuer
     braucht es keine eigene Rechnung. */
  const zahlen = two ? vergleichZahlen(picks[0]!, picks[1]!, cmpKey, noClock) : null;
  const rel = zahlen ? zahlen.rel : 0;
  const relShown = zahlen ? zahlen.relShown : 0;
  const tie = zahlen ? zahlen.tie : false;
  /* Verschiedene Bosse: Ramux gegen Dragaryle ergab "gewinnt auf DPS, 46 %
     niedriger", als haette derselbe Spieler denselben Kampf besser gemacht.
     Jeder Boss nimmt Schaden anders an, also wird hier kein Sieger genannt.
     Die Tafel bleibt - wer zwei Abende nebeneinander sehen will, soll das
     koennen. Verglichen wird ueber histKey, damit eine Phase zu ihrem Boss
     zaehlt und die Schreibweise der Sprache keine Rolle spielt. */
  const bosse = [...new Set(picks.map(p => histKey(p.name)))];
  const gemischt = bosse.length > 1;
  const leader = tie || gemischt ? -1 : win;
  /* Und keine Farbe, die ein Urteil ist. Rot "-46 %" neben "kein Sieger"
     nahm den Satz gleich wieder zurueck. Die Zahlen bleiben, gefaerbt
     wird nur, wo der Vergleich traegt. */
  /* Ebenso gegen den besten Pull: der ist fast immer besser, rot stand
     dann jede Zeile, und der Vergleich las sich als Tadel statt als
     Vorlage. Die Vorzeichen sagen, wo er mehr hatte; die Farbe bleibt weg. */
  /* Gegen den letzten Pull genauso (Neugestaltung 28.09., DECISION 5.6):
     Rot und Gruen nur, wo Kaempfe von Hand verglichen werden (#42). */
  const neutral = gemischt || !!paar;
  const dc = (d: number | null, better: number) => deltaClass(d, neutral ? 0 : better);

  // per-skill matrix — grouped by skill id where we have one, not by raw
  // name, so an English run's "Detonation Mark" and a German run's
  // "Detonierendes Mal" are correctly recognised as the same skill (cmpKey)
  const skillKeys = new Map();
  picks.forEach(p => p.skills.forEach(k => {
    const key = cmpKey(k);
    if(!skillKeys.has(key)) skillKeys.set(key, {name:k.name, sid:k.sid});
  }));
  const rows = [...skillKeys.entries()].map(([key, info]) => ({
    key, n: skillLabel(info.name, info.sid), roh: info.name, sid: info.sid,
    // no clock, no per-second: the damage itself is what was measured.
    // Summed rather than found: if one run does carry two entries under one
    // key they add up instead of one being dropped without a word.
    vals: picks.map(p => p.skills.filter(s => cmpKey(s)===key)
                          .reduce((a,s)=>a+(noClock ? s.damage : s.dps), 0)),
    casts: picks.map(p => p.skills.filter(s => cmpKey(s)===key).reduce((a,s)=>a+s.casts, 0))
  })).sort((a,b) => Math.max(...b.vals) - Math.max(...a.vals));

  // was sich je Faehigkeit geaendert hat, groesstes zuerst (zahlen, oben)
  const deltas = zahlen ? zahlen.deltas.map(x => ({roh: x.name, sid: x.sid, n: skillLabel(x.name, x.sid), d: x.d})) : [];
  // eine Farbe je Faehigkeit fuer Balken und Rotation (cmpFarben, oben)
  const farbe = cmpFarben(rows.map(r => ({name: r.roh, sid: r.sid})));
  const gap = zahlen ? zahlen.gap : 0;

  let verdict;
  if(paar === "best") verdict = bestAntwort(bi, {rel, relShown, tie, gap, deltas});
  else if(paar === "letzt") verdict = letztAntwort(li, letztZeit, {rel, relShown, tie, gap, deltas});
  else if(gemischt) verdict = two
    ? t("compare.otherBosses", {a: picks[0]!.name, b: picks[1]!.name})
    : t("compare.otherBossesMany", {n: bosse.length});
  else if(tie) verdict = t("compare.verdictTie", {pct: relShown});
  else if(two && rel < 0) verdict = t("compare.verdictBehind",
    {lead: name(picks[0]!), other: name(picks[1]!), pct: Math.round(-rel)});
  else if(two) verdict = t("compare.verdictLeads",
    {lead: name(picks[1]!), other: name(picks[0]!), pct: Math.round(rel)});
  else verdict = t("compare.verdictMany", {lead: name(picks[win]!), dps: fmt(top)});

  /* Bei zwei Kaempfen misst alles gegen den zuerst angehakten, und das
     stand nirgends: "Gesamt -216.5k DPS" liess offen, von welchem Kampf aus.
     Die Zeile nennt den Bezug, und der Knopf tauscht ihn, statt dass man
     beide Haken neu setzen muss. Ab drei nennt sie den Fuehrenden; einen
     Knopf gibt es dort nicht, der Bezug folgt aus der Rangliste. Gegen den
     besten oder letzten Pull auch nicht (#35): der Tausch verliess den Modus
     still - Liste auf, Uhrzeiten statt Namen, das Vorzeichen gekippt. */
  let stand = '<p class="cmpstate">'+esc(t("compare.measuredAgainst", {ref: bezugSatz}))+
    (two && !paar ? ' <button class="btn sm" id="cmpSwap">'+esc(t("compare.swapRef"))+"</button>" : "")+"</p>";
  // The fairness of the comparison, above the numbers it is about, with the
  // fix as a button rather than as a checkbox on a card nobody read. It used
  // to be a sentence tacked onto the end of the findings, under the table it
  // invalidates.
  if(state.clipRuns){
    stand += '<p class="cmpstate">'+esc(t("compare.clipped", {len: dur(target)}))+
      ' <button class="btn sm" id="cmpUnclip">'+esc(t("compare.clipUndo"))+"</button></p>";
  } else if(gemischt){
    // "DPS und die Raten sind so vergleichbar" stand direkt unter "DPS sagt
    // hier wenig" - bei verschiedenen Bossen ist die Laenge nicht die Frage
  } else if(lengthsDiffer){
    stand += '<p class="cmpstate warn">'+esc(t(two ? "compare.lengthsDiffer" : "compare.lengthsDifferMany",
        two ? {a: dur(raw[0]!.seconds), b: dur(raw[1]!.seconds)} : {a: dur(lo), b: dur(hi)}))+
      ' <button class="btn sm" id="cmpClip">'+
      esc(t(two ? "compare.clipTo" : "compare.clipToMany", {len: dur(target)}))+"</button></p>";
  } else {
    stand += '<p class="cmpstate">'+esc(t("compare.lengthsMatch", {len: dur(lo)}))+"</p>";
  }
  // The scoreline. Bar length is the quantity, so the ratio lands before a
  // digit is read; it is the app's own .fill bar, the one behind every row
  // in the readout, so a bar means the same thing here as it does there.
  /* Der Kopf nennt den Sieger, bevor das Feld ihn zeigt: die Zahl gross,
     der Name daneben, der Satz darunter, rechts die drei Fakten seines
     Laufs. Bei einem Gleichstand gibt es keinen, dann traegt der Satz
     allein. */
  const fuehrer = leader >= 0 ? picks[leader] : null;
  let html = '<div class="cmpband">';
  html += '<div class="cmpkopf">'+
    (fuehrer ? '<span class="zahl num">'+fmt(fuehrer.dps)+"</span>" : "")+
    '<span class="wer">'+(fuehrer ? "<b>"+esc(name(fuehrer))+"</b>" : "")+
      "<span>"+esc(verdict)+"</span></span>"+
    (fuehrer ? '<span class="fakten num">'+
      esc(fuehrer.noTime ? "\u2014" : dur(fuehrer.seconds))+"<br>"+
      esc(fmt(fuehrer.total))+" "+esc(t("compare.damage"))+"<br>"+
      esc(full(fuehrer.hits))+" "+esc(t("compare.hits"))+"</span>" : "")+
    "</div>";

  /* Bei zwei Kaempfen die Reihenfolge, die angehakt wurde, ab drei die nach
     DPS (oben sortiert) - in beiden Faellen misst alles gegen den ersten,
     und die Tafeln darunter rechnen genauso. */
  const feld = picks.map((p, ix) => ({p, ix}));
  const bezug = picks[0]!;   // two or more, see the return above
  html += '<div class="cmpfeld">';
  for(const {p, ix} of feld){
    const lead = ix === leader;
    const d = p === bezug || !bezug.dps ? null : 100*(p.dps - bezug.dps)/bezug.dps;
    const show = d != null && Math.abs(d) >= 0.5;
    /* Hoechstens 78 Prozent der Zeile: sonst liegt die Zahl des Siegers
       auf seinem eigenen Balken, Gold auf Gold. Der laengste Balken ist
       der beste, dafuer muss er die Zeile nicht fuellen. */
    const w = 10 + (top ? p.dps/top : 0)*68;
    html += '<div class="cmpzeile'+(lead ? " fuehrt" : "")+'">'+
      '<span class="bal" style="width:'+w.toFixed(1)+'%;--bal-a:'+
        (lead ? "var(--amber)" : "var(--raise)")+';--bal-b:'+
        (lead ? "var(--deep)" : "var(--comb2)")+'"></span>'+
      '<span class="nm">'+esc(name(p))+
        "<i>"+esc(p.name)+(p.noTime ? "" : " \u00b7 "+dur(p.seconds))+
        (p.clipped ? " \u00b7 "+esc(t("compare.cut")) : "")+"</i></span>"+
      '<span class="wert">'+
        (show ? '<span class="'+dc(d,1)+'">'+(d>0?"+":"")+pctOf(d)+"</span>" : "")+
        "<b>"+fmt(p.dps)+"</b></span></div>";
  }
  html += "</div>";

  html += stand;   // die Zeile zum Bezug und zur Laenge (stand, oben)


  // What drove the difference, promoted out of the card it used to close the
  // tab with. The total was the verdict, printed last; the skill rows are the
  // reader's second question, so they follow the first answer directly.
  if(two){
    if(deltas.length && gap){
      const sum = deltas.reduce((a,x)=>a+Math.abs(x.d), 0) || 1;
      const three = deltas.slice(0,3).reduce((a,x)=>a+Math.abs(x.d), 0);
      const biggest = groessterAnteil(deltas);
      // The headline over the list is the concentration figure itself, and it
      // still says something true when nothing dominates — which the old
      // "a large share sits here", repeated on every row over 40%, did not.
      // Dieselbe Regel wie im Antwortsatz gegen den besten Pull (verteilt).
      const sub = !verteilt(deltas)
        ? t("compare.concentrated", {n: Math.min(3, deltas.length), pct: Math.round(100*three/sum)})
        : t("compare.spread", {pct: Math.round(100*biggest)});
      const peak = Math.abs(deltas[0]!.d) || 1;
      /* Der Balken zur Mittellinie (Instrumententafel Stufe 4, nur unter
         body.felder zu sehen): links weniger, rechts mehr, die Laenge gegen
         den groessten Abstand der gezeigten Zeilen - die Gesamtzeile
         eingeschlossen. Die Farbe ist die der Faehigkeit im ganzen
         Vergleich (cmpFarben); die Richtung steht im Raum und im Vorzeichen,
         nicht in Rot und Gruen. Ohne Abstand kein Balken, nur die Linie.
         Fuer Vorleser verborgen: die Zahl daneben sagt dasselbe. */
      const gezeigt = deltas.slice(0,5);
      const weit = Math.max(Math.abs(gap), ...gezeigt.map(x => Math.abs(x.d))) || 1;
      const mitte = (d: number, farbe: string) =>
        '<span class="cdiv" aria-hidden="true">'+(d ? '<i class="'+(d < 0 ? "neg" : "pos")+'" style="width:'+
          (50*Math.abs(d)/weit).toFixed(2)+"%;--c:"+farbe+'"></i>' : "")+"</span>";
      /* Bei verschiedenen Bossen zugeklappt: "woher der Unterschied" setzt
         voraus, dass es einer im Spiel war und nicht einer der Bosse. Wer
         es trotzdem sehen will, klappt auf. */
      html += (gemischt
        ? '<details class="fold cmpcontrib"><summary><h3>'+esc(t("compare.whereFrom"))+"</h3></summary>"
        : '<div class="cmpcontrib"><h3>'+esc(t("compare.whereFrom"))+"</h3>") +
        '<p class="cmpsub">'+esc(sub)+"</p>" +
        '<div class="crow total"><span class="n">'+esc(t("compare.overallVs", {ref: bezugSatz}))+"</span>" +
        mitte(gap, "var(--ink-soft)") +
        '<span class="v '+dc(gap,1)+'">'+(gap>0?"+":"")+fmt(gap, 1e3)+" "+t("bars.dps")+"</span></div>";
      for(const x of gezeigt){
        html += '<div class="crow">' +
          '<span class="fill" style="width:'+(100*Math.abs(x.d)/peak).toFixed(1)+
            '%;--c:'+(neutral ? "var(--dim)" : x.d > 0 ? "var(--pos)" : "var(--neg)")+'"></span>' +
          '<span class="n">'+esc(x.n)+"</span>" +
          mitte(x.d, farbe({name: x.roh, sid: x.sid})) +
          '<span class="v '+dc(x.d,1)+'">'+(x.d>0?"+":"")+fmt(x.d, 1e3)+" "+t("bars.dps")+"</span></div>";
      }
      html += gemischt ? "</details>" : "</div>";
    }
  }
  html += "</div>";
  /* Ten rows, six of which mean something different depending on the state
     the tab is in. A run stores no events, so clip() can recompute damage,
     dps and the per-second series, estimates hits, and passes the rates, the
     average and biggest hit and the idle time through untouched. Saying so
     on the rows themselves beats a reassurance under the table. */
  const metrics = ([
    {label:t("compare.dps"),       get:r=>r.dps,          f:fmt,    better:1,  clock:1, est:"rate"},
    {label:t("compare.damage"),    get:r=>r.total,        f:fmt,    better:1,  lenDep:1},
    {label:t("compare.length"),    get:r=>r.seconds,      f:dur,    better:0,  lenDep:1, clock:1},
    {label:t("compare.hits"),      get:r=>r.hits,         f:full,   better:1,  lenDep:1, est:"counts"},
    {label:t("compare.critRate"),  get:r=>r.critRate,     f:v=>pct(v,1), better:1, rateDp:1, whole:1},
    {label:t("compare.critShare"), get:r=>r.critDmgShare, f:v=>pct(v), better:1, rateDp:0, whole:1},
    {label:t("compare.heavyRate"), get:r=>r.heavyRate,    f:v=>pct(v,1), better:1, rateDp:1, whole:1},
    {label:t("compare.avgHit"),    get:r=>r.avg,          f:fmt,    better:1,  whole:1},
    {label:t("compare.bigHit"),    get:r=>r.max,          f:fmt,    better:1,  whole:1},
    {label:t("compare.idleTime"),  get:r=>r.dead,         f:secs1, better:-1, lenDep:1, whole:1, clock:1}
  ] as CmpMetric[]).filter(m => !(noClock && m.clock));
  const wcol = (ix: number) => leader === ix;
  const kopfZellen = picks.map((p,ix) => cmpZelle("<b>"+esc(name(p))+"</b>", {
    kopf:1, win:wcol(ix),
    zu: (p.noTime ? "\u2014" : dur(p.seconds)) + (p.clipped ? " \u00b7 "+esc(t("compare.cut")) : "")
  }));
  const kennZeilen = [];
  for(const m of metrics){
    const vals = picks.map(m.get);
    /* Eine geschnittene Zahl, hinter der die Zeile nicht steht: entweder
       hochgerechnet, weil der Lauf keine Trefferreihe mitbringt, oder durch
       eine andere Zeit geteilt, weil der Kampf Loecher hat. Beides kommt aus
       clip(). Die Zahl bleibt stehen - die Hausregel nimmt keinen Wert weg -,
       aber sie bekommt einen Hinweis und keinen Sieger: eine geschaetzte
       Zahl fett zu setzen ist die Behauptung, die hier nicht gedeckt ist.
       Gemessen ueber zehn Kaempfe lag die alte Hochrechnung zwischen -33,5 %
       und +30,4 % neben der Zahl, die wirklich gefallen war. */
    const geschaetzt = (m.est === "counts" && picks.some(p => p.estCounts))
                    || (m.est === "rate"   && picks.some(p => p.estRate));
    const best = geschaetzt ? null
               : m.better>0 ? Math.max(...vals) : m.better<0 ? Math.min(...vals) : null;
    const isRate = typeof m.rateDp === "number";
    // a row can be uncomparable for three different reasons, and they do not
    // overlap: unequal lengths before clipping, whole-fight figures after it,
    // and a figure clip() could not work out exactly
    const tag = geschaetzt ? t("compare.estimated")
              : m.lenDep && lengthsDiffer && !state.clipRuns ? t("compare.scalesWithLength")
              : m.whole && state.clipRuns ? t("compare.wholeFight") : "";
    const zellen = vals.map((v,ix) => {
      const lead = best!=null && v===best;
      // A rate is already a percentage, so a relative change of one says
      // something other than what it looks like: 79.9% down to 59.1% is
      // "-26%", true of the ratio but read as if 26 points were lost. Rates
      // report the difference itself, in points — which is what people
      // compare rates in, and which still works when the first run's rate is
      // zero and no ratio can be formed at all.
      // The subtraction is done on the rounded figures the cells actually
      // show. Taken from the raw values instead, 82% and 89% differed by
      // 6.9 points on screen: correct, and impossible to reconcile with the
      // two numbers beside it.
      const round = (x: number) => +(100*x).toFixed(m.rateDp!);
      const d = ix === 0 ? null
              : isRate ? round(v) - round(vals[0]!)
              : vals[0] ? 100*(v - vals[0])/vals[0]
              : null;
      const show = d != null &&
        Math.abs(d) >= (isRate ? Math.pow(10,-m.rateDp!)/2 : 0.5);
      const text = !show ? "" : (d>0?"+":"") +
        (isRate ? numN(d, m.rateDp!)+"\u00a0"+t("compare.pp") : pctOf(d));
      /* Der Balken steht nur, wo die Zeile vergleichbar ist. Traegt sie
         einen Hinweis - "waechst mit der Laenge", "geschaetzt", "ganzer
         Kampf" -, bleibt er weg: ein Balken waere die Einladung zu genau
         dem Vergleich, den der Hinweis gerade zurueckgenommen hat. */
      const spanne = m.better < 0
        ? Math.max.apply(null, vals) : Math.max.apply(null, vals);
      const anteil = tag || !spanne ? null : Math.abs(v)/Math.abs(spanne);
      return cmpZelle((lead?"<b>":"")+m.f(v)+(lead?"</b>":"") +
        (show
          ? ' <span class="'+dc(d, tag ? 0 : m.better)+'"'+
            (isRate ? ' title="'+esc(t("compare.ppTitle"))+'"' : "")+">"+esc(text)+"</span>"
          : ""), {win: wcol(ix), best: lead, wenig: m.better < 0, anteil});
    });
    kennZeilen.push({
      kopf: "<em>"+esc(m.label)+(tag ? "<i>"+esc(tag)+"</i>" : "")+"</em>",
      zellen: zellen
    });
  }
  /* Direktvergleich und Waffe fuer Waffe: bei Kaempfen von Hand offen unter
     dem Band, gegen den besten oder letzten Pull zugeklappt unter der
     Rotation (DECISION 5.7), dort neutral wie alles im Paar (DECISION 5.6). */
  let raster = '<div class="card"><h3>'+esc(t("compare.headToHead"))+"</h3>"+
    cmpGrid(esc(t("compare.metric")), kopfZellen, kennZeilen)+"</div>";

  /* Sobald geschnitten wurde, ist jede Zahl in dieser Tabelle hochgerechnet:
     clip() skaliert Schaden, Treffer und Einsaetze je Faehigkeit mit dem
     Verhaeltnis der Gesamtsummen, und die Sekundenreihe kennt nur die Summe,
     nicht die Bahnen je Faehigkeit. Der Hinweis steht an der Ueberschrift und
     gilt damit fuer die ganze Tabelle, statt in jeder Zelle zu stehen. */
  const skaliert = picks.some(p => p.clipped);
  /* Die Faehigkeiten tragen ihr Symbol, wie ueberall sonst. Eine
     Aenderungsspalte gibt es nur bei zweien - bei fuenf waere "Aenderung
     gegenueber wem" eine Frage ohne Antwort. */
  const skillKopf = picks.map((p,ix) => cmpZelle("<b>"+esc(name(p))+"</b>",
    {kopf:1, win: wcol(ix)}))
    .concat(two ? [cmpZelle("<b>"+esc(t("compare.change"))+"</b>", {kopf:1})] : []);
  const skillZeilen = rows.map(r => {
    const best = Math.max.apply(null, r.vals);
    const zellen = r.vals.map((v,ix) => v
      ? cmpZelle((v===best?"<b>"+fmt(v)+"</b>":fmt(v)),
          {win: wcol(ix), best: v===best, anteil: best ? v/best : null,
           zu: esc(t("compare.casts",{n:r.casts[ix]}))})
      : cmpZelle("\u2014", {win: wcol(ix), leer:1}));
    if(two){
      const d = r.vals[1]!-r.vals[0]!;
      zellen.push(cmpZelle(d
        ? '<span class="'+dc(d,1)+'">'+(d>0?"+":"")+fmt(d, 1e3)+"</span>"
        : "\u2014", {leer: !d}));
    }
    return {kopf: skillMark(r.roh, r.sid, "", false)+"<em>"+esc(r.n)+"</em>", zellen};
  });
  raster += '<div class="card"><h3>'+esc(t(noClock ? "compare.damageBySkill" : "compare.dpsBySkill"))+
    (skaliert ? ' <span class="rowtag">'+esc(t("compare.estimated"))+"</span>" : "")+"</h3>"+
    cmpGrid(esc(t("compare.skill")), skillKopf, skillZeilen);

  // per-weapon matrix — uses each run's own frozen weapon split, not the
  // live assignment, so an old run stays true to what it actually was. It is
  // a section of the skill card rather than a card of its own: same shape of
  // data, same container. One row would just restate the DPS line, so one
  // row is not drawn.
  const wnames = new Set<string>(); picks.forEach(p => p.skills.forEach(k => wnames.add(k.weapon || "Unassigned")));
  const wrows = [...wnames].map(w => ({
    w, vals: picks.map(p => p.skills.filter(k => (k.weapon||"Unassigned")===w)
                            .reduce((a,k)=>a+(noClock ? k.damage : k.dps),0))
  })).sort((a,b) => Math.max(...b.vals) - Math.max(...a.vals));
  const anyWeapon = picks.some(p => p.skills.some(k => k.weapon && k.weapon !== "Unassigned"));

  if(anyWeapon && wrows.length > 1){
    const wKopf = picks.map((p,ix) => cmpZelle("<b>"+esc(name(p))+"</b>",
      {kopf:1, win: wcol(ix)}));
    const wZeilen = wrows.map(r => {
      const best = Math.max.apply(null, r.vals);
      return {
        kopf: weaponMark(r.w)+"<em>"+esc(weaponLabel(r.w))+"</em>",
        zellen: r.vals.map((v,ix) => v
          ? cmpZelle((v===best?"<b>"+fmt(v)+"</b>":fmt(v)),
              {win: wcol(ix), best: v===best, anteil: best ? v/best : null})
          : cmpZelle("\u2014", {win: wcol(ix), leer:1}))
      };
    });
    raster += '<div class="cardsec"><h4>'+
      esc(t(noClock ? "compare.damageByWeapon" : "compare.dpsByWeapon"))+"</h4>"+
      cmpGrid(esc(t("compare.weapon")), wKopf, wZeilen)+"</div>";
  }
  raster += "</div>";
  /* Gegen den besten oder letzten Pull: die Form des Entwurfs (paarHtml),
     darunter zugeklappt die Raster; das Band oben entfaellt. */
  if(paar && two){
    out.innerHTML = paarHtml({art: paar, picks, namen: namen!, verdict, gap, tie, stand, farbe, bi,
      zeiten: [paar === "best" ? bi.refAt : li.refAt, state.encounters[state.sel]?.start]}) +
      '<details class="card fold cmpraster" id="cmpRaster"' + (rasterOffen ? " open" : "") + "><summary><h3>" + esc(t("vgl.raster")) +
      "</h3></summary>" + raster + "</details>";
    out.dataset.marke = "";
    standBinden();
    cmpRotationBinden();
    $("#cmpRaster").addEventListener("toggle", e => { rasterOffen = (e.currentTarget as HTMLDetailsElement).open; });
    return;
  }
  html += raster;
  // die Einsaetze der zwei Kaempfe nebeneinander (46-best-pull.ts)
  html += cmpRotation(picks, gemischt, undefined, farbe);

  out.innerHTML = html;
  out.dataset.marke = "";   // der leere Stand oben wird danach wieder geschrieben
  cmpRotationBinden();
  standBinden();
  // the order of the set is the order of ticking, and picks[0] is the reference
  const swapBtn = $("#cmpSwap");
  if(swapBtn) swapBtn.onclick = () => {
    vonHand();
    state.cmpRuns = new Set([...state.cmpRuns].reverse());
    renderCompare();
    $("#cmpSwap")?.focus();
  };
}
