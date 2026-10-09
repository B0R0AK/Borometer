import { state } from "./01-state";
import { t } from "./08-translation";
import { WEAPON_ICON, weaponLabel, weaponMark } from "./09-weapon-icons";
import { cssv, esc } from "./18-interface-basics";
import { gruppenNamen } from "./19-grouping-and-party-fights";
import { SERVED } from "./41-server-mode";
import { auswerten, filtern, ics, icsAlle, rolleVon, termine, terminSchluessel, textAusgabe, wandUhr, type Gilde, type Marke, type Mitglied, type Reihe, type Rolle, type Termin,
  type Wdh, type Zeile } from "../gilde-core";
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
   "+ Mitglied", "Aus der Gruppe uebernehmen" (nur Namen, die diese Sitzung
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
   da / entschuldigt; ein zweiter Druck auf die gewaehlte Marke setzt
   "offen" zurueck, nie wird ein Schluessel entfernt. Pfeil links/rechts
   waehlt in der Gruppe, Pfeil auf/ab wechselt das Mitglied. Ausfallen,
   Zuruecknehmen und Verschieben (nur die Uhrzeit) schreiben die Ausnahme
   unter dem urspruenglichen Datum; die Anwesenheit bleibt dort. Eine Reihe
   wird geloest, nie entfernt, und Rueckgaengig holt sie zurueck.

   Auswertung (Plan Aufgabe 7; Entscheidung 07.10.2026): je Mitglied eine Karte mit
   dem Ring der Quote, Waffenpaar, Klasse und den Zahlen Dabei, Straehne und
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
type Reiter = "termine" | "mitglieder" | "auswertung";
type Speicher = "" | "nie" | "spaeter";
/** Wie die Datei (gilde.ts): der ganze Stand als JSON hoechstens 2 097 152 Zeichen (Entscheidung 07.10.2026). */
const MAX_TEXT = 2097152;
const REITER: Reiter[] = ["termine", "mitglieder", "auswertung"];
const ROLLEN: Rolle[] = ["tank", "heal", "dps"];
/** Wie die Datei (gilde.ts): hoechstens 100 Mitglieder, geloeste zaehlen mit. */
const MAX_MITGLIEDER = 100;

export const gildeState: { gilde: Gilde | null; tab: Reiter } = { gilde: null, tab: "termine" };
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
/** Offene Liste "Aus der Gruppe uebernehmen" und die angehakten Namen. */
let uebernahme: string[] | null = null;
const uebWahl = new Set<string>();
/** Ein kurzer Satz nach einer Handlung (etwa "2 Mitglieder uebernommen."). */
let meldung = "";
let speicher: Speicher = "";
/** Wie voll die Datei mit dem Stand der Seite waere: ueber 90 % ein Satz, ueber der Grenze wird nicht gesendet. */
let groesse: "" | "fast" | "ueber" = "";
function groesseMessen(): string {
  const text = JSON.stringify({v: 1, gilde: gildeState.gilde});
  groesse = text.length > MAX_TEXT ? "ueber" : text.length > MAX_TEXT * 0.9 ? "fast" : "";
  return text;
}
/** Das Element (data-f), das nach dem naechsten Zeichnen den Fokus bekommt. */
let fokus: string | null = null;

const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
/* Was der Speicher annimmt (gilde.ts): keine Steuerzeichen, ohne Rand, hoechstens n Zeichen. */
function rein(s: string, n: number): string {
  return [...s.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "").trim()].slice(0, n).join("").trim();
}
/** Eine neue Kennung: der Buchstabe und 9 Zeichen [0-9a-z] aus crypto.getRandomValues. */
export function neueId(p: "g" | "m" | "r"): string {
  const z = "0123456789abcdefghijklmnopqrstuvwxyz";
  for(;;){
    const b = new Uint8Array(9);
    crypto.getRandomValues(b);
    const id = p + [...b].map(x => z[x % 36]).join("");
    const g = gildeState.gilde;
    if(!g || ![g.id, ...g.mitglieder.map(m => m.id), ...g.reihen.map(r => r.id)].includes(id)) return id;
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
function laden(){
  if(!SERVED || ladeTimer) return;
  fetch("/api/gilde").then(r => r.status === 404 ? "ohne" : r.ok ? r.json() : null).then((d: unknown) => {
    if(d === "ohne"){ lage = "nurApp"; return zeichnen(); }
    const g = isRec(d) && d.ok === true ? gildeVon(d.data) : undefined;
    if(g === undefined){ lage = "gesperrt"; zeichnen(); return spaeterLaden(); }
    gildeState.gilde = g; lage = "da"; ladeVersuch = 0;
    if(g) groesseMessen();
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
  if(lage !== "da" || !gildeState.gilde) return;
  if(sendeTimer) clearTimeout(sendeTimer);
  sendeTimer = setTimeout(senden, 500);
}
function senden(keepalive = false){
  sendeTimer = null;
  if(lage !== "da" || !gildeState.gilde) return;
  // ueber der Grenze lehnte die Datei ab: nicht senden, sondern sagen, was zu tun ist (statusSetzen)
  const text = groesseMessen();
  if(groesse === "ueber"){ statusSetzen(); return; }
  if(unterwegs && !keepalive){ nochmal = true; return; }
  if(wiederTimer){ clearTimeout(wiederTimer); wiederTimer = null; }
  unterwegs = true;
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
/** Die Zeile unter dem Namen: Rolle als Symbol und die Klasse, ohne Paar die Rolle als Wort. */
function klasseZeile(m: Mitglied): string {
  const r = rolleVon(m), k = klasseName(m.waffen);
  const wort = k || (r ? t("gilde.rolle." + r) : t("gilde.ohneWaffen"));
  return '<span class="gl-klasse">' + (r ? ROLLE_SYM[r] : "") + esc(wort) + "</span>";
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
function kopfSetzen(){
  const g = lage === "da" ? gildeState.gilde : null;
  const name = document.getElementById("gildeName"), n = document.getElementById("gildeNaechster");
  if(name) name.textContent = g ? g.name : "";
  if(!n) return;
  const jetzt = wandUhr(Date.now()), x = g ? naechster(g, jetzt) : null;
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
  return '<li><button type="button" class="gl-kachel' + (an ? " sel" : "") + '" data-m-id="' + m.id + '" data-g="bearbeiten" data-f="b:' + m.id +
    '" aria-label="' + esc(vorlesen) + '"' + (an ? ' aria-controls="gildeEdit" aria-expanded="true"' : ' aria-expanded="false"') + '><span class="gl-kopf">' + paar(m.waffen) +
    '<span class="gl-txt"><span class="gl-name">' + esc(m.name) + "</span>" + klasseZeile(m) + "</span></span></button></li>";
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
  return '<section class="gl-edit" id="gildeEdit" aria-labelledby="gildeEditT"><h3 id="gildeEditT">' + esc(titel) + "</h3>" +
    '<div class="gl-eform"><div class="gl-waffen">' +
      '<div class="field"><label for="gildeEName">' + esc(t("gilde.mitglied.name")) + '</label><input id="gildeEName" data-f="ename" maxlength="24" autocomplete="off" spellcheck="false" value="' + esc(m.name) + '"></div>' +
      '<div class="field"><label for="gildeENotiz">' + esc(t("gilde.mitglied.notiz")) + '</label><input id="gildeENotiz" data-f="enotiz" maxlength="120" autocomplete="off" placeholder="' +
        esc(t("gilde.mitglied.notizPh")) + '" value="' + esc(m.notiz) + '"></div>' +
    '</div><div class="gl-waffen">' + wahlReihe(1) + wahlReihe(2) + ergebnis + "</div></div>" +
    '<div class="gl-eaus">' + knopf("btn sm hot", 'data-g="fertig" data-f="fertig"', t("gilde.mitglied.fertig")) +
      (neu ? "" : knopf("btn sm", 'data-g="loesen" data-f="eloesen"', t("gilde.mitglied.loesen"))) + "</div></section>";
}
function uebernahmeHtml(): string {
  if(!uebernahme) return "";
  const kopf = '<section class="gl-edit" id="gildeUebernahme" aria-labelledby="gildeUebT"><h3 id="gildeUebT">' + esc(t("gilde.mitglied.ausGruppe")) + "</h3>";
  const ab = knopf("btn sm", 'data-g="uebAbbrechen" data-f="uebab"', t("gilde.ausGruppe.abbrechen"));
  if(!uebernahme.length) return kopf + '<p class="gl-note">' + esc(t("gilde.ausGruppe.alle")) + '</p><div class="gl-eaus">' + ab + "</div></section>";
  return kopf + '<p class="gl-note" id="gildeUebSatz">' + esc(t("gilde.ausGruppe.satz")) + '</p><ul class="gl-namen" aria-describedby="gildeUebSatz">' +
    uebernahme.map((n, i) => '<li><label><input type="checkbox" data-name="' + esc(n) + '" data-f="u:' + i + '"' + (uebWahl.has(n) ? " checked" : "") + ">" + esc(n) + "</label></li>").join("") +
    '</ul><div class="gl-eaus">' + knopf("btn sm hot", 'data-g="uebernehmen" data-f="ueb"', t("gilde.ausGruppe.ok")) + ab + "</div></section>";
}
function mitgliederHtml(): string {
  const g = gildeState.gilde!;
  const voll = !platz(), gruppe = gruppenNamen().length > 0;
  const hilfe = !gruppe ? '<p class="gl-hilfe" id="gildeAusGruppeSatz">' + esc(t("gilde.ausGruppe.keine")) + "</p>"
    : voll ? '<p class="gl-hilfe" id="gildeMaxSatz">' + esc(t("gilde.mitglied.max")) + "</p>" : "";
  const kopf = '<div class="gl-akopf"><h3>' + esc(t("gilde.tab.mitglieder")) + "</h3>" +
    '<button type="button" class="btn sm" id="gildeAusGruppe" data-g="ausGruppe" data-f="aus"' + (!gruppe || voll ? " disabled" : "") +
      (!gruppe ? ' aria-describedby="gildeAusGruppeSatz"' : voll ? ' aria-describedby="gildeMaxSatz"' : "") + ">" + esc(t("gilde.mitglied.ausGruppe")) + "</button>" +
    '<button type="button" class="btn sm hot" id="gildeMNeu" data-g="neu" data-f="neu"' + (voll ? ' disabled aria-describedby="gildeMaxSatz"' : "") + ">" + esc(t("gilde.mitglied.neu")) + "</button>" +
    hilfe + "</div>";
  const weg = undo ? g.mitglieder.find(m => m.id === undo && m.geloest) : null;
  const undoHtml = weg ? '<p class="gl-meldung" id="gildeUndo"><span>' + esc(t("gilde.mitglied.geloest", {name: weg.name})) + "</span>" +
    knopf("btn sm", 'data-g="undo" data-f="undo"', t("gilde.mitglied.rueckgaengig")) + "</p>" : "";
  const satz = meldung ? '<p class="gl-meldung">' + esc(meldung) + "</p>" : "";
  const m = imFeld();
  return kopf + undoHtml + satz + uebernahmeHtml() + '<div id="gildeListe">' + listeHtml() + "</div>" + (m ? feldHtml(m) : "") +
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
type Gesetzt = "da" | "fehlt" | "entschuldigt";
const MARKEN: Gesetzt[] = ["da", "fehlt", "entschuldigt"];
const MARKE_SYM: Record<Gesetzt, string> = {
  da: ic('<path d="M5 12.5l4.2 4.2L19 7"/>'),
  fehlt: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
  entschuldigt: ic('<circle cx="12" cy="12" r="8"/><path d="M7 17L17 7"/>'),
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
const abgehaktZahl = (g: Gilde, key: string) => { const z = g.anwesend[key] || {}; return aktive().filter(m => (z[m.id] ?? "offen") !== "offen").length; };
function terminZeile(g: Gilde, r: Reihe, tm: Termin, jetzt: string, nx: string, akt: string): string {
  const key = terminSchluessel(tm), von = tm.start.slice(11, 16), zeit = r.start.slice(11, 16);
  const notiz = [datumKurz(tm.datum), key === nx ? t("gilde.termin.naechster") : "", von !== zeit ? t("gilde.termin.verschoben", {zeit}) : ""].filter(Boolean).join(" \u00b7 ");
  const n = abgehaktZahl(g, key);
  const stand = tm.aus ? t("gilde.termin.faelltAus")
    : tm.start > jetzt ? t("gilde.inZeit", {z: restzeit(Math.max(0, Math.round((wandMs(tm.start) - wandMs(jetzt)) / 60000)))})
    : n ? t("gilde.termin.abgehakt", {n, m: aktive().length}) : t("gilde.termin.vergangen");
  return '<li><button type="button" class="gl-term' + (tm.aus ? " aus" : "") + '" data-g="termin" data-termin="' + key + '" data-datum="' + tm.datum + '" data-f="t:' + key + '"' +
    (key === akt ? ' aria-current="true"' : "") + '><span class="gl-chip" aria-hidden="true"><b>' + tm.datum.slice(8, 10) + "</b><small>" + esc(wtKurz(wochentag(tm.datum))) + "</small></span>" +
    '<span class="wann"><span><span class="vh">' + esc(t("gilde.tag." + wochentag(tm.datum))) + " </span>" + esc(t("gilde.termin.zeit", {von, bis: zeitPlus(tm.start, r.dauerMin)})) + "</span>" +
    '<small class="gl-tnote">' + esc(notiz) + '</small></span><span class="stand">' + esc(stand) + "</span></button></li>";
}
function agendaHtml(g: Gilde, jetzt: string, akt: string): string {
  const nx = naechster(g, jetzt)?.key || "", voll = g.reihen.length >= MAX_REIHEN;
  const reihen = g.reihen.filter(r => !r.geloest);
  const weg = reiheUndo ? g.reihen.find(r => r.id === reiheUndo && r.geloest) : null;
  const undoHtml = weg ? '<p class="gl-meldung" id="gildeRUndo"><span>' + esc(t("gilde.reihe.geloest", {titel: weg.titel})) + "</span>" +
    knopf("btn sm", 'data-g="reiheUndo" data-f="rundo"', t("gilde.mitglied.rueckgaengig")) + "</p>" : "";
  return undoHtml + '<section class="gl-agenda" aria-labelledby="gildeAgendaT"><h3 id="gildeAgendaT">' + esc(t("gilde.reihen")) + "</h3>" +
    (reihen.length ? "" : '<p class="gl-leer">' + esc(t("gilde.reihe.leer")) + "</p>") +
    reihen.map(r => {
      const l = liste(r, jetzt);
      return '<div class="gl-reihe" data-r-id="' + r.id + '"><p class="gl-reihenkopf"><b>' + esc(r.titel) + "</b><small>" + esc(regel(r)) + "</small>" +
        '<button type="button" class="btn sm" data-g="reiheAendern" data-r-id="' + r.id + '" data-f="ra:' + r.id + '" aria-label="' + esc(t("gilde.reihe.aendernT", {titel: r.titel})) + '">' +
        esc(t("gilde.reihe.aendern")) + '</button></p><ul class="gl-liste">' + [...l.kommend.slice().reverse(), ...l.vergangen].map(tm => terminZeile(g, r, tm, jetzt, nx, akt)).join("") + "</ul>" +
        (l.mehr ? '<p class="gl-fuss">' + knopf("btn sm", 'data-g="aelter" data-r-id="' + r.id + '" data-f="alt:' + r.id + '"', t("gilde.termin.aelter")) + "</p>" : "") + "</div>";
    }).join("") +
    '<p class="gl-fuss"><button type="button" class="btn sm" id="gildeRNeu" data-g="reiheNeu" data-f="rneu"' + (voll ? ' disabled aria-describedby="gildeRMax"' : "") + ">" +
      esc(t("gilde.reihe.neu")) + "</button>" + (voll ? '<span id="gildeRMax">' + esc(t("gilde.reihe.max")) + "</span>" : "") + "</p></section>";
}
function anwKachel(m: Mitglied, datum: string, marke: Marke | undefined): string {
  const mk: Gesetzt | "" = marke && marke !== "offen" ? marke : "";
  const stopp = mk || "da";
  return '<li><div class="gl-anw" data-m="' + mk + '"><span class="gl-kopf"><span class="gl-pp">' + paar(m.waffen) +
    '<span class="gl-plakette" aria-hidden="true">' + (mk ? MARKE_SYM[mk] : "") + "</span></span>" + '<span class="gl-txt"><span class="gl-name">' + esc(m.name) + "</span>" + klasseZeile(m) + "</span></span>" +
    '<div class="gl-marken" role="radiogroup" data-m-id="' + m.id + '" aria-label="' + esc(m.name + ", " + datumLang(datum)) + '">' +
    MARKEN.map(k => { const w = esc(t("gilde.marke." + k));
      return '<button type="button" role="radio" data-marke="' + k + '" data-f="a:' + m.id + ":" + k + '" aria-checked="' + (k === mk) + '" tabindex="' + (k === stopp ? 0 : -1) +
        '" aria-label="' + w + '" title="' + w + '">' + MARKE_SYM[k] + '<span class="wort">' + w + "</span></button>"; }).join("") + "</div></div></li>";
}
function anwesenheitHtml(g: Gilde, r: Reihe, tm: Termin): string {
  const key = terminSchluessel(tm), z = g.anwesend[key] || {};
  const wann = wtKurz(wochentag(tm.datum)) + " " + datumLang(tm.datum);
  const alle = aktive(), von = tm.start.slice(11, 16), zeit = r.start.slice(11, 16);
  const knoepfe = tm.aus ? knopf("btn sm", 'data-g="zurueck" data-f="zurueck"', t("gilde.termin.zurueck"))
    : knopf("btn sm", 'data-g="alleDa" data-f="alleDa"' + (alle.length ? "" : " disabled"), t("gilde.termin.alleDa")) +
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
  const ms = filtern(alle, filter);
  const da = (drin: Mitglied[]) => drin.filter(m => z[m.id] === "da").length;
  const offen = ms.filter(m => (z[m.id] ?? "offen") === "offen").length;
  const summe = '<ul class="gl-summe" aria-label="' + esc(t("gilde.termin.wer")) + '">' + ROLLEN.filter(rl => !filterAktiv() || ms.some(m => rolleVon(m) === rl)).map(rl => {
    const drin = ms.filter(m => rolleVon(m) === rl);
    return "<li>" + esc(t("gilde.rolle." + rl)) + " <b>" + esc(t("gilde.termin.daVon", {n: da(drin), m: drin.length})) + "</b></li>";
  }).join("") + "<li>" + esc(t("gilde.marke.offen")) + " <b>" + offen + "</b></li></ul>";
  const spalten = ms.length ? spaltenHtml(ms, m => anwKachel(m, tm.datum, z[m.id]), drin => da(drin) + "/" + drin.length, "gl-kacheln anw")
    : '<p class="gl-leer">' + esc(t("gilde.keinTreffer")) + "</p>";
  return kopf + satz + feld + summe + spalten + '<p class="gl-fuss">' + esc(t("gilde.termin.fuss")) + "</p>";
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
    termin = null;
    fokus = "ra:" + r.id;
  }
  else if(!e.id){
    if(g.reihen.length >= MAX_REIHEN) return;
    const r: Reihe = {id: neueId("r"), titel, start: e.start, zone: zone(), wdh, dauerMin: e.dauerMin, erinnerungMin: e.erinnerungMin, ausnahmen: {}};
    g.reihen.push(r);
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
  else if(a === "termin"){ termin = b.dataset.termin || null; verschieben = false; reiheFeld = null; fokus = "t:" + termin; }
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
    // nur offene (auch die, die der Filter ausblendet); "nicht da" und "entschuldigt" bleiben, geloeste nie
    const z = g.anwesend[tk] || {};
    for(const m of aktive()) if((z[m.id] ?? "offen") === "offen" && markeSetzen(tk, m.id, "da")) n++;
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
  return {zeilen, gezaehlt: zs.some(z => z.da + z.fehlt + z.entschuldigt > 0), reihe};
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
  const ent = z.entschuldigt ? t("gilde.ausw.entschuldigt", {n: z.entschuldigt}) : "";
  const satz = q === null ? t("gilde.ausw.zeileOffen", {name: m.name, e: ent ? ", " + ent : ""})
    : t("gilde.ausw.zeile", {name: m.name, q, s: z.straehne, d: z.letzte ? datumSprache(z.letzte) : t("gilde.ausw.nie"), e: ent ? ", " + ent : ""});
  const zahl = (k: string, v: string) => "<div><dt>" + esc(t("gilde.ausw." + k)) + "</dt><dd>" + esc(v) + "</dd></div>";
  return '<li class="gl-karte" data-m-id="' + m.id + '"><span class="vh">' + esc(satz) + '</span><div aria-hidden="true">' +
    '<span class="gl-ring">' + quoteRing(z.quote) + "<b>" + (q === null ? "\u2013" : q + "<small>\u00a0%</small>") + "</b></span>" +
    '<span class="gl-kopf">' + paar(m.waffen) + '<span class="gl-txt"><span class="gl-name">' + esc(m.name) + "</span>" + klasseZeile(m) +
      (ent ? '<span class="gl-note">' + esc(ent) + "</span>" : "") + "</span></span>" +
    '<dl class="gl-zahlen">' + zahl("dabei", z.da + z.fehlt ? z.da + "/" + (z.da + z.fehlt) : "\u2013") + zahl("straehne", String(z.straehne)) +
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

/* ---------- Das Bild: eine Leinwand wie in 50-bild.ts (Palatino, Farben des Themas, doppelte Dichte) ---------- */
const BILD_W = 480, BILD_DPR = 2, BRAND = 20, BZEILE = 24;
/** Die rechten Kanten der Zahlenspalten im Bild. */
const BSPALTEN: [string, number][] = [["quote", 264], ["dabei", 334], ["straehne", 396], ["zuletzt", BILD_W - BRAND]];
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
    const werte = [q, z.da + z.fehlt ? z.da + "/" + (z.da + z.fehlt) : "\u2013", String(z.straehne), z.letzte ? datumSprache(z.letzte) : "\u2013"];
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
    bildUnter(a), a.zeilen.map(({m, z}) => [m.id, m.name, m.waffen, z.quote, z.da, z.fehlt, z.straehne, z.letzte])]);
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
    treffer: trefferWort(a), straehne: t("gilde.ausw.straehne"), zuletzt: t("gilde.ausw.text.zuletzt"), entschuldigt: t("gilde.ausw.text.entschuldigt"),
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
function flaecheHtml(): string {
  if(lage === "nurApp") return '<div class="wbox wkleer">' + SYMBOL + '<p class="wksatz gl-nurapp">' + esc(t("gilde.nurApp")) + "</p></div>";
  if(lage === "laden") return '<p class="wksatz">' + esc(t("gilde.laden")) + "</p>";
  if(lage === "gesperrt") return '<p class="wksatz wkgesperrt">' + esc(t("gilde.gesperrt")) + "</p>";
  if(!gildeState.gilde) return '<div class="wbox wkleer">' + SYMBOL + '<p class="wksatz">' + esc(t("gilde.anlegenSatz")) + "</p>" +
    '<form class="wkform" id="gildeNeu" novalidate><span class="field"><label for="gildeNeuName">' + esc(t("gilde.name")) + "</label>" +
    '<input id="gildeNeuName" data-f="gneu" maxlength="24" autocomplete="off" spellcheck="false"></span>' +
    '<button type="submit" class="btn sm hot">' + esc(t("gilde.anlegen")) + "</button></form></div>";
  if(gildeState.tab === "mitglieder") return mitgliederHtml();
  if(gildeState.tab === "termine") return termineHtml();
  return auswertungHtml();
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
  tabs.hidden = !da; filterBox.hidden = !da;
  if(da){ reiterZeichnen(); filterZeichnen(); flaeche.setAttribute("role", "tabpanel"); flaeche.setAttribute("aria-labelledby", "gildeTab-" + gildeState.tab); }
  else { flaeche.removeAttribute("role"); flaeche.removeAttribute("aria-labelledby"); }
  // wer gerade in der Flaeche steht, steht nach dem Zeichnen wieder dort
  const a = document.activeElement as HTMLElement | null;
  const vorher = a && flaeche.contains(a) ? a.dataset.f || null : null;
  const marke: [number | null, number | null] | null = a instanceof HTMLInputElement && a.type !== "checkbox" ? [a.selectionStart, a.selectionEnd] : null;
  flaeche.innerHTML = flaecheHtml();
  const f = fokus ?? vorher;
  fokus = null;
  if(f) fokusSetzen(f, f === vorher ? marke : null);
  if(da && gildeState.tab === "auswertung") void vorschau();
  else vorschauLoesen();
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
  bearbeiten = null; entwurf = null; wahl = [null, null];
}
function loesen(id: string){
  const m = aktive().find(x => x.id === id);
  if(!m) return;
  m.geloest = true;
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
  delete m.geloest;
  fokus = "b:" + m.id;
  ansage(t("gilde.mitglied.zurueck", {name: m.name}));
  speichern();
}
function uebernehmen(){
  const g = gildeState.gilde!;
  let n = 0;
  for(const name of uebernahme || []){
    if(!uebWahl.has(name) || !platz()) continue;
    g.mitglieder.push({id: neueId("m"), name, rolle: "", waffen: [], notiz: ""});
    n++;
  }
  uebernahme = null; uebWahl.clear();
  if(n){ meldung = t("gilde.ausGruppe.fertig", {n}); ansage(meldung); speichern(); }
  fokus = "aus";
}
function klick(e: MouseEvent){
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if(!b || b.disabled || b.type === "submit") return;
  if(b.dataset.gtab){ reiterWaehlen(b.dataset.gtab as Reiter); return; }
  if(b.closest("#gildeRollen")){ filter.rolle = (b.dataset.rolle || "") as Rolle; zeichnen(); return; }
  const g = gildeState.gilde;
  if(lage !== "da" || !g) return;
  const a = b.dataset.g, id = b.closest<HTMLElement>("[data-m-id]")?.dataset.mId;
  if(a !== "undo") undo = null;
  if(a !== "reiheUndo") reiheUndo = null;
  meldung = "";
  ausgabeSatz = "";
  if(gildeState.tab === "termine"){ if(termineKlick(b, a)) zeichnen(); return; }
  if(gildeState.tab === "auswertung"){
    statusSetzen();
    if(a === "text") void textKopieren();
    else if(a === "bild") void bildKopieren();
    else if(a === "ics") icsSpeichern();
    return;
  }
  const wb = b.closest<HTMLElement>(".gl-wb");
  if(wb && b.dataset.w){
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
    bearbeiten = entwurf.id; wahl = [null, null]; uebernahme = null; fokus = "ename";
  }
  else if(a === "bearbeiten" && id){
    const m = aktive().find(x => x.id === id);
    if(!m) return;
    entwurf = null; bearbeiten = id; wahl = m.waffen.length === 2 ? [m.waffen[0]!, m.waffen[1]!] : [null, null]; fokus = "ename";
  }
  else if(a === "loesen") loesen(id || bearbeiten || "");
  else if(a === "undo") zurueckholen();
  else if(a === "fertig") feldSchliessen();
  else if(a === "ausGruppe"){
    const da = new Set(g.mitglieder.map(m => m.name.toLowerCase()));
    const namen: string[] = [];
    for(const roh of gruppenNamen()){
      const n = rein(roh, 24);
      if(n && !da.has(n.toLowerCase())){ da.add(n.toLowerCase()); namen.push(n); }
    }
    uebernahme = namen; uebWahl.clear();
    fokus = namen.length ? "u:0" : "uebab";
  }
  else if(a === "uebernehmen") uebernehmen();
  else if(a === "uebAbbrechen"){ uebernahme = null; uebWahl.clear(); fokus = "aus"; }
  else return;
  zeichnen();
}
function eingabe(e: Event){
  const x = e.target as HTMLInputElement;
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
  else if(x instanceof HTMLInputElement && x.type === "checkbox" && x.dataset.name !== undefined){
    if(x.checked) uebWahl.add(x.dataset.name); else uebWahl.delete(x.dataset.name);
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
/* Pfeiltasten: Reiter und Rollen waehlen mit dem Fokus, in einer Waffengruppe wandert nur der Fokus. */
function taste(e: KeyboardEvent){
  const x = e.target as HTMLElement;
  if((x.id === "gildeEName" || x.id === "gildeENotiz") && e.key === "Enter"){ e.preventDefault(); feldSchliessen(); zeichnen(); return; }
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
  const gruppe = x.closest<HTMLElement>("#gildeTabs, #gildeRollen, .gl-wb");
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
  alle.forEach(b => { b.tabIndex = b === z ? 0 : -1; });
  z.focus();
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
