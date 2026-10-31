import { state } from "./01-state";
import { toast } from "./03-helpers";
import { t } from "./08-translation";
import { $ } from "./18-interface-basics";
import { bereichGesetzt, switchTab } from "./34-menus-drop-and-tabs";
import { rotationHervorheben } from "./54-deine-rotation";
import { abreissen, winPost } from "./37-window-size-and-overlay";
import { ABRISS_TAB, ABRISS_TEIL, FENSTER, OWN_WINDOW } from "./41-server-mode";

/* Das native Menue auf einer Tafelzeile (Windows Teil 2). Die Seite sagt dem
   Hauptprozess nur, dass auf eine Zeile geklickt wurde ("menue", "zeile");
   Punkte und Woerter stehen dort fest. Die Wahl kommt als Zaehler zurueck
   (37, Ereignisschleife) und wird hier an der Zeile getan, auf die zuletzt
   gezeigt wurde. Nur in der Vollansicht der App: im Browser und im Streifen
   bleibt der Rechtsklick, wie er war. */
let menueZeile: { name: string; wert: string; skill: string } | null = null;
let menueLetzte = -Infinity;

function zeileDaten(z: HTMLElement){
  const name = z.querySelector<HTMLElement>(".nmt")?.textContent?.trim() || z.textContent?.trim().slice(0, 80) || "";
  /* Die Tafel hat Schaden und DPS, die Zeile des Glutrings nur den DPS. */
  const wert = (z.querySelector<HTMLElement>('[data-k="damage"]') || z.querySelector<HTMLElement>('[data-k="dps"]'))?.textContent?.trim() || "";
  return { name, wert, skill: z.dataset.skill || "" };
}

function zeigeMenue(z: HTMLElement){
  /* Menue-Taste und Umschalt+F10 koennen zweimal ankommen (unser keydown und
     Chromiums eigenes contextmenu): zwei Anfragen binnen 400 ms sind eine. */
  const jetzt = performance.now();
  if(jetzt - menueLetzte < 400) return;
  menueLetzte = jetzt;
  menueZeile = zeileDaten(z);
  void winPost({do:"menue", art:"zeile"}).then(a => { if(!a || a.ok !== true) menueZeile = null; });
}

/* Die Zwischenablage; wo es sie nicht gibt (kein sicherer Ursprung) oder sie
   ablehnt, ein verstecktes Textfeld mit dem alten Befehl. */
async function kopiere(text: string): Promise<boolean> {
  try {
    if(navigator.clipboard){ await navigator.clipboard.writeText(text); return true; }
  } catch { /* weiter mit dem Textfeld */ }
  const f = document.createElement("textarea");
  f.value = text;
  f.setAttribute("readonly", "");
  f.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  document.body.appendChild(f);
  const vorher = document.activeElement as HTMLElement | null;
  f.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { /* bleibt falsch */ }
  f.remove();
  vorher?.focus?.();
  return ok;
}

function kopiereZeile(z: { name: string; wert: string }){
  const text = z.name + (z.wert ? " " + z.wert : "");
  void kopiere(text).then(ok => toast(t(ok ? "menue.kopiert" : "menue.kopierenFehler")));
}

/** Die Wahl im Menue (37): nur die Vollansicht zeigt es und handelt, an der Zeile, auf die zuletzt gezeigt wurde. */
export function aufMenueWahl(id: "kopieren" | "rotation"): void {
  const z = menueZeile;
  if(!z) return;
  menueZeile = null;
  if(id === "kopieren"){
    kopiereZeile(z);
  } else {
    switchTab("rotation");
    if(z.skill) rotationHervorheben(z.skill);
  }
}

/* ---------- Abreissen (Windows Teil 2, Spezifikation 3) ----------
   Vier Bereiche lassen sich in ein eigenes Fenster legen. Der Knopf im Kopf
   bittet den Hauptprozess darum (abreissen, 37); das Fenster laedt dieselbe
   Seite auf ?win=1&teil=<name> (ABRISS_TEIL, 41), zeigt nur diesen Bereich
   und folgt dem Kampf der Vollansicht. */
const TAB_BEREICH: Record<string, string> = { timeline: "kampf", rotation: "rotation", analysis: "analyse", compare: "vergleich" };

/* Der Bereich, der gerade steht - nur, wenn er einer der vier ist (nicht
   Start, Einstellungen, Weeklies ...; syncBereiche setzt .on auf den Ort). */
function teilJetzt(): string {
  const tab = document.querySelector<HTMLElement>("#bereiche .tab.on")?.dataset.tab || "";
  return Object.hasOwn(TAB_BEREICH, tab) ? TAB_BEREICH[tab]! : "";
}
function knopfNachziehen(){
  const b = document.getElementById("btnAbreissen");
  if(!b) return;
  /* Im Kompakt im selben Fenster (ohne Kompaktfenster) ist die Seite der
     Streifen: dort gibt es nichts abzureissen. */
  const teil = document.body.classList.contains("compact") ? "" : teilJetzt();
  b.hidden = !teil;
  b.dataset.teil = teil;
}
/* Ohne Kampf in der Vollansicht sagt das Fenster es, statt der Startseite (32). */
function leerNachziehen(){
  const l = document.getElementById("abrissLeer");
  if(l) l.hidden = state.encounters.length > 0 || !$("#app").hidden;
}
/** Der Titel des abgerissenen Fensters: der Bereich, fuer Alt+Tab und Vorleser (auch nach einem Sprachwechsel, 37). */
export function abrissTitel(): void {
  if(!ABRISS_TAB) return;
  const punkt = String.fromCharCode(0xb7);
  document.title = t("tabs." + ABRISS_TAB) + " " + punkt + " Borometer";
}

export function setup(): void {
  if(ABRISS_TEIL){
    document.body.dataset.abriss = ABRISS_TEIL;
    document.body.classList.add("abriss");
    bereichGesetzt.push(leerNachziehen);
    switchTab(ABRISS_TAB!);
    /* Der Kopf nennt den Bereich (Spezifikation 3): dieselben Woerter wie die
       Bereichsleiste, ueber data-i18n auch nach einem Sprachwechsel (31). */
    const name = $("#abrissName");
    name.dataset.i18n = "tabs." + ABRISS_TAB;
    name.textContent = t("tabs." + ABRISS_TAB);
    name.hidden = false;
    abrissTitel();
    return;
  }
  if(OWN_WINDOW && FENSTER === "main"){
    const b = $("#btnAbreissen");
    b.addEventListener("click", () => { if(b.dataset.teil) abreissen(b.dataset.teil); });
    bereichGesetzt.push(knopfNachziehen);
    knopfNachziehen();
  }
  if(!OWN_WINDOW || FENSTER !== "main") return;
  const bars = $("#bars");
  bars.addEventListener("contextmenu", e => {
    const z = (e.target as HTMLElement).closest<HTMLElement>(".row");
    /* Im Kompakt im selben Fenster ist die Seite der Streifen: kein Menue. */
    if(!z || document.body.classList.contains("compact")) return;
    e.preventDefault();
    zeigeMenue(z);
  });
  bars.addEventListener("keydown", e => {
    const z = (e.target as HTMLElement).closest<HTMLElement>(".row");
    if(!z || document.body.classList.contains("compact")) return;
    /* Strg+C an der Zeile wie "Kopieren" im Menue - nur ohne markierten Text,
       damit normales Kopieren nie abgefangen wird. */
    if(e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === "c"){
      if(!(window.getSelection()?.toString() ?? "")){ e.preventDefault(); kopiereZeile(zeileDaten(z)); }
      return;
    }
    if((e.shiftKey && e.key === "F10") || e.key === "ContextMenu"){ e.preventDefault(); zeigeMenue(z); }
  });
}
