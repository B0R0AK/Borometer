import { t } from "./08-translation";
import { esc } from "./18-interface-basics";
import { bereichVon, daten, E, hebenAnwenden, nm, q, salveText, symbol, zusatzVon } from "./79-zeitleiste";
import { ventiusAbschnittDa } from "./62-rekorde";
import { satzText, fm } from "./78-analyse-daten";
import { hatVentius } from "../kampfdaten-core";
import { checkliste, hauptSid, hitzeVon, opener, pruefstand, skillsVon, type Karte, type OpenerErgebnis } from "../pruefstand-core";
import { VENTIUS, ventiusAuswertung, type VentiusErgebnis } from "../ventius-core";

/* ---------- die neue Analyse: Pruefstand je Faehigkeit (#414) ----------
   Spezifikation 2026-11-08-analyse-neu-zeitleiste-design.md 2.4 bis 2.6.
   Checkliste in Prozent, Opener der ersten 15 s gegen den besten Pull, eine
   Karte je Faehigkeit, Auge von Ventius als eine Karte unter den anderen
   (nur mit Salven), aufklappbar zu Raster und Stufen. Alle Zahlen rechnet
   ../pruefstand-core.ts; ein gezogener Bereich rechnet alle Karten neu. */

const HITZE = ["analysis.e.p.hz0", "analysis.e.p.hz1", "analysis.e.p.hz2", "analysis.e.p.hz3"];
const pr = (x: number) => (100 * x).toFixed(3) + "%";
const bestWer = () => (!daten().best ? "" : daten().best!.dps > daten().k.dps ? "bester" : "zweitbester");
const wer = () => t("analysis.e.p." + bestWer());
/** "im besten Pull" / "im zweitbesten Pull" */
const werN = () => t("analysis.e.p." + bestWer() + "N");

/** Anfangsbuchstaben fuer die Chips des Openers, wo kein Spielbild da ist. */
function mono(name: string): string {
  if(name === VENTIUS) return "EV";
  const ws = name.replace(/'s\b/g, "").split(/[\s-]+/).filter(Boolean);
  return ((ws[0] || "?")[0]! + (ws[1] ? ws[1][0]! : (ws[0] || "??")[1] || "")).toUpperCase();
}

function openerLegende(op: OpenerErgebnis): string {
  const alle = op.hier.concat(op.dort || []), e = alle.find(x => x.name !== VENTIUS) || alle[0];
  const bild = e ? symbol(e.name, e.sid, "sic ci") : "";
  const mitV = alle.some(x => x.name === VENTIUS), vb = mitV ? symbol(VENTIUS, "boro:ventius", "sic ci") : "";
  return '<p class="a2olegende">' +
    (e ? '<span><span class="ch' + (bild ? " bild" : "") + '" aria-hidden="true">' + (bild || esc(mono(e.name))) + "</span>" + esc(bild ? t("analysis.e.ui.opener.l.bild") : t("analysis.e.ui.opener.l.mono")) + "</span>" : "") +
    (mitV ? '<span><span class="ch vent' + (vb ? " bild" : "") + '" aria-hidden="true">' + (vb || "EV") + "</span>" + esc(t("analysis.e.ui.opener.l.vent")) + "</span>" : "") +
    '<span><span class="ch h2' + (bild ? " bild" : "") + '" aria-hidden="true">' + (bild || esc(e ? mono(e.name) : "")) + "</span>" + esc(t("analysis.e.ui.opener.l.krit")) + "</span></p>";
}

/** Der Satz an der Ventius-Karte: was eine Salve, ein Punkt und die Decke ist (die Decke ist kein Spielwert). */
function ventiusSatz(alle: VentiusErgebnis): string {
  const gegner = daten().k.hauptziel;
  return '<p class="vsatz">' + esc(t("analysis.e.ui.ventius.satz", {soll: alle.soll, d: alle.decke})) + " " +
    esc(alle.deckeGegner > alle.top ? t("analysis.e.ui.ventius.decke.gegner", {top: alle.top, d: alle.deckeGegner, ziel: gegner}) : t("analysis.e.ui.ventius.decke.selbst", {d: alle.decke, ziel: gegner, gegner: alle.deckeGegner})) + "</p>";
}

function ventiusLegende(): string {
  const z = (inhalt: string, txt: string) => '<span><svg viewBox="0 0 18 14" aria-hidden="true" focusable="false">' + inhalt + "</svg>" + esc(txt) + "</span>";
  return '<p class="a2vlegende">' +
    z('<rect class="oeffner" x="5" y="6" width="8" height="2.4" rx="1.2"/>', t("analysis.e.ui.ventius.l.oeffner")) +
    z('<circle class="voll" cx="9" cy="7" r="3.2"/>', t("analysis.e.ui.ventius.l.punkt")) +
    z('<circle class="leer" cx="9" cy="7" r="3.2"/>', t("analysis.e.ui.ventius.l.hohl")) +
    z('<rect class="ring" x="3" y="1" width="12" height="12" rx="6"/>', t("analysis.e.ui.ventius.l.ring")) +
    z('<circle class="tot" cx="9" cy="7" r="3.2"/>', t("analysis.e.ui.ventius.l.tot")) +
    '<span><b class="tzb">10</b>' + esc(t("analysis.e.ui.ventius.l.zahl")) + "</span></p>";
}

/** Der aufklappbare Teil der Ventius-Karte: Zahlen, Raster in Zeitfolge, Stufen, Gruende. */
function ventiusDetails(alle: VentiusErgebnis, v: VentiusErgebnis, ganz: boolean): {kopf: string; innen: string} {
  const f = fm();
  const d = alle.decke, h = 14 + d * 10;
  let raster = "";
  alle.salven.forEach((s, i) => {
    const hz = hitzeVon(s.krit, s.stark, s.n);
    // der Oeffner ist ein Strich (1 Treffer), jedes Nachbeben ein Punkt (3 Treffer)
    let c = '<rect class="oeffner" x="5" y="' + (h - 5.2) + '" width="8" height="2.4" rx="1.2"/>';
    for(let qq = 1; qq <= d; qq++) c += '<circle class="' + (s.status === "unlesbar" ? "tot" : qq <= s.nb ? "voll" : "leer") + '" cx="9" cy="' + (h - 4 - qq * 10) + '" r="3.2"/>';
    if(s.status === "unter") c += '<rect class="ring" x="3" y="1" width="12" height="' + (h - 2) + '" rx="6"/>';
    const im = v.salven[i]!.im;
    const txt = f.uhr(s.t) + ": " + salveText(s) + ", " + f.kurz(s.dmg);
    raster += '<button type="button" class="a2salve h' + hz + (im ? (ganz ? "" : " im") : " aus") + '" data-t="' + s.t + '" aria-label="' + esc(t("analysis.e.p.salveNr", {i: i + 1}) + ", " + txt) + '" title="' + esc(txt) +
      '"><svg viewBox="0 0 18 ' + h + '" aria-hidden="true" focusable="false">' + c + '</svg><span class="tz" aria-hidden="true">' + s.n + "</span></button>";
  });
  const gefehltSatz = v.lesbar ? (v.unter ? t("analysis.e.p.ventGefehlt", {unter: v.unter, gefehlt: v.gefehlt, verlust: f.kurz(v.verlust), je: f.kurz(v.jeTreffer)}) : t("analysis.e.p.ventAlleDecke")) : t("analysis.e.p.ventKeine");
  const gruende = Object.entries(v.gruende).map(([g, n]) => n + "× " + t("analysis.e.vent.grund." + g)).join(", ");
  const kopf = '<details class="a2vent" id="a2vent"' + (E.ventOffen ? " open" : "") + "><summary>" + esc(t("analysis.e.ui.ventius.auf")) + ' <span class="stand">· ' +
    esc(t("analysis.e.p.ventStand", {d: alle.decke, soll: alle.soll, nie: alle.nieErreicht, top: alle.top})) + "</span></summary><div class=\"a2vinnen\" id=\"a2vinnen\"></div></details>";
  const innen =
    '<div>' +
    '<dl class="a2vzahlen"><div><dt>' + esc(t("analysis.e.ui.ventius.moeglich")) + '</dt><dd><span class="zahl gross">' + v.moeglich + "</span></dd></div><div><dt>" + esc(t("analysis.e.ui.ventius.getroffen")) + '</dt><dd><span class="zahl gross">' + v.getroffen + "</span></dd></div><div><dt>" +
    esc(t("analysis.e.ui.ventius.gefehlt")) + '</dt><dd><span class="zahl gross' + (v.gefehlt ? " befund" : "") + '">' + v.gefehlt + "</span></dd></div></dl>" +
    '<p class="fein"><b>' + esc(t("analysis.e.p.ventSalven", {n: v.gesamt, ganz})) + "</b>: " + esc(t("analysis.e.p.ventZaehlung", {lesbar: v.lesbar, anDecke: v.anDecke, unter: v.unter, unles: v.unlesbar, ende: v.kampfende})) + " " + esc(gefehltSatz) +
    (alle.nieErreicht ? " " + esc(t("analysis.e.p.ventNie", {ziel: daten().k.hauptziel, d: alle.deckeGegner})) : "") + "</p>" +
    ventiusLegende() + '<div class="a2raster" role="group" aria-label="' + esc(t("analysis.e.p.rasterLabel")) + '" style="--a2decke:' + d + '">' + raster + "</div>" +
    '<p class="fein">' + esc(t("analysis.e.ui.ventius.raster")) + "</p></div>" +
    '<div><table class="a2stufen"><thead><tr><th>' + esc(t("analysis.e.p.stNachbeben")) + '</th><th class="z">' + esc(t("analysis.e.p.stSalven")) + '</th><th class="z">' + esc(t("analysis.e.p.stTreffer")) + '</th><th class="z">' + esc(t("analysis.e.p.stSchaden")) + "</th></tr></thead><tbody>" +
    v.stufen.map(s => "<tr" + (s.nb >= v.decke ? ' class="decke"' : "") + "><td>" + s.nb + (s.nb >= v.decke ? " " + esc(t("analysis.e.p.stDecke")) : "") + '</td><td class="z">' + s.n + '</td><td class="z">' + s.treffer + '</td><td class="z">' + f.kurz(s.jeSalve) + "</td></tr>").join("") +
    (v.unlesbar ? "<tr><td>" + esc(t("analysis.e.p.stUnlesbar")) + '</td><td class="z">' + v.unlesbar + '</td><td colspan="2">' + esc(gruende) + "</td></tr>" : "") +
    "</tbody></table>" +
    '<p class="fein">' + esc(t("analysis.e.p.ventForm")) + "</p></div>";
  return {kopf, innen};
}

/* Der Inhalt aufgeklappter Teile wird erst gebaut, wenn sie offen sind: ein geschlossenes details haelt
   keinen Text, der anderen im Weg steht oder vom Vorleser gefunden wird, ohne dass er zu sehen ist. */
const innen = {vent: "", liste: ""};
function ventiusKarte(alle: VentiusErgebnis, v: VentiusErgebnis, ganz: boolean): string {
  const d = ventiusDetails(alle, v, ganz);
  innen.vent = d.innen;
  return d.kopf;
}
/** Die aufgeklappten Teile fuellen, die geschlossenen leeren. */
export function detailsFuellen(): void {
  const v = q("#a2vinnen"); if(v) v.innerHTML = E.ventOffen ? innen.vent : "";
  const l = q("#a2olist .inhalt"); if(l) l.innerHTML = E.listeOffen ? innen.liste : "";
}

/** Die Karten, Checkliste und der Opener fuer den Bereich, der in 79 steht. */
export function pruefstandZeichnen(): void {
  const d = daten(), f = fm();
  const [a, b] = bereichVon(), ganz = E.von == null, k = d.k, bst = d.best;
  const karten = pruefstand(k, bst, a, b, d.decke), V = ventiusAuswertung(k, d.decke, a, b), Valle = ventiusAuswertung(k, d.decke);
  // Salven des besten Pulls (#414): im selben Bereich gegen dieselbe Decke; ein Pull ohne die Salven im Speicher sagt es
  const Vb = V && bst && hatVentius(bst) && bst.dauerS >= b ? ventiusAuswertung(bst, V.decke, a, b) : null;
  const vsKeine = !!V && !!bst && !hatVentius(bst) && bst.einsaetze.some(e => e[2] === VENTIUS);
  q("#a2skillStand")!.innerHTML = (ganz ? esc(t("analysis.e.p.ganzerKampf")) : "<b>" + f.uhr(a) + "–" + f.uhr(b) + "</b>") + " · " + esc(t("analysis.e.ui.skills.stand")) + (bst ? " · " + esc(t("analysis.e.p.spiegel", {wer: wer()})) : "");
  // Checkliste (immer fuer den ganzen Kampf)
  const check = checkliste(k, bst, d.decke);
  q("#a2check")!.innerHTML = '<table class="a2check"><caption>' + esc(t("analysis.e.ui.check.titel")) + '</caption><colgroup><col class="c1"><col class="c2"><col class="c3"><col></colgroup><tbody>' +
    check.map(z => '<tr class="' + (z.neutral ? "neutral" : "") + '"><th scope="row">' + esc(t(z.frage)) + '</th><td class="z">' + f.pr(z.wert) + '</td><td class="b" aria-hidden="true"><span class="bal"><i style="width:' + (z.wert * 100).toFixed(1) + '%"></i></span></td><td class="s">' +
      esc(satzText(z.satz)) + (z.vorbehalt ? ' <span class="vb">' + esc(t(z.vorbehalt)) + "</span>" : "") + "</td></tr>").join("") + "</tbody></table>";
  // Opener: zwei Spuren ueber 15 s
  const op = opener(k, bst, 15);
  const spurBreite = Math.max(160, (q("#a2opener")?.clientWidth || 640) - 120);
  const halb = 100 * 15 / spurBreite, luft = 100 * 4 / spurBreite;
  const chips = (L: OpenerErgebnis["hier"]) => {
    let h = "", reihen = 1; const ende: number[] = [];
    for(const e of L){
      // die Reihe nach der Breite des Chips in Pixeln (Symbol 24 Punkt, Anfangsbuchstaben etwas mehr), nicht nach einem festen Anteil:
      // schmal oder gezoomt liegen sonst zwei Chips uebereinander
      const xx = Math.max(halb, Math.min(100 - halb, e.t / op.bis * 100)); let r = 0;
      while(r < 8 && ende[r] != null && xx - halb < ende[r]!) r++;
      ende[r] = xx + halb + luft; reihen = Math.max(reihen, r + 1);
      const hz = hitzeVon(e.krit, e.stark, e.n), bild = symbol(e.name, e.sid, "sic ci");
      h += '<span class="ch' + (bild ? " bild" : "") + (e.name === VENTIUS ? " vent" : "") + (hz >= 2 ? " h" + hz : "") + '" style="left:' + xx.toFixed(2) + "%;--r:" + r + '" title="' + esc(f.sek(e.t, 1) + " " + nm(e.name) + ", " + f.kurz(e.dmg) + (hz >= 2 ? ", " + t(HITZE[hz]!) : "")) + '">' + (bild || esc(mono(e.name))) + "</span>";
    }
    return {h, reihen};
  };
  const hier = chips(op.hier), dort = op.dort ? chips(op.dort) : null;
  const liste = (L: OpenerErgebnis["hier"]) => L.map(e => "<li>" + f.sek(e.t, 1) + " " + esc(nm(e.name)) + ", " + f.kurz(e.dmg) + "</li>").join("");
  q("#a2opener")!.innerHTML = '<h3 class="uz">' + esc(t("analysis.e.ui.opener.titel", {s: op.bis})) + "</h3>" +
    '<div class="spuren"><p class="l"><b>' + esc(t("analysis.e.ui.opener.hier")) + "</b>" + esc(t("analysis.e.p.nEinsaetze", {n: op.hier.length})) + '</p><div class="a2spur" aria-hidden="true" style="--reihen:' + hier.reihen + '">' + hier.h + "</div>" +
    (op.dort && dort ? '<p class="l"><b>' + esc(t("analysis.e.ui.opener.dort")) + "</b>" + esc(t("analysis.e.p.nEinsaetze", {n: op.dort.length})) + '</p><div class="a2spur" aria-hidden="true" style="--reihen:' + dort.reihen + '">' + dort.h + "</div>" : "") +
    '<span></span><div class="achse" aria-hidden="true">' + [0, 5, 10, 15].map(s => '<span style="left:' + (s / op.bis * 100) + '%" class="' + (s === 0 ? "a0" : s === op.bis ? "a1" : "") + '">' + s + "\u00a0s</span>").join("") + "</div></div>" +
    '<ol aria-label="' + esc(t("analysis.e.p.openerLabel")) + '">' + op.saetze.slice(0, 3).map(s => "<li>" + esc(satzText(s)) + "</li>").join("") + "</ol>" +
    openerLegende(op) + '<details id="a2olist"' + (E.listeOffen ? " open" : "") + "><summary>" + esc(t("analysis.e.ui.opener.liste")) + '</summary><div class="inhalt"></div></details>';
  innen.liste = '<ol aria-label="' + esc(t("analysis.e.p.dieserPull")) + '">' + liste(op.hier) + "</ol>" + (op.dort ? '<ol aria-label="' + esc(t("analysis.e.ui.opener.dort")) + '">' + liste(op.dort) + "</ol>" : "");
  // die Karten
  const L = Math.max(0.001, b - a);
  const karte = (c: Karte) => {
    const maxD = Math.max(1, ...c.alle.map(e => e.dmg));
    const strip = c.liste.map(e => {
      const hz = hitzeVon(e.krit, e.stark, e.n);
      return '<i class="h' + hz + '" style="left:' + pr((e.t - a) / L) + ";height:" + Math.max(3, Math.round(22 * Math.sqrt(e.dmg / maxD))) + 'px" title="' + esc(f.uhr(e.t) + " · " + f.kurz(e.dmg) + " · " + t("analysis.e.p.treffer", {n: e.n}) + " · " + t(HITZE[hz]!)) + '"></i>';
    }).join("");
    const warteH = c.bereit.map(([p, qq]) => '<span class="cd" style="left:' + pr((p - a) / L) + ";width:" + pr((qq - p) / L) + '" title="' + esc(t("analysis.e.p.bereitTitel", {s: f.sek(qq - p, 1)})) + '"></span>').join("");
    const sa: string[] = [];
    if(c.ventius && V){
      if(V.unter) sa.push(t("analysis.e.bs.vent.unter", {unter: V.unter, gefehlt: V.gefehlt, verlust: V.verlust}));
      else if(V.lesbar) sa.push(t("analysis.e.bs.vent.alle", {lesbar: V.lesbar, decke: V.decke, soll: V.soll}));
      if(Vb && V.lesbar >= 3 && Vb.lesbar >= 3) sa.push(t("analysis.e.p.ventVs", {werN: werN(), anHier: V.anDecke, lesbarHier: V.lesbar, anDort: Vb.anDecke, lesbarDort: Vb.lesbar}));
      else if(vsKeine) sa.push(t("analysis.e.p.ventVsKeine"));
    }
    if(!c.ventius && c.decke && c.trefferFehlen >= 3) sa.push(t("analysis.e.p.kTreffer", {n: c.trefferFehlen, max: c.trefferMax}));
    if(c.cd && c.warte >= 3) sa.push(t("analysis.e.p.kBereit", {sek: f.sek(Math.round(c.warte)), cd: f.sek(c.cd, 1), mehr: c.mehr}));
    const bv = c.best && c.vergleichbarJe;
    if(bv && c.best!.vergleichbar && c.best!.einsaetze != null && c.best!.einsaetze >= c.einsaetze + 2) sa.push(t("analysis.e.p.kWeniger", {werN: werN(), dort: c.best!.einsaetze, hier: c.einsaetze}));
    if(bv && c.best!.jeEinsatz && c.jeEinsatz && c.jeEinsatz < c.best!.jeEinsatz * 0.8) sa.push(t("analysis.e.p.kJe", {hier: f.kurz(c.jeEinsatz), werN: werN(), dort: f.kurz(c.best!.jeEinsatz)}));
    const zu = zusatzVon(c.name);
    // Saetze der Laufzeit und des Passiv (Inventur O8) und "Ein Einsatz davon bringt ..." stehen unter dem Satz der Karte
    const zsaetze = zu ? zu.saetze.map(x => x.leise ? '<p class="wbfein">' + esc(x.t) + "</p>" : '<p class="satz zsatz' + (x.befund ? " befund" : "") + '">' + esc(x.t) + "</p>").join("") : "";
    const satz = sa.length ? '<p class="satz">' + esc(sa[0]!) + (sa[1] ? " " + esc(sa[1]) : "") + "</p>" : '<p class="satz ruhig">' + esc(c.einsaetze ? t("analysis.e.ui.bereich.nichts") : t("analysis.e.p.kKein")) + "</p>";
    const an = E.hebt === c.name;
    const zzeilen = zu ? zu.zeilen.map(z => '<div class="find' + (z.zaehlt ? " zaehlt" : "") + '" data-k="' + z.k + '"><dt class="k">' + esc(z.dt) + '</dt><dd class="v">' + esc(z.v) + "</dd>" + (z.n ? '<dd class="n">' + esc(z.n) + "</dd>" : "") + "</div>").join("") : "";
    // der Weg in die Rekorde, nur an der Ventius-Karte und nur, wo es den Abschnitt gibt (62)
    const zrk = c.ventius && ventiusAbschnittDa() ? '<p class="wbfein"><button type="button" class="wbrk">' + esc(t("analysis.wb.zuRekorden")) + "</button></p>" : "";
    const zvgl = zu && zu.vergleich ? '<details class="a2vgl"><summary>' + esc(t("analysis.wb.zahlen")) + "</summary>" + zu.vergleich + "</details>" : "";
    const bn = c.best;
    const dd = (titel: string, inhalt: string, befund = false) => "<div><dt>" + esc(titel) + "</dt><dd" + (befund ? ' class="befund"' : "") + ">" + inhalt + "</dd></div>";
    const n = (s: string) => '<span class="n">' + esc(s) + "</span>";
    return '<article class="a2karte' + (an ? " hebt" : "") + (c.ventius ? " vent" : "") + '" data-skill="' + esc(c.name) + '">' +
      '<div class="kname"><button type="button" class="nm" aria-pressed="' + an + '" aria-describedby="a2bahnHinweis" title="' + esc(t("analysis.e.ui.karte.heben")) + '">' + symbol(c.name, hauptSid(c.alle), "sic kz") + '<span class="nmt">' + esc(nm(c.name)) + '</span></button><span class="ant">' + f.pr(c.anteil, 1) + (bn ? "<small>" + esc(wer()) + " " + f.pr(bn.anteil, 1) + "</small>" : "") + "</span></div>" +
      '<p class="kwahl" aria-hidden="true">' + esc(an ? t("analysis.e.ui.karte.gewaehlt") : t("analysis.e.ui.karte.wahl")) + "</p>" +
      '<div class="streifen" role="img" aria-label="' + esc(t("analysis.e.p.streifenLabel", {n: c.einsaetze, cd: !!c.cd})) + '">' + warteH + strip + "</div><dl>" +
      dd(c.ventius ? t("analysis.e.p.salven") : c.kanal ? t("analysis.e.p.kanaele") : t("analysis.e.ui.karte.einsaetze"),
        c.einsaetze + (ganz ? "" : " " + n(t("analysis.e.p.imKampf", {n: c.einsaetzeKampf}))) +
        (bv && bn!.vergleichbar && bn!.einsaetze != null ? n(t("analysis.e.p.imBest", {n: bn!.einsaetze, werN: werN()})) : bv ? n(t("analysis.e.p.jeMinuteBest", {n: bn!.jeMinute.toFixed(1), werN: werN()})) : n(t("analysis.e.p.jeMinuteHier", {n: c.jeMinute.toFixed(1), ids: c.mehrteilig ? c.sids.length : 0})))) +
      dd(c.ventius ? t("analysis.e.p.jeSalve") : c.kanal ? t("analysis.e.p.jeKanal") : t("analysis.e.ui.karte.je"),
        (c.einsaetze ? f.kurz(c.jeEinsatz) : "–") + (bv && bn!.jeEinsatz ? n(wer() + " " + f.kurz(bn!.jeEinsatz)) : c.einsaetze >= 3 ? n(t("analysis.e.p.spanne", {von: f.kurz(c.p10), bis: f.kurz(c.p90)})) : "")) +
      dd(c.ventius ? t("analysis.e.p.trefferSalve") : t("analysis.e.ui.karte.treffer"),
        !c.einsaetze ? "–" : c.decke ? c.trefferMedian + " / " + c.trefferMax + (c.ventius && Valle ? n(t("analysis.e.ui.ventius.formel", {d: Valle.decke, soll: Valle.soll}) + (c.trefferFehlen ? ", " + t("analysis.e.p.fehlen", {n: c.trefferFehlen}) : "")) : c.trefferFehlen ? n(t("analysis.e.p.fehlen", {n: c.trefferFehlen})) : n(t("analysis.e.p.medianVoll"))) :
          c.trefferMedian + n(c.kanal ? t("analysis.e.p.kanalOhneDecke") : c.mehrteilig ? t("analysis.e.p.mehrteilig") : (c.trefferMax ?? 0) > 1 ? t("analysis.e.p.bisOhneDecke", {max: c.trefferMax}) : t("analysis.e.p.keinMax")), c.decke && c.trefferFehlen > 0) +
      dd(t("analysis.e.ui.karte.hitze"), (c.krit == null ? "–" : f.pr(c.krit) + " · " + f.pr(c.stark ?? 0)) + (bn && bn.krit != null ? n(t("analysis.e.p.kritBest", {wer: wer(), q: f.pr(bn.krit)})) : "")) +
      (c.ventius ? dd(t("analysis.e.p.salvenAbstand"), c.salvenAbstand ? f.sek(c.salvenAbstand.median, 1) + n(t("analysis.e.p.abstandP10", {s: f.sek(c.salvenAbstand.p10, 1), n: c.jeMinute.toFixed(1)})) : "–")
        : dd(t("analysis.e.ui.karte.takt"), c.cd ? f.sek(c.cd, 1) + n(c.auslastung != null ? t("analysis.e.p.genutzt", {q: f.pr(c.auslastung)}) : "") : "–" + n(c.einsaetzeKampf < 4 ? t("analysis.e.p.zuWenige") : t("analysis.e.p.keinTakt"))) +
          dd(t("analysis.e.ui.karte.bereit"), (c.cd ? f.sek(Math.round(c.warte)) : "–") + n(c.cd && c.mehr >= 1 ? t("analysis.e.p.bisZu", {n: c.mehr}) : t("analysis.e.p.nachTakt")), !!c.cd && c.warte >= 3)) +
      zzeilen + "</dl>" + satz + zsaetze + (zu ? zu.extra : "") + zvgl + zrk + (c.ventius && Valle && V ? ventiusSatz(Valle) + ventiusKarte(Valle, V, ganz) : "") + "</article>";
  };
  const ticks = skillsVon(k).filter(s => s.tick);
  // je Tick die Aussage der Werkbank (Laufzeit: "aus, ab ...", "Lief ... in n Laeufen"), wo es sie gibt
  const tsaetze = ticks.map(s => {
    const zu = zusatzVon(s.name);
    if(!zu || !(zu.saetze.length || zu.zeilen.length || zu.vergleich)) return "";
    // ein Tick hat keine Karte: was an ihr stuende (groesster Treffer, Fehlschlaege, Tabelle), steht hier in seiner Zeile
    const zl = zu.zeilen.map(z => ' <span class="tzeile" data-k="' + z.k + '"><b>' + esc(z.dt) + ":</b> " + esc(z.v) + (z.n ? " " + esc(z.n) : "") + "</span>").join("");
    return "<li><b>" + esc(nm(s.name)) + "</b> " + zu.saetze.map(x => esc(x.t)).join(" ") + zl + (zu.vergleich ? '<details class="a2vgl"><summary>' + esc(t("analysis.wb.zahlen")) + "</summary>" + zu.vergleich + "</details>" : "") + "</li>";
  }).join("");
  // Passiv ist eine eigene Gruppe mit Ueberschrift (Entscheidung O8): passive Faehigkeiten als Karten darin, die Ticks bleiben in ihrer Zeile
  const passiv = karten.filter(c => zusatzVon(c.name)?.passiv), uebrige = karten.filter(c => !zusatzVon(c.name)?.passiv);
  q("#a2skills")!.innerHTML = '<div class="a2karten">' + uebrige.map(karte).join("") + "</div>" +
    (passiv.length ? '<section class="a2passiv" aria-labelledby="a2passivH"><h4 id="a2passivH">' + esc(t("analysis.e.ui.passiv.titel")) + '</h4><div class="a2karten">' + passiv.map(karte).join("") + "</div></section>" : "") +
    (ticks.length ? '<p class="a2ticks">' + esc(t("analysis.e.p.ticks", {liste: ticks.map(s => nm(s.name) + " " + f.pr(s.anteil, 1)).join(", ")})) + "</p>" : "") +
    (tsaetze ? '<ul class="a2tsatz">' + tsaetze + "</ul>" : "") +
    '<p class="fein a2fuss">' + esc(t("analysis.e.ui.fuss.takt")) + "</p>";
  if(!karten.some(c => c.ventius)) innen.vent = "";
  detailsFuellen();
  hebenAnwenden();
}
