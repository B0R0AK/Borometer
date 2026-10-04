import { state } from "./01-state";
import { fmt } from "./03-helpers";
import { histKey } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { weaponLabel, weaponMark } from "./09-weapon-icons";
import { esc } from "./18-interface-basics";
import { SERVED } from "./41-server-mode";
import { bauLoesen, bauNameVon, bauVon, paarStrich } from "./47-builds";
import { syncFelder } from "./58-felder";
import { gleicheWaffen, kartenFolge, kartenZahlen, linkMitBuild, looksLikeEintrag, parseLink, planId, PLAN_ID_RX, type KartenZahlen } from "../plan-core";
import { cleanName, linkOk, samePair } from "../build-core";
import type { Plan } from "../types";

/* ---------- Builds als Links zu Questlog (Aufgabe 12 der Neugestaltung) ----------
   Entscheidung 29.09.: die Ausruestung faellt weg; Builds ist ein Speicher fuer
   Questlog-Links, damit er schneller auf Questlog kommt, mit einer kleinen
   Uebersicht (Variante C). Oben ein Feld "Questlog-Link einfuegen", dazu ein
   Name (optional) und "Speichern"; je Link eine Karte mit Waffensymbolen,
   Name, Waffen und "zuletzt gespielt", "In Questlog oeffnen" und bis zu drei
   Bossen mit Median und Kampfzahl ueber dieselben Waffen aus dem
   Verlaufsverzeichnis (plan-core.ts, kartenZahlen). Die Karte mit den Waffen
   des offenen Kampfs steht oben, golden umrandet, mit Schild; im Kampf steht
   dann ein leiser Link "Build in Questlog".

   Beim Einfuegen fragt der Helfer Questlog einmal nach den Waffen
   (/api/plan/fetch, src/main/questlog.ts - nur auf Klick, die Grenzen dort);
   gespeichert wird in boro-plans.json ueber /api/plans nur Link, Zeitpunkt,
   Waffen und der eigene Name (eintrag unten, safety-audit.mjs prueft das).
   Questlogs Buildname lebt in state.planNames und nirgends sonst; alles
   andere, was der Abruf bringt, wird verworfen. Aeltere Plaene erscheinen
   als Karten; was sie sonst tragen (Steckbrief, Skills), bleibt unberuehrt
   in der Datei; derselbe Link noch einmal wird mit dem Eintrag
   zusammengefuehrt, nie ersetzt. Dazu je Build aus boro-builds.json mit Link
   ohne Eintrag eine Karte (Fixrunde 1). "Loesen" markiert einen Eintrag
   (geloest), nichts wird geloescht; "Rueckgaengig" holt ihn gleich zurueck,
   "Geloeste Builds zeigen" auch nach einem Neustart. Ein Link wird nie
   geladen, nur als Link angeboten; das Fenster gibt ihn an den Browser des
   Systems weiter (src/main/window.ts). Nichts hiervon geht ins Board, in ein
   Gruppen-Log oder in den Fehlerbericht. */

/** Was beim Einfuegen gerade laeuft: der Abruf, die Frage nach dem Build eines Charakters, ein Fehler. */
interface Lauf { phase: "busy" | "choose" | "error"; link: string; name: string; error?: string; choices?: {id: number; name: string}[] }
let lauf: Lauf | null = null;
/** Die Karte, die eben geloest wurde (ihr Schluessel): ihr Satz mit "Rueckgaengig" steht, bis etwas anderes geschieht. */
let geloestKey: string | null = null;
/** "Geloeste Builds zeigen": aufgeklappt oder nicht, in der Sitzung. */
let geloesteAuf = false;

/* ---------- Speicher: erst lesen, dann schreiben (wie 46-best-pull.ts) ----------
   roh haelt jeden Eintrag der Datei unter einer gueltigen Kennung, wie er
   ist - auch einen, der keine Karte traegt. Beim Erneuern wird mit ihm
   zusammengefuehrt, nie ersetzt (Fixrunde 1, Befund 3). Vor dem Lesen gibt
   es kein Speichern. */
const roh: Record<string, Record<string, unknown>> = Object.create(null);
let geladen = false, ladeTimer: ReturnType<typeof setTimeout> | null = null, ladeVersuch = 0;
function planLaden(){
  if(!SERVED || geladen || ladeTimer) return;
  fetch("/api/plans").then(r => r.ok ? r.json() : null).then((d: {ok?: unknown; plans?: unknown} | null) => {
    if(!d || d.ok !== true || !d.plans || typeof d.plans !== "object" || Array.isArray(d.plans)){ spaeter(); return; }
    ladeVersuch = 0;
    for(const [id, e] of Object.entries(d.plans as Record<string, unknown>)){
      if(!PLAN_ID_RX.test(id) || !e || typeof e !== "object" || Array.isArray(e)) continue;
      roh[id] = e as Record<string, unknown>;
      // was keine Karte tragen kann, bekommt keine - und bleibt in der Datei, wie es ist
      if(looksLikeEintrag(e) && !state.plans[id]) state.plans[id] = e;
    }
    geladen = true;
    if(lauf?.phase === "error" && lauf.error === "warte") lauf = null;
    renderBuilds();
    syncKampfQuestlog();
  }).catch(spaeter);
}
function spaeter(){
  if(ladeTimer) return;
  const warte = Math.min(60000, 5000 * 2 ** ladeVersuch++);
  ladeTimer = setTimeout(() => { ladeTimer = null; planLaden(); }, warte);
}
/* Ein Eintrag zum Helfer: "ok", "nie" (400 - die Datei ist voll oder die Form
   stimmt nicht) oder "spaeter" (503, kein Helfer). */
type Antwort = "ok" | "nie" | "spaeter";
function senden(id: string, plan: Plan): Promise<Antwort> {
  return fetch("/api/plans", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id, plan})})
    .then(r => r.ok ? "ok" : r.status === 400 ? "nie" : "spaeter", () => "spaeter");
}
/** Einen Eintrag, der schon in state.plans steht, schreiben (Loesen, Zurueckholen); 503 heisst spaeter noch
    einmal. Lehnt der Helfer ab (400), gilt wieder der Stand davor - Seite und Datei laufen nicht auseinander. */
function schreiben(id: string, davor: Plan){
  const plan = state.plans[id];
  if(!plan) return;
  void senden(id, plan).then(a => {
    if(a === "ok") roh[id] = plan;
    else if(a === "nie"){
      if(state.plans[id] === plan) state.plans[id] = davor;
      if(geloestKey === id) geloestKey = null;
      lauf = {phase: "error", link: "", name: "", error: "shape"};
      renderBuilds();
      syncKampfQuestlog();
    }
    else setTimeout(() => { if(state.plans[id] === plan) schreiben(id, davor); }, 5000);
  });
}

/* Die Grenze der Datei (src/main/plans.ts): ein neuer Eintrag ueber 100 wird
   abgelehnt, ein bekannter ueberschrieben. */
const MAX_PLAENE = 100;
const voll = (id: string) => !(id in roh) && !state.plans[id] && Object.keys(roh).length >= MAX_PLAENE;
/* Die Fehler, die es als Satz gibt; alles andere liest sich wie eine Antwort in fremder Form. */
const FEHLER = new Set(["link", "buildId", "timeout", "missing", "shape", "busy", "full", "name", "warte"]);
const fehlerCode = (c: unknown) => FEHLER.has(String(c)) ? String(c) : "shape";
/** Ein Eintrag aus der Zeit des Planers (vor Aufgabe 12): sein name ist Questlogs Buildname, nicht der eigene. */
const vomPlaner = (e: Record<string, unknown>) => Array.isArray(e.active) || typeof e.name !== "string" || e.name.length > 60;

/* ---------- Einfuegen ---------- */
async function einfuegen(link: string, nameRoh: string, pick: number | null){
  if(lauf?.phase === "busy") return;
  const eigen = cleanName(nameRoh);
  const info = parseLink(link);
  // was die Seite selbst sieht, sagt sie sofort - ohne Anfrage an den Helfer
  if(eigen == null){ lauf = {phase: "error", link, name: nameRoh, error: "name"}; return renderBuilds(); }
  if("why" in info){ lauf = {phase: "error", link, name: nameRoh, error: info.why}; return renderBuilds(); }
  // vor dem Lesen der Datei kein Abruf und kein Schreiben: sonst ersetzte er einen Eintrag, den die Seite noch nicht kennt
  if(!geladen){ lauf = {phase: "error", link, name: nameRoh, error: "warte"}; return renderBuilds(); }
  lauf = {phase: "busy", link, name: nameRoh};
  renderBuilds();
  let r: any;
  try {
    const res = await fetch("/api/plan/fetch", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({link, lang: state.lang, pick})});
    r = await res.json();
  } catch { r = {ok: false, error: "timeout"}; }
  const fehler = (error: string) => { lauf = {phase: "error", link, name: nameRoh, error}; renderBuilds(); };
  if(!r || r.ok !== true) return fehler(fehlerCode(r?.error));
  if(Array.isArray(r.choose)){
    const choices = r.choose.filter((c: any) => c && Number.isInteger(c.id)).slice(0, 40)
      .map((c: any) => ({id: c.id as number, name: typeof c.name === "string" ? c.name.slice(0, 60) : ""}));
    lauf = {phase: "choose", link, name: nameRoh, choices};
    renderBuilds();
    document.querySelector<HTMLInputElement>('#qlForm input[name="qlWahl"]:checked')?.focus();
    return;
  }
  const d = r.plan;
  // von allem, was der Abruf bringt, nimmt die Seite nur die Waffen, die Nummer des Builds und - fuer die Sitzung - seinen Namen
  if(!d || !Number.isInteger(d.buildId) || !Array.isArray(d.weapons) || d.weapons.length !== 2
     || !d.weapons.every((w: unknown) => typeof w === "string" && w.length <= 40)) return fehler("shape");
  const id = planId(info, d.buildId);
  /* ein gewaehlter Build kommt in den Link, damit Questlog ihn oeffnet - ebenso,
     wenn ein alter Link nur mit build-id einen Build nannte, den der Charakter nicht hat */
  const gemerkt = (pick != null && info.buildId == null) || (info.buildId != null && d.buildId !== info.buildId)
    ? linkMitBuild(link, d.buildId) || link : link;
  if(voll(id)) return fehler("full");
  // gespeichert wird genau das: Link, Zeitpunkt, Name (der eigene) und Waffen
  const eintrag: Plan = {link: gemerkt, at: Date.now(), name: eigen, weapons: [d.weapons[0], d.weapons[1]]};
  /* Derselbe Link noch einmal (Fixrunde 1, Befunde 3 und 5): zusammengefuehrt
     mit dem, was die Datei traegt - Link und Waffen werden erneuert, ein
     geloester kommt zurueck, alles andere bleibt. Den Namen setzt nur der
     Nutzer: ein neuer eigener ersetzt den alten; ohne ihn bleibt ein eigener
     stehen, und Questlogs Buildname eines alten Plans wird nicht wieder
     geschrieben. */
  const basis = roh[id] ?? state.plans[id];
  const neu: Plan = basis ? {...basis, link: eintrag.link, weapons: eintrag.weapons} as Plan : eintrag;
  if(basis){
    delete neu.geloest;
    if(!Number.isFinite(neu.at)) neu.at = eintrag.at;
    if(eigen) neu.name = eigen;
    else if(vomPlaner(basis)) neu.name = "";
  }
  const antwort = await senden(id, neu);
  if(antwort === "nie") return fehler(voll(id) ? "full" : "shape");
  if(antwort === "ok") roh[id] = neu;
  state.plans[id] = neu;
  if(typeof d.name === "string") state.planNames[id] = d.name.slice(0, 60);
  if(antwort === "spaeter") setTimeout(() => schreiben(id, neu), 5000);
  lauf = null;
  if(geloestKey === id) geloestKey = null;
  const feld = document.querySelector<HTMLInputElement>("#qlLink"), name = document.querySelector<HTMLInputElement>("#qlName");
  if(feld) feld.value = "";
  if(name) name.value = "";
  renderBuilds();
  syncKampfQuestlog();
  document.querySelector<HTMLElement>("#ql-" + id + " h3")?.focus();
}

/* ---------- die Karten ----------
   Eine Karte je Eintrag in boro-plans.json, dazu je Build aus
   boro-builds.json mit Link, zu dem es keinen Eintrag gibt (Entscheidung
   Fixrunde 1): frueher unter "Umbenennen oder Link" gesetzt, auch fremde
   Planer. Sein Name und seine Waffen kommen aus dem Build; geloest wird er
   ueber ein Feld am Build (47-builds.ts, bauLoesen). */
interface Karte { key: string; art: "plan" | "bau"; id: string; link: string; name: string; weapons: string[]; at: number; geloest: boolean; questlog: boolean }

/** Gehoert der Link eines Builds schon zu einem Eintrag (auch einem geloesten oder einem ohne Kartenform)? */
function bauGedeckt(bauId: string, link: string): boolean {
  const alle = [...Object.values(roh), ...Object.values(state.plans)];
  if(alle.some(p => p.bau === bauId || p.link === link)) return true;
  const info = parseLink(link);
  return !("why" in info) && info.buildId != null && (planId(info, info.buildId) in roh || !!state.plans[planId(info, info.buildId)]);
}
function alleKarten(): Karte[] {
  const raus: Karte[] = [];
  for(const id of Object.keys(state.plans)){
    const e = state.plans[id]!;
    raus.push({key: id, art: "plan", id, link: e.link, weapons: e.weapons, at: e.at, geloest: e.geloest !== undefined, questlog: true,
      name: e.name || state.planNames[id] || paarStrich(e.weapons) || t("ql.ohneWaffen")});
  }
  for(const id of Object.keys(state.builds)){
    const b = state.builds[id]!;
    if(!b.link || !linkOk(b.link) || bauGedeckt(id, b.link)) continue;
    raus.push({key: "b-" + id, art: "bau", id, link: b.link, weapons: [...b.weapons], at: b.first, geloest: b.geloest !== undefined,
      questlog: !("why" in parseLink(b.link)), name: bauNameVon(id)});
  }
  return raus;
}
const nachKey = (k: Karte[]) => Object.fromEntries(k.map(x => [x.key, x]));
/** Die Waffen des offenen Kampfs - nicht im Beispiel, das ist niemandes Kampf. */
function offeneWaffen(): string[] | null {
  if(state.origin === "sample") return null;
  const seg = state.encounters[state.sel];
  const fp = seg ? bauVon(seg) : null;
  return fp ? [...fp.weapons] : null;
}
/** "20.09." oder "20/09": der Tag auf der Uhr des Logs (UTC-Felder, wie Verlauf und bester Pull). */
function tagText(ms: number): string {
  const d = new Date(ms), zwei = (n: number) => String(n).padStart(2, "0");
  return state.lang === "de" ? zwei(d.getUTCDate()) + "." + zwei(d.getUTCMonth() + 1) + "." : zwei(d.getUTCDate()) + "/" + zwei(d.getUTCMonth() + 1);
}

function karteHtml(k: Karte, z: KartenZahlen, offen: boolean, gleich: string[], namen: Record<string, Karte>): string {
  const w = k.weapons.filter(Boolean).map(weaponLabel);
  const dom = "ql-" + k.key;
  const waffen = w.length === 2 ? t("bau.waffenUnd", {a: w[0]!, b: w[1]!}) : w.join(", ");
  // ohne bekannte Waffen keine Zahlen: der Satz, wie sie dazukommen
  const zeile = !w.length ? t("ql.unbekannt")
    : [waffen, z.letzter != null ? t("ql.zuletzt", {tag: tagText(z.letzter)}) : ""].filter(Boolean).join(" \u00b7 ");
  const bosse = !w.length ? "" : z.bosse.length
    ? '<ul class="qlbosse">' + z.bosse.map(b => '<li><span class="qlboss">' + esc(b.name) + "</span>" +
        (b.median != null ? ' <b class="num">' + esc(fmt(b.median)) + "</b>" : "") + " \u00b7 " + esc(t("ql.kaempfe", {n: b.n})) + "</li>").join("") + "</ul>"
    : '<p class="qlleer">' + esc(t("ql.leer")) + "</p>";
  const zwilling = gleich.length ? '<p class="qlgleich">' + esc(t("ql.gleich", {namen: gleich.map(o => t("bau.quoted", {name: namen[o]!.name})).join(", ")})) + "</p>" : "";
  // die Knoepfe tragen fuer den Vorleser den Namen der Karte (Fixrunde 1, Befund 10)
  const offnen = '<a class="btn sm qloffnen" href="' + esc(k.link) + '" target="_blank" rel="noopener noreferrer" title="' + esc(t("bau.openTitle")) + '"' +
    ' aria-label="' + esc(t(k.questlog ? "ql.openName" : "ql.openFremdName", {name: k.name})) + '">' + esc(t(k.questlog ? "ql.open" : "ql.openFremd")) + "</a>";
  const knopf = !SERVED ? "" : k.geloest
    ? '<button class="btn sm" type="button" data-ql-zurueck="' + k.key + '" aria-label="' + esc(t("ql.zurueckName", {name: k.name})) + '">' + esc(t("ql.zurueck")) + "</button>"
    : '<button class="leise" type="button" data-ql-los="' + k.key + '" aria-label="' + esc(t("ql.losName", {name: k.name})) + '">' + esc(t("ql.los")) + "</button>";
  return '<article class="qlkarte' + (offen ? " offen" : "") + (k.geloest ? " geloest" : "") + '" id="' + dom + '" aria-labelledby="qlH-' + k.key + '">' +
    '<div class="qlkopf"><span class="qlpaar" role="img" aria-label="' + esc(w.join(" + ") || t("ql.ohneWaffen")) + '">' +
      k.weapons.filter(Boolean).map(weaponMark).join("") + "</span>" +
      '<h3 id="qlH-' + k.key + '" tabindex="-1">' + esc(k.name) + "</h3>" +
      (offen ? '<span class="qlschild">' + esc(t("ql.offen")) + "</span>" : "") + "</div>" +
    '<p class="qlzeile">' + esc(zeile) + "</p>" + zwilling + bosse +
    /* Ein Link, kein Knopf: das Fenster schickt ihn an den Browser des Systems (window.ts). */
    '<div class="qlakt">' + offnen + knopf + "</div></article>";
}

function kartenHtml(): string {
  const alle = alleKarten(), namen = nachKey(alle);
  const sicht = nachKey(alle.filter(k => !k.geloest)), weg = alle.filter(k => k.geloest);
  const offen = offeneWaffen();
  const zahlen = new Map(alle.map(k => [k.key, kartenZahlen(k.weapons, state.hist.fights, state.builds, histKey)]));
  const gleich = gleicheWaffen(sicht);
  const folge = kartenFolge(sicht, offen, key => zahlen.get(key)!.letzter);
  const g = geloestKey && namen[geloestKey]?.geloest
    ? '<p class="qlgeloest" role="status">' + esc(t("ql.geloest", {name: namen[geloestKey]!.name})) +
      ' <button class="btn sm" type="button" data-ql-undo="' + geloestKey + '">' + esc(t("plan.undo")) + "</button></p>" : "";
  const karten = folge.length ? '<div class="qlkarten">' + folge.map(key =>
    karteHtml(sicht[key]!, zahlen.get(key)!, !!offen && offen.some(Boolean) && samePair(sicht[key]!.weapons, offen), gleich[key] || [], namen)).join("") + "</div>"
    : '<p class="qlnoch">' + esc(t(SERVED ? "ql.noch" : "ql.appOnly")) + "</p>";
  /* Geloeste Builds (Entscheidung Fixrunde 1): ein leiser Umschalter, aufgeklappt
     je Karte "Zurueckholen" - auch nach einem Neustart, das Feld geloest
     steht im Eintrag. */
  const aus = !weg.length ? "" : '<p class="qlauswahl"><button class="leise" type="button" data-ql-zeige aria-expanded="' + geloesteAuf + '"' +
      (geloesteAuf ? ' aria-controls="qlGeloeste"' : "") + ">" + esc(t(geloesteAuf ? "ql.verbergen" : "ql.zeigen", {n: weg.length})) + "</button></p>" +
    (geloesteAuf ? '<div class="qlkarten qlaus" id="qlGeloeste">' + weg.sort((a, b) => b.at - a.at)
      .map(k => karteHtml(k, zahlen.get(k.key)!, false, [], namen)).join("") + "</div>" : "");
  return g + karten + aus;
}

function laufHtml(): string {
  if(!lauf) return "";
  if(lauf.phase === "busy") return "";
  if(lauf.phase === "choose") return '<fieldset class="qlwahl"><legend>' + esc(t("ql.choose")) + "</legend>" +
    lauf.choices!.map((c, i) => '<label><input type="radio" name="qlWahl" value="' + c.id + '"' + (i ? "" : " checked") + "> " + esc(c.name || String(c.id)) + "</label>").join("") +
    '<span class="qlzeile2"><button class="btn sm" type="submit" data-ql-wahl>' + esc(t("ql.chooseBtn")) + '</button> <button class="btn sm" type="button" data-ql-abbrechen>' +
    esc(t("ql.cancel")) + "</button></span></fieldset>";
  return "";
}
function statusText(): string {
  if(!lauf) return "";
  if(lauf.phase === "busy") return t("ql.busy");
  if(lauf.phase === "error") return t(lauf.error === "name" ? "bau.nameBad" : lauf.error === "warte" ? "ql.warte" : "ql.err." + fehlerCode(lauf.error));
  return "";
}

/* ---------- Zeichnen ----------
   Das Feld steht einmal da und wird nie neu gebaut - wer tippt, verliert
   nichts, auch wenn der Livelog alle zwei Sekunden neu zeichnet. Neu gebaut
   werden nur die Karten, und nur, wenn sich an ihnen etwas geaendert hat. */
function gerippe(box: HTMLElement){
  box.innerHTML = '<form class="qlform" id="qlForm" novalidate>' +
    '<span class="field qlfeld"><label for="qlLink"></label><input id="qlLink" type="url" inputmode="url" autocomplete="off" spellcheck="false"' +
      ' placeholder="https://questlog.gg/throne-and-liberty/\u2026" aria-describedby="qlHinweis qlStatus"></span>' +
    '<span class="field qlname"><label for="qlName"></label><input id="qlName" maxlength="40" autocomplete="off" spellcheck="false"></span>' +
    '<button class="btn" type="submit" id="qlSpeichern"></button>' +
    '<p class="qlhinweis" id="qlHinweis"></p><p class="qlstatus" id="qlStatus" role="status"></p><div id="qlLauf"></div></form>' +
    '<div id="qlKarten"></div>';
  const f = box.querySelector<HTMLFormElement>("#qlForm")!;
  f.onsubmit = e => {
    e.preventDefault();
    const link = box.querySelector<HTMLInputElement>("#qlLink")!.value.trim();
    const name = box.querySelector<HTMLInputElement>("#qlName")!.value;
    const wahl = lauf?.phase === "choose" ? box.querySelector<HTMLInputElement>('input[name="qlWahl"]:checked') : null;
    if(wahl && lauf) void einfuegen(lauf.link, lauf.name, Number(wahl.value));
    else void einfuegen(link, name, null);
  };
  f.onclick = e => {
    const k = (e.target as HTMLElement).closest<HTMLElement>("[data-ql-abbrechen]");
    if(!k) return;
    lauf = null;
    renderBuilds();
    box.querySelector<HTMLElement>("#qlLink")?.focus();
  };
  // Esc schliesst die Frage nach dem Build; der Fokus geht zurueck ins Feld
  f.onkeydown = e => {
    if(e.key !== "Escape" || lauf?.phase !== "choose") return;
    e.preventDefault();
    lauf = null;
    renderBuilds();
    box.querySelector<HTMLElement>("#qlLink")?.focus();
  };
  box.querySelector<HTMLElement>("#qlKarten")!.onclick = e => {
    const ziel = e.target as HTMLElement;
    const los = ziel.closest<HTMLElement>("[data-ql-los]"), undo = ziel.closest<HTMLElement>("[data-ql-undo]");
    const hol = ziel.closest<HTMLElement>("[data-ql-zurueck]"), zeige = ziel.closest<HTMLElement>("[data-ql-zeige]");
    if(los) loesen(los.dataset.qlLos!);
    else if(undo) zurueck(undo.dataset.qlUndo!);
    else if(hol) zurueck(hol.dataset.qlZurueck!);
    else if(zeige){
      geloesteAuf = !geloesteAuf;
      renderBuilds();
      box.querySelector<HTMLElement>("[data-ql-zeige]")?.focus();
    }
  };
}
const setzen = (el: HTMLElement | null, text: string) => { if(el && el.textContent !== text) el.textContent = text; };

/** Den Bereich Builds zeichnen (switchTab, renderHistory, nach dem Laden und jedem Schritt hier). */
export function renderBuilds(){
  const box = document.querySelector<HTMLElement>("#bauBody");
  if(!box) return;
  if(!box.querySelector("#qlForm")) gerippe(box);
  const form = box.querySelector<HTMLFormElement>("#qlForm")!;
  // ohne den Helfer (im Browser ohne App) gibt es keinen Abruf: nur der Satz dazu
  form.hidden = !SERVED;
  setzen(box.querySelector('label[for="qlLink"]'), t("ql.linkLabel"));
  setzen(box.querySelector('label[for="qlName"]'), t("ql.nameLabel"));
  setzen(box.querySelector("#qlSpeichern"), t("ql.save"));
  setzen(box.querySelector("#qlHinweis"), t("ql.hint"));
  setzen(box.querySelector("#qlStatus"), statusText());
  const busy = lauf?.phase === "busy";
  form.setAttribute("aria-busy", String(busy));
  box.querySelector<HTMLButtonElement>("#qlSpeichern")!.disabled = busy;
  const l = box.querySelector<HTMLElement>("#qlLauf")!, lh = laufHtml();
  if(l.dataset.marke !== lh){ l.innerHTML = lh; l.dataset.marke = lh; }
  const k = box.querySelector<HTMLElement>("#qlKarten")!, kh = kartenHtml();
  if(k.dataset.marke !== kh){ k.innerHTML = kh; k.dataset.marke = kh; }
  // die Kopfzeile nennt die Zahl der Builds (58-felder.ts, buildsKontext)
  if(state.tab === "builds") syncFelder();
}

/* ---------- Loesen und Zurueckholen: nie endgueltig ---------- */
function loesen(key: string){
  if(key.startsWith("b-")){
    if(!bauLoesen(key.slice(2), true)){ lauf = {phase: "error", link: "", name: "", error: "shape"}; return renderBuilds(); }
  } else {
    const alt = state.plans[key];
    if(!alt) return;
    state.plans[key] = {...alt, geloest: Date.now()};
    schreiben(key, alt);
  }
  geloestKey = key;
  renderBuilds();
  syncKampfQuestlog();
  // die Karte ist weg: der Fokus geht auf "Rueckgaengig"
  document.querySelector<HTMLElement>('#bauBody [data-ql-undo="' + key + '"]')?.focus();
}
function zurueck(key: string){
  geloestKey = null;
  if(key.startsWith("b-")){
    if(!bauLoesen(key.slice(2), false)) lauf = {phase: "error", link: "", name: "", error: "shape"};
  } else {
    const alt = state.plans[key];
    if(alt && alt.geloest !== undefined){
      const neu: Plan = {...alt};
      delete neu.geloest;
      state.plans[key] = neu;
      schreiben(key, alt);
    }
  }
  renderBuilds();
  syncKampfQuestlog();
  // die Ueberschrift der Karte, sonst das Feld oben - nie body
  (document.querySelector<HTMLElement>("#ql-" + key + " h3") || document.querySelector<HTMLElement>("#qlLink"))?.focus();
}

/** Was die Kopfzeile im Bereich Builds nennt (58-felder.ts): "4 Builds \u00b7 Links zu Questlog". */
export function buildsKontext(): string {
  const n = alleKarten().filter(k => !k.geloest).length;
  return n ? t("ql.ctx", {n}) : t("ql.ctxLeer");
}

/* ---------- im Kampf: "Build in Questlog" ----------
   Ein leiser Link neben den Knoepfen des Urteils (index.html, #kampfQuestlog),
   wenn eine Karte mit Questlog-Link die Waffen des offenen Kampfs hat - bei
   mehreren die zuletzt gespeicherte. Sonst verborgen. */
export function syncKampfQuestlog(){
  const a = document.querySelector<HTMLAnchorElement>("#kampfQuestlog");
  if(!a) return;
  const offen = offeneWaffen();
  const passt = offen && offen.some(Boolean)
    ? alleKarten().filter(k => !k.geloest && k.questlog && samePair(k.weapons, offen)).sort((x, y) => y.at - x.at)[0] : undefined;
  a.hidden = !passt;
  if(!passt) return;
  if(a.getAttribute("href") !== passt.link) a.setAttribute("href", passt.link);
  setzen(a, t("ql.kampfLink"));
  a.setAttribute("aria-label", t("ql.kampfName", {name: passt.name}));
  a.title = t("bau.openTitle");
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  planLaden();
}
