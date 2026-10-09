import { state } from "./01-state";
import { dur, fmt, full } from "./03-helpers";
import { dungeonName, histKey, stats } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { bossIcon } from "./12-boss-images";
import { LIEST_AB_TREFFER, pct, pctOf } from "./16-fight-analysis";
import { $, esc, wallTime } from "./18-interface-basics";
import { groupRows, partyForFight } from "./19-grouping-and-party-fights";
import { istLivePausiert } from "./23-kampfwahl";
import { histVerdict } from "./32-history";
import { whenSavedText } from "./34-menus-drop-and-tabs";
import { kampfLaeuft, kampfRestMs } from "./41-server-mode";
import { syncBestBtn } from "./46-best-pull";
import { nebenzielKopf } from "./53-fenster";
import type { Fight, FightStats, PartyView } from "../types";

/* ---------- meter head ---------- */
/* Was in diesem Kampf passiert ist, in einem Satz.

   Der Kopf praesentiert: grosse Zahl, Name, vier Fakten, fuenf Messwerte.
   Alles davon stimmt, und keines sagt, was passiert ist - wer den Kampf
   nicht selbst gespielt hat, liest dort Inventar. Diese Zeile liest ihn.

   Vier Regeln, von oben nach unten geprueft, der erste Treffer wird
   gedruckt. Keine Regel wiederholt, was daneben ohnehin steht: die
   Trefferzahl in R1 traegt nicht die Zahl, sondern das Urteil darueber.

   Ausgezaehlt an allen 66 Kaempfen eines eigenen Logs vom 19.09.2026:
   R1 zwei, R2 neun, R3 drei, R4 zweiundfuenfzig. Jeder Kampf bekommt
   eine Zeile.

   R4 war im ersten Entwurf auf unter 35 Prozent gedeckelt und hiess
   "Verteilt". Damit blieben zehn Kaempfe ohne jede Zeile - genau die
   zwischen 35 und 50 Prozent, wo weder "eine traegt" noch "keine sticht
   heraus" stimmt. Statt einer fuenften Regel fuer das Mittelfeld faengt
   R4 jetzt auf, was die drei davor durchlassen. */
export function kampfSatz(seg: Fight, s: FightStats){
  if(!seg || !s) return "";
  /* R1  Zu duenn. Steht ganz vorn: wenn die Grundlage nicht traegt, soll
     kein anderer Satz so tun, als truege sie. Ohne Zeitangabe - die
     Spanne steht in der Faktenzeile direkt darueber, und ein Log ohne
     Zeitstempel haette hier sonst eine erfundene Dauer gedruckt. */
  if(s.hits < LIEST_AB_TREFFER) return t("head.readThin", {n: s.hits});
  /* R2  Eine Luecke. Die Faktenzeile druckt beide Uhren, sagt aber nicht,
     welche die grosse Zahl teilt - genau daran scheiterte das
     Nachrechnen bei neun von 66 Kaempfen. Dieselbe Bedingung wie dort,
     nur mit fuenf Sekunden statt 0,05 als Schwelle: unter fuenf
     Sekunden ist die Luecke kein Ereignis, sondern Rundung. */
  if(!state.noTime && s.fought != null && s.seconds - s.fought >= 5)
    return t("head.readGap", {t: dur(s.fought), g: dur(s.seconds - s.fought)});
  /* Erst ab hier kostet die Zeile einen zweiten Lauf ueber die Ereignisse
     DIESES Kampfes - nicht ueber das Log. renderBars() macht denselben
     Lauf gleich danach; bei den elf Kaempfen, die schon oben
     herausfallen, sparen wir ihn ganz. Die Liste kommt nach Schaden
     sortiert zurueck, der erste Eintrag ist also die staerkste. */
  const rows = groupRows(seg, "skill");
  const top = rows[0];
  if(!top) return "";
  /* R3  Eine Faehigkeit traegt den Kampf. Die Trefferschwelle ist der
     Punkt, nicht der Anteil: im Referenzlog haelt sie zwei Faelle
     draussen, die Monstertruhe mit 76 % aus drei Treffern und eine
     Schneefeld-Alraune mit 53 % aus fuenf. Beide bekaemen sonst einen
     Befund aus dem Nichts - der Grundsatz dazu ist, dass eine
     Zahl aus einem einzigen Einsatz nichts wert ist. */
  /* Der Anteil mit einer Nachkommastelle, die Quote ohne - genau so, wie
     die beiden Spalten der Tabelle darunter sie schreiben. Der Satz zeigt
     auf eine Zeile, die zwei Zeilen tiefer wirklich steht; er sagte "78 %"
     und daneben stand "77,8 %", und wer beides sieht, sucht den
     Unterschied. */
  if(top.share >= 0.5 && top.hits >= 10)
    return t("head.readCarry", {s: top.label, p: pct(top.share, 1),
                                n: top.hits, k: pct(top.critRate ?? 0)});
  /* R4  Sonst. Die Untergrenze von drei Faehigkeiten ist eine
     sprachliche: bei zweien hiesse der Satz "der Rest verteilt sich auf
     1 weitere", bei einer auf null. */
  if(rows.length >= 3)
    return t("head.readTop", {s: top.label, p: pct(top.share, 1),
                              n: rows.length - 1});
  return "";
}
/* Die Kurzfassung fuer den Kompaktmodus. Die Lesezeile selbst ist dort aus:
   in der Kopfzeile hat sie rund 200 Punkt, und ein ganzer Satz waere nach
   vier Woertern abgeschnitten. Genau dort wertet man aber zwischen zwei
   Pulls aus. Also eine eigene Zeile ueber die volle Breite, mit denselben
   vier Regeln wie kampfSatz, nur ohne Nebensatz; der Vergleich zum letzten
   Pull steht unter der Zahl (#hPrev). Die Meldung nach dem Kampf (66)
   nimmt dieselbe Kurzfassung. */
export function kampfKurz(seg: Fight, s: FightStats){
  if(!seg || !s) return "";
  if(s.hits < LIEST_AB_TREFFER) return t("head.shortThin", {n: s.hits});
  if(!state.noTime && s.fought != null && s.seconds - s.fought >= 5)
    return t("head.shortGap", {g: dur(s.seconds - s.fought)});
  const top = groupRows(seg, "skill")[0];
  if(!top) return "";
  return t(top.share >= 0.5 && top.hits >= 10 ? "head.shortCarry" : "head.shortTop",
           {s: top.label, p: pct(top.share)});
}
/* Der Kampf davor gegen dasselbe Ziel, in diesem Log. histKey, damit eine
   Phase zu ihrem Boss zaehlt. Uebungsziele zaehlen mit: dort ist jeder Pull
   ein Versuch, und der Vergleich mit dem letzten ist genau die Frage. Ohne
   Uhr keine Rate, also auch kein Vergleich. */
/* Derselbe Kampf ist im Vergleich der "Letzte Pull" (Neugestaltung 28.09.,
   Luecken 5.2, 28-compare.ts): eine Regel fuer beide Stellen. */
export function letzterKampf(seg: Fight): Fight | null {
  if(state.noTime) return null;
  const key = histKey((seg.stats || (seg.stats = stats(seg))).name);
  let vor: Fight | null = null;
  for(const x of state.encounters){
    if(x === seg || x.start >= seg.start || (vor && x.start <= vor.start)) continue;
    const st = x.stats || (x.stats = stats(x));
    if(st.total > 0 && histKey(st.name) === key) vor = x;
  }
  return vor && vor.stats.dps > 0 ? vor : null;
}
function gegenLetzten(seg: Fight, s: FightStats){
  if(state.noTime || !(s.dps > 0)) return null;
  const vor = letzterKampf(seg);
  if(!vor) return null;
  return 100 * (s.dps - vor.stats.dps) / vor.stats.dps;
}
let kampfWecker: ReturnType<typeof setTimeout> | null = null;
function setCompactRead(seg: Fight | null, s: FightStats | null){
  const el = $("#hCompact");
  if(!el) return;
  /* Im Kampf (Spezifikation Kompakt-Fenster 3): "Kampf laeuft" statt des
     Satzes, der Vergleich wartet bis zum Ende - ein halber Kampf gegen einen
     ganzen sagt nichts. Ohne neue Zeilen zeichnet niemand neu: ein Wecker
     auf das Ende der Kampftrennung. */
  const laeuft = !!seg && kampfLaeuft();
  document.body.classList.toggle("kampf-laeuft", laeuft);
  clearTimeout(kampfWecker ?? undefined);
  if(laeuft) kampfWecker = setTimeout(() => renderHead(), kampfRestMs() + 50);
  /* Ein frueherer Tag ist offen und Live nur pausiert (Abschlusspruefung,
     H2): im Streifen gibt es die Kampfwahl nicht, die das sonst sagt - also
     steht es hier vorn. */
  const pause = istLivePausiert() ? t("kw.pausiert") : "";
  const satz = laeuft ? t("compact.imKampf")
    : [pause, seg && s ? kampfKurz(seg, s) : ""].filter(Boolean).join(" \u00b7 ");
  /* Der Vergleich zum letzten Pull steht im Streifen unter der Zahl
     (#hPrev, setPrevLine, Spezifikation Kompakt-Fenster 7, #157): bei 300
     Punkt kuerzte er im Deutschen sonst den Namen der Faehigkeit. Die
     Lesezeile traegt nur noch den Satz, ueber die volle Breite. */
  el.innerHTML = satz ? "<span>"+esc(satz)+"</span>" : "";
  el.title = el.textContent || "";
  el.hidden = !satz;
}
/* "+7 % zum letzten Pull" als zweite Zeile unter der grossen Zahl
   (Feinschliff 02.10., Abschnitt 2; bestaetigt). Dieselbe Rechnung und
   derselbe Text wie im Kompakt (gegenLetzten, head.shortPrev), also auch
   dieselbe Bedingung: ein frueherer Kampf am selben Ziel in diesem Log.
   Ohne ihn entfaellt die Zeile ganz. Neutral, die Richtung traegt das
   Vorzeichen (DESIGN.md, Signal). */
function setPrevLine(seg: Fight | null, s: FightStats | null){
  const el = $("#hPrev");
  if(!el) return;
  const d = seg && s ? gegenLetzten(seg, s) : null;
  // im Streifen wartet der Vergleich, solange der Kampf laeuft (Spezifikation Kompakt-Fenster 3)
  const warten = document.body.classList.contains("compact") && document.body.classList.contains("kampf-laeuft");
  const text = d == null || warten ? "" : Math.abs(d) < 0.5 ? t("head.shortSame")
    : t("head.shortPrev", {d: (d > 0 ? "+" : "\u2212") + pctOf(Math.abs(d))});
  if(el.textContent !== text) el.textContent = text;
  el.hidden = !text;
}
/* Der Zielname, und bei einem bekannten Boss sein Portraet davor.

   Die App hat das Bild ohnehin - die Laufleiste und die Zielspalte der
   Tabelle zeigen es laengst. Im Kopf sagt es auf einen Blick, dass
   dieser Kampf ein bekannter Boss war und kein Trashpull. Ein Trashmob
   bekommt keine leere Platte, sondern gar nichts: bossIcon() gibt fuer
   ihn null, und dann steht der Name da wie bisher.

   Der Name steckt in einem eigenen Element, weil er sonst seinen
   Zeilenumbruch-Schutz verloere: als Flex-Kind traegt nur ein Kasten die
   Ellipse, nicht der Text daneben. */
function setHeadName(name: string){
  const el = $("#hName");
  const bild = bossIcon(name);
  el.classList.toggle("mitbild", !!bild);
  el.innerHTML = (bild ? '<img class="hbild" src="' + bild + '" alt="">' : "") +
    '<span class="hnt">' + esc(name) + "</span>";
}
/* The hero number counts up to its new value instead of snapping — during
   live logging you see it move, which is the whole point of a live meter.
   Frame-count based rather than clock based so it can't spin forever in an
   environment where requestAnimationFrame fires synchronously. */
function setHeroDps(value: number | null){
  const el = $("#hDps");
  if(value == null){ el.textContent = "—"; state._heroDps = null; return; }
  const from = state._heroDps;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(from == null || reduce || from === value){
    el.textContent = fmt(value); state._heroDps = value; return;
  }
  state._heroDps = value;
  const frames = 16; let i = 0;
  const token = (state._heroToken = (state._heroToken || 0) + 1);
  el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick");
  const step = () => {
    if(token !== state._heroToken) return;   // a newer value took over
    i++;
    const t = i / frames, ease = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(from + (value - from) * ease);
    if(i < frames) requestAnimationFrame(step); else el.textContent = fmt(value);
  };
  requestAnimationFrame(step);
}
export function renderHead(){
  if(state.group === "party"){
    const p: Partial<PartyView> = state.party || {};
    /* Der links gewaehlte Bosskampf geht vor. Jede Zeile darin ist der Kampf
       EINES Mitglieds gegen diesen Boss - fuenf Leute an einem Boss haben
       fuenf verschiedene Laengen, weil wer stirbt frueher aufhoert. Deshalb
       sagt die Zeile unter dem Namen, was hier addiert wird. */
    const seg = state.encounters[state.sel]!;
    const fuer = partyForFight(seg);
    const board = fuer || p.board || [];
    const live = fuer || board.filter(r => !r.waiting);
    /* Everyone reporting counts, not only those whose target string matches
       the majority's. People are rarely on the same pull at the same instant,
       so that filter dropped most of a raid from its own headline: measured
       on a real one, 113M of the 215M actually on screen, and a party dps of
       1.14M where the rows added to 2.14M. Who is on which target is still
       shown per row; it no longer decides whether everybody else counts. */
    const partyDps = live.reduce((a,r) => a + (r.dps||0), 0);
    const partyDmg = live.reduce((a,r) => a + (r.damage||0), 0);
    const partyHits = live.reduce((a,r) => a + (r.hits||0), 0);
    const partyMax = live.reduce((a,r) => Math.max(a, r.max||0), 0);
    setHeroDps(live.length ? partyDps : null);
    // a loaded snapshot is not live data, and looked exactly like it was —
    // same dim grey as any other meta line. It needs to be unmistakable at
    // a glance, not just readable if you happen to read the meta line.
    setHeadName(fuer ? stats(seg).name
                     : (p.target || t("party.waitingForFights")));
    $(".headmeta").setAttribute("data-label", t("head.targetLabel"));
    /* Die Verlaufszeile gehoert hier nicht hin, und sie muss weg statt
       einfach nicht gesetzt zu werden: sie stand sonst mit dem Satz vom
       zuletzt gezeigten Einzelkampf unter dem Namen eines anderen Bosses.
       Gemessen: Kopf "Gramaut-Schamane", darunter "15 % schlechter als
       sonst" - gesagt ueber Vulcanus.

       Auch inhaltlich: die Zeile misst den Spieler an seinen frueheren Kaempfen,
       der Kopf daneben zeigt den Schaden der ganzen Gruppe. Eine Aussage
       ueber einen unter einer Zahl ueber alle ist in jedem Fall schief. */
    const hvEl = $("#hHist");
    if(hvEl){ hvEl.textContent = ""; hvEl.hidden = true; hvEl.classList.remove("best"); }
    /* Die Lesezeile aus demselben Grund, und ebenso geloescht statt nur
       nicht gesetzt: sie stuende sonst mit dem Satz ueber den zuletzt
       gezeigten Einzelkampf unter dem Namen eines anderen Ziels. Sie
       misst ausserdem einen Angreifer, die Zahl daneben die ganze
       Gruppe. */
    const hrGrp = $("#hRead");
    if(hrGrp){ hrGrp.textContent = ""; hrGrp.title = ""; hrGrp.hidden = true; }
    /* Die Nebenziel-Zeile ebenso (Issue #45): sie sagt etwas ueber die Zahl
       eines Kampfes, und hier steht die Zahl der Gruppe. */
    const hsGrp = $("#hSide");
    if(hsGrp){ hsGrp.textContent = ""; hsGrp.title = ""; hsGrp.hidden = true; }
    setCompactRead(null, null);
    // "zum letzten Pull" misst einen Kampf, die Zahl daneben die Gruppe
    setPrevLine(null, null);
    $("#snapBadge").hidden = !p.frozen;
    $("#hMeta").innerHTML = fuer
      ? '<span class="scope">' + esc(t("party.ofFight",{n:fuer.length})) + "</span>" +
        '<span class="f">' + esc(full(partyDmg) + " " + t("head.damage")) + "</span>"
      : p.frozen
      ? '<span class="scope">' +
        esc(t("party.snapshotFrom",{when: whenSavedText(Math.floor(Date.parse(p.savedAt||"")/1000)||0)})) +
        "</span>"
      : live.length
        ? '<span class="scope">' + esc(t("party.ofPlayers",{n:live.length})) + "</span>" +
          '<span class="f">' + esc(full(partyDmg) + " " + t("head.damage")) + "</span>"
        : "";
    /* Im Glutring stehen Boss und Fakten im Ringfeld (64), ausserhalb von
       .headwrap: die Farbe des Schnappschusses gilt dort ueber dieselbe Klasse. */
    $(".headwrap").classList.toggle("snapshot", !!p.frozen);
    $("#ringFeld").classList.toggle("snapshot", !!p.frozen);
    /* Die Werteleiste entfiel mit der Neugestaltung (28.09., DECISION 2.3);
       die Treffer der Gruppe stehen in der Faktenzeile, der groesste
       Treffer im title der Trefferzahl. */
    if(live.length) $("#hMeta").insertAdjacentHTML("beforeend",
      '<span class="f" data-f="treffer" title="'+esc(t("chip.biggest")+" "+fmt(partyMax))+'">'+esc(t("head.treffer", {n: full(partyHits)}))+"</span>");
    // same button, mode-appropriate label and action — see its onclick
    saveKnopf(t("party.saveLogBtn"));
    document.body.classList.toggle("partyEmpty", !live.length);
    // die Tafel misst die Gruppe; der Knopf zum besten Pull geht (bestInfo)
    syncBestBtn();
    return;
  }
  const seg = state.encounters[state.sel];
  // ohne Kampf bleibt kein Satz ueber den zuletzt gezeigten stehen (Pruefung B3)
  if(!seg){ setPrevLine(null, null); setCompactRead(null, null); return; }
  const s = seg.stats;
  document.body.classList.remove("partyEmpty");
  saveKnopf(t("head.saveAsRun"));
  $("#snapBadge").hidden = true;
  $(".headwrap").classList.remove("snapshot");
  $("#ringFeld").classList.remove("snapshot");
  setHeroDps(state.noTime ? null : s.dps);
  setHeadName(s.name);
  $(".headmeta").setAttribute("data-label", t("head.targetLabel"));
  const satz = kampfSatz(seg, s), hrEl = $("#hRead");
  if(hrEl){
    hrEl.textContent = satz;
    hrEl.hidden = !satz;
    /* In der kompakten Kopfplatte (schmal oder flach, styles.css) steht
       der Satz einzeilig und gekuerzt; was gekuerzt ist, muss beim Zeigen
       vollstaendig sein. */
    hrEl.title = satz || "";
  }
  /* Wie viel der grossen Zahl auf Nebenziele ging (Issue #45). Die Zahl
     zaehlt sie weiter mit; die Zeile sagt nur, wie viel davon. Gekuerzt
     in der kompakten Kopfplatte, darum der ganze Satz im title. */
  const neben = nebenzielKopf(seg), hsEl = $("#hSide");
  if(hsEl){ hsEl.textContent = neben; hsEl.title = neben; hsEl.hidden = !neben; }
  setCompactRead(seg, s);
  setPrevLine(seg, s);
  const hv = histVerdict(), hvEl = $("#hHist");
  if(hvEl){
    hvEl.textContent = hv.text;
    hvEl.hidden = !hv.text;
    hvEl.classList.toggle("best", hv.best);
    /* Die Einordnung ist eine leise Zeile unter dem Satz (Neugestaltung
       28.09., DECISION 2.4); die Skala mit sonst/bester/dieser entfiel im
       Kampf und gehoert in den Verlauf. Was "sonst" heisst, sagt der title;
       die Zahlen dahinter stehen am Element, dieselben wie im Satz. */
    const mitMedian = !!hv.text && hv.med != null;
    hvEl.title = mitMedian ? t("tafel.medianTitle", {n: hv.n}) : "";
    if(mitMedian){ hvEl.dataset.median = String(hv.med); hvEl.dataset.dps = String(s.dps); }
    else { delete hvEl.dataset.median; delete hvEl.dataset.dps; }
  }
  /* Die Faktenzeile wie im Entwurf (Neugestaltung 28.09., Luecke 2.2):
     Ort | Uhrzeit | Dauer | Schaden | Treffer. Der Ort ist der Dungeon des
     Blocks; ein Feldboss ist sein eigener Ort und heisst "Feldboss". Wessen
     Zahlen das sind (.scope), steht nur noch im Kompakt - dort hat die grosse
     Zahl sonst keinen Besitzer (styles.css); in der vollen Ansicht steht kein
     Spielername aus dem Log mehr im Kopf. Jede Angabe traegt data-f.
     Die Reihenfolge der Kompaktzeile bleibt: dort blendet das Stilblatt Ort
     und Treffer aus, und die Uhrzeit (.wt) auch. */
  const b = seg.block;
  const ortName = b ? (dungeonName(b.dungeon) || dungeonName(b.open) || "") : "";
  const ort = !ortName ? "" : ortName.toLocaleLowerCase() === String(s.name).toLocaleLowerCase() ? t("head.feldboss") : ortName;
  const wer = state.player !== "__all" ? state.player
    : (state.players && state.players.length === 1) ? state.players[0]
    : t("head.allInLog");
  const fakt = (f: string, html: string, titel?: string) =>
    '<span class="f" data-f="'+f+'"'+(titel ? ' title="'+esc(titel)+'"' : "")+">"+html+"</span>";
  /* Die zweite Uhr, wenn sie eine andere ist: stats() teilt durch die
     gekaempfte Zeit, und ohne sie ginge die grosse Zahl bei einem Boss mit
     Zwischenphase nicht auf (nachgemessen am eigenen Log vom 19.09.). */
  const gekaempft = state.noTime || s.fought == null || s.seconds - s.fought <= 0.05
    ? "" : t("rail.blockFought", {t: dur(s.fought)});
  /* Der Schild war ein eigener Chip der Werteleiste und nur da, wo es einen
     gab; jetzt eine Angabe am Ende der Faktenzeile, mit demselben title. */
  const schild = s.shieldHits ? fakt("schild", esc(t("chip.shield") + " " + pct(s.shieldHits/(s.hits||1), 1)),
    // shieldDmg is null only when shieldHits is, and then this part is not drawn
    t("chip.shieldTitle", {hits: s.shieldHits, dmg: full(s.shieldDmg!), share: pct(s.shieldDmg!/(s.total||1), 1)})) : "";
  $("#hMeta").innerHTML =
    '<span class="scope" title="'+esc(wer || "")+'">'+esc(wer || "")+"</span>"+
    (ort ? fakt("ort", esc(ort)) : "")+
    (state.wall ? fakt("zeit", '<i class="wt">'+esc(wallTime(seg.start).slice(0, 5))+"</i>", wallTime(seg.start)) : "")+
    (state.noTime ? "" : fakt("dauer", esc(dur(s.seconds))))+
    (gekaempft ? fakt("gekaempft", esc(gekaempft)) : "")+
    /* Kompakt ist der Streifen zu schmal fuer "32.540.117 Schaden" - dort
       steht dieselbe Zahl in der Kurzform der grossen Zahl. */
    fakt("schaden", '<b class="dmgv">' + esc(full(s.total)) + '</b><span class="dmgk">' + esc(fmt(s.total)) + "</span> " + esc(t("head.damage")))+
    fakt("treffer", esc(t("head.treffer", {n: full(s.hits)})))+
    schild;
  syncBestBtn();
}

/* Der Speichern-Knopf in zwei Laengen. Voll steht er in der breiten
   Ansicht; im flachen oder schmalen Fenster (auch 1280 bei 200 %) blendet
   styles.css die kurze ein - "Kampf speichern" brach dort allein in eine
   eigene Zeile unter die Kennzahlen und kostete eine Tabellenzeile im
   ersten Bild. Der Name fuer Vorleser und Zeiger bleibt der volle. */
function saveKnopf(voll: string){
  const b = $("#btnSaveRun");
  b.setAttribute("aria-label", voll);
  b.title = voll;
  const l = b.querySelector(".skl"), k = b.querySelector(".skk");
  if(l) l.textContent = voll;
  if(k) k.textContent = t("head.saveShort");
}
