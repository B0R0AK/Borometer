import { state } from "./01-state";
import { toast, toastFail } from "./03-helpers";
import { buildEvents } from "./04-log-parsing";
import { segment } from "./05-fights";
import { t, tt } from "./08-translation";
import { summarise } from "./16-fight-analysis";
import { noteVentius } from "./17-class-names";
import { $ } from "./18-interface-basics";
import {
  groupRows, inGruppenLog, partyBossFights, partyGroupRows
} from "./19-grouping-and-party-fights";
import { renderHead } from "./20-meter-head";
import { renderBars } from "./21-damage-table";
import { kampfwahlOffen, kampfwahlSchliessen, ungelesenLesen } from "./23-kampfwahl";
import { uiZoomFactor } from "./37-window-size-and-overlay";
import { renderRotation } from "./25-rotation";
import { renderAnalysis } from "./26-analysis-tab";
import { persistConfig, persistPref, renderWeapons } from "./27-weapons-tab";
import { renderCompare } from "./28-compare";
import { renderSetup } from "./29-log-setup";
import { renderFights, renderRuns } from "./30-fight-list";
import { loadText, refreshPlayers, renderAll, renderHistory, setLoadOrigin } from "./32-history";
import { readFiles } from "./33-input";
import { download, ladeGruppenLog } from "./35-party-log-files";
import { askPick, askText, openModal } from "./36-dialog";
import { SERVED } from "./41-server-mode";
import { renderParty, syncPartyPill } from "./42-party";
import { syncTabs, toggleMore } from "./43-more-menu-and-dev-mode";
import { renderBuilds } from "./51-plan";
import { isWatching, liveSay, setWatching } from "./45-startup";
import { syncTafel } from "./56-tafel";
import { syncFelder } from "./58-felder";
import { einstNachfuehren, einstOben } from "./57-einstellungen";
import { runPartsOk } from "../best-pull-core";
import type { BoardRow, FolderListing, PartyLogFile, PartyView, SavedRun } from "../types";

/* ---------- es steht immer nur eines offen ----------
   Beide Oeffner rufen stopPropagation(), damit ihr eigener Klick nicht
   sofort vom Aussenklick-Schliesser am Dokument wieder eingefangen wird.
   Genau das hindert aber den Schliesser des ANDEREN Fensters daran zu
   laufen: das Menue hinter "Logs oeffnen" blieb stehen, wenn man danach
   auf ⋯ klickte, und die beiden standen uebereinander.

   Jeder Oeffner schliesst deshalb die anderen selbst. Die Liste steht an
   einer Stelle, damit ein drittes Klappfenster spaeter einen Eintrag
   braucht und nicht zwei neue Sonderfaelle. toggleMore steht weiter
   unten in der Datei - eine Funktionsdeklaration wird hochgezogen, und
   gerufen wird sie ohnehin erst beim Klick. */
const KOPFFENSTER = [
  {id:"open", offen: () => state.openMenuOpen, zu: () => toggleOpenMenu(false)},
  {id:"more", offen: () => state.moreOpen,     zu: () => toggleMore(false)},
  // die Kampfwahl (Instrumententafel 3.2): ⋯ und "Logs oeffnen" schliessen sie
  {id:"kampf", offen: kampfwahlOffen, zu: () => kampfwahlSchliessen(false)},
];
export function schliesseAndereKopffenster(ausser: string){
  for(const f of KOPFFENSTER) if(f.id !== ausser && f.offen()) f.zu();
}

function toggleOpenMenu(open?: boolean){
  state.openMenuOpen = open === undefined ? !state.openMenuOpen : open;
  const p = $("#openPanel");
  // wie beim ⋯-Menue: Fokus zurueck an den Knopf, sonst faellt er auf <body>
  const held = !state.openMenuOpen && p.contains(document.activeElement);
  p.hidden = !state.openMenuOpen;
  if(held) $("#btnOpen").focus({preventScroll:true});
  $("#btnOpen").setAttribute("aria-expanded", state.openMenuOpen ? "true" : "false");
}

let dragDepth = 0;

/* folder watching — picks up each new log as the game writes it */
const watch: { dir: FileSystemDirectoryHandle | null; timer: ReturnType<typeof setInterval> | null;
  name: string; size: number; waehlt: boolean } = {dir:null, timer:null, name:"", size:-1, waehlt:false};
async function startWatch(){
  if(!window.showDirectoryPicker){
    toastFail(tt("toast.watchNeedsChrome"), 6000);
    return;
  }
  let dir: FileSystemDirectoryHandle;
  watch.waehlt = true;
  try{ dir = await window.showDirectoryPicker({mode:"read"}); }
  catch(err){ return; }
  finally{ watch.waehlt = false; }
  clearInterval(watch.timer ?? undefined);
  watch.dir = dir; watch.name = ""; watch.size = -1;
  liveSay(() => t("top.watching"));
  await sweep();
  if(watch.dir !== dir) return;   // in der Zwischenzeit beendet
  watch.timer = setInterval(sweep, 2500);
}
/* Beenden gab es bisher nicht: einmal gestartet, lief die Beobachtung bis
   zum Neuladen, und der Knopf daneben konnte sie nur noch einmal starten.
   Ein Umschalter, der nicht umschaltet, luegt mit aria-pressed. Beenden
   heisst hier nur: nicht mehr nachsehen. Was geladen ist, bleibt stehen. */
function stopWatch(){
  clearInterval(watch.timer ?? undefined);
  watch.timer = null; watch.dir = null; watch.name = ""; watch.size = -1;
  setWatching(false);
  liveSay(() => t("top.notWatching"));
}
/* Der Zustand "startet" (Branch-Review Critique 2): solange der Ordnerwaehler
   offen ist, oeffnete ein zweiter Klick einen zweiten, und der erste
   Durchlauf lief noch ohne body.watching - also galt der Knopf als aus und
   startete von vorn. Jetzt: waehrend der Waehler offen ist, tut ein Klick
   nichts; ist ein Ordner gewaehlt (watch.dir), beendet er, auch wenn der
   erste Durchlauf noch liest - sweep() sieht danach nach und laesst los. */
const toggleWatch = () => {
  if(watch.waehlt) return;
  (isWatching() || watch.dir) ? stopWatch() : void startWatch();
};
async function sweep(){
  const dir = watch.dir;
  if(!dir) return;
  try{
    let newest = null;
    for await (const [name, handle] of dir.entries()){
      if(handle.kind !== "file" || !/\.(txt|log|csv)$/i.test(name)) continue;
      const f = await handle.getFile();
      if(!newest || f.lastModified > newest.f.lastModified) newest = {name, f};
    }
    // beendet, waehrend der Ordner gelesen wurde: nichts mehr anfassen
    if(watch.dir !== dir) return;
    /* Auch ein leerer Ordner wird beobachtet - der Knopf stand hier vorher
       auf "an", waehrend body.watching "aus" sagte. */
    if(!newest){ setWatching(true); liveSay(() => t("live.noLogsInFolder")); return; }
    setWatching(true, newest.name);
    if(newest.name === watch.name && newest.f.size === watch.size){ liveSay(newest.name); return; }
    watch.name = newest.name; watch.size = newest.f.size;
    const text = await newest.f.text();
    if(watch.dir !== dir) return;
    setLoadOrigin("watch");
    loadText(text, [newest.name], true);
    liveSay(newest.name);
  }catch(err){
    if(watch.dir !== dir) return;
    /* Der Ordner ist weg oder die Erlaubnis zurueckgenommen. Das beendet die
       Aufzeichnung wirklich (es gibt nichts mehr zu fragen), also steht der
       Umschalter auf "aus" - und die Meldung sagt, warum und wie es weitergeht. */
    stopWatch();
    liveSay(() => t("live.watchingStopped"));
    toastFail(tt("live.stoppedFolder"), 7000);
  }
}

export function setGroup(mode: string){
  state.group = mode;
  /* Wie bei den Reitern: welche Gruppierung die Tabelle gerade zeigt,
     stand nur in der Klasse. */
  [...$("#groupSeg").children as HTMLCollectionOf<HTMLElement>].forEach(c => {
    const an = c.dataset.g === mode;
    c.classList.toggle("on", an);
    c.setAttribute("aria-pressed", an ? "true" : "false");
  });
  state.sortBars = {key:"damage", dir:-1};
  state.expanded.clear();
  renderHead();   // the readout itself is party-aware now, not just the table
  renderBars();
  renderRuns();   // der Leer-Satz der gespeicherten Kaempfe nennt den Knopf je nach Modus
  syncPartyPill();   // keeps the top-bar button's pressed state honest
}
/* Verlauf fehlte in dieser Liste, also lieferte indexOf fuer ihn -1. Beim
   Betreten aus den sechs Reitern links davon galt damit "rueckwaerts" und
   die Flaeche kam von links herein statt von rechts; beim Verlassen in
   dieselben sechs galt "vorwaerts", also wieder die falsche Seite. Nur die
   beiden Schritte zwischen Verlauf und Log-Einrichtung stimmten zufaellig.
   Verlauf sitzt zwischen Vergleich und Log-Einrichtung, die Liste sagt das
   jetzt auch.
   Seit der Bereichsleiste (Instrumententafel 3.3) die Reihenfolge der Leiste von oben nach unten. */
const TAB_ORDER = ["timeline","rotation","analysis","compare","history","party","builds","weapons","setup"];
/* Die zweite Ebene traegt den Namen des Reiters. Sie steht als erstes Kind
   der Tafel, damit die Reihenfolge stimmt, und wird bei jedem Sprachwechsel
   mitgezogen. */
export function syncPanelHeadings(){
  for(const knopf of document.querySelectorAll<HTMLElement>(".tab")){
    const tafel = document.getElementById("p-" + knopf.dataset.tab);
    if(!tafel) continue;
    let h = tafel.querySelector(":scope > h2.vh");
    if(!h){ h = document.createElement("h2"); h.className = "vh"; tafel.insertBefore(h, tafel.firstChild); }
    /* Der Name steht im .vh des Knopfes; die Blase (.btip) und die
       Ungelesen-Pille gehoeren nicht dazu. */
    h.textContent = (knopf.querySelector(".vh")?.textContent || knopf.textContent || "").trim();
  }
}
/* ---------- die Blickstelle der beiden Zeitreiter ----------
   Zoom und Zeitfenster wanderten beim Reiterwechsel schon mit, die
   Scrollposition nicht. Gemerkt wird der Anteil, nicht der Pixelwert:
   die Rotation traegt eine Namensspalte, ist also schmaler, und beide
   zeichnen in ihrer eigenen Breite. Bei 1x gibt es nichts zu scrollen -
   dann ist der Anteil null und nichts passiert. */
let blickAnteil = 0;
function merkeBlick(box: HTMLElement){
  if(!box) return;
  const weit = box.scrollWidth - box.clientWidth;
  if(weit > 1) blickAnteil = Math.max(0, Math.min(1, box.scrollLeft / weit));
}
export function setzeBlick(box: HTMLElement){
  if(!box) return;
  const weit = box.scrollWidth - box.clientWidth;
  if(weit > 1) box.scrollLeft = Math.round(blickAnteil * weit);
}

/* Kampf speichern: der Knopf im Streifen (#btnSaveRun) und sein Zwilling in
   der Kopfzeile der Felder (#bkSpeichern, 58-felder.ts) - ein Weg fuer beide. */
export async function kampfSpeichern(){
  // repurposed for Party: same slot, same muscle memory, the
  // mode-appropriate action — see the Party setup tab for why this isn't
  // two separate buttons competing for the same spot
  if(state.group === "party"){ $("#btnSavePartyLog").click(); return; }
  const seg = state.encounters[state.sel]; if(!seg) return;
  const tag = await askText(t("head.saveAsRun"), t("toast.nameThisRun"), seg.stats.name);
  if(tag === null || !tag.trim()) return;
  state.runs.unshift(summarise(seg, tag.trim()));
  persistConfig();
  renderRuns(); toast(tt("toast.savedTickTwo"));
}

export function switchTab(name: string, scrolled?: boolean){
  /* Start ist kein Reiter, sondern die Startseite, auch mit geladenem Log
     (Instrumententafel 3.3). Der Bereich darunter bleibt in state.tab; ein
     Klick auf einen Bereich oder ein Kampf aus der Kampfwahl fuehrt zurueck. */
  if(name === "start"){
    state.start = true; state.einst = false; state.weeklies = false; state.rekorde = false;
    renderAll();
    window.scrollTo(0, 0);
    return;
  }
  /* Einstellungen (Instrumententafel Stufe 3) sind ein Ort wie Start: ohne
     Kampf erreichbar, state.tab bleibt, und dieselben Wege fuehren hinaus
     (ein Bereich, ein Kampf aus der Kampfwahl, eine neue Datei). */
  if(name === "settings"){
    state.einst = true; state.start = false; state.weeklies = false; state.rekorde = false;
    renderAll();   // ruft renderEinst() selbst, wenn die Einstellungen stehen
    window.scrollTo(0, 0);
    einstOben();          // die Sprungleiste leuchtet wieder mit dem Rollen (57)
    return;
  }
  /* Weeklies (9.1): der vierte Ort, wie die Einstellungen. */
  if(name === "weeklies"){
    state.weeklies = true; state.start = false; state.einst = false; state.rekorde = false;
    renderAll();
    window.scrollTo(0, 0);
    return;
  }
  /* Rekorde (Spezifikation Rekorde 2a): der fuenfte Ort, wie die Weeklies. */
  if(name === "rekorde"){
    state.rekorde = true; state.start = false; state.einst = false; state.weeklies = false;
    renderAll();
    window.scrollTo(0, 0);
    return;
  }
  const warStart = state.start || state.einst || state.weeklies || state.rekorde;
  state.start = false; state.einst = false; state.weeklies = false; state.rekorde = false;
  // wer den Bereich Kampf oeffnet, hat den neuen Kampf gesehen (0.21)
  if(name === "timeline") ungelesenLesen();
  const back = TAB_ORDER.indexOf(name) < TAB_ORDER.indexOf(state.tab);
  state.tab = name;
  syncPanelHeadings();
  document.querySelectorAll<HTMLElement>(".panel").forEach(p => {
    const on = p.id === "p-"+name;
    p.classList.toggle("back", on && back);
    p.classList.remove("on");
    if(on){ void p.offsetWidth; p.classList.add("on"); }   // restart the animation
  });
  /* Nach dem Zeichnen, nicht davor: erst dann steht die Breite der
     Leinwand fest, und erst dann hat der Behaelter etwas zu scrollen. */
  /* Die Kampf-Tafel (56) vor dem Zeichnen: zugeklappt wird der Zeitverlauf
     nicht gezeichnet, und seine Breite stuende ohnehin nicht fest. */
  syncTafel(); syncFelder();
  /* Der Zeitverlauf steht seit Aufgabe 10 (Nachtrag 29.09.) im Bereich
     Rotation unter der Zeitleiste: renderRotation zeichnet beide, dann steht
     der gemerkte Ausschnitt wieder da (die Zeitleiste rollt mit, 54). */
  if(name === "rotation"){ renderRotation(); setzeBlick($("#stackScroll")); }
  if(name === "analysis") renderAnalysis();
  if(name === "history") renderHistory();
  // Builds: eine eigene Flaeche (Luecken 8.1), seit Aufgabe 12 Links zu Questlog (51-plan.ts)
  if(name === "builds") renderBuilds();
  if(name === "weapons") renderWeapons();
  /* Wie die Zeilen darueber: die Flaeche wird beim Betreten gebaut, nicht bei
     jedem Durchlauf. renderAll() zeichnet sie weiter, solange man auf dem
     Bereich steht. Ohne diese beiden Zeilen zeigte der Bereich beim Betreten
     den Stand des letzten Durchlaufs, den man noch darauf gesehen hat - also
     das vorige Log oder die vorige Sprache. */
  if(name === "compare") renderCompare();
  if(name === "setup") renderSetup();
  if(name === "party") renderParty();
  // ohne Kampf oder von Start aus wechselt die ganze Flaeche (Startseite/Kampf)
  if(!state.encounters.length || warStart) renderAll();
  syncTafel(); syncFelder();
  /* syncTabs, nicht nur syncBereiche: Waffen und Einrichtung bleiben stehen,
     solange man darauf steht, und gehen beim Verlassen - nicht erst beim
     naechsten Durchlauf. syncTabs ruft syncBereiche selbst. */
  syncTabs();
  // actually take the person to the panel they picked — switching what is
  // behind a scroll position they cannot see is not the same as arriving
  if(scrolled) bringPanelIntoView(name);
  else panelAnfangZeigen(name);
}
/* Die Bereichsleiste: welcher Bereich gewaehlt ist (aria-current="page",
   Klasse on) und der eine Tabstopp. Gewaehlt ist Start, solange die
   Startseite steht - auch ohne Log, dann ohne dass jemand geklickt hat.
   fokusHielt: der Fokus stand vor dem Sperren in der Leiste (renderAll).
   Wurde der fokussierte Knopf gesperrt oder versteckt, geht der Fokus an
   den Tabstopp, statt auf den body zu fallen. */
export function syncBereiche(fokusHielt?: boolean){
  const land = document.getElementById("land");
  const hier = state.einst ? "settings" : state.weeklies ? "weeklies" : state.rekorde ? "rekorde"
    : state.start || (!!land && !land.hidden) ? "start" : state.tab;
  const knoepfe = [...document.querySelectorAll<HTMLButtonElement>("#bereiche .tab")];
  knoepfe.forEach(b => {
    const an = b.dataset.tab === hier;
    b.classList.toggle("on", an);
    if(an) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  const nutzbar = knoepfe.filter(b => !b.hidden && !b.disabled);
  const stopp = nutzbar.find(b => b.dataset.tab === hier) || nutzbar[0];
  knoepfe.forEach(b => { b.tabIndex = b === stopp ? 0 : -1; });
  const a = document.activeElement as HTMLButtonElement | null;
  const verloren = a && knoepfe.includes(a) ? (a.hidden || a.disabled)
    : !!fokusHielt && !(a && a.closest && a.closest("#bereiche"));
  if(verloren && stopp) stopp.focus({preventScroll: true});
}
/* Die Titelleiste klebt. Wer im Zeitverlauf weit unten war und dann
   "Analyse" waehlt, stand sonst mitten in der Analyse: das neue Panel begann
   an der alten Scrollposition, weit oberhalb des Blicks. Liegt sein Anfang
   unter der Titelleiste versteckt, wird so weit zurueckgerollt, dass er
   direkt darunter steht - ohne Animation, denn das ist ein Seitenwechsel,
   keine Bewegung. Sieht man den Anfang schon, bleibt alles, wo es ist. */
/* Mit Feldern (58-felder.ts) beginnt ein Bereich mit seiner Kopfzeile, die
   ueber dem Panel steht - sie ist dann der Anfang, nicht das Panel. */
function bereichAnfang(name: string): HTMLElement | null {
  return document.body.classList.contains("felder") ? document.getElementById("bereichKopf") : document.getElementById("p-"+name);
}
function panelAnfangZeigen(name: string){
  const kopf = document.querySelector<HTMLElement>(".top"), p = bereichAnfang(name);
  if(!kopf || !p) return;
  const unter = kopf.getBoundingClientRect().bottom;
  const oben = p.getBoundingClientRect().top;
  if(oben < unter - 1) window.scrollBy(0, oben - unter);
}
/* Ein Klick auf einen Bereich bringt dessen Panel unter die Titelleiste,
   ohne Animation, wenn weniger Bewegung gewuenscht ist. */
function bringPanelIntoView(name: string){
  const kopf = document.querySelector<HTMLElement>(".top"), p = bereichAnfang(name);
  if(!kopf || !p) return;
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollBy({top: p.getBoundingClientRect().top - kopf.getBoundingClientRect().bottom, behavior: smooth ? "smooth" : "auto"});
}

/* Zwei Fehler standen in diesen zwei Zeilen. max="120" im Markup war reine
   Dekoration: der Browser meldet den Wert zwar als ungueltig, aber nichts las
   das, und 9999 wurde angenommen - mit 9999 Sekunden Luecke faellt ein ganzes
   Log zu einem Kampf zusammen. Und 0 ist in JavaScript falsch, also ergab
   0||8 die Acht: wer 0 eingab, sah "0" im Feld, waehrend die App mit 8
   rechnete. Das Feld zeigte eine Zahl, die nicht galt.

   klemme() klemmt beidseitig, schreibt den geklemmten Wert zurueck ins Feld
   und meldet ihn, wenn er sich geaendert hat. Die Meldung geht ueber toast,
   das role="status" traegt - ohne sie aendert sich eine Zahl unter der Hand,
   und ein Vorleser bekommt davon gar nichts mit. */
export function klemme(feld: HTMLInputElement, min: number, max: number, ersatz: number){
  const roh = feld.value.trim();
  const zahl = roh === "" ? ersatz : +roh;
  const wert = Number.isFinite(zahl) ? Math.min(max, Math.max(min, zahl)) : ersatz;
  if(String(wert) !== roh){
    feld.value = String(wert);
    toast(tt("rail.numClamped", {min, max, wert}));
  }
  return wert;
}

/* Wie Kaempfe getrennt werden: Abstand (splitAfter), Mindestdauer (minDur),
   Bossphasen verbinden (mergePhases). Das Filterfeld der Kampfwahl und die
   Einstellungen rufen beide hierher - derselbe Schluessel, dieselbe
   Neuaufteilung, und beide Felder zeigen danach denselben Stand. Die Werte
   kommen schon geklemmt (klemme am jeweiligen Feld). */
export function setzeTrennung(v: {gap?: number; minDur?: number; mergePhases?: boolean}){
  if(v.gap !== undefined){
    state.gap = v.gap;
    persistPref("splitAfter", state.gap);
    $<HTMLInputElement>("#inGap").value = String(state.gap);
  }
  if(v.minDur !== undefined){
    state.minDur = v.minDur;
    persistPref("minDur", state.minDur);
    $<HTMLInputElement>("#inMin").value = String(state.minDur);
  }
  if(v.mergePhases !== undefined){
    state.mergePhases = v.mergePhases;
    persistPref("mergePhases", state.mergePhases);
    $<HTMLInputElement>("#inPhases").checked = state.mergePhases;
  }
  segment(); state.sel = 0; renderAll();
  einstNachfuehren();
}

function runsBundle(){
  return {boro:1, weapons:state.weaponOf, weaponsById:state.weaponById, runs:state.runs};
}
/* A party-log snapshot freezes exactly what the party grouping view shows —
   the board, the shared target, and the short history of what happened —
   so loading it later shows the same thing without needing anyone to
   still be connected. Kept in its own file shape (boroPartyLog:1) rather
   than folded into the runs bundle, since it isn't a solo fight and
   shouldn't show up mixed into "pick a saved run". */
export function summarisePartyLog(){
  const p: Partial<PartyView> = state.party || {};
  const kaempfe = partyBossFights();
  return {
    /* Fassung 2, sobald Bosskaempfe drinstehen. Eine aeltere Borometer
       liest board und target weiter - die stehen unveraendert daneben. */
    boroPartyLog: kaempfe.length ? 2 : 1,
    fights: kaempfe.length ? kaempfe : undefined,
    // re-saving a loaded snapshot keeps the hour the fight happened;
    // stamping it with now would make the head name the wrong time
    when: (p.frozen && p.savedAt) || new Date().toISOString(),
    code: p.code || null, target: p.target || null,
    board: (p.board || []).map(r => ({...r})),
    history: (state.partyLog || []).map(e => ({...e})),
  };
}
export function applyPartyLogSnapshot(d: PartyLogFile){
  if(!d || !(d.boroPartyLog === 1 || d.boroPartyLog === 2)) throw 0;
  if(!Array.isArray(d.board) && !Array.isArray(d.fights)) throw 0;
  /* Ein Log mit Bosskaempfen bringt sie mit: hat der Leser dasselbe Log
     offen, tragen seine Kaempfe wieder ihren Anhaenger und der Kopf zeigt
     die Gruppe dazu. Hat er es nicht, bleibt es beim Board unten. */
  if(Array.isArray(d.fights)){
    state.partyBoss = [];
    d.fights.forEach(f => (f.board || []).forEach(r => state.partyBoss.push({...r})));
  }
  if(!Array.isArray(d.board)){
    const letzte = d.fights![d.fights!.length - 1] || {board: []};   // checked above: board or fights
    // the last boss fight's rows stand in for the board: they carry every
    // figure the board shows, only none of the live state (waiting, age)
    d = {...d, board: letzte.board as unknown as BoardRow[], target: letzte.target};
  }
  // board: the file's own, or the last fight's rows put there just above
  state.party = {role:null, code:d.code, target:d.target, error:null, board:d.board!, frozen:true, savedAt:d.when};
  // a saved snapshot is somebody else's evening: it brings its own rows and
  // must not be read through what the live party taught this page
  state.ventiusSeen = new Set();
  noteVentius(d.board);
  state.partyLog = d.history || [];
  setGroup("party");
  toast(tt("party.loadedSnapshot"));
}
/* A run is what summarise() builds: a name and the three figures every run is
   read by, plus its skills. Anything that cannot answer those is not a run.
   Checking only that d.runs existed let any JSON with that key through — a file
   of five thousand foreign objects landed in the sidebar as "x0 · 0.0 dps ·
   NaNs" and, because the save runs immediately after, stayed in the config
   across restarts with no way out but deleting them one at a time. */
// any: this is the check that decides whether a file's contents are a run
export function looksLikeRun(r: any): r is SavedRun {
  /* The gate has to match what renderCompare reads, not a subset of it.
     Five fields were checked and eleven are used, so a file written
     before `dead` and `perSecond` existed - or edited by hand - passed,
     was written into the config, and then threw out of the idle-time row
     on the second tick: the tab died, the runs stayed in the sidebar, and
     the toast said the file had been rejected. */
  return !!r && typeof r === "object" &&
         typeof r.name === "string" &&
         Array.isArray(r.skills) && Array.isArray(r.windows) && Array.isArray(r.perSecond) &&
         /* Und was darin steht: ein null in skills[] liess den Vergleich bei
            jedem Zeichnen werfen. Die Pruefung steht im Kern (best-pull-core.ts),
            dort laeuft sie unter Node im Test. */
         runPartsOk(r) &&
         /* Die zwei neuen Felder sind freiwillig - ein aelterer Lauf hat sie
            nicht -, aber wenn sie da sind, muessen sie tragen. Ohne diese
            Zeilen ergibt hitsPerSecond:["1","2"] eine Trefferzeile aus
            aneinandergehaengten Zeichenketten und fought:"x" ein NaN in der
            Rate. Genau der Fall, den der Kommentar darueber beschreibt. */
         (r.hitsPerSecond === undefined ||
          (Array.isArray(r.hitsPerSecond) && r.hitsPerSecond.every(Number.isFinite))) &&
         (r.fought === undefined || Number.isFinite(r.fought)) &&
         ["seconds","total","dps","hits","critRate","critDmgShare","heavyRate","avg","max","dead"]
           .every(k => Number.isFinite(r[k]));
}

function applyRunsBundle(d: { runs?: unknown[]; weapons?: Record<string, string>;
                               weaponsById?: Record<string, string> }){
  if(!d || !Array.isArray(d.runs)) throw 0;
  const good = d.runs.filter(looksLikeRun);
  const skipped = d.runs.length - good.length;
  if(!good.length) throw 0;          // nothing usable: nothing written
  good.forEach(r => { r.id = "run"+(state.runSeq++); });
  state.runs = good.concat(state.runs);
  if(d.weapons) state.weaponOf = Object.assign({}, d.weapons, state.weaponOf);
  if(d.weaponsById) state.weaponById = Object.assign({}, d.weaponsById, state.weaponById);
  persistConfig();
  renderRuns(); renderCompare();
  // say what was dropped rather than quietly loading fewer than the file held
  if(skipped) toast(tt("toast.runsLoadedSome",{n:good.length, skipped}), 6000);
  else toast(tt("toast.runsLoaded",{n:good.length}));
}
export function whenSaved(ms: number){
  const d = new Date(ms*1000), p = (n: number) => String(n).padStart(2,"0");
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+" "+p(d.getHours())+":"+p(d.getMinutes());
}
/* Dasselbe fuer einen Satz: "Gespeicherter Schnappschuss vom 2026-09-23
   22:30" las sich wie ein Dateiname, und im geteilten Bild erst recht. In
   den Dateilisten bleibt die ISO-Form, dort sortiert sie. */
export function whenSavedText(ms: number){
  const d = new Date(ms*1000), de = state.lang === "de";
  return d.toLocaleDateString(de ? "de-DE" : "en-GB", {day: "2-digit", month: "2-digit", year: "numeric"}) + " " +
         d.toLocaleTimeString(de ? "de-DE" : "en-GB", {hour: "2-digit", minute: "2-digit"});
}


// what this part did at the top level, run where it stands in the order
/* ---------- Hilfe auf Abruf ----------
   Ein Satz je Reiter bleibt stehen; die Bedienung liegt hinter "Hilfe".
   Kein Klappfenster ueber dem Inhalt, sondern eine Flaeche, die im Fluss
   aufgeht: sie bleibt bei 200 % und im schmalen Fenster lesbar und deckt
   nichts zu. Der Knopf traegt aria-expanded und aria-controls; Esc im
   Knopf oder in der Flaeche schliesst und gibt den Fokus an den Knopf
   zurueck. Die Flaeche bleibt offen, bis man sie schliesst - wer die
   Tastenfolge nachmacht, soll sie dabei lesen koennen. */
export function hilfeZu(btn: HTMLElement){
  const panel = document.getElementById(btn.getAttribute("aria-controls") || "");
  btn.setAttribute("aria-expanded", "false");
  if(panel) panel.hidden = true;
}
function hilfeBinden(){
  document.querySelectorAll<HTMLElement>(".helpbtn[aria-controls]").forEach(btn => {
    const panel = document.getElementById(btn.getAttribute("aria-controls")!);
    if(!panel) return;
    btn.onclick = () => {
      const auf = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", auf ? "true" : "false");
      panel.hidden = !auf;
    };
    const esc = (e: KeyboardEvent) => {
      if(e.key !== "Escape" || btn.getAttribute("aria-expanded") !== "true") return;
      // nicht weiter nach oben: im Kompaktmodus hiesse Esc sonst auch "zurueck"
      e.stopPropagation();
      hilfeZu(btn);
      btn.focus();
    };
    btn.addEventListener("keydown", esc);
    panel.addEventListener("keydown", esc);
  });
}

export function setup(): void {
  $("#btnOpen").onclick = e => {
    e.stopPropagation(); schliesseAndereKopffenster("open"); toggleOpenMenu();
  };
  $("#miOpenCombat").onclick = () => { toggleOpenMenu(false); $("#fileInput").click(); };
  $("#miOpenParty").onclick = () => { toggleOpenMenu(false); ladeGruppenLog(); };
  addEventListener("click", e => {
    if(state.openMenuOpen && !(e.target as HTMLElement).closest(".openmenu")) toggleOpenMenu(false);
  });
  addEventListener("keydown", e => { if(e.key === "Escape" && state.openMenuOpen) toggleOpenMenu(false); });
  hilfeBinden();
  addEventListener("dragenter", e => { e.preventDefault(); dragDepth++; $("#dropOverlay").classList.add("on"); });
  addEventListener("dragover", e => e.preventDefault());
  addEventListener("dragleave", () => { if(--dragDepth <= 0) $("#dropOverlay").classList.remove("on"); });
  addEventListener("drop", e => {
    e.preventDefault(); dragDepth = 0; $("#dropOverlay").classList.remove("on");
    if(e.dataTransfer!.files.length) readFiles(e.dataTransfer!.files);   // a drop always carries one
  });
  /* Beide rufen denselben Umschalter. #btnWatch2 ist die Einladung auf der
     Startseite ("Live-Aufzeichnung starten") und verschwindet, sobald die
     Aufzeichnung laeuft; der Zustand steht dann oben (styles.css). */
  $("#btnWatch").onclick = $("#btnWatch2").onclick = toggleWatch;
  $("#groupSeg").onclick = e => {
    const b = (e.target as HTMLElement).closest("button"); if(!b) return;
    setGroup(b.dataset.g!);
  };
  const blickBox = $("#stackScroll");
  if(blickBox) blickBox.addEventListener("scroll", () => merkeBlick(blickBox), {passive: true});
  /* ---------- Die Bereichsleiste (Instrumententafel 3.3) ----------
     Knoepfe in einem <nav>; der gewaehlte traegt aria-current="page"
     (syncBereiche). Ein Tabstopp fuer die Leiste, innen die Pfeile, Pos1 und
     Ende; versteckte und gesperrte Bereiche werden uebersprungen, sonst
     laeuft der Fokus ins Leere. Der Pfeil wechselt den Bereich sofort. */
  $("#bereiche").addEventListener("keydown", e => {
    if(e.altKey || e.ctrlKey || e.metaKey) return;
    const z = e.target as HTMLElement | null;
    const hier = z && z.closest ? z.closest<HTMLButtonElement>(".tab") : null;
    if(!hier) return;
    const sicht = [...document.querySelectorAll<HTMLButtonElement>("#bereiche .tab")].filter(b => !b.hidden && !b.disabled);
    const i = sicht.indexOf(hier);
    if(i < 0) return;
    let ziel: HTMLButtonElement | undefined;
    switch(e.key){
      case "ArrowDown": case "ArrowRight": ziel = sicht[(i + 1) % sicht.length]; break;
      case "ArrowUp":   case "ArrowLeft":  ziel = sicht[(i - 1 + sicht.length) % sicht.length]; break;
      case "Home": ziel = sicht[0]; break;
      case "End":  ziel = sicht[sicht.length - 1]; break;
      default: return;
    }
    e.preventDefault();
    if(!ziel || ziel === hier) return;
    /* Ohne scrolled: wer mit der Tastatur durch die Bereiche geht, will
       lesen, was dasteht, und nicht bei jedem Schritt verschoben werden. */
    switchTab(ziel.dataset.tab!);
    ziel.focus();
  });
  /* Die Blasen der Symbolleiste (Neugestaltung 28.09., 0.19) stehen fest am
     Fenster rechts neben ihrem Knopf - die Leiste rollt bei wenig Hoehe in
     sich und schnitte sie sonst ab. Gesetzt wird, bevor eine erscheinen
     kann: beim Betreten der Leiste, beim Fokus, beim Rollen und bei einer
     neuen Fenstergroesse. Die Rechtecke sind Fensterpunkte, die Blase lebt
     in Layoutpunkten (Groesseneinstellung), darum geteilt durch den Zoom. */
  const tipsSetzen = () => {
    const z = uiZoomFactor();
    document.querySelectorAll<HTMLElement>("#bereiche .tab").forEach(b => {
      const tip = b.querySelector<HTMLElement>(".btip");
      if(!tip || b.hidden) return;
      const r = b.getBoundingClientRect();
      tip.style.setProperty("--tip-x", Math.round((r.right / z + 10) * 10) / 10 + "px");
      tip.style.setProperty("--tip-y", Math.round(((r.top + r.height / 2) / z) * 10) / 10 + "px");
    });
  };
  $("#bereiche").addEventListener("mouseenter", tipsSetzen);
  $("#bereiche").addEventListener("focusin", tipsSetzen);
  $("#bereiche").addEventListener("scroll", tipsSetzen, {passive: true});
  addEventListener("resize", tipsSetzen);
  tipsSetzen();
  $("#bereiche").onclick = e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".tab");
    if(!b || b.disabled) return;
    const name = b.dataset.tab!;
    // ohne Kampf gehen nur Gruppe, Weeklies, Rekorde, Start und Einstellungen (und die Einrichtung, wenn sie da ist)
    if(!state.encounters.length && !["party", "weeklies", "rekorde", "start", "settings", "setup"].includes(name)) return;
    switchTab(name, true);
  };
  $("#partyPill").onclick = () => {
    if(state.party && state.party.role) setGroup("party");
    else switchTab("party", true);   // not in one yet — take them to setup
  };
  $("#selPlayer").onchange = e => { state.player = (e.target as HTMLInputElement).value; segment(); state.sel = 0; renderAll(); };
  $("#inGap").onchange = e => setzeTrennung({gap: klemme(e.target as HTMLInputElement, 1, 120, 8)});
  $("#inPhases").onchange = e => setzeTrennung({mergePhases: (e.target as HTMLInputElement).checked});
  $("#inMin").onchange = e => setzeTrennung({minDur: klemme(e.target as HTMLInputElement, 0, 120, 3)});
  // a re-parse of what is already loaded must not relabel where it came from
  $("#selDelim").onchange = e => { state.delim = (e.target as HTMLInputElement).value; setLoadOrigin(state.origin || "file"); loadText(state.text, state.fileNames); };
  $("#selHeader").onchange = e => { state.headerMode = (e.target as HTMLInputElement).value; setLoadOrigin(state.origin || "file"); loadText(state.text, state.fileNames); };
  $("#btnEditFights").onclick = () => {
    if(inGruppenLog()){ toast(tt("rail.editLockedLog"), 6000); return; }
    state.bearbeiten = !state.bearbeiten;
    renderFights();
  };
  $("#btnClearLog").onclick = () => {
    // the cutoff is a timestamp, not a delete: the file on disk is never
    // opened for writing anywhere in this app, and live logging keeps
    // reading from wherever the game leaves off. This only tells Borometer's own
    // parser to skip everything at or before this moment on every future
    // reparse — see the comment on state.clearBefore in buildEvents().
    const latest = state.events.reduce((max, e) => Math.max(max, e.t), state.clearBefore || -Infinity);
    if(!isFinite(latest)) return;
    /* Weil das Leeren nur ein Zeitschnitt ist, ist die Ruecknahme der alte
       Schnitt - es gibt nichts wiederherzustellen, nur etwas zurueckzudrehen.
       Vorher war ein Klick auf einen 43x24-Knopf neben der Kampfzahl
       endgueltig, und der Hinweis beruhigte ueber die Logdatei, um die
       niemand gefuerchtet hatte. */
    const vorher = state.clearBefore;
    const neuZeichnen = () => { buildEvents(); refreshPlayers(); segment();
                                state.sel = 0; renderAll(); };
    state.clearBefore = latest;
    neuZeichnen();
    toast(tt("rail.cleared"), 9000, null, {label: tt("rail.clearedUndo"), fn: () => {
      state.clearBefore = vorher;
      neuZeichnen();
      toast(tt("rail.clearedBack"));
    }});
  };
  $("#btnSaveRun").onclick = kampfSpeichern;
  $("#btnCsv").onclick = () => {
    const inParty = state.group === "party";
    const seg = state.encounters[state.sel]!;
    if(!seg && !inParty) return;
    const rows = inParty ? partyGroupRows() : groupRows(seg, state.group);
    if(!rows.length) return;
    const lines = [["name","damage","share","dps","hits","crit_rate","heavy_rate","biggest"].join(",")];
    rows.forEach(r => lines.push(['"'+r.name.replace(/"/g,'""')+'"', Math.round(r.damage),
      r.share.toFixed(4), r.dps.toFixed(1), r.hits, r.critRate.toFixed(3), r.heavyRate.toFixed(3),
      Math.round(r.max)].join(",")));
    const label = inParty ? (state.party && state.party.target || "party") : (seg.stats.name||"fight");
    download(new Blob([lines.join("\n")],{type:"text/csv"}),
      label.replace(/[^\w -]+/g,"")+" "+state.group+".csv");
  };
  $("#btnSaveRuns").onclick = kampfdateiSpeichern;
  $("#btnLoadRuns").onclick = kampfdateiLaden;
  $("#runsInput").onchange = e => {
    const f = (e.target as HTMLInputElement).files![0]; if(!f) return;
    f.text().then(txt => applyRunsBundle(JSON.parse(txt)))
      .catch(() => toastFail(tt("toast.notRunsFile")));
  };
}

/* With the helper running, saved runs go into a real "saves" folder beside
   the app — a webview window has no dependable browser download, so writing
   the file ourselves is the only way it lands somewhere reachable. Opened as
   a plain file in a browser, fall back to download/upload.
   Die Knoepfe im Filterfeld und in den Einstellungen rufen dieselben zwei. */
export async function kampfdateiSpeichern(){
  if(!state.runs.length){ toastFail(tt("toast.noSavedRuns")); return; }
  if(!SERVED){
    download(new Blob([JSON.stringify(runsBundle(), null, 1)],
      {type:"application/json"}), "boro-runs.json");
    return;
  }
  const stamp = new Date();
  const p = (n: number) => String(n).padStart(2,"0");
  const suggested = "runs " + stamp.getFullYear()+"-"+p(stamp.getMonth()+1)+"-"+p(stamp.getDate());
  const name = await askText(t("rail.saveRunsFile"), t("runs.nameIt"), suggested);
  if(name === null || !name.trim()) return;
  fetch("/api/runs/save", {method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({name:name.trim(), data:runsBundle()})})
    .then(r => r.json())
    .then(d => {
      if(d.ok) toast(tt("runs.savedTo",{name:d.name, folder:d.folder}), 6000);
      else toast(d.error || tt("runs.saveFailed"));
    })
    .catch(() => toastFail(tt("party.helperNoAnswer")));
}
export async function kampfdateiLaden(){
  if(!SERVED){ $("#runsInput").click(); return; }
  let listing: FolderListing;
  try{ listing = await (await fetch("/api/runs/list")).json(); }
  catch(err){ toastFail(tt("party.helperNoAnswer")); return; }
  const files = listing.files || [];
  if(!files.length){
    await openModal({title:t("rail.loadRunsFile"), msg:t("runs.noneSaved",{folder:listing.folder}),
                     folder:"logs"});
    return;
  }
  const pick = await askPick(t("rail.loadRunsFile"), t("runs.pickOne",{folder:listing.folder}),
    files.map(f => ({label:f.name, note:whenSaved(f.mtime), value:f.name})), "logs");
  if(!pick) return;
  fetch("/api/runs/load?name="+encodeURIComponent(pick))
    .then(r => r.json())
    .then(applyRunsBundle)
    .catch(() => toastFail(tt("toast.notRunsFile")));
}
