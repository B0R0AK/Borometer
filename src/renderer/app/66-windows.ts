import { state } from "./01-state";
import { fmt } from "./03-helpers";
import { t } from "./08-translation";
import { $ } from "./18-interface-basics";
import { kampfKurz } from "./20-meter-head";
import { oeffneDateien } from "./23-kampfwahl";
import { persistPref } from "./27-weapons-tab";
import { histVerdict } from "./32-history";
import { winPost } from "./37-window-size-and-overlay";
import { KOMPAKT_FENSTER, OWN_WINDOW, SERVED } from "./41-server-mode";
import { isWatching } from "./45-startup";
import { waereBest } from "./46-best-pull";
import type { Fight } from "../types";

/* ---------- Windows-Einbindung (Spezifikation 04.10.2026) ----------
   Die Meldung nach dem Kampf (3.1, 3.2): die Seite schneidet den Kampf
   ohnehin und kennt alles fuer den Text. Ein Kampf ist fuer die Meldung
   beendet, wenn er so lange nicht waechst, wie "Trennen nach" sagt - auf
   der Wanduhr, nicht auf der Uhr des Logs - oder wenn ein neuerer beginnt.
   Am besten Pull aendert das nichts (der zaehlt den neuesten erst, wenn ein
   neuerer kommt). Gemeldet wird nur, was waehrend des Mitlesens gewachsen
   ist: der Stand beim Einschalten von Live ist alt. Der Hauptprozess
   entscheidet nach den Schaltern, ob Windows es zeigt (notify.ts).
   Dazu der Startauftrag aus der Sprungliste (5.1), die Sprache fuer die
   Texte des Hauptprozesses (8) und "Zuletzt gelesen" (POST /api/gelesen). */

/* Die Beginne gemeldeter Kaempfe, mit der Datei zurueckgesetzt. */
const gemeldet = new Set<number>();
/* Der neueste Kampf, wie die Wache ihn zuletzt sah: Beginn, Zahl der
   Ereignisse, Wanduhr des letzten Wachstums, Datei, und ob er seit dem
   Einschalten gewachsen ist (nur dann wird er gemeldet). */
let wache: { start: number; n: number; seit: number; datei: string; neu: boolean } | null = null;

function darf(): boolean {
  return SERVED && OWN_WINDOW && !KOMPAKT_FENSTER && isWatching() && state.origin === "watch";
}

/** Prueft den neuesten Kampf; aus jedem Live-Takt (41) und dem Sekundentakt (wacheStarten). */
export function kampfWache(jetzt = Date.now()): void {
  if(!darf()){ wache = null; return; }
  const datei = (state.fileNames || []).join("|");
  if(wache && wache.datei !== datei){ gemeldet.clear(); wache = null; }
  /* encounters[0] ist der neueste Kampf (05-fights.ts sortiert nach Beginn,
     neuester zuerst). Stehen nur Kaempfe unter der Mindestdauer da (sie
     werden dann ersatzweise gezeigt), fuehrt die Seite keinen als Kampf. */
  const seg = state.minDurDropped ? undefined : state.encounters[0];
  if(!seg) return;
  if(wache && seg.start > wache.start){
    // ein neuerer Kampf hat begonnen: der vorige ist beendet
    const alt = wache;
    const vorher = alt.neu ? state.encounters.find(x => x.start === alt.start) : undefined;
    if(vorher) melde(vorher);
    wache = {start: seg.start, n: seg.events.length, seit: jetzt, datei, neu: true};
    return;
  }
  /* Der Kopf ist rueckwaerts gesprungen: der neueste Kampf wurde entfernt
     oder neu geschnitten ("Trennen nach", Mindestdauer). Der Kampf, der jetzt
     vorn steht, ist waehrend des Mitlesens nicht gewachsen - wie beim
     Einschalten wird er erst gemeldet, wenn er waechst. */
  if(wache && seg.start < wache.start) wache = null;
  if(!wache){ wache = {start: seg.start, n: seg.events.length, seit: jetzt, datei, neu: false}; return; }
  if(seg.events.length !== wache.n){ wache.n = seg.events.length; wache.seit = jetzt; wache.neu = true; return; }
  if(wache.neu && jetzt - wache.seit >= state.gap * 1000) melde(seg);
}

/** Titel und Satz der Meldung in den Woertern der Seite (3.2), dazu ob es ein neuer Bestwert waere. */
export function meldeText(seg: Fight): { titel: string; satz: string; best: boolean } {
  const s = seg.stats;
  const v = histVerdict(seg);
  const vergleich = v.best ? t("melde.bester")
    : v.p === undefined ? ""
    : v.p > 0 ? t("melde.besser", {p: v.p}) : v.p < 0 ? t("melde.schlechter", {p: -v.p}) : t("melde.gleich");
  const teile = [vergleich, kampfKurz(seg, s)].filter(Boolean);
  return {titel: s.name + " · " + fmt(s.dps), satz: teile.length ? teile.join(" – ") + "." : "", best: waereBest(seg)};
}

function melde(seg: Fight){
  if(gemeldet.has(seg.start)) return;
  gemeldet.add(seg.start);
  const m = meldeText(seg);
  void winPost({do: "kampf", titel: m.titel.slice(0, 120), satz: m.satz.slice(0, 240), best: m.best});
}

/** Der Sekundentakt der Wache, solange die Seite im eigenen Fenster laeuft (3.1). */
export function wacheStarten(){
  if(!SERVED || !OWN_WINDOW || KOMPAKT_FENSTER) return;
  setInterval(() => kampfWache(), 1000);
}

/* Kompakt ist offen: als eigenes Fenster (N4) oder, ohne es, das
   geschrumpfte grosse Fenster. */
const kompaktIstOffen = () => state.zweiFenster ? state.kompaktOffen : document.body.classList.contains("compact");

/* Ein Auftrag aus der Sprungliste (5.1): holen, tun, quittieren. Kommt
   waehrenddessen ein weiterer (Ereignis "start"), wird danach noch einmal
   geholt. Schlaegt etwas fehl, bleibt der Auftrag beim Hauptprozess stehen
   und kommt mit dem naechsten Ereignis oder Neuladen wieder. */
let auftragLaeuft = false, auftragNochmal = false;
export async function startAuftragHolen(): Promise<void> {
  if(!SERVED || !OWN_WINDOW || KOMPAKT_FENSTER) return;
  if(auftragLaeuft){ auftragNochmal = true; return; }
  auftragLaeuft = true;
  try {
    do {
      auftragNochmal = false;
      const s = await (await fetch("/api/state", {signal: AbortSignal.timeout(10000)})).json();
      const a = s && s.start;
      if(!a || typeof a.nr !== "number") continue;
      // "Kompakt oeffnen" oeffnet nur: ist Kompakt schon offen, bleibt es so
      if(a.kompakt && !kompaktIstOffen()) $("#btnCompact").click();
      if(a.live && !isWatching()) $("#btnWatch").click();
      if(a.logordner) fetch("/api/folder/open", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({folder: "game"})}).catch(() => {});
      // wie ein frueherer Tag in der Kampfwahl: der Helfer vergleicht den Namen mit dem Log-Ordner
      if(typeof a.log === "string" && a.log) await oeffneDateien([a.log]);
      await winPost({do: "starterledigt", nr: a.nr});
    } while(auftragNochmal);
  } catch(err) {
    // der Helfer ist gerade weg: beim naechsten Ereignis "start" wieder
  } finally {
    auftragLaeuft = false;
  }
}

/* Ein Log, das die Seite ganz von vorn gelesen hat, fuer "Zuletzt gelesen"
   in der Sprungliste: Live nach dem ganzen Laden (41), ein frueherer Tag oder
   der Auftrag "log" (23). Derselbe Name gleich noch einmal geht nicht hin. */
let zuletztGemeldet = "";
export function gelesenMelden(name: string){
  if(!SERVED || KOMPAKT_FENSTER || !name || name === zuletztGemeldet) return;
  zuletztGemeldet = name;
  fetch("/api/gelesen", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({name})}).catch(() => {});
}

/* Die Sprache fuer die Texte des Hauptprozesses (8). Geschrieben wird nur,
   was von der gespeicherten abweicht: undefined, solange GET /api/config
   nicht da war (dann wird nichts geschrieben), sonst "de", "en" oder null. */
let spracheGespeichert: string | null | undefined;
/** Was GET /api/config als lang brachte (41); danach die Sprache, falls sie abweicht. */
export function spracheGelesen(lang: unknown){
  spracheGespeichert = lang === "de" || lang === "en" ? lang : null;
  spracheMelden();
}
/** Die Sprache fuer die Texte des Hauptprozesses: nach dem Lesen der Einstellungen und bei jedem Wechsel (31). */
export function spracheMelden(){
  if(!OWN_WINDOW || KOMPAKT_FENSTER || spracheGespeichert === undefined) return;
  const l = state.lang === "de" ? "de" : "en";
  if(l === spracheGespeichert) return;
  spracheGespeichert = l;
  persistPref("lang", l);
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  wacheStarten();
}
