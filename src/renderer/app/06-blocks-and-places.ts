import { DEAD_TIME, SERIES_N, seriesColor, state } from "./01-state";
import { rejoinRow, splitLine } from "./04-log-parsing";
import { gapsOf } from "./15-weapons-and-ventius";
import type {
  Dungeon, Encounter, Fight, FightBlock, LocalizedName, ParsedGrid, RankedSkill, SkillStats,
  TargetStats
} from "../types";

/* ---------- blocks: a stretch of fights with no long pause in it ----------
   A dungeon run is not in the log. What is in the log is idle time, and on a
   night of three dungeons it separates cleanly: measured on 24 fights, every
   pause inside a run was 15 to 51 s and every pause between two runs was 112,
   224, 441, 452 or 927 s. Nothing lands between 51 and 112, so the cut is not
   a close call - which is exactly why it gets its own number rather than
   riding on `gap`. Deriving it from `gap` would have coupled a run boundary
   to the "Split after" field: at 4 s that field would put the boundary at
   48 s, under the measured 51, and quietly cut a run in half.

   The block is NAMED by the enemy that took the most damage in it, and only
   turned into a dungeon name when that enemy is one we know. BOSS_DUNGEON is
   three entries because three were named; anything else keeps the enemy's
   own name, which is true of every log and invents nothing. */
const BLOCK_GAP = 60;      // seconds of quiet that end a block
export const PHASE_GAP = 60;      // ...and how long a boss may be away and still be one fight
const KOLOSS_GAP = 180;    // ...and how long a colossus event may pause between its parts (blockPass)
/* Every dungeon in the game and the boss that ends it, with both spellings of
   the boss where the two clients differ: the log writes whatever the game
   client was set to, so a clan running a German client writes "Grauauge"
   where an English one writes "Grayeye", and a table that knew only one of
   them would name half the clan's logs and not the other half.

   `stars` is the difficulty the game itself puts on a dungeon; a raid part
   carries `of` instead, the raid it belongs to. */
const ALTAR = {en:"Altar of Calanthia", de:"Altar von Calanthia"};
const DUNGEONS: Dungeon[] = [
  {stars:4, en:"Frostbreath Cave",       de:"Frostatemhöhle",              boss:["Vulcanus"]},
  /* Fellinex goes untargetable at 80% and the fight moves to Fellini for a
     while before coming back to him. Declared here rather than guessed from
     the pause, because a pause is also what a wipe looks like.

     Fellini is fought BEFORE the boss as well, on the way in - so this is not
     "Fellini belongs to Fellinex" but "once Fellinex has started, Fellini is
     part of it". The chain has to begin on the boss; see segment(). */
  {stars:4, en:"Stone Grave Cradle",     de:"Steingrab-Wiege",             boss:["Fellinex"],
   phases:{"Fellinex": ["Fellini"]}},
  {stars:4, en:"Deathless Queen's Lair", de:"Höhle der Untoten Königin",   boss:["Lyxara"]},
  {stars:4, en:"Hellfire Crucible",      de:"Höllenfeuertiegel",           boss:["Deus Chimaerus"]},
  {stars:3, en:"Colossal Coliseum",      de:"Kolossales Kolosseum",        boss:["Nerzatum"]},
  {stars:3, en:"Fate's Abyss",           de:"Abgrund des Schicksals",      boss:["Lucien"]},
  {stars:3, en:"Crypt of Augmentation",  de:"Krypta der Verstärkung",      boss:["Velentra"]},
  {stars:2, en:"Twisted Laboratory",     de:"Verqueres Labor",           boss:["Kaiser Crimson","Kayser"]},
  {stars:2, en:"Doomrot Grove",          de:"Hain der Verderbnisfäule",    boss:["Norn Bercant"]},
  {stars:2, en:"Chapel of Madness",      de:"Kapelle des Wahnsinns",       boss:["Grayeye","Grauauge"]},
  {stars:2, en:"Halls of Tragedy",       de:"Hallen der Tragik",           boss:["Limuny Bercant"]},
  /* King Khanzaizin hat keine Pause im Kampf - Auskunft vom 01.10. zu den
     zusammengeklebten Pulls vom 18.09.: "waren wipes". Gemessen an den 19
     Pulls jenes Abends: 8 davon bestanden aus 2 bis 4 Teilen, die PHASE_GAP
     zusammenhielt, mit 22 bis 55 s voelliger Stille dazwischen (kein Treffer
     auf irgendetwas), zu keiner festen Zeit (der erste Teil endete bei 33
     bis 132 s) und nach keinem festen Schaden (8,9 M bis 30,5 M); die
     letzten zwei Pulls des Abends hatten gar keine Pause. Ab 20 s Stille -
     unter dem kuerzesten Wipe, ueber "Trennen nach" (8 s) - beginnt darum
     ein neuer Kampf. Nur dieser Boss: die anderen behalten die Minute
     (wipeGap, bossPause, segment()). */
  {stars:2, en:"Rancorwood",             de:"Bitterforst",                 boss:["King Khanzaizin","König Khanzaizin"],
   wipeGap:20},
  {stars:2, en:"Torture Chamber of Screams", de:"Folterkammer der Schreie", boss:["Kaligras"]},
  {stars:2, en:"Carmine Rage Island",    de:"Insel des Karmesinzorns",     boss:["Gaitan"]},
  {stars:2, en:"Valley of Slaughter",    de:"Tal des Gemetzels",           boss:["Turka"]},
  {stars:2, en:"Voidwastes",             de:"Leere Ödlande",               boss:["Shakarux"]},
  {stars:2, en:"Island of Terror",       de:"Insel der Furcht",            boss:["Kertaki"]},
  {stars:1, en:"Cave of Destruction",    de:"Höhle der Zerstörung",        boss:["Lequirus"]},
  {stars:1, en:"Tyrant's Isle",          de:"Insel des Tyrannen",          boss:["Toublek"]},
  {stars:1, en:"Butcher's Canyon",       de:"Schlächterschlucht",          boss:["Duke Magna","Magna-Fürst"]},
  {stars:1, en:"Temple of Slaughter",    de:"Tempel des Gemetzels",        boss:["Rex Chimaerus","Rex Chimärus"]},
  {stars:1, en:"Cursed Wasteland",       de:"Verfluchte Einöde",           boss:["Shaikal"]},
  {stars:1, en:"Death's Abyss",          de:"Todesabgrund",                boss:["Karnix"]},
  {lvl:40, en:"Cave of Desperation",     de:"Höhle der Verzweiflung",      boss:["Lacune"]},
  {lvl:30, en:"Roaring Temple",          de:"Dröhnender Tempel",           boss:["King Chimaerus","König Chimärus"]},
  {lvl:20, en:"Specter's Abyss",         de:"Gespenster Abgrund",          boss:["Heliber"]},
  /* A solo abyss dungeon: no star tier and no level, so it says what it is
     instead. Both of its bosses are listed, the one at the gate and the one
     at the end - a block is named by whichever boss it holds, and a run that
     stopped at the mini-boss is still this dungeon.

     Quente's name has a comma in it, which is the delimiter this log uses.
     Written here exactly as the game writes it, because that is what the
     target column holds once the row is put back together. */
  {solo:true, en:"Tumgir Hollow",        de:"Tumgir Kessel",
   boss:["Silent Gatekeeper Vahelon", "Stiller Torwächter Vahelon",
         "Quente, Executor of the Seal", "Quente, Vollstrecker des Siegels"],
   // two bosses, two spellings each - the flat list above names the dungeon,
   // these say which name belongs to which of them
   bosses:[["Silent Gatekeeper Vahelon", "Stiller Torwächter Vahelon"],
           ["Quente, Executor of the Seal", "Quente, Vollstrecker des Siegels"]]},
  /* The twelve-player raid, which is three parts under one name. The part is
     what a block actually is, so the part names the heading and the raid sits
     under it - the same shape as a dungeon that is only itself.
     One object for the raid, shared by its parts: written out three times it
     would be three objects, and "are these two parts of the same raid" is
     asked by identity. */
  {of:ALTAR, en:"The Forgotten Citadel",  de:"Die vergessene Zitadelle",   boss:["Dragaryle"]},
  /* The one part that really holds two bosses. Everywhere else the list is
     the spellings of a single one, which is why `bosses` only appears where
     that default would be wrong. */
  /* Radeth kommt erst nach Zairos und Vulkan, bestaetigt - kein
     dritter gleichzeitiger Boss, sondern ein eigener Kampf danach. Deshalb
     steht er in `bosses` als eigene Gruppe: fightName() haengt einen Namen
     nur an, wenn er im selben Pull Schaden nimmt, und ein spaeterer Pull auf
     Radeth ist ein eigener Eintrag in `list`, keiner mit Zairos und Vulkan. */
  {of:ALTAR, en:"The Corridor of Anguish", de:"Der Korridor der Pein",     boss:["Zairos","Vulkan","Radeth"],
   bosses:[["Zairos"], ["Vulkan"], ["Radeth"]]},
  /* "Calanthia of Destruction" ist die zweite Phase - im Hardmodus und im
     Albtraum-Modus, bestaetigt. Im Log wechselt der Name mitten
     im Pull hin und her, ohne Luecke zwischen den Zeitstempeln. Ein Log mit
     deutschem Client schreibt in dieser Phase "Calanthia der Zerstoerung". */
  {of:ALTAR, en:"The Altar of Rebirth",   de:"Der Altar der Wiedergeburt", boss:["Calanthia"],
   phases:{"Calanthia": ["Calanthia of Destruction", "Calanthia der Zerstörung"]},
   /* Dieselbe Gegnerin unter anderem Namen, kein eigener Gegner: fuer die
      Nebenziele (hauptzielVon) zaehlt sie als Hauptziel. Fellini steht
      oben nur in phases - er ist ein eigener Gegner und bleibt Nebenziel. */
   forms:{"Calanthia": ["Calanthia of Destruction", "Calanthia der Zerstörung"]}}
];
/* Bosses that stand in the open world. A stretch spent on one is not a dungeon
   run and must not be headed as though the app had failed to recognise a
   dungeon — it is a different thing, and the heading says which.

   Most of them carry a rank the game translates ("Aufgestiegener" / "Ascended")
   in front of a name it does not. So the rank comes off and what is left is
   matched WHOLE. Substring matching would have been shorter and would happily
   have called a "Talus Guard" the boss Talus; an exact match after a known
   prefix cannot.

   `names` lists every spelling that can turn up in the target column: both
   clients' names, and for Manticus the two bosses the encounter is actually
   made of, which is what the log writes instead. */
const BOSS_RANK = /^(?:Aufgestiegene[rsn]?|Ascended)\s+/i;
/* And what the game puts AFTER the name: "Ascended Aridus [Undead]" is
   Aridus in another state, and the rank was stripped off the front while the
   bracket stayed on the back - so 1205 rows of a real archboss fight went
   unrecognised, with no heading over them and a Ventius ceiling of their own
   under "name:aridus [undead]". */
const BOSS_STATE = /\s*\[[^\]]*\]\s*$/;
export const bareBoss = (n: string) => String(n || "").replace(BOSS_RANK, "").replace(BOSS_STATE, "").trim();
const OPEN_BOSSES = [
  {kind:"field", de:"Morokai",           en:"Morokai",        names:["Morokai"]},
  {kind:"field", de:"Königsbagger-9",    en:"Excavator-9",    names:["Königsbagger-9","Excavator-9"]},
  {kind:"field", de:"Chernobog",         en:"Chernobog",      names:["Chernobog"]},
  {kind:"field", de:"Talus",             en:"Tallus",         names:["Talus","Tallus"]},
  {kind:"field", de:"Malakar",           en:"Malakar",        names:["Malakar"]},
  {kind:"field", de:"Cornelius",         en:"Cornelius",      names:["Cornelius"]},
  {kind:"field", de:"Adentus",           en:"Adentus",        names:["Adentus"]},
  {kind:"field", de:"Ahzreil",           en:"Ahzreil",        names:["Ahzreil"]},
  {kind:"field", de:"Nirma",             en:"Nirma",          names:["Nirma"]},
  {kind:"field", de:"Aridus",            en:"Aridus",         names:["Aridus"]},
  /* Das Spiel schreibt "Minezerok", mit e in der Mitte - so steht es bei
     questlog in beiden Sprachen, und am 21.09.2026 ist es
     bestaetigt worden. Die alte kurze Schreibweise bleibt als Zweitname
     stehen: sie kostet nichts und faengt gespeicherte Laeufe auf. */
  {kind:"field", de:"Minezerok",         en:"Minezerok",      names:["Minezerok","Minezrok"]},
  {kind:"field", de:"Aelon der Große",   en:"Grand Aelon",    names:["Aelon der Große","Grand Aelon"]},
  {kind:"field", de:"Junobote",          en:"Junobote",       names:["Junobote"]},
  {kind:"field", de:"Kowazan",           en:"Kowazan",        names:["Kowazan"]},
  {kind:"field", de:"Daigon",            en:"Daigon",         names:["Daigon"]},
  {kind:"field", de:"Leviathan",         en:"Leviathan",      names:["Leviathan"]},
  {kind:"field", de:"Pakilo Naru",       en:"Pakilo Naru",    names:["Pakilo Naru"]},
  // two bosses, one encounter — the log names the halves, the heading the whole
  {kind:"field", de:"Manticus",          en:"Manticus",       names:["Akman","Deckman","Manticus"]},
  {kind:"field", de:"Thuban",            en:"Thuban",         names:["Thuban"]},
  {kind:"field", de:"Porfos",            en:"Porfos",         names:["Porfos"]},
  /* Zwei Feldbosse, am 20.09.2026 benannt. Beide schreiben
     sich im deutschen wie im englischen Client gleich - nachgesehen in
     sechs Logs, Grimturg in dreien davon, Exodus in vieren, und die
     Sprache je Log an den Skillnamen erkannt. Darum je ein Name. */
  {kind:"field", de:"Grimturg",          en:"Grimturg",       names:["Grimturg"]},
  {kind:"field", de:"Exodus",            en:"Exodus",         names:["Exodus"]},
  /* A German client calls her "Aufgestiegene Sintflutbringerin" - the game
     translates this one where it leaves Deckman and Pakilo Naru alone.
     A player who fought her says it is Deluzhnoa; no log here holds both
     spellings, so that identification is a report and not a measurement. What IS
     measured: 1475 rows under that name, no heading over them, and a Ventius
     ceiling filed under "name:sintflutbringerin" where an English client
     would have written "open:Deluzhnoa". */
  {kind:"arch",  de:"Sintflutbringerin",  en:"Deluzhnoa",
   names:["Deluzhnoa","Sintflutbringerin"]},
  {kind:"arch",  de:"Königin Bellandir", en:"Queen Bellandir", names:["Königin Bellandir","Queen Bellandir"]},
  {kind:"arch",  de:"Tevent",            en:"Tevent",         names:["Tevent"]},
  {kind:"arch",  de:"Riese Cordy",       en:"Giant Cordy",    names:["Riese Cordy","Giant Cordy"]},
  /* "Ramus" ist derselbe Gegner im deutschen Client - eine
     Auskunft vom 20.09.2026. Gemessen dazu: die zwei Namen stehen
     in sechs Logs nie im selben, Ramus 2418 Zeilen im deutschen,
     Ramux 588 im anderen. */
  {kind:"arch",  de:"Ramux",             en:"Ramux",          names:["Ramux","Ramus"]},
  /* Vegamor, am 22.09.2026 gemeldet. Wie Manticus: das Log
     nennt die Teile, die Ueberschrift nennt das Ganze. Die drei Teile
     sind Vegarus (Kern), Vegarion (Nebenkern) und Vegaorb (Elitekern) -
     die Namen und die Bilder stammen aus der Datenbank von questlog.gg,
     die englische und die deutsche Seite nennen sie gleich.
     Kein Log hier enthaelt ihn: die Schreibweise im deutschen Client ist
     damit uebernommen, nicht gemessen.
     Gemessen dazu (eigenes Log vom 29.09., englischer Client, die Kaempfe
     22:07 bis 22:20 gegen Vegamor, bestaetigt): "Vegamor's
     Claw" (299 Zeilen, 22:07:51 bis 22:08:34) ist ein weiterer Teil, und
     "Vagamont" (111 Zeilen, 22:19:11 bis 22:19:22, im Log mit
     Steuerzeichen, die das Einlesen abstreift) ist Vegamor selbst unter
     seinem inneren Namen - so heissen auch seine Bilder (12-boss-images.ts).
     Darum steht Vagamont in `forms`: der Kampf heisst Vegamor. Wie die Klaue
     und Vagamont im deutschen Client heissen, zeigt kein Log hier.
     Questlog bestaetigt es: das NPC FD_L13_AB_M_SpiritTree_Vagamont_001
     heisst dort genau "^<s=Dialogue_Speech_Text>Vagamont^</s>", ein
     Geisterbaum.
     `adds`: Gegner, die zum Ereignis gehoeren, ohne der Boss zu sein.
     "Ego-less Great Tree Warrior" (395 Zeilen) und "Mift" (30) stehen im
     Log vom 29.09. nur zwischen 22:07:03 und 22:16:26, immer in den Pausen
     zwischen den Teilen, und in keinem der anderen 99 Logs hier. Sie halten
     das Ereignis zusammen: ohne sie laege zwischen der Klaue (bis 22:08:34)
     und Vegarion (ab 22:12:23) eine Stille von 229 s, mit ihnen ist die
     laengste 99 s. Die Krieger sind "Great Tree" zum Geisterbaum - ein
     Hinweis vom 01.10. Sie bleiben Nebengegner: kein Bossbild, kein Verlauf,
     aber der Ort ihres Kampfes ist Vegamor (blockPass). */
  {kind:"koloss", de:"Vegamor",          en:"Vegamor",
   names:["Vegamor","Vegarus","Vegarion","Vegaorb","Vegamor's Claw","Vagamont"],
   forms:["Vagamont"],
   adds:["Ego-less Great Tree Warrior","Mift"]}
];
/* Die Tabellen nur zum Lesen, fuer das Album der Rekorde (rekorde-core.ts,
   albumTafel): dort steht jeder Boss als Platz, auch ohne Kampf. */
export const DUNGEON_TAFEL: readonly Dungeon[] = DUNGEONS;
export const OFFENE_BOSSE: readonly (typeof OPEN_BOSSES)[number][] = OPEN_BOSSES;
const OPEN_BY_NAME = (() => {
  const m = new Map();
  for(const b of OPEN_BOSSES) for(const n of b.names) m.set(n.toLowerCase(), b);
  return m;
})();
export function openBoss(name: string){
  return OPEN_BY_NAME.get(bareBoss(name).toLowerCase()) || null;
}
/* Ein Nebengegner eines offenen Bosses (`adds`): gehoert zu seinem
   Ereignis, ist aber nicht der Boss. */
const OPEN_ADD = (() => {
  const m = new Map<string, (typeof OPEN_BOSSES)[number]>();
  for(const b of OPEN_BOSSES) for(const n of b.adds || []) m.set(n.toLowerCase(), b);
  return m;
})();
const openAdd = (name: string) => OPEN_ADD.get(bareBoss(name).toLowerCase()) || null;
/* Ein Boss unter einem anderen Namen fuer dasselbe Wesen (`forms`): der
   Kampf traegt seinen ersten Namen. Teile wie Vegarion behalten ihren. */
const openForm = (name: string) => {
  const o = openBoss(name);
  return o && o.forms && o.forms.some((f: string) => f.toLowerCase() === bareBoss(name).toLowerCase()) ? o.names[0]! : null;
};
/* Kennt die App dieses Ziel als Boss? Der Verlauf zeigt nur, was einen Namen
   hat, den man wiedererkennt - Trash ist kein Massstab fuer irgendetwas.

   Ein Kampfname kann zwei Bosse tragen: fightName() verbindet sie mit einem
   Mittelpunkt, wenn beide zum selben Dungeon gehoeren ("Zairos \u00b7 Vulkan").
   Deshalb wird jeder Teil einzeln gefragt - sonst faellt ein echter
   Bosskampf als Unbekannter durch. */
export function knownBoss(name: string){
  return String(name || "").split("\u00b7").some(teil => {
    const n = teil.trim(), bare = bareBoss(n);
    return BOSS_DUNGEON.has(bare) || BOSS_DUNGEON.has(n) || !!openBoss(n) ||
           !!phaseBoss(n);
  });
}
/* Derselbe Boss unter zwei Client-Sprachen ist EIN Boss. Als der Verlauf noch
   jedes Ziel zeigte, war das nicht zu loesen - ein Trashmob hat im Log nur
   einen Namen und keine Kennung. Fuer Bosse liegt die Antwort dagegen schon
   in der App: die Dungeon-Tabelle traegt beide Schreibweisen je Boss, und
   bossGroup() gibt die Liste zurueck. Ihr erster Eintrag taugt als Schluessel.

   Angezeigt wird trotzdem die zuletzt gesehene Schreibweise, nicht der
   Schluessel: dann steht dort der Name, den dein Client gerade schreibt.

 */
export function histKey(name: string){
  return String(name || "").split("·").map(teil => {
    /* Eine Phase steht im Verlauf unter ihrem Boss. Sonst waere ein Pull,
       der auf der Phase endet, ein eigenes Ziel mit eigenem Median. */
    const roh = teil.trim(), n = phaseBoss(roh) || roh, bare = bareBoss(n);
    const g = bossGroup(n) || bossGroup(bare);
    if(g) return g[0];
    const o = openBoss(n);
    if(o) return o.names[0];
    return n;
  }).join(" · ");
}

/* Womit man uebt, nicht womit man kaempft.

   Zwei Tests an derselben Puppe und ein Boss, der zwischen zwei Phasen
   verschwindet, sehen im Log gleich aus - dasselbe Hauptziel, eine Pause
   derselben Form. Das stand hier als Grund, warum es eine Einstellung ist
   und keine Entscheidung. Es stimmt aber nur, solange man das Ziel nicht
   beim Namen nennt: eine Uebungspuppe heisst Uebungspuppe.

   Die drei Namen sind gezaehlt, nicht geraten - ueber die 89 Logs auf
   diesem Rechner: "Practice Dummy" 14300 Zeilen, "Uebungspuppe" 6091,
   "Arkeum Statue for Training" 236. Den deutschen Namen der Statue kennt
   keines dieser Logs; er kommt dazu, sobald eines ihn zeigt.

   Woran ein Uebungsziel haengt: es wird nie zusammengefasst. Jeder Versuch
   steht fuer sich, getrennt nach der Zeit, die im Filter eingestellt ist. */
const PRACTICE_TARGETS = new Set([
  "practice dummy",
  "übungspuppe",
  "arkeum statue for training",
]);
export const practiceTarget = (name: string) => PRACTICE_TARGETS.has(bareBoss(name).toLowerCase());

/* Which spellings are the same boss. `boss` is flat because that is what
   names a block: any of those names means this dungeon. For anything that is
   a property of the ENEMY rather than of the dungeon - the Ventius ceiling,
   above all - the two are not interchangeable: a dungeon with a gatekeeper
   and an end boss would otherwise hand the small one the big one's size and
   tell you that you stood badly when you did not.

   The default is that the whole list is one boss under several spellings,
   which is true for every entry but two; those two say otherwise. */
export function bossGroup(name: string){
  const d = BOSS_DUNGEON.get(name);
  if(!d) return null;
  const groups = d.bosses || [d.boss];
  for(const g of groups) if(g.indexOf(name) >= 0) return g;
  return null;
}

/* Boss -> the other enemies that are part of its fight. Only what has been
   seen in a log and confirmed goes in here: a wrong entry would glue two
   real fights together, which is worse than leaving them apart. */
export const PHASE_TARGETS = (() => {
  const m = new Map<string, Set<string>>();
  for(const d of DUNGEONS){
    if(!d.phases) continue;
    for(const boss in d.phases) m.set(boss, new Set(d.phases[boss]));
  }
  return m;
})();

/* Die Rueckrichtung zur Phasentabelle: welcher Boss steckt hinter dieser
   Phase? PHASE_TARGETS sagt "zu Calanthia gehoert Calanthia of Destruction",
   und das reicht, um die Teile eines Pulls zusammenzuhalten. Fuer alles
   andere - wie der Kampf heisst, ob er als Boss gilt, unter welchem
   Schluessel er im Verlauf steht - muss die Frage andersherum gehen. */
const PHASE_OF = (() => {
  const m = new Map();
  for(const [boss, phasen] of PHASE_TARGETS) for(const p of phasen) m.set(p, boss);
  return m;
})();
export const phaseBoss = (name: string) => PHASE_OF.get(bareBoss(name)) || PHASE_OF.get(name) || null;

/* ---------- Hauptziel und Nebenziele ----------
   Wer "der Boss" eines Kampfes ist, fuer die Zeile "davon 7 % auf Fellini"
   (53-fenster.ts, Issue #45): die Namen aus dem Kampfnamen (bei zwei Bossen
   beide), jeweils mit allen Schreibweisen (bossGroup, openBoss().names, ohne
   Rang und Zustand) und den Formen (forms). Alles andere ist Nebenziel -
   auch eine Phase wie Fellini, die segment() zum Kampf zaehlt. Ohne
   bekannten Boss ist das Hauptziel das Ziel mit dem meisten Schaden. */
const FORMS = (() => {
  const m = new Map<string, string[]>();
  for(const d of DUNGEONS) if(d.forms) for(const boss in d.forms) m.set(boss, d.forms[boss]!);
  return m;
})();
export function hauptzielVon(seg: Fight): (ziel: string) => boolean {
  const st = seg.stats || stats(seg);
  const namen = new Set<string>();
  const dazu = (n: string) => { if(n) namen.add(n.toLowerCase()); };
  if(knownBoss(st.name)){
    for(const teil of String(st.name).split("\u00b7")){
      const n = teil.trim(), bare = bareBoss(n);
      for(const x of [n, bare]){
        dazu(x);
        for(const g of bossGroup(x) || []){ dazu(g); for(const f of FORMS.get(g) || []) dazu(f); }
        for(const f of FORMS.get(x) || []) dazu(f);
        const o = openBoss(x);
        if(o) for(const g of o.names) dazu(g);
      }
    }
  } else dazu(st.targets[0]?.name || st.name);
  return (ziel: string) => namen.has(String(ziel || "").toLowerCase()) || namen.has(bareBoss(ziel).toLowerCase());
}

export const BOSS_DUNGEON = (() => {
  const m = new Map();
  for(const d of DUNGEONS) for(const b of d.boss) m.set(b, d);
  return m;
})();
/* Wie lange dieser Gegner fort sein darf und es doch derselbe Kampf ist, in
   Sekunden: wipeGap seines Dungeons, wo es eines gibt (King Khanzaizin),
   sonst PHASE_GAP. */
export const bossPause = (name: string): number => {
  const d: Dungeon | undefined = BOSS_DUNGEON.get(name) || BOSS_DUNGEON.get(bareBoss(name));
  return d && d.wipeGap != null ? d.wipeGap : PHASE_GAP;
};
/* The whole block is offered, not only its biggest enemy: a run can end on a
   boss that took less damage than the trash before it, and on the log that
   started this the first block opened in the middle of a boss pull. The boss
   names the block wherever it appears in it.

   A raid runs its parts back to back, so one block can hold two of them -
   measured on a twelve-player Altar log, a single block held Zairos, Calanthia
   and Vulkan, which is two parts. Naming it after whichever boss took the most
   damage would have been picking one and saying nothing about the other, so a
   block that spans parts is named after the raid and lists what is in it. */
export function dungeonOf(block: FightBlock | string){
  if(typeof block === "string") return BOSS_DUNGEON.get(block) || null;
  const seen = [];
  for(const name of block.targets || []){
    const d = BOSS_DUNGEON.get(name);
    if(d && seen.indexOf(d) < 0) seen.push(d);
  }
  if(!seen.length) return null;
  const of = seen[0].of;
  if(seen.length > 1 && of && seen.every(d => d.of === of))
    return {en: of.en, de: of.de, parts: seen};
  return seen[0];
}
export const dungeonName = (d: LocalizedName | null) => d ? (d[state.lang] || d.en) : null;
/* Chronological order, so this runs before the newest-first sort. */
/* `segs` are the fights the list shows, `all` every fight there was. The
   blocks are cut out of ALL of them, because a block is a stretch of the
   evening and the evening does not skip what the minimum length hides.

   Those fights happened, they did damage, and the clock ran through them.
   Cut out of the blocks they took their damage with them and - worse - the
   heading measured the pause straight across them. Measured on the Altar
   raid log: a 1,3-second stretch on a Seuchenzombie, 22 rows and 51.794
   damage, stood in no block and no sum, and the heading above it read "cut
   here after 1m 48s of quiet" about a pause in which 22 hits landed. It was
   quiet for 1m 32s.

   The list still does not show them - that is what the setting is for - and
   the heading says how many are missing from it. A block that holds nothing
   but hidden fights draws no heading at all, because the heading is emitted
   above the first listed fight of its block and there is none. */
/* segs: the fights the list shows, with their stats; all: every stretch,
   including the ones too short to be a fight, which have none */
export function blockPass(segs: Fight[], all: Encounter[]){
  const cut = BLOCK_GAP * 1000, reach = cut * 2;
  let cur: FightBlock | null = null;
  const shown = new Set<Encounter>(segs);
  const list: Encounter[] = (all && all.length ? all : segs);
  state.blocks = [];

  /* Where each fight happened, as far as the table can say.

     A fight on a boss is at that boss's place. A fight on anything else is
     at the place of the NEXT boss fought, because trash belongs to what it
     leads to - a player, twice, about the same raid: "der erste boss beim
     ersten Raid Block ist Dragaryle", and "Hoher Drakhoul Zauberer ist Trash
     mob beim letzten Raidblock. Dort ist Calanthia Der Finale Boss."

     Only forwards, and only across a bounded quiet: trash an hour before a
     boss has nothing to do with that boss. Twice the block cut is the bound,
     measured - over all 87 logs the two raid approaches sit at 67,9 s and
     76,3 s and everything else that could be mistaken for one at 239,6 s or
     more, with nothing in between. */
  const own = list.map(s => {
    const t = mainTarget(s);
    return BOSS_DUNGEON.get(t) || openBoss(t) || null;
  });
  /* Der Ort: der eigene Boss, sonst der Boss, zu dessen Ereignis der
     Gegner gehoert (`adds`), sonst der naechste Boss (unten). Ein
     Nebengegner zaehlt nur, wenn ein Teil seines Kolosses hoechstens
     KOLOSS_GAP davor oder danach gekaempft wurde (Pruefung 01.10., N1):
     derselbe Gegner ohne Ereignis ist gewoehnlicher Trash und darf keinen
     fremden Lauf zerschneiden. */
  const nahe = KOLOSS_GAP * 1000;
  const neben = (i: number) => {
    const o = openAdd(mainTarget(list[i]!));
    if(!o) return null;
    for(let j = i - 1; j >= 0 && list[i]!.start - list[j]!.end <= nahe; j--) if(own[j] === o) return o;
    for(let j = i + 1; j < list.length && list[j]!.start - list[i]!.end <= nahe; j++) if(own[j] === o) return o;
    return null;
  };
  const place = list.map((_s, i) => own[i] || neben(i) || null);
  for(let i = list.length - 2; i >= 0; i--)
    if(!place[i] && place[i+1] && list[i+1]!.start - list[i]!.end <= reach)
      place[i] = place[i+1];

  for(let i = 0; i < list.length; i++){
    const s = list[i]!;
    let start = !cur;
    if(cur){
      const quiet = s.start - cur.end;
      if(place[i-1] && place[i] && place[i-1] !== place[i]){
        /* The place changed, so the last one is over however little quiet
           there was. On the raid log 45 s of quiet separate Zairos from the
           Drakhoul trash that leads to Calanthia - the clock would have kept
           them together and called six fights of the last part the Corridor
           of Anguish. */
        start = true;
      } else if(quiet > cut){
        /* Long enough to be a new stretch - unless everything so far was on
           the way to where this fight is, and it is not far. A raid runs its
           parts back to back with less quiet between them than a dungeon has
           inside it, so the clock alone cuts the approach off from its boss.
           Only a block with no boss of its own can be an approach; two kills
           of the same field boss both bring one, and stay apart. */
        const approach = !cur.hasBoss && place[i] && place[i-1] === place[i] &&
                         quiet <= reach;
        /* Ein Koloss ist EIN Ereignis aus mehreren Teilen, mit Pausen
           dazwischen, in denen seine Nebengegner kommen: im Log vom 29.09.
           Vegamor von 22:07 bis 22:20. Der Takt allein schnitt es in fuenf
           Bloecke. Die Pausen dort: 61, 62, 76 und 99 s, und 139 s zwischen
           einem Krieger (bis 22:10:04) und Vegarion (22:12:23), die nur drei
           Zeilen ohne Ziel um 22:11:40 ueberbrueckten. Zwischen zwei
           Kaempfen am selben Koloss traegt der Block darum bis zur dreifachen
           Grenze (KOLOSS_GAP). Nur kind "koloss" - Feldbosse wie Manticus
           bleiben, wie sie sind: zwei Kills stehen getrennt. */
        const koloss = !!place[i] && place[i-1] === place[i] && place[i].kind === "koloss" &&
                       quiet <= KOLOSS_GAP * 1000;
        start = !approach && !koloss;
      }
    }
    // start is true whenever there is no block yet; said twice so the type
    // checker sees it too
    if(start || !cur){
      // the rest of a FightBlock is filled in by the loop after this one
      cur = {segs: [], hiddenSegs: [], start: s.start, end: s.end,
             quiet: cur ? s.start - cur.end : 0, hasBoss: false} as Partial<FightBlock> as FightBlock;
      state.blocks.push(cur);
    }
    if(shown.has(s)) cur.segs.push(s as Fight);   // one of segs
    else cur.hiddenSegs.push(s);
    cur.end = s.end;
    if(own[i]) cur.hasBoss = true;
    s.block = cur;
  }
  for(const b of state.blocks){
    b.hidden = b.hiddenSegs.length;
    const by = new Map<string, number>();
    for(const s of [...b.segs, ...b.hiddenSegs])
      for(const e of s.events) by.set(e.target, (by.get(e.target) || 0) + e.dmg);
    // every enemy in the block, most damage first: the first one the dungeon
    // table knows names the block, and if it knows none, the biggest does
    b.targets = [...by.entries()].sort((x,y) => y[1] - x[1]).map(x => x[0]);
    b.top = b.targets[0] || "";
    b.dungeon = dungeonOf(b);
    /* An open-world boss names its block the way a dungeon does, and in the
       reader's language: a German client writes "Königsbagger-9" where an
       English one writes "Excavator-9", and the Manticus encounter is written
       as whichever of its two halves took more damage. */
    b.open = null;
    for(const name of b.targets){ const o = openBoss(name); if(o){ b.open = o; break; } }
    // the hidden ones have no stats object - they never went through stats() -
    // so their damage is counted off their own events
    b.total = b.segs.reduce((n,s) => n + s.stats.total, 0) +
      (b.hiddenSegs || []).reduce((n,s) => n + s.events.reduce((a,e) => a + e.dmg, 0), 0);
    b.seconds = b.segs.reduce((n,s) => n + s.stats.seconds, 0) +
      (b.hiddenSegs || []).reduce((n,s) => n + (s.end - s.start)/1000, 0);
    b.fights = b.segs.length;
    /* How long the run took, which is not the same number as how long it was
       fought: measured on a Stone Grave Cradle run, 6:28 from the first hit to
       the boss's last, of which 3:54 was spent in combat and 2:33 walking
       between packs. Both are worth having and they answer different
       questions, so both are said rather than one standing in for the other.

       It ends at the last hit of the block, which is the kill when the boss
       died - the log records no death, so the last hit is as close as this
       can get, and it is exactly right whenever the run was finished. A run
       that was abandoned reads as ending at whatever was hit last, which is
       the honest answer to "how long were you in there". */
    b.span = b.end - b.start;
    /* No count of attempts on the boss here, and the reason is worth keeping.
       A boss fought in two stretches with a pause between them can be two
       pulls with a wipe in the middle, or one pull with a phase in it, and
       the log holds nothing that tells them apart - no death, no health, no
       encounter end. Measured: a Stone Grave Cradle run split into 68 s and
       58 s with 25 s between them, and the player says Fellinex goes into an
       intermediate phase at 80% and that nobody wiped. A counter labelled
       "attempts" would have called that two tries.

       The fight row already says "2 parts", which is the honest wording for
       what was seen, so nothing is lost by not repeating it here under a
       name that claims more. */
  }
  /* A log that is one block has nothing to group, and a heading that groups
     one thing is noise - so a single pull or a dummy session still gets
     none.

     Unless the block is a place the table knows. Measured on a Stone Grave
     Cradle run, four fights in one block: the words "Steingrab-Wiege", the
     four stars the game gives it, the 6:28 the run took and the 60.45M it
     cost appeared NOWHERE on the screen - not in a heading, not in a
     tooltip, nowhere but in the source of the page. The heading is the only
     place the app ever says which dungeon you were in, so on a log that is
     one dungeon it has to be there. */
  /* Counted over the blocks that have something in the list: a block of
     nothing but hidden fights draws no heading, so it cannot make a log
     "more than one block" for the reader. */
  const listed = state.blocks.filter(b => b.segs.length).length;
  state.blocks.forEach((b,i) => {
    b.index = i;
    b.only = listed < 2 && !b.dungeon && !b.open;
  });
}

/* The enemy a stretch was mostly about. Used by the merge in segment() and
   by the blocks, so it lives where both can see it. */
export const mainTarget = (seg: Encounter) => {
  const by = new Map();
  for(const e of seg.events) by.set(e.target, (by.get(e.target)||0) + e.dmg);
  let best = "", top = -1;
  for(const [t, d] of by) if(d > top){ top = d; best = t; }
  return best;
};

/* Who the fight was against. Normally the enemy that took the most damage,
   which is the only answer a log can give - but a fight can have two bosses
   in it at once. A player about the Corridor of Anguish: "Zairos und Vulkan
   sind zwei Bosse gleichzeitig."

   Measured on his raid log: Zairos took 8,95M and Vulkan 0,48M in the same
   stretch, and the row said "Zairos 9.43M". Vulkan's name appeared nowhere -
   not in the rail, not in the hero line, not in a saved run, not in what the
   party board was told. The damage was never lost, it just had the wrong
   name over it.

   Only bosses, and only bosses of the same dungeon entry. An add the table
   does not know stays out, or every trash pack standing next to a boss would
   push its way into the name. Two spellings of one boss are one boss, which
   is what bossGroup is for. Sorted by damage, so the one that took more
   comes first.

   Over all 87 logs on this machine exactly two fights are named by two
   bosses, both of them Zairos and Vulkan. */
function fightName(list: TargetStats[]){
  if(!list.length) return "Unnamed fight";
  /* Vorn steht das Ziel mit dem meisten Schaden - und das kann die Phase
     sein statt der Boss. An einem Calanthia-Pull gemessen: 18,06M auf
     "Calanthia of Destruction" gegen 6,87M auf Calanthia, und der ganze
     Kampf hiess danach. Eine Phase traegt den Namen ihres Bosses. */
  const lead = phaseBoss(list[0]!.name) || openForm(list[0]!.name) || list[0]!.name;
  const home = BOSS_DUNGEON.get(lead);
  const leadGroup = bossGroup(lead);
  if(!home || !leadGroup) return lead;
  const seen = new Set([leadGroup[0]]);
  const names = [lead];
  for(const t of list.slice(1)){
    if(BOSS_DUNGEON.get(t.name) !== home) continue;
    const g = bossGroup(t.name);
    if(!g || seen.has(g[0])) continue;
    seen.add(g[0]); names.push(t.name);
  }
  return names.join(" \u00b7 ");
}

/* What a per-second figure divides by. Written once because six places
   need it and they have to agree - a weapon's rate worked out over a
   different length than the fight's own added up to less than the fight. */
export const rateSecs = (seg: Fight) => Math.max(
  (seg.stats && seg.stats.fought != null ? seg.stats.fought
                                         : (seg.end - seg.start)/1000), 1);

export function stats(seg: Encounter){
  const ev = seg.events;
  const seconds = (seg.end - seg.start)/1000;
  /* Two lengths, because a fight merged out of parts has two. `seconds` is
     how long it lasted, first hit to last, and that is what the row prints.
     `fought` leaves out the holes between the parts - by the app's own
     definition of one fight, a pause wider than the cut is not fighting -
     and that is what every per-second figure divides by.

     They are the same number on every fight that was never merged and on
     every boss, where the pause between two parts is the boss's phase and
     counts. What is left is the trash and the dummies: eleven fights in the
     87 logs on this machine, every one of them reading too low, up to a
     practice dummy hit for five seconds, left alone for a minute and hit
     again - 1.885/s printed where 21,7k/s was landed. Two pulls are not one
     long fight, and the walk between them is not a rate. */
  const fought = (seg.fought == null ? seg.end - seg.start : seg.fought)/1000;
  /* The span a rate is worked out over is floored at a second; the span
     that gets printed is not. A segment holding one 7.000 hit divided by
     0,001 s used to read "7.00M" in the hero number, in the rail and in
     any run saved from it, with "0.0s" beside it. A stretch shorter than
     a second cannot carry a per-second figure. */
  const rate = Math.max(fought, 1);
  let total=0, crit=0, critDmg=0, heavy=0, max=0, shieldDmg=0, shieldHits=0;
  const skills = new Map<string, SkillStats & { shieldDmg: number; shieldHits: number }>(),
        targets = new Map<string, TargetStats>();
  for(const e of ev){
    total += e.dmg;
    if(e.crit){ crit++; critDmg += e.dmg; }
    if(e.heavy) heavy++;
    if(e.shield){ shieldHits++; shieldDmg += e.dmg; }
    if(e.dmg > max) max = e.dmg;
    let s = skills.get(e.skill);
    if(!s){ s = {name:e.skill, damage:0, hits:0, crit:0, heavy:0, max:0, shieldDmg:0, shieldHits:0};
            skills.set(e.skill, s); }
    s.damage += e.dmg; s.hits++; if(e.crit) s.crit++; if(e.heavy) s.heavy++;
    if(e.dmg > s.max) s.max = e.dmg;
    let t = targets.get(e.target);
    if(!t){ t = {name:e.target, damage:0, hits:0, crit:0, max:0, shieldDmg:0, shieldHits:0};
            targets.set(e.target, t); }
    t.damage += e.dmg; t.hits++; if(e.crit) t.crit++; if(e.dmg > t.max) t.max = e.dmg;
    /* Per skill and per target as well as per fight, because the finding has
       to name which skill put the most in and which enemy had the shield.
       Accumulated in this loop rather than in a second pass - it already
       visits every event. These two stay plain numbers while the
       fight-level pair goes null without a hit-type column: nothing reads
       them in that state, every surface is gated on the nullable one. */
    if(e.shield){
      s.shieldDmg += e.dmg; s.shieldHits++;
      t.shieldDmg += e.dmg; t.shieldHits++;
    }
  }
  const skillList = [...skills.values()].sort((a,b)=>b.damage-a.damage);
  // ob dieser Rang noch eine eigene Farbe hat oder das Neutral traegt - die
  // Tabelle braucht das, um den Tick zu schraffieren, und sie kann es nicht
  // an der Farbe ablesen: die haengt am Thema
  skillList.forEach((s,i) => {
    s.color = seriesColor(i); s.rest = i >= SERIES_N; s.dps = s.damage/rate;
  });
  const ranked = skillList as RankedSkill[];   // what the loop above just made them
  const targetList = [...targets.values()].sort((a,b)=>b.damage-a.damage);

  // longest stretch with nothing landing
  let dead = 0, worst = 0;
  /* Mit Strecken, in denen das Ziel unverwundbar war, rechnet gapsOf:
     sie sind keine Leerzeit (Issue #37). Ohne bleibt die alte Schleife. */
  if(seg.unverwundbar && seg.unverwundbar.length){
    for(const g of gapsOf(seg)){ dead += g.len; if(g.len > worst) worst = g.len; }
  } else for(let i=1;i<ev.length;i++){
    const d = (ev[i]!.t - ev[i-1]!.t)/1000;
    if(d > DEAD_TIME){ dead += d; if(d > worst) worst = d; }
  }
  return {
    seconds, fought, total, hits:ev.length, dps: total/rate,
    crit, critRate: ev.length ? crit/ev.length : 0, critDmgShare: total ? critDmg/total : 0,
    heavy, heavyRate: ev.length ? heavy/ev.length : 0,
    avg: ev.length ? total/ev.length : 0, max,
    // null when the log has no hit-type column at all: unmeasured, not zero
    shieldDmg: state.noHitType ? null : shieldDmg,
    shieldHits: state.noHitType ? null : shieldHits,
    skills:ranked, targets:targetList,
    dead, worstGap:worst,
    name: fightName(targetList)
  };
}

/* Parse only the appended tail of a log that is already parsed, reusing the
   delimiter and column width the full parse already settled on. Returns the
   new rows, or null if the tail doesn't fit that shape — in which case the
   caller does a full reparse rather than guessing. */
export function parseGridTail(tail: string, grid: ParsedGrid | null){
  if(!grid || !grid.rows || !grid.rows.length) return null;
  const width = grid.rows[0]!.length;
  const delim = grid.delim;
  if(!delim || !width) return null;
  /* Dieselbe Auswahl wie parseGrid: eine Zeile "CombatLogVersion,x" ohne
     Zahl ist dort eine Zeile des Logs, also hier auch. */
  const lines = tail.split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !/^(#|\/\/)/.test(l) && !/^CombatLogVersion\s*[,;\t]\s*(\d+)/i.test(l));
  const widths: Record<string, number> = {};
  if(!lines.length) return {rows: [], seen: 0, kept: 0, merged: 0, widths};
  /* Everything read live comes through here, so this has to count as well as
     parse. Without it a report said "0 rows dropped" about a file whose every
     awkward line had arrived after the first read - measured on a real log,
     the first over-wide row sits 43% in, so live logging would have merged
     3535 rows and reported none of them. */
  const whole = /\n$/.test(tail);
  const rows = [];
  let seen = 0, kept = 0, merged = 0;
  for(let i = 0; i < lines.length; i++){
    // a partial final line (the game mid-write) simply isn't included yet;
    // it arrives complete on the next poll, and counting it here would count
    // it twice - so it is neither seen nor dropped
    const partial = !whole && i === lines.length - 1;
    let r = splitLine(lines[i]!, delim);
    // die Breite vor dem Zusammenfuegen, wie parseGrid sie zaehlt
    if(!partial) widths[r.length] = (widths[r.length]||0)+1;
    let fixed = null;
    // too wide is a name with the delimiter in it, put back the same way the
    // full parse does - without this a boss called "Quente, Executor of the
    // Seal" is missing from the live view for the whole fight
    if(r.length > width && grid.prof)
      fixed = rejoinRow(splitLine(lines[i]!, delim, true), width, delim, grid.prof);
    if(fixed) r = fixed;
    if(r.length === width) rows.push(r);
    if(partial) continue;
    seen++;
    if(fixed) merged++;
    if(r.length === width) kept++;
  }
  return {rows, seen, kept, merged, widths};
}
