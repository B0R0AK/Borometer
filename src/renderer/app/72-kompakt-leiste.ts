import { state } from "./01-state";
import { t } from "./08-translation";
import { $, esc } from "./18-interface-basics";
import { renderAll } from "./32-history";
import { applyWindowSize } from "./36-dialog";
import { SERVED } from "./41-server-mode";
import { streifenHaken, weekliesAnsage, weekliesCharaktere, weekliesDaten, weekliesDauer, weekliesLage, weekliesPunkteFuer, weekliesZaehlen, type StreifenPunkt } from "./59-weeklies";
import { WK_MARKE, wkHatBild } from "./60-weeklies-bilder";
import { KN_GRUND_WK, ansichtWechsel, erinnerungFaellig, offenePunkte, zeilenSicht, type Ansicht } from "../kompakt-core";
import { naechsterReset } from "../weeklies-core";

/* ---------- Die Leiste des Streifens (Spezifikation Kompakt neu, 14.10.2026, Issue #241; Panel 21.10.2026, #287) ----------
   Zwei Ansichten, immer nur eine: Kampf (die Zeilen stehen in #bars, gezeichnet von der Tafel, 21; hier nur der Name fuer
   Vorleser) und Weeklies (#kwk: Kopf, Zeile, die Zeilen der offenen Punkte; "Platte" heisst aus Gewohnheit noch im Code). Die Reiter stehen in der Leiste
   (#knTabs). Der Stand der Weeklies kommt ueber 59-weeklies.ts aus der Weeklies-Datei, wie in der Vollansicht; dieses Teil
   fragt nichts selbst an. Der leise Punkt am Reiter sagt "Erinnerung faellig" (kompakt-core.ts: erinnerungFaellig).
   Nur im Kompakt (body.compact); in der Vollansicht ist alles verborgen. */

let ansicht: Ansicht = "kampf";
/** Der Charakter, den der Nutzer im Streifen gewaehlt hat; null heisst keine Wahl: dann der erste der Reihe, also der Main (Twinks Schritt 3). */
let gewaehlt: string | null = null;
/** Der gezeigte Charakter: die Wahl, solange es ihn gibt, sonst der erste der Reihe. */
function wahlJetzt(chars: {id: string}[]): string | null { return chars.some(c => c.id === gewaehlt) ? gewaehlt : chars[0]?.id ?? null; }
/** Wann die Ansicht Weeklies zuletzt offen war; der Punkt am Reiter geht, wenn sie nach der Erinnerung offen war. */
let gesehen: number | null = null;
/** Der Punkt, der nach dem Neuzeichnen den Fokus bekommt (Schluessel), und der mit dem einen Tabstopp. */
let fokusK: string | null = null, tabK: string | null = null;
/** Der Knopf "+N weitere" der Weeklies wird beim Neuzeichnen neu gebaut: danach bekommt er den Fokus zurueck. */
let fokusRest = false;

const kompakt = () => document.body.classList.contains("compact");
export const kompaktAnsicht = (): Ansicht => kompakt() ? ansicht : "kampf";

function ring(anteil: number, r: number, cls: string): string {
  const u = 2 * Math.PI * r, a = Math.max(0, Math.min(1, anteil));
  return '<svg class="' + cls + '" viewBox="0 0 ' + (2 * r + 6) + " " + (2 * r + 6) + '" aria-hidden="true"><circle class="b" cx="' + (r + 3) + '" cy="' + (r + 3) + '" r="' + r + '"/>' +
    '<circle class="f" cx="' + (r + 3) + '" cy="' + (r + 3) + '" r="' + r + '" stroke-dasharray="' + (u * a).toFixed(1) + " " + u.toFixed(1) + '"/></svg>';
}
const FLUEGEL = /(Normal|Schwer|Albtraum)$/;

function ansagen(text: string){
  const a = document.querySelector("#kwkAnsage");
  if(a){ a.textContent = ""; setTimeout(() => { a.textContent = text; }, 30); }
  weekliesAnsage(text);
}

/* ---------- Wechsel der Ansicht ---------- */
export function setzeAnsicht(a: Ansicht, fokus = false){
  if(a === ansicht) { if(fokus) $("#" + (a === "kampf" ? "knTabK" : "knTabW")).focus(); return; }
  ansicht = a;
  if(a === "weeklies") gesehen = Date.now();
  document.body.classList.remove("kn-alle");   // jede Ansicht beginnt zugeklappt
  /* und mit ihrer eigenen Hoehe: eine von Hand gezogene Hoehe galt der Ansicht davor (Weeklies aufgeklappt liess den Kampf so hoch, #348) */
  state.compactHandSized = false;
  ansagen(t(a === "kampf" ? "compact.ansageK" : "compact.ansageW"));
  // renderAll blendet #app und #kwk um und ruft syncLeiste; danach misst sich das Fenster neu
  renderAll();
  applyWindowSize();
  if(fokus) $("#" + (a === "kampf" ? "knTabK" : "knTabW")).focus();
}

/* ---------- die Platten der Weeklies ---------- */
function punktHtml(x: StreifenPunkt): string {
  const k = x.schluessel, flg = k.replace(FLUEGEL, "");
  const bild = wkHatBild(k) ? k : wkHatBild(flg) ? flg : "";
  const sym = bild ? '<i class="kn-sym wkb-' + bild + '"></i>' : '<span class="kn-sym kn-marke">' + (WK_MARKE[k] ?? WK_MARKE.eigen) + "</span>";
  const klein = x.menge > 1 ? x.stand + "/" + x.menge : x.takt === "tag" ? t("weeklies.taeglich") : "";
  return '<button type="button" class="kn-platte kn-wplatte" role="listitem" data-k="' + esc(k) + '" tabindex="' + (k === tabK ? 0 : -1) + '"' +
    ' data-name="' + esc(x.name) + '" title="' + esc(x.name) + '" aria-label="' + esc(t("compact.wkPunkt", {name: x.name, n: x.stand, m: x.menge})) + '">' +
    '<span class="kn-ringsym">' + ring(x.menge ? x.stand / x.menge : 0, 11, "") + sym + "</span>" +
    '<span class="kn-wn">' + esc(x.name) + '</span><span class="kn-m">' + esc(klein) + "</span></button>";
}
/** Der Knopf "+N weitere" (zu) und "weniger" (auf) unter den Zeilen der Weeklies; dieselbe Gestalt wie #kRest im Kampf. */
function restHtml(n: number, alle: boolean): string {
  return '<button type="button" id="kwkRest" class="krest kn-wrest" aria-expanded="' + alle + '" aria-label="' + esc(alle ? t("compact.wenigerName") : t("compact.wkRestName", {n})) + '">' +
    '<span class="krestn" aria-hidden="true">' + (alle ? "−" : "+" + n) + '</span><span class="krestw" aria-hidden="true">' + esc(alle ? t("compact.weniger") : t("compact.restKurz")) + "</span></button>";
}
/** "+N weitere" und "weniger": klappt die Liste an Ort und Stelle auf und zu (Spezifikation Panel 3). Gilt fuer Kampf und Weeklies. */
export function kompaktAufklappen(){
  document.body.classList.toggle("kn-alle");
  /* Auf- und Zuklappen ist ein neuer Wunsch an die Hoehe: ein von Hand gezogenes Fenster folgt der Liste wieder (#348) */
  state.compactHandSized = false;
  renderAll();
  applyWindowSize();
}
function zeichneWeeklies(){
  const kopf = $("#kwkKopf"), lese = $("#kwkLese"), pl = $("#kwkPlatten"), kb = $("#kwkRestBox");
  const lage = weekliesLage();
  if(lage !== "da"){
    kopf.innerHTML = ""; pl.innerHTML = ""; kb.innerHTML = "";
    lese.innerHTML = '<span class="kn-grund">' + esc(t(lage === "nurApp" ? "weeklies.nurApp" : lage === "laden" ? "weeklies.laden" : "weeklies.gesperrt")) + "</span>";
    return;
  }
  const jetzt = Date.now(), chars = weekliesCharaktere();
  if(!chars.length){ kopf.innerHTML = ""; pl.innerHTML = ""; kb.innerHTML = ""; lese.innerHTML = '<span class="kn-grund">' + esc(t("weeklies.leer")) + "</span>"; return; }
  const c = chars.find(x => x.id === wahlJetzt(chars))!;
  const alle = weekliesPunkteFuer(c.id), offen = offenePunkte(alle), fertig = alle.length - offen.length;
  kopf.innerHTML = ring(alle.length ? fertig / alle.length : 1, 11, "kn-ring") +
    '<div class="kn-wer"><b>' + esc(c.name) + "</b><span>" + esc(t("compact.wkErledigt", {n: fertig, g: alle.length})) + "</span></div>" +
    '<div class="kn-offen">' + offen.length + "<small>" + esc(t("compact.wkOffen")) + "</small></div>";
  const wahl = chars.length > 1 ? '<span class="kn-wahl"><button type="button" id="knZurueck" aria-label="' + esc(t("compact.wkWahl")) + '">‹</button><button type="button" id="knVor" aria-label="' + esc(t("compact.wkWahl")) + '">›</button></span>' : "";
  lese.innerHTML = '<span class="kn-grund">' + wahl + "<span>" + esc(t("compact.wkReset", {in: weekliesDauer(naechsterReset(jetzt, "woche") - jetzt)})) + '</span></span>';
  if(!offen.some(x => x.schluessel === tabK)) tabK = offen[0]?.schluessel ?? null;
  const alleOffen = document.body.classList.contains("kn-alle");
  const sicht = zeilenSicht(offen.length, alleOffen, KN_GRUND_WK);
  const knopf = sicht.rest > 0 ? restHtml(sicht.rest, false) : alleOffen && offen.length > zeilenSicht(offen.length, false, KN_GRUND_WK).zeigen ? restHtml(0, true) : "";
  const restFokus = fokusRest || document.activeElement?.id === "kwkRest";
  // in der Liste stehen nur listitems; der Knopf steht daneben
  pl.innerHTML = offen.length ? offen.slice(0, sicht.zeigen).map(punktHtml).join("") : '<p class="kn-alles" role="listitem">' + esc(t("compact.wkAlles")) + "</p>";
  kb.innerHTML = offen.length ? knopf : "";
  fokusRest = false;
  if(restFokus) kb.querySelector<HTMLElement>("#kwkRest")?.focus();
  if(fokusK){
    const f = [...pl.querySelectorAll<HTMLElement>(".kn-wplatte")].find(b => b.dataset.k === fokusK) ?? pl.querySelector<HTMLElement>(".kn-wplatte");
    fokusK = null; f?.focus();
  }
}

/* Der Punkt am Reiter: eine Erinnerung war heute faellig, es ist noch etwas offen, und die Ansicht war seit dem nicht offen. */
function hinweisSetzen(){
  const d = weekliesDaten();
  const offen = d ? weekliesCharaktere().reduce((s, c) => s + offenePunkte(weekliesPunkteFuer(c.id)).length, 0) : 0;
  const faellig = !!d && ansicht !== "weeklies" && erinnerungFaellig(d.erinnerungen ?? [], offen, new Date(), gesehen);
  const punkt = $("#knHinweis"), tab = $("#knTabW");
  punkt.hidden = !faellig;
  tab.setAttribute("aria-label", faellig ? t("compact.tabWErinnerung") : t("compact.tabW"));
}

/** Aus renderAll (32): die Reiter stimmen, die Weeklies sind gezeichnet, solange sie gezeigt werden. */
export function syncLeiste(){
  const k = kompakt(), w = k && ansicht === "weeklies";
  document.body.classList.toggle("kn-wk", w);
  $("#kwk").hidden = !w;
  $("#knTabK").setAttribute("aria-label", t("compact.tabK"));   // ohne Kampf stehen nur die Zeichen, der Name bleibt
  $("#knTabK").setAttribute("aria-selected", String(!w)); $("#knTabK").tabIndex = w ? -1 : 0;
  $("#knTabW").setAttribute("aria-selected", String(w)); $("#knTabW").tabIndex = w ? 0 : -1;
  if(!k){ document.body.classList.remove("kn-alle"); return; }
  if(w){ gesehen = Date.now(); zeichneWeeklies(); }
  hinweisSetzen();
}

/* ---------- Der Name steht in der Zeile; fuer Vorleser traegt sie Name, DPS und Anteil ---------- */
function zeileText(z: HTMLElement): {name: string; text: string} {
  const v = (k: string) => (z.querySelector<HTMLElement>('.v[data-k="' + k + '"]')?.textContent ?? "").trim();
  return {name: (z.querySelector(".nmt")?.textContent ?? "").trim(), text: [v("dps") && v("dps") + " DPS", v("share")].filter(Boolean).join(" · ")};
}
/** Die Platten im Kampf tragen im Kompakt einen eigenen Namen fuer Vorleser: Name, DPS, Anteil (markiereRest, 16, ruft das). */
export function plattenBeschriften(box: HTMLElement, an: boolean){
  for(const z of box.querySelectorAll<HTMLElement>(".row:not(.sub)")){
    if(!an){ z.removeAttribute("aria-label"); continue; }
    const q = zeileText(z), s = z.querySelector<HTMLElement>('.v[data-k="share"]')?.textContent?.trim() ?? "";
    z.setAttribute("aria-label", t("compact.platte", {name: q.name, dps: z.querySelector<HTMLElement>('.v[data-k="dps"]')?.textContent?.trim() ?? "", anteil: s}));
  }
}

/* ---------- Bedienung ---------- */
function plattenTaste(e: KeyboardEvent){
  const b = (e.target as HTMLElement).closest<HTMLElement>(".kn-wplatte");
  if(!b) return;
  const alle = [...document.querySelectorAll<HTMLElement>("#kwkPlatten .kn-wplatte")], i = alle.indexOf(b);
  // eine Spalte: rechts und unten gehen vor, links und oben zurueck
  const ziel = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? alle.length - 1 : -1;
  if(ziel >= 0){
    e.preventDefault();
    const z = alle[Math.max(0, Math.min(alle.length - 1, ziel))];
    if(z){ alle.forEach(x => { x.tabIndex = -1; }); z.tabIndex = 0; tabK = z.dataset.k ?? null; z.focus(); z.scrollIntoView({block: "nearest"}); }
  } else if(e.key === "Backspace" || e.key === "Delete"){ e.preventDefault(); zaehlen(b, -1); }
}
function zaehlen(b: HTMLElement, delta: number){
  if(document.body.classList.contains("through")) return;   // im Durchklick nur lesen
  const k = b.dataset.k, id = wahlJetzt(weekliesCharaktere());
  if(!k || !id) return;
  const neu = weekliesZaehlen(id, k, delta);
  if(neu === null) return;
  const x = weekliesPunkteFuer(id).find(p => p.schluessel === k);
  fokusK = k; tabK = k;
  if(x) ansagen(t(neu >= x.menge ? "compact.wkErledigtAnsage" : "compact.wkPunkt", {name: x.name, n: neu, m: x.menge}));
  zeichneWeeklies(); hinweisSetzen();
  applyWindowSize();
}

export function setup(): void {
  const tabs = $("#knTabs");
  tabs.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest("button");
    if(b) setzeAnsicht(b.id === "knTabW" ? "weeklies" : "kampf");
  });
  tabs.addEventListener("keydown", e => {
    if(e.key === "ArrowRight" || e.key === "ArrowLeft"){ e.preventDefault(); setzeAnsicht(ansichtWechsel(ansicht), true); }
  });
  document.addEventListener("keydown", e => {
    if(kompakt() && e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === "w"){ e.preventDefault(); setzeAnsicht(ansichtWechsel(ansicht), true); }
  });
  const pl = $("#kwkPlatten");
  pl.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".kn-wplatte");
    if(b) zaehlen(b, e.shiftKey || e.altKey ? -1 : 1);
  });
  pl.addEventListener("contextmenu", e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".kn-wplatte");
    if(b){ e.preventDefault(); zaehlen(b, -1); }
  });
  pl.addEventListener("keydown", plattenTaste);
  $("#kwkLese").addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest("button");
    if(!b) return;
    const chars = weekliesCharaktere(), jetzt = wahlJetzt(chars), i = chars.findIndex(c => c.id === jetzt);
    if(chars.length < 2) return;
    gewaehlt = chars[(i + (b.id === "knVor" ? 1 : chars.length - 1)) % chars.length]!.id;
    tabK = null; zeichneWeeklies();
    ansagen(chars.find(c => c.id === gewaehlt)!.name);
    $(b.id === "knVor" ? "#knVor" : "#knZurueck").focus();
    applyWindowSize();
  });
  // Im Kampf rollt die Liste mit dem Mausrad (#328); der Hinweis darunter ist seit #348 der Knopf, der alle Zeilen aufklappt und wieder zu
  $("#kRest").addEventListener("click", () => kompaktAufklappen());
  $("#kwkRestBox").addEventListener("click", e => { if((e.target as HTMLElement).closest(".kn-wrest")){ fokusRest = true; kompaktAufklappen(); } });
  streifenHaken.geaendert = () => { if(kompakt()) syncLeiste(); };
  if(SERVED) setInterval(() => { if(kompakt() && ansicht === "weeklies") zeichneWeeklies(); else if(kompakt()) hinweisSetzen(); }, 60000);
}
