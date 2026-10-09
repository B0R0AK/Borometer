import { bareBoss, formBoss } from "./06-blocks-and-places";
import { WEAPON_ICON, weaponMark } from "./09-weapon-icons";
import { SKILL_ID_NAME } from "./10-skill-names";
import { SKILL_ICON_BILD, SKILL_ICON_NAME, SKILL_ICON_SID } from "./11-skill-icons";
import { BOSS_ICON_BILD as SPIEL_BOSSBILD, WK_BOSS_BILD } from "../spielbilder";

/* ---------- die Bossbilder ----------
   Fuer jeden Boss, der in DUNGEONS und OPEN_BOSSES (06) steht, ein
   Gesicht, aus drei Quellen: das Portraet aus der NPC-Datenbank von
   questlog (PT_NPC_...), wo es dort eines gibt; fuer die Raid-Bosse
   die Bilder der Weekly-Fluegel (wk:...); fuer 17 Bosse, bei denen
   questlog nur das Kartensymbol ausgibt, das jeder Dungeonboss traegt,
   Bildschirmfotos von B0R0AK aus dem Spiel vom 03.10.2026 (foto:...),
   und die vier Bosse der Halle der Illusionen von seinen Bosskarten
   vom 05.10.2026.
   Die eigene Marke boro:boss bleibt der Rueckfall: ohne Spielbilder
   (oeffentlicher Quelltext) und fuer einen kuenftigen Boss ohne Bild.
   test:spielbilder-core verlangt, dass mit den Spielbildern kein Boss
   aus 06 die Marke traegt.

   Dass Lucien, Karnix und Heliber dasselbe Gesicht haben, ist kein
   Fehler: im Spiel heissen sie Death_Bringer, _CD1 und _CD2 und
   benutzen dasselbe Modell. Dasselbe bei Lyxara/Lacune,
   Junobote/Grauauge und Kertaki/Toublek.

   Der deutsche Client schreibt manche Namen anders (beide Spalten der
   Liste in 06); jeder steht hier mit dem Ziel seines englischen Namens,
   etwa Kayser wie Kaiser Crimson (bestaetigt 04.10.2026). */
/* Die eigene Marke (boro:boss) fuer Bosse ohne Portraet: kein Spielbild,
   darum im Quelltext. Ohne die Spielbilder (oeffentlicher Quelltext) traegt
   jeder bekannte Boss diese Marke. Die uebrigen Bilder: ../spielbilder. */
const EIGENE_BOSSMARKE = "UklGRqAFAABXRUJQVlA4WAoAAAAQAAAALwAALwAAQUxQSAMCAAABkCMAjCI3uou83txumJkzZma7CzN21DPnA9Qzp2Y0Ux9mPAgzYxfZo+I8czMbqCNiAuAfGULHwZCFEKY7GNJxXXfWDEQ057pz5vQFvZ1MM6zMYd7aV2vWPY4KK9nMDyu0djKTNT7dV+WUENHXQrBZ+ImIslxFry1E9D4A61Sj2gLSnKXIJiL6FQBSFUspJc1AVLmu6yIiqnovZ2amCkV5F01CJ2tvbI/QqjVCTWJQJKln7roYEUVXi/7dAaD3uOJaNkN0bFJOTm7VtsfUdXRHVf7E4kknP3MqRUREnHzt8dfEO9Z9l/j1+Bqr8xQTNFKWRB2s+UQ1qNmclFLnoK+I5AQkTxUW+ziIhweCGkVLANpHezooWqw1jvZAC8Wxl3Yah3uQYvr46TZ+L+obhtTHWykJG0lY+DTBTLOFk32N9F7UoSFlCvN8MFp8RYOl1LqYm2aoQyWlZP0iMNv7pA7rnxpoyK9pYWaZMlHTDM8Q+mLtYwPR1QK7GQJAwQaaBCIEiiw9ZmZ6y12/65RSvhgNFlG0JJGCO6XsrLeDszR+KZb0tCMUN1ckmH8l5YHdwWeIqJa5Pa+F+TEzHx1syasgItrUPt+fxWsfMz8tjViCwbVJvu+j2MfMR/uHbXmDa4k4CZn5aP/+YN0bsujCzAgAeIsblg52IIieF0kDAPA8x4H/XwBWUDggdgMAADAUAJ0BKjAAMAA+MRSJQyIhIRVdVKwgAwS0AFqNYOgLQH6di+fOFygbxF5gHq78wG4k/4DrkvQl8rf2WfJJzADsx/tPQPegvY7KHPVM5PuhGKO7C/VeM3/1X5R80XF7/wvP4/xvLj8++wf+lf/H9YDqhv1NWHDPky0ihL7o5N6axYfAer4+Dk/Bm6hJwDuk4NtYCYYVFyud8tXvARzxiv+Wt+pQGqUaeqvAAP7/6d8AZst37df89D3s9SbREu/4hX9ruSWnfaZCbTHpwXWf3MxC79+07G+5rCPZvKqhZiEO8C79bmj/yqwiV1Td6Z/c4F0GF3g7KHVLUoi7b034L6O+DfXMyWIuj/dq2NdlmZ4jzrppodg1Vd/UdpQvDqcge+LINF51+CJYgQm1hg8fsbwRP+6Z/TFRNugn2O0CXAA5coc7jewgesuDEGlhfUtr4fSPqJ7lM47CHPcs0HYKznRJAU8/SjYPnbP1vcrr2iztY/RVRCgy/gFyPs1Fxg6V4LTAzyqOXqOgZsvoaptTn/EIYKTBdgEWu6vgBiEI369s4GqNdcFbX5tURQMZ/xKnlI9P60KZRl7d/mg7/47fucuAMTjTS1uRxiFdfFh97jPKn//0yN2h6kitjAyXfL66vSqI/3C5lptqGwKWb0nzUgANPAx/vVQR4Dh5FqX7JyLMSzCr8t3gO5eZNR0wyFAKUpRj8tc2u15qw3q4pe0THfxhUUAAyV4e+s6g/ElFjoReN3cwbjlXnnVwK2/aihMFQKFsRnKe4VpAl0SqAfhYLW/PLbPue7oLcfMBXmlei2Em+ur1gwDtDLGHQwumec8sFIijwQAfjGpyRw8hQXaCeZqtDOQS28EMYJt3mIAN9N/ey2MsEX6+OpMHgAaOe/LcVGkaGnV4+VtSEoIcCrGamD7J9kbOIjmwkQsBqkohSBb2wAXnvhsNpRu7/R42vV0OuTqV3BxiWvC8bNI7gvdHZXaAB/WXfiHBjhhERxSnVPvx2zn4URFuMVxp2wHAdjHTcdO9aqhPj83H8LMWwis9NAlbupRwvjavMVB5eHIWi3OyUdyBmFpUAyMaaFoFwWfoe0dpMq8wBWzMt0IBfcEm8wx1ArXgHryqmQShGz2laHwfLbROeqDmMT5ZvD4h56a7HXx7tKU/726Kfr8WTTJ6byvXP8NsAAA=";
/* Die Raid-Bilder der Weeklies (WK_BOSS_BILD, 60-weeklies-bilder.ts) stehen
   hier unter wk:<schluessel> - dasselbe Bild, nicht noch einmal abgelegt. */
const BOSS_ICON_BILD: Record<string, string> = {
  ...SPIEL_BOSSBILD,
  ...Object.fromEntries(Object.entries(WK_BOSS_BILD).map(([k, v]) => ["wk:" + k, v])),
  "boro:boss": EIGENE_BOSSMARKE,
};
const BOSS_ICON: Record<string, string> = {
  /* Vegamor, am 22.09.2026 gemeldet: ein Kampf aus drei
     Gegnern. Jeder Kern traegt sein eigenes Bild. Das Ganze traegt seit
     01.10. das NPC-Bild des Geisterbaums (gewuenscht), und so auch Vagamont
     (Vegamor unter seinem inneren Namen) und die Klaue, die kein eigenes
     Bild hat (Log vom 29.09.). */
  "vegamor":"PT_NPC_M_Vagamont_Sprite",
  "vegarus":"PT_NPC_M_Vagamont_Core_Sprite",
  "vegarion":"PT_NPC_M_Vagamont_SubCore_Sprite",
  "vegaorb":"PT_NPC_M_Vagamont_EliteCore_Sprite",
  "vagamont":"PT_NPC_M_Vagamont_Sprite",
  "vegamor's claw":"PT_NPC_M_Vagamont_Sprite",
  "vegamors klaue":"PT_NPC_M_Vagamont_Sprite",
  /* Die Uebungspuppe in beiden Clients (PRACTICE_TARGETS in 06); die
     Statue fuer das Training ist keine Puppe und bleibt ohne Bild. Das
     Symbol (Flaticon) steht wie die Spielbilder in assets/spielbilder.ts,
     nicht im oeffentlichen Quelltext; Bedingungen: licenses/README.md. */
  "practice dummy":"fremd:target-practice",
  "\u00fcbungspuppe":"fremd:target-practice",
  "adentus":"PT_NPC_M_Bugbear_Warder_Sprite",
  "aelon der gro\u00dfe":"PT_NPC_M_SpiritTree_Guardian_Sprite",
  "ahzreil":"PT_NPC_M_Elder_Kaspar",
  "akman":"PT_NPC_M_Manticus_ArcmanDecman",
  "aridus":"PT_NPC_M_Elder_Balthasar",
  /* Die Raid-Bosse tragen die Bilder der Weekly-Fluegel; Vulkan das von
     Zairos, mit dem er kaempft (so gewuenscht, 04.10.2026). */
  "calanthia":"wk:altar",
  "chernobog":"PT_NPC_M_Basilisk_Darkness_Sprite",
  "cornelius":"PT_NPC_M_LivingArmor_Cornelus",
  "daigon":"PT_NPC_M_FishMan_Dagon_Sprite",
  "deckman":"PT_NPC_M_Manticus_ArcmanDecman",
  "deluzhnoa":"PT_NPC_M_WaterSpirit_DelugeNoah_Sprite",
  "deus chimaerus":"foto:deus-chimaerus",
  "dragaryle":"wk:zitadelle",
  "duke magna":"foto:duke-magna",
  "excavator-9":"PT_NPC_M_Golem_KingMineBoom",
  "exodus":"foto:exodus",
  "fellinex":"foto:fellinex",
  "gaitan":"foto:gaitan",
  "gaudian":"foto:gaudian",
  "giant cordy":"PT_NPC_M_ElderWoodGiantBroork_Sprite",
  "grand aelon":"PT_NPC_M_SpiritTree_Guardian_Sprite",
  "grauauge":"PT_NPC_M_LesserDemon_Junoboat",
  "grayeye":"PT_NPC_M_LesserDemon_Junoboat",
  "grimturg":"PT_NPC_M_LichOrc_Grimthurgh_Sprite",
  "haylock":"foto:haylock",
  "heliber":"PT_NPC_M_Death_Bringer",
  "junobote":"PT_NPC_M_LesserDemon_Junoboat",
  "kaiser crimson":"foto:kaiser-crimson",
  "kaligras":"foto:kaligras",
  "karnix":"PT_NPC_M_Death_Bringer",
  "kayser":"foto:kaiser-crimson",
  "kertaki":"PT_NPC_M_Lizardman_DoubleKey",
  "king chimaerus":"foto:king-chimaerus",
  "king khanzaizin":"PT_NPC_M_Ogre_KingKanzeisin_Sprite",
  "kowazan":"PT_NPC_M_Smuggler_Leader",
  "k\u00f6nig chim\u00e4rus":"foto:king-chimaerus",
  "k\u00f6nig khanzaizin":"PT_NPC_M_Ogre_KingKanzeisin_Sprite",
  "k\u00f6nigin bellandir":"PT_NPC_M_Centipede_AncientSandwormson_Sprite",
  "k\u00f6nigsbagger-9":"PT_NPC_M_Golem_KingMineBoom",
  "lacune":"PT_NPC_M_GiantAnt_Erzabe",
  "lequirus":"foto:lequirus",
  "leviathan":"PT_NPC_M_MudShark_Leviathan",
  "limuny bercant":"foto:limuny-bercant",
  "lucien":"PT_NPC_M_Death_Bringer",
  "lyxara":"PT_NPC_M_GiantAnt_Erzabe",
  "magna-f\u00fcrst":"foto:duke-magna",
  "malakar":"PT_NPC_M_EvilEye_Surveilant",
  "manticus":"PT_NPC_M_Manticus_ArcmanDecman",
  "marta":"foto:marta",
  "minezerok":"foto:minezerok",
  "minezrok":"foto:minezerok",
  "morokai":"PT_NPC_M_Elder_Morkus",
  "nerzatum":"foto:nerzatum",
  "nirma":"PT_NPC_M_Elder_Sema",
  "norn bercant":"foto:norn-bercant",
  "pakilo naru":"PT_NPC_M_BlackDwarf_PakiloNaru_Sprite",
  "porfos":"PT_NPC_M_Elder_Melchior_Sprite",
  "queen bellandir":"PT_NPC_M_Centipede_AncientSandwormson_Sprite",
  "quente, executor of the seal":"PT_NPC_M_Harshcrow_Leader_Sprite",
  "quente, vollstrecker des siegels":"PT_NPC_M_Harshcrow_Leader_Sprite",
  "radeth":"wk:radeth",
  "ramus":"PT_NPC_M_DragonRider_Artirat_Ramus_Sprite",
  "ramux":"PT_NPC_M_DragonRider_Artirat_Ramus_Sprite",
  "rex chim\u00e4rus":"PT_NPC_M_Chimera_KimerKing_Sprite",
  "rex chimaerus":"PT_NPC_M_Chimera_KimerKing_Sprite",
  "riese cordy":"PT_NPC_M_ElderWoodGiantBroork_Sprite",
  "shaikal":"foto:shaikal",
  "shakarux":"foto:shakarux",
  "silent gatekeeper vahelon":"PT_NPC_M_Harshcrow_AncientBerserker_Sprite",
  "sintflutbringerin":"PT_NPC_M_WaterSpirit_DelugeNoah_Sprite",
  "stiller torw\u00e4chter vahelon":"PT_NPC_M_Harshcrow_AncientBerserker_Sprite",
  "tallus":"PT_NPC_M_Golem_Talus",
  "talus":"PT_NPC_M_Golem_Talus",
  "tevent":"PT_NPC_M_Skeleton_Tevent",
  "thuban":"PT_NPC_M_Gorilla_Thuban_Sprite",
  "toublek":"PT_NPC_M_Lizardman_DoubleKey",
  "turka":"foto:turka",
  "velentra":"PT_NPC_M_Imp_Spearman",
  "verence":"foto:verence",
  "vulcanus":"foto:vulcanus",
  "vulkan":"wk:korridor",
  "zairos":"wk:korridor"
};
/* Der Name im Log traegt den Rang vorn ("Aufgestiegener") und den
   Zustand hinten ("[Untot]"); beides streift bareBoss() ab, und
   uebrig bleibt der Name, unter dem der Boss hier steht. Zwei
   Bosse in einem Kampf werden mit einem Mittelpunkt verbunden -
   dann zaehlt der erste. Eine Form ("Calanthia of Destruction") fuehrt
   ueber formBoss() auf ihren Boss zurueck; eine Phase wie Fellini nicht,
   denn allein ist sie Trash (Issue #104) und bekommt kein Bild. */
export function bossIcon(name: string | null | undefined){
  const roh = String(name || "").split("\u00b7")[0]!.trim();
  let k = BOSS_ICON[bareBoss(roh).toLowerCase()];
  if(!k && typeof formBoss === "function"){
    const p = formBoss(roh);
    if(p) k = BOSS_ICON[bareBoss(p).toLowerCase()];
  }
  if(!k) return null;
  return "data:image/webp;base64," + (BOSS_ICON_BILD[k] ?? EIGENE_BOSSMARKE);
}
/* Nichts fuer einen Gegner, der kein Boss ist - ein Trashmob bekommt
   kein Bild und keine leere Platte, sonst stuende die halbe Liste
   unter einer Spalte, die nur bei jeder dritten Zeile etwas zeigt. */
export function bossMark(name: string | null | undefined, klasse?: string, farbe?: string){
  const u = bossIcon(name);
  if(!u) return "";
  /* In einer Tabellenzeile traegt das Portraet die Fassung eines
     Skillsymbols - gleiche Groesse, gleicher Ring in der Reihenfolgefarbe.
     Sonst haette dieselbe Spalte zwei Massen. */
  const stil = farbe ? ' style="--sic-c:' + farbe + '"' : "";
  return '<img class="' + (klasse || "bic") + '" src="' + u +
         '" alt="" aria-hidden="true"' + stil + ">";
}
/* Die zwei Waffen eines Gruppenmitglieds als Marke. Feste Breite, auch
   wenn nichts gemeldet wurde: sonst faengt der Name in jeder zweiten
   Zeile woanders an. */
export function weaponPairMark(weapons: string[] | undefined){
  const echte = [...new Set<string>(weapons || [])]
    .filter(w => w !== "Passive" && w !== "Unassigned" && WEAPON_ICON[w]);
  return '<span class="wpair" aria-hidden="true">' +
         echte.slice(0, 2).map(weaponMark).join("") + "</span>";
}
export function skillIcon(name: string, sid?: string | null){
  if(sid && SKILL_ICON_SID[sid]){
    const b0 = SKILL_ICON_BILD[SKILL_ICON_SID[sid]];
    if(b0) return "data:image/webp;base64," + b0;
  }
  const e = sid ? SKILL_ID_NAME[sid] : null;
  const datei = SKILL_ICON_NAME[name] ||
                (e && e.en && SKILL_ICON_NAME[e.en]) ||
                (e && e.de && SKILL_ICON_NAME[e.de]);
  if(!datei) return null;
  const b = SKILL_ICON_BILD[datei];
  return b ? "data:image/webp;base64," + b : null;
}
