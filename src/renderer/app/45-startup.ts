import { BORO_VERSION, state } from "./01-state";
import { toastNachfuehren } from "./03-helpers";
import { t } from "./08-translation";
import { kampfwahlOffen, kampfwahlSchliessen, letzterGelesen, oeffneDateien } from "./23-kampfwahl";
import { $, esc } from "./18-interface-basics";
import { applyStaticI18n, setLang } from "./31-static-translation";
import { renderRotation } from "./25-rotation";
import { histRecord } from "./32-history";
import { switchTab } from "./34-menus-drop-and-tabs";
import { kompaktFensterAuf, syncWidthStops, syncZoomRow, winPost } from "./37-window-size-and-overlay";
import { chooseServerDir, FENSTER, KOMPAKT_FENSTER, OWN_WINDOW, SERVED, serverDir } from "./41-server-mode";
import { syncPartyPill } from "./42-party";
import { toggleMore } from "./43-more-menu-and-dev-mode";
import { renderTafelUrteil } from "./56-tafel";
import { einstNachfuehren } from "./57-einstellungen";
import { zuletztGeoeffnet } from "../verlauf-core";

/* ---------- Filter dropdown ----------
   Auf dem Knopf stand eine Zusammenfassung: "Alle im Log | 8s / 3s". Der
   erste Teil sagte in fast jedem Log dasselbe - es gibt nur einen Spieler
   darin - und der zweite wiederholte zwei Zahlen, die eine Klicklaenge
   entfernt in ihren Feldern stehen. Gewuenscht: "Lass da nur Filter stehen." */
/* Der Bereich traegt aria-modal="true" - damit gilt fuer einen Vorleser
   alles ausserhalb als nicht vorhanden. Er nahm den Fokus aber nie, hielt
   ihn nicht, und beim Schliessen fiel er auf <body>, sodass die naechste
   Tabulatortaste wieder ganz oben anfing. Wer ihn mit der Tastatur oeffnete,
   stand also auf einem Knopf, den sein Vorleser nicht mehr las.

   Dasselbe Muster wie beim Changelog, nicht ein neues: vorher merken, wohin
   der Fokus zurueck soll, beim Oeffnen auf den Schliessen-Knopf, beim
   Schliessen zurueck - und nur dann, wenn der Fokus noch im Bereich steht,
   sonst nimmt man ihn jemandem weg, der inzwischen woanders ist. */
let filterPrev: HTMLElement | null = null;
function toggleFilter(open?: boolean){
  state.filterOpen = open === undefined ? !state.filterOpen : open;
  if(state.filterOpen) filterPrev = document.activeElement as HTMLElement | null;
  const hielt = !state.filterOpen && $("#filterPanel").contains(document.activeElement);
  $("#filterBg").classList.toggle("on", state.filterOpen);
  $("#filterPanel").hidden = !state.filterOpen;
  $("#filterBtn").classList.toggle("open", state.filterOpen);
  $("#filterBtn").setAttribute("aria-expanded", state.filterOpen ? "true" : "false");
  if(state.filterOpen) $("#filterClose").focus({preventScroll:true});
  else if(hielt){
    if(filterPrev && document.contains(filterPrev)) filterPrev.focus({preventScroll:true});
    else $("#filterBtn").focus({preventScroll:true});
  }
  if(!state.filterOpen) filterPrev = null;
}

/* ---------- compare, from where the runs actually are ---------- */
export function syncCompareBtn(){
  const n = state.cmpRuns ? state.cmpRuns.size : 0;
  const btn = $("#btnCompareNow");
  const vorher = btn.hidden;
  btn.hidden = n < 1;
  /* Erscheint oder verschwindet "Vergleichen", rueckt eine stehende Meldung
     nach (placeToast legt sie ueber den Knopf). Nie ausblenden: das lief
     hier vorher bei jedem renderAll und nahm dem Rueckgaengig nach dem
     Entfernen eines Kampfes seine neun Sekunden. */
  if(vorher !== btn.hidden) toastNachfuehren();
  $("#cmpCount").textContent = n ? String(n) : "";
  runNoteSync();
}
/* Leer ist der Abschnitt nur, solange nichts gespeichert UND nichts zum
   Vergleich angehakt ist. Sind Kaempfe aus dem Log angehakt, steht hier
   "Vergleichen 2" - und der Satz "Noch keiner ..." daneben widersprach dem
   Knopf. */
export function runNoteSync(){
  $("#runNote").hidden = state.runs.length > 0 || (state.cmpRuns ? state.cmpRuns.size : 0) > 0;
}

/* ---------- our own window controls, for the frameless window ----------
   Im Kompaktfenster (Nachtraege N4) gilt Schliessen nur dem Streifen: die
   Anfrage nennt das Fenster (FENSTER). */
function winDo(action: string){
  fetch("/api/win", {method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({do:action, win: FENSTER})}).catch(() => {});
}

/* ---------- live watching, made obvious ---------- */
let watchPopTimer: ReturnType<typeof setTimeout> | null = null;
function showWatchPop(file?: string){
  $("#watchPopFile").textContent = file || "";
  const pop = $("#watchPop");
  pop.classList.add("on");
  clearTimeout(watchPopTimer ?? undefined);
  watchPopTimer = setTimeout(() => pop.classList.remove("on"), 4200);
}
/* Eine Quelle fuer den Zustand: body.watching. Der Knopf, die Kante ums
   Fenster und der Punkt in der Taskleiste lesen alle daran ab. Vorher trug
   #live eine eigene Klasse .on, die an zehn Stellen von Hand mitgezogen
   wurde - und im Browser mit einem leeren Ordner stand sie auf "an",
   waehrend body.watching "aus" sagte. */
export const isWatching = () => document.body.classList.contains("watching");
/* pause (Nachtraege N3, Pruefung G4): ein frueherer Tag haelt Live nur an.
   Der letzte Kampf kann dann noch laufen - er wird nicht wie bei "Live aus"
   als beendet eingetragen (histRecord mit bestRecord und Paar); das
   Verzeichnis behaelt, was Live bis dahin schrieb. */
export function setWatching(on: boolean, file?: string, pause = false){
  const was = isWatching();
  document.body.classList.toggle("watching", !!on);
  if(on && !was) showWatchPop(file);
  // beendet, waehrend das Band noch stand: es sagte weiter "Live-Aufzeichnung"
  if(!on && was){
    clearTimeout(watchPopTimer ?? undefined); $("#watchPop").classList.remove("on");
    /* Der letzte Kampf des Abends zaehlt erst jetzt: bestRecord laesst ihn
       waehrend Live aus. histRecord
       traegt ihn ins Verzeichnis ein und ruft bestRecord mit. */
    if(!pause) histRecord();
    /* Ebenso das Fenster (fensterStand laesst den laufenden Kampf aus):
       das Urteil der Tafel ohne Bezug kann sich jetzt aendern, ohne dass
       sich am Kampf etwas geaendert hat. */
    renderTafelUrteil();
    /* Und die Leiste der Rotation: unter Live zeigte sie mit Vorlauf mehr
       als den Kampf (leistenDauer, Neugestaltung 28.09.); steht der Kampf,
       baut sie einmal voll auf seine Dauer. */
    if(state.tab === "rotation") renderRotation();
  }
  // der goldene Punkt auf dem Symbol in der Taskleiste folgt (taskbar.ts)
  if(!!on !== was) void winPost({do:"live", on: !!on});
  syncLiveBtn();
}
/* Der Satz zum Zustand: Dateiname, "wartet auf einen Kampf", Stoerung.
   Wahlweise als Funktion, dann steht er nach einem Sprachwechsel in der
   neuen Sprache (syncLiveBtn aus applyStaticI18n). gestoert: die
   Aufzeichnung laeuft weiter, bekommt aber gerade keine Antwort - der Knopf
   bleibt gedrueckt, denn ein Klick beendet sie, und sagt "gestoert". */
type LiveSay = string | (() => string);
let liveSatz: LiveSay = () => t("top.notWatching");
let liveGestoert = false;
export function liveSay(say: LiveSay, gestoert = false){
  liveSatz = say; liveGestoert = gestoert;
  syncLiveBtn();
}
export function syncLiveBtn(){
  const satz = typeof liveSatz === "function" ? liveSatz() : liveSatz;
  const region = $("#liveText");
  /* Nur bei einer Aenderung schreiben: der Helfer wird alle zwei Sekunden
     gefragt und meldet meist dieselbe Datei. Jedes Neuschreiben einer
     Live-Region darf ein Vorleser als neue Ansage nehmen. */
  if(region.textContent !== satz) region.textContent = satz;
  const an = isWatching(), gestoert = an && liveGestoert;
  // der Ring statt des Punkts im Streifen (#158)
  document.body.classList.toggle("livestoer", gestoert);
  /* Die Datei im title der Faktenzeile im Streifen, solange Live laeuft
     (#161: das Band entfaellt dort). Nur ein Dateiname, wie der Satz. */
  const meta = document.querySelector<HTMLElement>("#hMeta");
  if(meta){
    const datei = an && typeof liveSatz === "string" ? liveSatz : "";
    if(document.body.classList.contains("compact") && datei) meta.title = t("compact.liveTitle", {datei});
    else if(meta.title.startsWith(t("compact.liveTitle", {datei: ""}))) meta.removeAttribute("title");
  }
  const b = $("#btnWatch");
  b.setAttribute("aria-pressed", an ? "true" : "false");
  b.classList.toggle("on", an && !gestoert);
  b.classList.toggle("err", gestoert);
  $("#liveState").textContent = !an ? t("top.liveOffWord") : gestoert ? t("top.liveErrWord") : "";
  /* Die Statusleiste zeigt denselben Zustand in einem Wort (Instrumententafel
     3.4). Sie sagt nichts an - das tut #live -, darum nur Text und Klasse. */
  const sbWort = !an ? t("sb.liveOff") : gestoert ? t("sb.liveErr") : t("sb.liveOn");
  const sbText = $("#sbLiveText");
  if(sbText.textContent !== sbWort) sbText.textContent = sbWort;
  $("#sbLive").classList.toggle("on", an && !gestoert);
  $("#sbLive").classList.toggle("err", gestoert);
  /* Dahinter der Satz wie im Entwurf (0.23): worauf Live wartet, oder was
     zuletzt gelesen wurde ("Vulcanus gelesen, gerade eben"). */
  const g = letzterGelesen();
  const wann = g ? (Date.now() - g.wann < 60000 ? t("sb.geradeEben") : t("sb.vorMin", {n: Math.floor((Date.now() - g.wann) / 60000)})) : "";
  const sbSatz = an && !gestoert ? " \u00b7 " + (g ? t("sb.gelesen", {name: g.name, wann}) : t("sb.warte")) : "";
  const satzFeld = $("#sbLiveSatz");
  if(satzFeld.textContent !== sbSatz) satzFeld.textContent = sbSatz;
  /* Live im Kopf der Kampfwahl (0.8): derselbe Zustand wie hier. */
  const kw = $("#kwLive");
  kw.setAttribute("aria-pressed", an ? "true" : "false");
  kw.classList.toggle("on", an && !gestoert);
  kw.classList.toggle("err", gestoert);
  const kwWort = $("#kwLiveWort");
  if(kwWort.textContent !== sbWort) kwWort.textContent = sbWort;
  /* Der title sagt den ganzen Zustand und was ein Klick tut. Im Browser ohne
     Helfer und ohne Ordnerwahl (Firefox) gibt es keine Aufzeichnung - dann
     sagt er das, statt "Klicken zum Starten" zu versprechen. */
  const allgemein = satz === t("top.watching") || satz === t("top.notWatching");
  b.title = gestoert ? t("top.liveTitleErr", {what: satz})
    : an ? t("top.liveTitleOn", {what: allgemein ? "" : satz})
    : SERVED ? t("top.liveTitleOff")
    : window.showDirectoryPicker ? t("top.liveTitleOffPick")
    : t("toast.watchNeedsChrome");
  /* Live im Kopf von "Zuletzt geoeffnet" auf Start (Luecken 1.11): derselbe
     Umschalter, leise, mit dem Wort des Entwurfs. */
  const w2 = $("#btnWatch2");
  w2.setAttribute("aria-pressed", an ? "true" : "false");
  w2.classList.toggle("on", an && !gestoert);
  w2.classList.toggle("err", gestoert);
  const w2Wort = an && !gestoert ? t("land.liveAn") : gestoert ? t("sb.liveErr") : t("land.watchFolder");
  if($("#btnWatch2Wort").textContent !== w2Wort) $("#btnWatch2Wort").textContent = w2Wort;
  einstNachfuehren();   // der Schalter Live-Aufzeichnung in den Einstellungen
  // das Zustandswort aendert die Breite des Knopfes - eine stehende Meldung
  // haelt ihren Abstand zu ihm (placeToast in 03-helpers.ts)
  toastNachfuehren();
}

/* ---------- Start (Neugestaltung 28.09., Luecken 1) ----------
   Das feste Markup traegt index.html; hier steht, was von der Umgebung
   abhaengt. Links: in der App waehlt der heisse Knopf den Log-Ordner
   (chooseServerDir, derselbe Dialog wie in den Einstellungen, danach liest
   Live mit), im Browser gibt es keinen Ordner - dort oeffnet er eine Datei.
   Rechts: solange der Helfer keinen Log-Ordner kennt, die Einrichtung als
   leises Feld (DECISION 1.12; der Satz "nicht selbst finden" nur in der App,
   nachdem /api/state geantwortet hat), sonst "Zuletzt geoeffnet" aus dem
   Verzeichnis der gelesenen Dateien (logIndex, zuletztGeoeffnet in
   ../verlauf-core.ts). Jede Zeile ist ein Knopf: er oeffnet ihre Datei (oder
   die Dateien eines Tages, "a + b") ueber GET /api/log wie ein frueherer Tag
   in der Kampfwahl (oeffneDateien in 23; Nachtraege N3, Luecken 1.9).
   Ohne gelesene Datei steht ein Satz statt erfundener Zeilen. Schreibt nur,
   was sich aendert; fragt nichts ab. */
export function renderStart(): void {
  if(!document.getElementById("land")) return;
  const wort = t(SERVED ? "land.pickFolder" : "land.dateiOeffnen");
  if($("#btnPickFolderWort").textContent !== wort) $("#btnPickFolderWort").textContent = wort;
  const hinweis = t(SERVED ? "land.hinweisApp" : "land.hinweisBrowser");
  if($("#landHinweisSatz").innerHTML !== hinweis) $("#landHinweisSatz").innerHTML = hinweis;
  const ordner = !!serverDir;
  if($("#landSetup").hidden !== ordner) $("#landSetup").hidden = ordner;
  if($("#landZuletzt").hidden === ordner) $("#landZuletzt").hidden = !ordner;
  const fehlt = SERVED && !ordner && !!document.body.dataset.bereit;
  if($("#landFehlt").hidden === fehlt) $("#landFehlt").hidden = !fehlt;
  if(!ordner) return;
  const zeilen = zuletztGeoeffnet(state.hist.files);
  const html = zeilen.map(z => '<li><button class="zr" type="button" data-datei="' + esc(z.datei) + '" title="' + esc(t("land.zeileTitle")) + '">' +
    '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h7l4 4v13h-11z"/>' +
    '<path d="M13.5 3.5v4h4M9 12h6M9 15.5h6"/></svg><span class="zt"><span class="zf">' + esc(z.datei) + '</span><small>' +
    esc((z.tag ? z.tag + " \u00b7 " : "") + z.von + "\u2013" + z.bis) + '</small></span><span class="zn">' + esc(t("land.zeileZahl", {n: z.n})) + '</span></button></li>').join("");
  const liste = $("#landZuletztListe");
  if(liste.innerHTML !== html) liste.innerHTML = html;
  liste.hidden = !zeilen.length;
  $("#landZuletztLeer").hidden = zeilen.length > 0;
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  /* "Zuletzt geoeffnet": ein Klick (oder Enter) auf eine Zeile oeffnet ihre
     Datei; eine Zeile aus mehreren Dateien steht als "a + b" im Verzeichnis. */
  $("#landZuletztListe").addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button.zr[data-datei]");
    if(b) void oeffneDateien((b.dataset.datei || "").split(" + ").filter(Boolean));
  });
  /* Tab bleibt im Bereich, solange er offen ist - hinter dem Schleier gibt es
     nichts, worauf ein Vorleser reagieren duerfte. Dieselbe Schleife wie beim
     Changelog. */
  $("#filterBg").addEventListener("keydown", e => {
    if(e.key !== "Tab" || !state.filterOpen) return;
    const f = [...$("#filterPanel").querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(b => b.offsetParent && !(b as HTMLButtonElement).disabled);
    if(!f.length) return;
    const erste = f[0]!, letzte = f[f.length - 1]!;
    if(e.shiftKey && document.activeElement === erste){ e.preventDefault(); letzte.focus(); }
    else if(!e.shiftKey && document.activeElement === letzte){ e.preventDefault(); erste.focus(); }
  });
  /* Filter steht im Fuss der Kampfwahl. Die geht zuerst zu und gibt den
     Fokus an ihren Knopf - dorthin kehrt er zurueck, wenn der Filterdialog
     schliesst (filterPrev). */
  $("#filterBtn").onclick = () => { if(kampfwahlOffen()) kampfwahlSchliessen(true); toggleFilter(); };
  $("#filterClose").onclick = () => toggleFilter(false);
  // Klick neben die Flaeche schliesst sie, wie bei jeder anderen Flaeche der App
  $("#filterBg").onclick = e => { if(e.target === $("#filterBg")) toggleFilter(false); };
  addEventListener("keydown", e => { if(e.key === "Escape" && state.filterOpen) toggleFilter(false); });
  $("#btnCompareNow").onclick = () => { kampfwahlSchliessen(true); switchTab("compare", true); };
  $("#winMin").onclick = () => winDo("minimize");
  $("#winMax").onclick = () => winDo("maximize");
  $("#winClose").onclick = () => winDo("close");
  /* ---------- Tab am Ende der Seite, im eigenen Fenster ----------
     Critique 23.09.2026: nach "Anwenden" im Zeitverlauf fiel der Fokus mit
     der naechsten Tabulatortaste auf <body>, ohne Rahmen. Neu gebaut oder
     versteckt wird dort nichts - "Anwenden" ist schlicht die letzte
     Station der Seite (gezaehlt: 50 von 51, im Zeitverlauf). Im Browser
     ginge es von dort in dessen eigene Leiste; im eigenen Fenster gibt es
     keine, und Chromium gibt den Fokus dem Dokument selbst - eine Station,
     die man nicht sieht. Also im eigenen Fenster von der letzten Station
     zur ersten (dem Sprunglink, der beim Fokus oben links erscheint) und
     mit Umschalt+Tab zurueck. Im Browser bleibt es, wie es ist: die
     Adressleiste ist dort ein echtes Ziel.
     defaultPrevented: Filterfeld und Changelog halten Tab selbst im
     Kreis, und dann ist hier nichts zu tun. */
  if(OWN_WINDOW) document.addEventListener("keydown", e => {
    if(e.key !== "Tab" || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const stationen = [...document.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, summary, [tabindex]')]
      .filter(el => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled &&
                    !el.closest("[inert]") && el.getClientRects().length > 0 &&
                    getComputedStyle(el).visibility !== "hidden");
    if(stationen.length < 2) return;
    const erste = stationen[0]!, letzte = stationen[stationen.length - 1]!;
    if(!e.shiftKey && document.activeElement === letzte){ e.preventDefault(); erste.focus(); }
    else if(e.shiftKey && document.activeElement === erste){ e.preventDefault(); letzte.focus(); }
  });
  /* ---------- language toggle, and the initial paint ---------- */
  $("#btnLang").onclick = () => setLang(state.lang === "de" ? "en" : "de");
  if(typeof BORO_VERSION !== "undefined") $("#appVer").textContent = "v" + BORO_VERSION;
  ["#btnSample","#btnLang"].forEach(sel => {
    const b = $(sel); if(!b) return;
    const prev = b.onclick;
    b.onclick = ev => { toggleMore(false); if(prev) prev.call(b, ev); };
  });
  /* Start: der heisse Knopf waehlt in der App den Log-Ordner, im Browser eine Datei */
  $("#btnPickFolder").onclick = () => { if(SERVED) void chooseServerDir(); else $("#fileInput").click(); };
  applyStaticI18n();
  renderStart();
  // The width breakpoints are classes now, so something has to set them before
  // the first paint — a saved size setting arrives later and a window that was
  // never resized fires no resize event at all.
  syncWidthStops();
  syncZoomRow();
  syncPartyPill();
  /* Das Kompaktfenster der App (Nachtraege N4) ist von Anfang an der
     Streifen: gleich beim ersten Zeichnen, nicht erst, wenn /api/state
     antwortet - sonst stuende einen Augenblick die Startseite darin. */
  if(KOMPAKT_FENSTER) kompaktFensterAuf();
}
