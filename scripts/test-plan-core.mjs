// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die reinen Funktionen der Builds als Links zu Questlog (src/renderer/plan-core.ts,
// seit Aufgabe 12 der Neugestaltung; vorher der Build-Planer), der Abruf bei Questlog
// (src/main/questlog.ts) ohne Netz und der Speicher boro-plans.json (src/main/plans.ts):
// esbuild buendelt je eine Datei, Node fuehrt sie aus.
//
// Run:  npm run test:plan-core

import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
async function load(file, platform) {
  const built = await esbuild.build({ entryPoints: [join(root, file)], bundle: true, format: "esm",
    platform, write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
  return import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64"));
}
const core = await load("src/renderer/plan-core.ts", "neutral");

let failed = 0;
function eq(got, want, name) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + "\n        got  " + a + "\n        want " + b); }
}

// --- Links
const Q = "https://questlog.gg/throne-and-liberty/";
eq(core.parseLink(Q + "character-builder/HighEliteOfTheWisdom"),
   { kind: "character", slug: "HighEliteOfTheWisdom", buildId: null }, "Charakter ohne build-id");
eq(core.parseLink(Q + "en/character-builder/HighEliteOfTheWisdom?build-id=8359639"),
   { kind: "character", slug: "HighEliteOfTheWisdom", buildId: 8359639 }, "Charakter mit Sprachsegment und build-id");
eq(core.parseLink(Q + "skill-builder/SAA2YXzmmVK4?build-id=749549"),
   { kind: "skills", slug: "SAA2YXzmmVK4", buildId: 749549 }, "Skill-Builder");
eq(core.parseLink(Q + "de/weapon-mastery/SAA2YXzmmVK4?build-id=500441"),
   { kind: "mastery", slug: "SAA2YXzmmVK4", buildId: 500441 }, "Waffenmeisterschaft");
eq(core.parseLink(Q + "skill-builder/SAA2YXzmmVK4"), { why: "buildId" }, "Skill-Builder ohne build-id");
eq(core.parseLink(Q + "weapon-mastery/SAA2YXzmmVK4?build-id=abc"), { why: "buildId" }, "build-id keine Zahl");
eq(core.parseLink("http://questlog.gg/throne-and-liberty/skill-builder/x?build-id=1"), { why: "link" }, "http statt https");
eq(core.parseLink("https://evil.example/throne-and-liberty/skill-builder/x?build-id=1"), { why: "link" }, "fremder Host");
eq(core.parseLink("https://questlog.gg.evil.example/throne-and-liberty/skill-builder/x?build-id=1"), { why: "link" }, "Host nur als Praefix");
eq(core.parseLink(Q + "item/bow_aa_t2_raid_001"), { why: "link" }, "andere Seite von Questlog");
eq(core.parseLink("https://questlog.gg/new-world/skill-builder/x?build-id=1"), { why: "link" }, "anderes Spiel");
eq(core.parseLink(Q + "character-builder/bad slug"), { why: "link" }, "Slug mit Leerzeichen");
eq(core.parseLink(42), { why: "link" }, "kein Text");
eq(core.parseLink(Q + "constructor/abc?build-id=1"), { why: "link" }, "geerbter Name (constructor) ist kein Pfad");
eq(core.parseLink(Q + "__proto__/abc?build-id=1"), { why: "link" }, "geerbter Name (__proto__) ist kein Pfad");

// Nachtrag 25.09.: Questlogs Charakter-Builder waehlt den Build mit ?buildId=; build-id ist
// dort die Meisterschaft des Builds (weaponSpecializationBuildId). Echter Link des Eigentuemers:
const OWNER = Q + "en/character-builder/HighEliteOfTheWisdom?build-id=500441&buildId=8498235";
const BUILDID = [
  [OWNER, { kind: "character", slug: "HighEliteOfTheWisdom", buildId: 8498235 }, "Link des Eigentuemers: buildId, nicht build-id"],
  [Q + "character-builder/HighEliteOfTheWisdom?buildId=8498235", { kind: "character", slug: "HighEliteOfTheWisdom", buildId: 8498235 }, "Charakter nur mit buildId"],
  [Q + "character-builder/HighEliteOfTheWisdom?build-id=8498235", { kind: "character", slug: "HighEliteOfTheWisdom", buildId: 8498235 }, "Charakter nur mit build-id (alte Form)"],
  [Q + "character-builder/HighEliteOfTheWisdom?buildId=8498235&build-id=500441", { kind: "character", slug: "HighEliteOfTheWisdom", buildId: 8498235 }, "beide, andere Reihenfolge: buildId"],
  [Q + "character-builder/HighEliteOfTheWisdom?buildId=8498235&build-id=abc", { kind: "character", slug: "HighEliteOfTheWisdom", buildId: 8498235 }, "gueltiges buildId, build-id egal"],
  [Q + "character-builder/HighEliteOfTheWisdom?buildId=abc", { why: "buildId" }, "buildId keine Zahl"],
  [Q + "character-builder/HighEliteOfTheWisdom?buildId=", { why: "buildId" }, "buildId leer"],
  [Q + "character-builder/HighEliteOfTheWisdom?build-id=500441&buildId=abc", { why: "buildId" }, "beide, buildId ungueltig: buildId"],
  [Q + "skill-builder/SAA2YXzmmVK4?buildId=749549", { why: "buildId" }, "Skill-Builder liest kein buildId"],
  [Q + "skill-builder/SAA2YXzmmVK4?build-id=749549&buildId=1", { kind: "skills", slug: "SAA2YXzmmVK4", buildId: 749549 }, "Skill-Builder: buildId daneben egal"],
  [Q + "weapon-mastery/SAA2YXzmmVK4?build-id=500441&buildId=abc", { kind: "mastery", slug: "SAA2YXzmmVK4", buildId: 500441 }, "Meisterschaft: buildId daneben egal"],
];
for (const [l, want, name] of BUILDID) eq(core.parseLink(l), want, name);

// --- Links, die new URL glaetten wuerde, boro-plans.json aber ablehnt: schon vor dem Abruf abgelehnt
const SELTSAM = [
  "https://Questlog.gg/throne-and-liberty/character-builder/TestChar",
  "HTTPS://questlog.gg/throne-and-liberty/character-builder/TestChar",
  "https://questlog.gg:443/throne-and-liberty/character-builder/TestChar",
  "https://questlog.gg//throne-and-liberty/character-builder/TestChar",
  "https://questlog.gg/throne-and-liberty//character-builder/TestChar",
  "https://questlog.gg/throne-and-liberty/character-builder//TestChar",
  "https://questlog.gg\\throne-and-liberty\\character-builder\\TestChar",
  "https://questlog.gg/throne-and-liberty\\character-builder/TestChar",
  "https://questlog.gg/throne-and-liberty/character-builder/Test\tChar",
  "https://questlog.gg/throne-and-liberty/charac\tter-builder/TestChar",
  "https://questlog.gg/throne-and-liberty/character-builder/TestChar#frag with space",
  "https://questlog.gg/throne-and-liberty/character-builder/TestChar?x=\u0085",
  "https://questlog.gg/throne-and-liberty/x/../character-builder/TestChar",
  "https://questlog.gg/throne-and-liberty/x/%2e%2E/character-builder/TestChar",
  "https://questlog.gg/throne-and-liberty/character-builder/TestChar?build-id=1" + "&x=" + "a".repeat(200),
];
for (const l of SELTSAM) eq(core.parseLink(l), { why: "link" }, "seltsamer Link abgelehnt: " + JSON.stringify(l).slice(0, 90));

// Was parseLink nimmt, nimmt auch boro-plans.json: LINK_RX steht in src/main/plans.ts (dort
// importiert paths.ts Electron, darum wird die Zeile aus der Quelle gelesen, nicht gebuendelt)
const plansSrc = readFileSync(join(root, "src", "main", "plans.ts"), "utf8");
const rxZeile = plansSrc.match(/^const LINK_RX = \/(.+)\/;$/m);
eq(!!rxZeile, true, "LINK_RX in src/main/plans.ts gefunden");
const LINK_RX = new RegExp(rxZeile ? rxZeile[1] : "(?!)");
const GENOMMEN = [
  Q + "character-builder/HighEliteOfTheWisdom", Q + "en/character-builder/HighEliteOfTheWisdom?build-id=8359639",
  Q + "skill-builder/SAA2YXzmmVK4?build-id=749549", Q + "de/weapon-mastery/SAA2YXzmmVK4?build-id=500441",
  Q + "character-builder/TestChar/", Q + "character-builder/TestChar?ref=x#oben", "  " + Q + "character-builder/TestChar  ",
  Q + "character-builder/" + "a".repeat(64) + "?x=" + "b".repeat(140), OWNER,
];
for (const l of GENOMMEN) {
  const r = core.parseLink(l);
  eq(!("why" in r) && LINK_RX.test(l.trim()), true, "genommen und passt zu LINK_RX: " + l.trim().slice(0, 90));
}

// Gehoert ein Link zu einem Eintrag? Das entscheidet seit Aufgabe 12 allein die Kennung (planId): ein anderer
// Build desselben Charakters ist ein anderer Eintrag, die alte und die neue Form derselbe (linkZuPlan entfiel).
{
  const C = Q + "character-builder/TestChar";
  eq(core.planId(core.parseLink(C + "?build-id=11"), 11) === core.planId(core.parseLink(C + "?buildId=11"), 11), true,
     "planId: alte und neue Form gleich");
  eq(core.planId(core.parseLink(C + "?buildId=11"), 11) !== core.planId(core.parseLink(C + "?buildId=12"), 12), true,
     "planId: ein anderer Build desselben Charakters ist ein anderer Eintrag");
  const s = core.parseLink(Q + "skill-builder/SAA2?build-id=5"), m = core.parseLink(Q + "weapon-mastery/SAA2?build-id=5");
  eq(core.planId(s, 5) !== core.planId(m, 5), true, "planId: Skill-Builder und Meisterschaft mit gleicher Nummer sind zwei Eintraege");
}

// Der gewaehlte Build kommt in den Link: Questlog oeffnet genau ihn, und derselbe Link noch einmal fragt nicht
{
  const faelle = [[Q + "character-builder/TestChar", Q + "character-builder/TestChar?buildId=11"],
                  [Q + "character-builder/TestChar?ref=x", Q + "character-builder/TestChar?ref=x&buildId=11"],
                  [Q + "character-builder/TestChar#oben", Q + "character-builder/TestChar?buildId=11#oben"],
                  [Q + "character-builder/TestChar?ref=x#oben", Q + "character-builder/TestChar?ref=x&buildId=11#oben"]];
  for (const [vor, nach] of faelle) {
    const neu = core.linkMitBuild(vor, 11);
    eq(neu, nach, "linkMitBuild: " + vor.slice(Q.length));
    const a = core.parseLink(vor), b = core.parseLink(neu);
    eq([b.buildId, LINK_RX.test(neu), core.planId(a, 11) === core.planId(b, 11)], [11, true, true],
      "linkMitBuild: build-id gelesen, LINK_RX passt, dieselbe planId");
  }
  eq(core.linkMitBuild(Q + "skill-builder/x?build-id=1", 11), null, "linkMitBuild: nur Charakter-Links");
  eq(core.linkMitBuild(Q + "character-builder/x?buildId=1", 11), null, "linkMitBuild: buildId schon da");
  // ein alter Link mit build-id, dessen Build es nicht gibt: buildId daneben, das gilt
  const alt = core.linkMitBuild(Q + "character-builder/x?build-id=500441", 11);
  eq([alt, core.parseLink(alt).buildId], [Q + "character-builder/x?build-id=500441&buildId=11", 11], "linkMitBuild: build-id bleibt, buildId geht vor");
  eq(core.linkMitBuild(Q + "character-builder/" + "a".repeat(64) + "?x=" + "b".repeat(140), 123456789012), null,
    "linkMitBuild: zu lang, dann nicht");
}

// --- IDs
const L = { kind: "character", slug: "HighEliteOfTheWisdom", buildId: null };
eq(core.PLAN_ID_RX.test(core.planId(L, 8359639)), true, "planId hat die Form");
eq(core.planId(L, 8359639) === core.planId(L, 8359639), true, "planId ist bestaendig");
eq(core.planId(L, 8359639) !== core.planId(L, 8359663), true, "anderer Build, andere planId");

// --- Die Worte (07-dictionary.ts): Steckbrief und Planer sind fort, die Worte der Links in beiden Sprachen, kein "Bau"
// (Aufgabe 12; vorher: die Worte des Steckbriefs in beiden Sprachen und jede Wert-ID des Builds "Borometer")
const { I18N } = await load("src/renderer/app/07-dictionary.ts", "neutral");
const alte = (lang) => Object.keys(I18N[lang]).filter((k) => /^(st|stat)\./.test(k) || (/^plan\./.test(k) && k !== "plan.undo"));
eq([alte("en"), alte("de")], [[], []], "die Worte von Steckbrief und Planer sind aus beiden Sprachen fort (plan.undo bleibt, Deine Rotation nutzt es)");
const qlWorte = (lang) => Object.keys(I18N[lang]).filter((k) => /^ql\./.test(k)).sort();
eq(qlWorte("en"), qlWorte("de"), "ql.* in beiden Sprachen mit denselben Schluesseln");
eq(qlWorte("de").length >= 25, true, "ql.*: die Worte der Karten sind da");
eq(qlWorte("de").filter((k) => { const e = I18N.de[k]; return /\bBau/.test(typeof e === "function" ? e({ n: 2, tag: "20.09.", namen: "X", name: "X" }) : e); }), [],
   "deutsch heisst es Build, nie Bau");

// --- Die Zahlen einer Karte (kartenZahlen): dieselben Waffen, gleich aus welchem Build; Regeln wie im Verlauf
// (aus test-builds-core.mjs, bauZeilen, Aufgabe 12: Median ab drei Kaempfen, meiste Kaempfe zuerst, die Puppe kein Boss)
{
  const builds = { aaaaaaaaaa: { name: "", weapons: ["Longbow", "Crossbow"], core: [], first: 1 },
                   bbbbbbbbbb: { name: "", weapons: ["Crossbow", "Longbow"], core: [], first: 2 },
                   cccccccccc: { name: "", weapons: ["Dagger", "Staff"], core: [], first: 3 } };
  const at = (d, h) => Date.UTC(2026, 8, d, h, 0);
  const f = (name, b, dps, d, h, c) => ({ name, dps, dmg: dps, dur: 60, at: at(d, h), b, ...(c ? { c } : {}) });
  const kaempfe = [f("Vulcanus", "aaaaaaaaaa", 50, 17, 21), f("Vulcanus", "bbbbbbbbbb", 70, 19, 21), f("Vulcanus", "aaaaaaaaaa", 60, 19, 22),
    f("Tevent", "aaaaaaaaaa", 90, 18, 21), f("Tevent", "aaaaaaaaaa", 80, 18, 22), f("Kowazan", "aaaaaaaaaa", 30, 16, 21),
    f("Morokai", "aaaaaaaaaa", 20, 15, 21), f("Practice Dummy", "aaaaaaaaaa", 40, 20, 20, 60),
    f("Vulcanus", "cccccccccc", 99, 21, 21), f("Vulcanus", "zzzzzzzzzz", 99, 21, 22), f("Vulcanus", undefined, 99, 21, 23)];
  const key = (n) => n.toLowerCase();
  const z = core.kartenZahlen(["Crossbow", "Longbow"], kaempfe, builds, key);
  eq(z.bosse.map((b) => [b.name, b.n, b.median]), [["Vulcanus", 3, 60], ["Tevent", 2, null], ["Kowazan", 1, null]],
     "kartenZahlen: hoechstens drei Bosse, meiste Kaempfe zuerst, dann der zuletzt gespielte; Median ab drei; zwei Builds mit denselben Waffen zaehlen zusammen");
  eq(z.letzter, at(20, 20), "kartenZahlen: zuletzt gespielt zaehlt die Puppe mit, sie ist aber kein Boss");
  eq(core.kartenZahlen(["Longbow", "Crossbow"], kaempfe, builds, key, 10).bosse.map((b) => b.name), ["Vulcanus", "Tevent", "Kowazan", "Morokai"],
     "kartenZahlen: ohne Grenze alle Bosse, kein fremder Build, kein unbekannter, keiner ohne Build");
  eq(core.kartenZahlen(["Spear", "Orb"], kaempfe, builds, key), { letzter: null, bosse: [] }, "kartenZahlen: ohne Kaempfe mit diesen Waffen nichts");
  eq(core.kartenZahlen(["", ""], kaempfe, { ...builds, dddddddddd: { name: "", weapons: ["", ""], core: [], first: 4 } }, key), { letzter: null, bosse: [] },
     "kartenZahlen: ohne Waffen keine Zahlen");
  eq(core.kartenZahlen(["Longbow", "Crossbow"], [f("Vulcanus", "__proto__", 99, 21, 21), { ...f("Vulcanus", "aaaaaaaaaa", 0, 22, 21) }], builds, key),
     { letzter: null, bosse: [] }, "kartenZahlen: eine Kennung aus dem Prototyp oder 0 DPS zaehlt nicht");
  const gleich = core.gleicheWaffen({ p1: { weapons: ["Longbow", "Crossbow"] }, p2: { weapons: ["Crossbow", "Longbow"] }, p3: { weapons: ["Dagger", "Staff"] },
    p4: { weapons: ["", ""] }, p5: { weapons: ["", ""] } });
  eq(gleich, { p1: ["p2"], p2: ["p1"], p3: [], p4: [], p5: [] }, "gleicheWaffen: Reihenfolge egal, ohne Waffen keiner gleich");
  const e = { p1: { weapons: ["Dagger", "Staff"], at: 5 }, p2: { weapons: ["Longbow", "Crossbow"], at: 1 }, p3: { weapons: ["Spear", "Orb"], at: 9 },
    p4: { weapons: ["Orb", "Wand and Tome"], at: 3 } };
  const letzter = (id) => ({ p1: 100, p2: 50, p3: null, p4: null })[id];
  eq(core.kartenFolge(e, ["Crossbow", "Longbow"], letzter), ["p2", "p1", "p3", "p4"],
     "kartenFolge: die Karte des offenen Kampfs zuerst, dann zuletzt gespielt, dann zuletzt gespeichert");
  eq(core.kartenFolge(e, null, letzter), ["p1", "p2", "p3", "p4"], "kartenFolge: ohne offenen Kampf nach dem Spielen, dann nach dem Speichern");
}

// --- Form eines gelesenen Eintrags (looksLikeEintrag; vorher looksLikePlan): der Link kommt in ein href
const plan = { link: Q + "skill-builder/x?build-id=1", at: 1, name: "BiS", weapons: ["Longbow", "Crossbow"],
  active: [{ id: "SkillSet_WP_CR_CR_S_RapidShot", lvl: 21, traits: [] }], passive: [], mastery: [], gear: {}, keys: {} };
eq(core.looksLikeEintrag(plan), true, "looksLikeEintrag: ein alter Plan traegt eine Karte");
eq(core.looksLikeEintrag({ link: plan.link, at: 1, name: "", weapons: ["Dagger", "Staff"] }), true, "looksLikeEintrag: ein neuer Eintrag ohne eigenen Namen");
eq(core.looksLikeEintrag({ ...plan, sheet: { slots: {}, sets: [], fmt: {} }, geloest: 7 }), true, "looksLikeEintrag: mit Steckbrief, geloest");
eq(core.looksLikeEintrag({ ...plan, weapons: "x" }), false, "looksLikeEintrag: kaputt (Waffen)");
eq(core.looksLikeEintrag({ ...plan, weapons: ["Longbow"] }), false, "looksLikeEintrag: nur eine Waffe im Feld");
eq(core.looksLikeEintrag({ ...plan, name: 5 }), false, "looksLikeEintrag: Name keine Zeichenkette");
eq(core.looksLikeEintrag({ ...plan, name: "x".repeat(61) }), false, "looksLikeEintrag: Name ueber 60 Zeichen");
eq(core.looksLikeEintrag({ ...plan, at: "1" }), false, "looksLikeEintrag: Zeitpunkt keine Zahl");
eq(core.looksLikeEintrag({ ...plan, geloest: "ja" }), false, "looksLikeEintrag: geloest keine Zahl");
eq(core.looksLikeEintrag([plan]), false, "looksLikeEintrag: eine Liste ist kein Eintrag");
eq(core.looksLikeEintrag({ ...plan, link: "javascript:alert(1)" }), false, "looksLikeEintrag: der Link kommt in ein href - nur Questlog-Links");
eq(core.looksLikeEintrag({ ...plan, link: "https://evil.example/throne-and-liberty/skill-builder/x?build-id=1" }), false,
   "looksLikeEintrag: fremder Host");
eq(core.looksLikeEintrag({ ...plan, link: "https://Questlog.gg/throne-and-liberty/skill-builder/x?build-id=1" }), false,
   "looksLikeEintrag: ein Link, den parseLink ablehnt");

// --- Abruf (src/main/questlog.ts), mit gestelltem Netz
const ql = await load("src/main/questlog.ts", "node");
const LINKS = [
  Q + "character-builder/HighEliteOfTheWisdom", Q + "en/character-builder/HighEliteOfTheWisdom?build-id=8359639",
  Q + "skill-builder/SAA2YXzmmVK4?build-id=749549", Q + "de/weapon-mastery/SAA2YXzmmVK4?build-id=500441",
  Q + "skill-builder/SAA2YXzmmVK4", "http://questlog.gg/throne-and-liberty/skill-builder/x?build-id=1",
  "https://questlog.gg.evil.example/throne-and-liberty/skill-builder/x?build-id=1", Q + "item/bow_aa_t2_raid_001",
  Q + "constructor/abc?build-id=1", Q + "__proto__/abc?build-id=1",
  ...BUILDID.map(([l]) => l),
];
eq([...LINKS, ...SELTSAM, ...GENOMMEN].map((l) => JSON.stringify(ql.parseLink(l))),
   [...LINKS, ...SELTSAM, ...GENOMMEN].map((l) => JSON.stringify(core.parseLink(l))), "Helfer und Seite lesen Links gleich");
for (const l of SELTSAM) eq(ql.parseLink(l), { why: "link" }, "Helfer: seltsamer Link abgelehnt: " + JSON.stringify(l).slice(0, 90));

// Nachgebaute Antworten in Questlogs Form - wenige Skills, keine echten Spieltexte.
const ok = (data) => ({ result: { data } });
const CHAR = ok({ status: "ACCESSIBLE", character: { user: { slug: "USERSLUG01" } }, builds: [
  { id: 11, name: "Raid", skillBuildId: 21, weaponSpecializationBuildId: 31, weaponTypes: ["bow", "crossbow"],
    equipment: { main_hand: { id: "item_a" }, off_hand: { id: "item_b" }, belt: {}, ring_1: { id: "item_c" } } },
  { id: 12, name: "PvP", skillBuildId: 22, weaponSpecializationBuildId: 32, weaponTypes: ["dagger", "staff"], equipment: {} },
] });
const SKILLS = ok({ user: { slug: "USERSLUG01" }, builds: [
  { id: 21, name: "Raid", mainHand: "bow", offHand: "crossbow",
    active: [{ lvl: 20, order: 0, skillId: "SkillSet_A", traits: ["SkillSet_A_Trait_1"] }, { lvl: 18, order: 1, skillId: "SkillSet_B", traits: [] }],
    passive: [{ lvl: 20, order: 0, skillId: "SkillSet_P" }] },
] });
const MASTERY = ok({ user: { slug: "USERSLUG01" }, builds: [
  { id: 31, name: "Raid", mainHand: "bow", offHand: "crossbow", specialization: [{ id: "Bow_Node_01", lvl: 10 }] },
] });
const skillSet = (id) => ok({ id, name: "Name " + id, icon: "/x/S_" + id + ".S_" + id,
  skillSetHasSkillTraits: [{ id: id + "_Trait_1", name: "Trait of " + id }], skillSetRequiredTraits: [] });
function stellNetz(antworten) {
  const log = [];
  const net = async (url, timeoutMs) => {
    log.push({ url, timeoutMs });
    const u = new URL(url);
    const procs = u.pathname.split("/").pop().split(",");
    const input = JSON.parse(u.searchParams.get("input"));
    return antworten(procs, input, log.length);
  };
  return { net, log };
}
const alles = (procs, input) => {
  const out = procs.map((p, i) => {
    const a = input[i];
    if (p === "characterBuilder.getCharacter") return a.slug === "HighEliteOfTheWisdom" ? CHAR : ok({ status: "NOT_FOUND" });
    if (p === "skillBuilder.getSkillBuildsBySlug") return SKILLS;
    if (p === "weaponSpecialization.getWeaponSpecializationBySlug") return MASTERY;
    if (p === "database.getSkillSet") return skillSet(a.id);
    if (p === "database.getWeaponSpecialization") return ok({ id: a.id, name: "Knoten " + a.id });
    if (p === "database.getItem") return a.id === "item_c"
      ? { error: { message: "boom", code: -32603 } } : ok({ id: a.id, name: "Ding " + a.id });
    return { error: { message: "unknown" } };
  });
  const fehler = out.some((o) => o.error);
  return { status: fehler ? 500 : 200, text: JSON.stringify(out) };
};
const warte = [];
const wait = async (ms) => { warte.push(ms); };

{
  const { net, log } = stellNetz(alles);
  const r = await ql.fetchPlan(Q + "character-builder/HighEliteOfTheWisdom", "de", null, net, wait);
  eq(r, { ok: true, choose: [{ id: 11, name: "Raid" }, { id: 12, name: "PvP" }] }, "Charakter mit zwei Builds: Auswahl statt Plan");
  eq(log.length, 1, "Auswahl: nur eine Anfrage");
}
{
  warte.length = 0;
  const { net, log } = stellNetz(alles);
  const r = await ql.fetchPlan(Q + "character-builder/HighEliteOfTheWisdom", "de", 11, net, wait);
  eq(r.ok && r.plan && r.plan.weapons, ["Longbow", "Crossbow"], "gewaehlter Build: Waffen");
  eq(r.plan.active, [{ id: "SkillSet_A", lvl: 20, traits: ["SkillSet_A_Trait_1"] }, { id: "SkillSet_B", lvl: 18, traits: [] }], "aktive Skills");
  eq(r.plan.passive, [{ id: "SkillSet_P" }], "Passive");
  eq(r.plan.mastery, [{ id: "Bow_Node_01", lvl: 10 }], "Meisterschaft");
  eq(r.plan.gear, { main_hand: "item_a", off_hand: "item_b", ring_1: "item_c" }, "Ausruestung ohne leere Plaetze");
  eq(r.plan.name + "|" + r.plan.buildId, "Raid|11", "Name und build-id");
  eq(r.names.skills.SkillSet_A, { name: "Name SkillSet_A", icon: "/x/S_SkillSet_A.S_SkillSet_A" }, "Skillname mit Symbol");
  eq(r.names.traits.SkillSet_A_Trait_1, "Trait of SkillSet_A", "Traitname aus getSkillSet");
  eq(r.names.mastery.Bow_Node_01, "Knoten Bow_Node_01", "Knotenname");
  eq([r.names.gear.item_a, r.names.gear.item_c], ["Ding item_a", undefined], "HTTP 500 im Buendel: die anderen Namen kommen trotzdem");
  eq(log.every((x) => x.url.startsWith(ql.QL_BASE) && x.timeoutMs === 10000), true, "nur QL_BASE, 10 s je Anfrage");
  eq(log.every((x) => new URL(x.url).searchParams.get("input").includes('"language":"de"') || !x.url.includes("database.")), true, "Namen in der Sprache der Oberflaeche");
  eq(r.requests, log.length, "Zahl der Anfragen stimmt");
  eq(r.requests <= ql.MAX_REQUESTS, true, "hoechstens MAX_REQUESTS");
  eq(warte.length === log.length - 1 && warte.every((ms) => ms === 250), true, "250 ms Pause zwischen zwei Anfragen");
}
{
  const { net } = stellNetz(alles);
  eq(await ql.fetchPlan(Q + "character-builder/Nobody", "en", null, net, wait), { ok: false, error: "missing" }, "Charakter nicht da");
  eq(await ql.fetchPlan(Q + "character-builder/HighEliteOfTheWisdom", "en", 99, net, wait), { ok: false, error: "missing" }, "gewaehlter Build nicht da");
  eq(await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=77", "en", null, net, wait), { ok: false, error: "missing" }, "Skill-Build nicht da");
  eq(await ql.fetchPlan("https://evil.example/", "en", null, net, wait), { ok: false, error: "link" }, "fremder Link: kein Abruf");
  eq(await ql.fetchPlan(Q + "skill-builder/USERSLUG01", "en", null, net, wait), { ok: false, error: "buildId" }, "ohne build-id: kein Abruf");
}
{
  // Nachtrag 25.09.: buildId waehlt den Charakter-Build; build-id allein (alte Form) auch,
  // gibt es den Build nicht, fragt der Helfer wie ohne Nummer statt "missing"
  const H = Q + "en/character-builder/HighEliteOfTheWisdom";
  const { net, log } = stellNetz(alles);
  eq((await ql.fetchPlan(H + "?build-id=12&buildId=11", "en", null, net, wait)).plan?.buildId, 11, "beide: buildId gewinnt (11, nicht 12)");
  eq((await ql.fetchPlan(H + "?buildId=11", "en", null, net, wait)).plan?.buildId, 11, "nur buildId");
  eq((await ql.fetchPlan(H + "?build-id=11", "en", null, net, wait)).plan?.buildId, 11, "nur build-id (alte Form), Build da");
  eq(await ql.fetchPlan(H + "?buildId=31", "en", null, net, wait), { ok: false, error: "missing" }, "buildId ohne solchen Build: nicht da");
  eq(await ql.fetchPlan(H + "?build-id=500441&buildId=31", "en", null, net, wait), { ok: false, error: "missing" }, "beide, buildId ohne Build: nicht da");
  const vor = log.length;
  eq(await ql.fetchPlan(H + "?build-id=31", "en", null, net, wait), { ok: true, choose: [{ id: 11, name: "Raid" }, { id: 12, name: "PvP" }] },
     "nur build-id ohne solchen Build: Auswahl statt Fehler");
  eq(log.length - vor, 1, "Auswahl nach build-id: nur eine Anfrage");
  eq((await ql.fetchPlan(H + "?build-id=31", "en", 11, net, wait)).plan?.buildId, 11, "nur build-id ohne Build, gewaehlt: der gewaehlte");
  eq((await ql.fetchPlan(H + "?buildId=11", "en", 12, net, wait)).plan?.buildId, 11, "buildId: eine Wahl aendert nichts");
  eq(await ql.fetchPlan(H + "?build-id=31", "en", 99, net, wait), { ok: false, error: "missing" }, "nur build-id, gewaehlter Build nicht da");
  const eins = (procs, input) => procs[0] === "characterBuilder.getCharacter"
    ? { status: 200, text: JSON.stringify([ok({ ...CHAR.result.data, builds: [CHAR.result.data.builds[0]] })]) } : alles(procs, input);
  const e = stellNetz(eins);
  eq((await ql.fetchPlan(H + "?build-id=31", "en", null, e.net, wait)).plan?.buildId, 11, "nur build-id ohne Build, ein Build: der eine");
  eq((await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21&buildId=99", "en", null, net, wait)).plan?.name, "Raid", "Skill-Builder: buildId daneben egal");
}
{
  const { net, log } = stellNetz(alles);
  for (const l of SELTSAM) eq(await ql.fetchPlan(l, "en", 11, net, wait), { ok: false, error: "link" }, "seltsamer Link: kein Abruf " + JSON.stringify(l).slice(0, 70));
  eq(log.length, 0, "seltsame Links: keine Anfrage gestellt");
}
{
  const { net, log } = stellNetz(alles);
  eq(await ql.fetchPlan(Q + "constructor/abc?build-id=1", "en", null, net, wait), { ok: false, error: "link" }, "geerbter Name (constructor): kein Abruf");
  eq(log.length, 0, "geerbter Name (constructor): keine Anfrage gestellt");
}
{
  const { net, log } = stellNetz(alles);
  const r = await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, net, wait);
  eq([r.ok, r.plan.gear, r.plan.mastery, r.plan.weapons], [true, {}, [], ["Longbow", "Crossbow"]], "Skill-Link: ohne Ausruestung und Meisterschaft");
  eq(log[0].url.includes("skillBuilder.getSkillBuildsBySlug") && !log[0].url.includes("getCharacter"), true, "Skill-Link: nur der Skill-Build");
}
{
  const kaputt = stellNetz(() => ({ status: 200, text: "<html>" }));
  eq(await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, kaputt.net, wait), { ok: false, error: "shape" }, "keine JSON-Antwort");
  const form = stellNetz(() => ({ status: 200, text: JSON.stringify([ok({ builds: "x" })]) }));
  eq(await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, form.net, wait), { ok: false, error: "shape" }, "falsche Form");
  const gross = stellNetz(() => ({ status: 200, text: "x".repeat(1024 * 1024 + 1) }));
  eq(await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, gross.net, wait), { ok: false, error: "shape" }, "ueber 1 MB verworfen");
  const zeit = { net: async () => { const e = new Error("t"); e.name = "TimeoutError"; throw e; } };
  eq(await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, zeit.net, wait), { ok: false, error: "timeout" }, "Zeitueberschreitung");
  // eine Fehlerseite ohne JSON (404 leer, 502 als HTML): niemand hat fuer Questlog geantwortet -
  // Spezifikation 6 "Keine Antwort", nicht "Borometer braucht ein Update"
  const leer = stellNetz(() => ({ status: 404, text: "" }));
  eq(await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, leer.net, wait), { ok: false, error: "timeout" }, "Fehlerseite (404 leer) wie keine Antwort");
  const tor = stellNetz(() => ({ status: 502, text: "<html>Bad Gateway</html>" }));
  eq(await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, tor.net, wait), { ok: false, error: "timeout" }, "Fehlerseite (502 HTML) wie keine Antwort");
  // JSON, aber kein Buendel der richtigen Laenge: fremde Form, gleich welcher Status
  const falsch = stellNetz(() => ({ status: 404, text: JSON.stringify([ok({}), ok({})]) }));
  eq(await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, falsch.net, wait), { ok: false, error: "shape" }, "404 mit Buendel falscher Laenge: Form");
  const einzeln = stellNetz(() => ({ status: 404, text: JSON.stringify({ error: { message: "x" } }) }));
  eq(await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, einzeln.net, wait), { ok: false, error: "shape" }, "404 mit JSON ohne Buendel: Form");
}
{
  // tRPC antwortet NOT_FOUND als HTTP 404 mit dem Buendel: gelesen, das Element heisst "nicht da"
  const nf = { error: { message: "Not found", code: -32004, data: { code: "NOT_FOUND", httpStatus: 404, path: "x" } } };
  const nfSuper = { error: { json: { message: "Not found", code: -32004, data: { code: "NOT_FOUND", httpStatus: 404 } } } };
  for (const [name, el] of [["einfach", nf], ["superjson", nfSuper]]) {
    const c = stellNetz(() => ({ status: 404, text: JSON.stringify([el]) }));
    eq(await ql.fetchPlan(Q + "character-builder/Weg", "en", null, c.net, wait), { ok: false, error: "missing" }, "404 mit Buendel, Charakter NOT_FOUND (" + name + "): nicht da");
    const s = stellNetz(() => ({ status: 404, text: JSON.stringify([el]) }));
    eq(await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, s.net, wait), { ok: false, error: "missing" }, "404 mit Buendel, Skill-Builds NOT_FOUND (" + name + "): nicht da");
  }
  // ein 404-Buendel mit gueltigen Daten wird gelesen wie 200
  const gut = stellNetz((procs, input) => ({ ...alles(procs, input), status: 404 }));
  const r = await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, gut.net, wait);
  eq([r.ok, r.plan && r.plan.active.length], [true, 2], "404 mit gueltigem Buendel: gelesen");
  // ein einzelnes Element mit anderem Fehler bleibt ohne Daten: Form
  const anders = stellNetz(() => ({ status: 500, text: JSON.stringify([{ error: { message: "boom", code: -32603 } }]) }));
  eq(await ql.fetchPlan(Q + "character-builder/Weg", "en", null, anders.net, wait), { ok: false, error: "shape" }, "Charakter mit anderem Fehler: Form");
}
{
  let loslassen;
  const halt = new Promise((r) => { loslassen = r; });
  const lang = { net: async (url, t) => { await halt; return alles(...(() => { const u = new URL(url); return [u.pathname.split("/").pop().split(","), JSON.parse(u.searchParams.get("input"))]; })()); } };
  const erster = ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, lang.net, wait);
  eq(await ql.fetchPlan(Q + "skill-builder/USERSLUG01?build-id=21", "en", null, lang.net, wait), { ok: false, error: "busy" }, "ein Abruf gleichzeitig");
  loslassen();
  eq((await erster).ok, true, "der erste laeuft zu Ende");
}
{
  // viele Gegenstaende: die Obergrenze haelt, der Plan kommt trotzdem
  const viele = {};
  for (let i = 0; i < 30; i++) viele["slot" + i] = { id: "item_" + i };
  const CHAR1 = ok({ status: "ACCESSIBLE", character: { user: { slug: "USERSLUG01" } }, builds: [
    { id: 11, name: "Raid", skillBuildId: 21, weaponSpecializationBuildId: 31, weaponTypes: ["bow", "crossbow"], equipment: viele }] });
  const { net, log } = stellNetz((procs, input) => procs[0] === "characterBuilder.getCharacter"
    ? { status: 200, text: JSON.stringify([CHAR1]) } : alles(procs, input));
  const r = await ql.fetchPlan(Q + "character-builder/HighEliteOfTheWisdom", "en", null, net, wait);
  eq([r.ok, Object.keys(r.plan.gear).length, log.length <= ql.MAX_REQUESTS], [true, 30, true], "30 Gegenstaende: Plan vollstaendig, Anfragen gedeckelt");
}

// --- Zuschnitt: Werte vor Namen, auf IDs und Zahlen (Spezifikation Steckbrief 4.1/4.2). Der Helfer schneidet weiter so zu;
// die Seite nimmt seit Aufgabe 12 davon nur die Waffen, den Rest verwirft sie.
eq(ql.migrateRune("Head_Def_Rune_Usable_kA_001") + "|" + ql.migrateRune("x"), "Head_Def_Rune_Usable_kA_001|x", "Helfer: eine heutige und eine fremde ID bleiben");
// aus test-gear-core.mjs (alte Runen-IDs), Aufgabe 12: die erwarteten IDs am Helfer selbst
eq(ql.migrateRune("Weapon_Atk_Rune_kAA2_lv20"), "Weapon_Atk_Rune_Usable_kAA2_001", "Helfer: alte ID _lv20");
eq(ql.migrateRune("Ring_All_Rune_kB_lv55"), "Ring_All_Rune_Usable_kA_001", "Helfer: Chaos kB -> kA");
eq(ql.migrateRune("Ring_All_Rune_Usable_kC_001"), "Ring_All_Rune_Usable_kA_001", "Helfer: Chaos kC -> kA");
eq(ql.migrateRune("Weapon_Atk_Rune_Usable_kAA2_001"), "Weapon_Atk_Rune_Usable_kAA2_001", "Helfer: neue ID bleibt");
// Namen in diesen Antworten sind erfunden und tragen alle "NAME", damit der Test sie im Zuschnitt findet
const GEAR = {
  main_hand: { id: "bow_t", perk: "Perk_bow_t", heroic: { 1: "int" }, traits: { all_accuracy: 800 }, uniqueTraits: { per: 8 },
    resonance: null, runes: { 0: { lvl: 120, runeId: "Weapon_Atk_Rune_Usable_kAA2_001", statId: "skill_power_amplification" },
                              1: { lvl: 120, runeId: "Weapon_Ast_Rune_Usable_kAA2_001", statId: "skill_power_resistance" },
                              2: { lvl: 120, runeId: "Weapon_Def_Rune_Usable_kAA2_001", statId: "hp_max" } } },
  head: { id: "head_t", itemLevel: 60, traits: { skill_cooldown_modifier: 600 }, resonance: "cost_regen", resonanceTier: 4,
    runes: { 0: { lvl: 60, runeId: "Head_Atk_Rune_kA_lv20", statId: "pvp_melee_accuracy" } } },
  belt: { id: "", traits: {} },
};
const CHAR_G = ok({ status: "ACCESSIBLE", character: { user: { slug: "USERSLUG01" } }, builds: [
  { id: 11, name: "Raid", skillBuildId: 21, weaponSpecializationBuildId: 31, weaponTypes: ["bow", "crossbow"], equipment: GEAR }] });
const ITEM = {
  bow_t: { id: "bow_t", name: "NAME Bogen", itemStats: { main: { 75: { mainhand: { min: 88, max: 352 }, extra: { attack_speed_main_hand: 776 } } },
    extra: { 75: { dex: 17 } }, random_stat_group_1: [{ stat_id: "int", base_value: 14 }, { stat_id: "str", base_value: 14 }] },
    itemAvailablePerks: [{ id: "Perk_bow_t", name: "NAME Perk" }], itemIsPartOfItemSets: [] },
  head_t: { id: "head_t", name: "NAME Hut", itemStats: { main: { 60: { armor: { melee_armor: 395 } }, 61: { armor: { melee_armor: 400 } }, 90: { armor: { melee_armor: 545 } } },
    extra: { 60: { hp_max: 665 }, 61: { hp_max: 685 }, 90: { hp_max: 1230 } }, resonance: { cost_regen: { tiers: [26000, 39000, 47000, 52000] } } },
    itemIsPartOfItemSets: [{ id: "set_t", name: "NAME Set", itemSetMadeOfItems: [{}, {}, {}, {}, {}],
      itemSetBonus: [{ setCount: 2, bonusPassive: [{ text: "NAME Bonus zwei" }] }, { setCount: 4, bonusPassive: [{ text: "NAME Bonus vier" }] }] }] },
};
const RUNEN = {
  Weapon_Atk_Rune_Usable_kAA2_001: { name: "NAME Rune", runeType: "attack", itemStats: { random_stat_group_1: [{ stat_id: "skill_power_amplification", levels: Array.from({ length: 121 }, (_, i) => 5 * i) }] } },
  Weapon_Ast_Rune_Usable_kAA2_001: { name: "NAME Rune", runeType: "assist", itemStats: { random_stat_group_1: [{ stat_id: "skill_power_resistance", levels: Array.from({ length: 121 }, (_, i) => 3.5 * i) }] } },
  Weapon_Def_Rune_Usable_kAA2_001: { name: "NAME Rune", runeType: "defense", itemStats: { random_stat_group_1: [{ stat_id: "hp_max", levels: Array.from({ length: 121 }, (_, i) => 6 * i) }] } },
  Head_Atk_Rune_Usable_kA_001: { name: "NAME Rune", runeType: "attack", itemStats: { random_stat_group_1: [{ stat_id: "pvp_melee_accuracy", levels: Array.from({ length: 61 }, (_, i) => 6 * i) }] } },
  Unused_Rune_Usable_kA_001: { name: "NAME Rune", runeType: "chaos", itemStats: { random_stat_group_1: [] } },
};
const SYN = { s1: { id: "rune_synergy_Weapon_41_attack_assist_defense", name: "NAME Syn", combination: ["attack", "assist", "defense"], equipmentCategory: "weapon", stats: { dex: 4, attack_speed_modifier: 350 } },
              s2: { id: "rune_synergy_test", combination: ["attack", "defense", "assist"], equipmentCategory: "test", stats: { hp_max: 1 } } };
const FMT = { all_accuracy: { name: "NAME Trefferchance", valueFormat: "{0}", multiplier: 0.1 },
              attack_speed_modifier: { name: "NAME Tempo", valueFormat: "{0}\u00a0%", multiplier: 0.01 },
              attack_speed_main_hand: { name: "NAME Grundtempo", valueFormat: "{0}\u00a0Sek.", multiplier: 0.001 },
              skill_cooldown_modifier: { name: "NAME Abklingtempo", valueFormat: "{0}\u00a0%", multiplier: 0.01 },
              cost_regen: { name: "NAME Mana", valueFormat: "{0}", multiplier: 0.001 },
              attack_range_modifier: { name: "NAME Reichweite", valueFormat: "{0}%", multiplier: 0.01 } };
function ausruestung(kaputt = {}) {
  return (procs, input) => {
    if (kaputt.alles && procs.includes(kaputt.alles)) throw Object.assign(new Error("t"), { name: "TimeoutError" });
    const out = procs.map((p, i) => {
      const a = input[i];
      if (kaputt[p]) return { error: { message: "boom" } };
      if (p === "characterBuilder.getCharacter") return CHAR_G;
      if (p === "database.getItem") return ITEM[a.id] ? ok(ITEM[a.id]) : { error: { message: "boom" } };
      if (p === "characterBuilder.getEquipmentRunes") return ok(RUNEN);
      if (p === "characterBuilder.getRuneSynergies") return ok(SYN);
      if (p === "statFormat.getStatFormat") return ok(FMT);
      if (p === "database.getWeaponSpecialization") return ok({ id: a.id, name: "NAME Knoten", stats: Array.from({ length: 10 }, (_, k) => ({ attack_range_modifier: 32 * (k + 1) })) });
      return JSON.parse(alles([p], [a]).text)[0];
    });
    return { status: out.some((o) => o.error) ? 500 : 200, text: JSON.stringify(out) };
  };
}
{
  warte.length = 0;
  const { net, log } = stellNetz(ausruestung());
  const r = await ql.fetchPlan(Q + "character-builder/HighEliteOfTheWisdom?buildId=11", "de", null, net, wait);
  const procs = log.map((x) => [...new Set(new URL(x.url).pathname.split("/").pop().split(","))].join("+"));
  eq(procs, ["characterBuilder.getCharacter", "skillBuilder.getSkillBuildsBySlug+weaponSpecialization.getWeaponSpecializationBySlug",
    "database.getItem", "characterBuilder.getEquipmentRunes", "characterBuilder.getRuneSynergies+statFormat.getStatFormat",
    "database.getWeaponSpecialization", "database.getSkillSet"], "Reihenfolge: Charakter, Builds, Gegenstaende, Runen, Synergien+Format, Knoten, Skill-Namen");
  eq([r.requests, warte.every((ms) => ms === 250)], [7, true], "sieben Anfragen, 250 ms dazwischen");
  eq(Object.keys(r.gear.equip), ["main_hand", "head"], "leere Plaetze fehlen");
  eq(r.gear.equip.head, { id: "head_t", lvl: 60, traits: { skill_cooldown_modifier: 600 }, unique: {}, res: "cost_regen", resTier: 4,
    hero: {}, pot: null, perk: null, runes: [{ id: "Head_Atk_Rune_kA_lv20", stat: "pvp_melee_accuracy", lvl: 60 }] }, "Eintrag: was gewaehlt ist, als IDs und Zahlen");
  eq(Object.keys(r.gear.items.head_t.lv), ["60", "90"], "Grundwerte nur fuer die geplante und die hoechste Stufe");
  eq(r.gear.items.bow_t.lv["75"], { extra: { dex: 17 }, armor: {}, main: { attack_speed_main_hand: 776 }, hand: [88, 352] }, "Grundwerte der Haupthand mit Schaden");
  eq(r.gear.items.head_t.sets, [{ id: "set_t", of: 5, tiers: [2, 4] }], "Set: ID, Teilzahl, Stufen - ohne Text");
  eq(Object.keys(r.gear.runes).sort(), ["Head_Atk_Rune_Usable_kA_001", "Weapon_Ast_Rune_Usable_kAA2_001",
    "Weapon_Atk_Rune_Usable_kAA2_001", "Weapon_Def_Rune_Usable_kAA2_001"], "Runen-Katalog: nur die Runen des Builds, alte ID umgeschrieben");
  eq(r.gear.runes.Head_Atk_Rune_Usable_kA_001, { type: "attack", stats: { pvp_melee_accuracy: { 60: 360 } } }, "Rune: Typ und Wert je geplanter Stufe");
  eq(r.gear.syn.map((x) => x.id), ["rune_synergy_Weapon_41_attack_assist_defense"], "Synergien ohne die Testart");
  eq([r.gear.fmt.attack_speed_modifier, r.gear.fmt.attack_speed_main_hand, r.gear.fmt.all_accuracy],
     [{ m: 0.01, f: "%" }, { m: 0.001, f: "s" }, { m: 0.1, f: "n" }], "Format: Multiplikator und Einheit");
  eq(r.gear.mast, { Bow_Node_01: { attack_range_modifier: 320 } }, "Meisterschaft: Werte bei der geplanten Stufe (stats[lvl-1])");
  eq(JSON.stringify(r.gear).includes("NAME"), false, "der Zuschnitt traegt keinen Namen und keinen Text");
  eq([r.names.gear.bow_t, r.names.sets.set_t, r.names.perks.Perk_bow_t, r.names.stats.attack_speed_modifier, r.names.mastery.Bow_Node_01],
     ["NAME Bogen", { name: "NAME Set", tiers: { 2: "NAME Bonus zwei", 4: "NAME Bonus vier" } }, "NAME Perk", "NAME Tempo", "NAME Knoten"],
     "Namen und Set-Texte kommen getrennt, fuer die Sitzung");
}
// seit Aufgabe 12 ohne Steckbrief der Seite: der fehlende Katalog steht im Zuschnitt als null, der Rest kommt
for (const [was, kaputt, lack] of [["Runen", { "characterBuilder.getEquipmentRunes": 1 }, "runes"],
                                    ["Synergien", { "characterBuilder.getRuneSynergies": 1 }, "syn"],
                                    ["Format", { "statFormat.getStatFormat": 1 }, "fmt"],
                                    ["Runen-Anfrage ohne Antwort", { alles: "characterBuilder.getEquipmentRunes" }, "runes"]]) {
  const { net } = stellNetz(ausruestung(kaputt));
  const r = await ql.fetchPlan(Q + "character-builder/HighEliteOfTheWisdom?buildId=11", "de", null, net, wait);
  eq([r.ok, ["runes", "syn", "fmt"].filter((k) => r.gear[k] === null), Object.keys(r.gear.items).length, r.plan.weapons], [true, [lack], 2, ["Longbow", "Crossbow"]],
     was + " fehlen: der Abruf kommt mit den Waffen, der Katalog steht als null da");
}
{
  const { net } = stellNetz(ausruestung({ alles: "database.getItem" }));
  eq(await ql.fetchPlan(Q + "character-builder/HighEliteOfTheWisdom?buildId=11", "de", null, net, wait), { ok: false, error: "timeout" },
     "Gegenstaende ohne Antwort: kein halber Abruf");
}
{
  // ein voller Charakter wie "Borometer": 15 Teile, 56 Knoten, 20 Skills -> 10 Anfragen
  const voll = {}, knoten = [], aktiv = [];
  for (let i = 0; i < 15; i++) voll["slot" + i] = { id: "item_" + i, runes: { 0: { lvl: 1, runeId: "Weapon_Atk_Rune_Usable_kAA2_001", statId: "skill_power_amplification" } } };
  for (let i = 0; i < 60; i++) knoten.push({ id: "Bow_Node_" + i, lvl: 10 });
  for (let i = 0; i < 12; i++) aktiv.push({ lvl: 20, order: i, skillId: "SkillSet_A" + i, traits: [] });
  const passiv = Array.from({ length: 8 }, (_, i) => ({ lvl: 1, order: i, skillId: "SkillSet_P" + i }));
  const antwort = (voll, knotenZahl) => (procs, input) => {
    if (procs[0] === "characterBuilder.getCharacter") return { status: 200, text: JSON.stringify([ok({ status: "ACCESSIBLE",
      character: { user: { slug: "USERSLUG01" } }, builds: [{ id: 11, name: "Raid", skillBuildId: 21, weaponSpecializationBuildId: 31,
        weaponTypes: ["bow", "crossbow"], equipment: voll }] })]) };
    if (procs[0] === "skillBuilder.getSkillBuildsBySlug") return { status: 200, text: JSON.stringify([
      ok({ builds: [{ id: 21, name: "Raid", mainHand: "bow", offHand: "crossbow", active: aktiv, passive: passiv }] }),
      ok({ builds: [{ id: 31, name: "Raid", mainHand: "bow", offHand: "crossbow", specialization: knoten.slice(0, knotenZahl) }] })]) };
    return ausruestung()(procs, input);
  };
  const a = stellNetz(antwort(voll, 56));
  const r = await ql.fetchPlan(Q + "character-builder/HighEliteOfTheWisdom?buildId=11", "de", null, a.net, wait);
  eq([r.requests, Object.keys(r.gear.mast).length, Object.keys(r.names.skills).length], [10, 56, 20], "voller Charakter-Link: 10 Anfragen, alle Werte, alle Namen");
  const viel = {};
  for (let i = 0; i < 30; i++) viel["slot" + i] = { id: "item_" + i };
  const b = stellNetz(antwort(viel, 60));
  const r2 = await ql.fetchPlan(Q + "character-builder/HighEliteOfTheWisdom?buildId=11", "de", null, b.net, wait);
  eq([r2.requests, Object.keys(r2.gear.mast).length, b.log.length <= ql.MAX_REQUESTS], [11, 60, true],
     "30 Teile ohne Runen, 60 Knoten, 20 Skills: 11 Anfragen, keine Werte fehlen");
}

// --- Speicher (src/main/plans.ts): ein Steckbrief nur aus IDs und Zahlen (Spezifikation Steckbrief 4.3 und 6).
// plans.ts haengt ueber paths.ts an electron; hier steht ein gestelltes electron, die Datei liegt in einem Temp-Ordner.
{
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const ordner = mkdtempSync(join(tmpdir(), "boro-plans-"));
  process.env.APPDATA = ordner;
  const electron = { name: "electron", setup(b) {
    b.onResolve({ filter: /^electron$/ }, () => ({ path: "electron", namespace: "gestellt" }));
    b.onLoad({ filter: /.*/, namespace: "gestellt" }, () => ({ loader: "js",
      contents: "export const app = { isPackaged: false, getAppPath: () => process.env.APPDATA, getPath: () => process.env.APPDATA };" }));
  } };
  const built = await esbuild.build({ entryPoints: [join(root, "src/main/plans.ts")], bundle: true, format: "esm",
    platform: "node", write: false, logLevel: "silent", plugins: [electron] });
  const speicher = await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64"));
  /* Die Steckbriefe stehen fertig in scripts/fixtures/plan-sheets.json: aus steckbrief-borometer.json (entfiel danach) mit
     steckbrief() gerechnet, bevor der Steckbrief der Seite entfiel (Aufgabe 12, 29.09.). Alte Plaene in
     boro-plans.json tragen sie weiter, und putPlan prueft sie weiter - die Grenze ist der Helfer. */
  const FIX = JSON.parse(readFileSync(join(root, "scripts", "fixtures", "plan-sheets.json"), "utf8"));
  const brief = FIX.brief;
  const plan = (sheet) => ({ link: Q + "character-builder/TestChar?buildId=8498235", at: 1, name: "Borometer",
    weapons: ["Longbow", "Crossbow"], active: [], passive: [], mastery: FIX.mastery, gear: {}, keys: {}, ...(sheet === undefined ? {} : { sheet }) });
  const mit = (f) => { const c = structuredClone(brief); f(c); return c; };
  const briefMitNamen = FIX.briefMitNamen;
  // die Testdatei selbst: nur IDs und Zahlen, dazu die erfundenen Teilenamen "Test <Platz>" (aus test-gear-core.mjs, Aufgabe 12)
  const texte = []; JSON.stringify(FIX, (k, v) => { if (typeof k === "string" && k) texte.push(k); if (typeof v === "string") texte.push(v); return v; });
  eq(texte.filter((x) => !/^[A-Za-z0-9_.%-]{1,80}$/.test(x) && !/^Test [a-z0-9_]+$/.test(x)), [], "Testdatei: keine Zeichenkette mit Leerzeichen oder Text");
  const faelle = [
    ["der Steckbrief \"Borometer\"", brief, true],
    ["ein Feld name im Steckbrief", mit((c) => { c.name = "Hut"; }), false],
    ["der Steckbrief mit Item-Namen", briefMitNamen, true],
    ["ein Item-Name mit Umlaut und Bindestrich", mit((c) => { c.slots.head.name = "Flügelhut des Bestrafers – Test"; }), true],
    ["ein Item-Name mit Steuerzeichen", mit((c) => { c.slots.head.name = "Hut\u0007"; }), false],
    ["ein Item-Name mit Richtungszeichen", mit((c) => { c.slots.head.name = "Hut\u202e"; }), false],
    ["ein Item-Name mit 81 Zeichen", mit((c) => { c.slots.head.name = "H".repeat(81); }), false],
    ["ein leerer Item-Name", mit((c) => { c.slots.head.name = ""; }), false],
    ["ein Set-Name", mit((c) => { c.sets[0].name = "Flügel des Bestrafers"; }), false],
    ["ein Set-Text", mit((c) => { c.sets[0].text = "Stufe 2: Fähigkeitsschaden-Bonus +50"; }), false],
    ["ein Perk-Name statt Perk-ID", mit((c) => { c.slots.main_hand.perk = "Letzter Schuss aus großer Höhe"; }), false],
    ["ein Knotenname statt Knoten-ID", mit((c) => { c.mast["Segen der Weisheit"] = { dex: 2 }; }), false],
    ["ein Text mit Leerzeichen als Item", mit((c) => { c.slots.head.item = "Hut des Bestrafers"; }), false],
    ["ein Set-Text statt Set-ID", mit((c) => { c.sets[0].id = "Stufe 2: +50"; }), false],
    ["ein Wert als Text", mit((c) => { c.slots.head.vals.traits.skill_cooldown_modifier = "6 %"; }), false],
    ["eine fremde Herkunft", mit((c) => { c.slots.head.vals.set = { hp_max: 1 }; }), false],
    ["eine Rune mit Namen", mit((c) => { c.slots.head.runes[0].name = "Angriffsrune"; }), false],
    ["ein unbekannter Katalog in lack", mit((c) => { c.lack = ["names"]; }), false],
    // aus test-gear-core.mjs (Form eines gelesenen Steckbriefs), Aufgabe 12 - dort gegen die Seite, hier gegen den Helfer
    ["ein Item-Name mit Leerraum am Rand", mit((c) => { c.slots.head.name = " Hut"; }), false],
    ["ein Item-Name als Zahl", mit((c) => { c.slots.head.name = 5; }), false],
    ["ein unbekannter Runentyp", mit((c) => { c.slots.head.runes[0].type = "fire"; }), false],
    ["eine unbekannte Einheit", mit((c) => { c.fmt.hp_max = "Punkte"; }), false],
    ["ein Name im Teil (Spezifikation 11)", mit((c) => { c.slots.head.name = "Flügelhut des Bestrafers"; }), true],
    ["ein Item-Name mit Nullzeichen", mit((c) => { c.slots.head.name = "Hut\u0000"; }), false],
    ["ein Runenname in der Haupthand", mit((c) => { c.slots.main_hand.runes[0].name = "Angriffsrune"; }), false],
  ];
  let n = 0;
  for (const [was, sheet, gut] of faelle) {
    const id = "psheet" + String(n++).padStart(4, "0");
    eq(speicher.putPlan(id, plan(sheet)), gut ? "saved" : "refused", "Helfer: " + was + (gut ? " wird gespeichert" : " wird abgelehnt"));
  }
  eq(speicher.putPlan("pohnesheet", plan(undefined)), "saved", "ein Plan ohne Steckbrief (von vor dem Steckbrief) bleibt speicherbar");
  // Aufgabe 12: ein Eintrag nur aus Link, Zeitpunkt, eigenem Namen und Waffen - und derselbe geloest - wird gespeichert
  const eintrag = { link: Q + "character-builder/TestChar?buildId=12", at: 2, name: "Night", weapons: ["Dagger", "Staff"] };
  eq([speicher.putPlan("peintrag01", eintrag), speicher.putPlan("peintrag01", { ...eintrag, geloest: 3 })], ["saved", "saved"],
     "ein Eintrag aus Link, Waffen und eigenem Namen wird gespeichert, geloest ebenso (ueberschrieben, nie entfernt)");
  eq(speicher.putPlan("peintrag02", { ...eintrag, link: "https://maxroll.gg/tl/build/x" }), "refused", "ein Eintrag mit fremdem Link wird abgelehnt");
  const gross = mit((c) => { for (let i = 0; i < 14; i++) c.slots["talistone" + i] = c.slots.main_hand; });
  eq([JSON.stringify(plan(gross)).length > 16384, speicher.putPlan("pgross0001", plan(gross))], [true, "saved"], "ueber 16 KB, unter 48 KB: gespeichert");
  // der schlimmste Fall mit Namen: 30 Teile (jedes so voll wie die Haupthand), jedes mit einem Namen aus 80 Zeichen
  const vollNamen = mit((c) => { for (let i = 0; i < 15; i++) c.slots["talistone" + i] = c.slots.main_hand;
    for (const k of Object.keys(c.slots)) c.slots[k] = { ...c.slots[k], name: "Ä".repeat(80) }; });
  eq([Object.keys(vollNamen.slots).length, JSON.stringify(plan(vollNamen)).length < 49152, speicher.putPlan("pgross0003", plan(vollNamen))], [30, true, "saved"],
     "30 volle Teile mit 80 Zeichen langen Namen: unter 48 KB (" + JSON.stringify(plan(vollNamen)).length + " Zeichen), gespeichert");
  const zuGross = structuredClone(gross);
  zuGross.fmt = Object.fromEntries(Array.from({ length: 400 }, (_, i) => ["stat_" + String(i).padStart(3, "0") + "_x".repeat(30), "%"]));
  eq([JSON.stringify(plan(zuGross)).length > 49152, speicher.putPlan("pgross0002", plan(zuGross))], [true, "refused"], "ueber 48 KB: abgelehnt");
  rmSync(ordner, { recursive: true, force: true });
}

console.log();
if (failed) { console.log(`PLAN CORE FAILED - ${failed}`); process.exit(1); }
console.log("PLAN CORE PASSED");
