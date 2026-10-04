// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The update notice (spec Update-Hinweis, decided on 02.10.2026):
 * the third and last way out of this computer, beside the party and Questlog.
 * Only when the player turned it on in the settings, once per start, main.ts
 * calls checkUpdate() right behind startServer - never a page request, never
 * again in that run. One GET to UPDATE_URL, without cookies, without
 * following a redirect, 5 s, nothing over 256 KB. Of the answer only
 * tag_name and html_url are read, and html_url must be exactly the release
 * page of that tag. Nothing is downloaded or installed, nothing is stored or
 * logged: the result lives in server.ts's memory (setUpdate) until the app
 * closes. Any failure - no network, a timeout, a redirect, a status other
 * than 200, too large, not JSON, a field that does not fit - is null, and the
 * page shows nothing. This file imports nothing and touches no file, log or
 * setting. safety-audit.mjs, section 14.
 */

export const UPDATE_URL = "https://api.github.com/repos/B0R0AK/Borometer/releases/latest";
const PAGE_PREFIX = "https://github.com/B0R0AK/Borometer/releases/tag/";
const TIMEOUT_MS = 5000;
const MAX_BYTES = 256 * 1024;
// the release tags read v1.8 or v1.5.1; the third number may be missing
const TAG_RX = /^v?(\d{1,3})\.(\d{1,3})(?:\.(\d{1,3}))?$/;

export type Net = (url: string) => Promise<Response>;
export interface UpdateInfo {
  version: string;
  url: string;
}

const realNet: Net = (url) =>
  fetch(url, { method: "GET", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/vnd.github+json" } });

/** The three numbers of a version, or null. */
function numbers(v: string): number[] | null {
  const m = TAG_RX.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? "0")] : null;
}

/** Whether tag is a larger version than current, number by number. */
export function isNewer(tag: string, current: string): boolean {
  const a = numbers(tag);
  const b = numbers(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! > b[i]!;
  }
  return false;
}

/** The two fields of a release, checked; null for anything else. */
export function parseRelease(text: string): { tag: string; url: string } | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const tag = (body as { tag_name?: unknown }).tag_name;
  const url = (body as { html_url?: unknown }).html_url;
  if (typeof tag !== "string" || !TAG_RX.test(tag)) return null;
  if (typeof url !== "string" || url !== PAGE_PREFIX + tag) return null;
  return { tag, url };
}

/** The body in pieces, given up past MAX_BYTES: null then. */
async function readCapped(stream: NonNullable<Response["body"]>): Promise<string | null> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const piece = await reader.read();
    if (piece.done) return text + decoder.decode();
    size += piece.value.byteLength;
    if (size > MAX_BYTES) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    text += decoder.decode(piece.value, { stream: true });
  }
}

/** The version as the page writes its own: 1.9.0 as 1.9, 1.8.1 as it is. */
function shown(tag: string): string {
  const n = numbers(tag)!;
  return n[0] + "." + n[1] + (n[2] ? "." + n[2] : "");
}

/**
 * Asks once whether there is a newer release than current. Never throws:
 * every failure is null.
 */
export async function checkUpdate(current: string, net: Net = realNet): Promise<UpdateInfo | null> {
  try {
    const res = await net(UPDATE_URL);
    if (res.status !== 200 || !res.body) return null;
    const text = await readCapped(res.body);
    if (text === null) return null;
    const found = parseRelease(text);
    if (!found || !isNewer(found.tag, current)) return null;
    return { version: shown(found.tag), url: found.url };
  } catch {
    return null;
  }
}
