/* ---------- Analyse: Fenster, Nebenziele, Start - der rechnende Kern ----------
   Spezifikation docs/superpowers/specs/2026-09-27-analyse-fenster-design.md,
   Abschnitt 4 (Issue #45).

   Wie rotation-core.ts: keine Seite, kein state, kein Netz - nur Zahlen
   hinein und Zahlen heraus. Die Seite (53-fenster.ts) liefert Schluessel,
   Namen, Zeiten und Pools schon aufgeloest; getestet von
   scripts/test-analyse-core.mjs.

   Das Fenster wird aus EINSAETZEN gelesen (PartyCasts: Beginn, Ende,
   Schaden, Treffer, Krits), rein zeitlich und nicht je Ziel: jeder
   gespeicherte beste Pull traegt sie schon, also hat jeder sofort einen
   Vergleichswert, und es braucht kein neues Speicherformat (4.1). Ein
   Einsatz des Hauptschadens H gehoert ins Fenster, wenn sein Beginn in
   [Beginn eines Einsatzes von F, + L) liegt; seine Treffer, sein Schaden und
   seine Krits zaehlen dann ganz dort. */

/** Einsaetze einer Faehigkeit, wie PartyCasts, mit sprachfreiem Schluessel. */
export interface FSpur {
  /** skillKey; die Ventius-Familie einheitlich "fam:ventius" */
  k: string;
  n: string;
  s: string;
  /** eine Waffe (nicht Unassigned/Passive) - nur solche sind Kandidaten fuer F */
  waffe: boolean;
  /** [Beginn ms, Ende ms, Schaden, Treffer, Krits], ab Beginn des Kampfes */
  c: [number, number, number, number, number][];
}
export interface FPull {
  spuren: FSpur[];
  /** gekaempfte Zeit in Sekunden, fuer "je Minute" und die Abdeckung */
  sekunden: number;
  /** true: alle Faehigkeiten (Kampf im Log); false: nur die zwoelf gespeicherten */
  alle: boolean;
  /** Strecken, in denen das Ziel unverwundbar war, ms (#37) */
  aus?: { von: number; bis: number }[];
}

export const FENSTER_LAENGEN = [4, 5, 6, 7, 8, 9, 10];   // s
export const FENSTER_GEWINN_MIN = 0.20;
export const FENSTER_EINSAETZE_MIN = 15;
export const FENSTER_TREFFER_MIN = 100;                  // je Seite, im Pool
export const FENSTER_ABDECKUNG = [0.20, 0.80] as const;
export const FENSTER_EIGENE_MIN = 15;                    // Treffer je Seite fuer die Staerken des Kampfes
export const FENSTER_URTEIL_AB = 0.20;                   // Anteil ausserhalb
export const FENSTER_RICHTUNG_MIN = 10;                  // Treffer je Seite, damit ein Pull eine Richtung hat
export const START_S = 10, START_SCHWAECHER = 0.80, START_STAERKER = 1.25;
export const START_MIN_S = 20;
export const NEBEN_AB = 0.05;
/* Gleichstand zweier Laengen: auf einen Prozentpunkt Gewinn gilt die
   laengere (4.2) - ist das Fenster 6 s lang und kein Einsatz von H liegt
   zwischen 5 und 6 s, geben beide Laengen denselben Gewinn. */
const GLEICH = 0.01;

const spurVon = (p: FPull, k: string) => p.spuren.find(s => s.k === k);

/** Der Schluessel mit dem meisten Schaden ueber den Pool, oder null unter 2 x FENSTER_TREFFER_MIN Treffern. */
export function hauptschaden(pool: FPull[]): string | null {
  const dmg = new Map<string, number>(), treffer = new Map<string, number>();
  for(const p of pool) for(const s of p.spuren){
    let d = 0, h = 0;
    for(const c of s.c){ d += c[2]; h += c[3]; }
    dmg.set(s.k, (dmg.get(s.k) || 0) + d);
    treffer.set(s.k, (treffer.get(s.k) || 0) + h);
  }
  let best: string | null = null, top = -1;
  for(const [k, d] of dmg) if(d > top){ top = d; best = k; }
  if(best == null || (treffer.get(best) || 0) < 2 * FENSTER_TREFFER_MIN) return null;
  return best;
}

interface Teilung {
  dIn: number; hIn: number; kIn: number;
  dAus: number; hAus: number; kAus: number;
}
/* Die Einsaetze von H eines Pulls nach innen und aussen, fuer ein F und
   eine Laenge in ms. Die Beginne von F sind aufsteigend; ein Einsatz von H,
   der in [von, bis + L) einer unverwundbaren Strecke beginnt, zaehlt auf
   keiner Seite - das Mal konnte dort nicht sitzen. */
function teilen(h: FSpur, fBeginne: number[], L: number, aus: { von: number; bis: number }[] | undefined): Teilung {
  const r: Teilung = {dIn: 0, hIn: 0, kIn: 0, dAus: 0, hAus: 0, kAus: 0};
  for(const c of h.c){
    const b = c[0];
    if(aus && aus.some(u => b >= u.von && b < u.bis + L)) continue;
    let drin = false;
    for(const f of fBeginne){
      if(f > b) break;
      if(b < f + L){ drin = true; break; }
    }
    if(drin){ r.dIn += c[2]; r.hIn += c[3]; r.kIn += c[4]; }
    else { r.dAus += c[2]; r.hAus += c[3]; r.kAus += c[4]; }
  }
  return r;
}
const beginne = (f: FSpur | undefined) => f ? f.c.map(c => c[0]).sort((a, b) => a - b) : [];
/* Wie viel der gekaempften Zeit die Fenster decken: Vereinigung aller
   [Beginn, Beginn + L), am Ende des Pulls abgeschnitten - ein F kurz vor
   Schluss zaehlt nicht ueber ihn hinaus. */
function gedeckt(fBeginne: number[], L: number, ende: number): number {
  let summe = 0, bis = -Infinity;
  for(const f of fBeginne){
    const von = Math.max(f, bis), zu = Math.min(f + L, ende);
    if(zu > von) summe += zu - von;
    bis = Math.max(bis, f + L);
  }
  return summe;
}

/** Das Fenster, das der Pool hergibt. */
export interface Fenster {
  /** Schluessel des Fenster-Skills */
  f: string;
  /** Schluessel des Hauptschadens */
  h: string;
  /** Laenge in Sekunden */
  l: number;
  /** Staerke innen / Staerke aussen - 1 */
  gewinn: number;
  /** Schaden je Treffer innen und aussen, ueber den Pool */
  jeIn: number;
  jeAus: number;
  /** Krit-Rate innen und aussen */
  kritIn: number;
  kritAus: number;
  /** Pulls, in denen H vorkommt und F bekannt ist */
  pulls: number;
  /** Anteil der gekaempften Zeit in den Fenstern */
  abdeckung: number;
}

/* Die Suche (4.2). Je Kandidat F (Waffe, >= 15 Einsaetze im Pool) und je
   Laenge die Teilung ueber alle Pulls, in denen F bekannt ist; ein
   gespeicherter Pull, der F nicht unter seinen zwoelf traegt, sagt dazu
   nichts. Unter den Laengen zaehlen nur solche mit je >= 100 Treffern - eine
   Laenge mit fuenf Treffern innen koennte sonst zufaellig den groessten
   Gewinn haben und den Kandidaten verwerfen, obwohl eine andere gilt. */
export function fensterSuchen(pool: FPull[], h: string): Fenster | null {
  const kandidaten = new Map<string, number>();
  for(const p of pool) for(const s of p.spuren)
    if(s.k !== h && s.waffe) kandidaten.set(s.k, (kandidaten.get(s.k) || 0) + s.c.length);
  let sieger: Fenster | null = null, siegerEinsaetze = 0;
  for(const [f, einsaetze] of kandidaten){
    if(einsaetze < FENSTER_EINSAETZE_MIN) continue;
    const pulls = pool.filter(p => spurVon(p, h) && (p.alle || spurVon(p, f)));
    if(!pulls.length) continue;
    const je = FENSTER_LAENGEN.map(l => {
      const L = l * 1000;
      const sum: Teilung = {dIn: 0, hIn: 0, kIn: 0, dAus: 0, hAus: 0, kAus: 0};
      let zeit = 0, deck = 0, mit = 0, dafuer = 0;
      for(const p of pulls){
        const fb = beginne(spurVon(p, f));
        const t = teilen(spurVon(p, h)!, fb, L, p.aus);
        sum.dIn += t.dIn; sum.hIn += t.hIn; sum.kIn += t.kIn;
        sum.dAus += t.dAus; sum.hAus += t.hAus; sum.kAus += t.kAus;
        zeit += p.sekunden * 1000;
        deck += gedeckt(fb, L, p.sekunden * 1000);
        if(t.hIn >= FENSTER_RICHTUNG_MIN && t.hAus >= FENSTER_RICHTUNG_MIN){
          mit++;
          if(t.dIn / t.hIn > t.dAus / t.hAus) dafuer++;
        }
      }
      const gewinn = sum.hIn && sum.hAus && sum.dAus ? (sum.dIn / sum.hIn) / (sum.dAus / sum.hAus) - 1 : -Infinity;
      return {l, sum, gewinn, abdeckung: zeit ? deck / zeit : 0, mit, dafuer};
    }).filter(x => x.sum.hIn >= FENSTER_TREFFER_MIN && x.sum.hAus >= FENSTER_TREFFER_MIN);
    if(!je.length) continue;
    const hoechst = Math.max(...je.map(x => x.gewinn));
    const w = je.filter(x => x.gewinn >= hoechst - GLEICH).sort((a, b) => b.l - a.l)[0]!;
    if(w.gewinn < FENSTER_GEWINN_MIN) continue;
    if(w.abdeckung < FENSTER_ABDECKUNG[0] || w.abdeckung > FENSTER_ABDECKUNG[1]) continue;
    if(!w.mit || 2 * w.dafuer < w.mit) continue;
    const kandidat: Fenster = {
      f, h, l: w.l, gewinn: w.gewinn,
      jeIn: w.sum.dIn / w.sum.hIn, jeAus: w.sum.dAus / w.sum.hAus,
      kritIn: w.sum.kIn / w.sum.hIn, kritAus: w.sum.kAus / w.sum.hAus,
      pulls: pulls.length, abdeckung: w.abdeckung,
    };
    if(!sieger || kandidat.gewinn > sieger.gewinn + 1e-12 ||
       (Math.abs(kandidat.gewinn - sieger.gewinn) <= 1e-12 && einsaetze > siegerEinsaetze)){
      sieger = kandidat; siegerEinsaetze = einsaetze;
    }
  }
  return sieger;
}

/** Was ein Pull ueber das Fenster sagt. */
export interface FensterWerte {
  /** Schaden von H ausserhalb / Schaden von H */
  aussen: number;
  hAussen: number;
  jeIn: number | null;
  jeAus: number | null;
  trefferIn: number;
  trefferAus: number;
  kritIn: number | null;
  kritAus: number | null;
  /** Einsaetze von F je Minute gekaempfter Zeit */
  jeMinute: number | null;
  /** Schaden, den H ausserhalb weniger gebracht hat - nie negativ */
  kosten: number;
  /** die Staerken, mit denen die Kosten gerechnet sind: die des Kampfes oder die des Builds */
  kIn: number | null;
  kAus: number | null;
}

/* Die Werte eines Pulls (4.3). null, wo nichts zu lesen ist: H nicht im
   Kampf, oder ein gespeicherter Pull, der F nicht unter seinen zwoelf
   traegt - dann ist auch die Teilung unbekannt, nicht "alles aussen". */
export function fensterLesen(p: FPull, fe: Fenster): FensterWerte | null {
  const h = spurVon(p, fe.h);
  if(!h) return null;
  const f = spurVon(p, fe.f);
  if(!f && !p.alle) return null;
  const t = teilen(h, beginne(f), fe.l * 1000, p.aus);
  const gesamt = t.dIn + t.dAus;
  if(!(gesamt > 0)) return null;
  const jeIn = t.hIn ? t.dIn / t.hIn : null, jeAus = t.hAus ? t.dAus / t.hAus : null;
  /* Die Staerken DIESES Kampfes, wenn beide Seiten genug Treffer haben (so
     rechnet das Beispiel 21:14), sonst die des Builds. */
  const eigen = t.hIn >= FENSTER_EIGENE_MIN && t.hAus >= FENSTER_EIGENE_MIN;
  const kIn = eigen ? jeIn : fe.jeIn, kAus = eigen ? jeAus : fe.jeAus;
  const faktor = kIn != null && kAus ? kIn / kAus - 1 : 0;
  return {
    aussen: t.dAus / gesamt, hAussen: t.dAus, jeIn, jeAus, trefferIn: t.hIn, trefferAus: t.hAus,
    kritIn: t.hIn ? t.kIn / t.hIn : null, kritAus: t.hAus ? t.kAus / t.hAus : null,
    jeMinute: p.sekunden > 0 ? (f ? f.c.length : 0) / (p.sekunden / 60) : null,
    kosten: t.dAus * Math.max(0, faktor), kIn, kAus,
  };
}

/* Wogegen die Kosten rechnen (Issue #108). Ohne Bezug gegen alles im
   Fenster (w.kosten). Mit Bezugspull nur der Teil ausserhalb, der ueber
   dessen Anteil liegt: bei einem Boss, dessen Fenster nur einen Teil des
   Kampfes offen ist, erreicht niemand 0 % - gegen 0 % gerechnet hiess ein
   Kampf mit 30 % aussen teuer, obwohl der beste Pull 41 % hatte. */
export function fensterKosten(w: FensterWerte, bezugAussen: number | null): number {
  if(bezugAussen == null) return w.kosten;
  if(!(w.aussen > bezugAussen) || !(w.aussen > 0)) return 0;
  return w.kosten * (w.aussen - bezugAussen) / w.aussen;
}
/** Kandidat fuers eine Urteil: erst ab 20 % ausserhalb, schlechter als der Bezug (wenn es einen gibt) und ab `ab` (2 %) des Kampfes. */
export function fensterUrteil(w: FensterWerte, gesamt: number, ab = 0.02, bezugAussen: number | null = null): boolean {
  return w.aussen >= FENSTER_URTEIL_AB && gesamt > 0 && (bezugAussen == null || w.aussen > bezugAussen) &&
    fensterKosten(w, bezugAussen) >= ab * gesamt;
}

/* Nebenziele (4.4): Schaden auf alles, was nicht Hauptziel ist, als Anteil
   am ganzen Kampf, genannt ab 5 %. "ab" ist die ganze Sekunde, bis zu der
   5 % des Nebenziel-Schadens gelandet waren - ein einzelner Streifschuss
   frueh im Kampf verschiebt sie nicht. Zeiten in ms ab Beginn des Kampfes. */
export function nebenziele(treffer: { t: number; dmg: number; ziel: string }[], haupt: (ziel: string) => boolean,
                           gesamt: number): { anteil: number; ziele: { ziel: string; anteil: number }[]; ab: number } | null {
  if(!(gesamt > 0)) return null;
  const neben = treffer.filter(x => !haupt(x.ziel));
  let summe = 0;
  const je = new Map<string, number>();
  for(const x of neben){ summe += x.dmg; je.set(x.ziel, (je.get(x.ziel) || 0) + x.dmg); }
  const anteil = summe / gesamt;
  if(anteil < NEBEN_AB) return null;
  let bis = 0, ab = 0;
  for(const x of [...neben].sort((a, b) => a.t - b.t)){
    bis += x.dmg;
    if(bis >= NEBEN_AB * summe){ ab = Math.floor(x.t / 1000) * 1000; break; }
  }
  const ziele = [...je.entries()].map(([ziel, d]) => ({ziel, anteil: d / gesamt}))
    .sort((a, b) => b.anteil - a.anteil || (a.ziel < b.ziel ? -1 : 1));
  return {anteil, ziele, ab};
}

/* Der Start (4.5): Schnitt der ersten 10 Sekundenwerte gegen den Bezug,
   beide Kaempfe >= 20 s. */
export function start(ps: number[], bezug: number[]):
    { dps: number; bezug: number; q: number; art: "schwaecher" | "ueblich" | "staerker" } | null {
  if(ps.length < START_MIN_S || bezug.length < START_MIN_S) return null;
  const schnitt = (r: number[]) => r.slice(0, START_S).reduce((a, b) => a + (b || 0), 0) / START_S;
  const dps = schnitt(ps), b = schnitt(bezug);
  if(!(b > 0)) return null;
  const q = dps / b;
  return {dps, bezug: b, q, art: q < START_SCHWAECHER ? "schwaecher" : q >= START_STAERKER ? "staerker" : "ueblich"};
}

/* ---------- Luecken nach dem Median (Neugestaltung 28.09., Luecken 4.3) ----------
   Wie im Entwurf (leerzeit): die gewoehnliche Sekunde ist der Median der
   Sekunden mit Treffern; eine Luecke sind mindestens LUECKE_MIN_S Sekunden am
   Stueck, in denen weniger als LUECKE_ANTEIL davon ankam. Die ersten
   LUECKE_ANFANG_S und die letzten LUECKE_ENDE_S Sekunden zaehlen nicht:
   Anlauf und Ende eines Pulls sind keine Leerzeit. Eine Sekunde, in der das
   Ziel unverwundbar war (aus), ist keine Luecke und zaehlt nicht zum
   Median - dort lief Mechanik (#37). Luecken als [von, bis) in ganzen
   Sekunden ab Beginn des Kampfes. */
export const LUECKE_MIN_S = 2, LUECKE_ANTEIL = 0.02, LUECKE_ANFANG_S = 3, LUECKE_ENDE_S = 5;
export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  if(!n) return 0;
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}
export interface Luecken {
  median: number;
  grenze: number;
  luecken: [number, number][];
  summe: number;
  laengste: [number, number] | null;
}
export function luecken(sek: readonly number[], aus: readonly boolean[] = []): Luecken {
  const n = sek.length;
  const med = median(sek.filter((v, i) => v > 0 && !aus[i]));
  const grenze = med * LUECKE_ANTEIL;
  const out: [number, number][] = [];
  let a = -1;
  for(let i = 0; i <= n; i++){
    const leer = med > 0 && i < n && i >= LUECKE_ANFANG_S && i < n - LUECKE_ENDE_S && !aus[i] && sek[i]! < grenze;
    if(leer && a < 0) a = i;
    if(!leer && a >= 0){ if(i - a >= LUECKE_MIN_S) out.push([a, i]); a = -1; }
  }
  const summe = out.reduce((x, [p, q]) => x + q - p, 0);
  const laengste = out.reduce<[number, number] | null>((x, g) => !x || g[1] - g[0] > x[1] - x[0] ? g : x, null);
  return {median: med, grenze, luecken: out, summe, laengste};
}
/** Einsaetze je Minute ueber die ganze Zeit und ohne die Luecken. */
export function jeMinute(n: number, sekunden: number, leer: number): { mit: number | null; ohne: number | null } {
  return {mit: sekunden > 0 ? n / sekunden * 60 : null, ohne: sekunden - leer > 0 ? n / (sekunden - leer) * 60 : null};
}

/* ---------- die schwaechste Stelle (Issue #105) ----------
   Drei Sekunden gelten erst als schwach, wenn sie unter der Haelfte der
   gewoehnlichen Sekunde liegen (Median der Sekunden mit Treffern;
   Entscheidung vom 04.10.2026). Vorher stand der Eintrag "Schwaechste drei Sekunden" mit
   "Pruefe, was dort im Cooldown war" auch bei 84.8k gegen einen Median von
   84.8k da. Eintrag und Urteil fragen dieselbe Grenze. */
export const SCHWACH_ANTEIL = 0.5;
export function schwacheStelle(dps: number, median: number): boolean {
  return median > 0 && dps < SCHWACH_ANTEIL * median;
}

/* ---------- die Haelften (Issue #106) ----------
   Der Satz ueber die Haelften steht nur, wenn eine deutlich staerker war:
   ab dem 1,15-fachen der anderen (gleichbedeutend: die schwaechere unter dem
   0,87-fachen). "Dem 1,0-fachen der ersten" war keine Aussage. sek sind die
   Sekunden ohne Unverwundbar und Mechanik; bei ungerader Zahl ist die erste
   Haelfte die kleinere. Eine leere Haelfte (Schnitt 0) sagt nichts. */
export const HAELFTE_AB = 1.15;
export function haelften(sek: readonly number[]):
    { erste: number; zweite: number; x: number; staerker: "erste" | "zweite" } | null {
  const n = sek.length, halb = Math.floor(n / 2);
  if(!halb) return null;
  let a = 0, b = 0;
  for(let i = 0; i < n; i++) i < halb ? (a += sek[i]!) : (b += sek[i]!);
  const erste = a / halb, zweite = b / (n - halb);
  if(!(erste > 0) || !(zweite > 0)) return null;
  const x = Math.max(erste, zweite) / Math.min(erste, zweite);
  if(x < HAELFTE_AB) return null;
  return {erste, zweite, x, staerker: zweite >= erste ? "zweite" : "erste"};
}

/* ---------- Werkbank (#218, Spezifikation 2026-10-07) ----------
   Die Hitze eines Einsatzes: normal, stark, kritisch, kritisch stark - ab
   der Haelfte seiner Treffer zaehlt eine Art. */
export type Hitze = 0 | 1 | 2 | 3;
export function hitze(kritAnteil: number, starkAnteil: number): Hitze {
  const k = kritAnteil >= 0.5, s = starkAnteil >= 0.5;
  return k && s ? 3 : k ? 2 : s ? 1 : 0;
}

/* Die staerksten fuenf Sekunden am Stueck (eigene Messung 07.10.2026: im
   Median 19 % des Pulls, nur 28 % davon im Opener). Bei Gleichstand die
   fruehere. */
export const STRECKE_S = 5;
export function staerksteStrecke(sek: readonly number[], l = STRECKE_S): { von: number; bis: number; summe: number } | null {
  if(sek.length <= l) return null;
  let s = 0;
  for(let i = 0; i < l; i++) s += sek[i]!;
  let best = s, von = 0;
  for(let i = l; i < sek.length; i++){
    s += sek[i]! - sek[i - l]!;
    if(s > best){ best = s; von = i - l + 1; }
  }
  return {von, bis: von + l, summe: best};
}

/* Wo der Abstand zum besten Pull am staerksten waechst: das 15-s-Fenster mit
   dem groessten Rueckstand, nur wenn der Pull am Ende hinten liegt und das
   Fenster mindestens 10 % des ganzen Abstands traegt. Beide Reihen sind
   Schaden je Sekunde ab Beginn; gezaehlt wird bis zum Ende der kuerzeren. */
export const ABSTAND_FENSTER_S = 15, ABSTAND_MIN_ANTEIL = 0.10;
export function abstandWaechst(ich: readonly number[], bester: readonly number[]): { von: number; bis: number; fehlt: number; ende: number } | null {
  const n = Math.min(ich.length, bester.length), L = ABSTAND_FENSTER_S;
  if(n < L) return null;
  let ende = 0;
  for(let i = 0; i < n; i++) ende += bester[i]! - ich[i]!;
  if(ende <= 0) return null;
  let d = 0;
  for(let i = 0; i < L; i++) d += bester[i]! - ich[i]!;
  let best = d, von = 0;
  for(let i = L; i < n; i++){
    d += (bester[i]! - ich[i]!) - (bester[i - L]! - ich[i - L]!);
    if(d > best){ best = d; von = i - L + 1; }
  }
  if(best < ABSTAND_MIN_ANTEIL * ende) return null;
  return {von, bis: von + L, fehlt: best, ende};
}

/* Laufzeit im Takt (#219: Toedliche Viper und Hauch der Verzweiflung ticken
   fest einmal je Sekunde). Ein Lauf: Ticks hoechstens 1,5 s auseinander;
   jeder Lauf zaehlt eine Sekunde ueber seinen letzten Tick hinaus. */
export const TAKT_MS = 1000, TAKT_TOL = 0.04, TAKT_ANTEIL = 0.6, TAKT_MIN = 50, LAUF_LUFT_MS = 1500;
export function imTakt(abstaende: readonly number[]): boolean {
  if(abstaende.length < TAKT_MIN) return false;
  const im = abstaende.filter(d => Math.abs(d - TAKT_MS) <= TAKT_MS * TAKT_TOL).length;
  return im / abstaende.length >= TAKT_ANTEIL;
}
/* Ruling 13 (09.10.2026): im Takt UND in kurzen Laeufen. Ein Dauerschaden
   tickt einige Sekunden je Einsatz; was im Sekundentakt ohne Ende trifft
   (Median der Laeufe ueber 20 s), ist eine gedrueckte Faehigkeit.
   laufLaengenMs: die Laengen der Laeufe (taktLaeufe) je Kampf und Ziel. Der
   Median ist nach der Zeit gewichtet (die Laenge des Laufs, in dem die
   mittlere Sekunde liegt): ein Pull voller Luecken zerfiele sonst in viele
   kurze Stuecke und ueberstimmte die langen. */
export const TAKT_LAUF_MAX_MS = 20000;
export function taktMitLaeufen(abstaende: readonly number[], laufLaengenMs: readonly number[]): boolean {
  if(!laufLaengenMs.length || !imTakt(abstaende)) return false;
  const l = [...laufLaengenMs].sort((a, b) => a - b), halb = l.reduce((s, x) => s + x, 0) / 2;
  let summe = 0, mitte = l[l.length - 1]!;
  for(const x of l){ summe += x; if(summe >= halb){ mitte = x; break; } }
  return mitte <= TAKT_LAUF_MAX_MS;
}
export function taktLaeufe(zeiten: readonly number[]): { laeufe: [number, number][]; lief: number } {
  const laeufe: [number, number][] = [];
  let a = -1, p = -1;
  for(const t of zeiten){
    if(a < 0){ a = t; p = t; continue; }
    if(t - p > LAUF_LUFT_MS){ laeufe.push([a, p + TAKT_MS]); a = t; }
    p = t;
  }
  if(a >= 0) laeufe.push([a, p + TAKT_MS]);
  return {laeufe, lief: laeufe.reduce((s, [x, y]) => s + y - x, 0)};
}

/* Protest aus (Entscheidung vom 08.10.2026): mindestens 4 s kein eigener Treffer,
   und in der Zeit trafen mindestens drei andere - sonst war der Boss weg,
   nicht der Protest aus. Nicht in den ersten 3 s und den letzten 5 s, wie
   die Luecken. Die Zeiten sind aufsteigend, in ms ab Beginn. */
export const AUS_MIN_MS = 4000, AUS_FREMDE_MIN = 3;
export function ausStrecken(eigene: readonly number[], fremde: readonly number[], dauerMs: number): [number, number][] {
  const out: [number, number][] = [];
  const anfang = LUECKE_ANFANG_S * 1000, ende = dauerMs - LUECKE_ENDE_S * 1000;
  for(let i = 1; i < eigene.length; i++){
    const a = eigene[i - 1]!, b = eigene[i]!;
    if(b - a < AUS_MIN_MS || a < anfang || b > ende) continue;
    let n = 0;
    for(const t of fremde) if(t > a && t < b && ++n >= AUS_FREMDE_MIN) break;
    if(n >= AUS_FREMDE_MIN) out.push([a, b]);
  }
  return out;
}

/* Welche Faehigkeit welches Fach bekommt: die staerkste Einsatz-Faehigkeit
   (Ventius eingeschlossen) wird Hauptfach, die naechsten drei mit mindestens
   0,8 % des Schadens mittlere Faecher, der Rest "Weitere". Laufzeit und
   Passiv stehen fuer sich und werden nie Hauptfach - Passiv setzt du nicht
   selbst ein (Entscheidung vom 08.10.2026). */
export type FArt = "einsatz" | "ventius" | "takt" | "dicht" | "passiv";
export interface FFaehigkeit { k: string; dmg: number; art: FArt }
export const MITTEL_MIN_ANTEIL = 0.008, MITTEL_MAX = 3;
export function faecherOrdnen(xs: readonly FFaehigkeit[]): { haupt: string | null; mittel: string[]; weitere: string[]; lauf: string[]; passiv: string[] } {
  const ges = xs.reduce((s, x) => s + x.dmg, 0);
  const nach = [...xs].sort((a, b) => b.dmg - a.dmg);
  const ein = nach.filter(x => x.art === "einsatz" || x.art === "ventius");
  const haupt = ein[0]?.k ?? null;
  const rest = ein.slice(1);
  const mittel = rest.filter(x => ges > 0 && x.dmg / ges >= MITTEL_MIN_ANTEIL).slice(0, MITTEL_MAX).map(x => x.k);
  return {
    haupt, mittel,
    weitere: rest.filter(x => !mittel.includes(x.k)).map(x => x.k),
    lauf: nach.filter(x => x.art === "takt" || x.art === "dicht").map(x => x.k),
    passiv: nach.filter(x => x.art === "passiv").map(x => x.k),
  };
}

/* Krit- und Stark-Rate der DIREKTEN Treffer (#269). Laufzeit (takt, dicht)
   und Passiv machen viele Zeilen und wenig Schaden aus und kritisieren
   anders als die Treffer, die du ausloest; sie zaehlen nicht in die Rate,
   in die Gesamtzahl schon. Eine Faehigkeit mit mindestens NIE_KRIT_MIN
   Treffern und ohne einen Krit kann nicht kritisch sein: sie bleibt aus der
   Krit-Rate (null Prozent waere ein Urteil, das sie nicht verdient), in der
   Stark-Rate bleibt sie. Ohne direkte Treffer (oder ohne eine, die kritisch
   sein kann) ist die jeweilige Rate null. */
export const NIE_KRIT_MIN = 20;
export interface RateFach { art: FArt; hits: number; crit: number; heavy: number }
export interface DirekteRaten { gesamt: number; direkt: number; krit: number | null; stark: number | null; nie: number }
export function direkteRaten(xs: readonly RateFach[]): DirekteRaten {
  let gesamt = 0, direkt = 0, heavy = 0, kHits = 0, kCrit = 0, nie = 0;
  for(const x of xs){
    gesamt += x.hits;
    if(x.art !== "einsatz" && x.art !== "ventius") continue;
    direkt += x.hits; heavy += x.heavy;
    if(x.crit === 0 && x.hits >= NIE_KRIT_MIN){ nie++; continue; }
    kHits += x.hits; kCrit += x.crit;
  }
  return {gesamt, direkt, krit: kHits ? kCrit / kHits : null, stark: direkt ? heavy / direkt : null, nie};
}

/* Die Faecher so ins Raster aus zwoelf Spalten legen, dass keine Zelle leer
   bleibt (Spezifikation 3.4): geschlossen steht das Hauptfach links ueber so
   viele Zeilen, wie mittlere Faecher daneben stehen; offen nimmt ein Fach die
   ganze Breite, die geschlossenen mittleren teilen sich dann eine Zeile.
   "allein": im schmalen Raster (zwei Spalten) bliebe das letzte einer
   ungeraden Zahl allein und nimmt die volle Breite. */
export interface Platz { k: string; spalte: string; zeile: string; allein: boolean }
export function packen(haupt: string, mittel: readonly string[], offen: ReadonlySet<string>): Platz[] {
  const zu = mittel.filter(k => !offen.has(k)), auf = mittel.filter(k => offen.has(k));
  const hVoll = offen.has(haupt) || zu.length === 0;
  const out: Platz[] = [{k: haupt, spalte: hVoll ? "1/-1" : "span 7", zeile: hVoll ? "auto" : "span " + zu.length, allein: false}];
  zu.forEach((k, i) => out.push({k, spalte: hVoll ? "span " + 12 / zu.length : "span 5", zeile: "auto",
    allein: zu.length % 2 === 1 && i === zu.length - 1}));
  auf.forEach(k => out.push({k, spalte: "1/-1", zeile: "auto", allein: false}));
  return out;
}

/* Was an einer Faehigkeit auffaellt (#270): der Satz der Zeile in der Werkbank.
   Die Analyse soll sagen, was die Striche bedeuten, nicht nur zeigen, wann sie
   standen. Drei Fragen, in dieser Folge: (1) gegenueber dem besten Pull im
   selben Zeitraum - weniger Einsaetze, oder je Einsatz weniger; (2) eine Pause,
   die zum eigenen Takt der Faehigkeit nicht passt (mindestens vier Einsaetze,
   mindestens 15 s und mindestens drei Takte); (3) sonst nur Zahl und Takt.
   Eine Pause, die in einer Luecke des ganzen Kampfes liegt (das Ziel war nicht
   zu treffen, Unverwundbarkeit, Mechanik), ist keine: nur der Teil ausserhalb
   der Luecken zaehlt, auch fuer den Takt. Eine Faehigkeit unter 0,8 % des
   Schadens ist nie ein Befund. Zeiten in ms ab Kampfbeginn; Luecken in
   Sekunden wie luecken(). `dauer` ist der Teil der Pause ausserhalb der Luecken, `spanne` die ganze Strecke zwischen den zwei Einsaetzen. Ein Befund ist keine Wertung (kein Rot, kein Gruen),
   er nennt, was von der Regel abweicht. */
export const ZEILE_KAUM_ANTEIL = 0.008, ZEILE_KAUM_MAX = 6, ZEILE_PAUSE_MIN_MS = 15000, ZEILE_PAUSE_TAKTE = 3,
  ZEILE_BEZUG_MIN = 3, ZEILE_SCHWACH = 0.85;
export type ZeilenArt = "keine" | "eins" | "kaum" | "takt" | "pause" | "weniger" | "schwach";
export interface ZeilenBefund {
  art: ZeilenArt; befund: boolean; pause: [number, number] | null;
  at?: number; n?: number; je?: number; dauer?: number; spanne?: number; nb?: number; minus?: number;
}
export function zeilenBefund(einsaetze: readonly { t: number; dmg: number }[], T: number, anteil: number,
    best: readonly { t: number; dmg: number }[] | null, lueckenS: readonly (readonly [number, number])[]): ZeilenBefund {
  const e = [...einsaetze].sort((a, b) => a.t - b.t), n = e.length;
  if(n === 0) return {art: "keine", befund: false, pause: null};
  if(n === 1) return {art: "eins", befund: false, pause: null, at: e[0]!.t};
  const aussen = (a: number, b: number) => {
    let d = b - a;
    for(const [g0, g1] of lueckenS) d -= Math.max(0, Math.min(b, g1*1000) - Math.max(a, g0*1000));
    return Math.max(0, d);
  };
  const ab = e.slice(1).map((x, i) => aussen(e[i]!.t, x.t));
  const je = median(ab);
  const gewicht = anteil >= ZEILE_KAUM_ANTEIL;
  if(gewicht && best && best.length){
    const b = best.filter(c => c.t < T), nb = b.length;
    if(nb >= ZEILE_BEZUG_MIN){
      if(n <= nb*0.8 && nb - n >= 2) return {art: "weniger", befund: true, pause: null, n, nb};
      const mb = median(b.map(c => c.dmg)), mn = median(e.map(c => c.dmg));
      if(mb > 0 && mn < mb*ZEILE_SCHWACH) return {art: "schwach", befund: true, pause: null, minus: Math.round((1 - mn/mb)*100)/100};
    }
  }
  if(gewicht && n >= 4){
    let gi = 0; ab.forEach((x, i) => { if(x > ab[gi]!) gi = i; });
    const dauer = ab[gi]!;
    if(dauer >= Math.max(ZEILE_PAUSE_MIN_MS, je*ZEILE_PAUSE_TAKTE))
      return {art: "pause", befund: true, pause: [e[gi]!.t, e[gi + 1]!.t], n, je, dauer, spanne: e[gi + 1]!.t - e[gi]!.t};
  }
  if(!gewicht && n < ZEILE_KAUM_MAX) return {art: "kaum", befund: false, pause: null, n};
  return {art: "takt", befund: false, pause: null, n, je};
}
