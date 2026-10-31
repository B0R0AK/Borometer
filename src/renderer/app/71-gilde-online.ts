import { state } from "./01-state";
import { t } from "./08-translation";
import { esc } from "./18-interface-basics";
import { SERVED } from "./41-server-mode";
import { geloesteListe, gildeLoesen, loeschenGeloest, gildeZurueckholen, lokaleGilde, lokalerName, namenGleich, neueId, onlineAn, onlineAus, onlineBasis, onlineBeschaeftigt, onlineHaken } from "./68-gilde";
import { anzeigeCode, bauEinladung, darf, parseEinladung, pruefeAdresse, pruefeSchreiben, type OnlineRolle } from "../gilde-online-core";
import { wandUhr, type Gilde } from "../gilde-core";

/* ---------- Gilde online (Issue #229, Spezifikation docs/superpowers/specs/2026-10-12-gilde-online-design.md) ----------
   Der Teil der Seite fuer die Gilde auf einem Server. Entwurf am 12.10.2026 gewaehlt: Aufbau A (ein Chip in der Kopfzeile
   der Gilde, die Verwaltung in einer Schublade von rechts) mit dem Assistenten aus Aufbau C fuer den Erststart (vier Schritte in einem Fenster).

   Die Seite spricht nur mit dem lokalen Server, und jede Anfrage beginnt mit /api/gilde-online/ (api) oder ist das Setzen der Einstellung
   (/api/config). Hinaus geht nichts von hier: den Weg zum Server geht allein src/main/gilde-online.ts, nur bei eingeschaltetem "Gilde online",
   nur ueber https und nur an die Adresse, die der Nutzer selbst eingetragen hat. Schluessel gehen nie durch diese Seite, ausser der des neuen
   Bearbeitungslinks, den der Lead einmal sieht und weitergibt. Die Gilde selbst zeichnet und aendert 68-gilde.ts; dieser Teil reicht ihr den Stand
   herein (onlineAn) und nimmt ihr das Speichern ab (onlineHaken.schreiben). Die lokale Datei der Gilde bleibt, wie sie ist.

   Aufgerufen wird nur auf Klick oder solange der Bereich Gilde offen ist: beim Oeffnen und danach alle 30 s ein Abruf (abrufen), nie beim Start. */

/** Was der Hauptprozess der Seite zeigt (gilde-online.ts, status): nie ein Schluessel. */
interface Status {
  an: boolean; adresse: string; adresseOk: boolean; verbunden: boolean; rolle?: OnlineRolle; code?: string; label?: string;
  v?: number; standZeit?: number; offline: boolean; widerrufen?: boolean; beendet?: boolean; entfernt?: boolean; stand?: unknown;
  beendete?: {code: string; name: string; am: string; mitglieder: number}[];
}
interface Antwort { ok: boolean; grund?: string; status?: Status; [k: string]: unknown }
interface Link { id: string; label: string; zeit: number; widerrufen: boolean }
interface Stand { v: number; zeit: number; von: string; marke: string }

const ABRUF_MS = 30000;
const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const NB = "\u00a0";
const MID = "\u00b7";

let st: Status | null = null;
let sichtbar = false, bereit = false;
/** "" zu, "schublade" die Verwaltung, "assistent" der Erststart. */
let fenster: "" | "schublade" | "assistent" = "";
let wz = { schritt: 1, weg: "" as "" | "beitreten", adr: "", einl: "", haken: false, name: "", fehler: "", neu: false };
let links: Link[] | null = null, staende: Stand[] | null = null;
let satz = "", fehlerSatz = "";
let neuLink: { label: string; einladung: string } | null = null;
let linkName = "", markenName = "";
/** Wie viele fruehere Staende die Schublade zeigt: die neuesten, dann je zehn mehr. */
const STAENDE_SEITE = 10;
let staendeZahl = STAENDE_SEITE;
/** Der Server hat die Liste gekuerzt (neueste 200 und alle benannten); aeltere Server melden es nie. */
let staendeGekuerzt = false;
let ansicht: number | null = null, benennen: number | null = null, zurueck: number | null = null, widerruf: string | null = null;
let wiederher: Gilde | null = null;
let sicherung = "";
let unterwegs = false;
let angewendet: { v: number; lesen: boolean } | null = null;
let abrufTimer: ReturnType<typeof setInterval> | null = null;
let fokus = "";
/** Die Frage zum Loesen (lokal) oder Beenden (Lead online): "" zu; dazu, was im Namensfeld steht. Nur in der Sitzung. */
let loesenFrage: "" | "loesen" | "beenden" = "", loesenName = "";
/** Die Frage zum endgueltigen Loeschen einer gelöschten Gilde der Liste: ihre Kennung und was im Feld steht (#240). */
let loeschId: string | null = null, loeschGName = "";
/** Dasselbe fuer eine beendete Gilde des Leads (nach Code): der Server loescht sie (#240). */
let loeschCode: string | null = null, loeschBName = "";

/* ---------- Anfragen an den lokalen Server ---------- */
async function api(pfad: string, body?: unknown): Promise<Antwort> {
  try {
    const r = await fetch("/api/gilde-online/" + pfad, body === undefined ? undefined : {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
    const d: unknown = await r.json();
    return isRec(d) ? d as Antwort : {ok: false, grund: "antwort"};
  } catch { return {ok: false, grund: "offline"}; }
}
async function einstellung(an: boolean, adresse: string){
  try { await fetch("/api/config", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({gildeOnline: an, gildeServer: adresse})}); } catch { /* der naechste Versuch meldet es */ }
}
const istStand = (x: unknown): x is {v: 1; gilde: Gilde} => isRec(x) && x.v === 1 && isRec(x.gilde) && typeof x.gilde.id === "string" && Array.isArray(x.gilde.mitglieder) && Array.isArray(x.gilde.reihen) && isRec(x.gilde.anwesend);

/* ---------- Zustand ---------- */
const rolle = (): OnlineRolle | null => st && st.verbunden ? (st.widerrufen ? "lesen" : st.rolle ?? "lesen") : null;
const online = () => !!st && st.verbunden;
const schreibtDarf = () => { const r = rolle(); return !!r && darf(r, "schreiben") && !st!.offline && !st!.beendet && !st!.entfernt; };
const zeitText = (ms: number) => {
  const s = wandUhr(ms);
  return state.lang === "de" ? s.slice(8, 10) + "." + s.slice(5, 7) + "." + NB + s.slice(11, 16) : s.slice(5, 7) + "/" + s.slice(8, 10) + NB + s.slice(11, 16);
};
const rolleWort = (r: OnlineRolle) => t("gilde.on.rolle." + r);
const kurz = () => !online() ? t("gilde.on.chip.lokal") : t("gilde.on.chip.online", {rolle: rolleWort(rolle()!)});
const lang = () => !online() ? t("gilde.on.status.lokal") : t(st!.offline ? "gilde.on.status.offline" : "gilde.on.status.online", {rolle: rolleWort(rolle()!), zeit: st!.standZeit ? zeitText(st!.standZeit) : ""});
const grundSatz = (g: string | undefined): string => t("gilde.on.grund." + (g && ["offline", "abgelehnt", "spaeter", "einladung", "antwort", "datei", "kein-https", "aus", "adresse", "schon-verbunden", "rolle", "stand", "widerrufen", "veraltet", "keine-gilde", "beendet", "alt", "entfernt"].includes(g) ? g : "antwort"));
function uebernehmen(s: Status | undefined){ if(s) st = s; }

/** Der Stand, der in die Gilde gehoert: ersetzt die Liste, wenn nichts aussteht (oder ausdruecklich erzwungen). */
function anwenden(erzwingen = false){
  if(!st) return;
  if(online() && istStand(st.stand)){
    const lesen = !schreibtDarf();
    const neu = !angewendet || angewendet.v !== st.v || angewendet.lesen !== lesen;
    if(neu && (erzwingen || !onlineBeschaeftigt())){ onlineAn(st.stand.gilde, lesen); angewendet = {v: st.v ?? 0, lesen}; }
  } else if(angewendet){ angewendet = null; onlineAus(); }
}

/* ---------- Abruf und Status ---------- */
async function statusLaden(){
  const a = await api("status");
  if(a.status) st = a.status;
  anwenden();
  zeichnen();
}
async function abrufen(erzwingen = false){
  if(!online() || unterwegs) return;
  const a = await api("abrufen", {erzwingen});
  uebernehmen(a.status);
  if(!a.ok && a.grund === "widerrufen") fehlerSatz = t("gilde.on.zeile.widerrufen");
  else if(!a.ok && a.grund === "offline") fehlerSatz = "";
  else if(!a.ok && (a.grund === "beendet" || a.grund === "entfernt")) fehlerSatz = "";
  else if(a.ok) fehlerSatz = "";
  anwenden();
  zeichnen();
}
function beimOeffnen(an: boolean){
  // 68 meldet bei jedem Neuzeichnen, ob der Bereich offen ist: nur der Wechsel zaehlt
  if(an === sichtbar) return;
  sichtbar = an;
  if(abrufTimer){ clearInterval(abrufTimer); abrufTimer = null; }
  if(!an) return;
  void statusLaden().then(() => abrufen());
  abrufTimer = setInterval(() => { if(sichtbar && fenster !== "assistent") void abrufen(); }, ABRUF_MS);
}

/* ---------- Bausteine ---------- */
const IC = {
  pc: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  wolke: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4.2 4.2 0 0 1 .5 8.5z"/></svg>',
  zu: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  kopie: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>',
  schloss: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
};
const knopf = (text: string, a: string, cls = "", extra = "") => '<button type="button" class="btn sm ' + cls + '" data-ol="' + a + '" ' + extra + ">" + text + "</button>";
const feld = (id: string, label: string, wert: string, extra = "") =>
  '<div class="gl-o-feld"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" data-oin="' + id + '" value="' + esc(wert) + '" autocomplete="off" spellcheck="false" ' + extra + "></div>";
const haken = (id: string, text: string, an: boolean) =>
  '<label class="gl-o-haken"><input type="checkbox" id="' + id + '" data-oin="' + id + '"' + (an ? " checked" : "") + "><span>" + esc(text) + "</span></label>";
const fehlerHtml = () => wz.fehler ? '<p class="gl-o-fehler" role="alert">' + esc(wz.fehler) + "</p>" : "";
const satzLead = () => t("gilde.on.satz.lead");
const satzMitglied = (adr: string) => t("gilde.on.satz.mitglied", {adr});

/* Beitreten: Einladung, Adresse selbst eintragen, Satz bestaetigen */
function beitretenHtml(): string {
  const p = pruefeAdresse(wz.adr);
  return '<div class="gl-o-block"><p class="gl-o-hilfe">' + esc(t("gilde.on.beitreten.hilfe")) + "</p>" +
    feld("gildeOEinl", t("gilde.on.beitreten.einl"), wz.einl, 'placeholder="boro-gilde:K7HQ-3MXP-9WDF"') +
    feld("gildeOAdr2", t("gilde.on.adresse"), wz.adr, 'inputmode="url" placeholder="https://gilde.example.org"') + fehlerHtml() +
    haken("gildeOHakenMit", satzMitglied(p.ok ? p.adresse : t("gilde.on.satz.deineAdresse")), wz.haken) +
    '<div class="gl-o-aktionen">' + knopf(esc(t("gilde.on.beitreten.los")), "beitreten", "hot", 'data-f="beitreten"') + "</div></div>";
}
/* Zugang: Server, Code, Einladung zum Lesen */
function zugangHtml(): string {
  const lead = rolle() === "lead";
  return '<div class="gl-o-block"><dl class="gl-o-dl">' +
    "<div><dt>" + esc(t("gilde.on.server")) + "</dt><dd>" + IC.schloss + "<span>" + esc(st!.adresse) + "</span></dd></div>" +
    "<div><dt>" + esc(t("gilde.on.code")) + '</dt><dd class="gl-o-code">' + esc(anzeigeCode(st!.code ?? "")) + "</dd></div>" +
    (st!.rolle === "bearbeiter" && st!.label ? "<div><dt>" + esc(t("gilde.on.alsBearbeiter")) + "</dt><dd>" + esc(st!.label) + "</dd></div>" : "") + "</dl>" +
    '<div class="gl-o-aktionen">' + knopf(IC.kopie + " " + esc(t("gilde.on.kopieren.code")), "kopieren", "", 'data-was="code" data-f="kopCode"') +
    (lead ? knopf(IC.kopie + " " + esc(t("gilde.on.kopieren.einladung")), "kopieren", "", 'data-was="einladung" data-f="kopEinl"') : "") + "</div>" +
    (lead ? '<p class="gl-o-hilfe">' + esc(t("gilde.on.zugang.hilfe")) + "</p>" : "") +
    (wz.neu ? "" : '<div class="gl-o-aktionen">' + (lead ? knopf(esc(t("gilde.on.zurueckLokal")), "lokal", "", 'data-f="lokal"') : knopf(esc(t("gilde.on.verlassen")), "verlassen", "", 'data-f="verlassen"')) + "</div>") + "</div>";
}
/* Bearbeiter-Links */
function linksHtml(): string {
  const neu = neuLink ? '<div class="gl-o-neu" role="status"><p><b>' + esc(t("gilde.on.link.fuer", {name: neuLink.label})) + "</b> " + MID + " " + esc(t("gilde.on.link.einmal")) + '</p><p class="gl-o-einl">' + esc(neuLink.einladung) + "</p>" +
    '<div class="gl-o-aktionen">' + knopf(IC.kopie + " " + esc(t("gilde.on.kopieren")), "kopieren", "hot", 'data-was="link" data-f="kopLink"') + knopf(esc(t("gilde.on.fertig")), "linkFertig", "", 'data-f="linkFertig"') + "</div></div>" : "";
  const liste = (links ?? []).map(l => '<li class="gl-o-zeile' + (l.widerrufen ? " aus" : "") + '"><span class="gl-o-wer">' + esc(l.label) + '</span><span class="gl-o-meta">' +
    esc(t(l.widerrufen ? "gilde.on.link.widerrufen" : "gilde.on.link.aktiv") + " " + MID + " " + t("gilde.on.link.seit", {zeit: zeitText(l.zeit * 1000)})) + "</span>" +
    (l.widerrufen ? "" : knopf(esc(t("gilde.on.link.widerrufenKnopf")), "widerruf", "", 'data-id="' + esc(l.id) + '" data-f="w' + esc(l.id) + '"')) + "</li>" +
    (widerruf === l.id ? '<li class="gl-o-inline"><p>' + esc(t("gilde.on.link.frage", {name: l.label})) + "</p>" + knopf(esc(t("gilde.on.link.widerrufenKnopf")), "widerrufJa", "hot", 'data-id="' + esc(l.id) + '" data-f="wj"') + knopf(esc(t("gilde.abbrechen")), "abbrechen", "", 'data-f="ab"') + "</li>" : "")).join("");
  return '<div class="gl-o-block"><p class="gl-o-hilfe">' + esc(t("gilde.on.links.hilfe")) + "</p>" +
    (links === null ? '<p class="gl-o-leer">' + esc(t("gilde.laden")) + "</p>" : liste ? '<ul class="gl-o-liste">' + liste + "</ul>" : '<p class="gl-o-leer">' + esc(t("gilde.on.links.leer")) + "</p>") + neu +
    '<div class="gl-o-zeilenform">' + feld("gildeOLink", t("gilde.on.link.name"), linkName, 'maxlength="40" placeholder="Testperson C"') + knopf(esc(t("gilde.on.link.erstellen")), "linkNeu", "", 'data-f="linkNeu"') + "</div></div>";
}
const vonText = (von: string) => von === "lead" ? t("gilde.on.rolle.lead") : (links ?? []).find(l => l.id === von)?.label ?? von;
/* Fruehere Staende */
function staendeHtml(): string {
  const neuste = (staende ?? [])[0]?.v ?? 0;
  const alle = staende ?? [], rest = Math.max(0, alle.length - staendeZahl);
  const z = alle.slice(0, staendeZahl).map(s => '<li class="gl-o-zeile"><span class="gl-o-v">v' + s.v + '</span><span class="gl-o-wer">' + esc(zeitText(s.zeit * 1000) + " " + MID + " " + vonText(s.von)) +
    (s.marke ? ' <span class="gl-o-marke">' + esc(s.marke) + "</span>" : "") + '</span><span class="gl-o-zaktion">' +
    knopf(esc(t("gilde.on.staende.ansehen")), "ansehen", "", 'data-v="' + s.v + '" data-f="a' + s.v + '"') + knopf(esc(t("gilde.on.staende.benennen")), "benennen", "", 'data-v="' + s.v + '" data-f="b' + s.v + '"') +
    knopf(esc(t("gilde.on.staende.zurueck")), "zurueck", "", 'data-v="' + s.v + '" data-f="z' + s.v + '"') + "</span></li>" +
    (benennen === s.v ? '<li class="gl-o-inline">' + feld("gildeOMarke", t("gilde.on.staende.markeName", {v: s.v}), markenName, 'maxlength="60"') + knopf(esc(t("gilde.on.speichern")), "markeSpeichern", "hot", 'data-v="' + s.v + '" data-f="ms"') + knopf(esc(t("gilde.abbrechen")), "abbrechen", "", 'data-f="ab"') + "</li>" : "") +
    (zurueck === s.v ? '<li class="gl-o-inline"><p>' + esc(t("gilde.on.staende.frage", {v: s.v, neu: neuste + 1})) + "</p>" + knopf(esc(t("gilde.on.staende.zurueck")), "zurueckJa", "hot", 'data-v="' + s.v + '" data-f="zj"') + knopf(esc(t("gilde.abbrechen")), "abbrechen", "", 'data-f="ab"') + "</li>" : "") +
    (ansicht === s.v ? '<li class="gl-o-inline"><p>' + esc(t("gilde.on.staende.ansicht", {v: s.v, zeit: zeitText(s.zeit * 1000), von: vonText(s.von), n: ansichtZahl.mitglieder, r: ansichtZahl.reihen})) + "</p>" + knopf(esc(t("gilde.on.schliessen")), "abbrechen", "", 'data-f="ab"') + "</li>" : "")).join("");
  return '<div class="gl-o-block"><p class="gl-o-hilfe">' + esc(t("gilde.on.staende.hilfe")) + "</p>" +
    (staende === null ? '<p class="gl-o-leer">' + esc(t("gilde.laden")) + "</p>" : '<ul class="gl-o-liste">' + z + "</ul>" +
      (rest ? '<div class="gl-o-aktionen">' + knopf(esc(t("gilde.on.staende.mehr", {n: rest})), "mehr", "", 'data-f="mehr"') + "</div>" : "") +
      (staendeGekuerzt && !rest ? '<p class="gl-o-hilfe" data-ol="gekuerzt">' + esc(t("gilde.on.staende.gekuerzt")) + "</p>" : "")) + "</div>";
}
let ansichtZahl = {mitglieder: 0, reihen: 0};
/* Sicherung */
function sicherungHtml(): string {
  return '<div class="gl-o-block"><p class="gl-o-hilfe">' + esc(t("gilde.on.sicherung.hilfe")) + "</p>" +
    '<div class="gl-o-aktionen">' + knopf(esc(t("gilde.on.sicherung.erstellen")), "sichern", "hot", 'data-f="sichern"') + knopf(esc(t("gilde.on.sicherung.wiederherstellen")), "datei", "", 'data-f="datei"') + "</div>" +
    '<input type="file" id="gildeODatei" accept=".json,application/json" hidden>' +
    (sicherung ? '<p class="gl-o-status">' + esc(t("gilde.on.sicherung.pfad", {pfad: sicherung})) + "</p>" : "") +
    (wiederher ? '<div class="gl-o-inline"><p>' + esc(t("gilde.on.sicherung.frage", {name: wiederher.name, n: wiederher.mitglieder.length})) + "</p>" + knopf(esc(t("gilde.on.sicherung.wiederherstellen")), "wiederherJa", "hot", 'data-f="wj2"') + knopf(esc(t("gilde.abbrechen")), "abbrechen", "", 'data-f="ab"') + "</div>" : "") + "</div>";
}
const abschnitt = (titel: string, html: string, id: string) => '<section class="gl-o-sek" aria-labelledby="' + id + '"><h3 id="' + id + '">' + esc(titel) + "</h3>" + html + "</section>";
const satzHtml = () => satz ? '<p class="gl-o-meldung" role="status">' + esc(satz) + "</p>" : "";

/* Einschalten: Erststart als Assistent in vier Schritten (Aufbau C), danach die Verwaltung (Aufbau A) */
const SCHRITTE = ["gilde.on.s1", "gilde.on.s2", "gilde.on.s3", "gilde.on.s4"];
const fortschritt = (n: number) => '<ol class="gl-o-schritte" aria-label="' + esc(t("gilde.on.schritte")) + '">' + SCHRITTE.map((k, i) =>
  "<li" + (i + 1 === n ? ' aria-current="step"' : "") + (i + 1 < n ? ' class="fertig"' : "") + "><b>" + (i + 1) + "</b><span>" + esc(t(k)) + "</span></li>").join("") + "</ol>";
function assistentHtml(): string {
  if(wz.weg === "beitreten") return '<h3 class="gl-o-ct">' + esc(t("gilde.on.beitreten.titel")) + "</h3>" + beitretenHtml() + '<div class="gl-o-aktionen">' + knopf(esc(t("gilde.on.zurueck")), "wegA", "", 'data-f="zur"') + "</div>";
  if(wz.schritt === 1) return fortschritt(1) + '<h3 class="gl-o-ct">' + esc(t("gilde.on.s1.titel")) + '</h3><div class="gl-o-optionen">' +
    '<button type="button" class="gl-o-option" data-ol="lokalBleibt" data-f="o1">' + IC.pc + "<b>" + esc(t("gilde.on.s1.pc")) + "</b><span>" + esc(t("gilde.on.s1.pcSatz")) + "</span></button>" +
    '<button type="button" class="gl-o-option" data-ol="weiter" data-f="o2">' + IC.wolke + "<b>" + esc(t("gilde.on.s1.server")) + "</b><span>" + esc(t("gilde.on.s1.serverSatz")) + "</span></button></div>" +
    '<p class="gl-o-hilfe">' + esc(t("gilde.on.s1.code")) + " " + knopf(esc(t("gilde.on.beitreten.titel")), "wegB", "", 'data-f="beitr"') + "</p>";
  if(wz.schritt === 2) return fortschritt(2) + '<h3 class="gl-o-ct">' + esc(t("gilde.on.s2.titel")) + '</h3><p class="gl-o-hilfe">' + esc(t("gilde.on.s2.hilfe")) + "</p>" +
    feld("gildeOAdr", t("gilde.on.adresse"), wz.adr, 'inputmode="url" placeholder="https://gilde.example.org"') + fehlerHtml() +
    '<div class="gl-o-aktionen">' + knopf(esc(t("gilde.on.zurueck")), "zurueckSchritt", "", 'data-f="zs"') + knopf(esc(t("gilde.on.weiter")), "pruefen", "hot", 'data-f="pw"') + "</div>";
  if(wz.schritt === 3){
    const l = lokaleGilde();
    return fortschritt(3) + '<h3 class="gl-o-ct">' + esc(t("gilde.on.s3.titel")) + '</h3><p class="gl-o-hilfe">' + esc(t("gilde.on.s3.server", {adr: wz.adr})) + "</p>" +
      feld("gildeOName", t("gilde.name"), wz.name || (l?.name ?? ""), 'maxlength="24"') + haken("gildeOHakenLead", satzLead(), wz.haken) + fehlerHtml() +
      '<div class="gl-o-optionen kurz"><button type="button" class="gl-o-option" data-ol="gruenden" data-f="g1"><b>' + esc(t("gilde.on.s3.neu")) + "</b><span>" + esc(t("gilde.on.s3.neuSatz")) + "</span></button>" +
      '<button type="button" class="gl-o-option" data-ol="hochladen" data-f="g2"' + (l ? "" : " disabled") + "><b>" + esc(t("gilde.on.s3.lokal")) + "</b><span>" +
      esc(l ? t("gilde.on.s3.lokalSatz", {n: l.mitglieder.filter(m => !m.geloest).length, r: l.reihen.filter(r => !r.geloest).length}) : t("gilde.on.s3.keine")) + "</span></button></div>" +
      '<div class="gl-o-aktionen">' + knopf(esc(t("gilde.on.zurueck")), "zurueckSchritt", "", 'data-f="zs"') + "</div>";
  }
  return fortschritt(4) + '<h3 class="gl-o-ct">' + esc(t("gilde.on.s4.titel")) + '</h3><p class="gl-o-hilfe">' + esc(t("gilde.on.s4.hilfe")) + "</p>" + (online() ? zugangHtml() : "") +
    '<div class="gl-o-aktionen">' + knopf(esc(t("gilde.on.fertig")), "fertig", "hot", 'data-f="fertig"') + "</div>";
}
function assistentFenster(): string {
  return '<div class="gl-o-schleier" data-ol="zu"></div><div class="gl-o-fenster" role="dialog" aria-modal="true" aria-labelledby="gildeOTitel"><header><h2 id="gildeOTitel">' + esc(t("gilde.on.titel")) + '</h2><button type="button" class="btn sm icon" data-ol="zu" aria-label="' + esc(t("gilde.on.schliessen")) + '" data-f="zu">' + IC.zu + "</button></header>" +
    satzHtml() + '<div class="gl-o-scroll">' + assistentHtml() + "</div></div>";
}
/* Lokal und online dasselbe Muster (Entwurf A vom 14.10.2026, #237): die Frage mit dem Namen der Gilde, dann der Satz auf der Seite oder in der Schublade */
const datumText = (d: string) => state.lang === "de" ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : d.slice(5, 7) + "/" + d.slice(8, 10) + "/" + d.slice(0, 4);
function loesenBlock(name: string, art: "loesen" | "beenden"): string {
  const hilfe = art === "loesen" ? t("gilde.loesen.hilfe", {name}) : t("gilde.beenden.hilfe");
  if(loesenFrage !== art) return '<div class="gl-o-block"><p class="gl-o-hilfe">' + esc(hilfe) + '</p><div class="gl-o-aktionen">' + knopf(esc(t(art === "loesen" ? "gilde.loesen.knopf" : "gilde.beenden.knopf")), art, "", 'data-f="' + art + '"') + "</div></div>";
  const passt = namenGleich(loesenName, name);
  return '<div class="gl-o-block"><p class="gl-o-hilfe">' + esc(hilfe) + '</p><div class="gl-frage gl-o-frage" role="group" aria-labelledby="gildeOFrage"><p id="gildeOFrage">' +
    esc(t(art === "loesen" ? "gilde.loesen.frage" : "gilde.beenden.frage", {name})) + "</p>" + feld("gildeOLoesenName", t("gilde.loesen.feld"), loesenName, 'data-f="loesenName" maxlength="24" aria-describedby="gildeOLoesenHinweis"') +
    '<p class="gl-o-hilfe" id="gildeOLoesenHinweis">' + esc(t("gilde.loesen.hinweis")) + '</p><div class="gl-o-aktionen">' +
    knopf(esc(t(art === "loesen" ? "gilde.loesen.ja" : "gilde.beenden.ja")), art + "Ja", "hot", 'data-f="' + art + 'Ja"' + (passt ? "" : " disabled")) +
    knopf(esc(t("gilde.loesen.nein")), art + "Nein", "", 'data-f="' + art + 'Nein"') + "</div></div></div>";
}
/** Die Frage zum endgueltigen Loeschen (wie beim Mitglied): Name eintippen, dann ist der Knopf frei. */
function loeschGFrage(name: string): string {
  return '<div class="gl-frage gl-o-frage" role="group" aria-labelledby="gildeOLQ"><p id="gildeOLQ">' + esc(t("gilde.loeschen.frage", {name})) + "</p>" +
    feld("gildeOLoeschName", t("gilde.loeschen.feld"), loeschGName, 'data-f="loeschGName" maxlength="24"') +
    '<div class="gl-o-aktionen">' + knopf(esc(t("gilde.loeschen.ja")), "loeschGJa", "hot", 'data-f="loeschGJa"' + (namenGleich(loeschGName, name) ? "" : " disabled")) +
    knopf(esc(t("gilde.loesen.nein")), "loeschGNein", "", 'data-f="loeschGNein"') + "</div></div>";
}
function geloesteHtml(): string {
  const liste = geloesteListe(), offen = !!lokalerName();
  if(!liste.length) return '<div class="gl-o-block"><p class="gl-o-hilfe">' + esc(t("gilde.gel.leer")) + "</p></div>";
  return '<div class="gl-o-block"><ul class="gl-o-liste">' + liste.map(e => '<li><span class="gl-name">' + esc(e.name) + "</span><small>" + esc(t("gilde.gel.zeile", {datum: datumText(e.am), n: e.mitglieder})) + "</small>" +
    '<button type="button" class="btn sm" data-ol="holen" data-id="' + e.id + '" data-f="holen:' + e.id + '" aria-label="' + esc(t("gilde.gel.holenAria", {name: e.name})) + '"' + (offen ? " disabled" : "") + ">" + esc(t("gilde.gel.holen")) + "</button>" +
    '<button type="button" class="btn sm" data-ol="loeschG" data-id="' + e.id + '" data-f="loeschG:' + e.id + '" aria-label="' + esc(t("gilde.loeschen.aria", {name: e.name})) + '">' + esc(t("gilde.loeschen.knopf")) + "</button>" +
    (loeschId === e.id ? loeschGFrage(e.name) : "") + "</li>").join("") +
    "</ul>" + (offen ? '<p class="gl-o-hilfe">' + esc(t("gilde.gel.erst")) + "</p>" : "") + '<p class="gl-o-hilfe">' + esc(t("gilde.gel.fuss")) + "</p></div>";
}
/** Die Frage zum endgueltigen Loeschen einer beendeten Gilde auf dem Server: mehr als beim Loesen, denn auch der Server verliert sie. */
function loeschBFrage(name: string): string {
  return '<div class="gl-frage gl-o-frage" role="group" aria-labelledby="gildeOLB"><p id="gildeOLB">' + esc(t("gilde.beendet.loeschenFrage", {name})) + "</p>" +
    feld("gildeOLoeschBName", t("gilde.loeschen.feld"), loeschBName, 'data-f="loeschBName" maxlength="24"') +
    '<div class="gl-o-aktionen">' + knopf(esc(t("gilde.loeschen.ja")), "loeschBJa", "hot", 'data-f="loeschBJa"' + (namenGleich(loeschBName, name) ? "" : " disabled")) +
    knopf(esc(t("gilde.loesen.nein")), "loeschBNein", "", 'data-f="loeschBNein"') + "</div></div>";
}
function beendeteHtml(): string {
  const liste = st?.beendete ?? [];
  if(!liste.length) return "";
  return abschnitt(t("gilde.beendet.sek"), '<div class="gl-o-block"><ul class="gl-o-liste">' + liste.map(e => '<li><span class="gl-name">' + esc(e.name) + "</span><small>" + esc(t("gilde.beendet.zeile", {datum: datumText(e.am), n: e.mitglieder})) + "</small>" +
    '<button type="button" class="btn sm" data-ol="oeffnen" data-code="' + esc(e.code) + '" data-f="oeffnen:' + esc(e.code) + '" aria-label="' + esc(t("gilde.beendet.oeffnenAria", {name: e.name})) + '"' + (online() ? " disabled" : "") + ">" + esc(t("gilde.beendet.oeffnen")) + "</button>" +
    '<button type="button" class="btn sm" data-ol="loeschB" data-code="' + esc(e.code) + '" data-f="loeschB:' + esc(e.code) + '" aria-label="' + esc(t("gilde.loeschen.aria", {name: e.name})) + '">' + esc(t("gilde.loeschen.knopf")) + "</button>" +
    (loeschCode === e.code ? loeschBFrage(e.name) : "") + "</li>").join("") +
    "</ul>" + (online() ? '<p class="gl-o-hilfe">' + esc(t("gilde.beendet.erst")) + "</p>" : "") + '<p class="gl-o-hilfe">' + esc(t("gilde.beendet.fuss")) + "</p></div>", "gildeOS6");
}
function schubladeRahmen(inhalt: string): string {
  return '<div class="gl-o-schleier" data-ol="zu"></div><aside class="gl-o-schublade" role="dialog" aria-modal="true" aria-labelledby="gildeOTitel"><header><div><h2 id="gildeOTitel">' + esc(t("gilde.on.titel")) + '</h2><p class="gl-o-status">' + esc(lang()) +
    '</p></div><button type="button" class="btn sm icon" data-ol="zu" aria-label="' + esc(t("gilde.on.schliessen")) + '" data-f="zu">' + IC.zu + "</button></header>" + satzHtml() + '<div class="gl-o-scroll">' + inhalt + "</div></aside>";
}
function lokalSchubladeHtml(): string {
  const name = lokalerName();
  return schubladeRahmen((name ? abschnitt(t("gilde.loesen.sek"), loesenBlock(name, "loesen"), "gildeOS0") : "") +
    abschnitt(t("gilde.on.sek.online"), '<div class="gl-o-block"><p class="gl-o-hilfe">' + esc(t("gilde.on.einrichten.hilfe")) + '</p><div class="gl-o-aktionen">' + knopf(esc(t("gilde.on.einrichten")), "einrichten", "", 'data-f="einrichten"') + "</div></div>", "gildeOS1") +
    beendeteHtml() + abschnitt(t("gilde.gel.sek"), geloesteHtml(), "gildeOS2"));
}
function leadDiese(): string {
  const g = istStand(st?.stand) ? st!.stand.gilde : null;
  if(!g) return "";
  if(st!.beendet) return abschnitt(t("gilde.loesen.sek"), '<div class="gl-o-block"><p class="gl-o-hilfe">' + esc(t("gilde.on.zeile.beendet")) + '</p><div class="gl-o-aktionen">' +
    knopf(esc(t("gilde.beendet.oeffnen")), "oeffnen", "hot", 'data-code="' + esc(st!.code ?? "") + '" data-f="oeffnen"') + "</div></div>", "gildeOS5");
  return abschnitt(t("gilde.loesen.sek"), loesenBlock(g.name, "beenden"), "gildeOS5");
}
function schubladeHtml(): string {
  if(!online()) return lokalSchubladeHtml();
  const r = rolle();
  const inhalt = r === "lead" ? abschnitt(t("gilde.on.sek.zugang"), zugangHtml(), "gildeOS1") + abschnitt(t("gilde.on.sek.bearbeiter"), linksHtml(), "gildeOS2") + abschnitt(t("gilde.on.sek.staende"), staendeHtml(), "gildeOS3") + abschnitt(t("gilde.on.sek.sicherung"), sicherungHtml(), "gildeOS4") + leadDiese() + beendeteHtml()
    : abschnitt(t("gilde.on.sek.zugang"), zugangHtml(), "gildeOS1") + abschnitt(t("gilde.on.sek.rolle"), '<div class="gl-o-block"><p class="gl-o-hilfe">' + esc(t(st!.entfernt ? "gilde.on.rolle.hilfe.entfernt" : st!.beendet ? "gilde.on.rolle.hilfe.beendet" : st!.widerrufen ? "gilde.on.rolle.hilfe.widerrufen" : "gilde.on.rolle.hilfe." + (r ?? "lesen"))) + "</p></div>", "gildeOS2");
  return schubladeRahmen(inhalt);
}

/* ---------- Zeichnen ---------- */
function zeichnen(){
  if(!bereit) return;
  const a = document.activeElement as HTMLElement | null;
  const huelleAlt = document.getElementById("gildeOnlineHuelle");
  const merk = a && huelleAlt?.contains(a) ? a.dataset?.f || a.id || "" : "";
  const werte: Record<string, string | boolean> = {};
  document.querySelectorAll<HTMLInputElement>("#gildeOnlineHuelle [data-oin]").forEach(i => { werte[i.id] = i.type === "checkbox" ? i.checked : i.value; });
  const chip = document.getElementById("gildeOnlineChip");
  if(chip){
    // nur bei einer Aenderung neu schreiben: sonst verliert der Chip bei jedem Abruf seinen Fokus
    const h = SERVED && st ? '<button type="button" class="gl-o-chip' + (online() ? " an" : "") + '" data-ol="chip" aria-haspopup="dialog" aria-expanded="' + (fenster !== "") + '" id="gildeOnlineChipKnopf">' + (online() ? IC.wolke : IC.pc) + "<span>" + esc(kurz()) + "</span>" + (online() && st.offline ? '<span class="gl-o-stern">' + MID + " " + esc(t("gilde.on.chip.offline")) + "</span>" : "") + "</button>" : "";
    if(chip.dataset.h !== h){ chip.dataset.h = h; chip.innerHTML = h; }
  }
  const zeile = document.getElementById("gildeOnlineZeile");
  if(zeile){
    const lesenSatz = online() && !schreibtDarf() ? (st!.entfernt ? t("gilde.on.zeile.entfernt") : st!.beendet ? t("gilde.on.zeile.beendet") : st!.widerrufen ? t("gilde.on.zeile.widerrufen") : st!.offline ? t("gilde.on.zeile.offline", {zeit: st!.standZeit ? zeitText(st!.standZeit) : ""}) : t("gilde.on.zeile.lesen")) : "";
    const h = (lesenSatz ? '<p class="gl-o-nurlesen">' + IC.schloss + "<span>" + esc(lesenSatz) + "</span></p>" : "") + (fehlerSatz ? '<p class="gl-o-nurlesen">' + IC.schloss + "<span>" + esc(fehlerSatz) + "</span></p>" : "");
    if(zeile.dataset.h !== h){ zeile.dataset.h = h; zeile.innerHTML = h; }
  }
  const dh = document.querySelector<HTMLElement>("#gildeDatenschutz span:last-child");
  if(dh){
    if(!dh.dataset.alt) dh.dataset.alt = dh.innerHTML;
    dh.innerHTML = online() ? t("gilde.on.datenschutz", {adr: esc(st!.adresse)}) : dh.dataset.alt;
  }
  const huelle = document.getElementById("gildeOnlineHuelle");
  if(!huelle) return;
  const war = huelle.innerHTML.length > 0;
  huelle.dataset.neu = war ? "" : "1";
  huelle.innerHTML = fenster === "schublade" ? schubladeHtml() : fenster === "assistent" ? assistentFenster() : "";
  huelle.hidden = fenster === "";
  document.querySelectorAll<HTMLInputElement>("#gildeOnlineHuelle [data-oin]").forEach(i => {
    if(!(i.id in werte)) return;
    if(i.type === "checkbox") i.checked = werte[i.id] as boolean; else if(document.activeElement !== i) i.value = werte[i.id] as string;
  });
  const ziel = fokus || merk;
  fokus = "";
  if(ziel){ const e = huelle.querySelector<HTMLElement>('[data-f="' + ziel + '"]') ?? document.getElementById(ziel); if(e && e !== document.activeElement) e.focus(); }
  else if(fenster !== "" && !huelle.contains(document.activeElement)) huelle.querySelector<HTMLElement>('[data-f="zu"]')?.focus();
}
function melde(text: string){ satz = text; zeichnen(); }

/* ---------- Handlungen ---------- */
async function fenstern(){
  if(fenster !== ""){ schliessen(); return; }
  loesenFrage = ""; loesenName = "";
  fenster = "schublade"; satz = "";
  zeichnen();
  if(fenster === "schublade" && rolle() === "lead") await listen();
}
function schliessen(zumChip = true){
  fenster = ""; loesenFrage = ""; loesenName = ""; loeschId = null; loeschGName = ""; loeschCode = null; loeschBName = ""; wz.neu = false; satz = ""; neuLink = null; staendeZahl = STAENDE_SEITE; widerruf = benennen = zurueck = ansicht = null; wiederher = null; sicherung = "";
  zeichnen();
  if(zumChip) document.getElementById("gildeOnlineChipKnopf")?.focus();
}
async function listen(){
  const [l, s] = await Promise.all([api("links", {}), api("staende", {})]);
  uebernehmen(l.status ?? s.status);
  links = Array.isArray(l.links) ? l.links as Link[] : [];
  staende = Array.isArray(s.staende) ? (s.staende as Stand[]).slice().sort((a, b) => b.v - a.v) : [];
  staendeGekuerzt = typeof s.gekuerzt === "number" && s.gekuerzt > staende.length;
  zeichnen();
}
function neuAnwenden(a: Antwort){
  uebernehmen(a.status);
  anwenden(true);
}
/** Nach einer Antwort des Servers: ein Satz, wenn etwas nicht ging; ja = es ging. */
function pruefAntwort(a: Antwort): boolean {
  uebernehmen(a.status);
  if(a.ok) return true;
  if(a.grund === "widerrufen" || a.grund === "rolle"){ anwenden(true); }
  satz = grundSatz(a.grund);
  zeichnen();
  return false;
}
async function gruenden(hochladen: boolean){
  const p = pruefeAdresse(wz.adr);
  wz.fehler = "";
  if(!p.ok){ wz.fehler = t("gilde.on.fehler.adresse." + p.grund); zeichnen(); return; }
  if(!wz.haken){ wz.fehler = t("gilde.on.fehler.haken.lead"); zeichnen(); return; }
  let g: Gilde;
  if(hochladen){
    const l = lokaleGilde();
    if(!l){ wz.fehler = t("gilde.on.s3.keine"); zeichnen(); return; }
    g = JSON.parse(JSON.stringify(l)) as Gilde;
  } else {
    const name = (wz.name || "").replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "").trim().slice(0, 24);
    if(!name){ wz.fehler = t("gilde.on.fehler.name"); zeichnen(); return; }
    g = {id: neueId("g"), name, mitglieder: [], reihen: [], anwesend: {}};
  }
  unterwegs = true;
  await einstellung(true, p.adresse);
  const a = await api("gruenden", {stand: {v: 1, gilde: g}, name: g.name});
  unterwegs = false;
  if(!a.ok){ await einstellung(false, p.adresse); wz.fehler = grundSatz(a.grund); uebernehmen(a.status); zeichnen(); return; }
  uebernehmen(a.status);
  wz.adr = p.adresse; wz.haken = false; wz.neu = true; wz.schritt = 4;
  anwenden(true);
  zeichnen();
}
async function beitreten(){
  wz.fehler = "";
  const e = parseEinladung(wz.einl), p = pruefeAdresse(wz.adr);
  if(!e){ wz.fehler = t("gilde.on.fehler.einladung"); zeichnen(); return; }
  if(!p.ok){ wz.fehler = t("gilde.on.fehler.adresse." + p.grund); zeichnen(); return; }
  if(!wz.haken){ wz.fehler = t("gilde.on.fehler.haken.mitglied"); zeichnen(); return; }
  unterwegs = true;
  await einstellung(true, p.adresse);
  const a = await api("beitreten", {code: e.code, ...(e.key ? {key: e.key} : {})});
  unterwegs = false;
  if(!a.ok){ await einstellung(false, p.adresse); wz.fehler = grundSatz(a.grund); uebernehmen(a.status); zeichnen(); return; }
  uebernehmen(a.status);
  anwenden(true);
  fenster = ""; wz.weg = ""; wz.haken = false;
  satz = "";
  zeichnen();
  document.getElementById("gildeOnlineChipKnopf")?.focus();
}
async function zurueckAufLokal(){
  const a = await api("verlassen", {});
  uebernehmen(a.status);
  if(a.ok) await einstellung(false, st?.adresse ?? "");
  const s = await api("status");
  if(s.status) st = s.status;
  fenster = ""; links = staende = null; neuLink = null;
  anwenden(true);
  fehlerSatz = "";
  zeichnen();
}
async function kopieren(was: string){
  const text = was === "code" ? st?.code ?? "" : was === "einladung" ? bauEinladung(st?.code ?? "") : neuLink?.einladung ?? "";
  try { await navigator.clipboard.writeText(text); melde(t("gilde.on.kopiert")); }
  catch { melde(t("gilde.on.kopiertNicht")); }
}
async function dateiLesen(f: File){
  satz = ""; wiederher = null;
  try {
    const d: unknown = JSON.parse(await f.text());
    if(isRec(d) && d.art === "gilde-sicherung" && istStand(d.stand)) wiederher = d.stand.gilde;
    else satz = t("gilde.on.sicherung.keine");
  } catch { satz = t("gilde.on.sicherung.keine"); }
  zeichnen();
}
async function aktion(el: HTMLElement, a: string){
  const nr = Number(el.dataset.v);
  switch(a){
    case "chip": await fenstern(); break;
    case "einrichten": wz = {schritt: 1, weg: "", adr: st?.adresse ?? "", einl: "", haken: false, name: "", fehler: "", neu: false}; fenster = "assistent"; satz = ""; zeichnen(); break;
    case "loesen": case "beenden": loesenFrage = a; loesenName = ""; fokus = "loesenName"; zeichnen(); break;
    case "loesenNein": case "beendenNein": { const wie = loesenFrage; loesenFrage = ""; loesenName = ""; fokus = wie; zeichnen(); break; }
    case "loesenJa": {
      const name = lokalerName();
      if(!name || !namenGleich(loesenName, name)) break;
      const e = gildeLoesen(loesenName);
      if(e === "voll"){ satz = t("gilde.loesen.voll"); zeichnen(); break; }
      if(e === "ok") schliessen(false);
      break;
    }
    case "loeschB": loeschCode = el.dataset.code ?? null; loeschBName = ""; fokus = "loeschBName"; zeichnen(); break;
    case "loeschBNein": { const c = loeschCode; loeschCode = null; loeschBName = ""; fokus = c ? "loeschB:" + c : ""; zeichnen(); break; }
    case "loeschBJa": {
      const e = st?.beendete?.find(x => x.code === loeschCode);
      if(!e || !namenGleich(loeschBName, e.name)) break;
      unterwegs = true;
      const r = await api("loeschen", {code: e.code});
      unterwegs = false;
      loeschCode = null; loeschBName = "";
      if(!pruefAntwort(r)) break;
      satz = t("gilde.loeschen.fertig", {name: e.name, datei: String(r.pfad ?? "").split(/[\\/]/).pop() ?? ""});
      zeichnen();
      break;
    }
    case "loeschG": loeschId = el.dataset.id ?? null; loeschGName = ""; fokus = "loeschGName"; zeichnen(); break;
    case "loeschGNein": { const id = loeschId; loeschId = null; loeschGName = ""; fokus = id ? "loeschG:" + id : ""; zeichnen(); break; }
    case "loeschGJa": {
      const e = geloesteListe().find(x => x.id === loeschId);
      if(!e || !namenGleich(loeschGName, e.name)) break;
      unterwegs = true;
      const r = await loeschenGeloest("gilde", e.id, loeschGName);
      unterwegs = false;
      loeschId = null; loeschGName = "";
      satz = r.ok ? t("gilde.loeschen.fertig", {name: e.name, datei: r.sicherung}) : t("gilde.loeschen.fehler." + (["name", "sicherung", "nicht-geloest", "unavailable"].includes(r.grund) ? r.grund : "abgelehnt"));
      zeichnen();
      break;
    }
    case "holen": {
      const e = gildeZurueckholen(el.dataset.id ?? "");
      if(e === "ok") schliessen();
      else if(e === "erst"){ satz = t("gilde.gel.erst"); zeichnen(); }
      break;
    }
    case "beendenJa": {
      const g = istStand(st?.stand) ? st!.stand.gilde : null;
      if(!g || !namenGleich(loesenName, g.name)) break;
      unterwegs = true;
      const r = await api("schliessen", {});
      unterwegs = false;
      if(!pruefAntwort(r)) break;
      loesenFrage = ""; loesenName = "";
      links = staende = null; neuLink = null;
      anwenden(true);
      satz = t("gilde.beenden.gemeldet", {name: g.name});
      zeichnen();
      break;
    }
    case "oeffnen": {
      const code = el.dataset.code ?? "";
      unterwegs = true;
      const r = await api("oeffnen", {code});
      unterwegs = false;
      if(!pruefAntwort(r)) break;
      anwenden(true);
      schliessen();
      break;
    }
    case "zu": schliessen(); break;
    case "wegB": wz.weg = "beitreten"; wz.haken = false; wz.fehler = ""; zeichnen(); break;
    case "wegA": wz.weg = ""; wz.fehler = ""; zeichnen(); break;
    case "weiter": wz.schritt = 2; zeichnen(); break;
    case "lokalBleibt": schliessen(); break;
    case "zurueckSchritt": wz.schritt = Math.max(1, wz.schritt - 1); wz.fehler = ""; zeichnen(); break;
    case "pruefen": {
      const p = pruefeAdresse(wz.adr);
      wz.fehler = p.ok ? "" : t("gilde.on.fehler.adresse." + p.grund);
      if(p.ok){ wz.adr = p.adresse; wz.schritt = 3; }
      zeichnen();
      break;
    }
    case "gruenden": await gruenden(false); break;
    case "hochladen": await gruenden(true); break;
    case "beitreten": await beitreten(); break;
    case "fertig": schliessen(); break;
    case "lokal": case "verlassen": await zurueckAufLokal(); break;
    case "kopieren": await kopieren(el.dataset.was || "code"); break;
    case "linkNeu": {
      const name = linkName.trim();
      if(!name){ melde(t("gilde.on.link.nameFehlt")); break; }
      const r = await api("link", {label: name});
      if(!pruefAntwort(r)) break;
      neuLink = {label: name, einladung: bauEinladung(String(r.code ?? st?.code ?? ""), String(r.schluessel ?? ""))};
      linkName = "";
      await listen();
      fokus = "kopLink";
      zeichnen();
      break;
    }
    case "linkFertig": neuLink = null; zeichnen(); break;
    case "mehr": staendeZahl += STAENDE_SEITE; zeichnen(); break;
    case "widerruf": widerruf = el.dataset.id ?? null; zeichnen(); break;
    case "widerrufJa": {
      const r = await api("link-widerruf", {id: el.dataset.id ?? ""});
      widerruf = null;
      if(pruefAntwort(r)){ satz = t("gilde.on.link.widerrufenSatz"); await listen(); }
      break;
    }
    case "ansehen": {
      if(ansicht === nr){ ansicht = null; zeichnen(); break; }
      const r = await api("stand-nr", {n: nr});
      if(!pruefAntwort(r)) break;
      ansicht = nr; benennen = zurueck = null;
      const g = istStand(r.stand) ? r.stand.gilde : null;
      ansichtZahl = {mitglieder: g ? g.mitglieder.filter(m => !m.geloest).length : 0, reihen: g ? g.reihen.filter(x => !x.geloest).length : 0};
      zeichnen();
      break;
    }
    case "benennen": benennen = nr; markenName = ""; ansicht = zurueck = null; zeichnen(); break;
    case "zurueck": zurueck = nr; ansicht = benennen = null; zeichnen(); break;
    case "abbrechen": ansicht = benennen = zurueck = widerruf = null; wiederher = null; zeichnen(); break;
    case "markeSpeichern": {
      const name = markenName.trim();
      if(!name) break;
      const r = await api("marke", {n: nr, label: name});
      benennen = null;
      if(pruefAntwort(r)){ satz = t("gilde.on.staende.markeSatz", {v: nr, name}); await listen(); }
      break;
    }
    case "zurueckJa": {
      const r = await api("zurueck", {n: nr});
      zurueck = null;
      if(pruefAntwort(r)){ neuAnwenden(r); satz = t("gilde.on.staende.zurueckSatz", {v: nr, neu: r.v as number}); await listen(); }
      break;
    }
    case "sichern": {
      const r = await api("sicherung", {});
      if(pruefAntwort(r)){ sicherung = String(r.pfad ?? ""); satz = t("gilde.on.sicherung.fertig"); zeichnen(); }
      break;
    }
    case "datei": document.getElementById("gildeODatei")?.click(); break;
    case "wiederherJa": {
      if(!wiederher) break;
      const r = await api("schreiben", {stand: {v: 1, gilde: wiederher}});
      wiederher = null;
      if(pruefAntwort(r)){ neuAnwenden(r); satz = t("gilde.on.sicherung.zurueck"); await listen(); }
      break;
    }
  }
}

/* ---------- Der Haken fuer 68-gilde.ts: schreiben ---------- */
async function schreiben(text: string): Promise<"ok" | "spaeter" | "fertig"> {
  let neu: Gilde;
  try { neu = (JSON.parse(text) as {gilde: Gilde}).gilde; } catch { return "fertig"; }
  const basis = onlineBasis();
  // dieselbe Regel wie in der Datei: ein Schreiben darf nichts verlieren, was der Stand schon hielt
  if(basis && !pruefeSchreiben(basis, neu).ok){
    fehlerSatz = t("gilde.on.fehler.fehlt");
    onlineAn(basis, !schreibtDarf());
    zeichnen();
    return "fertig";
  }
  const a = await api("schreiben", {stand: {v: 1, gilde: neu}});
  uebernehmen(a.status);
  if(a.ok){ if(st?.v !== undefined) angewendet = {v: st.v, lesen: false}; fehlerSatz = ""; zeichnen(); return "ok"; }
  fehlerSatz = a.grund === "veraltet" ? t("gilde.on.fehler.veraltet") : a.grund === "offline" ? t("gilde.on.fehler.offline") : grundSatz(a.grund);
  anwenden(true);
  zeichnen();
  return a.grund === "spaeter" ? "spaeter" : "fertig";
}

/* ---------- Start ---------- */
export function setup(): void {
  if(!SERVED) return;
  const kopf = document.getElementById("gildeKopf"), name = document.getElementById("gildeName"), status = document.getElementById("gildeStatus");
  if(!kopf || !name || !status) return;
  const chip = document.createElement("span");
  chip.id = "gildeOnlineChip";
  name.insertAdjacentElement("afterend", chip);
  const zeile = document.createElement("div");
  zeile.id = "gildeOnlineZeile";
  status.insertAdjacentElement("afterend", zeile);
  const huelle = document.createElement("div");
  huelle.id = "gildeOnlineHuelle"; huelle.hidden = true;
  document.body.appendChild(huelle);
  bereit = true;
  onlineHaken.schreiben = schreiben;
  onlineHaken.sichtbar = beimOeffnen;
  huelle.addEventListener("click", e => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-ol]");
    if(el && !el.hasAttribute("disabled")){ e.preventDefault(); void aktion(el, el.dataset.ol!); }
  });
  chip.addEventListener("click", e => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-ol]");
    if(el){ e.preventDefault(); void aktion(el, el.dataset.ol!); }
  });
  huelle.addEventListener("input", e => {
    const i = e.target as HTMLInputElement;
    if(!i.dataset?.oin) return;
    if(i.id === "gildeOAdr" || i.id === "gildeOAdr2") wz.adr = i.value;
    else if(i.id === "gildeOEinl") wz.einl = i.value;
    else if(i.id === "gildeOName") wz.name = i.value;
    else if(i.id === "gildeOLink") linkName = i.value;
    else if(i.id === "gildeOMarke") markenName = i.value;
    else if(i.id === "gildeOLoeschBName"){
      loeschBName = i.value;
      const e = st?.beendete?.find(x => x.code === loeschCode);
      const ja = huelle.querySelector<HTMLButtonElement>('[data-ol="loeschBJa"]');
      if(ja) ja.disabled = !e || !namenGleich(loeschBName, e.name);
    }
    else if(i.id === "gildeOLoeschName"){
      loeschGName = i.value;
      const e = geloesteListe().find(x => x.id === loeschId);
      const ja = huelle.querySelector<HTMLButtonElement>('[data-ol="loeschGJa"]');
      if(ja) ja.disabled = !e || !namenGleich(loeschGName, e.name);
    }
    else if(i.id === "gildeOLoesenName"){
      loesenName = i.value;
      const name = loesenFrage === "loesen" ? lokalerName() : istStand(st?.stand) ? st!.stand.gilde.name : null;
      const ja = huelle.querySelector<HTMLButtonElement>('[data-ol="loesenJa"], [data-ol="beendenJa"]');
      if(ja) ja.disabled = !name || !namenGleich(loesenName, name);
    }
    else if(i.type === "checkbox") wz.haken = i.checked;
  });
  huelle.addEventListener("change", e => {
    const i = e.target as HTMLInputElement;
    if(i.id === "gildeODatei" && i.files?.[0]){ void dateiLesen(i.files[0]); i.value = ""; }
    else if(i.type === "checkbox" && i.dataset?.oin) wz.haken = i.checked;
  });
  document.addEventListener("keydown", e => {
    if(fenster === "") return;
    if(e.key === "Escape"){ e.preventDefault(); schliessen(); return; }
    if(e.key === "Enter" && (e.target as HTMLElement).id === "gildeOLoeschBName"){
      e.preventDefault();
      const ja = huelle.querySelector<HTMLButtonElement>('[data-ol="loeschBJa"]');
      if(ja && !ja.disabled) ja.click();
      return;
    }
    if(e.key === "Enter" && (e.target as HTMLElement).id === "gildeOLoeschName"){
      e.preventDefault();
      const ja = huelle.querySelector<HTMLButtonElement>('[data-ol="loeschGJa"]');
      if(ja && !ja.disabled) ja.click();
      return;
    }
    if(e.key === "Enter" && (e.target as HTMLElement).id === "gildeOLoesenName"){
      e.preventDefault();
      const ja = huelle.querySelector<HTMLButtonElement>('[data-ol="loesenJa"], [data-ol="beendenJa"]');
      if(ja && !ja.disabled) ja.click();
      return;
    }
    if(e.key !== "Tab") return;
    const box = huelle.querySelector<HTMLElement>(".gl-o-schublade, .gl-o-fenster");
    if(!box) return;
    const fk = [...box.querySelectorAll<HTMLElement>("button, input, summary, [href]")].filter(x => !(x as HTMLButtonElement).disabled && x.offsetParent !== null);
    if(!fk.length) return;
    const a = fk.indexOf(document.activeElement as HTMLElement);
    if(e.shiftKey && a <= 0){ e.preventDefault(); fk[fk.length - 1]!.focus(); }
    else if(!e.shiftKey && a === fk.length - 1){ e.preventDefault(); fk[0]!.focus(); }
  }, true);
  // wer die Seite aus dem Hintergrund zurueckholt: der Chip zeigt, wo die Namen liegen, auch bevor die Gilde geoeffnet wird
  void statusLaden();
}
