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

/** Reads a JSON body. An empty body is `{}`; a body over MAX_BODY stops being kept and answers "too-large" (send 413). */
export function readJson(req: http.IncomingMessage): Promise<ReadResult> {
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
      if (size > MAX_BODY) {
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
 * GET or POST json to another Borometer or the party server. Plain http: the
 * party runs on a LAN address or a small self-hosted server.
 */
export async function fetchJson(url: string, timeoutMs: number, body?: unknown): Promise<Json> {
  const res = await fetch(url, body === undefined
    ? { method: "GET", signal: AbortSignal.timeout(timeoutMs) }
    : { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  if (res.status >= 400) throw new HttpError(res.status, text);
  const value: unknown = JSON.parse(text);
  return value && typeof value === "object" ? (value as Json) : {};
}

export function errorName(err: unknown): string {
  return err instanceof Error ? err.name : "Error";
}

/** Strips the scheme and trailing slashes from a server address. */
export function bareHost(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replaceAll("http://", "")
    .replaceAll("https://", "")
    .replace(/\/+$/, "");
}
