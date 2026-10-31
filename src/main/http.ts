// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

import * as http from "node:http";

export type Json = Record<string, unknown>;

/*
 * A body the local page or the party network could ever legitimately send: a
 * full run or party-log save, with every player's casts for a long fight, is
 * the largest thing this app posts to itself, and stays well under this. The
 * cap exists so an unbounded read can't be used to exhaust memory before any
 * route's own size checks (best.ts's MAX_ENTRY, for one) get a chance to run.
 *
 * Past the cap nothing more is kept, and the answer is 413 with
 * "Connection: close" (send() below): Node closes the socket once that answer
 * is out and drops whatever of the body is still arriving. A sender just past
 * the cap reads the 413. One still far from done uploading - measured: a
 * 12 MiB body on Windows - usually sees the connection reset first instead;
 * TCP answers unread incoming data at close with a reset. Reading the rest
 * only to be able to answer would give up the cap, so that stays.
 */
const MAX_BODY = 8 * 1024 * 1024;

/** What readJson resolved: a body, or why there is none. */
export type ReadResult = { body: Json } | { error: "invalid" | "too-large" };

export function send(
  res: http.ServerResponse,
  body: string | Buffer,
  type = "text/plain; charset=utf-8",
  code = 200,
  extra: http.OutgoingHttpHeaders = {},
): void {
  const data = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  res.writeHead(code, {
    "Content-Type": type,
    "Content-Length": data.length,
    // 413: the rest of the body is never read, so the connection cannot be
    // reused; without this Node would read and discard it all to keep it open
    ...(code === 413 ? { Connection: "close" } : {}),
    ...extra,
  });
  res.end(data);
}

/** Reads a JSON body. An empty body is `{}`; a body over `max` (MAX_BODY unless a route asks for more) stops being kept and answers "too-large" (send 413). */
export function readJson(req: http.IncomingMessage, max = MAX_BODY): Promise<ReadResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (r: ReadResult): void => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    req.on("data", (c: Buffer) => {
      if (settled) return;
      size += c.length;
      if (size > max) {
        // keep nothing more; the socket stays up just long enough for the
        // caller's 413, which closes it (see MAX_BODY). Destroying it here
        // instead meant no sender ever got the 413.
        chunks.length = 0;
        finish({ error: "too-large" });
        return;
      }
      chunks.push(c);
    });
    req.on("error", () => finish({ error: "invalid" }));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) return finish({ body: {} });
      try {
        const value: unknown = JSON.parse(text);
        finish(value && typeof value === "object" && !Array.isArray(value) ? { body: value as Json } : { error: "invalid" });
      } catch {
        finish({ error: "invalid" });
      }
    });
  });
}

/** Listens on the first free port in [first, last). Resolves 0 when none is. */
export async function listenFrom(server: http.Server, host: string, first: number, last: number): Promise<number> {
  for (let port = first; port < last; port++) {
    const ok = await new Promise<boolean>((resolve) => {
      const onError = () => {
        server.off("listening", onListening);
        resolve(false);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve(true);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      // exclusive: never share a port with another Borometer. Two instances on
      // one port once meant the second window showed the first one's page.
      server.listen({ port, host, exclusive: true });
    });
    if (ok) return port;
  }
  return 0;
}

/** Raised for an answer with a status of 400 or more. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`HTTP ${status}`);
    this.name = "HTTPError";
  }
}

/**
 * GET or POST json to another Borometer or the party server: http on a LAN
 * address or a small self-hosted server, https where the server has a
 * certificate. A redirect is an error, never followed: the request goes to the
 * address the person set and nowhere else. Optional headers carry what must
 * not stand in a URL (the guild code and keys).
 */
export async function fetchJson(url: string, timeoutMs: number, body?: unknown, headers?: Record<string, string>): Promise<Json> {
  const res = await fetch(url, body === undefined
    ? { method: "GET", redirect: "error", headers: { ...headers }, signal: AbortSignal.timeout(timeoutMs) }
    : { method: "POST", redirect: "error", headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  if (res.status >= 400) throw new HttpError(res.status, text);
  const value: unknown = JSON.parse(text);
  return value && typeof value === "object" ? (value as Json) : {};
}

export function errorName(err: unknown): string {
  return err instanceof Error ? err.name : "Error";
}

/** The port the party server listens on when an http:// address names none. */
export const PARTY_PORT = 8732;

/*
 * The server address a person typed: an optional http:// or https://, a host,
 * an optional port. Anything else (another scheme, nothing after the scheme)
 * is no address. Trailing slashes and a path are cut off.
 */
function splitServer(raw: unknown): { secure: boolean; host: string } | null {
  const m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\[[^\]\s]+\](?::\d+)?|[^/\s?#:]+(?::\d+)?)(?=$|[/?#\s])/i.exec(String(raw ?? "").trim());
  if (!m) return null;
  // the scheme is tested by pattern, not named as a string, so the audit's
  // list of network module names stays free of false hits
  const scheme = m[1] ?? "";
  if (scheme && !/^https?$/i.test(scheme)) return null;
  return { secure: /^https$/i.test(scheme), host: m[2] ?? "" };
}

/**
 * What is saved for an address: "https://host" when it is one, otherwise the
 * bare "host[:port]" an older setting already looks like (no scheme means
 * http). Empty when the input is no address.
 */
export function serverAddress(raw: unknown): string {
  const s = splitServer(raw);
  if (!s) return "";
  return s.secure ? `https://${s.host}` : s.host;
}

/**
 * The base URL requests go to, scheme and port included: https without a port
 * means 443 (nothing appended), http without a port means PARTY_PORT. The
 * certificate of an https address is checked by Node's own defaults; nothing
 * here or in fetchJson loosens that.
 */
export function serverBase(raw: unknown): string {
  const s = splitServer(raw);
  if (!s) return "";
  if (s.secure) return `https://${s.host}`;
  return `http://${/:\d+$/.test(s.host) ? s.host : `${s.host}:${PARTY_PORT}`}`;
}

/** True when the address would travel unencrypted (an address is set and is not https). */
export function isPlain(raw: unknown): boolean {
  const s = splitServer(raw);
  return !!s && !s.secure;
}
