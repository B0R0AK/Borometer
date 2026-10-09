/* ============================================================
   Ledger — Throne and Liberty combat log analyzer
   Reads the Detailed Combat Log the game writes to disk.
   No network, no storage, no contact with the game process.
   ============================================================ */

import { cssv } from "./18-interface-basics";
import type { AppState, ErrorLogEntry } from "../types";

export const ROLES = ["ignore","time","event","skill","skillId","damage","crit","heavy","hitType","source","target"];
/* Series colours, ordered by damage rank — every caller sorts descending
   and then takes SERIES[i], so index 0 is always the biggest contributor.

   The row this replaces had twelve colours and was measured: "closest pair
   ΔE 17.0 (CIE76)". That measurement was taken with normal colour vision and
   never repeated under colour blindness, which is where it fell apart. Run
   through the Machado-Oliveira-Fernandes simulation at severity 1.0:

     #eca948 / #c2ae50   rank 1 and 2, ΔE 1.2 under deuteranopia
     #8baa64 / #5faa85   rank 4 and 5, ΔE 5.9 with FULL colour vision

   (OKLab distance ×100 throughout, the scale the thresholds are written on:
   8 for colour blindness, 15 for normal vision.) Rank 1 against rank 2 is
   the worst case there is — the two biggest bands of every stacked chart,
   the same colour for roughly one man in twelve. Measured over 236 fights
   in 88 logs, 233 of the drawn images held a pair under ΔE 3.

   Seven is the ceiling, not a preference. Protanopia and deuteranopia fold
   the red-green axis together; what is left is lightness and blue-yellow,
   and lightness is penned into 0.48–0.67 by the dark surface. Searched over
   a pool of candidates: seven colours hold ΔE 10.8 under simulation and 19.5
   with full vision across EVERY pair, eight or more cannot.

   What survives from the old row: lightness still descends with rank
   (0.74 down to 0.49 in OKLCH), so brightness still reinforces magnitude.
   Rank 1 is no longer gold: a skill carrying most of a fight painted row one
   as a near-full gold band, which is what a selection looks like here, and
   gold means "counts or chosen". It is sky blue now, searched for the
   largest nearest distance to the other eleven, the shield, the gold family
   and --pick (numbers at the token in styles.css). The checks are over
   pairs, so the order still costs nothing.

   What does not survive: "hue is warm through the ranks people actually
   see". Warm hues are exactly what red-green blindness collapses, so the
   warm run through the visible ranks is the thing that broke. A palette can
   be warm or it can be legible to those readers; it cannot be both. */
export const SERIES_N = 12;
/* So viele Faehigkeiten traegt eine Zeile der Gruppentafel. Dieselbe
   Zahl wie SERIES_N, und das ist keine Laune: die Kurve eines Mitglieds
   hat so viele Spuren, und wofuer drueben kein Name ankommt, das faellt
   dort in die Sammelspur. Mit zehn hiess "Alles andere" bei einem
   fremden Kampf Rang elf und hoeher, beim eigenen Rang dreizehn. */
export const PARTY_SKILLS = SERIES_N;
/* Die Werte stehen im Stilblatt, je Thema einer - hier bleibt nur die Anzahl
   und ein Rueckfall fuer den Fall, dass das Token fehlt (eine gespeicherte
   Seite aus einer aelteren Fassung, ein Thema, das jemand von Hand setzt).
   Gemerkt wird die Reihe am Namen des Themas, nicht an ihrem ersten Wert.
   --series-1 ist in Dunkel und in TnL dasselbe #6baffa, Byte fuer Byte. Der
   Wechsel zwischen diesen beiden hat den Speicher deshalb nie verworfen, und
   die Tabelle behielt die Reihe des vorigen Themas - samt der drei Farben,
   fuer die TnL eigene Werte hat. Der erste Wert bleibt im Schluessel, damit
   eine von Hand geaenderte Reihe bei gleichem Thema auffaellt. */
const SERIES_FALLBACK = ["#6baffa","#8e2dc3","#0094c1","#e60012",
                         "#5c5898","#51ac61","#b6007f","#8d7af7",
                         "#447700","#e052ac","#3c4dff","#ac5f66"];
let seriesRowCache: string[] | null = null, seriesRowKey = "";
export function seriesRow(){
  const first = cssv("--series-1");
  if(!first) return SERIES_FALLBACK;
  const key = (document.documentElement.dataset.theme || "") + "|" + first;
  if(seriesRowCache && seriesRowKey === key) return seriesRowCache;
  seriesRowKey = key;
  const row = [first];
  for(let i = 2; i <= SERIES_N; i++) row.push(cssv("--series-"+i) || SERIES_FALLBACK[i-1]!);
  return (seriesRowCache = row);
}

/* Rank thirteen and beyond get no hue at all. Cycling would hand the
   thirteenth skill the first skill's colour, and measured over the corpus
   that lands two rows of a real size in the same colour in 23% of fights.
   A neutral says what is true instead: this one is not one of the twelve the
   chart is tracking. Every surface that can show a rank past twelve carries
   the name beside it.

   Twelve, not seven: a real raid pull has twelve skills, and at seven five of
   its twelve rotation traces were grey hatch — the reason more colour was
   asked for. Where the limit costs something is stated at the tokens.

   Its value comes from the theme, because no single colour serves both: at
   9.6:1 on the dark card it is the only family that clears all seven, and on
   the light card that same colour sits at 1.8:1 and disappears. */
export const seriesColor = (i: number) => i < SERIES_N ? seriesRow()[i]! : cssv("--series-rest");
export const DEAD_TIME = 1.5;      // seconds without a hit that counts as a rotation gap
export const EXCLUDE_RX = /taken|received|incoming|heal|absorb|shield|buff|debuff/i;

/* ---------- what went wrong, kept for the bug report ----------
   Installed before anything else in the script on purpose: an error while the
   app is starting is the one the person filing a report is least able to
   describe, and a handler registered further down would be too late to catch
   it. Capped, and only the message, file and line — no page contents.
   state does not exist yet, so this collects into a plain array and the state
   field points at the same one. */
const ERROR_LOG: ErrorLogEntry[] = [];
const ERROR_CAP = 25;
function noteError(what: unknown, where: string){
  if(ERROR_LOG.length >= ERROR_CAP) return;
  const line = String(what || "").slice(0, 300);
  if(ERROR_LOG.some(e => e.what === line)) return;   // one entry per distinct fault
  ERROR_LOG.push({t: new Date().toISOString(), what: line, where: String(where || "").slice(0, 120)});
}

export const state = {
  errorLog: ERROR_LOG,
  text:"", fileNames:[],
  delim:"auto", headerMode:"auto",
  parsed:null,               // {delim, headers, rows}
  mapping:{},                // role -> column index
  events:[], noTime:false,
  players:[], excludedEvents:new Set(),
  encounters:[], sel:0, cmp:new Set(),
  gap:8, minDur:3, player:"__all",
  sortSkills:{key:"damage",dir:-1}, sortTargets:{key:"damage",dir:-1},
  tab:"skills", einst:false,   // einst: Einstellungen (57-einstellungen.ts)
  weeklies:false,   // Weeklies (Neugestaltung 28.09., Luecke 9.1): ein Ort wie Start
  rekorde:false,    // Rekorde (Spezifikation Rekorde 2a): ein Ort wie die Weeklies
  gilde:false,      // Gilde (Spezifikation Gilde 5, 68-gilde.ts): ein Ort wie die Weeklies
  win:null,         // Windows in den Einstellungen (Windows-Einbindung 9): null, bis /api/config windows bringt
  zeitAuf:false, kurveSkill:""   // Kampf-Tafel (56-tafel.ts)
} as Partial<AppState> as AppState;   // the rest is filled in further down, before the first paint

// package.json's version, written in by the build (1.0.0 shows as 1.0)
export const BORO_VERSION = __BORO_VERSION__;

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  addEventListener("error", e => noteError(e.message, (e.filename || "") + ":" + (e.lineno || 0)));
  addEventListener("unhandledrejection", e => noteError("unhandled promise: " + (e.reason && e.reason.message || e.reason), ""));
}
