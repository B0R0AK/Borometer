import { EXCLUDE_RX, state } from "./01-state";
import { looksTimestamp, parseTime, truthy } from "./03-helpers";
import { NAME_TO_ENTRY } from "./10-skill-names";
import type { ColumnMapping, ColumnProfile, ColumnRole, CombatEvent, ParsedGrid } from "../types";

/* ---------- CSV / delimiter ---------- */
/* `raw` keeps the fields exactly as they stood in the line. Only the rejoin
   below needs it: trimming happens per field, so by the time a row is an
   array the space in "Quente, Executor of the Seal" is already gone and no
   join can put it back. */
export function splitLine(line: string, d: string, raw?: boolean){
  const out=[]; let cur="", q=false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(q){
      if(ch === '"'){ if(line[i+1] === '"'){ cur+='"'; i++; } else q=false; }
      else cur += ch;
    } else if(ch === '"'){ q = true; }
    else if(ch === d){ out.push(cur); cur=""; }
    else cur += ch;
  }
  out.push(cur);
  return raw ? out : out.map(s => s.trim());
}
function detectDelim(lines: string[]){
  const cands = [",","\t",";","|"];
  let best = ",", bestScore = -1;
  for(const d of cands){
    const counts = lines.map(l => splitLine(l,d).length);
    const mode: Record<string, number> = {}; counts.forEach(c => mode[c] = (mode[c]||0)+1);
    let top = 0, topN = 0;
    for(const k in mode) if(mode[k]! > topN){ topN = mode[k]!; top = +k; }
    if(top < 3) continue;
    const score = topN/counts.length * Math.min(top,14);
    if(score > bestScore){ bestScore = score; best = d; }
  }
  return best;
}

/* ---------- putting a split field back together ----------
   The log is separated by commas and quotes nothing, so a name with a comma
   in it arrives as two fields and the row comes out one field too wide.
   Measured on a real Tumgir Hollow log: the end boss is called "Quente,
   Executor of the Seal", and every one of his 3535 rows - 18% of the file,
   the whole boss fight - was dropped as unparseable. Nothing said so.

   Which field was split can be worked out rather than guessed. The rows that
   ARE the right width say what each column looks like: some hold numbers,
   some hold one of a handful of tokens, the rest are free text. Join a
   different neighbouring pair each time and the one that puts numbers back
   under the number columns is the right one; every other join shifts the row
   and lands text in them. A row whose best join is not clearly better than
   the second best is left out, as before - a guess here would be worse than
   a missing row. */
const NUMERIC = /^-?\d+([.,]\d+)?$/;

export function columnProfile(rows: string[][], width: number){
  const prof = [];
  const sample = rows.length > 400 ? rows.slice(0, 400) : rows;
  for(let i = 0; i < width; i++){
    let num = 0;
    const seen = new Set();
    for(const r of sample){
      const v = String(r[i] == null ? "" : r[i]).trim();
      if(NUMERIC.test(v)) num++;
      if(seen.size <= 12) seen.add(v);
    }
    prof.push({
      num: sample.length ? num / sample.length : 0,
      // a small fixed vocabulary is strong evidence; anything wider is a name
      // and says nothing about where a join belongs
      tokens: seen.size <= 12 ? seen : null
    });
  }
  return prof;
}

function fitScore(row: string[], prof: ColumnProfile){
  let sc = 0;
  for(let i = 0; i < prof.length; i++){
    const p = prof[i]!;
    const v = String(row[i] == null ? "" : row[i]).trim();
    if(p.num >= 0.95) sc += NUMERIC.test(v) ? 2 : -3;
    else if(p.tokens) sc += p.tokens.has(v) ? 2 : -2;
  }
  return sc;
}

/* Takes the UNTRIMMED fields and returns the row rejoined to `width`, or null
   when no join stands out. Untrimmed because the join has to happen before the
   trimming does: the game writes "Quente, Executor of the Seal" with a space
   after the comma, and that space is part of the name - it has to survive, or
   the name no longer matches the one in the dungeon table. */
export function rejoinRow(raw: string[], width: number, delim: string, prof: ColumnProfile){
  const extra = raw.length - width;
  if(extra <= 0 || !prof) return null;
  let best = null, bestScore = -Infinity, runnerUp = -Infinity;
  for(let s = 0; s + extra < raw.length; s++){
    const cand = raw.slice(0, s)
                    .concat([raw.slice(s, s + extra + 1).join(delim)])
                    .concat(raw.slice(s + extra + 1))
                    .map(v => v.trim());
    const sc = fitScore(cand, prof);
    if(sc > bestScore){ runnerUp = bestScore; bestScore = sc; best = cand; }
    else if(sc > runnerUp) runnerUp = sc;
  }
  return (bestScore > runnerUp && bestScore >= 0) ? best : null;
}

/* ---------- parsing into a grid ---------- */
export function parseGrid(text: string){
  state.logVersion = null;
  const lines = text.split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => {
      if(!l || /^(#|\/\/)/.test(l)) return false;
      const v = l.match(/^CombatLogVersion\s*[,;\t]\s*(\d+)/i);
      if(v){ state.logVersion = v[1]!; return false; }
      return true;
    });
  if(!lines.length) return null;

  const delim = state.delim === "auto" ? detectDelim(lines.slice(0,200)) : state.delim;
  let rows = lines.map(l => splitLine(l, delim));
  /* Die Breiten aller Zeilen bleiben am Ergebnis: haengt Live ein Stueck an
     (loadTail in 32-history.ts), muss die haeufigste Breite dieselbe
     bleiben, sonst waere das ganze Laden zu einem anderen Schluss gekommen. */
  const widths: Record<string, number> = {};
  rows.forEach(r => widths[r.length] = (widths[r.length]||0)+1);
  const width = modeWidth(widths);
  /* A row of the wrong width used to be dropped here, silently. Too wide is
     usually a name with the delimiter in it and can be put back together;
     what is left over is counted rather than thrown away, because a line the
     parser cannot use is also what hand-editing a log leaves behind.

     Only the full parse counts. parseGridTail drops its last line on purpose
     while the game is mid-write, so counting there would report the normal
     case as a finding. */
  /* Counted, not stored: parseGrid used to write straight into
     state.integrity, which meant a file that turned out to be unusable left
     its figures behind on the file that was still loaded. The caller takes
     these over only once it has decided to keep the text. */
  const rowsSeen = rows.length;
  const exact = rows.filter(r => r.length === width);
  const prof = exact.length ? columnProfile(exact, width) : null;
  let merged = 0;
  if(prof && exact.length < rows.length){
    rows = rows.map((r, i) => {
      if(r.length === width) return r;
      const fixed = rejoinRow(splitLine(lines[i]!, delim, true), width, delim, prof);
      if(fixed) merged++;
      return fixed || r;
    });
  }
  rows = rows.filter(r => r.length === width);
  const counts = {rowsSeen: rowsSeen, rowsKept: rows.length, rowsMerged: merged,
                  rowsDropped: rowsSeen - rows.length};
  if(!rows.length) return null;

  let hasHeader;
  if(state.headerMode === "yes") hasHeader = true;
  else if(state.headerMode === "no") hasHeader = false;
  else {
    const first = rows[0]!.join(" ").toLowerCase();
    const anyNumeric = rows[0]!.some(v => /^-?\d+([.,]\d+)?$/.test(String(v).trim()));
    hasHeader = /time|damage|dmg|skill|source|target|event|crit|player|name|ziel|schaden/.test(first)
             && !anyNumeric
             && !looksTimestamp(rows[0]![0]!);
  }
  const headers = hasHeader ? rows[0]!.slice() : rows[0]!.map((_,i) => "\u0000"+(i+1));
  const body = hasHeader ? rows.slice(1) : rows;
  // kept for parseGridTail: live logging appends rows through it, and a boss
  // with a comma in his name would otherwise go missing for exactly as long
  // as the fight lasts
  /* stable: was ein spaeteres Stueck noch aendern koennte, steht fest. Das
     Trennzeichen kommt aus den ersten 200 Zeilen, das Spaltenprofil aus den
     ersten 400 Zeilen voller Breite, profile() und autoMap() lesen die
     ersten 600 Zeilen. Vorher laedt Live die Datei jedes Mal ganz. */
  const stable = exact.length >= 400 && body.length >= 600;
  /* version: die Zahl aus "CombatLogVersion,x" am Ergebnis selbst, nicht nur
     in state.logVersion - autoMap() liest sie von hier, damit sie zur Datei
     gehoert, die es zuordnet (Pruefung 01.10., N4). */
  const version: string | null = state.logVersion;
  return {delim, headers, rows:body, hasHeader, prof, counts, widths, stable, version};
}

/* Die haeufigste Zeilenbreite; bei Gleichstand die kleinere (for...in geht
   ganze Zahlen aufsteigend durch, und nur ein groesserer Zaehler gewinnt). */
export function modeWidth(c: Record<string, number>){
  let w=0,n=0; for(const k in c) if(c[k]!>n){n=c[k]!; w=+k;} return w;
}

/* ---------- column profiling + auto mapping ---------- */
export function profile(grid: ParsedGrid){
  const n = grid.headers.length;
  const sample = grid.rows.slice(0, 600);
  const cols = [];
  for(let c=0;c<n;c++){
    const vals = sample.map(r => (r[c]||"").trim()).filter(v => v !== "");
    const distinct = new Set(vals);
    let ts=0, num=0, bool=0, sum=0, numN=0;
    const nums = [];
    for(const v of vals){
      if(looksTimestamp(v)) ts++;
      if(/^-?\d+(\.\d+)?$/.test(v)){ num++; const f = parseFloat(v); sum += f; numN++; nums.push(f); }
      if(/^(0|1|true|false|t|f|y|n|yes|no|-)$/i.test(v)) bool++;
    }
    const k = vals.length || 1;
    const mean = numN ? sum/numN : 0;
    let sd = 0;
    if(numN > 1){
      let acc = 0;
      for(const f of nums) acc += (f-mean)*(f-mean);
      sd = Math.sqrt(acc/(numN-1));
    }
    cols.push({
      i:c, name:grid.headers[c]!,
      tsFrac:ts/k, numFrac:num/k, boolFrac:bool/k,
      distinct:distinct.size, mean, sd, cv: mean ? sd/Math.abs(mean) : 0,
      min: numN ? Math.min(...nums) : 0, max: numN ? Math.max(...nums) : 0,
      // Distinct values, not the first three. A column that reads "Detonation
      // Mark · Detonation Mark · Detonation Mark" spends three slots saying
      // one thing, while variation — an id repeats, damage never does — is
      // exactly what you judge a column by. One value now means "always this".
      samples:[...new Set(vals)].slice(0,3),
      sample:vals.slice(0,3).join("  ·  ")   // still the bug report's flat form
    });
  }
  return cols;
}

/* Die Spalten, die das Spiel unter "CombatLogVersion,4" schreibt, ohne Kopf:
   Zeit, Ereignis, Faehigkeit, Faehigkeits-ID, Schaden, kritisch, wuchtig,
   Trefferart, Quelle, Ziel. Steht die Version da und passt die Form, gilt
   diese Zuordnung statt der Heuristik. Die Heuristik raet aus den ersten
   Zeilen, und am Anfang eines Logs - Live liest genau den - sind das wenige:
   im Fehlerbericht vom 28.09. (Uebungspuppe, acht Zeilen, Schaden 719 bis
   1209) nahm sie die Faehigkeits-ID als Schaden, rund 940 Millionen je
   Treffer. */
/* In der Reihenfolge, in der die Heuristik die Rollen vergibt: der
   Fehlerbericht schreibt die Zuordnung so hin, wie sie steht. */
const V4: ColumnMapping = {time:0, crit:5, heavy:6, damage:4, skillId:3, event:1, skill:2,
                           hitType:7, source:8, target:9};
function v4Passt(grid: ParsedGrid, cols: ReturnType<typeof profile>){
  return grid.version === "4" && !grid.hasHeader && cols.length === 10
    && cols[0]!.tsFrac >= .6
    && [3,4,5,6].every(i => cols[i]!.numFrac >= .8)
    && [5,6].every(i => cols[i]!.boolFrac >= .85);
}

export function autoMap(grid: ParsedGrid, cols: ReturnType<typeof profile>){
  if(v4Passt(grid, cols)) return Object.assign({}, V4);
  const map: ColumnMapping = {};
  const taken = new Set();
  const use = (role: ColumnRole, i: number) => { if(i!=null && i>=0 && !taken.has(i)){ map[role]=i; taken.add(i); } };

  if(grid.hasHeader){
    const byName = (rx: RegExp) => cols.find(c => !taken.has(c.i) && rx.test(c.name));
    const pick = (role: ColumnRole, rx: RegExp) => { const c = byName(rx); if(c) use(role, c.i); };
    pick("time",   /^(time|timestamp|zeit|datum|date|ts)$/i);
    pick("time",   /time|stamp|zeit|datum/i);
    pick("skillId", /skill.?id|ability.?id|^id$/i);
    pick("damage", /damage|dmg|schaden|amount|value/i);
    pick("crit",   /crit/i);
    pick("heavy",  /heavy|hard|charge|wucht/i);
    pick("event",  /event|kind|category/i);
    pick("skill",  /skill|ability|spell|talent|name/i);
    pick("hitType",/hit.?type|attack.?type|type/i);
    pick("source", /source|attacker|caster|player|from|von/i);
    pick("target", /target|victim|enemy|to|ziel/i);
  }

  // time
  if(map.time == null){
    const c = cols.filter(c => !taken.has(c.i) && c.tsFrac >= .6).sort((a,b)=>b.tsFrac-a.tsFrac || a.i-b.i)[0];
    if(c) use("time", c.i);
  }
  // flags: few distinct, boolean-looking
  const flags = cols.filter(c => !taken.has(c.i) && c.boolFrac >= .85 && c.distinct <= 3);
  if(map.crit == null && flags[0]) use("crit", flags[0].i);
  if(map.heavy == null && flags[1]) use("heavy", flags[1].i);

  // damage: numeric, not an id (an id is fully determined by a text column)
  if(map.damage == null){
    const nums = cols.filter(c => !taken.has(c.i) && c.numFrac >= .8 && c.distinct > 3);
    const textCols = cols.filter(c => c.numFrac < .5 && c.tsFrac < .5);
    const determined = (c: ReturnType<typeof profile>[number]) => textCols.some(t => {
      const m = new Map();
      for(const r of grid.rows.slice(0,400)){
        const k = r[t.i], v = r[c.i];
        if(k == null || v == null || k === "") continue;
        if(m.has(k) && m.get(k) !== v) return false;
        m.set(k, v);
      }
      return m.size > 1;
    });
    const free = nums.filter(c => !determined(c));
    /* Eine Kennung erkennt man an ihrer Form: gross und eng um sich selbst.
       Steht unter allen Kennungen derselbe Name (an der Puppe heisst jeder
       Treffer "Claw", unter vier IDs), sagt determined() darueber nichts -
       und der Rueckfall unten auf den groessten Mittelwert nahm sie.
       Gemessen (Pruefung 01.10., M2) ueber 99 Logs und 248.048 Zeilen: jede
       Faehigkeits-ID ist neunstellig, von 939.780.553 bis 981.417.584, also
       4,43 % Abstand; der hoechste Treffer war 1.079.629. Die Schwelle: ab
       100 Millionen, alle Werte mit gleich vielen Stellen, hoechstens 25 %
       Abstand - gut fuenfmal die gemessene Spanne, und ein Treffer muesste
       fast hundertmal so hoch sein wie der hoechste gesehene. */
    const stellen = (x: number) => String(Math.trunc(Math.abs(x))).length;
    const idLike = (c: ReturnType<typeof profile>[number]) => c.min >= 1e8 && stellen(c.min) === stellen(c.max)
      && c.max - c.min <= c.min * 0.25;
    const keineId = (l: typeof nums) => l.filter(c => !idLike(c));
    const pool = keineId(free).length ? keineId(free)
               : keineId(nums).length ? keineId(nums)
               : free.length ? free : nums;
    // damage swings from hit to hit; a skill or entity id sits in a narrow band
    const varied = pool.filter(c => c.cv >= 0.15 && c.min < c.max*0.5);
    const rank = varied.length ? varied : pool;
    const best = rank.sort((a,b) => b.mean - a.mean)[0];
    if(best) use("damage", best.i);
    if(map.skillId == null){
      // A skill id is a wide integer that barely moves relative to its own
      // size. Look at every untaken numeric column, not just the damage
      // candidates — a stable id is "determined" by the skill name, which
      // is exactly why the damage heuristic above throws it out.
      const id = cols.filter(c => !taken.has(c.i) && c.numFrac >= .8
                                  && c.min > 1000 && c.cv < 0.5)
                     .sort((a,b) => a.cv - b.cv || b.distinct - a.distinct)[0];
      if(id) use("skillId", id.i);
    }
  }

  // remaining text columns, left to right
  const rest = cols.filter(c => !taken.has(c.i) && c.numFrac < .8);
  if(map.event == null && rest.length >= 2 && rest[0]!.distinct <= 10
     && rest[0]!.distinct <= rest[1]!.distinct) use("event", rest[0]!.i);
  const rest2 = rest.filter(c => !taken.has(c.i));
  const order: ColumnRole[] = rest2.length >= 4 ? ["skill","hitType","source","target"]
              : rest2.length === 3 ? ["skill","source","target"]
              : rest2.length === 2 ? ["skill","target"] : ["skill"];
  rest2.forEach((c,idx) => { if(order[idx] && map[order[idx]] == null) use(order[idx], c.i); });
  return map;
}

/* ---------- build events ----------
   In zwei Schritten, damit Live nur die neuen Zeilen rechnet (Spezifikation
   Live-Leistung 3): buildEvents() faengt bei der ersten Zeile an,
   appendEvents() dort, wo der letzte Aufruf aufgehoert hat. Beide gehen durch
   ereignisseAus(), und was ueber alle Ereignisse zaehlt - die Uhr ueber
   Mitternacht, Zeilen gegen die Zeit, eine Kennung unter zwei Namen,
   Angreifer, Trefferarten, Ereignisarten - fuehrt der Lauf fort. So kommt
   ein Log in vielen Stuecken auf genau dasselbe wie am Stueck. */
interface EventLauf {
  /** wie viele Zeilen von state.parsed schon Ereignisse sind */
  rows: number;
  prev: number | null;
  dayShift: number;
  wall: boolean;
  /** die Zeit des letzten Ereignisses in Dateireihenfolge, und die spaeteste von allen */
  lastRaw: number | null;
  maxT: number;
  backwards: number;
  firstName: Map<string, string>;
  clash: Set<string>;
  bySrc: Map<string, number>;
  hits: Map<string, { n: number; dmg: number }>;
  types: Set<string>;
  /** das Feld, das dieser Lauf fuellt; ein neues buildEvents() beginnt ein anderes */
  events: CombatEvent[];
}
let lauf: EventLauf | null = null;

export function buildEvents(){
  const g = state.parsed, m = state.mapping;
  if(!g) return;
  state.noTime = m.time == null;
  lauf = {rows: 0, prev: null, dayShift: 0, wall: false, lastRaw: null, maxT: -Infinity, backwards: 0,
          firstName: new Map(), clash: new Set(), bySrc: new Map(), hits: new Map(), types: new Set(),
          events: []};
  ereignisseAus(lauf, g, m);
}

/* Die Zeilen, die seit dem letzten Aufruf an state.parsed.rows gehaengt
   wurden. false, wenn das so nicht geht: noch kein Lauf, ein anderes
   state.events, oder ein neues Ereignis liegt vor einem alten (ein von Hand
   bearbeitetes Log) - dann muss alles neu sortiert werden, und der Aufrufer
   ruft buildEvents(). */
export function appendEvents(){
  const g = state.parsed, m = state.mapping;
  if(!g || !lauf || lauf.events !== state.events || lauf.rows > g.rows.length) return false;
  return ereignisseAus(lauf, g, m);
}

/* Steuerzeichen des Spiels in einem Namen: "^<s=Dialogue_Speech_Text>"
   vorn und "^</s>" hinten. Im Log vom 29.09. stand so der Koloss Vegamor
   ("Vagamont"), und die Kampfwahl zeigte es Zeichen fuer Zeichen. Sie
   kommen aus jedem Namen, Ziel, Quelle und Faehigkeit; was uebrig bleibt,
   ist der Name, wie ihn das Spiel zeigt. */
const STEUER = /\^<\/?[^<>]*>/g;
export const ohneSteuer = (n: string | undefined) => n && n.indexOf("^<") >= 0 ? n.replace(STEUER, "").trim() : (n || "");

function ereignisseAus(l: EventLauf, g: ParsedGrid, m: ColumnMapping){
  const ev: CombatEvent[] = [];
  let prev = l.prev, dayShift = l.dayShift, wall = l.wall;

  for(let i=l.rows;i<g.rows.length;i++){
    const r = g.rows[i]!;
    const dmgRaw = m.damage != null ? String(r[m.damage]||"").replace(/[ ,'](?=\d)/g,"") : "";
    const dmg = parseFloat(dmgRaw);
    let t;
    if(m.time != null){
      const p = parseTime(r[m.time]);
      if(!p) continue;
      let ms = p.ms;
      if(p.wall) wall = true;
      if(!p.wall){
        if(prev != null && ms + dayShift < prev - 6*3600e3) dayShift += 86400e3;
        ms += dayShift;
      }
      prev = ms;
      t = ms;
    } else {
      t = i * 200;                     // no clock in the file: even spacing, DPS is meaningless
    }
    ev.push({
      t,
      event: m.event   != null ? (r[m.event]||"")   : "",
      skill: m.skill   != null ? (ohneSteuer(r[m.skill])||"\u2014")  : "\u2014",
      sid: m.skillId != null ? String(r[m.skillId]||"") : "",
      dmg: isFinite(dmg) ? dmg : 0,
      crit: m.crit != null && truthy(r[m.crit]),
      heavy: m.heavy != null && truthy(r[m.heavy]),
      hitType: m.hitType != null ? (r[m.hitType]||"") : "",
      /* The exact token, not a pattern. A loose match would have to guess
         at strings this app has never seen, and autoMap assigns hitType by
         position on a log without a header row - so the column can hold
         something else entirely. Failing quiet is the right direction for
         a tool that is read rather than debugged. */
      shield: m.hitType != null && r[m.hitType] === "kDamageShieldHit",
      source: m.source != null ? (ohneSteuer(r[m.source])||"\u2014") : "\u2014",
      target: m.target != null ? (ohneSteuer(r[m.target])||"\u2014") : "\u2014"
    });
  }
  /* Sortiert wird das neue Stueck fuer sich. Liegt sein fruehestes Ereignis
     nicht hinter dem spaetesten der alten, waere die ganze Reihe eine andere
     als am Stueck - dann rechnet buildEvents() alles neu. Bis hierher ist
     nichts uebernommen. */
  const sorted = ev.slice().sort((a,b) => a.t - b.t);
  if(sorted.length && sorted[0]!.t < l.maxT) return false;
  l.rows = g.rows.length; l.prev = prev; l.dayShift = dayShift; l.wall = wall;
  state.wall = wall;
  /* Two more counts off the file itself, taken before the sort because the
     sort is what would hide the first of them.

     Out-of-order timestamps: the game writes in order, an editor insert
     usually does not. Only meaningful on ONE file - readFiles joins several
     into one text on purpose - so the file count travels with the number
     rather than a verdict.

     One skill id under two names, but only when the two names are two
     different SKILLS. Two spellings of one skill is the normal case and not
     evidence of anything: the game writes skill names in the client's own
     language, and that language can change inside a single file. Measured on
     a real log where the client was switched mid-session, 30 of 32 ids
     carried both spellings and nothing at all was wrong with it - counting
     those would have reported a clean log as tampered with, which is the one
     mistake this whole block must not make.

     So the two names are put through the dictionary by NAME, not by id: by id
     they would resolve to the same entry whatever the name said, which would
     answer nothing. A name the dictionary does not know is not counted
     either - not knowing is not evidence. Borometer's own Ventius renaming
     never trips this, because it rewrites the id together with the name. */
  for(const e of ev){
    if(l.lastRaw != null && e.t < l.lastRaw) l.backwards++;
    l.lastRaw = e.t;
  }
  const firstName = l.firstName, clash = l.clash;
  for(const e of ev){
    if(!e.sid || !e.skill) continue;
    const had = firstName.get(e.sid);
    if(had === undefined){ firstName.set(e.sid, e.skill); continue; }
    if(had === e.skill) continue;
    const a = NAME_TO_ENTRY[had], b = NAME_TO_ENTRY[e.skill];
    // compared by what the entries say, not by object identity: one skill can
    // reach the table through several ids and so through several entries
    if(a && b && (a.en !== b.en || a.de !== b.de)) clash.add(e.sid);
  }
  state.integrity = Object.assign({}, state.integrity, {
    backwards: l.backwards,
    files: (state.fileNames || []).length,
    sidClash: clash.size,
    sidClashExamples: [...clash].slice(0, 3)
  });

  if(sorted.length) l.maxT = sorted[sorted.length-1]!.t;
  /* Ein ganzes Laden baut alles neu aus der Datei - "Leeren" kann deshalb
     nicht einfach state.encounters leeren, das naechste ganze Laden holte
     alles zurueck. Was haelt, ist ein gemerkter Zeitschnitt, und er gilt
     auch fuer jedes Stueck, das Live danach anhaengt. */
  const cut = state.clearBefore;
  const filtered = cut != null ? sorted.filter(e => e.t > cut) : sorted;
  /* Unknown, not zero. Without a hit-type column a fight has no shield
     figure at all, and that is a different statement from "none" - the
     difference decides between an em dash and a 0 wherever this is
     carried, here and in a saved run. */
  state.noHitType = m.hitType == null;
  // angehaengt, nicht ersetzt: segmentTail() (05-fights.ts) erkennt am selben
  // Feld, dass es weiterschneiden darf
  for(const e of filtered) l.events.push(e);
  state.events = l.events;

  // attacker list, most damage first
  const bySrc = l.bySrc;
  for(const e of filtered) if(e.dmg > 0) bySrc.set(e.source, (bySrc.get(e.source)||0) + e.dmg);
  state.players = [...bySrc.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);

  /* What the hit-type column actually said, counted before anything is
     dropped. A row with no damage never becomes an event - a miss is exactly
     that - so without this tally the app has no way of knowing such rows were
     ever in the file. Measured on one log: 13 kMiss, and two tokens
     (kMaxDamageByNormal, kMinDamageByNormal) nobody had seen before. */
  const hits = l.hits;
  for(const e of filtered){
    if(!e.hitType) continue;
    const row = hits.get(e.hitType) || {n: 0, dmg: 0};
    row.n++; row.dmg += e.dmg > 0 ? e.dmg : 0;
    hits.set(e.hitType, row);
  }
  state.hitTypes = Object.fromEntries([...hits.entries()]
    .sort((a,b) => b[1].n - a[1].n)
    .map(([k,v]) => [k, {n: v.n, dmg: Math.round(v.dmg)}]));

  // event types that clearly are not outgoing damage
  const types = l.types;
  for(const e of filtered) if(e.event) types.add(e.event);
  state.eventTypes = [...types];
  state.excludedEvents = new Set([...types].filter(t => EXCLUDE_RX.test(t)));
  return true;
}
