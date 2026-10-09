import { t } from "./08-translation";
import { esc } from "./18-interface-basics";
import { KOMPAKT_FENSTER, OWN_WINDOW, SERVED } from "./41-server-mode";
import { haken, weekliesAendern, weekliesAnsage, weekliesDauer, weekliesDaten, weekliesOffen } from "./59-weeklies";
import type { Erinnerung } from "../weeklies-core";

/* ---------- Erinnerungen (Spezifikation Weeklies neu, 3.6 und 6) ----------
   Der Dialog stellt die Erinnerungen ein; sie stehen bei den Weeklies in der
   Datei (src/main/weeklies.ts) und laufen im Hauptprozess (zeitplan.ts), nur
   solange Borometer laeuft - das sagt der Dialog oben, ehrlich und immer. Die
   Seite hat dazu kein Netz: sie liest und schreibt wie sonst nur /api/... auf
   127.0.0.1. Wird eine Erinnerung faellig, erhoeht der Hauptprozess den
   Zaehler "erinnerung"; die Seite fragt GET /api/erinnerung nach den offenen
   Anfragen und antwortet mit POST /api/erinnerung {id, n}: genau diese zwei
   Felder, nie einen Text. n ist die Zahl der Charaktere mit offener Woche.
   Loesen setzt "geloest" und bietet Rueckgaengig an, nichts wird entfernt. */

const MAX_AKTIV = 12;
const TAGE_FOLGE = [1, 2, 3, 4, 5, 6, 0];
const ZEIT_RX = /^([01]\d|2[0-3]):[0-5]\d$/;
const Z36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const GLOCKE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>';

let offen = false, naechste: Record<string, number | null> = {};
let undoE: {r: Erinnerung; pos: number} | null = null;
/** Das Element (data-fe), das nach dem naechsten Zeichnen des Dialogs den Fokus bekommt. */
let fokusE: string | null = null;

function neueId(): string {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return "e" + [...a].map(b => Z36[b % 36]).join("");
}
const liste = (): Erinnerung[] => weekliesDaten()?.erinnerungen ?? [];
const aktivZahl = () => liste().filter(r => !r.geloest).length;
const hhmm = (d: Date) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");

/* ---------- Die Glocke im Kopf ---------- */
function glockeSetzen(){
  const k = document.querySelector<HTMLButtonElement>("#wkGlocke");
  if(!k) return;
  const n = liste().filter(r => r.an && !r.geloest).length;
  k.hidden = false;
  const h = GLOCKE + "<span>" + esc(t("weeklies.erin.knopf")) + '</span><span class="wkgz">' + n + "</span>";
  if(k.dataset.marke !== h){ k.innerHTML = h; k.dataset.marke = h; }
  k.setAttribute("aria-label", t("weeklies.erin.knopfVh", {n}));
}

/* ---------- Der Dialog ---------- */
function erinHtml(r: Erinnerung): string {
  const nx = naechste[r.id];
  let naechsteText = t("weeklies.erin.keine");
  if(r.an && typeof nx === "number"){
    const d = new Date(nx);
    naechsteText = t("weeklies.erin.naechste", {tag: t("weeklies.erin.tag." + d.getDay()), zeit: hhmm(d), in: weekliesDauer(nx - Date.now())});
  }
  const name = t("weeklies.erin.an", {zeit: r.zeit});
  const tage = TAGE_FOLGE.map(d => '<button type="button" data-er-tag="' + d + '" data-er="' + r.id + '" data-fe="t:' + r.id + ":" + d + '" aria-pressed="' + r.tage.includes(d) + '">' +
    esc(t("weeklies.erin.tag." + d)) + "</button>").join("");
  return '<div class="wkerin' + (r.an ? "" : " aus") + '" role="group" aria-label="' + esc(name) + '" data-er-zeile="' + r.id + '"><div class="z1">' +
    '<button type="button" class="esw" role="switch" aria-checked="' + r.an + '" data-er-an="' + r.id + '" data-fe="a:' + r.id + '" aria-label="' + esc(name) + '"><span class="esw-t" aria-hidden="true"></span></button>' +
    '<span class="tage" role="group" aria-label="' + esc(t("weeklies.erin.tage")) + '">' + tage + "</span>" +
    '<input type="time" value="' + esc(r.zeit) + '" required data-er-zeit="' + r.id + '" data-fe="z:' + r.id + '" aria-label="' + esc(t("weeklies.erin.uhr")) + '">' +
    '<button type="button" class="btn sm leise wkerinlos" data-er-los="' + r.id + '" data-fe="l:' + r.id + '" aria-label="' + esc(t("weeklies.erin.loesen", {zeit: r.zeit})) + '">' + esc(t("weeklies.loesen")) + "</button></div>" +
    '<div class="z1"><input type="text" maxlength="120" value="' + esc(r.text) + '" data-er-text="' + r.id + '" data-fe="x:' + r.id + '" aria-label="' + esc(t("weeklies.erin.text")) +
      '" aria-describedby="wkErinPlatz"></div>' +
    '<div class="z1 vor"><label class="wknur"><input type="checkbox" data-er-nur="' + r.id + '" data-fe="n:' + r.id + '"' + (r.nurOffen ? " checked" : "") + "> " + esc(t("weeklies.erin.nurOffen")) + "</label>" +
    "<span>" + esc(naechsteText) + "</span></div></div>";
}
function dialogHtml(): string {
  const daten = weekliesDaten();
  const hinweis = '<div class="wkehrlich" role="note"><b>' + esc(t("weeklies.erin.hinweisTitel")) + "</b><ul><li>" + esc(t("weeklies.erin.hinweis1")) + "</li><li>" + esc(t("weeklies.erin.hinweis2")) +
    "</li><li>" + esc(t("weeklies.erin.hinweis3")) + "</li>" + (OWN_WINDOW ? "" : "<li>" + esc(t("weeklies.erin.browser")) + "</li>") + "</ul></div>";
  let inhalt: string;
  if(!daten) inhalt = '<p class="wksatz">' + esc(t("weeklies.erin.browser")) + "</p>";
  else {
    const zeilen = liste().filter(r => !r.geloest);
    const undo = undoE ? '<p class="wkgeloest"><span id="wkErinUndoSatz">' + esc(t("weeklies.erin.geloest", {zeit: undoE.r.zeit})) + '</span> <button type="button" class="btn sm" data-er-undo data-fe="undoE" aria-describedby="wkErinUndoSatz">' +
      esc(t("weeklies.undo")) + "</button></p>" : "";
    const voll = aktivZahl() >= MAX_AKTIV;
    inhalt = undo + (zeilen.length ? zeilen.map(erinHtml).join("") : '<p class="wksatz">' + esc(t("weeklies.erin.leer")) + "</p>") +
      '<p class="wkhinweis" id="wkErinPlatz">' + esc(t("weeklies.erin.platzhalter")) + "</p>" +
      (voll ? '<p class="wkhinweis" id="wkErinVoll">' + esc(t("weeklies.erin.voll")) + "</p>" : "");
  }
  const voll = aktivZahl() >= MAX_AKTIV;
  return '<div class="wkdlg" role="dialog" aria-modal="true" aria-labelledby="wkErinT"><h3 id="wkErinT" tabindex="-1">' + esc(t("weeklies.erin.titel")) + "</h3>" +
    '<p class="wksatz">' + esc(t("weeklies.erin.satz")) + "</p>" + hinweis + inhalt +
    '<div class="wkdfuss">' + (daten ? '<button type="button" class="btn sm" data-er-neu data-fe="neu"' + (voll ? ' disabled aria-describedby="wkErinVoll"' : "") + ">" + esc(t("weeklies.erin.neu")) + "</button>" : "<span></span>") +
    '<button type="button" class="btn sm" data-er-zu data-fe="zu">' + esc(t("weeklies.erin.fertig")) + "</button></div></div>";
}
function dialogZeichnen(){
  const schein = document.querySelector<HTMLElement>("#wkErinSchein");
  if(!schein || !offen) return;
  const h = dialogHtml();
  if(schein.dataset.marke !== h){
    // wer den Fokus hatte, behaelt ihn nach dem neuen Zeichnen (zum Beispiel wenn die naechste Zeit eintrifft)
    const war = (document.activeElement as HTMLElement | null)?.dataset.fe;
    if(!fokusE && war && schein.contains(document.activeElement)) fokusE = war;
    schein.innerHTML = h;
    schein.dataset.marke = h;
  }
  if(fokusE){
    const e = schein.querySelector<HTMLElement>('[data-fe="' + fokusE + '"]');
    fokusE = null;
    (e && !(e as HTMLButtonElement).disabled ? e : schein.querySelector<HTMLElement>("#wkErinT"))?.focus();
  }
  glockeSetzen();
}
function oeffnen(){
  const schein = document.querySelector<HTMLElement>("#wkErinSchein");
  if(!schein) return;
  offen = true;
  schein.hidden = false;
  schein.dataset.marke = "";
  fokusE = "zu";
  dialogZeichnen();
  erinnerungAnfragenPruefen();
}
function schliessen(){
  const schein = document.querySelector<HTMLElement>("#wkErinSchein");
  if(!schein || !offen) return;
  offen = false;
  undoE = null;
  schein.hidden = true;
  document.querySelector<HTMLElement>("#wkGlocke")?.focus();
}

/* ---------- Aendern ---------- */
function aendern(id: string, fn: (r: Erinnerung) => void, ansage?: (r: Erinnerung) => string){
  const daten = weekliesDaten();
  if(!daten) return;
  const r = (daten.erinnerungen ?? []).find(x => x.id === id);
  if(!r) return;
  weekliesAendern(() => { fn(r); });
  if(ansage) weekliesAnsage(ansage(r));
  dialogZeichnen();
}
function klick(e: MouseEvent){
  const z = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if(!z || z.disabled) return;
  const d = z.dataset;
  if(d.erZu !== undefined) return schliessen();
  const daten = weekliesDaten();
  if(!daten) return;
  if(d.erNeu !== undefined){
    if(aktivZahl() >= MAX_AKTIV) return;
    const r: Erinnerung = {id: neueId(), an: true, tage: [2], zeit: "18:00", text: t("weeklies.erin.standard"), nurOffen: true};
    weekliesAendern(s => { s.erinnerungen = [...(s.erinnerungen ?? []), r]; });
    weekliesAnsage(t("weeklies.erin.angelegt"));
    fokusE = "t:" + r.id + ":2";
    return dialogZeichnen();
  }
  if(d.erAn){ fokusE = "a:" + d.erAn; return aendern(d.erAn, r => { r.an = !r.an; }, r => t(r.an ? "weeklies.erin.schaltAn" : "weeklies.erin.schaltAus", {zeit: r.zeit})); }
  if(d.erTag !== undefined && d.er){
    const tag = Number(d.erTag);
    const r = (daten.erinnerungen ?? []).find(x => x.id === d.er);
    // mindestens ein Tag bleibt
    if(!r || (r.tage.includes(tag) && r.tage.length === 1)) return;
    fokusE = "t:" + d.er + ":" + tag;
    return aendern(d.er, x => { x.tage = x.tage.includes(tag) ? x.tage.filter(y => y !== tag) : [...x.tage, tag].sort((a, b) => a - b); },
      x => t(x.tage.includes(tag) ? "weeklies.erin.tagAn" : "weeklies.erin.tagAus", {tag: t("weeklies.erin.tag." + tag)}));
  }
  if(d.erLos){
    const i = liste().findIndex(x => x.id === d.erLos);
    const r = liste()[i];
    if(!r) return;
    undoE = {r: {...r}, pos: i};
    fokusE = "undoE";
    return aendern(d.erLos, x => { x.geloest = true; }, x => t("weeklies.erin.geloest", {zeit: x.zeit}));
  }
  if(d.erUndo !== undefined && undoE){
    const u = undoE;
    undoE = null;
    fokusE = "l:" + u.r.id;
    return aendern(u.r.id, x => { delete x.geloest; }, x => t("weeklies.erin.zurueck", {zeit: x.zeit}));
  }
}
function wechsel(e: Event){
  const i = e.target as HTMLInputElement;
  const d = i.dataset;
  if(d.erZeit){
    // nur eine gueltige Zeit gilt; sonst bleibt die alte
    if(ZEIT_RX.test(i.value)) aendern(d.erZeit, r => { r.zeit = i.value; });
    else dialogZeichnen();
    return;
  }
  if(d.erText){
    const text = [...i.value.trim()].slice(0, 120).join("");
    if(text) aendern(d.erText, r => { r.text = text; });
    else { fokusE = "x:" + d.erText; const schein = document.querySelector<HTMLElement>("#wkErinSchein"); if(schein) schein.dataset.marke = ""; dialogZeichnen(); }
    return;
  }
  if(d.erNur) aendern(d.erNur, r => { r.nurOffen = i.checked; });
}
function taste(e: KeyboardEvent){
  if(offen && e.key === "Escape"){ e.preventDefault(); schliessen(); }
}
/* Der Fokus bleibt im Dialog: landet er ausserhalb (Tab ueber das Ende hinaus), geht er auf das erste Feld zurueck. */
function fokusHalten(e: FocusEvent){
  if(!offen) return;
  const schein = document.querySelector<HTMLElement>("#wkErinSchein");
  if(!schein || schein.contains(e.target as Node)) return;
  (schein.querySelector<HTMLElement>("button:not([disabled]), input") ?? schein).focus();
}

/* ---------- Anfragen des Hauptprozesses beantworten ---------- */
let fragt = false;
/** Fragt den Hauptprozess nach offenen Erinnerungen und den naechsten Zeiten; beantwortet jede offene mit {id, n}. */
export function erinnerungAnfragenPruefen(){
  if(!SERVED || KOMPAKT_FENSTER || fragt) return;
  fragt = true;
  fetch("/api/erinnerung").then(r => r.ok ? r.json() : null).then((d: unknown) => {
    fragt = false;
    if(!d || typeof d !== "object") return;
    const o = d as {anfragen?: {id?: unknown}[]; naechste?: Record<string, number | null>};
    if(o.naechste && typeof o.naechste === "object"){ naechste = o.naechste; if(offen){ const s = document.querySelector<HTMLElement>("#wkErinSchein"); if(s) s.dataset.marke = ""; dialogZeichnen(); } }
    // nur das eigene Fenster der App beantwortet; im Browser gibt es keine Windows-Meldung
    if(!OWN_WINDOW) return;
    for(const a of o.anfragen ?? []){
      if(typeof a.id !== "string") continue;
      fetch("/api/erinnerung", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id: a.id, n: weekliesOffen()})}).catch(() => {});
    }
  }, () => { fragt = false; });
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  const schein = document.createElement("div");
  schein.id = "wkErinSchein";
  schein.className = "wkschein";
  schein.hidden = true;
  document.body.append(schein);
  schein.addEventListener("click", e => { if(e.target === schein) schliessen(); else klick(e); });
  schein.addEventListener("change", wechsel);
  document.addEventListener("keydown", taste);
  document.addEventListener("focusin", fokusHalten);
  document.querySelector("#wkGlocke")?.addEventListener("click", oeffnen);
  // nach jedem Zeichnen der Weeklies stimmt die Zahl an der Glocke, nach jedem Speichern die Zeit der naechsten Meldung
  haken.gezeichnet = glockeSetzen;
  haken.gespeichert = () => { if(offen) erinnerungAnfragenPruefen(); };
  glockeSetzen();
}
