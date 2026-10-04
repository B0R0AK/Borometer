import { BORO_VERSION, state } from "./01-state";
import { t } from "./08-translation";
import { weaponMark } from "./09-weapon-icons";
import { className, classNameFor, iPlayVentius, roleWithVentius } from "./17-class-names";
import { $, esc } from "./18-interface-basics";
import { setUiZoom } from "./37-window-size-and-overlay";
import { fehlerbericht } from "./44-bug-report";
import { serverDir } from "./41-server-mode";

/* ---------- Die Statusleiste (Instrumententafel 3.4) ----------
   Eine Zeile am unteren Rand, 24 Punkt, leise (--fs-xs, --dim): ob Live
   laeuft (das schreibt syncLiveBtn in 45), welche Datei gelesen wird, wie
   viele Kaempfe, dass nichts ins Spiel geht, "Fehler melden" (seit 01.10.,
   vorher in den Einstellungen), die Groesse (syncZoomRow in 37) und die
   Version. Hier stehen Datei und Anzahl; geschrieben wird nur, wenn
   sich etwas aendert - renderAll() laeuft im Live alle paar Sekunden. */

/* Die Datei: nur der Name, der ganze Pfad im title. Den Pfad kennt die
   Seite nur, wenn die App den Ordner beobachtet (serverDir); eine im Browser
   geoeffnete Datei hat keinen, dann steht dort der Name. */
function datei(): { name: string; pfad: string } {
  if(state.origin === "sample") return {name: t("sb.sample"), pfad: ""};
  const namen = state.fileNames || [];
  if(!namen.length || !state.parsed) return {name: t("sb.noFile"), pfad: ""};
  const name = namen.join(" + ");
  if(state.origin !== "watch" || !serverDir || namen.length !== 1) return {name, pfad: name};
  const trenner = serverDir.includes("\\") ? "\\" : "/";
  return {name, pfad: serverDir.replace(/[\\/]+$/, "") + trenner + namen[0]};
}
/* "13 Kaempfe heute", wenn heute gekaempft wurde, sonst wie die Liste
   ("7 Kaempfe geladen"). "Heute" ist der Kalendertag der Ortszeit, von
   Mitternacht bis Mitternacht: die Zeiten im Log sind die Wanduhr des
   Spielers, als UTC-Felder abgelegt (parseTime in 03-helpers.ts, gelesen
   wie wallTime in 18) - verglichen wird darum ihr UTC-Datum mit dem
   heutigen Datum der Ortszeit. Ohne Uhrzeit im Log gibt es kein "heute". */
export function anzahlText(){
  const n = state.encounters.length;
  if(!n) return "";
  if(state.wall){
    const jetzt = new Date();
    const heute = state.encounters.filter(seg => {
      const d = new Date(seg.start);
      return d.getUTCFullYear() === jetzt.getFullYear() && d.getUTCMonth() === jetzt.getMonth()
        && d.getUTCDate() === jetzt.getDate();
    }).length;
    if(heute > 0) return t("sb.today", {n: heute});
  }
  return t("rail.loaded", {n});
}
/* Waffenpaar, Klasse und Rolle wie im Entwurf ("Spaeher \u00b7 DPS", 0.23):
   dieselbe Rechnung wie der Bau-Chip im Kopf (20-meter-head.ts), aus den
   zwei erklaerten Waffen. Ohne beide Waffen steht nichts da. */
function rolle(){
  const a = state.mainWeapon, b = state.offWeapon;
  if(!a || !b) return "";
  const bau = classNameFor([a, b]);
  if(!bau) return "";
  const r = roleWithVentius(bau, iPlayVentius());
  return weaponMark(a) + weaponMark(b) + "<span>" + esc(className(bau) + " \u00b7 " + t("weapons.role." + r)) + "</span>";
}
/* ---------- Der Update-Hinweis (Spezifikation Update-Hinweis 2.3) ----------
   Der Hauptprozess fragt, wenn eingeschaltet, einmal beim Start bei GitHub
   (src/main/update.ts); GET /api/state bringt dann update: null oder
   {version, url}. Die Seite fragt selbst nie nach aussen. Sie nimmt den Wert
   nur, wenn die Version aus Zahlen besteht und die Adresse genau mit der
   Release-Seite beginnt, gefolgt von einem Tag - sonst kein Link. Gezeigt
   wird er leise links neben der Version und in Einstellungen, Info, als
   <a target=_blank>: das eigene Fenster gibt ihn an den Browser weiter
   (setWindowOpenHandler in window.ts), in der App oeffnet sich nichts.
   Nichts wird gespeichert. safety-audit.mjs, Abschnitt 14. */
const RELEASE_PREFIX = "https://github.com/B0R0AK/Borometer/releases/tag/";
const RELEASE_TAG = /^v?\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$/;
const RELEASE_VERSION = /^\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$/;
let update: {version: string; url: string} | null = null;

/** Was /api/state als update brachte, geprueft; sonst null. */
export function updateGeprueft(u: unknown): {version: string; url: string} | null {
  if(!u || typeof u !== "object") return null;
  const {version, url} = u as {version?: unknown; url?: unknown};
  if(typeof version !== "string" || !RELEASE_VERSION.test(version)) return null;
  if(typeof url !== "string" || !url.startsWith(RELEASE_PREFIX) || !RELEASE_TAG.test(url.slice(RELEASE_PREFIX.length))) return null;
  return {version, url};
}

/** Der Stand aus /api/state (41): merken und zeigen. */
export function setzeUpdate(u: unknown): void {
  update = updateGeprueft(u);
  updateZeigen();
}

/* Die Antwort von GitHub kommt im Hauptprozess nach bis zu 5 s, oft erst
   nach dem ersten /api/state der Seite (Sicherheitspruefung M4). Ist der
   Schalter an (41 ruft das mit dem Stand aus /api/config) und noch kein
   Hinweis da, fragt die Seite den Stand darum noch einige Male nach: alle
   2 s, hoechstens 8 Mal, und hoert auf, sobald einer da ist. Nur /api/state
   beim eigenen Helfer, nichts nach aussen. */
let nachgefragt = false;
export function updateNachfragen(): void {
  if(nachgefragt) return;
  nachgefragt = true;
  let rest = 8;
  const frage = () => {
    if(update || rest-- <= 0) return;
    fetch("/api/state", {signal: AbortSignal.timeout(10000)}).then(r => r.json())
      .then(s => { if(s && s.update) setzeUpdate(s.update); })
      .catch(() => {})
      .finally(() => { setTimeout(frage, 2000); });
  };
  setTimeout(frage, 2000);
}

/* Statusleiste (#sbUpdate) und Info (#eUpdate): beide Links mit derselben
   geprueften Adresse, ohne Hinweis versteckt und ohne href. Schreibt nur,
   was sich aendert (auch nach einem Sprachwechsel). */
function updateZeigen(){
  for(const [id, schluessel] of [["sbUpdate", "sb.updateDa"], ["eUpdate", "einst.updateDa"]] as const){
    const a = document.getElementById(id) as HTMLAnchorElement | null;
    if(!a) continue;
    const zeile = id === "eUpdate" ? a.closest<HTMLElement>("p") || a : a;
    if(!update){
      if(!zeile.hidden) zeile.hidden = true;
      if(a.hasAttribute("href")) a.removeAttribute("href");
      continue;
    }
    const text = t(schluessel, {v: update.version});
    if(a.textContent !== text) a.textContent = text;
    if(a.getAttribute("href") !== update.url) a.setAttribute("href", update.url);
    const titel = t("einst.updateTitel");
    if(a.title !== titel) a.title = titel;
    if(zeile.hidden) zeile.hidden = false;
  }
}

let zuletzt = "";
export function syncStatusleiste(){
  updateZeigen();
  const d = datei(), r = rolle();
  const sig = state.lang + "|" + d.name + "|" + d.pfad + "|" + r;
  if(sig === zuletzt) return;
  zuletzt = sig;
  const f = $("#sbDatei");
  f.textContent = d.name;
  f.title = d.pfad;
  const feld = $("#sbRolle");
  feld.innerHTML = r;
  feld.hidden = !r;
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  $("#sbZoom").onclick = () => setUiZoom(100);
  $("#sbFehler").onclick = () => void fehlerbericht();
  if(typeof BORO_VERSION !== "undefined") $("#sbVer").textContent = "v" + BORO_VERSION;
  syncStatusleiste();
}
