// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The one global hotkey: Ctrl+Shift+D switches compact's click-through, so
 * the overlay can be made to let the mouse through to the game and taken back
 * without touching it. Where compact is a window of its own (spec
 * Nachtraege N4), the strip's page switches it, and from full view the
 * same press opens the strip, click-through at once.
 *
 * globalShortcut is RegisterHotKey on Windows. The app tells Windows about
 * this one combination and Windows tells the app when it is pressed - about
 * no other key, and without the app ever reading the keyboard. That is the
 * difference to a keyboard hook, which sees every key and which the safety
 * audit keeps forbidden. The audit also holds this file to one register()
 * call with the combination below written out as a constant.
 *
 * The page has no bridge into this process, so it learns of a press by
 * asking: GET /api/events waits until the hotkey's count (events.ts) passes
 * what the page has already seen (see server.ts).
 */

import { globalShortcut } from "electron";
import { bump } from "./events";

export const HOTKEY = "CommandOrControl+Shift+D";

const STATE = { registered: false };

/** Registers the hotkey. False when another program already holds it. */
export function registerHotkey(): boolean {
  STATE.registered = globalShortcut.register(HOTKEY, () => {
    bump("hotkey");
  });
  return STATE.registered;
}

export function unregisterHotkey(): void {
  if (STATE.registered) globalShortcut.unregister(HOTKEY);
  STATE.registered = false;
}

export function hotkeyState(): { key: string; registered: boolean } {
  return { key: HOTKEY, registered: STATE.registered };
}
