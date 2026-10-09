// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Die Klassentabelle als reiner Kern: ohne Seite, ohne Zustand, ohne Netz.
   Die Seite (app/17-class-names.ts) und die Gilde (gilde-core.ts) lesen
   dieselbe Tabelle. */

export interface Klasse { en: string; de: string; role: "tank" | "dps" | "heal" }

/* Die zehn echten Waffen in der Reihenfolge der App (ohne Passive und
   Unassigned, die keine Waffenwahl sind). */
export const WAFFEN: readonly string[] = ["Greatsword","Sword and Shield","Dagger","Crossbow","Longbow",
                 "Staff","Wand and Tome","Spear","Gauntlet","Orb"];

/* ---------- class names ----------
   Throne and Liberty's build "classes" are community names for a pair of
   equipped weapons, not something the game or the log states directly.
   Confirmed against a player's list. The original list had Greatsword &
   Sword and Shield claimed by both "Crusader" and "Paladin" — turned out
   to be a mix-up, not a real conflict: Paladin is actually Greatsword &
   Wand and Tome (the one pair missing from the first pass), Crusader is
   Greatsword & Sword and Shield, and Templar (Sword and Shield & Wand and
   Tome) was already correct and unaffected. All 45 possible pairs from
   the 10 weapons are confirmed now. */
/* The 45 builds the game names, each keyed by its pair of weapons sorted so
   the order they are equipped in does not matter. German names and the role
   come from the game's own class list: a German client calls Scout Späher, and
   the table used to hand that player the English name. */
export const CLASS_NAMES: Record<string, Klasse> = {
  // Tank
  "Dagger|Sword and Shield":        {en:"Berserker", de:"Berserker", role:"tank"},
  "Greatsword|Sword and Shield":    {en:"Crusader", de:"Kreuzritter", role:"tank"},
  "Staff|Sword and Shield":         {en:"Disciple", de:"Jünger", role:"tank"},
  "Orb|Sword and Shield":           {en:"Guardian", de:"Beschützer", role:"tank"},
  "Gauntlet|Sword and Shield":      {en:"Juggernaut", de:"Juggernaut", role:"tank"},
  "Greatsword|Orb":                 {en:"Justicar", de:"Justikar", role:"tank"},
  "Gauntlet|Greatsword":            {en:"Mauler", de:"Mauler", role:"tank"},
  "Crossbow|Sword and Shield":      {en:"Raider", de:"Plünderer", role:"tank"},
  "Gauntlet|Orb":                   {en:"Soulcrusher", de:"Soulcrusher", role:"tank"},
  "Spear|Sword and Shield":         {en:"Steelheart", de:"Stahlherz", role:"tank"},
  "Sword and Shield|Wand and Tome": {en:"Templar", de:"Templer", role:"tank"},
  "Longbow|Sword and Shield":       {en:"Warden", de:"Hüter", role:"tank"},
  // DPS
  "Gauntlet|Staff":                 {en:"Archon", de:"Archon", role:"dps"},
  "Crossbow|Staff":                 {en:"Battleweaver", de:"Kampfweber", role:"dps"},
  "Crossbow|Spear":                 {en:"Cavalier", de:"Kavalier", role:"dps"},
  "Crossbow|Orb":                   {en:"Crucifix", de:"Kruzifix", role:"dps"},
  "Gauntlet|Spear":                 {en:"Destroyer", de:"Destroyer", role:"dps"},
  "Orb|Staff":                      {en:"Enigma", de:"Enigma", role:"dps"},
  "Spear|Staff":                    {en:"Eradicator", de:"Ausrotter", role:"dps"},
  "Greatsword|Spear":               {en:"Gladiator", de:"Gladiator", role:"dps"},
  "Longbow|Spear":                  {en:"Impaler", de:"Aufspießer", role:"dps"},
  "Dagger|Longbow":                 {en:"Infiltrator", de:"Infiltrator", role:"dps"},
  "Longbow|Staff":                  {en:"Liberator", de:"Befreier", role:"dps"},
  "Dagger|Orb":                     {en:"Lunarch", de:"Lunarch", role:"dps"},
  "Gauntlet|Longbow":               {en:"Mobilist", de:"Mobilist", role:"dps"},
  "Crossbow|Greatsword":            {en:"Outrider", de:"Vorreiter", role:"dps"},
  "Orb|Spear":                      {en:"Polaris", de:"Polaris", role:"dps"},
  "Dagger|Gauntlet":                {en:"Predator", de:"Predator", role:"dps"},
  "Greatsword|Longbow":             {en:"Ranger", de:"Waldläufer", role:"dps"},
  "Dagger|Greatsword":              {en:"Ravager", de:"Verwüster", role:"dps"},
  "Crossbow|Dagger":                {en:"Scorpion", de:"Skorpion", role:"dps"},
  "Crossbow|Longbow":               {en:"Scout", de:"Späher", role:"dps"},
  "Longbow|Orb":                    {en:"Scryer", de:"Seher", role:"dps"},
  "Greatsword|Staff":               {en:"Sentinel", de:"Wächter", role:"dps"},
  "Dagger|Spear":                   {en:"Shadowdancer", de:"Schattentänzer", role:"dps"},
  "Crossbow|Gauntlet":              {en:"Shrike", de:"Shrike", role:"dps"},
  "Dagger|Staff":                   {en:"Spellblade", de:"Zauberklingen", role:"dps"},
  // Healer
  "Dagger|Wand and Tome":           {en:"Darkblighter", de:"Dunkelpeitscher", role:"heal"},
  "Crossbow|Wand and Tome":         {en:"Fury", de:"Furie", role:"heal"},
  "Staff|Wand and Tome":            {en:"Invocator", de:"Beschwörer", role:"heal"},
  "Orb|Wand and Tome":              {en:"Oracle", de:"Orakel", role:"heal"},
  "Greatsword|Wand and Tome":       {en:"Paladin", de:"Paladin", role:"heal"},
  "Longbow|Wand and Tome":          {en:"Seeker", de:"Sucher", role:"heal"},
  "Gauntlet|Wand and Tome":         {en:"Tormentor", de:"Tormentor", role:"heal"},
  "Spear|Wand and Tome":            {en:"Voidlance", de:"Leerenlanze", role:"heal"},
};

/* Genau zwei verschiedene echte Waffen, Reihenfolge egal; sonst keine Klasse. */
export function klasseVon(waffen: readonly string[]): Klasse | null {
  const echt = [...new Set(waffen)].filter(w => w !== "Passive" && w !== "Unassigned");
  if(echt.length !== 2) return null;
  return CLASS_NAMES[echt.slice().sort().join("|")] || null;
}
