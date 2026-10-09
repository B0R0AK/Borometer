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
