import { state } from "./01-state";
import { hauptzielVon, histKey, knownBoss, practiceTarget, stats } from "./06-blocks-and-places";
import { mechaniken, streckenIn, type Mechanik, type MPull, type MStrecke } from "../mechanik-core";
import type { Fight } from "../types";

/* ---------- Mechanik-Erkennung, erster Schritt ----------
   Spezifikation docs/superpowers/specs/2026-10-01-mechanik-design.md,
   Abschnitte 3 und 4. Die Seite sammelt je Boss die geladenen eigenen
   Pulls (state.encounters, derselbe Spielerfilter wie ueberall; die
   Kopfzahlen im Verlauf haben keine Treffer und zaehlen darum nicht mit -
   Entscheidung vom 01.10., an Claude uebertragen) und gibt dem
   Kern je Pull die Treffer am Boss (hauptzielVon). Was der Kern findet,
   steht als neutrale Zeile in der Analyse (26), als Schraffur in der Form
   des Kampfes und im Zeitverlauf (24), und die Strecke dieses Pulls zaehlt
   weder als Luecke noch als schwaechste Stelle (16, 26). Unter
   MECH_PULLS_MIN Pulls gibt es nichts. Ohne setup(), speichert und laedt
   nichts, fragt nichts ab. */

export interface MechStand {
  /** der Name des Bosses, wie dieser Kampf ihn schreibt */
  boss: string;
  /** je wiederkehrender Strecke ihre Stuecke in diesem Pull (streckenIn, oft eines, manchmal keines) */
  liste: { m: Mechanik; strecken: MStrecke[] }[];
}

/* Ein Pull fuer den Kern: die Treffer EINER Figur am Boss, Sekunden ab
   Beginn, mit ihrer Faehigkeit (fuer den Fingerabdruck je Faehigkeit im
   Kern). Die Figur ist die gewaehlte, bei "alle" die mit den meisten
   Treffern am Boss in diesem Pull (Pruefung 01.10., M3): in einem Log mit
   zwei Quellen mischte sich sonst der Schaden beider in ein Mittel. */
const pullMerk = new WeakMap<Fight, { stempel: string; p: MPull; quelle: string }>();
function alsPull(seg: Fight): { p: MPull; quelle: string } {
  const stempel = seg.end + "|" + seg.events.length;
  const alt = pullMerk.get(seg);
  if(alt && alt.stempel === stempel) return alt;
  const haupt = hauptzielVon(seg);
  const amBoss = seg.events.filter(e => haupt(e.target));
  const zahl = new Map<string, number>();
  for(const e of amBoss) zahl.set(e.source, (zahl.get(e.source) || 0) + 1);
  let quelle = "", meist = -1;
  for(const [q, n] of zahl) if(n > meist){ quelle = q; meist = n; }
  const p: MPull = {
    sekunden: (seg.end - seg.start) / 1000,
    treffer: amBoss.filter(e => e.source === quelle)
      .map(e => ({t: (e.t - seg.start) / 1000, dmg: e.dmg, k: e.sid || e.skill}))
  };
  const neu = {stempel, p, quelle};
  pullMerk.set(seg, neu);
  return neu;
}

/* Je Boss und Figur einmal gerechnet; neu, sobald sich ein Pull aendert
   (Live) oder einer dazukommt oder wegfaellt. Der Pool sind nur die Pulls
   derselben Figur - "deiner geladenen Pulls" zaehlt keine fremde Figur mit,
   deren Log daneben geladen ist (M3). Gemerkt je Liste der Kaempfe: ein
   neuer Schnitt (segment) legt eine neue Liste an, und der alte Merker
   faellt mit ihr (Pruefung 01.10., N7). */
interface BossStand { stempel: string; pool: Fight[]; m: Mechanik[] }
const bossMerk = new WeakMap<Fight[], Map<string, BossStand>>();
function bossStand(key: string, quelle: string): BossStand {
  let merk = bossMerk.get(state.encounters);
  if(!merk){ merk = new Map(); bossMerk.set(state.encounters, merk); }
  const pool = state.encounters.filter(x => histKey((x.stats || stats(x)).name) === key && alsPull(x).quelle === quelle);
  const stempel = pool.map(x => x.start + ":" + x.end + ":" + x.events.length).join(",");
  const mk = key + "\u0000" + quelle, alt = merk.get(mk);
  if(alt && alt.stempel === stempel && alt.pool.length === pool.length && alt.pool.every((x, i) => x === pool[i]))
    return alt;
  const neu = {stempel, pool, m: mechaniken(pool.map(x => alsPull(x).p))};
  merk.set(mk, neu);
  return neu;
}

/** Was die Mechanik-Erkennung zu diesem Kampf weiss, oder null (kein Boss, ohne Uhr, nichts gefunden). */
const standMerk = new WeakMap<Fight, { stempel: string; st: MechStand | null }>();
export function mechanikStand(seg: Fight | undefined): MechStand | null {
  if(!seg || state.noTime || !seg.stats) return null;
  const name = seg.stats.name;
  if(!knownBoss(name) || practiceTarget(name)) return null;
  const {p, quelle} = alsPull(seg);
  const boss = bossStand(histKey(name), quelle);
  const stempel = boss.stempel + "|" + seg.end + "|" + seg.events.length;
  const alt = standMerk.get(seg);
  if(alt && alt.stempel === stempel) return alt.st;
  // die Stelle im Pool: ein Pull, der nicht zu "mit" zaehlt, nimmt nichts aus (N2)
  const i = boss.pool.indexOf(seg);
  const st = boss.m.length ? {boss: name, liste: boss.m.map(x => ({m: x, strecken: streckenIn(p, x, i >= 0 ? i : undefined)}))} : null;
  standMerk.set(seg, {stempel, st});
  return st;
}

/** Die Strecken dieses Pulls, die Mechanik sind, in Sekunden wie gapsOf ({from, to, len}). */
export function mechanikStrecken(seg: Fight | undefined): { from: number; to: number; len: number }[] {
  const st = mechanikStand(seg);
  if(!st) return [];
  return st.liste.flatMap(x => x.strecken).map(s => ({from: s.von, to: s.bis, len: s.bis - s.von}));
}

/** Welche ganzen Sekunden des Kampfes in einer Mechanik-Strecke liegen. */
export function mechanikSekunden(seg: Fight, T: number): boolean[] {
  const raus: boolean[] = new Array(T).fill(false);
  for(const s of mechanikStrecken(seg))
    for(let i = Math.max(0, s.from); i < Math.min(T, s.to); i++) raus[i] = true;
  return raus;
}

/** Ein Merker fuer Rechnungen, die von der Mechanik dieses Pulls abhaengen. */
export const mechanikStempel = (seg: Fight) => mechanikStrecken(seg).map(s => s.from + "-" + s.to).join(",");
