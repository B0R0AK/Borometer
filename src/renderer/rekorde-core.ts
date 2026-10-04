// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* Die Rekorde als Sammelalbum (Spezifikation Rekorde 2a und 3,
   01.10. und 02.10.2026): rein gerechnet, ohne Seite und ohne Netz. Die
   Seite (62-rekorde.ts) zeichnet daraus Held, Albumseiten und Medaillons;
   der Test (scripts/test-rekorde-core.mjs) liest die Zahlen direkt.

   Eingang sind die Kaempfe des Verlaufs (logIndex, HistFight) und die Boss-
   und Dungeon-Tabelle der App (06-blocks-and-places.ts, DUNGEON_TAFEL und
   OFFENE_BOSSE). Die Tabelle gibt die Plaetze vor - auch die, an denen noch
   kein Kampf steht: sie werden als leere Umrisse gezeigt.

   Was als Rekord gilt:
   - bester DPS: der hoechste; bei gleichem Wert der fruehere. "vorher" ist
     der beste Kampf davor, die Prozent rechnen gegen ihn.
   - staerkster Treffer: der hoechste Einzeltreffer (HistFight.top) mit der
     Faehigkeit, die ihn traf, als Kennung (topSid) - immer die des staerksten, auch
     wenn es Ventius ist (Entscheidung 02.10.). Bei gleichem Wert der fruehere.
     Ein Kampf ohne top ist noch nicht gelesen: er zaehlt fuer DPS und den ersten Kampf.
   - erster Kampf: der erste Kampf am Boss im gelesenen Zeitraum (das Log
     weiss nicht, ob ein Boss fiel). Sind aeltere Logs ungelesen, heisst ein
     erster Kampf am ersten Tag des Zeitraums "ab".
   Die Uhr ist die des Logs (UTC-Felder, wie im Verlauf). */

/** Ein Kampf des Verlaufs, so weit die Rekorde ihn brauchen (HistFight). */
export interface RkKampf {
  name: string;
  dps: number;
  at: number;
  dur?: number;
  file?: string;
  /** Uebungspuppe: die Laengenklasse 60, 120 oder 180 */
  c?: number;
  /** der hoechste Einzeltreffer und die Kennung seiner Faehigkeit ("" ohne Kennung); fehlt in alten Eintraegen */
  top?: number;
  topSid?: string;
}

/** Ein Dungeon oder Raid-Teil, wie 06-blocks-and-places.ts ihn fuehrt. */
export interface RkDungeon {
  stars?: number | undefined;
  lvl?: number | undefined;
  solo?: boolean | undefined;
  of?: { en: string; de?: string | undefined } | null | undefined;
  en: string;
  de?: string | undefined;
  boss: readonly string[];
  bosses?: readonly (readonly string[])[] | undefined;
  phases?: Readonly<Record<string, readonly string[]>> | undefined;
  forms?: Readonly<Record<string, readonly string[]>> | undefined;
}
/** Ein Boss der offenen Welt (OPEN_BOSSES in 06). */
export interface RkOffen {
  kind: string;
  de: string;
  en: string;
  names: readonly string[];
  forms?: readonly string[] | undefined;
}

export interface RkName { de: string; en: string }
/** Ein Platz im Album: ein Boss (oder eine Laengenklasse der Puppe). */
export interface RkOrt {
  id: string;
  de: string;
  en: string;
  /** jede Schreibweise, unter der ein Kampf hierher gehoert (auch Phasen, Formen, Teile) */
  namen: string[];
  /** die Teile eines Kolosses (Manticus: Akman, Deckman) - der Treffer nennt sie */
  teile: string[];
  /** der Fluegel oder Dungeon darunter */
  unter: RkName | null;
  /** Uebungspuppe: die Laengenklasse */
  klasse: number | null;
}
/** Eine Gruppe in einer Seite; key ist ein Schluessel fuer die Ueberschrift (null: keine). */
export interface RkGruppe { key: string | null; orte: RkOrt[] }
export interface RkSeite { id: "raid" | "puppe" | "feld" | "dungeon"; unter: RkName | null; gruppen: RkGruppe[] }

/* Zwei Bosse, die die App als einen Kampf fuehrt ("Zairos und Vulkan sind
   zwei Bosse gleichzeitig", aus dem Raid; fightName in 06 verbindet sie mit einem
   Mittelpunkt). Ihr Medaillon ist eins; ein Pull nur auf Vulkan ist sein Rest. */
const ZUGLEICH: readonly (readonly string[])[] = [["Zairos", "Vulkan"]];
export const PUPPE_KLASSEN = [60, 120, 180] as const;

/* Rang vorn und Zustand hinten, wie bareBoss() in 06-blocks-and-places.ts:
   "Aufgestiegener Morokai", "Ascended Aridus [Undead]". */
const RANG = /^(?:Aufgestiegene[rsn]?|Ascended)\s+/i;
const ZUSTAND = /\s*\[[^\]]*\]\s*$/;
const nackt = (n: string) => String(n || "").replace(RANG, "").replace(ZUSTAND, "").trim();
const klein = (n: string) => n.toLowerCase();

/* Die Seiten des Albums aus der Tabelle: Raid, Uebungspuppe, Feldbosse
   (offene Welt, Erzbosse, Kolosse), Dungeons nach Sternen (ein Stern und
   die Einstiegsdungeons mit Stufe zusammen, dann der Solo-Abgrund). Zwei
   Schreibweisen eines Dungeonbosses: die erste ist die englische, die zweite
   die deutsche, wie die Tabelle sie fuehrt. */
export function albumTafel(dungeons: readonly RkDungeon[], offene: readonly RkOffen[]): RkSeite[] {
  const id = (vor: string, n: string) => vor + ":" + klein(n);
  const mitPhasen = (d: RkDungeon, g: readonly string[]) => {
    const n = [...g];
    for(const b of g){ for(const p of d.phases?.[b] || []) n.push(p); for(const f of d.forms?.[b] || []) n.push(f); }
    return [...new Set(n)];
  };
  const raid: RkOrt[] = [];
  let altar: RkName | null = null;
  const sterne: Record<string, RkOrt[]> = {s4: [], s3: [], s2: [], s1: [], solo: []};
  for(const d of dungeons){
    const unter = {de: d.de ?? d.en, en: d.en};
    const gruppen = (d.bosses || [d.boss]).map(g => [...g]);
    if(d.of){
      altar = altar || {de: d.of.de ?? d.of.en, en: d.of.en};
      // zwei gleichzeitige Bosse werden ein Platz, an der Stelle des ersten
      const fertig: string[][] = [];
      for(const g of gruppen){
        const z = ZUGLEICH.find(p => p.includes(g[0]!));
        const da = z && fertig.find(f => z.includes(f[0]!));
        if(da) da.push(...g); else fertig.push(g);
      }
      for(const g of fertig){
        const zusammen = ZUGLEICH.some(p => p.every(n => g.includes(n)));
        const name = zusammen ? ZUGLEICH.find(p => p.every(n => g.includes(n)))!.join(" \u00b7 ") : g[0]!;
        raid.push({id: id("raid", name), de: name, en: name, namen: mitPhasen(d, g).concat(zusammen ? [name] : []),
          teile: [], unter, klasse: null});
      }
      continue;
    }
    const key = d.solo ? "solo" : d.stars === 4 ? "s4" : d.stars === 3 ? "s3" : d.stars === 2 ? "s2" : "s1";
    for(const g of gruppen)
      sterne[key]!.push({id: id("dungeon", g[0]!), de: g[1] ?? g[0]!, en: g[0]!, namen: mitPhasen(d, g), teile: [], unter, klasse: null});
  }
  const feld: Record<string, RkOrt[]> = {field: [], arch: [], koloss: []};
  for(const o of offene){
    /* Teile: Namen, die weder der deutsche noch der englische Name noch eine
       Form sind - aber nur, wo es mindestens zwei davon gibt. Sonst ist der
       andere Name eine zweite Schreibweise (Minezrok, Ramus), kein Teil. */
    const rest = o.names.filter(n => n !== o.de && n !== o.en && !(o.forms || []).includes(n));
    const teile = rest.length >= 2 ? rest : [];
    const ort: RkOrt = {id: id("feld", o.en), de: o.de, en: o.en, namen: [...new Set([...o.names, o.de, o.en])],
      teile, unter: null, klasse: null};
    (feld[o.kind] || feld.field!).push(ort);
  }
  return [
    {id: "raid", unter: altar, gruppen: [{key: null, orte: raid}]},
    {id: "puppe", unter: null, gruppen: [{key: null, orte: PUPPE_KLASSEN.map(c => ({id: "puppe:" + c, de: "Übungspuppe", en: "Practice Dummy",
      namen: [], teile: [], unter: null, klasse: c}))}]},
    {id: "feld", unter: null, gruppen: [{key: null, orte: feld.field!}, {key: "erz", orte: feld.arch!}, {key: "koloss", orte: feld.koloss!}]
      .filter(g => g.orte.length)},
    {id: "dungeon", unter: null, gruppen: (["s4", "s3", "s2", "s1", "solo"] as const).map(k => ({key: k, orte: sterne[k]!})).filter(g => g.orte.length)},
  ];
}

/** Die Rekorde an einem Platz. */
export interface RkWert {
  /** wie viele Kaempfe */
  n: number;
  dps: number;
  dpsAt: number;
  /** der beste Kampf vor dem besten, und um wie viel Prozent (ganz) der beste darueber liegt */
  vorher: number | null;
  plus: number | null;
  top: number | null;
  topSid: string | null;
  /** der Teil eines Kolosses, an dem der Treffer lag */
  topTeil: string | null;
  topAt: number | null;
  /** der erste Kampf; ab: am ersten Tag des Zeitraums, waehrend aeltere Logs ungelesen sind */
  erster: number;
  ab: boolean;
  zuletzt: number;
}
export interface RkPlatz { ort: RkOrt; wert: RkWert | null }
export interface RkSeiteWert { id: RkSeite["id"]; unter: RkName | null; besiegt: number; gesamt: number; gruppen: { key: string | null; plaetze: RkPlatz[] }[] }
export interface RkHeld { ort: RkOrt; top: number; topSid: string; topTeil: string | null; at: number }
export interface RkAlbum {
  seiten: RkSeiteWert[];
  held: RkHeld | null;
  /** die Kaempfe, die einen Platz fanden, und aus wie vielen Dateien */
  kaempfe: number;
  dateien: number;
  /** davon noch ohne gelesenen Treffer */
  ohneTop: number;
  /** Kaempfe an Zielen ausserhalb der Tabelle */
  ohneOrt: number;
  von: number | null;
  bis: number | null;
}

const TAG_MS = 86400000;
const tagVon = (ms: number) => Math.floor(ms / TAG_MS) * TAG_MS;
const istKampf = (k: unknown): k is RkKampf => !!k && typeof k === "object" && typeof (k as RkKampf).name === "string"
  && Number.isFinite((k as RkKampf).dps) && Number.isFinite((k as RkKampf).at);
const hatTop = (k: RkKampf) => typeof k.top === "number" && Number.isFinite(k.top) && k.top > 0 && typeof k.topSid === "string";

export function rekorde(kaempfe: readonly (RkKampf | null | undefined)[], seiten: readonly RkSeite[], aelterUngelesen: boolean): RkAlbum {
  const nachName = new Map<string, RkOrt>(), puppe = new Map<number, RkOrt>();
  for(const s of seiten) for(const g of s.gruppen) for(const o of g.orte){
    if(o.klasse != null) puppe.set(o.klasse, o);
    for(const n of o.namen){ const k = klein(n); if(!nachName.has(k)) nachName.set(k, o); }
  }
  const ortVon = (k: RkKampf): RkOrt | null => {
    if(k.c != null) return puppe.get(k.c) || null;
    for(const teil of k.name.split("\u00b7")){
      const roh = teil.trim();
      const o = nachName.get(klein(roh)) || nachName.get(klein(nackt(roh)));
      if(o) return o;
    }
    return null;
  };
  const je = new Map<RkOrt, RkKampf[]>();
  let ohneOrt = 0;
  for(const k of kaempfe){
    if(!istKampf(k)) continue;
    const o = ortVon(k);
    if(!o){ ohneOrt++; continue; }
    if(!je.has(o)) je.set(o, []);
    je.get(o)!.push(k);
  }
  const alle = [...je.values()].flat();
  const von = alle.length ? Math.min(...alle.map(k => k.at)) : null;
  const bis = alle.length ? Math.max(...alle.map(k => k.at)) : null;
  const ersterTag = von == null ? null : tagVon(von);
  const werte = new Map<RkOrt, RkWert>();
  for(const [o, l0] of je){
    const l = l0.slice().sort((a, b) => a.at - b.at);
    let best = l[0]!;
    for(const k of l) if(k.dps > best.dps) best = k;            // gleich: der fruehere bleibt
    let vor: RkKampf | null = null;
    for(const k of l) if(k.at < best.at && (!vor || k.dps > vor.dps)) vor = k;
    let top: RkKampf | null = null;
    for(const k of l) if(hatTop(k) && (!top || k.top! > top.top!)) top = k;
    const teil = top && o.teile.length ? nackt(top.name) : null;
    werte.set(o, {
      n: l.length,
      dps: best.dps, dpsAt: best.at,
      vorher: vor ? vor.dps : null, plus: vor && vor.dps > 0 ? Math.round((best.dps / vor.dps - 1) * 100) : null,
      top: top ? top.top! : null, topSid: top ? top.topSid! : null,
      topTeil: teil && o.teile.includes(teil) ? teil : null, topAt: top ? top.at : null,
      erster: l[0]!.at, ab: aelterUngelesen && ersterTag != null && tagVon(l[0]!.at) === ersterTag,
      zuletzt: l[l.length - 1]!.at,
    });
  }
  /* In jeder Gruppe erst die bekaempften, dann die leeren - je in der
     Reihenfolge der Tabelle (Entscheidung vom 02.10.2026, an
     Claude uebertragen). */
  const seitenWert: RkSeiteWert[] = seiten.map(s => {
    const gruppen = s.gruppen.map(g => {
      const p = g.orte.map(ort => ({ort, wert: werte.get(ort) || null}));
      return {key: g.key, plaetze: [...p.filter(x => x.wert), ...p.filter(x => !x.wert)]};
    });
    const plaetze = gruppen.flatMap(g => g.plaetze);
    return {id: s.id, unter: s.unter, besiegt: plaetze.filter(x => x.wert).length, gesamt: plaetze.length, gruppen};
  });
  let held: RkHeld | null = null;
  for(const s of seitenWert) for(const g of s.gruppen) for(const p of g.plaetze){
    const w = p.wert;
    if(!w || w.top == null) continue;
    if(!held || w.top > held.top || (w.top === held.top && w.topAt! < held.at))
      held = {ort: p.ort, top: w.top, topSid: w.topSid!, topTeil: w.topTeil, at: w.topAt!};
  }
  return {seiten: seitenWert, held, kaempfe: alle.length, dateien: new Set(alle.map(k => k.file || "")).size,
    ohneTop: alle.filter(k => !hatTop(k)).length, ohneOrt, von, bis};
}

/* Das einmalige Nachlesen (Spezifikation 3): welche Logdateien des Ordners
   gelesen werden und ab welchem Byte. liste ist die Antwort von
   GET /api/logs (neueste zuerst, hoechstens 60), index der logIndex.
   - keine Zeile im Verzeichnis: ganz;
   - schon bis zu ihrer Groesse nachgelesen (bytes): liegen lassen, auch
     wenn ein Kampf ohne top blieb (eine Datei mit mehreren Angreifern);
   - ein Kampf ohne top: ganz (alte Eintraege vor den Rekorden);
   - nachgelesen und seitdem gewachsen: nur ab bytes; kuerzer geworden
     (eine neue Datei unter altem Namen): ganz.
   Was der Verlauf beim Oeffnen schon mit top gelesen hat, bleibt liegen.
   alle (Rekorde neu einlesen): jede Datei der Liste ganz. */
export const NACH_MAX = 60;
export interface LogEintrag { name: string; size: number }
export interface IndexEintrag { fights?: readonly { top?: unknown }[]; bytes?: unknown; [mehr: string]: unknown }
export function lesebedarf(liste: readonly LogEintrag[], index: Readonly<Record<string, IndexEintrag | undefined>>, alle: boolean): { name: string; ab: number }[] {
  const raus: { name: string; ab: number }[] = [];
  for(const f of liste.slice(0, NACH_MAX)){
    if(!f || typeof f.name !== "string" || !Number.isFinite(f.size)) continue;
    const e = Object.hasOwn(index, f.name) ? index[f.name] : undefined;
    if(alle || !e){ raus.push({name: f.name, ab: 0}); continue; }
    const b = e.bytes, bekannt = typeof b === "number" && Number.isSafeInteger(b) && b >= 0;
    if(bekannt && f.size === b) continue;
    if((e.fights || []).some(k => typeof k.top !== "number")){ raus.push({name: f.name, ab: 0}); continue; }
    if(bekannt) raus.push({name: f.name, ab: f.size > b ? b : 0});
  }
  return raus;
}
