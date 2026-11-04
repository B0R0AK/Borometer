// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The Windows integration without Electron (spec Windows-Einbindung
 * 04.10.2026): the words of the tray, the jump list and the notification,
 * the start switches, the check of a fight report from the page, whether to
 * show it, the taskbar progress and the "recently read" list. Pure, so
 * scripts/test-windows-core.mjs runs all of it in Node. The words are the
 * page's nativ.* entries in 07-dictionary.ts, word for word - main cannot
 * import the page, and the test holds the two tables equal.
 */

export type Lang = "de" | "en";

const DE = {
  oeffnen: "Borometer öffnen",
  kompaktFenster: "Kompakt",
  live: "Live-Aufzeichnung",
  pin: "Über dem Spiel anheften",
  beenden: "Beenden",
  ansehen: "Ansehen",
  jumpKompakt: "Kompakt öffnen",
  jumpLive: "Live-Aufzeichnung starten",
  jumpOrdner: "Log-Ordner öffnen",
  zuletzt: "Zuletzt gelesen",
  menueKopieren: "Kopieren",
  menueRotation: "In Rotation zeigen",
};
export type TextKey = keyof typeof DE;
export const TEXTE: Record<Lang, Record<TextKey, string>> = {
  de: DE,
  en: {
    oeffnen: "Open Borometer",
    kompaktFenster: "Compact",
    live: "Live logging",
    pin: "Stay on top of the game",
    beenden: "Quit",
    ansehen: "View",
    jumpKompakt: "Open compact",
    jumpLive: "Start live logging",
    jumpOrdner: "Open log folder",
    zuletzt: "Recently read",
    menueKopieren: "Copy",
    menueRotation: "Show in rotation",
  },
};

/** Anything but "de" reads as English, like the page's own default. */
export function sprache(v: unknown): Lang {
  return v === "de" ? "de" : "en";
}

export function wort(lang: unknown, key: TextKey): string {
  return TEXTE[sprache(lang)][key];
}

/* A log's file name and nothing else, the same pattern as window.ts. */
export const LOG_NAME = /^[^\\/:*?"<>|\u0000-\u001f]{1,200}\.(txt|log)$/i;

export interface Start {
  kompakt: boolean;
  live: boolean;
  logordner: boolean;
  autostart: boolean;
  /** a log's file name from the jump list, or "" */
  log: string;
}

/*
 * The one reader of a command line: the first start's and every second
 * start's. Only these five switches exist; anything else - Chromium's own
 * switches, the exe path, a stray word - is passed over. A log name is a
 * name, never a path, and it is never opened here: the page asks
 * /api/log?name= for it, which compares it with a fresh listing.
 */
export function startSchalter(argv: readonly unknown[]): Start {
  const s: Start = { kompakt: false, live: false, logordner: false, autostart: false, log: "" };
  for (const a of argv) {
    if (a === "--kompakt") s.kompakt = true;
    else if (a === "--live") s.live = true;
    else if (a === "--logordner") s.logordner = true;
    else if (a === "--autostart") s.autostart = true;
    else if (typeof a === "string" && a.startsWith("--log=") && LOG_NAME.test(a.slice(6))) s.log = a.slice(6);
  }
  return s;
}

/** Whether a start asks the page for something (--autostart is main's own). */
export function hatAuftrag(s: Start): boolean {
  return s.kompakt || s.live || s.logordner || s.log !== "";
}

const STEUER = /[\u0000-\u001f\u007f]/;

/* The page's report of a finished fight: two texts and a flag, checked. */
export function kampfMeldung(titel: unknown, satz: unknown, best: unknown): { titel: string; satz: string; best: boolean } | null {
  if (typeof titel !== "string" || typeof satz !== "string" || typeof best !== "boolean") return null;
  const t = titel.trim();
  const s = satz.trim();
  if (!t || t.length > 120 || s.length > 240 || STEUER.test(t) || STEUER.test(s)) return null;
  return { titel: t, satz: s, best };
}

/** At most one notification in this many ms, whatever the page sends. */
export const MELDE_ABSTAND = 5000;

export function sollMelden(cfg: { meldenKampf?: unknown; meldenNurBest?: unknown }, best: boolean, vorn: boolean,
  jetzt: number, zuletzt: number | null): boolean {
  if (cfg.meldenKampf !== true) return false;
  if (cfg.meldenNurBest === true && !best) return false;
  // the window is in front and focused: the player sees the fight already
  if (vorn) return false;
  // a clock set back must not hold every notification until the old time comes round again
  return zuletzt === null || jetzt < zuletzt || jetzt - zuletzt >= MELDE_ABSTAND;
}

/** Less than this left to read is a half line, not a long read. */
export const REST_KLEIN = 65536;

/*
 * The taskbar progress after a piece of a log: the value for
 * setProgressBar, -1 to clear it, null to leave it as it is. It only shows
 * while a log needs more than one piece.
 */
export function fortschritt(to: number, size: number, zeigt: boolean): number | null {
  if (!(size > 0) || size - to < REST_KLEIN) return zeigt ? -1 : null;
  return to / size;
}

export function zuletztListe(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && LOG_NAME.test(x)) : [];
}

/* The three logs read last, newest first, each once. */
export function zuletztNeu(alt: unknown, name: string): string[] {
  const liste = zuletztListe(alt);
  if (!LOG_NAME.test(name)) return liste.slice(0, 3);
  return [name, ...liste.filter((x) => x !== name)].slice(0, 3);
}

export interface JumpEintrag { title: string; args: string; description: string }
export interface JumpKategorie { type: "tasks" | "custom"; name?: string; items: JumpEintrag[] }

/* Quoted whole: a log name may hold spaces, never a quote (LOG_NAME). */
export function logArg(name: string): string {
  return "\"--log=" + name + "\"";
}

/*
 * The jump list's content; jumplist.ts adds the program. Items the player
 * removed from the list stay out - Windows refuses a whole category that
 * brings one back.
 */
export function jumpListe(lang: Lang, zuletzt: readonly string[], entfernt: readonly string[]): JumpKategorie[] {
  const w = TEXTE[lang];
  const weg = (e: JumpEintrag) => !entfernt.includes(e.args);
  const aufgaben: JumpEintrag[] = [
    { title: w.jumpKompakt, args: "--kompakt", description: w.jumpKompakt },
    { title: w.jumpLive, args: "--live", description: w.jumpLive },
    { title: w.jumpOrdner, args: "--logordner", description: w.jumpOrdner },
  ];
  const kats: JumpKategorie[] = [{ type: "tasks", items: aufgaben.filter(weg) }];
  const logs = zuletzt.filter((n) => LOG_NAME.test(n)).map((n) => ({ title: n, args: logArg(n), description: n })).filter(weg);
  if (logs.length) kats.push({ type: "custom", name: w.zuletzt, items: logs });
  return kats;
}

export interface Fenster { isMinimized(): boolean; restore(): void; show(): void; focus(): void }

/* Out of the taskbar if minimized, out of the tray if hidden, and forward. */
export function vorholen(w: Fenster | null): void {
  if (!w) return;
  if (w.isMinimized()) w.restore();
  w.show();
  w.focus();
}

/** What the bug report says about the compact window (#382): open, whether
    shown, where it lies, and whether it is on top. A read only; the flag
    itself is written in one place, the pin case of window.ts. */
export interface KompaktMesswerte { isDestroyed(): boolean; isAlwaysOnTop(): boolean; isVisible(): boolean; getBounds(): Rect }
export interface KompaktLage { offen: boolean; oben: boolean; sichtbar: boolean; ort: { x: number; y: number; w: number; h: number } | null }
export function kompaktLage(w: KompaktMesswerte | null): KompaktLage {
  if (!w || w.isDestroyed()) return { offen: false, oben: false, sichtbar: false, ort: null };
  const b = w.getBounds();
  return { offen: true, oben: w.isAlwaysOnTop(), sichtbar: w.isVisible(), ort: { x: b.x, y: b.y, w: b.width, h: b.height } };
}

/*
 * Who takes the flag away (#382, second report): measured, the compact window
 * was on top when it opened and not any more after the first click, and nothing
 * in the code writes the flag but the pin case. So the last few things that
 * happened to the window are kept in a ring and go into the bug report next to
 * its place: what the page asked (win:<do>), what Electron said (event:...) and
 * every change of the flag seen by a look every few hundred ms (oben:true,
 * oben:false). Read only: the ring never touches the window. The kinds are
 * fixed words, never a name or a path; the time is the clock's, to the ms.
 */
export interface KompaktEreignis { t: string; art: string; n: number }
export interface KompaktBlick { isDestroyed(): boolean; isAlwaysOnTop(): boolean }
export interface KompaktPuffer {
  merke(art: string): void;
  /** Looks at the flag; writes down the first value and every change. */
  beobachte(w: KompaktBlick | null): void;
  liste(): KompaktEreignis[];
}
export function neuerKompaktPuffer(max = 60, jetzt: () => number = Date.now): KompaktPuffer {
  const eintraege: KompaktEreignis[] = [];
  let zuletzt: boolean | null = null;
  const merke = (art: string): void => {
    const t = new Date(jetzt()).toISOString();
    const letzter = eintraege[eintraege.length - 1];
    if (letzter && letzter.art === art) {
      letzter.n++;
      letzter.t = t;
      return;
    }
    eintraege.push({ t, art, n: 1 });
    while (eintraege.length > max) eintraege.shift();
  };
  return {
    merke,
    beobachte(w) {
      if (!w || w.isDestroyed()) return;
      const oben = w.isAlwaysOnTop();
      if (oben === zuletzt) return;
      zuletzt = oben;
      merke("oben:" + (oben ? "true" : "false"));
    },
    liste: () => eintraege.map((e) => ({ ...e })),
  };
}

/* The words of the actions the compact window may be asked (window.ts, KOMPAKT_AKTIONEN). */
const KOMPAKT_ARTEN = ["kompakt", "close", "resize", "pin", "seethrough", "clickthrough"];

/** What a POST /api/win asked of the compact window, as one fixed word for the
    ring ("win:pin:an"), or null when it is meant for another window or asks
    something the compact window does not take. Nothing else of the request is kept. */
export function kompaktAnfrage(sent: { do?: unknown; win?: unknown; on?: unknown }): string | null {
  if (sent.win !== "kompakt") return null;
  const art = KOMPAKT_ARTEN.find((a) => a === sent.do);
  if (!art) return null;
  return "win:" + art + (art === "pin" ? (sent.on ? ":an" : ":aus") : "");
}

/** The place report and the ring in one (GET /api/state, the bug report). */
export function kompaktBericht(w: KompaktMesswerte | null, puffer: KompaktPuffer): KompaktLage & { ereignisse: KompaktEreignis[] } {
  return { ...kompaktLage(w), ereignisse: puffer.liste() };
}

export interface Rect { x: number; y: number; width: number; height: number }
/** A strip lifted off the bottom edge: where it stood (von) and where it was put (nach). */
export interface Lift { von: number; nach: number }

/*
 * Where the compact strip stands after it was sized (#298). `b` are its outer
 * bounds after sizing, `wa` its monitor's work area. A strip that now runs
 * past the bottom is lifted by as much (never above the work area's top), and
 * the spot it stood on is kept; when it shrinks again and still stands where
 * it was put, it goes back as far as it fits. A strip the player moved in
 * between (y is no longer `nach`) stays where it is, nothing jumps back.
 */
export function streifenLage(b: Rect, wa: Rect, lift: Lift | null): { y: number; lift: Lift | null } {
  const wunsch = lift && b.y === lift.nach ? lift.von : b.y;
  const y = Math.max(wa.y, Math.min(wunsch, wa.y + wa.height - b.height));
  return { y, lift: y < wunsch ? { von: wunsch, nach: y } : null };
}

/**
 * The compact window's floor (#348): the smallest content size the strip is
 * still readable at, as the page measured it - its bar with all buttons for
 * the width, the head, one row and the "more" button for the height. The
 * page only names numbers; this decides what becomes of them. The floor is
 * never above the strip itself (the window must be able to be that size), nor
 * above the work area, and never below the window's own floor (180 x 24). Not
 * a number pair, null: the window then keeps the floor it had.
 */
export function kompaktMinimum(min: unknown, w: number, h: number, wa: { width: number; height: number }): { w: number; h: number } | null {
  if (!min || typeof min !== "object") return null;
  const m = min as { w?: unknown; h?: unknown };
  if (typeof m.w !== "number" || typeof m.h !== "number" || !isFinite(m.w) || !isFinite(m.h) || m.w <= 0 || m.h <= 0) return null;
  return {
    w: Math.max(180, Math.min(Math.floor(m.w), w, wa.width)),
    h: Math.max(24, Math.min(Math.floor(m.h), h, wa.height)),
  };
}

/* The native menu on a table row (spec Windows-Teil 2): the page names a kind
   from this list, never what the menu says. */
export const MENUE_ARTEN = ["zeile"] as const;
export type MenueArt = (typeof MENUE_ARTEN)[number];
export function menueArt(v: unknown): MenueArt | null {
  return MENUE_ARTEN.find((a) => a === v) ?? null;
}

/* The only items the menu can have; each one is an id and a word from TEXTE. */
export const MENUE_PUNKTE = ["kopieren", "rotation"] as const;
export type MenuePunkt = (typeof MENUE_PUNKTE)[number];
const MENUE_WORT: Record<MenuePunkt, TextKey> = { kopieren: "menueKopieren", rotation: "menueRotation" };
export function menuePunkte(lang: unknown): { id: MenuePunkt; label: string }[] {
  return MENUE_PUNKTE.map((id) => ({ id, label: wort(lang, MENUE_WORT[id]) }));
}

/* The areas that can be torn off into a window of their own. */
export const ABRISS_TEILE = ["kampf", "rotation", "analyse", "vergleich"] as const;
export type AbrissTeil = (typeof ABRISS_TEILE)[number];
export function abrissTeil(v: unknown): AbrissTeil | null {
  return ABRISS_TEILE.find((t) => t === v) ?? null;
}

/*
 * What a window may do by hand, per view (#364, decided 31.10.2026). One
 * BrowserWindow carries full view and the shrunk compact strip, so the same
 * window switches between the two sets and back:
 *  - voll: a size from the size setting (VOLL_W x VOLL_H times it, lage.ts). It cannot be dragged
 *    bigger or smaller, nor maximised (title bar button, double click on the
 *    title bar, Win+arrow). Smaller or bigger is the size setting; the window follows it (#372).
 *  - kompakt: dragged by hand down to the strip's floor (180 x 24), never
 *    maximised.
 *  - abriss: the torn-off window is a window like any other, dragged and
 *    maximised.
 * Anything else reads as full view, the strictest set.
 */
export const ANSICHTEN = ["voll", "kompakt", "abriss"] as const;
export type Ansicht = (typeof ANSICHTEN)[number];
export interface FensterOptionen {
  resizable: boolean;
  maximizable: boolean;
  fullscreenable: boolean;
  minWidth: number;
  minHeight: number;
}
export function fensterOptionen(ansicht: unknown): FensterOptionen {
  if (ansicht === "kompakt") return { resizable: true, maximizable: false, fullscreenable: false, minWidth: 180, minHeight: 24 };
  if (ansicht === "abriss") return { resizable: true, maximizable: true, fullscreenable: true, minWidth: 320, minHeight: 240 };
  return { resizable: false, maximizable: false, fullscreenable: false, minWidth: 180, minHeight: 24 };
}
