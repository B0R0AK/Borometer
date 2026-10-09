// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The app's own server. It serves the page and the /api routes the page
 * talks to, bound to 127.0.0.1 only - nothing on the network can reach it.
 * The routes and their answers are the ones the Python launcher had, so the
 * page works unchanged against either.
 */

import { shell } from "electron";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { loadBest, putBest } from "./best";
import { CONFIG_MIGRATED, CONFIG_PATH, configString, loadConfig, updateConfig } from "./config";
import { bareHost, errorName, fetchJson, HttpError, listenFrom, readJson, send, type Json } from "./http";
import { eventCounts, onEvent, type EventName } from "./events";
import { hotkeyState } from "./hotkey";
import { guessLogDir, latestAnswer, listLogs, logAnswer, newestLog, readLog } from "./logs";
import { isFirstStart } from "./firststart";
import {
  askRename, buildBoard, KICK_PAUSE, lanAddress, makeCode, PARTY, publicPort, pushOnce, pushToHost,
  record, resetParty, startMemberLoop, startPublic, stopMemberLoop, stopPublic, type Payload,
} from "./party";
import { bugReportsDir, FOLDERS, partyLogsDir, safeSaveName, savesDir } from "./paths";
import { erinnerungAbfrage, erinnerungAntwort, erinnerungQuelle } from "./erinnerung";
import { createWeeklies, loadWeeklies, putWeeklies } from "./weeklies";
import { createGilde, loadGilde, putGilde } from "./gilde";
import { leseFortschritt } from "./taskbar";
import { startAuftrag } from "./start";
import { autostartAn, autostartDa } from "./autostart";
import { jumpListBauen } from "./jumplist";
import { zuletztNeu } from "./windows-core";
import { acrylicNow, currentWindow, kompaktMoeglich, kompaktStand, micaGrund, micaNow, themeChanged, winAction, windowPlaced } from "./window";

export const FIRST_PORT = 8731;

const STATE = {
  dir: configString("log_dir") || guessLogDir(),
  port: 0,
  pagePath: "",
};

const JSON_TYPE = "application/json";

/*
 * The update notice (update.ts, spec Update-Hinweis): what the one check at
 * start found - a newer version and its release page, or null. Set once, by
 * main.ts, and only read here: GET /api/state hands it to the page and never
 * asks anything itself.
 */
let UPDATE: { version: string; url: string } | null = null;
export function setUpdate(found: { version: string; url: string } | null): void {
  UPDATE = found;
}

function reply(res: http.ServerResponse, obj: unknown, code = 200): void {
  send(res, JSON.stringify(obj), JSON_TYPE, code, { "Cache-Control": "no-store" });
}

function text(res: http.ServerResponse, body: string, code = 200, type = "text/plain; charset=utf-8"): void {
  send(res, body, type, code, { "Cache-Control": "no-store" });
}

/*
 * The page learns its theme from /api/config and stands on "dark" until then.
 * The frame already knows the colour, so the same value goes into the <html>
 * tag the browser reads before anything else, and the first paint is right.
 * Only checked for being harmless as an attribute: lowercase, at most twelve.
 */
const PAGE_HTML_TAG = '<html lang="en">';

function pageWithTheme(page: string): string {
  const resolved = String(loadConfig().themeResolved ?? "");
  if (!resolved || resolved.length > 12 || !/^[a-z]+$/.test(resolved)) return page;
  return page.replace(PAGE_HTML_TAG, `<html lang="en" data-theme="${resolved}">`);
}

function listJson(folder: string): { folder: string; files: { name: string; size: number; mtime: number }[] } {
  const files: { name: string; size: number; mtime: number }[] = [];
  try {
    for (const name of fs.readdirSync(folder)) {
      if (!name.toLowerCase().endsWith(".json")) continue;
      const stat = fs.statSync(path.join(folder, name));
      if (!stat.isFile()) continue;
      files.push({ name, size: stat.size, mtime: Math.floor(stat.mtimeMs / 1000) });
    }
  } catch {
    // a folder that is not there yet lists as empty, which is the true answer
  }
  files.sort((a, b) => b.mtime - a.mtime);
  return { folder, files };
}

function loadJsonFile(res: http.ServerResponse, folder: string, wanted: string | null): void {
  try {
    let body = fs.readFileSync(path.join(folder, safeSaveName(wanted)), "utf8");
    // these files get passed around and edited; accept a byte-order mark
    if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
    text(res, body, 200, JSON_TYPE);
  } catch {
    reply(res, { ok: false, error: "not found" }, 404);
  }
}

function saveJsonFile(res: http.ServerResponse, sent: Json, dir: (create?: boolean) => string): void {
  const name = safeSaveName(sent.name);
  const payload = sent.data;
  if (payload === undefined || payload === null) {
    reply(res, { ok: false, error: "nothing to save" }, 400);
    return;
  }
  const target = path.join(dir(true), name);
  try {
    fs.writeFileSync(target, JSON.stringify(payload, null, 1), "utf8");
  } catch (err) {
    reply(res, { ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    return;
  }
  reply(res, { ok: true, name, folder: dir() });
}

// ------------------------------------------------------------------ GET
async function handleGet(url: URL, res: http.ServerResponse): Promise<void> {
  const q = url.searchParams;
  switch (url.pathname) {
    case "/":
    case "/index.html": {
      let page: string;
      try {
        page = fs.readFileSync(STATE.pagePath, "utf8");
      } catch {
        text(res, "index.html is missing from this build.", 500);
        return;
      }
      text(res, pageWithTheme(page), 200, "text/html; charset=utf-8");
      return;
    }

    case "/api/state": {
      const found = newestLog(STATE.dir);
      reply(res, {
        dir: STATE.dir,
        settings: CONFIG_PATH,
        settingsMoved: CONFIG_MIGRATED,
        file: found?.name ?? "",
        size: found?.size ?? 0,
        mtime: found?.mtime ?? 0,
        // the app's own window wears the native frame; the page stops drawing
        // its own buttons, grips and corners
        nativeFrame: currentWindow() !== null,
        // whether compact can sit on Acrylic here (Windows 11 22H2 and later,
        // "Transparency effects" on)
        material: currentWindow() !== null && acrylicNow(),
        // full view on its glass ground, Acrylic since #189 (theme smoked glass, spec Rauchglas 3.3), and why
        // not where it cannot be - only in the app's own window
        mica: currentWindow() !== null && micaNow(),
        micaGrund: currentWindow() !== null ? micaGrund() : null,
        // the WebView2 black-window failure of the Python build; Electron
        // brings its own Chromium, so there is no such fallback any more
        windowBlank: false,
        stayOnTop: !!loadConfig().stayOnTop,
        // compact as a window of its own (spec Nachtraege N4): whether it can
        // be one here, whether it is open, and how it was opened (live
        // logging ran in full view, the hotkey asked for it)
        kompaktFenster: kompaktMoeglich(),
        kompakt: kompaktStand(),
        // an order from the jump list until the page has done it (start.ts)
        start: startAuftrag(),
        // a newer release, if the one check at start found one (update.ts)
        update: UPDATE,
      });
      return;
    }

    case "/api/events": {
      /*
       * The page's ear for what happens outside it: the global hotkey, the
       * taskbar buttons and a resize by the window's border (events.ts). It sends the counts it has already
       * acted on; a newer count comes back at once, otherwise the request
       * waits for the next event or 25 seconds and the page asks again.
       * ?now=1 answers at once, for the state alone.
       */
      let seen: Partial<Record<EventName, number>> = {};
      try { seen = JSON.parse(q.get("seen") || "{}"); } catch { seen = {}; }
      const answer = () => ({ ok: true, ...hotkeyState(), counts: eventCounts() });
      const moved = (): boolean => {
        const now = eventCounts();
        return (Object.keys(now) as EventName[]).some((k) => now[k] > (Number(seen?.[k]) || 0));
      };
      if (q.get("now") || moved()) return reply(res, answer());
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        stop();
        if (!res.writableEnded) reply(res, answer());
      };
      const stop = onEvent(finish);
      const timer = setTimeout(finish, 25_000);
      // the page reloaded or the app is closing: forget this request
      res.on("close", () => { done = true; clearTimeout(timer); stop(); });
      return;
    }

    case "/api/latest": {
      const found = newestLog(STATE.dir);
      if (!found) return text(res, "", 404);
      try {
        // with from, only the new end as JSON (Live-Leistung specification 3), instead of the whole file as before
        if (q.has("from")) {
          const { status, body } = latestAnswer(found, q.get("file"), q.get("from"));
          if (status === 200 && "to" in body) leseFortschritt(currentWindow(), body.to, body.size);
          return reply(res, body, status);
        }
        text(res, readLog(found));
      } catch {
        text(res, "", 500);
      }
      return;
    }

    case "/api/logs": {
      // the log files of the watched folder, newest first, at most 60
      // (logs.ts, listLogs; spec Nachtraege N3) - names, sizes and times only
      const files = listLogs(STATE.dir).map((f) => ({ name: f.name, size: f.size, mtime: f.mtime }));
      return reply(res, { ok: true, files });
    }

    case "/api/log": {
      // an older log in pieces (logs.ts, logAnswer): the name is only
      // compared with a fresh listing of the watched folder, never opened
      try {
        const { status, body } = logAnswer(STATE.dir, q.get("name"), q.get("from"));
        if (status === 200 && "to" in body) leseFortschritt(currentWindow(), body.to, body.size);
        return reply(res, body, status);
      } catch {
        return text(res, "", 500);
      }
    }

    case "/api/config": {
      const cfg = loadConfig();
      reply(res, {
        weaponOf: cfg.weaponOf ?? {},
        weaponById: cfg.weaponById ?? {},
        mainWeapon: cfg.mainWeapon ?? "",
        offWeapon: cfg.offWeapon ?? "",
        // weapon pairs set by hand, per character
        weaponPick: cfg.weaponPick ?? {},
        runs: cfg.runs ?? [],
        // null rather than a default: the page only overrides its own
        // starting values when a real choice was saved
        gap: cfg.gap ?? null,
        minDur: cfg.minDur ?? null,
        ghost: cfg.ghost ?? null,
        uiZoom: cfg.uiZoom ?? null,
        // skill names learned from mixed-language parties
        skillNames: cfg.skillNames ?? {},
        // the history index, so a start does not re-read the whole log folder
        logIndex: cfg.logIndex ?? {},
        theme: cfg.theme ?? null,
        // the one-time note on borderless mode was acknowledged (Fenster-Extras 3.5)
        randlosGesehen: cfg.randlosGesehen === true,
        // the page's language for the main process's texts, only "de" or "en" (spec Windows-Einbindung 8)
        lang: cfg.lang === "de" || cfg.lang === "en" ? cfg.lang : null,
        // the first-start tour was finished or skipped (spec Rundgang 02.10.2026, 6)
        rundgangGesehen: cfg.rundgangGesehen === true,
        // the settings held nothing a person set when this process started (firststart.ts)
        firstStart: FIRST_START,
        // the update notice: off unless turned on (spec Update-Hinweis 2.4)
        updatePruefen: cfg.updatePruefen === true,
        // the Windows integration (spec Windows-Einbindung 9): off unless turned on
        meldenKampf: cfg.meldenKampf === true,
        meldenNurBest: cfg.meldenNurBest === true,
        trayBeimSchliessen: cfg.trayBeimSchliessen === true,
        windows: { da: currentWindow() !== null && process.platform === "win32", autostartDa: autostartDa(), autostart: autostartAn() },
        // the window opened at its remembered place: the page does not size it
        // from the default again at startup (Fenster-Extras, addendum 4)
        windowPlaced: windowPlaced(),
      });
      return;
    }

    case "/api/runs/list":
      return reply(res, listJson(savesDir()));
    case "/api/runs/load":
      return loadJsonFile(res, savesDir(), q.get("name"));
    case "/api/best": {
      // the best pull per boss and dummy length (best.ts); a GET only reads.
      // A file that is there but unreadable answers 503, never an empty
      // store: the page writes nothing until one read has succeeded.
      const best = loadBest();
      return best ? reply(res, { ok: true, best }) : reply(res, { ok: false }, 503);
    }
    case "/api/weeklies": {
      // the weeklies (weeklies.ts); a GET only reads, 503 when the file is there but unreadable
      const weeklies = loadWeeklies();
      return weeklies ? reply(res, { ok: true, data: weeklies }) : reply(res, { ok: false }, 503);
    }
    case "/api/erinnerung":
      // open reminder requests and the next times (erinnerung.ts); reads the weeklies' file, answers 127.0.0.1 only
      return reply(res, { ok: true, ...erinnerungAbfrage() });

    case "/api/gilde": {
      // the guild (gilde.ts); a GET only reads, 503 when the file is there but unreadable
      const gilde = loadGilde();
      return gilde ? reply(res, { ok: true, data: gilde }) : reply(res, { ok: false }, 503);
    }
    case "/api/party-log/list":
      return reply(res, listJson(partyLogsDir()));
    case "/api/party-log/load":
      return loadJsonFile(res, partyLogsDir(), q.get("name"));

    case "/api/party/server":
      return reply(res, { server: configString("partyServer") });

    case "/api/party/state": {
      const { role, code, name, host, remote } = PARTY;
      let board: unknown[] = [...PARTY.board];
      let target = PARTY.target;
      let address = host;
      let join = "";
      if (role === "host" && !remote) {
        ({ board, target } = buildBoard());
        address = `${await lanAddress()}:${publicPort()}`;
        join = `${code}@${address}`;
      } else if (role === "host" && remote) {
        // the room lives on the shared server, which everyone already points
        // at - the code alone is enough to share
        join = code;
      }
      reply(res, { role, code, name, address, join, remote, board, target, error: PARTY.error });
      return;
    }
  }
  text(res, "Not here.", 404);
}

// ------------------------------------------------------------------ POST
/*
 * The keys the page may write to the settings file. "splitAfter" replaced
 * "gap"; "gap" stays readable for old files. theme is the setting,
 * themeResolved what "auto" came out as, which the frame is painted from.
 */
const CONFIG_KEYS = [
  "weaponOf", "weaponById", "mainWeapon", "offWeapon", "weaponPick", "runs",
  "splitAfter", "gap", "minDur", "ghost", "uiZoom", "devMode",
  "skillNames", "ventiusTop", "compactAlpha", "mergePhases",
  "theme", "themeResolved", "logIndex", "randlosGesehen", "rundgangGesehen", "updatePruefen",
  "meldenKampf", "meldenNurBest", "trayBeimSchliessen", "lang", "gildeErinnerung",
];
/* Of those, the ones that hold a true/false and nothing else - every key
   that ends in "Gesehen" (a note or tour acknowledged) is one, and so is
   updatePruefen, the switch of the update notice (spec Update-Hinweis 2.4). "fenster"
   (where the window was) is not among the keys at all: only window.ts
   writes it (spec Fenster-Extras 4). */
const BOOLEAN_KEYS = ["randlosGesehen", "rundgangGesehen", "updatePruefen", "meldenKampf", "meldenNurBest", "trayBeimSchliessen", "gildeErinnerung"];
/* A first start (spec Rundgang 2, review M6): when this process started, the
   settings held none of the keys a person sets - the page's keys but the
   resolved theme and the tour's own flag, the log folder, the party server,
   staying on top. Read once, before anything is written: a tour left
   half-way comes back on the next start only while nothing was chosen. */
const FIRST_START = isFirstStart(loadConfig(),
  [...CONFIG_KEYS.filter((k) => k !== "themeResolved" && k !== "rundgangGesehen" && k !== "lang"), "log_dir", "partyServer", "stayOnTop"]);

async function handlePost(url: URL, sent: Json, res: http.ServerResponse): Promise<void> {
  switch (url.pathname) {
    case "/api/win": {
      const { status, body } = winAction(sent);
      return reply(res, body, status);
    }
    case "/api/gelesen": {
      // The page reports a log it read whole from the start (spec
      // Windows-Einbindung 5). Only the name of a listed log is kept, for
      // the jump list: it is compared with a fresh listing, never opened.
      const name = String(sent.name ?? "");
      const entry = listLogs(STATE.dir).find((f) => f.name === name);
      if (!entry) return reply(res, { ok: false }, 404);
      updateConfig({ zuletztGelesen: zuletztNeu(loadConfig().zuletztGelesen, entry.name) });
      jumpListBauen();
      return reply(res, { ok: true });
    }
    case "/api/runs/save":
      return saveJsonFile(res, sent, savesDir);
    case "/api/bug/save":
      return saveJsonFile(res, sent, bugReportsDir);
    case "/api/party-log/save":
      return saveJsonFile(res, sent, partyLogsDir);

    case "/api/folder/open": {
      // The page sends a key, never a path, and only four keys exist: the
      // app's three own folders (FOLDERS, made if missing) and "game", the
      // watched combat log folder. That one is opened as it is - only while
      // it is a folder, never made, never written (spec Nachtraege N1).
      // openPath hands the folder to the file manager; audit 5c pins this.
      const key = String(sent.folder ?? "");
      const make = Object.hasOwn(FOLDERS, key) ? FOLDERS[key] : undefined;
      let folder = "";
      if (key === "game") {
        let isDir = false;
        try {
          isDir = !!STATE.dir && fs.statSync(STATE.dir).isDirectory();
        } catch {
          isDir = false;
        }
        if (!isDir) return reply(res, { ok: false }, 404);
        folder = STATE.dir;
      } else if (make) {
        folder = make(true);
      } else {
        return reply(res, { ok: false, error: "unknown folder" }, 400);
      }
      const error = await shell.openPath(folder);
      if (error) return reply(res, { ok: false, folder, error }, 500);
      return reply(res, { ok: true, folder });
    }

    case "/api/party/host": {
      const name = String(sent.name ?? "").trim().slice(0, 40) || "Host";
      const port = await startPublic(STATE.port);
      if (!port) return reply(res, { ok: false, error: "no free port for the party" });
      stopMemberLoop();
      resetParty({ role: "host", code: makeCode(), name, remote: false });
      const address = `${await lanAddress()}:${port}`;
      return reply(res, { ok: true, code: PARTY.code, address, join: `${PARTY.code}@${address}` });
    }

    case "/api/party/server": {
      const server = bareHost(sent.server);
      updateConfig({ partyServer: server });
      return reply(res, { ok: true, server });
    }

    case "/api/party/create": {
      // a room on the shared party server instead of this machine: reachable
      // through one fixed address whether or not the creator's PC is still on
      const name = String(sent.name ?? "").trim().slice(0, 40) || "Host";
      const server = bareHost(String(sent.server ?? "").trim() || configString("partyServer"));
      if (!server) return reply(res, { ok: false, error: "no party server is set" });
      let code: string;
      try {
        const answer = await fetchJson(`http://${server}/party/create`, 8000, { name });
        if (!answer.ok || typeof answer.code !== "string") throw new Error("refused");
        code = answer.code;
      } catch {
        return reply(res, { ok: false, error: "could not reach the party server" });
      }
      await stopPublic(); // never run a local public listener at the same time
      updateConfig({ partyServer: server });
      resetParty({ role: "host", code, name, host: server, remote: true });
      startMemberLoop();
      return reply(res, { ok: true, code, address: server, join: code });
    }

    case "/api/party/join": {
      const name = String(sent.name ?? "").trim().slice(0, 40) || "Guest";
      const raw = String(sent.join ?? "").trim();
      let code = String(sent.code ?? "").trim().toUpperCase();
      let host = String(sent.host ?? "").trim();
      if (raw.includes("@")) {
        // one pasted string: CODE@ip:port
        const at = raw.indexOf("@");
        code = raw.slice(0, at).trim().toUpperCase();
        host = bareHost(raw.slice(at + 1));
        if (!host.includes(":")) host += `:${FIRST_PORT + 1}`;
      } else {
        // a bare code means the shared party server everyone points at
        if (raw) code = raw.toUpperCase();
        host = bareHost(configString("partyServer"));
      }
      if (code.length !== 4 || !host) {
        return reply(res, { ok: false, error: "that does not look like a party code, or no party server is set" });
      }
      try {
        const answer = await fetchJson(
          `http://${host}/party/ping?code=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`,
          6000,
        );
        if (!answer.ok) throw new Error("refused");
      } catch (err) {
        return reply(res, {
          ok: false,
          error: err instanceof HttpError ? "the host rejected that code" : `no answer from ${host}`,
        });
      }
      await stopPublic();
      resetParty({ role: "member", code, name, host, remote: false });
      startMemberLoop();
      return reply(res, { ok: true, code, address: host });
    }

    case "/api/party/leave": {
      stopMemberLoop();
      resetParty({ remote: false, kicked: new Map() });
      await stopPublic();
      return reply(res, { ok: true });
    }

    case "/api/party/kick": {
      // Two shapes of party, one button. Hosting here, the member list is
      // right here; on the shared server the request goes on to the server,
      // which checks that it came from whoever created the room.
      const who = String(sent.who ?? "").trim().slice(0, 40);
      const { role, name, remote, code, host } = PARTY;
      if (role !== "host" || !who) return reply(res, { ok: false, error: "only the host can do that" });
      if (who === name) return reply(res, { ok: false, error: "cannot remove yourself" });
      if (!remote) {
        PARTY.members.delete(who);
        PARTY.kicked.set(who, Date.now() / 1000 + KICK_PAUSE);
        return reply(res, { ok: true });
      }
      try {
        reply(res, await fetchJson(`http://${host}/party/kick`, 6000, { code, name, who }));
      } catch (err) {
        if (err instanceof HttpError) {
          // an old server has no such route at all, and that is worth saying
          const detail = err.status === 404
            ? "this party server is too old to remove people"
            : "the party server refused it";
          reply(res, { ok: false, error: detail });
        } else {
          reply(res, { ok: false, error: `cannot reach the party server (${errorName(err)})` });
        }
      }
      return;
    }

    case "/api/party/rename": {
      // Someone switched character. The page saw it in the log; the row moves.
      const next = String(sent.name ?? "").trim().slice(0, 40);
      const { role, name: old, remote } = PARTY;
      if (!role || !next) return reply(res, { ok: false, error: "not in a party" });
      if (next === old) return reply(res, { ok: true, changed: false });
      if (role === "host" && !remote) {
        // the member list lives on this machine; the entry moves cleanly
        const entry = PARTY.members.get(old);
        PARTY.members.delete(old);
        PARTY.name = next;
        if (entry) PARTY.members.set(next, entry);
        return reply(res, { ok: true, changed: true, clean: true });
      }
      const moved = await askRename(old, next);
      if (!moved && role === "host" && remote) {
        // The room on the shared server belongs to a NAME. Renaming without
        // the server's help leaves the room owned by nobody who still posts.
        // Better to keep the old name than to lose the room.
        return reply(res, { ok: false, error: "server too old" });
      }
      if (!moved) await pushOnce(old, null);
      PARTY.name = next;
      void pushToHost();
      return reply(res, { ok: true, changed: true, clean: moved });
    }

    case "/api/party/report": {
      const payload = (sent.payload as Payload | undefined) ?? null;
      PARTY.mine = payload;
      PARTY.weapons = sent.weapons ?? null;
      PARTY.ventius = !!sent.ventius;
      // No "and payload": a member with nothing to report says so, and a host
      // that clears its own list has to clear its own row too.
      if (PARTY.role === "host" && !PARTY.remote) record(PARTY.name, payload, PARTY.weapons, PARTY.ventius);
      if (PARTY.role === "member" || (PARTY.role === "host" && PARTY.remote)) void pushToHost();
      return reply(res, { ok: true });
    }

    case "/api/dir": {
      // Changes which folder is watched and writes it to the settings, so a
      // POST: as a GET, an <img src> on any web page could repoint it.
      const wanted = String(sent.path ?? "").replace(/^["\s]+|["\s]+$/g, "");
      let isDir = false;
      try {
        isDir = !!wanted && fs.statSync(wanted).isDirectory();
      } catch {
        isDir = false;
      }
      if (isDir) {
        STATE.dir = wanted;
        updateConfig({ log_dir: wanted });
        reply(res, { ok: true, dir: wanted });
      } else {
        reply(res, { ok: false });
      }
      return;
    }
    case "/api/party/check": {
      // ask the party server whether it is up, so the app can say so instead
      // of failing silently when someone tries to host. A POST, and only the
      // configured server: an outbound request is an action, and a GET that
      // took any address let a foreign page make this app knock on it.
      const server = bareHost(configString("partyServer"));
      if (!server) return reply(res, { ok: false, reason: "unset" });
      const started = Date.now();
      try {
        const info = await fetchJson(`http://${server}/health`, 4000);
        reply(res, { ok: !!info.ok, rooms: info.rooms ?? 0, ms: Date.now() - started, server });
      } catch (err) {
        reply(res, { ok: false, reason: "unreachable", detail: errorName(err), server });
      }
      return;
    }

    case "/api/party/curve": {
      // one member's curve, by name. Hosting here: straight out of PARTY.
      // Anywhere else, the same question goes one hop further - a request
      // out of this machine, so a POST like every other action.
      const who = String(sent.name ?? "").trim().slice(0, 40);
      if (!who || !PARTY.role) return reply(res, { ok: false, error: "no name" }, 400);
      if (PARTY.role === "host" && !PARTY.remote) {
        const mine = PARTY.members.get(who)?.payload ?? {};
        if (!mine.curve?.T) return reply(res, { ok: false, error: "no curve" }, 404);
        return reply(res, { ok: true, name: who, curve: mine.curve, casts: mine.casts });
      }
      try {
        const answer = await fetchJson(
          `http://${PARTY.host}/party/curve?code=${encodeURIComponent(PARTY.code)}&name=${encodeURIComponent(who)}`,
          6000,
        );
        reply(res, { ok: !!answer.ok, name: who, curve: answer.curve, casts: answer.casts });
      } catch (err) {
        // named, not swallowed: the page says the curve could not be fetched
        // rather than showing an empty chart under a name
        reply(res, { ok: false, error: "unreachable", detail: errorName(err) });
      }
      return;
    }

    case "/api/best": {
      // one boss at a time; best.ts checks key, size and count before writing
      const put = putBest(sent.key, sent.entry);
      // 400: refused for good, sending it again changes nothing; 503: the
      // file could not be read or written just now, the page tries again
      return reply(res, { ok: put === "saved" }, put === "saved" ? 200 : put === "refused" ? 400 : 503);
    }

    case "/api/weeklies": {
      // the whole state at once; weeklies.ts checks schema, size and count and
      // refuses a state that leaves out anything the file holds
      const put = putWeeklies(sent.data);
      return reply(res, { ok: put === "saved" }, put === "saved" ? 200 : put === "refused" ? 400 : 503);
    }

    case "/api/gilde": {
      // the whole state at once; gilde.ts checks schema, size and count and
      // refuses a state that leaves out anything the file holds
      const put = putGilde(sent.data);
      return reply(res, { ok: put === "saved" }, put === "saved" ? 200 : put === "refused" ? 400 : 503);
    }

    case "/api/erinnerung": {
      // the page's answer: an id and the number of characters with something open, nothing else is read
      const done = erinnerungAntwort(sent.id, sent.n);
      return reply(res, { ok: done }, done ? 200 : 400);
    }

    case "/api/config": {
      const changes: Json = {};
      for (const key of CONFIG_KEYS) {
        if (key in sent && (!BOOLEAN_KEYS.includes(key) || typeof sent[key] === "boolean")) changes[key] = sent[key];
      }
      if (changes.lang !== "de" && changes.lang !== "en") delete changes.lang;
      updateConfig(changes);
      if ("lang" in changes) jumpListBauen();
      // the border and Windows' menus follow a new theme (window.ts)
      if ("theme" in changes || "themeResolved" in changes) themeChanged();
      return reply(res, { ok: true });
    }
  }
  text(res, "Not here.", 404);
}

/*
 * /api is for the app's own page and nothing else. Binding to 127.0.0.1 keeps
 * the network out, but not another web page open in a browser on this
 * machine: a plain form or a text/plain fetch needs no CORS preflight, so a
 * foreign site could POST {"do":"close"} to /api/win or rewrite the config,
 * and a DNS-rebinding page could even read the answers. Three checks close
 * that:
 * - Host must name this server by its loopback name and port. A rebinding
 *   page sends its own host name here, never ours.
 * - An Origin, when the browser sends one, must be our own. Cross-site
 *   fetches and POSTs carry it; the page's own same-origin GETs need not.
 * - Sec-Fetch-Site, when sent, must say same-origin (or none: typed into
 *   the address bar). A no-cors GET - an <img src>, a script tag - carries
 *   no Origin at all, but every current browser labels it cross-site here.
 *   Anything that changes state is a POST besides (/api/dir, party/check).
 * - A POST must say application/json. A form cannot send that at all, and a
 *   fetch that does triggers a preflight, which this server never answers.
 * The page itself sends exactly this, so it notices nothing. The party
 * listener (party.ts) is a different server and is not affected.
 * Returns the status to refuse with, or 0.
 */
function apiRefusal(req: http.IncomingMessage): number {
  const port = STATE.port;
  const own = [`127.0.0.1:${port}`, `localhost:${port}`];
  const host = String(req.headers.host ?? "").toLowerCase();
  if (!own.includes(host)) return 403;
  const origin = req.headers.origin;
  if (origin !== undefined && !own.some((h) => origin.toLowerCase() === `http://${h}`)) return 403;
  const site = req.headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin" && site !== "none") return 403;
  const media = String(req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
  if (req.method === "POST" && media !== JSON_TYPE) return 415;
  return 0;
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname.startsWith("/api")) {
    const refused = apiRefusal(req);
    if (refused) return text(res, refused === 415 ? "JSON only." : "Only the app's own page may ask this.", refused);
  }
  if (req.method === "GET") return handleGet(url, res);
  if (req.method === "POST") {
    const read = await readJson(req);
    if ("error" in read) return reply(res, { ok: false }, read.error === "too-large" ? 413 : 400);
    return handlePost(url, read.body, res);
  }
  text(res, "Not here.", 405);
}

/** Starts the local server and resolves its port. */
export async function startServer(pagePath: string): Promise<number> {
  STATE.pagePath = pagePath;
  const server = http.createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      if (!res.headersSent) text(res, `Server error: ${errorName(err)}`, 500);
    });
  });
  // a dropped connection (the page reloading, the app closing) is normal
  server.on("clientError", (_err, socket) => socket.destroy());
  const port = await listenFrom(server, "127.0.0.1", FIRST_PORT, FIRST_PORT + 40);
  if (!port) throw new Error(`No free port between ${FIRST_PORT} and ${FIRST_PORT + 40}.`);
  // the reminders' schedule reads the stored reminders only through this reader (erinnerung.ts)
  erinnerungQuelle(() => loadWeeklies()?.erinnerungen ?? []);
  STATE.port = port;
  // the weeklies' file on the first start, empty with its version (weeklies.ts)
  createWeeklies();
  // the guild's file on the first start, empty with its version (gilde.ts)
  createGilde();
  return port;
}

export function logDir(): string {
  return STATE.dir;
}
