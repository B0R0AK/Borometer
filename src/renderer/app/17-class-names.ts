import { state } from "./01-state";
import { t } from "./08-translation";
import { VENTIUS_ID, ventiusTargetKey } from "./15-weapons-and-ventius";
import { CLASS_NAMES } from "../klassen-core";
import type { BoardRow, ClassName, LocalizedName } from "../types";

export function classNameFor(weapons: string[]){
  // exactly two distinct real weapons, nothing else — Passive/Unassigned
  // are not weapon choices and a third weapon means no build reads as
  // one of these named classes
  const real = [...new Set(weapons)].filter(w => w !== "Passive" && w !== "Unassigned");
  if(real.length !== 2) return null;
  const key = real.slice().sort().join("|");
  return CLASS_NAMES[key] || null;
}
export const className = (c: LocalizedName | null) => c ? (c[state.lang] || c.en) : null;
/* A board row's build, as "Späher · DPS". The row carries the two weapon keys
   rather than a name, so an English client and a German one reading the same
   board each get it in their own language - and a row from a client too old to
   send them simply has no build, which is the honest answer rather than a
   guess from the skills it did send. */
/* The one name this app may speak for. Getting it wrong publishes somebody
   else's build as yours, so it says nothing rather than guess.

   state.players is sorted by damage, not by identity - "attacker list, most
   damage first". On a party log players[0] is therefore the biggest hitter in
   the file, which is exactly not you; taking it for yourself sent a stranger's
   Ventius answer out under your name, and painted your own weapons tab with
   it. In a party the registered name decides, and only when the loaded log
   actually holds it. Outside one, a filter you set decides. "Everyone in the
   log" only decides when there is exactly one attacker to be.

   The sample is never you: its character is Demo and it plays Ventius, so
   opening it mid-party would have reported ventius:true under your real name.
   The party name field already refuses the sample for the same reason. */
function meInLog(){
  if(state.fromSample) return "";
  const registered = (state.party && state.party.name) || "";
  if(registered) return (state.players || []).includes(registered) ? registered : "";
  if(state.player !== "__all") return state.player;
  return (state.players || []).length === 1 ? state.players[0] : "";
}
export function iPlayVentius(){
  const me = meInLog();
  return !!me && state.ventiusBy.has(me);
}
/* Eye of Ventius is a longbow skill, and the only healer build carrying a
   longbow is the Seeker - so this is the Seeker's rule, written as the general
   one it is: a healer who spends the pull on Ventius is not healing. Healers
   only. A Warden carries the same longbow and is still the tank, and a DPS
   build is already what it is. */
export function roleWithVentius(cls: ClassName, ventius: boolean){
  return (cls.role === "heal" && ventius) ? "dps" : cls.role;
}
/* A row counts as playing it when the sender says so outright, when its top
   skills still hold it, or when it did on an earlier poll. The id is
   Borometer's own, so this reads the same in a mixed-language party - and it
   works against a party server too old to relay the flag, which is why the
   skill list is read at all. */
/* Kept between polls because a skill list only rides along with a fight
   report, and a member waiting for the next pull has none - which is when the
   question gets asked. A row that DID report is the authority, so it can take
   the mark away again: somebody who drops the skill reads as a healer from
   their next pull, instead of being stuck as dps for the life of the page. */
/* Ob jemand auf demselben Ziel steht, entschied bisher allein der Server -
   und der kann nur Zeichenketten vergleichen. Zwei deutsche und zwei
   englische Clients auf einem Boss sahen fuer ihn deshalb wie zwei Bosse aus.
   Gemessen an einem eigenen EQEY-Log: das gemeinsame Ziel springt dreimal in drei
   Sekunden zwischen "Aufgestiegene Sintflutbringerin" und "Ascended
   Deluzhnoa" hin und her, und am Ende steht der staerkste Spieler der Gruppe
   mit 653k als "kaempft gegen Ascended Deluzhnoa" auf der Tafel - waehrend er
   auf genau demselben Boss stand wie alle anderen. Ein Gegner, zwei
   Schreibweisen, und die Tafel sortiert "woanders" nach unten.

   Die App weiss das laengst: ventiusTargetKey macht aus beiden Schreibweisen
   open:Deluzhnoa, und ebenso fuer die fuenf anderen Bosse mit zwei Namen.
   Hier wird ihr Urteil vor das des Servers gestellt. Der Schluessel reist ab
   jetzt auch im Bericht mit, damit ein spaeterer Server selbst vergleichen
   kann - bis dahin genuegt es, dass jeder Leser es fuer sich richtigstellt. */
export function targetKeyOf(row: BoardRow | null){
  if(!row) return "";
  if(row.targetKey) return row.targetKey;
  return row.target ? ventiusTargetKey(row.target) : "";
}
export function sameTarget(a: string | BoardRow, b: string | BoardRow){
  const ka = typeof a === "string" ? (a ? ventiusTargetKey(a) : "") : targetKeyOf(a);
  const kb = typeof b === "string" ? (b ? ventiusTargetKey(b) : "") : targetKeyOf(b);
  return !!ka && !!kb && ka === kb;
}
export function rowOnTarget(row: BoardRow, shared: string | null | undefined){
  if(!row || row.waiting) return true;
  const mine = targetKeyOf(row);
  const theirs = shared ? ventiusTargetKey(shared) : "";
  // Nur wenn beide Seiten einen Schluessel haben, ist der Vergleich besser als
  // der des Servers. Sonst bleibt sein Urteil stehen.
  if(mine && theirs) return mine === theirs;
  return row.onTarget !== false;
}

export function noteVentius(board: BoardRow[] | undefined){
  for(const r of (board || [])){
    if(!r || !r.name) continue;
    const plays = r.ventius === true ||
                  (r.skills || []).some(k => k && k.sid === VENTIUS_ID);
    if(plays) state.ventiusSeen.add(r.name);
    else if(!r.waiting && (r.skills || []).length) state.ventiusSeen.delete(r.name);
  }
}
function rowPlaysVentius(row: BoardRow){
  if(!row) return false;
  if(row.ventius === true) return true;
  if((row.skills || []).some(k => k && k.sid === VENTIUS_ID)) return true;
  if(row.name && state.ventiusSeen.has(row.name)) return true;
  // your own row needs no report: you can see your own log
  return !!(row.name && state.party && row.name === state.party.name && iPlayVentius());
}
export function partyClassIsVentius(row: BoardRow){
  const c = classNameFor(row && row.weapons || []);
  return !!c && c.role === "heal" && rowPlaysVentius(row);
}
export function partyClass(row: BoardRow){
  const c = classNameFor(row && row.weapons || []);
  if(!c) return null;
  return className(c) + " · " +
         t("weapons.role." + roleWithVentius(c, rowPlaysVentius(row)));
}
