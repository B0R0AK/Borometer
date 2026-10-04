import { WK_BOSS_BILD as BOSS, WK_GEGENSTAND_BILD as GEGENSTAND } from "../spielbilder";
/* ---------- Weeklies: die Bilder (Neugestaltung "Wochenband", Spezifikation Weeklies 9, 01.10.2026) ----------
   Eingebettet, die Seite laedt nichts nach. Kein Teil hier fragt etwas ab;
   59-weeklies.ts legt die Bilder einmal als Stilblatt an (wkBilderCss) und
   setzt sie ueber Klassen (wkb-<schluessel>), damit das Zeichnen kleine
   Zeichenketten vergleicht.

   Bossbilder der Raid-Fluegel (96 x 96 WebP, rund gezeigt mit 36 bis 48 Punkt):
   eigene Bildschirmfotos aus dem Spiel vom 01.10.2026 - Dragaryle
   (Die vergessene Zitadelle), Zairos (Der Korridor der Pein), Calanthia
   (Der Altar der Wiedergeburt); quadratisch ausgeschnitten und verkleinert.
   Dazu Radeth aus einem eigenen Bildschirmfoto vom 02.10.2026, ebenso
   geschnitten; er ist kein Fluegel, nur die Rekorde (62-rekorde.ts) zeigen ihn.

   Gegenstandssymbole der Haendler-Punkte (48 x 48 WebP, gezeigt mit 26
   Punkt): einmal von cdn.questlog.gg geladen (01.10.2026), Pfad unter
   https://cdn.questlog.gg/throne-and-liberty/assets/ und die ID des
   Gegenstands stehen ueber jedem Eintrag in assets/spielbilder.ts (privat,
   nur im Release-Build; im oeffentlichen Quelltext leer). Namen von questlog stehen hier
   nicht (Nutzungsbedingungen 3.4), die Anzeige kommt aus 07-dictionary.ts.

   Ohne Bild bei questlog: Halle der Illusionen, Portal der Unendlichkeit,
   Regionsbeitragszertifikat - sie tragen eigene gezeichnete Marken
   (WK_MARKE), Strich 1,6 wie die Symbolleiste, ein Goldpunkt (--acc);
   eigene Punkte eine schlichte Raute. Kein Spielsymbol ist nachgeahmt.
   Herkunft und Bedingungen: licenses/README.md. Zusammen 36.8 kB; seit
   Spezifikation 10 (01.10.2026) acht weitere Gegenstaende von questlog,
   darunter die goldene Truhe der Dimensionspruefung, zusammen 15.8 kB. */

const svg = (innen: string) => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + innen + "</svg>";
/** Die eigenen Marken, wo es kein Bild gibt (Entwurf 01.10.2026). */
export const WK_MARKE: Record<string, string> = {
  illusionen: svg('<ellipse cx="12" cy="10.5" rx="6" ry="7.5"/><path d="M12 18v3M8.5 21h7"/><path d="M10.6 7.5l-2 3 2 3"/><path d="M13.4 7.5l2 3-2 3" stroke-dasharray="1.4 1.6"/><circle cx="12" cy="10.5" r="1.2" fill="var(--acc)" stroke="none"/>'),
  unendlichkeit: svg('<circle cx="12" cy="12" r="8.6"/><path d="M12 12c-1.2-1.6-2.3-2.4-3.3-2.4a2.4 2.4 0 0 0 0 4.8c1 0 2.1-.8 3.3-2.4s2.3-2.4 3.3-2.4a2.4 2.4 0 0 1 0 4.8c-1 0-2.1-.8-3.3-2.4z"/><circle cx="12" cy="3.4" r="1.3" fill="var(--acc)" stroke="none"/>'),
  regionszertifikat: svg('<path d="M6 3.5h8.5L18 7v13.5H6z"/><path d="M14.5 3.5V7H18"/><path d="M8.5 10h7M8.5 13h4.5"/><circle cx="14.6" cy="17.2" r="2.2" fill="var(--acc)" stroke="none"/>'),
  // Dungeons der Dimensionspruefung: ein Torbogen mit einem Riss darin (Spezifikation 10)
  dimensionDungeons: svg('<path d="M5.5 20.5V11a6.5 6.5 0 0 1 13 0v9.5"/><path d="M3.5 20.5h17"/><path d="M12.6 7.6l-2.2 3.6 2.6 1.4-1.8 3.4"/><circle cx="16.2" cy="17.4" r="1.7" fill="var(--acc)" stroke="none"/>'),
  eigen: svg('<path d="M12 4.5l7.5 7.5-7.5 7.5L4.5 12z"/><circle cx="12" cy="12" r="1.6" fill="var(--acc)" stroke="none"/>'),
};

/** Der Buchstabe der Platte, wo kein Bild da ist (Fluegelkopf): der Anfang des Namens nach einem fuehrenden
    Artikel (der, die, das; the), gross - sonst truegen alle drei Fluegel dasselbe "D" bzw. "T". */
export const wkAnfang = (name: string): string => (Array.from(name.trim().replace(/^(?:der|die|das|the)\s+/i, ""))[0] ?? "").toUpperCase();

/* Derselbe Gegenstand bei einem zweiten Haendler (eigener Schluessel, eigenes Limit) traegt dasselbe Bild. */
const GLEICH: Record<string, string> = {
  widerstandHeroischFreischalt: "heroischFreischalt", widerstandFreischaltFragment: "freischaltFragment", raidChaosprisma: "chaosprisma",
};

// das Portal der Unendlichkeit hat zwei Rotationen (Do-Do und Mo-Mo, Spezifikation 10), eine Marke
WK_MARKE.unendlichkeitMontag = WK_MARKE.unendlichkeit!;

/** Traegt der Schluessel (Fluegel oder Punkt) ein Bild? Ein Alias nur, wenn sein Ziel eines traegt. */
export const wkHatBild = (k: string): boolean => Object.hasOwn(BOSS, k) || Object.hasOwn(GEGENSTAND, k)
  || (Object.hasOwn(GLEICH, k) && wkHatBild(GLEICH[k]!));

/** Das Stilblatt mit allen Bildern, einmal angelegt von 59-weeklies.ts; jedes Bild steht nur einmal darin. */
export function wkBilderCss(): string {
  return Object.entries({...BOSS, ...GEGENSTAND}).map(([k, d]) => [k, ...Object.keys(GLEICH).filter(g => GLEICH[g] === k)].map(x => ".wkb-" + x).join(",") +
    "{background-image:url(data:image/webp;base64," + d + ")}").join("\n");
}
