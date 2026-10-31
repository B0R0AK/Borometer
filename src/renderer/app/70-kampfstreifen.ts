import { dur, fmt } from "./03-helpers";
import { t } from "./08-translation";
import { skillLabel } from "./14-questlog-weapons";
import { casts, unverwundbarOf } from "./15-weapons-and-ventius";
import { secs1 } from "./16-fight-analysis";
import { $, clock, esc } from "./18-interface-basics";
import { mechanikStand } from "./61-mechanik";
import type { LueckenStand } from "./26-analysis-tab";
import type { Fight } from "../types";

/* ---------- der Kampfstreifen (Issue #218, Spezifikation 2026-10-07, 2 und 5.1) ----------
   Unter dem Kopf der Analyse ein Streifen ueber die Breite: die Glutkurve
   (Schaden je Sekunde aus perSecond, geglaettet ueber 2 s), dahinter die
   Luecken nach dem Median, die unverwundbaren Strecken und die erkannte
   Mechanik wie vorher an der Form, die staerksten 5 s als Lichtsaeule und der
   Median gestrichelt. Darueber die Fahnen: je zeitgebundenem Eintrag der Liste
   #weitereListe (renderWeitere, 26) eine, sie lesen Zeit und Wortlaut aus dem
   Eintrag (data-von/data-bis), es gibt also eine Quelle. Eine Fahne ist ein
   Umschalter: sie hebt die Strecke hervor, spiegelt ihren Eintrag in die
   Lesezeile #wbLese (aria-live), markiert ihn (aria-current) und dimmt die
   Faecher der Werkbank, die in der Strecke keinen Schaden machten. Escape
   oder "Aufheben" nimmt sie zurueck. Die Wahl gilt fuer den Kampf und
   uebersteht das Neuzeichnen (Thema, Fenstergroesse, Live). Mit bestem Pull
   (bestCasts, 26) steht seine Kurve gestrichelt in Asche dahinter, und die
   Liste traegt "Abstand waechst" (eine Fahne wie die anderen). */

// ein Zeichen je Art der Fahne, 16 x 16, im Strich der Fahne
const ZEICHEN: Record<string, string> = {
  luecken: '<path d="M5 3H3v10h2M11 3h2v10h-2"/>',
  strecke: '<path d="M2 13l4-6 3 3 5-8"/><path d="M10 2h4v4"/>',
  schwach: '<path d="M2 4c3 0 4 8 6 8s3-8 6-8"/>',
  start: '<path d="M4 14V2"/><path d="M4 3h8l-2 3 2 3H4"/>',
  unverwundbar: '<path d="M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4z"/>',
  abstand: '<path d="M2 5h12"/><path d="M2 8l12 5"/>',
};
const zeichen = (k: string) => '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + (ZEICHEN[k === "luecke" ? "luecken" : k] || ZEICHEN.strecke) + "</svg>";

// was der Streifen gerade zeigt: fuer die Kerben (Werkbank) und die Wahl einer Fahne
let jetzt: { seg: Fight; T: number } | null = null;
let wahl: { seg: Fight; id: string } | null = null;
let kerbeVon: string | null = null;

/** Der beste Pull fuer den Streifen: seine Sekunden und wie der Vorleser ihn nennt. */
export interface StreifenGeist { sek: number[]; wann: string; zweit: boolean }
/** Zeichnet den Streifen in #verdict. lk null: ohne Uhr, dann nur der Kopf
    mit #wbWie und die Liste; best: der beste Pull desselben Builds oder null. */
export function renderStreifen(seg: Fight, lk: LueckenStand | null, best: StreifenGeist | null): void {
  const kasten = $("#verdict"), graf = $("#wbGraf");
  if(!kasten) return;
  kasten.hidden = false;
  streifenBinden();
  if(wahl && wahl.seg !== seg) wahl = null;
  if(graf) graf.hidden = !lk;
  if(!lk){ jetzt = null; $("#wbFahnen").innerHTML = ""; fahnenHtml = ""; lesen(); return; }
  jetzt = {seg, T: lk.T};
  kurve(seg, lk, best);
  fahnen();
  lesen();
  zeigAnwenden();
  streifenKerben(kerbeVon);
}

/* ---------- die Glutkurve ----------
   Ein SVG ohne festes Seitenverhaeltnis: es folgt der Hoehe, die formFuellen
   (26) dem Feld gibt. Die Werte je Sekunde (dieselben wie im Zeitverlauf)
   werden ueber 2 s geglaettet (die Sekunde mit je halbem Gewicht der
   Nachbarn), damit ein Einsatz an der Sekundengrenze keinen Zahn macht. Der
   Strich und die Flaeche in --wbkurve (Bernstein, hell --h2): Gold bleibt
   der Auswahl und den Befunden (Staerkste 5 s, Kerben, Fahnen) - kein
   --pos, kein --neg (kein Rot und Gruen als Urteil). Der beste Pull (path.wbgeist)
   gestrichelt in --wbspiegel, gleich geglaettet und im selben Massstab wie
   die eigene Kurve (der hoechste Wert beider). */
const glaetten = (s: readonly number[]) => s.map((v, i) => { const a = i ? s[i-1]! : v, b = i + 1 < s.length ? s[i+1]! : v; return (a/2 + v + b/2)/2; });
function kurve(seg: Fight, lk: LueckenStand, best: StreifenGeist | null){
  const box = $("#saeulen"); if(!box) return;
  const T = lk.T;
  const glatt = glaetten(lk.sek.slice(0, T));
  // ein Massstab fuer beide Kurven: der beste Pull ragt nicht ueber den Rand
  const geistGlatt = best && best.sek.length ? glaetten(best.sek).slice(0, T) : [];
  const hoch = Math.max(1, ...glatt, ...geistGlatt);
  const breite = box.clientWidth || 600, px = breite/T;
  const zahl = (x: number) => +x.toFixed(3);
  const y = (v: number) => zahl(100 - 92*v/hoch);
  let linie = "M0 " + y(glatt[0] || 0);
  glatt.forEach((v, i) => { linie += "L" + zahl(i + 0.5) + " " + y(v); });
  linie += "L" + T + " " + y(glatt[T-1] || 0);
  const flaeche = linie.replace(/^M/, "M0 100L") + "L" + T + " 100Z";
  let geist = "";
  if(geistGlatt.length){
    const g = geistGlatt, gy = y;
    let d = "M0 " + gy(g[0] || 0);
    g.forEach((v, i) => { d += "L" + zahl(i + 0.5) + " " + gy(v); });
    if(g.length >= T) d += "L" + T + " " + gy(g[T-1] || 0);
    geist = '<path class="wbgeist" d="'+d+'" fill="none" stroke="var(--wbspiegel)" stroke-width="1.1" stroke-dasharray="4 3" opacity=".8" vector-effect="non-scaling-stroke"/>';
  }
  const lage = (von: number, bis: number) => 'left:'+(100*von/T).toFixed(3)+'%;width:'+(100*(bis-von)/T).toFixed(3)+'%';
  // die Luecken nach dem Median, ihre Dauer in ganzen Sekunden, wo Platz ist (wie vorher an der Form)
  const zonen = lk.luecken.map(([a, b]) => '<span class="gapz" data-zeit="'+esc(clock(a)+"\u2013"+clock(b))+'" style="'+lage(a, b)+'">'+
    (px*(b-a) >= 46 ? '<span class="vgap">'+esc((b-a)+"\u00a0s")+"</span>" : "")+"</span>").join("");
  // unverwundbar mit dem, was es ist (Wort und Dauer, "Ziel unverwundbar" mit 38,0 s, Issue #37), sonst nur die Zahl, sonst nichts
  const unverwundbar = unverwundbarOf(seg);
  const invz = unverwundbar.map(g => {
    const breit = px*(g.to - g.from);
    const wort = breit >= 190 ? t("timeline.invulnLen", {s: secs1(g.len)}) : secs1(g.len);
    return '<span class="invz" style="'+lage(g.from, Math.min(T, g.to))+'">'+(breit >= 46 ? '<span class="vgap">'+esc(wort)+"</span>" : "")+"</span>";
  }).join("");
  // die erkannte Mechanik (Spezifikation Mechanik 3), schraffiert im Ton des Unverwundbar-Bandes
  const mst = mechanikStand(seg);
  const mech = mst ? mst.liste.flatMap(x => x.strecken) : [];
  const mechz = mech.map(g => {
    const breit = px*(g.bis - g.von), w = (g.bis - g.von)+"\u00a0s";
    const wort = breit >= 150 ? t("mechanik.band", {s: w}) : w;
    return '<span class="mechz" data-zeit="'+esc(clock(g.von)+"\u2013"+clock(g.bis))+'" style="'+lage(g.von, Math.min(T, g.bis))+'">'+
      (breit >= 46 ? '<span class="vgap">'+esc(wort)+"</span>" : "")+"</span>";
  }).join("");
  // die staerksten 5 s als Lichtsaeule; Zeit aus ihrem Eintrag in der Liste
  const st = zeitVon($("#weitereListe")?.querySelector<HTMLElement>('.find[data-k="strecke"]') || null);
  const licht = st ? '<span class="wbstrecke" style="'+lage(st[0], Math.min(T, st[1]))+'"></span>' : "";
  const med = lk.median > 0 ? '<span class="med" style="bottom:'+Math.min(100, 92*lk.median/hoch).toFixed(3)+'%"></span>' : "";
  box.innerHTML = licht + zonen + invz + mechz +
    '<svg viewBox="0 0 '+T+' 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">'+
    '<defs><linearGradient id="wbGlutVerlauf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--wbkurve)" stop-opacity=".5"/>'+
    '<stop offset="1" stop-color="var(--wbkurve)" stop-opacity=".04"/></linearGradient></defs>'+
    '<path class="wbflaeche" d="'+flaeche+'" fill="url(#wbGlutVerlauf)"/>'+
    geist + '<path class="wblinie" d="'+linie+'" fill="none" stroke="var(--wbkurve)" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>' +
    '<span class="wbwahl" hidden></span><span class="wbzeig" hidden></span>' + med;
  /* Die Beschreibung nennt alles, was im Bild steht (Issue #109), wortgleich
     wie vorher an der Form: Luecken, unverwundbare Strecken, Mechanik. */
  const strecke = (von: number, bis: number) => clock(von)+"\u2013"+clock(bis);
  box.setAttribute("aria-label", t("analysis.saeulenLabel", {dauer: dur(seg.stats.seconds), n: lk.luecken.length,
    liste: lk.luecken.map(([a, b]) => strecke(a, b)).join(", "),
    unv: unverwundbar.map(g => strecke(g.from, Math.min(T, g.to))).join(", "),
    mech: mech.map(g => strecke(g.von, Math.min(T, g.bis))).join(", "),
    // der beste Pull vor Unverwundbar und Mechanik: die Beschreibung endet weiter mit dem, was im Kampf geschah
    geist: geist && best ? t("analysis.wb.geistLabel", {zweit: best.zweit, wann: best.wann}) : ""}));
  // die Legende nennt, was gezeichnet wurde, und sonst nichts
  const legS = $("#vlegAvg"); if(legS) legS.hidden = !med;
  const legSText = $("#vlegAvgText"); if(legSText) legSText.textContent = t("analysis.legendMedian", {x: fmt(lk.median, 1e3)});
  const legP = $("#vlegGap"); if(legP) legP.hidden = !lk.luecken.length;
  const legU = $("#vlegInvuln"); if(legU) legU.hidden = !unverwundbar.length;
  const legM = $("#vlegMech"); if(legM) legM.hidden = !mech.length;
  const legG = $("#vlegGeist"); if(legG) legG.hidden = !geist;
  const legGText = $("#vlegGeistText"); if(legGText) legGText.textContent = t(best && best.zweit ? "analysis.wb.zweitPull" : "analysis.wb.besterPull");
  // die Zeitachse: runde Marken ueber die ganze Dauer, hoechstens sieben und
  // nie dichter als eine Marke je 56 Punkt Breite (#236: im schmalen Streifen
  // standen 0:00 und 0:15 ineinander); im verborgenen Reiter (Breite 0) zaehlt die Zahl
  const achse = $("#formAchse");
  if(achse){
    const platz = achse.clientWidth ? Math.max(1, Math.min(6, Math.floor(achse.clientWidth / 56) - 1)) : 6;
    const schritt = [10, 15, 20, 30, 60, 120, 300, 600].find(x => T/x <= platz) || 1200;
    let h = "";
    for(let x = 0; x <= T; x += schritt){
      const q = x/T;
      h += '<span style="left:'+(100*q).toFixed(3)+'%"'+(q === 0 ? ' class="a0"' : q > 0.96 ? ' class="a1"' : "")+">"+esc(clock(x))+"</span>";
    }
    achse.innerHTML = h;
  }
}

/* Die Zeit eines Eintrags der Liste in Sekunden, oder null (ohne Zeit keine Fahne). */
function zeitVon(e: HTMLElement | null): [number, number] | null {
  if(!e || e.dataset.von == null || e.dataset.bis == null) return null;
  const a = Number(e.dataset.von), b = Number(e.dataset.bis);
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? [a, b] : null;
}

/* ---------- die Fahnen ----------
   In der Folge der Zeit (so laeuft auch Tab). Ueberlappende Fahnen ruecken in
   eine zweite Reihe; gemessen wird die echte Breite, im verborgenen Reiter
   (Breite 0) stehen sie ohne Versatz und werden beim Zeigen neu gesetzt
   (renderAnalysis laeuft beim Reiterwechsel). Schmal zeigt die Fahne nur ihr
   Zeichen, der Name steht im aria-label. Eine Fahne heisst wie ihr Eintrag
   (data-k) und ist an ihrer Kennung eindeutig (data-id, idVon). Unter Live
   zeichnet renderAnalysis alle zwei Sekunden: bleibt das Markup gleich,
   werden die Fahnen nur neu gesetzt, nicht neu gebaut. */
/* Nur die Art, die es mehrfach gibt (die weiteren Luecken), traegt ihren
   Beginn in der Kennung: "Staerkste 5 s" und die laengste Luecke bleiben
   gewaehlt, auch wenn sie unter Live wandern. */
const idVon = (e: HTMLElement) => e.dataset.k === "luecke" ? "luecke@"+(e.dataset.von || "") : (e.dataset.k || "");
let fahnenHtml = "";
function fahnen(){
  const reihe = $("#wbFahnen"), liste = $("#weitereListe");
  if(!reihe || !jetzt) return;
  const {T} = jetzt;
  const eintraege = liste ? [...liste.querySelectorAll<HTMLElement>(".find[data-k]")]
    .map(e => ({e, z: zeitVon(e)})).filter((x): x is { e: HTMLElement; z: [number, number] } => !!x.z)
    .sort((a, b) => a.z[0] - b.z[0]) : [];
  const html = eintraege.map(({e, z}) => {
    const k = e.dataset.k!;
    // eine Luecke traegt ihre Dauer (#269): "Luecke 33 s" ordnet Marke und Befund einander zu
    const name = k === "luecken" || k === "luecke" ? t("analysis.wb.lueckeDauer", {s: Math.round(z[1] - z[0])}) : (e.querySelector(".k")?.textContent || "");
    return '<button type="button" class="wbfahne" data-k="'+esc(k)+'" data-id="'+esc(idVon(e))+'" aria-pressed="false" aria-label="'+
      esc(name+", "+clock(z[0])+"\u2013"+clock(z[1]))+'">'+zeichen(k)+'<span class="l">'+esc(name)+"</span></button>";
  }).join("");
  if(html !== fahnenHtml || reihe.childElementCount !== eintraege.length){
    // hatte eine Fahne den Fokus (Neuzeichnen beim Themenwechsel), bekommt ihn die neue
    const fokus = (document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>("#wbFahnen .wbfahne")?.dataset.id || "";
    reihe.innerHTML = html;
    fahnenHtml = html;
    if(fokus) reihe.querySelector<HTMLElement>('.wbfahne[data-id="'+fokus+'"]')?.focus();
  }
  const W = reihe.clientWidth, ende: number[] = [];
  [...reihe.querySelectorAll<HTMLElement>(".wbfahne")].forEach((f, i) => {
    const von = eintraege[i]!.z[0];
    if(!W){ f.style.left = Math.min(90, 100*von/T).toFixed(3)+"%"; f.style.top = "0px"; return; }
    const w = f.offsetWidth, x = Math.max(0, Math.min(W*von/T, W - w));
    let r = 0; while(ende[r] != null && x < ende[r]!) r++;
    ende[r] = x + w + 6;
    f.style.left = (100*x/W).toFixed(3)+"%"; f.style.top = (r*25)+"px";
  });
  reihe.style.height = eintraege.length ? (Math.max(1, ende.length)*25 + 2)+"px" : "";
  reihe.hidden = !eintraege.length;
  if(wahl && !reihe.querySelector('.wbfahne[data-id="'+wahl.id+'"]')) wahl = null;
}

/* Die Lesezeile, die gedrueckte Fahne, der markierte Eintrag, die
   Lichtsaeule der Wahl und die leisen Faecher - alles aus `wahl`. Die
   Lesezeile wird nur geschrieben, wenn sich ihr Inhalt aendert (aria-live
   saehe sonst jeden Live-Takt als neue Meldung); stand der Fokus auf einem
   ihrer Knoepfe, geht er auf den neuen. */
let leseHtml = "";
function lesen(){
  const l = $("#wbLese"), liste = $("#weitereListe");
  const id = wahl && jetzt ? wahl.id : "";
  document.querySelectorAll<HTMLElement>("#verdict .wbfahne").forEach(f => f.setAttribute("aria-pressed", String(f.dataset.id === id)));
  let e: HTMLElement | null = null;
  liste?.querySelectorAll<HTMLElement>(".find[data-k]").forEach(x => {
    if(id && idVon(x) === id){ e = x; x.setAttribute("aria-current", "true"); } else x.removeAttribute("aria-current");
  });
  const z = zeitVon(e);
  const band = document.querySelector<HTMLElement>("#saeulen .wbwahl");
  if(band && jetzt){ band.hidden = !z; if(z) band.style.cssText = 'left:'+(100*z[0]/jetzt.T).toFixed(3)+'%;width:'+(100*(Math.min(jetzt.T, z[1])-z[0])/jetzt.T).toFixed(3)+'%'; }
  leiseFaecher(z);
  if(!l) return;
  let html = "";
  if(e && z){
    const q: HTMLElement = e;
    const txt = (s: string) => (q.querySelector(s)?.textContent || "").trim();
    const weg = q.querySelector("button.inrot");
    html = '<b class="k">'+esc(txt(".k"))+'</b> \u00b7 <span class="v">'+esc(txt(".v"))+"</span>"+
      (txt(".n") ? ' <span class="n">'+esc(txt(".n"))+"</span>" : "")+
      (weg ? " "+weg.outerHTML : "")+
      ' <button type="button" class="wbaufheben" data-aufheben="1">'+esc(t("analysis.wb.aufheben"))+"</button>";
  }
  if(html === leseHtml) return;
  const a = document.activeElement as HTMLElement | null;
  const fokus = a && l.contains(a) ? (a.matches("[data-aufheben]") ? "[data-aufheben]" : a.matches(".inrot") ? ".inrot" : "") : "";
  l.innerHTML = html;
  leseHtml = html;
  if(fokus) l.querySelector<HTMLElement>(fokus)?.focus();
}

/* Die Faecher der Werkbank (#findings .wbfach[data-n]), die in der Strecke
   keinen Schaden machten, treten zurueck. Die Klasse heisst wbzurueck, nicht leise: `leise` ist die
   globale Knopfklasse (inline-flex, 24 Punkt hoch) und machte das Fach zu einer
   Zeile (#236). data-n ist der Name aus dem Log oder der in der Sprache der
   Seite - beide zaehlen. */
function leiseFaecher(z: [number, number] | null){
  const faecher = document.querySelectorAll<HTMLElement>("#findings .wbfach[data-n]");
  if(!faecher.length) return;
  const mit = new Set<string>();
  if(z && jetzt){
    const a = jetzt.seg.start + z[0]*1000, b = jetzt.seg.start + z[1]*1000;
    for(const e of jetzt.seg.events) if(e.dmg > 0 && e.t >= a && e.t < b){ mit.add(e.skill); mit.add(skillLabel(e.skill, e.sid)); }
  }
  faecher.forEach(f => f.classList.toggle("wbzurueck", !!z && !mit.has(f.dataset.n || "")));
}

/* ---------- Zeigen verbindet Befund, Marke und Kurve (#269) ----------
   Zeigen oder Fokussieren eines Befundes in #weitereListe oder seiner Fahne
   hebt die Stelle auf der Kurve hervor (.wbzeig, neutral im Ton des Textes:
   Gold bleibt der Auswahl); umgekehrt hebt Zeigen auf eine Stelle der Kurve
   ihren Befund und ihre Fahne hervor (data-zeig). Mit der Tastatur sagt eine
   leise Meldung (#wbZeigLese, aria-live) wo die Stelle liegt. Das ist kein
   Klick und aendert die Wahl (wahl) nicht. */
let zeig: string | null = null;
function zeigenAuf(id: string | null, ansagen = false){
  if(id === zeig && !ansagen) return;
  zeig = id;
  zeigAnwenden(ansagen);
}
function zeigAnwenden(ansagen = false){
  const liste = $("#weitereListe"), band = document.querySelector<HTMLElement>("#saeulen .wbzeig"), lese = $("#wbZeigLese");
  let e: HTMLElement | null = null;
  liste?.querySelectorAll<HTMLElement>(".find[data-k]").forEach(x => {
    if(zeig && idVon(x) === zeig){ e = x; x.setAttribute("data-zeig", "true"); } else x.removeAttribute("data-zeig");
  });
  let name = "";
  document.querySelectorAll<HTMLElement>("#verdict .wbfahne").forEach(f => {
    const an = !!zeig && f.dataset.id === zeig;
    if(an){ f.setAttribute("data-zeig", "true"); name = f.querySelector(".l")?.textContent || ""; } else f.removeAttribute("data-zeig");
  });
  const z = zeitVon(e);
  if(!z) zeig = null;
  if(band){
    band.hidden = !z || !jetzt;
    if(z && jetzt) band.style.cssText = 'left:'+(100*z[0]/jetzt.T).toFixed(3)+'%;width:'+(100*(Math.min(jetzt.T, z[1])-z[0])/jetzt.T).toFixed(3)+'%';
  }
  // nur mit der Tastatur angesagt, und nur, wenn sich der Text aendert (aria-live)
  if(lese){
    const txt = z && ansagen ? t("analysis.wb.zeigLese", {name, zeit: clock(z[0])+"\u2013"+clock(z[1])}) : "";
    if(lese.textContent !== txt) lese.textContent = txt;
  }
}
/** Der Befund mit Zeit, der die Sekunde s der Kurve enthaelt (der kuerzeste), oder null. */
function befundBei(s: number): string | null {
  let best: string | null = null, kurz = Infinity;
  document.querySelectorAll<HTMLElement>("#weitereListe .find[data-k]").forEach(e => {
    const z = zeitVon(e);
    if(z && s >= z[0] && s <= z[1] && z[1] - z[0] < kurz){ kurz = z[1] - z[0]; best = idVon(e); }
  });
  return best;
}

/** Waehlt die Fahne mit der Kennung id (idVon) oder, fuer "Zum Beleg"
    (26), die erste ihrer Art k; null hebt jede auf. */
export function fahneWaehlen(k: string | null){
  const seg = jetzt?.seg;
  const f = k ? document.querySelector<HTMLElement>('#verdict .wbfahne[data-id="'+k+'"]') || document.querySelector<HTMLElement>('#verdict .wbfahne[data-k="'+k+'"]') : null;
  wahl = f && seg ? {seg, id: f.dataset.id || ""} : null;
  lesen();
}
const fahneMit = (id: string) => document.querySelector<HTMLElement>('#verdict .wbfahne[data-id="'+id+'"]');

let gebunden = false;
function streifenBinden(){
  const kasten = $("#verdict");
  if(gebunden || !kasten) return;
  gebunden = true;
  kasten.addEventListener("click", (ev: MouseEvent) => {
    const z = ev.target as HTMLElement;
    const f = z.closest<HTMLElement>(".wbfahne");
    if(f){ fahneWaehlen(wahl && wahl.id === f.dataset.id ? null : f.dataset.id || null); return; }
    if(z.closest("[data-aufheben]")){
      const id = wahl?.id;
      fahneWaehlen(null);
      // der Fokus geht zurueck auf die Fahne, der Knopf ist weg
      (id ? fahneMit(id) : null)?.focus();
    }
  });
  // Zeigen (Zeiger und Fokus): Befund, Fahne und Stelle der Kurve (#269)
  const quelle = (z: EventTarget | null) => {
    const el = z instanceof Element ? z : null;
    const f = el?.closest<HTMLElement>("#verdict .wbfahne"), b = el?.closest<HTMLElement>("#weitereListe .find[data-k]");
    // die Fahne und ihr Befund tragen dieselbe Kennung (idVon); ohne Zeit gibt es nichts zu zeigen
    return f ? f.dataset.id || null : b && zeitVon(b) ? idVon(b) : null;
  };
  kasten.addEventListener("pointerover", (ev: PointerEvent) => { const id = quelle(ev.target); if(id) zeigenAuf(id); });
  kasten.addEventListener("pointerout", (ev: PointerEvent) => {
    const nach = quelle(ev.relatedTarget);
    if(!nach && !(ev.relatedTarget as HTMLElement | null)?.closest?.("#saeulen")) zeigenAuf(null);
  });
  kasten.addEventListener("focusin", (ev: FocusEvent) => { const id = quelle(ev.target); if(id) zeigenAuf(id, true); });
  kasten.addEventListener("focusout", (ev: FocusEvent) => { if(!quelle(ev.relatedTarget)) zeigenAuf(null); });
  const kurveBox = $("#saeulen");
  kurveBox?.addEventListener("pointermove", (ev: PointerEvent) => {
    if(!jetzt) return;
    const r = kurveBox.getBoundingClientRect();
    if(!r.width) return;
    const id = befundBei(jetzt.T*(ev.clientX - r.left)/r.width);
    if(id !== zeig) zeigenAuf(id);
  });
  kurveBox?.addEventListener("pointerleave", () => zeigenAuf(null));
  // Escape irgendwo im Streifen hebt die Wahl auf (Spezifikation 6)
  kasten.addEventListener("keydown", (ev: KeyboardEvent) => {
    if(ev.key !== "Escape" || !wahl) return;
    const imLesen = (ev.target as HTMLElement).closest("#wbLese"), id = wahl.id;
    fahneWaehlen(null);
    if(imLesen) fahneMit(id)?.focus();
    ev.stopPropagation();
  });
}

/** Die Einsaetze der Faehigkeit k als goldene Kerben unten im Streifen (die
    Werkbank ruft das beim Zeigen und beim Fokus auf ein Fach); null nimmt sie
    weg. k ist der Name aus dem Log oder der in der Sprache der Seite. */
export function streifenKerben(k: string | null): void {
  kerbeVon = k;
  const box = document.querySelector<HTMLElement>("#saeulen");
  if(!box) return;
  box.querySelectorAll(".wbkerbe").forEach(x => x.remove());
  if(!k || !jetzt) return;
  const {seg, T} = jetzt;
  const sidOf = new Map<string, string>();
  for(const e of seg.events) if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);
  let h = "";
  for(const [name, liste] of casts(seg)){
    if(name !== k && skillLabel(name, sidOf.get(name)) !== k) continue;
    for(const c of liste){
      const s = (c.t - seg.start)/1000;
      if(s >= 0 && s <= T) h += '<span class="wbkerbe" style="left:'+(100*s/T).toFixed(3)+'%"></span>';
    }
  }
  if(h) box.insertAdjacentHTML("beforeend", h);
}
