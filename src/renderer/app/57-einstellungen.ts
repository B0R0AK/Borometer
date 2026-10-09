import { BORO_VERSION, state } from "./01-state";
import { toast } from "./03-helpers";
import { t, tt } from "./08-translation";
import { $, esc } from "./18-interface-basics";
import { persistPref } from "./27-weapons-tab";
import { setLang } from "./31-static-translation";
import { kampfdateiLaden, kampfdateiSpeichern, klemme, setzeTrennung, switchTab } from "./34-menus-drop-and-tabs";
import { clampSee, clampUiZoom, kuerzelText, setSee, setUiZoom, winPost, ZOOM_MAX, ZOOM_MIN } from "./37-window-size-and-overlay";
import { setzeThema } from "./39-themes";
import { chooseServerDir, KOMPAKT_FENSTER, OWN_WINDOW, SERVED, serverDir } from "./41-server-mode";
import { sample } from "./40-sample-fight";
import { serverEinstNachfuehren } from "./42-party";
import { beispielGruppe, setzeEntwicklermodus, toggleChangelog } from "./43-more-menu-and-dev-mode";
import { isWatching } from "./45-startup";

/* ---------- Einstellungen (Neugestaltung 28.09., Luecken 10) ----------
   Ein Ort wie Start: state.einst zeigt section#einst statt Startseite und
   Kampf (renderAll in 32), ohne state.tab zu vergessen; switchTab("settings")
   fuehrt hin, ein Bereich, ein Kampf aus der Kampfwahl oder eine neue Datei
   hinaus. Hin fuehrt das Zahnrad unten in der Bereichsleiste (#btnEinst in
   der Titelleiste gibt es nur noch als Element). Im Kompakt gibt es den Ort
   nicht.
   EINE rollende Seite wie im Entwurf (E:919-966): links die Sprungleiste
   (#einstNav, haftet), rechts Titel und acht Abschnitte untereinander - im
   eigenen Fenster unter Windows neun, mit "Windows" vor Info -, jeder
   eine section mit h3 (der Titel ist h2, das h1 ist die Wortmarke). Ein
   Klick in der Leiste springt zum Abschnitt und setzt den Fokus auf seine
   Ueberschrift (einstSpringen); beim Rollen leuchtet der Abschnitt mit, der
   oben steht (einstMitleuchten). Die Zeilen stehen im Muster .ezeile > .ezt
   (Beschriftung, Satz) + .ezc (Bedienelement). Die festen Texte traegt das
   Markup (data-i18n); hier steht, was von der Umgebung abhaengt. */

/* Der Kopf: "Gilt sofort", und wo es gespeichert wird - nur, wenn die Seite
   vom Helfer kommt (persistPref schreibt dann nach /api/config). Den Pfad
   kennt die Seite nicht, also steht keiner da. Dazu die Version in Info. */
export function renderEinst(): void {
  const satz = t(SERVED ? "einst.kopfApp" : "einst.kopf");
  const p = $("#einstKopfSatz");
  if(p.textContent !== satz) p.textContent = satz;
  const ver = $("#einstVer");
  if(typeof BORO_VERSION !== "undefined" && ver.textContent !== BORO_VERSION) ver.textContent = BORO_VERSION;
}

/* ---------- die Bedienelemente ----------
   Vier Muster, die alle Abschnitte teilen:
   - Kacheln (.themen): die Themen als radiogroup, role=radio mit
     aria-checked und einem Tabstopp (Pfeiltasten waehlen), jede mit einer
     Vorschau in den Farben ihres Themas.
   - Segment (.seg.eseg): die Sprache, aria-pressed; die Wahl traegt .on.
   - Regler (.erng > input[type=range] + output): Name ueber
     aria-labelledby, die Ausgabe nennt den Wert mit geschuetztem Leerzeichen.
   - Schalter: <button type=button class=esw role=switch aria-checked
     aria-labelledby=...> mit <span class=esw-t aria-hidden> (Spur) und
     <span class=esw-w aria-hidden> (An/Aus); den Stand setzt esSchalter().
   Jede Zeile ruft die Setzfunktion, die auch das Menue oder der Knopf der
   Titelleiste ruft; die Setzfunktionen rufen am Ende einstNachfuehren(). So
   zeigen alle Orte immer denselben Stand, und es gibt nur einen Weg zu
   persistPref. Eigene Schluessel schreiben die Einstellungen nur diese:
   updatePruefen, den Schalter des Update-Hinweises, und die drei Schalter
   des Abschnitts Windows (unten). */

/** Ein Schalter im Muster .esw: Zustand und Wort (An/Aus) setzen. */
export function esSchalter(b: HTMLElement, an: boolean): void {
  const v = an ? "true" : "false";
  if(b.getAttribute("aria-checked") !== v) b.setAttribute("aria-checked", v);
  const w = b.querySelector(".esw-w");
  const wort = t(an ? "einst.an" : "einst.aus");
  if(w && w.textContent !== wort) w.textContent = wort;
}

/* Ein Regler, der gerade gezogen wird, behaelt seinen Wert unter der Hand. */
const ziehend = new Set<HTMLInputElement>();
function regler(id: string, wert: number){
  const r = document.getElementById(id) as HTMLInputElement | null;
  if(!r) return;
  if(!ziehend.has(r) && r.value !== String(wert)) r.value = String(wert);
  const o = r.nextElementSibling;
  const text = (ziehend.has(r) ? r.value : wert) + "\u00a0%";
  if(o && o.textContent !== text) o.textContent = text;
}

/* Ein Zahlenfeld: schreiben, nur wenn der Wert ein anderer ist - und nicht,
   solange darin getippt wird (Fokus und eine Eingabe seit dem letzten
   Setzen): sonst nimmt ein Nachfuehren von anderswo (Strg+Plus, der Takt
   des Helfers) die halbe Eingabe unter der Hand weg. Was nach Enter gilt,
   schreibt der Handler selbst (trennen in zeilenBinden). */
const getippt = new Set<HTMLInputElement>();
function zahlFeld(id: string, wert: number){
  const f = document.getElementById(id) as HTMLInputElement | null;
  if(!f || (getippt.has(f) && document.activeElement === f)) return;
  if(f.value !== String(wert)) f.value = String(wert);
}

/* Im Explorer zeigen (Nachtraege N1): die Seite schickt einen Schluessel,
   nie einen Pfad; der Helfer oeffnet den beobachteten Ordner, solange es
   ihn gibt. Das Oeffnen bestaetigt sich selbst, darum sagt die Seite dann
   nichts; geht es nicht (kein Ordner, keine Antwort), ein ruhiger Satz
   statt eines Fehlertons - "Ordner aendern" steht gleich daneben. */
async function explorerZeigen(){
  try{
    const r = await fetch("/api/folder/open", {method:"POST",
      headers:{"Content-Type":"application/json"}, body: JSON.stringify({folder:"game"})});
    const d = await r.json();
    if(d && d.ok) return;
  }catch{ /* keine Antwort: derselbe Satz */ }
  toast(tt("einst.explorerNicht"), 7000, "ruhig");
}

/* Log-Ordner: Ordner, Live, Trennung; Entwickler: der Schalter und die
   Beispielgruppe. Der Ordner gilt nur mit dem Helfer (SERVED, auch als Tab
   auf 127.0.0.1 - chooseServerDir geht dort genauso); ohne ihn oeffnet der
   Browser einzelne Dateien, und statt eines toten Knopfs steht der Satz.
   Live ist derselbe Umschalter wie in der Titelleiste (isWatching). */
function logsNachfuehren(){
  const bedien = $("#eOrdnerBedien");
  if(bedien.hidden === SERVED) bedien.hidden = !SERVED;
  const satz = $("#eOrdnerSatz"), browser = $("#eOrdnerBrowser");
  if(satz.hidden === SERVED) satz.hidden = !SERVED;
  if(browser.hidden !== SERVED) browser.hidden = SERVED;
  const pfad = serverDir || t("einst.ordnerKeiner");
  const o = $("#eOrdner");
  if(o.textContent !== pfad) o.textContent = pfad;
  o.classList.toggle("leer", !serverDir);
  esSchalter($("#eLive"), isWatching());
  zahlFeld("eGap", state.gap);
  zahlFeld("eMin", state.minDur);
  esSchalter($("#ePhasen"), state.mergePhases);
  esSchalter($("#eDev"), state.devMode);
  const bz = $("#eBeispielZeile");
  if(bz.hidden === state.devMode) bz.hidden = !state.devMode;
}

/* Der Update-Hinweis (Spezifikation Update-Hinweis 2.4): ein Schalter in
   Info, Standard aus; er schreibt updatePruefen nur als Wahrheitswert
   (persistPref, der Server nimmt nichts anderes). Gefragt wird allein im
   Hauptprozess, einmal je Start - das Einschalten wirkt also beim naechsten
   Start. Die Zeile gibt es nur mit dem Helfer (SERVED): ohne ihn gibt es
   keinen Hauptprozess, der fragen koennte. Den Stand bringt /api/config (41). */
let updateAn = false;
export function updateSchalterStand(an: boolean): void {
  updateAn = an;
  einstNachfuehren();
}
function updateNachfuehren(){
  const z = $("#eUpdateZeile");
  if(z.hidden === SERVED) z.hidden = !SERVED;
  esSchalter($("#eUpdatePruefen"), updateAn);
}

/* Windows (Windows-Einbindung 9, 3.4): nur im eigenen Fenster unter Windows
   (der Hauptprozess meldet windows.da; ein Tab am Helfer und das
   Kompaktfenster zeigen ihn nie). Melden ist der Hauptschalter,
   Nur-Bestwert sein Zusatz: bedienbar nur, solange Melden an ist
   (aria-disabled, der Klick tut dann nichts; er bleibt in der Tab-Folge,
   damit der Vorleser ihn findet). Schliessen in den Infobereich; den
   Autostart fuehrt Windows selbst (POST /api/win), der Schalter zeigt, was
   die Antwort sagt. Die drei anderen gehen nur als Wahrheitswert ueber
   persistPref nach /api/config. Den Stand bringt /api/config (41). */
function winSchalter(){
  const w = state.win;
  const da = !!w && w.da && SERVED && OWN_WINDOW && !KOMPAKT_FENSTER;
  const g = $("#eg-win"), nav = $("#einstNavWin");
  if(g.hidden === da) g.hidden = !da;
  if(nav.hidden === da) nav.hidden = !da;
  if(!w || !da) return;
  esSchalter($("#eWinMelden"), w.melden);
  const nb = $("#eWinNurBest");
  esSchalter(nb, w.nurBest);
  const gesperrt = w.melden ? "false" : "true";
  if(nb.getAttribute("aria-disabled") !== gesperrt) nb.setAttribute("aria-disabled", gesperrt);
  esSchalter($("#eWinTray"), w.tray);
  const az = $("#eWinAutoZeile");
  if(az.hidden === w.autostartDa) az.hidden = !w.autostartDa;
  esSchalter($("#eWinAuto"), w.autostart);
}

/* "Bewegung verringern" (DECISION 10.4): kein Schalter und kein Schluessel,
   nur die Anzeige, was Windows sagt - die App folgt prefers-reduced-motion
   ohnehin (die grosse Zahl zaehlt nicht hoch, Bildlaeufe springen). */
const ruhigMedia = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
function bewegungNachfuehren(){
  const w = t("einst.bewegungWert", {an: !!ruhigMedia && ruhigMedia.matches});
  const el = $("#eBewegung");
  if(el.textContent !== w) el.textContent = w;
}

/* Liest state und stellt jedes Bedienelement der Einstellungen neu; schreibt
   nur, was sich aendert. Die Setzfunktionen (setzeThema/applyTheme,
   setUiZoom, applySeeThrough, setLang, syncHotkeyNote, setzeTrennung,
   applyDevMode, setPinButton, syncLiveBtn, der Ordner in 41) rufen das am
   Ende. */
export function einstNachfuehren(): void {
  const einst = document.getElementById("einst");
  if(!einst) return;
  logsNachfuehren();
  updateNachfuehren();
  winSchalter();
  bewegungNachfuehren();
  serverEinstNachfuehren();
  // Thema: role=radio, aria-checked, ein Tabstopp auf dem gewaehlten
  einst.querySelectorAll<HTMLElement>("#eThema [role=radio]").forEach(b => {
    const on = b.dataset.theme === state.theme;
    const v = on ? "true" : "false";
    if(b.getAttribute("aria-checked") !== v) b.setAttribute("aria-checked", v);
    b.classList.toggle("on", on);
    b.tabIndex = on ? 0 : -1;
  });
  /* Rauchglas ohne Mica: leise, warum (Spezifikation 4.3). Im Browser weiss
     die Seite es selbst, im Fenster sagt es /api/state (data-mica-grund, 37). */
  const ohne = $("#eGlasOhne");
  const root = document.documentElement;
  const grund = state.theme !== "glas" || root.classList.contains("mica") ? ""
              : !(SERVED && OWN_WINDOW) ? "browser" : (root.dataset.micaGrund || "");
  const glasSatz = grund ? t("einst.glasOhne." + grund) : "";
  if(ohne.textContent !== glasSatz) ohne.textContent = glasSatz;
  if(ohne.hidden !== !glasSatz) ohne.hidden = !glasSatz;
  regler("eZoom", clampUiZoom(state.zoom));
  einst.querySelectorAll<HTMLElement>("#eSprache button").forEach(b => {
    const on = b.dataset.lang === state.lang;
    const v = on ? "true" : "false";
    if(b.getAttribute("aria-pressed") !== v) b.setAttribute("aria-pressed", v);
    b.classList.toggle("on", on);
  });
  /* Overlay betrifft das Fenster der App - wie #randlosNote nur im eigenen
     Fenster am Helfer. Im Browser ein Satz statt toter Regler. */
  const app = SERVED && OWN_WINDOW;
  einst.querySelectorAll<HTMLElement>(".nurapp").forEach(z => { if(z.hidden === app) z.hidden = !app; });
  const hinweis = $("#eFenstBrowser");
  if(hinweis.hidden !== app) hinweis.hidden = app;
  if(!app) return;
  regler("eSee", clampSee(state.seeThrough));
  // Ueber dem Spiel halten: derselbe Stand wie #btnPin (setPinButton)
  esSchalter($("#eOben"), $("#btnPin").getAttribute("aria-pressed") === "true");
  // Durchklickbar: derselbe Satz wie im Menue (frei oder belegt), die Tasten einzeln
  const satz = $("#hotkeyNote").textContent || "";
  const ks = $("#eKuerzelSatz");
  if(ks.textContent !== satz) ks.textContent = satz;
  const tasten = kuerzelText().split("+");
  const k = $("#eKuerzel");
  const html = tasten.map(x => "<kbd>" + esc(x) + "</kbd>").join("");
  if(k.innerHTML !== html){
    k.innerHTML = html;
    k.setAttribute("aria-label", tasten.join(" + "));
  }
}

/* Die Zeilen binden: jede ruft die Setzfunktion des Menues oder den Knopf,
   der dasselbe tut. */
function zeilenBinden(){
  const themen = [...document.querySelectorAll<HTMLButtonElement>("#eThema [role=radio]")];
  themen.forEach((b, i) => {
    b.onclick = () => setzeThema(b.dataset.theme!);
    // eine radiogroup: Pfeile waehlen und nehmen den Fokus mit
    b.onkeydown = e => {
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if(!d) return;
      e.preventDefault();
      const n = themen[(i + d + themen.length) % themen.length]!;
      setzeThema(n.dataset.theme!);
      n.focus();
    };
  });
  document.querySelectorAll<HTMLButtonElement>("#eSprache button").forEach(b =>
    b.onclick = () => setLang(b.dataset.lang!));
  /* Groesse: die Grenzen von setUiZoom. Waehrend des Ziehens nur die
     Ausgabe - die Seite unter der Hand zu vergroessern, verschoebe den
     Regler selbst -, beim Loslassen (und bei jeder Pfeiltaste) setUiZoom. */
  const zoom = $<HTMLInputElement>("#eZoom");
  zoom.min = String(ZOOM_MIN); zoom.max = String(ZOOM_MAX);
  zoom.oninput = () => { ziehend.add(zoom); regler("eZoom", Number(zoom.value)); };
  zoom.onchange = () => { ziehend.delete(zoom); setUiZoom(Number(zoom.value)); };
  /* Zurueck an denselben Wert gezogen: dann kommt kein change, und der
     Regler hinge sonst im Ziehen fest (Strg+Plus zoege nur die Ausgabe
     nach). Beim Loslassen einen Takt spaeter frei geben - ein change im
     selben Takt hat dann schon gegriffen und setUiZoom gerufen. */
  const loslassen = () => setTimeout(() => {
    if(!ziehend.delete(zoom)) return;
    einstNachfuehren();
  }, 0);
  zoom.addEventListener("pointerup", loslassen);
  zoom.addEventListener("lostpointercapture", loslassen);
  zoom.onblur = loslassen;
  /* Durchsicht wie #seeSlide im Kompakt-Menue: input still, change schreibt. */
  const see = $<HTMLInputElement>("#eSee");
  see.oninput = () => setSee(see.value, {quiet:true});
  see.onchange = () => setSee(see.value);
  /* Ueber dem Spiel halten und Overlay ansehen: die Knoepfe der Titelleiste
     (#btnPin heftet an, in der Vollansicht nur fuer die Sitzung; #btnCompact
     zeigt das Kompaktfenster). */
  $("#eOben").onclick = () => $("#btnPin").click();
  $("#eOverlay").onclick = () => $("#btnCompact").click();
  /* Log-Ordner: dieselben Funktionen wie das Filterfeld der Kampfwahl. Die
     Zahlen klemmt klemme() wie dort (mit demselben Hinweis). Live ist der
     Knopf der Titelleiste (im Browser und mit dem Helfer je sein Weg).
     "Im Explorer zeigen" steht mit "Ordner aendern" in #eOrdnerBedien und
     fehlt darum wie dieser ohne Helfer (Nachtraege N1). */
  $("#eOrdnerAendern").onclick = () => void chooseServerDir();
  $("#eOrdnerExplorer").onclick = () => void explorerZeigen();
  $("#eLive").onclick = () => $("#btnWatch").click();
  const gap = $<HTMLInputElement>("#eGap"), min = $<HTMLInputElement>("#eMin");
  /* Nach dem Setzen steht der geklemmte Wert im Feld, auch mit Fokus
     (zahlFeld laesst ein Feld mit Fokus in Ruhe). */
  const trennen = (f: HTMLInputElement, v: {gap?: number; minDur?: number}) => {
    getippt.delete(f);
    setzeTrennung(v);
    f.value = String(v.gap ?? v.minDur);
  };
  /* Beim Verlassen wieder dem Stand folgen: wer auf den alten Wert
     zuruecktippt, loest kein change aus, und ein Nachfuehren, das waehrend
     des Tippens uebersprungen wurde, bliebe sonst liegen (change kommt vor
     blur, ein gesetzter Wert steht dann schon im Stand). */
  for(const f of [gap, min]){
    f.oninput = () => getippt.add(f);
    f.onblur = () => { getippt.delete(f); einstNachfuehren(); };
  }
  gap.onchange = () => trennen(gap, {gap: klemme(gap, 1, 120, 8)});
  min.onchange = () => trennen(min, {minDur: klemme(min, 0, 120, 3)});
  $("#ePhasen").onclick = () => setzeTrennung({mergePhases: !state.mergePhases});
  $("#eSpeichern").onclick = () => void kampfdateiSpeichern();
  $("#eLaden").onclick = () => void kampfdateiLaden();
  /* Entwickler: Schalter, Beispiele und das Protokoll (Dialog) - dieselben
     Funktionen wie frueher im ⋯-Menue. Der Fehlerbericht steht seit 01.10.
     als "Fehler melden" in der Statusleiste (55); hier nur der Satz dazu. Der Beispielkampf verlaesst
     die Einstellungen wie jede neue Datei (loadText in 32). */
  $("#eDev").onclick = () => setzeEntwicklermodus(!state.devMode);
  $("#eBeispiel").onclick = () => beispielGruppe();
  $("#eBeispielkampf").onclick = () => sample();
  $("#eClog").onclick = () => toggleChangelog(true);
  $("#eUpdatePruefen").onclick = () => {
    updateAn = !updateAn;
    persistPref("updatePruefen", updateAn);
    einstNachfuehren();
  };
  $("#eWinMelden").onclick = () => {
    const w = state.win;
    if(!w) return;
    w.melden = !w.melden;
    persistPref("meldenKampf", w.melden);
    einstNachfuehren();
  };
  $("#eWinNurBest").onclick = () => {
    const w = state.win;
    if(!w || !w.melden) return;
    w.nurBest = !w.nurBest;
    persistPref("meldenNurBest", w.nurBest);
    einstNachfuehren();
  };
  $("#eWinTray").onclick = () => {
    const w = state.win;
    if(!w) return;
    w.tray = !w.tray;
    persistPref("trayBeimSchliessen", w.tray);
    einstNachfuehren();
  };
  $("#eWinAuto").onclick = () => {
    const w = state.win;
    if(!w) return;
    void winPost({do: "autostart", an: !w.autostart}).then(d => {
      if(!d || typeof d.autostart !== "boolean" || !state.win) return;
      state.win.autostart = d.autostart;
      einstNachfuehren();
    });
  };
  if(ruhigMedia) ruhigMedia.addEventListener("change", bewegungNachfuehren);
}

/* ---------- Sprungleiste und Mitleuchten ----------
   Der gewaehlte Knopf traegt aria-current. Ein Klick springt: der Abschnitt
   rollt unter die Titelleiste (scroll-margin-top in styles.css), der Fokus
   geht auf seine Ueberschrift - der Vorleser liest dann, wo man ist. Waehrend
   des Sprungs und danach, bis die Seite von dort wegrollt, bleibt der
   gewaehlte Abschnitt markiert: die letzten Abschnitte erreichen den oberen
   Rand nicht, und das Mitleuchten nennte sonst den letzten. Wohin der
   Sprung rollt, steht schon beim Klick fest (sprungZiel, begrenzt auf das
   Ende der Seite): solange die Seite auf dem Weg dorthin ist oder dort
   steht, bleibt die Markierung; rollt sie woandershin, gilt wieder das
   Mitleuchten. */
function markiere(k: string){
  document.querySelectorAll<HTMLButtonElement>("#einstNav button").forEach(b => {
    if(b.dataset.gruppe === k){ if(b.getAttribute("aria-current") !== "true") b.setAttribute("aria-current", "true"); }
    else if(b.hasAttribute("aria-current")) b.removeAttribute("aria-current");
  });
}
let gesprungen = false;
let sprungVon = 0, sprungZiel = 0;

/** Zum Abschnitt k der Einstellungen springen - auch von anderswo (der Weg
    aus dem Bereich Gruppe, #pZuEinst). */
export function einstSpringen(k: string): void {
  if(!state.einst) switchTab("settings");
  const h = document.getElementById("egh-" + k);
  if(!h) return;
  gesprungen = true;
  sprungVon = window.scrollY;
  const rand = parseFloat(getComputedStyle(h).scrollMarginTop) || 0;
  const unten = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  sprungZiel = Math.min(unten, Math.max(0, window.scrollY + h.getBoundingClientRect().top - rand));
  markiere(k);
  const ruhig = !!ruhigMedia && ruhigMedia.matches;
  h.scrollIntoView({block: "start", behavior: ruhig ? "auto" : "smooth"});
  h.focus({preventScroll: true});
}

/* Beim Rollen: der Abschnitt, dessen Anfang zuletzt unter der Titelleiste
   vorbeigerollt ist, leuchtet; ganz unten der letzte. Nur, solange die
   Einstellungen stehen, und nicht nach einem Sprung (siehe oben). */
function einstMitleuchten(){
  if(!state.einst) return;
  if(gesprungen){
    const y = window.scrollY;
    const unterwegs = (y - sprungVon) * (y - sprungZiel) <= 0 || Math.abs(y - sprungZiel) <= 4;
    if(unterwegs){ if(Math.abs(y - sprungZiel) <= 4) sprungVon = sprungZiel; return; }
    gesprungen = false;
  }
  // ein verborgener Abschnitt (Windows ausserhalb des eigenen Fensters) leuchtet nie
  const teile = [...document.querySelectorAll<HTMLElement>("#einst section.egruppe")].filter(s => !s.hidden);
  if(!teile.length) return;
  const kopf = document.querySelector("header.top")?.getBoundingClientRect().bottom ?? 0;
  let akt = teile[0]!.id.slice(3);
  for(const s of teile) if(s.getBoundingClientRect().top <= kopf + 90) akt = s.id.slice(3);
  const doc = document.documentElement;
  if(window.scrollY > 0 && window.scrollY + innerHeight >= doc.scrollHeight - 4) akt = teile[teile.length - 1]!.id.slice(3);
  markiere(akt);
}

export function einstBinden(): void {
  $("#btnEinst").onclick = () => switchTab("settings");
  zeilenBinden();
  $("#einstNav").onclick = e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-gruppe]");
    if(b) einstSpringen(b.dataset.gruppe!);
  };
  addEventListener("scroll", einstMitleuchten, {passive: true});
}
/* Beim Oeffnen der Einstellungen steht die Seite oben: dann gilt wieder das
   Mitleuchten, der erste Abschnitt leuchtet (switchTab rollt auf 0). */
export function einstOben(): void {
  gesprungen = false;
  einstMitleuchten();
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  einstBinden();
  renderEinst();
  einstNachfuehren();
}
