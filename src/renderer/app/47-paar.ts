import { state } from "./01-state";
import { stats } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { weaponLabel } from "./09-weapon-icons";
import { skillKey } from "./10-skill-names";
import { skillIds, weaponFor } from "./16-fight-analysis";
import { AUTO_OFF_MIN, handPair } from "./42-party";
import { gleicherBezug, kampfPaar, pairFromSkills, type BauSkill } from "../build-core";
import type { Fight } from "../types";

/* ---------- Das Waffenpaar eines Kampfs und der Bezug ----------
   Der Builds-Reiter ist entfallen (#207, Spezifikation
   docs/superpowers/specs/2026-10-06-builds-entfernen-design.md). Geblieben
   ist das Paar: aus den Skills eines Kampfs (paarVon) oder die Handauswahl,
   im Verzeichnis als w. Ein Bezug (Vergleiche, bester Pull, Analyse) ist
   "dasselbe Waffenpaar" (gleicherBezug, build-core.ts). Ein altes b im
   Verlaufsverzeichnis wird nicht mehr gelesen. */

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

/** Die Faehigkeiten eines Kampfes in der Form des Kerns (fuer sein Waffenpaar, paarVon), oder null, wo sie nicht deine sind. */
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

/** Das Paar eines Kampfes des geladenen Logs: die Handauswahl, sonst pairFromSkills (nurLog: nur pairFromSkills). */
export function paarVon(seg: Fight, nurLog = false): [string, string] | null {
  // nurLog (das Nachlesen alter Logs fuer die Rekorde): nur die Skills, nie die heutige Handauswahl
  const hand = nurLog ? null : handPair();
  if(hand && hand.main) return [hand.main, hand.off || ""];
  const s = bauSkills(seg);
  return s ? pairFromSkills(s.skills, s.total, AUTO_OFF_MIN) : null;
}

/** Das Paar in Worten: "Langbogen + Armbrust". */
export const paarPlus = (w: readonly string[]) => w.filter(Boolean).map(weaponLabel).join(" + ");

/* ---------- der Bezug der Vergleiche ---------- */
/** Ein Bezug ist das Paar des Kampfs; null, wo es unbekannt ist. */
export type Bezug = [string, string] | null;
/** Der Bezug eines Kampfes des geladenen Logs. */
export const bezugVon = (seg: Fight): Bezug => paarVon(seg);
/* Ein Kampf des geladenen Logs (segN) oder ein gespeicherter Pull
   (best|<key>|best|second): der traegt sein Paar im Verzeichnis (at),
   sonst wird es aus dem Lauf gelesen. */
export function bezugVonRef(refId: string): Bezug | undefined {
  const s = /^seg(\d+)/.exec(refId);
  if(s){
    const seg = state.encounters[+s[1]!];
    return seg ? bezugVon(seg) : undefined;
  }
  const m = /^best\|(.+)\|(best|second)$/.exec(refId);
  if(!m) return undefined;
  const e = state.best[m[1]!];
  const p = e ? (m[2] === "best" ? e.best : e.second) : undefined;
  if(!p) return undefined;
  const f = state.hist.fights.find(x => x.at === p.at);
  // kennt das Verzeichnis das Paar des Kampfes nicht, kommt es aus dem Lauf
  return (f && kampfPaar(f)) || (() => {
    const run = p.run;
    const skills: BauSkill[] = (run.skills || []).map(k => ({
      key: skillKey(k.name, k.sid), weapon: k.weapon || weaponFor(k.name, k.sid), damage: k.damage || 0}));
    return pairFromSkills(skills, run.total, AUTO_OFF_MIN);
  })();
}
/** Wie ein Bezug in einem Satz heisst: das Paar. */
export const bezugEtikett = (b: Bezug): string => b ? paarPlus(b) : "";
export function bauHinweisSatz(refId: string, isBest: boolean): string {
  const seg = state.encounters[state.sel];
  const hier = seg ? bezugVon(seg) : null;
  const dort = bezugVonRef(refId);
  if(!hier || !dort || gleicherBezug(hier, dort)) return "";
  return t(isBest ? "bau.hintSecond" : "bau.hint", {bau: bezugEtikett(dort)});
}
