// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Types for the page script in app/. Declarations only - nothing in here
 * runs; the parts take what they need with "import type", which the build
 * erases.
 *
 * Where a function already builds a structure, its type is read off that
 * function (ReturnType<typeof stats>) instead of being written out a second
 * time: the two cannot drift apart that way.
 */

import type { columnProfile, parseGrid } from "./app/04-log-parsing";
import type { dungeonOf, openBoss, stats } from "./app/06-blocks-and-places";
import type { ventiusPass } from "./app/15-weapons-and-ventius";
import type { perSecond, summarise } from "./app/16-fight-analysis";
import type { autoPair } from "./app/42-party";

export type Lang = "de" | "en";

/** What a translated sentence is filled in from: {n}, {name}, ... */
export type I18nVars = Record<string, any>;
/** A translation: plain text with {placeholders}, or a function of the vars. */
export type I18nEntry = string | ((v: I18nVars) => string);

/** One row of the combat log that dealt damage, as buildEvents() makes it. */
export interface CombatEvent {
  /** milliseconds; the log's own clock, or row index x 200 without one */
  t: number;
  event: string;
  skill: string;
  /** skill id, "" when the log has no id column */
  sid: string;
  dmg: number;
  crit: boolean;
  heavy: boolean;
  hitType: string;
  /** a hit the target's shield took (kDamageShieldHit) */
  shield: boolean;
  source: string;
  target: string;
  /** what an Eye of Ventius pass renamed: the skill and id it was before */
  baseSkill?: string;
  baseSid?: string;
}

/** Which column of the log holds what. Missing roles are absent, not -1. */
export type ColumnRole =
  | "time" | "event" | "skill" | "skillId" | "damage" | "crit" | "heavy"
  | "hitType" | "source" | "target";
export type ColumnMapping = Partial<Record<ColumnRole, number>>;

/** A log read into rows and columns (parseGrid gives null for nothing readable). */
export type ParsedGrid = NonNullable<ReturnType<typeof parseGrid>>;
/** What each column of a log tends to hold, measured on its first rows. */
export type ColumnProfile = ReturnType<typeof columnProfile>;
export type FightStats = ReturnType<typeof stats>;
/** One skill's share of a fight, as stats() adds it up. */
export interface SkillStats {
  name: string;
  damage: number;
  hits: number;
  crit: number;
  heavy: number;
  max: number;
  /** absent on a party member's skill: reports do not carry shields */
  shieldDmg?: number;
  shieldHits?: number;
  /** its colour in every chart; set once the list is ranked */
  color?: string;
  /** past the twelve ranks that have a colour of their own */
  rest?: boolean;
  dps?: number;
}

/** A skill once stats() has ranked it: its colour, its rank past twelve, its rate. */
export type RankedSkill = SkillStats & { color: string; rest: boolean; dps: number };

/** One enemy's share of a fight. */
export interface TargetStats {
  name: string;
  damage: number;
  hits: number;
  crit: number;
  max: number;
  shieldDmg: number;
  shieldHits: number;
}

/** One fight: a stretch of events segment() cut out of the log. */
export interface Encounter {
  events: CombatEvent[];
  start: number;
  end: number;
  /** how many stretches were merged into this fight */
  parts?: number;
  /** the boss whose declared phases may follow, or null */
  encBoss?: string | null;
  /** ms actually spent fighting, when merged parts leave holes */
  fought?: number | null;
  ventiusBase?: ReturnType<typeof ventiusPass>;
  ventius?: boolean;
  stats?: FightStats;
  index?: number;
  block?: FightBlock;
  missed?: number;
  /** misses by skill name */
  missSkills?: Map<string, { n: number; sid: string }>;
  invuln?: number;
  invulnDmg?: number;
  /** Strecken, in denen das Ziel unverwundbar war, ms seit Kampfbeginn (unverwundbarStrecken) */
  unverwundbar?: { von: number; bis: number; ziel: string }[];
  castsFest?: Map<string, SkillCast[]>;
  /** someone else's fight, rebuilt from their curve: their name */
  fremd?: string;
}

/*
 * A fight with its figures worked out. segment() computes them before any
 * fight reaches state.encounters, and a party member's fight rebuilt from
 * their curve gets them the moment it is built - so wherever a fight is
 * shown, they are there.
 */
export type Fight = Encounter & { stats: FightStats };

/** A dungeon run or stretch of fights, as blockPass() groups them. */
export interface FightBlock {
  segs: Fight[];
  /** fights in the block that the current filter hides */
  hiddenSegs: Encounter[];
  start: number;
  end: number;
  /** quiet before this block, ms */
  quiet: number;
  hasBoss: boolean;
  /* the rest is filled in by blockPass's second loop, over every block */
  hidden: number;
  /** enemies, most damaged first */
  targets: string[];
  top: string;
  dungeon: ReturnType<typeof dungeonOf>;
  open: ReturnType<typeof openBoss>;
  total: number;
  seconds: number;
  fights: number;
  /** first hit to last, ms */
  span: number;
  index: number;
  /** the only block, and not a known place: drawn without a heading */
  only: boolean;
}

/** The biggest Eye of Ventius volley seen on one enemy (state.ventiusTop). */
interface VentiusTopRecord {
  name: string;
  waves: number;
  atTop: number;
  casts: number;
}

/** A row of the party board, as the host or the party server sends it. */
export interface BoardRow {
  name: string;
  waiting: boolean;
  damage: number;
  dps: number;
  hits: number;
  crit: number;
  heavy: number;
  seconds: number;
  max: number;
  skills: PartySkill[];
  hasCurve: boolean;
  /** only in a saved party log or the sample party: the curve itself */
  curve?: PartyCurve | undefined;
  casts?: PartyCasts[] | undefined;
  share: number;
  onTarget: boolean;
  target: string;
  lang: string;
  /** absent on the page's own sample party */
  weapons?: string[];
  ventius: boolean;
  age: number;
  /** the target's key, worked out by the client when the row arrives */
  targetKey?: string;
}

/** A skill as a party report carries it: the top twelve of a fight. */
interface PartySkill {
  name: string;
  sid?: string;
  damage: number;
  dps?: number;
  hits: number;
  crit: number;
  heavy: number;
  max: number;
  /** by hit type: k the type, d damage, h hits, m the biggest hit */
  cats?: { k: string; d: number; h: number; m: number }[];
}

/** One lane of the damage-per-second chart. */
export interface StackSeries {
  name: string;
  color: string;
  /** damage in each second of the fight */
  values: number[];
  sid?: string;
  /** past the twelve lanes that have a colour of their own */
  rest?: boolean;
}

/** GET /api/party/state, plus what the page adds for a loaded party log. */
export interface PartyView {
  role: null | "host" | "member";
  /** null in a party log saved without one */
  code?: string | null | undefined;
  name?: string;
  address?: string;
  join?: string;
  remote?: boolean;
  board: BoardRow[];
  target?: string | null | undefined;
  error?: string | null;
  /** a party log loaded from disk: nothing live, nothing to refresh */
  frozen?: boolean;
  demo?: boolean;
  /** ISO time the party log was saved */
  savedAt?: string | undefined;
}

/** GET /api/state */
export interface ServerState {
  dir: string;
  settings: string;
  settingsMoved: boolean;
  file: string;
  size: number;
  mtime: number;
  nativeFrame: boolean;
  material: boolean;
  windowBlank: boolean;
  stayOnTop: boolean;
}

/** POST /api/win's answer */
interface WinAnswer {
  ok: boolean;
  error?: string;
  max?: boolean;
  w?: number | null;
  h?: number | null;
  on_top?: boolean;
  alpha?: number;
}

/** An entry in the pick-one dialog (askPick). */
export interface ModalChoice {
  label: string;
  note?: string;
  value: string;
}

interface SortOrder {
  key: string;
  dir: 1 | -1;
}

/** A boss fight remembered in the history (histOneLog). */
export interface HistFight {
  name: string;
  dps: number;
  dmg: number;
  /** seconds */
  dur: number;
  /** when it started, ms */
  at: number;
  /** which log it came from */
  file?: string;
  /** the build it was fought with (47-builds.ts, boro-builds.json); absent before the build journal */
  b?: string;
  /** a practice-dummy attempt: its length class, 60, 120 or 180 s - dps is over that length */
  c?: number;
  /** every damage row of the player in this fight, misses included (spec Steckbrief 3.1); absent before the Steckbrief */
  hits?: number;
  /** of those: critical, heavy, missed (kMiss) */
  crit?: number;
  heavy?: number;
  miss?: number;
  /** the player's biggest single hit in this fight, and the id of the skill that landed it (spec Rekorde 3) - an id of a fixed pattern or "", never a name; absent before the records */
  top?: number;
  topSid?: string;
}

/** The fight history kept across logs (the rail's "history"). */
interface HistoryState {
  /** per log file: its fights, and what was read to find them */
  files: Record<string, { fights?: HistFight[]; [more: string]: unknown }>;
  fights: HistFight[];
  /** the history key of the boss that is open */
  sel: string | null;
  busy: boolean;
  /** the period on the chart (Neugestaltung 28.09., Luecken 6.1); session only, no stored key */
  zeit: "woche" | "monat" | "alles";
}

interface AutoSeen {
  key: string;
  weapons: string[];
}

/*
 * The app's whole state. Fields in the literal in app/01-state.ts are set from the
 * start; the rest are filled in by the parts' setup() before the first paint
 * (see main.ts), or (the optional ones) only once something happens.
 */
export interface AppState {
  errorLog: ErrorLogEntry[];
  text: string;
  fileNames: string[];
  delim: string;
  headerMode: string;
  parsed: ParsedGrid | null;
  mapping: ColumnMapping;
  events: CombatEvent[];
  noTime: boolean;
  players: string[];
  excludedEvents: Set<string>;
  encounters: Fight[];
  sel: number;
  cmp: Set<number>;
  gap: number;
  minDur: number;
  player: string;
  sortSkills: SortOrder;
  sortTargets: SortOrder;
  tab: string;
  start: boolean;   // Bereich Start gewaehlt, auch mit geladenem Log (Instrumententafel 3.3)
  /** Einstellungen stehen (Instrumententafel Stufe 3, 57-einstellungen.ts): ein Ort ohne Kampf wie Start; state.tab bleibt */
  einst: boolean;
  /** Weeklies stehen (Neugestaltung 28.09., Luecke 9.1): ein Ort ohne Kampf wie Start und Einstellungen */
  weeklies: boolean;
  /** Rekorde stehen (Spezifikation Rekorde 2a, 62-rekorde.ts): ein Ort wie die Weeklies */
  rekorde: boolean;
  /** Kampf-Tafel (56-tafel.ts): der Zeitverlauf der Kurve ist aufgeklappt (Kurve bis 540 Punkt mit den vier staerksten Faehigkeiten) */
  zeitAuf: boolean;
  /** Kampf-Tafel: die Faehigkeit, deren Spur die Kurve zeigt (Zeigen oder Fokus in der Tafel), sonst "" */
  kurveSkill: string;

  // set at start-up, by the parts' setup()
  learned: Record<string, any>;
  ventiusTop: Record<string, VentiusTopRecord>;
  runs: SavedRun[];
  runSeq: number;
  cmpSeg: Map<string, SavedRun>;
  cmpRuns: Set<string>;
  /** Vergleich (Neugestaltung 28.09., Luecken 5.1): der Umschalter im Kopf - gegen den besten oder den letzten Pull; null, sobald von Hand gewaehlt ist */
  cmpPaar: "best" | "letzt" | null;
  /** the best and second-best pull per boss and dummy length (46-best-pull.ts) */
  best: BestStore;
  /** Rotation side by side: the whole shorter fight rather than its first 60 s */
  cmpRotAll: boolean;
  /** the builds recognised so far (47-builds.ts) */
  builds: BauStore;
  /** the builds as links to questlog.gg (51-plan.ts, /api/plans) */
  plans: PlanStore;
  /** Questlog's build name that came with a fetch, per plan id - this session only, never written */
  planNames: Record<string, string>;
  integrity: any;
  partyBoss: PartyBossFight[];
  hist: HistoryState;
  party: PartyView;
  partyLog: any[];
  partyServer: string;
  mitgliedKurven: Map<string, MemberCurve>;
  autoSeen: AutoSeen;
  autoRead: ReturnType<typeof autoPair> | null;
  lang: Lang;
  theme: string;
  zoom: number;
  seeThrough: number;
  entfernt: Set<number>;
  entferntAktiv: number;
  expanded: Set<string>;
  expandedSub: Set<string>;
  /** blocks folded shut, by their start time */
  folded: Set<number>;
  trashOpen: Set<string>;
  stackOff: Set<string>;
  stackScale: string;
  stackSmooth: number;
  rotAus?: Set<string>;
  /**
   * "Your rotation" choices kept for this session only (54-deine-rotation.ts), in pots by where they were made:
   * the fight's fingerprint (no build known yet) or, for a build that was full, that build's id
   */
  rotSitzung: Record<string, { fp: { weapons: [string, string]; core: string[] } | null; bau: string | null; rot: Record<string, 0 | 1 | 2> }>;
  rotFrom?: number | null;
  rotTo?: number | null;
  rotZoom: number;
  rotSegStart?: number | null;
  ventiusBy: Set<string>;
  ventiusSeen: Set<string>;
  group: string;
  sortBars: SortOrder;
  weaponOf: Record<string, string>;
  weaponById: Record<string, string>;
  weaponPick: Record<string, any>;
  mainWeapon?: string;
  offWeapon?: string;
  mergePhases: boolean;
  devMode: boolean;
  bearbeiten: boolean;
  clearBefore: number | null;
  filterOpen: boolean;
  moreOpen: boolean;
  openMenuOpen: boolean;
  ghostPref: boolean;
  pinPref?: boolean;
  wasKicked: boolean;
  clipRuns: boolean;
  compactHandSized: boolean;
  /** Kompakt als eigenes Fenster (Nachtraege N4): der Helfer kann es, und diese Seite ist das grosse Fenster */
  zweiFenster: boolean;
  /** ob das Kompaktfenster gerade offen ist (nur im grossen Fenster gepflegt) */
  kompaktOffen: boolean;
  /** Randlos-Hinweis quittiert (Fenster-Extras 3.5); null, bis /api/config antwortet */
  randlosGesehen: boolean | null;
  /** Rundgang beim ersten Start beendet oder uebersprungen (Spezifikation 02.10.2026); null, bis /api/config antwortet */
  rundgangGesehen: boolean | null;
  /** eine neue Installation: der Hauptprozess meldet einen ersten Start (firstStart) und logIndex ist leer; null, bis /api/config antwortet */
  ersterStart: boolean | null;
  zeigeMitglied: string | null;
  kurveLaedt: string | null;

  // only once something has happened
  _cols?: any[];
  _heroDps?: number | null;
  _heroToken?: number;
  assignFight: string;
  blocks?: FightBlock[];
  eventTypes?: string[];
  hitTypes?: Record<string, { n: number; dmg: number }>;
  noHitType?: boolean;
  wall?: boolean;
  minDurDropped?: boolean;
  fromSample: boolean;
  grew: number;
  kicking?: string | null;
  lastChar: string | null;
  lastResize?: WinAnswer;
  logVersion?: string | null;
  modalOpen?: boolean;
  origin: string;
  partyChar: string | null;
  partySince: number | null;
  resizeWarned?: boolean;
  srv?: ServerState;
  srvNow?: ServerState | null;
  weaponByHand: boolean;
}

/*
 * The File System Access API, for "Watch folder" in a plain browser tab.
 * Chromium only, which is why lib.dom does not carry it and why the page
 * asks whether it is there before using it.
 */
declare global {
  /** Set by scripts/build-renderer.mjs from package.json - see BORO_VERSION. */
  const __BORO_VERSION__: string;
  interface Window {
    showDirectoryPicker?(options?: { mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>;
  }
}

/** A name the app shows in the reader's language. */
export interface LocalizedName {
  en: string;
  de?: string;
}

/** A weapon pair's class, as CLASS_NAMES lists them. */
export interface ClassName extends LocalizedName {
  role: "tank" | "dps" | "heal";
}

/** One part of a fact line: text (escaped), or ready markup. Falsy parts are skipped. */
export type FactPart = string | number | { html: string } | null | undefined | false;

/** The button a toast can carry, as in "Undo". */
export interface ToastAction {
  /** plain text, or tt(...) so it follows a language switch */
  label: string | (() => string);
  fn: () => void;
}

/** What openModal() is asked to show. */
export interface ModalOptions {
  title?: string;
  msg?: string;
  withInput?: boolean;
  defaultValue?: string;
  placeholder?: string | undefined;
  choices?: ModalChoice[];
  /** a folder key: OK then opens that folder instead of closing */
  folder?: string | undefined;
  danger?: boolean;
  okLabel?: string;
}

/** How a view setting is applied: quietly (not saved), forced, from the start. */
export interface ViewOptions {
  quiet?: boolean;
  force?: boolean;
  fromStart?: boolean;
  /** beim Start: das Fenster steht schon an seiner gemerkten Lage, nicht neu setzen */
  keepWindow?: boolean;
}

/** One press of Eye of Ventius on one target, as ventiusCasts() groups the hits. */
export interface VentiusCast {
  t: number;
  last: number;
  hits: number;
  dmg: number;
  ev: CombatEvent[];
  target: string;
  source: string;
}

/** A fight kept as a saved run (summarise()); clip() marks one it cut short. */
export type SavedRun = ReturnType<typeof summarise> & {
  clipped?: boolean;
  /** hits estimated rather than counted: an older run without hitsPerSecond */
  estCounts?: boolean;
  /** the rate is off the clock time, holes and all */
  estRate?: boolean;
  /** the casts of the top twelve skills (partyEinsaetze): a fight of the
      loaded log and a best pull carry them, a saved run does not */
  casts?: PartyCasts[] | undefined;
};

/** A pull kept as the best or second best on one boss or dummy length (boro-best.json, 46-best-pull.ts). */
export interface BestPull {
  /** summarise() of the fight, cut to the class length on a dummy, with its casts */
  run: SavedRun;
  /** when the fight began, ms on the log's clock: the pull's identity */
  at: number;
  /** the log it came from */
  file: string;
  /** the Borometer version that kept it */
  ver: string;
}
/** One boss or dummy length: its best pull and the one that best displaced. */
export interface BestEntry {
  best: BestPull;
  second?: BestPull;
}
/** Key "boss:<histKey>" or "dummy:<60|120|180>". */
export type BestStore = Record<string, BestEntry>;

/** A build as boro-builds.json keeps it (47-builds.ts, src/main/builds.ts). */
export interface Bau {
  /** empty until someone names it; shown as "Longbow/Dagger 1" meanwhile */
  name: string;
  /** the pair as first seen, main then off ("" for one weapon) */
  weapons: [string, string];
  /** the skills that carried 80 % of the damage, at most six, as language-free keys (skillKey) */
  core: string[];
  /** a planner link, https only; Borometer never loads it */
  link?: string;
  /** when its first fight began, ms on the log's clock */
  first: number;
  /** "Your rotation" (spec Deine Rotation, 7): skill key (skillKey) -> 1 on its own, 2 I press it, 0 taken back; at most 24 */
  rot?: Record<string, 0 | 1 | 2>;
  /** detached in Builds (its link card, 51-plan.ts): kept, shown no more; ms */
  geloest?: number;
}
/** Key: the build id, ten lower-case letters or digits (build-core.ts, bauId). */
export type BauStore = Record<string, Bau>;
/** A build as a link to questlog.gg (Aufgabe 12 of the redesign, 29.09.): the link, when it was saved,
    the weapons Questlog named and the player's own name ("" when none was given) - Questlog's build name
    lives in the session only (state.planNames). Entries from before keep what the planner stored then
    (ids, levels, numbers, the Steckbrief, Questlog's build name as name); the page reads only these
    fields and writes the rest back untouched. */
export interface Plan {
  link: string;
  at: number;
  name: string;
  weapons: string[];
  /** detached ("Loesen"): kept in boro-plans.json, shown no more; ms */
  geloest?: number;
  /** whatever an older entry carries besides */
  [alt: string]: unknown;
}
/** Key: the plan id, "p" and nine lower-case letters or digits (plan-core.ts, planId). */
export type PlanStore = Record<string, Plan>;
/** A finding of the analysis tab (insights()): a dictionary key and what fills it. */
export interface Insight {
  key: string;
  vars: I18nVars;
  [more: string]: unknown;
}

/** A row of the comparison table: how to read a value off a run, and show it. */
export interface CmpMetric {
  label: string;
  get: (r: SavedRun) => number;
  f: (v: number) => string;
  /** +1 higher is better, -1 lower is, 0 neither */
  better: number;
  /** depends on fight length, so a cut changes it */
  lenDep?: number;
  /** needs a clock in the log */
  clock?: number;
  /** estimated when a run is cut: a rate, or counts */
  est?: string;
  rateDp?: number;
  /** a whole-fight figure, not cut */
  whole?: number;
}

/** A listing of one of the app's folders (GET /api/runs/list and the like). */
export interface FolderListing {
  folder: string;
  files: { name: string; size: number; mtime: number }[];
}

/** Options for one cell of the comparison grid. */
export interface CmpCellOptions {
  kopf?: boolean | number;
  wenig?: boolean | number;
  best?: boolean | number;
  leer?: boolean | number;
  win?: boolean | number;
  /** a note under the value, as markup */
  zu?: string;
  /** 0..1, drawn as a fill behind the value */
  anteil?: number | null;
}

/** One use of a skill: its hits grouped by casts() into one press. */
export interface SkillCast {
  t: number;
  last: number;
  dmg: number;
  hits: number;
  crit: number;
}

/** A cast drawn in the rotation chart, where the pointer can find it again. */
export interface RotationMark {
  x: number;
  y: number;
  mh: number;
  cast: SkillCast;
  name: string;
  sid: string;
}

/** What the rotation chart last drew, for its tooltip. */
export interface RotationHit {
  marks: RotationMark[];
  seg: Fight;
}

/** What the damage-per-second chart last drew, for its tooltip and clicks. */
export interface StackHit {
  ps: ReturnType<typeof perSecond>;
  x0: number;
  x1: number;
  /** the second the view starts and ends at */
  a: number;
  b: number;
  /** pixels per second */
  bw: number;
  w: number;
  h: number;
  seg: Fight;
  zeigen: StackSeries[];
  glatt: number[][];
  summe: number[];
  anteilModus: boolean;
  smooth: number;
  X: (t: number) => number;
  hoehe: number;
}

/** One entry of the error log a bug report carries. */
export interface ErrorLogEntry {
  t: string;
  what: string;
  where: string;
}

/** A skill's name in both languages, as SKILL_ID_NAME lists it. */
export interface SkillNames {
  en: string;
  de?: string;
}

/** A weapon's line drawing, for dark (d) and light (h) grounds. */
export interface WeaponIcon {
  d: string;
  h: string;
}

/** What a skill core does to its skill (SKILL_CORE): changes it, or is its own. */
export interface SkillCoreInfo {
  base?: string;
  bases?: string[];
  parent?: string;
  weapon?: string;
  /** a skill of its own rather than a change to one */
  eigen?: boolean;
  /** recognised by the app from the log rather than listed */
  gemessen?: boolean;
  /** a dictionary key for one more sentence in the tooltip */
  dazu?: string;
}

/** A dungeon or raid the app knows by its bosses (DUNGEONS). */
export interface Dungeon extends LocalizedName {
  /** a dungeon's star rating, or */
  stars?: number;
  /** a raid's level */
  lvl?: number;
  /** a solo dungeon */
  solo?: boolean;
  /** the raid a part belongs to */
  of?: LocalizedName;
  boss: string[];
  /** bosses fought as one encounter, in groups */
  bosses?: string[][];
  /** a boss whose fight moves to other enemies for a phase: boss -> them */
  phases?: Record<string, string[]>;
  /** a boss under another name - the same enemy, not an add: boss -> its other names */
  forms?: Record<string, string[]>;
  /** a boss whose fight has no pause: quiet longer than this many seconds is a wipe, a new pull (PHASE_GAP otherwise) */
  wipeGap?: number;
}

/* The figures every row of the damage table carries. */
export interface BarFigures {
  damage: number;
  /** absent on a skill in a report from an older Borometer */
  dps?: number | undefined;
  hits: number;
  share: number;
  crit?: number;
  heavy?: number;
  /** null where a party member's report did not carry it */
  max: number | null;
  critRate: number | null;
  heavyRate: number | null;
  shieldDmg?: number;
  /** the sort column is read off a row by its key */
  [column: string]: unknown;
}

/*
 * A row of the damage table: a skill, target, weapon or player of your own
 * fight (groupRows), or a member of the party (partyGroupRows).
 */
export interface BarRow extends BarFigures {
  dps: number;
  /* a row of its own always has these; only a reported skill can lack them */
  max: number;
  critRate: number;
  heavyRate: number;
  name: string;
  label: string;
  color: string;
  sid?: string;
  rest?: boolean;
  /** markup: a skill icon, a boss portrait, a weapon pair */
  icon?: string | null;
  /** what the row opens into: hit types, or a member's skills */
  subs: BarSubRow[];
}

/* A row a BarRow opens into. A party member's skill opens once more, into its hit types. */
export interface BarSubRow extends BarFigures {
  key: string;
  label: string;
  name?: string;
  sid?: string;
  color?: string;
  /** the row this one belongs to */
  parent?: string;
  subs?: BarSubRow[];
}

/** A fight as a party member reports it: damage per second, and per skill once it stands (partyKurve). */
export interface PartyCurve {
  /** wall clock of the start, when the log has one */
  t0: number | null;
  /** seconds */
  T: number;
  total: number[];
  lanes?: { n: string; sid: string; v: number[] }[] | undefined;
}

/** A party member's casts of one skill: [start, end, damage, hits, crits], ms from the fight's start. */
export interface PartyCasts {
  n: string;
  s: string;
  c: [number, number, number, number, number][];
}

/** Another member's curve, fetched once and kept while their row stays the same. */
export interface MemberCurve {
  /** damage, seconds and hits of the row it was fetched for */
  stempel?: string;
  curve: PartyCurve;
  casts?: PartyCasts[] | undefined;
}

/** An event rebuilt from a member's curve: only what the curve carries. */
export type RebuiltEvent = Pick<CombatEvent, "t" | "dmg" | "skill" | "sid" | "crit" | "heavy" | "target">;

/** A saved party log, as written by summarisePartyLog (version 2) or before it (1). */
export interface PartyLogFile {
  boroPartyLog: 1 | 2;
  when?: string;
  code?: string | null;
  target?: string | null | undefined;
  board?: BoardRow[];
  /** the boss fights of the evening, each with the board it had */
  fights?: { board?: PartyBossFight[]; target?: string; [more: string]: unknown }[];
  history?: unknown[];
}

/** A boss fight a party member reported, kept for the evening (notePartyFights). */
export interface PartyBossFight {
  /** the boss's key, as ventiusTargetKey makes it */
  key: string;
  target: string;
  name: string;
  /** when it arrived, and when the pull began - the start is what tells two pulls apart */
  at: number;
  start: number;
  damage: number;
  dps: number;
  hits: number;
  crit: number;
  heavy: number;
  seconds: number;
  max: number;
  lang: string;
  weapons: string[];
  ventius: boolean;
  skills: PartySkill[];
  [more: string]: unknown;
}
