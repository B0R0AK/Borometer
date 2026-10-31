// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Guild online (issue #229, spec 2026-10-12-gilde-online-design.md; the rule
 * change was approved on 12.10.2026). The only module that takes the
 * guild off this computer, and only when a leader turned "guild online" on
 * (off from the factory) and typed a server address that starts with
 * https://. Every call goes to that address and to no other, with the guild
 * code and the keys in headers, never in a URL. A key belongs to the server it
 * was issued by: if the address in the settings changes, nothing is sent until
 * it is the old one again.
 *
 * It never reads the local guild file and does not import gilde.ts: the local guild
 * reaches this module only as part of a click ("put it on the server"), through
 * the page's request body. What this module keeps is its own file in the settings folder,
 * the joined guild with the last state received (so the page can show it when
 * the server is down), the person's key, and the guilds left earlier. Nothing
 * in it is ever emptied: leaving a guild only marks it, joining another moves
 * the old entry to "fruehere".
 *
 * Calls are made only for a click or for the page asking about the guild while
 * its area is open, never at start and never in the background; a pull at most
 * every 30 s, 8 s per call, nothing over 2.5 MiB back. The page gets the guild
 * code (everyone in the guild has it) but never a key, except once the ready
 * invitation of a new editor link, which the leader hands on. safety-audit.mjs,
 * section 13c.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "./config";
import { fetchJson, HttpError, serverBase, type Json } from "./http";
import { settingsPath } from "./paths";

export const GILDE_ONLINE_PATH = settingsPath("boro-gilde-online.json");
const SICHERUNG_DIR = settingsPath("sicherungen");

const TIMEOUT_MS = 8000;
const MIN_ABRUF_MS = 30000;
const MAX_ANTWORT = 2621440; // 2.5 MiB of text
const MAX_STAND = 2097152; // the local limit of a guild, 2 MiB of text
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RX = new RegExp(`^[${ALPHABET}]{12}$`);
const KEY_RX = new RegExp(`^[${ALPHABET}]{26}$`);

export type Rolle = "lead" | "bearbeiter" | "lesen";
export type Net = typeof fetchJson;

/** Everything that makes a call or reads the clock, so a test can stand in for it. */
export interface Deps {
  net: Net;
  config: () => { an: boolean; server: string };
  /** wall clock, ms */
  uhr: () => number;
  /** monotonic clock, ms */
  mono: () => number;
}

export const realDeps: Deps = {
  net: fetchJson,
  config: () => {
    const c = loadConfig();
    return { an: c.gildeOnline === true, server: typeof c.gildeServer === "string" ? c.gildeServer : "" };
  },
  uhr: () => Date.now(),
  mono: () => performance.now(),
};

interface Eintrag {
  server: string;
  code: string;
  rolle: Rolle;
  key?: string;
  label?: string;
  widerrufen?: boolean;
  /** the server answered 410 closed: the leader ended this guild; the last state stays */
  beendet?: boolean;
  /** the leader ended it from this computer on this day (the entry is then left, too) */
  beendetAm?: string;
  /** the leader deleted it for good on this day (issue #240): the state and the key are gone from this entry */
  geloeschtAm?: string;
  /** the server does not know the guild any more (the leader deleted it): the last state stays here, nothing more is asked */
  entfernt?: boolean;
  v: number;
  stand: unknown;
  standZeit: number;
  verlassenAm?: string;
}
interface Datei {
  v: 1;
  gilde: Eintrag | null;
  fruehere: Eintrag[];
}

export type Grund =
  | "aus" | "kein-https" | "adresse" | "keine-gilde" | "schon-verbunden" | "rolle" | "stand" | "einladung"
  | "offline" | "abgelehnt" | "spaeter" | "veraltet" | "widerrufen" | "antwort" | "datei" | "beendet" | "alt" | "entfernt";
export type Ergebnis<T = object> = ({ ok: true } & T) | { ok: false; grund: Grund; stand?: unknown; v?: number };

let letzterAbruf = -Infinity;
let offline = false;

// ---------------------------------------------------------------- the file

/** The one read of the file: its content (an empty state when there is none) and whether it can be trusted as it is. */
function ladeDatei(): { datei: Datei; lesbar: boolean } {
  const leer: Datei = { v: 1, gilde: null, fruehere: [] };
  let text: string;
  try {
    text = fs.readFileSync(GILDE_ONLINE_PATH, "utf8");
  } catch (err) {
    // no file yet is an empty state; a file that is there and cannot be read is never replaced
    return { datei: leer, lesbar: (err as NodeJS.ErrnoException).code === "ENOENT" };
  }
  try {
    const d: unknown = JSON.parse(text);
    if (d && typeof d === "object" && (d as Datei).v === 1) {
      const x = d as Datei;
      return { datei: { v: 1, gilde: x.gilde && typeof x.gilde === "object" ? x.gilde : null, fruehere: Array.isArray(x.fruehere) ? x.fruehere : [] }, lesbar: true };
    }
  } catch {
    /* falls through: not understood */
  }
  return { datei: leer, lesbar: false };
}

function leseDatei(): Datei {
  return ladeDatei().datei;
}

/** Whole or not at all: written beside, then renamed over. */
function schreibeDatei(d: Datei): boolean {
  if (!ladeDatei().lesbar) return false;
  try {
    fs.writeFileSync(GILDE_ONLINE_PATH + ".tmp", JSON.stringify(d), "utf8");
    fs.renameSync(GILDE_ONLINE_PATH + ".tmp", GILDE_ONLINE_PATH);
    return true;
  } catch {
    return false;
  }
}

function aktiv(d: Datei): Eintrag | null {
  return d.gilde && !d.gilde.verlassenAm ? d.gilde : null;
}

// ---------------------------------------------------------------- the one way out

interface Antwort {
  status: number;
  json: Json;
}

/** Whether the switch is on and the address is https; the base to call, or the reason not to. */
function bereit(deps: Deps): { basis: string } | { grund: Grund } {
  const c = deps.config();
  if (!c.an) return { grund: "aus" };
  const basis = serverBase(c.server);
  if (!basis.startsWith("https://")) return { grund: "kein-https" };
  return { basis };
}

/*
 * The only place a request leaves: the address is serverBase of the setting
 * with /gilde/ behind it, code and key go in headers. 8 s, no redirect (fetchJson).
 */
async function ruf(deps: Deps, adresse: string, methode: "GET" | "POST", pfad: string, body?: Json, e?: Eintrag): Promise<Antwort> {
  // belt and braces: bereit() has checked this already, the one place a request leaves checks it again
  if (!serverBase(adresse).startsWith("https://")) return { status: 0, json: {} };
  const headers: Record<string, string> = {};
  if (e) {
    headers["X-Gilde-Code"] = e.code;
    if (e.key && !e.widerrufen) headers.Authorization = "Bearer " + e.key;
  }
  try {
    const json = await deps.net(`${serverBase(adresse)}/gilde/${pfad}`, TIMEOUT_MS, methode === "POST" ? (body ?? {}) : undefined, headers);
    if (JSON.stringify(json).length > MAX_ANTWORT) return { status: 502, json: {} };
    offline = false;
    return { status: 200, json };
  } catch (err) {
    if (err instanceof HttpError) {
      offline = false;
      let json: Json = {};
      try {
        const p: unknown = JSON.parse(err.body);
        if (p && typeof p === "object") json = p as Json;
      } catch {
        /* an answer that is not JSON counts as an answer without content */
      }
      return { status: err.status, json };
    }
    offline = true;
    return { status: 0, json: {} };
  }
}

function fehlerGrund(a: Antwort): Grund {
  if (a.status === 0) return "offline";
  if (a.status === 429) return "spaeter";
  if (a.status === 403 && a.json.error === "revoked") return "widerrufen";
  if (a.status === 410 && a.json.error === "closed") return "beendet";
  if (a.status === 502) return "antwort";
  return "abgelehnt";
}

/** A key goes only to the server that issued it. */
function amRechtenServer(e: Eintrag, basis: string): boolean {
  return serverBase(e.server) === basis;
}

function standOk(s: unknown): boolean {
  if (!s || typeof s !== "object" || Array.isArray(s)) return false;
  const x = s as { v?: unknown; gilde?: unknown };
  const g = x.gilde as { id?: unknown } | null;
  if (x.v !== 1 || !g || typeof g !== "object" || typeof g.id !== "string") return false;
  return JSON.stringify(s).length <= MAX_STAND;
}

/** The lead or an editor, on the right server, with the switch on: what a call needs first. */
function vorbereiten(deps: Deps, rollen: Rolle[] | null): { basis: string; d: Datei; e: Eintrag } | { grund: Grund } {
  const b = bereit(deps);
  if ("grund" in b) return b;
  const d = leseDatei();
  const e = aktiv(d);
  if (!e) return { grund: "keine-gilde" };
  if (!amRechtenServer(e, b.basis)) return { grund: "adresse" };
  if (rollen && e.entfernt) return { grund: "entfernt" };
  if (rollen && e.beendet) return { grund: "beendet" };
  if (rollen && (!rollen.includes(e.rolle) || (e.widerrufen && e.rolle !== "lead"))) return { grund: "rolle" };
  return { basis: b.basis, d, e };
}

// ---------------------------------------------------------------- what the page asks

export interface Status {
  an: boolean;
  adresse: string;
  adresseOk: boolean;
  verbunden: boolean;
  rolle?: Rolle;
  code?: string;
  label?: string;
  v?: number;
  standZeit?: number;
  offline: boolean;
  widerrufen?: boolean;
  beendet?: boolean;
  entfernt?: boolean;
  stand?: unknown;
  /** guilds this leader ended from here (their entries are left): what could be opened again; never a key */
  beendete: { code: string; name: string; am: string; mitglieder: number }[];
}

/** The guilds this leader ended from this computer, from the entry and from the ones left earlier. */
function beendete(d: Datei): Status["beendete"] {
  return [...(d.gilde ? [d.gilde] : []), ...d.fruehere]
    .filter((x) => x.rolle === "lead" && x.beendetAm && x.verlassenAm && !x.geloeschtAm)
    .map((x) => {
      const g = (x.stand as { gilde?: { name?: unknown; mitglieder?: unknown } } | null)?.gilde;
      const m = Array.isArray(g?.mitglieder) ? (g.mitglieder as { geloest?: boolean }[]).filter((q) => !q.geloest).length : 0;
      return { code: x.code, name: typeof g?.name === "string" ? g.name : "", am: x.beendetAm ?? "", mitglieder: m };
    });
}

/** Reads the file only; never goes out. Never holds a key. */
export function status(deps: Deps = realDeps): Status {
  const c = deps.config();
  const adresseOk = serverBase(c.server).startsWith("https://");
  const d = leseDatei();
  const e = aktiv(d);
  const s: Status = { an: c.an, adresse: c.server, adresseOk, verbunden: !!e, offline, beendete: beendete(d) };
  if (e) {
    s.rolle = e.widerrufen ? "lesen" : e.rolle;
    s.code = e.code;
    if (e.label) s.label = e.label;
    s.v = e.v;
    s.standZeit = e.standZeit;
    s.widerrufen = !!e.widerrufen;
    if (e.beendet) s.beendet = true;
    if (e.entfernt) s.entfernt = true;
    s.stand = e.stand;
  }
  return s;
}

function neuerEintrag(basis: string, code: string, rolle: Rolle, key: string | undefined, v: number, stand: unknown, uhr: number, label?: string): Eintrag {
  return { server: basis, code, rolle, ...(key ? { key } : {}), ...(label ? { label } : {}), v, stand, standZeit: uhr };
}

/** Puts a new entry in place; an entry left earlier moves to "fruehere". */
function ablegen(e: Eintrag): boolean {
  const d = leseDatei();
  const fruehere = [...d.fruehere];
  if (d.gilde) fruehere.push(d.gilde);
  letzterAbruf = -Infinity;
  return schreibeDatei({ v: 1, gilde: e, fruehere });
}

export async function gruenden(stand: unknown, name: string, deps: Deps = realDeps): Promise<Ergebnis<{ code: string }>> {
  const b = bereit(deps);
  if ("grund" in b) return { ok: false, grund: b.grund };
  if (aktiv(leseDatei())) return { ok: false, grund: "schon-verbunden" };
  if (!standOk(stand)) return { ok: false, grund: "stand" };
  const a = await ruf(deps, deps.config().server, "POST", "neu", { name: String(name ?? "").slice(0, 60), stand: stand as Json });
  if (a.status !== 200) return { ok: false, grund: fehlerGrund(a) };
  const code = String(a.json.code ?? ""), key = String(a.json.leadKey ?? ""), v = Number(a.json.v);
  if (!CODE_RX.test(code) || !KEY_RX.test(key) || !Number.isInteger(v)) return { ok: false, grund: "antwort" };
  if (!ablegen(neuerEintrag(b.basis, code, "lead", key, v, stand, deps.uhr()))) return { ok: false, grund: "datei" };
  return { ok: true, code };
}

export async function beitreten(code: string, key: string | undefined, deps: Deps = realDeps): Promise<Ergebnis<{ rolle: Rolle }>> {
  const b = bereit(deps);
  if ("grund" in b) return { ok: false, grund: b.grund };
  if (!CODE_RX.test(code) || (key !== undefined && !KEY_RX.test(key))) return { ok: false, grund: "einladung" };
  if (aktiv(leseDatei())) return { ok: false, grund: "schon-verbunden" };
  const probe: Eintrag = { server: b.basis, code, rolle: "lesen", ...(key ? { key } : {}), v: 0, stand: null, standZeit: 0 };
  const a = await ruf(deps, deps.config().server, "GET", "stand?seen=0", undefined, probe);
  if (a.status !== 200) return { ok: false, grund: fehlerGrund(a) };
  const rolle = a.json.rolle === "lead" || a.json.rolle === "bearbeiter" ? a.json.rolle : "lesen";
  const v = Number(a.json.v);
  if (!Number.isInteger(v) || !a.json.stand) return { ok: false, grund: "antwort" };
  const label = typeof a.json.label === "string" ? a.json.label : undefined;
  const e = neuerEintrag(b.basis, code, rolle, rolle === "lesen" ? undefined : key, v, a.json.stand, deps.uhr(), label);
  if (!ablegen(e)) return { ok: false, grund: "datei" };
  return { ok: true, rolle };
}

/** Pulls the state if the last pull is at least 30 s ago (or when forced); otherwise the stored one. */
export async function abrufen(deps: Deps = realDeps, erzwingen = false): Promise<Ergebnis<{ zwischenspeicher?: boolean }>> {
  const p = vorbereiten(deps, null);
  if ("grund" in p) return { ok: false, grund: p.grund };
  if (p.e.entfernt) return { ok: false, grund: "entfernt" };
  const jetzt = deps.mono();
  if (!erzwingen && jetzt - letzterAbruf < MIN_ABRUF_MS) return { ok: true, zwischenspeicher: true };
  letzterAbruf = jetzt;
  const a = await ruf(deps, deps.config().server, "GET", `stand?seen=${p.e.v}`, undefined, p.e);
  if (a.status === 403 && a.json.error === "revoked") {
    p.e.widerrufen = true;
    schreibeDatei({ ...p.d, gilde: p.e });
    return { ok: false, grund: "widerrufen" };
  }
  if (a.status === 404 && a.json.error === "unknown code") {
    // the leader deleted the guild on the server: the last state stays here, nothing is asked again
    p.e.entfernt = true;
    schreibeDatei({ ...p.d, gilde: p.e });
    return { ok: false, grund: "entfernt" };
  }
  if (a.status === 410 && a.json.error === "closed") {
    // the leader ended the guild: the last state stays, nothing is asked again until it is open
    p.e.beendet = true;
    schreibeDatei({ ...p.d, gilde: p.e });
    return { ok: false, grund: "beendet" };
  }
  if (a.status !== 200) return { ok: false, grund: fehlerGrund(a) };
  const v = Number(a.json.v);
  if (!Number.isInteger(v)) return { ok: false, grund: "antwort" };
  delete p.e.beendet;
  if (a.json.unchanged !== true) {
    if (!a.json.stand) return { ok: false, grund: "antwort" };
    p.e.stand = a.json.stand;
    p.e.v = v;
    if (a.json.rolle === "lead" || a.json.rolle === "bearbeiter" || a.json.rolle === "lesen") p.e.rolle = a.json.rolle;
  }
  p.e.standZeit = deps.uhr();
  if (!schreibeDatei({ ...p.d, gilde: p.e })) return { ok: false, grund: "datei" };
  return { ok: true };
}

export async function schreiben(stand: unknown, deps: Deps = realDeps): Promise<Ergebnis> {
  const p = vorbereiten(deps, ["lead", "bearbeiter"]);
  if ("grund" in p) return { ok: false, grund: p.grund };
  if (!standOk(stand)) return { ok: false, grund: "stand" };
  const a = await ruf(deps, deps.config().server, "POST", "stand", { base: p.e.v, stand: stand as Json }, p.e);
  if (a.status === 409) {
    // somebody wrote in between: the server's state replaces the stored one, nothing of ours is sent again
    const v = Number(a.json.v);
    if (Number.isInteger(v) && a.json.stand) {
      p.e.v = v;
      p.e.stand = a.json.stand;
      p.e.standZeit = deps.uhr();
      schreibeDatei({ ...p.d, gilde: p.e });
    }
    return { ok: false, grund: "veraltet", v, stand: a.json.stand };
  }
  if (a.status === 410 && a.json.error === "closed") {
    p.e.beendet = true;
    schreibeDatei({ ...p.d, gilde: p.e });
    return { ok: false, grund: "beendet" };
  }
  if (a.status !== 200) return { ok: false, grund: fehlerGrund(a) };
  const v = Number(a.json.v);
  if (!Number.isInteger(v)) return { ok: false, grund: "antwort" };
  p.e.v = v;
  p.e.stand = stand;
  p.e.standZeit = deps.uhr();
  return schreibeDatei({ ...p.d, gilde: p.e }) ? { ok: true } : { ok: false, grund: "datei" };
}

// ------------------------------------------------ the lead's own: links, states, backups

export async function linkNeu(label: string, deps: Deps = realDeps): Promise<Ergebnis<{ id: string; code: string; schluessel: string }>> {
  const p = vorbereiten(deps, ["lead"]);
  if ("grund" in p) return { ok: false, grund: p.grund };
  const a = await ruf(deps, deps.config().server, "POST", "link", { label: String(label ?? "").slice(0, 40) }, p.e);
  if (a.status !== 200) return { ok: false, grund: fehlerGrund(a) };
  const id = String(a.json.id ?? ""), key = String(a.json.key ?? "");
  if (!id || !KEY_RX.test(key)) return { ok: false, grund: "antwort" };
  // the key of the new editor link goes to the page once, to be handed on as an invitation; it is not kept here
  return { ok: true, id, code: p.e.code, schluessel: key };
}

export async function linkWiderruf(id: string, deps: Deps = realDeps): Promise<Ergebnis> {
  const p = vorbereiten(deps, ["lead"]);
  if ("grund" in p) return { ok: false, grund: p.grund };
  const a = await ruf(deps, deps.config().server, "POST", "link/widerruf", { id: String(id ?? "") }, p.e);
  return a.status === 200 ? { ok: true } : { ok: false, grund: fehlerGrund(a) };
}

export async function links(deps: Deps = realDeps): Promise<Ergebnis<{ links: unknown[] }>> {
  const p = vorbereiten(deps, ["lead"]);
  if ("grund" in p) return { ok: false, grund: p.grund };
  const a = await ruf(deps, deps.config().server, "GET", "links", undefined, p.e);
  return a.status === 200 && Array.isArray(a.json.links) ? { ok: true, links: a.json.links } : { ok: false, grund: fehlerGrund(a) };
}

export async function staende(deps: Deps = realDeps): Promise<Ergebnis<{ staende: unknown[]; gekuerzt?: number }>> {
  const p = vorbereiten(deps, ["lead"]);
  if ("grund" in p) return { ok: false, grund: p.grund };
  const a = await ruf(deps, deps.config().server, "GET", "staende", undefined, p.e);
  // `gekuerzt` (total count) only appears when the server cut the list; older servers never send it.
  const gekuerzt = typeof a.json.gekuerzt === "number" && Number.isFinite(a.json.gekuerzt) ? { gekuerzt: a.json.gekuerzt } : {};
  return a.status === 200 && Array.isArray(a.json.staende) ? { ok: true, staende: a.json.staende, ...gekuerzt } : { ok: false, grund: fehlerGrund(a) };
}

export async function standNr(n: number, deps: Deps = realDeps): Promise<Ergebnis<{ v: number; stand: unknown }>> {
  const p = vorbereiten(deps, ["lead"]);
  if ("grund" in p) return { ok: false, grund: p.grund };
  if (!Number.isInteger(n) || n < 1) return { ok: false, grund: "stand" };
  const a = await ruf(deps, deps.config().server, "GET", `stand?v=${n}`, undefined, p.e);
  return a.status === 200 && a.json.stand ? { ok: true, v: Number(a.json.v), stand: a.json.stand } : { ok: false, grund: fehlerGrund(a) };
}

/** Writes an earlier state as a new one on the server, then loads it. Nothing is changed or removed there. */
export async function zurueck(n: number, deps: Deps = realDeps): Promise<Ergebnis<{ v: number }>> {
  const p = vorbereiten(deps, ["lead"]);
  if ("grund" in p) return { ok: false, grund: p.grund };
  if (!Number.isInteger(n) || n < 1) return { ok: false, grund: "stand" };
  const a = await ruf(deps, deps.config().server, "POST", "zurueck", { v: n }, p.e);
  if (a.status !== 200) return { ok: false, grund: fehlerGrund(a) };
  const v = Number(a.json.v);
  await abrufen(deps, true);
  return { ok: true, v };
}

export async function marke(n: number, label: string, deps: Deps = realDeps): Promise<Ergebnis> {
  const p = vorbereiten(deps, ["lead"]);
  if ("grund" in p) return { ok: false, grund: p.grund };
  const a = await ruf(deps, deps.config().server, "POST", "marke", { v: n, label: String(label ?? "").slice(0, 60) }, p.e);
  return a.status === 200 ? { ok: true } : { ok: false, grund: fehlerGrund(a) };
}

/**
 * Ending flags the guild on the server (it takes no more changes and tells everybody "closed"); its files stay there,
 * and the leader can open it again. This computer keeps its copy, marks the guild as ended and as left. An answer
 * "closed" (somebody ended it already) counts as done.
 */
export async function schliessen(deps: Deps = realDeps): Promise<Ergebnis> {
  const p = vorbereiten(deps, ["lead"]);
  if ("grund" in p && p.grund !== "beendet") return { ok: false, grund: p.grund };
  const d = leseDatei();
  const e = aktiv(d);
  if (!e || e.rolle !== "lead") return { ok: false, grund: "rolle" };
  const a = await ruf(deps, deps.config().server, "POST", "schliessen", {}, e);
  if (a.status !== 200 && !(a.status === 410 && a.json.error === "closed")) return { ok: false, grund: fehlerGrund(a) };
  e.beendetAm = tag(deps.uhr());
  delete e.beendet;
  if (!schreibeDatei({ ...d, gilde: e })) return { ok: false, grund: "datei" };
  return verlassen(deps);
}

/**
 * The leader opens a guild they ended from this computer (or that was ended elsewhere) again: the server flag goes,
 * the entry becomes the open one (the one open before moves to "fruehere"), then the state is pulled.
 */
export async function oeffnen(code: string, deps: Deps = realDeps): Promise<Ergebnis> {
  const b = bereit(deps);
  if ("grund" in b) return { ok: false, grund: b.grund };
  const d = leseDatei();
  const alle = [...(d.gilde ? [d.gilde] : []), ...d.fruehere];
  const e = alle.find((x) => x.code === code);
  if (!e) return { ok: false, grund: "keine-gilde" };
  if (e.rolle !== "lead" || !(e.beendetAm || e.beendet)) return { ok: false, grund: "rolle" };
  if (!amRechtenServer(e, b.basis)) return { ok: false, grund: "adresse" };
  const offen = aktiv(d);
  if (offen && offen.code !== code) return { ok: false, grund: "schon-verbunden" };
  const a = await ruf(deps, deps.config().server, "POST", "oeffnen", {}, e);
  if (a.status === 404 && !a.json.error) return { ok: false, grund: "alt" };
  if (a.status !== 200) return { ok: false, grund: fehlerGrund(a) };
  delete e.beendet;
  delete e.beendetAm;
  delete e.verlassenAm;
  const fruehere = d.fruehere.filter((x) => x !== e);
  if (d.gilde && d.gilde !== e) fruehere.push(d.gilde);
  letzterAbruf = -Infinity;
  if (!schreibeDatei({ v: 1, gilde: e, fruehere })) return { ok: false, grund: "datei" };
  await abrufen(deps, true);
  return { ok: true };
}

function tag(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * A backup file in the settings folder (spec 9): the current state, the links
 * (no keys) and the named states. Written beside others, never over one; it
 * holds names and points, so it is not part of any export (audit 13c).
 */
export async function sicherung(deps: Deps = realDeps): Promise<Ergebnis<{ pfad: string; v: number }>> {
  const p = vorbereiten(deps, ["lead"]);
  if ("grund" in p) return { ok: false, grund: p.grund };
  const adresse = deps.config().server;
  const s = await ruf(deps, adresse, "GET", "stand?seen=0", undefined, p.e);
  if (s.status !== 200 || !s.json.stand) return { ok: false, grund: fehlerGrund(s) };
  const l = await ruf(deps, adresse, "GET", "links", undefined, p.e);
  const st = await ruf(deps, adresse, "GET", "staende", undefined, p.e);
  if (l.status !== 200 || st.status !== 200) return { ok: false, grund: fehlerGrund(l.status !== 200 ? l : st) };
  const v = Number(s.json.v);
  const inhalt = { v: 1, art: "gilde-sicherung", zeit: deps.uhr(), version: v, stand: s.json.stand, links: l.json.links ?? [], staende: st.json.staende ?? [] };
  const pfad = schreibeSicherung(inhalt, v, deps);
  return pfad ? { ok: true, pfad, v } : { ok: false, grund: "datei" };
}

/** Writes a backup file beside the others, never over one ("wx"); the path, or null when it could not be written. */
function schreibeSicherung(inhalt: object, v: number, deps: Deps): string | null {
  try {
    fs.mkdirSync(SICHERUNG_DIR, { recursive: true });
    const basis = `gilde-${tag(deps.uhr())}-v${v}`;
    for (let i = 1; i < 100; i++) {
      const pfad = path.join(SICHERUNG_DIR, i === 1 ? `${basis}.json` : `${basis}-${i}.json`);
      try {
        fs.writeFileSync(pfad, JSON.stringify(inhalt), { encoding: "utf8", flag: "wx" });
        return pfad;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * The leader deletes a guild they ended for good (issue #240): first a backup of the last state kept on this computer, then the
 * server removes the guild (only with the leader key, only when it is closed), then this entry forgets the state and the key.
 * An older server answers 404 without a text: "alt", and nothing here changes. "Unknown code" means it is gone already.
 */
export async function loeschen(code: string, deps: Deps = realDeps): Promise<Ergebnis<{ pfad: string }>> {
  const b = bereit(deps);
  if ("grund" in b) return { ok: false, grund: b.grund };
  const d = leseDatei();
  const e = [...(d.gilde ? [d.gilde] : []), ...d.fruehere].find((x) => x.code === code && !x.geloeschtAm);
  if (!e) return { ok: false, grund: "keine-gilde" };
  if (e.rolle !== "lead" || !e.beendetAm || !e.verlassenAm) return { ok: false, grund: "rolle" };
  if (!amRechtenServer(e, b.basis)) return { ok: false, grund: "adresse" };
  const pfad = schreibeSicherung({ v: 1, art: "gilde-sicherung", zeit: deps.uhr(), version: e.v, stand: e.stand, links: [], staende: [] }, e.v, deps);
  if (!pfad) return { ok: false, grund: "datei" };
  const a = await ruf(deps, deps.config().server, "POST", "loeschen", {}, e);
  if (a.status === 404 && !a.json.error) return { ok: false, grund: "alt" };
  if (a.status !== 200 && !(a.status === 404 && a.json.error === "unknown code")) return { ok: false, grund: fehlerGrund(a) };
  e.geloeschtAm = tag(deps.uhr());
  e.stand = null;
  delete e.key;
  return schreibeDatei(d) ? { ok: true, pfad } : { ok: false, grund: "datei" };
}

/** Leaving only marks the entry; the file and the stored state stay. */
export function verlassen(deps: Deps = realDeps): Ergebnis {
  const d = leseDatei();
  const e = aktiv(d);
  if (!e) return { ok: false, grund: "keine-gilde" };
  e.verlassenAm = tag(deps.uhr());
  letzterAbruf = -Infinity;
  return schreibeDatei({ ...d, gilde: e }) ? { ok: true } : { ok: false, grund: "datei" };
}
