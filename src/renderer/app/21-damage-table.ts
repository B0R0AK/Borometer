import { state } from "./01-state";
import { fmt, full } from "./03-helpers";
import { t } from "./08-translation";
import { weaponLabel } from "./09-weapon-icons";
import { skillEntry } from "./10-skill-names";
import { KERN_BILD, skillMark } from "./11-skill-icons";
import { skillLabel } from "./14-questlog-weapons";
import { VENTIUS_NAME, ventiusPass } from "./15-weapons-and-ventius";
import { markiereRest, pct } from "./16-fight-analysis";
import { $, cssv, esc } from "./18-interface-basics";
import { groupRows, partyGroupRows } from "./19-grouping-and-party-fights";
import { barsRoving } from "./24-table-keyboard-and-timeline";
import { focusKeeper } from "./30-fight-list";
import { tafelGilt } from "./56-tafel";
import { renderGlutring } from "./64-glutring";
import type { BarFigures, BarSubRow, SkillCoreInfo } from "../types";

/* ---------- the bars ---------- */
/* Der Name einer Spalte, so wie er in ihrer Ueberschrift steht - fuer
   Saetze, die auf eine Spalte zeigen. */
function sortLabel(key: string){
  const c = barCols(state.group, tafelBreit()).find(x => x.k === key);
  return c ? c.t : key;
}
function barCols(mode: string, breit: boolean){
  return [
    {k:"rank", t:"#"}, {k:"name", t: mode === "party" ? t("party.colPlayer") : t("bars.name")},
    {k:"damage", t:t("bars.damage")}, {k:"dps", t:t("bars.dps")},
    {k:"share", t:t("bars.share")}, {k:"hits", t:t("bars.hits")}, {k:"max", t:t("bars.biggest")},
    {k:"critRate", t:t("bars.crit")}, {k:"heavyRate", t:t("bars.heavy")}
  ].filter(c => !breit || (!NUR_SCHMAL.has(c.k) && c.k !== "rank"));
}
/* Issue #53: in der breiten Tafel steht der Balken in einer eigenen Spalte,
   und dafuer gehen zwei Zahlenspalten in die aufgeklappte Zeile - Anteil
   sortiert ohnehin wie Schaden, und der groesste Treffer des Kampfes steht
   oben in der Werteleiste. Schmal (bis 640) und im Kompaktmodus bleibt die
   Tafel, wie sie war: dort blendet das Stylesheet Spalten nach Sprossen aus,
   und Anteil ist eine davon, die stehen bleibt.
   Gebaut wird je nach Breite, nicht versteckt: Kopf und Zeilen tragen so
   immer dieselbe Zahl Zellen, und ein Vorleser hoert keine Spalte, die es
   auf dem Schirm nicht gibt. syncWidthStops() zeichnet neu, wenn die
   Sprosse wechselt (tafelNachBreite). */
const NUR_SCHMAL = new Set(["share", "max"]);
/* Neugestaltung 28.09. (Luecke 2.8): breit steht keine Rangspalte mehr -
   die Ordnung sagt die sortierte Spalte, und der Balken ist eine Spur unter
   dem Namen statt einer eigenen Spalte (styles.css, #bars.breit). Schmal und
   im Kompakt bleibt die Tafel mit Rang, wie sie war. */
export function tafelBreit(){
  return !document.documentElement.classList.contains("w-max-640") &&
         !document.body.classList.contains("compact");
}
/* Die Tafel steht in der anderen Form, als die Breite verlangt: neu
   zeichnen. Nur wenn sie ueberhaupt steht - geleert (32-history) bleibt
   sie leer. */
export function tafelNachBreite(){
  const box = document.querySelector<HTMLElement>("#bars");
  // die Liste neben dem Ring (64) hat keine breite und keine schmale Form
  if(!box || !box.querySelector(".bhead") || box.classList.contains("ring")) return;
  if(box.classList.contains("breit") !== tafelBreit()) renderBars();
}
/* Only the multiplier is left. A "Crit" badge beside a row named "Critical
   Hit" restated the row's own name — the same redundancy as the crit and
   heavy columns on these rows, one step to the left. "×2" is different: it
   says what a heavy hit does, which the name never says.
   The category's colour is not lost with the badge — every sub-row already
   carries its CAT_SWATCH tick before the name. */
/* The one row in this app whose name the log did not write. The numbers are
   the log's own - nothing is estimated - but the name is a reading, so it
   says so, and the title carries the rule that produced it. */
/* ---------- Skillkerne ----------
   Ein Skillkern ist kein Skill, sondern ein Gegenstand: auf eine heroische
   Ruestung oder ein Accessoire gepraegt, ersetzt er einen vorhandenen
   Skill. Im Log steht danach der Name des KERNS - wer die Zeile liest,
   sucht den ersetzten Skill sonst vergeblich in seiner Leiste. Deshalb
   traegt die Zeile eine Marke, und deren Tooltip nennt den ersetzten
   Skill.

   Woran man einen Kern erkennt, ohne ihn zu kennen: sein Symbol traegt im
   Spiel ein achteckiges Metallgehaeuse, ein gewoehnliches Skill-Symbol
   ist ein volles Quadrat. Das ist messbar - die 275 Symbole aus dem Feed
   liegen bei 0,0 % Durchsicht, die beiden Kerne hier bei 40,6 und 40,7 %.

   gemessen:true heisst: welchen Skill der Kern ersetzt, steht nicht in
   dieser Tabelle, sondern kommt aus dem Log. Das gilt fuer Auge von
   Ventius, dessen Namen die App ohnehin aus der Trefferform liest. Das
   Feld dazu nennt den Text, der das erklaert und frueher am Auge hing;
   er steht jetzt hinter "Skillkern." im selben Tooltip.
   Ohne base und ohne weapon bleibt es bei "Skillkern." Geraten wird
   nichts.
   eigen:true heisst: dieser Kern ersetzt gar nichts, er bringt seinen
   Skill selbst mit. Das ist keine fehlende Angabe, sondern eine Angabe,
   und der Satz sagt es, weil die Marke die Frage ja gerade aufwirft. */
const SKILL_CORE: Record<string, SkillCoreInfo> = {
  "Blade Storm": {base: "Rapid Shot", parent: "Multi-Shot"},
  "Silver Reaper's Soul Harvest": {weapon: "Crossbow", eigen: true},
  /* Ersetzt KEINEN Skill. Die Datenbank von questlog fuehrt zwei
     Kerne - Perk_wand_aa_t2_polymorph_001 "Tevent's Hunger" und
     _003 "Enraged Tevent's Hunger" -, und beide haengen an Curse of
     the Wand: 15 % Chance auf Weaken: Curse, 35 % Grundschaden je
     Sekunde, der erzuernte zusaetzlich -10 % Abwehr. Der erzuernte
     ist die staerkere Stufe desselben Kerns, nicht der Ersatz einer
     Faehigkeit. Hier stand kurz "Er ersetzt Tevent's Hunger"; das
     war eine Lesart einer Auskunft, die die Quelle nicht deckt. */
  "Enraged Tevent's Hunger": {weapon: "Wand and Tome", eigen: true},
  "Slash Wave": {bases: ["Valiant Brawl", "Cruel Smite"]},
  /* Ersetzt keinen Skill: laesst bei Kollision, Schock oder
     Betaeubung mit Grossschwertfertigkeiten einen Bereich
     explodieren. Die Waffe steht im Text des Kerns selbst. */
  "Enraged Tevent's Despair Trap": {weapon: "Greatsword",
                                    eigen: true},
  /* "Changes Corrupted Magic Circle to [Sacred Magic Circle]" -
     und den Basis-Skill kennt die App samt Waffe. */
  "Sacred Magic Circle": {base: "Corrupted Magic Circle"},
  /* ---------- aus der Kernliste von questlog.gg, 22.09.2026 ----------
     Dort stehen 271 Kerne. Nur 27 sprechen in ihrem eigenen Text einen
     Ersatz aus ("Changes X to [Y]"), und nur die koennen im Log
     ueberhaupt unter eigenem Namen stehen - ein Kern, der bloss
     verstaerkt, schreibt nichts Neues hinein.

     Drei davon standen schon oben, und alle drei decken sich mit der
     Quelle: Blade Storm auf Rapid Shot, Slash Wave auf Valiant Brawl
     und Cruel Smite, Sacred Magic Circle auf Corrupted Magic Circle.

     Geraten ist nichts - jeder Eintrag steht so im Text des Kerns.
     Was die App aber noch nicht kann: von diesen Namen kennt ihr
     Woerterbuch nur zwei. In einem englischen Log greift der Eintrag
     ueber den Namen; in einem deutschen erst, wenn das Woerterbuch das
     Paar gelernt hat - aus einer gemischten Gruppe oder von Hand. */
  "Dragon's Intimidation": {base: "Fountain of Life"},
  "Earth Strike": {base: "A Shot at Victory"},
  "Explosive Arrow": {bases: ["Recoil Shot", "Wave Shot"]},
  /* Blue Flash tauscht zwei Faehigkeiten auf einmal: Javelin Inferno wird Lightning Javelin, Explosive Fury wird Explosive Lightning Slash. */
  "Explosive Lightning Slash": {base: "Explosive Fury"},
  "Frost Expansion": {base: "Rapid Shot"},
  "Gale Arrow": {base: "Strafing"},
  "Ice Dragon Strike": {base: "Flash Wave"},
  "Icebound Spike": {base: "Icebound Tomb"},
  "Immortal Bond": {base: "Blessing of Immortality"},
  "Lightning Javelin": {base: "Javelin Inferno"},
  /* Die Quelle nennt die Spezialisierung: "Fatal Stigma Specialization Area Damage". Der ersetzte Skill ist Fatal Stigma. */
  "Massacre": {base: "Fatal Stigma"},
  "Nebula's Resonance": {base: "Restoring Constellation"},
  "Nightmare Melody": {base: "Cursed Nightmare"},
  /* Dieselben zwei Faehigkeiten, an denen das Auge von Ventius haengt - der Kern tauscht sie beide gegen einen Schuss. */
  "Pierce Shot": {bases: ["Decisive Sniping", "Decisive Bombardment"]},
  "Prismatic Beam": {base: "Ray of Disaster"},
  "Purifying Cry": {base: "Purifying Touch"},
  "Purifying Star": {base: "Healing Star"},
  "Roar of Rage": {base: "Cleaving Roar"},
  "Rock Arrow": {base: "Brutal Arrow"},
  "Rock Shield Throw": {base: "Shield Throw"},
  "Stellar Star Destroyer": {base: "Star Destroyer"},
  "Support Fire": {base: "Explosive Trap"},
  "Tectonic Shift": {base: "Interstellar Explosion"},
  /* Die Quelle sagt "Inner Peace Specialization 1 [Thunder's Blessing]": getauscht wird die Spezialisierung von Inner Peace. */
  "Thunder's Shadow": {base: "Inner Peace"},
  "Wall of Bitter Cold": {base: "Stalwart Bastion"},
  /* Vier, die beim ersten Durchgang durchs Raster fielen: ihr
     englischer Text sagt den Ersatz ohne eckige Klammern. Aufgefallen
     sind sie beim Abgleich mit der deutschen Liste, die ihn in
     Anfuehrungszeichen setzt. */
  "Battlefield Frenzy": {base: "Death Knell"},
  /* Zwei Kerne, ein Ergebnis: "Hagel der Sintflutbringerin (Erzuernt)"
     und "Hagel der Unbarmherzigen Sintflutbringerin" machen beide aus
     Hoellenfeuerregen einen Eisregen. Im Log steht danach Eisregen. */
  "Ice Rain": {base: "Hellfire Rain"},
  "Seed of the World Tree": {base: "Nature's Blessing"},
  "Slaughtering Execution": {base: "Enforcer"},
  // Eye of Ventius comes in setup(): its name is another module's, and
  // while this one loads that module may not have run yet
};
/* Wer nicht im Woerterbuch steht, dessen deutscher Name findet den
   englischen Eintrag nicht - coreBadge() geht dafuer ueber
   skillEntry(), und das kennt nur, was in SKILL_ID_NAME steht. Diese
   zwei stehen dort nicht, weil ihre IDs bisher nur in einer Sprache
   gesehen wurden. Ohne die Spiegelung truege die Zeile im deutschen
   Log keine Marke, und genau dort steht sie. Gespiegelt wird auf
   dasselbe Objekt, die zwei koennen also nicht auseinanderlaufen. */
for(const [de, en] of [
  ["Verzweiflungsfalle des Tevent (Erzürnt)", "Enraged Tevent's Despair Trap"],
  /* Die deutschen Namen aus derselben Liste, ueber das Symbol je Kern
     mit der englischen zusammengefuehrt: 271 zu 271, jede Zeile
     getroffen. "Heiliger magischer Kreis" stand hier schon von Hand und
     deckt sich - die Gegenprobe fuer den Rest.
     Gespiegelt wird auf dasselbe Objekt, die zwei Sprachen koennen also
     nicht auseinanderlaufen. */
  ["Klingensturm", "Blade Storm"],
  ["Blitzspeer", "Lightning Javelin"],
  ["Explosiver Blitzhieb", "Explosive Lightning Slash"],
  ["Einschüchterung des Drachen", "Dragon's Intimidation"],
  ["Erdschlag", "Earth Strike"],
  ["Explosiver Pfeil", "Explosive Arrow"],
  ["Frostausbreitung", "Frost Expansion"],
  ["Sturmpfeil", "Gale Arrow"],
  ["Eisdrachen-Hieb", "Ice Dragon Strike"],
  ["Eisgebundener Stachel", "Icebound Spike"],
  ["Unsterbliche Bindung", "Immortal Bond"],
  ["Massaker", "Massacre"],
  ["Nebulas Resonanz", "Nebula's Resonance"],
  ["Albtraummelodie", "Nightmare Melody"],
  ["Durchbohrender Schuss", "Pierce Shot"],
  ["Prismatischer Strahl", "Prismatic Beam"],
  ["Läuternder Schrei", "Purifying Cry"],
  ["Läuternder Stern", "Purifying Star"],
  ["Schrei der Raserei", "Roar of Rage"],
  ["Felspfeil", "Rock Arrow"],
  ["Steinschildwurf", "Rock Shield Throw"],
  ["Heiliger magischer Kreis", "Sacred Magic Circle"],
  ["Hiebwelle", "Slash Wave"],
  ["Stellar-Sternenzerstörer", "Stellar Star Destroyer"],
  ["Unterstützungsfeuer", "Support Fire"],
  ["Tektonische Verschiebung", "Tectonic Shift"],
  ["Schatten des Donners", "Thunder's Shadow"],
  ["Wall der bitteren Kälte", "Wall of Bitter Cold"],
  ["Schlachtfeld-Raserei", "Battlefield Frenzy"],
  ["Eisregen", "Ice Rain"],
  ["Samen des Weltenbaums", "Seed of the World Tree"],
  ["Abschlachtende Hinrichtung", "Slaughtering Execution"],
] as [string, string][]) SKILL_CORE[de] = SKILL_CORE[en]!;   // every English name above is in the table
/* Gezeichnet und nicht gesetzt, aus demselben Grund wie zuvor das Auge:
   kein Zeichensatz, auf den diese App zaehlen kann, fuehrt einen
   geschliffenen Stein, und bei 13 Punkten waere ein Buchstabe ein Fleck.
   Aussen die Fassung, innen der Stein. */
const CORE_GEM =
  '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">'+
    '<path d="M9 1.4 15.6 5.2v7.6L9 16.6 2.4 12.8V5.2Z" fill="none"'+
      ' stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'+
    '<path d="M9 5.9 12.1 7.7v3.6L9 13.1 5.9 11.3V7.7Z" fill="currentColor"/>'+
  '</svg>';
export function coreBadge(name: string, sid: string | undefined, base: ReturnType<typeof ventiusPass> | undefined){
  const e = skillEntry(name, sid);
  const k = SKILL_CORE[name] || (e && e.en && SKILL_CORE[e.en]) || null;
  if(!k) return "";
  let titel = t("bars.core"), vorlesen = t("bars.coreLabel");
  if(k.gemessen){
    if(k.dazu) titel += " " + t(k.dazu,
      {base: base ? skillLabel(base.name, base.sid) : "—"});
    /* Die Marke sagt hier zweierlei, also sagt sie einem Vorleser auch
       zweierlei: ein Kern ist es, und den Namen hat die App selbst
       erkannt. */
    vorlesen += ", " + t("bars.derived");
  }
  else if(k.bases) titel = t("bars.coreOr",
    {a: skillLabel(k.bases[0]), b: skillLabel(k.bases[1])});
  // a specialisation core names its base as well as its parent
  else if(k.parent) titel = t("bars.coreSpec", {base: skillLabel(k.base!),
                                                parent: skillLabel(k.parent)});
  else if(k.base) titel = t("bars.coreBase", {base: skillLabel(k.base)});
  else if(k.weapon) titel = t("bars.coreWeapon", {w: weaponLabel(k.weapon)});
  if(k.eigen) titel += " " + t("bars.coreNone");
  /* Die Kerne mit Bild von questlog (KERN_BILD, 11-skill-icons.ts; ohne
     Bild nur Ice Rain, test-kerne-core) tragen ihr Symbol; die anderen die
     gezeichnete Marke. Tooltip und Name
     fuer den Vorleser bleiben dieselben. */
  const bild = KERN_BILD[name] || (e && e.en && KERN_BILD[e.en]) || "";
  return '<i class="cmark'+(bild ? " kernbild" : "")+'" title="'+esc(titel)+'" role="img" aria-label="'+
    esc(vorlesen)+'">'+(bild ? '<img src="'+bild+'" alt="" aria-hidden="true">' : CORE_GEM)+"</i>";
}
function catBadges(key: string){
  const heavy = key === "heavy" || key === "critheavy";
  // the badge alone was never explained; the title says what it claims
  const was = esc(t("bars.heavyTimes2"));
  return heavy ? '<i class="catb heavy" title="'+was+'" aria-label="'+was+'">×2</i>' : "";
}
/* Read out of the stylesheet rather than written here, because these are
   bar fills and a fill has to hold against whichever ground is behind it:
   "heavy" was a pale beige, which on paper is the paper. */
export const CAT_SWATCH: Record<string, string> = {};
export function loadSwatches(){
  CAT_SWATCH.normal = cssv("--cat-normal");
  CAT_SWATCH.crit = cssv("--cat-crit");
  CAT_SWATCH.heavy = cssv("--cat-heavy");
  CAT_SWATCH.critheavy = cssv("--cat-critheavy");
  CAT_SWATCH.shield = cssv("--cat-shield");
}

/* Welcher Kampf zuletzt gezeichnet wurde - an seiner Startzeit, nicht an
   seinem Platz in der Liste. Der Platz verschiebt sich, wenn eine Zeile
   aus der Schiene genommen wird; der Kampf bleibt derselbe. */
let letzterKampf: number | null | undefined;
/* Ab 1100 Punkt Breite steht die erste Faehigkeit eines neuen Kampfes offen
   (Neugestaltung 28.09., Luecke 2.9, wie im Entwurf) - bis jemand selbst
   eine Zeile auf- oder zuklappt; ab da gilt nur noch, was er geklappt hat. */
let aufSelbst = false;
const ersteOffen = () => !document.documentElement.classList.contains("w-max-1099") &&
  !document.body.classList.contains("compact");
export function renderBars(){
  const inParty = state.group === "party";
  const seg = state.encounters[state.sel]!;
  if(!seg && !inParty) return;
  /* Die Sortierung gehoert dem Leser, nicht dem Kampf - und deshalb faengt
     jeder Kampf bei der Vorgabe an. Aus der Nutzung: einmal nach Stark
     sortiert, und jeder Pull des Abends oeffnete mit einer
     Ein-Treffer-Faehigkeit auf Platz eins, weil die Sortierung den
     Kampfwechsel ueberlebte. */
  const jetzt = seg ? seg.start : null;
  const neuerKampf = jetzt !== letzterKampf;
  if(neuerKampf){
    letzterKampf = jetzt;
    state.sortBars = {key:"damage", dir:-1};
  }
  /* Im Bereich Kampf der vollen Ansicht steht die Liste neben dem Glutring
     (Spezifikation Glutring 4, 64-glutring.ts). Die Sortierung oben gilt
     fuer beide Formen - Kompakt behaelt die Wahl der Vollansicht (Probe
     11.2) -, gezeichnet wird hier nur noch Kompakt. */
  /* Das Aufgeklappte dieser Tabelle gehoert zum Kampf, auch wenn er im
     Glutring gewechselt wurde: vor dem Abgeben, sonst zeichnete 21 danach
     (Kompakt, ein anderer Bereich) die offenen Zeilen des vorigen Kampfes
     (Gesamtpruefung Glutring, I1). Die Zeilen nur hier und nur bei einem
     neuen Kampf - der Live-Takt rechnet sie nicht doppelt. */
  if(neuerKampf && !aufSelbst && state.group === "skill" && seg){
    state.expanded.clear();
    const erste = groupRows(seg, "skill").sort((a, b) => b.damage - a.damage)[0];
    if(erste && erste.subs.length && ersteOffen()) state.expanded.add(erste.name);
  }
  if(tafelGilt()){ renderGlutring(); return; }
  $("#bars").classList.remove("ring");
  const rows = inParty ? partyGroupRows() : groupRows(seg, state.group);
  const breit = tafelBreit();
  /* Breit gibt es Anteil und Groesster Treffer nicht als Spalte, also auch
     nicht als Sortierung: eine Ordnung, fuer die nichts auf dem Schirm
     einsteht, faellt auf die Vorgabe zurueck. */
  if(breit && NUR_SCHMAL.has(state.sortBars.key)) state.sortBars = {key:"damage", dir:-1};
  /* Der Streifen im Kompakt zeigt Top 5 nach Schaden, was immer die
     Vollansicht gewaehlt hat (Pruefung Aufgabe 9, W2): eine eigene Ordnung,
     state.sortBars bleibt unangetastet und gilt zurueck in der Vollansicht.
     Sortieren laesst sich dort nicht - der Kopf ist nur fuer den Vorleser. */
  const kompakt = document.body.classList.contains("compact");
  const st: typeof state.sortBars = kompakt ? {key:"damage", dir:-1} : state.sortBars;
  /* Bei Gleichstand entscheidet die Trefferzahl. Eine Quote aus zwei
     Einsaetzen ist genauso "100 %" wie eine aus zweihundert, und ohne
     diesen zweiten Schluessel stand die kleinere Stichprobe mal oben und
     mal unten, je nachdem, wie die Liste vorher lag. Nur bei Gleichstand -
     die Ordnung nach der gewaehlten Spalte wird nicht angetastet. */
  const sorted = rows.slice().sort((a,b) => {
    if(st.key === "rank") return 0;
    if(st.key === "name") return st.dir*a.label.localeCompare(b.label);
    // the sort column is a column key: text for names, a number otherwise
    const x = a[st.key] as string | number, y = b[st.key] as string | number;
    if(typeof x === "string") return st.dir*x.localeCompare(y as string);
    return st.dir*(((x as number)||0)-((y as number)||0)) || ((b.hits||0)-(a.hits||0));
  });
  /* The bar has to encode what the table is ordered by. Sorted by Treffer,
     rank 1 was Protest der Mutter Natur at 0,4% of the damage drawing an
     invisible track, with a full-width bar on rank 2 beneath it. Name and
     rank have no magnitude, so those keep the damage bar. */
  const metric = (st.key === "name" || st.key === "rank") ? "damage" : st.key;
  const peak = Math.max(...rows.map(r => (r[metric] as number) || 0), 1);
  // an open row follows its parent, or the table reads in two orders at once
  const subSort = (subs: BarSubRow[]) => st.key === "rank" ? subs : subs.slice().sort((a,b) => {
    if(st.key === "name") return st.dir*a.label.localeCompare(b.label);
    const x = a[st.key] as string | number, y = b[st.key] as string | number;
    return typeof x === "string" ? st.dir*x.localeCompare(y as string)
                                 : st.dir*(((x as number)||0)-((y as number)||0));
  });
  /* Each cell carries the key its header carries. Compact hides columns to fit
     364px and used to hide them by position, which meant it could rank the
     whole list by Crit and then hide the Crit column, leaving an order with
     nothing on screen to account for it. Keyed, the sorted one can be kept. */
  /* Eine Schreibweise je Spalte, in beiden Ansichten.

     fmt() schreibt zwischen 1.000 und 9.999 mit dem Tausendertrennzeichen
     der Sprache und darueber die k-Form mit einem Punkt als Komma. Auf
     Deutsch stand damit in der DPS-Spalte untereinander: 176.3k, 9.572,
     5.961, 5.462 - in der ersten Zeile ein Komma, ab der zweiten ein
     Tausenderpunkt. Wer die Spalte von oben liest, wendet auf die zweite
     Zeile die Regel an, die ihm die erste beigebracht hat, und liest
     neuneinhalb statt neuntausendfuenfhundert.

     Dieselbe Sammelstelle traf die Schadensspalte an ihrer Grenze
     (19.5k, 17.3k, 6.278) und die Spalte "Groesster Treffer" in sich.

     Der naheliegende Weg - im Deutschen ein Komma in der k-Form - steht
     oben in fmt() ausdruecklich verworfen: in dieser Anzeigeschrift
     erscheint es als Fleck. Also die Schwelle, nicht das Zeichen. Ab 1.000
     gilt die k-Form, und damit traegt jede Zahl in diesen Spalten dieselbe
     Bauart. Genauigkeit kostet das nichts, was die Spalte nicht ohnehin
     ueberall darueber verlaere: drei geltende Ziffern, wie bei 176.3k.

     full() bleibt unberuehrt - "7.597.319" hat sieben Stellen und zwei
     Punkte und liest sich von niemandem als Komma. */
  const kurzAb = 1e3;
  const cell = (r: BarFigures, cls?: string) =>
    '<span data-k="damage" role="gridcell" class="v '+(cls||"")+'">'+fmt(r.damage, kurzAb)+"</span>"+
    '<span data-k="dps" role="gridcell" class="v dps">'+(state.noTime?"—":fmt(r.dps, kurzAb))+"</span>"+
    (breit ? "" : '<span data-k="share" role="gridcell" class="v'+(showSort&&st.key==="share"?" showsort":"")+'">'+pct(r.share, 1)+"</span>")+
    '<span data-k="hits" role="gridcell" class="v soft'+(showSort&&st.key==="hits"?" showsort":"")+'">'+full(r.hits)+"</span>"+
    // the same em dash the dps column uses when there is no clock: a figure
    // that was never reported is not a zero
    /* Mit derselben Schwelle wie Schaden und DPS. Sie hat hier beim ersten
       Mal gefehlt, und die Spalte trug damit weiter beide Bedeutungen des
       Punktes untereinander: 15.7k, 138.8k, 11.5k, 5.195, 21.9k, 5.021 -
       oben ein Komma, unten ein Tausenderpunkt. In einer Zeile stand
       "Schaden 7.5k" (7500) neben "Groesster Treffer 7.543" (7543). */
    (breit ? "" : '<span data-k="max" role="gridcell" class="v soft'+(showSort&&st.key==="max"?" showsort":"")+'">'+(r.max==null?"\u2014":fmt(r.max, kurzAb))+"</span>")+
    /* Die Quote traegt ihren Nenner im title. "100 %" sagt ohne ihn nichts:
       nach Kritisch sortiert stand ein Skill mit zwei Treffern auf Platz
       eins, waehrend der mit 649 Treffern und 65 Prozent auf Platz sechs
       sass. Die Trefferspalte steht zwar daneben - aber nicht in jeder
       Fensterbreite, und wer die Zahl vorliest, bekommt sie so mit.
       Der Grundsatz dazu: eine Zahl aus einem einzigen Einsatz ist
       nichts wert. */
    '<span data-k="critRate" role="gridcell" class="v soft'+(showSort&&st.key==="critRate"?" showsort":"")+'"'+
      (r.critRate==null?"":' title="'+esc(t("bars.rateBase",{n:r.hits}))+'"')+
      '>'+(r.critRate==null?"\u2014":pct(r.critRate))+"</span>"+
    '<span data-k="heavyRate" role="gridcell" class="v soft'+(showSort&&st.key==="heavyRate"?" showsort":"")+'"'+
      (r.heavyRate==null?"":' title="'+esc(t("bars.rateBase",{n:r.hits}))+'"')+
      '>'+(r.heavyRate==null?"\u2014":pct(r.heavyRate))+"</span>";
  /* The bar leaves here as a bare fraction, not a percentage, so the
     stylesheet can choose the length of the track. Compact ends it before the
     number columns: dim text on a full-strength bar measured 2.33:1 there. */
  // clamped: a sub-row carries its own rate, which can run past every
  // parent's, and party sub-rows carry no max/crit/heavy at all
  /* role="presentation": der Balken ist absolut positioniert und traegt
     keinen Text. Als Zelle gezaehlt haette jede Zeile eine Spalte zu viel und
     ein Vorleser saehe vor jeder Zeile eine leere. Aus dem Baum, nicht aus
     dem Layout. */
  /* Nur der Balken, der den Spaltenrand erreicht, laeuft aus (.fill.aus):
     Rang 1 - und wer mit ihm gleichauf liegt. Eine volle Flaeche mit harter
     Endkante bis an den Rand las sich als "ausgewaehlt" statt "am
     groessten". Zuerst lief jeder Balken ab 60 % aus; dann endete einer bei
     0,62 sichtbar um 0,54, waehrend sein Nachbar bei 0,59 scharf bis 0,59
     stand - Rang 2 sah kuerzer aus als Rang 3. Am Rand gibt es keinen
     Nachbarn, der laenger aussehen koennte, und der Schwanz bleibt blass
     sichtbar bis zum Rand (styles.css). Seit Issue #53 laeuft er nur noch
     im Kompaktmodus aus; sonst liegt kein Balken mehr unter Schrift, und
     die Bahn zeigt, dass er voll ist. */
  const bar = (r: BarFigures, colour: string | undefined) => {
    const w = Math.min(1, Math.max(0, ((r[metric] as number)||0)/peak));
    return '<span class="fill'+(w >= .999 ? " aus" : "")+'" role="presentation" style="--w:'+
      w.toFixed(4)+';--c:'+colour+'"></span>';
  };

  /* The rank column is the one header that does not sort, so it is the one
     that stays out of the tab order. aria-sort says which way the sorted
     column is pointing, which the arrow only shows visually. */
  /* Im schmalen Fenster (w-max-640/560) blendet die Tafel Spalten nach
     Sprossen aus. Wonach sortiert ist, kommt zurueck (.showsort in
     styles.css) - sonst stuende eine Ordnung ohne Spalte da, die sie
     erklaert. Nur in der Vollansicht: der Streifen im Kompakt ordnet
     ohnehin nach Schaden. */
  const WIRD_AUSGEBLENDET = new Set(["hits","max","critRate","heavyRate"]);
  const showSort = !kompakt && WIRD_AUSGEBLENDET.has(st.key);
  const spalten = barCols(state.group, breit);
  /* Die Detailzeile unter einer aufgeklappten Zeile (nur breit): was aus den
     Spalten gewandert ist, als Satz ueber den Unterzeilen. Eine Zelle ueber
     alle Spalten; der Vorleser bekommt den Satz in der Reihenfolge
     "Anteil am Schaden 80,7 %", die Zahlen stehen fuers Auge vorn. Der
     groesste Treffer fehlt, wo ein Bericht ihn nicht mitbrachte (Gruppe). */
  const detail = (r: BarFigures, name: string, katMode: boolean) => {
    const anteil = pct(r.share, 1);
    const max = r.max ? fmt(r.max, kurzAb) : "";
    // data-detail: focusKeeper findet die Zeile nach dem Neuzeichnen wieder
    return '<div class="row sub bdetail" role="row" aria-level="2" tabindex="-1" data-detail="'+esc(name)+'">'+
      '<span class="dz" role="gridcell" aria-colspan="'+spalten.length+'" aria-label="'+
        esc(t("bars.detailLabel", {share: anteil, max}))+'">'+
        '<b>'+esc(anteil)+"</b> "+esc(t("bars.shareOf"))+
        (max ? ' <span class="dzsep" aria-hidden="true">\u00b7</span> <b>'+esc(max)+"</b> "+esc(t("bars.biggest")) : "")+
        (katMode ? ' <span class="dzsep" aria-hidden="true">\u00b7</span> <span class="dzkat">'+esc(t("bars.byHitType"))+"</span>" : "")+
      "</span></div>";
  };
  $("#bars").classList.toggle("breit", breit);
  let html = '<div class="bhead" role="row">' + spalten.map(c => {
    // im Kompakt sortiert der Kopf nicht und bekommt keinen Tabstopp (W3): er ist unsichtbar
    const sortable = c.k !== "rank" && !kompakt;
    const dir = st.key===c.k ? (st.dir<0?"descending":"ascending") : "none";
    /* columnheader statt button. aria-sort gilt nach ARIA 1.2 nur auf
       columnheader und rowheader - auf role="button" wurde es verworfen, die
       Sortierrichtung stand also im Markup und kam nie bei einem Vorleser an.
       Die Kopfzelle sagt jetzt "Spaltenkopf, absteigend sortiert" statt
       "Schalter"; tabindex bleibt, an der Tastatur aendert sich nichts. Die
       Rangspalte sortiert nicht und bleibt ohne tabindex - ein Spaltenkopf
       ist sie trotzdem. */
    /* Die Rangspalte sagt, wonach sie gerade ordnet. "#" heisst in einem
       Schadensmesser fuer jeden Leser "Platz nach Schaden" - nach einem
       Klick auf Kritisch heisst es etwas anderes, und nichts ausser einem
       Pfeil in 10,5 Punkt sagte das. Der Platz selbst bleibt, was er ist:
       die Stelle in der Liste. */
    const rangTitel = c.k === "rank" && st.key !== "damage"
      ? ' title="'+esc(t("bars.rankOrder", {col: sortLabel(st.key)}))+'"' : "";
    return '<span data-k="'+c.k+'" role="columnheader" class="'+(st.key===c.k?"sorted":"")+'"'+
      /* Ein Tabstopp fuer den ganzen Kopf, auf der sortierten Spalte - wie
         bei den Zeilen darunter. Acht Kopfzellen waren acht Tabstopps
         zwischen der Leiste und der ersten Zeile; die Pfeiltasten gehen
         jetzt quer (24-table-keyboard-and-timeline.ts). */
      rangTitel+(sortable?' tabindex="'+(st.key===c.k?0:-1)+'" aria-sort="'+dir+'"':"")+">"+esc(c.t)+
      /* Der Pfeil ist fuers Auge; die Richtung sagt aria-sort. Im Namen
         las ein Vorleser sonst "Schaden Pfeil nach unten, absteigend". */
      (st.key===c.k ? '<span aria-hidden="true">'+(st.dir<0?" ↓":" ↑")+"</span>" : "")+"</span>";
  }).join("") + "</div>";

  sorted.forEach((r,i) => {
    const open = state.expanded.has(r.name);
    const can = r.subs.length > 0;
    const catMode = can && state.group === "skill";
    html += '<div class="row'+(can?" has-sub":"")+(open?" open":"")+
      /* tabindex auf JEDE Zeile, nicht nur auf die aufklappbaren. Eine
         Faehigkeit ohne Unterzeilen wurde von der Tabulatortaste
         uebersprungen - gemessen elf von zwoelf Zeilen erreichbar, und die
         zwoelfte war keine andere Art Zeile, sie hatte nur nichts zum
         Aufklappen. */
      /* tabindex -1 auf JEDER Zeile: der Kasten hat einen Tabstopp, und
         innerhalb bewegen die Pfeiltasten den Fokus - so beschreibt die
         Vorlage ein treegrid, und der Weg durch die Anwendung wird um
         elf Stationen kuerzer. barsRoving() gibt einer Zeile die 0. */
      (r.rest?" rest":"")+'" role="row" aria-level="1" tabindex="-1"'+
      /* Der rohe Name, damit Zeigen und Fokus die Spur in der Kurve finden
         (56-tafel.ts) - nur, wo eine Zeile eine Faehigkeit ist. */
      (state.group === "skill" ? ' data-skill="'+esc(r.name)+'"' : "")+
        (can?' data-open="'+esc(r.name)+'" aria-expanded="'+
             (open?"true":"false")+'"':"")+">"+
      bar(r, r.color) + (breit ? "" : '<span class="rank" role="gridcell">'+(i+1)+"</span>")+
      /* Der Pfeil und der Farbtupfer sind Zeichen, keine Auskunft: ohne
         aria-hidden liest ein Vorleser vor jedem Namen ein Zeichen vor, das
         nichts bedeutet. Der Aufklappzustand steht auf der Zeile selbst. */
      /* Der Pfeil sagt selbst, was er aufklappt (title), statt eines
         Satzes unter der Tabelle, der es fuer alle Zeilen auf einmal sagte.
         Fuer die Sprachausgabe steht der Zustand weiter in aria-expanded. */
      '<span class="nm" role="gridcell">'+(can?'<span class="twist" aria-hidden="true" title="'+esc(twistTitel(open))+'">›</span>':'<span class="twist" aria-hidden="true"></span>')+
        (r.icon != null ? r.icon : skillMark(r.name, r.sid, r.color, r.rest))+
        '<span class="nmt" title="'+esc(r.label)+'">'+esc(r.label)+"</span>"+coreBadge(r.name, r.sid, seg && seg.ventiusBase)+
          /* Not under Waffen: a weapon is not a thing that has a shield,
             and the badge on that row reads as if it were. Elsewhere it
             marks a row exactly when opening it would not reveal the
             shield - which also covers a skill whose hits were ALL shield
             hits, where the one-category cull takes the expander away. */
          (state.group !== "weapon" && (r.shieldDmg ?? 0) > 0 &&
           !r.subs.some(x => x.key === "shield")
            ? '<i class="catb shieldb" title="'+esc(t("bars.shieldRowTitle",
                {dmg: full(r.shieldDmg ?? 0)}))+'">'+esc(t("hitcat.shield"))+"</i>" : "")+
          "</span>"+
      cell(r, "strong") + "</div>";
    if(can && open && breit) html += detail(r, r.name, catMode);
    if(can && open) subSort(r.subs).forEach(s => {
      const swatch = catMode ? CAT_SWATCH[s.key] : r.color;
      /* Eine dritte Ebene, und nur dort, wo sie etwas zu sagen hat: in der
         Gruppe traegt eine Faehigkeit ihre Trefferarten. Beim eigenen
         Schaden SIND die Unterzeilen schon die Trefferarten - da gibt es
         nichts mehr aufzuklappen. */
      const tiefer = !catMode && s.subs && s.subs.length > 1;
      const tk = r.name + "\u0000" + s.key;
      const tiefOffen = tiefer && state.expandedSub.has(tk);
      // Unterzeilen erben die Farbe der Zeile darueber, also auch das Muster -
      // ausser in der Kategorienansicht, die ihre eigenen Farben mitbringt
      html += '<div class="row sub'+(catMode?" catrow":(r.rest?" rest":""))+
        (tiefer?" has-sub":"")+(tiefOffen?" open":"")+
        (s.key === "shield" ? " shieldrow" : "")+'" role="row" aria-level="2"'+
        ' data-cat="'+esc(s.key)+'" data-parent="'+esc(r.name)+'"'+
        ' tabindex="-1"'+
        (tiefer?' data-opensub="'+esc(s.key)+'" data-subof="'+esc(r.name)+
                '" aria-expanded="'+
                (tiefOffen?"true":"false")+'"':"")+">"+
        bar(s, swatch) + (breit ? "" : '<span class="rank" role="gridcell"></span>')+
        '<span class="nm" role="gridcell"><span class="twist" aria-hidden="true"'+
          (tiefer ? ' title="'+esc(t(tiefOffen ? "bars.twistClose" : "bars.twistHits"))+'"' : "")+">"+
          (tiefer?"\u203a":"")+"</span>"+
          skillMark(s.key, s.sid, swatch, !catMode && r.rest)+
          '<span class="nmt" title="'+esc(s.label)+'">'+esc(s.label)+
            /* Die Trefferart nennt ihren Anteil am Schaden der Faehigkeit
               (Neugestaltung 28.09., Luecke 2.9, wie im Entwurf) */
            (catMode ? " \u00b7 "+esc(pct(s.damage/(r.damage||1)))  : "")+"</span>"+
          (catMode ? catBadges(s.key) : coreBadge(s.name || s.key, s.sid, seg && seg.ventiusBase))+"</span>"+
        cell(s) + "</div>";
      if(tiefOffen) (s.subs || []).forEach(c => {
        html += '<div class="row sub catrow lvl3" role="row" aria-level="3"'+
          ' tabindex="-1" data-cat="'+esc(c.key)+'">'+
          bar(c, CAT_SWATCH[c.key]) + (breit ? "" : '<span class="rank" role="gridcell"></span>')+
          '<span class="nm" role="gridcell"><span class="twist" aria-hidden="true"></span>'+
            skillMark(c.key, null, CAT_SWATCH[c.key], false)+
            '<span class="nmt" title="'+esc(c.label)+'">'+esc(c.label)+"</span>"+catBadges(c.key)+"</span>"+
          cell(c) + "</div>";
      });
    });
  });
  /* Replacing the table's markup drops focus to <body>, so a keyboard user
     could sort once and then had to tab in from the top again. Note which
     control holds focus and hand it to the node that replaces it. */
  const keepFocus = focusKeeper(document.activeElement as HTMLElement | null, $("#bars"));
  $("#bars").innerHTML = html;
  /* Hier, nicht am Ende von renderAll: eine aufgeklappte Zeile baut die
     Liste ueber diese Funktion neu, ohne renderAll zu beruehren, und mit
     der neuen Kopfzeile ging der Zaehler jedes Mal verloren. */
  markiereRest();

  /* Enter and Space do what a click does. Space has to be swallowed on
     keydown as well, or the page scrolls underneath the control. */
  const onActivate = (el: HTMLElement, run: (ev?: Event) => void) => {
    el.onclick = run;
    el.onkeydown = e => {
      if(e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      run();
    };
  };
  const kopf = [...$("#bars").querySelectorAll<HTMLElement>(".bhead [tabindex]")];
  // the sorted column is always one of them, but a group switch could leave
  // none marked - then the first sortable one carries the stop
  if(kopf.length && !kopf.some(sp => sp.tabIndex === 0)) kopf[0]!.tabIndex = 0;
  $("#bars").querySelectorAll<HTMLElement>(".bhead span").forEach(sp => onActivate(sp, () => {
    const k = sp.dataset.k!; if(k === "rank" || kompakt) return;   // every head cell carries data-k
    if(st.key === k) st.dir *= -1; else { st.key = k; st.dir = -1; }
    const hatteFokus = document.activeElement === sp;
    renderBars();
    // renderBars baut den Kopf neu; der Fokus fiel sonst auf <body>
    if(hatteFokus) $("#bars").querySelector<HTMLElement>('.bhead [data-k="'+k+'"]')?.focus();
  }));
  $("#bars").querySelectorAll<HTMLElement>("[data-open]").forEach(row => onActivate(row, () => {
    const name = row.dataset.open!;
    aufSelbst = true;
    if(state.expanded.has(name)) state.expanded.delete(name); else state.expanded.add(name);
    renderBars();
  }));
  /* Eigener Binder, eigener Schluessel: eine Unterzeile traegt den Namen der
     Zeile darueber mit, sonst wuerde "Auge von Ventius" bei jedem Mitglied
     zugleich auf- und zugehen. */
  $("#bars").querySelectorAll<HTMLElement>("[data-opensub]").forEach(row => onActivate(row, ev => {
    if(ev && ev.stopPropagation) ev.stopPropagation();
    /* Zusammengesetzt wird hier, nicht im Markup: ein Schluessel mit einem
       Trennzeichen darin ueberlebt den Weg durch ein Attribut nicht
       zwangslaeufig - ein NUL wird beim Einlesen zu U+FFFD, und dann
       vergleicht die Tabelle zwei verschiedene Zeichenketten. */
    const k = row.dataset.subof + "\u0000" + row.dataset.opensub;
    if(state.expandedSub.has(k)) state.expandedSub.delete(k); else state.expandedSub.add(k);
    renderBars();
  }));
  keepFocus();
  barsRoving();

  /* Der Satz "Nur ein Angreifer ist in diesem Log - lade die Logdateien
     deiner Gruppe zusammen" stand hier. Er ist weg, und zwar vollstaendig:
     mit einem Angreifer gibt es die Angreifer-Ansicht nicht mehr, also konnte
     ihn ohnehin niemand mehr sehen. Auf die Frage, ob der Hinweis woanders
     hin soll: "Der Satz kann weg, Gruppe ist der Weg." Mehrere Logs zusammen
     zu laden geht weiterhin - beworben wird es nicht mehr. */
  /* Der Satz "Faehigkeiten mit einem Pfeil lassen sich aufklappen ..." ist
     weg: der Pfeil sagt das jetzt selbst im title (twistTitel), und der
     Satz stand unter jeder Tabelle, auch nach dem hundertsten Kampf. Es
     bleiben die zwei Saetze, die etwas ueber DIESE Tabelle sagen. */
  tafelKopfZahl(rows, inParty);
}
/* Der Feldkopf (Neugestaltung 28.09., Luecke 2.7): "Schaden", daneben wie
   viele Zeilen und Treffer - in der Gruppe, woher die Zahlen kommen; dazu der
   Hinweis unter der Tafel. Die Liste neben dem Ring (64) schreibt dasselbe. */
export function tafelKopfZahl(rows: readonly BarFigures[], inParty: boolean){
  const treffer = full(rows.reduce((a, r) => a + (r.hits || 0), 0));
  const zahl = inParty ? t("tafel.zahlGruppe", {n: rows.length})
    : t(state.group === "target" ? "tafel.zahlZiele" : state.group === "weapon" ? "tafel.zahlWaffen"
        : state.group === "player" ? "tafel.zahlSpieler" : "tafel.zahlSkills", {n: rows.length, h: treffer});
  const zEl = document.querySelector<HTMLElement>("#tafelZahl");
  if(zEl && zEl.textContent !== zahl) zEl.textContent = zahl;
  $("#barsNote").textContent = inParty ? t("bars.noteParty")
    // only when that row is actually in the table - the Waffen tab itself
    // branches on the same thing at weapons.allAssigned
    : state.group === "weapon" && rows.some(r => r.name === "Unassigned")
      ? t("bars.noteWeapon")
      : "";
}

/* Was der Pfeil an einer Zeile aufklappt, je Gruppierung ("Ein Satz je
   Gruppierung" galt schon fuer den alten Hinweis). Offen sagt er nur
   "Zuklappen". */
function twistTitel(offen: boolean){
  if(offen) return t("bars.twistClose");
  const g = state.group;
  return t(g === "skill" ? "bars.twistSkill"
         : g === "weapon" ? "bars.twistWeapon"
         : g === "target" ? "bars.twistTarget"
         // Angreifer und Gruppe: eine Zeile je Spieler
         : "bars.twistPlayer");
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  SKILL_CORE[VENTIUS_NAME] = {gemessen: true, dazu: "bars.ventiusRule"};
}
