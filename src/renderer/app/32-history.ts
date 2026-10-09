import { state } from "./01-state";
import { dur, fmt, toast, toastFail } from "./03-helpers";
import { appendEvents, autoMap, buildEvents, modeWidth, parseGrid, profile } from "./04-log-parsing";
import { segment, segmentTail } from "./05-fights";
import { histKey, knownBoss, parseGridTail, practiceTarget, stats } from "./06-blocks-and-places";
import { t, tt } from "./08-translation";
import { bossMark } from "./12-boss-images";
import { setVentiusLernen } from "./15-weapons-and-ventius";
import { perSecond } from "./16-fight-analysis";
import { $, esc, wallTime } from "./18-interface-basics";
import { renderHead } from "./20-meter-head";
import { renderBars } from "./21-damage-table";
import { syncKwKnopf } from "./23-kampfwahl";
import { renderRotation } from "./25-rotation";
import { renderAnalysis } from "./26-analysis-tab";
import { persistPref, renderWeapons } from "./27-weapons-tab";
import { cmpAuswahl, renderCompare } from "./28-compare";
import { renderSetup } from "./29-log-setup";
import { renderFights, renderRuns } from "./30-fight-list";
import { switchTab } from "./34-menus-drop-and-tabs";
import { applyWindowSize } from "./36-dialog";
import { standFolgen, syncWindowVars } from "./37-window-size-and-overlay";
import { readWeaponPair, renderParty, sendReport, syncSaveRunBtns } from "./42-party";
import { syncTabs } from "./43-more-menu-and-dev-mode";
import { renderStart, syncCompareBtn } from "./45-startup";
import { bestRecord, bossPulls, schluesselVon, verlaufPulls, waereBest } from "./46-best-pull";
import { bezugVon, paarVon } from "./47-paar";
import { syncStatusleiste } from "./55-statusleiste";
import { syncTafel } from "./56-tafel";
import { leerKnopf, leerTauschen, syncFelder } from "./58-felder";
import { renderEinst } from "./57-einstellungen";
import { syncWeeklies } from "./59-weeklies";
import { syncRekorde } from "./62-rekorde";
import { syncGilde } from "./68-gilde";
import { paarCode } from "../build-core";
import { besterPull, classDps, dummyClass, mindestLaenge, rangfolge } from "../best-pull-core";
import { MIN_MEDIAN, abendText, einordnungSkala, gleicherBezug, kampfPaar, mitte } from "../build-core";
import { TAG_MS, abendAchse, imZeitraum, mitDatum, pullLagen, zeitLagen, zeitSpanne, zusammenfuehren, type Spanne } from "../verlauf-core";
import type { CombatEvent, Encounter, Fight, FightStats, HistFight } from "../types";

/* Festgehalten wird, was diese App gesehen hat - nicht, was im Ordner liegt.
   Der erste Entwurf las beim Oeffnen des Reiters den ganzen Log-Ordner ein.
   Das hat auf diesem Rechner gut ausgesehen, weil dort 91 eigene Logs liegen;
   auf einem fremden Rechner haette es Logs mitgezaehlt, die dem Benutzer nie
   gehoert haben, und alte Kaempfe aus einer Zeit vor der App. Gewuenscht: "Am
   besten baust du den Zaehler fuer den AppData-Ordner, sodass ab der
   naechsten Version gezaehlt wird."

   Der Schluessel ist der Dateiname: waechst eine Datei beim Livelog weiter,
   ersetzt der neue Stand den alten, statt die Kaempfe doppelt zu zaehlen.
   Der Beispielkampf wird nie festgehalten - er ist niemandes Leistung.

   Seit dem Bautagebuch trug ein Kampf die Kennung eines Builds (b); seit
   #207 wird b nur noch weitergereicht, nie gelesen. Das Verzeichnis nimmt
   auch die Uebungspuppe auf: mit ihrer Laengenklasse (c) und der DPS ueber genau
   diese Laenge, wie "Gegen deinen besten Pull" sie misst. Der Verlauf zeigt
   die Puppe weiterhin nicht - histTargets() und histVerdict() lassen
   Eintraege mit c aus. Exportiert fuer 45-startup.ts: den letzten Kampf,
   wenn Live endet. */
/* Live (Spezifikation Live-Leistung 3): nur Kaempfe, die neu oder
   veraendert sind, werden neu gerechnet. loadTail() setzt die Menge fuer
   genau einen Aufruf; jeder andere Aufruf rechnet alle. Was ein Kampf
   ergab, merkt sich histMerk am Kampf selbst - einen, den segmentTail()
   stehen liess, gibt es als dasselbe Objekt wieder. */
let histNur: ReadonlySet<Encounter> | null = null;
const histMerk = new WeakMap<Encounter, HistFight | null>();

export function histRecord(){
  /* state.origin, nicht state.fromSample: loadText setzt fromSample gleich zu
     Beginn aus seinem eigenen Flag, eine von aussen gesetzte Marke ist bis
     hierher also schon ueberschrieben. origin traegt dieselbe Auskunft und
     steht, wenn das hier laeuft. */
  if(state.origin === "sample" || !state.text) return;
  const key = (state.fileNames || []).join(" + ");
  if(!key) return;
  /* Ein Log nur mit Uhrzeit (state.wall false, Fix verlauf-ohne-datum): der
     Beginn eines Kampfs ist dann die Zeit seit Mitternacht - im Verlauf hiesse
     er 01.01.1970, und zwei Kaempfe um 21:00 an zwei Tagen haetten dieselbe
     Kennung at. Solche Kaempfe kommen nicht ins Verzeichnis (Entscheidung vom
     05.10.2026). Ein Eintrag, der schon steht, bleibt unberuehrt: hier wird
     nichts geschrieben und nichts geloescht. Beim Nachlesen bleibt
     histStillFights leer. */
  if(!state.wall) return;
  // ein altes b (Zuordnung aus der Zeit des Builds-Reiters, #207): der alte Eintrag derselben Datei mit derselben Startzeit gibt es weiter, gelesen oder gezeigt wird es nirgends
  const altB = new Map((state.hist.files[key]?.fights ?? []).filter(x => typeof x.b === "string").map(x => [x.at, x.b!]));
  const fights: HistFight[] = [];
  state.encounters.forEach((seg) => {
    if(histNur && !histNur.has(seg) && histMerk.has(seg)){
      const alt = histMerk.get(seg);
      /* Das gemerkte Objekt gilt nur, solange sein b dem des Verzeichnisses entspricht (sonst neu rechnen). */
      if(!alt) return;
      if((alt.b ?? undefined) === altB.get(alt.at)){ fights.push(alt); return; }
    }
    histMerk.set(seg, null);
    // seg.stats, nicht stats(seg): segment() hat es dort schon abgelegt, und
    // das hier laeuft bei jedem Wachstum der Logdatei ueber alle Kaempfe
    const st = seg.stats || stats(seg);
    if(!(st.total > 0)) return;
    let c: number | null = null;
    if(practiceTarget(st.name)){
      // unter 58 s keine Klasse: ein abgebrochener Versuch ist keine Leistung
      c = dummyClass(st.seconds);
      if(c == null) return;
    } else if(!knownBoss(st.name)) return;
    const f: HistFight = {name: st.name,
      dps: c ? classDps(st.seconds, st.dps, perSecond(seg, 0).total, c) : st.dps,
      dmg: st.total, dur: st.seconds, at: seg.start};
    if(c) f.c = c;
    /* Die Summe einer Gruppe (mehrere Angreifer, "alle"): sie steht im
       Verlauf, ist aber nie dein bester Pull (Entscheidung 06.10.). Nur
       eine Zahl, kein Name. Das Nachlesen waehlt immer einen Angreifer. */
    if(state.players.length > 1 && state.player === "__all") f.g = 1;
    const b = altB.get(seg.start);
    if(b) f.b = b;
    // das Paar als zwei Zahlen, nie Text
    const w = paarCode(paarVon(seg, histStill) ?? []);
    if(w) f.w = w;
    /* Treffer, kritisch, schwer, verfehlt (Spezifikation Steckbrief 3.1 und
       4.3): vier ganze Zahlen, keine Namen. Treffer sind alle Schadenszeilen
       des Spielers in diesem Kampf, die Fehlschlaege eingeschlossen - die
       stehen nicht in seg.events (05-fights.ts zaehlt sie daneben). */
    const miss = seg.missed || 0;
    f.hits = st.hits + miss; f.crit = st.crit; f.heavy = st.heavy; f.miss = miss;
    topDazu(f, seg.events);
    fights.push(f); histMerk.set(seg, f);
  });
  /* Geschickt wird nur eine Aenderung (Spezifikation Live-Leistung 4). Die
     Groesse allein ist keine: sie waechst mit jeder Zeile, auch mit denen,
     die keinen Kampf aendern, und nichts liest sie. */
  // das Nachlesen der Rekorde nimmt die Kaempfe selbst entgegen und schreibt nichts hier (histNachlesen)
  if(histStill){ histStillFights = fights; return; }
  const alt = state.hist.files[key];
  /* Eine Datei, die bisher nur die Rekorde nachgelesen haben (nach), ist
     jetzt geoeffnet: ihr Eintrag wird der eines geoeffneten Logs. */
  const anders = fights.length
    ? !alt || !!alt.nach || JSON.stringify(alt.fights) !== JSON.stringify(fights)
    : !!alt;
  if(anders){
    if(!fights.length) delete state.hist.files[key];
    else state.hist.files[key] = {size: state.text.length, fights};
    histCollect();
    persistPref("logIndex", state.hist.files);
  }
  // dieselben Kaempfe, fuer "Gegen deinen besten Pull" (46-best-pull.ts)
  bestRecord(histNur);
}

/* Rekorde (Spezifikation Rekorde 3, Fixrunde 1): der hoechste Einzeltreffer
   des Spielers im Kampf als Zahl und die Kennung der Faehigkeit, die ihn
   traf (topSid) - nach Ventius boro:ventius -, nie ihr Name: das
   Verzeichnis nimmt keinen Text (Audit). Eine Kennung, die nicht dem festen
   Muster folgt, wird "". Den Namen, den das Log der Kennung gibt, kennt nur
   die Sitzung (die Liste darunter), fuer Faehigkeiten ohne Eintrag im Woerterbuch.
   Bei gleichem Wert der fruehere (die Ereignisse stehen nach der Zeit). */
const TOP_SID = /^(?:\d{1,12}|boro:[a-z-]{1,32})$/;
const topNamen = new Map<string, string>();
export const topName = (sid: string) => topNamen.get(sid) || "";
function topDazu(f: HistFight, ev: readonly CombatEvent[]){
  let top = ev[0];
  for(const e of ev) if(e.dmg > top!.dmg) top = e;
  if(top){ f.top = top.dmg; f.topSid = TOP_SID.test(top.sid) ? top.sid : ""; topNamen.set(top.sid, top.skill); }
}

/* ---------- Rekorde: eine fruehere Logdatei nachlesen (Spezifikation Rekorde 3) ----------
   Das einmalige Nachlesen (62-rekorde.ts) holt die Logdateien des Ordners
   ueber GET /api/log und traegt ihre Kaempfe in den Verlauf ein, wie es das
   Oeffnen der Datei taete - nur ohne sie zu zeigen. Gerechnet wird mit
   denselben Schritten wie loadText() (parseGrid, autoMap, buildEvents,
   segment, histRecord), damit derselbe Kampf dieselbe Zahl hat wie im
   Verlauf; ein eigener, einfacherer Schnitt haette das nicht.

   Diese Schritte arbeiten auf state. Darum merkt sich histNachlesen() den
   ganzen Stand vorher und legt ihn danach zurueck, Sets und Maps samt
   Inhalt - in einem Zug, ohne await dazwischen: die Seite sieht den
   fremden Stand nie. Was bleibt, ist allein top/topSid im Verzeichnis
   (state.hist): kein neuer Build (histRecord legt keinen an), kein bester
   Pull, kein Lernen von Ventius (setVentiusLernen). Die Merker von 04 und 05 (lauf, schnitt) zeigen
   danach auf den gelesenen Text; beide pruefen das selbst und schneiden
   beim naechsten Live-Takt ganz neu.

   Wessen Kampf: wie der Verlauf (meInLog, 17-class-names.ts) - ein Log mit
   einem Angreifer ist seiner; mit mehreren der Name der Gruppe oder der
   gewaehlte Angreifer, sonst ist nicht zu sagen, wer du bist, und die Datei
   bleibt ohne Kaempfe (fremd). Spielernamen werden nicht gespeichert.

   Eine schon geoeffnete Datei behaelt ihre Kaempfe, wie sie stehen; sie
   bekommen nur top und topSid dazu. Eine nie geoeffnete bekommt die
   Kopfzahlen, die histRecord ohnehin speichert (ohne Build), und zaehlt nur
   in den Rekorden (histCollect laesst nach-Eintraege aus).

   ab > 0: nur das neue Ende einer gewachsenen Datei (ab dem Byte, bis zu
   dem zuletzt gelesen wurde), vorn die Versionszeile der Datei. Die neuen
   Kaempfe kommen zu den alten. Jeder Eintrag merkt sich bytes (bis wohin
   gelesen) und nach (nur nachgelesen, nicht geoeffnet: "Zuletzt geoeffnet"
   auf Start laesst ihn aus). Geloescht wird nichts. */
let histStill = false, histStillFights: HistFight[] = [];
export type NachErgebnis = "ok" | "leer" | "fremd";
export function histNachlesen(name: string, text: string, ab: number, bytes: number, kopf: string): NachErgebnis {
  const s = state as unknown as Record<string, unknown>;
  const vorher = new Map<string, unknown>(), inhalt = new Map<string, unknown[]>();
  for(const k of Object.keys(s)){
    const v = s[k];
    vorher.set(k, v);
    if(v instanceof Set || v instanceof Map) inhalt.set(k, [...v]);
  }
  const alt = state.hist.files[name];
  const altFights = (alt?.fights || []) as HistFight[];
  let ergebnis: NachErgebnis = "leer";
  let neu: HistFight[] = [];
  try {
    state.fromSample = false; state.origin = "file";
    state.text = (ab > 0 && /^CombatLogVersion/i.test(kopf) ? kopf.split("\n")[0] + "\n" : "") + text;
    state.fileNames = [name];
    state.clearBefore = null; state.entfernt = new Set();
    const parsed = parseGrid(state.text);
    const mapping = parsed ? autoMap(parsed, profile(parsed)) : null;
    if(parsed && mapping && mapping.damage != null){
      state.parsed = parsed; state.mapping = mapping;
      buildEvents();
      const leute = state.players, gruppe = (state.party && state.party.name) || "", gewaehlt = vorher.get("player") as string;
      const ich = leute.length === 1 ? leute[0]!
        : gruppe && leute.includes(gruppe) ? gruppe
        : gewaehlt !== "__all" && leute.includes(gewaehlt) ? gewaehlt : null;
      if(ich === null) ergebnis = leute.length ? "fremd" : "leer";
      else {
        state.player = ich;
        setVentiusLernen(false);
        segment();
        histStill = true; histStillFights = [];
        histRecord();
        neu = histStillFights;
        ergebnis = "ok";
      }
    }
  } finally {
    histStill = false; setVentiusLernen(true);
    for(const k of Object.keys(s)) if(!vorher.has(k)) delete s[k];
    for(const [k, v] of vorher){
      s[k] = v;
      const i = inhalt.get(k);
      if(i && v instanceof Set){ v.clear(); for(const x of i) v.add(x); }
      if(i && v instanceof Map){ v.clear(); for(const [a, b] of i as [unknown, unknown][]) v.set(a, b); }
    }
  }
  /* Der Eintrag. Nichts geht verloren: beim neuen Ende stehen die alten
     Kaempfe und dahinter die neuen; beim ganzen Lesen gewinnt der neu
     gelesene Kampf (er traegt top), und ein Kampf, den nur der alte Eintrag
     kennt, bleibt (zusammenfuehren, ueber den Beginn). Eine Datei, die schon
     geoeffnet war, bleibt eine geoeffnete (kein nach). */
  const letzter = altFights.length ? Math.max(...altFights.map(f => f.at)) : -Infinity;
  const fights = ab > 0 ? altFights.concat(neu.filter(f => f.at > letzter))
    : alt && !alt.nach ? altFights.map(f => { const n = neu.find(x => x.at === f.at); return n && n.top != null ? {...f, top: n.top, topSid: n.topSid ?? ""} : f; })
    : zusammenfuehren(neu, altFights);
  const size = (ab > 0 && typeof alt?.size === "number" ? alt.size : 0) + text.length;
  state.hist.files[name] = !alt || alt.nach ? {size, bytes, nach: true, fights} : {...alt, size, bytes, fights};
  histCollect();
  persistPref("logIndex", state.hist.files);
  return ergebnis;
}

/* Verlauf, Einordnung und Start zaehlen nur, was geoeffnet
   wurde (gewuenscht: "ab der naechsten Version gezaehlt"); was die Rekorde nur
   nachgelesen haben (nach), zaehlen allein die Rekorde (rekordKaempfe). */
export function histCollect(){
  const alle: HistFight[] = [];
  Object.keys(state.hist.files).filter(n => !state.hist.files[n]!.nach).forEach(n =>
    (state.hist.files[n]!.fights || []).forEach(f => {
      // ein Kampf ohne Datum, der vor dem Fix ins Verzeichnis kam: bleibt dort, zaehlt aber nicht (mitDatum)
      if(mitDatum(f.at)) alle.push(Object.assign({file: n}, f));
    }));
  alle.sort((a, b) => a.at - b.at);
  state.hist.fights = alle;
}

/* Ein Kampf im Verlauf: aus dem Verzeichnis (logIndex) oder gespeichert -
   "Kampf speichern" (state.runs) und die besten Pulls (state.best). */
type VKampf = HistFight & { gespeichert?: boolean };
interface VZiel { key: string; name: string; fights: VKampf[]; best?: number; med?: number }

/* Die gespeicherten Kaempfe an bekannten Bossen, mit Uhr. Ein Kampf steht
   oft zugleich im Verzeichnis; zusammenfuehren() (verlauf-core.ts) nimmt ihn
   dann einmal, und zwar aus dem Verzeichnis, weil nur dort sein Waffenpaar (w) steht. */
function gespeicherteKaempfe(): VKampf[] {
  const raus: VKampf[] = [];
  for(const r of state.runs)
    if(r.when != null && !r.noTime && knownBoss(r.name))
      raus.push({name: r.name, dps: r.dps, dmg: r.total, dur: r.seconds, at: r.when, gespeichert: true});
  for(const key of Object.keys(state.best)){
    if(!key.startsWith("boss:")) continue;
    const e = state.best[key]!;
    for(const p of [e.best, e.second])
      if(p && knownBoss(p.run.name))
        raus.push({name: p.run.name, dps: p.run.dps, dmg: p.run.total, dur: p.run.seconds, at: p.at, gespeichert: true});
  }
  return raus;
}

/** Die Bosse, die der Verlauf zeigt (histKey) - fuer die Rekorde (62), die in ihn wechseln. */
export const verlaufZiele = (): Set<string> => new Set(histTargets().map(z => z.key));

function histTargets(): VZiel[] {
  const m = new Map<string, { key: string; name: string; log: VKampf[]; weg: VKampf[] }>();
  const zu = (f: VKampf, gespeichert: boolean) => {
    const k = histKey(f.name);
    let e = m.get(k);
    if(!e){ e = {key: k, name: f.name, log: [], weg: []}; m.set(k, e); }
    // state.hist.fights steht chronologisch: der letzte gewinnt, und das ist
    // die Schreibweise, die der Client zuletzt benutzt hat
    if(!gespeichert) e.name = f.name;
    (gespeichert ? e.weg : e.log).push(f);
  };
  // Uebungspuppe (c, seit dem Bautagebuch im Verzeichnis): nicht im Verlauf
  state.hist.fights.forEach(f => { if(!f.c) zu(f, false); });
  gespeicherteKaempfe().forEach(f => zu(f, true));
  return [...m.values()]
    /* Derselbe Kampf zweimal im Verzeichnis, als Summe der Gruppe (g) und
       als Kampf eines gewaehlten Angreifers: der ohne g gewinnt, sonst
       saesse Gold an einer Summe (Entscheidung 06.10.). */
    .map(e => ({key: e.key, name: e.name,
                fights: zusammenfuehren(e.log.filter(f => !f.g), e.weg, e.log.filter(f => f.g))}) as VZiel)
    /* Nur Bosse, und erst ab dem zweiten Kampf - einer allein ist kein Verlauf. */
    .filter(e => e.fights.length >= 2 && knownBoss(e.name))
    .map(e => {
      const d = e.fights.map(x => x.dps);
      // med bleibt unter MIN_MEDIAN weg, wie ueberall (histVerdict, build-core.ts)
      e.best = Math.max(...d);
      if(d.length >= MIN_MEDIAN) e.med = mitte(d);
      return e;
    })
    .sort((a, b) => b.fights.length - a.fights.length || b.best! - a.best!);
}

/* Datum und Uhrzeit auf der Uhr des Logs (UTC-Felder, wie wallTime und
   pullWhen): "20.09." bzw. "20/09" und "21:00". Vorher stand hier die Ortszeit
   des Rechners, und ein Kampf um 21:00 hiess im Verlauf 23:00. */
function tagText(ms: number){ return abendText(new Date(ms).toISOString().slice(0, 10), state.lang); }
function uhrText(ms: number){ return wallTime(ms).slice(0, 5); }

export function renderHistory(){
  const wrap = $("#histWrap"), det = $("#histDetail");
  if(!wrap) return;
  const ziele = histTargets();
  // der Satz steht nur im leeren Verlauf (#histLeer, unten)
  $("#histNote").textContent = t(state.origin === "sample" ? "hist.noteSample" : "hist.note");
  /* Der Satz darueber steht nur, solange der Verlauf leer ist: dann sagt er,
     was hier erscheinen wird (der Entwurf hat keinen Einleitungssatz). */
  const leerFeld = $("#histLeer");
  if(leerFeld.hidden !== !!ziele.length) leerFeld.hidden = !!ziele.length;
  /* Leer: der Knopf, der den Verlauf fuellt (leerKnopf, 58-felder.ts). Nur
     bei Aenderung geschrieben, sonst verloere er im Live-Takt den Fokus. */
  const akt = ziele.length ? "" : leerKnopf();
  const aktBox = $("#histAkt");
  if(aktBox.dataset.marke !== akt){ leerTauschen(aktBox, akt); aktBox.dataset.marke = akt; }
  wrap.hidden = !ziele.length;
  // der Zeitraum rechts in der Kopfzeile (Luecken 6.1), nur mit einem Verlauf
  const bkV = $("#bkVerlauf"), vSicht = !!ziele.length && state.tab === "history";
  if(bkV.hidden === vSicht) bkV.hidden = !vSicht;
  $("#verlaufZeit").querySelectorAll<HTMLElement>("button").forEach(b => {
    const an = b.dataset.z === state.hist.zeit ? "true" : "false";
    if(b.getAttribute("aria-pressed") !== an) b.setAttribute("aria-pressed", an);
  });
  if(!ziele.length) return;
  /* Der Boss: der gewaehlte; ohne Wahl der des Kampfs in der Kampfwahl, sonst
     der mit den meisten Kaempfen. */
  const seg = state.encounters[state.sel];
  const segName = seg ? (seg.stats || stats(seg)).name : "";
  if(!state.hist.sel || !ziele.some(z => z.key === state.hist.sel))
    state.hist.sel = (ziele.find(z => seg && z.key === histKey(segName)) || ziele[0]!).key;
  const z = ziele.find(x => x.key === state.hist.sel)!;   // sel was made one of them above
  histZiel = z;
  /* Der Zeitraum endet mit dem Tag des neuesten Kampfs am Boss (zeitSpanne,
     verlauf-core.ts); Liste und Diagramm zeigen dieselben Kaempfe. */
  const spanne = zeitSpanne(z.fights.map(f => f.at), state.hist.zeit)!;
  const k = imZeitraum(z.fights, spanne);
  histK = k;
  const logKey = (state.fileNames || []).join(" + ");
  /* Gold nur am besten Pull (Spezifikation Bester Pull 5.4), ueber die
     ganze Menge am Boss - liegt er nicht im Zeitraum, steht hier kein Gold.
     Tabelle und Diagramm heben denselben Kampf hervor. Der Verlauf fuehrt
     nur Bosse (histTargets), der Schluessel ist also immer "boss:". Gefunden
     ueber at: die Kaempfe hier tragen seg.start als at (histRecord). Die
     Menge ist die des Verzeichnisses (verlaufPulls), nicht die des
     geladenen Logs: der Verlauf zeigt immer alles. */
  const goldPull = besterPull(verlaufPulls("boss:" + z.key));
  const besterK = goldPull ? k.findIndex(f => f.at === goldPull.at) : -1;
  // Dieser Kampf: der in der Kampfwahl, falls er hier steht (histRecord schreibt seg.start als at)
  const cur = seg && histKey(segName) === z.key ? k.findIndex(f => f.at === seg.start) : -1;
  /* Die Wahl (Zeile <-> Punkt): festgehalten am Kampf, nicht am Index -
     kommt im Live ein Kampf dazu, verschiebt sich der Index. Ohne eigene
     Wahl dieser Kampf, sonst der neueste. Ihr Tag ist der gewaehlte Tag im
     Diagramm. */
  let wahl = histWahl && histWahl.z === z.key ? k.findIndex(f => histKampfId(f) === histWahl!.id) : -1;
  if(wahl < 0) wahl = cur >= 0 ? cur : k.length - 1;

  // Kopf: Boss, Anzahl, Zeitraum; rechts die Einordnung dieses Kampfs (DECISION 2.4)
  const letzterTag = spanne.bis - TAG_MS;
  const zText = state.hist.zeit === "woche" ? t("verlauf.bisWoche", {d: tagText(letzterTag)})
    : state.hist.zeit === "monat" ? t("verlauf.bisMonat", {d: tagText(letzterTag)}) : t("verlauf.seit", {d: tagText(spanne.von)});
  const kopfHtml = '<p class="vzeile" id="histKopf">' + bossMark(z.name) + "<span>" +
    esc(t("verlauf.kopf", {boss: z.name, n: k.length, zeit: zText})) + "</span></p>" + einordHtml(z.key);
  const kz = $("#histKopfZeile");
  if(kz.dataset.marke !== kopfHtml){ kz.innerHTML = kopfHtml; kz.dataset.marke = kopfHtml; }

  // Diagramm und Legende: so gross wie seine Flaeche (#histVpl, Hoehe aus styles.css)
  const vpl = $("#histVpl");
  const W = vpl.clientWidth > 0 ? Math.max(240, Math.floor(vpl.clientWidth)) : 600;
  const H = vpl.clientHeight > 0 ? Math.max(160, Math.floor(vpl.clientHeight)) : 260;
  /* Der Abend zuerst (Feinschliff 02.10., Abschnitt 4): liegen die Kaempfe
     im Zeitraum an einem Abend (hoechstens zwei Tage hintereinander), stehen
     die Pulls nacheinander statt als Streifen am Rand der Datumsachse. */
  const abend = abendAchse(k.map(f => f.at));
  const bild = histPlot(z, k, cur, wahl, besterK, W, H, spanne, logKey, abend);
  if(vpl.dataset.marke !== bild.svg){ vpl.innerHTML = bild.svg; vpl.dataset.marke = bild.svg; }
  const hatLog = k.some(f => f.file === logKey), hatAlt = k.some(f => f.file !== logKey);
  const leg = (hatLog ? '<span><i class="p log"></i>' + esc(t("verlauf.lgLog")) + "</span>" : "") +
    (hatAlt ? '<span><i class="p alt"></i>' + esc(t("verlauf.lgFrueher")) + "</span>" : "") +
    // "bester" nur, wo ein Punkt Gold traegt (der beste Pull im Zeitraum)
    (besterK >= 0 ? '<span><i class="p best"></i>' + esc(t("tafel.bester")) + "</span>" : "") +
    (bild.median != null ? '<span><i class="l"></i>' + esc(t("verlauf.median") + " " + fmt(bild.median)) + "</span>" : "") +
    (abend ? '<span class="vlgachse">' + esc(t("verlauf.lgAbend")) + "</span>" : "");
  const lg = $("#histLeg");
  if(lg.dataset.marke !== leg){ lg.innerHTML = leg; lg.dataset.marke = leg; }

  /* die Liste "Kaempfe": neueste zuerst; sie reicht bis zur Unterkante der
     Flaeche (histListeHoehe), mindestens fuenf Zeilen */
  const zeilen = k.map((f, i) =>
    '<tr data-k="' + i + '" tabindex="' + (i === wahl ? 0 : -1) + '" aria-selected="' + (i === wahl) + '"' +
    ((i === besterK || i === cur) ? ' class="' + [i === besterK ? "best" : "", i === cur ? "cur" : ""].filter(Boolean).join(" ") + '"' : "") + ">" +
    '<td class="htag">' + bossMark(z.name) + "<span>" + esc(tagText(f.at)) + "</span></td>" +
    "<td>" + esc(uhrText(f.at)) + "</td>" +
    /* dur(), nicht secs1(): jede andere Flaeche der App schreibt "7m 22s";
       unter einer Minute gibt dur() ohnehin secs1 zurueck. */
    "<td>" + esc(dur(f.dur)) + "</td>" +
    '<td class="hd num">' + esc(fmt(f.dps)) + "</td></tr>").reverse().join("");
  /* "Im Vergleich öffnen" (DECISION 6.10): ein leiser Knopf ueber der Liste,
     nur wenn es dort etwas zu waehlen gibt. */
  const vgl = cmpAuswahl().length >= 2
    ? '<button class="leise" type="button" id="histCmp" title="' + esc(t("hist.compareLine")) + '">' + esc(t("hist.compareBtn")) + "</button>" : "";
  const optionen = ziele.map(x => '<option value="' + esc(x.key) + '"' + (x.key === z.key ? " selected" : "") + ">" + esc(x.name) + "</option>").join("");
  const html =
    '<div class="fk"><h3 id="histListeT">' + esc(t("verlauf.kaempfe")) + '</h3><span class="fz">' +
      esc(t("verlauf.kaempfeZahl", {n: k.length, boss: z.name})) + '</span><span class="fa">' + vgl +
      '<label for="histBoss">' + esc(t("verlauf.boss")) + '</label><select id="histBoss" class="auswahl">' + optionen + "</select></span></div>" +
    '<div class="histroll"><table class="histtab"><thead><tr>' +
    "<th>" + esc(t("verlauf.colTag")) + "</th><th>" + esc(t("verlauf.colUhr")) + "</th><th>" + esc(t("verlauf.colDauer")) + "</th>" +
    '<th class="hd">' + esc(t("hist.colDps")) + "</th>" +
    "</tr></thead><tbody>" + zeilen + "</tbody></table></div>";
  /* Geschrieben wird nur bei Aenderung (Live-Takt). Stand der Fokus auf
     einer Zeile, steht er danach wieder auf ihr; stand er im Auswahlfeld
     oder auf dem Knopf, dort. */
  if(html !== detZuletzt){
    const a = document.activeElement instanceof HTMLElement && det.contains(document.activeElement) ? document.activeElement : null;
    const fokusZeile = a?.closest<HTMLElement>("tr[data-k]")?.dataset.k ?? null;
    const fokusId = a && a.id ? a.id : null;
    const roll = det.querySelector<HTMLElement>(".histroll")?.scrollTop ?? 0;
    detZuletzt = html;
    det.innerHTML = html;
    const r = det.querySelector<HTMLElement>(".histroll");
    if(r) r.scrollTop = roll;
    if(fokusZeile != null) det.querySelector<HTMLElement>('tr[data-k="' + fokusZeile + '"]')?.focus();
    else if(fokusId) document.getElementById(fokusId)?.focus();
  }
  histListeHoehe();
  const brueck = $("#histCmp");
  if(brueck) brueck.onclick = () => switchTab("compare");
  $<HTMLSelectElement>("#histBoss").onchange = e => {
    state.hist.sel = (e.target as HTMLSelectElement).value;
    renderHistory();
  };
  /* Zeile und Punkt waehlen sich gegenseitig: Klick auf eine Zeile oder
     einen Punkt, Enter oder Leertaste auf einer Zeile. Die Pfeile bewegen
     nur den Fokus zwischen den Zeilen (die gewaehlte ist der Tabstopp);
     nach dem Waehlen steht der Fokus auf der Zeile des Kampfs - auch nach
     einem Klick auf einen Punkt, die Punkte selbst nehmen keinen Fokus. */
  det.onclick = e => {
    const ziel = (e.target as Element).closest<HTMLElement>("tbody tr[data-k]");
    if(ziel && det.contains(ziel)) histWaehle(+ziel.dataset.k!);
  };
  vpl.onclick = e => {
    const ziel = (e.target as Element).closest<SVGElement>("[data-k]");
    if(ziel && vpl.contains(ziel)) histWaehle(+ziel.dataset.k!);
  };
  det.onkeydown = e => {
    const tr = (e.target as Element).closest?.<HTMLElement>("tbody tr[data-k]");
    if(!tr || e.target !== tr) return;
    if(e.key === "Enter" || e.key === " "){ e.preventDefault(); histWaehle(+tr.dataset.k!); return; }
    const n = e.key === "ArrowDown" ? tr.nextElementSibling : e.key === "ArrowUp" ? tr.previousElementSibling
      : e.key === "Home" ? tr.parentElement!.firstElementChild : e.key === "End" ? tr.parentElement!.lastElementChild : null;
    if(n instanceof HTMLElement){ e.preventDefault(); n.focus(); }
  };
  if(!histRO && typeof ResizeObserver !== "undefined"){
    /* Das Diagramm ist so gross wie seine Flaeche: aendert sie sich, wird es
       neu gezeichnet (im naechsten Bild, nicht im Beobachter selbst). */
    histRO = new ResizeObserver(() => requestAnimationFrame(() => {
      const v = $("#histVpl");
      if(state.tab === "history" && !$("#histWrap").hidden &&
         v.clientWidth + "x" + v.clientHeight !== plotZuletzt) renderHistory();
    }));
    histRO.observe(vpl);
    /* Die Liste waechst mit der Fensterhoehe - auch dort, wo das Diagramm
       seine Hoehe schon erreicht hat und der Beobachter schweigt. */
    addEventListener("resize", () => { if(state.tab === "history" && !$("#histWrap").hidden) histListeHoehe(); });
  }
}

/* Die Liste "Kaempfe" reicht bis zur Unterkante der Flaeche (Feinschliff
   02.10., Abschnitt 4; DESIGN.md: mehr Hoehe heisst mehr Zeilen): so viele
   ganze Zeilen, wie zwischen ihrem Kopf und der Statusleiste Platz haben,
   mindestens fuenf - wird es flacher, rollt die Seite wie bisher. Gemessen
   bei ungerollter Seite (scrollY dazugerechnet); geschrieben nur bei
   Aenderung, der Live-Takt ruft hier oft vorbei. */
function histListeHoehe(){
  const det = $("#histDetail"), roll = det.querySelector<HTMLElement>(".histroll");
  if(!roll || !roll.getClientRects().length) return;
  const kopf = roll.querySelector<HTMLElement>("thead tr"), zeile = roll.querySelector<HTMLElement>("tbody tr");
  const kh = kopf ? kopf.getBoundingClientRect().height : 30;
  const zh = zeile ? zeile.getBoundingClientRect().height : 32;
  if(!(zh > 0)) return;
  const luft = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--flaeche-luft")) || 0;
  const sb = document.querySelector<HTMLElement>(".statusleiste");
  const boden = (sb && sb.getClientRects().length ? sb.getBoundingClientRect().top : innerHeight) + scrollY - luft -
    (parseFloat(getComputedStyle(det).paddingBottom) || 0);
  const oben = roll.getBoundingClientRect().top + scrollY;
  const n = Math.max(5, Math.floor((boden - oben - kh + 0.5) / zh));
  const max = (kh + n * zh).toFixed(2) + "px";
  if(roll.style.maxHeight !== max) roll.style.maxHeight = max;
}

/* ---------- das Diagramm ueber die Zeit (Luecken 6.1-6.4, verlauf-core.ts) ---------- */
let histZiel: VZiel | null = null;
let histK: VKampf[] = [];
let histWahl: {z: string; id: string} | null = null;
let detZuletzt = "", plotZuletzt = "";
let histRO: ResizeObserver | null = null;
const histKampfId = (f: HistFight) => f.at + "|" + (f.file || "");

function histWaehle(i: number){
  const z = histZiel, f = histK[i];
  if(!z || !f) return;
  histWahl = {z: z.key, id: histKampfId(f)};
  renderHistory();
  $("#histDetail").querySelector<HTMLElement>('tbody tr[data-k="' + i + '"]')?.focus();
}

/* Die Einordnung dieses Kampfs (DECISION 2.4: die Skala zieht aus dem Kampf
   in den Verlauf): der Satz von histVerdict() und die Skala mit "sonst"
   (Median), dem hoechsten Wert und diesem Kampf (einordnungSkala,
   build-core.ts). Nur, wenn der Kampf in der Kampfwahl an diesem Boss ist
   und es einen Median gibt. Die Marke heisst "hoechster", nicht "bester":
   v.max ist der hoechste Wert der Menge, auch ein kurzer Pull unter der
   Schwelle; der beste Pull nach der Regel traegt im Diagramm das Gold.
   Die Kennung "bester" (Klasse, data-marke) bleibt. */
const MIDDOT = "\u00b7";
function einordHtml(key: string): string {
  const seg = state.encounters[state.sel];
  if(!seg) return "";
  const st = seg.stats || stats(seg);
  if(histKey(st.name) !== key) return "";
  const v = histVerdict();
  if(!v.text || v.med == null || v.max == null) return "";
  const s = einordnungSkala(v.med, v.max, st.dps);
  const marke = (m: string, lage: number, wert: number, text: string) =>
    '<span class="emarke ' + m + '" data-marke="' + m + '" data-wert="' + wert + '" style="left:' + (100 * lage).toFixed(2) + '%">' +
    (text ? '<span class="etext">' + esc(text) + "</span>" : "") + "</span>";
  return '<div class="veinord' + (v.best ? " best" : "") + '" id="histEinord" role="img" aria-label="' +
    esc(t("verlauf.einordName", {satz: v.text + " " + MIDDOT + " " + t("verlauf.einordAlle"), sonst: fmt(v.med), bester: fmt(v.max), dieser: fmt(st.dps)})) + '">' +
    /* Die Skala rechnet ueber alle Tage am Boss, nicht nur den Zeitraum des
       Diagramms - der Satz sagt das (Pruefung 29.09., Befund 3). */
    '<span class="etextzeile" aria-hidden="true">' + esc(v.text + " " + MIDDOT + " " + t("verlauf.einordAlle")) + "</span>" +
    '<span class="eskala" aria-hidden="true"><i class="elinie"></i>' +
    marke("sonst", s.sonst, v.med, t("verlauf.sonst")) + marke("bester", s.bester, v.max, t("verlauf.hoechster")) + marke("dieser", s.dieser, st.dps, "") +
    "</span></div>";
}

/* Die Werte der y-Achse, rund wie die Schritte selbst: "100k", "12.5k" - fmt()
   schriebe "100.0k". Kurzzahlen mit Punkt, auch im Deutschen (DESIGN.md). */
function achsText(v: number){
  if(!v) return "0";
  const x = v >= 1e6 ? v / 1e6 : v >= 1e3 ? v / 1e3 : v;
  return String(+x.toFixed(2)) + (v >= 1e6 ? "M" : v >= 1e3 ? "k" : "");
}
function histPlot(z: VZiel, k: VKampf[], cur: number, wahl: number, gold: number, W: number, H: number, spanne: Spanne, logKey: string, abend: boolean):
    { svg: string; median: number | null } {
  plotZuletzt = W + "x" + H;
  const rand = {links: 52, rechts: 12, oben: 28, unten: 24};
  const innen = W - rand.links - rand.rechts;
  /* Datumsachse: hoechstens acht Beschriftungen, auf schmalen Flaechen
     weniger (je etwa 90 Punkt). Pull-Achse: eine Uhrzeit je etwa 56 Punkt. */
  /* gold: der Index des besten Pulls in k, -1 ohne (renderHistory); die
     y-Achse richtet sich weiter nach dem hoechsten Punkt */
  const L = abend ? pullLagen(k, {breite: W, hoehe: H, rand}, Math.max(2, Math.floor(innen / 56)), gold)
    : zeitLagen(k, {breite: W, hoehe: H, rand}, spanne, Math.min(8, Math.max(2, Math.floor(innen / 90))), gold);
  const oben = rand.oben, unten = H - rand.unten, links = rand.links, rechts = W - rand.rechts;
  let h = "";
  /* der gewaehlte Tag als Band, sein Datum darueber. Auf der Pull-Achse
     eines einzigen Tages deckte das Band die ganze Flaeche: dann steht nur
     das Datum da. */
  const tag = wahl >= 0 ? k[wahl] : undefined;
  if(tag){
    const b = L.band(tag.at);
    const ganz = L.art === "pull" && b.x0 <= links + 0.5 && b.x1 >= rechts - 0.5;
    h += (ganz ? "" : '<rect class="hpband" x="' + b.x0.toFixed(2) + '" y="' + oben + '" width="' + (b.x1 - b.x0).toFixed(2) + '" height="' + (unten - oben) + '" rx="3"/>') +
         '<text class="hpbandt" x="' + ((b.x0 + b.x1) / 2).toFixed(1) + '" y="' + (oben - 8) + '" text-anchor="middle">' + esc(tagText(tag.at)) + "</text>";
  }
  for(const v of L.striche)
    h += '<line class="hpgrid" data-wert="' + v + '" x1="' + links + '" x2="' + rechts + '" y1="' + L.y(v).toFixed(1) + '" y2="' + L.y(v).toFixed(1) + '"/>' +
         '<text class="hpt" x="' + (links - 8) + '" y="' + (L.y(v) + 4).toFixed(1) + '" text-anchor="end">' + esc(achsText(v)) + "</text>";
  h += '<text class="hpytitel" x="' + (links - 8) + '" y="' + (oben - 8) + '" text-anchor="end">' + esc(t("hist.colDps")) + "</text>" +
       '<line class="hpachse" x1="' + links + '" x2="' + links + '" y1="' + oben + '" y2="' + unten + '"/>';
  /* die x-Achse: auf der Datumsachse das Datum in der Mitte seines Tages,
     auf der Pull-Achse die Uhrzeit unter ihrem Pull. Geht der Abend ueber
     Mitternacht, traegt die erste Marke des neuen Tages das Datum dazu
     ("21.09. 00:20") - "00:20" allein hinter "23:50" waere mehrdeutig. */
  let tagDavor = L.marken.length ? Math.floor(L.marken[0]!.at / TAG_MS) : 0;
  for(const m of L.marken){
    const tagM = Math.floor(m.at / TAG_MS);
    const text = L.art !== "pull" ? tagText(m.at) : tagM !== tagDavor ? tagText(m.at) + " " + uhrText(m.at) : uhrText(m.at);
    tagDavor = tagM;
    h += '<text class="hpx" x="' + m.x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(text) + "</text>";
  }
  if(L.median != null && L.medianY != null)
    h += '<line class="hpmed" data-wert="' + L.median + '" x1="' + links + '" x2="' + rechts + '" y1="' + L.medianY.toFixed(1) + '" y2="' + L.medianY.toFixed(1) + '"/>';
  /* Die Punkte: aus diesem Log gefuellt, aus frueheren Logs und gespeichert
     hohl, der beste in Gold, die Wahl mit dem Ring (--pick); die Groesse ist
     die Dauer (punktRadius). */
  L.punkte.forEach((p, i) => {
    const f = k[i]!;
    const cx = p.x.toFixed(3), cy = p.y.toFixed(3);
    const art = (f.file === logKey ? " hplog" : " hpalt") + (i === L.bester ? " hpspitze" : "") + (i === cur ? " hpcur" : "");
    h += '<g class="hpk" data-k="' + i + '"><title>' + esc(tagText(f.at) + " " + uhrText(f.at) + " \u00b7 " + fmt(f.dps) + " \u00b7 " + dur(f.dur)) + "</title>" +
         (i === wahl ? '<circle class="hpring" data-k="' + i + '" cx="' + cx + '" cy="' + cy + '" r="' + (p.r + 4).toFixed(2) + '"/>' : "") +
         '<circle class="hp' + art + '" data-k="' + i + '" data-at="' + f.at + '" data-dps="' + f.dps + '" data-dur="' + f.dur + '" cx="' + cx + '" cy="' + cy + '" r="' + p.r.toFixed(4) + '"/></g>';
  });
  const dieser = cur >= 0 ? fmt(k[cur]!.dps) : "";
  /* Der Name nennt den goldenen Punkt; liegt der beste Pull nicht im
     Zeitraum, laesst er "Bester" weg (die Texte fragen best ab). */
  const best = L.bester >= 0 ? fmt(k[L.bester]!.dps) : "";
  const pull = L.art === "pull";
  const name = L.median != null
    ? t(pull ? "verlauf.plotNamePull" : "verlauf.plotName", {boss: z.name, n: k.length, best, med: fmt(L.median), dieser})
    : t(pull ? "verlauf.plotNamePullFew" : "verlauf.plotNameFew", {boss: z.name, n: k.length, best, dieser});
  return {median: L.median, svg: '<svg class="histplot" data-achse="' + L.art + '" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H +
    '" role="img" aria-label="' + esc(name) + '">' + h + "</svg>"};
}

/* Die eine Zeile, die im Alltag zaehlt: wo steht der Kampf, den du gerade
   ansiehst, zwischen deinen anderen an diesem Ziel? */
/* seg: ab Werk der gewaehlte Kampf; die Meldung nach dem Kampf (66) fragt
   nach dem beendeten. p ist die gerundete Abweichung vom Median in Prozent
   (fuer die Meldung), wo der Satz gegen den Median rechnet. */
type HistUrteil = {text: string; best: boolean; med?: number | undefined; max?: number; n?: number; p?: number};
export function histVerdict(seg: Fight | undefined = state.encounters[state.sel]): HistUrteil {
  // med/max/n fuer die Skala im Streifen (56-tafel.ts), sonst fehlen sie
  const leer: HistUrteil = {text: "", best: false};
  if(!seg) return leer;
  const st = stats(seg);
  const schluessel = histKey(st.name);
  /* Zwei Quellen, in dieser Reihenfolge.

     Die erste ist das Verzeichnis: was diese App ueber alle Abende gesehen
     hat. Es haelt nur Bosse fest - ein Uebungsziel steht gar nicht darin -,
     und das ist richtig so, denn es soll ueber Monate tragen.

     Die zweite ist das geladene Log. Sie hat gefehlt, und deshalb sagte der
     Kopf an einem ganzen Abend kein einziges Mal, ob eine Zahl gut war:
     nachgemessen am eigenen Log vom 19.09. stehen neun bekannte Bosse im
     Verzeichnis, und jeder kam GENAU EINMAL vor - unter zwei Kaempfen gibt
     es nichts einzuordnen. Die Ziele, die sich wirklich wiederholten,
     waren keine bekannten Bosse: Schneefeld-Baer fuenfmal, Alraune
     fuenfmal, Leopard viermal, Uralter Ritter dreimal. Null von 66.

     Fuenf Pulls auf denselben Gegner sind aber genau das, was man
     vergleichen will, ob der Gegner nun im Verzeichnis steht oder nicht.
     Also faellt die Bossregel fuer diese zweite Quelle weg - nur
     Uebungsziele bleiben draussen, denn dort ist jede Pause das Ende eines
     Versuchs und keine Leistung.

     Und der Satz sagt, welche Quelle er meint: "an diesem Boss" fuer das
     Verzeichnis, "in diesem Log" fuer den Abend. Sonst behauptete eine
     Zahl aus fuenf Pulls eines Abends, sie waere ein Urteil ueber alles,
     was man je gespielt hat. */
  const ausVerzeichnis = knownBoss(st.name)
    ? state.hist.fights.filter(f => !f.c && histKey(f.name) === schluessel) : [];
  let andere: (HistFight | FightStats)[] = ausVerzeichnis, quelle = "boss";
  if(andere.length < 2 && !practiceTarget(st.name)){
    andere = state.encounters
      .filter(x => histKey((x.stats || stats(x)).name) === schluessel)
      .map(x => x.stats || stats(x));
    quelle = "log";
  }
  /* Dasselbe Waffenpaar (seit #207 ohne Builds): nur Kaempfe mit diesem Paar,
     wo es davon zwei gibt. Sonst stand ueber einem Dolch-Kampf "14 %
     schlechter als sonst", gemessen an einem Median, den der Bogen gesetzt
     hatte - richtig gerechnet und doch keine Auskunft ueber diesen Kampf.
     Gibt es keine zwei, bleibt es beim Boss oder Log, und der Satz sagt dann
     nichts vom Paar. */
  /* Die Menge der Quelle als Pulls (Bester Pull 3): fuer "bester mit
     diesem Paar" unten. hier: ist es der Kampf, um den es geht - im Verzeichnis
     ueber at (dort steht seg.start), im Log ueber das Objekt. Ohne die
     Summen einer Gruppe (g): sie sind nie "dein bester Kampf", auch nicht
     mit diesem Paar (Entscheidung 06.10.). Median, Skala und n rechnen
     weiter mit andere, wie sie ist. */
  type BauPull = {at: number; dps: number; dur: number; hier: boolean};
  let logSegs = quelle === "log" ? state.encounters.filter(x => histKey((x.stats || stats(x)).name) === schluessel) : [];
  const alsPulls = (): BauPull[] => quelle === "boss"
    ? (andere as HistFight[]).filter(f => !f.g).map(f => ({at: f.at, dps: f.dps, dur: Number.isFinite(f.dur) ? f.dur : 0, hier: f.at === seg.start}))
    : logSegs.map(x => { const s = x.stats || stats(x); return {at: x.start, dps: s.dps, dur: s.seconds, hier: x === seg}; });
  /* Die Schwelle misst immer die ganze Menge am Boss (Bester Pull 3), nie
     nur ein Paar. Ein Ziel ohne Schluessel (kein bekannter Boss, nur im
     Log): die ganze Quelle - gemessen, bevor unten gefiltert wird.
     Unter zwei Kaempfen bleibt es leer (unten); der Filter nach dem
     Paar macht die Menge nie groesser, also gleich hier aussteigen. Die
     Menge am Boss einmal geholt: fuer die Schwelle und fuer Gold (waereBest). */
  if(andere.length < 2) return leer;
  const key = schluesselVon(st.name, st.seconds);
  const idx = state.encounters.indexOf(seg);
  const menge = key ? bossPulls(key, idx >= 0 ? idx : undefined) : null;
  const schwelle = mindestLaenge(menge ?? alsPulls());
  const hier = bezugVon(seg);
  let mit = "";
  if(hier){
    const mitText = t("hist.withPair");
    if(quelle === "boss"){
      const gleich = (andere as HistFight[]).filter(f => gleicherBezug(hier, kampfPaar(f)));
      if(gleich.length >= 2){ andere = gleich; mit = mitText; }
    } else {
      const gleich = logSegs.filter(x => gleicherBezug(hier, bezugVon(x)));
      if(gleich.length >= 2){ logSegs = gleich; andere = gleich.map(x => x.stats || stats(x)); mit = mitText; }
    }
  }
  /* Unter zwei Kaempfen gibt es nichts einzuordnen: "deine beste von einer"
     ist keine Auskunft, sondern eine Tautologie. Das braucht keinen Median,
     nur den besten Wert - und der steht schon mit zwei Kaempfen fest. */
  if(andere.length < 2) return leer;
  const best = Math.max(...andere.map(f => f.dps));
  /* Fuer die Skala im Streifen (56-tafel.ts): dieselben Zahlen, gegen die
     der Satz rechnet - der Median erst ab MIN_MEDIAN, sonst keiner. */
  const med = andere.length >= MIN_MEDIAN ? mitte(andere.map(f => f.dps)) : undefined;
  const zahlen = {med, max: best, n: andere.length};
  /* "Bester" nach der Regel (Bester Pull 5.4), nicht nach der hoechsten
     Zahl: ein kurzer Pull unter der Schwelle ist nie "dein bester". Ohne
     Paar steht der Satz genau am besten Pull (Gold, waereBest: ueber den
     Index, nicht ueber at - ohne Datum ist at nur die Zeit seit
     Mitternacht). Mit Paar steht er am ersten der Rangfolge dieser Menge,
     mit der Schwelle der ganzen Menge; Gold nur, wenn er zugleich der
     beste Pull ist. Sonst geht es gegen den Median wie bei jedem Kampf.
     Die Skala (max) bleibt der hoechste Wert.
     Ein Ziel ohne Schluessel (nur im Log) hat keinen besten Pull und nie
     Gold; dort gilt ohne Paar dieselbe Regel ueber die Kaempfe im Log,
     ab zwei Kaempfen wie bei besterPull. */
  const istGold = !!menge && waereBest(seg, menge);
  // mitBau: der Filter nach dem Paar hat gegriffen
  const mitBau = mit !== "";
  const vorn = mitBau ? !!rangfolge(alsPulls(), schwelle)[0]?.hier
    : key ? istGold
    : andere.length >= 2 && !!rangfolge(alsPulls(), schwelle)[0]?.hier;
  if(vorn)
    return {text: t(quelle === "log" ? "hist.yourBestLog" : "hist.yourBest",
                    {n: andere.length, mit}), best: istGold, ...zahlen};
  /* Ab hier vergleicht der Satz gegen den Median, nicht gegen den besten
     Wert - und der braucht MIN_MEDIAN Kaempfe (dieselbe Schwelle wie das
     Bautagebuch, build-core.ts). Bei genau zwei waere mitte() nur der
     Mittelwert der beiden, und ein einziger schwacher Pull zoege "sonst"
     mit sich: "14 % schlechter als sonst" hiesse dann wenig. Ohne Median
     bleibt es beim Satz von oben: nichts. */
  if(andere.length < MIN_MEDIAN) return leer;
  const p = Math.round(100 * (st.dps / med! - 1));
  /* Genau auf dem Median: "0 % besser als sonst" ist keine Auskunft. Die
     alte, laengere Fassung erklaerte sich mit "0 % ueber deinem Median aus
     11" wenigstens selbst; die kurze muss es sagen. */
  /* Mit der Anzahl, wie beim Lob. Sie stand hier schon im Aufruf und wurde
     von den Texten nicht benutzt: "Deine beste Performance von 4 Kaempfen"
     nannte seine Grundlage, "46 % schlechter als sonst" nicht. Dieselbe
     Funktion, dieselbe Zahl - und nur die gute Nachricht durfte sich
     belegen. */
  const woher = quelle === "log" ? "Log" : "";
  if(p === 0) return {text: t("hist.sameMed"+woher, {n: andere.length, mit}), best: false, ...zahlen, p};
  return {text: t((p > 0 ? "hist.aboveMed" : "hist.belowMed")+woher,
                  {p: Math.abs(p), n: andere.length, mit}), best: false, ...zahlen, p};
}

export function renderAll(){
  const has = state.encounters.length > 0;
  /* Hier und nicht in renderBars: bei leerer Liste kehrt renderBars vorher
     um, und der Speichern-Knopf blieb dann aktiv stehen - genau in dem
     Zustand, in dem es nichts zu speichern gibt. */
  syncSaveRunBtns();
  /* Ein anderer Kampf, eine andere Datei, Live: der offene Streifen erfaehrt
     es (Kompakt-Fix 01.10.; nur bei einer Aenderung, 37). Vorn, weil
     renderAll weiter unten an mehreren Stellen frueh umkehrt. */
  standFolgen();
  // party content can be worth showing before any local fight ever loads —
  // either the setup tab itself, or (now that Party is a grouping mode of
  // the always-visible table) actively viewing the party's numbers
  const inPartyGroup = state.group === "party" && !!(state.party && (state.party.role || state.party.frozen));
  // A file is loaded whose damage column we could not find. It yields no
  // fights, so the rule above would hide the app behind the start screen —
  // including Log setup, the one tab that can still rescue that file.
  /* Any parsed file, not only one missing its damage column. Standing on Log
     setup and changing the separator to a wrong one yields no fights — and the
     start screen would then cover the very controls needed to change it back.
     Measured: picking "Column names" on a log that has none dropped the fight
     count to zero and put the landing screen over the tab mid-adjustment. */
  const setupOnly = !has && !!state.parsed && state.tab === "setup";
  /* A log is open and its list was emptied — by the Clear button or by a filter
     that nothing matches. That is not "no log yet", which is the only thing the
     start screen is for, so the meter stays and says it is waiting. */
  const clearedOnly = !has && !!state.parsed && !!state.text;
  const partyOnly = !has && (state.tab === "party" || inPartyGroup);
  const solo = partyOnly || setupOnly || clearedOnly;
  /* Start (Instrumententafel 3.3) zeigt die Startseite auch mit Log - nur
     nicht im Kompaktstreifen, der zeigt den Kampf; zurueck in der
     Vollansicht steht wieder Start. */
  const kompakt = document.body.classList.contains("compact");
  const start = state.start && !kompakt;
  /* Die Einstellungen (57) sind der dritte Ort: sie verdecken Startseite und
     Kampf. Im Kompakt gelten sie nicht; zurueck in der Vollansicht stehen
     sie wieder. Genau einer von #land, #einst, #app ist sichtbar. */
  const einst = state.einst && !kompakt;
  /* Weeklies (Neugestaltung 28.09., 9.1) sind der vierte Ort, wie die
     Einstellungen: genau einer von #land, #einst, #weeklies, #app. */
  const weeklies = state.weeklies && !einst && !kompakt;
  /* Die Rekorde (62, Spezifikation Rekorde 2a) sind der fuenfte Ort, wie die Weeklies. */
  const rekorde = state.rekorde && !einst && !weeklies && !kompakt;
  /* Die Gilde (68, Spezifikation Gilde 5) ist der sechste Ort, wie die Weeklies. */
  const gilde = state.gilde && !einst && !weeklies && !rekorde && !kompakt;
  $("#land").hidden = ((has || solo) && !start) || einst || weeklies || rekorde || gilde;
  $("#app").hidden = (!has && !solo) || start || einst || weeklies || rekorde || gilde;
  $("#einst").hidden = !einst;
  $("#weeklies").hidden = !weeklies;
  $("#rekorde").hidden = !rekorde;
  $("#gilde").hidden = !gilde;
  syncWeeklies(weeklies);   // zeichnet die Weeklies und haelt den Minutentakt nur, solange sie offen sind (59)
  syncRekorde(rekorde);     // zeichnet die Rekorde und fragt beim Oeffnen einmal nach neuen Logs (62)
  syncGilde(gilde);         // zeichnet die Gilde nur, solange sie offen ist (68)
  if(einst) renderEinst();
  if(!$("#land").hidden) renderStart();
  $(".stage").classList.toggle("landing", !$("#land").hidden);
  document.body.classList.toggle("noFight", !has);
  document.body.classList.toggle("noTime", !!state.noTime);
  $("#clearedNote").hidden = !clearedOnly;
  /* Die Kampf-Tafel (56) vor dem Zeichnen: die Tafel schneidet ihre Hoehe
     im Raster nicht zu (schneideAufZeilen), und ohne Kampf, auf Start oder
     im Kompakt muss die Klasse auch auf den Wegen weg, die unten frueh
     umkehren. */
  syncTafel(); syncFelder();
  /* Stand der Fokus in der Bereichsleiste, bleibt er dort, auch wenn sein
     Knopf gleich gesperrt wird (syncBereiche setzt ihn dann auf den
     Tabstopp) - sonst fiele er ins Leere. */
  const fokusLeiste = !!document.activeElement && $("#bereiche").contains(document.activeElement);
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach(tb => {
    /* Der Bereich, dessen Flaeche gerade steht, bleibt nutzbar: nach dem
       Leeren auf Verlauf oder in der Gruppe ohne Kampf stand sonst der
       gewaehlte Knopf gesperrt und gedimmt da. */
    const usable = has || tb.dataset.tab === "party" || tb.dataset.tab === "start" || tb.dataset.tab === "settings" ||
                   tb.dataset.tab === "weeklies" || tb.dataset.tab === "rekorde" || tb.dataset.tab === "gilde" ||
                   (!!state.parsed && tb.dataset.tab === "setup") ||
                   (tb.dataset.tab === state.tab && !$("#app").hidden);
    tb.disabled = !usable;
    tb.setAttribute("aria-disabled", usable ? "false" : "true");
  });
  syncTabs(fokusLeiste);   // ruft syncBereiche, einmal je Durchlauf
  renderFights(); renderRuns(); syncKwKnopf(); syncStatusleiste();
  syncCompareBtn();
  // a scrollbar comes and goes with the content, and the edge grips have to
  // step around whichever one is there
  syncWindowVars();
  if(!has){
    renderCompare();
    // a file waiting to be mapped by hand yields no fights, so this is the only
    // pass it gets — without it the tab arrives showing the previous file's
    // columns, which is worse than not arriving at all
    if(setupOnly){ renderSetup(); return; }
    if(clearedOnly){
      // the table would otherwise keep showing the fight that was just
      // cleared — a table of numbers the app no longer has
      $("#bars").innerHTML = "";
      /* Every panel that paints from a fight, not just the table. This branch
         returns before the render functions run, so anything it does not empty
         itself keeps the numbers of the fight that was just cleared.

         Fuer den Analyse-Reiter tut das jetzt renderAnalysis selbst: die
         Funktion kehrt ohne Kampf sofort um und raeumt vorher auf. Eine
         Liste von Kennungen an dieser Stelle war die falsche Loesung - sie
         vergass den Urteilskasten, und der war das eine Feld auf dem
         Reiter, das eine DPS-Zahl druckt. Nachgemessen stand dort nach dem
         Leeren "179.4k SCHNITT" samt drei Saetzen ueber einen geloeschten
         Kampf, waehrend die Leiste daneben "Noch keine Kaempfe geladen"
         sagte. Was hier bleibt, gehoert dem Waffenreiter. */
      ["wpnTable","assign"]
        .forEach(id => { const el = $("#" + id); if(el) el.innerHTML = ""; });
      /* Wie bei der Analyse: die Funktion raeumt selbst auf und kehrt um.
         Eine Liste von Kennungen an dieser Stelle war die falsche Loesung -
         sie vergass zweimal etwas, erst den Urteilskasten und dann den
         Satz ueber die schwaechste Stelle. */
      renderRotation(); renderAnalysis();
      const unassigned = $("#wUnassigned");
      if(unassigned) unassigned.textContent = t("bars.clearedWaiting");
      renderSetup(); sendReport(false); return;
    }
    if(inPartyGroup){ renderHead(); renderBars(); sendReport(false); return; }
    if(state.tab === "party"){ renderParty(); sendReport(false); return; }
    return;
  }
  // vor den Panels: der Kampfkopf, die Tafel und der Fehlerbericht lesen
  // alle state.mainWeapon, und das haengt am ausgewaehlten Kampf
  readWeaponPair();
  syncStatusleiste();   // Klasse und Rolle in der Statusleiste haengen am Waffenpaar (Neugestaltung 28.09., 0.23)
  renderHead(); renderBars();
  /* Log-Einrichtung und Vergleich sind Reiter-Flaechen: .panel steht auf
     display:none, und den Einrichtungs-Reiter blendet syncTabs() sogar ganz
     aus, solange keine Spaltenrolle fehlt. Ein normaler Benutzer hat diesen
     Reiter gar nicht - und beide wurden trotzdem bei jedem Durchlauf neu
     gebaut, also bei jedem Wachstum der Logdatei, im Kampf etwa alle zwei
     Sekunden.

     Gezaehlt an einem echten TL-Log mit zehn Spalten baut renderSetup 305
     Elemente: zehn Zuordnungszeilen zu je neunzehn - davon elf <option> aus
     ROLES -, dazu die Vorschau mit zehn Kopfzellen und acht mal zehn
     Datenzellen. Gemessen kostet das 0,72 ms je Durchlauf von 9,24 ms
     insgesamt. renderCompare kostet 0,03 ms und ist nur der Vollstaendigkeit
     halber hier - es baut im Normalfall vier Elemente.

     Beim Betreten baut switchTab() die Flaeche, genauso wie renderHistory()
     es seit jeher macht. Ein Schmutz-Merker ist nicht noetig: state.tab wird
     an genau zwei Stellen geschrieben, und .on an einer Flaeche an genau
     einer - jeder Eintritt laeuft durch switchTab.

     Die Schiene bleibt absichtlich ungedeckelt. Sie waere nur im
     Kompaktmodus verborgen, das braeuchte eine neue Bedingung ueber zwei
     Funktionen hinweg, und sie bringt zusammen 0,18 ms. */
  if(state.tab === "setup") renderSetup();
  if(state.tab === "compare") renderCompare();
  // der Zeitverlauf steht seit Aufgabe 10 im Bereich Rotation: renderRotation zeichnet ihn mit
  if(state.tab === "rotation") renderRotation();
  if(state.tab === "analysis") renderAnalysis();
  if(state.tab === "weapons") renderWeapons();
  if(state.tab === "party") renderParty();
  // the note carries data-i18n, so a language switch reset it to the plain
  // wording even while the sample was loaded
  if(state.tab === "history") renderHistory();
  if(document.body.classList.contains("compact")) applyWindowSize();
  sendReport(false);
}

/* Live logging calls this every couple of seconds with the WHOLE file, and
   combat logs only ever grow — so re-parsing all of it each time is almost
   entirely wasted work. On a long raid night that becomes hundreds of
   milliseconds of parsing every 2s, climbing as the log grows.

   The fast path: if the new text starts with exactly the text we already
   parsed, only the appended tail is new. Parse just that, append its rows,
   and reuse the column mapping we already worked out. Any other shape —
   a different file, a rotated log, an edit — falls back to a full reparse,
   so correctness never depends on the guess being right. */
/* Raised only around sample()'s own call to loadText, which reads it. Declared
   here rather than beside sample() far below, so it is initialised before
   anything can reach this function — a `let` read before its declaration has
   run throws rather than reading as false. */
let loadingSample = false;
/* Where the numbers in front of you came from. This prevents nothing and is
   not meant to: the log is plain text on the player's own machine and the
   game signs nothing, so anyone willing to patch the exe or post to the party
   server directly can send whatever they like. What it does is tell apart a
   fight this app watched appear from a finished file it was handed - and that
   difference costs real effort to fake, where editing a number costs none.

   It goes in the bug report and nowhere else. Nothing is shown beside anybody
   else's name, because a wrong accusation in a clan is worse than a missed
   edit. */
let loadOrigin = "file";        // "watch" | "file" | "sample"
// set from the parts that load something; an import cannot be assigned to
export function setLoadOrigin(v: string){ loadOrigin = v; }
export function setLoadingSample(v: boolean){ loadingSample = v; }
/* #153: Live springt nur mit, wenn man den neuesten Kampf ansah. Wer einen
   aelteren liest, bleibt bei ihm - gemerkt an der Startzeit, denn der Platz
   in der Liste verschiebt sich, sobald vorn ein Kampf dazukommt. Fehlt er
   danach (neu geschnitten), geht es zum neuesten. */
type AuswahlMerk = { neueste: boolean; start: number | null };
export function auswahlMerken(): AuswahlMerk {
  const seg = state.encounters[state.sel];
  return {neueste: state.sel === 0 || !seg, start: seg ? seg.start : null};
}
export function auswahlNachLive(m: AuswahlMerk){
  if(m.neueste || m.start === null){ state.sel = 0; return; }
  const i = state.encounters.findIndex(x => x.start === m.start);
  state.sel = i >= 0 ? i : 0;
}
export function loadText(text: string, names: string[], quiet?: boolean, ganz?: boolean){
  // Set here, from a flag sample() raises around its own call, rather than
  // afterwards by sample(): loading renders, and the party panel fills its
  // name field during that render. Setting it on the way back out left one
  // render in which the sample's character was still a real one, which is
  // exactly the render that offered you the name Demo.
  state.fromSample = loadingSample;
  /* Held in a local until the text is actually taken on. Set here, a file
     that turns out to be unusable - a wrong one dropped on the window - left
     its origin and its row counts describing the file that is still loaded. */
  const nextOrigin = loadingSample ? "sample" : loadOrigin;
  const merk = auswahlMerken();
  const prev = state.text || "";
  const sameFile = JSON.stringify(state.fileNames||[]) === JSON.stringify(names||[]);
  const liveGleich = nextOrigin === "watch" && sameFile;
  const appendOnly = sameFile && prev.length > 0 && text.length > prev.length &&
                     state.parsed && state.mapping && text.startsWith(prev);
  /* Clear sets a cutoff and buildEvents drops everything at or before it, for
     ever. Open a DIFFERENT log afterwards - or the same name rewritten - and
     every fight in it predates the moment Clear was pressed, so it parses
     fine and then filters to nothing while the rail says nothing was loaded
     and the Clear button is hidden, which leaves no way back in the app.
     Tested by prefix, not by name: a log rotated under its own name is a new
     file too, and live logging still appends to a matching prefix. */
  /* appendOnly already asks exactly the right question - same file, same
     prefix, longer than last time - so counting it is counting the times this
     app saw the fight being written. That is the one claim here a text editor
     cannot make. */
  const nextGrew = sameFile ? (state.grew || 0) + (appendOnly ? 1 : 0) : 0;

  /* Eine andere Datei: der Zeitschnitt und die entfernten Kaempfe gehoerten
     der alten. Startzeiten aus einem anderen Log haetten hier gar keine
     Bedeutung - und mit etwas Pech genau die falsche. */
  if(!(sameFile && text.startsWith(prev))){ state.clearBefore = null; state.entfernt.clear(); }
  /* Start (Instrumententafel 3.3) und Einstellungen verlassen: eine Datei, die jemand oeffnet
     (oder das Beispiel), will gesehen werden - und eine neue Datei aus Live
     auch. Ein Live-Takt an derselben Datei laesst Start stehen, sonst waere
     Start waehrend der Aufzeichnung nach zwei Sekunden wieder weg. Gilt erst,
     wenn der Text genommen wird (unten, verlassen()). */
  const verlassen = () => { if(nextOrigin !== "watch" || !sameFile){ state.start = false; state.einst = false; state.weeklies = false; state.rekorde = false; state.gilde = false; } };

  /* ganz: Live laedt ganz, wenn das Ende nicht anzuhaengen ging (loadTail,
     41-server-mode.ts). Dann immer mit parseGrid - der Weg hier unten zaehlt
     weder stable noch die Zeilenbreiten nach, und eine kleine Datei bliebe
     so fuer immer unter stable, tailRechnen pruefte gegen alte Breiten.
     Und nur, wenn die Datei stable ist, wie in tailPasst: sonst stammt die
     Zuordnung aus den ersten paar Zeilen und bliebe fuer den ganzen Abend
     stehen (Issue #65: die Faehigkeits-ID als Schaden, 97,8 Mrd.; ab drei
     Zeilen ohne Versionszeile gar keine Schadensspalte). Bis dahin wird
     ganz gelesen und neu zugeordnet. */
  if(appendOnly && !ganz && state.parsed!.stable){
    const tail = text.slice(prev.length);
    const grid = parseGridTail(tail, state.parsed);
    if(grid && grid.rows){
      state.text = text;
      state.origin = nextOrigin; state.grew = nextGrew;
      verlassen();
      /* Added to what the full parse counted rather than replacing it: during
         live logging every read after the first comes through here. */
      const was = state.integrity || {};
      state.integrity = Object.assign({}, was, {
        rowsSeen: (was.rowsSeen || 0) + grid.seen,
        rowsKept: (was.rowsKept || 0) + grid.kept,
        rowsMerged: (was.rowsMerged || 0) + grid.merged,
        rowsDropped: (was.rowsDropped || 0) + (grid.seen - grid.kept),
        countedFrom: "full+tail"
      });
      state.parsed!.rows = state.parsed!.rows.concat(grid.rows);   // grid came off it
      buildEvents(); refreshPlayers(); segment();
      if(liveGleich) auswahlNachLive(merk); else state.sel = 0;
      histRecord();
      renderAll();
      return;
    }
    // tail didn't parse cleanly into the existing shape — fall through
  }

  /* Read it into locals and decide before anything is handed over. Taking the
     file first and finding out afterwards that it was unusable threw the
     loaded fights away: measured at three fights down to none and back to the
     start screen, from dropping one wrong file on the window. */
  const parsed = parseGrid(text);
  if(!parsed){ toastFail(tt("toast.noRowsFound")); return; }
  const cols = profile(parsed);
  const mapping = autoMap(parsed, cols);

  /* No damage column means one of two very different things. It can be a real
     combat log laid out in a way this app could not read — which is exactly
     what Log setup is for, so that file has to be loaded for you to map it by
     hand. Or it was never a log: a shopping list parses perfectly well as
     three rows of one column. A log has several columns and numbers in them,
     and that is the difference worth testing before discarding a session. */
  const tabular = parsed.headers.length >= 3 && cols.some(c => c.numFrac > 0.5);
  if(mapping.damage == null && !tabular){
    const src = names && names.length ? names.join(", ") : t("toast.theLog");
    // "your fights are still here" is only worth saying to someone who has
    // some; on an empty app it is false comfort, and what they need instead
    // is where to find the right file
    toastFail(tt(state.encounters.length ? "toast.notALogKept" : "toast.notALog", {src}), 7000);
    return;                     // nothing taken on, so nothing lost
  }

  state.text = text; state.fileNames = names || [];
  state.origin = nextOrigin; state.grew = nextGrew;
  // a fresh file starts fresh: the previous file's figures have nothing to
  // say about this one, and buildEvents fills in its own right after
  state.integrity = Object.assign({}, parsed.counts, {countedFrom: "full"});
  state.parsed = parsed; state._cols = cols; state.mapping = mapping;
  verlassen();
  buildEvents(); refreshPlayers(); segment();
  if(liveGleich) auswahlNachLive(merk); else state.sel = 0;
  histRecord();
  // the message says to map it in Log setup, so go there. It used to say that
  // from the start screen, which was covering the very tab it named.
  if(mapping.damage == null) switchTab("setup", true);
  renderAll();
  if(mapping.damage == null) toastFail(tt("toast.noDamageColumn"), 7000);
  /* Beim Beispiel keine Meldung. Was sie sagte ("2 Kaempfe aus dem
     Beispiel gelesen."), steht nach dem Klick dreimal da - in der Zeile
     "2 Kaempfe geladen", in der Liste und in der Kopfplatte -, und sie lag
     vier Sekunden unten in der Leiste, genau wo "Vergleichen 2" erscheint.
     Bei einer eigenen Datei bleibt sie: dort nennt sie, WELCHE Datei gelesen
     wurde, und das steht sonst nirgends. */
  else if(!quiet && !loadingSample) toast(tt("toast.fightsRead",{n:state.encounters.length,
    src: names && names.length ? names.join(", ") : tt("toast.theLog")}));
}
/* Live (Spezifikation Live-Leistung 3): nur das neue Ende der Datei, die
   schon geladen ist. tail endet auf einem Zeilenende - der Helfer liefert
   nur ganze Zeilen. false, wenn es so nicht geht; dann laedt der Aufrufer
   die Datei ganz, wie bisher. Das Ergebnis ist dasselbe wie nach loadText()
   mit der ganzen Datei, und scripts/test-live-core.mjs prueft das an 200
   zufaelligen Schnitten. */
export function loadTail(tail: string, names: string[]){
  if(!tail) return tailPasst(names);
  const merk = auswahlMerken();
  const neu = tailRechnen(tail, names);
  if(neu === false) return false;
  auswahlNachLive(merk);
  histNur = neu;
  try { histRecord(); } finally { histNur = null; }
  renderAll();
  return true;
}
const tailPasst = (names: string[]) => !loadingSample && !!state.text && !!state.parsed &&
  state.parsed.stable && !!state.mapping &&
  JSON.stringify(state.fileNames || []) === JSON.stringify(names || []);

/* Der rechnende Teil von loadTail(), ohne Verzeichnis und ohne Zeichnen -
   so kann scripts/test-live-core.mjs ihn in Node gegen das ganze Laden
   halten. Gibt die neuen oder veraenderten Kaempfe zurueck, null, wenn neu
   geschnitten wurde (dann zaehlen alle), oder false, wenn es so nicht geht. */
export function tailRechnen(tail: string, names: string[]): Set<Encounter> | null | false {
  const g = state.parsed;
  if(!tail.endsWith("\n") || !tailPasst(names) || !g) return false;
  const grid = parseGridTail(tail, g);
  if(!grid) return false;
  // die haeufigste Zeilenbreite muss bleiben, sonst kaeme das ganze Laden
  // zu anderen Zeilen
  const widths = Object.assign({}, g.widths);
  for(const k in grid.widths) widths[k] = (widths[k] || 0) + grid.widths[k]!;
  if(modeWidth(widths) !== g.rows[0]!.length) return false;

  state.fromSample = false;
  state.text += tail;
  state.origin = loadOrigin; state.grew = (state.grew || 0) + 1;
  g.widths = widths;
  const was = state.integrity || {};
  state.integrity = Object.assign({}, was, {
    rowsSeen: (was.rowsSeen || 0) + grid.seen,
    rowsKept: (was.rowsKept || 0) + grid.kept,
    rowsMerged: (was.rowsMerged || 0) + grid.merged,
    rowsDropped: (was.rowsDropped || 0) + (grid.seen - grid.kept),
    countedFrom: "full+tail"
  });
  for(const r of grid.rows) g.rows.push(r);
  if(!appendEvents()) buildEvents();
  refreshPlayers();
  const neu = segmentTail();
  /* Der bisher neueste Kampf zaehlt mit: bestRecord laesst den
     laufenden aus, und ist er nicht mehr der neueste, gilt er jetzt. Er ist
     der neueste unter denen, die stehen blieben. */
  const bisher = neu ? state.encounters.find(x => !neu.has(x)) : undefined;
  if(neu && bisher) neu.add(bisher);
  return neu;
}

export function refreshPlayers(){
  const sel = $<HTMLSelectElement>("#selPlayer"), cur = state.player;
  sel.innerHTML = '<option value="__all">'+esc(t("rail.everyone"))+'</option>' +
    state.players.map(p => '<option value="'+esc(p)+'">'+esc(p)+"</option>").join("");
  sel.value = state.players.includes(cur) ? cur : "__all";
  state.player = sel.value;
  /* Ein Kampflog von Throne and Liberty enthaelt die Daten genau EINES
     Spielers. Nachgezaehlt ueber die 89 Logs auf diesem Rechner: 89 mal ein
     einziger Angreifer, kein einziges Mal zwei. Die Wahl zwischen "alle im
     Log" und dir selbst ist dann keine Wahl, und eine Rangliste der
     Angreifer hat genau eine Zeile.

     Geloescht sind beide trotzdem nicht: wer die Logdateien seiner Gruppe
     zusammen laedt, hat wirklich mehrere Angreifer, und dafuer ist die
     Auswahl gebaut. Sie erscheint jetzt genau dann, wenn es etwas zu waehlen
     gibt. */
  const mehrere = state.players.length > 1;
  $("#playerField").hidden = !mehrere;
  $("#segPlayer").hidden = !mehrere;
  // Stand die Tabelle auf "Angreifer" und faellt der Knopf weg, darf die
  // Tabelle nicht auf einer Gruppierung stehen bleiben, die es nicht gibt.
  if(!mehrere && state.group === "player"){
    state.group = "skill";
    [...$("#groupSeg").children as HTMLCollectionOf<HTMLElement>].forEach(c => {
      const an = c.dataset.g === "skill";
      c.classList.toggle("on", an);
      c.setAttribute("aria-pressed", an ? "true" : "false");
    });
  }
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  /* ---------- orchestration ---------- */
  /* ---------- Verlauf je Ziel ----------
     Der Ordner als Ganzes. Die App zeigte immer nur die eine geladene Datei;
     auf der eigenen Platte liegen 90 Logs mit 482 verwertbaren Kaempfen,
     und derselbe Boss schwankt darin um den Faktor drei.

     Gerechnet wird NICHT neu. Jede Datei geht durch dieselben vier Schritte
     wie beim Laden - parseGrid, autoMap, buildEvents, segment - und die Zahlen
     kommen aus stats(). Ein eigener, einfacherer Schnitt waere schneller
     gewesen und haette fuer denselben Kampf eine andere Zahl geliefert als die
     Kampfliste. Zwei Zahlen fuer eine Sache, eine davon falsch, ist schlimmer
     als kein Verlauf. */
  // der Zeitraum des Verlaufs (Luecken 6.1): Monat wie im Entwurf, nur in der Sitzung
  state.hist = {files:{}, fights:[], sel:null, busy:false, zeit:"monat"};
  /* Woche | Monat | Alles in der Kopfzeile (Luecken 6.1); der Fokus bleibt auf dem Knopf. */
  $("#verlaufZeit").querySelectorAll<HTMLButtonElement>("button").forEach(b => b.onclick = () => {
    state.hist.zeit = b.dataset.z as typeof state.hist.zeit;
    renderHistory();
    b.focus();
  });
}
