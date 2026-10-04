/* ============================================================
   Analysis — everything derived from a parsed encounter
   ============================================================ */

import { DEAD_TIME, state } from "./01-state";
import { bareBoss, bossGroup, openBoss } from "./06-blocks-and-places";
import { skillEntry } from "./10-skill-names";
import { NO_SKILL } from "./14-questlog-weapons";
import { persistPref } from "./27-weapons-tab";
import type { CombatEvent, Encounter, Fight, SkillCast, VentiusCast } from "../types";

export const WEAPONS = ["Greatsword","Sword and Shield","Dagger","Crossbow","Longbow",
                 "Staff","Wand and Tome","Spear","Gauntlet","Orb","Passive","Unassigned"];
export const EQUIPPABLE = WEAPONS.filter(w => w !== "Passive" && w !== "Unassigned");
const CAST_WINDOW = 400;   // hits of one skill within this many ms belong to one cast

/* ---------- Auge von Ventius ----------
   The log does not name this skill. It writes Decisive Sniping (or
   Decisive Bombardment) and, when the Eye of Ventius specialization is
   slotted, that one cast lands three hits on the target instead of one.
   The three hits carry the same id and the same millisecond.

   20 ms, not CAST_WINDOW. Measured over a full raid log: per target, any
   window from 1 to 60 ms yields the same 286 casts (86 single, 194
   triple); at 120 ms genuinely separate casts begin to merge and the
   triples become twelves. 400 ms is far outside that.

   Per target, not per timestamp. The same log has five moments where the
   family hits two enemies at once - 3+3, 3+2, 3+1, and once 1+1. The last
   is one shot cleaving two targets, and counting rows per timestamp would
   have called it a volley. */
export const VENTIUS_ID = "boro:ventius";
export const VENTIUS_NAME = "Eye of Ventius";
const VENTIUS_WINDOW = 20;
export const VENTIUS_FAMILY = new Set(["Decisive Sniping", "Decisive Bombardment"]);
/* Through skillEntry, not against the raw string: the game writes skill
   names in the client's own language, so a German client logs
   "Entschlossener Scharfschuss" and only the dictionary can tell that it
   is the same skill. Verified: skillEntry resolves both spellings. */
function inVentiusFamily(e: CombatEvent){
  if(e.skill === NO_SKILL) return false;   // the unnamed row is every skill at once
  const k = skillEntry(e.skill, e.sid);
  return !!(k && VENTIUS_FAMILY.has(k.en));
}
/* A specialization is a property of the build, so this asks one question of
   a whole FIGHT - did the volley ever happen in it - and if it did, every
   cast of the family in that fight is this skill, the single-hit ones
   included. One row, which is what it is in the game. Splitting by hit
   count instead would put the same button press in two rows and give each
   a damage-per-cast figure that describes neither.

   Per fight and not per log, which is where this started: a log can hold
   two builds. Measured on a dummy log with one test of each, 33,5 s
   apart - the first has 35 volleys, the second fifteen casts and not one
   of them lands twice. Asked once for the whole file, both would have
   come back as Auge von Ventius. */
export function ventiusPass(ev: CombatEvent[]){
  /* Put back what an earlier pass renamed before asking again. segment()
     re-runs on the same event objects every time Gap, Min length or the
     character filter changes - buildEvents does not - and without this the
     second pass would find no family left, answer "no Ventius", and leave
     the renamed rows standing anyway. */
  for(const e of ev){
    // baseSid is set in the same breath as baseSkill, below
    if(e.baseSkill != null){ e.skill = e.baseSkill; e.sid = e.baseSid!; }
  }
  const fam = [];
  const lastOn = new Map();
  let found = false;
  for(const e of ev){
    if(!inVentiusFamily(e)) continue;
    fam.push(e);
    const prev = lastOn.get(e.target);
    if(prev != null && e.t - prev <= VENTIUS_WINDOW) found = true;
    lastOn.set(e.target, e.t);
  }
  if(!found) return null;
  // what the log actually wrote, so the row's tooltip can name that rather
  // than list both skills this specialization can sit on
  const base = {name: fam[0]!.skill, sid: fam[0]!.sid};
  for(const e of fam){
    e.baseSkill = e.skill;   // what the log wrote, kept for the bug report
    e.baseSid = e.sid;
    e.skill = VENTIUS_NAME;
    e.sid = VENTIUS_ID;
  }
  return base;
}

/* Counting a cast is not the same job as spotting one, and it needs a much
   wider window. Measured on a dummy log: a cast is one opening hit, then
   about a second later a wave of three, then about 100 ms later a second
   wave of three. The longest gap inside a cast is 1051 ms; the shortest
   between two casts is 1344 ms. 1200 ms sits between them, and at that
   window every cast in that fight comes out as seven hits or as four -
   which is exactly the mechanic: seven from an optimal distance, four
   from anywhere else. */
const VENTIUS_CAST = 1200;

/* How many waves a cast landed, or 0 for a cast that cannot be read.
   Counting the waves themselves rather than dividing the hit count is what
   makes this safe: two casts running together still satisfy 1 + 3N - nineteen
   hits divides as neatly as ten - but their shape gives them away, because
   the second cast's opening hit sits in the middle as a wave of one. Asked by
   hit count, one merged pair on a trash mob became "6 waves" and made a
   ceiling no real cast could reach; asked by shape, it is simply unreadable
   and says so. */
function ventiusWaves(cast: VentiusCast){
  const w = ventiusShape(cast);
  if(w.length < 2 || w[0]!.length !== 1) return 0;
  for(let i = 1; i < w.length; i++) if(w[i]!.length !== 3) return 0;
  return w.length - 1;
}

/* The shape of a fight's Ventius casts: what the best cast reached, and how
   often the rest got there. The ceiling is read off this fight rather than
   fixed at seven, because it is the target that sets it - measured, Vulcanus
   never gives more than three waves, Deus Chimaerus runs at four, ordinary
   trash and a practice dummy at two. */
export function ventiusMix(seg: Fight){
  /* Grouped by target, and then the target you spent the most casts on is the
     one that answers - the boss on a boss pull, whatever you shot most on a
     trash pull. Anything else averages a ceiling across enemies of different
     sizes, and the ceiling is a property of the enemy. */
  const per = new Map();
  for(const c of ventiusCasts(seg)){
    let t = per.get(c.target);
    if(!t){ t = {target: c.target, casts: 0, hits: 0, by: new Map(), top: 0, folge: []}; per.set(c.target, t); }
    t.casts++;
    t.hits += c.hits || 0;
    const w = ventiusWaves(c);
    /* Auch eine unlesbare Salve steht in der Folge, mit 0: der Kasten der
       Analyse zeichnet sie als leere Saeule an ihrer Stelle (Entwurf). */
    if(!w){ t.folge.push(0); continue; }
    /* Die Reihenfolge, in der die Salven geflogen sind. Die Gruppierung
       nach Nachbebenzahl darunter beantwortet "wie viele waren gut"; sie
       kann nicht beantworten "wann waren sie gut". */
    t.folge.push(w);
    /* Je Nachbeben-Zahl auch Schaden und Treffer. Ohne sie muesste die
       Seite spaeter schaetzen, was eine schwaechere Salve gekostet hat -
       mit ihnen wird es gemessen. */
    let g = t.by.get(w);
    if(!g){ g = {n:0, dmg:0, hits:0}; t.by.set(w, g); }
    g.n++; g.dmg += c.dmg || 0; g.hits += c.hits || 0;
    if(w > t.top) t.top = w;
  }
  const best = [...per.values()].filter(t => t.top)
    .sort((a,b) => b.casts - a.casts)[0];
  if(!best) return {casts: 0, shaped: 0, off: 0, top: 0, atTop: 0, rows: [],
                    folge: [], hits: 0, target: "", cap: 0, capAt: 0};
  const shaped = [...best.by.values()].reduce((n,x) => n + x.n, 0);
  /* What this target has given anyone, ever - the fight's own best says
     nothing about what was possible.

     Held up to you only once more than one cast has reached it. Ramux rides a
     dragon for the first part of his fight and the two take hits side by side;
     an aftershock's three hits are three hits in a radius, not three hits on
     one body, so a reading taken while two enemies stand inside that radius
     can describe an arrangement rather than an enemy. One such reading is a
     rumour. It stays in the table, where it is visible and can be checked, and
     out of the sentence that tells you that you stood badly. */
  const rec = state.ventiusTop[ventiusTargetKey(best.target)];
  const sure = rec && rec.atTop >= VENTIUS_TRUST ? rec : null;
  return {casts: best.casts, shaped, off: best.casts - shaped, top: best.top,
          cap: (sure && sure.waves) || 0, capAt: (sure && sure.atTop) || 0,
          atTop: (best.by.get(best.top) || {n:0}).n, target: best.target,
          folge: best.folge, hits: best.hits,
          rows: [...best.by.entries()].sort((a,b) => a[0] - b[0])
                  .map(([waves, g]) => ({waves, hits: waves*3+1, n: g.n,
                                         dmg: g.dmg, trefferIst: g.hits}))};
}

/* Per caster and target, the way ventiusPass already tests its 20 ms volley.

   Pooled by time alone, a fight holding a boss and the trash around it mixed
   two different ceilings into one: trash tops out at two waves and a boss at
   four, so "the best cast on this target" was read off whichever target
   happened to allow the most, and every cast on the other one counted as
   falling short of a ceiling it could never reach.

   The caster has to be in the key as well, and not only in the fight filter.
   Viewing a party log as "everyone", two archers on the same boss inside the
   same second fold into one cast whose waves hold six hits instead of three -
   which the shape test then throws out as unreadable, so the finding does not
   go wrong, it disappears. Measured on the sample log with a second caster
   cloned onto it: keyed by target alone, every cast became unreadable and the
   whole finding vanished; keyed by caster and target, both come back
   unchanged. */
function ventiusCasts(seg: Encounter){
  const open = new Map<string, VentiusCast>();
  const out: VentiusCast[] = [];
  for(const e of seg.events){
    if(e.skill !== VENTIUS_NAME) continue;
    const k = e.source + "\u0000" + e.target;
    const last = open.get(k);
    if(last && e.t - last.last <= VENTIUS_CAST){
      last.hits++; last.dmg += e.dmg; last.last = e.t; last.ev.push(e);
    } else {
      const cast = {t:e.t, last:e.t, hits:1, dmg:e.dmg, ev:[e],
                    target:e.target, source:e.source};
      open.set(k, cast); out.push(cast);
    }
  }
  return out;
}

/* A wave is the three hits that land in the same millisecond - measured, the
   spread inside one is 0 ms and the gap to the next is 85-140 ms, so 30 ms
   separates them with room to spare either way. */
const VENTIUS_WAVE = 30;
function ventiusShape(cast: VentiusCast){
  const w = [];
  for(const e of cast.ev){
    const last = w[w.length-1];
    if(last && e.t - last[last.length-1]!.t <= VENTIUS_WAVE) last.push(e);
    else w.push([e]);
  }
  return w;
}

/* Air around an opening arrow. The arrow lands about 950 ms before its
   first wave and the waves are 85-160 ms apart, so 400 ms separates the two
   with room on either side. */
const VENTIUS_GUARD = 400;

/* The presses of Eye of Ventius in one fight, counted by their shape.

   A rolling window cannot do this. On a dummy it can - presses there are at
   least 1344 ms apart and the longest gap inside one is 1051 ms, which is
   what VENTIUS_CAST sits between - but in a dungeon the button comes round
   faster and the waves of one press run into the next. Measured on the
   Altar raid log: 29 of 146 presses land within 1200 ms of the volley
   before, so the window glued them on and casts() counted 127 where 146
   buttons were pressed. Damage per cast came out up to 50% too high -
   Gramaut-Barbar 542.3k against the 361.5k a press really brought.

   The press itself is readable, because the log writes it in a shape: one
   opening arrow ALONE, then about a second later waves of three per enemy
   the volley reaches. So a press starts at a wave of one with air on both
   sides. Checked against the dummy log, where the old window is right: 36
   presses out of the shape, 36 out of the window, the same 36.

   Grouped across targets on purpose. One press that reaches three enemies
   is one press; ventiusCasts() splits by target instead, and that is right
   for what it does - a ceiling belongs to an enemy - but it is not a count
   of presses and must not be read as one. */
function ventiusPresses(ev: CombatEvent[]){
  const waves = [];
  for(const e of ev){
    const last = waves[waves.length-1];
    if(last && e.t - last[last.length-1]!.t <= VENTIUS_WAVE) last.push(e);
    else waves.push([e]);
  }
  const out = [];
  for(let i = 0; i < waves.length; i++){
    const w = waves[i]!;
    const before = i ? w[0]!.t - waves[i-1]![waves[i-1]!.length-1]!.t : Infinity;
    const after = i+1 < waves.length ? waves[i+1]![0]!.t - w[0]!.t : Infinity;
    // the first wave of the fight opens a press whatever it looks like:
    // the fight can start in the middle of a volley
    if(!out.length || (w.length === 1 && before > VENTIUS_GUARD && after > VENTIUS_GUARD))
      out.push({t:w[0]!.t, last:w[0]!.t, dmg:0, hits:0, crit:0});
    const c = out[out.length-1]!;
    for(const e of w){ c.dmg += e.dmg; c.hits++; if(e.crit) c.crit++; c.last = e.t; }
  }
  return out;
}

const VENTIUS_TOP_CAP = 400;        // targets, not casts
const VENTIUS_TRUST = 2;            // casts that must have reached it

/* One enemy, one key, whatever language the client that met it was running.
   A boss listed with two spellings folds onto the first of them, and the rank
   the game puts in front - and translates, while leaving the name alone - is
   cut off first. Anything unknown is kept under its own name, lowercased:
   trash is trash, and two different trash mobs must not share a ceiling. */
export function ventiusTargetKey(name: string){
  const bare = bareBoss(name);
  if(!bare) return "";
  const open = openBoss(bare);
  if(open) return "open:" + open.en;
  const g = bossGroup(bare);
  if(g) return "boss:" + g[0];
  return "name:" + bare.toLowerCase();
}

/* Every number here is a maximum, which is what makes re-reading safe: the
   watcher loads the same growing file every two seconds, and a log read twice
   must not move a single figure. */
/* Das Nachlesen der Rekorde (32-history.ts, histNachlesen) liest alte Logs,
   ohne dass Gespeichertes sich aendert: solange lernt Ventius nichts dazu. */
let ventiusLernen = true;
export function setVentiusLernen(an: boolean){ ventiusLernen = an; }
export function learnVentius(segs: Encounter[]){
  if(!ventiusLernen) return;
  let changed = false;
  state.ventiusBy = new Set();
  for(const seg of segs){
    const per = new Map();
    for(const c of ventiusCasts(seg)){
      if(c.source) state.ventiusBy.add(c.source);
      const w = ventiusWaves(c);
      if(!w) continue;                       // unreadable shape, says nothing
      let t = per.get(c.target);
      if(!t){ t = {name:c.target, top:0, atTop:0, casts:0}; per.set(c.target, t); }
      t.casts++;
      if(w > t.top){ t.top = w; t.atTop = 1; }
      else if(w === t.top) t.atTop++;
    }
    for(const t of per.values()){
      const key = t.top ? ventiusTargetKey(t.name) : "";
      if(!key) continue;
      let rec = state.ventiusTop[key];
      if(!rec){
        if(Object.keys(state.ventiusTop).length >= VENTIUS_TOP_CAP) continue;
        rec = state.ventiusTop[key] = {name:t.name, waves:0, atTop:0, casts:0};
        changed = true;
      }
      if(t.top > rec.waves){
        rec.waves = t.top; rec.atTop = t.atTop; rec.casts = t.casts;
        rec.name = t.name; changed = true;
      } else if(t.top === rec.waves){
        if(t.atTop > rec.atTop){ rec.atTop = t.atTop; changed = true; }
        if(t.casts > rec.casts){ rec.casts = t.casts; changed = true; }
      }
    }
  }
  if(changed) persistPref("ventiusTop", state.ventiusTop);
}

/* group hits into casts, per skill */
export function casts(seg: Encounter){
  /* Ein fremder Kampf bringt seine Einsaetze mit - sie aus nachgebauten
     Ereignissen abzuleiten gaebe einen Einsatz je Sekunde und damit eine
     Rotation, die es nie gab. */
  if(seg && seg.castsFest) return seg.castsFest;
  const by = new Map<string, SkillCast[]>();
  /* Ventius is counted by its shape rather than by a window - see
     ventiusPresses(). Held back and done at the end so the whole volley is
     in front of the counter at once. */
  const volley = [];
  for(const e of seg.events){
    if(e.skill === VENTIUS_NAME){ volley.push(e); continue; }
    let list = by.get(e.skill);
    if(!list){ list = []; by.set(e.skill, list); }
    const last = list[list.length-1];
    const win = CAST_WINDOW;
    if(last && e.t - last.last <= win){
      last.dmg += e.dmg; last.hits++; last.last = e.t;
      if(e.crit) last.crit++;
    } else {
      list.push({t:e.t, last:e.t, dmg:e.dmg, hits:1, crit:e.crit?1:0});
    }
  }
  if(volley.length) by.set(VENTIUS_NAME, ventiusPresses(volley));
  return by;
}

/* per-second damage, split by skill (top N + the rest) */
/* Every stretch longer than DEAD_TIME with no hit in it, as seconds from the
   start of the fight. Both timelines draw these out of this one scan, so a
   gap is the same object with the same edges on whichever tab you are on.

   Eine Strecke, in der das Ziel unverwundbar war (seg.unverwundbar), ist
   keine Luecke: getroffen wurde, nur schrieb das Spiel kInvincible, und
   segment() nahm diese Zeilen aus seg.events (Issue #37). Hier gilt sie
   als belegt - weder Leerzeit noch Pausenband; sie hat ihr eigenes Band
   (unverwundbarOf). */
export function gapsOf(seg: Encounter){
  const out: { from: number; to: number; len: number }[] = [], ev = seg.events;
  // ein einzelner Treffer (von = bis) ist ein Punkt: er teilt keine Pause
  const inv = (seg.unverwundbar || []).filter(u => u.bis > u.von);
  if(!inv.length){
    for(let i=1;i<ev.length;i++){
      const p = (ev[i-1]!.t - seg.start)/1000, q = (ev[i]!.t - seg.start)/1000;
      if(q - p > DEAD_TIME) out.push({from:p, to:q, len:q - p});
    }
    return out;
  }
  // Treffer sind Punkte, die Strecken Spannen: beide der Reihe nach
  let k = 0, bis = -Infinity;
  const weiter = (von: number, ende: number) => {
    if(bis > -Infinity && von - bis > DEAD_TIME) out.push({from:bis, to:von, len:von - bis});
    if(ende > bis) bis = ende;
  };
  for(const e of ev){
    const t = (e.t - seg.start)/1000;
    while(k < inv.length && inv[k]!.von/1000 <= t){ weiter(inv[k]!.von/1000, inv[k]!.bis/1000); k++; }
    weiter(t, t);
  }
  for(; k < inv.length; k++) weiter(inv[k]!.von/1000, inv[k]!.bis/1000);
  return out;
}
/* Die Strecken mit einer Laenge, in den Sekunden von gapsOf. Ein
   einzelner Treffer auf Unverwundbare ist ein Punkt und bekommt kein Band. */
export function unverwundbarOf(seg: Encounter){
  return (seg.unverwundbar || []).filter(u => u.bis > u.von)
    .map(u => ({from: u.von/1000, to: u.bis/1000, len: (u.bis - u.von)/1000}));
}
/* The stretch of fight between two gaps that a given second falls in, or
   null if that second is inside a gap. Clicking one zooms to it. */
export function burstAt(seg: Fight, sec: number){
  const T = seg.stats.seconds || 1;
  let from = 0;
  for(const g of gapsOf(seg)){
    if(sec < g.from) return {from, to:g.from};
    if(sec < g.to) return null;
    from = g.to;
  }
  return {from, to:T};
}
export function gapAt(seg: Fight, sec: number){
  for(const g of gapsOf(seg)) if(sec >= g.from && sec < g.to) return g;
  return null;
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  state.weaponOf = {};       // skill name -> weapon
  state.weaponById = {};     // skill id   -> weapon, survives a client language change
  state.runs = [];           // saved build runs
  state.runSeq = 1;
}
