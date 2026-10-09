

import { state } from "./01-state";
import { toast, toastFail } from "./03-helpers";
import { buildEvents } from "./04-log-parsing";
import { segment } from "./05-fights";
import { t, tt } from "./08-translation";
import { ventiusTargetKey } from "./15-weapons-and-ventius";
import { $ } from "./18-interface-basics";
import { renderHead } from "./20-meter-head";
import { istLivePausiert, streifenFolgt, syncKwKnopf, tagAnsichtVerlassen } from "./23-kampfwahl";
import { persistPref, renderWeapons } from "./27-weapons-tab";
import { renderCompare } from "./28-compare";
import { renderRuns } from "./30-fight-list";
import { histCollect, histRecord, loadTail, loadText, refreshPlayers, renderAll, setLoadOrigin } from "./32-history";
import { looksLikeRun } from "./34-menus-drop-and-tabs";
import { askText } from "./36-dialog";
import {
  applySeeThrough, clampSee, kompaktFensterStart, kopfHoehe, materialGemeldet, micaMerken, placeWindowChrome, randlosHinweis, setKompaktOffen,
  setUiZoom, syncRahmenKnoepfe, syncWindowVars, winPost
} from "./37-window-size-and-overlay";
import { applyTheme } from "./39-themes";
import { fightKey, pollParty, renderParty, serverStatusNachfuehren } from "./42-party";
import { applyDevMode } from "./43-more-menu-and-dev-mode";
import { isWatching, liveSay, renderStart, setWatching, syncLiveBtn } from "./45-startup";
import { setzeUpdate, updateNachfragen } from "./55-statusleiste";
import { einstNachfuehren, updateSchalterStand } from "./57-einstellungen";
import { rundgangVonSelbst } from "./63-rundgang";
import { kampfZustand, wachstum, type KampfMarke } from "../kompakt-core";
import { gelesenMelden, kampfWache, spracheGelesen, startAuftragHolen } from "./66-windows";
import type { SavedRun } from "../types";

/* ============================================================
   Server mode — when Borometer runs from the portable exe, a tiny
   local helper hands over the newest log so nothing has to be
   picked or dragged. Opened as a plain file, none of this runs.
   ============================================================ */
export const SERVED = location.protocol === "http:" || location.protocol === "https:";
/* The launcher opens its own window on ...?win=1 and everything else - the
   browser fallback, a tab somebody opened by hand on 127.0.0.1 - without it. */
export const OWN_WINDOW = /[?&]win=1(&|$)/.test(location.search);
/* Kompakt als eigenes Fenster (Nachtraege N4): der Hauptprozess oeffnet das
   Kompaktfenster auf ...?win=1&kompakt=1 - dieselbe Seite vom selben Helfer,
   ohne Node und ohne Bruecke wie die grosse. Sie ist dann nur der Streifen.
   FENSTER nennt jeder Anfrage an /api/win, welches Fenster sie meint. */
export const KOMPAKT_FENSTER = OWN_WINDOW && /[?&]kompakt=1(&|$)/.test(location.search);
export const FENSTER = KOMPAKT_FENSTER ? "kompakt" : "main";
export let serverDir = "";
let lastSig = "";
/* Wie weit die Datei gelesen ist (Spezifikation Live-Leistung 3): der Name,
   das Byte hinter der letzten ganzen Zeile, wie lang state.text danach war -
   hat inzwischen etwas anderes geladen (eine Datei auf das Fenster gezogen,
   das Beispiel), passt der Stand nicht mehr, und es wird ganz geladen - und
   die ersten zwei Zeilen der Datei, wie der Helfer sie beim ganzen Laden
   schickte. Verglichen wird mit ihnen, nicht mit state.text: der waechst
   Stueck fuer Stueck, und startsWith muesste ihn jedes Mal am Stueck
   zusammensetzen. */
let stand: { file: string; to: number; len: number; head: string } | null = null;
/* Ein Takt nach dem anderen: zwei gleichzeitige haetten dasselbe Ende
   zweimal angehaengt. */
let fragtGerade = false;
/* Die Datei, die dieser Lauf ab Byte 0 liest; "" nach Beenden. */
let vonVorn = "";

/* Das Ende ab einem Byte, als JSON vom Helfer - oder null, wenn er es so
   nicht gibt (409: eine andere oder kuerzere Datei, 400, ein 500 als Text,
   wenn das Log beim Lesen verschwand, eine Antwort, die kein JSON ist). Ohne
   Antwort in zehn Sekunden wirft fetch, und der Takt sagt "gestoert". */
type Stueck = { file: string; from: number; to: number; size: number; head: string; text: string };
async function holeAb(file: string, from: number): Promise<Stueck | null> {
  const r = await fetch("/api/latest?file=" + encodeURIComponent(file) + "&from=" + from,
                        {signal: AbortSignal.timeout(10000)});
  if(!r.ok) return null;
  const d = await r.json().catch(() => null);
  const passt = d && d.file === file && d.from === from && typeof d.text === "string" && typeof d.head === "string" &&
    Number.isSafeInteger(d.to) && d.to >= from && Number.isSafeInteger(d.size) && d.size >= d.to;
  return passt ? d : null;
}

/* Jeder Start und jedes Beenden zaehlt hoch. Eine Antwort, die zu einem
   frueheren Lauf gehoert, kommt oft erst an, wenn schon beendet ist - ohne
   diese Marke haette sie den Umschalter wieder auf "an" gestellt. */
let watchLauf = 0;
async function pollServer(){
  if(fragtGerade) return;
  fragtGerade = true;
  try { await takt(); } finally { fragtGerade = false; }
}
/* Im Kampf oder danach (Spezifikation Kompakt-Fenster 3): der neueste Kampf
   nach dem letzten Abruf und wann er zuletzt wuchs - an der Uhr der Seite,
   nicht der des Logs. Ein neuer Lauf faengt ohne beides an. */
let marke: KampfMarke = null;
let gewachsen: number | null = null;
/* Der erste Takt eines Laufs und jeder erste Takt mit einer anderen Datei
   merkt sich nur die Marke: was dasteht, laeuft nicht deshalb. Danach ist
   auch der erste Kampf eines leeren Logs Wachstum. */
let ersterTakt = true;
let markeDatei = "";
function markeJetzt(): KampfMarke {
  const neu = state.encounters[0];   // die Liste ist nach Beginn absteigend sortiert (05-fights.ts)
  return neu ? {key: fightKey(neu), ende: neu.end} : null;
}
function wachstumNachziehen(datei: string){
  const jetzt = markeJetzt();
  if(datei !== markeDatei){ markeDatei = datei; marke = null; gewachsen = null; ersterTakt = true; }
  gewachsen = wachstum(marke, jetzt, gewachsen, Date.now(), !ersterTakt);
  marke = jetzt;
  ersterTakt = false;
}
/** Laeuft der gewaehlte Kampf gerade (Live, der neueste, gewachsen vor weniger als der Kampftrennung)? */
export function kampfLaeuft(): boolean {
  return kampfZustand({live: isWatching() && !istLivePausiert(), neuester: state.sel === 0,
    seitWachstumMs: gewachsen == null ? Infinity : Date.now() - gewachsen, trennS: state.gap}) === "kampf";
}
/** Wie lange er noch als laufend gilt, in ms (fuer den Wecker im Kopf). */
export function kampfRestMs(): number {
  return gewachsen == null ? 0 : Math.max(0, state.gap * 1000 - (Date.now() - gewachsen));
}
async function takt(){
  const lauf = watchLauf;
  try{
    /* Mit Frist wie holeAb: ein Helfer, der nicht antwortet, hielte sonst
       fragtGerade fuer immer, und kein Takt fragte mehr - auch nicht nach
       Beenden und Starten. Die Frist wirft, unten wird "gestoert" daraus. */
    const s = await (await fetch("/api/state", {signal: AbortSignal.timeout(10000)})).json();
    if(lauf !== watchLauf) return;
    // kept so a bug report can name the settings file: which one is in use
    // stopped being obvious the moment it left the folder beside the exe
    state.srv = s;
    if(serverDir !== (s.dir || "")){ serverDir = s.dir || ""; einstNachfuehren(); renderStart(); syncKwKnopf(); }
    if(!s.dir){
      /* Kein Ordner mehr: es gibt nichts zu beobachten, also wirklich aus.
         serverDir ist jetzt leer, der naechste Klick fragt nach einem. */
      stopServedWatch();
      liveSay(() => t("live.noLogFolderSet"));
      toastFail(tt("live.stoppedNoFolder"), 7000);
      return;
    }
    setWatching(true, s.file || t("live.waitingForFight"));
    if(!s.file){ liveSay(() => t("live.waitingForFight")); return; }
    const sig = s.file+"|"+s.size+"|"+s.mtime;
    if(sig === lastSig){ liveSay(s.file); return; }
    setLoadOrigin("watch");
    /* Nur das neue Ende, wenn der Stand passt: dieselbe Datei, nicht kuerzer,
       state.text ist noch, was bis dahin gelesen wurde, und die Datei faengt
       noch so an wie gelesen (head: eine unter demselben Namen ersetzte
       Datei beginnt mit einer anderen Zeit). */
    const alt = stand && stand.file === s.file && s.size >= stand.to && stand.len === state.text.length ? stand : null;
    let d = alt ? await holeAb(s.file, alt.to) : null;
    if(lauf !== watchLauf) return;
    if(alt && d && d.head === alt.head && loadTail(d.text, [s.file])){
      stand = {file: s.file, to: d.to, len: state.text.length, head: alt.head};
    } else {
      /* Ganz laden: das erste Mal, eine andere oder kuerzere Datei, eine
         Antwort, die nicht zum Stand passt, ein Ende, das nicht anzuhaengen
         ging. Auch das ganze Laden fragt mit from=0: so kommt es nur bis zur
         letzten ganzen Zeile, und der Stand ist das Byte, nicht eine aus dem
         Text zurueckgerechnete Laenge. Ohne Antwort: der Stand bleibt, der
         naechste Takt versucht es wieder ("gestoert", unten). */
      d = await holeAb(s.file, 0);
      if(lauf !== watchLauf) return;
      if(!d) throw new Error("no answer from the helper");
      stand = null;
      if(d.text) loadText(d.text, [s.file], true, true);
      vonVorn = s.file;
      /* Zurueck aus der Pause mit derselben Datei: Zeitschnitt und geloeste
         Kaempfe wie vorher (pauseMerk). Eine andere Datei faengt frisch an. */
      const merk = pauseMerk;
      pauseMerk = null;
      if(merk && merk.file === s.file && merk.head === d.head && (state.fileNames || []).join("|") === s.file){
        state.clearBefore = merk.clearBefore;
        merk.entfernt.forEach(x => state.entfernt.add(x));
        buildEvents(); refreshPlayers(); segment();
        state.sel = 0;
        histRecord();
        renderAll();
      }
      if(state.text === d.text) stand = {file: s.file, to: d.to, len: state.text.length, head: d.head};
    }
    /* Die Signatur gilt erst, wenn alles bis zur Groesse gelesen ist; eine
       halbe letzte Zeile oder die 8-MB-Grenze lassen den naechsten Takt
       wieder fragen. */
    wachstumNachziehen(s.file);
    // renderAll hat vor dem Nachziehen gezeichnet: hat sich der Zustand geaendert, den Kopf neu
    if(kampfLaeuft() !== document.body.classList.contains("kampf-laeuft")) renderHead();
    lastSig = d.to === d.size && d.size === s.size ? sig : "";
    /* Ganz von vorn bis zum Ende gelesen - auch ueber mehrere Stuecke, wenn
       das Log groesser ist als eine Antwort: fuer "Zuletzt gelesen" in der
       Sprungliste (66, meldet denselben Namen nur einmal hintereinander). */
    if(vonVorn === s.file && d.to === d.size) gelesenMelden(s.file);
    liveSay(s.file);
    // ist der neueste Kampf fuer die Meldung beendet? (66)
    kampfWache();
  }catch(err){
    if(lauf !== watchLauf) return;
    /* Der Helfer antwortet nicht. Die Abfrage laeuft weiter und faengt sich
       von selbst, sobald er wieder da ist - also bleibt die Aufzeichnung an,
       aber der Umschalter sagt "gestoert" statt so zu tun, als liefe alles.
       Vorher sprang er hier auf "aus", obwohl weiter gefragt wurde. */
    setWatching(true);
    liveSay(() => t("live.helperNotResponding"), true);
  }
}
let watchTimer: ReturnType<typeof setInterval> | null = null;
function beginServedWatch(){
  marke = null; gewachsen = null; ersterTakt = true; markeDatei = "";
  // ein frueherer Tag in der Kampfwahl ist damit verlassen (Nachtraege N3)
  tagAnsichtVerlassen();
  watchLauf++;
  clearInterval(watchTimer ?? undefined);
  pollServer();
  watchTimer = setInterval(pollServer, 2000);
}
/* Beenden: nicht mehr fragen. Der Helfer selbst merkt davon nichts - er
   sagt nur, was im Ordner liegt, wenn man ihn fragt. lastSig geht mit,
   damit ein neuer Start den neuesten Kampf wieder laedt, wie beim ersten. */
function stopServedWatch(pause = false){
  marke = null; gewachsen = null; ersterTakt = true; markeDatei = "";
  watchLauf++;
  clearInterval(watchTimer ?? undefined);
  watchTimer = null; lastSig = ""; stand = null; vonVorn = "";
  if(!pause) pauseMerk = null;
  setWatching(false, undefined, pause);
  liveSay(() => t("top.notWatching"));
  // "Kampf laeuft" gilt nur bei laufendem Live: den Kopf gleich neu, nicht erst mit dem Wecker
  renderHead();
}
/* Fruehere Tage (Nachtraege N3): ein frueherer Tag pausiert das Mitlesen -
   wie Beenden, nur sagt der Satz "pausiert". true, wenn Live lief; dann
   nimmt liveFortsetzen() es mit "Heute" wieder auf, und der erste Takt
   laedt die neueste Datei ganz. */
/* Was die Pause ueberdauern soll (Pruefung N3, W3): der Zeitschnitt von
   "Leeren" und die geloesten Kaempfe gehoeren der Datei, die Live las. Der
   fruehere Tag laedt eine andere Datei, und loadText vergisst beides; kommt
   Live danach mit derselben Datei zurueck (gleicher Name, gleicher Kopf),
   gilt beides wieder. */
let pauseMerk: { file: string; head: string; clearBefore: number | null; entfernt: number[] } | null = null;
export function livePausieren(): boolean {
  if(!watchTimer) return false;
  const namen = state.fileNames || [];
  pauseMerk = stand && namen.length === 1 && namen[0] === stand.file
    ? {file: stand.file, head: stand.head, clearBefore: state.clearBefore, entfernt: [...state.entfernt]} : null;
  /* pause: der letzte Kampf ist vielleicht noch nicht zu Ende - er geht
     nicht als beendet in den besten Pull und den Build (Pruefung N3, G4). */
  stopServedWatch(true);
  liveSay(() => t("kw.pausiertSatz"));
  return true;
}
export function liveFortsetzen(){ beginServedWatch(); }
export async function chooseServerDir(){
  /* Der Beispielpfad ist Platzhalter, nicht Wert. Er stand vorbelegt und
     markiert im Feld ("C:\Users\you\..."), und ein Enter schickte einen
     Ordner, den es nicht gibt - er sah aus wie ein erkannter Pfad. Ein
     gemerkter Ordner bleibt Wert: der ist echt. */
  const p = await askText(t("top.logFolder"), t("live.folderPrompt"), serverDir || "", t("live.folderPh"));
  if(!p) return;
  /* Ein POST, kein GET mit ?path=: der Ordner wird gewechselt und
     gespeichert, und ein GET kann jede fremde Webseite per <img src>
     ausloesen (server.ts, apiRefusal). */
  fetch("/api/dir", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path: p})})
    .then(r => r.json())
    .then(d => {
      if(d.ok){ serverDir = d.dir; lastSig = ""; stand = null; einstNachfuehren();
        // Start zeigt jetzt "Zuletzt geoeffnet" statt der Einrichtung (DECISION 1.12)
        document.body.dataset.bereit = "ordner"; renderStart(); syncKwKnopf();
        toast(tt("live.nowWatching",{dir:d.dir})); beginServedWatch(); }
      else toastFail(tt("toast.noSuchFolder"));
    })
    .catch(() => toastFail(tt("party.helperNoAnswer")));
}
/* "Watch folder" only ever starts on an explicit click — a folder being
   auto-detected or remembered from last time must never, by itself, cause
   a fight to appear the moment the app opens. */
async function startServedWatch(){
  if(!serverDir) await chooseServerDir();
  else beginServedWatch();
}
/* Ein Umschalter: laeuft sie (auch gestoert), beendet ein Klick sie. */
const toggleServedWatch = () => isWatching() ? stopServedWatch() : void startServedWatch();

/* Windows zeichnet Rahmen, Knoepfe, Ecken und Schatten. Die Kopfleiste
   ist die Titelleiste: in der Vollansicht zieht die ganze Leiste das
   Fenster (Instrumententafel 3.1), im Kompaktmodus der Griff .tdrag; die
   eigenen Knoepfe stehen nur noch im Kompaktmodus (dort blendet der
   Hauptprozess die Systemknoepfe aus; das Kompaktfenster hat keine). */
function eigenerRahmen(){
  $("#titlebar").hidden = false;
  document.body.classList.add("frameless");
  document.documentElement.classList.add("frameless", "native");
  placeWindowChrome();
}

/* Die Einstellungen sind gelesen (true) oder nicht zu haben (false). Das
   Nachlesen der Rekorde (62) wartet darauf: vorher kennt die Seite den
   Verlauf (logIndex) nicht, und ein Nachlesen ohne ihn haelte jede Datei fuer
   ungelesen und schriebe einen Verlauf ohne die alten Eintraege. */
let konfigFertig: (ok: boolean) => void = () => {};
export const konfigGelesen = new Promise<boolean>(r => { konfigFertig = r; });

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  /* Das Kompaktfenster weiss aus seiner Adresse, was es ist: Rahmen und
     Streifen stehen vor dem ersten Zeichnen (N4). */
  if(KOMPAKT_FENSTER){
    document.documentElement.classList.add("kfenster");
    eigenerRahmen();
  }
  if(SERVED){
    fetch("/api/config").then(r => r.json()).then(c => {
      if(c.logIndex && typeof c.logIndex === "object"){
        state.hist.files = c.logIndex; histCollect(); renderHead(); renderStart();
      }
      if(c.weaponOf) state.weaponOf = Object.assign(c.weaponOf, state.weaponOf);
      if(c.weaponById) state.weaponById = Object.assign(c.weaponById, state.weaponById);
      /* Das alte, einzelne Paar bleibt in der Datei stehen und wird weiter
         geschrieben, damit eine aeltere Fassung es noch findet. Gelesen wird
         es nur noch als Anzeige fuer die Zeit vor dem ersten Kampf - sobald
         einer geladen ist, sagt der Kampf, was gilt. Eine Handauswahl gehoert
         seit 0.65 zu einem Charakter und steht in weaponPick. */
      if(c.mainWeapon) state.mainWeapon = c.mainWeapon;
      if(c.offWeapon) state.offWeapon = c.offWeapon;
      if(c.weaponPick && typeof c.weaponPick === "object") state.weaponPick = c.weaponPick;
      // the same gate on the way back in, or a config poisoned before the
      // check was widened keeps killing the tab on every restart
      const saved: SavedRun[] = Array.isArray(c.runs) ? c.runs.filter(looksLikeRun) : [];
      if(saved.length && !state.runs.length){
        saved.forEach(r => { r.id = "run"+(state.runSeq++); });
        state.runs = saved;
        renderRuns(); renderCompare();
      }
      // Where your fights get cut. This arrives after the page is up, so a log
      // already on screen has to be cut again with the numbers you actually set —
      // otherwise the fields would show 12s while the list was still built on 5s.
      /* Zwei Namen fuer dieselbe Zahl. Der alte Schluessel "gap" stammt aus
         einer Fassung, die das Feld nicht ernst nahm: dort stand 8 im Feld und
         geschnitten wurde bei 24. Das war der Fehler, nicht die Einstellung.
         Die erste Umstellung rechnete den alten Wert deshalb mal drei, "damit
         das gewohnte Bild bleibt" - und hat damit das Symptom erhalten statt
         der Absicht. Ein Spieler, dessen Datei genau so aussieht: "Habe dir gesagt
         8 Sekunden ohne Angriff aufs Ziel ist der Kampf am Dummy vorbei." Im
         Feld stand acht, gemeint waren acht. Also acht.
         Einmal unter dem neuen Namen zurueckgeschrieben, dann ist der alte
         Schluessel aus dem Weg und die Frage stellt sich nie wieder. */
      const savedSplit = typeof c.splitAfter === "number" && c.splitAfter > 0 ? c.splitAfter
                       : typeof c.gap === "number" && c.gap > 0 ? c.gap : null;
      if(savedSplit != null){
        // beidseitig geklemmt wie im Feld selbst: wer vor dieser Fassung 500
        // gespeichert hat, bekam sie beim naechsten Start ungeprueft zurueck
        state.gap = Math.min(120, Math.max(1, savedSplit)); $<HTMLInputElement>("#inGap").value = String(state.gap);
        if(typeof c.splitAfter !== "number") persistPref("splitAfter", savedSplit);
      }
      if(typeof c.minDur === "number" && c.minDur >= 0){
        state.minDur = Math.min(120, Math.max(0, c.minDur)); $<HTMLInputElement>("#inMin").value = String(state.minDur);
      }
      if(typeof c.devMode === "boolean") state.devMode = c.devMode;
      applyDevMode();
      if(typeof c.mergePhases === "boolean"){
        state.mergePhases = c.mergePhases; $<HTMLInputElement>("#inPhases").checked = c.mergePhases;
      }
      einstNachfuehren();   // die Einstellungen zeigen die gemerkten Werte wie das Filterfeld
      if(state.encounters.length){ segment(); state.sel = 0; renderAll(); }
      // force, because the saved value can equal what state already holds while
      // the page has never actually been zoomed to it
      if(typeof c.uiZoom === "number")
        setUiZoom(c.uiZoom, {quiet:true, force:true, fromStart:true, keepWindow: c.windowPlaced === true});
      // stored as the window alpha the launcher takes, shown as its complement
      if(typeof c.compactAlpha === "number" && c.compactAlpha <= 1 && c.compactAlpha > 0){
        state.seeThrough = clampSee(Math.round((1 - c.compactAlpha) * 100));
        applySeeThrough({quiet:true});
      }
      /* Gefragt werden die Knoepfe, nicht eine Liste daneben. Die alte
         Pruefung zaehlte dark, light und auto auf; als in 0.57 das TnL-Thema
         dazukam, wurde sie vergessen. Gespeichert wurde "tnl" richtig - in
         der eigenen Einstellungsdatei stand es -, aber die Seite nahm es beim
         Start nicht an und blieb dunkel, waehrend der Starter den Rahmen
         schon im TnL-Blau gemalt hatte. */
      const themen = new Set([...document.querySelectorAll<HTMLElement>("#themeRow button")]
                              .map(b => b.dataset.theme));
      if(themen.has(c.theme)){
        state.theme = c.theme; applyTheme(true);
      }
      // what earlier parties taught this app about skill names in the other
      // language; the shipped dictionary still wins over all of it
      if(c.skillNames && typeof c.skillNames === "object") state.learned = c.skillNames;
      /* and what earlier logs taught it about how much a boss lets through.
         Merged rather than assigned: this answer arrives whenever it arrives,
         and a log already read by then would otherwise lose what it had just
         learned. Every field is a maximum, so merging is simply the larger. */
      if(c.ventiusTop && typeof c.ventiusTop === "object"){
        for(const k in c.ventiusTop){
          const s = c.ventiusTop[k];
          if(!s || typeof s !== "object") continue;
          /* A record whose own name no longer keys to where it sits was written
             under an older rule. Until the boss groups existed, every boss of a
             dungeon shared one key, so Vulkan's ceiling was stored as Zairos'
             and Quente's as the gatekeeper's - and since every field here is a
             maximum, it would have stayed there for good. Thrown away rather
             than re-keyed: such a record is a maximum over two enemies and
             belongs to neither. It is learned again on the next run.
             Tested by the name it carries, not by the table, so this keeps
             working if the key ever changes again. */
          if(!s.name || ventiusTargetKey(s.name) !== k) continue;
          const have = state.ventiusTop[k];
          if(!have || (s.waves|0) > (have.waves|0)) state.ventiusTop[k] = s;
          else if((s.waves|0) === (have.waves|0)){
            if((s.atTop|0) > (have.atTop|0)) have.atTop = s.atTop|0;
            if((s.casts|0) > (have.casts|0)) have.casts = s.casts|0;
          }
        }
      }
      state.ghostPref = !!c.ghost;
      state.randlosGesehen = c.randlosGesehen === true;
      /* Der Rundgang beim ersten Start (63): gesehen, und ob dies eine neue
         Installation ist - der Hauptprozess meldet, dass seine Einstellungen
         beim Start nichts kannten (firstStart: kein Log-Ordner, keine
         Einstellung, kein Verlauf), und gelesen ist auch nichts. Ein aelterer
         Hauptprozess meldet es nicht: dann kein Rundgang von selbst. */
      state.rundgangGesehen = c.rundgangGesehen === true;
      state.ersterStart = c.firstStart === true
        && !(c.logIndex && typeof c.logIndex === "object" && Object.keys(c.logIndex).length);
      rundgangVonSelbst();
      // die gespeicherte Sprache des Hauptprozesses; weicht die Seite ab, schreibt sie ihre (66)
      spracheGelesen(c.lang);
      /* Windows (Windows-Einbindung 9, 3.4): den Abschnitt gibt es nur, wenn
         der Hauptprozess windows meldet (eigenes Fenster unter Windows); jeder
         Schalter gilt nur als an, wenn er ausdruecklich true ist. Gezeigt wird
         er mit dem naechsten einstNachfuehren (updateSchalterStand gleich hier). */
      state.win = c.windows && typeof c.windows === "object" ? {da: c.windows.da === true, autostartDa: c.windows.autostartDa === true,
        autostart: c.windows.autostart === true, melden: c.meldenKampf === true, nurBest: c.meldenNurBest === true,
        tray: c.trayBeimSchliessen === true} : null;
      // der Update-Hinweis: aus, solange nicht ausdruecklich an (Spezifikation Update-Hinweis 2.4)
      updateSchalterStand(c.updatePruefen === true);
      // eingeschaltet: die Antwort von GitHub kann nach dem ersten /api/state kommen (55)
      if(c.updatePruefen === true && !KOMPAKT_FENSTER) updateNachfragen();
      /* Das Kompaktfenster ist Kompakt von Anfang an, bevor die
         Einstellungen da waren: der Randlos-Hinweis kommt jetzt. */
      if(KOMPAKT_FENSTER) randlosHinweis();
      if(state.encounters.length && state.tab === "weapons") renderWeapons();
      konfigFertig(true);
    }).catch(() => konfigFertig(false));
    $("#btnWatch").onclick = $("#btnWatch2").onclick = toggleServedWatch;
    syncLiveBtn();   // der title sagt jetzt "Klicken zum Starten", nicht "Ordner waehlen"
    // learn the folder silently, so the button can skip re-asking for a path
    // next time — but never auto-load whatever is already sitting in it
    fetch("/api/state").then(r => r.json()).then(s => {
      serverDir = s.dir || "";
      einstNachfuehren();
      syncKwKnopf();   // mit Log-Ordner hat die Pille auch ohne Log etwas zu waehlen (#155)
      // was der Hauptprozess beim Start bei GitHub fand, geprueft (55)
      setzeUpdate(s.update);
      /* Nur das eigene Fenster bekommt den nativen Rahmen. nativeFrame meldet
         der Server jedem, der fragt, auch einem Browser-Tab auf 127.0.0.1 -
         und eine Ziehflaeche oder ein Schliessen dort wirkte auf ein Fenster,
         das der Tab gar nicht ist. Welches es ist, sagt die Marke an der
         eigenen URL (OWN_WINDOW). */
      if(s.nativeFrame && OWN_WINDOW){
        eigenerRahmen();
        document.documentElement.classList.toggle("acrylic", !!s.material);
        micaMerken(s);   // Rauchglas: liegt das grosse Fenster auf Mica (37)
        // erst jetzt die Durchsicht des Kompaktfensters (Kompakt-Fix 4, 37)
        if(KOMPAKT_FENSTER) materialGemeldet();
        /* Schon kompakt, bevor /api/state da war (Taskleistenknopf oder
           Kuerzel gleich nach dem Start): dann hat der Umschalter "material"
           noch nicht geschickt, weil "native" fehlte, und "chrome" holte die
           Systemknoepfe ueber den 26-Punkte-Streifen. Also dieselbe Wahl wie
           in 39-themes.ts: im Kompaktmodus Acrylic (ob Windows es kann,
           entscheidet der Hauptprozess), sonst die Knoepfe im Thema. */
        if(document.body.classList.contains("compact"))
          winPost({do:"material", kind:"acrylic",
                   theme: document.documentElement.dataset.theme, height: kopfHoehe()});
        else syncRahmenKnoepfe();
        syncWindowVars();   // die Knoepfe sind jetzt da, ihr Platz in der Kopfleiste auch
      }
      // if the last session closed while pinned in compact, remember that so
      // the first time compact is entered again it is restored automatically —
      // a normal exit from compact always clears it first, and a pin in the
      // full view is never kept (remember:false), so this only ever fires
      // after an unexpected close while genuinely in use as an overlay
      /* Im Kompaktfenster nicht: es ist von selbst immer vorn. */
      state.pinPref = !!s.stayOnTop && !KOMPAKT_FENSTER;
      /* Kompakt als eigenes Fenster (N4): im grossen Fenster der App, wenn
         der Hauptprozess es kann (Windows mit Acrylic) - sonst schrumpft
         Kompakt das Fenster wie bisher. Das Kompaktfenster selbst startet so,
         wie es geoeffnet wurde (mit Live, durchklickbar). */
      state.zweiFenster = !!s.kompaktFenster && OWN_WINDOW && !KOMPAKT_FENSTER;
      if(state.zweiFenster) setKompaktOffen(!!(s.kompakt && s.kompakt.offen));
      if(KOMPAKT_FENSTER){
        kompaktFensterStart(!!(s.kompakt && s.kompakt.durch));
        if(s.kompakt && s.kompakt.live && serverDir && !isWatching()) beginServedWatch();
        /* sonst zeigt er, was die Vollansicht zeigt (Kompakt-Fix 01.10., 23) */
        else void streifenFolgt(s.kompakt);
      }
      /* Das Zeichen "Seite fertig" fuer die Seitentests (Neugestaltung
         28.09., Befund 2): der Ordnerstand der Startseite geht, das Zeichen
         bleibt - "ordner", wenn der Helfer einen Log-Ordner kennt, sonst
         "ohne". Gesetzt, nachdem Rahmen und Fensterknoepfe stehen. */
      document.body.dataset.bereit = serverDir ? "ordner" : "ohne";
      /* Start: kennt der Helfer keinen Log-Ordner, sagt die Einrichtung das
         jetzt (DECISION 1.12); sonst steht "Zuletzt geoeffnet" da. */
      renderStart();
      /* Ein Auftrag aus der Sprungliste (66): erst jetzt, wo Log-Ordner und
         Kompakt als eigenes Fenster bekannt sind - "live" und "kompakt"
         klicken dieselben Knoepfe wie der Spieler. */
      void startAuftragHolen();
    }).catch(() => { if(!document.body.dataset.bereit) document.body.dataset.bereit = "ohne"; renderStart(); });
    fetch("/api/party/server").then(r => r.json()).then(s => { state.partyServer = s.server || ""; if(state.tab === "party") renderParty(); serverStatusNachfuehren(); }).catch(() => {});
    pollParty();
    setInterval(pollParty, 3000);
  }
}
