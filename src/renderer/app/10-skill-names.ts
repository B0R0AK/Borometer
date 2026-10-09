import { state } from "./01-state";
import { persistPref } from "./27-weapons-tab";
import type { BoardRow, SkillNames } from "../types";

/* skill names, keyed by the game's own skill id — which stays the same
   regardless of which language the client (and so the log) was in. Only
   entries actually confirmed by seeing the same id in an English and a
   German log are here; an unconfirmed guess would risk mislabeling a
   fight's own skill list, which is worse than just leaving it alone. */
export const SKILL_ID_NAME: Record<string, SkillNames> = {
  "940584840":{en:"Deadly Viper", de:"Tödliche Viper"},
  "944299709":{en:"Strafing", de:"Beschuss"},
  "944723371":{en:"Agile Shot", de:"Agiler Schuss"},
  "944953936":{en:"Strafing", de:"Beschuss"},
  "945674044":{en:"Strafing", de:"Beschuss"},
  "945408027":{en:"Blade Storm", de:"Klingensturm"},
  "945710601":{en:"Blade Storm", de:"Klingensturm"},
  "947457802":{en:"Basic Shot", de:"Standardschuss"},
  "947523317":{en:"Basic Shot", de:"Standardschuss"},
  "947551927":{en:"Basic Shot", de:"Standardschuss"},
  "947515856":{en:"Basic Shot", de:"Standardschuss"},
  "947450333":{en:"Basic Shot", de:"Standardschuss"},
  "947525562":{en:"Basic Shot", de:"Standardschuss"},
  "947581240":{en:"Basic Shot", de:"Standardschuss"},
  "947843568":{en:"Basic Shot", de:"Standardschuss"},
  "947909095":{en:"Basic Shot", de:"Standardschuss"},
  "947532344":{en:"Roxie's Arrowhead", de:"Roxies Pfeilspitze"},
  "952531070":{en:"Storm Current", de:"Sturmströmung"},
  "953174691":{en:"Detonation Mark", de:"Detonierendes Mal"},
  "953371309":{en:"Detonation Mark", de:"Detonierendes Mal"},
  "953167770":{en:"Wave Shot", de:"Wellenschuss"},
  "964049176":{en:"Wild Barrage", de:"Wildes Sperrfeuer"},
  // wand
  "950614913":{en:"Manaball", de:"Manasphäre"},
  "950745989":{en:"Manaball", de:"Manasphäre"},
  "951925391":{en:"Manaball", de:"Manasphäre"},
  "962981882":{en:"Cursed Nightmare", de:"Verfluchter Alptraum"},
  "963713366":{en:"Vampiric Contract", de:"Vampirischer Vertrag"},
  "963831285":{en:"Corrupted Magic Circle", de:"Verdorbener magischer Kreis"},
  "964158879":{en:"Touch of Despair", de:"Hauch der Verzweiflung"},
  "967072496":{en:"Corrupting Hit", de:"Verderbender Treffer"},
  "968426493":{en:"Curse Explosion", de:"Fluchexplosion"},
  "962849462":{en:"Curse Explosion", de:"Fluchexplosion"},
  "968461062":{en:"Ray of Disaster", de:"Strahl des Verderbens"},
  "968445182":{en:"Decaying Touch", de:"Berührung des Verfalls"},
  "966115025":{en:"Slothful Cage", de:"Faulheitskäfig"},
  "966375907":{en:"Corrupted Obliteration", de:"Verderbte Auslöschung"},
  "967030853":{en:"Corrupted Obliteration", de:"Verderbte Auslöschung"},
  "967227745":{en:"Corrupted Obliteration", de:"Verderbte Auslöschung"},
  "966507505":{en:"Obliterating Swamp", de:"Auslöschender Sumpf"},
  // dagger
  "940612462":{en:"Cleaving Moonlight", de:"Spaltendes Mondlicht"},
  "940614907":{en:"Cleaving Moonlight", de:"Spaltendes Mondlicht"},
  "940729956":{en:"Inject Venom", de:"Giftspritze"},
  "955956838":{en:"Inject Venom", de:"Giftspritze"},
  "940795465":{en:"Inject Venom", de:"Giftspritze"},
  "940751617":{en:"Vampiric Strike", de:"Vampirschlag"},
  "940620545":{en:"Vampiric Strike", de:"Vampirschlag"},
  "946919227":{en:"Mutilation", de:"Verstümmelung"},
  "947115633":{en:"Mutilation", de:"Verstümmelung"},
  "947247165":{en:"Mutilation", de:"Verstümmelung"},
  "947508651":{en:"Mutilation", de:"Verstümmelung"},
  "947814135":{en:"Mutilation", de:"Verstümmelung"},
  "947836334":{en:"Mutilation", de:"Verstümmelung"},
  "947558144":{en:"Fatal Stigma", de:"Tödliches Stigma"},
  "947572762":{en:"Fatal Stigma", de:"Tödliches Stigma"},
  "955633534":{en:"Brutal Incision", de:"Brutaler Einschnitt"},
  "955371276":{en:"Brutal Incision", de:"Brutaler Einschnitt"},
  "955895166":{en:"Shadow Strike", de:"Schattenstreich"},
  "956087996":{en:"Shadow Strike", de:"Schattenstreich"},
  "966795945":{en:"Frenzied Sword Dance", de:"Wilder Schwerttanz"},
  "966927024":{en:"Frenzied Sword Dance", de:"Wilder Schwerttanz"},
  "967057743":{en:"Frenzied Sword Dance", de:"Wilder Schwerttanz"},
  "967189154":{en:"Frenzied Sword Dance", de:"Wilder Schwerttanz"},
  "967582390":{en:"Frenzied Sword Dance", de:"Wilder Schwerttanz"},
  "967647924":{en:"Frenzied Sword Dance", de:"Wilder Schwerttanz"},
  "967779003":{en:"Frenzied Sword Dance", de:"Wilder Schwerttanz"},
  "966842239":{en:"Ankle Strike", de:"Knöchelhieb"},
  "967104253":{en:"Ankle Strike", de:"Knöchelhieb"},
  // greatsword
  "947954158":{en:"Double Slash", de:"Doppelhieb"},
  "948347469":{en:"Double Slash", de:"Doppelhieb"},
  "948412997":{en:"Double Slash", de:"Doppelhieb"},
  "948544088":{en:"Double Slash", de:"Doppelhieb"},
  "955258160":{en:"Valiant Brawl", de:"Kühne Prügel"},
  "956175664":{en:"Valiant Brawl", de:"Kühne Prügel"},
  "956241200":{en:"Valiant Brawl", de:"Kühne Prügel"},
  "955867768":{en:"Stunning Blow", de:"Betäubender Schlag"},
  "955968982":{en:"Precision Dash", de:"Präzisionssprint"},
  "963183484":{en:"Precision Dash", de:"Präzisionssprint"},
  "947962456":{en:"Devastating Tornado", de:"Verwüstender Tornado"},
  "958124622":{en:"Devastating Smash", de:"Vernichtender Schlag"},
  "966987944":{en:"Guillotine Blade", de:"Fallbeilklinge"},
  "967053064":{en:"Ascending Slash", de:"Aufsteigender Hieb"},
  "967059620":{en:"Death Blow", de:"Todesschlag"},
  "967094537":{en:"Gaia Crash", de:"Gaiasturz"},
  "967262495":{en:"Willbreaker", de:"Willensbrecher"},
  "940599710":{en:"Willbreaker", de:"Willensbrecher"},
  "940579344":{en:"Death Blow", de:"Todesschlag"},
  "940609889":{en:"Guillotine Blade", de:"Fallbeilklinge"},
  "940601151":{en:"Charging Slash", de:"Stürmischer Schlag"},
  "940625199":{en:"Ice Tornado", de:"Eistornado"},
  "940756276":{en:"Ice Tornado", de:"Eistornado"},
  "940821810":{en:"Ice Tornado", de:"Eistornado"},
  "940633384":{en:"Frost Cleaving", de:"Spaltender Frost"},
  // staff
  "948361757":{en:"Manaball", de:"Manasphäre"},
  "968862069":{en:"Manaball", de:"Manasphäre"},
  "967879042":{en:"Manaball", de:"Manasphäre"},
  "967944588":{en:"Manaball", de:"Manasphäre"},
  "948692280":{en:"Manaball", de:"Manasphäre"},
  "948823370":{en:"Manaball", de:"Manasphäre"},
  "950004896":{en:"Judgment Lightning", de:"Urteilsblitz"},
  "968485880":{en:"Judgment Lightning", de:"Urteilsblitz"},
  "962767879":{en:"Inferno Wave", de:"Infernowelle"},
  "963291736":{en:"Chain Lightning", de:"Kettenblitzschlag"},
  "964209795":{en:"Manaball Eruption", de:"Manasphärenausbruch"},
  "967890474":{en:"Serial Fire Bombs", de:"Reihen-Brandbomben"},
  "968087134":{en:"Serial Fire Bombs", de:"Reihen-Brandbomben"},
  "968873501":{en:"Serial Fire Bombs", de:"Reihen-Brandbomben"},
  "968448408":{en:"Fireball Barrage", de:"Feuerballsperrfeuer"},
  "968446226":{en:"Fireball Barrage", de:"Feuerballsperrfeuer"},
  "968528717":{en:"Ice Spear", de:"Eisspeer"},
  "968566528":{en:"Infernal Meteor", de:"Höllischer Meteor"},
  "968725966":{en:"Icebound Tomb", de:"Eisgebundenes Grab"},
  "968425507":{en:"Redemptive Barrier", de:"Erlösende Barriere"},
  "968434174":{en:"Burning Smokescreen", de:"Brandnebelschleier"},
  "968448884":{en:"Judgment Lightning", de:"Urteilsblitz"},
  "968464227":{en:"Hellfire Rain", de:"Höllenfeuerregen"},
  "968472498":{en:"Frenzied Lightning Wave", de:"Rasende Blitzwelle"},
  "968477002":{en:"Ice Spear Bombardment", de:"Eisspeer-Bombardement"},
  "968487638":{en:"Focused Fire Bombs", de:"Fokussierte Feuerbomben"},
  "968554218":{en:"Focused Fire Bombs", de:"Fokussierte Feuerbomben"},
  // gauntlet
  "940579602":{en:"Consecutive Hits", de:"Fortlaufende Treffer"},
  "940580415":{en:"Consecutive Hits", de:"Fortlaufende Treffer"},
  "940776212":{en:"Consecutive Hits", de:"Fortlaufende Treffer"},
  "940581282":{en:"Afterimage", de:"Nachbild"},
  "940587996":{en:"Bloodstorm", de:"Blutsturm"},
  "940591022":{en:"Short Jab", de:"Short Jab"},
  "941039175":{en:"Short Jab", de:"Short Jab"},
  "940610394":{en:"Blood Spiral", de:"Blutspirale"},
  "940741517":{en:"Blood Spiral", de:"Blutspirale"},
  "940807045":{en:"Blood Spiral", de:"Blutspirale"},
  "940872650":{en:"Blood Spiral", de:"Blutspirale"},
  "940938133":{en:"Blood Spiral", de:"Blutspirale"},
  "940610718":{en:"Consecutive Claws", de:"Fortlaufende Klauen"},
  "945471180":{en:"Enraged Tevent's Hunger", de:"Tevents Hunger (Erzürnt)"},
  "940807331":{en:"Consecutive Claws", de:"Fortlaufende Klauen"},
  "940616501":{en:"Blood Explosion", de:"Blutexplosion"},
  "940909070":{en:"Blood Explosion", de:"Blutexplosion"},
  "940710828":{en:"Claw", de:"Klaue"},
  "940842037":{en:"Claw", de:"Klaue"},
  "940907488":{en:"Claw", de:"Klaue"},
  "940973120":{en:"Claw", de:"Klaue"},
  "941169852":{en:"Claw", de:"Klaue"},
  "940711492":{en:"Chain Strike", de:"Kettenschlag"},
  "940634877":{en:"Chain Strike", de:"Kettenschlag"},
  "940831490":{en:"Chain Strike", de:"Kettenschlag"},
  "940712461":{en:"Absorbing Grasp", de:"Absorbierender Griff"},
  "940959068":{en:"Mobility Strike", de:"Beweglichkeitsschlag"},
  "941170251":{en:"Explosive Flurry", de:"Explosiver Wirbel"},
  "941301324":{en:"Earthquake", de:"Erdbeben"},
  "941366862":{en:"One-Inch Punch", de:"Ein-Zoll-Schlag"},
  "941050089":{en:"One-Inch Punch", de:"Ein-Zoll-Schlag"},
  "953377542":{en:"Destruction Spear", de:"Zerstörungsspeer"},
  "950282680":{en:"Dragon Ascent", de:"Drachenaufstieg"},
  "940593086":{en:"Lightning Speed", de:"Blitzgeschwindigkeit"},
  "966941381":{en:"Abyssal Burst", de:"Ausbruch des Abgrunds"},
  // Chaotic Shield is the wand block; blocking a fury attack turns it
  // into Counterattack Spell, the same way the greatsword parry works
  "963783565":{en:"Chaotic Shield", de:"Chaosschild"},
  "968567342":{en:"Counterattack Spell", de:"Gegenangriffszauber"},
  // Iron Point Parry is the greatsword block; a successful block on a
  // blockable skill turns it into Murderous Draw, so both sit there
  "968463114":{en:"Iron Point Parry", de:"Eisenparieren"},
  "966796942":{en:"Murderous Draw", de:"Mörderisches Ziehen"},
  // Slash Wave is a skill core for Valiant Brawl / Cruel Smite, so its
  // damage belongs with the greatsword that triggers it
  "940630406":{en:"Slash Wave", de:"Hiebwelle"},
  "940761479":{en:"Slash Wave", de:"Hiebwelle"},
  "940827014":{en:"Slash Wave", de:"Hiebwelle"},
  "940637913":{en:"Evaporation", de:"Verdunstung"},
  "940598648":{en:"Blood Talon", de:"Blutklaue"},
  // orb
  "964225722":{en:"Dimensional Bomb", de:"Dimensionsbombe"},
  "964291252":{en:"Dimensional Bomb", de:"Dimensionsbombe"},
  "964356779":{en:"Dimensional Bomb", de:"Dimensionsbombe"},
  "964684477":{en:"Dimensional Bomb", de:"Dimensionsbombe"},
  "980505791":{en:"Interstellar Explosion", de:"Interstellare Explosion"},
  "980571642":{en:"Stellar Dash", de:"Astralsprint"},
  "980721914":{en:"Stellar Dash", de:"Astralsprint"},
  "980702821":{en:"Starcalling", de:"Sternenruf"},
  "980891644":{en:"Void Slash", de:"Hieb der Leere"},
  "980990826":{en:"Stellar Echo", de:"Astralecho"},
  "981032927":{en:"Star Destroyer", de:"Sternenzerstörer"},
  "981056468":{en:"Rift Fracture", de:"Spaltbruch"},
  "981111902":{en:"Summon Constellation", de:"Konstellation beschwören"},
  "981417584":{en:"Copy Satellite", de:"Satellit kopieren"},
  "979681846":{en:"Summon Satellite", de:"Satellit beschwören"},
  "953603794":{en:"Milky Way", de:"Milchstraße"},
  "981155103":{en:"Milky Way", de:"Milchstraße"},
  "979677294":{en:"Gravity Star Destroyer", de:"Schwerkraft-Sternenzerstörer"},
  "979944156":{en:"Supernova Collapse", de:"Supernova-Zusammenbruch"},
  "981111140":{en:"Stellar Dash", de:"Astralsprint"},
  "967001159":{en:"Knife Throwing", de:"Messerwerfen"},
  "967068704":{en:"Umbral Spirit", de:"Schattenhafter Geist"},
  "941358871":{en:"Venomous Edge", de:"Giftige Schneide"},
  "939780553":{en:"Fatal Stigma", de:"Tödliches Stigma"},
  "940632399":{en:"Fatal Stigma", de:"Tödliches Stigma"},
  "940948225":{en:"Vampiric Strike", de:"Vampirschlag"},
  "940817153":{en:"Vampiric Strike", de:"Vampirschlag"},
  "940580872":{en:"Thunder Spirit", de:"Geist des Donners"},
  "940624689":{en:"Mad Sword Dance", de:"Verrückter Schwerttanz"},
  "940755821":{en:"Mad Sword Dance", de:"Verrückter Schwerttanz"},
  "940821350":{en:"Mad Sword Dance", de:"Verrückter Schwerttanz"},
  "940953339":{en:"Mad Sword Dance", de:"Verrückter Schwerttanz"},
  "941412647":{en:"Mad Sword Dance", de:"Verrückter Schwerttanz"},
  "941609259":{en:"Mad Sword Dance", de:"Verrückter Schwerttanz"},
  "940719361":{en:"Lightning Infusion", de:"Blitzdurchdringung"},
  "940588276":{en:"Lightning Infusion", de:"Blitzdurchdringung"},
  "940811078":{en:"Lightning Throw", de:"Blitzwurf"},
  "940614453":{en:"Lightning Throw", de:"Blitzwurf"},
  "941018629":{en:"Thundering Bomb", de:"Donnernde Bombe"},
  "941084156":{en:"Thundering Bomb", de:"Donnernde Bombe"},
  // sword and shield
  "947939728":{en:"Slash", de:"Hieb"},
  "948268379":{en:"Slash", de:"Hieb"},
  "948399467":{en:"Slash", de:"Hieb"},
  "948530554":{en:"Slash", de:"Hieb"},
  "948817699":{en:"Fierce Clash", de:"Heftiger Zusammenstoß"},
  "962834706":{en:"Chain Hook", de:"Kettenhaken"},
  "963293328":{en:"Shield Strike", de:"Schildangriff"},
  "964669956":{en:"Spectrum of Agony", de:"Spektrum der Qual"},
  "968441203":{en:"Witty Retort", de:"Vorwitzige Retorte"},
  "968449552":{en:"A Shot at Victory", de:"Eine Chance auf den Sieg"},
  "971154549":{en:"Annihilating Slash", de:"Auslöschender Hieb"},
  "971409600":{en:"Strategic Rush", de:"Strategischer Ansturm"},
  "971810299":{en:"Shield Throw", de:"Schildwurf"},
  "967846937":{en:"Concentrated Barrier", de:"Konzentrierte Barriere"},
  "967930341":{en:"Annihilation Blade", de:"Auslöschendes Schwert"},
  "968472045":{en:"Controlling Rake", de:"Lenkende Harke"},
  "968483956":{en:"Desperate Clash", de:"Verzweifelter Zusammenstoß"},
  "968684454":{en:"Whirling Shield", de:"Wirbelnder Schild"},
  "968463941":{en:"Witty Retort", de:"Vorwitzige Retorte"},
  "968512425":{en:"Annihilating Slash", de:"Auslöschender Hieb"},
  "968728781":{en:"Strategic Rush", de:"Strategischer Ansturm"},
  // spear
  "950072565":{en:"Vicious Fury", de:"Grausamer Zorn"},
  "950334280":{en:"Vicious Fury", de:"Grausamer Zorn"},
  "950859170":{en:"Vicious Fury", de:"Grausamer Zorn"},
  "950232540":{en:"Rising Slash", de:"Ansteigender Hieb"},
  "950294052":{en:"Rising Slash", de:"Ansteigender Hieb"},
  "950272669":{en:"Spiral Slash", de:"Spiralhieb"},
  "950277937":{en:"Bloodleech Aura", de:"Blutsaugeraura"},
  "950311148":{en:"Cyclonic Fury", de:"Stürmischer Zorn"},
  "950314950":{en:"Cataclysm", de:"Verheerung"},
  "950325142":{en:"Abyssal Cleave", de:"Abgrundspalt"},
  "950325659":{en:"Tempest Strike", de:"Gewitterschlag"},
  "950328682":{en:"Gale Rush", de:"Sturm-Sprint"},
  "950432457":{en:"Death From Above", de:"Tod von oben"},
  "950476524":{en:"Javelin Surge", de:"Schmetternder Speer"},
  "950828882":{en:"Culling Arc", de:"Schlachtender Bogen"},
  "963643674":{en:"Swing", de:"Schwingen"},
  "963774712":{en:"Swing", de:"Schwingen"},
  "964036892":{en:"Swing", de:"Schwingen"},
  "964298274":{en:"Swing", de:"Schwingen"},
  "950046202":{en:"Slaughtering Slash", de:"Schlachthieb"},
  "950111723":{en:"Slaughtering Slash", de:"Schlachthieb"},
  "950177299":{en:"Slaughtering Slash", de:"Schlachthieb"},
  "950242822":{en:"Slaughtering Slash", de:"Schlachthieb"},
  "950305597":{en:"Slaughtering Slash", de:"Schlachthieb"},
  "950438753":{en:"Slaughtering Slash", de:"Schlachthieb"},
  "950318656":{en:"Wreak Havoc", de:"Chaos stiften"},
  "951034867":{en:"Phoenix Barrage", de:"Phönix-Sperrfeuer"},
  "951299308":{en:"Brutal Fury", de:"Brutaler Zorn"},
  "951495013":{en:"Ascending Cleave", de:"Aufsteigender Spalt"},
  "948156706":{en:"Explosive Fury", de:"Explosiver Zorn"},
  "950577492":{en:"Explosive Fury", de:"Explosiver Zorn"},
  "950708663":{en:"Explosive Fury", de:"Explosiver Zorn"},
  "951364066":{en:"Explosive Fury", de:"Explosiver Zorn"},
  "951429586":{en:"Explosive Fury", de:"Explosiver Zorn"},
  "950308934":{en:"Javelin Inferno", de:"Speerinferno"},
  "964482348":{en:"Wild Barrage", de:"Wildes Sperrfeuer"},
  "964613412":{en:"Wild Barrage", de:"Wildes Sperrfeuer"},
  "953312335":{en:"Silver Reaper's Soul Harvest", de:"Seelenernte des Silbernen Schnitters"},
  "964285948":{en:"Rapid Shot", de:"Schneller Schuss"},
  "964351478":{en:"Rapid Shot", de:"Schneller Schuss"},
  "964696731":{en:"Quick Fire", de:"Schnellfeuer"},
  "963754730":{en:"Mother Nature's Protest", de:"Protest von Mutter Natur"},
  "947759200":{en:"Mother Nature's Protest", de:"Protest von Mutter Natur"},
  "963973967":{en:"Ensnaring Arrow", de:"Fesselnder Pfeil"},
  "964762401":{en:"Quick Fire", de:"Schnellfeuer"},
  "964893236":{en:"Quick Fire", de:"Schnellfeuer"},
  "965717385":{en:"Quick Fire", de:"Schnellfeuer"},
  "964995791":{en:"Quick Fire", de:"Schnellfeuer"},
  "965155724":{en:"Quick Fire", de:"Schnellfeuer"},
  "965287183":{en:"Quick Fire", de:"Schnellfeuer"},
  "965090156":{en:"Quick Fire", de:"Schnellfeuer"},
  "968488988":{en:"Weak Point Shot", de:"Schwachpunktschuss"},
  "968554562":{en:"Weak Point Shot", de:"Schwachpunktschuss"},
  // crossbow
  "963732547":{en:"Wind Snatcher", de:"Winddieb"},
  "963143367":{en:"Wind Snatcher", de:"Winddieb"},
  "964277364":{en:"Recoil Shot", de:"Rückstoß-Schuss"},
  "964342880":{en:"Recoil Shot", de:"Rückstoß-Schuss"},
  "964297409":{en:"Explosive Trap", de:"Sprengfalle"},
  "964101335":{en:"Annihilation Barrage Shot", de:"Auslöschender Sperrfeuerschuss"},
  "963708114":{en:"Annihilation Barrage Shot", de:"Auslöschender Sperrfeuerschuss"},
  "964503191":{en:"Merciless Barrage", de:"Gnadenloses Sperrfeuer"},
  "964568723":{en:"Merciless Barrage", de:"Gnadenloses Sperrfeuer"},
  "964679254":{en:"Collision Shot", de:"Kollisionsschuss"},
  "964220484":{en:"Collision Shot", de:"Kollisionsschuss"},
  "964539717":{en:"Multi-Shot", de:"Multischuss"},
  "970177015":{en:"Mortal Mark", de:"Tödliches Mal"},
  "969783791":{en:"Mortal Mark", de:"Tödliches Mal"},
  /* Decisive Sniping and Decisive Bombardment are the same base skill under
     two mutually exclusive trait specializations, so they stay as two
     distinct dictionary entries rather than being merged into one skill.
     (The older note here said the two ids are never both active at once.
     That is not what the logs show: on one Dragaryle pull a single player
     alternates 964500434 and 964631505 in blocks, 83 hits against 110.
     They are ranks of one skill, not a pair of specializations.)
     boro:ventius is not a game id. It is this app's own name for the
     specialization the log does not name - see ventiusPass(). */
  "boro:ventius":{en:"Eye of Ventius", de:"Auge von Ventius"},
  "964500434":{en:"Decisive Sniping", de:"Entschlossener Scharfschuss"},
  "964631505":{en:"Decisive Sniping", de:"Entschlossener Scharfschuss"},
  "964581976":{en:"Decisive Sniping", de:"Entschlossener Scharfschuss"},
  "963126067":{en:"Decisive Bombardment", de:"Entschlossenes Bombardement"},
  "963912496":{en:"Decisive Bombardment", de:"Entschlossenes Bombardement"},
  "962272451":{en:"Zephyr's Nock", de:"Zephyrs Nockpunkt"},
  "945725019":{en:"Brutal Arrow", de:"Brutaler Pfeil"},
  "945743775":{en:"Arrow Vortex", de:"Pfeilwirbel"},
  "945731619":{en:"Flash Arrow", de:"Blitzpfeil"},
  // specialization variants — same base skill as the entry above, a
  // different trait chosen, always a different id, never both at once
  "963233917":{en:"Tornado", de:"Tornado"},
  "963734066":{en:"Flash Wave", de:"Blitzwelle"},
  "953210097":{en:"Concentration Stance", de:"Konzentrationshaltung"}
};

/* Which weapon each skill belongs to, worked out from dummy-log sessions
   where only one weapon was used — so it is measured, not guessed. Used only
   to fill in skills you have not assigned yourself; anything you set by hand
   always wins and is never overwritten. */
export const SKILL_WEAPON: Record<string, string> = {
  // the family it is derived from is Longbow on every one of its five ids
  "boro:ventius":"Longbow",
  "939780553":"Dagger",
  "940579344":"Greatsword",
  "940579602":"Gauntlet",
  "940580415":"Gauntlet",
  "940580872":"Dagger",
  "940581282":"Gauntlet",
  "940584840":"Passive",
  "940587996":"Gauntlet",
  "940588276":"Dagger",
  "940591022":"Gauntlet",
  "940598648":"Gauntlet",
  "940599710":"Greatsword",
  "940601151":"Greatsword",
  "940609889":"Greatsword",
  "940610394":"Gauntlet",
  "940610718":"Gauntlet",
  "940612462":"Dagger",
  "940614453":"Dagger",
  "940614907":"Dagger",
  "940616501":"Gauntlet",
  "940620545":"Dagger",
  "940624689":"Dagger",
  "940625199":"Greatsword",
  "940632399":"Dagger",
  "940633384":"Greatsword",
  "940634877":"Gauntlet",
  "940637913":"Gauntlet",
  "940710828":"Gauntlet",
  "940711492":"Gauntlet",
  "940712461":"Gauntlet",
  "940719361":"Dagger",
  "940729956":"Dagger",
  "940741517":"Gauntlet",
  "940751617":"Dagger",
  "940755821":"Dagger",
  "940756276":"Greatsword",
  "940776212":"Gauntlet",
  "940795465":"Dagger",
  "940807045":"Gauntlet",
  "940807331":"Gauntlet",
  "940811078":"Dagger",
  "940817153":"Dagger",
  "940821350":"Dagger",
  "940821810":"Greatsword",
  "940831490":"Gauntlet",
  "940842037":"Gauntlet",
  "940872650":"Gauntlet",
  "940907488":"Gauntlet",
  "940909070":"Gauntlet",
  "940938133":"Gauntlet",
  "940948225":"Dagger",
  "940953339":"Dagger",
  "940959068":"Gauntlet",
  "940973120":"Gauntlet",
  "941018629":"Dagger",
  "941039175":"Gauntlet",
  "941084156":"Dagger",
  "941169852":"Gauntlet",
  "941170251":"Gauntlet",
  "941301324":"Gauntlet",
  "941358871":"Dagger",
  "941366862":"Gauntlet",
  "941050089":"Gauntlet",
  "941412647":"Dagger",
  "941609259":"Dagger",
  "944299709":"Longbow",
  "944953936":"Longbow",
  "945408027":"Crossbow",
  "945674044":"Longbow",
  "945710601":"Crossbow",
  "945725019":"Longbow",
  "945731619":"Longbow",
  "945743775":"Longbow",
  "946919227":"Dagger",
  "947115633":"Dagger",
  "947247165":"Dagger",
  "947457802":"Longbow",
  "947508651":"Dagger",
  "947523317":"Longbow",
  /* Steht bei questlog unter skill-sets, Kategorie bow: ein
     Langbogenskill, der sich passiv verhaelt. "Passiv" ist in
     dieser App etwas anderes - was nicht von einer Waffe kommt. */
  "947532344":"Longbow",
  "950282680":"Passive",
  "940593086":"Passive",
  /* Waffenspezialisierung des Zauberstabs (Wand_Hero_Attack_01),
     nicht eine der 24 gemeinsamen Passiven. */
  "966941381":"Wand and Tome",
  "963783565":"Wand and Tome",
  "968567342":"Wand and Tome",
  "968463114":"Greatsword",
  "966796942":"Greatsword",
  "953377542":"Passive",
  "940630406":"Greatsword",
  "940761479":"Greatsword",
  "940827014":"Greatsword",
  /* Die drei hier stehen in KEINER Einzelwaffen-Sitzung - der Weg, auf dem
     jeder andere Eintrag dieser Tabelle entstanden ist. Aus den 92 Logs war
     nur die Vorauswahl zu holen: Agile Shot kommt in neun Logs vor, in allen
     feuern Langbogen und Armbrust; Counter Barrier in dreien, in allen
     Schwert und Schild und Grossschwert. Welche der beiden es jeweils ist,
     ist am 18.09.2026 bestaetigt worden. Zusammen 0,013 Prozent des Schadens. */
  "944723371":"Longbow",
  "947551927":"Longbow",
  "947515856":"Crossbow",
  "947450333":"Crossbow",
  "947525562":"Crossbow",
  "947581240":"Crossbow",
  "947843568":"Crossbow",
  "947909095":"Crossbow",
  "947558144":"Dagger",
  "947572762":"Dagger",
  "947759200":"Crossbow",
  "947814135":"Dagger",
  "947836334":"Dagger",
  "947939728":"Sword and Shield",
  "947954158":"Greatsword",
  "947962456":"Greatsword",
  "948156706":"Spear",
  "948268379":"Sword and Shield",
  "948347469":"Greatsword",
  "948361757":"Staff",
  "948399467":"Sword and Shield",
  "948412997":"Greatsword",
  "948530554":"Sword and Shield",
  "948544088":"Greatsword",
  "948692280":"Staff",
  "948817699":"Sword and Shield",
  "948823370":"Staff",
  "950004896":"Staff",
  "950046202":"Spear",
  "950072565":"Spear",
  "950111723":"Spear",
  "950177299":"Spear",
  "950232540":"Spear",
  "950242822":"Spear",
  "950272669":"Spear",
  "950277937":"Spear",
  "950294052":"Spear",
  "950305597":"Spear",
  "950308934":"Spear",
  "950311148":"Spear",
  "950314950":"Spear",
  "950318656":"Spear",
  "950325142":"Spear",
  "950325659":"Spear",
  "950328682":"Spear",
  "950334280":"Spear",
  "950432457":"Spear",
  "950438753":"Spear",
  "950476524":"Spear",
  "950577492":"Spear",
  "950614913":"Wand and Tome",
  "950708663":"Spear",
  "950745989":"Wand and Tome",
  "950828882":"Spear",
  "950859170":"Spear",
  "951034867":"Spear",
  "951299308":"Spear",
  "951364066":"Spear",
  "951429586":"Spear",
  "951495013":"Spear",
  "951925391":"Wand and Tome",
  "952531070":"Crossbow",
  "953167770":"Crossbow",
  "953174691":"Crossbow",
  "953210097":"Longbow",
  "953312335":"Crossbow",
  "953371309":"Crossbow",
  "953603794":"Orb",
  "955258160":"Greatsword",
  "955371276":"Dagger",
  "955633534":"Dagger",
  "955867768":"Greatsword",
  "955895166":"Dagger",
  "955956838":"Dagger",
  "955968982":"Greatsword",
  "956087996":"Dagger",
  "956175664":"Greatsword",
  "956241200":"Greatsword",
  "958124622":"Greatsword",
  "962272451":"Longbow",
  "962767879":"Staff",
  "962834706":"Sword and Shield",
  "962981882":"Wand and Tome",
  "963143367":"Crossbow",
  "963183484":"Greatsword",
  "963233917":"Longbow",
  "963291736":"Staff",
  "963293328":"Sword and Shield",
  "963643674":"Spear",
  "963708114":"Crossbow",
  "963713366":"Wand and Tome",
  "963732547":"Crossbow",
  "963734066":"Longbow",
  "963774712":"Spear",
  "963831285":"Wand and Tome",
  "963912496":"Longbow",
  "963973967":"Longbow",
  "964036892":"Spear",
  "964049176":"Crossbow",
  "964101335":"Crossbow",
  "964158879":"Wand and Tome",
  "964209795":"Staff",
  "964220484":"Crossbow",
  "964225722":"Orb",
  "964277364":"Crossbow",
  "964285948":"Crossbow",
  "964291252":"Orb",
  "964297409":"Crossbow",
  "964298274":"Spear",
  "964342880":"Crossbow",
  "964351478":"Crossbow",
  "964356779":"Orb",
  "964482348":"Crossbow",
  "964503191":"Crossbow",
  "964539717":"Crossbow",
  "964568723":"Crossbow",
  "964581976":"Longbow",
  "964613412":"Crossbow",
  "964669956":"Sword and Shield",
  "964679254":"Crossbow",
  "964684477":"Orb",
  "964696731":"Crossbow",
  "964762401":"Crossbow",
  "964893236":"Crossbow",
  "964995791":"Crossbow",
  "965090156":"Crossbow",
  "965155724":"Crossbow",
  "965287183":"Crossbow",
  "965717385":"Crossbow",
  "966115025":"Wand and Tome",
  "966375907":"Wand and Tome",
  "966507505":"Wand and Tome",
  "966795945":"Dagger",
  "966842239":"Dagger",
  "966927024":"Dagger",
  "966987944":"Greatsword",
  "967001159":"Dagger",
  "967030853":"Wand and Tome",
  "967053064":"Greatsword",
  "967057743":"Dagger",
  "967059620":"Greatsword",
  "967068704":"Dagger",
  "967072496":"Wand and Tome",
  "967094537":"Greatsword",
  "967104253":"Dagger",
  "967189154":"Dagger",
  "967227745":"Wand and Tome",
  "967262495":"Greatsword",
  "967582390":"Dagger",
  "967647924":"Dagger",
  "967779003":"Dagger",
  "967846937":"Sword and Shield",
  "967890474":"Staff",
  "967930341":"Sword and Shield",
  "968087134":"Staff",
  "968425507":"Staff",
  "968426493":"Wand and Tome",
  "962849462":"Wand and Tome",
  "968434174":"Staff",
  "968441203":"Sword and Shield",
  "968445182":"Wand and Tome",
  "968448408":"Staff",
  "968446226":"Staff",
  "968448884":"Staff",
  "968449552":"Sword and Shield",
  "968461062":"Wand and Tome",
  "968463941":"Sword and Shield",
  "968464227":"Staff",
  "968472045":"Sword and Shield",
  "968472498":"Staff",
  "968477002":"Staff",
  "968483956":"Sword and Shield",
  "968485880":"Staff",
  "968487638":"Staff",
  "968554218":"Staff",
  "968488988":"Crossbow",
  "968512425":"Sword and Shield",
  "968528717":"Staff",
  "968554562":"Crossbow",
  "968566528":"Staff",
  "968684454":"Sword and Shield",
  "968725966":"Staff",
  "968728781":"Sword and Shield",
  "968873501":"Staff",
  "969783791":"Crossbow",
  "970177015":"Crossbow",
  "971154549":"Sword and Shield",
  "971409600":"Sword and Shield",
  "971810299":"Sword and Shield",
  "979677294":"Orb",
  "979681846":"Orb",
  "979944156":"Orb",
  "980505791":"Orb",
  "980571642":"Orb",
  "980702821":"Orb",
  "980721914":"Orb",
  "980891644":"Orb",
  "980990826":"Orb",
  "981032927":"Orb",
  "981056468":"Orb",
  "981111140":"Orb",
  "981111902":"Orb",
  "981155103":"Orb",
  "981417584":"Orb",
  "963126067":"Longbow",
  "963489972":"Sword and Shield",
  "963754730":"Crossbow",
  "963905513":"Longbow",
  "964500434":"Longbow",
  "964631505":"Longbow",
  /* Dritte Manasphaeren-Gruppe. Am 21.09.2026 an der Uebungspuppe
     gemessen: derselbe Takt wie die Stab-Gruppe darueber - 741 ms
     Mitte je Schritt, derselbe Dreierzyklus - waehrend der
     Zauberstab bei rund 464 ms liegt. Dazu lief nur
     Manasphaeren-Eruption mit, die es nur am Stab gibt. Es fallen
     zwei Treffer je Schritt statt einem; woran das liegt, ist
     nicht gemessen. */
  "967879042":"Staff",
  "967944588":"Staff",
  "968862069":"Staff"
};

/* The game gives a skill a new id whenever its rank changes, so ids we have
   never seen turn up in real logs. If the NAME is one we already know, the
   translation and weapon carry over automatically instead of the skill
   dropping to "Unassigned" until the dictionary is updated by hand. */
export const NAME_TO_ENTRY = (function(){
  // null: two different skills share the name, so it tells nothing
  const byName: Record<string, SkillNames | null> = {};
  for(const id in SKILL_ID_NAME){
    const e = SKILL_ID_NAME[id]!;
    for(const n of [e.en, e.de]){
      if(!n) continue;
      const prev = byName[n];
      if(prev === undefined) byName[n] = e;
      else if(prev && (prev.en !== e.en || prev.de !== e.de)) byName[n] = null;  // ambiguous
    }
  }
  return byName;
})();
/* ---------- Namenspaare aus der Kernliste von questlog.gg ----------
   Stand 22.09.2026, auf Wunsch nachgetragen.

   Die Tabelle darueber nimmt nur auf, was in einem englischen UND einem
   deutschen Log unter derselben ID gesehen wurde - eine Regel gegen
   geratene Uebersetzungen. Diese Paare sind nicht geraten, sie sind
   abgeschrieben: die Kernliste von questlog.gg gibt es in beiden
   Sprachen, ueber das Symbol je Kern zusammengefuehrt (271 zu 271,
   jede Zeile getroffen), und dann steht derselbe Satz zweimal
   nebeneinander - "Changes Enforcer to Slaughtering Execution" und
   "Aendert Vollstrecker zu Abschlachtende Hinrichtung".

   Sie sind eine eigene Quelle und stehen deshalb in einer eigenen
   Tabelle: die mitgelieferte gewinnt immer, auch dort, wo sie einen
   Namen ausdruecklich als mehrdeutig fuehrt.

   Was sie bewirken: der Hinweis an einer Kernzeile nennt den ersetzten
   Skill in der Sprache des Logs, und eine deutsche Kernzeile findet ihr
   Symbol ueber den englischen Namen. */
const SKILL_NAME_PAIRS: [string, string][] = [
  // die ersetzten Faehigkeiten
  ["Rapid Shot", "Schneller Schuss"],
  ["Javelin Inferno", "Speerinferno"],
  ["Explosive Fury", "Explosiver Zorn"],
  ["Fountain of Life", "Lebensbrunnen"],
  ["A Shot at Victory", "Eine Chance auf den Sieg"],
  ["Recoil Shot", "Rückstoß-Schuss"],
  ["Wave Shot", "Wellenschuss"],
  ["Strafing", "Beschuss"],
  ["Flash Wave", "Blitzwelle"],
  ["Icebound Tomb", "Eisgebundenes Grab"],
  ["Blessing of Immortality", "Segen der Unsterblichkeit"],
  ["Fatal Stigma", "Tödliches Stigma"],
  ["Restoring Constellation", "Wiederherstellungs-Konstellation"],
  ["Cursed Nightmare", "Verfluchter Albtraum"],
  ["Decisive Sniping", "Entschlossener Scharfschuss"],
  ["Decisive Bombardment", "Entschlossenes Bombardement"],
  ["Ray of Disaster", "Strahl des Verderbens"],
  ["Purifying Touch", "Reinigende Berührung"],
  ["Healing Star", "Heilender Stern"],
  ["Cleaving Roar", "Reißendes Brüllen"],
  ["Brutal Arrow", "Brutaler Pfeil"],
  ["Shield Throw", "Schildwurf"],
  ["Corrupted Magic Circle", "Verderbter magischer Kreis"],
  ["Star Destroyer", "Sternenzerstörer"],
  ["Explosive Trap", "Sprengfalle"],
  ["Inner Peace", "Innerer Frieden"],
  ["Stalwart Bastion", "Standhafte Bastion"],
  ["Death Knell", "Totenglocke"],
  ["Nature's Blessing", "Segen der Natur"],
  ["Enforcer", "Vollstrecker"],
  ["Hellfire Rain", "Höllenfeuerregen"],
  ["Valiant Brawl", "Kühne Prügel"],
  ["Cruel Smite", "Grausame Qual"],
  ["Interstellar Explosion", "Interstellare Explosion"],
  // die Kerne selbst
  ["Blade Storm", "Klingensturm"],
  ["Lightning Javelin", "Blitzspeer"],
  ["Explosive Lightning Slash", "Explosiver Blitzhieb"],
  ["Dragon's Intimidation", "Einschüchterung des Drachen"],
  ["Earth Strike", "Erdschlag"],
  ["Explosive Arrow", "Explosiver Pfeil"],
  ["Frost Expansion", "Frostausbreitung"],
  ["Gale Arrow", "Sturmpfeil"],
  ["Ice Dragon Strike", "Eisdrachen-Hieb"],
  ["Icebound Spike", "Eisgebundener Stachel"],
  ["Immortal Bond", "Unsterbliche Bindung"],
  ["Massacre", "Massaker"],
  ["Nebula's Resonance", "Nebulas Resonanz"],
  ["Nightmare Melody", "Albtraummelodie"],
  ["Pierce Shot", "Durchbohrender Schuss"],
  ["Prismatic Beam", "Prismatischer Strahl"],
  ["Purifying Cry", "Läuternder Schrei"],
  ["Purifying Star", "Läuternder Stern"],
  ["Roar of Rage", "Schrei der Raserei"],
  ["Rock Arrow", "Felspfeil"],
  ["Rock Shield Throw", "Steinschildwurf"],
  ["Sacred Magic Circle", "Heiliger magischer Kreis"],
  ["Slash Wave", "Hiebwelle"],
  ["Stellar Star Destroyer", "Stellar-Sternenzerstörer"],
  ["Support Fire", "Unterstützungsfeuer"],
  ["Tectonic Shift", "Tektonische Verschiebung"],
  ["Thunder's Shadow", "Schatten des Donners"],
  ["Wall of Bitter Cold", "Wall der bitteren Kälte"],
  ["Battlefield Frenzy", "Schlachtfeld-Raserei"],
  ["Ice Rain", "Eisregen"],
  ["Seed of the World Tree", "Samen des Weltenbaums"],
  ["Slaughtering Execution", "Abschlachtende Hinrichtung"],
  ["Curse Resonance", "Fluchresonanz"],
  ["Mystic Shield", "Mystischer Schild"],
];
// the module's own table, finished as it loads
for(const [en, de] of SKILL_NAME_PAIRS){
  if(en in NAME_TO_ENTRY || de in NAME_TO_ENTRY) continue;
  const e = {en, de};
  NAME_TO_ENTRY[en] = e;
  NAME_TO_ENTRY[de] = e;
}
export const NAME_TO_WEAPON = (function(){
  // null: the name is on two weapons
  const byName: Record<string, string | null> = {};
  if(typeof SKILL_WEAPON === "undefined") return byName;
  for(const id in SKILL_WEAPON){
    const e = SKILL_ID_NAME[id]; if(!e) continue;
    const w = SKILL_WEAPON[id]!;
    for(const n of [e.en, e.de]){
      if(!n) continue;
      const prev = byName[n];
      if(prev === undefined) byName[n] = w;
      else if(prev && prev !== w) byName[n] = null;   // same name on two weapons
    }
  }
  return byName;
})();
const LEARNED_CAP = 600;    // far more ids than a clan's builds can use
export function learnFromBoard(board: BoardRow[]){
  if(!Array.isArray(board)) return;
  let added = 0;
  for(const r of board){
    const lang = r && r.lang;
    if(lang !== "en" && lang !== "de") continue;     // no language, no evidence
    for(const k of (r.skills || [])){
      if(!k || !k.sid || !k.name) continue;
      if(SKILL_ID_NAME[k.sid]) continue;             // shipped table wins
      const e = state.learned[k.sid] || (state.learned[k.sid] = {});
      if(e[lang] === k.name) continue;
      if(Object.keys(state.learned).length > LEARNED_CAP) return;
      e[lang] = k.name; added++;
    }
  }
  if(added) persistPref("skillNames", state.learned);
}
/* Faehigkeiten, die sicher von selbst Schaden machen - "Deine Rotation"
   (54-deine-rotation.ts) schlaegt sie als automatisch vor, Grund "liste".
   Nur IDs, nie Namen, und nur, was ein Spieler bestaetigt hat (Entscheidung
   vom 26.09. abends): Toedliche Viper. Sie steht zugleich als Passiv in
   SKILL_WEAPON; die Liste haelt sie auch, wenn jemand sie im Waffen-Reiter
   einer Waffe zuordnet. Nicht hier: Auge von Ventius und Roxies Pfeilspitze
   (drueckt man selbst), Protest von Mutter Natur und Sturmstroemung (bis
   anders entschieden wird - "Immer weglassen" nimmt sie selbst heraus). */
export const VON_SELBST: ReadonlySet<string> = new Set(["940584840"]);

export function skillEntry(name: string, sid?: string | null){
  return (sid && SKILL_ID_NAME[sid]) || (sid && state.learned[sid]) ||
         NAME_TO_ENTRY[name] || null;
}

/* Ein Schluessel fuer eine Faehigkeit, der in beiden Client-Sprachen und
   ueber Rangstufen hinweg derselbe ist: der englische Name aus dem
   Woerterbuch, sonst der Name aus dem Log. Nicht die Skill-ID als
   Rueckfall wie cmpKey im Vergleich (28-compare.ts): eine Rangstufe bringt
   eine neue ID, und eine Wahl in "Deine Rotation" soll ueber sie hinweg gelten. Der
   Name aus dem Log laesst sich ausserdem mit skillLabel() anzeigen. */
export function skillKey(name: string, sid?: string | null){
  const e = skillEntry(name, sid);
  return (e && (e.en || e.de)) || name;
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  /* ---------- names learned from the party ----------
     The shipped dictionary above only carries ids confirmed by seeing the same
     one in an English and a German log, and says so: an unconfirmed guess would
     mislabel somebody's own skill list, which is worse than leaving it alone.
     A mixed-language party puts both halves of that evidence side by side every
     pull — the board carries each member's skill ids, their names, and which
     language they were written in. So the pairs are collected rather than
     guessed, and they fill gaps the shipped table has; they never override it.
     Kept in boro-config.json, so what one raid teaches the app it still knows
     next week. */
  state.learned = {};
  /* What each target has ever let a Ventius cast reach. A single pull only
     shows how well you stood in that pull: stand badly on every cast and the
     finding reads "10 of 10" and looks perfect, because the ceiling it
     compares against is your own best cast of that fight. Kept across logs,
     the best cast ever seen on a boss turns that into "you reached three,
     this one gives four".

     Only the maximum is kept, and a maximum can only ever be too low: a cast
     cannot land more waves than the target allows. What it can be is a
     parser fluke, so the number of casts that reached it travels with it -
     one is a rumour, five is a fact. */
  state.ventiusTop = {};
  /* Who in the loaded log casts Eye of Ventius at all - rebuilt whenever the log
     is re-read. Readability does not matter here: one hit proves the skill is on
     the bar, which is the whole question. */
  state.ventiusBy = new Set();
  /* And who on the board has been seen casting it, for as long as this party
     lasts. A skill list only rides along with a fight report, so a member
     between pulls has none - and "who is healing" is exactly what you ask
     between pulls. Once seen, remembered. */
  state.ventiusSeen = new Set();
}
