// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/* ---------- Mechanik-Erkennung, erster Schritt - der rechnende Kern ----------
   Spezifikation docs/superpowers/specs/2026-10-01-mechanik-design.md,
   Abschnitt 2. Wie analyse-core.ts: keine Seite, kein state, kein Netz,
   kein Import - nur Zahlen hinein und Zahlen heraus. Die Seite
   (61-mechanik.ts) liefert je Pull die Treffer am Boss mit Zeit ab
   Beginn und Faehigkeit; getestet von scripts/test-mechanik-core.mjs.

   Im Log steht nur der eigene ausgeteilte Schaden. Ob der Boss nicht zu
   treffen war, steht nicht darin, und eine voellige Stille liegt meist an
   der eigenen Figur (Machbarkeitspruefung 01.10.). Erkannt wird darum nur
   ein Muster mit eigenem Fingerabdruck: die Treffer laufen weiter, aber der
   Schaden je Treffer bricht ein. Eine Stille ist nie eine Mechanik. */

/** Ein Treffer am Boss: Sekunden ab Beginn des Kampfes, Schaden, Faehigkeit (sprachfrei, etwa die Skill-ID). */
export interface MTreffer { t: number; dmg: number; k?: string }
/** Ein Pull: seine Treffer am Boss und seine Laenge in Sekunden. */
export interface MPull { treffer: readonly MTreffer[]; sekunden: number }
/** Eine Strecke in ganzen Sekunden ab Beginn, [von, bis). */
export interface MStrecke { von: number; bis: number }
/** Eine wiederkehrende Strecke eines Bosses. */
export interface Mechanik {
  /** Beginn im Median, s */
  beginn: number;
  /** Dauer im Median und ihre Spanne, s */
  dauer: number;
  dauerVon: number;
  dauerBis: number;
  /** in wie vielen Pulls sie vorkam, von wie vielen */
  mit: number;
  pulls: number;
  /** je Pull (Reihenfolge der Eingabe) seine Strecke, sonst null */
  strecken: (MStrecke | null)[];
}

/* Die Schwellen. Mit (E) markiert, was die Spezifikation Claude zur Messung
   ueberlaesst; die Messung an den eigenen Logs steht im Bericht des Vorhabens.

   MECH_ANTEIL (E): Die Spezifikation sagt "unter 20 % des Medians je
   Treffer". Gemessen an den Logs ist der Median je Treffer kein Bezug: die
   meisten Treffer sind kleine Ticks, der Median lag bei Vulcanus bei 0,3k
   je Treffer, waehrend in der Panzerstrecke 0,1k bis 0,4k ankamen. Bezug
   ist darum der Schaden je Treffer im Mittel des Pulls (Summe durch Zahl,
   bei Vulcanus 9k bis 17k), und die Grenze liegt bei 10 % davon
   (Entscheidung vom 01.10., an Claude uebertragen).

   MECH_BRUECKE_S (E): In der Panzerstrecke von Vulcanus landet ab und zu
   eine Sekunde mit einem einzelnen vollen Treffer. Mit einer Sekunde
   Bruecke zerfiel die Strecke in einem von elf Pulls so, dass ihr Beginn
   aus der Streuung fiel (10 von 11), mit zwei Sekunden sind es 11 von 11;
   King Khanzaizin, Fellinex und die anderen Bosse bleiben bei beiden ohne
   Mechanik (Entscheidung vom 01.10., an Claude uebertragen).

   MECH_EIGEN_ANTEIL (E): der Fingerabdruck je Faehigkeit (eigenerAnteil,
   Pruefung 01.10., Befund H1). Gemessen an eigenen Pulls: in der
   Panzerstrecke von Vulcanus landen die Faehigkeiten mit 6 bis 16 % ihres
   eigenen Mittels (ein spaetes Stueck 23 %). Laufen in einer Strecke nur
   Ticks, die ueberall klein sind, liegt das Verhaeltnis nahe 1 (an der
   Uebungspuppe 84 %). Die Grenze liegt bei 25 % (Entscheidung vom 01.10.,
   an Claude uebertragen). Sie trennt nicht alles: eine
   Faehigkeit, die in der Eroeffnung kleiner trifft als spaeter, kam an der
   Puppe einmal auf 16 % - dort hielt erst die Wiederkehr (80 % der Pulls)
   sie aus der Mechanik.

   Alle Grenzen sind an eigenen Pulls gemessen (11 bei Vulcanus, dazu die
   uebrigen Bosse und die Uebungspuppe); andere Pulls zur Gegenprobe gab es
   nicht. Die Proben in scripts/test-mechanik-core.mjs halten jede Grenze
   von beiden Seiten fest. */
export const MECH_MIN_S = 3;          // mindestens so lange am Stueck
export const MECH_RATE = 0.5;         // Treffer je Sekunde: mindestens die Haelfte der ueblichen
export const MECH_ANTEIL = 0.10;      // (E) Schaden je Treffer unter diesem Anteil des Mittels je Treffer
export const MECH_EIGEN_ANTEIL = 0.25; // (E) je Faehigkeit: drinnen unter diesem Anteil ihres eigenen Mittels draussen
export const MECH_BRUECKE_S = 2;      // (E) bis zu zwei Sekunden dazwischen trennen eine Strecke nicht
export const MECH_PULLS_MIN = 5;      // (E) so viele eigene Pulls braucht es mindestens
export const MECH_QUOTE = 0.8;        // (E) in so vielen davon muss sie vorkommen
export const MECH_STREU_S = 8;        // (E) so weit darf der Beginn um den Median streuen

export function mMedian(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  if(!n) return 0;
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

/* Die Strecken eines Pulls, in denen der Boss kaum Schaden nimmt, obwohl
   weiter Treffer kommen. Je ganze Sekunde: Zahl der Treffer und Schaden.
   Eine Sekunde ist "weich", wenn in ihr getroffen wurde und je Treffer
   weniger als MECH_ANTEIL des Mittels ankam. Weiche Sekunden am Stueck
   bilden eine Strecke; bis zu MECH_BRUECKE_S andere Sekunden dazwischen
   trennen sie nicht, solange die ganze Strecke unter der Grenze bleibt. Gezaehlt wird
   eine Strecke ab MECH_MIN_S Sekunden, wenn in ihr im Schnitt mindestens
   MECH_RATE der ueblichen Treffer je Sekunde kamen (ueblich: der Median der
   Sekunden mit Treffern). Eine Stille hat keine Treffer und ist darum nie
   eine solche Strecke. */
export function kaumSchaden(p: MPull): MStrecke[] {
  const T = Math.ceil(p.sekunden);
  if(!(T > 0) || !p.treffer.length) return [];
  const n = new Array<number>(T).fill(0), d = new Array<number>(T).fill(0);
  let summe = 0;
  for(const h of p.treffer){
    const i = Math.max(0, Math.min(T - 1, Math.floor(h.t)));
    n[i]!++; d[i]! += h.dmg; summe += h.dmg;
  }
  const mittel = summe / p.treffer.length;
  if(!(mittel > 0)) return [];
  const grenze = MECH_ANTEIL * mittel;
  const ueblich = mMedian(n.filter(x => x > 0));
  const jeTreffer = (a: number, b: number) => {
    let sn = 0, sd = 0;
    for(let k = a; k < b; k++){ sn += n[k]!; sd += d[k]!; }
    return {sn, je: sn ? sd / sn : 0};
  };
  // weiche Sekunden am Stueck
  const roh: [number, number][] = [];
  let a = -1;
  for(let i = 0; i <= T; i++){
    const weich = i < T && n[i]! > 0 && d[i]! / n[i]! < grenze;
    if(weich && a < 0) a = i;
    if(!weich && a >= 0){ roh.push([a, i]); a = -1; }
  }
  // ueber eine Bruecke zusammenfassen, solange das Ganze unter der Grenze bleibt
  const teile: [number, number][] = [];
  for(const r of roh){
    const vor = teile[teile.length - 1];
    if(vor && r[0] - vor[1] <= MECH_BRUECKE_S && jeTreffer(vor[0], r[1]).je < grenze){ vor[1] = r[1]; continue; }
    teile.push([r[0], r[1]]);
  }
  const out: MStrecke[] = [];
  for(const [von, bis] of teile){
    const L = bis - von, j = jeTreffer(von, bis);
    if(L >= MECH_MIN_S && j.sn / L >= MECH_RATE * ueblich && j.je < grenze &&
       eigenerAnteil(p.treffer, von, bis) < MECH_EIGEN_ANTEIL) out.push({von, bis});
  }
  return out;
}

/* Der Fingerabdruck je Faehigkeit (Pruefung 01.10., Befund H1): Schaden
   je Treffer IN der Strecke, gemessen am eigenen Mittel jeder Faehigkeit
   AUSSERHALB. Gezaehlt werden nur Faehigkeiten, die drinnen und draussen
   treffen; erwartet ist, was ihre Treffer drinnen mit ihrem eigenen Mittel
   von draussen gebracht haetten. Laufen in der Strecke nur Ticks, die
   ueberall klein sind - du hast nur Kleines gedrueckt -, liegt das Verhaeltnis
   bei 1 und die Strecke zaehlt nicht. Schluckt der Boss die Treffer, faellt
   es fuer jede Faehigkeit. Ohne gemeinsame Faehigkeit: 1, also nie. */
export function eigenerAnteil(treffer: readonly MTreffer[], von: number, bis: number): number {
  const drin = new Map<string, { n: number; d: number }>(), raus = new Map<string, { n: number; d: number }>();
  for(const h of treffer){
    const m = h.t >= von && h.t < bis ? drin : raus, k = h.k ?? "";
    const x = m.get(k) || {n: 0, d: 0};
    x.n++; x.d += h.dmg; m.set(k, x);
  }
  let ist = 0, erwartet = 0;
  for(const [k, x] of drin){
    const r = raus.get(k);
    if(!r || !(r.d > 0)) continue;
    ist += x.d; erwartet += x.n * r.d / r.n;
  }
  return erwartet > 0 ? ist / erwartet : 1;
}

/* Die naechste Strecke zu einem Beginn, hoechstens MECH_STREU_S entfernt. */
function naechste(l: readonly MStrecke[], beginn: number): MStrecke | null {
  let best: MStrecke | null = null;
  for(const s of l){
    const ab = Math.abs(s.von - beginn);
    if(ab <= MECH_STREU_S && (!best || ab < Math.abs(best.von - beginn))) best = s;
  }
  return best;
}

/* Wiederkehrende Strecken eines Bosses: erst ab MECH_PULLS_MIN Pulls, und
   nur, was in mindestens MECH_QUOTE davon zu aehnlicher Zeit vorkommt -
   der Beginn streut hoechstens MECH_STREU_S um den Median. Gesucht wird
   von jedem Beginn aus: je Pull die naechste Strecke im Abstand, daraus der
   Median, und von dort noch einmal, bis er steht. Es gewinnt, was in den
   meisten Pulls vorkommt (bei Gleichstand die engere Streuung); dessen
   Strecken scheiden aus, und die Suche geht weiter. Sortiert nach Beginn. */
export function mechaniken(pulls: readonly MPull[]): Mechanik[] {
  const N = pulls.length;
  if(N < MECH_PULLS_MIN) return [];
  const frei = pulls.map(kaumSchaden);
  const out: Mechanik[] = [];
  for(;;){
    let best: { mitte: number; wahl: (MStrecke | null)[]; mit: number; streu: number } | null = null;
    for(const kand of frei.flat()){
      let mitte = kand.von, wahl = frei.map(l => naechste(l, mitte));
      for(let runde = 0; runde < 8; runde++){
        const m = mMedian(wahl.filter((s): s is MStrecke => !!s).map(s => s.von));
        if(m === mitte) break;
        mitte = m; wahl = frei.map(l => naechste(l, mitte));
      }
      // was nach dem letzten Schritt nicht mehr um den Median liegt, faellt heraus
      const m = mMedian(wahl.filter((s): s is MStrecke => !!s).map(s => s.von));
      wahl = wahl.map(s => s && Math.abs(s.von - m) <= MECH_STREU_S ? s : null);
      const drin = wahl.filter((s): s is MStrecke => !!s);
      const streu = drin.reduce((x, s) => Math.max(x, Math.abs(s.von - m)), 0);
      if(!best || drin.length > best.mit || (drin.length === best.mit && streu < best.streu))
        best = {mitte: m, wahl, mit: drin.length, streu};
    }
    // 16 von 20 sind genau 80 % und reichen, 15 von 19 nicht
    if(!best || !best.mit || best.mit + 1e-9 < MECH_QUOTE * N) break;
    const drin = best.wahl.filter((s): s is MStrecke => !!s);
    const dauern = drin.map(s => s.bis - s.von);
    out.push({
      beginn: mMedian(drin.map(s => s.von)),
      dauer: mMedian(dauern), dauerVon: Math.min(...dauern), dauerBis: Math.max(...dauern),
      mit: drin.length, pulls: N, strecken: best.wahl
    });
    best.wahl.forEach((s, i) => { if(s) frei[i] = frei[i]!.filter(x => x !== s); });
  }
  return out.sort((x, y) => x.beginn - y.beginn);
}

/* Alle Strecken eines Pulls, die zu einer Mechanik gehoeren: jede mit dem
   Fingerabdruck (kaumSchaden), die in ihrem ueblichen Fenster beginnt - ab
   MECH_STREU_S vor ihrem Beginn (Median) bis zum Ende ihrer laengsten
   Dauer (Beginn + dauerBis). Gemessen an Vulcanus: landet mitten in der
   Panzerstrecke ein paar Sekunden voller Schaden, zerfaellt sie in zwei
   Stuecke, und nur das erste aus der Analyse zu nehmen liess das zweite als
   schwaechste Stelle stehen. Ein Pull, der nicht zu "mit" zaehlt, hat
   keine (Pruefung 01.10., N2): i ist seine Stelle in der Eingabe von
   mechaniken(); ohne i entscheidet streckeIn. Fuer die Seite: was hier
   steht, zaehlt nicht als Luecke. */
export function streckenIn(p: MPull, m: Mechanik, i?: number): MStrecke[] {
  if(i !== undefined ? !m.strecken[i] : !streckeIn(p, m)) return [];
  const von = m.beginn - MECH_STREU_S, bis = m.beginn + m.dauerBis;
  return kaumSchaden(p).filter(s => s.von >= von && s.von < bis);
}

/** Die Strecke einer Mechanik in einem Pull: die naechste zu ihrem Beginn, sonst null. */
export function streckeIn(p: MPull, m: Mechanik): MStrecke | null {
  return naechste(kaumSchaden(p), m.beginn);
}
