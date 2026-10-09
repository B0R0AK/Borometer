import { state } from "./01-state";
import { anzahl, axisNum, dur, fmt } from "./03-helpers";
import { knownBoss } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { bossIcon, skillIcon } from "./12-boss-images";
import { skillLabel } from "./14-questlog-weapons";
import { unverwundbarOf, VENTIUS_ID, VENTIUS_NAME, ventiusMix } from "./15-weapons-and-ventius";
import {
  fightFacts, insights, LIEST_AB_TREFFER, num1, pct, pctMin, pctOf, perSecond, schwaechstesFenster, secs1,
  unverwundbareSekunden, zaehlung
} from "./16-fight-analysis";
import { $, clock, esc } from "./18-interface-basics";
import { rotWindow } from "./25-rotation";
import { switchTab } from "./34-menus-drop-and-tabs";
import { catOf, HIT_CATS } from "./19-grouping-and-party-fights";
import { fensterAbschnitt, fensterStand, inRotationKnopf, nebenzielAnalyse, startZeile, type FensterStand } from "./53-fenster";
import { gedrueckteEinsaetze } from "./54-deine-rotation";
import { mechanikSekunden, mechanikStand, mechanikStempel } from "./61-mechanik";
import { fensterKosten, fensterUrteil, haelften, jeMinute, luecken, schwacheStelle, type Luecken } from "../analyse-core";
import type { CombatEvent, Fight, Insight } from "../types";

/* ---------- analysis ----------
   Seit der Neugestaltung 28.09. wie im Entwurf (Luecken 4): oben das eine
   Urteil (#analysisCall), darunter "Weitere Befunde" als Zeile (#weitere),
   die Form des Kampfes als Saeulen je Sekunde (#verdict), dann in #findings
   die drei Felder "Wer traegt? / Wie triffst du? / Hast du durchgedrueckt?",
   die Ziele (nur bei mehreren), "Hast du im Fenster getroffen?" (DECISION
   4.13) und der Kasten Auge von Ventius mit "je Boss" (DECISION 4.11); ganz
   unten der feste Fuss "Was das Log nicht weiss" (index.html). Luecken
   zaehlen nach dem Median (luecken, ../analyse-core.ts), ihre Definition
   steht als Satz unter der Ueberschrift der Form, darunter die Zeile zur
   erkannten Mechanik des Bosses (61-mechanik.ts); deren Strecke zaehlt
   nicht als Luecke. */
export function renderAnalysis(){
  const seg = state.encounters[state.sel];
  /* Ohne Kampf bleibt nichts stehen. Vorher kehrte diese Zeile nackt um,
     und alles, was die Tafel beim letzten Mal geschrieben hatte, blieb im
     Dokument: nach "Leeren" stand der Urteilskasten mit 179.4k SCHNITT und
     drei Saetzen ueber einen geloeschten Kampf da, waehrend die Leiste
     daneben "Noch keine Kaempfe geladen" sagte. Hier kann das niemand
     umgehen. */
  if(!seg){
    const kasten = $("#verdict"); if(kasten) kasten.hidden = true;
    const urteil = $("#analysisCall"); if(urteil){ urteil.hidden = true; urteil.innerHTML = ""; }
    const weitere = $("#weitere"); if(weitere) weitere.hidden = true;
    const liste = $("#weitereListe"); if(liste) liste.innerHTML = "";
    const befunde = $("#findings"); if(befunde) befunde.innerHTML = "";
    return;
  }
  const f = fightFacts(seg);
  const lk = lueckenStand(seg);

  /* Das Urteil oben und die Befunde darunter aus einer Rechnung
     (urteilHtml); die Tafel im Bereich Kampf zeigt dasselbe Urteil. */
  const u = urteilHtml(seg, true);
  const kasten = $("#analysisCall");
  // das unsichtbare h3 "Urteil" (Issue #109): der Vorleser findet das Feld im Ueberschriftenbaum
  if(kasten){ kasten.hidden = false; kasten.className = u.klasse;
    /* "Zum Beleg" steht am Ende der Erklaerung wie ein Verweis im Satz, nicht
       in einer eigenen Zeile: bei 2000 x 1480 bleibt der Fuss so im Blick. */
    const beleg = u.teuer ? ' <button type="button" class="zubeleg" data-weg="beleg" data-ziel="'+esc(u.teuer)+'">'+esc(t("analysis.zumBeleg"))+"</button>" : "";
    kasten.innerHTML = '<h3 class="vh">'+esc(t("tafel.urteil"))+"</h3>"+u.html.replace(/<\/p>$/, beleg+"</p>")+ganzerKampf(seg); }
  const {gefunden, fenster, teuer} = u;
  wegeBinden();

  renderVerdict(seg, lk);
  renderWeitere(seg, gefunden, teuer, lk);

  const duenn = seg.stats.hits < LIEST_AB_TREFFER;
  let html = duenn ? "" : dreiFelder(seg, gefunden, lk);
  /* Die Ziele nur, wo es wirklich mehr als eines gab - mit Bossbild, wo
     eines bekannt ist, sonst bleibt die Spalte leer und die Zeilen stehen
     trotzdem buendig. Darunter der Satz zu den Nebenzielen. */
  if(f.targetCount >= 2){
    html += '<section class="fsec" aria-labelledby="zieleH"><h3 id="zieleH">'+esc(t("analysis.sec.where"))+"</h3>"+
      '<div class="tsplit"><div class="tsk">'+esc(t("facts.targetsIn",{n:f.targetCount}))+'</div>'+
      f.targets.slice(0,6).map(tg => {
        const bild = bossIcon(tg.name);
        return '<div class="tsrow">'+
          (bild ? '<img src="'+bild+'" alt="" aria-hidden="true">' : "<span></span>")+
          '<span class="tsn">'+esc(tg.name)+'</span>'+
          '<span class="tsbar"><i style="width:'+(100*tg.share).toFixed(1)+'%"></i></span>'+
          '<span class="tsv">'+pctMin(tg.share, 0)+'</span></div>';
      }).join("")+nebenzielAnalyse(seg)+"</div></section>";
  }
  // Wann der Hauptschaden landete (Issue #45): ein Feld unter den dreien (DECISION 4.13)
  if(fenster) html += '<section class="fsec" aria-labelledby="fensterH"><h3 id="fensterH">'+esc(t("analysis.sec.window"))+"</h3>"+
    fensterAbschnitt(fenster, teuer === "window")+"</section>";
  html += ventiusBlock(seg, gefunden, teuer === "ventiusPos");
  $("#findings").innerHTML = html;
  formFuellen();
}

/* ---------- die Form im grossen Fenster (Issue #110) ----------
   Ab 1200 Punkt Fensterhoehe nimmt die Form den Platz, der da ist: sie
   waechst in das, was unter dem Fuss frei bliebe (im Mechanik-Fall blieben
   bei 2000 x 1480 sonst etwa 650 Punkt leer), hoechstens auf FORM_MAX, und
   gibt nach, wo der Fuss sonst unter die Statusleiste rutschte, hoechstens
   bis FORM_MIN (gewuenscht: "Was das Log nicht weiss" ohne Rollen bei
   2000 x 1480). Die Saeulen sind ein SVG ohne festes Seitenverhaeltnis, sie
   folgen ohne neues Zeichnen; renderAnalysis laeuft bei jeder Fenstergroesse. */
const FORM_MIN = 112, FORM_MAX = 320, FORM_AB_H = 1200;
function formFuellen(){
  const box = $("#saeulen"), fuss = $("#afuss"), leiste = $("#statusleiste");
  if(!box) return;
  box.style.height = "";
  const hoch = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--winh")) || innerHeight;
  if(hoch < FORM_AB_H || !fuss || !leiste || !box.getClientRects().length) return;
  const frei = leiste.getBoundingClientRect().top - fuss.getBoundingClientRect().bottom - 8;
  const jetzt = box.getBoundingClientRect().height;
  const soll = Math.max(FORM_MIN, Math.min(FORM_MAX, jetzt + frei));
  if(Math.abs(soll - jetzt) >= 1) box.style.height = soll.toFixed(0) + "px";
}

/* ---------- die Luecken nach dem Median ----------
   Einmal je Kampf gerechnet (das Urteil, die Form, die Befunde und "Hast du
   durchgedrueckt?" lesen dieselben); unter Live waechst der Kampf, darum
   haengt der Merker an Ende und Zahl der Treffer. Ohne Uhr gibt es keine
   Sekunden und damit keine Luecken. Eine erkannte Mechanik des Bosses
   (61-mechanik.ts) ist wie eine Unverwundbarkeit keine Luecke und zaehlt
   nicht zum Median; sie haengt an den anderen geladenen Pulls und steht
   darum mit im Merker. */
type LueckenStand = Luecken & { T: number; sek: number[] };
const lueckenMerk = new WeakMap<Fight, { stempel: string; l: LueckenStand }>();
function lueckenStand(seg: Fight): LueckenStand | null {
  if(state.noTime || !seg.stats.seconds) return null;
  const stempel = seg.end + "|" + seg.events.length + "|" + (seg.unverwundbar || []).length + "|" + mechanikStempel(seg);
  const alt = lueckenMerk.get(seg);
  if(alt && alt.stempel === stempel) return alt.l;
  const ps = perSecond(seg, 0);
  const mech = mechanikSekunden(seg, ps.T);
  const l = {...luecken(ps.total, unverwundbareSekunden(seg, ps.T).map((x, i) => x || mech[i]!)), T: ps.T, sek: ps.total};
  lueckenMerk.set(seg, {stempel, l});
  return l;
}

/* ---------- Weitere Befunde ----------
   Eine Zeile unter dem Urteil (Entwurf, "Weitere Befunde"): die Luecken, der
   groesste Treffer (DECISION 2.3 - er stand im Kampf in der Werteleiste),
   die Fehlschlaege und die Einsaetze je Minute, dazu der Rhythmus verdichtet
   (DECISION 4.14): die Art der Skillung, die schwaechste Stelle, der Start
   und, wo es sie gab, Einsaetze ins unverwundbare Ziel. Eine Liste aus
   Begriff und Wert, darunter sichtbar der erklaerende Satz (Pruefung
   29.09.: im title erreichten ihn weder Tastatur noch Vorleser).
   Unter der Schwelle nur die Zaehlungen. */
function renderWeitere(seg: Fight, gefunden: Insight[], teuer: string, lk: LueckenStand | null){
  const box = $("#weitere"), liste = $("#weitereListe");
  if(!box || !liste) return;
  box.hidden = false;
  const s = seg.stats;
  const hol = (k: string) => gefunden.find(x => x.key === k);
  // data-k benennt den Eintrag; zaehlt traegt er, wenn das Urteil oben ihn nennt (der Schluessel des Kandidaten)
  const eintrag = (k: string, dt: string, v: string, n = "", kandidat = k, weg = "") =>
    '<div class="find'+(teuer === kandidat ? " zaehlt" : "")+'" data-k="'+k+'">'+
    '<dt class="k">'+esc(dt)+'</dt><dd class="v">'+esc(v)+"</dd>"+(n ? '<dd class="n">'+esc(n)+"</dd>" : "")+weg+"</div>";
  let h = "";
  const zaehl = hol("thinCounts");
  if(zaehl){
    liste.innerHTML = eintrag("gezaehlt", t("insight.thinCounts.label"), t("insight.thinCounts.value", zaehl.vars), t("insight.thinCounts.note", zaehl.vars));
    return;
  }
  // die laengste Luecke in der Rotation (Issue #107)
  if(lk) h += eintrag("luecken", t("analysis.wb.luecken"), lk.luecken.length ? String(lk.luecken.length) : t("analysis.wb.keine"),
    lk.luecken.length ? t("analysis.wb.lueckenSumme", {s: lk.summe + "\u00a0s"}) : "", "luecken",
    lk.laengste ? inRotationKnopf(lk.laengste[0], lk.laengste[1], "analysis.inRotation.luecke") : "");
  /* Die erkannte Mechanik steht nicht hier, sondern einmal als Zeile an der
     Form, neben ihrem Band (Issue #106, Entscheidung vom 04.10.2026; vorher
     zusaetzlich als Eintrag "Mechanik", Feinschliff 02.10.). */
  if(s.max > 0){
    // die Faehigkeit mit dem groessten einzelnen Treffer, ihr Name in der Sprache der Seite
    const e = seg.events.reduce<CombatEvent | null>((a, x) => !a || x.dmg > a.dmg ? x : a, null);
    h += eintrag("groesster", t("analysis.wb.groesster"), fmt(s.max) + (e ? " \u00b7 " + skillLabel(e.skill, e.sid) : ""));
  }
  const fehl = hol("missed");
  h += eintrag("fehl", t("insight.missed.label"), fehl
    ? t("analysis.wb.fehl", {n: anzahl(fehl.vars.n), share: fehl.vars.share,
        skill: fehl.vars.sid ? skillLabel(fehl.vars.skill, fehl.vars.sid) : fehl.vars.skill})
    : t("analysis.wb.keine"), fehl ? t("insight.missed.note", {...fehl.vars,
        skill: fehl.vars.sid ? skillLabel(fehl.vars.skill, fehl.vars.sid) : fehl.vars.skill}) : "", "missed");
  const ein = lk ? jeMinute(gedrueckteEinsaetze(seg), s.seconds, lk.summe) : null;
  if(ein && ein.mit != null) h += eintrag("jeMinute", t("analysis.wb.jeMinute"), num1(ein.mit));
  const art = hol("consistency");
  if(art) h += eintrag("skillung", t("insight.consistency.label"), t("insight.consistency.value", art.vars), t("insight.consistency.note", art.vars));
  /* Nur eine wirklich schwache Stelle (Issue #105): dieselbe Grenze wie im
     Urteil, unter dem halben Median. Sonst stand hier "Pruefe ..." bei einer
     Stelle auf dem Median. */
  const schwach = hol("weakestWindow"), stelle = schwach && lk ? schwaechstesFenster(seg) : null;
  if(schwach && stelle && lk && schwacheStelle(stelle.dps, lk.median)){
    const v = {...schwach.vars, drove: schwach.vars.drove ? skillLabel(schwach.vars.drove, schwach.vars.droveSid) : ""};
    h += eintrag("schwach", t("insight.weakestWindow.label"), t("insight.weakestWindow.value", v), t("insight.weakestWindow.note", v), "weakestWindow",
      inRotationKnopf(stelle.von, stelle.bis, "analysis.inRotation.schwach"));
  }
  if(!state.noTime) h += startZeile(seg);
  const unv = hol("invulnCasts");
  if(unv){
    const v = {...unv.vars, teile: (unv.vars.teile as { skill: string; sid: string; n: number }[])
      .map(x => ({...x, skill: skillLabel(x.skill, x.sid)}))};
    h += eintrag("unverwundbar", t("insight.invulnCasts.label"), t("insight.invulnCasts.value", v), t("insight.invulnCasts.note", v));
  }
  liste.innerHTML = h;
}

/* ---------- Wege vom Urteil zum Beleg und in die Rotation (Issue #107) ----------
   Die Analyse war eine reine Leseflaeche: kein fokussierbares Element, und
   "steht unter Rotation" war Text, kein Weg. Jetzt:
   - "Zum Beleg" unter dem Urteil rollt zum Feld, das es belegt, und setzt
     den Fokus darauf;
   - "In der Rotation zeigen" an der laengsten Luecke, der schwaechsten
     Stelle und dem schwachen Start setzt Von/bis der Rotation auf die
     Strecke (2 s Rand) und oeffnet sie, der Fokus geht auf die Zeitleiste;
   - ist dort ein Von/bis gesetzt, sagt die Analyse, dass sie trotzdem den
     ganzen Kampf liest.
   Die Klicks laufen ueber einen Hoerer am Panel (data-weg), denn der Inhalt
   wird bei jedem Zeichnen neu geschrieben. Den Knopf in die Rotation baut
   inRotationKnopf (53-fenster.ts), der Start-Eintrag dort braucht ihn auch. */
const RAND_S = 2;
/* Wohin "Zum Beleg" fuehrt: das Feld, aus dem der teuerste Kandidat kommt. */
const BELEG: Record<string, string> = {
  luecken: "#verdict",
  weakestWindow: '#weitereListe .find[data-k="schwach"]',
  missed: '#weitereListe .find[data-k="fehl"]',
  ventiusPos: "#findings .vfeld",
  window: "#findings .fsec:has(#fensterH)",
};
function ganzerKampf(seg: Fight): string {
  if(state.rotSegStart !== seg.start || (state.rotFrom == null && state.rotTo == null)) return "";
  const T = seg.stats.seconds || 0;
  const a = Math.max(0, state.rotFrom ?? 0), b = Math.min(T, state.rotTo ?? T);
  return '<p class="ganz">'+esc(t("analysis.ganzerKampf", {z: clock(a)+"\u2013"+clock(b)}))+"</p>";
}
function zurRotation(){
  switchTab("rotation");
  // wie "Zeitverlauf und Rotation" im Kampf (56-tafel.ts): der Fokus auf die Zeitleiste, ohne sie auf den Bereich
  const leiste = $("#deineRotScroll");
  (leiste && !leiste.closest("[hidden]") ? leiste : $('#bereiche [data-tab="rotation"]')).focus();
}
let wegeGebunden = false;
function wegeBinden(){
  const panel = $("#p-analysis");
  if(wegeGebunden || !panel) return;
  wegeGebunden = true;
  panel.addEventListener("click", (e: MouseEvent) => {
    const k = (e.target as HTMLElement).closest<HTMLElement>("[data-weg]");
    if(!k || !panel.contains(k)) return;
    const seg = state.encounters[state.sel];
    if(k.dataset.weg === "beleg"){
      const ziel = panel.querySelector<HTMLElement>(BELEG[k.dataset.ziel || ""] || "");
      if(!ziel) return;
      if(ziel.tabIndex < 0) ziel.tabIndex = -1;
      const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
      ziel.scrollIntoView({block: "center", behavior: ruhig ? "auto" : "smooth"});
      ziel.focus({preventScroll: true});
      return;
    }
    if(!seg) return;
    if(k.dataset.weg === "rot"){
      const {T} = rotWindow(seg);   // setzt Von/bis zurueck, wenn sie zu einem anderen Kampf gehoerten
      state.rotFrom = Math.max(0, Number(k.dataset.von) - RAND_S);
      state.rotTo = Math.min(T, Number(k.dataset.bis) + RAND_S);
    }
    zurRotation();
  });
}

/* ---------- die drei Felder ----------
   Wer traegt? Wie triffst du? Hast du durchgedrueckt? (Entwurf) - je eine
   Antwort als Satz und darunter leise, woraus sie kommt. Die Treffer-Details
   (Krit-Anteil am Schaden, starke Treffer, Schild) stehen unter "Wie triffst
   du?" (DECISION 4.14). */
function dreiFelder(seg: Fight, gefunden: Insight[], lk: LueckenStand | null): string {
  const s = seg.stats;
  const hol = (k: string) => gefunden.find(x => x.key === k);
  const sidOf = new Map<string, string>();
  for(const e of seg.events) if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);
  const feld = (id: string, titel: string, inhalt: string) =>
    '<section id="'+id+'" aria-labelledby="'+id+'H"><h3 id="'+id+'H">'+esc(t(titel))+"</h3>"+inhalt+"</section>";
  // Wer traegt?
  const [erst, zweit] = s.skills;
  let d1 = "";
  if(erst && s.total > 0){
    const name = skillLabel(erst.name, sidOf.get(erst.name));
    d1 = '<p class="ant">'+t("analysis.d1.ant", {skill: "<b>"+esc(name)+"</b>", p: esc(pct(erst.damage/s.total, 1))})+"</p>"+
      '<p class="fein">'+esc(t("analysis.d1.leise", {n: anzahl(erst.hits), c: pct(erst.hits ? erst.crit/erst.hits : 0),
        h: pct(erst.hits ? erst.heavy/erst.hits : 0),
        zweit: zweit ? skillLabel(zweit.name, sidOf.get(zweit.name)) : "", p2: zweit ? pct(zweit.damage/s.total, 1) : ""}))+"</p>";
    const k = hol("concentration");
    if(k && k.vars.big) d1 += '<p class="fein">'+esc(t("insight.concentration.note", {...k.vars,
      skill2: k.vars.skill2 ? skillLabel(k.vars.skill2, k.vars.skill2Sid) : ""}))+"</p>";
  }
  // Wie triffst du? - die vier Trefferarten (und Schild) als geteilter Balken
  const zahl = new Map<string, number>();
  for(const e of seg.events){ const k = catOf(e); zahl.set(k, (zahl.get(k) || 0) + 1); }
  const N = seg.events.length || 1;
  const arten = HIT_CATS.filter(k => zahl.get(k));
  let d2 = '<p class="ant">'+esc(t("analysis.d2.ant", {c: pct(s.hits ? s.crit/s.hits : 0), h: pct(s.hits ? s.heavy/s.hits : 0)}))+"</p>"+
    '<div class="stapel" aria-hidden="true">'+arten.map(k => '<i data-art="'+k+'" class="art-'+k+'" style="width:'+
      (100*zahl.get(k)!/N).toFixed(2)+'%"></i>').join("")+"</div>"+
    '<div class="lg">'+arten.map(k => '<span><i class="art-'+k+'"></i>'+esc(t("analysis.art."+k)+" "+pct(zahl.get(k)!/N))+"</span>").join("")+"</div>";
  const krit = hol("critContribution"), stark = hol("heavyHits"), schild = hol("shield");
  const leise: string[] = [];
  if(krit && s.crit > 0) leise.push(t("analysis.critSum", {pct: pctOf(Number(krit.vars.share), 0)}));
  if(stark) leise.push(t("insight.heavyHits.note", stark.vars));
  if(schild) leise.push(t("insight.shield.label") + ": " + t("insight.shield.value", schild.vars) + ". " + t("insight.shield.note", {...schild.vars,
    skill: schild.vars.skill ? skillLabel(schild.vars.skill, schild.vars.sid) : ""}));
  if(leise.length) d2 += '<p class="fein">'+esc(leise.join(" "))+"</p>";
  // Hast du durchgedrueckt? - dieselben Einsaetze wie die Zeitleiste der Rotation
  let d3 = "";
  if(lk){
    const n = gedrueckteEinsaetze(seg), r = jeMinute(n, s.seconds, lk.summe);
    d3 = '<p class="ant">'+esc(t("analysis.d3.ant", {n: anzahl(n), dauer: dur(s.seconds)}))+"</p>"+
      /* "ohne die Luecken / mit ihnen" nur, wenn es Luecken gab (Issue #106);
         dahinter der Weg zur Folge in der Rotation statt eines Satzes (Issue #107) */
      '<p class="fein">'+(r.mit != null ? esc(lk.summe > 0
        ? t("analysis.d3.leise", {ohne: r.ohne != null ? num1(r.ohne) : "\u2013", mit: num1(r.mit)})
        : t("analysis.d3.leiseOhne", {mit: num1(r.mit)}))+" " : "")+
      '<button type="button" class="inrot" data-weg="folge">'+esc(t("analysis.folgeRotation"))+"</button></p>";
  }
  return '<div class="drei" id="drei">'+feld("dTraegt", "analysis.d1", d1)+feld("dWie", "analysis.d2", d2)+
    (d3 ? feld("dDurch", "analysis.d3", d3) : "")+"</div>";
}

/* ---------- das eine Urteil oben ----------
   Die Befunde darunter stehen gleichrangig, jeder beantwortet seine Frage.
   Welcher davon am meisten gekostet hat, sagte keiner - und alle Antworten
   gluehten gleich. Hier wird jeder Befund, der einen vermeidbaren Verlust
   beschreibt, in dieselbe Einheit gerechnet (Schaden), und der groesste
   steht oben. Gold traegt danach nur noch dieses Urteil und der Befund,
   den es nennt; alles andere steht in Textfarbe.

   Die Rangfolge ist die Groesse des geschaetzten Verlusts, nichts sonst.
   Geschaetzt wird jeweils vorsichtig, mit dem kleineren Wert, wo es zwei
   gibt:
   - Leerzeit (Neugestaltung 28.09., Luecken 4.3): die Sekunden der Luecken
     nach dem Median mal dem Median der Sekunden mit Treffern - der
     gewoehnlichen Sekunde, gegen die eine Luecke gemessen ist (luecken,
     ../analyse-core.ts). Vorher: Sekunden ohne Treffer mal Schnitt.
   - Schwaechste Stelle: drei Sekunden gegen drei GEWOEHNLICHE Sekunden
     dieses Kampfes (das mittlere gueltige Fenster), nicht gegen den
     Schnitt. Ein Burst-Build liegt fast ueberall unter seinem Schnitt;
     gegen ihn gemessen waere jede ruhige Stelle ein Verlust.
   - Fehlschlaege: jeder mit dem Schnitt eines Treffers derselben
     Faehigkeit bewertet - die Faehigkeit, die daneben ging, nicht der
     Kampf.
   - Ventius-Position: die fehlenden Treffer mit dem kleineren der beiden
     Trefferwerte des Kastens (die untere Grenze von "etwa ... bis ...").
   - Fenster nach einem Skill (Issue #45): der Schaden des Hauptschadens
     ausserhalb mal (Staerke im Fenster / Staerke ausserhalb - 1), mit den
     Staerken DIESES Kampfes, wenn beide Seiten genug Treffer haben, sonst
     mit denen des Builds; nie negativ. Nur ab 20 % ausserhalb - darunter
     haengt der Anteil kaum mit der DPS zusammen. Vorsicht wie bei der
     Position: der Abstand der Staerken ist gemessen, aber nicht allein dem
     Fenster zuzuschreiben, und das Fenster ist zeitlich gelesen, nicht je
     Ziel.
   Nicht dabei: Treffer auf Unverwundbare - das ist Mechanik, kein
   Verlust (Issue #37); sie haben ihr Band im Zeitverlauf und hoechstens
   einen leisen Befund. Auch nicht: Schild (wird nicht abgezogen), Krits, starke Treffer,
   groesster Treffer, Konzentration, Skillungsart - das sind Eigenschaften
   eines Kampfes, keine Verluste.

   Unter 2 % des Schadens ist nichts nennenswert: dann sagt der Satz das,
   statt ein Problem zu erfinden. Gleichstand entscheidet die Reihenfolge
   der Liste unten (Leerzeit vor Position vor Fenster vor Stelle vor
   Fehlschlag). */
const URTEIL_AB = 0.02;
/* Was ohne Uhr uebrig bleibt. Die Schwankung und das schwaechste Fenster
   kommen aus Sekunden; wie konzentriert der Schaden faellt und was die
   Krits beigetragen haben, braucht keine.
   "missed" ist eine Zaehlung von Zeilen, keine Rate ueber Zeit - das haelt
   auf einem Log ohne Uhr genauso wie die Schildzahl. */
const CLOCKLESS = ["concentration","critContribution","shield","ventiusPos","missed",
                   "heavyHits"];
/** Das Urteil als HTML mit seiner Klasse, dazu die Befunde, aus denen es
    kommt. renderAnalysis schreibt es nach #analysisCall, die Kampf-Tafel
    (56-tafel.ts) ohne besten Pull in ihr Urteilsfeld - ein Weg, eine Zahl. */
export function urteilHtml(seg: Fight, mitForm = false): { html: string; klasse: string; teuer: string;
                                          gefunden: Insight[]; fenster: FensterStand | null } {
  /* Unter der Schwelle des Kopfes nur die Zaehlungen - dieselbe Grenze,
     an der der Kopf "zu wenig" sagt. */
  const gefunden = seg.stats.hits < LIEST_AB_TREFFER ? [zaehlung(seg)]
    : insights(seg).filter(f => !state.noTime || CLOCKLESS.includes(f.key));
  /* Das Fenster nach einem Skill (Issue #45): gesucht ueber die Pulls
     desselben Builds, nur, wo es eines gibt - sonst entfaellt die Frage ganz. */
  const fenster = seg.stats.hits < LIEST_AB_TREFFER ? null : fensterStand(seg);
  return {...urteilRechnen(seg, gefunden, fenster, mitForm), gefunden, fenster};
}

/* mitForm: nur die Analyse selbst - dort steht die Form mit der Linie des
   Medians darunter, und die Erklaerung der Leerzeit verweist auf sie
   (Entwurf, Pruefung Befund 9). Die Tafel im Kampf hat keine Saeulen. */
function urteilRechnen(seg: Fight, gefunden: Insight[], fenster: FensterStand | null, mitForm = false): { html: string; klasse: string; teuer: string }{
  const s = seg.stats, gesamt = s.total || 0;
  /* Zu duenn: kein Urteil, nur die Schwelle - ruhig, in Textfarbe. */
  if(s.hits < LIEST_AB_TREFFER)
    return {klasse: "urteil ruhig", teuer: "",
            html: '<p class="uv">'+esc(t("analysis.call.thin", {n: anzahl(s.hits), min: LIEST_AB_TREFFER}))+"</p>"};
  const hat = (k: string) => gefunden.some(f => f.key === k);
  // note: ein eigener Erklaersatz statt "analysis.call.<art>.note" (das Fenster gegen den Bezug)
  const kandidaten: { key: string; art: string; verlust: number; note?: string; vars: Record<string, unknown> }[] = [];
  /* Die Form des Entwurfs (DECISION 4.2): "18 Sekunden ohne Treffer",
     gemessen an der gewoehnlichen Sekunde, mit der laengsten Luecke. */
  const lk = lueckenStand(seg);
  if(lk && lk.summe > 0 && lk.laengste)
    kandidaten.push({key:"luecken", art:"leer", verlust: lk.summe*lk.median, vars:{n: lk.summe, med: fmt(lk.median, 1e3),
      zeit: pct(lk.summe/(s.seconds || lk.T), 0), von: clock(lk.laengste[0]), bis: clock(lk.laengste[1])}});
  if(hat("ventiusPos")){
    const v = ventiusFehlend(seg);
    if(v) kandidaten.push({key:"ventiusPos", art:"ventius", verlust: v.von,
      vars:{n: v.fehlen, skill: skillLabel(VENTIUS_NAME, VENTIUS_ID)}});
  }
  /* Gegen den Bezugspull, wo er das Fenster kennt (Issue #108): dann zaehlt
     nur der Anteil ausserhalb, der ueber seinem liegt, und der Satz nennt
     ihn. Ohne Bezug gegen alles im Fenster, und der Satz sagt das. */
  const bezugAussen = fenster && fenster.bezug ? fenster.bezug.aussen : null;
  if(fenster && fensterUrteil(fenster.werte, gesamt, URTEIL_AB, bezugAussen)){
    const w = fenster.werte;
    kandidaten.push({key:"window", art:"window", verlust: fensterKosten(w, bezugAussen), note: bezugAussen == null ? "" : "noteRef",
      vars:{h: fenster.hName, f: fenster.fName, p: pct(w.aussen), out: fmt(w.kAus), in: fmt(w.kIn),
        q: bezugAussen == null ? "" : pct(bezugAussen), zweit: fenster.zweit}});
  }
  /* Die schwaechste Stelle misst mit demselben Massstab wie die Leerzeit:
     jede ihrer Sekunden gegen den Median der Sekunden mit Treffern, so
     erklaert ein Satz beide (Entscheidung vom 29.09. (an Claude
     uebertragen)). Vorher gegen das mittlere Dreisekundenfenster (typ), das
     bei einem Burst-Build ein Vielfaches davon ist - dann verlor die
     Leerzeit fast immer gegen die Stelle direkt daneben. */
  if(hat("weakestWindow") && lk && lk.median > 0){
    const w = schwaechstesFenster(seg);
    // dieselbe Grenze wie der Eintrag unter "Weitere Befunde" (Issue #105)
    if(w && schwacheStelle(w.dps, lk.median)) kandidaten.push({key:"weakestWindow", art:"weak",
      verlust: (lk.median - w.dps)*(w.bis - w.von),
      vars:{from: clock(w.von), to: clock(w.bis), med: fmt(lk.median, 1e3)}});
  }
  if(hat("missed") && seg.missSkills){
    const namen = [...seg.missSkills.keys()];
    let dmg = 0, zeilen = 0;
    for(const e of seg.events) if(namen.includes(e.skill)){ dmg += e.dmg; zeilen++; }
    const eins = namen.length === 1;
    if(zeilen) kandidaten.push({key:"missed", art:"missed", verlust: (seg.missed || 0)*dmg/zeilen,
      vars:{n: seg.missed, eins, skill: eins ? skillLabel(namen[0]!, seg.missSkills.get(namen[0]!)!.sid) : namen.join(" · ")}});
  }

  // stabil sortiert: bei Gleichstand bleibt die Reihenfolge von oben
  const erst = kandidaten.sort((a,b) => b.verlust - a.verlust)[0];
  if(!erst || !gesamt || erst.verlust < URTEIL_AB*gesamt){
    /* Ohne Behauptung ueber "die Befunde unten": oft gibt es gar keinen,
       der einen Verlust beschreibt (keine Leerzeit, keine Fehlschlaege),
       und dann waere "keiner ist mehr wert als 2 %" eine Aussage ueber
       nichts. */
    return {klasse: "urteil ruhig", teuer: "", html: '<p class="uv">'+esc(t("analysis.call.nothing"))+"</p>"};
  }
  const vars = Object.assign({dmg: fmt(erst.verlust), pct: pct(erst.verlust/gesamt, 0)}, erst.vars);
  /* "Das kostet dich am meisten:" eroeffnet die Erklaerung wie im Entwurf -
     keine eigene kleine Zeile ueber der Schlagzeile (Pruefung Befund 3). */
  const note = t("analysis.call."+erst.art+"."+(erst.note || (mitForm && erst.art === "leer" ? "noteForm" : "note")), vars);
  return {klasse: "urteil", teuer: erst.key,
    html: '<p class="uv">'+esc(t("analysis.call."+erst.art+".value", vars))+"</p>"+
      '<p class="un">'+esc(t("analysis.call.label")+" "+note)+"</p>"};
}

/* ---------- Form des Kampfes ----------
   Eine Saeule je Sekunde (Entwurf, Luecken 4.5): dieselben Sekundenwerte wie
   im Zeitverlauf, ungeglaettet, gemessen an der hoechsten Sekunde. Dahinter
   die Luecken nach dem Median (rot hinterlegt, mit ihrer Dauer in ganzen
   Sekunden, wo Platz ist - Entscheidung vom 29.09., an Claude
   uebertragen: eine Luecke besteht aus ganzen Sekunden) und die Strecken, in denen das Ziel unverwundbar
   war (ruhig, nicht rot, #37); gestrichelt der Median der Sekunden mit Treffern - die
   gewoehnliche Sekunde, an der eine Luecke gemessen ist. Die Definition
   steht als Satz darueber (so gewuenscht: Luecken zaehlen nach dem Median, und
   ihre Definition steht dabei). Darunter der Satz ueber die Haelften, den
   Krit-Anteil und einen deutlich schwaecheren Start. Die Saeulen sind ein
   SVG, das mit dem Feld waechst; die Hoehe steht im Blatt und waechst mit
   der Fensterhoehe (grosse Fenster nutzen die Hoehe). */
function renderVerdict(seg: Fight, lk: LueckenStand | null){
  const kasten = $("#verdict");
  const s = seg.stats;
  if(!lk){ kasten.hidden = true; return; }
  kasten.hidden = false;

  /* Die Haelften ohne die Sekunden, in denen das Ziel unverwundbar war
     (Issue #37): eine Phase, in der nichts landen kann, machte sonst die
     Haelfte, in der sie liegt, zur schwachen. Ebenso die Sekunden einer
     erkannten Mechanik (Pruefung 01.10., M1): sonst wertete der Vergleich
     genau die Strecke, die die Zeile darueber ausnimmt. */
  const mech = mechanikSekunden(seg, lk.T);
  const aus = unverwundbareSekunden(seg, lk.T).map((x, i) => x || mech[i]!);
  const sek: number[] = [];
  for(let i=0;i<lk.T;i++) if(!aus[i]) sek.push(lk.sek[i]!);
  const teile = [];
  /* Unter der Schwelle kein Haelftenvergleich; darueber nur, wenn eine
     Haelfte deutlich staerker war (haelften, ab dem 1,15-fachen, Issue #106).
     Der Krit-Anteil steht nur unter "Wie triffst du?", der Start nur unter
     "Weitere Befunde" - jede Zahl einmal (Issue #106). */
  const h = s.hits < LIEST_AB_TREFFER ? null : haelften(sek);
  if(h) teile.push(t(h.staerker === "zweite" ? "analysis.halfUp" : "analysis.halfDown", {
    strong: axisNum(Math.max(h.erste, h.zweite)), x: num1(h.x)
  }));
  const text = $("#verdictText");
  text.textContent = teile.join(" ");
  text.hidden = !teile.length;
  $("#lueckeDef").textContent = t("analysis.lueckeDef");
  mechanikZeile(seg);
  zeichneForm(seg, lk);
}
function zeichneForm(seg: Fight, lk: LueckenStand){
  const box = $("#saeulen"); if(!box) return;
  const T = lk.T, hoch = Math.max(1, ...lk.sek);
  const breite = box.clientWidth || 600;
  /* Zwischen den Saeulen 2 Punkt Luft, wo sie breit genug sind, 1 Punkt bei
     schmalen, keine bei sehr langen Kaempfen - eine Saeule bleibt eine Sekunde. */
  const px = breite/T, luft = px > 8 ? 2 : px > 3 ? 1 : 0;
  const w = Math.max(0.05, 1 - luft/px);
  const zahl = (x: number) => +x.toFixed(3);
  let saeulen = "";
  for(let i=0;i<T;i++){
    const h = zahl(100*lk.sek[i]!/hoch);
    if(h > 0) saeulen += '<rect x="'+zahl(i + (1-w)/2)+'" width="'+zahl(w)+'" y="'+zahl(100-h)+'" height="'+h+'"></rect>';
    else saeulen += '<rect x="'+zahl(i + (1-w)/2)+'" width="'+zahl(w)+'" y="100" height="0"></rect>';
  }
  const lage = (von: number, bis: number) => 'left:'+(100*von/T).toFixed(3)+'%;width:'+(100*(bis-von)/T).toFixed(3)+'%';
  const zonen = lk.luecken.map(([a, b]) => '<span class="gapz" data-zeit="'+esc(clock(a)+"\u2013"+clock(b))+'" style="'+lage(a, b)+'">'+
    (px*(b-a) >= 46 ? '<span class="vgap">'+esc((b-a)+"\u00a0s")+"</span>" : "")+"</span>").join("");
  /* Die Strecken, in denen das Ziel unverwundbar war, mit dem, was sie sind
     ("Ziel unverwundbar \u00b7 38,0 s", Issue #37). Passt der Satz nicht ins
     Band, steht nur die Zahl; passt auch die nicht, nichts. */
  const unverwundbar = unverwundbarOf(seg);
  const invz = unverwundbar.map(g => {
    const breit = px*(g.to - g.from);
    const wort = breit >= 190 ? t("timeline.invulnLen", {s: secs1(g.len)}) : secs1(g.len);
    return '<span class="invz" style="'+lage(g.from, Math.min(T, g.to))+'">'+(breit >= 46 ? '<span class="vgap">'+esc(wort)+"</span>" : "")+"</span>";
  }).join("");
  /* Die erkannte Mechanik dieses Pulls (Spezifikation Mechanik 3): schraffiert
     im Ton des Unverwundbar-Bandes, mit ihrem Wort, wo Platz ist. */
  const mst = mechanikStand(seg);
  const mech = mst ? mst.liste.flatMap(x => x.strecken) : [];
  const mechz = mech.map(g => {
    const breit = px*(g.bis - g.von), s = (g.bis - g.von)+"\u00a0s";
    const wort = breit >= 150 ? t("mechanik.band", {s}) : s;
    return '<span class="mechz" data-zeit="'+esc(clock(g.von)+"\u2013"+clock(g.bis))+'" style="'+lage(g.von, Math.min(T, g.bis))+'">'+
      (breit >= 46 ? '<span class="vgap">'+esc(wort)+"</span>" : "")+"</span>";
  }).join("");
  const med = lk.median > 0 ? '<span class="med" style="bottom:'+(100*lk.median/hoch).toFixed(3)+'%"></span>' : "";
  box.innerHTML = zonen + invz + mechz +
    '<svg viewBox="0 0 '+T+' 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g class="sbalken">'+saeulen+"</g></svg>" + med;
  const zeiten = lk.luecken.map(([a, b]) => clock(a)+"\u2013"+clock(b));
  /* Die Beschreibung nennt alles, was im Bild steht (Issue #109): auch die
     Strecken, in denen das Ziel unverwundbar war, und die erkannte Mechanik. */
  const strecke = (von: number, bis: number) => clock(von)+"\u2013"+clock(bis);
  box.setAttribute("aria-label", t("analysis.saeulenLabel", {dauer: dur(seg.stats.seconds), n: lk.luecken.length, liste: zeiten.join(", "),
    unv: unverwundbar.map(g => strecke(g.from, Math.min(T, g.to))).join(", "),
    mech: mech.map(g => strecke(g.von, Math.min(T, g.bis))).join(", ")}));
  /* Die Legende nennt, was gezeichnet wurde, und sonst nichts. */
  const legS = $("#vlegAvg"); if(legS) legS.hidden = !med;
  const legSText = $("#vlegAvgText"); if(legSText) legSText.textContent = t("analysis.legendMedian", {x: fmt(lk.median, 1e3)});
  const legP = $("#vlegGap"); if(legP) legP.hidden = !lk.luecken.length;
  const legU = $("#vlegInvuln"); if(legU) legU.hidden = !unverwundbar.length;
  const legM = $("#vlegMech"); if(legM) legM.hidden = !mech.length;
  // die Zeitachse: runde Marken ueber die ganze Dauer, hoechstens sieben
  const achse = $("#formAchse");
  if(achse){
    const schritt = [10, 15, 20, 30, 60, 120, 300, 600].find(x => T/x <= 6) || 1200;
    let h = "";
    for(let x = 0; x <= T; x += schritt){
      const q = x/T;
      h += '<span style="left:'+(100*q).toFixed(3)+'%"'+(q === 0 ? ' class="a0"' : q > 0.96 ? ' class="a1"' : "")+">"+esc(clock(x))+"</span>";
    }
    achse.innerHTML = h;
  }
}

/* ---------- die Zeile zur Mechanik ----------
   Spezifikation Mechanik 3: eine kleine, neutrale Zeile unter der
   Definition der Luecke - was der Boss in deinen geladenen Pulls wiederholt
   tut, und, wenn die Strecke in diesem Pull liegt, dass sie nicht als
   Luecke zaehlt. Unter fuenf Pulls oder ohne Fund steht nichts. */
function mechanikZeile(seg: Fight){
  const p = $("#mechanikZeile"); if(!p) return;
  const st = mechanikStand(seg);
  /* Der Fuss "Was das Log nicht weiss" bekommt seinen Zusatz nur, wenn in
     diesem Kampf Mechanik erkannt wurde (Feinschliff 02.10., Abschnitt 3). */
  const fuss = $("#fussMech");
  if(fuss){
    const mit = !!st && st.liste.some(x => x.strecken.length);
    fuss.textContent = mit ? t("analysis.fuss.mech") : "";
    fuss.hidden = !mit;
  }
  if(!st){ p.hidden = true; p.textContent = ""; return; }
  const teile: string[] = [];
  for(const {m, strecken} of st.liste){
    // die Dauer als Spanne (Pruefung 01.10., N1): sie streut, an Vulcanus 5 bis 25 s
    const dv = Math.round(m.dauerVon), db = Math.round(m.dauerBis);
    const s = (dv === db ? String(db) : dv+"\u2013"+db)+"\u00a0s";
    teile.push(t("mechanik.zeile", {boss: st.boss, ab: clock(Math.round(m.beginn)), s, mit: m.mit, n: m.pulls}));
    if(strecken.length) teile.push(t("mechanik.nichtGezaehlt", {zeiten: strecken.map(g => clock(g.von)+"\u2013"+clock(g.bis)).join(", ")})+".");
  }
  p.textContent = teile.join(" ");
  p.hidden = false;
}

/* ---------- der Kasten Auge von Ventius ----------
   Wie im Entwurf (Luecken 4.10): Kopf mit Symbol und dem Satz, wie viele
   Salven die beste Stelle erreicht haben; eine Saeule je lesbarer Salve in
   der Reihenfolge der Einsaetze (die Hoehe ist die Zahl der Nachbeben); drei
   Zahlen - Treffer je Einsatz, fehlende Treffer, Salven. Darunter, was deine
   Einsaetze auf einem Boss je erreicht haben (DECISION 4.11):
   state.ventiusTop merkt sich je Gegner den besten Einsatz ueber alle je
   geladenen Logs.

   Nur Bosse. Boss ja/nein entscheidet knownBoss(), nicht der Schluessel:
   "Calanthia of Destruction" liegt unter name: und ist trotzdem einer -
   nach dem Schluessel gefiltert waere das Hauptziel des Referenzkampfes
   aus der Tabelle gefallen. Trash steht ohnehin nicht drin: er ist tot,
   bevor die Frage sich stellt. */
function ventiusBlock(seg: Fight, gefunden: Insight[], zaehlt: boolean){
  if(!seg.ventius) return "";
  const pos = (gefunden || []).find(f => f.key === "ventiusPos");
  const reihen = Object.keys(state.ventiusTop || {})
    .map(k => state.ventiusTop[k]!)
    .filter(r => r && r.waves > 0 && knownBoss(r.name))
    .sort((a,b) => b.waves - a.waves || b.atTop - a.atTop);
  if(!pos && !reihen.length) return "";

  const name = skillLabel(VENTIUS_NAME, VENTIUS_ID);
  const bild = seg.ventiusBase ? skillIcon(seg.ventiusBase.name, seg.ventiusBase.sid) : "";
  let h = '<section class="fsec vfeld" aria-labelledby="vkH"><div class="vkasten'+(zaehlt ? " zaehlt" : "")+'">'+
    '<div class="vkk">'+(bild ? '<img src="'+bild+'" alt="" aria-hidden="true">' : '<span class="vkbild" aria-hidden="true"></span>')+
    '<div><h3 id="vkH">'+esc(name)+"</h3>";
  if(pos){
    const v = pos.vars;
    h += '<p class="vkw"><b>'+esc(t("insight.ventiusPos.value", v))+"</b></p>"+
      '<p class="fein">'+esc(t("insight.ventiusPos.note", v))+"</p>";
  }
  h += "</div></div>";
  if(pos){
    const v = pos.vars;
    /* Eine Saeule je Salve, von links nach rechts in der Reihenfolge der
       Einsaetze: man sieht, ob die schwachen Salven zusammenliegen. Die
       Hoehe ist die Zahl der Nachbeben gegen die beste. */
    const folge: number[] = (v.folge && v.folge.length) ? v.folge
      : Array.from({length: v.total}, (_, i) => i < v.good ? v.waves : 0);
    /* Eine unlesbare Salve (0) steht als leere Saeule da, niedrig und nur
       gerandet (Entwurf, .salven i.leer). */
    h += '<div class="salven" aria-hidden="true">'+
      folge.map(w => '<i class="'+(!w ? "leer" : w >= v.waves ? "best" : "")+'" style="height:'+(w ? Math.max(18, 100*w/(v.waves || 1)) : 8).toFixed(1)+'%" title="'+
        esc(t("analysis.ventBar", {n: w}))+'"></i>').join("")+"</div>";
    h += '<p class="salvenwort">'+
      esc(t("analysis.ventStrip", {good: v.good, off: v.off, share: v.share}))+
      (v.unread ? esc(t("analysis.ventUnread", {n: v.unread})) : "")+"</p>";
    // Salven und Treffer ueber dieselben Einsaetze auf dem Ziel wie die Saeulen, lesbar und unlesbar
    const salven = Number(v.casts) || folge.length, treffer = Number(v.treffer) || 0;
    const fehlt = ventiusFehlend(seg);
    const zahl = (k: string, z: string, leise = "") => "<div><dt>"+esc(t(k))+'</dt><dd class="num">'+esc(z)+"</dd>"+
      (leise ? '<dd class="fein">'+esc(leise)+"</dd>" : "")+"</div>";
    h += '<dl class="vkz">'+
      zahl("analysis.vent.jeEinsatz", salven ? num1(treffer/salven) : "\u2013")+
      zahl("analysis.vent.fehlend", anzahl(fehlt ? fehlt.fehlen : 0), t("analysis.vent.fehlendNote"))+
      zahl("analysis.vent.salven", anzahl(salven), t("analysis.vent.treffer", {n: anzahl(treffer)}))+"</dl>";
    h += ventiusVerlust(seg);
  }

  if(reihen.length){
    const hoechste = Math.max.apply(null, reihen.map(r => r.waves));
    /* Rollen statt echter Tabellenelemente: das Raster traegt die Spalten,
       und ein tr/td-Aufbau wuerde es brechen. Ohne die Rollen hoerte ein
       Screenreader "Ascended Giant Cordy 22 2 von 10" am Stueck, ohne zu
       wissen, welche Zahl zu welcher Spalte gehoert. */
    h += '<div class="vtab" role="table" aria-label="'+
      esc(t("analysis.ventiusTop.tableLabel"))+'">'+
      '<div class="vtabkopf" role="row"><span role="columnheader" aria-label="'+
      esc(t("analysis.ventiusTop.pic"))+'"></span><span role="columnheader">'+
      esc(t("analysis.ventiusTop.boss"))+'</span><span role="columnheader">'+
      esc(t("analysis.ventiusTop.best"))+'</span><span class="z" role="columnheader">'+
      esc(t("analysis.ventiusTop.hits"))+'</span><span role="columnheader">'+
      esc(t("analysis.ventiusTop.reached"))+"</span></div>";
    for(const r of reihen){
      const bild = bossIcon(r.name);
      /* Das Bild traegt die Zellenrolle selbst statt aria-hidden: eine
         versteckte Zelle faellt aus der Zeile heraus, und dann zaehlt die
         Zeile vier Zellen gegen fuenf Ueberschriften. */
      h += '<div class="vtabzeile" role="row">'+
        (bild ? '<img src="'+bild+'" alt="" role="cell">' : '<span role="cell"></span>')+
        '<span class="bn" role="cell">'+esc(r.name)+"</span>"+
        '<span class="vpips" role="cell">'+Array.from({length: hoechste}, (_, i) =>
          '<i class="'+(i < r.waves ? "on" : "")+'"></i>').join("")+
        "<b>"+r.waves+"</b></span>"+
        '<span class="tr" role="cell">'+(r.waves*3+1)+"</span>"+
        '<span class="oft" role="cell"><span class="ospur"><i style="width:'+
          (r.casts ? 100*r.atTop/r.casts : 0).toFixed(1)+'%"></i></span>'+
        '<span class="owort">'+esc(t("analysis.ventiusTop.ofCasts",
          {n: r.atTop, total: r.casts}))+"</span></span></div>";
    }
    h += '</div><p class="ventnote">'+esc(t("analysis.ventiusTop.note"))+"</p>";
  }

  return h + "</div></section>";
}

/* ---------- was die schwaecheren Salven gekostet haben ----------
   Zwei Zahlen mit sehr verschiedenem Gewicht, und sie bleiben getrennt.

   Die fehlenden Treffer sind exakt: eine Salve mit n Nachbeben landet 3n+1
   Treffer, und wie viele Nachbeben sie hatte, liest ventiusWaves ohnehin an
   ihrer Form ab. Da wird nichts geschaetzt.

   Der Schaden ist gemessen, aber NICHT allein der Position zuzuschreiben.
   Auf dem Referenzkampf brachten die 60 besten Salven 100,4k je Treffer und
   die 12 schwaecheren 74,9k - waere nur die Position schuld, muesste ein
   einzelner Treffer gleich gross sein. Darum nennt der Text als Preis der
   Position nur die fehlenden Treffer, bewertet mit beiden Trefferwerten, und
   sagt dazu, dass der Abstand der Mittelwerte groesser ist. */
/* Die Rechnung allein, ohne Tafel: das Urteil oben braucht dieselbe Zahl
   wie der Kasten hier, und zwei Rechnungen liefen irgendwann auseinander. */
function ventiusFehlend(seg: Fight){
  const m = ventiusMix(seg);
  if(!m.top || m.shaped < 3) return null;
  const gut = m.rows.find(r => r.waves === m.top);
  /* Absteigend: die Zeilen sollen eine Leiter sein - 5, 4, 3, 2 - und
     nicht 5, 2, 3, 4. */
  const unten = m.rows.filter(r => r.waves < m.top).sort((a,b) => b.waves - a.waves);
  if(!gut || !unten.length) return null;
  const besteTreffer = m.top*3 + 1;
  const fehlen = unten.reduce((x,r) => x + r.n*(besteTreffer - r.hits), 0);
  if(!fehlen) return null;
  let uSumme = 0, uTreffer = 0, uN = 0;
  for(const r of unten){ uSumme += r.dmg; uTreffer += r.trefferIst; uN += r.n; }
  const jeGut = gut.trefferIst ? gut.dmg/gut.trefferIst : 0;
  const jeUnten = uTreffer ? uSumme/uTreffer : 0;
  const von = fehlen*Math.min(jeGut, jeUnten), bis = fehlen*Math.max(jeGut, jeUnten);
  return {m, gut, unten, besteTreffer, fehlen, uSumme, uTreffer, uN, jeGut, jeUnten, von, bis};
}
/* Was die Position erklaert: die fehlenden Treffer, mit beiden Trefferwerten
   bewertet, und wie weit die Mittelwerte auseinanderliegen - der Satz unter
   den drei Zahlen, auf den sich das Urteil beruft ("die beiden Trefferwerte"). */
function ventiusVerlust(seg: Fight){
  const r0 = ventiusFehlend(seg);
  if(!r0) return "";
  const {gut, fehlen, uSumme, uN, jeGut, jeUnten, von, bis} = r0;
  const mittelAbstand = gut.n ? (gut.dmg/gut.n)*uN - uSumme : 0;
  return '<p class="kvorbehalt">'+esc(t("analysis.lost.caveat", {
    low: fmt(jeUnten), high: fmt(jeGut), n: fehlen, from: fmt(von), to: fmt(bis), mean: fmt(mittelAbstand)
  }))+"</p>";
}
