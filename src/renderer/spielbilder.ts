/* ---------- Spielbilder (leer) ----------
   Bilder aus dem Spiel, von questlog.gg und von Flaticon stehen nicht im
   Quelltext (Spezifikation oeffentliches Repo, 4). Beim Bauen setzt
   scripts/build-renderer.mjs statt dieser Datei assets/spielbilder.ts ein,
   wenn es sie gibt: privat liegt sie im Repo, oeffentlich holt sie nur der
   Release-Build aus dem Asset-Repo. Ohne sie zeigt die Seite ihre gezeichneten
   Marken. Dieselben Tabellen, dieselbe Form - der Build und das Audit pruefen
   das. Nur Daten: keine Zeile hier ausser leeren Tabellen. */
export const SKILL_ICON_BILD: Record<string, string> = {};
export const KERN_BILD: Record<string, string> = {};
export const BOSS_ICON_BILD: Record<string, string> = {};
export const WK_BOSS_BILD: Record<string, string> = {};
export const WK_GEGENSTAND_BILD: Record<string, string> = {};
