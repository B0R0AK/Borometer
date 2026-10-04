import { state } from "./01-state";
import { fmt } from "./03-helpers";
import { DUNGEON_TAFEL, OFFENE_BOSSE } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { bossIcon, skillIcon } from "./12-boss-images";
import { skillEntry } from "./10-skill-names";
import { $, esc } from "./18-interface-basics";
import { histNachlesen, renderAll, topName } from "./32-history";
import { konfigGelesen, SERVED } from "./41-server-mode";
import { wkBilderCss, wkHatBild } from "./60-weeklies-bilder";
import { abendText } from "../build-core";
import type { HistFight } from "../types";
import { albumTafel, lesebedarf, NACH_MAX, rekorde, type RkAlbum, type RkOrt, type RkPlatz, type RkSeiteWert } from "../rekorde-core";

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
   (rekordKaempfe): geoeffnete und nur nachgelesene Dateien.
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
  const todo = lesebedarf(liste, state.hist.files, alle);
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
  const sb = w.top != null ? faehigkeitBild(w.topSid!) : null;
  const top = w.top != null
    ? '<span class="mtop"><span class="vh">' + esc(t("rk.topVh")) + "</span>" + (sb ? '<img src="' + sb + '" alt="" aria-hidden="true">' : "") +
      "<b>" + esc(zahl(w.top)) + '</b></span><span class="mskill">' +
      esc(w.topTeil ? t("rk.teil", {skill: faehigkeit(w.topSid!), teil: w.topTeil}) : faehigkeit(w.topSid!)) + "</span>"
    : '<span class="mtop offen">' + esc(t("rk.offen")) + "</span>";
  // "ab": der Satz dazu steht im title und fuer Vorleser im Medaillon (.vh)
  const erst = w.ab ? '<span class="merst" title="' + esc(t("rk.abTitle")) + '">' + esc(t("rk.ersterAb", {d: tagKurz(w.erster)})) +
      '<span class="vh">' + esc(t("rk.abVh")) + "</span></span>"
    : '<span class="merst">' + esc(t("rk.erster", {d: tagKurz(w.erster)})) + "</span>";
  return '<li class="rkmed"' + stil + ">" + bild(o, "bild") + '<span class="mname">' + esc(name) + "</span>" + unter +
    '<span class="mdps"><span class="vh">' + esc(t("rk.dpsVh")) + "</span>" + esc(zahl(w.dps)) + "</span>" +
    '<span class="mplus">' + esc(plus) + '<span class="vh"> \u00b7 ' + esc(t("rk.dpsAm", {d: tagKurz(w.dpsAt)})) + "</span></span>" +
    '<span class="mtrenn" aria-hidden="true"></span>' + top + erst + "</li>";
}

function seite(s: RkSeiteWert, zaehler: { i: number }){
  const unter = s.id === "raid" ? unterName(s.unter) : t("rk.u." + s.id);
  const listen = s.gruppen.map(g => (g.key ? '<h4 class="rkgruppe">' + esc(t("rk.g." + g.key)) + "</h4>" : "") +
    '<ul class="rkraster" role="list" style="--n:' + g.plaetze.length + '">' + g.plaetze.map(p => medaillon(p, zaehler.i++)).join("") + "</ul>").join("");
  return '<section class="rkseite" id="rks-' + s.id + '" aria-labelledby="rkst-' + s.id + '"><div class="skopf"><h3 id="rkst-' + s.id + '">' +
    esc(t("rk.s." + s.id)) + '</h3><span class="sunter">' + esc(unter) + '</span><span class="szahl">' +
    mitZahlen("rk.seiteZahl", {n: s.besiegt, m: s.gesamt}, {w: t("rk.bekaempft")}) + "</span></div>" + listen + "</section>";
}

function held(a: RkAlbum){
  const h = a.held;
  if(!h){
    if(a.kaempfe) return "";
    return '<section class="rkleer" aria-labelledby="rkLeerT"><h3 id="rkLeerT">' + esc(t("rk.leerT")) + "</h3><p>" + esc(t("rk.leerSatz")) + "</p></section>";
  }
  const name = ortName(h.ort);
  const was = h.topTeil ? t("rk.teil", {skill: faehigkeit(h.topSid), teil: h.topTeil}) : faehigkeit(h.topSid);
  const sb = faehigkeitBild(h.topSid);
  return '<section class="rkheld" aria-labelledby="rkHeldT">' + bild(h.ort, "wasser") +
    '<div class="h1"><h3 class="hlabel" id="rkHeldT">' + esc(t(lage === "liest" && zuLesen > 0 ? "rk.heldBisher" : "rk.held")) + '</h3><span class="hzahl">' + esc(fmt(h.top)) + "</span></div>" +
    '<div class="hteil">' + (sb ? '<img src="' + sb + '" alt="" aria-hidden="true">' : "") + "<span><small>" + esc(t("rk.faehigkeit")) + "</small><b>" + esc(was) + "</b></span></div>" +
    '<div class="hteil">' + bild(h.ort, "port") + "<span><small>" + esc(t("rk.an")) + "</small><b>" + esc(name) + "</b></span></div>" +
    '<div class="hteil"><span><small>' + esc(t("rk.am")) + "</small><b>" + esc(tagLang(h.at)) + "</b></span></div></section>";
}

/* Gezeichnet wird je Block (Held und vier Seiten), und nur, was sich
   geaendert hat: beim Nachlesen kommt Datei um Datei etwas dazu, und der
   Rest soll stehen bleiben, ohne neu einzublenden. still: ein Block, der
   nach dem Oeffnen neu gezeichnet wurde, blendet nicht noch einmal ein. */
/* Alle Kaempfe des Verzeichnisses mit ihrer Datei, auch die nur
   nachgelesenen (nach), die Verlauf und Builds nicht zaehlen (histCollect). */
function rekordKaempfe(){
  const raus: (HistFight & {file: string})[] = [];
  for(const [file, e] of Object.entries(state.hist.files)) for(const f of e.fights || []) raus.push({...f, file});
  return raus;
}
const BLOECKE = ["held", "raid", "puppe", "feld", "dungeon"] as const;
export function renderRekorde(still = true){
  const box = document.getElementById("rkInhalt");
  if(!box) return;
  if(!tafel) tafel = albumTafel(DUNGEON_TAFEL, OFFENE_BOSSE);
  const a = rekorde(rekordKaempfe(), tafel, aelter !== false);
  const quelle = a.kaempfe && a.von != null && a.bis != null
    ? t("rk.quelle", {n: a.dateien, k: a.kaempfe, von: tagKurz(a.von), bis: tagKurz(a.bis)}) : t("rk.quelleLeer");
  const q = $("#rkQuelle");
  if(q.textContent !== quelle) q.textContent = quelle;
  if(!box.querySelector("[data-rk]"))
    box.innerHTML = '<div class="rkblock" data-rk="held"></div><div class="rkreihe"><div class="rkblock" data-rk="raid"></div>' +
      '<div class="rkblock" data-rk="puppe"></div></div><div class="rkblock" data-rk="feld"></div><div class="rkblock" data-rk="dungeon"></div>';
  const z = {i: 0};
  const inhalt: Record<(typeof BLOECKE)[number], string> = {held: held(a), raid: seite(a.seiten[0]!, z), puppe: seite(a.seiten[1]!, z),
    feld: seite(a.seiten[2]!, z), dungeon: seite(a.seiten[3]!, z)};
  for(const k of BLOECKE){
    const b = box.querySelector<HTMLElement>('[data-rk="' + k + '"]')!;
    if(b.dataset.marke === inhalt[k]) continue;
    if(still && b.dataset.marke !== undefined) b.classList.add("still");
    b.innerHTML = inhalt[k]; b.dataset.marke = inhalt[k];
  }
  zeichneStand();
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
  const eb = document.getElementById("eRekordeBrowser");
  if(eb) eb.hidden = SERVED;
  zeichneStand();
}
