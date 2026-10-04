// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later

import type { BauStore, HistFight, Plan } from "./types";
import { MIN_MEDIAN, mitte, samePair } from "./build-core";

/* ---------- Builds als Links zu Questlog: der rechnende Kern ----------
   Seit Aufgabe 12 der Neugestaltung (Entscheidung 29.09.) ist ein Build in
   Borometer ein Link zu Questlog mit seinen Waffen und einem eigenen Namen;
   Steckbrief, Planer und Ausruestung sind entfallen. Nichts hier greift auf
   die Seite oder das Netz zu; dieselbe Link-Regel steht in
   src/main/questlog.ts (der Helfer ist die Grenze, nicht die Seite) -
   test-plan-core.mjs prueft beide gegen dieselbe Liste. Die Spezifikation
   des Abrufs: docs/superpowers/specs/2026-09-25-build-planer-design.md. */

export type LinkKind = "character" | "skills" | "mastery";
export interface LinkInfo { kind: LinkKind; slug: string; buildId: number | null }
export type LinkWhy = "link" | "buildId";

const PFAD: Record<string, LinkKind> = {
  "character-builder": "character", "skill-builder": "skills", "weapon-mastery": "mastery",
};
const SLUG_RX = /^[A-Za-z0-9_-]{1,64}$/;
const BUILD_RX = /^[0-9]{1,12}$/;

/* Der Link, wie er dasteht, muss schon so aussehen, wie boro-plans.json ihn
   nimmt (LINK_RX in src/main/plans.ts): genau dieser Anfang, klein
   geschrieben, ohne Port, ohne Leer- oder Steuerzeichen, ohne Rueckstrich
   und ohne leeren Pfadteil. new URL allein wuerde all das still glaetten. */
export const LINK_PREFIX = "https://questlog.gg/throne-and-liberty/";
const LINK_MAX = 270;
const ROH_RX = /[\s\u0000-\u001f\u007f-\u009f\\]/;

/** Ein Questlog-Link, oder warum nicht. */
export function parseLink(raw: unknown): LinkInfo | { why: LinkWhy } {
  if(typeof raw !== "string" || raw.length > 300) return {why: "link"};
  const s = raw.trim();
  if(s.length > LINK_MAX || !s.startsWith(LINK_PREFIX) || ROH_RX.test(s)) return {why: "link"};
  const pfad = "/" + s.slice(LINK_PREFIX.length).split(/[?#]/)[0];
  if(pfad.includes("//") || /\/(\.|%2e){1,2}(\/|$)/i.test(pfad)) return {why: "link"};
  let u: URL;
  try { u = new URL(s); } catch { return {why: "link"}; }
  if(u.protocol !== "https:" || u.hostname !== "questlog.gg" || u.port || u.username || u.password) return {why: "link"};
  const teile = u.pathname.split("/").filter(Boolean);
  if(teile[0] !== "throne-and-liberty") return {why: "link"};
  let i = 1;
  if(teile[i] && /^[a-z]{2}$/.test(teile[i]!)) i++;
  const teilstueck = teile[i] || "";
  const kind = Object.hasOwn(PFAD, teilstueck) ? PFAD[teilstueck] : undefined;
  const slug = teile[i + 1] || "";
  if(!kind || !SLUG_RX.test(slug) || teile.length !== i + 2) return {why: "link"};
  /* Questlogs Charakter-Builder waehlt seinen Build mit ?buildId=; ein
     build-id daneben ist dort die Meisterschaft des Builds. Skill-Builder und
     Meisterschaft lesen nur build-id. Ein Charakter-Link nur mit build-id
     (so schrieb Borometer ihn frueher) gilt weiter als Charakter-Build; wie
     der Helfer damit umgeht, wenn es den nicht gibt, steht in questlog.ts. */
  const rohCb = kind === "character" ? u.searchParams.get("buildId") : null;
  const roh = rohCb ?? u.searchParams.get("build-id");
  if(roh != null && !BUILD_RX.test(roh)) return {why: "buildId"};
  const buildId = roh == null ? null : Number(roh);
  if(kind !== "character" && buildId == null) return {why: "buildId"};
  return {kind, slug, buildId};
}

/** Ein Charakter-Link mit dem gewaehlten Build (?buildId= oder &buildId=, wie
    Questlog selbst), damit "Neu abrufen" nicht noch einmal fragt; null, wenn
    der Link schon ein buildId traegt oder das nicht als Link durchgeht. Ein
    build-id bleibt stehen - buildId geht ihm vor. */
export function linkMitBuild(link: string, buildId: number): string | null {
  const info = parseLink(link);
  if("why" in info || info.kind !== "character" || !Number.isInteger(buildId) || buildId < 0) return null;
  const s = link.trim(), raute = s.indexOf("#");
  if(param(s, "buildId") != null) return null;
  const vorn = raute >= 0 ? s.slice(0, raute) : s, hinten = raute >= 0 ? s.slice(raute) : "";
  const neu = vorn + (vorn.includes("?") ? "&" : "?") + "buildId=" + buildId + hinten;
  const nachher = parseLink(neu);
  return !("why" in nachher) && nachher.buildId === buildId ? neu : null;
}

/** Ein Parameter eines Links, den parseLink schon genommen hat. */
const param = (link: string, name: string) => new URL(link.trim()).searchParams.get(name);

/** Die Kennung eines Plans: "p" und neun Zeichen aus Art, Slug und Build. */
export const PLAN_ID_RX = /^p[0-9a-z]{9}$/;
export function planId(link: LinkInfo, buildId: number): string {
  // FNV-1a, zweimal mit anderem Anfang - 64 Bit reichen fuer ein paar hundert Plaene
  const s = link.kind + "|" + link.slug + "|" + buildId;
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for(let k = 0; k < s.length; k++){
    a = Math.imul(a ^ s.charCodeAt(k), 0x01000193) >>> 0;
    b = Math.imul(b ^ s.charCodeAt(k), 0x01000193) >>> 0;
  }
  return "p" + (a.toString(36) + b.toString(36)).padStart(9, "0").slice(-9);
}


/* ---------- ein Eintrag in boro-plans.json ----------
   Seit Aufgabe 12: Link, Zeitpunkt, Waffen und der eigene Name (leer, wenn
   keiner gegeben wurde) - Questlogs Buildname lebt nur in der Sitzung.
   Aeltere Plaene tragen dazu, was der Planer damals speicherte (IDs, Stufen,
   Zahlen, den Steckbrief und Questlogs Buildnamen als name); die Seite liest
   davon nur Link, Zeitpunkt, Waffen und name und schreibt beim Loesen alles
   andere unveraendert zurueck. "geloest" markiert einen geloesten Eintrag:
   er bleibt gespeichert, nur ohne Karte. */
const NAME_MAX = 60;
/** Hat ein gelesener Eintrag die Form, die eine Karte braucht? Was nicht traegt, wird uebergangen (und bleibt in der Datei). */
export function looksLikeEintrag(e: unknown): e is Plan {
  if(!e || typeof e !== "object" || Array.isArray(e)) return false;
  const x = e as Record<string, unknown>;
  if("why" in parseLink(x.link) || !Number.isFinite(x.at)) return false;
  if(typeof x.name !== "string" || x.name.length > NAME_MAX) return false;
  if(!Array.isArray(x.weapons) || x.weapons.length !== 2 || !x.weapons.every(w => typeof w === "string" && w.length <= 40)) return false;
  return x.geloest === undefined || Number.isFinite(x.geloest);
}

/** Ein Boss auf der Karte: seine Kaempfe mit diesen Waffen, der Median erst ab MIN_MEDIAN (wie ueberall). */
export interface BossZahl { key: string; name: string; n: number; median: number | null; letzter: number }
export interface KartenZahlen { letzter: number | null; bosse: BossZahl[] }

/** Die Zahlen einer Karte aus dem Verlaufsverzeichnis: jeder Kampf, dessen Build (b) dieselben Waffen hat -
    die Reihenfolge egal, gleich aus welchem Build. "zuletzt gespielt" zaehlt auch die Uebungspuppe (c), die
    Bosse nicht; hoechstens max Bosse, die mit den meisten Kaempfen zuerst. key fasst Phasen und
    Schreibweisen eines Bosses zusammen (histKey in 06-blocks-and-places.ts). */
export function kartenZahlen(waffen: readonly string[], kaempfe: readonly HistFight[], builds: BauStore,
                             key: (name: string) => string, max = 3): KartenZahlen {
  if(!waffen.some(Boolean)) return {letzter: null, bosse: []};
  const mit = kaempfe.filter(f => typeof f.b === "string" && Object.hasOwn(builds, f.b) && samePair(builds[f.b]!.weapons, waffen)
    && f.dps > 0 && Number.isFinite(f.at));
  const je = new Map<string, HistFight[]>();
  for(const f of [...mit].sort((a, b) => a.at - b.at)){
    if(f.c) continue;
    const k = key(f.name);
    const liste = je.get(k);
    if(liste) liste.push(f); else je.set(k, [f]);
  }
  const bosse = [...je.entries()].map(([k, l]) => ({
    key: k,
    // die zuletzt gesehene Schreibweise, wie im Verlauf
    name: l[l.length - 1]!.name,
    n: l.length,
    median: l.length >= MIN_MEDIAN ? mitte(l.map(f => f.dps)) : null,
    letzter: l[l.length - 1]!.at,
  })).sort((a, b) => b.n - a.n || b.letzter - a.letzter).slice(0, max);
  return {letzter: mit.length ? Math.max(...mit.map(f => f.at)) : null, bosse};
}

/** Je Eintrag die anderen mit denselben Waffen (Reihenfolge egal), in der Reihenfolge der Kennungen. */
export function gleicheWaffen(eintraege: Readonly<Record<string, { weapons: readonly string[] }>>): Record<string, string[]> {
  const ids = Object.keys(eintraege).sort();
  const raus: Record<string, string[]> = {};
  for(const id of ids)
    raus[id] = ids.filter(o => o !== id && eintraege[id]!.weapons.some(Boolean) && samePair(eintraege[id]!.weapons, eintraege[o]!.weapons));
  return raus;
}

/** Die Reihenfolge der Karten: die mit den Waffen des offenen Kampfs zuerst, dann die zuletzt gespielte, dann die zuletzt gespeicherte. */
export function kartenFolge(eintraege: Readonly<Record<string, { weapons: readonly string[]; at: number }>>,
                            offen: readonly string[] | null, letzter: (id: string) => number | null): string[] {
  const passt = (id: string) => !!offen && offen.some(Boolean) && samePair(eintraege[id]!.weapons, offen);
  return Object.keys(eintraege).sort((a, b) =>
    Number(passt(b)) - Number(passt(a)) || (letzter(b) ?? -Infinity) - (letzter(a) ?? -Infinity)
    || eintraege[b]!.at - eintraege[a]!.at || (a < b ? -1 : 1));
}
