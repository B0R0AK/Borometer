import { t } from "./08-translation";
import { full } from "./03-helpers";
import { esc } from "./18-interface-basics";
import { SERVED } from "./41-server-mode";
import { WK_MARKE, wkAnfang, wkBilderCss, wkHatBild } from "./60-weeklies-bilder";
import { anzeigeStand, bereichZu, fortschrittVon, GRUNDLISTE, letzteWoche, letzterReset, naechsterReset, vorwocheSichern, type Erinnerung, type Takt, type WeeklyProfil } from "../weeklies-core";

/* ---------- Weeklies (Spezifikation 2026-09-29-weeklies-design.md, Plan Aufgabe W3) ----------
   Eine Checkliste der Wochen- und Tagesaufgaben fuer bis zu sechs eigene
   Charaktere. Oben die Reset-Anzeige (Wochen-Reset Do 10:00, taeglich
   10:00, deutsche Zeit), darunter je Charakter ein Reiter mit kleinem
   Fortschrittsring und "erledigt/gesamt" (Tablist), "+ Charakter" (beim
   siebten ein Satz statt des Knopfs), rechts Umbenennen, Anpassen und
   Loesen mit Rueckgaengig.

   Seit der Neugestaltung "Wochenband" (Spezifikation 9, 01.10.2026;
   Entwurf und Entscheidungen in .impeccable/surfaces/src-renderer-app-59-
   weeklies-ts.md): ein Raster aus Feldern mit Haarfugen. Zuerst das
   Wochenband ueber die volle Breite - Do 10:00 bis Do 10:00, die taeglichen
   Resets als Striche mit Wochentag, "jetzt" als goldener Strich mit der
   Restzeit -, darunter die Gruppen als Kacheln mit Ring und
   erledigt/gesamt; eigene Punkte stehen in "Eigene". Seit Spezifikation 10
   stehen alle Haendler in einem Feld "Haendler" (je Haendler ein Block, die
   Bloecke in Spalten, taegliche Punkte beim Gemischtwarenhaendler mit
   "taeglich"), und die Dimensionspruefung zaehlt Dungeons mit Punkten und
   fuenf goldene Kisten zum Anklicken. Erledigte Kacheln treten zurueck und behalten ihren Platz.
   Der Raid ist ein 3x3-Raster (Variante B): die Fluegel als Spalten mit
   Bossbild, Normal/Schwer/Albtraum als Zeilen, ein Feld ein Haken; ein
   Tabstopp, die Pfeiltasten wandern im Raster. Haendler-Punkte tragen ihr
   Gegenstandssymbol mit einem Fuellring fuer n/Menge (Bilder und Marken:
   60-weeklies-bilder.ts). Menge 1 ist ein Haken, mehr ein Zaehler mit -, +
   und "voll", ein Klick auf den Namen zaehlt eins mehr, Pfeiltasten am
   Zaehler. Anpassen je Charakter bleibt eine Liste: ausblenden,
   umbenennen, eigene Punkte (loesen mit Rueckgaengig), "Grundliste
   wiederherstellen".

   Die Reset-Regel rechnet der Kern (../weeklies-core.ts): gezeigt wird
   anzeigeStand(), vor jedem Setzen sichert vorwocheSichern() die Woche davor.
   Gespeichert wird allein ueber /api/weeklies (src/main/weeklies.ts): erst
   lesen, dann nach jeder Aenderung der GANZE Stand, entprellt. Nichts wird
   je entfernt - Loesen setzt geloest, Rueckgaengig nimmt es wieder weg, ein
   Zaehler bleibt als Schluessel stehen, auch auf 0. Ohne den Helfer (Seite
   als Datei) steht nur ein Satz da; bei 400 und 503 sagt ein ruhiger Satz,
   dass nicht gespeichert wurde, und der Stand bleibt sichtbar. Die
   Minutenanzeige laeuft nur, solange der Bereich offen ist (syncWeeklies aus
   renderAll, 32). Nichts hiervon geht ins Netz, in ein Gruppen-Log oder in
   den Fehlerbericht. */

export interface Stand { v: 1; profile: WeeklyProfil[]; erinnerungen?: Erinnerung[] }
interface Punkt { schluessel: string; gruppe: string; menge: number; takt: Takt; name: string; grund: string; eigen: boolean; aus: boolean; geloest: boolean }
type Lage = "laden" | "da" | "nurApp" | "gesperrt";
type Speicher = "" | "nie" | "spaeter" | "anderswo";
type Undo = { art: "profil"; id: string } | { art: "eigen"; id: string; k: string };

/** Hoechstens sechs nicht geloeste Charaktere (Spezifikation 2), 60 insgesamt mit den geloesten und eigene Punkte
    je Charakter wie die Datei (weeklies.ts: MAX_ACTIVE, MAX_PROFILES, MAX_OWN). */
const MAX_AKTIV = 6, MAX_PROFILE = 60, MAX_EIGENE = 100;
const GRUPPEN = [...new Set(GRUNDLISTE.map(g => g.gruppe)), "eigene"];
/* Die Haendler in ihrer Folge (Spezifikation 10): ein Feld, je Haendler ein Block. */
const HAENDLER = ["gemischtwaren", "gildenhaendler", "vertragsmuenzen", "widerstandswaren", "ehrenmuenzen", "raidwaren"];
/* Die Kacheln in Lesefolge; jeder Punkt gehoert zu genau einer (kachelVon):
   eigene in "Eigene", die der Haendler in "Haendler", sonst seine Gruppe. */
const KACHELN = [...new Set(["raid", "geheimdungeon", "events", "dimension", "haendler", ...GRUPPEN.filter(g => !HAENDLER.includes(g))])];
/** Punkte je Dungeon der Dimensionspruefung (Update 4.12.0, bestaetigt 01.10.2026: 6000, also 42.000 bei 7). */
const DIM_PUNKTE = 6000;
const FLUEGEL = ["zitadelle", "korridor", "altar"], STUFEN = ["Normal", "Schwer", "Albtraum"];

let daten: Stand | null = null;
let lage: Lage = "laden";
let gewaehlt: string | null = null;
let neuOffen = false, nameOffen = false, anpassen = false, geloesteAuf = false;
/** "Nur Offenes zeigen" und der Satz bei sechs Charakteren; beides nur in der Sitzung. */
let nurOffen = false, sechsHinweis = false;
/** Der Bereich, der mit der letzten Handlung fertig wurde: sein Kopf bekommt danach den Fokus. */
let fertigGeworden: string | null = null;
/** Der Punkt, dessen Name in Anpassen gerade bearbeitet wird. */
let punktEdit: string | null = null;
let undo: Undo | null = null;
let speicher: Speicher = "";
/** Ein Satz zur Eingabe (Name zu lang, Menge falsch); weg mit der naechsten Handlung. */
let meldung = "";
/** Das Element (data-f), das nach dem naechsten Zeichnen den Fokus bekommt. */
let fokus: string | null = null;
/** Die Truhe (1 bis Menge), die den einen Tabstopp der Truhen traegt; null heisst die naechste zu fuellende. */
let truhePos: number | null = null;
/** Das Feld des Raid-Rasters, das den einen Tabstopp traegt (Schluessel), in der Sitzung. */
let rasterPos: string | null = null;

/** Haken fuer den Dialog der Erinnerungen (67): nach dem Zeichnen und nach dem Speichern. */
export const haken: {gezeichnet: (() => void) | null; gespeichert: (() => void) | null} = {gezeichnet: null, gespeichert: null};

/* ---------- Lesen: erst lesen, dann schreiben ---------- */
let ladeTimer: ReturnType<typeof setTimeout> | null = null, ladeVersuch = 0;
const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
/* Der gelesene Stand. Was nicht die Form hat - auch eine Antwort ohne data
   (Pruefung W3, K3; die Route antwortet immer mit data) -, gilt als unlesbar:
   die Seite schreibt dann nichts, damit nichts verloren geht. */
function standVon(x: unknown): Stand | null {
  if(!isRec(x) || x.v !== 1 || !Array.isArray(x.profile)) return null;
  const profile: WeeklyProfil[] = [];
  for(const p of x.profile){
    if(!isRec(p) || typeof p.id !== "string" || typeof p.name !== "string") return null;
    profile.push({...p, zaehler: isRec(p.zaehler) ? p.zaehler : {}, aus: Array.isArray(p.aus) ? p.aus : [],
      namen: isRec(p.namen) ? p.namen : {}, eigene: Array.isArray(p.eigene) ? p.eigene : []} as WeeklyProfil);
  }
  // die Erinnerungen bleiben im Stand: die Datei lehnt einen Stand ab, der gespeicherte wegliesse (weeklies.ts)
  return {v: 1, profile, ...(Array.isArray(x.erinnerungen) ? {erinnerungen: x.erinnerungen as Erinnerung[]} : {})};
}
function laden(){
  if(!SERVED || ladeTimer) return;
  fetch("/api/weeklies").then(r => r.status === 404 ? "ohne" : r.ok ? r.json() : null).then((d: unknown) => {
    if(d === "ohne"){ lage = "nurApp"; return renderWeeklies(); }
    const s = isRec(d) && d.ok === true ? standVon(d.data) : null;
    if(!s){ lage = "gesperrt"; renderWeeklies(); return spaeterLaden(); }
    daten = s; gespeichert = kanon(s); lage = "da"; ladeVersuch = 0;
    renderWeeklies();
    // ein Netzfehler oder eine kaputte Antwort in der App heisst "gerade nicht lesbar", nicht "nur in der App" (K9)
  }, () => { lage = "gesperrt"; renderWeeklies(); spaeterLaden(); });
}
/* Ein Stand als Text mit sortierten Schluesseln: so vergleicht die Seite, was sie
   zuletzt gelesen oder gespeichert hat, mit dem, was die Datei jetzt traegt. */
function kanon(x: unknown): string {
  return JSON.stringify(x, (_k, v: unknown) => isRec(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
}
/** Der Stand, den die Datei nach dem letzten Lesen oder Speichern traegt (kanon). */
let gespeichert = "";
function spaeterLaden(){
  const warte = Math.min(60000, 5000 * 2 ** ladeVersuch++);
  ladeTimer = setTimeout(() => { ladeTimer = null; laden(); }, warte);
}

/* ---------- Schreiben: der ganze Stand, entprellt ----------
   400 heisst nie (zu gross oder ungueltig) - oder die Datei wurde anderswo
   geaendert (ein zweites Fenster): dann liest die Seite einmal neu, und
   weicht der gelesene Stand ab, gilt er (Pruefung W3, K2). Die Aenderung
   hier geht dabei verloren, nie etwas Gespeichertes. 503 heisst spaeter
   noch einmal. Beim Schliessen geht eine anstehende Aenderung sofort
   hinaus (pagehide, keepalive; K5). */
let sendeTimer: ReturnType<typeof setTimeout> | null = null, wiederTimer: ReturnType<typeof setTimeout> | null = null;
let unterwegs = false, nochmal = false, pruefend = false;
function merken(){
  if(sendeTimer) clearTimeout(sendeTimer);
  sendeTimer = setTimeout(senden, 200);
}
function senden(keepalive = false){
  sendeTimer = null;
  if(!daten || lage !== "da") return;
  if((unterwegs || pruefend) && !keepalive){ nochmal = true; return; }
  if(wiederTimer){ clearTimeout(wiederTimer); wiederTimer = null; }
  unterwegs = true;
  const stand = kanon(daten);
  fetch("/api/weeklies", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({data: daten}), keepalive})
    .then(r => r.ok ? "" : r.status === 400 ? "nie" : "spaeter", () => "spaeter" as const)
    .then((a: Speicher) => {
      unterwegs = false;
      if(a === ""){ gespeichert = stand; haken.gespeichert?.(); }
      speicher = a;
      statusSetzen();
      if(a === "nie") return nachLesen();
      if(nochmal){ nochmal = false; senden(); return; }
      if(a === "spaeter") wiederTimer = setTimeout(() => { wiederTimer = null; senden(); }, 5000);
    });
}
/* Nach 400: die Datei einmal lesen. Traegt sie etwas anderes als zuletzt
   gelesen oder gespeichert, gilt ihr Stand, und ein Satz sagt es. */
function nachLesen(){
  pruefend = true;
  fetch("/api/weeklies").then(r => r.ok ? r.json() : null).then((d: unknown) => {
    const s = isRec(d) && d.ok === true ? standVon(d.data) : null;
    if(s && kanon(s) !== gespeichert){
      daten = s; gespeichert = kanon(s); speicher = "anderswo";
      nochmal = false; undo = null; neuOffen = false; nameOffen = false; punktEdit = null;
      renderWeeklies();
    }
  }, () => {}).then(() => {
    pruefend = false;
    if(nochmal){ nochmal = false; senden(); }
  });
}
/** Beim Schliessen oder Neuladen: eine entprellte Aenderung sofort senden (K5). */
function beimVerlassen(){
  if(!sendeTimer) return;
  clearTimeout(sendeTimer);
  senden(true);
}

/* ---------- Charaktere und Punkte ---------- */
const aktive = () => daten ? daten.profile.filter(p => !p.geloest) : [];
function profilJetzt(): WeeklyProfil | null {
  const a = aktive();
  return a.find(p => p.id === gewaehlt) || a[0] || null;
}
function ersetze(neu: WeeklyProfil){
  const i = daten!.profile.findIndex(p => p.id === neu.id);
  if(i >= 0) daten!.profile[i] = neu;
}
function punkteVon(p: WeeklyProfil): Punkt[] {
  const grund = GRUNDLISTE.map(g => {
    const n = t("weeklies.punkt." + g.schluessel);
    return {schluessel: g.schluessel, gruppe: g.gruppe, menge: g.menge, takt: g.takt, grund: n,
      name: typeof p.namen[g.schluessel] === "string" && p.namen[g.schluessel] ? p.namen[g.schluessel]! : n,
      eigen: false, aus: p.aus.includes(g.schluessel), geloest: false};
  });
  const eigene = p.eigene.map(e => ({schluessel: e.schluessel, gruppe: "eigene", menge: e.menge, takt: e.takt, name: e.name, grund: e.name,
    eigen: true, aus: false, geloest: !!e.geloest}));
  return [...grund, ...eigene];
}
const sichtbar = (x: Punkt) => !x.aus && !x.geloest;
const standVonPunkt = (p: WeeklyProfil, x: Punkt, jetzt: number) => Math.min(x.menge, anzeigeStand(p.zaehler[x.schluessel], x.takt, jetzt));

/* Namen: ohne Steuer- und Formatzeichen, getrimmt, 1 bis max Zeichen (wie NAME_RX/TEXT_RX der Datei). */
const STEUER = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
function sauber(roh: string, max: number): string | null {
  const s = roh.replace(STEUER, "").trim();
  return s && [...s].length <= max ? s : null;
}
const Z36 = "0123456789abcdefghijklmnopqrstuvwxyz";
function zufall(n: number): string {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map(b => Z36[b % 36]).join("");
}
/** Eine neue Kennung: "w" und neun Zeichen (ID_RX der Datei), nie eine vorhandene. */
function neueId(): string {
  for(;;){ const id = "w" + zufall(9); if(!daten!.profile.some(p => p.id === id)) return id; }
}
/** Ein neuer eigener Schluessel: "eigen" und Buchstaben/Ziffern (OWN_KEY_RX), nie ein vorhandener. */
function neuerSchluessel(p: WeeklyProfil): string {
  for(;;){ const k = "eigen" + Date.now().toString(36) + zufall(4); if(!p.eigene.some(e => e.schluessel === k)) return k; }
}

/* ---------- Handlungen ---------- */
function setzeStand(k: string, wert: number){
  const p = profilJetzt();
  const x = p && punkteVon(p).find(y => y.schluessel === k);
  if(!p || !x) return;
  const jetzt = Date.now();
  const neu = Math.max(0, Math.min(x.menge, Math.round(wert)));
  if(neu === standVonPunkt(p, x, jetzt)) return;
  const kachel = kachelVon(x), davor = istFertig(p, kachel, jetzt);
  // erst die Vorwoche sichern (Spezifikation 5), dann setzen - der Schluessel bleibt, auch auf 0
  const q = vorwocheSichern(p, jetzt);
  const p2 = {...q, zaehler: {...q.zaehler, [k]: {stand: neu, seit: jetzt}}};
  ersetze(p2);
  merken();
  // die Ansage nennt den Stand der Woche (Spezifikation 8); die goldenen Truhen sagen ihren Stand selbst an
  const f = fortschrittVon(p2, jetzt), jetztFertig = !davor && istFertig(p2, kachel, jetzt);
  if(x.eigen || k !== "goldeneKiste"){
    const satz = x.menge === 1 ? t(neu ? "weeklies.angesagtHaken" : "weeklies.angesagtZurueck", {name: x.name, w: f.woche.n, g: f.woche.g})
      : t("weeklies.angesagt", {name: x.name, n: neu, m: x.menge, w: f.woche.n, g: f.woche.g});
    ansagen(jetztFertig ? satz + ". " + t("weeklies.fertigZu", {name: t("weeklies.gruppe." + kachel)}) : satz);
  }
  if(jetztFertig) fertigGeworden = kachel;
}
function anlegen(roh: string){
  const name = sauber(roh, 24);
  if(name == null){ meldung = "weeklies.nameBad"; fokus = "nn"; return; }
  if(aktive().length >= MAX_AKTIV) return;
  if(daten!.profile.length >= MAX_PROFILE){ meldung = "weeklies.alleVoll"; fokus = "nn"; return; }
  const id = neueId();
  daten!.profile.push({id, name, zaehler: {}, aus: [], namen: {}, eigene: []});
  gewaehlt = id; neuOffen = false; anpassen = false; nameOffen = false;
  fokus = "r:" + id;
  merken();
}
function umbenennen(roh: string){
  const p = profilJetzt(), name = sauber(roh, 24);
  if(!p) return;
  if(name == null){ meldung = "weeklies.nameBad"; fokus = "nu"; return; }
  if(name !== p.name){ ersetze({...p, name}); merken(); }
  nameOffen = false; fokus = "umb";
}
function profilLoesen(){
  const p = profilJetzt();
  if(!p) return;
  ersetze({...p, geloest: true});
  undo = {art: "profil", id: p.id};
  gewaehlt = aktive()[0]?.id ?? null;
  anpassen = false; nameOffen = false; punktEdit = null;
  fokus = "undo";
  ansagen(t("weeklies.geloestAngesagt", {name: p.name}));
  merken();
}
function profilZurueck(id: string){
  const p = daten!.profile.find(x => x.id === id);
  if(!p || !p.geloest || aktive().length >= MAX_AKTIV) return;
  const neu = {...p};
  delete neu.geloest;
  ersetze(neu);
  gewaehlt = id; undo = null; anpassen = false; nameOffen = false;
  fokus = "r:" + id;
  ansagen(t("weeklies.zurueckAngesagt", {name: p.name}));
  merken();
}
function ausUmschalten(k: string){
  const p = profilJetzt();
  if(!p) return;
  ersetze({...p, aus: p.aus.includes(k) ? p.aus.filter(x => x !== k) : [...p.aus, k]});
  fokus = "a:" + k;
  merken();
}
function punktUmbenennen(k: string, roh: string){
  const p = profilJetzt();
  const x = p && punkteVon(p).find(y => y.schluessel === k);
  if(!p || !x) return;
  const leer = !roh.replace(STEUER, "").trim();
  const name = sauber(roh, 60);
  if(x.eigen){
    if(name == null){ meldung = "weeklies.punktBad"; fokus = "pn"; return; }
    ersetze({...p, eigene: p.eigene.map(e => e.schluessel === k ? {...e, name} : e)});
  } else {
    // leer oder der Name der Grundliste: wieder der eigene Name der Liste
    if(!leer && name == null){ meldung = "weeklies.punktBad"; fokus = "pn"; return; }
    const namen = {...p.namen};
    if(leer || name === x.grund) delete namen[k]; else namen[k] = name!;
    ersetze({...p, namen});
  }
  punktEdit = null; fokus = "u:" + k;
  merken();
}
function eigenerPunkt(nameRoh: string, mengeRoh: string, taktRoh: string){
  const p = profilJetzt();
  if(!p) return;
  const name = sauber(nameRoh, 60), menge = Number(mengeRoh);
  if(name == null){ meldung = "weeklies.punktBad"; fokus = "en"; return; }
  if(!Number.isInteger(menge) || menge < 1 || menge > 999){ meldung = "weeklies.mengeBad"; fokus = "em"; return; }
  if(p.eigene.length >= MAX_EIGENE){ meldung = "weeklies.eigeneVoll"; fokus = "en"; return; }
  const takt: Takt = taktRoh === "tag" ? "tag" : "woche";
  ersetze({...p, eigene: [...p.eigene, {schluessel: neuerSchluessel(p), name, menge, takt}]});
  fokus = "en";
  merken();
  // das Feld leert sich fuer den naechsten Punkt
  leeren = true;
}
let leeren = false;
function eigenLoesen(k: string, los: boolean){
  const p = profilJetzt();
  if(!p) return;
  ersetze({...p, eigene: p.eigene.map(e => {
    if(e.schluessel !== k) return e;
    if(los) return {...e, geloest: true};
    const n = {...e}; delete n.geloest; return n;
  })});
  undo = los ? {art: "eigen", id: p.id, k} : null;
  fokus = los ? "undo" : "u:" + k;
  const ep = p.eigene.find(e => e.schluessel === k);
  if(ep) ansagen(t(los ? "weeklies.eigenGeloestAngesagt" : "weeklies.zurueckAngesagt", {name: ep.name}));
  merken();
}
function grundliste(){
  const p = profilJetzt();
  if(!p) return;
  const grund = new Set(GRUNDLISTE.map(g => g.schluessel));
  ersetze({...p, aus: p.aus.filter(k => !grund.has(k))});
  fokus = "grund";
  merken();
}
function undoAusfuehren(){
  const u = undo;
  undo = null;
  if(!u) return;
  if(u.art === "profil") profilZurueck(u.id);
  else if(u.id === profilJetzt()?.id) eigenLoesen(u.k, false);
}
/** Die Kachel eines Punkts: eigene in "Eigene", die der Haendler in "Haendler", sonst seine Gruppe. */
const kachelVon = (x: Punkt): string => x.eigen ? "eigene" : HAENDLER.includes(x.gruppe) ? "haendler" : x.gruppe;
/** Die sichtbaren Punkte eines Bereichs, wie kachelHtml sie gruppiert. */
const punkteDes = (p: WeeklyProfil, g: string) => punkteVon(p).filter(sichtbar).filter(x => kachelVon(x) === g);
/** Ein Bereich ist fertig, wenn er Punkte hat und alle voll sind. */
const istFertig = (p: WeeklyProfil, g: string, jetzt: number) => { const s = punkteDes(p, g); return s.length > 0 && s.every(x => standVonPunkt(p, x, jetzt) >= x.menge); };
/** Ob ein Bereich zu ist: die Wahl des Nutzers, solange sie gilt, sonst "zu, wenn fertig" (Kern, bereichZu). */
const bereichIstZu = (p: WeeklyProfil, g: string, jetzt: number) => bereichZu(p.zu?.[g], istFertig(p, g, jetzt));

/* ---------- Reset-Anzeige ----------
   Wochentag und Uhrzeit in Berlin, wie der Kern rechnet; die Dauer
   aufgerundet auf Minuten ("in 2 T 5 Std", "in 3 Std 20 Min", "in 4 Min"). */
let berlinFmt: Intl.DateTimeFormat | null = null;
const TAGE = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function berlin(ms: number): {wt: number; zeit: string; d: string; m: string} {
  berlinFmt ??= new Intl.DateTimeFormat("en-US", {timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
  const f: Record<string, string> = {};
  for(const x of berlinFmt.formatToParts(ms)) f[x.type] = x.value;
  return {wt: Math.max(0, TAGE.indexOf(f.weekday || "")), zeit: (f.hour || "00").padStart(2, "0").replace(/^24$/, "00") + ":" + (f.minute || "00"),
    d: f.day || "", m: f.month || ""};
}
function dauer(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60000)), d = Math.floor(min / 1440), h = Math.floor(min % 1440 / 60), m = min % 60;
  return d ? t("weeklies.inTage", {d, h}) : h ? t("weeklies.inStd", {h, m}) : t("weeklies.inMin", {m});
}
const setzen = (el: Element | null, text: string) => { if(el && el.textContent !== text) el.textContent = text; };
function kopfSetzen(jetzt: number){
  const d = naechsterReset(jetzt, "tag"), bd = berlin(d);
  setzen(document.querySelector("#wkTag"), t("weeklies.resetTagKopf", {zeit: bd.zeit, in: dauer(d - jetzt)}));
}
function statusSetzen(){
  setzen(document.querySelector("#wkStatus"), meldung ? t(meldung) : speicher ? t("weeklies.sp." + speicher) : "");
}

/* ---------- Das Wochenband ----------
   Von Do 10:00 bis Do 10:00 (letzterReset/naechsterReset des Kerns). Die
   Tagesabschnitte stehen an ihren echten Resets, nicht in sieben gleichen
   Teilen: in der Woche der Zeitumstellung ist einer eine Stunde laenger
   oder kuerzer, und der Strich steht trotzdem im richtigen Tag. Ein
   Abschnitt traegt den Wochentag seines Beginns (10:00 bis 10:00), der
   vergangene Teil ist leicht gefuellt, der heutige Tag fett, der naechste
   Tagesstrich etwas kraeftiger. Die Beschriftung "jetzt" wandert mit dem
   Strich und bleibt im Band: sie verschiebt sich um ihren eigenen Anteil.
   Gezeichnet in die feste Huelle #wkBand, im Minutentakt, ohne den Rest des
   Bereichs neu zu bauen. */
const wtZeit = (ms: number) => { const b = berlin(ms); return t("weeklies.wt." + b.wt) + " " + b.zeit; };
/* Fuer den Namen des Bands mit Datum, damit die Region jede Woche anders heisst (Pruefung N4). */
const wtDatumZeit = (ms: number) => { const b = berlin(ms); return t("weeklies.wt." + b.wt) + " " + t("weeklies.datum", {d: b.d, m: b.m}) + " " + b.zeit; };
/* Die Zeile "Letzte Woche" unter dem Band, solange in der neuen Woche noch nichts gesetzt ist (Spezifikation 3.4). */
function letzteHtml(jetzt: number): string {
  const lw = daten && lage === "da" ? letzteWoche(aktive(), jetzt) : null;
  return lw ? '<p class="wkletzte" id="wkLetzte">' + esc(t("weeklies.letzteWoche")) + " " +
    lw.map(x => "<b>" + esc(x.name) + "</b> " + x.n + "/" + x.g).join(" \u00b7 ") + "</p>" : "";
}
function bandSetzen(jetzt: number){
  const band = document.querySelector<HTMLElement>("#wkBand");
  if(!band) return;
  const von = letzterReset(jetzt, "woche"), bis = naechsterReset(jetzt, "woche"), lang = bis - von;
  const anteil = (ms: number) => Math.max(0, Math.min(100, (ms - von) / lang * 100));
  const grenzen = [von];
  for(let d = von, i = 0; i < 14; i++){ d = naechsterReset(d, "tag"); if(d >= bis) break; grenzen.push(d); }
  grenzen.push(bis);
  const pct = anteil(jetzt).toFixed(3);
  let tage = "";
  for(let i = 0; i + 1 < grenzen.length; i++){
    const a = grenzen[i]!, b = grenzen[i + 1]!, l = anteil(a);
    const cls = jetzt >= b ? " vorbei" : jetzt >= a ? " heute" : "";
    const naechster = i > 0 && grenzen[i - 1]! <= jetzt && jetzt < a ? " naechster" : "";
    // der erste Abschnitt sagt, ab wann: "Do ab 10:00" (125.4)
    const bt = berlin(a), name = i === 0 ? t("weeklies.bandAb", {tag: t("weeklies.wt." + bt.wt), zeit: bt.zeit}) : t("weeklies.wt." + bt.wt);
    tage += '<span class="wkbtag' + cls + naechster + '" style="left:' + l.toFixed(3) + "%;width:" + (anteil(b) - l).toFixed(3) + '%">' +
      esc(name) + "</span>";
  }
  const h = '<div class="wkbandoben"><span class="wkbandjetzt" style="left:' + pct + "%;transform:translateX(-" + pct + '%)"><b>' + esc(t("weeklies.jetzt")) + "</b> " +
      esc(wtZeit(jetzt)) + "</span></div>" +
    '<div class="wkbahn" aria-hidden="true"><span class="wkvorbei" style="width:' + pct + '%"></span>' + tage +
      '<span class="wkjetzt" style="left:' + pct + '%"></span></div>' +
    '<div class="wkbandunten" aria-hidden="true"><span>' + esc(t("weeklies.bandWoche", {tag: t("weeklies.wt." + berlin(bis).wt), zeit: berlin(bis).zeit, in: dauer(bis - jetzt)})) + "</span></div>" + letzteHtml(jetzt);
  if(band.dataset.marke !== h){ band.innerHTML = h; band.dataset.marke = h; }
  const name = t("weeklies.bandName", {von: wtDatumZeit(von), bis: wtDatumZeit(bis)});
  if(band.getAttribute("aria-label") !== name) band.setAttribute("aria-label", name);
}

/* ---------- Zeichnen ---------- */
const SYMBOL = '<span class="wsym"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="3.3" y="5" width="17.4" height="15.2" rx="2"/><path d="M8 2.8v4.1M16 2.8v4.1M3.3 9.6h17.4"/><g fill="currentColor" stroke="none"><circle cx="7.2" cy="13" r=".95"/>' +
  '<circle cx="10.4" cy="13" r=".95"/><circle cx="13.6" cy="13" r=".95"/><circle cx="7.2" cy="16.6" r=".95"/><circle cx="10.4" cy="16.6" r=".95"/></g>' +
  '<circle cx="17.4" cy="17" r="3.6" fill="var(--acc, #E8A33D)" stroke="none"/><path d="M15.8 17l1.1 1.1 2.1-2.3" stroke="var(--acc-ink, #1B1612)" stroke-width="1.5"/></svg></span>';
const HAEKCHEN = '<svg class="wkhaekchen" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2L18.5 7.5"/></svg>';
const knopf = (cls: string, attr: string, text: string) => '<button type="button" class="' + cls + '" ' + attr + ">" + esc(text) + "</button>";

/* Ein Ring: Bahn in Grat, Fuellung in Gold; pathLength 100, damit der Anteil direkt die Laenge ist. */
function ring(px: number, sw: number, anteil: number): string {
  const r = (px - sw) / 2, c = px / 2, a = Math.round(Math.max(0, Math.min(1, anteil || 0)) * 10000) / 100;
  return '<svg class="wkring" width="' + px + '" height="' + px + '" viewBox="0 0 ' + px + " " + px + '" aria-hidden="true">' +
    '<circle class="rb" cx="' + c + '" cy="' + c + '" r="' + r + '" stroke-width="' + sw + '"/>' +
    '<circle class="rf' + (a ? "" : " null") + '" cx="' + c + '" cy="' + c + '" r="' + r + '" stroke-width="' + sw + '" pathLength="100" stroke-dasharray="' + a + ' 100"/></svg>';
}
/* Symbol eines Punkts mit Fuellring (36 um 26): Bild, eigene Marke oder fuer eigene Punkte die Raute. */
function symHtml(x: Punkt, s: number): string {
  const k = x.eigen ? "eigen" : x.schluessel;
  const innen = wkHatBild(k) ? '<span class="wkicon wkb-' + k + '"></span>' : '<span class="wkicon">' + (WK_MARKE[k] ?? WK_MARKE.eigen) + "</span>";
  return '<span class="wksym" aria-hidden="true">' + ring(36, 2.5, s / x.menge) + innen + "</span>";
}

function neuFormHtml(): string {
  return '<form class="wkform" id="wkNeuForm" novalidate><span class="field"><label for="wkNeuName">' + esc(t("weeklies.neuLabel")) + "</label>" +
    '<input id="wkNeuName" data-f="nn" maxlength="24" autocomplete="off" spellcheck="false"></span>' +
    '<button type="submit" class="btn sm">' + esc(t("weeklies.anlegen")) + "</button>" +
    knopf("btn sm", 'data-wk-abbrechen="neu"', t("weeklies.abbrechen")) + "</form>";
}
function undoHtml(): string {
  if(!undo || !daten) return "";
  const u = undo;
  const p = daten.profile.find(x => x.id === u.id);
  if(!p) return "";
  let satz = "";
  if(u.art === "profil"){ if(!p.geloest) return ""; satz = t("weeklies.geloest", {name: p.name}); }
  else {
    const e = p.eigene.find(x => x.schluessel === u.k);
    if(!e || !e.geloest || p.id !== profilJetzt()?.id) return "";
    satz = t("weeklies.eigenGeloest", {name: e.name});
  }
  return '<p class="wkgeloest"><span id="wkUndoSatz">' + esc(satz) + "</span> " + knopf("btn sm", 'data-wk-undo data-f="undo" aria-describedby="wkUndoSatz"', t("weeklies.undo")) + "</p>";
}
/* Die Liste der geloesten Charaktere unter der Leiste (Knopf "Geloeste (n)" in der Leiste, 125.2). */
function geloesteListeHtml(): string {
  const weg = daten!.profile.filter(p => p.geloest);
  if(!weg.length || !geloesteAuf) return "";
  const voll = aktive().length >= MAX_AKTIV;
  let h = '<ul class="wkausliste" id="wkGeloeste">' + weg.map(p => '<li><span class="wkausname">' + esc(p.name) + "</span>" +
    knopf("btn sm", 'data-wk-zurueck="' + p.id + '" data-f="zu:' + p.id + '" aria-label="' + esc(t("weeklies.zurueckName", {name: p.name})) + '"' +
      (voll ? ' disabled aria-describedby="wkZurueckVoll"' : ""), t("weeklies.zurueck")) + "</li>").join("") + "</ul>";
  if(voll) h += '<p class="wkhinweis" id="wkZurueckVoll">' + esc(t("weeklies.zurueckVoll")) + "</p>";
  return '<div class="wkausw">' + h + "</div>";
}
function geloesteHtml(): string {
  const weg = daten!.profile.filter(p => p.geloest);
  if(!weg.length) return "";
  const voll = aktive().length >= MAX_AKTIV;
  let h = '<div class="wkausw"><p class="wkauswk">' + knopf("leise", 'data-wk-geloeste data-f="gz" aria-expanded="' + geloesteAuf + '"' +
    (geloesteAuf ? ' aria-controls="wkGeloeste"' : ""), geloesteAuf ? t("weeklies.geloesteVerbergen") : t("weeklies.geloesteZeigen", {n: weg.length})) + "</p>";
  if(geloesteAuf){
    h += '<ul class="wkausliste" id="wkGeloeste">' + weg.map(p => '<li><span class="wkausname">' + esc(p.name) + "</span>" +
      knopf("btn sm", 'data-wk-zurueck="' + p.id + '" data-f="zu:' + p.id + '" aria-label="' + esc(t("weeklies.zurueckName", {name: p.name})) + '"' +
        (voll ? ' disabled aria-describedby="wkZurueckVoll"' : ""), t("weeklies.zurueck")) + "</li>").join("") + "</ul>";
    if(voll) h += '<p class="wkhinweis" id="wkZurueckVoll">' + esc(t("weeklies.zurueckVoll")) + "</p>";
  }
  return h + "</div>";
}
const KHAKEN = '<svg class="wkhk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2L18.5 7.5"/></svg>';
/* Eine Karte je Charakter (Spezifikation Weeklies neu, 3.2): Initiale im Ring nach Menge, Name und was diese Woche offen ist.
   Der Vorleser hoert den ganzen Satz am Reiter. */
function karteHtml(x: WeeklyProfil, an: boolean, jetzt: number): string {
  const f = fortschrittVon(x, jetzt), offen = f.woche.g - f.woche.n;
  const satz = f.fertig ? t("weeklies.karteFertig", {t: f.tag.n, tg: f.tag.g}) : t("weeklies.karteOffen", {n: offen, t: f.tag.n, tg: f.tag.g});
  const vh = f.fertig ? t("weeklies.karteVhFertig", {name: x.name, t: f.tag.n, tg: f.tag.g}) : t("weeklies.karteVhOffen", {name: x.name, n: offen, t: f.tag.n, tg: f.tag.g});
  const ini = [...x.name][0]?.toUpperCase() ?? "?";
  return '<button type="button" role="tab" class="wkkarte' + (f.fertig ? " fertig" : "") + '" id="wkTab-' + x.id + '" data-wk-reiter="' + x.id + '" data-f="r:' + x.id +
    '" aria-selected="' + an + '" aria-controls="wkPanel" tabindex="' + (an ? 0 : -1) + '" aria-label="' + esc(vh) + '" data-wk-woche="' + f.woche.n + "/" + f.woche.g + '" data-wk-heute="' + f.tag.n + "/" + f.tag.g + '"><span class="wkscheibe" aria-hidden="true">' +
    ring(44, 3.5, f.woche.anteil) + (f.fertig ? KHAKEN : "<b>" + esc(ini) + "</b>") + '</span><span class="wkkname">' + esc(x.name) +
    '</span><span class="wkkstand2" aria-hidden="true">' + esc(satz) + "</span></button>";
}
/* Sind alle Bereiche des Charakters zu? Dann bietet der Knopf "Alle aufklappen" an. */
function alleSindZu(p: WeeklyProfil, jetzt: number): boolean {
  const gs = KACHELN.filter(g => punkteDes(p, g).length);
  return gs.length > 0 && gs.every(g => bereichIstZu(p, g, jetzt));
}
function reiterHtml(akt: WeeklyProfil[], p: WeeklyProfil, jetzt: number): string {
  const weg = daten!.profile.filter(q => q.geloest).length;
  const voll = akt.length >= MAX_AKTIV;
  const neu = neuOffen && !voll ? "" : knopf("btn sm wkneu", 'id="wkNeu" data-f="neu"' + (sechsHinweis && voll ? ' aria-describedby="wkVoll"' : ""), t("weeklies.neu"));
  const geloeste = weg ? knopf("btn sm", 'data-wk-geloeste data-f="gz" aria-expanded="' + geloesteAuf + '"' + (geloesteAuf ? ' aria-controls="wkGeloeste"' : ""), t("weeklies.geloesteKnopf", {n: weg})) : "";
  const nur = '<label class="wknur"><input type="checkbox" id="wkNurOffen" data-f="nur"' + (nurOffen ? " checked" : "") + "> " + esc(t("weeklies.nurOffen")) + "</label>";
  const werk = '<div class="wkwerk">' + knopf("btn sm leise", 'data-wk-allezu data-f="allezu"', t(alleSindZu(p, jetzt) ? "weeklies.alleAuf" : "weeklies.alleZu")) +
    knopf("btn sm", 'data-wk-umbenennen data-f="umb" aria-label="' + esc(t("weeklies.umbenennenName", {name: p.name})) + '"', t("weeklies.umbenennen")) +
    knopf("btn sm", 'data-wk-anpassen data-f="anp" aria-pressed="' + anpassen + '"', t("weeklies.anpassen")) +
    knopf("leise", 'data-wk-loesen data-f="los" aria-label="' + esc(t("weeklies.loesenName", {name: p.name})) + '"', t("weeklies.loesen")) + "</div>";
  return '<div class="wkkarten" id="wkReiter" role="tablist" aria-label="' + esc(t("weeklies.reiter")) + '">' + akt.map(x => karteHtml(x, x.id === p.id, jetzt)).join("") + "</div>" +
    '<div class="wkleiste">' + neu + geloeste + nur + werk + "</div>" +
    // der Satz zu sechs Charakteren erscheint erst, wenn man "+ Charakter" drueckt (125.3)
    (sechsHinweis && voll ? '<p class="wksechs" id="wkVoll">' + esc(t("weeklies.sechs")) + "</p>" : "") +
    (neuOffen && !voll ? neuFormHtml() : "") + geloesteListeHtml();
}
/* Die goldenen Kisten (Spezifikation 10): je Kiste ein Knopf mit ihrem Bild. Ein Klick auf eine
   leere fuellt bis zu ihr, auf eine gefuellte nimmt bis vor sie zurueck - fuenfmal klicken heisst
   fuenf Kisten. Der Stand ist derselbe Zaehler wie sonst, nur ohne -, + und "voll". */
function kistenHtml(x: Punkt, s: number, kopf: string, sym: string): string {
  const k = x.schluessel, n = esc(x.name);
  // ein Tabstopp fuer alle Truhen (wie im Raid-Raster): die gewaehlte, sonst die naechste zu fuellende
  const tab = truhePos && truhePos <= x.menge ? truhePos : Math.min(s + 1, x.menge);
  let kisten = "";
  for(let i = 1; i <= x.menge; i++)
    kisten += '<button type="button" class="wkkiste' + (i <= s ? " an" : "") + '" data-wk-kiste="' + i + '" data-f="ki:' + i + '" tabindex="' + (i === tab ? 0 : -1) + '" aria-pressed="' + (i <= s) +
      '" aria-label="' + esc(t("weeklies.kisteNr", {i, m: x.menge})) + '">' +
      (wkHatBild(k) ? '<span class="wkicon wkb-' + k + '" aria-hidden="true"></span>'
        : '<span class="wkicon" aria-hidden="true">' + (WK_MARKE[k] ?? WK_MARKE.eigen) + "</span>") + "</button>";
  return kopf + sym + '<span class="wkname" title="' + n + '">' + n + "</span>" +
    '<span class="wkkisten" role="group" aria-label="' + esc(t("weeklies.kisten", {n: s, m: x.menge})) + '">' + kisten + "</span></li>";
}
function zeileHtml(p: WeeklyProfil, x: Punkt, jetzt: number): string {
  const s = standVonPunkt(p, x, jetzt), fertig = s >= x.menge, k = x.schluessel, sym = symHtml(x, s);
  // der Vorleser hoert "taeglich" und "monatlich" am Haken und am Zaehler (Pruefung W3, K8)
  const taktWort = x.takt === "tag" ? t("weeklies.taeglich") : x.takt === "monat" ? t("weeklies.monatlich") : "";
  const tag = taktWort ? '<span class="wktag" id="wkT-' + k + '">' + esc(taktWort) + "</span>" : "";
  const beschr = taktWort ? ' aria-describedby="wkT-' + k + '"' : "";
  const kopf = '<li class="wkpunkt' + (x.menge > 1 ? " wkzaehl" : "") + (fertig ? " fertig" : "") + '" data-wk-punkt="' + k + '">';
  if(k === "goldeneKiste" && !x.eigen) return kistenHtml(x, s, kopf, sym);
  if(x.menge === 1)
    return kopf + '<label class="wkhaken" for="wkH-' + k + '">' + sym + '<span class="wkname" title="' + esc(x.name) + '">' + esc(x.name) + "</span></label>" + tag +
      '<input type="checkbox" id="wkH-' + k + '" data-wk-haken="' + k + '" data-f="h:' + k + '"' + beschr + (fertig ? " checked" : "") + "></li>";
  const n = esc(x.name);
  // die Dungeons der Dimensionspruefung tragen unter dem Namen die Punkte (6000 je Dungeon)
  const dim = k === "dimensionDungeons" && !x.eigen;
  // der Name ist nur Text; gezaehlt wird an den Knoepfen und im Feld (122.2)
  const name = '<span class="wkname" title="' + n + '">' + n + "</span>";
  // am Zaehler steht der Takt unter dem Namen, damit der Name in einer schmalen Haendlerspalte nicht bricht
  const unter = dim ? '<span class="wkpkt" aria-hidden="true">' + esc(t("weeklies.punkteVon", {n: full(s * DIM_PUNKTE), m: full(x.menge * DIM_PUNKTE)})) + "</span>" : tag;
  const gross = x.menge > 12;
  const dimVh = dim ? '<span class="vh" id="wkP-' + k + '">' + esc(t("weeklies.dungeonsText", {n: s, m: x.menge, p: full(s * DIM_PUNKTE)})) + "</span>" : "";
  const beschrZ = dim ? ' aria-describedby="' + (taktWort ? "wkT-" + k + " " : "") + 'wkP-' + k + '"' : beschr;
  const knopfZ = (attr: string, f: string, label: string, text: string, aus: boolean, cls = "wkschritt") =>
    '<button type="button" class="' + cls + '" tabindex="-1" ' + attr + '="' + k + '" data-f="' + f + ":" + k + '" data-k="' + k + '" aria-label="' + esc(label) + '"' + (aus ? " disabled" : "") + ">" + text + "</button>";
  return kopf + sym + (unter ? '<span class="wknamen">' + name + unter + "</span>" : name) +
    '<span class="wkzahl">' +
      knopfZ("data-wk-minus", "m", t("weeklies.minusName", {name: x.name}), "\u2212", s <= 0) +
      '<input type="text" inputmode="numeric" maxlength="3" class="wkstand" data-wk-stand="' + k + '" data-f="z:' + k + '" data-k="' + k + '" value="' + s + '" aria-label="' +
        esc(t("weeklies.stand", {name: x.name, m: x.menge})) + '"' + beschrZ + ">" + dimVh +
      '<span class="wkvon" aria-hidden="true">/' + x.menge + "</span>" +
      knopfZ("data-wk-plus", "p", t("weeklies.plusName", {name: x.name}) + ". " + t("weeklies.plusHinweis"), "+", fertig) +
      (gross ? knopfZ("data-wk-zehn", "y", t("weeklies.plusZehnName", {name: x.name}), esc(t("weeklies.plusZehn")), fertig, "wkschritt wkzehn") : "") +
      knopfZ("data-wk-voll", "v", t("weeklies.vollName", {name: x.name}), esc(t("weeklies.vollKnopf")), fertig, "wkvoll") +
    "</span>" +
    // ein Balken nach Menge unter grossen Zaehlern; er ist nur Bild, der Stand steht im Feld
    (gross ? '<span class="wkbalken" aria-hidden="true"><i style="width:' + Math.round(s / x.menge * 100) + '%"></i></span>' : "") + "</li>";
}
/* Der Raid als 3x3-Raster (Entwurf, Variante B): Fluegel als Spalten mit Bossbild, Stufen als Zeilen.
   Ausgeblendete Felder bleiben leer; eine Spalte oder Zeile ganz ohne Punkt entfaellt. Fuer den
   Vorleser eine Tabelle mit Kopfzellen und echten Checkboxen, die den vollen Namen tragen. */
function rasterHtml(p: WeeklyProfil, s: Punkt[], jetzt: number): string {
  const bei = (f: string, st: string) => s.find(x => x.schluessel === f + st);
  const fl = FLUEGEL.filter(f => STUFEN.some(st => bei(f, st))), sts = STUFEN.filter(st => FLUEGEL.some(f => bei(f, st)));
  const folge = sts.flatMap(st => fl.map(f => bei(f, st)?.schluessel).filter((k): k is string => !!k));
  const tab = rasterPos && folge.includes(rasterPos) ? rasterPos : folge[0];
  /* ohne Spielbilder (oeffentlicher Quelltext) eine ruhige Platte mit dem Anfang des Namens nach dem Artikel (wkAnfang), wie in den Rekorden */
  const kopf = fl.map(f => '<th scope="col"><span class="wkkopfbild">' +
    (wkHatBild(f) ? '<span class="wkbild wkb-' + f + '" aria-hidden="true"></span>'
      : '<span class="wkbild init" aria-hidden="true">' + esc(wkAnfang(t("weeklies.fluegel." + f))) + "</span>") + '<span class="wkkopfname">' +
    esc(t("weeklies.fluegel." + f)) + "</span></span></th>").join("");
  const zeilen = sts.map((st, ry) => '<tr><th scope="row">' + esc(t("weeklies.stufe." + st.toLowerCase())) + "</th>" + fl.map((f, rx) => {
    const x = bei(f, st);
    if(!x) return '<td><span class="wkzelle aus" aria-hidden="true"></span></td>';
    const k = x.schluessel, an = standVonPunkt(p, x, jetzt) >= x.menge;
    // ein umbenannter Punkt zeigt seinen Namen klein unter dem Haken (Pruefung M2, Entscheidung des Controllers 01.10.)
    const benannt = x.name !== x.grund ? '<span class="wkzname" aria-hidden="true">' + esc(x.name) + "</span>" : "";
    return '<td><label class="wkzelle' + (an ? " an" : "") + (benannt ? " benannt" : "") + '" data-wk-punkt="' + k + '" title="' + esc(x.name) + '"><input type="checkbox" data-wk-haken="' + k +
      '" data-f="h:' + k + '" data-rx="' + rx + '" data-ry="' + ry + '" tabindex="' + (k === tab ? 0 : -1) + '" aria-label="' + esc(x.name) + '" aria-describedby="wkRasterHilfe"' +
      (an ? " checked" : "") + ">" + '<span class="wkleerpunkt" aria-hidden="true"></span>' + HAEKCHEN + benannt + "</label></td>";
  }).join("") + "</tr>").join("");
  return '<table class="wkraster"><caption class="vh">' + esc(t("weeklies.gruppe.raid")) + '</caption><thead><tr><td class="wkeck"></td>' + kopf + "</tr></thead><tbody>" +
    zeilen + '</tbody></table><p class="vh" id="wkRasterHilfe">' + esc(t("weeklies.rasterHilfe")) + "</p>";
}
function kachelHtml(p: WeeklyProfil, id: string, s: Punkt[], jetzt: number): string {
  // ein leeres Feld haelt die Flaeche, wenn alles darin ausgeblendet ist
  if(!s.length) return id === "eigene" ? "" : '<div class="wkfeld wkleerfeld wk-' + id + '" aria-hidden="true"></div>';
  const n = s.filter(x => standVonPunkt(p, x, jetzt) >= x.menge).length, fertig = n === s.length;
  // fertig klappt zu, bis der Nutzer es anders will (Spezifikation Weeklies neu, 3.5 und 4.4)
  const zu = bereichZu(p.zu?.[id], fertig);
  const name = t("weeklies.gruppe." + id);
  const sicht = nurOffen ? s.filter(x => standVonPunkt(p, x, jetzt) < x.menge) : s;
  const inhalt = zu ? "" : id === "raid" ? rasterHtml(p, s, jetzt) : id === "haendler" ? haendlerHtml(p, sicht, jetzt)
    : '<ul class="wkliste" id="wkGL-' + id + '">' + sicht.map(x => zeileHtml(p, x, jetzt)).join("") + "</ul>";
  return '<section class="wkfeld wkgruppe wk-' + id + (fertig ? " fertig" : "") + (zu ? " zu" : "") + '" data-wk-g="' + id + '" data-zu="' + zu + '" aria-labelledby="wkGK-' + id + '">' +
    '<div class="wkkkopf"><h3 class="wkgname" id="wkGK-' + id + '"><button type="button" class="wkbk" data-wk-zu="' + id + '" data-f="zu:' + id + '" aria-expanded="' + !zu +
    '" aria-controls="wkGB-' + id + '"><span class="wkbname">' + esc(name) + "</span>" + standHtml(n, s.length, 20, fertig) + (fertig ? KHAKEN : "") +
    '<svg class="wkpfeil" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></h3></div>' +
    '<div class="wkbody" id="wkGB-' + id + '">' + inhalt + "</div></section>";
}
/* Ring und erledigt/gesamt im Kopf einer Kachel (20) oder eines Haendlers (16); "erledigt" steht nur an der Kachel. */
function standHtml(n: number, g: number, px: number, fertig: boolean): string {
  return '<span class="wkkstand">' + ring(px, 3, n / g) + '<span class="wkgzahl" aria-hidden="true"><b>' + n + "</b>/" + g + '</span><span class="vh">' +
    esc(t("weeklies.vonText", {n, m: g})) + "</span>" + (fertig && px > 16 ? '<span class="wkkerl">' + esc(t("weeklies.erledigt")) + "</span>" : "") + "</span>";
}
/* Das Feld "Haendler" (Spezifikation 10): je Haendler ein Block mit Name, kleinem Ring und seinen
   Punkten. Die Bloecke fliessen in Spalten und brechen nie um; ein erledigter tritt zurueck. */
function haendlerHtml(p: WeeklyProfil, s: Punkt[], jetzt: number): string {
  return '<div class="wkhaendler">' + HAENDLER.map(g => {
    const z = s.filter(x => x.gruppe === g);
    if(!z.length) return "";
    const n = z.filter(x => standVonPunkt(p, x, jetzt) >= x.menge).length, fertig = n === z.length;
    return '<section class="wkhd' + (fertig ? " fertig" : "") + '" data-wk-h="' + g + '" aria-labelledby="wkHK-' + g + '"><div class="wkhkopf"><h4 id="wkHK-' + g + '">' +
      esc(t("weeklies.gruppe." + g)) + "</h4>" + standHtml(n, z.length, 16, fertig) + '</div><ul class="wkliste" id="wkGL-' + g + '">' +
      z.map(x => zeileHtml(p, x, jetzt)).join("") + "</ul></section>";
  }).join("") + "</div>";
}
function wabenHtml(p: WeeklyProfil, jetzt: number): string {
  const alle = punkteVon(p).filter(sichtbar);
  // die Huelle des Wochenbands fuellt bandSetzen (im Minutentakt, ohne den Rest neu zu bauen)
  // ist der Raid zu, braucht er nur seine Kopfzeile: die Flaeche daneben faellt weg (.raidzu in styles.css)
  return '<div class="wkwaben' + (bereichIstZu(p, "raid", jetzt) ? " raidzu" : "") + '"><section class="wkfeld wkband" id="wkBand"></section>' +
    KACHELN.map(id => kachelHtml(p, id, alle.filter(x => kachelVon(x) === id), jetzt)).join("") + "</div>";
}
function anpZeileHtml(x: Punkt): string {
  const k = x.schluessel;
  if(punktEdit === k)
    return '<li class="wkanp wkedit" data-wk-anp="' + k + '"><form class="wkpform" id="wkPunktForm" data-k="' + k + '" novalidate>' +
      '<label class="vh" for="wkPunktName">' + esc(t("weeklies.punktNameLabel", {name: x.name})) + "</label>" +
      '<input id="wkPunktName" data-f="pn" maxlength="60" autocomplete="off" spellcheck="false" value="' + esc(x.name) + '"' + (x.eigen ? "" : ' placeholder="' + esc(x.grund) + '"') + ">" +
      '<button type="submit" class="btn sm">' + esc(t("weeklies.speichern")) + "</button>" + knopf("btn sm", 'data-wk-abbrechen="punkt"', t("weeklies.abbrechen")) + "</form></li>";
  const umb = knopf("leise", 'data-wk-umben="' + k + '" data-f="u:' + k + '" aria-label="' + esc(t("weeklies.umbenennenName", {name: x.name})) + '"', t("weeklies.umbenennen"));
  const zweit = x.eigen
    ? x.geloest ? knopf("leise", 'data-wk-eigen-zurueck="' + k + '" data-f="ez:' + k + '" aria-label="' + esc(t("weeklies.zurueckName", {name: x.name})) + '"', t("weeklies.zurueck"))
      : knopf("leise", 'data-wk-eigen-los="' + k + '" data-f="el:' + k + '" aria-label="' + esc(t("weeklies.loesenName", {name: x.name})) + '"', t("weeklies.loesen"))
    : knopf("leise", 'data-wk-aus="' + k + '" data-f="a:' + k + '" aria-label="' + esc(t(x.aus ? "weeklies.einName" : "weeklies.ausName", {name: x.name})) + '"',
        t(x.aus ? "weeklies.einblenden" : "weeklies.ausblenden"));
  const leise = x.aus ? t("weeklies.ausgeblendet") : x.geloest ? t("weeklies.geloestKurz") : x.name !== x.grund ? x.grund : "";
  return '<li class="wkanp' + (x.aus || x.geloest ? " aus" : "") + '" data-wk-anp="' + k + '"><span class="wkanpname"><span class="wkname" title="' + esc(x.name) + '">' + esc(x.name) + "</span>" +
    (leise ? '<span class="wkorig" title="' + esc(leise) + '">' + esc(leise) + "</span>" : "") + '</span><span class="wkakt">' + umb + zweit + "</span></li>";
}
function anpassenHtml(p: WeeklyProfil): string {
  const alle = punkteVon(p);
  const gruppen = GRUPPEN.map(g => {
    const s = alle.filter(x => x.gruppe === g);
    if(!s.length) return "";
    return '<section class="wkanpgruppe" data-wk-g="' + g + '"><h3 class="wkgkopf"><span class="wkgname">' + esc(t("weeklies.gruppe." + g)) + "</span></h3>" +
      '<ul class="wkliste">' + s.map(anpZeileHtml).join("") + "</ul></section>";
  }).join("");
  const eigen = '<form class="wkeigen" id="wkEigenForm" novalidate><h3 class="wkeigenkopf">' + esc(t("weeklies.eigenTitel")) + "</h3>" +
    '<span class="field wkef-name"><label for="wkEigenName">' + esc(t("weeklies.eigenName")) + '</label><input id="wkEigenName" data-f="en" maxlength="60" autocomplete="off" spellcheck="false"></span>' +
    '<span class="field wkef-menge"><label for="wkEigenMenge">' + esc(t("weeklies.eigenMenge")) + '</label><input id="wkEigenMenge" data-f="em" type="number" min="1" max="999" step="1" value="1" inputmode="numeric"></span>' +
    '<span class="field wkef-takt"><label for="wkEigenTakt">' + esc(t("weeklies.eigenTakt")) + '</label><select id="wkEigenTakt" data-f="et"><option value="woche">' +
      esc(t("weeklies.taktWoche")) + '</option><option value="tag">' + esc(t("weeklies.taktTag")) + "</option></select></span>" +
    '<button type="submit" class="btn sm" data-wk-eigen-neu data-f="eneu">' + esc(t("weeklies.eigenNeu")) + "</button></form>";
  return '<p class="wkanpsatz">' + esc(t("weeklies.anpSatz", {name: p.name})) + "</p>" + '<div class="wkgruppen">' + gruppen + "</div>" + eigen +
    '<p class="wkanpfuss">' + knopf("btn sm", 'data-wk-grundliste data-f="grund"', t("weeklies.grundliste")) + knopf("btn sm", 'data-wk-anpassen-fertig data-f="anpf"', t("weeklies.fertig")) + "</p>";
}
function bodyHtml(jetzt: number): string {
  if(lage === "nurApp") return '<div class="wbox wkleer">' + SYMBOL + '<p class="wksatz">' + esc(t("weeklies.nurApp")) + "</p></div>";
  if(lage === "laden") return '<p class="wksatz wkladen">' + esc(t("weeklies.laden")) + "</p>";
  if(lage === "gesperrt") return '<p class="wksatz wkgesperrt">' + esc(t("weeklies.gesperrt")) + "</p>";
  const akt = aktive(), p = profilJetzt();
  if(!p) return '<div class="wbox wkleer">' + SYMBOL + '<p class="wksatz">' + esc(t("weeklies.leer")) + "</p>" +
    (neuOffen ? neuFormHtml() : knopf("btn wkneu", 'id="wkNeu" data-f="neu"', t("weeklies.neu"))) + undoHtml() + "</div>" + geloesteHtml();
  gewaehlt = p.id;
  const nameForm = !nameOffen ? "" : '<form class="wkform" id="wkNameForm" novalidate><span class="field"><label for="wkNameNeu">' + esc(t("weeklies.nameNeu")) + "</label>" +
    '<input id="wkNameNeu" data-f="nu" maxlength="24" autocomplete="off" spellcheck="false" value="' + esc(p.name) + '"></span>' +
    '<button type="submit" class="btn sm">' + esc(t("weeklies.speichern")) + "</button>" + knopf("btn sm", 'data-wk-abbrechen="name"', t("weeklies.abbrechen")) + "</form>";
  return reiterHtml(akt, p, jetzt) + undoHtml() +
    '<div class="wkpanel" id="wkPanel" role="tabpanel" aria-labelledby="wkTab-' + p.id + '">' + nameForm +
      (anpassen ? anpassenHtml(p) : wabenHtml(p, jetzt)) + "</div>";
}

/* Den Fokus setzen: das Element mit data-f; ist es gesperrt, sein Zaehler. */
function fokusSetzen(box: HTMLElement, f: string){
  let e = box.querySelector<HTMLElement>('[data-f="' + f + '"]');
  const weg = (x: HTMLElement | null) => !x || (x as HTMLButtonElement).disabled || !x.getClientRects().length;
  if(e && weg(e)){
    const k = e.dataset.k;
    const z = k ? box.querySelector<HTMLElement>('[data-f="z:' + k + '"]') : null;
    e = !weg(z) ? z : null;
  }
  e?.focus();
}

/** Den Bereich zeichnen (renderAll ueber syncWeeklies, nach dem Lesen und jeder Handlung, im Minutentakt). */
export function renderWeeklies(){
  const box = document.querySelector<HTMLElement>("#wkBody");
  if(!box) return;
  const jetzt = Date.now();
  kopfSetzen(jetzt);
  statusSetzen();
  box.dataset.lage = lage;
  const h = bodyHtml(jetzt);
  const aktiv = document.activeElement as HTMLElement | null;
  const war = aktiv && box.contains(aktiv) ? aktiv.closest<HTMLElement>("[data-f]")?.dataset.f ?? null : null;
  if(box.dataset.marke !== h){
    // was in offenen Feldern steht, bleibt stehen
    const werte = new Map<string, string>();
    box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input:not([type=checkbox]),select").forEach(x => { if(x.id) werte.set(x.id, x.value); });
    box.innerHTML = h;
    box.dataset.marke = h;
    werte.forEach((v, id) => {
      const x = box.querySelector<HTMLInputElement>("#" + id);
      if(x && !(leeren && (id === "wkEigenName" || id === "wkEigenMenge"))) x.value = v;
    });
    if(leeren){ leeren = false; const m = box.querySelector<HTMLInputElement>("#wkEigenMenge"); if(m) m.value = "1"; }
    if(!fokus && war) fokusSetzen(box, war);
  }
  bandSetzen(jetzt);
  if(fokus){ const f = fokus; fokus = null; fokusSetzen(box, f); }
  haken.gezeichnet?.();
}
function nachHandlung(){
  // ein Bereich, der mit dieser Handlung fertig wurde, klappt zu: der Fokus geht auf seinen Kopf
  if(fertigGeworden){ fokus = "zu:" + fertigGeworden; fertigGeworden = null; }
  renderWeeklies();
}
/* Ein Bereich klappt auf oder zu: die Wahl merkt sich, ob der Bereich dabei fertig war (Kern, bereichZu). */
function zuUmschalten(g: string){
  const p = profilJetzt();
  if(!p) return;
  const jetzt = Date.now(), zu = bereichIstZu(p, g, jetzt);
  ersetze({...p, zu: {...(p.zu ?? {}), [g]: {zu: !zu, bei: istFertig(p, g, jetzt)}}});
  ansagen(t(zu ? "weeklies.auf" : "weeklies.zu", {name: t("weeklies.gruppe." + g)}));
  fokus = "zu:" + g;
  merken();
}
function alleUmschalten(){
  const p = profilJetzt();
  if(!p) return;
  const jetzt = Date.now(), gs = KACHELN.filter(g => punkteDes(p, g).length), zuJetzt = gs.length > 0 && gs.every(g => bereichIstZu(p, g, jetzt));
  const zu = {...(p.zu ?? {})};
  for(const g of gs) zu[g] = {zu: !zuJetzt, bei: istFertig(p, g, jetzt)};
  ersetze({...p, zu});
  ansagen(t(zuJetzt ? "weeklies.alleAufAngesagt" : "weeklies.alleZuAngesagt"));
  fokus = "allezu";
  merken();
}

/* Eine Ansage fuer den Vorleser (die Truhen): eine eigene, leise Region ausserhalb des neu gezeichneten Inhalts. */
function ansagen(text: string){
  const a = document.querySelector("#wkAnsage");
  if(a) a.textContent = text;
}

/* Fuer den Dialog der Erinnerungen (67): der Stand, das Aendern mit Speichern und Neuzeichnen, die Ansage, die Zahl der Charaktere mit offener Woche. */
export function weekliesDaten(): Stand | null { return lage === "da" ? daten : null; }
export function weekliesAendern(fn: (s: Stand) => void){ if(!daten || lage !== "da") return; fn(daten); merken(); renderWeeklies(); }
export function weekliesAnsage(text: string){ ansagen(text); }
export function weekliesDauer(ms: number): string { return dauer(ms); }
export function weekliesOffen(): number { const jetzt = Date.now(); return aktive().filter(p => !fortschrittVon(p, jetzt).fertig).length; }

/* ---------- Minutentakt, nur solange der Bereich offen ist ---------- */
let takt: ReturnType<typeof setTimeout> | null = null;
function planen(){
  takt = setTimeout(() => {
    takt = null;
    const w = document.querySelector<HTMLElement>("#weeklies");
    if(!w || w.hidden) return;
    renderWeeklies();
    planen();
  }, 60000 - Date.now() % 60000 + 50);
}
/** Aus renderAll (32): der Bereich ist offen oder zu. */
export function syncWeeklies(offen: boolean){
  if(offen){ renderWeeklies(); if(!takt) planen(); }
  else if(takt){ clearTimeout(takt); takt = null; }
}

/* ---------- Bedienung ---------- */
function klick(e: MouseEvent){
  const z = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if(!z || z.disabled || lage !== "da" && !z.matches("[data-wk-abbrechen]")) return;
  const d = z.dataset;
  meldung = ""; sechsHinweis = false;
  if(z.id === "wkNeu"){ if(aktive().length >= MAX_AKTIV){ sechsHinweis = true; fokus = "neu"; } else { neuOffen = true; fokus = "nn"; } }
  else if(d.wkAbbrechen !== undefined){
    if(d.wkAbbrechen === "neu"){ neuOffen = false; fokus = "neu"; }
    else if(d.wkAbbrechen === "name"){ nameOffen = false; fokus = "umb"; }
    else { fokus = punktEdit ? "u:" + punktEdit : null; punktEdit = null; }
  }
  else if(d.wkReiter){ gewaehlt = d.wkReiter; truhePos = null; anpassen = false; nameOffen = false; punktEdit = null; fokus = "r:" + d.wkReiter; }
  else if(d.wkUmbenennen !== undefined){ nameOffen = !nameOffen; fokus = nameOffen ? "nu" : "umb"; }
  else if(d.wkAnpassen !== undefined){ anpassen = !anpassen; punktEdit = null; fokus = "anp"; }
  else if(d.wkAnpassenFertig !== undefined){ anpassen = false; punktEdit = null; fokus = "anp"; }
  else if(d.wkLoesen !== undefined) profilLoesen();
  else if(d.wkUndo !== undefined) undoAusfuehren();
  else if(d.wkGeloeste !== undefined){ geloesteAuf = !geloesteAuf; fokus = "gz"; }
  else if(d.wkZurueck) profilZurueck(d.wkZurueck);
  else if(d.wkZu) zuUmschalten(d.wkZu);
  else if(d.wkAllezu !== undefined) alleUmschalten();
  // Umschalt+Klick zaehlt zehn (122.1)
  else if(d.wkPlus){ const x = aktuellerStand(d.wkPlus); if(x) setzeStand(d.wkPlus, x.s + (e.shiftKey ? 10 : 1)); }
  else if(d.wkMinus){ const x = aktuellerStand(d.wkMinus); if(x) setzeStand(d.wkMinus, x.s - (e.shiftKey ? 10 : 1)); }
  else if(d.wkZehn){ const x = aktuellerStand(d.wkZehn); if(x) setzeStand(d.wkZehn, x.s + 10); fokus = "y:" + d.wkZehn; }
  else if(d.wkKiste){
    // bis zur Kiste fuellen, oder bis vor sie zuruecknehmen, wenn sie schon gefuellt ist
    const x = aktuellerStand("goldeneKiste"), i = Number(d.wkKiste);
    if(x){
      const neu = i <= x.s ? i - 1 : i;
      setzeStand("goldeneKiste", neu);
      // der neue Stand wird angesagt: ein Klick auf eine gefuellte Truhe leert auch die dahinter
      ansagen(t("weeklies.kisten", {n: neu, m: x.menge}));
    }
    truhePos = i; fokus = "ki:" + i;
  }
  else if(d.wkVoll){ const x = aktuellerStand(d.wkVoll); if(x) setzeStand(d.wkVoll, x.menge); fokus = "v:" + d.wkVoll; }
  else if(d.wkAus) ausUmschalten(d.wkAus);
  else if(d.wkUmben){ punktEdit = d.wkUmben; fokus = "pn"; }
  else if(d.wkEigenLos) eigenLoesen(d.wkEigenLos, true);
  else if(d.wkEigenZurueck) eigenLoesen(d.wkEigenZurueck, false);
  else if(d.wkGrundliste !== undefined) grundliste();
  else return;
  // der Satz mit Rueckgaengig bleibt nur bis zur naechsten Handlung an einem anderen Ort
  if(d.wkLoesen === undefined && d.wkEigenLos === undefined && d.wkUndo === undefined && d.wkGeloeste === undefined && d.wkZu === undefined && d.wkAllezu === undefined) undo = null;
  nachHandlung();
}
function aktuellerStand(k: string): {s: number; menge: number} | null {
  const p = profilJetzt();
  const x = p && punkteVon(p).find(y => y.schluessel === k);
  return p && x ? {s: standVonPunkt(p, x, Date.now()), menge: x.menge} : null;
}
function aendern(e: Event){
  const i = e.target as HTMLInputElement;
  if(i.id === "wkNurOffen"){ nurOffen = i.checked; fokus = "nur"; ansagen(t(nurOffen ? "weeklies.nurOffenAn" : "weeklies.nurOffenAus")); return nachHandlung(); }
  // der Stand eines Zaehlers laesst sich eintippen (122.1); setzeStand begrenzt auf 0 bis Menge
  const sk = i.dataset.wkStand;
  if(sk && lage === "da"){
    const v = Number(i.value.replace(/\D/g, ""));
    meldung = ""; undo = null;
    setzeStand(sk, Number.isFinite(v) ? v : 0);
    fokus = "z:" + sk;
    return nachHandlung();
  }
  const k = i.dataset.wkHaken;
  if(!k || lage !== "da") return;
  meldung = "";
  undo = null;
  // ein Feld des Rasters traegt danach den Tabstopp
  if(i.dataset.rx !== undefined) rasterPos = k;
  setzeStand(k, i.checked ? 1 : 0);
  fokus = "h:" + k;
  nachHandlung();
}
function absenden(e: Event){
  e.preventDefault();
  const f = e.target as HTMLFormElement;
  if(lage !== "da") return;
  meldung = "";
  const wert = (id: string) => f.querySelector<HTMLInputElement>("#" + id)?.value ?? "";
  if(f.id === "wkNeuForm") anlegen(wert("wkNeuName"));
  else if(f.id === "wkNameForm") umbenennen(wert("wkNameNeu"));
  else if(f.id === "wkPunktForm" && f.dataset.k) punktUmbenennen(f.dataset.k, wert("wkPunktName"));
  else if(f.id === "wkEigenForm") eigenerPunkt(wert("wkEigenName"), wert("wkEigenMenge"), f.querySelector<HTMLSelectElement>("#wkEigenTakt")?.value ?? "woche");
  else return;
  nachHandlung();
}
/* Das Raid-Raster: Pfeile wandern zum naechsten Feld in der Richtung (leere
   Felder werden uebersprungen, am Rand bleibt der Fokus stehen), Pos1 und
   Ende an den Anfang und das Ende der Zeile, mit Strg an das erste und
   letzte Feld. Die Leertaste hakt wie jede Checkbox. */
function rasterTaste(e: KeyboardEvent, z: HTMLInputElement){
  // mit Umschalt, Alt oder Meta gehoert die Taste dem Browser; Strg nur mit Pos1 und Ende (Pruefung N2)
  if(e.altKey || e.metaKey || e.shiftKey || e.ctrlKey && e.key !== "Home" && e.key !== "End") return;
  const zellen = [...document.querySelectorAll<HTMLInputElement>("#wkBody .wkraster input[data-rx]")];
  const pos = (c: HTMLInputElement) => [Number(c.dataset.rx), Number(c.dataset.ry)] as const;
  const [x, y] = pos(z);
  const bei = (a: number, b: number) => zellen.find(c => pos(c)[0] === a && pos(c)[1] === b);
  const suche = (dx: number, dy: number) => {
    for(let a = x + dx, b = y + dy, i = 0; i < 6; a += dx, b += dy, i++){ const c = bei(a, b); if(c) return c; }
    return undefined;
  };
  const zeile = zellen.filter(c => pos(c)[1] === y);
  const ziel = e.key === "ArrowRight" ? suche(1, 0) : e.key === "ArrowLeft" ? suche(-1, 0) : e.key === "ArrowDown" ? suche(0, 1) : e.key === "ArrowUp" ? suche(0, -1)
    : e.key === "Home" ? (e.ctrlKey ? zellen[0] : zeile[0]) : e.key === "End" ? (e.ctrlKey ? zellen.at(-1) : zeile.at(-1)) : null;
  if(ziel === null) return;
  e.preventDefault();
  if(!ziel || ziel === z) return;
  rasterPos = ziel.dataset.wkHaken!;
  fokus = "h:" + rasterPos;
  nachHandlung();
}
function taste(e: KeyboardEvent){
  const z = e.target as HTMLElement;
  if(z.getAttribute("role") === "tab"){
    const tabs = [...document.querySelectorAll<HTMLElement>('#wkReiter [role="tab"]')], i = tabs.indexOf(z);
    const j = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
      : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if(j < 0 || i < 0) return;
    e.preventDefault();
    gewaehlt = tabs[j]!.dataset.wkReiter!; anpassen = false; nameOffen = false; punktEdit = null;
    fokus = "r:" + gewaehlt;
    return nachHandlung();
  }
  if(z instanceof HTMLInputElement && z.dataset.rx !== undefined) return rasterTaste(e, z);
  if(z.dataset.wkKiste && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey){
    // die Truhen: Pfeile wandern, Pos1 und Ende springen an den Rand; Leertaste und Enter klicken wie jeder Knopf
    const i = Number(z.dataset.wkKiste), m = document.querySelectorAll("#wkBody [data-wk-kiste]").length;
    const j = e.key === "ArrowRight" ? Math.min(m, i + 1) : e.key === "ArrowLeft" ? Math.max(1, i - 1) : e.key === "Home" ? 1 : e.key === "End" ? m : 0;
    if(!j) return;
    e.preventDefault();
    if(j === i) return;
    truhePos = j; fokus = "ki:" + j;
    return nachHandlung();
  }
  // am Feld des Standes: Pfeil hoch und runter zaehlen eins, Bild auf und ab zehn; links, rechts, Pos1 und Ende gehoeren dem Cursor
  const k = z instanceof HTMLInputElement ? z.dataset.wkStand : undefined;
  if(k){
    const x = aktuellerStand(k);
    if(!x) return;
    const neu = e.key === "ArrowUp" ? x.s + 1 : e.key === "ArrowDown" ? x.s - 1 : e.key === "PageUp" ? x.s + 10 : e.key === "PageDown" ? x.s - 10 : null;
    if(neu == null) return;
    e.preventDefault();
    meldung = ""; undo = null;
    setzeStand(k, neu);
    fokus = "z:" + k;
    return nachHandlung();
  }
  if(e.key === "Escape"){
    const f = z.closest("form");
    if(!f) return;
    e.preventDefault();
    meldung = "";
    if(f.id === "wkNeuForm"){ neuOffen = false; fokus = "neu"; }
    else if(f.id === "wkNameForm"){ nameOffen = false; fokus = "umb"; }
    else if(f.id === "wkPunktForm"){ fokus = punktEdit ? "u:" + punktEdit : null; punktEdit = null; }
    else return;
    nachHandlung();
  }
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  const box = document.querySelector<HTMLElement>("#wkBody");
  if(box){
    box.addEventListener("click", klick);
    box.addEventListener("change", aendern);
    box.addEventListener("submit", absenden);
    box.addEventListener("keydown", taste);
  }
  // die eingebetteten Bilder einmal als Stilblatt (60-weeklies-bilder.ts), nichts wird geladen
  if(!document.querySelector("#wkBilder")){
    const st = document.createElement("style");
    st.id = "wkBilder";
    st.textContent = wkBilderCss();
    document.head.append(st);
  }
  if(box && !document.querySelector("#wkAnsage")){
    const a = document.createElement("span");
    a.id = "wkAnsage"; a.className = "vh"; a.setAttribute("role", "status");
    box.parentElement?.before(a);
  }
  addEventListener("pagehide", beimVerlassen);
  if(!SERVED) lage = "nurApp";
  else laden();
  renderWeeklies();
}
