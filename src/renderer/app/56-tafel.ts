import { pullWhen, urteilZahlen, type Abstand } from "../best-pull-core";
import type { Fight } from "../types";
import { SERIES_N, state } from "./01-state";
import { fmt } from "./03-helpers";
import { stats } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { skillMark } from "./11-skill-icons";
import { skillLabel } from "./14-questlog-weapons";
import { markiereRest, numN, paintMech, pctMin, perSecond } from "./16-fight-analysis";
import { $, clock, esc } from "./18-interface-basics";
import { glaetten, rundeSchritte } from "./22-timeline-smoothing";
import { urteilHtml } from "./26-analysis-tab";
import { cmpKey, cmpLauf } from "./28-compare";
import { switchTab } from "./34-menus-drop-and-tabs";
import { bestInfo, type BestInfo } from "./46-best-pull";
import { mechanikStempel, mechanikStrecken } from "./61-mechanik";
import { syncGlutring } from "./64-glutring";

/* ---------- Kampf-Tafel (Instrumententafel 4, Neugestaltung 28.09.) ----------
   Der Bereich "Kampf" zeigt in der vollen Ansicht alles gleichzeitig:
   Streifen (der Kopf), Tafel links, Kurve rechts oben, Urteil rechts unten;
   unter der Kurve "Zeitverlauf ausklappen" wie im Entwurf und der Weg in
   den Bereich Rotation zum gestapelten Zeitverlauf. */
/* Der Bereich Kampf der vollen Ansicht. Seit dem Glutring (Spezifikation 5)
   auch in der Gruppenansicht: dort zeigt der Ring die Mitglieder. Nicht im
   Kompakt, nicht auf Start und nicht in den Einstellungen. */
export function tafelGilt(): boolean {
  return !document.body.classList.contains("compact") && !state.start && !state.einst && state.tab === "timeline" &&
    state.encounters.length > 0;
}
/* "Zeitverlauf ausklappen" laesst das Band wachsen (Kurve 200 statt 78
   Punkt) und zeigt die vier staerksten Faehigkeiten. Seit dem Glutring
   (Spezifikation 2, E 10) oeffnet es nicht mehr von selbst ab 1200 Punkt
   Fensterhoehe: das Band ist "etwa 110 Punkt", auch im eigenen Fenster. Die
   Wahl des Lesers gilt fuer die Sitzung (state.zeitAuf). */
/* Setzt body.tafel und den Zustand des Zeitverlaufs. Geschrieben
   wird nur, was sich aendert - renderAll() laeuft im Live alle paar
   Sekunden, und ein neu gesetzter Text am Knopf waere jedes Mal eine
   Aenderung im Baum. */
export function syncTafel(): boolean {
  const an = tafelGilt();
  const war = document.body.classList.contains("tafel");
  document.body.classList.toggle("tafel", an);
  /* Das Ringfeld (64): body.glut und die Knoten des Kopfs - vor dem Schnitt
     der Liste, der am Raster misst. */
  syncGlutring(an);
  /* Beim Wechsel in einen anderen Bereich muss der Deckel der Liste wieder
     gesetzt werden (schneideAufZeilen in 16). */
  if(war !== an) markiereRest();
  /* Der Hinweis unter der Liste ("Faehigkeiten ohne Waffe ...") ist eine
     Anweisung und steht im Glutring zwischen Liste und Urteil, in der Spalte
     der Liste; beim Verlassen zurueck hinter .table. */
  if(war !== an){
    const note = $("#barsNote");
    if(an) $("#bars").after(note); else $(".table").after(note);
  }
  const knopf = $("#zeitAuf");
  const gross = an && state.zeitAuf;
  if(knopf.getAttribute("aria-expanded") !== String(gross)) knopf.setAttribute("aria-expanded", String(gross));
  const text = t(gross ? "tafel.zeitZu" : "tafel.zeitAuf"), tx = $("#zeitAufText");
  if(tx.textContent !== text) tx.textContent = text;
  document.body.classList.toggle("kurvegross", gross);
  if(an){ renderKurve(); renderTafelUrteil(); }
  return an;
}

/* Kurzform fuer die Achse: "250k", "1.5M" - wie im Entwurf ohne
   ueberfluessige Null ("250.0k"), mit Punkt auch im Deutschen (DESIGN.md). */
const achsenZahl = (v: number) => v >= 1e6 ? +(v / 1e6).toFixed(2) + "M" : v >= 1e3 ? +(v / 1e3).toFixed(1) + "k" : String(Math.round(v));

/* Die Kurve Schaden je Sekunde: dieser Pull als Flaeche in Gold wie im
   Zeitverlauf (gleiche Glaettung), die rohe Sekundenreihe blass darunter,
   der beste Pull gestrichelt, wenn es einen gibt; eine y-Achse in runden
   Schritten (Luecke 2.14). Aufgeklappt (Luecke 2.15) waechst die Kurve und
   zeigt die vier staerksten Faehigkeiten als Linien in ihren Reihenfarben.
   Zeigt man auf eine Zeile der Tafel (Maus oder Fokus), liegt deren Spur
   in ihrer Reihenfarbe darueber. Nur die Gesamtkurve des besten Pulls ist
   gespeichert, eine Spur je Faehigkeit gibt es nur fuer diesen.
   Eine Signatur haelt einen Live-Takt ohne Aenderung von Canvas und
   Texten fern - gebildet aus dem, was billig zu haben ist, vor perSecond
   und dem Lauf des Bezugs (cmpLauf fasst einen Kampf des Logs nach jedem
   Neubau der Liste neu zusammen). */
let kurveZuletzt = "", kurveKampf = "", legZuletzt = "", achseZuletzt = "", reihenZuletzt = "", mechZuletzt = "";
export function renderKurve(){
  if(!tafelGilt()) return;
  // in der Gruppe zeigt das Band den Anteil je Mitglied, und das Urteil ruht (64, E 11)
  if(state.group === "party") return;
  const seg = state.encounters[state.sel]; if(!seg) return;
  /* Die Spur gehoert zu einer Zeile dieses Kampfes: ein anderer Kampf
     (Liste, Strg+K) beginnt ohne sie - sonst stand die Spur weiter da,
     obwohl keine Zeile gezeigt wurde. Ein anderer Kampf ist ein anderer
     Beginn; ein Live-Takt oder eine neue Nummer in der Liste ist es nicht. */
  const kampf = String(seg.start);
  if(kampf !== kurveKampf){ kurveKampf = kampf; state.kurveSkill = ""; }
  const cv = $("#kurve") as HTMLCanvasElement;
  const info = bestInfo();
  const offen = document.body.classList.contains("kurvegross");
  const r = cv.getBoundingClientRect(), q = window.devicePixelRatio || 1;
  const sig = [state.sel, kampfNr(seg), state.encounters.length, seg.start, seg.end, seg.events.length, bezugSig(info),
               state.kurveSkill, state.lang, r.width, r.height, q, document.documentElement.dataset.theme, offen ? 1 : 0,
               mechanikStempel(seg)].join("|");
  if(sig === kurveZuletzt) return;
  kurveZuletzt = sig;
  if(!seg.stats) seg.stats = stats(seg);
  const ps = perSecond(seg, SERIES_N);
  const bezug = bezugKurve(info);
  const spur = state.kurveSkill ? spurVon(seg, ps, state.kurveSkill) : null;
  /* Erkannte Mechanik (61-mechanik.ts) mit derselben Schraffur wie in Analyse und
     Rotation (paintMech in 16; Feinschliff 02.10., Abschnitt 3). */
  const mech = mechanikStrecken(seg);
  cv.width = Math.round(r.width * q); cv.height = Math.round(r.height * q);
  const ctx = cv.getContext("2d")!; ctx.setTransform(q, 0, 0, q, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
  const f = Math.min(5, Math.max(1, Math.floor(ps.T / 6)));
  const dies = glaetten(ps.total, f), best = bezug ? glaetten(bezug, f) : null;
  // aufgeklappt: die vier staerksten Faehigkeiten (perSecond liefert sie nach Schaden)
  const reihen = offen ? ps.series.slice(0, 4).map(s => ({name: s.name, sid: s.sid, color: s.color, values: glaetten(s.values, f)})) : [];
  const T = Math.max(ps.T, best ? best.length : 0, 1);
  /* Oben ist Luft ueber der hoechsten geglaetteten Linie (wie im Entwurf);
     die rohe Reihe darf darueber hinaus und wird am Rand gekappt. */
  const top = Math.max(1, ...dies, ...(best || [])) * 1.12;
  const pad = {l: 2, r: 8, t: 8, b: 20}, W = r.width - pad.l - pad.r, H = r.height - pad.t - pad.b;
  const X = (i: number) => pad.l + W * i / Math.max(1, T - 1), Y = (v: number) => pad.t + H * (1 - Math.min(v, top) / top);
  const farbe = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const linie = (v: number[], stil: string, breite: number, strich: number[], alpha = 1) => {
    ctx.beginPath(); v.forEach((y, i) => i ? ctx.lineTo(X(i), Y(y)) : ctx.moveTo(X(i), Y(y)));
    ctx.globalAlpha = alpha; ctx.strokeStyle = stil; ctx.lineWidth = breite; ctx.setLineDash(strich); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1; };
  const schritte = rundeSchritte(top, 4);
  // zugeklappt oder noch ohne Flaeche (gestapelt vor dem ersten Layout): nichts zu zeichnen
  if(W > 0 && H > 0){
    ctx.strokeStyle = farbe("--canvas-rule"); ctx.lineWidth = 1;
    for(const v of schritte){ const y = Math.round(Y(v)) + 0.5; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + W, y); ctx.stroke(); }
    paintMech(ctx, mech, X, 0, T - 1, pad.t, pad.t + H);
    const gold = farbe("--gold");
    linie(ps.total, gold, 1, [], 0.22);
    ctx.beginPath(); dies.forEach((y, i) => i ? ctx.lineTo(X(i), Y(y)) : ctx.moveTo(X(i), Y(y)));
    ctx.lineTo(X(dies.length - 1), Y(0)); ctx.lineTo(X(0), Y(0)); ctx.closePath();
    ctx.globalAlpha = 0.18; ctx.fillStyle = gold; ctx.fill(); ctx.globalAlpha = 1;
    if(best) linie(best, farbe("--dim"), 1.4, [4, 4]);
    for(const s of reihen) linie(s.values, s.color, 1.4, [], 0.9);
    linie(dies, gold, 2, []);
    if(spur) linie(glaetten(spur.values, f), spur.color, 1.6, []);
    ctx.fillStyle = farbe("--dim"); ctx.font = "11px " + farbe("--sans");
    const schritt = [15, 30, 60, 120, 300].find(s => s * W / T >= 60) || 600;
    for(let s = 0; s <= T; s += schritt) ctx.fillText(clock(s), Math.min(X(s), r.width - 30), r.height - 4);
  }
  cv.dataset.bezug = best ? "1" : "0";
  cv.dataset.spur = spur ? state.kurveSkill : "";
  cv.dataset.roh = "1";
  cv.dataset.linien = String(reihen.length);
  // fuer Pruefungen: die Strecken als Uhrzeit und als Lage auf der Leinwand (CSS-Punkte)
  const spanne = (von: number, bis: number) => clock(von) + "\u2013" + clock(bis);
  cv.dataset.mech = mech.map(g => spanne(g.from, g.to)).join(", ");
  cv.dataset.mechx = W > 0 ? JSON.stringify(mech.map(g => ({a: +X(g.from).toFixed(1), b: +X(Math.min(g.to, T - 1)).toFixed(1)}))) : "[]";
  /* Die leise Zeile unter der Kurve: wann, und dass es nicht als Luecke zaehlt.
     Sie nennt den Boss nicht als Urheber (gewuenscht: ehrlich bleiben). */
  const mz = mech.length ? t("tafel.mechanik", {zeiten: mech.map(g => spanne(g.from, g.to)).join(", ")}) : "";
  if(mz !== mechZuletzt){ mechZuletzt = mz; const el = $("#kurveMech"); el.textContent = mz; el.hidden = !mz; }
  /* Die y-Achse als Text neben den Linien, auf ihrer Hoehe. */
  const achse = H > 0 ? schritte.map(v => '<span class="kyl" data-v="' + v + '" style="top:' + Y(v).toFixed(1) + 'px">' + esc(achsenZahl(v)) + "</span>").join("") : "";
  if(achse !== achseZuletzt){ achseZuletzt = achse; $("#kurveAchse").innerHTML = achse; }
  /* Die Legende als Linien wie im Entwurf: dieser Pull, der beste
     gestrichelt (ist dieser der beste, heisst der Bezug "zweitbester"). */
  const leg = '<span class="klg"><i></i>' + esc(t("tafel.legDieser")) + "</span>" +
    (best ? '<span class="klg"><i class="b"></i>' + esc(t(info.isBest ? "tafel.legZweit" : "tafel.legBester")) + "</span>" : "") +
    (mech.length ? '<span class="klg"><i class="m"></i>' + esc(t("mechanik.legend")) + "</span>" : "");
  if(leg !== legZuletzt){ legZuletzt = leg; $("#kurveLeg").innerHTML = leg; }
  const rh = reihen.map(s => '<span><i style="--c:' + esc(s.color) + '"></i>' + esc(skillLabel(s.name, s.sid)) + "</span>").join("");
  if(rh !== reihenZuletzt){ reihenZuletzt = rh; const el = $("#kurveReihen"); el.innerHTML = rh; el.hidden = !rh; }
  const st = seg.stats;
  const sk = spur ? st.skills.find(x => x.name === state.kurveSkill) : undefined;
  const unter = sk ? t("tafel.spurUnter", {name: skillLabel(sk.name), pct: pctMin(sk.damage / (st.total || 1), 1)})
                   : t("tafel.gesamt");
  if($("#kurveUnter").textContent !== unter) $("#kurveUnter").textContent = unter;
}
/* Jeder Kampf-Gegenstand bekommt eine Nummer: ein Filter, der dieselbe Zahl
   Treffer in derselben Zeit laesst (anderer Spieler), baut neue Kaempfe -
   Beginn, Ende und Zahl gleich, der Schaden nicht. Die Nummer haelt sie in
   der Signatur auseinander. Ein Takt ohne Aenderung baut nichts neu. */
const kampfNummern = new WeakMap<Fight, number>();
let kampfZaehler = 0;
function kampfNr(seg: Fight): number {
  let n = kampfNummern.get(seg);
  if(n == null){ n = ++kampfZaehler; kampfNummern.set(seg, n); }
  return n;
}
// der Bezug in der Signatur: welcher Pull, mit welcher Zahl, ob dieser der beste ist
const bezugSig = (info: BestInfo) => [info.refId || "", info.refDps ?? "", info.refAt ?? "", info.isBest ? 1 : 0].join("/");
// die Gesamtkurve des Bezugs wie in 53-fenster.ts (startStand); cmpLauf
// schneidet einen Pull an der Uebungspuppe (segN@60) auf seine Klasse
function bezugKurve(info: BestInfo): number[] | null {
  if(!info.refId || info.why) return null;
  const lauf = cmpLauf(info.refId);
  return lauf && lauf.perSecond && lauf.perSecond.length ? lauf.perSecond : null;
}
/* Die Sekunden einer Faehigkeit: aus perSecond, sonst aus den Treffern mit
   derselben Regel wie perSecond (16-fight-analysis.ts): Sekunde
   floor((t - start)/1000), nach hinten auf die letzte der ps.T Sekunden
   gekappt. Einen Treffer vor dem Beginn legt perSecond auf einen Index
   unter 0 - ausserhalb der Reihe, er zaehlt dort nicht; hier faellt er
   ebenso weg. */
function spurVon(seg: Fight, ps: ReturnType<typeof perSecond>, name: string): {values: number[]; color: string} | null {
  const s = ps.series.find(x => x.name === name);
  if(s) return {values: s.values, color: s.color};
  const sk = seg.stats.skills.find(x => x.name === name);
  if(!sk) return null;
  const v = new Array(ps.T).fill(0);
  for(const e of seg.events) if(e.skill === name){
    const i = Math.min(ps.T - 1, Math.floor((e.t - seg.start) / 1000));
    if(i >= 0) v[i] += e.dmg;
  }
  return {values: v, color: sk.color || ""};
}

/* Das eine Urteil gegen den besten Pull (Spezifikation 4.4), dieselben
   Zahlen wie der Antwortsatz im Vergleich (vergleichZahlen). Kein Bezug:
   der Satz des Urteils aus der Analyse (DECISION 2.20). Kein Rot, kein
   Gruen: die Richtung steht in Worten.
   Wie im Entwurf (Luecken 2.17-2.19): die Schlagzeile ohne Ueberschrift,
   zwei Belege mit Symbol und Name - Beleg 1 die Faehigkeit mit dem
   groessten Abstand in Schaden je Treffer, Beleg 2 die mit dem groessten
   Verlust in Treffern je Minute (urteilZahlen().zweit, darf dieselbe sein);
   darunter der Bezug und was das Log nicht weiss.
   Der billige Schluessel gilt nur mit Bezug: dort haengt das Urteil an
   diesem Kampf und an den zwei Laeufen, und die stehen im Schluessel. Ohne
   Bezug haengt der Satz der Analyse an viel mehr (laeuft Live, welcher
   Spieler, der Pool des Builds fuer das Fenster, 53-fenster.ts) - ein
   Schluessel, der davon etwas vergisst, liess einen alten Satz stehen,
   waehrend die Analyse schon einen anderen sagte. Dort wird darum jedes
   Mal gerechnet (renderAll laeuft nur, wenn sich etwas geaendert hat), und
   der Vergleich des HTML haelt einen gleichen Satz vom Baum fern. Der
   Schluessel wird erst nach einem gelungenen Durchlauf gesetzt: wirft
   cmpLauf oder urteilHtml, versucht es der naechste Aufruf wieder. */
let urteilSchluessel = "", urteilZuletzt = "";
export function renderTafelUrteil(){
  if(!tafelGilt()) return;
  // in der Gruppe zeigt das Band den Anteil je Mitglied, und das Urteil ruht (64, E 11)
  if(state.group === "party") return;
  const seg = state.encounters[state.sel]; if(!seg) return;
  const info = bestInfo();
  const mitBezug = !!info.curId && !!info.refId && !info.why;
  const schluessel = mitBezug ? [state.sel, kampfNr(seg), state.encounters.length, seg.start, seg.end, seg.events.length, bezugSig(info),
                                 info.curId, info.label || "", state.lang, state.noTime ? 1 : 0].join("|") : "";
  if(mitBezug && schluessel === urteilSchluessel) return;
  if(!seg.stats) seg.stats = stats(seg);
  const box = $("#urteilInhalt");
  const cur = mitBezug ? cmpLauf(info.curId!) : null, ref = mitBezug ? cmpLauf(info.refId!) : null;
  let html: string;
  if(!cur || !ref){
    const u = urteilHtml(seg);
    html = '<div class="' + esc(u.klasse) + '">' + u.html + "</div>";
  } else {
    const z = urteilZahlen(ref, cur, cmpKey);
    const tag = info.refAt != null ? pullWhen(info.refAt, state.lang) : "";
    /* Ist dieser der beste, ist der Bezug der staerkste andere Pull, also
       der zweitbeste (pickTarget) - so heisst er auch, wie im Vergleich. */
    const bezug = '<p class="ubezug">' + esc(t(info.isBest ? "tafel.gegenZweit" : "tafel.gegen",
      {boss: info.label, when: tag, dps: fmt(ref.dps)})) + "</p>";
    if(info.isBest){
      html = '<p class="usatz">' + esc(t("tafel.besterPull", {boss: info.label})) + "</p>" + bezug;
    } else if(z.gap >= 0){
      /* Nicht der beste, aber nichts fehlt (an der Puppe rechnen Wahl und
         Vergleich auf verschieden geschnittenen Laeufen): gleichauf, nicht
         "dein bester". */
      html = '<p class="usatz">' + esc(t("tafel.gleichauf", {boss: info.label})) + "</p>" + bezug;
    } else {
      const wo = z.skill ? t("tafel.vorAllem", {skill: skillLabel(z.skill.name, z.skill.sid)}) : t("tafel.verteilt");
      // tafel.fehlen bekommt HTML (<b>) und sonst keinen Text aus Daten; alles andere geht durch esc
      html = '<p class="usatz">' + t("tafel.fehlen", {gap: "<b>" + esc(fmt(-z.gap, 1e3)) + "</b>"}) + esc(wo) + "</p>";
      /* Die zwei Belegzeilen in einem gemeinsamen Raster (styles.css): die
         Bahnen beginnen untereinander, auch wenn die Zahlen rechts
         verschieden breit sind. Ohne zweiten Verlust in Treffern je Minute
         zeigt Beleg 2 dasselbe Mass der ersten Faehigkeit. */
      if(z.skill){
        /* Beleg 1 ist der groesste Verlust je Treffer (Luecke 2.18), Beleg 2
           der in Treffern je Minute; ohne eigenen Verlust zeigt ein Beleg das
           Mass der Faehigkeit aus der Schlagzeile. Die Schlagzeile bleibt am
           DPS-Abstand - dieselbe Zahl wie der Antwortsatz im Vergleich
           (Abweichung vom Entwurf E:397, der sie am ersten Beleg nennt). */
        const erst = z.erst || {skill: z.skill, proTreffer: z.proTreffer};
        const zweit = z.zweit || {skill: z.skill, proMinute: z.proMinute};
        html += '<div class="ubelege">' + beleg(seg, erst.skill, t("tafel.proTreffer"), erst.proTreffer, v => fmt(v, 1e3)) +
          beleg(seg, zweit.skill, t("tafel.proMinute"), zweit.proMinute, v => numN(v, 1)) + "</div>";
      }
      html += bezug + '<p class="ulog">' + esc(t("tafel.logWeiss")) + "</p>";
    }
  }
  /* Nur der Inhalt wird neu geschrieben; die Knoepfe zur Analyse und zum
     Vergleich stehen fest in index.html (tafelBinden, syncBestBtn in 46)
     und behalten so im Live ihren Fokus. */
  if(html !== urteilZuletzt){
    box.innerHTML = html;
    urteilZuletzt = html;
  }
  // nur ein Urteil mit beiden Laeufen darf den naechsten Aufruf abkuerzen
  urteilSchluessel = cur && ref ? schluessel : "";
}
/* Eine Belegzeile: Symbol und Name der Faehigkeit mit dem Mass darunter,
   eine Bahn (dieser Pull als Balken in der Reihenfarbe der Faehigkeit wie
   in der Tafel, der beste als Strich) und die zwei Zahlen. */
function beleg(seg: Fight, a: Abstand, was: string, [dieser, bester]: [number, number], zahl: (v: number) => string){
  const oben = Math.max(dieser, bester) * 1.08 || 1;
  const sk = seg.stats.skills.find(k => k.name === a.name);
  const farbe = (sk && sk.color) || "var(--ink-soft)";
  return '<p class="ubeleg">' + skillMark(a.name, a.sid, farbe) +
    '<span class="ubname"><b>' + esc(skillLabel(a.name, a.sid)) + "</b><small>" + esc(was) + "</small></span>" +
    '<span class="ubahn" aria-hidden="true"><i style="width:' + (100 * dieser / oben).toFixed(1) + "%;--c:" + esc(farbe) + '"></i><b style="left:' +
    (100 * bester / oben).toFixed(1) + '%"></b></span>' +
    '<span class="uwert num">' + esc(t("tafel.stattWert", {dieser: zahl(dieser), bester: zahl(bester)})) + "</span></p>";
}

export function tafelBinden(){
  $("#urteilAnalyse").addEventListener("click", () => switchTab("analysis"));
  $("#zeitAuf").addEventListener("click", () => { state.zeitAuf = !state.zeitAuf; syncTafel(); });
  /* "Zeitverlauf und Rotation" (Aufgabe 10): ein Weg, kein Aufklappen. Der
     Fokus geht auf die Zeitleiste, unter der der Zeitverlauf steht - er
     bliebe sonst auf einem Knopf, den es im Bereich Rotation nicht gibt;
     ohne Block (keine Uhr, keine Faehigkeit) auf den Bereich in der Leiste. */
  $("#spurenAuf").addEventListener("click", () => {
    switchTab("rotation");
    const leiste = $("#deineRotScroll");
    (leiste.closest("[hidden]") ? $('#bereiche [data-tab="rotation"]') : leiste).focus();
  });
  /* Zeigen oder Fokus auf einer Zeile der Tafel legt ihre Spur in die Kurve. */
  const bars = $("#bars");
  const zeige = (el: Element | null) => {
    const z = el ? el.closest<HTMLElement>("[data-skill]") : null;
    const neu = z && bars.contains(z) ? z.dataset.skill! : "";
    if(neu !== state.kurveSkill){ state.kurveSkill = neu; renderKurve(); }
  };
  bars.addEventListener("mouseover", e => zeige(e.target as Element));
  bars.addEventListener("mouseleave", () => zeige(null));
  bars.addEventListener("focusin", e => zeige(e.target as Element));
  bars.addEventListener("focusout", e => { if(!bars.contains(e.relatedTarget as Node)) zeige(null); });
  if(typeof ResizeObserver !== "undefined") new ResizeObserver(() => renderKurve()).observe($("#kurve"));
  /* Das Feld der Tafel aendert seine Hoehe auch ohne neues Fenster (ein
     Satz mehr im Kopf, die Kurve klappt auf): dann neu an einer ganzen
     Zeile schneiden (Feinschliff 02.10., Abschnitt 1). Der Schnitt setzt
     nur die Hoehe der Liste, nicht die des Feldes - keine Schleife. */
  if(typeof ResizeObserver !== "undefined"){
    /* Die Spalte der Liste aendert ihre Hoehe, wenn das Urteil einen Satz
       mehr bekommt: dann neu an einer ganzen Zeile schneiden (ringSchnitt
       in 16). Gesetzt wird dort nur, was sich aendert. */
    const ro = new ResizeObserver(() => {
      if(document.body.classList.contains("tafel")) requestAnimationFrame(() => markiereRest());
    });
    ro.observe($(".table")); ro.observe($("#urteilInhalt"));
  }
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  tafelBinden();
  syncTafel();
}
