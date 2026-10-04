import { BORO_VERSION, PARTY_SKILLS, state } from "./01-state";
import { BORO_CHANGELOG } from "./02-changelog";
import { toast, toastFail } from "./03-helpers";
import { stats } from "./06-blocks-and-places";
import { t, tt } from "./08-translation";
import { SKILL_ID_NAME, SKILL_WEAPON } from "./10-skill-names";
import { weaponFor } from "./16-fight-analysis";
import { $, esc } from "./18-interface-basics";
import { renderRotation } from "./25-rotation";
import { persistPref } from "./27-weapons-tab";
import { schliesseAndereKopffenster, setGroup, syncBereiche } from "./34-menus-drop-and-tabs";
import { menueRaum } from "./36-dialog";
import { uiZoomFactor } from "./37-window-size-and-overlay";
import { KOMPAKT_FENSTER } from "./41-server-mode";
import { artenJe, partyEinsaetze, partyKurve, renderParty } from "./42-party";
import { einstNachfuehren } from "./57-einstellungen";
import { syncFelder } from "./58-felder";
import type { BoardRow } from "../types";

/* ---------- the ⋯ menu ---------- */
export function toggleMore(open?: boolean){
  state.moreOpen = open === undefined ? !state.moreOpen : open;
  const p = $("#morePanel");
  /* Hiding the panel while one of its items holds focus drops focus to
     <body>, and the next Tab starts again from the top of the document.
     Hand it back to the button that owns the menu - the same `held` check
     closeSelMenu() makes for the same reason. */
  const held = !state.moreOpen && p.contains(document.activeElement);
  p.hidden = !state.moreOpen;
  if(held) $("#btnMore").focus({preventScroll:true});
  $("#btnMore").setAttribute("aria-expanded", state.moreOpen ? "true" : "false");
  /* Im Kompaktfenster waechst das Fenster fuer das Menue und kehrt danach
     zurueck (Kompakt-Fix 01.10., 36) - im Streifen war es abgeschnitten. */
  menueRaum(state.moreOpen);
}

/* Welche Reiter zu sehen sind. Die Log-Einrichtung ist der einzige, der sich
   versteckt: im Entwicklermodus, wenn eine Spalte fehlt, oder solange sie
   offen ist - sonst verschwaende sie einem unter der Hand weg. */
/* Steht in diesem Kampf eine Faehigkeit ohne Waffe da? Dann gibt es im
   Waffenreiter etwas zu tun, und er zeigt sich von selbst. */
function waffenOffen(){
  const seg = state.encounters[state.sel];
  if(!seg || !seg.stats) return false;
  const sidOf = new Map();
  for(const e of seg.events) if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);
  return seg.stats.skills.some(k =>
    weaponFor(k.name, sidOf.get(k.name)) === "Unassigned");
}
/* fokusHielt geht an syncBereiche durch (renderAll): so setzt ein Durchlauf
   die Leiste einmal, nicht zweimal. */
export function syncTabs(fokusHielt?: boolean){
  const m = state.mapping || {};
  const rollenFehlen = !!state.parsed &&
        (state.noTime || m.damage == null || m.skill == null);
  const tb = document.querySelector<HTMLElement>('.tab[data-tab="setup"]');
  if(tb) tb.hidden = !state.devMode && !rollenFehlen && state.tab !== "setup";
  /* Der Waffenreiter, nach derselben Regel. Die Zuordnung ist inzwischen
     vollstaendig genug, dass ihn die meisten nie brauchen - aber sobald
     eine Faehigkeit ohne Waffe dasteht, ist er wieder da, denn dann
     stimmt die Aufteilung nach Waffe nicht. */
  const wb = document.querySelector<HTMLElement>('.tab[data-tab="weapons"]');
  if(wb) wb.hidden = !state.devMode && !waffenOffen() && state.tab !== "weapons";
  syncBereiche(fokusHielt);   // ein Bereich kam oder ging: Tabstopp und Auswahl neu
}

/* ---------- Entwicklermodus ----------
   Zwei Dinge brauchen 99% der Leute nie: die Log-Einrichtung und der
   CSV-Ausgang. Sie waren eine Zeit lang schlicht versteckt; das ist schlecht,
   weil sie dann fuer das eine Prozent gar nicht mehr da sind. Jetzt sind sie
   an ihrem alten Platz, und der Schalter in den Einstellungen holt sie
   hervor.

   Die Log-Einrichtung erscheint zusaetzlich von selbst, wenn eine Spalte
   fehlt, die gebraucht wird - mehrere Meldungen in der App verweisen auf sie
   ("setze eine unter Log-Einrichtung"), und ein Verweis auf einen Reiter, den
   es nicht gibt, waere schlimmer als ein Reiter zu viel. */
export function applyDevMode(){
  $("#btnCsv").hidden = !state.devMode;
  /* "Nach Waffe" ist ein Werkzeug zum Nachsehen, welche Faehigkeit welcher
     Waffe zugeschlagen wurde - im Spiel fragt niemand danach (Issue #53).
     Stand die Tafel darauf, als der Modus ausging, geht sie zurueck auf
     die Faehigkeiten, statt auf einem Knopf zu stehen, den es nicht gibt. */
  $("#segWeapon").hidden = !state.devMode;
  if(!state.devMode && state.group === "weapon") setGroup("skill");
  $("#pasteFold").hidden = !state.devMode;
  const fp = $("#miFakeParty"); if(fp) fp.hidden = !state.devMode;
  syncTabs();
  einstNachfuehren();
}
/* Der Schalter in den Einstellungen (Logs): ein Weg, ein Schluessel
   (devMode). Der Haken im ⋯-Menue ging mit Stufe 3. */
export function setzeEntwicklermodus(an: boolean){
  state.devMode = an;
  persistPref("devMode", state.devMode);
  applyDevMode();
}
/* Eine Gruppe zum Durchklicken. Jedes Mitglied bekommt einen anderen
   Kampf aus dem geladenen Log, durch dieselben Funktionen geschickt, die
   auch ueber die Leitung gehen - was dasteht, ist gemessen, nur der Name
   davor ist erfunden. Deshalb heissen sie auch "Beispiel A" ("Example A") und nicht wie
   echte Leute. */
/* Jedes Beispielmitglied bekommt ein anderes Waffenpaar. Sonst sehen
   drei Beispiele aus wie derselbe Spieler dreimal - sie kommen ja aus
   Kaempfen desselben Logs, also mit denselben Faehigkeiten. */
const BEISPIEL_PAARE = [["Greatsword", "Sword and Shield"],
                        ["Staff", "Wand and Tome"],
                        ["Dagger", "Crossbow"]];
/* Echte Faehigkeiten dieser beiden Waffen, abwechselnd und ohne
   Doppelte. Sie kommen aus der mitgelieferten Tabelle, stehen also in
   der Sprache der Oberflaeche und tragen ihr richtiges Symbol. */
function beispielSkills(paar: string[], n: number){
  const je = paar.map(w => {
    const aus = [], gesehen = new Set();
    for(const id in SKILL_WEAPON){
      if(SKILL_WEAPON[id] !== w) continue;
      const e = SKILL_ID_NAME[id];
      if(!e) continue;
      const name = e[state.lang] || e.en;
      if(!name || gesehen.has(name)) continue;
      gesehen.add(name);
      aus.push({name, sid: id});
    }
    return aus;
  });
  const raus = [], genommen = new Set();
  for(let i = 0; raus.length < n && i < 4 * n + 40; i++){
    const f = je[i % 2] || [], k = f[Math.floor(i / 2)];
    if(k && !genommen.has(k.name)){ genommen.add(k.name); raus.push(k); }
  }
  return raus;
}
/* Die Namen tauschen - in der Liste, in den Spuren der Kurve und in den
   Einsaetzen, damit ueberall dasselbe steht. Die groesste Spur bekommt
   die erste Faehigkeit der Hauptwaffe.

   Getauscht werden NUR die Namen. Schaden, Dauer, Treffer, Krits, die
   Kurve und die Einsaetze bleiben die gemessenen aus dem Kampf - nur
   steht jetzt ein anderer Name davor, so wie schon der Spielername ein
   anderer ist. */
function beispielUmbenennen(zeile: BoardRow, paar: string[]){
  const namen: string[] = [];
  /* "__other__" bleibt, wie es ist: das ist keine Faehigkeit, sondern
     alles unterhalb von Rang zwoelf zusammen. Ein Faehigkeitsname davor
     waere eine Behauptung. */
  const merke = (n: string) => { if(n && n !== "__other__" && namen.indexOf(n) < 0) namen.push(n); };
  (zeile.skills || []).forEach(k => merke(k.name));
  ((zeile.curve && zeile.curve.lanes) || []).forEach(l => merke(l.n));
  (zeile.casts || []).forEach(c => merke(c.n));
  const neu = beispielSkills(paar, namen.length), tausch = new Map();
  namen.forEach((n, i) => { if(neu[i]) tausch.set(n, neu[i]); });
  (zeile.skills || []).forEach(k => {
    const x = tausch.get(k.name); if(x){ k.name = x.name; k.sid = x.sid; } });
  ((zeile.curve && zeile.curve.lanes) || []).forEach(l => {
    const x = tausch.get(l.n); if(x){ l.n = x.name; l.sid = x.sid; } });
  (zeile.casts || []).forEach(c => {
    const x = tausch.get(c.n); if(x){ c.n = x.name; c.s = x.sid; } });
  zeile.weapons = paar.slice();
}
export function beispielGruppe(){
  /* Ein zweiter Klick raeumt sie wieder weg - sonst kaeme man ohne
     Neustart nicht zurueck in eine echte Gruppe. */
  if(state.party && state.party.demo){
    state.party = {role:null, code:"", join:"", address:"", board:[], target:"", error:""};
    state.zeigeMitglied = null;
    toast(tt("toast.demoPartyOff"));
    renderRotation();
    // der Bereich Gruppe und seine Kopfzeile zeigen es sofort (Luecken 7.9)
    if(state.tab === "party"){ renderParty(); syncFelder(); }
    return;
  }
  const lang = state.encounters
    .map((seg, i) => ({seg, i, st: seg.stats || (seg.stats = stats(seg))}))
    .filter(x => x.st.total > 0 && x.st.seconds >= 20)
    .sort((a, b) => b.st.total - a.st.total)
    .slice(0, 3);
  if(lang.length < 1){ toastFail(tt("toast.demoPartyNone")); return; }
  const buchstabe = ["A", "B", "C"];
  state.party = state.party || {role: null, code: "", join: "", address: "",
                                board: [], target: "", error: ""};
  state.party.board = lang.map((x, k) => {
    const st = x.st;
    const sidOf = new Map();
    for(const e of x.seg.events) if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);
    // die Trefferarten je Faehigkeit wie im Ernstfall (partyPayload), fuer das aufgeklappte Mitglied (Luecken 7.8)
    const arten = artenJe(x.seg);
    const zeile: BoardRow = {
      // der Schluessel bleibt "Beispiel A"; angezeigt in der Sprache der Oberflaeche (mitgliedName, 19)
      name: "Beispiel " + buchstabe[k],
      waiting: false,
      damage: Math.round(st.total), dps: Math.round(st.dps), hits: st.hits,
      crit: +st.critRate.toFixed(4), heavy: +st.heavyRate.toFixed(4),
      seconds: +st.seconds.toFixed(1), max: Math.round(st.max),
      skills: st.skills.slice(0, PARTY_SKILLS).map(kk => ({
        name: kk.name, sid: sidOf.get(kk.name) || "", damage: Math.round(kk.damage),
        dps: Math.round(kk.dps), hits: kk.hits, crit: kk.crit, heavy: kk.heavy,
        max: Math.round(kk.max), ...(arten(kk.name) ? {cats: arten(kk.name)!} : {})})),
      share: 0, onTarget: true, target: st.name, lang: state.lang,
      ventius: false, age: 0,
      /* Durch dieselben zwei Funktionen wie im Ernstfall. Der zweite
         Aufruf von partyKurve ist der, bei dem der Kampf als "steht"
         gilt und die Spuren mitgehen - genau wie ueber die Leitung. */
      /* Die Beispielgruppe traegt die Kurve selbst in der Zeile: sie
         kommt von keinem Server, es gibt also nichts nachzuholen. */
      hasCurve: true,
      curve: (partyKurve(x.seg), partyKurve(x.seg)),
      casts: partyEinsaetze(x.seg, true)
    };
    beispielUmbenennen(zeile, BEISPIEL_PAARE[k % BEISPIEL_PAARE.length]!);
    return zeile;
  });
  state.party.target = state.party.board[0]!.target;
  state.party.demo = true;   // haelt die Abfrage davon ab, sie zu ueberschreiben
  toast(tt("toast.demoParty", {n: state.party.board.length}));
  renderRotation();
  if(state.tab === "party"){ renderParty(); syncFelder(); }
}

/* The ⋯ menu used to carry a see-through-window switch. It is gone, because
   there is no setting of it worth offering: pywebview's transparent window is
   not see-through to the desktop here — it is see-through to the host form,
   which keeps its default light grey — so turning it on only makes every
   non-opaque pixel bleached instead of dark. Measured with the app's own
   window arguments over a known backdrop: a clear pixel photographs at
   240,240,240 and a 55%-black one at 108,108,108, neither of which is the
   198,190,172 that was actually behind the window.
   The config key still works for a machine whose stack composites it
   properly — see src/main/window.ts, where the window is built — it just no
   longer has a button that can spoil the overlay by accident. */

/* ---------- the list a select opens ----------
   One panel serves every select in the app, built from that select's own
   options at the moment it opens. The select stays the source of truth and
   keeps its value, its change event and its keyboard behaviour, so the parts
   that rebuild their options — the weapon rows, the column mapper — carry on
   without knowing this exists. */
const selMenu: { el: HTMLElement | null; src: HTMLSelectElement | null; at: number;
  watch: number; sig: string } = { el:null, src:null, at:-1, watch:0, sig:"" };

/* What the control is offering right now. Compared against the snapshot the
   panel was drawn from: a select whose options are replaced in place — the
   character filter is rebuilt and re-sorted by damage on every live tick —
   still passes isConnected, so that check alone cannot see the list move. */
const selMenuSig = (sel: HTMLSelectElement) => [...sel.options].map(o => o.value).join("");

function closeSelMenu(refocus: boolean){
  if(!selMenu.el) return;
  const src = selMenu.src;
  // the panel holds the focus while it is open, so it cannot simply be removed
  // out from under it — that would drop focus on the document body
  const held = selMenu.el.contains(document.activeElement);
  clearInterval(selMenu.watch);
  selMenu.el.remove();
  selMenu.el = null; selMenu.src = null; selMenu.at = -1; selMenu.watch = 0; selMenu.sig = "";
  if(src){
    src.classList.remove("selopen");
    if(refocus || held) src.focus();
  }
}

function selMenuRows(){
  return selMenu.el ? [...selMenu.el.querySelectorAll<HTMLButtonElement>(".so")] : [];
}

function markSelMenu(){
  const rows = selMenuRows(), menu = selMenu.el;
  rows.forEach((b,i) => {
    const on = i === selMenu.at;
    b.classList.toggle("at", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  const b = rows[selMenu.at];
  if(!menu) return;
  // Focus moves onto the entry itself, and that is the load-bearing part rather
  // than a nicety. Left on the select, the control stays a focused CLOSED select
  // as far as the engine is concerned, and keeps every key it owns: a letter runs
  // its type-ahead, PageUp/PageDown step it, F4 opens the browser's own list —
  // each one changing the value behind the panel, firing change, and leaving
  // Escape to "cancel" onto something already committed. With the focus in here
  // there is nothing behind the panel to drive, and a screen reader reads the
  // entry you are on instead of a collapsed control still reporting its old value.
  if(!b) return menu.focus({ preventScroll:true });
  b.focus({ preventScroll:true });
  // kept in view by hand: scrollIntoView would also scroll whatever the panel
  // is floating over, and the page underneath must not move while it is open
  if(b.offsetTop < menu.scrollTop) menu.scrollTop = b.offsetTop;
  else if(b.offsetTop + b.offsetHeight > menu.scrollTop + menu.clientHeight)
    menu.scrollTop = b.offsetTop + b.offsetHeight - menu.clientHeight;
}

function stepSelMenu(d: number){
  const rows = selMenuRows().map((b,i) => ({b,i})).filter(x => !x.b.disabled);
  if(!rows.length) return;
  let k = rows.findIndex(x => x.i === selMenu.at);
  k = k < 0 ? (d > 0 ? 0 : rows.length - 1) : (k + d + rows.length) % rows.length;
  selMenu.at = rows[k]!.i;
  markSelMenu();
}

function pickSelMenu(i: number){
  const sel = selMenu.src, row = selMenuRows()[i];
  if(!sel || !sel.isConnected) return closeSelMenu(false);
  // The row's own value decides, never its position. The character filter is
  // rebuilt and re-sorted by damage every couple of seconds while a fight runs,
  // so between drawing this list and clicking a name the third row may well be
  // somebody else. Resolving by value picks the name that was clicked, or — if
  // that name has left the log — nothing at all, which is the honest outcome.
  const k = row ? [...sel.options].findIndex(o => o.value === row.dataset.v) : i;
  const opt = sel.options[k];
  if(!opt || opt.disabled) return closeSelMenu(false);
  const changed = sel.selectedIndex !== k;
  sel.selectedIndex = k;
  closeSelMenu(true);
  if(changed) sel.dispatchEvent(new Event("change", { bubbles:true }));
}

function openSelMenu(sel: HTMLSelectElement){
  closeSelMenu(false);
  const opts = [...sel.options];
  // nothing to choose from, or a control on a tab that is not showing
  const r = sel.getBoundingClientRect();
  if(!opts.length || !r.width) return;

  const menu = document.createElement("div");
  menu.className = "selmenu";
  menu.setAttribute("role", "listbox");
  menu.tabIndex = -1;
  const label = sel.id && document.querySelector('label[for="'+sel.id+'"]');
  if(label) menu.setAttribute("aria-label", label.textContent);
  // tabindex -1: focusable by hand, but not a stop on the way through the page.
  // Without it a twelve-weapon list would add twelve Tab stops at the end of the
  // document, and a row could hold the focus ring while Enter committed a
  // different one. data-v carries the value, because the index cannot be trusted.
  menu.innerHTML = opts.map((o,i) =>
    '<button type="button" tabindex="-1" class="so'+(o.selected ? " on" : "")+'"'+
    ' role="option" aria-selected="'+(o.selected ? "true" : "false")+'"'+
    ' data-i="'+i+'" data-v="'+esc(o.value)+'"'+
    (o.disabled ? " disabled" : "")+' title="'+esc(o.textContent)+'">'+
    esc(o.textContent)+"</button>").join("");
  document.body.appendChild(menu);

  // width follows the control, so the list reads as that control opening up
  /* Dieselbe Mischung wie beim Zeiger: r, innerWidth und innerHeight sind
     gemalt, width, left und top werden in Layoutpunkten gesetzt, und
     offsetHeight ist eine Layouthoehe. Ohne die Umrechnung war das Menue bei
     200 Prozent doppelt so breit wie sein Bedienelement und sass am doppelten
     Abstand. Die Hoehe wird fuer den Vergleich hochgerechnet, weil die andere
     Seite des Vergleichs gemalt ist. */
  const z = uiZoomFactor();
  menu.style.width = (r.width / z) + "px";
  menu.style.left = (Math.max(6, Math.min(r.left, innerWidth - r.width - 6)) / z) + "px";
  const h = menu.offsetHeight * z;
  menu.style.top = ((r.bottom + 4 + h <= innerHeight || r.top - 4 - h < 0)
    ? (r.bottom + 4) / z
    : (r.top - 4 - h) / z) + "px";

  selMenu.el = menu; selMenu.src = sel; selMenu.at = sel.selectedIndex;
  selMenu.sig = selMenuSig(sel);
  sel.classList.add("selopen");
  markSelMenu();

  const pickFrom = (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".so");
    if(b) pickSelMenu(+b.dataset.i!);
  };
  menu.addEventListener("click", pickFrom);
  // Press, drag down the list, release — how a Windows list is used. That
  // sequence produces no click on the row: the press landed on the select, so
  // the click is dispatched at the nearest ancestor the two have in common,
  // which is the body. The release is what has to be listened for. Picking
  // twice is harmless — the first one closes the panel and the second returns
  // at its own guard.
  menu.addEventListener("mouseup", pickFrom);

  // A live-logging tick rebuilds these rows every few seconds. When it takes
  // the control away — or swaps the list underneath — the panel goes with it,
  // rather than hanging over the page pointing at something that is no longer
  // there. A timer rather than a frame callback, because frames stop while the
  // window is hidden and this is the path that tidies up.
  selMenu.watch = setInterval(() => {
    if(selMenu.el !== menu) return clearInterval(selMenu.watch);
    if(!sel.isConnected || selMenuSig(sel) !== selMenu.sig) closeSelMenu(false);
  }, 200);
}

/* ---------- changelog ---------- */
export function renderChangelog(){
  $("#clogVer").textContent = "v" + BORO_VERSION;
  const entries = BORO_CHANGELOG[state.lang] || BORO_CHANGELOG.en;
  // the build you just installed is the one you came to read; the rest is
  // reference, a row each until you ask for it
  $("#clogBody").innerHTML = entries.map((entry,i) =>
    '<div class="clogv'+(i ? "" : " open")+'">'+
      '<h4><button type="button" class="clogtop" aria-expanded="'+(i ? "false" : "true")+'">'+
        "v"+esc(entry.v)+
        '<span class="rule"></span>'+
        '<span class="n">'+esc(t("clog.changes",{n:entry.notes.length}))+"</span>"+
        '<span class="chev">▾</span>'+
      "</button></h4><ul>"+
      entry.notes.map(n => "<li>"+esc(n)+"</li>").join("")+
    "</ul></div>"
  ).join("");
  $("#clogBody").querySelectorAll<HTMLElement>(".clogtop").forEach(b => b.onclick = () => {
    const box = b.closest(".clogv")!, open = box.classList.toggle("open");
    b.setAttribute("aria-expanded", open ? "true" : "false");
  });
}
/* The dialog used to open with focus still on <body>: its own Close button
   was the 61st tab stop, behind every control on the page it covers. */
let clogPrev: HTMLElement | null = null;
export function toggleChangelog(open: boolean){
  const on = open === undefined ? !$("#clogBg").classList.contains("on") : open;
  if(on){ renderChangelog(); clogPrev = document.activeElement as HTMLElement | null; }
  $("#clogBg").classList.toggle("on", on);
  if(on) $("#clogClose").focus({preventScroll:true});
  else if(clogPrev && document.contains(clogPrev)){
    clogPrev.focus({preventScroll:true}); clogPrev = null;
  }
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  $("#btnMore").onclick = e => {
    e.stopPropagation(); schliesseAndereKopffenster("more"); toggleMore();
  };
  $("#miFakeParty").onclick = () => { toggleMore(false); beispielGruppe(); };
  addEventListener("click", e => {
    if(state.moreOpen && !(e.target as HTMLElement).closest(".moremenu")) toggleMore(false);
  });
  addEventListener("keydown", e => { if(e.key === "Escape" && state.moreOpen) toggleMore(false); });
  /* Das Kompaktfenster verliert den Fokus - ein Klick ins Spiel: das Menue
     geht zu, und das Fenster ist wieder nur der Streifen. Das Spiel liegt
     sonst unter einem offenen Menue, das niemand mehr ansieht. */
  addEventListener("blur", () => { if(KOMPAKT_FENSTER && state.moreOpen) toggleMore(false); });
  document.addEventListener("mousedown", e => {
    const sel = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest("select");
    // primary button only, the way a native list behaves. Gated on the branch and
    // not on the whole handler, so a right-click elsewhere still dismisses an open
    // list instead of leaving it standing.
    if(sel && !sel.disabled && e.button === 0){
      e.preventDefault();            // the browser's own list never gets to open
      if(selMenu.src === sel){ closeSelMenu(true); return; }
      sel.focus();
      openSelMenu(sel);
      return;
    }
    if(selMenu.el && !selMenu.el.contains(e.target as Node)) closeSelMenu(false);
  });
  /* Capture, so Escape closes the list without also reaching the Escape handlers
     that would close the panel the select is sitting in. */
  addEventListener("keydown", e => {
    if(selMenu.el){
      // Focus is leaving by the one route that does not go through a mouse press.
      // Close first and do not cancel the key, so the focus lands where the user
      // aimed it — and so the next control's own keys are not still being eaten
      // by a panel hanging over the page.
      if(e.key === "Tab"){ closeSelMenu(true); return; }
      if(e.ctrlKey || e.altKey || e.metaKey) return;   // window and app shortcuts pass
      const keys = ["Escape","ArrowDown","ArrowUp","Home","End","Enter"," ","F4"];
      // Everything else is swallowed rather than let through: while this panel is
      // up it is the only thing allowed to move the selection.
      if(!keys.includes(e.key)){ e.preventDefault(); return; }
      e.preventDefault(); e.stopImmediatePropagation();
      if(e.key === "Escape" || e.key === "F4") closeSelMenu(true);
      else if(e.key === "ArrowDown") stepSelMenu(1);
      else if(e.key === "ArrowUp") stepSelMenu(-1);
      else if(e.key === "Home"){ selMenu.at = -1; stepSelMenu(1); }
      else if(e.key === "End"){ selMenu.at = -1; stepSelMenu(-1); }
      else pickSelMenu(selMenu.at);
      return;
    }
    const sel = document.activeElement as HTMLSelectElement | null;
    // F4 and Alt+Up open a native list on Windows just as Alt+Down does; all of
    // them open this one instead, or the browser's would appear over it
    if(sel && sel.tagName === "SELECT" && !sel.disabled &&
       (e.key === "Enter" || e.key === " " ||
        (!e.altKey && !e.ctrlKey && e.key === "F4") ||
        (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")))){
      e.preventDefault();
      openSelMenu(sel);
    }
  }, true);
  // the panel is anchored to where the control was, so anything that moves it closes it
  addEventListener("scroll", e => {
    if(selMenu.el && !selMenu.el.contains(e.target as Node)) closeSelMenu(false);
  }, true);
  addEventListener("resize", () => closeSelMenu(false));
  // Tab stays inside the dialog while it is open - there is nothing behind
  // the scrim a reader can act on.
  $("#clogBg").addEventListener("keydown", e => {
    if(e.key !== "Tab") return;
    const f = [...$("#clog").querySelectorAll("button")].filter(b => b.offsetParent);
    if(!f.length) return;
    const first = f[0]!, last = f[f.length - 1]!;
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
  $("#clogClose").onclick = () => toggleChangelog(false);
  $("#clogBg").onclick = e => { if((e.target as HTMLElement).id === "clogBg") toggleChangelog(false); };
  addEventListener("keydown", e => { if(e.key === "Escape" && $("#clogBg").classList.contains("on")) toggleChangelog(false); });
}
