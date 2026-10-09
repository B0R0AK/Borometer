import { BORO_VERSION, seriesColor, state } from "./01-state";
import { dur, fmt } from "./03-helpers";
import { histKey, knownBoss, practiceTarget } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { skillMark } from "./11-skill-icons";
import { skillLabel } from "./14-questlog-weapons";
import { clip, perSecond, secs1, summarise } from "./16-fight-analysis";
import { $, esc } from "./18-interface-basics";
import { renderCompare } from "./28-compare";
import { renderRuns } from "./30-fight-list";
import { looksLikeRun, switchTab } from "./34-menus-drop-and-tabs";
import { KOMPAKT_FENSTER, SERVED } from "./41-server-mode";
import { partyEinsaetze } from "./42-party";
import { isWatching, syncCompareBtn } from "./45-startup";
import { bauHinweisSatz, bezugVonRef, type Bezug } from "./47-paar";
import { renderKurve, renderTafelUrteil, tafelGilt } from "./56-tafel";
import { leerKnopf } from "./58-felder";
import {
  BEST_KEY_RX, besterPull, castOrder, classDps, cutCasts, dummyClass, looksLikeBestEntry, mergeBest, mergeEntries,
  mindestLaenge, pullWhen, rangfolge, rotLanes, sameEntry, verteilt, type Pull,
} from "../best-pull-core";
import { gleicherBezug } from "../build-core";
import { mitDatum } from "../verlauf-core";
import type { Encounter, Fight, SavedRun } from "../types";

/* ---------- Gegen deinen besten Pull ----------
   Spezifikation Fortschritt, Merkmal 1
   (docs/superpowers/specs/2026-09-24-fortschritt-design.md).

   Je Boss (histKey) und je Laenge an der Uebungspuppe haelt die App zwei
   Kaempfe fest: den besten und den zweitbesten, jeweils mit den Einsaetzen
   ihrer zwoelf staerksten Faehigkeiten. Zwei, nicht einer: ist der Kampf,
   den du ansiehst, selbst der beste, vergleicht der Knopf gegen den
   zweitbesten - und das ist genau der, den er verdraengt hat.

   Gespeichert in boro-best.json ueber /api/best (src/main/best.ts), nicht in
   boro-config.json: die wird bei jeder Einstellung ganz neu geschrieben, beim
   Livelog alle zwei Sekunden. Im Browser ohne Server lebt der Speicher nur
   in der Sitzung. */

/* Warum ein Kampf keinen besten Pull hat, als Kennung. */
type Grund = "sample" | "noClock" | "many" | "dummyShort" | "target" | "first";
/** Wofuer ein Kampf einen besten Pull haben kann - oder der Satz, warum nicht. */
type Wofuer = { key: string; label: string; cls: number | null } | { why: string; grund: Grund };

function wofuer(seg: Fight): Wofuer {
  const st = seg.stats;
  if(state.origin === "sample") return {why: t("best.whySample"), grund: "sample"};
  if(state.noTime) return {why: t("best.whyNoClock"), grund: "noClock"};
  /* Der Speicher ist je Boss, nicht je Person. Ein Log mit mehreren
     Angreifern (zusammen geladene Logs einer Gruppe) haette sonst die Summe
     aller als deinen besten Pull festgehalten. */
  if(state.players.length > 1) return {why: t("best.whyMany"), grund: "many"};
  if(practiceTarget(st.name)){
    const cls = dummyClass(st.seconds);
    if(cls == null) return {why: t("best.whyDummyShort", {len: dur(st.seconds)}), grund: "dummyShort"};
    return {key: "dummy:" + cls, label: t("best.dummyName", {s: cls}), cls};
  }
  if(!knownBoss(st.name)) return {why: t("best.whyTarget", {name: st.name}), grund: "target"};
  return {key: "boss:" + histKey(st.name), label: st.name, cls: null};
}

/* "segN" wie im Vergleich; an der Puppe "segN@60": derselbe Kampf, auf die
   Klassenlaenge geschnitten (cmpLauf in 28-compare.ts baut ihn so). Die
   Kennung beginnt mit "seg", damit segment() sie bei einem neuen Schnitt
   mit abraeumt - ihr N zeigt dann auf einen anderen Kampf. */
const segId = (i: number, cls: number | null) => "seg" + i + (cls ? "@" + cls : "");

function segDps(seg: Fight, cls: number | null){
  return cls ? classDps(seg.stats.seconds, seg.stats.dps, perSecond(seg, 0).total, cls) : seg.stats.dps;
}

/* Ist dieser Kampf der beste Pull nach der Regel (Spezifikation Bester
   Pull 3 und 4)? Fuer das Urteil ueber ihn selbst zaehlt er immer mit, auch
   als neuester unter Live (bossPulls mit "mit"); als Bezug fuer andere
   bleibt er draussen. Gold in der Einordnung (histVerdict, 32) und die
   Meldung nach dem Kampf (66) fragen hier, damit Satz und Schalter "nur
   Bestwert" dasselbe meinen. Ein Kampf, der nicht im geladenen Log steht,
   ist es nicht. menge: bossPulls(Schluessel, Index) dieses Kampfs, wenn der
   Aufrufer sie schon hat (histVerdict) - sonst wird sie hier geholt. */
export function waereBest(seg: Fight, menge?: readonly BossPull[]): boolean {
  const i = state.encounters.indexOf(seg);
  if(i < 0) return false;
  const w = wofuer(seg);
  if("why" in w) return false;
  return besterPull(menge ?? bossPulls(w.key, i))?.seg === i;
}

/* Die Menge fuer den besten Pull (Spezifikation Bester Pull 4): jeder Kampf
   am Boss im Verlauf, auch aus nur nachgelesenen Dateien (wie die Rekorde),
   dazu die Kaempfe des geladenen Logs, die dort noch fehlen. Gleiches at
   zaehlt einmal, der Kampf des Logs gewinnt. Der laufende Live-Kampf zaehlt
   erst, wenn er zu Ende ist (wie bestRecord). Kein Build, kein Paar.
   seg ist der Index in state.encounters, wenn der Kampf im geladenen Log steht.
   Ein Log mit Uhrzeit, aber ohne Datum (state.wall falsch) zaehlt nur fuer
   sich: seine Zeitpunkte sind Millisekunden seit Mitternacht und passen zu
   keinem Kampf im Verlauf.
   Dazu die zwei gespeicherten Pulls (boro-best.json), wenn der Verlauf sie
   nicht kennt (ein Verlauf, der spaeter begann oder verloren ging): sie sind
   Kaempfe am Boss wie jeder andere, und sie haben einen Lauf. */
export type BossPull = Pull & { file: string; seg: number | null };
/** Der Schluessel eines Kampfes nach Name und Laenge: "boss:<histKey>", "dummy:<Klasse>", sonst null. */
export function schluesselVon(name: string, seconds: number): string | null {
  if(practiceTarget(name)){ const c = dummyClass(seconds); return c == null ? null : "dummy:" + c; }
  return knownBoss(name) ? "boss:" + histKey(name) : null;
}
/* mit: der Index eines Kampfes in state.encounters, der auch als laufender
   Live-Kampf zaehlt - fuer das Urteil ueber genau diesen Kampf (waereBest). */
export function bossPulls(key: string, mit?: number): BossPull[] {
  if(state.origin === "sample" || state.noTime) return [];
  const raus = state.wall ? verzeichnisPulls(key) : new Map<number, BossPull>();
  const file = (state.fileNames || []).join(" + ");
  state.encounters.forEach((seg, i) => {
    // der laufende Live-Kampf: auch sein Stand im Verlauf zaehlt noch nicht
    if(i === 0 && isWatching() && i !== mit){ raus.delete(seg.start); return; }
    const w = wofuer(seg);
    if("why" in w || w.key !== key) return;
    raus.set(seg.start, {at: seg.start, dps: segDps(seg, w.cls), dur: seg.stats.seconds, ...(w.cls ? {c: w.cls} : {}), file, seg: i});
  });
  return [...raus.values()];
}
/** Der beste Pull am Schluessel nach der Regel (best-pull-core.ts), oder null. */
export const besterVon = (key: string) => besterPull(bossPulls(key));

/* Verzeichnis (alle Eintraege, auch nach) und die gespeicherten Pulls, deren
   at das Verzeichnis nicht kennt - der Teil der Menge, der nicht am
   geladenen Log haengt. Ohne die Summen einer Gruppe (g, histRecord): sie
   stehen im Verlauf, sind aber nie dein bester Pull (Entscheidung 06.10.). */
function verzeichnisPulls(key: string): Map<number, BossPull> {
  const raus = new Map<number, BossPull>();
  for(const [file, e] of Object.entries(state.hist.files)) for(const f of e.fights || []){
    const k = f.c ? "dummy:" + f.c : knownBoss(f.name) ? "boss:" + histKey(f.name) : null;
    // ohne Datum (mitDatum): ein alter Eintrag aus der Zeit vor dem Fix, er stuende am 01.01.1970
    if(k !== key || !Number.isFinite(f.at) || f.g || !mitDatum(f.at)) continue;
    raus.set(f.at, {at: f.at, dps: f.dps, dur: Number.isFinite(f.dur) ? f.dur : 0, ...(f.c ? {c: f.c} : {}), file, seg: null});
  }
  const e = state.best[key];
  const cls = key.startsWith("dummy:") ? +key.slice(6) : 0;
  for(const p of [e?.best, e?.second]) if(p && !raus.has(p.at))
    raus.set(p.at, {at: p.at, dps: p.run.dps, dur: p.run.seconds ?? 0, ...(cls ? {c: cls} : {}), file: p.file, seg: null});
  return raus;
}

/* Die Menge fuer das Gold im Verlauf (Spezifikation Bester Pull 5.4). Der
   Verlauf zeigt immer das ganze Verzeichnis, also haengt sein Gold nicht am
   geladenen Log: nicht am Beispielkampf, nicht an fehlender Uhr oder
   fehlendem Datum. Die Kaempfe des geladenen Logs, die im Verzeichnis
   stehen, sind dieselben Eintraege; der laufende Live-Kampf bleibt draussen
   wie in bossPulls. seg ist hier immer null. */
export function verlaufPulls(key: string): BossPull[] {
  const raus = verzeichnisPulls(key);
  const live = isWatching() && state.wall && !state.noTime ? state.encounters[0] : undefined;
  if(live) raus.delete(live.start);
  return [...raus.values()];
}

/* Die Kennung eines gespeicherten Pulls mit diesem at, oder null: dann hat
   der Pull keinen Lauf (Spezifikation Bester Pull 5.2, "ohne Lauf"). */
function gespeichertId(key: string, at: number): string | null {
  const e = state.best[key];
  if(e?.best.at === at) return "best|" + key + "|best";
  if(e?.second?.at === at) return "best|" + key + "|second";
  return null;
}

/** Wogegen der Kampf links verglichen werden kann, oder warum nicht. */
export interface BestInfo {
  why?: string;
  grund?: Grund;
  label?: string;
  curId?: string;
  refId?: string;
  refDps?: number;
  refAt?: number | null;
  isBest?: boolean;
  /* Der Bezug hat keinen Lauf (nur im Verlauf, Spezifikation Bester Pull
     5.2): der Name seiner Datei. refId hat dann die Form "ohne|<key>|<at>",
     die kein Vergleich kennt - wer einen Lauf braucht, fragt mitLauf(). */
  ohneLauf?: string;
}
/** Gibt es einen Bezug mit Lauf, gegen den sich vergleichen laesst? */
export function mitLauf(info: BestInfo): info is BestInfo & { refId: string } { return !!info.refId && !info.ohneLauf; }

/* "passt" grenzt die Kandidaten ein - die Analyse (bauBezug, unten) nimmt
   nur Pulls desselben Baus. Der Kampf links steht nie zur Wahl. */
export function bestInfo(passt?: (refId: string) => boolean): BestInfo {
  // die Gruppentafel misst die ganze Gruppe; ein bester Pull ist deiner
  if(state.group === "party") return {};
  const seg = state.encounters[state.sel];
  if(!seg) return {};
  const w = wofuer(seg);
  if("why" in w) return {why: w.why, grund: w.grund};
  const curId = segId(state.sel, w.cls);
  const menge = bossPulls(w.key);
  /* Der Bezug nach der Regel (best-pull-core.ts): der beste Pull; ist der
     gewaehlte selbst der beste, der zweite der Rangfolge. Ein gewaehlter
     unter der Schwelle wird gegen den besten verglichen, ist aber nie
     selbst der beste. passt grenzt ein (Analyse: Build) - die Schwelle
     bleibt die der ganzen Menge. Unter zwei Pulls am Boss gibt es keinen
     besten. Ein Pull ohne Lauf (nur im Verlauf) bleibt Bezug und bekommt
     die Kennung "ohne|..."; passt sieht ihn nie, die Analyse braucht einen Lauf. */
  const min = mindestLaenge(menge);
  const ids = (p: BossPull) => p.seg != null ? segId(p.seg, w.cls) : gespeichertId(w.key, p.at);
  const reihe = menge.length < 2 ? [] : rangfolge(menge, min).filter(p => {
    if(p.at === seg.start) return true;
    const id = ids(p);
    return !passt || (id != null && passt(id));
  });
  const istBest = reihe[0]?.at === seg.start;
  const ref = istBest ? reihe[1] : reihe[0];
  if(!ref) return {why: t("best.whyFirst", {boss: w.label}), grund: "first", label: w.label};
  const refId = ids(ref);
  /* Ohne Datum (state.wall falsch) ist at die Zeit seit Mitternacht; als
     Datum gelesen hiesse sie "01.01.". refAt null sagt "in diesem Log". */
  return {label: w.label, curId, refId: refId ?? "ohne|" + w.key + "|" + ref.at, refDps: ref.dps, refAt: state.wall ? ref.at : null,
          isBest: istBest, ...(refId ? {} : {ohneLauf: ref.file})};
}

/* Der Bezug innerhalb eines Waffenpaars: der beste Pull mit demselben Paar.
   Unbekanntes passt nie: ein Bezug ohne Paar ist kein Kandidat, sobald der
   Kampf selbst ein Paar hat - geraten wird nicht. Ist das Paar des Kampfs
   selbst unbekannt, bleibt es bei "alle". Die Analyse (53-fenster.ts:
   Fenster und Start) vergleicht so. */
export function bauBezug(hier: Bezug, alle: BestInfo): BestInfo {
  if(!hier) return alle;
  return bestInfo(id => { const dort = bezugVonRef(id); return !!dort && gleicherBezug(hier, dort); });
}

const refWhen = (at: number | null | undefined) => at != null ? pullWhen(at, state.lang) : t("best.thisLog");

/** Ein gespeicherter Pull als Lauf fuer den Vergleich, benannt nach Platz und Zeitpunkt. */
export function bestLauf(id: string): SavedRun | null {
  const m = /^best\|(.+)\|(best|second)$/.exec(id);
  if(!m) return null;
  const e = state.best[m[1]!];
  const p = e ? (m[2] === "best" ? e.best : e.second) : undefined;
  if(!p) return null;
  return {...p.run, id,
          tag: t(m[2] === "best" ? "best.tagBest" : "best.tagSecond", {when: pullWhen(p.at, state.lang)})};
}

/* Der Lauf, der festgehalten wird: derselbe wie beim Speichern, mit den
   Einsaetzen dazu, an der Puppe auf die Klassenlaenge geschnitten.
   Kennung leer - sonst zaehlte summarise() sie hoch, und derselbe Kampf
   saehe bei jedem Laden anders aus und wuerde jedes Mal neu geschrieben.
   Das Waffenpaar leer: summarise() nimmt es aus dem gerade gezeigten Kampf,
   festgehalten wird aber auch, was nicht gezeigt ist. Die Waffe je
   Faehigkeit steht in skills[].weapon und stimmt. */
function bestRun(seg: Fight, cls: number | null): SavedRun {
  let run: SavedRun = summarise(seg, "");
  run.id = "";
  run.mainWeapon = "";
  run.offWeapon = "";
  run.casts = partyEinsaetze(seg, true);
  if(cls){
    run = clip(run, cls);
    run.casts = run.casts && cutCasts(run.casts, cls * 1000);
  }
  return run;
}

/* Schreiben erst, wenn der Stand der Datei gelesen ist: sonst koennte ein
   frueher Schreibvorgang den Bestwert eines anderen Abends ueberschreiben.
   Scheitert das Lesen, wird nichts geschrieben, bis ein Lesen gelingt: die
   Seite fragt spaeter noch einmal (bestLaden), und was festzuhalten ist,
   wartet so lange in "offen". Eine Datei, die da ist, aber nicht gelesen
   werden kann (gesperrt, halb geschrieben, kaputt), beantwortet der Helfer
   mit 503 und ok:false - nie mit einem leeren Speicher. */
const offen = new Set<string>();
let schreibTimer: ReturnType<typeof setTimeout> | null = null;
let geladen = false;
let ladeTimer: ReturnType<typeof setTimeout> | null = null;
let ladeVersuch = 0;

function planeSchreiben(){
  /* Das Kompaktfenster schreibt keinen besten Pull (N4, Pruefung W3): sein
     Stand ist der vom Start, und putBest ersetzt je Boss - ein besserer Pull
     aus der Vollansicht ginge verloren. */
  if(!SERVED || KOMPAKT_FENSTER || !geladen || !offen.size || schreibTimer) return;
  schreibTimer = setTimeout(bestFlush, 3000);
}
/* Beim Schliessen (keepalive) teilen sich alle Anfragen zusammen 64 KiB,
   ein Eintrag darf aber bis 128 KB haben - ein Raidkampf hat um 50 000
   Zeichen. Eine Anfrage ueber der Grenze lehnt der Browser ab. Darum
   bekommt keepalive nur, was noch hineinpasst; der Rest geht als
   gewoehnliche Anfrage und kommt durch, wenn das Fenster nur verborgen
   wird. Geht er beim Schliessen verloren, haelt dasselbe Log ihn beim
   naechsten Laden wieder fest. */
const KEEPALIVE_BUDGET = 60000;
function bestFlush(keepalive = false){
  schreibTimer = null;
  const keys = [...offen];
  offen.clear();
  let rest = KEEPALIVE_BUDGET;
  for(const key of keys){
    const body = JSON.stringify({key, entry: state.best[key] ?? null});
    const bytes = new TextEncoder().encode(body).length;
    const halten = keepalive && bytes <= rest;
    if(halten) rest -= bytes;
    fetch("/api/best", {method: "POST", keepalive: halten, headers: {"Content-Type": "application/json"}, body})
      .then(r => { if(r.status === 503) nochmal(key); }, () => nochmal(key));
  }
}
/* 503: die Datei war gerade nicht lesbar oder nicht schreibbar; ein Fehler im
   Netz: der Helfer war nicht da. Beides kann vorbeigehen, also kommt der
   Schluessel zurueck nach "offen" - und geschrieben wird erst wieder nach
   einem gelungenen Lesen, denn was in der Datei steht, kann sich inzwischen
   geaendert haben. 400 (Schluessel, Groesse, Anzahl) und 413 bleiben so,
   wie sie sind: dieselbe Anfrage noch einmal aendert daran nichts. */
function nochmal(key: string){
  offen.add(key);
  if(!geladen) return;
  geladen = false;
  bestLaden();
}

/* Nach jedem Laden und jedem Wachstum des Logs (histRecord). Waehrend Live
   laeuft, zaehlt der neueste Kampf noch nicht: ein halb geschriebener Kampf
   mit starkem Anfang waere sonst kurz der beste und verdraengte den echten
   zweitbesten. Er kommt dran, sobald ein neuerer dazukommt oder Live endet
   (setWatching in 45-startup.ts). */
/* nur: Live rechnet nur neue oder veraenderte Kaempfe (loadTail in
   32-history.ts); ohne sie alle. Ein Kampf, der schon einmal hier war, gibt
   beim zweiten Mal dasselbe (sameEntry). */
export function bestRecord(nur?: ReadonlySet<Encounter> | null){
  if(state.origin === "sample" || state.noTime || !state.wall || state.players.length > 1) return;
  const file = (state.fileNames || []).join(" + ");
  let anders = false;
  /* Die Schwelle je Schluessel (Spezifikation Bester Pull 5.2): gespeichert
     werden die ersten beiden der Rangfolge ueber die ganze Menge, nicht die
     zwei hoechsten DPS. Je Schluessel einmal gerechnet - bossPulls geht
     ueber den ganzen Verlauf. An der Puppe ist die Klasse die Schwelle. */
  const schwelle = new Map<string, number>();
  state.encounters.forEach((seg, i) => {
    if(nur && !nur.has(seg)) return;
    if(i === 0 && isWatching()) return;
    const w = wofuer(seg);
    if("why" in w) return;
    const dps = segDps(seg, w.cls);
    if(!(dps > 0)) return;
    const e = state.best[w.key];
    const selbst = !!e && (e.best.at === seg.start || e.second?.at === seg.start);
    let min = schwelle.get(w.key);
    if(min == null){ min = w.cls ? 0 : mindestLaenge(bossPulls(w.key)); schwelle.set(w.key, min); }
    /* beide Plaetze besetzt, beide ab der Schwelle, und dieser nicht vor
       dem zweiten (weniger DPS, oder gleich viel und spaeter): nichts zu
       bauen. Die Schwelle waechst mit der Menge; ein Platz darunter wird
       darum jedes Mal neu entschieden (mergeBest). */
    const zweit = e?.second;
    if(e && zweit && !selbst && (e.best.run.seconds ?? 0) >= min && (zweit.run.seconds ?? 0) >= min &&
       (dps < zweit.run.dps || (dps === zweit.run.dps && seg.start >= zweit.at))) return;
    const neu = mergeBest(e, {run: bestRun(seg, w.cls), at: seg.start, file, ver: BORO_VERSION}, min);
    if(e && sameEntry(e, neu)) return;
    state.best[w.key] = neu;
    offen.add(w.key);
    anders = true;
  });
  planeSchreiben();
  /* Beim Laden eines Logs laeuft das hier vor dem Zeichnen (histRecord vor
     renderAll in loadText); dort ist das Neuzeichnen doppelt, aber harmlos.
     Wenn Live endet (setWatching), ist schon gezeichnet. Ein angehakter
     gespeicherter Pull traegt eine Kennung je Platz, nicht je Kampf - rueckt
     ein neuer Bestwert nach, stuende in der Auswahl sonst noch Name und DPS
     des alten. */
  if(!anders) return;
  syncBestBtn();
  tafelBezug();
  if(state.tab === "compare") renderCompare();
}

/* Was die Datei weiss, zusammen mit dem, was diese Sitzung schon gesehen hat.
   Bei demselben Kampf gewinnt die Sitzung: sie hat ihn eben gelesen.
   Jeder Eintrag wird geprueft, bis in die Faehigkeiten (looksLikeBestEntry,
   best-pull-core.ts); was nicht traegt, wird uebergangen, nie geworfen. */
function bestLaden(){
  if(!SERVED || geladen || ladeTimer) return;
  fetch("/api/best").then(r => r.ok ? r.json() : null).then((d: { ok?: unknown, best?: unknown } | null) => {
    /* Nur ein ausdrueckliches ok mit einem Objekt ist der Stand der Datei.
       Alles andere - 503, ein anderer Status, eine Antwort ohne best - ist
       ein gescheitertes Lesen, kein leerer Speicher. */
    if(!d || d.ok !== true || !d.best || typeof d.best !== "object" || Array.isArray(d.best)){
      spaeterLaden();
      return;
    }
    ladeVersuch = 0;
    const alle = d.best as Record<string, unknown>;
    for(const [key, roh] of Object.entries(alle)){
      /* Dieselbe Schluesselregel wie beim Schreiben (src/main/best.ts). Ein
         "__proto__" aus einer von Hand bearbeiteten Datei faende sonst einen
         Prototyp als "hier", mergeEntries wuerfe, und die ganze Sitzung
         schriebe nichts mehr. state.best hat dazu keinen Prototyp. */
      if(!BEST_KEY_RX.test(key)) continue;
      if(!looksLikeBestEntry(roh, looksLikeRun)) continue;
      const hier = state.best[key];
      // dieselbe Schwelle wie bestRecord, ueber die ganze Menge am Schluessel
      const neu = hier ? mergeEntries(roh, hier, key.startsWith("dummy:") ? 0 : mindestLaenge(bossPulls(key))) : roh;
      state.best[key] = neu;
      if(hier && !sameEntry(neu, roh)) offen.add(key);
    }
    geladen = true;
    planeSchreiben();
    syncBestBtn();
    tafelBezug();
    if(state.tab === "compare") renderCompare();
  }).catch(() => spaeterLaden());
}
/* Noch einmal lesen, mit wachsendem Abstand: 5 s, 10 s, 20 s, dann jede
   Minute. Eine gesperrte Datei ist meist nach Sekunden wieder frei; eine
   kaputte bleibt kaputt, und dann ist eine Anfrage je Minute an den eigenen
   Helfer genug. Geschrieben wird bis dahin nichts. */
function spaeterLaden(){
  if(ladeTimer) return;
  const warte = Math.min(60000, 5000 * 2 ** ladeVersuch);
  ladeVersuch++;
  ladeTimer = setTimeout(() => { ladeTimer = null; bestLaden(); }, warte);
}

/* Die Tafel im Bereich Kampf liest denselben Bezug: kommt der Stand der
   Datei spaet (oder nach einem Wiederholen) oder rueckt ein neuer Bestwert
   nach, folgen die gestrichelte Linie und das Urteil ohne Zutun. Beide
   zeichnen nur, wenn sich ihr Schluessel aendert. */
function tafelBezug(){
  if(!tafelGilt()) return;
  renderKurve();
  renderTafelUrteil();
}

/** "Im Vergleich" im Urteil der Tafel (Neugestaltung 28.09., DECISION 2.5;
    frueher "Gegen deinen besten Pull" im Kampfkopf): da, wenn es einen Bezug
    gibt, sonst verborgen. Der Name enthaelt den sichtbaren Text (WCAG 2.5.3)
    und sagt, wogegen verglichen wird; der title nennt den Bezug. */
export function syncBestBtn(){
  const b = document.querySelector<HTMLButtonElement>("#btnBestPull");
  if(!b) return;
  const info = bestInfo();
  /* Ohne Lauf (ohneLauf) gibt es nichts zu vergleichen. Statt dieses
     Knopfs stehen im Urteil der Satz und "Log oeffnen" (ohneLaufHtml in
     56-tafel.ts, Spezifikation Bester Pull 5.2). */
  b.hidden = !mitLauf(info);
  if(!mitLauf(info)) return;
  b.setAttribute("aria-label", t(info.isBest ? "tafel.imVergleichNameZweit" : "tafel.imVergleichName"));
  b.title = t(info.isBest ? "best.btnTitleSecond" : "best.btnTitle",
              {boss: info.label, dps: fmt(info.refDps), when: refWhen(info.refAt)});
  const text = t("tafel.imVergleich");
  if(b.textContent !== text) b.textContent = text;
}

/* Ein Klick ersetzt die Haken durch genau zwei: der beste Pull zuerst - er
   ist die Referenz, gegen ihn misst der Vergleich -, dann der Kampf links.
   "Auf gleiche Laenge kuerzen" steht danach aus; an der Puppe sind beide
   ohnehin schon auf die Klassenlaenge geschnitten. Der Fokus geht auf den
   Antwortsatz oben im Ergebnis (Kritik 25.09.): er sagt, was der Knopf
   versprochen hat. */
function openBestCompare(){
  const info = bestInfo();
  if(!info.curId || !mitLauf(info)) return;
  state.cmpRuns = new Set([info.refId, info.curId]);
  state.cmpPaar = "best";   // der Umschalter im Vergleich (28-compare.ts) steht auf "Bester Pull"
  state.clipRuns = false;
  syncCompareBtn();
  renderRuns();
  switchTab("compare");
  zurAntwort();
}

/* Wie switchTab(..., true) den Bereich in den Blick holt: der Anfang
   kommt direkt unter die klebende Titelleiste, sonst laege er unter ihr
   verdeckt. Gerollt wird zum Anfang des Reiters, nicht zum Satz: darueber steht der
   zugeklappte Knopf "Andere Kaempfe waehlen", und der soll sichtbar bleiben.
   Der Fokus rollt nicht selbst mit: er braeche das weiche Rollen ab. */
function zurAntwort(){
  // die klebende Leiste ist seit der Instrumententafel die Titelleiste (top 0)
  const kopf = document.querySelector<HTMLElement>(".top");
  const anfang = document.querySelector<HTMLElement>("#cmpBody");
  const satz = document.querySelector<HTMLElement>("#cmpLead");
  if(!kopf || !anfang || !satz) return;
  const kante = kopf.offsetHeight;
  const weich = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollBy({top: anfang.getBoundingClientRect().top - kante, behavior: weich ? "smooth" : "auto"});
  satz.focus({preventScroll: true});
}

/** Ist der Vergleich genau "bester Pull (Referenz) gegen den Kampf links"? */
export function gegenBestAktiv(info: BestInfo): boolean {
  return mitLauf(info) && !!info.curId && state.cmpRuns.size === 2 &&
    [...state.cmpRuns][0] === info.refId && state.cmpRuns.has(info.curId);
}

/* Die Namen der zwei Spalten in diesem Fall. "Vulcanus 21:00:00" gegen
   "Bester Pull · 23.09. 21:00" liess raten, welcher der eigene ist; jetzt
   heisst der eine nach dem, was er ist, und der andere "Dieser Kampf".
   Das Datum wie in der Zeile ueber der Auswahl (refWhen). */
export function bestNamen(info: BestInfo): [string, string] {
  return [t(info.isBest ? "best.colRefSecond" : "best.colRef", {when: refWhen(info.refAt)}), t("best.colThis")];
}
/* Derselbe Bezug im Satz: "gegen Bester Pull (23.09. 21:00) gemessen" las
   sich wie ein Etikett mitten im Satz (Kritik 25.09.). In "Jede Aenderung
   ist gegen ... gemessen" und "Gesamt, gegen ..." steht er darum gebeugt. */
export function bestBezug(info: BestInfo): string {
  return t(info.isBest ? "best.refAccSecond" : "best.refAcc", {when: refWhen(info.refAt)});
}

/* Der Antwortsatz oben im Ergebnis, statt "X gewinnt auf DPS": wie weit du
   vom Bezug weg bist und welche Faehigkeit den groessten Teil davon traegt.
   Dieselben Zahlen, die die Seite darunter zeigt - der Prozentwert wie der
   Chip im Feld, der Abstand wie "Gesamt, gegen", die Faehigkeit wie die
   Zeilen in "Woher der Unterschied kommt"; verteilt er sich dort, sagt der
   Satz das auch und nennt keine. Unter 5 % gilt die Regel des
   Vergleichs: kein Urteil, und dann auch keine Faehigkeit, die "fehlt".
   Ohne Wertung: kein "leider", keine Farbe. */
export function bestAntwort(info: BestInfo, o: { rel: number; relShown: number; tie: boolean; gap: number;
                                                  deltas: { n: string; d: number }[] }): string {
  const when = info.refAt != null
    ? t("best.leadFrom", {day: pullWhen(info.refAt, state.lang).split(" ")[0]}) : t("best.thisLog");
  const ref = t(info.isBest ? "best.refSecond" : "best.refBest");
  const vars = {boss: info.label, when, ref, pct: o.relShown, gap: fmt(Math.abs(o.gap), 1e3)};
  if(o.tie) return t("best.leadTie", vars);
  const drunter = o.rel < 0;
  return antwortSchluss(t(drunter ? "best.leadBelow" : info.isBest ? "best.leadIsBest" : "best.leadAbove", vars), drunter, o.deltas);
}
/* Das Ende des Antwortsatzes: die Faehigkeit, die den Abstand traegt, oder
   dass er sich verteilt. Auch fuer den Satz gegen den letzten Pull
   (Neugestaltung 28.09., Luecken 5.2, 28-compare.ts). */
export function antwortSchluss(satz: string, drunter: boolean, deltas: { n: string; d: number }[]): string {
  if(!deltas.length) return satz + t("best.leadEnd");
  /* Verteilt sich der Abstand, sagt "Woher der Unterschied kommt" darunter
     genau das - dann nennt auch der Satz keine einzelne Faehigkeit. Dieselbe
     Regel (verteilt, best-pull-core.ts), damit beide nie auseinanderlaufen. */
  if(verteilt(deltas)) return satz + t("best.leadSpread");
  // die Faehigkeit mit dem groessten Abstand in die Richtung des Ganzen
  const x = deltas.filter(z => drunter ? z.d < 0 : z.d > 0)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  if(!x) return satz + t("best.leadEnd");
  return satz + t(drunter ? "best.leadShort" : "best.leadMore",
                  {skill: x.n, d: (drunter ? "\u2212" : "+") + fmt(Math.abs(x.d), 1e3)});
}

/* Der Haken fuer Merkmal 2: stammt der Vergleichspull von einem anderen
   Waffenpaar als der Kampf links, sagt dieser Satz das (47-paar.ts,
   bauHinweisSatz). Kennt die App eines der beiden nicht, bleibt er
   leer - geraten wird nicht. Ein gespeicherter Pull traegt die Faehigkeiten
   mit ihrer Waffe im Lauf, auch alte Bestwerte lassen sich also einordnen. */
function bauHinweis(info: BestInfo): string {
  return mitLauf(info) ? bauHinweisSatz(info.refId, !!info.isBest) : "";
}

/** Die Zeile ueber der Auswahl im Vergleich: Satz und Knopf, oder der Satz, warum nicht. */
export function bestZeile(): string {
  if(!state.encounters.length) return "";
  const info = bestInfo();
  /* Mit dem Beispiel sagt die Zeile, was hier erscheinen wird, und traegt den
     Knopf, der es moeglich macht; dass das Beispiel nicht zaehlt, steht
     einmal in der Kopfzeile (Kritik 28.09.). */
  if(info.grund === "sample") return '<p class="cmpstate cmpbest" id="cmpBest" tabindex="-1"><span>' + esc(info.why || "") + "</span> " +
    leerKnopf("open") + "</p>";
  if(info.why) return '<p class="cmpstate cmpbest" id="cmpBest" tabindex="-1">' + esc(info.why) + "</p>";
  if(!mitLauf(info) || !info.curId) return "";
  const vars = {boss: info.label, dps: fmt(info.refDps), when: refWhen(info.refAt)};
  /* Aktiv nur in der Reihenfolge des Knopfs, denn der erste Haken ist die
     Referenz. Dann sagt der Antwortsatz im Ergebnis, womit verglichen wird;
     hier bleibt nur der Hinweis auf einen anderen Build, falls es einen gibt.
     "Bezug tauschen" gibt es hier nicht (#35); nimmt man einen Haken ab,
     bietet die Zeile den Knopf wieder an. */
  if(gegenBestAktiv(info)){
    const bau = bauHinweis(info).trim();
    return bau ? '<p class="cmpstate cmpbest" id="cmpBest"><span>' + esc(bau) + "</span></p>" : "";
  }
  const satz = t(info.isBest ? "best.lineIsBest" : "best.lineReady", vars) + bauHinweis(info);
  return '<p class="cmpstate cmpbest" id="cmpBest" tabindex="-1"><span>' + esc(satz) + "</span>" +
    ' <button class="btn sm" id="cmpBestBtn">' + esc(t(info.isBest ? "best.btnSecond" : "best.btn")) + "</button>" +
    "</p>";
}
export function bestZeileBinden(){
  const b = document.querySelector<HTMLElement>("#cmpBestBtn");
  if(b) b.onclick = openBestCompare;
}

/* ---------- Rotation nebeneinander ----------
   Bei genau zwei Kaempfen: je Faehigkeit eine Spur mit zwei Zeilen, oben der
   Bezug (der zuerst angehakte - beim besten Pull er), unten der zweite. Eine
   Marke je Einsatz in der Reihenfarbe; dieselbe Sprache wie die Spuren im
   Reiter Rotation, aber aus Elementen statt auf einer Leinwand, damit sie
   jedem Thema ohne Neuzeichnen folgt. Die Spuren sind fuer Vorleser
   verborgen; was sie sagen, steht im Satz darueber und in der Liste darunter.

   Standard sind die ersten 60 s: dort liegt der Opener, und dort
   unterscheiden sich zwei Pulls am deutlichsten. Der ganze Kampf ist einen
   Klick entfernt. Fehlen einem Kampf die Einsaetze - ein von Hand
   gespeicherter Kampf traegt nur Summen -, sagt die Karte das, statt eine
   halbe Rotation zu zeigen. */
/* farbe: die Farbe je Faehigkeit des ganzen Vergleichs (cmpFarben in
   28-compare.ts), damit eine Spur dieselbe Farbe hat wie ihr Balken und wie
   die Faehigkeit in der Schadenstafel. Ohne sie der Rang der Spur. */
/* o.zu: zugeklappt hinter ihrer Ueberschrift - gegen den besten oder den
   letzten Pull (Neugestaltung 28.09., DECISION 5.7: was der Entwurf nicht
   zeigt, bleibt hinter einem Aufklapper); aufgeklappt bleibt sie, bis man
   sie wieder zuklappt (cmpRotOffen). Solange niemand geklappt hat, steht sie
   ab 1200 Punkt Fensterhoehe offen: grosse Fenster nutzen die Hoehe
   (Spezifikation 1, Pruefung 29.09., Befund 10). o.namen: die Namen des Paars. */
let cmpRotOffen: boolean | null = null;
export function cmpRotation(picks: SavedRun[], gemischt: boolean, best?: BestInfo,
                            farbe?: (s: {name: string; sid?: string | undefined}) => string,
                            o: { zu?: boolean; namen?: [string, string] } = {}): string {
  if(picks.length !== 2) return "";
  const a = picks[0]!, b = picks[1]!;
  // gegen den besten Pull tragen beide die Namen des ganzen Vergleichs (bestNamen)
  const namen = best ? bestNamen(best) : o.namen ?? null;
  const name = (p: SavedRun) => namen ? namen[p === a ? 0 : 1] : p.tag || p.name;
  const titel = "<h3>" + esc(t("cmprot.title")) + "</h3>";
  /* Bei verschiedenen Bossen zugeklappt, wie "Woher der Unterschied kommt":
     die Reihenfolge eines anderen Bosses ist keine Aussage ueber deine. */
  const karte = (inhalt: string) => '<div class="card cmprot" id="cmpRot">' +
    (gemischt || o.zu ? '<details class="fold"' + (o.zu && (cmpRotOffen ?? innerHeight >= 1200) ? " open" : "") + "><summary>" + titel + "</summary>" + inhalt + "</details>"
              : titel + inhalt) + "</div>";
  const fehlt = [a, b].find(p => !p.casts || !p.casts.length);
  if(fehlt) return karte('<p class="cmpsub">' + esc(t("cmprot.missing", {name: name(fehlt)})) + "</p>");
  const ca = a.casts ?? [], cb = b.casts ?? [];
  const kurz = Math.min(a.seconds, b.seconds);
  const erst = Math.min(60, kurz);
  const span = state.cmpRotAll ? kurz : erst;
  const spanMs = span * 1000;
  const lanes = rotLanes(ca, cb, spanMs, 12);
  const nA = lanes.reduce((s, l) => s + l.a.length, 0), nB = lanes.reduce((s, l) => s + l.b.length, 0);
  // "In den ersten 3:05" passt nicht, wenn "Ganzer Kampf" gewaehlt ist
  // im Satz klein und gebeugt, wie der Bezug oben; die Legende behaelt die Etiketten
  let satz = (best ? t(best.isBest ? "best.rotRowsSecond" : "best.rotRows", {when: refWhen(best.refAt)})
                   : t("cmprot.rows", {A: name(a), B: name(b)})) +
    /* "In den ersten 1m 0s" las sich wie ein Messfehler; der Knopf darunter
       sagt "Erste 60 s" - der Satz sagt es genauso. */
    (span > erst ? t("cmprot.sumAll", {span: dur(span), a: nA, b: nB})
                 : t("cmprot.sum", {span: Math.round(span) + "\u00a0s", a: nA, b: nB}));
  // die staerkste Faehigkeit des Bezugs, wenn sie um eine Sekunde oder mehr anders zum ersten Mal kam
  const lead = lanes[0];
  if(lead && lead.a.length && lead.b.length && Math.abs(lead.a[0]! - lead.b[0]!) >= 1000)
    satz += t("cmprot.firstDiff", {skill: skillLabel(lead.name, lead.sid),
                                   ta: secs1(lead.a[0]! / 1000), tb: secs1(lead.b[0]! / 1000)});
  const knopf = (all: boolean, text: string) =>
    '<button type="button" data-all="' + (all ? 1 : 0) + '"' + (state.cmpRotAll === all ? ' class="on"' : "") +
    ' aria-pressed="' + (state.cmpRotAll === all) + '">' + esc(text) + "</button>";
  const wahl = kurz > erst + 0.5
    ? '<div class="seg" role="group" aria-label="' + esc(t("cmprot.span")) + '">' +
      knopf(false, t("cmprot.first", {s: Math.round(erst)})) + knopf(true, t("cmprot.whole", {len: dur(kurz)})) + "</div>"
    : "";
  const links = (ms: number) => (100 * ms / spanMs).toFixed(2);
  const marken = (liste: number[], farbe: string) =>
    liste.map(ms => '<i style="left:' + links(ms) + "%;--c:" + farbe + '"></i>').join("");
  /* Die Legende ueber den Spuren (Kritik 25.09.): welche Zeile in jeder
     Spur welcher Kampf ist, und was die zwei Zahlen neben dem Namen zaehlen.
     Der Satz darueber sagt es auch; die Legende steht dort, wo man schaut.
     Fuer Vorleser verborgen - fuer sie traegt der Satz. */
  let gitter = '<div class="crn crkopf" aria-hidden="true"><em></em><u>' + esc(t("cmprot.keyCount")) + "</u></div>" +
    '<div class="crkey" aria-hidden="true"><span><i class="ka"></i>' + esc(t("cmprot.keyTop", {name: name(a)})) + "</span>" +
    '<span><i class="kb"></i>' + esc(t("cmprot.keyBottom", {name: name(b)})) + "</span></div>";
  lanes.forEach((l, i) => {
    const f = farbe ? farbe({name: l.name, sid: l.sid}) : seriesColor(i);
    gitter += '<div class="crn">' + skillMark(l.name, l.sid, f, false) +
      "<em>" + esc(skillLabel(l.name, l.sid)) + "</em><u>" + l.a.length + " · " + l.b.length + "</u></div>" +
      '<div class="crspur" aria-hidden="true"><div class="cra">' + marken(l.a, f) + "</div>" +
      '<div class="crb">' + marken(l.b, f) + "</div></div>";
  });
  const folge = (liste: typeof ca) => castOrder(liste, spanMs, 12).map(c =>
    "<li>" + esc(skillLabel(c.name, c.sid)) + ' <span class="num">' + esc(secs1(c.t / 1000)) + "</span></li>").join("");
  const reihe = '<details class="fold crfolge"><summary>' + esc(t("cmprot.order", {n: 12})) + "</summary>" +
    '<div class="crfolgen"><div><h4>' + esc(name(a)) + "</h4><ol>" + folge(ca) + "</ol></div>" +
    "<div><h4>" + esc(name(b)) + "</h4><ol>" + folge(cb) + "</ol></div></div></details>";
  return karte('<p class="cmpsub">' + esc(satz) + "</p>" + wahl + '<div class="crgrid">' + gitter + "</div>" + reihe);
}
export function cmpRotationBinden(){
  document.querySelector<HTMLDetailsElement>("#cmpRot > details")?.addEventListener("toggle", e => {
    cmpRotOffen = (e.currentTarget as HTMLDetailsElement).open;
  });
  document.querySelectorAll<HTMLElement>("#cmpRot .seg button").forEach(b => b.onclick = () => {
    state.cmpRotAll = b.dataset.all === "1";
    renderCompare();
    // die Karte ist neu gebaut; der Fokus bleibt auf dem Knopf, der gedrueckt wurde
    document.querySelector<HTMLElement>('#cmpRot .seg button[data-all="' + b.dataset.all + '"]')?.focus();
  });
}
// what this part did at the top level, run where it stands in the order
export function setup(): void {
  $("#btnBestPull").onclick = openBestCompare;
  // wer das Fenster schliesst, waehrend noch geschrieben werden soll (Grenze: bestFlush)
  addEventListener("pagehide", () => {
    if(!schreibTimer) return;
    clearTimeout(schreibTimer);
    bestFlush(true);
  });
  bestLaden();
}
