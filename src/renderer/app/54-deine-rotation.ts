import { state } from "./01-state";
import { toast } from "./03-helpers";
import { t, tt } from "./08-translation";
import { VON_SELBST, skillKey } from "./10-skill-names";
import { skillMark } from "./11-skill-icons";
import { skillIcon } from "./12-boss-images";
import { skillLabel } from "./14-questlog-weapons";
import { casts, unverwundbarOf } from "./15-weapons-and-ventius";
import { isAutoWeapon, secs1, weaponFor } from "./16-fight-analysis";
import { $, esc } from "./18-interface-basics";
import { mitgliedName } from "./19-grouping-and-party-fights";
import { coreBadge } from "./21-damage-table";
import { spurGruppe } from "./22-timeline-smoothing";
import { setzeStackKopf } from "./24-table-keyboard-and-timeline";
import { ACHSE_RAND as RAND, achsenBreite, achsenPxs, renderRotation, rotWindow } from "./25-rotation";
import { SERVED } from "./41-server-mode";
import { isWatching } from "./45-startup";
import { paarVon } from "./47-paar";
import { einsaetzeHtml, einsaetzeLeer, taktKopf, taktStriche, type EinsatzZeile } from "./48-einsaetze";
import { abspielUhr, automatisch, einsatzBei, etagenFort, folge, leistenDauer, stilleVor, takt, uhrZehntel,
  wahlVon, weiter, type AbspielUhr, type Grund, type RotEinsatz, type RotSkill, type RotWahl, type Stille } from "../rotation-core";
import { samePair } from "../build-core";
import type { Fight, RotationHit, RotationMark, SkillCast, SkillStats } from "../types";

/* ---------- Deine Rotation ----------
   Spezifikation docs/superpowers/specs/2026-09-27-deine-rotation-design.md,
   Issue #44, Stufe 1: Erkennen, Bestaetigen, Leiste oben; Stufe 2:
   Abspielen (Kopf, Jetzt, Tempo, Uhr, Tastatur der Buehne), unter Live
   baut die Leiste stueckweise weiter. Neugestaltung 28.09. (Spezifikation
   3): die Folge mit Durchgaengen (Stufe 3), der Massstab nach dem
   Median-Abstand und das Mitrollen entfallen - die Leiste zeigt den ganzen
   Kampf auf der Breite (leistenDauer, rotation-core.ts). Seit Aufgabe 4
   der Neugestaltung (Luecken 3) wie im Entwurf: Steuerzeile mit 1x 2x 4x,
   grosser Uhr und "Jetzt" rechts, der Satz definiert die Stille, die Leiste
   hat drei Bahnen (ab 1200 Punkt Fensterhoehe fuenf), jede Stille traegt
   ihre Dauer in Zehnteln, ein Klick springt. Statt der Spalte "Gedrueckt"
   das Feld "Einsaetze" (48-einsaetze.ts, takt() im Kern) mit dem Auge je
   Zeile; "Immer weglassen" und "Zuruecknehmen" stehen im Kasten
   "Automatisch" (DECISION 3.9, 3.10). Beim Gruppenmitglied nur, was es
   ueber das Board teilt - ohne geteilte Einsaetze bleibt die Leiste leer.
   Seit Aufgabe 10 (Nachtrag 29.09.) steht unter der Leiste der Zeitverlauf
   (24) auf derselben Achse (25: ACHSE_RAND, achsenBreite, rotWindow): Zoom
   und Von/bis gelten fuer beide, gerollt wird gemeinsam, und der Kopf laeuft
   als Strich durch Kurve und Spuren weiter (setzeStackKopf). Seit Aufgabe
   11 (Nachtrag 29.09.) laesst sich statt der Leiste die Reihenfolge zeigen:
   dieselben Einsaetze als einfache Reihe ohne Zeitachse (Vorlage die Folge
   vor der Neugestaltung, ohne Durchgaenge und Massstab); der Zeitverlauf
   bleibt darunter.

   Der erste Block im Reiter Rotation: nur die Einsaetze, die du gedrueckt
   hast, in der Reihenfolge des Kampfes. Was von selbst Schaden macht
   (Passiv, die feste Liste VON_SELBST), schlaegt Borometer vor; es faellt
   vorlaeufig aus der Leiste und steht als Punkt in der Punktreihe
   "automatisch". Die Wahl gilt je Waffenpaar in der Sitzung (der Builds-Reiter
   mit seinem Speicher ist entfallen, #207). Auge von Ventius drueckt man selbst (Entscheidung 26.09.
   abends) - es wird nie vorgeschlagen.

   Die Leiste ist aus Elementen statt einer Leinwand, wie "Rotation
   nebeneinander": sie folgt jedem Thema ohne Neuzeichnen, die Hervorhebung
   ist eine Klasse, und die Symbole koennen rutschen (FLIP). Rund 300
   Einsaetze je Kampf sind fuer das DOM wenig. */

/* Die Masse der Leiste (Spezifikation 5.3): 32-px-Symbole, Etagen zu 37 px,
   3 px Luft zwischen zwei Symbolen einer Etage. Drei Etagen, ab 1200 Punkt
   Fensterhoehe fuenf (Neugestaltung 28.09., Luecken 3.5) - was keinen Platz
   findet, steht als Strich im Band. Der Rand links und rechts ist 24 px
   (Stufe 2, vorher 20; seit Aufgabe 10 ACHSE_RAND in 25, derselbe fuer den
   Zeitverlauf): der aktuelle Einsatz steht 40 px breit mit 2 px Rahmen, und
   der erste liegt meist bei 0:00 - die Flaeche schneidet ab, was ueber ihren
   Rand ragt (contain:strict). Die Stille-Marke steht unter dem Band (STILL).
   Eine eigene Zeitachse hat die Leiste seit Fixrunde 1 zu Aufgabe 10 nicht
   mehr: es gilt die eine unter der Kurve des Zeitverlaufs direkt darunter.
   AUSSEN: ein Einsatz ausserhalb des Fensters (Von/bis) - nicht gebaut. */
const PLATTE = 32, ETH = 37, LUFT = 3;
const OBEN = 10, BAND = 11, STILL = 18, PUNKTE = 22, UNTEN = 6, AUSSEN = -2;
const etagenZahl = () => innerHeight >= 1200 ? 5 : 3;

/** Alles, was der Block zu einem Kampf weiss - gerechnet, ohne zu zeichnen. */
interface Stand {
  seg: Fight;
  lanes: SkillStats[];
  /** die Spur je Name */
  reihe: Map<string, SkillStats>;
  sidOf: Map<string, string>;
  keyOf: Map<string, string>;
  /** die eigenen Kaempfe links; die Kurve eines Gruppenmitglieds nicht */
  eigen: boolean;
  /** das Waffenpaar des Kampfes (47-paar.ts, paarVon) */
  paar: [string, string] | null;
  wahl: Record<string, RotWahl>;
  grund: Map<string, Grund>;
  auto: Map<string, { grund: Grund | "hand"; fest: boolean }>;
  byCast: Map<string, SkillCast[]>;
  einsaetze: (RotEinsatz & { name: string; cast: SkillCast })[];
  anzahl: Map<string, number>;
  /** das Kurvenbild eines Mitglieds ohne geteilte Einsaetze: nichts zu zeigen, nichts zu erfinden */
  leer: boolean;
}

/* ---------- die Sitzung ----------
   Eine Wahl gilt in der Sitzung, je Waffenpaar (Topf "paar:..."), nur in
   Kaempfen mit demselben Paar (Topf "ohne": nur bei unbekanntem Paar). Sie
   geht nicht auf die Platte: der Builds-Reiter, an dem sie frueher hing,
   ist entfallen (#207). */
const topfName = (paar: readonly string[] | null) =>
  paar ? "paar:" + [...paar].sort().join("+") : "ohne";
function inSitzung(k: string, v: RotWahl, paar: [string, string] | null){
  const name = topfName(paar);
  const alt = state.rotSitzung[name];
  state.rotSitzung = {...state.rotSitzung, [name]: {paar: alt?.paar ?? paar, rot: {...(alt?.rot ?? {}), [k]: v}}};
}
function sitzungFuer(paar: readonly string[] | null): Record<string, RotWahl> {
  const raus: Record<string, RotWahl> = {};
  for(const topf of Object.values(state.rotSitzung)){
    if(topf.paar ? !!paar && samePair(topf.paar, paar) : !paar) Object.assign(raus, topf.rot);
  }
  return raus;
}

/* Die Wahlen, die fuer einen Kampf gelten: die der Sitzung zu seinem Paar.
   Beim Gruppenmitglied keine. */
function wahlen(eigen: boolean, paar: readonly string[] | null): Record<string, RotWahl> {
  return eigen ? sitzungFuer(paar) : {};
}

/* Warum Borometer eine Faehigkeit fuer automatisch haelt (Spezifikation
   4.1): nur, was sicher ist. Der erste passende Grund gilt. */
function grundVon(name: string, ids: Set<string>): { grund: Grund } | null {
  const sid = [...ids][0];
  if(weaponFor(name, sid) === "Passive") return {grund: isAutoWeapon(name, sid) ? "passiv" : "markiert"};
  return [...ids].some(i => VON_SELBST.has(i)) ? {grund: "liste"} : null;
}

/* Unter Live, solange der Kampf waechst (Stufe 2): eine Faehigkeit, die
   einmal unter den vierzehn staerksten war, bleibt im Block, bis der Kampf
   steht. Am Rand der vierzehn tauschen Faehigkeiten mit ein paar Treffern
   sonst fast jeden Takt den Platz - die Zeile in "Gedrueckt" spraenge hinein
   und hinaus, und die Leiste muesste jedes Mal ganz neu (ihre Einsaetze
   fehlten mitten in der Folge). Steht der Kampf, gelten wieder genau die
   vierzehn. */
let klebend: { start: number; namen: Set<string> } | null = null;
/* Der gezeigte Kampf waechst: links ist der neueste gewaehlt und Live
   laeuft (Spezifikation 8) - auch bei der Kurve eines Gruppenmitglieds,
   denn deren Bericht waechst im selben Takt mit. */
const waechst = () => state.sel === 0 && isWatching();
function spurenVon(seg: Fight): SkillStats[] {
  const vierzehn = seg.stats.skills.slice(0, 14);
  if(!waechst()){ klebend = null; return vierzehn; }
  if(!klebend || klebend.start !== seg.start) klebend = {start: seg.start, namen: new Set()};
  const namen = klebend.namen;
  for(const sk of vierzehn) namen.add(sk.name);
  return seg.stats.skills.filter((sk, i) => i < 14 || namen.has(sk.name));
}

function stand(seg: Fight): Stand {
  const lanes = spurenVon(seg);
  const sidOf = new Map<string, string>(), idsOf = new Map<string, Set<string>>();
  for(const e of seg.events){
    if(!e.sid) continue;
    if(!sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);
    let s = idsOf.get(e.skill);
    if(!s){ s = new Set(); idsOf.set(e.skill, s); }
    s.add(e.sid);
  }
  const eigen = !seg.fremd && seg === state.encounters[state.sel];
  const paar = eigen ? paarVon(seg) : null;
  const keyOf = new Map<string, string>(), grund = new Map<string, Grund>();
  const skills: RotSkill[] = [];
  for(const sk of lanes){
    const k = skillKey(sk.name, sidOf.get(sk.name));
    keyOf.set(sk.name, k);
    const g = grundVon(sk.name, idsOf.get(sk.name) ?? new Set());
    if(g) grund.set(k, g.grund);
    skills.push({k, grund: g ? g.grund : null});
  }
  const wahl = wahlen(eigen, paar);
  /* Beim Gruppenmitglied nur, was es ueber das Board teilt (castsFest):
     casts() leitete sonst aus der nachgebauten Kurve einen Einsatz je
     Sekunde ab - eine Rotation, die es nie gab (Luecken 3.12). */
  const leer = !!seg.fremd && !seg.castsFest;
  const byCast = leer ? new Map<string, SkillCast[]>() : casts(seg);
  const einsaetze: Stand["einsaetze"] = [];
  const anzahl = new Map<string, number>();
  for(const sk of lanes){
    const k = keyOf.get(sk.name)!;
    const liste = byCast.get(sk.name) ?? [];
    anzahl.set(k, liste.length);
    for(const c of liste) einsaetze.push({k, name: sk.name, cast: c, t: c.t - seg.start, ende: (c.last || c.t) - seg.start});
  }
  return {seg, lanes, reihe: new Map(lanes.map(sk => [sk.name, sk])), sidOf, keyOf, eigen, paar, wahl, grund, auto: automatisch(skills, wahl), byCast, einsaetze, anzahl, leer};
}

/** Die gedrueckten Einsaetze eines Kampfes, gezaehlt wie die Zeitleiste (ohne
    die automatischen, mit den vom Auge ausgeblendeten): die Zahl fuer "Hast du
    durchgedrueckt?" in der Analyse (Neugestaltung 28.09., Luecken 4.9). */
export function gedrueckteEinsaetze(seg: Fight): number {
  const st = stand(seg);
  return folge(st.einsaetze, new Set(st.auto.keys())).gedrueckt.length;
}

/** Was die Leiste zuletzt gezeichnet hat, fuer ihren Tooltip (38-tooltips.ts). */
export let rotBarHit: RotationHit | null = null;

/* ---------- die Spalte ---------- */
const anzahlText = (n: number) => '<u title="' + esc(t("deinerot.anzahlTitel", {n})) + '">' + esc(t("deinerot.anzahl", {n})) + "</u>";

/* Das Feld "Einsaetze" (Luecken 3.7): je gedrueckte Faehigkeit eine Zeile,
   in der Reihenfolge des Schadens wie die Spuren; die Zahlen rechnet takt()
   aus allen gedrueckten Einsaetzen - auch denen, die das Auge gerade aus der
   Zeitleiste nimmt (ihre Zeile bleibt, gedaempft). Der Takt steht auf der
   Dauer der Zeitleiste, damit ein Strich unter seinem Symbol steht. */
function einsatzZeilen(st: Stand, gedrueckt: readonly Stand["einsaetze"][number][], aus: Set<string>): EinsatzZeile[] {
  const T = Math.max(1, st.seg.stats.seconds || 1) * 1000;
  const je = new Map(takt(gedrueckt.map(e => ({k: e.k, t: e.t, treffer: e.cast.hits || 1})), T).map(z => [z.k, z]));
  const zeilen: EinsatzZeile[] = [];
  for(const sk of st.lanes){
    const k = st.keyOf.get(sk.name)!;
    const z = je.get(k);
    if(!z || st.auto.has(k) || zeilen.some(r => r.z.k === k)) continue;
    const sid = st.sidOf.get(sk.name);
    zeilen.push({z, name: sk.name, label: skillLabel(sk.name, sid), sym: skillMark(sk.name, sid, sk.color, sk.rest),
      kern: coreBadge(sk.name, sid, st.seg.ventiusBase), farbe: farbeVon(sk), drin: !aus.has(sk.name)});
  }
  return zeilen;
}

/* Ein Knopf der Wahl. Der zugaengliche Name nennt die Faehigkeit - sonst
   hoerte man in der Spalte fuenfmal "Stimmt" ohne zu wissen, wofuer.
   Leise (Issue #52): im Kasten "Automatisch" sind nur "Stimmt" Knoepfe,
   "Druecke ich selbst" und "Zuruecknehmen" stehen ohne Platte daneben. */
function knopf(k: string, name: string, v: RotWahl, art = v === 1 ? "stimmt" : v === 2 ? "selbst" : "zurueck", leise = false): string {
  return '<button type="button" class="' + (leise ? "leise" : "btn sm") + ' drwahl" data-wahl="' + v + '" data-k="' + esc(k) + '" data-n="' + esc(name) + '"' +
    ' data-art="' + art + '" aria-label="' + esc(t("deinerot." + art + "Label", {name})) + '">' + esc(t("deinerot." + art)) + "</button>";
}

function grundText(grund: Grund | "hand"): string {
  return t("deinerot.grund." + grund);
}

/* Der Kasten "Automatisch" (Issue #52): eine Zeile je Skill, als Raster
   Name | Begruendung | Wahl. Die Begruendung steht einzeilig, der volle Text
   im title; der Stand kurz ("bestaetigt"), der ganze Satz im title. Darunter
   ein Satz, wo die Wahl gemerkt ist. */
function autoHtml(st: Stand, aus: Set<string>): string {
  let html = "";
  const zeilen: string[] = [];
  for(const sk of st.lanes){
    const k = st.keyOf.get(sk.name)!;
    const a = st.auto.get(k);
    if(!a) continue;
    const sid = st.sidOf.get(sk.name), name = skillLabel(sk.name, sid), grund = grundText(a.grund);
    // von Hand weggelassen heisst nicht "bestaetigt": der title sagt, was es ist und wo es gilt
    const fest = t(a.grund === "hand" ? "deinerot.wegSitzung" : "deinerot.festSitzung");
    zeilen.push('<li data-k="' + esc(k) + '"><span class="drname">' + skillMark(sk.name, sid, sk.color, sk.rest) +
      '<b title="' + esc(name) + '">' + esc(name) + "</b>" + anzahlText(st.anzahl.get(k) ?? 0) + "</span>" +
      '<span class="drgrund" title="' + esc(grund) + '">' + esc(grund) + "</span>" +
      (!st.eigen ? ""
        : a.fest ? '<span class="drknoepfe"><span class="drfest" title="' + esc(fest) + '">' + esc(t(a.grund === "hand" ? "deinerot.autoHand" : "deinerot.autoFest")) +
          "</span>" + knopf(k, name, 0, undefined, true) + "</span>"
        : '<span class="drknoepfe">' + knopf(k, name, 1) + knopf(k, name, 2, undefined, true) + "</span>") + "</li>");
  }
  html += zeilen.length ? '<ul class="drauto" aria-labelledby="drAutoTitel">' + zeilen.join("") + "</ul>"
    : '<p class="drnichts">' + esc(t("deinerot.nichts")) + "</p>";
  /* Die Wahlen, die frueher in der Spalte "Gedrueckt" standen (DECISION 3.9):
     was du selbst drueckst, mit "Zuruecknehmen", und was das Auge in diesem
     Kampf ausgeblendet hat, mit "Immer weglassen". Das Auge gilt der
     Ansicht, die Wahl der Sitzung. Nur bei eigenen Kaempfen. */
  const wahlen: string[] = [];
  if(st.eigen) for(const sk of st.lanes){
    const k = st.keyOf.get(sk.name)!;
    if(st.auto.has(k) || !(st.anzahl.get(k) ?? 0)) continue;
    const selbst = wahlVon(st.wahl, k) === 2, weg = aus.has(sk.name);
    if(!selbst && !weg) continue;
    const sid = st.sidOf.get(sk.name), name = skillLabel(sk.name, sid), grund = t(selbst ? "deinerot.vonDir" : "deinerot.ausHier");
    wahlen.push('<li data-sk="' + esc(k) + '" data-rot="' + esc(sk.name) + '"><span class="drname">' + skillMark(sk.name, sid, sk.color, sk.rest) +
      '<b title="' + esc(name) + '">' + esc(name) + "</b>" + anzahlText(st.anzahl.get(k) ?? 0) + "</span>" +
      '<span class="drgrund" title="' + esc(grund) + '">' + esc(grund) + "</span>" +
      '<span class="drknoepfe">' + (selbst ? knopf(k, name, 0) : knopf(k, name, 1, "immer")) + "</span></li>");
  }
  if(wahlen.length) html += '<ul class="drauto drwahlen" aria-labelledby="drAutoTitel">' + wahlen.join("") + "</ul>";
  const wo = !st.eigen ? t("deinerot.mitglied") : t("deinerot.sitzung");
  html += '<p class="drhinweis">' + esc(zeilen.length ? t("deinerot.autoSatz") + " " + wo : wo) + "</p>";
  return html;
}

/* Der Kopf des Kastens: "Automatisch" · "4 ausgeblendet" · die Symbole
   klein · "1 neu", wenn es ungepruefte Vorschlaege gibt (nur bei eigenen
   Kaempfen - nur dort laesst sich etwas pruefen). Die Symbole sind nur
   Bild; der zugaengliche Name steht im aria-label des Kopfs. */
function kopfVon(st: Stand, aus: Set<string>): { html: string; label: string; neu: string[] } {
  const syms: string[] = [], neu: string[] = [];
  for(const sk of st.lanes){
    const k = st.keyOf.get(sk.name)!;
    const a = st.auto.get(k);
    if(!a) continue;
    syms.push(skillMark(sk.name, st.sidOf.get(sk.name), sk.color, sk.rest));
    if(st.eigen && !a.fest) neu.push(k);
  }
  const titel = t("deinerot.auto"), zu = syms.length ? t("deinerot.autoZu", {n: syms.length}) : "";
  const neuText = neu.length ? t("deinerot.autoNeu", {n: neu.length}) : "";
  /* Was das Auge in diesem Kampf ausgeblendet hat, laesst sich hier
     dauerhaft weglassen (DECISION 3.9): der Kopf sagt, dass es da ist. */
  const ausN = st.eigen ? st.lanes.filter(sk => aus.has(sk.name) && !st.auto.has(st.keyOf.get(sk.name)!)).length : 0;
  const ausText = ausN ? t("deinerot.autoAusHier", {n: ausN}) : "";
  const html = "<b>" + esc(titel) + "</b>" +
    (zu ? ' <span class="drazahl">\u00b7 ' + esc(zu) + "</span>" : "") +
    (ausText ? ' <span class="drazahl">\u00b7 ' + esc(ausText) + "</span>" : "") +
    (syms.length ? ' <span class="drasyms" aria-hidden="true">' + syms.join("") + "</span>" : "") +
    (neuText ? ' <span class="drneu">' + esc(neuText) + "</span>" : "");
  return {html, label: [titel, zu, ausText, neuText].filter(Boolean).join(", "), neu};
}

/* Offen oder zu (Issue #52): zu ist der Standard. Ein ungepruefter
   Vorschlag, der vorher nicht da war, oeffnet den Kasten; sonst gilt, was
   man zuletzt von Hand getan hat - auch nach dem Neuzeichnen, das nur
   Kopf und Liste tauscht. Gemerkt im Browser-Speicher, eine Bequemlichkeit:
   ohne ihn beginnt der Kasten zu. "Gesehen" steht als "~|Schluessel" (vor
   dem Entfall des Builds-Reiters stand vor dem Strich die Kennung eines
   Builds; diese Eintraege zaehlen nicht mehr). Eintraege ohne "|" zaehlen nicht. */
const KASTEN = "boroDrAuto";
let kastenOffen = false;
let kastenGesehen: Set<string> | null = null;
function kastenLaden(): Set<string> {
  if(kastenGesehen) return kastenGesehen;
  kastenGesehen = new Set();
  try{
    const v = JSON.parse(localStorage.getItem(KASTEN) || "null");
    if(v && typeof v.offen === "boolean" && Array.isArray(v.gesehen)){
      kastenOffen = v.offen;
      for(const k of v.gesehen) if(typeof k === "string" && k.includes("|")) kastenGesehen.add(k);
    }
  }catch(err){}
  return kastenGesehen;
}
function kastenMerken(){
  try{ localStorage.setItem(KASTEN, JSON.stringify({offen: kastenOffen, gesehen: [...kastenLaden()].slice(-100)})); }catch(err){}
}
function kastenSetzen(offen: boolean){
  kastenOffen = offen;
  const kasten = $<HTMLDetailsElement>("#drAutoKasten");
  if(kasten && kasten.open !== offen) kasten.open = offen;
}
function kastenZeigen(st: Stand, aus: Set<string>){
  const kopf = kopfVon(st, aus);
  setzen($("#drAutoKopf"), kopf.html);
  const su = $("#drAutoTitel");
  if(su.getAttribute("aria-label") !== kopf.label) su.setAttribute("aria-label", kopf.label);
  const gesehen = kastenLaden();
  let frisch = false;
  const bezug = "~|";
  for(const k of kopf.neu) if(!gesehen.has(bezug + k)){ gesehen.add(bezug + k); frisch = true; }
  if(frisch){ kastenOffen = true; kastenMerken(); }
  kastenSetzen(kastenOffen);
}

/* ---------- die Buehne ---------- */
interface Buehne { marks: RotationMark[]; ohneBild: number }

/* Was die Buehne zuletzt gebaut hat (Stufe 2): damit der wachsende Kampf
   unter Live nur anhaengt, statt je Takt die ganze Leiste - bis zu
   sechshundert Elemente - neu zu bauen, und damit der Kopf weiss, wo ein
   Einsatz steht. */
interface Gebaut {
  start: number;
  /** alles ausser dem Wachsen: Kampf, Wessen, Sprache, Breite, Weglassen */
  struktur: string;
  /** die Dauer, die die Leiste zeigt (leistenDauer), und die des Kampfes, beide in ms; die Breite der Flaeche */
  dauer: number; T: number; breite: number;
  /** das Fenster, das die Leiste zeigt (rotWindow, Aufgabe 10), in ms: ohne Von/bis 0 bis dauer */
  von: number; bis: number;
  pxs: number; hoch: number; bandY: number; W: number;
  /** Etagenregel fortgesetzt (etagenFort) und die Etage je gezeigtem Einsatz, -1 = nur Strich, AUSSEN = nicht im Fenster */
  platz: number[]; sitz: number[];
  gezeigt: Stand["einsaetze"];
  /** die Zeiten der gezeigten Einsaetze, fuer den Kopf */
  ts: number[];
  auto: Stand["einsaetze"];
  stille: Stille[];
  inv: string;
  punkte: boolean;
  /** je Spur ein fester Platz: Farbe (--rcN) und Bild (--riN) stehen als Variable am Behaelter (#rotBar) */
  platzVon: Map<string, number>; farben: string[]; bild: Set<string>;
  /** Spuren ohne Bild ab Rang 13: ihre Symbole sind schraffiert */
  schraffiert: Set<string>;
  ohneBild: number;
}
let gebaut: Gebaut | null = null;
let letzteVars = "";

const farbeVon = (sk: SkillStats | undefined) => !sk || sk.rest ? "var(--series-rest)" : sk.color || "var(--series-rest)";

/* Die Teile der Leiste, einzeln, damit der volle Bau und das Anhaengen
   dasselbe HTML schreiben. `i` ist die Nummer des Einsatzes unter den
   gezeigten - der Kopf findet ihn daran. Farbe und Bild kommen ueber den
   festen Platz der Spur (--rcN, --riN am Behaelter): unter Live wechselt
   die Rangfolge der Faehigkeiten, und mit ihr die Reihenfarbe - dann
   aendert sich eine Variable, nicht jedes Symbol. */
function einsatzTeile(st: Stand, e: Stand["einsaetze"][number], i: number, x: number, r: number, bandY: number, g: Pick<Gebaut, "platzVon" | "bild">):
    { stiel: string; sym: string; strich: string } {
  const sk = st.reihe.get(e.name), p = g.platzVon.get(e.name), c = p == null ? farbeVon(sk) : "var(--rc" + p + ")", k = esc(e.k);
  // das Band steht um RAND eingerueckt: seine Striche zaehlen von dort
  const strich = '<i class="drstrich" data-k="' + k + '" data-i="' + i + '" style="left:' + (x - RAND - 1).toFixed(1) + "px;--c:" + c + '"></i>';
  if(r < 0) return {stiel: "", sym: "", strich};
  const y = bandY - (r + 1) * ETH + (ETH - PLATTE) / 2;
  const b = g.bild.has(e.name) ? p : null;
  return {strich, stiel:
    '<i class="drstiel" data-k="' + k + '" data-i="' + i + '" style="left:' + Math.round(x) + "px;top:" + (y + PLATTE) + "px;height:" +
      (bandY - y - PLATTE) + "px;--c:" + c + '"></i>', sym:
    '<span class="drsym' + (b == null ? (sk?.rest ? " leer hatch" : " leer") : "") + '" data-k="' + k + '" data-i="' + i + '" data-t="' + e.t + '"' +
      ' style="left:' + (x - PLATTE / 2).toFixed(1) + "px;top:" + y + "px;--c:" + c + (b != null ? ";background-image:var(--ri" + b + ")" : "") + '"></span>'};
}
/* Stille schraffiert, und jede traegt ihre Dauer (Luecken 3.5), auf Zehntel
   gerundet wie secs1 (Entscheidung vom 29.09., an Claude
   uebertragen): 2,96 s zeigt "3,0 s". Bei jeder Breite gleich gross, unter
   dem Band mittig zur Stille - ist das Feld schmaler als die Marke, ragt sie
   darueber hinaus. Was Stille ist, sagt der Satz ueber der Leiste. */
function stilleTeil(s: Stille, X: (ms: number) => number): string {
  const w = X(s.bis) - X(s.von);
  return '<b class="drstill" style="left:' + (X(s.von) - RAND).toFixed(1) + "px;width:" + w.toFixed(1) + 'px">' +
    "<span>" + esc(t("deinerot.still", {s: secs1((s.bis - s.von) / 1000)})) + "</span></b>";
}
// Unverwundbar im eigenen ruhigen Band (Issue #37); ein eigener Behaelter, weil das letzte Stueck unter Live waechst
function invTeil(seg: Fight, X: (ms: number) => number, pxs: number): string {
  let html = "";
  for(const u of unverwundbarOf(seg)){
    html += '<b class="drinv" style="left:' + (X(u.from * 1000) - RAND).toFixed(1) + "px;width:" + ((u.to - u.from) * pxs).toFixed(1) + 'px"></b>';
  }
  return html;
}
const punktTeil = (e: Stand["einsaetze"][number], X: (ms: number) => number) =>
  '<i data-k="' + esc(e.k) + '" style="left:' + (X(e.t) - 2).toFixed(1) + 'px"></i>';
// die Marken fuer den Tooltip, immer ganz neu: die Einsaetze des letzten Takts koennen noch Treffer bekommen haben
function marken(st: Stand, gezeigt: Stand["einsaetze"], sitz: number[], X: (ms: number) => number, bandY: number): RotationMark[] {
  const marks: RotationMark[] = [];
  gezeigt.forEach((e, i) => {
    const r = sitz[i]!;
    if(r < 0) return;
    marks.push({x: X(e.t), y: bandY - (r + 1) * ETH + (ETH - PLATTE) / 2, mh: PLATTE, cast: e.cast, name: e.name, sid: st.sidOf.get(e.name) ?? ""});
  });
  return marks;
}

/* Die Leiste bauen: der ganze Kampf auf der Breite (Neugestaltung 28.09.,
   Spezifikation 3: der Massstab nach dem Median-Abstand entfaellt, die
   Leiste rollt nicht mehr in sich). Unter Live zeigt sie mit Vorlauf mehr
   als den Kampf (leistenDauer) und haengt beim wachsenden Kampf nur an,
   wenn das geht (buehneAnhaengen), sonst ganz - mit derselben Dauer, damit
   ein voller Bau alles dorthin setzt, wo das Anhaengen es hinsetzte.
   Seit Aufgabe 10 zeigt sie das Fenster des Zeitverlaufs (rotWindow): ohne
   Von/bis von 0 bis zur Dauer, gezoomt auf der vielfachen Breite (breite ist
   achsenBreite, 25). Angehaengt wird nur ohne Zoom und Fenster - die
   Struktur traegt beides. */
function buehneBauen(st: Stand, gezeigt: Stand["einsaetze"], auto: Stand["einsaetze"], stille: Stille[], breite: number,
    struktur: string, wachsend: boolean): Buehne {
  const T = Math.max(1, st.seg.stats.seconds || 1) * 1000;
  const alt = gebaut;
  const selbe = !!alt && alt.start === st.seg.start && alt.breite === breite;
  const dauer = leistenDauer(T, selbe ? alt!.dauer : null, wachsend);
  const {a, b} = rotWindow(st.seg);
  const von = a * 1000, bis = state.rotTo == null ? Math.max(b * 1000, dauer) : b * 1000;
  if(wachsend && selbe && alt!.dauer === dauer && alt!.struktur === struktur && von === 0 && alt!.von === 0 && alt!.bis === bis){
    const bu = buehneAnhaengen(st, alt!, gezeigt, auto, stille, T);
    if(bu) return bu;
  }
  // dieselbe Formel wie der Zeitverlauf (achsenPxs, 25): breite ist schon achsenBreite
  return buehneGanz(st, gezeigt, auto, stille, T, dauer, von, bis, achsenPxs(breite, (bis - von) / 1000), struktur, breite);
}

function buehneGanz(st: Stand, gezeigt: Stand["einsaetze"], auto: Stand["einsaetze"], stille: Stille[], T: number, dauer: number,
    von: number, bis: number, pxs: number, struktur: string, breite: number): Buehne {
  const X = (ms: number) => RAND + (ms - von) / 1000 * pxs;
  // so breit wie die Spalte mal Zoom: unter Live bleibt rechts Platz fuer den Vorlauf, nichts Erfundenes
  const W = breite;
  // was ausserhalb des Fensters liegt, wird nicht gebaut (AUSSEN); die Etagen zaehlen nur, was drin ist
  const drin = (ms: number) => ms >= von && ms <= bis;
  const platz = new Array<number>(etagenZahl()).fill(-1e9);
  const innenI: number[] = [];
  gezeigt.forEach((e, i) => { if(drin(e.t)) innenI.push(i); });
  const sitzDrin = etagenFort(innenI.map(i => X(gezeigt[i]!.t)), PLATTE, LUFT, platz);
  const sitz = new Array<number>(gezeigt.length).fill(AUSSEN);
  innenI.forEach((i, j) => { sitz[i] = sitzDrin[j]!; });
  const hoch = Math.max(1, ...sitz.map(r => r + 1));
  const bandY = OBEN + hoch * ETH;
  // unter dem Band die Marken der Stille, darunter die Punktreihe
  const punkteY = bandY + BAND + 4 + (stille.length ? STILL : 0);
  const H = punkteY + (auto.length ? PUNKTE : 0) + UNTEN;
  /* Die Bilder je Faehigkeit einmal als Variable am Behaelter, nicht an jedem
     der dreihundert Symbole - eine data:-URL ist ein paar Kilobyte lang.
     Die Reihenfarbe ebenso (Stufe 2), damit ein Wechsel der Rangfolge unter
     Live nur die Variable aendert. */
  const platzVon = new Map<string, number>(), bild = new Set<string>(), farben: string[] = [];
  const vars: string[] = [];
  st.lanes.forEach((sk, i) => {
    platzVon.set(sk.name, i);
    farben.push(farbeVon(sk));
    vars.push("--rc" + i + ":" + farben[i]);
    const u = skillIcon(sk.name, st.sidOf.get(sk.name));
    if(u){ bild.add(sk.name); vars.push("--ri" + i + ":url(" + u + ")"); }
  });
  let stiele = "", syms = "", striche = "", ohneBild = 0;
  gezeigt.forEach((e, i) => {
    if(sitz[i] === AUSSEN) return;
    const teil = einsatzTeile(st, e, i, X(e.t), sitz[i]!, bandY, {platzVon, bild});
    stiele += teil.stiel; syms += teil.sym; striche += teil.strich;
    if(sitz[i]! < 0) ohneBild++;
  });
  const inv = invTeil(st.seg, X, pxs);
  // ein Mitglied ohne geteilte Einsaetze: das Band sagt es, statt leer zu stehen (Luecken 3.12)
  const band = stille.map(s => stilleTeil(s, X)).join("") + '<span class="drinvs">' + inv + "</span>" +
    (st.leer ? '<span class="drleerband">' + esc(t("deinerot.leerband")) + "</span>" : "");
  let punkte = "";
  if(auto.length){
    punkte = '<div class="drpunkte" aria-hidden="true" style="top:' + punkteY + "px;width:" + W + 'px"><span>' + esc(t("deinerot.punkte")) + "</span>" +
      auto.filter(e => drin(e.t)).map(e => punktTeil(e, X)).join("") + "</div>";
  }
  const html = '<div class="drflaeche" style="width:' + W + "px;height:" + H + 'px">' +
    stiele + syms +
    '<div class="drband" style="top:' + bandY + "px;left:" + RAND + "px;width:" + (W - 2 * RAND) + 'px">' + band +
    striche + "</div>" +
    punkte +
    /* der Abspielkopf (Stufe 2), zuletzt, damit er ueber allem liegt; seine Lage setzt anwenden(). Er reicht bis
       an den Fuss der Flaeche, wo der Strich im Zeitverlauf (#stackKopf) weiterlaeuft - ohne Luecke (Fixrunde 1). */
    '<i class="drabkopf" aria-hidden="true" style="top:' + (OBEN - 6) + "px;height:" + (H - OBEN + 6) + 'px"></i></div>';
  /* Die Variablen stehen am Behaelter, nicht an der Flaeche: unter Live
     waechst die Flaeche je Takt in der Breite, und ihr style trug sonst jedes
     Mal die Bilder mit (ein paar Kilobyte je Faehigkeit). */
  const bar = $("#rotBar"), v = vars.join(";");
  if(v !== letzteVars){ bar.style.cssText = v; letzteVars = v; }
  setzen(bar, html);
  gebaut = {start: st.seg.start, struktur, breite, dauer, von, bis, T, pxs, hoch, bandY, W, platz, sitz, gezeigt, ts: gezeigt.map(e => e.t), auto, stille, inv, punkte: auto.length > 0,
    platzVon, farben, bild, ohneBild,
    schraffiert: new Set(st.lanes.filter(sk => sk.rest && !bild.has(sk.name)).map(sk => sk.name))};
  return {marks: marken(st, gezeigt, sitz, X, bandY), ohneBild};
}

/* Anhaengen (Stufe 2): nur, wenn das Gebaute Anfang des Neuen ist - dieselben
   Einsaetze an denselben Zeiten (Ventius kann eine ganze Familie umbenennen),
   dieselbe Stille, die Punktreihe da oder nicht da wie vorher, und keiner der
   neuen Einsaetze braucht eine Etage mehr (sonst rutschte das Band). Die
   Etagen folgen derselben Regel wie am Stueck (etagenFort): was angehaengt
   wird, steht genau dort, wo ein voller Bau mit derselben Dauer es
   hinsetzte. null: bitte ganz bauen. */
function buehneAnhaengen(st: Stand, alt: Gebaut, gezeigt: Stand["einsaetze"], auto: Stand["einsaetze"], stille: Stille[], T: number): Buehne | null {
  const n = alt.gezeigt.length;
  if(gezeigt.length < n || stille.length < alt.stille.length || (auto.length > 0) !== alt.punkte)return null;
  // die erste Stille schiebt Punktreihe und Achse nach unten (Platz fuer ihre Marke): ganz bauen
  if((stille.length > 0) !== (alt.stille.length > 0)) return null;
  for(let i = 0; i < n; i++) if(gezeigt[i]!.k !== alt.gezeigt[i]!.k || gezeigt[i]!.t !== alt.gezeigt[i]!.t)return null;
  if(auto.length < alt.auto.length)return null;
  for(let i = 0; i < alt.auto.length; i++) if(auto[i]!.k !== alt.auto[i]!.k || auto[i]!.t !== alt.auto[i]!.t)return null;
  for(let i = 0; i < alt.stille.length; i++) if(stille[i]!.von !== alt.stille[i]!.von || stille[i]!.bis !== alt.stille[i]!.bis)return null;
  const bar = $("#rotBar");
  const flaeche = bar.querySelector<HTMLElement>(".drflaeche");
  const band = flaeche?.querySelector<HTMLElement>(".drband");
  if(!flaeche || !band) return null;
  const {pxs, bandY} = alt;
  const X = (ms: number) => RAND + (ms - alt.von) / 1000 * pxs;
  const neu = gezeigt.slice(n);
  const platz = [...alt.platz];
  const sitzNeu = etagenFort(neu.map(e => X(e.t)), PLATTE, LUFT, platz);
  if(sitzNeu.some(r => r + 1 > alt.hoch))return null;
  // ist der Kampf kuerzer geworden (T sinkt bei gleichen Einsaetzen), stimmt die Achse nicht mehr: ganz bauen
  if(T < alt.T) return null;
  /* Die Rangfolge hat sich verschoben: nur die Farben der Plaetze wechseln,
     und ohne Bild die Schraffur, die ab Rang 13 gilt. */
  const farben = [...alt.farben], schraffiert = new Set<string>();
  const platzVon = new Map(alt.platzVon), bild = new Set(alt.bild);
  for(const sk of st.lanes){
    let p = platzVon.get(sk.name);
    if(p == null){
      // eine Faehigkeit, die erst jetzt auftaucht: ein neuer Platz, ihre Einsaetze sind alle neu (Anfang geprueft)
      p = farben.length;
      platzVon.set(sk.name, p);
      farben.push("");
      const u = skillIcon(sk.name, st.sidOf.get(sk.name));
      if(u){ bild.add(sk.name); bar.style.setProperty("--ri" + p, "url(" + u + ")"); }
    }
    const c = farbeVon(sk);
    if(farben[p] !== c){ farben[p] = c; bar.style.setProperty("--rc" + p, c); }
    const schraff = !!sk.rest && !bild.has(sk.name);
    if(schraff) schraffiert.add(sk.name);
    if(schraff !== alt.schraffiert.has(sk.name)){
      const k = st.keyOf.get(sk.name);
      flaeche.querySelectorAll<HTMLElement>(".drsym.leer").forEach(el => { if(el.dataset.k === k) el.classList.toggle("hatch", schraff); });
    }
  }
  let stiele = "", syms = "", striche = "", ohneBild = alt.ohneBild;
  neu.forEach((e, j) => {
    const teil = einsatzTeile(st, e, n + j, X(e.t), sitzNeu[j]!, bandY, {platzVon, bild});
    stiele += teil.stiel; syms += teil.sym; striche += teil.strich;
    if(sitzNeu[j]! < 0) ohneBild++;
  });
  /* Dieselbe Reihenfolge wie im vollen Bau - erst alle Stiele, dann alle
     Symbole, im Band erst die Stille, dann die Striche -, damit ueber- und
     untereinander gemalt wird wie dort. */
  if(stiele) (flaeche.querySelector(".drsym") ?? band).insertAdjacentHTML("beforebegin", stiele);
  if(syms) band.insertAdjacentHTML("beforebegin", syms);
  const stilleNeu = stille.slice(alt.stille.length).map(s => stilleTeil(s, X)).join("");
  if(stilleNeu) (band.querySelector(".drinvs") ?? band.querySelector(".drstrich"))?.insertAdjacentHTML("beforebegin", stilleNeu);
  if(striche) band.insertAdjacentHTML("beforeend", striche);
  const inv = invTeil(st.seg, X, pxs);
  if(inv !== alt.inv){ const box = band.querySelector<HTMLElement>(".drinvs"); if(box) box.innerHTML = inv; }
  const punkte = flaeche.querySelector<HTMLElement>(".drpunkte");
  if(punkte){
    if(auto.length > alt.auto.length) punkte.insertAdjacentHTML("beforeend", auto.slice(alt.auto.length).map(e => punktTeil(e, X)).join(""));
  }
  // was gesetzt wurde, stimmt nicht mehr mit dem HTML ueberein: der naechste volle Bau setzt in jedem Fall
  gesetzt.delete(bar);
  letzteVars = bar.style.cssText;
  const sitz = [...alt.sitz, ...sitzNeu];
  gebaut = {...alt, T, platz, sitz, gezeigt, ts: gezeigt.map(e => e.t), auto, stille, inv, farben, platzVon, bild, schraffiert, ohneBild};
  if(hebtK != null) hervorheben(hebtK);
  return {marks: marken(st, gezeigt, sitz, X, bandY), ohneBild};
}

/* ---------- Abspielen (Stufe 2, Spezifikation 5.5 bis 5.7) ----------
   Ein Kopf in --rot-kopf (Gold heisst hier Auswahl) laeuft ueber die
   Leiste, der aktuelle Einsatz steht groesser und golden gerahmt,
   Vergangenes blasser; darueber "Jetzt" mit den naechsten drei. 1x ist
   Echtzeit, Stille ueber 3 s laeuft in 1 s durch (abspielUhr). Bewegung nur
   auf Klick oder Taste: requestAnimationFrame laeuft nur, solange
   abgespielt wird, und unter reduzierter Bewegung springt der Kopf von
   Einsatz zu Einsatz. Der Zustand haengt an der Nummer des Einsatzes und an
   der Kampfzeit. Unter Live ist Abspielen beim wachsenden Kampf gesperrt. */
const spiel = {
  /** der Kampf, zu dem der Stand gehoert (seg.start) */
  start: NaN,
  /** der aktuelle Einsatz unter den gezeigten, und woran er zu erkennen ist */
  i: 0, id: "",
  /** die Kampfzeit des Kopfes in ms */
  ms: 0,
  laeuft: false, tempo: 1, raf: 0, zuletzt: 0,
  gesperrt: false,
};
/* Was an der Leiste markiert ist: der Einsatz mit .jetzt und wie weit .war
   reicht. Die Elemente je Einsatz einmal gesammelt (data-i), fuer den Bau,
   zu dem sie gehoeren. */
let teile: { g: Gebaut; je: HTMLElement[][]; jetzt: number; warBis: number; kopf: HTMLElement | null } | null = null;
let uhrVon: { g: Gebaut; uhr: AbspielUhr } | null = null;
const ruhig = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const dez = () => state.lang === "de" ? "," : ".";
const zeitText = (ms: number) => uhrZehntel(ms, dez());
const einsatzId = (e: Stand["einsaetze"][number] | undefined) => e ? e.k + "@" + e.t : "";

function teileVon(g: Gebaut){
  if(teile && teile.g === g) return teile;
  /* Die Einsaetze der Leiste und, wenn sie gebaut ist, die der Reihenfolge
     (Aufgabe 11): beide tragen data-i, der Kopf markiert sie zugleich. */
  const boxen = [$("#rotBar"), $("#drReihe")];
  const je: HTMLElement[][] = g.gezeigt.map(() => []);
  for(const box of boxen) box.querySelectorAll<HTMLElement>("[data-i]:not(.geht)").forEach(el => { const i = +el.dataset.i!; je[i]?.push(el); });
  /* Nach einem Anhaengen stehen die alten Marken noch; nach einem vollen Bau
     sind sie mit den Elementen weg (ein neuer Bau der Reihe setzt teile). */
  const weiterGebaut = teile && teile.kopf?.isConnected;
  // sonst von vorn: was noch markiert ist (Block verborgen und wieder da, ohne Neubau), wird frei
  if(!weiterGebaut) for(const box of boxen) box.querySelectorAll<HTMLElement>(".jetzt, .war").forEach(el => el.classList.remove("jetzt", "war"));
  teile = {g, je, jetzt: weiterGebaut ? teile!.jetzt : -1, warBis: weiterGebaut ? teile!.warBis : 0,
    kopf: boxen[0]!.querySelector<HTMLElement>(".drabkopf")};
  return teile;
}
// eine Stille ueber 3 s laeuft in 1 s durch (abspielUhr)
function uhrFuer(g: Gebaut): AbspielUhr {
  if(!uhrVon || uhrVon.g !== g) uhrVon = {g, uhr: abspielUhr(g.stille)};
  return uhrVon.uhr;
}

/* Den Stand an die Leiste, "Jetzt" und die Uhr bringen. Nur was sich
   geaendert hat: .war wechselt fuer die Einsaetze zwischen altem und neuem
   Stand, "Jetzt" nur bei einem anderen Einsatz. folgen: beim Abspielen und
   bei einem Schritt rollt eine gezoomte Leiste mit dem Kopf (Aufgabe 10) -
   sonst liefe er aus dem Bild; der Zeitverlauf rollt mit (setup). */
function anwenden(folgen = false){
  const g = gebaut, st = letzter;
  if(!g || !st || g.gezeigt.length < 3){ setzeStackKopf(null); return; }
  const n = g.gezeigt.length;
  const i = Math.min(spiel.i, n - 1);
  const tl = teileVon(g);
  if(tl.jetzt !== i){
    if(tl.jetzt >= 0) for(const el of tl.je[tl.jetzt] ?? []) el.classList.remove("jetzt");
    for(const el of tl.je[i] ?? []) if(!el.classList.contains("drstiel")) el.classList.add("jetzt");
    tl.jetzt = i;
  }
  uhrUndJetzt(st, g, i);
  if(tl.warBis !== i){
    const [von, bis, an] = tl.warBis < i ? [tl.warBis, i, true] : [i, tl.warBis, false];
    for(let j = von; j < bis; j++) for(const el of tl.je[j] ?? []) el.classList.toggle("war", an);
    tl.warBis = i;
  }
  // unter reduzierter Bewegung steht der Kopf nur an Einsaetzen, sonst gleitet er mit der Kampfzeit
  const ms = spiel.laeuft && ruhig() ? g.gezeigt[i]!.t : spiel.ms;
  const x = RAND + (ms - g.von) / 1000 * g.pxs;
  if(tl.kopf) tl.kopf.style.transform = "translateX(" + x.toFixed(1) + "px)";
  // derselbe Kopf in jeder Zeile des Takts (48-einsaetze.ts) und als Strich durch den Zeitverlauf (24)
  taktKopf($("#drGed"), ms / g.dauer);
  setzeStackKopf(ms);
  if(folgen){
    const box = $("#deineRotScroll"), w = box.clientWidth;
    if(box.scrollWidth > w + 1 && (x < box.scrollLeft + RAND || x > box.scrollLeft + w - RAND)) box.scrollLeft = Math.max(0, x - w / 3);
  }
  if(reiheAn()){
    pausenMarken(i);
    if(folgen) reiheRollen(tl.je[i]?.find(el => el.classList.contains("drk")));
  }
}

/* "Jetzt" neu, wenn der Einsatz, die Zahl der Einsaetze oder die Sprache
   wechselt; die Uhr nur bei einem neuen Zehntel. */
let jetztSig = "";
function uhrUndJetzt(st: Stand, g: Gebaut, i: number){
  const sig = i + "/" + g.gezeigt.length + "/" + state.lang + "/" + g.start;
  if(jetztSig !== sig){ jetztSig = sig; jetztZeigen(st, g, i); }
  // unter reduzierter Bewegung steht die Uhr beim Laufen am Einsatz, wie der Kopf
  const u = zeitText(spiel.laeuft && ruhig() ? g.gezeigt[i]!.t : spiel.ms);
  const uhr = $("#drUhr");
  if(uhr.textContent !== u) uhr.textContent = u;
  // daneben die Dauer des Kampfs, "/ 1:00,2" wie im Entwurf
  const gesamt = "/ " + zeitText(g.T), gb = $("#drGesamt");
  if(gb.textContent !== gesamt) gb.textContent = gesamt;
}

function jetztZeigen(st: Stand, g: Gebaut, i: number){
  const box = $("#drJetzt");
  const sym = (e: Stand["einsaetze"][number], klein = false) => {
    const u = skillIcon(e.name, st.sidOf.get(e.name));
    return '<span class="drjsym' + (klein ? " klein" : "") + (u ? "" : " leer") + '" aria-hidden="true" style="--c:' + farbeVon(st.reihe.get(e.name)) +
      (u ? ";background-image:url(" + u + ")" : "") + '"></span>';
  };
  const e = g.gezeigt[i]!, n = g.gezeigt.length;
  const name = (x: Stand["einsaetze"][number]) => skillLabel(x.name, st.sidOf.get(x.name));
  let danach = "";
  for(let j = i + 1; j <= i + 3 && j < n; j++){
    const d = g.gezeigt[j]!;
    danach += "<li>" + sym(d, true) + '<span class="vh">' + esc(name(d)) + " </span>" + esc("+" + secs1((d.t - e.t) / 1000)) + "</li>";
  }
  /* Wie im Entwurf: links das Symbol gross, daneben "Jetzt", Name und
     Stelle; rechts hinter einer Fuge "danach" mit den naechsten drei, je
     Symbol und Abstand darunter. */
  box.innerHTML = '<span class="drj1"><span class="drjk">' + esc(t("deinerot.jetzt")) + "</span>" + sym(e) +
    '<span class="drjtext"><b>' + esc(name(e)) + '</b><span class="drjpos">' + esc(t("deinerot.pos", {i: i + 1, n, t: zeitText(e.t)})) + "</span></span></span>" +
    (danach ? '<span class="drj2"><span class="drjk drjdanach">' + esc(t("deinerot.danach")) + '</span><ol class="drdanach">' + danach + "</ol></span>" : "");
}

function knopfZeigen(){
  const b = $<HTMLButtonElement>("#drPlay");
  b.setAttribute("aria-pressed", String(spiel.laeuft));
  b.title = t(spiel.laeuft ? "deinerot.pauseTitel" : "deinerot.playTitel");
}

/* Einmal sagen, wo der Kopf steht - bei einem Schritt und beim Anhalten,
   nie waehrend des Abspielens (Spezifikation 5.6). */
function sagen(){
  const g = gebaut, st = letzter;
  if(!g || !st) return;
  const i = Math.min(spiel.i, g.gezeigt.length - 1), e = g.gezeigt[i]!;
  $("#drLive").textContent = t("deinerot.schritt", {i: i + 1, n: g.gezeigt.length, name: skillLabel(e.name, st.sidOf.get(e.name)), t: zeitText(e.t)});
}

function anhalten(sagenAuch: boolean){
  if(spiel.raf) cancelAnimationFrame(spiel.raf);
  spiel.raf = 0;
  if(!spiel.laeuft) return;
  spiel.laeuft = false;
  /* Unter reduzierter Bewegung stand der Kopf waehrend des Laufens nur an
     Einsaetzen; angehalten steht er dort auch, mit Uhr, nicht dazwischen. */
  const g = gebaut;
  if(g && ruhig() && g.ts.length) spiel.ms = g.ts[Math.min(spiel.i, g.ts.length - 1)]!;
  knopfZeigen();
  anwenden();
  if(sagenAuch) sagen();
}

function abspielen(){
  const g = gebaut;
  if(!g || spiel.gesperrt || g.gezeigt.length < 3 || spiel.laeuft) return;
  const n = g.gezeigt.length, ende = g.ts[n - 1]!;
  // am Ende: von vorn
  if(spiel.i >= n - 1 && spiel.ms >= ende) gehe(0, false);
  spiel.laeuft = true;
  spiel.zuletzt = performance.now();
  knopfZeigen();
  spiel.raf = requestAnimationFrame(bild);
}

function bild(jetzt: number){
  spiel.raf = 0;
  const g = gebaut;
  if(!spiel.laeuft || !g) return;
  // anhalten bei Reiterwechsel, verborgenem Fenster, Sperre
  if(state.tab !== "rotation" || document.hidden || spiel.gesperrt || $("#deineRot").hidden){ anhalten(false); return; }
  // ein Bild, das lange auf sich warten liess, springt nicht ueber halbe Kaempfe
  const dt = Math.min(250, Math.max(0, jetzt - spiel.zuletzt));
  spiel.zuletzt = jetzt;
  const n = g.gezeigt.length, ende = g.ts[n - 1]!;
  const ms = weiter(uhrFuer(g), spiel.ms, dt, spiel.tempo);
  if(ms >= ende){
    spiel.ms = ende; spiel.i = n - 1; spiel.id = einsatzId(g.gezeigt[n - 1]);
    anwenden(true);
    anhalten(true);
    return;
  }
  spiel.ms = ms;
  const i = Math.max(0, einsatzBei(g.ts, ms));
  if(i !== spiel.i){ spiel.i = i; spiel.id = einsatzId(g.gezeigt[i]); }
  anwenden(true);
  spiel.raf = requestAnimationFrame(bild);
}

/* Auf einen Einsatz gehen (Schritt, Pos1, Ende): haelt an, der Kopf steht
   auf dem Einsatz. */
function gehe(i: number, sagenAuch = true){
  const g = gebaut;
  if(!g || g.gezeigt.length < 3) return;
  anhalten(false);
  const n = g.gezeigt.length;
  spiel.i = Math.max(0, Math.min(n - 1, i));
  spiel.ms = g.gezeigt[spiel.i]!.t;
  spiel.id = einsatzId(g.gezeigt[spiel.i]);
  anwenden(true);
  if(sagenAuch) sagen();
}

/* Nach jedem Zeichnen des Blocks: ein anderer Kampf faengt bei Einsatz 1
   an, sonst bleibt der Kopf bei seinem Einsatz (nach einer Wahl kann er eine
   andere Nummer haben) oder bei seiner Kampfzeit. */
function spielNachZeichnen(seg: Fight){
  const g = gebaut;
  const zeigen = !!g && g.gezeigt.length >= 3;
  /* Ein Mitglied ohne geteilte Einsaetze (Fixrunde 1, folgt Entwurf
     .rsteuer.still): die Steuerzeile bleibt gedimmt stehen, Abspielen und
     Tempo sind aus, "Jetzt" sagt "keine Einsaetze", die Uhr nennt die Dauer.
     Beim eigenen Kampf unter drei Einsaetzen bleibt sie verborgen. */
  const leer = !!letzter?.leer;
  const steuer = $("#drSteuer");
  steuer.hidden = !zeigen && !leer;
  steuer.classList.toggle("still", leer);
  $("#drJetzt").hidden = !zeigen && !leer;
  spiel.gesperrt = waechst();
  const knopf = $<HTMLButtonElement>("#drPlay");
  knopf.disabled = spiel.gesperrt || leer;
  $("#drTempo").querySelectorAll<HTMLButtonElement>("button").forEach(b => { b.disabled = leer; });
  // ohne geteilte Einsaetze gibt es keine Reihenfolge (Aufgabe 11): der Umschalter ist aus wie das Tempo
  $("#drAnsicht").querySelectorAll<HTMLButtonElement>("button").forEach(b => { b.disabled = leer; });
  $("#drSperre").hidden = !spiel.gesperrt;
  if(leer){
    anhalten(false); teile = null; jetztSig = ""; setzeStackKopf(null);
    $("#drUhr").textContent = zeitText(0);
    $("#drGesamt").textContent = "/ " + zeitText(Math.max(1, seg.stats.seconds || 1) * 1000);
    $("#drJetzt").innerHTML = '<span class="drj1"><span class="drjk">' + esc(t("deinerot.jetzt")) + '</span><span class="drjsym leer" aria-hidden="true"></span>' +
      '<span class="drjtext"><b>\u2013</b><span class="drjpos">' + esc(t("deinerot.keineEinsaetze")) + "</span></span></span>";
    return;
  }
  if(!zeigen || !g){ anhalten(false); teile = null; setzeStackKopf(null); return; }
  if(spiel.gesperrt) anhalten(false);
  const n = g.gezeigt.length;
  if(spiel.start !== seg.start){
    anhalten(false);
    spiel.start = seg.start;
    spiel.i = 0; spiel.ms = g.gezeigt[0]!.t; spiel.id = einsatzId(g.gezeigt[0]);
    $("#deineRotScroll").scrollLeft = 0;
    $("#drFolge").scrollTop = 0; reiheGerollt = null;
  } else if(einsatzId(g.gezeigt[spiel.i]) !== spiel.id){
    const j = g.gezeigt.findIndex(e => einsatzId(e) === spiel.id);
    spiel.i = j >= 0 ? j : Math.max(0, Math.min(n - 1, einsatzBei(g.ts, spiel.ms)));
    if(j < 0 && !spiel.laeuft) spiel.ms = g.gezeigt[spiel.i]!.t;
    spiel.id = einsatzId(g.gezeigt[spiel.i]);
  }
  knopfZeigen();
  anwenden();
}

/** Der Stand, den der Block zuletzt gezeichnet hat - die Knoepfe der Spalte handeln darauf. */
let letzter: Stand | null = null;

/* Der Satz im Kopf in Teilen: was gezaehlt ist, was nur als Strich im
   Band steht, was ausgeschaltet ist, und was die Flaeche zeigt. Striche und
   der Satz ueber die Stille im Band gelten nur fuer die Leiste; in der
   Reihenfolge sagt ein eigener Satz, was die Reihe zeigt und dass Zeitachse,
   Zoom und Von/bis im Zeitverlauf darunter gelten (Aufgabe 11). */
let leadTeile = {vor: "", striche: "", nach: "", leiste: "", reihe: ""};
function leadSetzen(){
  const r = reiheAn();
  const text = leadTeile.vor + (r ? "" : leadTeile.striche) + leadTeile.nach + (r ? leadTeile.reihe : leadTeile.leiste);
  const el = $("#deineRotLead");
  if(el.textContent !== text) el.textContent = text;
}

/* ---------- die Reihenfolge (Aufgabe 11, Nachtrag 29.09.) ----------
   Gewuenscht: "In der Rotation konnte man zwischen der Leiste und einer
   einfachen Reihenfolge umschalten. Das haette ich gerne wieder." Vorlage
   ist die Folge vor der Neugestaltung (6b72131) ohne Durchgaenge und
   Massstab: die gezeigten Einsaetze der Leiste (dieselben, das Auge gilt
   auch hier) als Reihe von 32-Punkt-Symbolen in der Reihenfolge des
   Kampfes, in gleichem Abstand und umbrechend, ohne Zeitachse; eine Stille
   steht als Feld mit ihrer Dauer vor dem ersten Einsatz danach (stilleVor).
   Die Leiste bleibt gebaut - sie haelt die Nummern der Einsaetze, und der
   Kopf markiert beide zugleich (teileVon). Der Zeitverlauf bleibt darunter
   stehen (Entscheidung vom 29.09., an Claude uebertragen): er ist
   die Zeitachse, die der Reihe fehlt, sein Strich laeuft beim Abspielen
   weiter, und in der Reihe ist statt des Strichs der laufende Einsatz
   hervorgehoben. Die Wahl gilt fuer die Sitzung (kein Speicherschluessel);
   gebaut wird die Reihe nur, wenn sie gezeigt wird. */
const ansicht = {reihe: false};
const reiheAn = () => ansicht.reihe && !$("#drFolge").hidden;
/** Wo in der Reihe eine Stille steht (Nummer des Einsatzes danach), fuer den Bau, der gerade steht. */
let reiheVor = new Map<number, Stille>();
/** zaehlt jedes neue Setzen der Reihe - die Marken der Stillen gelten nur fuer die Reihe, die sie gesetzt haben */
let reiheStand = 0;

function kachelHtml(st: Stand, g: Gebaut, e: Stand["einsaetze"][number], i: number): string {
  const sk = st.reihe.get(e.name), p = g.platzVon.get(e.name);
  const c = p == null ? farbeVon(sk) : "var(--rc" + p + ")", b = g.bild.has(e.name) ? p : null;
  return '<span class="drk" data-i="' + i + '" data-k="' + esc(e.k) + '" data-t="' + e.t + '" aria-hidden="true"' +
    ' title="' + esc(skillLabel(e.name, st.sidOf.get(e.name)) + " \u00b7 " + zeitText(e.t)) + '">' +
    '<span class="drksym' + (b == null ? (sk?.rest ? " leer hatch" : " leer") : "") + '" style="--c:' + c + (b != null ? ";background-image:var(--ri" + b + ")" : "") + '"></span></span>';
}
const pauseHtml = (s: Stille, j: number) => {
  const d = esc(t("deinerot.still", {s: secs1((s.bis - s.von) / 1000)}));
  return '<span class="drpause" data-vor="' + j + '" aria-hidden="true">' + d + "</span>";
};

/* Leiste oder Reihe zeigen (nach jedem Zeichnen und beim Umschalten). Unter
   drei Einsaetzen und beim Mitglied ohne geteilte Einsaetze gibt es keine
   Reihe - dort steht die Leiste mit ihrem Satz. */
function reiheZeigen(){
  const st = letzter, g = gebaut, box = $("#drFolge");
  const zeigen = ansicht.reihe && !!st && !!g && !st.leer && g.gezeigt.length >= 3;
  if(box.hidden === zeigen){
    // der Fokus geht mit: wer auf der verborgenen Flaeche stand, steht auf der gezeigten
    const hatte = document.activeElement === box || document.activeElement === $("#deineRotScroll");
    box.hidden = !zeigen;
    $("#deineRotScroll").classList.toggle("zu", zeigen);
    $("#zvRaster").classList.toggle("reihe", zeigen);
    if(hatte) (zeigen ? box : $("#deineRotScroll")).focus({preventScroll: true});
  }
  leadSetzen();
  if(!zeigen || !st || !g) return;
  // Farbe und Bild je Spur wie an der Leiste (--rcN, --riN)
  const reihe = $("#drReihe"), v = $("#rotBar").style.cssText;
  if(reihe.style.cssText !== v) reihe.style.cssText = v;
  reiheVor = stilleVor(g.ts, g.stille);
  let html = "";
  g.gezeigt.forEach((e, i) => { const s = reiheVor.get(i); if(s) html += pauseHtml(s, i); html += kachelHtml(st, g, e, i); });
  if(setzen(reihe, html)){ reiheStand++; teile = null; }
  if(hebtK != null) hervorheben(hebtK);
  anwenden();
}

/* Eine Stille gilt als vorbei, sobald der Einsatz danach laeuft; neu gesetzt
   wird nur bei einem anderen Einsatz oder einer neu gebauten Reihe. */
let pauseSig = "";
function pausenMarken(i: number){
  const sig = i + "/" + reiheStand;
  if(sig === pauseSig) return;
  pauseSig = sig;
  $("#drReihe").querySelectorAll<HTMLElement>(".drpause").forEach(p => p.classList.toggle("war", +p.dataset.vor! <= i));
}
/* Beim Abspielen und bei einem Schritt rollt die Reihe senkrecht mit, wenn
   der laufende Einsatz aus ihrem sichtbaren Teil rutscht - gemessen nur,
   wenn er wechselt. */
let reiheGerollt: Element | null = null;
function reiheRollen(el: HTMLElement | undefined){
  if(!el || el === reiheGerollt) return;
  reiheGerollt = el;
  const box = $("#drFolge"), r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
  if(r.top < b.top || r.bottom > b.bottom) box.scrollTop = Math.max(0, Math.round(box.scrollTop + r.top - b.top - box.clientHeight / 3));
}

/* Radiogruppe "Leiste | Reihenfolge": Klick oder Pfeiltaste waehlt, ein Tabstopp. */
function ansichtSetzen(reihe: boolean, fokus: boolean){
  ansicht.reihe = reihe;
  $("#drAnsicht").querySelectorAll<HTMLElement>("[role=radio]").forEach(b => {
    const an = (b.dataset.ansicht === "reihe") === reihe;
    b.classList.toggle("on", an);
    b.setAttribute("aria-checked", String(an));
    b.tabIndex = an ? 0 : -1;
    if(an && fokus) b.focus();
  });
  reiheGerollt = null;
  reiheZeigen();
  // der Kopf steht, wo er war; die andere Ansicht holt ihn ein
  anwenden(true);
}

/* ---------- zeichnen ----------
   Nur neu bauen, was sich geaendert hat: unter Live
   zeichnet renderAll alle zwei Sekunden, und ein neu gebauter Knopf verloere
   den Fokus, eine neu gebaute Leiste ihre Hervorhebung. Was zuletzt
   gesetzt wurde, steht in einer WeakMap, nicht als Attribut am Element
   (Review #44: data-marke hielt das ganze HTML der Leiste im DOM). */
const gesetzt = new WeakMap<HTMLElement, string>();
/* Unter Live aendert sich in der Spalte je Takt meist nur eine Zahl
   ("14×", anzahlText): dann wechseln nur die Zahlen, statt die Knoepfe samt
   ihren Bildern neu zu bauen (Stufe 2). false heisst auch dann: nicht neu
   gebaut - der Fokus bleibt, wo er ist. */
const ZAHL = /<u title="([^"]*)">([^<]*)<\/u>/g;
const ENT: Record<string, string> = {"&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"'};
const unesc = (s: string) => s.replace(/&(amp|lt|gt|quot);/g, m => ENT[m]!);
function setzen(box: HTMLElement, html: string): boolean {
  const alt = gesetzt.get(box);
  if(alt === html) return false;
  if(alt !== undefined && alt.replace(ZAHL, "<u></u>") === html.replace(ZAHL, "<u></u>")){
    const us = box.getElementsByTagName("u"), neu = [...html.matchAll(ZAHL)];
    if(us.length === neu.length){
      neu.forEach((m, i) => { const u = us[i]!; u.title = unesc(m[1]!); u.textContent = unesc(m[2]!); });
      gesetzt.set(box, html);
      return false;
    }
  }
  box.innerHTML = html;
  gesetzt.set(box, html);
  return true;
}
/** Nach dem Leeren (zeitLeeren, 24): der Block baut beim naechsten Zeichnen neu. */
export function deineRotVergessen(){
  for(const id of ["#rotBar", "#drGed", "#drAuto", "#drAutoKopf", "#drReihe"]){ const el = $(id); if(el) gesetzt.delete(el); }
  letzteSig = "";
  gebaut = null;
  letzteVars = "";
}
/* Alles, wovon der Block abhaengt, als eine Zeile: der Kampf (Anfang,
   Ende, Zahl der Ereignisse, Schaden), welcher links gewaehlt ist und wessen
   Kurve, Sprache, Breite, was ausgeschaltet ist, die Wahlen der Sitzung, die Waffenzuordnung (Grund Passiv) und
   Live. Gleich wie beim letzten Mal: nichts rechnen, nichts bauen - unter
   Live aendert sich so nur etwas, wenn der gezeigte Kampf waechst. */
let letzteSig = "";
function signatur(seg: Fight, breite: number, aus: Set<string>): string {
  return [seg.start, seg.end, seg.events.length, seg.stats.total, seg.fremd ?? "", state.sel, state.zeigeMitglied ?? "",
    state.lang, breite, [...aus].join("\u0001"), JSON.stringify(state.rotSitzung), SERVED, state.origin,
    !!state.wall, state.players.length, isWatching(), JSON.stringify(state.weaponById), JSON.stringify(state.weaponOf),
    JSON.stringify(state.weaponPick), etagenZahl(), state.rotZoom, state.rotFrom ?? "", state.rotTo ?? ""].join("|");
}

/* Gemeinsam rollen (Aufgabe 10). Die Meldungen kommen erst im naechsten
   Bild: eine, die nur dem eigenen Setzen folgt, darf nichts zurueckgeben -
   sonst holte sie die andere Flaeche auf einen alten Stand zurueck (Ende
   gedrueckt, waehrend die Leiste noch ihre vorige Stelle meldete). */
const selbstGesetzt = new WeakMap<HTMLElement, number>();
function rollMit(von: HTMLElement, zu: HTMLElement){
  if(selbstGesetzt.get(von) === von.scrollLeft){ selbstGesetzt.delete(von); return; }
  selbstGesetzt.delete(von);
  if(Math.abs(zu.scrollLeft - von.scrollLeft) < 1) return;
  zu.scrollLeft = von.scrollLeft;
  selbstGesetzt.set(zu, zu.scrollLeft);
}
/** Nach dem Zeichnen (25, renderRotation): die Leiste steht, wo der Zeitverlauf steht. */
export function leisteWieZeitverlauf(){
  const zv = $("#stackScroll"), box = $("#deineRotScroll");
  if(!zv || !box || Math.abs(box.scrollLeft - zv.scrollLeft) < 1) return;
  box.scrollLeft = zv.scrollLeft;
  selbstGesetzt.set(box, box.scrollLeft);
}

/** Wie weit die Leiste zu diesem Kampf reicht (leistenDauer), in s - der
    Zeitverlauf zeichnet auf dieselbe Achse (24, stackEnde). */
export function leisteBis(seg: Fight): number | null {
  return gebaut && gebaut.start === seg.start ? gebaut.dauer / 1000 : null;
}

/** Den Block zeichnen (von renderRotation, 25-rotation.ts). null: verbergen. */
export function renderDeineRotation(seg: Fight | null){
  const block = $("#deineRot");
  if(!block) return;
  if(!seg || state.noTime || !seg.stats.skills.length){
    block.hidden = true; rotBarHit = null;
    anhalten(false); teile = null; setzeStackKopf(null);
    return;
  }
  block.hidden = false;
  if(!state.rotAus) state.rotAus = new Set();
  const aus = state.rotAus;
  // die Breite der Buehne: der ganze Kampf steht auf ihr, gezoomt auf der vielfachen Breite (wie der Zeitverlauf)
  const breite = achsenBreite($("#deineRotScroll"));
  const sig = signatur(seg, breite, aus);
  if(sig === letzteSig && letzter) return;
  let st = stand(seg);
  letzter = st;
  const f = folge(st.einsaetze, new Set(st.auto.keys()));
  // was in "Gedrueckt" ausgeschaltet ist, faellt nur aus dem Bild; die Stille rechnet mit allen gedrueckten
  const gezeigt = f.gedrueckt.filter(e => !aus.has((e as Stand["einsaetze"][number]).name)) as Stand["einsaetze"];
  /* Unter Live waechst der neueste Kampf: dann haengt die Leiste nur an,
     solange sich ausser dem Wachsen nichts geaendert hat (Stufe 2). Welche
     Einsaetze gedrueckt und welche automatisch sind, prueft das Anhaengen
     selbst: das Gebaute muss Anfang des Neuen sein. */
  const struktur = [seg.start, seg.fremd ?? "", state.zeigeMitglied ?? "", state.lang, breite, [...aus].join("\u0001"), etagenZahl(),
    state.rotZoom, state.rotFrom ?? "", state.rotTo ?? ""].join("|");
  const b = buehneBauen(st, gezeigt, f.auto as Stand["einsaetze"], f.stille, breite, struktur, waechst());

  const namen = [...st.auto.keys()].map(k => {
    const sk = st.lanes.find(l => st.keyOf.get(l.name) === k)!;
    return skillLabel(sk.name, st.sidOf.get(sk.name));
  });
  const namenText = namen.length > 1 ? namen.slice(0, -1).join(", ") + " " + t("common.and") + " " + namen[namen.length - 1] : namen[0] ?? "";
  const lead = f.gedrueckt.length || !f.auto.length
    ? t("deinerot.lead", {n: f.gedrueckt.length, m: namen.length, namen: namenText})
    : t("deinerot.alleAuto");
  const zahl = gezeigt.length !== f.gedrueckt.length ? t("rotation.barCount", {n: gezeigt.length, all: f.gedrueckt.length}) : "";
  const ausHier = st.lanes.filter(sk => aus.has(sk.name) && !st.auto.has(st.keyOf.get(sk.name)!)).length;
  // der Satz sagt, was Stille ist (Luecken 3.4, Entwurf); beim Mitglied ohne geteilte Einsaetze nur, warum nichts da ist
  const wer = mitgliedName(seg.fremd ?? "");
  leadTeile = st.leer ? {vor: t("deinerot.mitgliedLeer", {name: wer}), striche: "", nach: "", leiste: "", reihe: ""}
    : {vor: lead + zahl, striche: b.ohneBild ? t("deinerot.striche", {n: b.ohneBild}) : "",
      nach: ausHier ? t("rotation.hidden", {n: ausHier}) : "",
      leiste: f.gedrueckt.length ? " " + t("deinerot.stilleSatz") : "", reihe: " " + t("deinerot.reiheSatz")};

  /* Das Feld "Einsaetze" (48-einsaetze.ts): die Tabelle selbst bleibt stehen
     (spurGruppe merkt sich an ihr, wer den Fokus hatte), nur ihr Inhalt
     wechselt; die Striche des Takts setzt taktStriche je Zeile. */
  const ged = $("#drGed");
  const hatteFokus = ged.contains(document.activeElement);
  const zeilen = einsatzZeilen(st, f.gedrueckt as Stand["einsaetze"], aus);
  const tabHtml = zeilen.length || !st.leer ? einsaetzeHtml(zeilen) : einsaetzeLeer(t("deinerot.mitgliedTabelle", {name: wer}));
  if(setzen(ged, tabHtml)) spurGruppe(ged, "rot", "", hatteFokus, false);
  taktStriche(ged, zeilen, gebaut?.dauer ?? 1);
  // der Kopf des Bereichs (Luecken 3.1): die Einsaetze in der Zeitleiste, und was das Auge ausgeblendet hat
  const zahlKopf = st.leer ? "" : t("deinerot.kopfZahl", {n: gezeigt.length});
  const zk = $("#bkRotZahl");
  if(zk.textContent !== zahlKopf) zk.textContent = zahlKopf;
  const ausKopf = ausHier ? "\u00b7 " + t("deinerot.kopfAus", {n: ausHier}) + " \u00b7" : "";
  const ak = $("#rotAusZahl");
  if(ak.textContent !== ausKopf) ak.textContent = ausKopf;
  const alle = $("#rotShowAll");
  if(alle.hidden) alle.hidden = false;
  /* Wird die Liste im Kasten neu gebaut (unter Live: eine neue Faehigkeit,
     eine andere Reihenfolge), ginge der Fokus auf einem Knopf verloren: er
     kommt auf denselben Knopf derselben Faehigkeit zurueck, sonst auf einen
     ihrer Knoepfe, sonst auf den Kopf des Kastens. */
  const autoBox = $("#drAuto"), fokus = document.activeElement;
  const warDrin = fokus instanceof HTMLElement && autoBox.contains(fokus) ? {k: fokus.dataset.k, art: fokus.dataset.art} : null;
  if(setzen(autoBox, autoHtml(st, aus)) && warDrin){
    const knoepfe = [...autoBox.querySelectorAll<HTMLElement>("button[data-wahl]")].filter(b => b.dataset.k === warDrin.k);
    (knoepfe.find(b => b.dataset.art === warDrin.art) ?? knoepfe[0] ?? $("#drAutoTitel")).focus({preventScroll: true});
  }
  kastenZeigen(st, aus);
  // ein Mitglied ohne geteilte Einsaetze: nichts, das automatisch sein koennte - der Kasten tritt zurueck
  const autoTeil = $("#deineRot .drteilauto");
  if(autoTeil.hidden !== st.leer) autoTeil.hidden = st.leer;
  const ctl = $("#rotCtl");
  if(ctl.hidden !== (ausHier === 0)) ctl.hidden = ausHier === 0;
  rotBarHit = {marks: b.marks, seg};
  // nach einem Uebergang aus der Sitzung gilt der neue Stand
  letzteSig = signatur(seg, breite, aus);
  spielNachZeichnen(seg);
  // Leiste oder Reihenfolge (Aufgabe 11); setzt auch den Satz
  reiheZeigen();
}

/* ---------- waehlen (Spezifikation 4.2) ----------
   "Stimmt" 1, "Druecke ich selbst" 2, "Zuruecknehmen" 0, "Immer weglassen" 1.
   Die Wahl geht in die Sitzung. Nie wird ein Schluessel entfernt:
   "Rueckgaengig" schreibt den Wert davor, ohne einen die 0. */
/* Nach dem Neubau steht der Fokus auf dem Knopf, der jetzt fuer dieselbe
   Faehigkeit gilt: Zuruecknehmen nach einer Wahl, Stimmt nach dem
   Zuruecknehmen, sonst ihr Name in "Gedrueckt". */
function fokusAuf(k: string){
  const alle = [...document.querySelectorAll<HTMLElement>("#deineRot .drspalte [data-k]")].filter(el => el.dataset.k === k);
  const ziel = alle.find(el => el.matches("button[data-wahl]")) || alle.find(el => el.matches("button.rotgz"));
  // im zugeklappten Kasten liesse sich nichts fokussieren: die Wahl kam von dir, er geht auf
  if(ziel?.closest("#drAutoKasten:not([open])")){ kastenSetzen(true); kastenMerken(); }
  ziel?.focus();
}
const MELDUNG: Record<string, string> = {stimmt: "deinerot.tStimmt", selbst: "deinerot.tSelbst", zurueck: "deinerot.tZurueck", immer: "deinerot.tImmer"};
function waehlen(b: HTMLElement){
  const st = letzter;
  if(!st || !st.eigen) return;
  const k = b.dataset.k!, v = +b.dataset.wahl! as RotWahl, name = b.dataset.n || k;
  const vorher: RotWahl = wahlVon(st.wahl, k) ?? 0;
  const paar = st.paar;
  // aus der Ansicht dieses Kampfes genommen, jetzt fuer immer: die Ansicht gibt ihn frei
  if(b.dataset.art === "immer") state.rotAus?.delete(b.closest<HTMLElement>("[data-rot]")?.dataset.rot ?? "");
  inSitzung(k, v, paar);
  flip(renderRotation);
  fokusAuf(k);
  toast(tt(MELDUNG[b.dataset.art!] ?? "deinerot.tZurueck", {name}), 9000, null, {label: tt("plan.undo"), fn: () => {
    inSitzung(k, vorher, paar);
    flip(renderRotation);
    fokusAuf(k);
  }});
}

/* ---------- FLIP (Spezifikation 5.7) ----------
   Nur auf Klick: die Symbole rutschen in rund 300 ms an ihren neuen Platz
   (neue Etage, neuer Massstab), was geht, blendet in 150 ms aus. Unter
   reduzierter Bewegung springt alles. Gemessen wird nichts: die alte und
   die neue Lage stehen im style jedes Symbols. */
function flip(zeichnen: () => void){
  const bar = $("#rotBar");
  const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lage = (el: HTMLElement) => ({x: parseFloat(el.style.left), y: parseFloat(el.style.top)});
  const vorher = new Map<string, HTMLElement>();
  if(!ruhig) bar.querySelectorAll<HTMLElement>(".drsym").forEach(el => vorher.set(el.dataset.k + "@" + el.dataset.t, el));
  zeichnen();
  if(ruhig || !vorher.size) return;
  const flaeche = bar.querySelector<HTMLElement>(".drflaeche");
  const bewegt: HTMLElement[] = [];
  bar.querySelectorAll<HTMLElement>(".drsym").forEach(el => {
    const id = el.dataset.k + "@" + el.dataset.t, alt = vorher.get(id);
    if(!alt) return;
    vorher.delete(id);
    if(alt === el) return;   // nicht neu gebaut
    const a = lage(alt), n = lage(el);
    if(Math.abs(a.x - n.x) < .5 && Math.abs(a.y - n.y) < .5) return;
    el.style.transform = "translate(" + (a.x - n.x).toFixed(1) + "px," + (a.y - n.y).toFixed(1) + "px)";
    el.classList.add("flip");
    bewegt.push(el);
  });
  // was nicht mehr da ist, bleibt kurz an seiner alten Stelle und blendet aus
  const gehen: HTMLElement[] = [];
  if(flaeche) for(const alt of vorher.values()){
    if(alt.isConnected) continue;
    alt.classList.add("geht");
    flaeche.appendChild(alt);
    gehen.push(alt);
  }
  void bar.offsetWidth;   // die Ausgangslage steht, jetzt erst der Uebergang
  for(const el of bewegt) el.style.transform = "";
  for(const el of gehen) el.style.opacity = "0";
  setTimeout(() => {
    for(const el of bewegt) el.classList.remove("flip");
    for(const el of gehen) el.remove();
  }, 340);
}

/* ---------- Hervorheben beim Zeigen ----------
   Zeigen oder Fokus auf einem Namen der Spalte laesst nur dessen Einsaetze
   voll stehen, die anderen auf 35 % - ohne Farbwechsel. Nur Klassen, kein
   Neuzeichnen. */
let hebtK: string | null = null;
function hervorheben(k: string | null){
  hebtK = k;
  // in der Leiste und in der Reihenfolge (Aufgabe 11)
  for(const bar of [$("#rotBar"), $("#drReihe")]){
    bar.classList.toggle("hebt", k != null);
    bar.querySelectorAll<HTMLElement>(".an").forEach(el => el.classList.remove("an"));
    if(k == null) continue;
    bar.querySelectorAll<HTMLElement>("[data-k]").forEach(el => { if(el.dataset.k === k) el.classList.add("an"); });
  }
}
/* Ein Name der Spalte, nicht ein Knopf der Wahl: nach "Stimmt" steht der
   Fokus auf "Zuruecknehmen", und die Leiste dimmte sonst ganz ab. */
const kVon = (el: EventTarget | null) => {
  const z = el instanceof Element ? el.closest<HTMLElement>("#deineRot .drspalte [data-k]") : null;
  return z && !z.matches("[data-wahl]") ? z.dataset.k ?? null : null;
};

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  state.rotSitzung = {};
  const spalte = document.querySelector<HTMLElement>("#deineRot");
  if(!spalte) return;
  /* Ein Klick auf das Auge (den Knopf vor dem Namen) im Feld "Einsaetze"
     nimmt die Faehigkeit aus der Leiste und holt sie zurueck - nur die
     Ansicht fuer diesen Kampf (state.rotAus). Am Block gebunden: die Knoepfe
     werden neu gebaut, der Block nicht. */
  spalte.addEventListener("click", e => {
    const w = (e.target as Element).closest<HTMLElement>("button[data-wahl]");
    if(w){ waehlen(w); return; }
    const b = (e.target as Element).closest<HTMLElement>("#drGed .rotgz");
    if(!b) return;
    const n = b.dataset.rot!;
    const aus = state.rotAus ?? (state.rotAus = new Set());
    if(aus.has(n)) aus.delete(n); else aus.add(n);
    renderRotation();
  });
  /* Von Hand auf- oder zugeklappt: das gilt, bis ein neuer Vorschlag kommt.
     Was kastenSetzen selbst tut, loest dasselbe Ereignis aus - es aendert
     dann nichts. */
  const kasten = $<HTMLDetailsElement>("#drAutoKasten");
  kasten?.addEventListener("toggle", () => {
    if(kasten.open === kastenOffen) return;
    kastenOffen = kasten.open;
    kastenMerken();
  });
  spalte.addEventListener("mouseover", e => hervorheben(kVon(e.target) ?? kVon(document.activeElement)));
  spalte.addEventListener("mouseleave", () => hervorheben(kVon(document.activeElement)));
  spalte.addEventListener("focusin", e => hervorheben(kVon(e.target)));
  spalte.addEventListener("focusout", e => { if(!kVon(e.relatedTarget)) hervorheben(null); });
  /* Abspielen (Stufe 2): Knopf, Tempo; anhalten, sobald das Fenster
     verborgen ist. */
  $("#drPlay").addEventListener("click", () => {
    if(spiel.laeuft) anhalten(true); else abspielen();
  });
  $("#drTempo").addEventListener("click", e => {
    const b = (e.target as Element).closest<HTMLElement>("button[data-tempo]");
    if(!b) return;
    spiel.tempo = +b.dataset.tempo!;
    $("#drTempo").querySelectorAll<HTMLElement>("button").forEach(x => {
      const an = x === b;
      x.classList.toggle("on", an);
      x.setAttribute("aria-pressed", String(an));
    });
  });
  document.addEventListener("visibilitychange", () => { if(document.hidden) anhalten(false); });
  /* Die Buehne ist ein Tabstopp und uebernimmt ihre Tasten selbst
     (Spezifikation 5.6): Leertaste spielt ab oder haelt an, Pfeile gehen
     einen Einsatz, Pos1 und Ende an den ersten und letzten. Die Leiste
     zeigt den ganzen Kampf und rollt nicht (Neugestaltung 28.09.) - nur
     gezoomt, dann mit dem Zeitverlauf und dem Kopf (Aufgabe 10). Gesperrt
     (Live) tut die Leertaste nichts - die Seite rollt trotzdem nicht. */
  const box = $("#deineRotScroll");
  /* Gezoomt rollen Leiste und Zeitverlauf gemeinsam (Aufgabe 10): beide
     sind gleich breit gezeichnet, was die eine rollt (Rollspur, Tastatur,
     Ziehen, der Kopf beim Abspielen), rollt die andere mit (rollMit). */
  const zv = $("#stackScroll");
  zv.addEventListener("scroll", () => rollMit(zv, box), {passive: true});
  box.addEventListener("scroll", () => rollMit(box, zv), {passive: true});
  /* Die Leiste zeigt den ganzen Kampf auf ihrer Breite: aendert sich die
     Breite (Fenster, Rollleiste der Seite kommt oder geht), baut sie neu -
     die Signatur traegt die Breite, sonst geschieht nichts. */
  if(typeof ResizeObserver !== "undefined"){
    let zuletzt = 0;
    new ResizeObserver(() => {
      const w = box.clientWidth;
      if(!w || w === zuletzt) return;
      zuletzt = w;
      if(state.tab === "rotation" && !$("#deineRot").hidden) requestAnimationFrame(() => renderRotation());
    }).observe(box);
  }
  /* Hoehe ab 1200 Punkt: fuenf Bahnen statt drei (Luecken 3.5) - die
     Signatur traegt die Zahl, gebaut wird nur beim Wechsel. */
  let bahnen = etagenZahl();
  addEventListener("resize", () => {
    if(etagenZahl() === bahnen) return;
    bahnen = etagenZahl();
    if(state.tab === "rotation" && !$("#deineRot").hidden) requestAnimationFrame(() => renderRotation());
  });
  /* Ein Klick in die Leiste springt an diese Stelle des Kampfs (Luecken
     3.5): der Kopf steht dort, "Jetzt" nennt den Einsatz davor. */
  box.addEventListener("click", e => {
    const g = gebaut;
    if(!g || g.gezeigt.length < 3) return;
    const r = box.getBoundingClientRect();
    const ms = Math.max(0, Math.min(g.T, g.von + (e.clientX - r.left + box.scrollLeft - RAND) / g.pxs * 1000));
    anhalten(false);
    spiel.ms = ms;
    spiel.i = Math.max(0, einsatzBei(g.ts, ms));
    spiel.id = einsatzId(g.gezeigt[spiel.i]);
    anwenden();
    sagen();
  });
  const tasten = (e: KeyboardEvent) => {
    if(e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const g = gebaut, n = g ? g.gezeigt.length : 0;
    if(n < 3){
      // ohne Bedienung: nichts abzuspielen, die Seite rollt nicht
      if(e.key === " ") e.preventDefault();
      return;
    }
    if(e.key === " "){ e.preventDefault(); if(spiel.laeuft) anhalten(true); else abspielen(); }
    else if(e.key === "ArrowLeft" || e.key === "ArrowRight"){ e.preventDefault(); gehe(spiel.i + (e.key === "ArrowLeft" ? -1 : 1)); }
    else if(e.key === "Home"){ e.preventDefault(); gehe(0); }
    else if(e.key === "End"){ e.preventDefault(); gehe(n - 1); }
  };
  box.addEventListener("keydown", tasten);
  /* Die Reihenfolge (Aufgabe 11): dieselben Tasten; ein Klick auf einen
     Einsatz springt dorthin. Der Umschalter ist eine Radiogruppe - Klick
     waehlt, Pfeiltasten wechseln und nehmen den Fokus mit. */
  const reihe = $("#drFolge");
  reihe.addEventListener("keydown", tasten);
  reihe.addEventListener("click", e => {
    const k = (e.target as Element).closest<HTMLElement>(".drk[data-i]");
    if(k) gehe(+k.dataset.i!);
  });
  $("#drAnsicht").querySelectorAll<HTMLElement>("[role=radio]").forEach(b => {
    // ein Klick hat den Fokus schon auf den Knopf gelegt; die Pfeiltasten nehmen ihn mit
    b.addEventListener("click", () => ansichtSetzen(b.dataset.ansicht === "reihe", false));
    b.addEventListener("keydown", e => {
      if(!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      ansichtSetzen(!ansicht.reihe, true);
    });
  });
}

