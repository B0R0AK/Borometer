// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The taskbar: a gold dot on the icon while live logging runs, and two
 * buttons in the window's preview - Compact and Live logging, both on/off
 * switches like the page's own. A click is passed to the page as an event
 * (events.ts), and the page does exactly what its own button does: Compact
 * opens or closes the compact window where there is one (spec Nachtraege
 * N4), which has no taskbar button of its own.
 * The tray menu (#56) opens it the same way: bump("compact"), nothing else.
 * The only file that touches the taskbar.
 */

import { BrowserWindow, nativeImage } from "electron";
import * as path from "node:path";
import { bump } from "./events";
import { fortschritt } from "./windows-core";

/*
 * createFromPath picks up name@2x.png beside name.png by itself and adds it
 * as the 2x representation; adding it again by hand gave every image the
 * same scale twice.
 */
function icon(dir: string, name: string): Electron.NativeImage {
  return nativeImage.createFromPath(path.join(dir, "taskbar", `${name}.png`));
}

let dot: Electron.NativeImage | null = null;
let thumbs: { compact: Electron.NativeImage; live: Electron.NativeImage } | null = null;
/** whether the dot is meant to show, so a new taskbar can get it back */
let liveOn = false;

/*
 * Safe to call again and again: the images are read once, and setting the
 * same two buttons replaces them rather than adding more. main.ts calls it
 * whenever the window gains focus, see there.
 */
export function setupTaskbar(win: BrowserWindow, resourcesDir: string): void {
  if (process.platform !== "win32") return;
  dot ??= icon(resourcesDir, "live-dot");
  thumbs ??= { compact: icon(resourcesDir, "thumb-compact"), live: icon(resourcesDir, "thumb-live") };
  win.setThumbarButtons([
    { tooltip: "Kompakt / Compact", icon: thumbs.compact, click: () => bump("compact") },
    { tooltip: "Live-Aufzeichnung ein/aus / Live logging on/off", icon: thumbs.live, click: () => bump("live") },
  ]);
  // a new taskbar (Explorer restarted) lost the dot along with the buttons
  if (liveOn) setLiveBadge(win, true);
}

export function setLiveBadge(win: BrowserWindow, on: boolean): void {
  if (process.platform !== "win32" || !dot) return;
  liveOn = on;
  win.setOverlayIcon(on ? dot : null, on ? "Live-Aufzeichnung läuft / Live logging on" : "");
}

/** whether live logging runs, as the dot shows it (the tray's tick) */
export function liveAn(): boolean {
  return liveOn;
}

/*
 * Reading a long log (spec Windows-Einbindung 6): server.ts hands over
 * where each piece ended. The bar shows only while more than one piece is
 * needed, and goes away with the last one - or 5 s after a piece, when the
 * page stopped asking.
 */
const balken = { an: false, timer: null as ReturnType<typeof setTimeout> | null };
export function leseFortschritt(win: BrowserWindow | null, to: number, size: number): void {
  if (process.platform !== "win32" || !win) return;
  const wert = fortschritt(to, size, balken.an);
  if (wert === null) return;
  win.setProgressBar(wert);
  balken.an = wert >= 0;
  if (balken.timer) clearTimeout(balken.timer);
  balken.timer = balken.an ? setTimeout(() => {
    balken.an = false;
    if (!win.isDestroyed()) win.setProgressBar(-1);
  }, 5000) : null;
}
