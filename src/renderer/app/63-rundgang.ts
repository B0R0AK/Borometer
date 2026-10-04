import { state } from "./01-state";
import { t } from "./08-translation";
import { $, esc } from "./18-interface-basics";
import { persistPref } from "./27-weapons-tab";
import { switchTab } from "./34-menus-drop-and-tabs";
import { kuerzelText, uiZoomFactor } from "./37-window-size-and-overlay";
import { chooseServerDir, KOMPAKT_FENSTER, OWN_WINDOW, SERVED, serverDir } from "./41-server-mode";

/* ---------- Der Rundgang beim ersten Start (Spezifikation 02.10.2026) ----------
   Sechs Karten an den echten Bedienelementen: Log-Ordner, Live, Kampfwahl,
   Kompakt, Weeklies, "Fehler melden". Eine Karte wie ein Tooltip, kein
   Overlay: kein abgedunkelter Grund, kein Fokusfang, die App bleibt
   bedienbar. Das Ziel bekommt fuer den Schritt einen Ring in --pick
   (.rgziel) und den Satz der Karte als Beschreibung.

   Von selbst nur im eigenen Fenster der App, nie im Kompaktfenster und nie
   im Kompakt-Rueckfall, und nur, wenn die Einstellungen geantwortet haben,
   rundgangGesehen nicht true ist, es ein erster Start ist (der Hauptprozess
   kannte keine Einstellung, logIndex leer; Pruefung M6), die Seite fertig
   gezeichnet ist (body[data-bereit]) und auf Start steht. Ob er kam, steht
   in #rundgang[data-von-selbst] ("ja"/"nein"), sobald es entschieden ist.
   Auf Wunsch jederzeit ueber "Rundgang zeigen" (Einstellungen, Info), auch
   im Browser; er wechselt nach Start und beginnt bei Schritt 1.

   Gesehen heisst "Fertig" oder "Ueberspringen" (auch Esc in der Karte):
   dann, und nur in der App, wird rundgangGesehen gemerkt (schliessen). Der
   Schritt lebt nur in der Sitzung. Der Teil fragt nichts ab (Audit). */

type Schritt = { ziel: string; titel: string; wo: string };
const SCHRITTE: Schritt[] = [
  { ziel: "#btnPickFolder", titel: "tour.s1.titel", wo: "tour.wo.start" },
  { ziel: "#btnWatch", titel: "tour.s2.titel", wo: "tour.wo.titel" },
  { ziel: "#kwKnopf", titel: "tour.s3.titel", wo: "tour.wo.titel" },
  { ziel: "#btnCompact", titel: "tour.s4.titel", wo: "tour.wo.titel" },
  { ziel: '#bereiche [data-tab="weeklies"]', titel: "tour.s5.titel", wo: "tour.wo.leiste" },
  { ziel: "#sbFehler", titel: "tour.s6.titel", wo: "tour.wo.status" },
];
const RAND = 8;        // Abstand zum Fensterrand, gemalte Punkte
const LUFT = 14;       // Abstand der Karte zum Ziel (der Pfeil steht darin)
const SCHMAL = 640;    // darunter steht die Karte unten oder oben, ueber die volle Breite rechts der Symbolleiste

/* Was die Karte nicht verdecken soll (Pruefung M3, M4): das Ziel ganz, den
   Hinweis mit dem Pfad auf Start ganz, und die Mitte jedes Knopfs auf Start,
   in der Titel-, der Symbol- und der Statusleiste. Gemalte Punkte. */
type Kasten = { l: number; t: number; r: number; b: number };
function schutz(ziel: HTMLElement | null): { flaechen: Kasten[]; punkte: [number, number][] } {
  const kasten = (e: Element): Kasten => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const flaechen: Kasten[] = [];
  if(ziel) flaechen.push(kasten(ziel));
  const hinweis = document.querySelector("#landHinweis");
  if(hinweis && hinweis.getClientRects().length) flaechen.push(kasten(hinweis));
  const punkte: [number, number][] = [];
  for(const b of document.querySelectorAll<HTMLElement>("#land button, header.top button, #bereiche button, #statusleiste button")){
    if(!b.getClientRects().length || (karte && karte.contains(b))) continue;
    const k = kasten(b), x = (k.l + k.r) / 2, y = (k.t + k.b) / 2;
    if(x >= 0 && y >= 0 && x < innerWidth && y < innerHeight) punkte.push([x, y]);
  }
  return { flaechen, punkte };
}
/** Wie schlecht eine Lage ist: 2 deckt das Ziel, 1 deckt anderes, 0 frei. */
function deckung(x: number, y: number, w: number, h: number, ziel: HTMLElement | null, s: ReturnType<typeof schutz>): number {
  const ueber = (k: Kasten) => !(x + w <= k.l || x >= k.r || y + h <= k.t || y >= k.b);
  if(ziel && s.flaechen.length && ueber(s.flaechen[0]!)) return 2;
  if(s.flaechen.slice(ziel ? 1 : 0).some(ueber)) return 1;
  if(s.punkte.some(([px, py]) => px >= x && px <= x + w && py >= y && py <= y + h)) return 1;
  return 0;
}

let karte: HTMLElement | null = null;
let nr = -1;                          // -1: zu
let ziel: HTMLElement | null = null;  // das Ziel mit Ring
let zielBeschr: string | null = null; // seine aria-describedby von vorher
let oeffner: HTMLElement | null = null;
let appFokus: HTMLElement | null = null;  // wohin F6 aus der Karte zurueckspringt
let ordnerGewaehlt = false;
let entschieden = false;
let geplant = 0;

/* Der Satz eines Schritts als HTML (die Woerterbuchtexte sind fest, der
   Pfad wird escaped). */
function satzHtml(i: number): string {
  if(i === 0) return t(SERVED ? "tour.s1.satz" : "tour.s1.satzDatei");
  if(i === 3){
    const eins = t("tour.s4.satz");
    if(!OWN_WINDOW) return eins;
    return eins + " " + esc(t(state.zweiFenster ? "tour.s4.kuerzel" : "tour.s4.kuerzelRueckfall", {key: kuerzelText()}));
  }
  return t("tour.s" + (i + 1) + ".satz");
}

function zielVon(i: number): HTMLElement | null {
  const e = document.querySelector<HTMLElement>(SCHRITTE[i]!.ziel);
  if(!e || !e.getClientRects().length) return null;
  const r = e.getBoundingClientRect();
  if(r.width < 1 || r.height < 1 || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return null;
  return e;
}

function ringAb(): void {
  if(!ziel) return;
  ziel.classList.remove("rgziel");
  if(zielBeschr === null) ziel.removeAttribute("aria-describedby");
  else ziel.setAttribute("aria-describedby", zielBeschr);
  ziel = null; zielBeschr = null;
}
function ringAn(e: HTMLElement | null): void {
  if(e === ziel) return;
  ringAb();
  if(!e) return;
  ziel = e;
  zielBeschr = e.getAttribute("aria-describedby");
  e.classList.add("rgziel");
  e.setAttribute("aria-describedby", ((zielBeschr || "") + " rgSatz").trim());
}

/* Die Karte bauen (einmal, in setup) - die Texte setzt zeichnen(). Die
   Reihenfolge der Knoepfe ist die der Tabulatortaste: Ueberspringen, Zurueck,
   Weiter; nach "Weiter" geht Tab weiter in die App. */
function bauen(): HTMLElement {
  const k = document.createElement("div");
  k.id = "rundgang"; k.className = "rundgang"; k.hidden = true;
  k.setAttribute("role", "dialog"); k.setAttribute("aria-modal", "false");
  k.setAttribute("aria-labelledby", "rgSchritt rgTitel");
  k.setAttribute("aria-describedby", "rgSatz rgWo");
  k.innerHTML =
    '<span class="rgpfeil" aria-hidden="true"></span>' +
    '<p class="rgschritt" id="rgSchritt"></p>' +
    '<h2 class="rgtitel" id="rgTitel"></h2>' +
    '<p class="rgsatz" id="rgSatz"></p>' +
    '<p class="rgwo" id="rgWo" hidden></p>' +
    '<div class="rgordner" id="rgOrdner" hidden>' +
      '<button class="btn sm" type="button" id="rgOrdnerKnopf"></button>' +
      '<p class="rgstand" id="rgOrdnerStand" hidden></p>' +
    '</div>' +
    '<div class="rgfuss">' +
      '<button class="leise" type="button" id="rgSkip"></button>' +
      '<span class="rgrechts">' +
        '<button class="btn sm" type="button" id="rgZurueck"></button>' +
        '<button class="btn sm hot" type="button" id="rgWeiter"></button>' +
      '</span>' +
    '</div>';
  document.body.append(k);
  return k;
}

function setzeText(e: HTMLElement, s: string){ if(e.textContent !== s) e.textContent = s; }

/* Texte und Ziel des Schritts nr; danach die Lage. */
function zeichnen(): void {
  const k = karte;
  if(!k || nr < 0) return;
  const s = SCHRITTE[nr]!;
  setzeText($("#rgSchritt"), t("tour.schritt", {n: nr + 1, total: SCHRITTE.length}));
  setzeText($("#rgTitel"), t(s.titel));
  const satz = satzHtml(nr);
  if($("#rgSatz").innerHTML !== satz) $("#rgSatz").innerHTML = satz;
  // Schritt 1 in der App: ohne Ordner der Knopf, mit Ordner der Pfad
  const ordner = $("#rgOrdner"), knopf = $<HTMLButtonElement>("#rgOrdnerKnopf"), stand = $("#rgOrdnerStand");
  const mitOrdner = nr === 0 && SERVED;
  ordner.hidden = !mitOrdner;
  if(mitOrdner){
    knopf.hidden = !!serverDir;
    setzeText(knopf, t("land.pickFolder"));
    stand.hidden = !serverDir;
    const html = serverDir ? '<b>' + esc(t("tour.ordnerGesetzt")) + '</b> <code>' + esc(serverDir) + '</code>' : "";
    if(stand.innerHTML !== html) stand.innerHTML = html;
  }
  const letzter = nr === SCHRITTE.length - 1;
  setzeText($("#rgSkip"), t("tour.skip"));
  setzeText($("#rgZurueck"), t("tour.zurueck"));
  $("#rgZurueck").hidden = nr === 0;
  setzeText($("#rgWeiter"), t(letzter ? "tour.fertig" : "tour.weiter"));
  lage();
}

/* Wo die Karte steht. Alles in gemalten Punkten (getBoundingClientRect und
   innerWidth tragen die Groesseneinstellung), erst left und top werden in
   Layoutpunkte umgerechnet - dieselbe Regel wie in 38-tooltips.ts. */
function lage(): void {
  const k = karte;
  if(!k || nr < 0) return;
  const z = uiZoomFactor();
  const kompakt = document.body.classList.contains("compact");
  k.hidden = kompakt;
  if(kompakt){ ringAb(); return; }
  const e = zielVon(nr);
  ringAn(e);
  const wo = $("#rgWo");
  wo.hidden = !!e;
  // leer, solange das Ziel zu sehen ist: aria-describedby liest auch Verborgenes vor
  setzeText(wo, e ? "" : t(SCHRITTE[nr]!.wo));
  const sb = document.querySelector<HTMLElement>("#statusleiste");
  const sbTop = sb && sb.getClientRects().length ? sb.getBoundingClientRect().top : innerHeight;
  const tb = document.querySelector<HTMLElement>("header.top");
  const tbUnten = tb && tb.getClientRects().length ? tb.getBoundingClientRect().bottom : 0;
  const s = schutz(e);
  const schmal = innerWidth / z < SCHMAL;
  k.classList.toggle("rgschmal", schmal);
  const setze = (x: number, y: number, seite: string, pfeil: number) => {
    k.dataset.seite = seite;
    k.style.left = (x / z) + "px"; k.style.top = (y / z) + "px";
    k.style.setProperty("--rg-pfeil", (pfeil / z) + "px");
  };
  /* Links steht die Symbolleiste: die Karte beginnt rechts davon. */
  const leiste = document.querySelector<HTMLElement>("#bereiche");
  const leisteRechts = leiste && leiste.getClientRects().length ? leiste.getBoundingClientRect().right : 0;
  if(schmal){
    /* Unter 640 Punkt: ueber die volle Breite rechts der Symbolleiste (16
       Punkt Rand), ohne Pfeil - unten ueber der Statusleiste oder oben unter
       der Titelleiste, was weniger verdeckt (unten zuerst). */
    const links = Math.max(16 * z, leisteRechts + 8 * z);
    const w = innerWidth - 16 * z - links;
    k.style.width = (w / z) + "px";
    const h = k.getBoundingClientRect().height;
    const lagen = [sbTop - 8 * z - h, tbUnten + 8 * z];
    const y = lagen.map(v => ({ v, d: deckung(links, v, w, h, e, s) })).sort((a, b) => a.d - b.d)[0]!.v;
    setze(Math.round(links), Math.round(y), "keine", 0);
    return;
  }
  k.style.width = "";
  const r = k.getBoundingClientRect();
  const w = r.width, h = r.height;
  const mitte = Math.round((innerWidth - w) / 2), unten = Math.round(sbTop - 12 - h);
  if(!e){
    setze(mitte, unten, "keine", 0);
    return;
  }
  const zr = e.getBoundingClientRect();
  const cx = (zr.left + zr.right) / 2, cy = (zr.top + zr.bottom) / 2;
  const klemme = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const versuche: string[] = cx < 140 ? ["rechts", "unten", "oben", "links"]
    : zr.bottom > innerHeight - 90 ? ["oben", "links", "unten", "rechts"] : ["unten", "oben", "rechts", "links"];
  /* Die erste Seite, die nichts verdeckt; sonst die erste, die wenigstens das
     Ziel frei laesst. */
  let notfalls: [number, number, string, number] | null = null;
  for(const seite of versuche){
    let x: number, y: number;
    if(seite === "unten" || seite === "oben"){
      x = klemme(cx - w / 2, Math.max(RAND, leisteRechts + 8), innerWidth - RAND - w);
      y = seite === "unten" ? zr.bottom + LUFT : zr.top - LUFT - h;
      if(y < RAND || y + h > innerHeight - RAND) continue;
    } else {
      y = klemme(cy - h / 2, RAND, innerHeight - RAND - h);
      x = seite === "rechts" ? zr.right + LUFT : zr.left - LUFT - w;
      if(x < RAND || x + w > innerWidth - RAND) continue;
    }
    const d = deckung(x, y, w, h, e, s);
    if(d === 2) continue;
    const pfeil = seite === "unten" || seite === "oben" ? klemme(cx - x, 16, w - 16) : klemme(cy - y, 16, h - 16);
    if(d === 0){ setze(Math.round(x), Math.round(y), seite, pfeil); return; }
    if(!notfalls) notfalls = [Math.round(x), Math.round(y), seite, pfeil];
  }
  if(notfalls){ setze(...notfalls); return; }
  // nirgends Platz daneben: unten mittig, ohne Pfeil (der Ring bleibt), oder oben, wenn unten das Ziel liegt
  setze(mitte, deckung(mitte, unten, w, h, e, s) === 2 ? Math.round(tbUnten + 12) : unten, "keine", 0);
}

function spaeter(): void {
  if(nr < 0 || geplant) return;
  geplant = requestAnimationFrame(() => { geplant = 0; lage(); });
}

function zeigen(i: number, fokus = true): void {
  nr = Math.max(0, Math.min(SCHRITTE.length - 1, i));
  karte!.hidden = false;
  zeichnen();
  if(fokus) $("#rgWeiter").focus({preventScroll: true});
}

/** Den Rundgang oeffnen, bei Schritt 1. Vom Knopf in den Einstellungen mit
    diesem Knopf als Oeffner (dorthin geht der Fokus danach, wenn er zu
    sehen ist). */
export function rundgangStarten(von?: HTMLElement | null): void {
  if(KOMPAKT_FENSTER || !karte) return;
  oeffner = von || null;
  ordnerGewaehlt = false;
  if(!state.start || state.einst || state.weeklies) switchTab("start");
  /* Von selbst nimmt er den Fokus nur, wenn noch keiner gesetzt ist: wer
     schon einen Knopf gewaehlt hat, behaelt ihn, F6 fuehrt zur Karte
     (Pruefung G1). */
  const frei = !document.activeElement || document.activeElement === document.body;
  zeigen(0, !!von || frei);
}

/* Fertig oder Ueberspringen: der Rundgang gilt als gesehen. */
function schliessen(): void {
  if(nr < 0 || !karte) return;
  nr = -1;
  ringAb();
  karte.hidden = true;
  if(OWN_WINDOW && !KOMPAKT_FENSTER && state.rundgangGesehen !== true){
    state.rundgangGesehen = true;
    persistPref("rundgangGesehen", true);
  }
  /* Der Oeffner, sonst "Log-Ordner waehlen" auf Start, sonst der gewaehlte
     Ort in der Symbolleiste (Start verlassen, Pruefung G2). */
  const zurueck = [oeffner, document.querySelector<HTMLElement>("#btnPickFolder"),
    document.querySelector<HTMLElement>('#bereiche [aria-current="page"]'), document.querySelector<HTMLElement>("#sbFehler")]
    .find(b => !!b && b.isConnected && b.getClientRects().length > 0);
  oeffner = null;
  if(zurueck) zurueck.focus({preventScroll: true});
}

/** Von selbst? Aus 41, sobald die Einstellungen da sind, und hier, wenn "bereit" kommt.
    Entschieden wird einmal je Seite. */
export function rundgangVonSelbst(): void {
  if(entschieden || !karte) return;
  if(KOMPAKT_FENSTER || !OWN_WINDOW){ entschieden = true; karte.dataset.vonSelbst = "nein"; return; }
  if(state.rundgangGesehen === null || state.ersterStart === null || !document.body.dataset.bereit) return;
  entschieden = true;
  const kompakt = document.body.classList.contains("compact");
  const aufStart = !$("#land").hidden;
  const ja = state.rundgangGesehen !== true && state.ersterStart === true && aufStart && !kompakt;
  karte.dataset.vonSelbst = ja ? "ja" : "nein";
  if(ja) rundgangStarten(null);
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  karte = bauen();
  $("#rgWeiter").addEventListener("click", () => {
    if(nr >= SCHRITTE.length - 1) schliessen();
    else zeigen(nr + 1);
  });
  $("#rgZurueck").addEventListener("click", () => { if(nr > 0) zeigen(nr - 1); });
  $("#rgSkip").addEventListener("click", schliessen);
  $("#rgOrdnerKnopf").addEventListener("click", () => { ordnerGewaehlt = true; void chooseServerDir(); });
  karte.addEventListener("keydown", e => {
    if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); schliessen(); }
  });
  /* F6 springt zwischen Karte und App: aus der Karte dorthin, wo man in der
     App war (sonst ans Ziel), aus der App auf "Weiter". */
  document.addEventListener("keydown", e => {
    if(e.key !== "F6" || nr < 0 || !karte || karte.hidden) return;
    e.preventDefault();
    const drin = karte.contains(document.activeElement);
    if(drin){
      const hin = [appFokus, ziel].find(b => !!b && b.isConnected && b.getClientRects().length > 0);
      if(hin) hin.focus({preventScroll: true});
    } else {
      const a = document.activeElement as HTMLElement | null;
      appFokus = a && a !== document.body ? a : null;
      $("#rgWeiter").focus({preventScroll: true});
    }
  });
  document.addEventListener("focusin", e => {
    const a = e.target as HTMLElement;
    if(karte && !karte.contains(a) && a !== document.body) appFokus = a;
  });
  const knopf = document.querySelector<HTMLElement>("#eRundgang");
  if(knopf) knopf.addEventListener("click", () => rundgangStarten(knopf));
  /* Lage und Text folgen dem, was sich ringsum aendert: Groesse des
     Fensters, Sprache, Thema und Groesseneinstellung, der Ort (Start,
     Einstellungen, Weeklies, Kampf), Kompakt, und "bereit" - der Ordner ist
     gewaehlt (Schritt 1 sagt dann "Ordner gesetzt") oder die Seite ist fertig
     gezeichnet (dann entscheidet sich, ob er von selbst kommt). */
  addEventListener("resize", spaeter);
  const beob = new MutationObserver(recs => {
    if(recs.some(r => r.attributeName === "data-bereit")){
      rundgangVonSelbst();
      if(nr === 0){
        zeichnen();
        if(ordnerGewaehlt && serverDir){ ordnerGewaehlt = false; $("#rgWeiter").focus({preventScroll: true}); }
      }
    }
    if(nr < 0) return;
    if(recs.some(r => r.attributeName === "lang")) zeichnen();
    else spaeter();
  });
  beob.observe(document.documentElement, {attributes: true, attributeFilter: ["lang", "style", "data-theme"]});
  beob.observe(document.body, {attributes: true, attributeFilter: ["class", "data-bereit"]});
  for(const id of ["#land", "#app", "#einst", "#weeklies"]){
    const e = document.querySelector(id);
    if(e) beob.observe(e, {attributes: true, attributeFilter: ["hidden"]});
  }
}
