import { state } from "./01-state";
import { dur, fmt, toast, toastFail } from "./03-helpers";
import { zeileZeit } from "./04-log-parsing";
import { bareBoss, DUNGEON_TAFEL, histKey, knownBoss, OFFENE_BOSSE, stats } from "./06-blocks-and-places";
import { bossMark } from "./12-boss-images";
import { t, tt } from "./08-translation";
import { $, esc, wallTime } from "./18-interface-basics";
import { archivKampfKommt, oeffneDateien, waehleKampf } from "./23-kampfwahl";
import { persistPref } from "./27-weapons-tab";
import { einordHtml, histFuerArchiv, histPlot, kaempfeAmBoss, legendeHtml, loadText, setLoadOrigin, type VKampf } from "./32-history";
import { switchTab } from "./34-menus-drop-and-tabs";
import { ABRISS_FENSTER, konfigGelesen, SERVED } from "./41-server-mode";
import { isWatching } from "./45-startup";
import { archivNamenHaken, charakterNamen } from "./59-weeklies";
import { archivEintrag, archivKurve, archivMenge, type MengeKampf, archivOrte, archivPlatz, archivPlatzJetzt, archivSchluessel, archivStatistik, archivZahlen, auswahlUmschalten, bestaetigungOk, bossListeAus, geloesteGruppen, kampfStueck, loeschSoll, logZeilen, type ArchivFilter, type ArchivKampf, type ArchivOrt, type LogZeilen } from "../archiv-core";
import { abendText } from "../build-core";
import { besterPull } from "../best-pull-core";
import { abendAchse, imZeitraum, zeitSpanne, type Zeitraum } from "../verlauf-core";
import { albumTafel } from "../rekorde-core";
import type { Encounter, HistFight } from "../types";

/* ---------- Log-Archiv: die Aufnahme (Spezifikation Log-Archiv 3, 4, 6; #264) ----------
   Ein Kampf, den der Verlauf festhaelt (histRecord in 32-history.ts) und dessen
   Boss einen Platz in der Tabelle hat, geht als Stueck des Logs an
   POST /api/archiv/aufnehmen: Kopfzeilen und die Zeilen des Kampfs, geschnitten
   von kampfStueck (archiv-core.ts). Nie Trash, nie der Beispielkampf, nie bei
   ausgeschaltetem Archiv, nie im Browser ohne App (SERVED falsch), nie vor
   dem quittierten Erststart-Hinweis (archivHinweis, Spezifikation 6; der
   Hinweis steht auf Start, 45, der Schalter in den Einstellungen, 57).

   Still und ohne zu warten: archivAufnehmen merkt sich nur den Auftrag, die
   Arbeit (Schnitt und Senden) laeuft danach, eine Anfrage nach der anderen,
   und zwischen zwei Auftraegen bekommt die Seite den Faden zurueck.
   Ein Fehlschlag wird verschluckt; der naechste Start versucht es wieder.
   Geschnitten und gesendet wird nur, was im Verzeichnis fehlt oder gewachsen
   sein kann: das Verzeichnis wird einmal gefragt, danach fuehrt die Seite es
   selbst nach. Ein Log wird je Text hoechstens einmal in Zeilen zerlegt.

   Dieser Teil spricht nur mit /api/archiv/ und haengt an nichts, was den PC
   verlaesst (Audit 13d.P1, 13d.P2). Im Verzeichnis stehen nur Kennungen,
   Zahlen und der Logname; Spielernamen stehen allein in den Zeilen. */

/* wie TEXT_RX und DATEI_RX in src/main/archiv.ts: ein Bossname bis 80 Zeichen, der Logname bis 300
   (mehrere zusammen geoeffnete Logs heissen "a + b + c", wie im Verlauf) */
const BOSS_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,80}$/u;
const DATEI_RX = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]{1,300}$/u;

/* Kann das Archiv nicht schreiben (503 beim Verzeichnis oder beim Aufnehmen), sagt es der
   Abschnitt Archiv der Einstellungen (57) mit einem ruhigen Satz, kein Toast (Spezifikation 6).
   Der naechste Erfolg nimmt den Satz wieder weg. */
let schreibfehler = false;
/** Kann das Archiv gerade nicht schreiben? (fuer den Satz in den Einstellungen) */
export function archivSchreibfehler(): boolean { return schreibfehler; }
/** Haken fuer die Einstellungen (57): der Zustand hat sich geaendert. */
export const archivHaken: {geaendert: (() => void) | null} = {geaendert: null};
function fehlerSetzen(neu: boolean){
  if(neu === schreibfehler) return;
  schreibfehler = neu;
  archivHaken.geaendert?.();
}

/* archivAn aus den Einstellungen (41 setzt es beim Lesen): an, solange nicht ausdruecklich aus */
let an = true;
/* archivHinweis: die Fassung des Erststart-Hinweises, die quittiert ist (0: keine).
   null, bis die Einstellungen ihn melden - dann kein Hinweis und keine Aufnahme.
   Ein Hauptprozess mit Archiv meldet ihn immer (server.ts, Standard 0); fehlt
   er, kennt der Hauptprozess kein Archiv (wie firstStart beim Rundgang, 41). */
let hinweis: number | null = null;
/** Aus den Einstellungen (41-server-mode.ts): archivAn (false nur, wenn dort false) und archivHinweis. */
export function archivKonfig(wert: unknown, gesehen?: unknown){
  an = wert !== false;
  hinweis = typeof gesehen === "number" && Number.isSafeInteger(gesehen) && gesehen >= 0 ? gesehen : null;
}
/** Nimmt das Archiv auf? (Einstellung archivAn, Standard an) */
export function archivAn(): boolean { return an; }
/** Ist der Erststart-Hinweis quittiert? Vorher nimmt das Archiv nichts auf (Spezifikation 6). */
export function archivHinweisGesehen(): boolean { return (hinweis ?? 0) >= 1; }
/** Steht der Hinweis auf Start? Nur mit dem Helfer, nach den Einstellungen, bei eingeschaltetem Archiv. */
export function archivHinweisZeigen(): boolean { return SERVED && hinweis !== null && hinweis < 1 && an; }
/** "Verstanden" auf Start: quittiert, ab jetzt nimmt das Archiv auf. */
export function archivHinweisQuittieren(): void {
  if(archivHinweisGesehen()) return;
  hinweis = 1;
  persistPref("archivHinweis", 1);
}
/** Der Schalter in den Einstellungen (57). Wer ihn bedient, kennt das Archiv: das quittiert den Hinweis mit. */
export function archivSchalten(neu: boolean): void {
  an = neu;
  persistPref("archivAn", neu);
  archivHinweisQuittieren();
}

/* Die Plaetze der Bosstabelle, einmal gebaut */
let orte: ArchivOrt[] | null = null;
const plaetze = () => orte ??= archivOrte(albumTafel(DUNGEON_TAFEL, OFFENE_BOSSE));

/* Das Verzeichnis: einmal gefragt, danach nach jedem eigenen Senden selbst nachgefuehrt */
let stand: ArchivKampf[] | null = null;
/* zaehlt jede Aenderung des Verzeichnisses: der Bereich (unten) zeichnet nur, wenn sich etwas geaendert hat */
let standNr = 0;
let standFrage: Promise<ArchivKampf[] | null> | null = null;
/** Das Verzeichnis des Archivs (ohne Zeilen); null im Browser ohne App oder wenn es nicht zu lesen ist.
    neu: noch einmal fragen (nach dem Loeschen); bis die Antwort kommt, bleibt der gemerkte Stand stehen. */
export function archivStand(neu = false): Promise<ArchivKampf[] | null> {
  if(!SERVED) return Promise.resolve(null);
  if(stand && !neu) return Promise.resolve(stand);
  standFrage ??= fetch("/api/archiv/liste").then(r => {
    if(r.status === 503) fehlerSetzen(true);
    return r.ok ? r.json() : null;
  }).then((d: unknown) => {
    const k = (d as {ok?: unknown; data?: {kaempfe?: unknown}} | null)?.data?.kaempfe;
    if((d as {ok?: unknown} | null)?.ok !== true || !Array.isArray(k)) return null;
    stand = k as ArchivKampf[];
    standNr++;
    fehlerSetzen(false);
    return stand;
  }).catch(() => null).finally(() => { standFrage = null; });
  return standFrage;
}

/* Ein Auftrag: der Eintrag ist fertig, der Schnitt kommt erst bei der Arbeit.
   Der Text ist eine Zeichenkette - festgehalten wird nur der Verweis auf ihn. */
interface Auftrag {
  /** der Eintrag; zeilen steht auf 0, bis der Schnitt sie kennt */
  eintrag: ArchivKampf;
  /** das Ende des Kampfs (ms, Uhr des Logs) */
  bis: number;
  text: string;
  delim: string;
  zeit: number;
  kopf: boolean;
  /** wann der Kampf zuletzt anders war (Uhr der Seite): solange er unter Live waechst, wartet er */
  seit: number;
}
/* nach Schluessel: ein neuerer Auftrag fuer denselben Kampf ersetzt den alten */
const offen = new Map<string, Auftrag>();
let arbeitet = false;
let wecker: ReturnType<typeof setTimeout> | null = null;
let geprueft = 0;
/* Die Zahl der Kaempfe, ueber die entschieden ist (gesendet, uebersprungen,
   verworfen) - fuer die Seitentests, die auf Zustand warten (#224). */
function erledigt(n = 1){
  geprueft += n;
  document.body.dataset.archivGeprueft = String(geprueft);
}

/* Der Platz eines Kampfs: mehrere Ziele ("A · B") je fuer sich, das erste mit Platz zaehlt */
function platzVon(name: string, c: number | undefined): {platz: string; boss: string} | null {
  for(const teil of String(name || "").split("·")){
    const boss = bareBoss(teil.trim());
    const platz = archivPlatz(boss, plaetze(), c);
    if(platz) return {platz, boss};
  }
  return null;
}

/* Derselbe Kampf wie im Verzeichnis (oder dort geloest): dann gibt es nichts zu schneiden */
const unveraendert = (e: ArchivKampf, da: ArchivKampf | undefined) =>
  !!da && (!!da.geloest || (da.at === e.at && da.dur === e.dur && da.dmg === e.dmg));

/* Der Auftrag eines Kampfs aus dem Stand der Seite (state ist der Text, aus dem er kommt), wenn er ins
   Archiv gehoert; sonst null. Fuer die Aufnahme (archivAufnehmen) und fuer "Alte Logs einlesen" (archivAusLog). */
function auftragVon(f: HistFight, seg: Encounter): Auftrag | null {
  // ein Kampf aus dem Archiv (oeffneArchivKampf) liegt schon dort (histRecord laesst ihn ohnehin aus)
  if(!SERVED || state.origin === "sample" || state.origin === "archiv" || !state.text || !state.wall) return null;
  const m = state.mapping, g = state.parsed;
  if(!g || m.time == null) return null;
  // die Summe einer Gruppe ("alle" bei mehreren Angreifern) ist nie dein Kampf (32, f.g)
  if(f.g) return null;
  const ort = platzVon(f.name, f.c);
  if(!ort) return null;
  const datei = (state.fileNames || []).join(" + ");
  if(!DATEI_RX.test(datei) || !BOSS_RX.test(ort.boss) || !Number.isSafeInteger(f.at) || f.at < 0) return null;
  const eintrag = archivEintrag(f, ort, datei, 0);
  // der Schluessel (Logname, "|", Beginn) hat dieselbe Grenze wie im Speicher: 300 Zeichen
  if(eintrag.k.length > 300) return null;
  return {eintrag, bis: seg.end, text: state.text, delim: g.delim, zeit: m.time, kopf: g.hasHeader, seit: Date.now()};
}

/** Ein Kampf aus histRecord (32-history.ts) ins Archiv, wenn er dorthin gehoert. Still, wirft nie. */
export function archivAufnehmen(f: HistFight, seg: Encounter): void {
  // das abgerissene Fenster (Windows Teil 2) nimmt nichts auf: das tut die Vollansicht
  if(ABRISS_FENSTER) return;
  try {
    const neu = auftragVon(f, seg);
    if(!neu) return;
    const eintrag = neu.eintrag, k = eintrag.k;
    // schon bekannt und unveraendert: kein Auftrag (das Verzeichnis ist dann schon gelesen)
    if(!offen.has(k) && stand && unveraendert(eintrag, stand.find(x => x.k === k))){ erledigt(); return; }
    /* Ein Auftrag fuer denselben Kampf ersetzt den alten; war der Kampf
       derselbe (Live liest die ganze Datei neu), bleibt die Zeit, seit der er
       nicht mehr waechst. */
    const alt = offen.get(k);
    if(alt) erledigt();
    if(alt && unveraendert(eintrag, alt.eintrag)) neu.seit = alt.seit;
    offen.set(k, neu);
    void arbeiten();
  } catch { /* das Archiv haelt den Verlauf nie auf */ }
}

/* Laeuft der Kampf noch? Unter Live der neueste, gewachsen vor weniger als der
   Kampftrennung - wie die anderen Teile (26, 46, 53) ohne die Auswahl: auch mit
   einem aelteren gewaehlten Kampf ginge sonst jedes Wachstum einzeln an den
   Speicher. Er wartet, und der Wecker nimmt ihn nach der Kampftrennung mit. */
const restMs = (a: Auftrag) => isWatching() && state.encounters[0]?.start === a.eintrag.at
  ? state.gap * 1000 - (Date.now() - a.seit) : 0;

function wecken(){
  if(wecker) clearTimeout(wecker);
  wecker = null;
  const rest = [...offen.values()].map(restMs);
  if(!rest.length) return;
  wecker = setTimeout(() => { wecker = null; void arbeiten(); }, Math.max(0, Math.min(...rest)) + 50);
}

async function arbeiten(){
  if(arbeitet) return;
  arbeitet = true;
  try {
    for(;;){
      // zwischen zwei Auftraegen zeichnet die Seite (wie das Nachlesen der Rekorde, 62)
      await new Promise(r => setTimeout(r, 0));
      const a = [...offen.values()].find(x => restMs(x) <= 0);
      if(!a) break;
      offen.delete(a.eintrag.k);
      try { await einer(a); } catch { /* still; der naechste Start versucht es wieder */ }
      erledigt();
    }
  } finally {
    arbeitet = false;
    wecken();
  }
}

/* Ein Log in Zeilen mit ihrer Zeit (logZeilen); die Kopfzeile eines Logs mit Spaltennamen gehoert ins
   Stueck: sie zaehlt als Zeile jedes Kampfs */
function zerlege(a: Auftrag): LogZeilen {
  let kopfOffen = a.kopf;
  const l = logZeilen(a.text, zeile => {
    if(kopfOffen){ kopfOffen = false; return null; }
    return zeileZeit(zeile, a.delim, a.zeit);
  });
  if(a.kopf){ const i = l.zeiten.findIndex(t => t !== "kopf"); if(i >= 0) l.zeiten[i] = "kopf"; }
  return l;
}
/* Das zuletzt zerlegte Log: derselbe Text wird fuer jeden seiner Kaempfe nur einmal zerlegt */
let zerlegt: {text: string; l: LogZeilen} | null = null;
function zeilenVon(a: Auftrag): LogZeilen {
  if(zerlegt && zerlegt.text === a.text) return zerlegt.l;
  const l = zerlege(a);
  zerlegt = {text: a.text, l};
  return l;
}

/* Wie es um einen Kampf steht, bevor er gesendet wird: "schon" (so oder groesser im Verzeichnis, oder dort
   geloest), "leer" (kein Stueck, zu gross) oder das Stueck mit seinem Eintrag (zeilen = Zeilen des Stuecks). */
type Vorab = "schon" | "leer" | {eintrag: ArchivKampf; text: string};
function vorab(a: Auftrag, liste: readonly ArchivKampf[], l: () => LogZeilen): Vorab {
  // vor dem Schnitt: ist der Kampf so schon da, gibt es nichts zu tun
  const da = liste.find(x => x.k === a.eintrag.k);
  if(unveraendert(a.eintrag, da)) return "schon";
  const text = kampfStueck(l(), a.eintrag.at, a.bis);
  if(!text) return "leer";
  const zeilen = text.split("\n").length;
  if(da && da.zeilen >= zeilen) return "schon";
  return {eintrag: {...a.eintrag, zeilen}, text};
}
/* Ein Stueck an POST /api/archiv/aufnehmen; danach fuehrt die Seite das Verzeichnis selbst nach.
   Der Status der Antwort (0: keine Antwort); 503 heisst: das Archiv kann nicht schreiben. */
async function senden(eintrag: ArchivKampf, text: string, liste: ArchivKampf[]): Promise<number> {
  const r = await fetch("/api/archiv/aufnehmen", {method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({eintrag, text})});
  if(r.status === 503) fehlerSetzen(true);
  if(!r.ok) return r.status;
  fehlerSetzen(false);
  const i = liste.findIndex(x => x.k === eintrag.k);
  if(i >= 0) liste[i] = {...liste[i], ...eintrag}; else liste.push(eintrag);
  standNr++;
  if(bereichOffen) zeichneArchiv();
  return r.status;
}

async function einer(a: Auftrag){
  /* erst die Einstellungen: ohne sie ist nicht zu sagen, ob das Archiv an und
     der Hinweis quittiert ist. Vor "Verstanden" wird nichts aufgehoben, auch
     nicht nachtraeglich: der Kampf zaehlt als entschieden (Spezifikation 6). */
  if(!(await konfigGelesen) || !an || !archivHinweisGesehen()) return;
  const liste = await archivStand();
  if(!liste) return;
  const v = vorab(a, liste, () => zeilenVon(a));
  if(typeof v === "string") return;
  await senden(v.eintrag, v.text, liste);
}

/* ---------- Alte Logs einlesen (Spezifikation Log-Archiv 8; #264) ----------
   Nur auf Klick (Einstellungen, Abschnitt Archiv, 57): 75-alte-logs.ts liest den Log-Ordner, eine Datei nach
   der anderen, und reicht jede ganz hierher. Ihre Kaempfe rechnet 32 (histFuerArchiv) mit denselben Schritten
   wie das Nachlesen der Rekorde, ohne Eintrag in den Verlauf; hier entscheidet dieselbe Pruefung wie bei der
   Aufnahme (auftragVon: Boss der Tabelle oder Puppe, nie Trash, nie die Summe einer Gruppe), und gesendet wird
   ueber dasselbe POST. Was im Verzeichnis so oder groesser steht, zaehlt als "schon da". Zwischen zwei
   Kaempfen bekommt die Seite den Faden zurueck. Nur bei eingeschaltetem Archiv und quittiertem Hinweis. */
/** Geht "Alte Logs einlesen" jetzt? Nur in der App, bei eingeschaltetem Archiv, nach "Verstanden". */
export function archivEinlesenGeht(): "ja" | "browser" | "aus" | "hinweis" {
  if(!SERVED) return "browser";
  if(!an) return "aus";
  if(!archivHinweisGesehen()) return "hinweis";
  return "ja";
}
/** Warum das Einlesen anhaelt: das Archiv ist aus (oder der Hinweis offen; 409 beim Senden), sein Verzeichnis
    antwortet nicht, es kann nicht schreiben (503). */
export type ArchivHalt = "aus" | "stand" | "schreiben";
/** Die Kaempfe eines ganzen Logs (name, text) ins Archiv: neu gesendet, schon da, ohne Antwort nicht gesendet;
    halt: nicht weiterlesen, mit dem Grund. */
export async function archivAusLog(name: string, text: string, abbruch: AbortSignal): Promise<{neu: number; schon: number; nichtGesendet: number; halt: ArchivHalt | null}> {
  const aus: {neu: number; schon: number; nichtGesendet: number; halt: ArchivHalt | null} = {neu: 0, schon: 0, nichtGesendet: 0, halt: null};
  if(!(await konfigGelesen) || archivEinlesenGeht() !== "ja"){ aus.halt = "aus"; return aus; }
  const liste = await archivStand();
  if(!liste){ aus.halt = "stand"; return aus; }
  if(!DATEI_RX.test(name)) return aus;
  const auftraege: Auftrag[] = [];
  histFuerArchiv(name, text, (f, seg) => { const a = auftragVon(f, seg); if(a) auftraege.push(a); });
  // ein Log, einmal zerlegt; die Zeilen gehen mit dem letzten Kampf
  let l: LogZeilen | null = null;
  for(const a of auftraege){
    // ein Bild Luft zwischen zwei Kaempfen: Abbrechen und Rollen bleiben bedienbar
    await new Promise(r => setTimeout(r, 0));
    if(abbruch.aborted) break;
    const v = vorab(a, liste, () => l ??= zerlege(a));
    if(v === "schon"){ aus.schon++; continue; }
    if(v === "leer") continue;
    let status = 0;
    try { status = await senden(v.eintrag, v.text, liste); } catch { status = 0; }
    if(status >= 200 && status < 300) aus.neu++;
    // 409: das Archiv ist aus; 503: es kann nicht schreiben (der Satz in den Einstellungen sagt es)
    else if(status === 409){ aus.halt = "aus"; break; }
    else if(status === 503){ aus.halt = "schreiben"; break; }
    // keine Antwort: dieser Kampf ist nicht im Archiv, die anderen gehen weiter
    else if(status === 0) aus.nichtGesendet++;
  }
  return aus;
}

/* ---------- Die Suche: der Bereich Archiv (Spezifikation Log-Archiv 7, Aufbau B; #264; neu gestaltet #288) ----------
   Seit #288 (Spezifikation 2026-10-21-archiv-neu-design.md) sind die Bosse Karten in einem Raster (Bild, bester DPS,
   Kurve), darueber Filterchips (Raid, Dungeon, Feldboss, Uebungspuppe, "Nur mit Kaempfen"); die Kaempfe eines Bosses
   stehen in einer Seitenflaeche mit Kopf, Kurve und Tabelle. IDs, Rollen und Tasten der Listen blieben.

   Ein Ort wie die Rekorde (state.archiv, switchTab("archiv"), syncArchiv aus
   renderAll in 32), auch ohne geladenes Log offen. Oben das Suchfeld, darunter
   ab 900 Punkt zwei Spalten: links alle Bosse der Tabelle (bossListeAus in
   archiv-core.ts), gegliedert wie das Album, jeder auch ohne Kampf (gedaempft,
   "noch kein Kampf"), rechts der Zeile die Zahl der Kaempfe und der beste DPS;
   rechts die Kaempfe des gewaehlten Bosses, neueste zuerst. Darunter eine
   Spalte: ein Klick zeigt die Kaempfe, Zurueck (oder Esc) die Liste.

   Beide Listen sind eine listbox mit aria-activedescendant: der Fokus bleibt
   auf der Liste, die Pfeile, Pos1, Ende und Bild auf/ab bewegen die Auswahl,
   Enter waehlt den Boss und dann den Kampf, Esc geht eine Ebene hoch (Kaempfe
   -> Bosse -> Suchfeld). Was gewaehlt ist, sagt ein aria-live-Satz.

   Ein Klick auf einen Kampf holt seine Zeilen (GET /api/archiv/kampf?k=, der
   Schluessel kodiert), laedt sie wie einen frueheren Tag (loadText; Live
   pausiert, "Heute" nimmt es wieder auf) mit der Herkunft "archiv": histRecord
   (32) haelt davon nichts fest, das Archiv nimmt ihn nicht noch einmal auf.
   Der Kopf sagt "aus dem Archiv" (20, 30). Suche und Auswahl bleiben stehen,
   bis man sie aendert. Fehlt der Kampf (404 oder leer), sagt es ein ruhiger
   Satz im Bereich, kein Toast. Im Browser ohne App steht die Liste ohne
   Kaempfe mit dem Satz "Das Archiv gibt es nur in der App."

   Gezeichnet wird nur, solange der Bereich offen ist, und nur, wenn sich etwas
   geaendert hat (Marke): renderAll laeuft unter Live alle paar Sekunden. */

let bereichOffen = false;
let frage = "";
/** der gewaehlte Platz (ArchivOrt.id) */
let wahl: string | null = null;
/** schmales Fenster: welche Liste steht */
let stufe: "bosse" | "kaempfe" = "bosse";
/* die Filterchips: eine Art (oder alle) und "nur mit Kaempfen" */
let filterKat: ArchivFilter["kat"] = "alle";
let filterNur = false;
/* die Zeile, auf der die Tastatur steht (Platz bzw. Schluessel) */
let aktivBoss: string | null = null;
let aktivKampf: string | null = null;
/* der Satz nach einem Klick auf einen Kampf */
let kampfSatz: "" | "weg" | "fehler" = "";
let laedtKampf = false;
/* das Verzeichnis: "frage" (unterwegs), "da", "fehlt" (nicht lesbar) */
let standLage: "frage" | "da" | "fehlt" = "frage";
let marke = "";
/* Loesen und endgueltig Loeschen (#264 Teil 4): der Auswahlmodus der Bossseite und seine Auswahl (Archivschluessel),
   die Liste der Geloesten (offen, ihre Auswahl); wahlNr zaehlt jede Aenderung einer Auswahl (fuer die Marke) */
const AUF_EINMAL = 500;
let waehlen = false;
let auswahl = new Set<string>();
let gOffen = false;
let gAuswahl = new Set<string>();
let wahlNr = 0;
let loesenLaeuft = false;
/* die Archivschluessel der Bossseite und der Geloesten in der Reihenfolge der Zeilen */
let zeilenReihe: string[] = [];
let gReihe: string[] = [];

const schmal = () => document.documentElement.classList.contains("w-max-899");
const sprache = (): "de" | "en" => state.lang === "de" ? "de" : "en";
const ortName = (o: ArchivOrt) => o.id.startsWith("puppe:") ? t("rk.puppe", {s: o.id.slice(6)}) : sprache() === "de" ? o.de : o.en;
const unterName = (o: ArchivOrt) => o.unter ? (sprache() === "de" ? o.unter.de : o.unter.en) : "";
/* die Ueberschrift einer Gruppe in den Worten des Albums (rk.s.*, rk.g.*) */
function gruppeName(g: string){
  if(g === "raid" || g === "puppe" || g === "feld") return t("rk.s." + g);
  if(g === "erz" || g === "koloss" || g === "separat") return t("rk.g." + g);
  return t("rk.s.dungeon") + " · " + t("rk.g." + g);
}
/* Datum und Uhrzeit auf der Uhr des Logs (die UTC-Felder, wie im Verlauf) */
const datum = (at: number) => {
  const iso = new Date(at).toISOString().slice(0, 10);
  return abendText(iso, sprache()) + (sprache() === "de" ? "" : "/") + iso.slice(0, 4) + " " + wallTime(at).slice(0, 5);
};
const zahl = (n: number) => fmt(n, 1000);
/* der Name eines Charakters aus den Weeklies; ohne Zuordnung ein Strich (das Verzeichnis traegt nur die Kennung) */
const charakter = (ch: string | undefined, namen: Map<string, string>) => ch ? namen.get(ch) ?? "–" : "–";
/* das Bild eines Bosses (Spielbild, sonst die eigene Marke aus 12-boss-images; ohne beides ein leerer Rahmen) */
function bildVon(o: ArchivOrt, gross = ""): string {
  const kl = "arbild" + (gross ? " " + gross : "");
  for(const n of [...o.namen, o.en, o.de]){ const m = bossMark(n, kl); if(m) return m; }
  return '<span class="' + kl + ' keins" aria-hidden="true"></span>';
}
/* die Kurve der DPS ueber die Kaempfe (aelteste links); unter zwei Kaempfen nichts (archivKurve rechnet) */
function kurveSvg(kaempfe: readonly ArchivKampf[], w: number, h: number): string {
  const k = archivKurve(kaempfe.map(x => x.dps), w, h);
  if(!k) return "";
  return '<svg class="arkurve" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(t("ar.verlauf")) + '"><polyline class="arlinie" points="' +
    k.punkte.map(([x, y]) => x + "," + y).join(" ") + '"/>' +
    k.punkte.map(([x, y], i) => '<circle' + (i === k.best ? ' class="best"' : "") + ' cx="' + x + '" cy="' + y + '" r="' + (i === k.best ? 4 : 2.5) + '"/>').join("") + "</svg>";
}
/* Die Kaempfe des Verzeichnisses mit ihrem Platz in der heutigen Tabelle (Spezifikation 13): steht ein Platz
   nicht mehr in der Tabelle (umbenannt), findet der Name im Log (boss) ihn neu; sonst bleibt er, wie er ist.
   Im Verzeichnis wird nichts umgeschrieben. Einmal je Stand gerechnet, dazu die Zahlen je Platz (archivZahlen):
   ein Tastendruck in der Suche filtert danach nur noch die Plaetze, er zaehlt das Verzeichnis nicht neu. */
let jetzt: {nr: number; liste: ArchivKampf[]; zahlen: ReturnType<typeof archivZahlen>; proPlatz: Map<string, ArchivKampf[]>} | null = null;
const KEINE = new Map<string, {n: number; bester: number}>();
function kaempfeJetzt(): ArchivKampf[] {
  if(!SERVED || !stand) return [];
  if(jetzt && jetzt.nr === standNr) return jetzt.liste;
  const liste = stand.map(k => {
    const neu = archivPlatzJetzt(k, plaetze());
    return neu === k.platz ? k : {...k, platz: neu};
  });
  // je Platz die Kaempfe, aelteste zuerst (fuer die Kurven), ohne geloeste
  const proPlatz = new Map<string, ArchivKampf[]>();
  for(const k of [...liste].sort((a, b) => a.at - b.at)){
    if(k.geloest) continue;
    const a = proPlatz.get(k.platz);
    if(a) a.push(k); else proPlatz.set(k.platz, [k]);
  }
  jetzt = {nr: standNr, liste, zahlen: archivZahlen(liste), proPlatz};
  return liste;
}
function zahlenJetzt(){
  kaempfeJetzt();
  return SERVED && stand && jetzt ? jetzt.zahlen : KEINE;
}
/* der Zeitraum der Bossseite (Woche, Monat, Alles): ein eigener, nicht der des Verlaufs; vorbelegt Alles, das Archiv versteckt nichts */
let zeitArchiv: Zeitraum = "alles";
/* die Zeilen der Bossseite nach ihrer Kennung (Archivschluessel, sonst "v|Beginn|Datei"): fuer das Oeffnen */
const zeilenMap = new Map<string, MengeKampf<VKampf>>();
/* die Schluessel des Verlaufs (histKey) eines Platzes: seine Namen, soweit es bekannte Bosse sind (wie histTargets) */
function bossSchluessel(o: ArchivOrt): Set<string> {
  if(o.id.startsWith("puppe:")) return new Set();
  return new Set([o.en, o.de, ...o.namen].filter(n => knownBoss(n)).map(n => histKey(n)));
}
/* die Kaempfe eines Bosses aus Verlauf und Archiv zusammen (archivMenge, archiv-core.ts), aelteste zuerst;
   die Uebungspuppe fuehrt nur das Archiv (der Verlauf zeigt sie bewusst nicht) */
function bossMenge(o: ArchivOrt): MengeKampf<VKampf>[] {
  const verlauf = [...bossSchluessel(o)].flatMap(k => kaempfeAmBoss(k));
  return archivMenge(verlauf, kaempfeAlt(o.id));
}
/* die Kaempfe eines Platzes: neueste zuerst (Tabelle); kaempfeAlt: aelteste zuerst (Kurve) */
const kaempfeVon = (id: string) => { kaempfeJetzt(); return [...(jetzt?.proPlatz.get(id) ?? [])].reverse(); };
const kaempfeAlt = (id: string) => { kaempfeJetzt(); return jetzt?.proPlatz.get(id) ?? []; };

/** Aus renderAll (32): zeichnet, solange der Bereich steht; beim Oeffnen fragt es einmal nach dem Verzeichnis. */
export function syncArchiv(sichtbar: boolean){
  const geoeffnet = sichtbar && !bereichOffen;
  bereichOffen = sichtbar;
  // wer den Bereich verlaesst, laesst auch den Satz zu einem Kampf zurueck
  /* ... und Auswahlmodus, Auswahl und die Liste der Geloesten mit ihrer Auswahl (Spezifikation 8: beim Schliessen
     geraeumt); der Dialog ist modal, mit ihm verlaesst niemand den Bereich */
  if(!sichtbar){
    kampfSatz = "";
    if(waehlen || auswahl.size || gOffen || gAuswahl.size){ waehlen = false; auswahl = new Set(); gOffen = false; gAuswahl = new Set(); wahlNr++; }
    return;
  }
  if(geoeffnet){
    if(SERVED && !stand){
      standLage = "frage";
      void archivStand().then(l => { standLage = l ? "da" : "fehlt"; if(bereichOffen) zeichneArchiv(); });
    } else standLage = SERVED ? "da" : "frage";
  }
  zeichneArchiv();
}

/* Der Satz unter dem Suchfeld: hoechstens einer, der wichtigste zuerst. */
function satzText(){
  if(!SERVED) return t("einst.archivBrowser");
  if(kampfSatz === "weg") return t("ar.weg");
  if(kampfSatz === "fehler") return t("ar.lesefehler");
  if(standLage === "fehlt") return t("ar.standFehlt");
  if(!an) return t("ar.aus");
  if(!archivHinweisGesehen()) return t("ar.hinweisOffen");
  if(standLage === "da" && stand && !stand.some(k => !k.geloest)) return t("ar.leer");
  return "";
}

/* Das Verzeichnis noch einmal fragen (nach einer fehlenden Datei): der gemerkte Stand verfaellt. */
function neuLesen(){
  stand = null; standNr++; standLage = "frage";
  zeichneArchiv();
  void archivStand().then(l => { standLage = l ? "da" : "fehlt"; if(bereichOffen) zeichneArchiv(); });
}

/** Zeichnet den Bereich, wenn sich etwas geaendert hat. */
export function zeichneArchiv(){
  const bosse = document.getElementById("arBosse"), kaempfeBox = document.getElementById("arKaempfe");
  if(!bosse || !kaempfeBox) return;
  const namen = charakterNamen();
  const eng = schmal();
  /* die Zeile der Tastatur zaehlt nicht zur Marke: sie wechselt ohne Neuzeichnen (aktivZeigen) - sonst
     ersetzte schon der Fokus beim Klick die Zeile unter dem Zeiger, und der Klick kaeme nicht an */
  const seg = state.encounters[state.sel];
  const neu = JSON.stringify([state.lang, frage, filterKat, filterNur, wahl, stufe, kampfSatz, laedtKampf, standLage, standNr, an,
    archivHinweisGesehen(), eng, [...namen], zeitArchiv, state.hist.fights.length, seg ? seg.start : 0, (state.fileNames || []).join(" + "),
    document.getElementById("arVerlauf")?.clientWidth ?? 0, waehlen, gOffen, wahlNr, loesenLaeuft]);
  if(neu !== marke){ marke = neu; zeichneNeu(bosse, kaempfeBox, namen, eng); }
  aktivZeigen(bosse, kaempfeBox);
}

/* die Zeile der Tastatur je Liste (Klasse aktiv, aria-activedescendant; in den Kaempfen folgt die Auswahl),
   in den Blick gerollt, wenn die Tastatur sie bewegt hat (rollen) - nie unter dem Zeiger weg */
let gezeigt: [string | null, string | null] = [null, null];
let rollen = false;
function aktivZeigen(bosse: HTMLElement, kaempfeBox: HTMLElement){
  const finde = (box: HTMLElement, attr: string, wert: string | null) => wert ? box.querySelector<HTMLElement>("[" + attr + '="' + CSS.escape(wert) + '"]') : null;
  const ab = finde(bosse, "data-ort", aktivBoss), ak = finde(kaempfeBox, "data-k", aktivKampf);
  if(!ab) aktivBoss = null;
  if(!ak) aktivKampf = null;
  for(const [box, a] of [[bosse, ab], [kaempfeBox, ak]] as const){
    box.querySelectorAll<HTMLElement>(".aktiv").forEach(x => { if(x !== a) x.classList.remove("aktiv"); });
    a?.classList.add("aktiv");
    if(a) box.setAttribute("aria-activedescendant", a.id); else box.removeAttribute("aria-activedescendant");
  }
  // im Auswahlmodus sagt aria-selected, was gewaehlt ist (listbox mit aria-multiselectable); sonst folgt es der Tastatur
  const mehrfach = SERVED && waehlen;
  kaempfeBox.querySelectorAll<HTMLElement>("[role=option]").forEach(x => {
    const s = (mehrfach ? auswahl.has(x.dataset.k ?? "") : x === ak) ? "true" : "false";
    if(x.getAttribute("aria-selected") !== s) x.setAttribute("aria-selected", s);
  });
  if(rollen && aktivBoss !== gezeigt[0] && ab && bosse.getClientRects().length) ab.scrollIntoView({block: "nearest"});
  if(rollen && aktivKampf !== gezeigt[1] && ak && kaempfeBox.getClientRects().length) ak.scrollIntoView({block: "nearest"});
  gezeigt = [aktivBoss, aktivKampf];
  rollen = false;
}

function zeichneNeu(bosse: HTMLElement, kaempfeBox: HTMLElement, namen: Map<string, string>, eng: boolean){
  const fokusBosse = document.activeElement === bosse, fokusKaempfe = document.activeElement === kaempfeBox;

  /* links: die Bosse */
  const gruppen = bossListeAus(plaetze(), zahlenJetzt(), frage, sprache(), {kat: filterKat, nurMit: filterNur});
  const ids: string[] = [];
  let h = "", nr = 0;
  for(const g of gruppen){
    const gid = "arg-" + g.gruppe, mit = g.zeilen.filter(z => z.n).length;
    // die Ueberschrift benennt die Gruppe (aria-labelledby); der Zaehler steht daneben, nicht darin
    h += '<div class="argruppe" role="group" aria-labelledby="' + gid + '"><div class="arkopfz"><div class="arghead" id="' + gid + '" role="presentation">' + esc(gruppeName(g.gruppe)) +
      '</div><span class="argz">' + esc(t("ar.gruppeZahl", {n: g.zeilen.length, mit})) + "</span></div>";
    for(const z of g.zeilen){
      const o = z.ort, id = "arb-" + nr++;
      ids.push(o.id);
      const unter = unterName(o);
      const wert = z.n
        ? '<span class="arz"><span class="arzb"><b>' + esc(zahl(z.bester ?? 0)) + "</b> " + esc(t("ar.bester")) + '</span><span class="arzn">' + esc(t("ar.kaempfe", {n: z.n})) + "</span></span>"
        : '<span class="arz">' + esc(t("ar.keiner")) + "</span>";
      h += '<div class="arboss' + (z.n ? "" : " leer") + '" role="option" id="' + id + '" data-ort="' + esc(o.id) +
        '" aria-selected="' + (o.id === wahl ? "true" : "false") + '">' + bildVon(o) + '<span class="arn">' + esc(ortName(o)) + "</span>" +
        (unter ? '<span class="aru">' + esc(unter) + "</span>" : "") + wert + kurveSvg(kaempfeAlt(o.id), 120, 22) + "</div>";
    }
    h += "</div>";
  }
  bosse.innerHTML = h;
  bosse.dataset.frage = frage;
  bosse.dataset.stand = SERVED ? standLage : "browser";
  const leer = $("#arLeer");
  leer.hidden = !!ids.length;
  const anz = t("ar.gefunden", {n: ids.length}), az = $("#arAnzahl");
  if(az.textContent !== anz) az.textContent = anz;
  document.querySelectorAll<HTMLElement>("#arChips .archip").forEach(b => b.setAttribute("aria-pressed", b.dataset.kat === filterKat ? "true" : "false"));
  $("#arNur").setAttribute("aria-pressed", filterNur ? "true" : "false");

  /* rechts: die Seitenflaeche des gewaehlten Bosses (#292): Kopf, Zeitraum, Einordnung, die Grafik des Verlaufs und die
     Kaempfe aus Verlauf und Archiv, neueste zuerst, jede Zeile mit der Markierung, wo der Kampf liegt */
  const ort = wahl ? plaetze().find(o => o.id === wahl) ?? null : null;
  const menge = ort ? bossMenge(ort) : [];
  $("#arBossName").textContent = ort ? ortName(ort) : t("ar.kaempfeTitel");
  $("#arBossUnter").textContent = ort ? unterName(ort) : "";
  $("#arBossBild").innerHTML = ort ? bildVon(ort, "gross") : "";
  const st = archivStatistik(menge);
  const nArchiv = menge.filter(f => f.k).length;
  $("#arStat").innerHTML = st.n
    ? '<span class="arstat" data-w="n"><b>' + st.n + "</b> " + esc(t("ar.kaempfeWort", {n: st.n})) + '</span><span class="arstat" data-w="bester"><b>' + esc(zahl(st.bester)) + "</b> " + esc(t("ar.bester")) +
      '</span><span class="arstat" data-w="median"><b>' + esc(zahl(st.median)) + "</b> " + esc(t("ar.median")) + "</span>" +
      // liegen nicht alle Kaempfe im Archiv (der Verlauf kennt mehr), sagt es der Kopf
      (nArchiv < st.n ? '<span class="arstat" data-w="archiv"><b>' + nArchiv + "</b> " + esc(t("ar.imArchiv")) + "</span>" : "")
    : "";
  document.querySelectorAll<HTMLElement>("#arZeit button").forEach(b => b.setAttribute("aria-pressed", b.dataset.z === zeitArchiv ? "true" : "false"));
  // der Zeitraum endet mit dem Tag des neuesten Kampfs (zeitSpanne); Grafik und Liste zeigen dieselben Kaempfe
  const spanne = menge.length ? zeitSpanne(menge.map(f => f.at), zeitArchiv) : null;
  const liste = spanne ? imZeitraum(menge, spanne) : [];
  // Gold am besten Kampf nach der Regel des besten Pulls (best-pull-core), ueber die ganze Menge am Boss
  const gold = besterPull(menge);
  const besterK = gold ? liste.findIndex(f => f.at === gold.at) : -1;
  // der geladene Kampf, wenn er von diesem Boss ist: sein Ring und die Einordnung (dieselbe wie im Verlauf)
  const seg = state.encounters[state.sel];
  const segKey = seg ? histKey((seg.stats || stats(seg)).name) : "";
  const schluessel = ort ? bossSchluessel(ort) : new Set<string>();
  const cur = seg && schluessel.has(segKey) ? liste.findIndex(f => f.at === seg.start) : -1;
  $("#arEinord").innerHTML = ort && schluessel.has(segKey) ? einordHtml(segKey) : "";
  const verl = $("#arVerlauf");
  if(ort && spanne && liste.length){
    const logKey = (state.fileNames || []).join(" + ");
    const W = verl.clientWidth > 0 ? Math.max(240, Math.floor(verl.clientWidth)) : 360;
    const H = verl.clientHeight > 0 ? Math.max(160, Math.floor(verl.clientHeight)) : 220;
    const abend = abendAchse(liste.map(f => f.at));
    const bild = histPlot({name: ortName(ort)}, liste, cur, cur, besterK, W, H, spanne, logKey, abend);
    verl.innerHTML = bild.svg;
    $("#arLeg").innerHTML = legendeHtml(liste, logKey, besterK, bild.median, abend);
  } else { verl.innerHTML = ""; $("#arLeg").innerHTML = ""; }
  zeilenMap.clear();
  /* Loesen (#264 Teil 4), nur in der App: je Archivzeile der Knopf "Loesen" (unter dem Zeiger ueber dem Ende der Zeile; die
     Tastatur nimmt Entf auf der aktiven Zeile), im Auswahlmodus vorn das Kaestchen. Zeilen nur im Verlauf lassen sich nicht
     loesen. Gewaehlt bleibt nur, was noch auf der Bossseite steht. */
  const mitLoes = SERVED, mehrfach = mitLoes && waehlen;
  zeilenReihe = [...liste].reverse().flatMap(f => f.k ? [f.k] : []);
  if([...auswahl].some(k => !zeilenReihe.includes(k))) auswahl = new Set(zeilenReihe.filter(k => auswahl.has(k)));
  let kh = "";
  [...liste].reverse().forEach((f, i) => {
    const id = f.k ?? "v|" + f.at + "|" + (f.file ?? "");
    zeilenMap.set(id, f);
    const d = datum(f.at), wer = charakter(f.ch, namen), w = zahl(f.dps), lang = dur(f.dur), imAr = !!f.k;
    const gdl = liste[liste.length - 1 - i] === liste[besterK];
    const an = imAr && auswahl.has(id);
    const vor = !mehrfach ? "" : imAr ? '<span class="arwbox' + (an ? " an" : "") + '" aria-hidden="true">' + (an ? HAKEN : "") + "</span>" : '<span class="arwleer" aria-hidden="true"></span>';
    const nach = mitLoes && imAr && !mehrfach ? '<button type="button" class="btn sm arloes" tabindex="-1" aria-hidden="true" title="' + esc(t("ar.l.loesenTitel")) + '">' + esc(t("ar.l.loesen")) + "</button>" : "";
    kh += '<div class="arkampf" role="option" id="ark-' + i + '" data-k="' + esc(id) + '" aria-selected="' + (an ? "true" : "false") + '"' + (mehrfach && !imAr ? ' aria-disabled="true"' : "") +
      ' aria-label="' + esc(t("ar.kampfName", {d, wer, dps: w, dauer: lang}) + ", " + t(imAr ? "ar.imArchiv" : "ar.nurVerlauf")) + '">' + vor + '<span class="ard">' + esc(d) + '</span><span class="arc">' + esc(wer) +
      '</span><span class="arw">' + esc(w) + (gdl ? '<i class="punkt" aria-hidden="true"></i>' : "") + '</span><span class="art">' + esc(lang) + '</span><span class="arim ' + (imAr ? "ja" : "nein") +
      '" aria-hidden="true" title="' + esc(t(imAr ? "ar.imArchiv" : "ar.nurVerlauf")) + '"></span>' + nach + "</div>";
  });
  kaempfeBox.innerHTML = kh;
  for(const el of [kaempfeBox, $("#arSpalten")]){ el.classList.toggle("mitloes", mitLoes); el.classList.toggle("waehlen", mehrfach); }
  if(mitLoes){ kaempfeBox.setAttribute("aria-keyshortcuts", "Delete"); kaempfeBox.setAttribute("aria-describedby", "arWTipp"); }
  else { kaempfeBox.removeAttribute("aria-keyshortcuts"); kaempfeBox.removeAttribute("aria-describedby"); }
  if(mehrfach) kaempfeBox.setAttribute("aria-multiselectable", "true"); else kaempfeBox.removeAttribute("aria-multiselectable");
  leisteZeichnen(!!ort);
  kaempfeBox.hidden = !liste.length;
  if(laedtKampf) kaempfeBox.setAttribute("aria-busy", "true"); else kaempfeBox.removeAttribute("aria-busy");
  $("#arSpalten").hidden = !liste.length;
  const kleer = $("#arKLeer");
  const kSatz = liste.length ? "" : !ort ? t("ar.waehle") : SERVED ? t("ar.bossLeer") : t("einst.archivBrowser");
  if(kleer.textContent !== kSatz) kleer.textContent = kSatz;
  kleer.hidden = !kSatz;

  /* schmal: eine Spalte; die Kaempfe nur nach einer Wahl */
  const zwei = $("#arZwei");
  zwei.dataset.stufe = eng && stufe === "kaempfe" && ort ? "kaempfe" : "bosse";
  zwei.dataset.wahl = ort ? "1" : "0";
  $("#arZurueck").hidden = !(eng && zwei.dataset.stufe === "kaempfe");

  /* oben: Zahl der Kaempfe und der Satz */
  const alle = kaempfeJetzt().filter(k => !k.geloest);
  const quelle = alle.length ? t("ar.quelle", {n: alle.length, b: new Set(alle.map(k => k.platz)).size}) : "";
  const q = $("#arQuelle");
  if(q.textContent !== quelle) q.textContent = quelle;
  const satz = satzText(), sz = $("#arSatz");
  if(sz.textContent !== satz) sz.textContent = satz;
  sz.hidden = !satz;

  geloesteZeichnen();

  // der Fokus bleibt, wo er war; fiel seine Liste weg, geht er zur anderen
  if(fokusBosse && !bosse.getClientRects().length) kaempfeBox.focus({preventScroll: true});
  else if(fokusKaempfe && !kaempfeBox.getClientRects().length) bosse.focus({preventScroll: true});
}

function ansagen(text: string){
  const a = document.getElementById("arAnsage");
  if(!a) return;
  a.textContent = "";
  requestAnimationFrame(() => { a.textContent = text; });
}

/* einen Boss waehlen: rechts seine Kaempfe, der Fokus dorthin (gibt es keine, bleibt er in der Liste) */
function waehleBoss(id: string){
  const ort = plaetze().find(o => o.id === id);
  if(!ort) return;
  const anderer = wahl !== id;
  // ein anderer Boss: die Auswahl der Bossseite gilt nicht mehr
  if(anderer){ aktivKampf = null; waehlen = false; auswahl = new Set(); wahlNr++; }
  wahl = id; aktivBoss = id; stufe = "kaempfe"; kampfSatz = "";
  const liste = SERVED ? kaempfeVon(id) : [];
  if(liste.length && !aktivKampf) aktivKampf = liste[0]!.k;
  zeichneArchiv();
  // die Kaempfe eines anderen Bosses beginnen oben
  if(anderer) $("#arKaempfe").scrollTop = 0;
  ansagen(ortName(ort) + ": " + (liste.length ? t("ar.kaempfe", {n: liste.length}) : t("ar.keiner")));
  $(liste.length ? "#arKaempfe" : "#arBosse").focus({preventScroll: true});
}

/* eine Ebene hoch: von den Kaempfen zur Liste */
function zurueckZurListe(){
  stufe = "bosse";
  if(wahl) aktivBoss = wahl;
  // die Liste steht wieder (schmal): der gewaehlte Boss in den Blick
  rollen = true; gezeigt = [null, gezeigt[1]];
  zeichneArchiv();
  $("#arBosse").focus({preventScroll: true});
}

/* Jeder Abruf eines Kampfs hat seine Nummer: kommt die Antwort eines aelteren, nachdem ein neuerer begonnen
   hat ("Log oeffnen" zweimal schnell), laedt sie nichts mehr. Die Zahl der entschiedenen Abrufe steht fuer
   die Seitentests in body[data-archiv-kampf] (#224). */
let kampfLauf = 0, kampfFertig = 0;
/** Ein Kampf aus dem Archiv in den Meter: holt seine Zeilen und laedt sie wie einen frueheren Tag.
    aktuell ("Log oeffnen", 23): gilt der Klick noch? Sonst wird nichts geladen und nichts gesagt. */
export async function oeffneArchivKampf(k: string, aktuell?: () => boolean): Promise<boolean> {
  const e = (stand ?? []).find(x => x.k === k && !x.geloest);
  // ein Klick im Bereich, waehrend einer laedt, zaehlt nicht; "Log oeffnen" nimmt immer den neuesten
  if(!SERVED || !e || (laedtKampf && !aktuell)) return false;
  const mein = ++kampfLauf;
  laedtKampf = true; kampfSatz = "";
  zeichneArchiv();
  let text: string | null = null, fehlt = false;
  try {
    const r = await fetch("/api/archiv/kampf?k=" + encodeURIComponent(k), {signal: AbortSignal.timeout(20000)});
    fehlt = r.status === 404;
    text = r.ok ? await r.text() : null;
  } catch { text = null; }
  const neuester = mein === kampfLauf;
  if(neuester) laedtKampf = false;
  document.body.dataset.archivKampf = String(++kampfFertig);
  if(!neuester || (aktuell && !aktuell())){ zeichneArchiv(); return false; }
  const geladen = !!text && !!text.trim() && laden(text, e);
  if(!geladen){
    const weg = fehlt || (text !== null && !text.trim());
    kampfSatz = weg ? "weg" : "fehler";
    zeichneArchiv();
    ansagen(satzText());
    /* Fehlt die Datei, fragt die Seite das Verzeichnis neu: ob der Kampf danach noch gelistet ist, sagt es
       (die Datei kann fehlen, waehrend der Eintrag bleibt - der Satz behauptet darum nichts ueber die Liste). */
    if(weg) neuLesen();
    return false;
  }
  return true;
}
/* Eine Zeile der Bossseite oeffnen: liegt der Kampf im Archiv, kommt er von dort (oeffneArchivKampf); steht er nur im Verlauf,
   geht es wie "Log oeffnen" in den Rekorden (56, 62): die Datei ueber oeffneDateien (23) - fehlt sie, versucht es das Archiv
   (archivRueckfall), sonst sagt der Toast "Datei fehlt" - und dann der Kampf. Geoeffnet wird nichts geschrieben (Herkunft "archiv"
   bzw. wie beim Log). */
async function oeffneZeile(id: string){
  const f = zeilenMap.get(id);
  if(!f) return;
  if(f.k){ await oeffneArchivKampf(f.k); return; }
  const datei = f.file;
  if(!datei) return;
  const namen = datei.split(" + ");
  await oeffneDateien(namen, aktuell => archivRueckfall(datei, f.at, aktuell));
  if((state.fileNames || []).join(" + ") !== namen.join(" + ")) return;
  const i = state.encounters.findIndex(e => e.start === f.at);
  if(i >= 0) waehleKampf(i);
  document.getElementById("kwKnopf")?.focus({preventScroll: true});
}

/* ---------- "Log oeffnen" faellt auf das Archiv zurueck (Spezifikation Log-Archiv 8; #264) ----------
   Rekorde (62) und die Tafel (56) oeffnen ein Log ueber oeffneDateien (23). Fehlt die Datei im Ordner des Spiels
   (nicht in der Liste von /api/logs, oder /api/log antwortet 404 - nie bei einem Lesefehler), fragt 23 hier nach:
   steht der Kampf unter seinem Schluessel (Logname | Beginn) ungeloest im Archiv, kommt er von dort wie ein Klick
   im Bereich (oeffneArchivKampf). Sonst bleibt der bisherige Satz. */
/** Ist das Verzeichnis schon gelesen? (die Rekorde fragen es sonst beim Oeffnen einmal, 62) */
export function archivStandGelesen(): boolean { return SERVED && !!stand; }
/** Liegt der Kampf (Logname, Beginn) ungeloest im schon gelesenen Verzeichnis? Ohne Frage an den Helfer. */
export function archivKennt(datei: string, at: number | null | undefined): boolean {
  if(!SERVED || !stand || typeof at !== "number" || !Number.isSafeInteger(at)) return false;
  const k = archivSchluessel(datei, at);
  return stand.some(x => x.k === k && !x.geloest);
}
/** Der Rueckfall fuer "Log oeffnen": oeffnet den Kampf aus dem Archiv; false, wenn er dort nicht liegt oder nicht kommt. */
export async function archivRueckfall(datei: string, at: number | null | undefined, aktuell: () => boolean = () => true): Promise<boolean> {
  if(!SERVED || typeof at !== "number" || !Number.isSafeInteger(at)) return false;
  const liste = await archivStand();
  const k = archivSchluessel(datei, at);
  if(!liste || !liste.some(x => x.k === k && !x.geloest) || !aktuell()) return false;
  return oeffneArchivKampf(k, aktuell);
}

/* Laden wie ein frueherer Tag (23, tagLaden): Live pausiert, die Herkunft "archiv", dann der Kampf im Meter */
function laden(text: string, e: ArchivKampf): boolean {
  archivKampfKommt();
  setLoadOrigin("archiv");
  loadText(text, e.datei.split(" + "));
  if(state.origin !== "archiv" || !state.encounters.length) return false;
  const i = state.encounters.findIndex(x => x.start === e.at);
  state.sel = i >= 0 ? i : 0;
  switchTab("timeline");
  document.getElementById("kwKnopf")?.focus({preventScroll: true});
  return true;
}

/* ---------- Loesen und endgueltig Loeschen (Spezifikation 2026-10-26-archiv-loeschen-design.md 3 und 5, Aufbau B; #264 Teil 4) ----------
   Loesen nimmt Kaempfe aus Suche und Zahlen des Archivs, mit Rueckgaengig: je Zeile der Bossseite ("Loesen" unter dem
   Zeiger, Entf auf der Zeile der Tastatur) oder als Auswahl ("Auswaehlen", Kaestchen, "n gewaehlt"). Es ist eine Handlung
   des Nutzers und geht darum auch bei ausgeschaltetem Archiv. Der Hauptprozess setzt nur das Flag geloest; die Seite
   fuehrt danach ihr Verzeichnis selbst nach (flagSetzen), und Karten, Kopf, Grafik und Liste rechnen daraus neu.
   Endgueltig loeschen gibt es nur in der Liste der Geloesten ("Geloeste (n)" im Kopf, ueber alle Bosse) und nur durch
   den Dialog: dort steht, was geschieht, und erst der abgetippte Satz ("Boss TT.MM.JJJJ" bzw. die Anzahl) gibt den Knopf
   frei; der Hauptprozess prueft ihn selbst noch einmal, sichert zuerst und loescht nur Geloestes. Die Anfrage dafuer
   stellt allein archivLoeschenSenden, und das ruft allein der Knopf des Dialogs (loeschenBestaetigt; Audit 13d.P8).
   Diese Funktionen sprechen nur mit /api/archiv/ und nennen nichts sonst (Audit 13d.P7, 13d.P9). Hoechstens 500 Kaempfe
   auf einmal, wie der Hauptprozess sie nimmt; mehr gewaehlt sagt ein ruhiger Satz, und die Knoepfe warten. */
const HAKEN = '<svg viewBox="0 0 12 12"><path d="M2.5 6.2l2.4 2.4 4.6-5"/></svg>';
type LoesErgebnis = Record<string, string>;
/** POST /api/archiv/loesen: das Ergebnis je Schluessel ("ok", "schon", "unbekannt"), null ohne brauchbare Antwort. */
async function archivLoesenSenden(ks: string[], geloest: boolean): Promise<LoesErgebnis | null> {
  try {
    const r = await fetch("/api/archiv/loesen", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ks, geloest})});
    if(r.status === 503) fehlerSetzen(true);
    if(!r.ok) return null;
    const d = await r.json() as {ok?: unknown; ergebnis?: unknown} | null;
    if(d?.ok !== true || !d.ergebnis || typeof d.ergebnis !== "object") return null;
    return d.ergebnis as LoesErgebnis;
  } catch { return null; }
}
/** Was der Hauptprozess zum Loeschen sagt; grund "keine": keine Antwort, ob geloescht wurde, ist offen. */
type LoeschAntwort = {ok: true; sicherung: string; ergebnis: Record<string, string>} | {ok: false; grund: string; kaempfe?: string[]; sicherung?: string};
/** POST /api/archiv/loeschen. Gerufen allein vom Knopf des Dialogs (loeschenBestaetigt). */
async function archivLoeschenSenden(ks: string[], bestaetigung: string): Promise<LoeschAntwort> {
  try {
    const r = await fetch("/api/archiv/loeschen", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ks, bestaetigung})});
    // wie beim Loesen: kann das Archiv nicht schreiben, sagt es der Satz in den Einstellungen
    if(r.status === 503) fehlerSetzen(true);
    const d = await r.json().catch(() => null) as {ok?: unknown; grund?: unknown; kaempfe?: unknown; sicherung?: unknown; ergebnis?: unknown} | null;
    const sicherung = typeof d?.sicherung === "string" ? d.sicherung : undefined;
    if(r.ok && d?.ok === true && sicherung && d.ergebnis && typeof d.ergebnis === "object") return {ok: true, sicherung, ergebnis: d.ergebnis as Record<string, string>};
    const grund = typeof d?.grund === "string" ? d.grund : r.status === 400 ? "abgelehnt" : r.status === 503 ? "unavailable" : "keine";
    const kaempfe = Array.isArray(d?.kaempfe) ? d.kaempfe.filter((x): x is string => typeof x === "string") : undefined;
    return {ok: false, grund, ...(kaempfe ? {kaempfe} : {}), ...(sicherung ? {sicherung} : {})};
  } catch { return {ok: false, grund: "keine"}; }
}
/** POST /api/archiv/sicherungen: der Hauptprozess oeffnet seinen Ordner sicherungen; die Seite schickt keinen Pfad. */
async function archivSicherungenOeffnen(): Promise<boolean> {
  try {
    const r = await fetch("/api/archiv/sicherungen", {method: "POST", headers: {"Content-Type": "application/json"}, body: "{}"});
    return r.ok;
  } catch { return false; }
}

/* das Flag im gemerkten Verzeichnis, wie der Hauptprozess es gesetzt hat */
function flagSetzen(ks: readonly string[], geloest: boolean){
  if(!stand || !ks.length) return;
  const set = new Set(ks);
  stand = stand.map(e => {
    if(!set.has(e.k)) return e;
    if(geloest) return {...e, geloest: true};
    const {geloest: _weg, ...rest} = e;
    void _weg;
    return rest;
  });
  standNr++;
}
/* Faellt der Fokus weg (sein Knopf ist aus oder verschwunden), geht er zum ersten sichtbaren der Kandidaten */
function fokusRetten(...ziele: string[]){
  const a = document.activeElement as HTMLElement | null;
  if(a && a !== document.body && a.getClientRects().length && !(a as HTMLButtonElement).disabled) return;
  for(const sel of ziele){
    const z = document.querySelector<HTMLElement>(sel);
    if(z && z.getClientRects().length && !(z as HTMLButtonElement).disabled){ z.focus({preventScroll: true}); return; }
  }
}
const gewaehltText = (n: number) => t("ar.l.gewaehlt", {n}) + (n > AUF_EINMAL ? " · " + t("ar.l.grenze") : "");

/* Loesen (geloest true) oder Wiederherstellen (false): eine Anfrage, danach das Verzeichnis nachgefuehrt, die Meldung mit
   Rueckgaengig; ein Schluessel, den der Hauptprozess nicht kennt, laesst das Verzeichnis neu lesen */
/* ein Auftrag, der waehrend eines laufenden Loesens kam (etwa Rueckgaengig aus der Meldung): er geht danach, der neueste zaehlt */
let loesenDanach: {ks: string[]; geloest: boolean} | null = null;
async function loesenAus(ks: string[], geloest: boolean){
  if(!SERVED || !stand || !ks.length || ks.length > AUF_EINMAL) return;
  if(loesenLaeuft){ loesenDanach = {ks, geloest}; return; }
  try { await loesenEinmal(ks, geloest); }
  finally {
    const naechster = loesenDanach;
    loesenDanach = null;
    if(naechster) void loesenAus(naechster.ks, naechster.geloest);
  }
}
async function loesenEinmal(ks: string[], geloest: boolean){
  loesenLaeuft = true;
  zeichneArchiv();
  const erg = await archivLoesenSenden(ks, geloest);
  loesenLaeuft = false;
  if(!erg){
    zeichneArchiv();
    toastFail(tt("ar.l.fehler"));
    ansagen(t("ar.l.fehler"));
    return;
  }
  const getan = ks.filter(k => erg[k] === "ok"), da = ks.filter(k => erg[k] === "ok" || erg[k] === "schon");
  flagSetzen(da, geloest);
  for(const k of da){ auswahl.delete(k); gAuswahl.delete(k); }
  wahlNr++;
  const n = da.length;
  if(geloest) toast(tt("ar.l.geloest", {n}), 9000, null, getan.length ? {label: tt("ar.l.rueckgaengig"), fn: () => void loesenAus(getan, false)} : undefined);
  else toast(tt("ar.l.zurueck", {n}));
  ansagen(t(geloest ? "ar.l.geloest" : "ar.l.zurueck", {n}));
  zeichneArchiv();
  if(gOffen) fokusRetten("#arGTitel"); else fokusRetten("#arKaempfe", "#arWModus", "#arBosse", "#arSuche");
  if(da.length < ks.length) void archivStand(true).then(() => { if(bereichOffen) zeichneArchiv(); });
}

/* Die Leiste ueber der Kampftabelle: ausser im Auswahlmodus nur "Auswaehlen" und der Hinweis zur Taste */
function leisteZeichnen(bossDa: boolean){
  const leiste = $("#arWahl");
  leiste.hidden = !(SERVED && bossDa && (zeilenReihe.length || waehlen));
  if(leiste.hidden) return;
  const n = auswahl.size;
  $("#arWModus").hidden = waehlen;
  for(const sel of ["#arWZahl", "#arWLoesen", "#arWAlle", "#arWKeine", "#arWFertig", "#arWahl .arwtrenn"]) $(sel).hidden = !waehlen;
  const z = waehlen ? gewaehltText(n) : "";
  if($("#arWZahl").textContent !== z) $("#arWZahl").textContent = z;
  ($("#arWLoesen") as HTMLButtonElement).disabled = !n || n > AUF_EINMAL || loesenLaeuft;
  const tipp = t(waehlen ? "ar.l.tippWahl" : "ar.l.tipp");
  if($("#arWTipp").textContent !== tipp) $("#arWTipp").textContent = tipp;
}
function modusAus(fokus: boolean){
  waehlen = false; auswahl = new Set(); wahlNr++;
  zeichneArchiv();
  if(fokus) $("#arWModus").focus({preventScroll: true});
  else fokusRetten("#arKaempfe", "#arWModus");
}
/* eine Zeile im Auswahlmodus an- oder abwaehlen (nur Kaempfe im Archiv) */
function umschalten(id: string){
  const k = zeilenMap.get(id)?.k;
  if(!k){ ansagen(t("ar.l.nurVerlauf")); return; }
  auswahl = auswahlUmschalten(auswahl, k); wahlNr++;
  zeichneArchiv();
  ansagen(t("ar.l.gewaehltLang", {n: auswahl.size}));
}

/* Die Liste der Geloesten (Aufbau B): statt der Karten, ueber alle Bosse, je Boss ein Block, die Bosse nach ihrem neuesten
   geloesten Kampf, darin neueste zuerst (geloesteGruppen). Der Fokus bleibt beim Neuzeichnen an seinem Kaestchen. */
function geloesteZeichnen(){
  const chip = $("#arGChip"), panel = $("#arGeloeste"), zwei = $("#arZwei");
  const alle = SERVED && stand ? kaempfeJetzt().filter(k => k.geloest) : [];
  const offen = SERVED && gOffen;
  chip.hidden = !SERVED || (!alle.length && !offen);
  const ct = t("ar.g.chip", {n: alle.length});
  if(chip.textContent !== ct) chip.textContent = ct;
  chip.setAttribute("aria-expanded", offen ? "true" : "false");
  panel.hidden = !offen;
  zwei.hidden = offen;
  if(!offen) return;
  const da = new Set(alle.map(k => k.k));
  if([...gAuswahl].some(k => !da.has(k))) gAuswahl = new Set([...gAuswahl].filter(k => da.has(k)));
  const gruppen = geloesteGruppen(alle);
  gReihe = gruppen.flatMap(g => g.kaempfe.map(k => k.k));
  const box = $("#arGListe");
  const a = document.activeElement as HTMLElement | null;
  const merk = a && box.contains(a) ? (a.dataset.k ? '.argcb[data-k="' + CSS.escape(a.dataset.k) + '"]' : a.dataset.platz ? '.arggcb[data-platz="' + CSS.escape(a.dataset.platz) + '"]' : null) : null;
  let h = "", nr = 0;
  gruppen.forEach((g, gi) => {
    const o = plaetze().find(x => x.id === g.platz) ?? null;
    const name = o ? ortName(o) : g.kaempfe[0]!.boss;
    const gid = "argn-" + gi, n = g.kaempfe.filter(k => gAuswahl.has(k.k)).length;
    h += '<div class="arggruppe" role="group" aria-labelledby="' + gid + '"><div class="arggkopf">' + (o ? bildVon(o) : '<span class="arbild keins" aria-hidden="true"></span>') +
      '<span class="argname" id="' + gid + '">' + esc(name) + '</span><span class="argz">' + g.kaempfe.length + '</span><input type="checkbox" class="arggcb" data-platz="' + esc(g.platz) + '"' +
      (n === g.kaempfe.length ? " checked" : "") + (n && n < g.kaempfe.length ? ' data-teil="1"' : "") + ' aria-label="' + esc(t("ar.g.alleBoss", {name})) + '"></div><ul class="argliste">';
    for(const k of g.kaempfe){
      const id = "argk-" + nr++, d = datum(k.at), w = zahl(k.dps), lang = dur(k.dur);
      h += '<li class="argzeile"><input type="checkbox" class="argcb" id="' + id + '" data-k="' + esc(k.k) + '"' + (gAuswahl.has(k.k) ? " checked" : "") +
        ' aria-label="' + esc(t("ar.g.zeile", {boss: name, d, dps: w, dauer: lang})) + '"><label for="' + id + '"><span class="ard">' + esc(d) + '</span><span class="arw">' + esc(w) +
        '</span><span class="art">' + esc(lang) + "</span></label></li>";
    }
    h += "</ul></div>";
  });
  box.innerHTML = h;
  box.querySelectorAll<HTMLInputElement>(".arggcb[data-teil]").forEach(x => { x.indeterminate = true; });
  $("#arGLeer").hidden = !!gruppen.length;
  $("#arGAkt").hidden = !gruppen.length;
  $("#arGZahl").textContent = String(alle.length);
  const n = gAuswahl.size, z = gewaehltText(n);
  if($("#arGWZahl").textContent !== z) $("#arGWZahl").textContent = z;
  for(const sel of ["#arGWieder", "#arGLoeschen"]) ($(sel) as HTMLButtonElement).disabled = !n || n > AUF_EINMAL || loesenLaeuft;
  if(merk) box.querySelector<HTMLElement>(merk)?.focus({preventScroll: true});
}
function geloesteZu(){
  gOffen = false;
  zeichneArchiv();
  fokusRetten("#arGChip", "#arSuche");
}

/* ---- der Loeschdialog ---- */
interface LoeschDialog { ks: string[]; wer: {k: string; text: string}[]; soll: string; ausloeser: HTMLElement | null; laeuft: boolean; fertig: boolean }
let dlg: LoeschDialog | null = null;
/* der Name eines Sicherungsordners, wie der Hauptprozess ihn anlegt; anderes zeigt die Seite nicht */
const SICHERUNG_RX = /^archiv-vor-loeschen-\d{4}-\d{2}-\d{2}(?:-\d{1,6})?$/;
/* ein Satz mit dem Ordner sicherungen ({ordner}) und dem Namen der Sicherung ({name}) als Code */
const ordnerSatz = (satz: string, name = "") => esc(satz).replace("{ordner}", "<code>sicherungen</code>").replace("{name}", "<code>" + esc(name) + "</code>");
/* ein Kampf in Worten: der Boss (sein Platz, sonst der Name im Log), Datum und Uhrzeit */
function kampfText(e: ArchivKampf): string {
  const platz = kaempfeJetzt().find(x => x.k === e.k)?.platz ?? e.platz;
  const o = plaetze().find(x => x.id === platz);
  return (o ? ortName(o) : e.boss) + " · " + datum(e.at);
}
function dialogAuf(ks: string[], ausloeser: HTMLElement){
  const es = ks.map(k => (stand ?? []).find(x => x.k === k && x.geloest)).filter((x): x is ArchivKampf => !!x);
  if(!SERVED || !es.length || es.length > AUF_EINMAL) return;
  const wer = es.map(e => ({k: e.k, text: kampfText(e)}));
  dlg = {ks: es.map(e => e.k), wer, soll: loeschSoll(es), ausloeser, laeuft: false, fertig: false};
  const [auf, zu] = sprache() === "de" ? ["„", "“"] : ["“", "”"];
  $("#arDlgT").textContent = t("ar.d.titel");
  $("#arDlgS").innerHTML = esc(es.length === 1 ? t("ar.d.einer", {was: auf + wer[0]!.text + zu}) : t("ar.d.mehrere", {n: es.length})) + " " + ordnerSatz(t("ar.d.sicherung"));
  const liste = $("#arDlgWer");
  liste.hidden = es.length < 2;
  liste.innerHTML = es.length < 2 ? "" : wer.slice(0, 6).map(w => "<li>" + esc(w.text) + "</li>").join("") + (es.length > 6 ? "<li>" + esc(t("ar.d.weitere", {n: es.length - 6})) + "</li>" : "");
  $("#arDlgTipp").textContent = t(es.length === 1 ? "ar.d.tippEins" : "ar.d.tippViele");
  $("#arDlgSoll").textContent = dlg.soll;
  const feld = $("#arDlgFeld") as HTMLInputElement, ja = $("#arDlgJa") as HTMLButtonElement, nein = $("#arDlgNein") as HTMLButtonElement;
  feld.value = ""; feld.disabled = false;
  ja.disabled = true; ja.textContent = t("ar.d.loeschen");
  nein.disabled = false; nein.textContent = t("ar.d.abbrechen");
  $("#arDlgLaeuft").textContent = "";
  $("#arDlgForm").hidden = false;
  $("#arDlgErg").hidden = true;
  $("#arDlgOrdner").textContent = t("ar.r.ordner");
  $("#arDlgZu").textContent = t("ar.r.schliessen");
  $("#arDlgMeld").textContent = "";
  $("#arDlgBg").classList.add("on");
  // wie die anderen Dialoge: solange er offen ist, oeffnen Strg+K und die Pfeiltasten nichts darunter
  state.modalOpen = true;
  feld.focus();
}
/* Der Knopf "Loeschen" des Dialogs (das Formular, auch mit Enter im Feld, solange der Knopf geht): die einzige Stelle,
   die archivLoeschenSenden ruft (Audit 13d.P8). Der Text wird hier noch einmal geprueft. */
async function loeschenBestaetigt(){
  const offen = dlg, feld = $("#arDlgFeld") as HTMLInputElement;
  if(!offen || offen.laeuft || offen.fertig || !bestaetigungOk(feld.value, offen.soll)) return;
  offen.laeuft = true;
  feld.disabled = true;
  ($("#arDlgJa") as HTMLButtonElement).disabled = true;
  ($("#arDlgNein") as HTMLButtonElement).disabled = true;
  $("#arDlgLaeuft").textContent = t("ar.d.laeuft");
  $("#arDlgT").focus();
  const antwort = await archivLoeschenSenden(offen.ks, feld.value);
  offen.laeuft = false;
  ergebnisZeigen(offen, antwort);
}
/* Das Ergebnis je Kampf als Liste, der Sicherungsordner mit seinem Knopf; bei einer Ablehnung der Grund in einem Satz */
function ergebnisZeigen(offen: LoeschDialog, a: LoeschAntwort){
  if(dlg !== offen) return;
  offen.fertig = true;
  const ordner = a.sicherung && SICHERUNG_RX.test(a.sicherung) ? a.sicherung : "";
  let titel: string, satz: string, was: (k: string) => string;
  if(a.ok){
    const erg = a.ergebnis;
    // gezaehlt wird, was wirklich weg ist; eine Datei, die bleibt, steht an ihrem Kampf
    titel = t("ar.r.titel", {n: offen.ks.filter(k => erg[k] === "geloescht" || erg[k] === "ohne-datei").length});
    satz = ordner ? ordnerSatz(t("ar.r.sicherung"), ordner) : "";
    was = k => erg[k] === "geloescht" ? t("ar.r.geloescht") : erg[k] === "ohne-datei" ? t("ar.r.ohneDatei") : erg[k] === "datei-bleibt" ? t("ar.r.dateiBleibt") : t("ar.a.offen");
  } else if(a.grund === "keine"){
    titel = t("ar.a.keineTitel");
    satz = esc(t("ar.a.keine"));
    was = () => t("ar.a.offen");
  } else {
    titel = t("ar.a.titel");
    const GRUND: Record<string, string> = {bestaetigung: "ar.a.bestaetigung", sicherung: "ar.a.sicherung", "nicht-geloest": "ar.a.nichtGeloestSatz", unavailable: "ar.a.unavailable"};
    satz = esc(t(GRUND[a.grund] ?? "ar.a.abgelehnt")) + (ordner ? " " + ordnerSatz(t("ar.a.teil"), ordner) : "");
    const nicht = new Set(a.grund === "nicht-geloest" ? a.kaempfe ?? [] : []);
    was = k => nicht.has(k) ? t("ar.a.nichtGeloest") : t("ar.a.nicht");
  }
  $("#arDlgT").textContent = titel;
  $("#arDlgS").innerHTML = satz;
  $("#arDlgWer").hidden = true;
  $("#arDlgListe").innerHTML = offen.wer.map(w => '<li><span class="ardwer">' + esc(w.text) + '</span><span class="ardwas">' + esc(was(w.k)) + "</span></li>").join("");
  $("#arDlgOrdner").hidden = !ordner;
  $("#arDlgLaeuft").textContent = "";
  $("#arDlgForm").hidden = true;
  $("#arDlgErg").hidden = false;
  $("#arDlgT").focus();
  ansagen(titel);
  /* geloescht: aus dem gemerkten Verzeichnis, dann neu gelesen (Zahlen, Chip, Liste ziehen nach); ohne Antwort oder
     wenn ein Kampf nicht mehr geloest war, ebenso neu gelesen */
  if(a.ok){
    const weg = new Set(Object.keys(a.ergebnis));
    if(stand) stand = stand.filter(e => !weg.has(e.k));
    for(const k of weg) gAuswahl.delete(k);
    standNr++; wahlNr++;
  }
  if(a.ok || a.grund === "keine" || a.grund === "nicht-geloest"){
    zeichneArchiv();
    void archivStand(true).then(l => { if(l) standLage = "da"; if(bereichOffen) zeichneArchiv(); });
  }
}
function dialogZu(){
  const offen = dlg;
  if(!offen || offen.laeuft) return;
  dlg = null;
  $("#arDlgBg").classList.remove("on");
  state.modalOpen = false;
  const z = offen.ausloeser;
  if(z && z.isConnected && z.getClientRects().length && !(z as HTMLButtonElement).disabled) z.focus({preventScroll: true});
  else fokusRetten("#arGTitel", "#arGChip", "#arSuche");
}
/* im Dialog: Esc schliesst (nicht waehrend er loescht), Tab und Umschalt+Tab bleiben in ihm */
function dialogTasten(e: KeyboardEvent){
  if(!dlg) return;
  if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); dialogZu(); return; }
  if(e.key !== "Tab") return;
  const f = [...$("#arDlg").querySelectorAll<HTMLElement>("button, input")].filter(x => !(x as HTMLButtonElement).disabled && x.getClientRects().length);
  if(!f.length){ e.preventDefault(); return; }
  const i = f.indexOf(document.activeElement as HTMLElement);
  if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1]!.focus(); }
  else if(!e.shiftKey && (i === f.length - 1 || i < 0)){ e.preventDefault(); f[0]!.focus(); }
}

/* Pfeile, Pos1, Ende, Bild auf/ab in einer Liste: die neue aktive Zeile oder null */
const BEWEGT = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "PageDown", "PageUp"];
/* Im Raster der Karten: Auf/Ab geht eine Reihe (nach der Lage der Karten), die naechste Karte darunter bzw. darueber
   am ehesten in derselben Spalte; gibt es keine, bleibt die Auswahl. Rechts/Links gehen eine Karte. */
function reihe(alle: HTMLElement[], jetzt: number, abwaerts: boolean): HTMLElement | null {
  const c = alle[Math.max(0, jetzt)];
  if(!c) return null;
  const r = c.getBoundingClientRect();
  let beste: HTMLElement | null = null, bt = 0, bx = 0;
  for(const e of alle){
    const q = e.getBoundingClientRect();
    if(abwaerts ? q.top <= r.top + 1 : q.top >= r.top - 1) continue;
    const dx = Math.abs(q.left - r.left);
    const naeher = !beste || (abwaerts ? q.top < bt - 1 : q.top > bt + 1) || (Math.abs(q.top - bt) <= 1 && dx < bx);
    if(naeher){ beste = e; bt = q.top; bx = dx; }
  }
  return beste;
}
function schritt(alle: HTMLElement[], jetzt: number, taste: string, raster = false): HTMLElement | null {
  if(!alle.length) return null;
  if(raster && (taste === "ArrowDown" || taste === "ArrowUp")) return jetzt < 0 ? alle[0] ?? null : reihe(alle, jetzt, taste === "ArrowDown") ?? alle[jetzt] ?? null;
  const letzte = alle.length - 1, von = Math.max(0, jetzt);
  const i = taste === "ArrowDown" || taste === "ArrowRight" ? (jetzt < 0 ? 0 : Math.min(letzte, jetzt + 1)) : taste === "ArrowUp" || taste === "ArrowLeft" ? Math.max(0, von - 1)
    : taste === "Home" ? 0 : taste === "End" ? letzte : taste === "PageDown" ? Math.min(letzte, von + 10) : Math.max(0, von - 10);
  return alle[i] ?? null;
}
/* die Tasten einer Liste: bewegen, Enter (oder Leertaste) waehlt, Esc geht eine Ebene hoch */
function listenTasten(box: HTMLElement, schluessel: "ort" | "k", aktiv: () => string | null, setze: (x: string | null) => void,
  waehle: (x: string) => void, hoch: () => void, raster = false){
  box.addEventListener("keydown", e => {
    if(e.altKey || e.ctrlKey || e.metaKey) return;
    const alle = [...box.querySelectorAll<HTMLElement>("[role=option]")];
    if(BEWEGT.includes(e.key)){
      e.preventDefault();
      // in der Tabelle der Kaempfe bleibt es eine Spalte: Links/Rechts tun dort nichts
      if(!raster && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
      const z = schritt(alle, alle.findIndex(x => x.dataset[schluessel] === aktiv()), e.key, raster);
      if(z){ setze(z.dataset[schluessel] ?? null); rollen = true; zeichneArchiv(); }
    } else if(e.key === "Enter" || e.key === " "){
      const a = aktiv();
      if(!a) return;
      e.preventDefault();
      waehle(a);
    } else if(e.key === "Escape"){
      e.preventDefault();
      hoch();
    }
  });
  // der Fokus kommt in die Liste: die Tastatur steht auf der gewaehlten (oder ersten) Zeile
  box.addEventListener("focus", () => {
    if(aktiv()) return;
    const erste = box.querySelector<HTMLElement>('[aria-selected="true"]') ?? box.querySelector<HTMLElement>("[role=option]");
    if(!erste) return;
    setze(erste.dataset[schluessel] ?? null);
    zeichneArchiv();
  });
  // der Zeiger: die Zeile unter ihm ist die aktive, bevor der Fokus kommt
  box.addEventListener("pointerdown", e => {
    const x = (e.target as Element).closest<HTMLElement>("[role=option]")?.dataset[schluessel];
    if(x) setze(x);
  });
  box.addEventListener("click", e => {
    const o = (e.target as Element).closest<HTMLElement>("[role=option]");
    const x = o?.dataset[schluessel];
    if(!x) return;
    setze(x);
    waehle(x);
  });
}

/* Loesen und Loeschen einrichten (nur in der App): die Leiste der Bossseite, der Knopf je Zeile und Entf, der Chip und die
   Liste der Geloesten, der Dialog */
function loeschenEinrichten(kaempfeBox: HTMLElement){
  // "Loesen" an der Zeile: vor der Liste abgefangen (sonst oeffnete der Klick den Kampf), ohne dass der Knopf den Fokus nimmt
  kaempfeBox.addEventListener("mousedown", e => { if((e.target as Element).closest(".arloes")) e.preventDefault(); });
  kaempfeBox.addEventListener("click", e => {
    const b = (e.target as Element).closest(".arloes");
    if(!b) return;
    e.preventDefault(); e.stopPropagation();
    const k = zeilenMap.get(b.closest<HTMLElement>("[role=option]")?.dataset.k ?? "")?.k;
    if(k) void loesenAus([k], true);
  }, true);
  // Entf: im Auswahlmodus die Auswahl, sonst die Zeile der Tastatur
  kaempfeBox.addEventListener("keydown", e => {
    if(e.key !== "Delete" || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    if(waehlen && auswahl.size){ if(auswahl.size <= AUF_EINMAL) void loesenAus(zeilenReihe.filter(k => auswahl.has(k)), true); else ansagen(gewaehltText(auswahl.size)); return; }
    const f = aktivKampf ? zeilenMap.get(aktivKampf) : undefined;
    if(f?.k) void loesenAus([f.k], true); else if(f) ansagen(t("ar.l.nurVerlauf"));
  });
  $("#arWModus").addEventListener("click", () => {
    waehlen = true; wahlNr++;
    zeichneArchiv();
    $("#arKaempfe").focus({preventScroll: true});
    ansagen(t("ar.l.gewaehltLang", {n: auswahl.size}));
  });
  $("#arWFertig").addEventListener("click", () => modusAus(true));
  $("#arWAlle").addEventListener("click", () => { auswahl = new Set(zeilenReihe); wahlNr++; zeichneArchiv(); ansagen(t("ar.l.gewaehltLang", {n: auswahl.size})); });
  $("#arWKeine").addEventListener("click", () => { auswahl = new Set(); wahlNr++; zeichneArchiv(); ansagen(t("ar.l.gewaehltLang", {n: 0})); });
  $("#arWLoesen").addEventListener("click", () => void loesenAus(zeilenReihe.filter(k => auswahl.has(k)), true));
  // die Liste der Geloesten
  $("#arGChip").addEventListener("click", () => {
    gOffen = !gOffen;
    zeichneArchiv();
    if(gOffen) $("#arGTitel").focus({preventScroll: true}); else fokusRetten("#arGChip", "#arSuche");
  });
  $("#arGZu").addEventListener("click", geloesteZu);
  $("#arGeloeste").addEventListener("keydown", e => { if(e.key === "Escape" && !dlg){ e.preventDefault(); geloesteZu(); } });
  $("#arGListe").addEventListener("change", e => {
    const x = e.target as HTMLInputElement;
    if(x.classList.contains("argcb") && x.dataset.k){
      if(x.checked !== gAuswahl.has(x.dataset.k)) gAuswahl = auswahlUmschalten(gAuswahl, x.dataset.k);
    } else if(x.classList.contains("arggcb") && x.dataset.platz){
      const ks = kaempfeJetzt().filter(k => k.geloest && k.platz === x.dataset.platz).map(k => k.k);
      gAuswahl = new Set(x.checked ? [...gAuswahl, ...ks] : [...gAuswahl].filter(k => !ks.includes(k)));
    } else return;
    wahlNr++;
    zeichneArchiv();
    ansagen(t("ar.l.gewaehltLang", {n: gAuswahl.size}));
  });
  $("#arGAlle").addEventListener("click", () => { gAuswahl = new Set(gReihe); wahlNr++; zeichneArchiv(); ansagen(t("ar.l.gewaehltLang", {n: gAuswahl.size})); });
  $("#arGKeine").addEventListener("click", () => { gAuswahl = new Set(); wahlNr++; zeichneArchiv(); ansagen(t("ar.l.gewaehltLang", {n: 0})); });
  $("#arGWieder").addEventListener("click", () => void loesenAus(gReihe.filter(k => gAuswahl.has(k)), false));
  $("#arGLoeschen").addEventListener("click", () => dialogAuf(gReihe.filter(k => gAuswahl.has(k)), $("#arGLoeschen")));
  // der Dialog
  const feld = $("#arDlgFeld") as HTMLInputElement;
  feld.addEventListener("input", () => { ($("#arDlgJa") as HTMLButtonElement).disabled = !dlg || dlg.laeuft || !bestaetigungOk(feld.value, dlg.soll); });
  $("#arDlgForm").addEventListener("submit", e => { e.preventDefault(); void loeschenBestaetigt(); });
  $("#arDlgNein").addEventListener("click", dialogZu);
  $("#arDlgZu").addEventListener("click", dialogZu);
  $("#arDlgOrdner").addEventListener("click", async () => {
    const ok = await archivSicherungenOeffnen();
    $("#arDlgMeld").textContent = t(ok ? "ar.r.ordnerOffen" : "ar.r.ordnerFehler");
  });
  $("#arDlgBg").addEventListener("keydown", dialogTasten);
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  const feld = document.getElementById("arSuche") as HTMLInputElement | null;
  const bosse = document.getElementById("arBosse"), kaempfeBox = document.getElementById("arKaempfe");
  if(!feld || !bosse || !kaempfeBox) return;
  // wer sucht oder filtert, will die Karten: die Liste der Geloesten geht zu
  feld.addEventListener("input", () => { frage = feld.value; gOffen = false; zeichneArchiv(); });
  // Pfeil runter aus dem Suchfeld in die Liste
  feld.addEventListener("keydown", e => {
    if(e.key !== "ArrowDown" || !bosse.querySelector("[role=option]")) return;
    e.preventDefault();
    bosse.focus({preventScroll: true});
  });
  listenTasten(bosse, "ort", () => aktivBoss, x => { aktivBoss = x; }, waehleBoss, () => feld.focus(), true);
  // die Filterchips: genau eine Art, dazu "nur mit Kaempfen"
  document.querySelectorAll<HTMLElement>("#arChips .archip").forEach(b => b.addEventListener("click", () => {
    filterKat = (b.dataset.kat as ArchivFilter["kat"]) ?? "alle"; gOffen = false; zeichneArchiv();
  }));
  document.getElementById("arNur")?.addEventListener("click", () => { filterNur = !filterNur; gOffen = false; zeichneArchiv(); });
  // im Auswahlmodus schalten Klick, Leertaste und Enter die Zeile, Esc beendet ihn; sonst oeffnen sie den Kampf
  listenTasten(kaempfeBox, "k", () => aktivKampf, x => { aktivKampf = x; }, x => { if(SERVED && waehlen) umschalten(x); else void oeffneZeile(x); },
    () => { if(SERVED && waehlen) modusAus(false); else zurueckZurListe(); });
  if(SERVED) loeschenEinrichten(kaempfeBox);
  // der Zeitraum der Bossseite
  document.querySelectorAll<HTMLElement>("#arZeit button").forEach(b => b.addEventListener("click", () => {
    zeitArchiv = (b.dataset.z as Zeitraum) ?? "alles"; zeichneArchiv();
  }));
  document.getElementById("arZurueck")?.addEventListener("click", zurueckZurListe);
  // die Charaktere wurden gelesen oder geaendert (59): ihre Namen stehen in den Kaempfen
  archivNamenHaken.geaendert = () => { if(bereichOffen) zeichneArchiv(); };
  // eine neue Fensterbreite kann zwischen einer und zwei Spalten wechseln
  addEventListener("resize", () => { if(bereichOffen) zeichneArchiv(); });
}
