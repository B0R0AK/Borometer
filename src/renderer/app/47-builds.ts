import { state } from "./01-state";
import { stats } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { weaponLabel } from "./09-weapon-icons";
import { skillKey } from "./10-skill-names";
import { skillIds, weaponFor } from "./16-fight-analysis";
import { renderRotation } from "./25-rotation";
import { renderCompare } from "./28-compare";
import { histRecord } from "./32-history";
import { KOMPAKT_FENSTER, SERVED } from "./41-server-mode";
import { AUTO_OFF_MIN, handPair } from "./42-party";
import { isWatching } from "./45-startup";
import { renderBuilds } from "./51-plan";
import { sitzungUebernehmen, wahlSetzen, type RotWahl } from "../rotation-core";
import {
  BAU_ID_RX, BAU_ROT_MAX, bauPasst, bauId, bauNummern, findBau, fingerprint, looksLikeBau, sameBau, type BauSkill, type Fingerprint,
} from "../build-core";
import type { Bau, Fight, SavedRun } from "../types";

/* ---------- Bautagebuch ----------
   Spezifikation Fortschritt, Merkmal 2
   (docs/superpowers/specs/2026-09-24-fortschritt-design.md).

   Ein Bau ist, was das Log hergibt: das Waffenpaar und die Faehigkeiten,
   die zusammen 80 % des Schadens machen (build-core.ts). Nie Ausruestung,
   Werte, Runen oder Traits - davon steht nichts im Log. Jeder Kampf an
   einem bekannten Boss und jeder Versuch an der Uebungspuppe mit
   Laengenklasse bekommt im Verlaufsverzeichnis die Kennung seines Baus (b,
   histRecord in 32-history.ts); die Baue selbst stehen in boro-builds.json
   ueber /api/builds (src/main/builds.ts). Im Browser ohne Server leben sie
   nur in der Sitzung.

   Ein Name bleibt auf diesem Rechner: nichts hiervon geht ins Board, in
   ein Gruppen-Log oder in den Fehlerbericht (safety-audit.mjs prueft das).
   Seit Aufgabe 12 der Neugestaltung (29.09.) zeigt der Bereich Builds keine
   erkannten Baue mehr, sondern Links zu Questlog (51-plan.ts); die Erkennung
   bleibt: sie gibt jedem Kampf seine Waffen (die Karten zaehlen ueber sie),
   traegt die Wahlen von "Deine Rotation" und den Hinweis im Vergleich.
   Name und Kern eines gespeicherten Baus bleiben in boro-builds.json, wie
   sie sind, und werden nicht mehr angezeigt; ein Bau mit Link ohne passenden
   Eintrag in boro-plans.json steht als Karte im Bereich Builds (Fixrunde 1
   zu Aufgabe 12) und laesst sich dort loesen (bauLoesen, Feld
   geloest - nie geloescht). */

/* Die Skill-IDs eines Kampfes, gemerkt: histRecord laeuft beim Livelog alle
   zwei Sekunden ueber alle Kaempfe, und skillIds() geht jedes Mal durch
   alle Ereignisse. Ein Kampf, der nicht mehr waechst, hat dieselben. */
const idsMerk = new Map<string, Map<string, Set<string>>>();
function idsVon(seg: Fight){
  const k = seg.start + "|" + seg.end + "|" + seg.events.length;
  let ids = idsMerk.get(k);
  if(!ids){
    if(idsMerk.size > 400) idsMerk.clear();
    ids = skillIds(seg) as Map<string, Set<string>>;
    idsMerk.set(k, ids);
  }
  return ids;
}

/** Die Faehigkeiten eines Kampfes in der Form des Kerns, oder null, wo es keinen Bau zu erkennen gibt. */
export function bauSkills(seg: Fight): { skills: BauSkill[]; total: number } | null {
  // ohne Uhr keine Rate, mit mehreren Angreifern nicht deiner
  if(!seg || state.noTime || state.players.length > 1) return null;
  const st = seg.stats || stats(seg);
  const ids = idsVon(seg);
  return {total: st.total, skills: st.skills.map(k => {
    const sid = [...(ids.get(k.name) || [])][0] || "";
    return {key: skillKey(k.name, sid), weapon: weaponFor(k.name, sid), damage: k.damage};
  })};
}
/** Der Fingerabdruck eines Kampfes des geladenen Logs, oder null, wo es keinen Bau zu erkennen gibt. */
export function bauVon(seg: Fight): Fingerprint | null {
  const s = bauSkills(seg);
  return s ? fingerprint(s.skills, s.total, AUTO_OFF_MIN, handPair()) : null;
}

/* Ein gespeicherter Lauf (ein bester Pull aus boro-best.json): die Waffe je
   Faehigkeit steht seit jeher darin (summarise). */
function bauVonLauf(run: SavedRun): Fingerprint | null {
  const skills: BauSkill[] = (run.skills || []).map(k => ({
    key: skillKey(k.name, k.sid), weapon: k.weapon || weaponFor(k.name, k.sid), damage: k.damage || 0}));
  return fingerprint(skills, run.total, AUTO_OFF_MIN, handPair());
}

/* ---------- Speicher ----------
   Dasselbe Muster wie bei den besten Pulls (46-best-pull.ts): geschrieben
   wird erst, wenn der Stand der Datei gelesen ist; scheitert das Lesen
   (503), schreibt die Seite nichts und fragt spaeter noch einmal. Vorher
   legt sie auch keine Baue an (bauFuer) - sonst bekaeme ein Bau, den die
   Datei laengst kennt, eine zweite Kennung. */
const offen = new Set<string>();
let schreibTimer: ReturnType<typeof setTimeout> | null = null;
let geladen = false;
let ladeTimer: ReturnType<typeof setTimeout> | null = null;
let ladeVersuch = 0;
const schreibbar = () => !SERVED || geladen;
/* Zaehlt jede Aenderung an state.builds (hier die einzige Stelle, die sie
   aendert): "Deine Rotation" (53) zeichnet unter Live nur neu, wenn sich
   etwas geaendert hat, und fragt dafuer diese Zahl statt alle Builds zu
   vergleichen. */
let bauRev = 0;
export const bauRevision = () => bauRev;

function planeSchreiben(sofort = false){
  // das Kompaktfenster schreibt keine Builds (N4, Pruefung W3), siehe bauFuer
  if(!SERVED || KOMPAKT_FENSTER || !geladen || !offen.size) return;
  if(sofort && schreibTimer){ clearTimeout(schreibTimer); schreibTimer = null; }
  if(schreibTimer) return;
  schreibTimer = setTimeout(bauFlush, sofort ? 0 : 3000);
}
/* Ein Bau hat ein paar hundert Zeichen; keepalive (beim Schliessen) teilt
   sich 64 KiB, das reicht fuer weit mehr, als eine Sitzung aendert. Die
   Grenze steht trotzdem da, wie in 46-best-pull.ts. */
const KEEPALIVE_BUDGET = 60000;
function bauFlush(keepalive = false){
  schreibTimer = null;
  const ids = [...offen];
  offen.clear();
  let rest = KEEPALIVE_BUDGET;
  for(const id of ids){
    const build = state.builds[id];
    if(!build) continue;
    const body = JSON.stringify({id, build});
    const halten = keepalive && body.length <= rest;
    if(halten) rest -= body.length;
    fetch("/api/builds", {method: "POST", keepalive: halten, headers: {"Content-Type": "application/json"}, body})
      // 400 (mehr als 200 Baue, oder die Form stimmte nicht): der Bau lebt in der Sitzung weiter
      .then(r => { if(r.status === 503) nochmal(id); }, () => nochmal(id));
  }
}
/* 503 oder kein Helfer: vielleicht gleich wieder da. Geschrieben wird erst
   nach einem neuen, gelungenen Lesen. */
function nochmal(id: string){
  offen.add(id);
  if(!geladen) return;
  geladen = false;
  bauLaden();
}

function bauLaden(){
  if(!SERVED || geladen || ladeTimer) return;
  fetch("/api/builds").then(r => r.ok ? r.json() : null).then((d: { ok?: unknown; builds?: unknown } | null) => {
    // nur ein ausdrueckliches ok mit einem Objekt ist der Stand der Datei
    if(!d || d.ok !== true || !d.builds || typeof d.builds !== "object" || Array.isArray(d.builds)){
      spaeterLaden();
      return;
    }
    ladeVersuch = 0;
    for(const [id, roh] of Object.entries(d.builds as Record<string, unknown>)){
      // dieselbe Regel wie beim Schreiben (src/main/builds.ts); was nicht traegt, wird uebergangen
      if(!BAU_ID_RX.test(id) || !looksLikeBau(roh)) continue;
      /* Was diese Sitzung schon hat, gewinnt: ein Name, der gespeichert
         wurde, waehrend nach einem 503 neu gelesen wurde. */
      if(!state.builds[id]){ state.builds[id] = roh; bauRev++; }
    }
    geladen = true;
    planeSchreiben();
    // jetzt erst bekommen die Kaempfe des geladenen Logs ihre Baukennung
    if(state.text && state.origin !== "sample") histRecord();
    neuZeichnen();
  }).catch(() => spaeterLaden());
}
function spaeterLaden(){
  if(ladeTimer) return;
  const warte = Math.min(60000, 5000 * 2 ** ladeVersuch);
  ladeVersuch++;
  ladeTimer = setTimeout(() => { ladeTimer = null; bauLaden(); }, warte);
}

function neuZeichnen(){
  // die Karten im Bereich Builds zaehlen ueber die Waffen der Baue (51-plan.ts)
  if(state.tab === "builds") renderBuilds();
  // "Deine Rotation" haengt am Build des Kampfes (54-deine-rotation.ts: die Wahl je Faehigkeit)
  if(state.tab === "rotation") renderRotation();
  // die Zeile zum besten Pull nennt den Bau des Bezugs
  if(state.tab === "compare") renderCompare();
}

/* Die Kennung fuer das Verlaufsverzeichnis (histRecord). Ein bekannter Bau,
   dem der Kampf gleicht, oder ein neuer. Waehrend Live laeuft, legt der
   neueste Kampf keinen neuen Bau an: ein halber Kampf hat andere tragende
   Faehigkeiten als ein ganzer. Er bekommt seine Kennung, sobald er steht
   (setWatching in 45-startup.ts ruft histRecord noch einmal). */
export function bauFuer(seg: Fight, i: number): string | null {
  /* Im Kompaktfenster keine neuen Builds (N4, Pruefung W3): es kennt nur
     die Builds von seinem Start und legte einen aus der Vollansicht neu an. */
  if(KOMPAKT_FENSTER || state.origin === "sample" || !state.wall || !schreibbar()) return null;
  const fp = bauVon(seg);
  if(!fp) return null;
  const da = findBau(fp, state.builds);
  if(da) return da;
  if(i === 0 && isWatching()) return null;
  const id = bauId(fp);
  // dieselbe Kennung fuer einen Bau, der diesem nicht gleicht: nicht raten
  if(state.builds[id]) return null;
  state.builds[id] = {name: "", weapons: fp.weapons, core: fp.core, first: seg.start};
  bauRev++;
  offen.add(id);
  planeSchreiben();
  return id;
}

/* ---------- Deine Rotation (54-deine-rotation.ts) ----------
   Die Wahlen je Faehigkeit ("Stimmt", "Druecke ich selbst", ...) stehen am
   Build (Bau.rot) und gehen ueber denselben Weg wie ein Name: offen,
   planeSchreiben, POST /api/builds, putBuild prueft. Kein eigener Speicher. */

/** Der bekannte Build eines Kampfes, an den eine Wahl geschrieben wird - oder null (dann gilt sie in der Sitzung). */
export function rotBauVon(seg: Fight): string | null {
  // nur mit dem Helfer: im Browser ohne App lebt ein Build ohnehin nur in der Sitzung
  if(!SERVED || state.origin === "sample" || !state.wall) return null;
  // der wachsende neueste Kampf unter Live: seine tragenden Faehigkeiten stehen noch nicht
  if(seg === state.encounters[0] && isWatching()) return null;
  const fp = bauVon(seg);
  return fp ? findBau(fp, state.builds) : null;
}
/* Eine Wahl an einen Build schreiben. "voll": ein neuer Schluessel ueber
   BAU_ROT_MAX; "abgelehnt": der Build naehme sie nicht an (putBuild: Form,
   Schluessel, Groesse) - in beiden Faellen wird nichts geschrieben, statt
   dass der POST mit 400 scheitert. */
export function bauRotSetzen(id: string, k: string, v: RotWahl): "ok" | "voll" | "abgelehnt" {
  const alt = state.builds[id];
  if(!alt) return "abgelehnt";
  const rot = wahlSetzen(alt.rot ?? {}, k, v, BAU_ROT_MAX);
  if(!rot) return "voll";
  const neu = {...alt, rot};
  if(!bauPasst(neu)) return "abgelehnt";
  rotSchreiben(id, neu);
  return "ok";
}
/** Mehrere Wahlen auf einmal (ein Topf der Sitzung geht in seinen Build ueber); schreibt nur, wenn sich etwas aendert. */
export function bauRotUebernehmen(id: string, sitzung: Readonly<Record<string, RotWahl>>): boolean {
  const alt = state.builds[id];
  const rot = alt ? sitzungUebernehmen(alt.rot ?? {}, sitzung, BAU_ROT_MAX) : null;
  if(!alt || !rot || !bauPasst({...alt, rot})) return false;
  rotSchreiben(id, {...alt, rot});
  return true;
}
/** Einen Bau mit Link als geloest markieren oder zurueckholen (51-plan.ts, Karte im Bereich Builds).
    Nie geloescht: nur das Feld geloest kommt oder geht; false, wenn der Helfer ihn so nicht naehme. */
export function bauLoesen(id: string, an: boolean): boolean {
  const alt = state.builds[id];
  if(!alt || !SERVED || !geladen) return false;
  const neu: Bau = {...alt};
  if(an) neu.geloest = Date.now(); else delete neu.geloest;
  if(!bauPasst(neu)) return false;
  rotSchreiben(id, neu);
  return true;
}
/* Ein neues Objekt mit demselben Namen und Link: was der Bau sonst traegt, bleibt. */
function rotSchreiben(id: string, neu: Bau){
  state.builds[id] = neu;
  bauRev++;
  offen.add(id);
  planeSchreiben(true);
}

/* ---------- Worte ---------- */
/** "Langbogen/Armbrust": ein Waffenpaar in der Sprache der Oberflaeche (auch fuer die Karten in 51-plan.ts). */
export const paarStrich = (w: readonly string[]) => w.filter(Boolean).map(weaponLabel).join("/");
function bauName(id: string, nummern: Record<string, number>): string {
  const b = state.builds[id]!;
  return b.name || t("bau.defaultName", {pair: paarStrich(b.weapons), n: nummern[id] ?? 1});
}
/** Wie ein bekannter Bau heisst, mit den Nummern aller Baue (51-plan.ts). */
export function bauNameVon(id: string): string { return bauName(id, bauNummern(state.builds)); }

/* ---------- der Haken aus Merkmal 1 ----------
   Stammt der Bezug von "Gegen deinen besten Pull" aus einem anderen Bau als
   der Kampf links, haengt die Zeile im Vergleich diesen Satz an. Der Bezug
   ist ein Kampf des geladenen Logs (segN) oder ein gespeicherter Pull
   (best|<key>|best|second); der traegt seine Kennung im Verzeichnis, wenn
   er seit dem Bautagebuch gekaempft wurde, sonst wird sie aus seinem Lauf
   gelesen. */
export function bezugBau(refId: string): Fingerprint | null {
  const s = /^seg(\d+)/.exec(refId);
  if(s){
    const seg = state.encounters[+s[1]!];
    return seg ? bauVon(seg) : null;
  }
  const m = /^best\|(.+)\|(best|second)$/.exec(refId);
  if(!m) return null;
  const e = state.best[m[1]!];
  const p = e ? (m[2] === "best" ? e.best : e.second) : undefined;
  if(!p) return null;
  const f = state.hist.fights.find(x => x.at === p.at && typeof x.b === "string" && !!state.builds[x.b]);
  return f ? state.builds[f.b!]! : bauVonLauf(p.run);
}
/** Zwei Fingerabdruecke, ein Bau? Zwei bekannte Baue: die Kennung entscheidet; sonst die Aehnlichkeit. */
export function gleicherBau(hier: Fingerprint, dort: Fingerprint): boolean {
  const idHier = findBau(hier, state.builds), idDort = findBau(dort, state.builds);
  return idHier && idDort ? idHier === idDort : sameBau(hier, dort);
}
/* Wie ein Bau in einem Satz heisst: sein Name mit dem Paar davor, ohne Namen
   Paar und Nummer ("Langbogen/Armbrust 1"), kennt das Bautagebuch ihn nicht,
   nur das Paar. */
export function bauEtikett(fp: Fingerprint): string {
  const id = findBau(fp, state.builds);
  const b = id ? state.builds[id] : undefined;
  return !b ? paarStrich(fp.weapons)
    : b.name ? paarStrich(b.weapons) + " " + t("bau.quoted", {name: b.name})
    : bauName(id!, bauNummern(state.builds));
}
export function bauHinweisSatz(refId: string, isBest: boolean): string {
  const seg = state.encounters[state.sel];
  const hier = seg ? bauVon(seg) : null;
  const dort = bezugBau(refId);
  if(!hier || !dort || gleicherBau(hier, dort)) return "";
  return t(isBest ? "bau.hintSecond" : "bau.hint", {bau: bauEtikett(dort)});
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  addEventListener("pagehide", () => {
    if(!schreibTimer) return;
    clearTimeout(schreibTimer);
    bauFlush(true);
  });
  bauLaden();
}
