import { state } from "./01-state";
import { dur, fmt, toastFail } from "./03-helpers";
import { dungeonName } from "./06-blocks-and-places";
import { t, tt } from "./08-translation";
import { bossMark } from "./12-boss-images";
import { $, esc, wallTime } from "./18-interface-basics";
import { darfEntfernen } from "./19-grouping-and-party-fights";
import { kampfEntfernen, renderFights } from "./30-fight-list";
import { loadText, renderAll, setLoadOrigin } from "./32-history";
import { schliesseAndereKopffenster } from "./34-menus-drop-and-tabs";
import { liveFortsetzen, livePausieren, SERVED } from "./41-server-mode";
import { isWatching, syncLiveBtn } from "./45-startup";
import { berlinTag, logTage, tagTeile, type LogTag } from "../verlauf-core";

/* ---------- Die Kampfwahl (Instrumententafel 3.2) ----------
   Die Kampfliste lag als Schiene links neben dem Kampf und nahm ihm 252
   Punkt. Jetzt ist sie ein Aufklappfeld unter der Titelleiste: der Knopf in
   deren Mitte nennt den Kampf, den man ansieht, ein Klick oder Strg+K
   oeffnet das Feld. Nicht modal: ein Klick daneben schliesst es, Esc auch,
   und der Fokus geht an den Knopf zurueck.

   Der Fokus bleibt im Suchfeld (role="combobox"), die Liste ist eine
   listbox, und welcher Eintrag angewaehlt ist, sagt aria-activedescendant.
   Wie in der Schiene: Pfeile auf und ab, Pos1 und Ende, rechts klappt eine
   geschlossene Gruppe auf, links zu oder zur Ueberschrift - aber nur, solange
   nichts gesucht wird; sonst bewegen die Pfeile den Cursor im Suchtext. Der
   Tippsprung der Schiene ist jetzt die Suche selbst.

   renderFights() (30) baut die Liste wie bisher. Dieses Teil filtert sie
   danach, markiert den angewaehlten Eintrag und schreibt dabei nur, was sich
   aendert: ein Live-Takt ohne neuen Kampf fasst die Liste nicht an, und bei
   geschlossenem Feld tut kwNachRender() gar nichts. */

const suchfeld = () => $<HTMLInputElement>("#kwSuche");
export function kampfwahlOffen(){ return !$("#kampfwahl").hidden; }
/** Wird gesucht? Dann gelten Klappen und Trash-Gruppen nicht (30-fight-list.ts). */
export function kwSucheAktiv(){ return suchfeld().value.trim() !== ""; }
const woerter = () => suchfeld().value.toLowerCase().split(/\s+/).filter(Boolean);

/* Die Eintraege, durch die die Pfeile gehen, in der Reihenfolge der Liste:
   Blockkopf, seine Kaempfe, dazwischen die Trash-Gruppen. Beim Suchen nur
   Kaempfe - geklappt wird dann nicht. */
function eintraege(): HTMLElement[] {
  const box = document.getElementById("fightList");
  if(!box) return [];
  const sel = kwSucheAktiv() ? ".fight" : ".blockfold, .trashhead, .fight";
  return [...box.querySelectorAll<HTMLElement>(sel)].filter(e => !e.closest("[hidden]"));
}

/* Der angewaehlte Eintrag, gemerkt an seiner id: nach einem Neubau der Liste
   steht dieselbe id an einem neuen Knoten. */
let aktivId = "";
function setzeAktiv(ziel: HTMLElement | null | undefined){
  const feld = suchfeld();
  const alt = aktivId ? document.getElementById(aktivId) : null;
  if(alt && alt !== ziel) alt.classList.remove("aktiv");
  if(!ziel){
    aktivId = "";
    if(feld.hasAttribute("aria-activedescendant")) feld.removeAttribute("aria-activedescendant");
    return;
  }
  if(!ziel.classList.contains("aktiv")) ziel.classList.add("aktiv");
  aktivId = ziel.id;
  if(feld.getAttribute("aria-activedescendant") !== ziel.id) feld.setAttribute("aria-activedescendant", ziel.id);
  kwZeigen(ziel);
}
/* Eine Zeile ganz in den Blick rollen - und nicht hinter den klebenden Kopf
   ihrer Gruppe (Feinschliff 02.10., Abschnitt 5): scrollIntoView mit
   "nearest" kennt den haftenden Kopf nicht und liess die gewaehlte Zeile beim
   Oeffnen unter ihm stehen. Ein Klappkopf selbst ist der Kopf. */
export function kwZeigen(ziel: HTMLElement){
  const liste = document.getElementById("kwListe");
  if(!liste || !ziel.getClientRects().length) return;
  const lr = liste.getBoundingClientRect(), r = ziel.getBoundingClientRect();
  const kopf = ziel.closest(".blockhead") ? null : ziel.closest(".blockgroup")?.querySelector<HTMLElement>(".blockhead");
  const oben = lr.top + (kopf ? kopf.getBoundingClientRect().height : 0);
  let soll = liste.scrollTop;
  if(r.top < oben) soll -= oben - r.top;
  else if(r.bottom > lr.bottom) soll += Math.min(r.bottom - lr.bottom, r.top - oben);
  else return;
  /* Die Liste rastet an Zeilen (scroll-snap, styles.css): eine Lage zwischen
     zwei Rasten nimmt der Browser zurueck, und die Zeile stand wieder halb
     draussen. Gerollt wird darum zur ersten Raste ab dem Soll - sie zeigt
     die Zeile ganz, spaetestens ihre eigene. */
  const pad = parseFloat(getComputedStyle(liste).scrollPaddingTop) || 0;
  const rasten = [...liste.querySelectorAll<HTMLElement>(".fight")].filter(f => f.getClientRects().length)
    .map(f => f.getBoundingClientRect().top - lr.top + liste.scrollTop - pad).filter(x => x >= soll - 0.5);
  liste.scrollTop = rasten.length ? Math.min(...rasten) : soll;
}
/* Die Ueberschrift ueber einem Eintrag: rueckwaerts bis zum ersten Klappkopf. */
function kopfUeber(alle: HTMLElement[], i: number){
  for(let k = i - 1; k >= 0; k--) if(alle[k]!.matches(".blockfold, .trashhead")) return alle[k];
  return null;
}

/* Die Suche: jedes Wort muss im Namen der Zeile (aria-label: Boss, DPS,
   Uhrzeit, Dauer, Schaden) oder im Kopf ihres Laufs (Ort, Rubrik) stehen.
   Verborgen wird die Huelle der Zeile; ein Lauf ohne Treffer faellt ganz
   weg. Ohne Suche ist nichts verborgen - dann schreibt diese Funktion auf
   einer frisch gebauten Liste nichts. */
let statusZuletzt = "";
function kwFiltern(){
  const box = document.getElementById("fightList");
  if(!box) return;
  const w = woerter();
  let n = 0;
  box.querySelectorAll<HTMLElement>(".fight").forEach(f => {
    const lauf = f.closest(".blockgroup")?.querySelector(".blockhead")?.textContent || "";
    const heu = ((f.getAttribute("aria-label") || "") + " " + lauf).toLowerCase();
    const passt = w.every(x => heu.includes(x));
    const reihe = f.closest<HTMLElement>(".fightrow") || f;
    if(reihe.hidden === passt) reihe.hidden = !passt;
    if(passt) n++;
  });
  box.querySelectorAll<HTMLElement>(".trashhead").forEach(h => {
    const aus = w.length > 0;
    if(h.hidden !== aus) h.hidden = aus;
  });
  box.querySelectorAll<HTMLElement>(".blockgroup").forEach(g => {
    const aus = w.length > 0 && !g.querySelector(".fightrow:not([hidden])");
    if(g.hidden !== aus) g.hidden = aus;
  });
  const keiner = w.length > 0 && n === 0;
  const satz = $("#kwKeinTreffer");
  if(satz.hidden === keiner) satz.hidden = !keiner;
  if(keiner) satz.textContent = t("kw.noMatch", {q: suchfeld().value.trim()});
  const ansage = w.length ? t("kw.treffer", {n}) : "";
  if(ansage !== statusZuletzt){ statusZuletzt = ansage; $("#kwStatus").textContent = ansage; }
}

/** Nach jedem Neubau der Liste (renderFights): filtern und die Anwahl halten. */
export function kwNachRender(){
  if(!kampfwahlOffen()) return;
  kwFiltern();
  const alle = eintraege();
  setzeAktiv(alle.find(e => e.id === aktivId) || alle.find(e => e.classList.contains("on")) || alle[0]);
}

export function kampfwahlOeffnen(){
  // im Kompaktstreifen gibt es keine Kampfwahl (Spezifikation 2)
  if(document.body.classList.contains("compact")) return;
  const feldBox = $("#kampfwahl");
  if(feldBox.hidden){
    schliesseAndereKopffenster("kampf");
    feldBox.hidden = false;
    $("#kwKnopf").setAttribute("aria-expanded", "true");
    aktivId = "";
    syncKwLaeufe();
    kwNachRender();
    void tageHolen();   // die Tage frisch aus dem Log-Ordner (nur in der App)
  }
  const feld = suchfeld();
  feld.focus({preventScroll: true});
  feld.select();
}
let suchteZuletzt = false;
export function kampfwahlSchliessen(fokusZurueck: boolean){
  const feldBox = $("#kampfwahl");
  if(feldBox.hidden) return;
  feldBox.hidden = true;
  $("#kwKnopf").setAttribute("aria-expanded", "false");
  setzeAktiv(null);
  const feld = suchfeld();
  if(feld.value){
    feld.value = "";
    suchteZuletzt = false;
    renderFights();   // ohne Suche gelten Klappen und Trash-Gruppen wieder
    kwFiltern();      // und keine Zeile bleibt verborgen
  }
  if(fokusZurueck) $("#kwKnopf").focus({preventScroll: true});
}

/* Der Knopf in der Titelleiste - seit der Neugestaltung (28.09., Luecke
   0.4) eine Pille wie im Entwurf, so breit wie ihr Inhalt: Bossbild, Boss,
   "21:14 \u00b7 1m 0s", DPS in Gold, "Strg K", der Pfeil. Der Lauf steht nur
   noch im Namen fuer den Vorleser, mit der ganzen Uhrzeit. Geschrieben wird
   nur, wenn sich etwas aendert - renderAll() laeuft im Live alle paar
   Sekunden. */
let knopfZuletzt = "";
export function syncKwKnopf(){
  neuerKampfPruefen();
  const seg = state.encounters[state.sel];
  let inhalt: string, name: string;
  if(!seg){
    inhalt = esc(t("kw.choose"));
    name = t("kw.choose");
  } else {
    const s = seg.stats, b = seg.block;
    /* Ein Feldboss ist sein eigener Lauf ("Ramux" im Block "Ramux"): dann
       stuende der Name zweimal da. Die Liste behaelt ihren Blockkopf. */
    const ort = b ? (dungeonName(b.dungeon) || dungeonName(b.open) || "") : "";
    const lauf = ort.toLocaleLowerCase() === String(s.name).toLocaleLowerCase() ? "" : ort;
    const zeit = state.wall ? wallTime(seg.start) : "";
    const dps = state.noTime ? "" : fmt(s.dps);
    const meta = [zeit.slice(0, 5), state.noTime ? "" : dur(s.seconds)].filter(Boolean).join(" \u00b7 ");
    inhalt = bossMark(s.name, "kwbild") + "<b>" + esc(s.name) + "</b>" +
      (meta ? '<span class="kwmeta num">' + esc(meta) + "</span>" : "") +
      (dps ? '<span class="kwdps num">' + esc(dps) + "</span>" : "") +
      '<kbd class="kwkbd" aria-hidden="true">' + esc(t("kw.kbd")) + "</kbd>";
    name = t("kw.knopfName", {was: [s.name, lauf, zeit, dps ? dps + " " + t("bars.dps") : ""].filter(Boolean).join(", ")});
  }
  // voriger und naechster Kampf (0.5): die Liste steht neueste zuerst
  const n = state.encounters.length;
  const vor = $<HTMLButtonElement>("#kwVor"), nach = $<HTMLButtonElement>("#kwNach");
  const vorAus = !seg || state.sel >= n - 1, nachAus = !seg || state.sel <= 0;
  if(vor.disabled !== vorAus) vor.disabled = vorAus;
  if(nach.disabled !== nachAus) nach.disabled = nachAus;
  const sig = state.lang + "|" + inhalt + "|" + name;
  if(sig === knopfZuletzt) return;
  knopfZuletzt = sig;
  const was = $("#kwWas");
  was.innerHTML = inhalt;
  $("#kwKnopf").setAttribute("aria-label", name);
  if(pilleGleiten){
    pilleGleiten = false;
    if(!matchMedia("(prefers-reduced-motion: reduce)").matches){
      was.classList.remove("wechsel"); void was.offsetWidth; was.classList.add("wechsel");
    }
  }
}

/* Einen Kampf waehlen, wie ein Klick in der Liste: Start, Einstellungen und
   Weeklies verlassen, zeichnen. Die Ungelesen-Pille geht weg - man hat
   gewaehlt (0.21). */
export function waehleKampf(i: number){
  if(i < 0 || i >= state.encounters.length) return;
  state.sel = i; state.start = false; state.einst = false; state.weeklies = false; state.rekorde = false;
  ungelesenLesen();
  renderAll();
}
/* Voriger (aelterer) und naechster (neuerer) Kampf, ohne das Feld zu
   oeffnen. Am Ende der Liste geht es nicht weiter. */
export function blaettern(schritt: 1 | -1){
  if(!state.encounters[state.sel]) return;
  waehleKampf(state.sel + schritt);
}

/* ---------- Ein neuer Kampf kommt (Luecken 0.21, 0.22, 0.23) ----------
   Nur im Live: waechst die Liste derselben Datei um einen neueren Kampf,
   steht am Kampf-Symbol eine Pille mit der Zahl (bis man waehlt oder den
   Bereich Kampf oeffnet), die Pille der Titelleiste gleitet, und die
   Statusleiste sagt, was gelesen wurde. Was beim
   Einschalten schon im Log stand, ist nicht neu. Bei weniger Bewegung
   springt alles an seinen Platz. */
let neuesteZuletzt: { datei: string; start: number } | null = null;
let ungelesenN = 0, pilleGleiten = false;
let gelesen: { name: string; wann: number } | null = null;
export function letzterGelesen(){ return gelesen; }
export function ungelesenLesen(){
  if(!ungelesenN) return;
  ungelesenN = 0;
  syncUngelesen();
}
function syncUngelesen(){
  const u = document.getElementById("ungelesen");
  if(!u) return;
  u.hidden = ungelesenN === 0;
  if(ungelesenN){
    $("#ungelesenZahl").textContent = String(ungelesenN);
    $("#ungelesenName").textContent = ", " + t("sb.ungelesen", {n: ungelesenN});
  }
}
function neuerKampfPruefen(){
  const neueste = state.encounters[0];
  const datei = (state.fileNames || []).join("|");
  /* Eine andere Datei oder kein Live mehr: was zuletzt gelesen wurde,
     gehoert zur alten Sitzung ("wartet auf den naechsten Kampf"). */
  if(gelesen && (state.origin !== "watch" || (neuesteZuletzt && neuesteZuletzt.datei !== datei))) gelesen = null;
  if(state.origin !== "watch" || !neueste){ neuesteZuletzt = neueste ? {datei, start: neueste.start} : null; return; }
  const vorher = neuesteZuletzt;
  neuesteZuletzt = {datei, start: neueste.start};
  if(!vorher || vorher.datei !== datei || neueste.start <= vorher.start) return;
  const neu = state.encounters.filter(seg => seg.start > vorher.start).length;
  if(!neu) return;
  gelesen = {name: neueste.stats.name, wann: Date.now()};
  const imKampf = state.tab === "timeline" && !state.start && !state.einst && !state.weeklies && !state.rekorde;
  if(!imKampf || state.sel !== 0){ ungelesenN += neu; syncUngelesen(); }
  /* Die grosse Zahl zaehlt schon von selbst hoch (setHeroDps, 20-meter-head.ts,
     auch der Sprung bei weniger Bewegung); hier gleitet die Pille. */
  pilleGleiten = true;
  syncLiveBtn();
}
/* Die gespeicherten Kaempfe oben in der Liste. Von selbst offen, sobald
   etwas gespeichert oder zum Vergleich angehakt ist; ein Klick auf den
   Fussknopf ueberstimmt das fuer die Sitzung. */
let laeufeWahl: boolean | null = null;
export function syncKwLaeufe(){
  const n = state.runs.length;
  const auf = laeufeWahl ?? (n > 0 || (state.cmpRuns ? state.cmpRuns.size : 0) > 0);
  const abschnitt = $("#kwRuns");
  if(abschnitt.hidden === auf) abschnitt.hidden = !auf;
  const b = $("#kwLaeufe");
  b.setAttribute("aria-expanded", auf ? "true" : "false");
  const wort = t("kw.laeufe", {n});
  if(b.textContent !== wort) b.textContent = wort;
}

/* ---------- Fruehere Tage (Nachtraege N3, Luecken 0.7 und 1.9) ----------
   Im Kopf der Kampfwahl blaettert man zu frueheren Tagen: zu den aelteren
   Logdateien im Log-Ordner des Spiels, gruppiert nach dem Tag ihrer
   Aenderungszeit in Berlin (logTage, ../verlauf-core.ts). Die Auflistung
   kommt frisch von GET /api/logs, jede Datei in Stuecken von GET /api/log
   (hoechstens 8 MB je Antwort, wie /api/latest). Ein frueherer Tag pausiert
   das Mitlesen, und der Kopf sagt es; "Heute" nimmt es wieder auf. Geladen
   wird wie beim Oeffnen einer Datei (loadText): der logIndex bekommt den
   Tag so, wie er ihn beim Oeffnen der Dateien bekaeme - geloescht oder
   verschoben wird nichts. Im Browser ohne App gibt es die Routen nicht,
   dann fehlen die Knoepfe. */
let tage: LogTag[] | null = null;
/* Der geladene Tag und seine Dateien. Er gilt nur, solange genau diese
   Dateien geladen sind - eine andere Datei, das Beispiel oder Live
   verlassen ihn, ohne es sagen zu muessen. */
let ansicht: { tag: string; namen: string[] } | null = null;
let livePausiert = false;
/* Ob Live fuer einen frueheren Tag nur pausiert (Abschlusspruefung, M1): das
   Kompaktfenster laeuft dann mit, und der Streifen im Rueckfall sagt es (H2). */
export const istLivePausiert = () => livePausiert;
/* Jedes Laden und jedes Verlassen zaehlt hoch: eine Antwort, die zu einem
   frueheren Klick gehoert, wird verworfen. */
let tagLauf = 0;
let laedt = false;
const gleich = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const ansichtAktiv = () => !!ansicht && gleich(state.fileNames || [], ansicht.namen);
/** Der Tag im Kopf, solange ein Tag aus dem Log-Ordner geladen ist ("Fr 25.09."), sonst null. */
export function tagAnsichtLabel(): string | null {
  const teile = ansicht && ansichtAktiv() ? tagTeile(ansicht.tag) : null;
  return teile ? t("kw.tag", teile) : null;
}
/** Live laeuft wieder (41-server-mode.ts): der fruehere Tag ist verlassen. */
export function tagAnsichtVerlassen(){
  tagLauf++;
  ansicht = null; livePausiert = false; laedt = false;
  syncTage();
}
async function tageHolen(): Promise<LogTag[] | null> {
  if(!SERVED) return null;
  let neu: LogTag[] | null = null;
  try {
    const r = await fetch("/api/logs", {signal: AbortSignal.timeout(10000)});
    const d = r.ok ? await r.json().catch(() => null) : null;
    neu = d && d.ok && Array.isArray(d.files) ? logTage(d.files) : null;
  } catch { neu = null; }
  tage = neu;
  syncTage();
  return tage;
}
/* Der Tag, auf dem die Kampfwahl steht: der geladene oder der neueste. */
const jetzigerTag = () => ansicht && ansichtAktiv() ? ansicht.tag : tage?.[0]?.tag ?? "";

/** Knoepfe, Pause und "Heute" nach dem Stand; schreibt nur, was sich aendert. */
export function syncTage(){
  const vor = document.getElementById("kwTagVor") as HTMLButtonElement | null;
  const nach = document.getElementById("kwTagNach") as HTMLButtonElement | null;
  const heute = document.getElementById("kwHeute") as HTMLButtonElement | null;
  const pause = document.getElementById("kwPause");
  if(!vor || !nach || !heute || !pause) return;
  const a = document.activeElement;
  const hatte = a === vor || a === nach || a === heute ? a as HTMLButtonElement : null;
  const liste = SERVED && tage && tage.length ? tage : null;
  const jetzt = jetzigerTag();
  const neuester = liste ? liste[0]!.tag : "";
  const setze = (b: HTMLButtonElement, da: boolean, an: boolean) => {
    if(b.hidden === da) b.hidden = !da;
    if(b.disabled === an) b.disabled = !an;
  };
  setze(vor, !!liste, !!liste && liste.some(x => x.tag < jetzt));
  setze(nach, !!liste, !!liste && liste.some(x => x.tag > jetzt));
  const zurueck = SERVED && (livePausiert || (!!ansicht && ansichtAktiv() && !!neuester && ansicht.tag !== neuester));
  setze(heute, zurueck, zurueck);
  const titel = t(livePausiert ? "kw.heuteLiveTitle" : "kw.heuteTitle");
  if(heute.title !== titel) heute.title = titel;
  const satz = livePausiert ? t("kw.pausiert") : "";
  if(pause.textContent !== satz) pause.textContent = satz;
  if(pause.hidden === !!satz) pause.hidden = !satz;
  const box = document.getElementById("kwListe");
  if(box){ if(laedt) box.setAttribute("aria-busy", "true"); else box.removeAttribute("aria-busy"); }
  /* Ein Knopf, der gerade den Fokus hatte und jetzt aus oder weg ist (am
     aeltesten Tag, "Heute" nach der Rueckkehr): der Fokus geht in die
     Suche, sonst fiele er auf die Seite. */
  if(hatte && (hatte.disabled || hatte.hidden) && kampfwahlOffen()) suchfeld().focus({preventScroll: true});
}

/* Eine Datei ganz, Stueck fuer Stueck ab dem Byte hinter dem vorigen.
   null, wenn der Helfer sie so nicht gibt. Eine letzte Zeile ohne
   Zeilenende kommt nicht mit - wie beim Mitlesen, das nur ganze Zeilen
   nimmt. */
type LogStueck = { file?: unknown; from?: unknown; to?: unknown; size?: unknown; text?: unknown };
/* Wie die letzte Antwort von GET /api/log ausging: 404 heisst, der Helfer
   kennt den Namen im Log-Ordner nicht; alles andere (0: keine Antwort) ist
   ein Lesefehler (Kompakt-Fix, Gutachten N3). */
let holStatus = 0;
async function dateiHolen(name: string, lauf: number): Promise<string | null> {
  let text = "", from = 0;
  holStatus = 0;
  for(;;){
    let d: LogStueck | null;
    try {
      const r = await fetch("/api/log?name=" + encodeURIComponent(name) + "&from=" + from, {signal: AbortSignal.timeout(10000)});
      holStatus = r.status;
      d = r.ok ? await r.json().catch(() => null) : null;
    } catch { holStatus = 0; return null; }
    if(lauf !== tagLauf || !d) return null;
    const to = d.to, size = d.size;
    if(d.file !== name || d.from !== from || typeof d.text !== "string" || typeof to !== "number" || typeof size !== "number"
       || !Number.isSafeInteger(to) || !Number.isSafeInteger(size) || to < from || size < to) return null;
    text += d.text;
    if(to === size || to === from) return text;
    from = to;
  }
}
/* Die Dateien eines Tages laden. Laeuft Live, pausiert es. */
async function tagLaden(tag: string, namen: string[]){
  const lauf = ++tagLauf;
  if(livePausieren()) livePausiert = true;
  laedt = true;
  syncTage();
  const texte: string[] = [];
  for(const name of namen){
    const text = await dateiHolen(name, lauf);
    if(lauf !== tagLauf) return;
    if(text === null){ laedt = false; syncTage(); toastFail(tt("kw.tagFehler")); return; }
    texte.push(text);
  }
  laedt = false;
  ansicht = {tag, namen};
  setLoadOrigin("file");
  loadText(texte.join("\n"), namen);
  syncTage();
}
/* Ein Tag zurueck (1) oder vor (-1). Der neueste Tag ist "Heute". */
async function tagSchritt(richtung: 1 | -1){
  const jetzt = jetzigerTag();
  const liste = await tageHolen();
  if(!liste || !liste.length) return;
  const ziel = richtung === 1 ? liste.find(x => x.tag < jetzt) : [...liste].reverse().find(x => x.tag > jetzt);
  if(!ziel) return;
  if(ziel.tag === liste[0]!.tag) return zuHeute();
  await tagLaden(ziel.tag, ziel.dateien.map(d => d.name));
}
/* Heute: lief Live, liest es wieder mit (und laedt dabei die neueste Datei);
   sonst die Dateien des neuesten Tages. */
async function zuHeute(){
  if(livePausiert){ liveFortsetzen(); return; }
  const liste = await tageHolen();
  if(!liste || !liste.length) return;
  await tagLaden(liste[0]!.tag, liste[0]!.dateien.map(d => d.name));
}
/** "Zuletzt geoeffnet" auf Start (45-startup.ts): die genannten Dateien ueber dieselbe Route. */
export async function oeffneDateien(namen: string[]){
  if(!SERVED || !namen.length) return;
  const liste = await tageHolen();
  if(!liste){ toastFail(tt("party.helperNoAnswer")); return; }
  const alle = liste.flatMap(x => x.dateien);
  const fehlt = namen.find(n => !alle.some(d => d.name === n));
  if(fehlt !== undefined){ toastFail(tt("land.dateiFehlt", {name: fehlt})); return; }
  /* Die Datei, die Live gerade liest: nichts zu laden, nur zeigen. */
  if(isWatching() && gleich(state.fileNames || [], namen)){
    state.start = false; state.einst = false; state.weeklies = false; state.rekorde = false;
    renderAll();
    return;
  }
  const neueste = Math.max(...alle.filter(d => namen.includes(d.name)).map(d => d.mtime));
  await tagLaden(berlinTag(neueste * 1000), namen);
}

/* ---------- Der Streifen zeigt, was die Vollansicht zeigt (Kompakt-Fix 01.10.) ----------
   Das Kompaktfenster ist eine eigene Seite. Den Stand der Vollansicht (37,
   vollStand) bekommt es ueber GET /api/state unter kompakt: einen Grund,
   bei "datei" dazu den Dateinamen und den Start des gewaehlten Kampfs. Die
   Datei holt es wie ein frueherer Tag ueber GET /api/log?name= - der
   Helfer vergleicht den Namen mit dem Log-Ordner; kennt er ihn nicht (eine
   hineingezogene Datei), sagt der Streifen das. Live bleibt, wie es war:
   laeuft es im Streifen, aendert der Stand nichts. Ein Kampf, den der
   Streifen schon zeigt, bleibt stehen, wenn die Vollansicht danach zum
   Beispiel wechselt - er ist echt und aus dem Log-Ordner. */
const STREIFEN_SATZ: Record<string, string> = {fremd: "compact.idleFremd", beispiel: "compact.idleBeispiel", mehrere: "compact.idleMehrere",
  andere: "compact.idleAndere", kampf: "compact.idleKampf", fehler: "compact.idleFehler"};
let streifenLauf = 0;
/* Der Ruhesatz des Streifens statt "Kein Log", oder wieder "Kein Log". Ueber
   data-i18n, damit ein Sprachwechsel ihn mitnimmt (31). */
function ruheSatz(grund: string){
  const el = $("#compactIdle");
  const key = Object.hasOwn(STREIFEN_SATZ, grund) ? STREIFEN_SATZ[grund]! : "compact.idleShort";
  const titel = key === "compact.idleShort" ? "compact.idle" : key + "Titel";
  if(el.dataset.i18n === key) return;
  el.dataset.i18n = key; el.dataset.i18nTitle = titel;
  el.textContent = t(key); el.title = t(titel);
  // der Satz ist breiter als "Kein Log": der Streifen misst sich neu (36)
  if(document.body.classList.contains("compact")) renderAll();
}
/* Der Streifen zeigt keinen Kampf mehr (Gutachten M1, M3): folgt er der
   Vollansicht nicht, zeigt er nicht still einen alten oder anderen Kampf,
   sondern ruht mit seinem Satz. Nur der Stand dieser Seite geht; geloescht
   oder geschrieben wird nichts, der Streifen speichert ohnehin nichts. */
function streifenLeeren(){
  if(!state.text && !state.encounters.length) return;
  state.text = ""; state.fileNames = []; state.parsed = null;
  state.encounters = []; state.sel = 0; state.origin = "";
  renderAll();
}
/* Eine Datei aus dem Log-Ordner in den Streifen, ganz, ueber dieselbe Route
   wie ein frueherer Tag. frisch: auch wenn sie schon geladen ist (sie kann
   gewachsen sein). "fremd", wenn der Helfer den Namen im Log-Ordner nicht
   kennt (404), "fehler" bei jedem anderen Ausgang. */
async function streifenDatei(name: string, frisch: boolean): Promise<"ok" | "fremd" | "fehler"> {
  if(!frisch && state.origin === "file" && gleich(state.fileNames || [], [name])) return "ok";
  const lauf = ++tagLauf;
  const text = await dateiHolen(name, lauf);
  if(lauf !== tagLauf) return "fehler";
  if(text === null) return holStatus === 404 ? "fremd" : "fehler";
  setLoadOrigin("file");
  loadText(text, [name], true);
  return "ok";
}
/** Der Stand der Vollansicht aus /api/state (41): beim Laden und bei jedem Ereignis kompaktstand. */
export async function streifenFolgt(k: {grund?: unknown; datei?: unknown; kampf?: unknown} | null | undefined){
  if(!SERVED || !k || isWatching()) return;
  const lauf = ++streifenLauf;
  let grund = typeof k.grund === "string" ? k.grund : "";
  /* Live (auch pausiert) bleibt, wie es war: der Streifen liest selbst mit
     oder ruht, wie er ist. */
  if(grund === "live") return;
  if(grund === "datei" && typeof k.datei === "string" && k.datei){
    const kampf = k.kampf;
    const finde = () => state.encounters.findIndex(e => Math.round(e.start) === kampf);
    let da = await streifenDatei(k.datei, false);
    if(lauf !== streifenLauf || isWatching()) return;
    /* Der Start steht nicht in der geladenen Datei: sie kann gewachsen sein
       (die Vollansicht hat sie frischer). Einmal neu geholt (Gutachten M3). */
    if(da === "ok" && finde() < 0){
      da = await streifenDatei(k.datei, true);
      if(lauf !== streifenLauf || isWatching()) return;
    }
    const i = da === "ok" ? finde() : -1;
    if(i >= 0){
      if(i !== state.sel) waehleKampf(i);
      ruheSatz("");
      return;
    }
    grund = da === "ok" ? "kampf" : da;
  }
  streifenLeeren();
  ruheSatz(grund);
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  const knopf = $("#kwKnopf"), feld = suchfeld(), feldBox = $("#kampfwahl");
  knopf.onclick = () => { if(kampfwahlOffen()) kampfwahlSchliessen(true); else kampfwahlOeffnen(); };
  feld.addEventListener("input", () => {
    const jetzt = kwSucheAktiv();
    if(jetzt !== suchteZuletzt){ suchteZuletzt = jetzt; renderFights(); }
    kwFiltern();
    setzeAktiv(eintraege()[0]);
  });
  feld.addEventListener("keydown", e => {
    if(e.altKey || e.ctrlKey || e.metaKey) return;
    const alle = eintraege();
    const aktiv = alle.find(x => x.id === aktivId) || null;
    const i = aktiv ? alle.indexOf(aktiv) : -1;
    const ohneSuche = !kwSucheAktiv();
    let ziel: HTMLElement | null | undefined = null;
    switch(e.key){
      case "ArrowDown": ziel = alle[Math.min(i + 1, alle.length - 1)]; break;
      case "ArrowUp":   ziel = alle[Math.max(i - 1, 0)]; break;
      case "Home":      ziel = alle[0]; break;
      case "End":       ziel = alle[alle.length - 1]; break;
      case "ArrowRight": case "ArrowLeft": {
        // mit Suchtext bewegen die Pfeile den Cursor, wie in jedem Feld
        if(!ohneSuche || !aktiv) return;
        const auf = aktiv.getAttribute("aria-expanded");
        if(e.key === "ArrowRight" && auf === "false"){ e.preventDefault(); aktiv.click(); return; }
        if(e.key === "ArrowLeft" && auf === "true"){ e.preventDefault(); aktiv.click(); return; }
        ziel = e.key === "ArrowLeft" ? kopfUeber(alle, i) : alle[i + 1];
        break;
      }
      case "Enter":
        if(!aktiv) return;
        e.preventDefault();
        aktiv.click();   // ein Kampf oeffnet und schliesst das Feld, ein Klappkopf klappt
        return;
      case "Delete": {
        /* Entf loest wie in der Schiene nur im Bearbeiten-Modus - und nur
           ohne Suchtext, sonst loescht Entf ein Zeichen im Feld. */
        if(!ohneSuche || !state.bearbeiten || !aktiv || !aktiv.matches(".fight")) return;
        const seg = state.encounters[+aktiv.dataset.i!];
        if(!seg || !darfEntfernen(seg)) return;
        e.preventDefault();
        kampfEntfernen(seg);
        return;
      }
      default: return;
    }
    e.preventDefault();
    if(ziel) setzeAktiv(ziel);
  });
  /* Esc schliesst, solange das Feld offen ist - auch wenn der Fokus gerade
     nirgends steht (auf der Seite) oder in der Meldung. Nicht, solange ein
     Dialog darueber liegt: dessen Esc gehoert ihm. */
  addEventListener("keydown", e => {
    if(e.key !== "Escape" || !kampfwahlOffen() || state.modalOpen || state.filterOpen) return;
    e.preventDefault();
    const a = document.activeElement;
    const zurueck = !a || a === document.body || feldBox.contains(a) || !!a.closest("#toast");
    kampfwahlSchliessen(zurueck);
  });
  /* Rueckgaengig in der Meldung baut die Liste neu und nimmt dabei die
     Taste weg, die den Fokus hatte - er fiele auf die Seite. Ist die
     Kampfwahl offen, geht er in die Suche zurueck. */
  $("#toast").addEventListener("click", e => {
    if(!kampfwahlOffen() || !(e.target as HTMLElement).closest(".tact")) return;
    feld.focus({preventScroll: true});
  });
  /* Nicht modal: verlaesst der Fokus das Feld (Tab), geht es zu. Nicht, wenn
     er an den Knopf, in die Meldung oder in einen Dialog geht. */
  feldBox.addEventListener("focusout", e => {
    const neu = e.relatedTarget as HTMLElement | null;
    if(!neu || feldBox.contains(neu) || neu === knopf || neu.closest("#toast, #modalBg, #filterBg")) return;
    kampfwahlSchliessen(false);
  });
  /* Ein Klick in die Liste - auf einen Eintrag oder eine leere Stelle des
     Feldes - nimmt der Suche den Fokus nicht. Knoepfe ausserhalb der Liste
     (Fuss, "zurueck", Vergleichen) und die Haekchen nehmen ihn wie ueblich. */
  feldBox.addEventListener("mousedown", e => {
    const ziel = e.target as HTMLElement;
    if(ziel.closest(".fight, .blockfold, .trashhead, .fx")) { e.preventDefault(); return; }
    if(ziel === feld || ziel.closest("button, input, a, select, textarea, label")) return;
    e.preventDefault();
  });
  /* Ein Klick daneben schliesst. isConnected: ein Klappkopf oder ein Loesen
     baut die Liste neu, und das Ziel des Klicks ist danach nicht mehr im
     Dokument - es war aber im Feld. Die Meldung (Rueckgaengig) und die
     Dialoge schliessen es nicht. */
  addEventListener("click", e => {
    if(!kampfwahlOffen()) return;
    const ziel = e.target as HTMLElement | null;
    if(!ziel || !ziel.isConnected || !ziel.closest) return;
    if(ziel.closest("#kampfwahl, #kwKnopf, #toast, #modalBg, #filterBg")) return;
    kampfwahlSchliessen(false);
  });
  /* Strg+K, auch im Browser und aus einem Eingabefeld heraus: das Kuerzel
     gehoert der App (preventDefault). Nicht im Kompakt und nicht, solange
     ein Dialog offen ist. */
  addEventListener("keydown", e => {
    if(!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "k") return;
    // auch dort, wo es nichts oeffnet: sonst griffe das Browserkuerzel
    e.preventDefault();
    if(document.body.classList.contains("compact") || state.modalOpen || state.filterOpen
       || $("#clogBg").classList.contains("on")) return;
    kampfwahlOeffnen();
  });
  $("#kwLaeufe").onclick = () => {
    laeufeWahl = !!$("#kwRuns").hidden;
    syncKwLaeufe();
  };
  $("#kwOeffnen").onclick = () => { kampfwahlSchliessen(true); $("#miOpenCombat").click(); };
  $("#kwVor").onclick = () => blaettern(1);
  $("#kwNach").onclick = () => blaettern(-1);
  /* Strg+Pfeil links/rechts: voriger und naechster Kampf (0.5). Nicht aus
     einem Eingabefeld (dort springt Strg+Pfeil ueber Woerter), nicht im
     Kompakt und nicht, solange ein Dialog offen ist. */
  addEventListener("keydown", e => {
    if(!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    const a = document.activeElement as HTMLElement | null;
    if(a && (a.matches("input, textarea, select, [contenteditable]") || a.isContentEditable)) return;
    if(document.body.classList.contains("compact") || state.modalOpen || state.filterOpen || !state.encounters.length) return;
    e.preventDefault();
    blaettern(e.key === "ArrowLeft" ? 1 : -1);
  });
  // Live im Feld ist derselbe Umschalter wie oben (0.8)
  $("#kwLive").onclick = () => $("#btnWatch").click();
  // fruehere Tage (Nachtraege N3)
  $("#kwTagVor").onclick = () => void tagSchritt(1);
  $("#kwTagNach").onclick = () => void tagSchritt(-1);
  $("#kwHeute").onclick = () => void zuHeute();
  syncTage();
  syncKwKnopf();
}
