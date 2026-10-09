import { state } from "./01-state";
import { dur, factLine, fmt, toast, toastFail } from "./03-helpers";
import { segment } from "./05-fights";
import { dungeonName, knownBoss } from "./06-blocks-and-places";
import { t, tt } from "./08-translation";
import { bossMark } from "./12-boss-images";
import { $, el, esc, wallTime } from "./18-interface-basics";
import { darfEntfernen, inGruppenLog, partyForFight } from "./19-grouping-and-party-fights";
import { baumZaehlen, kampfwahlSchliessen, kwNachRender, kwSucheAktiv, kwZeigen, syncKwLaeufe, syncTage, tagAnsichtLabel, waehleKampf } from "./23-kampfwahl";
import { persistConfig } from "./27-weapons-tab";
import { renderCompare, vonHand } from "./28-compare";
import { renderAll } from "./32-history";
import { runNoteSync, syncCompareBtn } from "./45-startup";
import { besterVon, schluesselVon } from "./46-best-pull";
import { anzahlText } from "./55-statusleiste";
import type { Fight, FightBlock, SavedRun } from "../types";

/* ---------- lists ---------- */
/* Remember the focused control inside `root` by the data attribute that
   identifies it, and return a function that gives focus back to whatever
   node now carries that attribute. A plain reference would be useless -
   the node it points at is gone by then. */
export function focusKeeper(el: HTMLElement | null, root: HTMLElement){
  /* Die Detailzeile der Schadenstafel gibt es nur breit (Issue #53). Faellt
     sie beim Neuzeichnen weg, geht der Fokus auf die Zeile, zu der sie
     gehoert, statt auf den Seitenkoerper. */
  const ersatz = el && el.dataset.detail ? '.row[data-open="' + CSS.escape(el.dataset.detail) + '"]' : null;
  const sel = el && root && root.contains(el) && el !== root
    ? el.dataset.k     ? '.bhead span[data-k="'   + CSS.escape(el.dataset.k)    + '"]'
    /* Der Knopf "Ordnen" im Kopf der Liste neben dem Glutring (64). */
    : el.id === "ringOrdnen" ? "#ringOrdnen"
    : el.dataset.open  ? '.row[data-open="'       + CSS.escape(el.dataset.open) + '"]'
    : el.dataset.detail ? '.row[data-detail="'    + CSS.escape(el.dataset.detail) + '"]'
    /* Liste neben dem Glutring (64): ein Mitglied traegt seinen Namen, eine
       Trefferart ihre Art und die Zeile darueber - im Kompakt bleibt es wie bisher. */
    : el.dataset.member ? '.row[data-member="'    + CSS.escape(el.dataset.member) + '"]'
    : el.dataset.cat && el.dataset.parent && root.classList.contains("ring")
      ? '.row[data-cat="' + CSS.escape(el.dataset.cat) + '"][data-parent="' + CSS.escape(el.dataset.parent) + '"]'
    /* Zeilen ohne Unterzeilen tragen nur ihren Namen (data-skill, fuer die
       Spur in der Kurve der Tafel); ohne diese Zeile fiel ihr Fokus bei
       jedem Live-Neubau auf den Seitenkoerper. */
    : el.dataset.skill ? '.row[data-skill="'      + CSS.escape(el.dataset.skill) + '"]'
    /* Aufklappbare Unterzeilen (Gruppe: Faehigkeit eines Mitglieds) tragen
       ihren Schluessel zusammen mit dem Namen der Zeile darueber. */
    : el.dataset.opensub ? '.row[data-opensub="'  + CSS.escape(el.dataset.opensub) +
                           '"][data-subof="'      + CSS.escape(el.dataset.subof || "") + '"]'
    : el.dataset.i     ? '.fight[data-i="'        + CSS.escape(el.dataset.i)    + '"]'
    /* Die zwei Klappknoepfe fehlten hier. Ein Klick auf eine
       Blockueberschrift baut die Liste neu, der Browser wirft den Fokus
       dabei auf den Seitenkoerper - mit der Maus faellt das nicht auf, mit
       der Tastatur endet der Weg durch die Liste bei jedem Auf- und
       Zuklappen. */
    : el.dataset.fold  ? '.blockfold[data-fold="'  + CSS.escape(el.dataset.fold)  + '"]'
    : el.dataset.trash ? '.trashhead[data-trash="' + CSS.escape(el.dataset.trash) + '"]'
    : null : null;
  return () => {
    if(!sel) return;
    const back = root.querySelector<HTMLElement>(sel) || (ersatz ? root.querySelector<HTMLElement>(ersatz) : null);
    if(back) back.focus({preventScroll:true});
  };
}

/* Bosse zuerst, darunter der Trash. Innerhalb beider Gruppen bleibt die
   Reihenfolge, die die Liste sonst haette; der Block als Ganzes ist damit
   nicht mehr streng nach der Uhr sortiert. Das ist der Preis dafuer, dass
   die Bosse zusammenstehen - so entschieden.

   Geteilt wird nur, wo es etwas zu teilen gibt: ein Block ohne Boss ist
   ganz Trash, und eine Ueberschrift "Trashmobs" ueber allem sagt nichts.
   Ein Block ohne Trash braucht sie genauso wenig. */
/* Ein Kopf je Ort (Feinschliff 02.10., Abschnitt 5): aufeinanderfolgende
   Laeufe am selben Ort und Boss - sechs Wipes in der Frostatemhoehle, jeder
   ein eigener Lauf, weil zwischen ihnen Stille war - stehen unter EINEM Kopf.
   Ein Lauf bleibt, was er ist (blockPass, 06); nur die Liste fasst zusammen.
   Der Schluessel des Kopfes ist der Beginn des aeltesten Laufs darin: kommt
   im Live ein neuer Pull dazu, behaelt der Kopf seinen Schluessel, und was
   zugeklappt war, bleibt zu. Zusammen stehen Laeufe mit demselben Ort (ein
   Dungeon, ein offener Boss oder ein benanntes Ziel), auch wenn die Bosse
   wechseln (#155); der Boss steht dann in der Zeile. */
function kopfGruppen(){
  const folge: FightBlock[] = [], gesehen = new Set<number>();
  state.encounters.forEach(seg => {
    const b = seg.block;
    if(!b || gesehen.has(b.start)) return;
    gesehen.add(b.start); folge.push(b);
  });
  const ort = (b: FightBlock) => {
    if(b.only) return "";
    const name = dungeonName(b.dungeon) || dungeonName(b.open) || (b.top && b.top !== "\u2014" ? b.top : "");
    return name;
  };
  const kopf = new Map<number, number>();
  let zuletzt = "", lauf: number[] = [];
  const schliessen = () => { const k = Math.min(...lauf); lauf.forEach(st => kopf.set(st, k)); };
  folge.forEach(b => {
    const o = ort(b);
    if(lauf.length && o && o === zuletzt){ lauf.push(b.start); return; }
    if(lauf.length) schliessen();
    zuletzt = o; lauf = [b.start];
  });
  if(lauf.length) schliessen();
  return kopf;
}

function railOrder(kopf: Map<number, number>){
  const je = new Map<string, { boss: number[]; trash: number[] }>(), folge: string[] = [];
  state.encounters.forEach((seg, i) => {
    const k = String(seg.block ? kopf.get(seg.block.start) ?? seg.block.start : "\u2014");
    if(!je.has(k)){ je.set(k, {boss: [], trash: []}); folge.push(k); }
    const g = je.get(k)!;   // set just above
    (knownBoss(seg.stats.name) ? g.boss : g.trash).push(i);
  });
  const reihe: number[] = [], geteilt = new Set<string>(), trashN = new Map<string, number>();
  folge.forEach(k => {
    const g = je.get(k)!;   // folge holds only keys of je
    if(g.boss.length && g.trash.length){
      geteilt.add(k); trashN.set(k, g.trash.length);
      reihe.push(...g.boss, ...g.trash);
    } else {
      reihe.push(...[...g.boss, ...g.trash].sort((a, b) => a - b));
    }
  });
  return {reihe, geteilt, trashN};
}

/* Der Kopf der Schiene: wie viele Kaempfe dastehen, und - wenn welche
   fehlen - wie viele und ein Weg zurueck. Die Zahl zaehlt die Zeilen, nicht
   die Kaempfe im Log; sonst stuende ueber einer Liste von vierundsechzig
   die Zahl sechsundsechzig. */
function railKopf(){
  const n = state.encounters.length;
  const zahl = $("#fightCount");
  /* Neugestaltung 28.09. (0.6, DECISION 0.24): der Kopf des Aufklappfelds
     nennt den Tag des neuesten Kampfes ("So 20.09.") und die Zahl - "13
     Kaempfe heute" oder wie bisher "7 Kaempfe geladen"; die Statusleiste
     traegt sie nicht mehr. Ohne Uhrzeit im Log gibt es keinen Tag. */
  /* Ein frueherer Tag aus dem Log-Ordner (Nachtraege N3) nennt seinen Tag
     aus der Aenderungszeit der Dateien, wie die Knoepfe daneben blaettern. */
  const neueste = state.encounters[0];
  const tag = tagAnsichtLabel() ?? (neueste && state.wall ? (() => { const d = new Date(neueste.start), p = (x: number) => String(x).padStart(2, "0");
    return t("kw.tag", {w: d.getUTCDay(), d: p(d.getUTCDate()) + "." + p(d.getUTCMonth() + 1) + "."}); })() : "");
  const tagFeld = $("#kwTag");
  if(tagFeld.textContent !== tag) tagFeld.textContent = tag;
  syncTage();
  zahl.textContent = n ? anzahlText() : t("rail.noneLoaded");
  if(state.entferntAktiv > 0){
    zahl.appendChild(document.createTextNode(" \u00b7 "));
    const zurueck = el("button","fback",t("rail.removedN",{n:state.entferntAktiv}));
    zurueck.type = "button";
    zurueck.title = t("rail.removedBackTitle");
    zurueck.onclick = () => {
      state.entfernt.clear();
      neuSchneiden();
      toast(tt("rail.clearedBack"));
    };
    zahl.appendChild(zurueck);
  }
  const knopf = $("#btnEditFights"), sperre = inGruppenLog();
  knopf.hidden = n < 1;
  /* Sichtbar und abgeschaltet, nicht weg: wer den Knopf sucht, soll
     erfahren, warum er hier nicht geht, statt ihn nicht zu finden.
     aria-disabled statt disabled, damit er erreichbar bleibt und der
     Grund beim Druecken herauskommt - im title allein sehen ihn Tastatur
     und Touch nie. */
  if(sperre) knopf.setAttribute("aria-disabled", "true");
  else knopf.removeAttribute("aria-disabled");
  knopf.textContent = state.bearbeiten ? t("rail.editDone") : t("rail.edit");
  knopf.title = sperre ? t("rail.editLockedLog")
              : state.bearbeiten ? t("rail.editDoneTitle") : t("rail.editTitle");
  knopf.setAttribute("aria-pressed", state.bearbeiten ? "true" : "false");
  knopf.classList.toggle("on", state.bearbeiten);
}

/* Ein Satz, solange bearbeitet wird. Steht in der Liste eine Zeile, die
   nicht darf, sagt er warum - sonst sagt er, was das Zeichen tut. */
function railNotiz(){
  const p = $("#fightEditNote"), suche = $("#kwSuche");
  if(!state.bearbeiten || !state.encounters.length){
    p.hidden = true;
    suche.removeAttribute("aria-describedby");
    return;
  }
  p.hidden = false;
  /* Das Suchfeld traegt den Fokus der Kampfwahl; der Satz sagt dort, dass
     Entf den angewaehlten Kampf loest (das Zeichen an der Zeile ist fuer
     den Vorleser verborgen). */
  suche.setAttribute("aria-describedby", "fightEditNote");
  p.textContent = state.encounters.some(seg => !darfEntfernen(seg))
    ? t("rail.editKept") : t("rail.editHow");
}

/* Neu schneiden, ohne die Auswahl zu verlieren. Sie haengt am Platz in der
   Liste, und der verschiebt sich, sobald eine Zeile fehlt: ohne das hier
   spraenge der halbe Bildschirm auf einen anderen Kampf, weil dessen Platz
   frei geworden ist. Ueber die Startzeit gemerkt bleibt stehen, was man
   gerade ansieht. */
function neuSchneiden(){
  const war = state.encounters[state.sel];
  const merk = war ? war.start : null;
  segment();
  const i = merk == null ? -1 : state.encounters.findIndex(x => x.start === merk);
  state.sel = i >= 0 ? i : 0;
  renderAll();
}

/* Kein Loeschen, sondern eine gemerkte Startzeit - und deshalb ist die
   Ruecknahme nur ein delete aus derselben Menge. Neun Sekunden, wie bei
   "Leeren": derselbe Griff, dieselbe Frist. */
export function kampfEntfernen(seg: Fight){
  if(!darfEntfernen(seg)) return;
  const name = seg.stats.name, start = seg.start;
  state.entfernt.add(start);
  neuSchneiden();
  toast(tt("rail.fightRemoved",{name}), 9000, null, {label: tt("rail.clearedUndo"), fn: () => {
    state.entfernt.delete(start);
    neuSchneiden();
    toast(tt("rail.fightBack",{name}));
  }});
}

/* Was renderFights zuletzt in die Liste schrieb, und welcher Kampf dabei gewaehlt war */
let listeZuletzt = "", gewaehltZuletzt = "";
export function renderFights(){
  const panel = $("#fightList"), hint = $("#fightHint");
  /* Beim Suchen in der Kampfwahl steht alles Passende offen: zugeklappte
     Bloecke und Trash-Gruppen verbargen sonst Treffer (Instrumententafel 3.2). */
  const suche = kwSucheAktiv();
  /* Ein geladenes Gruppen-Log wird nicht bearbeitet. Kommt eines an,
     waehrend der Modus laeuft, geht er aus - und nicht erst beim naechsten
     Klick. */
  if(inGruppenLog()) state.bearbeiten = false;
  railKopf();
  railNotiz();
  $("#btnClearLog").hidden = state.encounters.length < 1;
  panel.classList.toggle("bearb", state.bearbeiten);

  if(!state.encounters.length){
    /* Ganz ohne Log sagt das Feld "Kein Kampf - Log oeffnen" mit dem Knopf
       dazu; mit Log (geleert, zu kurz, alles geloest) der Satz der Liste. */
    $("#kwLeer").hidden = !!state.parsed;
    hint.hidden = !state.parsed;
    // a log that was read but holds nothing long enough is not the same
    // state as no log at all, and the reader can tell them apart
    /* Und beides ist falsch, wenn die Liste einmal voll war und Zeile fuer
       Zeile geleert wurde. Der Weg zurueck steht in der Ueberschrift
       darueber, also sagt dieser Satz nur, wo er hinfuehrt. */
    hint.textContent = state.entferntAktiv > 0 ? t("rail.allRemoved")
      : (state.events||[]).length ? t("rail.nothingLongEnough")
                                  : t("rail.noFightsYet");
    panel.innerHTML = ""; listeZuletzt = ""; gewaehltZuletzt = "";
    kwNachRender();
    return;
  }
  $("#kwLeer").hidden = true;
  hint.hidden = !state.minDurDropped;
  if(state.minDurDropped) hint.textContent = t("rail.minDurIgnored", {n: state.minDur});

  let lastKopf: number | null = null;
  /* Jeder Block bekommt eine Huelle. Ohne sie haben alle Ueberschriften
     denselben umschliessenden Kasten - die Liste - und kleben deshalb
     alle gleichzeitig bei top:0 uebereinander. Gemessen an einem Abend
     mit 21 Bloecken: an 32 Rollstellen ragte eine frueher gelesene,
     hoehere Ueberschrift unter der aktuellen hervor, weil die aktuelle
     sie nicht ueberdecken konnte. Mit der Huelle haftet jede nur, solange
     ihr eigener Block laeuft, und schiebt die naechste sauber hinaus. */
  let gruppeOffen = false;
  const kopf = kopfGruppen();
  const {reihe, geteilt, trashN} = railOrder(kopf);
  /* Der Goldpunkt (0.11; Spezifikation Bester Pull 5.1): der Kampf, der der
     beste Pull an seinem Boss ist - ueber den ganzen Verlauf, nach der Regel
     aus best-pull-core.ts (Mindestlaenge, erst ab zwei Pulls). Liegt der
     beste in einem anderen Log, traegt dieses Log an dem Boss kein Gold.
     Verglichen wird der Index im Log, nicht `at`: ohne Datum ist `at` nur
     die Zeit seit Mitternacht. Nur Bosse, die Puppe hatte nie Gold. */
  const goldIdx = new Set<number>();
  if(!state.noTime){
    const keys = new Set<string>();
    for(const seg of state.encounters){
      const k = schluesselVon(seg.stats.name, seg.stats.seconds);
      if(k && k.startsWith("boss:")) keys.add(k);
    }
    for(const k of keys){ const b = besterVon(k); if(b && b.seg != null) goldIdx.add(b.seg); }
  }
  /* Der Kopf rechts (Feinschliff 02.10., Abschnitt 5; vorher "ab 21:14 \u00b7 9
     Kaempfe"): "6 Kaempfe \u00b7 19:04\u201319:20" - die Zahl der Kaempfe an
     den Bossen des Kopfes (sechs Wipes sind sechs Kaempfe, die Trashmobs
     dazwischen zaehlt ihre eigene Gruppe); ein Kopf ohne Boss zaehlt alle
     gelisteten Kaempfe seiner Laeufe. Die Spanne reicht vom Beginn des ersten
     gelisteten Kampfes bis zum Ende des letzten. Gesammelt je Kopf. */
  const jeKopf = new Map<number, { n: number; boss: number; hidden: number; von: number; bis: number; laeufe: Set<number>;
    bosse: Set<string>; laengst: number; nr?: number }>();
  state.encounters.forEach(seg => { const b = seg.block; if(!b) return;
    const k = kopf.get(b.start) ?? b.start;
    let g = jeKopf.get(k);
    if(!g){ g = {n: 0, boss: 0, hidden: 0, von: Infinity, bis: -Infinity, laeufe: new Set(), bosse: new Set(), laengst: 0}; jeKopf.set(k, g); }
    if(!g.laeufe.has(b.start)){ g.laeufe.add(b.start); g.n += b.fights; g.hidden += b.hidden || 0; }
    if(knownBoss(seg.stats.name)){ g.boss++; g.bosse.add(seg.stats.name); g.laengst = Math.max(g.laengst, seg.stats.seconds); }
    g.von = Math.min(g.von, seg.start); g.bis = Math.max(g.bis, seg.end); });
  /* #152: unter einem Kopf mit genau einem Boss heisst jede Bosszeile
     "Pull N" - gezaehlt von alt nach neu, der aelteste ist 1. */
  const pullNr = new Map<number, number>();
  [...state.encounters].sort((a, b) => a.start - b.start).forEach(seg => {
    const b = seg.block; if(!b || !knownBoss(seg.stats.name)) return;
    const g = jeKopf.get(kopf.get(b.start) ?? b.start);
    if(!g || g.bosse.size !== 1) return;
    g.nr = (g.nr || 0) + 1; pullNr.set(seg.start, g.nr);
  });
  const kopfGezeigt = new Set();
  /* Welche Regeln in dieser Liste schon einmal ausgeschrieben wurden.
     Steht ausserhalb der Schleife, weil sie fuer die ganze Liste gilt. */
  const regelGezeigt = new Set();
  const html = reihe.map(i => {
    const seg = state.encounters[i]!, s = seg.stats;
    /* The list runs newest first, so a block's heading is emitted when its
       first fight from that end comes past. The heading is added above the
       rows rather than in place of them - folding a block is the reader's
       decision, taken here by pressing the heading, not the app's. */
    let head = "";
    const b = seg.block;
    const kk = b ? kopf.get(b.start) ?? b.start : null;
    const folded = !suche && kk !== null && state.folded.has(kk);
    if(b && kk !== null && !b.only && kk !== lastKopf){
      lastKopf = kk;
      const g = jeKopf.get(kk)!;   // every block of the list has its head entry
      /* With no target column mapped every event's target is an em dash, so
         the block would be headed by one - under a sentence saying it is named
         after what took the most damage, about a block where nothing was
         recorded. The clock can still say which stretch this is. */
      const named = b.top && b.top !== "—";
      const dung = dungeonName(b.dungeon) || dungeonName(b.open) || (named ? b.top
        : state.wall ? t("rail.blockAt", {t: wallTime(b.start)})
        : t("rail.blockNth", {n: state.blocks!.length - b.index}));
      /* #152: ein Boss unter dem Kopf - sein Name steht hier einmal, die
         Zeilen sagen "Pull N". Ist der Ort schon der Boss (Feldboss), nur einmal. */
      const einBoss = g.bosse.size === 1 ? [...g.bosse][0]! : "";
      const kname = einBoss && einBoss.toLocaleLowerCase() !== String(dung).toLocaleLowerCase() ? dung + " \u00b7 " + einBoss : dung;
      /* Die Rubrik gehoert dem Block - Feldboss, Erzboss, Koloss, und der
         Gegner heisst in beiden Client-Sprachen gleich. Die Regel darunter
         gehoert der Liste, nicht dem Block. Zwei verschiedene Dinge, die
         frueher in derselben Bedingung standen und deshalb dieselbe
         Behandlung bekamen. */
      const rubrik = !b.dungeon && b.open
        ? (b.open.kind === "arch" ? "rail.blockArch"
         : b.open.kind === "koloss" ? "rail.blockKoloss"
         : "rail.blockField") : null;
      const regel = (!b.dungeon && !b.open)
        ? (named ? "rail.blockUnknown" : "rail.blockNoTarget") : null;
      const regelZeigen = !!regel && !regelGezeigt.has(regel);
      if(regelZeigen) regelGezeigt.add(regel);
      gruppeOffen = true;
      /* Fassung B aus dem Entwurf: bei genau einem Kampf druckt die
         Ueberschrift dieselbe Laenge und dieselbe Summe wie die Zeile
         direkt darunter. Eine Zeile tiefer steht es nochmal - das ist
         keine Auskunft, das ist ein Echo.

         Drei Ausnahmen, in denen die Faktenzeile mehr sagt als die Zeile
         darunter: ein Block mit einem von der Mindestlaenge verschluckten
         Kampf (die Zahlen darueber enthalten ihn, die Zeilen nicht), ein
         Block ohne Uhr (dann druckt die Zeile gar keine Laenge), und bei
         einem Dungeon Sterne, Stufe und Solo, die keine Zeile kennt.
         Der Dungeon behielt frueher die ganze Faktenzeile und damit auch
         das Echo: "1 Kampf | 1m 26s gesamt | 21.44M" direkt ueber einer
         Zeile mit 1m 26s und 21.44M. Jetzt behaelt er nur, was nur er
         sagt; ohne Sterne und Stufe steht keine Faktenzeile da. */
      const fakten = (function(){
        /* Seit der Neugestaltung (0.9) sagt der Kopf "ab 21:14 \u00b7 9
           Kaempfe" in einer Zeile; darunter steht nur noch, was nur der
           Lauf sagt: Sterne, Stufe, Solo und die verschluckten Kaempfe.
           Summe und Uhren hat die Zeile jedes Kampfes. */
        const teile = [
        // the game's own difficulty, where the game has one to give. Drawn as
        // stars because that is how the game shows it, with the words on the
        // element so a reader who cannot count four glyphs at 10px still gets
        // told which tier this was.
        b.dungeon && b.dungeon.stars
          ? {html: '<span class="stars" role="img" aria-label="'+
              esc(t("rail.blockStars", {n: b.dungeon.stars}))+'">'+
              "★".repeat(b.dungeon.stars)+"</span>"+
              '<span class="starword">'+esc(t("rail.dungeonWord"))+"</span>"}
          : null,
        b.dungeon && b.dungeon.lvl ? t("rail.blockLvl", {n: b.dungeon.lvl}) : null,
        b.dungeon && b.dungeon.solo ? t("rail.blockSolo") : null,
        /* The fights the minimum length hid are in this block's clock and
           in its sum - they happened - but not in the list under it, so
           the rows will not add up to the figure beside them unless this
           says why. */
        g.hidden ? t("rail.blockHidden", {n: g.hidden}) : null,
        /* Feinschliff 02.10. (Abschnitt 5): der Kopf ist einzeilig. Was
           frueher eine eigene Zeile darunter hatte - der Raid, zu dem ein
           Teil gehoert, die Rubrik des offenen Bosses -, steht jetzt in
           derselben Faktenzeile. */
        // a raid part is a block and the raid is its context; a block that ran
        // two parts together names them instead, so neither goes unsaid
        b.dungeon && b.dungeon.parts ? b.dungeon.parts.map(dungeonName).join(" \u00b7 ")
          : b.dungeon && b.dungeon.of ? (b.dungeon.of[state.lang] || b.dungeon.of.en) : null,
        rubrik ? t(rubrik) : null
        ];
        return teile.some(Boolean) ? '<span class="num factline" id="kwi-'+kk+'" aria-hidden="true">'+factLine(teile)+"</span>" : "";
      })();
      /* role="heading" sass am ganzen Kasten, also rechnete die
         Namensberechnung Faktenzeile und Erklaersatz mit hinein: die
         Ueberschriftennavigation las Saetze aus fuenfundzwanzig Woertern
         vor. Die Ueberschrift ist der Name; was darunter steht, ist ihr
         Inhalt, nicht ihr Name. In der Kampfwahl (tree) gibt es keine
         Ueberschriften mehr: der Ortskopf ist ein Eintrag der Ebene 1, benannt
         nach seinem b; Faktenzeile, Spanne und Regel haengen als Beschreibung
         daran (aria-describedby), stehen sonst verborgen im Baum (#154). */
      const besch = [fakten ? "kwi-"+kk : "", "kwz-"+kk, regelZeigen ? "kwr-"+kk : ""].filter(Boolean).join(" ");
      head = (gruppeOffen ? "</div>" : "")+'<div class="blockgroup" role="none">'+
        '<div class="blockhead">'+
        '<span class="bkname">'+
        '<button class="blockfold" type="button" data-fold="'+kk+'" id="kwb-'+kk+'" role="treeitem" aria-level="1" tabindex="-1"'+
          ' aria-describedby="'+besch+'"'+
          ' aria-expanded="'+(folded ? "false" : "true")+'"'+
          ' title="'+esc(t(folded ? "rail.blockUnfold" : "rail.blockFold"))+'">'+
          // the chevron is the character, the way the skill rows draw theirs:
          // an empty .twist is a 10px box with nothing in it
          '<span class="twist" aria-hidden="true">›</span>'+
          '<b id="kwg-'+kk+'" title="'+esc(kname + (regel && !regelZeigen ? " \u2014 " + t(regel) : ""))+
            '">'+esc(dung)+(kname !== dung ? '<span class="kboss"> \u00b7 '+esc(einBoss)+"</span>" : "")+"</b></button></span>"+
        fakten+
        '<span class="gz num" id="kwz-'+kk+'" aria-hidden="true">'+esc(t("kw.spanne", {n: g.boss || g.n,
          von: state.wall && (g.boss || g.n) > 1 ? wallTime(g.von).slice(0, 5) : "",
          bis: state.wall && (g.boss || g.n) > 1 ? wallTime(g.bis).slice(0, 5) : ""}))+"</span>"+
        /* Hier stand einmal "Nach 39m 37s Pause getrennt" - die Laenge
           der Stille vor diesem Block. Sie ist auf Wunsch
           gestrichen: dass eine Blockgrenze ein anderer Kampf ist,
           sieht man ihr an, und die Uhrzeiten der Zeilen daneben sagen,
           wie lange es dazwischen still war. b.quiet bleibt berechnet -
           die Blockbildung braucht es - es wird nur nicht mehr gedruckt. */

        /* Fassung A aus dem Entwurf. Die Regel gilt fuer die ganze Liste,
           nicht fuer diesen einen Block - gemessen an einem Abend stand
           derselbe Satz dreizehnmal da, dreizeilig, 689 Punkt zusammen.
           Einmal gesagt, und bei allen weiteren wandert er in den title
           der Ueberschrift: dasselbe Muster, mit dem ein gekuerzter Name
           seinen vollen Namen behaelt. Seit dem Feinschliff (02.10.,
           Abschnitt 5) steht er unter dem einzeiligen Kopf, nicht in ihm. */
        "</div>"+
        (regelZeigen ? '<p class="blockwho blockregel" id="kwr-'+kk+'" aria-hidden="true">'+esc(t(regel))+"</p>" : "");
    }
    /* The selected fight is never folded away. Hiding the row the rest of the
       screen is about would leave the reader looking for a fight the app is
       still showing everywhere else. */
    if(folded && i !== state.sel) return head;

    /* Der Eintrag "Trashmobs" steht genau einmal je Block, vor der ersten
       Trash-Zeile - auch dann, wenn die Gruppe zu ist und gleich gar keine
       Zeile folgt. Sonst waere die Gruppe unsichtbar und nicht zugeklappt. */
    const bk = String(kk ?? "\u2014");
    const istBoss = knownBoss(s.name);
    let vorsatz = "";
    if(geteilt.has(bk) && !istBoss && !kopfGezeigt.has(bk)){
      kopfGezeigt.add(bk);
      const auf = suche || state.trashOpen.has(bk);
      vorsatz = '<button class="trashhead'+(auf ? " open" : "")+'" type="button" id="kwt-'+(kk ?? "x")+'" role="treeitem" aria-level="'+(b && !b.only ? 2 : 1)+'" tabindex="-1"'+
        ' data-trash="'+esc(bk)+'" aria-expanded="'+(auf ? "true" : "false")+'">'+
        '<span class="twist" aria-hidden="true">\u203a</span>'+
        "<span>"+esc(t("rail.trashGroup"))+"</span>"+
        '<span class="n">'+trashN.get(bk)+"</span></button>";
    }
    /* Ein ausgewaehlter Kampf wird nie weggeklappt - dieselbe Regel, die
       der Block daruber schon hat. */
    if(geteilt.has(bk) && !istBoss && !suche && !state.trashOpen.has(bk) && i !== state.sel)
      return head+vorsatz;

    const bmark = bossMark(s.name);
    const istBester = goldIdx.has(i);
    /* Die Huelle steht um jede Zeile, auch um die, die nicht darf - sonst
       saessen zwei Sorten Zeilen verschieden tief in der Liste, je nachdem,
       ob die Gruppe etwas gemeldet hat. */
    const kann = darfEntfernen(seg);
    // Ebene im Baum (#154): unter einem Kopf 2, ohne Kopf 1; ein Trash-Kampf unter "Trashmobs" eine tiefer
    const ebene = (b && !b.only ? 2 : 1) + (geteilt.has(bk) && !istBoss ? 1 : 0);
    const pull = pullNr.get(seg.start);
    const gk = kk !== null ? jeKopf.get(kk) : undefined;
    /* Der Balken: die Laenge gegen den laengsten Pull des Kopfes (#152),
       gedaempft, ohne Urteil. Ohne Uhr keine Laenge, kein Balken. */
    const lbar = pull && !state.noTime && gk && gk.laengst > 0
      ? '<i class="lbar" aria-hidden="true" style="--l:'+(Math.round(s.seconds / gk.laengst * 100) / 100)+'"></i>' : "";
    /* data-lauf: der Lauf der Zeile (blockPass) - unter einem Kopf koennen
       mehrere stehen. */
    return head+vorsatz+'<div class="fightrow"'+(b ? ' data-lauf="'+b.start+'"' : "")+'>'+
      '<button class="fight'+(i===state.sel?" on":"")+
      (bmark ? " hasboss" : " ohnebild")+
      (geteilt.has(bk) && !istBoss ? " trash" : "")+
      /* Die id haengt am Beginn des Kampfes, nicht am Platz in der Liste:
         kommt im Live ein neuer Kampf dazu, verschieben sich die Plaetze,
         und die Anwahl der Kampfwahl (aria-activedescendant) sprang sonst
         stumm auf einen anderen Kampf. */
      (folded?" lone":"")+'" data-i="'+i+'" id="kwf-'+seg.start+'" role="treeitem" aria-level="'+ebene+'" tabindex="-1"'+
      /* Ohne aria-label kommt der Inhalt der Zeile am Stueck an:
         "Dryvern-Raufbold41.5k00:21:392m 55s4.41M1m 46s gekaempft3 Teile".
         Die Zahlen stehen nebeneinander, weil sie nebeneinander STEHEN -
         fuers Auge ist das eine Zeile mit Spalten, fuers Ohr ein Wort.
         Dieselben Werte, mit Komma getrennt und mit ihren Woertern. */
      ' aria-label="'+esc((pull ? [s.name, t("kw.pull", {n: pull}),
        state.noTime ? null : dur(s.seconds),
        state.wall ? wallTime(seg.start) : null,
        state.noTime ? null : fmt(s.dps)+" "+t("bars.dps"),
        fmt(s.total)+" "+t("head.damage"),
        (seg.parts || 1) > 1 ? t("rail.parts", {n: seg.parts}) : null,
        istBester ? t("kw.bester") : null]
      : [s.name,
        state.noTime ? null : fmt(s.dps)+" "+t("bars.dps"),
        state.wall ? wallTime(seg.start) : null,
        state.noTime ? null : dur(s.seconds),
        fmt(s.total)+" "+t("head.damage"),
        (seg.parts || 1) > 1 ? t("rail.parts", {n: seg.parts}) : null,
        istBester ? t("kw.bester") : null
      ]).filter(Boolean).join(", "))+'"'+
      ' aria-selected="'+(i===state.sel ? "true" : "false")+'">'+
      // A 252px rail cannot hold every boss name — "Gramaut Barrier Shaman"
      // already measures 151px of the 162 a row has for a name, and the
      // longer ones lose their tail. The full name is one hover away rather
      // than gone, the same way the status and party pills carry theirs.
      bmark+'<span class="a"><b title="'+esc(s.name)+'">'+esc(pull ? t("kw.pull", {n: pull}) : s.name)+"</b>"+
      /* Ein kleiner Anhaenger, wo die Gruppe etwas zu diesem Kampf gemeldet
         hat - sonst klickt man die Liste durch und sieht erst hinterher, wo
         etwas drinsteht. Zweimal gesucht waere zweimal dieselbe Schleife, also
         einmal in eine Variable. */
      (function(){
        const pf = partyForFight(seg);
        return pf ? '<span class="ptag" title="'+
          esc(t("rail.partyTagTitle",{n:pf.length}))+'">'+
          esc(t("rail.partyTag"))+"</span>" : "";
      })()+
      "</span>"+
      /* Die Zeile wie im Entwurf (0.9): eine Zeile mit Bild, Name und darunter
         "21:48 \u00b7 3m 3s \u00b7 5 Teile", die DPS rechts in der Mitte, beim
         besten Kampf je Boss mit dem Goldpunkt (0.11). Die Summe steht im
         Namen fuer den Vorleser und im Kopf des Kampfes. */
      '<span class="kd num">'+(istBester ? '<i class="best" aria-hidden="true"></i>' : "")+
        (state.noTime?"\u2014":esc(fmt(s.dps)))+"</span>"+
      '<span class="b num">'+lbar+esc((pull
        ? [state.noTime ? null : dur(s.seconds), state.wall ? wallTime(seg.start).slice(0, 5) : null]
        : [state.wall ? wallTime(seg.start).slice(0, 5) : null,
        // no clock, no length - the dps chip beside it already says so
        state.noTime ? null : dur(s.seconds)]).concat([
        /* Both lengths whenever they differ, the way the block heading above
           says them. Without the second one the rate beside the name looks
           wrong: 46.75M over 4m 57s does not give the 207k/s in the chip,
           because 71 s of that was a phase nobody could hit through.
           The key is the block heading's - the same words about the same
           thing, and one wording is better than two. */
        !state.noTime && s.fought != null && s.seconds - s.fought > 0.05
          ? t("rail.blockFought", {t: dur(s.fought)}) : null,
        // a merged fight used to look exactly like a single one
        (seg.parts || 1) > 1 ? t("rail.parts", {n: seg.parts}) : null
      ]).filter(Boolean).join(" \u00b7 "))+"</span></button>"+
      /* Kein Zeichen an einer Zeile, die nicht darf. Der Anhaenger "Gruppe"
         steht daneben und sagt warum; der Satz ueber der Liste sagt es in
         Worten. Ein abgeschaltetes Zeichen an jeder dritten Zeile waere
         dieselbe Auskunft, nur sechsundsechzigmal. */
      /* tabindex="-1", auch im Bearbeiten-Modus: die Liste ist seit der
         Tastaturbedienung EIN Tabstopp, und fuenfzig Zeichen darin waeren
         fuenfzig weitere. Der Weg fuer die Tastatur ist Entf auf der
         Zeile, auf der man ohnehin steht - und der Satz ueber der Liste
         sagt das jetzt. */
      /* aria-hidden: in einer listbox ist nur die Option ein Eintrag; der
         Weg fuer Tastatur und Vorleser ist Entf, und darauf verweist die
         Suche im Bearbeiten-Modus (railNotiz, aria-describedby). */
      (kann ? '<button class="fx" type="button" tabindex="-1" aria-hidden="true" data-x="'+i+'" title="'+
        esc(t("rail.removeFight",{name:s.name}))+'" aria-label="'+
        esc(t("rail.removeFight",{name:s.name}))+'">\u2715</button>' : "")+
      "</div>";
  }).join("") + (gruppeOffen ? "</div>" : "");
  /* Die Signatur der Liste ist ihr HTML (Spezifikation Live-Leistung 4):
     steht dasselbe da wie beim letzten Mal, bleibt sie, wie sie ist - kein
     Neubau, keine neuen Knoepfe, kein Messen. Alles, was sie zeigt, steht
     darin: jeder Kampf mit Namen, Dauer und Schaden, der gewaehlte, die
     Sprache, auf- und zugeklappte Bloecke, der Bearbeiten-Modus. Das Thema
     faerbt nur ueber CSS. Ein Takt, der am letzten Kampf etwas aendert,
     baut sie neu; einer ohne Aenderung nicht. */
  if(html === listeZuletzt) return;
  listeZuletzt = html;
  const keepFocus = focusKeeper(document.activeElement as HTMLElement | null, panel);
  panel.innerHTML = html;
  baumZaehlen(panel);
  panel.querySelectorAll<HTMLElement>(".fight").forEach(b => {
    /* Ein Kampf aus der Kampfwahl: waehlen, zeichnen, das Feld schliessen
       und den Fokus an den Knopf geben. Ist das Feld zu (ein Test klickt die
       Zeile direkt), tut kampfwahlSchliessen nichts. Entf auf der Zeile
       steht jetzt in 23-kampfwahl.ts: der Fokus bleibt im Suchfeld. */
    b.onclick = () => {
      waehleKampf(+b.dataset.i!);   // ein Kampf verlaesst Start, Einstellungen und Weeklies
      kampfwahlSchliessen(true);
    };
  });
  panel.querySelectorAll<HTMLElement>("[data-x]").forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    kampfEntfernen(state.encounters[+b.dataset.x!]!);
  });
  panel.querySelectorAll<HTMLElement>("[data-trash]").forEach(b => b.onclick = () => {
    const k = b.dataset.trash!;
    if(state.trashOpen.has(k)) state.trashOpen.delete(k); else state.trashOpen.add(k);
    renderFights();
  });
  panel.querySelectorAll<HTMLElement>("[data-fold]").forEach(b => b.onclick = () => {
    const key = +b.dataset.fold!;
    if(state.folded.has(key)) state.folded.delete(key); else state.folded.add(key);
    renderFights();
  });
  keepFocus();
  kwNachRender();
  /* A pull that has just landed is the one you want to see, and with the list
     open it can be below the fold once the night is long. Only when it is
     genuinely out of view — scrolling a list somebody is reading is worse
     than leaving it alone. */
  /* Gemessen wird nur, wenn ein anderer Kampf gewaehlt ist als beim letzten
     Neubau (Spezifikation Live-Leistung 4). Waechst im Live nur der laufende
     Kampf, steht seine Zeile, wo sie stand, und das Messen zwaenge bei jedem
     Takt die ganze Seite in ein neues Layout. */
  /* Nur der Beginn des Kampfes, nicht sein Platz: haelt das Live die
     Auswahl beim aelteren Kampf (#153), rueckt sein Platz mit jedem neuen
     Kampf weiter, und die offene Liste rollte sonst zu ihm zurueck. */
  const gewaehlt = String(state.encounters[state.sel]?.start ?? "");
  if(gewaehlt === gewaehltZuletzt) return;
  gewaehltZuletzt = gewaehlt;
  /* kwZeigen (23): ganz im Blick heisst auch nicht hinter dem klebenden Kopf
     seiner Gruppe (Feinschliff 02.10., Abschnitt 5). */
  const on = panel.querySelector<HTMLElement>(".fight.on");
  if(on) kwZeigen(on);
}

/* Einen gespeicherten Lauf entfernen - der einzige Weg dahin, fuer das
   Kreuz in der Leiste und das in der Vergleichsauswahl (28-compare.ts).
   Das war die einzige unumkehrbare Handlung der ganzen Schiene -
   ohne Rueckfrage, ohne Ruecknahme, ausgerechnet an dem, was man
   absichtlich behalten wollte. Der geloeschte Lauf liegt im
   Augenblick des Loeschens in der Hand, also ist die Ruecknahme ein
   Einfuegen an seinem alten Platz; neun Sekunden, wie ueberall hier.
   War er angehakt, ist er es danach wieder - hoechstens vier, wie beim
   Anhaken selbst. */
export function entferneLauf(r: SavedRun){
  const platz = state.runs.findIndex(o => o.id === r.id);
  if(platz < 0) return;
  const warVerglichen = state.cmpRuns.has(r.id);
  const neu = () => { persistConfig(); renderRuns(); syncCompareBtn(); renderCompare(); };
  state.runs = state.runs.filter(o => o.id !== r.id);
  state.cmpRuns.delete(r.id);
  neu();
  toast(tt("rail.runRemoved", {name: r.tag || r.name}), 9000, null,
    {label: tt("rail.clearedUndo"), fn: () => {
      state.runs.splice(Math.min(platz, state.runs.length), 0, r);
      if(warVerglichen && state.cmpRuns.size < 4) state.cmpRuns.add(r.id);
      neu();
      toast(tt("rail.fightBack", {name: r.tag || r.name}));
    }});
}

export function renderRuns(){
  const list = $("#runList"); list.innerHTML = "";
  /* Nur die Zahl. Neben "Gespeicherte Kaempfe" stand "keine" oder "3
     gespeichert" - die Ueberschrift sagte das Wort schon. Leer bleibt es,
     wenn nichts da ist: die Notiz darunter sagt dann, was zu tun ist. */
  $("#runCount").textContent = state.runs.length ? String(state.runs.length) : "";
  /* Der Satz nennt den Knopf, der hier ablegt. Auf der Gruppentafel heisst
     der Knopf oben "Gruppen-Log speichern" und legt nichts hierher - dann
     sagt der Satz, wo "Kampf speichern" steht, statt einen Knopf zu nennen,
     den es auf dem Bildschirm gerade nicht gibt. */
  $("#runNote").textContent = t(state.group === "party" ? "rail.runNoteParty" : "rail.runNote");
  runNoteSync();
  state.runs.forEach(r => {
    const row = el("div","run");
    const box = el("input"); box.type = "checkbox"; box.checked = state.cmpRuns.has(r.id);
    /* Ohne Namen meldete sich jedes dieser Kaestchen als
       "Kontrollkaestchen, nicht aktiviert" - zwoelfmal untereinander,
       und keines sagte, zu welchem Kampf es gehoert. Der Name steht im
       Geschwisterelement daneben, also wird er hier uebernommen. */
    box.setAttribute("aria-label", r.tag || r.name);
    box.onchange = () => {
      vonHand();   // von Hand gewaehlt: der Umschalter im Vergleich steht still (28-compare.ts)
      if(box.checked){
        if(state.cmpRuns.size >= 4){ box.checked = false; toastFail(tt("toast.fourRunsMax")); return; }
        state.cmpRuns.add(r.id);
      } else state.cmpRuns.delete(r.id);
      syncCompareBtn();
      renderCompare();
    };
    const t2 = el("div","t");
    // the saved runs sit directly under the fight rows in the same rail, so
    // they are ruled the same way — dotted and ruled lines stacked on each
    // other would have been the most visible disagreement of the lot
    /* Die Uhrzeit stand schon im Objekt - summarise() legt sie als `when`
       ab - und wurde nie gedruckt. Ohne sie sind drei Pulls auf denselben
       Boss drei wortgleiche Zeilen: der Namensdialog schlaegt den
       Bossnamen vor, also heissen sie meistens alle gleich. Genau der
       Fall, fuer den es die gespeicherten Kaempfe gibt.
       Zuerst in der Zeile, wie bei der Kampfzeile in der Liste. */
    t2.innerHTML = "<b title='"+esc(r.tag||r.name)+"'>"+esc(r.tag||r.name)+"</b><span class='num factline'>"+
      factLine([
        r.when ? wallTime(r.when) : null,
        r.noTime ? fmt(r.total)+" "+t("head.damage") : fmt(r.dps)+" "+t("bars.dps"),
        r.noTime ? null : dur(r.seconds)
      ])+"</span>";
    const x = el("button","x","✕");
    /* title UND aria-label: bei der Namensberechnung gewinnt der Inhalt,
       also meldete sich dieser Knopf als das Zeichen selbst und der title
       war tot. Der title bleibt fuer den Zeiger. */
    x.title = t("rail.removeRun");
    x.setAttribute("aria-label", t("rail.removeRun"));
    x.onclick = () => entferneLauf(r);
    row.append(box, t2, x);
    list.appendChild(row);
  });
  syncKwLaeufe();
}
