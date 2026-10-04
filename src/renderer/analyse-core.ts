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

/** Kandidat fuers eine Urteil: erst ab 20 % ausserhalb und ab `ab` (2 %) des Kampfes. */
export function fensterUrteil(w: FensterWerte, gesamt: number, ab = 0.02): boolean {
  return w.aussen >= FENSTER_URTEIL_AB && gesamt > 0 && w.kosten >= ab * gesamt;
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
