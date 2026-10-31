import { state } from "./01-state";
import { fmt } from "./03-helpers";
import { DUNGEON_TAFEL, histKey, knownBoss, OFFENE_BOSSE } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { bossIcon, skillIcon } from "./12-boss-images";
import { skillEntry } from "./10-skill-names";
import { $, esc } from "./18-interface-basics";
import { logOrdnerKennt, oeffneDateien, waehleKampf } from "./23-kampfwahl";
import { histNachlesen, histRecord, renderAll, topName, verlaufZiele } from "./32-history";
import { switchTab } from "./34-menus-drop-and-tabs";
import { konfigGelesen, SERVED } from "./41-server-mode";
import { charakterAnlegen, charakterIgnorieren, rekordCharaktere, rekordHaken, weekliesIgnoriert, type CharaktereZeile } from "./59-weeklies";
import { wkBilderCss, wkHatBild } from "./60-weeklies-bilder";
import { archivKennt, archivRueckfall, archivStand, archivStandGelesen } from "./76-archiv";
import { abendText } from "../build-core";
import { charakterFuer, UNBEKANNT, zuordnungsStand } from "../charaktere-core";
import { albumTafel, lesebedarf, NACH_MAX, rekorde, twinkRekorde, twinkSortiert, twinkTeile, zuwachs, type RkAlbum, type RkKampf, type RkOrt, type RkPlatz,
  type RkSeiteWert, type RkWert, type TwAlbum, type TwSort, type TwTeil } from "../rekorde-core";
import { mitDatum } from "../verlauf-core";

/* ---------- Rekorde (Spezifikation 2026-10-01-rekorde-design.md, 2a und 3) ----------
   Ein Ort wie die Weeklies (state.rekorde, switchTab("rekorde")): ein
   Sammelalbum deiner Bestwerte je Boss. Oben der Held - der hoechste Treffer
   insgesamt, gross in der Anzeigeschrift, daneben Faehigkeit, Boss und Tag.
   Darunter die Albumseiten nach Gebiet aus der Boss-Tabelle der App: Raid
   und Uebungspuppe nebeneinander, dann Feldbosse und Dungeons, je mit
   "N von M bekaempft". Je Boss ein Medaillon: rundes Portraet, Name, bester
   DPS gross mit "+x % - vorher ..." oder "der erste von N Kaempfen", klein
   der staerkste Treffer mit Faehigkeitssymbol, zuletzt der erste Kampf. Noch
   nie bekaempfte Bosse stehen als leerer Umriss mit Namen. Gold nur auf den
   Zahlen; kein Rot, kein Gruen; keine Meldung.

   Gerechnet wird in ../rekorde-core.ts aus allen Eintraegen des Verzeichnisses
   (rekordKaempfe): geoeffnete und nur nachgelesene Dateien, dazu die
   gespeicherten besten Pulls, die das Verzeichnis nicht kennt (Spezifikation
   Bester Pull 4 und 5.3) - dieselbe Menge wie "Gegen deinen besten Pull".

   Jedes Medaillon mit Kampf ist ein Knopf (Bester Pull 5.3): er oeffnet das
   Log des besten Pulls (ohne besten den neuesten Kampf) und waehlt ihn, wenn
   die Datei im Log-Ordner liegt; sonst wechselt er in den Verlauf dieses
   Bosses. Geht keins von beiden (im Browser ein Boss, den der Verlauf nicht
   zeigt), bleibt das Medaillon ein Listenpunkt ohne Knopf.
   Die Raid-Portraets sind eigene Bildschirmfotos aus den Weeklies
   (60-weeklies-bilder.ts, als Klassen wkb-*), die uebrigen kommen ueber
   bossIcon, die Faehigkeitssymbole ueber skillIcon.

   Das einmalige Nachlesen (Spezifikation 3): beim Oeffnen des Bereichs
   fragt die Seite den Helfer nach den Logdateien des Ordners
   (GET /api/logs, die 60 neuesten) und liest die, deren Kaempfe noch kein
   top haben, ueber GET /api/log - Stueck fuer Stueck wie "Fruehere Tage"
   (23-kampfwahl.ts). Jede Datei geht durch histNachlesen (32-history.ts)
   und steht danach im Verlauf; gespeichert wird dort (32), nicht hier.
   Dazu "Lese 12 von 60 Logs ..." mit Abbrechen; ein Abbruch verliert nichts,
   beim naechsten Oeffnen geht es weiter. Danach liest es nichts Altes mehr,
   eine gewachsene Datei nur ab der bekannten Groesse. "Rekorde neu einlesen"
   in den Einstellungen liest alle 60 noch einmal; geloescht wird nichts.
   Im Browser ohne App gibt es keinen Ordner: dann ein Satz und kein Lesen. */

type Lage = "ruhe" | "liest" | "angehalten" | "fehler";
let lage: Lage = "ruhe";
let gelesen = 0, zuLesen = 0;
/* Koennen aeltere Logs ungelesen sein? null, solange der Helfer keine Liste
   gegeben hat (und im Browser): dann vorsichtig ja. Die volle Liste (60)
   heisst ebenfalls ja; mehr kann die Seite nicht wissen. */
let aelter: boolean | null = null;
/** in diesem Oeffnen schon gefragt; schliessen setzt es zurueck */
let gefragt = false;
let halt: AbortController | null = null;
let offen = false;
let tafel: ReturnType<typeof albumTafel> | null = null;

/* Die Raid-Teile tragen eigene Bildschirmfotos (60-weeklies-bilder.ts), Radeth seit 02.10.2026. */
const RAID_BILD: Record<string, string> = {"raid:dragaryle": "zitadelle", "raid:zairos \u00b7 vulkan": "korridor", "raid:calanthia": "altar", "raid:radeth": "radeth"};

/** Aus renderAll: zeichnet, solange der Bereich steht, und fragt beim Oeffnen einmal nach neuen Logs. */
export function syncRekorde(sichtbar: boolean){
  const geoeffnet = sichtbar && !offen;
  offen = sichtbar;
  if(!sichtbar){ if(lage !== "liest") gefragt = false; return; }
  /* Die kleine Bewegung beim Oeffnen (styles.css .rkinhalt.auf): einmal je
     Oeffnen; was danach neu gezeichnet wird, steht still (.still). */
  const box = document.getElementById("rkInhalt");
  if(geoeffnet && box){
    box.classList.remove("auf");
    box.querySelectorAll(".still").forEach(x => x.classList.remove("still"));
    void box.offsetWidth;
    box.classList.add("auf");
  }
  renderRekorde(!geoeffnet);
  /* Das Verzeichnis des Archivs, einmal: ein Kampf, dessen Log fehlt, oeffnet dann von dort (archivKennt, 76) */
  if(geoeffnet && SERVED && !archivStandGelesen()) void archivStand().then(l => { if(l && offen) renderRekorde(); });
  if(!gefragt && SERVED && lage !== "liest"){ gefragt = true; void nachlesen(false); }
}

/** "Rekorde neu einlesen" (Einstellungen): alle Dateien der Liste noch einmal. */
export function rekordeNeuEinlesen(){
  if(!SERVED || lage === "liest") return;
  gefragt = true;
  void nachlesen(true);
}

/* ---------- das Nachlesen ---------- */
type Stueck = { file?: unknown; from?: unknown; to?: unknown; size?: unknown; text?: unknown; head?: unknown };
const signal = () => AbortSignal.any([halt!.signal, AbortSignal.timeout(10000)]);

async function nachlesen(alle: boolean){
  halt = new AbortController();
  lage = "liest"; gelesen = 0; zuLesen = 0;
  zeichneStand();
  let liste: { name: string; size: number }[];
  try {
    // erst der Verlauf aus den Einstellungen (41): ohne ihn gaelte jede Datei als ungelesen
    if(!(await konfigGelesen)) throw new Error("konfig");
    const r = await fetch("/api/logs", {signal: signal()});
    const d = r.ok ? await r.json().catch(() => null) : null;
    if(!d || d.ok !== true || !Array.isArray(d.files)) throw new Error("liste");
    liste = (d.files as unknown[]).filter((f): f is { name: string; size: number } => !!f && typeof (f as {name: unknown}).name === "string"
      && Number.isSafeInteger((f as {size: unknown}).size));
  } catch {
    lage = halt.signal.aborted ? "angehalten" : "fehler";
    halt = null;
    if(offen) renderRekorde(); else zeichneStand();
    return;
  }
  aelter = liste.length >= NACH_MAX;
  // solange die Charaktere nicht gelesen sind, kein Grund, alles noch einmal zu lesen (charaktereBekannt)
  const todo = lesebedarf(liste, state.hist.files, alle, state.charaktereBekannt ? zuordnungsStand(state.charaktere) : "");
  zuLesen = todo.length;
  if(offen && zuLesen) renderRekorde();   // der Held sagt jetzt "bisher"
  else zeichneStand();
  for(const x of todo){
    const stueck = await dateiLesen(x.name, x.ab);
    if(halt.signal.aborted){ lage = "angehalten"; break; }
    if(stueck === "fehler"){ lage = "fehler"; break; }
    if(stueck){
      try { histNachlesen(x.name, stueck.text, stueck.ab, stueck.bytes, stueck.kopf); }
      catch { /* eine Datei, die sich nicht lesen laesst, haelt die anderen nicht auf */ }
    }
    gelesen++;
    zeichneStand();
    if(offen) renderRekorde();
    // ein Bild Luft zwischen zwei Dateien: Abbrechen und Rollen bleiben bedienbar
    await new Promise(r => setTimeout(r, 0));
  }
  if(lage === "liest") lage = "ruhe";
  halt = null;
  if(offen) renderRekorde();
  // geoeffnete Dateien haben jetzt ihren Treffer (nur nachgelesene zaehlen im Verlauf nicht, histCollect)
  if(gelesen) renderAll();
  zeichneStand();
}

/* Eine Datei ab dem Byte "ab", Stueck fuer Stueck bis zum Ende. null: die
   Datei steht nicht mehr im Ordner (404) - sie wird uebersprungen. Ist sie
   kuerzer als "ab" (409, eine neue Datei unter altem Namen), wird sie ganz
   gelesen. */
async function dateiLesen(name: string, ab: number): Promise<{ text: string; ab: number; bytes: number; kopf: string } | null | "fehler"> {
  let text = "", from = ab, kopf = "";
  for(;;){
    let d: Stueck | null, status = 0;
    try {
      const r = await fetch("/api/log?name=" + encodeURIComponent(name) + "&from=" + from, {signal: signal()});
      status = r.status;
      d = r.ok ? await r.json().catch(() => null) : null;
    } catch { return "fehler"; }
    if(status === 404) return null;
    if(status === 409 && ab > 0){ ab = 0; from = 0; text = ""; continue; }
    if(!d) return "fehler";
    const to = d.to, size = d.size;
    if(d.file !== name || d.from !== from || typeof d.text !== "string" || typeof to !== "number" || typeof size !== "number"
       || !Number.isSafeInteger(to) || !Number.isSafeInteger(size) || to < from || size < to) return "fehler";
    text += d.text;
    if(typeof d.head === "string") kopf = d.head;
    if(to === size || to === from) return {text, ab, bytes: to, kopf};
    from = to;
  }
}

/* ---------- Zeichnen ---------- */
const tagKurz = (ms: number) => abendText(new Date(ms).toISOString().slice(0, 10), state.lang);
const tagLang = (ms: number) => tagKurz(ms) + (state.lang === "de" ? "" : "/") + new Date(ms).getUTCFullYear();
/* Der Name aus der Tabelle in der Sprache der Seite (beide Client-Schreibweisen sind ein Platz). */
const ortName = (o: RkOrt) => o.klasse != null ? t("rk.puppe", {s: o.klasse}) : state.lang === "de" ? o.de : o.en;
const unterName = (u: { de: string; en: string } | null) => u ? (state.lang === "de" ? u.de : u.en) : "";
/* Gold nur auf Zahlen: die Zahl im Satz in <b> (styles.css), der Rest Text. */
const mitZahlen = (key: string, v: Record<string, number | string>, frei: Record<string, string> = {}) => {
  const marken: Record<string, string> = {...frei};
  for(const k of Object.keys(v)) marken[k] = "\u0001" + v[k] + "\u0002";
  return esc(t(key, marken)).replace(/\u0001/g, "<b>").replace(/\u0002/g, "</b>");
};

function bild(o: RkOrt, klasse: string){
  const wk = RAID_BILD[o.id];
  if(wk && wkHatBild(wk)) return '<span class="' + klasse + " wkb-" + wk + '" aria-hidden="true"></span>';
  /* Rueckfall fuer ein kuenftiges Raid-Teil ohne Foto (heute tragen alle
     eins): eine ruhige Platte mit dem Anfang des Namens statt der roten
     Maske, die zwischen den Fotos fremd stuende */
  if(o.id.startsWith("raid:")) return '<span class="' + klasse + ' init" aria-hidden="true">' + esc(o.de.slice(0, 1)) + "</span>";
  const u = bossIcon(o.klasse != null ? "Practice Dummy" : o.en) || bossIcon(o.de) || o.namen.map(n => bossIcon(n)).find(Boolean) || null;
  return u ? '<img class="' + klasse + '" src="' + u + '" alt="" aria-hidden="true">' : '<span class="' + klasse + '" aria-hidden="true"></span>';
}

/* Die Faehigkeit zur Kennung: aus dem Woerterbuch (SKILL_ID_NAME, gelernte
   Namen), sonst der Name aus dem Log, den nur die Sitzung kennt (topName),
   sonst nur "Faehigkeit". Das Symbol ebenso ueber die Kennung. */
function faehigkeit(sid: string){
  const e = sid ? skillEntry("", sid) : null;
  return (e && (e[state.lang] || e.en)) || topName(sid) || t("rk.faehigkeit");
}
const faehigkeitBild = (sid: string) => sid ? skillIcon(topName(sid), sid) : null;
/* Kurz ab 1000 ("2.2k" statt "2.171"): neben "224.0k" laesst sich ein Punkt
   als Tausender nicht vom Komma unterscheiden. */
const zahl = (n: number) => fmt(n, 1000);

function medaillon(p: RkPlatz, i: number){
  const o = p.ort, w = p.wert;
  const name = ortName(o);
  const unter = o.unter ? '<span class="munter">' + esc(unterName(o.unter)) + "</span>" : "";
  const stil = ' style="--i:' + i + '"';
  if(!w) return '<li class="rkmed leer"' + stil + '><span class="bild" aria-hidden="true"></span><span class="mname">' + esc(name) + "</span>" + unter +
    '<span class="vh">' + esc(t("rk.leerVh", {w: t("rk.bekaempft")})) + "</span></li>";
  const plus = w.vorher != null ? t("rk.plus", {p: w.plus ?? 0, w: zahl(w.vorher)}) : w.n === 1 ? t("rk.einKampf") : t("rk.ersterVon", {n: w.n});
  /* Als Knopf (Bester Pull 5.3) nennt der Name, was sichtbar steht - Boss
     und Wert (aria-labelledby, WCAG 2.5.3) - und die Handlung (.vh). Der
     Rest des Medaillons bleibt fuer den Vorleser als Beschreibung
     (aria-describedby). Die Kennungen zaehlen ueber das ganze Album. */
  const knopf = weg(o, w.bester ? w.dpsAt : w.zuletzt);
  const id = (teil: string) => knopf ? ' id="rkm' + i + teil + '"' : "";
  const sb = w.top != null ? faehigkeitBild(w.topSid!) : null;
  const top = w.top != null
    ? '<span class="mtop"' + id("t") + '><span class="vh">' + esc(t("rk.topVh")) + "</span>" + (sb ? '<img src="' + sb + '" alt="" aria-hidden="true">' : "") +
      "<b>" + esc(zahl(w.top)) + '</b></span><span class="mskill"' + id("s") + ">" +
      esc(w.topTeil ? t("rk.teil", {skill: faehigkeit(w.topSid!), teil: w.topTeil}) : faehigkeit(w.topSid!)) + "</span>"
    : '<span class="mtop offen"' + id("t") + ">" + esc(t("rk.offen")) + "</span>";
  // "ab": der Satz dazu steht im title und fuer Vorleser im Medaillon (.vh)
  const erst = w.ab ? '<span class="merst"' + id("e") + ' title="' + esc(t("rk.abTitle")) + '">' + esc(t("rk.ersterAb", {d: tagKurz(w.erster)})) +
      '<span class="vh">' + esc(t("rk.abVh")) + "</span></span>"
    : '<span class="merst"' + id("e") + ">" + esc(t("rk.erster", {d: tagKurz(w.erster)})) + "</span>";
  const r = "rkm" + i;
  const beschrieben = [o.unter ? "u" : "", "p", "t", w.top != null ? "s" : "", "e"].filter(Boolean).map(x => r + x).join(" ");
  return '<li class="rkmed"' + stil + ">" +
    (knopf ? '<button type="button" class="rkknopf" data-at="' + knopf.at + '" data-datei="' + esc(knopf.datei) + '" data-ort="' + esc(knopf.ort) +
      '" aria-labelledby="' + r + "n " + r + "w " + r + 'h" aria-describedby="' + beschrieben + '">' : "") +
    bild(o, "bild") + '<span class="mname"' + id("n") + ">" + esc(name) + "</span>" +
    (o.unter ? '<span class="munter"' + id("u") + ">" + esc(unterName(o.unter)) + "</span>" : "") +
    /* ohne besten Pull (Spezifikation Bester Pull 5.3): bekaempft, aber keine Zahl und kein Datum */
    (w.bester
      ? '<span class="mdps"' + id("w") + '><span class="vh">' + esc(t("rk.dpsVh")) + "</span>" + esc(zahl(w.dps)) + "</span>" +
        '<span class="mplus"' + id("p") + ">" + esc(plus) + '<span class="vh"> \u00b7 ' + esc(t("rk.dpsAm", {d: tagKurz(w.dpsAt)})) + "</span></span>"
      : '<span class="mdps offen"' + id("w") + ">" + esc(t("rk.keinBester")) + "</span>" + '<span class="mplus"' + id("p") + ">" + esc(plus) + "</span>") +
    '<span class="mtrenn" aria-hidden="true"></span>' + top + erst +
    (knopf ? '<span class="vh"' + id("h") + ">" + esc(t(knopf.log ? "rk.oeffnen" : "rk.verlauf")) + "</span></button>" : "") + "</li>";
}

function seite(s: RkSeiteWert, zaehler: { i: number }){
  const unter = s.id === "raid" ? unterName(s.unter) : t("rk.u." + s.id);
  const listen = s.gruppen.map(g => (g.key ? '<h4 class="rkgruppe">' + esc(t("rk.g." + g.key)) + "</h4>" : "") +
    '<ul class="rkraster" role="list" style="--n:' + g.plaetze.length + '">' + g.plaetze.map(p => medaillon(p, zaehler.i++)).join("") + "</ul>").join("");
  return '<section class="rkseite" id="rks-' + s.id + '" aria-labelledby="rkst-' + s.id + '"><div class="skopf"><h3 id="rkst-' + s.id + '">' +
    esc(t("rk.s." + s.id)) + '</h3><span class="sunter">' + esc(unter) + '</span><span class="szahl">' +
    mitZahlen("rk.seiteZahl", {n: s.besiegt, m: s.gesamt}, {w: t("rk.bekaempft")}) + "</span></div>" + listen + "</section>";
}

function held(a: RkAlbum, label = "", von = ""){
  const h = a.held;
  if(!h){
    if(a.kaempfe) return "";
    return '<section class="rkleer" aria-labelledby="rkLeerT"><h3 id="rkLeerT">' + esc(t("rk.leerT")) + "</h3><p>" + esc(t("rk.leerSatz")) + "</p></section>";
  }
  const name = ortName(h.ort);
  const was = h.topTeil ? t("rk.teil", {skill: faehigkeit(h.topSid), teil: h.topTeil}) : faehigkeit(h.topSid);
  const sb = faehigkeitBild(h.topSid);
  return '<section class="rkheld" aria-labelledby="rkHeldT">' + bild(h.ort, "wasser") +
    '<div class="h1"><h3 class="hlabel" id="rkHeldT">' + esc(label || t(lage === "liest" && zuLesen > 0 ? "rk.heldBisher" : "rk.held")) + '</h3><span class="hzahl">' + esc(fmt(h.top)) + "</span></div>" +
    '<div class="hteil">' + (sb ? '<img src="' + sb + '" alt="" aria-hidden="true">' : "") + "<span><small>" + esc(t("rk.faehigkeit")) + "</small><b>" + esc(was) + "</b></span></div>" +
    '<div class="hteil">' + bild(h.ort, "port") + "<span><small>" + esc(t("rk.an")) + "</small><b>" + esc(name) + "</b></span></div>" +
    '<div class="hteil"><span><small>' + esc(t("rk.am")) + "</small><b>" + esc(tagLang(h.at)) + "</b></span></div>" + von + "</section>";
}

/* Gezeichnet wird je Block (Held, vier Seiten und Auge von Ventius), und nur, was sich
   geaendert hat: beim Nachlesen kommt Datei um Datei etwas dazu, und der
   Rest soll stehen bleiben, ohne neu einzublenden. still: ein Block, der
   nach dem Oeffnen neu gezeichnet wurde, blendet nicht noch einmal ein. */
/* Alle Kaempfe des Verzeichnisses mit ihrer Datei, auch die nur
   nachgelesenen (nach), die Verlauf und Builds nicht zaehlen (histCollect).
   Dazu die zwei gespeicherten Pulls je Schluessel (boro-best.json), deren at
   das Verzeichnis nicht kennt, wie bossPulls (46-best-pull.ts) sie nimmt:
   sonst zeigten Medaillon und "Gegen deinen besten Pull" verschiedene
   Zahlen. Ihr Name kommt aus dem Lauf; fehlt er, der Schluessel (der
   histKey findet seinen Platz, test-rekorde-core.mjs). Ohne die Summen
   einer Gruppe (g, histRecord), wie bossPulls: sie sind nie dein bester
   Pull (Entscheidung 06.10.). Ein gespeicherter Pull mit demselben at
   (derselbe Kampf, mit einem gewaehlten Angreifer gerechnet) zaehlt dann
   wie dort. Ohne einen Kampf ohne Datum (mitDatum, Fix verlauf-ohne-datum):
   er stuende am 01.01.1970. */
type RkEintrag = RkKampf & { file: string };
function rekordKaempfe(): RkEintrag[] {
  const raus: RkEintrag[] = [];
  const bekannt = new Set<number>();
  for(const [file, e] of Object.entries(state.hist.files)) for(const f of e.fights || []){
    if(f.g || !mitDatum(f.at)) continue;
    raus.push({...f, file}); bekannt.add(f.at);
  }
  for(const [key, e] of Object.entries(state.best)) for(const p of [e.best, e.second]){
    if(!p || bekannt.has(p.at)) continue;
    bekannt.add(p.at);
    const c = key.startsWith("dummy:") ? Number(key.slice(6)) : 0;
    raus.push({name: p.run.name || key.replace(/^(?:boss|dummy):/, ""), dps: p.run.dps, dur: p.run.seconds ?? 0, at: p.at, file: p.file,
      ...(c ? {c} : {})});
  }
  return raus;
}

/* Wohin ein Medaillon fuehrt (Bester Pull 5.3), je Zeichnen einmal
   bestimmt: die Kaempfe nach at und die Bosse, die der Verlauf zeigt. */
let wege: { kaempfe: Map<number, RkEintrag>; verlauf: Set<string> } = {kaempfe: new Map(), verlauf: new Set()};
/* Der Kampf at eines Platzes: seine Datei und sein Boss im Verlauf (histKey;
   die Uebungspuppe steht nicht im Verlauf). null: weder Log noch Verlauf. */
function weg(o: RkOrt, at: number): { at: number; datei: string; ort: string; log: boolean } | null {
  const k = wege.kaempfe.get(at);
  if(!k) return null;
  const ort = o.klasse != null ? "" : histKey(k.name);
  const log = logGeht(k.file, at);
  return log || verlaufGeht(ort, wege.verlauf) ? {at, datei: k.file, ort, log} : null;
}
/* Das Log oeffnen geht mit dem Helfer, wenn der Log-Ordner die Datei kennt
   oder seine Liste noch nicht da ist (dann sagt oeffneDateien "Datei fehlt"),
   oder wenn der Kampf im Archiv liegt (Spezifikation Log-Archiv 8; 76). */
const logGeht = (datei: string, at: number) => SERVED && !!datei && (logOrdnerKennt(datei.split(" + ")) !== false || archivKennt(datei, at));
/* Der Verlauf steht nur neben einem geladenen Kampf (#app) und zeigt nur Bosse mit zwei Kaempfen. */
const verlaufGeht = (ort: string, ziele: Set<string>) => !!ort && state.encounters.length > 0 && ziele.has(ort);

/* Der Klick: das Log wie "Log oeffnen" in der Tafel (56-tafel.ts), dann
   der Kampf mit diesem Beginn, der Fokus auf die Kampfwahl. Kommt die Datei
   nicht (Toast "Datei fehlt" oder ein Lesefehler), geht es wie ohne Datei
   weiter: in den Verlauf mit diesem Boss, der Fokus auf seine Wahl - gibt
   es ihn dort nicht, bleibt alles, wie es war. Fehlt die Datei im Ordner,
   kommt der Kampf aus dem Archiv, wenn er dort liegt (archivRueckfall, 76;
   laden() dort waehlt ihn und setzt den Fokus wie hier). */
async function medaillonOeffnen(b: HTMLElement){
  const at = Number(b.dataset.at), datei = b.dataset.datei || "", ort = b.dataset.ort || "";
  if(logGeht(datei, at)){
    const namen = datei.split(" + ");
    await oeffneDateien(namen, aktuell => archivRueckfall(datei, at, aktuell));
    if((state.fileNames || []).join(" + ") === namen.join(" + ")){
      const i = state.encounters.findIndex(s => s.start === at);
      if(i >= 0) waehleKampf(i);
      $("#kwKnopf").focus({preventScroll: true});
      return;
    }
  }
  if(!verlaufGeht(ort, verlaufZiele())) return;
  state.hist.sel = ort;
  switchTab("history");
  document.getElementById("histBoss")?.focus({preventScroll: true});
}
/* ---------- Auge von Ventius (#218 Etappe 3, Entscheidung vom 08.10.2026) ----------
   Die Tabelle "Bester Einsatz je Boss" stand zugeklappt unter dem Fach
   Auge von Ventius in der Analyse; dort zeigte sie andere Bosse als den
   Kampf. Hier steht sie als eigener Abschnitt nach den Dungeons, in der
   Sprache der Albumseiten (.rkseite, .skopf, .sunter, .szahl). Gelesen wird
   nur state.ventiusTop (15-weapons-and-ventius.ts lernt es beim Oeffnen
   eines Logs); das Nachlesen schreibt es nie. Nur bekannte Bosse, Trash ist
   tot, bevor die Frage sich stellt. Ohne einen gemerkten Boss gibt es den
   Abschnitt nicht, auch keine leere Ueberschrift. Rollen statt
   Tabellenelementen: das Raster traegt die Spalten. Bossname in der Serife,
   die Zahlen in der Anzeigeschrift (styles.css .vtab). */
function ventiusReihen(){
  const top = state.ventiusTop || {};
  return Object.keys(top).map(k => top[k]!).filter(r => r && r.waves > 0 && knownBoss(r.name));
}
/** Gibt es den Abschnitt Auge von Ventius? Die Analyse zeigt nur dann den Weg dorthin (69). */
export const ventiusAbschnittDa = () => ventiusReihen().length > 0;
/** Aus der Analyse (69): die Rekorde oeffnen, zum Abschnitt rollen, der Fokus auf seine Ueberschrift. */
export function zuVentius(){
  switchTab("rekorde");
  const h = document.getElementById("rkst-ventius");
  if(!h) return;
  h.tabIndex = -1;
  h.closest("section")?.scrollIntoView({block: "start"});
  h.focus({preventScroll: true});
}
function ventius(){
  const reihen = ventiusReihen().sort((a, b) => b.waves - a.waves || b.atTop - a.atTop);
  if(!reihen.length) return "";
  const hoechste = Math.max(...reihen.map(r => r.waves));
  const n = reihen.length, zahlWort = t("analysis.ventiusTop.value", {n});
  let h = '<section class="rkseite rkvent" id="rks-ventius" aria-labelledby="rkst-ventius"><div class="skopf"><h3 id="rkst-ventius">' +
    esc(t("rk.s.ventius")) + '</h3><span class="sunter">' + esc(t("analysis.ventiusTop.label")) + '</span><span class="szahl"><b>' + n + "</b>" +
    esc(zahlWort.slice(String(n).length)) + "</span></div>" +
    '<div class="vtab" role="table" aria-label="' + esc(t("analysis.ventiusTop.tableLabel")) + '">' +
    '<div class="vtabkopf" role="row"><span role="columnheader" aria-label="' + esc(t("analysis.ventiusTop.pic")) + '"></span><span role="columnheader">' +
    esc(t("analysis.ventiusTop.boss")) + '</span><span role="columnheader">' + esc(t("analysis.ventiusTop.best")) + '</span><span class="z" role="columnheader">' +
    esc(t("analysis.ventiusTop.hits")) + '</span><span role="columnheader">' + esc(t("analysis.ventiusTop.reached")) + "</span></div>";
  for(const r of reihen){
    const bild = bossIcon(r.name);
    h += '<div class="vtabzeile" role="row"><span role="cell">' + (bild ? '<img src="' + bild + '" alt="" aria-hidden="true">' : "") + "</span>" +
      '<span class="bn" role="cell">' + esc(r.name) + "</span>" +
      '<span class="vpips" role="cell">' + Array.from({length: hoechste}, (_, i) => '<i class="' + (i < r.waves ? "on" : "") + '"></i>').join("") + "<b>" + r.waves + "</b></span>" +
      '<span class="tr" role="cell">' + (r.waves * 3 + 1) + "</span>" +
      '<span class="oft" role="cell"><span class="ospur"><i style="width:' + (r.casts ? 100 * r.atTop / r.casts : 0).toFixed(1) + '%"></i></span>' +
      '<span class="owort">' + esc(t("analysis.ventiusTop.ofCasts", {n: r.atTop, total: r.casts})) + "</span></span></div>";
  }
  return h + '</div><p class="ventnote">' + esc(t("analysis.ventiusTop.note")) + "</p></section>";
}

const BLOECKE = ["held", "raid", "puppe", "feld", "dungeon", "ventius"] as const;
/* Je Block nur, was sich geaendert hat (siehe oben). Stand der Fokus in einem Block, der neu gezeichnet wird, steht er
   danach auf dem Element mit derselben Marke (data-f), gibt es das nicht mehr, auf der Ueberschrift des Bereichs. */
function bloecke(box: HTMLElement, inhalt: Record<string, string>, still: boolean){
  for(const k of Object.keys(inhalt)){
    const b = box.querySelector<HTMLElement>('[data-rk="' + k + '"]')!;
    if(b.dataset.marke === inhalt[k]) continue;
    const fokus = document.activeElement instanceof HTMLElement && b.contains(document.activeElement) ? document.activeElement.dataset.f ?? "" : null;
    if(still && b.dataset.marke !== undefined) b.classList.add("still");
    b.innerHTML = inhalt[k]!; b.dataset.marke = inhalt[k];
    // ohne Marke (die Medaillons des bisherigen Aufbaus) bleibt es, wie es war
    if(fokus) (b.querySelector<HTMLElement>('[data-f="' + CSS.escape(fokus) + '"]') ?? document.getElementById("rkTitel"))?.focus({preventScroll: true});
  }
}
export function renderRekorde(still = true){
  const box = document.getElementById("rkInhalt");
  if(!box) return;
  if(!tafel) tafel = albumTafel(DUNGEON_TAFEL, OFFENE_BOSSE);
  const kaempfe = rekordKaempfe();
  wege = {kaempfe: new Map(kaempfe.map(k => [k.at, k])), verlauf: verlaufZiele()};
  const l = twLage(kaempfe, tafel);
  const a = l ? l.album.gesamt : rekorde(kaempfe, tafel, aelter !== false);
  const quelle = a.kaempfe && a.von != null && a.bis != null
    ? t("rk.quelle", {n: a.dateien, k: a.kaempfe, von: tagKurz(a.von), bis: tagKurz(a.bis)}) : t("rk.quelleLeer");
  const q = $("#rkQuelle");
  if(q.textContent !== quelle) q.textContent = quelle;
  if(l){ twZeichnen(box, l, still); zeichneStand(); return; }
  if(!box.querySelector("[data-rk]") || box.dataset.aufbau){
    delete box.dataset.aufbau; delete box.dataset.hl;
    box.innerHTML = '<div class="rkblock" data-rk="held"></div><div class="rkreihe"><div class="rkblock" data-rk="raid"></div>' +
      '<div class="rkblock" data-rk="puppe"></div></div><div class="rkblock" data-rk="feld"></div><div class="rkblock" data-rk="dungeon"></div>' +
      '<div class="rkblock" data-rk="ventius"></div>';
  }
  const z = {i: 0};
  const inhalt: Record<(typeof BLOECKE)[number], string> = {held: held(a), raid: seite(a.seiten[0]!, z), puppe: seite(a.seiten[1]!, z),
    feld: seite(a.seiten[2]!, z), dungeon: seite(a.seiten[3]!, z), ventius: ventius()};
  bloecke(box, inhalt, still);
  zeichneStand();
}

/* ---------- Twinks: Rekorde je Charakter (Spezifikation 2026-10-15-twinks-design.md, 4, 6 und 8; Aufbau B) ----------
   Sobald ein aktiver Charakter einen Lognamen hat, zeigen die Rekorde oben
   eine fixierte Leiste: Ringe als Filter (Gesamt, Main, Twinks, je mit der
   Zahl der Rekorde, die er haelt, ein Gleiter unter dem gewaehlten Ring,
   Pfeiltasten wechseln), rechts die Reihenfolge (Bester DPS, Zuletzt,
   Groesster Zuwachs), darunter die Sprungleiste der fuenf Teile; der Teil,
   der oben steht, ist markiert. Darunter der Held (folgt dem Filter), die
   fuenf Teile (Raids in der Reihenfolge des Spiels, Feldbosse, Erzbosse mit
   Vegamor, Dungeons nach Sternen, Halle der Illusionen), dann wie bisher
   Uebungspuppe und Auge von Ventius. Je Boss zuerst der beste Kampf (Glut),
   darunter der erste, eine Spur vom ersten zum besten; das Medaillon ist ein
   Knopf (aria-expanded) und klappt den Vergleich der Charaktere auf, mit dem
   staerksten Treffer leise und dem Weg ins Log (Bester Pull 5.3).
   Ueber der Leiste ruhig der Hinweis "Neuer Charakter?" fuer den einen
   Angreifer des geoeffneten Logs, der zu keinem Charakter passt und nicht
   ignoriert ist. Die Wahl des Rings gilt in der Sitzung (zuerst der Main,
   sonst Gesamt) und wird nie gespeichert. Namen kommen allein aus den
   Weeklies (59); gerechnet wird mit Kennungen (rekorde-core.ts). */
type TwLage = { album: TwAlbum; namen: Map<string, CharaktereZeile>; ringe: string[]; main: string | null;
  jeOrt: Record<string, Map<string, RkWert>>; teile: (wahl: string) => TwTeil[] };
let twWahl: string | null = null;
let twSort: TwSort = "best";
const twOffen = new Set<string>();
/** nach einem Wechsel des Rings laufen die Zahlen einmal ein */
let twLauf = false;
let twJetzt: TwLage | null = null;

function twLage(kaempfe: RkEintrag[], tf: NonNullable<typeof tafel>): TwLage | null {
  const c = rekordCharaktere();
  if(!c || !c.aktiv.some(x => x.log)) return null;
  const album = twinkRekorde(kaempfe, tf, aelter !== false, c.aktiv.map(x => x.id), c.geloest);
  const namen = new Map(c.aktiv.map(x => [x.id, x]));
  const main = c.aktiv.find(x => x.main)?.id ?? null;
  // ein Ring je Charakter mit Logname oder mit Kaempfen, der Main zuerst, "unbekannt" zuletzt
  const da = (x: CharaktereZeile) => !!x.log || album.je[x.id]!.kaempfe > 0;
  const ringe = [...c.aktiv.filter(x => x.main && da(x)), ...c.aktiv.filter(x => !x.main && da(x))].map(x => x.id)
    .concat(album.halter.includes(UNBEKANNT) ? [UNBEKANNT] : []);
  const jeOrt: Record<string, Map<string, RkWert>> = {};
  for(const [h, a] of [["gesamt", album.gesamt] as const, ...Object.entries(album.je)])
    jeOrt[h] = new Map(a.seiten.flatMap(x => x.gruppen.flatMap(g => g.plaetze)).flatMap(p => p.wert ? [[p.ort.id, p.wert] as const] : []));
  const albumVon = (wahl: string) => wahl === "gesamt" ? album.gesamt : album.je[wahl] ?? album.gesamt;
  return {album, namen, ringe, main, jeOrt, teile: wahl => twinkTeile(albumVon(wahl).seiten, tf)};
}
const twWahlJetzt = (l: TwLage) => twWahl && (twWahl === "gesamt" || l.ringe.includes(twWahl)) ? twWahl
  : l.main && l.ringe.includes(l.main) ? l.main : "gesamt";
const twAlbumVon = (l: TwLage, wahl: string) => wahl === "gesamt" ? l.album.gesamt : l.album.je[wahl] ?? l.album.gesamt;
const twName = (l: TwLage, h: string) => h === UNBEKANNT ? t("tw.unbekannt") : l.namen.get(h)?.name ?? t("tw.unbekannt");
function twRing(l: TwLage, h: string, klein = false){
  const zeichen = h === "gesamt" ? "\u03a3" : h === UNBEKANNT ? "?" : ([...twName(l, h)][0] ?? "?").toUpperCase();
  return '<span class="twring' + (klein ? " k" : "") + (h === "gesamt" ? " all" : "") + (h === l.main ? " main" : "") + (h === UNBEKANNT ? " unb" : "") +
    '" aria-hidden="true"><b>' + esc(zeichen) + "</b></span>";
}

/* Der Angreifer des geoeffneten Logs, wenn es genau einen gibt, er zu keinem Charakter passt (auch keinem geloesten)
   und nicht ignoriert ist (Spezifikation Twinks 6). Der Name lebt nur in der Sitzung. */
function twFremder(): string | null {
  if(state.players.length !== 1) return null;
  const n = state.players[0]!;
  if(!n || n === "__all" || n !== n.trim() || [...n].length > 24 || charakterFuer(n, state.charaktere)) return null;
  const ign = weekliesIgnoriert();
  return ign && !ign.includes(n) ? n : null;
}
function twHinweis(){
  const n = twFremder();
  if(!n) return "";
  return '<p class="twneu"><span>' + esc(t("tw.neu", {name: n})) + '</span> <button type="button" class="btn sm" data-f="n:dazu" data-tw-dazu="">' +
    esc(t("tw.neuDazu")) + '</button> <button type="button" class="btn sm leise" data-f="n:ign" data-tw-ign="">' + esc(t("tw.neuIgn")) + "</button></p>";
}

function twLeiste(l: TwLage, wahl: string, teile: TwTeil[]){
  const bekaempft = l.album.gesamt.seiten.reduce((n, x) => n + x.besiegt, 0);
  const knopf = (h: string) => {
    const n = h === "gesamt" ? bekaempft : l.album.zaehler[h] ?? 0;
    const name = h === "gesamt" ? t("tw.gesamt") : twName(l, h);
    const vh = h === "gesamt" ? t("tw.zGesamt", {n}) : t("tw.zRek", {n});
    return '<button type="button" class="twfk" data-f="r:' + esc(h) + '" data-sel="' + esc(h) + '" aria-pressed="' + (wahl === h) + '"' +
      (h === "gesamt" ? "" : ' title="' + esc(t("tw.zHalter", {name, n})) + '"') + ">" + twRing(l, h) + '<span class="fn">' + esc(name) + "</span>" +
      (h === l.main ? '<span class="twmain">' + esc(t("ch.main")) + "</span>" : "") +
      '<span class="fz" aria-hidden="true">' + n + '</span><span class="vh">, ' + esc(vh) + "</span></button>";
  };
  const sort = (["best", "neu", "plus"] as const).map(x => '<button type="button" data-f="s:' + x + '" data-sort="' + x + '" aria-pressed="' + (twSort === x) + '">' +
    esc(t("tw.sort." + x)) + "</button>").join("");
  return '<div class="twfix"><div class="twleiste"><div class="twfilter" role="group" aria-label="' + esc(t("tw.filter")) + '">' +
    ["gesamt", ...l.ringe].map(knopf).join("") + '<span class="twgleiter" aria-hidden="true"></span></div>' +
    '<div class="twsort" role="group" aria-label="' + esc(t("tw.sort")) + '">' + sort + "</div></div>" +
    '<nav class="twsprung" aria-label="' + esc(t("tw.sprung")) + '">' +
    teile.map(x => '<a href="#tw-' + x.id + '" data-f="j:' + x.id + '" data-sprung="' + x.id + '">' + esc(t("tw.s." + x.id)) + "</a>").join("") + "</nav></div>";
}

function twHeld(l: TwLage, wahl: string){
  const a = twAlbumVon(l, wahl);
  if(wahl !== "gesamt" && !a.kaempfe) return '<section class="rkleer twleer"><p>' + esc(t("tw.leer", {name: twName(l, wahl)})) + "</p></section>";
  const ch = a.held?.ch ?? null;
  const von = wahl === "gesamt" && ch ? '<div class="hteil">' + twRing(l, ch) + "<span><small>" + esc(t("tw.von")) + "</small><b>" + esc(twName(l, ch)) + "</b></span></div>" : "";
  return held(a, wahl === "gesamt" ? "" : t("tw.heldVon", {name: twName(l, wahl)}), von);
}

function twMedaillon(l: TwLage, p: RkPlatz, wahl: string, i: number, nr: number){
  const o = p.ort, w = p.wert;
  if(!w) return medaillon(p, i);
  const gesamt = wahl === "gesamt", auf = twOffen.has(o.id), id = "twv" + nr;
  const wer = (h: string | null, d: number) => '<span class="twwer">' + (gesamt && h ? twRing(l, h, true) + esc(twName(l, h)) + " \u00b7 " : "") +
    esc(t("tw.am", {d: tagKurz(d)})) + "</span>";
  const z = zuwachs(w);
  const best = w.bester
    ? '<span class="twbest"><small>' + esc(t("tw.best")) + '</small><span class="mdps" data-n="' + w.dps + '">' + esc(zahl(w.dps)) + "</span>" + wer(w.dpsCh, w.dpsAt) + "</span>"
    : '<span class="twbest"><span class="mdps offen">' + esc(t("rk.keinBester")) + "</span></span>";
  const erst = '<span class="twerst"' + (w.ab ? ' title="' + esc(t("rk.abTitle")) + '"' : "") + "><small>" + esc(t("tw.erst")) + "</small><b>" + esc(zahl(w.ersterDps)) + "</b>" +
    wer(w.ersterCh, w.erster) + (w.ab ? '<span class="vh">' + esc(t("rk.abVh")) + "</span>" : "") + "</span>";
  const spur = z == null ? "" : '<span class="twweg" role="img" aria-label="' + esc(t("tw.zuwachsVh", {p: z})) + '"><i style="--von:' +
    Math.max(0, Math.min(100, 100 * w.ersterDps / w.dps)).toFixed(1) + '%"></i><em aria-hidden="true">' + esc(t("tw.zuwachs", {p: z})) + "</em></span>";
  /* der Vergleich: je Ring sein bester Pull an diesem Platz, mit nur einem Kampf dessen DPS (er hat keinen besten Pull,
     kann aber in Gesamt den besten Kampf halten); der Halter in Gesamt traegt die Glut */
  const halter = l.jeOrt.gesamt!.get(o.id)?.dpsCh ?? null;
  const reihen = l.ringe.map(h => { const v = l.jeOrt[h]?.get(o.id); return {h, dps: !v ? null : v.bester ? v.dps : v.n === 1 ? v.ersterDps : null}; });
  const max = Math.max(1, ...reihen.map(x => x.dps ?? 0));
  const vgl = reihen.map(x => "<li" + (x.dps == null ? ' class="v0"' : x.h === halter ? ' class="v1"' : "") + ">" + twRing(l, x.h, true) + "<span>" + esc(twName(l, x.h)) +
    '</span><i aria-hidden="true"><s style="--w:' + (x.dps == null ? 0 : x.dps / max).toFixed(3) + '"></s></i><em>' + esc(x.dps == null ? t("tw.keiner") : zahl(x.dps)) + "</em></li>").join("");
  const sb = w.top != null ? faehigkeitBild(w.topSid!) : null;
  const top = w.top != null
    ? '<p class="twtop">' + (sb ? '<img src="' + sb + '" alt="" aria-hidden="true">' : "") + "<b>" + esc(zahl(w.top)) + "</b> " + esc(t("tw.top")) + " \u00b7 " +
      esc(w.topTeil ? t("rk.teil", {skill: faehigkeit(w.topSid!), teil: w.topTeil}) : faehigkeit(w.topSid!)) + "</p>"
    : '<p class="twtop">' + esc(t("rk.offen")) + "</p>";
  const knopf = weg(o, w.bester ? w.dpsAt : w.zuletzt);
  const oeffnen = knopf ? '<p class="twweiter"><button type="button" class="btn sm rkknopf" data-f="o:' + esc(o.id) + '" data-at="' + knopf.at + '" data-datei="' + esc(knopf.datei) +
    '" data-ort="' + esc(knopf.ort) + '">' + esc(t(knopf.log ? "tw.oeffnen" : "tw.verlauf")) + "</button></p>" : "";
  return '<li class="rkmed twmed' + (auf ? " auf" : "") + '" data-halter="' + esc(w.dpsCh ?? "") + '" style="--i:' + i + '">' +
    '<button type="button" class="twkopf" data-f="m:' + esc(o.id) + '" data-tw-ort="' + esc(o.id) + '" aria-expanded="' + auf + '" aria-controls="' + id + '">' +
    '<span class="twrahmen">' + bild(o, "bild") + '</span><span class="mname">' + esc(ortName(o)) + "</span>" +
    (o.unter && o.id.startsWith("raid:") ? '<span class="munter">' + esc(unterName(o.unter)) + "</span>" : "") + best + erst + spur +
    '<span class="twmehr" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span></button>' +
    '<div class="twvgl" id="' + id + '"' + (auf ? "" : " inert") + '><div class="twvi"><h4 class="vh">' + esc(t("tw.vgl")) + "</h4><ul>" + vgl + "</ul>" + top + oeffnen + "</div></div></li>";
}

function twTeil(l: TwLage, x: TwTeil, wahl: string, z: { i: number; nr: number }){
  const listen = x.gruppen.map(g => (g.key ? '<h4 class="rkgruppe">' + esc(t("rk.g." + g.key)) + "</h4>" : "") +
    '<ul class="rkraster twraster" role="list">' + (x.id === "raid" ? g.plaetze : twinkSortiert(g.plaetze, twSort)).map(p => twMedaillon(l, p, wahl, z.i++, z.nr++)).join("") +
    "</ul>").join("");
  return '<section class="rkseite twteil" id="tw-' + x.id + '" aria-labelledby="twt-' + x.id + '"><div class="skopf"><h3 id="twt-' + x.id + '" tabindex="-1">' +
    esc(t("tw.s." + x.id)) + '</h3><span class="sunter">' + esc(t("tw.u." + x.id)) + '</span><span class="szahl">' +
    mitZahlen("rk.seiteZahl", {n: x.besiegt, m: x.gesamt}, {w: t("rk.bekaempft")}) + "</span></div>" + listen + "</section>";
}

const TW_TEILE = ["raid", "feld", "erz", "dungeon", "halle"] as const;
function twZeichnen(box: HTMLElement, l: TwLage, still: boolean){
  twJetzt = l;
  if(box.dataset.aufbau !== "tw"){
    box.dataset.aufbau = "tw";
    box.innerHTML = '<div class="rkblock" data-rk="neu"></div><p class="twsatz" id="twSatz" role="status"></p><div class="rkblock" data-rk="leiste"></div>' +
      '<div class="rkblock" data-rk="held"></div>' + TW_TEILE.map(k => '<div class="rkblock" data-rk="' + k + '"></div>').join("") +
      '<div class="rkblock" data-rk="puppe"></div><div class="rkblock" data-rk="ventius"></div>';
  }
  const wahl = twWahlJetzt(l), a = twAlbumVon(l, wahl), teile = l.teile(wahl);
  const z = {i: 0, nr: 0}, zp = {i: 0};
  const inhalt: Record<string, string> = {neu: twHinweis(), leiste: twLeiste(l, wahl, teile), held: twHeld(l, wahl)};
  for(const k of TW_TEILE){ const x = teile.find(y => y.id === k); inhalt[k] = x ? twTeil(l, x, wahl, z) : ""; }
  inhalt.puppe = seite(a.seiten[1]!, zp);
  inhalt.ventius = ventius();
  bloecke(box, inhalt, still);
  twGleiter();
  twSpaeh();
  if(twHl) twHervor(twHl);
  if(twLauf){ twLauf = false; twEinlaufen(box); }
}

/* Der Gleiter unter dem gewaehlten Ring; nach jedem Zeichnen und wenn sich die Groesse aendert. Dazu die Hoehe der
   Leiste (--twfix): so weit halten die Teile beim Springen Abstand (styles.css .twteil). */
function twGleiter(){
  const fix = document.querySelector<HTMLElement>("#rkInhalt .twfix");
  if(fix) document.getElementById("rkInhalt")!.style.setProperty("--twfix", fix.offsetHeight + "px");
  const f = document.querySelector<HTMLElement>("#rkInhalt .twfilter"), an = f?.querySelector<HTMLElement>('.twfk[aria-pressed="true"]'), g = f?.querySelector<HTMLElement>(".twgleiter");
  if(!an || !g) return;
  g.style.setProperty("--x", an.offsetLeft + "px"); g.style.setProperty("--y", an.offsetTop + "px");
  g.style.setProperty("--w", an.offsetWidth + "px"); g.style.setProperty("--h", an.offsetHeight + "px");
}
/* Die Sprungleiste: der Teil, der gerade unter der Leiste oben steht, traegt aria-current. */
function twSpaeh(){
  const box = document.getElementById("rkInhalt"), fix = box?.querySelector<HTMLElement>(".twfix");
  if(!box || !fix) return;
  const grenze = fix.getBoundingClientRect().bottom + 16;
  let akt: string | null = null;
  box.querySelectorAll<HTMLElement>(".twteil").forEach(x => { if(x.getBoundingClientRect().top <= grenze) akt = x.id.slice(3); });
  // ganz unten kann der letzte Teil nicht mehr unter die Leiste rollen: dann der letzte, der zu sehen ist
  const r = box.closest<HTMLElement>(".rkrollt");
  if(r && r.scrollTop > 0 && r.scrollTop + r.clientHeight >= r.scrollHeight - 2){
    const unten = r.getBoundingClientRect().bottom;
    box.querySelectorAll<HTMLElement>(".twteil").forEach(x => { if(x.getBoundingClientRect().top < unten - 40) akt = x.id.slice(3); });
  }
  if(!akt) akt = box.querySelector<HTMLElement>(".twteil")?.id.slice(3) ?? null;
  box.querySelectorAll<HTMLElement>(".twsprung a").forEach(x => {
    if(x.dataset.sprung === akt){ if(x.getAttribute("aria-current") !== "true") x.setAttribute("aria-current", "true"); }
    else x.removeAttribute("aria-current");
  });
}
const twReduziert = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/* Die besten Zahlen laufen nach einem Wechsel des Rings ein, nicht bei reduzierter Bewegung. Waehrend sie laufen,
   traegt der Kasten data-laeuft; am Ende steht in jedem Feld wieder genau die gezeichnete Zahl. */
let twLaeuft = 0;
function twEinlaufen(box: HTMLElement){
  if(twReduziert()) return;
  const felder = [...box.querySelectorAll<HTMLElement>(".twbest .mdps[data-n]")].map(el => ({el, ziel: Number(el.dataset.n), fertig: el.textContent}));
  if(!felder.length) return;
  const lauf = ++twLaeuft, t0 = performance.now();
  box.dataset.laeuft = "";
  const schritt = (jetzt: number) => {
    if(lauf !== twLaeuft) return;
    const q = Math.max(0, Math.min(1, (jetzt - t0) / 520));
    for(const f of felder) f.el.textContent = q < 1 ? zahl(f.ziel * (1 - Math.pow(1 - q, 4))) : f.fertig;
    if(q < 1) requestAnimationFrame(schritt); else delete box.dataset.laeuft;
  };
  requestAnimationFrame(schritt);
}
/* Hover oder Fokus auf einen Ring in Gesamt: seine Rekorde bleiben, die anderen treten zurueck; auch nach einem
   neuen Zeichnen, solange der Ring es bleibt (twHl). */
let twHl: string | null = null;
function twHervor(h: string | null){
  const box = document.getElementById("rkInhalt");
  twHl = h;
  if(!box) return;
  const an = h && twJetzt && twWahlJetzt(twJetzt) === "gesamt" && h !== "gesamt" ? h : null;
  if(an) box.dataset.hl = an; else delete box.dataset.hl;
  box.querySelectorAll<HTMLElement>(".twmed").forEach(m => m.classList.toggle("zurueck", !!an && m.dataset.halter !== an));
}
function twWaehlen(h: string){
  if(!twJetzt || twWahlJetzt(twJetzt) === h) return;
  twWahl = h; twLauf = true; twHervor(null);
  renderRekorde();
}
function twSatzSagen(text: string){
  const s = document.getElementById("twSatz");
  if(s) s.textContent = text;
}
/* "Als Twink hinzufuegen": ein Charakter mit dem Namen als Anzeige und Logname. Danach bekommen die Kaempfe des
   geoeffneten Logs ihren Charakter (histRecord), aeltere beim Nachlesen (der Zuordnungsstand hat sich geaendert). */
function twDazu(){
  const n = twFremder();
  if(!n) return;
  const r = charakterAnlegen(n, n);
  if(r === "ok"){
    twSatzSagen(t("tw.neuOk", {name: n}));
    if(state.encounters.length) histRecord();
    renderRekorde();
    if(SERVED && lage !== "liest"){ gefragt = true; void nachlesen(false); }
  }
  else if(r !== "nichts") twSatzSagen(t(r === "sechs" ? "ch.sechs" : r === "alleVoll" ? "ch.alleVoll" : r === "doppelt" ? "ch.doppelt" : r === "log" ? "ch.logBad" : "ch.nameBad"));
  document.getElementById("rkTitel")?.focus({preventScroll: true});
}
function twIgnorieren(){
  const n = twFremder();
  if(!n) return;
  const r = charakterIgnorieren(n);
  if(r === "ok") twSatzSagen(t("tw.ignOk", {name: n}));
  else if(r === "voll") twSatzSagen(t("tw.ignVoll"));
  renderRekorde();
  document.getElementById("rkTitel")?.focus({preventScroll: true});
}
function twKlick(e: Event){
  const el = e.target as Element;
  const r = el.closest<HTMLElement>(".twfk"), so = el.closest<HTMLElement>("[data-sort]"), m = el.closest<HTMLElement>(".twkopf"), j = el.closest<HTMLElement>("[data-sprung]");
  if(r){ twWaehlen(r.dataset.sel ?? "gesamt"); return; }
  if(so){ const x = so.dataset.sort as TwSort; if(x !== twSort){ twSort = x; renderRekorde(); } return; }
  if(m){
    const id = m.dataset.twOrt ?? "", li = m.closest<HTMLElement>(".twmed"), vgl = li?.querySelector<HTMLElement>(".twvgl");
    if(twOffen.has(id)) twOffen.delete(id); else twOffen.add(id);
    const auf = twOffen.has(id);
    li?.classList.toggle("auf", auf); m.setAttribute("aria-expanded", String(auf));
    if(vgl){ if(auf) vgl.removeAttribute("inert"); else vgl.setAttribute("inert", ""); }
    return;
  }
  if(j){
    e.preventDefault();
    const h = document.getElementById("twt-" + j.dataset.sprung);
    h?.closest("section")?.scrollIntoView({behavior: twReduziert() ? "auto" : "smooth", block: "start"});
    h?.focus({preventScroll: true});
    return;
  }
  if(el.closest("[data-tw-dazu]")) twDazu();
  else if(el.closest("[data-tw-ign]")) twIgnorieren();
}
/* Pfeiltasten in der Leiste der Ringe: links und rechts der Nachbar, Pos1 und Ende der erste und der letzte. */
function twTaste(e: KeyboardEvent){
  const f = (e.target as Element).closest?.<HTMLElement>(".twfk");
  if(!f || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
  const alle = [...document.querySelectorAll<HTMLElement>("#rkInhalt .twfk")], i = alle.indexOf(f);
  const n = e.key === "Home" ? alle[0] : e.key === "End" ? alle[alle.length - 1] : alle[(i + (e.key === "ArrowRight" ? 1 : alle.length - 1)) % alle.length];
  if(!n) return;
  e.preventDefault();
  twWaehlen(n.dataset.sel ?? "gesamt");
  document.querySelector<HTMLElement>('#rkInhalt .twfk[data-sel="' + CSS.escape(n.dataset.sel ?? "") + '"]')?.focus();
}

/* Die Zeile unter dem Kopf: Fortschritt mit Abbrechen, angehalten mit
   Weiterlesen, der Satz im Browser - sonst leer (die Live-Region bleibt). */
function zeichneStand(){
  const satz = document.getElementById("rkSatz"), spur = document.getElementById("rkSpur");
  const ab = document.getElementById("rkAbbrechen") as HTMLButtonElement | null, weiter = document.getElementById("rkWeiter") as HTMLButtonElement | null;
  const zeile = document.getElementById("rkLesen");
  if(!satz || !spur || !ab || !weiter || !zeile) return;
  let html = "";
  if(!SERVED) html = esc(t("rk.browser"));
  else if(lage === "liest") html = zuLesen ? mitZahlen("rk.lese", {i: Math.min(gelesen + 1, zuLesen), n: zuLesen}) : esc(t("rk.frage"));
  else if(lage === "angehalten") html = mitZahlen("rk.angehalten", {i: gelesen, n: zuLesen});
  else if(lage === "fehler") html = esc(t("rk.fehler"));
  if(satz.innerHTML !== html) satz.innerHTML = html;
  zeile.classList.toggle("an", !!html);
  const liest = lage === "liest" && zuLesen > 0;
  if(spur.hidden === liest) spur.hidden = !liest;
  if(liest) spur.querySelector<HTMLElement>("i")!.style.width = (100 * gelesen / zuLesen).toFixed(1) + "%";
  /* Der Fokus wandert mit: stand er auf dem Knopf, der jetzt geht, steht er
     danach auf dem, der kommt - sonst auf der Ueberschrift. */
  const hatte = document.activeElement === ab ? ab : document.activeElement === weiter ? weiter : null;
  if(ab.hidden === (lage === "liest")) ab.hidden = lage !== "liest";
  const nochmal = SERVED && (lage === "angehalten" || lage === "fehler");
  if(weiter.hidden === nochmal) weiter.hidden = !nochmal;
  if(hatte && hatte.hidden) (ab.hidden ? weiter.hidden ? document.getElementById("rkTitel") : weiter : ab)?.focus();
  // die Zeile in den Einstellungen sagt dasselbe
  const e = document.getElementById("eRekorde") as HTMLButtonElement | null;
  const es = document.getElementById("eRekordeStand");
  /* im Browser aus; waehrend des Lesens nur aria-disabled - gesperrt fiele der Fokus
     dessen, der eben geklickt hat, auf die Seite */
  if(e && e.disabled !== !SERVED) e.disabled = !SERVED;
  const belegt = SERVED && lage === "liest" ? "true" : "false";
  if(e && e.getAttribute("aria-disabled") !== belegt) e.setAttribute("aria-disabled", belegt);
  if(es){
    const s = !SERVED ? "" : lage === "liest" ? (zuLesen ? mitZahlen("rk.lese", {i: Math.min(gelesen + 1, zuLesen), n: zuLesen}) : esc(t("rk.frage"))) : "";
    if(es.innerHTML !== s) es.innerHTML = s;
  }
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  // die Raid-Bilder als Stilblatt, wie die Weeklies es anlegen (59); nichts wird geladen
  if(!document.querySelector("#wkBilder")){
    const st = document.createElement("style");
    st.id = "wkBilder";
    st.textContent = wkBilderCss();
    document.head.append(st);
  }
  document.getElementById("rkAbbrechen")?.addEventListener("click", () => { halt?.abort(); });
  document.getElementById("rkWeiter")?.addEventListener("click", () => {
    if(!SERVED || lage === "liest") return;
    gefragt = true;
    void nachlesen(false);
  });
  document.getElementById("eRekorde")?.addEventListener("click", rekordeNeuEinlesen);
  // die Medaillons stehen im neu geschriebenen Inhalt: am festen Kasten gefangen
  const box = document.getElementById("rkInhalt");
  box?.addEventListener("click", e => {
    const b = (e.target as Element).closest<HTMLElement>(".rkknopf");
    if(b) void medaillonOeffnen(b);
    else twKlick(e);
  });
  // Twinks (Aufbau B): Pfeiltasten in der Leiste, Hervorheben eines Rings, Sprungleiste und Gleiter
  box?.addEventListener("keydown", twTaste);
  const ring = (e: Event) => (e.target as Element).closest?.<HTMLElement>(".twfk")?.dataset.sel ?? null;
  box?.addEventListener("pointerover", e => { const h = ring(e); if(h) twHervor(h); });
  box?.addEventListener("pointerout", e => { if(ring(e)) twHervor(null); });
  box?.addEventListener("focusin", e => twHervor(ring(e)));
  box?.addEventListener("focusout", () => twHervor(null));
  document.querySelector(".rkrollt")?.addEventListener("scroll", twSpaeh, {passive: true});
  window.addEventListener("resize", twGleiter);
  // die Charaktere oder die ignorierten Namen wurden gelesen oder geaendert (59)
  rekordHaken.geaendert = () => { if(offen) renderRekorde(); };
  const eb = document.getElementById("eRekordeBrowser");
  if(eb) eb.hidden = SERVED;
  zeichneStand();
}
