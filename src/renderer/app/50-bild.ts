import { state } from "./01-state";
import { dur, fmt, full, toast } from "./03-helpers";
import { stats } from "./06-blocks-and-places";
import { t } from "./08-translation";
import { pct } from "./16-fight-analysis";
import { $, cssv } from "./18-interface-basics";
import { kampfSatz } from "./20-meter-head";
import { groupRows, partyForFight, partyGroupRows } from "./19-grouping-and-party-fights";
import { whenSavedText } from "./34-menus-drop-and-tabs";
import { download } from "./35-party-log-files";
import { pullWhen } from "../best-pull-core";
import type { BarRow, PartyView } from "../types";

/* ---------- Als Bild teilen ----------
   Spezifikation Fortschritt, Merkmal 4, "Bild teilen".

   Ein PNG eines Kampfes (Kopf und Tabelle) oder der Gruppentafel - von
   der Seite selbst auf eine Leinwand gezeichnet, aus den
   Zahlen, nicht vom Bildschirm abfotografiert. Eine Bildschirmaufnahme
   verbietet das Audit dem Hauptprozess (safety-audit.mjs, Abschnitt 3),
   und die Seite macht auch keine; ein Bild aus den Zahlen zeigt ausserdem
   nur, was es zeigen soll - keinen Mauszeiger, kein anderes Fenster,
   keinen halb offenen Tooltip. Das Bild des Abends entfaellt mit dem
   Abend (Neugestaltung 28.09., Spezifikation 3).

   Im Bild stehen nur Namen und Zahlen: kein Bossportraet, kein Skill- oder
   Waffensymbol. Die stammen aus dem Spiel und fallen nicht unter die GPL
   (licenses/README.md); geteilt wird, was Borometer selbst schreibt.

   Das Bild nimmt das aktive Thema: Flaeche, Schrift und Farben kommen aus
   den Tokens (cssv). Gespeichert wird ueber den Download des Browsers
   (<a download> mit einem Blob, download() in 35-party-log-files.ts; die
   App fragt nach dem Ort), kopiert ueber navigator.clipboard.write mit
   image/png. Kein Endpunkt, kein Schreibort im Hauptprozess, kein
   Hochladen, kein Link: wohin das Bild geht, entscheidet, wer es hat. */

export type BildArt = "kampf" | "board";

/** Eine Zeile der Tabelle im Bild: Name und Werte; ein Balken nur, wo die Tabelle der App auch einen hat. */
interface BildZeile {
  name: string;
  werte: string[];
  /** Anteil am Groessten, 0..1 */
  balken?: number;
  farbe?: string;
}
interface BildInhalt {
  titel: string;
  unter: string;
  /** die grosse Zahl rechts, mit ihrer Einheit darunter */
  zahl?: string | undefined;
  einheit?: string | undefined;
  rang: boolean;
  /** die Kopfzeile: erst die Namensspalte, dann die Werte ... */
  spalten: string[];
  /** ... und deren Breiten in Punkten, von links nach rechts */
  breiten: number[];
  zeilen: BildZeile[];
  /** der Lesesatz aus dem Kopf der App (kampfSatz), unter der Faktenzeile */
  satz?: string | undefined;
  mehr?: string | undefined;
  fuss: string[];
  /** was im Bild steht, als Satz - ueber den Knoepfen und als Ersatztext */
  was: string;
  datei: string;
}

/** Hoechstens so viele Zeilen der Tabelle; der Rest steht als "und N weitere" darunter. */
const BILD_ZEILEN = 12;
/** Breite in CSS-Punkten; gezeichnet wird doppelt so fein, damit es im Chat scharf bleibt. */
const BILD_W = 720;
const BILD_DPR = 2;
const RAND = 24;
const ZEILE_H = 26;

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "bild";
const tagIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const liste = (namen: string[]) => namen.join(", ");

/* Wessen Zahlen der Kopf zeigt - dieselbe Regel wie die Faktenzeile in
   20-meter-head.ts: ein Name nur, wenn es genau einen gibt oder gefiltert ist. */
function wessen(): string | null {
  if(state.player !== "__all") return state.player;
  return state.players && state.players.length === 1 ? state.players[0]! : null;
}

function kampf(): BildInhalt | null {
  const seg = state.encounters[state.sel];
  if(!seg) return null;
  const s = seg.stats || stats(seg);
  // die Tabelle, wie sie gruppiert ist - nur die Gruppentafel hat ein eigenes Bild
  const mode = state.group === "party" ? "skill" : state.group;
  const rows = groupRows(seg, mode).slice().sort((a, b) => b.damage - a.damage);
  const peak = Math.max(1, ...rows.map(r => r.damage || 0));
  const wer = wessen();
  const namen = [...new Set([...(wer ? [wer] : []), ...(mode === "player" ? rows.slice(0, BILD_ZEILEN).map(r => r.label) : [])])];
  const gezeigt = Math.min(rows.length, BILD_ZEILEN);
  return {
    titel: s.name,
    unter: [wer || t("head.allInLog"), state.noTime ? null : dur(s.seconds), full(s.total) + " " + t("head.damage"),
            pullWhen(seg.start, state.lang)].filter(Boolean).join("  \u00b7  "),
    zahl: state.noTime ? undefined : fmt(s.dps), einheit: t("head.dpsUnit"),
    rang: true,
    spalten: [t("bars.name"), t("bars.damage"), t("bars.dps"), t("bars.share")], breiten: [92, 92, 92],
    zeilen: rows.slice(0, BILD_ZEILEN).map(r => zeileAus(r, peak)),
    /* Der Satz, den nur Borometer schreibt, gehoert ins Bild (Kritik 25.09.):
       ohne ihn war das geteilte Bild eine Zahl mit einer Balkentabelle, wie
       jedes andere Meter sie auch malt. */
    satz: kampfSatz(seg, s) || undefined,
    mehr: rows.length > BILD_ZEILEN ? t("bild.more", {n: rows.length - BILD_ZEILEN}) : undefined,
    fuss: [],
    was: t("bild.inKampf", {boss: s.name, rows: gezeigt, namen: liste(namen)}),
    datei: "borometer-" + slug(s.name) + "-" + tagIso(seg.start) + ".png",
  };
}
function zeileAus(r: BarRow, peak: number): BildZeile {
  return {name: r.label, werte: [fmt(r.damage, 1e3), state.noTime ? "\u2014" : fmt(r.dps, 1e3), pct(r.share, 1)],
          balken: (r.damage || 0) / peak, farbe: r.color};
}

function board(): BildInhalt | null {
  const p: Partial<PartyView> = state.party || {};
  const seg = state.encounters[state.sel];
  const fuer = seg ? partyForFight(seg) : null;
  const rows = partyGroupRows().slice().sort((a, b) => b.damage - a.damage);
  if(!rows.length) return null;
  const peak = Math.max(1, ...rows.map(r => r.damage || 0));
  const titel = fuer && seg ? stats(seg).name : (p.target || t("party.logTitle"));
  const dmg = rows.reduce((a, r) => a + (r.damage || 0), 0), dps = rows.reduce((a, r) => a + (r.dps || 0), 0);
  const wann = fuer && seg ? seg.start : Date.parse(p.savedAt || "") || null;
  const namen = rows.map(r => r.label).sort((a, b) => a.localeCompare(b));
  return {
    titel,
    // ein geladenes Gruppen-Log sagt, von wann es ist - wie der Kopf (party.snapshotFrom)
    unter: [t("bild.party", {n: rows.length}), full(dmg) + " " + t("head.damage"),
            fuer && seg ? pullWhen(seg.start, state.lang)
            : p.frozen ? t("party.snapshotFrom", {when: whenSavedText(Math.floor(Date.parse(p.savedAt || "") / 1000) || 0)}) : null]
      .filter(Boolean).join("  \u00b7  "),
    zahl: fmt(dps), einheit: t("head.dpsUnit"),
    rang: true,
    spalten: [t("party.colPlayer"), t("bars.damage"), t("bars.dps"), t("bars.share")], breiten: [92, 92, 92],
    zeilen: rows.slice(0, BILD_ZEILEN).map(r => zeileAus(r, peak)),
    mehr: rows.length > BILD_ZEILEN ? t("bild.more", {n: rows.length - BILD_ZEILEN}) : undefined,
    fuss: [],
    was: t("bild.inBoard", {boss: titel, namen: liste(namen)}),
    datei: "borometer-" + slug(titel) + (wann ? "-" + tagIso(wann) : "") + ".png",
  };
}

export function bildInhalt(art: BildArt): BildInhalt | null {
  return art === "kampf" ? kampf() : board();
}
/** Was sich gerade als Bild teilen laesst. */
export function bildArten(): BildArt[] {
  return (["kampf", "board"] as BildArt[]).filter(a => {
    if(a === "kampf") return !!state.encounters[state.sel];
    // die Tafel, sobald es eine gibt - auch wenn gerade die eigene Tabelle offen ist
    return partyGroupRows().length > 0;
  });
}

/* ---------- Zeichnen ----------
   Zwei Durchgaenge: erst messen (Zeilenumbruch der Saetze haengt an der
   Schrift), dann die Leinwand auf ihre Hoehe setzen - das setzt den
   Zustand zurueck - und zeichnen. */

/** Eine Flaeche aus einem Token: eine Farbe, oder ein Verlauf wie --lift-1 im dunklen Thema (von oben nach unten). */
function flaeche(ctx: CanvasRenderingContext2D, token: string, h: number): string | CanvasGradient {
  const v = cssv(token);
  if(!/^linear-gradient\(/.test(v)) return v || "#000";
  const farben = v.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || ["#000"];
  const g = ctx.createLinearGradient(0, 0, 0, h);
  farben.forEach((c, i) => g.addColorStop(farben.length > 1 ? i / (farben.length - 1) : 0, c));
  return g;
}
function umbrechen(ctx: CanvasRenderingContext2D, text: string, breite: number): string[] {
  const zeilen: string[] = [];
  let z = "";
  for(const w of text.split(/\s+/)){
    const probe = z ? z + " " + w : w;
    if(z && ctx.measureText(probe).width > breite){ zeilen.push(z); z = w; }
    else z = probe;
  }
  if(z) zeilen.push(z);
  return zeilen;
}
function kuerzen(ctx: CanvasRenderingContext2D, text: string, breite: number): string {
  if(ctx.measureText(text).width <= breite) return text;
  let s = text;
  while(s.length > 1 && ctx.measureText(s + "\u2026").width > breite) s = s.slice(0, -1);
  return s + "\u2026";
}

async function schriften(){
  const f = document.fonts;
  if(!f) return;
  try{
    await Promise.all([f.load("400 22px " + cssv("--display")), f.load("400 13px " + cssv("--sans")),
                       f.load("600 13px " + cssv("--sans")), f.load("400 34px " + cssv("--hero-font")),
                       // die Palatino ist eine Systemschrift; geladen wird sie, damit sie steht, bevor gemalt wird
                       f.load("400 13px " + cssv("--serif"))]);
  }catch{ /* eine Schrift fehlt: die Leinwand nimmt die naechste der Kette */ }
}

export async function zeichne(inh: BildInhalt): Promise<HTMLCanvasElement> {
  await schriften();
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d")!;   // eine frische Leinwand hat immer einen 2d-Kontext
  const sans = cssv("--sans"), display = cssv("--display"), hero = cssv("--hero-font"), serif = cssv("--serif");
  const innen = BILD_W - 2 * RAND;
  // Spalten: rechtsbuendige Werte von rechts, der Name nimmt den Rest
  const rangW = inh.rang ? 28 : 0;
  const nameX = RAND + rangW;
  const nameW = innen - rangW - inh.breiten.reduce((a, b) => a + b, 0) - 12;
  // die rechte Kante der Wertspalte i
  const rechts = (i: number) => BILD_W - RAND - inh.breiten.slice(i + 1).reduce((a, b) => a + b, 0);
  // messen
  ctx.font = "400 13px " + sans;
  const satzZeilen = inh.satz ? umbrechen(ctx, inh.satz, innen) : [];
  ctx.font = "400 11.5px " + sans;
  const fussZeilen = inh.fuss.flatMap(z => umbrechen(ctx, z, innen));
  const h = RAND + 18 + 14 + 30 + 20 + 16 + 24 + satzZeilen.length * 19 + inh.zeilen.length * ZEILE_H + (inh.mehr ? 22 : 0) +
    (fussZeilen.length ? 12 + fussZeilen.length * 17 : 0) + RAND - 10;
  cv.width = BILD_W * BILD_DPR;
  cv.height = Math.round(h * BILD_DPR);
  ctx.scale(BILD_DPR, BILD_DPR);
  ctx.textBaseline = "alphabetic";
  // Flaeche und Glutstrich, wie eine Karte der App
  ctx.fillStyle = flaeche(ctx, "--lift-1", h);
  ctx.fillRect(0, 0, BILD_W, h);
  ctx.fillStyle = cssv("--gold-ink");
  ctx.fillRect(RAND, RAND - 10, 28, 2);
  let y = RAND + 12;
  // die Marke: BOROMETER, der Satz davor, und der Name des Spiels in der Palatino
  ctx.font = "400 12px " + display;
  ctx.fillStyle = cssv("--gold-ink");
  ctx.fillText("BOROMETER", RAND, y);
  let x = RAND + ctx.measureText("BOROMETER").width + 10;
  ctx.font = "400 11.5px " + sans;
  ctx.fillStyle = cssv("--dimmer");
  const fuer = t("land.brand");
  ctx.fillText(fuer, x, y);
  x += ctx.measureText(fuer).width + 6;
  ctx.font = "400 13px " + serif;
  ctx.fillStyle = cssv("--dim");
  ctx.fillText("Throne and Liberty", x, y);
  y += 18 + 14;
  // Titel links, die grosse Zahl rechts
  let zahlW = 0;
  if(inh.zahl){
    ctx.font = "400 34px " + hero;
    zahlW = ctx.measureText(inh.zahl).width;
    ctx.fillStyle = cssv("--gold-ink");
    ctx.textAlign = "right";
    ctx.fillText(inh.zahl, BILD_W - RAND, y + 14);
    ctx.font = "400 11.5px " + sans;
    ctx.fillStyle = cssv("--dim");
    ctx.fillText(inh.einheit || "", BILD_W - RAND, y + 32);
    ctx.textAlign = "left";
  }
  ctx.font = "400 22px " + display;
  ctx.fillStyle = cssv("--text");
  ctx.fillText(kuerzen(ctx, inh.titel, innen - zahlW - 24), RAND, y + 8);
  y += 30;
  ctx.font = "400 13px " + sans;
  ctx.fillStyle = cssv("--dim");
  ctx.fillText(kuerzen(ctx, inh.unter, innen - zahlW - 24), RAND, y);
  // der Lesesatz in der Textfarbe, wie im Kopf der App
  if(satzZeilen.length){
    ctx.font = "400 13px " + sans;
    ctx.fillStyle = cssv("--text");
    for(const z of satzZeilen){ y += 19; ctx.fillText(z, RAND, y); }
  }
  y += 20 + 16;
  // Kopf der Tabelle
  ctx.font = "400 11.5px " + sans;
  ctx.fillStyle = cssv("--dimmer");
  if(inh.rang) ctx.fillText("#", RAND, y);
  ctx.fillText(inh.spalten[0]!, nameX, y);
  ctx.textAlign = "right";
  inh.spalten.slice(1).forEach((s, i) => ctx.fillText(kuerzen(ctx, s, inh.breiten[i]! - 8), rechts(i), y));
  ctx.textAlign = "left";
  ctx.fillStyle = cssv("--hair-rule-strong");
  ctx.fillRect(RAND, y + 8, innen, 1);
  y += 24;
  // die Zeilen: Balken hinter dem Namen in der Reihenfarbe, wie in der Tabelle
  inh.zeilen.forEach((z, i) => {
    const mitte = y + i * ZEILE_H;
    if(z.balken != null && z.farbe){
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = z.farbe;
      ctx.fillRect(nameX - 4, mitte - 16, Math.max(2, (nameW + 4) * Math.min(1, z.balken)), 21);
      ctx.globalAlpha = 1;
    }
    ctx.font = "400 12.5px " + sans;
    if(inh.rang){ ctx.fillStyle = cssv("--dimmer"); ctx.fillText(String(i + 1), RAND, mitte); }
    ctx.font = "500 13px " + sans;
    ctx.fillStyle = cssv("--text");
    ctx.fillText(kuerzen(ctx, z.name, nameW - 6), nameX, mitte);
    ctx.textAlign = "right";
    z.werte.forEach((w, k) => {
      // die erste Zahl der Zeile ist ihre Zahl: mit Rang der Schaden, sonst die zweite Spalte
      const haupt = inh.rang ? k === 0 : k === 1;
      ctx.font = (haupt ? "600 " : "400 ") + "13px " + sans;
      ctx.fillStyle = cssv(haupt && !inh.rang ? "--gold-ink" : haupt ? "--ink-hi" : "--text");
      ctx.fillText(kuerzen(ctx, w, inh.breiten[k]! - 8), rechts(k), mitte);
    });
    ctx.textAlign = "left";
  });
  y += inh.zeilen.length * ZEILE_H;
  if(inh.mehr){
    ctx.font = "400 12.5px " + sans;
    ctx.fillStyle = cssv("--dim");
    ctx.fillText(inh.mehr, nameX, y);
    y += 22;
  }
  if(fussZeilen.length){
    y += 12;
    ctx.font = "400 11.5px " + sans;
    ctx.fillStyle = cssv("--dimmer");
    for(const z of fussZeilen){ ctx.fillText(z, RAND, y); y += 17; }
  }
  return cv;
}

/* ---------- Der Dialog ----------
   Vorschau, ein Satz, was im Bild steht (Charakternamen der Gruppe), dann
   "Als PNG speichern" und "In die Zwischenablage". Der Fokus bleibt im
   Dialog, Esc schliesst und gibt ihn zurueck - wie openModal (36-dialog.ts). */
let art: BildArt = "kampf";
let blob: Blob | null = null;
let url = "";
let datei = "";
let vorher: HTMLElement | null = null;
let lauf = 0;

function meld(text: string){ $("#shareMeld").textContent = text; }

async function neuZeichnen(){
  const nr = ++lauf;
  const inh = bildInhalt(art);
  const arten = bildArten();
  document.querySelectorAll<HTMLButtonElement>("#shareWahl [data-bild]").forEach(b => {
    const a = b.dataset.bild as BildArt;
    b.hidden = !arten.includes(a);
    b.classList.toggle("on", a === art);
    b.setAttribute("aria-pressed", a === art ? "true" : "false");
  });
  $("#shareWahl").hidden = arten.length < 2;
  meld("");
  if(!inh) return;
  const cv = await zeichne(inh);
  const b = await new Promise<Blob | null>(res => cv.toBlob(res, "image/png"));
  if(nr !== lauf || !b) return;   // inzwischen umgeschaltet
  blob = b;
  datei = inh.datei;
  if(url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(b);
  const img = $<HTMLImageElement>("#shareImg");
  // Satz und Bild wechseln zusammen: vor "Kopieren" steht, was in DIESEM Bild ist
  img.src = url;
  img.alt = inh.was;
  $("#shareWas").textContent = inh.was;
  img.dataset.w = String(cv.width);
  img.dataset.h = String(cv.height);
}

/** Den Dialog oeffnen, mit dem, was gerade zu sehen ist - oder mit der gewuenschten Art. */
export function bildOeffnen(wunsch?: BildArt){
  const arten = bildArten();
  if(!arten.length){ toast(t("bild.none")); return; }
  art = wunsch && arten.includes(wunsch) ? wunsch
      : state.group === "party" && arten.includes("board") ? "board" : arten[0]!;
  vorher = document.activeElement as HTMLElement | null;
  blob = null;
  $("#shareWas").textContent = "";
  $("#shareBg").classList.add("on");
  state.modalOpen = true;
  $("#shareCopy").focus();
  void neuZeichnen();
}
function schliessen(){
  $("#shareBg").classList.remove("on");
  state.modalOpen = false;
  lauf++;
  if(url){ URL.revokeObjectURL(url); url = ""; }
  $<HTMLImageElement>("#shareImg").removeAttribute("src");
  blob = null;
  if(vorher && vorher.isConnected) vorher.focus({preventScroll: true});
  vorher = null;
}
async function kopieren(){
  if(!blob) return;
  try{
    if(!navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("no clipboard");
    await navigator.clipboard.write([new ClipboardItem({"image/png": blob})]);
    meld(t("bild.copied"));
  }catch{
    meld(t("bild.copyFail"));
  }
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  // der Knopf im Kopf (Stufe 3): in der vollen Ansicht gibt es das Menue nicht mehr
  $("#btnBild").onclick = () => bildOeffnen();
  document.querySelectorAll<HTMLButtonElement>("#shareWahl [data-bild]").forEach(b => b.onclick = () => {
    art = b.dataset.bild as BildArt;
    void neuZeichnen();
  });
  $("#shareSave").onclick = () => { if(blob) download(blob, datei); };
  $("#shareCopy").onclick = () => { void kopieren(); };
  $("#shareClose").onclick = schliessen;
  $("#shareBg").onclick = e => { if(e.target === $("#shareBg")) schliessen(); };
  $("#share").onkeydown = e => {
    if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); schliessen(); return; }
    if(e.key !== "Tab") return;
    const f = [...$("#share").querySelectorAll<HTMLElement>("button")].filter(n => n.offsetParent);
    if(!f.length) return;
    const first = f[0]!, last = f[f.length - 1]!;
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  };
}
