import { state } from "./01-state";
import { t } from "./08-translation";
import { WEAPON_ICON, weaponLabel, weaponMark } from "./09-weapon-icons";
import { cssv, esc } from "./18-interface-basics";
import { ABRISS_FENSTER, SERVED } from "./41-server-mode";
import { auswerten, datumParse, eventsAm, filtern, ics, icsAlle, rolleVon, termine, terminSchluessel, textAusgabe, wandUhr, type Gilde, type Marke, type Mitglied, type Reihe, type Rolle, type Termin,
  type Wdh, type Zeile, type Geloeste } from "../gilde-core";
import { aufListe, punkteText, rangliste, STANDARD_ARTEN, STANDARD_REGELN, tabelleEinlesen, type Konto } from "../gilde-punkte-core";
import type { Art, MitgliedPunkte, Pause } from "../gilde-core";
import { klasseVon, WAFFEN } from "../klassen-core";

/* ---------- Gilde (Spezifikation docs/superpowers/specs/2026-10-06-gilde-design.md, 5; Plan Aufgabe 5) ----------
   Ein Ort wie die Weeklies (state.gilde, syncGilde aus renderAll in 32), mit
   derselben Flaeche. Oben der Kopf mit dem Namen der Gilde und dem naechsten
   Termin samt Restzeit, darunter der Satz zum Speichern; im Inhalt der
   Datenschutz-Satz, die drei Reiter Termine, Mitglieder und Auswertung
   (Tablist, Pfeiltasten), ueber allen dreien Suche und Rollenfilter (filtern
   im Kern; die Seite merkt sich beides nicht ueber Neustarts) und die
   Flaeche des gewaehlten Reiters. Aussehen nach Entwurf 2 vom 06.10.2026
   (docs/entwurf/gilde/entwurf.html).

   Mitglieder: Kacheln in Rollenspalten (Tank, Heiler, Schaden, dazu "Ohne
   Rolle", wenn es solche gibt; bei aktivem Filter entfallen leere Spalten),
   "+ Mitglied" (die Uebernahme aus der Gruppe entfiel am 11.10.2026; vorher: Namen, die diese Sitzung
   schon kennt, jeder einzeln angehakt, vorhandene uebersprungen), Bearbeiten
   mit Name, Notiz und den zwei Waffen als runden Knoepfen (aria-pressed,
   dieselbe Waffe nicht zweimal); mit zwei Waffen folgen Klasse und Rolle aus
   dem Paar (klassen-core.ts), sonst waehlt man die Rolle. Ein neues Mitglied
   kommt erst mit seinem Namen in die Gilde: ein leerer Name wird nie
   gespeichert. Loesen setzt geloest, Rueckgaengig nimmt es wieder weg;
   nichts wird entfernt.

   Gespeichert wird allein ueber /api/gilde (src/main/gilde.ts): erst lesen,
   dann nach jeder Aenderung der GANZE Stand, 500 ms entprellt, beim
   Schliessen sofort (keepalive). Vor dem ersten Lesen schreibt die Seite nie.
   Bei 400 und 503 sagt ein Satz in #gildeStatus, dass nicht gespeichert
   wurde; bei 503 versucht sie es spaeter noch einmal. Ohne den Helfer (Seite
   als Datei, oder er kennt die Route nicht) steht nur der Satz "Nur in der
   App". Die Namen gehen in keinen Bericht und in kein Log.

   Termine (Plan Aufgabe 6): links je Reihe ihre Termine, neueste zuerst -
   die zwei naechsten und die vergangenen der letzten 12 Wochen, "Aeltere
   zeigen" holt je 12 Wochen mehr (der erste Termin einer Reihe darf weit
   zurueckliegen: so traegt man alte Termine nach). Rechts die Anwesenheit des
   gewaehlten Termins (ohne Wahl der juengste vergangene) in denselben
   Rollenspalten wie die Mitglieder: je Mitglied eine Radiogruppe da / nicht
   da / nicht da; ein zweiter Druck auf die gewaehlte Marke setzt
   "offen" zurueck, nie wird ein Schluessel entfernt. Pfeil links/rechts
   waehlt in der Gruppe, Pfeil auf/ab wechselt das Mitglied. Ausfallen,
   Zuruecknehmen und Verschieben (nur die Uhrzeit) schreiben die Ausnahme
   unter dem urspruenglichen Datum; die Anwesenheit bleibt dort. Eine Reihe
   wird geloest, nie entfernt, und Rueckgaengig holt sie zurueck.

   Auswertung (Plan Aufgabe 7; Entscheidung 07.10.2026): je Mitglied eine Karte mit
   dem Ring der Quote, Waffenpaar, Klasse und den Zahlen Dabei und
   Zuletzt (auswerten im Kern), fuer alle Reihen oder eine, in der Reihenfolge
   der Liste, nach Name, Quote oder Rolle; Suche und Rolle wirken mit. Kein
   Urteil: dieselbe Farbe fuer alle, keine Medaille, kein Rang. Je Karte ein
   Satz fuer den Vorleser. Rechts das Bild zum Kopieren, auf einer Leinwand
   gemalt wie in 50-bild.ts. Hinaus geht nur, was der Leader anstoesst: der
   Text (textAusgabe) und das Bild in die Zwischenablage - ohne sie das Bild
   als Datei zum Speichern -, und die Kalenderdatei als Datei: einer Reihe
   (ics), bei "Alle Reihen" aller nicht geloesten in einer (icsAlle, benannt
   nach der Gilde). Alles ueber Blob und <a download>, kein Endpunkt. */

type Lage = "laden" | "da" | "nurApp" | "gesperrt";
type Reiter = "termine" | "mitglieder" | "auswertung" | "punkte";
type Speicher = "" | "nie" | "spaeter";
/** Wie die Datei (gilde.ts): der ganze Stand als JSON hoechstens 2 097 152 Zeichen (Entscheidung 07.10.2026). */
const MAX_TEXT = 2097152;
const REITER: Reiter[] = ["termine", "mitglieder", "auswertung", "punkte"];
const ROLLEN: Rolle[] = ["tank", "heal", "dps"];
/** Wie die Datei (gilde.ts): hoechstens 100 Mitglieder, geloeste zaehlen mit. */
const MAX_MITGLIEDER = 100;

export const gildeState: { gilde: Gilde | null; tab: Reiter } = { gilde: null, tab: "termine" };
/* Gelöste Gilden (Spezifikation Gilde fein, 2.1, #237): die Gilde wandert samt allem in die Liste, nichts wird geloescht. Nur lokal,
   nie mit dem Server. Die Datei haelt sie unter geloeste (hoechstens 20) und laesst keine Gilde verschwinden. */
let geloeste: Geloeste[] = [];
const MAX_GELOESTE = 20;
/** Wie die Datei (gilde.ts): die ganze Datei hoechstens 6 291 456 Zeichen, eine Gilde MAX_TEXT. */
const MAX_DATEI = 6291456;
/** Die zuletzt geloeste Gilde (Kennung): ihr Satz mit Rueckgaengig steht 30 Sekunden. */
let loesenUndo: string | null = null;
let loesenTimer: ReturnType<typeof setTimeout> | null = null;
/* Endgueltig loeschen (Spezifikation Gilde loeschen, #240): nur, was in einer Liste der Gelösten steht, nur mit dem Namen, die Sicherung legt der Hauptprozess an.
   loeschFrage: das Mitglied oder die Art, deren Frage offen ist; loeschName: was im Feld steht. Nur in der Sitzung. */
let loeschFrage: {was: "mitglied" | "art"; id: string} | null = null, loeschName = "";
let lage: Lage = "laden";
let offen = false;
/** Suche und Rolle: nur in der Sitzung. */
const filter: { rolle: Rolle; suche: string } = { rolle: "", suche: "" };
/** Das Mitglied im Feld Bearbeiten (Kennung), und ein neues ohne Namen, das noch nicht in der Gilde steht. */
let bearbeiten: string | null = null;
let entwurf: Mitglied | null = null;
/** Die zwei Waffen im Feld; eine allein bleibt hier, gespeichert werden nur zwei. */
let wahl: [string | null, string | null] = [null, null];
/** Das zuletzt geloeste Mitglied: sein Satz mit Rueckgaengig bleibt bis zum naechsten Eingriff. */
let undo: string | null = null;
/** Punkte: die gewaehlte Zeile (Mitglied), der Filter und ob der Block der Inaktiven offen ist. Nur in der Sitzung. */
type PFilter = "alle" | "aktiv" | "inaktiv";
let punktAuswahl: string | null = null, punktFilter: PFilter = "alle", inaktivOffen = false, sonntagOffen = false, regelnOffen = false, einlesenOffen = false, einlesenText = "", einlesenSatz = "";
/** Das Rueckgaengig zur letzten Handlung bei den Punkten (setzt Flags zurueck, entfernt nie etwas). */
let punktUndo: (() => void) | null = null;
/** Ein kurzer Satz nach einer Handlung (etwa "2 Mitglieder uebernommen."). */
let meldung = "";
/* Bewegung: anim = die Flaeche wechselt (Reiter, Termin, Auswahl) und baut sich einmal ein; puls = der Klick eben
   hat das Element getroffen, das nach dem Zeichnen den Fokus hat. Beides gilt fuer genau ein Zeichnen. */
let anim = false, puls = false, animSchluessel = "", animTimer: ReturnType<typeof setTimeout> | null = null;
let pinsel: {tk: string; marke: Gesetzt; start: string; ids: Set<string>} | null = null;
let speicher: Speicher = "";
/** Wie voll die Datei mit dem Stand der Seite waere: ueber 90 % ein Satz, ueber der Grenze wird nicht gesendet. */
let groesse: "" | "fast" | "ueber" = "";
function groesseMessen(): string {
  const stand = quelle === "lokal" && geloeste.length ? {v: 1, gilde: gildeState.gilde, geloeste} : {v: 1, gilde: gildeState.gilde};
  const text = JSON.stringify(stand);
  const einzel = gildeState.gilde ? JSON.stringify({v: 1, gilde: gildeState.gilde}).length : 0;
  groesse = einzel > MAX_TEXT || text.length > MAX_DATEI ? "ueber" : einzel > MAX_TEXT * 0.9 ? "fast" : "";
  return text;
}
/** Es gibt etwas zu senden: eine offene Gilde, oder (lokal) gelöste Gilden, auch wenn keine offen ist. */
const schreibbar = () => !!gildeState.gilde || (quelle === "lokal" && geloeste.length > 0);
/** Das Element (data-f), das nach dem naechsten Zeichnen den Fokus bekommt. */
let fokus: string | null = null;

/* ---------- Gilde online (71-gilde-online.ts): dieselbe Seite, ein anderer Speicher ----------
   Ist der Lead mit einer Gilde auf einem Server verbunden, gilt dort der Stand: der Online-Teil reicht ihn mit
   onlineAn herein, und gespeichert wird ueber den Haken schreiben statt ueber /api/gilde. Darf man nicht schreiben
   (Mitglied, Server nicht erreichbar, Link zurueckgezogen), faellt jede Aenderung auf den letzten Stand vom Server
   zurueck (verboten), und die bekannten Schreib-Knoepfe tun nichts. Die lokale Datei bleibt dabei, wie sie ist. */
type Quelle = "lokal" | "online";
let quelle: Quelle = "lokal";
let nurLesen = false;
/** Der Stand, wie ihn der Server zuletzt lieferte oder annahm (Text): darauf faellt eine verbotene Aenderung zurueck. */
let basisText = "";
export const onlineHaken: {
  schreiben: ((text: string) => Promise<"ok" | "spaeter" | "fertig">) | null;
  sichtbar: ((an: boolean) => void) | null;
} = { schreiben: null, sichtbar: null };
/** Was nur schreibt: im Lesen-Zustand tun diese Knoepfe nichts (die uebrigen lesen, waehlen oder geben aus). */
const SCHREIBER = new Set(["neu", "bearbeiten", "loesen", "austrJa", "offAus", "ehemZurueck", "undo", "reiheNeu", "reiheLoesen", "reiheAendern",
  "reiheUndo", "ausfall", "verschieben", "alleDa", "alleN", "zPlus", "zMinus", "pSonntag", "pZusAdd", "pAnsAdd", "pSonnAdd", "pUebernehmen",
  "pStandard", "pArtNeu", "pArtLoesen", "pArtZurueck", "pInaktivSetzen", "pAktiv", "pUndo", "pRegeln", "pEinlesen", "loeschFrage", "loeschJa"]);
const schreibt = (b: HTMLElement) => SCHREIBER.has(b.dataset.g || "") || !!b.closest(".gl-marken, .gl-wb");
function eingabenLoeschen(){
  bearbeiten = null; entwurf = null; wahl = [null, null]; offWahl = [null, null]; austrittFrage = null; undo = null; reiheFeld = null; reiheUndo = null; punktUndo = null;
  loesenUndo = null; loeschFrage = null; loeschName = "";
}
/** Der Online-Teil: dieser Stand gilt jetzt; lesen = man darf ihn nicht aendern. */
export function onlineAn(g: Gilde, lesen: boolean){
  quelle = "online"; nurLesen = lesen; lage = "da"; ladeVersuch = 0;
  gildeState.gilde = g; basisText = JSON.stringify({v: 1, gilde: g});
  if(sendeTimer){ clearTimeout(sendeTimer); sendeTimer = null; }
  if(wiederTimer){ clearTimeout(wiederTimer); wiederTimer = null; }
  nochmal = false; speicher = ""; meldung = "";
  eingabenLoeschen(); groesseMessen();
  document.getElementById("gilde")?.classList.toggle("gl-nurlesen", lesen);
  zeichnen();
}
/** Zurueck auf die lokale Datei: sie wird neu gelesen, nichts davon wurde angefasst. */
export function onlineAus(){
  if(quelle === "lokal") return;
  quelle = "lokal"; nurLesen = false; basisText = "";
  document.getElementById("gilde")?.classList.remove("gl-nurlesen");
  eingabenLoeschen(); gildeState.gilde = null; lage = "laden";
  zeichnen(); laden();
}
export const onlineBasis = (): Gilde | null => basisText ? (JSON.parse(basisText) as {gilde: Gilde}).gilde : null;
export const lokaleGilde = (): Gilde | null => quelle === "lokal" ? gildeState.gilde : null;
/** Steht etwas aus oder ist ein Feld offen? Dann ersetzt ein neuer Stand vom Server die Liste noch nicht. */
export const onlineBeschaeftigt = (): boolean => !!(sendeTimer || unterwegs || nochmal || wiederTimer || bearbeiten || entwurf || reiheFeld);
/** Eine Aenderung, die nicht gelten darf: zurueck auf den letzten Stand vom Server. */
function verboten(){
  const g = onlineBasis();
  if(!g) return;
  gildeState.gilde = g; eingabenLoeschen();
  meldung = t("gilde.on.nurLesen.satz"); ansage(meldung);
  zeichnen();
}

const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
/* Was der Speicher annimmt (gilde.ts): keine Steuerzeichen, ohne Rand, hoechstens n Zeichen. */
function rein(s: string, n: number): string {
  return [...s.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "").trim()].slice(0, n).join("").trim();
}
/** Eine neue Kennung: der Buchstabe und 9 Zeichen [0-9a-z] aus crypto.getRandomValues. */
export function neueId(p: "g" | "m" | "r" | "a"): string {
  const z = "0123456789abcdefghijklmnopqrstuvwxyz";
  for(;;){
    const b = new Uint8Array(9);
    crypto.getRandomValues(b);
    const id = p + [...b].map(x => z[x % 36]).join("");
    const g = gildeState.gilde;
    if(!g || ![g.id, ...g.mitglieder.map(m => m.id), ...g.reihen.map(r => r.id), ...(g.punkte?.arten ?? []).map(a => a.id)].includes(id)) return id;
  }
}

/* ---------- Lesen: erst lesen, dann schreiben ---------- */
let ladeTimer: ReturnType<typeof setTimeout> | null = null, ladeVersuch = 0;
/* Der gelesene Stand; was nicht die Form hat, gilt als unlesbar (undefined), und die Seite schreibt nichts. */
function gildeVon(x: unknown): Gilde | null | undefined {
  if(!isRec(x) || x.v !== 1) return undefined;
  if(x.gilde === null) return null;
  const g = x.gilde;
  if(!isRec(g) || typeof g.id !== "string" || typeof g.name !== "string" || !Array.isArray(g.mitglieder) || !Array.isArray(g.reihen) || !isRec(g.anwesend)) return undefined;
  return g as unknown as Gilde;
}
/* Die gelesenen gelöste Gilden: nur, was die Form hat (die Datei hat es schon geprueft). */
function geloesteVon(x: unknown): Geloeste[] {
  if(!Array.isArray(x)) return [];
  const aus: Geloeste[] = [];
  for(const e of x){
    if(!isRec(e) || typeof e.am !== "string") continue;
    const g = gildeVon({v: 1, gilde: e.gilde});
    if(g) aus.push({am: e.am, gilde: g});
  }
  return aus;
}
function laden(){
  if(!SERVED || ladeTimer) return;
  fetch("/api/gilde").then(r => r.status === 404 ? "ohne" : r.ok ? r.json() : null).then((d: unknown) => {
    if(quelle === "online") return;   // inzwischen gilt der Stand vom Server (71-gilde-online.ts)
    if(d === "ohne"){ lage = "nurApp"; return zeichnen(); }
    const g = isRec(d) && d.ok === true ? gildeVon(d.data) : undefined;
    if(g === undefined){ lage = "gesperrt"; zeichnen(); return spaeterLaden(); }
    gildeState.gilde = g; lage = "da"; ladeVersuch = 0;
    geloeste = geloesteVon(isRec(d) && isRec(d.data) ? d.data.geloeste : undefined);
    if(g || geloeste.length) groesseMessen();
    zeichnen();
  }, () => { lage = "gesperrt"; zeichnen(); spaeterLaden(); });
}
function spaeterLaden(){
  const warte = Math.min(60000, 5000 * 2 ** ladeVersuch++);
  ladeTimer = setTimeout(() => { ladeTimer = null; laden(); }, warte);
}

/* ---------- Schreiben: der ganze Stand, entprellt ---------- */
let sendeTimer: ReturnType<typeof setTimeout> | null = null, wiederTimer: ReturnType<typeof setTimeout> | null = null;
let unterwegs = false, nochmal = false;
/** Was beim Schliessen mit keepalive gehen darf (Bytes); Chromium nimmt zusammen hoechstens 64 KiB. */
const KEEPALIVE_BUDGET = 60000;
/** Nach jeder Aenderung: der ganze Stand, 500 ms entprellt; vor dem ersten Lesen nie. */
export function speichern(){
  if(lage !== "da" || !schreibbar()) return;
  if(nurLesen){ verboten(); return; }
  if(sendeTimer) clearTimeout(sendeTimer);
  sendeTimer = setTimeout(senden, 500);
}
function senden(keepalive = false){
  sendeTimer = null;
  // das abgerissene Fenster (Windows Teil 2) schreibt nichts
  if(lage !== "da" || !schreibbar() || ABRISS_FENSTER) return;
  // ueber der Grenze lehnte die Datei ab: nicht senden, sondern sagen, was zu tun ist (statusSetzen)
  const text = groesseMessen();
  if(groesse === "ueber"){ statusSetzen(); return; }
  if(unterwegs && !keepalive){ nochmal = true; return; }
  if(wiederTimer){ clearTimeout(wiederTimer); wiederTimer = null; }
  unterwegs = true;
  if(quelle === "online"){
    const schreiben = onlineHaken.schreiben;
    if(!schreiben){ unterwegs = false; return; }
    void schreiben(text).then(a => {
      unterwegs = false;
      if(a === "ok") basisText = text;
      speicher = a === "spaeter" ? "spaeter" : "";
      statusSetzen();
      if(nochmal){ nochmal = false; senden(); return; }
      if(a === "spaeter") wiederTimer = setTimeout(() => { wiederTimer = null; senden(); }, 5000);
    });
    return;
  }
  // keepalive traegt hoechstens 64 KiB (Chromium lehnt mehr ab, die Anfrage ginge verloren): darueber eine gewoehnliche
  // Anfrage, wie KEEPALIVE_BUDGET in 46-best-pull.ts; sie kommt durch, solange die Seite noch einen Augenblick lebt
  const body = '{"data":' + text + "}";
  const halten = keepalive && new TextEncoder().encode(body).length <= KEEPALIVE_BUDGET;
  fetch("/api/gilde", {method: "POST", headers: {"Content-Type": "application/json"}, body, keepalive: halten})
    .then(r => r.ok ? "" : r.status === 400 ? "nie" : "spaeter", () => "spaeter" as const)
    .then((a: Speicher) => {
      unterwegs = false;
      speicher = a;
      statusSetzen();
      if(nochmal){ nochmal = false; senden(); return; }
      if(a === "spaeter") wiederTimer = setTimeout(() => { wiederTimer = null; senden(); }, 5000);
    });
}
/** Beim Schliessen oder Neuladen: was noch aussteht, sofort senden - eine entprellte Aenderung, eine hinter dem
    laufenden POST wartende (nochmal) oder eine, die nach 503 auf den naechsten Versuch wartet. */
function beimVerlassen(){
  if(!sendeTimer && !nochmal && !wiederTimer) return;
  if(sendeTimer){ clearTimeout(sendeTimer); sendeTimer = null; }
  if(wiederTimer){ clearTimeout(wiederTimer); wiederTimer = null; }
  nochmal = false;
  senden(true);
}

/* ---------- Bausteine ---------- */
const ic = (p: string) => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + p + "</svg>";
const ROLLE_SYM: Record<string, string> = {
  tank: ic('<path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z"/>'),
  heal: ic('<path d="M12 5v14M5 12h14"/>'),
  dps: ic('<path d="M5 19L19 5M14 5h5v5M5 14l5 5"/>'),
};
const SYMBOL = '<span class="wsym"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 2.6l7.6 2.7v5.6c0 4.8-3.2 8.6-7.6 10.4-4.4-1.8-7.6-5.6-7.6-10.4V5.3z"/><path d="M4.4 11.4h15.2"/><path d="M8.6 14.4l3.4 2.6 3.4-2.6"/>' +
  '<path d="M12 4.9l.65 1.45 1.45.65-1.45.65-.65 1.45-.65-1.45-1.45-.65 1.45-.65z" fill="var(--acc, #E8A33D)" stroke="var(--acc, #E8A33D)" stroke-width="1"/></svg></span>';
const aktive = () => gildeState.gilde ? gildeState.gilde.mitglieder.filter(m => !m.geloest) : [];
/** Ist noch Platz fuer ein Mitglied? Vor jedem Anhaengen gefragt (Entwurf, Gruppe, "+ Mitglied"). */
const platz = () => !!gildeState.gilde && gildeState.gilde.mitglieder.length < MAX_MITGLIEDER;
const klasseName = (w: readonly string[]) => { const k = klasseVon(w); return k ? (state.lang === "de" ? k.de : k.en) : ""; };
function paar(w: readonly string[]): string {
  return w.length === 2 ? '<span class="gl-paar">' + weaponMark(w[0]!) + weaponMark(w[1]!) + "</span>"
    : '<span class="gl-paar leer" aria-hidden="true"><span class="wic"></span><span class="wic"></span></span>';
}
/** Die Zeile unter dem Namen: die Klasse, ohne Paar die Rolle als Wort (die Spalten Tank, Heiler, Schaden sagen den Rest). */
function klasseZeile(m: Mitglied): string {
  const r = rolleVon(m), k = klasseName(m.waffen);
  const wort = k || (r ? t("gilde.rolle." + r) : t("gilde.ohneWaffen"));
  return '<span class="gl-klasse">' + esc(wort) + "</span>";
}
/** Der Offspec als Wort unter der Klasse (ein zweites Waffenpaar). */
function offTag(m: Mitglied): string {
  const k = m.offspec ? klasseName(m.offspec) : "";
  return k ? '<span class="gl-offtag">' + esc(t("gilde.mitglied.offTag", {klasse: k})) + "</span>" : "";
}
/** Der Knopf mit data-f, damit der Fokus ein Neuzeichnen uebersteht. */
const knopf = (cls: string, attr: string, text: string) => '<button type="button" class="' + cls + '" ' + attr + ">" + esc(text) + "</button>";

/* ---------- Kopf und Statuszeile ---------- */
const wandMs = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13) || 0, +s.slice(14, 16) || 0);
/** Der naechste Termin, der nicht ausfaellt, ueber alle nicht geloesten Reihen. */
function naechster(g: Gilde, jetzt: string): { start: string; titel: string; key: string } | null {
  const bis = new Date(wandMs(jetzt) + 400 * 86400000).toISOString().slice(0, 10);
  let best: { start: string; titel: string; key: string } | null = null;
  for(const r of g.reihen){
    if(r.geloest) continue;
    const tm = termine(r, jetzt.slice(0, 10), bis).find(x => !x.aus && x.start >= jetzt);
    if(tm && (!best || tm.start < best.start)) best = {start: tm.start, titel: r.titel, key: terminSchluessel(tm)};
  }
  return best;
}
function restzeit(min: number): string {
  const d = Math.floor(min / 1440), h = Math.floor(min % 1440 / 60), m = min % 60;
  return d ? d + "\u00a0d " + h + "\u00a0h" : h ? h + "\u00a0h " + m + "\u00a0m" : m + "\u00a0m";
}
/** Der Saal: das Banner ueber den Reitern. Name der Gilde gross, die Besetzung als Leiste (Tank, Heiler, Schaden im Verhaeltnis),
 *  die Anwesenheit der letzten Termine als Saeulen und der naechste Ruf mit Wochentag und Uhrzeit. Nur Anzeige, nichts darin ist bedienbar. */
function saalHtml(g: Gilde, jetzt: string, x: { start: string; titel: string } | null): string {
  const ms = aktive(), zahl = (r: Rolle) => ms.filter(m => rolleVon(m) === r).length;
  const rollen = ROLLEN.map(r => [r, zahl(r)] as [Rolle, number]), ohne = ms.length - rollen.reduce((a, [, n]) => a + n, 0);
  const heute = jetzt.slice(0, 10);
  const saeulen = Object.keys(g.anwesend).map(k => ({tag: k.slice(k.indexOf("|") + 1), z: Object.values(g.anwesend[k] || {})}))
    .filter(e => e.tag <= heute && e.z.length > 0).sort((a, b) => a.tag < b.tag ? 1 : -1).slice(0, 12).reverse()
    .map(e => ({tag: e.tag, q: e.z.filter(v => v === "da").length / e.z.length}));
  const leiste = ms.length ? '<div class="gl-saal-leiste" aria-hidden="true">' + rollen.filter(([, n]) => n > 0).map(([r, n]) => '<i class="gl-saal-r-' + r + '" style="flex-grow:' + n + '"></i>').join("") +
    (ohne > 0 ? '<i class="gl-saal-r-x" style="flex-grow:' + ohne + '"></i>' : "") + "</div>" : "";
  const besetzung = '<dl class="gl-saal-zahlen">' + rollen.map(([r, n]) => "<div><dt>" + ROLLE_SYM[r] + esc(t("gilde.rolle." + r)) + "</dt><dd>" + n + "</dd></div>").join("") + "</dl>";
  const reihe = saeulen.length ? '<div class="gl-saal-saeulen" role="img" aria-label="' + esc(t("gilde.saal.verlauf", {n: saeulen.length, q: Math.round(saeulen.reduce((a, e) => a + e.q, 0) / saeulen.length * 100)})) + '">' +
    saeulen.map(e => '<i style="height:' + Math.max(6, Math.round(e.q * 100)) + '%" title="' + esc(datumKurz(e.tag) + " \u00b7 " + Math.round(e.q * 100) + "\u00a0%") + '"></i>').join("") + "</div>" : "";
  let ruf = '<p class="gl-saal-leer">' + esc(t("gilde.saal.keinRuf")) + "</p>";
  if(x){
    const wt = t("gilde.wt").split(" ")[new Date(wandMs(x.start)).getUTCDay()] || "";
    ruf = '<p class="gl-saal-wann"><b>' + esc(wt) + "</b> " + esc(x.start.slice(8, 10) + "." + x.start.slice(5, 7) + ".") + ' <span>' + esc(x.start.slice(11, 16)) + "</span></p>" +
      '<p class="gl-saal-was">' + esc(x.titel) + " \u00b7 " + esc(t("gilde.inZeit", {z: restzeit(Math.max(0, Math.round((wandMs(x.start) - wandMs(jetzt)) / 60000)))})) + "</p>";
  }
  return '<div class="gl-saal-name"><h3>' + esc(g.name) + '</h3><p>' + esc(t("gilde.saal.mitglieder", {n: ms.length})) + "</p></div>" +
    '<div class="gl-saal-mitte"><h4>' + esc(t("gilde.saal.besetzung")) + "</h4>" + leiste + besetzung + "</div>" +
    (reihe ? '<div class="gl-saal-verlauf"><h4>' + esc(t("gilde.saal.anwesenheit")) + "</h4>" + reihe + "</div>" : "") +
    '<div class="gl-saal-ruf"><h4>' + esc(t("gilde.saal.ruf")) + "</h4>" + ruf + "</div>";
}
function kopfSetzen(){
  const g = lage === "da" ? gildeState.gilde : null;
  const name = document.getElementById("gildeName"), n = document.getElementById("gildeNaechster"), saal = document.getElementById("gildeSaal");
  if(name) name.textContent = g ? g.name : "";
  const jetzt0 = wandUhr(Date.now());
  if(saal){
    saal.hidden = !g;
    const html = g ? saalHtml(g, jetzt0, naechster(g, jetzt0)) : "";
    if(saal.dataset.h !== html){ saal.dataset.h = html; saal.innerHTML = html; }
  }
  if(!n) return;
  const jetzt = jetzt0, x = g ? naechster(g, jetzt) : null;
  if(!x){ n.innerHTML = ""; return; }
  const wt = t("gilde.wt").split(" ")[new Date(wandMs(x.start)).getUTCDay()] || "";
  const wann = wt + " " + x.start.slice(8, 10) + "." + x.start.slice(5, 7) + ". " + x.start.slice(11, 16);
  n.innerHTML = "<span>" + esc(t("gilde.naechster")) + " <b>" + esc(wann) + "</b> \u00b7 " + esc(x.titel) + "</span><span>" +
    esc(t("gilde.inZeit", {z: restzeit(Math.max(0, Math.round((wandMs(x.start) - wandMs(jetzt)) / 60000)))})) + "</span>";
}
function statusSetzen(){
  const s = document.getElementById("gildeStatus");
  const text = groesse === "ueber" ? t("gilde.fehler.voll") : speicher === "nie" ? t("gilde.fehler.speichern") : speicher === "spaeter" ? t("gilde.fehler.spaeter")
    : groesse === "fast" ? t("gilde.warn.fastVoll") : ausgabeSatz;
  if(s && s.textContent !== text) s.textContent = text;
}
function ansage(text: string){
  const a = document.getElementById("gildeAnsage");
  if(a) a.textContent = text;
}

/* ---------- Reiter ---------- */
function reiterZeichnen(){
  const box = document.getElementById("gildeTabs");
  if(!box) return;
  box.setAttribute("role", "tablist");
  box.setAttribute("aria-label", t("gilde.titel"));
  box.innerHTML = REITER.map(k => '<button type="button" role="tab" id="gildeTab-' + k + '" data-gtab="' + k + '" aria-controls="gildeFlaeche" aria-selected="' +
    (k === gildeState.tab) + '" tabindex="' + (k === gildeState.tab ? 0 : -1) + '"><span class="wkrname">' + esc(t("gilde.tab." + k)) + "</span></button>").join("");
}
function reiterWaehlen(k: Reiter){
  gildeState.tab = k;
  ausgabeSatz = "";
  fokus = "tab:" + k;
  zeichnen();
}

/* ---------- Suche und Rollenfilter ---------- */
function filterBauen(box: HTMLElement){
  box.innerHTML = '<div class="field gl-suche"><label for="gildeSuche" id="gildeSucheLabel"></label><input id="gildeSuche" type="search" maxlength="60" autocomplete="off" spellcheck="false"></div>' +
    '<div class="gl-chips" role="radiogroup" id="gildeRollen">' + (["", ...ROLLEN] as Rolle[]).map(k =>
      '<button type="button" role="radio" data-rolle="' + k + '">' + (k ? ROLLE_SYM[k] : "") + '<span class="wort"></span> <em></em></button>').join("") + "</div>" +
    '<p class="gl-treffer" id="gildeTreffer" role="status"></p>';
}
function filterZeichnen(){
  const box = document.getElementById("gildeFilter");
  if(!box) return;
  if(!box.firstChild) filterBauen(box);
  const setzen = (e: Element | null, text: string) => { if(e && e.textContent !== text) e.textContent = text; };
  setzen(box.querySelector("#gildeSucheLabel"), t("gilde.suche"));
  const s = box.querySelector<HTMLInputElement>("#gildeSuche")!;
  s.placeholder = t("gilde.suche.platzhalter");
  if(s.value !== filter.suche) s.value = filter.suche;
  box.querySelector("#gildeRollen")!.setAttribute("aria-label", t("gilde.mitglied.rolle"));
  const alle = aktive();
  box.querySelectorAll<HTMLButtonElement>("#gildeRollen [role=radio]").forEach(b => {
    const k = (b.dataset.rolle || "") as Rolle, an = k === filter.rolle;
    setzen(b.querySelector(".wort"), t("gilde.filter." + (k || "alle")));
    setzen(b.querySelector("em"), String(k ? filtern(alle, {rolle: k, suche: ""}).length : alle.length));
    b.setAttribute("aria-checked", String(an));
    b.tabIndex = an ? 0 : -1;
  });
  setzen(box.querySelector("#gildeTreffer"), t("gilde.treffer", {n: filtern(alle, filter).length, m: alle.length}));
}
const filterAktiv = () => !!filter.rolle || !!filter.suche.trim();

/* ---------- Mitglieder ---------- */
/* Eine Kachel ist ein Knopf (Entscheidung 07.10.2026: 50 Mitglieder muessen auf eine Seite): Enter, Leertaste oder
   Klick oeffnen das Feld; Loesen und die Notiz stehen nur dort. Der Name fuer den Vorleser nennt Name, Klasse und Rolle. */
function kachel(m: Mitglied): string {
  const r = rolleVon(m), k = klasseName(m.waffen);
  const vorlesen = [m.name, k || t("gilde.ohneWaffen"), r ? t("gilde.rolle." + r) : t("gilde.ohneRolle")].join(", ");
  const an = m.id === bearbeiten;
  return '<li><button type="button" class="gl-kachel' + (an ? " sel" : "") + '" draggable="true" data-m-id="' + m.id + '" data-g="bearbeiten" data-f="b:' + m.id +
    '" aria-label="' + esc(vorlesen) + '"' + (an ? ' aria-controls="gildeEdit" aria-expanded="true"' : ' aria-expanded="false"') + '><span class="gl-kopf">' + paar(m.waffen) +
    '<span class="gl-txt"><span class="gl-name">' + esc(m.name) + "</span>" + klasseZeile(m) + offTag(m) + "</span></span></button></li>";
}
function listeHtml(): string {
  const alle = aktive();
  if(!alle.length) return '<p class="gl-leer">' + esc(t("gilde.mitglied.leer")) + "</p>";
  const ms = filtern(alle, filter);
  if(!ms.length) return '<p class="gl-leer">' + esc(t("gilde.keinTreffer")) + "</p>";
  return spaltenHtml(ms, kachel, drin => String(drin.length), "gl-kacheln");
}
/** Die Rollenspalten fuer Mitglieder und Anwesenheit: je Spalte die Kacheln und oben rechts eine Zahl. */
function spaltenHtml(ms: Mitglied[], kachelVon: (m: Mitglied) => string, zahl: (drin: Mitglied[]) => string, liste: string): string {
  const spalten = ([...ROLLEN, ""] as Rolle[]).map(r => {
    const drin = ms.filter(m => rolleVon(m) === r);
    if(!drin.length && (r === "" || filterAktiv())) return "";
    const titel = r ? t("gilde.rolle." + r) : t("gilde.ohneRolle");
    return '<section class="gl-spalte" aria-label="' + esc(titel) + '"><h3>' + (r ? ROLLE_SYM[r] : "") + esc(titel) + "<em>" + esc(zahl(drin)) + "</em></h3>" +
      '<ul class="' + liste + '">' + drin.map(kachelVon).join("") + "</ul></section>";
  }).filter(Boolean);
  /* breit: Schaden doppelt (die meisten Mitglieder); blendet der Filter Spalten aus, teilen sich die uebrigen die Breite */
  const breiten = ([...ROLLEN, ""] as Rolle[]).filter(r => { const n = ms.some(m => rolleVon(m) === r); return n || (r !== "" && !filterAktiv()); })
    .map(r => r === "dps" && !filterAktiv() ? "minmax(0,2fr)" : "minmax(0,1fr)");
  return '<div class="gl-spalten" style="--spalten:' + breiten.join(" ") + '">' + spalten.join("") + "</div>";
}
/** Das Mitglied im Feld: der Entwurf oder eines der Gilde, nie ein geloestes. */
function imFeld(): Mitglied | null {
  if(!bearbeiten) return null;
  if(entwurf && entwurf.id === bearbeiten) return entwurf;
  return aktive().find(m => m.id === bearbeiten) || null;
}
function wahlReihe(nr: 1 | 2): string {
  const eigen = wahl[nr - 1], andere = wahl[2 - nr];
  const stopp = eigen && eigen !== andere ? eigen : WAFFEN.find(w => w !== andere);
  return '<div class="gl-wahlreihe"><span id="gildeWr' + nr + '">' + esc(t("gilde.waffe" + nr)) + '</span><div class="gl-wb" role="group" aria-labelledby="gildeWr' + nr + '" data-nr="' + nr + '">' +
    WAFFEN.map(w => { const name = esc(weaponLabel(w));
      return '<button type="button" data-w="' + esc(w) + '" data-f="w' + nr + ":" + esc(w) + '" aria-pressed="' + (w === eigen) + '" aria-label="' + name + '" title="' + name + '"' +
        ' tabindex="' + (w === stopp ? 0 : -1) + '"' + (w === andere ? " disabled" : "") + ">" + weaponMark(w) + "</button>"; }).join("") + "</div></div>";
}
function feldHtml(m: Mitglied): string {
  const neu = m === entwurf, k = klasseVon(m.waffen);
  const titel = neu || !m.name ? t("gilde.mitglied.neuT") : t("gilde.mitglied.bearbeitenT", {name: m.name});
  const rollenFeld = '<div class="field"><label for="gildeERolle">' + esc(t("gilde.mitglied.rolle")) + '</label><select id="gildeERolle" data-f="erolle">' +
    ([...ROLLEN, ""] as Rolle[]).map(r => '<option value="' + r + '"' + (r === m.rolle ? " selected" : "") + ">" + esc(t("gilde.rolle." + (r || "keine"))) + "</option>").join("") +
    '</select></div><p class="gl-note">' + esc(t("gilde.rolleSelbst")) + "</p>";
  const ergebnis = k ? '<p class="gl-ergebnis">' + paar(m.waffen) + "<span><b>" + esc(klasseName(m.waffen)) + "</b> \u00b7 " + esc(t("gilde.rolle." + k.role)) + "</span>" +
    '<span class="gl-note">' + esc(t("gilde.klasseRolle")) + "</span></p>" : rollenFeld;
  const alsDps = k && k.role === "heal" ? '<label class="gl-alsdps"><input type="checkbox" id="gildeEAlsDps" data-f="ealsdps"' + (m.alsDps ? " checked" : "") + "><span>" + esc(t("gilde.mitglied.alsDps")) + "</span></label>" : "";
  const offReihe = (nr: 1 | 2) => {
    const eigen = offWahl[nr - 1], andere = offWahl[2 - nr], stopp = eigen && eigen !== andere ? eigen : WAFFEN.find(w => w !== andere);
    return '<div class="gl-wahlreihe"><span id="gildeEOffWr' + nr + '">' + esc(t("gilde.mitglied.offWaffe", {n: nr})) + '</span><div class="gl-wb" role="group" aria-labelledby="gildeEOffWr' + nr + '" data-nr="o' + nr + '">' +
      WAFFEN.map(w => { const name = esc(weaponLabel(w));
        return '<button type="button" data-w="' + esc(w) + '" data-f="o' + nr + ":" + esc(w) + '" aria-pressed="' + (w === eigen) + '" aria-label="' + name + '" title="' + name + '"' +
          ' tabindex="' + (w === stopp ? 0 : -1) + '"' + (w === andere ? " disabled" : "") + ">" + weaponMark(w) + "</button>"; }).join("") + "</div></div>";
  };
  const ok = offWahl[0] && offWahl[1] ? klasseVon([offWahl[0], offWahl[1]]) : null;
  const offspec = '<details class="gl-off" id="gildeEOff"' + (offWahl[0] || offWahl[1] ? " open" : "") + '><summary data-f="eoffsum">' + esc(t("gilde.mitglied.offspec")) + "</summary>" + offReihe(1) + offReihe(2) +
    '<p class="gl-ergebnis">' + (ok ? "<span><b>" + esc(state.lang === "de" ? ok.de : ok.en) + "</b> \u00b7 " + esc(t("gilde.rolle." + ok.role)) + "</span>" : '<span class="gl-note">' + esc(t("gilde.mitglied.offLeer")) + "</span>") +
    (offWahl[0] || offWahl[1] ? " " + knopf("btn sm", 'data-g="offAus" data-f="offaus"', t("gilde.mitglied.offAus")) : "") + "</p></details>";
  const frage = austrittFrage === m.id
    ? '<div class="gl-frage" role="group" aria-labelledby="gildeFrageT"><p id="gildeFrageT">' + esc(t("gilde.mitglied.austrittFrage", {name: m.name})) + "</p>" +
      knopf("btn sm hot", 'data-g="austrJa" data-f="austrJa"', t("gilde.mitglied.austrittJa")) + knopf("btn sm", 'data-g="austrNein" data-f="austrNein"', t("gilde.abbrechen")) + "</div>" : "";
  return '<section class="gl-edit" id="gildeEdit" aria-labelledby="gildeEditT"><h3 id="gildeEditT">' + esc(titel) + "</h3>" +
    '<div class="gl-eform"><div class="gl-waffen">' +
      '<div class="field"><label for="gildeEName">' + esc(t("gilde.mitglied.name")) + '</label><input id="gildeEName" data-f="ename" maxlength="24" autocomplete="off" spellcheck="false" value="' + esc(m.name) + '"></div>' +
      '<div class="field"><label for="gildeENotiz">' + esc(t("gilde.mitglied.notiz")) + '</label><input id="gildeENotiz" data-f="enotiz" maxlength="120" autocomplete="off" placeholder="' +
        esc(t("gilde.mitglied.notizPh")) + '" value="' + esc(m.notiz) + '"></div>' +
    '</div><div class="gl-waffen">' + wahlReihe(1) + wahlReihe(2) + ergebnis + alsDps + offspec + "</div></div>" +
    '<div class="gl-eaus">' + (frage || knopf("btn sm hot", 'data-g="fertig" data-f="fertig"', t("gilde.mitglied.fertig")) +
      (neu ? "" : knopf("btn sm", 'data-g="loesen" data-f="eloesen"', t("gilde.mitglied.loesen")))) + "</div></section>";
}
/** Die Ehemaligen (ausgetreten oder geloest), aufklappbar: Datum und Zurueckholen. Ihre Daten bleiben in der Datei. */
function ehemaligeHtml(): string {
  const ehem = gildeState.gilde!.mitglieder.filter(m => m.geloest);
  if(!ehem.length) return "";
  return '<details class="gl-ehem"' + (ehemaligeOffen ? " open" : "") + '><summary data-f="ehemsum">' + esc(t("gilde.mitglied.ehemalige")) + " <em>" + ehem.length + "</em></summary><ul>" +
    ehem.map(m => '<li data-m-id="' + m.id + '"><span class="gl-name">' + esc(m.name) + "</span><small>" + esc(m.ausgetreten ? t("gilde.mitglied.ausgetretenAm", {datum: datumKurz(m.ausgetreten)}) : t("gilde.mitglied.geloestKurz")) + "</small>" +
      '<button type="button" class="btn sm" data-g="ehemZurueck" data-m-id="' + m.id + '" data-f="ez:' + m.id + '" aria-label="' + esc(t("gilde.mitglied.zurueckholenAria", {name: m.name})) + '">' + esc(t("gilde.mitglied.zurueckholen")) + "</button>" +
      loeschKnopf("mitglied", m.id, m.name) + (loeschFrage?.was === "mitglied" && loeschFrage.id === m.id ? loeschFrageHtml(m.name) : "") + "</li>").join("") +
    '</ul><p class="gl-note">' + esc(t("gilde.mitglied.ehemFuss")) + "</p></details>";
}
function mitgliederHtml(): string {
  const g = gildeState.gilde!;
  const voll = !platz();
  const hilfe = voll ? '<p class="gl-hilfe" id="gildeMaxSatz">' + esc(t("gilde.mitglied.max")) + "</p>" : "";
  const kopf = '<div class="gl-akopf"><h3>' + esc(t("gilde.tab.mitglieder")) + "</h3>" +
    '<button type="button" class="btn sm hot" id="gildeMNeu" data-g="neu" data-f="neu"' + (voll ? ' disabled aria-describedby="gildeMaxSatz"' : "") + ">" + esc(t("gilde.mitglied.neu")) + "</button>" +
    hilfe + "</div>";
  const weg = undo ? g.mitglieder.find(m => m.id === undo && m.geloest) : null;
  const undoHtml = weg ? '<p class="gl-meldung" id="gildeUndo"><span>' + esc(t("gilde.mitglied.geloest", {name: weg.name})) + "</span>" +
    knopf("btn sm", 'data-g="undo" data-f="undo"', t("gilde.mitglied.rueckgaengig")) + "</p>" : "";
  const satz = meldung ? '<p class="gl-meldung">' + esc(meldung) + "</p>" : "";
  const m = imFeld();
  const ablage = '<div class="gl-ablage" id="gildeAblage" hidden>' + esc(t("gilde.mitglied.ablage")) + "</div>";
  return kopf + undoHtml + satz + ablage + '<div id="gildeListe">' + listeHtml() + "</div>" + ehemaligeHtml() + (m ? feldHtml(m) : "") +
    '<p class="gl-fuss">' + esc(t("gilde.mitglied.fuss")) + "</p>";
}

/* ---------- Termine ---------- */
/** Wie die Datei (gilde.ts): hoechstens 20 Reihen (geloeste zaehlen mit), 4000 Termine mit Marken, 4000 Ausnahmen je Reihe. */
const MAX_REIHEN = 20, MAX_TERMINE = 4000, MAX_AUSNAHMEN = 4000;
const ZONE_RX = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){0,2}$/;
const START_RX = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const ZEIT_RX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAUERN = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480];
const ERINNERUNGEN = [0, 5, 10, 15, 30, 60, 120];
const ARTEN: Wdh["art"][] = ["einmal", "woche", "tage"];
type Gesetzt = "da" | "fehlt";
const MARKEN: Gesetzt[] = ["da", "fehlt"];
const MARKE_SYM: Record<Gesetzt, string> = {
  da: ic('<path d="M5 12.5l4.2 4.2L19 7"/>'),
  fehlt: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
};
/** Der gewaehlte Termin (Reihe|Datum); null: der juengste vergangene, ohne ihn der naechste. */
let termin: string | null = null;
/** Das Formular einer Reihe (id null: neu); die Werte leben hier, damit ein Neuzeichnen sie nicht verliert. */
interface ReiheFeld { id: string | null; titel: string; start: string; dauerMin: number; art: Wdh["art"]; tage: number[]; bis: string; erinnerungMin: number;
  /** gebunden: die Reihe hat Haken oder Ausnahmen, Beginn und Rhythmus stehen fest; ab: "Ab jetzt anders" ist gewaehlt */
  gebunden: boolean; ab: boolean }
let reiheFeld: ReiheFeld | null = null;
let reiheFehler = "";
/** Die zuletzt geloeste Reihe: ihr Satz mit Rueckgaengig bleibt bis zum naechsten Eingriff. */
let reiheUndo: string | null = null;
/** Ist das Feld "Verschieben" des gewaehlten Termins offen? */
let verschieben = false;
/** Wie viele Wochen zurueck je Reihe (12, dann je 12 mehr); nur in der Sitzung. */
const wochen: Record<string, number> = {};
/** Welche Events aufgeklappt sind (je Event-ID); anfangs nur das des gewaehlten Termins. Nur in der Sitzung. */
const reihenOffen = new Map<string, boolean>();
/** Das getippte Datum der Suche nach Events an einem Tag. Nur in der Sitzung. */
let datumSuche = "";
/* Anwesenheit eines Termins nach Marke filtern: alle, da, nicht da, offen */
type AnwFilter = "alle" | "da" | "fehlt" | "offen";
const ANW_FILTER: AnwFilter[] = ["alle", "da", "fehlt", "offen"];
let anwFilter: AnwFilter = "alle";
/** Mitglieder: die Waffen des Offspecs im Feld (eine allein bleibt hier), die offene Frage "ausgetreten?" und ob die Ehemaligen aufgeklappt sind. */
let offWahl: [string | null, string | null] = [null, null], austrittFrage: string | null = null, ehemaligeOffen = false;

const tagPlus = (d: string, n: number) => new Date(wandMs(d) + n * 86400000).toISOString().slice(0, 10);
const zeitPlus = (start: string, min: number) => new Date(wandMs(start) + min * 60000).toISOString().slice(11, 16);
const datumKurz = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7) + ".";
const datumLang = (d: string) => datumKurz(d) + d.slice(0, 4);
const wochentag = (d: string) => new Date(wandMs(d)).getUTCDay();
const wtKurz = (n: number) => t("gilde.wt").split(" ")[n] || "";
function dauerText(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? h + "\u00a0h" + (m ? " " + m + "\u00a0m" : "") : m + "\u00a0m";
}
/** Die Zeitzone des PCs, wie die Datei sie annimmt; sonst UTC. */
function zone(): string {
  try{ const z = Intl.DateTimeFormat().resolvedOptions().timeZone; if(z && z.length <= 40 && ZONE_RX.test(z)) return z; }catch(err){}
  return "UTC";
}
const reiheVon = (id: string | undefined) => gildeState.gilde?.reihen.find(r => r.id === id && !r.geloest);
/** Die Regel in Worten, etwa "jeden So 20:00", die Dauer, das Ende. */
function regel(r: Reihe): string {
  const zeit = r.start.slice(11, 16), erster = r.start.slice(0, 10);
  const teil = r.wdh.art === "einmal" ? t("gilde.reihe.regel.einmal", {zeit: datumLang(erster) + " " + zeit})
    : r.wdh.art === "woche" ? t("gilde.reihe.regel.woche", {tag: wtKurz(wochentag(erster)), zeit})
    : t("gilde.reihe.regel.tage", {tage: [1, 2, 3, 4, 5, 6, 0].filter(d => r.wdh.tage.includes(d)).map(wtKurz).join(", "), zeit});
  const bis = r.wdh.art !== "einmal" && r.wdh.bis ? [t("gilde.reihe.regel.bis", {datum: datumLang(r.wdh.bis)})] : [];
  // die Reihe bleibt in ihrer Zone; hat der PC eine andere, steht sie dabei (Spezifikation 3)
  return [teil, ...bis, dauerText(r.dauerMin), ...(r.zone !== zone() ? [r.zone] : [])].join(" \u00b7 ");
}
/** Die Termine einer Reihe in der Liste: die zwei naechsten und die vergangenen der gezeigten Wochen. */
function liste(r: Reihe, jetzt: string): { kommend: Termin[]; vergangen: Termin[]; mehr: boolean } {
  // zurueck hoechstens 3650 Tage (die Spanne bleibt in dem, was termine() durchlaeuft), vor 400 Tage, je fuer sich gerechnet
  const heute = jetzt.slice(0, 10), grenze = tagPlus(heute, -3650);
  const gewollt = tagPlus(heute, -7 * (wochen[r.id] || 12)), von = gewollt > grenze ? gewollt : grenze;
  const bisHeute = termine(r, von, heute);
  const kommend = [...bisHeute.filter(x => x.start > jetzt), ...termine(r, tagPlus(heute, 1), tagPlus(heute, 400))].slice(0, 2);
  // an der Grenze holt ein Klick nichts mehr: dann gibt es den Knopf nicht (Entscheidung 07.10.2026)
  return { kommend, vergangen: bisHeute.filter(x => x.start <= jetzt).reverse(), mehr: r.start.slice(0, 10) < von && gewollt > grenze };
}
/** Erster Termin und Ende einer Reihe: zwischen heute vor 10 Jahren und in 2 Jahren (Wanduhr). So bleibt jede
    Spanne in dem, was termine() durchlaeuft, und ein Jahr 0-99 erreicht die Datei nie (dort waere es 19xx). */
function spanne(): [string, string] {
  const h = wandUhr(Date.now()).slice(0, 10), j = +h.slice(0, 4);
  return [String(j - 10).padStart(4, "0") + h.slice(4), String(j + 2).padStart(4, "0") + h.slice(4)];
}
/** Der letzte Tag einer Reihe mit Haken (nicht "offen") oder mit einer Ausnahme; "" ohne. */
function letzterGebunden(g: Gilde, r: Reihe): string {
  let d = "";
  for(const [k, z] of Object.entries(g.anwesend)){
    const tag = k.slice(r.id.length + 1);
    if(k.startsWith(r.id + "|") && tag > d && Object.values(z).some(x => x !== "offen")) d = tag;
  }
  for(const tag of Object.keys(r.ausnahmen)) if(tag > d) d = tag;
  return d;
}
/** Der Termin rechts: der gewaehlte, sonst der juengste vergangene, der nicht ausfaellt, sonst der naechste. */
function aktiverTermin(g: Gilde, jetzt: string): { r: Reihe; tm: Termin } | null {
  if(termin){
    const i = termin.indexOf("|"), r = reiheVon(termin.slice(0, i)), d = termin.slice(i + 1);
    const tm = r ? termine(r, d, d)[0] : undefined;
    if(r && tm) return {r, tm};
  }
  let best: { r: Reihe; tm: Termin } | null = null;
  for(const r of g.reihen){
    if(r.geloest) continue;
    const v = liste(r, jetzt).vergangen.find(x => !x.aus);
    if(v && (!best || v.start > best.tm.start)) best = {r, tm: v};
  }
  if(best) return best;
  for(const r of g.reihen){
    if(r.geloest) continue;
    const k = liste(r, jetzt).kommend[0];
    if(k && (!best || k.start < best.tm.start)) best = {r, tm: k};
  }
  return best;
}
/** Wer an diesem Tag auf der Liste steht: nicht geloest und nicht inaktiv. */
const gelistet = (tag: string) => aktive().filter(m => aufListe(m, tag));
const abgehaktZahl = (g: Gilde, key: string) => {
  const z = g.anwesend[key] || {}, c = g.zaehler?.[key] || {};
  return gelistet(key.slice(key.indexOf("|") + 1)).filter(m => (z[m.id] ?? "offen") !== "offen" || m.id in c).length;
};
/** Die Art, wenn dieses Event mehr als eine Teilnahme je Punkt zaehlt (Gildenboss: 7): dann steht je Mitglied ein Zaehler statt der Marken. */
function zaehlerArt(g: Gilde, re: Reihe): Art | null { return g.punkte?.arten.find(a => a.id === re.art && !a.geloest && a.proPunkt > 1) ?? null; }
/** Den Zaehler eines Mitglieds an einem Termin setzen (0 bis max); wahr, wenn sich etwas geaendert hat. */
function zaehlerSetzen(key: string, mid: string, n: number, max: number): boolean {
  const g = gildeState.gilde!;
  const w = Math.max(0, Math.min(max, Math.floor(n) || 0));
  if(!g.zaehler) g.zaehler = {};
  let z = g.zaehler[key];
  if(!z){
    if(Object.keys(g.zaehler).length >= MAX_TERMINE){ meldung = t("gilde.termin.max"); ansage(meldung); return false; }
    z = g.zaehler[key] = {};
  }
  if(z[mid] === w) return false;
  z[mid] = w;
  return true;
}
function terminZeile(g: Gilde, r: Reihe, tm: Termin, jetzt: string, nx: string, akt: string): string {
  const key = terminSchluessel(tm), von = tm.start.slice(11, 16), zeit = r.start.slice(11, 16);
  const notiz = [datumKurz(tm.datum), key === nx ? t("gilde.termin.naechster") : "", von !== zeit ? t("gilde.termin.verschoben", {zeit}) : ""].filter(Boolean).join(" \u00b7 ");
  const n = abgehaktZahl(g, key);
  const stand = tm.aus ? t("gilde.termin.faelltAus")
    : tm.start > jetzt ? t("gilde.inZeit", {z: restzeit(Math.max(0, Math.round((wandMs(tm.start) - wandMs(jetzt)) / 60000)))})
    : n ? t("gilde.termin.abgehakt", {n, m: gelistet(tm.datum).length}) : t("gilde.termin.vergangen");
  return '<li><button type="button" class="gl-term' + (tm.aus ? " aus" : "") + '" data-g="termin" data-termin="' + key + '" data-datum="' + tm.datum + '" data-f="t:' + key + '"' +
    (key === akt ? ' aria-current="true"' : "") + '><span class="gl-chip" aria-hidden="true"><b>' + tm.datum.slice(8, 10) + "</b><small>" + esc(wtKurz(wochentag(tm.datum))) + "</small></span>" +
    '<span class="wann"><span><span class="vh">' + esc(t("gilde.tag." + wochentag(tm.datum))) + " </span>" + esc(t("gilde.termin.zeit", {von, bis: zeitPlus(tm.start, r.dauerMin)})) + "</span>" +
    '<small class="gl-tnote">' + esc(notiz) + '</small></span><span class="stand">' + esc(stand) + "</span></button></li>";
}
const CHEVRON = ic('<path d="M7 10l5 5 5-5"/>');
/** Die Suche nach den Events an einem getippten Tag: ein Satz und je Treffer die Uhrzeit mit "Oeffnen". */
function datumSucheHtml(g: Gilde, tag: string | null): string {
  let satz = "", treffer = "";
  if(datumSuche.trim()){
    if(!tag) satz = t("gilde.termin.dHinweis");
    else {
      const ev = eventsAm(g, tag), vorbei = tag < wandUhr(Date.now()).slice(0, 10), lang = datumLang(tag), z = vorbei ? "vorbei" : "jetzt";
      satz = !ev.length ? t("gilde.termin.dKein." + z, {datum: lang}) : t("gilde.termin." + (ev.length === 1 ? "dEin." : "dMehr.") + z, {datum: lang, n: ev.length});
      treffer = ev.length ? '<ul class="gl-dtreffer">' + ev.map(x => '<li><span class="gl-den"><b>' + esc(x.reihe.titel) + "</b><small>" + esc(t("gilde.termin.dZeit", {zeit: x.zeit})) +
        (x.aus ? " \u00b7 " + esc(t("gilde.termin.faelltAus")) : "") + "</small></span>" +
        knopf("btn sm", 'data-g="dOeffnen" data-key="' + x.reihe.id + "|" + tag + '" data-f="do:' + x.reihe.id + '" aria-label="' + esc(t("gilde.termin.dOeffnenAria", {titel: x.reihe.titel, datum: lang})) + '"', t("gilde.termin.dOeffnen")) + "</li>").join("") + "</ul>" : "";
    }
  }
  return '<div class="gl-datum" role="search"><label class="gl-p-fk"><span>' + esc(t("gilde.termin.dSuche")) + '</span><input id="gildeDSuche" type="text" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="' +
    esc(t("gilde.termin.dPlatz")) + '" data-f="dsuche" aria-describedby="gildeDSatz" value="' + esc(datumSuche) + '"></label>' + (datumSuche ? knopf("btn sm", 'data-g="dNull" data-f="dnull"', t("gilde.termin.dNull")) : "") +
    '<p id="gildeDSatz" class="gl-dsatz" role="status" aria-live="polite">' + esc(satz) + "</p>" + treffer + "</div>";
}
function agendaHtml(g: Gilde, jetzt: string, akt: string): string {
  const nx = naechster(g, jetzt)?.key || "", voll = g.reihen.length >= MAX_REIHEN;
  const reihen = g.reihen.filter(r => !r.geloest);
  const weg = reiheUndo ? g.reihen.find(r => r.id === reiheUndo && r.geloest) : null;
  const undoHtml = weg ? '<p class="gl-meldung" id="gildeRUndo"><span>' + esc(t("gilde.reihe.geloest", {titel: weg.titel})) + "</span>" +
    knopf("btn sm", 'data-g="reiheUndo" data-f="rundo"', t("gilde.mitglied.rueckgaengig")) + "</p>" : "";
  // anfangs ist nur das Event des gewaehlten Termins aufgeklappt (ohne Wahl das erste)
  const neue = reihen.filter(r => !reihenOffen.has(r.id));
  if(neue.length){ const wahl = reihen.find(r => akt.startsWith(r.id + "|")) ?? reihen[0]; neue.forEach(r => reihenOffen.set(r.id, r === wahl)); }
  // ein gueltiges Datum in der Suche: nur die Treffer stehen da, die Events kommen mit "Zuruecksetzen" wieder
  const tag = datumParse(datumSuche, +jetzt.slice(0, 4));
  return undoHtml + '<section class="gl-agenda" aria-labelledby="gildeAgendaT"><h3 id="gildeAgendaT">' + esc(t("gilde.reihen")) + "</h3>" + datumSucheHtml(g, tag) +
    (reihen.length ? "" : '<p class="gl-leer">' + esc(t("gilde.reihe.leer")) + "</p>") +
    (tag ? "" : reihen.map(r => {
      const l = liste(r, jetzt), auf = !!reihenOffen.get(r.id);
      return '<div class="gl-reihe" data-r-id="' + r.id + '"><p class="gl-reihenkopf"><button type="button" class="gl-rk" data-g="reiheZu" data-r-id="' + r.id + '" data-f="rk:' + r.id + '" aria-expanded="' + auf + '" aria-controls="gildeRL-' + r.id +
        '" aria-label="' + esc(t(auf ? "gilde.reihe.zuklappen" : "gilde.reihe.aufklappen", {titel: r.titel})) + '">' + CHEVRON + "</button><b>" + esc(r.titel) + "</b><small>" + esc(regel(r)) + "</small>" +
        '<button type="button" class="btn sm" data-g="reiheAendern" data-r-id="' + r.id + '" data-f="ra:' + r.id + '" aria-label="' + esc(t("gilde.reihe.aendernT", {titel: r.titel})) + '">' +
        esc(t("gilde.reihe.aendern")) + "</button></p>" +
        (auf ? '<ul class="gl-liste" id="gildeRL-' + r.id + '">' + [...l.kommend.slice().reverse(), ...l.vergangen].map(tm => terminZeile(g, r, tm, jetzt, nx, akt)).join("") + "</ul>" +
          (l.mehr ? '<p class="gl-fuss">' + knopf("btn sm", 'data-g="aelter" data-r-id="' + r.id + '" data-f="alt:' + r.id + '"', t("gilde.termin.aelter")) + "</p>" : "") : "") + "</div>";
    }).join("")) +
    '<p class="gl-fuss"><button type="button" class="btn sm" id="gildeRNeu" data-g="reiheNeu" data-f="rneu"' + (voll ? ' disabled aria-describedby="gildeRMax"' : "") + ">" +
      esc(t("gilde.reihe.neu")) + "</button>" + (voll ? '<span id="gildeRMax">' + esc(t("gilde.reihe.max")) + "</span>" : "") + "</p></section>";
}
/** Der Zaehler 0 bis N statt der Marken: Minus, die Zahl (tippbar) von N, Plus. */
function zaehlerHtml(m: Mitglied, art: Art, wert: number | undefined): string {
  const n = art.proPunkt, name = t("gilde.termin.zaehlerAria", {name: m.name, art: art.name, n});
  return '<div class="gl-zaehler" role="group" aria-label="' + esc(name) + '"><button type="button" class="btn sm icon" data-g="zMinus" data-z-id="' + m.id + '" data-f="zm:' + m.id + '" aria-label="' + esc(t("gilde.termin.zWeniger")) + '">−</button>' +
    '<input class="gl-zin" type="number" inputmode="numeric" min="0" max="' + n + '" step="1" data-z-id="' + m.id + '" data-f="z:' + m.id + '" placeholder="–" aria-label="' + esc(name) + '" value="' + (wert === undefined ? "" : wert) + '">' +
    '<span class="gl-zvon">/' + n + '</span><button type="button" class="btn sm icon" data-g="zPlus" data-z-id="' + m.id + '" data-f="zp:' + m.id + '" aria-label="' + esc(t("gilde.termin.zMehr")) + '">+</button></div>';
}
function anwKachel(m: Mitglied, datum: string, marke: Marke | undefined, zaehler: {art: Art; wert: number | undefined} | null = null): string {
  // man ist da oder nicht da: eine alte Marke "entschuldigt" aus der Datei zeigt sich als "nicht da" (die Datei behaelt sie)
  const mk: Gesetzt | "" = zaehler ? (zaehler.wert === undefined ? "" : zaehler.wert >= zaehler.art.proPunkt ? "da" : zaehler.wert === 0 ? "fehlt" : "")
    : marke === "da" ? "da" : marke === "fehlt" || marke === "entschuldigt" ? "fehlt" : "";
  const stopp = mk || "da";
  return '<li><div class="gl-anw" data-m="' + mk + '"><span class="gl-kopf"><span class="gl-pp">' + paar(m.waffen) +
    '<span class="gl-plakette" aria-hidden="true">' + (mk ? MARKE_SYM[mk] : "") + "</span></span>" + '<span class="gl-txt"><span class="gl-name">' + esc(m.name) + "</span>" + klasseZeile(m) + "</span></span>" +
    (zaehler ? zaehlerHtml(m, zaehler.art, zaehler.wert) : '<div class="gl-marken" role="radiogroup" data-m-id="' + m.id + '" aria-label="' + esc(m.name + ", " + datumLang(datum)) + '">' +
    MARKEN.map(k => { const w = esc(t("gilde.marke." + k));
      return '<button type="button" role="radio" data-marke="' + k + '" data-f="a:' + m.id + ":" + k + '" aria-checked="' + (k === mk) + '" tabindex="' + (k === stopp ? 0 : -1) +
        '" aria-label="' + w + '" title="' + w + '">' + MARKE_SYM[k] + '<span class="wort">' + w + "</span></button>"; }).join("") + "</div>") + "</div></li>";
}
function anwesenheitHtml(g: Gilde, r: Reihe, tm: Termin): string {
  const key = terminSchluessel(tm), z = g.anwesend[key] || {};
  const wann = wtKurz(wochentag(tm.datum)) + " " + datumLang(tm.datum);
  const alle = gelistet(tm.datum), von = tm.start.slice(11, 16), zeit = r.start.slice(11, 16), zart = zaehlerArt(g, r), cz = g.zaehler?.[key] || {};
  const knoepfe = tm.aus ? knopf("btn sm", 'data-g="zurueck" data-f="zurueck"', t("gilde.termin.zurueck"))
    : (zart ? knopf("btn sm", 'data-g="alleN" data-f="alleN"' + (alle.length ? "" : " disabled"), t("gilde.termin.alleN", {n: zart.proPunkt}))
        : knopf("btn sm", 'data-g="alleDa" data-f="alleDa"' + (alle.length ? "" : " disabled"), t("gilde.termin.alleDa"))) +
      knopf("btn sm", 'data-g="verschieben" data-f="verschieben" aria-expanded="' + verschieben + '"', t("gilde.termin.verschieben")) +
      knopf("btn sm", 'data-g="ausfall" data-f="ausfall"', t("gilde.termin.ausfall"));
  const zeile = [t("gilde.termin.zeit", {von, bis: zeitPlus(tm.start, r.dauerMin)}), ...(von !== zeit ? [t("gilde.termin.verschoben", {zeit})] : []),
    tm.aus ? t("gilde.termin.faelltAus") : t("gilde.termin.stand", {n: abgehaktZahl(g, key), m: alle.length})].join(" \u00b7 ");
  const kopf = '<div class="gl-akopf"><h3 id="gildeTerminT">' + esc(wann + " \u00b7 " + r.titel) + "</h3>" + knoepfe + '<p class="gl-wann">' + esc(zeile) + "</p></div>";
  const satz = meldung ? '<p class="gl-meldung">' + esc(meldung) + "</p>" : "";
  if(tm.aus) return kopf + satz + '<p class="gl-meldung">' + esc(t("gilde.termin.ausSatz")) + "</p>";
  const feld = verschieben ? '<section class="gl-edit" id="gildeVerschieben" aria-labelledby="gildeVT"><h3 id="gildeVT">' + esc(t("gilde.termin.verschiebenT", {wann})) + "</h3>" +
    '<form class="gl-vform" id="gildeVForm" novalidate><div class="field"><label for="gildeVZeit">' + esc(t("gilde.termin.neueZeit")) + "</label>" +
    '<input id="gildeVZeit" type="time" data-f="vzeit" value="' + von + '"></div><button type="submit" class="btn sm hot" data-f="vok">' + esc(t("gilde.termin.verschieben")) + "</button>" +
    knopf("btn sm", 'data-g="vAb" data-f="vab"', t("gilde.abbrechen")) + "</form></section>" : "";
  if(!alle.length) return kopf + satz + feld + '<p class="gl-leer">' + esc(t("gilde.mitglied.leer")) + "</p>";
  const markeVon = (m: Mitglied): AnwFilter => zart ? (!(m.id in cz) ? "offen" : (cz[m.id] ?? 0) > 0 ? "da" : "fehlt") : z[m.id] === "da" ? "da" : z[m.id] === "fehlt" || z[m.id] === "entschuldigt" ? "fehlt" : "offen";
  const nachRolle = filtern(alle, filter);
  const zahlen: Record<AnwFilter, number> = {alle: nachRolle.length, da: 0, fehlt: 0, offen: 0};
  nachRolle.forEach(m => { zahlen[markeVon(m)]++; });
  const ms = anwFilter === "alle" ? nachRolle : nachRolle.filter(m => markeVon(m) === anwFilter);
  const da = (drin: Mitglied[]) => drin.filter(m => markeVon(m) === "da").length;
  const offen = nachRolle.filter(m => markeVon(m) === "offen").length;
  const anwChips = '<div class="gl-chips gl-anwfil" id="gildeAnwFilter" role="radiogroup" aria-label="' + esc(t("gilde.termin.anwFilter")) + '">' + ANW_FILTER.map(k =>
    '<button type="button" role="radio" data-g="anwF" data-af="' + k + '" data-f="af:' + k + '" aria-checked="' + (anwFilter === k) + '" tabindex="' + (anwFilter === k ? 0 : -1) + '"><span class="wort">' +
    esc(t("gilde.termin.af." + k)) + "</span> <em>" + zahlen[k] + "</em></button>").join("") + "</div>";
  const summe = '<ul class="gl-summe" aria-label="' + esc(t("gilde.termin.wer")) + '">' + ROLLEN.filter(rl => !filterAktiv() || ms.some(m => rolleVon(m) === rl)).map(rl => {
    const drin = ms.filter(m => rolleVon(m) === rl);
    return "<li>" + esc(t("gilde.rolle." + rl)) + " <b>" + esc(t("gilde.termin.daVon", {n: da(drin), m: drin.length})) + "</b></li>";
  }).join("") + "<li>" + esc(t("gilde.marke.offen")) + " <b>" + offen + "</b></li></ul>";
  const spalten = ms.length ? spaltenHtml(ms, m => anwKachel(m, tm.datum, z[m.id], zart ? {art: zart, wert: cz[m.id]} : null), drin => da(drin) + "/" + drin.length, "gl-kacheln anw")
    : '<p class="gl-leer">' + esc(t("gilde.keinTreffer")) + "</p>";
  return kopf + satz + feld + summe + anwChips + spalten + '<p class="gl-fuss">' + esc(t("gilde.termin.fuss")) + "</p>";
}
function reiheFormHtml(e: ReiheFeld): string {
  const neu = !e.id, alt = neu ? null : reiheVon(e.id!), fest = e.gebunden && !e.ab, aus = fest ? " disabled" : "";
  const [min, max] = spanne();
  const sel = (id: string, f: string, opts: [string, string][], wert: string, zu = "") => '<select id="' + id + '" data-f="' + f + '"' + zu + ">" +
    opts.map(([v, l]) => '<option value="' + v + '"' + (v === wert ? " selected" : "") + ">" + esc(l) + "</option>").join("") + "</select>";
  const feld = (id: string, label: string, inner: string) => '<div class="field"><label for="' + id + '">' + esc(label) + "</label>" + inner + "</div>";
  const dauern = [...new Set([...DAUERN, e.dauerMin])].sort((a, b) => a - b);
  const tage = e.art !== "tage" ? "" : '<div class="gl-tagwahl"><span id="gildeRTageL">' + esc(t("gilde.reihe.tage")) + '</span><div class="gl-tage" role="group" aria-labelledby="gildeRTageL">' +
    [1, 2, 3, 4, 5, 6, 0].map(d => '<button type="button" data-tag="' + d + '" data-f="tag:' + d + '" aria-pressed="' + e.tage.includes(d) + '" aria-label="' + esc(t("gilde.tag." + d)) + '"' + aus + ">" +
      esc(wtKurz(d)) + "</button>").join("") + "</div></div>";
  return '<section class="gl-edit" id="gildeReihe" aria-labelledby="gildeReiheT"><h3 id="gildeReiheT">' +
    esc(neu ? t("gilde.reihe.neuT") : e.ab ? t("gilde.reihe.abT", {titel: alt?.titel || e.titel}) : t("gilde.reihe.aendernT", {titel: alt?.titel || e.titel})) + "</h3>" +
    (fest ? '<p class="gl-note gebunden" id="gildeRGebunden">' + esc(t("gilde.reihe.gebunden")) + "</p>" : "") + '<form class="gl-rform" id="gildeRForm" novalidate>' +
    feld("gildeRTitel", t("gilde.reihe.titel"), '<input id="gildeRTitel" data-f="rtitel" maxlength="60" autocomplete="off" spellcheck="false" placeholder="' +
      esc(t("gilde.reihe.titelPh")) + '" value="' + esc(e.titel) + '">') +
    feld("gildeRStart", t("gilde.reihe.start"), '<input id="gildeRStart" type="datetime-local" data-f="rstart" min="' + min + 'T00:00" max="' + max + 'T23:59" value="' + esc(e.start) + '" aria-describedby="gildeRStartH' +
      (fest ? " gildeRGebunden" : "") + '"' + aus + ">" +
      '<p class="gl-note" id="gildeRStartH">' + esc(t("gilde.reihe.startHilfe")) + "</p>") +
    feld("gildeRDauer", t("gilde.reihe.dauer"), sel("gildeRDauer", "rdauer", dauern.map(d => [String(d), dauerText(d)]), String(e.dauerMin))) +
    feld("gildeRWdh", t("gilde.reihe.wdh"), sel("gildeRWdh", "rwdh", ARTEN.map(a => [a, t("gilde.reihe.wdh." + a)]), e.art, aus)) +
    feld("gildeRBis", t("gilde.reihe.bis"), '<input id="gildeRBis" type="date" data-f="rbis" min="' + min + '" max="' + max + '" value="' + esc(e.bis) + '"' + (e.art === "einmal" || fest ? " disabled" : "") + ">") +
    feld("gildeRErin", t("gilde.reihe.erinnerung"), sel("gildeRErin", "rerin",
      ERINNERUNGEN.map(z => [String(z), z ? t("gilde.reihe.vorher", {z: dauerText(z)}) : t("gilde.reihe.erinnerungAus")]), String(e.erinnerungMin))) +
    tage + '</form><p class="gl-fehler" id="gildeRFehler" role="alert">' + esc(reiheFehler) + "</p>" +
    '<div class="gl-eaus"><button type="submit" form="gildeRForm" class="btn sm hot" data-f="rok">' + esc(neu || e.ab ? t("gilde.reihe.anlegen") : t("gilde.reihe.uebernehmen")) + "</button>" +
    (fest ? knopf("btn sm", 'data-g="reiheNeuAb" data-f="rneuab"', t("gilde.reihe.abJetzt")) : "") +
    knopf("btn sm", 'data-g="reiheAb" data-f="rab"', t("gilde.abbrechen")) + (neu || e.ab ? "" : knopf("btn sm", 'data-g="reiheLoesen" data-f="rloesen"', t("gilde.reihe.loesen"))) + "</div></section>";
}
function termineHtml(): string {
  const g = gildeState.gilde!, jetzt = wandUhr(Date.now());
  const akt = aktiverTermin(g, jetzt), key = akt ? terminSchluessel(akt.tm) : "";
  const rechts = reiheFeld ? reiheFormHtml(reiheFeld) : akt ? anwesenheitHtml(g, akt.r, akt.tm)
    : g.reihen.some(r => !r.geloest) ? '<p class="gl-leer">' + esc(t("gilde.termin.waehlen")) + "</p>" : "";
  return '<div class="gl-termine"><div class="gl-tseite">' + agendaHtml(g, jetzt, key) + '</div><div class="gl-tseite" id="gildeTermin"' +
    (akt && !reiheFeld ? ' data-tk="' + key + '" aria-labelledby="gildeTerminT" role="region"' : "") + ">" + rechts + "</div></div>";
}
/** Eine Marke setzen; "offen" nur, wo schon eine stand. Nie wird ein Schluessel entfernt. */
function markeSetzen(key: string, mid: string, k: Marke): boolean {
  const g = gildeState.gilde!;
  let z = g.anwesend[key];
  if(!z){
    if(k === "offen") return false;
    if(Object.keys(g.anwesend).length >= MAX_TERMINE){ meldung = t("gilde.termin.max"); ansage(meldung); return false; }
    z = g.anwesend[key] = {};
  }
  if(z[mid] === k || (z[mid] === undefined && k === "offen")) return false;
  z[mid] = k;
  return true;
}
/** Eine Ausnahme des gewaehlten Termins aendern (ausfallen, zuruecknehmen, verschieben); der Schluessel bleibt. */
function ausnahme(tk: string, wert: { aus?: boolean; zeit?: string }): boolean {
  const i = tk.indexOf("|"), r = reiheVon(tk.slice(0, i)), d = tk.slice(i + 1);
  if(!r) return false;
  const a = r.ausnahmen[d];
  if(!a && Object.keys(r.ausnahmen).length >= MAX_AUSNAHMEN) return false;
  r.ausnahmen[d] = {...a, ...wert};
  return true;
}
function reiheAnlegen(){
  const g = gildeState.gilde, e = reiheFeld;
  if(!g || !e || lage !== "da") return;
  const titel = rein(e.titel, 60);
  if(!titel){ reiheFehler = t("gilde.reihe.fehler.titel"); fokus = "rtitel"; return; }
  // eine Reihe mit Haken oder Ausnahmen: an Ort und Stelle nur Titel, Dauer und Erinnerung
  if(e.id && e.gebunden && !e.ab){
    const r = reiheVon(e.id);
    if(!r) return;
    r.titel = titel; r.dauerMin = e.dauerMin; r.erinnerungMin = e.erinnerungMin;
    fokus = "ra:" + r.id; reiheFeld = null; reiheFehler = "";
    speichern();
    return;
  }
  const [min, max] = spanne(), tag = e.start.slice(0, 10), mitBis = e.art !== "einmal" && !!e.bis;
  const alt = e.id && e.ab ? reiheVon(e.id) : undefined;
  const grenze = alt ? [alt.start.slice(0, 10), letzterGebunden(g, alt)].sort().pop()! : "";
  reiheFehler = !START_RX.test(e.start) ? t("gilde.reihe.fehler.start")
    : tag < min || tag > max || (mitBis && (e.bis < min || e.bis > max)) ? t("gilde.reihe.fehler.spanne", {von: datumLang(min), bis: datumLang(max)})
    : alt && tag <= grenze ? t("gilde.reihe.fehler.ab", {datum: datumLang(grenze)})
    : e.art === "tage" && !e.tage.length ? t("gilde.reihe.fehler.tage") : mitBis && e.bis < tag ? t("gilde.reihe.fehler.bis")
    : !e.id || e.ab ? (g.reihen.length >= MAX_REIHEN ? t("gilde.reihe.max") : "") : "";
  if(reiheFehler){
    fokus = !START_RX.test(e.start) || tag < min || tag > max || (alt && tag <= grenze) ? "rstart" : e.art === "tage" && !e.tage.length ? "tag:1" : mitBis ? "rbis" : "rok";
    return;
  }
  const wdh: Wdh = {art: e.art, tage: e.art === "tage" ? [...e.tage].sort((a, b) => a - b) : [], ...(mitBis ? {bis: e.bis} : {})};
  if(alt){
    // Ab jetzt anders: die alte Reihe endet am Tag vor dem neuen Beginn, ihre Haken bleiben und zaehlen weiter
    const ende = tagPlus(tag, -1);
    alt.wdh = {...alt.wdh, bis: alt.wdh.bis && alt.wdh.bis < ende ? alt.wdh.bis : ende};
    const r: Reihe = {id: neueId("r"), titel, start: e.start, zone: zone(), wdh, dauerMin: e.dauerMin, erinnerungMin: e.erinnerungMin, ausnahmen: {}};
    g.reihen.push(r);
    reihenOffen.set(r.id, true);
    termin = null;
    fokus = "ra:" + r.id;
  }
  else if(!e.id){
    if(g.reihen.length >= MAX_REIHEN) return;
    const r: Reihe = {id: neueId("r"), titel, start: e.start, zone: zone(), wdh, dauerMin: e.dauerMin, erinnerungMin: e.erinnerungMin, ausnahmen: {}};
    g.reihen.push(r);
    reihenOffen.set(r.id, true);
    termin = null;
    fokus = "ra:" + r.id;
  }
  else {
    const r = reiheVon(e.id);
    if(!r) return;
    r.titel = titel; r.start = e.start; r.wdh = wdh; r.dauerMin = e.dauerMin; r.erinnerungMin = e.erinnerungMin;
    fokus = "ra:" + r.id;
  }
  reiheFeld = null; reiheFehler = "";
  speichern();
}
function reiheLoesen(id: string){
  const r = reiheVon(id);
  if(!r) return;
  r.geloest = true;
  reiheUndo = id; reiheFeld = null; reiheFehler = ""; verschieben = false;
  if(termin && termin.startsWith(id + "|")) termin = null;
  fokus = "rundo";
  ansage(t("gilde.reihe.geloest", {titel: r.titel}));
  speichern();
}
function reiheZurueck(){
  const r = gildeState.gilde?.reihen.find(x => x.id === reiheUndo);
  reiheUndo = null;
  if(!r) return;
  delete r.geloest;
  fokus = "ra:" + r.id;
  ansage(t("gilde.reihe.wieder", {titel: r.titel}));
  speichern();
}
/* Die Handlungen im Reiter Termine; true, wenn der Klick hierher gehoerte. */
function termineKlick(b: HTMLButtonElement, a: string | undefined): boolean {
  const g = gildeState.gilde!;
  if(a === "anwF"){ anwFilter = (ANW_FILTER as string[]).includes(b.dataset.af || "") ? b.dataset.af as AnwFilter : "alle"; fokus = "af:" + anwFilter; return true; }
  const tk = b.closest<HTMLElement>("[data-tk]")?.dataset.tk || "";
  const mid = b.closest<HTMLElement>(".gl-marken")?.dataset.mId;
  if(b.dataset.marke && mid && tk){
    const k = b.dataset.marke as Gesetzt, jetzt = g.anwesend[tk]?.[mid] ?? "offen";
    if(markeSetzen(tk, mid, jetzt === k ? "offen" : k)) speichern();
    termin = tk;   // der gezeigte Termin bleibt stehen, auch wenn der Minutentakt neu zeichnet
    fokus = "a:" + mid + ":" + k;
  }
  else if(b.dataset.tag !== undefined && reiheFeld){
    const d = +b.dataset.tag;
    reiheFeld.tage = reiheFeld.tage.includes(d) ? reiheFeld.tage.filter(x => x !== d) : [...reiheFeld.tage, d];
    fokus = "tag:" + d;
  }
  else if(a === "termin"){ termin = b.dataset.termin || null; verschieben = false; reiheFeld = null; fokus = "t:" + termin; if(termin) reihenOffen.set(termin.slice(0, termin.indexOf("|")), true); }
  else if(a === "reiheZu" && b.dataset.rId){ reihenOffen.set(b.dataset.rId, !reihenOffen.get(b.dataset.rId)); fokus = "rk:" + b.dataset.rId; }
  else if((a === "zMinus" || a === "zPlus" || a === "alleN") && tk){
    const re = reiheVon(tk.slice(0, tk.indexOf("|"))), art = re ? zaehlerArt(g, re) : null;
    if(!art) return true;
    const datum = tk.slice(tk.indexOf("|") + 1);
    let n = 0;
    if(a === "alleN"){ for(const m of gelistet(datum)) if(!(m.id in (g.zaehler?.[tk] || {})) && zaehlerSetzen(tk, m.id, art.proPunkt, art.proPunkt)) n++; fokus = "alleN"; }
    else {
      const mid = b.dataset.zId || "", cur = g.zaehler?.[tk]?.[mid];
      if(zaehlerSetzen(tk, mid, a === "zPlus" ? (cur ?? 0) + 1 : (cur ?? 1) - 1, art.proPunkt)) n++;
      fokus = (a === "zPlus" ? "zp:" : "zm:") + mid;
    }
    if(n) speichern();
    termin = tk;
  }
  else if(a === "dOeffnen" && b.dataset.key){
    // ein Termin an einem getippten Tag: die Liste des Events holt ihn herein (bis zu zehn Jahre zurueck), er wird gewaehlt
    const key = b.dataset.key, rid = key.slice(0, key.indexOf("|")), tag = key.slice(key.indexOf("|") + 1), heute = wandUhr(Date.now()).slice(0, 10);
    const wk = Math.ceil((wandMs(heute) - wandMs(tag)) / 604800000) + 1;
    if(wk > (wochen[rid] || 12)) wochen[rid] = Math.min(wk, 522);
    datumSuche = ""; reihenOffen.set(rid, true); termin = key; verschieben = false; reiheFeld = null; fokus = "t:" + key;
  }
  else if(a === "dNull"){ datumSuche = ""; fokus = "dsuche"; }
  else if(a === "reiheNeu"){
    if(g.reihen.length >= MAX_REIHEN) return true;
    reiheFeld = {id: null, titel: "", start: wandUhr(Date.now()).slice(0, 10) + "T20:00", dauerMin: 120, art: "woche", tage: [], bis: "", erinnerungMin: 15, gebunden: false, ab: false};
    reiheFehler = ""; verschieben = false; fokus = "rtitel";
  }
  else if(a === "reiheAendern"){
    const r = reiheVon(b.dataset.rId);
    if(!r) return true;
    reiheFeld = {id: r.id, titel: r.titel, start: r.start, dauerMin: r.dauerMin, art: r.wdh.art, tage: [...r.wdh.tage], bis: r.wdh.bis || "", erinnerungMin: r.erinnerungMin,
      gebunden: !!letzterGebunden(g, r), ab: false};
    reiheFehler = ""; verschieben = false; fokus = "rtitel";
  }
  else if(a === "reiheAb") reiheSchliessen();
  else if(a === "reiheNeuAb" && reiheFeld?.id){
    const r = reiheVon(reiheFeld.id);
    if(!r) return true;
    // vorbelegt: der Tag nach dem letzten Termin mit Haken, fruehestens heute, zur alten Uhrzeit
    const nach = tagPlus([r.start.slice(0, 10), letzterGebunden(g, r)].sort().pop()!, 1), heute = wandUhr(Date.now()).slice(0, 10);
    reiheFeld.ab = true; reiheFeld.bis = ""; reiheFeld.start = (nach > heute ? nach : heute) + "T" + r.start.slice(11, 16);
    reiheFehler = ""; fokus = "rstart";
  }
  else if(a === "reiheLoesen" && reiheFeld?.id) reiheLoesen(reiheFeld.id);
  else if(a === "reiheUndo") reiheZurueck();
  else if(a === "aelter" && b.dataset.rId){ wochen[b.dataset.rId] = (wochen[b.dataset.rId] || 12) + 12; fokus = "alt:" + b.dataset.rId; }
  else if(a === "alleDa" && tk){
    let n = 0;
    // nur offene (auch die, die der Filter ausblendet); "nicht da" bleibt (auch eine alte "entschuldigt"), geloeste nie
    const z = g.anwesend[tk] || {};
    for(const m of gelistet(tk.slice(tk.indexOf("|") + 1))) if((z[m.id] ?? "offen") === "offen" && markeSetzen(tk, m.id, "da")) n++;
    if(n) speichern();
    termin = tk;
    fokus = "alleDa";
  }
  else if(a === "ausfall" && tk){ if(ausnahme(tk, {aus: true})) speichern(); verschieben = false; fokus = "zurueck"; }
  else if(a === "zurueck" && tk){ if(ausnahme(tk, {aus: false})) speichern(); fokus = "ausfall"; }
  else if(a === "verschieben"){ verschieben = !verschieben; fokus = verschieben ? "vzeit" : "verschieben"; }
  else if(a === "vAb"){ verschieben = false; fokus = "verschieben"; }
  else return false;
  return true;
}
function reiheSchliessen(){
  fokus = reiheFeld?.id ? "ra:" + reiheFeld.id : "rneu";
  reiheFeld = null; reiheFehler = "";
}

/* ---------- Auswertung ---------- */
type Sortierung = "liste" | "name" | "quote" | "rolle";
const SORTIERUNGEN: Sortierung[] = ["liste", "name", "quote", "rolle"];
/** Reihe ("" = alle) und Reihenfolge: nur in der Sitzung. */
const auswahl: { reihe: string; sort: Sortierung } = { reihe: "", sort: "liste" };
/** Der Satz nach einer Ausgabe ("Kopiert.") in #gildeStatus, bis zum naechsten Eingriff. */
let ausgabeSatz = "";
interface Auswertung { zeilen: { m: Mitglied; z: Zeile }[]; gezaehlt: boolean; reihe: Reihe | undefined }

/** Das kurze Datum in der Sprache der Seite: 25.10. oder 10/25. */
const datumSprache = (d: string) => state.lang === "de" ? datumKurz(d) : d.slice(5, 7) + "/" + d.slice(8, 10);
/** Die Reihen der Kalenderdatei: die gewaehlte, sonst alle nicht geloesten (Entscheidung 07.10.2026: eine Datei mit allen). */
function icsReihen(): Reihe[] {
  const g = gildeState.gilde, r = reiheVon(auswahl.reihe);
  return r ? [r] : g ? g.reihen.filter(x => !x.geloest) : [];
}
/** Die Zeilen der Karten, des Texts und des Bilds: gefiltert (filtern) und sortiert. gezaehlt: hat irgendwer einen Termin, der zaehlt? */
function auswertung(): Auswertung {
  const g = gildeState.gilde!;
  const reihe = reiheVon(auswahl.reihe);
  if(!reihe) auswahl.reihe = "";
  const zs = auswerten(g, reihe ? [reihe.id] : null, wandUhr(Date.now()));
  const nach = new Map(zs.map(z => [z.mitgliedId, z]));
  const zeilen = filtern(aktive(), filter).flatMap(m => { const z = nach.get(m.id); return z ? [{m, z}] : []; });
  const ROLLEN_NR: Rolle[] = [...ROLLEN, ""];
  // sort ist stabil: bei Gleichstand bleibt die Reihenfolge der Liste
  if(auswahl.sort === "name") zeilen.sort((a, b) => a.m.name.localeCompare(b.m.name, state.lang, {sensitivity: "base"}));
  else if(auswahl.sort === "quote") zeilen.sort((a, b) => (b.z.quote ?? -1) - (a.z.quote ?? -1));
  else if(auswahl.sort === "rolle") zeilen.sort((a, b) => ROLLEN_NR.indexOf(rolleVon(a.m)) - ROLLEN_NR.indexOf(rolleVon(b.m)));
  return {zeilen, gezaehlt: zs.some(z => z.da + z.fehlt > 0), reihe};
}
/** Der Ring der Quote: fuer alle dieselbe Farbe (wie die Weeklies); ohne Quote nur die Bahn. */
function quoteRing(q: number | null): string {
  const px = 44, sw = 4, r = (px - sw) / 2, c = px / 2, a = q === null ? 0 : Math.round(q * 1000) / 10;
  return '<svg class="wkring" width="' + px + '" height="' + px + '" viewBox="0 0 ' + px + " " + px + '" aria-hidden="true">' +
    '<circle class="rb" cx="' + c + '" cy="' + c + '" r="' + r + '" stroke-width="' + sw + '"/>' +
    (a > 0 ? '<circle class="rf" cx="' + c + '" cy="' + c + '" r="' + r + '" stroke-width="' + sw + '" pathLength="100" stroke-dasharray="' + a + ' 100"/>' : "") + "</svg>";
}
/* Eine Karte: fuer den Vorleser ein Satz, das Bild daneben still. */
function karte(m: Mitglied, z: Zeile): string {
  const q = z.quote === null ? null : Math.round(z.quote * 100);
  const satz = q === null ? t("gilde.ausw.zeileOffen", {name: m.name})
    : t("gilde.ausw.zeile", {name: m.name, q, d: z.letzte ? datumSprache(z.letzte) : t("gilde.ausw.nie")});
  const zahl = (k: string, v: string) => "<div><dt>" + esc(t("gilde.ausw." + k)) + "</dt><dd>" + esc(v) + "</dd></div>";
  return '<li class="gl-karte" data-m-id="' + m.id + '"><span class="vh">' + esc(satz) + '</span><div aria-hidden="true">' +
    '<span class="gl-ring">' + quoteRing(z.quote) + "<b>" + (q === null ? "\u2013" : q + "<small>\u00a0%</small>") + "</b></span>" +
    '<span class="gl-kopf">' + paar(m.waffen) + '<span class="gl-txt"><span class="gl-name">' + esc(m.name) + "</span>" + klasseZeile(m) + "</span></span>" +
    '<dl class="gl-zahlen">' + zahl("dabei", z.da + z.fehlt ? z.da + "/" + (z.da + z.fehlt) : "\u2013") +
      zahl("zuletzt", z.letzte ? datumSprache(z.letzte) : "\u2013") + "</dl></div></li>";
}
function auswertungHtml(): string {
  const g = gildeState.gilde!, a = auswertung(), reihen = g.reihen.filter(r => !r.geloest);
  const opt = (v: string, l: string, an: boolean) => '<option value="' + esc(v) + '"' + (an ? " selected" : "") + ">" + esc(l) + "</option>";
  const leer = !aktive().length ? t("gilde.mitglied.leer") : !a.gezaehlt ? t("gilde.ausw.keine") : !a.zeilen.length ? t("gilde.keinTreffer") : "";
  const aus = leer ? ' disabled aria-describedby="gildeALeer"' : "";
  const icsKnopf = !reihen.length ? "" : '<button type="button" class="btn sm" data-g="ics" data-f="aics">' + esc(t("gilde.ausgabe.ics")) + "</button>";
  const wahl = '<div class="gl-wahl">' +
    '<div class="field"><label for="gildeAReihe">' + esc(t("gilde.ausw.reihe")) + '</label><select id="gildeAReihe" data-f="areihe">' +
      opt("", t("gilde.ausw.alle"), !a.reihe) + reihen.map(r => opt(r.id, r.titel, r === a.reihe)).join("") + "</select></div>" +
    '<div class="field"><label for="gildeASort">' + esc(t("gilde.ausw.sortierung")) + '</label><select id="gildeASort" data-f="asort">' +
      SORTIERUNGEN.map(k => opt(k, t("gilde.ausw.sortierung." + k), k === auswahl.sort)).join("") + "</select></div>" +
    '<div class="gl-ausgabe">' + '<button type="button" class="btn sm" data-g="text" data-f="atext"' + aus + ">" + esc(t("gilde.ausgabe.text")) + "</button>" +
      '<button type="button" class="btn sm" data-g="bild" data-f="abild"' + aus + ">" + esc(t("gilde.ausgabe.bild")) + "</button>" + icsKnopf + "</div></div>";
  if(leer) return wahl + '<p class="gl-leer" id="gildeALeer">' + esc(leer) + "</p>";
  return wahl + '<div class="gl-ausw"><div class="gl-aliste"><ul class="gl-karten" aria-label="' + esc(t("gilde.ausw.liste")) + '">' +
    a.zeilen.map(x => karte(x.m, x.z)).join("") + '</ul><p class="gl-fuss">' + esc(t("gilde.ausw.fuss")) + "</p></div>" +
    '<section class="gl-bild" aria-labelledby="gildeBildT"><h3 id="gildeBildT">' + esc(t("gilde.ausw.bildT")) + '</h3><div id="gildeBildVorschau"></div></section></div>';
}

/* ---------- Das Bild: eine Leinwand wie in 50-bild.ts (Farben des Themas, doppelte Dichte) ---------- */
const BILD_W = 480, BILD_DPR = 2, BRAND = 20, BZEILE = 24;
/** Die rechten Kanten der Zahlenspalten im Bild. */
const BSPALTEN: [string, number][] = [["quote", 290], ["dabei", 366], ["zuletzt", BILD_W - BRAND]];
/** Eine Flaeche aus einem Token: eine Farbe oder ein Verlauf wie --lift-1 im dunklen Thema (von oben nach unten). */
function flaeche(ctx: CanvasRenderingContext2D, token: string, h: number): string | CanvasGradient {
  const v = cssv(token);
  if(!/^linear-gradient\(/.test(v)) return v || "#000";
  const farben = v.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || ["#000"];
  const g = ctx.createLinearGradient(0, 0, 0, h);
  farben.forEach((c, i) => g.addColorStop(farben.length > 1 ? i / (farben.length - 1) : 0, c));
  return g;
}
function kuerzen(ctx: CanvasRenderingContext2D, text: string, breite: number): string {
  if(ctx.measureText(text).width <= breite) return text;
  let s = text;
  while(s.length > 1 && ctx.measureText(s + "\u2026").width > breite) s = s.slice(0, -1);
  return s + "\u2026";
}
async function schriften(){
  const f = document.fonts;
  if(!f) return;
  try{ await Promise.all([f.load("400 18px " + cssv("--display")), f.load("400 13px " + cssv("--sans")), f.load("400 13px " + cssv("--serif"))]); }
  catch(err){ /* eine Schrift fehlt: die Leinwand nimmt die naechste der Kette */ }
}
/* Die Waffenbilder liegen als Daten in der Seite (WEAPON_ICON); dekodiert wird ohne Netz, je Waffe und Fassung einmal. */
const ikonen = new Map<string, Promise<ImageBitmap | null>>();
function ikone(w: string, hell: boolean): Promise<ImageBitmap | null> {
  const b = WEAPON_ICON[w], k = w + (hell ? "|h" : "|d");
  if(!b || typeof createImageBitmap !== "function") return Promise.resolve(null);
  let p = ikonen.get(k);
  if(!p){
    const roh = atob(hell ? b.h : b.d), bytes = new Uint8Array(roh.length);
    for(let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
    p = createImageBitmap(new Blob([bytes], {type: "image/webp"})).catch(() => null);
    ikonen.set(k, p);
  }
  return p;
}
/** Eine runde Marke: Platte, Bild, Ring; ohne Bild eine leere Platte. */
function waffeMalen(ctx: CanvasRenderingContext2D, bm: ImageBitmap | null, x: number, y: number, r: number){
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  const platte = cssv("--wic-plate");
  ctx.fillStyle = bm && platte && platte !== "transparent" ? platte : cssv("--well") || "#000";
  ctx.fill();
  if(bm){ ctx.clip(); ctx.drawImage(bm, x - r, y - r, 2 * r, 2 * r); }
  ctx.restore();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = 1; ctx.strokeStyle = cssv(bm ? "--icon-ring" : "--hair-rule-strong") || "#888"; ctx.stroke();
}
/** Reihe ("Alle Reihen") und bei aktivem Filter "N von M Mitgliedern" - im Bild und im Text dieselben. */
const reiheWort = (a: Auswertung) => a.reihe ? a.reihe.titel : t("gilde.ausw.alle");
const trefferWort = (a: Auswertung) => filterAktiv() ? t("gilde.treffer", {n: a.zeilen.length, m: aktive().length}) : "";
function bildUnter(a: Auswertung): string {
  const heute = wandUhr(Date.now()).slice(0, 10);
  return [reiheWort(a), trefferWort(a), t("gilde.ausw.stand", {datum: datumSprache(heute) + (state.lang === "de" ? "" : "/") + heute.slice(0, 4)})]
    .filter(Boolean).join(" \u00b7 ");
}
async function bildMalen(a: Auswertung): Promise<HTMLCanvasElement> {
  await schriften();
  const g = gildeState.gilde!, hell = document.documentElement.dataset.theme === "light";
  const bilder = new Map<string, ImageBitmap | null>();
  for(const x of a.zeilen) for(const w of x.m.waffen) if(!bilder.has(w)) bilder.set(w, await ikone(w, hell));
  const sans = cssv("--sans"), serif = cssv("--serif"), display = cssv("--display");
  const unter = bildUnter(a);
  const kopfH = BRAND + 18 + 20 + 28 + 10, h = kopfH + a.zeilen.length * BZEILE + 14;
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d")!;   // eine frische Leinwand hat immer einen 2d-Kontext
  cv.width = BILD_W * BILD_DPR;
  cv.height = Math.round(h * BILD_DPR);
  ctx.scale(BILD_DPR, BILD_DPR);
  ctx.fillStyle = flaeche(ctx, "--lift-1", h);
  ctx.fillRect(0, 0, BILD_W, h);
  ctx.fillStyle = cssv("--gold-ink");
  ctx.fillRect(0, 0, BILD_W, 2);
  let y = BRAND + 18;
  ctx.textAlign = "left";
  ctx.font = "400 18px " + display;
  ctx.fillStyle = cssv("--text");
  ctx.fillText(kuerzen(ctx, g.name + " \u00b7 " + t("gilde.ausgabe.bildKopf"), BILD_W - 2 * BRAND), BRAND, y);
  y += 20;
  ctx.font = "400 12px " + sans;
  ctx.fillStyle = cssv("--dim");
  ctx.fillText(kuerzen(ctx, unter, BILD_W - 2 * BRAND), BRAND, y);
  y += 28;
  ctx.textAlign = "right";
  ctx.font = "500 11px " + sans;
  for(const [k, rechts] of BSPALTEN) ctx.fillText(t("gilde.ausw." + k).toLocaleUpperCase(state.lang), rechts, y);
  y += 6;
  ctx.fillStyle = cssv("--hair-rule-strong");
  ctx.fillRect(BRAND, y, BILD_W - 2 * BRAND, 1);
  y = kopfH;
  for(const {m, z} of a.zeilen){
    const mitte = y + BZEILE / 2;
    for(const i of [0, 1]) waffeMalen(ctx, m.waffen.length === 2 ? bilder.get(m.waffen[i]!) ?? null : null, BRAND + 11 + i * 15, mitte, 10.5);
    ctx.textAlign = "left";
    ctx.font = "400 13.5px " + serif;
    ctx.fillStyle = cssv("--text");
    ctx.fillText(kuerzen(ctx, m.name, 222 - 64), 64, mitte + 4.5);
    ctx.textAlign = "right";
    ctx.font = "400 12.5px " + sans;
    const q = z.quote === null ? "\u2013" : Math.round(z.quote * 100) + "\u00a0%";
    const werte = [q, z.da + z.fehlt ? z.da + "/" + (z.da + z.fehlt) : "\u2013", z.letzte ? datumSprache(z.letzte) : "\u2013"];
    BSPALTEN.forEach(([, rechts], i) => ctx.fillText(werte[i]!, rechts, mitte + 4.5));
    y += BZEILE;
  }
  return cv;
}
/* Die Vorschau rechts: neu gemalt wird nur, wenn sich ihr Inhalt aendert - die Zeilen (nach Filter, Reihenfolge und
   Reihe), das Thema, die Sprache oder der Tag; sonst kommt dieselbe Leinwand wieder an ihren Platz. Verlaesst man den
   Reiter oder den Bereich, wird sie losgelassen. */
let bildLauf = 0, letzteVorschau: HTMLCanvasElement | null = null, vorschauSchluessel = "";
function bildSchluessel(a: Auswertung): string {
  const r = document.documentElement;
  return JSON.stringify([r.getAttribute("data-theme"), r.className, state.lang, wandUhr(Date.now()).slice(0, 10), gildeState.gilde?.name,
    bildUnter(a), a.zeilen.map(({m, z}) => [m.id, m.name, m.waffen, z.quote, z.da, z.fehlt, z.letzte])]);
}
function vorschauLoesen(){
  bildLauf++;
  letzteVorschau = null;
  vorschauSchluessel = "";
}
async function vorschau(){
  const box = document.getElementById("gildeBildVorschau");
  if(!box) return;
  const a = auswertung(), schluessel = bildSchluessel(a);
  if(letzteVorschau) box.replaceChildren(letzteVorschau);
  if(letzteVorschau && schluessel === vorschauSchluessel) return;
  const nr = ++bildLauf;
  const cv = await bildMalen(a);
  if(nr !== bildLauf) return;
  cv.setAttribute("role", "img");
  cv.setAttribute("aria-label", t("gilde.ausw.bildAlt", {n: a.zeilen.length}));
  letzteVorschau = cv;
  vorschauSchluessel = schluessel;
  document.getElementById("gildeBildVorschau")?.replaceChildren(cv);
}
/** Eine Datei zum Speichern anbieten: Blob und <a download>, kein Endpunkt. */
function datei(b: Blob, name: string){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function ausgabeMelden(text: string){
  ausgabeSatz = text;
  statusSetzen();
}
/** Der Dateiname aus dem Titel: nur a-z, 0-9 und Bindestrich. */
function dateiName(titel: string): string {
  const s = titel.toLowerCase().replace(/\u00df/g, "ss").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  return s || t("gilde.ics.name");
}
async function textKopieren(){
  const a = auswertung();
  if(!a.zeilen.length) return;
  const text = textAusgabe(a.zeilen.map(x => x.z), gildeState.gilde!, {kopf: t("gilde.ausgabe.bildKopf"), reihe: reiheWort(a),
    treffer: trefferWort(a), zuletzt: t("gilde.ausw.text.zuletzt"),
    offen: "\u2013", datum: datumSprache});
  try{
    if(!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") throw new Error("ohne Zwischenablage");
    await navigator.clipboard.writeText(text);
    ausgabeMelden(t("gilde.ausgabe.kopiert"));
  }catch(err){ ausgabeMelden(t("gilde.ausgabe.nichtKopiert")); }
}
/* Das Bild: in die Zwischenablage; geht das nicht (der Browser hat keine fuer Bilder), als Datei zum Speichern. */
async function bildKopieren(){
  const a = auswertung();
  if(!a.zeilen.length) return;
  const blob = bildMalen(a).then(cv => new Promise<Blob>((ja, nein) => cv.toBlob(b => b ? ja(b) : nein(new Error("kein Bild")), "image/png")));
  const cb = navigator.clipboard;
  if(cb && typeof cb.write === "function" && typeof ClipboardItem !== "undefined"){
    try{
      // das Versprechen geht gleich mit: der Klick gilt noch, wenn das Bild fertig ist
      await cb.write([new ClipboardItem({"image/png": blob})]);
      ausgabeMelden(t("gilde.ausgabe.kopiert"));
      return;
    }catch(err){ /* weiter mit der Datei */ }
  }
  try{
    datei(await blob, "gilde-auswertung.png");
    ausgabeMelden(t("gilde.ausgabe.gespeichert"));
  }catch(err){ ausgabeMelden(t("gilde.ausgabe.nichtKopiert")); }
}
function icsSpeichern(){
  const rs = icsReihen(), g = gildeState.gilde;
  if(!rs.length || !g) return;
  // eine Reihe: ihre Datei, benannt nach ihrem Titel; mehrere: eine Datei mit allen, benannt nach der Gilde
  const name = dateiName(rs.length === 1 ? rs[0]!.titel : g.name) + ".ics";
  const text = rs.length === 1 ? ics(g, rs[0]!.id, Date.now()) : icsAlle(g, rs.map(r => r.id), Date.now());
  datei(new Blob([text], {type: "text/calendar"}), name);
  ausgabeMelden(t("gilde.ausgabe.icsFertig", {datei: name}));
}

/* ---------- Zeichnen ---------- */
/* ---------- Punkte (Spezifikation 2026-10-11-gilde-punkte-design.md, 4; Entwurf docs/entwurf/gilde-punkte/) ----------
   Ein vierter Reiter, ab Werk aus: ein Schalter, ein Satz. Eingeschaltet links die Liste nach Summe (Aktive; bei "Alle" die
   Inaktiven getrennt in einem aufklappbaren Block), rechts das Konto des gewaehlten Mitglieds mit grosser Summe, einem Satz
   zur groessten Quelle und dem Balken. Gerechnet wird im Kern (gilde-punkte-core.ts); die Seite zeichnet nur. Rang und Gruppe
   stehen als Wort, nie als Farbe, und nur, wenn der Lead sie zugeschaltet hat. */
const punktZahl = (n: number) => { const z = String(Math.round(n * 100) / 100); return state.lang === "de" ? z.replace(".", ",") : z; };
const punkteAn = () => !!gildeState.gilde?.punkte?.an;
const TEILE: [keyof Konto["teile"], string][] = [["monate", "m"], ["termine", "r"], ["ansehen", "a"], ["zusatz", "z"]];
function pSchalter(id: string, an: boolean, a: string, f: string, text: string, satz: string): string {
  return '<div class="gl-p-schalter"><button type="button" class="esw" role="switch" id="' + id + '" aria-checked="' + an + '" aria-labelledby="' + id + 'N" data-g="' + a + '" data-f="' + f +
    '"><span class="esw-t" aria-hidden="true"></span><span class="esw-w" aria-hidden="true">' + esc(t(an ? "gilde.punkte.an" : "gilde.punkte.aus")) + '</span></button>' +
    '<span class="gl-p-sn" id="' + id + 'N">' + esc(text) + (satz ? "<small>" + esc(satz) + "</small>" : "") + "</span></div>";
}
function pBalken(k: Konto, max: number, mini: boolean): string {
  const w = (v: number) => max > 0 ? Math.max(0, v / max * 100) : 0;
  return '<span class="gl-p-balken' + (mini ? " gl-p-mini" : "") + '" aria-hidden="true">' +
    TEILE.map(([key, c]) => '<i class="gl-p-' + c + '" style="width:' + w(k.teile[key]).toFixed(2) + '%"></i>').join("") + "</span>";
}
function pSatzFuer(k: Konto): string {
  return t("gilde.punkte.vorlesen", {name: k.m.name, n: punktZahl(k.summe)}) + (k.pausiert ? ", " + t("gilde.punkte.v.inaktiv") : "");
}
const PAUSE_SYM = ic('<path d="M9 5v14M15 5v14"/>');
function pSeit(k: Konto): string {
  const p = k.m.punkte?.pausen.find(q => q.bis === undefined);
  return p ? datumKurz(p.von) : "";
}
function pZeile(k: Konto, x: Konto, max: number): string {
  const an = k.m.id === x.m.id;
  return '<li><button type="button" role="option" class="gl-p-co' + (k.pausiert ? " pz" : "") + '" style="--anteil:' + (max > 0 ? Math.max(0, Math.min(100, k.summe / max * 100)).toFixed(1) : "0") + '%" aria-selected="' + an + '" tabindex="' + (an ? 0 : -1) + '" data-g="pWahl" data-p-id="' + k.m.id + '" data-f="p:' + k.m.id +
    '" aria-label="' + esc(pSatzFuer(k)) + '">' + '<span class="gl-p-nm"><span class="gl-name">' + esc(k.m.name) + '</span><span class="gl-p-sub">' +
    (k.pausiert ? '<span class="gl-p-pause" aria-hidden="true">' + PAUSE_SYM + esc(t("gilde.punkte.inaktivSeit", {datum: pSeit(k)})) + "</span>" : "") + "</span>" + pBalken(k, max, true) + '</span><b class="gl-p-sm">' + punktZahl(k.summe) + "</b></button></li>";
}
/** Eine kleine Eingabe mit Beschriftung im Konto. */
const pFeld = (id: string, label: string, wert: string | number, typ: "date" | "number" | "text", f: string, extra = "") =>
  '<label class="gl-p-fk"><span>' + esc(label) + '</span><input id="' + id + '" type="' + typ + '" data-f="' + f + '" value="' + esc(String(wert)) + '"' +
  (typ === "number" ? ' inputmode="decimal" min="0"' + (extra.includes("step=") ? "" : ' step="any"') : typ === "text" ? ' maxlength="60" autocomplete="off"' : "") + extra + "></label>";
const kurzZahl = (n: number) => n >= 1000 ? (Math.round(n / 100) / 10) + "k" : String(n);
/** Ein Tag, den es gibt ("YYYY-MM-DD"; der 30. Februar nicht). */
const tagOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))).toISOString().slice(0, 10) === s;
const heuteTag = () => wandUhr(Date.now()).slice(0, 10);
/** Der letzte Sonntag bis heute (Standarddatum fuer das Gildenansehen). */
const letzterSonntag = () => { const h = heuteTag(); return tagPlus(h, -wochentag(h)); };
/** Ein kleines Etikett mit "x" zum Loesen (nichts wird entfernt). */
const pChip = (text: string, a: string, i: number, label: string) => '<li class="gl-p-chip"><span>' + text + '</span><button type="button" class="gl-p-lo" data-g="' + a + '" data-i="' + i + '" data-f="' + a + ":" + i +
  '" aria-label="' + esc(label) + '" title="' + esc(t("gilde.punkte.loesen")) + '">\u00d7</button></li>';
/** Das Konto: eine Zeile je Quelle mit der Rechnung darunter, den Eingaben in der Mitte und den Punkten rechts. */
function pKonto(k: Konto): string {
  const r = gildeState.gilde!.punkte!, nb = "\u00a0", m = k.m, p = m.punkte;
  const zeile = (name: string, rechnung: string, pt: number, innen: string) => '<div class="gl-p-kz"><div class="gl-p-kn"><b>' + esc(name) + "</b>" + (rechnung ? "<small>" + esc(rechnung) + "</small>" : "") +
    '</div><div class="gl-p-kd">' + innen + '</div><div class="gl-p-kp"><b>' + punktZahl(pt) + '</b><span class="gl-p-ke">' + esc(t("gilde.punkte.pkt")) + "</span></div></div>";
  const arten = r.arten.filter(a => !a.geloest).map(a => {
    const start = p?.start[a.id] ?? 0, live = Math.round(((k.zaehl[a.id] ?? 0) - start) * 100) / 100;
    return zeile(a.name, (a.proPunkt > 1 ? punktZahl(k.zaehl[a.id] ?? 0) + nb + "\u00f7" + nb + a.proPunkt : punktZahl(k.zaehl[a.id] ?? 0)) + (a.punkte !== 1 ? nb + "\u00d7" + nb + punktZahl(a.punkte) : ""), k.pkt[a.id] ?? 0,
      pFeld("gildePStart-" + a.id, t("gilde.punkte.start"), start, "number", "pstart:" + a.id, ' aria-label="' + esc(t("gilde.punkte.startAria", {art: a.name})) + '"') +
      '<span class="gl-p-plus">' + esc(t("gilde.punkte.inBoro", {n: punktZahl(live)})) + "</span>");
  }).join("");
  const ae = (p?.ansehen.eintraege ?? []).map((e, i) => ({e, i})).filter(x => !x.e.geloest), letzte = ae.slice(-4);
  const ansehen = zeile(t("gilde.punkte.zeile.ansehen"), "", k.ansehen,
    pFeld("gildePAnsStart", t("gilde.punkte.start"), p?.ansehen.start ?? 0, "number", "pansstart", ' step="1000"') +
    (letzte.length ? '<ul class="gl-p-chips">' + letzte.map(({e, i}) => pChip(esc(datumKurz(e.datum)) + " <b>+" + kurzZahl(e.betrag) + "</b>", "pAnsLoesen", i, t("gilde.punkte.eintragLoesen", {datum: datumKurz(e.datum)}))).join("") +
      (ae.length > 4 ? '<li class="gl-p-plus">' + esc(t("gilde.punkte.aeltere", {n: ae.length - 4})) + "</li>" : "") + "</ul>" : "") +
    '<span class="gl-p-neu">' + pFeld("gildePAnsDatum", t("gilde.punkte.datum"), letzterSonntag(), "date", "pansdatum") + pFeld("gildePAnsBetrag", t("gilde.punkte.dazu"), "", "number", "pansbetrag", ' step="100"') +
    knopf("btn sm", 'data-g="pAnsAdd" data-f="pansadd"', t("gilde.punkte.eintragen")) + "</span>");
  const zs = (p?.zusatz ?? []).map((z, i) => ({z, i})).filter(x => !x.z.geloest);
  const zusatz = zeile(t("gilde.punkte.zeile.zusatz"), t("gilde.punkte.mitNotiz"), k.zusatz,
    (zs.length ? '<ul class="gl-p-chips">' + zs.map(({z, i}) => pChip("<b>" + punktZahl(z.punkte) + "</b> " + esc(z.notiz), "pZusLoesen", i, t("gilde.punkte.zusatzLoesen", {notiz: z.notiz}))).join("") + "</ul>" : "") +
    '<span class="gl-p-neu">' + pFeld("gildePZusPunkte", t("gilde.punkte.zusatzPunkte"), "", "number", "pzuspunkte", ' step="any"') + pFeld("gildePZusNotiz", t("gilde.punkte.notiz"), "", "text", "pzusnotiz") +
    knopf("btn sm", 'data-g="pZusAdd" data-f="pzusadd"', t("gilde.punkte.eintragen")) + "</span>");
  return '<div class="gl-p-konto" role="group" aria-label="' + esc(t("gilde.punkte.kontoVon", {name: m.name})) + '">' +
    zeile(t("gilde.punkte.zeile.monate"), (k.abzug ? k.roh + nb + "\u2212" + nb + k.abzug + nb + t("gilde.punkte.inaktivKurz") : String(k.monate)) + nb + "\u00d7" + nb + punktZahl(r.monat), k.teile.monate,
      pFeld("gildePSeit", t("gilde.punkte.seit"), p?.seit ?? heuteTag(), "date", "pseit") + pFeld("gildePAbzug", t("gilde.punkte.abzug"), p?.abzugMonate ?? 0, "number", "pabzug", ' step="1" aria-label="' + esc(t("gilde.punkte.abzugAria")) + '"')) +
    arten + ansehen + zusatz + "</div>";
}
/** Aktiv oder inaktiv setzen, ueber dem Konto. */
function pAktivZeile(k: Konto): string {
  const offenSeit = k.m.punkte?.pausen.find(q => q.bis === undefined);
  return offenSeit
    ? '<div class="gl-p-pbanner">' + PAUSE_SYM + "<p><b>" + esc(t("gilde.punkte.inaktivSeitSatz", {datum: datumLang(offenSeit.von)})) + "</b> " + esc(t("gilde.punkte.inaktivHinweis")) + "</p>" + knopf("btn sm hot", 'data-g="pAktiv" data-f="paktiv"', t("gilde.punkte.wiederAktiv")) + "</div>"
    : '<div class="gl-p-pbanner gl-p-ruhig"><p>' + esc(t("gilde.punkte.aktivHinweis")) + "</p>" + knopf("btn sm", 'data-g="pInaktivSetzen" data-f="pinaktivsetzen"', t("gilde.punkte.inaktivSetzen")) + "</div>";
}
function pPane(k: Konto): string {
  const gross = TEILE.map(([key]) => [key, k.teile[key]] as const).sort((a, b) => b[1] - a[1])[0]!;
  const satz = gross[1] > 0 ? t("gilde.punkte.satz", {q: t("gilde.punkte.teil." + gross[0]), n: punktZahl(gross[1])}) : t("gilde.punkte.satzNull");
  const chips = (k.pausiert ? '<span class="gl-p-pause">' + PAUSE_SYM + esc(t("gilde.punkte.inaktivSeit", {datum: pSeit(k)})) + "</span>" : "");
  return '<div class="gl-p-cp" id="gildePKonto"><header class="gl-p-hero"><div class="gl-p-hn"><h3 class="gl-name gl-p-name">' + esc(k.m.name) + "</h3>" + (chips ? '<div class="gl-p-hc">' + chips + "</div>" : "") +
    '</div><div class="gl-p-big"><b class="gl-p-gross">' + punktZahl(k.summe) + "</b><span>" + esc(t("gilde.punkte.punkte")) + '</span></div></header><p class="gl-p-satz">' + esc(satz) + "</p>" +
    pBalken(k, k.summe, false) + '<ul class="gl-p-legende">' + TEILE.map(([key, c]) => '<li><i class="gl-p-' + c + '"></i><span>' + esc(t("gilde.punkte.teil." + key)) + "</span><b>" + punktZahl(k.teile[key]) + "</b></li>").join("") + "</ul>" +
    pAktivZeile(k) + pKonto(k) + "</div>";
}
/** Die Regeln: Punkte je Monat, Teiler, Arten, Event zu Art, Rang und Gruppen, Stichtag. */
function regelnHtml(): string {
  const g = gildeState.gilde!, r = g.punkte!;
  const artZeile = (a: Art) => '<div class="gl-p-az"><label class="gl-p-fk gl-p-notiz"><span>' + esc(t("gilde.punkte.artName")) + '</span><input id="gildePArtName-' + a.id + '" type="text" maxlength="40" autocomplete="off" data-f="partname:' + a.id +
    '" value="' + esc(a.name) + '"></label>' + pFeld("gildePArtPunkte-" + a.id, t("gilde.punkte.zusatzPunkte"), a.punkte, "number", "partpunkte:" + a.id) +
    pFeld("gildePArtPro-" + a.id, t("gilde.punkte.artPro"), a.proPunkt, "number", "partpro:" + a.id, ' step="1"') +
    '<button type="button" class="btn sm" data-g="pArtLoesen" data-id="' + a.id + '" data-f="partloesen:' + a.id + '" aria-label="' + esc(t("gilde.punkte.artLoesen", {name: a.name})) + '">' + esc(t("gilde.punkte.loesen")) + "</button></div>";
  const aktiv = r.arten.filter(a => !a.geloest), gel = r.arten.filter(a => a.geloest);
  return '<section class="gl-edit" id="gildePRegeln" aria-labelledby="gildePRegelnT"><h3 id="gildePRegelnT">' + esc(t("gilde.punkte.regeln")) + '</h3><p class="gl-note">' + esc(t("gilde.punkte.regelnHilfe")) + "</p>" +
    '<div class="gl-p-raster">' + pFeld("gildePRMonat", t("gilde.punkte.rMonat"), r.monat, "number", "prmonat") + pFeld("gildePRTeiler", t("gilde.punkte.rTeiler"), r.teiler, "number", "prteiler", ' step="1"') +
    pFeld("gildePRStichtag", t("gilde.punkte.stichtag"), r.stichtag, "date", "prstichtag") + "</div><p class=\"gl-note\">" + esc(t("gilde.punkte.stichtagHilfe")) + "</p>" +
    "<h4>" + esc(t("gilde.punkte.arten")) + '</h4><div class="gl-p-arten">' + aktiv.map(artZeile).join("") + "</div>" +
    '<div class="gl-p-az"><label class="gl-p-fk gl-p-notiz"><span>' + esc(t("gilde.punkte.neueArt")) + '</span><input id="gildePNeuArt" type="text" maxlength="40" autocomplete="off" data-f="pneuart"></label>' +
    knopf("btn sm", 'data-g="pArtNeu" data-f="partneu"', t("gilde.punkte.artAdd")) + "</div>" +
    (gel.length ? '<p class="gl-fuss">' + esc(t("gilde.punkte.geloest")) + " " + gel.map(a => esc(a.name) + " " + '<button type="button" class="btn sm" data-g="pArtZurueck" data-id="' + a.id + '" data-f="partzurueck:' + a.id + '">' + esc(t("gilde.punkte.zurueck")) + "</button> " + loeschKnopf("art", a.id, a.name)).join(" ") + "</p>" +
      (loeschFrage?.was === "art" ? loeschFrageHtml(gel.find(a => a.id === loeschFrage!.id)?.name ?? "") : "") : "") +
    "<h4>" + esc(t("gilde.punkte.eventArt")) + '</h4><div class="gl-p-raster">' + g.reihen.filter(q => !q.geloest).map(q => '<label class="gl-p-fk"><span>' + esc(q.titel) + '</span><select id="gildePEvent-' + q.id + '" data-f="pevent:' + q.id + '"><option value="">' +
      esc(t("gilde.punkte.zaehltNicht")) + "</option>" + aktiv.map(a => '<option value="' + a.id + '"' + (q.art === a.id ? " selected" : "") + ">" + esc(a.name) + "</option>").join("") + "</select></label>").join("") + "</div>" +
    '<div class="gl-eaus">' + knopf("btn sm", 'data-g="pStandard" data-f="pstandard"', t("gilde.punkte.standard")) + "</div></section>";
}
function einlesenHtml(): string {
  return '<section class="gl-edit" id="gildePEinlesen" aria-labelledby="gildePEinlesenT"><h3 id="gildePEinlesenT">' + esc(t("gilde.punkte.einlesenT")) + '</h3><p class="gl-note">' + esc(t("gilde.punkte.einlesenHilfe")) + "</p>" +
    '<textarea id="gildePEinlesenText" class="gl-p-ta" rows="5" data-f="peintext" aria-label="' + esc(t("gilde.punkte.einlesenAria")) + '">' + esc(einlesenText) + "</textarea>" +
    '<div class="gl-eaus">' + knopf("btn sm hot", 'data-g="pUebernehmen" data-f="puebernehmen"', t("gilde.punkte.uebernehmen")) + (einlesenSatz ? '<span id="gildePEinlesenSatz" role="status">' + esc(einlesenSatz) + "</span>" : "") + "</div></section>";
}
/** Die Sonntagsrunde: ein Feld je Mitglied fuer das Gildenansehen; leere Felder bleiben. */
function sonntagHtml(alle: Konto[]): string {
  return '<section class="gl-edit" id="gildePSonntag" aria-labelledby="gildePSonntagT"><h3 id="gildePSonntagT">' + esc(t("gilde.punkte.sonntagT")) + '</h3><p class="gl-note">' + esc(t("gilde.punkte.sonntagHilfe")) + "</p>" +
    pFeld("gildePSonnDatum", t("gilde.punkte.datum"), letzterSonntag(), "date", "psonndatum") + '<ul class="gl-p-sonn">' + alle.map(k => '<li><label class="gl-p-fk"><span>' + esc(k.m.name) + (k.pausiert ? " (" + esc(t("gilde.punkte.inaktivKurz")) + ")" : "") +
      '</span><input type="number" min="0" step="100" inputmode="numeric" data-p-sonn="' + k.m.id + '" data-f="psonn:' + k.m.id + '"></label></li>').join("") + "</ul>" +
    '<div class="gl-eaus">' + knopf("btn sm hot", 'data-g="pSonnAdd" data-f="psonnadd"', t("gilde.punkte.eintragen")) + knopf("btn sm", 'data-g="pSonntag" data-f="psonntagzu"', t("gilde.punkte.schliessen")) + "</div></section>";
}
function punkteHtml(): string {
  const g = gildeState.gilde!, an = punkteAn();
  const kopf = '<div class="gl-p-kopf">' + pSchalter("gildePSchalter", an, "pSchalter", "pschalter", t("gilde.punkte.schalter"), t("gilde.punkte.schalterSatz")) +
    (an ? '<div class="gl-p-akt">' + '<button type="button" class="btn sm hot" data-g="pSonntag" data-f="psonntag" aria-expanded="' + sonntagOffen + '" aria-controls="gildePSonntag">' + esc(t("gilde.punkte.sonntag")) + "</button>" +
      '<button type="button" class="btn sm" data-g="pRegeln" data-f="pregeln" aria-expanded="' + regelnOffen + '" aria-controls="gildePRegeln">' + esc(t("gilde.punkte.regeln")) + "</button>" +
      '<button type="button" class="btn sm" data-g="pEinlesen" data-f="peinlesen" aria-expanded="' + einlesenOffen + '" aria-controls="gildePEinlesen">' + esc(t("gilde.punkte.einlesen")) + "</button>" +
      '<button type="button" class="btn sm" data-g="pText" data-f="ptext">' + esc(t("gilde.punkte.text")) + "</button></div>" : "") + "</div>" +
    (meldung ? '<p class="gl-meldung" role="status">' + esc(meldung) + (punktUndo ? " " + knopf("btn sm", 'data-g="pUndo" data-f="pundo"', t("gilde.mitglied.rueckgaengig")) : "") + "</p>" : "");
  if(!an) return kopf + '<p class="gl-leer">' + esc(t("gilde.punkte.ausSatz")) + "</p>";
  const alle = rangliste(g, wandUhr(Date.now()));
  const n = {alle: alle.length, aktiv: alle.filter(k => !k.pausiert).length, inaktiv: alle.filter(k => k.pausiert).length};
  const fil = '<div class="gl-chips gl-p-fil" id="gildePFilter" role="radiogroup" aria-label="' + esc(t("gilde.punkte.filter")) + '">' + (["alle", "aktiv", "inaktiv"] as PFilter[]).map(k =>
    '<button type="button" role="radio" data-g="pFilter" data-pf="' + k + '" data-f="pf:' + k + '" aria-checked="' + (punktFilter === k) + '" tabindex="' + (punktFilter === k ? 0 : -1) + '">' +
    esc(t("gilde.punkte.f." + k)) + " <em>" + n[k] + "</em></button>").join("") + "</div>";
  if(!alle.length) return kopf + '<p class="gl-leer">' + esc(t("gilde.mitglied.leer")) + "</p>";
  const z = alle.filter(k => punktFilter === "alle" || (punktFilter === "inaktiv") === k.pausiert);
  if(!z.length) return kopf + fil + '<p class="gl-leer">' + esc(t(punktFilter === "inaktiv" ? "gilde.punkte.keinInaktiv" : "gilde.punkte.alleInaktiv")) + "</p>";
  const x = z.find(k => k.m.id === punktAuswahl) ?? z[0]!;
  punktAuswahl = x.m.id;
  const max = Math.max(...alle.map(k => k.summe), 1);
  const ul = (liste: Konto[], id: string, label: string) => '<ul class="gl-p-cl" id="' + id + '" role="listbox" aria-label="' + esc(label) + '">' + liste.map(k => pZeile(k, x, max)).join("") + "</ul>";
  let lw: string;
  if(punktFilter === "alle" && z.some(k => k.pausiert)){
    const akt = z.filter(k => !k.pausiert), ina = z.filter(k => k.pausiert), auf = inaktivOffen || ina.some(k => k.m.id === x.m.id);
    lw = ul(akt, "gildePListe", t("gilde.punkte.aktive")) + '<div class="gl-p-ig"><button type="button" class="gl-p-igk" data-g="pInaktiv" data-f="pinaktiv" aria-expanded="' + auf + '" aria-controls="gildePInaktiv">' +
      PAUSE_SYM + esc(t("gilde.punkte.inaktiv")) + " <em>" + ina.length + "</em></button>" + (auf ? ul(ina, "gildePInaktiv", t("gilde.punkte.inaktive")) : "") + "</div>";
  } else lw = ul(z, "gildePListe", t("gilde.punkte.liste"));
  return kopf + (sonntagOffen ? sonntagHtml(alle) : "") + (regelnOffen ? regelnHtml() : "") + (einlesenOffen ? einlesenHtml() : "") + fil + '<div class="gl-p-c"><div class="gl-p-lw">' + lw + "</div>" + pPane(x) + "</div>";
}
function punkteSchalten(an: boolean){
  const g = gildeState.gilde!;
  if(g.punkte) g.punkte.an = an;
  else if(an) g.punkte = {...STANDARD_REGELN, schwellen: [STANDARD_REGELN.schwellen[0], STANDARD_REGELN.schwellen[1]], an: true, stichtag: wandUhr(Date.now()).slice(0, 10), arten: STANDARD_ARTEN.map(a => ({...a}))};
  speichern();
}
/** Der Satz nach einer Handlung, mit einem Rueckgaengig, das nur Flags zuruecksetzt (nie etwas entfernt). */
function pMelde(text: string, rueck: (() => void) | null){ meldung = text; punktUndo = rueck; ansage(text); }
const pWert = (id: string) => document.querySelector<HTMLInputElement>("#" + id)?.value ?? "";
function pMitglied(): Mitglied | null { return aktive().find(m => m.id === punktAuswahl) ?? null; }
/** Das Punktekonto eines Mitglieds; fehlt es noch, entsteht es mit "seit" heute. */
function pDaten(m: Mitglied): MitgliedPunkte {
  if(!m.punkte) m.punkte = {seit: heuteTag(), pausen: [], start: {}, ansehen: {start: 0, eintraege: []}, zusatz: []};
  return m.punkte;
}
/** Die Handlungen der Regeln und des Einlesens; nichts wird entfernt, Loesen setzt ein Flag. */
function regelnKlick(b: HTMLButtonElement, a: string | undefined): boolean {
  const g = gildeState.gilde!, r = g.punkte!;
  if(a === "pArtNeu"){
    const name = rein(pWert("gildePNeuArt"), 40);
    if(!name){ pMelde(t("gilde.punkte.m.artName"), null); fokus = "pneuart"; return true; }
    if(r.arten.length >= 12){ pMelde(t("gilde.punkte.m.artenMax"), null); return true; }
    r.arten.push({id: neueId("a"), name, punkte: 1, proPunkt: 1});
    speichern();
    pMelde(t("gilde.punkte.m.artNeu", {name}), null);
    return true;
  }
  if(a === "pArtLoesen" || a === "pArtZurueck"){
    const x = r.arten.find(q => q.id === b.dataset.id);
    if(!x) return false;
    if(a === "pArtLoesen"){ x.geloest = true; speichern(); pMelde(t("gilde.punkte.m.artGeloest", {name: x.name}), () => { delete x.geloest; }); }
    else { delete x.geloest; speichern(); pMelde(t("gilde.punkte.m.artZurueck", {name: x.name}), null); }
    return true;
  }
  if(a === "pStandard"){
    r.monat = STANDARD_REGELN.monat; r.teiler = STANDARD_REGELN.teiler; r.schwellen = [STANDARD_REGELN.schwellen[0], STANDARD_REGELN.schwellen[1]];
    for(const std of STANDARD_ARTEN){
      const x = r.arten.find(q => q.id === std.id);
      if(x){ x.name = std.name; x.punkte = std.punkte; x.proPunkt = std.proPunkt; delete x.geloest; }
      else if(r.arten.length < 12) r.arten.push({...std});
    }
    speichern();
    pMelde(t("gilde.punkte.m.standard"), null);
    return true;
  }
  if(a === "pUebernehmen"){
    einlesenText = pWertText("gildePEinlesenText");
    const heute = heuteTag(), res = tabelleEinlesen(einlesenText, g), n = einlesenText.split(/\r?\n/).filter(z => z.trim()).length;
    const zurueck: (() => void)[] = [];
    for(const z of res.zeilen){
      const m = g.mitglieder.find(x => x.id === z.mitgliedId);
      if(!m) continue;
      const d = pDaten(m), alt = {seit: d.seit, ansehen: d.ansehen.start, start: {...d.start}};
      if(z.seit) d.seit = z.seit;
      for(const [id, v] of Object.entries(z.start)) d.start[id] = v;
      if(z.ansehenStart !== undefined) d.ansehen.start = z.ansehenStart;
      let pause: Pause | null = null;
      if(z.offenePause && !d.pausen.some(q => q.bis === undefined)){ pause = {von: heute}; d.pausen.push(pause); }
      zurueck.push(() => {
        d.seit = alt.seit; d.ansehen.start = alt.ansehen;
        for(const id of Object.keys(z.start)) d.start[id] = alt.start[id] ?? 0;
        if(pause) pause.bis = pause.von;
      });
    }
    einlesenSatz = t("gilde.punkte.m.eingelesen", {ok: res.zeilen.length, n, fremd: res.fremd ? t("gilde.punkte.m.fremd", {k: res.fremd}) : ""});
    if(res.zeilen.length){ speichern(); pMelde(einlesenSatz, () => { zurueck.forEach(f => f()); }); } else pMelde(einlesenSatz, null);
    fokus = "puebernehmen";
    return true;
  }
  return false;
}
const pWertText = (id: string) => document.querySelector<HTMLTextAreaElement>("#" + id)?.value ?? "";
/** Die Liste als Text zum Kopieren (punkteText im Kern); die Namen verlassen den PC nur, wenn du den Text selbst einfuegst. */
async function punkteKopieren(){
  const g = gildeState.gilde;
  if(!g?.punkte) return;
  const text = punkteText(rangliste(g, wandUhr(Date.now())), g, {kopf: t("gilde.punkte.textKopf"), inaktiv: t("gilde.punkte.inaktivKurz"), zahl: punktZahl, gruppe: x => t("gilde.punkte.gruppe." + x)});
  try{
    if(!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") throw new Error("ohne Zwischenablage");
    await navigator.clipboard.writeText(text);
    ausgabeMelden(t("gilde.ausgabe.kopiert"));
  }catch(err){ ausgabeMelden(t("gilde.ausgabe.nichtKopiert")); }
}
/** Eingaben in den Regeln: gespeichert wird beim Verlassen des Feldes (change). */
function regelnAendern(x: HTMLInputElement | HTMLSelectElement){
  const g = gildeState.gilde, r = g?.punkte;
  if(!g || !r || lage !== "da") return;
  const v = x.value, zahl = Math.max(0, Number(v.replace(",", ".")) || 0);
  if(x.id === "gildePRMonat") r.monat = Math.min(1000, zahl);
  else if(x.id === "gildePRTeiler") r.teiler = Math.max(1, Math.min(1000000000, zahl));
  else if(x.id === "gildePRSpitze") r.schwellen = [Math.min(1000000, zahl), r.schwellen[1]];
  else if(x.id === "gildePRMitte") r.schwellen = [r.schwellen[0], Math.min(1000000, zahl)];
  else if(x.id === "gildePRStichtag"){ if(!tagOk(v)) return; r.stichtag = v; }
  else if(x.id.startsWith("gildePArtName-")){
    const a = r.arten.find(q => q.id === x.id.slice("gildePArtName-".length)), n = rein(v, 40);
    if(!a || !n) return;
    a.name = n;
  }
  else if(x.id.startsWith("gildePArtPunkte-")){
    const a = r.arten.find(q => q.id === x.id.slice("gildePArtPunkte-".length));
    if(!a) return;
    a.punkte = Math.round(Math.min(1000, zahl) * 100) / 100;
  }
  else if(x.id.startsWith("gildePArtPro-")){
    const a = r.arten.find(q => q.id === x.id.slice("gildePArtPro-".length));
    if(!a) return;
    a.proPunkt = Math.max(1, Math.min(100, Math.floor(zahl) || 1));
  }
  else if(x.id.startsWith("gildePEvent-")){
    const q = g.reihen.find(e => e.id === x.id.slice("gildePEvent-".length));
    if(!q || (v && !r.arten.some(a => a.id === v))) return;
    if(v) q.art = v; else delete q.art;
  }
  else return;
  meldung = ""; punktUndo = null;
  speichern();
  setTimeout(zeichnen, 0);
}
function punkteKlick(b: HTMLButtonElement, a: string | undefined): boolean {
  if(a === "pSchalter"){ punkteSchalten(!punkteAn()); fokus = "pschalter"; return true; }
  if(a === "pWahl" && b.dataset.pId){ punktAuswahl = b.dataset.pId; fokus = "p:" + b.dataset.pId; return true; }
  if(a === "pFilter"){ punktFilter = (b.dataset.pf || "alle") as PFilter; fokus = "pf:" + punktFilter; return true; }
  if(a === "pInaktiv"){ inaktivOffen = !inaktivOffen; fokus = "pinaktiv"; return true; }
  if(a === "pSonntag"){ sonntagOffen = !sonntagOffen; fokus = sonntagOffen ? "psonndatum" : "psonntag"; return true; }
  if(a === "pUndo"){ const u = punktUndo; punktUndo = null; meldung = ""; if(u){ u(); speichern(); } return true; }
  if(a === "pText"){ void punkteKopieren(); return false; }
  if(!punkteAn() || lage !== "da") return false;
  if(a === "pRegeln"){ regelnOffen = !regelnOffen; fokus = "pregeln"; return true; }
  if(a === "pEinlesen"){ einlesenOffen = !einlesenOffen; einlesenSatz = ""; fokus = einlesenOffen ? "peintext" : "peinlesen"; return true; }
  if(regelnKlick(b, a)) return true;
  const m = pMitglied(), heute = heuteTag(), i = +(b.dataset.i ?? -1);
  if(a === "pSonnAdd"){
    const datum = pWert("gildePSonnDatum");
    if(!tagOk(datum)){ pMelde(t("gilde.punkte.m.datumFehlt"), null); return true; }
    const neu: {betrag: number; e: {datum: string; betrag: number; geloest?: boolean}}[] = [];
    for(const x of aktive()){
      const v = Number(document.querySelector<HTMLInputElement>('[data-p-sonn="' + x.id + '"]')?.value.replace(",", ".") || 0);
      if(!(v > 0)) continue;
      const e = {datum, betrag: Math.round(Math.min(v, 1000000000))};
      pDaten(x).ansehen.eintraege.push(e);
      neu.push({betrag: e.betrag, e});
    }
    sonntagOffen = false;
    if(!neu.length){ pMelde(t("gilde.punkte.m.keinFeld"), null); return true; }
    speichern();
    pMelde(t("gilde.punkte.m.sonntag", {n: neu.length, datum: datumKurz(datum)}), () => { neu.forEach(x => { x.e.geloest = true; }); });
    fokus = "psonntag";
    return true;
  }
  if(!m) return false;
  const d = pDaten(m);
  if(a === "pInaktivSetzen"){
    if(d.pausen.some(q => q.bis === undefined)) return false;
    const q: Pause = {von: heute};
    d.pausen.push(q);
    speichern();
    pMelde(t("gilde.punkte.m.inaktivHeute", {name: m.name}), () => { q.bis = q.von; });
    return true;
  }
  if(a === "pAktiv"){
    const q = d.pausen.find(x => x.bis === undefined);
    if(!q) return false;
    q.bis = q.von > heute ? q.von : heute;
    speichern();
    pMelde(t("gilde.punkte.m.wiederAktiv", {name: m.name}), () => { delete q.bis; });
    return true;
  }
  if(a === "pAnsAdd"){
    const datum = pWert("gildePAnsDatum"), betrag = Number(pWert("gildePAnsBetrag").replace(",", "."));
    if(!tagOk(datum) || !(betrag > 0)){ pMelde(t("gilde.punkte.m.eintragBraucht"), null); fokus = "pansbetrag"; return true; }
    d.ansehen.eintraege.push({datum, betrag: Math.round(Math.min(betrag, 1000000000))});
    speichern();
    pMelde(t("gilde.punkte.m.eintragGesetzt", {betrag: kurzZahl(Math.round(betrag))}), null);
    return true;
  }
  if(a === "pAnsLoesen"){
    const e = d.ansehen.eintraege[i];
    if(!e) return false;
    e.geloest = true;
    speichern();
    pMelde(t("gilde.punkte.m.eintragGeloest", {datum: datumKurz(e.datum)}), () => { delete e.geloest; });
    return true;
  }
  if(a === "pZusAdd"){
    const punkte = Number(pWert("gildePZusPunkte").replace(",", ".")), notiz = rein(pWert("gildePZusNotiz"), 60);
    if(!(punkte > 0) || !notiz){ pMelde(t("gilde.punkte.m.zusatzBraucht"), null); fokus = "pzuspunkte"; return true; }
    d.zusatz.push({punkte: Math.round(Math.min(punkte, 1000000) * 100) / 100, notiz});
    speichern();
    pMelde(t("gilde.punkte.m.zusatzGesetzt"), null);
    return true;
  }
  if(a === "pZusLoesen"){
    const z = d.zusatz[i];
    if(!z) return false;
    z.geloest = true;
    speichern();
    pMelde(t("gilde.punkte.m.zusatzGeloest", {notiz: z.notiz}), () => { delete z.geloest; });
    return true;
  }
  return false;
}
/** Eingaben im Konto: gespeichert wird beim Verlassen des Feldes (change); neu gezeichnet erst danach, damit der Tabstopp weiterwandert. */
function punkteAendern(x: HTMLInputElement){
  const m = pMitglied(), r = gildeState.gilde?.punkte;
  if(!m || !r || lage !== "da") return;
  const d = pDaten(m), v = x.value, zahl = Math.max(0, Number(v.replace(",", ".")) || 0);
  if(x.id === "gildePSeit"){ if(!tagOk(v)) return; d.seit = v; }
  else if(x.id === "gildePAbzug") d.abzugMonate = Math.min(1200, Math.floor(zahl));
  else if(x.id.startsWith("gildePStart-")){
    const art = x.id.slice("gildePStart-".length);
    if(!r.arten.some(q => q.id === art)) return;
    d.start[art] = Math.round(Math.min(zahl, 1000000) * 100) / 100;
  }
  else if(x.id === "gildePAnsStart") d.ansehen.start = Math.round(Math.min(zahl, 1000000000));
  else return;
  meldung = ""; punktUndo = null;
  speichern();
  setTimeout(zeichnen, 0);
}

/** Der Satz nach dem Loesen: nennt die Gilde und bietet Rueckgaengig (30 s). */
function loesenSatz(): string {
  const weg = loesenUndo ? geloeste.find(e => e.gilde.id === loesenUndo) : null;
  return weg ? '<p class="gl-meldung" id="gildeLoesenMeldung" role="status"><span>' + esc(t("gilde.loesen.gelost", {name: weg.gilde.name})) + "</span>" +
    knopf("btn sm", 'data-g="gildeUndo" data-f="gundo"', t("gilde.mitglied.rueckgaengig")) + "</p>" : "";
}
function flaecheHtml(): string {
  if(lage === "nurApp") return '<div class="wbox wkleer">' + SYMBOL + '<p class="wksatz gl-nurapp">' + esc(t("gilde.nurApp")) + "</p></div>";
  if(lage === "laden") return '<p class="wksatz">' + esc(t("gilde.laden")) + "</p>";
  if(lage === "gesperrt") return '<p class="wksatz wkgesperrt">' + esc(t("gilde.gesperrt")) + "</p>";
  if(!gildeState.gilde) return loesenSatz() + '<div class="wbox wkleer">' + SYMBOL + '<p class="wksatz">' + esc(t("gilde.anlegenSatz")) + "</p>" +
    '<form class="wkform" id="gildeNeu" novalidate><span class="field"><label for="gildeNeuName">' + esc(t("gilde.name")) + "</label>" +
    '<input id="gildeNeuName" data-f="gneu" maxlength="24" autocomplete="off" spellcheck="false"></span>' +
    '<button type="submit" class="btn sm hot">' + esc(t("gilde.anlegen")) + "</button></form></div>";
  const kurz = '<p class="gl-kurz">' + esc(t("gilde.kurz." + gildeState.tab)) + "</p>";
  if(gildeState.tab === "mitglieder") return mitgliederHtml() + kurz;
  if(gildeState.tab === "termine") return termineHtml() + kurz;
  if(gildeState.tab === "punkte") return punkteHtml() + kurz;
  return auswertungHtml() + kurz;
}
/* Den Fokus setzen: ein Reiter (tab:...) oder das Element mit data-f; Eingaben behalten die Schreibmarke. */
function fokusSetzen(f: string, marke: [number | null, number | null] | null){
  const e = f.startsWith("tab:") ? document.querySelector<HTMLElement>('#gildeTabs [data-gtab="' + f.slice(4) + '"]')
    : document.querySelector<HTMLElement>('#gildeFlaeche [data-f="' + CSS.escape(f) + '"]');
  if(!e || (e as HTMLButtonElement).disabled) return;
  e.focus();
  if(marke && e instanceof HTMLInputElement && e.type !== "checkbox"){ try{ e.setSelectionRange(marke[0], marke[1]); }catch(err){} }
}
function zeichnen(){
  if(!offen) return;
  kopfSetzen();
  statusSetzen();
  const da = lage === "da" && !!gildeState.gilde;
  const tabs = document.getElementById("gildeTabs"), filterBox = document.getElementById("gildeFilter"), flaeche = document.getElementById("gildeFlaeche");
  if(!tabs || !filterBox || !flaeche) return;
  tabs.hidden = !da; filterBox.hidden = !da || gildeState.tab === "punkte";
  if(da){ reiterZeichnen(); filterZeichnen(); flaeche.setAttribute("role", "tabpanel"); flaeche.setAttribute("aria-labelledby", "gildeTab-" + gildeState.tab); }
  else { flaeche.removeAttribute("role"); flaeche.removeAttribute("aria-labelledby"); }
  // wer gerade in der Flaeche steht, steht nach dem Zeichnen wieder dort
  const a = document.activeElement as HTMLElement | null;
  const vorher = a && flaeche.contains(a) ? a.dataset.f || null : null;
  const marke: [number | null, number | null] | null = a instanceof HTMLInputElement && a.type !== "checkbox" ? [a.selectionStart, a.selectionEnd] : null;
  const schluessel = gildeState.tab + "|" + punktAuswahl + "|" + termin;
  if(schluessel !== animSchluessel){ animSchluessel = schluessel; anim = true; }
  flaeche.classList.remove("gl-ein");
  flaeche.innerHTML = flaecheHtml();
  const f = fokus ?? vorher;
  fokus = null;
  if(f) fokusSetzen(f, f === vorher ? marke : null);
  bewegen(flaeche);
  if(da && gildeState.tab === "auswertung") void vorschau();
  else vorschauLoesen();
}
/** Die Bewegung eines Zeichnens: einmaliges Einbauen bei Wechsel, Zaehlen der grossen Zahl, Puls am getroffenen Element. */
function bewegen(flaeche: HTMLElement){
  const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ein = anim && !ruhig, hit = puls && !ruhig;
  anim = false; puls = false;
  if(animTimer){ clearTimeout(animTimer); animTimer = null; }
  if(ein){
    flaeche.classList.add("gl-ein");
    animTimer = setTimeout(() => { flaeche.classList.remove("gl-ein"); animTimer = null; }, 800);
    flaeche.querySelectorAll<HTMLElement>(".gl-p-gross").forEach(zaehleHoch);
  }
  const a = document.activeElement as HTMLElement | null;
  if(hit && a && flaeche.contains(a) && a.matches(".gl-marken [role=radio], .gl-zaehler .btn, .gl-term, .gl-p-co, .gl-kachel")){
    a.classList.add("gl-puls");
    a.addEventListener("animationend", () => a.classList.remove("gl-puls"), {once: true});
  }
}
/** Eine Zahl zaehlt in 0,45 s von 0 zum Wert (Dezimalstellen und Sprache wie im Text). Der Text bleibt der Endwert (Vorleser, Tests);
 *  gezaehlt wird im Attribut data-z, das ein Pseudo-Element ueber den durchsichtigen Text legt. */
function zaehleHoch(e: HTMLElement){
  const ziel = e.textContent || "", wert = parseFloat(ziel.replace(",", "."));
  if(!isFinite(wert) || wert <= 0 || !/^[\d.,]+$/.test(ziel)) return;
  const dez = (ziel.split(/[.,]/)[1] || "").length, t0 = performance.now();
  e.classList.add("gl-zaehlt");
  e.dataset.z = state.lang === "de" ? (0).toFixed(dez).replace(".", ",") : (0).toFixed(dez);
  const schritt = (jetzt: number) => {
    if(!e.isConnected) return;
    const x = Math.min(1, (jetzt - t0) / 450), v = wert * (1 - Math.pow(1 - x, 3));
    const z = v.toFixed(dez);
    e.dataset.z = state.lang === "de" ? z.replace(".", ",") : z;
    if(x < 1) requestAnimationFrame(schritt);
    else { e.classList.remove("gl-zaehlt"); delete e.dataset.z; }
  };
  requestAnimationFrame(schritt);
}
/* Beim Tippen im Feld nur die Kacheln, die Zahlen des Filters und die Ueberschrift: das Feld selbst bleibt stehen. */
function listeNeu(){
  const l = document.getElementById("gildeListe");
  if(l) l.innerHTML = listeHtml();
  filterZeichnen();
  const m = imFeld(), h = document.getElementById("gildeEditT");
  if(m && h) h.textContent = m === entwurf || !m.name ? t("gilde.mitglied.neuT") : t("gilde.mitglied.bearbeitenT", {name: m.name});
}

/* ---------- Minutentakt fuer die Restzeit, nur solange der Bereich offen ist ---------- */
let takt: ReturnType<typeof setTimeout> | null = null;
function planen(){
  takt = setTimeout(() => {
    takt = null;
    if(!offen) return;
    kopfSetzen();
    // die Restzeiten der Termine laufen mit; nicht, solange ein Formular offen ist
    if(gildeState.tab === "termine" && lage === "da" && gildeState.gilde && !reiheFeld && !verschieben) zeichnen();
    planen();
  }, 60000 - Date.now() % 60000 + 50);
}
/** Aus renderAll (32): der Bereich ist offen oder zu; gezeichnet wird nur, wenn er offen ist. */
export function syncGilde(sichtbar: boolean){
  offen = sichtbar;
  onlineHaken.sichtbar?.(sichtbar);
  if(sichtbar){ zeichnen(); if(!takt) planen(); }
  else {
    vorschauLoesen();
    if(takt){ clearTimeout(takt); takt = null; }
  }
}

/* ---------- Handlungen ---------- */
function feldSchliessen(){
  const m = imFeld();
  fokus = m && m !== entwurf ? "b:" + m.id : "neu";
  bearbeiten = null; entwurf = null; wahl = [null, null]; offWahl = [null, null]; austrittFrage = null;
}
function loesen(id: string){
  const m = aktive().find(x => x.id === id);
  if(!m) return;
  m.geloest = true;
  m.ausgetreten = wandUhr(Date.now()).slice(0, 10);
  austrittFrage = null;
  undo = id;
  if(bearbeiten === id){ bearbeiten = null; wahl = [null, null]; }
  fokus = "undo";
  ansage(t("gilde.mitglied.geloest", {name: m.name}));
  speichern();
}
function zurueckholen(){
  const m = gildeState.gilde?.mitglieder.find(x => x.id === undo);
  undo = null;
  if(!m) return;
  delete m.geloest; delete m.ausgetreten;
  fokus = "b:" + m.id;
  ansage(t("gilde.mitglied.zurueck", {name: m.name}));
  speichern();
}
/** Was noch zu speichern ist, geht zuerst hinaus: sonst brächte der naechste Put das Geloeschte zurueck. */
async function abwarten(){
  if(sendeTimer){ clearTimeout(sendeTimer); sendeTimer = null; senden(); }
  for(let n = 0; n < 100 && (unterwegs || nochmal); n++) await new Promise(r => setTimeout(r, 50));
}
export type LoeschenAntwort = {ok: true; sicherung: string} | {ok: false; grund: string};
/** Eine gelöste Gilde, ein ehemaliges Mitglied oder eine gelöste Art endgueltig loeschen (die Datei prueft Namen und legt die Sicherung an). */
export async function loeschenGeloest(was: "gilde" | "mitglied" | "art", id: string, name: string): Promise<LoeschenAntwort> {
  if(quelle !== "lokal" || lage !== "da" || nurLesen) return {ok: false, grund: "abgelehnt"};
  await abwarten();
  let antwort: unknown = null, status = 0;
  try {
    const r = await fetch("/api/gilde-loeschen", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({was, id, name})});
    status = r.status; antwort = await r.json();
  } catch { /* der Satz sagt, dass es nicht ging */ }
  if(isRec(antwort) && antwort.ok === true && typeof antwort.sicherung === "string"){
    // die Datei hat sich geaendert: die Seite liest sie neu, bevor sie wieder schreibt
    if(was === "gilde") geloeste = geloeste.filter(e => e.gilde.id !== id);
    lage = "laden"; ladeVersuch = 0;
    laden();
    return {ok: true, sicherung: antwort.sicherung};
  }
  return {ok: false, grund: isRec(antwort) && typeof antwort.grund === "string" ? antwort.grund : status === 503 ? "unavailable" : "abgelehnt"};
}
/** Die Frage zum endgueltigen Loeschen: Name eintippen, dann ist der Knopf frei. */
function loeschFrageHtml(name: string): string {
  return '<div class="gl-frage gl-l-frage" role="group" aria-labelledby="gildeLQ"><p id="gildeLQ">' + esc(t("gilde.loeschen.frage", {name})) + "</p>" +
    '<span class="field"><label for="gildeLoeschName">' + esc(t("gilde.loeschen.feld")) + '</label><input id="gildeLoeschName" data-f="loeschName" maxlength="40" autocomplete="off" spellcheck="false" value="' + esc(loeschName) + '"></span>' +
    '<button type="button" class="btn sm hot" data-g="loeschJa" data-f="loeschJa"' + (namenGleich(loeschName, name) ? "" : " disabled") + ">" + esc(t("gilde.loeschen.ja")) + "</button>" +
    '<button type="button" class="btn sm" data-g="loeschNein" data-f="loeschNein">' + esc(t("gilde.loesen.nein")) + "</button></div>";
}
/** Der Knopf zu einem Eintrag der Liste der Gelösten (nur lokal): oeffnet die Frage. */
const loeschKnopf = (was: "mitglied" | "art", id: string, name: string) => quelle !== "lokal" ? "" :
  '<button type="button" class="btn sm" data-g="loeschFrage" data-was="' + was + '" data-id="' + id + '" data-f="lq:' + id + '" aria-label="' + esc(t("gilde.loeschen.aria", {name})) + '">' + esc(t("gilde.loeschen.knopf")) + "</button>";
async function loeschenAusfuehren(){
  const q = loeschFrage, g = gildeState.gilde;
  if(!q || !g) return;
  const name = q.was === "mitglied" ? g.mitglieder.find(m => m.id === q.id && m.geloest)?.name : g.punkte?.arten.find(a => a.id === q.id && a.geloest)?.name;
  if(!name || !namenGleich(loeschName, name)) return;
  const r = await loeschenGeloest(q.was, q.id, loeschName);
  loeschFrage = null; loeschName = "";
  meldung = r.ok ? t("gilde.loeschen.fertig", {name, datei: r.sicherung}) : t("gilde.loeschen.fehler." + (["name", "sicherung", "in-benutzung", "nicht-geloest", "unavailable"].includes(r.grund) ? r.grund : "abgelehnt"));
  ansage(meldung);
  fokus = null;
  zeichnen();
}

/* ---------- Gilde loesen (Spezifikation Gilde fein, 2.2): in die Liste, mit Rueckgaengig ---------- */
export const namenGleich = (a: string, b: string) => rein(a, 24).toLocaleLowerCase() === rein(b, 24).toLocaleLowerCase();
/** Der Name der offenen lokalen Gilde (die Schublade in 71 zeigt ihn); null, wenn keine offen ist oder sie vom Server kommt. */
export const lokalerName = (): string | null => quelle === "lokal" && lage === "da" && gildeState.gilde ? gildeState.gilde.name : null;
/** Die gelösten Gilden fuer die Schublade: Kennung, Name, Tag, Zahl der Mitglieder (ohne gelöste). */
export const geloesteListe = (): {id: string; name: string; am: string; mitglieder: number}[] =>
  geloeste.map(e => ({id: e.gilde.id, name: e.gilde.name, am: e.am, mitglieder: e.gilde.mitglieder.filter(m => !m.geloest).length}));
export type LoesenErgebnis = "ok" | "name" | "voll" | "nein";
/** Die offene lokale Gilde in die Liste legen, wenn der Name stimmt. Die Gilde bleibt ganz erhalten; Rueckgaengig holt sie 30 s lang zurueck. */
export function gildeLoesen(eingabe: string): LoesenErgebnis {
  const g = gildeState.gilde;
  if(quelle !== "lokal" || lage !== "da" || !g || nurLesen) return "nein";
  if(!namenGleich(eingabe, g.name)) return "name";
  if(geloeste.length >= MAX_GELOESTE) return "voll";
  geloeste = [...geloeste, {am: wandUhr(Date.now()).slice(0, 10), gilde: g}];
  gildeState.gilde = null;
  eingabenLoeschen(); meldung = "";
  loesenUndo = g.id;
  if(loesenTimer) clearTimeout(loesenTimer);
  loesenTimer = setTimeout(() => { loesenTimer = null; loesenUndo = null; zeichnen(); }, 30000);
  ansage(t("gilde.loesen.ansage", {name: g.name}));
  fokus = "gundo";
  speichern();
  zeichnen();
  return "ok";
}
/** Eine gelöste Gilde zurueckholen; "erst": es ist schon eine offen (sie wird nie stillschweigend ersetzt). */
export function gildeZurueckholen(id: string): "ok" | "erst" | "nein" {
  if(quelle !== "lokal" || lage !== "da" || nurLesen) return "nein";
  const e = geloeste.find(x => x.gilde.id === id);
  if(!e) return "nein";
  if(gildeState.gilde) return "erst";
  geloeste = geloeste.filter(x => x !== e);
  gildeState.gilde = e.gilde;
  if(loesenTimer){ clearTimeout(loesenTimer); loesenTimer = null; }
  loesenUndo = null; meldung = "";
  ansage(t("gilde.loesen.zurueck", {name: e.gilde.name}));
  speichern();
  zeichnen();
  return "ok";
}
function klick(e: MouseEvent){
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if(!b || b.disabled || b.type === "submit") return;
  if(b.dataset.gtab){ reiterWaehlen(b.dataset.gtab as Reiter); return; }
  if(b.closest("#gildeRollen")){ filter.rolle = (b.dataset.rolle || "") as Rolle; zeichnen(); return; }
  if(b.dataset.g === "gildeUndo"){ if(loesenUndo) gildeZurueckholen(loesenUndo); return; }
  const g = gildeState.gilde;
  if(lage !== "da" || !g) return;
  if(nurLesen && schreibt(b)){ ansage(t("gilde.on.nurLesen.satz")); return; }
  puls = true;
  const a = b.dataset.g, id = b.closest<HTMLElement>("[data-m-id]")?.dataset.mId;
  if(a !== "undo") undo = null;
  if(a !== "reiheUndo") reiheUndo = null;
  if(a !== "pUndo") punktUndo = null;
  if(a === "loeschFrage"){ loeschFrage = {was: b.dataset.was === "art" ? "art" : "mitglied", id: b.dataset.id || ""}; loeschName = ""; fokus = "loeschName"; if(loeschFrage.was === "mitglied") ehemaligeOffen = true; zeichnen(); return; }
  if(a === "loeschNein"){ const f = loeschFrage; loeschFrage = null; loeschName = ""; fokus = f ? "lq:" + f.id : null; zeichnen(); return; }
  if(a === "loeschJa"){ void loeschenAusfuehren(); return; }
  meldung = "";
  ausgabeSatz = "";
  if(gildeState.tab === "termine"){ if(termineKlick(b, a)) zeichnen(); return; }
  if(gildeState.tab === "punkte"){ if(punkteKlick(b, a)) zeichnen(); return; }
  if(gildeState.tab === "auswertung"){
    statusSetzen();
    if(a === "text") void textKopieren();
    else if(a === "bild") void bildKopieren();
    else if(a === "ics") icsSpeichern();
    return;
  }
  const wb = b.closest<HTMLElement>(".gl-wb");
  if(wb && b.dataset.w && wb.dataset.nr?.startsWith("o")){
    // der Offspec: zwei verschiedene Waffen sind das Paar, mit weniger faellt es weg
    const m = imFeld();
    if(!m) return;
    const i = wb.dataset.nr === "o2" ? 1 : 0, w = b.dataset.w;
    offWahl[i] = offWahl[i] === w ? null : w;
    if(offWahl[0] && offWahl[1]) m.offspec = [offWahl[0], offWahl[1]]; else delete m.offspec;
    fokus = "o" + (i + 1) + ":" + w;
    if(m !== entwurf) speichern();
  }
  else if(wb && b.dataset.w){
    const m = imFeld();
    if(!m) return;
    const i = wb.dataset.nr === "2" ? 1 : 0, w = b.dataset.w;
    wahl[i] = wahl[i] === w ? null : w;
    m.waffen = wahl[0] && wahl[1] ? [wahl[0], wahl[1]] : [];
    fokus = "w" + (i + 1) + ":" + w;
    if(m !== entwurf) speichern();
  }
  else if(a === "neu"){
    if(!platz()) return;
    entwurf = {id: neueId("m"), name: "", rolle: "", waffen: [], notiz: ""};
    bearbeiten = entwurf.id; wahl = [null, null]; offWahl = [null, null]; austrittFrage = null; fokus = "ename";
  }
  else if(a === "bearbeiten" && id){
    const m = aktive().find(x => x.id === id);
    if(!m) return;
    entwurf = null; bearbeiten = id; wahl = m.waffen.length === 2 ? [m.waffen[0]!, m.waffen[1]!] : [null, null]; fokus = "ename";
    offWahl = m.offspec && m.offspec.length === 2 ? [m.offspec[0]!, m.offspec[1]!] : [null, null]; austrittFrage = null;
  }
  else if(a === "loesen"){ austrittFrage = id || bearbeiten; fokus = "austrJa"; }
  else if(a === "austrJa") loesen(austrittFrage || bearbeiten || "");
  else if(a === "austrNein"){ austrittFrage = null; fokus = "eloesen"; }
  else if(a === "offAus"){ const m = imFeld(); if(!m) return; offWahl = [null, null]; delete m.offspec; fokus = "eoffsum"; if(m !== entwurf) speichern(); }
  else if(a === "ehemZurueck" && b.dataset.mId){
    const m = gildeState.gilde!.mitglieder.find(x => x.id === b.dataset.mId);
    if(!m) return;
    delete m.geloest; delete m.ausgetreten;
    ansage(t("gilde.mitglied.zurueck", {name: m.name}));
    fokus = "b:" + m.id;
    speichern();
  }
  else if(a === "undo") zurueckholen();
  else if(a === "fertig") feldSchliessen();
  else return;
  zeichnen();
}
function eingabe(e: Event){
  const x = e.target as HTMLInputElement;
  if(x.id === "gildeLoeschName"){
    // nur den Knopf nachfuehren: das Feld bleibt stehen
    loeschName = x.value;
    const q = loeschFrage, g = gildeState.gilde;
    const name = !q || !g ? "" : q.was === "mitglied" ? g.mitglieder.find(m => m.id === q.id)?.name ?? "" : g.punkte?.arten.find(a => a.id === q.id)?.name ?? "";
    const ja = document.querySelector<HTMLButtonElement>('#gildeFlaeche [data-g="loeschJa"]');
    if(ja) ja.disabled = !name || !namenGleich(loeschName, name);
    return;
  }
  if(x.id === "gildePEinlesenText"){ einlesenText = x.value; return; }
  if(x.id === "gildeDSuche"){ datumSuche = x.value; zeichnen(); return; }
  if(x.classList.contains("gl-zin") && x.dataset.zId){
    // der Zaehler eines Mitglieds: sofort in die Datei, auf 0 bis N gekuerzt; gezeichnet wird beim Verlassen (change)
    const tk = x.closest<HTMLElement>("[data-tk]")?.dataset.tk || "", g = gildeState.gilde, re = g ? reiheVon(tk.slice(0, tk.indexOf("|"))) : undefined, art = g && re ? zaehlerArt(g, re) : null;
    if(!art || x.value.trim() === "" || lage !== "da") return;
    if(zaehlerSetzen(tk, x.dataset.zId, +x.value, art.proPunkt)){ termin = tk; speichern(); }
    return;
  }
  if(x.id === "gildeSuche"){ filter.suche = x.value; ausgabeSatz = ""; zeichnen(); return; }
  // das Formular einer Reihe: die Werte merken, gespeichert wird erst mit Anlegen
  if(reiheFeld && (x.id === "gildeRTitel" || x.id === "gildeRStart" || x.id === "gildeRBis")){ reiheWert(x); return; }
  const m = imFeld();
  if(!m || lage !== "da" || !gildeState.gilde) return;
  if(x.id === "gildeEName"){
    const v = rein(x.value, 24);
    if(!v) return;   // ein leerer Name wird nie gespeichert; der alte gilt weiter
    m.name = v;
    if(m === entwurf){
      // die Datei fasst hoechstens 100: ist sie inzwischen voll (etwa ueber "Aus der Gruppe"), bleibt der Entwurf draussen
      if(!platz()){ zeichnen(); return; }
      gildeState.gilde.mitglieder.push(m); entwurf = null;
    }
  }
  else if(x.id === "gildeENotiz"){
    m.notiz = rein(x.value, 120);
    if(m === entwurf) return;
  }
  else return;
  undo = null; meldung = "";
  listeNeu();
  speichern();
}
function reiheWert(x: HTMLInputElement | HTMLSelectElement){
  const f = reiheFeld!;
  if(x.id === "gildeRTitel") f.titel = x.value;
  else if(x.id === "gildeRStart") f.start = x.value;
  else if(x.id === "gildeRBis") f.bis = x.value;
  else if(x.id === "gildeRDauer") f.dauerMin = +x.value;
  else if(x.id === "gildeRErin") f.erinnerungMin = +x.value;
  else if(x.id === "gildeRWdh" && (ARTEN as string[]).includes(x.value)){
    f.art = x.value as Wdh["art"];
    // "an Wochentagen" beginnt mit dem Wochentag des ersten Termins
    if(f.art === "tage" && !f.tage.length && START_RX.test(f.start)) f.tage = [wochentag(f.start.slice(0, 10))];
    fokus = "rwdh";
    zeichnen();
  }
}
function aendern(e: Event){
  const x = e.target as HTMLInputElement | HTMLSelectElement;
  if(x.id === "gildeEAlsDps"){
    const m = imFeld();
    if(m && lage === "da"){ m.alsDps = (x as HTMLInputElement).checked; if(m !== entwurf) speichern(); fokus = "ealsdps"; zeichnen(); }
    return;
  }
  if(x.classList.contains("gl-zin")){ setTimeout(zeichnen, 0); return; }
  if(gildeState.tab === "punkte" && x.id.startsWith("gildeP")){
    if(/^gildeP(R[A-Z]|Art|Event)/.test(x.id)) regelnAendern(x);
    else if(x instanceof HTMLInputElement) punkteAendern(x);
    return;
  }
  if(reiheFeld && /^gildeR(Titel|Start|Bis|Dauer|Erin|Wdh)$/.test(x.id)){ reiheWert(x); return; }
  if(x.id === "gildeAReihe" || x.id === "gildeASort"){
    if(x.id === "gildeAReihe") auswahl.reihe = x.value;
    else if((SORTIERUNGEN as string[]).includes(x.value)) auswahl.sort = x.value as Sortierung;
    ausgabeSatz = "";
    zeichnen();
    return;
  }
  if(x.id === "gildeERolle"){
    const m = imFeld();
    if(!m) return;
    m.rolle = x.value as Rolle;
    fokus = "erolle";
    if(m !== entwurf) speichern();
    zeichnen();
  }
  else if(x.id === "gildeEName"){
    // das Feld zeigt, was gilt: ein geleerter Name steht wieder da
    const m = imFeld();
    if(m && m !== entwurf && !rein(x.value, 24)) x.value = m.name;
  }
}
function absenden(e: SubmitEvent){
  const f = e.target as HTMLFormElement;
  if(f.id === "gildeRForm"){ e.preventDefault(); reiheAnlegen(); zeichnen(); return; }
  if(f.id === "gildeVForm"){
    e.preventDefault();
    const tk = f.closest<HTMLElement>("[data-tk]")?.dataset.tk || "";
    const v = f.querySelector<HTMLInputElement>("#gildeVZeit")?.value || "";
    if(lage !== "da" || !gildeState.gilde || !tk || !ZEIT_RX.test(v)){ f.querySelector<HTMLInputElement>("#gildeVZeit")?.focus(); return; }
    if(ausnahme(tk, {zeit: v})) speichern();
    verschieben = false; fokus = "verschieben";
    zeichnen();
    return;
  }
  if(f.id !== "gildeNeu") return;
  e.preventDefault();
  const i = f.querySelector<HTMLInputElement>("#gildeNeuName")!;
  const name = rein(i.value, 24);
  if(lage !== "da" || gildeState.gilde || !name){ i.focus(); return; }
  gildeState.gilde = {id: neueId("g"), name, mitglieder: [], reihen: [], anwesend: {}};
  gildeState.tab = "termine";
  fokus = "tab:termine";
  speichern();
  zeichnen();
}
/** Schnelltasten ausserhalb von Eingaben: / Suche, 1-4 Reiter, N neues Mitglied, G Datum; im Zaehler + und -, in den Marken D und N. */
function kuerzel(e: KeyboardEvent, x: HTMLElement): boolean {
  if(e.ctrlKey || e.metaKey || e.altKey || lage !== "da" || !gildeState.gilde) return false;
  const k = e.key;
  if(x.classList.contains("gl-zin")){
    const knopf = k === "+" ? "zPlus" : k === "-" ? "zMinus" : "";
    if(!knopf) return false;
    e.preventDefault();
    x.closest(".gl-zaehler")?.querySelector<HTMLButtonElement>('[data-g="' + knopf + '"]')?.click();
    return true;
  }
  const mg = x.closest<HTMLElement>(".gl-marken");
  if(mg && (k === "d" || k === "n")){
    const tk = mg.closest<HTMLElement>("[data-tk]")?.dataset.tk, mid = mg.dataset.mId;
    if(!tk || !mid) return false;
    e.preventDefault();
    reiheUndo = null; meldung = ""; puls = true;
    if(markeSetzen(tk, mid, k === "d" ? "da" : "fehlt")) speichern();
    termin = tk;
    // der Aufruf geht von Mitglied zu Mitglied: der Fokus wandert zur naechsten Gruppe
    const gs = [...document.querySelectorAll<HTMLElement>("#gildeFlaeche .gl-marken")], weiter = gs[gs.indexOf(mg) + 1]?.querySelector<HTMLElement>('[tabindex="0"]');
    fokus = weiter?.dataset.f || "a:" + mid + ":" + (k === "d" ? "da" : "fehlt");
    zeichnen();
    return true;
  }
  if(x.matches("input,select,textarea,[contenteditable]") || e.shiftKey) return false;
  if(k === "/" && !document.getElementById("gildeFilter")?.hidden){ e.preventDefault(); document.getElementById("gildeSuche")?.focus(); return true; }
  if(k >= "1" && k <= "4"){ e.preventDefault(); reiterWaehlen(REITER[+k - 1]!); return true; }
  if(k === "n" && gildeState.tab === "mitglieder"){ e.preventDefault(); document.getElementById("gildeMNeu")?.click(); return true; }
  if(k === "g" && gildeState.tab === "termine"){ e.preventDefault(); document.getElementById("gildeDSuche")?.focus(); return true; }
  return false;
}
/* Pfeiltasten: Reiter und Rollen waehlen mit dem Fokus, in einer Waffengruppe wandert nur der Fokus. */
function taste(e: KeyboardEvent){
  const x = e.target as HTMLElement;
  if(kuerzel(e, x)) return;
  if((x.id === "gildeEName" || x.id === "gildeENotiz") && e.key === "Enter"){ e.preventDefault(); feldSchliessen(); zeichnen(); return; }
  if(e.key === "Enter" && x.classList.contains("gl-zin")){
    e.preventDefault();
    const felder = [...document.querySelectorAll<HTMLInputElement>("#gildeTermin .gl-zin")];
    felder[felder.indexOf(x as HTMLInputElement) + 1]?.focus();
    return;
  }
  // Punkte: Enter in der Sonntagsrunde springt zum naechsten Feld, in einem Formular legt es an, Esc schliesst die Sonntagsrunde
  if(e.key === "Enter" && x.dataset.pSonn !== undefined){
    e.preventDefault();
    const felder = [...document.querySelectorAll<HTMLInputElement>("#gildePSonntag [data-p-sonn]")];
    felder[felder.indexOf(x as HTMLInputElement) + 1]?.focus();
    return;
  }
  if(e.key === "Enter" && (x.id === "gildePAnsDatum" || x.id === "gildePAnsBetrag" || x.id === "gildePZusPunkte" || x.id === "gildePZusNotiz")){
    e.preventDefault();
    document.querySelector<HTMLButtonElement>(x.id.startsWith("gildePAns") ? '[data-g="pAnsAdd"]' : '[data-g="pZusAdd"]')?.click();
    return;
  }
  if(e.key === "Escape" && x.closest("#gildePSonntag")){ e.preventDefault(); sonntagOffen = false; fokus = "psonntag"; zeichnen(); return; }
  // Esc irgendwo im Feld schliesst es wie Fertig: der Fokus geht an die Kachel, beim Entwurf an "+ Mitglied"
  if(e.key === "Escape" && x.closest("#gildeEdit")){ e.preventDefault(); feldSchliessen(); zeichnen(); return; }
  // ebenso das Formular einer Reihe (Fokus an "+ Reihe" oder "Aendern") und das Feld Verschieben (Fokus an Verschieben)
  if(e.key === "Escape" && x.closest("#gildeReihe")){ e.preventDefault(); reiheSchliessen(); zeichnen(); return; }
  if(e.key === "Escape" && x.closest("#gildeVerschieben")){ e.preventDefault(); verschieben = false; fokus = "verschieben"; zeichnen(); return; }
  // Marken: links/rechts waehlen wie bei einem Radio, auf/ab wechselt das Mitglied (ein Tabstopp je Gruppe)
  const mg = x.closest<HTMLElement>(".gl-marken");
  if(mg && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)){
    e.preventDefault();
    if(e.key === "ArrowUp" || e.key === "ArrowDown"){
      const gs = [...document.querySelectorAll<HTMLElement>("#gildeFlaeche .gl-marken")];
      gs[gs.indexOf(mg) + (e.key === "ArrowUp" ? -1 : 1)]?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
      return;
    }
    const rs = [...mg.querySelectorAll<HTMLButtonElement>('[role="radio"]')], i = rs.indexOf(x as HTMLButtonElement);
    const n = e.key === "Home" ? 0 : e.key === "End" ? rs.length - 1 : (Math.max(0, i) + (e.key === "ArrowLeft" ? -1 : 1) + rs.length) % rs.length;
    const z = rs[n]!, tk = mg.closest<HTMLElement>("[data-tk]")?.dataset.tk, mid = mg.dataset.mId;
    if(!tk || !mid || lage !== "da" || !gildeState.gilde) return;
    reiheUndo = null; meldung = "";
    if(markeSetzen(tk, mid, z.dataset.marke as Gesetzt)) speichern();
    termin = tk;
    fokus = "a:" + mid + ":" + z.dataset.marke;
    zeichnen();
    return;
  }
  // Punkte: die Liste der Mitglieder ist eine Auswahlliste, auf/ab (Home, End) waehlt wie bei einem Listenfeld
  const pl = x.closest<HTMLElement>("#gildePListe, #gildePInaktiv");
  if(pl && ["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)){
    const alle = [...document.querySelectorAll<HTMLButtonElement>("#gildePListe [data-p-id], #gildePInaktiv [data-p-id]")];
    const i = alle.indexOf(x as HTMLButtonElement);
    if(i < 0) return;
    e.preventDefault();
    const n = e.key === "Home" ? 0 : e.key === "End" ? alle.length - 1 : Math.max(0, Math.min(alle.length - 1, i + (e.key === "ArrowUp" ? -1 : 1)));
    punktAuswahl = alle[n]!.dataset.pId || null;
    fokus = "p:" + punktAuswahl;
    zeichnen();
    return;
  }
  const gruppe = x.closest<HTMLElement>("#gildeTabs, #gildeRollen, #gildePFilter, #gildeAnwFilter, .gl-wb");
  if(!gruppe || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
  const alle = [...gruppe.querySelectorAll<HTMLButtonElement>("button")].filter(b => !b.disabled);
  const i = alle.indexOf(x as HTMLButtonElement);
  if(i < 0) return;
  e.preventDefault();
  const n = e.key === "Home" ? 0 : e.key === "End" ? alle.length - 1
    : (i + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + alle.length) % alle.length;
  const z = alle[n]!;
  if(gruppe.id === "gildeTabs"){ reiterWaehlen(z.dataset.gtab as Reiter); return; }
  if(gruppe.id === "gildeRollen"){ filter.rolle = (z.dataset.rolle || "") as Rolle; zeichnen(); z.focus(); return; }
  if(gruppe.id === "gildeAnwFilter"){ anwFilter = (z.dataset.af || "alle") as AnwFilter; fokus = "af:" + anwFilter; zeichnen(); return; }
  if(gruppe.id === "gildePFilter"){ punktFilter = (z.dataset.pf || "alle") as PFilter; fokus = "pf:" + punktFilter; zeichnen(); return; }
  alle.forEach(b => { b.tabIndex = b === z ? 0 : -1; });
  z.focus();
}

/* Ziehen: ein Mitglied auf die Ablage fragt, ob es ausgetreten ist (wie Loesen); mit gedrueckter Maus ueber mehrere Marken
   streichen setzt dieselbe Marke bei allen. Beides hat die Tastatur als Gegenstueck (Loesen, Pfeiltasten). */
function ablageZeigen(an: boolean){
  const a = document.getElementById("gildeAblage");
  if(a){ a.hidden = !an; a.classList.remove("ueber"); }
}
function ziehStart(e: DragEvent){
  const k = (e.target as HTMLElement).closest<HTMLElement>(".gl-kachel[data-m-id]");
  if(!k || !e.dataTransfer || gildeState.tab !== "mitglieder") return;
  e.dataTransfer.setData("text/plain", k.dataset.mId || "");
  e.dataTransfer.effectAllowed = "move";
  ablageZeigen(true);
}
function ziehUeber(e: DragEvent){
  const a = (e.target as HTMLElement).closest<HTMLElement>("#gildeAblage");
  if(!a) return;
  e.preventDefault();
  a.classList.add("ueber");
}
function ziehAb(e: DragEvent){
  const a = (e.target as HTMLElement).closest<HTMLElement>("#gildeAblage");
  if(!a) return;
  e.preventDefault();
  const id = e.dataTransfer?.getData("text/plain") || "", m = aktive().find(x => x.id === id);
  ablageZeigen(false);
  if(!m || lage !== "da") return;
  entwurf = null; bearbeiten = id; wahl = m.waffen.length === 2 ? [m.waffen[0]!, m.waffen[1]!] : [null, null];
  offWahl = m.offspec && m.offspec.length === 2 ? [m.offspec[0]!, m.offspec[1]!] : [null, null];
  austrittFrage = id; fokus = "austrJa"; undo = null; meldung = "";
  zeichnen();
}
function pinselStart(e: PointerEvent){
  const b = (e.target as HTMLElement).closest<HTMLElement>(".gl-marken [role=radio]");
  const mg = b?.closest<HTMLElement>(".gl-marken"), tk = mg?.closest<HTMLElement>("[data-tk]")?.dataset.tk;
  if(!b || !mg || !tk || e.button !== 0 || e.pointerType === "touch" || lage !== "da") return;
  pinsel = {tk, marke: b.dataset.marke as Gesetzt, start: mg.dataset.mId || "", ids: new Set()};
}
function pinselBewegt(e: PointerEvent){
  if(!pinsel) return;
  const mg = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(".gl-marken"), mid = mg?.dataset.mId;
  if(!mg || !mid || mid === pinsel.start || pinsel.ids.has(mid)) return;
  pinsel.ids.add(mid);
  mg.closest(".gl-anw")?.classList.add("vor");
}
function pinselEnde(){
  const p = pinsel;
  pinsel = null;
  if(!p || !p.ids.size || lage !== "da" || !gildeState.gilde) return;
  reiheUndo = null; meldung = ""; puls = true;
  let neu = markeSetzen(p.tk, p.start, p.marke);
  p.ids.forEach(id => { if(markeSetzen(p.tk, id, p.marke)) neu = true; });
  if(neu) speichern();
  termin = p.tk;
  zeichnen();
  ansage(t("gilde.termin.pinsel", {n: p.ids.size + 1, marke: t("gilde.marke." + p.marke)}));
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  const box = document.getElementById("gildeInhalt");
  if(box){
    box.addEventListener("click", klick);
    box.addEventListener("input", eingabe);
    box.addEventListener("change", aendern);
    box.addEventListener("submit", absenden);
    box.addEventListener("keydown", taste);
    box.addEventListener("dragstart", ziehStart);
    box.addEventListener("dragover", ziehUeber);
    box.addEventListener("drop", ziehAb);
    box.addEventListener("dragend", () => ablageZeigen(false));
    box.addEventListener("pointerdown", pinselStart);
    const lichtZiel = ".gl-saal, .gl-kachel, .gl-anw, .gl-karte, .gl-p-co, .gl-spalte, .gl-p-cp";
    let lichtRaf = 0;
    document.getElementById("gilde")?.addEventListener("pointermove", e => {
      if(lichtRaf) return;
      const z = (e.target as HTMLElement).closest<HTMLElement>(lichtZiel);
      if(!z) return;
      lichtRaf = requestAnimationFrame(() => {
        lichtRaf = 0;
        const r = z.getBoundingClientRect();
        z.style.setProperty("--mx", (e.clientX - r.left) + "px");
        z.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
    // die Kuerzel gelten auch, wenn der Fokus auf dem Fensterhintergrund liegt (nichts anderes hat ihn)
    addEventListener("keydown", e => { const x = e.target as HTMLElement; if(offen && (x === document.body || x.id === "stage") && !box.contains(x)) kuerzel(e, x); });
    addEventListener("pointermove", pinselBewegt);
    addEventListener("pointerup", pinselEnde);
    addEventListener("pointercancel", () => { pinsel = null; });
    if(!document.getElementById("gildeAnsage")){
      const a = document.createElement("span");
      a.id = "gildeAnsage"; a.className = "vh"; a.setAttribute("role", "status");
      box.parentElement?.before(a);
    }
  }
  addEventListener("pagehide", beimVerlassen);
  if(!SERVED) lage = "nurApp";
  else laden();
}
