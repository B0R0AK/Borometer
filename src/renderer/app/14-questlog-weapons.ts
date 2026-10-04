import { state } from "./01-state";
import { t } from "./08-translation";
import { NAME_TO_ENTRY, NAME_TO_WEAPON, skillEntry } from "./10-skill-names";
import { SKILL_WAFFE_Q } from "./13-skill-weapons";

/* ---------- die Tabelle von questlog.gg ----------
   272 Zuordnungen Name -> Waffe, erzeugt aus den tRPC-Feeds von
   questlog.gg (getSkillSets + getSkillTraits + getWeaponSpecializations),
   Stand 14.09.2026. Sie ist nach ENGLISCHEM Namen geschluesselt.

   Sie steht BEWUSST hinter NAME_TO_WEAPON und fuellt nur Luecken. Drei
   Regeln beim Uebernehmen, alle gegengeprueft:

     1. Nur wo die App nichts hat. 131 Namen kannte sie schon, die bleiben.
     2. Kein "other". Das heisst dort "keine Waffe", und dafuer hat die App
        Passive und Unassigned - 84 Eintraege sind so weggefallen.
     3. Gauntlet bleibt unangetastet. Die Tabelle kennt neun Waffen, das
        Spiel hat zehn: alle sechs Gauntlet-Skills, die in ihr vorkommen,
        stehen dort als "other". Die App kennt 32 richtig. Waere die
        Tabelle einfach darueber geschrieben worden, waeren die alle
        kaputt. Nachgezaehlt: von den 272 uebernommenen Namen ist keiner
        einer davon.

   Dazu sind 397 Spezialisierungen weggefallen ("X - Cooldown ▼") und
   198 eigenstaendige Baumknoten ("Attack Speed Expertise", "Greater Hit
   Augment"). Beide machen nie Schaden und stehen nie in einer
   Schadenszeile; ein Knotenname koennte nur einen gleichnamigen echten
   Skill beschatten. Erkannt werden sie ueber ihre Wortmuster - faellt
   das falsch aus, lernt die App eine Waffe NICHT, und das ist derselbe
   Zustand wie vorher. */
const NAME_WEAPON_EXTRA: Record<string, string> = {
  "Abyssal Burst":"Wand and Tome",
  "Ausbruch des Abgrunds":"Wand and Tome",
  "Blitzspitzhacke":"Staff",
  "Charging Draw":"Greatsword",
  "Lightning Pick":"Staff",
  "Scorching Sphere":"Staff",
  "St\u00fcrmendes Ziehen":"Greatsword",
  "Verbrennungskugel":"Staff",
  /* Die englische Schreibweise steht weiter unten. Ohne diese
     Zeile bekaeme die deutsche keine Waffe: Giftdolch steht
     nicht im Woerterbuch, also fuehrt kein Weg von "Giftdolch"
     zu "Poison Dagger". */
  "Giftdolch":"Dagger",
  "Enraged Tevent's Despair Trap":"Greatsword",
  "Heiliger magischer Kreis":"Wand and Tome",
  "Sacred Magic Circle":"Wand and Tome",
  "Verzweiflungsfalle des Tevent (Erzürnt)":"Greatsword",
  /* Gemeldet am 20.09.2026: ein Skillkern fuer den
     Zauberstab. Die App hatte zu dieser ID gar keine Waffe. */
  "Enraged Tevent's Hunger":"Wand and Tome",
  /* Gemeldet am 20.09.2026: Panzerhandschuh, dasselbe Symbol wie
     Unshakable Stance. Keine der drei Tabellen kannte eine Waffe
     dafuer. */
  "Iron Mountain Blow":"Gauntlet",
  "Aegis Shield":"Sword and Shield",
  "Agile Strike":"Crossbow",
  "Ambidexterity":"Crossbow",
  "Amplification Veil":"Orb",
  "Annihilator":"Crossbow",
  "Archenemy":"Crossbow",
  "Archer's Surge":"Longbow",
  "Arctic Thunder":"Staff",
  "Asceticism":"Staff",
  "Assassin's Instincts":"Dagger",
  "Assassin's Step":"Dagger",
  "Assassination Stance":"Dagger",
  "Astral Overseer":"Orb",
  "Barbarian's Dash":"Greatsword",
  "Barrier":"Orb",
  "Basic Shot":"Crossbow",
  "Battle Spirit":"Wand and Tome",
  "Battle Tempo":"Longbow",
  "Begin the Hunt":"Longbow",
  "Binding Warrior":"Greatsword",
  "Blade Harvest":"Greatsword",
  "Blade Momentum":"Sword and Shield",
  "Blessed Barrier":"Wand and Tome",
  "Blessed Haste":"Wand and Tome",
  "Blessing of Immortality":"Sword and Shield",
  "Blessing of Wisdom":"Longbow",
  "Blitz":"Longbow",
  "Block Blade":"Dagger",
  "Blood Devotion":"Greatsword",
  "Blood Seeker":"Dagger",
  "Bloodlust":"Crossbow",
  "Bloodlust Acceleration":"Crossbow",
  "Breath of Infinity":"Orb",
  "Bullseye Hunter":"Longbow",
  "Bulwark Stance":"Sword and Shield",
  "Burning Ripple":"Staff",
  "Calculated Power":"Crossbow",
  "Camouflage Cloak":"Dagger",
  "Celestial Boost":"Wand and Tome",
  "Celestial Guard":"Orb",
  "Clay's Salvation":"Wand and Tome",
  "Cold Warrior":"Greatsword",
  "Combat Sanctuary":"Longbow",
  "Combat Velocity":"Dagger",
  "Constellation Link":"Orb",
  "Constricting Tempest":"Spear",
  "Coordinated Fracture":"Orb",
  "Corrupt Nail":"Crossbow",
  "Cosmic Cycle":"Orb",
  "Counter Barrier":"Sword and Shield",
  "Cradle of Stars":"Orb",
  "Critical Equilibrium":"Greatsword",
  "Curse Resonance":"Wand and Tome",
  "DaVinci's Chill":"Greatsword",
  "DaVinci's Courage":"Greatsword",
  "Dark Apostasy":"Wand and Tome",
  "Dark Erosion":"Orb",
  "Dauntless Recovery":"Greatsword",
  "Deadly Marker":"Longbow",
  "Death Knell":"Spear",
  "Deathstrike Pact":"Crossbow",
  "Destructive Fang":"Dagger",
  "Detect Vulnerability":"Dagger",
  "Detection":"Crossbow",
  "Devoted Sanctuary":"Greatsword",
  "Devoted Shield":"Longbow",
  "Devotion and Emptiness":"Wand and Tome",
  "Dexterous Power":"Dagger",
  "Dimensional Seal":"Orb",
  "Distorted Sanctuary":"Longbow",
  "Distortion Veil":"Orb",
  "Distortion Veil Time Increase":"Orb",
  "Divine Choice":"Wand and Tome",
  "Eagle Vision":"Crossbow",
  "Earth's Blessing":"Longbow",
  "Echoes of Distortion":"Orb",
  "Echoic Barrier":"Staff",
  "Elemental Awakening":"Staff",
  "Enchanting Time":"Wand and Tome",
  "Endless Volley":"Crossbow",
  "Enduring Dash":"Spear",
  "Enforcer":"Spear",
  "Enhance Skill Damage":"Orb",
  "Eternal Body":"Orb",
  "Eternal Veil":"Orb",
  "Ethereal Evasion":"Dagger",
  "Explosive Force":"Spear",
  "Extended Reach":"Greatsword",
  "Eye of Emptiness":"Wand and Tome",
  "Far Sight":"Longbow",
  "Far Strike":"Greatsword",
  "Fatal Fatigue":"Dagger",
  "Fatal Precision":"Spear",
  "Final Heartbeat":"Crossbow",
  "Fire Wave Amplifier":"Staff",
  "Flame Condensation":"Staff",
  "Flame Discipline":"Staff",
  "Fleeting Shadow":"Dagger",
  "Flow Shift":"Orb",
  "Fluid Block":"Dagger",
  "Focus on Skill Healing over Time":"Longbow",
  "Forbidden Sanctuary":"Staff",
  "Force Capacity":"Greatsword",
  "Fortified Unity":"Greatsword",
  "Fountain of Life":"Wand and Tome",
  "Frost Smokescreen":"Staff",
  "Full of Corruption":"Wand and Tome",
  "Galactic Acceleration":"Orb",
  "Gerad's Patience":"Sword and Shield",
  "Gerad's Precision":"Sword and Shield",
  "Gerad's Resilience":"Sword and Shield",
  "Gerad's Shield":"Sword and Shield",
  "Guardian Defensive Wall":"Orb",
  "Healing Star":"Orb",
  "Healing Touch":"Longbow",
  "Healing Wave":"Orb",
  "Heat Fusion":"Staff",
  "High Focus":"Staff",
  "Icebound Armor":"Staff",
  "Immortal Pride":"Sword and Shield",
  "Impenetrable":"Sword and Shield",
  "Imposing Form":"Spear",
  "Increase Attack Range":"Orb",
  "Increase Melee Evasion":"Orb",
  "Increase Movement Speed":"Orb",
  "Increase Shield Health":"Orb",
  "Indomitable Armor":"Greatsword",
  "Infernal Aftermath":"Staff",
  "Inner Peace":"Staff",
  "Invincible Wall":"Wand and Tome",
  "Janice's Rage":"Wand and Tome",
  "Jumping Chain":"Staff",
  "Karmic Haze":"Wand and Tome",
  "Keen Reflexes":"Longbow",
  "Lethal Stacks":"Longbow",
  "Life Ward":"Longbow",
  "Life's Bargain":"Sword and Shield",
  "Light of Annihilation":"Orb",
  "Light of Devotion":"Wand and Tome",
  "Limit Break":"Longbow",
  "Malice Surge":"Spear",
  "Malicious Focus":"Wand and Tome",
  "Malicious Intent":"Wand and Tome",
  "Mana Amp":"Staff",
  "Mana Break Point":"Crossbow",
  "Mana Exchange":"Crossbow",
  "Mana Overflow":"Staff",
  "Mana Shield":"Staff",
  "Mana Shockwave":"Staff",
  "Mana Spring":"Staff",
  "Manaball Salvo":"Staff",
  "Mayhem Burst":"Crossbow",
  "Merciless Form":"Dagger",
  "Mirage Dancer":"Crossbow",
  "Morale Boost":"Sword and Shield",
  "Mortal Wrath":"Spear",
  "Murderous Energy":"Dagger",
  "Mystic Shield":"Staff",
  "Nature's Blessing":"Longbow",
  "Nature's Gamble":"Crossbow",
  "Nature's Power":"Crossbow",
  "Nightmare":"Wand and Tome",
  "Nimble Leap":"Crossbow",
  "Nimble Steps":"Spear",
  "Noble Revival":"Wand and Tome",
  "Off-hand Frenzy":"Dagger",
  "Orb Max Damage Increase":"Orb",
  "Overtaker":"Longbow",
  "Patient Block":"Spear",
  "Perfect Tempo":"Spear",
  "Phantom Smokescreen":"Dagger",
  "Phantom Timer":"Dagger",
  "Piercing Bite":"Dagger",
  "Piercing Strike":"Crossbow",
  "Poison Dagger":"Dagger",
  "Potent Toxicity":"Dagger",
  "Power Breach":"Sword and Shield",
  "Power Grip":"Greatsword",
  "Power Surge":"Staff",
  "Precise Brutality":"Spear",
  "Precise Control":"Spear",
  "Predator's Focus":"Crossbow",
  "Primal Strike":"Dagger",
  "Provoking Roar":"Sword and Shield",
  "Pulsating Galaxy":"Orb",
  "Pulse of the Battlegrounds":"Spear",
  "Punishing Grip":"Longbow",
  "Purifying Touch":"Longbow",
  "Raging Frenzy":"Greatsword",
  "Range Reducer":"Longbow",
  "Rapidfire Stance":"Longbow",
  "Reaper's Call":"Crossbow",
  "Reckless Assault":"Greatsword",
  "Recovery Bolts":"Crossbow",
  "Relentless All Species Damage":"Orb",
  "Relentless Mana Regen":"Orb",
  "Relentless Stamina Regen":"Orb",
  "Replenishment":"Sword and Shield",
  "Repulsive Force":"Spear",
  "Resilient Mind":"Sword and Shield",
  "Resonant Barrier":"Staff",
  "Resonant Heavy Attack":"Orb",
  "Restoring Constellation":"Orb",
  "Retaliatory Strike":"Spear",
  "Rhythmical Shooting":"Longbow",
  "Righteous Fury":"Sword and Shield",
  "Roar Amplifier":"Sword and Shield",
  "Robust Constitution":"Greatsword",
  "Roxie's Arrow Storm":"Longbow",
  "Rupturing Parry":"Crossbow",
  "Ruthlessness":"Spear",
  "Saint's Oath":"Wand and Tome",
  "Salvation Chain":"Staff",
  "Seer":"Orb",
  "Selfless Diffusion":"Crossbow",
  "Selfless Soul":"Wand and Tome",
  "Sentinel's Bastion":"Spear",
  "Shadow Oath":"Wand and Tome",
  "Shadow Walker":"Dagger",
  "Shield Survival Technique":"Sword and Shield",
  "Shredding Strike":"Sword and Shield",
  "Skillful Evasion":"Sword and Shield",
  "Sniper's Sense":"Longbow",
  "Sniper's Trap":"Longbow",
  "Space Transition":"Orb",
  "Spatial Rush":"Orb",
  "Spirit of Perseverance":"Staff",
  "Stacking Echo":"Orb",
  "Stalwart Bastion":"Sword and Shield",
  "Stamina Renewal":"Sword and Shield",
  "Steadfast Rush":"Greatsword",
  "Steady Aim":"Longbow",
  "Steel Sacrifice":"Greatsword",
  "Stellar Cycle":"Orb",
  "Stellar Flare":"Orb",
  "Strategic Compromise":"Staff",
  "Strategic Exchange":"Dagger",
  "Strategic Retreat":"Sword and Shield",
  "Summon Guardian Satellite":"Orb",
  "Suppressing Strike":"Greatsword",
  "Supreme Burst":"Spear",
  "Survival Mend":"Longbow",
  "Sustaining Guard":"Spear",
  "Swift Execution":"Greatsword",
  "Swift Healing":"Wand and Tome",
  "Swift Reaper":"Spear",
  "Tactical Breaker":"Sword and Shield",
  "Tactical Deflection":"Crossbow",
  "Temporal Leap":"Orb",
  "Tenacious Spirit":"Spear",
  "Time Dilation":"Orb",
  "Time for Punishment":"Wand and Tome",
  "Tranquil Will":"Orb",
  "Ultimate Impact":"Spear",
  "Umbral Toughness":"Dagger",
  "Universal Protection":"Spear",
  "Unlimited Arsenal":"Spear",
  "Unshakeable Will":"Sword and Shield",
  "Unstoppable Rush":"Greatsword",
  "Unyielding Aegis":"Sword and Shield",
  "Unyielding Sentinel":"Spear",
  "Vampiric Onslaught":"Wand and Tome",
  "Victor's Morale":"Greatsword",
  "Victory Shield":"Spear",
  "Vital Conversion":"Greatsword",
  "Vital Force":"Greatsword",
  "Vitality Conversion":"Staff",
  "Warrior's Gambit":"Wand and Tome",
  "Wind Rush":"Longbow",
  "Wisdom's Path":"Sword and Shield",
  "Wraith's Beckon":"Wand and Tome",
  "Wrathful Edge":"Dagger",
};
export function weaponByName(name: string){
  const gemessen = NAME_TO_WEAPON[name];
  if(gemessen) return gemessen;
  /* null heisst etwas anderes als undefined: die App hat denselben Namen
     auf ZWEI Waffen gesehen und sagt deshalb bewusst nichts. Basic Shot
     liegt auf Langbogen und Armbrust, Manaball auf Stab und Zauberstab.
     Die Tabelle von questlog.gg kann nur eine Waffe nennen - dort waere
     sie halb falsch, und halb falsch ist schlechter als offen. Wo die
     Skill-ID bekannt ist, trennt SKILL_WEAPON[sid] ohnehin je Ereignis
     sauber; wo sie es nicht ist, bleibt es bei Unassigned. */
  if(gemessen === null) return null;
  /* Die Tabelle kennt nur englische Namen. Ein deutsches Log schreibt
     deutsche - NAME_TO_ENTRY kennt beide Seiten und liefert den
     englischen dazu. Die Mehrdeutigkeit kann auch am englischen Namen
     haengen, also wird sie dort noch einmal gefragt. */
  const e = NAME_TO_ENTRY[name];
  const en = (e && e.en) || name;
  if(NAME_TO_WEAPON[en] === null) return null;
  /* Erst der Feed - er kennt Gauntlet und beide Sprachen -, dann der
     Export, der mehr Namen hat, aber kein Gauntlet. */
  return SKILL_WAFFE_Q[name] || SKILL_WAFFE_Q[en] ||
         NAME_WEAPON_EXTRA[en] || null;
}
/* buildEvents writes this when no column is mapped to Skill. Every site
   that names a skill goes through here - the bar table and its sub-rows,
   the Rotation lanes, the Zeitverlauf legend, the Analyse facts, "Angefuehrt
   von", the Waffen rows - so one guard covers all of them. Without it the
   id lookup dressed the single unnamed row in a real skill's name. */
export const NO_SKILL = "\u2014";
export function skillLabel(name: string, sid?: string | null){
  if(name === NO_SKILL) return name;
  const e = skillEntry(name, sid);
  return e ? (e[state.lang] || e.en || name) : name;
}
export function roleLabel(r: string){ return t("role."+r); }
export function hitCatLabel(k: string){ return t("hitcat."+k); }
export function seriesLabel(n: string, sid?: string){ return n === "__other__" ? t("timeline.everythingElse") : skillLabel(n, sid); }
export function headerLabel(h: string){ return /^\u0000\d+$/.test(h) ? t("setup.column",{n:h.slice(1)}) : h; }
export const WEAPON_ALIAS_DE: Record<string, string> = {
  langbogen:"Longbow", bogen:"Longbow", armbrust:"Crossbow",
  großschwert:"Greatsword", grossschwert:"Greatsword", zweihänder:"Greatsword", zweihaender:"Greatsword",
  "schwert und schild":"Sword and Shield", schild:"Sword and Shield", schwert:"Sword and Shield",
  dolch:"Dagger", dolche:"Dagger", stab:"Staff",
  "zauberstab und foliant":"Wand and Tome", zauberstab:"Wand and Tome", foliant:"Wand and Tome", zauberbuch:"Wand and Tome",
  speer:"Spear", passiv:"Passive",
  panzerhandschuhe:"Gauntlet", panzerhandschuh:"Gauntlet", handschuhe:"Gauntlet", kugel:"Orb",
  "nicht zugewiesen":"Unassigned", keine:"Unassigned"
};


// what this part did at the top level, run where it stands in the order
export function setup(): void {
  document.documentElement.lang = state.lang;
}
