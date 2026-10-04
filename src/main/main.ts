// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
// more details. You should have received a copy of the License along with
// this program. If not, see <https://www.gnu.org/licenses/>.

/*
 * Borometer - the Electron main process.
 *
 * Serves the app on 127.0.0.1 and hands it the newest TLCombatLog file from
 * your log folder, so fights appear on their own.
 *
 * It only reads files Throne and Liberty writes. It never touches the game
 * process, and nothing leaves your machine except party reports you choose to
 * send, a Questlog plan you ask for, and - only when turned on - the one
 * question to GitHub for a newer version at start (update.ts): the app's own
 * server binds to localhost only.
 */

import { app, dialog, Menu } from "electron";
import * as path from "node:path";
import { APP_NAME, SETTINGS_DIR, INSTALLED } from "./paths";
import { CONFIG_MIGRATED, CONFIG_PATH, loadConfig } from "./config";
import { logDir, setUpdate, startServer } from "./server";
import { checkUpdate } from "./update";
import { HOTKEY, registerHotkey, unregisterHotkey } from "./hotkey";
import { setupTaskbar } from "./taskbar";
import { createWindow, currentWindow, iconFile } from "./window";

/*
 * Chromium's own profile (localStorage, caches) in a folder of its own inside
 * the settings folder, not spread over it. localStorage has to survive a
 * restart: the language chosen in the app lives there.
 */
app.setPath("userData", path.join(SETTINGS_DIR, "electron"));
app.setName(APP_NAME);
// Windows groups the taskbar button and notifications by this id
app.setAppUserModelId("de.boro.borometer");

/** Where the built page and icons sit: in resources/ once packaged. */
function resourcesDir(): string {
  return app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), "build");
}

function pagePath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "renderer", "index.html")
    : path.join(app.getAppPath(), "dist", "renderer", "index.html");
}

async function main(): Promise<void> {
  await app.whenReady();
  // Test-only: widens the gap between acquiring the single-instance lock and
  // creating the window, so scripts/test-einzel.mjs can deterministically
  // hit the case where second-instance fires before the window exists,
  // instead of depending on real-world timing. Unset outside that test, so
  // this never delays a real start.
  // clamp to 10s so a stray or malicious value cannot stall a real start
  const testDelay = Math.min(Number(process.env.BOROMETER_TEST_STARTUP_DELAY_MS ?? 0), 10_000);
  if (testDelay > 0) await new Promise<void>((resolve) => setTimeout(resolve, testDelay));
  // no menu bar: Windows draws the frame and its buttons over the page's
  // own header, which is the title bar (window.ts)
  Menu.setApplicationMenu(null);

  const port = await startServer(pagePath());
  const url = `http://127.0.0.1:${port}/`;
  console.log(`${APP_NAME} is running at ${url}`);
  console.log(`Log folder: ${logDir() || "not found - set it from the app"}`);
  console.log(`Settings:   ${CONFIG_PATH}${CONFIG_MIGRATED ? "  (brought over from beside the exe)" : ""}`);
  console.log(`Install:    ${app.isPackaged ? (INSTALLED ? "installed" : "portable") : "development"}`);
  // the update notice (spec Update-Hinweis): once per start, only when the
  // player turned it on - strictly true, anything else is off. Never throws;
  // what it finds waits in server.ts for GET /api/state (safety audit 14)
  if (loadConfig().updatePruefen === true) void checkUpdate(app.getVersion()).then(setUpdate);

  // The app's own window gets a marked url so the page can tell itself apart
  // from a browser tab. Only the query differs; the page is served the same.
  const winUrl = `${url}?win=1`;
  const icon = iconFile(resourcesDir());
  // the preview's two buttons and the live dot (taskbar.ts); set again once
  // the window shows, because Windows only takes thumbar buttons from a
  // window that already has its taskbar button. "show", not ready-to-show:
  // the latter never fires for this window (see createWindow).
  // And again on every focus: when Explorer restarts (a crash, an update),
  // Windows builds a new taskbar and the buttons and the dot are gone.
  // Electron raises no event for that, and the TaskbarCreated message
  // Windows sends is registered at run time - looking it up takes native
  // code, which the safety audit rules out. Focus is the cheap stand-in:
  // whoever wants the buttons back has been in the window since, and
  // setting the same buttons again is idempotent (see setupTaskbar).
  const withTaskbar = (): void => {
    const w = currentWindow();
    if (!w) return;
    setupTaskbar(w, resourcesDir());
    w.once("show", () => setupTaskbar(w, resourcesDir()));
    w.on("focus", () => setupTaskbar(w, resourcesDir()));
  };
  const win = createWindow(winUrl, icon);
  if (pendingFocus) {
    // a second start already arrived while this one was still here in
    // main(), before the window existed (see the second-instance handler
    // below); bring it forward the moment it actually shows itself, the
    // same moment reveal() in window.ts does
    pendingFocus = false;
    win.once("show", () => win.focus());
  }
  withTaskbar();

  // one global combination for compact's click-through (hotkey.ts); if
  // another program holds it, the page says so instead of going quiet
  const held = registerHotkey();
  console.log(`Hotkey:     ${HOTKEY}${held ? "" : "  (taken by another program)"}`);
  app.on("will-quit", unregisterHotkey);

  // macOS keeps apps alive without windows; bring one back from the dock
  app.on("activate", () => {
    if (!currentWindow()) {
      createWindow(winUrl, icon);
      withTaskbar();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/**
 * Set when second-instance fires before the window exists yet - it can,
 * because main() awaits startServer, which may try up to 41 ports before it
 * has one. main() checks this right after createWindow() and brings the new
 * window forward instead of silently doing nothing.
 */
let pendingFocus = false;

/*
 * One Borometer at a time (Live Performance specification 4). A second
 * start used to be a second app - half a gigabyte more, its own port, its
 * own localStorage, and both writing the same settings. Now the second
 * start ends, and the existing window comes forward: out of the taskbar if
 * it was minimized, and compact, as it is. The lock is per settings folder
 * (userData, set above).
 */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const w = currentWindow();
    if (!w) {
      pendingFocus = true;
      return;
    }
    if (w.isMinimized()) w.restore();
    w.show();
    w.focus();
  });
  main().catch((err: unknown) => {
    console.error(err);
    dialog.showErrorBox(APP_NAME, err instanceof Error ? err.message : String(err));
    app.exit(1);
  });
}
