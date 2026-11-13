import { state } from "./01-state";
import { t } from "./08-translation";
import { fmt } from "./03-helpers";
import { secs1 } from "./16-fight-analysis";
import { skillIcon } from "./12-boss-images";
import { clock, esc } from "./18-interface-basics";
import { analyseName, fm, satzText, type AnalyseDaten, type SeitenSatz } from "./78-analyse-daten";
import { detailsFuellen, pruefstandZeichnen } from "./70-pruefstand";
import type { KartenZusatz, ZusatzMap } from "./69-faehigkeiten";
import { zuVentius } from "./62-rekorde";
import { bereich, ereignisse, saetze, staerkste, type Marke } from "../bereich-core";
import type { Luecken } from "../analyse-core";
import { lueckenVon } from "../kampfdaten-core";
import { hitzeVon, pruefstand, skillsVon } from "../pruefstand-core";
import { VENTIUS, ventiusAuswertung } from "../ventius-core";

/* ---------- die neue Analyse: Zeitleiste mit Bereich, Auswertung (#414) ----------
   Spezifikation 2026-11-08-analyse-neu-zeitleiste-design.md 2.2 und 2.3.
   Die Kurve (Schaden je Sekunde, 2 s geglaettet) mit der Geisterkurve des
   besten Pulls, Marken ueber der Kurve, eine Bahn je Faehigkeit; ein Bereich
   per Ziehen, Tippen oder Tastatur; daneben die Auswertung dieses Bereichs.
   Gerechnet wird in den Kernen (../bereich-core.ts u. a.), hier steht das
   Zeichnen und die Bedienung. Der Stand (Bereich, gewaehlte Faehigkeit)
   gilt je Kampf; 70-pruefstand.ts liest ihn mit. */

export interface EStand {
  /** Bereich [a, b) in ganzen Sekunden, null = ganzer Kampf */
  von: number | null;
  bis: number | null;
  /** die gewaehlte Faehigkeit (Name im Kern), null = keine */
  hebt: string | null;
  ventOffen: boolean;
  /** die Folge des Openers als Liste ist aufgeklappt */
  listeOffen: boolean;
  /** der Kampf, zu dem der Stand gehoert */
  kampf: number | null;
}
export const E: EStand = {von: null, bis: null, hebt: null, ventOffen: false, listeOffen: false, kampf: null};
let D: AnalyseDaten | null = null;
export const daten = (): AnalyseDaten => D!;
/** Was die Seite zur Analyse beisteuert (SeitenSatz, 78; gerechnet in 26-analysis-tab.ts): Saetze mit ihrer Strecke. */
let SE: SeitenSatz[] = [];
const seite = (k: SeitenSatz["k"]) => SE.find(x => x.k === k);
/** Der Knopf in die Rotation fuer die Strecke von-bis (Sekunden), mit der Strecke im Vorlesenamen; der Klick laeuft ueber den Hoerer der Analyse (data-weg, 26-analysis-tab.ts). */
function rotKnopf(von: number, bis: number, label: string): string {
  return '<button type="button" class="inrot" data-weg="rot" data-von="' + von + '" data-bis="' + bis + '" aria-label="' + esc(t(label, {z: clock(von) + "\u2013" + clock(bis)})) + '">' + esc(t("analysis.inRotation")) + "</button>";
}
/** Der Weg in die Zeitleiste (#414) fuer die Strecke von-bis: die Strecke wird der Bereich (data-weg="zeit", Hoerer in 26-analysis-tab.ts). */
function zeitKnopf(von: number, bis: number): string {
  return '<button type="button" class="inzeit" data-weg="zeit" data-von="' + von + '" data-bis="' + bis + '" aria-label="' +
    esc(t("analysis.e.ui.zeigen.label", {z: clock(von) + "–" + clock(bis)})) + '">' + esc(t("analysis.e.ui.zeigen")) + "</button>";
}
const mitKnopf = (x: SeitenSatz) => x.rot && x.von != null && x.bis != null ? " " + rotKnopf(x.von, x.bis, x.rot) : "";
/** Die Strecke "Abstand waechst" hat keine Marke: ihr Satz fuehrt selbst in die Zeitleiste. */
const mitZeit = (x: SeitenSatz) => x.k === "abstand" && x.von != null && x.bis != null ? " " + zeitKnopf(x.von, x.bis) : "";
/** Was an den Karten ausser dem Pruefstand steht (69-faehigkeiten.ts); leer, wo es nichts gibt. */
let Z: ZusatzMap | null = null;
export const zusatzVon = (name: string): KartenZusatz | undefined => Z?.get(name);
const T = () => D!.k.dauerS;
export const bereichVon = (): [number, number] => (E.von == null || E.bis == null ? [0, T()] : [E.von, E.bis]);
const bestWer = () => (!D!.best ? "" : D!.best.dps > D!.k.dps ? "bester" : "zweitbester");
export const nm = (n: string) => analyseName(n);

export const q = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
export const qa = (s: string, r: ParentNode = document) => [...r.querySelectorAll<HTMLElement>(s)];
const pr = (x: number) => (100 * x).toFixed(3) + "%";

const HITZE = ["analysis.e.p.hz0", "analysis.e.p.hz1", "analysis.e.p.hz2", "analysis.e.p.hz3"];
const ZEICHEN: Record<string, string> = {
  spitze: '<path d="M2 9l3-4 2 2 4-5"/><path d="M8 2h3v3"/>',
  luecke: '<path d="M4 2H2v8h2M8 2h2v8H8"/>',
  einsatz: '<path d="M6 1.5v9M3 7.5l3 3 3-3"/>',
  ziel: '<circle cx="6" cy="6" r="4"/><circle cx="6" cy="6" r="1.2"/>',
  stelle: '<path d="M2 3l3 4 2-2 3 4"/><path d="M7.5 9H10V6.5"/>',
  unter: '<circle cx="6" cy="6" r="4"/><path d="M6 4v2.5"/>',
  unlesbar: '<circle cx="6" cy="6" r="4" stroke-dasharray="1.6 1.6"/>',
  ganz: '<path d="M2 6h8M4 3L2 6l2 3M8 3l2 3-2 3"/>',
};
const zeichen = (k: string) => '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">' + (ZEICHEN[k] || ZEICHEN.spitze) + "</svg>";

/** Das Symbol einer Faehigkeit wie ueberall in der App; ohne Spielbilder leer (dann steht der Name da). */
export function symbol(name: string, sid: string | null, klasse: string): string {
  const u = skillIcon(name, sid || null);
  return u ? '<img class="' + klasse + '" src="' + u + '" alt="" aria-hidden="true" decoding="async">' : "";
}

/* ---------- der Aufbau ---------- */
export function a2Wurzel(): HTMLElement | null {
  const r = q("#a2");
  if(!r) return null;
  if(r.dataset.fertig === "1") return r;
  r.dataset.fertig = "1";
  const k = (s: string) => esc(t(s));
  r.innerHTML =
    '<div class="a2mitte">' +
    '<section class="a2zeit" aria-labelledby="a2zeitT">' +
    '<div class="kopfzeile"><h3 id="a2zeitT">' + k("analysis.e.ui.zeit.titel") + '</h3><p class="fein" id="a2zeitWie">' + k("analysis.e.ui.zeit.wie") + "</p>" +
    '<div class="a2steuer" id="a2steuer"><label>' + k("analysis.e.ui.zeit.von") + ' <input id="a2von" inputmode="numeric" pattern="[0-9]+:[0-5][0-9]" aria-label="' + k("analysis.e.p.vonLabel") + '"></label>' +
    "<label>" + k("analysis.e.ui.zeit.bis") + ' <input id="a2bis" inputmode="numeric" pattern="[0-9]+:[0-5][0-9]" aria-label="' + k("analysis.e.p.bisLabel") + '"></label>' +
    '<button type="button" class="a2chip" id="a2spitze" aria-pressed="false">' + zeichen("spitze") + "<span>" + k("analysis.e.ui.zeit.spitze") + "</span></button>" +
    '<button type="button" class="a2chip" id="a2luecke" aria-pressed="false">' + zeichen("luecke") + "<span>" + k("analysis.e.ui.zeit.luecke") + "</span></button>" +
    '<button type="button" class="a2chip" id="a2ganz" aria-pressed="true">' + zeichen("ganz") + "<span>" + k("analysis.e.ui.zeit.ganz") + "</span></button></div></div>" +
    '<div class="a2graf" id="a2graf"></div>' +
    '<p class="a2tasten" id="a2tasten"></p>' +
    '<div class="a2legende" id="a2legende"></div><p class="a2unv" id="a2unv" hidden></p>' +
    // die Definition der Luecke und die Zeile zur Mechanik (Inventur A, Entscheidung 4.5): sie stehen bei der Zeitleiste, die die Luecken zeichnet (B3: vorher im Kopf des Kampfs)
    '<p class="fein" id="lueckeDef"></p><p class="fein" id="mechanikZeile" role="note" hidden></p><p class="vh" id="a2ansage" aria-live="polite"></p>' +
    '<details class="a2tab" id="a2tabZeit"><summary>' + k("analysis.e.ui.zeit.tabelle") + '</summary><div class="rollt"></div></details></section>' +
    '<section class="a2bereich" aria-labelledby="a2bereichT"><div class="kopfzeile"><h3 id="a2bereichT">' + k("analysis.e.ui.bereich.titel") + '</h3><span class="zeit" id="a2bereichZeit"></span></div>' +
    '<p class="satz" id="a2satz" aria-live="polite"></p><p class="a2haelften" id="a2haelften" hidden></p><p class="a2treffer" id="a2treffer" hidden></p><p class="a2weg" id="a2weg" hidden></p><dl class="a2kacheln" id="a2kacheln"></dl><div class="a2zwei"><div class="gut"><h3 class="uz">' + k("analysis.e.ui.bereich.gut") + '</h3><ul id="a2gut"></ul></div><div class="besser"><h3 class="uz">' + k("analysis.e.ui.bereich.besser") + '</h3><ul id="a2besser"></ul></div></div></section>' +
    "</div>" +
    '<section class="a2skills" aria-labelledby="a2skillT"><div class="a2kopfz"><h3 id="a2skillT">' + k("analysis.e.ui.skills.titel") + '</h3><span class="stand" id="a2skillStand"></span></div>' +
    '<div class="a2oben"><div id="a2check"></div><div id="a2opener" class="a2opener"></div></div><p class="a2start" id="a2start" hidden></p><div id="a2skills"></div></section>';
  binden(r);
  return r;
}

/** Die festen Texte der Wurzel in der Sprache der Seite neu setzen (bei Sprachwechsel baut renderNeueAnalyse neu). */
export function a2Neu(): void {
  const r = q("#a2");
  if(r) r.dataset.fertig = "0";
}

/* ---------- die Zeitleiste ---------- */
interface Graf { Td: number; lk: Luecken; sp: [number, number] }
let graf: Graf | null = null;
const salve = (x: string) => x === "unter" || x === "unlesbar" || x === "salven";
const zielw = (x: string) => x === "ziel" || x === "ziele";
interface MarkeGebaut { k: string; von: number; bis: number; von0: number; n: number; unter: number; unles: number; text: string }

export function zeitleiste(): void {
  const {k, best: b, decke} = daten(), Td = T(), g = q("#a2graf")!;
  const f = fm();
  const [a, bb] = bereichVon(), ganz = E.von == null;
  const sekn = k.schadenJeSekunde.slice(0, Math.ceil(Td));
  const glatt = glaettenPlus(sekn), geist = b ? glaettenPlus(b.schadenJeSekunde).slice(0, Math.ceil(Td)) : [];
  const hoch = Math.max(1, ...glatt, ...geist);
  const lk = lueckenVon(k), sp = staerkste(sekn);
  // Marken, die sich auf der Breite beruehren wuerden, werden eine Marke: Salven zu "n Salven", Zielwechsel zu "n Zielwechsel"
  const roh: Marke[] = ereignisse(k, decke), ev: MarkeGebaut[] = [];
  const nah = Td * Math.min(0.12, 200 / Math.max(300, g.clientWidth || 800));
  for(const e of roh){
    const l = ev[ev.length - 1];
    const text = satzText(e.satz);
    if(l && ((salve(e.k) && salve(l.k)) || (zielw(e.k) && zielw(l.k))) && e.von - l.von0 < nah){
      l.k = salve(e.k) ? "salven" : "ziele"; l.n++; l.bis = e.bis; l.unter += e.k === "unter" ? 1 : 0; l.unles += e.k === "unlesbar" ? 1 : 0; l.text += "; " + text;
    } else ev.push({k: e.k, von: e.von, bis: e.bis, von0: e.von, n: 1, unter: e.k === "unter" ? 1 : 0, unles: e.k === "unlesbar" ? 1 : 0, text});
  }
  // die schwaechste Stelle (Regel der Seite, 26) ist eine Marke wie die Luecke: sie waehlt ihre Strecke als Bereich
  const stelle = seite("stelle");
  if(stelle && stelle.von != null && stelle.bis != null){
    ev.push({k: "stelle", von: stelle.von, bis: stelle.bis, von0: stelle.von, n: 1, unter: 0, unles: 0, text: stelle.text});
    ev.sort((p, qq) => p.von - qq.von);
  }
  const y = (v: number) => +(100 - 94 * v / hoch).toFixed(3), x = (s: number) => +s.toFixed(3);
  let linie = "M0 " + y(glatt[0] || 0);
  glatt.forEach((v, i) => { linie += "L" + x(i + 0.5) + " " + y(v); });
  linie += "L" + x(Td) + " " + y(glatt[glatt.length - 1] || 0);
  const flaeche = linie.replace(/^M/, "M0 100L") + "L" + x(Td) + " 100Z";
  let geistD = "";
  if(geist.length){ geistD = "M0 " + y(geist[0] || 0); geist.forEach((v, i) => { geistD += "L" + x(i + 0.5) + " " + y(v); }); }
  const lage = (p: number, qq: number) => "left:" + pr(p / Td) + ";width:" + pr((qq - p) / Td);
  const markeWort = (e: MarkeGebaut) => e.k === "spitze" ? t("analysis.e.ui.marke.spitze") : e.k === "luecke" ? t("analysis.e.ui.marke.luecke", {s: f.sek(e.bis - e.von)})
    : e.k === "stelle" ? t("analysis.e.ui.marke.stelle") : e.k === "einsatz" ? t("analysis.e.ui.marke.einsatz") : e.k === "ziel" ? t("analysis.e.ui.marke.ziel") : e.k === "ziele" ? t("analysis.e.ui.marke.ziele", {n: e.n})
    : e.k === "unter" ? t("analysis.e.ui.marke.unter") : e.k === "unlesbar" ? t("analysis.e.ui.marke.unlesbar")
    : t("analysis.e.ui.marke.salven", {n: e.n}) + (e.unter && !e.unles ? t("analysis.e.p.markeUnter") : e.unles && !e.unter ? t("analysis.e.p.markeUnles") : t("analysis.e.p.markeBeides", {u: e.unter, l: e.unles}));
  const marken = ev.map((e, i) => '<button type="button" class="a2marke ' + e.k + '" data-i="' + i + '" data-von="' + e.von + '" data-bis="' + e.bis + '" data-art="' + (salve(e.k) ? "salve" : zielw(e.k) ? "ziel" : e.k) +
    '" aria-pressed="false" aria-label="' + esc(e.text) + '" title="' + esc(e.text) + '">' + zeichen(e.k === "salven" ? "unter" : e.k === "ziele" ? "ziel" : e.k) + '<span class="l">' + esc(markeWort(e)) + "</span></button>").join("");
  const gaps = lk.luecken.map(([p, qq]) => '<span class="gapz" data-zeit="' + esc(f.uhr(p) + "–" + f.uhr(qq)) + '" style="' + lage(p, qq) + '">' + ((qq - p) / Td * (g.clientWidth || 800) > 40 ? '<span class="vgap">' + f.sek(qq - p) + "</span>" : "") + "</span>").join("");
  // Strecken, in denen der Boss nichts nahm (wie im alten Streifen): Wort und Dauer, wo Platz ist, sonst nur die Zahl, sonst nichts
  const bw = g.clientWidth || 800, bd = daten().baender;
  const bandText = (px: number, lang: string, kurz: string) => (px >= 190 ? lang : px >= 46 ? kurz : "");
  const invz = bd.unv.map(u => {
    const px = bw * (u.bis - u.von) / Td, w = bandText(px, t("timeline.invulnLen", {s: secs1(u.len)}), secs1(u.len));
    return '<span class="invz" data-zeit="' + esc(f.uhr(u.von) + "–" + f.uhr(u.bis)) + '" style="' + lage(u.von, u.bis) + '">' + (w ? '<span class="vgap">' + esc(w) + "</span>" : "") + "</span>";
  }).join("");
  const mechz = bd.mech.map(m => {
    const px = bw * (m.bis - m.von) / Td, s = f.sek(m.bis - m.von), w = px >= 150 ? t("mechanik.band", {s}) : px >= 46 ? s : "";
    return '<span class="mechz" data-zeit="' + esc(f.uhr(m.von) + "–" + f.uhr(m.bis)) + '" style="' + lage(m.von, m.bis) + '">' + (w ? '<span class="vgap">' + esc(w) + "</span>" : "") + "</span>";
  }).join("");
  const zielLinien = k.zielwechsel.slice(1).map(([tt]) => '<span class="zielw" style="left:' + pr(tt / Td) + '"></span>').join("");
  const strecke = (p: number, qq: number) => f.uhr(p) + "–" + f.uhr(qq);
  const beschreibung = t("analysis.e.p.kurveBeschreibung", {dauer: f.uhr(Td), n: lk.luecken.length, liste: lk.luecken.map(([p, qq]) => strecke(p, qq)).join(", "),
    geist: b ? t("analysis.wb.geistLabel", {zweit: daten().zweit, wann: daten().bestWann}) : "",
    unv: bd.unv.map(u => strecke(u.von, u.bis)).join(", "), mech: bd.mech.map(m => strecke(m.von, m.bis)).join(", ")});
  const kurve = '<div class="a2kurve" id="a2kurve"><p class="vh" id="a2beschr">' + esc(beschreibung) + "</p>" + '<span class="spitze" style="' + lage(sp[0], sp[1]) + '"></span>' + gaps + invz + mechz + zielLinien +
    '<svg viewBox="0 0 ' + x(Td) + ' 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs><linearGradient id="a2glut" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--wbkurve)" stop-opacity=".5"/><stop offset="1" stop-color="var(--wbkurve)" stop-opacity=".04"/></linearGradient></defs>' +
    '<path d="' + flaeche + '" fill="url(#a2glut)"/>' + (geistD ? '<path class="a2geist" d="' + geistD + '" fill="none" stroke="var(--wbspiegel)" stroke-width="1.1" stroke-dasharray="4 3" opacity=".8" vector-effect="non-scaling-stroke"/>' : "") +
    '<path class="a2linie" d="' + linie + '" fill="none" stroke="var(--wbkurve)" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>' +
    (lk.median > 0 ? '<span class="med" style="bottom:' + Math.min(100, 94 * lk.median / hoch).toFixed(3) + '%"></span>' : "") +
    '<span class="a2kerben" id="a2kerben" aria-hidden="true"></span><span class="a2zeig" id="a2zeig" hidden></span>' +
    '<button type="button" class="a2brushfokus" id="a2fokus" aria-roledescription="' + esc(t("analysis.e.p.bereichswahl")) + '" aria-describedby="a2satz a2beschr" aria-label=""></button>' +
    '<span class="a2brush" id="a2brush"' + (ganz ? " hidden" : "") + ' style="' + lage(a, bb) + '"><span class="a2griff l" data-griff="a" aria-hidden="true"></span><span class="a2griff r" data-griff="b" aria-hidden="true"></span></span></div>';
  const platz = Math.max(2, Math.min(8, Math.floor((g.clientWidth || 800) / 70)));
  const schritt = [5, 10, 15, 20, 30, 60, 120].find(s => Td / s <= platz) || 300;
  let achse = "";
  for(let s = 0; s <= Td; s += schritt){ const qq = s / Td; achse += '<span style="left:' + pr(qq) + '"' + (qq === 0 ? ' class="a0"' : qq > 0.95 ? ' class="a1"' : "") + ">" + f.uhr(s) + "</span>"; }
  // die Bahnen: Ventius zuerst (nur wenn es Salven gibt), dann die gedrueckten nach Schaden, hoechstens acht, die Ticks als eine Zeile
  const skills = skillsVon(k), gedr = skills.filter(s => !s.tick), ticks = skills.filter(s => s.tick);
  const V = ventiusAuswertung(k, decke);
  const vent = gedr.find(s => s.ventius), rest = gedr.filter(s => !s.ventius).slice(0, vent ? 7 : 8), uebrig = gedr.filter(s => !s.ventius).slice(vent ? 7 : 8);
  const im = (tt: number) => ganz || (tt >= a && tt < bb);
  const bahnen: string[] = [];
  const bezKnopf = (s: {name: string; sid: string | null; anteil: number}, fett: boolean) => '<div class="bez name" data-skill="' + esc(s.name) + '"><button type="button" class="bezk" aria-pressed="false" aria-describedby="a2bahnHinweis" aria-label="' +
    esc(t("analysis.e.p.bahnName", {name: nm(s.name), q: f.pr(s.anteil)})) + '">' + symbol(s.name, s.sid, "sic bz") +
    '<span class="nmt">' + (fett ? "<b>" + esc(nm(s.name)) + "</b>" : esc(nm(s.name))) + '</span><span class="ant">' + f.pr(s.anteil) + "</span></button></div>";
  if(vent && V){
    const d = V.decke, h = d * 6;
    bahnen.push(bezKnopf(vent, true) + '<div class="a2bahn vent" style="--a2decke:' + d + '" data-skill="' + esc(vent.name) + '" role="img" aria-label="' +
      esc(t("analysis.e.p.ventBahn", {n: V.salven.length, unter: V.unter, unles: V.unlesbar})) + '">' +
      V.salven.map(s => {
        const hz = hitzeVon(s.krit, s.stark, s.n);
        let c = "";
        if(s.status === "unlesbar") c = '<circle class="tot" cx="8" cy="' + (h - 3) + '" r="2.4"/>';
        else for(let i = 1; i <= d; i++) c += '<circle class="' + (i <= s.nb ? "voll" : "leer") + '" cx="8" cy="' + (h - 3 - (i - 1) * 6) + '" r="2.4"/>';
        if(s.status === "unter") c += '<rect class="ring" x="3.5" y="0.5" width="9" height="' + (h - 1) + '" rx="4.5"/>';
        return '<span class="perle h' + hz + (im(s.t) ? "" : " aus") + '" style="left:' + pr(s.t / Td) + '" title="' + esc(f.uhr(s.t) + ": " + salveText(s) + ", " + f.kurz(s.dmg)) + '"><svg viewBox="0 0 16 ' + h + '" aria-hidden="true">' + c + "</svg></span>";
      }).join("") + "</div>");
  }
  const strich = (e: {t: number; dmg: number; krit: number; stark: number; n: number; teile?: number | undefined}, maxD: number) => {
    const hz = hitzeVon(e.krit, e.stark, e.n);
    return '<i class="h' + hz + (im(e.t) ? "" : " aus") + (e.teile ? " teil" : "") + '" style="left:' + pr(e.t / Td) + ";height:" + Math.max(4, Math.round(16 * Math.sqrt(e.dmg / maxD))) + 'px" title="' +
      esc(f.uhr(e.t) + " · " + f.kurz(e.dmg) + " · " + t("analysis.e.p.treffer", {n: e.n}) + " · " + t(HITZE[hz]!)) + '"></i>';
  };
  for(const s of rest){
    const maxD = Math.max(1, ...s.einsaetze.map(e => e.dmg));
    bahnen.push(bezKnopf(s, false) + '<div class="a2bahn" data-skill="' + esc(s.name) + '" role="img" aria-label="' + esc(t("analysis.e.p.bahnLabel", {name: nm(s.name), n: s.einsaetze.length})) + '">' + s.einsaetze.map(e => strich(e, maxD)).join("") + "</div>");
  }
  if(uebrig.length){
    const alle = uebrig.flatMap(s => s.einsaetze), maxD = Math.max(1, ...alle.map(e => e.dmg));
    bahnen.push('<div class="bez weitere"><span>' + esc(t("analysis.e.ui.zeit.weitere", {n: uebrig.length})) + '</span></div><div class="a2bahn weitere" title="' + esc(uebrig.map(s => nm(s.name)).join(", ")) + '">' + alle.map(e => strich(e, maxD)).join("") + "</div>");
  }
  if(ticks.length){
    const alle = ticks.flatMap(s => s.einsaetze), maxD = Math.max(1, ...alle.map(e => e.dmg));
    bahnen.push('<div class="bez tick" title="' + esc(ticks.map(s => nm(s.name)).join(", ")) + '"><span>' + esc(t("analysis.e.ui.zeit.ticks")) + '</span><span class="ant">' + f.pr(ticks.reduce((xx, s) => xx + s.anteil, 0)) +
      '</span></div><div class="a2bahn tick" style="--a2bh:12px" title="' + esc(ticks.map(s => nm(s.name)).join(", ")) + '">' + alle.map(e => strich(e, maxD).replace(/height:\d+px/, "height:4px")).join("") + "</div>");
  }
  g.innerHTML = '<div class="bez"></div><div class="a2marken" id="a2marken" role="group" aria-label="' + esc(t("analysis.e.p.markenGruppe")) + '">' + marken + "</div>" +
    '<div class="bez"><span>' + esc(t("analysis.e.ui.zeit.jeSekunde")) + "</span></div>" + kurve +
    '<div class="bez"></div><div class="a2achse" aria-hidden="true">' + achse + "</div>" +
    '<div class="bez"></div><p class="a2lese" id="a2lese"></p>' +
    '<div class="voll a2bahnen" style="display:contents">' + bahnen.join("") + "</div>" +
    '<div class="bez"></div><p class="a2bahnhinweis" id="a2bahnHinweis"></p>';
  // die Marken setzen: Reihe fuer Reihe, wo sie sich ueberlappen
  const reihe = q("#a2marken")!, W = reihe.clientWidth, ende: number[] = [];
  qa(".a2marke", reihe).forEach(m => {
    const von = +(m.dataset.von || 0), wd = m.offsetWidth, xx = Math.max(0, Math.min(W * von / Td, W - wd));
    let r = 0; while(ende[r] != null && xx < ende[r]!) r++;
    ende[r] = xx + wd + 4; m.style.left = pr(W ? xx / W : von / Td); m.style.top = r * 26 + "px";
  });
  reihe.style.height = Math.max(1, ende.length) * 26 + 2 + "px";
  q("#a2legende")!.innerHTML = '<span><i class="lk"></i>' + esc(t("analysis.e.ui.legende.kurve")) + "</span>" +
    (b ? '<span><i class="lg"></i>' + esc(t("analysis.e.p.legGeist", {wer: t("analysis.e.p." + bestWer()), dauer: f.uhr(b.dauerS)})) + "</span>" : "") +
    (lk.luecken.length ? '<span><i class="lp"></i>' + esc(t("analysis.e.ui.legende.luecke")) + "</span>" : "") +
    (lk.median > 0 ? '<span><i class="lmed"></i>' + esc(t("analysis.legendMedian", {x: fmt(lk.median, 1e3)})) + "</span>" : "") +
    (bd.unv.length ? '<span><i class="lu"></i>' + esc(t("analysis.legendInvuln")) + "</span>" : "") +
    (bd.mech.length ? '<span><i class="lm"></i>' + esc(t("mechanik.legend")) + "</span>" : "") +
    '<span><i class="lw"></i>' + esc(t("analysis.e.ui.legende.bereich")) + '</span><span><i class="lkb"></i>' + esc(t("analysis.e.ui.legende.kerbe")) + "</span>" +
    '<span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i>' + esc(t("analysis.e.ui.legende.hitze")) + "</span>" +
    (V ? '<span><svg class="lv" viewBox="0 0 10 18" aria-hidden="true"><circle class="voll" cx="5" cy="15" r="2.4"/><circle class="voll" cx="5" cy="9" r="2.4"/><circle class="leer" cx="5" cy="3" r="2.2"/></svg>' + esc(t("analysis.e.ui.legende.vent")) + "</span>" : "");
  graf = {Td, lk, sp};
  q("#a2tasten")!.innerHTML = esc(t("analysis.e.ui.zeit.tasten")).replace(/(Tab|← →|Umschalt|Shift|Strg|Ctrl|Alt|\+ −|Pos1|Home|Ende|End|Esc|Enter)/g, "<kbd>$1</kbd>");
  steuerSync();
  hebenAnwenden();
}

/** Glaettung ueber drei Sekunden, die Mitte doppelt (wie die Kurve der Werkbank, 2 s). */
function glaettenPlus(s: readonly number[]): number[] {
  return s.map((v, i) => { const a = i ? s[i - 1]! : v, b = i + 1 < s.length ? s[i + 1]! : v; return (a / 2 + v + b / 2) / 2; });
}

/** Der Satz zu einer Salve fuer Perle und Raster: Nachbeben und Treffer oder der Grund, warum sie nicht lesbar ist. */
export function salveText(s: {status: string; nb: number; n: number; soll: number; grund: string; wellen: number[]; nurOeffner: boolean; fehlend: number | null}): string {
  if(s.status === "unlesbar") return t("analysis.e.p.salveUnlesbar", {grund: t("analysis.e.vent.grund." + s.grund), wellen: s.wellen.join("+"), n: s.n});
  if(s.status === "kampfende") return t("analysis.e.p.salveEnde", {n: s.n, soll: s.soll});
  return t("analysis.e.p.salveNb", {nb: s.nb, n: s.n, soll: s.soll, fehlt: s.fehlend || 0, nur: s.nurOeffner});
}

/** Knappe Zahlen einer Faehigkeit fuer Zeigen und Fokus (Bahn, Name, Karte). */
function skillInfo(name: string): string {
  const [a, b] = bereichVon();
  const f = fm();
  const c = karteVon(name, a, b);
  if(!c) return "";
  const teile = [(c.ventius ? t("analysis.e.ui.info.salven", {n: c.einsaetze}) : t("analysis.e.ui.info.einsaetze", {n: c.einsaetze})) + (E.von == null ? "" : " " + t("analysis.e.ui.info.imBereich")),
    t("analysis.e.ui.info.anteil", {q: f.pr(c.anteil)}), t("analysis.e.ui.info.je", {dmg: f.kurz(c.jeEinsatz)})];
  if(c.cd) teile.push(t("analysis.e.ui.info.takt", {s: f.sek(c.cd, 1)}));
  return teile.join(" · ");
}
function karteVon(name: string, a: number, b: number){
  const d = daten();
  return pruefstand(d.k, d.best, a, b, d.decke).find(x => x.name === name);
}

function steuerSync(): void {
  const [a, b] = bereichVon(), ganz = E.von == null, f = fm();
  (q<HTMLInputElement>("#a2von")!).value = f.uhr(a); (q<HTMLInputElement>("#a2bis")!).value = f.uhr(b);
  const sp = graf ? graf.sp : null, lg = graf ? graf.lk.luecken.reduce<[number, number] | null>((x, g) => !x || g[1] - g[0] > x[1] - x[0] ? g : x, null) : null;
  q("#a2spitze")!.setAttribute("aria-pressed", String(!ganz && !!sp && E.von === sp[0] && E.bis === sp[1]));
  q("#a2luecke")!.setAttribute("aria-pressed", String(!ganz && !!lg && E.von === lg[0] && E.bis === lg[1]));
  (q<HTMLButtonElement>("#a2luecke")!).disabled = !lg;
  q("#a2ganz")!.setAttribute("aria-pressed", String(ganz));
  qa(".a2marke").forEach(m => { const [za, zb] = markeStrecke(m); m.setAttribute("aria-pressed", String(!ganz && za === E.von && zb === E.bis)); });
  const br = q("#a2brush");
  if(br){ br.hidden = ganz; br.style.left = pr(a / T()); br.style.width = pr((b - a) / T()); }
  q("#a2fokus")!.setAttribute("aria-label", t("analysis.e.p.fokusLabel", {dauer: f.uhr(T()), bereich: ganz ? t("analysis.e.p.ganzerKampf") : f.uhr(a) + " – " + f.uhr(b)}));
}

/** Die Strecke einer Marke: Luecke und Spitze wie sie sind, ein Punktereignis (Salve, Einsatz, Zielwechsel) mit 2 s Luft. */
function markeStrecke(m: HTMLElement): [number, number] {
  const a = +(m.dataset.von || 0), b = +(m.dataset.bis || 0);
  const punkt = m.dataset.art === "salve" || m.dataset.art === "einsatz" || m.dataset.art === "ziel";
  return punkt ? [Math.max(0, Math.floor(a) - 1), Math.min(T(), Math.ceil(b) + 1)] : [a, b];
}

/** Den Bereich setzen: [a, b) in ganzen Sekunden, mindestens 1 s, innerhalb des Kampfs; null hebt auf. */
export function setzen(a: number | null, b?: number, quelle?: string): void {
  const Td = T();
  if(a == null || b == null){ E.von = E.bis = null; }
  else {
    a = Math.round(a); b = Math.round(b);
    a = Math.max(0, Math.min(Td - 1, a)); b = Math.max(a + 1, Math.min(Td, b));
    if(a <= 0 && b >= Td){ E.von = E.bis = null; } else { E.von = a; E.bis = b; }
  }
  const [p, qq] = bereichVon(), ganz = E.von == null;
  const imB = (tt: number) => ganz || (tt >= p && tt < qq);
  qa("#a2graf .a2bahn i, #a2graf .a2bahn .perle").forEach(e => e.classList.toggle("aus", !imB(+e.style.left.replace("%", "") / 100 * Td)));
  steuerSync();
  auswertung();
  pruefstandZeichnen();
  if(quelle !== "tipp") tabelleZeit();
}

/* ---------- die Bereichsauswertung ---------- */
export function auswertung(): void {
  const d = daten(), f = fm();
  const [a, b] = bereichVon();
  const kz = bereich(d.k, d.best, d.decke, a, b), s = saetze(kz);
  q("#a2bereichZeit")!.textContent = kz.ganz ? t("analysis.e.ui.bereich.ganz", {dauer: f.uhr(kz.T)}) : t("analysis.e.ui.bereich.teil", {von: f.uhr(kz.a), bis: f.uhr(kz.b), dauer: f.sek(kz.dauer), zeit: f.pr(kz.anteilZeit), schaden: f.pr(kz.anteil)});
  q("#a2satz")!.innerHTML = esc(satzText(s.kopf)).replace(/(\d[\d.,]*[kM]?) (je Sekunde|per second)/, '<span class="z">$1</span> $2');
  /* Was die Seite beisteuert (SE): im ganzen Kampf die staerksten 5 s mit der tragenden Faehigkeit an die Stelle des Satzes zur Spitze,
     bei einem Bereich nur, was ihn trifft (die schwaechste Stelle, der Abstand); jeder mit seinem Weg in die Rotation, wo er einen hat. */
  const trifft = (x: SeitenSatz) => kz.ganz || (x.von != null && x.bis != null && x.bis > kz.a && x.von < kz.b);
  const extra = (x: SeitenSatz) => '<li data-k="' + x.k + '">' + esc(x.text) + mitKnopf(x) + mitZeit(x) + "</li>";
  const strecke = seite("strecke");
  const gutKern = kz.ganz && strecke ? s.gut.filter(x => x.k !== "spitze") : s.gut;
  // die Rate der direkten Treffer (vorher "Wie triffst du?", B3) steht im ganzen Kampf unter "Gut hier": sie gilt dem ganzen Kampf, nicht einem Bereich
  const raten = kz.ganz ? seite("raten") : undefined;
  const gutMehr = [...(kz.ganz && strecke ? [extra(strecke)] : []), ...(raten ? [extra(raten)] : [])];
  const li = (l: {satz: {key: string; vars: Record<string, unknown>}; neutral?: boolean}[], mehr: string[]) => l.length || mehr.length
    ? l.map(x => "<li" + (x.neutral ? ' class="leer"' : "") + ">" + esc(satzText(x.satz)) + "</li>").join("") + mehr.join("")
    : '<li class="leer">' + esc(t("analysis.e.ui.bereich.nichts")) + "</li>";
  q("#a2gut")!.innerHTML = li(gutKern, gutMehr);
  q("#a2besser")!.innerHTML = li(s.besser, SE.filter(x => (x.k === "stelle" || x.k === "abstand") && trifft(x)).map(extra));
  // der Vergleich der Haelften unter dem Satz des Bereichs, nur im ganzen Kampf; ein Bereich hat seinen eigenen Satz
  const haelften = q("#a2haelften")!, hs = seite("haelften");
  haelften.textContent = kz.ganz && hs ? hs.text : ""; haelften.hidden = !(kz.ganz && hs);
  // wovon die Rate gerechnet ist, der Anteil der Krits am Schaden, starke Treffer, Schild: leise darunter, ebenfalls nur im ganzen Kampf
  const treffer = q("#a2treffer")!, tr = seite("treffer");
  treffer.textContent = kz.ganz && tr ? tr.text : ""; treffer.hidden = !(kz.ganz && tr);
  // ein Bereich laesst sich in der Rotation zeigen; der Knopf steht an der Zeile des Satzes (Inventur O10)
  const weg = q("#a2weg")!;
  weg.innerHTML = kz.ganz ? "" : rotKnopf(kz.a, kz.b, "analysis.inRotation.bereich"); weg.hidden = kz.ganz;
  const unv = q("#a2unv")!, us = seite("unverwundbar");
  unv.textContent = us ? us.text : ""; unv.hidden = !us;
  const start = q("#a2start")!, ss = seite("start");
  start.innerHTML = ss ? esc(ss.text) + mitKnopf(ss) : ""; start.hidden = !ss;
  const rel = kz.dpsKampf ? kz.dps / kz.dpsKampf - 1 : 0, vz = (x: number) => (x >= 0 ? "+" : "−") + f.pr(Math.abs(x));
  const m = kz.mischung.slice(0, 3);
  const wer = t("analysis.e.p." + bestWer());
  const kachel = (titel: string, zahl: string, n: string, befund = false) => "<div><dt>" + esc(titel) + '</dt><dd><span class="zahl' + (befund ? " befund" : "") + '">' + zahl + '</span><span class="n">' + n + "</span></dd></div>";
  q("#a2kacheln")!.innerHTML =
    kachel(t("analysis.e.ui.kachel.dps"), f.kurz(kz.dps), esc((kz.ganz ? t("analysis.e.p.derKampf") : t("analysis.e.p.zumKampf", {v: vz(rel)})) + (kz.bestDps != null ? ", " + t("analysis.e.p.zumBest", {v: vz(kz.dps / kz.bestDps - 1), wer}) : ""))) +
    kachel(t("analysis.e.ui.kachel.leerlauf"), esc(f.sek(Math.round(kz.leerlauf))), esc(kz.luecken.length ? kz.luecken.map(([p, qq]) => f.uhr(p) + "–" + f.uhr(qq)).join(", ") : t("analysis.e.p.keineLuecke")), kz.leerlauf >= 2) +
    kachel(t("analysis.e.ui.kachel.einsaetze"), String(kz.einsaetze), esc(t("analysis.e.p.jeMinute", {n: kz.jeMinute.toFixed(0)}) + (kz.ganz ? "" : ", " + t("analysis.e.p.kampfMinute", {n: kz.jeMinuteKampf.toFixed(0)})))) +
    kachel(t("analysis.e.ui.kachel.krit"), kz.krit == null ? "–" : f.pr(kz.krit), esc(kz.ganz || kz.kritKampf == null ? t("analysis.e.p.kritBasis") : t("analysis.e.p.kritKampf", {q: f.pr(kz.kritKampf)}))) +
    (kz.ventius ? kachel(t("analysis.e.ui.kachel.ventius"), kz.ventius.getroffen + " / " + kz.ventius.moeglich, esc(t("analysis.e.p.ventKachel", {lesbar: kz.ventius.lesbar, soll: kz.ventius.soll, formel: t("analysis.e.ui.ventius.formel", {d: kz.ventius.decke, soll: kz.ventius.soll}), anDecke: kz.ventius.anDecke})), !!kz.ventius.gefehlt) : "") +
    "<div><dt>" + esc(t("analysis.e.ui.kachel.mischung")) + '</dt><dd><div class="a2misch" role="img" aria-label="' + esc(m.map(x => nm(x.name) + " " + f.pr(x.anteil)).join(", ")) + '">' + m.map(x => '<i style="width:' + pr(x.anteil) + '"></i>').join("") + '</div><span class="n">' + esc(m.map(x => (x.name === VENTIUS ? "Ventius" : nm(x.name)) + " " + f.pr(x.anteil)).join(" · ")) + "</span></dd></div>";
}

/* ---------- die Tabelle hinter der Zeitleiste ---------- */
export function tabelleZeit(): void {
  const det = q<HTMLDetailsElement>("#a2tabZeit");
  if(!det || !det.open) return;
  const [a, b] = bereichVon(), f = fm();
  const zeilen = skillsVon(daten().k).flatMap(s => s.einsaetze.filter(e => e.t >= a && e.t < b).map(e => ({...e, name: s.name}))).sort((p, qq) => p.t - qq.t);
  q(".rollt", det)!.innerHTML = "<table><thead><tr><th>" + esc(t("analysis.e.p.tZeit")) + "</th><th>" + esc(t("analysis.e.p.tFaehigkeit")) + '</th><th class="z">' + esc(t("analysis.e.p.tSchaden")) + '</th><th class="z">' + esc(t("analysis.e.p.tTreffer")) + "</th><th>" + esc(t("analysis.e.p.tHitze")) + "</th></tr></thead><tbody>" +
    zeilen.slice(0, 600).map(e => "<tr><td>" + f.uhr(e.t) + "</td><td>" + esc(nm(e.name)) + '</td><td class="z">' + f.kurz(e.dmg) + '</td><td class="z">' + e.n + "</td><td>" + esc(t(HITZE[hitzeVon(e.krit, e.stark, e.n)]!)) + "</td></tr>").join("") +
    (zeilen.length > 600 ? '<tr><td colspan="5">' + esc(t("analysis.e.p.tWeitere", {n: zeilen.length - 600})) + "</td></tr>" : "") + "</tbody></table>";
}

/* ---------- die gewaehlte Faehigkeit: Bahn und Karte gehoben, ihre Einsaetze als Kerben am Fuss der Kurve ---------- */
export function hebenAnwenden(vorschau?: string | null): void {
  const an = E.hebt, zeig = vorschau && vorschau !== an ? vorschau : null;
  const g = q("#a2graf"); if(g) g.classList.toggle("gewaehlt", !!an);
  qa("#a2graf [data-skill]").forEach(e => {
    const ja = !!an && e.dataset.skill === an;
    e.classList.toggle("hebt", ja); e.classList.toggle("zeigt", !!zeig && e.dataset.skill === zeig);
    const bk = q(".bezk", e); if(bk) bk.setAttribute("aria-pressed", String(ja));
  });
  qa(".a2karte").forEach(e => {
    const ja = !!an && e.dataset.skill === an;
    e.classList.toggle("hebt", ja); e.classList.toggle("zeigt", !!zeig && e.dataset.skill === zeig);
    const nmK = q(".nm", e); if(nmK) nmK.setAttribute("aria-pressed", String(ja));
    const h = q(".kwahl", e); if(h) h.textContent = ja ? t("analysis.e.ui.karte.gewaehlt") : t("analysis.e.ui.karte.wahl");
  });
  const kb = q("#a2kerben"); if(!kb) return;
  const alle = skillsVon(daten().k), s = an ? alle.find(x => x.name === an) : null, v = zeig ? alle.find(x => x.name === zeig) : null;
  kb.innerHTML = (s ? s.einsaetze.map(e => '<i style="left:' + pr(e.t / T()) + '"></i>').join("") : "") + (v ? v.einsaetze.map(e => '<i class="vor" style="left:' + pr(e.t / T()) + '"></i>').join("") : "");
  const hw = q("#a2bahnHinweis");
  if(hw) hw.innerHTML = s ? '<i class="kb" aria-hidden="true"></i>' + esc(t("analysis.e.ui.bahn.gewaehlt", {name: nm(s.name), n: s.einsaetze.length})) : '<i class="kb leer" aria-hidden="true"></i>' + esc(t("analysis.e.ui.bahn.hinweis"));
}

/** Den Bereich auf eine Strecke setzen ("Zum Beleg" im Kopf, 26); gibt die Kurve als Fokusziel zurueck, null ohne Daten. */
export function bereichZeigen(von: number, bis: number): HTMLElement | null {
  if(!D) return null;
  setzen(von, bis);
  return q("#a2fokus");
}

/** Eine Faehigkeit waehlen oder abwaehlen (Klick, Enter, Leertaste auf Bahn, Name oder Karte). */
export function waehlen(name: string): void {
  E.hebt = E.hebt === name ? null : name;
  hebenAnwenden();
  const s = E.hebt ? skillsVon(daten().k).find(x => x.name === E.hebt) : null;
  q("#a2ansage")!.textContent = s ? t("analysis.e.ui.bahn.gewaehlt", {name: nm(s.name), n: s.einsaetze.length}) : t("analysis.e.ui.bahn.abgewaehlt");
}

/* ---------- die Bedienung ---------- */
function binden(r: HTMLElement): void {
  const lies = (s: string) => { const m = /^(\d+):([0-5]?\d)$/.exec(s.trim()); return m ? +m[1]! * 60 + +m[2]! : /^\d+$/.test(s.trim()) ? +s : null; };
  const tipp = () => {
    const a = lies(q<HTMLInputElement>("#a2von")!.value), b = lies(q<HTMLInputElement>("#a2bis")!.value), ok = a != null && b != null && b > a && a < T();
    q("#a2von")!.setAttribute("aria-invalid", String(a == null)); q("#a2bis")!.setAttribute("aria-invalid", String(b == null || (a != null && b <= a)));
    if(ok) setzen(a, b, "tipp"); else q("#a2lese")!.textContent = t("analysis.e.p.tippFehler", {dauer: fm().uhr(T())});
  };
  q("#a2von")!.addEventListener("change", tipp); q("#a2bis")!.addEventListener("change", tipp);
  q("#a2spitze")!.addEventListener("click", () => { if(graf) setzen(graf.sp[0], graf.sp[1]); });
  q("#a2luecke")!.addEventListener("click", () => { const lg = graf && graf.lk.luecken.reduce<[number, number] | null>((x, g) => !x || g[1] - g[0] > x[1] - x[0] ? g : x, null); if(lg) setzen(lg[0], lg[1]); });
  q("#a2ganz")!.addEventListener("click", () => setzen(null));
  q("#a2tabZeit")!.addEventListener("toggle", tabelleZeit);
  // die Ventius-Karte merkt sich, ob sie aufgeklappt ist (sie wird je Bereich neu gebaut)
  r.addEventListener("toggle", ev => {
    const tg = ev.target as HTMLElement;
    if(tg.id === "a2vent") E.ventOffen = (tg as HTMLDetailsElement).open;
    else if(tg.id === "a2olist") E.listeOffen = (tg as HTMLDetailsElement).open;
    else return;
    detailsFuellen();
  }, true);
  const zeigen = (e: HTMLElement | null) => {
    const n = e ? e.dataset.skill || null : null;
    hebenAnwenden(n);
    const l = q("#a2lese"); if(!l) return;
    l.innerHTML = n ? "<b>" + esc(nm(n)) + "</b> · " + esc(skillInfo(n)) + ' · <span class="wie">' + esc(n === E.hebt ? t("analysis.e.ui.info.abwaehlen") : t("analysis.e.ui.info.waehlen")) + "</span>" : "";
  };
  r.addEventListener("click", ev => {
    const tg = ev.target as HTMLElement;
    // der Weg der Ventius-Karte in die Rekorde (Bester Einsatz je Boss)
    if(tg.closest(".wbrk")){ zuVentius(); return; }
    const m = tg.closest<HTMLElement>(".a2marke");
    if(m){ const [za, zb] = markeStrecke(m); if(E.von === za && E.bis === zb) setzen(null); else setzen(za, zb); return; }
    const s = tg.closest<HTMLElement>(".a2salve");
    if(s){ const tt = +(s.dataset.t || 0); setzen(Math.floor(tt) - 1, Math.floor(tt) + 2); return; }
    const kt = tg.closest<HTMLElement>(".a2karte .nm, #a2graf .bezk, #a2graf .a2bahn[data-skill]");
    if(kt){ const e = kt.closest<HTMLElement>("[data-skill]")!; waehlen(e.dataset.skill!); zeigen(e); }
  });
  r.addEventListener("pointerover", ev => { const e = (ev.target as HTMLElement).closest<HTMLElement>("[data-skill]"); if(e) zeigen(e); });
  r.addEventListener("pointerout", ev => { const e = (ev.target as HTMLElement).closest<HTMLElement>("[data-skill]"); const rt = ev.relatedTarget as Node | null; if(e && !(rt && e.contains(rt))) zeigen(null); });
  r.addEventListener("focusin", ev => { const e = (ev.target as HTMLElement).closest<HTMLElement>(".bezk, .a2karte .nm"); if(e) zeigen(e.closest<HTMLElement>("[data-skill]")); });
  r.addEventListener("focusout", ev => { if((ev.target as HTMLElement).closest(".bezk, .a2karte .nm")) zeigen(null); });
  // die Kurve: Ziehen setzt den Bereich, Zeigen liest die Sekunde
  let zieh: {r: DOMRect; start: number; griff: string | null; a0: number | null; b0: number | null; bewegt: boolean} | null = null;
  r.addEventListener("pointerdown", ev => {
    const kurve = (ev.target as HTMLElement).closest<HTMLElement>("#a2kurve"); if(!kurve || ev.button !== 0) return;
    const rc = kurve.getBoundingClientRect(), s = Math.max(0, Math.min(T(), T() * (ev.clientX - rc.left) / rc.width));
    const griff = (ev.target as HTMLElement).closest<HTMLElement>(".a2griff");
    zieh = {r: rc, start: s, griff: griff ? griff.dataset.griff || null : null, a0: E.von, b0: E.bis, bewegt: false};
    kurve.setPointerCapture(ev.pointerId); ev.preventDefault();
  });
  r.addEventListener("pointermove", ev => {
    const kurve = q("#a2kurve"); if(!kurve) return;
    const rc = zieh ? zieh.r : kurve.getBoundingClientRect();
    const s = Math.max(0, Math.min(T(), T() * (ev.clientX - rc.left) / rc.width));
    if(zieh){
      zieh.bewegt = zieh.bewegt || Math.abs(s - zieh.start) >= 0.5;
      if(!zieh.bewegt) return;
      let a: number, b: number;
      if(zieh.griff === "a"){ a = Math.min(s, (zieh.b0 ?? T()) - 1); b = zieh.b0 ?? T(); }
      else if(zieh.griff === "b"){ a = zieh.a0 ?? 0; b = Math.max(s, (zieh.a0 ?? 0) + 1); }
      else { a = Math.min(zieh.start, s); b = Math.max(zieh.start, s); }
      setzen(a, b, "zieh");
      return;
    }
    if(!(ev.target as HTMLElement).closest("#a2kurve")) return;
    const z = q("#a2zeig")!; z.hidden = false; z.style.left = pr(s / T());
    const d = daten(), f = fm();
    const i = Math.min(d.k.schadenJeSekunde.length - 1, Math.floor(s)), b = d.best;
    q("#a2lese")!.innerHTML = "<b>" + f.uhr(s) + "</b> · " + esc(t("analysis.e.p.leseSekunde", {dmg: f.kurz(d.k.schadenJeSekunde[i] ?? 0)})) +
      (b && b.schadenJeSekunde[i] != null ? " · " + esc(t("analysis.e.p.leseBest", {wer: t("analysis.e.p." + bestWer()), dmg: f.kurz(b.schadenJeSekunde[i]!)})) : "") +
      (graf && graf.lk.luecken.some(([p, qq]) => s >= p && s < qq) ? " · " + esc(t("analysis.e.ui.legende.luecke")) : "");
  });
  const loslassen = (ev: PointerEvent) => {
    if(!zieh) return;
    const kurve = q("#a2kurve");
    if(!zieh.bewegt && !zieh.griff){ if(E.von != null) setzen(null); }
    zieh = null;
    if(kurve && ev.pointerId != null){ try { kurve.releasePointerCapture(ev.pointerId); } catch(_e){ /* schon frei */ } }
    q("#a2fokus")?.focus({preventScroll: true});
  };
  r.addEventListener("pointerup", loslassen); r.addEventListener("pointercancel", loslassen);
  r.addEventListener("pointerleave", ev => { if((ev.target as HTMLElement).id === "a2kurve"){ q("#a2zeig")!.hidden = true; q("#a2lese")!.textContent = ""; } }, true);
  // Tastatur auf der Kurve, im Raster der Salven Pfeile von Salve zu Salve
  r.addEventListener("keydown", ev => {
    const tg = ev.target as HTMLElement;
    if(tg.closest(".a2marke, .a2salve") && (ev.key === "Enter" || ev.key === " ")){ tg.click(); ev.preventDefault(); return; }
    const sv = tg.closest<HTMLElement>(".a2raster .a2salve");
    if(sv && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")){ const alle = qa(".a2raster .a2salve"), i = alle.indexOf(sv), j = Math.max(0, Math.min(alle.length - 1, i + (ev.key === "ArrowRight" ? 1 : -1))); alle[j]!.focus(); ev.preventDefault(); return; }
    // Escape: auf der Kurve zuerst der Bereich, sonst zuerst die gehobene Faehigkeit
    if(ev.key === "Escape"){
      if(E.von != null && tg.closest("#a2fokus")){ setzen(null); ev.preventDefault(); return; }
      if(E.hebt){ waehlen(E.hebt); ev.preventDefault(); return; }
      if(E.von != null && tg.closest(".a2zeit")){ setzen(null); q("#a2fokus")?.focus(); ev.preventDefault(); }
      return;
    }
    if(!tg.closest("#a2fokus")) return;
    const Td = T(), schritt = ev.shiftKey ? 5 : 1;
    const [a, b] = bereichVon();
    const ganz = E.von == null, k = ev.key;
    if(k === "Enter" || k === " "){ if(ganz) setzen(0, Math.min(Td, 10)); else setzen(null); }
    else if(k === "Home"){ if(ganz) setzen(0, 10); else setzen(0, b - a); }
    else if(k === "End"){ if(ganz) setzen(Td - 10, Td); else setzen(Td - (b - a), Td); }
    else if(k === "PageUp" || k === "PageDown"){ const dd = k === "PageDown" ? 10 : -10; if(ganz) setzen(Math.max(0, dd), Math.max(0, dd) + 10); else { const na = Math.max(0, Math.min(Td - (b - a), a + dd)); setzen(na, na + (b - a)); } }
    else if(k === "ArrowLeft" || k === "ArrowRight"){
      const dd = (k === "ArrowRight" ? 1 : -1) * schritt;
      if(ganz) setzen(0, 10);
      else if(ev.ctrlKey) setzen(Math.min(b - 1, a + dd), b);
      else if(ev.altKey) setzen(a, Math.max(a + 1, b + dd));
      else { const l = b - a, na = Math.max(0, Math.min(Td - l, a + dd)); setzen(na, na + l); }
    }
    else if(k === "+" || k === "="){ if(ganz) setzen(0, 10); else setzen(a - schritt, b + schritt); }
    else if(k === "-" || k === "_"){ if(!ganz && b - a > 2) setzen(a + schritt, b - schritt); }
    else return;
    ev.preventDefault();
  });
  // Esc nimmt die Wahl auch zurueck, wenn der Fokus nach einem Mausklick auf der Seite liegt (Bahnen sind kein Fokusziel)
  document.addEventListener("keydown", ev => {
    const tg = ev.target as HTMLElement;
    if(ev.key === "Escape" && E.hebt && D && !r.contains(tg) && !tg.closest("input, textarea, select, dialog")){ waehlen(E.hebt); ev.preventDefault(); }
  });
  /* Die Schriften sind eingebettet und kommen asynchron: die Breite der Marken und der Chips, nach der die Reihen gesetzt werden,
     stimmt erst, wenn sie da sind. Kommt eine nach, wird neu gesetzt. */
  if(typeof document !== "undefined" && document.fonts && document.fonts.addEventListener){
    document.fonts.addEventListener("loadingdone", () => { if(D){ zeitleiste(); pruefstandZeichnen(); } });
  }
  if(typeof ResizeObserver !== "undefined"){ let bW = 0; new ResizeObserver(() => { const bw = r.clientWidth; if(D && bw && Math.abs(bw - bW) > 40){ bW = bw; zeitleiste(); pruefstandZeichnen(); } }).observe(r); }
}

/* ---------- Einstieg ---------- */

/**
 * Die neue Analyse fuer diesen Kampf zeichnen. Der Stand (Bereich, Wahl)
 * gilt je Kampf; unter Live kommt derselbe Kampf alle zwei Sekunden wieder,
 * dann wird nur neu gezeichnet, wenn sich Daten oder Sprache geaendert haben.
 */
let zuletzt = "";
export function renderNeueAnalyse(d: AnalyseDaten | null, kampfId: number | null, zusatz: ZusatzMap | null = null, seiten: SeitenSatz[] = []): void {
  const r = q("#a2");
  if(!r) return;
  if(!d){ r.hidden = true; D = null; Z = null; SE = []; zuletzt = ""; return; }
  r.hidden = false;
  if(E.kampf !== kampfId){ E.kampf = kampfId; E.von = E.bis = null; E.hebt = null; }
  const sprache = state.lang;
  if(r.dataset.sprache !== sprache){ r.dataset.sprache = sprache; r.dataset.fertig = "0"; }
  a2Wurzel();
  Z = zusatz; SE = seiten;
  const stempel = [kampfId, d.k.schaden, d.k.einsaetze.length, d.best ? d.best.dps : "-", sprache, zusatz ? JSON.stringify([...zusatz]) : "-", JSON.stringify(seiten)].join("|");
  const neu = D !== d;
  D = d;
  if(!neu && stempel === zuletzt) return;
  zuletzt = stempel;
  zeitleiste(); auswertung(); pruefstandZeichnen(); tabelleZeit();
}

