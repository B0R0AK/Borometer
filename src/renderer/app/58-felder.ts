import { state } from "./01-state";
import { fmt } from "./03-helpers";
import { stats } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { bossIcon } from "./12-boss-images";
import { $, esc, wallTime } from "./18-interface-basics";
import { kampfSpeichern } from "./34-menus-drop-and-tabs";
import { gruppeKontext } from "./42-party";
import { isWatching } from "./45-startup";
import { bildOeffnen } from "./50-bild";

/* ---------- Felder (Instrumententafel Stufe 4) ----------
   Jeder Bereich ausser Kampf zeigt in der vollen Ansicht keinen Streifen und
   keine Schadenstafel mehr, sondern oben eine schmale Kopfzeile
   (#bereichKopf): Name des Bereichs, der gewaehlte Kampf (Bossbild, Boss,
   Uhrzeit, DPS), rechts "Kampf speichern" und "Als Bild" (nur, wo es um
   den Kampf geht: KAMPF_HANDLUNG). Die Bloecke des
   Panels werden Felder mit 1-Punkt-Fugen (styles.css, body.felder) - ohne
   neue Huellen, ids und Reihenfolge bleiben.
   Nicht im Kompakt, nicht auf Start und nicht in den Einstellungen, nicht in
   der Gruppenansicht (state.group "party": dort ist der Kopf die Tafel der
   Gruppe, auch ohne eigenen Kampf im Bereich Gruppe). Ohne Kampf gilt es,
   solange die Flaeche steht (Gruppe, Log-Einrichtung, Verlauf nach dem
   Leeren) - dann nennt die Kopfzeile nur den Bereich. */
export function felderGilt(): boolean {
  return !document.body.classList.contains("compact") && !state.start && !state.einst && state.tab !== "timeline" &&
    state.group !== "party" && !$("#app").hidden;
}

/* "Kampf speichern" und "Als Bild" betreffen den gewaehlten Kampf. Sie
   stehen nur in den Bereichen, die diesen Kampf lesen (Kritik 28.09., P2);
   im Verlauf, in der Gruppe und in der Log-Einrichtung geht es um alle
   Kaempfe, die Gruppe oder die Datei - dort nennt die Kopfzeile den Kampf
   nur. */
const KAMPF_HANDLUNG = new Set(["rotation", "analysis", "compare", "weapons"]);

/* Setzt body.felder und fuellt die Kopfzeile. renderAll() laeuft im Live
   alle paar Sekunden: geschrieben wird nur, was sich aendert, ein Takt ohne
   Aenderung fasst den Baum nicht an. */
let kopfZuletzt = "";
export function syncFelder(): boolean {
  const an = felderGilt();
  if(document.body.classList.contains("felder") !== an) document.body.classList.toggle("felder", an);
  if(!an) return false;
  const seg = state.encounters[state.sel];
  /* Die Rotation traegt rechts ihre Zahl der Einsaetze und "alle zeigen"
     (Luecken 3.1); den Text schreibt 54-deine-rotation.ts. */
  const rotSicht = state.tab === "rotation" && !!seg && !state.noTime, bkRot = $("#bkRot");
  if(bkRot.hidden === rotSicht) bkRot.hidden = !rotSicht;
  /* Der Vergleich traegt rechts den Umschalter Bester Pull | Letzter Pull
     (Luecken 5.1); seinen Stand schreibt 28-compare.ts. */
  const vglSicht = state.tab === "compare" && !!seg, bkVgl = $("#bkVgl");
  if(bkVgl.hidden === vglSicht) bkVgl.hidden = !vglSicht;
  // den Zeitraum im Verlauf (Luecken 6.1) zeigt renderHistory (32), nur mit Kaempfen; sonst weg
  if(state.tab !== "history" && !$("#bkVerlauf").hidden) $("#bkVerlauf").hidden = true;
  const name = t("tabs." + state.tab);
  let boss = "", zeit = "", dps = "", bild = "";
  if(seg){
    const st = seg.stats || (seg.stats = stats(seg));
    boss = st.name || "";
    zeit = state.wall ? wallTime(seg.start).slice(0, 5) : "";
    dps = t("felder.dps", {dps: state.noTime ? "\u2013" : fmt(st.dps)});
    bild = bossIcon(boss) || "";
  }
  /* Der Beispielkampf wird einmal genannt, hier (Kritik 28.09., P1): vorher
     sagten Verlauf, Vergleich und Abend je einen eigenen grauen Absatz,
     dass er "niemandes Leistung" ist. Die Felder darunter sagen nur noch,
     was dort erscheinen wird, und tragen den Knopf, der es fuellt. */
  const beispiel = state.origin === "sample" && !!seg;
  /* Die Gruppe (Luecken 7.1) nennt statt des Kampfs ihren Stand, wie der
     Entwurf: "Noch keine Gruppe", "Gruppe laeuft · K7QX". Um den
     gewaehlten Kampf geht es dort nicht. */
  const ctx = state.tab === "party" ? gruppeKontext() : "";
  const mitKampf = !!seg && !ctx;
  const sig = [state.lang, name, seg ? 1 : 0, boss, zeit, dps, bild.length, beispiel ? 1 : 0, ctx].join("|");
  if(sig === kopfZuletzt) return true;
  kopfZuletzt = sig;
  const setze = (sel: string, text: string) => { const e = $(sel); if(e.textContent !== text) e.textContent = text; };
  const zeige = (sel: string, sicht: boolean) => { const e = $(sel); if(e.hidden === sicht) e.hidden = !sicht; };
  setze("#bkName", name);
  zeige("#bkKampf", mitKampf);
  setze("#bkCtx", ctx);
  zeige("#bkCtx", !!ctx);
  zeige("#bkAkt", !!seg && KAMPF_HANDLUNG.has(state.tab));
  setze("#bkHinweis", beispiel ? t("felder.beispiel") : "");
  zeige("#bkHinweis", beispiel);
  setze("#bkBossName", boss);
  setze("#bkZeit", zeit);
  setze("#bkDps", dps);
  /* Boss, Zeit und DPS stehen als eigene Spans nur mit CSS-Abstand
     nebeneinander - ohne eigenes Trennzeichen liest ein Vorleser sie als
     ein Wort zusammen. #bkKampf ist ein reines <span> ohne Rolle: ein
     aria-label ist dort nach ARIA 1.2 nicht erlaubt und wird von manchen
     Vorlesern ohnehin ignoriert. Der Trenner steht darum als versteckter
     Text (.vh) im Baum selbst - #bkTr1 vor der Zeit, #bkTr2 vor dem DPS,
     derselbe Trenner wie anderswo in der App ("Zairos \u00b7 Vulkan"). Ohne
     Uhrzeit (kein state.wall) bleibt #bkTr1 leer, sonst stuenden zwei
     Trenner hintereinander; das blosse hidden-Attribut haette daran nichts
     geaendert, textContent (und mit ihm mancher Vorleser) liest ein
     verstecktes Kind trotzdem mit. */
  setze("#bkTr1", zeit ? " \u00b7 " : "");
  setze("#bkTr2", seg ? " \u00b7 " : "");
  const img = $<HTMLImageElement>("#bkBoss");
  if(bild){ if(img.getAttribute("src") !== bild) img.src = bild; }
  else if(img.hasAttribute("src")) img.removeAttribute("src");
  zeige("#bkBoss", !!bild);
  return true;
}

/* ---------- Leere Felder (Kritik 28.09., P1) ----------
   Ein leeres Feld war eine Sackgasse: ein grauer Satz und nichts zu tun.
   Jetzt steht neben dem Satz, was hier erscheinen wird, genau ein Knopf,
   der es fuellt - mit dem Beispiel "Logs oeffnen" (eigene Kaempfe fehlen),
   mit eigenen Logs "Live-Aufzeichnung starten", solange sie nicht laeuft.
   Beide sind keine neuen Wege: sie klicken den Knopf, fuer den sie stehen
   (#btnOpen2, dasselbe wie "Throne-Logs laden" im Oeffnen-Menue, und
   #btnWatch - im Servermodus mit dessen eigenem Handler). */
export type LeerArt = "open" | "live" | "";
export function leerArt(): LeerArt {
  if(state.origin === "sample") return "open";
  return isWatching() ? "" : "live";
}
export function leerKnopf(art: LeerArt = leerArt()): string {
  if(!art) return "";
  return '<button class="btn sm leerknopf" type="button" data-leer="' + art + '">' +
    esc(t(art === "open" ? "top.openLogs" : "land.watchFolder")) + "</button>";
}

/* Ein leeres Feld neu schreiben, ohne den Fokus auf <body> fallen zu lassen:
   stand er auf seinem Knopf und ist der danach weg (Live laeuft jetzt, ein
   Log ist geladen), geht er an den Knopf, fuer den er stand - #btnWatch
   bzw. "Logs oeffnen" oben. Gibt es denselben Knopf wieder, bleibt er dort.
   Hat der Weg selbst den Fokus genommen (ein Dialog), steht er nicht mehr
   im Feld, und hier geschieht nichts. */
export function leerTauschen(box: HTMLElement, html: string): void {
  const a = document.activeElement;
  const art = a instanceof HTMLElement && box.contains(a) ? a.dataset.leer : undefined;
  box.innerHTML = html;
  if(!art) return;
  const gleich = box.querySelector<HTMLElement>('[data-leer="' + art + '"]');
  (gleich || $(art === "live" ? "#btnWatch" : "#btnOpen")).focus({preventScroll: true});
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  // dieselben Wege wie #btnSaveRun und #btnBild im Streifen des Kampfs
  $("#bkSpeichern").onclick = kampfSpeichern;
  $("#bkBild").onclick = () => bildOeffnen();
  // die Knoepfe der leeren Felder: werden neu geschrieben, darum am Dokument
  document.addEventListener("click", e => {
    const b = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-leer]") : null;
    if(!b) return;
    $(b.dataset.leer === "live" ? "#btnWatch" : "#btnOpen2").click();
  });
  syncFelder();
}
