import { kurvePasst } from "../glutring-core";
import { PARTY_SKILLS, SERIES_N, seriesColor, state } from "./01-state";
import { factLine, fmt, toast, toastFail } from "./03-helpers";
import { stats } from "./06-blocks-and-places";
import { t, tt } from "./08-translation";
import { weaponLabel } from "./09-weapon-icons";
import { learnFromBoard } from "./10-skill-names";
import { skillMark } from "./11-skill-icons";
import { skillIcon } from "./12-boss-images";
import { hitCatLabel, skillLabel } from "./14-questlog-weapons";
import { casts, VENTIUS_ID, VENTIUS_NAME, ventiusTargetKey } from "./15-weapons-and-ventius";
import { perSecond, weaponFor } from "./16-fight-analysis";
import {
  className, classNameFor, iPlayVentius, noteVentius, partyClass, partyClassIsVentius, rowOnTarget, sameTarget
} from "./17-class-names";
import { $, esc } from "./18-interface-basics";
import { catOf, HIT_CATS, mitgliederMerken, mitgliedIndex, mitgliedName, notePartyFights } from "./19-grouping-and-party-fights";
import { renderHead } from "./20-meter-head";
import { renderBars } from "./21-damage-table";
import { renderRotation } from "./25-rotation";
import { persistConfig, renderWeapons } from "./27-weapons-tab";
import { renderAll } from "./32-history";
import { setGroup, switchTab } from "./34-menus-drop-and-tabs";
import { askConfirm } from "./36-dialog";
import { KOMPAKT_FENSTER, SERVED } from "./41-server-mode";
import { einstSpringen } from "./57-einstellungen";
import { syncFelder } from "./58-felder";
import type {
  BoardRow, CombatEvent, Encounter, Fight, MemberCurve, PartyCasts, PartyCurve, PartyView,
  RebuiltEvent
} from "../types";

let lastReport = "";

/* Die Kurve dieses Kampfes, in der Form, die renderStack (24) verbraucht.
   Nicht gerechnet, sondern weitergereicht: perSecond() hat es schon
   getan, und zweimal dieselbe Rechnung an zwei Stellen ist zweimal die
   Gelegenheit, verschiedene Zahlen zu bekommen.

   Gemessen an einem Kampf mit 98 Sekunden und elf Spuren: die
   Gesamtreihe allein 628 Bytes, mit allen Spuren 3.607. Die Meldung
   selbst ist heute 2.984 Bytes gross. */
let kurveEnde = 0;   // das seg.end, das der letzte Bericht gesehen hat
let kurveStand = false;   // stand der Kampf bei der letzten Kurve schon?
export function partyKurve(seg: Fight): PartyCurve | undefined {
  if(!seg || state.noTime) return undefined;
  const ps = perSecond(seg, 12);
  if(!ps || !ps.T) return undefined;
  const sidOf = new Map();
  for(const e of seg.events) if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);
  const ganz = (v: number[]) => v.map(x => Math.round(x));
  /* Waehrend ein Kampf laeuft geht nur die Gesamtreihe mit, die Spuren erst,
     wenn er steht. Gemessen am laengsten Kampf im eigenen Log - 466
     Sekunden, zwoelf Spuren - sind das 2.273 statt 17.967 Bytes, und
     gesendet wird alle drei Sekunden. Sobald seg.end sich nicht mehr
     bewegt, ist der Kampf vorbei: dann gehen die Spuren einmal mit, und
     danach aendert sich die Kennung des Berichts ohnehin nicht mehr, also
     wird gar nichts mehr geschickt. */
  const steht = seg.end === kurveEnde;
  kurveEnde = seg.end;
  kurveStand = steht;   // die Einsaetze haengen an derselben Bedingung
  return {
    /* Die Wanduhr, nicht der Index. Zwei Leute segmentieren ihre Logs
       unabhaengig; ohne gemeinsamen Nullpunkt liegen zwei Kurven um
       Sekunden versetzt uebereinander und behaupten etwas Falsches. */
    t0: state.wall ? seg.start : null,
    T: ps.T,
    total: ganz(ps.total),
    /* Alle Spuren, auch die Sammelspur "__other__": ohne sie fehlte
       im Kampf des anderen genau der Schaden, den sie traegt - seine
       Kurve wird beim Empfaenger aus den Spuren gebaut, nicht aus der
       Gesamtreihe. (Hier stand ein Filter auf sr.rest; die Reihen aus
       perSecond haben dieses Feld nicht, er tat also nichts.) */
    lanes: steht ? ps.series.map(sr => ({
      n: sr.name, sid: sidOf.get(sr.name) || "", v: ganz(sr.values)
    })) : undefined
  };
}
/* Die Einsaetze dieses Kampfes, fuer die Rotation der anderen. Wie bei
   der Kurve nicht nachgerechnet: casts() hat sie schon gebildet.
   Erst wenn der Kampf steht - die Rotation eines halben Kampfes hat
   niemand gefragt, und waehrenddessen waere sie jede Meldung anders. */
export function partyEinsaetze(seg: Fight, steht: boolean): PartyCasts[] | undefined {
  if(!seg || state.noTime || !steht) return undefined;
  const c = casts(seg);
  if(!c || !c.size) return undefined;
  const sidOf = new Map();
  for(const e of seg.events) if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);
  const raus: PartyCasts[] = [];
  /* Zwoelf, so viele wie die Kurve Spuren hat und die Tafel Namen
     traegt. Einsaetze zu schicken, die drueben keine Zeile bekommen,
     kostet Bytes und erzeugt zwei verschiedene Saetze - hier stand
     "301 Einsaetze von 11", drueben "260 von 10". */
  for(const k of (seg.stats.skills || []).slice(0, PARTY_SKILLS)){
    const liste = c.get(k.name);
    if(!liste || !liste.length) continue;
    raus.push({n: k.name, s: sidOf.get(k.name) || "",
      c: liste.map(x => [Math.round(x.t - seg.start), Math.round((x.last || x.t) - seg.start),
                         Math.round(x.dmg), x.hits, x.crit || 0])});
  }
  return raus.length ? raus : undefined;
}
function partyPayload(){
  const seg = state.encounters[0];
  if(!seg) return null;
  // Only report fights that happened after you joined. Without this, the
  // moment anyone hosts or joins, their client pushes whatever fight was
  // already loaded from their log — often hours old — and everyone sees a
  // board full of stale fights from before the party existed. seg.start is
  // wall-clock ms when the log carries a real clock; when it doesn't
  // (state.wall false), there's nothing trustworthy to compare against, so
  // report normally rather than silently showing nobody.
  if(state.partySince && state.wall && seg.start < state.partySince) return null;
  const s = seg.stats;
  const sidOf = new Map();
  for(const e of seg.events) if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);
  const artenVon = artenJe(seg);
  return {
    target: s.name,
    /* Derselbe Gegner heisst auf einem deutschen und einem englischen Client
       verschieden, und der Server vergleicht Zeichenketten. Der Schluessel
       daneben ist die Antwort darauf: er ist fuer beide Schreibweisen
       derselbe, und jeder Leser - Server wie Client - kann damit entscheiden,
       wer wirklich auf demselben Boss steht. Ein Leser, der ihn nicht kennt,
       verliert nichts: target steht unveraendert daneben. */
    targetKey: ventiusTargetKey(s.name),
    /* Die Kurve je Sekunde. Der Server reicht sie durch, ohne
       hineinzusehen - er tut das mit dem ganzen Paket.
       Die Reihenfolge zaehlt: partyKurve setzt kurveStand, und die
       Einsaetze lesen ihn. */
    curve: partyKurve(seg),
    casts: partyEinsaetze(seg, kurveStand),
    // Which language these skill names are written in. The game names skills
    // in the client's own language, so the same id reaches the board under two
    // spellings in a mixed party — and that pair is exactly the evidence the
    // shipped dictionary demands before an id gets a translation. Saying so
    // outright is cheaper and safer than guessing which language a string is.
    lang: state.lang,
    damage: Math.round(s.total), dps: Math.round(s.dps), hits: s.hits,
    crit: +s.critRate.toFixed(4), heavy: +s.heavyRate.toFixed(4),
    seconds: +s.seconds.toFixed(1), max: Math.round(s.max),
    /* crit und heavy sind ANZAHLEN, nicht Raten - so zaehlt sie stats(),
       und so ist gefragt worden: "wie viele Crits, Stark". Dazu der
       groesste Treffer. Drei Zahlen je Faehigkeit, hoechstens zwoelf
       Faehigkeiten: das ist die Groesse einer Meldung wert, und ohne sie
       bleiben drei Spalten leer, sobald jemand eine Zeile aufklappt. */
    skills: s.skills.slice(0,PARTY_SKILLS).map(k => ({
      name:k.name, sid:sidOf.get(k.name)||"", damage:Math.round(k.damage),
      dps:Math.round(k.dps), hits:k.hits,
      crit:k.crit, heavy:k.heavy, max:Math.round(k.max),
      cats:artenVon(k.name)
    }))
  };
}
/* Die Trefferarten je Faehigkeit eines Kampfes, mit denselben fuenf
   Schluesseln, die catOf() beim eigenen Schaden vergibt. Kurze Feldnamen,
   weil das alle drei Sekunden ueber die Leitung geht: k, h, d, m. Auch die
   Beispielgruppe (43) traegt sie so. */
export function artenJe(seg: Fight): (name: string) => {k: string; h: number; d: number; m: number}[] | undefined {
  const arten = new Map<string, Map<string, {h: number; d: number; m: number}>>();
  for(const e of seg.events){
    let je = arten.get(e.skill);
    if(!je){ je = new Map(); arten.set(e.skill, je); }
    const kat = catOf(e);
    let c = je.get(kat);
    if(!c){ c = {h: 0, d: 0, m: 0}; je.set(kat, c); }
    c.h++; c.d += e.dmg; if(e.dmg > c.m) c.m = e.dmg;
  }
  return (name: string) => {
    const je = arten.get(name);
    if(!je || je.size < 2) return undefined;   // alles derselbe Treffer
    return HIT_CATS.filter(k => je.has(k)).map(k => {
      const c = je.get(k)!;
      return {k, h: c.h, d: Math.round(c.d), m: Math.round(c.m)};
    });
  };
}
export function sendReport(force: boolean){
  /* Der Gruppe meldet nur die Vollansicht (N4, Pruefung W4): der Streifen hat
     einen eigenen Stand, oft ohne Kampf, und die Tafel spraenge hin und her. */
  if(!SERVED || KOMPAKT_FENSTER || !state.party.role) return;
  const p = partyPayload();
  /* Having nothing to report is itself a report. Falling silent left the host
     holding the last fight until it timed out, so a cleared list still read
     "Fighting Ramux — 1 player reporting" with no fight loaded and nobody
     fighting anything. Sending null puts the row back to waiting at once and
     lets the shared target be recomputed without it. */
  /* Beside the payload, not inside it: `waiting` on the board means "has sent
     no fight", and the whole point of showing a party's make-up is seeing who
     tanks and who heals BEFORE the pull, while everyone is still waiting. The
     weapons are a property of the player, not of a fight. */
  const w = (state.mainWeapon && state.offWeapon) ? [state.mainWeapon, state.offWeapon] : null;
  /* Beside the weapons for the same reason they sit beside the payload: which
     build you are actually playing is a property of you, not of a fight, and
     the board is read while everyone is still waiting. A reader on an older
     server falls back to the skill list in the report. */
  const v = iPlayVentius();
  /* Ob die Spuren dabei sind, gehoert in die Kennung: partyKurve haengt sie
     erst beim zweiten Bericht mit demselben seg.end an, und der hat sonst
     dieselbe Kennung wie der erste - Spuren und Einsaetze gingen nie mit.
     Danach bleibt "L" stehen, die Kennung also gleich: sie gehen einmal. */
  const sig = (p ? p.target + "|" + p.seconds + "|" + p.damage : "—") + "|" +
              (w ? w.join("+") : "") + "|" + (v ? "V" : "") + "|" +
              (p && p.curve && p.curve.lanes ? "L" : "");
  if(sig === lastReport && !force) return;
  lastReport = sig;
  fetch("/api/party/report", {method:"POST", headers:{"Content-Type":"application/json"},
    // the two weapon keys, not a class name: every reader resolves it into
    // their own language, the same reason `lang` rides along with the skills
    body: JSON.stringify({payload:p, weapons:w, ventius:v})}).catch(() => {});
}
/* Jeder Abruf bekommt eine Nummer. Kommt eine alte Antwort nach einer
   neueren an, wird sie verworfen - sonst gewinnt der langsamere Abruf.
   Gemessen: mit 900 ms Verzoegerung auf den ersten Klick und 120 ms
   Abstand zum zweiten zeigte die App den ERSTEN Namen. */
let kurveLauf = 0;
function kurveStempel(row: BoardRow){
  return [row.damage || 0, row.seconds || 0, row.hits || 0].join("|");
}
/* Die Kurve, die zu DIESER Zeile passt - oder nichts. Nie eine alte
   Kurve zu neuen Zahlen: segVonMitglied ueberschreibt Schaden, Dauer
   und DPS mit denen der Zeile, und dann stuende ein Bild unter Zahlen,
   die nicht dazu gehoeren. */
function kurveVon(row: BoardRow): MemberCurve | null {
  if(!row) return null;
  /* Eine Tafel von einem aelteren Server, eine gespeicherte Aufnahme
     oder die Beispielgruppe traegt die Kurve noch selbst. */
  if(row.curve && row.curve.T) return {curve: row.curve, casts: row.casts};
  const k = state.mitgliedKurven.get(row.name);
  return (k && k.stempel === kurveStempel(row)) ? k : null;
}
function kurveHolen(row: BoardRow){
  if(!SERVED || !row || !row.name) return Promise.resolve(null);
  const stempel = kurveStempel(row);
  // POST: die Frage geht vom Hauptprozess weiter an den Gruppenserver
  return fetch("/api/party/curve", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({name: row.name})})
    .then(r => r.json())
    .then((a): MemberCurve | null => {
      if(!a || !a.ok || !a.curve || !a.curve.T) return null;
      const k: MemberCurve = {stempel, curve: a.curve, casts: a.casts};
      state.mitgliedKurven.set(row.name, k);
      return k;
    })
    .catch((): null => null);
}
/* Sieht jemand gerade den Kampf eines anderen an und meldet der
   inzwischen einen neuen, dann wird die Kurve nachgeholt. Bis sie da
   ist, zeichnet spurAbschnitt nichts - ein Bild aus der alten Kurve
   unter den neuen Zahlen waere erfunden. */
/* Wer eine Kurve hat, aendert sich mit den Meldungen der anderen.
   pollParty zeichnet den Zeitverlauf und die Rotation nicht neu - die
   Reihe "Wessen" erschien deshalb erst, wenn zufaellig etwas anderes
   ein Neuzeichnen ausloeste. Steht der eigene Kampf still, war das
   nie. Neu gezeichnet wird nur, wenn die Namen sich wirklich
   geaendert haben. */
let werStand = "";
function werPruefen(){
  const jetzt = mitgliedZeilen().map(r => r.name).join("|");
  if(jetzt === werStand) return;
  werStand = jetzt;
  renderRotation();
}
function kurveNachziehen(){
  const wer = state.zeigeMitglied;
  if(!wer || state.kurveLaedt) return;
  const row = ((state.party && state.party.board) || []).find(r => r.name === wer);
  if(!row || kurveVon(row)) return;
  if(!row.hasCurve) return;
  const meins = ++kurveLauf;
  state.kurveLaedt = wer;
  kurveHolen(row).then(() => {
    if(meins !== kurveLauf) return;
    state.kurveLaedt = null;
    renderRotation();
  });
}

/* Die Kurven der Gruppe fuer das Rennen (65, Spezifikation Gruppenkurven 4.1).
   Hoechstens elf Abrufe je Klick - zwoelf in einem Raid, ohne dich -, einer
   nach dem anderen ueber kurveHolen, wie "Wessen". Gefragt wird nur, wer auf
   der lebenden Tafel eine Kurve hat; was schon zur Tafelzeile passt, kommt aus
   dem Speicher. Zurueck kommt nur, was zur GEZEIGTEN Zeile passt: der Server
   haelt je Mitglied nur die neueste Kurve, ein frueherer Pull hat andere
   Zahlen. */
const GRUPPE_ABRUFE = 11;
export async function gruppenKurvenHolen(zeilen: readonly {name: string; damage?: number | null; seconds?: number | null}[],
                                         ohne: string): Promise<Map<string, PartyCurve>> {
  const raus = new Map<string, PartyCurve>();
  const tafel = (state.party && state.party.board) || [];
  let abrufe = 0;
  for(const z of zeilen){
    if(z.name === ohne) continue;
    const row = tafel.find(r => r.name === z.name);
    if(!row) continue;
    let k = kurveVon(row);
    if(!k && row.hasCurve && abrufe < GRUPPE_ABRUFE){ abrufe++; k = await kurveHolen(row); }
    if(k && kurvePasst(k.curve, z)) raus.set(z.name, k.curve);
  }
  return raus;
}

function segVonMitglied(row: BoardRow){
  const k = kurveVon(row);
  if(!k || !k.curve || !k.curve.T) return null;
  const c = k.curve;
  const start = c.t0 || 0;
  const ev: RebuiltEvent[] = [];
  (c.lanes || []).forEach(l => {
    (l.v || []).forEach((d, i) => {
      if(!(d > 0)) return;
      ev.push({t: start + i * 1000, dmg: d, skill: l.n, sid: l.sid || "",
               crit: false, heavy: false, target: row.target || ""});
    });
  });
  /* Ohne Spuren gibt es nur die Gesamtreihe - der Kampf des anderen laeuft
     also noch. Dann traegt eine einzige namenlose Spur die Kurve, damit
     das Bild nicht leer bleibt und trotzdem nichts behauptet wird. */
  if(!ev.length && (c.total || []).length){
    c.total.forEach((d, i) => {
      if(d > 0) ev.push({t: start + i * 1000, dmg: d, skill: row.target || "?",
                         sid: "", crit: false, heavy: false, target: row.target || ""});
    });
  }
  if(!ev.length) return null;
  ev.sort((a, b) => a.t - b.t);
  // rebuilt from the curve: only time, damage, skill, crit and target are known
  const roh: Encounter = {start, end: start + c.T * 1000, events: ev as CombatEvent[], fremd: row.name};
  const seg: Fight = Object.assign(roh, {stats: stats(roh)});
  /* Die gemeldeten Zahlen gewinnen. Die nachgebauten Ereignisse haben
     einen je Sekunde, also waeren Treffer, Krits und groesster Treffer
     daraus frei erfunden. */
  const st = seg.stats;
  st.name = row.target || st.name;
  st.total = row.damage != null ? row.damage : st.total;
  st.seconds = row.seconds != null ? row.seconds : st.seconds;
  st.dps = row.dps != null ? row.dps : st.dps;
  st.hits = row.hits != null ? row.hits : st.hits;
  st.max = row.max != null ? row.max : st.max;
  if(Array.isArray(row.skills) && row.skills.length){
    st.skills = row.skills.map((k, i) => Object.assign({}, k, {
      color: seriesColor(i), rest: i >= SERIES_N,
      damage: k.damage || 0, hits: k.hits || 0,
      crit: k.crit || 0, heavy: k.heavy || 0, max: k.max || 0,
      dps: k.dps || 0
    }));
  }
  if(Array.isArray(k.casts) && k.casts.length){
    const m = new Map();
    k.casts.forEach(e => m.set(e.n, (e.c || []).map(x => ({
      t: start + x[0], last: start + x[1], dmg: x[2], hits: x[3], crit: x[4] || 0}))));
    seg.castsFest = m;
  }
  return seg;
}
/* Die Reihe "wessen Kampf". Dieselbe Bauart wie "Glaettung" daneben.
   Steht nur da, wenn jemand in der Gruppe eine Kurve gemeldet hat -
   eine Reihe mit einem einzigen Knopf namens "Ich" waere eine Frage
   ohne zweite Antwort. */
/* `wort`: die Frage der Reihe - "Wessen Rotation" wie im Entwurf (Luecken
   3.12). Seit Aufgabe 10 steht der Zeitverlauf unter der Zeitleiste, und die
   eine Reihe ueber der Rotation gilt fuer beide (vorher hatte er "Wessen"). */
export function renderWer(id: string, wort: string){
  const box = $("#" + id);
  if(!box) return;
  const andere = mitgliedZeilen();
  /* Versteckt wird der Traeger, wo es einen gibt: in der Rotation liegt
     die Reihe in einer eigenen .rotbar (#rotWhoBar). */
  const traeger = $("#" + id + "Bar") || box;
  traeger.hidden = !andere.length;
  if(!andere.length) return;
  const knopf = (wert: string | null, wort: string, an: boolean, laedt?: boolean) =>
    '<button class="wbtn' + (an ? " on" : "") + '" data-wer="' + esc(wert) +
    '" aria-pressed="' + (an ? "true" : "false") +
    /* Die drei Punkte sieht man; aria-busy ist dasselbe fuer jemanden,
       der die Seite vorgelesen bekommt. */
    (laedt ? '" aria-busy="true' : "") + '">' + esc(wort) + "</button>";
  /* Die Reihe sagt, wozu ihre Knoepfe gehoeren. Ohne das hoert eine
     Vorlesesoftware "Ich, nicht gedrueckt" ohne die Frage davor. */
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", t(wort));
  box.innerHTML = '<span class="rotlabel">' + esc(t(wort)) + "</span>" +
    /* Auf einem Gleis wie Spuren und Glaettung daneben: auch das hier ist
       eine Wahl, von der genau eine gilt. */
    '<span class="gleis">' +
    knopf("", t("chart.whoseMe"), !state.zeigeMitglied) +
    /* Drei Punkte hinter dem Namen, solange seine Kurve unterwegs ist -
       sonst sieht ein Klick aus, als waere nichts passiert. */
    andere.map(r => knopf(r.name, mitgliedName(r.name) + (state.kurveLaedt === r.name ? " \u2026" : ""),
                          state.zeigeMitglied === r.name,
                          state.kurveLaedt === r.name)).join("") +
    "</span>";
}

function mitgliedZeilen(){
  const b = (state.party && state.party.board) || [];
  /* Der eigene Name steht im Feld auf dem Gruppenreiter - die eigene
     Kurve braucht niemand aus der Tafel, die steht ohnehin da. */
  const ich = (($<HTMLInputElement>("#pName") || {value: ""}).value || "").trim();
  /* Eine gespeicherte Aufnahme kann nichts nachholen: dort zaehlt nur,
     was wirklich mitgespeichert wurde. Live genuegt das Kennzeichen. */
  const fest = !!(state.party && state.party.frozen);
  return b.filter(r => r.name !== ich &&
    (fest ? !!(r.curve && r.curve.T) : !!(r.hasCurve || (r.curve && r.curve.T))));
}
/* Der Abschnitt, den die beiden Diagramme zeichnen: meiner oder ein
   fremder. Faellt auf den eigenen zurueck, sobald der andere aus der
   Tafel verschwindet. */
export function spurAbschnitt(){
  const eigen = state.encounters[state.sel];
  if(!state.zeigeMitglied) return eigen;
  const row = ((state.party && state.party.board) || [])
    .find(r => r.name === state.zeigeMitglied);
  const fremd = row ? segVonMitglied(row) : null;
  if(fremd) return fremd;
  /* Die Kurve wird gerade nachgeholt, weil derselbe Name einen neuen
     Kampf gemeldet hat. Der Name bleibt gewaehlt und es steht nichts
     da - der eigene Kampf unter fremdem Namen waere falsch. */
  if(row && state.kurveLaedt === row.name) return null;
  state.zeigeMitglied = null; return eigen;
}

/* ---------- party history ----------
   A single snapshot in a bug report only shows where things ended up —
   it can't show a member flickering on and off the board, which is
   exactly the shape most real party bugs take (see the majority-target
   bug in the changelog). This keeps a short, bounded log of what actually
   changed, poll to poll, so a bug report can show the sequence of events
   instead of one frozen moment. Capped at 40 entries — long enough to
   cover a "something felt wrong a minute ago" report, short enough that
   it can never grow into something worth worrying about on its own. */
/* "Aran", "Aran und Bo", "Aran, Bo und Cy" — the conjunction comes from the
   dictionary because the two languages put a comma in different places. */
function nameList(names: string[]){
  if(names.length < 2) return names[0] || "";
  return names.slice(0, -1).join(", ") + " " + t("common.and") + " " + names[names.length - 1];
}
/* Ein Kampflog von Throne and Liberty traegt genau einen Angreifer - ueber
   die 92 Logs auf diesem Rechner nachgezaehlt, kein einziges Mal zwei. Der
   eine ist dein Charakter. Sind es doch mehrere, hat jemand die Logs seiner
   Gruppe zusammengelegt, und dann ist keiner davon "du". */
const logChar = () => state.players.length === 1 ? state.players[0] : null;

/* ---------- das Waffenpaar aus dem Kampf ----------

   Welche Waffe zu einer Faehigkeit gehoert, liest die App laengst selbst:
   SKILL_WEAPON, 303 Faehigkeits-IDs auf zehn Waffen, ueber 92 Logs deckt das
   99,987 Prozent des Schadens ab. Elf Werte stehen in der Tabelle, aber der
   elfte ist "Passive" und keine Waffe: 297 IDs liegen auf den zehn Waffen,
   sechs auf Passive. Hier stand "300 auf elf Waffen", beides nachgezaehlt
   und beides falsch. Von Hand kam bis 0.64 nur das PAAR oben -
   einmal gesetzt, und dann fuer jeden Charakter dasselbe.

   Nachgemessen an denselben 92 Logs, 68 Bosskaempfen: in 64 Kaempfen feuern
   genau zwei Waffen, in vier drei, in keinem nur eine. Das Paar aus einem
   einzelnen Bosskampf stimmt in 66 von 68 Faellen mit dem des ganzen Logs
   ueberein; die zwei Ausreisser sind zweimal derselbe Boss in derselben
   Datei. Die zweite Waffe faellt in keinem Bosskampf unter 4,32 Prozent, im
   Mittel liegt sie bei 14,5.

   Drei Prozent als Schwelle, nicht null: darunter steht keine Waffe, die
   jemand traegt, sondern ein Rest - ein Satzbonus, eine Sammlung, eine
   Faehigkeit aus einem frueheren Bau. Gemessen war der kleinste echte Wert
   4,32 Prozent, der groesste Rest 0,2. Dazwischen ist Platz. */
export const AUTO_OFF_MIN = 3;

/* Geteilt wird durch den GANZEN Schaden des Kampfes, Passiv und
   Unzugewiesen eingerechnet - genau der Nenner, den die Waffentabelle eine
   Karte weiter unten benutzt. Vorher rechnete diese Funktion ohne beide, und
   dann standen 95,7 % in der Herkunftszeile ueber 95,3 % in der Tabelle,
   vierzig Pixel auseinander, fuer dieselbe Tatsache.

   Zaehlen als Waffe tun Passiv und Unzugewiesen trotzdem nicht: ein
   Satzbonus ist keine Waffe, die jemand traegt. Sie stehen nur im Nenner.
   Die Schwelle AUTO_OFF_MIN meint damit dieselbe Zahl, die danebensteht. */
function weaponShares(seg: Fight){
  const je = new Map();
  let ges = 0;
  for(const ev of seg.events){
    ges += ev.dmg;
    const w = weaponFor(ev.skill, ev.sid);
    if(w === "Passive" || w === "Unassigned") continue;
    je.set(w, (je.get(w) || 0) + ev.dmg);
  }
  return [...je.entries()].sort((a, b) => b[1] - a[1])
          .map(([w, d]) => ({w, p: ges ? 100 * d / ges : 0}));
}

/* Ein Kampf waechst, waehrend er laeuft. Sein Name und der Zeitpunkt seines
   ersten Treffers tun das nicht - daran erkennt der Livelauf denselben Kampf
   ueber die Sweeps hinweg wieder. */
export function fightKey(seg: Fight){
  return (seg.events[0] ? seg.events[0].t : 0) + "|" + seg.stats.name;
}

export function autoPair(seg: Fight){
  if(!seg || !seg.events.length) return null;
  const teile = weaponShares(seg);
  if(!teile.length) return null;
  const k = fightKey(seg);
  if(state.autoSeen.key !== k) state.autoSeen = {key: k, weapons: []};
  const dabei = state.autoSeen.weapons;
  teile.forEach((x, i) => {
    if((i === 0 || x.p >= AUTO_OFF_MIN) && dabei.indexOf(x.w) < 0) dabei.push(x.w);
  });
  const zwei = teile.filter(x => dabei.indexOf(x.w) >= 0).slice(0, 2);
  return {main: zwei[0] ? zwei[0].w : "", off: zwei[1] ? zwei[1].w : "", teile};
}

/* Wem die Handauswahl gehoert. Sie gehoert zum Charakter und nicht zur App:
   der eine Charakter spielt Armbrust und Langbogen, der andere
   Grossschwert und Schwert und Schild. Ein einziges gespeichertes Paar hiesse, dass die Wahl des
   einen beim anderen stehen bleibt. Traegt ein Log mehrere Angreifer, hat
   jemand Logs zusammengelegt und keiner davon ist "du" - dann der leere
   Schluessel. */
function weaponOwner(){ return logChar() || ""; }

/* Die Handauswahl des Charakters in diesem Log, oder null. Die
   Bauerkennung liest sie so, wie readWeaponPair() sie liest: die eigene
   Wahl gewinnt. (Den Teil nennt dieser Kommentar mit Absicht nicht beim
   Namen - safety-audit.mjs prueft, dass die Gruppe ihn nicht kennt.) */
export function handPair(): { main: string; off: string } | null {
  const h = state.weaponPick[weaponOwner()];
  return h && h.main ? {main: String(h.main), off: String(h.off || "")} : null;
}

export function readWeaponPair(){
  const seg = state.encounters[state.sel];
  state.autoRead = seg ? autoPair(seg) : null;
  const hand = state.weaponPick[weaponOwner()];
  state.weaponByHand = !!hand;
  if(hand){
    state.mainWeapon = hand.main || "";
    state.offWeapon = hand.off || "";
  } else if(state.autoRead){
    state.mainWeapon = state.autoRead.main;
    state.offWeapon = state.autoRead.off;
  }
  meldeCharwechsel();
}

/* Wer den Charakter wechselt, faengt eine neue Logdatei an - nachgezaehlt an
   92 Dateien, der eine Charakter in 89, der andere in 3, nie beide in
   derselben. Der Waechter nimmt ohnehin immer die neueste Datei, also stellt
   sich das Paar von allein um. Gesagt wird es trotzdem.

   Nur aus einem beobachteten Log: eine von Hand geoeffnete Datei kann die
   eines Clanmitglieds sein, und "neuer Charakter" waere dann falsch. */
function meldeCharwechsel(){
  if(state.origin !== "watch") return;
  const wer = logChar();
  if(!wer) return;
  if(state.lastChar && state.lastChar !== wer){
    const paar = pairText();
    toast(() => t("weapons.newChar", {name: wer}) + " " +
          (paar ? t("weapons.newCharPair", {pair: paar}) : t("weapons.newCharNone")), 7000);
  }
  state.lastChar = wer;
}

/* Mit Komma und nicht mit "und": zwei der elf Waffen heissen selbst "Schwert
   und Schild" und "Zauberstab und Foliant". "Schwert und Schild und
   Grossschwert" liest sich wie drei Sachen. */
function pairText(){
  const a = state.mainWeapon ? weaponLabel(state.mainWeapon) : "";
  const b = state.offWeapon ? weaponLabel(state.offWeapon) : "";
  if(!a) return "";
  return b ? a + ", " + b : a;
}

/* Die eigene Wahl gewinnt - dieselbe Regel, die weaponFor() fuer einzelne
   Faehigkeiten schon hat. Sie wird gespeichert, damit sie den naechsten
   Start ueberlebt, und sie gilt nur fuer diesen Charakter. */
export function setWeaponByHand(welche: string, wert: string){
  const wer = weaponOwner();
  const e = state.weaponPick[wer] ||
            {main: state.mainWeapon || "", off: state.offWeapon || ""};
  e[welche] = wert;
  state.weaponPick[wer] = e;
  persistConfig();
  readWeaponPair(); renderWeapons();
  sendReport(true);   // auf der Tafel stehen die Waffen neben dem Namen
}
export function clearWeaponByHand(){
  delete state.weaponPick[weaponOwner()];
  persistConfig();
  readWeaponPair(); renderWeapons();
  sendReport(true);
}

function followCharSwitch(){
  const p: Partial<PartyView> = state.party || {};
  if(!p.role){ state.partyChar = null; return; }
  /* Nur aus einem beobachteten Log. Ein von Hand geoeffnetes kann das eines
     Clanmitglieds sein - dann hiesse man auf der Tafel wie der andere. Und
     wer eine Gruppe sucht und dann sein Log startet, hat ohnehin genau
     diesen Fall: das Log laeuft mit. */
  if(state.origin !== "watch") return;
  const jetzt = logChar();
  if(!jetzt) return;
  /* Die Tafel steht schon richtig. */
  if(p.name === jetzt){ state.partyChar = jetzt; return; }
  /* Schon einmal gefragt und nicht durchgekommen - nicht bei jeder Runde
     erneut fragen und dabei jedes Mal dieselbe Meldung zeigen. */
  if(state.partyChar === jetzt) return;
  const alt = p.name;
  state.partyChar = jetzt;
  fetch("/api/party/rename", {method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({name: jetzt})}).then(r => r.json()).then(d => {
      if(d.ok && d.changed){
        logParty("board name: " + alt + " \u2192 " + jetzt + " (from the log)");
        lastReport = "";            // der naechste Bericht geht unter dem neuen Namen
        toast(tt("party.renamed", {neu: jetzt}));
      } else if(d.error === "server too old"){
        logParty("could not rename " + alt + " to " + jetzt + ": party server too old");
        toastFail(tt("party.renameOldServer", {alt: alt}));
      }
    }).catch(() => {});
}
function logParty(line: string){
  state.partyLog.push({t: new Date().toISOString(), line});
  if(state.partyLog.length > 40) state.partyLog.shift();
}
function diffPartyState(prev: PartyView | null, next: PartyView){
  const wasIn = !!(prev && prev.role), isIn = !!(next && next.role);
  const justEntered = !wasIn && isIn;
  if(justEntered) logParty((next.role==="host"?"started hosting, code ":"joined room ")+next.code);
  else if(wasIn && !isIn) logParty("left the party");
  else if(wasIn && isIn && prev.code !== next.code) logParty("room changed: "+prev.code+" \u2192 "+next.code);

  if(isIn && (next.error||null) !== (prev && prev.error || null) && next.error)
    logParty("party error: "+next.error);

  // Nicht auf die Schreibweise hoeren, sondern auf den Gegner: derselbe Boss
  // unter zwei Namen ist kein Zielwechsel und gehoert nicht ins Protokoll.
  if(isIn && (next.target||"") !== (prev && prev.target || "") && prev && prev.role
     && !sameTarget(next.target || "", prev.target || ""))
    logParty("shared target changed: "+(prev.target||"\u2014")+" \u2192 "+(next.target||"\u2014"));

  if(!isIn) return;
  const before = new Map((prev && prev.board || []).map(r => [r.name, r]));
  const after = new Map((next.board || []).map(r => [r.name, r]));
  // Joining a room that already has people in it is not the same as those
  // people arriving — logging "X appeared" for each would read as a flurry
  // of joins that never happened. One honest summary line instead.
  if(justEntered){
    const names = [...after.keys()];
    if(names.length) logParty("already in the room: "+names.join(", "));
    return;
  }
  const joined = [];
  for(const [name, r] of after){
    const was = before.get(name);
    if(!was){
      logParty(name+" appeared"+(r.waiting?" (waiting)":""));
      // not yourself: on the tick you enter, the server may not have your own
      // push yet, so you turn up as new on the next one and would be announced
      // to yourself
      if(name !== next.name) joined.push(name);
    }
    else if(was.waiting && !r.waiting) logParty(name+" started reporting "+(r.target||next.target||"a fight"));
    // Beide Seiten mit demselben Massstab, sonst meldet das Protokoll einen
    // Wechsel, den nur die Sprache des Clients erzeugt hat.
    else if(rowOnTarget(was, prev && prev.target) && !rowOnTarget(r, next.target))
      logParty(name+" went off the shared target");
    else if(!rowOnTarget(was, prev && prev.target) && rowOnTarget(r, next.target))
      logParty(name+" back on the shared target");
  }
  for(const [name] of before) if(!after.has(name)) logParty(name+" dropped off the board");

  /* Say who arrived, on screen and not only in the party log. Everyone in the
     room learns it at the same time, wherever they are in the app — you are
     watching the meter when someone joins, not the setup tab.
     One notice for the whole tick rather than one per name: the toast is a
     single element, so three arrivals in the same three-second poll would
     leave only the third one readable. */
  if(joined.length)
    toast(tt("party.someoneJoined", {who:nameList(joined), n:joined.length}));
}

export async function pollParty(){
  if(!SERVED) return;
  /* Auch die Beispielgruppe aus dem Entwicklermodus bleibt stehen. Ohne
     das hier ueberschrieb die naechste Abfrage - alle drei Sekunden - das
     Board mit dem leeren vom Server, und die Knoepfe unter "Wessen"
     verschwanden nach einem Augenblick wieder. Im Browser faellt das nicht
     auf, weil pollParty dort an SERVED scheitert und nie so weit kommt. */
  if(state.party && state.party.demo) return;
  if(state.party && state.party.frozen) return;   // viewing a saved snapshot — live polling would immediately overwrite it
  try{
    const s = await (await fetch("/api/party/state")).json();
    // The host removed us and the helper has already left the room. Said once,
    // here rather than in renderParty, because the party tab is usually not
    // the one open when it happens.
    if(s.error === "removed" && !state.wasKicked){
      state.wasKicked = true;
      // The code is still in the old state — carry it into the join field so
      // coming back is one button rather than asking the host to read four
      // characters out again. Removing somebody is mostly how you un-stick
      // them, and the way back has to be as short as the way out.
      const back = (state.party && state.party.code) || "";
      if(back && $("#pJoin")) $<HTMLInputElement>("#pJoin").value = back;
      logParty(t("party.wereKickedLog"));
      toastFail(tt(back ? "party.wereKickedRejoin" : "party.wereKicked"), 9000);
    }
    if(s.role) state.wasKicked = false;
    learnFromBoard(s.board);
    // here and not in renderParty: the party tab is usually not the open one
    // during a pull, and a board nobody looked at still happened
    noteVentius(s.board);
    notePartyFights(s.board);
    diffPartyState(state.party, s);
    state.party = s;
    kurveNachziehen();
    werPruefen();
    // hier und nicht in sendReport: erst jetzt steht fest, unter welchem
    // Namen die Tafel uns fuehrt
    followCharSwitch();
    if(s.role) sendReport(false);
    if(state.tab === "party") renderParty();
    if(state.group === "party"){ renderHead(); renderBars(); }
    syncPartyPill();
  }catch(err){ /* helper busy, try again next tick */ }
}

export function syncPartyPill(){
  if(typeof syncPartySwitch === "function") syncPartySwitch();
  const pill = $("#partyPill"), dot = $("#partyTabDot");
  const p: Partial<PartyView> = state.party || {};
  const active = SERVED && p.role;
  const viewable = active || p.frozen;   // a loaded snapshot has no role, but is still worth showing
  pill.classList.toggle("on", !!active && !p.error);
  pill.classList.toggle("err", !!active && !!p.error);
  $("#partyPillText").textContent = p.frozen ? t("party.snapshotPillText")
    : !active ? t("tabs.party")
    : p.role === "host" ? t("party.headerHosting",{code:p.code}) : t("party.headerIn",{code:p.code});
  dot.hidden = false;   // always present; the colour says whether a party is live
  /* Neugestaltung 28.09. (DECISION 0.14): in der Titelleiste der Vollansicht
     steht die Pille nur bei laufender Gruppe (oder einem geladenen
     Gruppen-Log); der Weg zur Gruppe ist sonst der Eintrag der
     Symbolleiste. Im Kompaktstreifen bleibt sie (styles.css). */
  pill.classList.toggle("ohnegruppe", !viewable);
  pill.setAttribute("aria-pressed", state.group === "party" ? "true" : "false");

  // the grouping option only exists while there is party content to show —
  // live or a loaded snapshot — and if that content goes away while it's
  // selected, fall back rather than leave the table stuck on a dead group
  $("#segParty").hidden = !viewable;
  if(!viewable && state.group === "party"){
    state.group = "skill";
    [...$("#groupSeg").children as HTMLCollectionOf<HTMLElement>].forEach(c => {
      const an = c.dataset.g === "skill";
      c.classList.toggle("on", an);
      c.setAttribute("aria-pressed", an ? "true" : "false");
    });
    renderAll();
  }
}

// what renderParty last said, so it says each thing once
var partyFehlerGesagt: string | undefined, partyZaehlungGesagt: unknown;
/* ---------- der Bereich Gruppe (Neugestaltung 28.09., Luecken 7) ----------
   Ohne Gruppe zwei Wege nebeneinander: "Gruppe starten" (auf diesem PC oder
   dem eigenen Server) und "Gruppe beitreten" (Code, optional die Adresse),
   "Dein Charakter" als Zeile ueber beiden (DECISION 7.4); darunter nur der
   Satz, wie man eine startet - das Beispiel-Board gibt es nur ueber den
   Entwicklermodus (DECISION 7.9, beispielGruppe in 43). Laeuft eine Gruppe
   (oder steht ein Beispiel, ein geladenes Gruppen-Log), das Board zuerst
   (Feinschliff 6, 02.10.: die zweite Mitgliederliste entfiel, Initiale und
   Alter stehen in der Zeile, die Wege zugeklappt darunter): links im Kopf
   Code, Status nach Lage, Gruppen-Log speichern und Verlassen (DECISION
   7.10), rechts die Tabelle, je Mitglied aufklappbar mit
   seinen zwoelf Faehigkeiten und deren Trefferarten (Spezifikation 2,
   Korrektur: das Board liefert sie, cats). Farben je Mitglied aus der
   Reihe der Serien, bunt nach #34. */

/** Wo eine neue Gruppe laufen soll; null folgt dem eingetragenen Gruppen-Server. */
let wo: "pc" | "server" | null = null;
const woJetzt = () => wo ?? (state.partyServer ? "server" : "pc");
/* Wer aufgeklappt ist ("Name") und welche Faehigkeit ("Name|Faehigkeit");
   gilt in der Sitzung. Das eigene Mitglied steht beim ersten Blick offen. */
const aufMitglied = new Set<string>(), aufArt = new Set<string>();
let eigenesGeoeffnet = "";

/** Was die Kopfzeile im Bereich Gruppe nennt (58-felder.ts). */
export function gruppeKontext(): string {
  const p: Partial<PartyView> = state.party || {};
  if(p.demo) return t("party.ctxBeispiel");
  if(p.frozen) return t("party.snapshotPillText");
  if(SERVED && p.role) return t("party.ctxLaeuft", {code: p.code || ""});
  return t("party.ctxOhne");
}

/* Ein Stueck Markup nur neu schreiben, wenn es sich geaendert hat: renderParty
   laeuft mit jedem Abruf (alle drei Sekunden) und jedem Durchlauf unter Live.
   Stand der Fokus darin, geht er an dasselbe Bedienelement im neuen Markup. */
function tausche(el: HTMLElement, html: string){
  if(el.dataset.marke === html) return;
  const a = document.activeElement;
  const schluessel = a instanceof HTMLElement && el.contains(a)
    ? ["data-kick", "data-auf", "data-art", "data-zukampf", "id"].map(k => a.hasAttribute(k) ? "[" + k + '="' + CSS.escape(a.getAttribute(k) || "") + '"]' : "").find(Boolean) || "" : "";
  el.innerHTML = html;
  el.dataset.marke = html;
  if(schluessel) el.querySelector<HTMLElement>(schluessel)?.focus({preventScroll: true});
}

/* Die Reihenfolge der Mitglieder: wer meldet, nach DPS; wer wartet, danach.
   Die Farbe haengt nicht daran, sondern am Namen (mitgliedIndex, 19) -
   dieselbe in Initiale, Marke, Spur und in der Gruppenansicht im Kampf. */
function reihe(board: BoardRow[]): BoardRow[] {
  return board.slice().sort((a, b) => Number(!!a.waiting) - Number(!!b.waiting) || (b.dps || 0) - (a.dps || 0) || a.name.localeCompare(b.name));
}
const reihenFarbe = (i: number) => "var(--series-" + (i % SERIES_N + 1) + ")";
/* Die Initiale aus dem Teil, der die Mitglieder unterscheidet (Feinschliff 6):
   beginnen alle Namen mit denselben Woertern ("Beispiel A", "Beispiel B"),
   zaehlt das erste Wort danach - sonst stuenden zweimal "B" nebeneinander. */
function initialen(namen: string[]): Map<string, string> {
  const woerter = namen.map(n => n.trim().split(/\s+/));
  let k = 0;
  if(namen.length > 1) while(woerter.every(w => w.length > k + 1 && w[k] === woerter[0]![k])) k++;
  /* Der erste Buchstabe, gross; Satzzeichen, Ziffern und Emoji davor
     zaehlen nicht ("[Ruf]" -> "R"). Ohne Buchstaben "?". */
  const erster = (x: string) => { const b = /\p{L}/u.exec(x); return b ? [...b[0].toLocaleUpperCase()][0]! : ""; };
  return new Map(namen.map((n, i) => [n, erster(woerter[i]![k] || "") || erster(n) || "?"]));
}
export const waffenText = (w: string[] | undefined) => (w || []).filter(x => x && x !== "Passive" && x !== "Unassigned").map(weaponLabel).join("/");
const anteil = (x: number | null | undefined, n: number) => x == null || !n ? "\u2013" : Math.round(100 * x / n) + "\u00a0%";

export function renderParty(){
  syncPartyPill();
  const p: Partial<PartyView> = state.party || {};
  const board = p.board || [];
  const laeuft = !!(SERVED && p.role);
  const zeigt = laeuft || ((!!p.demo || !!p.frozen) && board.length > 0);
  $("#pWege").hidden = laeuft;
  $("#pOhne").hidden = zeigt;
  $("#pBoard").hidden = !zeigt;
  wegePlatz(zeigt && !laeuft);
  if(!laeuft) renderWege();
  if(zeigt) renderBoard(p, board, laeuft);
  // die Kopfzeile nennt den Stand der Gruppe (58-felder.ts, gruppeKontext)
  if(state.tab === "party") syncFelder();
}

/* Feinschliff 6 (02.10.): steht ein Board (Beispiel, geladenes Gruppen-Log),
   kommt es zuerst; Charakter und die zwei Wege stehen dann zugeklappt darunter
   (#pWegeAuf, ein details: Enter und Leertaste klappen, der Vorleser hoert
   "zugeklappt"). Ohne Board stehen die Wege wie bisher oben vor dem Satz.
   Umgehaengt wird nur beim Wechsel - der Abruf alle drei Sekunden klappt
   nichts zu und nimmt keinem Feld den Fokus. */
function wegePlatz(unten: boolean){
  const wege = $("#pWege"), auf = $<HTMLDetailsElement>("#pWegeAuf");
  auf.hidden = !unten;
  if(unten && wege.parentElement !== auf){ auf.open = false; auf.append(wege); }
  else if(!unten && wege.parentElement === auf){ auf.open = false; $("#pOhne").before(wege); }
}

/* ---------- die zwei Wege ---------- */
function renderWege(){
  const server = woJetzt() === "server";
  document.querySelectorAll<HTMLElement>("#pWo [role=radio]").forEach(b => {
    const an = b.dataset.wo === (server ? "server" : "pc");
    b.setAttribute("aria-checked", String(an));
    b.tabIndex = an ? 0 : -1;
  });
  $("#pServerZeile").hidden = !server;
  $("#pServerSatz").hidden = !server;
  const feld = $<HTMLInputElement>("#pServer");
  if(document.activeElement !== feld && !feld.dataset.getippt) feld.value = state.partyServer || "";
  /* Der Host lauscht auf allen Netzen (party.ts, startPublic: listenFrom
     "0.0.0.0"); beim ersten Mal fragt Windows dafuer nach der Firewall. Ueber
     den eigenen Server oeffnet dieser PC nichts - dann steht der Satz dazu da. */
  const note = $("#pHostNote");
  note.textContent = server ? "" : t("party.hostOpensPort");
  note.hidden = server;
  $("#pJoinSrvSatz").textContent = state.partyServer ? t("party.joinSrvMit", {addr: state.partyServer}) : t("party.joinSrvOhne");
  if(!SERVED){
    /* Im Browser gibt es keine Gruppe: ein Grund fuer beide Wege, einmal
       unter ihnen (#pHint, an beiden Knoepfen per aria-describedby). */
    $("#pHint").textContent = t("party.needsApp");
    sperrGrund("", "");
    $<HTMLButtonElement>("#pHost").disabled = $<HTMLButtonElement>("#pJoinBtn").disabled = true;
    joinHinweis();
    return;
  }
  // aus dem Log, damit die Schreibweise stimmt - nie aus dem Beispiel (dort heisst jeder Demo)
  if(!$<HTMLInputElement>("#pName").value && !state.fromSample)
    $<HTMLInputElement>("#pName").value = state.player === "__all" ? (state.players[0] || "") : state.player;
  // danach, nicht davor: sonst prueft der Abgleich ein Feld, das eine Zeile spaeter einen Namen bekommt
  syncPartyName();
}

/* Der Satz unter dem Codefeld: was fehlt, oder dass es losgehen kann. */
function joinHinweis(){
  const code = $<HTMLInputElement>("#pJoin").value;
  $("#pJoinHint").textContent = code.length === 4 ? t("party.codeBereit", {code}) : t("party.codeTipp");
}

/* Radiogruppe "Wo die Gruppe laeuft": Klick oder Pfeiltaste waehlt, ein Tabstopp. */
function woSetzen(neu: "pc" | "server", fokus: boolean){
  wo = neu;
  renderWege();
  if(fokus) document.querySelector<HTMLElement>('#pWo [data-wo="' + neu + '"]')?.focus();
}

/* ---------- Mitglieder und Board ---------- */
function renderBoard(p: Partial<PartyView>, board: BoardRow[], laeuft: boolean){
  const hosting = laeuft && p.role === "host";
  const me = p.name || "";
  const alle = reihe(board);
  // die Farbe je Mitglied: dieselbe wie in der Gruppenansicht im Kampf (mitgliedIndex, 19)
  mitgliederMerken(board.map(r => r.name));
  const farbe = new Map(alle.map(r => [r.name, reihenFarbe(mitgliedIndex(r.name))]));
  const melden = alle.filter(r => !r.waiting);
  const beispiel = p.demo ? '<span class="bsp">' + esc(t("party.bsp")) + "</span>" : "";
  if(eigenesGeoeffnet !== me){ eigenesGeoeffnet = me; if(me) aufMitglied.add(me); }

  /* Verbindung weg: die Zahlen sind von vorhin. Einmal beim Wechsel ueber
     die Meldung (role=status), danach traegt es die Zeile im Kopf. */
  if(laeuft && p.error && p.error !== partyFehlerGesagt) toastFail(p.error, 6000);
  partyFehlerGesagt = (laeuft && p.error) || "";

  /* Was frueher die Mitgliederliste ueber dem Board sagte, steht seit
     Feinschliff 6 (02.10.) leise in der Zeile des Boards: die Initiale in der
     Reihenfarbe, das Alter ("vor 5 s") oder der Stand (anderes Ziel, wird
     entfernt, noch keine Kaempfe). Waffen stehen in der Spalte Klasse. */
  const ini = initialen(alle.map(r => mitgliedName(r.name)));
  /* Das Alter ("vor 5 s") aendert sich mit jedem Abruf. Es steht darum nicht
     im Markup, das tausche vergleicht - sonst schriebe jeder Abruf die ganze
     Tafel neu, ein Klick zwischen mousedown und mouseup ginge verloren und
     der Vorleser verloere seinen Platz (Fixrunde 1, Befund 1). Das Markup
     traegt ein leeres small.balter; alterNachziehen setzt nur dessen Text. */
  const alterVon = (r: BoardRow) => laeuft && !r.waiting && state.kicking !== r.name && rowOnTarget(r, p.target) && typeof r.age === "number";
  const leise = (r: BoardRow) => {
    const warte = !!r.waiting, weg = !warte && !rowOnTarget(r, p.target);
    return state.kicking === r.name ? t("party.kickPendingRow") : warte ? t("party.stateWaiting")
      : weg ? (r.target ? t("party.stateOtherNamed", {target: r.target}) : t("party.stateOther")) : "";
  };
  const nameZeile = (r: BoardRow) => '<i aria-hidden="true">' + esc(ini.get(mitgliedName(r.name)) || "?") + '</i><span class="bnz"><b>' + esc(mitgliedName(r.name)) + "</b>" +
    (alterVon(r) ? '<small class="balter"></small>' : leise(r) ? "<small>" + esc(leise(r)) + "</small>" : "") + "</span>";

  /* Jemand ist im Raum und hat nie einen Kampf geschickt: fast immer das
     Kampflog im Spiel. Der Name hilft - der Host weiss, wen er fragt. */
  const warten = alle.filter(r => r.waiting && r.name !== me).map(r => r.name);
  $("#pLogHint").hidden = $("#pLogHintAkt").hidden = !laeuft || !warten.length;
  if(laeuft && warten.length) $("#pLogHint").textContent = t(warten.length === 1 ? "party.noLogOne" : "party.noLogMany", {names: nameList(warten)});
  /* Nur bei Aenderung: sonst liest die Sprachausgabe alle drei Sekunden dasselbe. */
  const aufZiel = melden.filter(r => rowOnTarget(r, p.target)).length;
  const zaehlung = melden.length + "/" + board.length + "/" + aufZiel;
  if(zaehlung !== partyZaehlungGesagt){
    partyZaehlungGesagt = zaehlung;
    $("#pCount").textContent = !board.length ? ""
      : (melden.length < board.length ? t("party.playersReportingOf", {n: melden.length, all: board.length})
        : melden.length === 1 ? t("party.playerReporting", {n: 1}) : t("party.playersReporting", {n: melden.length})) +
        " \u00b7 " + t("party.onTarget", {n: aufZiel});
  }

  // --- Board: Kopfzeile mit Stand, Beispielmarke
  const uhr = (d: Date) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  const stand = p.frozen && p.savedAt ? new Date(p.savedAt) : new Date();
  $("#pBoardZahl").textContent = [t("party.dabei", {n: melden.length, all: board.length}), p.target || "", t("party.stand", {uhr: uhr(stand)})]
    .filter(Boolean).join(" \u00b7 ");
  tausche($("#pBoardBsp"), beispiel);

  // --- der Kopf des Boards: nur bei einer laufenden Gruppe (DECISION 7.10)
  $("#pKopf").hidden = !laeuft;
  $("#pBoard").classList.toggle("ohnekopf", !laeuft);
  /* Im Raum fuer den Status (Befund 6): wer gerade entfernt wird, zaehlt nicht,
     ebenso wer meldet, aber an einem anderen Ziel steht; wer noch nichts
     gemeldet hat, ist verbunden und zaehlt. */
  const imRaum = board.filter(r => state.kicking !== r.name && (r.waiting || rowOnTarget(r, p.target))).length;
  if(laeuft) boardKopf(p, hosting, imRaum, melden.length);

  // --- die Tabelle
  const max = Math.max(1, ...melden.map(r => r.dps || 0));
  const summe = melden.reduce((a, r) => a + (r.dps || 0), 0);
  const kopf = '<div class="bth" role="row"><span role="columnheader">#</span><span role="columnheader">' + esc(t("party.colMitglied")) +
    '</span><span role="columnheader">' + esc(t("party.colKlasse")) + '</span><span role="columnheader" class="on">' + esc(t("party.colDps")) + "</span></div>";
  const zeilen = melden.map((r, i) => {
    const auf = aufMitglied.has(r.name), geht = state.kicking === r.name;
    const klasse = className(classNameFor(r.weapons || []));
    const kl = [klasse, waffenText(r.weapons)].filter(Boolean).join(" \u00b7 ");
    const id = "pMs-" + i;
    return '<div class="btr' + (r.name === me ? " me" : "") + (auf ? " offen" : "") + (geht ? " geht" : "") + '" role="row" data-m="' + esc(r.name) +
      '" style="--c:' + farbe.get(r.name) + '">' +
      '<span class="brang" role="cell">' + (i + 1) + "</span>" +
      '<span class="bwer" role="cell"><button class="aufk" type="button" data-auf="' + esc(r.name) + '" aria-expanded="' + auf + '" aria-controls="' + id +
        '" aria-label="' + esc(t("party.aufName", {name: mitgliedName(r.name)})) + '">' + PFEIL + "</button>" + nameZeile(r) +
        (hosting && r.name !== me ? kickKnopf(r.name) : "") +
        '<span class="gspur" aria-hidden="true"><i style="width:' + (100 * (r.dps || 0) / max).toFixed(1) + '%"></i></span></span>' +
      /* Die Rolle steht im title ("Sucher \u00b7 DPS"); wer als Heiler Auge von
         Ventius spielt, traegt dessen Symbol - darum steht bei ihm DPS. */
      '<span class="bkl" role="cell" title="' + esc(partyClass(r) || kl) + '">' + esc(kl) +
        (partyClassIsVentius(r) ? skillMark(VENTIUS_NAME, VENTIUS_ID, "", false) : "") + "</span>" +
      '<span class="bd num" role="cell">' + esc(fmt(r.dps || 0, 1000)) + "</span></div>" +
      (auf ? mitgliedSkills(r, id, r.name === me) : "");
  }).join("");
  /* Wer im Raum ist und noch keinen Kampf gemeldet hat: unter den Meldenden,
     ohne Rang, Spur und Zahl - und fuer den Host hier entfernbar. */
  const wartend = alle.filter(r => r.waiting).map(r =>
    '<div class="bwart' + (state.kicking === r.name ? " geht" : "") + '" role="row" data-m="' + esc(r.name) + '" style="--c:' + farbe.get(r.name) + '">' +
      '<span class="brang" role="cell"></span>' +
      '<span class="bwer" role="cell"><span class="aufk leer" aria-hidden="true"></span>' + nameZeile(r) +
        (hosting && r.name !== me ? kickKnopf(r.name) : "") + "</span>" +
      '<span class="bkl" role="cell">' + esc(waffenText(r.weapons)) + "</span>" +
      '<span class="bd num" role="cell">\u2013</span></div>').join("");
  const sum = melden.length ? '<div class="bsum" role="row"><span role="cell"></span><span role="cell">' + esc(t("party.summe")) + '</span><span role="cell">' +
    esc(t("party.zusammen", {n: melden.length})) + '</span><span class="num" role="cell">' + esc(fmt(summe, 1000)) + "</span></div>" : "";
  const leer = !melden.length ? '<p class="gleise bleer">' + esc(t(hosting ? "party.everyoneJoins" : "party.yourFightsSent")) + "</p>" : "";
  tausche($("#pTafel"), kopf + zeilen + wartend + sum + leer);
  // das Alter je Zeile, nur der Text (Befund 1): kein neuer Knoten, kein Fokusverlust
  for(const r of melden) if(alterVon(r)){
    const el = document.querySelector<HTMLElement>('#pTafel .btr[data-m="' + CSS.escape(r.name) + '"] .balter');
    const txt = t("party.vorSek", {s: r.age});
    if(el && el.textContent !== txt) el.textContent = txt;
  }
}

const PFEIL = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* Entfernen: benannt, weil sieben gleiche "Entfernen" einer Sprachausgabe nicht sagen, wen sie treffen. */
function kickKnopf(name: string): string {
  return '<button class="kick" type="button" data-kick="' + esc(name) + '" aria-label="' + esc(t("party.kickWho", {name})) + '">' + esc(t("party.kick")) + "</button>";
}

/* Der Kopf des Boards: der Code gross zum Ansagen, die Beitrittsadresse
   (vom PC aus braucht Beitreten "CODE@Adresse"), der Status, die zwei
   Handlungen. Der Code steht Zeichen fuer Zeichen fuer den Vorleser da -
   er wird vorgelesen, nicht als Wort. */
function boardKopf(p: Partial<PartyView>, hosting: boolean, imRaum: number, melden: number){
  const langerWeg = hosting && !!p.join && p.join !== p.code;
  const code = p.code || "";
  tausche($("#pCode"), '<span class="code" role="img" aria-label="' + esc(t("party.codeLabel", {code: [...code].join(" ")})) + '">' + esc(code) + "</span>" +
    (langerWeg ? '<p class="joinline"><span>' + esc(t("party.joinLabel")) + '</span> <b class="mono">' + esc(p.join!) + "</b></p>" : "") +
    (hosting ? '<button class="btn sm" type="button" id="pCopy">' + esc(t(langerWeg ? "party.copyJoin" : "party.copy")) + "</button>" : ""));
  // fuer Host und Mitglied derselbe Titel, wie im Entwurf (#133)
  $("#pCodeT").textContent = t("party.codeTitel");
  $("#pStale").hidden = !p.error;
  $("#pStale").textContent = p.error ? t("party.staleNote") : "";
  $("#pBoard").classList.toggle("stale", !!p.error);
  /* Der Status nach Lage (Feinschliff 6): "wartet auf Beitritte" nur, solange
     der Host allein im Raum ist; sonst wie viele verbunden sind, und solange
     noch keiner einen Kampf gemeldet hat, dass die Zahlen noch kommen. */
  const lage = hosting && imRaum <= 1 ? t("party.listening")
    : t("party.nVerbunden", {n: Math.max(imRaum, 1)}) + (melden ? "" : " \u00b7 " + t("party.warteZahlen"));
  tausche($("#pStatus"), '<b aria-hidden="true">●</b> ' + esc(p.error || lage));
  $("#pStatus").classList.toggle("bad", !!p.error);
  /* Als Host schliesst der Knopf den Raum fuer alle - "verlassen" waere dort das falsche Wort. */
  $("#pLeave").textContent = t(hosting ? "party.closeBtn" : "party.leaveBtn");
}

/* Die zwoelf Faehigkeiten eines Mitglieds, wie das Board sie meldet: Schaden,
   DPS, Treffer, kritisch und stark als Anteil der Treffer, groesster Treffer;
   jede mit ihren Trefferarten (cats), aufklappbar wie die eigene Faehigkeit
   in der Tafel. Ein aelteres Borometer schickt crit/heavy/max nicht: dann
   "\u2013" statt einer Null, die nach "nie kritisch" aussaehe. */
function mitgliedSkills(r: BoardRow, id: string, du: boolean): string {
  const L = r.skills || [];
  const mx = Math.max(1, ...L.map(k => k.damage || 0));
  const secs = Math.max(r.seconds || 0, 1);
  const zelle = (x: string, kl = "tv") => '<span class="' + kl + '" role="cell">' + esc(x) + "</span>";
  const kopf = '<div class="msk mskopf" role="row">' + ["party.sp.skill", "party.sp.dmg", "party.sp.dps", "party.sp.hits", "party.sp.crit", "party.sp.heavy", "party.sp.max"]
    .map(k => '<span role="columnheader">' + esc(t(k)) + "</span>").join("") + "</div>";
  const zeilen = L.map((k, i) => {
    const arten = (k.cats || []).length >= 2 ? k.cats! : [];
    const schl = r.name + "|" + k.name, auf = arten.length > 0 && aufArt.has(schl);
    const bild = skillIcon(k.name, k.sid);
    const knopf = arten.length ? '<button class="mskauf" type="button" data-art="' + esc(schl) + '" aria-expanded="' + auf + '" aria-label="' +
      esc(t("party.artenName", {skill: skillLabel(k.name, k.sid)})) + '">' + PFEIL + "</button>" : '<span class="mskauf leer" aria-hidden="true"></span>';
    const zeile = '<div class="msk' + (auf ? " offen" : "") + '" role="row" data-k="' + esc(k.name) + '"><span class="tn" role="cell">' + knopf +
      (bild ? '<img class="sic" src="' + bild + '" alt="">' : '<span class="sic" aria-hidden="true"></span>') +
      '<span class="nm">' + esc(skillLabel(k.name, k.sid)) + "</span>" +
      '<span class="ubahn" aria-hidden="true"><i style="--w:' + ((k.damage || 0) / mx).toFixed(4) + ";--c:" + reihenFarbe(i) + '"></i></span></span>' +
      zelle(fmt(k.damage || 0, 1000)) + zelle(fmt(k.dps ?? (k.damage || 0) / secs, 1000)) + zelle(String(k.hits || 0)) +
      zelle(anteil(k.crit, k.hits)) + zelle(anteil(k.heavy, k.hits)) + zelle(k.max == null ? "\u2013" : fmt(k.max, 1000)) + "</div>";
    const artZeilen = auf ? arten.map(c => '<div class="mcat" role="row" data-k="' + esc(k.name) + '" data-cat="' + esc(c.k) + '" data-d="' + c.d + '" data-h="' + c.h + '">' +
      '<span class="tn" role="cell"><span class="nm">' + esc(hitCatLabel(c.k)) + "</span></span>" +
      zelle(fmt(c.d, 1000)) + zelle(fmt(c.d / secs, 1000)) + zelle(String(c.h)) + zelle("") + zelle("") + zelle(fmt(c.m, 1000)) + "</div>").join("") : "";
    return zeile + artZeilen;
  }).join("");
  const satz = '<p class="msatz">' + esc(t(L.length ? "party.msatz" : "party.msatzLeer")) +
    (du ? ' <button class="btn sm quiet" type="button" data-zukampf="1">' + esc(t("party.zuKampf")) + " " + PFEIL + "</button>" : "") + "</p>";
  return '<div class="mskills" role="row" id="' + id + '" data-m="' + esc(r.name) + '"><div role="cell" class="mscell">' + satz +
    (L.length ? '<div class="mstab" role="table" aria-label="' + esc(t("party.aufName", {name: mitgliedName(r.name)})) + '">' + kopf + zeilen + "</div>" : "") + "</div></div>";
}
/* The steps are read out of the start screen's own dictionary rather than
   written again here: one wording, in whichever language the person reading
   it out has the app in, and it cannot drift from what the app itself says. */
function loggingHowTo(){
  return t("land.setupTitle") + ":\n" +
         [t("land.step1"), t("land.step2"), t("land.step3"), t("land.step4")].join(" > ") + "\n" +
         t("land.setupAfter");
}
/* Es ist der eigene Clan. Jemanden versehentlich rauszuwerfen kostet nicht
   einen Klick zurueck, sondern eine Entschuldigung im Sprachkanal - und
   vier gleich aussehende Tastenanschlaege liegen in der Tabreihenfolge vor
   der Hauptaktion.

   Kein Bestaetigungsdialog: mitten im Kampf ist eine Rueckfrage teurer als
   ein Rueckweg. Stattdessen wartet der Aufruf acht Sekunden, und solange
   steht "Rueckgaengig" im Band. Wer nichts tut, hat entfernt. */
const KICK_UNDO = 8000;
// the removal waiting out its undo: the timer, what runs when it ends, and
// how to put the row back
var kickWarte: ReturnType<typeof setTimeout> | null, kickLos: (() => void) | null,
    kickHeim: (() => void) | null;
function kickMember(who: string){
  if(!who) return;
  /* Ein zweites Entfernen waehrend der Wartezeit schickt das erste sofort
     los, statt es stillschweigend zu ersetzen - sonst bliebe der erste
     Name im Raum, obwohl der Host ihn weggeklickt hat. */
  if(kickWarte){ clearTimeout(kickWarte ?? undefined); kickLos!(); }   // set together with kickWarte
  const los = () => {
    kickWarte = null; kickLos = null;
    if(kickHeim){ const h = kickHeim; kickHeim = null; h(); }
    fetch("/api/party/kick", {method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({who})})
      .then(r => r.json())
      .then(d => {
        if(d && d.ok){ logParty(t("party.kickedLog",{name:who})); toast(tt("party.kicked",{name:who}), 4000); pollParty(); }
        else toastFail(d && d.error ? d.error : tt("party.kickFailed",{name:who}), 6000);
      })
      .catch(() => toastFail(tt("party.kickFailed",{name:who}), 6000));
  };
  kickLos = los;
  kickWarte = setTimeout(los, KICK_UNDO);
  /* Die Zeile sagt, dass sie geht. Ohne das behauptete die Aufstellung acht
     Sekunden lang, es sei nichts geschehen, und die einzige Rueckmeldung
     stand 612 Punkte weiter unten am Fensterrand. */
  state.kicking = who;
  renderParty();
  /* Und der Fokus geht mit. Vom Entfernen-Knopf zum Band waren es gemessen
     15 Tabstopps in acht Sekunden - fuer die Tastatur gab es den Rueckweg
     also nicht. Beim Ablauf oder Ausloesen kehrt er zurueck, wo er war. */
  /* Nicht das Element merken, sondern den Namen: renderParty schreibt
     Board und Mitglieder neu, das angeklickte Element ist danach weg und der
     Fokus laege auf <body>. Zurueck geht er an den Knopf desselben
     Mitglieds, sonst an einen anderen, sonst an "Verlassen". */
  const heim = () => {
    state.kicking = null;
    renderParty();
    const ziel = document.querySelector<HTMLElement>("#p-party [data-kick=\"" + CSS.escape(who) + "\"]")
              || document.querySelector<HTMLElement>("#p-party [data-kick]") || $("#pLeave");
    if(ziel && ziel.focus) ziel.focus({preventScroll:true});
  };
  kickHeim = heim;
  toast(tt("party.kickPending",{name:who}), KICK_UNDO, null, {
    label: tt("party.kickUndo"),
    fn: () => {
      clearTimeout(kickWarte ?? undefined);
      kickWarte = null; kickLos = null;
      heim();
      toast(tt("party.kickCancelled",{name:who}), 3000);
    }
  });
  const knopf = $("#toast") && $("#toast").querySelector<HTMLElement>(".tact");
  if(knopf) knopf.focus({preventScroll:true});
}

/* ---------- is the party server actually up? ----------
   Seit der Neugestaltung (Aufgabe 8, Entwurf E:942) im Abschnitt Gruppe und
   Server der Einstellungen: dort wird der Gruppen-Server gespeichert und
   geprueft, nirgends sonst. Der Status gilt der gespeicherten Adresse;
   steht im Feld eine andere, sagt der Satz darunter, dass sie noch nicht
   gespeichert ist, und der Status schweigt. Geprueft wird nur auf "Jetzt pruefen"
   und nach "Speichern" - nicht beim Oeffnen, kein Takt im Hintergrund. */
let srvGeprueft = false;
export function serverEinstNachfuehren(){
  const feld = document.getElementById("eServer") as HTMLInputElement | null;
  if(!feld) return;
  const wo = document.querySelector<HTMLElement>("#eg-gruppe .nurserved");
  if(wo && wo.hidden === SERVED) wo.hidden = !SERVED;
  const hinweis = $("#eGruppeBrowser");
  if(hinweis.hidden !== SERVED) hinweis.hidden = SERVED;
  if(document.activeElement !== feld && !feld.dataset.getippt && feld.value !== (state.partyServer || "")) feld.value = state.partyServer || "";
  const offen = feld.value.trim() !== (state.partyServer || "");
  $("#eServerStatus").hidden = !SERVED || !state.partyServer || offen || !srvGeprueft;
  const satz = offen ? t("party.serverOffen") : "";
  if($("#eServerOffen").textContent !== satz) $("#eServerOffen").textContent = satz;
  $("#eServerOffen").hidden = !offen;
}
function setSrvStatus(cls: string, text: string | string[]){
  const el = $("#eServerStatus");
  el.classList.remove("up","down","checking");
  if(cls) el.classList.add(cls);
  srvGeprueft = true;
  serverEinstNachfuehren();
  const out = $("#eServerStatusText");
  // An array is a run of facts and gets ruled apart; a plain string is a
  // sentence and stays escaped text — party.srvDown interpolates the server
  // address the person typed, which must never reach innerHTML unescaped.
  if(Array.isArray(text)){ out.classList.add("factline"); out.innerHTML = factLine(text); }
  else { out.classList.remove("factline"); out.textContent = text; }
}
/* Das letzte Ergebnis als Funktion, die es in der jetzigen Sprache neu
   setzt: ein Sprachwechsel fasst es neu in Worte, statt neu zu fragen. */
let letzterStatus: (() => void) | null = null;
function zeigeStatus(cls: string, text: () => string | string[]){
  letzterStatus = () => setSrvStatus(cls, text());
  letzterStatus();
}
function checkPartyServer(){
  if(!SERVED) return;
  if(!state.partyServer){ zeigeStatus("", () => t("party.srvUnset")); return; }
  zeigeStatus("checking", () => t("party.srvChecking"));
  /* POST: der Hauptprozess fragt dafuer den Gruppenserver an - eine
     Handlung, keine Abfrage, also nichts, was ein GET ausloesen darf */
  fetch("/api/party/check", {method:"POST", headers:{"Content-Type":"application/json"}, body:"{}"}).then(r => r.json()).then(d => {
    if(d.ok) zeigeStatus("up", () => [t("party.srvOnline"),
                                      t("party.srvPing",{ms:d.ms}),
                                      t("party.srvRooms",{rooms:d.rooms})]);
    else if(d.reason === "unset") zeigeStatus("", () => t("party.srvUnset"));
    else zeigeStatus("down", () => t("party.srvDown",{addr:d.server||state.partyServer}));
  }).catch(() => zeigeStatus("down", () => t("party.srvDown",{addr:state.partyServer})));
}
/* Nichts laedt von allein: der Gruppen-Server wird nur auf "Jetzt pruefen"
   und nach "Speichern" gefragt (Entscheidung Pruefung Aufgabe 8, Befund 3).
   Hier nur das Feld nachfuehren und das letzte Ergebnis in der jetzigen
   Sprache neu setzen (Sprachwechsel, Laden der gespeicherten Adresse). */
export function serverStatusNachfuehren(){
  serverEinstNachfuehren();
  if(letzterStatus) letzterStatus();
}

/* Ohne Namen geht keiner der beiden Wege - das sagt der Knopf selbst, statt
   erst nach dem Druck als Fehlermeldung. Der Grund steht direkt unter dem
   gesperrten Knopf (.waylock) und per aria-describedby an ihm; #pHint bleibt
   fuer die Antworten von Server und Helfer. Leer ist die Zeile versteckt und
   traegt keinen Text, damit die Beschreibung nichts Veraltetes vorliest.
   Beitreten braucht dazu den Code: das sagt der Satz unter dem Codefeld
   (#pJoinHint). */
function sperrGrund(host: string, join: string){
  const setz = (id: string, satz: string) => {
    const el = $(id);
    el.textContent = satz;
    el.hidden = !satz;
  };
  setz("#pHostLock", host);
  setz("#pJoinLock", join);
}
function syncPartyName(){
  joinHinweis();
  if(!SERVED) return;   // dort sind beide ohnehin aus
  const ohneName = !$<HTMLInputElement>("#pName").value.trim();
  const ohneCode = $<HTMLInputElement>("#pJoin").value.trim().length !== 4;
  sperrGrund(ohneName ? t("party.putNameFirst") : "", ohneName ? t("party.putNameFirst") : "");
  $<HTMLButtonElement>("#pHost").disabled = ohneName;
  $<HTMLButtonElement>("#pJoinBtn").disabled = ohneName || ohneCode;
}

/* ---------- compact: watch yourself, or the whole group ---------- */
export function syncPartySwitch(){
  const p: Partial<PartyView> = state.party || {};
  const viewable = !!(p.role || p.frozen);   // live party OR a loaded snapshot — both are worth the switch staying on Party
  const compact = document.body.classList.contains("compact");
  $("#partySwitch").hidden = !(viewable && compact);
  const onParty = state.group === "party";
  $("#pvMe").classList.toggle("on", !onParty);
  $("#pvParty").classList.toggle("on", onParty);
  $("#pvMe").setAttribute("aria-pressed", String(!onParty));
  $("#pvParty").setAttribute("aria-pressed", String(onParty));
  if(!viewable && onParty) setGroup("skill");   // nothing left to show — the switch can't stay on a group that no longer exists
}

/* ---------- pill hover titles ----------
   Compact hides the pill text and shows only the status dot, to fit the
   window. Whatever the text would have said is still available on hover —
   mirrored automatically, so it can never drift out of sync with the many
   places that set liveText/partyPillText, now or later. */
function mirrorTitle(textEl: HTMLElement, hostEl: HTMLElement){
  if(!textEl || !hostEl) return;
  const sync = () => { hostEl.title = textEl.textContent || ""; };
  sync();
  if(typeof MutationObserver !== "undefined"){
    new MutationObserver(sync).observe(textEl, {characterData:true, childList:true, subtree:true});
  }
}

/* Ohne Kampf gibt es nichts zu speichern, und der Knopf tat dann
   schweigend nichts: btnSaveRun kehrt bei fehlendem Abschnitt in der
   ersten Zeile um. Nach dem Leeren stand er weiter aktiv da. Jetzt sagt
   er, dass gerade nichts geht. Sein Zwilling im leeren Abschnitt der
   gespeicherten Kaempfe ist weg: ein Kampf wird dort gespeichert, wo er
   steht, und die Notiz in der Schiene nennt den Knopf beim Namen. */
export function syncSaveRunBtns(){
  const nichts = !(state.group === "party") && !state.encounters[state.sel];
  $<HTMLButtonElement>("#btnSaveRun").disabled = nichts;
  // der Zwilling in der Kopfzeile der Felder (58-felder.ts) folgt ihm
  $<HTMLButtonElement>("#bkSpeichern").disabled = nichts;
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  /* ============================================================
     Party board — one member hosts, the rest join with the code.
     Every app pushes its newest fight to the host, the host merges
     them and hands the ranked board back to everyone.
     ============================================================ */
  state.party = {role:null, code:"", join:"", address:"", board:[], target:"", error:""};
  state.partyServer = "";
  /* Aus einer Zeile der Gruppentafel einen Kampfabschnitt bauen, der
     aussieht wie ein eigener. Damit zeichnen renderStack und
     renderRotation ihn, ohne zu wissen, woher er kommt.

     Die Ereignisse sind nachgebaut, eines je Faehigkeit und Sekunde. Das
     traegt alles, was aus der Sekundenreihe kommt - Kurve, Spuren,
     Luecken, schwaechste Stelle. Es traegt KEINE Trefferzahlen, und darum
     werden die Kennzahlen unten mit denen des Absenders ueberschrieben
     statt aus den nachgebauten Ereignissen gerechnet. */
  /* ---------- die Kurve eines Mitglieds ----------
     Die Tafel sagt nur noch, DASS jemand eine Kurve hat. Sie selbst wiegt
     am Ende eines Kampfes rund 13 kB, und jede Meldung bekommt die ganze
     Tafel zurueck: am echten Gruppenserver gemessen 81,7 kB bei sechs
     Leuten und 174,9 kB bei zwoelf, alle drei Sekunden, fuer Daten, die
     fast nie jemand ansieht. Geholt wird jetzt einzeln und erst auf Klick.

     Behalten wird sie, solange der Name denselben Kampf meldet. Der
     Stempel dafuer sind die drei Zahlen, die einen neuen Kampf verraten. */
  state.mitgliedKurven = new Map();
  state.kurveLaedt = null;
  /* Ein Klick irgendwo in einer der beiden Reihen. Delegiert, weil die
     Reihe bei jedem Zeichnen neu entsteht. */
  document.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest<HTMLElement>("[data-wer]");
    if(!b) return;
    const wer = b.dataset.wer || null;
    /* Beide Fenster zeigen denselben Kampf - zwei verschiedene Leute in
       zwei Reitern waeren zwei Wahrheiten nebeneinander. */
    const zeigen = () => renderRotation();
    if(!wer){ state.zeigeMitglied = null; zeigen(); return; }
    const row = ((state.party && state.party.board) || []).find(r => r.name === wer);
    if(!row) return;
    if(kurveVon(row)){ state.zeigeMitglied = wer; zeigen(); return; }
    /* Die Kurve liegt noch beim Server. Bis sie da ist, bleibt der eigene
       Kampf stehen und der Name traegt drei Punkte. */
    const meins = ++kurveLauf;
    state.kurveLaedt = wer;
    renderWer("rotWho", "chart.whoseRot");
    kurveHolen(row).then(k => {
      /* Zwischendurch wurde ein anderer Name angeklickt. Diese Antwort
         gehoert zu einem Klick, den niemand mehr meint. */
      if(meins !== kurveLauf) return;
      state.kurveLaedt = null;
      if(!k){
        toastFail(tt("toast.curveFail", {name: wer}));
        renderWer("rotWho", "chart.whoseRot");
        return;
      }
      state.zeigeMitglied = wer;
      zeigen();
    });
  });
  /* Wessen Kampf die beiden Diagramme gerade zeigen. null heisst: meiner. */
  state.zeigeMitglied = null;
  state.partyLog = [];
  /* Waehrend ein Kampf laeuft, kommt eine Waffe nur dazu und faellt nicht
     wieder heraus. Ohne diese Regel springt die Anzeige in den ersten
     Sekunden: derselbe Livelauf an denselben 68 Bosskaempfen nachgestellt,
     jede Sekunde neu gerechnet, steht das Paar nach 3 Sekunden in 81 Prozent
     der Faelle fest, nach 10 in 96, nach 15 in 99. Im spaetesten Fall - Thuban
     in 260911_232959 - kam die Armbrust erst in der letzten Sekunde eines
     50-Sekunden-Kampfes ueber die Schwelle. Wer zusieht, soll dabei nicht
     zweimal etwas anderes lesen. */
  state.autoSeen = {key: "", weapons: []};
  state.weaponPick = {};      // {Charakter: {main, off}}
  state.autoRead = null;      // was zuletzt aus dem Kampf kam
  state.weaponByHand = false;
  state.lastChar = null;
  /* Wer den Charakter wechselt, faengt eine neue Logdatei an - auch das
     nachgezaehlt: der eine Charakter in 89 Dateien, der andere in 3, nie beide
     in derselben.
     Sobald die neue Datei gelesen ist, steht der neue Name da, und die Gruppe
     soll ihn uebernehmen.

     Umbenannt wird nur, wenn auf der Tafel der Name des ALTEN Charakters
     stand. Wer sich beim Beitreten einen anderen Namen gegeben hat, meinte ihn
     so - der bleibt. */
  state.partyChar = null;
  $("#pCopyHowTo").onclick = () => {
    const text = loggingHowTo();
    if(navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast(tt("party.howToCopied"), 3000));
    else toastFail(tt("party.selectAndCopy"));
  };
  $("#eServerCheck").onclick = checkPartyServer;
  // was getippt ist, ueberschreibt der naechste Abruf nicht mit dem gespeicherten Server
  $("#pServer").oninput = () => { $("#pServer").dataset.getippt = "1"; renderWege(); };
  $("#eServer").oninput = () => { $("#eServer").dataset.getippt = "1"; serverEinstNachfuehren(); };
  // aus dem Bereich Gruppe zum Abschnitt Gruppe und Server der Einstellungen
  $("#pZuEinst").onclick = () => einstSpringen("gruppe");
  /* Speichern (Einstellungen, Gruppe und Server): dieselbe Route wie die
     fruehere Karte Gruppen-Server; leer loescht den Eintrag (Pruefung
     Aufgabe 7, Befund 2). Das Feld zum Starten im Bereich Gruppe folgt. */
  $("#eServerSave").onclick = () => {
    const addr = $<HTMLInputElement>("#eServer").value.trim();
    fetch("/api/party/server", {method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({server:addr})}).then(r => r.json()).then(d => {
        state.partyServer = d.server || "";
        $<HTMLInputElement>("#eServer").value = state.partyServer;
        delete $("#eServer").dataset.getippt;
        delete $("#pServer").dataset.getippt;
        renderParty();
        checkPartyServer();
        toast(state.partyServer ? tt("party.serverSaved",{addr:state.partyServer}) : tt("party.serverCleared"));
      }).catch(() => toastFail(tt("party.helperNoAnswer")));
  };
  /* Wo die Gruppe laeuft: eine Radiogruppe - Klick waehlt, Pfeiltasten
     wechseln und nehmen den Fokus mit, ein Tabstopp (woSetzen). */
  document.querySelectorAll<HTMLElement>("#pWo [role=radio]").forEach(b => {
    b.onclick = () => woSetzen(b.dataset.wo === "server" ? "server" : "pc", true);
    b.onkeydown = e => {
      if(!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      woSetzen(woJetzt() === "server" ? "pc" : "server", true);
    };
  });
  // eine neue Eingabe loest die alte Antwort des Helfers ab
  $("#pName").oninput = () => { $("#pHint").textContent = ""; syncPartyName(); };
  /* Das Codefeld nimmt nur, was ein Code sein kann (A-H, J-N, P-Z, 2-9 - ohne
     0, O, 1 und I, wie party.ts und boro_server.py sie vergeben), in
     Grossbuchstaben. Eine ganze Beitrittsadresse vom Host ("CODE@Adresse")
     verteilt sich auf Code und Server-Adresse. */
  $("#pJoin").oninput = () => {
    const f = $<HTMLInputElement>("#pJoin");
    let roh = f.value;
    const at = roh.indexOf("@");
    if(at >= 0){ $<HTMLInputElement>("#pJoinSrv").value = roh.slice(at + 1).trim(); roh = roh.slice(0, at); }
    const code = roh.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 4);
    if(f.value !== code) f.value = code;
    $("#pHint").textContent = "";
    syncPartyName();
  };
  $("#pHost").onclick = () => {
    const name = $<HTMLInputElement>("#pName").value.trim();
    if(!name){ toastFail(tt("party.putNameFirst")); return; }
    const server = woJetzt() === "server";
    const addr = $<HTMLInputElement>("#pServer").value.trim();
    if(server && !addr){ $("#pHint").textContent = t("party.serverFehlt"); $("#pServer").focus(); return; }
    /* Eigener Server: der Raum entsteht dort, der Helfer merkt sich die
       Adresse (server.ts, /api/party/create). Auf diesem PC: /api/party/host.
       Zwei Aufrufe mit festem Pfad statt einer Variablen - das Audit laesst
       jeden fetch der Seite nur mit einem /api/-Literal zu. */
    const kopf = {"Content-Type":"application/json"};
    const antwort = server
      ? fetch("/api/party/create", {method:"POST", headers:kopf, body: JSON.stringify({name, server: addr})})
      : fetch("/api/party/host", {method:"POST", headers:kopf, body: JSON.stringify({name})});
    antwort.then(r => r.json()).then(d => {
        if(!d.ok){ $("#pHint").textContent = d.error || t("party.couldNotOpen"); return; }
        $("#pHint").textContent = "";
        if(server){ state.partyServer = addr; delete $("#pServer").dataset.getippt; }
        // a fresh room starts with a fresh history — otherwise the log
        // carries entries from a previous party (or a loaded snapshot)
        // and a bug report shows events that never happened in this room
        state.partyLog = [];
        lastReport = ""; state.party = state.party || ({} as PartyView); state.party.frozen = false;
        // a different party is a different set of people
        state.ventiusSeen = new Set();
        state.partySince = Date.now();   // everything before this moment is old news, not this party's
        pollParty(); sendReport(true);
        toast(tt("party.openCode",{code:d.code}));
      }).catch(() => { $("#pHint").textContent = t("party.helperNoAnswer"); });
  };
  $<HTMLFormElement>("#pJoinForm").onsubmit = e => {
    e.preventDefault();
    const name = $<HTMLInputElement>("#pName").value.trim(), code = $<HTMLInputElement>("#pJoin").value.trim().toUpperCase();
    if(!name || code.length !== 4){ $("#pHint").textContent = t("party.needBoth"); return; }
    /* Mit Adresse "CODE@Adresse" (ein Host auf seinem PC oder ein eigener
       Server), ohne nur der Code: dann gilt der eingetragene Gruppen-Server
       (server.ts, /api/party/join). */
    const srv = $<HTMLInputElement>("#pJoinSrv").value.trim();
    const join = srv ? code + "@" + srv : code;
    $("#pHint").textContent = t("party.knocking",{addr:join});
    fetch("/api/party/join", {method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({name, join})}).then(r => r.json()).then(d => {
        if(!d.ok){ $("#pHint").textContent = d.error || t("party.couldNotJoin"); return; }
        $("#pHint").textContent = "";
        // a fresh room starts with a fresh history (see above)
        state.partyLog = [];
        lastReport = ""; state.party = state.party || ({} as PartyView); state.party.frozen = false;
        // a different party is a different set of people
        state.ventiusSeen = new Set();
        state.partySince = Date.now();   // everything before this moment is old news, not this party's
        pollParty(); sendReport(true);
        toast(tt("party.joined",{code:d.code}));
      }).catch(() => { $("#pHint").textContent = t("party.helperNoAnswer"); });
  };
  /* Das Board wird neu geschrieben, darum am Bereich: aufklappen (Mitglied,
     Faehigkeit), entfernen, kopieren, zu den eigenen Trefferarten. */
  $("#p-party").addEventListener("click", e => {
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-auf], [data-art], [data-kick], [data-zukampf], #pCopy") : null;
    if(!el) return;
    if(el.dataset.auf != null){
      const m = el.dataset.auf;
      if(aufMitglied.has(m)) aufMitglied.delete(m); else aufMitglied.add(m);
      renderParty();
    } else if(el.dataset.art != null){
      const k = el.dataset.art;
      if(aufArt.has(k)) aufArt.delete(k); else aufArt.add(k);
      renderParty();
    } else if(el.dataset.kick != null){
      kickMember(el.dataset.kick);
    } else if(el.dataset.zukampf != null){
      // die eigenen Trefferarten stehen in der Tafel des Kampfs, nach Faehigkeit
      setGroup("skill");
      switchTab("timeline");
    } else if(el.id === "pCopy"){
      const p = state.party || ({} as PartyView), lang = !!p.join && p.join !== p.code;
      if(navigator.clipboard) navigator.clipboard.writeText(p.join || p.code || "").then(() => toast(tt(lang ? "party.joinCopied" : "party.codeCopied")));
      else toastFail(tt("party.selectAndCopy"));
    }
  });
  /* Fuer den Host ist "verlassen" das falsche Wort: er schliesst den Raum
     fuer alle. Und der Aufruf setzt state.partyLog = [] - was noch nicht
     gespeichert ist, ist danach weg. Darum hier eine Rueckfrage, die beides
     im Satz nennt; ein Mitglied, das nur selbst rausgeht, bekommt sie nicht. */
  $("#pLeave").onclick = async () => {
    const p: Partial<PartyView> = state.party || {};
    if(p.role === "host"){
      const wieViele = (p.board || []).filter(r => r.name !== p.name).length;
      const ok = await askConfirm(t("party.closeTitle"),
        t("party.closeMsg", {n: wieViele, log: state.partyLog && state.partyLog.length ? 1 : 0}),
        {danger: true, okLabel: t("party.closeBtn")});
      if(!ok) return;
    }
    fetch("/api/party/leave", {method:"POST", headers:{"Content-Type":"application/json"}, body:"{}"})
      .then(() => { const warHost = (state.party || {}).role === "host";
                    state.party = {role:null, board:[]}; state.partyLog = []; state.partySince = null;
                    state.ventiusSeen = new Set();
                    renderParty(); syncPartySwitch();
                    toast(tt(warHost ? "party.closed" : "party.left")); })
      .catch(() => toastFail(tt("party.helperNoAnswer")));
  };
  $("#pvMe").onclick = () => setGroup("skill");
  $("#pvParty").onclick = () => setGroup("party");
  mirrorTitle($("#partyPillText"), $("#partyPill"));
}
