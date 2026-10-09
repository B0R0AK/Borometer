import { state } from "./01-state";
import {
  blockPass, BOSS_DUNGEON, bossPause, mainTarget, openBoss, PHASE_GAP, PHASE_TARGETS, practiceTarget,
  stats
} from "./06-blocks-and-places";
import { learnVentius, ventiusPass } from "./15-weapons-and-ventius";
import { darfEntfernen } from "./19-grouping-and-party-fights";
import { unverwundbarStrecken } from "../rotation-core";
import type { CombatEvent, Encounter, Fight } from "../types";

/* ---------- encounters ----------
   Der Schnitt merkt sich, wo er steht, damit Live nur weiterschneidet
   (segmentTail, Spezifikation Live-Leistung 3). segment() faengt vorn an;
   beide gehen durch schneiden() und abschliessen(). */
interface Schnitt {
  /** wovon der Schnitt ausser den Ereignissen abhaengt; aendert es sich, schneidet segmentTail() neu */
  key: string;
  /** das Feld der Ereignisse, aus dem geschnitten wurde, und wie viel davon */
  events: CombatEvent[];
  evN: number;
  keep: CombatEvent[];
  /** jedes Stueck nach dem Zusammenfuegen, und wo in keep es beginnt */
  merged: Encounter[];
  ab: number[];
  missed: CombatEvent[];
  blocked: CombatEvent[];
}
let schnitt: Schnitt | null = null;
/* Wovon schneiden() abhaengt: wer, "Trennen nach", Phasen zusammenfassen,
   welche Ereignisarten nicht zaehlen. Mindestlaenge und entfernte Kaempfe
   rechnet abschliessen() jedes Mal ueber alle. */
export const schnittKey = () => JSON.stringify([state.player, state.gap, state.mergePhases,
  [...state.excludedEvents].sort()]);

/* kInvincible is damage the game wrote down and the target never took.
   Where it comes from, as a player reports it: at Lyxara players get caught in a Magic
   Core, and while they are in it they cannot be hurt - the log still
   records every hit with its full number. Counting it made a 14-second
   pull read 196k dps where 158k landed, a quarter too high, because a
   fifth of that fight went into something invulnerable.

   Dropped here rather than corrected afterwards: every figure downstream -
   dps, share, per-skill, the charts - reads off these events, and a number
   that did not happen has no business in any of them. It is counted back
   below, so it is left out of the fight without being hidden. */
const zaehlt = (e: CombatEvent) =>
  e.dmg > 0 &&
  e.hitType !== "kInvincible" &&
  !state.excludedEvents.has(e.event) &&
  (state.player === "__all" || e.source === state.player);
/* Fehlschlaege und Unverwundbares: gezaehlt ueber die Spanne eines Kampfes,
   siehe abschliessen() */
const verfehlt = (e: CombatEvent) =>
  e.hitType === "kMiss" && !state.excludedEvents.has(e.event) &&
  (state.player === "__all" || e.source === state.player);
const abgeprallt = (e: CombatEvent) =>
  e.hitType === "kInvincible" && e.dmg > 0 && !state.excludedEvents.has(e.event) &&
  (state.player === "__all" || e.source === state.player);

/* Die Treffer eines Kampfes auf Unverwundbare, wie das Log sie schrieb -
   mit demselben Filter, mit dem segment() sie herausnimmt. Sie stehen
   nicht in seg.events; wer sie braucht (die Analyse: ihr leiser Befund
   und unverwundbareSekunden), fragt hier. seg.invuln sagt, ob es welche gibt. */
export function unverwundbarTreffer(seg: Encounter): CombatEvent[] {
  if(!seg.invuln) return [];
  return state.events.filter(e => abgeprallt(e) && e.t >= seg.start && e.t <= seg.end);
}

export function segment(){
  const s: Schnitt = {key: schnittKey(), events: state.events, evN: state.events.length,
    keep: state.events.filter(zaehlt), merged: [], ab: [],
    missed: state.events.filter(verfehlt), blocked: state.events.filter(abgeprallt)};
  schneiden(s, 0);
  abschliessen(s);
  schnitt = s;
}

/* Live: nur, was seit dem letzten Schnitt an state.events gehaengt wurde
   (appendEvents in 04-log-parsing.ts). Zurueckgerollt wird um die letzten
   zwei Stuecke nach dem Zusammenfuegen, nicht um eine Zeitspanne:
   - das letzte kann wachsen, und mit ihm sein Hauptziel - und damit, ob es
     zum vorletzten gehoert (dieselbe Pruefung wie unten);
   - das erste Stueck des vorletzten ist abgeschlossen, denn hinter ihm
     beginnt schon das letzte. Ob es an das drittletzte gehaengt wird, steht
     damit fest, und alles davor auch.
   Eine Zeitspanne haette nicht gereicht: "Trennen nach" darf bis 120 s
   stehen, doppelt so lang wie PHASE_GAP.
   Gibt die Kaempfe zurueck, die dabei neu entstanden sind - nur sie muessen
   histRecord und bestRecord ansehen -, oder null, wenn neu geschnitten wurde. */
export function segmentTail(): Set<Encounter> | null {
  const s = schnitt;
  if(!s || s.key !== schnittKey() || s.events !== state.events || s.evN > state.events.length){
    segment();
    return null;
  }
  for(let i = s.evN; i < state.events.length; i++){
    const e = state.events[i]!;
    if(zaehlt(e)) s.keep.push(e);
    if(verfehlt(e)) s.missed.push(e);
    if(abgeprallt(e)) s.blocked.push(e);
  }
  s.evN = state.events.length;
  const r = Math.max(0, s.merged.length - 2);
  const k0 = s.merged.length ? s.ab[r]! : 0;
  s.merged.length = r; s.ab.length = r;
  const vorher = new Set<Encounter>(state.encounters);
  schneiden(s, k0);
  abschliessen(s);
  return new Set(state.encounters.filter(x => !vorher.has(x)));
}

function schneiden(sn: Schnitt, k0: number){
  /* The field says "split after N seconds" and now that is what happens.
     It used to multiply by three behind the reader's back: the setting read
     5 and a fight was cut after fifteen quiet seconds.

     Eight is the default because eight is the game's own answer. A player at
     a practice dummy: "wenn ich den dummy attackiere und dann stoppe,
     vergehen 8 Sekunden bis der Kampf vorbei ist. Sobald die 8 Sek vergangen
     sind, steckt mein Char die Waffen weg. Sobald ich dann wieder attackiere
     loggt der ingame meter einen neuen Kampf."

     Worth knowing where that does not hold: the timer runs while NOTHING is
     engaged with you. In a dungeon something usually is, so a quiet stretch
     in your own damage is not proof that combat ended - and the log has no
     incoming damage in it to tell. Eight seconds is the game's floor, not a
     certainty. A boss you come back to inside the minute below is put back
     together anyway. */
  const hardGap = Math.max(1, state.gap) * 1000;
  /* A minute, and its own number: it used to ride on the setting above, so
     moving the split from 5 to 12 quietly moved this from 60 s to 144. What
     it means has nothing to do with the split - it is how long a boss may be
     untargetable and still be the same pull. */
  const bossGap = PHASE_GAP * 1000;

  // Switching target does NOT end a fight on its own: adds spawn mid-pull all
  // the time, and splitting on every target change chopped one boss fight into
  // several. Only real idle time ends a fight.
  const segs: Encounter[] = [], von: number[] = [];
  let cur: Encounter | null = null;
  for(let k = k0; k < sn.keep.length; k++){
    const e = sn.keep[k]!;
    const since = cur ? e.t - cur.end : Infinity;
    if(!cur || since > hardGap){
      cur = {events:[e], start:e.t, end:e.t};
      segs.push(cur); von.push(k);
    } else {
      cur.events.push(e); cur.end = e.t;
    }
  }

  // Coming back to the same main target after a pause is the same encounter
  // (a phase change, a shielded window), not a fresh pull.
  /* A boss that goes untargetable between phases and two tests on the same
     practice dummy look identical from here: same main target, a pause of
     the same shape. The log cannot tell them apart, so this is a setting
     rather than a guess - and either way the count of parts is kept, so
     the rail can say that a fight is made of more than one. */
  const merged = sn.merged;
  /* Two ways a stretch belongs to the one before it.

     The old one: same enemy, close enough in time. That carries a boss who
     goes untargetable and comes back.

     The new one: a boss whose fight is DECLARED to move to another enemy for
     a phase. Measured on a chaotic Stone Grave Cradle run - Fellinex, then
     four stretches on Fellini, then Fellinex again four times - the app made
     three rows out of one pull and the 46.7M it actually cost stood nowhere.
     The chain has to START on the boss: Fellini is also fought on the way in,
     before Fellinex exists, and that one is its own fight.

     What this does NOT do is tell a wipe from a phase. Both are a pause and
     then the boss again; the log holds nothing that separates them. */
  segs.forEach((s, j) => {
    const prev = merged[merged.length-1];
    const t = mainTarget(s);
    s.parts = 1;
    /* Ein Boss ohne Pause im Kampf (King Khanzaizin, Limuny Bercant,
       wipeGap in der Dungeon-Tabelle) beginnt schon nach kuerzerer Stille
       neu: dort ist die Pause ein Wipe (Entscheidungen 01.10. und 04.10.).
       Alle anderen: die Minute. */
    const near = prev && s.start - prev.end <= Math.min(bossGap, bossPause(t) * 1000);
    const phaseOf = prev && prev.encBoss && PHASE_TARGETS.get(prev.encBoss);
    const belongs = prev && (mainTarget(prev) === t ||
                             (prev.encBoss && (t === prev.encBoss ||
                                               (phaseOf && phaseOf.has(t)))));
    // Ein Uebungsziel wird nie zusammengefasst, auch mit Haken nicht: dort
    // ist jede Pause das Ende eines Versuchs und keine Zwischenphase.
    if(state.mergePhases && near && belongs && !practiceTarget(t)){
      /* Whether the pause between the two parts is fighting time depends on
         what was being fought, and only the dungeon table can say.

         On a boss it is. The raid's own player: "25s Zwischenphase soll
         auch als Kampfzeit zaehlen, weil sie zum Kampf gehoert". Fellinex
         goes untargetable at 80% and those 25 seconds are part of the pull -
         the encounter is running, nobody can land a hit, and a rate that
         skipped the phase would flatter every boss with one.

         On anything else two stretches of the same name are two pulls. The
         walk between a trash pack and the next trash pack of the same name
         is not a phase, and neither is putting the bow down on a practice
         dummy for a minute: that one read 1.885/s where 21,7k/s was landed,
         because 56,7 of its 62,1 seconds were nothing at all.

         Kept while the parts can still be told apart - once the events are
         concatenated the hole between them is gone. */
      const bossPull = BOSS_DUNGEON.has(t) || !!openBoss(t) || !!prev.encBoss;
      if(!bossPull)
        prev.fought = (prev.fought == null ? prev.end - prev.start : prev.fought)
                    + (s.end - s.start);
      prev.events = prev.events.concat(s.events);
      prev.end = s.end;
      prev.parts = (prev.parts || 1) + 1;
    } else {
      // a chain can only be opened by the boss itself
      s.encBoss = PHASE_TARGETS.has(t) ? t : null;
      merged.push(s); sn.ab.push(von[j]!);
    }
  });
}

/* Was nach dem Schnitt ueber alle Kaempfe geht: Mindestlaenge, Zahlen,
   entfernte Kaempfe, Fehlschlaege, Bloecke, Ventius, Reihenfolge. Die Zahlen
   (stats) rechnet es nur fuer Kaempfe, die noch keine haben - ein Kampf, den
   segmentTail() stehen liess, hat dieselben Ereignisse wie zuvor. */
function abschliessen(sn: Schnitt){
  const merged = sn.merged;
  let out = merged.filter(s => (s.end - s.start)/1000 >= state.minDur && s.events.length > 2);
  state.minDurDropped = false;
  if(!out.length){
    /* Nothing cleared the minimum. Better to show the fights than a blank
       screen - but never `segs`: the merge loop above joins phases into
       their predecessor in place, so segs still holds every absorbed phase
       next to the merged fight and the same hits would be counted twice.
       And the setting being dropped is said out loud now; it used to look
       like a dead control. */
    const any = merged.filter(s => s.events.length > 2);
    if(any.length){ out = any; state.minDurDropped = true; }
  }
  /* Before stats(), because it renames events and every figure downstream
     is counted off those names. Each event belongs to exactly one fight,
     so a fight can be asked on its own. */
  /* Und vor stats() die Strecken, in denen das Ziel unverwundbar war
     (Issue #37): stats() zaehlt sie nicht als Leerzeit. Die Rechnung
     steht in rotation-core.ts (unverwundbarStrecken). */
  const blockedAlle = sn.blocked;
  out.forEach(s => {
    if(s.stats) return;
    s.ventiusBase = ventiusPass(s.events); s.ventius = !!s.ventiusBase;
    if(blockedAlle.length){
      let i = 0, j = blockedAlle.length;
      while(i < j){ const m = (i + j) >> 1; if(blockedAlle[m]!.t < s.start) i = m + 1; else j = m; }
      const treffer: { t: number; ziel: string }[] = [];
      for(; i < blockedAlle.length && blockedAlle[i]!.t <= s.end; i++)
        treffer.push({t: blockedAlle[i]!.t - s.start, ziel: blockedAlle[i]!.target});
      /* Nur Strecken, in denen die Treffer auf Unverwundbare ueberwiegen.
         Trafen daneben genauso viele Treffer ein verwundbares Ziel - ein
         Flaechenangriff auf Boss und unverwundbares Add, der Boss bleibt
         verwundbar -, dann lief dort Schaden, und die Strecke ist weder
         Band noch aus der Leerzeit zu nehmen. */
      if(treffer.length) s.unverwundbar = unverwundbarStrecken(treffer).filter(st => {
        let drin = 0, normal = 0;
        for(const x of treffer) if(x.t >= st.von && x.t <= st.bis) drin++;
        for(const e of s.events){ const t = e.t - s.start; if(t >= st.von && t <= st.bis) normal++; }
        return normal < drin;
      });
    }
    s.stats = stats(s);
  });
  /* Einzeln entfernte Kaempfe fallen hier heraus - nach stats(), weil die
     Gruppenregel den Namen des Kampfes braucht, und vor blockPass(), damit
     die Blockueberschrift von selbst mitrechnet: nimmt man einen Pull aus
     einem Dungeon, sagt sie danach "2 Kaempfe" und die Summe passt wieder
     zu den Zeilen darunter. Danach waere sie eine Aussage ueber Zeilen, die
     nicht mehr dastehen.

     darfEntfernen() wird hier ein zweites Mal gefragt, obwohl das x an
     einer Gruppenzeile gar nicht erst steht: die Meldungen der Gruppe
     treffen spaeter ein als der Klick. Ein Kampf, der beim Entfernen noch
     niemandem gehoerte, kann seinen Anhaenger danach bekommen - und dann
     steht er wieder da. Die Gruppe gewinnt, und zwar jedes Mal neu.

     Gezaehlt wird, was wirklich fehlt, nicht wie viele Startzeiten gemerkt
     sind - die Kopfzeile darf keine Zahl nennen, die nicht dasteht. */
  state.entferntAktiv = 0;
  if(state.entfernt.size){
    const vorher = out.length;
    out = out.filter(s => !state.entfernt.has(s.start) || !darfEntfernen(s));
    state.entferntAktiv = vorher - out.length;
  }
  out.forEach((s,i) => { s.index = i; });

  /* Misses, counted back in. The log writes them as ordinary rows with a hit
     type of kMiss and no damage, so `keep` above drops them with everything
     else worth zero - and the app had no idea they existed until a log was
     read by hand. They are counted against the fight's own span rather than
     carried in seg.events, because every figure downstream is computed off
     that array and a row worth nothing has no business in any of them.
     Same source filter as the fight itself, or a party log would hand you
     somebody else's misses. */
  const missed = sn.missed;
  if(missed.length){
    let at = 0;
    for(const seg of out){
      while(at < missed.length && missed[at]!.t < seg.start) at++;
      let n = 0, from = at;
      // which skill went past, not just how often: the rate below has to be
      // asked against that skill and nothing else
      const by = new Map<string, { n: number; sid: string }>();
      while(from < missed.length && missed[from]!.t <= seg.end){
        const k = missed[from]!.skill;
        // the id travels with the name so the sentence can say the skill in
        // the reader's language, the way every other finding does
        if(!by.has(k)) by.set(k, {n:0, sid: missed[from]!.sid || ""});
        by.get(k)!.n++;
        n++; from++;
      }
      seg.missed = n; seg.missSkills = by;
    }
  }

  /* The same walk as the misses above, and for the same reason: these rows
     are not in seg.events any more, so the only way to say anything about
     them is over the fight's own span. Damage as well as count here - with a
     miss the interesting number is how many, with these it is how much. */
  const blocked = sn.blocked;
  if(blocked.length){
    let at = 0;
    for(const seg of out){
      while(at < blocked.length && blocked[at]!.t < seg.start) at++;
      let n = 0, dmg = 0, from = at;
      while(from < blocked.length && blocked[from]!.t <= seg.end){
        n++; dmg += blocked[from]!.dmg; from++;
      }
      if(n){ seg.invuln = n; seg.invulnDmg = dmg; }
    }
  }
  blockPass(out as Fight[], merged);   // out has its stats, see above
  learnVentius(out);
  out.sort((a,b) => b.start - a.start);
  // every one of them has its stats now (see above), which is what makes
  // it a Fight
  state.encounters = out as Fight[];
  /* "segN" haengt am Platz in dieser Liste, und die ist nach Beginn sortiert:
     ein neuer Kampf schiebt jede Kennung um eins weiter. Wer die Haken
     behielte, verglichen andere Kaempfe als die angehakten - also fallen sie
     weg, sobald die Liste neu entsteht. Gespeicherte Laeufe bleiben. */
  if(state.cmpSeg){
    state.cmpSeg.clear();
    [...state.cmpRuns].forEach(id => { if(/^seg/.test(id)) state.cmpRuns.delete(id); });
  }
  if(state.sel >= out.length) state.sel = 0;
  [...state.cmp].forEach(i => { if(i >= out.length) state.cmp.delete(i); });
}
