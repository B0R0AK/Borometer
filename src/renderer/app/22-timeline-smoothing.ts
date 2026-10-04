import { state } from "./01-state";
import { fmt } from "./03-helpers";
import { t } from "./08-translation";
import { skillMark } from "./11-skill-icons";
import { seriesLabel } from "./14-questlog-weapons";
import { pctMin } from "./16-fight-analysis";
import { $, esc } from "./18-interface-basics";
import { renderStack } from "./24-table-keyboard-and-timeline";
import type { StackHit, StackSeries } from "../types";

/* ---------- Glaetten und Runden fuer den Zeitverlauf ----------

   glaetten() ist ein zentrierter gleitender Mittelwert. Am Rand laeuft er
   ueber das, was da ist, statt mit Null aufzufuellen - sonst faellt die
   Kurve an Anfang und Ende kuenstlich ab und behauptet eine Ruhe, die es
   nicht gab.

   monotonSteigungen() und monotonAbtasten() runden die Ecken zwischen zwei
   Sekunden. Ausdruecklich NICHT Catmull-Rom: die schwingt zwischen zwei
   Messpunkten ueber deren Werte hinaus, wuerde also Schadensspitzen
   zeichnen, die es nie gab, und an flachen Stellen unter Null gehen. Die
   monotone Variante geht durch jeden Messpunkt und bleibt zwischen zwei
   Punkten innerhalb deren beider Werte; sie kann nichts erfinden.

   Die Steigung ist das HARMONISCHE Mittel der beiden Nachbarsteigungen
   (Fritsch und Butland, dasselbe was SciPy fuer PCHIP nimmt). Es liegt
   immer unter dem Dreifachen der kleineren, schliesst das Ueberschwingen
   also ebenso aus wie ein begrenztes arithmetisches Mittel - verzieht die
   gestapelten Kanten aber nur halb so stark. Am Entwurf gemessen: groesster
   Fehler 1,86 statt 2,52 Bildpunkte, und es rundet dabei sogar mehr. */
/* Runde Schritte fuer eine Achse (Neugestaltung 28.09., Luecke 2.14): 1,
   2, 2,5 oder 5 mal eine Zehnerpotenz, so dass etwa n Schritte bis oben
   reichen; die Werte ab 0, keiner ueber oben. */
export function rundeSchritte(oben: number, n = 4): number[] {
  if(!(oben > 0)) return [0];
  const roh = oben / Math.max(1, n), p = 10 ** Math.floor(Math.log10(roh)), m = roh / p;
  const schritt = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  const aus: number[] = [];
  for(let i = 0; i * schritt <= oben * (1 + 1e-9); i++) aus.push(+(i * schritt).toPrecision(12));
  return aus;
}
export function glaetten(v: number[], f: number){
  if(f <= 1) return v.slice();
  const h = (f-1)/2 | 0, raus = new Array(v.length);
  for(let i=0;i<v.length;i++){
    const a = Math.max(0, i-h), b = Math.min(v.length-1, i+h);
    let sum = 0; for(let j=a;j<=b;j++) sum += v[j]!;
    raus[i] = sum/(b-a+1);
  }
  return raus;
}
export function monotonSteigungen(v: number[]){
  const n = v.length, d = [], m = [];
  for(let i=0;i<n-1;i++) d.push(v[i+1]!-v[i]!);
  for(let i=0;i<n;i++){
    if(n === 1){ m.push(0); continue; }
    if(i === 0){ m.push(d[0]); continue; }
    if(i === n-1){ m.push(d[n-2]); continue; }
    if(d[i-1]!*d[i]! <= 0){ m.push(0); continue; }
    m.push(2*d[i-1]!*d[i]!/(d[i-1]!+d[i]!));
  }
  return m;
}

/* Die zwei Zahlen einer Zeile in der Namensspalte: der Anteil und die
   Summe. Beide Zeitreiter zeigen an optisch gleicher Stelle dieselbe
   Zeile - also zeigen sie auch dasselbe Mass. Vorher stand im
   Zeitverlauf "80,7 %" und in der Rotation "67.47M", und nichts sagte,
   dass die Spalte das Mass wechselt. Nachgerechnet sind es zwei Blicke
   auf dieselbe Zahl: 67.468.165 von 83.558.502 sind 80,7 %. */
/* Der Kopf der Namensspalte ist genau so hoch wie die Kurve daneben, sonst
   stuenden die Namen neben den falschen Spuren. In einem schmalen Fenster
   ist die Kurve niedriger, und auf Deutsch lief der erklaerende Satz dann in
   die erste Zeile hinein. Passt der Kopf nicht, gehen die Saetze; Titel und
   Legende bleiben, und was die Saetze sagen, steht auch im title jeder
   Zeile. */
export function kopfEinpassen(g: HTMLElement){
  const kopf = g.querySelector<HTMLElement>(".rotgutkopf");
  if(!kopf) return;
  kopf.classList.remove("eng");
  // die natuerliche Hoehe, nicht scrollHeight: unten buendig laeuft ein
  // zu hoher Kopf nach oben ueber, und das zaehlt scrollHeight nicht mit
  const soll = kopf.style.height;
  kopf.style.height = "auto";
  const braucht = kopf.offsetHeight;
  kopf.style.height = soll;
  if(braucht > kopf.offsetHeight + 1) kopf.classList.add("eng");
}
/* Die Namensspalte ist fuer die Tastatur EIN Halt, wie Kampfliste und
   Tabelle. Zwoelf Knoepfe standen einzeln in der Tab-Folge, und zwar vor dem
   Diagramm: wer mit Tab zum Zeitverlauf wollte, drueckte zwoelfmal durch die
   Legende. Jetzt: role=toolbar, senkrecht; Tab landet auf einem Knopf (dem
   zuletzt benutzten, sonst dem ersten), Pfeil hoch/runter, Pos1 und Ende
   wandern, Enter und Leertaste schalten wie bisher. Der Knopf bleibt ein
   Knopf mit aria-pressed - die Sprachausgabe sagt "gedrueckt" oder nicht.
   Die Spalte wird bei jedem Umschalten neu gebaut (innerHTML); stand der
   Fokus darin, kehrt er auf denselben Namen zurueck, sonst fiele er auf
   <body> und die Tab-Folge begaenne von vorn. */
const spurMerk = new WeakMap<HTMLElement, string>();
/* `rolle` false: der Behaelter hat seine eigene Rolle (das Feld "Einsaetze"
   der Rotation ist eine Tabelle, 48-einsaetze.ts) - dann nur die Tastatur
   und der eine Tabstopp, keine toolbar ueber den Zeilen; `name` bleibt dann leer. */
export function spurGruppe(g: HTMLElement, schluessel: "series" | "rot", name: string, hatteFokus: boolean, rolle = true){
  if(rolle){
    g.setAttribute("role", "toolbar");
    g.setAttribute("aria-orientation", "vertical");
    g.setAttribute("aria-label", name);
  }
  const knoepfe = [...g.querySelectorAll<HTMLElement>(".rotgz")];
  const merk = spurMerk.get(g);
  const ziel = knoepfe.find(b => b.dataset[schluessel] === merk) || knoepfe[0];
  knoepfe.forEach(b => {
    b.tabIndex = b === ziel ? 0 : -1;
    b.addEventListener("focus", () => {
      spurMerk.set(g, b.dataset[schluessel]!);
      knoepfe.forEach(k => { k.tabIndex = k === b ? 0 : -1; });
    });
  });
  if(hatteFokus && ziel) ziel.focus();
  if(g.dataset.spurTasten) return;   // die Spalte selbst bleibt, nur ihr Inhalt wechselt
  g.dataset.spurTasten = "1";
  g.addEventListener("keydown", e => {
    if(e.altKey || e.ctrlKey || e.metaKey) return;
    if(!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const alle = [...g.querySelectorAll<HTMLElement>(".rotgz")];
    const i = alle.indexOf(document.activeElement as HTMLElement);
    if(i < 0) return;
    e.preventDefault();
    const nach = e.key === "ArrowDown" ? alle[i + 1]
      : e.key === "ArrowUp" ? alle[i - 1]
      : e.key === "Home" ? alle[0] : alle[alle.length - 1];
    if(nach) nach.focus();
  });
}
// Die zwei Zahlen einer Zeile der Namensspalte: Anteil und Schaden.
export function gutWerte(wert: number, gesamt: number){
  return pctMin(wert / Math.max(1, gesamt), 1) + " \u00b7 " + fmt(wert);
}

/* ---------- stacked per-second timeline ----------
   Shares its window (from/to) and zoom with the cast timeline, so you can
   flip between "how much" and "when" without losing your place. */
export let stackHit: StackHit | null = null;
// an import cannot be assigned to - the timeline sets it through this
export function setStackHit(v: StackHit | null){ stackHit = v; }
/* Die Namensspalte des Zeitverlaufs. Sie steht ausserhalb des
   Rollbereichs und bleibt deshalb stehen, wenn man zoomt. Jede Zeile ist
   ein Knopf: er nimmt die Faehigkeit aus der Kurve oben heraus. Ihre Spur
   bleibt trotzdem sichtbar, nur blass - sonst waere die Zeile, die man
   gerade abgeschaltet hat, spurlos weg. */
export function renderStackGut(reihen: StackSeries[], kopfH: number, spurH: number, gesamt: number,
                               baender?: { luecke: boolean; schwach: boolean; unverwundbar?: boolean; mechanik?: boolean }){
  const g = $("#stackGut");
  if(!g) return;
  let html = '<div class="rotgutkopf zwei" style="height:'+kopfH+'px">'+
    '<span class="teil"><b>'+esc(t("timeline.curveTitle"))+"</b>"+
    "<span>"+esc(state.stackSmooth > 1
      ? t("timeline.curveHintSmooth", {n: state.stackSmooth})
      : t("timeline.curveHintRaw"))+"</span>"+
    (baender && (baender.luecke || baender.schwach || baender.unverwundbar || baender.mechanik)
      ? '<span class="bandkey">'+
        /* Je Eintrag ein Kasten: Muster und Wort brechen nie auseinander
           (Issue #37 - "Ziel unverwundbar" stand am Zeilenende, sein
           Muster davor, "schwaechste 3 s" darunter ohne seins). */
        (baender.luecke ? '<span class="bke"><i class="bk gap" aria-hidden="true"></i>'+esc(t("timeline.keyGap"))+"</span>" : "")+
        (baender.unverwundbar ? '<span class="bke"><i class="bk invuln" aria-hidden="true"></i>'+esc(t("timeline.keyInvuln"))+"</span>" : "")+
        (baender.mechanik ? '<span class="bke"><i class="bk mech" aria-hidden="true"></i>'+esc(t("mechanik.legend"))+"</span>" : "")+
        (baender.schwach ? '<span class="bke"><i class="bk weak" aria-hidden="true"></i>'+esc(t("timeline.keyWeak", {n: 3}))+"</span>" : "")+
        "</span>"
      : "")+"</span>"+
    '<span class="teil"><b>'+esc(t("timeline.lanesTitle"))+"</b>"+
    "<span>"+esc(t("timeline.lanesHint"))+"</span></span></div>";
  for(const sr of reihen){
    const drin = !state.stackOff.has(sr.name);
    const summe = sr.values.reduce((x, y) => x + y, 0);
    html += '<button type="button" class="rotgz" data-series="'+esc(sr.name)+'"'+
      ' style="height:'+spurH+'px" aria-pressed="'+(drin ? "true" : "false")+'"'+
      // der volle Name vorn, wie in der Rotation: schmal steht er gekuerzt
      ' title="'+esc(seriesLabel(sr.name, sr.sid)+" \u2014 "+t(drin ? "timeline.legendHint" : "timeline.laneOn"))+'">'+
      skillMark(sr.name, sr.sid, sr.color, sr.rest)+
      /* seriesLabel, nicht skillLabel: die Sammelspur heisst intern
         "__other__", und skillLabel gibt einen Namen, den es nicht kennt,
         unveraendert zurueck - der Bezeichner stand damit in der Liste.
         Das Hinweisfenster machte es schon richtig. */
      "<em>"+esc(seriesLabel(sr.name, sr.sid))+"</em>"+
      "<u>"+esc(gutWerte(summe, gesamt))+"</u></button>";
  }
  const hatteFokus = g.contains(document.activeElement);
  g.innerHTML = html;
  kopfEinpassen(g);
  spurGruppe(g, "series", t("timeline.lanesGroup"), hatteFokus);
  g.querySelectorAll<HTMLElement>(".rotgz").forEach(btn => btn.addEventListener("click", () => {
    const n = btn.dataset.series!;
    if(state.stackOff.has(n)) state.stackOff.delete(n); else state.stackOff.add(n);
    renderStack();
  }));
}
