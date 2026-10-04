// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The party. One clan member hosts. Everybody else joins with the code and
 * their app pushes its latest fight to the host, which merges the reports
 * into a single board and hands it back. No outside service is involved,
 * unless the clan runs the shared party server (BoroPartyServer/).
 */

import * as dgram from "node:dgram";
import * as http from "node:http";
import * as os from "node:os";
import { errorName, fetchJson, HttpError, listenFrom, readJson, send, type Json } from "./http";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, no 1/I
const STALE_AFTER = 300; // seconds: a report older than this drops off the board
const PUSH_EVERY = 3000;
/*
 * Long enough that the removal takes and is noticed, short enough that coming
 * back is a click: removing someone is mostly how you un-stick them.
 */
export const KICK_PAUSE = 20;

/** What a member's app reports about its latest fight. Shaped by the page. */
export type Payload = Json & {
  target?: string;
  damage?: number;
  curve?: { T?: unknown } | null;
  casts?: unknown;
  skills?: unknown[];
};

interface MemberEntry {
  payload: Payload | null;
  weapons: unknown;
  ventius: boolean;
  ts: number;
}

export interface BoardRow {
  name: string;
  waiting: boolean;
  damage: number;
  dps: unknown;
  hits: unknown;
  crit: unknown;
  heavy: unknown;
  seconds: unknown;
  max: unknown;
  skills: unknown[];
  hasCurve: boolean;
  share: number;
  onTarget: boolean;
  target: string;
  lang: unknown;
  weapons: unknown;
  ventius: boolean;
  age: number;
}

export const PARTY = {
  role: null as null | "host" | "member",
  code: "",
  name: "",
  /** "ip:port" a member pushes to */
  host: "",
  /** host side: name -> latest report */
  members: new Map<string, MemberEntry>(),
  /** member side: last board the host sent back */
  board: [] as unknown[],
  target: "",
  error: "",
  /** this machine's latest report */
  mine: null as Payload | null,
  /*
   * This machine's two weapons, which outlive any one fight: a member with
   * nothing to report yet still has a build, and that is what a party wants
   * to see before the pull rather than after.
   */
  weapons: null as unknown,
  /** Eye of Ventius turns a Seeker from healer into dps; beside the weapons */
  ventius: false,
  seen: 0,
  /** true when "host" means a room on the shared party server */
  remote: false,
  /*
   * host side: name -> when they may push again. Every client re-posts every
   * three seconds, so a removal without a pause lasts until the next push.
   */
  kicked: new Map<string, number>(),
};

const now = (): number => Date.now() / 1000;

export function makeCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

/** The address other machines on the network can reach us on. */
export function lanAddress(): Promise<string> {
  return new Promise((resolve) => {
    const fallback = () => {
      for (const list of Object.values(os.networkInterfaces())) {
        for (const nic of list ?? []) {
          if (nic.family === "IPv4" && !nic.internal) return resolve(nic.address);
        }
      }
      resolve("127.0.0.1");
    };
    const probe = dgram.createSocket("udp4");
    probe.on("error", () => {
      probe.close();
      fallback();
    });
    // no packet is actually sent: connecting a UDP socket only picks the
    // interface the system would route through
    probe.connect(1, "10.255.255.255", () => {
      try {
        const { address } = probe.address();
        probe.close();
        resolve(address);
      } catch {
        probe.close();
        fallback();
      }
    });
  });
}

const num = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : 0);

/** Merge every fresh report into one ranked scoreboard. */
export function buildBoard(): { board: BoardRow[]; target: string } {
  const t = now();
  const rows = [...PARTY.members.entries()].filter(([, e]) => t - e.ts < STALE_AFTER);
  if (!rows.length) return { board: [], target: "" };
  /*
   * A member's target vote only counts once they have actually reported a
   * fight, and nobody gets dropped from the board just because their local
   * segmentation is a couple of seconds out of step with everyone else's.
   */
  const reported = (e: MemberEntry): e is MemberEntry & { payload: Payload } =>
    !!e.payload && Object.keys(e.payload).length > 0;
  const counts = new Map<string, number>();
  for (const [, e] of rows) {
    if (!reported(e)) continue;
    const target = String(e.payload.target ?? "");
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  let target = "";
  let most = 0;
  for (const [k, n] of counts) {
    if (n > most) {
      target = k;
      most = n;
    }
  }
  /*
   * Share is against everyone who is reporting, not only those on the
   * majority's target. People are rarely on the same pull at the same instant;
   * onTarget still says who is somewhere else, it no longer decides who counts.
   */
  const total = rows.reduce((sum, [, e]) => sum + (reported(e) ? num(e.payload.damage) : 0), 0) || 1;
  const board: BoardRow[] = rows.map(([name, e]) => {
    const p: Payload = e.payload ?? {};
    const has = reported(e);
    return {
      name,
      waiting: !has,
      damage: num(p.damage),
      dps: p.dps ?? 0,
      hits: p.hits ?? 0,
      crit: p.crit ?? 0,
      heavy: p.heavy ?? 0,
      seconds: p.seconds ?? 0,
      max: p.max ?? 0,
      // twelve, as many traces as the curve carries
      skills: Array.isArray(p.skills) ? p.skills.slice(0, 12) : [],
      // only whether there is a curve, never the curve itself: this board goes
      // back to every member on every push. /party/curve fetches one.
      hasCurve: !!p.curve?.T,
      share: has ? num(p.damage) / total : 0,
      onTarget: has && String(p.target ?? "") === target,
      // what this member is actually fighting
      target: String(p.target ?? ""),
      // which language their skill names are in, so a client can learn a
      // translation from the same id under two spellings
      lang: p.lang ?? "",
      // kept outside the payload so a member without a fight shows a build
      weapons: e.weapons || [],
      // relayed, never decided here
      ventius: !!e.ventius,
      age: Math.floor(t - e.ts),
    };
  });
  board.sort((a, b) => b.damage - a.damage);
  return { board, target };
}

export function record(name: string, payload: Payload | null, weapons: unknown = null, ventius: unknown = false): void {
  PARTY.members.set(name, { payload: payload ?? null, weapons: weapons ?? null, ventius: !!ventius, ts: now() });
}

export function resetParty(extra: Partial<typeof PARTY> = {}): void {
  Object.assign(PARTY, {
    role: null,
    code: "",
    name: "",
    host: "",
    members: new Map(),
    board: [],
    target: "",
    error: "",
    mine: null,
    ...extra,
  });
}

/*
 * A single push under a name that is no longer ours. Used on a character
 * switch: the old row is set to "waiting" instead of standing beside the new
 * one with the numbers from before. A failure needs no report - the row falls
 * off by itself once it is old enough.
 */
export async function pushOnce(name: string, payload: Payload | null): Promise<boolean> {
  if (!PARTY.host) return false;
  try {
    await fetchJson(`http://${PARTY.host}/party/push`, 6000, {
      code: PARTY.code, name, payload, weapons: null, ventius: false,
    });
    return true;
  } catch {
    return false;
  }
}

/*
 * Asks the shared server to move the entry instead of starting a second one.
 * A server without this route answers 404, and the caller decides what that
 * means.
 */
export async function askRename(old: string, to: string): Promise<boolean> {
  if (!PARTY.host) return false;
  try {
    const answer = await fetchJson(`http://${PARTY.host}/party/rename`, 6000, { code: PARTY.code, name: old, to });
    return !!answer.ok;
  } catch {
    return false;
  }
}

function pushes(): boolean {
  return PARTY.role === "member" || (PARTY.role === "host" && PARTY.remote);
}

/*
 * Hand our latest fight to whoever holds the board and take the merged board
 * back. That is the host's machine for LAN hosting; for a room on the shared
 * party server, the room's creator is just another poster too.
 */
export async function pushToHost(): Promise<void> {
  if (!pushes() || !PARTY.host) return;
  const host = PARTY.host;
  try {
    const answer = await fetchJson(`http://${host}/party/push`, 6000, {
      code: PARTY.code,
      name: PARTY.name,
      payload: PARTY.mine, // null before the first fight
      weapons: PARTY.weapons,
      ventius: PARTY.ventius,
    });
    if (PARTY.host !== host) return; // left or moved on while this was in flight
    PARTY.board = Array.isArray(answer.board) ? answer.board : [];
    PARTY.target = String(answer.target ?? "");
    PARTY.error = answer.ok ? "" : String(answer.error ?? "the host refused us");
    PARTY.seen = now();
  } catch (err) {
    if (PARTY.host !== host) return;
    if (err instanceof HttpError) {
      let removed = false;
      try {
        removed = !!(JSON.parse(err.body) as Json).kicked;
      } catch {
        removed = false;
      }
      if (removed) {
        // told, not just disconnected: staying would push into a refusal
        // every three seconds and show an empty board with no reason for it
        resetParty({ error: "removed" });
        stopMemberLoop();
        await stopPublic();
      } else {
        PARTY.error = `the host refused us (HTTP ${err.status})`;
      }
    } else {
      PARTY.error = `cannot reach the host (${errorName(err)})`;
    }
  }
}

/*
 * Keeps this machine present on the board. One timer, however often someone
 * joins and leaves, so a quick leave-and-rejoin never ends up pushing twice.
 */
let memberTimer: NodeJS.Timeout | null = null;

export function startMemberLoop(): void {
  if (memberTimer) return;
  const tick = async () => {
    if (!pushes()) {
      stopMemberLoop();
      return;
    }
    await pushToHost();
    if (memberTimer) memberTimer = setTimeout(tick, PUSH_EVERY);
  };
  memberTimer = setTimeout(tick, 0);
}

export function stopMemberLoop(): void {
  if (memberTimer) clearTimeout(memberTimer);
  memberTimer = null;
}

// ------------------------------------------------------------ the listener
/*
 * Reachable from the rest of the network while hosting on this PC. Party
 * traffic only: it cannot read logs or settings.
 */
const CORS = { "Access-Control-Allow-Origin": "*" };

function partyJson(res: http.ServerResponse, obj: unknown, code = 200): void {
  send(res, JSON.stringify(obj), "application/json", code, CORS);
}

async function handleParty(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://party");
  if (req.method === "GET") {
    const code = (url.searchParams.get("code") ?? "").toUpperCase();
    if (code !== PARTY.code) return partyJson(res, { ok: false, error: "wrong code" }, 403);
    if (url.pathname === "/party/ping") return partyJson(res, { ok: true, host: PARTY.name });
    if (url.pathname === "/party/board") {
      const { board, target } = buildBoard();
      return partyJson(res, { ok: true, board, target });
    }
    if (url.pathname === "/party/curve") {
      // same route and answer as the shared party server, so a client does
      // not have to know which of the two it is talking to
      const who = (url.searchParams.get("name") ?? "").trim().slice(0, 40);
      const p = PARTY.members.get(who)?.payload ?? {};
      if (!p.curve?.T) return partyJson(res, { ok: false, error: "no curve" }, 404);
      return partyJson(res, { ok: true, name: who, curve: p.curve, casts: p.casts });
    }
    return partyJson(res, { ok: false }, 404);
  }
  if (req.method !== "POST" || url.pathname !== "/party/push") return partyJson(res, { ok: false }, 404);
  const read = await readJson(req);
  if ("error" in read) return partyJson(res, { ok: false, error: "bad request" }, read.error === "too-large" ? 413 : 400);
  const sent = read.body;
  if (String(sent.code ?? "").toUpperCase() !== PARTY.code) return partyJson(res, { ok: false, error: "wrong code" }, 403);
  const name = String(sent.name ?? "").trim().slice(0, 40);
  if (!name) return partyJson(res, { ok: false, error: "no name" }, 400);
  if (now() < (PARTY.kicked.get(name) ?? 0)) {
    // answered rather than ignored, so the removed client can say what happened
    return partyJson(res, { ok: false, error: "removed", kicked: true }, 403);
  }
  // Always store what was sent, including nothing - keeping the previous
  // payload left the last fight on the board until it timed out.
  record(name, (sent.payload as Payload) ?? null, sent.weapons, sent.ventius);
  const { board, target } = buildBoard();
  partyJson(res, { ok: true, board, target });
}

const PUBLIC: { server: http.Server | null; port: number } = { server: null, port: 0 };

export function publicPort(): number {
  return PUBLIC.port;
}

export async function startPublic(basePort: number): Promise<number> {
  if (PUBLIC.server) return PUBLIC.port;
  const server = http.createServer((req, res) => {
    handleParty(req, res).catch(() => {
      if (!res.headersSent) partyJson(res, { ok: false }, 500);
    });
  });
  const port = await listenFrom(server, "0.0.0.0", basePort + 1, basePort + 40);
  if (!port) return 0;
  PUBLIC.server = server;
  PUBLIC.port = port;
  return port;
}

export async function stopPublic(): Promise<void> {
  const server = PUBLIC.server;
  if (!server) return;
  PUBLIC.server = null;
  PUBLIC.port = 0;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
