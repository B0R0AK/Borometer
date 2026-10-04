import { SERIES_N, seriesColor, seriesRow, state } from "./01-state";
import { rateSecs, stats } from "./06-blocks-and-places";
import { weaponLabel, weaponMark } from "./09-weapon-icons";
import { bossMark, weaponPairMark } from "./12-boss-images";
import { hitCatLabel, skillLabel } from "./14-questlog-weapons";
import { ventiusTargetKey } from "./15-weapons-and-ventius";
import { t } from "./08-translation";
import { weaponFor } from "./16-fight-analysis";
import type { BarRow, BoardRow, CombatEvent, Encounter, Fight, PartyBossFight } from "../types";

/* ---------- grouping ---------- */
/* Five, and shield comes first because it is not a flag beside the others:
   the log writes one outcome per hit, and it wrote "shield" INSTEAD of
   "crit". Measured on a full raid log, the crit column equals
   hitType == kMaxDamageByCriticalDecision on all 8485 rows with no
   exception - so crit is a restatement of the hit type, and a shield hit
   can never be one. Until now these hits fell through to the heavy and
   normal buckets, which had those two sub-rows claiming a landing the log
   never reported. */
export const HIT_CATS = ["normal","crit","heavy","critheavy","shield"];
export const catOf = (e: CombatEvent) => e.shield ? "shield"
                 : (e.crit && e.heavy) ? "critheavy" : e.crit ? "crit"
                 : e.heavy ? "heavy" : "normal";

const PARTY_BOSS_MAX = 240;      // rund ein Abend
const PARTY_PULL_SLACK = 30000;  // wie nah zwei Anfaenge liegen, um ein Pull zu sein
const PARTY_FIGHT_SLACK = 90000; // wie weit eine Meldung neben dem Kampf liegen darf

const partyBossKey = (k: string) => /^(boss|open):/.test(k || "");

export function notePartyFights(board: BoardRow[]){
  const jetzt = Date.now();
  (board || []).forEach(r => {
    if(r.waiting || !r.target) return;
    const key = r.targetKey || ventiusTargetKey(r.target);
    if(!partyBossKey(key)) return;
    /* Der abgeleitete Anfang, nicht die Ankunftszeit: er steht waehrend
       eines Pulls still, waehrend die Dauer waechst. Genau das macht ihn
       zum Erkennungsmerkmal eines Pulls. */
    const start = jetzt - (r.seconds || 0) * 1000;
    const eintrag = {key, target: r.target, name: r.name, at: jetzt, start,
                     damage: r.damage || 0, dps: r.dps || 0, hits: r.hits || 0,
                     crit: r.crit || 0, heavy: r.heavy || 0,
                     seconds: r.seconds || 0, max: r.max || 0,
                     lang: r.lang || "", weapons: r.weapons || [],
                     ventius: !!r.ventius, skills: r.skills || []};
    let da = null;
    for(let i = state.partyBoss.length - 1; i >= 0; i--){
      const e = state.partyBoss[i]!;
      if(e.name !== r.name || e.key !== key) continue;
      if(Math.abs(e.start - start) < PARTY_PULL_SLACK ||
         (eintrag.damage >= e.damage && eintrag.seconds >= e.seconds)) da = e;
      break;   // nur der juengste Eintrag zaehlt, siehe Kommentar oben
    }
    if(da){
      /* Der Anfang des Eintrags bleibt der, den er hatte: er ist das, was
         den Pull vom naechsten unterscheidet, und er soll nicht mit der Uhr
         davonwandern, waehrend ein fertiger Kampf weiter gemeldet wird. */
      const anfang = da.start;
      Object.assign(da, eintrag);
      da.start = anfang;
    } else state.partyBoss.push(eintrag);
  });
  if(state.partyBoss.length > PARTY_BOSS_MAX)
    state.partyBoss.splice(0, state.partyBoss.length - PARTY_BOSS_MAX);
}

/* Die Meldungen der Gruppe zu genau diesem Kampf - oder nichts.

   Nichts heisst: kein Boss, oder niemand hat in dieser Zeit etwas zu diesem
   Boss gemeldet. Beides ist ein ehrliches Nichts und keine leere Tabelle. */
export function partyForFight(seg: Encounter): PartyBossFight[] | null {
  if(!seg || !state.partyBoss.length) return null;
  const key = ventiusTargetKey(seg.stats ? seg.stats.name : stats(seg).name);
  if(!partyBossKey(key)) return null;
  const je = new Map();
  state.partyBoss.forEach(e => {
    if(e.key !== key) return;
    if(e.start > seg.end + PARTY_FIGHT_SLACK) return;
    if(e.at < seg.start - PARTY_FIGHT_SLACK) return;
    const da = je.get(e.name);
    if(!da || Math.abs(e.start - seg.start) < Math.abs(da.start - seg.start))
      je.set(e.name, e);
  });
  if(!je.size) return null;
  return [...je.values()].sort((a, b) => b.damage - a.damage);
}

/* Alle Bosskaempfe des geladenen Logs, zu denen die Gruppe etwas gemeldet
   hat - das ist, was "Gruppen-Log speichern" speichert. */
/* ---------- wer aus der Liste darf und wer nicht ----------
   Zwei Regeln, beide so gewuenscht.

   Ein Kampf, zu dem die Gruppe etwas gemeldet hat, bleibt. Er traegt seinen
   Anhaenger, er steht in dem, was "Gruppen-Log speichern" schreibt, und was
   mehrere Leute gemeldet haben, nimmt einer nicht allein heraus.

   Und in einem geladenen Gruppen-Log geht es gar nicht. Das ist der Abend
   von jemand anderem: daran wird nichts weggestrichen, auch nicht an den
   Zeilen ohne Anhaenger. */
export const inGruppenLog = () => !!(state.party && state.party.frozen);
export function darfEntfernen(seg: Encounter){
  return !!seg && !inGruppenLog() && !partyForFight(seg);
}

export function partyBossFights(){
  return state.encounters.map(seg => {
    const rows = partyForFight(seg);
    if(!rows) return null;
    const st = stats(seg);
    return {target: st.name, key: ventiusTargetKey(st.name),
            when: new Date(seg.start).toISOString(),
            seconds: +st.seconds.toFixed(1),
            board: rows.map(r => ({...r}))};
  }).filter(Boolean);
}

/* ---------- die Farbe eines Mitglieds (#34) ----------
   Eine einzige Zuordnung fuer den Bereich Gruppe (42-party.ts) und die
   Gruppenansicht im Kampf: fest je Name fuer die Sitzung, nicht nach dem
   Rang - sonst truege dasselbe Mitglied im Board (nach DPS) und im Kampf
   (nach Schaden) zwei Farben, und die Farbe sprang, sobald jemand
   ueberholte (Pruefung Aufgabe 7, Befund 1). Vergeben wird in der
   Reihenfolge, in der die Namen zuerst auftauchen; die neuen eines Abrufs
   nach Namen, damit dieselbe Gruppe dieselben Farben bekommt. */
const mitgliedNr = new Map<string, number>();
export function mitgliederMerken(namen: readonly string[]){
  for(const n of [...namen].sort((a, b) => a.localeCompare(b))) if(!mitgliedNr.has(n)) mitgliedNr.set(n, mitgliedNr.size);
}
/** Die Stelle eines Mitglieds in der Reihe der Serienfarben (0 bis SERIES_N - 1). */
/* Die Beispielgruppe heisst intern immer "Beispiel A", "Beispiel B" - der Name
   ist der Schluessel fuer Farbe, Aufklappen und "Wessen". Angezeigt wird er in
   der Sprache der Oberflaeche ("Example A"), also auch nach einem Wechsel der
   Sprache richtig (Fixrunde 1 zu Feinschliff 6, Befund 2). */
export function mitgliedName(name: string): string {
  const m = state.party && state.party.demo ? /^Beispiel ([A-C])$/.exec(name) : null;
  return m ? t("party.bspName", {b: m[1]}) : name;
}
export function mitgliedIndex(name: string): number {
  mitgliederMerken([name]);
  return mitgliedNr.get(name)! % SERIES_N;
}

export function partyGroupRows(): BarRow[] {
  /* Der gewaehlte Kampf geht vor: wer links einen Boss anklickt, will die
     Gruppe zu DIESEM Kampf sehen und nicht, was gerade laeuft. Gibt es dazu
     nichts, bleibt es beim lebenden Board. */
  const fuer = partyForFight(state.encounters[state.sel]!);
  const board = fuer || (state.party && state.party.board) || [];
  const rows = fuer || board.filter(r => !r.waiting);
  /* Share is worked out here from the board itself rather than taken from the
     number the host sent. The host credited a share only to members whose
     target string matched the majority's, and in a raid people are rarely on
     the same pull at the same instant — between pulls, or one boss behind,
     a member's last reported fight is simply a different one. From a real
     guild raid: four of six rows read 0.0%, and the three that were counted
     shared out 100% between them.
     This board is a scoreboard of what each member is doing, not one merged
     fight, so a share of its own total is the only figure that means what the
     column says. It also comes out right for party logs saved before the fix,
     which store the zeroes. */
  const total = rows.reduce((a, r) => a + (r.damage || 0), 0) || 1;
  mitgliederMerken(board.map(r => r.name));
  return rows.map(r => {
    const share = (r.damage || 0) / total;
    return {
      /* Das Board laeuft weiter um, statt ab dem achten Mitglied grau zu
         werden: ein Raid hat bis zu zwoelf Leute, und "keiner der sieben"
         ist ueber einen Menschen keine sinnvolle Aussage. Jede Zeile traegt
         ihren Namen, die Farbe ist hier Beiwerk. */
      name: r.name, label: mitgliedName(r.name), color: seriesRow()[mitgliedIndex(r.name)]!,
      /* Keine leere Platte vor einem Spieler: dort kommt nie ein
         Skillsymbol hin. Stattdessen seine zwei Waffen - dieselbe
         Auskunft, die im Gruppenfenster als Klassenname steht. */
      icon: weaponPairMark(r.weapons),
      damage: r.damage, dps: r.dps, hits: r.hits, max: r.max || 0,
      share,
      critRate: r.crit || 0, heavyRate: r.heavy || 0,
      // per-skill crit/heavy/max never left the sending client, so a party
      // member's sub-rows show what they did without those three columns —
      // same convention the old party board used
      /* Die drei letzten Spalten kamen frueher nicht mit - eine Meldung
         trug nur Schaden, Rate und Treffer je Faehigkeit. Seit sie es tun,
         steht in einer aufgeklappten Gruppenzeile dasselbe wie in deiner
         eigenen Tabelle.

         null bleibt, wo nichts gemeldet wurde: ein aelteres Borometer in
         der Gruppe schickt die Zahlen nicht, und ein groesster Treffer von
         "0,0" neben 0 % Kritisch waere von einer Faehigkeit, die wirklich
         nie kritisch traf, nicht zu unterscheiden. */
      subs: (r.skills || []).map(k => ({
        key: k.name, name: k.name, label: skillLabel(k.name, k.sid),
        damage: k.damage, dps: k.dps, hits: k.hits,
        share: k.damage / total,
        max: k.max == null ? null : k.max,
        critRate: k.crit == null || !k.hits ? null : k.crit / k.hits,
        heavyRate: k.heavy == null || !k.hits ? null : k.heavy / k.hits,
        /* Die dritte Ebene. Die Rate je Art ist kein Mittelwert, sondern
           folgt aus der Art selbst: ein kritischer starker Angriff ist zu
           100 % kritisch und zu 100 % stark. Die Tabelle blendet beide
           Spalten in einer Art-Zeile ohnehin aus - dastehen soll trotzdem
           nichts Falsches. */
        subs: (k.cats || []).map(c => ({
          key: c.k, label: hitCatLabel(c.k),
          damage: c.d, dps: c.d / Math.max(r.seconds || 0, 1), hits: c.h,
          max: c.m, share: c.d / total,
          critRate: c.k === "crit" || c.k === "critheavy" ? 1 : 0,
          heavyRate: c.k === "heavy" || c.k === "critheavy" ? 1 : 0,
        })),
      })),
    };
  });
}

export function groupRows(seg: Fight, mode: string): BarRow[] {
  const keyOf = (e: CombatEvent) => mode === "skill"  ? e.skill
                   : mode === "target" ? e.target
                   : mode === "player" ? e.source
                   : weaponFor(e.skill, e.sid);
  const subOf = (e: CombatEvent) => mode === "skill" ? catOf(e) : e.skill;
  // a representative skill id per skill name, for translating skill labels
  const sidOf = new Map<string, string>();
  for(const e of seg.events) if(e.sid && !sidOf.has(e.skill)) sidOf.set(e.skill, e.sid);

  // any, on purpose: a row is built here with its subs in a Map and handed
  // out below with them as a BarRow[] - one object, two shapes in turn
  const m = new Map<string, any>();
  for(const e of seg.events){
    const key = keyOf(e);
    let r = m.get(key);
    if(!r){ r = {name:key, damage:0, hits:0, crit:0, heavy:0, max:0, shieldDmg:0, subs:new Map()}; m.set(key, r); }
    r.damage += e.dmg; r.hits++; if(e.crit) r.crit++; if(e.heavy) r.heavy++;
    if(e.shield) r.shieldDmg += e.dmg;
    if(e.dmg > r.max) r.max = e.dmg;
    const sk = subOf(e);
    if(sk){
      let s = r.subs.get(sk);
      if(!s){ s = {key:sk, parent:key, damage:0, hits:0, crit:0, heavy:0, max:0}; r.subs.set(sk, s); }
      s.damage += e.dmg; s.hits++; if(e.crit) s.crit++; if(e.heavy) s.heavy++;
      if(e.dmg > s.max) s.max = e.dmg;
    }
  }

  const total = seg.stats.total || 1, secs = rateSecs(seg);
  const colorOf = new Map(seg.stats.skills.map(k => [k.name, k.color]));
  const restOf = new Map(seg.stats.skills.map(k => [k.name, !!k.rest]));
  const list = [...m.values()].sort((a,b) => b.damage - a.damage);
  list.forEach((r,i) => {
    r.color = mode === "skill" ? (colorOf.get(r.name) || seriesColor(i)) : seriesColor(i);
    r.rest = mode === "skill" && restOf.has(r.name) ? restOf.get(r.name) : i >= SERIES_N;
    r.dps = r.damage/secs; r.share = r.damage/total;
    r.critRate = r.hits ? r.crit/r.hits : 0;
    r.heavyRate = r.hits ? r.heavy/r.hits : 0;
    /* null heisst "such dir selbst eins", "" heisst "hier gehoert
       keines hin". Eine Zielzeile bekommt das Bossportraet, wenn es eines
       gibt; ein Trashmob faellt auf die farbige Platte zurueck. Eine
       Spielerzeile bekommt nichts - ein Spieler ist kein Skill. */
    r.icon = mode === "weapon" ? weaponMark(r.name)
           : mode === "target" ? (bossMark(r.name, "sic", r.color) || null)
           : mode === "player" ? '<span class="wpair" aria-hidden="true"></span>'
           : null;
    r.label = mode === "weapon" ? weaponLabel(r.name)
            : mode === "skill" ? skillLabel(r.name, sidOf.get(r.name))
            : r.name;
    /* Fuer das Symbol. In den Ansichten nach Waffe oder Ziel heisst die
       Zeile nicht nach einem Skill, dann findet die Tabelle ohnehin
       nichts. */
    r.sid = mode === "skill" ? (sidOf.get(r.name) || "") : "";

    r.subs = [...r.subs.values()].map(s => Object.assign(s, {
      color: r.color, dps: s.damage/secs, share: s.damage/total,
      critRate: s.hits ? s.crit/s.hits : 0,
      heavyRate: s.hits ? s.heavy/s.hits : 0,
      label: mode === "skill" ? hitCatLabel(s.key) : skillLabel(s.key, sidOf.get(s.key)),
      /* Im Skill-Modus heisst die Unterzeile nach der Trefferart, sonst
         nach einem Skill - nur dann gibt es ein Symbol. */
      sid: mode === "skill" ? "" : (sidOf.get(s.key) || "")
    })).sort((a,b) => mode === "skill" ? HIT_CATS.indexOf(a.key)-HIT_CATS.indexOf(b.key) : b.damage-a.damage);
    if(r.subs.length < 2) r.subs = [];   // nothing to open when every hit lands the same way
  });
  return list;
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  /* ---------- the party as a grouping mode, not a separate scrolled-to
     panel — the ranked table above the tabs never moves, so switching to
     Party here is instant regardless of what else is open */
  /* Was die Gruppe an einem Boss gemeldet hat, ueber den Augenblick hinaus.
     Das Board vom Server ist eine Momentaufnahme und wird bei jeder Runde
     ueberschrieben; hier bleibt stehen, was gemeldet wurde. */
  state.partyBoss = [];
  /* Nicht gespeichert, so entschieden: beim naechsten Start ist
     wieder alles zu. */
  state.trashOpen = new Set();
  /* Welche Faehigkeit in welcher Gruppenzeile aufgeklappt ist. Der Schluessel
     traegt beide Namen, siehe den Binder in renderBars. */
  state.expandedSub = new Set();
}
