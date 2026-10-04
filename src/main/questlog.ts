// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The one place Borometer asks something outside this computer on its own
 * (spec Build-Planer, section 3): the plan of a build on questlog.gg, when
 * someone saved a Questlog link in Builds - server.ts calls fetchPlan() from the POST
 * case /api/plan/fetch and nowhere else. Only GET, only QL_BASE, no cookies,
 * 10 s per request, nothing over 1 MB, at most MAX_REQUESTS per click, a
 * pause between two, one fetch at a time. Nothing here reads a file, the
 * combat log or the config, and nothing is stored here: the page stores
 * the link, the weapons and the player's own name through /api/plans
 * (plans.ts) and drops the rest; Questlog's build name stays in the page's
 * memory (Questlog's terms, 3.4). safety-audit.mjs, section 12.
 */

export const QL_BASE = "https://questlog.gg/throne-and-liberty/api/trpc/";
export const MAX_REQUESTS = 12;
const TIMEOUT_MS = 10000;
const MAX_BYTES = 1024 * 1024;
const PAUSE_MS = 250;

export type Net = (url: string, timeoutMs: number) => Promise<{ status: number; text: string }>;
export type PlanError = "link" | "buildId" | "timeout" | "missing" | "shape" | "busy";
export interface PlanData {
  link: string;
  buildId: number;
  name: string;
  weapons: [string, string];
  active: { id: string; lvl: number; traits: string[] }[];
  passive: { id: string }[];
  mastery: { id: string; lvl: number }[];
  gear: Record<string, string>;
}
export interface Names {
  skills: Record<string, { name: string; icon: string }>;
  traits: Record<string, string>;
  mastery: Record<string, string>;
  gear: Record<string, string>;
  sets: Record<string, { name: string; tiers: Record<string, string> }>;
  stats: Record<string, string>;
  perks: Record<string, string>;
}
/* What the Steckbrief was worked out from (spec Steckbrief 4.2), cut down
   to ids, levels and numbers. The page drew it until Aufgabe 12 of the
   redesign (29.09.); since then it takes only the weapons of a fetch. */
export type RuneType = "attack" | "defense" | "assist" | "chaos";
export interface QlEquip {
  id: string; lvl: number | null;
  traits: Record<string, number>; unique: Record<string, number>;
  res: string | null; resTier: number | null;
  hero: Record<string, string>; pot: string | null; perk: string | null;
  runes: { id: string; stat: string; lvl: number }[];
}
export interface QlLevel {
  extra: Record<string, number>; armor: Record<string, number>; main: Record<string, number>;
  shield?: [string, number]; hand?: [number, number];
}
export interface QlItem {
  lv: Record<string, QlLevel>; res: Record<string, number[]>;
  hero: Record<string, Record<string, number>>; pot: Record<string, number>;
  sets: { id: string; of: number; tiers: number[] }[];
}
export interface GearData {
  equip: Record<string, QlEquip>;
  items: Record<string, QlItem>;
  runes: Record<string, { type: RuneType; stats: Record<string, Record<string, number>> }> | null;
  syn: { id: string; cat: string; combo: string[]; stats: Record<string, number> }[] | null;
  fmt: Record<string, { m: number; f: "n" | "%" | "s" | "m" }> | null;
  mast: Record<string, Record<string, number>>;
}
export type FetchResult =
  | { ok: true; plan: PlanData; names: Names; gear: GearData; requests: number }
  | { ok: true; choose: { id: number; name: string }[] }
  | { ok: false; error: PlanError };

/* ---------- the link: the same rule as parseLink in src/renderer/plan-core.ts ---------- */
type LinkKind = "character" | "skills" | "mastery";
interface LinkInfo { kind: LinkKind; slug: string; buildId: number | null }
const PATHS: Record<string, LinkKind> = {
  "character-builder": "character", "skill-builder": "skills", "weapon-mastery": "mastery",
};
const SLUG_RX = /^[A-Za-z0-9_-]{1,64}$/;
const BUILD_RX = /^[0-9]{1,12}$/;
/* The link as typed must already look the way boro-plans.json takes it
   (LINK_RX in plans.ts): exactly this start, lower case, no port, no blank
   or control character, no backslash and no empty path part - new URL
   alone would quietly smooth all of that over. The start is QL_BASE's. */
const LINK_PREFIX = QL_BASE.slice(0, -"api/trpc/".length);
const LINK_MAX = 270;
const RAW_RX = /[\s\u0000-\u001f\u007f-\u009f\\]/;
export function parseLink(raw: unknown): LinkInfo | { why: "link" | "buildId" } {
  if (typeof raw !== "string" || raw.length > 300) return { why: "link" };
  const s = raw.trim();
  if (s.length > LINK_MAX || !s.startsWith(LINK_PREFIX) || RAW_RX.test(s)) return { why: "link" };
  const path = "/" + s.slice(LINK_PREFIX.length).split(/[?#]/)[0];
  if (path.includes("//") || /\/(\.|%2e){1,2}(\/|$)/i.test(path)) return { why: "link" };
  let u: URL;
  try { u = new URL(s); } catch { return { why: "link" }; }
  if (u.protocol !== "https:" || u.hostname !== "questlog.gg" || u.port || u.username || u.password) return { why: "link" };
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts[0] !== "throne-and-liberty") return { why: "link" };
  let i = 1;
  if (parts[i] && /^[a-z]{2}$/.test(parts[i]!)) i++;
  const seg = parts[i] || "";
  const kind = Object.hasOwn(PATHS, seg) ? PATHS[seg] : undefined;
  const slug = parts[i + 1] || "";
  if (!kind || !SLUG_RX.test(slug) || parts.length !== i + 2) return { why: "link" };
  /* Questlog's character builder picks its build with ?buildId=; a build-id
     next to it is that build's mastery there. Skill builder and mastery read
     build-id only. A character link with build-id alone (Borometer wrote it
     so before) still names the character build - see `loose` in fetchPlan. */
  const rawCb = kind === "character" ? u.searchParams.get("buildId") : null;
  const raw2 = rawCb ?? u.searchParams.get("build-id");
  if (raw2 != null && !BUILD_RX.test(raw2)) return { why: "buildId" };
  const buildId = raw2 == null ? null : Number(raw2);
  if (kind !== "character" && buildId == null) return { why: "buildId" };
  return { kind, slug, buildId };
}

const WEAPON: Record<string, string> = {
  bow: "Longbow", crossbow: "Crossbow", dagger: "Dagger", gauntlet: "Gauntlet", orb: "Orb",
  spear: "Spear", staff: "Staff", sword: "Sword and Shield", sword2h: "Greatsword", wand: "Wand and Tome",
};
const ID_RX = /^[A-Za-z0-9_-]{1,80}$/;
/** stat, rune, set and perk ids: the rule a stored Steckbrief keeps (SHEET_ID_RX in plans.ts) */
const STAT_RX = /^[A-Za-z0-9_.-]{1,80}$/;
const str = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");
const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === "object" && !Array.isArray(x);
/* ---------- cutting Questlog's answers down (spec Steckbrief 4.2) ---------- */
/** the numbers of an object under stat ids, nothing else */
function nums(o: unknown, max = 60): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(o)) for (const [k, v] of Object.entries(o).slice(0, max))
    if (STAT_RX.test(k) && typeof v === "number" && Number.isFinite(v)) out[k] = v;
  return out;
}
const idOrNull = (x: unknown) => (typeof x === "string" && STAT_RX.test(x) ? x : null);
const lvlOrNull = (x: unknown) => (Number.isInteger(x) && (x as number) > 0 && (x as number) <= 1000 ? (x as number) : null);
/** one slot of a character build: what the player chose, by id and number */
function trimEquip(e: Record<string, any>): QlEquip {
  const hero: Record<string, string> = {};
  if (isObj(e.heroic)) for (const k of ["1", "2", "3"]) { const v = idOrNull(e.heroic[k]); if (v) hero[k] = v; }
  const runes = isObj(e.runes) ? ["0", "1", "2"].map((k) => e.runes[k])
    .filter((r: any) => isObj(r) && idOrNull(r.runeId) && idOrNull(r.statId) && Number.isInteger(r.lvl) && r.lvl >= 0 && r.lvl <= 1000)
    .map((r: any) => ({ id: r.runeId as string, stat: r.statId as string, lvl: r.lvl as number })) : [];
  return { id: e.id, lvl: lvlOrNull(e.itemLevel), traits: nums(e.traits), unique: nums(e.uniqueTraits),
    res: idOrNull(e.resonance), resTier: lvlOrNull(e.resonanceTier), hero, pot: idOrNull(e.potential), perk: idOrNull(e.perk), runes };
}
/** one item from database.getItem: base values at the planned and the highest level, resonance, heroic, potential, sets */
function trimItem(d: Record<string, any>, want: (number | null)[]): QlItem {
  const s = isObj(d.itemStats) ? d.itemStats : {};
  const main = isObj(s.main) ? s.main : {}, extra = isObj(s.extra) ? s.extra : {};
  const lvls = Object.keys(isObj(s.main) ? main : extra).map(Number).filter(Number.isInteger).sort((a, b) => a - b);
  const keep = [...new Set([...want, lvls[lvls.length - 1]])].filter((l): l is number => l != null && lvls.includes(l));
  const lv: Record<string, QlLevel> = {};
  for (const l of keep) {
    const m = isObj(main[l]) ? main[l] : {};
    const L: QlLevel = { extra: nums(extra[l]), armor: nums(m.armor), main: nums(m.extra) };
    if (isObj(m.shield) && idOrNull(m.shield.statId) && Number.isFinite(m.shield.value)) L.shield = [m.shield.statId, m.shield.value];
    const h = isObj(m.mainhand) ? m.mainhand : {};
    const lo = Number.isFinite(h.min) ? h.min : 0, hi = Number.isFinite(h.max) ? h.max : 0;
    if (lo > 0 || hi > 0) L.hand = [lo, hi];
    lv[l] = L;
  }
  const res: Record<string, number[]> = {};
  if (isObj(s.resonance)) for (const [k, v] of Object.entries(s.resonance).slice(0, 40))
    if (STAT_RX.test(k) && isObj(v) && Array.isArray(v.tiers) && v.tiers.length <= 10 && v.tiers.every(Number.isFinite)) res[k] = v.tiers;
  const hero: Record<string, Record<string, number>> = {};
  for (const k of ["1", "2", "3"]) {
    const g = s["random_stat_group_" + k];
    if (!Array.isArray(g)) continue;
    const o: Record<string, number> = {};
    for (const x of g.slice(0, 40)) if (isObj(x) && idOrNull(x.stat_id) && Number.isFinite(x.base_value)) o[x.stat_id] = x.base_value;
    if (Object.keys(o).length) hero[k] = o;
  }
  const pot: Record<string, number> = {};
  for (const x of (isObj(d.itemPotential) && Array.isArray(d.itemPotential.stats) ? d.itemPotential.stats : []).slice(0, 20)) {
    const id = isObj(x) ? idOrNull(x.statId ?? x.stat_id) : null;
    if (id && Number.isFinite(x.value)) pot[id] = x.value;
  }
  const sets = (Array.isArray(d.itemIsPartOfItemSets) ? d.itemIsPartOfItemSets : []).slice(0, 5)
    .filter((t: unknown) => isObj(t) && idOrNull(t.id))
    .map((t: any) => ({ id: t.id as string, of: Array.isArray(t.itemSetMadeOfItems) ? Math.min(t.itemSetMadeOfItems.length, 30) : 0,
      tiers: (Array.isArray(t.itemSetBonus) ? t.itemSetBonus : []).map((b: any) => (isObj(b) ? b.setCount : null))
        .filter((n: unknown) => Number.isInteger(n) && (n as number) > 0 && (n as number) <= 30).slice(0, 10) as number[] }));
  return { lv, res, hero, pot, sets };
}
/** the names an item brings: its sets with their tier texts, its perks - for this session only */
function itemNames(d: Record<string, any>, names: Names): void {
  for (const t of Array.isArray(d.itemIsPartOfItemSets) ? d.itemIsPartOfItemSets.slice(0, 5) : []) {
    if (!isObj(t) || !idOrNull(t.id)) continue;
    const tiers: Record<string, string> = {};
    for (const b of Array.isArray(t.itemSetBonus) ? t.itemSetBonus.slice(0, 10) : []) {
      if (!isObj(b) || !Number.isInteger(b.setCount)) continue;
      const text = (Array.isArray(b.bonusPassive) ? b.bonusPassive : []).map((p: any) => str(isObj(p) ? p.text : "", 400)).filter(Boolean).join("\n");
      if (text) tiers[b.setCount] = text.slice(0, 800);
    }
    names.sets[t.id] = { name: str(t.name, 80), tiers };
  }
  const perks = [...(Array.isArray(d.itemAvailablePerks) ? d.itemAvailablePerks : []),
                 ...(isObj(d.itemPotential) && Array.isArray(d.itemPotential.skills) ? d.itemPotential.skills : [])];
  for (const p of perks.slice(0, 40)) if (isObj(p) && idOrNull(p.id)) names.perks[p.id] = str(p.name, 80).trim();
}
/** Questlog's rewrite of old rune ids (the page had the same until the Steckbrief went, Aufgabe 12) */
export function migrateRune(id: string): string {
  let r = id;
  if (!r.includes("Rune_Usable_"))
    r = ["_lv20", "_lv30", "_lv40", "_lv50", "_lv55"].reduce((x, y) => x.replace(y, "_001"), r.replace("Rune_", "Rune_Usable_"));
  if (r.includes("_All_Rune_Usable_kB_001") || r.includes("_All_Rune_Usable_kC_001"))
    r = r.replace("_kB_001", "_kA_001").replace("_kC_001", "_kA_001");
  return r;
}
const RUNE_TYPES: RuneType[] = ["attack", "defense", "assist", "chaos"];
/** the rune catalog, cut to the runes of this build and the value at each planned level */
function trimRunes(d: Record<string, any>, want: Map<string, { stat: string; lvl: number }[]>): NonNullable<GearData["runes"]> {
  const out: NonNullable<GearData["runes"]> = {};
  for (const [id, pairs] of want) {
    const r = Object.hasOwn(d, id) ? d[id] : null;
    if (!isObj(r) || !RUNE_TYPES.includes(r.runeType)) continue;
    const g = isObj(r.itemStats) && Array.isArray(r.itemStats.random_stat_group_1) ? r.itemStats.random_stat_group_1 : [];
    const e = (out[id] = { type: r.runeType as RuneType, stats: {} as Record<string, Record<string, number>> });
    for (const p of pairs) {
      const x = g.find((y: any) => isObj(y) && y.stat_id === p.stat);
      const v = x && Array.isArray(x.levels) ? x.levels[p.lvl] : undefined;
      if (Number.isFinite(v)) (e.stats[p.stat] ??= {})[p.lvl] = v;
    }
  }
  return out;
}
/** the synergy catalog: category, order of the three types, values */
function trimSyn(d: Record<string, any>): NonNullable<GearData["syn"]> {
  return Object.values(d).slice(0, 300).filter((x: any) => isObj(x) && idOrNull(x.id) && idOrNull(x.equipmentCategory)
      && x.equipmentCategory !== "test" && Array.isArray(x.combination) && x.combination.length === 3
      && x.combination.every((c: unknown) => RUNE_TYPES.includes(c as RuneType)))
    .map((x: any) => ({ id: x.id, cat: x.equipmentCategory, combo: x.combination.slice(), stats: nums(x.stats, 10) }));
}
/** the stat formats: multiplier and unit; the names go to the session */
function trimFmt(d: Record<string, any>, names: Names): NonNullable<GearData["fmt"]> {
  const out: NonNullable<GearData["fmt"]> = {};
  for (const [k, v] of Object.entries(d).slice(0, 800)) {
    if (!STAT_RX.test(k) || !isObj(v) || !Number.isFinite(v.multiplier) || typeof v.valueFormat !== "string") continue;
    const rest = v.valueFormat.replace("{0}", "").replace(/[\s\u00a0.]/g, "");
    out[k] = { m: v.multiplier, f: rest.includes("%") ? "%" : rest === "s" || rest === "Sek" ? "s" : rest === "m" ? "m" : "n" };
    names.stats[k] = str(v.name, 80).trim();
  }
  return out;
}

const realNet: Net = async (url, timeoutMs) => {
  const res = await fetch(url, { method: "GET", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
  const buf = await res.arrayBuffer();
  // too large is refused below, by length; nothing past it is ever parsed
  return { status: res.status, text: buf.byteLength > MAX_BYTES ? "x".repeat(MAX_BYTES + 1) : new TextDecoder().decode(buf) };
};
const realWait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

class Stop extends Error {
  constructor(public why: PlanError) {
    super(why);
  }
}

/* A batch element tRPC answered with NOT_FOUND (plain or superjson form). */
const GONE = Symbol("gone");
function notFound(el: unknown): boolean {
  if (!isObj(el) || !isObj(el.error)) return false;
  const e = isObj(el.error.json) ? el.error.json : el.error;
  return e.code === -32004 || (isObj(e.data) && (e.data.code === "NOT_FOUND" || e.data.httpStatus === 404));
}

let busy = false;

/** Fetches a plan; stores nothing. The page decides what to keep. */
export async function fetchPlan(link: unknown, lang: unknown, pick: unknown,
                                net: Net = realNet, wait: (ms: number) => Promise<void> = realWait): Promise<FetchResult> {
  const info = parseLink(link);
  if ("why" in info) return { ok: false, error: info.why };
  if (busy) return { ok: false, error: "busy" };
  busy = true;
  const language = lang === "de" ? "de" : "en";
  let requests = 0;
  /* One batched GET: procedures joined by commas, inputs by index. An
     element can fail on its own (HTTP 500 for the whole batch, or the
     element's own status, e.g. 404 for NOT_FOUND) - the others are still
     good, so a JSON batch of the right length is read whatever the status.
     A failed element comes back as null, a NOT_FOUND one as GONE. Anything
     else is "shape" when it is JSON or came with 200, and "timeout" for an
     error page that is not JSON: nobody answered for Questlog (spec 6). */
  async function batch(calls: [string, Record<string, unknown>][]): Promise<unknown[]> {
    if (requests >= MAX_REQUESTS) throw new Stop("shape");
    if (requests > 0) await wait(PAUSE_MS);
    requests++;
    const input: Record<string, unknown> = {};
    calls.forEach(([, a], i) => { input[i] = a; });
    const url = QL_BASE + calls.map(([p]) => p).join(",") + "?batch=1&input=" + encodeURIComponent(JSON.stringify(input));
    let answer: { status: number; text: string };
    try { answer = await net(url, TIMEOUT_MS); } catch { throw new Stop("timeout"); }
    if (answer.text.length > MAX_BYTES) throw new Stop("shape");
    let value: unknown;
    try { value = JSON.parse(answer.text); } catch { throw new Stop(answer.status === 200 ? "shape" : "timeout"); }
    if (!Array.isArray(value) || value.length !== calls.length) throw new Stop("shape");
    return value.map((el) => (isObj(el) && isObj(el.result) && "data" in el.result ? el.result.data : notFound(el) ? GONE : null));
  }
  const room = () => MAX_REQUESTS - requests;
  try {
    let skillBuildId: number | null = null, masteryBuildId: number | null = null;
    let userSlug = info.slug, name = "", buildId = info.buildId ?? 0;
    let weapons: string[] = [];
    const gear: Record<string, string> = {};
    const equip: Record<string, QlEquip> = {};
    if (info.kind === "character") {
      const [c] = await batch([["characterBuilder.getCharacter", { slug: info.slug }]]);
      if (c === GONE) throw new Stop("missing");
      if (!isObj(c)) throw new Stop("shape");
      if (c.status !== "ACCESSIBLE") throw new Stop("missing");
      if (!Array.isArray(c.builds) || !isObj(c.character) || !isObj(c.character.user)) throw new Stop("shape");
      const builds = c.builds.filter((b: unknown) => isObj(b) && Number.isInteger(b.id));
      /* build-id alone is ambiguous: Borometer's old links meant the
         character build, Questlog's own the mastery. If the character has no
         build by that number, the link counts as one without a number - the
         choice (or a pick from it) decides, not "missing". */
      const loose = info.buildId != null && !new URL(String(link).trim()).searchParams.has("buildId");
      const picked = Number.isInteger(pick) ? (pick as number) : null;
      let want = loose && picked != null ? picked : info.buildId ?? picked;
      if (loose && want === info.buildId && !builds.some((x: any) => x.id === want)) want = null;
      if (want == null && builds.length > 1)
        return { ok: true, choose: builds.map((b: any) => ({ id: b.id, name: str(b.name, 60) })) };
      const b = want == null ? builds[0] : builds.find((x: any) => x.id === want);
      if (!b) throw new Stop("missing");
      userSlug = str(c.character.user.slug, 64);
      if (!SLUG_RX.test(userSlug)) throw new Stop("shape");
      buildId = b.id; name = str(b.name, 60);
      skillBuildId = Number.isInteger(b.skillBuildId) ? b.skillBuildId : null;
      masteryBuildId = Number.isInteger(b.weaponSpecializationBuildId) ? b.weaponSpecializationBuildId : null;
      weapons = Array.isArray(b.weaponTypes) ? b.weaponTypes : [];
      if (isObj(b.equipment)) for (const [slot, e] of Object.entries(b.equipment).slice(0, 30))
        if (ID_RX.test(slot) && isObj(e) && typeof e.id === "string" && ID_RX.test(e.id)) { gear[slot] = e.id; equip[slot] = trimEquip(e); }
    } else if (info.kind === "skills") skillBuildId = info.buildId;
    else masteryBuildId = info.buildId;

    const calls: [string, Record<string, unknown>][] = [];
    if (skillBuildId != null) calls.push(["skillBuilder.getSkillBuildsBySlug", { slug: userSlug }]);
    if (masteryBuildId != null) calls.push(["weaponSpecialization.getWeaponSpecializationBySlug", { slug: userSlug }]);
    const found = calls.length ? await batch(calls) : [];
    const pickBuild = (data: unknown, id: number) => {
      if (data === GONE) throw new Stop("missing");
      if (!isObj(data) || !Array.isArray(data.builds)) throw new Stop("shape");
      const b = data.builds.find((x: any) => isObj(x) && x.id === id);
      if (!b) throw new Stop("missing");
      return b as Record<string, any>;
    };
    let active: PlanData["active"] = [], passive: PlanData["passive"] = [], mastery: PlanData["mastery"] = [];
    let k = 0;
    if (skillBuildId != null) {
      const s = pickBuild(found[k++], skillBuildId);
      if (!Array.isArray(s.active) || !Array.isArray(s.passive)) throw new Stop("shape");
      active = s.active.filter((a: any) => isObj(a) && ID_RX.test(a.skillId)).slice(0, 12).map((a: any) => ({
        id: a.skillId, lvl: Number.isFinite(a.lvl) ? a.lvl : 0,
        traits: (Array.isArray(a.traits) ? a.traits : []).filter((t: unknown) => typeof t === "string" && ID_RX.test(t)).slice(0, 8) }));
      passive = s.passive.filter((p: any) => isObj(p) && ID_RX.test(p.skillId)).slice(0, 8).map((p: any) => ({ id: p.skillId }));
      if (!weapons.length) weapons = [s.mainHand, s.offHand];
      if (!name) name = str(s.name, 60);
    }
    if (masteryBuildId != null) {
      const m = pickBuild(found[k++], masteryBuildId);
      if (!Array.isArray(m.specialization)) throw new Stop("shape");
      mastery = m.specialization.filter((n: any) => isObj(n) && ID_RX.test(n.id)).slice(0, 60)
        .map((n: any) => ({ id: n.id, lvl: Number.isFinite(n.lvl) ? n.lvl : 0 }));
      if (!weapons.length) weapons = [m.mainHand, m.offHand];
      if (!name) name = str(m.name, 60);
    }
    const plan: PlanData = {
      link: String(link).trim(), buildId, name,
      weapons: [WEAPON[String(weapons[0])] || "", WEAPON[String(weapons[1])] || ""],
      active, passive, mastery, gear,
    };

    /* Values before names (spec Steckbrief 4.1): the items, the rune
       catalog, synergies and formats, the mastery nodes - then the skill
       names. Full character link: 1 + 1 + 2 + 1 + 1 + 2 + 2 = 10, at most
       1 + 1 + 4 + 1 + 1 + 2 + 2 = 12. What does not fit stays without a
       name. A catalog that does not come is null (the card says so); an
       item that does not come is missing (the card says "unknown item"). */
    const names: Names = { skills: {}, traits: {}, mastery: {}, gear: {}, sets: {}, stats: {}, perks: {} };
    const gearData: GearData = { equip, items: {}, runes: {}, syn: [], fmt: {}, mast: {} };
    const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
    // a catalog may fail on its own; then it is null, the fetch goes on
    const soft = async (calls: [string, Record<string, unknown>][]): Promise<unknown[]> => {
      if (!room()) return calls.map(() => null);
      try { return await batch(calls); } catch (err) {
        if (err instanceof Stop && (err.why === "timeout" || err.why === "shape")) return calls.map(() => null);
        throw err;
      }
    };
    for (const ids of chunks([...new Set(Object.values(equip).map((e) => e.id))], 8)) {
      if (!room()) break;
      const got = await batch(ids.map((id) => ["database.getItem", { id, language }]));
      got.forEach((d, i) => {
        if (!isObj(d)) return;
        const id = ids[i]!;
        gearData.items[id] = trimItem(d, Object.values(equip).filter((e) => e.id === id).map((e) => e.lvl));
        names.gear[id] = str(d.name, 80);
        itemNames(d, names);
      });
    }
    const runeWant = new Map<string, { stat: string; lvl: number }[]>();
    for (const e of Object.values(equip)) for (const r of e.runes) {
      const id = migrateRune(r.id);
      runeWant.set(id, [...(runeWant.get(id) || []), { stat: r.stat, lvl: r.lvl }]);
    }
    if (runeWant.size) {
      const [d] = await soft([["characterBuilder.getEquipmentRunes", { language }]]);
      gearData.runes = isObj(d) ? trimRunes(d, runeWant) : null;
    }
    if (Object.keys(equip).length || mastery.length) {
      const [syn, fmt] = await soft([["characterBuilder.getRuneSynergies", { language }], ["statFormat.getStatFormat", { language }]]);
      gearData.syn = isObj(syn) ? trimSyn(syn) : null;
      gearData.fmt = isObj(fmt) ? trimFmt(fmt, names) : null;
    }
    for (const ids of chunks(mastery.map((m) => m.id), 30)) {
      if (!room()) break;
      const got = await batch(ids.map((id) => ["database.getWeaponSpecialization", { id, language }]));
      got.forEach((d, i) => {
        if (!isObj(d)) return;
        const id = ids[i]!, lvl = mastery.find((m) => m.id === id)!.lvl;
        names.mastery[id] = str(d.name, 80);
        const at = Array.isArray(d.stats) && lvl >= 1 ? d.stats[lvl - 1] : null;
        const v = nums(at, 20);
        if (Object.keys(v).length) gearData.mast[id] = v;
      });
    }
    for (const ids of chunks([...active.map((a) => a.id), ...passive.map((p) => p.id)], 10)) {
      if (!room()) break;
      const got = await batch(ids.map((id) => ["database.getSkillSet", { id, language }]));
      got.forEach((d, i) => {
        if (!isObj(d)) return;
        names.skills[ids[i]!] = { name: str(d.name, 80), icon: str(d.icon, 200) };
        for (const t of [...(Array.isArray(d.skillSetHasSkillTraits) ? d.skillSetHasSkillTraits : []),
                         ...(Array.isArray(d.skillSetRequiredTraits) ? d.skillSetRequiredTraits : [])])
          if (isObj(t) && typeof t.id === "string" && ID_RX.test(t.id)) names.traits[t.id] = str(t.name, 80);
      });
    }
    return { ok: true, plan, names, gear: gearData, requests };
  } catch (err) {
    return { ok: false, error: err instanceof Stop ? err.why : "shape" };
  } finally {
    busy = false;
  }
}
